const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  page.on('pageerror', e => console.log('PAGEERROR', e.message));
  await page.goto('file://' + path.join(path.join(__dirname,'..'), 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#bootStart');
  await page.waitForTimeout(400);
  const m1 = await page.evaluate(() => {
    const c = document.getElementById('scene');
    const r = c.getBoundingClientRect();
    return { iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio,
             rect: [r.width, r.height], attr: [c.width, c.height], scene: VF.scene.size() };
  });
  console.log('before:', JSON.stringify(m1));
  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 99; d.money = 5e9;
    d.unlockedLocations = VF.locations.list.map(l => l.id);
    d.ownedRods = VF.rods.list.map(r => r.id);
    VF.bait.list.forEach(b => { if (!b.unlimited) VF.bait.add(b.id, 40); });
    VF.progression.checkUnlocks();
    VF.hud.refreshAll();
  });
  await page.waitForTimeout(300);
  const m2 = await page.evaluate(() => {
    const c = document.getElementById('scene');
    const r = c.getBoundingClientRect();
    const b = document.body.getBoundingClientRect();
    return { iw: innerWidth, ih: innerHeight, rect: [r.width, r.height],
             attr: [c.width, c.height], scene: VF.scene.size(),
             body: [b.width, b.height], scrollW: document.documentElement.scrollWidth,
             scrollH: document.documentElement.scrollHeight };
  });
  console.log('after :', JSON.stringify(m2));
  await browser.close();
})();
