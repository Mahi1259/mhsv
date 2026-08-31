const fine = matchMedia('(pointer: fine)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

const scrollHandlers = new Set<() => void>();
let scrollQueued = false;

function runScrollHandlers() {
  scrollQueued = false;
  for (const handler of scrollHandlers) handler();
}

function onScroll(handler: () => void) {
  if (scrollHandlers.size === 0) {
    addEventListener(
      'scroll',
      () => {
        if (scrollQueued) return;
        scrollQueued = true;
        requestAnimationFrame(runScrollHandlers);
      },
      { passive: true },
    );
  }
  scrollHandlers.add(handler);
  handler();
}

const SHRINK_ENTER = 56;
const SHRINK_EXIT = 8;
const SHRINK_SETTLE = 560;

function initNavShrink() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;

  const desktop = matchMedia('(min-width: 62rem)');

  let shrunk = header.classList.contains('is-shrunk');
  let settle: ReturnType<typeof setTimeout>;

  const setShrunk = (next: boolean) => {
    if (next === shrunk) return;
    shrunk = next;
    header.classList.toggle('is-shrunk', next);

    if (calm) return;
    header.classList.add('is-animating');
    clearTimeout(settle);
    settle = setTimeout(() => header.classList.remove('is-animating'), SHRINK_SETTLE);
  };

  let first = true;
  const position = () => {
    if (!first) return scrollY;
    first = false;
    if (scrollY > 0 || location.hash.length < 2) return scrollY;
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    return target ? target.getBoundingClientRect().top + scrollY : scrollY;
  };

  const update = () => {
    if (!desktop.matches) {
      setShrunk(false);
      return;
    }
    const y = position();
    if (!shrunk && y > SHRINK_ENTER) setShrunk(true);
    else if (shrunk && y < SHRINK_EXIT) setShrunk(false);
  };

  desktop.addEventListener('change', update);
  onScroll(update);
}

const MAGNET = 0.18;

function initMagnetic() {
  if (!fine || calm) return;

  for (const el of document.querySelectorAll<HTMLElement>('[data-magnetic]')) {
    const reset = () => {
      el.style.transform = '';
    };

    el.addEventListener(
      'pointermove',
      (event) => {
        if (event.pointerType !== 'mouse') return;
        const r = el.getBoundingClientRect();
        const dx = (event.clientX - r.left - r.width / 2) * MAGNET;
        const dy = (event.clientY - r.top - r.height / 2) * MAGNET;
        el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
      },
      { passive: true },
    );

    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset);
  }
}

initNavShrink();
initMagnetic();
