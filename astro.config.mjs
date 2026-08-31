import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import { resolveSite } from './site-url.mjs';
import devApi from './dev-api.mjs';

const { url: site, source, isProduction } = resolveSite();
process.env.PUBLIC_SITE_URL = site;
process.env.PUBLIC_IS_PRODUCTION = String(isProduction);

console.log(`  · building for ${site}  (from ${source}${isProduction ? '' : ', noindex'})`);

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    locales: ['fr', 'en', 'de', 'it'],
    defaultLocale: 'fr',
    routing: {
      prefixDefaultLocale: true,
      redirectToDefaultLocale: true,
    },
  },
  integrations: [
    devApi(),
    sitemap({
      i18n: {
        defaultLocale: 'fr',
        locales: { fr: 'fr-CH', en: 'en', de: 'de-CH', it: 'it-CH' },
      },
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
    inlineStylesheets: 'always',
  },
});
