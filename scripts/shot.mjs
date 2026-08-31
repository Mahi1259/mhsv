import puppeteer from 'puppeteer-core';

const [locale = 'fr', width = '390', out = `/tmp/mhsv-${locale}-${width}.png`] = process.argv.slice(2);
const full = process.argv.includes('--full');
const BASE = process.env.AUDIT_BASE_URL || 'http://localhost:4321';
const CHROME =
  process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: Number(width), height: full ? 1200 : 2000 });
await page.goto(`${BASE}/${locale}/`, { waitUntil: 'networkidle0' });
await page.screenshot({ path: out, fullPage: full });
await browser.close();

console.log(`  ✓ ${out} - ${locale} @ ${width}px${full ? ' (full page)' : ''}`);
