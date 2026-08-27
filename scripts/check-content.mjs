/**
 * Build-time content gate.  `npm run content:check`
 *
 * Fails the build when:
 *   1. any locale is missing a key present in another (semantic parity is a
 *      client requirement - every language must say the same things);
 *   2. parallel arrays have different lengths (e.g. 6 mission areas in FR but
 *      5 in DE);
 *   3. a string value is empty - usually a silent extraction failure;
 *   4. banned wording appears (hard constraint: "Beyond Football" is retired,
 *      the baseline is "Beyond Sport – Beyond Human Potential");
 *   5. content references an asset the client has not cleared for publication.
 *
 * Keys beginning with "_" are notes/audit data and are exempt from parity.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'de', 'it'];

/** Wording the client has explicitly retired or not cleared for publication. */
const BANNED = [
  { pattern: /beyond\s+football/i, why: 'retired baseline (hard constraint #2)' },
  { pattern: /REFERENCE_ONLY/i, why: 'reference-only asset must not be published' },
  { pattern: /INTERNAL_REFERENCE/i, why: 'internal-reference asset must not be published' },
  { pattern: /REVIEW_REQUIRED/i, why: 'asset not cleared for publication' },
];

/**
 * Keys whose ARRAY LENGTH is allowed to differ between locales.
 *
 * `titleLines` is a heading pre-split into display lines for the masked
 * reveal. The split is deliberately per language - "WHO / WE ARE" is two lines
 * in English while "ÜBER UNS" is one in German - so demanding equal lengths
 * here would force a wrong line break into one of the languages. The key must
 * still exist everywhere, and every locale's lines must still join back to its
 * own heading (checked below); only the count is free to vary.
 */
const LENGTH_MAY_VARY = [/\.titleLines$/];

const errors = [];
const warnings = [];

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Flatten to "a.b[0].c" -> value, skipping underscore-prefixed subtrees. */
function flatten(value, prefix = '', out = new Map()) {
  if (Array.isArray(value)) {
    out.set(`${prefix}[]`, `length:${value.length}`);
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (isPlain(value)) {
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_')) continue;
      flatten(v, prefix ? `${prefix}.${k}` : k, out);
    }
  } else {
    out.set(prefix, value === null ? null : typeof value);
  }
  return out;
}

const data = {};
for (const loc of LOCALES) {
  const file = resolve(ROOT, `src/data/i18n/${loc}.json`);
  try {
    data[loc] = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    console.error(`✗ cannot read src/data/i18n/${loc}.json - run "npm run content:extract" first`);
    process.exit(1);
  }
}

// --- 1 & 2: key + array-length parity, measured against the reference locale.
const REF = 'fr';
const flat = Object.fromEntries(LOCALES.map((l) => [l, flatten(data[l])]));

for (const loc of LOCALES) {
  if (loc === REF) continue;
  const variable = (key) => LENGTH_MAY_VARY.some((re) => re.test(key.replace(/\[\d+\]$/, '')));
  for (const key of flat[REF].keys()) {
    if (variable(key)) continue;
    if (!flat[loc].has(key)) errors.push(`[${loc}] missing key present in ${REF}: ${key}`);
  }
  for (const key of flat[loc].keys()) {
    if (variable(key)) continue;
    if (!flat[REF].has(key)) errors.push(`[${loc}] extra key not present in ${REF}: ${key}`);
  }
  for (const [key, v] of flat[REF]) {
    if (!key.endsWith('[]')) continue;
    const path = key.slice(0, -2);
    if (LENGTH_MAY_VARY.some((re) => re.test(path))) continue;
    if (flat[loc].get(key) !== v) {
      errors.push(`[${loc}] array length differs at ${path}: ${flat[loc].get(key)} vs ${REF} ${v}`);
    }
  }
}

// --- 3: empty values
for (const loc of LOCALES) {
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (!v.trim()) errors.push(`[${loc}] empty string at ${path}`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) warnings.push(`[${loc}] empty array at ${path}`);
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
    } else if (isPlain(v)) {
      for (const [k, x] of Object.entries(v)) {
        if (k.startsWith('_')) continue;
        walk(x, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(data[loc], '');
}

// --- 3b: a split heading must join back to its own heading exactly ---------
for (const loc of LOCALES) {
  const sections = data[loc].sections ?? {};
  for (const [id, section] of Object.entries(sections)) {
    if (!Array.isArray(section?.titleLines)) continue;
    const joined = section.titleLines.join(' ');
    if (joined !== section.title) {
      errors.push(
        `[${loc}] sections.${id}.titleLines join to "${joined}" but the heading is "${section.title}"`,
      );
    }
  }
}

// --- 4 & 5: banned wording / uncleared assets
for (const loc of LOCALES) {
  const serialised = JSON.stringify(data[loc]);
  for (const { pattern, why } of BANNED) {
    const m = pattern.exec(serialised);
    if (m) errors.push(`[${loc}] banned wording "${m[0]}" - ${why}`);
  }
}

// --- report
for (const w of warnings) console.warn(`  ! ${w}`);
if (errors.length) {
  console.error(`\n✗ content check failed (${errors.length} error${errors.length > 1 ? 's' : ''}):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

const n = flat[REF].size;
console.log(`  ✓ content parity OK - ${n} keys identical across ${LOCALES.join(', ')}`);
