/* Contact sheets. One flat-black, which is the test that matters, and one in
   colour. `node tools/rodsheet.js [silhouette|colour] [firstIndex] [count]` */
const { chromium } = require('playwright');
const path = require('path');
const out = process.env.SHEET_OUT || path.join(__dirname);
(async () => {
  const mode = process.argv[2] || 'silhouette';
  const first = Number(process.argv[3] || 0);
  const count = Number(process.argv[4] || 32);
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  const png = await page.evaluate(({ mode, first, count }) => {
    const COLS = 4, CW = 330, CH = 150, LAB = 20;
    const rods = VF.rods.list.filter(r => !r.admin).slice(first, first + count);
    const rows = Math.ceil(rods.length / COLS);
    const c = document.createElement('canvas');
    c.width = COLS * CW; c.height = rows * (CH + LAB);
    const g = c.getContext('2d');
    g.fillStyle = mode === 'silhouette' ? '#e9eef4' : '#0b1018';
    g.fillRect(0, 0, c.width, c.height);
    rods.forEach((rod, i) => {
      const x = (i % COLS) * CW, y = Math.floor(i / COLS) * (CH + LAB);
      g.save();
      g.translate(x, y);
      let r = rod;
      if (mode === 'silhouette') {
        r = { id: rod.id, name: rod.name, cast: rod.cast, reel: rod.reel, line: rod.line,
              rare: rod.rare, luck: rod.luck,
              art: { c1: '#101418', c2: '#101418', grip: '#101418', tip: '#101418',
                     metal: '#101418', stone: '#101418',
                     len: rod.art.len, curve: rod.art.curve, glow: 0, style: 'plain' } };
      }
      VF.rodArt.preview(g, r, CW, CH, 0);
      g.restore();
      g.fillStyle = mode === 'silhouette' ? '#37414c' : '#8fa4b6';
      g.font = '12px ui-sans-serif, sans-serif';
      g.fillText(rod.name + '   [' + VF.rodFrame.frameId(rod) + ']', x + 10, y + CH + 14);
    });
    return c.toDataURL('image/png');
  }, { mode, first, count });

  const fs = require('fs');
  fs.writeFileSync(path.join(out, 'rodsheet-' + mode + '-' + first + '.png'),
                   Buffer.from(png.split(',')[1], 'base64'));
  console.log('wrote rodsheet-' + mode + '-' + first + '.png', 'errors:', errors.length);
  errors.slice(0, 5).forEach(e => console.log('  !', e));
  await browser.close();
})();
