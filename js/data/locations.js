/* VOID FISHING — fishing spots.
   Colours are base tones; js/render/palette.js layers time-of-day and weather on top.
   horizon/silhouette pick which procedural backdrop the scene renderer draws.
   `silhouette: 'none'` is not an omission: four of these have a composition of
   their own in js/render/zoneArt.js, and the generic ridgeline behind a
   colossal trench wall is the thing that made every zone look like every
   other zone.
   EVERY PLACE HAS A POSITION NOW. `at` is [east, south] in leagues, with the
   harbour at the origin, and it is the real thing: how long a crossing takes
   comes off the distance between two marks rather than off how far apart they
   are in the progression, which is what made the harbour as far from the
   shore as the shore is from the basin. There is an east now, which matters
   because somebody has been telling you about the eastern markers since level
   four.

   `shoal` is the deepest draught that can work here and `depthM` is the
   sounding. Together they are the water half of the boat's two ratings in
   js/data/boats.js: a hull that draws more than `shoal` cannot get in, and
   one rated below `depthM` cannot go down. The Glass Flats are ankle deep and
   the last water is not, and no boat does both.

   `void` is how far out of the world this water is, 0 at the shore and 1 at
   the bottom. It is not a colour: the renderer reads it directly and takes the
   place apart with it — the far shore goes, then the horizon, then the surface
   itself, until the last one is a slab to sit on and a line going down. */
