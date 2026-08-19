/* VOID FISHING — rare mutations. Multiply value and change the fish's appearance. */
(function (VF) {
  'use strict';

  const LIST = [
    { id: 'glowing',  name: 'Glowing',      mult: 4,   weight: 100, color: '#7ff0d0', tint: '#9ffbe2', desc: 'Lit from within by something that will not go out.' },
    { id: 'golden',   name: 'Golden',       mult: 10,  weight: 46,  color: '#ffc94a', tint: '#ffe9a8', desc: 'Scales of struck gold. Heavier than it should be.' },
    { id: 'crystal',  name: 'Crystal',      mult: 18,  weight: 22,  color: '#9fe6ff', tint: '#d6f6ff', desc: 'Rendered in slow glass. It rings when touched.' },
    { id: 'shadow',   name: 'Shadow',       mult: 30,  weight: 11,  color: '#5b4d78', tint: '#2a2140', desc: 'Casts no reflection. Your hands feel colder holding it.' },
    { id: 'ancient',  name: 'Ancient',      mult: 50,  weight: 4.5, color: '#c98a54', tint: '#e8c79a', desc: 'Older than the water it swam in. Barnacled with dead stars.' },
    { id: 'voidtouched', name: 'Void-Touched', mult: 100, weight: 1.1, color: '#a86bff', tint: '#e0c6ff', desc: 'Something reached out and marked it. It remembers being marked.' }
  ];

  const BY_ID = VF.util.byId(LIST);

  /* Base chance any given catch is mutated, before luck. */
  const BASE_CHANCE = 0.022;

  function roll(luck, rnd) {
    const chance = Math.min(0.30, BASE_CHANCE * (1 + luck * 0.9));
    if (rnd() >= chance) return null;
    // Higher luck skews toward the rarer mutations.
    const skew = 1 - Math.min(0.6, luck * 0.14);
    return VF.rng.weighted(LIST, function (m) { return Math.pow(m.weight, skew); }, rnd);
  }

  VF.mutations = {
    list: LIST,
    get: function (id) { return id ? BY_ID[id] || null : null; },
    roll: roll,
    BASE_CHANCE: BASE_CHANCE
  };
})(window.VF = window.VF || {});
