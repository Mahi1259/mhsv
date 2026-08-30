/**
 * SRT -> WebVTT.  `node scripts/srt-to-vtt.mjs <in.srt> <out.vtt>`
 *
 * <track> accepts WebVTT and nothing else - an .srt simply never loads, with no
 * error beyond the cues not appearing. The client supplied SRT, so this is the
 * conversion, kept as a script rather than done by hand so re-supplied
 * subtitles can be converted the same way.
 *
 * The two formats differ in exactly two things that matter here: the WEBVTT
 * header, and `,` as the decimal separator in timestamps rather than `.`.
 */
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
    // 00:00:00,400 --> 00:00:04,400  becomes  00:00:00.400 --> 00:00:04.400
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
    .trim() +
  '\n';

writeFileSync(output, vtt);

const cues = (vtt.match(/-->/g) ?? []).length;
console.log(`  ✓ ${output} - ${cues} cues`);
