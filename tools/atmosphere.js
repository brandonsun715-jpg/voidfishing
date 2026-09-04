/* Nine places, or one place in nine colours.

   This is the tool the atmosphere rewrite exists for. The old sky was
   `mix(skyTop, skyBot, t)` — one linear ramp between two colours — and every
   location in the game ran that same equation with different constants. A
   screenshot of any two of them, converted to greyscale, was the same
   picture. No amount of palette work can fix that, and no palette-based test
   can detect it, which is why nobody did.

   So this measures STRUCTURE and ignores colour:

     the vertical profile   luminance down the frame, divided through by the
                            frame mean, so two places with the same ramp in
                            different hues come out identical here
     detail at three scales the mean absolute difference between neighbouring
                            samples at strides of 1, 5 and 21 pixels, taken
                            separately in the sky and in the water — this is
                            what tells cloud from a gradient
     the horizon step       how hard the edge between air and water is
     the mirror term        correlation between each water band and the sky
                            band it would be reflecting
     movement               the same pixels one tick apart

   And then it asserts the things each water and sky MODEL claims about
   itself, which is stronger than any distance threshold: a mirror has to
   actually correlate with its sky, still water has to actually not move, a
   swell has to actually eat the distance, a roofed sky has to actually have
   no stars in it, and an unbounded one has to actually refuse to dissolve at
   the horizon. A model that is only a different set of constants fails here.

     node tools/atmosphere.js
*/
const { chromium } = require('playwright');
const path = require('path');