(function (VF) {
  'use strict';

  const LIST = [
    { id: 'shore', name: 'The Quiet Shore', level: 1,
      /* along the coast from home, and shallow enough that the two big hulls will never see it again */
      at: [-1.2, 0.8], shoal: 1.4, depthM: 40,
      tag: 'where everyone starts',
      desc: 'A short stretch of pale stone at the edge of the water. Behind you there is nothing worth turning around for.',
      hint: 'Somewhere to sit.',
      rarityBoost: 1.00, valueBoost: 1.00, xpBoost: 1.0, biteBoost: 1.00,
      sky: ['#17223c', '#2e4664'], water: ['#1f3244', '#0a1018'], glow: '#8fb8d8',
      fog: '#2a3a4e', fogAmt: 0.30, stars: 0.55, starTint: '#dce8f5',
      horizon: 'moon', silhouette: 'rocks', depth: 0.42, void: 0.00,
      weather: ['clear', 'overcast', 'rain', 'fog'],
      music: { root: 55, scale: [0, 3, 5, 7, 10], tempo: 0.16, pad: 0.5 } },

    { id: 'basin', name: 'Moonlit Basin', level: 5,
      /* a bowl in the lee of the northern land */
      at: [2.6, -1.4], shoal: 3.0, depthM: 150,
      tag: 'the water remembers a moon',
      desc: 'A wide still bowl of water beneath a moon that has never once moved. Its reflection is a half-second late.',
      hint: 'The light out there is coming from something.',
      rarityBoost: 1.14, valueBoost: 1.15, xpBoost: 1.9, biteBoost: 1.02,
      sky: ['#0f1830', '#2b3c66'], water: ['#1a2a48', '#060a16'], glow: '#b8cfff',
      fog: '#33456e', fogAmt: 0.34, stars: 0.75, starTint: '#e6efff',
      horizon: 'moon', silhouette: 'trees', depth: 0.44, void: 0.06,
      weather: ['clear', 'overcast', 'rain', 'fog', 'meteor'],
      music: { root: 53, scale: [0, 2, 3, 7, 9], tempo: 0.14, pad: 0.6 } },

    { id: 'flats', name: 'The Glass Flats', level: 10,
      /* ankle deep for miles; a bare dory just clears it and a fitted one does not */
      at: [-4.2, -2.2], shoal: 1.0, depthM: 30,
      tag: 'perfectly, unnervingly flat',
      desc: 'Water without a single ripple, stretching further than it should. Everything above is doubled below.',
      hint: 'Reported to be extremely flat.',
      rarityBoost: 1.30, valueBoost: 1.35, xpBoost: 3.4, biteBoost: 0.96,
      sky: ['#101a24', '#3a5a68'], water: ['#22414c', '#08151c'], glow: '#9fe8e0',
      fog: '#2e4e58', fogAmt: 0.22, stars: 0.9, starTint: '#dffaff',
      horizon: 'arch', silhouette: 'none', depth: 0.38, void: 0.14,
      weather: ['clear', 'fog', 'aurora', 'meteor', 'overcast'],
      music: { root: 57, scale: [0, 2, 4, 7, 11], tempo: 0.12, pad: 0.7 } },

    { id: 'trench', name: 'Deepwater Trench', level: 16,
      /* east and out, past the markers */
      at: [5.8, 2.4], shoal: 8.0, depthM: 600,
      tag: 'no measured bottom',
      desc: 'A seam in the water where the dark starts immediately. The line goes out and keeps going.',
      hint: 'Something opened, further out.',
      rarityBoost: 1.55, valueBoost: 1.70, xpBoost: 6.2, biteBoost: 0.92,
      sky: ['#0a1018', '#1b2c3a'], water: ['#0e1d28', '#01040a'], glow: '#5fa8c0',
      fog: '#16303f', fogAmt: 0.48, stars: 0.5, starTint: '#b8d8e8',
      horizon: 'monolith', silhouette: 'none', depth: 0.52, void: 0.26,
      weather: ['overcast', 'rain', 'storm', 'fog', 'eclipse'],
      music: { root: 48, scale: [0, 1, 5, 7, 8], tempo: 0.10, pad: 0.8 } },

    { id: 'abyss', name: 'Crystal Abyss', level: 24,
      /* south, where the shelf gives out */
      at: [-2.8, 6.5], shoal: 8.0, depthM: 1500,
      tag: 'it grows down there',
      desc: 'Enormous slow-growing structures rise out of the deep and stop just below the surface. They are warm.',
      hint: 'A light under the water, and it has edges.',
      rarityBoost: 1.90, valueBoost: 2.30, xpBoost: 11.0, biteBoost: 0.94,
      sky: ['#120c22', '#2e2050'], water: ['#1d1440', '#050318'], glow: '#c8a0ff',
      fog: '#2c1f52', fogAmt: 0.40, stars: 0.85, starTint: '#efe0ff',
      horizon: 'crystal', silhouette: 'none', depth: 0.48, void: 0.38,
      weather: ['clear', 'fog', 'aurora', 'eclipse', 'meteor'],
      music: { root: 50, scale: [0, 3, 5, 6, 10], tempo: 0.11, pad: 0.85 } },

    { id: 'cradle', name: 'The Cradle', level: 33,
      /* the far north-east corner of anything surveyed */
      at: [9.4, -3.8], shoal: 8.0, depthM: 1900,
      tag: 'a broken ring, and a sea inside it',
      desc: 'The remains of something vast and circular hang overhead. Water pools in the wreck of it. You fish in the pool.',
      hint: 'There is a ring up there. Most of one.',
      rarityBoost: 2.35, valueBoost: 2.50, xpBoost: 20.0, biteBoost: 0.98,
      sky: ['#0d1226', '#3a3060'], water: ['#1a2050', '#04061a'], glow: '#ffd08a',
      fog: '#2a2c5e', fogAmt: 0.32, stars: 1.0, starTint: '#fff2d8',
      horizon: 'ring', silhouette: 'none', depth: 0.40, void: 0.52,
      weather: ['clear', 'aurora', 'meteor', 'eclipse', 'storm'],
      music: { root: 52, scale: [0, 2, 5, 7, 9], tempo: 0.13, pad: 0.75 } },

    { id: 'nowhere', name: 'The Nowhere Sea', level: 45,
      /* off the chart's south-west, where the soundings stop agreeing */
      at: [-8.5, 8.2], shoal: 8.0, depthM: 3200,
      tag: 'no coordinates were recorded',
      desc: 'You arrived here. You cannot describe the journey. The water is fine and the fishing is excellent.',
      hint: 'The charts stop. The water does not.',
      rarityBoost: 3.10, valueBoost: 3.40, xpBoost: 36.0, biteBoost: 0.90,
      sky: ['#08060f', '#1a1030'], water: ['#100a24', '#020106'], glow: '#9f7fff',
      fog: '#1c1236', fogAmt: 0.55, stars: 0.68, starTint: '#d8c8ff',
      horizon: 'tear', silhouette: 'none', depth: 0.55, void: 0.74,
      weather: ['fog', 'eclipse', 'voidsurge', 'storm', 'aurora'],
      music: { root: 46, scale: [0, 1, 3, 7, 8], tempo: 0.08, pad: 0.95 } },

    { id: 'beneath', name: 'BENEATH', level: 58,
      /* straight down past everything. Deep, but the hunter clears it — the descent that needs THE UNDERSIDE is the last water, not this one */
      at: [1.5, 12.0], shoal: 8.0, depthM: 3400,
      tag: 'you are the one being fished',
      desc: 'There is no shore. There is no surface. There is a place to sit and a line going down and something on the other end of it that has been waiting.',
      hint: 'Below the Nowhere Sea there is one more thing.',
      rarityBoost: 4.60, valueBoost: 4.50, xpBoost: 65.0, biteBoost: 0.86,
      sky: ['#010103', '#070310'], water: ['#040210', '#000000'], glow: '#b48aff',
      fog: '#140a28', fogAmt: 0.68, stars: 0.35, starTint: '#c8a8ff',
      horizon: 'eye', silhouette: 'none', depth: 0.60, void: 1.00,
      weather: ['voidsurge', 'eclipse', 'fog'],
      music: { root: 43, scale: [0, 1, 4, 6, 7], tempo: 0.06, pad: 1.0 } }
  ];

  const BY_ID = VF.util.byId(LIST);

  function isUnlocked(id) { return VF.state.data.unlockedLocations.indexOf(id) >= 0; }
  function current() { return BY_ID[VF.state.data.location] || LIST[0]; }

  /* Locations the player has heard of: unlocked, plus the next one as a teaser. */
  function visible() {
    const out = [];
    for (let i = 0; i < LIST.length; i++) {
      const l = LIST[i];
      if (isUnlocked(l.id)) { out.push({ loc: l, known: true }); }
      else { out.push({ loc: l, known: false }); if (out.length && !isUnlocked(l.id)) break; }
    }
    return out;
  }

  /* Secret spots are appended once discovered, so everything that walks the
     location list — pools, the map, the palette — sees them automatically. */
  function register(loc) {
    if (BY_ID[loc.id]) return false;
    /* Marked as it goes in, because the list is otherwise indistinguishable
       from the shelf afterwards — and anything that has to mean the same
       thing for two different players (a day's water, say) cannot draw from a
       list whose length depends on what one of them has found. */
    loc.secret = true;
    BY_ID[loc.id] = loc;
    LIST.push(loc);
    if (VF.loot) VF.loot.invalidatePool();
    return true;
  }

  VF.locations = {
    list: LIST,
    register: register,
    isRegistered: function (id) { return !!BY_ID[id]; },
    /* The spots every game has, in the same order, whatever has been found. */
    shelf: function () { return LIST.filter(function (l) { return !l.secret; }); },
    get: function (id) { return BY_ID[id] || LIST[0]; },
    isUnlocked: isUnlocked,
    current: current,
    visible: visible,
    index: function (id) { for (let i = 0; i < LIST.length; i++) if (LIST[i].id === id) return i; return 0; },

    /* Where a spot sits in the progression, which is not where it sits in the
       list. Hidden water is appended as it is found, so a secret spot's index
       is 8 or 12 or wherever it happened to land — and the loot pool measures
       distance in index, so every hidden water read as eight steps from the
       whole map and nothing could stray into it. A secret says which shelf
       water it sits beside; that is its rank. */
    rank: function (id) {
      const l = BY_ID[id];
      if (!l) return 0;
      if (l.secret && l.near && BY_ID[l.near]) {
        for (let i = 0; i < LIST.length; i++) if (LIST[i].id === l.near) return i;
      }
      for (let i = 0; i < LIST.length; i++) if (LIST[i].id === id) return i;
      return 0;
    },
    isSecret: function (id) { return !!(BY_ID[id] && BY_ID[id].secret); },

    /* ------------------------------------------------------------ geography

       Where a place is, and how far it is from another one. `at` is [east,
       south] in leagues; the harbour is the origin and is not a fishing spot,
       so it is answered here rather than living in the shelf.

       This is what a crossing's length comes off now. It used to be the
       difference in progression rank, which meant the harbour was as far from
       the shore as the shore is from the basin, and going from the trench to
       the cradle — right across the surveyed water — was one rung. */
    at: function (id) {
      /* The harbour is not in the shelf — it is not water — but it is on the
         chart and every crossing starts or ends there, so it answers here. */
      if (id === 'harbour') {
        return (VF.placeData && VF.placeData.location.at) || [0, 0];
      }
      const l = BY_ID[id];
      return (l && l.at) || [0, 0];
    },
    distance: function (a, b) {
      const p = VF.locations.at(a), q = VF.locations.at(b);
      return Math.hypot(q[0] - p[0], q[1] - p[1]);
    },
    /* Bearing from one to another, in the compass sense — 0 is north and it
       runs clockwise. What lets somebody say "east" and mean it. */
    bearing: function (a, b) {
      const p = VF.locations.at(a), q = VF.locations.at(b);
      const deg = Math.atan2(q[0] - p[0], -(q[1] - p[1])) * 180 / Math.PI;
      return (deg + 360) % 360;
    },
    compass: function (a, b) {
      const N = ['north', 'north-east', 'east', 'south-east',
                 'south', 'south-west', 'west', 'north-west'];
      return N[Math.round(VF.locations.bearing(a, b) / 45) % 8];
    },
    /* How deep it is, and the shallowest a hull may draw to get in. Answered
       here so that a place with neither reads as open water rather than as a
       crash. */
    sounding: function (id) { const l = BY_ID[id]; return (l && l.depthM) || 0; },
    shoal: function (id) { const l = BY_ID[id]; return l && l.shoal !== undefined ? l.shoal : 99; }
  };
})(window.VF = window.VF || {});
