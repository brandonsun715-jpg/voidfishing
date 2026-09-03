/* VOID FISHING — the things that are not caught, but met.

   An ordinary fish is a roll, a bite and a fight. Every one of these is a
   short scripted scene made of PHASES, and a phase is a verb rather than a
   difficulty number. That is the whole point of the file: the tier ladder
   already had "harder", and adding a nineteenth harder fish would not have
   made anything new happen.

   A phase is:
     { verb, dur, text, ... }

   and the verbs are the vocabulary. js/systems/creature.js knows how to run
   each one; a creature is a list of them, so a new encounter is data.

     watch     nothing to do. something is happening and you look at it.
     track     it is hiding in one of several places. pick the right one.
     chase     it is running. hold to close; let go and it gains.
     hold      it is pulling. hold within a window; too long and the line goes.
     choose    two or three answers. they branch.
     swarm     small things in the way. clear them before the timer.
     reveal    the disguise comes off / the shape changes.
     hook      hand over to the ordinary fight, with this creature on the line.
     escape    it goes. sometimes that is the ending and sometimes it is a lead.
     land      it is yours. rewards, journal, discovery.

   `on` is where it can begin: a location list, a weather list, a time list, a
   condition, a moon phase. Empty means anywhere. `trigger` is how it starts —
   'lead' means only ever from a lead, 'bite' means it can replace a bite,
   'reel' means it can interrupt a fight in progress, 'idle' means it can
   arrive while the line is out and nothing is happening.

   Every one names a `fish` — the species that goes in the fishdex when it is
   landed — so the collection, the aquarium, the wall and the records all work
   on these with no special cases.

   `again` is the second meeting, for the ones that got away:

     { after: { casts: 10 }, chance: 3.2, text: '...', phases: [...] }

   `after` is the remove, counted in things the player DID — casts, voyages,
   trips, visits — never in seconds. Until it is satisfied the creature is not
   in the water at all; afterwards `chance` multiplies its roll, so the rematch
   is a consequence rather than a coincidence. `text` replaces the opening line
   and `phases` replaces the whole script. Both optional, and a creature with
   no `again` at all still comes back changed — js/systems/pursuit.js writes it
   an opening out of whatever it was doing when it left. */
