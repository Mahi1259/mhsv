/**
 * Site-wide configuration and feature flags.
 *
 * Anything the client has not yet signed off on lives behind a flag here, so
 * turning it on is a one-line environment change rather than a code edit.
 */

export const LOCALES = ['fr', 'en', 'de', 'it'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

/**
 * Canonical origin for this build. Resolved in astro.config.mjs (see
 * site-url.mjs) and injected here, so there is exactly one place the domain is
 * decided. Changing domain is one environment variable — no code edit.
 */
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

/**
 * False on Vercel preview deployments and local builds. Those are marked
 * noindex so a preview URL never gets indexed or competes with production.
 */
export const IS_PRODUCTION = import.meta.env.PUBLIC_IS_PRODUCTION !== 'false';

/**
 * BLOCKER #1 — legal / association status.
 *
 * The content pack states "Swiss non-profit association — Geneva" in §01 and a
 * full legal footer in §21. A later client instruction says not to display the
 * association or legal status until the lawyer has validated the statutes.
 *
 * Until the client says which applies, this ships false: the hero status line,
 * the legal footer block and the legal-notice page link are all withheld.
 * Set PUBLIC_SHOW_LEGAL_STATUS=true to reveal all three at once.
 */
export const SHOW_LEGAL_STATUS = import.meta.env.PUBLIC_SHOW_LEGAL_STATUS === 'true';

/**
 * BLOCKER #5 — the privacy policy has not been written. The page ships as a
 * developer draft carrying a visible notice. Set false once the client's
 * lawyer supplies the final text (and replace the body copy in the authored
 * locale files).
 */
export const PRIVACY_IS_DRAFT = import.meta.env.PUBLIC_PRIVACY_IS_DRAFT !== 'false';

/** Publication states available to the status badge. */
export const STATUS_KEYS = [
  'active',
  'inDevelopment',
  'pilot',
  'partnership',
  'future',
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

/**
 * Section order and band tone for the single page.
 *
 * Tone works in five long movements rather than alternating section by
 * section. The brief asks for "alternating dark and light bands — dark for
 * vision and ambition, light for concrete programmes and method", which is a
 * grouping instruction: flipping on every section turns a 21-section scroll
 * into a strobe and makes the change meaningless, because it no longer marks
 * anything.
 *
 *   01–03  ink    identity and ambition
 *   04–10  bone   the model: mission, method, services, programmes, offer
 *   11–15  ink    reach and ambition: international, ecosystem, fees, digital
 *   16–19  bone   the people and the brand
 *   20–21  ink    what is coming, and the close
 *
 * Within a movement the "-raised" variants shift the surface by a step —
 * enough to separate adjacent sections, far too little to read as a switch.
 * Four hard transitions in the whole page, each one landing on a real change
 * of subject.
 */
export const SECTION_ORDER = [
  // ── identity and ambition ────────────────────────────────────────────────
  { id: 'hero', anchor: 'top', tone: 'ink' },
  { id: 'about', anchor: 'about', tone: 'ink-raised' },
  { id: 'vision', anchor: 'vision', tone: 'ink' },
  // ── the model ────────────────────────────────────────────────────────────
  { id: 'mission', anchor: 'mission', tone: 'bone' },
  { id: 'audience', anchor: 'audience', tone: 'bone-raised' },
  { id: 'method', anchor: 'method', tone: 'bone' },
  { id: 'services', anchor: 'services', tone: 'bone-raised' },
  { id: 'pathway', anchor: 'pathway', tone: 'bone' },
  { id: 'programmes', anchor: 'programmes', tone: 'bone-raised' },
  { id: 'founding', anchor: 'founding', tone: 'bone' },
  // ── reach and ambition ───────────────────────────────────────────────────
  { id: 'international', anchor: 'international', tone: 'ink' },
  { id: 'ecosystem', anchor: 'ecosystem', tone: 'ink-raised' },
  { id: 'fees', anchor: 'fees', tone: 'ink' },
  { id: 'inclusion', anchor: 'inclusion', tone: 'ink-raised' },
  { id: 'digital', anchor: 'digital', tone: 'ink' },
  // ── the people and the brand ─────────────────────────────────────────────
  { id: 'team', anchor: 'team', tone: 'bone' },
  { id: 'founder', anchor: 'founder', tone: 'bone-raised' },
  { id: 'book', anchor: 'book', tone: 'bone' },
  { id: 'identity', anchor: 'identity', tone: 'bone-raised' },
  // ── what is coming, and the close ────────────────────────────────────────
  { id: 'roadmap', anchor: 'roadmap', tone: 'ink' },
  { id: 'contact', anchor: 'contact', tone: 'ink-raised' },
] as const;

export type SectionId = (typeof SECTION_ORDER)[number]['id'];
export type BandTone = (typeof SECTION_ORDER)[number]['tone'];
