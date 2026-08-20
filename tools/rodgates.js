/* Each late rod must state the right reason it is not for sale yet. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(300);
  await page.click('#bootStart');
  await page.waitForTimeout(250);

  const cases = [
    ['level 99, nothing else',      { lv: 99, voids: 0, glitch: 0, secret: false }],
    ['+ a void catch',              { lv: 99, voids: 1, glitch: 0, secret: false }],
    ['+ a glitch catch',            { lv: 99, voids: 1, glitch: 1, secret: false }],
    ['+ the last water',            { lv: 99, voids: 1, glitch: 1, secret: true }]
  ];
  for (const [label, c] of cases) {
    const out = await page.evaluate((c) => {
      const d = VF.state.data;
      d.level = c.lv; d.money = 5e11;
      d.stats.voidCatches = c.voids; d.stats.glitchCatches = c.glitch;
      d.secrets = c.secret ? { the_last_water: Date.now() } : {};
      d.ownedRods = ['wood'];
      return ['eclipse', 'origin', 'everything'].map(function (id) {
        const r = VF.economy.buyRod(id);
        if (r.ok) { d.ownedRods = ['wood']; d.money = 5e11; }
        return id + ':' + (r.ok ? 'BUYABLE' : r.why);
      }).join('  ');
    }, c);
    console.log(label.padEnd(24), out);
  }
  console.log('\nerrors: ' + errs.length);
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})();
