const express = require('express');
const router = express.Router();
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const { getProfile, saveProfile } = require('../db');

const upload = multer({ storage: multer.memoryStorage() });

// pdf-parse and Gemini are lazy-loaded on first use so they never block server
// startup (these are the heavy modules that slow boot on low-memory machines).
let _PDFParse;
function getPDFParse() {
  if (_PDFParse !== undefined) return _PDFParse;
  _PDFParse = null;
  try {
    const pdfModule = require('pdf-parse');
    const fn = pdfModule.PDFParse || pdfModule;
    _PDFParse = typeof fn === 'function' ? fn : null;
  } catch (e) {
    _PDFParse = null;
  }
  return _PDFParse;
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
function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}
function extractPhone(text) {
  const m = text.match(/(\+?\d[\d\s\-().]{7,}\d)/);
  return m ? m[0].trim() : '';
}
function extractName(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  return lines.length > 0 && lines[0].length < 60 ? lines[0] : '';
}
function extractSkills(text) {
  const s = text.match(/skills[:\s\n]+([\s\S]*?)(?=\n(?:experience|education|projects|work|certifications)|$)/i);
  return s ? s[1].replace(/\n/g, ', ').replace(/[•●▪■\-|]/g, ',').replace(/,,+/g, ',').trim().replace(/^,|,$/g, '').trim() : '';
}
function extractEducation(text) {
  const s = text.match(/education[:\s\n]+([\s\S]*?)(?=\n(?:experience|skills|projects|work)|$)/i);
  if (!s) return { college: '', degree: '' };
  const lines = s[1].split('\n').map(l => l.trim()).filter(l => l.length > 2);
  return { college: lines[0] || '', degree: lines[1] || '' };
}
function extractExperience(text) {
  const s = text.match(/(?:experience|work\s*history)[:\s\n]+([\s\S]*?)(?=\n(?:education|skills|projects)|$)/i);
  if (!s) return { currentRole: '', currentCompany: '', details: '' };
  const lines = s[1].split('\n').map(l => l.trim()).filter(l => l.length > 2);
  return { currentRole: lines[0] || '', currentCompany: lines[1] || '', details: lines.slice(0, 5).join(' | ') };
}
function extractLinkedIn(text) {
  const m = text.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/i);
  return m ? 'https://' + m[0] : '';
}
function extractPortfolio(text) {
  const m = text.match(/(?:github\.com|portfolio|website)[:\s]*(https?:\/\/[^\s]+)/i);
  return m ? m[1] : '';
}

function extractStructuredData(rawText) {
  const name = extractName(rawText);
  const nameParts = name.split(' ');
  const edu = extractEducation(rawText);
  const exp = extractExperience(rawText);
  return {
    personalInfo: { firstName: nameParts[0] || '', lastName: nameParts.slice(1).join(' ') || '', email: extractEmail(rawText), phone: extractPhone(rawText) },
    academicInfo: { college: edu.college, degree: edu.degree },
    professionalInfo: { skills: extractSkills(rawText), currentRole: exp.currentRole, currentCompany: exp.currentCompany, linkedIn: extractLinkedIn(rawText), portfolio: extractPortfolio(rawText) },
    bio: exp.details || '',
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

  const prompt = `Extract structured data from the resume text below.
Return ONLY a JSON object with EXACTLY this shape (use "" for anything not found, never invent data):
{
  "personalInfo": { "firstName": "", "lastName": "", "email": "", "phone": "", "location": "" },
  "academicInfo": { "college": "", "degree": "", "graduationYear": "", "cgpa": "" },
  "professionalInfo": { "skills": "", "yearsOfExperience": "", "currentCompany": "", "currentRole": "", "linkedIn": "", "portfolio": "" },
  "bio": ""
}
Rules:
- "skills" = comma-separated list. "bio" = a 1-2 sentence professional summary.
- Output strictly valid JSON, no markdown fences, no commentary.

RESUME TEXT:
${rawText.substring(0, 6000)}`;

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
router.post('/upload', authMiddleware, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const PDFParse = getPDFParse();
    if (!PDFParse) {
      return res.status(503).json({ error: 'Resume parsing is unavailable on the server (pdf-parse failed to load).' });
    }

    let rawText = '';
    try {
      const parsed = await PDFParse(req.file.buffer);
      rawText = parsed.text || '';
    } catch (parseErr) {
      // Fail honestly instead of substituting fake placeholder data.
      return res.status(422).json({ error: 'Could not read text from this PDF. It may be a scanned image or corrupted. Try a text-based PDF.' });
    }

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
