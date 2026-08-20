/* Are the new species and rods actually reachable, or just present in the data?
   Rolls a large sample at the far end and reports which of them turn up. */
const { load } = require('./headless');
const VF = load(['js/core/util.js','js/core/rng.js','js/core/bus.js','js/core/state.js','js/core/save.js',
 'js/data/rarities.js','js/data/traits.js','js/data/fish.js','js/data/rods.js','js/data/bait.js',
 'js/data/locations.js','js/data/weather.js','js/data/charms.js','js/data/conditions.js',
 'js/systems/time.js','js/systems/weather.js','js/systems/progression.js','js/systems/build.js',
 'js/systems/conditions.js','js/systems/economy.js','js/systems/loot.js']);

const NEW = ['reed_dace','button_crab','chalk_sole','kettle_perch','sew_eel','tin_shoal',
  'cold_marlin','bell_jelly','grave_carp','lamp_ray','stitch_bream','ash_ray','root_pike',
  'coin_king','tally_fish','salt_widow','folded_letter','mirror_twin','sunken_column',
  'spiral_saint','the_absence','the_census','the_understudy','the_long_now',
  'g_swarm','g_price','g_cursor','g_recursion','g_zero','g_tuesday','g_gardener','g_reader'];

const d = VF.state.data;
d.level = 99;
const seen = Object.create(null);
const N = 400000;
// sample across every spot and both ends of the gear ladder
const spots = VF.locations.list.map(l => l.id);
for (let i = 0; i < N; i++) {
  d.location = spots[i % spots.length];
  d.rod = i % 3 === 0 ? 'wood' : (i % 3 === 1 ? 'deepwater' : 'everything');
  d.bait = i % 4 === 0 ? 'worm' : (i % 4 === 1 ? 'deep' : (i % 4 === 2 ? 'void' : 'null'));
  const c = VF.loot.roll();
  if (c && c.id) seen[c.id] = (seen[c.id] | 0) + 1;
}
const missing = NEW.filter(id => !seen[id]);
console.log('sampled: ' + N.toLocaleString() + ' casts across all spots');
console.log('new species that turned up: ' + (NEW.length - missing.length) + ' / ' + NEW.length);
if (missing.length) console.log('never seen: ' + missing.join(', '));
console.log('\nrarest new ones and how often:');
NEW.map(id => [id, seen[id] | 0]).sort((a, b) => a[1] - b[1]).slice(0, 8)
  .forEach(([id, n]) => console.log('  ' + id.padEnd(18) + String(n).padStart(6) +
    '   1 in ' + (n ? Math.round(N / n).toLocaleString() : '—')));
const total = VF.fish.list.filter(f => seen[f.id]).length;
console.log('\nspecies reachable overall: ' + total + ' / ' + VF.fish.count);
