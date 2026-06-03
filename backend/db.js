let sql = null;

function getDB() {
  if (!sql && process.env.DATABASE_URL) {
    // Lazy-require the driver only when the DB is first used (keeps server
    // startup fast — the module isn't loaded during the require chain).
    const { neon } = require('@neondatabase/serverless');
    sql = neon(process.env.DATABASE_URL);
    console.log('✅ Neon PostgreSQL connected');
  }
  return sql;
}

// ── Schema initialization ──
async function initSchema() {
  const db = getDB();
  if (!db) {
    console.log('⚠️  No DATABASE_URL — using in-memory mockDB');
    return false;
  }

  try {
    await db`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS profiles (
        id SERIAL PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        email TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        location TEXT DEFAULT '',
        country TEXT DEFAULT '',
        state TEXT DEFAULT '',
        zip TEXT DEFAULT '',
        college TEXT DEFAULT '',
        degree TEXT DEFAULT '',
        board TEXT DEFAULT '',
        graduation_year TEXT DEFAULT '',
        cgpa TEXT DEFAULT '',
        skills TEXT DEFAULT '',
        years_of_experience TEXT DEFAULT '',
        job_company TEXT DEFAULT '',
        job_role TEXT DEFAULT '',
        linkedin TEXT DEFAULT '',
        portfolio TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        parsed_resume_text TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    await db`
      CREATE TABLE IF NOT EXISTS applications (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        company TEXT NOT NULL,
        role TEXT NOT NULL,
        status TEXT DEFAULT 'Applied',
        source TEXT DEFAULT 'Manual',
        job_url TEXT DEFAULT '',
        deadline DATE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `;

    // Migration: add Gmail refresh-token storage to existing users tables.
    await db`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT`;

    console.log('✅ Neon tables ready');
    return true;
  } catch (err) {
    console.error('❌ Schema init failed:', err.message);
    return false;
  }
}

// ── User operations ──
async function createUser(userId, name, email, password) {
  const db = getDB();
  if (!db) {
    if (!global.mockDB) global.mockDB = {};
    if (!global.mockUsers) global.mockUsers = {};
    if (global.mockUsers[email]) throw new Error('Email already registered');
    global.mockUsers[email] = { userId, name, email, password };
    global.mockDB[userId] = { personalInfo: { firstName: name.split(' ')[0], lastName: name.split(' ').slice(1).join(' ') }, academicInfo: {}, professionalInfo: {}, bio: '' };
    return { userId, name, email };
  }
  const result = await db`INSERT INTO users (user_id, name, email, password) VALUES (${userId}, ${name}, ${email}, ${password}) RETURNING user_id, name, email`;
  // Also create empty profile
  try {
    await db`INSERT INTO profiles (user_id, first_name, last_name) VALUES (${userId}, ${name.split(' ')[0]}, ${name.split(' ').slice(1).join(' ')}) ON CONFLICT (user_id) DO NOTHING`;
  } catch (profileErr) {
    console.error('Profile row creation failed:', profileErr.message);
  }
  return result[0];
}

async function findUserByEmail(email) {
  const db = getDB();
  if (!db) {
    if (!global.mockUsers) global.mockUsers = {};
    return global.mockUsers[email] || null;
  }
  const result = await db`SELECT user_id as "userId", name, email, password FROM users WHERE email = ${email}`;
  return result[0] || null;
}

// ── Profile operations ──
async function getProfile(userId) {
  const db = getDB();
  if (!db) {
    if (!global.mockDB) global.mockDB = {};
    return global.mockDB[userId] || null;
  }
  const rows = await db`SELECT * FROM profiles WHERE user_id = ${userId}`;
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    userId: r.user_id,
    personalInfo: { firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone, location: r.location },
    academicInfo: { college: r.college, degree: r.degree, board: r.board, graduationYear: r.graduation_year, cgpa: r.cgpa },
    professionalInfo: { skills: r.skills, yearsOfExperience: r.years_of_experience, currentCompany: r.job_company, currentRole: r.job_role, linkedIn: r.linkedin, portfolio: r.portfolio },
    bio: r.bio,
    parsedResumeText: r.parsed_resume_text,
  };
}

async function saveProfile(userId, data) {
  const db = getDB();
  if (!db) {
    if (!global.mockDB) global.mockDB = {};
    const existing = global.mockDB[userId] || {};
    const merge = (target, source) => {
      const result = { ...target };
      for (const [k, v] of Object.entries(source || {})) {
        if (v !== undefined && v !== null && v !== '') result[k] = v;
      }
      return result;
    };
    global.mockDB[userId] = {
      ...existing,
      userId,
      personalInfo: merge(existing.personalInfo || {}, data.personalInfo),
      academicInfo: merge(existing.academicInfo || {}, data.academicInfo),
      professionalInfo: merge(existing.professionalInfo || {}, data.professionalInfo),
      bio: data.bio !== undefined ? data.bio : (existing.bio || ''),
      parsedResumeText: data.parsedResumeText !== undefined ? data.parsedResumeText : (existing.parsedResumeText || ''),
    };
    return global.mockDB[userId];
  }

  const p = data.personalInfo || {};
  const a = data.academicInfo || {};
  const pr = data.professionalInfo || {};

  // Check if profile exists
  const existing = await db`SELECT id FROM profiles WHERE user_id = ${userId}`;

  if (existing.length > 0) {
    // UPDATE existing row
    await db`UPDATE profiles SET
      first_name = COALESCE(NULLIF(${p.firstName || ''}, ''), first_name),
      last_name = COALESCE(NULLIF(${p.lastName || ''}, ''), last_name),
      email = COALESCE(NULLIF(${p.email || ''}, ''), email),
      phone = COALESCE(NULLIF(${p.phone || ''}, ''), phone),
      location = COALESCE(NULLIF(${p.location || ''}, ''), location),
      college = COALESCE(NULLIF(${a.college || ''}, ''), college),
      degree = COALESCE(NULLIF(${a.degree || ''}, ''), degree),
      board = COALESCE(NULLIF(${a.board || ''}, ''), board),
      graduation_year = COALESCE(NULLIF(${a.graduationYear || ''}, ''), graduation_year),
      cgpa = COALESCE(NULLIF(${a.cgpa || ''}, ''), cgpa),
      skills = COALESCE(NULLIF(${pr.skills || ''}, ''), skills),
      years_of_experience = COALESCE(NULLIF(${pr.yearsOfExperience || ''}, ''), years_of_experience),
      job_company = COALESCE(NULLIF(${pr.currentCompany || ''}, ''), job_company),
      job_role = COALESCE(NULLIF(${pr.currentRole || ''}, ''), job_role),
      linkedin = COALESCE(NULLIF(${pr.linkedIn || ''}, ''), linkedin),
      portfolio = COALESCE(NULLIF(${pr.portfolio || ''}, ''), portfolio),
      bio = COALESCE(NULLIF(${data.bio || ''}, ''), bio),
      parsed_resume_text = COALESCE(NULLIF(${data.parsedResumeText || ''}, ''), parsed_resume_text),
      updated_at = NOW()
    WHERE user_id = ${userId}`;
  } else {
    // INSERT new row
    await db`INSERT INTO profiles (user_id, first_name, last_name, email, phone, location, college, degree, board, graduation_year, cgpa, skills, years_of_experience, job_company, job_role, linkedin, portfolio, bio, parsed_resume_text, updated_at)
    VALUES (${userId}, ${p.firstName || ''}, ${p.lastName || ''}, ${p.email || ''}, ${p.phone || ''}, ${p.location || ''}, ${a.college || ''}, ${a.degree || ''}, ${a.board || ''}, ${a.graduationYear || ''}, ${a.cgpa || ''}, ${pr.skills || ''}, ${pr.yearsOfExperience || ''}, ${pr.currentCompany || ''}, ${pr.currentRole || ''}, ${pr.linkedIn || ''}, ${pr.portfolio || ''}, ${data.bio || ''}, ${data.parsedResumeText || ''}, NOW())`;
  }

  return getProfile(userId);
}

// ── Application operations ──
function mapAppRow(r) {
  return {
    id: r.id,
    company: r.company,
    role: r.role,
    status: r.status,
    source: r.source,
    jobUrl: r.job_url,
    deadline: r.deadline,
    createdAt: r.created_at,
  };
}

async function getApplications(userId) {
  const db = getDB();
  if (!db) {
    if (!global.mockApps) global.mockApps = {};
    return (global.mockApps[userId] || []).slice().sort((a, b) => b.id - a.id);
  }
  const rows = await db`SELECT * FROM applications WHERE user_id = ${userId} ORDER BY created_at DESC`;
  return rows.map(mapAppRow);
}

async function createApplication(userId, data) {
  const { company, role, status = 'Applied', source = 'Manual', jobUrl = '', deadline = null } = data;
  const db = getDB();
  if (!db) {
    if (!global.mockApps) global.mockApps = {};
    if (!global.mockApps[userId]) global.mockApps[userId] = [];
    const app = { id: Date.now(), company, role, status, source, jobUrl, deadline, createdAt: new Date().toISOString() };
    global.mockApps[userId].push(app);
    return app;
  }
  const rows = await db`
    INSERT INTO applications (user_id, company, role, status, source, job_url, deadline)
    VALUES (${userId}, ${company}, ${role}, ${status}, ${source}, ${jobUrl}, ${deadline || null})
    RETURNING *`;
  return mapAppRow(rows[0]);
}

async function updateApplicationStatus(userId, id, status) {
  const db = getDB();
  if (!db) {
    const list = (global.mockApps && global.mockApps[userId]) || [];
    const app = list.find(a => String(a.id) === String(id));
    if (app) app.status = status;
    return app || null;
  }
  // user_id in the WHERE clause ensures users can only edit THEIR OWN rows.
  const rows = await db`
    UPDATE applications SET status = ${status}, updated_at = NOW()
    WHERE id = ${id} AND user_id = ${userId} RETURNING *`;
  return rows[0] ? mapAppRow(rows[0]) : null;
}

async function deleteApplication(userId, id) {
  const db = getDB();
  if (!db) {
    if (global.mockApps && global.mockApps[userId]) {
      global.mockApps[userId] = global.mockApps[userId].filter(a => String(a.id) !== String(id));
    }
    return true;
  }
  await db`DELETE FROM applications WHERE id = ${id} AND user_id = ${userId}`;
  return true;
}

// ── Gmail token operations ──
async function saveGoogleToken(userId, refreshToken) {
  const db = getDB();
  if (!db) {
    if (!global.mockGoogleTokens) global.mockGoogleTokens = {};
    global.mockGoogleTokens[userId] = refreshToken;
    return true;
  }
  await db`UPDATE users SET google_refresh_token = ${refreshToken} WHERE user_id = ${userId}`;
  return true;
}

async function getGoogleToken(userId) {
  const db = getDB();
  if (!db) {
    return (global.mockGoogleTokens && global.mockGoogleTokens[userId]) || null;
  }
  const rows = await db`SELECT google_refresh_token FROM users WHERE user_id = ${userId}`;
  return rows[0]?.google_refresh_token || null;
}

module.exports = {
  initSchema, createUser, findUserByEmail, getProfile, saveProfile,
  getApplications, createApplication, updateApplicationStatus, deleteApplication,
  saveGoogleToken, getGoogleToken,
};
