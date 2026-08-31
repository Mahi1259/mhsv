export const LOCALES = ['fr', 'en', 'de', 'it'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'fr';

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);

export const SITE_URL = import.meta.env.PUBLIC_SITE_URL || 'http://localhost:4321';

export const IS_PRODUCTION = import.meta.env.PUBLIC_IS_PRODUCTION !== 'false';

// Off until the statutes are validated. Hides the hero status line, the legal
// footer block and the legal-notice link.
export const SHOW_LEGAL_STATUS = import.meta.env.PUBLIC_SHOW_LEGAL_STATUS === 'true';

// Drives the "pending legal validation" banner on the data protection page.
export const PRIVACY_IS_DRAFT = import.meta.env.PUBLIC_PRIVACY_IS_DRAFT !== 'false';

export const LEGAL_PAGES = {
  legalNotice: { fr: 'mentions-legales/', en: 'legal-notice/', de: 'legal-notice/', it: 'legal-notice/' },
  dataProtection: { fr: 'protection-des-donnees/', en: 'data-protection/', de: 'data-protection/', it: 'data-protection/' },
  cookies: { fr: 'cookies/', en: 'cookies/', de: 'cookies/', it: 'cookies/' },
  forms: { fr: 'formulaires/', en: 'forms/', de: 'forms/', it: 'forms/' },
  photoCredits: {
    fr: 'credits-photos/',
    en: 'photo-credits/',
    de: 'bildnachweise/',
    it: 'crediti-foto/',
  },
} as const;

export type LegalPageId = keyof typeof LEGAL_PAGES;

export const LEGAL_PAGE_IDS = [
  'legalNotice',
  'dataProtection',
  'cookies',
  'forms',
] as const satisfies readonly LegalPageId[];

export const NEWSLETTER_LOCALES = ['fr', 'en'] as const satisfies readonly Locale[];

export const STATUS_KEYS = [
  'active',
  'inDevelopment',
  'pilot',
  'partnership',
  'future',
] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export const SECTION_TYPES = ['hero', 'statement', 'grid', 'feature', 'quiet'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

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
  { id: 'supporters', anchor: 'supporters', type: 'grid' },

  { id: 'founder', anchor: 'founder', type: 'statement' },

  { id: 'book', anchor: 'book', type: 'feature' },

  { id: 'identity', anchor: 'identity', type: 'quiet' },
  { id: 'roadmap', anchor: 'roadmap', type: 'grid' },
  { id: 'newsletter', anchor: 'newsletter', type: 'feature' },

  { id: 'contact', anchor: 'contact', type: 'feature' },
] as const;

export type SectionId = (typeof SECTION_ORDER)[number]['id'];

export const FOOTER_LINKS = ['about', 'programmes', 'book', 'newsletter', 'contact'] as const;

export const BOOK_PAGE_PATH = '/livre';
