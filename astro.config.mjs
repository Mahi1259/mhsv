// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { resolveSite } from './site-url.mjs';

/**
 * Canonical origin — see site-url.mjs. Resolved once here and pushed back into
 * process.env so the components (which read import.meta.env.PUBLIC_SITE_URL)
 * and the sitemap cannot disagree about what domain this build is for.
 */
const { url: site, source, isProduction } = resolveSite();
process.env.PUBLIC_SITE_URL = site;
// Preview and local builds are marked noindex so a Vercel preview URL can
// never be indexed or compete with production.
process.env.PUBLIC_IS_PRODUCTION = String(isProduction);

console.log(`  · building for ${site}  (from ${source}${isProduction ? '' : ', noindex'})`);

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  i18n: {
    locales: ['fr', 'en', 'de', 'it'],
    defaultLocale: 'fr',
    routing: {
      // Every language gets a real URL — /fr/ is not collapsed into /.
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'fr',
        locales: { fr: 'fr-CH', en: 'en', de: 'de-CH', it: 'it-CH' },
      },
      /**
       * Keep the sitemap to pages meant for search. The root is a redirect
       * gateway and the form result pages exist only for the no-JavaScript
       * submit flow — all three are marked noindex, so listing them would
       * contradict the pages themselves.
       */
      filter: (page) => {
        const path = new URL(page).pathname;
        if (path === '/') return false;
        return !/\/message-(sent|error)\/$/.test(path);
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    /**
     * The whole stylesheet is ~23 kB raw / ~4 kB gzipped. Inlining it removes
     * the render-blocking request that was costing ~230 ms of LCP, and on a
     * site this small (four locale pages plus a few short ones) the lost
     * cross-page caching is worth far less than the first-paint win.
     */
    inlineStylesheets: 'always',
  },
});