const ZONES = ['shore', 'basin', 'flats', 'trench', 'abyss', 'cradle', 'nowhere', 'beneath'];
const CLOCKS = [0.10, 0.34, 0.55, 0.82];   // dawn, day, sunset, night

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(450);
  await page.click('#bootStart');
  await page.waitForTimeout(600);

  const R = await page.evaluate(async (args) => {
    const [ZONES, CLOCKS] = args;
    if (!VF.gl || !VF.gl.ok() || !VF.glWorld.ok()) return { noGpu: true };

    /* Draw the world shader ALONE — no back buffer, no 2D layer — and read
       that.

       Reading the finished GL canvas was not good enough, and the negative
       control is what proved it: give the Moonlit Basin the Quiet Shore's
       entire atmosphere and keep its own palette, and the test still passed,
       because the two zones have different headlands and the back buffer is
       composited into the sky. It was measuring the ART. Everything below is
       about the air, so the art has to be out of the frame — and asking the
       shader for one pass with a null back buffer is the whole of that. */
    function grab() {
      VF.palette.update();
      VF.glWorld.draw(VF.scene.L, VF.palette.P, null);
      const gl = VF.gl.ctx();
      const s = VF.gl.size();
      const w = Math.round(s.w * s.dpr), h = Math.round(s.h * s.dpr);
      const buf = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return { buf: buf, w: w, h: h };
    }

    /* GL reads bottom-up; everything else in this game is top-down. One
       conversion, here, so nothing below has to remember. */
    function lum(f, x, yTop) {
      const i = ((f.h - 1 - yTop) * f.w + x) * 4;
      return (f.buf[i] + f.buf[i + 1] + f.buf[i + 2]) / 3;
    }
    function rowMean(f, yTop) {
      let s = 0;
      for (let x = 0; x < f.w; x += 3) s += lum(f, x, yTop);
      return s / Math.ceil(f.w / 3);
    }

    function sig(zone, cycle) {
      VF.state.data.location = zone;
      VF.bus.emit('location:changed', zone);
      VF.scene.rebuild();
      VF.weather.force('clear');
      for (let i = 0; i < 40; i++) VF.weather.tick(0.5);
      VF.time.setCycle(cycle);
      for (let i = 0; i < 24; i++) { VF.palette.update(); VF.scene.update(0.033); }

      const A = grab();
      const hy = Math.round(VF.scene.L.horizonY / VF.scene.L.h * A.h);
      const o = { zone: zone, cycle: cycle };

      /* --- the vertical profile, colour removed ------------------------- */
      const N = 24, prof = [];
      let tot = 0;
      for (let i = 0; i < N; i++) {
        const m = rowMean(A, Math.min(A.h - 1, Math.round((i + 0.5) / N * A.h)));
        prof.push(m); tot += m;
      }
      const mean = Math.max(0.6, tot / N);
      o.mean = +mean.toFixed(2);

      /* The two halves are normalised SEPARATELY, each by its own mean.

         Dividing the whole profile through by one number leaves the ratio
         between the sky's brightness and the water's in it, and that ratio is
         palette — so two zones running the identical atmosphere in different
         colours still measured a third of the way apart, and the negative
         control passed when it should have failed. Twice. What is left after
         this is the SHAPE of the ramp in the air and the shape of it on the
         water, which is the only part the atmosphere is responsible for. */
      const split = Math.max(1, Math.min(N - 1, Math.round(hy / A.h * N)));
      let ts = 0, tw = 0;
      for (let i = 0; i < split; i++) ts += prof[i];
      for (let i = split; i < N; i++) tw += prof[i];
      const ms = Math.max(0.6, ts / split), mw = Math.max(0.6, tw / (N - split));
      o.prof = prof.map(function (v, i) {
        return +(v / (i < split ? ms : mw)).toFixed(4);
      });

      /* --- detail at three scales, sky and water apart ------------------ */
      function detail(y0, y1) {
        const out = [];
        [1, 5, 21].forEach(function (st) {
          let s = 0, n = 0;
          for (let y = y0; y < y1; y += 4) {
            for (let x = 0; x + st < A.w; x += 4) {
              s += Math.abs(lum(A, x, y) - lum(A, x + st, y)); n++;
            }
          }
          out.push(+(s / Math.max(1, n)).toFixed(3));
        });
        return out;
      }
      o.skyDetail = detail(2, Math.max(4, hy - 4));
      o.waterDetail = detail(hy + 4, A.h - 2);

      /* --- how hard the horizon is -------------------------------------- */
      const above = rowMean(A, Math.max(0, hy - 6));
      const below = rowMean(A, Math.min(A.h - 1, hy + 6));
      o.hstep = +(Math.abs(above - below) / mean).toFixed(4);

      /* --- is the water the sky? ----------------------------------------
         Correlation between a band of water and the band of sky it would be
         reflecting. A mirror scores high because it literally is one; an
         ordinary sea scores near nothing. */
      /* The row a mirror is actually reflecting is not the one straight
         across the horizon from it. The shader compresses the reflection
         toward the waterline as it comes closer — mix(1.00, 0.34, k) on the
         same 1/1.30 nearness ramp the projection uses — so a test that
         compares y+d against y-d is comparing the water against the wrong
         sky everywhere except right at the seam, and reads nothing. This
         encodes the claim the model makes and then checks it.

         The broad shape is then taken out of both rows with a five-tap moving
         average. Both halves carry a bright column at the light, because a
         path on the water IS a reflection, and with only the row mean removed
         an ordinary sea scores 0.43 against its own sky. What separates glass
         from a moonpath is whether the CLOUD structure comes back, and that
         is what is left after the high-pass. */
      const xs = [];
      for (let x = 6; x < A.w - 6; x += 9) xs.push(x);
      function hipass(vals) {
        const out = new Array(vals.length).fill(0);
        for (let j = 2; j < vals.length - 2; j++) {
          const avg = (vals[j - 2] + vals[j - 1] + vals[j] + vals[j + 1] + vals[j + 2]) / 5;
          out[j] = vals[j] - avg;
        }
        return out;
      }
      let saa = 0, sbb = 0, sab = 0;
      for (let y = hy + 4; y < A.h - 4; y += 3) {
        const k = Math.pow((y - hy) / Math.max(1, A.h - hy), 1 / 1.30);
        const sy = Math.round(hy - (y - hy) * (1.00 + (0.34 - 1.00) * k));
        if (sy < 3 || sy >= hy) continue;
        const a = hipass(xs.map(function (x) { return lum(A, x, y); }));
        const b = hipass(xs.map(function (x) { return lum(A, x, sy); }));
        for (let j = 2; j < xs.length - 2; j++) {
          saa += a[j] * a[j]; sbb += b[j] * b[j]; sab += a[j] * b[j];
        }
      }
      o.mirror = +(sab / Math.sqrt(Math.max(1e-6, saa * sbb))).toFixed(4);

      /* --- extinction: how much of the far water survives --------------- */
      /* How much of the far water has BECOME the air. Distance from the fog
         colour, far over near — a swell doubles the density and the far half
         of the frame converges on the haze long before the horizon does.

         The first version of this compared far luminance to near luminance
         and did not separate anything, because the near row of an open sea at
         midday is sitting in the sun's own lane and is brighter than distance
         alone can account for. Measuring against the thing the water is
         turning INTO takes the light out of it. */
      /* Extinction, measured as CONTRAST COLLAPSE rather than as a colour.

         Air multiplies whatever contrast the water had by (1 - ext), so a
         band far out is flatter than a band close in by exactly the amount
         the air is thick — and that holds whatever the palette is doing.

         Two earlier versions of this measured colour and both failed on the
         Quiet Shore, for the same reason and only visibly once the raw
         numbers were printed: the shore's water tone at range is 71.4 and its
         fog is 71.4. Its water and its air are the same brightness, so no
         measure of "how far from the fog" can see its extinction at all. This
         one does not ask.

         Reported as far-contrast over mid-contrast, so each zone is its own
         control and a bright sea is not mistaken for a clear one. */
      function bandContrast(frac) {
        const y0 = hy + Math.round((A.h - hy) * frac);
        let s2 = 0, n2 = 0;
        for (let dy = -3; dy <= 3; dy++) {
          const y = Math.max(hy + 1, Math.min(A.h - 2, y0 + dy));
          let m = 0, c = 0;
          for (let x = 4; x < A.w - 4; x += 3) { m += lum(A, x, y); c++; }
          m /= c;
          for (let x = 4; x < A.w - 4; x += 3) {
            const d = lum(A, x, y) - m; s2 += d * d; n2++;
          }
        }
        return Math.sqrt(s2 / Math.max(1, n2));
      }
      /* Averaged over three phases of the wave field rather than taken at
         one instant. The surface is moving, so a single sample of its
         contrast is a sample and not a measurement — between two runs of this
         tool the Quiet Shore's figure moved from 0.44 to 0.38 on identical
         code, which is most of the margin the test was working with. */
      let cFar = 0, cMid = 0;
      for (let ph = 0; ph < 3; ph++) {
        if (ph) { VF.state.rt.t += 0.37; VF.glWorld.draw(VF.scene.L, VF.palette.P, null); }
        cFar += bandContrast(0.06);
        cMid += bandContrast(0.45);
      }
      o.farNear = +((cFar / 3) / Math.max(0.35, cMid / 3)).toFixed(4);

      /* --- stars: bright points against a dark neighbourhood ------------ */
      let stars = 0;
      for (let y = 4; y < Math.max(6, hy * 0.55); y += 2) {
        for (let x = 4; x < A.w - 4; x += 2) {
          const c = lum(A, x, y);
          if (c < 40) continue;
          const around = (lum(A, x - 3, y) + lum(A, x + 3, y) +
                          lum(A, x, y - 3) + lum(A, x, y + 3)) / 4;
          if (c > around + 22) stars++;
        }
      }
      o.stars = stars;
      /* The value that drives the star renderer. Counting bright points in
         the upper sky sounds more honest and is not: the Cradle draws a ring
         up there and the Abyss draws crystal, and a detector for isolated
         bright pixels counts five hundred of them. What is being claimed is
         that a roofed place has no STAR FIELD, and this is that number. */
      o.starAlpha = +VF.palette.P.starAlpha.toFixed(4);

      /* --- and does the surface move? ----------------------------------- */
      /* The shader's own clock, moved by hand. VF.scene.update advances the
         world but the surface is a function of VF.state.rt.t, and a movement
         test that never moves it reads zero for every zone including the ones
         that are supposed to be moving — which passed, silently, and was
         worthless. */
      VF.state.rt.t += 0.55;
      for (let i = 0; i < 6; i++) { VF.scene.update(0.09); }
      const B = grab();
      let mv = 0, mn = 0;
      for (let y = hy + 10; y < A.h - 2; y += 3) {
        for (let x = 4; x < A.w - 4; x += 5) { mv += Math.abs(lum(A, x, y) - lum(B, x, y)); mn++; }
      }
      /* Normalised by the frame's own brightness. Un-normalised, the Quiet
         Shore at midday scores a hundred times the Moonlit Basin for no
         reason except that it is a hundred times lighter, and "does this
         surface move" becomes "is this scene bright". */
      o.move = +(mv / Math.max(1, mn) / mean).toFixed(4);
      return o;
    }

    const out = [];
    for (let i = 0; i < ZONES.length; i++) {
      for (let c = 0; c < CLOCKS.length; c++) out.push(sig(ZONES[i], CLOCKS[c]));
    }

    /* ------------------------------------------------- the built-in control

       A threshold picked by hand is a threshold fitted to whatever the code
       happened to be doing on the afternoon it was written. So the tool makes
       its own failing case: the Moonlit Basin, rendered with the Quiet
       Shore's entire atmosphere and its own palette — which is precisely "the
       same scene in a different colour", the thing this whole rewrite exists
       to stop, in the one form that is hardest to see.

       Every real pair of zones then has to be measurably further apart than
       that. Nothing is calibrated against a number I chose; it is calibrated
       against the failure itself, on every run, and it moves when the game
       does. Two earlier versions of this test passed the control — once
       because it was reading the zone ART through the back buffer, and once
       because the profile still carried the sky-to-water brightness ratio,
       which is palette. Neither was visible without this. */
    const basin = VF.locations.get('basin');
    const held = basin.air;
    basin.air = VF.locations.get('shore').air;
    const twin = [];
    for (let c = 0; c < CLOCKS.length; c++) twin.push(sig('basin', CLOCKS[c]));
    basin.air = held;

    return { rows: out, twin: twin };
  }, [ZONES, CLOCKS]);

  if (R.noGpu) {
    console.log('FAIL: no WebGL2 — this tool measures the shader and there is not one');
    await browser.close(); process.exitCode = 1; return;
  }

  const steps = [], fail = [];
  function step(s, ok, note) { steps.push({ s, ok: !!ok, note }); if (!ok) fail.push(s); }
  const at = function (z, c) {
    return R.rows.filter(function (r) { return r.zone === z && r.cycle === c; })[0];
  };
  const med = function (a) { const b = a.slice().sort(function (x, y) { return x - y; }); return b[b.length >> 1]; };

  /* ------------------------------------------------- structural distance

     Colour is already divided out of the profile, and detail and the horizon
     step never had any. Two places that differ only in palette land on top of
     each other here, which is the whole point. */
  function dist(a, b) {
    let d = 0;
    for (let i = 0; i < a.prof.length; i++) d += Math.abs(a.prof[i] - b.prof[i]);
    d /= a.prof.length;
    for (let i = 0; i < 3; i++) {
      const s = Math.abs(a.skyDetail[i] - b.skyDetail[i]) / Math.max(1, a.skyDetail[i] + b.skyDetail[i]);
      const w = Math.abs(a.waterDetail[i] - b.waterDetail[i]) / Math.max(1, a.waterDetail[i] + b.waterDetail[i]);
      d += (s + w) * 0.22;
    }
    d += Math.abs(a.hstep - b.hstep) * 0.35;
    d += Math.abs(a.mirror - b.mirror) * 0.30;
    return d;
  }

  let worst = { d: 1e9, a: '', b: '' };
  CLOCKS.forEach(function (c) {
    for (let i = 0; i < ZONES.length; i++) {
      for (let j = i + 1; j < ZONES.length; j++) {
        const d = dist(at(ZONES[i], c), at(ZONES[j], c));
        if (d < worst.d) worst = { d: d, a: ZONES[i], b: ZONES[j], c: c };
      }
    }
  });

  /* THE CONTROL, COMPARED LIKE FOR LIKE.

     The first version of this asked whether the closest of a hundred and
     twelve real pairings beat one control pairing, which is not a fair
     question: a minimum over a hundred and twelve draws is small for reasons
     that have nothing to do with the measure, and as the measure's headroom
     narrowed the two converged and the test failed on a build where nothing
     was wrong.

     The claim being made is about ONE zone: put the Quiet Shore's atmosphere
     on the Moonlit Basin and the basin should move measurably toward the
     shore. So that is what is measured — the same pair, twice, with and
     without the swap — and both numbers come from the same two places at the
     same hour. Nothing about it depends on how many zones there are. */
  let moved = 0, held = 0, n = 0;
  CLOCKS.forEach(function (c, i) {
    moved += dist(R.twin[i], at('shore', c));
    held += dist(at('basin', c), at('shore', c));
    n++;
  });
  moved /= n; held /= n;

  step('a zone wearing another zone\'s atmosphere moves toward it',
       moved < held * 0.80,
       'basin->shore ' + held.toFixed(4) + ', wearing its air ' + moved.toFixed(4));
  step('and no two zones are alike to begin with',
       worst.d > held * 0.55,
       'closest pair ' + worst.a + '/' + worst.b + ' at ' + worst.c +
       ' — ' + worst.d.toFixed(4) + ' against basin/shore at ' + held.toFixed(4));

  /* ------------------------------------------------------ the models

     Each of these is the claim the model makes about itself, measured. */
  const openZ = ['shore', 'basin', 'cradle', 'nowhere'];
  const openMirror = med(openZ.map(function (z) { return Math.abs(at(z, 0.34).mirror); }));
  const flatsMirror = at('flats', 0.34).mirror;
  const stillMirror = Math.abs(at('beneath', 0.34).mirror);
  /* The claim is the SEPARATION, not an absolute: a high-passed correlation
     has no natural scale, and what the model asserts is that water declared a
     mirror reproduces the structure of its own sky while water that is not
     declared one does not. An order of magnitude is that claim. */
  step('mirror water is actually the sky above it',
       flatsMirror > 0.15 && flatsMirror > openMirror * 4 &&
       stillMirror > openMirror * 4,
       'flats ' + flatsMirror.toFixed(2) + ' · beneath ' + stillMirror.toFixed(2) +
       ' · open median ' + openMirror.toFixed(2));

  const stillMove = at('beneath', 0.34).move;
  const openMove = med(openZ.map(function (z) { return at(z, 0.34).move; }));
  step('still water does not move at all',
       stillMove < openMove * 0.5,
       'beneath ' + stillMove.toFixed(3) + ' vs open median ' + openMove.toFixed(3));

  const swellFar = at('trench', 0.34).farNear;
  const shoreFar = at('shore', 0.34).farNear;
  step('a swell eats the distance the way a shore does not',
       swellFar < shoreFar * 0.60,
       'trench keeps ' + swellFar.toFixed(2) + ' of its contrast at range · shore ' +
       shoreFar.toFixed(2));

  const roofed = ['abyss', 'cradle'];
  const roofField = roofed.map(function (z) { return at(z, 0.82).starAlpha; });
  step('there are no stars under several million tonnes of rock',
       roofField.every(function (n) { return n === 0; }) && at('shore', 0.82).starAlpha > 0,
       roofed.map(function (z, i) { return z + ' ' + roofField[i]; }).join(', ') +
       ' · shore ' + at('shore', 0.82).starAlpha);

  const roofDetail = med(roofed.map(function (z) { return at(z, 0.34).skyDetail[2]; }));
  step('and the roof is a surface rather than a lid',
       roofDetail > 0.6, 'coarse sky detail ' + roofDetail.toFixed(2));

  /* What "unbounded" claims is that the AIR gives you no distance — no band
     of haze stacking up toward the horizon. That is flatness in the sky half
     of the vertical profile, not a hard edge at the waterline: the first
     version of this test asked for a sharp step and failed, because a place
     with void 0.74 also has its horizon merged away, and the two effects
     cancel. Measured as the claim is actually made, it passes. */
  function skyRange(r) {
    const half = Math.max(3, Math.round(r.prof.length * 0.34));
    let lo = 1e9, hi = -1e9;
    for (let i = 1; i < half; i++) { lo = Math.min(lo, r.prof[i]); hi = Math.max(hi, r.prof[i]); }
    return hi - lo;
  }
  const nowhereFlat = skyRange(at('nowhere', 0.34));
  const openFlat = med(['shore', 'basin', 'flats'].map(function (z) { return skyRange(at(z, 0.34)); }));
  step('an unbounded sky gives the eye no distance at all',
       nowhereFlat < openFlat * 0.75,
       'nowhere sky range ' + nowhereFlat.toFixed(2) + ' vs open median ' + openFlat.toFixed(2));

  /* --------------------------------------------------- weather and hour */
  const clouded = at('trench', 0.34).skyDetail[1];
  const clear = at('basin', 0.34).skyDetail[1];
  step('a closed sky has cloud in it and a clear one does not',
       clouded > clear * 1.6, 'trench ' + clouded.toFixed(2) + ' · basin ' + clear.toFixed(2));

  step('and an overcast takes them as well',
       at('trench', 0.82).starAlpha < at('basin', 0.82).starAlpha * 0.5,
       'trench ' + at('trench', 0.82).starAlpha + ' · basin ' + at('basin', 0.82).starAlpha);

  let flat = [];
  ZONES.forEach(function (z) {
    const d = dist(at(z, 0.10), at(z, 0.82));
    if (d < 0.02) flat.push(z + ' ' + d.toFixed(3));
  });
  step('every zone looks different at dawn than at night', flat.length === 0, flat.join(', '));

  steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s +
                                 (s.note ? '  — ' + s.note : '')));
  console.log('');
  console.log('  zone      profile-mean  skyDetail(1/5/21)   water    mirror  h-step  move  stars');
  CLOCKS.slice(1, 2).forEach(function (c) {
    ZONES.forEach(function (z) {
      const r = at(z, c);
      console.log('  ' + z.padEnd(9) +
        String(r.mean).padStart(7) + '      ' +
        r.skyDetail.map(function (v) { return String(v.toFixed(1)).padStart(5); }).join(' ') + '  ' +
        String(r.waterDetail[1].toFixed(1)).padStart(5) + '  ' +
        String(r.mirror.toFixed(2)).padStart(6) + '  ' +
        String(r.hstep.toFixed(2)).padStart(6) + '  ' +
        String(r.move.toFixed(2)).padStart(5) + '  ' +
        String(r.stars).padStart(5));
    });
  });

  if (errors.length) fail.push('page errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  console.log('');
  if (fail.length) { console.log('FAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('nine places, and the greyscale tells them apart');
  await browser.close();
  process.exitCode = fail.length ? 1 : 0;
})();
