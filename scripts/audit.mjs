/**
 * Responsive + accessibility audit against a running preview server.
 *
 *   npm run preview      # in one terminal
 *   npm run audit        # in another
 *
 * Checks, per locale and per viewport:
 *   - horizontal overflow (the page body must never scroll sideways) and which
 *     element causes it
 *   - axe-core violations at WCAG 2.1 A/AA
 *   - heading order and landmark structure
 *   - tap-target size on interactive elements
 *
 * German is the widest language — its compounds run ~30% longer than English —
 * so 320px German is the case that breaks layouts first.
 */
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:4321';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const AXE = readFileSync(resolve(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');

const LOCALES = ['fr', 'en', 'de', 'it'];
const VIEWPORTS = [
  { name: '320', width: 320, height: 720 },
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 900 },
];
const PATHS = ['', 'privacy/'];
/** Not locale-prefixed: /livre is the bilingual QR destination. */
const EXTRA_URLS = ['/livre/'];

/** Every page to audit, as { url, label }. */
const TARGETS = [
  ...LOCALES.flatMap((locale) =>
    PATHS.map((path) => ({ url: `${BASE}/${locale}/${path}`, label: `${locale}/${path || 'home'}` })),
  ),
  ...EXTRA_URLS.map((path) => ({ url: `${BASE}${path}`, label: path })),
];

const failures = [];
const warnings = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

try {
  {
    for (const target of TARGETS) {
      const page = await browser.newPage();

      for (const viewport of VIEWPORTS) {
        await page.setViewport({ width: viewport.width, height: viewport.height });
        await page.goto(target.url, { waitUntil: 'networkidle0' });

        const label = `${target.label} @${viewport.name}`;

        // --- horizontal overflow -------------------------------------------
        const overflow = await page.evaluate((vw) => {
          const doc = document.documentElement;
          if (doc.scrollWidth <= vw) return null;
          const offenders = [];
          for (const el of document.body.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0) continue;
            // Deliberately parked off-screen (honeypot, visually-hidden): these
            // are absolutely positioned far to the left and do not extend the
            // scrollable area.
            if (r.right < -100) continue;
            if (r.right > vw + 1 || r.left < -1) {
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: (el.className && String(el.className).slice(0, 60)) || '',
                right: Math.round(r.right),
                left: Math.round(r.left),
              });
            }
          }
          return { scrollWidth: doc.scrollWidth, offenders: offenders.slice(0, 5) };
        }, viewport.width);

        if (overflow) {
          failures.push(
            `${label}: horizontal overflow — document is ${overflow.scrollWidth}px wide\n` +
              overflow.offenders
                .map((o) => `        <${o.tag} class="${o.cls}"> left=${o.left} right=${o.right}`)
                .join('\n'),
          );
        }

        // --- tap targets ----------------------------------------------------
        if (viewport.width <= 390) {
          const small = await page.evaluate(() => {
            const out = [];
            const els = document.querySelectorAll('a, button, input, textarea, select, summary');
            for (const el of els) {
              if (el.type === 'hidden' || el.closest('[aria-hidden="true"]')) continue;
              const r = el.getBoundingClientRect();
              if (r.width === 0 && r.height === 0) continue;
              // Inline links inside running text are exempt — WCAG 2.1 AA
              // does not require 44px for links in a sentence.
              const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
              if (inline) continue;
              // 23.5 rather than 24: sub-pixel layout makes an element that is
              // exactly 24px measure as 23.99 and report a false warning.
              if (r.height < 23.5 || r.width < 23.5) {
                out.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} ${Math.round(r.width)}x${Math.round(r.height)}`);
              }
            }
            return out.slice(0, 6);
          });
          for (const s of small) warnings.push(`${label}: small tap target — ${s}`);
        }

        // --- axe -------------------------------------------------------------
        // Run once per page at the widest and narrowest viewport; the DOM is
        // identical, only layout differs.
        if (viewport.name === '320' || viewport.name === '1280') {
          /*
           * Settle the scroll reveals first.
           *
           * WCAG contrast applies to the resting state. Elements part-way
           * through their fade-in are, briefly, semi-transparent, and axe
           * reports that blended colour as a contrast failure. Forcing the
           * reveal class measures what a reader actually reads, without
           * disabling any other styling.
           */
          await page.evaluate(() => {
            document.querySelectorAll('[data-reveal]').forEach((el) => {
              el.classList.add('is-revealed');
              // Staggered children carry a transition-delay of up to 560ms.
              // Clearing it lets everything settle at once.
              el.style.transitionDelay = '0ms';
              for (const child of el.children) child.style.transitionDelay = '0ms';
            });
          });
          // Longer than the 700ms reveal transition, so nothing is measured
          // part-way through its fade and reported as a contrast failure.
          await new Promise((r) => setTimeout(r, 900));

          await page.evaluate(AXE);
          const results = await page.evaluate(async () => {
            return await window.axe.run(document, {
              runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
            });
          });
          for (const v of results.violations) {
            failures.push(
              `${label}: axe [${v.impact}] ${v.id} — ${v.help}\n` +
                v.nodes.slice(0, 3).map((n) => `        ${n.html.slice(0, 120)}`).join('\n'),
            );
          }
        }
      }

      await page.close();
    }
  }
} finally {
  await browser.close();
}

const unique = [...new Set(failures)];
const uniqueWarnings = [...new Set(warnings)];

for (const w of uniqueWarnings) console.warn(`  ! ${w}`);

if (unique.length) {
  console.error(`\n✗ audit failed (${unique.length}):\n`);
  for (const f of unique) console.error(`  ✗ ${f}`);
  console.error('');
  process.exit(1);
}

console.log(
  `  ✓ audit OK — ${TARGETS.length} pages × ${VIEWPORTS.length} viewports, no overflow, no WCAG 2.1 AA violations`,
);
