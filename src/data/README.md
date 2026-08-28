# Adding a supporter, partner or ambassador

**They Support MHSV®** / **Ils soutiennent MHSV®** ships **empty**, and unlike
the earlier version it still renders: the section shows its introduction, an
"In development" badge and the "Become a Partner" button even with no profiles,
so a reader looking for how to support MHSV® finds something.

What is hidden while empty is the GROUPS. A category with no entries has no
heading - an empty heading says less than no heading - so the three appear one
at a time as they are filled. Nothing in the code needs changing either way.

## The three categories

| `category` | Heading (EN / FR) | For | Fields that apply |
| --- | --- | --- | --- |
| `patron` | Patrons and Donors / Mécènes et donateurs | Organisations or individuals giving real financial or material support | `name`, `role`, `intro`, `photo`, `website` |
| `partner` | Partners and Sponsors / Partenaires et sponsors | Organisations | `name`, `intro`, `photo` (logo), `website` |
| `ambassador` | Ambassadors and Supporters / Ambassadeurs et soutiens | Individuals, e.g. former players | `name`, `role`, `intro`, `message`, `photo`, `video` |

`photo` is a portrait for an ambassador and a logo for an organisation - the
page crops the first to a circle and shows the second whole.

## The three steps

**1. Add the profile to all four language files.**

Add one object to `sections.supporters.profiles` in each of:

```
src/data/i18n/fr.json
src/data/i18n/en.json
src/data/i18n/de.json
src/data/i18n/it.json
```

The same person must be in all four, or the build stops with a parity error.
`name` and `photo` stay the same in every language; `intro` and `message` are
translated.

```json
{
  "name": "Full Name",
  "category": "ambassador",
  "role": "Former player, national team",
  "intro": "One or two sentences about who they are.",
  "message": "Their message of support, in their own words.",
  "photo": "full-name.jpg",
  "website": null,
  "video": null
}
```

An organisation looks like this instead:

```json
{
  "name": "Organisation Name",
  "category": "partner",
  "role": null,
  "intro": "One sentence on what they do with MHSV®.",
  "message": null,
  "photo": "organisation-name.png",
  "website": "https://example.org",
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
| `category` | yes | Exactly one of `patron`, `partner`, `ambassador` - lowercase. An unknown value means the profile appears in no group at all. |
| `role` | no | A line under the name. Use `null` for none. |
| `intro` | yes | Short introduction. Translated per language. |
| `message` | yes | Their quotation. Shown as a pull quote. Translated per language. |
| `photo` | no | File name only. Use `null` for none - the card renders fine without. |
| `video` | no | Full URL, e.g. `"https://..."`. Use `null` for none. |

### `category` is a key, not a label

Write the key; the site prints the group heading in each language, from
`sections.supporters.categories`. A key outside the three means the profile is
filed under no group and never appears - it is not an error the build catches,
so check the spelling.

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
