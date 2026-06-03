const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('AI Job Assistant API Backend is running');
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
