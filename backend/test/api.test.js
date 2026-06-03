// Hermetic API tests — no network, no real data.
// Set env BEFORE requiring the app so dotenv (which never overrides existing
// vars) leaves these in place: empty DATABASE_URL forces the in-memory mock DB.
process.env.JWT_SECRET = 'test_secret_for_ci';
process.env.DATABASE_URL = '';
process.env.GEMINI_API_KEY = '';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');

const email = `test_${Date.now()}@example.com`;
let token;

test('GET / responds with health message', async () => {
  const res = await request(app).get('/');
  assert.strictEqual(res.status, 200);
  assert.match(res.text, /running/i);
});

test('register rejects invalid input (bad email, short password, no name)', async () => {
  const res = await request(app).post('/api/auth/register').send({ email: 'nope', password: '12' });
  assert.strictEqual(res.status, 400);
});

test('register succeeds with valid input', async () => {
  const res = await request(app).post('/api/auth/register').send({ name: 'Test', email, password: 'abcd' });
  assert.strictEqual(res.status, 201);
});

test('login succeeds and returns a token', async () => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'abcd' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.token, 'expected a JWT token');
  token = res.body.token;
});

test('login rejects a wrong password', async () => {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass' });
  assert.strictEqual(res.status, 401);
});

test('protected route returns 401 without a token', async () => {
  const res = await request(app).get('/api/applications');
  assert.strictEqual(res.status, 401);
});

test('create and list an application', async () => {
  const created = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({ company: 'OpenAI', role: 'SWE Intern' });
  assert.strictEqual(created.status, 201);
  assert.strictEqual(created.body.application.company, 'OpenAI');

  const list = await request(app).get('/api/applications').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(list.status, 200);
  assert.ok(list.body.applications.length >= 1);
});

test('create application rejects a missing required field', async () => {
  const res = await request(app)
    .post('/api/applications')
    .set('Authorization', `Bearer ${token}`)
    .send({ company: 'NoRoleCo' });
  assert.strictEqual(res.status, 400);
});

test('updating to an invalid status is rejected', async () => {
  const res = await request(app)
    .patch('/api/applications/1')
    .set('Authorization', `Bearer ${token}`)
    .send({ status: 'Banana' });
  assert.strictEqual(res.status, 400);
});
