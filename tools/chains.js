/* Doing something, being told nothing, and finding out later.

   Checks the shape of the delayed-consequence system, not its content:

     - a chain arms on a condition and does NOT fire in the same breath
     - it fires at the right remove, counted in things the player did
     - it fires exactly once
     - TIME PASSING FIRES NOTHING. This is the check that matters most: a
       consequence on a wall clock is a timer wearing a costume, and it would
       go off while the game sat on a title screen.
     - `then` announces nothing — no toast, no panel, no quest

     node tools/chains.js
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
    const out = { fail: [], steps: [] };
    function step(s, ok, note) { out.steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) out.fail.push(s); }

    const d = VF.state.data;
    d.level = 30;
    VF.chains.reset(); VF.history.reset(); VF.rumours.reset();

    /* Everything a chain is forbidden from doing, watched at the source. */
    const noise = { toast: 0, whisper: 0 };
    VF.bus.on('ui:toast', () => noise.toast++);
    VF.bus.on('ui:whisper', () => noise.whisper++);

    /* Every chain has to be well formed, or it silently never fires. */
    VF.chainData.list.forEach(def => {
      if (typeof def.when !== 'function') out.fail.push(def.id + ': no when()');
      if (typeof def.then !== 'function') out.fail.push(def.id + ': no then()');
      for (const k in (def.after || {})) {
        if (['voyages', 'casts', 'trips', 'visits'].indexOf(k) < 0) {
          out.fail.push(def.id + ': waits on a counter that does not exist — ' + k);
        }
      }
    });
    step('every chain is well formed', out.fail.length === 0);

    /* --- 1. arming is not firing --- */
    VF.bus.emit('voyage:passed', { kind: 'SIGNAL', id: 'test' });
    step('ignoring a signal armed the chain', VF.chains.armed('signal_ignored'));
    step('and did NOT fire it', !VF.chains.fired('signal_ignored'));
    step('nothing appeared in the water yet', !VF.chains.fact('wreck_at_signal'));

    /* --- 2. time passing does nothing --- */
    const before = JSON.stringify(d.world.chains.fired);
    for (let i = 0; i < 400; i++) { VF.state.rt.t += 1; VF.chains.check(); }
    step('six minutes of game time fires nothing',
         JSON.stringify(d.world.chains.fired) === before);

    /* --- 3. the right remove, in the player's own units --- */
    d.voyages += 1; VF.bus.emit('voyage:end', {});
    step('one crossing is not enough', !VF.chains.fired('signal_ignored'),
         JSON.stringify(VF.chains.pending('signal_ignored')));
    d.voyages += 1; VF.bus.emit('voyage:end', {});
    step('two is not enough either', !VF.chains.fired('signal_ignored'));
    d.voyages += 1; VF.bus.emit('voyage:end', {});
    step('three crossings later, it fired', VF.chains.fired('signal_ignored'));

    /* --- 4. and what it did was change the world, quietly --- */
    step('there is a hull out there now', !!VF.chains.fact('wreck_at_signal'));
    step('and somebody will tell you about it',
         !!VF.rumours.offer('fisherman'), (VF.rumours.offer('fisherman') || {}).id);
    step('it opened no quest', VF.quests.activeCount() === 0);
    step('it raised no toast', noise.toast === 0, noise.toast + ' raised');
    step('it opened no panel', !VF.state.rt.panelOpen);

    /* --- 5. the landmark is actually in the trench, and reachable --- */
    const was = d.location;
    d.location = 'trench';
    VF.landmarks.invalidate();
    const w = VF.landmarks.world();
    const wreck = w && w.all.filter(l => l.id === 'consequence:wreck_at_signal')[0];
    step('the wreck is in the water', !!wreck,
         wreck ? 'u=' + wreck.u.toFixed(2) + ' d=' + wreck.d.toFixed(2) : 'missing');
    step('and it can be seen from the chair', !!wreck && wreck.fromEye);
    /* seeing it settles what you were told, without being told again */
    if (wreck) VF.landmarks.markSeen(wreck);
    step('seeing it settles the topic',
         VF.rumours.onTopic('thewreck').every(x => !VF.rumours.heard(x.id) || x.settled) ||
         VF.rumours.count().settled > 0);
    d.location = was; VF.landmarks.invalidate();

    /* --- 6. once, and only once --- */
    const factWas = VF.chains.fact('wreck_at_signal');
    for (let i = 0; i < 12; i++) { d.voyages++; VF.bus.emit('voyage:end', {}); }
    step('firing again changes nothing', VF.chains.fact('wreck_at_signal') === factWas);
    step('and it is still recorded as fired once',
         Object.keys(d.world.chains.fired).filter(k => k === 'signal_ignored').length === 1);

    /* --- 7. the hull chain, and the gesture nobody announces ---
       Damage is only a fact about a boat, so there has to be one under you. */
    d.stats.casts = Math.max(1, d.stats.casts | 0);
    const b = VF.boat.shape();
    if (b.owned.indexOf('dory') < 0) b.owned.push('dory');
    VF.boat.setHull('dory');
    step('there is a hull under the angler', VF.boat.afloat());
    VF.boat.shape().wear = 0.6;
    VF.bus.emit('location:changed', 'shore');
    VF.bus.emit('location:changed', 'shore');
    step('two bad returns armed the mechanic', VF.chains.armed('hull_neglect'),
         'came_back_damaged=' + VF.history.count('came_back_damaged'));
    VF.bus.emit('location:changed', 'shore');
    step('and it fired a trip later', VF.chains.fired('hull_neglect'));
    step('the repair is free and nothing said so', VF.boat.repairCost() === 0);
    const money = d.money;
    VF.boat.repair();
    step('taking it cost nothing', d.money === money);
    step('and it is not free the second time', !VF.chains.fact('repair_owed'));

    step('no chain ever raised anything', noise.toast === 0 && noise.whisper === 0,
         'toasts=' + noise.toast + ' whispers=' + noise.whisper);
    return out;
  });

  r.steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 4).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); [...new Set(r.fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nyou did something, nothing was said, and it came back later');
  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
