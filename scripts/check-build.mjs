import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = resolve(ROOT, 'dist');
const LOCALES = ['fr', 'en', 'de', 'it'];
const SHOW_LEGAL_STATUS = process.env.PUBLIC_SHOW_LEGAL_STATUS === 'true';

const errors = [];
const notes = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = resolve(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('✗ dist/ not found - run "astro build" first');
  process.exit(1);
}

const textFiles = files.filter((f) =>
  ['.html', '.css', '.js', '.xml', '.txt', '.json', '.webmanifest'].includes(extname(f)),
);

const FORBIDDEN = [
  { pattern: /beyond\s+football/i, why: 'retired baseline (hard constraint)' },
  { pattern: /REFERENCE_ONLY/i, why: 'asset marked REFERENCE_ONLY in ASSET_STATUS.csv' },
  { pattern: /INTERNAL_REFERENCE/i, why: 'asset marked INTERNAL_REFERENCE in ASSET_STATUS.csv' },
  { pattern: /REVIEW_REQUIRED/i, why: 'asset not cleared for publication' },
  {
    pattern: /mhsv-international\.org/i,
    why: 'retired domain - superseded by mhsv.ch on 14 August 2026',
  },
];

for (const file of textFiles) {
  const content = readFileSync(file, 'utf8');
  for (const { pattern, why } of FORBIDDEN) {
    const match = pattern.exec(content);
    if (match) errors.push(`${relative(DIST, file)}: contains "${match[0]}" - ${why}`);
  }
}

for (const file of files) {
  const name = relative(DIST, file);
  if (extname(file).toLowerCase() === '.pdf') {
    errors.push(`${name}: PDF in build output - the full Founding Book must not be published`);
  }
}

if (!SHOW_LEGAL_STATUS) {
  for (const locale of LOCALES) {
    const expected = locale === 'fr'
      ? ['mentions-legales', 'protection-des-donnees', 'cookies', 'formulaires']
      : ['legal-notice', 'data-protection', 'cookies', 'forms'];
    for (const slug of expected) {
      if (!existsSync(resolve(DIST, locale, slug, 'index.html'))) {
        errors.push(`${locale}/${slug}/ is missing - the footer links to it in every locale`);
      }
    }
  }

  const LEGAL_WORDING = [
    /association suisse à but non lucratif/i,
    /swiss non-profit association/i,
    /schweizer non-profit-verein/i,
    /associazione svizzera senza scopo di lucro/i,
    /MHSV Association/,
  ];
  const APPROVED_LEGAL_TEXT =
    /\/(protection-des-donnees|data-protection|mentions-legales|legal-notice)\//;

  for (const file of textFiles.filter((f) => extname(f) === '.html')) {
    if (APPROVED_LEGAL_TEXT.test(relative(DIST, file))) continue;
    const content = readFileSync(file, 'utf8');
    for (const pattern of LEGAL_WORDING) {
      const match = pattern.exec(content);
      if (match) {
        errors.push(
          `${relative(DIST, file)}: legal/association wording "${match[0]}" is visible while PUBLIC_SHOW_LEGAL_STATUS is off (BLOCKERS #1)`,
        );
      }
    }
  }
  notes.push('PUBLIC_SHOW_LEGAL_STATUS is off - legal footer and hero status line withheld; the four legal pages are placeholders.');
}

