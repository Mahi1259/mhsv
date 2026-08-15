# Blockers — decisions needed from MHSV®

Updated after the **14 August 2026 update brief**, which resolved several
earlier items. The site is complete and deployable as it stands; everything
below is handled defensively — where something is unresolved, the build
withholds it rather than guessing.

---

## Resolved by the 14 August brief

| Was blocking | Now |
| --- | --- |
| Domain undecided (`mhsv.ch` vs `mhsv-international.org`) | **`https://www.mhsv.ch`.** Applied everywhere; the retired domain fails the build if it reappears |
| Contact mailbox did not exist | **`infos@mhsv.ch`**, still configurable via `CONTACT_RECIPIENT` |
| Team emails missing | All six published: `m.happi@mhsv.ch` for the founder, `infos@mhsv.ch` for the rest |
| Governance list unconfirmed | Six approved people, no photos |
| Founding Book presentation | Covers only, order-request flow, permanent `/livre` page |

---

## 1. Legal footer contradiction — **still open, highest priority**

The content pack states "Swiss non-profit association — Geneva" (§01, §21) and
specifies a full legal footer. A later client instruction says not to display
association or legal status until the lawyer has validated the statutes. The
14 August brief does not resolve this — it says only "keep Legal Notice and
Privacy Policy placeholders; final legal wording remains subject to approval".

**What the build does.** Ships with `PUBLIC_SHOW_LEGAL_STATUS=false`, which
withholds the hero status line, the legal footer, the `/legal-notice/` page
(not generated at all, so there is no URL to find), and §02's opening sentence,
which names "MHSV Association" and states the legal form. A neutral authored
sentence replaces that one line.

`npm run build:check` fails if any of that wording reaches the output in any of
the four languages.

**Decision needed.** Confirm which instruction governs, then leave the flag off
or set it to `true`. No code change either way.

---

## 2. Privacy policy does not exist — **legal requirement**

Three forms now ask for consent and all three must link to a real policy. Under
the Swiss FADP this is not optional.

**What the build does.** `/{locale}/privacy/` ships a developer-written draft
describing what the site actually does: the exact fields each form collects,
the purpose, the recipient, retention, the absence of tracking cookies and
third-party analytics, and FADP rights. It carries a visible "draft — pending
legal validation" notice in all four languages.

**It is not legal advice and must not go live unreviewed.** The newsletter adds
a processor (the mailing provider) that the final text must name.

**Decision needed.** Lawyer's text → replace `privacy.sections` in
`src/content/authored/*.json`, set `PUBLIC_PRIVACY_IS_DRAFT=false`.

---

## 3. Newsletter provider account

The subscription flow is built and tested but points at nothing yet. It runs
with `NEWSLETTER_PROVIDER=log` — subscriptions are written to the function log
rather than a list, so nothing is lost while the account is set up.

Deliberately not a bespoke list: double opt-in, unsubscribe links and
suppression are what a provider is for, and a home-grown list would put
subscriber data in this repository's blast radius.

**Decision needed.** Create the Brevo (or equivalent) account, a list, and a
double-opt-in template, then set `BREVO_API_KEY`, `BREVO_LIST_ID` and
`BREVO_DOI_TEMPLATE_ID`. Until then the section works but subscribes nobody.

---

## 4. Book price, shipping and payment

Not approved, so the flow is an **order request**, never a purchase: no price,
no cart, no payment integration. `npm run test:forms` asserts the payload
carries no price, amount, payment, card, total or currency field, and
`build:check` fails if the page ever mentions a checkout.

**Decision needed.** Price and shipping terms, and whether Phase 2 should take
payment at all.

---

## 5. QR code — print approval

`npm run qr` produces the print assets in `qr/` (vector SVG plus 300 dpi PNGs
at 25 mm and 30 mm). They encode exactly `https://www.mhsv.ch/livre`, verified
by decoding the generated files, not merely by trusting the encoder.

**This cannot be corrected after printing.** Before the file goes to print:

1. `/livre` must be live over HTTPS on the real domain and approved.
2. Test a printed proof on several phones, systems and scanner apps.
3. Approve the proof in writing.

Per the brief, the QR is **not** integrated into the book covers here — MHSV®'s
layout specialist places the supplied files.

---

## 6. Hosting and domain ownership

Create the hosting and domain accounts **in MHSV®'s name** and add the
developer as a collaborator. The client is owed admin credentials at handover,
which only means something if the accounts are theirs.

---

## 7. MITIPS® pillar descriptions

The pack gives the six labels but no descriptions, and states that detailed
internal protocols are not for publication. Each pillar carries a short generic
line drawn from vocabulary already in the pack, under a visible "provisional
descriptions — final wording to be supplied by MHSV®" note.

**Decision needed.** Supply the six descriptions, or confirm the placeholders.
They live at `sections.method.pillarNotes`.

---

## 8. The approved logo's wordmark is French-only

`MHSV_Primary_Logo_HD.png` has "CENTRE INTERNATIONAL DE DEVELOPPEMENT &
TRANSITION" set into the artwork, so it appears in French on the English,
German and Italian pages. The instruction to use only this logo and the
four-language parity requirement cannot both be fully satisfied; the build
follows the asset rule, being the stricter.

**Decision needed.** Accept the French wordmark as a fixed brand element, or
commission localised lockups. Labelled placements are already reserved in the
identity section for the official / institutional / equipment variants.

---

## 9. Authored copy needing client validation

Listed in full in `CONTENT.md`. The most important:

- **DE and IT** versions of everything the 14 August brief supplies only in
  FR/EN: governance roles, book copy, order form, newsletter.
- The **book and identity** public copy, because the pack's own text for those
  sections is instructions to the developer ("Show the cover of…") rather than
  publishable prose.
- All **form labels, validation messages and confirmations** in four languages.

---

## Summary

| # | Item | Blocks go-live | Handled by |
| --- | --- | --- | --- |
| 1 | Legal footer contradiction | Yes | `PUBLIC_SHOW_LEGAL_STATUS=false` |
| 2 | Privacy policy missing | Yes (legal) | Draft + visible notice |
| 3 | Newsletter provider | Yes, for that section | `NEWSLETTER_PROVIDER=log` |
| 4 | Book price / payment | No | Order request, not a purchase |
| 5 | QR print approval | Before print | Files generated and decode-verified |
| 6 | Hosting ownership | Yes | — |
| 7 | Pillar descriptions | No | Placeholders + visible note |
| 8 | French-only wordmark | No | Asset rule followed |
| 9 | Authored copy | No | Listed in `CONTENT.md` |
