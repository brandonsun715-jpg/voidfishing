/* The book, and whether it is a book of findings or a checklist wearing one.

   js/systems/record.js replaced a binary — an entry existed or it did not —
   with four states earned in order: glimpsed, hooked, landed, known. That is
   easy to claim and easy to get wrong in two specific ways, and both of them
   are what this tool is for.

   1. The states have to be REACHED, not just representable. The one that is
      genuinely hard is the first: something has to brush the bait, get away,
      and still be identified on the way out. That is driven here through the
      real cast rather than by writing to the store.

   2. Making an entry exist earlier changed the meaning of every `d.fishdex[id]`
      truth test in the codebase, silently. The worst of them decides whether a
      catch is a NEW species — a glimpse used to be impossible, and afterwards
      it would have quietly cancelled the one celebration the game has. So the
      last check here is a static one over the source: nothing outside the
      three files that own the store may ask it that question.

     node tools/record.js
*/
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

/* Files allowed to touch d.fishdex directly: the one that defines the shape,
   the one that has always written the landing counts, and the loader that
   repairs old saves. Everything else asks VF.record. */
const OWNERS = ['js/systems/record.js', 'js/systems/fishing.js', 'js/core/save.js'];

function sourceSweep() {
  const root = path.join(__dirname, '..');
  const bad = [];
  (function walk(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (!e.name.endsWith('.js')) return;
      const rel = path.relative(root, p).split(path.sep).join('/');
      if (OWNERS.indexOf(rel) >= 0) return;
      fs.readFileSync(p, 'utf8').split('\n').forEach(function (line, i) {
        /* The shape that means "have they caught one": the entry read as a
           boolean. An assignment or a property read off it is not this. */
        if (/(^|[^.\w])(!|!!|\?|&&\s*|\|\|\s*)?\w*\.?fishdex\[[^\]]+\]\s*(\)|;|\?|&&|\|\||,|$)/.test(line) &&
            !/=[^=]/.test(line)) {
          bad.push(rel + ':' + (i + 1) + '  ' + line.trim());
        }
      });
    });
  })(path.join(root, 'js'));
  return bad;
}

