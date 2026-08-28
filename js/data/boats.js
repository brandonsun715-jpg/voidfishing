/* VOID FISHING — the boat, its parts and its paint.

   The rule this file was written against: a tier must never be "the last one
   but ten percent faster". Every hull unlocks something that was not possible
   before it — a stretch of water, a class of encounter, a whole system — and
   the numbers are the smaller half of what you are buying.

     skiff       the rock you were already sitting on, with a bottom.
     dory        crossings become gameplay: sea events, and a hold.
     survey      expeditions. The instruments are the point.
     hunter      you can go looking for the things that were finding you.
     voidship    water that is not water. Beneath, and above.

   MODULES are five slots that every hull has and that better hulls give more
   levels of. A module is not a stat line: sonar is the only way to see
   anything in the trench, research is the only way to identify what you did
   not land, and the hold is the only reason to be out for more than one cast.

   PAINT and TRIM are cosmetic and are meant to be. The boat is on screen
   under the angler in every single frame of the game, so it is the one place
   where a cosmetic is not a menu item — it is what the game looks like. */
(function (VF) {
  'use strict';

  /* ------------------------------------------------------------- hulls */

  const HULLS = [
    { id: 'skiff', name: 'The Skiff', rank: 0, cost: 0,
      tag: 'it floats, and that is the whole of the claim',
      desc: 'Somebody left it. The bottom boards are sound and one of the rowlocks is a ' +
            'bent nail. It will hold you and a rod and about four fish, and it will not ' +
            'hold you and a rod and four fish in weather.',
      len: 1.00, beam: 0.92, sheer: 0.30, prow: 0.38, cabin: 0, mast: 0,
      slots: { engine: 1, sonar: 0, hold: 1, survey: 0, tackle: 1 },
      hull: '#6a5a44', trim: '#3a3024',
      /* how much of a crossing this hull can take before it starts costing */
      integrity: 60, speed: 1.00,
      unlocks: [] },

    { id: 'dory', name: 'The Long Dory', rank: 1, cost: 48000, level: 8,
      tag: 'built for getting somewhere',
      desc: 'Narrow, high at both ends, and it goes through a sea rather than over it. ' +
            'The first boat that makes the water between two places worth crossing on ' +
            'purpose — with this under you, things happen out there.',
      len: 1.26, beam: 0.86, sheer: 0.36, prow: 0.62, cabin: 0, mast: 0.5,
      slots: { engine: 2, sonar: 1, hold: 2, survey: 0, tackle: 2 },
      hull: '#7a6448', trim: '#2e3a46',
      integrity: 100, speed: 1.35,
      unlocks: ['crossings'] },

    { id: 'survey', name: 'Survey Vessel Wren', rank: 2, cost: 420000, level: 22,
      tag: 'instruments, and somewhere dry to read them',
      desc: 'A working boat with a cabin, a bench of instruments and a winch on the ' +
            'afterdeck. It is not fast and it is not pretty and it is the first thing ' +
            'you have owned that can be sent somewhere with a question.',
      len: 1.44, beam: 1.06, sheer: 0.30, prow: 0.52, cabin: 0.62, mast: 0.7,
      slots: { engine: 3, sonar: 3, hold: 3, survey: 3, tackle: 2 },
      hull: '#8a8478', trim: '#1f3a4a',
      integrity: 170, speed: 1.60,
      unlocks: ['crossings', 'expeditions'] },

    { id: 'hunter', name: 'The Long Hunter', rank: 3, cost: 2600000, level: 40,
      tag: 'for going after the things that were coming to you',
      desc: 'Reinforced from the waterline down, a gantry over the stern and a great deal ' +
            'of line on a drum that is not for fish. Everything on it is for holding on to ' +
            'something much larger than the boat while it decides what to do.',
      len: 1.58, beam: 1.14, sheer: 0.26, prow: 0.46, cabin: 0.52, mast: 0.9,
      slots: { engine: 4, sonar: 4, hold: 4, survey: 3, tackle: 4 },
      hull: '#4a4e52', trim: '#7a2e28',
      integrity: 300, speed: 1.85,
      unlocks: ['crossings', 'expeditions', 'hunt'] },

    { id: 'voidship', name: 'THE UNDERSIDE', rank: 4, cost: 40000000, level: 60,
      tag: 'not a boat for water',
      desc: 'The hull is the right shape and it is made of something that has never been a ' +
            'tree. It does not displace anything. It sits on the surface the way a word ' +
            'sits on a page, and it will go under, and under is a direction now.',
      len: 1.50, beam: 1.00, sheer: 0.42, prow: 0.70, cabin: 0.40, mast: 1.0,
      slots: { engine: 5, sonar: 5, hold: 5, survey: 5, tackle: 5 },
      hull: '#241a3c', trim: '#b48aff',
      integrity: 520, speed: 2.20,
      glow: '#b48aff',
      unlocks: ['crossings', 'expeditions', 'hunt', 'descent'] }
  ];

  /* ------------------------------------------------------------ modules

     `at(n)` is what level n of the module does, as a plain object the rest of
     the game reads. Levels are bought one at a time and cost more each time,
     which is what stops a new hull being an instant full refit. */

  const MODULES = [
    { id: 'engine', name: 'Engine', icon: '~',
      desc: 'How fast a crossing goes, and how much of the weather it shrugs off.',
      base: 9000, step: 2.1,
      at: function (n) { return { speed: 1 + n * 0.30, wear: 1 - n * 0.10 }; },
      line: function (n) { return n ? 'crossings ' + (1 + n * 0.30).toFixed(2) + '× faster' : 'oars'; } },

    { id: 'sonar', name: 'Sonar', icon: '((',
      desc: 'Sees what the water will not show you: contacts in the dark, anomalies, and ' +
            'the shape of a thing before it surfaces.',
      base: 26000, step: 2.4,
      at: function (n) { return { range: n, contacts: n > 0, ident: n >= 3 }; },
      line: function (n) {
        if (!n) return 'nothing but the naked eye';
        if (n < 3) return 'contacts at ' + (n * 400) + ' m';
        return 'contacts at ' + (n * 400) + ' m, and it says what they are';
      } },

    { id: 'hold', name: 'The Hold', icon: '[]',
      desc: 'Somewhere to put things. Every level is five more kept catches and one more ' +
            'thing you can carry out of an expedition.',
      base: 14000, step: 1.9,
      at: function (n) { return { keep: n * 5, carry: n }; },
      line: function (n) { return n ? '+' + (n * 5) + ' kept · ' + n + ' recovered per expedition'
                                    : 'a bucket'; } },

    { id: 'survey', name: 'Survey Gear', icon: '+',
      desc: 'Winch, sample jars, a camera that works below the light. It identifies what ' +
            'you did not manage to land, which is most of what is out there.',
      base: 55000, step: 2.6,
      at: function (n) { return { identify: n > 0, clues: n * 0.22, legs: n }; },
      line: function (n) {
        if (!n) return 'no instruments';
        return 'identifies what escapes · +' + Math.round(n * 22) + '% clues';
      } },

    { id: 'tackle', name: 'Deck Tackle', icon: 'T',
      desc: 'Rod holders, a gimbal and a fighting chair. It does not make the fish smaller. ' +
            'It makes holding on to one a job you can do sitting down.',
      base: 18000, step: 2.0,
      at: function (n) { return { bar: 1 + n * 0.07, line: 1 + n * 0.09 }; },
      line: function (n) { return n ? 'bar +' + (n * 7) + '% · line +' + (n * 9) + '%'
                                    : 'the rod, in your hands'; } }
  ];

  /* -------------------------------------------------------------- paint */

  const PAINT = [
    { id: 'work', name: 'Working', hull: '#6a5a44', trim: '#3a3024', cost: 0 },
    { id: 'tar', name: 'Tarred', hull: '#2a2620', trim: '#4a4038', cost: 4000 },
    { id: 'harbour', name: 'Harbour Blue', hull: '#2e4a66', trim: '#d8c9a8', cost: 9000 },
    { id: 'bone', name: 'Bone', hull: '#cfc6b2', trim: '#5a5346', cost: 16000 },
    { id: 'survey', name: 'Survey Grey', hull: '#8a8478', trim: '#1f3a4a', cost: 24000 },
    { id: 'red', name: 'Lead Red', hull: '#7a2e28', trim: '#2a2018', cost: 34000 },
    { id: 'moon', name: 'Moonwash', hull: '#b8cfe8', trim: '#3a4a68', cost: 90000,
      need: function (d) { return VF.locations.isUnlocked('basin'); } },
    { id: 'crystal', name: 'Crystalline', hull: '#7a5aa8', trim: '#c8a0ff', cost: 260000, glow: '#c8a0ff',
      need: function (d) { return VF.locations.isUnlocked('abyss'); } },
    { id: 'void', name: 'Voidwash', hull: '#1a1030', trim: '#9f7fff', cost: 1400000, glow: '#9f7fff',
      need: function (d) { return VF.locations.isUnlocked('nowhere'); } },
    { id: 'gold', name: 'Leafed', hull: '#c8a24a', trim: '#f0dca8', cost: 6000000, glow: '#ffe6a8',
      need: function (d) { return (d.stats.catches | 0) >= 2000; } }
  ];

  /* --------------------------------------------------------------- trim

     Lights, flags and the things you bolt on. Cosmetic, and every one of them
     is visible from the fishing view, which is the point of them. */
  const TRIM = [
    { id: 'lamp', name: 'Stern Lamp', cost: 3000, slot: 'light',
      desc: 'A lamp on a bracket over the transom. It swings.' },
    { id: 'lanterns', name: 'Strung Lanterns', cost: 22000, slot: 'light',
      desc: 'A line of them from the mast to the bow. Absolutely no use for anything.' },
    { id: 'floodlight', name: 'Deck Flood', cost: 90000, slot: 'light',
      desc: 'It lights the water for about four metres and the dark for none of it.',
      need: function (d) { return VF.locations.isUnlocked('trench'); } },
    { id: 'coldfire', name: 'Cold Fire', cost: 900000, slot: 'light', glow: '#a8f0ff',
      desc: 'It does not flicker and it does not warm anything, and the fish come to it.',
      need: function (d) { return VF.locations.isUnlocked('abyss'); } },

    { id: 'flagplain', name: 'A Flag', cost: 2000, slot: 'flag',
      desc: 'Nothing on it. Somebody will ask.' },
    { id: 'flagdeep', name: "Deepwater Colours", cost: 40000, slot: 'flag',
      desc: 'Flown by boats that have been over the trench and come back.',
      need: function (d) { return VF.locations.isUnlocked('trench'); } },
    { id: 'flagvoid', name: 'No Colours At All', cost: 800000, slot: 'flag', glow: '#9f7fff',
      desc: 'A flag-shaped absence on a pole. It moves in wind that is not there.',
      need: function (d) { return VF.locations.isUnlocked('nowhere'); } },

    { id: 'crate', name: 'Deck Crates', cost: 6000, slot: 'deck',
      desc: 'Lashed down forward. Two of them are empty and one is not yours.' },
    { id: 'winch', name: 'Stern Winch', cost: 120000, slot: 'deck',
      desc: 'A drum of line thick enough to tow the boat with.',
      need: function (d) { return VF.boat && VF.boat.tierRank() >= 2; } },
    { id: 'gantry', name: 'Boom Gantry', cost: 700000, slot: 'deck',
      desc: 'For lifting something out of the water that will not come out on a rod.',
      need: function (d) { return VF.boat && VF.boat.tierRank() >= 3; } }
  ];

  const H_BY_ID = VF.util.byId(HULLS);
  const M_BY_ID = VF.util.byId(MODULES);
  const P_BY_ID = VF.util.byId(PAINT);
  const T_BY_ID = VF.util.byId(TRIM);

  /* What one more level of a module costs. Geometric, so the fifth level of
     the sonar is a project and the first is an afternoon. */
  function modCost(id, have) {
    const m = M_BY_ID[id];
    if (!m) return Infinity;
    return Math.round(m.base * Math.pow(m.step, have));
  }

  VF.boatData = {
    hulls: HULLS, modules: MODULES, paint: PAINT, trim: TRIM,
    hull: function (id) { return H_BY_ID[id] || HULLS[0]; },
    module: function (id) { return M_BY_ID[id] || null; },
    paintOf: function (id) { return P_BY_ID[id] || PAINT[0]; },
    trimOf: function (id) { return T_BY_ID[id] || null; },
    modCost: modCost,
    rankOf: function (id) { const h = H_BY_ID[id]; return h ? h.rank : 0; }
  };
})(window.VF = window.VF || {});
