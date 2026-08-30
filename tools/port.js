/* Vault Harbour, with the interface off.

   The brief's own test and the only one that can answer the question this
   whole round exists to answer: hide everything that is not the place, take
   the picture, and look at it. If a viewpoint reads as a menu with a painting
   behind it, it has failed and gets redrawn.

   The rest is mechanical: every hotspot has to be inside the frame and has to
   hit-test, every exit has to lead somewhere that exists, clicking a thing
   has to open what it says it opens, the moored boat has to show the wear the
   save actually holds, and putting out has to end up on the water.

     node tools/port.js            writes tools/sc-port/*.png
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'sc-port');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(400);

  /* A save with something in it, so the wall is not bare and the boat is not
     a skiff — an empty harbour is not a fair test of a harbour. */
  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 24; d.money = 400000; d.stats.casts = 200; d.voyages = 9;
    const b = VF.boat.shape();
    ['dory', 'survey'].forEach(h => { if (b.owned.indexOf(h) < 0) b.owned.push(h); });
    VF.boat.setHull('survey');
    b.modules = { engine: 2, sonar: 2, hold: 1, survey: 1, tackle: 1 };
    b.wear = 0.42;
    VF.palette.update();
  });

  const steps = [], fail = [];
  function step(s, ok, note) { steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) fail.push(s); }

  /* --- the data holds together before anything is drawn --- */
  const shape = await page.evaluate(() => {
    const out = { views: [], fail: [] };
    const ids = VF.placeData.ids;
    VF.placeData.views.forEach(v => {
      const spots = v.spots.map(s => s.id);
      if (new Set(spots).size !== spots.length) out.fail.push(v.id + ': duplicate spot ids');
      v.exits.forEach(e => {
        if (ids.indexOf(e.to) < 0) out.fail.push(v.id + ': exit to nowhere — ' + e.to);
      });
      v.people.forEach(p => {
        if (!VF.npcs.get(p.npc)) out.fail.push(v.id + ': nobody called ' + p.npc);
      });
      v.spots.forEach(s => {
        if (s.talk && !VF.npcs.get(s.talk)) out.fail.push(v.id + '/' + s.id + ': talks to nobody');
        if (!s.talk && !s.opens && !s.act) out.fail.push(v.id + '/' + s.id + ': does nothing');
        if (s.act && ['look', 'leave'].indexOf(s.act) < 0) {
          out.fail.push(v.id + '/' + s.id + ': unknown act — ' + s.act);
        }
      });
      out.views.push({ id: v.id, spots: spots.length, people: v.people.length,
                       exits: v.exits.length });
    });
    /* every view has to be reachable from the first one */
    const seen = {}, q = [VF.placeData.first()];
    while (q.length) {
      const cur = q.shift();
      if (seen[cur]) continue;
      seen[cur] = 1;
      VF.placeData.view(cur).exits.forEach(e => q.push(e.to));
    }
    ids.forEach(id => { if (!seen[id]) out.fail.push(id + ': cannot be walked to'); });
    return out;
  });
  shape.fail.forEach(f => fail.push(f));
  step('every view is well formed and reachable', shape.fail.length === 0,
       shape.views.map(v => v.id + ' (' + v.spots + ' spots, ' + v.people + ' people)').join('  '));

  /* --- enter, and check the machine --- */
  const entered = await page.evaluate(() => {
    const was = VF.state.data.location;
    VF.place.enter();
    return { open: VF.place.isOpen(), view: VF.place.view(),
             locationUntouched: VF.state.data.location === was,
             body: document.body.className };
  });
  step('putting in opens the harbour', entered.open && entered.view === 'dock', entered.view);
  step('and it did not change where you fish', entered.locationUntouched);
  step('the fishing interface is off', /in-port/.test(entered.body));

  /* --- every viewpoint, with the UI off --- */
  const views = ['dock', 'yard', 'market', 'home'];
  for (const v of views) {
    await page.evaluate(id => { VF.place.go(id); VF.place.S.cross = 1; VF.place.S.arrive = 1; }, v);
    await page.waitForTimeout(420);
    await page.keyboard.press('F8');            // interface off
    await page.waitForTimeout(220);
    await page.screenshot({ path: path.join(OUT, v + '.png') });
    await page.keyboard.press('F8');
    await page.waitForTimeout(120);

    const r = await page.evaluate(() => {
      const L = VF.place.layout();
      const v2 = VF.place.viewDef();
      const out = { id: v2.id, off: [], missed: [], ink: 0 };
      v2.spots.forEach(sp => {
        const r2 = VF.place.rectOf(sp, L);
        if (r2.x < -L.figureH * 0.5 || r2.x + r2.w > L.w + L.figureH * 0.5 ||
            r2.y < -L.figureH * 0.5 || r2.y + r2.h > L.h + L.figureH * 0.5) {
          out.off.push(sp.id);
        }
        const hit = VF.place.pick(r2.cx, r2.y + r2.h * 0.5);
        if (!hit || hit.kind !== 'spot') out.missed.push(sp.id + ' (nothing there)');
      });
      return out;
    });
    step(v + ': every hotspot is in the frame', r.off.length === 0, r.off.join(', '));
    step(v + ': every hotspot can be clicked', r.missed.length === 0, r.missed.join(', '));
  }

  /* --- how much of the frame is actually drawn. A view that is 4% ink is a
     gradient with a label on it. --- */
  for (const v of views) {
    const p = path.join(OUT, v + '.png');
    const size = fs.statSync(p).size;
    step(v + ': the picture has something in it', size > 24000, (size / 1024 | 0) + 'kB');
  }

  /* --- clicking things opens what they say they open --- */
  const opened = await page.evaluate(async () => {
    const out = {};
    function clickSpot(view, id) {
      VF.place.go(view); VF.place.S.cross = 1;
      const L = VF.place.layout();
      const sp = VF.place.viewDef().spots.filter(s => s.id === id)[0];
      const r = VF.place.rectOf(sp, L);
      VF.place.press(r.cx, r.y + r.h * 0.5);
    }
    clickSpot('market', 'counter');
    out.counter = VF.state.rt.panelOpen;
    VF.panels.close();
    clickSpot('yard', 'mine');
    out.boat = VF.state.rt.panelOpen;
    VF.panels.close();
    clickSpot('home', 'desk');
    out.desk = VF.state.rt.panelOpen;
    VF.panels.close();
    /* and a person is a conversation, not a panel */
    clickSpot('dock', 'child');
    out.talking = VF.place.talking();
    out.line = VF.place.line();
    out.panelWhileTalking = VF.state.rt.panelOpen;
    return out;
  });
  /* --- and NOTHING in the harbour is a dead click ------------------------

     Checked exhaustively rather than by sampling, because the failure mode is
     silent: a hotspot whose target does not exist looks exactly like one that
     works right up until somebody clicks it. The aquarium door was exactly
     this — `opens: 'aquarium'`, and 'aquarium' is not a panel. */
  const dead = await page.evaluate(() => {
    const out = [];
    VF.placeData.views.forEach(v => {
      VF.place.go(v.id); VF.place.S.cross = 1;
      const L = VF.place.layout();
      v.spots.forEach(sp => {
        VF.panels.close();
        if (VF.aquariumUI.isOpen()) VF.aquariumUI.close();
        VF.place.S.talk = null; VF.place.S.look = null;
        const r = VF.place.rectOf(sp, L);
        VF.place.press(r.cx, r.y + r.h * 0.5);
        const did = !!VF.state.rt.panelOpen || VF.place.talking() ||
                    !!VF.place.S.look || VF.aquariumUI.isOpen();
        if (!did) out.push(v.id + '/' + sp.id);
      });
    });
    VF.panels.close();
    if (VF.aquariumUI.isOpen()) VF.aquariumUI.close();
    VF.place.S.talk = null;
    return out;
  });
  step('nothing in the harbour is a dead click', dead.length === 0, dead.join(', '));

  step('the counter is the shop', opened.counter === 'shop', String(opened.counter));
  step('your boat in the yard is the fitting', opened.boat === 'boat', String(opened.boat));
  step('the desk is the journal', opened.desk === 'journal', String(opened.desk));
  step('and a person is a conversation, in place', opened.talking && !opened.panelWhileTalking,
       opened.line ? '“' + String(opened.line).slice(0, 46) + '”' : 'no line');

  /* --- the boat on the boards shows the boat you actually own --- */
  const boat = await page.evaluate(() => {
    return { wear: VF.boat.shape().wear, integrity: VF.boat.integrity(),
             hull: VF.boat.hull().id, modules: VF.boat.shape().modules };
  });
  step('the harbour knows which boat is yours', boat.hull === 'survey',
       boat.hull + ', ' + Math.round(boat.integrity * 100) + '% and fitted');

  /* --- the boat you are looking at is the boat you own -------------------

     The whole argument for the yard is that you can see the state of your
     hull without opening a panel. So: draw her clean, draw her wrecked, and
     the two pictures had better not be the same picture. */
  await page.evaluate(() => {
    VF.place.S.talk = null;
    VF.place.go('yard'); VF.place.S.cross = 1;
    const b = VF.boat.shape();
    b.wear = 0; b.modules = { engine: 0, sonar: 0, hold: 0, survey: 0, tackle: 0 };
  });
  await page.waitForTimeout(300);
  const clean = await page.screenshot({ path: path.join(OUT, 'boat-clean.png') });
  await page.evaluate(() => {
    const b = VF.boat.shape();
    b.wear = 0.92; b.modules = { engine: 3, sonar: 3, hold: 3, survey: 3, tackle: 2 };
  });
  await page.waitForTimeout(300);
  const worn = await page.screenshot({ path: path.join(OUT, 'boat-worn.png') });
  step('a wrecked, fully fitted boat does not look like a clean bare one',
       Buffer.compare(clean, worn) !== 0,
       (clean.length / 1024 | 0) + 'kB vs ' + (worn.length / 1024 | 0) + 'kB');

  /* --- putting out ends up on the water --- */
  const out = await page.evaluate(() => {
    VF.place.S.talk = null;
    VF.panels.travel('trench');
    return { open: VF.place.isOpen(), where: VF.state.data.location,
             crossing: !!(VF.voyage && VF.voyage.active()),
             body: document.body.className };
  });
  step('putting out leaves the harbour', !out.open);
  step('and lands on the water', out.where === 'trench' || out.crossing,
       out.crossing ? 'on a crossing' : out.where);
  step('and the interface came back', !/in-port/.test(out.body));

  /* --- and it holds together on a phone ---------------------------------

     Four compositions laid out in fractions ought to survive any aspect
     ratio, but "ought to" is how a hotspot ends up half off the bottom of a
     portrait screen with nothing to say so. */
  await page.evaluate(() => VF.place.enter('dock'));
  for (const vp of [{ w: 390, h: 844, name: 'portrait' }, { w: 1024, h: 640, name: 'laptop' }]) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(320);
    const rr = await page.evaluate(() => {
      const out = { off: [], small: [] };
      VF.placeData.ids.forEach(id => {
        VF.place.go(id); VF.place.S.cross = 1;
        const L = VF.place.layout();
        VF.place.viewDef().spots.forEach(sp => {
          const r2 = VF.place.rectOf(sp, L);
          if (r2.x < -L.figureH * 0.5 || r2.x + r2.w > L.w + L.figureH * 0.5 ||
              r2.y < -L.figureH * 0.6 || r2.y + r2.h > L.h) out.off.push(id + '/' + sp.id);
          /* and it has to be big enough to hit with a thumb */
          if (r2.w < 24 || r2.h < 24) {
            out.small.push(id + '/' + sp.id + ' (' + Math.round(r2.w) + '×' + Math.round(r2.h) + ')');
          }
        });
        /* the ways out must not fall off the bottom */
        VF.place.exitLanes(L).forEach(l => {
          if (l.rect.y < 0 || l.rect.y + l.rect.h > L.h) out.off.push(id + '/exit:' + l.exit.to);
        });
      });
      return out;
    });
    step(vp.name + ' (' + vp.w + '×' + vp.h + '): everything stays in the frame',
         rr.off.length === 0, rr.off.join(', '));
    step(vp.name + ': everything is big enough to hit', rr.small.length === 0, rr.small.join(', '));
  }
  await page.setViewportSize({ width: 1440, height: 810 });

  steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); [...new Set(errors)].slice(0, 6).forEach(e => console.log('  ' + e)); }
  if (fail.length) { console.log('\nFAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nfour views, and you have been to all of them — ' + OUT);
  await browser.close();
  process.exitCode = (fail.length || errors.length) ? 1 : 0;
})();
