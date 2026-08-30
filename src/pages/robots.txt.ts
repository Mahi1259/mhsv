import type { APIRoute } from 'astro';
import { SITE_URL } from '@/config/site';

/**
 * TEMPORARY — prototype set to ALLOW crawling for review purposes.
 *
 * REVERT BEFORE PRODUCTION LAUNCH: restore the IS_PRODUCTION check below so
 * preview/prototype deploys disallow crawling again. The original logic
 * blocked all crawlers on non-production so an unfinished prototype could not
 * be indexed. This override removes that block.
 *
 * NOTE: robots.txt is only half the picture — if a noindex meta tag is also
 * gated on IS_PRODUCTION elsewhere, it must be disabled too, or pages still
 * won't be indexable.
 */
export const GET: APIRoute = () => {
  /*
   * Disallow before Allow.
   *
   * RFC 9309 resolves by the most specific match and is order-independent, so
   * for a compliant parser this makes no difference at all. It is written this
   * way for the ones that are not: a first-match reader hitting `Allow: /`
   * first would treat every rule after it as unreachable and happily crawl the
   * form result pages.
   *
   * No Crawl-delay, deliberately. It is not part of the standard, Google and
   * others ignore it, and a static site behind a CDN has no rate to protect.
   */
  const body = [
    'User-agent: *',
    '',
    '# Form result pages exist for a flow, not for search.',
    'Disallow: /*/message-sent/',
    'Disallow: /*/message-error/',
    'Disallow: /*/order-sent/',
    'Disallow: /*/newsletter-sent/',
    '',
    'Allow: /',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', SITE_URL).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};