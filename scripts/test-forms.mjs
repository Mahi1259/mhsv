import { handleContact, validate } from '../functions/lib/contact-core.mjs';

const ENV = {
  CONTACT_RECIPIENT: 'infos@mhsv.ch',
  CONTACT_SENDER: 'website@mhsv.ch',
  CONTACT_TRANSPORT: 'log',
  NEWSLETTER_PROVIDER: 'log',
};

const ORDER = {
  form: 'book-order',
  locale: 'fr',
  edition: 'fr',
  quantity: '2',
  firstName: 'Claire',
  lastName: 'Berger',
  organisation: 'Club de Genève',
  country: 'Suisse',
  email: 'claire.berger@example.ch',
  phone: '+41 22 000 00 00',
  message: 'Merci de confirmer les délais.',
  consent: 'on',
};

const SUBSCRIBE = {
  form: 'newsletter',
  locale: 'de',
  firstName: 'Anna',
  email: 'anna@example.ch',
  language: 'en',
  consent: 'on',
};

function request(fields, { json = true, renderedAt = Date.now() - 20_000 } = {}) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  if (renderedAt !== null) body.set('rendered_at', String(renderedAt));
  return new Request('https://www.mhsv.ch/api/contact', {
    method: 'POST',
    body,
    headers: json ? { Accept: 'application/json' } : {},
  });
}

function formOf(fields) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  body.set('rendered_at', String(Date.now() - 20_000));
  return body;
}

let passed = 0;
const failures = [];
const assert = (c, m) => {
  if (!c) throw new Error(m);
};

const realLog = console.log;
const quiet = async (fn) => {
  console.log = () => {};
  try {
    return await fn();
  } finally {
    console.log = realLog;
  }
};

