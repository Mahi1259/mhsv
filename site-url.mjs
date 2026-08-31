// Flip to true at launch. Until then every build ships noindex, whatever
// PUBLIC_SITE_URL says — this is what kept the prototype out of search.
const LAUNCHED = false;

const trimSlash = (url) => url.replace(/\/+$/, '');
const withScheme = (host) => (/^https?:\/\//.test(host) ? host : `https://${host}`);

export function resolveSite(env = process.env) {
  if (env.PUBLIC_SITE_URL) {
    return {
      url: trimSlash(withScheme(env.PUBLIC_SITE_URL)),
      source: LAUNCHED ? 'PUBLIC_SITE_URL' : 'PUBLIC_SITE_URL (pre-launch, noindex)',
      isProduction: LAUNCHED,
    };
  }

  // Cloudflare previews canonicalise to themselves rather than claiming to be
  // production.
  if (env.CF_PAGES_URL) {
    return {
      url: trimSlash(withScheme(env.CF_PAGES_URL)),
      source: 'CF_PAGES_URL (Cloudflare preview)',
      isProduction: false,
    };
  }

  return { url: 'http://localhost:4321', source: 'local default', isProduction: false };
}
