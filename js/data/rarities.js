/* VOID FISHING — rarity tiers.
   `weight` is the base draw weight with no gear at all.
   `pow` is how strongly gear/bait/location/weather push draws into this tier:
   the combined rarity power RP is raised to `pow` and multiplied into `weight`.
   Glitch has a deliberately low `pow` so it stays a lightning strike forever. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const LIST = [
    { id: 'common',    name: 'Common',    rank: 0, weight: 1000,  pow: 0,    color: '#9db4c6', glow: '#c8d8e6', xp: 30,    shake: 0,   stinger: 'soft' },
    { id: 'uncommon',  name: 'Uncommon',  rank: 1, weight: 372,   pow: 0.55, color: '#5fd699', glow: '#9dffcb', xp: 70,    shake: 0,   stinger: 'soft' },
    { id: 'rare',      name: 'Rare',      rank: 2, weight: 95,   pow: 1.10, color: '#4aa8ff', glow: '#9ad2ff', xp: 170,   shake: 1.5, stinger: 'bright' },
    { id: 'epic',      name: 'Epic',      rank: 3, weight: 22,    pow: 1.72, color: '#b06bff', glow: '#dcb4ff', xp: 430,   shake: 3,   stinger: 'bright' },
    { id: 'legendary', name: 'Legendary', rank: 4, weight: 3.5,   pow: 2.25, color: '#ffb03a', glow: '#ffdc9a', xp: 1100,  shake: 6,   stinger: 'grand' },
    { id: 'mythic',    name: 'Mythic',    rank: 5, weight: 0.55,  pow: 2.80, color: '#ff5c9e', glow: '#ffb0d2', xp: 3100,  shake: 9,   stinger: 'grand' },
    /* Thinned deliberately. At 0.075 the deepest water gave one up every
       seventeen casts, which is not what the tier is for — and every one of
       them now stops the frame to show you, so they have to be worth stopping
       for. About one in forty-five at the bottom of the map. */
    { id: 'void',      name: 'Void',      rank: 6, weight: 0.030, pow: 3.40, color: '#8a5cff', glow: '#c9a8ff', xp: 9200,  shake: 13,  stinger: 'void' },
    { id: 'glitch',    name: '!@#$%^&$#', rank: 7, weight: 0.012, pow: 2.80, color: '#ff2d55', glow: '#66ffe0', xp: 31000, shake: 18,  stinger: 'glitch' },

    /* One tier above the last one, and it is not listed anywhere until you have
       one. `hidden` keeps it out of the Fishdex, out of the filter row and out
       of the species total, so a player who has never caught one has no way of
       knowing the tier is there. `pow` is deliberately low: gear moves this
       almost not at all, so it stays a lightning strike at level 99 with every
       bonus stacked, which is the entire point of it. */
    { id: 'unknown',   name: '?',         rank: 8, weight: 0.0000036, pow: 3.60, color: '#ffffff', glow: '#ffe9a8', xp: 260000, shake: 26, stinger: 'unknown', hidden: true },

    /* And one above that.

       Eight things, and not one of them is a fish. The tier exists because the
       ladder ran out of ways to say "bigger" — a rarer void fish is still a
       void fish — so the last rung is not a rarer anything, it is a different
       category of event: the line goes tight and what comes up is a planet.

       `rainbow` is the only colour in the game that is not a colour. Every
       tier below is one hex and stays it; this one cycles, and the sites that
       show a rarity ask colorAt() for what it is right now rather than reading
       `color`. The hex is kept so anything that has not been taught about the
       cycle still gets something sensible.

       `pow` is the steepest on the board, which is the opposite of what the
       tier below does and is deliberate. `?` is a lightning strike: it barely
       answers to gear, so it can happen to anybody and cannot be chased. This
       one is the other kind of top tier — on a starting rod it is one cast in
       forty million and nobody will ever meet it by accident, and with every
       bonus in the game stacked it comes down to roughly one in fifty
       thousand, which is a grind but is a grind that finishes. Eight species
       behind that number is the endgame. */
    { id: 'astral',    name: 'ASTRAL',    rank: 9, weight: 0.00000033, pow: 3.90, color: '#ff5cf0', glow: '#ffffff', xp: 2400000, shake: 34, stinger: 'astral', hidden: true, rainbow: 1 }
  ];

  const BY_ID = VF.util.byId(LIST);

  /* Tiers a player who has caught nothing from them is allowed to know about. */
  function visible() {
    const d = VF.state.data;
    return LIST.filter(function (r) { return !r.hidden || d.flags['rare_' + r.id]; });
  }

  /* The rainbow, as a colour you can actually paint with.

     Cheap on purpose: this is asked for every frame by the catch card, the
     fight bar and anything else showing an astral catch, so it is a hue walk
     with no allocation and no string parsing. */
  function hueRgb(h) {
    const k = function (n) {
      const q = (n + h * 6) % 6;
      return Math.round(255 * (0.62 + 0.34 * U.clamp(Math.min(q, 4 - q, 1), -1, 1)));
    };
    return [k(5), k(3), k(1)];
  }

  /* What a tier looks like right now. Everything but the last one is a
     constant; `t` is seconds and `off` shifts the cycle so two things on
     screen at once are not the same colour. */
  function colorAt(id, t, off) {
    const r = BY_ID[id] || BY_ID.common;
    if (!r.rainbow) return U.hexToRgb(r.color);
    return hueRgb((((t || 0) * 0.17 + (off || 0)) % 1 + 1) % 1);
  }
  function cssAt(id, t, off, a) {
    return U.rgbToCss(colorAt(id, t, off), a === undefined ? 1 : a);
  }

  /* Painting a rarity onto a DOM node.

     The tier colours are all constants except one, and the one that is not
     changes every frame — which is not something to drive from JS across the
     forty-odd places that show a rarity pip. So the element gets the static
     hex inline (which is what it looks like with animations turned off, and
     is a perfectly good colour) plus a class, and css/base.css cycles it. A
     CSS animation outranks an inline declaration, so the two do not fight. */
  function paint(el, id, prop) {
    if (!el) return;
    const r = BY_ID[id] || BY_ID.common;
    const bow = !!r.rainbow;
    el.classList.toggle('bow-bg', bow && prop !== 'color');
    el.classList.toggle('bow-fg', bow && prop === 'color');
    el.style[prop] = r.color;
  }

  VF.rarities = {
    list: LIST,
    paint: paint,
    visible: visible,
    rainbow: function (id) { return !!(BY_ID[id] && BY_ID[id].rainbow); },
    colorAt: colorAt, cssAt: cssAt, hueRgb: hueRgb,
    hidden: function (id) { return !!(BY_ID[id] && BY_ID[id].hidden); },
    get: function (id) { return BY_ID[id] || BY_ID.common; },
    rank: function (id) { return (BY_ID[id] || BY_ID.common).rank; },
    color: function (id) { return (BY_ID[id] || BY_ID.common).color; },
    /* Draw weight for a tier at a given rarity power. */
    weightAt: function (r, rp) {
      return r.pow === 0 ? r.weight : r.weight * Math.pow(rp, r.pow);
    }
  };
})(window.VF = window.VF || {});
