/**
 * Tests the Vercel (req, res) adapter in api/contact.mjs.
 *
 * The tricky part is the body: Vercel's Node runtime pre-parses
 * `application/x-www-form-urlencoded` (the no-JavaScript submit) into an object
 * and consumes the stream, but leaves `multipart/form-data` (the fetch submit)
 * as a readable stream. Both paths are covered here.
 */
import { Readable } from 'node:stream';
import handler from '../api/contact.mjs';

process.env.CONTACT_RECIPIENT = 'infos@mhsv-international.org';
process.env.CONTACT_SENDER = 'website@mhsv.ch';
process.env.CONTACT_TRANSPORT = 'log';

const FIELDS = {
  locale: 'fr',
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean.dupont@example.ch',
  profile: 'Club',
  subject: 'Demande',
  message: 'Bonjour,\n\nnous souhaitons en savoir plus.',
  consent: 'on',
  rendered_at: String(Date.now() - 30_000),
};

/** Minimal ServerResponse stand-in. */
function makeRes() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    end(chunk) {
      this.body = chunk ? Buffer.from(chunk).toString('utf8') : '';
      this.done = true;
    },
  };
  return res;
}

/** Stream-backed request — how Vercel delivers multipart. */
function streamReq(body, contentType, accept) {
  const req = Readable.from([Buffer.from(body)]);
  req.method = 'POST';
  req.url = '/api/contact';
  req.headers = {
    host: 'mhsv.ch',
    'x-forwarded-proto': 'https',
    'content-type': contentType,
    ...(accept ? { accept } : {}),
  };
  return req;
}

/** Pre-parsed request — how Vercel delivers urlencoded. */
function parsedReq(fields, accept) {
  const req = Readable.from([]);
  req.method = 'POST';
  req.url = '/api/contact';
  req.headers = {
    host: 'mhsv.ch',
    'x-forwarded-proto': 'https',
    'content-type': 'application/x-www-form-urlencoded',
    ...(accept ? { accept } : {}),
  };
  req.body = { ...fields };
  return req;
}

let passed = 0;
const failures = [];
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

async function check(name, run) {
  try {
    const log = console.log;
    console.log = () => {};
    try {
      await run();
    } finally {
      console.log = log;
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

await check('multipart body from the stream (JavaScript submit)', async () => {
  const form = new FormData();
  for (const [k, v] of Object.entries(FIELDS)) form.append(k, v);
  const request = new Request('https://mhsv.ch/api/contact', { method: 'POST', body: form });
  const contentType = request.headers.get('content-type');
  const raw = Buffer.from(await request.arrayBuffer());

  const res = makeRes();
  await handler(streamReq(raw, contentType, 'application/json'), res);
  assert(res.statusCode === 200, `status ${res.statusCode}`);
  assert(JSON.parse(res.body).ok === true, res.body);
});

await check('urlencoded body pre-parsed by Vercel (no-JS submit)', async () => {
  const res = makeRes();
  await handler(parsedReq(FIELDS), res);
  assert(res.statusCode === 303, `status ${res.statusCode}`);
  assert(res.headers.location === '/fr/message-sent/', `location ${res.headers.location}`);
});

await check('raw urlencoded body from the stream', async () => {
  const body = new URLSearchParams(FIELDS).toString();
  const res = makeRes();
  await handler(streamReq(body, 'application/x-www-form-urlencoded', 'application/json'), res);
  assert(JSON.parse(res.body).ok === true, res.body);
});

await check('validation errors survive the adapter', async () => {
  const bad = { ...FIELDS, email: 'nope' };
  const res = makeRes();
  await handler(parsedReq(bad, 'application/json'), res);
  assert(res.statusCode === 422, `status ${res.statusCode}`);
  assert(JSON.parse(res.body).fields.includes('email'), res.body);
});

await check('honeypot still discarded through the adapter', async () => {
  const res = makeRes();
  await handler(parsedReq({ ...FIELDS, website_url: 'http://spam' }, 'application/json'), res);
  assert(JSON.parse(res.body).ok === true, res.body);
});

await check('GET is refused', async () => {
  const req = Readable.from([]);
  req.method = 'GET';
  req.url = '/api/contact';
  req.headers = { host: 'mhsv.ch' };
  const res = makeRes();
  await handler(req, res);
  assert(res.statusCode === 405, `status ${res.statusCode}`);
});

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed\n`);
  process.exit(1);
}
console.log(`  ✓ Vercel adapter: ${passed}/${passed} checks passed`);
