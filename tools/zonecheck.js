/* The identity matrix, as something that can go red.

   The failure this whole rebuild exists to prevent is nine places that differ
   by palette — and it is not a failure anybody notices while making it, because
   each zone looks fine on its own. It only shows up side by side, months later,
   as "they all feel the same".

   So the constraint is a test. Every zone declares its shape language, how its
   water moves, where its light comes from, the navigation problem it poses and
   the mechanic that is only there — and if two of them agree on the parts that
   matter, this exits non-zero.

   It also checks the parts of a place that are easy to leave out: something big
   enough to navigate by, something that is not obvious, a question the zone
   does not answer, and enough water with nothing in it.

     node tools/zonecheck.js
*/
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(500);
  await page.click('#bootStart');
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const fail = [], warn = [], rows = [];
    const ids = Object.keys(VF.zoneData.zones);

    /* --- the matrix --- */
    const seen = { nav: {}, mechanic: {}, look: {} };
    ids.forEach(id => {
      const z = VF.zoneData.get(id);
      const sp = z.spatial;
      if (!sp) { fail.push(id + ': no spatial block — it has no declared identity'); return; }

      ['shape', 'movement', 'light', 'nav', 'mechanic', 'question'].forEach(k => {
        if (!sp[k]) fail.push(id + ': spatial.' + k + ' is missing');
      });

      /* Two zones may share a shape language if they do something different
         with it — the Basin's rings and the Cradle's arcs are both round and
         are not the same place. What may never collide is the problem the
         player is solving and the mechanic they are solving it with. */
      if (sp.nav) {
        if (seen.nav[sp.nav]) fail.push(id + ' and ' + seen.nav[sp.nav] + ' pose the same navigation problem: ' + sp.nav);
        else seen.nav[sp.nav] = id;
      }
      if (sp.mechanic) {
        if (seen.mechanic[sp.mechanic]) fail.push(id + ' and ' + seen.mechanic[sp.mechanic] + ' run the same mechanic: ' + sp.mechanic);
        else seen.mechanic[sp.mechanic] = id;
      }
      const look = [sp.shape, sp.movement, sp.light].join('/');
      if (seen.look[look]) fail.push(id + ' and ' + seen.look[look] + ' look identical: ' + look);
      else seen.look[look] = id;

      if (sp.question && !/\?$/.test(sp.question)) {
        warn.push(id + ': the question does not ask anything');
      }

      rows.push({ id: id, shape: sp.shape, movement: sp.movement, light: sp.light,
                  nav: sp.nav, mechanic: sp.mechanic,
                  air: sp.air, width: sp.width, empty: sp.empty });
    });

    /* --- the graph, for the zones that have one yet --- */
    const built = [];
    ids.forEach(id => {
      const z = VF.zoneData.get(id);
      if (!z.landmarks) return;
      VF.state.data.location = id;
      VF.landmarks.invalidate();
      VF.scene.update(0.016);
      const w = VF.landmarks.world();
      if (!w) { fail.push(id + ': declares landmarks and generated none'); return; }

      if (!w.macro) fail.push(id + ': no macro landmark — nothing to know the place by');
      if (w.meso.length < 3) fail.push(id + ': ' + w.meso.length + ' meso landmarks, needs 3 for a route');
      if (!w.secret) fail.push(id + ': nothing that is not obvious');

      const want = z.spatial.empty === undefined ? 0.4 : z.spatial.empty;
      if (w.empty < want) {
        fail.push(id + ': ' + (w.empty * 100 | 0) + '% empty, declared ' + (want * 100 | 0) + '%');
      }

      /* Every meso landmark has to be reachable by looking: one that nothing
         can see is a thing in a list rather than a thing in a place. */
      const byId = {};
      w.all.forEach(l => { byId[l.id] = l; });
      w.meso.forEach(l => {
        const seenBy = l.fromEye ||
          w.all.some(o => o !== l && o.edges.some(e => e.to === l.id));
        if (!seenBy) fail.push(id + ': ' + l.art + ' is not in sight of anything');
      });

      /* And the secret has to be off the bearing you start on, or it is the
         view rather than a secret. */
      if (w.secret) {
        const frac = Math.abs(w.secret.u) / Math.max(0.01, VF.space.uSpan(w.secret.d));
        if (frac < 0.6) warn.push(id + ': the secret is nearly dead ahead (' + frac.toFixed(2) + ' frames off centre)');
      }

      built.push({ id: id, n: w.all.length, macro: w.macro && w.macro.art,
                   meso: w.meso.length, micro: w.micro.length,
                   secret: w.secret && w.secret.art, empty: +w.empty.toFixed(3) });
    });

    return { fail, warn, rows, built };
  });

  const pad = (s, n) => String(s === undefined ? '-' : s).padEnd(n);
  console.log(pad('zone', 12) + pad('shape', 12) + pad('movement', 11) + pad('light', 15) +
              pad('navigation', 13) + pad('mechanic', 16) + pad('air', 6) + pad('empty', 6));
  console.log('-'.repeat(91));
  r.rows.forEach(z => console.log(
    pad(z.id, 12) + pad(z.shape, 12) + pad(z.movement, 11) + pad(z.light, 15) +
    pad(z.nav, 13) + pad(z.mechanic, 16) + pad(z.air, 6) + pad(z.empty, 6)));

  if (r.built.length) {
    console.log('\nlandmark graphs built:');
    r.built.forEach(b => console.log('  ' + pad(b.id, 12) +
      b.n + ' landmarks · macro ' + b.macro + ' · ' + b.meso + ' meso · ' +
      b.micro + ' micro · secret ' + b.secret + ' · ' + (b.empty * 100 | 0) + '% empty'));
  }
  const todo = r.rows.length - r.built.length;
  if (todo > 0) console.log('\n' + todo + ' zone(s) have an identity but no landmark graph yet');

  if (r.warn.length) { console.log('\nwarnings:'); r.warn.forEach(w => console.log('  ' + w)); }
  if (errors.length) { console.log('\npage errors:'); errors.slice(0, 5).forEach(e => console.log('  ' + e)); }
  if (r.fail.length) { console.log('\nFAIL:'); r.fail.forEach(f => console.log('  ' + f)); }
  else console.log('\nevery zone is a different place');

  await browser.close();
  process.exitCode = (r.fail.length || errors.length) ? 1 : 0;
})();
