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
  /*
   * The legal pages EXIST while the flag is off - they are placeholders now,
   * and the footer links to all four in every language, so a missing one is a
   * 404 rather than a withheld page. What must not appear is legal STATUS, and
   * the wording sweep below covers every HTML file including these.
   *
   * This guard used to assert the opposite: that no legal-notice page was
   * built at all. That was right when the page carried the editor block and
   * the association wording; it is wrong now that it carries one sentence
   * saying a lawyer has not written it yet.
   */
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

  // The association wording from §01/§21, in all four languages.
  const LEGAL_WORDING = [
    /association suisse à but non lucratif/i,
    /swiss non-profit association/i,
    /schweizer non-profit-verein/i,
    /associazione svizzera senza scopo di lucro/i,
    /MHSV Association/,
  ];
  /*
   * The data protection notice is the ONE exemption, and a narrow one.
   *
   * MHSV® supplied that text for these two URLs and it names "MHSV Association"
   * as the data controller - a notice cannot identify its controller any other
   * way. It carries a banner saying it is pending final legal validation, which
   * must not be removed.
   *
   * The ban stands everywhere else: the home documents, the footer, the hero
   * status line. Exempting the whole build instead of these pages would have
   * thrown away the guard that keeps association status off the site.
   */
  const DATA_PROTECTION = /\/(protection-des-donnees|data-protection)\//;

  for (const file of textFiles.filter((f) => extname(f) === '.html')) {
    if (DATA_PROTECTION.test(relative(DIST, file))) continue;
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

/*
 * --- 4b: every language link must land on a page that exists ---------------
 *
 * The legal and photo-credits pages carry a different slug per language, and
 * the switcher used to swap only the prefix: from /it/crediti-foto/ it offered
 * /de/crediti-foto/, which does not exist. Every one of those pages was broken
 * in three languages out of four, and nothing here noticed, because the checks
 * only ever looked at the home documents.
 *
 * Static, so it needs no server: resolve each href to the file it would be
 * served from and require that file to be in the build.
 */
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

/*
 * --- 6b: the on-page QR must encode the permanent book URL ------------------
 *
 * The Book section paints a QR inline. It is generated by scripts/generate-web-
 * qr.mjs, which verifies its own output - but nothing stopped someone editing
 * the committed SVG, or the section pointing at a different file. Decode what
 * actually shipped, in every language, and require the permanent URL back.
 */
{
  const { default: sharp } = await import('sharp');
  const { default: jsQR } = await import('jsqr');
  const EXPECTED = 'https://www.mhsv.ch/livre';

  for (const locale of LOCALES) {
    const home = resolve(DIST, locale, 'index.html');
    if (!existsSync(home)) continue;
    const html = readFileSync(home, 'utf8');
    const svg = /<div class="book__qrCode"[^>]*>\s*(<svg[\s\S]*?<\/svg>)/.exec(html)?.[1];
    if (!svg) {
      errors.push(`${locale}/index.html: the Book section has no inline QR code`);
      continue;
    }
    const { data, info } = await sharp(Buffer.from(svg))
      .resize(512, 512, { fit: 'fill' })
      .flatten({ background: '#fff' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (!decoded) {
      errors.push(`${locale}/index.html: the Book section QR does not decode`);
    } else if (decoded.data !== EXPECTED) {
      errors.push(
        `${locale}/index.html: the Book section QR encodes "${decoded.data}", expected "${EXPECTED}"`,
      );
    }
  }
}

/*
 * --- 6c: every photograph on the page is credited, and nothing else is ------
 *
 * Credits are per-photograph. When four images were withdrawn for carrying club
 * and brand marks, the credits page would happily have gone on naming their
 * photographers - crediting pictures that are not on the site, and implying the
 * withdrawn ones are still in use.
 *
 * SectionImage renders nothing when its file is absent, by design, so the
 * number of <figure class="section-image"> blocks on a home page is exactly the
 * number of photographs in src/assets/stock/. Tie all three together.
 */
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

    // Mirrors LEGAL_PAGES.photoCredits in src/config/site.ts, which this plain
    // node script cannot import. The 4b link check would catch a rename.
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
