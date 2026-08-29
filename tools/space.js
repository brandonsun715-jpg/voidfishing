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

    /* 1. The light lands where it always did. The whole of phase 0 is meant to
          be invisible, and this is the number that would show. */
    out.lightRatio = {};
    VF.locations.list.slice(0, 9).forEach(l => {
      VF.state.data.location = l.id;
      VF.scene.update(0.016);
      const k = VF.scene.L.glowX / VF.scene.L.w;
      out.lightRatio[l.id] = +k.toFixed(5);
      if (Math.abs(k - 0.70) > 0.0005) out.fail.push('light moved in ' + l.id + ': ' + k);
    });

    /* 2. project/unproject round-trip. If this drifts, aimed casting lands
          somewhere other than where the player pressed. */
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
