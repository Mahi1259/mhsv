/**
 * The on-page QR code for the Book section.  `npm run qr:web`
 *
 * Distinct from scripts/generate-qr.mjs, and deliberately so. That one makes
 * the files that go to PRINT on the back cover of the book; it is gated behind
 * MHSV_QR_APPROVED because ink cannot be corrected. This one makes a web asset
 * that ships in the build and can be regenerated at any time, so it is not
 * gated - but it encodes the identical payload, and the two are asserted
 * against the same constant so they can never drift apart.
 *
 * Written to src/assets/ rather than public/ so Astro fingerprints it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'src/assets/qr');

/** Must match BOOK_PAGE_PATH in src/config/site.ts and the print generator. */
const BOOK_PAGE_PATH = '/livre';
const TARGET = `https://www.mhsv.ch${BOOK_PAGE_PATH}`;

if (!/^https:\/\/www\.mhsv\.ch\/livre$/.test(TARGET)) {
  throw new Error(`Refusing to encode "${TARGET}" - not the approved permanent URL`);
}
if (/\.pdf|drive\.|dropbox|s3\.|bit\.ly/i.test(TARGET)) {
  throw new Error('Refusing to encode a file, storage or shortener URL');
}

/*
 * Navy on white, per the brief. The code is NOT painted in band colours: a QR
 * needs a light quiet zone and high contrast to scan, and a navy-on-navy code
 * that matched the section would simply not read. It sits on its own white
 * card instead.
 */
const DARK = '#0C1D3A';
const LIGHT = '#FFFFFF';
const QUIET_ZONE_MODULES = 4;

const options = {
  errorCorrectionLevel: 'M',
  margin: QUIET_ZONE_MODULES,
  color: { dark: DARK, light: LIGHT },
};

// Verify before writing: rasterise, decode, and require the exact payload back.
const png = await QRCode.toBuffer(TARGET, { ...options, type: 'png', width: 512 });
const { data, info } = await sharp(png)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);

if (!decoded) throw new Error('generated QR did not decode - refusing to write');
if (decoded.data !== TARGET) {
  throw new Error(`QR decodes to "${decoded.data}", expected "${TARGET}" - refusing to write`);
}

const svg = await QRCode.toString(TARGET, { ...options, type: 'svg' });
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, 'mhsv-livre-qr-web.svg'), svg);

console.log(`  ✓ web QR written - decodes to ${decoded.data}`);
