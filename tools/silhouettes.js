/* The test the redesign has to pass: every rod, drawn as a flat black shape
   with no colour, no glow and no effects on it at all. If two of these look
   like the same object then they ARE the same object with a different skin,
   which is the whole thing this was meant to stop.

     node tools/silhouettes.js [rows]

   Writes tools/silhouettes.png and, more usefully, prints how many distinct
   shapes there are — measured rather than eyeballed. Each rod is rendered to
   an offscreen canvas, reduced to a coarse occupancy grid, and compared with
   every other; two rods whose grids agree above the threshold are the same
   silhouette and are named. */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n')[1]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(400);
  await page.click('#bootStart');
  await page.waitForTimeout(500);

  const res = await page.evaluate(() => {
    const CW = 300, CH = 130;          // one rod
    const GX = 40, GY = 20;            // the occupancy grid it reduces to
    const rods = VF.rods.list.filter(r => !r.admin);

    function silhouette(rod) {
      const c = document.createElement('canvas');
      c.width = CW; c.height = CH;
      const g = c.getContext('2d');
      /* Flat black: every colour on the rod is forced to the same one, so what
         is left on the canvas is only its shape. */
      const flat = { c1: '#000000', c2: '#000000', grip: '#000000', tip: '#000000',
                     metal: '#000000', stone: '#000000',
                     len: rod.art.len, curve: rod.art.curve, glow: 0, style: 'plain' };
      const stub = { id: rod.id, name: rod.name, art: flat,
                     cast: rod.cast, reel: rod.reel, line: rod.line,
                     rare: rod.rare, luck: rod.luck, admin: rod.admin };
      VF.rodArt.preview(g, stub, CW, CH, 0);
      const px = g.getImageData(0, 0, CW, CH).data;
      const grid = new Uint8Array(GX * GY);
      for (let gy = 0; gy < GY; gy++) {
        for (let gx = 0; gx < GX; gx++) {
          let hit = 0;
          const x0 = Math.floor(gx * CW / GX), x1 = Math.floor((gx + 1) * CW / GX);
          const y0 = Math.floor(gy * CH / GY), y1 = Math.floor((gy + 1) * CH / GY);
          for (let y = y0; y < y1; y += 2) {
            for (let x = x0; x < x1; x += 2) {
              if (px[(y * CW + x) * 4 + 3] > 40) { hit++; }
            }
          }
          // a cell counts as filled if a sixteenth of it is — a guide ring is
      // thin, and a guide ring is a third of what a rod's outline is
          grid[gy * GX + gx] = hit > ((x1 - x0) * (y1 - y0) / 4) * 0.06 ? 1 : 0;
        }
      }
      return grid;
    }

    const grids = rods.map(silhouette);
    const frames = {};
    rods.forEach(r => {
      const f = VF.rodFrame.frameId(r);
      frames[f] = (frames[f] | 0) + 1;
    });

    /* Two rods are "the same silhouette" if their SHAPES overlap, measured as
       intersection over union of the filled cells.

       Counting agreeing cells was the obvious metric and it is worthless here:
       a rod is a thin diagonal line across a wide box, so two completely
       different rods already agree on ninety per cent of the grid by both
       being mostly empty. Only the filled cells carry any information, so only
       they are compared. 0.86 is the threshold — at that overlap two shapes
       are the same object drawn slightly differently. */
    const SAME = 0.86;
    const pairs = [];
    for (let i = 0; i < grids.length; i++) {
      for (let j = i + 1; j < grids.length; j++) {
        let both = 0, either = 0;
        for (let k = 0; k < grids[i].length; k++) {
          if (grids[i][k] || grids[j][k]) either++;
          if (grids[i][k] && grids[j][k]) both++;
        }
        const agree = either ? both / either : 1;
        if (agree > SAME) pairs.push({ a: rods[i].name, b: rods[j].name, agree: +agree.toFixed(3) });
      }
    }
    // how many rods are in at least one colliding pair
    const collided = {};
    pairs.forEach(p => { collided[p.a] = 1; collided[p.b] = 1; });
    return {
      rods: rods.length,
      frames: frames,
      pairs: pairs.sort((x, y) => y.agree - x.agree).slice(0, 25),
      pairCount: pairs.length,
      distinct: rods.length - Object.keys(collided).length,
      pct: +((rods.length - Object.keys(collided).length) / rods.length * 100).toFixed(1)
    };
  });

  console.log('rods:', res.rods);
  console.log('frames in use:', JSON.stringify(res.frames));
  console.log('colliding pairs:', res.pairCount);
  res.pairs.forEach(p => console.log('   ' + p.agree + '  ' + p.a + '  ~  ' + p.b));
  console.log('\nrods with a silhouette nothing else shares: ' + res.distinct +
              ' / ' + res.rods + '  (' + res.pct + '%)');
  console.log('errors:', errors.length);
  errors.slice(0, 6).forEach(e => console.log('  !', e));
  await browser.close();
  process.exit(res.pct >= 80 && !errors.length ? 0 : 1);
})();
