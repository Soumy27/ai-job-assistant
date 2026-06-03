const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');
const { saveGoogleToken, getGoogleToken } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// Lazy-require google-auth-library only when needed, so it never blocks server
// startup. (We use the lightweight auth lib + Gmail's REST API via fetch instead
// of the giant `googleapis` meta-package.)
function oauthClient() {
  const { OAuth2Client } = require('google-auth-library');
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function gmailConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

// ── 1. Start the flow: return the Google consent URL ──
router.get('/auth-url', authMiddleware, (req, res) => {
  if (!gmailConfigured()) return res.status(503).json({ error: 'Gmail integration is not configured on the server.' });
  // Short-lived signed token carries the user id through to /callback (also CSRF guard).
  const state = jwt.sign({ id: req.user.id }, JWT_SECRET, { expiresIn: '10m' });
  const url = oauthClient().generateAuthUrl({
    access_type: 'offline',   // ask for a refresh token
    prompt: 'consent',        // force refresh_token to be returned every time
    scope: SCOPES,
    state,
  });
  res.json({ url });
});

// ── 2. Google redirects the browser here after consent ──
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) return res.status(400).send('Missing code or state');

  let userId;
  try {
    userId = jwt.verify(state, JWT_SECRET).id;   // recover which user this is
  } catch {
    return res.status(401).send('Invalid or expired state');
  }

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(code);   // exchange code → tokens
    if (tokens.refresh_token) {
      await saveGoogleToken(userId, tokens.refresh_token);
    }
    return res.redirect(`${FRONTEND_URL}/?gmail=connected`);
  } catch (err) {
    console.error('Gmail callback error:', err.message);
    return res.redirect(`${FRONTEND_URL}/?gmail=error`);
  }
});

// Small helper around Gmail's REST API.
async function gmailGet(path, accessToken) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ── 3. Scan the inbox for job-related emails ──
router.post('/scan', authMiddleware, async (req, res) => {
  try {
    const refreshToken = await getGoogleToken(req.user.id);
    if (!refreshToken) return res.status(400).json({ error: 'Gmail not connected', connected: false });

    const client = oauthClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { token: accessToken } = await client.getAccessToken();   // refresh → fresh access token
    if (!accessToken) return res.status(401).json({ error: 'Could not obtain Gmail access token', connected: false });

    // Gmail search syntax: job-related keywords, last 30 days.
    const q = '(application OR interview OR "thank you for applying" OR offer OR "we regret") newer_than:30d';
    const list = await gmailGet(`messages?q=${encodeURIComponent(q)}&maxResults=10`, accessToken);
    const messages = list.messages || [];

    const opportunities = [];
    for (const m of messages) {
      // 'metadata' format = headers + snippet only (fast; we never read full bodies).
      const msg = await gmailGet(`messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`, accessToken);
      const headers = msg.payload?.headers || [];
      const subject = headers.find(h => h.name === 'Subject')?.value || '';
      const from = headers.find(h => h.name === 'From')?.value || '';
      const snippet = msg.snippet || '';
      opportunities.push({ id: m.id, subject, from, snippet, classification: classify(subject, snippet) });
    }

    res.json({ message: 'Gmail scan completed', connected: true, count: opportunities.length, opportunities });
  } catch (err) {
    console.error('Gmail scan error:', err.message);
    res.status(500).json({ error: 'Failed to scan Gmail: ' + err.message });
  }
});

// Fast keyword classifier for email type (instant, no API cost).
// Checked most-specific → least: interview/rejection/offer/confirmation first,
// then generic job alerts/newsletters, then a catch-all.
function classify(subject, snippet) {
  const t = (subject + ' ' + snippet).toLowerCase();
  if (/interview|schedule (a )?call|availability|book a time|technical screen|next round|assessment/.test(t)) return 'Interview Invite';
  if (/unfortunately|we regret|not moving forward|other candidates|won.?t be proceeding|decided not to|not selected/.test(t)) return 'Rejection';
  if (/pleased to offer|offer letter|extend(ing)? an offer|job offer|congratulations[^.]*offer/.test(t)) return 'Offer';
  if (/application (received|confirmation|submitted)|successfully submitted|submitted successfully|thank(s| you) for applying|we (have )?received your application|has been submitted/.test(t)) return 'Application Received';
  if (/hiring|apply now|opportunit|jobs? matching|stipend|hackathon|internships? (near|around)|we'?re hiring|new jobs/.test(t)) return 'Job Alert';
  return 'Job-related';
}

module.exports = router;
