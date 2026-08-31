import type { APIRoute } from 'astro';
import { SITE_URL } from '@/config/site';

// TODO before launch: re-gate this on IS_PRODUCTION. Base.astro and /livre still
// send noindex, so as it stands robots.txt contradicts them.
export const GET: APIRoute = () => {
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
