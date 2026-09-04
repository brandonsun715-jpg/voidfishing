/* Looking at the game.

   §30 of the brief is "actually inspect every zone visually", and the reason
   that keeps being skipped is that there was no cheap way to do it: the world
   contact sheet is sixteen full frames and four minutes, so it gets run once
   a round and the four zones nobody looked at ship anyway. This is the same
   idea at one frame per cell, so a grid of zone x hour x weather is one run
   and one image.

     node tools/cinema.js                    the default grid
     node tools/cinema.js shore,trench       named zones
     node tools/cinema.js shore rain,storm   and named weather

   It writes ONE png per row so a row can be looked at without paging through
   the rest, plus the numbers that say what post is doing — because an
   exposure that has run away is obvious in a column of figures and can be
   quite hard to see in a picture of the sea at night. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'sc-cinema');

const ZONES = (process.argv[2] || 'shore,basin,flats,trench,abyss,cradle,nowhere,beneath').split(',');
const WX = (process.argv[3] || 'clear').split(',');
/* The hours worth looking at, which are not evenly spaced: the ends of the
   day are where everything happens and the middle of it is one long note. */
const HOURS = [
  ['dawn', 0.02], ['morning', 0.20], ['midday', 0.33],
  ['golden', 0.492], ['sunset', 0.552], ['twilight', 0.610],
  ['blue', 0.668], ['night', 0.82]
];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(450);
  await page.click('#bootStart');
  await page.waitForTimeout(600);

  console.log('  zone      hour      wx        exposure   mean  spread  clipped');

  for (const zone of ZONES) {
    for (const wx of WX) {
      const r = await page.evaluate(async (a) => {
        const [zone, wx, hours] = a;
        const wait = ms => new Promise(res => setTimeout(res, ms));
        const out = { cells: [], rows: [] };

        const cw = 300, ch = 169;
        const sheet = document.createElement('canvas');
        sheet.width = cw * hours.length + 8 * (hours.length + 1);
        sheet.height = ch + 30;
        const sg = sheet.getContext('2d');
        sg.fillStyle = '#0b0d11';
        sg.fillRect(0, 0, sheet.width, sheet.height);
        sg.font = '11px ui-monospace, monospace';

        VF.state.data.location = zone;
        VF.bus.emit('location:changed', zone);
        VF.scene.rebuild();

        for (let i = 0; i < hours.length; i++) {
          VF.weather.force(wx);
          for (let k = 0; k < 60; k++) VF.weather.tick(0.5);
          VF.time.setCycle(hours[i][1]);
          /* Long enough for the exposure to settle — it adapts, and a frame
             grabbed on the first tick is a frame of the last hour. */
          for (let k = 0; k < 90; k++) { VF.palette.update(); VF.scene.update(0.033); }
          VF.scene.draw();
          await wait(30);
          VF.scene.draw();

          /* Both canvases, composited the way the player sees them. */
          const c = document.createElement('canvas');
          c.width = cw; c.height = ch;
          const g = c.getContext('2d');
          g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
          const gl = document.getElementById('glscene');
          const two = document.getElementById('scene');
          if (gl) g.drawImage(gl, 0, 0, cw, ch);
          if (two) g.drawImage(two, 0, 0, cw, ch);

          const d = g.getImageData(0, 0, cw, ch).data;
          let s = 0, s2 = 0, n = 0, clip = 0;
          for (let k = 0; k < d.length; k += 4) {
            const v = (d[k] + d[k + 1] + d[k + 2]) / 3;
            s += v; s2 += v * v; n++;
            if (d[k] > 252 && d[k + 1] > 252 && d[k + 2] > 252) clip++;
          }
          const mean = s / n;
          out.rows.push({
            hour: hours[i][0],
            ev: +(VF.glPost && VF.glPost.exposure ? VF.glPost.exposure() : 1).toFixed(3),
            mean: +mean.toFixed(1),
            spread: +Math.sqrt(Math.max(0, s2 / n - mean * mean)).toFixed(1),
            clip: +(clip / n * 100).toFixed(2)
          });

          const x = 8 + i * (cw + 8);
          sg.drawImage(c, x, 22);
          sg.fillStyle = '#8fa3b8';
          sg.fillText(hours[i][0], x, 15);
        }
        out.sheet = sheet.toDataURL('image/jpeg', 0.86);
        return out;
      }, [zone, wx, HOURS]);

      fs.writeFileSync(path.join(OUT, zone + '-' + wx + '.jpg'),
                       Buffer.from(r.sheet.split(',')[1], 'base64'));
      r.rows.forEach(function (x) {
        console.log('  ' + zone.padEnd(9) + x.hour.padEnd(10) + wx.padEnd(10) +
          String(x.ev).padStart(6) + String(x.mean).padStart(9) +
          String(x.spread).padStart(8) + String(x.clip).padStart(8) + '%');
      });
    }
  }

  console.log('');
  if (errors.length) {
    console.log('page errors:');
    [...new Set(errors)].slice(0, 4).forEach(e => console.log('  ' + e));
  } else console.log('no page errors');
  console.log('wrote ' + OUT);
  await browser.close();
})();
