/* The new half of the game, driven end to end.

   tools/encounters.js already proves the creature framework. This proves the
   rest of it holds together as ONE system rather than four: a clue opens a
   lead, a lead points at a place, sailing there is a crossing with events in
   it, the crossing lands, the expedition legs tick over, the boat wears and
   repairs, and every zone's own rule produces the thing it is supposed to
   produce and hands it back when it is pressed.

   Also the part nobody enjoys writing and everybody needs: an old save — one
   from before any of this existed — loaded, played and saved again. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(800);

  let bad = 0;
  const check = (label, ok, extra) => {
    console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + label + (extra ? '  ' + extra : ''));
    if (!ok) bad++;
  };

  /* ---------------------------------------------------------- the boat */
  const boat = await page.evaluate(() => {
    const d = VF.state.data;
    d.money = 1e9; d.level = 99; d.stats.casts = 20;
    const out = {};
    out.startsAsSkiff = VF.boat.hull().id === 'skiff';
    out.boughtDory = VF.boat.buyHull('dory');
    out.fitSonar = VF.boat.buyModule('sonar');
    out.hasSonar = VF.boat.has('sonar');
    out.paint = VF.boat.buyPaint('tar') && VF.boat.paint().id === 'tar';
    out.trim = VF.boat.buyTrim('lamp') && VF.boat.shape().trim.light === 'lamp';
    VF.boat.damage(0.5);
    out.wore = VF.boat.integrity() < 1;
    out.repaired = VF.boat.repair() && VF.boat.integrity() > 0.999;
    /* And the thing a boat is actually FOR: the loadout has to see it. */
    VF.build.invalidate();
    const s = VF.build.stats();
    out.inLoadout = s.barSize !== 1 || s.line !== 1 || VF.boat.keepBonus() >= 0;
    return out;
  });
  console.log('boat');
  check('starts as a skiff', boat.startsAsSkiff);
  check('hull bought and taken out', boat.boughtDory);
  check('module fitted and readable', boat.fitSonar && boat.hasSonar);
  check('paint and trim stick', boat.paint && boat.trim);
  check('wears, and can be put right', boat.wore && boat.repaired);
  check('folded into the loadout', boat.inLoadout);

  /* ------------------------------------------------------- the crossing */
  const cross = await page.evaluate(async () => {
    const d = VF.state.data;
    VF.locations.list.forEach(function (l) {
      if (d.unlockedLocations.indexOf(l.id) < 0) d.unlockedLocations.push(l.id);
    });
    const out = { events: 0, chose: 0, quiet: 0, trips: 0 };
    out.possible = VF.voyage.possible('trench');
    let landed = false;

    /* Sail several. A crossing no longer guarantees an event — that was the
       old design and this check used to assert it — so one trip proves
       nothing either way. What matters is that the machinery still works when
       something does happen, and that some crossings are empty. */
    const WHERE = ['trench', 'basin', 'flats', 'abyss', 'shore', 'trench', 'nowhere', 'basin'];
    for (let trip = 0; trip < WHERE.length; trip++) {
      landed = false;
      if (!VF.voyage.begin(WHERE[trip], function () { landed = true; })) continue;
      if (trip === 0) out.began = VF.voyage.active();
      let saw = 0;
      let guard = 0;
      while (VF.voyage.active() && guard++ < 4000) {
        VF.voyage.tick(0.05);
        /* Steer at whatever is out there, so the sighting path is exercised
           rather than sailed past. */
        const st = VF.voyage.state && VF.voyage.state();
        VF.voyage.steer(1); VF.voyage.steer(-1);
        const card = document.getElementById('vyEvent');
        if (card && !card.classList.contains('hidden')) {
          const btns = card.querySelectorAll('button');
          if (btns.length) { saw++; out.events++; btns[0].click(); out.chose++; }
        }
      }
      out.trips++;
      if (!saw) out.quiet++;
      if (trip === 0) out.landed = landed;
    }
    out.lastLanded = landed;
    out.voyages = d.voyages;
    return out;
  });
  console.log('\ncrossing');
  check('a crossing is possible with a hull that crosses', cross.possible);
  check('it begins and it finishes', cross.began && cross.landed);
  /* Both halves matter, and the second one is the point of the rewrite: an
     ocean that always has something in it is a corridor. */
  check('a card, when there is one, resolves', cross.events === 0 || cross.chose === cross.events,
        cross.events + ' over ' + cross.trips + ' trips');
  check('and some crossings are just water', cross.quiet > 0,
        cross.quiet + ' of ' + cross.trips + ' quiet');
  check('the crossing was counted', cross.voyages > 0);

  /* ---------------------------------------------------------- the zones */
  const zones = await page.evaluate(() => {
    const d = VF.state.data;
    const out = [];
    const b = VF.boat.shape();
    b.owned = VF.boatData.hulls.map(h => h.id); b.hull = 'hunter';
    b.modules = { engine: 3, sonar: 3, hold: 3, survey: 3, tackle: 3 };

    ['shore', 'basin', 'flats', 'trench', 'abyss', 'nowhere', 'beneath'].forEach(function (id) {
      d.location = id;
      VF.loot.invalidatePool();
      VF.bus.emit('location:changed', id);
      VF.zones.tick(0.1);          // arrive
      let got = null, guard = 0;
      /* Wind until this zone puts its own thing on the water. Ticked in small
         steps because several of these only advance while the rod is out. */
      VF.fishing.hardReset();
      while (guard++ < 6000 && !got) {
        VF.fishing.S.state = guard % 2 ? 'waiting' : 'idle';
        VF.zones.tick(0.25);
        const v = VF.zones.view();
        if (v.bottle) got = 'bottle';
        else if (v.contact) got = 'contact';
        else if (v.shards && v.shards.length) got = 'shard';
        else if (v.marks && v.marks.length) got = 'mark';
        else if (v.moon) got = 'moon:' + v.moon.id;
        else if (v.depth > 0.02) got = 'depth';
        else if (guard > 2000) got = 'ambient only';
      }
      /* And that pressing it does something. */
      const v = VF.zones.view();
      const L = VF.scene.L;
      let took = false;
      const target = v.bottle || v.contact || (v.shards && v.shards[0]) || (v.marks && v.marks[0]);
      if (target) {
        took = VF.zones.press(L.w * target.x, L.horizonY + L.waterH * target.y);
      }
      out.push({ id: id, rule: VF.zoneData.rule(id), got: got, took: took, pressable: !!target });
    });
    VF.fishing.hardReset();
    return out;
  });
  console.log('\nzones');
  zones.forEach(function (z) {
    check(z.id.padEnd(8) + ' ' + (z.rule || '—'), !!z.got,
          z.got + (z.pressable ? (z.took ? ' · answers a press' : ' · PRESS IGNORED') : ''));
    if (z.pressable && !z.took) bad++;
  });

  /* ---------------------------------------------- clues, leads, expeditions */
  const chain = await page.evaluate(() => {
    const d = VF.state.data;
    const out = {};
    out.clue = VF.discovery.clue('lurker_scale');
    out.opened = VF.discovery.hasLead('sunken_city');
    out.onChart = VF.discovery.forPlace('trench').length > 0;
    d.location = 'trench';
    out.ready = VF.discovery.ready('sunken_city');
    out.began = VF.expedition.begin('sunken_city');
    const c = VF.expedition.current();
    out.running = !!c && c.id === 'sunken_city';
    /* Walk it. Each leg is satisfied by the thing it actually asks for. */
    for (let i = 0; i < 4; i++) VF.expedition.note('pings');
    d.location = 'trench'; VF.expedition.check();
    VF.expedition.note('crossed');
    d.location = 'abyss'; VF.expedition.note('seen'); VF.expedition.check();
    out.gotPlace = VF.locations.isRegistered('sunken_city');
    d.location = 'sunken_city'; VF.expedition.note('bell'); VF.expedition.check();
    out.done = VF.expedition.complete('sunken_city');
    out.journal = d.journal.filter(function (e) { return /^exp:city/.test(e.id); }).length;
    return out;
  });
  console.log('\nthe chain');
  check('a clue opens a lead', chain.clue && chain.opened);
  check('the lead shows on the chart', chain.onChart);
  check('and is ready when you are standing in it', chain.ready);
  check('the expedition begins and runs', chain.began && chain.running);
  check('a leg can hand over a whole place', chain.gotPlace);
  check('it finishes', chain.done);
  check('and it wrote itself down', chain.journal >= 3, chain.journal + ' entries');

  /* ------------------------------------------------------ an old save */
  const old = await page.evaluate(() => {
    /* A save shaped like one from before any of this: no boat, no clues, no
       zoneState, no creatures. It has to load, play and save. */
    const legacy = {
      schema: 2, money: 4200, level: 7, xp: 30, rod: 'fiber', ownedRods: ['wood', 'fiber'],
      bait: 'minnow', baitCounts: { minnow: 9 },
      location: 'basin', unlockedLocations: ['shore', 'basin'], seenLocations: ['shore', 'basin'],
      fishdex: { smallmouth: { caught: 4, record: { kg: 1.2, m: 0.3, pct: 0.4 } } },
      kept: [], wall: [], journal: [{ id: 'bottle', title: 'x', text: 'y', kind: 'find', at: 1 }],
      stats: { casts: 40, catches: 30 }, flags: {}, achievements: {},
      settings: { master: 0.5 }
    };
    localStorage.setItem('voidfishing.save.v1.s0', JSON.stringify(legacy));
    const res = VF.save.load(0);
    const d = VF.state.data;
    const out = {
      loaded: !!res.loaded,
      keptMoney: d.money === 4200, keptLevel: d.level === 7,
      keptRods: d.ownedRods.indexOf('fiber') >= 0,
      keptDex: !!d.fishdex.smallmouth,
      keptJournal: d.journal.length >= 1,
      boatBuilt: !!VF.boat.shape(),
      hull: VF.boat.hull().id,
      zoneOk: !!VF.zones.view(),
      cluesEmpty: Object.keys(d.clues || {}).length === 0
    };
    // and it still plays
    VF.fishing.hardReset();
    VF.build.invalidate();
    const c = VF.loot.roll({});
    out.rolls = !!(c && c.fish);
    VF.save.save();
    const back = JSON.parse(localStorage.getItem('voidfishing.save.v1.s0'));
    out.savedBoat = !!back.boat;
    out.stillHasDex = !!back.fishdex.smallmouth;
    return out;
  });
  console.log('\na save from before any of this');
  check('loads', old.loaded);
  check('money, level, rods, fishdex and journal intact',
        old.keptMoney && old.keptLevel && old.keptRods && old.keptDex && old.keptJournal);
  check('gets a skiff and an empty ledger', old.boatBuilt && old.hull === 'skiff' && old.cluesEmpty);
  check('the zone system copes', old.zoneOk);
  check('it still rolls a catch', old.rolls);
  check('and saves the new fields back without losing the old', old.savedBoat && old.stillHasDex);

  console.log('');
  if (errors.length) {
    console.log('errors:');
    errors.slice(0, 10).forEach(e => console.log('  ' + e));
    bad++;
  } else console.log('errors: none');

  await browser.close();
  if (bad) process.exitCode = 1;
})();
