# MHSV® Phase 1 - test pass

Run on 27 August 2026, against a clean build. Re-run after the legal notice,
cookies and contact changes the same day. Nothing is deployed: the site
has not been published, the domain is not connected, the repository has not
been transferred, and the forms are still in test mode.

Reproduce the whole table with `npm run build`, then `npm run preview` in one
terminal and the browser checks in another.

## Results

| # | Check | Command | Result |
|---|---|---|---|
| 1 | Types | `npm run typecheck` | **Pass** - 0 errors, 0 warnings |
| 2 | Content parity, 4 languages | `npm run content:check` | **Pass** - 713 keys identical across FR/EN/DE/IT |
| 3 | Colour contrast (WCAG AA) | `npm run check:contrast` | **Pass** - 26 pairings, plus 2 banned pairings confirmed still banned |
| 4 | Build constraints | `npm run build` | **Pass** - 154 files, 4 locales |
| 5 | Accessibility + layout | `npm run audit` | **Pass** - 9 pages × 4 viewports, no overflow, no WCAG 2.1 AA violations |
| 6 | Motion and the shrinking bar | `npm run check:motion` | **Pass** - including reduced-motion |
| 7 | Book QR destination | `npm run check:qr` | **Pass** - `/livre` resolves with and without a trailing slash |
| 8 | Contact form handler | `npm run test:contact` | **Pass** - 12/12 |
| 9 | Book order + newsletter | `npm run test:forms` | **Pass** - 17/17 |
| 12 | Footer legal links, all locales | browser, 20 links | **Pass** - every link 200 in FR/EN/DE/IT |
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
| Every photograph on the site is credited, and no withdrawn one still is | Enforced, in all 4 languages |
| No phone number is published on any page | Enforced |
| The founder's private address appears only on his Governance card | Enforced |
| No QR code is displayed, and no QR file reaches the build | Enforced |
| The permanent cookie-settings control exists on every page | Enforced |
| The pending-validation banners are still on the two legal notices | Enforced |
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
| Contact section lists one address twice | Both "Institutional contact" and "Founder and President" now read infos@mhsv.ch, as instructed. True, but two identical addresses in a short list reads like a bug. Worth one word from Martial. |
| Legal notice bracketed fields | Four in each language, left visible as placeholders per instruction. They need the final hosting architecture before launch. |
| Forms | Martial has confirmed the mailboxes are tested. Confirm with him whether the forms can now go live; they remain in test mode until he says so. |
| DE and IT text | Machine-assisted from the approved FR/EN. Needs a native reading before launch. |
| Four photograph slots are empty | Four images were withdrawn on 27 August for carrying club and brand marks: Who we support, Sport programmes, Founding programmes & fees, and Projects & inclusion. There was no unbranded replacement available, so those sections have no photograph. New images are needed. See IMAGE_INVENTORY.md. |
| Ecosystem photograph | Left in place, but two pairs of shoes carry the adidas trefoil. Incidental footwear rather than a kit or crest, and a few pixels across at render size. Confirm that reading, or it goes too. |
| Newsletter default on DE and IT pages | The dropdown offers French and English; on the German and Italian pages it opens on French. English may be the better default there. |
