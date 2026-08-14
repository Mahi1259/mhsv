/**
 * Astro treats every folder under src/content/ as a content collection and
 * warns about auto-generating them. The locale JSON there is loaded directly by
 * src/lib/i18n.ts, not through the collections API, so declare none explicitly
 * and keep the build output clean.
 *
 * Later phases that do want collections (news, programmes) can define them here.
 */
export const collections = {};
