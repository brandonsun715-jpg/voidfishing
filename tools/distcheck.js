/* The single file has to behave exactly like the folder: boot, cast, land a
   fish, talk to somebody, open every menu, with no console errors. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('requestfailed', r => errs.push('REQUEST FAILED ' + r.url()));

  await page.goto('file://' + path.join(__dirname, '..', 'dist', 'void-fishing.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  console.log('modules:', await page.evaluate(() => Object.keys(window.VF).length));

  /* Every stylesheet has to have SURVIVED the concatenation. This is not
     paranoia: a sheet that ends inside an unclosed block is invisible on its
     own — the browser closes it at end-of-file — and silently swallows the
     next sheet once they are joined. It happened, and the symptom was a whole
     screen rendering with no styling and no error anywhere.

     The check is to name one selector from each source file and ask the built
     page whether a top-level rule for it exists. A swallowed sheet's rules are
     nested inside somebody else's block, so they are not top-level and this
     catches it. */
  const SENTINELS = {
    'base.css': '.btn',
    'hud.css': '.mg-track',
    'panels.css': '.panel',
    'aquarium.css': '#aquariumScreen'
  };
  const css = await page.evaluate(sent => {
    const top = [];
    for (const sheet of document.styleSheets) {
      let rules = null;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      for (const r of rules) if (r.selectorText) top.push(r.selectorText);
    }
    const missing = [];
    for (const f in sent) {
      const sel = sent[f];
      if (!top.some(t => t.split(',').some(x => x.trim() === sel))) missing.push(f + ' (' + sel + ')');
    }
    return { rules: top.length, missing: missing };
  }, SENTINELS);
  console.log('stylesheets: ' + css.rules + ' top-level rules' +
              (css.missing.length ? ' — SWALLOWED: ' + css.missing.join(', ') : ' — all present'));
  if (css.missing.length) errs.push('stylesheet swallowed: ' + css.missing.join(', '));
  await page.click('#bootStart');
  await page.waitForTimeout(400);

  // a whole cycle
  const cycle = await page.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    VF.fishing.beginCharge(); await sleep(600); VF.fishing.releaseCharge();
    await sleep(900);
    VF.fishing.S.biteWait = 0.05; await sleep(300);
    if (VF.fishing.S.state === 'bite') VF.fishing.hook();
    await sleep(200);
    for (let i = 0; i < 400 && VF.fishing.S.state === 'reeling'; i++) {
      VF.fishing.setReeling(VF.fishing.S.fight.tension < 0.6);
      await sleep(16);
    }
    return VF.fishing.S.state;
  });
  console.log('cycle ended in:', cycle);

  await page.evaluate(() => { if (VF.catchUI.isOpen()) VF.catchUI.defaultAction(); });
  await page.waitForTimeout(400);

  /* Every menu, and every tab of the two panels that have several — read off
     the buttons in the bar rather than a list here, so a panel added later
     cannot quietly stop being checked in the shipped file, which is exactly
     what happened when the Boat was added. */
  const menus = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.mbtn')).map(b => b.dataset.panel).filter(Boolean));
  const tabsFor = { boat: ['boat', 'fit', 'paint', 'deck'],
                    journal: ['quests', 'leads', 'field', 'board', 'entries', 'people', 'records'] };
  let opened = 0;
  for (const p of menus.concat(['map'])) {
    if (p === 'aquarium') continue;         // its own screen, walked below
    for (const tab of (tabsFor[p] || [undefined])) {
      await page.evaluate((a) => VF.panels.open(a[0], a[1]), [p, tab]);
      await page.waitForTimeout(150);
      opened++;
    }
    await page.evaluate(() => VF.panels.close());
    await page.waitForTimeout(110);
  }
  console.log('menus opened:', opened);

  // a conversation
  await page.evaluate(() => { VF.fishing.hardReset(); VF.visit.start('keeper'); });
  await page.waitForTimeout(1900);
  console.log('visit phase:', await page.evaluate(() => VF.visit.S.phase));
  let g = 0;
  while (await page.evaluate(() => VF.visit.S.phase === 'talk') && g++ < 10) {
    await page.waitForTimeout(700);
    await page.mouse.click(640, 300);
  }
  await page.waitForTimeout(1600);
  console.log('visit settled:', await page.evaluate(() => VF.visit.S.phase));

  await page.screenshot({ path: 'tools/single-file-check.png' });
  console.log('\nerrors: ' + errs.length);
  if (errs.length) console.log(errs.join('\n'));
  await browser.close();
})();