(function (VF) {
  'use strict';

  const LIST = [

    /* ================================================================ THE LURKER
       The first of them and the one the framework was designed around. You
       never see it until the end. You see where it has been. */
    { id: 'lurker', name: 'The Lurker', fish: 'lurker',
      rarity: 'void', kind: 'lurker', tier: 3,
      on: { locs: ['trench', 'abyss'], weather: [], time: [] },
      trigger: 'lead',
      blurb: 'a shape under the trench that moves when you are not looking at it',
      journal: 'it does not swim away and it does not swim at you. it relocates. ' +
               'between one look and the next it is somewhere else, and there is no ' +
               'wake between the two places because it did not travel between them.',
      reward: { money: 240000, xp: 90000, clue: 'lurker_scale' },
      phases: [
        { verb: 'watch', dur: 3.2, text: 'the water goes heavy. something the width of the boat passes underneath.' },
        { verb: 'track', slots: 4, rounds: 3, window: 4.6,
          text: 'it is under one of them. the water tells you which if you let it.',
          hint: 'press the disturbance' },
        { verb: 'watch', dur: 2.4, text: 'it stops relocating. that is worse.' },
        { verb: 'hook', text: 'it comes up on its own.' },
        { verb: 'land' }
      ],
      onEscape: { text: 'it was somewhere else before the hook was anywhere.', keepLead: 1 },
      /* It relocates; that is the whole of it. So the second meeting is the
         one where it does not bother, because it has worked out that being
         somewhere else is only useful against something that is looking. */
      again: { after: { trips: 1 }, chance: 3.0,
               text: 'the water goes heavy in the same way. it does not move this time.' } },

    /* ================================================================= THE THIEF
       Fastest encounter in the game and the only one you can lose in four
       seconds. It does not fight. It leaves. */
    { id: 'thief', name: 'Hookfinger', fish: 'hookfinger',
      rarity: 'mythic', kind: 'thief', tier: 2,
      on: { locs: [], weather: [], time: [] },
      trigger: 'bite', chance: 0.020,
      blurb: 'takes the bait off the barb without bending it and is gone',
      journal: 'six digits on each of the front pair and a thumb that opposes. it did not ' +
               'bite the bait off. it untied it.',
      reward: { money: 46000, xp: 14000, bait: ['star', 3] },
      steal: 1,
      phases: [
        { verb: 'watch', dur: 1.2, text: 'the line goes slack. all of it, at once.' },
        { verb: 'chase', dur: 9.0, speed: 0.62, gain: 0.34,
          text: 'it is leaving with your bait. hold to close the gap.',
          hint: 'hold to close' },
        { verb: 'choose', text: 'it is going to break left around the rocks.',
          options: [
            { label: 'cut it off', good: 0.72, then: 'hook',
              win: 'you are already there when it gets there.',
              lose: 'it went right. it was never going left.' },
            { label: 'follow it', good: 0.42, then: 'hook',
              win: 'it tires before you do.',
              lose: 'it does not tire.' },
            { label: 'let it go', then: 'escape', win: 'it slows down once it is sure.' }
          ] },
        { verb: 'hook', text: 'it turns and takes the hook out of spite.' },
        { verb: 'land' }
      ],
      onEscape: { text: 'the bait is gone and the hook is not bent.', clue: 'stolen' },
      /* Ten casts is about an evening. It is not far, and it should not be:
         the joke of this one is that it comes back for the same trick and you
         both know it. */
      again: { after: { casts: 10 }, chance: 3.2,
               text: 'the line goes slack in exactly the same way, at the same part of the cast.' } },

    /* ================================================================= THE MIMIC
       Announced as something else. The card the player is looking at is a lie
       and the lie comes apart in front of them. */
    { id: 'mimic', name: 'The Copy', fish: 'thecopy',
      rarity: 'glitch', kind: 'mimic', tier: 3,
      on: { locs: ['flats', 'abyss', 'cradle', 'nowhere'], weather: [], time: [] },
      trigger: 'reel', chance: 0.055, minRank: 4,
      blurb: 'arrives as something you have caught before',
      journal: 'it was a Moonfish for eleven seconds. it was a very good Moonfish. the ' +
               'error is that a Moonfish does not weigh what this weighed, and it did not ' +
               'know that, because it had only ever seen one.',
      reward: { money: 180000, xp: 52000 },
      phases: [
        { verb: 'watch', dur: 2.0, disguise: 1, text: 'it comes up easily. too easily.' },
        { verb: 'reveal', dur: 3.4, text: 'the colour is running.' },
        { verb: 'hook', text: 'and now it fights.' },
        { verb: 'land' }
      ],
      onEscape: { text: 'whatever it was pretending to be, it stopped.' } },

    /* ============================================================== THE PARASITE
       The only one that is not a catch. It goes on the rod and stays there. */
    { id: 'parasite', name: 'The Passenger', fish: 'passenger',
      rarity: 'void', kind: 'parasite', tier: 2,
      on: { locs: ['nowhere', 'beneath', 'abyss'], weather: [], time: [] },
      trigger: 'bite', chance: 0.026,
      blurb: 'does not go in the bag',
      journal: 'it came up on the line and then it was not on the line. it is on the rod, ' +
               'about a third of the way up the blank, and it has not moved since. the ' +
               'catches have been strange ever since as well.',
      reward: { xp: 30000 },
      attach: 'voidtouch',
      phases: [
        { verb: 'watch', dur: 2.2, text: 'something small comes up the line rather than on it.' },
        { verb: 'hold', dur: 6.0, band: [0.34, 0.70], text: 'hold the rod steady. do not shake it off.',
          hint: 'hold inside the band' },
        { verb: 'land', silent: 1 }
      ],
      onEscape: { text: 'it dropped off somewhere between the water and the rod.' } },

    /* ============================================================== THE DEVOURER
       Turns one encounter into a bigger one. The player did not go looking
       for this; it arrived under something they were already reeling. */
    { id: 'devourer', name: 'What Eats Them', fish: 'whateats',
      rarity: 'unknown', kind: 'devourer', tier: 4,
      on: { locs: ['abyss', 'cradle', 'nowhere', 'beneath'], weather: [], time: [] },
      trigger: 'reel', chance: 0.030, minRank: 4,
      blurb: 'arrives underneath whatever you have hooked',
      journal: 'it does not hunt. it waits under the places where things are being pulled ' +
               'upward and lets somebody else do the pulling. i have been fishing for it ' +
               'for eleven years without knowing, and so has everybody else.',
      reward: { money: 900000, xp: 260000, clue: 'devoured' },
      phases: [
        { verb: 'watch', dur: 2.6, shadow: 1,
          text: 'there is a second shape under the first one and it is not a second fish.' },
        { verb: 'choose', text: 'it is directly below your catch.',
          options: [
            { label: 'cut the line', then: 'escape',
              win: 'you keep the rod. you do not keep the fish.' },
            { label: 'hold on', good: 1, then: 'devour',
              win: 'it takes the fish, the hook, and the argument.' },
            { label: 'reel faster', good: 0.30, then: 'devour',
              win: 'not fast enough. nothing is fast enough.',
              lose: 'the fish comes up in one piece. the shape goes back down.' }
          ] },
        { verb: 'watch', dur: 2.2, devour: 1, text: 'the line goes tight in a way a line should not go tight.' },
        { verb: 'hook', text: 'it is on. all of it is on.' },
        { verb: 'land' }
      ],
      onEscape: { text: 'the line came back cut clean by nothing.', clue: 'devoured' },
      /* It waits under things being pulled upward. It does not need to find
         you again; it needs you to go on fishing, which you will. */
      again: { after: { casts: 22 }, chance: 2.8,
               text: 'the second shape is already there. it was there before the first one.' } },

    /* =============================================================== THE WATCHER
       The slowest thing in the game. It is on screen for minutes before it
       does anything, and the player is meant to decide it is scenery. */
    { id: 'watcher', name: 'The Standing Thing', fish: 'standing',
      rarity: 'unknown', kind: 'watcher', tier: 4,
      on: { locs: ['shore', 'basin', 'flats'], weather: [], time: ['sunset', 'night'] },
      trigger: 'lead',
      blurb: 'it has been out there for some time',
      journal: 'eleven evenings of it being a rock. on the twelfth it was a hundred metres ' +
               'closer and still a rock, and on the thirteenth it was not a rock and had ' +
               'never been one, and the eleven evenings were the point.',
      reward: { money: 620000, xp: 180000, clue: 'watched' },
      phases: [
        { verb: 'watch', dur: 6.0, far: 1, text: 'there is something standing off the water. it has probably always been there.' },
        { verb: 'watch', dur: 5.0, far: 0.62, text: 'it is nearer than it was. you did not see it move.' },
        { verb: 'choose', text: 'it is close enough now to be a person, if it were one.',
          options: [
            { label: 'wave', good: 1, then: 'next', win: 'it copies the gesture. badly. one beat late.' },
            { label: 'look away', good: 1, then: 'next', win: 'when you look back it is at the boat.' },
            { label: 'cast at it', good: 1, then: 'next', win: 'the line lands short. it picks the line up.' }
          ] },
        { verb: 'watch', dur: 3.4, far: 0.10, text: 'it acknowledges you.' },
        /* This used to end on a hook and a fight, like everything else, and
           the fight was the worst thing about it. Thirteen evenings of a
           rock getting closer, and then a health bar. It stands there, it
           looks at you, and it is still standing there when you leave. */
        { verb: 'watch', dur: 5.0, far: 0.06, text: 'it does not do anything else. it is not going to.' },
        { verb: 'leave', text: 'you are the one who leaves.' }
      ],
      encounterOnly: 1,
      onEscape: { text: 'it went back to being a rock, at the distance a rock is.', keepLead: 1 } },

    /* ================================================================= THE QUEEN
       The only one with a second layer of things to deal with while you are
       dealing with the first. */
    { id: 'queen', name: 'The Brood Mother', fish: 'broodmother',
      rarity: 'unknown', kind: 'queen', tier: 4,
      on: { locs: ['abyss', 'cradle'], weather: [], time: [] },
      trigger: 'lead',
      blurb: 'everything small in this water belongs to her',
      journal: 'the shoal is not a shoal. every one of them is an extension of one animal ' +
               'that is much further down, in the way a hand is an extension of a person. ' +
               'catching them does nothing. she grows more.',
      reward: { money: 1400000, xp: 420000 },
      phases: [
        { verb: 'watch', dur: 2.8, swarmIn: 1, text: 'the water fills with small ones. all of them face the same way.' },
        { verb: 'swarm', dur: 12.0, count: 9, text: 'clear a path. they are between you and her.',
          hint: 'press each one' },
        { verb: 'watch', dur: 2.6, text: 'the gap closes behind them and something comes up through it.' },
        { verb: 'hook', text: 'she takes the hook herself.' },
        { verb: 'land' }
      ],
      onEscape: { text: 'the small ones close over the gap and go back to facing the same way.',
                  clue: 'swarmlight' } },

    /* ================================================================ THE DOUBLE
       Nowhere Sea only. Not a monster — a navigation problem with a face. */
    { id: 'double', name: 'The Other Boat', fish: 'otherboat',
      rarity: 'glitch', kind: 'watcher', tier: 3,
      on: { locs: ['nowhere'], weather: [], time: [] },
      trigger: 'lead',
      blurb: 'same hull, same lamp, same list to port',
      journal: 'it does what i do about four hundred metres off and about a second and a ' +
               'half late. i have tested this. i have tested it enough times that i would ' +
               'now rather not know what happens if i am the one who is late.',
      reward: { money: 400000, xp: 120000, clue: 'nowhere_double' },
      phases: [
        { verb: 'watch', dur: 4.0, far: 0.8, text: 'there is a boat out there. it has a lamp on the same corner.' },
        { verb: 'choose', text: 'it is doing what you are doing.',
          options: [
            { label: 'cast', good: 1, then: 'next', win: 'it casts. a second and a half late.' },
            { label: 'wait', good: 1, then: 'next', win: 'it waits. it is better at waiting.' },
            { label: 'sail at it', good: 1, then: 'next', win: 'the gap does not close. it is exactly four hundred metres.' }
          ] },
        { verb: 'watch', dur: 3.0, far: 0.24, text: 'both lines go tight at the same moment.' },
        { verb: 'choose', text: 'both lines are still tight.',
          options: [
            { label: 'reel', good: 1, then: 'next', win: 'it reels. whatever is on your line comes up empty and whatever is on its line does not.' },
            { label: 'cut the line', good: 1, then: 'next', win: 'it cuts. you both watch the two ends go down.' }
          ] },
        /* There is no version of this where you land it. It is your boat.
           Hooking it was always the wrong ending — you cannot bring your own
           boat aboard your own boat. It goes back into the fog. */
        { verb: 'leave', text: 'it puts its lamp out. you are alone on the water, which you were.' }
      ],
      encounterOnly: 1,
      onEscape: { text: 'the fog took it, in the direction you were not looking.' } },

    /* ============================================================== THE FOLLOWER
       Voyage-only. It gets on the end of the wake and stays there. */
    { id: 'follower', name: 'The Wake Rider', fish: 'wakerider',
      rarity: 'void', kind: 'follower', tier: 3,
      on: { locs: [], weather: [], time: [] },
      trigger: 'voyage', chance: 0.055,
      blurb: 'gets in behind the boat and matches the speed exactly',
      journal: 'it sits in the disturbed water where the drag is lowest, the way a bird ' +
               'sits behind a ship. it has been doing this for as long as there have been ' +
               'boats, and for a long time before that it must have been doing it to ' +
               'something else.',
      reward: { money: 300000, xp: 96000 },
      phases: [
        { verb: 'watch', dur: 4.0, wake: 0.4, text: 'the wake behind the boat is wider than the boat.' },
        { verb: 'choose', text: 'it matches every course change exactly.',
          options: [
            { label: 'open the throttle', good: 0.35, then: 'escape',
              win: 'it drops away at about forty knots, which is a thing to know.',
              lose: 'it has more than you do.' },
            { label: 'cut the engine', good: 1, then: 'next', win: 'it comes alongside.' },
            { label: 'put a line in it', good: 0.8, then: 'hook', win: 'it takes the line before the line lands.',
              lose: 'it takes the line and about ninety metres of it.' }
          ] },
        { verb: 'watch', dur: 2.6, wake: 1, text: 'it comes up level with the gunwale and stays there.' },
        { verb: 'hook', text: 'and then it leans on the rod.' },
        { verb: 'land' }
      ],
      onEscape: { text: 'the wake goes back to being the width of the boat.' },
      /* Counted in crossings, because that is the only thing it can get in
         behind. Two of them is long enough to have stopped looking astern. */
      again: { after: { voyages: 2 }, chance: 2.6,
               text: 'it is on the wake again. it did not have to catch up.' } }
  ];

  const BY_ID = VF.util.byId(LIST);

  /* Which of them could begin here, now, from this trigger. */
  function eligible(trigger, opts) {
    opts = opts || {};
    const d = VF.state.data;
    const loc = d.location;
    const wx = VF.weather.id();
    const ph = VF.time.phase();
    return LIST.filter(function (c) {
      if (c.trigger !== trigger) return false;
      if (c.on.locs.length && c.on.locs.indexOf(loc) < 0) return false;
      if (c.on.weather.length && c.on.weather.indexOf(wx) < 0) return false;
      if (c.on.time.length && c.on.time.indexOf(ph) < 0) return false;
      if (c.minRank && (opts.rank || 0) < c.minRank) return false;
      /* One of them at a time is enough of a coincidence. Where a creature is
         ALLOWED is all this filter decides; how likely it is given what has
         already happened between it and this boat belongs to
         js/systems/pursuit.js, which the two rolls multiply in. Anything
         already met is rarer afterwards rather than gone — these are
         encounters, not a checklist, and meeting the thief twice is the thief
         being the thief. */
      return true;
    });
  }

  VF.creatureData = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    eligible: eligible,
    /* How many of them the player has actually landed, for the journal. */
    counts: function () {
      const c = VF.state.data.creatures || {};
      let met = 0, caught = 0;
      LIST.forEach(function (x) {
        const r = c[x.id];
        if (!r) return;
        if (r.met) met++;
        if (r.caught) caught++;
      });
      return { met: met, caught: caught, total: LIST.length };
    }
  };
})(window.VF = window.VF || {});
