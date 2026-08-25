# MHSV® Website — Photograph slots

Four slots are wired and waiting. The site builds and is correct with none of
them filled; each appears the moment its file is added.

## What to do

1. Choose a photograph per slot from **Unsplash** or **Pexels**, against the
   criteria below.
2. Save it as `src/assets/stock/<slot>.jpg`, **2000px wide or more**.
3. If it came from Pexels, add the credit to `src/content/authored/*.json`:
   `"stock": { "<slot>": { "alt": "…", "credit": "Photo: NAME / Pexels" } }`
   in all four languages. Unsplash does not require it.
4. `npm run build`. WebP with a PNG fallback at 640/1000/1600, lazy-loaded
   below the fold, is handled already.

| Slot | File | Section | Subject |
| --- | --- | --- | --- |
| `about` | `src/assets/stock/about.jpg` | Who we are | Athletes training. Not football only — athletics, basketball, swimming all work. |
| `audience` | `src/assets/stock/audience.jpg` | Who we support | Young people in a classroom or study setting. |
| `pathway` | `src/assets/stock/pathway.jpg` | The pathway | A coach or mentor working one-to-one with a young person. |
| `inclusion` | `src/assets/stock/inclusion.jpg` | Projects & inclusion | A person in a professional or interview setting. |

## Rules, from the client brief

**Required**
- Diverse and inclusive across the four — not all the same demographic.
- 2000px wide minimum.

**Not allowed**
- Team kits with a visible club or brand logo.
- Children without an adult present.
- Getty, Shutterstock or iStock — paid licences, not budgeted.
- AI-generated images — fabricated people representing a real organisation.
- Social media screenshots.

## Why the files are not here

Unsplash's search needs an API key and Pexels blocks automated access, so the
photographs could not be chosen from this environment — only downloaded from a
URL already known. Guessing identifiers would have meant publishing pictures
nobody had looked at, against a brief with rules about who is in them.

Either supply four URLs, or an Unsplash API key, and they can be fetched,
checked against the rules above, and committed.

## Alt text

Already written, in all four languages, under `stock` in the content files. It
describes the intended subject; check it still matches the photograph actually
chosen.
