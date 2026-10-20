const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { getProfile, saveProfile } = require('../db');

// Resumes are small; hold them in memory but cap hard. Without a limit any
// client can push arbitrarily large bodies into RAM (one upload per request,
// all buffered) — the fastest way to take this process down.
const MAX_RESUME_BYTES = 5 * 1024 * 1024; // 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      /\.pdf$/i.test(file.originalname || '');
    if (!isPdf) return cb(Object.assign(new Error('Only PDF resumes are supported.'), { code: 'UNSUPPORTED_FILE_TYPE' }));
    cb(null, true);
  },
});

// Turn multer's errors into the same JSON shape the rest of the API returns,
// instead of Express's default HTML error page.
function uploadResume(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `Resume is too large. Maximum size is ${MAX_RESUME_BYTES / 1024 / 1024}MB.` });
    }
    if (err.code === 'UNSUPPORTED_FILE_TYPE') {
      return res.status(415).json({ error: err.message });
    }
    return res.status(400).json({ error: 'Upload failed: ' + err.message });
  });
}

// pdf-parse and Gemini are lazy-loaded on first use so they never block server
// startup (these are the heavy modules that slow boot on low-memory machines).
let _PDFParse;
function getPDFParse() {
  if (_PDFParse !== undefined) return _PDFParse;
  _PDFParse = null;
  try {
    // pdf-parse v2 exports a PDFParse *class*, constructed per document.
    // (v1 exported a callable; calling v2's export directly throws
    // "Class constructors cannot be invoked without 'new'".)
    const { PDFParse } = require('pdf-parse');
    _PDFParse = typeof PDFParse === 'function' ? PDFParse : null;
  } catch (e) {
    console.error('pdf-parse failed to load:', e.message);
    _PDFParse = null;
  }
  return _PDFParse;
}

/**
 * Extract text from a PDF buffer using pdf-parse v2.
 * Always destroys the parser so the worker/document is released — without this
 * every upload leaks memory until the process dies.
 * Throws with a `.userMessage` when the cause is the file itself.
 */
async function extractPdfText(buffer) {
  const PDFParse = getPDFParse();
  if (!PDFParse) {
    const err = new Error('pdf-parse unavailable');
    err.statusCode = 503;
    err.userMessage = 'Resume parsing is temporarily unavailable on the server.';
    throw err;
  }

  let parser;
  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || '';
  } catch (e) {
    const msg = String(e && e.message);
    const err = new Error(msg);
    err.statusCode = 422;
    if (/password|encrypted/i.test(msg)) {
      err.userMessage = 'This PDF is password-protected. Remove the password and upload again.';
    } else if (/invalid pdf|corrupt|structure/i.test(msg)) {
      err.userMessage = 'This file is not a readable PDF. It may be corrupted — try re-exporting it.';
    } else {
      err.userMessage = 'Could not read text from this PDF. If it is a scan or photo, export a text-based PDF and retry.';
    }
    // Keep the real cause in the logs; the user gets the friendly line above.
    console.error('PDF text extraction failed:', msg);
    throw err;
  } finally {
    if (parser) {
      try { await parser.destroy(); } catch { /* already torn down */ }
    }
  }
}

let _gemini;
function getGemini() {
  if (_gemini !== undefined) return _gemini;
  _gemini = null;
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    if (process.env.GEMINI_API_KEY) {
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      _gemini = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
  } catch (e) {
    _gemini = null;
  }
  return _gemini;
}

// ── Extraction helpers ──

/**
 * PDF text extraction leaves artifacts that break both the regexes below and
 * the LLM prompt: ligatures, non-breaking spaces, CR, bullet glyphs, repeated
 * "Page 1 of 3" furniture, and long runs of blank lines. Clean once, up front.
 */
