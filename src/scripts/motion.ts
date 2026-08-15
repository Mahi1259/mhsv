/**
 * Motion runtime: scroll reveals, staggered children, number counters.
 *
 * Reduced motion is checked FIRST and is absolute — if the user has asked for
 * less motion, nothing here runs, the `js` class is never added, and every
 * element renders in its final state. It is an accessibility requirement, not
 * a preference.
 *
 * The `js` class is what makes [data-reveal] elements start hidden (see
 * global.css). Adding it from script means content is never invisible when
 * JavaScript is unavailable or fails.
 */
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function revealAll() {
  document
    .querySelectorAll<HTMLElement>('[data-reveal]')
    .forEach((el) => el.classList.add('is-revealed'));
}

function init() {
  if (prefersReducedMotion.matches) {
    revealAll();
    return;
  }

  document.documentElement.classList.add('js');

  // Stagger children of a marked container by 70ms each.
  document.querySelectorAll<HTMLElement>('[data-stagger]').forEach((group) => {
    Array.from(group.children).forEach((child, i) => {
      (child as HTMLElement).style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
    });
    group.setAttribute('data-reveal', '');
  });

  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => {
    revealObserver.observe(el);
  });

  /**
   * Count the first number in the element's text up to its final value, once.
   * The original text is restored around the number so currency, separators
   * and the rest of the line are untouched.
   */
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (counters.length) {
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
            separator ? n.toLocaleString('fr-CH').replace(/ | |'/g, separator) : String(n);

          const duration = 900;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            el.textContent = before + format(Math.round(target * eased)) + after;
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
