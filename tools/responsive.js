/* Checks the interface at several viewport sizes and reports overflow. */
const { chromium } = require('playwright');
const path = require('path');
const SIZES = [[1920,1080,'desktop-hd'],[1440,900,'laptop'],[1280,720,'laptop-sm'],
               [1024,640,'small'],[860,540,'narrow'],[720,900,'portrait']];
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  for (const [w, h, name] of SIZES) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(name + ': ' + m.text()); });
    await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
    await page.waitForTimeout(350);
    await page.click('#bootStart');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const d = VF.state.data;
      d.level = 45; d.money = 12345678;
      VF.progression.checkUnlocks();
      d.ownedRods = VF.rods.list.filter(r => r.level <= 45).map(r => r.id);
      d.rod = 'celestial';
      VF.fish.list.slice(0, 26).forEach(f => { d.fishdex[f.id] = { caught: 3, firstSeen: Date.now(),
        mutations: {}, record: { kg: 5, m: 1, pct: 0.6, mutation: null } }; });
      VF.hud.refreshAll();
    });
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => ({
      docScrollW: document.documentElement.scrollWidth, docW: document.documentElement.clientWidth,
      docScrollH: document.documentElement.scrollHeight, docH: document.documentElement.clientHeight,
      offscreen: Array.from(document.querySelectorAll('#hud button, #hud .chip')).filter(el => {
        const r = el.getBoundingClientRect();
        return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1;
      }).map(el => (el.id || el.className) + ' @' + Math.round(el.getBoundingClientRect().left) + ',' + Math.round(el.getBoundingClientRect().top))
    }));
    await page.screenshot({ path: 'tools/rs-' + name + '.png' });
    // and a panel at this size
    await page.evaluate(() => VF.panels.open('shop'));
    await page.waitForTimeout(320);
    const panelFit = await page.evaluate(() => {
      const p = document.querySelector('.panel');
      if (!p) return 'missing';
      const r = p.getBoundingClientRect();
      return { fits: r.width <= innerWidth && r.height <= innerHeight,
               w: Math.round(r.width), h: Math.round(r.height) };
    });
    await page.screenshot({ path: 'tools/rs-' + name + '-panel.png' });

    /* And the aquarium, which lays out completely differently either side of
       900px — a rail down the right on a wide screen, a drawer across the
       bottom on a narrow one. Whichever it is, nothing standing on the floor
       of the room may end up underneath it. */
    await page.evaluate(() => {
      VF.panels.close();
      const d = VF.state.data;
      d.kept = VF.fish.list.slice(0, 4).map(f => ({
        id: f.id, kg: 4, m: 1, pct: 0.5, traits: [], mutation: null,
        value: f.value, at: Date.now(), location: 'shore', rarity: f.rarity
      }));
      VF.aquariumUI.show();
      for (let i = 0; i < 3; i++) VF.aquarium.house(0, 0);
    });
    await page.waitForTimeout(500);
    const room = await page.evaluate(() => {
      const rail = document.querySelector('.aq-drawer').getBoundingClientRect();
      const wide = innerWidth >= 900;
      const roomW = wide ? innerWidth - rail.width : innerWidth;
      const roomH = wide ? innerHeight : rail.top;
      const L = VF.aquariumArt.layout(Math.max(360, roomW), Math.max(250, roomH), VF.aquarium.tankCount());
      const parts = { desk: L.desk, plinth: L.pedestal, cabinet: L.cabinet, tank: L.tanks[0] };
      const covered = [];
      for (const k in parts) {
        const r = parts[k];
        if (!r) continue;
        // more than a third of it behind the drawer is "underneath it"
        const over = Math.max(0, (r.y + r.h) - roomH);
        if (over > r.h * 0.34) covered.push(k);
        if (r.x + r.w > roomW + 1) covered.push(k + '(right)');
      }
      return { rail: Math.round(rail.width), roomW: Math.round(roomW),
               window: !!L.window, covered: covered };
    });
    await page.screenshot({ path: 'tools/rs-' + name + '-aquarium.png' });
    await page.evaluate(() => VF.aquariumUI.close());
    await page.waitForTimeout(300);
    if (room.covered.length) errors.push(name + ': aquarium hides ' + room.covered.join(', '));

    console.log(name.padEnd(12), w + 'x' + h,
      '| hscroll:', overflow.docScrollW > overflow.docW ? 'YES' : 'no',
      '| vscroll:', overflow.docScrollH > overflow.docH ? 'YES' : 'no',
      '| offscreen HUD:', overflow.offscreen.length ? overflow.offscreen.join(', ') : 'none',
      '| panel:', JSON.stringify(panelFit),
      '| room:', 'rail ' + room.rail + ' window ' + (room.window ? 'yes' : 'no') +
                 (room.covered.length ? ' HIDES ' + room.covered.join('/') : ' clear'));
    await page.close();
  }
  console.log('\nerrors:', errors.length);
  errors.forEach(e => console.log('  !', e));
  await browser.close();
})();
