/* The last tier, checked.

   Eight subjects, none of which is drawn by the fish renderer and none of
   which shares code with any other. That is the whole claim the tier makes,
   so it is the thing worth testing: every one renders, every one puts ink on
   the canvas, every one is a different shape from the other seven, and every
   one brings its own fight and its own sequence.

   It also writes tools/shot-astral.png, which is the eight side by side —
   the same contact-sheet trick tools/silhouettes.js uses for the rods, and
   for the same reason: a number saying they are different is worth much less
   than being able to look. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const IDS = ['ufo', 'zeus', 'earth', 'kaiju', 'cthulhu', 'kraken',
             'brandon_sun', 'josh_jia'];

/* Intersection over union of two occupancy grids. Counting cells that agree
   is background-dominated — two unrelated subjects agree on nine tenths of an
   empty grid — so this counts only cells either one of them fills. */
function iou(a, b) {
  let both = 0, either = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] || b[i]) { either++; if (a[i] && b[i]) both++; }
  }
  return either ? both / either : 1;
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1520, height: 460 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);

  const res = await page.evaluate((IDS) => {
    const out = { missing: [], noTrial: [], noScene: [], blank: [], grids: {}, ink: {} };
    const G = 44;                                  // grid side for the shape test

    IDS.forEach(function (id) {
      const f = VF.fish.byId(id);
      if (!f) { out.missing.push(id); return; }
      if (f.rarity !== 'astral') out.missing.push(id + ' (rarity ' + f.rarity + ')');
      if (!f.trial || !f.trial.phases || f.trial.phases.length < 3) out.noTrial.push(id);
      if (!f.cutscene || !VF.cutscene.scenes[f.cutscene]) out.noScene.push(id);

      const S = 150;
      const cv = document.createElement('canvas');
      cv.width = cv.height = S * 2.6;
      const g = cv.getContext('2d');
      g.translate(cv.width / 2, cv.height / 2);
      // no rainbow sweep: the sweep is the same on all eight and would only
      // make them look more alike than they are
      VF.fishArt.draw(g, f, S, { time: 1.7, sheen: false });

      const px = g.getImageData(0, 0, cv.width, cv.height).data;
      let lit = 0;
      const grid = new Uint8Array(G * G);
      const cell = cv.width / G;
      for (let y = 0; y < cv.height; y += 2) {
        for (let x = 0; x < cv.width; x += 2) {
          const a = px[(y * cv.width + x) * 4 + 3];
          if (a > 40) {
            lit++;
            grid[Math.floor(y / cell) * G + Math.floor(x / cell)] = 1;
          }
        }
      }
      out.ink[id] = lit;
      if (lit < 400) out.blank.push(id);
      out.grids[id] = Array.from(grid);
    });
    return out;
  }, IDS);

  let bad = 0;
  const say = (label, list) => {
    console.log(label + ':', list.length ? list.join(', ') : 'none');
    if (list.length) bad++;
  };
  say('missing or wrong tier', res.missing);
  say('without a written fight', res.noTrial);
  say('without a sequence', res.noScene);
  say('drawing nothing', res.blank);

  console.log('\nink (lit samples):');
  IDS.forEach(id => console.log('  ' + id.padEnd(13), res.ink[id] || 0));

  console.log('\nshape overlap (IoU, lower is more distinct):');
  let worst = 0, worstPair = '';
  for (let i = 0; i < IDS.length; i++) {
    for (let j = i + 1; j < IDS.length; j++) {
      const a = res.grids[IDS[i]], b = res.grids[IDS[j]];
      if (!a || !b) continue;
      const v = iou(a, b);
      if (v > worst) { worst = v; worstPair = IDS[i] + ' / ' + IDS[j]; }
    }
  }
  console.log('  worst pair:', worstPair, worst.toFixed(3));
  /* 0.80 is the line the rods are held to. Two of these are a sphere and a
     disc seen edge-on, so they will never be as far apart as a harpoon and a
     bamboo pole, but nothing here may be mistakable for anything else. */
  if (worst > 0.80) { console.log('  TOO ALIKE'); bad++; }

  // and the contact sheet
  await page.evaluate((IDS) => {
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#05070c;display:flex;' +
      'align-items:center;justify-content:center;gap:0;height:100vh';
    IDS.forEach(function (id) {
      const f = VF.fish.byId(id);
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:190px;text-align:center;font:11px/1.6 system-ui;color:#8fa4bd';
      const cv = document.createElement('canvas');
      cv.width = 380; cv.height = 760;
      cv.style.cssText = 'width:190px;height:380px';
      const g = cv.getContext('2d');
      g.translate(190, 380);
      VF.fishArt.draw(g, f, 118, { time: 1.7 });
      wrap.appendChild(cv);
      const n = document.createElement('div');
      n.textContent = f.name;
      wrap.appendChild(n);
      document.body.appendChild(wrap);
    });
  }, IDS);
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(__dirname, 'shot-astral.png') });
  console.log('\nwrote tools/shot-astral.png');

  if (errors.length) {
    console.log('\nerrors:');
    errors.slice(0, 8).forEach(e => console.log('  ' + e));
    bad++;
  }

  await browser.close();
  if (bad) process.exitCode = 1;
})();
