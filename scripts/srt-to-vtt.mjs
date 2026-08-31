import { readFileSync, writeFileSync } from 'node:fs';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('usage: node scripts/srt-to-vtt.mjs <in.srt> <out.vtt>');
  process.exit(1);
}

const srt = readFileSync(input, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');

const vtt =
  'WEBVTT\n\n' +
  srt
    .trim()
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim() +
  '\n';

writeFileSync(output, vtt);

const cues = (vtt.match(/-->/g) ?? []).length;
console.log(`  ✓ ${output} - ${cues} cues`);
