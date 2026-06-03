const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET is not set in .env — refusing to start with an insecure default.');
}

/**
 * JWT Auth Middleware
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      console.log('[AUTH] Decoded JWT:', JSON.stringify(decoded));
      req.user = { id: decoded.id, name: decoded.name };
      return next();
    } catch (err) {
      console.log('[AUTH] JWT verify failed:', err.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  // NOTE: the old "trust a plain `userid` header" fallback was removed — it let
  // anyone impersonate any user without a password or token. A valid Bearer JWT
  // is now required for every protected route.
  console.log('[AUTH] No valid Bearer token found');
  return res.status(401).json({ error: 'Authorization required' });
};

module.exports = authMiddleware;
