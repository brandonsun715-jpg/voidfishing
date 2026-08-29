/* VOID FISHING — what the top of the catalogue fights like.

   The scripted fight was built for two catches and then used for two catches.
   Everything else, however rare, resolved on one set of numbers in about the
   same handful of seconds: a Void fish that took forty minutes to find was a
   six-second fight, three seconds longer than a Common. All the anticipation
   is in front of it — the roll happens five seconds early so the shadow can
   be watched coming in, the audio ducks, the prompt says something is coming —
   and then there was nothing on the other side of that to land on.

   So the tiers above Legendary get phases: mythic, void, and whatever the one
   after that is. A tier writes the shape of its fight once; every species in
   it inherits that shape and then bends it with its own difficulty, size and
   traits, so a big scarred Void fish is still worse than a small clean one. A
   species that declares its own `trial` keeps it — these are the floor, not a
   replacement.

   Legendary is deliberately not in here. It is the last tier a player meets
   on gear that is not ready for it, and a stray legendary on a starter rod
   was a twenty-seven second fight that was lost from about the fourth second.
   It keeps the ordinary fight.

   Phases gate on the meter rather than the clock, which is the whole reason
   this works: the fight is as long as the player makes it, and it only ever
   goes forwards. Losing ground inside the last phase does not put you back in
   the first. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* How much of the rod is allowed to shorten a tier-written fight — reel
     force on the fill rate, line strength on the bar width. Nought would make
     gear worthless here and one lets the last rod turn the top tier into five
     seconds; this keeps the ladder worth climbing without letting it erase
     what it climbed to. Everything else the rod does — how fast the bar moves,
     how sharply it answers, the rarity it draws — is untouched. */
  const GEAR_FILL = 0.45;
  const GEAR_BAR = 0.55;

  /* Read as: at this much of the meter, the fight becomes this.

     `barW` narrows and `fishSpeed` climbs across a tier's phases, so the fight
     gets harder as it goes rather than front-loading. `fill` is deliberately
     low — that is what buys the duration — and `drain` climbs with it so a
     long fight is not merely a slow one you cannot lose. */
  const TIERS = {
    mythic: {
      name: 'mythic',
      phases: [
        { at: 0.00, name: 'Something Heavy', start: 0.28,
          barW: 0.205, barSpeed: 1.10, fishSpeed: 0.74, fishTurn: 0.55, dart: 0.44,
          fill: 0.1472, drain: 0.15 },
        { at: 0.42, name: 'It Has The Line',
          barW: 0.170, barSpeed: 1.24, fishSpeed: 0.88, fishTurn: 0.38, dart: 0.58,
          evade: 0.16, fill: 0.1408, drain: 0.171 },
        { at: 0.76, name: 'Nearly Up',
          barW: 0.145, barSpeed: 1.36, fishSpeed: 0.98, fishTurn: 0.28, dart: 0.66,
          evade: 0.28, fill: 0.1536, drain: 0.189 }
      ]
    },

    'void': {
      name: 'void',
      phases: [
        { at: 0.00, name: 'It Comes Up', start: 0.26,
          barW: 0.209, barSpeed: 1.14, fishSpeed: 0.80, fishTurn: 0.48, dart: 0.50,
          fill: 0.1756, drain: 0.159 },
        { at: 0.38, name: 'It Sees The Boat',
          barW: 0.174, barSpeed: 1.28, fishSpeed: 0.94, fishTurn: 0.34, dart: 0.62,
          evade: 0.22, fill: 0.1663, drain: 0.18 },
        { at: 0.70, name: 'It Does Not Want To',
          barW: 0.145, barSpeed: 1.42, fishSpeed: 1.04, fishTurn: 0.25, dart: 0.72,
          evade: 0.34, fill: 0.1802, drain: 0.201 }
      ]
    },

    glitch: {
      name: 'glitch',
      phases: [
        /* it is not a fish and it does not fight like one: it is heavy, it is
           wrong, and none of it is in a hurry */
        { at: 0.00, name: 'It Is Not Moving', start: 0.26,
          barW: 0.205, barSpeed: 1.10, fishSpeed: 0.70, fishTurn: 0.85, dart: 0.28,
          fill: 0.1536, drain: 0.15 },
        { at: 0.32, name: 'Now It Is',
          barW: 0.172, barSpeed: 1.28, fishSpeed: 0.92, fishTurn: 0.30, dart: 0.62,
          evade: 0.18, fill: 0.144, drain: 0.174 },
        { at: 0.60, name: 'The Wrong Shape',
          barW: 0.148, barSpeed: 1.40, fishSpeed: 1.00, fishTurn: 0.22, dart: 0.72,
          evade: 0.32, fill: 0.1488, drain: 0.192 },
        { at: 0.86, name: 'Whatever This Is',
          barW: 0.128, barSpeed: 1.52, fishSpeed: 1.08, fishTurn: 0.18, dart: 0.78,
          evade: 0.42, fill: 0.1776, drain: 0.213 }
      ]
    }
  };

  /* The species' own weight on the tier's shape.

     Everything in a tier fights like its tier; what separates two Void fish is
     how hard each one is, how big this one came up, and what it is carrying.
     Without this a phase table would flatten a tier into one fight, which is
     the problem it was written to solve one level up. */
  function scaleFor(c) {
    const f = c.fish || {};
    const tf = VF.traits ? VF.traits.fight(c.traits || []) : { power: 1, stamina: 1, surge: 1 };
    /* diff runs about 0.6–1.0 across a tier; pct is where this one landed in
       its own size range. Neither moves the fight much on its own — together
       they are worth about a quarter either way. */
    const d = U.clamp((f.diff || 0.8) - 0.80, -0.25, 0.25);
    const s = (U.clamp(c.pct || 0.5, 0, 1) - 0.5) * 0.20;
    const power = Math.pow(U.clamp(tf.power, 0.7, 1.8), 0.55);
    return {
      speed: U.clamp((1 + d * 0.55 + s) * power, 0.80, 1.45),
      dart: U.clamp((1 + d * 0.70 + s) * power, 0.80, 1.50),
      drain: U.clamp(1 + d * 0.45 + s * 0.6, 0.85, 1.30),
      // a fish with stamina takes longer, exactly as it does in a normal fight
      fill: U.clamp(1 / U.clamp(tf.stamina, 0.7, 1.7), 0.62, 1.35),
      surge: U.clamp(tf.surge, 0.6, 2.2)
    };
  }

  /* The phase list for a catch, or null if this one does not get one. */
  function forCatch(c) {
    if (!c || c.kind === 'treasure') return null;
    if (c.fish && c.fish.trial) return null;        // it wrote its own
    const tier = TIERS[c.rarity];
    if (!tier) return null;

    const k = scaleFor(c);
    const phases = tier.phases.map(function (ph) {
      const out = {};
      for (const key in ph) out[key] = ph[key];
      out.fishSpeed = ph.fishSpeed * k.speed;
      out.dart = U.clamp(ph.dart * k.dart, 0, 0.90);
      out.drain = ph.drain * k.drain;
      out.fill = ph.fill * k.fill;
      out.fishTurn = ph.fishTurn / k.surge;
      // the bar has to stay able to run the fish down, whatever the scaling did
      out.barSpeed = Math.max(ph.barSpeed, out.fishSpeed * 1.12);
      out.gearFill = GEAR_FILL;
      out.gearBar = GEAR_BAR;
      return out;
    });
    return { phases: phases, tier: tier.name, generated: true };
  }

  VF.trials = {
    TIERS: TIERS,
    forCatch: forCatch,
    /* Which tiers fight in phases, for anything that wants to say so. */
    has: function (rarity) { return !!TIERS[rarity]; }
  };
})(window.VF = window.VF || {});