(async () => {
  const steps = [], fail = [];
  function step(s, ok, note) { steps.push({ s, ok: !!ok, note }); if (!ok) fail.push(s); }

  const stray = sourceSweep();
  step('nothing outside the record decides "caught" by testing the store',
       stray.length === 0, stray.slice(0, 3).join(' | '));

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'load' });
  await page.waitForTimeout(450);
  await page.click('#bootStart');
  await page.waitForTimeout(700);

  const r = await page.evaluate(async () => {
    const wait = ms => new Promise(res => setTimeout(res, ms));
    const out = {};
    if (!VF.record) return { missing: true };
    const d = VF.state.data;
    const R = VF.record;

    /* A clean book and a fixed place to fish, so "where they came from" has a
       right answer rather than whatever the session had wandered into. */
    d.fishdex = {};
    d.location = 'shore';
    VF.weather.force('clear');
    VF.time.setCycle(0.8);

    const pool = VF.fish.knownList();

    /* --- a blank page ---------------------------------------------------- */
    out.blank = R.state(pool[0].id) === 'unknown' && !R.met(pool[0].id) &&
                !R.held(pool[0].id) && !R.knows(pool[0].id, 'shape');

    /* --- something took an interest and was gone -------------------------

       Driven through a real cast, and deliberately NOT through putOnLine,
       which sets the hook for you on the last line of itself. The species is
       whatever the water offered — which is the stronger test, because the
       claim is that js/systems/fishing.js says WHAT went past on its way out
       rather than that it can repeat an id back that was handed to it. */
    let bit = null;
    for (let go = 0; go < 6 && !bit; go++) {
      VF.fishing.hardReset();
      if (VF.creature && VF.creature.active()) VF.creature.abort();
      VF.fishing.beginCharge(); VF.fishing.releaseCharge();
      for (let i = 0; i < 4000 && VF.fishing.state() !== 'bite'; i++) VF.fishing.tick(0.05);
      const on = VF.fishing.S.pending;
      /* a chest is not a species, and an encounter is not a bite */
      if (VF.fishing.state() !== 'bite' || !on || !on.id || !VF.fish.byId(on.id)) continue;
      if (R.state(on.id) !== 'unknown') continue;
      bit = on.id;
    }
    out.onLine = !!bit;
    out.bitId = bit;
    if (bit) {
      const was = R.entry(bit) ? R.entry(bit).seen | 0 : 0;
      /* nobody touches the rod: the window runs out on its own */
      for (let i = 0; i < 600 && VF.fishing.state() === 'bite'; i++) VF.fishing.tick(0.05);
      out.missed = VF.fishing.state() !== 'bite';
      out.glimpsed = R.state(bit) === 'glimpsed';
      out.seen = R.entry(bit) ? R.entry(bit).seen : 0;
      out.grew = out.seen === was + 1;
      out.glimpseShape = R.knows(bit, 'shape');
      out.glimpseName = R.knows(bit, 'name');
      /* And it is still not a species you have caught. This is the regression
         that would have eaten the new-species celebration. */
      out.glimpseHeld = R.held(bit);
      out.stillNew = VF.loot.roll({ forceFish: bit }).isNew;
    }
    VF.fishing.hardReset();

    /* The other four, chosen after the cast so none of them is the one the
       water happened to send. */
    const rest = pool.filter(function (f) { return R.state(f.id) === 'unknown'; });
    const B = rest[0], C = rest[1], D = rest[2], E = rest[3];
    out.ids = [bit, B.id, C.id, D.id, E.id];

    /* --- it took the hook and it got away -------------------------------- */
    VF.bus.emit('fishing:lost', { reason: 'snap', catch: { id: B.id, kg: 2.34 } });
    out.hooked = R.state(B.id) === 'hooked';
    out.felt = R.entry(B.id) ? R.entry(B.id).felt : null;
    out.hookedWeight = R.knows(B.id, 'weight');
    out.hookedName = R.knows(B.id, 'name');
    out.hookedHeld = R.held(B.id);

    /* --- landed, and landed enough --------------------------------------- */
    const land = function (id) {
      VF.fishing.hardReset();
      const c = VF.loot.roll({ forceFish: id });
      c.kind = 'fish';
      VF.fishing.acceptCatch(c);
      /* Unconditionally, and not only when it is already up: the card is shown
         340ms after the event and it shares #modal with the panels, so a show
         still pending when the Fishdex opens wipes the panel out from under
         it. close() cancels the pending one, which is the half that matters. */
      VF.catchUI.close();
      VF.fishing.hardReset();
    };
    land(C.id);
    out.landed = R.state(C.id) === 'landed';
    out.landedName = R.knows(C.id, 'name') && R.knows(C.id, 'art');
    out.habitsShut = R.habits(C.id) === null;
    for (let i = 1; i < R.KNOWN; i++) land(C.id);
    out.known = R.state(C.id) === 'known';
    const hab = R.habits(C.id);
    out.habits = !!hab;
    out.habitWhere = hab && hab.where ? hab.where.key : null;
    out.habitOf = hab && hab.where ? hab.where.n : 0;
    out.habitBait = hab && hab.bait ? hab.bait.key : null;

    /* --- an old save grows forward, and only forward --------------------- */
    d.fishdex[D.id] = { caught: 3, record: { kg: 4.2, m: 0.6, pct: 0.5 },
                        firstSeen: 1, mutations: {} };
    const de = R.entry(D.id);
    out.migrated = de.seen >= 3 && de.hooked >= 3 && R.state(D.id) === 'landed';
    d.fishdex[E.id] = { caught: 1, seen: 9, hooked: 4, record: null,
                        firstSeen: 1, mutations: {}, traits: {} };
    const ee = R.entry(E.id);
    out.notBackwards = ee.seen === 9 && ee.hooked === 4;

    /* --- the index counts findings, not a percentage --------------------- */
    const cnt = R.counts(pool);
    out.counts = { met: cnt.met, held: cnt.held, known: cnt.known };
    out.metExceedsHeld = cnt.met > cnt.held;

    /* --- and the book on screen says all of that -------------------------- */
    const cellFor = function (f) {
      const want = '#' + String(VF.fish.list.indexOf(f) + 1).padStart(2, '0');
      const cells = document.querySelectorAll('.dex-cell');
      for (let i = 0; i < cells.length; i++) {
        const n = cells[i].querySelector('.dex-n');
        if (n && n.textContent === want) return cells[i];
      }
      return null;
    };
    /* The species grid is behind the waters tab, and the tab is a button with
       a word in it — the panel is rebuilt from scratch on the press, so this
       is the only way in that goes through the same path a player does. */
    const openSpecies = async function () {
      VF.panels.close();
      await wait(120);
      VF.panels.open('fishdex');
      await wait(160);
      const sub = document.querySelector('.panel-sub');
      Array.prototype.forEach.call(document.querySelectorAll('.tabs .tab'), function (t) {
        if (t.textContent === 'species') t.click();
      });
      await wait(260);
      return sub ? sub.textContent : '';
    };

    out.header = await openSpecies();
    out.cells = document.querySelectorAll('.dex-cell').length;

    const fa = VF.fish.byId(bit);
    const ca = fa ? cellFor(fa) : null;
    out.cellA = !!ca;
    out.cellAName = ca ? ca.querySelector('.dex-name').textContent : null;
    out.cellAState = ca ? ca.className : '';
    out.cellARec = ca ? ca.querySelector('.dex-rec').textContent : '';
    if (ca) ca.click();
    await wait(160);
    out.partialOpened = !!document.querySelector('.catch-card');
    out.partialUnnamed = !!document.querySelector('.catch-name.unnamed');
    out.partialNoTraits = !document.querySelector('.trait-chip');
    out.partialNoHabits = !document.querySelector('.dex-habits');

    await openSpecies();
    const cc = cellFor(C);
    out.cellC = !!cc;
    out.cellCName = cc ? cc.querySelector('.dex-name').textContent : null;
    if (cc) cc.click();
    await wait(160);
    out.knownNamed = !!document.querySelector('.catch-name') &&
                     !document.querySelector('.catch-name.unnamed');
    out.knownHabits = !!document.querySelector('.dex-habits');
    out.knownHabitText = (function () {
      const el = document.querySelector('.dex-habit-rows');
      return el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : '';
    })();
    VF.panels.close();
    return out;
  });

  if (r.missing) {
    console.log('FAIL: js/systems/record.js is not loaded');
    await browser.close();
    process.exitCode = 1;
    return;
  }

  step('a species nobody has met is a blank page', r.blank);
  step('a cast can be driven to a bite and left to time out', r.onLine && r.missed);
  step('and what brushed the bait is named on the way past',
       r.glimpsed && r.grew, r.bitId + ', seen ' + r.seen);
  step('a glimpse is a shape and not a name', r.glimpseShape && !r.glimpseName);
  step('a glimpse is not a catch', !r.glimpseHeld);
  step('and the next one of them is still a new species', r.stillNew);
  step('hooked and lost is further than glimpsed', r.hooked);
  step('and it keeps what it pulled at', r.felt === 2.34 && r.hookedWeight,
       'felt ' + r.felt);
  step('but still does not give you the animal', !r.hookedName && !r.hookedHeld);
  step('landing one gives you the animal', r.landed && r.landedName);
  step('habits stay shut until you have landed enough', r.habitsShut);
  step('and open at ' + 5 + ' landings', r.known && r.habits);
  step('naming the water they actually came from',
       r.habitWhere === 'shore' && r.habitOf === 5,
       r.habitWhere + ' ×' + r.habitOf + (r.habitBait ? ', on ' + r.habitBait : ''));
  step('an old entry grows forward — three landed is three seen', r.migrated);
  step('and never backwards', r.notBackwards);
  step('the index counts met and held separately', r.metExceedsHeld,
       JSON.stringify(r.counts));
  step('and its header is findings, not a percentage',
       /landed/.test(r.header) && /met/.test(r.header) && !/%/.test(r.header),
       r.header);
  step('a glimpsed cell is unnamed and still opens',
       r.cellA && r.cellAName === '?????' && /dex-glimpsed/.test(r.cellAState) &&
       r.partialOpened, r.cells + ' cells, "' + r.cellARec + '"');
  step('and its page is an account of the encounters, not an entry',
       r.partialUnnamed && r.partialNoTraits && r.partialNoHabits);
  step('a known species reads as one', r.cellC && r.cellCName !== '?????' && r.knownNamed);
  step('with what you found out written under it', r.knownHabits, r.knownHabitText);

  steps.forEach(s => console.log('  ' + (s.ok ? 'ok  ' : 'FAIL') + '  ' + s.s +
                                 (s.note ? '  — ' + s.note : '')));
  if (errors.length) fail.push('page errors: ' + [...new Set(errors)].slice(0, 3).join(' | '));
  console.log('');
  if (fail.length) { console.log('FAIL:'); [...new Set(fail)].forEach(f => console.log('  ' + f)); }
  else console.log('the book is what this angler found out');
  await browser.close();
  process.exitCode = fail.length ? 1 : 0;
})();
