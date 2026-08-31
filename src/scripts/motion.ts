const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const REVEAL_SELECTOR = '[data-reveal], [data-reveal-x], [data-stagger], [data-reveal-lines]';

function revealAll() {
  document.querySelectorAll(REVEAL_SELECTOR).forEach((el) => el.classList.add('is-in'));
}

function init() {
  if (prefersReducedMotion.matches) {
    revealAll();
    return;
  }

  document.documentElement.classList.add('js');

  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      }
    },
    { threshold: 0, rootMargin: '0px 0px -12% 0px' },
  );

  const targets = Array.from(document.querySelectorAll(REVEAL_SELECTOR));

  for (const el of targets) {
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9 && rect.bottom > 0) {
      el.classList.add('is-in');
      continue;
    }
    revealObserver.observe(el);
  }

  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (counters.length) {
    const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

    const countObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          countObserver.unobserve(el);

          const text = el.textContent ?? '';
          const match = /\d[\d'’., ]*\d|\d/.exec(text);
          if (!match) continue;

          const raw = match[0];
          const target = Number(raw.replace(/[^\d]/g, ''));
          if (!Number.isFinite(target) || target === 0) continue;

          const before = text.slice(0, match.index);
          const after = text.slice(match.index + raw.length);
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

prefersReducedMotion.addEventListener('change', (event) => {
  if (event.matches) {
    document.documentElement.classList.remove('js');
    revealAll();
  }
});

init();
