const VERCEL_IS_PROTOTYPE = true;

const trimSlash = (url) => url.replace(/\/+$/, '');

const withScheme = (host) => (/^https?:\/\//.test(host) ? host : `https://${host}`);

export function resolveSite(env = process.env) {
  if (env.PUBLIC_SITE_URL) {
    const onVercel = Boolean(env.VERCEL || env.VERCEL_ENV);
    const isProduction =
      VERCEL_IS_PROTOTYPE && onVercel
        ? false
        : env.VERCEL_ENV
  // Previews canonicalise to their own URL and ship noindex rather than claiming
  // to be production.
          ? env.VERCEL_ENV === 'production'
          : true;
    return {
      url: trimSlash(withScheme(env.PUBLIC_SITE_URL)),
      source: onVercel && VERCEL_IS_PROTOTYPE ? 'PUBLIC_SITE_URL (Vercel prototype, noindex)' : 'PUBLIC_SITE_URL',
      isProduction,
    };
  }

  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return {
      url: trimSlash(withScheme(env.VERCEL_PROJECT_PRODUCTION_URL)),
      source: 'VERCEL_PROJECT_PRODUCTION_URL',
      isProduction: !VERCEL_IS_PROTOTYPE,
    };
  }

  if (env.VERCEL_URL) {
    return {
      url: trimSlash(withScheme(env.VERCEL_URL)),
      source: 'VERCEL_URL (preview)',
      isProduction: false,
    };
  }

  if (env.CF_PAGES_URL) {
    return {
      url: trimSlash(withScheme(env.CF_PAGES_URL)),
      source: 'CF_PAGES_URL (Cloudflare preview)',
      isProduction: false,
    };
  }

  return { url: 'http://localhost:4321', source: 'local default', isProduction: false };
}
