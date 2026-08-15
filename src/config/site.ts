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
 * BLOCKER — legal / association status.
 *
 * The content pack states "Swiss non-profit association — Geneva" in §01 and a
 * full legal footer in §21. A later client instruction says not to display the
 * association or legal status until the lawyer has validated the statutes.
 *
 * Until the client says which applies, this ships false: the hero status line,
 * the legal footer block and the legal-notice page link are all withheld.
 */
export const SHOW_LEGAL_STATUS = import.meta.env.PUBLIC_SHOW_LEGAL_STATUS === 'true';

/**
 * The privacy policy has not been written. The page ships as a developer draft
 * carrying a visible notice. Set false once the lawyer supplies final text.
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
 * Section archetypes.
 *
 * Previously every section was the same shape — eyebrow, heading, block of
 * content — which is precisely what made a 21-section page read as 21 slides.
 * Each section now takes one of five types, and each type has its own measure,
 * rhythm and vertical padding.
 *
 *   hero       one only: full viewport, the largest type on the site
 *   statement  wide measure, large text, lots of air, almost no chrome
 *   grid       cards or columns
 *   feature    asymmetric — a visual or figure one side, text the other
 *   quiet      narrow, understated, low contrast; deliberately recessive
 */
export const SECTION_TYPES = ['hero', 'statement', 'grid', 'feature', 'quiet'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Section order, archetype and ground for the single page.
 *
 * `tone` changes roughly every third or fourth section rather than alternating
 * — a switch on every section marks nothing, and the constant flipping was the
 * second reason the page felt paginated. Transitions between grounds are
 * gradients, not hard cuts (see .band--fade in global.css).
 *
 * Note: the content pack's §10 (Founding programmes) and §13 (Fees) are merged
 * into one "Programmes & fees" section, because the CHF 15,000 launch rate was
 * otherwise stated three times on one page.
 */
export const SECTION_ORDER = [
  { id: 'hero', anchor: 'top', type: 'hero', tone: 'navy-deep' },
  { id: 'about', anchor: 'about', type: 'statement', tone: 'navy' },
  { id: 'vision', anchor: 'vision', type: 'statement', tone: 'navy' },

  { id: 'mission', anchor: 'mission', type: 'grid', tone: 'bone' },
  { id: 'audience', anchor: 'audience', type: 'quiet', tone: 'bone' },
  { id: 'method', anchor: 'method', type: 'feature', tone: 'bone' },
  { id: 'services', anchor: 'services', type: 'grid', tone: 'bone' },

  { id: 'pathway', anchor: 'pathway', type: 'feature', tone: 'navy' },
  { id: 'programmes', anchor: 'programmes', type: 'statement', tone: 'navy' },
  { id: 'founding', anchor: 'founding', type: 'feature', tone: 'navy' },
  { id: 'international', anchor: 'international', type: 'statement', tone: 'navy' },

  { id: 'ecosystem', anchor: 'ecosystem', type: 'grid', tone: 'bone' },
  { id: 'inclusion', anchor: 'inclusion', type: 'quiet', tone: 'bone' },
  { id: 'digital', anchor: 'digital', type: 'grid', tone: 'bone' },
  { id: 'team', anchor: 'team', type: 'grid', tone: 'bone' },

  { id: 'founder', anchor: 'founder', type: 'statement', tone: 'navy' },
  { id: 'book', anchor: 'book', type: 'feature', tone: 'navy' },
  { id: 'identity', anchor: 'identity', type: 'quiet', tone: 'navy' },
  { id: 'roadmap', anchor: 'roadmap', type: 'grid', tone: 'navy' },

  { id: 'newsletter', anchor: 'newsletter', type: 'feature', tone: 'bone' },
  { id: 'contact', anchor: 'contact', type: 'feature', tone: 'navy' },
] as const;

export type SectionId = (typeof SECTION_ORDER)[number]['id'];
export type BandTone = (typeof SECTION_ORDER)[number]['tone'];

/** Sections listed in the footer. Deliberately short — it was 20 links. */
export const FOOTER_LINKS = ['about', 'programmes', 'book', 'newsletter', 'contact'] as const;

/** Permanent route encoded in the printed QR code. Must never change. */
export const BOOK_PAGE_PATH = '/livre';
