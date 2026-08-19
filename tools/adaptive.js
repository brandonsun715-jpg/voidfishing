/* Does the scene step its own quality down when the machine cannot keep up,
   and leave it alone when it can? */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errs = [];
  for (const [name, w, h] of [['huge', 2400, 1400], ['small', 700, 420]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', e => errs.push(name + ' PAGEERROR ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push(name + ' ' + m.text()); });
    await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
    await page.waitForTimeout(300);
    await page.click('#bootStart');
    await page.evaluate(() => { VF.state.data.settings.quality = 'high';
                                document.body.className = 'q-high'; VF.scene.resize(); });
    await page.waitForTimeout(15000);
    const q = await page.evaluate(() => VF.state.data.settings.quality);
    console.log(name.padEnd(6), w + 'x' + h, '-> quality:', q);
    await page.close();
  }
  console.log('\nerrors: ' + errs.length);
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})();
