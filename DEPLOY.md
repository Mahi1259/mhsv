# Deployment

Static site plus one serverless function (the contact form). Nothing else runs
on a server: no database, no CMS, no third-party scripts.

---

## Before the first deploy

Two things must be settled — see `BLOCKERS.md`:

1. **Which domain serves the site** (#4). `mhsv.ch` and
   `mhsv-international.org` cannot both serve it; one must 301 to the other.
2. **Account ownership** (#6). Create the hosting and domain accounts **in
   MHSV®'s name** and add the developer as a collaborator. The client is owed
   admin credentials at handover, which only means something if the accounts
   are theirs. Retro-fitting ownership later is avoidable work.

---

## Netlify (recommended)

`netlify.toml` is committed and configures everything.

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Publish directory | `dist` |
| Functions directory | `functions` |
| Node version | 20 |

The function is exposed at `/api/contact` by `export const config` in
`functions/contact.mjs` — no redirect rule needed.

### Environment variables

Set in **Site configuration → Environment variables**.

| Variable | Value | Notes |
| --- | --- | --- |
| `PUBLIC_SITE_URL` | `https://www.mhsv.ch` | Must match the live origin exactly, including `www` |
| `PUBLIC_SHOW_LEGAL_STATUS` | `false` | Until BLOCKERS #1 is answered |
| `PUBLIC_PRIVACY_IS_DRAFT` | `true` | Until the lawyer's text lands |
| `CONTACT_RECIPIENT` | `infos@mhsv-international.org` | BLOCKERS #2 — create the mailbox first |
| `CONTACT_SENDER` | `website@mhsv.ch` | Must be on an authenticated domain you own |
| `CONTACT_TRANSPORT` | `log` → `resend` or `smtp` | See below |
| `RESEND_API_KEY` | — | Only for `resend` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | — | Only for `smtp` |

The `PUBLIC_` prefix is required for anything the browser sees; the contact
variables have no prefix and stay server-side.

---

## Cloudflare Pages

Build command and output directory are the same. The function needs a small
adapter, because the core is host-independent:

```js
// functions/api/contact.js  — Cloudflare Pages Functions
import { handleContact } from '../lib/contact-core.mjs';

export const onRequest = ({ request, env }) => handleContact(request, env);
```

Set the same variables under **Settings → Environment variables**. Use
`CONTACT_TRANSPORT=resend` — Workers have no raw TCP, so `smtp` (nodemailer)
will not run there. Headers and redirects come from `public/_redirects` and a
`public/_headers` file mirroring the `netlify.toml` header block.

---

## Contact form transports

### `log` — before the mailbox exists

Runs the full pipeline and writes the submission to the function log instead of
sending. Use this to verify the form end-to-end without losing anything.

### `resend` — recommended

Zero dependencies; the core calls the HTTP API directly. Create the key, verify
the sending domain (SPF + DKIM), set `RESEND_API_KEY`.

### `smtp` — for a Swiss host

Works with Infomaniak, Hostpoint and similar, which suits a Swiss non-profit
keeping data in Switzerland. Uses `nodemailer`, imported lazily so it is only
bundled when selected. Netlify only — see the Cloudflare note above.

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

## DNS

```
www.mhsv.ch.    CNAME   <site>.netlify.app.
mhsv.ch.        ALIAS   <site>.netlify.app.      (or the host's apex record)
```

Point the non-serving domain at the serving one with a 301 so the two do not
compete in search. HTTPS is automatic on both hosts; force the redirect.

---

## Security headers

Configured in `netlify.toml`. The Content-Security-Policy is closed to `'self'`
for scripts, styles, fonts, images and connections, because the site makes **no
third-party requests at all** — fonts are self-hosted, there is no analytics and
no CAPTCHA.

`'unsafe-inline'` is present for styles (Astro inlines the stylesheet) and for
scripts (the small inline form handler). Tightening these to hashes or a nonce
is possible later; it needs the CSP to be generated at build time.

---

## After deploy — verify

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

Re-run Lighthouse against the deployed URL — local preview has no network
latency and flatters the result.
