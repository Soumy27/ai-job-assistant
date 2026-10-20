const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Job Assistant API Backend is running');
});

// Which optional integrations are actually configured on THIS instance.
// Booleans only — never the values — so it is safe to call unauthenticated and
// answers "why does Gmail say it isn't configured?" without reading the logs.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    integrations: {
      database: !!process.env.DATABASE_URL,
      auth: !!process.env.JWT_SECRET,
      gemini: !!process.env.GEMINI_API_KEY,
      gmail: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
    },
    // Surfaces the classic deploy mistake: redirect URI still pointing at
    // localhost on a hosted instance, which makes Google reject the callback.
    gmailRedirectHost: process.env.GOOGLE_REDIRECT_URI
      ? (() => { try { return new URL(process.env.GOOGLE_REDIRECT_URI).host; } catch { return 'invalid-url'; } })()
      : null,
  });
});

// Rate limiters: brute-force protection on auth, cost/abuse protection on AI + Gmail.
const { authLimiter, aiLimiter } = require('./middleware/rateLimit');

// Mount Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/ai', aiLimiter, require('./routes/ai'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/gmail', aiLimiter, require('./routes/gmail'));

// Export the configured app so both the server (server.js) and the tests
// (test/api.test.js, via supertest) can use it without binding a port.
module.exports = app;