async function check(name, run) {
  try {
    await quiet(run);
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  ✗ ${name}: ${e.message}`);
  }
}

await check('order request accepted', async () => {
  const res = await handleContact(request(ORDER), ENV);
  assert(res.status === 200, `status ${res.status}`);
  assert((await res.json()).ok === true, 'not ok');
});

await check('order request redirects to its own page without JS', async () => {
  const res = await handleContact(request(ORDER, { json: false }), ENV);
  assert(res.status === 303, `status ${res.status}`);
  assert(
    res.headers.get('location') === '/fr/order-sent/',
    `location ${res.headers.get('location')}`,
  );
});

await check('order carries no price or payment data', async () => {
  const result = validate(formOf(ORDER));
  assert(result.ok, 'should validate');
  const keys = Object.keys(result.data).join(' ');
  for (const forbidden of ['price', 'amount', 'payment', 'card', 'total', 'currency']) {
    assert(!keys.toLowerCase().includes(forbidden), `payload exposes "${forbidden}"`);
  }
});

await check('invalid edition rejected', async () => {
  const body = await (await handleContact(request({ ...ORDER, edition: 'de' }), ENV)).json();
  assert(body.fields.includes('edition'), JSON.stringify(body));
});

await check('zero and absurd quantities rejected', async () => {
  for (const quantity of ['0', '-3', '9999', 'abc']) {
    const body = await (await handleContact(request({ ...ORDER, quantity }), ENV)).json();
    assert(body.fields?.includes('quantity'), `quantity ${quantity} accepted`);
  }
});

await check('order requires organisation, country and consent', async () => {
  const fields = { ...ORDER, organisation: '', country: '' };
  delete fields.consent;
  const body = await (await handleContact(request(fields), ENV)).json();
  for (const name of ['organisation', 'country', 'consent']) {
    assert(body.fields.includes(name), `${name} not flagged`);
  }
});

await check('subscription accepted', async () => {
  const res = await handleContact(request(SUBSCRIBE), ENV);
  assert(res.status === 200, `status ${res.status}`);
  assert((await res.json()).ok === true, 'not ok');
});

await check('subscription redirects to its own page without JS', async () => {
  const res = await handleContact(request(SUBSCRIBE, { json: false }), ENV);
  assert(
    res.headers.get('location') === '/de/newsletter-sent/',
    `location ${res.headers.get('location')}`,
  );
});

await check('subscription without consent is rejected', async () => {
  const fields = { ...SUBSCRIBE };
  delete fields.consent;
  const body = await (await handleContact(request(fields), ENV)).json();
  assert(body.fields.includes('consent'), JSON.stringify(body));
});

await check('subscription requires a known language', async () => {
  const body = await (await handleContact(request({ ...SUBSCRIBE, language: 'zz' }), ENV)).json();
  assert(body.fields.includes('language'), JSON.stringify(body));
});

await check('subscription stores only what it needs', async () => {
  const result = validate(formOf(SUBSCRIBE));
  assert(result.ok, 'should validate');
  const keys = Object.keys(result.data).sort().join(',');
  assert(keys === 'consent,email,firstName,kind,language,locale', `unexpected fields: ${keys}`);
});

await check('newsletter first name is optional', async () => {
  const fields = { ...SUBSCRIBE };
  delete fields.firstName;
  const body = await (await handleContact(request(fields), ENV)).json();
  assert(body.ok === true, JSON.stringify(body));
});

await check('honeypot applies to all three forms', async () => {
  for (const fields of [ORDER, SUBSCRIBE, { form: 'contact' }]) {
    const res = await handleContact(request({ ...fields, website_url: 'x' }), ENV);
    const body = await res.json();
    assert(res.status === 200 && body.ok === true, `kind ${fields.form} leaked`);
  }
});

await check('timing check applies to all three forms', async () => {
  for (const fields of [ORDER, SUBSCRIBE]) {
    const body = await (
      await handleContact(request(fields, { renderedAt: Date.now() - 300 }), ENV)
    ).json();
    assert(body.reason === 'tooFast', `kind ${fields.form} not rate-checked`);
  }
});

await check('newsletter accepts only the languages it is written in', async () => {
  for (const language of ['fr', 'en']) {
    const result = validate(formOf({ ...SUBSCRIBE, language }));
    assert(result.ok, `${language} should be offered - the form lists it`);
  }
  for (const language of ['de', 'it']) {
    const result = validate(formOf({ ...SUBSCRIBE, language }));
    assert(!result.ok, `${language} must be refused - no such edition exists`);
    assert(result.fields.includes('language'), `${language} should flag the language field`);
  }
});

await check('the site language stays independent of the edition', async () => {
  const result = validate(formOf({ ...SUBSCRIBE, locale: 'it', language: 'fr' }));
  assert(result.ok, 'an Italian visitor must be able to take the French edition');
  assert(result.data.locale === 'it', 'locale should record where they were');
  assert(result.data.language === 'fr', 'language should record the edition');
});

await check('newsletter can notify by email when there is no Brevo account', async () => {
  const sent = [];
  const log = console.log;
  console.log = (...args) =>
    sent.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  try {
    await handleContact(request(SUBSCRIBE), { ...ENV, NEWSLETTER_PROVIDER: 'smtp', CONTACT_TRANSPORT: 'log' });
  } finally {
    console.log = log;
  }
  const body = sent.join('\n');
  assert(/\[newsletter\]/.test(body), 'should go out on the mail transport, not the Brevo path');
  assert(/NEWSLETTER/.test(body), 'subject should mark it as a newsletter subscription');
  assert(/opt-in simple/i.test(body), 'must state the subscriber has not confirmed');
  assert(!/not subscribed/.test(body), 'must not fall through to the log provider');
});

await check('the newsletter notification carries no invented consent', async () => {
  const { renderEmailHtml } = await import('../functions/lib/email-template.mjs');
  const html = renderEmailHtml({ ...SUBSCRIBE, kind: 'newsletter', locale: 'de', language: 'en' });
  assert(/Inscription à la newsletter/.test(html), 'heading');
  assert(/Opt-in simple/.test(html), 'states the basis plainly');
  assert(/n’a PAS confirmé/.test(html), 'says the subscriber did not confirm');
  assert(!/confirmation email is on its way/i.test(html), 'must not claim a confirmation was sent');
});

await check('newsletter uses Brevo double opt-in, with the consent record', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), headers: init.headers });
    return new Response('{}', { status: 200 });
  };
  try {
    await handleContact(request({ ...SUBSCRIBE, locale: 'de', language: 'en' }), {
      ...ENV,
      NEWSLETTER_PROVIDER: 'brevo',
      BREVO_API_KEY: 'k',
      BREVO_LIST_ID: '3',
      BREVO_DOI_TEMPLATE_ID: '7',
    });
  } finally {
    globalThis.fetch = realFetch;
  }

  assert(calls.length === 1, `expected one Brevo call, got ${calls.length}`);
  const { url, body } = calls[0];
  assert(/doubleOptinConfirmation$/.test(url), `wrong endpoint: ${url}`);
  assert(!/\/contacts$/.test(url), 'must not write to the list directly');
  assert(body.includeListIds[0] === 3, 'list id');
  assert(body.templateId === 7, 'template id');

  const a = body.attributes;
  assert(a.CONSENT === 'yes', 'consent recorded');
  assert(!Number.isNaN(Date.parse(a.CONSENT_AT)), `consent timestamp: ${a.CONSENT_AT}`);
  assert(!Number.isNaN(Date.parse(a.SIGNUP_AT)), `signup date: ${a.SIGNUP_AT}`);
  assert(a.LANGUE === 'EN', `selected language: ${a.LANGUE}`);
  assert(a.SOURCE === 'website:newsletter:de', `source: ${a.SOURCE}`);
  assert(/\/en\/$/.test(body.redirectionUrl), `confirm lands in the chosen language: ${body.redirectionUrl}`);
});

await check('the confirmation can be per-language when two templates exist', async () => {
  const seen = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push(JSON.parse(init.body).templateId);
    return new Response('{}', { status: 200 });
  };
  const env = { ...ENV, NEWSLETTER_PROVIDER: 'brevo', BREVO_API_KEY: 'k', BREVO_LIST_ID: '3',
    BREVO_DOI_TEMPLATE_ID: '7', BREVO_DOI_TEMPLATE_ID_FR: '11', BREVO_DOI_TEMPLATE_ID_EN: '12' };
  try {
    await handleContact(request({ ...SUBSCRIBE, language: 'fr' }), env);
    await handleContact(request({ ...SUBSCRIBE, language: 'en' }), env);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert(seen[0] === 11, `fr should use its own template, got ${seen[0]}`);
  assert(seen[1] === 12, `en should use its own template, got ${seen[1]}`);
});

await check('a Brevo failure is surfaced, never swallowed', async () => {
  const realFetch = globalThis.fetch;
  const realError = console.error;
  globalThis.fetch = async () => new Response('nope', { status: 400 });
  console.error = () => {};
  let res;
  try {
    res = await handleContact(request(SUBSCRIBE), {
      ...ENV, NEWSLETTER_PROVIDER: 'brevo', BREVO_API_KEY: 'k',
      BREVO_LIST_ID: '3', BREVO_DOI_TEMPLATE_ID: '7',
    });
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
  }
  assert(res.status >= 500, `a failed subscribe must not report success, got ${res.status}`);
});

await check('contact and order notifications go out over Brevo transactional', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), key: init.headers['api-key'] });
    return new Response('{}', { status: 200 });
  };
  const env = { ...ENV, CONTACT_TRANSPORT: 'brevo', BREVO_API_KEY: 'k' };
  try {
    await handleContact(request(ORDER), env);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert(calls.length === 1, `expected one Brevo call, got ${calls.length}`);
  const { url, body, key } = calls[0];
  assert(url === 'https://api.brevo.com/v3/smtp/email', `wrong endpoint: ${url}`);
  assert(key === 'k', 'the same api-key header the newsletter uses');
  assert(body.to[0].email === ENV.CONTACT_RECIPIENT, 'recipient');
  assert(body.replyTo.email === ORDER.email, 'reply-to is the visitor');
  assert(body.textContent && body.htmlContent, 'both parts are sent');
  assert(Array.isArray(body.attachment) && body.attachment.length === 1, 'the crest travels with it');
});

await check('unknown form kind falls back to contact', async () => {
  const result = validate(formOf({ ...SUBSCRIBE, form: 'wat' }));
  assert(!result.ok, 'should not validate as contact');
});

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed\n`);
  process.exit(1);
}
console.log(`  ✓ book order + newsletter: ${passed}/${passed} checks passed`);
