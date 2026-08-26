const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.click('#bootStart');
  await p.waitForTimeout(900);
  const spots = process.argv.slice(2).length ? process.argv.slice(2) : ['shore', 'abyss', 'beneath'];
  for (const id of spots) {
    await p.evaluate(x => {
      const d = VF.state.data;
      VF.secrets.list.forEach(s => { if (!VF.secrets.found(s.id)) VF.secrets.discover(s.id); });
      VF.locations.list.forEach(l => { if (d.unlockedLocations.indexOf(l.id) < 0) d.unlockedLocations.push(l.id); });
      d.location = x; VF.loot.invalidatePool(); VF.weather.reconcile();
      VF.scene.rebuild(); VF.scene.seedAmbient();
      document.getElementById('hud').classList.add('hidden');
    }, id);
    await p.waitForTimeout(1400);
    await p.screenshot({ path: path.join(__dirname, 'scene-' + id + '.png') });
    console.log('shot', id);
  }
  await b.close();
})();
