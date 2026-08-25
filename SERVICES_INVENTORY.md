# MHSV® Website — External Services & Data Inventory

For MHSV®'s records. Not published on the website.

Prepared for the prototype handover of 28 August 2026. It describes the site
**as built**, and marks clearly where a value is not yet decided — those are
decisions for MHSV®, not omissions.

Last updated: 19 August 2026.

---

## Hosting

| | |
| --- | --- |
| Provider **today** | Vercel (prototype only, on the developer's account) |
| Provider **planned** | Cloudflare Pages — migration prepared, see "Open decisions" |
| Data location | Global CDN. Static files only. |
| Personal data stored | **None.** Every page is a static file built ahead of time; the server holds no visitor record, no session and no database. |

The domain is **not** connected and the repository has **not** been
transferred. Both are pending MHSV®'s decision.

---

## Form handling

Three forms: Contact, Founding Book order request, Newsletter.

| | |
| --- | --- |
| Runtime | Serverless function on the host, `functions/lib/contact-core.mjs` |
| Data transmitted | Contact: first name, last name, email, optional phone, optional organisation, message, consent. Book order: the above plus edition and quantity. Newsletter: email, optional first name, language, consent. |
| Data stored | **Nothing is retained.** The function validates, sends, and returns. There is no database, no queue and no log of submissions. |
| Recipient | Read from the `CONTACT_RECIPIENT` environment variable. Never hard-coded. Intended value `infos@mhsv.ch` — **not yet confirmed**, so the forms are not live. |
| Sender | `CONTACT_SENDER` environment variable |
| Reply-to | The address the visitor submitted |
| Spam protection | Honeypot field plus a submission-timing check. **No CAPTCHA** — a CAPTCHA would send visitor data to a third party, which this site avoids everywhere. |

### Email transport — not yet chosen

Selected by the `CONTACT_TRANSPORT` environment variable:

| Value | Service | Data leaving MHSV®'s control |
| --- | --- | --- |
| `log` | none — writes to the server log | none. **This is the current setting.** |
| `resend` | Resend (`api.resend.com`) | the whole message |
| `smtp` | any SMTP server MHSV® nominates | the whole message |

Nothing is sent anywhere while the value is `log`.

---

## Newsletter

| | |
| --- | --- |
| Provider | Selected by `NEWSLETTER_PROVIDER`. **Currently `log`** — no external service is contacted and no list exists yet. |
| Provider prepared | Brevo (`api.brevo.com`), double opt-in |
| Data that would be stored | email, first name (optional), language preference, consent timestamp |
| Location | Brevo stores EU-resident data in the EU. **To be confirmed with Brevo** against MHSV®'s own requirement before the list opens. |
| Unsubscribe | Yes, in every send — a Brevo requirement and a legal one |
| Double opt-in | Yes. No address joins the list until the recipient clicks the link in the confirmation email. |

Brevo requires an account MHSV® does not yet hold. Until then the newsletter
form validates and reports success without subscribing anyone.

---

## Cookies set by this site

**None.** The site sets no cookie of any kind — not for analytics, not for
sessions, not for preferences.

One value is stored in the browser's **localStorage**, which is not a cookie
and is never transmitted to any server:

| Key | Purpose | Duration | Party |
| --- | --- | --- | --- |
| `mhsv-cookie-notice` | remembers that the cookie notice was acknowledged, so it is not shown again | until the visitor clears their browser data | first party |

The language chosen on the `/livre` book page is carried in the URL
(`?lang=en`), not stored.

---

## Third-party scripts loaded

**None.** Verified in the built pages: zero cross-origin `<script src>`.

Fonts are self-hosted and served from MHSV®'s own domain — there is no Google
Fonts request and therefore no IP address disclosed to Google.

---

## Analytics

**None at this stage.** No Google Analytics, no Plausible, no Matomo, no
Vercel or Cloudflare Web Analytics, no pixel of any kind.

If analytics are added later they must be loaded from inside the cookie
notice's accept handler, and the notice must gain a genuine reject — as it
stands it is an acknowledgement, because there is nothing to consent to.

---

## Open decisions for MHSV®

These are the values this document cannot fill in.

1. **Hosting** — Vercel or Cloudflare Pages, and on whose account.
2. **Mailbox** — confirm `infos@mhsv.ch` exists and can receive.
3. **Email transport** — Resend, or an SMTP server MHSV® controls.
4. **Newsletter provider** — open a Brevo account, or nominate another, and
   confirm where it stores data.
5. **Domain** — connect `mhsv.ch`, including the `www` redirect.
6. **Legal texts** — the four legal pages are placeholders pending counsel.
