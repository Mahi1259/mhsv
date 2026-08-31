const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('[data-lang-link]'));

if (links.length) {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id]'));

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
  // The reading line sits 30% down, not under the masthead: against the masthead
  // a section already filling the screen still counted as the previous one.
    const line = headerHeight() + window.innerHeight * 0.3;
    let found = '';
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= line) found = section.id;
      else break;
    }

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
    current = location.hash.slice(1);
    apply();
  }
}
