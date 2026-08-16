/**
 * Keep your place when switching language.
 *
 * The language links are plain `/de/`, `/it/` and so on, which sends a visitor
 * reading the governance section back to the top of the page in another
 * language. Because every locale uses the same section anchors, the current
 * section can simply be carried across.
 *
 * `location.hash` alone is not enough: it is only set if the visitor clicked a
 * navigation link, and is stale as soon as they scroll away. So this tracks the
 * section actually on screen.
 *
 * Progressive enhancement - without JavaScript the links still work, they just
 * land at the top of the translated page.
 */
const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]'));

if (links.length) {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'));

  /** The hero is the top of the page; no fragment needed for it. */
  const isTop = (id: string) => !id || id === 'top';

  let current = '';

  const apply = () => {
    for (const link of links) {
      const base = link.dataset.base ?? link.pathname;
      link.href = isTop(current) ? base : `${base}#${current}`;
    }
  };

  const headerHeight = () =>
    document.querySelector<HTMLElement>('.site-header')?.getBoundingClientRect().height ?? 0;

  const measure = () => {
    /*
     * Sections are in document order, so the last one whose top has passed the
     * reading line is the one being read.
     *
     * The line sits ~30% down the viewport, not directly under the masthead.
     * Against the masthead, a section that already fills most of the screen
     * would still count as the *previous* one, and switching language from it
     * jumped a section backwards.
     */
    const line = headerHeight() + window.innerHeight * 0.3;
    let found = '';
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) found = section.id;
      else break;
    }

    // Near the bottom the last section may never cross the line; treat the
    // final section as current so the deepest anchor still carries over.
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2 && sections.length) {
      found = sections[sections.length - 1].id;
    }

    if (found !== current) {
      current = found;
      apply();
    }
  };

  if (sections.length) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        measure();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('hashchange', measure);
    measure();
  } else if (location.hash) {
    // Sub-pages have no sections; carry an explicit fragment if there is one.
    current = location.hash.slice(1);
    apply();
  }
}
