/* Every branch of every remaining choice, played from an identical save.

   §3 and §45 say a choice only exists when the outcomes differ. That is easy
   to agree with and easy to drift away from, because a branch that returns a
   different sentence LOOKS like a different outcome while you are writing it.

   So it is measured. Each option is run against a fresh copy of the same save,
   the resulting world is diffed against the starting one, and two branches of
   the same event that produce the same diff are a build failure. The text is
   deliberately not part of the diff: a different sentence is not a different
   outcome, and that confusion is the entire bug this catches.

     node tools/consequences.js
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
    const out = { events: [], fail: [] };

    /* What the world looks like, in the terms a choice could plausibly move.
       Text is not in here on purpose. */
    function snapshot() {
      const d = VF.state.data;
      return JSON.stringify({
        money: d.money,
        hull: d.boat && d.boat.hp,
        clues: Object.keys(d.clues || {}).sort(),
        leads: Object.keys(d.leads || {}).sort(),
        secrets: Object.keys(d.secrets || {}).sort(),
        tokens: d.caseTokens,
        journal: (d.journal || []).map(e => e.id).sort()
      });
    }

    VF.state.data.level = 60;
    VF.state.data.money = 1e6;
    VF.state.data.unlockedLocations = VF.locations.list.map(l => l.id);
    const base = JSON.parse(JSON.stringify(VF.state.data));

    VF.seaData.list.forEach(def => {
      const opts = def.options || [];
      const results = [];
      opts.forEach((o, i) => {
        // identical starting world for every branch
        VF.state.data = JSON.parse(JSON.stringify(base));
        const before = snapshot();
        const voyage = { slow: 1, onArrive: null };
        let threw = null;
        try { o.run(voyage); } catch (e) { threw = e.message; }
        const after = snapshot();
        results.push({
          label: o.label,
          changed: before !== after,
          // things a choice can move that do not live in the save
          arrive: voyage.onArrive ? JSON.stringify(voyage.onArrive) : null,
          slow: voyage.slow !== 1 ? voyage.slow : null,
          diff: after === before ? '' : after,
          threw: threw
        });
      });

      results.forEach(res => {
        if (res.threw) out.fail.push(def.id + ' / "' + res.label + '" threw: ' + res.threw);
      });

      /* A branch that moves nothing at all is the fake choice this is hunting.
         One-option events are outcomes rather than questions and are exempt. */
      if (opts.length > 1) {
        results.forEach(res => {
          if (!res.changed && !res.arrive && !res.slow) {
            out.fail.push(def.id + ' / "' + res.label + '" changes nothing but the sentence');
          }
        });
        // and two branches that land in the same place are one branch
        for (let a = 0; a < results.length; a++) {
          for (let b = a + 1; b < results.length; b++) {
            const ka = results[a].diff + '|' + results[a].arrive + '|' + results[a].slow;
            const kb = results[b].diff + '|' + results[b].arrive + '|' + results[b].slow;
            if (ka === kb) {
              out.fail.push(def.id + ': "' + results[a].label + '" and "' +
                            results[b].label + '" are the same choice');
            }
          }
        }
      }

      out.events.push({ id: def.id, cls: def.cls, n: opts.length,
                        moves: results.map(x => x.changed || !!x.arrive || !!x.slow) });
    });

    VF.state.data = base;
    return out;
  });

  const pad = (s, n) => String(s).padEnd(n);
  console.log(pad('event', 14) + pad('class', 13) + 'branches');
  console.log('-'.repeat(52));
  r.events.forEach(e => {
    const marks = e.moves.map(m => m ? '+' : '·').join(' ');
    console.log(pad(e.id, 14) + pad(e.cls || '-', 13) +
                (e.n > 1 ? e.n + ' [' + marks + ']' : 'happens'));
  });
  console.log('\n+ moves the world   · moves nothing');

  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 5).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); r.fail.forEach(f => console.log('  ' + f)); }
  else console.log('\nevery choice that is offered is a real one');

  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
