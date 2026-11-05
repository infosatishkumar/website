// Prints profile.html to a PDF (1080x1350 pages) and, optionally, JPEG previews of every page.
//   node profile/print.js [--png outDir]
const { chromium } = require(process.env.PW || '/opt/node-tools/node_modules/playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
  await p.goto('file://' + path.join(__dirname, 'profile.html'), { waitUntil: 'networkidle' });
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  const bad = await p.evaluate(() => [...document.images].filter(i => !i.naturalWidth).map(i => i.src));
  if (bad.length) console.error('missing images', bad);
  const over = await p.evaluate(() => [...document.querySelectorAll('.pg')].map((pg, i) => {
    const top = pg.getBoundingClientRect().top;
    const kids = [...pg.querySelectorAll('*')].filter(e => !e.closest('.foot') && !e.classList.contains('dot') && !e.classList.contains('cover-grid'));
    return [i + 1, Math.round(Math.max(...kids.map(e => e.getBoundingClientRect().bottom - top)))];
  }).filter(x => x[1] > 1350 - 80));
  if (over.length) console.error('content near/over page bottom', JSON.stringify(over));
  await p.pdf({ path: path.join(__dirname, 'DigitalNgage-Company-Profile.pdf'), width: '1080px', height: '1350px', printBackground: true, preferCSSPageSize: true });
  const i = process.argv.indexOf('--png');
  if (i > -1) {
    const out = process.argv[i + 1];
    const pages = await p.$$('.pg');
    for (let k = 0; k < pages.length; k++) await pages[k].screenshot({ path: `${out}/page-${String(k + 1).padStart(2, '0')}.jpg`, type: 'jpeg', quality: 85 });
  }
  await b.close();
  console.log('ok');
})();
