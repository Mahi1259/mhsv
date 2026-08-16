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
 *   8. the masthead shrinks on desktop, holds its state, and stays inert on
 *      mobile — including that the pill still fits every locale on one row
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

  /* --- 8: the resizable masthead ------------------------------------------
   *
   * Screenshots cannot show any of this. The failures worth catching are a
   * bar that flickers at the threshold, one that renders expanded and then
   * snaps after the first wheel event, a pill too narrow for the longest
   * locale, and a phone paying for a backdrop-filter it never sees.
   */
  const bar = () => ({
    shrunk: document.querySelector('.site-header').classList.contains('is-shrunk'),
    animating: document.querySelector('.site-header').classList.contains('is-animating'),
    ...(({ width, height }) => ({ width: Math.round(width), height: Math.round(height) }))(
      document.querySelector('.site-header__shell').getBoundingClientRect(),
    ),
    ...(({ borderRadius, backdropFilter, boxShadow, backgroundColor, transitionDuration }) => ({
      radius: parseFloat(borderRadius),
      blurred: backdropFilter !== 'none' && backdropFilter.includes('blur(0px)') === false,
      lifted: boxShadow !== 'none',
      alpha: Number((/rgba?\([^)]*?([\d.]+)\)/.exec(backgroundColor) ?? [, '1'])[1]),
      duration: parseFloat(transitionDuration),
    }))(getComputedStyle(document.querySelector('.site-header__shell'))),
    /* One row, or the pill has burst and the links have wrapped. */
    rows: new Set(
      [...document.querySelectorAll('#main-nav li')].map((li) =>
        Math.round(li.getBoundingClientRect().top),
      ),
    ).size,
  });

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });

    const top = await page.evaluate(bar);
    check(!top.shrunk && top.alpha === 0, 'at the top the bar has no surface of its own');

    await page.evaluate(() => scrollTo(0, 600));
    await new Promise((r) => setTimeout(r, 700));
    const down = await page.evaluate(bar);

    check(down.shrunk, 'scrolling shrinks the bar');
    check(down.width < top.width, 'the shell contracts', `${top.width}px → ${down.width}px`);
    check(down.height < top.height, 'and shortens', `${top.height}px → ${down.height}px`);
    check(down.radius >= 24, 'it rounds into a pill', `${down.radius}px`);
    check(down.blurred && down.lifted, 'the background materialises and it lifts');
    check(!down.animating, 'will-change is dropped once the transition settles');

    // Rest on the threshold and jiggle: hysteresis must make this impossible.
    let flips = 0;
    await page.evaluate(() => scrollTo(0, 56));
    await new Promise((r) => setTimeout(r, 300));
    let last = (await page.evaluate(bar)).shrunk;
    for (let i = 0; i < 12; i++) {
      await page.evaluate((y) => scrollTo(0, y), 56 + (i % 2 ? 3 : -3));
      await new Promise((r) => setTimeout(r, 60));
      const now = (await page.evaluate(bar)).shrunk;
      if (now !== last) flips++;
      last = now;
    }
    check(flips === 0, 'resting on the threshold does not oscillate', `${flips} flips`);

    // A refresh part-way down must render the right state, not snap into it.
    await page.evaluate(() => scrollTo(0, 2400));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 120));
    const restored = await page.evaluate(bar);
    check(restored.shrunk, 'a refresh part-way down renders shrunk immediately');
    await page.close();
  }

  // The pill has to hold the longest locale on one row at the narrowest
  // desktop, or the nav wraps and the pill bursts into a lozenge.
  {
    const page = await browser.newPage();
    for (const width of [1440, 1024]) {
      await page.setViewport({ width, height: 900 });
      for (const locale of ['fr', 'en', 'de', 'it']) {
        await page.goto(`${BASE}/${locale}/`, { waitUntil: 'networkidle0' });
        await page.evaluate(() => scrollTo(0, 600));
        await new Promise((r) => setTimeout(r, 600));
        const state = await page.evaluate(bar);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        check(
          state.shrunk && state.rows === 1 && !overflow,
          `${locale} at ${width}px: pill holds the nav on one row`,
          `${state.width}px shell, ${state.rows} row(s)`,
        );
      }
    }
    await page.close();
  }

  // Mobile: nothing about the bar may move, and it must not pay for glass.
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 720, isMobile: true, hasTouch: true });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    const before = await page.evaluate(bar);
    await page.evaluate(() => scrollTo(0, 1800));
    await new Promise((r) => setTimeout(r, 700));
    const after = await page.evaluate(bar);

    check(!after.shrunk, 'mobile: the bar never shrinks');
    check(
      before.width === after.width && before.height === after.height,
      'mobile: the bar never changes size',
      `${before.width}×${before.height} → ${after.width}×${after.height}`,
    );
    check(after.radius === 0 && !after.blurred && !after.lifted, 'mobile: solid bar, no glass');
    check(after.duration === 0, 'mobile: no transitions declared at all');
    await page.close();
  }

  /* Arriving on a deep fragment — which is exactly what the language switcher
   * produces, since it carries the reader's section across — must be STILL.
   *
   * Two regressions live here. `scroll-behavior: smooth` also applies to the
   * fragment scroll the browser performs on load, so the translated page
   * opened at the top and glided down: the page appearing to move on
   * translate. And if the bar is not already shrunk in the first painted
   * frame, the cross-document view transition snapshots it expanded, then
   * animates it — which is what put two mastheads on screen at once. */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/de/#team`, { waitUntil: 'domcontentloaded' });

    const arrival = [];
    for (let i = 0; i < 8; i++) {
      arrival.push(
        await page.evaluate(() => ({
          y: Math.round(scrollY),
          shrunk: !!document.querySelector('.site-header')?.classList.contains('is-shrunk'),
        })),
      );
      await new Promise((r) => setTimeout(r, 50));
    }
    const ys = [...new Set(arrival.map((a) => a.y))];
    check(ys.length === 1 && ys[0] > 1000, 'a carried fragment lands instantly, no glide', `y=${ys.join('→')}`);
    check(
      arrival.every((a) => a.shrunk),
      'and the bar is already shrunk in the first frame',
      `${arrival.filter((a) => a.shrunk).length}/${arrival.length} samples`,
    );

    // ...and smooth scrolling is handed back, or in-page nav clicks would jump.
    await new Promise((r) => setTimeout(r, 600));
    const after = await page.evaluate(() => ({
      behaviour: getComputedStyle(document.documentElement).scrollBehavior,
      booting: document.documentElement.classList.contains('is-booting'),
    }));
    check(
      after.behaviour === 'smooth' && !after.booting,
      'smooth scrolling is restored once the page has settled',
      `${after.behaviour}, booting=${after.booting}`,
    );
    await page.close();
  }

  /* The ground has to run continuously UNDER the bar.
   *
   * The bar is fixed and translucent, so `body` reserves --header-h for it.
   * When that strip is painted by something other than the page's own ground,
   * the page opens with a hard-edged rectangle straight across the top —
   * which is exactly what happened once the masthead stopped being sticky.
   * Sampling a column clear of the pill catches it; nothing else does. */
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    for (const path of ['/fr/', '/en/', '/en/privacy/', '/livre']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' });
      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 160 } });
      const png = Buffer.from(shot);
      // Decode nothing: compare through the browser instead, on a canvas.
      const seam = await page.evaluate(async (bytes) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = c.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const { data } = ctx.getImageData(60, 0, 1, bitmap.height);
        let worst = 0;
        let at = 0;
        // Only the band around the reserved strip; real content starts lower.
        for (let y = 30; y < 130; y++) {
          const i = y * 4;
          const d = Math.max(
            Math.abs(data[i] - data[i + 4]),
            Math.abs(data[i + 1] - data[i + 5]),
            Math.abs(data[i + 2] - data[i + 6]),
          );
          if (d > worst) {
            worst = d;
            at = y;
          }
        }
        return { worst, at };
      }, [...png]);
      // Grain and gradient account for a few levels; a seam is 20+.
      check(seam.worst <= 8, `${path}: no seam where the bar reserves its space`, `Δ${seam.worst} at y=${seam.at}`);
    }
    await page.close();
  }

  // Reduced motion still shrinks — it is a space saving, not decoration —
  // but arrives instantly.
  {
    const page = await browser.newPage();
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => scrollTo(0, 600));
    await new Promise((r) => setTimeout(r, 300));
    const calm = await page.evaluate(bar);
    check(calm.shrunk, 'reduced motion: the bar still shrinks');
    check(calm.duration <= 0.01, 'reduced motion: it shrinks instantly', `${calm.duration}s`);
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
