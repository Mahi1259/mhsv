/**
 * Ambient effects: floodlight, scroll progress, magnetic buttons.
 *
 * ONE requestAnimationFrame loop for the entire site. Each effect registers a
 * step function; the loop runs only while at least one of them still has work
 * and stops itself as soon as they are all settled, so an idle page costs
 * nothing. Never add a second loop.
 *
 * Everything here is decorative. Under reduced motion, or on a touch device
 * where there is no cursor to follow, nothing is registered at all — the CSS
 * already hides the elements, and this makes sure the work is not done either.
 */
type Step = () => boolean;

const steps = new Set<Step>();
let frame: number | null = null;

function tick() {
  frame = null;
  let again = false;
  for (const step of steps) {
    // A step returns true while it still has something to animate.
    if (step()) again = true;
  }
  if (again) frame = requestAnimationFrame(tick);
}

/** Ask the shared loop to run. Safe to call as often as you like. */
function wake() {
  if (frame === null) frame = requestAnimationFrame(tick);
}

const fine = matchMedia('(pointer: fine)').matches;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------------------
   Floodlight

   A soft gold light that follows the cursor with weight. MHSV's own executive
   summary shows a player under stadium floodlights, so a moving light source
   is the brand's imagery rather than a borrowed effect.

   The lag factor is what decides whether this reads as atmosphere or as a
   gimmick: glued to the cursor it is a toy, drifting behind it, it is light.
   --------------------------------------------------------------------------- */
const LAG = 0.055;

function initFloodlight() {
  const light = document.querySelector<HTMLElement>('.floodlight');
  if (!light || !fine || calm) return;

  let targetX = innerWidth / 2;
  let targetY = innerHeight / 2;
  let x = targetX;
  let y = targetY;

  const step: Step = () => {
    x += (targetX - x) * LAG;
    y += (targetY - y) * LAG;
    light.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    // Settled: stop asking for frames.
    return Math.abs(targetX - x) > 0.4 || Math.abs(targetY - y) > 0.4;
  };
  steps.add(step);

  addEventListener(
    'pointermove',
    (event) => {
      if (event.pointerType !== 'mouse') return;
      targetX = event.clientX;
      targetY = event.clientY;
      light.classList.add('is-lit');
      wake();
    },
    { passive: true },
  );

  document.addEventListener('pointerleave', () => light.classList.remove('is-lit'));
  addEventListener('blur', () => light.classList.remove('is-lit'));
}

/* ---------------------------------------------------------------------------
   Scroll progress

   scaleX, never width: animating width relayouts the element every frame.
   On a 21-section page this earns its place — it tells the visitor how much
   of a long document is left.
   --------------------------------------------------------------------------- */
function initScrollProgress() {
  const bar = document.querySelector<HTMLElement>('.scroll-progress__bar');
  if (!bar || calm) return;

  let pending = false;
  const update = () => {
    pending = false;
    const max = document.documentElement.scrollHeight - innerHeight;
    const ratio = max > 0 ? Math.min(scrollY / max, 1) : 0;
    bar.style.transform = `scaleX(${ratio})`;
  };

  addEventListener(
    'scroll',
    () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  addEventListener('resize', update, { passive: true });
  update();
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

initFloodlight();
initScrollProgress();
initMagnetic();
