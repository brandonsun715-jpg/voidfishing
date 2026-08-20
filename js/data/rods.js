/* VOID FISHING — rods.
   cast   0..1 relative cast distance (drives how far out the bobber lands)
   reel   reel force per second during the fight
   line   line strength — how much tension headroom before snapping
   rare   multiplier on high-rarity draw weights
   luck   drives mutation chance and size rolls
   Every rod is a visible upgrade: the on-screen rod changes shape and colour. */
(function (VF) {
  'use strict';

  const LIST = [
    { id: 'wood', name: 'Old Wooden Rod', cost: 0, level: 1,
      cast: 0.22, reel: 0.40, line: 1.00, rare: 1.00, luck: 0.00,
      desc: 'Somebody left it at the shore a long time ago. It still works, mostly.',
      art: { c1: '#7a5c3a', c2: '#4a3722', grip: '#3b2a18', tip: '#c8a878', len: 0.78, curve: 0.10, glow: 0, style: 'plain' } },

    { id: 'fiber', name: 'Fiberglass Rod', cost: 250, level: 2,
      cast: 0.34, reel: 0.52, line: 1.25, rare: 1.10, luck: 0.06,
      desc: 'Flexible, forgiving, and utterly without character. A genuine improvement.',
      art: { c1: '#3f4d58', c2: '#232c34', grip: '#1c2228', tip: '#8fa4b2', len: 0.86, curve: 0.13, glow: 0, style: 'plain' } },

    { id: 'carbon', name: 'Carbon Rod', cost: 1100, level: 5,
      cast: 0.45, reel: 0.66, line: 1.55, rare: 1.26, luck: 0.14,
      desc: 'Light enough to forget you are holding it. Stiff enough to argue with a pike.',
      art: { c1: '#2b2f36', c2: '#131519', grip: '#0e1013', tip: '#6f7a86', len: 0.92, curve: 0.11, glow: 0.05, style: 'wrap' } },

    { id: 'composite', name: 'Reinforced Composite', cost: 4500, level: 9,
      cast: 0.55, reel: 0.80, line: 1.95, rare: 1.45, luck: 0.24,
      desc: 'Braided with wire recovered from something that sank a very long way down.',
      art: { c1: '#4a4038', c2: '#241f1a', grip: '#3a2f22', tip: '#c0a070', len: 0.98, curve: 0.10, glow: 0.08, style: 'wrap' } },

    { id: 'deepwater', name: 'Deepwater Rod', cost: 16000, level: 14,
      cast: 0.66, reel: 0.96, line: 2.45, rare: 1.70, luck: 0.36,
      desc: 'Rated to depths the trench does not admit to having. The guides are ceramic.',
      art: { c1: '#1f3b48', c2: '#0c1c24', grip: '#0a1418', tip: '#5fc0d8', len: 1.04, curve: 0.09, glow: 0.18, style: 'runic' } },

    { id: 'abyss', name: 'Abyss Rod', cost: 62000, level: 20,
      cast: 0.76, reel: 1.14, line: 3.10, rare: 2.05, luck: 0.52,
      desc: 'Cold at both ends. The line pays out on its own if you leave it alone too long.',
      art: { c1: '#20182e', c2: '#0b0814', grip: '#100c1a', tip: '#8f6fd8', len: 1.10, curve: 0.08, glow: 0.30, style: 'runic' } },

    { id: 'lunar', name: 'Lunar Rod', cost: 240000, level: 27,
      cast: 0.86, reel: 1.34, line: 3.90, rare: 2.50, luck: 0.72,
      desc: 'Carved from something that used to orbit. Faintly bright on its own account.',
      art: { c1: '#cfd2c4', c2: '#8a8d80', grip: '#5e6157', tip: '#ffffff', len: 1.16, curve: 0.07, glow: 0.45, style: 'lunar' } },

    { id: 'celestial', name: 'Celestial Rod', cost: 950000, level: 35,
      cast: 0.94, reel: 1.58, line: 4.90, rare: 3.05, luck: 0.96,
      desc: 'The guides hold small stationary stars. They do not appear to be decorative.',
      art: { c1: '#2c3a72', c2: '#111637', grip: '#0d1128', tip: '#a8c8ff', len: 1.22, curve: 0.06, glow: 0.62, style: 'celestial' } },

    { id: 'aether', name: 'Aetherglass Rod', cost: 3800000, level: 43,
      cast: 1.02, reel: 1.86, line: 6.10, rare: 3.70, luck: 1.26,
      desc: 'Visible only when it is under load. Otherwise you are holding a suggestion.',
      art: { c1: '#bfe8f5', c2: '#6f9db0', grip: '#3f5f6e', tip: '#ffffff', len: 1.28, curve: 0.05, glow: 0.78, style: 'glass' } },

    { id: 'void', name: 'Void Rod', cost: 40000000, level: 52,
      cast: 1.12, reel: 2.20, line: 7.60, rare: 4.60, luck: 1.65,
      desc: 'It does not cast the line so much as agree with the line about where it should be.',
      art: { c1: '#160e28', c2: '#04030a', grip: '#0a0714', tip: '#b48aff', len: 1.34, curve: 0.04, glow: 0.92, style: 'void' } },

    { id: 'singularity', name: 'Singularity Rod', cost: 300000000, level: 62,
      cast: 1.24, reel: 2.62, line: 9.40, rare: 5.80, luck: 2.15,
      desc: 'Fishes a small radius of collapsed space. Reel speed is technically negative and it works anyway.',
      art: { c1: '#0a0812', c2: '#000000', grip: '#0f0c18', tip: '#ff5fa2', len: 1.40, curve: 0.03, glow: 1.0, style: 'singularity' } },

    { id: 'unknown', name: '??? Rod', cost: 2500000000, level: 74, requiresVoidCatch: true,
      cast: 1.40, reel: 3.10, line: 12.0, rare: 7.40, luck: 2.90,
      desc: 'It was already in your hands. Check the photographs. It was always in your hands.',
      art: { c1: '#ffffff', c2: '#1a1a1a', grip: '#2a2a2a', tip: '#66ffe0', len: 1.46, curve: 0.02, glow: 1.0, style: 'glitch' } },

    /* ---------------------------------------------------------- the far end
       Past here a rod stops being equipment. Each one is a bigger claim about
       what the water is, and the art has to carry the claim. */

    { id: 'tidebreaker', name: 'Tidebreaker', cost: 12000000, level: 47,
      cast: 1.07, reel: 2.02, line: 6.90, rare: 4.10, luck: 1.44,
      desc: 'Forged in a storm that has not finished yet. The charge never fully leaves the blank.',
      art: { c1: '#2f4f66', c2: '#0d1a26', grip: '#0a1420', tip: '#7fe0ff', len: 1.31, curve: 0.05, glow: 0.70, style: 'storm' } },

    { id: 'leviathan', name: "Leviathan's Tooth", cost: 120000000, level: 57,
      cast: 1.18, reel: 2.40, line: 8.50, rare: 5.15, luck: 1.88,
      desc: 'One tooth. Not a jaw, not a skeleton — one tooth, and it is longer than you are.',
      art: { c1: '#ded4c0', c2: '#8c8474', grip: '#4a4438', tip: '#fff4d8', len: 1.37, curve: 0.05, glow: 0.55, style: 'bone' } },

    { id: 'chorus', name: 'The Drowned Choir', cost: 900000000, level: 68,
      cast: 1.32, reel: 2.85, line: 10.6, rare: 6.55, luck: 2.50,
      desc: 'Every guide holds a voice. They only sing when something is on the line, and they are never wrong.',
      art: { c1: '#c8b8ff', c2: '#241d44', grip: '#14102a', tip: '#fff0c0', len: 1.43, curve: 0.03, glow: 0.95, style: 'chorus' } },

    { id: 'eclipse', name: 'Eclipse Rod', cost: 6000000000, level: 80, requiresVoidCatch: true,
      cast: 1.52, reel: 3.45, line: 14.5, rare: 9.10, luck: 3.55,
      desc: 'The tip holds a small covered sun. Everything it touches gets a second shadow, pointing the wrong way.',
      art: { c1: '#1c1420', c2: '#000000', grip: '#100a14', tip: '#ffb14a', len: 1.52, curve: 0.02, glow: 1.0, style: 'eclipse' } },

    { id: 'origin', name: 'The First Rod', cost: 26000000000, level: 88, requiresGlitchCatch: true,
      cast: 1.68, reel: 3.95, line: 18.5, rare: 11.6, luck: 4.50,
      desc: 'Not the oldest one. The one the others were drawn from. You can still see the construction lines.',
      art: { c1: '#e8f4ff', c2: '#3a5f8f', grip: '#22344d', tip: '#ffffff', len: 1.58, curve: 0.01, glow: 1.0, style: 'origin' } },

    { id: 'everything', name: 'Everything, At Once', cost: 95000000000, level: 99,
      requiresGlitchCatch: true, requiresSecret: 'the_last_water',
      cast: 1.90, reel: 4.60, line: 25.0, rare: 15.5, luck: 6.00,
      desc: 'It is every rod. It is the tooth and the storm and the covered sun and the line of light. ' +
            'Holding it is a full-time occupation and you will not be doing anything else.',
      art: { c1: '#ffffff', c2: '#0a0a12', grip: '#1a1a26', tip: '#ffd6f0', len: 1.66, curve: 0.0, glow: 1.0, style: 'everything' } }
  ];

  /* Shop order is progression order, not the order they were written. */
  LIST.sort(function (a, b) { return a.level - b.level || a.cost - b.cost; });

  const BY_ID = VF.util.byId(LIST);

  VF.rods = {
    list: LIST,
    get: function (id) { return BY_ID[id] || BY_ID.wood; },
    index: function (id) { for (let i = 0; i < LIST.length; i++) if (LIST[i].id === id) return i; return 0; }
  };
})(window.VF = window.VF || {});