for (const file of files.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(file, 'utf8');
  const from = relative(DIST, file);
  const hrefs = new Set();
  for (const m of html.matchAll(/<link[^>]+rel="alternate"[^>]+href="([^"]+)"/g)) hrefs.add(m[1]);
  for (const m of html.matchAll(/<a[^>]+data-lang-link[^>]*href="([^"#]+)"/g)) hrefs.add(m[1]);

  for (const href of hrefs) {
    let path;
    try {
      path = href.startsWith('http') ? new URL(href).pathname : href;
    } catch {
      continue;
    }
    const clean = path.replace(/^\/+|\/+$/g, '');
    if (!clean) continue;
    const asFile = resolve(DIST, clean);
    if (!existsSync(asFile) && !existsSync(resolve(asFile, 'index.html')) && !existsSync(`${asFile}.html`)) {
      errors.push(`${from}: language link "${path}" has no page in the build`);
    }
  }
}

for (const locale of LOCALES) {
  const home = resolve(DIST, locale, 'index.html');
  let html;
  try {
    html = readFileSync(home, 'utf8');
  } catch {
    errors.push(`${locale}/index.html: missing - locale did not build`);
    continue;
  }

  const h1s = html.match(/<h1[\s>]/g) ?? [];
  if (h1s.length !== 1) errors.push(`${locale}/index.html: ${h1s.length} <h1> elements, expected exactly 1`);

  const EXPECTED_SECTIONS = 22;

  const sections = html.match(/<section[^>]*aria-labelledby=/g) ?? [];
  if (sections.length !== EXPECTED_SECTIONS) {
    errors.push(
      `${locale}/index.html: ${sections.length} labelled sections, expected ${EXPECTED_SECTIONS}`,
    );
  }

  const navs = html.match(/id="main-nav"/g) ?? [];
  if (navs.length !== 1) {
    errors.push(`${locale}/index.html: ${navs.length} #main-nav elements, expected exactly 1`);
  }

  if (/class="[^"]*\beyebrow\b/.test(html)) {
    errors.push(`${locale}/index.html: section-number eyebrow rendered - numbers must not appear`);
  }

  const currency = html.match(/CHF/g) ?? [];
  if (currency.length !== 1) {
    errors.push(`${locale}/index.html: "CHF" appears ${currency.length}×, expected exactly 1`);
  }

  const members = html.match(/class="team__name"/g) ?? [];
  if (members.length !== 6) {
    errors.push(`${locale}/index.html: ${members.length} team members, expected 6`);
  }
  for (const retired of ['Gwladys']) {
    if (html.includes(retired)) {
      errors.push(`${locale}/index.html: retired name "${retired}" still present`);
    }
  }
  for (const required of ['Paule ESSAI', 'Marc DJEA']) {
    if (!html.includes(required)) {
      errors.push(`${locale}/index.html: approved member "${required}" missing`);
    }
  }

  if (!html.includes('content="#0C1D3A"')) {
    errors.push(`${locale}/index.html: theme-color is not the brand navy #0C1D3A`);
  }

  for (const other of LOCALES) {
    if (!new RegExp(`hreflang="${other}"`).test(html)) {
      errors.push(`${locale}/index.html: missing hreflang alternate for "${other}"`);
    }
  }
  if (!/hreflang="x-default"/.test(html)) {
    errors.push(`${locale}/index.html: missing x-default hreflang`);
  }
  if (!/rel="canonical"/.test(html)) errors.push(`${locale}/index.html: missing canonical`);
}

// /livre is the printed QR code's landing page: it must exist, be canonical,
// carry no PDF, and read as an order request rather than a purchase.
{
  const livre = resolve(DIST, 'livre', 'index.html');
  let html = null;
  try {
    html = readFileSync(livre, 'utf8');
  } catch {
    errors.push('livre/index.html: missing - the printed QR code has nowhere to land');
  }

  if (html) {
    if (!/rel="canonical" href="[^"]*\/livre\/?"/.test(html)) {
      errors.push('livre/index.html: canonical does not point at /livre');
    }
    if (/href="[^"]*\.pdf"/i.test(html)) {
      errors.push('livre/index.html: links to a PDF - the complete book must never be downloadable');
    }
    for (const word of ['checkout', 'add to cart', 'panier', 'stripe', 'paypal']) {
      if (html.toLowerCase().includes(word)) {
        errors.push(`livre/index.html: contains "${word}" - this is an order request, not a purchase`);
      }
    }
    if (!/name="edition"/.test(html) || !/name="consent"/.test(html)) {
      errors.push('livre/index.html: order-request form is missing its edition or consent field');
    }
  }
}

