/* VOID FISHING — clues, and the leads they point at.

   This is the spine of the expansion and it is deliberately the smallest file
   in it. Everything else — encounters, voyages, expeditions, the boat — hands
   the player a CLUE, and a clue's only job is to open a LEAD. A lead is a
   place, a condition, and a sentence about what to do when you get there.

   The player is never told a chain exists. They are told one thing at a time,
   and each thing they act on tells them the next. That is the whole design:

     catch something wrong  ->  clue  ->  lead  ->  sail there  ->  encounter
     ->  discovery  ->  clue  ->  ...

   `text` is what the journal records. `opens` is what the clue puts on the
   chart. A clue with no `opens` is flavour and lore, which is fine — not
   every strange thing has to be a quest. */
(function (VF) {
  'use strict';

  /* ------------------------------------------------------------- clues */

  const CLUES = {
    /* --- the opening thread: something is wrong with the shore --- */
    bottle_shore: {
      title: 'the bottle, and what was in it',
      text: 'rolled up small and dry. "it stands off the shore at last light and it does not ' +
            'come in. i have counted it eleven evenings. it is not a rock because on the ' +
            'twelfth evening it was not there."',
      opens: 'offshore_shadow'
    },
    wrongwater: {
      title: 'a fish that does not live here',
      text: 'this came up in ankle-deep water off the shore and it has the eyes of something ' +
            'that has never been within a kilometre of a surface. either it swam a very long ' +
            'way up, or the water here is deeper than the chart is prepared to say.',
      opens: 'offshore_shadow'
    },
    watched: {
      title: 'it looked back',
      text: 'it had been out there long enough to be scenery. it stopped being scenery the ' +
            'moment it turned. no splash, no wake, and then nothing at all — and the whole ' +
            'business took about a second and a half. the direction it went is down.',
      opens: 'trench_contact'
    },
    trench_echo: {
      title: 'the echo that came back wrong',
      text: 'the ping went out and two came back. the second one was late by about the ' +
            'time it would take to travel to something a great deal further away than the ' +
            'first thing, and it was louder.',
      opens: 'lurker_hunt'
    },
    lurker_scale: {
      title: 'the scale it left',
      text: 'as wide as a dinner plate and thin as paper, and the underside is not the ' +
            'underside of a scale. it is the underside of a tile. somebody made this, or ' +
            'something grew it copying something somebody made.',
      opens: 'sunken_city'
    },

    /* --- the thief --- */
    stolen: {
      title: 'the empty hook',
      text: 'the bait is gone and the hook is not bent. whatever took it worked the barb ' +
            'the way a person works a knot, which is a thing to sit with for a while.',
      opens: 'thief_hunt'
    },

    /* --- the devourer --- */
    devoured: {
      title: 'what was on the line, and what took it',
      text: 'a good fish, three quarters of the way up, and then it stopped being a good ' +
            'fish and started being the front half of one. the second shape did not hurry ' +
            'and did not surface. the line came back cut clean by nothing.',
      opens: 'deep_hunt'
    },

    /* --- the queen --- */
    swarmlight: {
      title: 'the small ones move together',
      text: 'they are not a shoal. a shoal turns as one because each of them is watching ' +
            'its neighbour. these turn as one because something below them turned first.',
      opens: 'queen_hunt'
    },

    /* --- the cradle, and what is under it --- */
    cradle_plate: {
      title: 'the plate from the ring',
      text: 'prised out of the wreck overhead. the machining is finer than anything on the ' +
            'shore can do and the metal has not corroded in what must be centuries. one ' +
            'face carries a diagram: the ring, the water in it, and a line going straight ' +
            'down out of the bottom of the picture, well past where the artist ran out of plate.',
      opens: 'beneath_way'
    },
    nowhere_double: {
      title: 'the other boat',
      text: 'same hull, same lamp, same list to port. it was doing what i was doing about ' +
            'four hundred metres off, and when i put the glass on it, it had the glass on me. ' +
            'i waved. it did not, and i am fairly sure i did not either.',
      opens: 'nowhere_drift'
    },

    /* --- flavour, no lead --- */
    glass_crack: {
      title: 'on the cracking',
      text: 'water does not crack. this makes a sound like a lake in january and then there ' +
            'is a line in it that stays there, and things come up through the line.'
    },
    heaven_light: {
      title: 'the light that is not the sun',
      text: 'it comes from above the cloud and it does not move with the day. the rod is ' +
            'warm on the side facing it.'
    }
  };

  /* ------------------------------------------------------------- leads

     `where` is the location it points at, or null for "anywhere". `note` is
     the line on the chart. `test(d)` is the condition that has to be true
     when you get there — weather, time, a module, a phase of the moon. If it
     is not met the lead stays open and says what is missing.

     `kind` decides what happens when the lead is satisfied:
       'creature'  start that creature's encounter
       'voyage'    force that sea event on the next crossing
       'expedition' begin that expedition
       'place'     hand over a secret location                                */

  const LEADS = {
    offshore_shadow: {
      name: 'something offshore',
      where: 'shore', kind: 'creature', target: 'watcher',
      note: 'stands off the Quiet Shore at last light. does not come in.',
      need: 'at dusk or after dark',
      test: function () {
        const p = VF.time.phase();
        return p === 'sunset' || p === 'night';
      }
    },
    trench_contact: {
      name: 'the second echo',
      where: 'trench', kind: 'sonar', target: 'trench_echo',
      note: 'the trench answers a ping twice. find out what the second one is.',
      need: 'a sonar array on the boat',
      test: function () { return VF.boat && VF.boat.has('sonar'); }
    },
    lurker_hunt: {
      name: 'whatever is under the trench',
      where: 'trench', kind: 'creature', target: 'lurker',
      note: 'it is down there and it knows where you are. work out where it is.',
      need: null, test: function () { return true; }
    },
    thief_hunt: {
      name: 'the one that took the bait',
      where: null, kind: 'creature', target: 'thief',
      note: 'it will come back for more. it always does.',
      need: null, test: function () { return true; }
    },
    deep_hunt: {
      name: 'the second shape',
      where: 'abyss', kind: 'creature', target: 'devourer',
      note: 'something eats what you catch. put something worth eating on the line.',
      need: null, test: function () { return true; }
    },
    queen_hunt: {
      name: 'what the small ones are following',
      where: 'abyss', kind: 'creature', target: 'queen',
      note: 'the swarm turns because something below it turned. be there when it does.',
      need: 'during a crystal resonance',
      test: function () { return VF.conditions && VF.conditions.has('resonance'); }
    },
    sunken_city: {
      name: 'the tile that was a scale',
      where: 'trench', kind: 'expedition', target: 'sunken_city',
      note: 'somebody built something down there. find out how much of it is left.',
      need: 'a research vessel or better',
      test: function () { return VF.boat && VF.boat.tierRank() >= 2; }
    },
    beneath_way: {
      name: 'the line off the bottom of the diagram',
      where: 'cradle', kind: 'expedition', target: 'the_descent',
      note: 'the ring was pointing at something under it the whole time.',
      need: 'a hull rated for the descent',
      test: function () { return VF.boat && VF.boat.tierRank() >= 3; }
    },
    nowhere_drift: {
      name: 'the other boat',
      where: 'nowhere', kind: 'creature', target: 'double',
      note: 'it is doing what you are doing, about four hundred metres off.',
      need: null, test: function () { return true; }
    }
  };

  VF.discoveryData = {
    clues: CLUES,
    leads: LEADS,
    clue: function (id) { return CLUES[id] || null; },
    lead: function (id) { return LEADS[id] || null; }
  };
})(window.VF = window.VF || {});
