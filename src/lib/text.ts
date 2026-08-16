import type { Locale } from '@/config/site';

/**
 * Raise the initial letter of a list item.
 *
 * Several lists in the content pack are written as one running sentence
 * ("Sports performance; mental & human development; …"), so only the first
 * item is capitalised. CSS `text-transform: capitalize` is not an option - it
 * would title-case every word, which is wrong in French and Italian.
 */
export function capitalizeFirst(value: string, locale: Locale): string {
  if (!value) return value;
  return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1);
}

/** Lowercase, strip accents and punctuation - for comparing wording only. */
function normalise(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Strip the status label from the front of the pack's full status wording.
 *
 * The pack writes "IN DEVELOPMENT / PROGRESSIVE DEPLOYMENT" while the badge
 * already renders "In development", so printing both repeats the label. This
 * keeps only the segments that add information ("progressive deployment"), and
 * returns null when the detail says nothing the label did not.
 */
export function statusQualifier(detail: string | undefined, label: string): string | null {
  if (!detail) return null;

  const labelKey = normalise(label);
  const segments = detail
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const rest = segments.filter((segment) => normalise(segment) !== labelKey);
  if (!rest.length) return null;

  // No segment matched the label: the pack is using different wording, so show
  // it whole rather than guessing at which part is redundant.
  return rest.join(' / ');
}
