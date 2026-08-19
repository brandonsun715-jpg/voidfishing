const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#bootStart');
  await page.waitForTimeout(600);
  async function fps(setup, label) {
    const r = await page.evaluate(async (setup) => {
      eval(setup);
      await new Promise(r => setTimeout(r, 350));
      const t0 = performance.now(); let n = 0;
      await new Promise(res => { (function c(){ n++; if (performance.now()-t0 < 2500) requestAnimationFrame(c); else res(); })(); });
      return +(n/2.5).toFixed(1);
    }, setup);
    console.log(label.padEnd(34), r, 'fps');
  }
  await fps("0", 'baseline (high)');
  // patch out suspects one at a time via a CanvasRenderingContext2D shim
  await fps(`window.__gco = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype,'globalCompositeOperation');
             Object.defineProperty(CanvasRenderingContext2D.prototype,'globalCompositeOperation',{set(){},get(){return 'source-over'}});`,
            'no blend modes');
  await fps("Object.defineProperty(CanvasRenderingContext2D.prototype,'globalCompositeOperation', window.__gco);", 'blend modes restored');
  await fps(`window.__ci = CanvasRenderingContext2D.prototype.createRadialGradient;
             CanvasRenderingContext2D.prototype.createRadialGradient = function(){ const g=window.__ci.call(this,0,0,0,0,0,1); return g; };`,
            'radial gradients neutered');
  await fps("CanvasRenderingContext2D.prototype.createRadialGradient = window.__ci;", 'radial restored');
  await fps(`window.__di = CanvasRenderingContext2D.prototype.drawImage;
             CanvasRenderingContext2D.prototype.drawImage = function(){};`, 'no drawImage (grain+land+refl)');
  await fps("CanvasRenderingContext2D.prototype.drawImage = window.__di;", 'drawImage restored');
  await fps(`window.__fr = CanvasRenderingContext2D.prototype.fillRect;
             CanvasRenderingContext2D.prototype.fillRect = function(){};`, 'no fillRect');
  await fps("CanvasRenderingContext2D.prototype.fillRect = window.__fr;", 'fillRect restored');
  await fps(`window.__st = CanvasRenderingContext2D.prototype.stroke;
             CanvasRenderingContext2D.prototype.stroke = function(){};`, 'no stroke (wave lines)');
  await fps("CanvasRenderingContext2D.prototype.stroke = window.__st;", 'stroke restored');
  await browser.close();
})();