function normalizeResumeText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    // Ligatures that PDFs emit as single codepoints.
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl')
    .replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl')
    // Non-breaking / zero-width spaces → ordinary space.
    .replace(/[   ]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    // Typographic dashes/quotes → ASCII, so regexes and JSON stay predictable.
    .replace(/[‐-―]/g, '-')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    // Bullet glyphs start a list item; keep the break, drop the glyph.
    .replace(/[•●▪■◦‣·]/g, ' ')
    // Page furniture on its own line.
    .replace(/^\s*page\s+\d+(\s*(of|\/)\s*\d+)?\s*$/gim, '')
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}
function extractPhone(text) {
  const m = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  return m ? m[0].trim() : '';
}
// The first non-empty line is usually the name, but resumes often lead with
// "CURRICULUM VITAE", a contact line, or the email itself. Walk the first few
// lines and take the first that looks like a person's name.
function extractName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 8);
  const looksLikeHeading = /^(resume|curriculum\s+vitae|cv|profile|personal\s+details)\b/i;
  for (const line of lines) {
    if (looksLikeHeading.test(line)) continue;
    if (/[@\d]|https?:|www\./.test(line)) continue;          // contact lines
    const words = line.split(/\s+/);
    if (words.length < 1 || words.length > 5) continue;
    if (line.length > 60) continue;
    // Names are letters, spaces, hyphens, apostrophes, periods — nothing else.
    if (!/^[\p{L}][\p{L}\s.'-]*$/u.test(line)) continue;
    return line.replace(/\s+/g, ' ');
  }
  return '';
}
// Known resume section headings, mapped to a canonical key. A heading line is
// short, starts with one of these words, and carries no sentence punctuation.
const SECTION_PATTERNS = [
  ['skills', /^(technical\s+)?(skills?|technologies|tech\s+stack|core\s+competenc(?:y|ies))\b/i],
  ['education', /^(education|academics?|academic\s+(background|qualifications?)|qualifications?)\b/i],
  ['experience', /^((work|professional|employment)\s+)?(experience|history)\b/i],
  ['projects', /^(projects?|personal\s+projects?)\b/i],
  ['certifications', /^(certifications?|licenses?|courses?)\b/i],
  ['summary', /^(summary|objective|profile|about\s*(me)?)\b/i],
];

/**
 * Split the resume into { sectionKey: linesArray }. One pass, so every
 * extractor below agrees on where each section starts and ends — the old
 * per-field regexes each guessed differently and disagreed on boundaries.
 */
function splitSections(text) {
  const sections = {};
  let current = null;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    let matched = null;
    if (line.length <= 40 && !/[.!?]$/.test(line)) {
      for (const [key, re] of SECTION_PATTERNS) {
        if (re.test(line.replace(/[:\-–]\s*$/, ''))) { matched = key; break; }
      }
    }
    if (matched) {
      current = matched;
      if (!sections[current]) sections[current] = [];
      // A heading can carry inline content: "Skills: React, Node"
      const inline = line.replace(/^[^:]*:\s*/, '');
      if (inline && inline !== line) sections[current].push(inline);
      continue;
    }
    if (current) sections[current].push(line);
  }
  return sections;
}

function extractSkills(sections) {
  const lines = sections.skills || [];
  if (!lines.length) return '';
  return lines
    .join(', ')
    .split(/[,|/]|\s{2,}/)
    .map(s => s.replace(/^[\s\-–:]+|[\s\-–:]+$/g, '').trim())
    .filter(s => s.length > 1 && s.length < 40)
    .filter((s, i, arr) => arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i)
    .join(', ');
}

function extractEducation(sections) {
  const lines = (sections.education || []).filter(l => l.length > 2);
  if (!lines.length) return { college: '', degree: '', graduationYear: '' };
  const degreeRe = /\b(b\.?tech|b\.?e\.?|b\.?sc|b\.?a\.?|bachelor|m\.?tech|m\.?sc|m\.?a\.?|master|mba|ph\.?d|diploma|12th|10th|intermediate|high\s*school)\b/i;
  const collegeRe = /\b(university|college|institute|school|academy|iit|nit|iiit)\b/i;
  const degree = lines.find(l => degreeRe.test(l)) || '';
  const college = lines.find(l => collegeRe.test(l)) || lines.find(l => l !== degree) || '';
  const yearMatch = lines.join(' ').match(/\b(19|20)\d{2}\b(?!.*\b(19|20)\d{2}\b)/);
  return { college, degree, graduationYear: yearMatch ? yearMatch[0] : '' };
}

