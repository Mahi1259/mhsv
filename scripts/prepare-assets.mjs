/**
 * Asset pipeline: developer pack -> src/assets + public/  (`npm run assets:prepare`)
 *
 * ASSET_STATUS.csv is the authority. This script refuses to emit anything that
 * is not APPROVED_FOR_PROTOTYPE or APPROVED_FOR_BOOK_BLOCK, so a
 * REFERENCE_ONLY / INTERNAL_REFERENCE / REVIEW_REQUIRED file cannot reach the
 * build even if someone imports it by name.
 *
 * Derived outputs:
 *   src/assets/logo/mhsv-logo.png        primary logo, whitespace trimmed,
 *                                        white background keyed to transparent
 *   src/assets/book/*.png                approved Founding Book covers
 *   public/favicon.svg, icon-*.png       crest crop of the primary logo
 *   public/og-image.png                  1200x630 share card
 *
 * The white-background key and the crest crop are mechanical derivations of the
 * one approved logo - no wordmark is altered and no unapproved variant is
 * introduced. The client's brief explicitly asks for icons derived from the
 * primary logo.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PACK = process.env.MHSV_ASSET_PACK || resolve(ROOT, '..');

const PUBLISHABLE = new Set(['APPROVED_FOR_PROTOTYPE', 'APPROVED_FOR_BOOK_BLOCK']);

// ---------------------------------------------------------------------------
// ASSET_STATUS.csv
// ---------------------------------------------------------------------------
function readAssetStatus() {
  const csvPath = resolve(PACK, 'ASSET_STATUS.csv');
  if (!existsSync(csvPath)) {
    console.error(
      [
        '',
        `✗ developer pack not found: ${csvPath}`,
        '',
        '  This script re-derives the logo, icons, covers and fonts from the',
        '  client pack, which lives outside the repository and is not committed.',
        '',
        '  If you are deploying: you do not need this. The derived assets are',
        '  committed - run "npm run build".',
        '',
        '  If you are updating assets: put the pack next to the repo, or set',
        '    MHSV_ASSET_PACK=/path/to/pack npm run assets:prepare',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  const csv = readFileSync(csvPath, 'utf8').trim();
  const [, ...rows] = csv.split(/\r?\n/);
  const map = new Map();
  for (const row of rows) {
    // Simple 3-column CSV; instructions contain no commas in the delivered file,
    // but split with a limit so a stray comma cannot shift the status column.
    const first = row.indexOf(',');
    const second = row.indexOf(',', first + 1);
    if (first === -1 || second === -1) continue;
    map.set(row.slice(0, first).trim(), {
      status: row.slice(first + 1, second).trim(),
      instruction: row.slice(second + 1).trim(),
    });
  }
  return map;
}

const STATUS = readAssetStatus();

function assertPublishable(relPath) {
  const entry = STATUS.get(relPath);
  if (!entry) throw new Error(`${relPath} is not listed in ASSET_STATUS.csv - refusing to publish`);
  if (!PUBLISHABLE.has(entry.status)) {
    throw new Error(`${relPath} has status ${entry.status} - refusing to publish`);
  }
  return entry;
}

// ---------------------------------------------------------------------------
// background keying
// ---------------------------------------------------------------------------

/**
 * Flood-fill from the image border across near-white pixels and return a
 * single-channel mask (0 = background, 255 = keep). Filling from the border
 * rather than keying every white pixel preserves the white lettering inside
 * the crest.
 */
function backgroundMask(data, width, height, channels, threshold = 236) {
  const n = width * height;
  const mask = new Uint8Array(n).fill(255);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const isNearWhite = (i) => {
    const o = i * channels;
    const r = data[o];
    const g = data[o + 1];
    const b = data[o + 2];
    const a = channels === 4 ? data[o + 3] : 255;
    if (a < 8) return true;
    return r >= threshold && g >= threshold && b >= threshold;
  };

  const push = (i) => {
    if (mask[i] === 0 || !isNearWhite(i)) return;
    mask[i] = 0;
    queue[tail++] = i;
  };

  for (let x = 0; x < width; x++) {
    push(x);
    push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    push(y * width);
    push(y * width + width - 1);
  }

  while (head < tail) {
    const i = queue[head++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) push(i - 1);
    if (x < width - 1) push(i + 1);
    if (y > 0) push(i - width);
    if (y < height - 1) push(i + width);
  }
  return mask;
}

