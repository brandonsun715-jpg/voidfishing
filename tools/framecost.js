/* What a whole frame costs, over the real loop.

   tools/perf.js breaks down the CANVAS 2D stages, which is the wrong half for
   any question about the sky: the world pass is one GPU draw and shows up
   there as a rounding error however expensive its fragment shader gets. This
   runs the actual animation loop and times the interval between frames, which
   catches everything including the shader.

   Headless GL here is SwiftShader, so it renders the fragment shader on the
   CPU and the absolute milliseconds mean nothing at all. What it is good for
   is exactly one thing: running the same loop before and after a change to
   the shader and comparing. Being CPU-bound on fragment work is a feature for
   that — it magnifies precisely what is under test.

     node tools/framecost.js                 clear and overcast, three qualities
     node tools/framecost.js shore clear     one zone, one weather

   Weather matters more than it looks: the cloud deck's coverage cull means a
   clear sky and an overcast one take very different paths through the shader,
   and a change can easily improve one while making the other worse. */
const { chromium } = require('playwright');
const path = require('path');

const ZONE = process.argv[2] || 'shore';
const WX = (process.argv[3] || 'clear,overcast').split(',');
const QUAL = (process.argv[4] || 'low,medium,high').split(',');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(450);
  await page.click('#bootStart');
  await page.waitForTimeout(600);
  await page.evaluate(() => document.body.classList.add('cinema'));

  console.log('  ' + ZONE + ', midday — SwiftShader, so read the columns against each other');
  for (const wx of WX) {
    for (const q of QUAL) {
      const r = await page.evaluate(async (a) => {
        const [zone, wx, q] = a;
        VF.state.data.settings.quality = q;
        VF.bus.emit('settings:quality', q);
        VF.state.data.location = zone;
        VF.bus.emit('location:changed', zone);
        VF.scene.rebuild();
        VF.time.setCycle(0.34);
        VF.weather.force(wx);
        for (let i = 0; i < 40; i++) VF.weather.tick(0.5);
        const frame = () => new Promise(res => requestAnimationFrame(res));
        for (let i = 0; i < 20; i++) await frame();     // settle the bakes, warm the pipeline
        const t = [];
        let last = performance.now();
        for (let i = 0; i < 60; i++) {
          await frame();
          const now = performance.now();
          t.push(now - last); last = now;
        }
        t.sort((x, y) => x - y);
        /* Median and the tenth percentile: the median is the honest figure and
           the tenth is what the frame costs when nothing else is in the way,
           which is the one that moves when a shader gets cheaper. */
        return { med: t[t.length >> 1], best: t[Math.floor(t.length * 0.1)] };
      }, [ZONE, wx, q]);
      console.log('  ' + wx.padEnd(10) + q.padEnd(8) +
                  'median ' + r.med.toFixed(1).padStart(6) + ' ms' +
                  '   best ' + r.best.toFixed(1).padStart(6) + ' ms');
    }
  }
  console.log('  page errors:', errors.length ? errors.slice(0, 3) : 'none');
  await browser.close();
  process.exitCode = errors.length ? 1 : 0;
})();
