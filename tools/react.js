/* People noticing, rather than people reciting.

   The dialogue in this game is a ladder and a ladder can only say the next
   thing. This checks the other register: that what somebody says depends on
   how the world is, that it varies when the world varies, that nobody repeats
   themselves immediately, and — the one that matters — that a remark never
   advances anything, because the moment it does it is a stage with extra
   steps and the ladder eats it.

     node tools/react.js
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
    const out = { fail: [], steps: [], table: [] };
    function step(s, ok, note) { out.steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) out.fail.push(s); }

    const d = VF.state.data;

    /* --- every reaction has to be well formed, or it never fires and nobody
       ever finds out --- */
    let total = 0;
    VF.npcs.list.forEach(npc => {
      (npc.reacts || []).forEach(x => {
        total++;
        if (!x.id) out.fail.push(npc.id + ': a reaction with no id');
        if (typeof x.when !== 'function') out.fail.push(npc.id + '/' + x.id + ': no when()');
        const lines = typeof x.lines === 'function' ? x.lines(VF.react.context()) : x.lines;
        if (!lines || !lines.length) out.fail.push(npc.id + '/' + x.id + ': nothing to say');
      });
      const ids = (npc.reacts || []).map(x => x.id);
      if (new Set(ids).size !== ids.length) out.fail.push(npc.id + ': duplicate reaction ids');
    });
    step('every reaction is well formed', out.fail.length === 0, total + ' across the cast');
    step('most of the cast has something to notice',
         VF.npcs.list.filter(n => (n.reacts || []).length).length >= 7);

    /* --- the ten worlds. Each one is a different state of play, and the whole
       claim of the system is that the same people say different things in
       them. --- */
    function wipe() {
      VF.chains.reset(); VF.history.reset(); VF.rumours.reset();
      VF.npcs.list.forEach(n => { d.npcs[n.id] = { met: 0, stage: 0, heard: [] }; });
      d.stats.casts = 40;
      const b = VF.boat.shape();
      if (b.owned.indexOf('dory') < 0) b.owned.push('dory');
      VF.boat.setHull('dory'); b.wear = 0;
    }

    const WORLDS = [
      ['fresh off the shore', () => {}],
      ['hull half gone', () => { VF.boat.shape().wear = 0.6; }],
      ['brought it back twice', () => {
        VF.boat.shape().wear = 0.6;
        VF.bus.emit('location:changed'); VF.bus.emit('location:changed');
        VF.bus.emit('location:changed');
      }],
      ['spotless again', () => {
        VF.boat.shape().wear = 0.6; VF.bus.emit('location:changed');
        VF.boat.shape().wear = 0;
      }],
      ['told two different things', () => {
        d.level = 30;
        const a = VF.rumours.offer('fisherman'); if (a) VF.rumours.hear(a.id, 'fisherman');
        const b2 = VF.rumours.offer('keeper'); if (b2) VF.rumours.hear(b2.id, 'keeper');
      }],
      ['found out which was right', () => {
        d.level = 30;
        const a = VF.rumours.offer('fisherman'); if (a) VF.rumours.hear(a.id, 'fisherman');
        const b2 = VF.rumours.offer('keeper'); if (b2) VF.rumours.hear(b2.id, 'keeper');
        VF.discovery.clue('bottle_shore', true); VF.rumours.settle();
      }],
      ['a perfect landing', () => { VF.history.mark('first_perfect'); }],
      ['something purple came up', () => { VF.history.tally('void_catch'); }],
      ['the drifter was wrong', () => { VF.chains.setFact('deep_corrected', 1); }],
      ['a hull on the shelf', () => { VF.chains.setFact('wreck_at_signal', 1); }]
    ];

    const picks = {};                       // npc -> set of reaction ids seen
    WORLDS.forEach(([name, build]) => {
      wipe(); build();
      const row = { world: name, said: [] };
      VF.npcs.list.forEach(npc => {
        const o = VF.react.offer(npc.id);
        if (!o) return;
        row.said.push(npc.id + ':' + o.id);
        (picks[npc.id] = picks[npc.id] || new Set()).add(o.id);
      });
      out.table.push(row);
    });

    step('the same people say different things in different worlds',
         out.table.filter(r2 => r2.said.length).length >= 6,
         out.table.filter(r2 => r2.said.length).length + ' of 10 worlds drew a remark');

    const varied = Object.keys(picks).filter(k => picks[k].size >= 2);
    step('somebody varies what they notice', varied.length >= 2,
         varied.map(k => k + '×' + picks[k].size).join(', '));

    /* --- and it is scored, not ordered: the mechanic has three, and which one
       he uses depends on the hull rather than on which was written first --- */
    wipe(); VF.boat.shape().wear = 0.6;
    const bad = VF.react.offer('mechanic');
    wipe(); VF.chains.setFact('mechanic_worried', 1); VF.boat.shape().wear = 0.6;
    const worried = VF.react.offer('mechanic');
    step('the strongest condition wins, not the first',
         !!bad && !!worried && bad.id !== worried.id,
         (bad && bad.id) + ' vs ' + (worried && worried.id));

    /* --- nobody says the same thing twice running --- */
    wipe(); VF.boat.shape().wear = 0.6;
    const first = VF.react.offer('mechanic');
    VF.react.said('mechanic', first.id);
    VF.npcs.rec('mechanic').met++;
    const second = VF.react.offer('mechanic');
    step('a remark does not repeat immediately',
         !second || second.id !== first.id, second ? second.id : 'nothing');

    /* --- and the ladder still wins. A person mid-thread tells the thread. --- */
    wipe();
    d.voyages = 6; VF.boat.shape().wear = 0.6;
    const t1 = VF.npcs.talk('mechanic', { defer: true });
    step('a stage he has not given yet beats a remark',
         !!t1 && !t1.spent, t1 ? (t1.spent ? 'remark' : 'stage ' + t1.stage) : 'nothing');

    /* --- a remark advances nothing --- */
    wipe(); VF.boat.shape().wear = 0.6;
    /* Burn his ladder so the remark is what is left — committing the stages
       and nothing else, so the remark itself is still unspent when we get to
       it. Committing it here would consume it and leave us measuring filler. */
    for (let i = 0; i < 12; i++) {
      const t = VF.npcs.talk('mechanic', { defer: true });
      if (!t || t.spent) break;
      t.commit();
    }
    const before = { stage: VF.npcs.peek('mechanic').stage, quests: VF.quests.activeCount(),
                     journal: d.journal.length };
    const t2 = VF.npcs.talk('mechanic', { defer: true });
    const isRemark = !!t2 && t2.spent &&
      (VF.npcs.get('mechanic').reacts || []).some(x => {
        const l = typeof x.lines === 'function' ? x.lines(VF.react.context()) : x.lines;
        return l && l[0] === t2.lines[0];
      });
    step('with the ladder spent, the remark is what he says', isRemark,
         t2 ? (t2.lines[0] || '').slice(0, 44) : 'nothing');
    if (t2) t2.commit();
    const after = { stage: VF.npcs.peek('mechanic').stage, quests: VF.quests.activeCount(),
                    journal: d.journal.length };
    step('hearing it advanced no stage', before.stage === after.stage);
    step('started no quest', before.quests === after.quests);
    step('and wrote nothing in the journal', before.journal === after.journal);

    /* --- but it IS recorded, or he says it every single time --- */
    step('and it was recorded, so he will not say it again next time',
         Object.keys(VF.npcs.peek('mechanic').said || {}).length > 0,
         Object.keys(VF.npcs.peek('mechanic').said || {}).join(','));

    return out;
  });

  r.table.forEach(t => {
    console.log('  ' + t.world.padEnd(28) + (t.said.length ? t.said.join('  ') : '—'));
  });
  console.log('');
  r.steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 4).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); [...new Set(r.fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nthey notice, and what they notice depends on you');
  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
