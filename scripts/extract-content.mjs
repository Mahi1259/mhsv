/**
 * Content pipeline: MHSV_Website_Content_Pack_..._V3.docx  ->  src/data/i18n/{loc}.json
 *
 *   npm run content:extract
 *
 * The .docx is the client's source of truth. Nothing in this repo retypes it.
 * The document holds four parallel language blocks (FR / EN / DE / IT), each
 * with the same 21 numbered sections, so extraction is: segment by language
 * marker -> segment by "NN - TITLE" -> map blocks to a semantic shape.
 *
 * Two things the .docx does NOT contain, which are merged in from
 * src/data/authored/{loc}.json:
 *   1. UI chrome (nav labels, form labels, validation messages, footer, legal
 *      page bodies) - the pack is website copy, not interface copy.
 *   2. Public copy for §18/§19, where the pack text is an instruction to the
 *      developer ("Show the cover of…") rather than publishable prose.
 * Everything authored is flagged for client validation - see CONTENT.md.
 *
 * Run `npm run content:check` after this to enforce key parity across locales.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDocxBlocks } from './lib/docx.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DOCX =
  process.env.MHSV_CONTENT_DOCX ||
  resolve(ROOT, '..', 'MHSV_Website_Content_Pack_Phase1_Developer_Ready_V3.docx');

const LOCALES = ['fr', 'en', 'de', 'it'];
const LANG_MARKERS = { fr: '🇫🇷', en: '🇬🇧', de: '🇩🇪', it: '🇮🇹' };
/** First appendix heading after the Italian block - bounds the last locale. */
const APPENDIX_MARKER = /^[D-G]\s*[—–-]\s/;

// ---------------------------------------------------------------------------
// Locale-specific parsing hints. Kept tiny and in one place on purpose: every
// entry here is a place where the source document is not uniform across
// languages.
// ---------------------------------------------------------------------------
const HINTS = {
  fr: { ecosystemLead: ':', conjunction: ' et ' },
  en: { ecosystemLead: ' including ', conjunction: ' and ' },
  de: { ecosystemLead: ':', conjunction: ' und ' },
  it: { ecosystemLead: ':', conjunction: ' e ' },
};

// ---------------------------------------------------------------------------
// text helpers
// ---------------------------------------------------------------------------
const DASH = /\s[-–—]\s/;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const dropTrailingDot = (s) => clean(s).replace(/[.。]\s*$/, '');

/** Everything after the first colon - strips "Roadmap:", "CTA :", "Footer légal :" … */
function afterColon(s, fallback = s) {
  const i = String(s).indexOf(':');
  return i === -1 ? clean(fallback) : clean(String(s).slice(i + 1));
}

function stripQuotes(s) {
  return clean(s).replace(/^[«"“„'']\s*/, '').replace(/\s*[»"“”'']$/, '');
}

/**
 * Split "a; b; c." or "a, b, c." into trimmed items. The trailing full stop is
 * dropped by default because these become list items; pass keepDot for lists
 * whose final entry is a full sentence (the legal footer).
 */
function splitList(s, sep = ';', keepDot = false) {
  return (keepDot ? clean(s) : dropTrailingDot(s))
    .split(sep)
    .map(clean)
    .filter(Boolean);
}

/** Split "A -> B -> C." into steps. */
const splitArrow = (s) => dropTrailingDot(s).split(/\s*->\s*/).map(clean).filter(Boolean);

/** Split "Title - body" on the first standalone dash. */
function splitDash(s, parts = 2) {
  const out = [];
  let rest = clean(s);
  while (out.length < parts - 1) {
    const m = DASH.exec(rest);
    if (!m) break;
    out.push(clean(rest.slice(0, m.index)));
    rest = clean(rest.slice(m.index + m[0].length));
  }
  out.push(rest);
  return out;
}

/**
 * Split a comma list whose final item is joined by a conjunction:
 * "a, b, c and d" -> [a, b, c, d]
 */
function splitCommaList(s, conjunction) {
  const items = splitList(s, ',');
  const last = items[items.length - 1];
  if (last) {
    const i = last.toLowerCase().lastIndexOf(conjunction);
    if (i > 0) {
      items[items.length - 1] = clean(last.slice(0, i));
      items.push(clean(last.slice(i + conjunction.length)));
    }
  }
  return items.filter(Boolean);
}

// ---------------------------------------------------------------------------
// document segmentation
// ---------------------------------------------------------------------------
const SECTION_RE = /^(\d{2})\s*[—–-]\s*(.+)$/;

