const rateLimit = require('express-rate-limit');

// Brute-force protection for auth (login/register): 20 attempts per 15 min per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,   // expose limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Cost/abuse protection for expensive routes (AI + Gmail): 15 requests per minute per IP.
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit reached. Please wait a moment and try again.' },
});

module.exports = { authLimiter, aiLimiter };
