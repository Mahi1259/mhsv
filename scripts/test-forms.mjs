/**
 * Tests for the two forms added by the 14 August brief: the Founding Book
 * order request and the newsletter subscription.
 *
 * The order flow especially: it must stay a REQUEST. There is no price, no
 * payment and no checkout anywhere in the payload, because pricing is not
 * approved.
 */
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

/*
 * A German speaker, reading the German site, subscribing to the English
 * edition - which is the real case the newsletter has to handle, because the
 * newsletter is only written in French and English. `locale` is where she is;
 * `language` is which edition she gets. They are deliberately different here.
 */
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

// --- book order ------------------------------------------------------------
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

// --- newsletter ------------------------------------------------------------
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

// --- shared guards apply to every form -------------------------------------
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
  /*
   * The form never offered these, but the handler used to accept them, so a
   * hand-made POST could subscribe someone to an edition that is not written.
   */
  for (const language of ['de', 'it']) {
    const result = validate(formOf({ ...SUBSCRIBE, language }));
    assert(!result.ok, `${language} must be refused - no such edition exists`);
    assert(result.fields.includes('language'), `${language} should flag the language field`);
  }
});

await check('the site language stays independent of the edition', async () => {
  // Reading the Italian site, subscribing in French: valid, and common.
  const result = validate(formOf({ ...SUBSCRIBE, locale: 'it', language: 'fr' }));
  assert(result.ok, 'an Italian visitor must be able to take the French edition');
  assert(result.data.locale === 'it', 'locale should record where they were');
  assert(result.data.language === 'fr', 'language should record the edition');
});

await check('newsletter can notify by email when there is no Brevo account', async () => {
  const sent = [];
  const log = console.log;
  // Serialise properly - the transport logs an object, and args.join(' ')
  // turned it into "[object Object]", hiding the subject the assertions read.
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

await check('unknown form kind falls back to contact', async () => {
  const result = validate(formOf({ ...SUBSCRIBE, form: 'wat' }));
  // Falls back to contact, which needs fields the newsletter does not send.
  assert(!result.ok, 'should not validate as contact');
});

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed\n`);
  process.exit(1);
}
console.log(`  ✓ book order + newsletter: ${passed}/${passed} checks passed`);
