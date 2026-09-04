/* Looking at a frame at pixel scale, and at the difference between two.

   The bugs that have cost the most in this project were all invisible in a
   1280-wide screenshot and obvious at 3x with a difference strip under them:
   a gradient that came back black at low alpha, a backdrop going through the
   world downscale, and clouds whose silhouettes were made of straight lines.
   Every one of them was reasoned about wrongly for a while first, and then
   settled in one look. So this is the looking, made cheap.

     node tools/pixels.js a,b,c                 crops (0,0,480,200) at 3x
     node tools/pixels.js a,b 480,0,420,170,3   x,y,w,h,zoom

   Names are png basenames in tools/sc-pixels/ (or an absolute directory in
   VF_PIXELS_DIR). The output stacks each crop with a label, then the first
   two differenced and multiplied by eight, into crop.png beside them.

   Nearest-neighbour on purpose: this is for judging whether an edge is an
   edge, and a smoothing filter is exactly the thing that would hide it. */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const DIR = process.env.VF_PIXELS_DIR || path.join(__dirname, 'sc-pixels');
const NAMES = (process.argv[2] || '').split(',').filter(Boolean);
const [X, Y, W, H, Z] = (process.argv[3] || '0,0,480,200,3').split(',').map(Number);

if (!NAMES.length) {
  console.log('usage: node tools/pixels.js name1,name2[,name3] [x,y,w,h,zoom]');
  console.log('       png basenames in ' + DIR);
  process.exit(2);
}

(async () => {
  const missing = NAMES.filter(n => !fs.existsSync(path.join(DIR, n + '.png')));
  if (missing.length) {
    console.log('no such frame: ' + missing.join(', ') + '  (in ' + DIR + ')');
    process.exit(1);
  }
  /* file:// images taint a canvas unless the browser is told they are all one
     origin, and the whole tool is getImageData over them. */
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium',
                                          args: ['--allow-file-access-from-files'] });
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  fs.writeFileSync(path.join(DIR, '_blank.html'), '<!doctype html><title>pixels</title>');
  await page.goto('file://' + path.join(DIR, '_blank.html'));

  const url = await page.evaluate(async (a) => {
    const [names, X, Y, W, H, Z, dir] = a;
    const load = src => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src;
    });
    const imgs = [];
    for (const n of names) imgs.push(await load('file://' + dir + '/' + n + '.png'));

    const cw = W * Z, chh = H * Z;
    const rows = imgs.length + (imgs.length > 1 ? 1 : 0);
    const c = document.createElement('canvas');
    c.width = cw; c.height = (chh + 22) * rows;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false;
    g.font = '14px monospace';

    let y = 0;
    for (let i = 0; i < imgs.length; i++) {
      g.fillStyle = '#8ab'; g.fillText(names[i], 4, y + 15); y += 22;
      g.drawImage(imgs[i], X, Y, W, H, 0, y, cw, chh);
      y += chh;
    }
    if (imgs.length > 1) {
      const cut = i => {
        const t = document.createElement('canvas'); t.width = W; t.height = H;
        t.getContext('2d').drawImage(imgs[i], X, Y, W, H, 0, 0, W, H);
        return t;
      };
      const a0 = cut(0), a1 = cut(1);
      const g0 = a0.getContext('2d');
      const d0 = g0.getImageData(0, 0, W, H);
      const d1 = a1.getContext('2d').getImageData(0, 0, W, H);
      for (let i = 0; i < d0.data.length; i += 4)
        for (let k = 0; k < 3; k++)
          d0.data[i + k] = Math.min(255, Math.abs(d0.data[i + k] - d1.data[i + k]) * 8);
      g0.putImageData(d0, 0, 0);
      g.fillStyle = '#8ab';
      g.fillText('diff(' + names[0] + ', ' + names[1] + ') x8', 4, y + 15); y += 22;
      g.drawImage(a0, 0, y, cw, chh);
    }
    return c.toDataURL('image/png');
  }, [NAMES, X, Y, W, H, Z, DIR]);

  const out = path.join(DIR, 'crop.png');
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  fs.unlinkSync(path.join(DIR, '_blank.html'));
  console.log('wrote ' + path.relative(process.cwd(), out) +
              '  (' + NAMES.join(' / ') + ' at ' + [X, Y, W, H].join(',') + ' x' + Z + ')');
  await browser.close();
})();
