// Renders the showreel frame by frame.
//   node render.js <outDir> <fps> [start] [end] [--stills t1,t2,...]
// Frames are written as JPEG (q=95) named f000000.jpg so ffmpeg can encode them.
const { chromium } = require(process.env.PW || '/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const [,, out, fpsArg, startArg, endArg, stillsFlag, stillsArg] = process.argv;
const fps = +fpsArg || 60;
const URL = process.env.REEL_URL || 'http://localhost:8770/showreel/index.html';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-device-scale-factor=1'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(() => {}))); });
  if (errs.length) console.error('page errors', errs);
  if (stillsFlag === '--stills') {
    for (const t of stillsArg.split(',').map(Number)) {
      await p.evaluate(([t, fps]) => REEL.seek(t, fps), [t, fps]);
      await p.screenshot({ path: `${out}/still-${t.toFixed(2)}.jpg`, type: 'jpeg', quality: 90 });
    }
    if (process.env.DUMP_SFX) fs.writeFileSync(process.env.DUMP_SFX, JSON.stringify(await p.evaluate(() => ({ bpm: REEL.bpm, duration: REEL.duration, sfx: SFX })), null, 0));
    await b.close(); return;
  }
  const dur = await p.evaluate(() => REEL.duration);
  const f0 = Math.round((+startArg || 0) * fps), f1 = Math.min(Math.round((endArg ? +endArg : dur) * fps), Math.round(dur * fps));
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    await p.evaluate(([t, fps]) => REEL.seek(t, fps), [f / fps, fps]);
    await p.screenshot({ path: `${out}/f${String(f).padStart(6, '0')}.jpg`, type: 'jpeg', quality: 95 });
    if ((f - f0) % 300 === 0) console.log(`frame ${f} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  }
  console.log('done', f0, f1, errs);
  await b.close();
})();
