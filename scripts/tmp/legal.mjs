import puppeteer from 'puppeteer-core';
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:true, args:['--no-sandbox']});
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
// every footer legal link resolves
for (const l of ['fr','en','de','it']) {
  await p.goto(`http://localhost:4321/${l}/`, { waitUntil:'networkidle0' });
  const links = await p.evaluate(()=>[...document.querySelectorAll('.site-footer__links a')].map(a=>({t:a.textContent.trim(), h:a.getAttribute('href')})));
  const codes = [];
  for (const { h } of links) { const r = await p.goto('http://localhost:4321'+h, { waitUntil:'domcontentloaded' }); codes.push(r.status()); }
  console.log(l, links.map(x=>x.t).join(' | '), '=>', codes.join(','));
}
// cookie banner: appears, accepts, does not return
const q = await b.newPage();
await q.setViewport({ width: 1440, height: 900 });
await q.goto('http://localhost:4321/en/', { waitUntil:'networkidle0' });
await new Promise(r=>setTimeout(r,400));
const shown = await q.evaluate(()=>{ const c=document.querySelector('[data-cookie]'); return { visible: c && !c.hidden, text: c?.textContent.replace(/\s+/g,' ').trim().slice(0,70) }; });
await q.evaluate(()=>document.querySelector('[data-cookie-accept]').click());
await new Promise(r=>setTimeout(r,200));
const afterClick = await q.evaluate(()=>document.querySelector('[data-cookie]').hidden);
await q.reload({ waitUntil:'networkidle0' });
await new Promise(r=>setTimeout(r,400));
const afterReload = await q.evaluate(()=>document.querySelector('[data-cookie]').hidden);
console.log('cookie banner:', JSON.stringify({ ...shown, hiddenAfterAccept: afterClick, hiddenAfterReload: afterReload,
  stored: await q.evaluate(()=>localStorage.getItem('mhsv-cookie-notice')) }));
console.log('third-party scripts:', await q.evaluate(()=>[...document.querySelectorAll('script[src]')].map(s=>s.src).filter(s=>!s.startsWith(location.origin)).length));
await b.close();
