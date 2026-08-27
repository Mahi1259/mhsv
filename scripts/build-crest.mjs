/**
 * Regenerates functions/lib/crest-logo.mjs from public/icon-512.png.
 * `node scripts/build-crest.mjs`  - only needed if the logo changes.
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const buf = await sharp(resolve(ROOT, 'public/icon-512.png'))
  .trim()
  .resize(88, 88, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync(
  resolve(ROOT, 'functions/lib/crest-logo.mjs'),
  `/**\n * The MHSV® crest, inlined as base64 for the notification emails.\n *\n * Bundled rather than read from disk because this runs in a Cloudflare Worker,\n * where there is no filesystem, and rather than linked because a remote image\n * cannot work: www.mhsv.ch is not serving yet, and mail clients block remote\n * images by default even once it is.\n *\n * 88px - the 44px header slot at 2x - trimmed of its transparent margin.\n * Regenerate with scripts/build-crest.mjs if the logo changes.\n */\nexport const CREST_CID = 'mhsv-crest';\nexport const CREST_FILENAME = 'mhsv-crest.png';\nexport const CREST_BASE64 =\n  '${buf.toString('base64')}';\n`,
);
console.log(`  ✓ crest-logo.mjs regenerated - ${buf.length} bytes`);
