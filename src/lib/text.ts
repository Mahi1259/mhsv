import type { Locale } from '@/config/site';

export function capitalizeFirst(value: string, locale: Locale): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

function normalise(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function statusQualifier(detail: string | undefined, label: string): string | null {
  if (!detail) return null;

  const labelKey = normalise(label);
  const segments = detail
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const rest = segments.filter((segment) => normalise(segment) !== labelKey);
  if (!rest.length) return null;

  return rest.join(' / ');
}
