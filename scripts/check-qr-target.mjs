/**
 * Guards the one URL that cannot be fixed after the fact.
 *
 *   npm run check:qr            (against a running preview/dev server)
 *   AUDIT_BASE_URL=https://www.mhsv.ch npm run check:qr
 *
 * The QR code printed on the back cover of both editions of the Founding Book
 * encodes `https://www.mhsv.ch/livre` - no trailing slash. Once printed it is
 * permanent. This checks, end to end, that:
 *
 *   1. the QR files on disk decode to exactly that path;
 *   2. the encoded path is what src/config/site.ts calls permanent;
 *   3. requesting it - with and without the trailing slash - reaches the page,
 *      following at most one redirect;
 *   4. the page that answers is the book page and offers no download.
 *
 * A trailingSlash setting of 'always' silently broke (3) once already: the
 * slash-less form, which is the printed one, returned 404.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import jsQR from 'jsqr';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.AUDIT_BASE_URL || 'http://localhost:4321').replace(/\/+$/, '');

const EXPECTED_PATH = '/livre';
const EXPECTED_URL = `https://www.mhsv.ch${EXPECTED_PATH}`;

const failures = [];
const pass = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failures.push(msg);
  console.error(`  ✗ ${msg}`);
};

// --- 1. the generated files decode to the expected URL ----------------------
const QR_FILES = ['qr/mhsv-livre-qr-30mm.png', 'qr/mhsv-livre-qr-25mm.png', 'qr/mhsv-livre-qr.svg'];

/*
 * The print files are gated until the domain is live and the client has
 * approved the page (see scripts/generate-qr.mjs). Their absence is the
 * expected state before then - the destination checks below still run, because
 * the URL has to be right long before anything is generated.
 *
 * Tested per file, NOT by the existence of qr/. That directory also holds the
 * business-card codes, which encode the site root rather than /livre; once
 * those were generated, an existence check on the directory alone concluded the
 * book files were there and failed on ENOENT for every one of them.
 */
const generated = QR_FILES.every((file) => existsSync(resolve(ROOT, file)));
if (!generated) {
  console.log('  · QR print files not generated yet (gated until the domain is live');
  console.log('    and MHSV® has approved the page) - checking the destination only.');
}

for (const file of generated ? QR_FILES : []) {
  try {
    const source = readFileSync(resolve(ROOT, file));
    const input = file.endsWith('.svg') ? await sharp(source).resize(600).png().toBuffer() : source;
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
    if (!result) fail(`${file}: does not decode`);
    else if (result.data !== EXPECTED_URL) fail(`${file}: decodes to "${result.data}"`);
    else pass(`${file} decodes to ${EXPECTED_URL}`);
  } catch (error) {
    fail(`${file}: ${error.message}`);
  }
}

// --- 2. the config still calls that path permanent --------------------------
const config = readFileSync(resolve(ROOT, 'src/config/site.ts'), 'utf8');
const declared = /BOOK_PAGE_PATH\s*=\s*'([^']+)'/.exec(config)?.[1];
if (declared !== EXPECTED_PATH) {
  fail(`BOOK_PAGE_PATH is "${declared}", but the printed QR encodes "${EXPECTED_PATH}"`);
} else {
  pass(`BOOK_PAGE_PATH matches the printed path (${EXPECTED_PATH})`);
}

// --- 3 & 4. the URL actually resolves --------------------------------------
async function resolvePath(path) {
  const url = `${BASE}${path}`;
  let response = await fetch(url, { redirect: 'manual' });
  let hops = 0;

  while ([301, 302, 303, 307, 308].includes(response.status) && hops < 3) {
    const location = response.headers.get('location');
    if (!location) break;
    hops += 1;
    response = await fetch(new URL(location, url), { redirect: 'manual' });
  }
  return { response, hops };
}

try {
  for (const path of [EXPECTED_PATH, `${EXPECTED_PATH}/`]) {
    const { response, hops } = await resolvePath(path);
    if (response.status !== 200) {
      fail(`${path} → HTTP ${response.status} after ${hops} redirect(s) - the printed QR would fail`);
      continue;
    }
    if (hops > 1) {
      fail(`${path} → 200 but took ${hops} redirects; keep it to at most one`);
      continue;
    }

    const html = await response.text();
    if (!/name="edition"/.test(html)) {
      fail(`${path} → 200 but is not the book page (no order form)`);
    } else if (/href="[^"]*\.pdf"/i.test(html)) {
      fail(`${path} → links to a PDF; the complete book must never be downloadable`);
    } else {
      pass(`${path} → 200${hops ? ` (after ${hops} redirect)` : ''}, book page with order form`);
    }
  }
} catch (error) {
  fail(`could not reach ${BASE} - is the preview server running? (${error.message})`);
}

console.log('');
if (failures.length) {
  console.error(`✗ QR target check failed (${failures.length}). THIS URL GOES TO PRINT.\n`);
  process.exit(1);
}
console.log(
  generated
    ? `  ✓ QR target OK - ${EXPECTED_URL} resolves and the print files match`
    : `  ✓ QR target OK - ${EXPECTED_URL} resolves (print files correctly not yet generated)`,
);
