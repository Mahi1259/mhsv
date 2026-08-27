# Adding a supporter or ambassador

The **Supporters & Ambassadors** section is built and ships **empty**. While it
has no profiles it renders nothing at all - no heading, no badge, no empty grid.
It appears on the site the moment the first profile is added, and disappears
again if the last one is removed. Nothing in the code needs changing either way.

## The three steps

**1. Add the profile to all four language files.**

Add one object to `sections.supporters.profiles` in each of:

```
src/content/i18n/fr.json
src/content/i18n/en.json
src/content/i18n/de.json
src/content/i18n/it.json
```

The same person must be in all four, or the build stops with a parity error.
`name` and `photo` stay the same in every language; `intro` and `message` are
translated.

```json
{
  "name": "Full Name",
  "role": "ambassador",
  "intro": "One or two sentences about who they are.",
  "message": "Their message of support, in their own words.",
  "photo": "full-name.jpg",
  "video": null
}
```

**2. Drop the photograph in `src/assets/supporters/`.**

Name it exactly as written in `photo`. `.jpg`, `.jpeg`, `.png`, `.webp` and
`.avif` all work. Roughly square is best - it is shown as a circle, 80px.

**3. Done.** Run `npm run build`.

## The fields

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Shown as given. Same in all four files. |
| `role` | yes | Exactly one of `patron`, `supporter`, `ambassador` - lowercase. |
| `intro` | yes | Short introduction. Translated per language. |
| `message` | yes | Their quotation. Shown as a pull quote. Translated per language. |
| `photo` | no | File name only. Use `null` for none - the card renders fine without. |
| `video` | no | Full URL, e.g. `"https://..."`. Use `null` for none. |

### `role` is a key, not a label

Write the key; the site prints the right word per language:

| key | FR | EN | DE | IT |
| --- | --- | --- | --- | --- |
| `patron` | Mécène | Patron | Förderer | Mecenate |
| `supporter` | Soutien | Supporter | Unterstützer | Sostenitore |
| `ambassador` | Ambassadeur | Ambassador | Botschafter | Ambasciatore |

A key that is not one of those three prints nothing where the role should be.

### `video` is a link, not an embedded player

The video opens on its own site in a new tab. It is deliberately **not**
embedded: a YouTube or Vimeo player sets third-party cookies as soon as the page
loads, which would contradict the Cookies page - "no advertising, analytics or
third-party tracking cookies" - and would require a consent step the site does
not have. If an embedded player is ever wanted, the cookies page and the consent
banner have to be dealt with first.

## Checking your work

```bash
npm run content:check   # all four languages carry the same keys
npm run build           # builds the site and re-runs every constraint
```

`content:check` prints `! empty array at sections.supporters.profiles` while the
section is empty. That is a note, not an error - it is the expected state until
MHSV® supplies real people.

## What not to do

- **Do not invent example people to see how it looks.** Placeholder names on a
  page about who backs MHSV® read as real endorsements. Add someone only once
  they have agreed.
- **Do not add someone to one language only.** The build will stop.
- **Do not remove the `status` block.** It is what shows the "In development"
  badge on the section.
