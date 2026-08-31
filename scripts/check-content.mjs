import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = ['fr', 'en', 'de', 'it'];

const BANNED = [
  { pattern: /beyond\s+football/i, why: 'retired baseline (hard constraint #2)' },
  { pattern: /REFERENCE_ONLY/i, why: 'reference-only asset must not be published' },
  { pattern: /INTERNAL_REFERENCE/i, why: 'internal-reference asset must not be published' },
  { pattern: /REVIEW_REQUIRED/i, why: 'asset not cleared for publication' },
];

const LENGTH_MAY_VARY = [/\.titleLines$/];

const errors = [];
const warnings = [];

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

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

for (const loc of LOCALES) {
  const serialised = JSON.stringify(data[loc]);
  for (const { pattern, why } of BANNED) {
    const m = pattern.exec(serialised);
    if (m) errors.push(`[${loc}] banned wording "${m[0]}" - ${why}`);
  }
}

for (const w of warnings) console.warn(`  ! ${w}`);
if (errors.length) {
  console.error(`\n✗ content check failed (${errors.length} error${errors.length > 1 ? 's' : ''}):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

for (const loc of LOCALES) {
  for (const [doc, value] of Object.entries(data[loc])) {
    const sections = value?.sections;
    if (!Array.isArray(sections)) continue;
    sections.forEach((section, i) => {
      if (!section?.heading) return;
      const paragraphs = section.paragraphs?.length ?? 0;
      const items = section.items?.length ?? 0;
      if (paragraphs === 0 && items === 0) {
        errors.push(
          `[${loc}] ${doc}.sections[${i}] "${section.heading}" has a heading but no body - ` +
            'the text was dropped or put somewhere else',
        );
      }
    });
  }
}

if (errors.length) {
  console.error(`\n✗ content check failed (${errors.length} errors):\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error('');
  process.exit(1);
}

const n = flat[REF].size;
console.log(`  ✓ content parity OK - ${n} keys identical across ${LOCALES.join(', ')}`);
