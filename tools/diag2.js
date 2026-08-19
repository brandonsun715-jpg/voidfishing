const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#bootStart');
  await page.waitForTimeout(600);
  for (let i = 0; i < 4; i++) {
    await page.evaluate(i => { VF.state.data.location = ['shore','basin','flats','trench'][i];
      VF.bus.emit('location:changed'); VF.scene.rebuild(); }, i);
    await page.waitForTimeout(900);
    await page.screenshot({ path: 'tools/diag2-' + i + '.png' });
    const box = await page.evaluate(() => {
      const b = document.getElementById('actionBtn').getBoundingClientRect();
      return [Math.round(b.x), Math.round(b.y)];
    });
    console.log('shot', i, 'actionBtn at', box.join(','));
  }
  await browser.close();
})();
