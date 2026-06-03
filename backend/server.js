require('dotenv').config();
const app = require('./app');
const { initSchema } = require('./db');

const PORT = process.env.PORT || 5005;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server started on port ${PORT}`);
  try {
    await initSchema();
    console.log('Database ready');
  } catch (err) {
    console.error('DB init error:', err.message);
  }
});
