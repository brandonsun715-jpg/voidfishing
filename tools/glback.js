/* The back of the frame, drawn twice, and whether you could tell.

   tools/glpath.js compares one art function at a time. This compares the
   STAGE SET: the stars, the clouds, the horizon feature, the land and the
   landmarks standing at or beyond it, all of it at full frame size, in every
   zone, at two times of day — the same code js/render/scene.js runs, reached
   through VF.scene.drawBack so there is no second copy of the list to drift.

   The bar is the one tools/glpath.js sets and for the same reasons: rendered
   at device resolution, mean absolute difference under 1.5/255, no connected
   region away from an antialiased edge larger than 40 pixels differing by
   more than 8/255 — larger than the per-shape budget because this is a whole
   frame of overlapping art rather than one silhouette, and a hundredth of the
   smallest thing in it that would actually read.

   It also asserts the two things that make the port safe rather than merely
   correct: that every zone puts real ink on the frame, and that js/gl/back.js
   has not quietly turned itself off, which is what it does the moment any
   stage asks for something the GPU path does not have.

     node tools/glback.js          writes tools/sc-gl/back-*.png for failures
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'sc-gl');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  await page.evaluate(() => {
    const d = VF.state.data;
    d.level = 90; d.money = 5e8;
    d.unlockedLocations = VF.locations.list.map(l => l.id);
    VF.hud.refreshAll();
  });

  const fail = [];
  const r = await page.evaluate(async () => {
    const out = { rows: [], fail: [] };
    if (!VF.glBack) { out.fail.push('js/gl/back.js is not loaded'); return out; }
    if (!VF.glBack.ok()) {
      /* It turns itself off the first time a stage asks the GPU path for
         something it has not got, and the game has already drawn frames by
         now — so what it could not do is the finding, not that it is off. */
      out.fail.push('js/gl/back.js turned itself off: ' +
                    JSON.stringify(VF.glBack.missed()) +
                    ' (glPath ' + (VF.glPath && VF.glPath.ok()) + ')');
      return out;
    }

    const L = VF.scene.L;
    const gl = VF.gl.ctx();
    const size = VF.gl.size();
    const dpr = size.dpr || 1;
    const W = Math.round(size.w * dpr), H = Math.round(size.h * dpr);
    const GROUND = 64;

    function ref2d(P, q) {
      const c = document.createElement('canvas');
      c.width = W; c.height = H;
      const g = c.getContext('2d');
      g.fillStyle = '#404040'; g.fillRect(0, 0, W, H);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      VF.scene.drawBack(g, P, q);
      g.setTransform(1, 0, 0, 1, 0, 0);
      return g.getImageData(0, 0, W, H).data;
    }
    function gpu(P, q) {
      const t = VF.glBack.build(L, P, function (g) { VF.scene.drawBack(g, P, q); },
                                [GROUND / 255, GROUND / 255, GROUND / 255]);
      if (!t) return null;
      const px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const row = W * 4, flip = new Uint8Array(px.length);
      for (let y = 0; y < H; y++) flip.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      return flip;
    }

    function ink(a) {
      let n = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (Math.abs(a[i] - GROUND) >= 4 || Math.abs(a[i + 1] - GROUND) >= 4 ||
            Math.abs(a[i + 2] - GROUND) >= 4) n++;
      }
      return n;
    }

    function compare(a, b) {
      const n = W * H;
      const diff = new Float32Array(n);
      let sum = 0;
      for (let i = 0, j = 0; i < n; i++, j += 4) {
        const d = (Math.abs(a[j] - b[j]) + Math.abs(a[j + 1] - b[j + 1]) +
                   Math.abs(a[j + 2] - b[j + 2])) / 3;
        diff[i] = d; sum += d;
      }
      const mean = sum / n;
      const edge = new Uint8Array(n);
      for (let y = 1; y < H - 1; y++) {
        for (let x = 1; x < W - 1; x++) {
          const i = y * W + x, j = i * 4;
          const gx = Math.abs(a[j] - a[j - 4]) + Math.abs(a[j] - a[j + 4]);
          const gy = Math.abs(a[j] - a[(i - W) * 4]) + Math.abs(a[j] - a[(i + W) * 4]);
          if (gx + gy > 6) { edge[i] = 1; edge[i - 1] = 1; edge[i + 1] = 1;
                             edge[i - W] = 1; edge[i + W] = 1; }
        }
      }
      const seen = new Uint8Array(n);
      let worst = 0, wx = 0, wy = 0;
      const stack = [];
      for (let i = 0; i < n; i++) {
        if (seen[i] || edge[i] || diff[i] <= 8) continue;
        let c = 0; stack.length = 0; stack.push(i); seen[i] = 1;
        const sx = i % W, sy = (i / W) | 0;
        while (stack.length) {
          const k = stack.pop(); c++;
          const kx = k % W, ky = (k / W) | 0;
          for (let d = 0; d < 4; d++) {
            const nx = kx + (d === 0 ? 1 : d === 1 ? -1 : 0);
            const ny = ky + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const m = ny * W + nx;
            if (seen[m] || edge[m] || diff[m] <= 8) continue;
            seen[m] = 1; stack.push(m);
          }
        }
        if (c > worst) { worst = c; wx = sx; wy = sy; }
      }
      return { mean: +mean.toFixed(3), blob: worst, at: [wx, wy] };
    }

    const TIMES = [['night', 0.80], ['day', 0.34]];
    const q = VF.state.data.settings.quality;

    for (const zone of VF.locations.list) {
      for (const tm of TIMES) {
        VF.state.data.location = zone.id;
        VF.loot.invalidatePool();
        VF.bus.emit('location:changed', zone.id);
        VF.scene.rebuild();
        if (VF.zoneArt) VF.zoneArt.invalidate();
        VF.time.setCycle(tm[1]);
        VF.weather.force('clear');
        for (let i = 0; i < 40; i++) VF.weather.tick(0.5);
        for (let i = 0; i < 90; i++) { VF.palette.update(); VF.scene.update(0.033); }
        const P = VF.palette.update();
        VF.space.sync(L, P);
        VF.state.rt.t = 11;

        const A = ref2d(P, q);
        VF.state.rt.t = 11;
        const B = gpu(P, q);
        const row = { zone: zone.id, time: tm[0], ink: ink(A), mean: 0, blob: 0,
                      at: [0, 0], bad: false };
        if (!B) {
          row.bad = true;
          out.fail.push(zone.id + '/' + tm[0] + ': the GPU back stages refused — ' +
                        JSON.stringify(VF.glBack.missed()));
          out.rows.push(row); continue;
        }
        if (row.ink < 2000) {
          row.bad = true;
          out.fail.push(zone.id + '/' + tm[0] + ': the back of the frame is empty (' +
                        row.ink + ' px) — nothing was compared');
          out.rows.push(row); continue;
        }
        const cmp = compare(A, B);
        row.mean = cmp.mean; row.blob = cmp.blob; row.at = cmp.at;
        row.bad = cmp.mean > 1.5 || cmp.blob > 40;
        if (row.bad) {
          const sw = Math.round(W / dpr / 2), sh = Math.round(H / dpr / 2);
          const sheet = document.createElement('canvas');
          sheet.width = sw * 3 + 24; sheet.height = sh + 26;
          const sg = sheet.getContext('2d');
          sg.fillStyle = '#111'; sg.fillRect(0, 0, sheet.width, sheet.height);
          sg.fillStyle = '#cfd8e4'; sg.font = '11px ui-monospace, monospace';
          ['canvas 2d', 'webgl', 'difference ×8'].forEach(function (t2, k) {
            sg.fillText(t2, 8 + k * (sw + 12), 15);
          });
          function blit(src, ox, mul) {
            const c2 = document.createElement('canvas');
            c2.width = W; c2.height = H;
            const g2 = c2.getContext('2d');
            const im = g2.createImageData(W, H);
            for (let k = 0; k < W * H * 4; k += 4) {
              im.data[k] = Math.min(255, src[k] * (mul || 1));
              im.data[k + 1] = Math.min(255, src[k + 1] * (mul || 1));
              im.data[k + 2] = Math.min(255, src[k + 2] * (mul || 1));
              im.data[k + 3] = 255;
            }
            g2.putImageData(im, 0, 0);
            sg.drawImage(c2, ox, 22, sw, sh);
          }
          blit(A, 8);
          blit(B, 8 + sw + 12);
          const D = new Uint8Array(W * H * 4);
          for (let k = 0; k < W * H * 4; k++) D[k] = Math.abs(A[k] - B[k]);
          blit(D, 8 + (sw + 12) * 2, 8);
          row.sheet = sheet.toDataURL('image/png');
          out.fail.push(zone.id + '/' + tm[0] + ': mean ' + cmp.mean +
                        ', a ' + cmp.blob + '-pixel region at ' + cmp.at.join(','));
        }
        out.rows.push(row);
      }
    }
    /* And that the renderer actually takes this path in a real frame. Every
       comparison above would pass just as well on a branch nothing enters. */
    const before = VF.glBack.built();
    VF.scene.draw();
    out.built = VF.glBack.built() - before;
    if (out.built < 1) {
      out.fail.push('js/render/scene.js drew a frame without going through the ' +
                    'GPU back stages — the ported path is not the live one');
    }
    out.missed = VF.glBack.missed();
    return out;
  });

  (r.rows || []).forEach(x => {
    if (x.sheet) {
      fs.writeFileSync(path.join(OUT, 'back-' + x.zone + '-' + x.time + '.png'),
                       Buffer.from(x.sheet.split(',')[1], 'base64'));
    }
    console.log('  ' + (x.bad ? 'FAIL' : 'ok  ') + '  ' + (x.zone + '/' + x.time).padEnd(20) +
      'ink ' + String(x.ink).padStart(7) + '   mean ' + String(x.mean).padStart(6) +
      '   blob ' + String(x.blob).padStart(6));
  });
  if (r.missed) console.log('\n  the GPU path could not: ' + JSON.stringify(r.missed));
  if (r.built !== undefined) console.log('  a live frame took the GPU back path: ' + (r.built >= 1));
  (r.fail || []).forEach(f => fail.push(f));
  if (errors.length) fail.push('page errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));

  console.log('');
  if (fail.length) { console.log('FAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('the back of the frame is the same picture on the GPU as on the CPU');
  await browser.close();
  process.exitCode = fail.length ? 1 : 0;
})();
