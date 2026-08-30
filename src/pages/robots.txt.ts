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
  const body = [
    'User-agent: *',
    'Allow: /',
    '',
    '# Form result pages exist for a flow, not for search.',
    'Disallow: /*/message-sent/',
    'Disallow: /*/message-error/',
    'Disallow: /*/order-sent/',
    'Disallow: /*/newsletter-sent/',
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', SITE_URL).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};