// No QR code on the site itself - the QR is a print asset.
{
  for (const file of textFiles.filter((f) => extname(f) === '.html')) {
    const html = readFileSync(file, 'utf8');
    if (/book__qrCode|data-qr|mhsv-livre-qr|mhsv-card-qr/.test(html)) {
      errors.push(`${relative(DIST, file)}: displays a QR code - none belongs on the site`);
    }
  }
  for (const file of files) {
    const name = relative(DIST, file);
    if (/qr/i.test(name) && /\.(svg|png)$/i.test(name)) {
      errors.push(`${name}: a QR asset reached the build - print assets belong in qr/`);
    }
  }
}

// Every stock photograph must have a credit, and every credit a photograph.
{
  const STOCK = resolve(ROOT, 'src/assets/stock');
  const photographs = existsSync(STOCK)
    ? readdirSync(STOCK).filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f)).length
    : 0;

  for (const locale of LOCALES) {
    const home = resolve(DIST, locale, 'index.html');
    if (!existsSync(home)) continue;
    const rendered = (readFileSync(home, 'utf8').match(/<figure class="section-image/g) ?? []).length;
    if (rendered !== photographs) {
      errors.push(
        `${locale}/index.html: ${rendered} photographs rendered but ${photographs} files in src/assets/stock/`,
      );
    }

    const creditsSlug = {
      fr: 'fr/credits-photos',
      en: 'en/photo-credits',
      de: 'de/bildnachweise',
      it: 'it/crediti-foto',
    }[locale];
    const creditsPage = resolve(DIST, creditsSlug, 'index.html');
    if (!existsSync(creditsPage)) {
      errors.push(`${creditsSlug}/ is missing - the footer links to it`);
      continue;
    }
    const credited = (readFileSync(creditsPage, 'utf8').match(/unsplash\.com\/photos\//g) ?? []).length;
    if (credited !== photographs) {
      errors.push(
        `${creditsSlug}/: credits ${credited} photographers for ${photographs} photographs on the site`,
      );
    }
  }
}

// Individual addresses appear only on a Governance card; everywhere else is
// infos@mhsv.ch. Matched by shape so a seventh member is covered too.
{
  const INDIVIDUAL = /\b[a-z]\.[a-z-]+@mhsv\.ch\b/g;

  for (const file of textFiles.filter((f) => extname(f) === '.html')) {
    const name = relative(DIST, file);
    const html = readFileSync(file, 'utf8');

    // Scans rendered text, not markup: stylesheets are inlined, so a gradient
    // stop like #07142647 55% reads as a Swiss number in raw HTML.
    const visible = html
      .replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ');
    const SEP = '[\\s.\u00a0()-]*';
    const tel = /(?:href|tel)\s*[=:]\s*["']?tel:\s*[+\d][\d\s.()+-]{5,}/i.exec(html);
    if (tel) errors.push(`${name}: publishes a phone link "${tel[0].trim()}"`);
    const intl = new RegExp(`(?:\\+|00)${SEP}41(?:${SEP}\\d){9}`);
    const national = /\b0[1-9]\d[\s.\u00a0-]\d{3}[\s.\u00a0-]\d{2}[\s.\u00a0-]\d{2}\b/;
    const digits = intl.exec(visible) ?? national.exec(visible);
    if (digits) errors.push(`${name}: publishes a phone number "${digits[0].trim()}"`);

    const found = [...new Set(html.match(INDIVIDUAL) ?? [])];
    if (!found.length) continue;

    const onHome = /^[a-z]{2}\/index\.html$/.test(name);
    if (!onHome) {
      errors.push(
        `${name}: individual address${found.length > 1 ? 'es' : ''} ${found.join(', ')} outside Governance`,
      );
      continue;
    }

    for (const address of found) {
      const escaped = address.replace(/[.]/g, '\\.');
      const inCard = new RegExp(
        `class="[^"]*\\bteam__email\\b[^"]*"\\s+href="mailto:${escaped}"`,
      ).test(html);
      const count = (html.match(new RegExp(escaped, 'g')) ?? []).length;
      if (!inCard) {
        errors.push(`${name}: ${address} appears outside the Governance card`);
      } else if (count > 2) {
        errors.push(`${name}: ${address} appears ${count}x, expected only the Governance card`);
      }
    }
  }
}

// A build that canonicalises to localhost must never reach a deployment.
{
  const inCI = Boolean(
    process.env.CF_PAGES || process.env.VERCEL || process.env.NETLIFY || process.env.CI,
  );

  if (inCI) {
    const home = resolve(DIST, 'fr', 'index.html');
    if (existsSync(home)) {
      const canonical = /<link rel="canonical" href="([^"]+)"/.exec(readFileSync(home, 'utf8'))?.[1];
      if (canonical && /localhost|127\.0\.0\.1/.test(canonical)) {
        errors.push(
          `canonical is "${canonical}" in a CI build - set PUBLIC_SITE_URL ` +
            '(production: https://www.mhsv.ch). Every canonical, hreflang, og:url ' +
            'and sitemap entry in this build points at localhost.',
        );
      }
    }
  }
}

// Logo usage rules, checked in the source rather than the output.
{
  const SOURCE = resolve(ROOT, 'src');
  const sourceFiles = walk(SOURCE).filter((f) => /\.(astro|ts|tsx)$/.test(f));

  const RULES = [
    { mark: 'mhsv-focus', allowed: ['components/sections/Identity.astro'],
      why: 'the Focus mark is the collection brand, never the site identity' },
    { mark: 'mhsv-institutional', allowed: ['components/sections/Identity.astro'],
      why: 'the institutional logo is for documents and institutional contexts only' },
  ];

  for (const file of sourceFiles) {
    const rel = relative(SOURCE, file);
    const content = readFileSync(file, 'utf8');
    for (const { mark, allowed, why } of RULES) {
      if (!content.includes(mark)) continue;
      if (!allowed.includes(rel)) {
        errors.push(`src/${rel}: imports "${mark}" - ${why}`);
      }
    }
  }

  const header = readFileSync(resolve(SOURCE, 'components/Header.astro'), 'utf8');
  for (const banned of ['mhsv-focus', 'mhsv-institutional']) {
    if (header.includes(banned)) {
      errors.push(`Header.astro references "${banned}" - the header carries the shield and nothing else`);
    }
  }
}

for (const locale of LOCALES) {
  const home = resolve(DIST, locale, 'index.html');
  if (!existsSync(home)) continue;
  const html = readFileSync(home, 'utf8');

  const video = /<video\b[^>]*>[\s\S]*?<\/video>/.exec(html)?.[0];
  if (!video) {
    errors.push(`${locale}/index.html: no <video> - the presentation video is missing`);
    continue;
  }

  const track = /<track\b[^>]*src="([^"]+)"/.exec(video)?.[1];
  if (!track) errors.push(`${locale}/index.html: the video has no subtitle track`);
  else if (!track.endsWith('.vtt')) {
    errors.push(`${locale}/index.html: subtitle track is "${track}" - <track> only reads WebVTT`);
  }

  if (!/poster="[^"]+"/.test(video)) {
    errors.push(`${locale}/index.html: the video has no poster`);
  }
  if (!/preload="none"/.test(video)) {
    errors.push(`${locale}/index.html: the video is missing preload="none" - it would fetch megabytes on load`);
  }
  if (/\bautoplay\b/.test(video)) {
    errors.push(`${locale}/index.html: the video autoplays`);
  }
}

for (const file of files) {
  const name = relative(DIST, file);
  if (name.split('/').some((part) => part.startsWith('.'))) {
    errors.push(`${name}: dotfile in the build output`);
  }
}

for (const file of textFiles.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(file, 'utf8');
  const consentInputs = html.match(/<input[^>]*name="consent"[^>]*>/g) ?? [];
  for (const input of consentInputs) {
    if (/\bchecked\b/.test(input)) {
      errors.push(`${relative(DIST, file)}: consent checkbox is pre-ticked`);
    }
  }
}

for (const note of notes) console.log(`  · ${note}`);

if (errors.length) {
  console.error(`\n✗ build check failed (${errors.length}):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`  ✓ build check OK - ${files.length} files, ${LOCALES.length} locales, constraints honoured`);
