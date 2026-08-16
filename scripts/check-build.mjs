/**
 * Post-build gate. `npm run build:check` (runs automatically as part of build.)
 *
 * The content check guards the JSON; this one guards what actually ships. It
 * fails the build when the output would break one of the client's hard
 * constraints, so a violation cannot reach production by accident:
 *
 *   1. banned wording ("Beyond Football")
 *   2. any reference to an asset the pack marks REFERENCE_ONLY,
 *      INTERNAL_REFERENCE or REVIEW_REQUIRED
 *   3. the full Founding Book PDFs present in the output
 *   4. legal/association status leaking while the flag is off (BLOCKERS #1)
 *   5. structural SEO/a11y basics: one <h1> per page, 21 sections on the home
 *      documents, complete hreflang sets
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
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

// --- 1 & 2: banned wording and uncleared assets -----------------------------
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

// --- 3: the Founding Book PDFs must never be in the output ------------------
for (const file of files) {
  const name = relative(DIST, file);
  if (extname(file).toLowerCase() === '.pdf') {
    errors.push(`${name}: PDF in build output - the full Founding Book must not be published`);
  }
}

// --- 4: legal status must not leak while withheld ---------------------------
if (!SHOW_LEGAL_STATUS) {
  // Only the rendered page matters. Astro still emits the component's scoped
  // stylesheet, which contains no wording and is never linked.
  const legalPages = files.filter(
    (f) => relative(DIST, f).includes('legal-notice') && extname(f) === '.html',
  );
  for (const page of legalPages) {
    errors.push(`${relative(DIST, page)}: legal-notice page built while PUBLIC_SHOW_LEGAL_STATUS is off`);
  }

  // The association wording from §01/§21, in all four languages.
  const LEGAL_WORDING = [
    /association suisse à but non lucratif/i,
    /swiss non-profit association/i,
    /schweizer non-profit-verein/i,
    /associazione svizzera senza scopo di lucro/i,
    /MHSV Association/,
  ];
  for (const file of textFiles.filter((f) => extname(f) === '.html')) {
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
  notes.push('PUBLIC_SHOW_LEGAL_STATUS is off - legal footer, hero status line and /legal-notice/ withheld.');
}

// --- 5: structure -----------------------------------------------------------
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

  const sections = html.match(/<section[^>]*aria-labelledby=/g) ?? [];
  if (sections.length !== 21) {
    errors.push(`${locale}/index.html: ${sections.length} labelled sections, expected 21`);
  }

  // The navigation list must exist exactly once. It used to be emitted twice -
  // a desktop bar and a mobile panel - duplicating every link in the DOM.
  const navs = html.match(/id="main-nav"/g) ?? [];
  if (navs.length !== 1) {
    errors.push(`${locale}/index.html: ${navs.length} #main-nav elements, expected exactly 1`);
  }

  // The section numbers are the content pack's editorial index, not copy.
  if (/class="[^"]*\beyebrow\b/.test(html)) {
    errors.push(`${locale}/index.html: section-number eyebrow rendered - numbers must not appear`);
  }

  // The launch rate must be stated once. It was previously in both programme
  // tables and again in the fees section.
  const currency = html.match(/CHF/g) ?? [];
  if (currency.length !== 1) {
    errors.push(`${locale}/index.html: "CHF" appears ${currency.length}×, expected exactly 1`);
  }

  // Governance: exactly the six approved people, and no retired name.
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

// --- 6: the book page, which the printed QR points at -----------------------
{
  const livre = resolve(DIST, 'livre', 'index.html');
  let html = null;
  try {
    html = readFileSync(livre, 'utf8');
  } catch {
    errors.push('livre/index.html: missing - the printed QR code has nowhere to land');
  }

  if (html) {
    // The QR encodes this exact path. It can never move.
    if (!/rel="canonical" href="[^"]*\/livre\/?"/.test(html)) {
      errors.push('livre/index.html: canonical does not point at /livre');
    }
    if (/href="[^"]*\.pdf"/i.test(html)) {
      errors.push('livre/index.html: links to a PDF - the complete book must never be downloadable');
    }
    // It is an order request, not a purchase: pricing is not approved.
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

// --- 7: consent must never be pre-ticked ------------------------------------
for (const file of textFiles.filter((f) => extname(f) === '.html')) {
  const html = readFileSync(file, 'utf8');
  const consentInputs = html.match(/<input[^>]*name="consent"[^>]*>/g) ?? [];
  for (const input of consentInputs) {
    if (/\bchecked\b/.test(input)) {
      errors.push(`${relative(DIST, file)}: consent checkbox is pre-ticked`);
    }
  }
}

// --- report -----------------------------------------------------------------
for (const note of notes) console.log(`  · ${note}`);

if (errors.length) {
  console.error(`\n✗ build check failed (${errors.length}):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

console.log(`  ✓ build check OK - ${files.length} files, ${LOCALES.length} locales, constraints honoured`);
