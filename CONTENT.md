# Content — where every string comes from

Two sources feed `src/content/i18n/{fr,en,de,it}.json`, which is **generated**
and must never be hand-edited:

```
MHSV_Website_Content_Pack_…_V3.docx   ──┐
                                         ├──►  src/content/i18n/{loc}.json
src/content/authored/{loc}.json       ──┘        (authored wins on collision)
```

Run `npm run content:extract` after changing either.

---

## 1. From the client's pack (do not retype — edit the .docx)

The document holds four parallel language blocks, each with the same 21
numbered sections. The extractor segments by language marker, then by
`NN — TITLE`, then maps each section's blocks onto a fixed shape.

| § | Section | What is extracted |
| --- | --- | --- |
| 01 | Hero | brand, institutional name, legal status, baseline, tagline, intro, 4 CTA labels |
| 02 | Who we are | lead + 2 paragraphs |
| 03 | Vision 2035 | lead, 3-step arc, closing note |
| 04 | Mission | 6 × title + body |
| 05 | Who we support | 9 audience items |
| 06 | Method & MITIPS® | lead, 6 pillars (letter + name), note |
| 07 | Services | 9 service areas |
| 08 | Pathway | 6 steps, note |
| 09 | Programmes in action | lead, 3 paragraphs, status |
| 10 | Founding programmes | 2 tables (title + label/value rows) |
| 11 | International & events | lead, 3 paragraphs, status |
| 12 | Ecosystem | lead, 9 disciplines, note |
| 13 | Fees | plan name, price line, 2 paragraphs |
| 14 | Inclusion | 2 paragraphs, status |
| 15 | Digital | roadmap items, 2 paragraphs, status |
| 16 | Team | 5 × name / role / email-or-pending |
| 17 | Founder | name, role, bio, quote |
| 18 | Founding book | *(nothing — see below)* |
| 19 | Identity | collection notice (verbatim), status |
| 20 | Roadmap | 7 items, status |
| 21 | Contact | tagline, contact line, legal footer |

`src/content/_audit/source-blocks.json` holds the raw pack text per section per
language, so the client can check any rendered string against its source.

### Parsing assumptions

The extractor relies on the pack's structure. If a future revision changes
these, extraction fails loudly rather than silently producing wrong output:

- exactly four language blocks, each opened by a flag emoji;
- exactly 21 sections per language, headed `NN — TITLE`;
- the same block order within each section across all four languages;
- lists separated by `;`, `|` or `->`, matching the current document;
- §12 introduces its discipline list with `:` in FR/DE/IT and with
  `including` in EN — the one place the document is not uniform, handled by a
  per-locale hint in `scripts/extract-content.mjs`.

---

## 2. Authored by the developer — **needs client validation**

These are not in the pack. They were written for the prototype and should be
reviewed, especially the FR/DE/IT wording. All live in
`src/content/authored/{loc}.json`.

### Interface

Navigation labels · skip link · menu and language-switcher labels · "back to
top" · footer column headings · required/optional markers.

### Publication status badges

The pack defines the five states in French only, in its legend table. The French
labels are the pack's own; **English, German and Italian are authored.** V3 only
ever uses the "in development" state; the other four are wired up for future
content.

### Contact form

All field labels, the placeholder, the consent sentence, the submit and sending
labels, success and error messages, and every per-field validation message —
in all four languages.

### §18 Founding book, §19 Identity — *most important to review*

The pack's text for these sections is **instructions to the developer**
("Show the cover of…", "Provide an elegant space for…"), not publishable prose.
Public copy was therefore written: the book's lead, description and no-download
notice; the identity lead, logo caption and reserved-placement labels.

The one sentence the pack marks as *"Public wording"* — the collection notice —
is reproduced **verbatim** and is covered by a hard constraint.

### §02 alternative opening

`sections.about.leadNoLegalStatus` replaces the pack's opening sentence while
`PUBLIC_SHOW_LEGAL_STATUS` is off, because the original names "MHSV
Association" and states the legal form. See BLOCKERS #1.

### MITIPS® pillar descriptions

Six provisional one-liners (BLOCKERS #7), shown under a visible "provisional"
note. Drawn from vocabulary already in the pack; no internal protocol is
revealed.

### Short leads

Single introductory sentences for §05, §07, §10, §13, §16, §20 and §21, where
the pack supplies a bare list and the section needed an opening line.

### Legal pages

The whole privacy policy (BLOCKERS #5) and the legal-notice page scaffolding.
**The privacy text is a draft for the client's lawyer, not legal advice.**

### Swiss German note

The German file uses Swiss Standard German throughout: **`ss`, never `ß`** —
matching the pack, which writes "Fussball" and "ausserordentlich".

---

## 3. Guarantees enforced at build time

`npm run content:check`:

- every locale has exactly the same keys — a missing translation fails the build;
- parallel arrays are the same length across locales (six mission areas
  everywhere, nine services everywhere, and so on);
- no empty strings, which usually mean a silent extraction failure;
- retired wording — **"Beyond Football"** — appears nowhere;
- no reference to a `REFERENCE_ONLY`, `INTERNAL_REFERENCE` or
  `REVIEW_REQUIRED` asset.

`npm run build:check` re-checks the last two against the actual built HTML, plus
the legal-status gate, one `<h1>` per page, 21 labelled sections, and complete
`hreflang` sets.

Current state: **423 keys, identical across all four locales.**
