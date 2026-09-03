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
const fs = require('fs');

/* Three separate places roll for an encounter — a bite, a fight already in
   progress, and once per crossing — and a fourth would be easy to add. The
   ledger only means anything if every one of them consults it, and the failure
   mode of forgetting is silent: the creature simply keeps turning up as though
   nothing had happened. So this is checked over the source rather than played
   for, because playing for it needs a roll to come up. */
function rollsGated() {
  const root = path.join(__dirname, '..', 'js');
  const miss = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) return walk(f);
      if (!e.name.endsWith('.js')) return;
      const src = fs.readFileSync(f, 'utf8');
      if (src.indexOf('creatureData.eligible(') < 0) return;
      if (src.indexOf('pursuit.weight(') < 0) {
        miss.push(path.relative(path.join(__dirname, '..'), f).split(path.sep).join('/'));
      }
    });
  })(root);
  return { ok: miss.length === 0, note: miss.join(', ') };
}

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
        /* Two of these are ENCOUNTERED rather than caught — they end on a
           'leave' phase, record d.creatures[id].seen instead of .caught, and
           never enter the fishdex. The harness has to know which counter it
           is watching or it reads a working encounter as a dead one. */
        const only = !!def.encounterOnly;
        const cnt = function () {
          const r = (d.creatures || {})[def.id] || {};
          return (only ? r.seen : r.caught) | 0;
        };
        const before = cnt();
        let steps = play(win), tries = 1;
        /* Three of these branch on a dice roll by design — "cut it off" is a
           72% option, not a correct answer — so playing well is allowed to
           lose. Retried rather than seeded, because seeding the roll would
           test a path the player never takes. */
        while (win && tries < 6 && cnt() === before) {
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
          caught: r.caught | 0, seen: r.seen | 0, only: only,
          escaped: r.escaped | 0, tries: r.tries || 1,
          dex: VF.record.held(def.fish),
          rod: VF.fishing.state()
        });
      }
    }
    out.push({ clues: Object.keys(d.clues || {}).length,
               leads: Object.keys(d.leads || {}).length,
               journal: d.journal.length });
    return out;
  });

  /* ------------------------------------------------- the second meeting

     Everything above proves an encounter runs. This proves it is REMEMBERED:
     something that got away is owed, it is not in the water until enough has
     happened, the delay is counted in casts rather than seconds, and when it
     comes back it opens differently. js/systems/pursuit.js. */
  const chain = await page.evaluate(async () => {
    const o = {};
    const d = VF.state.data;
    const P = VF.pursuit;
    if (!P) return { missing: true };

    const thief = VF.creatureData.get('thief');
    const mimic = VF.creatureData.get('mimic');

    /* A clean ledger and a clean book, so what is measured is this encounter
       and not the twenty the loop above just drove. */
    d.creatures = {};
    d.fishdex = {};
    VF.creature.abort();
    VF.fishing.hardReset();
    if (VF.catchUI.isOpen()) VF.catchUI.close();
    VF.state.rt.panelOpen = null;

    o.cleanWeight = P.weight(thief);

    /* Lose one for real: begin it and never touch the rod. The chase phase
       times out and the encounter ends the way most of them actually end. */
    VF.creature.begin('thief');
    o.firstText = VF.creature.view() ? VF.creature.view().text : null;
    for (let i = 0; i < 60 && VF.creature.active(); i++) VF.creature.tick(0.5);
    o.ended = !VF.creature.active();
    o.escaped = (d.creatures.thief || {}).escaped | 0;
    o.owed = P.owed(thief);
    o.left = P.left(thief);

    /* The record is what remembers it: the species is a sighting now, and it
       is not a species you have caught. */
    o.recState = VF.record.state(thief.fish);
    o.recHeld = VF.record.held(thief.fish);
    o.recHow = (VF.record.entry(thief.fish) || {}).how;

    /* While it is owed it is not in the water at all. */
    o.owedWeight = P.weight(thief);

    /* And no amount of time brings it back — only casts do. Half a minute of
       encounter ticks is the difference between a chain and a timer. */
    for (let i = 0; i < 600; i++) VF.creature.tick(0.05);
    o.stillOwed = P.owed(thief) && !P.due(thief) && P.weight(thief) === 0;

    /* Now the thing that does bring it back. */
    d.stats.casts = (d.stats.casts | 0) + 10;
    o.due = P.due(thief);
    o.dueWeight = P.weight(thief);

    /* The second meeting is not the first one. */
    const ph = P.phasesFor(thief);
    o.rewrote = ph[0].text !== thief.phases[0].text;
    o.dataIntact = thief.phases[0].text === 'the line goes slack. all of it, at once.';
    let saidAgain = null;
    VF.bus.on('creature:again', function (e) { saidAgain = e.id + '×' + e.times; });
    VF.creature.abort();
    VF.creature.begin('thief');
    o.secondText = VF.creature.view() ? VF.creature.view().text : null;
    o.differs = o.secondText !== o.firstText;
    o.announced = saidAgain;
    o.settled = !P.owed(thief);
    o.times = P.times('thief');
    VF.creature.abort();

    /* A creature with no `again` written for it still comes back changed. */
    P.note(mimic, false, 'chase');
    const mp = P.phasesFor(mimic);
    o.genericRewrote = mp[0].text !== mimic.phases[0].text;
    o.genericIntact = mimic.phases[0].text === 'it comes up easily. too easily.';

    /* And one you have finished with recedes rather than vanishing. */
    d.creatures.queen = { met: 3, caught: 2, seen: 0, escaped: 0 };
    o.faded = P.weight(VF.creatureData.get('queen'));
    return o;
  });

  const gated = rollsGated();

  let bad = 0;
  if (chain.missing) { console.log('\nFAIL: js/systems/pursuit.js is not loaded'); bad++; }
  else {
    const ck = function (name, ok, note) {
      if (!ok) bad++;
      console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + name + (note ? '  — ' + note : ''));
    };
    console.log('\nthe second meeting:');
    ck('a creature nobody has met rolls at its own odds', chain.cleanWeight === 1);
    ck('one left alone gets away', chain.ended && chain.escaped === 1);
    ck('and what got away is a sighting in the book',
       chain.recState !== 'unknown' && !chain.recHeld, chain.recState);
    ck('recorded as met rather than as a nibble', chain.recHow === 'met', chain.recHow);
    ck('it is owed, and the debt is counted in casts',
       chain.owed && chain.left && chain.left.casts === 10, JSON.stringify(chain.left));
    ck('while it is owed it is not in the water', chain.owedWeight === 0);
    ck('and time alone does not bring it back', chain.stillOwed);
    ck('casts do', chain.due && chain.dueWeight > 1, 'x' + chain.dueWeight);
    ck('the second meeting opens differently', chain.rewrote && chain.differs,
       chain.secondText);
    ck('without rewriting the data it came from', chain.dataIntact && chain.genericIntact);
    ck('and it says so', chain.announced === 'thief×1', chain.announced);
    ck('meeting it settles the debt', chain.settled && chain.times === 1);
    ck('a creature nobody wrote a rematch for still comes back changed',
       chain.genericRewrote);
    ck('and one you are finished with recedes rather than vanishing',
       chain.faded > 0 && chain.faded < 1, 'x' + (chain.faded || 0).toFixed(2));
    ck('every place that can start one consults the ledger', gated.ok,
       gated.ok ? '' : 'not in ' + gated.note);
  }

  res.forEach(function (r) {
    if (r.clues !== undefined) {
      console.log('\nwrote: ' + r.clues + ' clues · ' + r.leads + ' leads · ' +
                  r.journal + ' journal entries');
      return;
    }
    const tag = r.win ? 'landed ' : 'escaped';
    /* An encounter you cannot catch is also one you cannot lose: every path
       through the Watcher and the Other Boat resolves, on purpose, so the
       losing run is scored on it having ended cleanly rather than on an
       escape that no longer exists. */
    const ok = !r.error && !r.stuck &&
               (r.only ? r.seen > 0 : (r.win ? r.caught > 0 : r.escaped > 0));
    if (!ok) bad++;
    console.log('  ' + r.id.padEnd(10), tag,
                (r.error ? 'ERROR ' + r.error : ''),
                r.stuck ? 'STUCK' : '',
                'steps ' + String(r.steps).padStart(3),
                (r.only ? 'seen ' + r.seen + '/esc ' + r.escaped
                        : 'caught ' + r.caught + '/esc ' + r.escaped),
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
