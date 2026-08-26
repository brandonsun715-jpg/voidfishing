/* Renders a sample of rods spread evenly up the grade ladder, large enough to
   judge. The full sheet (tools/rods.js) is for checking every rod exists; this
   is for checking the ladder actually climbs. */
const { chromium } = require('playwright');
const path = require('path');
const N = parseInt(process.argv[2], 10) || 12;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1100, height: 200 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await p.click('#bootStart');
  await p.waitForTimeout(600);
  const png = await p.evaluate(async (n) => {
    const rods = VF.rods.list.filter(r => !r.admin)
      .map(r => ({ r, g: VF.rodSig.of(r).grade })).sort((a, b) => a.g - b.g);
    const pick = [];
    for (let i = 0; i < n; i++) pick.push(rods[Math.round(i / (n - 1) * (rods.length - 1))]);
    const RW = 1000, RH = 210, LABEL = 34;
    const cv = document.createElement('canvas');
    cv.width = RW; cv.height = (RH + LABEL) * n;
    const g = cv.getContext('2d');
    g.fillStyle = '#070b11'; g.fillRect(0, 0, cv.width, cv.height);
    pick.forEach((e, i) => {
      const cy = i * (RH + LABEL);
      g.save(); g.translate(0, cy);
      VF.rodArt.preview(g, e.r, RW, RH, i * 0.7);
      const s = VF.rodSig.of(e.r);
      // the label sits under the art, not on it
      g.fillStyle = '#e9eff6'; g.font = '600 14px ui-sans-serif, sans-serif';
      g.fillText(e.r.name.toLowerCase(), 16, RH + 15);
      g.fillStyle = 'rgba(233,239,246,0.45)'; g.font = '11px ui-monospace, monospace';
      g.fillText('grade ' + s.grade.toFixed(2) + '   ' + s.guides.length + ' ' + s.guideForm +
                 '   ' + s.grip + '   ' + s.inlay + '   ' + s.butt + ' butt   ' + s.tip + ' tip   ' +
                 s.wraps + ' wraps   ' + s.ferrules.length + ' ferrule',
                 16, RH + 30);
      g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.beginPath(); g.moveTo(0, RH + LABEL - 0.5); g.lineTo(RW, RH + LABEL - 0.5); g.stroke();
      g.restore();
    });
    return cv.toDataURL('image/png');
  }, N);
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'ladder.png'), Buffer.from(png.split(',')[1], 'base64'));
  console.log('wrote tools/ladder.png');
  await b.close();
})();