/** Tight bounding box of mask!=0, with optional padding. */
function maskBounds(mask, width, height, pad = 0) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('image is entirely background');
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

/**
 * Find the horizontal band of empty rows that separates the crest from the
 * wordmark lockup, so icons can use the crest alone.
 */
function crestBounds(mask, width, bounds) {
  const rowHas = (y) => {
    for (let x = bounds.left; x < bounds.left + bounds.width; x++) {
      if (mask[y * width + x] !== 0) return true;
    }
    return false;
  };
  let gapStart = -1;
  let best = null;
  for (let y = bounds.top; y < bounds.top + bounds.height; y++) {
    if (!rowHas(y)) {
      if (gapStart === -1) gapStart = y;
    } else if (gapStart !== -1) {
      const gap = { start: gapStart, end: y, size: y - gapStart };
      // The crest must occupy at least a third of the artwork before the gap.
      if (gapStart - bounds.top > bounds.height * 0.33 && (!best || gap.size > best.size)) {
        best = gap;
      }
      gapStart = -1;
    }
  }
  if (!best) return bounds;
  const crestMask = { ...bounds, height: best.start - bounds.top };
  // Re-tighten horizontally within the crest rows only.
  let minX = width;
  let maxX = -1;
  for (let y = crestMask.top; y < crestMask.top + crestMask.height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  return { left: minX, top: crestMask.top, width: maxX - minX + 1, height: crestMask.height };
}

/**
 * Compose the source pixels with the mask into an RGBA buffer.
 *
 * The alpha channel is assembled here rather than with sharp's joinChannel:
 * on this source (which carries an ICC profile) joinChannel silently returns a
 * 3-channel image, dropping the transparency. Writing the bytes directly is
 * deterministic and the raw pixels are already in hand.
 *
 * The mask is blurred first so the hard flood-fill boundary is feathered by a
 * sub-pixel and the mark does not get a jagged outline.
 * `toColourspace('b-w')` keeps that blur single-channel - sharp otherwise
 * promotes a 1-channel raw input to 3-channel RGB.
 */
async function applyMask(data, mask, width, height, channels) {
  const softAlpha = await sharp(Buffer.from(mask), {
    raw: { width, height, channels: 1 },
  })
    .blur(0.6)
    .toColourspace('b-w')
    .raw()
    .toBuffer();
  if (softAlpha.length !== width * height) {
    throw new Error(`alpha mask is ${softAlpha.length} bytes, expected ${width * height}`);
  }

  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const d = i * 4;
    rgba[d] = data[s];
    rgba[d + 1] = data[s + 1];
    rgba[d + 2] = data[s + 2];
    rgba[d + 3] = softAlpha[i];
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } });
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
const written = [];

function record(file, note) {
  written.push({ file, note });
  console.log(`  ✓ ${file}${note ? `  - ${note}` : ''}`);
}

