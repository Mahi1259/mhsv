/**
 * Resolves the canonical origin for a build — the single source of truth for
 * the domain.
 *
 * The domain appears in exactly one place in this project: the
 * PUBLIC_SITE_URL environment variable. Canonical links, hreflang alternates,
 * Open Graph URLs, robots.txt and the sitemap all derive from what this
 * returns, so changing domain is one variable and a redeploy — no code edit,
 * and nothing to change in vercel.json or netlify.toml, which contain no
 * domain at all.
 *
 * Why not just a hard-coded default: a fixed fallback means every preview
 * deployment claims to be the production domain. That is worse than useless —
 * it points crawlers at a domain that may not serve the site yet (BLOCKERS #4
 * — mhsv.ch vs mhsv-international.org is still undecided), and it makes a
 * misconfigured production deploy look fine.
 */

const trimSlash = (url) => url.replace(/\/+$/, '');

const withScheme = (host) => (/^https?:\/\//.test(host) ? host : `https://${host}`);

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ url: string, source: string, isProduction: boolean }}
 */
export function resolveSite(env = process.env) {
  // 1. Explicit configuration always wins.
  if (env.PUBLIC_SITE_URL) {
    return {
      url: trimSlash(withScheme(env.PUBLIC_SITE_URL)),
      source: 'PUBLIC_SITE_URL',
      isProduction: env.VERCEL_ENV ? env.VERCEL_ENV === 'production' : true,
    };
  }

  // 2. Vercel production without an explicit value: use the project's own
  //    production domain, which follows the custom domain once one is attached.
  if (env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL) {
    return {
      url: trimSlash(withScheme(env.VERCEL_PROJECT_PRODUCTION_URL)),
      source: 'VERCEL_PROJECT_PRODUCTION_URL',
      isProduction: true,
    };
  }

  // 3. Preview / branch deployment: canonicalise to itself, never to
  //    production. Combined with the noindex these builds carry, a preview can
  //    neither be indexed nor point crawlers somewhere else.
  if (env.VERCEL_URL) {
    return {
      url: trimSlash(withScheme(env.VERCEL_URL)),
      source: 'VERCEL_URL (preview)',
      isProduction: false,
    };
  }

  /*
   * 3b. Cloudflare Pages, same principle.
   *
   * This branch did not exist, and the first Cloudflare build fell straight
   * through to the local default below: every canonical, hreflang, Open Graph
   * URL and sitemap entry said http://localhost:4321, and the whole site went
   * out noindex. A deployed site canonicalising to the developer's machine is
   * worse than a wrong domain, because nothing about it looks broken.
   *
   * CF_PAGES_URL is the per-deployment address. It is right for a preview and
   * wrong for production - which is why production must set PUBLIC_SITE_URL,
   * and check-build.mjs refuses a CI build that has not.
   */
  if (env.CF_PAGES_URL) {
    return {
      url: trimSlash(withScheme(env.CF_PAGES_URL)),
      source: 'CF_PAGES_URL (Cloudflare preview)',
      isProduction: false,
    };
  }

  // 4. Local build.
  return { url: 'http://localhost:4321', source: 'local default', isProduction: false };
}
