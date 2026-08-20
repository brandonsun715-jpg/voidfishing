/* VOID FISHING — the catalogue.
   art{} drives the procedural fish renderer (js/render/fishArt.js):
     body   torpedo | round | eel | serpent | blob | jelly | ray | shard | orb |
            crustacean | whale | ribbon | anomaly | fractal
     fin    normal | long | veil | spiky | wing | frill | none
     eyes   0..6      glow 0..1
     ex[]   tentacles halo rings crystals antenna horns runes spine bubbles
            fracture chains stars teeth lantern mask threads wings
   locs/baits/time/weather are preference tags. Empty array = "anywhere".

   The !@#$%^&$# tier does not take any of that. Nothing in it is a fish and
   nothing in it is drawn like one: those entries carry body 'object' plus an
   object key, and js/render/fishArt.js draws the thing itself — a hook is a
   hook, a chair is a chair — with the wrongness laid over the top rather than
   built into the anatomy. If you are tempted to give one fins, it belongs in
   Void instead. */
(function (VF) {
  'use strict';

  const F = [

  /* ============================ COMMON ============================ */
  { id: 'smallmouth', name: 'Smallmouth', rarity: 'common', value: 12, kg: [0.2, 2.4], m: [0.12, 0.45], diff: 0.10,
    desc: 'Blunt, stubborn, unbothered by the absence of a sky. The first fish almost everyone catches.',
    locs: ['shore', 'basin'], baits: ['worm', 'minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0, c1: '#6c7f8e', c2: '#48586a', c3: '#b9cbd6', ex: [] } },

  { id: 'bluefin_min', name: 'Lesser Bluefin', rarity: 'common', value: 18, kg: [0.5, 4.2], m: [0.2, 0.6], diff: 0.14,
    desc: 'A small cousin of something much larger that no longer exists.',
    locs: ['shore', 'basin'], baits: ['minnow'], time: ['day', 'dawn'], weather: [],
    art: { body: 'torpedo', fin: 'long', eyes: 1, glow: 0.05, c1: '#4b6f9c', c2: '#2c4463', c3: '#a9cdf0', ex: [] } },

  { id: 'river_trout', name: 'River Trout', rarity: 'common', value: 15, kg: [0.3, 3.1], m: [0.18, 0.55], diff: 0.12,
    desc: 'Speckled like a night sky in miniature. It swims against currents that are not there.',
    locs: ['shore'], baits: ['worm', 'cluster'], time: ['dawn'], weather: ['rain'],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0, c1: '#7d8b63', c2: '#4f5a3f', c3: '#e2d3a6', ex: ['stars'] } },

  { id: 'pale_perch', name: 'Pale Perch', rarity: 'common', value: 14, kg: [0.2, 2.0], m: [0.1, 0.38], diff: 0.10,
    desc: 'Colourless, patient, entirely uninterested in you.',
    locs: ['shore', 'basin', 'flats'], baits: ['worm'], time: [], weather: [],
    art: { body: 'round', fin: 'spiky', eyes: 1, glow: 0, c1: '#b3bcc4', c2: '#7d868f', c3: '#e8eef2', ex: [] } },

  { id: 'silt_carp', name: 'Silt Carp', rarity: 'common', value: 22, kg: [1.0, 8.5], m: [0.3, 0.85], diff: 0.20,
    desc: 'Feeds on sediment that drifts up from nowhere. Its whiskers taste the dark.',
    locs: ['shore', 'basin'], baits: ['worm', 'deep'], time: ['night'], weather: [],
    art: { body: 'round', fin: 'normal', eyes: 1, glow: 0, c1: '#8a7554', c2: '#5d4c34', c3: '#c8b487', ex: ['antenna'] } },

  { id: 'drift_minnow', name: 'Drift Minnow', rarity: 'common', value: 8, kg: [0.02, 0.3], m: [0.04, 0.12], diff: 0.05,
    desc: 'Barely a fish. Mostly a suggestion of one, moving quickly.',
    locs: ['shore', 'basin', 'flats'], baits: ['worm', 'minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0.1, c1: '#9fd8e0', c2: '#6ba7b4', c3: '#e6fbff', ex: [] } },

  { id: 'stone_loach', name: 'Stone Loach', rarity: 'common', value: 19, kg: [0.1, 1.2], m: [0.1, 0.3], diff: 0.16,
    desc: 'Hides beneath rocks that fell from a shore that was never built.',
    locs: ['shore', 'flats'], baits: ['worm', 'deep'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'none', eyes: 1, glow: 0, c1: '#6a6355', c2: '#413d34', c3: '#a49a84', ex: ['antenna'] } },

  { id: 'moth_fry', name: 'Mothfry', rarity: 'common', value: 26, kg: [0.05, 0.6], m: [0.06, 0.2], diff: 0.08,
    desc: 'Swims toward any light it finds, including the one you brought.',
    locs: ['basin', 'flats'], baits: ['glowworm'], time: ['night', 'sunset'], weather: [],
    art: { body: 'ribbon', fin: 'veil', eyes: 2, glow: 0.35, c1: '#d8c8a0', c2: '#a08f68', c3: '#fff3d0', ex: ['wings'] } },

  { id: 'glass_smelt', name: 'Glass Smelt', rarity: 'common', value: 24, kg: [0.05, 0.8], m: [0.08, 0.24], diff: 0.09,
    desc: 'Transparent enough that you can read the water through it.',
    locs: ['flats', 'basin'], baits: ['minnow', 'prism'], time: [], weather: ['clear'],
    art: { body: 'torpedo', fin: 'veil', eyes: 1, glow: 0.25, c1: '#cfeaf2', c2: '#9cc3d0', c3: '#ffffff', ex: [] } },

  { id: 'ash_bream', name: 'Ash Bream', rarity: 'common', value: 21, kg: [0.4, 3.6], m: [0.15, 0.5], diff: 0.15,
    desc: 'Grey as cooled cinder. Tastes, reportedly, of nothing whatsoever.',
    locs: ['shore', 'basin', 'trench'], baits: ['worm', 'ember'], time: [], weather: ['overcast', 'storm'],
    art: { body: 'round', fin: 'normal', eyes: 1, glow: 0, c1: '#767b82', c2: '#4a4e55', c3: '#b6bbc2', ex: [] } },

  { id: 'nettle_eel', name: 'Nettle Eel', rarity: 'common', value: 30, kg: [0.4, 5.0], m: [0.4, 1.4], diff: 0.24,
    desc: 'Stings on contact. Fishermen call it the reason for gloves.',
    locs: ['basin', 'flats'], baits: ['worm', 'deep'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'frill', eyes: 1, glow: 0.12, c1: '#5d7f4e', c2: '#374d2e', c3: '#a8d18e', ex: ['spine'] } },

  { id: 'tin_sardine', name: 'Tin Sardine', rarity: 'common', value: 10, kg: [0.03, 0.4], m: [0.05, 0.16], diff: 0.05,
    desc: 'Arrives in shoals. Leaves in shoals. Individually, unremarkable.',
    locs: ['shore', 'basin', 'flats', 'trench'], baits: ['minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0.05, c1: '#aeb8bd', c2: '#79848a', c3: '#e4edf1', ex: [] } },

  /* ============================ UNCOMMON ============================ */
  { id: 'silver_pike', name: 'Silver Pike', rarity: 'uncommon', value: 95, kg: [2.0, 16.0], m: [0.5, 1.35], diff: 0.34,
    desc: 'A blade with opinions. It hunts by the light of whatever moon is out.',
    locs: ['basin', 'flats'], baits: ['minnow', 'glowworm'], time: ['night', 'dawn'], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.1, c1: '#c3cfd8', c2: '#7f8d99', c3: '#ffffff', ex: ['teeth'] } },

  { id: 'glass_carp', name: 'Glass Carp', rarity: 'uncommon', value: 130, kg: [3.0, 22.0], m: [0.4, 1.1], diff: 0.30,
    desc: 'You can watch its heart work. Most people look away.',
    locs: ['flats', 'basin'], baits: ['prism', 'worm'], time: [], weather: ['clear', 'aurora'],
    art: { body: 'round', fin: 'veil', eyes: 1, glow: 0.3, c1: '#bfe8f5', c2: '#7fb6cc', c3: '#ffffff', ex: ['bubbles'] } },

  { id: 'lantern_gob', name: 'Lantern Goby', rarity: 'uncommon', value: 110, kg: [0.2, 2.2], m: [0.1, 0.35], diff: 0.22,
    desc: 'Carries a small light on a stalk. Nobody knows what it is looking for.',
    locs: ['trench', 'flats'], baits: ['glowworm', 'deep'], time: ['night'], weather: ['fog'],
    art: { body: 'blob', fin: 'normal', eyes: 2, glow: 0.55, c1: '#4d6b7a', c2: '#283c46', c3: '#ffe9a0', ex: ['lantern'] } },

  { id: 'ribbonfish', name: 'Ribbonfish', rarity: 'uncommon', value: 145, kg: [1.0, 9.0], m: [1.0, 3.2], diff: 0.38,
    desc: 'Long as a thought you cannot finish. Moves like a banner in slow wind.',
    locs: ['basin', 'trench'], baits: ['minnow', 'deep'], time: ['sunset'], weather: [],
    art: { body: 'ribbon', fin: 'veil', eyes: 1, glow: 0.2, c1: '#dfd3e8', c2: '#9d8fb0', c3: '#ffffff', ex: [] } },

  { id: 'copper_ray', name: 'Copper Ray', rarity: 'uncommon', value: 175, kg: [4.0, 30.0], m: [0.6, 1.8], diff: 0.40,
    desc: 'Glides without disturbing the surface. Leaves a faint metallic taste in the air.',
    locs: ['flats', 'trench'], baits: ['deep', 'worm'], time: [], weather: ['overcast'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.08, c1: '#b07545', c2: '#6f4526', c3: '#e8b982', ex: ['spine'] } },

  { id: 'fog_grouper', name: 'Fog Grouper', rarity: 'uncommon', value: 160, kg: [5.0, 44.0], m: [0.5, 1.4], diff: 0.44,
    desc: 'Only surfaces when visibility is poor. Assumed to prefer privacy.',
    locs: ['basin', 'trench'], baits: ['deep', 'cluster'], time: [], weather: ['fog', 'overcast'],
    art: { body: 'blob', fin: 'normal', eyes: 1, glow: 0.05, c1: '#8f9aa2', c2: '#5a646c', c3: '#cfd8de', ex: [] } },

  { id: 'thorn_perch', name: 'Thorn Perch', rarity: 'uncommon', value: 88, kg: [0.6, 5.5], m: [0.2, 0.6], diff: 0.32,
    desc: 'Every fin is a warning. It has never had to use them twice.',
    locs: ['shore', 'flats'], baits: ['cluster', 'worm'], time: [], weather: [],
    art: { body: 'round', fin: 'spiky', eyes: 1, glow: 0, c1: '#7a4f5e', c2: '#4a2c37', c3: '#d29aa8', ex: ['spine'] } },

  { id: 'moon_snail', name: 'Moonsnail', rarity: 'uncommon', value: 120, kg: [0.3, 4.0], m: [0.1, 0.4], diff: 0.18,
    desc: 'A shell containing one full phase of a moon. It is currently waning.',
    locs: ['basin', 'flats'], baits: ['worm', 'glowworm'], time: ['night'], weather: [],
    art: { body: 'orb', fin: 'none', eyes: 2, glow: 0.4, c1: '#e2e0ce', c2: '#a09d88', c3: '#fffbe8', ex: ['rings', 'antenna'] } },

  { id: 'kelp_wraith', name: 'Kelp Wraith', rarity: 'uncommon', value: 155, kg: [1.5, 12.0], m: [0.8, 2.4], diff: 0.36,
    desc: 'Grew around a fish until there was no meaningful difference between them.',
    locs: ['shore', 'basin'], baits: ['cluster', 'worm'], time: ['dawn', 'night'], weather: ['rain'],
    art: { body: 'ribbon', fin: 'frill', eyes: 2, glow: 0.15, c1: '#4f6b4a', c2: '#2b3d2a', c3: '#9dc48c', ex: ['threads'] } },

  { id: 'quartz_darter', name: 'Quartz Darter', rarity: 'uncommon', value: 190, kg: [0.4, 3.0], m: [0.15, 0.5], diff: 0.28,
    desc: 'Refracts the lure into six lures. Bites all of them, catches none.',
    locs: ['flats', 'abyss'], baits: ['prism'], time: [], weather: ['clear', 'aurora'],
    art: { body: 'shard', fin: 'spiky', eyes: 2, glow: 0.35, c1: '#cfe3ff', c2: '#8fa9cc', c3: '#ffffff', ex: ['crystals'] } },

  { id: 'ember_roach', name: 'Ember Roach', rarity: 'uncommon', value: 135, kg: [0.3, 3.4], m: [0.15, 0.5], diff: 0.26,
    desc: 'Warm to the touch. Keeps a small coal somewhere behind its eyes.',
    locs: ['trench', 'basin'], baits: ['ember'], time: ['sunset'], weather: ['meteor', 'storm'],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.45, c1: '#a34a2c', c2: '#611f14', c3: '#ffb066', ex: [] } },

  { id: 'hollow_cod', name: 'Hollow Cod', rarity: 'uncommon', value: 105, kg: [2.0, 18.0], m: [0.4, 1.2], diff: 0.30,
    desc: 'Weighs less than it should. Something was removed from it, neatly.',
    locs: ['trench', 'basin'], baits: ['deep', 'minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'normal', eyes: 0, glow: 0.05, c1: '#8b8e84', c2: '#565951', c3: '#c4c7bb', ex: ['fracture'] } },

  /* ============================ RARE ============================ */
  { id: 'golden_bass', name: 'Golden Bass', rarity: 'rare', value: 620, kg: [3.0, 26.0], m: [0.4, 1.1], diff: 0.46,
    desc: 'The first genuinely valuable thing most anglers pull out of the void.',
    locs: ['basin', 'flats'], baits: ['minnow', 'glowworm'], time: ['dawn', 'sunset'], weather: [],
    art: { body: 'round', fin: 'long', eyes: 1, glow: 0.3, c1: '#e2ac3c', c2: '#996d18', c3: '#fff0b4', ex: [] } },

  { id: 'deepwater_eel', name: 'Deepwater Eel', rarity: 'rare', value: 780, kg: [4.0, 40.0], m: [1.2, 3.6], diff: 0.58,
    desc: 'Comes up from a depth the trench does not officially have.',
    locs: ['trench', 'abyss'], baits: ['deep'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'frill', eyes: 2, glow: 0.25, c1: '#2f4a5c', c2: '#14232e', c3: '#6fd0e8', ex: ['teeth', 'spine'] } },

  { id: 'mirror_tetra', name: 'Mirror Tetra', rarity: 'rare', value: 540, kg: [0.1, 1.4], m: [0.08, 0.3], diff: 0.34,
    desc: 'You see your own face on its flank. It is not doing what you are doing.',
    locs: ['flats', 'abyss'], baits: ['prism', 'star'], time: [], weather: ['clear'],
    art: { body: 'shard', fin: 'veil', eyes: 2, glow: 0.4, c1: '#dfe9f2', c2: '#a3b4c6', c3: '#ffffff', ex: ['mask'] } },

  { id: 'tidewalker', name: 'Tidewalker Crab', rarity: 'rare', value: 690, kg: [1.0, 14.0], m: [0.2, 0.9], diff: 0.52,
    desc: 'Walks along the underside of the surface as though it were a floor.',
    locs: ['shore', 'flats', 'trench'], baits: ['worm', 'cluster'], time: [], weather: ['rain', 'storm'],
    art: { body: 'crustacean', fin: 'legs', eyes: 4, glow: 0.1, c1: '#8f5a6a', c2: '#4f2c38', c3: '#e0a2ae', ex: ['spine'] } },

  { id: 'starling_koi', name: 'Starling Koi', rarity: 'rare', value: 880, kg: [1.0, 12.0], m: [0.3, 0.9], diff: 0.44,
    desc: 'Its markings match a constellation nobody has bothered to name.',
    locs: ['basin', 'flats', 'cradle'], baits: ['star', 'glowworm'], time: ['night'], weather: ['clear', 'meteor'],
    art: { body: 'round', fin: 'veil', eyes: 1, glow: 0.5, c1: '#f3f0ff', c2: '#8f86c2', c3: '#ffe9a0', ex: ['stars'] } },

  { id: 'brine_lantern', name: 'Brine Lanternfish', rarity: 'rare', value: 730, kg: [0.5, 6.0], m: [0.2, 0.7], diff: 0.42,
    desc: 'Twelve small lights along the belly, blinking in an order that means something.',
    locs: ['trench', 'abyss'], baits: ['glowworm', 'deep'], time: ['night'], weather: ['fog'],
    art: { body: 'torpedo', fin: 'normal', eyes: 2, glow: 0.7, c1: '#2b3f52', c2: '#101d28', c3: '#8ef0ff', ex: ['lantern', 'teeth'] } },

  { id: 'shale_ray', name: 'Shale Ray', rarity: 'rare', value: 960, kg: [10.0, 90.0], m: [1.0, 2.8], diff: 0.60,
    desc: 'Flat as a closed door. Sinks like one too, if you let the line go slack.',
    locs: ['trench', 'abyss'], baits: ['deep', 'cluster'], time: [], weather: ['storm', 'overcast'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.06, c1: '#4a5058', c2: '#22262b', c3: '#8d97a2', ex: ['spine', 'runes'] } },

  { id: 'weeping_pike', name: 'Weeping Pike', rarity: 'rare', value: 820, kg: [3.0, 30.0], m: [0.6, 1.8], diff: 0.56,
    desc: 'Water runs from its eyes in a place with no gravity to pull it down.',
    locs: ['basin', 'trench'], baits: ['minnow', 'deep'], time: ['sunset', 'night'], weather: ['rain'],
    art: { body: 'torpedo', fin: 'spiky', eyes: 2, glow: 0.2, c1: '#5b6c93', c2: '#2e3853', c3: '#b9c9ef', ex: ['teeth', 'threads'] } },

  { id: 'hush_jelly', name: 'Hush Jelly', rarity: 'rare', value: 640, kg: [0.5, 9.0], m: [0.3, 1.6], diff: 0.30,
    desc: 'Ambient sound drops by half within a metre of it. Nobody has explained why.',
    locs: ['abyss', 'trench'], baits: ['deep', 'prism'], time: [], weather: ['fog'],
    art: { body: 'jelly', fin: 'none', eyes: 0, glow: 0.5, c1: '#a8d8e8', c2: '#5f8fa8', c3: '#e8fbff', ex: ['tentacles', 'bubbles'] } },

  { id: 'gilt_marlinet', name: 'Gilt Marlinet', rarity: 'rare', value: 1050, kg: [8.0, 70.0], m: [1.2, 2.6], diff: 0.62,
    desc: 'A juvenile of something legendary. Already fights like it knows.',
    locs: ['flats', 'trench'], baits: ['minnow', 'star'], time: ['dawn'], weather: ['clear'],
    art: { body: 'torpedo', fin: 'long', eyes: 1, glow: 0.25, c1: '#3f6b8f', c2: '#1f3a52', c3: '#ffd98a', ex: ['spine'] } },

  { id: 'clockfish', name: 'Clockfish', rarity: 'rare', value: 1150, kg: [0.5, 5.0], m: [0.2, 0.6], diff: 0.48,
    desc: 'Ticks. Slows when you reel. Stops entirely the moment it leaves the water.',
    locs: ['flats', 'cradle'], baits: ['prism', 'star'], time: [], weather: ['aurora', 'eclipse'],
    art: { body: 'orb', fin: 'normal', eyes: 3, glow: 0.45, c1: '#c9b478', c2: '#7d6a44', c3: '#ffe6a8', ex: ['rings', 'runes'] } },

  /* ============================ EPIC ============================ */
  { id: 'phantom_koi', name: 'Phantom Koi', rarity: 'epic', value: 3400, kg: [2.0, 24.0], m: [0.4, 1.2], diff: 0.60,
    desc: 'Passes through the net twice before deciding to be caught on the third.',
    locs: ['basin', 'flats', 'abyss'], baits: ['star', 'prism'], time: ['night'], weather: ['fog', 'eclipse'],
    art: { body: 'round', fin: 'veil', eyes: 2, glow: 0.6, c1: '#e6ecff', c2: '#7b86b8', c3: '#ffffff', ex: ['threads'] } },

  { id: 'moonfish', name: 'Moonfish', rarity: 'epic', value: 4200, kg: [6.0, 160.0], m: [0.8, 3.4], diff: 0.68,
    desc: 'Perfectly circular. Reflects light that has not arrived yet.',
    locs: ['basin', 'abyss', 'cradle'], baits: ['glowworm', 'star'], time: ['night'], weather: ['clear', 'eclipse'],
    art: { body: 'orb', fin: 'long', eyes: 1, glow: 0.75, c1: '#f2f0e2', c2: '#a8a693', c3: '#ffffff', ex: ['halo'] } },

  { id: 'abyss_angler', name: 'Abyssal Angler', rarity: 'epic', value: 5100, kg: [10.0, 130.0], m: [0.6, 2.2], diff: 0.76,
    desc: 'It fishes too. Its bait is prettier than yours and it has been at this longer.',
    locs: ['abyss', 'trench'], baits: ['deep', 'glowworm'], time: [], weather: ['fog', 'storm'],
    art: { body: 'blob', fin: 'spiky', eyes: 2, glow: 0.65, c1: '#231d33', c2: '#0d0a15', c3: '#ffd45c', ex: ['lantern', 'teeth', 'spine'] } },

  { id: 'stormcaller', name: 'Stormcaller Ray', rarity: 'epic', value: 4700, kg: [20.0, 240.0], m: [1.5, 4.2], diff: 0.74,
    desc: 'Weather follows it. Whether it causes the weather is an open question.',
    locs: ['trench', 'cradle'], baits: ['ember', 'deep'], time: [], weather: ['storm', 'rain'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.5, c1: '#3d4a7a', c2: '#1a2140', c3: '#9fd8ff', ex: ['runes', 'spine'] } },

  { id: 'aurora_serpent', name: 'Aurora Serpent', rarity: 'epic', value: 6200, kg: [15.0, 190.0], m: [2.5, 7.0], diff: 0.72,
    desc: 'Twelve metres of moving colour. Leaves an afterimage that lasts a full minute.',
    locs: ['cradle', 'abyss'], baits: ['prism', 'star'], time: ['night', 'dawn'], weather: ['aurora'],
    art: { body: 'serpent', fin: 'frill', eyes: 2, glow: 0.7, c1: '#4bd6c0', c2: '#2a6f8f', c3: '#c8ffe8', ex: ['threads'] } },

  { id: 'grave_tuna', name: 'Sepulchre Tuna', rarity: 'epic', value: 3900, kg: [40.0, 420.0], m: [1.2, 3.2], diff: 0.80,
    desc: 'Heavy, cold, and dressed in something like stone. Fights in complete silence.',
    locs: ['trench', 'abyss'], baits: ['deep', 'cluster'], time: [], weather: ['overcast', 'eclipse'],
    art: { body: 'torpedo', fin: 'normal', eyes: 0, glow: 0.1, c1: '#5e5a52', c2: '#2c2a26', c3: '#a8a196', ex: ['runes', 'fracture'] } },

  { id: 'prism_ray', name: 'Prismatic Manta', rarity: 'epic', value: 5600, kg: [30.0, 300.0], m: [2.0, 5.5], diff: 0.70,
    desc: 'Splits the moonlight into eight colours, two of which you cannot name.',
    locs: ['abyss', 'cradle'], baits: ['prism'], time: [], weather: ['clear', 'aurora'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.65, c1: '#b8a8ff', c2: '#6f5fc0', c3: '#ffffff', ex: ['crystals', 'halo'] } },

  { id: 'thousand_eye', name: 'Thousand-Eye Bream', rarity: 'epic', value: 4400, kg: [3.0, 42.0], m: [0.3, 1.0], diff: 0.66,
    desc: 'It has been watching this spot far longer than you have been sitting at it.',
    locs: ['abyss', 'nowhere'], baits: ['star', 'void'], time: ['night'], weather: ['eclipse', 'fog'],
    art: { body: 'round', fin: 'frill', eyes: 6, glow: 0.4, c1: '#57406b', c2: '#2a1e36', c3: '#e0c8ff', ex: ['eyes_extra'] } },

  { id: 'cinder_marlin', name: 'Cinder Marlin', rarity: 'epic', value: 5900, kg: [50.0, 480.0], m: [2.0, 4.8], diff: 0.82,
    desc: 'Burns underwater. The line smokes. Reel carefully.',
    locs: ['trench', 'cradle'], baits: ['ember'], time: ['sunset'], weather: ['meteor', 'storm'],
    art: { body: 'torpedo', fin: 'long', eyes: 1, glow: 0.8, c1: '#7a2416', c2: '#3a0e08', c3: '#ffa040', ex: ['spine', 'teeth'] } },

  { id: 'null_jelly', name: 'Null Jelly', rarity: 'epic', value: 4800, kg: [1.0, 30.0], m: [0.5, 3.0], diff: 0.55,
    desc: 'Occupies space without appearing to be in it. Cold in a way that is not temperature.',
    locs: ['nowhere', 'abyss'], baits: ['void', 'deep'], time: [], weather: ['voidsurge', 'fog'],
    art: { body: 'jelly', fin: 'none', eyes: 0, glow: 0.55, c1: '#2a2340', c2: '#100c1c', c3: '#a88fff', ex: ['tentacles', 'threads'] } }
,

  /* ============================ LEGENDARY ============================ */
  { id: 'leviathan', name: 'Leviathan', rarity: 'legendary', value: 26000, kg: [400, 6200], m: [6, 22], diff: 0.90,
    desc: 'The reason the old charts say DO NOT CAST HERE in handwriting that gets worse toward the end.',
    locs: ['trench', 'abyss'], baits: ['deep', 'cluster', 'void'], time: ['night'], weather: ['storm', 'fog'],
    art: { body: 'whale', fin: 'wing', eyes: 2, glow: 0.2, c1: '#2c3a4a', c2: '#0f171f', c3: '#79a8c4', ex: ['teeth', 'spine', 'runes'] } },

  { id: 'ancient_marlin', name: 'Ancient Marlin', rarity: 'legendary', value: 19500, kg: [180, 2400], m: [3.5, 11], diff: 0.88,
    desc: 'Scarred by hooks in styles that have not been manufactured for four hundred years.',
    locs: ['flats', 'trench', 'cradle'], baits: ['minnow', 'star', 'ember'], time: ['dawn', 'sunset'], weather: ['clear'],
    art: { body: 'torpedo', fin: 'long', eyes: 1, glow: 0.3, c1: '#2f5a78', c2: '#132c3e', c3: '#ffd68a', ex: ['spine', 'runes', 'fracture'] } },

  { id: 'tide_empress', name: 'Tide Empress', rarity: 'legendary', value: 31000, kg: [90, 1400], m: [2.5, 8.5], diff: 0.86,
    desc: 'The water arranges itself around her. It has been doing so for some time.',
    locs: ['basin', 'cradle', 'abyss'], baits: ['prism', 'star'], time: ['night'], weather: ['aurora', 'clear'],
    art: { body: 'serpent', fin: 'veil', eyes: 2, glow: 0.7, c1: '#5fc8d8', c2: '#276a86', c3: '#ffffff', ex: ['halo', 'threads', 'crystals'] } },

  { id: 'hollow_king', name: 'The Hollow King', rarity: 'legendary', value: 38000, kg: [60, 900], m: [2, 6.5], diff: 0.92,
    desc: 'A crown of bone above nothing at all. It bows when landed. Nobody enjoys this.',
    locs: ['abyss', 'nowhere'], baits: ['void', 'deep'], time: ['night'], weather: ['eclipse', 'voidsurge'],
    art: { body: 'blob', fin: 'frill', eyes: 0, glow: 0.5, c1: '#3b3348', c2: '#171320', c3: '#e8d8a0', ex: ['horns', 'mask', 'runes'] } },

  { id: 'meteor_gar', name: 'Meteor Gar', rarity: 'legendary', value: 22000, kg: [120, 1600], m: [3, 9], diff: 0.84,
    desc: 'Enters the water from above at speed. Occasionally it does so directly onto your line.',
    locs: ['cradle', 'trench', 'flats'], baits: ['ember', 'star'], time: [], weather: ['meteor', 'storm'],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.85, c1: '#8a3a18', c2: '#3d1207', c3: '#ffd07a', ex: ['spine', 'stars', 'fracture'] } },

  { id: 'glass_leviathan', name: 'Glass Leviathan', rarity: 'legendary', value: 34000, kg: [300, 4000], m: [5, 16], diff: 0.89,
    desc: 'Entirely transparent. You watch the hook travel all the way through it and hold anyway.',
    locs: ['flats', 'abyss'], baits: ['prism', 'star'], time: [], weather: ['clear', 'aurora'],
    art: { body: 'whale', fin: 'veil', eyes: 2, glow: 0.6, c1: '#cfe8f5', c2: '#7fa8bc', c3: '#ffffff', ex: ['crystals', 'bubbles'] } },

  { id: 'drowned_choir', name: 'The Drowned Choir', rarity: 'legendary', value: 29000, kg: [30, 500], m: [1.5, 5], diff: 0.87,
    desc: 'Nine fish that share one mouth. When landed, all nine stop singing at once.',
    locs: ['nowhere', 'abyss'], baits: ['void', 'deep'], time: ['night'], weather: ['fog', 'voidsurge'],
    art: { body: 'anomaly', fin: 'frill', eyes: 5, glow: 0.45, c1: '#43405e', c2: '#1a1828', c3: '#b8d8ff', ex: ['teeth', 'threads', 'eyes_extra'] } },

  { id: 'sunless_whale', name: 'Sunless Whale', rarity: 'legendary', value: 41000, kg: [900, 12000], m: [10, 34], diff: 0.93,
    desc: 'Never encountered light. Reacts to your lantern the way you would react to a second sun.',
    locs: ['abyss', 'trench'], baits: ['deep', 'glowworm'], time: [], weather: ['fog', 'overcast'],
    art: { body: 'whale', fin: 'wing', eyes: 0, glow: 0.15, c1: '#232c38', c2: '#0a0e14', c3: '#6f8ca8', ex: ['lantern', 'spine'] } },

  /* ============================ MYTHIC ============================ */
  { id: 'star_serpent', name: 'Star Serpent', rarity: 'mythic', value: 165000, kg: [200, 3400], m: [8, 40], diff: 0.94,
    desc: 'Its body is the gap between five stars. Landing it briefly rearranges the sky.',
    locs: ['cradle', 'nowhere', 'abyss'], baits: ['star', 'void'], time: ['night'], weather: ['meteor', 'clear', 'aurora'],
    art: { body: 'serpent', fin: 'veil', eyes: 2, glow: 0.9, c1: '#3a4a9a', c2: '#151a3c', c3: '#ffffff', ex: ['stars', 'halo', 'threads'] } },

  { id: 'astral_whale', name: 'Astral Whale', rarity: 'mythic', value: 240000, kg: [2000, 42000], m: [18, 70], diff: 0.96,
    desc: 'It has a weather system. It has a coastline. Something on it may be looking back.',
    locs: ['cradle', 'nowhere'], baits: ['star', 'void'], time: [], weather: ['aurora', 'meteor', 'eclipse'],
    art: { body: 'whale', fin: 'wing', eyes: 1, glow: 0.8, c1: '#3c4f8c', c2: '#141a38', c3: '#c8e0ff', ex: ['stars', 'rings', 'halo'] } },

  { id: 'eclipse_ray', name: 'Eclipse Ray', rarity: 'mythic', value: 128000, kg: [300, 5200], m: [6, 24], diff: 0.93,
    desc: 'Passes overhead. For eleven seconds there is no light anywhere and you keep reeling anyway.',
    locs: ['cradle', 'abyss', 'nowhere'], baits: ['void', 'prism'], time: [], weather: ['eclipse'],
    art: { body: 'ray', fin: 'wing', eyes: 3, glow: 0.7, c1: '#1c1626', c2: '#08060c', c3: '#ffb84a', ex: ['halo', 'runes', 'eyes_extra'] } },

  { id: 'cathedral_jelly', name: 'Cathedral Jelly', rarity: 'mythic', value: 152000, kg: [60, 1100], m: [4, 18], diff: 0.88,
    desc: 'Interior architecture. Arches, a nave, and a light at the far end you should not walk toward.',
    locs: ['abyss', 'nowhere'], baits: ['void', 'prism'], time: [], weather: ['fog', 'voidsurge'],
    art: { body: 'jelly', fin: 'none', eyes: 0, glow: 0.85, c1: '#8f7fe0', c2: '#3a2f70', c3: '#ffeec8', ex: ['tentacles', 'runes', 'halo', 'crystals'] } },

  { id: 'lantern_god', name: 'The Lanternbearer', rarity: 'mythic', value: 198000, kg: [120, 2200], m: [3, 14], diff: 0.95,
    desc: 'Holds a light out over the water as though waiting for someone. It has been waiting.',
    locs: ['nowhere', 'abyss'], baits: ['glowworm', 'void'], time: ['night'], weather: ['fog', 'eclipse'],
    art: { body: 'anomaly', fin: 'frill', eyes: 1, glow: 1, c1: '#2a2338', c2: '#0d0a14', c3: '#ffe08a', ex: ['lantern', 'halo', 'threads', 'mask'] } },

  { id: 'nine_tide', name: 'Nine-Tide Kraken', rarity: 'mythic', value: 176000, kg: [800, 16000], m: [10, 44], diff: 0.97,
    desc: 'Nine arms, nine tides, nine chances to lose the line. Most anglers manage about four.',
    locs: ['trench', 'abyss', 'nowhere'], baits: ['deep', 'void'], time: ['night'], weather: ['storm', 'voidsurge'],
    art: { body: 'anomaly', fin: 'none', eyes: 2, glow: 0.5, c1: '#4a2c52', c2: '#1a0f20', c3: '#ff8fc0', ex: ['tentacles', 'teeth', 'spine'] } },

  { id: 'first_catch', name: 'The First Catch', rarity: 'mythic', value: 210000, kg: [1, 40], m: [0.3, 2], diff: 0.90,
    desc: 'A perfectly ordinary fish. It is simply the oldest one. Everything else came after.',
    locs: ['shore', 'nowhere'], baits: ['worm'], time: ['dawn'], weather: ['clear'],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0.6, c1: '#d8cba8', c2: '#8f8262', c3: '#fff6d8', ex: ['halo', 'runes'] } },

  /* ============================ VOID ============================ */
  { id: 'forgotten_one', name: 'The Forgotten One', rarity: 'void', value: 1400000, kg: [500, 9000], m: [8, 40], diff: 0.97,
    desc: 'You will not be able to describe it afterwards. You will try. The Fishdex entry is your best attempt.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'anomaly', fin: 'none', eyes: 0, glow: 0.6, c1: '#241c3a', c2: '#080610', c3: '#9f7fff', ex: ['fracture', 'threads', 'mask'] } },

  { id: 'void_leviathan', name: 'Void Leviathan', rarity: 'void', value: 2350000, kg: [4000, 90000], m: [30, 140], diff: 0.99,
    desc: 'The trench is a bite mark. This is the thing that made it. It is not fully here yet.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null'], time: ['night'], weather: ['voidsurge', 'storm'],
    art: { body: 'whale', fin: 'wing', eyes: 3, glow: 0.75, c1: '#1a1030', c2: '#05030c', c3: '#b48aff', ex: ['teeth', 'spine', 'runes', 'eyes_extra', 'fracture'] } },

  { id: 'the_quiet', name: 'The Quiet', rarity: 'void', value: 1750000, kg: [0.01, 0.4], m: [0.02, 0.15], diff: 0.94,
    desc: 'Weighs almost nothing. While it is on the line, no sound reaches you at all. Not one.',
    locs: ['beneath', 'nowhere'], baits: ['null', 'void'], time: [], weather: ['fog', 'voidsurge'],
    art: { body: 'orb', fin: 'none', eyes: 0, glow: 0.9, c1: '#efe8ff', c2: '#8f84b8', c3: '#ffffff', ex: ['halo', 'rings'] } },

  { id: 'unfished', name: '???', rarity: 'void', value: 1950000, kg: [10, 700], m: [1, 12], diff: 0.98,
    desc: 'The record simply reads ???. Three anglers have caught it. None of them wrote more than that.',
    locs: ['beneath'], baits: ['null', 'void'], time: [], weather: ['voidsurge'],
    art: { body: 'fractal', fin: 'none', eyes: 4, glow: 0.7, c1: '#2c1f4a', c2: '#0a0614', c3: '#c8a0ff', ex: ['fracture', 'eyes_extra', 'runes'] } },

  { id: 'hookkeeper', name: 'The Hookkeeper', rarity: 'void', value: 2100000, kg: [80, 1800], m: [2, 12], diff: 0.98,
    desc: 'Every hook ever lost in the void is embedded in it, arranged with obvious care.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null', 'deep'], time: [], weather: ['voidsurge', 'storm'],
    art: { body: 'anomaly', fin: 'spiky', eyes: 2, glow: 0.4, c1: '#3a2a2a', c2: '#120c0c', c3: '#d8c8a0', ex: ['chains', 'spine', 'teeth', 'runes'] } },

  { id: 'lure_of_the_deep', name: 'That Which Baits', rarity: 'void', value: 2800000, kg: [200, 5000], m: [4, 26], diff: 0.99,
    desc: 'It has been fishing for you. The spot you chose was chosen. The rod felt lucky for a reason.',
    locs: ['beneath'], baits: ['null'], time: ['night'], weather: ['voidsurge', 'eclipse'],
    art: { body: 'anomaly', fin: 'frill', eyes: 6, glow: 0.9, c1: '#1c1228', c2: '#06040a', c3: '#ffca6a', ex: ['lantern', 'eyes_extra', 'teeth', 'threads', 'chains'] } },

  { id: 'gate_carp', name: 'Gatemouth Carp', rarity: 'void', value: 1600000, kg: [300, 7000], m: [5, 30], diff: 0.96,
    desc: 'Opens. Something else is on the other side. Closes before you can be sure what.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null'], time: [], weather: ['voidsurge', 'aurora'],
    art: { body: 'blob', fin: 'none', eyes: 0, glow: 0.85, c1: '#2a2050', c2: '#0a0818', c3: '#8fffe0', ex: ['rings', 'halo', 'teeth', 'fracture'] } },


  /* ---------- deep-water residents: the ordinary life of impossible places ---------- */
  { id: 'dust_minnow', name: 'Dust Minnow', rarity: 'common', value: 34, kg: [0.02, 0.5], m: [0.04, 0.15], diff: 0.08,
    desc: 'Feeds on whatever the crystals shed. There are millions of them and they are all identical.',
    locs: ['abyss', 'cradle', 'nowhere', 'beneath'], baits: ['worm', 'minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0.25, c1: '#a89cc0', c2: '#6d6488', c3: '#e8e0ff', ex: [] } },

  { id: 'cinder_fry', name: 'Cinder Fry', rarity: 'common', value: 29, kg: [0.05, 0.9], m: [0.06, 0.22], diff: 0.10,
    desc: 'Hatched somewhere warm. Has been getting steadily colder ever since and does not mind.',
    locs: ['trench', 'abyss', 'cradle'], baits: ['ember', 'worm'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.3, c1: '#8f5030', c2: '#4a2414', c3: '#ffb878', ex: [] } },

  { id: 'pale_drifter', name: 'Pale Drifter', rarity: 'common', value: 41, kg: [0.1, 1.6], m: [0.08, 0.34], diff: 0.09,
    desc: 'Does not swim. Is simply carried, and has been for an extremely long time.',
    locs: ['abyss', 'nowhere', 'beneath'], baits: ['worm', 'deep'], time: [], weather: [],
    art: { body: 'blob', fin: 'veil', eyes: 0, glow: 0.35, c1: '#d8d4e4', c2: '#8f8ba0', c3: '#ffffff', ex: ['threads'] } },

  { id: 'shardfish', name: 'Shardfish', rarity: 'uncommon', value: 210, kg: [0.3, 4.5], m: [0.12, 0.5], diff: 0.30,
    desc: 'A piece broke off one of the big crystals and decided, on its own, to start swimming.',
    locs: ['abyss', 'cradle'], baits: ['prism', 'deep'], time: [], weather: [],
    art: { body: 'shard', fin: 'spiky', eyes: 2, glow: 0.5, c1: '#b8a0ff', c2: '#6a52b0', c3: '#ffffff', ex: ['crystals'] } },

  { id: 'orbit_smelt', name: 'Orbit Smelt', rarity: 'uncommon', value: 240, kg: [0.1, 1.8], m: [0.08, 0.3], diff: 0.24,
    desc: 'Circles the same point forever. Nothing is at that point. It circles anyway.',
    locs: ['flats', 'cradle', 'nowhere'], baits: ['star', 'minnow'], time: [], weather: ['clear', 'meteor'],
    art: { body: 'torpedo', fin: 'long', eyes: 1, glow: 0.45, c1: '#d8c8a0', c2: '#8f8060', c3: '#fff4c8', ex: ['rings'] } },

  { id: 'ossuary_minnow', name: 'Ossuary Minnow', rarity: 'uncommon', value: 275, kg: [0.05, 1.2], m: [0.06, 0.28], diff: 0.28,
    desc: 'Made almost entirely of small bones, none of which are its own.',
    locs: ['trench', 'nowhere', 'beneath'], baits: ['deep', 'void'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'none', eyes: 2, glow: 0.15, c1: '#ddd4c0', c2: '#94897a', c3: '#fff8e8', ex: ['spine'] } },

  { id: 'hushperch', name: 'Hushperch', rarity: 'uncommon', value: 330, kg: [0.4, 6.0], m: [0.15, 0.55], diff: 0.34,
    desc: 'Opens its mouth to make a sound. Has not yet managed one. Keeps trying.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null', 'deep'], time: [], weather: [],
    art: { body: 'round', fin: 'frill', eyes: 2, glow: 0.4, c1: '#5a5478', c2: '#2a2640', c3: '#c8c0f0', ex: ['teeth'] } },

  { id: 'hollow_goby', name: 'Hollow Goby', rarity: 'uncommon', value: 185, kg: [0.1, 1.4], m: [0.07, 0.26], diff: 0.22,
    desc: 'You can see straight through the middle of it. It gets on fine.',
    locs: ['trench', 'abyss'], baits: ['deep', 'glowworm'], time: [], weather: ['fog'],
    art: { body: 'blob', fin: 'normal', eyes: 1, glow: 0.3, c1: '#4a6070', c2: '#22303c', c3: '#9fd0e0', ex: ['fracture'] } },

  { id: 'veinlight_eel', name: 'Veinlight Eel', rarity: 'rare', value: 1250, kg: [1.0, 16.0], m: [0.7, 2.6], diff: 0.50,
    desc: 'Lit from the inside along every vessel. You can watch it think about the hook.',
    locs: ['abyss', 'cradle', 'nowhere'], baits: ['glowworm', 'deep', 'prism'], time: [], weather: [],
    art: { body: 'eel', fin: 'frill', eyes: 2, glow: 0.7, c1: '#3a2a58', c2: '#160f26', c3: '#8ffce0', ex: ['threads', 'lantern'] } },

  { id: 'ringtail_carp', name: 'Ringtail Carp', rarity: 'rare', value: 1400, kg: [2.0, 28.0], m: [0.4, 1.3], diff: 0.52,
    desc: 'Trails a small perfect ring behind it. The ring is not attached to anything.',
    locs: ['cradle', 'nowhere'], baits: ['star', 'prism'], time: [], weather: ['aurora', 'meteor'],
    art: { body: 'round', fin: 'veil', eyes: 1, glow: 0.55, c1: '#e0c890', c2: '#8f7a48', c3: '#fff0c0', ex: ['rings', 'halo'] } },

  { id: 'seam_ray', name: 'Seam Ray', rarity: 'rare', value: 1700, kg: [6.0, 70.0], m: [0.9, 3.0], diff: 0.60,
    desc: 'Swims along a join in the water. Where it passes, the join is briefly open.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'deep'], time: [], weather: ['voidsurge', 'fog'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.5, c1: '#2c2050', c2: '#0e0820', c3: '#b48aff', ex: ['fracture', 'runes'] } },

  { id: 'ashfall_koi', name: 'Ashfall Koi', rarity: 'rare', value: 1150, kg: [1.5, 20.0], m: [0.35, 1.1], diff: 0.48,
    desc: 'Grey flakes come off it constantly and never reach the bottom.',
    locs: ['abyss', 'cradle', 'beneath'], baits: ['ember', 'cluster'], time: [], weather: [],
    art: { body: 'round', fin: 'veil', eyes: 1, glow: 0.3, c1: '#8f8880', c2: '#4a4540', c3: '#ffd0a8', ex: ['stars'] } },

  { id: 'gravity_bass', name: 'Gravity Bass', rarity: 'epic', value: 8200, kg: [12.0, 220.0], m: [0.6, 2.4], diff: 0.76,
    desc: 'Weighs whatever it has decided to weigh. It changes its mind during the fight.',
    locs: ['cradle', 'nowhere', 'beneath'], baits: ['star', 'void'], time: [], weather: [],
    art: { body: 'round', fin: 'normal', eyes: 1, glow: 0.5, c1: '#3a3a6a', c2: '#14142c', c3: '#c0c0ff', ex: ['rings', 'runes'] } },

  { id: 'echo_pike', name: 'Echo Pike', rarity: 'epic', value: 9600, kg: [8.0, 140.0], m: [0.8, 3.2], diff: 0.80,
    desc: 'Strikes once. You feel it four times, at decreasing volume.',
    locs: ['abyss', 'nowhere', 'beneath'], baits: ['void', 'minnow'], time: ['night'], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 3, glow: 0.55, c1: '#403060', c2: '#1a1230', c3: '#a0e0ff', ex: ['threads', 'teeth'] } },

  { id: 'candlewhale', name: 'Candlewhale Calf', rarity: 'epic', value: 11500, kg: [60.0, 900.0], m: [2.5, 9.0], diff: 0.84,
    desc: 'A young one. Somewhere below, out of sight, its mother is significantly brighter.',
    locs: ['nowhere', 'beneath'], baits: ['glowworm', 'void'], time: [], weather: [],
    art: { body: 'whale', fin: 'wing', eyes: 1, glow: 0.85, c1: '#2a2438', c2: '#0c0a14', c3: '#ffe0a0', ex: ['lantern', 'halo'] } },

  { id: 'sunken_bell', name: 'The Sunken Bell', rarity: 'legendary', value: 46000, kg: [200, 3000], m: [2, 9], diff: 0.90,
    desc: 'Rings once when it breaks the surface. Everything in the water stops to listen.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null'], time: [], weather: ['fog', 'voidsurge'],
    art: { body: 'orb', fin: 'none', eyes: 0, glow: 0.7, c1: '#8f7a48', c2: '#463a20', c3: '#ffe8a8', ex: ['rings', 'runes', 'chains'] } },

  { id: 'long_dark', name: 'The Long Dark', rarity: 'legendary', value: 52000, kg: [150, 2600], m: [6, 30], diff: 0.93,
    desc: 'You do not see it. You see the length of time during which you cannot see anything else.',
    locs: ['abyss', 'nowhere', 'beneath'], baits: ['void', 'deep', 'null'], time: ['night'], weather: [],
    art: { body: 'serpent', fin: 'none', eyes: 2, glow: 0.2, c1: '#0e0a18', c2: '#000000', c3: '#5a4a8a', ex: ['spine', 'threads'] } },

  { id: 'something_patient', name: 'Something Patient', rarity: 'legendary', value: 58000, kg: [80, 1600], m: [2, 11], diff: 0.94,
    desc: 'It let you catch it. You will spend some time deciding how you feel about that.',
    locs: ['cradle', 'beneath'], baits: ['null', 'void'], time: [], weather: ['eclipse', 'voidsurge'],
    art: { body: 'anomaly', fin: 'frill', eyes: 1, glow: 0.45, c1: '#2a2438', c2: '#0a0812', c3: '#e0c890', ex: ['mask', 'threads', 'runes'] } },

  { id: 'unlight', name: 'Unlight', rarity: 'mythic', value: 185000, kg: [40, 800], m: [1.5, 8], diff: 0.94,
    desc: 'Where it swims, light that already arrived is quietly taken back.',
    locs: ['nowhere', 'beneath'], baits: ['null', 'void'], time: [], weather: ['eclipse', 'voidsurge'],
    art: { body: 'jelly', fin: 'none', eyes: 0, glow: 0.95, c1: '#100a20', c2: '#000000', c3: '#ffffff', ex: ['halo', 'tentacles', 'fracture'] } },

  { id: 'many_mouthed', name: 'The Many-Mouthed', rarity: 'mythic', value: 205000, kg: [300, 6000], m: [4, 22], diff: 0.97,
    desc: 'Counting them is possible but strongly discouraged by everyone who has tried.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null', 'deep'], time: ['night'], weather: ['voidsurge', 'storm'],
    art: { body: 'anomaly', fin: 'spiky', eyes: 4, glow: 0.4, c1: '#42203a', c2: '#180a16', c3: '#ff9fc8', ex: ['teeth', 'eyes_extra', 'spine'] } },

  { id: 'anchor_saint', name: 'The Anchor Saint', rarity: 'mythic', value: 228000, kg: [500, 11000], m: [5, 26], diff: 0.96,
    desc: 'Wrapped in the chains of every vessel that ever gave up. It holds them gently.',
    locs: ['cradle', 'beneath'], baits: ['null', 'void'], time: [], weather: ['fog', 'voidsurge', 'eclipse'],
    art: { body: 'whale', fin: 'veil', eyes: 2, glow: 0.6, c1: '#3a4258', c2: '#141822', c3: '#ffe0b0', ex: ['chains', 'halo', 'runes'] } },

  /* ========================= !@#$%^&$# ========================= */
  { id: 'g_error', name: 'FISH_NOT_FOUND', rarity: 'glitch', value: 14000000, kg: [0, 0.001], m: [0, 0.001], diff: 0.95,
    desc: 'The catalogue has no entry for this. The catalogue is quite insistent that it has no entry for this.',
    locs: [], baits: ['null'], time: [], weather: [],
    art: { body: 'object', object: 'missing', glitch: 1.2, glow: 1,
           c1: '#1a1220', c2: '#ff2d55', c3: '#66ffe0' } },

  { id: 'g_chair', name: 'A Chair, Somehow', rarity: 'glitch', value: 9500000, kg: [4, 19], m: [0.6, 1.4], diff: 0.60,
    desc: 'A perfectly good dining chair. Dry. Warm. It was not in the water a moment ago.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'chair', glitch: 0.5, glow: 0.3,
           c1: '#8a5a30', c2: '#3a2210', c3: '#e8c088' } },

  { id: 'g_yourself', name: 'You, Fishing', rarity: 'glitch', value: 42000000, kg: [55, 95], m: [1.5, 2.0], diff: 0.99,
    desc: 'Sitting exactly as you are sitting. Holding a rod. The line goes down. You do not follow it.',
    locs: [], baits: ['null', 'void'], time: ['night'], weather: ['eclipse', 'voidsurge'],
    art: { body: 'object', object: 'angler', glitch: 0.9, glow: 0.5,
           c1: '#3a3a46', c2: '#0c0c12', c3: '#ffe0b0' } },

  { id: 'g_bigger', name: 'A Much Larger Hook', rarity: 'glitch', value: 58000000, kg: [1200, 44000], m: [12, 90], diff: 0.99,
    desc: 'Barbed, rusted, and attached to a line going up. Do not look up. You looked up.',
    locs: [], baits: ['null'], time: ['night'], weather: ['voidsurge'],
    art: { body: 'object', object: 'hook', glitch: 0.8, glow: 0.4,
           c1: '#6a5a48', c2: '#241d16', c3: '#ffd8a0' } },

  /* ===================== second catalogue =====================
     Everything below was added after the first survey. The shallow end fills
     out the ordinary tiers; past the trench it stops being ordinary, and past
     the void it stops being a catalogue. */

  { id: 'reed_dace', name: 'Reed Dace', rarity: 'common', value: 14, kg: [0.1, 1.1], m: [0.09, 0.28], diff: 0.08,
    desc: 'Lives in the weed at the edge and has never once considered leaving it.',
    locs: ['shore', 'basin'], baits: ['worm', 'minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'normal', eyes: 1, glow: 0, c1: '#7d8a63', c2: '#4c563a', c3: '#cdd6ac', ex: [] } },

  { id: 'button_crab', name: 'Button Crab', rarity: 'common', value: 20, kg: [0.05, 0.6], m: [0.04, 0.16], diff: 0.14,
    desc: 'Small, round, and extremely certain that it is winning.',
    locs: ['shore', 'flats'], baits: ['worm', 'cluster'], time: [], weather: [],
    art: { body: 'crustacean', fin: 'legs', eyes: 2, glow: 0, c1: '#a06a58', c2: '#5c382c', c3: '#e0b09c', ex: [] } },

  { id: 'chalk_sole', name: 'Chalk Sole', rarity: 'common', value: 26, kg: [0.3, 3.2], m: [0.15, 0.5], diff: 0.16,
    desc: 'Flat, pale, and content. Leaves a white mark on whatever it is set down on.',
    locs: ['flats', 'basin'], baits: ['worm', 'minnow', 'cluster'], time: [], weather: [],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0, c1: '#ddd8cc', c2: '#9a968c', c3: '#ffffff', ex: [] } },

  { id: 'kettle_perch', name: 'Kettle Perch', rarity: 'uncommon', value: 88, kg: [0.6, 5.4], m: [0.2, 0.62], diff: 0.26,
    desc: 'Warm to the touch, always, regardless of how cold the water is.',
    locs: ['basin', 'trench'], baits: ['minnow', 'glowworm'], time: [], weather: ['rain', 'overcast'],
    art: { body: 'round', fin: 'normal', eyes: 1, glow: 0.08, c1: '#b06840', c2: '#6a3a20', c3: '#ffc890', ex: [] } },

  { id: 'sew_eel', name: 'Sewn Eel', rarity: 'uncommon', value: 132, kg: [0.8, 9], m: [0.5, 2.1], diff: 0.34,
    desc: 'Long, and joined in the middle by something that is not scales.',
    locs: ['trench', 'flats'], baits: ['glowworm', 'deep'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'long', eyes: 1, glow: 0.06, c1: '#5a6a58', c2: '#242e26', c3: '#c8e0b0', ex: ['stitches'] } },

  { id: 'tin_shoal', name: 'Tin Shoal', rarity: 'uncommon', value: 118, kg: [0.4, 4.2], m: [0.18, 0.55], diff: 0.30,
    desc: 'A single fish that arrives as a crowd and leaves as a crowd.',
    locs: ['flats', 'basin', 'trench'], baits: ['minnow', 'cluster'], time: [], weather: [],
    art: { body: 'swarm', fin: 'normal', eyes: 3, glow: 0.10, c1: '#9aa8b4', c2: '#4e5a66', c3: '#dfe8f0', ex: [] } },

  { id: 'cold_marlin', name: 'Cold Marlin', rarity: 'rare', value: 620, kg: [8, 90], m: [1.2, 3.6], diff: 0.50,
    desc: 'Runs hard, gives up all at once, and then looks at you.',
    locs: ['trench', 'abyss'], baits: ['deep', 'prism'], time: ['night'], weather: ['storm', 'overcast'],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.12, c1: '#3a5a8a', c2: '#16243c', c3: '#9fd0ff', ex: ['spine'] } },

  { id: 'bell_jelly', name: 'Bell Jelly', rarity: 'rare', value: 720, kg: [2, 28], m: [0.4, 1.8], diff: 0.42,
    desc: 'Rings, faintly, once a minute. Nobody has established what it is counting.',
    locs: ['abyss', 'cradle'], baits: ['glowworm', 'prism'], time: [], weather: ['fog'],
    art: { body: 'jelly', fin: 'veil', eyes: 0, glow: 0.55, c1: '#8fb0d8', c2: '#3c5070', c3: '#ffeec0', ex: ['halo', 'threads'] } },

  { id: 'grave_carp', name: 'Gravel Carp', rarity: 'rare', value: 560, kg: [6, 74], m: [0.9, 3.0], diff: 0.48,
    desc: 'Swallows the riverbed and grinds it. You can hear it working from the bank.',
    locs: ['trench', 'flats'], baits: ['worm', 'deep', 'cluster'], time: [], weather: [],
    art: { body: 'blob', fin: 'frill', eyes: 2, glow: 0, c1: '#6e6252', c2: '#332c24', c3: '#c8b898', ex: ['crystals'] } },

  { id: 'lamp_ray', name: 'Lamplighter Ray', rarity: 'epic', value: 3900, kg: [20, 340], m: [1.6, 6.5], diff: 0.62,
    desc: 'Goes along the trench turning things on. Nobody asked it to.',
    locs: ['abyss', 'cradle'], baits: ['glowworm', 'prism', 'star'], time: ['night'], weather: [],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.72, c1: '#c8a058', c2: '#4a3418', c3: '#ffe8a0', ex: ['lantern', 'stars'] } },

  { id: 'stitch_bream', name: 'Stitched Bream', rarity: 'epic', value: 4400, kg: [12, 210], m: [0.9, 3.4], diff: 0.66,
    desc: 'Assembled from at least three other fish, and swimming perfectly well.',
    locs: ['cradle', 'nowhere'], baits: ['deep', 'ember', 'prism'], time: [], weather: ['fog', 'overcast'],
    art: { body: 'round', fin: 'frill', eyes: 3, glow: 0.2, c1: '#8a6a7a', c2: '#3a2a34', c3: '#ffc8dc', ex: ['stitches', 'eyes_extra'] } },

  { id: 'ash_ray', name: 'Ashfall Ray', rarity: 'epic', value: 4100, kg: [30, 520], m: [2.0, 8], diff: 0.68,
    desc: 'Trails the fine grey remains of somewhere that used to be above the water.',
    locs: ['nowhere', 'beneath'], baits: ['ember', 'deep'], time: [], weather: ['meteor', 'storm'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.28, c1: '#6a6260', c2: '#2a2624', c3: '#ff9c6a', ex: ['fracture'] } },

  { id: 'root_pike', name: 'Rootbound Pike', rarity: 'epic', value: 4700, kg: [24, 400], m: [1.4, 5.4], diff: 0.70,
    desc: 'It has grown into something down there. Reeling it in brings some of that up too.',
    locs: ['cradle', 'beneath'], baits: ['deep', 'void'], time: ['night'], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.18, c1: '#4a5a3a', c2: '#1c2418', c3: '#c8e08a', ex: ['roots', 'teeth'] } },

  { id: 'coin_king', name: 'The Coin King', rarity: 'legendary', value: 74000, kg: [40, 900], m: [1.2, 5], diff: 0.90,
    desc: 'Every scale is a currency that no longer exists. It is still, technically, extremely wealthy.',
    locs: ['cradle', 'nowhere'], baits: ['prism', 'star', 'ember'], time: [], weather: ['aurora'],
    art: { body: 'round', fin: 'frill', eyes: 1, glow: 0.5, c1: '#d8a838', c2: '#5c4210', c3: '#fff0b0', ex: ['crown', 'stars'] } },

  { id: 'tally_fish', name: 'The Tally', rarity: 'legendary', value: 68000, kg: [0.4, 12], m: [0.4, 2.2], diff: 0.88,
    desc: 'Four marks and a fifth struck across them. Every time you catch it, there is one more.',
    locs: ['nowhere', 'beneath'], baits: ['null', 'void'], time: [], weather: [],
    art: { body: 'tally', fin: 'none', eyes: 0, glow: 0.4, c1: '#d8d0c0', c2: '#3a352c', c3: '#ffffff', ex: ['runes'] } },

  { id: 'salt_widow', name: 'The Salt Widow', rarity: 'legendary', value: 81000, kg: [90, 1900], m: [3, 15], diff: 0.93,
    desc: 'Still wearing the water it drowned in. It does not appear to consider this over.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'deep', 'null'], time: ['night'], weather: ['fog', 'storm'],
    art: { body: 'jelly', fin: 'veil', eyes: 2, glow: 0.55, c1: '#4a5a6a', c2: '#161e28', c3: '#dfeaf4', ex: ['threads', 'chains', 'halo'] } },

  { id: 'folded_letter', name: 'A Letter, Folded Twice', rarity: 'legendary', value: 63000, kg: [0.01, 0.2], m: [0.1, 0.4], diff: 0.72,
    desc: 'Addressed to you. The ink has run, which is fortunate, because you were not going to like it.',
    locs: ['cradle', 'nowhere', 'beneath'], baits: ['null'], time: [], weather: ['rain'],
    art: { body: 'folded', fin: 'none', eyes: 0, glow: 0.35, c1: '#e4dcc8', c2: '#8a8270', c3: '#c8a058', ex: ['runes'] } },

  { id: 'mirror_twin', name: 'The Mirror Twin', rarity: 'mythic', value: 194000, kg: [60, 1300], m: [2, 12], diff: 0.95,
    desc: 'Two front halves and no back. It faces you from both ends and closes the distance evenly.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null', 'prism'], time: [], weather: ['eclipse', 'voidsurge'],
    art: { body: 'mirror', fin: 'veil', eyes: 4, glow: 0.6, c1: '#9aa0c8', c2: '#2a2c44', c3: '#ffffff', ex: ['duplicate', 'halo'] } },

  { id: 'sunken_column', name: 'The Standing Stone', rarity: 'mythic', value: 216000, kg: [3000, 62000], m: [12, 60], diff: 0.97,
    desc: 'Vertical. Motionless. It came up when you pulled, which is the part that is difficult to accept.',
    locs: ['beneath', 'nowhere'], baits: ['null', 'void', 'deep'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'column', fin: 'none', eyes: 6, glow: 0.42, c1: '#5a5468', c2: '#181624', c3: '#c8b0ff', ex: ['runes', 'eyes_many', 'chains'] } },

  { id: 'spiral_saint', name: 'The Spiral Saint', rarity: 'mythic', value: 232000, kg: [120, 2600], m: [3, 17], diff: 0.96,
    desc: 'It goes round once more than it should and arrives somewhere that is not the middle.',
    locs: ['beneath'], baits: ['void', 'null'], time: ['night'], weather: ['eclipse', 'voidsurge', 'aurora'],
    art: { body: 'spiral', fin: 'none', eyes: 1, glow: 0.85, c1: '#c8a8ff', c2: '#241848', c3: '#fff0ff', ex: ['halo', 'rings', 'stars'] } },

  /* ---- void ---- */
  { id: 'the_absence', name: 'The Absence', rarity: 'void', value: 2450000, kg: [0, 0], m: [1, 9], diff: 0.98,
    desc: 'Exactly the shape of a fish, and weighing exactly nothing. The line still went tight.',
    locs: ['beneath', 'nowhere'], baits: ['null', 'void'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'hole', fin: 'none', eyes: 0, glow: 0.9, c1: '#000000', c2: '#000000', c3: '#b48aff', ex: ['halo'] } },

  { id: 'the_census', name: 'The Census', rarity: 'void', value: 1880000, kg: [40, 900], m: [2, 14], diff: 0.97,
    desc: 'It has been counting. It is not counting fish. It knows how many of you there have been.',
    locs: ['beneath'], baits: ['null', 'void'], time: [], weather: ['voidsurge'],
    art: { body: 'swarm', fin: 'none', eyes: 8, glow: 0.5, c1: '#3a3448', c2: '#0c0a14', c3: '#ffe0a0', ex: ['eyes_many', 'barcode', 'runes'] } },

  { id: 'the_understudy', name: 'The Understudy', rarity: 'void', value: 2150000, kg: [55, 96], m: [1.5, 2.0], diff: 0.98,
    desc: 'It has been practising being you. It has the rod right. It has the sitting right. Give it time.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null'], time: ['night'], weather: ['eclipse', 'voidsurge'],
    art: { body: 'unfinished', fin: 'none', eyes: 2, glow: 0.45, c1: '#4a4450', c2: '#101018', c3: '#ffd8b0', ex: ['mask', 'duplicate', 'threads'] } },

  { id: 'the_long_now', name: 'The Long Now', rarity: 'void', value: 2600000, kg: [800, 24000], m: [20, 110], diff: 0.99,
    desc: 'Reeling it in takes as long as it takes. You will not be able to say afterwards how long that was.',
    locs: ['beneath'], baits: ['null'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'serpent', fin: 'veil', eyes: 3, glow: 0.7, c1: '#1a1830', c2: '#000000', c3: '#8fd0ff', ex: ['rings', 'threads', 'countdown'] } },

  /* ---- !@#$%^&$# ---- */
  { id: 'g_swarm', name: 'ALL OF THEM', rarity: 'glitch', value: 38000000, kg: [0.001, 90000], m: [0.01, 200], diff: 0.99,
    desc: 'Every fish in the catalogue, at the same time, on the same hook. The catalogue has not been consulted.',
    locs: [], baits: ['null', 'void'], time: [], weather: [],
    art: { body: 'swarm', fin: 'spiky', eyes: 9, glow: 1, c1: '#66ffe0', c2: '#001a18', c3: '#ff2d55', ex: ['eyes_many', 'static', 'duplicate'] } },

  { id: 'g_price', name: '$—.——', rarity: 'glitch', value: 71000000, kg: [0.2, 2], m: [0.1, 0.4], diff: 0.92,
    desc: 'It has a price and no name. The price is legible and you should not read it again.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'pricetag', glitch: 1.0, glow: 0.8,
           c1: '#f0ece0', c2: '#2a2820', c3: '#66ffe0' } },

  { id: 'g_cursor', name: 'The Pointer', rarity: 'glitch', value: 21000000, kg: [0, 0.002], m: [0.02, 0.06], diff: 0.70,
    desc: 'It has been in the corner of your eye this whole time. Now it is in the water and it is still blinking.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'cursor', glitch: 0.9, glow: 0.9,
           c1: '#ffffff', c2: '#0a0a10', c3: '#ffffff' } },

  { id: 'g_recursion', name: 'ITSELF', rarity: 'glitch', value: 88000000, kg: [1, 1200], m: [0.5, 26], diff: 0.99,
    desc: 'Inside it is the same fish, at the wrong scale, and inside that one is the same fish, at the wrong scale.',
    locs: [], baits: ['null'], time: [], weather: ['voidsurge'],
    art: { body: 'spiral', fin: 'none', eyes: 2, glow: 1, c1: '#b48aff', c2: '#0a0618', c3: '#ffffff', ex: ['wrongscale', 'rings', 'fracture'] } },

  { id: 'g_zero', name: 'Zero Fish Caught', rarity: 'glitch', value: 46000000, kg: [0, 0], m: [0, 0], diff: 0.88,
    desc: 'Your statistics now show that you have caught this zero times, including this time.',
    locs: [], baits: ['null'], time: [], weather: [],
    art: { body: 'object', object: 'counter', glitch: 1.3, glow: 1,
           c1: '#d8d4c8', c2: '#0a0a10', c3: '#ff2d55' } },

  { id: 'g_gardener', name: 'THE ONE THAT PLANTED IT', rarity: 'glitch', value: 120000000, kg: [400, 88000], m: [8, 180], diff: 0.99,
    desc: 'The water was put here. The fish were put here. You were put here. It has come to check on the arrangement.',
    locs: [], baits: ['null', 'void'], time: ['night'], weather: ['voidsurge', 'eclipse'],
    art: { body: 'column', fin: 'none', eyes: 12, glow: 1, c1: '#1a2418', c2: '#000000', c3: '#a8ff8a', ex: ['roots', 'eyes_many', 'crown', 'chains'] } },

  { id: 'g_trench', name: 'THE TRENCH ITSELF', rarity: 'glitch', value: 168000000, kg: [900000, 40000000], m: [400, 9000], diff: 0.99,
    desc: 'You have not been fishing above it. The charts call it a trench because the word for a mouth ' +
          'that size would have to be invented, and nobody who could invent it came back up.',
    locs: [], baits: ['null', 'void'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'column', fin: 'none', eyes: 8, glow: 0.9, c1: '#0e1a22', c2: '#000000', c3: '#5fe0ff',
           ex: ['teeth', 'eyes_many', 'roots', 'chains', 'fracture'] } },

  { id: 'g_secondmoon', name: 'A SECOND MOON, LOWERING', rarity: 'glitch', value: 210000000, kg: [4000000, 90000000], m: [1200, 26000], diff: 0.99,
    desc: 'It is not rising and it is not falling. It is being let down, slowly, on something, ' +
          'and the something has just gone tight in your hands.',
    locs: [], baits: ['null'], time: ['night'], weather: ['eclipse', 'clear'],
    art: { body: 'orb', fin: 'none', eyes: 0, glow: 1, c1: '#e8e4d4', c2: '#6a6858', c3: '#ffffff',
           ex: ['halo', 'rings', 'chains', 'crown'] } },

  { id: 'g_prayed', name: 'WHAT THE LEVIATHANS PRAY TO', rarity: 'glitch', value: 260000000, kg: [200000, 12000000], m: [300, 4000], diff: 0.99,
    desc: 'Everything with a name in this catalogue is smaller than it and knows the direction it is in. ' +
          'They face it when they die. You have it on a hook.',
    locs: [], baits: ['null', 'void'], time: ['night'], weather: ['voidsurge'],
    art: { body: 'anomaly', fin: 'wing', eyes: 12, glow: 1, c1: '#2a1038', c2: '#000000', c3: '#ffb8f0',
           ex: ['crown', 'eyes_many', 'halo', 'runes', 'tentacles', 'wings'] } },

  { id: 'g_unshoal', name: 'THE UNMAKER OF SHOALS', rarity: 'glitch', value: 152000000, kg: [60000, 3000000], m: [180, 2200], diff: 0.99,
    desc: 'It does not eat them. It goes through a shoal and afterwards the shoal has not been eaten, ' +
          'it has simply never existed, and nobody is missing anybody.',
    locs: [], baits: ['null'], time: [], weather: ['voidsurge', 'fog'],
    art: { body: 'fractal', fin: 'none', eyes: 3, glow: 1, c1: '#100818', c2: '#000000', c3: '#c8a0ff',
           ex: ['static', 'duplicate', 'fracture', 'threads'] } },

  { id: 'g_firstwater', name: 'THE FIRST WATER, AND WHAT WAS IN IT', rarity: 'glitch', value: 320000000, kg: [1000000, 60000000], m: [500, 14000], diff: 0.99,
    desc: 'Before there was a shore there was water, and it was not empty when it arrived. ' +
          'This is the passenger. It has been waiting for somebody to build a rod that could hold it.',
    locs: [], baits: ['null'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'folded', fin: 'veil', eyes: 6, glow: 1, c1: '#0a1418', c2: '#000000', c3: '#8ffce0',
           ex: ['runes', 'halo', 'eyes_many', 'wrongscale', 'stars'] } },

  { id: 'g_reader', name: 'you, reading this', rarity: 'glitch', value: 96000000, kg: [50, 110], m: [1.5, 2.1], diff: 0.99,
    desc: 'Not the one fishing. The other one. Sitting somewhere dry, looking at a lit rectangle, holding nothing.',
    locs: [], baits: ['null'], time: [], weather: [],
    art: { body: 'object', object: 'viewer', glitch: 1.0, glow: 0.6,
           c1: '#3a3a46', c2: '#0c0c12', c3: '#66ffe0' } },
  /* ====================== third catalogue ======================
     A wider survey, tier by tier. The shallow entries are ordinary fish that
     had simply not been written down; the deep ones are not, and past the void
     the tier stops taking fish at all — see the note at the top of this file. */

  /* ---- common ---- */
  { id: 'pin_bream', name: 'Pinbream', rarity: 'common', value: 16, kg: [0.1, 1.4], m: [0.08, 0.3], diff: 0.09,
    desc: 'Thin enough to read a newspaper through, if there were newspapers.',
    locs: ['shore', 'basin'], baits: ['worm', 'minnow'], time: [], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0, c1: '#9aa4ac', c2: '#616a72', c3: '#dde5ea', ex: [] } },

  { id: 'mud_gudgeon', name: 'Mud Gudgeon', rarity: 'common', value: 18, kg: [0.2, 2.2], m: [0.1, 0.34], diff: 0.13,
    desc: 'Comes up the colour of the bottom and stays that colour in the bucket.',
    locs: ['shore', 'flats'], baits: ['worm', 'deep'], time: [], weather: ['rain'],
    art: { body: 'round', fin: 'normal', eyes: 1, glow: 0, c1: '#6f6047', c2: '#413729', c3: '#b8a582', ex: ['antenna'] } },

  { id: 'paper_ray', name: 'Paper Ray', rarity: 'common', value: 28, kg: [0.1, 1.6], m: [0.14, 0.46], diff: 0.15,
    desc: 'Folds itself flat against anything it touches and takes a moment to remember it is alive.',
    locs: ['flats', 'basin'], baits: ['worm', 'cluster'], time: [], weather: ['clear'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.05, c1: '#e0dccc', c2: '#a29c8a', c3: '#ffffff', ex: [] } },

  { id: 'kelp_perch', name: 'Kelp Perch', rarity: 'common', value: 20, kg: [0.3, 2.8], m: [0.14, 0.44], diff: 0.14,
    desc: 'Green as the weed it hides in, and just as convinced it cannot be seen.',
    locs: ['shore', 'basin'], baits: ['worm', 'cluster'], time: ['day'], weather: [],
    art: { body: 'round', fin: 'frill', eyes: 1, glow: 0, c1: '#5d7a4a', c2: '#33482c', c3: '#b6d69a', ex: [] } },

  { id: 'coin_minnow', name: 'Coin Minnow', rarity: 'common', value: 32, kg: [0.02, 0.35], m: [0.04, 0.14], diff: 0.06,
    desc: 'Perfectly round and worth exactly nothing, which is a hard combination to forgive.',
    locs: ['shore', 'basin', 'flats'], baits: ['minnow', 'prism'], time: [], weather: ['clear'],
    art: { body: 'orb', fin: 'normal', eyes: 1, glow: 0.15, c1: '#d8c47c', c2: '#8a7638', c3: '#fff2c0', ex: [] } },

  { id: 'ribbon_smelt', name: 'Ribbon Smelt', rarity: 'common', value: 23, kg: [0.04, 0.7], m: [0.1, 0.4], diff: 0.10,
    desc: 'Longer than it has any use for. It arrives some time after its own head.',
    locs: ['basin', 'flats'], baits: ['minnow'], time: ['dawn', 'sunset'], weather: [],
    art: { body: 'ribbon', fin: 'veil', eyes: 1, glow: 0.12, c1: '#bcd0d8', c2: '#7d919b', c3: '#f0fbff', ex: [] } },

  { id: 'knot_loach', name: 'Knot Loach', rarity: 'common', value: 27, kg: [0.1, 1.5], m: [0.12, 0.42], diff: 0.19,
    desc: 'Ties itself up when frightened and takes an embarrassing amount of time to get free.',
    locs: ['shore', 'flats'], baits: ['worm', 'deep'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'none', eyes: 1, glow: 0, c1: '#7a6a58', c2: '#453b30', c3: '#c0ab8e', ex: ['antenna'] } },

  { id: 'chip_crab', name: 'Chipped Crab', rarity: 'common', value: 25, kg: [0.08, 0.9], m: [0.06, 0.2], diff: 0.16,
    desc: 'Missing one claw and holding the remaining one out as though that settles it.',
    locs: ['shore', 'flats'], baits: ['worm', 'cluster'], time: [], weather: [],
    art: { body: 'crustacean', fin: 'legs', eyes: 2, glow: 0, c1: '#8a7a6a', c2: '#4c4136', c3: '#d8c4ac', ex: ['fracture'] } },

  { id: 'lamp_fry', name: 'Lampfry', rarity: 'common', value: 30, kg: [0.02, 0.4], m: [0.04, 0.15], diff: 0.08,
    desc: 'A pinhead of light with a fish attached as an afterthought.',
    locs: ['basin', 'trench'], baits: ['glowworm'], time: ['night'], weather: ['fog'],
    art: { body: 'torpedo', fin: 'veil', eyes: 2, glow: 0.55, c1: '#4e6a76', c2: '#26383f', c3: '#ffe8a8', ex: ['lantern'] } },

  /* ---- uncommon ---- */
  { id: 'wire_pike', name: 'Wire Pike', rarity: 'uncommon', value: 104, kg: [1.2, 11], m: [0.4, 1.2], diff: 0.32,
    desc: 'Straight as a run of cable and about as willing to bend.',
    locs: ['basin', 'flats'], baits: ['minnow', 'deep'], time: ['dawn'], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.08, c1: '#8e9aa4', c2: '#4a545c', c3: '#dfeaf2', ex: ['teeth', 'spine'] } },

  { id: 'moth_ray', name: 'Mothwing Ray', rarity: 'uncommon', value: 148, kg: [0.6, 6.5], m: [0.4, 1.5], diff: 0.28,
    desc: 'Beats rather than glides, and leaves a dust on your hands that is not scales.',
    locs: ['flats', 'trench'], baits: ['glowworm', 'cluster'], time: ['night'], weather: ['fog'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.3, c1: '#cbb894', c2: '#6f6248', c3: '#fff0c8', ex: ['wings', 'antenna'] } },

  { id: 'salt_jelly', name: 'Saltbell Jelly', rarity: 'uncommon', value: 122, kg: [0.4, 5.0], m: [0.2, 0.9], diff: 0.24,
    desc: 'Rings once when it comes out of the water and then does not do it again.',
    locs: ['basin', 'flats', 'trench'], baits: ['prism', 'glowworm'], time: [], weather: ['fog', 'overcast'],
    art: { body: 'jelly', fin: 'veil', eyes: 0, glow: 0.45, c1: '#a8c0d8', c2: '#4f6178', c3: '#eaf6ff', ex: ['threads', 'bubbles'] } },

  { id: 'char_eel', name: 'Charred Eel', rarity: 'uncommon', value: 138, kg: [0.6, 7.2], m: [0.5, 1.9], diff: 0.36,
    desc: 'Black the whole way through. It has been burnt and it has not been near a fire.',
    locs: ['trench', 'basin'], baits: ['ember', 'deep'], time: ['night'], weather: ['storm'],
    art: { body: 'eel', fin: 'frill', eyes: 1, glow: 0.22, c1: '#3a2f2a', c2: '#161210', c3: '#ff9a52', ex: ['spine'] } },

  { id: 'twinned_perch', name: 'Twinned Perch', rarity: 'uncommon', value: 160, kg: [0.5, 5.5], m: [0.2, 0.7], diff: 0.30,
    desc: 'Two of them, always, and the second one is always a little behind.',
    locs: ['flats', 'basin'], baits: ['minnow', 'cluster'], time: [], weather: ['clear', 'aurora'],
    art: { body: 'round', fin: 'normal', eyes: 2, glow: 0.18, c1: '#7f97b4', c2: '#3d4c62', c3: '#d8e8f8', ex: ['duplicate'] } },

  { id: 'thorn_bream', name: 'Thornback Bream', rarity: 'uncommon', value: 116, kg: [0.8, 8.4], m: [0.24, 0.8], diff: 0.38,
    desc: 'Handle it once and you will remember which way up it goes for the rest of your life.',
    locs: ['basin', 'trench'], baits: ['worm', 'deep'], time: [], weather: [],
    art: { body: 'round', fin: 'spiky', eyes: 1, glow: 0, c1: '#6a6a56', c2: '#383a2c', c3: '#c8c8a0', ex: ['spine', 'horns'] } },

  { id: 'ink_sole', name: 'Ink Sole', rarity: 'uncommon', value: 126, kg: [0.4, 4.8], m: [0.2, 0.7], diff: 0.26,
    desc: 'Leaves a dark cloud when startled, which is a great deal of effort for a flatfish.',
    locs: ['flats', 'trench'], baits: ['worm', 'minnow', 'deep'], time: ['night'], weather: [],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.06, c1: '#3c4048', c2: '#1a1c22', c3: '#8a92a0', ex: [] } },

  { id: 'glass_shrimp', name: 'Glass Shrimp', rarity: 'uncommon', value: 98, kg: [0.02, 0.6], m: [0.05, 0.24], diff: 0.20,
    desc: 'Entirely see-through except for one small dark spot that follows you.',
    locs: ['flats', 'basin'], baits: ['cluster', 'prism'], time: [], weather: ['clear'],
    art: { body: 'crustacean', fin: 'legs', eyes: 2, glow: 0.35, c1: '#d0eef6', c2: '#8fb6c4', c3: '#ffffff', ex: ['bubbles'] } },

  { id: 'nine_gill', name: 'Nine-Gill', rarity: 'uncommon', value: 172, kg: [1.0, 9.5], m: [0.35, 1.1], diff: 0.40,
    desc: 'Nine on the left and seven on the right, and it swims perfectly straight regardless.',
    locs: ['trench', 'flats'], baits: ['deep', 'glowworm'], time: [], weather: ['overcast'],
    art: { body: 'torpedo', fin: 'frill', eyes: 1, glow: 0.12, c1: '#5c6a72', c2: '#2a343a', c3: '#a8d0d8', ex: ['stitches'] } },

  { id: 'dust_carp', name: 'Dustfall Carp', rarity: 'uncommon', value: 134, kg: [1.5, 14], m: [0.4, 1.3], diff: 0.34,
    desc: 'Feeds on whatever comes down from above. There is nothing above.',
    locs: ['basin', 'trench'], baits: ['worm', 'cluster', 'deep'], time: [], weather: ['meteor', 'overcast'],
    art: { body: 'round', fin: 'normal', eyes: 1, glow: 0.10, c1: '#8a8274', c2: '#463f36', c3: '#ded0b4', ex: ['stars'] } },

  /* ---- rare ---- */
  { id: 'lattice_eel', name: 'Lattice Eel', rarity: 'rare', value: 680, kg: [2.5, 34], m: [0.9, 3.2], diff: 0.46,
    desc: 'You can see the water on the other side of it through the gaps, and the gaps are load-bearing.',
    locs: ['trench', 'abyss'], baits: ['deep', 'prism'], time: ['night'], weather: ['fog'],
    art: { body: 'eel', fin: 'long', eyes: 1, glow: 0.34, c1: '#6f7fa8', c2: '#2a3350', c3: '#c8dcff', ex: ['fracture', 'runes'] } },

  { id: 'anvil_ray', name: 'Anvil Ray', rarity: 'rare', value: 740, kg: [14, 160], m: [1.4, 4.6], diff: 0.56,
    desc: 'Comes up slowly and then all at once, like something being dropped in reverse.',
    locs: ['trench', 'abyss'], baits: ['deep', 'ember'], time: [], weather: ['storm'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.14, c1: '#4c5460', c2: '#1e232c', c3: '#9fb4c8', ex: ['spine'] } },

  { id: 'ember_pike', name: 'Ember Pike', rarity: 'rare', value: 700, kg: [4, 52], m: [0.8, 2.6], diff: 0.52,
    desc: 'Still hot when it lands. Nobody has established what it has been swimming through.',
    locs: ['trench', 'abyss'], baits: ['ember', 'minnow'], time: ['sunset', 'night'], weather: ['storm', 'meteor'],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.62, c1: '#a8442a', c2: '#4a1a0e', c3: '#ffb060', ex: ['teeth', 'fracture'] } },

  { id: 'chorus_smelt', name: 'Chorus Smelt', rarity: 'rare', value: 590, kg: [0.4, 6], m: [0.2, 0.9], diff: 0.40,
    desc: 'Caught alone it makes no sound. Caught in threes it will not stop.',
    locs: ['abyss', 'cradle'], baits: ['glowworm', 'prism'], time: [], weather: ['aurora'],
    art: { body: 'swarm', fin: 'veil', eyes: 3, glow: 0.55, c1: '#b8c8f0', c2: '#3f4a72', c3: '#ffeed0', ex: ['rings', 'halo'] } },

  { id: 'hollow_carp', name: 'Hollow Carp', rarity: 'rare', value: 640, kg: [3, 40], m: [0.7, 2.4], diff: 0.50,
    desc: 'Weighs a third of what it should. Nobody has been willing to open one to find out why.',
    locs: ['trench', 'abyss', 'cradle'], baits: ['worm', 'deep', 'null'], time: [], weather: [],
    art: { body: 'round', fin: 'frill', eyes: 1, glow: 0.2, c1: '#8090a0', c2: '#3a4450', c3: '#d8e8f0', ex: ['bubbles'] } },

  { id: 'crown_jelly', name: 'Crowned Jelly', rarity: 'rare', value: 810, kg: [1.5, 22], m: [0.4, 1.6], diff: 0.44,
    desc: 'It has a court. The court is smaller and does not come up with it.',
    locs: ['abyss', 'cradle'], baits: ['prism', 'glowworm', 'star'], time: ['night'], weather: ['aurora', 'clear'],
    art: { body: 'jelly', fin: 'veil', eyes: 0, glow: 0.7, c1: '#c8a8e0', c2: '#4a3266', c3: '#ffe0ff', ex: ['crown', 'threads', 'halo'] } },

  { id: 'nail_eel', name: 'Nail Eel', rarity: 'rare', value: 560, kg: [1, 16], m: [0.6, 2.2], diff: 0.54,
    desc: 'Goes in easily. That is the entire problem with it.',
    locs: ['trench', 'abyss'], baits: ['deep', 'minnow'], time: ['night'], weather: [],
    art: { body: 'eel', fin: 'none', eyes: 1, glow: 0.1, c1: '#6a6660', c2: '#302e2a', c3: '#c0bcb0', ex: ['spine', 'teeth'] } },

  { id: 'archive_sole', name: 'Archive Sole', rarity: 'rare', value: 760, kg: [2, 26], m: [0.5, 1.9], diff: 0.48,
    desc: 'Both sides are written on. The archivist has asked to be told, and only told, when one comes up.',
    locs: ['abyss', 'cradle'], baits: ['null', 'deep'], time: [], weather: ['fog', 'overcast'],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.24, c1: '#ddd4b8', c2: '#6f6650', c3: '#fff8dc', ex: ['runes', 'barcode'] } },

  { id: 'tide_crab', name: 'Tideturn Crab', rarity: 'rare', value: 620, kg: [1, 18], m: [0.3, 1.2], diff: 0.52,
    desc: 'Walks the way the water is about to go, which is how the old hands read the weather.',
    locs: ['trench', 'flats', 'abyss'], baits: ['cluster', 'deep'], time: [], weather: ['storm', 'rain'],
    art: { body: 'crustacean', fin: 'legs', eyes: 4, glow: 0.18, c1: '#3f6a7a', c2: '#1a3038', c3: '#8fe0f0', ex: ['eyes_extra', 'crystals'] } },

  { id: 'still_marlin', name: 'The Still Marlin', rarity: 'rare', value: 880, kg: [12, 130], m: [1.6, 4.4], diff: 0.60,
    desc: 'Does not fight, does not run, and arrives at the bank having decided to.',
    locs: ['abyss', 'cradle'], baits: ['prism', 'deep', 'star'], time: ['dawn'], weather: ['clear'],
    art: { body: 'torpedo', fin: 'long', eyes: 1, glow: 0.3, c1: '#4a6a90', c2: '#1c2c44', c3: '#c0e0ff', ex: ['halo'] } },

  /* ---- epic ---- */
  { id: 'brass_whale', name: 'Brassbone Whale', rarity: 'epic', value: 4600, kg: [220, 3400], m: [4, 16], diff: 0.72,
    desc: 'Every rib is a fitting for something. None of the fittings match anything that exists.',
    locs: ['abyss', 'cradle'], baits: ['deep', 'ember'], time: [], weather: ['overcast'],
    art: { body: 'whale', fin: 'long', eyes: 1, glow: 0.26, c1: '#a8874a', c2: '#4a3a1c', c3: '#ffd88a', ex: ['chains', 'runes'] } },

  { id: 'prism_serpent', name: 'Prism Serpent', rarity: 'epic', value: 5200, kg: [18, 300], m: [3, 12], diff: 0.70,
    desc: 'Splits whatever light finds it, including the light it makes itself, which should not work.',
    locs: ['cradle', 'nowhere'], baits: ['prism', 'star'], time: [], weather: ['aurora', 'clear'],
    art: { body: 'serpent', fin: 'veil', eyes: 2, glow: 0.85, c1: '#cbb0ff', c2: '#3a2c66', c3: '#ffffff', ex: ['crystals', 'stars', 'rings'] } },

  { id: 'quiet_ray', name: 'The Quiet Ray', rarity: 'epic', value: 4200, kg: [40, 620], m: [2.4, 9], diff: 0.66,
    desc: 'The water goes silent around it in a circle you can measure. Instruments have been tried.',
    locs: ['nowhere', 'cradle'], baits: ['null', 'deep'], time: ['night'], weather: ['fog'],
    art: { body: 'ray', fin: 'wing', eyes: 0, glow: 0.4, c1: '#5a6070', c2: '#20242e', c3: '#c0c8e0', ex: ['halo', 'threads'] } },

  { id: 'thousand_smelt', name: 'The Thousand', rarity: 'epic', value: 4900, kg: [8, 140], m: [1, 5], diff: 0.68,
    desc: 'One catch. One entry in the record. Count them and the number is different each time.',
    locs: ['cradle', 'nowhere'], baits: ['minnow', 'cluster', 'void'], time: [], weather: [],
    art: { body: 'swarm', fin: 'spiky', eyes: 6, glow: 0.5, c1: '#8ab0c8', c2: '#2c3c4c', c3: '#e8f8ff', ex: ['eyes_many', 'duplicate'] } },

  { id: 'gilt_crustacean', name: 'Gilt Hermit', rarity: 'epic', value: 5600, kg: [30, 480], m: [1.2, 4.2], diff: 0.74,
    desc: 'It found something gold and moved into it. It will not be moving out.',
    locs: ['cradle', 'nowhere'], baits: ['prism', 'star', 'cluster'], time: [], weather: ['aurora'],
    art: { body: 'crustacean', fin: 'legs', eyes: 4, glow: 0.55, c1: '#d8ac48', c2: '#5c4414', c3: '#fff0b8', ex: ['crown', 'crystals', 'eyes_extra'] } },

  { id: 'kept_promise', name: 'A Kept Promise', rarity: 'epic', value: 4400, kg: [0.2, 6], m: [0.3, 2.4], diff: 0.62,
    desc: 'Small, warm, and entirely intact. It is the only one anybody has landed.',
    locs: ['cradle', 'nowhere'], baits: ['null', 'prism'], time: ['dawn'], weather: ['clear', 'aurora'],
    art: { body: 'folded', fin: 'none', eyes: 0, glow: 0.7, c1: '#f0e4c8', c2: '#8a7a58', c3: '#ffd8a0', ex: ['halo', 'runes'] } },

  { id: 'iron_pike', name: 'Ironbound Pike', rarity: 'epic', value: 4800, kg: [50, 780], m: [1.8, 6.6], diff: 0.76,
    desc: 'Somebody chained it. The chain is on the inside.',
    locs: ['nowhere', 'beneath'], baits: ['deep', 'void'], time: ['night'], weather: ['storm', 'voidsurge'],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.22, c1: '#5a5a62', c2: '#22242a', c3: '#c8d0dc', ex: ['chains', 'teeth', 'spine'] } },

  { id: 'nested_bream', name: 'The Nested Bream', rarity: 'epic', value: 5100, kg: [10, 190], m: [0.9, 3.6], diff: 0.72,
    desc: 'Inside it is another one, at the correct scale, and inside that one is nothing at all.',
    locs: ['cradle', 'nowhere'], baits: ['deep', 'null', 'prism'], time: [], weather: ['fog'],
    art: { body: 'round', fin: 'frill', eyes: 2, glow: 0.36, c1: '#9a8ab0', c2: '#3c3250', c3: '#f0e0ff', ex: ['duplicate', 'wrongscale'] } },

  /* ---- legendary ---- */
  { id: 'deep_hold', name: 'The Deep Hold', rarity: 'legendary', value: 92000, kg: [400, 8600], m: [5, 26], diff: 0.94,
    desc: 'Nine arms and no body worth speaking of. It took hold of the rod before it took hold of the bait, ' +
          'and it let go of the rod last.',
    locs: ['abyss', 'cradle', 'nowhere'], baits: ['deep', 'void', 'cluster'], time: ['night'], weather: ['storm', 'fog'],
    art: { body: 'blob', fin: 'none', eyes: 2, glow: 0.45, c1: '#8e2f34', c2: '#3c1216', c3: '#ff8a7a', ex: ['tentacles', 'eyes_extra', 'teeth'] } },

  { id: 'longest_night', name: 'The Longest Night', rarity: 'legendary', value: 78000, kg: [30, 720], m: [2.4, 12], diff: 0.92,
    desc: 'It is dark around it in a way that is not shadow — the light arrives and then declines to continue.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null'], time: ['night'], weather: ['eclipse'],
    art: { body: 'serpent', fin: 'veil', eyes: 3, glow: 0.5, c1: '#1e1a30', c2: '#050410', c3: '#8a7ad8', ex: ['stars', 'threads', 'halo'] } },

  { id: 'lamp_keeper', name: 'The Lampkeeper', rarity: 'legendary', value: 88000, kg: [80, 1600], m: [3, 14], diff: 0.91,
    desc: 'It is the reason the light on the rock is still burning. Nobody has been up there in a very long time.',
    locs: ['nowhere', 'cradle'], baits: ['glowworm', 'star', 'prism'], time: ['night'], weather: ['fog', 'clear'],
    art: { body: 'whale', fin: 'long', eyes: 1, glow: 0.95, c1: '#4a5a68', c2: '#1a242c', c3: '#ffd88a', ex: ['lantern', 'stars', 'halo'] } },

  { id: 'bell_of_hours', name: 'The Bell Of Hours', rarity: 'legendary', value: 96000, kg: [600, 14000], m: [4, 20], diff: 0.95,
    desc: 'It rings on the hour. There are no hours down here, and it rings anyway, and it is never wrong.',
    locs: ['beneath', 'nowhere'], baits: ['null', 'void', 'star'], time: [], weather: ['eclipse', 'voidsurge'],
    art: { body: 'jelly', fin: 'none', eyes: 0, glow: 0.85, c1: '#c8b878', c2: '#4a4022', c3: '#fff4c0', ex: ['rings', 'halo', 'countdown'] } },

  { id: 'long_hand', name: 'The Long Hand', rarity: 'legendary', value: 72000, kg: [8, 220], m: [2, 11], diff: 0.90,
    desc: 'Reaching. It has been reaching for the entire time you have been fishing, and it is closer now.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null', 'deep'], time: ['night'], weather: ['voidsurge', 'fog'],
    art: { body: 'anomaly', fin: 'none', eyes: 0, glow: 0.4, c1: '#4a4048', c2: '#141018', c3: '#e0c8b0', ex: ['tentacles', 'threads', 'chains'] } },

  { id: 'unlit_lantern', name: 'The Unlit Lantern', rarity: 'legendary', value: 69000, kg: [1, 26], m: [0.3, 1.4], diff: 0.84,
    desc: 'It is the only dark thing in the trench, and everything else down there is arranged around it.',
    locs: ['abyss', 'cradle', 'beneath'], baits: ['null', 'deep'], time: [], weather: ['eclipse', 'fog'],
    art: { body: 'orb', fin: 'none', eyes: 0, glow: 0.3, c1: '#22242c', c2: '#08090c', c3: '#6a7a96', ex: ['chains', 'rings'] } },

  { id: 'weight_of_it', name: 'The Weight Of It', rarity: 'legendary', value: 102000, kg: [4000, 96000], m: [1, 3], diff: 0.97,
    desc: 'Two metres of fish and the scale gives a number with five figures in it. Both readings have been checked.',
    locs: ['beneath'], baits: ['deep', 'void', 'null'], time: [], weather: ['voidsurge'],
    art: { body: 'blob', fin: 'none', eyes: 4, glow: 0.5, c1: '#3a3a48', c2: '#0e0e16', c3: '#b0a8d8', ex: ['wrongscale', 'eyes_extra', 'chains'] } },

  /* ---- mythic ---- */
  { id: 'the_argument', name: 'The Argument', rarity: 'mythic', value: 205000, kg: [40, 900], m: [2, 11], diff: 0.95,
    desc: 'Two of it, joined at the tail, going opposite ways with total conviction. Neither has won.',
    locs: ['nowhere', 'beneath'], baits: ['void', 'null', 'prism'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'mirror', fin: 'spiky', eyes: 4, glow: 0.62, c1: '#b06bff', c2: '#2a1848', c3: '#ffe0ff', ex: ['duplicate', 'teeth', 'fracture'] } },

  { id: 'the_inheritance', name: 'The Inheritance', rarity: 'mythic', value: 228000, kg: [200, 4200], m: [3, 18], diff: 0.96,
    desc: 'Every scale has a name on it and the last one has yours. There is room after it.',
    locs: ['beneath'], baits: ['null', 'void'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'round', fin: 'frill', eyes: 1, glow: 0.7, c1: '#d0b878', c2: '#4a3c1c', c3: '#fff4c8', ex: ['runes', 'barcode', 'crown'] } },

  { id: 'the_low_note', name: 'The Low Note', rarity: 'mythic', value: 212000, kg: [900, 26000], m: [8, 44], diff: 0.97,
    desc: 'You feel it in the rod before you hear it, and you hear it for some time after you have let go.',
    locs: ['beneath', 'nowhere'], baits: ['deep', 'void', 'null'], time: ['night'], weather: ['voidsurge', 'storm'],
    art: { body: 'whale', fin: 'long', eyes: 2, glow: 0.55, c1: '#2c3a56', c2: '#0a0e1c', c3: '#8fd8ff', ex: ['rings', 'halo', 'threads'] } },

  { id: 'the_shed_skin', name: 'The Shed Skin', rarity: 'mythic', value: 186000, kg: [2, 60], m: [4, 30], diff: 0.94,
    desc: 'The whole shape of it, hollow, and perfect, and recently vacated. Whatever left is still down there and is now larger.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null', 'deep'], time: [], weather: ['fog', 'voidsurge'],
    art: { body: 'unfinished', fin: 'veil', eyes: 0, glow: 0.6, c1: '#c8c0b0', c2: '#4a4438', c3: '#ffffff', ex: ['fracture', 'threads'] } },

  { id: 'the_open_hand', name: 'The Open Hand', rarity: 'mythic', value: 244000, kg: [140, 3200], m: [3, 16], diff: 0.96,
    desc: 'Offering. It has been offering for as long as there has been water, and nobody has ever taken it.',
    locs: ['beneath'], baits: ['null', 'void'], time: [], weather: ['eclipse', 'aurora'],
    art: { body: 'anomaly', fin: 'none', eyes: 0, glow: 0.9, c1: '#e8d0b8', c2: '#4a3a2c', c3: '#fff0d8', ex: ['halo', 'tentacles', 'rings'] } },

  { id: 'the_first_dark', name: 'The First Dark', rarity: 'mythic', value: 262000, kg: [1200, 38000], m: [10, 60], diff: 0.98,
    desc: 'Older than the water and considerably older than the light. It came up because it wanted to see the rod.',
    locs: ['beneath'], baits: ['void', 'null'], time: ['night'], weather: ['eclipse', 'voidsurge'],
    art: { body: 'serpent', fin: 'veil', eyes: 6, glow: 0.75, c1: '#160f26', c2: '#000000', c3: '#a88aff', ex: ['eyes_many', 'stars', 'rings'] } },

  { id: 'the_kindness', name: 'The Kindness', rarity: 'mythic', value: 198000, kg: [0.5, 18], m: [0.4, 3], diff: 0.93,
    desc: 'It let you catch it. You will spend a while working out how you know that, and you will be right.',
    locs: ['nowhere', 'beneath'], baits: ['null', 'prism', 'star'], time: ['dawn'], weather: ['aurora', 'clear'],
    art: { body: 'jelly', fin: 'veil', eyes: 1, glow: 0.95, c1: '#ffd8e8', c2: '#8a5a78', c3: '#ffffff', ex: ['halo', 'threads', 'stars'] } },

  /* ---- void ---- */
  { id: 'the_remainder', name: 'The Remainder', rarity: 'void', value: 2280000, kg: [0.001, 0.4], m: [0.02, 1], diff: 0.97,
    desc: 'Whatever was left over when everything else was made. It has been in the water since, quietly, not being anything.',
    locs: ['beneath', 'nowhere'], baits: ['null', 'void'], time: [], weather: ['voidsurge'],
    art: { body: 'unfinished', fin: 'none', eyes: 0, glow: 0.8, c1: '#7a7488', c2: '#1c1a26', c3: '#dcd0ff', ex: ['fracture', 'static'] } },

  { id: 'the_witness', name: 'The Witness', rarity: 'void', value: 2720000, kg: [60, 1400], m: [2, 15], diff: 0.98,
    desc: 'It was there for all of it. Every cast, every one you lost, the one you did not report. It has no opinion.',
    locs: ['beneath'], baits: ['void', 'null'], time: [], weather: ['eclipse', 'voidsurge'],
    art: { body: 'column', fin: 'none', eyes: 9, glow: 0.62, c1: '#3c3850', c2: '#0a0912', c3: '#ffe8b0', ex: ['eyes_many', 'runes', 'halo'] } },

  { id: 'the_second_water', name: 'The Second Water', rarity: 'void', value: 2960000, kg: [0, 0.0001], m: [3, 40], diff: 0.99,
    desc: 'A length of water, on the line, wet, and not connected to the water it came out of.',
    locs: ['beneath'], baits: ['null'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'ribbon', fin: 'veil', eyes: 0, glow: 0.9, c1: '#5a8ab0', c2: '#12283c', c3: '#d8f4ff', ex: ['bubbles', 'threads', 'halo'] } },

  { id: 'the_returned', name: 'The Returned', rarity: 'void', value: 2540000, kg: [0.2, 90], m: [0.1, 6], diff: 0.98,
    desc: 'Every fish you have ever released, in one shape, and it has come back to see how you are getting on.',
    locs: ['beneath', 'nowhere'], baits: ['void', 'null'], time: [], weather: ['voidsurge'],
    art: { body: 'swarm', fin: 'frill', eyes: 7, glow: 0.7, c1: '#6a8a9a', c2: '#1c2c34', c3: '#c8f0ff', ex: ['eyes_many', 'duplicate', 'halo'] } },

  { id: 'the_quiet_part', name: 'The Quiet Part', rarity: 'void', value: 2410000, kg: [4, 260], m: [1, 9], diff: 0.98,
    desc: 'The thing everybody has known about the water and nobody has said. It has weight and it has a mouth.',
    locs: ['beneath'], baits: ['null', 'void'], time: ['night'], weather: ['eclipse', 'voidsurge'],
    art: { body: 'hole', fin: 'none', eyes: 1, glow: 0.85, c1: '#000000', c2: '#000000', c3: '#ff9ad8', ex: ['teeth', 'halo'] } },

  { id: 'the_hour_after', name: 'The Hour After', rarity: 'void', value: 2830000, kg: [50, 2200], m: [3, 26], diff: 0.99,
    desc: 'Not the last hour. The one that comes after the last one. Reeling it in uses the hour up.',
    locs: ['beneath'], baits: ['null', 'void'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'spiral', fin: 'none', eyes: 2, glow: 0.95, c1: '#a88aff', c2: '#180e34', c3: '#fff0ff', ex: ['countdown', 'rings', 'stars'] } },

  /* ---- !@#$%^&$# ----
     None of these are fish. Each one is drawn as the object it is. */

  { id: 'g_yourhook', name: 'Your Fishing Hook', rarity: 'glitch', value: 18000000, kg: [0.001, 0.004], m: [0.02, 0.05], diff: 0.66,
    desc: 'The one on the end of your line. It is on the end of your line. Both of those are true and you have checked twice.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'hook', glitch: 0.7, glow: 0.7,
           c1: '#c8ccd4', c2: '#3a3e48', c3: '#ffffff' } },

  { id: 'g_door', name: 'A Door, Standing Open', rarity: 'glitch', value: 52000000, kg: [22, 60], m: [1.9, 2.1], diff: 0.93,
    desc: 'Open onto the water, from the water. There is a draught coming through it and it is warm.',
    locs: [], baits: ['null'], time: ['night'], weather: ['fog', 'eclipse'],
    art: { body: 'object', object: 'door', glitch: 0.8, glow: 0.6,
           c1: '#7a5c3a', c2: '#2e2114', c3: '#ffe8b0' } },

  { id: 'g_boot', name: 'The Boot', rarity: 'glitch', value: 7500000, kg: [0.6, 2.2], m: [0.24, 0.34], diff: 0.35,
    desc: 'Every fisherman has heard of it. Nobody has landed one. Here it is, and it is your size.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'boot', glitch: 0.45, glow: 0.3,
           c1: '#4a3a30', c2: '#1c1512', c3: '#c8a878' } },

  { id: 'g_bulb', name: 'A Light Left On', rarity: 'glitch', value: 29000000, kg: [0.02, 0.09], m: [0.1, 0.16], diff: 0.72,
    desc: 'Lit, underwater, wired to nothing. Somewhere a room you remember is now dark.',
    locs: [], baits: ['glowworm'], time: ['night'], weather: [],
    art: { body: 'object', object: 'bulb', glitch: 0.6, glow: 1,
           c1: '#f0f4ff', c2: '#8a8e98', c3: '#ffe8a0' } },

  { id: 'g_clock', name: 'The Wrong Time', rarity: 'glitch', value: 41000000, kg: [0.4, 3.2], m: [0.2, 0.6], diff: 0.86,
    desc: 'A wall clock reading a time that does not occur. The second hand is going the correct way round the wrong way.',
    locs: [], baits: ['null'], time: [], weather: [],
    art: { body: 'object', object: 'clock', glitch: 0.9, glow: 0.7,
           c1: '#e8e2d0', c2: '#2a2620', c3: '#ff2d55' } },

  { id: 'g_key', name: 'The Key To Your Front Door', rarity: 'glitch', value: 34000000, kg: [0.005, 0.02], m: [0.05, 0.08], diff: 0.78,
    desc: 'Not a brass one from a wreck. Yours. The cut matches. Check your pocket — it is also in your pocket.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'key', glitch: 0.75, glow: 0.55,
           c1: '#d8d0b8', c2: '#4a4438', c3: '#ffe0a0' } },

  { id: 'g_sign', name: 'A Sign For A Road', rarity: 'glitch', value: 37000000, kg: [6, 24], m: [1.2, 2.6], diff: 0.88,
    desc: 'It points. There is no road, and it is confident, and after a while you find you have turned to face the way it says.',
    locs: [], baits: ['null'], time: [], weather: ['fog'],
    art: { body: 'object', object: 'sign', glitch: 0.85, glow: 0.65,
           c1: '#3a7a4a', c2: '#182a1c', c3: '#ffffff' } },

  { id: 'g_ladder', name: 'A Ladder, Going Down', rarity: 'glitch', value: 63000000, kg: [9, 40], m: [2, 6], diff: 0.95,
    desc: 'It was already fixed to something. You brought up the top of it. It is still fixed to something.',
    locs: [], baits: ['null', 'void'], time: ['night'], weather: ['voidsurge'],
    art: { body: 'object', object: 'ladder', glitch: 0.95, glow: 0.5,
           c1: '#8a7458', c2: '#2c2418', c3: '#c8b490' } },

  { id: 'g_bench', name: 'The Bench You Sat On', rarity: 'glitch', value: 24000000, kg: [30, 90], m: [1.4, 2.2], diff: 0.80,
    desc: 'From the shore. It is still there when you look. Both of them are still there.',
    locs: [], baits: [], time: [], weather: ['rain', 'overcast'],
    art: { body: 'object', object: 'bench', glitch: 0.7, glow: 0.35,
           c1: '#6a5a44', c2: '#241d14', c3: '#a8c0c8' } },

  { id: 'g_tv', name: 'A Screen, Still Warm', rarity: 'glitch', value: 56000000, kg: [8, 26], m: [0.5, 1.1], diff: 0.90,
    desc: 'It is showing water. It is showing this water. There is a small figure sitting at the edge of it holding a rod.',
    locs: [], baits: ['null'], time: [], weather: [],
    art: { body: 'object', object: 'screen', glitch: 1.15, glow: 0.9,
           c1: '#3a3e46', c2: '#0e1014', c3: '#66ffe0' } },

  { id: 'g_window', name: "Somebody Else's Window", rarity: 'glitch', value: 68000000, kg: [12, 44], m: [1, 1.8], diff: 0.94,
    desc: 'The frame, the glass, and the room behind it. Somebody in that room has stopped what they were doing.',
    locs: [], baits: ['null', 'void'], time: ['night'], weather: ['fog', 'eclipse'],
    art: { body: 'object', object: 'window', glitch: 0.9, glow: 0.75,
           c1: '#c8c0a8', c2: '#3a3428', c3: '#ffd88a' } },

  { id: 'g_umbrella', name: 'An Umbrella, Open', rarity: 'glitch', value: 22000000, kg: [0.3, 1.2], m: [0.7, 1.1], diff: 0.74,
    desc: 'Open, underwater, and completely dry underneath. You can put your hand in and it stays dry.',
    locs: [], baits: [], time: [], weather: ['rain', 'storm'],
    art: { body: 'object', object: 'umbrella', glitch: 0.6, glow: 0.45,
           c1: '#2a3a56', c2: '#101828', c3: '#8fc8ff' } },

  { id: 'g_cage', name: 'An Empty Birdcage', rarity: 'glitch', value: 44000000, kg: [1, 6], m: [0.4, 0.9], diff: 0.87,
    desc: 'The door is open and the perch has been used. Something got out of it a long way down.',
    locs: [], baits: ['null'], time: [], weather: [],
    art: { body: 'object', object: 'cage', glitch: 0.8, glow: 0.55,
           c1: '#c8b070', c2: '#3a3018', c3: '#fff0c0' } },

  { id: 'g_bucket', name: 'The Bucket You Brought', rarity: 'glitch', value: 16000000, kg: [1.4, 4], m: [0.3, 0.4], diff: 0.62,
    desc: 'It has your catch in it. All of it. Every fish from today, and today has not finished.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'object', object: 'bucket', glitch: 0.65, glow: 0.4,
           c1: '#5a6a78', c2: '#20282e', c3: '#a8d8e8' } },

  { id: 'g_lamp', name: 'A Lamp From A Room', rarity: 'glitch', value: 47000000, kg: [3, 14], m: [1.2, 1.7], diff: 0.89,
    desc: 'A standard lamp, still on, at a depth where its light does not carry and is carrying anyway.',
    locs: [], baits: ['glowworm', 'null'], time: ['night'], weather: ['fog'],
    art: { body: 'object', object: 'lamp', glitch: 0.7, glow: 0.95,
           c1: '#c8a878', c2: '#3a3020', c3: '#ffe0a0' } },

  { id: 'g_tea', name: 'A Cup Of Tea, Still Hot', rarity: 'glitch', value: 31000000, kg: [0.3, 0.6], m: [0.09, 0.13], diff: 0.76,
    desc: 'Made the way you make it. It is steaming, and it has been down there, and it is steaming.',
    locs: [], baits: [], time: ['dawn'], weather: ['rain', 'overcast'],
    art: { body: 'object', object: 'cup', glitch: 0.55, glow: 0.5,
           c1: '#e8e4dc', c2: '#4a4640', c3: '#c88a4a' } },

  { id: 'g_stairs', name: 'Four Steps', rarity: 'glitch', value: 74000000, kg: [200, 900], m: [2, 4], diff: 0.96,
    desc: 'A flight of four, complete, going up. There is nothing at the top and they go up regardless.',
    locs: [], baits: ['null', 'void'], time: [], weather: ['voidsurge', 'eclipse'],
    art: { body: 'object', object: 'stairs', glitch: 1.0, glow: 0.6,
           c1: '#a8a49a', c2: '#2e2c28', c3: '#e0dcd0' } },

  /* ======================= THE FALLEN STAR =======================
     Two extra tags are used down here and nowhere else:
       event   the species only exists while that event is running
       strict  it does not stray — it is only ever where its locs say  */

  { id: 'moonlit', name: 'Moonlit Fish', rarity: 'rare', value: 2600, kg: [0.8, 14.0], m: [0.3, 1.1], diff: 0.44,
    desc: 'Rises only on nights when the moon has nothing in front of it. Some of them carry a scale that is not theirs.',
    locs: ['basin', 'flats', 'cradle'], baits: ['prism', 'star', 'minnow'], time: ['night'], weather: ['clear'],
    art: { body: 'round', fin: 'veil', eyes: 2, glow: 0.72, c1: '#9fb4d8', c2: '#1b2440', c3: '#f2f7ff', ex: ['halo', 'stars'] } },

  { id: 'sky_ember', name: 'Sky Ember', rarity: 'uncommon', value: 900, kg: [0.1, 2.2], m: [0.1, 0.4], diff: 0.30, event: 'skyfall', evWeight: 34,
    desc: 'Still warm from the fall. It goes out about a minute after you land it, and then it is an ordinary small fish.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'torpedo', fin: 'spiky', eyes: 1, glow: 0.68, c1: '#e8a860', c2: '#3a2010', c3: '#ffe0a0', ex: ['stars'] } },

  { id: 'fallen_light', name: 'Fallen Light', rarity: 'rare', value: 5200, kg: [0.4, 9.0], m: [0.2, 0.8], diff: 0.52, event: 'skyfall', evWeight: 26,
    desc: 'It came down as a streak and it is still, faintly, going in that direction.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'ribbon', fin: 'long', eyes: 2, glow: 0.85, c1: '#cfd8f2', c2: '#1a2038', c3: '#ffffff', ex: ['threads', 'stars'] } },

  { id: 'meteor_carp', name: 'Meteor Carp', rarity: 'epic', value: 22000, kg: [12.0, 240.0], m: [1.0, 4.0], diff: 0.72, event: 'skyfall', evWeight: 30,
    desc: 'Pitted all over on one side and perfectly smooth on the other. It has only ever been hit from above.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'round', fin: 'frill', eyes: 2, glow: 0.55, c1: '#8f7a5e', c2: '#2a2018', c3: '#ffcf8a', ex: ['crystals', 'fracture'] } },

  { id: 'celestial_guardian', name: 'Celestial Guardian', rarity: 'mythic', value: 420000, kg: [140, 2600], m: [5, 22], diff: 0.93, event: 'skyfall', evWeight: 300,
    desc: 'It was not falling. It was coming down deliberately, and it waited to be caught. There is writing inside its largest scale.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'serpent', fin: 'wing', eyes: 4, glow: 1, c1: '#e3caa0', c2: '#241a10', c3: '#fff3cc', ex: ['halo', 'rings', 'runes', 'wings'] } },

  { id: 'celestial_leviathan', name: 'The Celestial Leviathan', rarity: 'void', value: 3400000, kg: [9000, 120000], m: [40, 180], diff: 0.99, event: 'trial',
    desc: 'The thing the rod was made to catch, still waiting where the rod was dropped. Four hundred years is not a long time to it.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'whale', fin: 'wing', eyes: 6, glow: 1, c1: '#f0d79c', c2: '#20180c', c3: '#fffbe8', ex: ['halo', 'rings', 'stars', 'wings', 'runes'] } },

  /* --- and what lives above the clouds, once you can get up there --- */

  { id: 'cloudrunner', name: 'Cloudrunner', rarity: 'rare', value: 7400, kg: [0.6, 11.0], m: [0.3, 1.0], diff: 0.50, strict: true,
    desc: 'Swims through cloud the way everything else swims through water. It has never once been wet.',
    locs: ['the_heavens'], baits: [], time: [], weather: [],
    art: { body: 'ray', fin: 'wing', eyes: 2, glow: 0.6, c1: '#dfe8f5', c2: '#2a3350', c3: '#ffffff', ex: ['threads'] } },

  { id: 'stratus_ray', name: 'Stratus Ray', rarity: 'epic', value: 34000, kg: [20, 420], m: [1.5, 6.0], diff: 0.70, strict: true,
    desc: 'Flat and enormous and entirely silent. From below it is the reason the light changed.',
    locs: ['the_heavens'], baits: [], time: [], weather: [],
    art: { body: 'ray', fin: 'veil', eyes: 2, glow: 0.7, c1: '#c3d2ea', c2: '#1e2740', c3: '#fff4d8', ex: ['halo', 'threads'] } },

  { id: 'sunspear', name: 'Sunspear', rarity: 'legendary', value: 128000, kg: [40, 900], m: [2.5, 11.0], diff: 0.88, strict: true,
    desc: 'A single straight line of light with a mouth at one end. It hunts by being where the light already was.',
    locs: ['the_heavens'], baits: [], time: [], weather: [],
    art: { body: 'eel', fin: 'spiky', eyes: 1, glow: 1, c1: '#ffd98a', c2: '#3a2a0e', c3: '#fff8e0', ex: ['stars', 'spine'] } },

  { id: 'astra_koi', name: "Astra's Koi", rarity: 'mythic', value: 620000, kg: [90, 1800], m: [4, 16], diff: 0.95, strict: true,
    desc: 'Kept, once, by somebody who fished up here. Still circling the place the pond used to be.',
    locs: ['the_heavens'], baits: [], time: [], weather: [],
    art: { body: 'serpent', fin: 'veil', eyes: 3, glow: 0.95, c1: '#f0dcb0', c2: '#2a2012', c3: '#fff6dc', ex: ['halo', 'rings', 'stars'] } }
  ];

  const BY_ID = VF.util.byId(F);

  /* Index by rarity for fast pool building. */
  const BY_RARITY = Object.create(null);
  for (let i = 0; i < F.length; i++) {
    (BY_RARITY[F[i].rarity] || (BY_RARITY[F[i].rarity] = [])).push(F[i]);
  }

  VF.fish = {
    list: F,
    byId: function (id) { return BY_ID[id] || null; },
    byRarity: function (r) { return BY_RARITY[r] || []; },
    count: F.length
  };
})(window.VF = window.VF || {});
