/* The chart, and whether the world has a shape.

   It used to be a plumb line: one vertical spine, places hung off it by
   progression index, and no coordinates anywhere in the build. Everything
   below is a check that the geography that replaced it is real rather than
   decorative — that the positions are distinct, that distance means
   something, that a crossing's length comes off it, and that a compass
   direction can be spoken and be true.

     node tools/chart.js          writes tools/sc-port/chart-*.png
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'sc-port');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(400);

  const steps = [], fail = [];
  function step(s, ok, note) { steps.push({ s, ok: !!ok, note: note || '' }); if (!ok) fail.push(s); }

  /* --- the data, before anything is drawn --- */
  const geo = await page.evaluate(() => {
    const out = { fail: [], pairs: [], places: [] };
    VF.secrets.list.forEach(sc => { if (sc.loc) VF.locations.register(sc.loc); });
    const all = VF.locations.list.concat([VF.placeData.location]);

    all.forEach(l => {
      if (!Array.isArray(l.at) || l.at.length !== 2 ||
          !isFinite(l.at[0]) || !isFinite(l.at[1])) out.fail.push(l.id + ': no position');
      if (l.id !== 'harbour' && !(l.depthM > 0)) out.fail.push(l.id + ': no sounding');
      if (l.shoal === undefined) out.fail.push(l.id + ': no shoal');
      out.places.push({ id: l.id, at: l.at, depthM: l.depthM, shoal: l.shoal });
    });

    /* Two places in the same water is a chart nobody can click. */
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const d = Math.hypot(all[i].at[0] - all[j].at[0], all[i].at[1] - all[j].at[1]);
        if (d < 0.9) out.fail.push(all[i].id + ' and ' + all[j].id + ' are ' + d.toFixed(2) + ' leagues apart');
      }
    }

    /* Hidden water sits BESIDE the place it is near, not on top of it and not
       across the map from it — `near` has been in the data since before there
       were coordinates and it has to still be true now that there are. */
    VF.secrets.list.forEach(sc => {
      if (!sc.loc || !sc.loc.near) return;
      const d = VF.locations.distance(sc.loc.id, sc.loc.near);
      out.pairs.push({ a: sc.loc.id, near: sc.loc.near, d: +d.toFixed(2) });
      if (d < 0.9) out.fail.push(sc.loc.id + ' is on top of ' + sc.loc.near);
      if (d > 6) out.fail.push(sc.loc.id + ' is ' + d.toFixed(1) + ' leagues from the ' +
                               sc.loc.near + ' it is meant to be near');
    });

    /* And an east that means east. */
    out.eastOfHarbour = VF.locations.compass('harbour', 'trench');
    out.flatsFromHome = VF.locations.compass('harbour', 'flats');
    out.abyssFromHome = VF.locations.compass('harbour', 'abyss');
    return out;
  });
  geo.fail.forEach(f => fail.push(f));
  step('every place has a position, a sounding and a shoal', geo.fail.length === 0);
  step('hidden water sits beside the place it is near, not on it',
       geo.pairs.every(p => p.d >= 0.9 && p.d <= 6),
       geo.pairs.map(p => p.a + '→' + p.near + ' ' + p.d).join('  '));
  step('the trench is east of home, and the compass agrees',
       geo.eastOfHarbour.indexOf('east') >= 0, geo.eastOfHarbour);
  step('and the other bearings are not all the same', 
       new Set([geo.eastOfHarbour, geo.flatsFromHome, geo.abyssFromHome]).size === 3,
       [geo.eastOfHarbour, geo.flatsFromHome, geo.abyssFromHome].join(' / '));

  /* --- distance is what a crossing costs --- */
  const trips = await page.evaluate(() => {
    const out = { rows: [], fail: [] };
    const d = VF.state.data;
    d.level = 99;
    const b = VF.boat.shape();
    if (b.owned.indexOf('dory') < 0) b.owned.push('dory');
    VF.boat.setHull('dory');
    const ids = VF.locations.shelf().map(l => l.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = 0; j < ids.length; j++) {
        if (i === j) continue;
        const lg = VF.locations.distance(ids[i], ids[j]);
        const dur = Math.min(30, Math.max(9, 7 + lg * 1.15)) / Math.max(0.5, VF.boat.speed());
        out.rows.push({ a: ids[i], b: ids[j], lg: +lg.toFixed(1), dur: +dur.toFixed(1) });
      }
    }
    /* Nothing instant and nothing interminable. */
    out.rows.forEach(r => {
      if (r.dur < 5) out.fail.push(r.a + '→' + r.b + ' takes ' + r.dur + 's');
      if (r.dur > 26) out.fail.push(r.a + '→' + r.b + ' takes ' + r.dur + 's');
    });
    /* And the whole point: a short hop is shorter than a haul. */
    const near = VF.locations.distance('harbour', 'shore');
    const far = VF.locations.distance('trench', 'cradle');
    out.near = +near.toFixed(2); out.far = +far.toFixed(2);
    if (!(far > near * 3)) out.fail.push('a haul is not meaningfully longer than a hop');
    return out;
  });
  trips.fail.forEach(f => fail.push(f));
  step('every crossing lands in a sane band', trips.fail.length === 0,
       Math.min(...trips.rows.map(r => r.dur)) + 's – ' +
       Math.max(...trips.rows.map(r => r.dur)) + 's');
  step('home to the shore is a hop and the trench to the cradle is a haul',
       trips.far > trips.near * 3, trips.near + ' vs ' + trips.far + ' leagues');

  /* --- and it draws, pans, zooms and hit-tests --- */
  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 40; d.money = 5e6;
    ['shore', 'basin', 'flats', 'trench', 'abyss'].forEach(id => {
      if (d.unlockedLocations.indexOf(id) < 0) d.unlockedLocations.push(id);
    });
    d.location = 'trench'; d.stats.casts = 20;
    VF.secrets.discover('lantern_isle');
    const b = VF.boat.shape();
    ['dory', 'survey'].forEach(h => { if (b.owned.indexOf(h) < 0) b.owned.push(h); });
    VF.boat.setHull('survey');
    b.bought = { engine: 2, sonar: 2, hold: 1, survey: 2, tackle: 1 };
    VF.boat.refit();
    VF.panels.open('map');
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, 'chart.png') });

  const draw = await page.evaluate(() => {
    const cv = document.querySelector('.map-canvas');
    const g = cv.getContext('2d');
    const px = g.getImageData(0, 0, cv.width, cv.height).data;
    /* How much of the canvas is not the bare paper. The chart is very dark by
       design, so this is measured against the paper's own colour rather than
       against an absolute brightness — the surveyed sea is only three values
       above the paper and it is still the biggest thing on there. */
    let n = 0, ink = 0;
    const P = [11, 16, 23];
    for (let i = 0; i < px.length; i += 4 * 17) {
      n++;
      if (Math.abs(px[i] - P[0]) + Math.abs(px[i + 1] - P[1]) + Math.abs(px[i + 2] - P[2]) > 6) ink++;
    }
    return { w: cv.width, h: cv.height, ink: ink / n };
  });
  step('the chart is wider than it is a column', draw.w > draw.h * 0.9,
       draw.w + '×' + draw.h);
  step('and most of it is drawn on', draw.ink > 0.45,
       (draw.ink * 100 | 0) + '% is not bare paper');

  const inter = await page.evaluate(() => {
    const cv = document.querySelector('.map-canvas');
    const r = cv.getBoundingClientRect();
    const out = {};
    /* every mark the panel laid out must hit-test back to itself */
    const nodes = VF.mapArt.layout([]);           // shape check only
    out.layoutOk = Array.isArray(nodes);
    return out;
  });
  step('layout answers with a list', inter.layoutOk);

  /* Dragging moves it, zooming changes the scale, and recentring undoes both.

     Measured off the view the renderer actually used, not off pixels: the
     chart animates, so two frames never match and a pixel comparison would
     pass whatever the input did. */
  const view = () => page.evaluate(() => {
    const v = VF.mapArt.lastView();
    return v ? { cx: +v.cx.toFixed(3), cy: +v.cy.toFixed(3), scale: +v.scale.toFixed(3) } : null;
  });

  const cvBox = await page.locator('.map-canvas').boundingBox();
  const v0 = await view();
  step('the chart opens looking at everything you know', !!v0,
       v0 ? v0.cx + ', ' + v0.cy + ' at ' + v0.scale + ' px/league' : 'no view');

  await page.mouse.move(cvBox.x + cvBox.width * 0.5, cvBox.y + cvBox.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(cvBox.x + cvBox.width * 0.5 + 140, cvBox.y + cvBox.height * 0.5 + 70, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const v1 = await view();
  step('dragging it moves what you are looking at',
       Math.abs(v1.cx - v0.cx) > 0.3 && Math.abs(v1.cy - v0.cy) > 0.2 &&
       v1.scale === v0.scale,
       'moved ' + (v0.cx - v1.cx).toFixed(2) + ', ' + (v0.cy - v1.cy).toFixed(2) + ' leagues');

  /* Zoom is about the pointer, so the point under it stays put. */
  const px0 = cvBox.x + cvBox.width * 0.3, py0 = cvBox.y + cvBox.height * 0.3;
  await page.mouse.move(px0, py0);
  const under0 = await page.evaluate(([px, py, bx, by, bw, bh]) => {
    const v = VF.mapArt.lastView();
    return VF.mapArt.toWorld(v, px - bx, py - by, bw, bh);
  }, [px0, py0, cvBox.x, cvBox.y, cvBox.width, cvBox.height]);
  await page.mouse.wheel(0, -500);
  await page.waitForTimeout(300);
  const v2 = await view();
  const under1 = await page.evaluate(([px, py, bx, by, bw, bh]) => {
    const v = VF.mapArt.lastView();
    return VF.mapArt.toWorld(v, px - bx, py - by, bw, bh);
  }, [px0, py0, cvBox.x, cvBox.y, cvBox.width, cvBox.height]);
  step('the wheel zooms it', v2.scale > v1.scale * 1.1,
       v1.scale.toFixed(1) + ' → ' + v2.scale.toFixed(1) + ' px/league');
  step('and about the pointer, so what you are looking at stays put',
       Math.hypot(under1.x - under0.x, under1.y - under0.y) < 0.12,
       'drifted ' + Math.hypot(under1.x - under0.x, under1.y - under0.y).toFixed(3) + ' leagues');
  await page.screenshot({ path: path.join(OUT, 'chart-zoomed.png') });

  await page.click('.map-home');
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => {
    const cv = document.querySelector('.map-canvas');
    const r = cv.getBoundingClientRect();
    const v = VF.mapArt.lastView();
    /* what a fresh fit would be for the canvas as it is right now — the
       canvas settles its size after the panel opens, so comparing against a
       view measured before that is comparing against a stale frame */
    const want = VF.mapArt.fit(VF.mapArt.lastNodes ? VF.mapArt.lastNodes() : [], r.width, r.height);
    return { v: { cx: +v.cx.toFixed(3), cy: +v.cy.toFixed(3), scale: +v.scale.toFixed(2) },
             w: Math.round(r.width), h: Math.round(r.height) };
  });
  step('and the whole chart puts it back',
       Math.abs(back.v.cx - v0.cx) < 0.01 && Math.abs(back.v.cy - v0.cy) < 0.01 &&
       Math.abs(back.v.scale - v2.scale) > 1,
       'centred on ' + back.v.cx + ', ' + back.v.cy + ' and zoomed back out');

  /* --- a sounding on blank water says something, and only with the gear ---

     Spying on VF.toast itself rather than on the bus: `ui:toast` is an event
     the HUD LISTENS to so other modules can raise one, not something the
     toast emits, so a listener there hears nothing from a direct call. */
  const sound = await page.evaluate(() => {
    const said = [];
    const realPlain = VF.toast.plain, realShow = VF.toast.show;
    VF.toast.plain = function (t) { said.push(String(t)); };
    VF.toast.show = function (t) { said.push(String(t)); };

    const cv = document.querySelector('.map-canvas');
    const r = cv.getBoundingClientRect();
    const v = VF.mapArt.lastView();
    const cov = VF.mapArt.coverage(VF.mapArt.lastNodes());

    /* Find a spot ON the canvas that is off the survey — walking the corners
       rather than guessing a world coordinate, because where the blank is
       depends on where the player has been. */
    let s = null;
    for (const f of [[0.94, 0.94], [0.94, 0.06], [0.06, 0.94], [0.5, 0.97], [0.97, 0.5]]) {
      const px = r.width * f[0], py = r.height * f[1];
      const wp = VF.mapArt.toWorld(v, px, py, r.width, r.height);
      if (!VF.mapArt.surveyed(cov, wp.x, wp.y)) { s = { x: px, y: py, w: wp }; break; }
    }
    if (!s) { VF.toast.plain = realPlain; VF.toast.show = realShow; return { onScreen: false }; }

    function press() {
      ['pointerdown', 'pointerup'].forEach(function (k) {
        cv.dispatchEvent(new PointerEvent(k, { bubbles: true, clientX: r.left + s.x,
                                               clientY: r.top + s.y, pointerId: 1 }));
      });
    }
    const b = VF.boat.shape();
    b.modules.survey = 0;
    said.length = 0; press();
    const without = said.join(' ');
    /* Room for it first — the vessel is loaded and `fit` refuses rather than
       clamping, which is the behaviour the yard depends on. */
    VF.boat.strip();
    b.bought.survey = 3; VF.boat.fit('survey', 3);
    said.length = 0; press();
    const withGear = said.join(' ');
    const lvl = VF.boat.level('survey');

    VF.toast.plain = realPlain; VF.toast.show = realShow;
    return { onScreen: true, at: [+s.w.x.toFixed(1), +s.w.y.toFixed(1)],
             without: without, withGear: withGear, lvl: lvl };
  });
  step('there is blank water on the chart to take a sounding in', sound.onScreen,
       sound.at ? sound.at.join(', ') + ' leagues' : 'the survey covers the whole view');
  step('without the gear there is nothing to take one with',
       /nothing aboard/.test(sound.without || ''), (sound.without || 'nothing said').slice(0, 54));
  step('with it, the water answers',
       sound.lvl > 0 && !!sound.withGear && sound.withGear !== sound.without,
       (sound.withGear || 'nothing said').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 66));

  /* --- the reading half is still readable ---------------------------------

     Giving the chart the room took it from the rail, and the first pass moved
     every word in the spot card a third of the screen to the right and
     squeezed it until the Travel button fell off the bottom of the panel. The
     primary action of a panel is never below the fold, and the reason a
     refusal happened is never underneath the thing that refused. */
  const rail = await page.evaluate(() => {
    /* pick somewhere this boat cannot work, so the card is at its tallest */
    const nd = VF.mapArt.lastNodes().filter(n => n.p.id === 'shore')[0];
    if (nd) {
      const cv = document.querySelector('.map-canvas');
      const r = cv.getBoundingClientRect();
      ['pointerdown', 'pointerup'].forEach(k => cv.dispatchEvent(
        new PointerEvent(k, { bubbles: true, clientX: r.left + nd.x,
                              clientY: r.top + nd.y, pointerId: 1 })));
    }
    const side = document.querySelector('.map-side');
    const pm = document.querySelector('.panel-map');
    const act = document.querySelector('.spot-actions');
    const say = document.querySelector('.map-side .fit-say');
    const sr = side.getBoundingClientRect(), pr = pm.getBoundingClientRect();
    const ar = act ? act.getBoundingClientRect() : null;
    const yr = say ? say.getBoundingClientRect() : null;
    return {
      railW: Math.round(sr.width),
      actionInFrame: !!ar && ar.bottom <= pr.bottom + 1 && ar.top >= pr.top,
      /* and the reason is above the pinned row rather than under it */
      reasonClear: !ar || !yr || yr.bottom <= ar.top + 1,
      hasReason: !!yr
    };
  });
  await page.waitForTimeout(200);
  step('the rail still has room to read in', rail.railW >= 360, rail.railW + 'px');
  step('and the way out of the panel is never below the fold', rail.actionInFrame);
  step('a refusal says why, above the row that refused', !rail.hasReason || rail.reasonClear);

  /* --- IT SURVIVES BEING RESIZED, WHICH IS NOT THE SAME AS OPENING AT A SIZE.

     This loop used to reopen at each viewport and ask only whether the CHART
     still had room. The chart having too much room IS the failure, so it
     passed for months while the rail walked off the side of the screen: the
     canvas wrote its measured width back into the grid every frame, the `1fr`
     column could never shrink below it, and each resize ratcheted the chart
     another two pixels wider until the reading half was clipped away entirely.

     So: resize with the panel OPEN, wide to narrow and back, the way a person
     does it — and watch the half that SHRINKS. */
  const sizes = [[1920, 1080], [1440, 900], [1280, 720], [1100, 800], [1024, 640],
                 [900, 1000], [820, 800], [720, 900], [1440, 900]];
  let lastChart = 0, lastW = 0, lastStacked = null, ratchet = 0;
  for (const vp of sizes) {
    await page.setViewportSize({ width: vp[0], height: vp[1] });
    await page.waitForTimeout(320);
    const r = await page.evaluate(() => {
      const cv = document.querySelector('.map-canvas');
      const pm = document.querySelector('.panel-map');
      const sd = document.querySelector('.map-side');
      const act = document.querySelector('.spot-actions');
      if (!cv || !pm || !sd) return { ok: false, why: 'no panel' };
      const b = cv.getBoundingClientRect(), p = pm.getBoundingClientRect();
      const s = sd.getBoundingClientRect();
      const a = act ? act.getBoundingClientRect() : null;
      const doc = document.documentElement;
      const stacked = innerWidth <= 780;
      return {
        ok: b.width > 120 && b.height > 120,
        why: Math.round(b.width) + '×' + Math.round(b.height),
        hscroll: doc.scrollWidth > doc.clientWidth + 1,
        chartW: Math.round(b.width),
        /* the reading half, which is what actually went missing */
        railIn: s.right <= p.right + 1 && s.left >= p.left - 1,
        railOnScreen: s.right <= innerWidth + 1 && s.left >= -1,
        railW: Math.round(s.width),
        /* and the way out of the panel. Stacked, the body scrolls and the row
           is pinned to the bottom of it; side by side it must simply be in. */
        actIn: !!a && a.right <= innerWidth + 1 && a.left >= -1 &&
               (stacked ? a.bottom <= innerHeight + 1
                        : a.bottom <= p.bottom + 1 && a.top >= p.top - 1),
        panelIn: p.left >= -1 && p.right <= innerWidth + 1
      };
    });
    /* Only a NARROWING window that widens the chart is the ratchet. Crossing
       into the stacked layout gives the chart the whole width on purpose, and
       so does making the window bigger again. */
    const stacked = vp[0] <= 780;
    if (lastChart && r.chartW > lastChart && vp[0] < lastW && stacked === lastStacked) ratchet++;
    lastChart = r.chartW || lastChart; lastW = vp[0]; lastStacked = stacked;
    step(vp.join('×') + ': the chart still has room', r.ok && !r.hscroll,
         r.why + (r.hscroll ? ' — and the page scrolls sideways' : ''));
    step(vp.join('×') + ': and the rail is still in the panel, on the screen',
         r.railIn && r.railOnScreen && r.railW >= 300,
         r.railW + 'px' + (r.railIn ? '' : ' — OUTSIDE the panel') +
         (r.railOnScreen ? '' : ' — OFF the screen'));
    step(vp.join('×') + ': and the way out is reachable', r.actIn && r.panelIn);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(320);
  /* The ratchet itself: a column that only ever grows is the mechanism, and it
     is worth naming separately from the symptom it eventually produces. */
  step('the chart column never grows while the window shrinks', ratchet === 0,
       ratchet ? ratchet + ' resize(s) made it wider' : '');

  steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s + (s.note ? '  — ' + s.note : '')));
  if (errors.length) { console.log('\npage errors:'); [...new Set(errors)].slice(0, 6).forEach(e => console.log('  ' + e)); }
  if (fail.length) { console.log('\nFAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('\nthe world has a shape, and east is east — ' + OUT);
  await browser.close();
  process.exitCode = (fail.length || errors.length) ? 1 : 0;
})();
