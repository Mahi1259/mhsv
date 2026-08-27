// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { resolveSite } from './site-url.mjs';
import devApi from './dev-api.mjs';

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
  /**
   * 'ignore', not 'always'.
   *
   * The printed QR code on the Founding Book encodes `https://www.mhsv.ch/livre`
   * — no trailing slash, as the client brief specifies. Under 'always' that
   * exact URL 404s, including in `astro preview`, so the address on a printed
   * book would not resolve and could not be tested before going to print.
   *
   * 'ignore' serves both forms everywhere. The hosts additionally redirect the
   * slash-less form to the canonical one (vercel.json / public/_redirects), so
   * only one URL is indexable.
   */
  trailingSlash: 'ignore',
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
    // Dev only - gives `astro dev` the /api/contact the Pages Function
    // provides in production. No effect on a build.
    devApi(),
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
        return !/\/(message-sent|message-error|order-sent|newsletter-sent)\/?$/.test(path);
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
