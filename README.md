# MHSV® website

One-page showcase site for MHSV® — International Centre for Development and
Transition (Geneva), in French, English, German and Italian.

Astro with static output, Tailwind CSS v4, TypeScript. The result is plain
HTML and CSS with a small amount of JavaScript, so it can be hosted anywhere.

Read [BLOCKERS.md](./BLOCKERS.md) before going to production.

## Getting started

```bash
npm install
npm run dev        # http://localhost:4321
```

That's enough for day-to-day work. The generated content and images are
committed, so you don't need the client's asset pack unless you're regenerating
them.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Checks content and contrast, builds, then checks the output |
| `npm run preview` | Serve the build locally |
| `npm test` | Form tests: contact, book order, newsletter, email, both hosts |
| `npm run typecheck` | `astro check` |
| `npm run qa` | Every page at 12 widths in 4 languages (needs `preview` running) |
| `npm run audit` | Accessibility and overflow audit (needs `preview` running) |
| `npm run check:contrast` | WCAG AA contrast pairings |
| `npm run check:motion` | Nothing animates under reduced motion |
| `npm run check:functions` | The Pages Function bundle has no Node-only libraries |
| `npm run qr` / `qr:card` | Regenerate the printed QR assets in `qr/` |
| `npm run content:extract` | Re-read the .docx into `src/data/i18n/` (needs the pack) |
| `npm run assets:prepare` | Re-derive logos, icons and fonts (needs the pack) |

`npm run build` runs the checks itself, so if the build passes, the constraints
are met.

### Forms in dev

`npm run dev` serves `/api/contact` with the same code the deployed function
uses, so the forms work locally. Mail is logged to the terminal rather than
sent, even if `.env` has working credentials — testing a form shouldn't email
anyone. Use `npm run dev:send` to send for real, or `npm run dev:cf` to run the
actual Cloudflare function against `dist/`.

`.env` is re-read on each request, so you don't need to restart after editing
it. You do need to restart after editing `dev-api.mjs`.

## Layout

```
src/
  config/site.ts        locales, feature flags, section order
  data/
    i18n/*.json         generated — don't edit
    authored/*.json     hand-written strings, merged over the generated files
  components/
    sections/           one component per section
  layouts/              Base (document shell), Page (short pages)
  pages/
    index.astro         redirects to /fr/
    livre.astro         permanent QR destination, bilingual, must not move
    [lang]/index.astro  the main page
    [lang]/[legal].astro    legal notice, data protection, cookies, forms
    [lang]/[credits].astro  photo credits
    [lang]/*-sent.astro     form results for visitors without JavaScript
scripts/                build, check and test tooling
functions/lib/          form validation and sending, shared by all hosts
qr/                     print assets, kept out of public/ on purpose
```

## Editing content

Don't edit `src/data/i18n/*.json`. It's generated and will be overwritten.

- Copy from the client's content pack: edit the .docx, then run
  `npm run content:extract`.
- Everything else — UI strings, form labels, legal pages: edit
  `src/data/authored/{fr,en,de,it}.json`. These are merged over the generated
  files and win where keys collide. Arrays replace the generated array entirely.

The four languages have to stay key-for-key identical. `npm run content:check`
fails the build otherwise, and also catches wording the client has retired.

See [CONTENT.md](./CONTENT.md) for what still needs client sign-off.

## Design notes

The background is navy, not black — the logo shield is `#001D49` and black sits
badly next to it. Gold is for rules, active states and small marks, never large
fills.

```css
--navy: #0C1D3A;  --navy-deep: #071426;  --navy-raise: #14284A;
--gold: #D4AF37;  --gold-soft: #E8C877;
--white: #FFFFFF; --muted-on-dark: #9FB0C9;
```

Every ground is dark, so gold only ever sits on navy. `npm run check:contrast`
checks each pairing against WCAG AA and fails the build if one drops below.

Each section is one of five types (`hero`, `statement`, `grid`, `feature`,
`quiet`), set once in `SECTION_ORDER`. They have different measures and spacing
so the page doesn't read as 22 identical slides. There are no section numbers
and no dividers — separation is space and an occasional change of background.

To add a section: add it to `SECTION_ORDER`, create the component in
`src/components/sections/`, and render it in `src/pages/[lang]/index.astro`.
The footer index and anchor navigation pick it up automatically.

## Configuration

All of it lives in the environment. See [.env.example](./.env.example).

| Variable | Default | Effect |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | auto-detected | Canonical URLs, hreflang, Open Graph, sitemap, robots.txt |
| `PUBLIC_SHOW_LEGAL_STATUS` | `false` | Shows the hero legal line, legal footer and legal-notice link |
| `PUBLIC_PRIVACY_IS_DRAFT` | `true` | Shows the pending-validation notice on the data protection page |

The domain is only ever set in `PUBLIC_SITE_URL`. Change it and redeploy;
nothing else contains a domain. On Cloudflare it has to be a *build* variable,
not a runtime one, because it's baked into the HTML at build time.

Unset, `site-url.mjs` works out the origin: a Vercel or Cloudflare preview
canonicalises to its own URL and ships `noindex`, and a local build uses
localhost. Every build prints which origin it used.

## Deployment

Build command `npm run build`, output directory `dist`. See
[DEPLOY.md](./DEPLOY.md) for the details.

| Host | Config | Form endpoint |
| --- | --- | --- |
| Cloudflare Pages | `wrangler.toml` | `functions/api/contact.js` |
| Vercel | `vercel.json` | `api/contact.mjs` |
| Netlify | `netlify.toml` | `functions/contact.mjs` |

All three are thin adapters over `functions/lib/contact-core.mjs`. Note that
`CONTACT_TRANSPORT=smtp` can't work on Cloudflare — Workers can't open raw TCP
connections, so use `brevo` there.

## Handover

- [x] Source code
- [x] Documentation: this file, `CONTENT.md`, `DEPLOY.md`, `BLOCKERS.md`
- [x] Asset inventory: [ASSET_INVENTORY.md](./ASSET_INVENTORY.md)
- [ ] Repository transferred to MHSV® and hosting credentials handed over
- [ ] `infos@mhsv.ch` set as `CONTACT_RECIPIENT`
- [ ] Legal pages replaced with counsel's final text
- [ ] Client sign-off on the strings in `CONTENT.md`