function extractExperience(sections) {
  const lines = (sections.experience || []).filter(l => l.length > 2);
  if (!lines.length) return { currentRole: '', currentCompany: '', details: '' };
  // Common layouts: "Role — Company", "Role at Company", or Role / Company on
  // consecutive lines. Try the single-line forms before falling back.
  const first = lines[0];
  const split = first.match(/^(.{2,60}?)\s*(?:[—–-]|\bat\b|,)\s*(.{2,60})$/i);
  let currentRole = first;
  let currentCompany = lines[1] || '';
  if (split) {
    currentRole = split[1].trim();
    currentCompany = split[2].trim();
  }
  // Strip trailing date ranges that ride along on the same line.
  const stripDates = (s) => s.replace(/\s*[\(\[]?\s*((19|20)\d{2}|present|current)[^)\]]*[\)\]]?\s*$/i, '').trim();
  return {
    currentRole: stripDates(currentRole),
    currentCompany: stripDates(currentCompany),
    details: lines.slice(0, 5).join(' | '),
  };
}
function extractLinkedIn(text) {
  const m = text.match(/linkedin\.com\/in\/[a-zA-Z0-9_%-]+/i);
  return m ? 'https://' + m[0].replace(/^www\./i, '') : '';
}

// Resumes write these bare ("github.com/me"), labelled ("GitHub: https://…"),
// or as a plain URL — the old single regex only matched the labelled form.
function extractPortfolio(text) {
  const github = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_.-]+/i);
  if (github) return 'https://' + github[0].replace(/^https?:\/\//i, '').replace(/^www\./i, '');

  const labelled = text.match(/(?:portfolio|website|site)\s*[:\-]?\s*((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)/i);
  if (labelled) {
    const url = labelled[1];
    return /^https?:\/\//i.test(url) ? url : 'https://' + url;
  }
  return '';
}

function extractStructuredData(rawText) {
  const sections = splitSections(rawText);
  const name = extractName(rawText);
  const nameParts = name.split(' ').filter(Boolean);
  const edu = extractEducation(sections);
  const exp = extractExperience(sections);
  const summary = (sections.summary || []).join(' ').trim();
  return {
    personalInfo: {
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email: extractEmail(rawText),
      phone: extractPhone(rawText),
      location: '',
    },
    academicInfo: { college: edu.college, degree: edu.degree, graduationYear: edu.graduationYear, cgpa: '' },
    professionalInfo: {
      skills: extractSkills(sections),
      yearsOfExperience: '',
      currentRole: exp.currentRole,
      currentCompany: exp.currentCompany,
      linkedIn: extractLinkedIn(rawText),
      portfolio: extractPortfolio(rawText),
    },
    // Only a real summary/objective section counts as a bio. The old code fell
    // back to the first five lines of the experience section joined with " | ",
    // which pasted raw internship bullets into the profile and read as if the
    // AI had written it. With no summary section, leave it empty and let the
    // AI pass fill it — an empty field is honest, a pasted one is not.
    bio: summary,
    rawText,
  };
}

/**
 * Ask Gemini to read the resume text and return clean structured JSON.
 * Returns null on any failure so the caller can fall back to the regex result.
 */
async function aiExtractStructuredData(rawText) {
  const geminiModel = getGemini();
  if (!geminiModel) return null;

  const prompt = `You are reading a candidate's resume. Extract their details, and write a summary of them.
Return ONLY a JSON object with EXACTLY this shape (use "" for anything not found, never invent data):
{
  "personalInfo": { "firstName": "", "lastName": "", "email": "", "phone": "", "location": "" },
  "academicInfo": { "college": "", "degree": "", "graduationYear": "", "cgpa": "" },
  "professionalInfo": { "skills": "", "yearsOfExperience": "", "currentCompany": "", "currentRole": "", "linkedIn": "", "portfolio": "" },
  "bio": ""
}

Rules for the extracted fields:
- "skills" = comma-separated list of technologies and abilities, most relevant first.
- "yearsOfExperience" = a number as a string ("2"), counting internships as experience. "" if it cannot be worked out.
- Copy emails, phones and URLs exactly as written.

Rules for "bio" — this is the important one:
- Read the WHOLE resume first, then write 2-3 sentences describing this person as a
  whole: what they do, the strongest evidence of it, and what they are moving toward.
- SYNTHESISE. Do NOT copy, quote or lightly reword any line, bullet or job description
  from the resume. If a sentence could be found by searching the resume text, rewrite it.
- Do not simply describe the most recent internship or job. That is one data point about
  them, not a summary of them. Weigh education, projects, skills and all roles together.
- Write in third person without the pronoun: "Final-year CS student who has shipped…",
  never "I am" and never starting with their name.
- Ground every claim in the resume. No adjectives you cannot point to evidence for
  ("passionate", "hard-working", "detail-oriented" are banned unless the resume proves it).
- Plain specific English. No buzzwords, no marketing voice.

Output strictly valid JSON, no markdown fences, no commentary.

RESUME TEXT:
${rawText.substring(0, 20000)}`;

  try {
    const result = await geminiModel.generateContent(prompt);
    let text = result.response.text().trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('AI resume extraction failed, using regex fallback:', err.message);
    return null;
  }
}

// Merge AI result over the regex baseline: AI wins where it has a value,
// otherwise we keep the regex value. Guarantees output is never worse than regex.
function mergeExtracted(base, ai) {
  if (!ai) return base;
  const pick = (section, key) => (ai[section]?.[key]?.trim?.() ? ai[section][key].trim() : base[section]?.[key] || '');
  return {
    personalInfo: {
      firstName: pick('personalInfo', 'firstName'),
      lastName: pick('personalInfo', 'lastName'),
      email: pick('personalInfo', 'email'),
      phone: pick('personalInfo', 'phone'),
      location: pick('personalInfo', 'location') || base.personalInfo?.location || '',
    },
    academicInfo: {
      college: pick('academicInfo', 'college'),
      degree: pick('academicInfo', 'degree'),
      graduationYear: pick('academicInfo', 'graduationYear'),
      cgpa: pick('academicInfo', 'cgpa'),
    },
    professionalInfo: {
      skills: pick('professionalInfo', 'skills'),
      yearsOfExperience: pick('professionalInfo', 'yearsOfExperience'),
      currentCompany: pick('professionalInfo', 'currentCompany'),
      currentRole: pick('professionalInfo', 'currentRole'),
      linkedIn: pick('professionalInfo', 'linkedIn'),
      portfolio: pick('professionalInfo', 'portfolio'),
    },
    bio: (ai.bio && ai.bio.trim()) ? ai.bio.trim() : base.bio || '',
    rawText: base.rawText,
  };
}

// ── Routes ──
router.post('/upload', authMiddleware, uploadResume, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    let rawText = '';
    try {
      rawText = await extractPdfText(req.file.buffer);
    } catch (parseErr) {
      // Fail honestly instead of substituting fake placeholder data.
      return res
        .status(parseErr.statusCode || 422)
        .json({ error: parseErr.userMessage || 'Could not read this PDF.' });
    }

    rawText = normalizeResumeText(rawText);

    if (!rawText.trim()) {
      return res.status(422).json({ error: 'No readable text found in this PDF (it may be a scanned image).' });
    }

    // Hybrid: fast regex baseline, then let Gemini refine/override.
    const baseline = extractStructuredData(rawText);
    const aiResult = await aiExtractStructuredData(rawText);
    const extracted = mergeExtracted(baseline, aiResult);

    await saveProfile(req.user.id, { parsedResumeText: rawText });

    res.json({
      message: 'Resume parsed successfully',
      extracted,
      source: aiResult ? 'ai+regex' : 'regex',
      rawPreview: rawText.substring(0, 500),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to parse resume: ' + error.message });
  }
});

router.post('/apply-to-profile', authMiddleware, async (req, res) => {
  try {
    const profile = await saveProfile(req.user.id, req.body);
    res.json({ message: 'Profile updated from resume data', profile });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save: ' + err.message });
  }
});

module.exports = router;