function segmentByLocale(blocks) {
  const starts = {};
  blocks.forEach((b, i) => {
    if (b.type !== 'p') return;
    for (const [loc, marker] of Object.entries(LANG_MARKERS)) {
      if (b.text.startsWith(marker) && starts[loc] === undefined) starts[loc] = i;
    }
  });
  for (const loc of LOCALES) {
    if (starts[loc] === undefined) throw new Error(`Language marker for "${loc}" not found`);
  }

  const ordered = [...LOCALES].sort((a, b) => starts[a] - starts[b]);
  const out = {};
  ordered.forEach((loc, n) => {
    const from = starts[loc];
    let to = n + 1 < ordered.length ? starts[ordered[n + 1]] : blocks.length;
    // The final locale runs into the developer appendix; cut it there.
    for (let i = from; i < to; i++) {
      const b = blocks[i];
      if (b.type === 'p' && APPENDIX_MARKER.test(b.text)) {
        to = i;
        break;
      }
    }
    out[loc] = blocks.slice(from, to);
  });
  return out;
}

function segmentBySection(blocks) {
  const sections = new Map();
  let current = null;
  for (const b of blocks) {
    if (b.type === 'p') {
      const m = SECTION_RE.exec(b.text);
      if (m) {
        current = { num: m[1], title: clean(m[2]), blocks: [] };
        sections.set(m[1], current);
        continue;
      }
    }
    if (current) current.blocks.push(b);
  }
  return sections;
}

