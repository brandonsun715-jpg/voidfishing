/* Checks that what the front of every case says is what comes out of it.

     node tools/cases.js

   Four things, and any one of them failing exits non-zero:

     1. Every odds table sums to exactly one.
     2. Every tier a table names is actually stocked in that case's pool. A
        table that promises twenty per cent common while the pool holds nothing
        common quietly folds that twenty per cent somewhere else, and the number
        printed on the box stops describing the box.
     3. No pool lists a cosmetic that is owned from the start — those are
        guaranteed duplicates and nothing but a refund.
     4. No pool lists something marked secret, which is not obtained this way.

   Then it rolls two hundred thousand of each and prints what actually came
   out beside what was promised. */
const { load } = require('./headless');

const VF = load([
  'js/core/util.js', 'js/core/rng.js', 'js/core/bus.js', 'js/core/state.js',
  'js/data/rarities.js', 'js/data/cosmetics.js', 'js/data/cases.js'
]);

let bad = 0;
function fail(msg) { console.log('  FAIL  ' + msg); bad++; }

/* 1 — the tables */
console.log('odds tables');
VF.cases.checkOdds().forEach(function (r) {
  if (r.ok) console.log('  ' + r.id.padEnd(12) + ' sums to 1');
  else fail(r.id + ' sums to ' + r.sum);
});

/* 2, 3, 4 — the pools */
console.log('\npools');
const DEFAULTS = VF.cosmetics.DEFAULTS;
const isDefault = function (id) {
  for (const k in DEFAULTS) if (DEFAULTS[k] === id) return true;
  return false;
};

VF.cases.list.forEach(function (c) {
  const stocked = Object.create(null);
  c.pool.forEach(function (id) {
    const it = VF.cosmetics.get(id);
    if (!it) { fail(c.id + ' lists "' + id + '", which is not a cosmetic'); return; }
    if (isDefault(id)) fail(c.id + ' lists ' + id + ', which everybody owns already');
    if (it.secret) fail(c.id + ' lists ' + id + ', which is marked secret');
    stocked[it.rarity] = (stocked[it.rarity] | 0) + 1;
  });
  const odds = VF.cases.oddsOf(c);
  VF.cases.TIERS.forEach(function (t) {
    if ((odds[t] || 0) > 0 && !stocked[t]) {
      fail(c.id + ' promises ' + (odds[t] * 100).toFixed(4) + '% ' + t + ' and stocks none');
    }
  });
  const dup = c.pool.filter(function (id, i) { return c.pool.indexOf(id) !== i; });
  if (dup.length) fail(c.id + ' lists ' + dup.join(', ') + ' twice');
  console.log('  ' + c.id.padEnd(12) + c.pool.length + ' items · ' +
              VF.cases.TIERS.filter(function (t) { return stocked[t]; })
                            .map(function (t) { return t + ':' + stocked[t]; }).join(' '));
});

/* and what actually comes out */
const N = 200000;
console.log('\nrolled ' + N.toLocaleString() + ' of each — promised vs. actual');
VF.cases.list.forEach(function (c) {
  const hit = Object.create(null);
  for (let i = 0; i < N; i++) {
    const r = VF.cases.rollFrom(c, Math.random).rarity;
    hit[r] = (hit[r] | 0) + 1;
  }
  const eff = VF.cases.effectiveOdds(c);
  const parts = [];
  VF.cases.TIERS.forEach(function (t) {
    const want = (eff[t] || 0) * 100;
    const got = (hit[t] | 0) / N * 100;
    if (want <= 0 && got <= 0) return;
    const drift = Math.abs(got - want);
    // a tier this rare cannot be measured in this many rolls; only flag the ones that can
    const measurable = want * N / 100 >= 40;
    if (measurable && drift > Math.max(0.35, want * 0.10)) {
      fail(c.id + ' ' + t + ': promised ' + want.toFixed(3) + '%, rolled ' + got.toFixed(3) + '%');
    }
    parts.push(t + ' ' + want.toFixed(want < 1 ? 3 : 1) + '/' + got.toFixed(got < 1 ? 3 : 1));
  });
  console.log('  ' + c.id.padEnd(12) + parts.join('  '));
});

console.log('\n' + (bad ? bad + ' problem(s)' : 'no problems'));
process.exit(bad ? 1 : 0);
