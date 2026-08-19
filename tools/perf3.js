const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400); await page.click('#bootStart'); await page.waitForTimeout(600);
  async function fps(setup, label) {
    const r = await page.evaluate(async (setup) => {
      eval(setup); await new Promise(r => setTimeout(r, 300));
      const t0 = performance.now(); let n = 0;
      await new Promise(res => { (function c(){ n++; if (performance.now()-t0 < 2500) requestAnimationFrame(c); else res(); })(); });
      return +(n/2.5).toFixed(1);
    }, setup);
    console.log(label.padEnd(30), r, 'fps');
  }
  await fps("0", 'current (high)');
  await fps("window.__d = VF.scene.draw; VF.scene.draw = function(){};", 'ceiling: no scene draw at all');
  await fps("VF.scene.draw = window.__d;", 'restored');
  await fps("VF.state.data.settings.quality='medium';VF.scene.resize();VF.bus.emit('settings:quality');", 'medium');
  await fps("VF.state.data.settings.quality='high';VF.scene.resize();VF.bus.emit('settings:quality');", 'high again');
  await browser.close();
})();
