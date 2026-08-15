/**
 * Motion runtime: scroll reveals and number counters.
 *
 * Reduced motion is checked FIRST and is absolute — if the user has asked for
 * less motion nothing here runs, the `js` class is never added, and every
 * element renders in its final state. Accessibility requirement, not a
 * preference.
 *
 * The `js` class is what makes reveal elements start hidden (see global.css).
 * Adding it from script means content is never invisible when JavaScript is
 * unavailable or fails.
 *
 * The timing values and the stagger live in CSS; this file only decides *when*
 * an element becomes `.is-in`.
 */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const REVEAL_SELECTOR = '[data-reveal], [data-reveal-x], [data-stagger]';

function revealAll() {
  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => el.classList.add('is-in'));
}

function init() {
  if (prefersReducedMotion.matches) {
    revealAll();
    return;
  }

  document.documentElement.classList.add('js');

  /*
   * Trigger EARLY. With `threshold: 0` and a negative bottom margin the reveal
   * starts as the element's top edge approaches the fold, so by the time it is
   * being looked at it has already settled. Waiting until an element is
   * properly on screen is what makes reveals something you consciously watch.
   */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        // Never re-animate: scrolling back up must not replay anything.
        revealObserver.unobserve(entry.target);
      }
    },
    { threshold: 0, rootMargin: '0px 0px -12% 0px' },
  );

  const targets = Array.from(document.querySelectorAll(REVEAL_SELECTOR));

  for (const el of targets) {
    // Anything already on screen at load has missed its entrance; show it
    // immediately rather than animating content the visitor is looking at.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
      el.classList.add('is-in');
      continue;
    }
    revealObserver.observe(el);
  }

  /**
   * Count the first number in the element's text up to its final value, once.
   * The surrounding text — currency, separators, units — is preserved.
   */
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (counters.length) {
    // easeOutExpo: fast, then a long settle. Suits a figure landing on a value.
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const countObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          countObserver.unobserve(el);

          const text = el.textContent ?? '';
          // Matches 15'000 / 15,000 / 15 000 / 40
          const match = /\d[\d'’., ]*\d|\d/.exec(text);
          if (!match) continue;

          const raw = match[0];
          const target = Number(raw.replace(/[^\d]/g, ''));
          if (!Number.isFinite(target) || target === 0) continue;

          const before = text.slice(0, match.index);
          const after = text.slice(match.index + raw.length);
          // Reuse the source's own grouping character.
          const separator = /['’., ]/.exec(raw)?.[0] ?? '';
          const format = (n: number) =>
            separator ? n.toLocaleString('fr-CH').replace(/ | |'/g, separator) : String(n);

          const duration = 1200;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            el.textContent = before + format(Math.round(target * easeOutExpo(progress))) + after;
            if (progress < 1) requestAnimationFrame(step);
            else el.textContent = text;
          };
          requestAnimationFrame(step);
        }
      },
      { threshold: 0.5 },
    );
    counters.forEach((el) => countObserver.observe(el));
  }
}

// If the preference changes mid-session, make sure nothing stays hidden.
prefersReducedMotion.addEventListener('change', (event) => {
  if (event.matches) {
    document.documentElement.classList.remove('js');
    revealAll();
  }
});

init();
