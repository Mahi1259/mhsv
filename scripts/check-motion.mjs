import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:4321';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const failures = [];
const check = (ok, label, detail = '') => {
  if (!ok) failures.push(label);
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? `  - ${detail}` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox'],
});

try {
  {
    const warm = await browser.newPage();
    await warm.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    await warm.close();
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });

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

    let settled = true;
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll('[data-reveal], [data-reveal-x], [data-stagger]'))
            .every((el) => el.classList.contains('is-in')),
        { timeout: 20000 },
      )
      .catch(() => {
        settled = false;
      });

    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await new Promise((r) => setTimeout(r, 400));
    const replayed = await page.evaluate(
      () =>
        Array.from(document.querySelectorAll('[data-reveal], [data-reveal-x], [data-stagger]'))
          .filter((el) => !el.classList.contains('is-in')).length,
    );
    check(
      settled,
      'everything is marked before scrolling back',
      settled ? '' : 'the observer never settled - the result below cannot be trusted',
    );
    check(replayed === 0, 'scrolling back up never re-animates', `${replayed} lost is-in`);
    await page.close();
  }

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

    await page.evaluate(() => scrollTo(0, 2400));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await new Promise((r) => setTimeout(r, 120));
    const restored = await page.evaluate(bar);
    check(restored.shrunk, 'a refresh part-way down renders shrunk immediately');
    await page.close();
  }

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

  {
    const page = await browser.newPage();
    const lang = () =>
      page.evaluate(() => {
        const shown = (el) =>
          !!el && el.checkVisibility({ checkVisibilityCSS: true, contentVisibilityAuto: true });
        const links = [...document.querySelectorAll('.lang a')];
        return {
          codes: links.filter(shown).length,
          width: Math.round(document.querySelector('.lang').getBoundingClientRect().width),
        };
      });

    const focusableInLang = async () => {
      await page.evaluate(() => document.querySelector('.brand').focus());
      let found = 0;
      for (let i = 0; i < 20; i++) {
        await page.keyboard.press('Tab');
        const where = await page.evaluate(() => {
          const el = document.activeElement;
          if (!el || !el.closest('.site-header')) return 'out';
          return el.closest('.lang') ? 'lang' : 'header';
        });
        if (where === 'out') break;
        if (where === 'lang') found += 1;
      }
      return found;
    };

    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    const top = await lang();
    check(top.codes === 4, 'all four codes are offered at full width', `${top.width}px`);
    check((await focusableInLang()) === 4, 'and all four are reachable by keyboard there');

    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      scrollTo(0, 900);
    });
    await new Promise((r) => setTimeout(r, 800));
    const small = await lang();
    check(
        small.codes === 4,
        'the shrunk bar still offers every language',
        `${top.width}px → ${small.width}px, ${small.codes} visible`,
      );
    check(
        (await focusableInLang()) === 4,
        'and all four are still reachable by keyboard once shrunk',
        'the client reported EN present but unclickable here',
      );

    await page.evaluate(() => scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 800));
    const back = await lang();
    check(back.codes === 4, 'and it is unchanged back at the top');

    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.goto(`${BASE}/de/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => scrollTo(0, 1500));
    await new Promise((r) => setTimeout(r, 700));
    const mobile = await lang();
    check(mobile.codes === 4, 'mobile: the switcher stays available throughout');
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const cdp = await page.createCDPSession();
    const frames = [];
    await cdp.send('Page.startScreencast', { format: 'png', maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
    cdp.on('Page.screencastFrame', async (f) => {
      frames.push(f.data);
      try {
        await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
      } catch {
      }
    });

    await page.goto(`${BASE}/fr/`, { waitUntil: 'networkidle0' });
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      const team = document.querySelector('#team');
      scrollTo(0, team.getBoundingClientRect().top + scrollY + 300);
    });
    await new Promise((r) => setTimeout(r, 800));

    const pill = await page.evaluate(() => {
      const r = document.querySelector('.site-header__shell').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });

    const label = await page.evaluate(() => {
      const r = document.querySelector('.lang').getBoundingClientRect();
      return {
        x: Math.floor(r.left), y: Math.floor(r.top),
        w: Math.ceil(r.width), h: Math.ceil(r.height),
      };
    });

    frames.length = 0;
    await page.evaluate(() => {
      const href = document.querySelector('.lang a[hreflang="de"]').href;
      location.href = href;
    });
    await new Promise((r) => setTimeout(r, 2000));
    await cdp.send('Page.stopScreencast');

    const lefts = [];
    const rights = [];
    const inkPerFrame = new Set();
    let barless = 0;
    for (const encoded of frames) {
      const { data, info } = await sharp(Buffer.from(encoded, 'base64'))
        .raw()
        .toBuffer({ resolveWithObject: true });
      const at = (x, y) => {
        const i = (y * info.width + x) * info.channels;
        return [data[i], data[i + 1], data[i + 2]];
      };
      const edge = (centre) => {
        let best = 0;
        let found = 0;
        for (let x = centre - 25; x < centre + 25; x++) {
          const a = at(x, 60);
          const c = at(x + 1, 60);
          const d = Math.max(...[0, 1, 2].map((k) => Math.abs(a[k] - c[k])));
          if (d > best) {
            best = d;
            found = x;
          }
        }
        return best < 8 ? 'none' : found;
      };
      lefts.push(edge(pill.left));
      rights.push(edge(pill.right));

      let gold = 0;
      for (let x = label.x; x < label.x + label.w; x++) {
        for (let y = label.y; y < label.y + label.h; y++) {
          const c = at(x, y);
          if (c[0] > 110 && c[1] > 85 && c[0] > c[2] + 40) gold += 1;
        }
      }
      if (gold === 0) barless += 1;

      let row = '';
      for (let x = 340; x < 1060; x += 2) row += at(x, 39)[0] > 120 ? '1' : '0';
      inkPerFrame.add(row);
    }

    const settled = await page.evaluate(() => {
      const r = document.querySelector('.site-header__shell').getBoundingClientRect();
      return { left: Math.round(r.left), right: Math.round(r.right) };
    });
    const spread = (xs) => {
      const ns = xs.filter((x) => x !== 'none');
      return ns.length === xs.length ? Math.max(...ns) - Math.min(...ns) : Infinity;
    };
    const ml = lefts[0];

    check(frames.length > 3, 'language switch: frames captured', `${frames.length}`);
    check(
      inkPerFrame.size <= 2,
      'no half-drawn frame: every frame shows one page or the other',
      `${inkPerFrame.size} distinct nav row(s)`,
    );
    check(
      spread(lefts) <= 2 && spread(rights) <= 2,
      'the bar never changes size mid-switch',
      `left ±${spread(lefts)}px, right ±${spread(rights)}px over ${frames.length} frames`,
    );
    check(
      ml !== 'none' && Math.abs(Number(ml) - settled.left) <= 12,
      'and that size is the settled one, from the first frame',
      `measured ${ml}, settled ${settled.left}`,
    );
    check(barless === 0, 'the bar is present in every frame', `${barless} without it`);
    await page.close();
  }

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

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    for (const path of ['/fr/', '/en/', '/de/', '/it/']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' });
      const painted = await page.evaluate(() => {
        const found = [];
        for (const el of document.querySelectorAll('*')) {
          const bg = getComputedStyle(el, '::before').backgroundImage;
          const navy = bg && bg.includes('20, 40, 74');
          const stacked = navy && (bg.match(/radial-gradient\(/g) || []).length >= 3;
          if (stacked) found.push(el.className || el.tagName);
        }
        return found;
      });
      check(
        painted.length === 1 && String(painted[0]).includes('page-flow'),
        `${path}: the page washes are painted once, on the page container`,
        painted.join(', ') || 'nowhere',
      );
    }
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    for (const path of ['/fr/', '/en/', '/en/data-protection/', '/livre']) {
      const response = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0' });
      if (response && response.status() >= 400) {
        check(false, `${path}: page exists`, `HTTP ${response.status()}`);
        continue;
      }
      const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 200, height: 160 } });
      const png = Buffer.from(shot);
      const seam = await page.evaluate(async (bytes) => {
        const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
        const c = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = c.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        const { data } = ctx.getImageData(60, 0, 1, bitmap.height);
        let worst = 0;
        let at = 0;
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
      check(seam.worst <= 8, `${path}: no seam where the bar reserves its space`, `Δ${seam.worst} at y=${seam.at}`);
    }
    await page.close();
  }

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
