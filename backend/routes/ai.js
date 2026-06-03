const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getProfile } = require('../db');

// ── Google Gemini LLM (lazy — loaded on first use so it never blocks startup) ──
let _gemini; // undefined = not initialized yet
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
    console.log('⚠️  Gemini SDK not available:', e.message);
  }
  return _gemini;
}

// ── Field Mapping Rules ──
const FIELD_RULES = [
  { patterns: ['first_name', 'firstname', 'first name', 'given_name', 'fname'], getValue: p => p.personalInfo?.firstName },
  { patterns: ['last_name', 'lastname', 'last name', 'family_name', 'surname', 'lname'], getValue: p => p.personalInfo?.lastName },
  { patterns: ['full_name', 'fullname', 'full name', 'your name', 'candidate_name', 'applicant_name'], getValue: p => [p.personalInfo?.firstName, p.personalInfo?.lastName].filter(Boolean).join(' ') },
  { patterns: ['email', 'e-mail', 'email_address', 'emailaddress'], getValue: p => p.personalInfo?.email },
  { patterns: ['phone', 'tel', 'telephone', 'mobile', 'phone_number', 'cell', 'contact_number'], getValue: p => p.personalInfo?.phone },
  { patterns: ['location', 'city', 'address', 'current_location', 'current_city'], getValue: p => p.personalInfo?.location },
  { patterns: ['country'], getValue: p => p.personalInfo?.country || '' },
  { patterns: ['state', 'province', 'region'], getValue: p => p.personalInfo?.state || '' },
  { patterns: ['zip', 'zipcode', 'postal', 'pincode'], getValue: p => p.personalInfo?.zip || '' },
  { patterns: ['college', 'university', 'school', 'institution'], getValue: p => p.academicInfo?.college },
  { patterns: ['degree', 'qualification', 'program', 'course', 'major'], getValue: p => p.academicInfo?.degree },
  { patterns: ['board', 'affiliated'], getValue: p => p.academicInfo?.board },
  { patterns: ['graduation', 'grad_year', 'graduation_year', 'passing_year', 'batch'], getValue: p => p.academicInfo?.graduationYear },
  { patterns: ['cgpa', 'gpa', 'percentage', 'grade', 'marks', 'score'], getValue: p => p.academicInfo?.cgpa },
  { patterns: ['skill', 'skills', 'technical_skills', 'key_skills', 'technologies'], getValue: p => p.professionalInfo?.skills },
  { patterns: ['experience', 'years_of_experience', 'total_experience', 'yoe'], getValue: p => p.professionalInfo?.yearsOfExperience },
  { patterns: ['current_company', 'company', 'employer', 'organization'], getValue: p => p.professionalInfo?.currentCompany },
  { patterns: ['current_role', 'role', 'job_title', 'designation', 'position', 'title'], getValue: p => p.professionalInfo?.currentRole },
  { patterns: ['linkedin', 'linkedin_url', 'linked_in'], getValue: p => p.professionalInfo?.linkedIn },
  { patterns: ['portfolio', 'website', 'github', 'personal_site'], getValue: p => p.professionalInfo?.portfolio },
  { patterns: ['bio', 'about', 'summary', 'cover_letter', 'introduction', 'about_yourself', 'tell_us'], getValue: p => p.bio },
  { patterns: ['name'], getValue: p => [p.personalInfo?.firstName, p.personalInfo?.lastName].filter(Boolean).join(' ') },
];

function matchField(fieldId, label, placeholder, profile) {
  const searchStr = [fieldId, label, placeholder].filter(Boolean).join(' ').toLowerCase().replace(/[^a-z0-9_ ]/g, '');
  for (const rule of FIELD_RULES) {
    for (const pattern of rule.patterns) {
      if (searchStr.includes(pattern.replace(/_/g, ' ')) || searchStr.includes(pattern)) {
        const value = rule.getValue(profile);
        if (value) return value;
      }
    }
  }
  return null;
}

/**
 * Pass 2: ask Gemini to map the fields the keyword rules COULDN'T fill.
 * Returns an object { fieldKey: value } for the leftovers it understood.
 * This is the real "natural language understanding" — it handles labels like
 * "What should we call you?" that no keyword list anticipates.
 *
 * @param {Array<{key:string,label:string,placeholder:string}>} unmatched
 * @param {object} profile  the user's saved profile
 */
