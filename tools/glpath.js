/* The same drawing, twice, and whether you could tell.

   The art migration has one rule: nothing is allowed to look different. This
   is the thing that decides. It takes an art function, draws it into a Canvas
   2D context and into js/gl/path.js with identical calls and identical
   arguments, and compares the two pictures.

   BIT-IDENTICAL IS NOT A THING and pretending otherwise would mean either a
   test that always fails or a threshold quietly loosened until it passes. Two
   rasterisers disagree by up to a quarter of a sample along every antialiased
   edge. So the bar is NO VISIBLE DIFFERENCE, and it is five numbers:

     · THE SHAPE MUST ACTUALLY DRAW. Two blank frames agree perfectly, and an
       earlier version of this file called that a pass — fourteen of them,
       while the renderer underneath was filling nothing at all. A comparison
       that cannot tell "identical" from "absent" is worse than no comparison,
       because it is the thing the work is being judged by. So every case is
       driven until it puts ink on the frame, and one that never does is a
       failure with a name rather than a silent ok.
     · rendered at 2× and downsampled, because 4× MSAA at 2× is sixteen
       effective samples and past what an eye resolves
     · mean absolute difference under 1.5/255 — catches a drifted gradient, a
       shifted colour, an alpha compounded wrong
     · no connected region over 12 pixels differing by more than 8/255 —
       catches a missing shape, a wrong join, a bad winding, a leaked clip
     · pixels within one pixel of a path edge are exempt from the fourth test
       and still counted in the third, so antialiasing cannot hide a real
       difference behind itself

   Anything that fails stays on Canvas 2D and this prints which. A partially
   ported module is fine. A silently degraded one is not.

     node tools/glpath.js          writes tools/sc-gl/*.png for failures
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'sc-gl');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  const fail = [];

  const r = await page.evaluate(async () => {
    const out = { rows: [], fail: [], missing: [], ok: !!(VF.glPath && VF.glPath.ok()) };
    if (!out.ok) { out.fail.push('the path renderer did not build'); return out; }

    const SS = 2;                       // supersample for the comparison
    const W = 320, H = 220, HY = 92;
    const MIN_INK = 150;                // px at 1×, out of 70400 — a real shape

    /* --- the two renders ------------------------------------------------- */
    function draw2d(fn) {
      const c = document.createElement('canvas');
      c.width = W * SS; c.height = H * SS;
      const g = c.getContext('2d');
      g.fillStyle = '#404040';
      g.fillRect(0, 0, c.width, c.height);
      g.save(); g.scale(SS, SS);
      fn(g);
      g.restore();
      return g.getImageData(0, 0, c.width, c.height);
    }

    function drawGl(fn) {
      VF.gl.resize(W * SS, H * SS, 1);
      const ms = VF.gl.msaa('probe', 1);
      const flat = VF.gl.target('probeOut', 1, false);
      VF.gl.bind(ms);
      const gl = VF.gl.ctx();
      gl.disable(gl.SCISSOR_TEST);
      gl.clearColor(0.25098, 0.25098, 0.25098, 1);   // the same #404040
      gl.clear(gl.COLOR_BUFFER_BIT);
      const g = VF.glPath.begin(ms);
      if (!g) return null;
      g.scale(SS, SS);
      fn(g);
      VF.glPath.end(ms, flat);
      const px = new Uint8Array(W * SS * H * SS * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, flat.fbo);
      gl.readPixels(0, 0, W * SS, H * SS, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      /* readPixels hands back row 0 = the BOTTOM of the framebuffer, and the
         2D reference is top-down. Compare them in that state and every shape
         reads as entirely missing AND entirely spurious at once — which is a
         very convincing impression of a renderer that draws nothing. Flip it
         here, where the coordinate systems actually meet. */
      const row = W * SS * 4, flip = new Uint8Array(px.length);
      for (let y = 0; y < H * SS; y++) {
        flip.set(px.subarray((H * SS - 1 - y) * row, (H * SS - y) * row), y * row);
      }
      return { data: flip, width: W * SS, height: H * SS,
               missed: VF.glPath.unsupported() };
    }

    /* --- downsample both to 1×, over the same opaque ground --------------- */
    function shrink(img) {
      const w = W, h = H, o = new Float32Array(w * h * 3);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let r = 0, g = 0, b = 0;
          for (let sy = 0; sy < SS; sy++) {
            for (let sx = 0; sx < SS; sx++) {
              const i = (((y * SS + sy) * img.width) + (x * SS + sx)) * 4;
              r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2];
            }
          }
          const n = SS * SS, j = (y * w + x) * 3;
          o[j] = r / n; o[j + 1] = g / n; o[j + 2] = b / n;
        }
      }
      return o;
    }

    /* How much of the frame is not bare ground. The whole point of the ink
       test: a shape that covers nothing has not been compared to anything. */
    function ink(img) {
      let n = 0;
      for (let i = 0, j = 0; i < W * H; i++, j += 3) {
        if (Math.abs(img[j] - 64) >= 4 || Math.abs(img[j + 1] - 64) >= 4 ||
            Math.abs(img[j + 2] - 64) >= 4) n++;
      }
      return n;
    }

    /* --- the criteria ----------------------------------------------------- */
    function compare(a, b) {
      const w = W, h = H;
      const diff = new Float32Array(w * h);
      let sum = 0;
      for (let i = 0, j = 0; i < diff.length; i++, j += 3) {
        const d = (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) +
                   Math.abs(a[j + 2] - b[j + 2])) / 3;
        diff[i] = d; sum += d;
      }
      const mean = sum / diff.length;

      /* Where the 2D render has an edge: a pixel whose neighbours differ. AA
         disagreement lives there and nowhere else. */
      const edge = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x, j = i * 3;
          const gx = Math.abs(a[j] - a[j - 3]) + Math.abs(a[j] - a[j + 3]);
          const gy = Math.abs(a[j] - a[(i - w) * 3]) + Math.abs(a[j] - a[(i + w) * 3]);
          if (gx + gy > 6) { edge[i] = 1; edge[i - 1] = 1; edge[i + 1] = 1;
                             edge[i - w] = 1; edge[i + w] = 1; }
        }
      }

      /* The largest connected run of real difference away from any edge. */
      const seen = new Uint8Array(w * h);
      let worst = 0, wx = 0, wy = 0;
      const stack = [];
      for (let i = 0; i < diff.length; i++) {
        if (seen[i] || edge[i] || diff[i] <= 8) continue;
        let n = 0; stack.length = 0; stack.push(i); seen[i] = 1;
        const sx = i % w, sy = (i / w) | 0;
        while (stack.length) {
          const k = stack.pop(); n++;
          const kx = k % w, ky = (k / w) | 0;
          for (let d = 0; d < 4; d++) {
            const nx = kx + (d === 0 ? 1 : d === 1 ? -1 : 0);
            const ny = ky + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const m = ny * w + nx;
            if (seen[m] || edge[m] || diff[m] <= 8) continue;
            seen[m] = 1; stack.push(m);
          }
        }
        if (n > worst) { worst = n; wx = sx; wy = sy; }
      }
      return { mean: +mean.toFixed(3), blob: worst, at: [wx, wy] };
    }

    /* --- what to test -----------------------------------------------------

       Every landmark art the game can generate, from every zone, drawn at its
       own projection — not a synthetic shape.

       THE PROJECTION HAS TO AGREE WITH THE FRAME. VF.space.project reads the
       layout VF.space.sync was last given, which is the real 1000×700 canvas;
       projecting into that and then drawing into a 320×220 probe put most of
       these shapes below the bottom edge, which is how fourteen of them came
       to be compared as two empty pictures. So the probe frame is synced
       first, and every case is then walked out to a distance where it draws. */
    const d = VF.state.data;
    const home = d.location;
    /* Distance, then size. A buoy at its own range is eight pixels of frame
       and eight pixels prove nothing, so the probe walks it in and then, if it
       is still small, simply makes it bigger — which is the same shape through
       the same code, drawn where it can be looked at. */
    const PROBES = [[null, 1], [0.45, 1], [0.30, 1], [0.18, 1], [0.10, 1],
                    [0.06, 1], [0.10, 2], [0.06, 3], [0.06, 6], [0.06, 14],
                    [0.06, 30]];
    /* Some of this art breathes: the far lights fade in and out on the world
       clock, and at the bottom of that breath one of them is genuinely
       invisible. The clock is therefore pinned — the same value for both
       renders, so nothing can tick between them — and walked forward if the
       shape happens to be pinned at its own low ebb. */
    const CLOCKS = [0, 5, 11, 17, 23];
    const cases = [], tested = {};

    VF.locations.list.forEach(function (zone) {
      d.location = zone.id;
      VF.landmarks.invalidate();
      const world = VF.landmarks.world();
      if (!world) return;
      const P = VF.palette.update();
      const L = Object.assign({}, VF.scene.L);
      L.w = W; L.h = H; L.horizonY = HY; L.waterH = H - HY;
      L.glowX = W * 0.5;
      VF.space.sync(L, P);
      const cam = { u: 0, zoom: 1, pitch: 0 };

      const seen = {};
      world.all.forEach(function (l) {
        if (seen[l.art] || tested[l.art]) return;
        seen[l.art] = 1;
        if (!VF.landmarkArt.ART[l.art]) return;
        /* Walk it out until it puts ink down, and keep the first range that
           does. A shape culled at its own distance is not a shape that
           matches — it is a shape nobody looked at. */
        let best = null;
        for (let ci = 0; ci < CLOCKS.length; ci++) {
        VF.state.rt.t = CLOCKS[ci];
        for (let k = 0; k < PROBES.length; k++) {
          const li = Object.assign({}, l);
          if (PROBES[k][0] !== null) li.d = PROBES[k][0];
          li.scale = (l.scale === undefined ? 1 : l.scale) * PROBES[k][1];
          const p = VF.space.project(li.u, li.d, cam);
          if (!p) continue;
          const q = Object.assign({}, p, { x: W * 0.5 });
          const c = { zone: zone.id, art: l.art, l: li, p: q, P: P, L: L,
                      t: CLOCKS[ci],
                      at: (PROBES[k][0] === null ? 'own' : String(PROBES[k][0])) +
                          (PROBES[k][1] === 1 ? '' : '×' + PROBES[k][1]) };
          let threw = null;
          const img = draw2d(function (g) {
            try { VF.landmarkArt.ART[l.art](g, c.l, c.p, c.P, c.L); }
            catch (e) { threw = e && e.message || String(e); }
          });
          c.threw = threw;
          c.ref = shrink(img);
          c.ink = ink(c.ref);
          if (!best || c.ink > best.ink) best = c;
          if (threw || c.ink >= MIN_INK) break;
        }
        if (best && (best.threw || best.ink >= MIN_INK)) break;
        }
        if (best) { tested[l.art] = 1; cases.push(best); }
      });
    });

    Object.keys(VF.landmarkArt.ART).forEach(function (k) {
      if (!tested[k]) out.missing.push(k);
    });

    /* --- run them ----------------------------------------------------------

       BOTH renders happen here, back to back, under a state put back exactly
       as the probe found it. The colour of a landmark runs through
       VF.space.airMix, which reads the air density of whatever zone was synced
       last — so a reference drawn inside the zone loop and a GL render taken
       after it are two different atmospheres, and every shape comes out the
       right shape in slightly the wrong colour. Which is what a real port
       regression looks like, and cost an afternoon. */
    for (let i = 0; i < cases.length; i++) {
      const c = cases[i];
      const fn = VF.landmarkArt.ART[c.art];
      d.location = c.zone;
      VF.space.sync(c.L, c.P);
      VF.state.rt.t = c.t;

      let threwRef = c.threw, threwGl = null;
      const ref2d = draw2d(function (g) {
        try { fn(g, c.l, c.p, c.P, c.L); }
        catch (e) { threwRef = e && e.message || String(e); }
      });
      const call = function (g) {
        try { fn(g, c.l, c.p, c.P, c.L); }
        catch (e) { threwGl = e && e.message || String(e); }
      };
      const b = drawGl(call);
      c.ref = shrink(ref2d);
      c.ink = ink(c.ref);
      const row = { zone: c.zone, art: c.art, at: c.at, ink: c.ink,
                    mean: 0, blob: 0, atPx: [0, 0], missed: [], bad: false };

      if (threwRef) { c.threw = threwRef; }
      if (c.threw) {
        row.bad = true;
        out.fail.push(c.art + ': the Canvas 2D reference threw — ' + c.threw);
        out.rows.push(row); continue;
      }
      if (c.ink < MIN_INK) {
        row.bad = true;
        out.fail.push(c.art + ': puts no ink on the frame at any range (' +
                      c.ink + ' px) — nothing was actually compared');
        out.rows.push(row); continue;
      }
      if (!b) {
        row.bad = true;
        out.fail.push(c.art + ': the GL render did not happen');
        out.rows.push(row); continue;
      }
      if (threwGl) {
        row.bad = true;
        out.fail.push(c.art + ': the GL render threw — ' + threwGl);
        out.rows.push(row); continue;
      }

      const A = c.ref, B = shrink(b);
      const cmp = compare(A, B);
      row.mean = cmp.mean; row.blob = cmp.blob; row.atPx = cmp.at;
      row.missed = Object.keys(b.missed);
      row.bad = !!row.missed.length || cmp.mean > 1.5 || cmp.blob > 12;

      /* A failure gets a picture: the two renders and the difference between
         them, side by side, because a number tells you that something moved
         and only the sheet tells you what. */
      if (row.bad) {
        const sheet = document.createElement('canvas');
        sheet.width = W * 3 + 24; sheet.height = H + 26;
        const sg = sheet.getContext('2d');
        sg.fillStyle = '#111'; sg.fillRect(0, 0, sheet.width, sheet.height);
        sg.fillStyle = '#cfd8e4';
        sg.font = '11px ui-monospace, monospace';
        ['canvas 2d', 'webgl', 'difference ×8'].forEach(function (t, k) {
          sg.fillText(t, 8 + k * (W + 12), 15);
        });
        const im = sg.createImageData(W, H);
        function blit(src, ox, mul) {
          for (let k = 0; k < W * H; k++) {
            im.data[k * 4] = Math.min(255, src[k * 3] * (mul || 1));
            im.data[k * 4 + 1] = Math.min(255, src[k * 3 + 1] * (mul || 1));
            im.data[k * 4 + 2] = Math.min(255, src[k * 3 + 2] * (mul || 1));
            im.data[k * 4 + 3] = 255;
          }
          sg.putImageData(im, ox, 22);
        }
        blit(A, 8);
        blit(B, 8 + W + 12);
        const D = new Float32Array(W * H * 3);
        for (let k = 0; k < W * H * 3; k++) D[k] = Math.abs(A[k] - B[k]);
        blit(D, 8 + (W + 12) * 2, 8);
        row.sheet = sheet.toDataURL('image/png');
      }

      out.rows.push(row);
      if (row.missed.length) out.fail.push(c.art + ': fell back — ' + row.missed.join(', '));
      else if (cmp.mean > 1.5) out.fail.push(c.art + ': mean difference ' + cmp.mean + '/255');
      else if (cmp.blob > 12) out.fail.push(c.art + ': a ' + cmp.blob +
        '-pixel region differs at ' + cmp.at.join(','));
    }

    d.location = home;
    VF.landmarks.invalidate();
    return out;
  });

  (r.rows || []).forEach(x => {
    if (x.sheet) {
      fs.writeFileSync(path.join(OUT, x.zone + '-' + x.art + '.png'),
                       Buffer.from(x.sheet.split(',')[1], 'base64'));
    }
  });
  (r.rows || []).forEach(x => {
    console.log('  ' + (x.bad ? 'FAIL' : 'ok  ') + '  ' + (x.zone + '/' + x.art).padEnd(22) +
      'ink ' + String(x.ink).padStart(6) + '   mean ' + String(x.mean).padStart(6) +
      '   blob ' + String(x.blob).padStart(5) + '   at d=' + x.at +
      (x.missed && x.missed.length ? '   fell back: ' + x.missed.join(', ') : ''));
  });
  if (r.missing && r.missing.length) {
    console.log('\n  no zone generates: ' + r.missing.join(', ') +
                ' — unverified, so unported');
  }
  (r.fail || []).forEach(f => fail.push(f));
  if (errors.length) fail.push('page errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));

  console.log('');
  if (fail.length) { console.log('FAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('every ported shape draws, and draws the same on the GPU as it did on the CPU');
  await browser.close();
  process.exitCode = fail.length ? 1 : 0;
})();
