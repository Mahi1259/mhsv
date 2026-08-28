# MHSV® - Phase 1 website

Single-page, four-language showcase site for **MHSV® - International Centre for
Development and Transition** (Geneva, Switzerland).

Built with **Astro** (static output), **Tailwind CSS v4** and **TypeScript**.
Ships as plain HTML/CSS with a few kilobytes of JavaScript, so it can be hosted
almost anywhere.

| | |
| --- | --- |
| Languages | French (default), English, Swiss Standard German, Italian |
| URLs | `/fr/`, `/en/`, `/de/`, `/it/` - `/` redirects to `/fr/` |
| Sections | 21, on one page per language, in five archetypes |
| Content source | `…Content_Pack_Phase1_Developer_Ready_V3.docx`, superseded where the 14 Aug 2026 brief differs |
| Pages | one per locale, plus `/livre` (permanent QR destination), privacy, form results |
| Forms | contact · book order request · newsletter (double opt-in) |
| Lighthouse | 100 desktop · 97–99 mobile (perf), 100 a11y / best practices / SEO |
| Page weight | ~227 kB total, no third-party requests |

> **Before production, read [`BLOCKERS.md`](./BLOCKERS.md).** The 14 August 2026
> brief resolved the domain, mailboxes and governance. What remains includes the
> legal-footer contradiction, the missing privacy policy (a legal requirement
> under the Swiss FADP), and the newsletter provider account.

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

| Command | What it does | Needs the pack? |
| --- | --- | --- |
| `npm run dev` | Dev server with hot reload | no |
| `npm run build` | Check parity → build → check output | **no** |
| `npm run preview` | Serve the production build locally | no |
| `npm run content:check` | Fail if the four locales are not key-for-key identical | no |
| `npm run build:check` | Verify the built output honours the client's hard constraints | no |
| `npm run test` | All form tests: contact, book order, newsletter, Vercel adapter | no |
| `npm run qr` | Regenerate the printed QR code assets in `qr/` | no |
| `npm run audit` | Overflow + WCAG 2.1 AA audit, 4 locales × 4 viewports (needs `npm run preview` running) | no |
| `npm run typecheck` | `astro check` | no |
| `node scripts/shot.mjs de 320` | Screenshot a locale at a given width | no |
| `npm run content:extract` | Re-read the .docx into `src/data/i18n/*.json` | **yes** |

**Forms in dev.** `npm run dev` serves `/api/contact` through the same handler
the deployed function uses, so the contact and order forms work on the ordinary
dev server. Mail is **logged to the terminal, not sent**, even when `.env` holds
working Brevo or SMTP credentials - submitting a form while trying things out
must not deliver to a real inbox. To send for real:
`npm run dev:send`, or put `MHSV_DEV_SEND=yes` in `.env` to make it the default
for your checkout. `npm run dev:cf` runs the real Cloudflare function over
`dist/` and always obeys `.env`.

It works with no `.env` at all - dev falls back to a placeholder recipient,
since nothing is being delivered. `.env` is re-read on every request, so editing
it needs no restart.

**Changing `dev-api.mjs` does need a restart.** Astro restarts the dev server
when `astro.config.mjs` changes but not when a module it imports changes, so the
old middleware stays in memory and you keep seeing the previous behaviour.
| `npm run assets:prepare` | Re-derive logo, favicons, book covers, fonts | **yes** |
| `npm run build:from-pack` | Both of the above, then build | **yes** |

`npm run build` runs the content and output checks itself, so a build that
succeeds is a build that satisfies the constraints.

### The build does not need the client's pack

The generated locale JSON and the derived assets are **committed**. The `.docx`
and `ASSET_STATUS.csv` live outside the repository and are deliberately not
pushed - the pack contains `INTERNAL_REFERENCE` material that must never reach a
public host.

So regenerating is an explicit local step (`content:extract` / `assets:prepare`),
and you commit the result. Deployment just runs `npm run build`.

---

## Project layout

