# MHSV® Phase 1 - test pass

Run on 27 August 2026, against a clean build. Nothing is deployed: the site
has not been published, the domain is not connected, the repository has not
been transferred, and the forms are still in test mode.

Reproduce the whole table with `npm run build`, then `npm run preview` in one
terminal and the browser checks in another.

## Results

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Types | `npm run typecheck` | **Pass** - 0 errors, 0 warnings |
| 2 | Content parity, 4 languages | `npm run content:check` | **Pass** - 653 keys identical across FR/EN/DE/IT |
| 3 | Colour contrast (WCAG AA) | `npm run check:contrast` | **Pass** - 26 pairings, plus 2 banned pairings confirmed still banned |
| 4 | Build constraints | `npm run build` | **Pass** - 180 files, 4 locales |
| 5 | Accessibility + layout | `npm run audit` | **Pass** - 9 pages × 4 viewports, no overflow, no WCAG 2.1 AA violations |
| 6 | Motion and the shrinking bar | `npm run check:motion` | **Pass** - including reduced-motion |
| 7 | Book QR destination | `npm run check:qr` | **Pass** - `/livre` resolves with and without a trailing slash |
| 8 | Contact form handler | `npm run test:contact` | **Pass** - 12/12 |
| 9 | Book order + newsletter | `npm run test:forms` | **Pass** - 17/17 |
| 10 | Cloudflare Pages Function | `npm run test:cf` | **Pass** - all checks |
| 11 | Vercel adapter | `npm run test:api` | **Pass** - 6/6 |

## What check 4 enforces on every build

These fail the build rather than warn, so none of them can reach production by
accident:

| Constraint | Status |
|---|---|
| "Beyond Football" appears nowhere | Enforced |
| No REFERENCE_ONLY / INTERNAL_REFERENCE / REVIEW_REQUIRED asset is referenced | Enforced |
| The full Founding Book PDFs are not in the output | Enforced |
| Legal / association status stays hidden while the flag is off | Enforced, with one scoped exemption - see below |
| The retired `mhsv-international.org` domain appears nowhere | Enforced |
| Every language link lands on a page that exists | Enforced - all 4 languages, all pages |
| The Book section QR decodes to `https://www.mhsv.ch/livre` | Enforced, in all 4 languages |
| `/livre` offers no download and no checkout | Enforced |
| Consent boxes are never pre-ticked | Enforced |
| Exactly 6 governance members, no retired name | Enforced |
| The launch rate is stated once, not three times | Enforced |

## The one exemption, and why

The data protection notice names **MHSV Association** as the data controller. A
notice cannot identify its controller any other way, so the association-wording
ban is lifted on those two pages **only** - `/fr/protection-des-donnees/` and
`/en/data-protection/`. It still holds everywhere else, which the build
verifies.

This means association wording is now visible on the site, on those two pages,
while the legal-status flag is off. It sits under the "pending final legal
validation" banner. **That banner must not be removed without instruction** -
the source document is headed "VALIDATION TECHNIQUE - NE PAS PUBLIER".

## Still open, needing a decision from MHSV®

| Item | Detail |
|---|---|
| Book QR print files | Not generated. Generation is gated until `https://www.mhsv.ch/livre` is live and MHSV® approves the destination in writing. A printed QR cannot be corrected. |
| Governance committee | Corrections expected after Saturday. Names and roles untouched. |
| `infos@mhsv.ch` | Not confirmed working. Forms stay in test mode until it is. |
| Personal address in the Contact section | `m.happi@mhsv.ch` is published there. Confirm that is intended. |
| DE and IT text | Machine-assisted from the approved FR/EN. Needs a native reading before launch. |
| Three photographs | Carry visible club and brand marks (UT Tyler / ASICS, Georgetown / Nike, Nike / softball crest). Confirm they are cleared, or replace them. |
| Newsletter default on DE and IT pages | The dropdown offers French and English; on the German and Italian pages it opens on French. English may be the better default there. |
