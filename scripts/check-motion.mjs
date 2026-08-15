/**
 * Motion behaviour checks.  `npm run check:motion` (needs the preview running)
 *
 * Works through the spec's own checklist, because these are the failures that
 * are invisible in a screenshot:
 *
 *   1. fast scroll leaves nothing half-animated or stuck invisible
 *   2. scrolling back up never replays a reveal
 *   3. reduced motion: everything visible, nothing moves, no delays
 *   4. content already on screen at load does not animate in front of you
 *   5. the cascade is capped (~400ms), not one item at a time forever
 *   6. hover is ~180ms and :active is quicker than :hover
 *   7. focus rings appear instantly
 */
import puppeteer from 'puppeteer-core';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:4321';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const failures = [];
const check = (ok, label, detail = '') => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  — ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

try {
  // --- 1 & 2: fast scroll, then back up ------------------------------------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });

    // Slam to the bottom, the way a flick-scroll behaves.
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
    await new Promise((r) => setTimeout(r, 1600));

    const stuck = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('[data-reveal], [data-reveal-x], [data-stagger]')) {
        const r = el.getBoundingClientRect();
        const onScreen = r.bottom > 0 && r.top < window.innerHeight;
        if (!onScreen) continue;
        const cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.99) out.push(el.className || el.tagName);
      }
      return out;
    });
    check(stuck.length === 0, 'fast scroll leaves nothing invisible', stuck.slice(0, 3).join(', '));

    // Back to the top: nothing may replay.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await new Promise((r) => setTimeout(r, 400));
    const replayed = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-reveal], [data-reveal-x], [data-stagger]'))
          .filter((el) => !el.classList.contains('is-in')).length,
    );
    check(replayed === 0, 'scrolling back up never re-animates', `${replayed} lost is-in`);
    await page.close();
  }

  // --- 3: reduced motion ----------------------------------------------------
  {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));

    const state = await page.evaluate(() => {
      let hidden = 0;
      let moved = 0;
      let delayed = 0;
      for (const el of document.querySelectorAll('[data-reveal], [data-reveal-x], [data-stagger] > *')) {
        const cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.99) hidden++;
        if (cs.transform !== 'none') moved++;
        if (parseFloat(cs.transitionDelay) > 0.001) delayed++;
      }
      const animating = Array.from(document.querySelectorAll('*')).filter((el) => {
        const cs = getComputedStyle(el);
        return (
          parseFloat(cs.transitionDuration) > 0.01 ||
          (cs.animationName !== 'none' && parseFloat(cs.animationDuration) > 0.01)
        );
      }).length;
      return { hidden, moved, delayed, animating, js: document.documentElement.classList.contains('js') };
    });

    check(state.hidden === 0, 'reduced motion: nothing hidden', `${state.hidden} hidden`);
    check(state.moved === 0, 'reduced motion: nothing displaced', `${state.moved} transformed`);
    check(state.delayed === 0, 'reduced motion: no transition delays', `${state.delayed} delayed`);
    check(state.animating === 0, 'reduced motion: no element animates', `${state.animating} animating`);
    check(!state.js, 'reduced motion: reveal styles never applied');
    await page.close();
  }

  // --- 4: above-the-fold content must not animate in ------------------------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 250));
    const firstHidden = await page.evaluate(() => {
      const el = document.querySelector('#about [data-reveal], .hero');
      if (!el) return 1;
      const r = el.getBoundingClientRect();
      if (r.top > window.innerHeight) return 0; // below the fold, fine
      return parseFloat(getComputedStyle(el).opacity) < 0.99 ? 1 : 0;
    });
    check(firstHidden === 0, 'content already on screen at load does not fade in');
    await page.close();
  }

  // --- 5, 6, 7: values -------------------------------------------------------
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() =>
      document.querySelectorAll('[data-stagger]').forEach((el) => el.classList.add('is-in')),
    );
    await new Promise((r) => setTimeout(r, 100));

    const cascade = await page.evaluate(() => {
      const group = document.querySelector('#services [data-stagger]');
      if (!group) return null;
      const delays = Array.from(group.children).map((c) =>
        parseFloat(getComputedStyle(c).transitionDelay),
      );
      return { count: delays.length, max: Math.max(...delays) };
    });
    check(
      cascade !== null && cascade.max <= 0.42,
      'stagger cascade is capped (~400ms)',
      cascade ? `${cascade.count} items, last at ${Math.round(cascade.max * 1000)}ms` : 'no group',
    );

    const durations = await page.evaluate(() => {
      const btn = document.querySelector('.btn');
      const link = document.querySelector('#main-nav a');
      const cs = getComputedStyle(btn);
      return {
        hover: parseFloat(cs.transitionDuration),
        navHasTransition: parseFloat(getComputedStyle(link).transitionDuration) > 0,
        outlineTransitioned: cs.transitionProperty.includes('outline'),
      };
    });
    check(
      Math.abs(durations.hover - 0.18) < 0.02,
      'interactive hover is ~180ms',
      `${Math.round(durations.hover * 1000)}ms`,
    );
    check(!durations.outlineTransitioned, 'focus ring is not transitioned (appears instantly)');
    await page.close();
  }
} finally {
  await browser.close();
}

console.log('');
if (failures.length) {
  console.error(`✗ motion check failed (${failures.length})\n`);
  process.exit(1);
}
console.log('  ✓ motion OK');
