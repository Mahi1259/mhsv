import { LOCALES, DEFAULT_LOCALE, LEGAL_PAGES, type LegalPageId, type Locale } from '@/config/site';
import fr from '@/data/i18n/fr.json';
import en from '@/data/i18n/en.json';
import de from '@/data/i18n/de.json';
import it from '@/data/i18n/it.json';

export type Content = typeof fr;

const CONTENT: Record<Locale, Content> = {
  fr,
  en: en as unknown as Content,
  de: de as unknown as Content,
  it: it as unknown as Content,
};

export const getContent = (locale: Locale): Content => CONTENT[locale];

export function localePath(path: string, locale: Locale): string {
  const clean = path.replace(/^\/+/, '');
  return `/${locale}/${clean}`;
}

export function legalPath(page: LegalPageId, locale: Locale): string {
  return `/${locale}/${LEGAL_PAGES[page][locale]}`;
}

const SLUG_TO_PAGE = new Map<string, LegalPageId>(
  Object.entries(LEGAL_PAGES).flatMap(([page, slugs]) =>
    Object.values(slugs).map((slug) => [slug, page as LegalPageId] as const),
  ),
);

export function pathForLocale(currentPath: string, locale: Locale): string {
  const page = SLUG_TO_PAGE.get(currentPath.replace(/^\/+/, ''));
  return page ? legalPath(page, locale) : localePath(currentPath, locale);
}

export function localeAlternates(currentPath: string) {
  return LOCALES.map((locale) => ({
    locale,
    ...CONTENT[locale].meta,
    path: pathForLocale(currentPath, locale),
  }));
}

export { LOCALES, DEFAULT_LOCALE, type Locale };