/** The FR-only publication-status legend table in the document preamble. */
function readStatusLegend(blocks) {
  for (const b of blocks) {
    if (b.type === 'tbl' && b.rows.length === 5 && /ACTIF/i.test(b.rows[0]?.[0] ?? '')) {
      return b.rows.map((r) => ({ label: clean(r[0]), description: clean(r[1]) }));
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// section extractors - one per numbered section of the content pack
// ---------------------------------------------------------------------------
const p = (s, i) => clean(s.blocks[i]?.text ?? '');
const tbl = (s, i) => s.blocks.filter((b) => b.type === 'tbl')[i]?.rows ?? [];

/** "PROGRAMME FONDATEUR FOOTBALL" + [[key, value], …] */
function readProgrammeTable(rows) {
  if (!rows.length) return null;
  const title = clean(rows[0][0]);
  const entries = rows
    .slice(1)
    .filter((r) => r.length >= 2 && clean(r[0]))
    .map((r) => ({ label: clean(r[0]), value: clean(r[1]) }));
  return { title, entries };
}

/** "STATUS: IN DEVELOPMENT / PROGRESSIVE DEPLOYMENT" -> canonical key + raw text. */
function readStatus(raw) {
  const text = afterColon(raw, '');
  if (!text) return null;
  // Every status line in V3 is the "in development" state. The other four
  // states exist in the badge component and legend so future content can use
  // them without a code change.
  return { key: 'inDevelopment', detail: clean(text) };
}

const SECTIONS = [
  {
    id: 'hero',
    num: '01',
    anchor: 'top',
    extract: (s) => ({
      brand: p(s, 0),
      institutional: p(s, 1),
      legalStatus: p(s, 2),
      baseline: p(s, 3),
      tagline: p(s, 4),
      intro: p(s, 5),
      ctas: splitList(afterColon(p(s, 6)), '|'),
    }),
  },
  {
    id: 'about',
    num: '02',
    anchor: 'about',
    extract: (s) => ({ lead: p(s, 0), paragraphs: [p(s, 1), p(s, 2)] }),
  },
  {
    id: 'vision',
    num: '03',
    anchor: 'vision',
    extract: (s) => ({ lead: p(s, 0), steps: splitArrow(p(s, 1)), note: p(s, 2) }),
  },
  {
    id: 'mission',
    num: '04',
    anchor: 'mission',
    extract: (s) => ({
      items: s.blocks.map((b) => {
        const [title, body] = splitDash(b.text, 2);
        return { title, body };
      }),
    }),
  },
  {
    id: 'audience',
    num: '05',
    anchor: 'audience',
    extract: (s) => ({ items: splitList(p(s, 0), ';') }),
  },
  {
    id: 'method',
    num: '06',
    anchor: 'method',
    extract: (s) => ({
      lead: p(s, 0),
      pillars: splitList(p(s, 1), '|').map((entry) => {
        const [letter, name] = splitDash(entry, 2);
        return { letter: clean(letter), name: clean(name) };
      }),
      note: p(s, 2),
    }),
  },
  {
    id: 'services',
    num: '07',
    anchor: 'services',
    extract: (s) => ({ items: splitList(p(s, 0), ';') }),
  },
  {
    id: 'pathway',
    num: '08',
    anchor: 'pathway',
    extract: (s) => ({ steps: splitArrow(p(s, 0)), note: p(s, 1) }),
  },
  {
    id: 'programmes',
    num: '09',
    anchor: 'programmes',
    extract: (s) => ({
      lead: p(s, 0),
      paragraphs: [p(s, 1), p(s, 2), p(s, 3)],
      status: readStatus(p(s, 4)),
    }),
  },
  {
    id: 'founding',
    num: '10',
    anchor: 'founding',
    extract: (s) => ({
      tables: [readProgrammeTable(tbl(s, 0)), readProgrammeTable(tbl(s, 1))].filter(Boolean),
    }),
  },
  {
    id: 'international',
    num: '11',
    anchor: 'international',
    extract: (s) => ({
      lead: p(s, 0),
      paragraphs: [p(s, 1), p(s, 2), p(s, 3)],
      status: readStatus(p(s, 4)),
    }),
  },
  {
    id: 'ecosystem',
    num: '12',
    anchor: 'ecosystem',
    extract: (s, { hints }) => {
      const intro = p(s, 0);
      const i = intro.indexOf(hints.ecosystemLead);
      const tail = i === -1 ? '' : intro.slice(i + hints.ecosystemLead.length);
      return {
        lead: intro,
        disciplines: tail ? splitCommaList(tail, hints.conjunction) : [],
        note: p(s, 1),
      };
    },
  },
  {
    id: 'fees',
    num: '13',
    anchor: 'fees',
    extract: (s) => {
      const headline = p(s, 0);
      const i = headline.indexOf(':');
      return {
        headline,
        planName: i === -1 ? headline : clean(headline.slice(0, i)),
        priceLine: dropTrailingDot(afterColon(headline, '')),
        paragraphs: [p(s, 1), p(s, 2)],
      };
    },
  },
  {
    id: 'inclusion',
    num: '14',
    anchor: 'inclusion',
    extract: (s) => ({ paragraphs: [p(s, 0), p(s, 1)], status: readStatus(p(s, 2)) }),
  },
  {
    id: 'digital',
    num: '15',
    anchor: 'digital',
    extract: (s, { hints }) => ({
      roadmapLead: p(s, 0),
      roadmapItems: splitCommaList(afterColon(p(s, 0), ''), hints.conjunction),
      paragraphs: [p(s, 1), p(s, 2)],
      status: readStatus(p(s, 3)),
    }),
  },
  {
    id: 'team',
    num: '16',
    anchor: 'team',
    extract: (s) => ({
      // blocks 0, 6, 7 are developer instructions, not public copy.
      members: s.blocks.slice(1, 6).map((b) => {
        const [name, role, rest] = splitDash(b.text, 3);
        const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(rest)) ? clean(rest) : null;
        return {
          name: clean(name),
          role: clean(role),
          email,
          // Client has not created these mailboxes yet - BLOCKER #3.
          emailPending: email === null,
        };
      }),
    }),
  },
  {
    id: 'founder',
    num: '17',
    anchor: 'founder',
    extract: (s) => {
      const [name, rest] = splitDash(p(s, 0), 2);
      const dot = rest.indexOf('. ');
      return {
        name: clean(name),
        role: dot === -1 ? '' : clean(rest.slice(0, dot)),
        bio: dot === -1 ? clean(rest) : clean(rest.slice(dot + 1)),
        quote: p(s, 1),
      };
    },
  },
  {
    id: 'book',
    num: '18',
    anchor: 'book',
    // Both source blocks are instructions to the developer. Public copy for
    // this section is authored - see src/data/authored/{loc}.json.
    extract: () => ({}),
  },
  {
    id: 'identity',
    num: '19',
    anchor: 'identity',
    extract: (s) => ({
      // Block 1 is explicitly marked "Public wording:" in the pack and is the
      // one sentence the client requires verbatim (hard constraint #7).
      collectionNotice: stripQuotes(afterColon(p(s, 1))),
      status: readStatus(p(s, 3)),
    }),
  },
  {
    id: 'roadmap',
    num: '20',
    anchor: 'roadmap',
    extract: (s, { hints }) => ({
      items: splitCommaList(afterColon(p(s, 0), ''), hints.conjunction),
      status: readStatus(p(s, 1)),
    }),
  },
  {
    id: 'contact',
    num: '21',
    anchor: 'contact',
    extract: (s) => {
      const parts = splitList(p(s, 1), '|');
      const email = parts.find((x) => x.includes('@')) ?? '';
      const website = parts.find((x) => /^www\./i.test(x)) ?? '';
      const phone = parts.find((x) => /^\+\d/.test(x)) ?? '';
      return {
        tagline: p(s, 0),
        institutional: parts[0] ?? '',
        place: parts[1] ?? '',
        phone,
        email,
        website,
        // Rendered only when PUBLIC_SHOW_LEGAL_STATUS=true - BLOCKER #1.
        legalFooter: splitList(afterColon(p(s, 4)), '|', true),
      };
    },
  },
];

// ---------------------------------------------------------------------------
// merge + emit
// ---------------------------------------------------------------------------

/**
 * Corrections applied to every extracted string.
 *
 * The client's 14 August update brief supersedes the 10 August content pack:
 * mhsv.ch was acquired and mhsv-international.org is retired everywhere -
 * visible copy, links, mailto attributes, metadata. Rewriting here rather than
 * per-field means a stale address cannot survive anywhere in the pack, and
 * `npm run content:check` fails the build if one ever reappears.
 */
const SUPERSEDED = [
  { from: /@mhsv-international\.org/g, to: '@mhsv.ch' },
  { from: /mhsv-international\.org/g, to: 'mhsv.ch' },
];

function applySupersessions(value) {
  if (typeof value === 'string') {
    let out = value;
    for (const { from, to } of SUPERSEDED) out = out.replace(from, to);
    return out;
  }
  if (Array.isArray(value)) return value.map(applySupersessions);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, applySupersessions(v)]));
  }
  return value;
}

