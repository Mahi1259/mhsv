import type { APIRoute } from 'astro';
import { SITE_URL, IS_PRODUCTION } from '@/config/site';

/**
 * Generated so the sitemap URL always matches the resolved origin - a
 * hard-coded robots.txt would point at the wrong host on a preview deploy.
 *
 * Preview and local builds disallow everything, so a Vercel preview URL cannot
 * be crawled even if someone links to it.
 */
export const GET: APIRoute = () => {
  if (!IS_PRODUCTION) {
    /*
     * REMOVE BEFORE PRODUCTION LAUNCH: prototype noindex - see
     * VERCEL_IS_PROTOTYPE in site-url.mjs.
     *
     * Belt and braces with the meta tag, and worth knowing they are not
     * equivalent: Disallow stops a crawler FETCHING the page, which also stops
     * it reading the noindex. That is the right trade for a prototype nobody
     * has indexed. If one of these URLs ever does appear in results, this line
     * has to come off first so the noindex can be seen and acted on.
     */
    return new Response(
      [
        '# Prototype deployment - not for indexing.',
        '# REMOVE BEFORE PRODUCTION LAUNCH.',
        'User-agent: *',
        'Disallow: /',
        '',
      ].join('\n'),
      { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

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
