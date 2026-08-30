/* Thirty crossings, and how many of them ask you anything.

   §60's first test, made mechanical. The old answer was thirty out of thirty:
   voyage.js rolled `1 + floor(rnd() * 2)` events and clamped it to at least
   one, so there was no such thing as an uneventful trip. This asserts the
   opposite — that most crossings are water going past — and it is the check
   that would have caught the original design.

     node tools/trips.js [n]
*/
const { chromium } = require('playwright');
const path = require('path');
const N = parseInt(process.argv[2] || '30', 10);

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

  const r = await page.evaluate((N) => {
    const d = VF.state.data;
    d.level = 60; d.money = 5e8;
    d.unlockedLocations = VF.locations.list.map(l => l.id);
    // a hull that can cross, and a sonar, so the whole pool is reachable
    VF.boat.buyHull && VF.boat.buyHull('survey');
    const out = { trips: [], errors: [] };

    /* Simulate crossings without the DOM: ask the same questions begin() asks
       and record what came back. Running the real voyage would mean sitting
       through thirty of them in real time. */
    for (let i = 0; i < N; i++) {
      VF.director.tick();
      const ctx = VF.director.context({ dist: 1 + (i % 3) });
      const def = VF.seaData.roll(ctx);
      const rec = { i: i, id: def ? def.id : null,
                    cls: def ? def.cls : 'NONE',
                    card: !!(def && def.options && def.options.length > 1),
                    onCourse: !!(def && def.onCourse),
                    budget: VF.director.state().budget };
      if (def) VF.director.spend(def);
      out.trips.push(rec);
    }
    return out;
  }, N);

  const withEvent = r.trips.filter(t => t.id).length;
  const withCard = r.trips.filter(t => t.card).length;
  const ignorable = r.trips.filter(t => t.id && !t.onCourse).length;

  console.log(r.trips.map(t => t.id ? (t.card ? 'C' : 'e') : '.').join(''));
  console.log('  . nothing   e something that happens   C something that asks\n');
  console.log('trips              ' + N);
  console.log('anything at all    ' + withEvent + '  (' + Math.round(100 * withEvent / N) + '%)');
  console.log('asked a question   ' + withCard + '  (' + Math.round(100 * withCard / N) + '%)');
  console.log('could be ignored   ' + ignorable + '  by holding the course');

  const fail = [];
  /* §60 test 1, and the two numbers that define the shape of the sea. The
     bounds are wide because this is a random process and a run of forty will
     wander; what they pin is the design, not the dice. */
  if (withCard > N * 0.35) fail.push('too many crossings ask a question (' + withCard + '/' + N + ')');
  if (withEvent > N * 0.55) fail.push('too much is happening out there (' + withEvent + '/' + N + ')');
  if (withEvent === N) fail.push('every crossing had an event — the guaranteed-popup design is back');
  if (withEvent < N * 0.10) fail.push('almost nothing ever happens (' + withEvent + '/' + N + ')');

  // §60 test 2: the same thing should not spam
  for (let i = 2; i < r.trips.length; i++) {
    const a = r.trips[i - 2].id, b = r.trips[i - 1].id, c = r.trips[i].id;
    if (a && a === b && b === c) fail.push('the same event three trips running: ' + a);
  }
  // and the budget has to actually bind: no two majors back to back
  for (let i = 1; i < r.trips.length; i++) {
    if (r.trips[i].cls === 'MAJOR' && r.trips[i - 1].cls === 'MAJOR') {
      fail.push('two major events back to back — the budget is not binding');
    }
  }

  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 5).forEach(e => console.log('  ' + e)); }
  if (fail.length) { console.log('\nFAIL:'); fail.forEach(f => console.log('  ' + f)); }
  else console.log('\nmost crossings are water going past');

  await browser.close();
  process.exitCode = (fail.length || errors.length) ? 1 : 0;
})();
