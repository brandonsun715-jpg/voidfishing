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
      /* `silhouette: 'none'` is not an omission. This zone has a landmark
         graph with a headland in it, and the generic procedural ridgeline was
         drawn on top of that — two horizons competing, and the one that means
         something lost. The trench and the flats already dropped it for the
         same reason. */
      horizon: 'moon', silhouette: 'none', depth: 0.42, void: 0.00,
      /* Ordinary air over an ordinary coast: a low light, a moderate deck of
         cloud not far up, and weather allowed to do whatever it likes to it.
         This is the reference the other eight are different FROM. */
      air: { sky: 'open', water: 'open', elev: 0.26, disc: 0.030,
             cloud: 0.34, cloudY: 0.30,
             /* Neutral, and deliberately the least graded place in the game.
                Cool in the shadows and warm at the top is what daylight on
                water does on its own; this is the reference the other eight
                are graded AWAY from, so it gets almost nothing. */
             grade: { sat: 1.03, con: 1.06, lift: [0.004, 0.010, 0.022],
                      gain: [1.02, 1.00, 0.97], bloom: 1.0 } },
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
      /* A bowl in the lee of the land, so the weather mostly goes over the
         top of it — wxCloud is what a place is allowed to catch, and this one
         catches about half. What it has instead is the moon: high, and twice
         the angular size of anything else in the game, because the whole
         zone is built around its reflection. */
      air: { sky: 'open', water: 'open', elev: 0.52, disc: 0.062,
             cloud: 0.10, wxCloud: 0.55, cloudY: 0.52, zen: '#05080f',
             /* One light and nothing else, so the shadows go blue and stay
                there and the highlight is left clean — a moon is white and
                grading it warm would be a lie the whole zone is built on. */
             grade: { sat: 1.00, con: 1.10, lift: [0.000, 0.008, 0.030],
                      gain: [0.98, 1.00, 1.03], bloom: 1.25, thresh: 0.92 } },
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
      /* Glass. The water model reflects the sky it is under and shows its own
         bed through it, which is the only honest way to draw "everything above
         is doubled below" — the old zone painted a second horizon and hoped.
         The deck sits very high, so the shapes up there are small, distant and
         slow, and the sky reads as enormous. */
      air: { sky: 'open', water: 'mirror', elev: 0.40, disc: 0.036,
             cloud: 0.16, cloudY: 0.72, zen: '#050d14',
             bed: '#5e7a72', cloudTint: '#cfeee8',
             /* Glass: hard, clean, faintly cold, and the highest contrast in
                the game because a mirror has no midtones of its own — what it
                has is the sky's, twice. */
             grade: { sat: 0.98, con: 1.16, lift: [0.000, 0.006, 0.008],
                      gain: [0.97, 1.01, 1.01], bloom: 1.1, thresh: 0.96 } },
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
      /* Weather sits on this place. A low deck means big fast shapes directly
         overhead rather than a distant ceiling, and the swell model puts a
         long heave under the chop and doubles the extinction, so the far
         water is gone well before the horizon is. That is the sensation of
         depth done with air rather than with a darker blue. */
      air: { sky: 'open', water: 'swell', elev: 0.18, disc: 0.022,
             cloud: 0.72, cloudY: 0.22, zen: '#04070c', cloudTint: '#5d7080',
             /* Crushed and drained. Weather sits on this place; a photograph
                of it would have no colour in it worth the name and a very
                long way between the darkest thing and the lightest. Bloom is
                held down hard — there is nothing down here bright enough to
                bloom and letting the overcast do it would make fog. */
             grade: { sat: 0.86, con: 1.20, lift: [0.000, 0.004, 0.010],
                      gain: [0.96, 0.99, 1.02], bloom: 0.45, thresh: 1.25 } },
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
      /* There is no sky here. It is a cavern, so the vertical ramp runs the
         other way — darkest straight up, and what light there is comes off
         the underside of the roof near the water. No deck, no body, and the
         weather is not admitted at all. */
      air: { sky: 'closed', water: 'open', elev: 0.55, disc: 0.0,
             cloud: 0, wxCloud: 0, zen: '#0a0618',
             /* Lit from inside the rock rather than from a sky, so the
                highlights carry the crystal's colour and the shadows have
                nothing in them at all. The one zone where bloom is the point:
                the light sources ARE the geology. */
             grade: { sat: 1.08, con: 1.12, lift: [0.006, 0.000, 0.014],
                      gain: [1.04, 0.98, 1.06], bloom: 1.6, thresh: 0.82 } },
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
      /* Also closed, but by something built rather than by rock. The ring is
         drawn over this by the zone layer; what the air does is make the space
         read as INSIDE, which is the half a painted ring cannot do on its own. */
      air: { sky: 'closed', water: 'open', elev: 0.62, disc: 0.0,
             cloud: 0, wxCloud: 0.25, zen: '#080a1c',
             /* Old, and lit by something that has been on for four hundred
                years. Amber in the highlights, dust in the blacks, and the
                lowest contrast in the game — nothing here is crisp any more. */
             grade: { sat: 0.94, con: 0.98, lift: [0.020, 0.016, 0.010],
                      gain: [1.05, 1.00, 0.93], bloom: 0.9, thresh: 1.0 } },
      weather: ['clear', 'aurora', 'meteor', 'eclipse', 'storm'],
      music: { root: 52, scale: [0, 2, 5, 7, 9], tempo: 0.13, pad: 0.75 } },

    { id: 'nowhere', name: 'The Nowhere Sea', level: 45,
      /* off the chart's south-west, where the soundings stop agreeing */
      at: [-8.5, 8.2], shoal: 8.0, depthM: 3200,
      tag: 'no coordinates were recorded',
      desc: 'You arrived here. You cannot describe the journey. The water is fine and the fishing is excellent.',
      hint: 'The charts stop. The water does not.',
      rarityBoost: 3.10, valueBoost: 3.40, xpBoost: 36.0, biteBoost: 0.90,
      /* NOT PURPLE. It was: a violet sky over violet water under a violet
         light, and the result was a screensaver — the one visual note this
         zone had was a hue, and a hue is the cheapest way there is to say
         "strange". The colours are nearly neutral now and very slightly sick,
         and the wrongness is carried by the LIGHT instead: an unbounded sky
         that never converges, three landmarks that are the same object, and a
         grade whose shadows are warm and whose highlights are cold — which is
         the reverse of every daylit scene on Earth, and which the eye reads
         as wrong before it can say why. */
      sky: ['#0a0c0b', '#181e1a'], water: ['#0e1412', '#020403'], glow: '#c2cabc',
      fog: '#141a17', fogAmt: 0.55, stars: 0.68, starTint: '#dfe6d8',
      horizon: 'tear', silhouette: 'none', depth: 0.55, void: 0.74,
      /* Unbounded: the dome does not converge and the aerial perspective is
         switched off entirely, so nothing about the air tells you how far away
         anything is. Every other place in the game hands you distance for
         free. This one refuses, and that refusal is the zone. */
      air: { sky: 'unbounded', water: 'open', elev: 0.44, disc: 0.0,
             cloud: 0.22, wxCloud: 0.40, cloudY: 0.90, zen: '#06040d',
             /* Split-toned the wrong way round. Every natural scene on Earth
                has warm light and cool shadow, because the sun is warm and
                the shadows are lit by the sky; this has cool light and warm
                shadow, which no daylight does and which the eye reads as
                wrong before it can say why. That is the whole grade — NOT
                purple, which is what this zone kept being given and what made
                it look like a screensaver rather than a place. */
             grade: { sat: 0.78, con: 1.10, lift: [0.030, 0.016, 0.000],
                      gain: [0.93, 0.99, 1.06], bloom: 0.8, thresh: 1.05 } },
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
      /* The light is under you and the water does not move. Inverted sky puts
         the brightness at the bottom of the frame and sends it up through the
         surface; still water has no waves at all — not calm ones, none — and
         mirrors the wrong way up. Every visual habit the other eight places
         built is broken here on purpose. */
      air: { sky: 'inverted', water: 'still', elev: 0.05, disc: 0.090,
             cloud: 0, wxCloud: 0, zen: '#000000', bed: '#0d0424',
             /* Almost no colour and almost no light, and one thing that is
                bright. The blacks are true black — nothing is lifted, because
                a lifted black says there is air between you and it and there
                is not. */
             grade: { sat: 0.82, con: 1.24, lift: [0.000, 0.000, 0.000],
                      gain: [1.00, 0.96, 1.04], bloom: 1.5, thresh: 0.80 } },
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