```
scripts/
  extract-content.mjs      .docx  ->  src/data/i18n/{fr,en,de,it}.json
  check-content.mjs        key parity + banned wording across locales
  prepare-assets.mjs       logo/icon/cover derivation, font subsetting
  check-build.mjs          post-build constraint gate
  audit.mjs                responsive + accessibility audit
  generate-qr.mjs          print-ready QR for /livre, decode-verified
  patch-authored.mjs       applies the 14 Aug brief to the authored content
  test-contact.mjs         contact-form tests
  test-forms.mjs           book-order + newsletter tests
  test-vercel-api.mjs      Vercel (req,res) adapter tests
  shot.mjs                 screenshot helper

src/
  config/site.ts           locales, flags, section order + archetypes + grounds
  content/
    i18n/*.json            GENERATED - do not edit by hand
    authored/*.json        hand-written UI strings (see CONTENT.md)
    _audit/                raw pack text, for client cross-checking
  lib/                     i18n access, text helpers
  scripts/                 motion.ts (reveals, counters), forms.ts (submit)
  layouts/                 Base (document shell), Page (short pages)
  components/
    sections/              one component per section
    Header / Footer / Band / StatusBadge
    FormShell + ContactForm / BookOrderForm / NewsletterForm
  pages/
    index.astro            language gateway + redirect to /fr/
    livre.astro            PERMANENT QR destination - bilingual, must not move
    [lang]/index.astro     the single page
    [lang]/privacy.astro
    [lang]/legal-notice.astro     (only built when the legal flag is on)
    [lang]/message-sent.astro     (no-JS contact result)
    [lang]/order-sent.astro       (no-JS book-order result)
    [lang]/newsletter-sent.astro  (no-JS newsletter result)
    robots.txt.ts

qr/                        print assets - deliberately NOT under public/

api/contact.mjs            Vercel entry point for POST /api/contact
functions/
  contact.mjs              Netlify entry point
  lib/contact-core.mjs     host-independent validation + sending, all 3 forms
```

---

## Editing content

**Never edit `src/data/i18n/*.json` directly - it is overwritten on every
build.**

- **Copy that comes from the client's content pack**: edit the `.docx`, then run
  `npm run content:extract`. The parser maps the 21 numbered sections in each of
  the four language blocks onto a fixed shape.
- **UI strings, form labels, legal pages, and public copy the pack does not
  provide**: edit
  `src/data/authored/{fr,en,de,it}.json`. These are merged over the extracted
  content and win where the keys collide.

See [`CONTENT.md`](./CONTENT.md) for the split, and for the list of strings that
still need client validation.

### Semantic parity

The four locales must express the same things - a client requirement.
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
4. Copy an existing `src/data/authored/*.json`, translate it, and import the
   new JSON in `src/lib/i18n.ts`.
5. Run `npm run content:extract && npm run content:check`.

Routing, `hreflang`, the sitemap, the language switcher and the footer index all
derive from `LOCALES`, so nothing else needs touching.

---

## Design system

The ground is **navy**, not black. The approved logo's shield is `#001D49`;
black sits badly beside it. Gold is an accent only - rules, active states,
small marks - never a large fill.

```css
--navy: #0C1D3A;  --navy-deep: #071426;  --navy-raise: #14284A;
--gold: #D4AF37;  --gold-soft: #E8C877;  --gold-ink: #7A6224;  /* gold on light */
--bone: #F5F3EF;  --white: #FFFFFF;
```

`--gold-ink` exists because `--gold` on `--bone` is 2.6:1 and fails AA. Never
set `--gold` as text on a light band.

### Section archetypes

Every section takes one of five types, declared once in `SECTION_ORDER`. Each
has its own measure and vertical rhythm - identical slab heights were what made
a 21-section page read as 21 slides.

| Type | Used for | Character |
| --- | --- | --- |
| `hero` | the hero alone | Full viewport, the largest type on the site |
| `statement` | who we are, vision, programmes, founder | Wide measure, large text, lots of air |
| `grid` | mission, services, ecosystem, team, roadmap | Cards or columns |
| `feature` | MITIPS®, programmes & fees, book, newsletter, contact | Asymmetric |
| `quiet` | who we support, inclusion, identity | Narrow, understated, recessive |