async function buildLogo() {
  const rel = '01_LOGOS/MHSV_Primary_Logo_HD.png';
  assertPublishable(rel);
  const src = resolve(PACK, rel);

  const image = sharp(src);
  const meta = await image.metadata();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const mask = backgroundMask(data, info.width, info.height, info.channels);
  const bounds = maskBounds(mask, info.width, info.height, 6);
  const crest = crestBounds(mask, info.width, bounds);

  const keyed = await applyMask(data, mask, info.width, info.height, info.channels);
  const keyedBuf = await keyed.png().toBuffer();

  mkdirSync(resolve(ROOT, 'src/assets/logo'), { recursive: true });

  // Full lockup, whitespace trimmed. Astro's image pipeline handles the
  // responsive derivatives and WebP conversion from here.
  await sharp(keyedBuf)
    .extract(bounds)
    .png({ compressionLevel: 9 })
    .toFile(resolve(ROOT, 'src/assets/logo/mhsv-logo.png'));
  record(
    'src/assets/logo/mhsv-logo.png',
    `full lockup, ${bounds.width}x${bounds.height}, transparent background`,
  );

  // Crest only - icons and favicon.
  const crestBuf = await sharp(keyedBuf).extract(crest).png().toBuffer();
  await sharp(crestBuf).png().toFile(resolve(ROOT, 'src/assets/logo/mhsv-crest.png'));
  record('src/assets/logo/mhsv-crest.png', `crest crop, ${crest.width}x${crest.height}`);

  mkdirSync(resolve(ROOT, 'public'), { recursive: true });

  const square = (size, background) =>
    sharp(crestBuf)
      .resize(size, size, { fit: 'contain', background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 });

  await square(180, { r: 11, g: 11, b: 12, alpha: 1 })
    .flatten({ background: '#0B0B0C' })
    .toFile(resolve(ROOT, 'public/apple-touch-icon.png'));
  record('public/apple-touch-icon.png', '180x180 on --ink (iOS ignores transparency)');

  for (const size of [192, 512]) {
    await square(size).toFile(resolve(ROOT, `public/icon-${size}.png`));
    record(`public/icon-${size}.png`);
  }

  // Maskable icon needs the safe-zone padding Android crops into.
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: '#0B0B0C' },
  })
    .composite([{ input: await sharp(crestBuf).resize(320, 320, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), gravity: 'centre' }])
    .png()
    .toFile(resolve(ROOT, 'public/icon-512-maskable.png'));
  record('public/icon-512-maskable.png', '512x512 with maskable safe zone');

  // SVG favicon wrapping the crest raster - scalable container, and the one
  // approved mark rather than a redrawn one.
  const favPng = await sharp(crestBuf)
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="MHSV">
  <image href="data:image/png;base64,${favPng.toString('base64')}" width="128" height="128"/>
