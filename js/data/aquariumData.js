/* VOID FISHING — the aquarium, as data.

   Keeping a fish used to mean a row in a list. The wall improved on that for a
   handful of them; this is the rest of the answer. A specimen in a tank is a
   thing you visit rather than a thing you own, it remembers the evening it was
   caught, it pays a little for its own upkeep, and — if you keep it long
   enough and put it next to the right neighbour — it tells you something about
   the water that nobody has written down.

   Everything in this file is numbers and words. The room is drawn in
   js/render/aquariumArt.js and run in js/systems/aquarium.js. */
(function (VF) {
  'use strict';

  /* ------------------------------------------------------------ the room

     One tank on the day you are handed the key, and the room grows around the
     tanks rather than the tanks being dropped into a room that was always this
     big. That is the whole reason the aquarium is a place and not a list. */

  const TANK_BASE = 5;          // specimens a new tank holds
  const TANK_STEP = 5;          // and what one upgrade adds
  const TANK_MAX_SLOTS = 30;    // six upgrades, and then it is a big tank

  /* What the nth extra tank costs, and the level it opens at. The first is
     nearly free because a second tank is what turns the room into a room. */
  const TANKS = [
    { cost: 0,          level: 1 },
    { cost: 45000,      level: 10 },
    { cost: 900000,     level: 24 },
    { cost: 18000000,   level: 40 },
    { cost: 340000000,  level: 58 },
    { cost: 6200000000, level: 76 }
  ];

  /* Widening a tank. Each step is a good deal more than the last, so a wide
     tank is a decision rather than a formality. */
  function slotCost(current) {
    const steps = Math.max(0, Math.round((current - TANK_BASE) / TANK_STEP));
    return Math.round(26000 * Math.pow(4.1, steps));
  }

  /* ---------------------------------------------------------- the income

     A specimen pays for its own glass and very little more. The deal this game
     makes elsewhere — see js/systems/away.js — is that nothing is owed to you
     for time passing, and an aquarium that out-earned fishing would break that
     without ever saying so. So: a small fraction of what the fish was worth,
     per second, and a buffer that stops filling after six hours. Come back
     after a week and you are owed exactly what you were owed after a night. */
  const RATE = 0.000040;             // of the specimen's value, per second
  const BUFFER_HOURS = 6;

  /* ---------------------------------------------------------- the research

     Housing a species studies it. Rarer things take longer, and a second
     specimen of the same species helps but does not double the pace — two
     Moonfish are still one Moonfish as far as anybody watching them learns. */
  const RESEARCH_RATE = 0.00055;     // fraction per second, at rank 0

  /* What the desk says as a species fills up. `kind` is only what the line is
     called; the reveal itself is the sentence. */
  const MILESTONES = [
    { at: 0.25, kind: 'behaviour', label: 'feeding behaviour documented' },
    { at: 0.50, kind: 'range',     label: 'range and depth mapped' },
    { at: 0.75, kind: 'anatomy',   label: 'anatomy catalogued' },
    { at: 1.00, kind: 'complete',  label: 'research complete' }
  ];

  /* -------------------------------------------------------- the discoveries

     The end of the aquarium, and the reason to keep a specimen after its
     research bar has filled. Two fully-researched species in the same tank,
     and the water does something.

     `kind` decides what the finding IS:
       species    a fish that was not in the game until now
       lure       a bait nobody sells
       spot       something down there worth writing down
       boss       how one of the big ones actually behaves
       structure  a thing, not a creature

     `hint` is what the researchers say once BOTH halves are fully studied but
     before they have been put together — the game telling you what to try
     rather than expecting you to guess. */
  const DISCOVERIES = [
    { id: 'nullfish', a: 'moonfish', b: 'null_jelly', kind: 'species', grant: 'nullfish',
      title: 'THE NULLFISH',
      hint: 'Moonfish appear to respond to the presence of Void specimens. Try placing a Moonfish beside one.',
      text: 'The Moonfish stopped moving. So did the jelly. For four seconds the tank held ' +
            'something that was neither of them, and then it swam off through the back wall. ' +
            'It is in the water now. It may always have been.' },

    { id: 'mirrorfry', a: 'mirror_twin', b: 'phantom_koi', kind: 'species', grant: 'mirrorfry',
      title: 'THE MIRRORFRY',
      hint: 'The Mirror Twin will not settle while the Phantom Koi is elsewhere in the room. Try the same tank.',
      text: 'They circled each other for an hour and then there were three. The third is ' +
            'smaller than either and casts no reflection at all, which given the parentage ' +
            'is either very funny or the beginning of something.' },

    { id: 'tidewright', a: 'tide_empress', b: 'glass_leviathan', kind: 'species', grant: 'tidewright',
      title: 'THE TIDEWRIGHT',
      hint: 'The Empress moves the water. The Leviathan is made of it. Nobody has tried them together.',
      text: 'The Empress began moving water that was not in the tank. The Leviathan let her. ' +
            'What they built between them took eleven hours and left when it was finished, ' +
            'and the trench has had a new current in it ever since.' },

    { id: 'deeplure', a: 'lamp_keeper', b: 'lamp_ray', kind: 'lure', grant: 'lure_pale',
      title: 'A LURE, OF SORTS',
      hint: 'Both of these carry a light. Housed together, they may agree on what it is for.',
      text: 'The Lampkeeper turned its lamp on the ray and the ray turned its lamp back, and ' +
            'between them they settled on a colour that nothing in the catalogue is supposed ' +
            'to be able to make. We have bottled some. It draws things.' },

    { id: 'structure', a: 'ancient_marlin', b: 'grave_tuna', kind: 'structure',
      title: 'SOMETHING BUILT',
      hint: 'Both of these came off the same wreck field. Put them together and see what they agree on.',
      text: 'Both specimens orient to the same bearing regardless of how the tank is turned. ' +
            'Followed out, that bearing ends at a structure on the trench floor that is far ' +
            'too regular to have fallen there. Nobody has been down. Somebody will.' },

    { id: 'bosswatch', a: 'leviathan', b: 'void_leviathan', kind: 'boss',
      title: 'BEHAVIOUR, DOCUMENTED',
      hint: 'One is the other, later. Housing them together would settle a long argument.',
      text: 'They did not fight. They took up position at opposite ends of the glass and held ' +
            'it for nine hours, and when the smaller one finally moved, the larger one moved ' +
            'first. Whatever the leviathans are doing, they are doing it together, and they ' +
            'are doing it in a direction.' }
  ];

  const BY_ID = VF.util.byId(DISCOVERIES);

  /* Every species that appears in a recipe, so the desk can mark them. */
  const IN_RECIPE = Object.create(null);
  DISCOVERIES.forEach(function (r) { IN_RECIPE[r.a] = r; IN_RECIPE[r.b] = r; });

  VF.aquariumData = {
    TANK_BASE: TANK_BASE, TANK_STEP: TANK_STEP, TANK_MAX_SLOTS: TANK_MAX_SLOTS,
    TANKS: TANKS, slotCost: slotCost,
    RATE: RATE, BUFFER_HOURS: BUFFER_HOURS,
    RESEARCH_RATE: RESEARCH_RATE, MILESTONES: MILESTONES,
    DISCOVERIES: DISCOVERIES,
    get: function (id) { return BY_ID[id] || null; },
    recipeFor: function (speciesId) { return IN_RECIPE[speciesId] || null; }
  };
})(window.VF = window.VF || {});