**There are no section numbers.** The 01–21 numbering is the content pack's
internal editorial index, not website copy. On wide screens a sticky margin
label shows the short navigation name instead, which actually orients.

**There are no dividers between sections.** Separation is space plus an
occasional change of ground - about every third or fourth section, gradiented
over ~160px rather than hard-cut.

### Motion

Scroll reveals (fade + 20px rise, 700ms), staggered children, a drawn pathway
line, counters on concrete figures, and 150–200ms transitions on every
interactive state.

**`prefers-reduced-motion: reduce` disables all of it.** The reveal styles only
apply under `html.js`, and that class is added by script *after* the preference
check - so with reduced motion, or with JavaScript off, nothing is ever hidden
and nothing animates. Verified: 0 elements with an active transition or
animation.

---

## Adding a section

Sections are declared once, in `SECTION_ORDER` in `src/config/site.ts` - id,
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
| `PUBLIC_SITE_URL` | auto-detected - see below | Canonical URLs, `hreflang`, Open Graph, sitemap, robots.txt |
| `PUBLIC_SHOW_LEGAL_STATUS` | `false` | Reveals the hero legal line, the legal footer, the `/legal-notice/` page, and restores §02's original opening sentence |
| `PUBLIC_PRIVACY_IS_DRAFT` | `true` | Shows the "pending legal validation" notice on the privacy page |

`PUBLIC_SHOW_LEGAL_STATUS` exists because the content pack and a later client
instruction contradict each other (BLOCKERS #1). Both states build and pass all
checks; flip one variable once the client decides.

### Changing the domain

The domain lives in **one place**: `PUBLIC_SITE_URL`. Set it, redeploy, done -
canonical links, `hreflang` alternates, Open Graph URLs, the sitemap and
`robots.txt` all follow. Nothing is hard-coded, and neither `vercel.json` nor
`netlify.toml` contains a domain.

When it is not set, `site-url.mjs` works out the origin:

| Situation | Origin used | Indexable |
| --- | --- | --- |
| `PUBLIC_SITE_URL` set | that value | yes |
| Vercel production, not set | the project's production domain (follows the custom domain once attached) | yes |
| Vercel preview / branch deploy | that deployment's own URL | **no** - `noindex` + `Disallow: /` |
| Local build | `http://localhost:4321` | no |

Preview deployments canonicalise to themselves and are blocked from indexing,
so a `*.vercel.app` URL can never be indexed or point crawlers at production.
Every build prints the origin it used:

```
· building for https://www.mhsv.ch  (from PUBLIC_SITE_URL)
```

---

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for Vercel, Netlify and Cloudflare, DNS, the
contact-form mailbox, and the security headers.

Short version - build command `npm run build`, output directory `dist`:

| Host | Config | Contact function |
| --- | --- | --- |
| **Vercel** | `vercel.json` | `api/contact.mjs` (Node runtime) |
| Netlify | `netlify.toml` | `functions/contact.mjs` |
| Cloudflare | `public/_redirects`, `public/_headers` | adapter in `DEPLOY.md` |

All three share the validation and sending logic in
`functions/lib/contact-core.mjs`; the per-host files are thin adapters.

---

## Handover checklist

- [x] Full source code
- [x] Technical documentation - this file, `CONTENT.md`, `DEPLOY.md`, `BLOCKERS.md`
- [x] Asset inventory - [`ASSET_INVENTORY.md`](./ASSET_INVENTORY.md), generated from `ASSET_STATUS.csv`
- [ ] Git repository access - create the repo and add MHSV® as owner
- [ ] Hosting / admin credentials - see `DEPLOY.md`
- [ ] `infos@mhsv-international.org` created and set as `CONTACT_RECIPIENT`
- [ ] Privacy policy replaced with the lawyer's text
- [ ] Client sign-off on the strings listed in `CONTENT.md`
# mhsv
