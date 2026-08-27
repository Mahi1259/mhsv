/**
 * Tests for the HTML notification email.  `npm run test:email`
 *
 * The escaping tests are the point of this file. Every value in that template
 * is typed by a stranger on a public form and lands in HTML that MHSV® staff
 * open in a mail client. The plain-text body never had that exposure, so it is
 * an easy thing to lose in a later edit.
 */
import { renderEmailHtml } from '../functions/lib/email-template.mjs';

const failures = [];
let passed = 0;
const check = (ok, label, detail = '') => {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failures.push(label); console.error(`  ✗ ${label}${detail ? `  - ${detail}` : ''}`); }
};

const CONTACT = {
  kind: 'contact', locale: 'fr',
  firstName: 'Anna', lastName: 'Müller', email: 'anna@example.ch',
  phone: '+41 79 000 00 00', profile: 'Club', subject: 'Partnership',
  message: 'First line.\nSecond line.',
};
const ORDER = {
  kind: 'book-order', locale: 'en', edition: 'fr', quantity: 2,
  firstName: 'Jean', lastName: 'Dupont', organisation: 'Club X', country: 'Switzerland',
  email: 'jean@example.ch', phone: '', message: '',
};

// --- both forms render their own fields -------------------------------------
{
  const html = renderEmailHtml(CONTACT);
  check(html.includes('Contact form submission'), 'contact: heading');
  for (const label of ['Name', 'Email', 'Phone', 'Profile', 'Subject', 'Site language']) {
    check(html.includes(`<strong style="color:#1c2431;">${label}</strong>`), `contact: "${label}" row`);
  }
  check(!html.includes('Quantity') && !html.includes('Edition'), 'contact: no order-only fields');
  check(html.includes('First line.<br />Second line.'), 'contact: line breaks kept');
}
{
  const html = renderEmailHtml(ORDER);
  check(html.includes('Founding Book - order request'), 'order: heading');
  for (const label of ['Request', 'Edition', 'Quantity', 'Organisation', 'Country']) {
    check(html.includes(`<strong style="color:#1c2431;">${label}</strong>`), `order: "${label}" row`);
  }
  check(!html.includes('>Profile<'), 'order: no contact-only fields');
  check(html.includes('No payment has been taken'), 'order: states it is not a purchase');
  check(html.includes('(no message)'), 'order: empty message is stated, not blank');
  /*
   * Pricing is not approved, so no amount may appear. Checked as an amount -
   * a currency or a figure - not as the word "price", which the banner uses
   * precisely to say there is not one.
   */
  check(!/CHF|EUR|USD|[€$£]\s*\d|\d+[.,]\d{2}\b/.test(html), 'order: no amount or currency anywhere');
}

// --- escaping ---------------------------------------------------------------
{
  const attack = {
    ...CONTACT,
    firstName: '<script>alert(1)</script>',
    lastName: '"><img src=x onerror=alert(2)>',
    subject: 'Tom & Jerry <b>bold</b>',
    message: 'line<script>alert(3)</script>\n<b>x</b>',
    email: 'a@b.ch"><script>alert(4)</script>',
  };
  const html = renderEmailHtml(attack);
  check(!html.includes('<script>'), 'escaping: no raw <script> survives');
  /*
   * `onerror=` still appears - as text, inside an escaped `&lt;img ...&gt;`.
   * That is the correct outcome, so asserting its absence would be asserting
   * the wrong thing. What matters is that it never lands inside a real tag: the
   * only <img in the message is the logo in the header.
   */
  const imgTags = html.match(/<img\b[^>]*>/g) || [];
  check(imgTags.length === 1, 'escaping: submitted markup produced no extra <img>', `${imgTags.length} found`);
  check(!/<[^>]*\son\w+\s*=/.test(html), 'escaping: no event handler inside any real tag');
  check(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaping: name is shown as text');
  check(html.includes('Tom &amp; Jerry'), 'escaping: ampersand escaped');
  check(html.includes('&lt;b&gt;x&lt;/b&gt;'), 'escaping: markup in the message is shown as text');
  // The mailto: href is built from the address, so it must be escaped too.
  check(!/href="mailto:[^"]*"><script/.test(html), 'escaping: mailto href cannot be broken out of');
}

// --- structure the mail clients need ----------------------------------------
{
  const html = renderEmailHtml(ORDER);
  check(!/<table[^>]*>\s*<table/.test(html), 'structure: no table nested straight inside a table');
  check((html.match(/<tr>/g) || []).length === (html.match(/<\/tr>/g) || []).length, 'structure: rows balanced');
  check((html.match(/<table/g) || []).length === (html.match(/<\/table>/g) || []).length, 'structure: tables balanced');
  check(!/<style[\s>]/.test(html), 'structure: no <style> block - clients strip them');
  check(!/(display:\s*(flex|grid))/.test(html), 'structure: no flex or grid');
  check(/#0C1D3A/i.test(html) && /#D4AF37/i.test(html), 'brand: navy and gold both used');
}

// --- the logo ---------------------------------------------------------------
{
  const embedded = renderEmailHtml(ORDER, { embedLogo: true });
  check(embedded.includes('src="cid:mhsv-crest"'), 'logo: embedded as a cid: reference');
  check(!/localhost/.test(embedded), 'logo: embedded form links nowhere');

  const linked = renderEmailHtml(ORDER, { siteUrl: 'https://www.mhsv.ch/' });
  check(linked.includes('src="https://www.mhsv.ch/icon-192.png"'), 'logo: absolute URL, trailing slash trimmed');

  /*
   * The bug this replaced: PUBLIC_SITE_URL is the running instance, which in
   * dev is the developer's own machine. Mail went out pointing at
   * http://localhost:8788/icon-192.png, which no mail client can ever load.
   */
  for (const local of ['http://localhost:8788', 'http://127.0.0.1:4321', 'http://0.0.0.0:3000']) {
    const html = renderEmailHtml(ORDER, { siteUrl: local });
    check(!html.includes(local), `logo: "${local}" never reaches the mail`);
    check(html.includes('https://www.mhsv.ch/icon-192.png'), `logo: "${local}" falls back to production`);
  }

  check(renderEmailHtml(ORDER).includes('src="https://www.mhsv.ch/icon-192.png"'),
    'logo: falls back to the production domain when no origin is given');
  check(renderEmailHtml(ORDER, { embedLogo: true }).includes('alt=""'),
    'logo: decorative alt - the wordmark beside it is real text');
  check(renderEmailHtml(ORDER, { embedLogo: true }).includes('>MHSV&reg;<'),
    'logo: header still reads if the image never renders');
}

// --- the embedded crest itself ----------------------------------------------
{
  const { CREST_BASE64, CREST_CID } = await import('../functions/lib/crest-logo.mjs');
  const bytes = Buffer.from(CREST_BASE64, 'base64');
  check(bytes.length > 2000, 'crest: decodes to a real image', `${bytes.length} bytes`);
  // PNG magic number - proves it is an image and not a truncated string.
  check(bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    'crest: is a valid PNG');
  check(renderEmailHtml(ORDER, { embedLogo: true }).includes(`cid:${CREST_CID}`),
    'crest: the cid in the markup matches the one the transport attaches');
}

console.log('');
if (failures.length) {
  console.error(`✗ ${failures.length} failed, ${passed} passed\n`);
  process.exit(1);
}
console.log(`  ✓ email template: ${passed}/${passed} checks passed`);
