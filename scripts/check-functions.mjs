/**
 * Builds the Pages Functions the way Cloudflare does.  `npm run check:functions`
 *
 * Everything else in this project tests the handler as a plain module, which
 * passes happily while the deploy fails - the Worker is BUNDLED, and the
 * bundler follows imports the module loader never evaluates. That is exactly
 * how nodemailer got pulled into the Worker:
 *
 *   ✘ [ERROR] Could not resolve "nodemailer"
 *       lib/contact-core.mjs:243:49
 *
 * from a dynamic import guarded by a transport check that is never true on
 * Cloudflare. This runs the real bundler so that failure surfaces here.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, '.wrangler/tmp');
const OUT = resolve(OUT_DIR, 'functions-check.js');

rmSync(OUT, { force: true });
mkdirSync(OUT_DIR, { recursive: true });

const result = spawnSync(
  'npx',
  ['wrangler', 'pages', 'functions', 'build', `--outfile=${OUT}`],
  { cwd: ROOT, encoding: 'utf8' },
);

const output = `${result.stdout || ''}${result.stderr || ''}`;

if (result.status !== 0 || !existsSync(OUT)) {
  console.error('\n✗ the Pages Functions bundle does not build\n');
  console.error(output.split('\n').slice(-30).join('\n'));
  process.exit(1);
}

/*
 * Node-only libraries must stay OUT of the Worker. nodemailer speaks SMTP over
 * raw TCP, which Workers cannot open, so its presence means either a broken
 * deploy or a needlessly huge bundle.
 */
const bundle = readFileSync(OUT, 'utf8');
const leaked = ['SMTPConnection', 'xoauth2', 'mail-composer'].filter((s) => bundle.includes(s));
if (leaked.length) {
  console.error(`\n✗ node-only code was bundled into the Worker: ${leaked.join(', ')}\n`);
  process.exit(1);
}

console.log(`  ✓ Pages Functions bundle OK - ${Math.round(bundle.length / 1024)}kB, no node-only libraries`);
