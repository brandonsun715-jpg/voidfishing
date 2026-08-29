/* VOID FISHING — the long ones.

   An expedition is not a location with better fish in it. It is a sequence of
   legs, each of which is a different verb, and the only thing they have in
   common is that they are all about the same question.

   A leg is:
     at      where it happens, or null for anywhere
     task    the line the journal prints while it is the current one
     need    what has to become true. Returns true when the leg is done.
     enter   optional: fires when the leg becomes current
     done    optional: fires when it completes — writes lore, opens a lead,
             starts an encounter, hands over a place

   `need` is checked on the events that could plausibly satisfy it — a catch,
   an arrival, a clue, a crossing — rather than on a timer, so a leg completes
   at the moment the player did the thing rather than up to a second later.

   Three of them, and they are three different shapes on purpose: one is an
   investigation, one is a descent, one is a hunt. */
(function (VF) {
  'use strict';

  const LIST = [

    /* ===================================================== THE SUNKEN CITY
       An investigation. Every leg is a different kind of looking. */
    { id: 'sunken_city', name: 'The Sunken City', where: 'trench',
      need: 'a survey vessel, and the tile that was a scale',
      objective: 'Find out what is ringing beneath the trench.',
      blurb: 'somebody built something down there, and some of it is still running',
      legs: [
        { at: 'trench', task: 'get a sonar fix on the source. it is not where the tile came from.',
          need: function (d, e) { return (e.found.pings | 0) >= 3; },
          hint: 'three sonar contacts in the trench',
          enter: function () {
            VF.journal.addFree('exp:city:1', 'the survey begins',
              'the tile is machined and the machining is finer than anything on the shore can do. ' +
              'it did not wash down from anywhere. it came off something that is down there now.',
              'lore', 0);
          },
          done: function () {
            VF.journal.addFree('exp:city:2', 'three fixes',
              'they do not triangulate. each one puts the source somewhere else, and the three ' +
              'somewheres are equidistant from a fourth point that none of the pings touched.',
              'find', 1);
          } },

        { at: null, task: 'cross to the abyss. it is on the far side of the fourth point.',
          need: function (d, e) { return (e.found.crossed | 0) >= 1; },
          hint: 'one crossing with the fix aboard',
          done: function () {
            VF.discovery.clue('lurker_scale', true);
          } },

        { at: 'abyss', task: 'the water here is lit from below and the light has corners.',
          need: function (d, e) { return (e.found.seen | 0) >= 1; },
          hint: 'catch something in the abyss with the fix aboard',
          done: function () {
            /* The place itself. Registered like any other secret, so the
               chart, the loot pool, the palette and the map all pick it up
               with no changes at all. */
            VF.expedition.grantPlace({
              id: 'sunken_city', name: 'The Sunken City', level: 0, near: 'abyss',
              tag: 'streets, and the water above them',
              desc: 'Eleven blocks of it, standing, with the water filling every room to the ' +
                    'ceiling and the ceilings intact. The lamps in the streets are lit. ' +
                    'Nothing has silted up, which after four hundred years is the part that ' +
                    'is difficult to sit with.',
              hint: 'a city, and the water above it',
              rarityBoost: 2.80, valueBoost: 2.60, xpBoost: 26.0, biteBoost: 0.92,
              sky: ['#0a1420', '#1e3448'], water: ['#123044', '#02080f'], glow: '#8fe0d0',
              fog: '#173444', fogAmt: 0.46, stars: 0.55, starTint: '#cfeff0',
              horizon: 'monolith', silhouette: 'ruins', depth: 0.52, void: 0.44,
              weather: ['fog', 'overcast', 'rain', 'eclipse'],
              music: { root: 49, scale: [0, 2, 5, 7, 10], tempo: 0.09, pad: 0.88 }
            }, 'the streets are lit and there is nobody in them.');
          } },

        { at: 'sunken_city', task: 'find what is ringing. it has been ringing the whole time.',
          need: function (d, e) { return (e.found.bell | 0) >= 1; },
          hint: 'land anything in the city',
          done: function () {
            VF.journal.addFree('exp:city:end', 'what was ringing',
              'a bell, on a tower, four streets in, and it is under eleven metres of water and ' +
              'it is dry inside. it rings on the hour. it has been ringing on the hour since ' +
              'before anybody now alive was born and it is nobody\'s hour.',
              'lore', 1);
            VF.discovery.openLead('deep_hunt');
          } }
      ],
      reward: { money: 900000, xp: 240000 } },

    /* ========================================================= THE DESCENT
       A descent. One place, four depths, and it gets worse. */
    { id: 'the_descent', name: 'The Descent', where: 'cradle',
      need: 'the shaft open, and a hull rated for it',
      objective: 'Follow the missing part of the ring downward.',
      blurb: 'the ring was pointing at something under it the whole time',
      legs: [
        { at: 'cradle', task: 'go over the shaft and put a line down it.',
          need: function (d, e) { return (e.found.cast | 0) >= 4; },
          hint: 'four casts over the shaft',
          enter: function () {
            VF.journal.addFree('exp:desc:1', 'over the shaft',
              'the water above it does not move. the line goes down and keeps going down and ' +
              'the reel is still paying out when the arm gets tired.', 'lore', 0);
          } },
        { at: 'cradle', task: 'something came up the line that was not on the hook.',
          need: function (d, e) { return (e.found.up | 0) >= 1; },
          hint: 'land anything at the cradle',
          done: function () { VF.discovery.clue('beneath_way', true); } },
        { at: 'beneath', task: 'go down after it. all the way down.',
          need: function (d, e) { return (VF.zones.state('beneath').depth || 0) >= 0.55; },
          hint: 'hold the line out at Beneath until the reading stops climbing',
          done: function () {
            VF.journal.addFree('exp:desc:end', 'the bottom of the ring',
              'the shaft ends. it does not open out and it does not stop — it ends, the way a ' +
              'sentence ends, and what is on the other side of the full stop is the water you ' +
              'are already floating in.', 'lore', 1);
          } }
      ],
      reward: { money: 2400000, xp: 700000 } },

    /* ========================================================== THE HUNT
       A hunt. No lore at all: three creatures, in order, and a boat that can
       take it. */
    { id: 'the_long_hunt', name: 'The Long Hunt', where: null,
      need: 'a hull built for holding on to things',
      objective: 'Land the three that have been landing you.',
      blurb: 'you have been feeding something for years without being told',
      legs: [
        { at: null, task: 'the one that takes the bait off the barb.',
          need: function (d) { return !!(d.creatures.thief && d.creatures.thief.caught); },
          hint: 'land Hookfinger' },
        { at: null, task: 'the one that gets in behind the boat.',
          need: function (d) { return !!(d.creatures.follower && d.creatures.follower.caught); },
          hint: 'land the Wake Rider' },
        { at: null, task: 'and the one that has been eating what you catch.',
          need: function (d) { return !!(d.creatures.devourer && d.creatures.devourer.caught); },
          hint: 'land What Eats Them',
          done: function () {
            VF.journal.addFree('exp:hunt:end', 'the ledger, settled',
              'three of them, and the third one is the one that matters, because the third one ' +
              'has been at the bottom of every fight you have ever won and it never once had to ' +
              'come up for it.', 'event', 0);
          } }
      ],
      reward: { money: 4000000, xp: 1200000, trim: 'gantry' } }
  ];

  const BY_ID = VF.util.byId(LIST);

  VF.expeditionData = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; }
  };
})(window.VF = window.VF || {});
