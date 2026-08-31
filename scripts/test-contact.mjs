import { handleContact } from '../functions/lib/contact-core.mjs';

const ENV = {
  CONTACT_RECIPIENT: 'infos@mhsv-international.org',
  CONTACT_SENDER: 'website@mhsv.ch',
  CONTACT_TRANSPORT: 'log',
};

const valid = {
  locale: 'de',
  firstName: 'Anna',
  lastName: 'Müller',
  email: 'anna.mueller@example.ch',
  phone: '+41 79 000 00 00',
  profile: 'Verein',
  subject: 'Anfrage Gründungsprogramm',
  message: 'Guten Tag,\n\nwir möchten mehr über das Programm erfahren.\n\nFreundliche Grüsse',
  consent: 'on',
};

function request(fields, { json = true, renderedAt = Date.now() - 20_000 } = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  if (renderedAt !== null) body.set('rendered_at', String(renderedAt));
  return new Request('https://example.test/api/contact', {
    method: 'POST',
    body,
    headers: json ? { Accept: 'application/json' } : {},
  });
}

let passed = 0;
const failures = [];

async function check(name, run) {
  try {
    await run();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`  ✗ ${name}: ${error.message}`);
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const realLog = console.log;
const quiet = (fn) => async (...args) => {
  console.log = () => {};
  try {
    return await fn(...args);
  } finally {
    console.log = realLog;
  }
};
const call = quiet((req) => handleContact(req, ENV));

await check('valid submission returns ok (JSON)', async () => {
  const res = await call(request(valid));
  assert(res.status === 200, `status ${res.status}`);
  const body = await res.json();
  assert(body.ok === true, JSON.stringify(body));
});

await check('valid submission redirects to the confirmation page (no JS)', async () => {
  const res = await call(request(valid, { json: false }));
  assert(res.status === 303, `status ${res.status}`);
  assert(
    res.headers.get('location') === '/de/message-sent/',
    `location ${res.headers.get('location')}`,
  );
});

await check('missing required fields are reported per field', async () => {
  const res = await call(request({ ...valid, firstName: '', subject: '' }));
  assert(res.status === 422, `status ${res.status}`);
  const body = await res.json();
  assert(body.fields.includes('firstName'), 'firstName not flagged');
  assert(body.fields.includes('subject'), 'subject not flagged');
});

await check('invalid email is rejected', async () => {
  const res = await call(request({ ...valid, email: 'not-an-email' }));
  const body = await res.json();
  assert(body.fields.includes('email'), JSON.stringify(body));
});

await check('missing consent is rejected', async () => {
  const fields = { ...valid };
  delete fields.consent;
  const body = await (await call(request(fields))).json();
  assert(body.fields.includes('consent'), JSON.stringify(body));
});

await check('over-long message is rejected', async () => {
  const body = await (await call(request({ ...valid, message: 'x'.repeat(5001) }))).json();
  assert(body.fields.includes('message'), JSON.stringify(body));
});

await check('honeypot submission is silently discarded', async () => {
  const res = await call(request({ ...valid, website_url: 'http://spam.example' }));
  const body = await res.json();
  assert(res.status === 200 && body.ok === true, JSON.stringify(body));
});

await check('submission faster than a human is rejected', async () => {
  const res = await call(request(valid, { renderedAt: Date.now() - 500 }));
  const body = await res.json();
  assert(body.reason === 'tooFast', JSON.stringify(body));
});

await check('missing timing field still succeeds (no-JS visitors)', async () => {
  const res = await call(request(valid, { renderedAt: null }));
  const body = await res.json();
  assert(body.ok === true, JSON.stringify(body));
});

await check('header injection via newlines is neutralised', async () => {
  const req = request({ ...valid, subject: 'Hi\r\nBcc: attacker@example.com' });
  const res = await call(req);
  assert((await res.json()).ok === true, 'should still send');
  const { validate } = await import('../functions/lib/contact-core.mjs');
  const form = new FormData();
  for (const [k, v] of Object.entries({ ...valid, subject: 'Hi\r\nBcc: attacker@example.com' })) {
    form.append(k, v);
  }
  const result = validate(form);
  assert(result.ok, 'validation should pass');
  assert(!/[\r\n]/.test(result.data.subject), `subject still has newlines: ${result.data.subject}`);
});

await check('unknown locale falls back to the default', async () => {
  const res = await call(request({ ...valid, locale: 'xx' }, { json: false }));
  assert(
    res.headers.get('location') === '/fr/message-sent/',
    `location ${res.headers.get('location')}`,
  );
});

await check('GET is refused', async () => {
  const res = await call(new Request('https://example.test/api/contact'));
  assert(res.status === 405, `status ${res.status}`);
});

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed\n`);
  process.exit(1);
}
console.log(`  ✓ contact handler: ${passed}/${passed} checks passed`);
