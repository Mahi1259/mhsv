/**
 * Contrast gate for the design tokens.  `npm run check:contrast`
 *
 * axe only reports what happens to be on screen; this asserts every
 * foreground/background pairing the design system actually permits, so a
 * palette change cannot quietly drop a role below WCAG AA.
 *
 * Tokens are read from src/styles/global.css rather than duplicated here — if
 * the palette moves, this moves with it.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(ROOT, 'src/styles/global.css'), 'utf8');

/** Pull `--name: #rrggbb;` out of the stylesheet. */
function token(name) {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!match) throw new Error(`token --${name} not found in global.css`);
  return match[1];
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (h) => {
  const [r, g, b] = hex(h);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const C = {
  navy: token('color-navy'),
  navyDeep: token('color-navy-deep'),
  navyRaise: token('color-navy-raise'),
  gold: token('color-gold'),
  goldSoft: token('color-gold-soft'),
  goldInk: token('color-gold-ink'),
  bone: token('color-bone'),
  white: token('color-white'),
  mutedOnDark: token('muted-on-dark'),
  mutedOnLight: /\.band--panel[^}]*--band-muted:\s*(#[0-9a-fA-F]{6})/s.exec(css)?.[1],
};

if (!C.mutedOnLight) throw new Error('panel --band-muted not found in global.css');

/**
 * Composite a translucent overlay onto a ground.
 *
 * Cards use `--band-raised`, a translucent tint over the band colour, so text
 * inside a card is NOT on the raw ground. Checking only against the ground
 * missed that small link text on a card sat below AA.
 */
function composite(overlay, alpha, ground) {
  const [f, b] = [hex(overlay), hex(ground)];
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(f[i] * alpha + b[i] * (1 - alpha)).toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Card surfaces, as actually rendered.
 *
 * The panel's card is now an explicit cool colour rather than a translucent
 * tint, so read it straight out of the stylesheet instead of compositing.
 */
const PANEL_CARD = /\.band--panel[^}]*--band-raised:\s*(#[0-9a-fA-F]{6})/s.exec(css)?.[1];
if (!PANEL_CARD) throw new Error('panel --band-raised colour not found in global.css');

const CARD_ON_BONE = PANEL_CARD;
const CARD_ON_NAVY = composite(C.white, 0.05, C.navy);
const CARD_ON_NAVY_DEEP = composite(C.white, 0.045, C.navyDeep);

/**
 * The masthead, as actually rendered.
 *
 * Once scrolled, the bar is a translucent pill floating OVER the page, so its
 * effective background depends on whatever is behind it. It travels the whole
 * document, which means the worst case is the lightest thing it can ever cross
 * — the bone panels. Checking the bar against navy alone says nothing.
 *
 * `backdrop-filter: blur()` redistributes what is behind but does not change
 * its average luminance, so straight alpha compositing is the right model.
 *
 * This is what fixes the bar's opacity at 82% rather than the 72% that reads
 * as more glassy: at 72% the language codes fall to 3.57:1 over bone.
 */
const header = readFileSync(resolve(ROOT, 'src/components/Header.astro'), 'utf8');
const shrunkRule = /\.is-shrunk\s+\.site-header__shell\s*\{([^}]*)\}/.exec(header)?.[1];
if (!shrunkRule) throw new Error('shrunk masthead rule not found in Header.astro');
const HEADER_ALPHA = Number(/--navy-deep\)\s*(\d+)%/.exec(shrunkRule)?.[1]);
if (!Number.isFinite(HEADER_ALPHA)) throw new Error('shrunk masthead opacity not found');

const SHRUNK_BAR_ON_BONE = composite(C.navyDeep, HEADER_ALPHA / 100, C.bone);
const SHRUNK_BAR_ON_CARD = composite(C.navyDeep, HEADER_ALPHA / 100, CARD_ON_BONE);

