/**
 * Responsive sweep.  `npm run qa` (needs `npm run preview` running)
 *
 * Every page, every locale, every breakpoint in the QA brief. The audit script
 * covers a handful of pages for accessibility; this one is about layout, and it
 * checks the things a screenshot review would catch by eye - overflow, clipping,
 * overlap, tap targets - at widths nobody opens by hand.
 *
 * Findings are printed as a table and the process exits non-zero if any blocker
 * is found.
 */
import puppeteer from 'puppeteer-core';

const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = (process.env.QA_BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');

const WIDTHS = [320, 360, 390, 414, 768, 820, 1024, 1112, 1280, 1366, 1440, 1920];
const LOCALES = ['fr', 'en', 'de', 'it'];

/** Per-locale slugs, mirroring LEGAL_PAGES in src/config/site.ts. */
const SLUGS = {
  fr: ['mentions-legales', 'protection-des-donnees', 'cookies', 'formulaires', 'credits-photos'],
  en: ['legal-notice', 'data-protection', 'cookies', 'forms', 'photo-credits'],
  de: ['legal-notice', 'data-protection', 'cookies', 'forms', 'bildnachweise'],
  it: ['legal-notice', 'data-protection', 'cookies', 'forms', 'crediti-foto'],
};
const RESULTS = ['message-sent', 'message-error', 'order-sent', 'newsletter-sent'];

const pages = [{ url: '/livre', name: '/livre' }];
for (const loc of LOCALES) {
  pages.push({ url: `/${loc}/`, name: `/${loc}/` });
  for (const s of SLUGS[loc]) pages.push({ url: `/${loc}/${s}/`, name: `/${loc}/${s}/` });
  for (const s of RESULTS) pages.push({ url: `/${loc}/${s}/`, name: `/${loc}/${s}/` });
}

const findings = [];
const add = (page, width, issue, severity = 'blocker') =>
  findings.push({ page, width, issue, severity });

/** Runs in the page. Returns everything measurable in one round trip. */
function inspect() {
  const doc = document.documentElement;
  const vw = doc.clientWidth;

  const visible = (el) => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  // 1. horizontal overflow, and what is causing it
  const overflow = doc.scrollWidth > doc.clientWidth + 1;
  const spilling = [];
  if (overflow) {
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) {
        const s = getComputedStyle(el);
        if (s.position === 'fixed') continue;
        spilling.push(
          `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} (${Math.round(r.left)}..${Math.round(r.right)})`,
        );
        if (spilling.length >= 3) break;
      }
    }
  }

  // 2. tap targets - interactive things too small to hit on a touch screen
  const small = [];
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, [role="button"]')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    // Inline links inside a paragraph are exempt: they are text, not controls.
    const inProse = el.closest('p, li.notice__list li, .notice__p, .prose-body');
    if (inProse && el.tagName === 'A') continue;
    if (r.width < 24 || r.height < 24) {
      small.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} ${Math.round(r.width)}x${Math.round(r.height)}`);
      if (small.length >= 3) break;
    }
  }

  // 3. text clipped by its own container
  const clipped = [];
  for (const el of document.querySelectorAll('h1, h2, h3, h4, p, a, span, li, button, label')) {
    if (!visible(el)) continue;
    // Screen-reader-only text is clipped to 1px on purpose - that IS the
    // pattern, and reporting it buried the real findings under 492 copies of
    // itself on the first run.
    if (el.closest('.visually-hidden, .sr-only')) continue;
    const s = getComputedStyle(el);
    if (s.overflow === 'visible' || el.children.length) continue;
    if (el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2) {
      clipped.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      if (clipped.length >= 3) break;
    }
  }

  // 4. the language switcher: all four, visible and hit-testable
  const langs = [...document.querySelectorAll('.lang a')].filter(visible);
  const langHits = langs.filter((a) => {
    const r = a.getBoundingClientRect();
    const t = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return t && (t === a || a.contains(t));
  }).length;

  // 5. the masthead: shrinks on desktop only
  const header = document.querySelector('.site-header');

  // 6. governance cards - how many per row, and is the last row an orphan
  const teamCards = [...document.querySelectorAll('.team__card')].filter(visible);
  const rowTops = [...new Set(teamCards.map((c) => Math.round(c.getBoundingClientRect().top)))];
  const perRow = rowTops.length ? teamCards.length / rowTops.length : 0;
  const lastRow = rowTops.length
    ? teamCards.filter((c) => Math.round(c.getBoundingClientRect().top) === rowTops[rowTops.length - 1]).length
    : 0;

  // 7. collection boards - contained, not cropped
  const boardsCropped = [...document.querySelectorAll('.identity__board')].filter((tile) => {
    const img = tile.querySelector('img');
    if (!img) return false;
    const t = tile.getBoundingClientRect(), i = img.getBoundingClientRect();
    return i.height > t.height + 1 || i.width > t.width + 1;
  }).length;

  // 8. the cookie notice must not cover its own button or the footer controls
  const notice = document.querySelector('[data-cookie]');
  let noticeCovers = null;
  if (notice && !notice.hidden) {
    const accept = notice.querySelector('[data-cookie-accept]');
    const r = accept.getBoundingClientRect();
    const t = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    noticeCovers = !(t && (t === accept || accept.contains(t)));
  }

  // 9. forms - fields and submit reachable
  const formIssues = [];
  for (const form of document.querySelectorAll('form[data-form]')) {
    for (const field of form.querySelectorAll('input:not([type=hidden]), select, textarea')) {
      if (field.closest('.form__trap')) continue;
      if (!visible(field)) { formIssues.push(`${form.dataset.form}: ${field.name} not visible`); continue; }
      const r = field.getBoundingClientRect();
      if (r.right > vw + 1 || r.left < -1) formIssues.push(`${form.dataset.form}: ${field.name} off-screen`);
    }
    const submit = form.querySelector('button[type=submit], button:not([type])');
    if (submit && !visible(submit)) formIssues.push(`${form.dataset.form}: submit not visible`);
  }

  // 10. video frame
  const video = document.querySelector('video');
  let videoIssue = null;
  if (video) {
    const r = video.getBoundingClientRect();
    if (r.right > vw + 1) videoIssue = 'video wider than viewport';
  }

  return {
    overflow, spilling, small, clipped,
    langCount: langs.length, langHits,
    shrunk: header ? header.classList.contains('is-shrunk') : null,
    teamCards: teamCards.length, teamRows: rowTops.length, teamLastRow: lastRow, perRow,
    boardsCropped, noticeCovers, formIssues,
    videoIssue,
    scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth,
  };
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => add('(console)', '-', `page error: ${e.message.slice(0, 80)}`));

let checked = 0;
for (const { url, name } of pages) {
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 900, isMobile: width < 768 });
    await page.goto(BASE + url, { waitUntil: 'networkidle0' });
    // Dismiss the notice so it does not mask the page, except where we test it.
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
    });
    const r = await page.evaluate(inspect);
    checked += 1;

    if (r.overflow) {
      add(name, width, `horizontal overflow ${r.scrollWidth}>${r.clientWidth}: ${r.spilling.join('; ') || 'source not identified'}`);
    }
    if (r.small.length) add(name, width, `tap target under 24px: ${r.small.join('; ')}`, width < 768 ? 'blocker' : 'minor');
    if (r.clipped.length) add(name, width, `clipped text: ${r.clipped.join('; ')}`, 'minor');
    if (r.langCount && r.langCount !== 4) add(name, width, `language switcher shows ${r.langCount} of 4`);
    if (r.langCount && r.langHits !== r.langCount) add(name, width, `${r.langCount - r.langHits} language link(s) not clickable`);
    if (r.boardsCropped) add(name, width, `${r.boardsCropped} collection board(s) cropped`);
    if (r.noticeCovers) add(name, width, 'cookie notice covers its own accept button');
    if (r.formIssues.length) add(name, width, r.formIssues.join('; '));
    if (r.videoIssue) add(name, width, r.videoIssue);
    if (r.teamCards === 6 && r.teamRows > 1 && r.teamLastRow === 1 && r.perRow > 1) {
      add(name, width, `governance: last row has 1 orphan card (${r.teamRows} rows)`, 'minor');
    }
  }
}
await browser.close();

console.log(`\n  swept ${checked} page/width combinations across ${pages.length} pages\n`);

if (!findings.length) {
  console.log('  ✓ responsive QA OK - no issues found');
} else {
  const blockers = findings.filter((f) => f.severity === 'blocker');
  console.log('  | Page | Width | Issue | Severity |');
  console.log('  | --- | --- | --- | --- |');
  for (const f of findings) console.log(`  | ${f.page} | ${f.width} | ${f.issue} | ${f.severity} |`);
  console.log(`\n  ${blockers.length} blocker(s), ${findings.length - blockers.length} minor`);
  if (blockers.length) process.exit(1);
}
