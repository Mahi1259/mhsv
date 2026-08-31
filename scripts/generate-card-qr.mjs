import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'qr');

const TARGET = 'https://www.mhsv.ch';

if (!/^https:\/\/www\.mhsv\.ch$/.test(TARGET)) {
  throw new Error(`Refusing to encode "${TARGET}" - not the approved card URL`);
}
if (/\.pdf|drive\.|dropbox|s3\.|bit\.ly/i.test(TARGET)) {
  throw new Error('Refusing to encode a file, storage or shortener URL');
}

const NAVY = '#0C1D3A';
const WHITE = '#FFFFFF';
const QUIET_ZONE_MODULES = 4;
const DPI = 300;
const mmToPx = (mm) => Math.round((mm / 25.4) * DPI);

const VARIANTS = [
  { name: 'navy', dark: NAVY, light: WHITE },
  { name: 'light', dark: WHITE, light: NAVY },
];

async function decode(png) {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return jsQR(new Uint8ClampedArray(data), info.width, info.height, {
    inversionAttempts: 'attemptBoth',
  });
}

mkdirSync(OUT, { recursive: true });

for (const variant of VARIANTS) {
  const options = {
    errorCorrectionLevel: 'M',
    margin: QUIET_ZONE_MODULES,
    color: { dark: variant.dark, light: variant.light },
  };

  const png = await QRCode.toBuffer(TARGET, { ...options, type: 'png', width: mmToPx(30) });
  const decoded = await decode(png);
  if (!decoded) throw new Error(`${variant.name}: did not decode - refusing to write`);
  if (decoded.data !== TARGET) {
    throw new Error(`${variant.name}: decodes to "${decoded.data}", expected "${TARGET}"`);
  }

  const svg = await QRCode.toString(TARGET, { ...options, type: 'svg' });
  writeFileSync(resolve(OUT, `mhsv-card-qr-${variant.name}.svg`), svg);
  writeFileSync(resolve(OUT, `mhsv-card-qr-${variant.name}-30mm.png`), png);
  console.log(`  ✓ ${variant.name.padEnd(5)} svg + 30mm png - decodes to ${decoded.data}`);
}

console.log(`\n  Written to qr/ - print assets, not published with the site.`);
