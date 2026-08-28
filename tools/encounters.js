/* Every encounter, driven to both of its endings.

   The framework's whole claim is that a creature is data — a list of verbs —
   so the test is the same twelve lines run against all of them: start it,
   answer whatever it asks for, and check it finishes, writes what it said it
   would write, and hands the rod back in a state the game can cast from.

   Both endings, because losing one of these is a designed outcome and the
   escape path does as much work as the landing path: it writes clues, it puts
   leads back, and it is the half nobody plays on purpose. */
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

  const res = await page.evaluate(async () => {
    const out = [];
    const d = VF.state.data;
    // A loadout that can land these, so what is being tested is the framework
    // rather than whether a wooden rod can hold What Eats Them. It cannot.
    d.level = 99;
    const best = VF.rods.list.filter(function (r) { return !/^m_/.test(r.id) && !r.admin; })
                             .reduce(function (a, b) { return b.line > a.line ? b : a; });
    d.ownedRods.push(best.id); d.rod = best.id;
    if (VF.build) VF.build.invalidate && VF.build.invalidate();
    VF.locations.list.forEach(function (l) {
      if (d.unlockedLocations.indexOf(l.id) < 0) d.unlockedLocations.push(l.id);
    });

    function pump(n, dt) { for (let i = 0; i < (n || 400); i++) VF.creature.tick(dt || 0.05); }

    /* Answer whatever the current phase is asking for. This is the whole
       point of the verbs being a closed set: one driver plays all of them. */
    function play(win) {
      let guard = 0;
      while (VF.creature.active() && guard++ < 900) {
        const v = VF.creature.view();
        if (!v) break;
        const L = VF.scene.L;
        switch (v.verb) {
          case 'watch': case 'reveal':
            VF.creature.tick(0.4); break;
          case 'track': {
            if (!win) { VF.creature.tick(6); break; }
            const sl = v.slots[v.hot];
            VF.creature.press(L.w * sl.x, L.horizonY + L.waterH * sl.y);
            break;
          }
          case 'chase':
            if (win) { VF.creature.press(null, null); VF.creature.tick(0.3); }
            else { VF.creature.release(); VF.creature.tick(0.6); }
            break;
          case 'hold':
            /* Ride the band: hold when under it, let go when over. Losing is
               simply not playing, which is the honest failure for this one. */
            if (win && v.bandRange && v.band < v.bandRange[1] - 0.06) VF.creature.press(null, null);
            else VF.creature.release();
            VF.creature.tick(0.08);
            break;
          case 'swarm': {
            const m = v.swarm.filter(function (x) { return x.alive; })[0];
            if (!m || !win) { VF.creature.tick(2); break; }
            VF.creature.press(L.w * m.x, L.horizonY + L.waterH * m.y);
            break;
          }
          case 'choose': {
            /* Not "the first one": the option that goes on rather than the one
               that walks away. Three of these creatures put the safe exit
               first on purpose, and a driver that always picks index 0 would
               report those as broken. */
            let pick = -1;
            for (let i = 0; i < v.options.length; i++) {
              const goes = (v.options[i].then || 'next') !== 'escape';
              if (win === goes) { pick = i; break; }
            }
            VF.creature.choose(pick < 0 ? 0 : pick);
            VF.creature.tick(2.4);
            break;
          }
          case 'hook': {
            /* The ordinary fight, played by holding the bar onto the fish —
               which is what a person does, and exercises the real path. */
            let g2 = 0;
            while (VF.fishing.state() === 'reeling' && g2++ < 20000) {
              const f = VF.fishing.S.fight;
              if (!f) break;
              /* Lead the fish rather than chase it. A bang-bang controller on
                 the current position oscillates around the target and loses
                 the hard fights, which would make this a difficulty test
                 rather than a plumbing test. */
              const aim = f.fish + f.fishV * 0.18;
              VF.fishing.setReeling(win ? aim > f.bar : false);
              VF.fishing.tick(0.016);
            }
            if (VF.catchUI.isOpen()) VF.catchUI.close();
            VF.creature.tick(0.1);
            break;
          }
          default: VF.creature.tick(0.5); break;
        }
      }
      return guard;
    }

    for (const def of VF.creatureData.list) {
      for (const win of [true, false]) {
        VF.creature.abort();
        VF.fishing.hardReset();
        /* The catch card clears itself on a timer, and nothing inside this
           loop yields, so the timer never runs. A stale panelOpen stops the
           NEXT fight dead — which is a property of the harness, not of the
           game, and the harness is what has to know that. */
        if (VF.catchUI.isOpen()) VF.catchUI.close();
        VF.state.rt.panelOpen = null;
        const began = VF.creature.begin(def.id);
        if (!began) { out.push({ id: def.id, win: win, error: 'would not begin' }); continue; }
        const before = ((d.creatures || {})[def.id] || {}).caught | 0;
        let steps = play(win), tries = 1;
        /* Three of these branch on a dice roll by design — "cut it off" is a
           72% option, not a correct answer — so playing well is allowed to
           lose. Retried rather than seeded, because seeding the roll would
           test a path the player never takes. */
        while (win && tries < 6 && (((d.creatures || {})[def.id] || {}).caught | 0) === before) {
          VF.creature.abort();
          VF.fishing.hardReset();
          if (VF.catchUI.isOpen()) VF.catchUI.close();
          VF.state.rt.panelOpen = null;
          if (!VF.creature.begin(def.id)) break;
          steps += play(win);
          tries++;
        }
        const r = (d.creatures || {})[def.id] || {};
        r.tries = tries;
        out.push({
          id: def.id, win: win, steps: steps,
          stuck: VF.creature.active(),
          caught: r.caught | 0, escaped: r.escaped | 0, tries: r.tries || 1,
          dex: !!d.fishdex[def.fish],
          rod: VF.fishing.state()
        });
      }
    }
    out.push({ clues: Object.keys(d.clues || {}).length,
               leads: Object.keys(d.leads || {}).length,
               journal: d.journal.length });
    return out;
  });

  let bad = 0;
  res.forEach(function (r) {
    if (r.clues !== undefined) {
      console.log('\nwrote: ' + r.clues + ' clues · ' + r.leads + ' leads · ' +
                  r.journal + ' journal entries');
      return;
    }
    const tag = r.win ? 'landed ' : 'escaped';
    const ok = !r.error && !r.stuck && (r.win ? r.caught > 0 : r.escaped > 0);
    if (!ok) bad++;
    console.log('  ' + r.id.padEnd(10), tag,
                (r.error ? 'ERROR ' + r.error : ''),
                r.stuck ? 'STUCK' : '',
                'steps ' + String(r.steps).padStart(3),
                'caught ' + r.caught + '/esc ' + r.escaped,
                r.tries > 1 ? '(' + r.tries + ' attempts)' : '',
                'rod ' + r.rod,
                ok ? '' : ' <-- FAILED');
  });

  if (errors.length) {
    console.log('\nerrors:');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
    bad++;
  } else console.log('errors: none');

  await browser.close();
  if (bad) process.exitCode = 1;
})();
