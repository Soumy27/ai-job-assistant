// Resume upload tests — hermetic: no network, no real DB, no Gemini.
// These exist because the upload route silently failed for every PDF: pdf-parse
// v2 exports a CLASS, the route called it as a function, and the resulting
// TypeError was caught and reported to users as "corrupted PDF".
process.env.JWT_SECRET = 'test_secret_for_ci';
process.env.DATABASE_URL = '';
process.env.GEMINI_API_KEY = ''; // force the regex path, so no API calls

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../app');

/**
 * Build a minimal but valid single-page PDF containing `line` as real text.
 * Offsets are computed rather than hard-coded so the xref table stays correct.
 */
function makePdf(lines) {
  const content = `BT /F1 12 Tf 72 720 Td 14 TL ${lines
    .map((l, i) => `${i === 0 ? '' : 'T* '}(${l.replace(/([()\\])/g, '\\$1')}) Tj`)
    .join(' ')} ET`;
  const objects = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
    `<</Length ${Buffer.byteLength(content)}>>\nstream\n${content}\nendstream`,
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const email = `resume_${Date.now()}@example.com`;
let token;

test('setup: register and log in', async () => {
  await request(app).post('/api/auth/register').send({ name: 'Resume Tester', email, password: 'abcd' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'abcd' });
  assert.strictEqual(res.status, 200);
  token = res.body.token;
  assert.ok(token);
});

test('upload requires authentication', async () => {
  const res = await request(app).post('/api/resume/upload');
  assert.strictEqual(res.status, 401);
});

test('upload with no file returns 400', async () => {
  const res = await request(app).post('/api/resume/upload').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 400);
});

test('upload rejects a non-PDF file', async () => {
  const res = await request(app)
    .post('/api/resume/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('resume', Buffer.from('just some text'), { filename: 'resume.txt', contentType: 'text/plain' });
  assert.strictEqual(res.status, 415);
});

test('upload rejects a file over the size limit', async () => {
  const tooBig = Buffer.alloc(6 * 1024 * 1024, 0x41);
  const res = await request(app)
    .post('/api/resume/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('resume', tooBig, { filename: 'big.pdf', contentType: 'application/pdf' });
  assert.strictEqual(res.status, 413);
});

// The regression test: before the fix this returned 422 for every valid PDF.
test('upload parses a real text PDF and extracts fields', async () => {
  const pdf = makePdf([
    'Jane Doe',
    'jane.doe@example.com  +1 415 555 0199',
    'linkedin.com/in/janedoe  github.com/janedoe',
    'Skills',
    'JavaScript, React, Node.js, PostgreSQL',
    'Education',
    'Stanford University',
    'B.Tech Computer Science 2021',
  ]);

  const res = await request(app)
    .post('/api/resume/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('resume', pdf, { filename: 'resume.pdf', contentType: 'application/pdf' });

  assert.strictEqual(res.status, 200, `expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
  assert.strictEqual(res.body.source, 'regex'); // no Gemini key in tests

  const { personalInfo, professionalInfo, academicInfo } = res.body.extracted;
  assert.strictEqual(personalInfo.firstName, 'Jane');
  assert.strictEqual(personalInfo.lastName, 'Doe');
  assert.strictEqual(personalInfo.email, 'jane.doe@example.com');
  assert.ok(personalInfo.phone, 'expected a phone number');
  assert.match(professionalInfo.linkedIn, /linkedin\.com\/in\/janedoe/);
  assert.match(professionalInfo.portfolio, /github\.com\/janedoe/);
  assert.match(professionalInfo.skills, /JavaScript/);
  assert.match(academicInfo.college, /Stanford/);
});

test('upload rejects a corrupt PDF with a clear message', async () => {
  const res = await request(app)
    .post('/api/resume/upload')
    .set('Authorization', `Bearer ${token}`)
    .attach('resume', Buffer.from('%PDF-1.4\nnot actually a pdf'), {
      filename: 'broken.pdf',
      contentType: 'application/pdf',
    });
  assert.strictEqual(res.status, 422);
  assert.match(res.body.error, /pdf/i);
});

test('GET /api/health reports integration config without leaking values', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(typeof res.body.integrations.gmail, 'boolean');
  assert.strictEqual(res.body.integrations.gemini, false); // unset in tests
  // No secret should ever appear in this payload.
  assert.ok(!JSON.stringify(res.body).includes(process.env.JWT_SECRET));
});
