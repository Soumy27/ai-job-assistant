const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const validate = require('../middleware/validate');
const crypto = require('crypto');
const {
  createUser, findUserByEmail,
  setResetToken, findUserByResetTokenHash, updatePasswordAndClearReset,
} = require('../db');
const { send, mailConfigured, passwordResetEmail } = require('../mailer');

// Request shapes — validated before the handlers run.
const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});
const loginSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});
const forgotSchema = z.object({
  email: z.string().trim().email('A valid email is required'),
});
const resetSchema = z.object({
  token: z.string().min(16, 'Invalid reset link'),
  password: z.string().min(4, 'Password must be at least 4 characters'),
});

// Fail loudly at startup if the signing secret is missing — never sign tokens
// with a guessable fallback (anyone who read the source could forge a login).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not set in .env — refusing to start with an insecure default.');
}

// Register
router.post('/register', validate(registerSchema), async (req, res) => {
  const { email, password, name } = req.body;
  try {
    const existing = await findUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const userId = 'user-' + Date.now();
    // Store a one-way hash, never the raw password. 10 = bcrypt cost factor.
    const passwordHash = await bcrypt.hash(password, 10);
    await createUser(userId, name, email, passwordHash);

    res.status(201).json({ message: 'Account created! Please sign in.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed: ' + err.message });
  }
});

// Login
router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Account not found. Please sign up first.' });
    // Compare the typed password against the stored hash (constant-time inside bcrypt).
    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) return res.status(401).json({ error: 'Incorrect password' });

    // Include name in the token so middleware can read req.user.name later.
    const token = jwt.sign({ id: user.userId, email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, userid: user.userId, name: user.name });
  } catch (err) {
    res.status(500).json({ error: 'Login failed: ' + err.message });
  }
});

// Verify token
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ valid: false });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// ── Password reset ──
// The emailed token is random and single-use; only its SHA-256 hash is stored.
const RESET_TTL_MS = 60 * 60 * 1000; // 60 minutes
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

// Step 1: ask for a link.
router.post('/forgot-password', validate(forgotSchema), async (req, res) => {
  const { email } = req.body;

  // Always answer the same way, whether or not the address exists — otherwise
  // this endpoint becomes a way to discover who has an account here.
  const generic = {
    message: 'If an account exists for that email, a reset link is on its way.',
  };

  try {
    const user = await findUserByEmail(email);
    if (!user) return res.json(generic);

    const token = crypto.randomBytes(32).toString('hex');
    await setResetToken(email, hashToken(token), new Date(Date.now() + RESET_TTL_MS));

    const base = process.env.FRONTEND_URL || 'http://localhost:5173';
    const link = `${base}/reset-password?token=${token}`;
    const { subject, text, html } = passwordResetEmail(user.name, link);
    const result = await send({ to: email, subject, text, html });

    // With no mail provider configured the link is in the server log. Say so
    // in the response only on a local server, never from a deployed one.
    if (!result.sent && !mailConfigured() && process.env.NODE_ENV !== 'production') {
      return res.json({ ...generic, devNote: 'Email is not configured — the reset link was written to the server log.' });
    }
    return res.json(generic);
  } catch (err) {
    console.error('forgot-password error:', err.message);
    return res.json(generic);
  }
});

// Step 2: set the new password.
router.post('/reset-password', validate(resetSchema), async (req, res) => {
  const { token, password } = req.body;
  try {
    const user = await findUserByResetTokenHash(hashToken(token));
    if (!user) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Request a new one.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    await updatePasswordAndClearReset(user.email, hashed);
    return res.json({ message: 'Password updated. You can sign in now.' });
  } catch (err) {
    console.error('reset-password error:', err.message);
    return res.status(500).json({ error: 'Could not reset the password. Try again.' });
  }
});

module.exports = router;
