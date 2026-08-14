# Blockers — decisions needed from MHSV® before production

The site is complete and deployable as it stands. Every item below is handled
defensively: where something is unresolved, the build withholds it rather than
guessing. None of these block a prototype review; all of them block go-live.

Items 1–8 were identified in the brief. Items 9–12 surfaced while building.

---

## 1. Legal footer contradiction — **highest priority**

**The conflict.** The content pack states, in §01 and §21 of all four
languages, "Swiss non-profit association — Geneva" and specifies a full legal
footer (`MHSV Association | Swiss non-profit association | Registered office:
Geneva…`). A later client instruction says not to display association or legal
status until Me Gillioz has validated the statutes.

**What the build does.** Ships with `PUBLIC_SHOW_LEGAL_STATUS=false`, which
withholds:

- the hero's legal-status line (§01);
- the legal footer block (§21);
- the `/legal-notice/` page — not merely unlinked, it is *not generated at
  all*, so there is no URL to discover;
- §02's opening sentence, which names "MHSV Association" and states the legal
  form. A neutral authored sentence replaces it — this is the one place where
  the withholding instruction forced a change to the pack's own body copy.

`npm run build:check` fails the build if any of that wording reaches the output
while the flag is off, in any of the four languages.

**Decision needed.** Confirm which instruction governs. Then either leave the
flag off, or set `PUBLIC_SHOW_LEGAL_STATUS=true` — no code change either way.

---

## 2. `infos@mhsv-international.org` does not exist

The contact form's recipient is configurable via `CONTACT_RECIPIENT` and is
never hard-coded, as required. Until the mailbox exists, run the function with
`CONTACT_TRANSPORT=log`: the whole pipeline runs and submissions are written to
the function log rather than sent, so nothing is silently lost during testing.

**Decision needed.** Create the mailbox, then set `CONTACT_RECIPIENT` and switch
`CONTACT_TRANSPORT` to `resend` or `smtp`. See `DEPLOY.md`.

---

## 3. Team email addresses not created

Only Martial HAPPI has a published address. Gwladys ESSAI, Xavier MARTI,
Laetitia PILLER and Diego FUIANO are rendered with name and role, and a
"MHSV® address to come" marker instead of an invented address.

**Decision needed.** Supply the addresses. They go in the `.docx` (§16, as
`Name - Role - address`) and appear after `npm run content:extract`.

---

## 4. Domain: `mhsv.ch` vs `mhsv-international.org`

The pack gives `www.mhsv.ch` as the website and `@mhsv-international.org` for
email. The site builds against `PUBLIC_SITE_URL`, which drives canonical URLs,
`hreflang`, Open Graph and the sitemap.

**Decision needed.** Confirm which domain serves the site. Set
`PUBLIC_SITE_URL` accordingly and point the other domain at it with a 301, so
the two do not compete in search results.

---

## 5. Privacy policy does not exist — **legal requirement**

The consent checkbox must link to a real policy. Under the Swiss FADP this is
not optional.

**What the build does.** `/{locale}/privacy/` ships a developer-written draft
that accurately describes what this site actually does: the exact form fields
collected, the purpose, the recipient, retention, the absence of tracking
cookies and third-party analytics, and FADP rights. It carries a visible
"draft — pending legal validation" notice in all four languages.

It is an accurate starting point for the lawyer. **It is not legal advice and
must not go live unreviewed.**

**Decision needed.** Have the lawyer produce the final text; replace the
`privacy.sections` bodies in `src/content/authored/*.json` and set
`PUBLIC_PRIVACY_IS_DRAFT=false`.

---

## 6. Hosting and domain ownership not agreed

Who pays, and in whose account. This matters for handover: the client is
contractually owed admin credentials, which is only meaningful if the accounts
are theirs.

**Recommendation.** Create the hosting and domain accounts in MHSV®'s name from
the start and add the developer as a collaborator. Retro-fitting ownership is
avoidable friction. See `DEPLOY.md`.

---

## 7. MITIPS® pillar descriptions not supplied

