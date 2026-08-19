/* VOID FISHING — the catalogue.
   art{} drives the procedural fish renderer (js/render/fishArt.js):
     body   torpedo | round | eel | serpent | blob | jelly | ray | shard | orb |
            crustacean | whale | ribbon | anomaly | fractal
     fin    normal | long | veil | spiky | wing | frill | none
     eyes   0..6      glow 0..1
     ex[]   tentacles halo rings crystals antenna horns runes spine bubbles
            fracture chains stars teeth lantern mask threads wings
   locs/baits/time/weather are preference tags. Empty array = "anywhere". */
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
    art: { body: 'crustacean', fin: 'none', eyes: 4, glow: 0.1, c1: '#8f5a6a', c2: '#4f2c38', c3: '#e0a2ae', ex: ['spine'] } },

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
    art: { body: 'fractal', fin: 'none', eyes: 0, glow: 1, c1: '#ff2d55', c2: '#000000', c3: '#66ffe0', ex: ['fracture', 'runes'] } },

  { id: 'g_chair', name: 'A Chair, Somehow', rarity: 'glitch', value: 9500000, kg: [4, 19], m: [0.6, 1.4], diff: 0.60,
    desc: 'A perfectly good dining chair. Dry. Warm. It was not in the water a moment ago.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'shard', fin: 'none', eyes: 0, glow: 0.3, c1: '#8a5a30', c2: '#4a2e16', c3: '#e8c088', ex: ['fracture'] } },

  { id: 'g_yourself', name: 'You, Fishing', rarity: 'glitch', value: 42000000, kg: [55, 95], m: [1.5, 2.0], diff: 0.99,
    desc: 'Sitting exactly as you are sitting. Holding a rod. The line goes down. You do not follow it.',
    locs: [], baits: ['null', 'void'], time: ['night'], weather: ['eclipse', 'voidsurge'],
    art: { body: 'anomaly', fin: 'none', eyes: 2, glow: 0.5, c1: '#3a3a46', c2: '#0c0c12', c3: '#ffe0b0', ex: ['mask', 'threads', 'chains'] } },

  { id: 'g_sunday', name: 'Last Sunday', rarity: 'glitch', value: 26000000, kg: [0.5, 4], m: [0.1, 0.9], diff: 0.85,
    desc: 'The entire day. Slightly damp. You can still smell the rain on it.',
    locs: [], baits: [], time: [], weather: ['rain', 'overcast'],
    art: { body: 'jelly', fin: 'none', eyes: 0, glow: 0.75, c1: '#c8d8e8', c2: '#7f95ad', c3: '#fff0c8', ex: ['halo', 'bubbles', 'runes'] } },

  { id: 'g_bigger', name: 'A Much Larger Hook', rarity: 'glitch', value: 58000000, kg: [1200, 44000], m: [12, 90], diff: 0.99,
    desc: 'Barbed, rusted, and attached to a line going up. Do not look up. You looked up.',
    locs: [], baits: ['null'], time: ['night'], weather: ['voidsurge'],
    art: { body: 'anomaly', fin: 'none', eyes: 0, glow: 0.4, c1: '#6a5a48', c2: '#241d16', c3: '#ffd8a0', ex: ['chains', 'spine', 'fracture'] } },

  { id: 'g_applause', name: 'Distant Applause', rarity: 'glitch', value: 33000000, kg: [0, 0.05], m: [0, 0.05], diff: 0.90,
    desc: 'Not a thing. Not an object. It is on the hook regardless, and it is getting louder.',
    locs: [], baits: [], time: [], weather: [],
    art: { body: 'fractal', fin: 'none', eyes: 3, glow: 1, c1: '#ffd166', c2: '#2a1a00', c3: '#ff5fa2', ex: ['rings', 'halo', 'eyes_extra'] } }
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
