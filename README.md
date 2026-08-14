# MHSV® — Phase 1 website

Single-page, four-language showcase site for **MHSV® — International Centre for
Development and Transition** (Geneva, Switzerland).

Built with **Astro** (static output), **Tailwind CSS v4** and **TypeScript**.
Ships as plain HTML/CSS with a few kilobytes of JavaScript, so it can be hosted
almost anywhere.

| | |
| --- | --- |
| Languages | French (default), English, Swiss Standard German, Italian |
| URLs | `/fr/`, `/en/`, `/de/`, `/it/` — `/` redirects to `/fr/` |
| Sections | 21, on one page per language |
| Content source | `../MHSV_Website_Content_Pack_Phase1_Developer_Ready_V3.docx` |
| Lighthouse | 100 desktop · 97–99 mobile (perf), 100 a11y / best practices / SEO |
| Page weight | ~227 kB total, no third-party requests |

> **Before production, read [`BLOCKERS.md`](./BLOCKERS.md).** Eight items need a
> client decision — including the legal-footer contradiction and the missing
> privacy policy, which is a legal requirement under the Swiss FADP.

---

## Quick start

```bash
npm install
npm run assets:prepare     # derive logo, icons, fonts from the developer pack
npm run dev                # http://localhost:4321
```

`assets:prepare` reads the client pack in the parent directory. If you moved it,
point at it explicitly:

```bash
MHSV_ASSET_PACK=/path/to/pack npm run assets:prepare
MHSV_CONTENT_DOCX=/path/to/pack/…V3.docx npm run content:extract
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Extract content → check parity → build → check output |
| `npm run preview` | Serve the production build locally |
| `npm run content:extract` | Re-read the .docx into `src/content/i18n/*.json` |
| `npm run content:check` | Fail if the four locales are not key-for-key identical |
| `npm run assets:prepare` | Re-derive logo, favicons, book covers, fonts |
| `npm run build:check` | Verify the built output honours the client's hard constraints |
| `npm run audit` | Overflow + WCAG 2.1 AA audit, 4 locales × 4 viewports (needs `npm run preview` running) |
| `npm run test:contact` | Unit-test the contact handler (validation, spam, both response modes) |
| `npm run typecheck` | `astro check` |
| `node scripts/shot.mjs de 320` | Screenshot a locale at a given width |

`npm run build` runs the content and output checks itself, so a build that
succeeds is a build that satisfies the constraints.

---

## Project layout

```
scripts/
  extract-content.mjs      .docx  ->  src/content/i18n/{fr,en,de,it}.json
  check-content.mjs        key parity + banned wording across locales
  prepare-assets.mjs       logo/icon/cover derivation, font subsetting
  check-build.mjs          post-build constraint gate
  audit.mjs                responsive + accessibility audit
  test-contact.mjs         contact-handler tests
  shot.mjs                 screenshot helper

src/
  config/site.ts           locales, feature flags, section order + band tones
  content/
    i18n/*.json            GENERATED — do not edit by hand
    authored/*.json        hand-written UI strings (see CONTENT.md)
    _audit/                raw pack text, for client cross-checking
  lib/                     i18n access, text helpers
  layouts/                 Base (document shell), Page (short pages)
  components/
    sections/              one component per numbered section, 01–21
    Header / Footer / Band / StatusBadge / ContactForm
  pages/
    index.astro            language gateway + redirect to /fr/
    [lang]/index.astro     the single page
    [lang]/privacy.astro
    [lang]/legal-notice.astro     (only built when the legal flag is on)
    [lang]/message-sent.astro     (no-JS form result)
    [lang]/message-error.astro
    robots.txt.ts

functions/
  contact.mjs              Netlify entry point for POST /api/contact
  lib/contact-core.mjs     host-independent validation + sending
```

---

## Editing content

**Never edit `src/content/i18n/*.json` directly — it is overwritten on every
build.**

- **Copy that comes from the client's content pack**: edit the `.docx`, then run
  `npm run content:extract`. The parser maps the 21 numbered sections in each of
  the four language blocks onto a fixed shape.
- **UI strings, form labels, legal pages, and public copy for §18/§19**: edit
  `src/content/authored/{fr,en,de,it}.json`. These are merged over the extracted
  content and win where the keys collide.

See [`CONTENT.md`](./CONTENT.md) for the split, and for the list of strings that
still need client validation.

### Semantic parity

The four locales must express the same things — a client requirement.
`npm run content:check` fails the build if any locale is missing a key another
has, or if parallel lists differ in length (six mission areas in French but five
in German, say). It also fails on retired wording such as "Beyond Football".

### Adding a language

1. Add the language block to the `.docx`, following the existing 21-section
   layout and starting it with a flag emoji marker.
2. Register the marker and the parsing hints in `scripts/extract-content.mjs`
   (`LANG_MARKERS`, `HINTS`).
3. Add the locale to `LOCALES` in `src/config/site.ts` and to `i18n.locales` in
   `astro.config.mjs`.
4. Copy an existing `src/content/authored/*.json`, translate it, and import the
   new JSON in `src/lib/i18n.ts`.
5. Run `npm run content:extract && npm run content:check`.

Routing, `hreflang`, the sitemap, the language switcher and the footer index all
derive from `LOCALES`, so nothing else needs touching.

---

## Adding a section

Sections are declared once, in `SECTION_ORDER` in `src/config/site.ts` — id,
anchor and band tone. Add an entry, create
`src/components/sections/YourSection.astro` following any existing one, and
render it in `src/pages/[lang]/index.astro`. The footer index and the anchor
navigation pick it up automatically.

This is the modular seam the brief asks for: later phases can add sections, and
eventually whole routes, without reworking the page.

---

## Feature flags

Set in the environment; see `.env.example`.

| Variable | Default | Effect |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://www.mhsv.ch` | Canonical URLs, `hreflang`, Open Graph, sitemap |
| `PUBLIC_SHOW_LEGAL_STATUS` | `false` | Reveals the hero legal line, the legal footer, the `/legal-notice/` page, and restores §02's original opening sentence |
| `PUBLIC_PRIVACY_IS_DRAFT` | `true` | Shows the "pending legal validation" notice on the privacy page |

`PUBLIC_SHOW_LEGAL_STATUS` exists because the content pack and a later client
instruction contradict each other (BLOCKERS #1). Both states build and pass all
checks; flip one variable once the client decides.

---

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for Netlify and Cloudflare, DNS, the contact-form
mailbox, and the security headers.

Short version: build command `npm run build`, publish directory `dist`,
functions directory `functions`.

---

## Handover checklist

- [x] Full source code
- [x] Technical documentation — this file, `CONTENT.md`, `DEPLOY.md`, `BLOCKERS.md`
- [x] Asset inventory — [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md), generated from `ASSET_STATUS.csv`
- [ ] Git repository access — create the repo and add MHSV® as owner
- [ ] Hosting / admin credentials — see `DEPLOY.md`
- [ ] `infos@mhsv-international.org` created and set as `CONTACT_RECIPIENT`
- [ ] Privacy policy replaced with the lawyer's text
- [ ] Client sign-off on the strings listed in `CONTENT.md`
# mhsv
