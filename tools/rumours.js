/* Being told two different things, and finding out which was right.

   Checks the shape of the system rather than the content: that a rumour is
   offered by somebody who has nothing else to say, that hearing one does not
   open a quest, that two accounts of the same thing can disagree and the game
   leaves them disagreeing, and that going and looking is what settles it.

     node tools/rumours.js
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
    const d = VF.state.data;
    d.level = 30; d.stats.casts = 200;
    VF.rumours.reset();

    function step(s, ok, note) { out.steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) out.fail.push(s); }

    /* Every rumour has to be sayable by somebody who exists, and every
       follow-up has to be reachable — a thread whose second half needs a
       rumour nobody can tell you is a thread that never happens. */
    const npcIds = VF.npcs.list.map(n => n.id);
    VF.rumourData.list.forEach(def => {
      (def.from || []).forEach(f => {
        if (npcIds.indexOf(f) < 0) out.fail.push(def.id + ': nobody called ' + f);
      });
      if (def.opens && VF.discoveryData && VF.discoveryData.lead &&
          !VF.discoveryData.lead(def.opens)) {
        out.fail.push(def.id + ': opens a lead that does not exist — ' + def.opens);
      }
    });
    step('every rumour has somebody to say it', out.fail.length === 0);

    // the opening thread: one account, then a different one
    const a = VF.rumours.offer('fisherman');
    step('somebody with nothing new offers a rumour', !!a, a ? a.id : 'none');
    if (a) VF.rumours.hear(a.id, 'fisherman');

    const b = VF.rumours.offer('keeper');
    step('a second account is now available', !!b, b ? b.id : 'none');
    if (b) VF.rumours.hear(b.id, 'keeper');

    const con = VF.rumours.contested();
    step('and the two accounts disagree', con.length > 0,
         con.map(c => c.topic + ' (' + c.rumours.map(r => r.claim).join(' vs ') + ')').join(', '));

    step('hearing one started no quest', VF.quests.activeCount() === 0);

    // nothing settles until the player does something
    step('nothing is settled yet', VF.rumours.count().settled === 0);
    VF.discovery.clue('bottle_shore', true);
    VF.rumours.settle();
    const c2 = VF.rumours.count();
    step('going and looking settles it', c2.settled > 0, c2.settled + ' settled');
    step('and it wrote itself down',
         d.journal.some(e => e.id.indexOf('rumour:') === 0));

    // and the same person does not say it twice
    const again = VF.rumours.offer('fisherman');
    step('a rumour already heard is not offered again', !again || again.id !== (a && a.id));

    // the world starts talking about the player. The real discovery path, not
    // a hand-rolled bus event: the wiring is half of what is being checked.
    VF.secrets.discover('lantern_isle');
    const you = VF.rumours.offer('keeper') || VF.rumours.offer('mechanic') || VF.rumours.offer('child');
    step('what the player did comes back at them',
         !!you && you.topic === 'you', you ? you.id : 'none');
    return out;
  });

  r.steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 4).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); [...new Set(r.fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nyou have been told two things and found out which was right');
  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
