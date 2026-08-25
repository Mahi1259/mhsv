import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox']});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
for (const l of ['fr','en','de','it']) {
  await p.goto(`http://localhost:4321/${l}/#roadmap`, { waitUntil:'networkidle0' });
  await new Promise(r=>setTimeout(r,700));
  console.log(l, JSON.stringify(await p.evaluate(() => {
    const g = document.querySelector('.gst');
    return { present: !!g, badge: g?.querySelector('.status span:not(.visually-hidden)')?.textContent.trim(),
             title: g?.querySelector('.gst__title')?.textContent.trim(),
             insideRoadmap: !!g?.closest('#roadmap'),
             bodyStart: g?.querySelector('.gst__body')?.textContent.trim().slice(0,42) };
  })));
}
await p.goto('http://localhost:4321/en/#roadmap', { waitUntil:'networkidle0' });
await new Promise(r=>setTimeout(r,900));
await p.screenshot({ path:'scripts/tmp/gst.png' });
await b.close();