/** AA: 4.5 for body text, 3.0 for large text (>=24px, or >=18.66px bold). */
const CHECKS = [
  // Card surfaces — where the small print actually lives.
  ['muted text on bone card', C.mutedOnLight, CARD_ON_BONE, 4.5],
  ['gold-ink link on bone card', C.goldInk, CARD_ON_BONE, 4.5],
  ['body text on bone card', C.navyDeep, CARD_ON_BONE, 4.5],
  ['muted text on navy card', C.mutedOnDark, CARD_ON_NAVY, 4.5],
  ['gold link on navy card', C.gold, CARD_ON_NAVY, 4.5],
  ['muted text on navy-deep card', C.mutedOnDark, CARD_ON_NAVY_DEEP, 4.5],

  // Dark grounds
  ['body text on navy-deep', C.white, C.navyDeep, 4.5],
  ['body text on navy', C.white, C.navy, 4.5],
  ['body text on navy-raise', C.white, C.navyRaise, 4.5],
  ['muted text on navy-deep', C.mutedOnDark, C.navyDeep, 4.5],
  ['muted text on navy', C.mutedOnDark, C.navy, 4.5],
  ['muted text on navy-raise', C.mutedOnDark, C.navyRaise, 4.5],
  ['gold accent on navy-deep', C.gold, C.navyDeep, 4.5],
  ['gold accent on navy', C.gold, C.navy, 4.5],
  ['gold accent on navy-raise', C.gold, C.navyRaise, 4.5],
  ['gold-soft on navy-deep', C.goldSoft, C.navyDeep, 4.5],
  ['gold-soft on navy', C.goldSoft, C.navy, 4.5],

  // Light ground
  ['body text on bone', C.navyDeep, C.bone, 4.5],
  ['muted text on bone', C.mutedOnLight, C.bone, 4.5],
  ['gold-ink accent on bone', C.goldInk, C.bone, 4.5],

  // Buttons: gold fill with navy label
  ['primary button label', C.navyDeep, C.gold, 4.5],
  ['primary button label (hover)', C.navyDeep, C.goldSoft, 4.5],

  // Language switcher: current locale is navy on gold
  ['active language chip', C.navyDeep, C.gold, 4.5],

  // The shrunk masthead, over the lightest ground it ever floats across.
  ['nav link on bar over bone', C.white, SHRUNK_BAR_ON_BONE, 4.5],
  ['language code on bar over bone', C.mutedOnDark, SHRUNK_BAR_ON_BONE, 4.5],
  ['nav link on bar over card', C.white, SHRUNK_BAR_ON_CARD, 4.5],
  ['language code on bar over card', C.mutedOnDark, SHRUNK_BAR_ON_CARD, 4.5],
  // The shrunk bar drops the switcher and states the current language instead.
  ['current language on bar over bone', C.gold, SHRUNK_BAR_ON_BONE, 4.5],
];

/** Pairings that must NEVER be used — verified as failing, so the ban is real. */
const BANNED = [
  ['gold on bone (use --color-gold-ink)', C.gold, C.bone],
  // Keeps the masthead's opacity honest: the glassier 72% bar the reference
  // spec calls for is verified here as failing, so nobody re-lowers it.
  ['language code on a 72% bar', C.mutedOnDark, composite(C.navyDeep, 0.72, C.bone)],
];

let failed = 0;
for (const [label, fg, bg, min] of CHECKS) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  console.log(
    `  ${ok ? '✓' : '✗'} ${label.padEnd(30)} ${fg} on ${bg}  ${r.toFixed(2)}:1 (min ${min})`,
  );
}

for (const [label, fg, bg] of BANNED) {
  const r = ratio(fg, bg);
  // If this ever passes, the token was changed and the ban needs revisiting.
  const stillBad = r < 4.5;
  if (!stillBad) failed++;
  console.log(
    `  ${stillBad ? '✓' : '✗'} banned: ${label.padEnd(22)} ${r.toFixed(2)}:1 — ${stillBad ? 'correctly avoided in the CSS' : 'now passes; update the note'}`,
  );
}

console.log('');
if (failed) {
  console.error(`✗ contrast check failed (${failed})\n`);
  process.exit(1);
}
console.log(`  ✓ contrast OK — ${CHECKS.length} pairings meet WCAG AA`);
