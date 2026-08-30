/* The GPU path, and the promise that losing it costs nothing.

   Three things, and the third is the one that matters most: every shader has
   to build, the water has to actually put light on the water, and the game has
   to render correctly with WebGL2 taken away — because a renderer that only
   works when the hardware cooperates is a renderer that does not work.

     node tools/gl.js
*/
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fail = [];

  /* ---------------------------------------------------- with the GPU */
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  const on = await page.evaluate(() => {
    const out = { caps: {}, zones: {} };
    out.available = !!(VF.gl && VF.gl.ok());
    if (!out.available) return out;
    out.caps = { float: VF.gl.caps.float, floatLinear: VF.gl.caps.floatLinear,
                 maxTex: VF.gl.caps.maxTex };
    out.worldOk = VF.glWorld.ok();

    /* Draw and read back, inside the same turn — with preserveDrawingBuffer
       off the buffer is gone by the next task, and reading it later returns
       a screenful of zeros that looks exactly like a shader that did nothing. */
    function sample(zone) {
      VF.state.data.location = zone;
      VF.bus.emit('location:changed', zone);
      VF.weather.force('clear');
      for (let i = 0; i < 40; i++) VF.weather.tick(0.5);
      for (let i = 0; i < 20; i++) { VF.palette.update(); VF.scene.update(0.033); }
      VF.scene.draw();
      const gl = VF.gl.ctx();
      const s = VF.gl.size();
      const w = Math.round(s.w * s.dpr), h = Math.round(s.h * s.dpr);
      const hy = VF.scene.L.horizonY / VF.scene.L.h;
      const row = new Uint8Array(w * 4);
      function scan(frac) {
        gl.readPixels(0, Math.round((1 - frac) * h), w, 1, gl.RGBA, gl.UNSIGNED_BYTE, row);
        let min = 255, max = 0, sum = 0;
        for (let i = 0; i < w; i++) {
          const g = (row[i * 4] + row[i * 4 + 1] + row[i * 4 + 2]) / 3;
          if (g < min) min = g; if (g > max) max = g; sum += g;
        }
        return { min: Math.round(min), max: Math.round(max),
                 mean: Math.round(sum / w), range: Math.round(max - min) };
      }
      return { sky: scan(0.22), far: scan(hy + 0.05), near: scan(0.90) };
    }

    ['shore', 'trench', 'basin'].forEach(z => { out.zones[z] = sample(z); });
    return out;
  });

  if (!on.available) {
    console.log('WebGL2 unavailable in this browser — the 2D path is all there is here');
  } else {
    console.log('caps: ' + JSON.stringify(on.caps));
    Object.keys(on.zones).forEach(z => {
      const s = on.zones[z];
      console.log('  ' + z.padEnd(8) +
        'sky ' + String(s.sky.mean).padStart(3) +
        '   far water ' + String(s.far.mean).padStart(3) + ' ±' + String(s.far.range).padStart(3) +
        '   near water ' + String(s.near.mean).padStart(3) + ' ±' + String(s.near.range).padStart(3));
    });
    if (!on.worldOk) fail.push('the world shader did not build');
    /* The water has to have STRUCTURE in it, not just a colour. A flat scanline
       is the signature of a shader that compiled, ran, and drew a gradient —
       which is what a broken normal, a dead specular or an upside-down uv all
       look like, and none of them throw. */
    Object.keys(on.zones).forEach(z => {
      const s = on.zones[z];
      if (s.near.range < 8) fail.push(z + ': the near water is flat (range ' + s.near.range + ')');
      if (s.near.mean < 2) fail.push(z + ': the water is black — nothing was drawn');
    });
  }
  if (errors.length) fail.push('page errors: ' + errors.slice(0, 3).join(' | '));
  await page.close();

  /* ------------------------------------------------- and without it */
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const err2 = [];
  page2.on('pageerror', e => err2.push(e.message));
  page2.on('console', m => { if (m.type() === 'error') err2.push(m.text()); });
  /* Refuse the context before any of the game's code runs, which is the honest
     version of "this machine has no WebGL2". */
  await page2.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, attrs) {
      if (type === 'webgl2' || type === 'webgl') return null;
      return real.call(this, type, attrs);
    };
  });
  await page2.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page2.waitForTimeout(500);
  await page2.click('#bootStart');
  await page2.waitForTimeout(700);

  const off = await page2.evaluate(() => {
    const cv = document.getElementById('scene');
    const g = cv.getContext('2d');
    const d = g.getImageData(0, Math.round(cv.height * 0.8), cv.width, 1).data;
    let min = 255, max = 0, sum = 0;
    for (let i = 0; i < cv.width; i++) {
      const v = (d[i * 4] + d[i * 4 + 1] + d[i * 4 + 2]) / 3;
      if (v < min) min = v; if (v > max) max = v; sum += v;
    }
    return { glOff: !(VF.gl && VF.gl.ok()),
             mean: Math.round(sum / cv.width), range: Math.round(max - min),
             casts: VF.fishing.state() };
  });

  console.log('\nwith WebGL2 refused: gl off ' + off.glOff +
              ', 2D water mean ' + off.mean + ' ±' + off.range);
  if (!off.glOff) fail.push('WebGL2 was refused and the game still thinks it has it');
  if (off.mean < 2) fail.push('the 2D fallback drew nothing');
  if (off.range < 4) fail.push('the 2D fallback water is flat');
  if (err2.length) fail.push('fallback page errors: ' + err2.slice(0, 3).join(' | '));
  await page2.close();

  if (fail.length) { console.log('\nFAIL:'); fail.forEach(f => console.log('  ' + f)); }
  else console.log('\nthe GPU draws water, and taking it away costs nothing');
  await browser.close();
  process.exitCode = fail.length ? 1 : 0;
})();
