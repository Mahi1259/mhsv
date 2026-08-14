import type { APIRoute } from 'astro';
import { SITE_URL } from '@/config/site';

/**
 * Generated so the sitemap URL always matches PUBLIC_SITE_URL — a hard-coded
 * robots.txt would point at the wrong host on staging.
 */
export const GET: APIRoute = () => {
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
