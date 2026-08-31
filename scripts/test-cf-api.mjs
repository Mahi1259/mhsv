import { onRequestPost, onRequest } from '../functions/api/contact.js';

const ENV = {
  CONTACT_RECIPIENT: 'infos@mhsv.ch',
  CONTACT_SENDER: 'website@mhsv.ch',
  CONTACT_TRANSPORT: 'log',
  NEWSLETTER_PROVIDER: 'log',
};

const failures = [];
const check = (ok, label, detail = '') => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  - ${detail}` : ''}`);
};

const post = (fields, { json = true } = {}) => {
  const body = new URLSearchParams(fields);
  return new Request('https://www.mhsv.ch/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      ...(json ? { accept: 'application/json' } : {}),
    },
    body,
  });
};

const CONTACT = {
  form: 'contact',
  locale: 'fr',
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean.dupont@example.ch',
  profile: 'Athl\u00e8te',
  subject: 'Demande d\u2019information',
  message: 'Bonjour, je souhaite des informations.',
  consent: 'on',
  rendered_at: String(Date.now() - 8000),
};

const NEWSLETTER = {
  form: 'newsletter',
  locale: 'fr',
  language: 'fr',
  email: 'abo@example.ch',
  firstName: 'Jean',
  consent: 'on',
  rendered_at: String(Date.now() - 8000),
};

for (const [kind, extra] of [
  ['contact', {}],
  ['book-order', { organisation: 'FC Example', country: 'Suisse', edition: 'fr', quantity: '2' }],
  ['newsletter', { email: 'abo@example.ch', consent: 'on' }],
]) {
  const fields = kind === 'newsletter' ? NEWSLETTER : { ...CONTACT, form: kind, ...extra };
  const res = await onRequestPost({ request: post(fields), env: ENV });
  const body = await res.clone().json().catch(() => ({}));
  check(res.status === 200 && body.ok === true, `${kind}: accepted`, `HTTP ${res.status}`);
}

{
  const res = await onRequestPost({ request: post({ ...CONTACT, email: 'not-an-email' }), env: ENV });
  const body = await res.json();
  check(res.status === 422 && body.fields?.includes('email'), 'a bad email is rejected server-side', `HTTP ${res.status}`);
}
{
  const res = await onRequestPost({ request: post({ ...CONTACT, consent: '' }), env: ENV });
  check(res.status === 422, 'missing consent is rejected', `HTTP ${res.status}`);
}
{
  const res = await onRequestPost({ request: post({ ...CONTACT, website_url: 'http://spam.example' }), env: ENV });
  check(res.status === 200, 'the honeypot is discarded, not reported', `HTTP ${res.status}`);
}
{
  const res = await onRequest({ request: new Request('https://www.mhsv.ch/api/contact'), env: ENV });
  check(res.status === 405, 'GET is refused');
}
for (const locale of ['fr', 'en', 'de', 'it']) {
  const res = await onRequestPost({ request: post({ ...CONTACT, locale }, { json: false }), env: ENV });
  const location = res.headers.get('location') ?? '';
  check(
    res.status === 303 && location === `/${locale}/message-sent/`,
    `${locale}: the no-JavaScript reply is the success page, in the visitor's language`,
    location,
  );
}

{
  const res = await onRequestPost({ request: post(CONTACT), env: { ...ENV, CONTACT_RECIPIENT: '' } });
  const body = await res.json();
  check(
    res.status === 502 && body.ok === false,
    'no recipient configured fails loudly, it is not a silent drop',
    `HTTP ${res.status}`,
  );
}

console.log('');
if (failures.length) {
  console.error(`✗ Cloudflare function: ${failures.length} failed\n`);
  process.exit(1);
}
console.log('  ✓ Cloudflare Pages Function: all checks passed');
