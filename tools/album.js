/* Photographs, and whether they are photographs.

   A shutter that writes an empty rectangle is the failure this tool exists for:
   the GL context is created with preserveDrawingBuffer:false, so a capture
   taken anywhere but the tail of the frame gets a blank buffer and no error.
   Everything here is therefore about the PICTURE — that it has ink in it, that
   it is the scene and not the interface, and that the stamp on the back says
   what was actually true when it was taken.

   And the album is storage, so it is also about not growing: it is capped, the
   oldest goes first, and a game erased takes its plates with it.

     node tools/album.js
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'sc-album');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(450);
  await page.click('#bootStart');
  await page.waitForTimeout(600);

  const steps = [], fail = [];
  function step(s, ok, note) { steps.push({ s, ok: !!ok, note }); if (!ok) fail.push(s); }

  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const out = {};
    if (!VF.album) return { missing: true };
    VF.album.clear();

    /* --- one photograph, of the thing that was in front of the lens ------ */
    VF.state.data.location = 'shore';
    VF.bus.emit('location:changed', 'shore');
    VF.scene.rebuild();
    VF.time.setCycle(0.8);
    VF.weather.force('clear');
    for (let i = 0; i < 40; i++) VF.weather.tick(0.5);
    for (let i = 0; i < 60; i++) { VF.palette.update(); VF.scene.update(0.033); }
    VF.album.shoot();
    await wait(260);
    const one = VF.album.list()[0];
    out.took = !!one;
    if (!one) return out;

    /* how much of it is not flat ground: a blank capture is the whole point */
    const im = new Image();
    await new Promise(res => { im.onload = res; im.onerror = res; im.src = one.img; });
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let sum = 0, sum2 = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] + d[i + 1] + d[i + 2]) / 3;
      sum += v; sum2 += v * v; n++;
    }
    const mean = sum / n;
    out.w = one.w; out.h = one.h; out.bytes = one.img.length;
    out.mean = +mean.toFixed(1);
    /* Spread, not brightness. A night scene is dark on purpose; a blank one is
       dark AND flat, and only the second is a failure. */
    out.spread = +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1);
    out.stamp = { place: one.place, placeName: one.placeName, phase: one.phase,
                  weather: one.weather, subject: one.subject && one.subject.kind };
    out.sheet = one.img;

    /* --- the stamp says what was true, not what is true now -------------- */
    VF.state.data.location = 'trench';
    VF.bus.emit('location:changed', 'trench');
    out.stampHeld = VF.album.list()[0].place === 'shore';
    VF.state.data.location = 'shore';
    VF.bus.emit('location:changed', 'shore');

    /* --- what you did not land is not named ------------------------------

       Driven through the real cast rather than by setting S.state by hand: the
       tick corrects an inconsistent state within a frame or two, and the
       capture happens a frame later, so a faked state is gone before the
       shutter reaches it. */
    const before = VF.album.count();
    VF.fishing.hardReset();
    VF.fishing.beginCharge(); VF.fishing.releaseCharge();
    for (let i = 0; i < 2000 && VF.fishing.state() !== 'bite'; i++) VF.fishing.tick(0.05);
    out.bit = VF.fishing.state() === 'bite';
    if (out.bit) VF.fishing.hook();
    out.fighting = VF.fishing.state() === 'reeling';
    const onName = VF.fishing.S.pending && VF.fishing.S.pending.fish
      ? VF.fishing.S.pending.fish.name : null;
    VF.album.shoot();
    await wait(260);
    const onLine = VF.album.list()[0];
    out.onLineKind = onLine && onLine.subject ? onLine.subject.kind : null;
    out.onLineVague = !!onLine && onLine.subject.kind === 'onLine' &&
                      (!onName || onLine.subject.name.indexOf(onName) < 0);
    out.grew = VF.album.count() === before + 1;
    VF.fishing.hardReset();

    /* --- it is capped, and the oldest goes first ------------------------- */
    const first = VF.album.list()[VF.album.list().length - 1].id;
    for (let i = 0; i < VF.album.CAP + 3; i++) {
      VF.album.shoot();
      await wait(60);
    }
    out.capped = VF.album.count() <= VF.album.CAP;
    out.count = VF.album.count();
    out.oldestWent = !VF.album.get(first);

    /* --- and one can be thrown away ------------------------------------- */
    const top = VF.album.list()[0];
    VF.album.remove(top.id);
    out.removed = !VF.album.get(top.id) && VF.album.count() === out.count - 1;

    /* --- a game erased takes its plates with it -------------------------- */
    VF.bus.emit('save:erased', { slot: VF.save.slot() });
    out.erased = VF.album.count() === 0;
    return out;
  });

  if (r.missing) {
    console.log('FAIL: js/systems/album.js is not loaded');
    await browser.close();
    process.exitCode = 1;
    return;
  }

  step('the shutter takes a photograph at all', r.took);
  step('and it has a picture in it, not a blank rectangle',
       r.spread > 8, 'spread ' + r.spread + ' over mean ' + r.mean);
  step('at a size worth keeping and a weight worth storing',
       r.w >= 320 && r.bytes > 1500 && r.bytes < 60000,
       r.w + '×' + r.h + ', ' + Math.round(r.bytes / 1024) + 'KB');
  step('the stamp knows where and when it was taken',
       r.stamp.place === 'shore' && !!r.stamp.phase && !!r.stamp.weather,
       [r.stamp.placeName, r.stamp.phase, r.stamp.weather].join(' · '));
  step('and keeps saying so after you have moved on', r.stampHeld);
  step('a cast can be driven to a fight', r.bit && r.fighting);
  step('what you have not landed is not named', r.onLineVague,
       'subject was ' + r.onLineKind);
  step('a second photograph is a second photograph', r.grew);
  step('the album is capped', r.capped, r.count + ' of 30');
  step('and the oldest goes first', r.oldestWent);
  step('one can be thrown away', r.removed);
  step('and a game erased takes its plates with it', r.erased);

  if (r.sheet) {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, 'plate.jpg'),
                     Buffer.from(r.sheet.split(',')[1], 'base64'));
  }

  steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s +
                                 (s.note ? '  — ' + s.note : '')));
  if (errors.length) fail.push('page errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  console.log('');
  if (fail.length) { console.log('FAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('a photograph is a record of having been somewhere — ' + OUT);
  await browser.close();
  process.exitCode = fail.length ? 1 : 0;
})();
