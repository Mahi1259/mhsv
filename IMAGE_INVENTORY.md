# MHSV® Website - Image Inventory

For MHSV®'s internal records. The same list of photographers is published on
the site's Photo Credits page, in all four languages.

All photographs are sourced from Unsplash and used under the Unsplash free
licence, which permits commercial use and does not require attribution.

## In use - six photographs

| Section | Photographer | Source |
| --- | --- | --- |
| Who we are | Vitaly Gariev | https://unsplash.com/photos/MWdcDtDTq9E |
| Our mission | Timur Shakerzianov | https://unsplash.com/photos/RHqKnRACsqs |
| Methodology & MITIPS® | Mina Rad | https://unsplash.com/photos/-P7kHROe-6A |
| Services | Christina @ wocintechchat.com | https://unsplash.com/photos/eF7HN40WbAQ |
| The MHSV® pathway | Meghan Holmes | https://unsplash.com/photos/buWcS7G1_28 |
| Ecosystem | Parabol | https://unsplash.com/photos/qSv1gwYEfa8 |

Each carries alt text in FR, EN, DE and IT and loads lazily. No captions on the
page: the credits are on the Photo Credits page, linked from the footer.

## Withdrawn - four photographs, for carrying club or brand marks

MHSV®'s image brief says *no team kits with visible club or brand logos*. These
four carried them legibly and have been removed from the repository. The slots
are empty: `SectionImage` renders nothing when its file is absent, so those
sections simply have no photograph rather than a placeholder.

| Section, now empty | Photographer | What was visible |
| --- | --- | --- |
| Who we support | Braden Collum | `UT·TYLER` on two vests, `McMURRY` on a third, an ASICS mark on the lead runner |
| Sport programmes | Gabin Vallet | A `trainme` commercial wordmark on the coach's shirt, a red club shield on the perimeter banner, adidas and ASICS footwear |
| Founding programmes & fees | Jeffrey F Lin | `GEORGETOWN` across two shirts, Nike swooshes on shorts and shirts, a Wilson match ball, a BIG EAST patch |
| Projects, inclusion & deployment | Joel Mott | Nike swooshes on several hoodies, `SOFTBALL` team wordmarks, a school crest, a `CARRYTHELOVE` wordmark |

There was no unbranded replacement available: all ten approved Unsplash images
were already placed, `public/Unsplash/` is empty, and the six that remain are
each in use in another section. Filling these four needs new images.

Cropping does not rescue any of them - in every case the marks are spread
across the frame rather than sitting in one corner.

## One left in place, for MHSV® to decide

**Ecosystem - Parabol.** Two pairs of shoes in the lower left carry the adidas
trefoil and three stripes. It is left in place because it is a different case
from the four above: no wordmark, no club crest, no sporting context - just
footwear worn incidentally in a photograph of a team meeting outdoors. At the
size the image renders the trefoil is a few pixels across.

If MHSV® wants the rule read strictly - no brand mark of any kind, however
incidental - this one goes too, and the Ecosystem slot empties with it.

## Other image assets - all MHSV®'s own

The site's remaining images are the MHSV® crest and lockup, the two Founding
Book covers, the app icons and favicon, the Open Graph card, and the generated
QR code. All were checked: they carry MHSV®'s own marks and no third-party
club, federation or brand marks.

## Resolution

The six remaining photographs are all 2000px wide and render at about 590px, so
they are sharp at 2x.
