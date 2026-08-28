# Deployment

Static site plus one serverless function (the contact form). Nothing else runs
on a server: no database, no CMS, no third-party scripts.

---

## The build is self-contained - read this first

`npm run build` **does not need the client's developer pack.** It validates the
committed locale JSON, builds, and checks the output:

```
content:check  →  astro build  →  build:check
```

The generated content (`src/data/i18n/*.json`) and the derived assets
(`src/assets/`, `public/fonts/`, the icons) are **committed to the repository**,
because the `.docx` and `ASSET_STATUS.csv` live outside it and are not - and
should not be - pushed. The pack contains `INTERNAL_REFERENCE` material that
must never reach a public host.

Regenerating from the pack is a deliberate local step:

```bash
npm run content:extract     # after editing the .docx
npm run assets:prepare      # after new or changed artwork
npm run build:from-pack     # both, then build
```

Then commit the regenerated files. If a CI build ever calls `content:extract`,
it will fail with `ENOENT` on the `.docx` - that is the pack not being there,
not a broken script.

---

## Before the first deploy

Two things must be settled - see `BLOCKERS.md`:

1. **Which domain serves the site** (#4). `mhsv.ch` and
   `mhsv-international.org` cannot both serve it; one must 301 to the other.
2. **Account ownership** (#6). Create the hosting and domain accounts **in
   MHSV®'s name** and add the developer as a collaborator. The client is owed
   admin credentials at handover, which only means something if the accounts
   are theirs. Retro-fitting ownership later is avoidable work.

---

## Vercel

`vercel.json` is committed and configures the build, the `/` → `/fr/` 301 and
the security headers. The contact function is `api/contact.mjs`, exposed at
`/api/contact` by Vercel's file-system routing.

| Setting | Value |
| --- | --- |
| Framework preset | Astro (or "Other") |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm ci` |
| Node version | 20 or 22 |

The function runs on the **Node** runtime, not Edge, so the SMTP transport keeps
working - Edge cannot open a TCP socket. `api/contact.mjs` is a thin adapter
over the shared core in `functions/lib/contact-core.mjs`; it handles both the
pre-parsed urlencoded body Vercel hands over for a no-JavaScript submit and the
raw multipart stream from the JavaScript submit. `npm run test:api` covers both.

Set the environment variables from the table below under **Settings →
Environment variables**, for Production *and* Preview.

`netlify.toml`, `public/_redirects` and `public/_headers` are also committed so
the project stays portable; Vercel ignores them.

---

## Netlify

`netlify.toml` is committed and configures everything.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `functions` |
| Node version | 20 |

The function is exposed at `/api/contact` by `export const config` in
`functions/contact.mjs` - no redirect rule needed.

### Environment variables

The same set applies to Vercel, Netlify and Cloudflare.

| Variable | Value | Notes |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://www.mhsv.ch` | **Production only.** Must match the live origin exactly, including `www`. Leave it unset on Preview so previews canonicalise to themselves |
| `PUBLIC_SHOW_LEGAL_STATUS` | `false` | Until BLOCKERS #1 is answered |
| `PUBLIC_PRIVACY_IS_DRAFT` | `true` | Until the lawyer's text lands |
| `CONTACT_RECIPIENT` | `infos@mhsv-international.org` | BLOCKERS #2 - create the mailbox first |
| `CONTACT_SENDER` | `website@mhsv.ch` | Must be on an authenticated domain you own |
| `CONTACT_TRANSPORT` | `log` → `brevo` or `smtp` | See below |
| `BREVO_API_KEY` | - | Required for `brevo`; the same key serves the newsletter |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | - | Only for `smtp` |

The `PUBLIC_` prefix is required for anything the browser sees; the contact
variables have no prefix and stay server-side.

---

## Cloudflare Pages

### Project settings - set these first

`wrangler.toml` supplies `pages_build_output_dir` and the compatibility flags,
but **not the build command**. That one lives in the dashboard, and without it
the deploy log says:

```
No build command specified. Skipping build step.
```

and Cloudflare uploads nothing, because `dist/` is generated and gitignored.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | the repository root |
| Node version | 20 or later (`NODE_VERSION=20` if the default is older) |

`CONTACT_TRANSPORT` **must be `brevo` or `log` here, never `smtp`.** Workers
cannot open raw TCP connections, so nodemailer cannot run - the code refuses it
with a clear error rather than failing obscurely, and the module is kept out of
the bundle entirely. Run `npm run check:functions` before pushing to confirm
the Worker still bundles; it runs Cloudflare's own bundler, which follows
imports the test suite never evaluates.

The function needs a small adapter, because the core is host-independent:

```js
// functions/api/contact.js  - Cloudflare Pages Functions
import { handleContact } from '../lib/contact-core.mjs';

export const onRequest = ({ request, env }) => handleContact(request, env);
```

Set the same variables under **Settings → Environment variables**. Use
`CONTACT_TRANSPORT=brevo` - Workers have no raw TCP, so `smtp` (nodemailer)
will not run there. Headers and redirects come from `public/_redirects` and a
`public/_headers` file mirroring the `netlify.toml` header block.

---

## Contact form transports

### `log` - before the mailbox exists

Runs the full pipeline and writes the submission to the function log instead of
sending. Use this to verify the form end-to-end without losing anything.

### `brevo` - the provider MHSV® selected

Zero dependencies; the core calls the HTTP API directly. Create the key, verify
the sending domain (SPF + DKIM), set `BREVO_API_KEY`. The same key is used by
the newsletter's double opt-in, so there is one account and one key to manage.

### `smtp` - for a Swiss host

Works with Infomaniak, Hostpoint and similar, which suits a Swiss non-profit
keeping data in Switzerland. Uses `nodemailer`, imported lazily so it is only
bundled when selected. Netlify only - see the Cloudflare note above.

**`CONTACT_SENDER` must be on a domain you control and have authenticated.**
Sending as the visitor's address will fail SPF/DKIM and land in spam. The
visitor's address is set as `Reply-To`, so replying still works normally.

### Verifying after deploy

```bash
npm run test:contact     # handler logic, no network

# against the deployed function
curl -i -X POST https://<site>/api/contact \
  -H 'Accept: application/json' \
  -F firstName=Test -F lastName=Test -F email=test@example.com \
  -F profile=Test -F subject=Test -F message=Test -F consent=on
```

Expect `{"ok":true}`. Then submit the real form in a browser with JavaScript
disabled and confirm the redirect to `/{locale}/message-sent/`.

---

## Domain and DNS

### Changing the domain later

The domain is **not hard-coded anywhere**. `vercel.json` and `netlify.toml`
contain no domain; the content pack's `www.mhsv.ch` in §21 is display text, not
configuration. To move to a different domain:

1. Attach the domain in the host's dashboard.
2. Set `PUBLIC_SITE_URL` to the new origin (Production environment).
3. Redeploy.

Canonical links, `hreflang`, Open Graph URLs, the sitemap and `robots.txt` all
regenerate from it. Every build prints what it resolved:

```
· building for https://www.mhsv.ch  (from PUBLIC_SITE_URL)
```

Check that line in the deploy log - it is the fastest way to catch a
misconfigured origin.

If the domain shown in the page's §21 contact block also changes, that is
client content: edit the `.docx`, run `npm run content:extract`, commit.

### Records

```
www.mhsv.ch.    CNAME   cname.vercel-dns.com.        (Vercel)
mhsv.ch.        A       76.76.21.21                  (Vercel apex)
```

Netlify equivalents are `<site>.netlify.app` as CNAME / ALIAS.

Point the non-serving domain at the serving one with a 301 so the two do not
compete in search. HTTPS is automatic on both hosts; force the redirect.

### Preview deployments

Previews resolve their origin to their own `*.vercel.app` URL and ship
`noindex` plus `Disallow: /`, so they can never be indexed or send crawlers to
production. Do **not** set `PUBLIC_SITE_URL` on the Preview environment - that
would make previews claim to be production.

---

## Security headers

Configured in `netlify.toml`. The Content-Security-Policy is closed to `'self'`
for scripts, styles, fonts, images and connections, because the site makes **no
third-party requests at all** - fonts are self-hosted, there is no analytics and
no CAPTCHA.

`'unsafe-inline'` is present for styles (Astro inlines the stylesheet) and for
scripts (the small inline form handler). Tightening these to hashes or a nonce
is possible later; it needs the CSP to be generated at build time.

---

## After deploy - verify

```bash
npm run build && npm run preview     # locally, one terminal
npm run audit                        # another terminal
```

Then against the live site:

- `/` redirects to `/fr/`;
- all four locales load and the language switcher preserves the current page;
- `https://<site>/sitemap-index.xml` and `/robots.txt` show the right origin;
- `hreflang` tags point at the live domain, not localhost;
- the contact form works with **and without** JavaScript;
- Lighthouse ≥ 95 on all four categories (locally: 100 desktop, 97–99 mobile).

Re-run Lighthouse against the deployed URL - local preview has no network
latency and flatters the result.
