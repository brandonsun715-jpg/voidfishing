/* VOID FISHING — bait.
   Bait shapes the draw: `bite` speeds up bites, `rare` shifts the rarity curve,
   `luck` feeds mutation/size rolls, and fish that list the bait in `baits`
   get a large weight bonus. Worms are unlimited so the player can never be stuck. */
(function (VF) {
  'use strict';

  const LIST = [
    { id: 'worm', name: 'Worm', cost: 0, pack: 0, level: 1, unlimited: true,
      bite: 1.00, rare: 1.00, luck: 0.00, color: '#b07a5a',
      desc: 'Free, endless, and dug from a bank that does not exist. Common fish adore them.' },

    /* The way back down.

       Good gear erases the bottom of the catalogue: on the last rod at the
       last water, Common came up seventeen times in twenty-four thousand
       draws, and the shore species a completionist still needs are the ones
       the gear is best at not catching. The only fix used to be unequipping
       everything and remembering which rod you started with, which is a chore
       reverse-engineered rather than a choice made.

       So: the same worm, used on purpose. It throws away every rarity bonus
       on the rod, the bait, the water, the weather and the charms, and hands
       back the curve a beginner fishes. Nothing else about the loadout
       changes — the fight is still yours, the bar is still wide. */
    { id: 'plain', name: 'Plain Worm', cost: 40, pack: 20, level: 12, plain: true,
      bite: 1.15, rare: 1.00, luck: 0.00, color: '#a08060',
      desc: 'A worm, held deliberately. Whatever you are carrying, the water answers as if you ' +
            'had just arrived and did not know any better. The small things come back.' },

    { id: 'minnow', name: 'Minnow', cost: 14, pack: 10, level: 2,
      bite: 0.86, rare: 1.22, luck: 0.05, color: '#9fc4d8',
      desc: 'Live bait for things that hunt by movement. Faster bites, better odds.' },

    { id: 'glowworm', name: 'Glow Worm', cost: 46, pack: 10, level: 4,
      bite: 0.80, rare: 1.55, luck: 0.14, color: '#8fe8b0',
      desc: 'Draws anything that has spent its life in the dark. Which, here, is most things.' },

    { id: 'cluster', name: 'Insect Cluster', cost: 110, pack: 10, level: 7,
      bite: 0.94, rare: 1.85, luck: 0.10, color: '#c8b070',
      desc: 'A knot of small bodies. Large fish take it whole and regret nothing.' },

    { id: 'deep', name: 'Deep Bait', cost: 340, pack: 10, level: 12,
      bite: 0.90, rare: 2.40, luck: 0.28, color: '#5f8fa8',
      desc: 'Sinks past where the light stops. Only reaches things that live down there.' },

    { id: 'prism', name: 'Prism Lure', cost: 980, pack: 10, level: 18,
      bite: 1.06, rare: 3.20, luck: 0.48, color: '#c8b0ff',
      desc: 'Refracts into a dozen false fish. Slow to draw a bite, but what bites is worth it.' },

    { id: 'star', name: 'Star Bait', cost: 3600, pack: 10, level: 25,
      bite: 0.88, rare: 4.40, luck: 0.80, color: '#ffe08a',
      desc: 'A pinch of something that was, until recently, extremely far away.' },

    { id: 'ember', name: 'Ember Roe', cost: 9200, pack: 10, level: 31,
      bite: 0.74, rare: 5.60, luck: 1.05, color: '#ff9a5a',
      desc: 'Still warm. Bites come fast and they come angry.' },

    { id: 'void', name: 'Void Bait', cost: 46000, pack: 10, level: 42,
      bite: 0.96, rare: 8.20, luck: 1.70, color: '#a86bff',
      desc: 'You did not make this. It was in the tin when you opened it.' },

    { id: 'null', name: 'Null Bait', cost: 420000, pack: 5, level: 56,
      bite: 1.10, rare: 14.0, luck: 2.80, color: '#e8e8ff',
      desc: 'An absence, tied to a hook. Everything down there notices an absence.' },

    /* Nobody sells this and nobody made it on purpose. Two specimens in a tank
       agreed on a colour, and the aquarium bottled some. `discover` keeps it
       off the shelf entirely until that has happened — see
       js/data/aquariumData.js, and VF.bait.available() below. */
    { id: 'lure_pale', name: 'Pale Lure', cost: 120000, pack: 8, level: 20,
      discover: 'deeplure',
      bite: 0.68, rare: 9.40, luck: 1.90, color: '#dff6ff',
      desc: 'A colour two lanterns settled on between them, which is not a colour either of ' +
            'them was carrying. Things come a long way to look at it.' }
  ];

  const BY_ID = VF.util.byId(LIST);

  function count(id) {
    const b = BY_ID[id];
    if (!b) return 0;
    if (b.unlimited) return Infinity;
    return VF.state.data.baitCounts[id] | 0;
  }
  function has(id) { return count(id) > 0; }
  function consume(id) {
    const b = BY_ID[id];
    if (!b || b.unlimited) return true;
    const c = VF.state.data.baitCounts[id] | 0;
    if (c <= 0) return false;
    if (c - 1 <= 0) delete VF.state.data.baitCounts[id];
    else VF.state.data.baitCounts[id] = c - 1;
    return true;
  }
  function add(id, n) {
    const b = BY_ID[id];
    if (!b || b.unlimited) return;
    VF.state.data.baitCounts[id] = Math.min(99999, (VF.state.data.baitCounts[id] | 0) + n);
  }

  /* Bait that exists as far as this save is concerned. A lure the aquarium has
     not found yet is not stock the shop is out of — it is not a thing. */
  function available() {
    const found = VF.state.data.discovered || {};
    return LIST.filter(function (b) { return !b.discover || !!found[b.discover]; });
  }

  VF.bait = {
    list: LIST,
    available: available,
    get: function (id) { return BY_ID[id] || BY_ID.worm; },
    count: count, has: has, consume: consume, add: add
  };
})(window.VF = window.VF || {});