The pack gives the six pillar labels (M/I/T/I/P/S) but no descriptions, and
states that detailed internal protocols are not for publication.

**What the build does.** Each pillar carries a short, deliberately generic
one-line description drawn from vocabulary already in the pack, under a visible
"provisional descriptions — final wording to be supplied by MHSV®" note.

**Decision needed.** Supply the six descriptions, or confirm the placeholders.
They live at `sections.method.pillarNotes` in `src/content/authored/*.json`.

---

## 8. Collection mock-ups flagged REVIEW_REQUIRED

`03_COLLECTION/*` may carry retired baselines, so **no collection imagery is
published**. §19 shows the required wording — *"MHSV® Collection in development
— conceptual, non-contractual mock-ups; future commercialisation envisaged"* —
with no images. `npm run build:check` fails if a REVIEW_REQUIRED asset is ever
referenced.

**Decision needed.** Clear the mock-ups, or supply replacements.

---

## 9. The approved logo's wordmark is French-only

`MHSV_Primary_Logo_HD.png` — the only logo approved for publication — has
"CENTRE INTERNATIONAL DE DEVELOPPEMENT & TRANSITION" set into the artwork. It
is therefore shown in French on the English, German and Italian pages.

The instruction to use only this logo and the instruction to keep the four
languages at parity cannot both be fully satisfied. The build follows the asset
rule, since it is the stricter of the two.

**Decision needed.** Either accept the French wordmark as a fixed brand element
across all languages (defensible — it is the registered mark), or commission
localised lockups. Empty, labelled placements are already reserved in §19 for
official / institutional / equipment variants.

---

## 10. Two logo-file discrepancies

- `ASSET_STATUS.csv` lists `01_LOGOS/MHSV_Logo_Concept_REFERENCE_ONLY.png`,
  which is **not present** in the delivered pack. Nothing depends on it.
- The approved logo ships as opaque artwork on a white background with a wide
  white margin. For use on the dark bands it is trimmed to its content box and
  the white background is keyed to transparency by flood-filling inward from
  the border — which leaves the white lettering inside the crest intact. No
  lettering is altered and no new variant is introduced. Icons use the crest
  above the wordmark, as the brief's "derive icons from the primary logo"
  instruction requires. Full method in `ASSET_INVENTORY.md`.

**Decision needed.** Confirm the derivation is acceptable, or supply a logo with
a transparent background.

---

## 11. §18 and §19 of the pack are developer instructions, not public copy

The pack's text for these two sections reads *"Show the cover of the Premium
Founding Book…"* and *"Provide an elegant space for the brand identity…"* —
directions to the developer, not sentences to publish.

Public copy for both was therefore written by the developer, in all four
languages. The one sentence the pack explicitly marks as *"Public wording"* —
the collection notice — is reproduced verbatim.

**Decision needed.** Review and approve the authored copy. It is listed in
`CONTENT.md`.

---

## 12. Governance titles

Per the pack, Diego FUIANO's role is published as "Website / Digital Project
Coordination" only; any governance title awaits formal confirmation. No other
roles, historical titles or organisation charts are published.

**Decision needed.** Confirm final titles for all five before go-live.

---

## Summary

| # | Item | Blocks go-live | Handled by |
| --- | --- | --- | --- |
| 1 | Legal footer contradiction | Yes | `PUBLIC_SHOW_LEGAL_STATUS=false` |
| 2 | Contact mailbox missing | Yes | `CONTACT_TRANSPORT=log` |
| 3 | Team emails missing | No | Role shown without address |
| 4 | Domain undecided | Yes | `PUBLIC_SITE_URL` |
| 5 | Privacy policy missing | Yes (legal) | Draft + visible notice |
| 6 | Hosting ownership | Yes | — |
| 7 | Pillar descriptions | No | Placeholders + visible note |
| 8 | Collection mock-ups | No | No imagery published |
| 9 | French-only wordmark | No | Asset rule followed |
| 10 | Logo file discrepancies | No | Documented derivation |
| 11 | §18/§19 authored copy | No | Listed in `CONTENT.md` |
| 12 | Governance titles | Yes | Only §16 roles published |
