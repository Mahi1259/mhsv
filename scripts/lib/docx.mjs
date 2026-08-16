/**
 * Minimal WordprocessingML reader.
 *
 * We only need the linear block order of `word/document.xml` (paragraphs and
 * tables) - not styling. That is a small enough surface to read with an
 * ordered token scan, which avoids pulling a full DOCX library into the
 * handover repo.
 */
import { readFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function decodeEntities(s) {
  return s
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
}

/** Pull the visible text out of one `<w:p>` / `<w:tc>` fragment. */
function textOf(xml) {
  let out = '';
  const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    if (m[1] !== undefined) out += decodeEntities(m[1]);
    else if (m[0].startsWith('<w:tab')) out += '\t';
    else out += '\n';
  }
  return out;
}

function parseTable(xml) {
  const rows = [];
  const trRe = /<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g;
  let tr;
  while ((tr = trRe.exec(xml)) !== null) {
    const cells = [];
    const tcRe = /<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g;
    let tc;
    while ((tc = tcRe.exec(tr[1])) !== null) {
      cells.push(textOf(tc[1]).replace(/\s+/g, ' ').trim());
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * @param {string} path .docx file
 * @returns {Array<{type:'p',text:string}|{type:'tbl',rows:string[][]}>}
 */
export function readDocxBlocks(path) {
  const zip = unzipSync(readFileSync(path));
  const entry = zip['word/document.xml'];
  if (!entry) throw new Error(`${path}: no word/document.xml - not a .docx?`);
  const xml = strFromU8(entry);

  const body = /<w:body(?:\s[^>]*)?>([\s\S]*)<\/w:body>/.exec(xml);
  if (!body) throw new Error(`${path}: no <w:body>`);

  const blocks = [];
  // Tables are matched first at each scan position so their inner <w:p>
  // elements are consumed as part of the table, not emitted as loose text.
  const re = /<w:tbl(?:\s[^>]*)?>[\s\S]*?<\/w:tbl>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p\s*\/>/g;
  let m;
  while ((m = re.exec(body[1])) !== null) {
    const frag = m[0];
    if (frag.startsWith('<w:tbl')) {
      blocks.push({ type: 'tbl', rows: parseTable(frag) });
    } else {
      const text = textOf(frag).replace(/\s+/g, ' ').trim();
      if (text) blocks.push({ type: 'p', text });
    }
  }
  return blocks;
}
