/* Which boat can work which water.

   The claim §6 makes is that the boat is a tradeoff and not a ladder, and
   that claim is exactly three assertions:

     no place is unreachable by every hull        (the world stays playable)
     no hull can reach everything                 (there is no "best boat")
     the smallest and the largest each reach       (the tradeoff runs both
     water the other cannot                        ways, not just downward)

   A monotonic ladder — which is what this was — fails the second and third
   without fail. It is the whole test.

   It also checks the thing that would quietly break the game: that the hull
   you would plausibly own at the level a place unlocks can actually get into
   it. Gating water behind a boat the player cannot afford yet is not a
   tradeoff, it is a wall.

     node tools/reach.js
*/
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const out = { fail: [], steps: [], grid: [], hulls: [], places: [] };
    function step(s, ok, note) { out.steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) out.fail.push(s); }

    const d = VF.state.data;
    d.level = 99; d.money = 1e13;
    /* Every hidden water on the board too — half the interesting bands are
       secrets, and a reach test that only sees the shelf sees half the map. */
    VF.secrets.list.forEach(sc => { if (sc.loc) VF.locations.register(sc.loc); });

    const hulls = VF.boatData.hulls;
    const places = VF.locations.list;
    out.hulls = hulls.map(h => h.id);
    out.places = places.map(p => p.id);

    const b = VF.boat.shape();
    function wear(hid, fitted) {
      if (b.owned.indexOf(hid) < 0) b.owned.push(hid);
      b.hull = hid;
      const h = VF.boatData.hull(hid);
      for (const k in b.modules) { b.modules[k] = 0; b.bought[k] = 5; }
      if (fitted) VF.boat.refit();
      return h;
    }

    /* --- the grid: every hull, bare, against every water --- */
    const reach = {};
    hulls.forEach(h => {
      wear(h.id, false);
      const row = { hull: h.id, draught: +VF.boat.draught().toFixed(2),
                    pressure: h.pressure, berth: h.berth, can: [] };
      places.forEach(p => { if (VF.boat.canWork(p.id)) row.can.push(p.id); });
      reach[h.id] = row.can;
      out.grid.push(row);
    });

    /* 1. the world stays playable */
    const orphan = places.filter(p => !hulls.some(h => reach[h.id].indexOf(p.id) >= 0));
    step('every water is reachable by something you can own', orphan.length === 0,
         orphan.map(p => p.id).join(', '));

    /* 2. there is no best boat */
    const everything = hulls.filter(h => reach[h.id].length === places.length);
    step('no hull can work every water', everything.length === 0,
         everything.map(h => h.id).join(', '));

    /* 3. and the tradeoff runs both ways */
    const small = hulls[0].id, big = hulls[hulls.length - 1].id;
    const onlySmall = reach[small].filter(x => reach[big].indexOf(x) < 0);
    const onlyBig = reach[big].filter(x => reach[small].indexOf(x) < 0);
    step('the skiff reaches water THE UNDERSIDE cannot', onlySmall.length > 0, onlySmall.join(', '));
    step('and THE UNDERSIDE reaches water the skiff cannot', onlyBig.length > 0, onlyBig.join(', '));

    /* Every hull in between has to be a real choice too — one that adds
       nothing and takes nothing away is the ladder coming back. */
    const dull = [];
    for (let i = 1; i < hulls.length; i++) {
      const prev = reach[hulls[i - 1].id], cur = reach[hulls[i].id];
      const gained = cur.filter(x => prev.indexOf(x) < 0);
      const lost = prev.filter(x => cur.indexOf(x) < 0);
      if (!gained.length) dull.push(hulls[i].id + ' opens nothing');
    }
    step('every hull opens water the one before it could not', dull.length === 0, dull.join('; '));

    /* --- fitting costs draught, and that has to actually cost something --- */
    const shrunk = [];
    hulls.forEach(h => {
      wear(h.id, false);
      const bare = VF.boat.canWork.bind(VF.boat);
      const bareCan = places.filter(p => VF.boat.canWork(p.id)).map(p => p.id);
      const bareDraught = VF.boat.draught();
      wear(h.id, true);
      const fitCan = places.filter(p => VF.boat.canWork(p.id)).map(p => p.id);
      if (VF.boat.draught() <= bareDraught + 1e-9) {
        out.fail.push(h.id + ': fitting her out changed her draught by nothing');
      }
      const lost = bareCan.filter(x => fitCan.indexOf(x) < 0);
      if (lost.length) shrunk.push(h.id + ' loses ' + lost.join('/'));
    });
    step('a fitted hull draws more than a bare one', out.fail.length === 0);
    step('and for at least one hull that costs it water', shrunk.length > 0, shrunk.join('; '));

    /* --- the budget bites at the top --- */
    wear('voidship', true);
    const maxLevels = VF.boatData.modules.reduce((n, m) => n + VF.boat.slotCap(m.id), 0);
    const fitLevels = VF.boatData.modules.reduce((n, m) => n + VF.boat.level(m.id), 0);
    step('the biggest hull cannot carry everything it has slots for',
         fitLevels < maxLevels, fitLevels + ' of ' + maxLevels + ' levels, ' +
         VF.boat.spent() + '/' + VF.boat.berth() + ' berth');

    /* --- and nothing is walled off behind a boat you cannot afford yet --- */
    const walls = [];
    VF.locations.shelf().forEach(p => {
      const lvl = p.level | 0;
      /* the best hull the player could own by the level this water unlocks */
      const best = hulls.filter(h => (h.level || 0) <= lvl).pop();
      if (!best) return;
      const ok = hulls.some(h => (h.level || 0) <= lvl && reach[h.id].indexOf(p.id) >= 0);
      if (!ok) walls.push(p.id + ' (level ' + lvl + ', best hull ' + best.id + ')');
    });
    step('every water is workable by a hull you could own when it unlocks',
         walls.length === 0, walls.join('; '));

    return out;
  });

  const w = Math.max(...r.places.map(p => p.length));
  console.log('  ' + ''.padEnd(10) + r.places.map(p => p.slice(0, 3)).join(' '));
  r.grid.forEach(row => {
    console.log('  ' + row.hull.padEnd(10) +
      r.places.map(p => (row.can.indexOf(p) >= 0 ? ' ● ' : ' · ')).join('') +
      '   draws ' + row.draught.toFixed(2) + ', rated ' + row.pressure + ', ' + row.berth + ' berth');
  });
  console.log('');
  r.steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); [...new Set(errors)].slice(0, 5).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); [...new Set(r.fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nno best boat, and nothing out of reach');
  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
