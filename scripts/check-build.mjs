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
   * The two supplied legal notices are the exemption, and a narrow one.
   *
   * MHSV® supplied both texts for these URLs and both name "MHSV Association" -
   * as the data controller in one, as the site's publisher in the other. Neither
   * document can identify it any other way. Both carry a banner saying they are
   * pending final validation, and neither banner may be removed.
   *
   * The ban stands everywhere else: the home documents, the footer, the hero
   * status line. Exempting the whole build instead of these pages would have
   * thrown away the guard that keeps association status off the site.
   */
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

  /*
   * 22 sections, always.
   *
   * "They Support MHSV®" used to render nothing while its profiles array was
   * empty, so this was derived - 21 or 22 depending on the content. The 28
   * August brief changed that: the section now always renders, showing its
   * introduction, its status badge and a way to get in touch even with no
   * profiles, because a reader looking for how to support MHSV® should find
   * something. So the count is fixed again, and adding a profile does not
   * change it.
   */
  const EXPECTED_SECTIONS = 22;

  const sections = html.match(/<section[^>]*aria-labelledby=/g) ?? [];
  if (sections.length !== EXPECTED_SECTIONS) {
    errors.push(
      `${locale}/index.html: ${sections.length} labelled sections, expected ${EXPECTED_SECTIONS}`,
    );
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
 * --- 6b: no QR code is displayed on the site -------------------------------
 *
 * MHSV® confirmed on 27 August that the QR is for business cards pointing at
 * www.mhsv.ch and was never asked for on the website. The Book section briefly
 * carried one; this makes sure it does not come back unnoticed.
 *
 * The print assets in qr/ are unaffected - they are deliberately outside
 * public/, so they never enter the build. This checks the built pages only.
 */
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

/*
 * --- 6d: individual addresses stay inside Governance ------------------------
 *
 * Martial's 27 August instruction, widened by the 28 August one: the six
 * committee members now have their own institutional addresses, and those may
 * appear in exactly one place - their card in the Governance section. Every
 * other page, the footer and all three forms carry infos@mhsv.ch and nothing
 * else. His phone number appears nowhere at all; it was published in the
 * Contact section of all four languages until that instruction.
 *
 * Matched by SHAPE rather than by a list of names, so a seventh member added
 * later is covered without anyone remembering to update this: initial-dot-
 * surname at mhsv.ch. infos@ does not match, which is the point.
 *
 * Checked against built HTML rather than the content files, because it is the
 * rendered page that leaks.
 */
{
  const INDIVIDUAL = /\b[a-z]\.[a-z-]+@mhsv\.ch\b/g;

  for (const file of textFiles.filter((f) => extname(f) === '.html')) {
    const name = relative(DIST, file);
    const html = readFileSync(file, 'utf8');

    // No phone number, anywhere. `tel:` covers the link, the digits cover the
    // text - the number was published as both.
    const tel = /tel:\+?[\d\s.-]{6,}/.exec(html);
    if (tel) errors.push(`${name}: publishes a phone link "${tel[0].trim()}"`);
    const digits = /\+41[\s.-]?\d[\s.-]?\d{2}([\s.-]?\d{2}){3}/.exec(html);
    if (digits) errors.push(`${name}: publishes a phone number "${digits[0]}"`);

    const found = [...new Set(html.match(INDIVIDUAL) ?? [])];
    if (!found.length) continue;

    // Only the home documents carry the Governance section at all.
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
      // mailto: href + link text = 2. Anything more is a second place.
      const count = (html.match(new RegExp(escaped, 'g')) ?? []).length;
      if (!inCard) {
        errors.push(`${name}: ${address} appears outside the Governance card`);
      } else if (count > 2) {
        errors.push(`${name}: ${address} appears ${count}x, expected only the Governance card`);
      }
    }
  }
}

/*
 * --- 6f: a deployed build may never canonicalise to localhost --------------
 *
 * The first Cloudflare deploy built with no PUBLIC_SITE_URL. site-url.mjs knew
 * about Vercel's variables and not Cloudflare's, so it fell through to the
 * local default and produced 41 pages whose canonical, hreflang, Open Graph
 * URLs and sitemap entries all pointed at http://localhost:4321. Every check
 * passed: nothing about that output looks wrong until it is live.
 *
 * Only fires in CI. A local build canonicalising to localhost is correct, and
 * failing it would just make `npm run build` unusable on a laptop.
 */
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

/*
 * --- 6g: the three marks are not interchangeable ---------------------------
 *
 * MHSV®'s own usage note is explicit, and each rule is easy to break by
 * reaching for whichever logo import is nearest:
 *
 *   Focus mark      collection brand ONLY - never the site identity, never
 *                   the header
 *   institutional   documents, presentations, institutional contexts - and
 *                   NEVER on collection clothing
 *
 * Checked in the SOURCE rather than the build, because that is where the rule
 * is broken: an import in the wrong component. Hashed filenames in dist/ say
 * nothing about intent.
 */
{
  const SOURCE = resolve(ROOT, 'src');
  const sourceFiles = walk(SOURCE).filter((f) => /\.(astro|ts|tsx)$/.test(f));

  // Where each mark is allowed to be imported at all.
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

  // The header is the one place named in the instruction, so name it back.
  const header = readFileSync(resolve(SOURCE, 'components/Header.astro'), 'utf8');
  for (const banned of ['mhsv-focus', 'mhsv-institutional']) {
    if (header.includes(banned)) {
      errors.push(`Header.astro references "${banned}" - the header carries the shield and nothing else`);
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
