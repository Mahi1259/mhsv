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
 * decided. Changing domain is one environment variable - no code edit.
 */
export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

/**
 * False on Vercel preview deployments and local builds. Those are marked
 * noindex so a preview URL never gets indexed or competes with production.
 */
export const IS_PRODUCTION = import.meta.env.PUBLIC_IS_PRODUCTION !== 'false';

/**
 * BLOCKER - legal / association status.
 *
 * The content pack states "Swiss non-profit association - Geneva" in §01 and a
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
/**
 * The legal pages, and their slug in each language.
 *
 * The slug differs per locale on purpose - the client asked for
 * /fr/mentions-legales/ and /en/legal-notice/, not one path with four
 * prefixes. `legalPath()` in lib/i18n.ts resolves a page to its slug, and
 * `localeAlternates` uses the same map so hreflang points at the right URL in
 * every language rather than at a path that only exists in one.
 *
 * DE and IT are served from the English slugs. The brief specifies FR and EN
 * copy only, but the site is published in four languages and a footer link
 * that 404s in two of them is worse than a translated placeholder.
 */
export const LEGAL_PAGES = {
  legalNotice: { fr: 'mentions-legales/', en: 'legal-notice/', de: 'legal-notice/', it: 'legal-notice/' },
  dataProtection: { fr: 'protection-des-donnees/', en: 'data-protection/', de: 'data-protection/', it: 'data-protection/' },
  cookies: { fr: 'cookies/', en: 'cookies/', de: 'cookies/', it: 'cookies/' },
  forms: { fr: 'formulaires/', en: 'forms/', de: 'forms/', it: 'forms/' },
} as const;

export type LegalPageId = keyof typeof LEGAL_PAGES;
export const LEGAL_PAGE_IDS = Object.keys(LEGAL_PAGES) as LegalPageId[];

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
 * Previously every section was the same shape - eyebrow, heading, block of
 * content - which is precisely what made a 21-section page read as 21 slides.
 * Each section now takes one of five types, and each type has its own measure,
 * rhythm and vertical padding.
 *
 *   hero       one only: full viewport, the largest type on the site
 *   statement  wide measure, large text, lots of air, almost no chrome
 *   grid       cards or columns
 *   feature    asymmetric - a visual or figure one side, text the other
 *   quiet      narrow, understated, low contrast; deliberately recessive
 */
export const SECTION_TYPES = ['hero', 'statement', 'grid', 'feature', 'quiet'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * Section order and archetype for the single page.
 *
 * There is no panel surface any more. Four sections used to sit on inset
 * slabs - light at first, then a raised navy - and both readings were the
 * same mistake: a big rectangle laid over the page. The page is ONE navy
 * ground from top to bottom, and sections are told apart by layout and by
 * rhythm. Where a specific piece of information has to be set apart, it gets
 * a small card, not the whole section.
 *
 * Note: the content pack's §10 (Founding programmes) and §13 (Fees) are merged
 * into one "Programmes & fees" section, because the CHF 15,000 launch rate was
 * otherwise stated three times on one page.
 */
export const SECTION_ORDER = [
  { id: 'hero', anchor: 'top', type: 'hero' },
  { id: 'about', anchor: 'about', type: 'statement' },
  { id: 'vision', anchor: 'vision', type: 'statement' },
  { id: 'mission', anchor: 'mission', type: 'grid' },
  { id: 'audience', anchor: 'audience', type: 'quiet' },
  { id: 'method', anchor: 'method', type: 'feature' },
  { id: 'services', anchor: 'services', type: 'grid' },
  { id: 'pathway', anchor: 'pathway', type: 'feature' },
  { id: 'programmes', anchor: 'programmes', type: 'statement' },

  { id: 'founding', anchor: 'founding', type: 'feature' },

  { id: 'international', anchor: 'international', type: 'statement' },
  { id: 'ecosystem', anchor: 'ecosystem', type: 'grid' },
  { id: 'inclusion', anchor: 'inclusion', type: 'quiet' },
  { id: 'digital', anchor: 'digital', type: 'grid' },

  { id: 'team', anchor: 'team', type: 'grid' },

  { id: 'founder', anchor: 'founder', type: 'statement' },

  { id: 'book', anchor: 'book', type: 'feature' },

  { id: 'identity', anchor: 'identity', type: 'quiet' },
  { id: 'roadmap', anchor: 'roadmap', type: 'grid' },
  { id: 'newsletter', anchor: 'newsletter', type: 'feature' },

  { id: 'contact', anchor: 'contact', type: 'feature' },
] as const;

export type SectionId = (typeof SECTION_ORDER)[number]['id'];

/** Sections listed in the footer. Deliberately short - it was 20 links. */
export const FOOTER_LINKS = ['about', 'programmes', 'book', 'newsletter', 'contact'] as const;

/** Permanent route encoded in the printed QR code. Must never change. */
export const BOOK_PAGE_PATH = '/livre';