async function aiMatchFields(unmatched, profile) {
  const geminiModel = getGemini();
  if (!geminiModel || unmatched.length === 0) return {};

  // Flatten the profile into a compact, readable block for the model.
  const p = profile.personalInfo || {};
  const a = profile.academicInfo || {};
  const pr = profile.professionalInfo || {};
  const profileBlock = JSON.stringify({
    firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone,
    location: p.location, country: p.country, state: p.state, zip: p.zip,
    college: a.college, degree: a.degree, graduationYear: a.graduationYear, cgpa: a.cgpa,
    skills: pr.skills, yearsOfExperience: pr.yearsOfExperience,
    currentCompany: pr.currentCompany, currentRole: pr.currentRole,
    linkedIn: pr.linkedIn, portfolio: pr.portfolio, bio: profile.bio,
  });

  const prompt = `You map job-application form fields to a user's profile data.

USER PROFILE (JSON):
${profileBlock}

FORM FIELDS that still need values (JSON array; each has a "key", and a human "label"/"placeholder"):
${JSON.stringify(unmatched)}

Return ONLY a JSON object mapping each field "key" to the best value from the profile.
Rules:
- Use the field's label/placeholder to understand its MEANING, not just its name.
- If no profile data fits a field, OMIT that key entirely (do not invent data).
- Values must come from the profile verbatim; never fabricate.
- Output strictly valid JSON, no markdown fences, no commentary.`;

  try {
    const result = await geminiModel.generateContent(prompt);
    let text = result.response.text().trim();
    // Models sometimes wrap JSON in ```json fences — strip them defensively.
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(text);
    // Keep only string values for keys we actually asked about.
    const allowed = new Set(unmatched.map(u => u.key));
    const clean = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (allowed.has(k) && typeof v === 'string' && v.trim()) clean[k] = v.trim();
    }
    return clean;
  } catch (err) {
    console.error('AI field-match fallback failed:', err.message);
    return {}; // never break the request just because the AI pass failed
  }
}

// ── Match Fields Route ──
router.post('/match-fields', authMiddleware, async (req, res) => {
  try {
    const { fields, fieldDetails } = req.body;
    const profile = await getProfile(req.user.id) || { personalInfo: {}, academicInfo: {}, professionalInfo: {}, bio: '' };

    // Normalize the two possible input shapes into one list of {key,label,placeholder}.
    let fieldList = [];
    if (fieldDetails && Array.isArray(fieldDetails)) {
      fieldList = fieldDetails
        .map(fd => ({ key: fd.name || fd.id, label: fd.label || '', placeholder: fd.placeholder || '' }))
        .filter(f => f.key);
    } else if (fields && Array.isArray(fields)) {
      fieldList = fields.filter(Boolean).map(f => ({ key: f, label: '', placeholder: '' }));
    }

    const matchedData = {};
    const matchReport = {};

    // ── Pass 1: instant, free keyword rules ──
    fieldList.forEach(f => {
      const value = matchField(f.key, f.label, f.placeholder, profile);
      if (value) {
        matchedData[f.key] = value;
        matchReport[f.key] = 'matched';
      } else {
        matchedData[f.key] = null;
        matchReport[f.key] = 'unmatched';
      }
    });

    // ── Pass 2: send only the leftovers to Gemini (real NLU) ──
    const leftovers = fieldList.filter(f => !matchedData[f.key]);
    if (leftovers.length > 0) {
      const aiMatches = await aiMatchFields(leftovers, profile);
      for (const [key, value] of Object.entries(aiMatches)) {
        matchedData[key] = value;
        matchReport[key] = 'matched-ai'; // distinguish AI-filled from rule-filled
      }
    }

    const total = Object.keys(matchedData).length;
    const filled = Object.values(matchedData).filter(v => v).length;

    res.json({ matchedData, matchReport, stats: { total, filled, accuracy: total > 0 ? Math.round((filled / total) * 100) : 0 } });
  } catch (error) {
    res.status(500).json({ error: 'Field matching failed: ' + error.message });
  }
});

// ── Generate Answer Route (with real LLM) ──
router.post('/generate-answer', authMiddleware, async (req, res) => {
  try {
    const { question, jobTitle, company } = req.body;
    const profile = await getProfile(req.user.id) || {};

    const name = [profile.personalInfo?.firstName, profile.personalInfo?.lastName].filter(Boolean).join(' ') || 'the candidate';
    const skills = profile.professionalInfo?.skills || 'various technical skills';
    const exp = profile.professionalInfo?.yearsOfExperience || 'several';
    const role = profile.professionalInfo?.currentRole || '';
    const bio = profile.bio || '';
    const resumeText = profile.parsedResumeText || '';

    // Use real LLM if available
    const geminiModel = getGemini();
    if (geminiModel) {
      const prompt = `You are an AI assistant helping a job applicant write a professional, concise answer for a job application form.

APPLICANT PROFILE:
- Name: ${name}
- Skills: ${skills}
- Experience: ${exp} years
- Current Role: ${role}
- Bio: ${bio}
${resumeText ? `- Resume excerpt: ${resumeText.substring(0, 500)}` : ''}

JOB CONTEXT:
- Position: ${jobTitle || 'Not specified'}
- Company: ${company || 'Not specified'}

QUESTION: "${question}"

Instructions:
- Write a professional, first-person answer (150-250 words max)
- Be specific using the applicant's actual skills and experience
- Sound natural and confident, not generic
- Do NOT include any explanation or meta-commentary, just the answer itself`;

      try {
        const result = await geminiModel.generateContent(prompt);
        const answer = result.response.text();
        return res.json({ answer, source: 'gemini' });
      } catch (llmErr) {
        console.error('Gemini error:', llmErr.message);
        // Fall through to template response
      }
    }

    // Fallback: template-based response
    const answer = `As ${name}, with ${exp} years of experience and expertise in ${skills}, I am excited about the ${jobTitle || 'open'} position at ${company || 'your company'}. ${bio || 'I bring strong technical and problem-solving abilities honed through professional experience.'} I look forward to contributing to the team's success.`;
    res.json({ answer, source: 'template' });
  } catch (error) {
    res.status(500).json({ error: 'Generation failed: ' + error.message });
  }
});

module.exports = router;
