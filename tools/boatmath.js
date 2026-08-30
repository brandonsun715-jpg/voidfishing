/* The hull, and whether upgrading it helps.

   Written because it did not. `damage()` multiplied the SOAK by the engine's
   `wear` figure, and the engine's `wear` figure goes DOWN as the engine gets
   better — so a rank-5 engine halved the soak and doubled every knock the
   hull took. Buying the best engine in the game made the boat exactly twice
   as fragile, and nothing in the interface said so, and no test looked.

   This is that test. It asserts the direction of every hull and module
   relationship, which is the class of bug that costs nothing to have and
   cannot be found by reading a screenshot.

     node tools/boatmath.js
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
    const out = { fail: [], steps: [], rows: [] };
    function step(s, ok, note) { out.steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) out.fail.push(s); }

    const d = VF.state.data;
    d.level = 99; d.money = 1e12; d.stats.casts = 10;

    function setup(hullId, engine) {
      const b = VF.boat.shape();
      if (b.owned.indexOf(hullId) < 0) b.owned.push(hullId);
      b.hull = hullId;
      b.modules.engine = engine;
      b.wear = 0;
      return b;
    }

    /* How much wear one standard knock puts on the hull. */
    function knock(hullId, engine) {
      const b = setup(hullId, engine);
      VF.boat.damage(0.2);
      return b.wear;
    }

    /* --- 1. a better engine is easier on the hull, not harder --- */
    const HULLS = VF.boatData.hulls.map(h => h.id);
    HULLS.forEach(hid => {
      const at0 = knock(hid, 0);
      const at5 = knock(hid, 5);
      /* A hull only has so many engine slots, so "rank 5" means "as good as
         this hull can take" and the expected saving is the slot cap. Asserting
         a flat ratio here would fail on the skiff for the wrong reason. */
      const cap = VF.boatData.hull(hid).slots.engine;
      const want = 1 - cap * 0.10;
      out.rows.push({ hull: hid, e0: at0, e5: at5, cap: cap, want: want });
      if (!(at5 < at0 - 1e-9)) {
        out.fail.push(hid + ': a better engine takes MORE damage (' +
                      at0.toFixed(4) + ' → ' + at5.toFixed(4) + ')');
      }
    });
    step('a better engine takes less hull damage, on every hull', out.fail.length === 0);
    step('and it saves exactly what the module claims',
         out.rows.every(r2 => Math.abs(r2.e5 / r2.e0 - r2.want) < 1e-6),
         out.rows.map(r2 => r2.hull + ' ' + (r2.e5 / r2.e0).toFixed(2) +
                            '× (' + r2.cap + ' slots)').join('  '));

    /* --- 2. a bigger hull soaks more --- */
    let mono = true, note = [];
    for (let i = 1; i < HULLS.length; i++) {
      const a = knock(HULLS[i - 1], 0), b = knock(HULLS[i], 0);
      note.push(HULLS[i - 1] + '→' + HULLS[i] + ' ' + a.toFixed(3) + '→' + b.toFixed(3));
      if (b > a + 1e-9) mono = false;
    }
    step('a bigger hull takes less from the same knock', mono, note.join('  '));

    /* --- 3. damage is bounded and always in the same direction --- */
    setup('skiff', 0);
    let last = -1, ok = true;
    for (let i = 0; i < 40; i++) {
      const w = VF.boat.damage(0.3);
      if (w < last - 1e-9) ok = false;
      last = w;
    }
    step('wear only ever goes up, and stops at total', ok && last === 1, 'ended at ' + last);

    /* --- 4. wear is a real cost while it lasts --- */
    setup('dory', 0);
    const clean = { s: {}, speed: VF.boat.speed() };
    VF.boat.stats(clean.s = { barSize: 1, bite: 1, line: 1, secret: 1 });
    VF.boat.shape().wear = 0.9;
    const worn = { s: { barSize: 1, bite: 1, line: 1, secret: 1 }, speed: VF.boat.speed() };
    VF.boat.stats(worn.s);
    step('a worn hull is a worse platform',
         worn.s.barSize < clean.s.barSize && worn.s.bite < clean.s.bite && worn.speed < clean.speed,
         'bar ' + worn.s.barSize.toFixed(3) + ' speed ' + worn.speed.toFixed(2));

    /* --- 5. and repairing it puts it back --- */
    d.money = 1e12;
    VF.boat.repair();
    step('repair returns it to whole', VF.boat.integrity() === 1);

    return out;
  });

  r.rows.forEach(x => console.log('  ' + x.hull.padEnd(10) +
    'bare: ' + x.e0.toFixed(4) + '   fitted: ' + x.e5.toFixed(4) +
    '   ' + (x.e5 / x.e0).toFixed(2) + '×   (' + x.cap + ' engine slots)'));
  console.log('');
  r.steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 4).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); [...new Set(r.fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nupgrading the boat improves the boat');
  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
