/* Crops a region of the last scene shot so detail can actually be judged. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const [file, x, y, w, h] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage();
  const data = fs.readFileSync(path.join(__dirname, file)).toString('base64');
  const out = await p.evaluate(async ([d, X, Y, Wd, Ht]) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + d; });
    const cv = document.createElement('canvas');
    cv.width = Wd * 2; cv.height = Ht * 2;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.drawImage(img, X, Y, Wd, Ht, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/png');
  }, [data, +x, +y, +w, +h]);
  fs.writeFileSync(path.join(__dirname, 'zoom.png'), Buffer.from(out.split(',')[1], 'base64'));
  console.log('wrote tools/zoom.png');
  await b.close();
})();
