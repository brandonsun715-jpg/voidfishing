/* VOID FISHING — rarity tiers.
   `weight` is the base draw weight with no gear at all.
   `pow` is how strongly gear/bait/location/weather push draws into this tier:
   the combined rarity power RP is raised to `pow` and multiplied into `weight`.
   Glitch has a deliberately low `pow` so it stays a lightning strike forever. */
(function (VF) {
  'use strict';

  const LIST = [
    { id: 'common',    name: 'Common',    rank: 0, weight: 1000,  pow: 0,    color: '#9db4c6', glow: '#c8d8e6', xp: 30,    shake: 0,   stinger: 'soft' },
    { id: 'uncommon',  name: 'Uncommon',  rank: 1, weight: 372,   pow: 0.55, color: '#5fd699', glow: '#9dffcb', xp: 70,    shake: 0,   stinger: 'soft' },
    { id: 'rare',      name: 'Rare',      rank: 2, weight: 95,   pow: 1.10, color: '#4aa8ff', glow: '#9ad2ff', xp: 170,   shake: 1.5, stinger: 'bright' },
    { id: 'epic',      name: 'Epic',      rank: 3, weight: 22,    pow: 1.72, color: '#b06bff', glow: '#dcb4ff', xp: 430,   shake: 3,   stinger: 'bright' },
    { id: 'legendary', name: 'Legendary', rank: 4, weight: 3.5,   pow: 2.25, color: '#ffb03a', glow: '#ffdc9a', xp: 1100,  shake: 6,   stinger: 'grand' },
    { id: 'mythic',    name: 'Mythic',    rank: 5, weight: 0.55,  pow: 2.80, color: '#ff5c9e', glow: '#ffb0d2', xp: 3100,  shake: 9,   stinger: 'grand' },
    { id: 'void',      name: 'Void',      rank: 6, weight: 0.075, pow: 3.40, color: '#8a5cff', glow: '#c9a8ff', xp: 9200,  shake: 13,  stinger: 'void' },
    { id: 'glitch',    name: '!@#$%^&$#', rank: 7, weight: 0.012, pow: 2.80, color: '#ff2d55', glow: '#66ffe0', xp: 31000, shake: 18,  stinger: 'glitch' }
  ];

  const BY_ID = VF.util.byId(LIST);

  VF.rarities = {
    list: LIST,
    get: function (id) { return BY_ID[id] || BY_ID.common; },
    rank: function (id) { return (BY_ID[id] || BY_ID.common).rank; },
    color: function (id) { return (BY_ID[id] || BY_ID.common).color; },
    /* Draw weight for a tier at a given rarity power. */
    weightAt: function (r, rp) {
      return r.pow === 0 ? r.weight : r.weight * Math.pow(rp, r.pow);
    }
  };
})(window.VF = window.VF || {});