/** Deep merge where the authored overlay wins over anything extracted. */
function merge(base, overlay) {
  if (Array.isArray(overlay) || overlay === null || typeof overlay !== 'object') return overlay;
  const out = { ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}) };
  for (const [k, v] of Object.entries(overlay)) out[k] = merge(out[k], v);
  return out;
}

function build() {
  if (!existsSync(DOCX)) {
    console.error(
      [
        '',
        `✗ content pack not found: ${DOCX}`,
        '',
        '  This script regenerates src/data/i18n/*.json from the client pack,',
        '  which lives outside the repository and is not committed.',
        '',
        '  If you are deploying: you do not need this. The generated JSON is',
        '  committed - run "npm run build", which validates it and builds.',
        '',
        '  If you are updating content: put the .docx next to the repo, or set',
        '    MHSV_CONTENT_DOCX=/path/to/…V3.docx npm run content:extract',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  const blocks = readDocxBlocks(DOCX);
  const byLocale = segmentByLocale(blocks);
  const legend = readStatusLegend(blocks);

  const audit = { source: DOCX.split('/').pop(), extractedAt: null, locales: {} };
  const results = {};

  for (const loc of LOCALES) {
    const sections = segmentBySection(byLocale[loc]);
    if (sections.size !== 21) {
      throw new Error(`[${loc}] expected 21 sections, found ${sections.size}`);
    }

    const out = { locale: loc, sections: {} };
    const auditSections = {};

    for (const def of SECTIONS) {
      const s = sections.get(def.num);
      if (!s) throw new Error(`[${loc}] missing section ${def.num}`);
      out.sections[def.id] = {
        num: def.num,
        anchor: def.anchor,
        title: s.title,
        ...def.extract(s, { locale: loc, hints: HINTS[loc] }),
      };
      auditSections[def.id] = s.blocks.map((b) =>
        b.type === 'tbl' ? { table: b.rows } : b.text,
      );
    }

    // Brand identity is stated in §01 - lift it so components don't reach
    // into the hero for it.
    const hero = out.sections.hero;
    out.brand = {
      name: hero.brand,
      institutional: hero.institutional,
      legalStatus: hero.legalStatus,
      baseline: hero.baseline,
    };

    results[loc] = out;
    audit.locales[loc] = auditSections;
  }

  // FR badge labels come from the pack's own legend table; the other three
  // locales are authored (only the "in development" state appears in V3).
  if (legend) {
    audit.statusLegendFR = legend;
    const keys = ['active', 'inDevelopment', 'pilot', 'partnership', 'future'];
    // Underscore-prefixed: informational only, excluded from the parity check.
    results.fr._statusFromPack = Object.fromEntries(
      legend.map((row, i) => [keys[i], { label: row.label, description: row.description }]),
    );
  }

  // Overlay authored strings.
  const outDir = resolve(ROOT, 'src/data/i18n');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(resolve(ROOT, 'src/data/_audit'), { recursive: true });

  for (const loc of LOCALES) {
    let authored = {};
    try {
      authored = JSON.parse(readFileSync(resolve(ROOT, `src/data/authored/${loc}.json`), 'utf8'));
    } catch {
      console.warn(`  ! no authored overlay for "${loc}" - UI strings will be missing`);
    }
    const merged = merge(applySupersessions(results[loc]), authored);
    writeFileSync(resolve(outDir, `${loc}.json`), JSON.stringify(merged, null, 2) + '\n');
    const n = Object.keys(merged.sections).length;
    console.log(`  ✓ src/data/i18n/${loc}.json  (${n} sections)`);
  }

  writeFileSync(
    resolve(ROOT, 'src/data/_audit/source-blocks.json'),
    JSON.stringify(audit, null, 2) + '\n',
  );
  console.log('  ✓ src/data/_audit/source-blocks.json  (raw pack text, for client review)');
}

build();
