# MHSV® website

One-page site for MHSV® — International Centre for Development and Transition
(Geneva), in French, English, German and Italian. Astro, static output.

## Run it

```bash
npm install
npm run dev        # http://localhost:4321
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. Forms work; mail is logged, not sent |
| `npm run build` | Checks, builds, then checks the output |
| `npm run preview` | Serve the build locally |
| `npm test` | Form tests |
| `npm run qa` | Every page at 12 widths in 4 languages (needs `preview` running) |
| `npm run content:extract` | Re-read the .docx into `src/data/i18n/` |

If the build passes, the client's constraints are met — `npm run build` runs the
checks itself.

## Where things are

```
src/config/site.ts     locales, feature flags, section order
src/data/i18n/         generated content — don't edit
src/data/authored/     hand-written strings, merged over the generated files
src/components/        one component per section, under sections/
src/pages/             index redirects to /fr/; livre.astro is the QR target
functions/lib/         form validation and sending, shared by all hosts
```

## Editing content

`src/data/i18n/*.json` is generated and gets overwritten. Edit
`src/data/authored/{fr,en,de,it}.json` instead — it's merged on top and wins.
Arrays replace the generated array entirely.

All four languages must stay key-for-key identical or the build fails.

## Configuration

See [.env.example](./.env.example).

| Variable | Default | Effect |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | auto-detected | Canonical URLs, hreflang, sitemap, robots.txt |
| `PUBLIC_SHOW_LEGAL_STATUS` | `false` | Shows the legal status line, footer and link |
| `PUBLIC_PRIVACY_IS_DRAFT` | `true` | Shows the pending-validation notice |

The domain is only set in `PUBLIC_SITE_URL`. On Cloudflare it must be a *build*
variable, not a runtime one.

## Deploy

Cloudflare Pages. Build `npm run build`, output `dist`.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Deploy command | **leave empty** |
| Node version | 20 or later |

Three things that will bite you:

- **The deploy command must be empty.** `npx wrangler deploy` is the Workers
  command and fails with "you have run `wrangler deploy` on a Pages project".
  If the field can't be blank, use `npx wrangler pages deploy dist`.
- **`PUBLIC_SITE_URL` must be a *build* variable, not a runtime one.** It is
  baked into the HTML at build time. Set at runtime it does nothing, and every
  page canonicalises to `http://localhost:4321` with nothing in the log looking
  wrong.
- **`CONTACT_TRANSPORT` must be `brevo` or `log`, never `smtp`.** Workers can't
  open raw TCP. Run `npm run check:functions` before pushing.

The form endpoint is `functions/api/contact.js`. Headers and redirects come from
`public/_headers` and `public/_redirects`.

The site ships `noindex` until you set `LAUNCHED = true` in `site-url.mjs`.
