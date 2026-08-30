/* The zones, with the interface taken off.

   This is the self-critique artefact. A scene that only works because a HUD,
   a cast meter and four chips are sitting on top of it is not a place, and
   the only way to find that out is to take them away and look — which is what
   F8 does in the game and what this does in bulk.

   Every zone, at three camera positions and two times of day, into one sheet.

     node tools/world.js            all of them
     node tools/world.js shore      one, larger
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ONLY = process.argv[2] || null;
const OUT = path.join(__dirname, 'sc-world');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  // everything unlocked, so every zone can actually be stood in
  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 90; d.money = 5e8;
    d.unlockedLocations = VF.locations.list.map(l => l.id);
    d.ownedRods = VF.rods.list.filter(r => r.level <= 90).map(r => r.id);
    if (d.ownedRods.indexOf('void') >= 0) d.rod = 'void';
    VF.hud.refreshAll();
    document.body.classList.add('cinema');       // the whole point
  });

  fs.mkdirSync(OUT, { recursive: true });
  const list = await page.evaluate(z => (z ? [z] : VF.locations.list.map(l => l.id)), ONLY);

  /* Two times of day, because a zone that only reads at night is a zone that
     reads because it is dark. */
  const TIMES = [{ id: 'night', cycle: 0.80 }, { id: 'day', cycle: 0.34 }];
  const CAMS = ONLY ? [-1.1, 0, 1.1] : [0];

  let shot = 0;
  for (const id of list) {
    for (const tm of TIMES) {
      for (const cu of CAMS) {
        await page.evaluate(([id, cycle, cu]) => {
          VF.state.data.location = id;
          VF.loot.invalidatePool();
          VF.bus.emit('location:changed', id);
          VF.scene.rebuild();
          if (VF.zoneArt) VF.zoneArt.invalidate();
          VF.time.setCycle(cycle);
          VF.weather.force('clear');
          for (let i = 0; i < 40; i++) VF.weather.tick(0.5);
          if (VF.camera) { VF.camera.enable(cu !== 0); VF.camera.set(cu); }
          // let the palette, the bakes and the springs all settle
          for (let i = 0; i < 90; i++) { VF.palette.update(); VF.scene.update(0.033); }
        }, [id, tm.cycle, cu]);
        await page.waitForTimeout(700);
        const name = id + '-' + tm.id + (CAMS.length > 1 ? '-cam' + cu : '');
        await page.screenshot({ path: path.join(OUT, name + '.png'), animations: 'disabled' });
        shot++;
      }
    }
  }

  console.log('wrote ' + shot + ' frames to tools/sc-world/');
  console.log('page errors:', errors.length ? errors.slice(0, 5) : 'none');
  await browser.close();
  process.exitCode = errors.length ? 1 : 0;
})();