</svg>
`;
  writeFileSync(resolve(ROOT, 'public/favicon.svg'), svg);
  record('public/favicon.svg', `${(svg.length / 1024).toFixed(1)} kB`);

  await sharp(crestBuf)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(resolve(ROOT, 'public/favicon-32.png'));
  record('public/favicon-32.png', 'fallback for browsers without SVG favicon support');

  // Open Graph card: logo on the brand dark, no text, so one image serves all
  // four locales without a translation risk.
  const ogLogo = await sharp(keyedBuf).extract(bounds).resize({ height: 400, fit: 'inside' }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: '#0B0B0C' } })
    .composite([{ input: ogLogo, gravity: 'centre' }])
    .png({ compressionLevel: 9 })
    .toFile(resolve(ROOT, 'public/og-image.png'));
  record('public/og-image.png', '1200x630');

  return { meta, bounds, crest };
}

/**
 * The content box of a cover, ignoring any pale border the export left on it.
 *
 * The supplied files are both 1489x2105 but neither fills that box: the
 * English cover carries 124px of white across the top and the French one 22px
 * down the left side. Rendered as-is, the English cover floated below its own
 * frame with a white band above it. Measured rather than guessed, and applied
 * per file, so a re-export with clean edges simply trims nothing.
 *
 * `sharp().trim()` is not used: it keys off the corner pixel and would take
 * the navy with it on a cover whose artwork reaches the edge.
 */
async function contentBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => {
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const pale = (c) => c[3] < 20 || (c[0] > 230 && c[1] > 230 && c[2] > 230);
  // Sampled every 6px: a border is uniform, and this keeps a 3MP scan quick.
  const rowPale = (y) => {
    let n = 0;
    let k = 0;
    for (let x = 0; x < info.width; x += 6) {
      n += 1;
      if (pale(at(x, y))) k += 1;
    }
    return k / n > 0.98;
  };
  const colPale = (x) => {
    let n = 0;
    let k = 0;
    for (let y = 0; y < info.height; y += 6) {
      n += 1;
      if (pale(at(x, y))) k += 1;
    }
    return k / n > 0.98;
  };

  let top = 0;
  while (top < info.height && rowPale(top)) top += 1;
  let bottom = info.height - 1;
  while (bottom > top && rowPale(bottom)) bottom -= 1;
  let left = 0;
  while (left < info.width && colPale(left)) left += 1;
  let right = info.width - 1;
  while (right > left && colPale(right)) right -= 1;

  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

async function buildBookCovers() {
  mkdirSync(resolve(ROOT, 'src/assets/book'), { recursive: true });
  for (const [loc, rel] of [
    ['fr', '02_FOUNDER_BOOK/MHSV_Founding_Book_2026_FR_COVER.png'],
    ['en', '02_FOUNDER_BOOK/MHSV_Founding_Book_2026_EN_COVER.png'],
  ]) {
    assertPublishable(rel);
    const out = resolve(ROOT, `src/assets/book/founding-book-${loc}.png`);
    const source = resolve(PACK, rel);
    const box = await contentBox(source);
    // Covers render at most ~264 CSS px, which is ~528 real pixels on a 2x
    // screen, so a 600px cap left nothing in hand. 900 keeps the covers sharp
    // on a retina display and still holds the PNG fallback that <Picture>
    // emits well under a megabyte.
    await sharp(source)
      .extract(box)
      .resize({ width: 900, withoutEnlargement: true })
      .png({ compressionLevel: 9 })
      .toFile(out);
    record(
      `src/assets/book/founding-book-${loc}.png`,
      `approved cover, pale border trimmed to ${box.width}x${box.height}, capped at 900px`,
    );
  }
}

function writeInventory(logo) {
  const lines = [
    '# Asset inventory - MHSV® Phase 1',
    '',
    'Generated by `npm run assets:prepare`. Source of truth for publication',
    'rights is `ASSET_STATUS.csv` in the client developer pack.',
    '',
    '## Published',
    '',
    '| File | Derived from | Pack status |',
    '| --- | --- | --- |',
    `| src/assets/logo/mhsv-logo.png | 01_LOGOS/MHSV_Primary_Logo_HD.png | APPROVED_FOR_PROTOTYPE |`,
    `| src/assets/logo/mhsv-crest.png | 01_LOGOS/MHSV_Primary_Logo_HD.png (crest crop) | APPROVED_FOR_PROTOTYPE |`,
    `| public/favicon.svg, favicon-32.png, icon-192/512, apple-touch-icon, og-image | 01_LOGOS/MHSV_Primary_Logo_HD.png | APPROVED_FOR_PROTOTYPE |`,
    `| src/assets/book/founding-book-fr.png | 02_FOUNDER_BOOK/MHSV_Founding_Book_2026_FR_COVER.png | APPROVED_FOR_BOOK_BLOCK |`,
    `| src/assets/book/founding-book-en.png | 02_FOUNDER_BOOK/MHSV_Founding_Book_2026_EN_COVER.png | APPROVED_FOR_BOOK_BLOCK |`,
    '',
    '## Deliberately NOT published',
    '',
    '| File | Pack status | Reason |',
    '| --- | --- | --- |',
  ];
  for (const [file, entry] of STATUS) {
    if (!PUBLISHABLE.has(entry.status)) {
      lines.push(`| ${file} | ${entry.status} | ${entry.instruction} |`);
    }
  }
  lines.push(
    '',
    '## Derivation notes',
    '',
    `- The primary logo ships with an opaque white background. It is keyed to`,
    `  transparency by flood-filling near-white pixels inward from the border,`,
    `  which leaves the white lettering inside the crest intact, then trimmed to`,
    `  its content box (${logo.bounds.width}x${logo.bounds.height} from`,
    `  ${logo.meta.width}x${logo.meta.height}).`,
    `- Icons use the crest above the wordmark`,
    `  (${logo.crest.width}x${logo.crest.height}); no lettering is altered.`,
    '- `01_LOGOS/MHSV_Logo_Concept_REFERENCE_ONLY.png` appears in ASSET_STATUS.csv',
    '  but is absent from the delivered pack. Nothing depends on it.',
    '',
  );
  writeFileSync(resolve(ROOT, 'ASSET_INVENTORY.md'), lines.join('\n'));
  record('ASSET_INVENTORY.md');
}

// ---------------------------------------------------------------------------
// fonts
// ---------------------------------------------------------------------------

/**
 * Self-hosted fonts. A Swiss non-profit should not leak visitor IPs to a
 * third-party font CDN, and local files are faster besides.
 *
 * Only the Latin subset is shipped: it covers every accent used by FR/DE/IT
 * (Latin-1 Supplement) plus œ/Œ, the guillemets, the curly apostrophe, the em
 * dash and ®. Copying the files to public/ rather than importing them through
 * Vite keeps the URLs stable, so the critical faces can be preloaded.
 */
/**
 * Only two faces are preloaded - the ones the first screenful actually paints
 * with: the hero heading (Archivo 900) and the body/lead copy (Source Sans
 * 400). Preloading more simply makes them compete for bandwidth and pushes LCP
 * out.
 *
 * Source Sans 300 is declared (the brief specifies 300/400/600) but nothing in
 * the current design uses it, so browsers never fetch it. It is there for the
 * client's designer without costing a request.
 */
const FONTS = [
  { pkg: 'archivo', family: 'Archivo', weights: [700, 900], preload: [900] },
  { pkg: 'source-sans-3', family: 'Source Sans 3', weights: [300, 400, 600], preload: [400] },
  { pkg: 'ibm-plex-mono', family: 'IBM Plex Mono', weights: [400, 500], preload: [] },
];

export const PRELOADED_FONTS = [];

async function buildFonts() {
  const outDir = resolve(ROOT, 'public/fonts');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const faces = [
    '/* Generated by scripts/prepare-assets.mjs - do not edit by hand. */',
    '',
  ];
  const preloads = [];

  for (const { pkg, family, weights, preload } of FONTS) {
    for (const weight of weights) {
      const name = `${pkg}-latin-${weight}-normal.woff2`;
      const from = resolve(ROOT, 'node_modules/@fontsource', pkg, 'files', name);
      writeFileSync(resolve(outDir, name), readFileSync(from));
      faces.push(
        '@font-face {',
        `  font-family: '${family}';`,
        '  font-style: normal;',
        `  font-weight: ${weight};`,
        '  font-display: swap;',
        `  src: url('/fonts/${name}') format('woff2');`,
        '}',
        '',
      );
      if (preload.includes(weight)) preloads.push(`/fonts/${name}`);
    }
  }

  writeFileSync(resolve(ROOT, 'src/styles/fonts.css'), faces.join('\n'));
  writeFileSync(
    resolve(ROOT, 'src/config/preload-fonts.json'),
    JSON.stringify(preloads, null, 2) + '\n',
  );
  record('src/styles/fonts.css', `${FONTS.reduce((n, f) => n + f.weights.length, 0)} faces, latin subset`);
  record('public/fonts/*.woff2', 'self-hosted - no third-party font requests');
}

mkdirSync(resolve(ROOT, 'src/styles'), { recursive: true });
mkdirSync(resolve(ROOT, 'src/config'), { recursive: true });

const logo = await buildLogo();
await buildBookCovers();
await buildFonts();
writeInventory(logo);
console.log(`\n  ${written.length} files written. ${STATUS.size} pack assets checked against ASSET_STATUS.csv.`);
