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
      art: { c1: '#ffffff', c2: '#0a0a12', grip: '#1a1a26', tip: '#ffd6f0', len: 1.66, curve: 0.0, glow: 1.0, style: 'everything' } },
    /* ------------------------------------------------- the strange shelf
       Ten rods that are not a straight continuation of the ladder. Half of
       them are never for sale: somebody hands them over, or the water does.
       Each one interleaves with the tier above and below it, so taking the
       long way round is a real alternative to saving up. */

    { id: 'frostpoint', name: 'The Frozen Instant', cost: 520000, level: 31,
      requiresSecret: 'glass_shallows',
      cast: 0.90, reel: 1.46, line: 4.35, rare: 2.75, luck: 0.84,
      desc: 'A single moment of water, taken while it was freezing and never allowed to finish. ' +
            'The blade at the top is still growing, very slowly, in the direction of your hand.',
      art: { c1: '#7fd8f0', c2: '#2a6a8c', grip: '#1a3f56', tip: '#eaffff',
             len: 1.19, curve: 0.065, glow: 0.75, style: 'glacier' } },

    { id: 'shatterhour', name: 'The Shattered Hour', cost: 1900000, level: 39,
      requiresTreasure: 'crystal',
      cast: 0.98, reel: 1.71, line: 5.45, rare: 3.35, luck: 1.10,
      desc: 'It broke a long time ago and the pieces have not agreed to fall yet. ' +
            'They orbit the break at the speed of an hour going past.',
      art: { c1: '#9a8cf0', c2: '#2e2450', grip: '#1a1430', tip: '#e8d8ff',
             len: 1.25, curve: 0.055, glow: 0.85, style: 'shatter' } },

    { id: 'redthread', name: 'Red Thread', cost: 0, level: 45, noShop: true,
      notForSale: 'Not for sale. The old fisherman is still using it.',
      cast: 1.04, reel: 1.94, line: 6.50, rare: 3.90, luck: 1.35,
      desc: 'The old fisherman bound this himself, one turn of cord at a time, for sixty years. ' +
            'The cord is not cord. He knows that. He kept binding.',
      art: { c1: '#2a2f44', c2: '#12141f', grip: '#3a1418', tip: '#ff5a5a',
             len: 1.29, curve: 0.05, glow: 0.50, style: 'corded' } },

    { id: 'ninearms', name: 'Nine Arms', cost: 22000000, level: 50,
      requiresSpecies: 'deep_hold',
      cast: 1.09, reel: 2.10, line: 7.20, rare: 4.35, luck: 1.55,
      desc: 'Eight of them hold the blank. The ninth holds the line, and it is better at it than you are.',
      art: { c1: '#8e2f34', c2: '#3c1216', grip: '#2a0e12', tip: '#ff8a7a',
             len: 1.32, curve: 0.045, glow: 0.45, style: 'kraken' } },

    { id: 'exsanguine', name: 'Exsanguine', cost: 0, level: 55, noShop: true,
      notForSale: 'Not for sale. Nobody made this one, so nobody can sell it.',
      cast: 1.15, reel: 2.30, line: 8.10, rare: 4.90, luck: 1.78,
      desc: 'It came up already wet with something that was not water, and it has not stopped. ' +
            'The drops go upward once they leave the blank. Nobody has explained this.',
      art: { c1: '#6a0f18', c2: '#0d0406', grip: '#1a0508', tip: '#ff2a2a',
             len: 1.36, curve: 0.04, glow: 0.90, style: 'hemo' } },

    { id: 'thunderstruck', name: 'Thunderstruck', cost: 180000000, level: 60,
      requiresSpecies: 'stormcaller',
      cast: 1.21, reel: 2.52, line: 8.95, rare: 5.50, luck: 2.02,
      desc: 'Struck once, all the way through, and the strike is still in there looking for the ground. ' +
            'It will not find it. You are holding the only way out.',
      art: { c1: '#4a3418', c2: '#0f0a06', grip: '#241708', tip: '#ffc23a',
             len: 1.39, curve: 0.035, glow: 1.0, style: 'thunder' } },

    { id: 'halflife', name: 'Halflife', cost: 0, level: 65, noShop: true,
      notForSale: 'Not for sale. The collector deals only in the useless, and this is not that.',
      cast: 1.28, reel: 2.72, line: 9.90, rare: 6.15, luck: 2.32,
      desc: 'The collector kept it behind the stall in a lead box and never once tried to sell it. ' +
            'It lights the inside of your hand from the wrong side.',
      art: { c1: '#12201a', c2: '#040806', grip: '#0a1410', tip: '#5cff8a',
             len: 1.42, curve: 0.03, glow: 1.0, style: 'neon' } },

    { id: 'reliquary', name: 'Reliquary', cost: 0, level: 71, noShop: true,
      notForSale: 'Not for sale. It is filed, not stocked.',
      cast: 1.36, reel: 2.95, line: 11.2, rare: 6.95, luck: 2.65,
      desc: 'Every ring turning around it is a thing that was believed for long enough to become furniture. ' +
            'The archivist filed it under objects that answer.',
      art: { c1: '#f4ead0', c2: '#a88a48', grip: '#6a5424', tip: '#ffe9a8',
             len: 1.45, curve: 0.025, glow: 1.0, style: 'halo' } },

    { id: 'longfeather', name: 'The Long Feather', cost: 0, level: 77, noShop: true,
      notForSale: 'Not for sale. It is still in the water, and it is not the only one down there.',
      cast: 1.45, reel: 3.25, line: 13.2, rare: 8.20, luck: 3.15,
      desc: 'Moulted, not cut. Whatever dropped it was going somewhere and did not come back for it, ' +
            'and every colour is in the shaft rather than on it.',
      art: { c1: '#e8e2f4', c2: '#8a7aa8', grip: '#4a3f66', tip: '#d88aff',
             len: 1.49, curve: 0.02, glow: 0.95, style: 'plume' } },

    { id: 'twinsun', name: 'Two Small Suns', cost: 0, level: 84, noShop: true,
      notForSale: 'Not for sale. The keeper has never once put it on a shelf.',
      cast: 1.58, reel: 3.70, line: 16.2, rare: 10.2, luck: 3.90,
      desc: 'One at the tip and one at your hand, and the dark between them is the rod. ' +
            'The keeper had it under the counter the entire time. He was waiting to see if you would come back.',
      art: { c1: '#1a1a20', c2: '#050506', grip: '#101014', tip: '#ffffff',
             len: 1.55, curve: 0.015, glow: 1.0, style: 'twinsun' } }
  ];

  /* Shop order is progression order, not the order they were written. */
  LIST.sort(function (a, b) { return a.level - b.level || a.cost - b.cost; });

  const BY_ID = VF.util.byId(LIST);

  /* Every requirement a rod can carry, in one place, so the shop and the till
     never disagree about why something is out of reach. Returns null when the
     rod is available, or { why, note } when it is not. */
  function blocked(rod) {
    const d = VF.state.data;
    if (d.level < rod.level) return { why: 'level', note: 'Requires level ' + rod.level };
    if (rod.requiresVoidCatch && d.stats.voidCatches < 1) {
      return { why: 'void', note: 'Requires a Void-tier catch' };
    }
    if (rod.requiresGlitchCatch && (d.stats.glitchCatches | 0) < 1) {
      return { why: 'glitch', note: 'Requires a !@#$%^&$# catch' };
    }
    if (rod.requiresSecret && !VF.secrets.found(rod.requiresSecret)) {
      const s = VF.secrets.get(rod.requiresSecret);
      return { why: 'secret', note: s && !s.final ? 'Requires water that is not on the map'
                                                  : 'Requires what is under the last water' };
    }
    if (rod.requiresTreasure && !d.treasures[rod.requiresTreasure]) {
      const t = VF.treasureData.get(rod.requiresTreasure);
      return { why: 'treasure', note: 'Requires ' + (t ? t.name.toLowerCase() : 'something from the water') };
    }
    if (rod.requiresSpecies && !d.fishdex[rod.requiresSpecies]) {
      const f = VF.fish.byId(rod.requiresSpecies);
      return { why: 'species', note: 'Requires ' + (f ? f.name : 'a catch you have not made') +
                                     ' in the record' };
    }
    return null;
  }

  /* Handed over rather than bought: an NPC gift, or something the water gave
     back. Equipping it immediately is the whole point of being given a rod. */
  function grant(id) {
    const rod = BY_ID[id];
    const d = VF.state.data;
    if (!rod || d.ownedRods.indexOf(id) >= 0) return false;
    d.ownedRods.push(id);
    d.rod = id;
    VF.bus.emit('rod:granted', rod);
    VF.bus.emit('gear:changed');
    if (VF.save) VF.save.save();
    return true;
  }

  VF.rods = {
    list: LIST,
    get: function (id) { return BY_ID[id] || BY_ID.wood; },
    index: function (id) { for (let i = 0; i < LIST.length; i++) if (LIST[i].id === id) return i; return 0; },
    blocked: blocked,
    grant: grant,
    owned: function (id) { return VF.state.data.ownedRods.indexOf(id) >= 0; }
  };
})(window.VF = window.VF || {});
