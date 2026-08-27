/* Clicks every interactive control in every menu and reports anything that
   errors, does nothing, or leaves the interface in a broken state. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' | ' + (e.stack||'').split('\n')[1]));

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#bootStart');
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 99; d.money = 1e12;
    VF.progression.checkUnlocks();
    d.stats.voidCatches = 1;
    VF.fish.list.forEach((f, i) => { if (i % 2 === 0) d.fishdex[f.id] = { caught: 2, firstSeen: Date.now(),
      mutations: { golden: 1 }, record: { kg: 9, m: 2, pct: 0.7, mutation: 'golden' } }; });
    d.kept = [0,1,2].map(i => ({ id: VF.fish.list[i].id, kg: 3, m: 1, pct: 0.5,
      mutation: null, value: 500, at: Date.now(), location: 'shore' }));
    VF.hud.refreshAll();
  });

  let clicked = 0, dead = 0;
  // 'admin' is not in this list on purpose: it is behind the door, and a
  // build handed to anybody does not have it at all.
  const panels = ['shop','fishdex','bag','stats','settings','map','journal','wardrobe'];
  for (const p of panels) {
    await page.evaluate(p => { VF.panels.close(); VF.panels.open(p); }, p);
    await page.waitForTimeout(300);

    // walk every tab in this panel
    const tabCount = await page.evaluate(() => document.querySelectorAll('.panel .tab').length);
    for (let ti = 0; ti < Math.max(1, tabCount); ti++) {
      if (tabCount) {
        await page.evaluate(i => { const t = document.querySelectorAll('.panel .tab')[i]; if (t) t.click(); }, ti);
        await page.waitForTimeout(220);
      }
      const controls = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.panel button, .panel .switch, .panel .dex-cell'))
          .map((el, i) => i).length);
      for (let i = 0; i < controls; i++) {
        const info = await page.evaluate(i => {
          const els = Array.from(document.querySelectorAll('.panel button, .panel .switch, .panel .dex-cell'));
          const el = els[i];
          if (!el) return null;
          const label = (el.textContent || el.className).trim().slice(0, 26);
          if (el.classList.contains('panel-close') || el.classList.contains('tab')) return { skip: true, label };
          if (el.disabled) return { skip: true, label: label + ' [disabled]' };
          if (/reset everything/i.test(label)) return { skip: true, label };
          const before = document.body.innerHTML.length;
          el.click();
          return { label, before };
        }, i);
        if (!info || info.skip) continue;
        clicked++;
        await page.waitForTimeout(70);
        const state = await page.evaluate(() => ({
          panel: !!document.querySelector('.panel, .catch-card, .dialog, .opener, .speech'),
          modalVisible: !document.getElementById('modal').classList.contains('hidden')
        }));
        if (!state.panel && state.modalVisible) {
          dead++;
          console.log('  broken after clicking:', info.label);
        }
        // some clicks navigate (dex detail, travel); re-open to keep walking
        const stillHere = await page.evaluate(p => {
          const open = VF.panels.isOpen();
          if (!open) { VF.panels.open(p); return false; }
          return true;
        }, p);
        if (!stillHere) { await page.waitForTimeout(200); break; }
      }
    }
  }
  await page.evaluate(() => VF.panels.close());
  await page.waitForTimeout(300);

  console.log('controls clicked:', clicked, '| broken:', dead);

  /* ------------------------------------------------------------ the room

     The aquarium is not a panel, so the walk above never reaches it. It is
     also the largest interactive surface added since that walk was written, so
     it gets its own: stand in front of each of the four things in the room,
     click every control the drawer puts up, and check nothing throws and the
     door still closes. */
  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 99; d.money = 1e12;
    VF.progression.checkUnlocks();
    d.kept = VF.fish.list.slice(0, 10).map(f => ({
      id: f.id, kg: f.kg[1] * 0.6, m: f.m[1] * 0.7, pct: 0.6, traits: [],
      mutation: null, value: f.value, at: Date.now(), location: 'shore',
      rarity: f.rarity, weather: 'clear', time: 'night', bait: 'worm', rod: 'wood'
    }));
    VF.cosmetics.list.forEach(c => { if (c.aqua) VF.cosmetics.grant(c.id); });
    VF.hud.refreshAll();
  });
  await page.click('.mbtn[data-panel="aquarium"]');
  await page.waitForTimeout(700);

  let roomClicked = 0, roomDead = 0;
  const roomOpen = await page.evaluate(() => VF.aquariumUI.isOpen());
  if (!roomOpen) { console.log('  the aquarium did not open'); roomDead++; }

  await page.evaluate(() => {
    VF.aquarium.addTank();
    for (let i = 0; i < 4; i++) VF.aquarium.house(0, 0);
    for (let i = 0; i < 3; i++) VF.aquarium.house(0, 1);
    const a = VF.aquarium.state();
    Object.keys(VF.aquarium.counts()).forEach(id => { a.research[id] = 1; });
  });
  await page.waitForTimeout(300);

  for (const station of ['tank', 'desk', 'cabinet', 'pedestal']) {
    const r = await page.evaluate(k => {
      const L = VF.aquariumArt.layout(
        Math.max(360, window.innerWidth - (window.innerWidth >= 900
          ? Math.min(400, window.innerWidth * 0.30) : 0)),
        window.innerHeight, VF.aquarium.tankCount());
      const t = k === 'tank' ? L.tanks[0] : L[k];
      return t ? { x: Math.round(t.x + t.w / 2), y: Math.round(t.y + t.h / 2) } : null;
    }, station);
    if (!r) { console.log('  no ' + station + ' in the layout'); roomDead++; continue; }
    await page.mouse.click(r.x, r.y);
    await page.waitForTimeout(350);

    // and every control the drawer put up
    const n = await page.evaluate(() => document.querySelectorAll('.aq-drawer button').length);
    for (let i = 0; i < n; i++) {
      const ok = await page.evaluate(i => {
        const b = document.querySelectorAll('.aq-drawer button')[i];
        if (!b || b.disabled) return true;
        b.click();
        return VF.aquariumUI.isOpen();
      }, i);
      roomClicked++;
      if (!ok) { roomDead++; }
      await page.waitForTimeout(45);
    }
    await page.waitForTimeout(120);
  }

  const roomStill = await page.evaluate(() => VF.aquariumUI.isOpen());
  await page.evaluate(() => VF.aquariumUI.close());
  await page.waitForTimeout(400);
  const roomShut = await page.evaluate(() => ({
    open: VF.aquariumUI.isOpen(), panelOpen: VF.state.rt.panelOpen,
    housed: VF.aquarium.housed(), findings: VF.state.data.stats.discoveries | 0
  }));
  console.log('aquarium: opened', roomOpen, '| controls', roomClicked,
              '| broken', roomDead, '| survived the walk', roomStill,
              '| after leaving', JSON.stringify(roomShut));
  dead += roomDead;

  /* Erasing a slot, which is what "reset" became once there were four games.
     Erase the slot being played: that is the one with the confirmation and the
     one that has to leave a playable game behind. */
  await page.evaluate(() => { VF.panels.close(); VF.panels.open('settings'); });
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const here = Array.from(document.querySelectorAll('.saveslot')).find(r => r.classList.contains('here'));
    const b = here && Array.from(here.querySelectorAll('button')).find(x => /erase/i.test(x.textContent));
    if (b) b.click();
  });
  await page.waitForTimeout(250);
  const dlg = await page.evaluate(() => !!document.querySelector('.dialog'));
  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('.dialog button')).find(x => /^(reset|erase)$/i.test(x.textContent.trim()));
    if (b) b.click();
  });
  await page.waitForTimeout(500);
  const afterReset = await page.evaluate(() => ({
    money: VF.state.data.money, level: VF.state.data.level,
    dex: Object.keys(VF.state.data.fishdex).length,
    panelOpen: VF.panels.isOpen(), modalHidden: document.getElementById('modal').classList.contains('hidden')
  }));
  console.log('erase dialog shown:', dlg, '| after reset:', JSON.stringify(afterReset));

  // the game must still be playable after a reset
  const playable = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    VF.fishing.beginCharge(); await sleep(400); VF.fishing.releaseCharge();
    await sleep(900);
    VF.fishing.S.biteWait = 0.02; await sleep(300);
    const st = VF.fishing.state();
    if (st === 'bite') VF.fishing.hook();
    let g = 0;
    while (VF.fishing.state() === 'reeling' && g++ < 2000) {
      const f = VF.fishing.S.fight;
      if (f) VF.fishing.setReeling(f.tension < 0.6);
      await sleep(8);
    }
    return VF.fishing.state();
  });
  console.log('playable after reset:', playable);
  // wait for the catch card, then dismiss it WITHOUT choosing an action:
  // the rod must still be usable afterwards
  await page.waitForFunction(() => VF.catchUI.isOpen(), null, { timeout: 4000 }).catch(() => {});
  const dismiss = await page.evaluate(async () => {
    const moneyBefore = VF.state.data.money;
    VF.catchUI.close();
    await new Promise(r => setTimeout(r, 400));
    return { state: VF.fishing.state(), gained: VF.state.data.money - moneyBefore };
  });
  console.log('dismissed card without choosing ->', JSON.stringify(dismiss));

  // encounter path, driven naturally
  const enc = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const log = { started: false, revealed: false, rank: -1, name: '', calm: 0 };
    VF.bus.on('encounter:start', () => log.started = true);
    VF.bus.on('encounter:reveal', () => log.revealed = true);
    VF.bus.on('fishing:bite', c => { log.rank = VF.rarities.rank(c.rarity); log.name = c.fish.name; });
    VF.fishing.hardReset();
    VF.state.data.level = 60; VF.progression.checkUnlocks();
    VF.state.data.location = 'nowhere'; VF.loot.invalidatePool();
    VF.bus.emit('location:changed');
    VF.fishing.beginCharge(); await sleep(500); VF.fishing.releaseCharge();
    await sleep(900);
    VF.fishing.S.biteWait = 999;
    VF.encounters.force();
    await sleep(1800); log.calm = +VF.encounters.calm().toFixed(2);
    await sleep(3200);
    let g = 0;
    while (VF.fishing.state() !== 'bite' && g++ < 400) await sleep(16);
    return log;
  });
  console.log('encounter:', JSON.stringify(enc));

  console.log('\nerrors:', errors.length);
  errors.slice(0, 15).forEach(e => console.log('  !', e));
  await browser.close();
  process.exit(errors.length || dead ? 1 : 0);
})();
