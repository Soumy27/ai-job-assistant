// Password reset tests — hermetic: in-memory DB, no mail provider configured.
process.env.JWT_SECRET = 'test_secret_for_ci';
process.env.DATABASE_URL = '';
process.env.GEMINI_API_KEY = '';
delete process.env.RESEND_API_KEY; // force the "not configured" path

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const request = require('supertest');
const app = require('../app');
const { setResetToken, findUserByResetTokenHash } = require('../db');

const email = `reset_${Date.now()}@example.com`;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

test('setup: register a user', async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Reset Tester', email, password: 'abcd' });
  assert.strictEqual(res.status, 201);
});

test('forgot-password accepts a known address', async () => {
  const res = await request(app).post('/api/auth/forgot-password').send({ email });
  assert.strictEqual(res.status, 200);
  assert.match(res.body.message, /if an account exists/i);
});

// Account enumeration: the response must not differ for an unknown address.
test('forgot-password gives an identical answer for an unknown address', async () => {
  const known = await request(app).post('/api/auth/forgot-password').send({ email });
  const unknown = await request(app)
    .post('/api/auth/forgot-password')
    .send({ email: `nobody_${Date.now()}@example.com` });

  assert.strictEqual(known.status, unknown.status);
  assert.strictEqual(known.body.message, unknown.body.message);
});

test('forgot-password rejects a malformed address', async () => {
  const res = await request(app).post('/api/auth/forgot-password').send({ email: 'not-an-email' });
  assert.strictEqual(res.status, 400);
});

test('reset-password rejects an unknown token', async () => {
  const res = await request(app)
    .post('/api/auth/reset-password')
    .send({ token: crypto.randomBytes(32).toString('hex'), password: 'newpass' });
  assert.strictEqual(res.status, 400);
  assert.match(res.body.error, /invalid or has expired/i);
});

test('reset-password rejects an expired token', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  await setResetToken(email, hashToken(token), new Date(Date.now() - 1000)); // already past
  const found = await findUserByResetTokenHash(hashToken(token));
  assert.strictEqual(found, null, 'an expired token must not resolve to a user');

  const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'newpass' });
  assert.strictEqual(res.status, 400);
});

test('reset-password rejects a short password', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  await setResetToken(email, hashToken(token), new Date(Date.now() + 60000));
  const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'a' });
  assert.strictEqual(res.status, 400);
});

test('a valid token changes the password, and the old one stops working', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  await setResetToken(email, hashToken(token), new Date(Date.now() + 60000));

  const reset = await request(app).post('/api/auth/reset-password').send({ token, password: 'brandnew' });
  assert.strictEqual(reset.status, 200, JSON.stringify(reset.body));

  const oldPw = await request(app).post('/api/auth/login').send({ email, password: 'abcd' });
  assert.strictEqual(oldPw.status, 401, 'the old password must no longer work');

  const newPw = await request(app).post('/api/auth/login').send({ email, password: 'brandnew' });
  assert.strictEqual(newPw.status, 200);
  assert.ok(newPw.body.token);
});

// A reset link must not be replayable.
test('the same token cannot be used twice', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  await setResetToken(email, hashToken(token), new Date(Date.now() + 60000));

  const first = await request(app).post('/api/auth/reset-password').send({ token, password: 'secondpw' });
  assert.strictEqual(first.status, 200);

  const second = await request(app).post('/api/auth/reset-password').send({ token, password: 'thirdpw' });
  assert.strictEqual(second.status, 400, 'a used token must be rejected');

  // And the password from the replay attempt must not have taken effect.
  const login = await request(app).post('/api/auth/login').send({ email, password: 'thirdpw' });
  assert.strictEqual(login.status, 401);
});

test('the raw token is never stored — only its hash', async () => {
  const token = crypto.randomBytes(32).toString('hex');
  await setResetToken(email, hashToken(token), new Date(Date.now() + 60000));

  // Looking up by the raw token must find nothing; only the hash resolves.
  assert.strictEqual(await findUserByResetTokenHash(token), null);
  assert.ok(await findUserByResetTokenHash(hashToken(token)));
});
