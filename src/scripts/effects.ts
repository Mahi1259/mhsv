/**
 * Masthead shrink, and magnetic buttons.
 *
 * ONE passive, rAF-throttled scroll listener for the page - see `onScroll`.
 * There is no longer an animation loop here: the cursor-following floodlight
 * was the only thing that needed one, and nothing that remains animates from
 * JavaScript. Do not reintroduce a loop without a reason.
 *
 * Under reduced motion, or on a touch device where there is no cursor, the
 * pointer effect is not registered at all.
 */
const fine = matchMedia('(pointer: fine)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------------------
   One scroll listener for the page, rAF-throttled and passive.

   Several things react to scroll position; each adding its own listener means
   several handlers competing for the same frame. Registering here gives one
   listener, one frame, and one place to keep `passive: true` - which is what
   stops scrolling being blocked on the main thread.

   The callback also fires immediately on registration, so a page loaded or
   refreshed part-way down renders the correct state instead of snapping into
   it on the first wheel event.
   --------------------------------------------------------------------------- */
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

/* ---------------------------------------------------------------------------
   Shrink the masthead on scroll - desktop only

   Past the entry threshold the shell contracts into a floating pill. This adds
   the class; src/components/Header.astro does the rest.

   Two thresholds, not one. With a single threshold a visitor resting exactly
   on it gets the bar flapping between states on every micro-scroll; 60px of
   hysteresis makes that impossible.

   The entry point is deliberately shorter than the masthead. The expanded bar
   has no background of its own, so it must have materialised before page text
   can reach the row the nav links sit on - measured at 72px of scroll.

   This runs under reduced motion. The shrink is a functional space saving, and
   the global stylesheet already collapses the durations to nothing, so it
   simply happens instantly.
   --------------------------------------------------------------------------- */
const SHRINK_ENTER = 56;
const SHRINK_EXIT = 8;
/** Must outlast the longest transition in the header (480ms). */
const SHRINK_SETTLE = 560;

function initNavShrink() {
  const header = document.querySelector<HTMLElement>('.site-header');
  if (!header) return;

  // The same breakpoint at which the inline nav exists at all. Below it there
  // is nothing to contract into, translucency costs legibility over content,
  // and backdrop-filter is the most expensive property on a mobile GPU.
  const desktop = matchMedia('(min-width: 62rem)');

  // Adopt whatever the inline script in Base.astro already decided, rather
  // than assuming expanded and toggling the bar back and forth on arrival.
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

  /*
   * Where the page is about to be, not only where it is.
   *
   * On arrival the browser has not necessarily applied the fragment scroll
   * yet, so `scrollY` still reads 0 while the document is about to land deep
   * in the page - which is exactly the case a language switch produces, since
   * it carries the current section across as a fragment. Reading the target
   * instead keeps this agreeing with the inline script in Base.astro, which
   * has already set the state from the same fragment before first paint.
   */
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

  // Without this, rotating a phone to landscape or dragging a desktop window
  // across the breakpoint leaves the bar stuck in the wrong state.
  desktop.addEventListener('change', update);
  onScroll(update);
}

/* ---------------------------------------------------------------------------
   Magnetic buttons

   Primary calls to action only. 0.18 is the ceiling: above it the button
   drifts away from where the visitor actually clicked, which is worse than no
   effect at all.
   --------------------------------------------------------------------------- */
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
    // A keyboard user never triggers pointermove; make sure focus is neutral.
    el.addEventListener('blur', reset);
  }
}

initNavShrink();
initMagnetic();
