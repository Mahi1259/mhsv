import type { APIRoute } from 'astro';
import { SITE_URL, IS_PRODUCTION } from '@/config/site';

/**
 * Generated so the sitemap URL always matches the resolved origin — a
 * hard-coded robots.txt would point at the wrong host on a preview deploy.
 *
 * Preview and local builds disallow everything, so a Vercel preview URL cannot
 * be crawled even if someone links to it.
 */
export const GET: APIRoute = () => {
  if (!IS_PRODUCTION) {
    return new Response(
      ['# Non-production deployment — not for indexing.', 'User-agent: *', 'Disallow: /', ''].join('\n'),
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
    '',
    `Sitemap: ${new URL('/sitemap-index.xml', SITE_URL).href}`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
