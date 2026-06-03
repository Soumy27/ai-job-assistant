const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const validate = require('../middleware/validate');
const { createUser, findUserByEmail } = require('../db');

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

module.exports = router;
