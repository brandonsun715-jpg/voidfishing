const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.click('#bootStart');
  await p.waitForTimeout(1000);
  await p.evaluate(() => { document.getElementById('toasts').style.display='none'; document.getElementById('hud').classList.add('hidden'); });
  for (const id of (process.argv.length > 2 ? [] : ['shore','abyss'])) {
    await p.evaluate(x => {
      const d = VF.state.data;
      VF.locations.list.forEach(l => { if (d.unlockedLocations.indexOf(l.id) < 0) d.unlockedLocations.push(l.id); });
      d.location = x; VF.loot.invalidatePool(); VF.weather.reconcile();
      VF.scene.rebuild(); VF.scene.seedAmbient();
    }, id);
    await p.waitForTimeout(1800);
    await p.screenshot({ path: path.join(__dirname, 'scene-' + id + '.png') });
  }
  console.log('errors:', errs.length); errs.slice(0,4).forEach(e=>console.log(' !',e));
  await b.close();
})();
