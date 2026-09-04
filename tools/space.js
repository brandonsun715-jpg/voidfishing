/* Asserts the world projection's invariants in a real browser.

   These are the properties everything placed in the world depends on, and
   every one of them is the kind that breaks silently: a projection that no
   longer round-trips does not throw, it just puts the line somewhere the
   player did not point. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  const r = await page.evaluate(() => {
    const out = { fail: [] };
    const L = VF.scene.L;

    /* 1. With the frame square on and the sun at its noon bearing, the light
          lands where it always did.

          THE LIGHT MOVES NOW. It runs an arc across the day — that is the
          whole of why a sunset is an event here rather than a colour — so the
          old form of this check, "every zone puts it at 0.70 of the way
          across", is a statement about a game that no longer exists and it
          failed in five zones the moment the arc landed.

          What still has to hold is that the arc is the ONLY thing moving it.
          At the top of the sun's own curve the sweep term is zero, so the
          light must be exactly where it was nailed before, in every zone, to
          the same tolerance. The invariant survives; it just has an hour on
          it now. */
    VF.time.setCycle(0.330);
    out.lightRatio = {};
    VF.locations.list.slice(0, 9).forEach(l => {
      VF.state.data.location = l.id;
      VF.scene.update(0.016);
      VF.camera.set(0);
      VF.scene.update(0.016);
      const k = VF.scene.L.glowX / VF.scene.L.w;
      out.lightRatio[l.id] = +k.toFixed(5);
      if (Math.abs(k - 0.70) > 0.0005) out.fail.push('light moved in ' + l.id + ': ' + k);
    });

    /* 2. project/unproject round-trip. If this drifts, aimed casting lands
          somewhere other than where the player pressed. */
    VF.camera.set(0);
    for (const u of [-2.0, -0.4, 0, 0.6, 1.9]) {
      for (const d of [0.05, 0.3, 0.62, 0.95]) {
        const p = VF.space.project(u, d);
        const b = VF.space.unproject(p.x, p.y);
        if (!b || Math.abs(b.u - u) > 1e-6 || Math.abs(b.d - d) > 1e-6) {
          out.fail.push('round-trip ' + u + ',' + d + ' -> ' + JSON.stringify(b));
        }
      }
    }

    /* 3. The new scale agrees with the renderer's own scaleAt(y), so old and
          new placements share one idea of how big a metre is. */
    for (const d of [0.1, 0.35, 0.7, 0.99]) {
      const y = VF.space.yAt(d);
      const k = (y - L.horizonY) / L.waterH;
      const legacy = 0.34 + 0.66 * Math.pow(k, 0.85);
      const now = VF.space.scaleAt(d);
      if (Math.abs(legacy - now) > 1e-9) out.fail.push('scale mismatch at d=' + d);
    }

    /* 4. Monotonicity. y must fall as d rises and spread must narrow, or the
          depth sort and the parallax both inverto. */
    let lastY = Infinity, lastSp = Infinity;
    for (let d = 0; d <= 3; d += 0.05) {
      const y = VF.space.yAt(d), sp = VF.space.spread(d);
      if (y > lastY + 1e-9) out.fail.push('y not monotone at d=' + d.toFixed(2));
      if (sp > lastSp + 1e-9) out.fail.push('spread not monotone at d=' + d.toFixed(2));
      lastY = y; lastSp = sp;
    }

    /* 5. Parallax has to be real: one world unit of camera moves near water
          further than it moves the horizon, or nothing reads as distance. */
    const nearShift = Math.abs(VF.space.xAt(0, 0.05) - VF.space.xAt(0, 0.05, { u: 1, zoom: 1 }));
    const farShift = Math.abs(VF.space.xAt(0, 1.0) - VF.space.xAt(0, 1.0, { u: 1, zoom: 1 }));
    const skyShift = Math.abs(VF.space.xAt(0, 6.0) - VF.space.xAt(0, 6.0, { u: 1, zoom: 1 }));
    out.parallax = { near: Math.round(nearShift), far: Math.round(farShift), sky: Math.round(skyShift) };
    if (!(nearShift > farShift * 1.5)) out.fail.push('near/far parallax too flat');
    if (!(farShift > skyShift)) out.fail.push('sky drifts more than the horizon');

    /* 5b. And the cast has to land where it was pointed. This is the claim the
           whole spatial half of the game rests on: if it drifts, every zone's
           navigation problem quietly stops being one. */
    VF.state.data.location = 'shore';
    VF.camera.set(0);
    VF.scene.update(0.016);
    VF.fishing.hardReset();
    for (const [u, d] of [[-0.6, 0.35], [0, 0.55], [0.7, 0.8]]) {
      VF.fishing.aimAt(u, d);
      VF.fishing.beginCharge();
      VF.fishing.S.charge = 1;
      VF.fishing.releaseCharge();
      const S = VF.fishing.S;
      if (Math.abs(S.castU - u) > 1e-9) {
        out.fail.push('cast bearing drifted: aimed ' + u + ' went ' + S.castU.toFixed(3));
      }
      /* Distance is allowed to fall short — that is the rod's reach and the
         meter — but never to overshoot what was asked for. */
      if (S.castD > d + 1e-9) {
        out.fail.push('cast overshot: aimed ' + d + ' went ' + S.castD.toFixed(3));
      }
      out.cast = out.cast || [];
      out.cast.push({ aim: d, got: +S.castD.toFixed(3) });
      VF.fishing.hardReset();
    }

    /* 6. Atmospheric perspective must actually attenuate with distance and
          must not depend on how dark the zone is. */
    out.fade = [0.1, 0.5, 1, 2].map(d => +VF.space.fadeAt(d).toFixed(3));
    if (!(VF.space.fadeAt(0.1) < VF.space.fadeAt(1) && VF.space.fadeAt(1) < VF.space.fadeAt(2))) {
      out.fail.push('fade not increasing with distance');
    }
    return out;
  });

  console.log('light ratio per zone:', JSON.stringify(r.lightRatio));
  console.log('parallax px per world unit:', JSON.stringify(r.parallax));
  console.log('fade at d=0.1/0.5/1/2:', JSON.stringify(r.fade));
  console.log('cast aim vs landing:', JSON.stringify(r.cast));
  console.log('page errors:', errors.length ? errors : 'none');
  if (r.fail.length) {
    console.log('\nFAIL:');
    r.fail.forEach(f => console.log('  ' + f));
  } else {
    console.log('\nall projection invariants hold');
  }
  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
