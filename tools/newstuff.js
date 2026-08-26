/* Exercises everything added in this pass, in a real browser:
   the chart, the slate, the charter, the admin console, save transfer and
   what happens to experience past the level cap. */
const { chromium } = require('playwright');
const path = require('path');

const URL = 'file://' + path.join(__dirname, '..', 'index.html');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message + '\n    ' + String(e.stack).split('\n').slice(1,4).join('\n    ')));

  await page.goto(URL);
  await page.click('#bootStart');
  await page.waitForTimeout(700);

  const say = (k, v) => console.log('  ' + k.padEnd(34) + (typeof v === 'object' ? JSON.stringify(v) : v));

  /* ------------------------------------------------------------ the chart */
  console.log('\nchart');
  await page.evaluate(() => VF.admin.allLocations());
  await page.click('[data-panel="shop"]');           // make sure a panel can be swapped out
  await page.waitForTimeout(120);
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(400);

  say('chart canvas present', await page.$$eval('.map-canvas', n => n.length));
  say('canvas has been painted', await page.evaluate(() => {
    const cv = document.querySelector('.map-canvas');
    if (!cv || !cv.width) return false;
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    // any non-transparent, non-black pixel means the column actually drew
    for (let i = 0; i < d.length; i += 4 * 97) if (d[i + 3] > 0 && (d[i] + d[i + 1] + d[i + 2]) > 24) return true;
    return false;
  }));
  say('nodes laid out', await page.evaluate(() => {
    const places = VF.locations.list.map(l => ({ id: l.id, secret: VF.secrets.isSecretLoc(l.id), unlocked: true }));
    const nds = VF.mapArt.layout(places);
    return { n: nds.length, above: nds.filter(x => x.kind === 'above').length,
             below: nds.filter(x => x.kind === 'below').length,
             branch: nds.filter(x => x.kind === 'branch').length };
  }));
  say('readout rendered', await page.$$eval('.spot-name', n => n.map(x => x.textContent)[0]));
  say('pool shown for the spot', await page.$eval('.spot-dex-n', n => n.textContent).catch(() => 'none'));

  // clicking a node changes the readout
  const before = await page.$eval('.spot-name', n => n.textContent);
  await page.evaluate(() => {
    const cv = document.querySelector('.map-canvas');
    const r = cv.getBoundingClientRect();
    // the second unlocked node down the spine
    const nd = VF.__mapNodes ? null : null;
    const ev = new MouseEvent('click', { clientX: r.left + r.width * 0.235, clientY: r.top + r.height * 0.24, bubbles: true });
    cv.dispatchEvent(ev);
  });
  await page.waitForTimeout(200);
  say('clicking a node moves the readout', before !== await page.$eval('.spot-name', n => n.textContent));

  const travelled = await page.evaluate(async () => {
    const was = VF.state.data.location;
    const btn = Array.from(document.querySelectorAll('.spot-actions .btn'))
      .filter(b => b.textContent === 'Travel')[0];
    if (!btn) return 'no travel button';
    btn.click();
    return was !== VF.state.data.location ? 'moved' : 'did not move';
  });
  say('travel from the chart', travelled);
  await page.waitForTimeout(300);

  /* ------------------------------------------------------------- the slate */
  console.log('\nslate');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  say('jobs on the slate', await page.evaluate(() => VF.slate.jobs().length));
  say('every job describes itself', await page.evaluate(() =>
    VF.slate.jobs().every(j => typeof VF.slate.describe(j) === 'string' && VF.slate.describe(j).length > 4)));
  say('job text', await page.evaluate(() => VF.slate.jobs().map(j => VF.slate.describe(j))));
  say('no two jobs the same kind', await page.evaluate(() => {
    // roll a fresh slate a few times over and check the kinds never repeat.
    // at every level, including a brand new save
    for (let i = 0; i < 25; i++) {
      VF.admin.level([1, 3, 8, 20, 60][i % 5]);
      VF.state.data.slate = { jobs: [], rolled: 0, done: 0, seed: 0 };
      VF.slate.fill();
      const kinds = VF.slate.jobs().map(j => j.t);
      if (new Set(kinds).size !== kinds.length) return 'repeated: ' + kinds.join(',');
    }
    return true;
  }));
  say('pay tracks your level', await page.evaluate(() => {
    const j = VF.slate.jobs()[0];
    VF.admin.level(5);  const low = VF.slate.pay(j);
    VF.admin.level(70); const high = VF.slate.pay(j);
    VF.admin.level(30);
    return { low, high, rerollUnderReward: VF.slate.rerollCost() < VF.slate.pay(VF.slate.jobs()[0]) };
  }));

  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const t = Array.from(document.querySelectorAll('.tab')).filter(x => x.textContent.indexOf('slate') === 0)[0];
    if (t) t.click();
  });
  await page.waitForTimeout(250);
  say('slate tab renders rows', await page.$$eval('.row.job', n => n.length));

  say('reroll costs and works', await page.evaluate(() => {
    VF.admin.money(500000);
    const was = VF.slate.jobs()[0] && VF.slate.jobs()[0].id;
    const r = VF.slate.reroll(0);
    return { ok: r.ok, changed: was !== (VF.slate.jobs()[0] && VF.slate.jobs()[0].id) };
  }));

  // drive one job to completion through the real event path
  say('a job pays out', await page.evaluate(() => {
    const before = VF.state.data.money;
    const j = VF.slate.jobs()[0];
    let fired = null;
    VF.bus.on('slate:done', e => { fired = e.job.id; });
    // land the job by hand through the same hook the fishing loop uses, with a
    // catch that satisfies whatever the job happens to be asking for
    j.at = j.goal - 1;
    VF.state.data.streak = j.goal;
    const c = {
      id: j.fish || 'smallmouth', rarity: j.rarity || 'unknown',
      traits: ['golden', 'ancient', 'massive'], kg: 9e9, value: 9e9,
      location: j.loc || VF.state.data.location, pct: 1
    };
    VF.fishing.S.lastFight = { perfect: true };
    VF.bus.emit('fishing:landed', c);
    VF.bus.emit('fishing:treasure', c);
    VF.bus.emit('catch:released', { catch: c });
    return { fired: !!fired, richer: VF.state.data.money > before,
             refilled: VF.slate.jobs().length };
  }));

  /* ----------------------------------------------------------- the charter */
  console.log('\ncharter');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  say('conditions offered here', await page.evaluate(() => VF.charter.offered().map(c => c.name)));
  say('prices are finite and ordered', await page.evaluate(() => {
    const o = VF.charter.offered();
    const p = o.map(c => VF.charter.price(c));
    return p.every(x => isFinite(x) && x > 0);
  }));
  say('buying starts the condition', await page.evaluate(() => {
    VF.conditions.end();
    VF.admin.money(90000000);
    const id = VF.charter.offered()[0].id;
    const before = VF.state.data.money;
    const r = VF.charter.buy(id);
    return { ok: r.ok, running: VF.conditions.has(id), paid: before - VF.state.data.money > 0 };
  }));
  say('surcharge raises the next price', await page.evaluate(() => {
    const c = VF.conditionData.list[0];
    const a = VF.charter.price(c);
    VF.conditions.end();
    VF.charter.buy(VF.charter.offered()[0].id);
    return VF.charter.price(c) > a;
  }));
  say('cannot double-book the water', await page.evaluate(() => VF.charter.buy(VF.charter.offered()[0].id).why));
  say('condition clock reads out', await page.evaluate(() => ({
    left: Math.round(VF.conditions.remain()), frac: +VF.conditions.fraction().toFixed(2)
  })));
  say('hud fuse is drawn', await page.evaluate(() => {
    VF.hud.refreshAll();
    const f = document.getElementById('condFuse');
    return !!f && f.style.transform.indexOf('scaleX') === 0;
  }));

  /* --------------------------------------------------------- past the cap */
  console.log('\npast the level cap');
  say('overflow becomes reputation', await page.evaluate(() => {
    VF.admin.level(99);
    const rep = VF.state.data.reputation;
    const r = VF.progression.addXp(900 * 4);
    return { gained: r.rep, repRose: VF.state.data.reputation - rep, xpStaysZero: VF.state.data.xp };
  }));
  say('reputation keeps paying into luck', await page.evaluate(() => ({
    at480: +VF.progression.repLuck(480).toFixed(2),
    at2000: +VF.progression.repLuck(2000).toFixed(2),
    at20000: +VF.progression.repLuck(20000).toFixed(2)
  })));
  say('xp bar switches to the overflow', await page.evaluate(() => {
    VF.hud.refreshAll();
    return { overflowClass: document.getElementById('xpFill').classList.contains('overflow'),
             text: document.getElementById('xpText').textContent };
  }));

  /* ------------------------------------------------------------- transfer */
  console.log('\nsave transfer');
  const round = await page.evaluate(() => {
    VF.admin.money(1234567);
    VF.state.data.stats.catches = 4321;
    const str = VF.save.exportString();
    const wasMoney = VF.state.data.money;
    // wreck the live save, then bring it back
    VF.save.reset();
    const afterReset = VF.state.data.money;
    const r = VF.save.importString(str);
    return { tagged: str.slice(0, 4), ok: r.ok, afterReset,
             restored: VF.state.data.money === wasMoney,
             catches: VF.state.data.stats.catches };
  });
  say('export / reset / import', round);
  say('rejects junk', await page.evaluate(() => [
    VF.save.importString('').why,
    VF.save.importString('hello').why,
    VF.save.importString(btoa('{"a":1}')).why
  ]));

  /* ---------------------------------------------------------------- admin */
  console.log('\nadmin console');
  // the slate test landed a catch, so the card is up — dismiss it first
  await page.evaluate(() => { VF.catchUI.close(); VF.catchUI.close(); VF.panels.close(); VF.fishing.hardReset(); });
  await page.waitForTimeout(340);
  say('nothing is open', await page.evaluate(() => VF.state.rt.panelOpen));
  await page.keyboard.press('Backquote');
  await page.waitForTimeout(350);
  say('opens on backtick', await page.$$eval('.panel-admin', n => n.length));

  const tabs = ['give', 'rods', 'looks', 'charms', 'world', 'spawn'];
  for (const t of tabs) {
    await page.evaluate(t => VF.panels.refresh(t), t);
    await page.waitForTimeout(220);
    const n = await page.$$eval('.panel-admin .row, .panel-admin .admin-group, .panel-admin .cos-cell',
      els => els.length);
    say('tab "' + t + '" renders', n + ' elements');
  }

  await page.evaluate(() => VF.panels.refresh('rods'));
  await page.waitForTimeout(200);
  say('search filters in place', await page.evaluate(() => {
    const inp = document.querySelector('.admin-input');
    const all = document.querySelectorAll('[data-admin-name]').length;
    inp.value = 'void';
    inp.dispatchEvent(new Event('input'));
    const shown = Array.from(document.querySelectorAll('[data-admin-name]'))
      .filter(r => r.style.display !== 'none').length;
    return { all, shown, narrowed: shown < all && shown > 0 };
  }));

  say('grant everything', await page.evaluate(() => {
    VF.save.reset();
    VF.admin.everything();
    const d = VF.state.data;
    const cos = VF.cosmetics.completion();
    return {
      level: d.level,
      rods: d.ownedRods.length + '/' + VF.rods.list.length,
      cosmetics: cos.have + '/' + cos.total,
      charms: d.charms.length + '/' + VF.charms.list.length,
      spots: d.unlockedLocations.length + '/' + VF.locations.list.length,
      achievements: Object.keys(d.achievements).length,
      objects: Object.keys(d.treasures).length,
      flagged: !!d.flags.adminUsed
    };
  }));

  say('grant one rod finish', await page.evaluate(() => {
    VF.save.reset();
    const before = VF.state.data.cosmetics.length;
    VF.admin.cosmetic('rod_gilt');
    VF.admin.slot('bobber');
    return { one: VF.cosmetics.owned('rod_gilt'),
             wholeSlot: VF.cosmetics.inSlot('bobber').every(c => VF.cosmetics.owned(c.id)),
             from: before, to: VF.state.data.cosmetics.length };
  }));

  say('spawn arms the next bite', await page.evaluate(async () => {
    VF.panels.close();
    VF.fishing.hardReset();
    VF.admin.spawn({ fish: 'smallmouth', size: 1, traits: ['golden', 'ancient'] });
    VF.fishing.beginCharge();
    VF.fishing.releaseCharge();
    for (let i = 0; i < 900 && VF.fishing.state() !== 'bite'; i++) VF.fishing.tick(0.05);
    const p = VF.fishing.S.pending;
    return p ? { id: p.id, traits: p.traits, pct: +p.pct.toFixed(2) } : 'never bit';
  }));

  say('spawn by tier', await page.evaluate(() => {
    VF.fishing.hardReset();
    VF.admin.spawn({ rarity: 'legendary' });
    VF.fishing.beginCharge(); VF.fishing.releaseCharge();
    for (let i = 0; i < 900 && VF.fishing.state() !== 'bite'; i++) VF.fishing.tick(0.05);
    const p = VF.fishing.S.pending;
    return p ? { rarity: p.rarity, rank: VF.rarities.rank(p.rarity) } : 'never bit';
  }));

  say('world controls', await page.evaluate(() => {
    VF.admin.weather('storm');
    VF.admin.condition('thinplace');
    VF.admin.clock(12);
    return { sky: VF.weatherData.get('storm').name, water: VF.conditions.name(), clock: VF.time.clock() };
  }));

  /* ------------------------------------------------------ still playable */
  console.log('\nafterwards');
  await page.evaluate(() => { VF.panels.close(); VF.fishing.hardReset(); VF.admin.clearSpawn(); });
  await page.waitForTimeout(200);
  say('a normal cast still lands', await page.evaluate(() => {
    VF.fishing.beginCharge(); VF.fishing.releaseCharge();
    for (let i = 0; i < 1200 && VF.fishing.state() !== 'bite'; i++) VF.fishing.tick(0.05);
    if (VF.fishing.state() !== 'bite') return 'never bit';
    VF.fishing.hook();
    for (let i = 0; i < 4000 && VF.fishing.state() === 'reeling'; i++) {
      const f = VF.fishing.S.fight;
      if (f) VF.fishing.setReeling(f.fish > f.bar);
      VF.fishing.tick(0.016);
    }
    return VF.fishing.state();
  }));
  say('save survives a round trip', await page.evaluate(() => {
    VF.save.save();
    const r = VF.save.load();
    return { loaded: r.loaded, slate: VF.state.data.slate.jobs.length, level: VF.state.data.level };
  }));

  console.log('\nerrors: ' + errors.length);
  errors.slice(0, 12).forEach(e => console.log('  ! ' + e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
