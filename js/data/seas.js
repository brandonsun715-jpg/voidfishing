/* VOID FISHING — what is out there between two places.

   The water between the spots was a fade to black and a location id. With a
   hull that can cross it, it is where most of the strange things in this game
   now happen — and the reason it works is that a crossing is not a random
   number, it is a short scene with a question in it.

   An event is:
     kind      what family of thing it is. Used to pick the stinger. It is
               NOT shown on the card — a category printed above a sighting
               turns it into a catalogue entry somebody else compiled.
     name      what it is
     text      what you can see
     options   two or three answers, each with an outcome

   An outcome is a function that gets the voyage and does something real:
   opens a lead, damages the hull, hands over a clue, starts an encounter on
   arrival, finds a secret. Nothing here pays out in a currency — the reward
   for investigating a derelict is that you now know something.

   `weight` is how often; `test(d)` gates it on the world. `once` means it
   never comes back after it has happened, which is how the chain events keep
   their shape. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Small helpers so an outcome reads as what it does rather than as five
     lines of plumbing. Each returns the line to print. */
  function clue(id, line) {
    return function () { VF.discovery.clue(id, true); return line; };
  }
  function lead(id, line) {
    return function () { VF.discovery.openLead(id); return line; };
  }
  function hurt(k, line) {
    return function (v) { VF.boat.damage(k); return line; };
  }
  function pay(n, line) {
    return function () { VF.economy.earn(n, 'sea'); return line; };
  }
  function meet(id, line) {
    return function (v) { v.onArrive = { creature: id }; return line; };
  }

  const LIST = [

    /* ------------------------------------------------------- the ordinary */

    { id: 'shoalcross', kind: 'ORDINARY', weight: 26, name: 'A Shoal, Crossing',
      text: 'Something small and numerous is going the other way, in a band about a hundred ' +
            'metres wide, and it does not part for the hull.',
      options: [
        { label: 'go through it', run: pay(900, 'they part late and close early. the deck is ' +
          'silver for about a minute and then it is not.') },
        { label: 'go round', run: function () { return 'four minutes lost and nothing gained. ' +
          'the shoal keeps going, which it was going to do anyway.'; } }
      ] },

    { id: 'weather', kind: 'WEATHER', weight: 22, name: 'A Line Of Squalls',
      text: 'A grey wall across the course with light under it. It is not big and it is ' +
            'not going to move out of the way.',
      options: [
        { label: 'drive through', run: hurt(0.12, 'it is over in six minutes and the hull ' +
          'has taken some of it.') },
        { label: 'heave to and wait', run: function (v) { v.slow = 1.5; return 'you sit in it ' +
          'with the engine off and it goes over the top. slower, and nothing broken.'; } }
      ] },

    /* -------------------------------------------------------- the strange */

    { id: 'ghostship', kind: 'DERELICT', weight: 12, name: 'A Ship, Under Way',
      text: 'Hull down on the horizon and making about four knots on a heading that is not ' +
            'anywhere. There is a light on it. There is nobody on it — you can see the ' +
            'whole deck from here and the whole deck is empty.',
      test: function (d) { return VF.locations.index(d.location) >= 2; },
      options: [
        { label: 'follow it', run: lead('nowhere_drift',
          'it holds the heading for two hours and then it is not there, and where it stopped ' +
          'being there is now marked on the chart.') },
        { label: 'board her', run: clue('cradle_plate',
          'the log is dry and the last entry is in a hand you have seen before. one page has ' +
          'a plate wired to it.') },
        { label: 'let her go', run: function () { return 'she passes about four hundred ' +
          'metres off. the light does not turn.'; } }
      ] },

    { id: 'whirlpool', kind: 'ANOMALY', weight: 11, name: 'A Turning',
      text: 'A hole in the sea about ninety metres across, going down further than the light ' +
            'goes, and the water around it is completely flat.',
      test: function (d) { return VF.locations.index(d.location) >= 3; },
      options: [
        { label: 'go round the outside', run: function () { return 'you take the long way and ' +
          'the hull leans the whole time.'; } },
        { label: 'go in', run: function (v) {
            VF.boat.damage(0.22);
            VF.discovery.clue('beneath_way', true);
            return 'it takes eleven seconds and it is not eleven seconds of falling. at the ' +
                   'bottom there is a way out and it comes up somewhere the chart says is ' +
                   'four hundred kilometres away.';
          } }
      ] },

    { id: 'shadow', kind: 'CONTACT', weight: 14, name: 'Something Underneath',
      text: 'It is longer than the boat and it is holding station under the keel at about ' +
            'the same speed. The sounder is not reading a bottom, it is reading a back.',
      options: [
        { label: 'hold the course', run: meet('follower',
          'it stays there for the rest of the crossing. it is still there when you moor.') },
        { label: 'stop the engine', run: function (v) {
            v.slow = 1.3;
            return 'it comes up level with the gunwale, considers the boat, and goes back down ' +
                   'without hurrying. you did not get a good look and you got a very good idea.';
          } },
        { label: 'put a line in it', run: meet('follower', 'it takes the line before the line lands.') }
      ] },

    { id: 'floating', kind: 'SALVAGE', weight: 16, name: 'Something Floating',
      text: 'Low in the water, half a mile off the course, and catching the light in a way ' +
            'that nothing organic does.',
      options: [
        { label: 'come about for it', run: function () {
            const n = 2600 + Math.floor(VF.rng.g() * 9000);
            VF.economy.earn(n, 'sea');
            if (VF.rng.g() < 0.30) { VF.state.data.caseTokens++; return 'a crate, and a key taped inside the lid.'; }
            return 'a crate. the contents are worth having and the crate is worth more.';
          } },
        { label: 'note it and carry on', run: function () { return 'it is behind you inside a ' +
          'minute and it will be somebody else\'s.'; } }
      ] },

    { id: 'sos', kind: 'SIGNAL', weight: 9, name: 'Somebody Is Calling',
      text: 'A voice on a band nothing uses any more, repeating four words with a nine second ' +
            'gap. The four words are your own name and a bearing.',
      test: function (d) { return VF.locations.index(d.location) >= 2; },
      options: [
        { label: 'answer it', run: clue('watched',
          'the gap goes to four seconds. then to none. then it is saying it at the same time ' +
          'as you are thinking it, and then it stops.') },
        { label: 'run the bearing', run: lead('offshore_shadow',
          'the bearing is a point of open water with nothing on it, and something is standing ' +
          'in it.') },
        { label: 'turn the set off', run: function () { return 'you turn it off. it is quieter ' +
          'and the crossing is longer than it was.'; } }
      ] },

    { id: 'voidstorm', kind: 'VOID', weight: 8, name: 'The Weather Is Wrong',
      text: 'The sky has stopped being a sky and is now a surface, and it is about eleven ' +
            'metres above the mast, and it has a texture.',
      test: function (d) { return VF.locations.index(d.location) >= 5; },
      options: [
        { label: 'run out from under it', run: hurt(0.16,
          'you get out from under it in about twenty minutes and something along the way took ' +
          'a strip off the port side.') },
        { label: 'stay in it', run: function (v) {
            v.onArrive = { condition: 'thinplace' };
            VF.discovery.clue('nowhere_double', true);
            return 'you sit under it for an hour. the water underneath goes clear all the way ' +
                   'down and there is a boat on the underside of it doing the same thing.';
          } }
      ] },

    { id: 'island', kind: 'LANDFALL', weight: 7, name: 'An Island',
      text: 'A low island about two miles off with a stand of something on it. It is not on ' +
            'the chart and the chart is otherwise correct about this whole stretch.',
      test: function (d) { return VF.locations.index(d.location) >= 3; },
      once: 1,
      options: [
        { label: 'put in', run: function () {
            if (VF.secrets && !VF.secrets.found('lantern_isle')) {
              VF.secrets.discover('lantern_isle');
              return 'there is a lamp on it and the lamp is lit.';
            }
            VF.economy.earn(18000, 'sea');
            return 'nobody has been here and somebody has left things.';
          } },
        { label: 'log it and go on', run: function () { return 'you put a mark on the chart. ' +
          'it will not be there next time and the mark will.'; } }
      ] },

    { id: 'doublewake', kind: 'ANOMALY', weight: 6, name: 'Two Wakes',
      text: 'One astern, where it should be. One ahead, going the same way at the same speed, ' +
            'made by nothing.',
      test: function (d) { return VF.locations.index(d.location) >= 4; },
      options: [
        { label: 'match it', run: clue('nowhere_double',
          'you hold the same speed for an hour and the gap does not change by a metre.') },
        { label: 'overtake it', run: function (v) {
            VF.boat.damage(0.10);
            return 'you push the engine and close it, and at about ten metres it is your own ' +
                   'wake, and you have been overtaking yourself.';
          } }
      ] },

    { id: 'unknownmass', kind: 'SONAR', weight: 13, name: 'A Return At Two Thousand Metres',
      text: 'The set has put a return on the screen the size of a building at a depth the ' +
            'chart calls the bottom, and the bottom here is eleven hundred metres.',
      test: function (d) { return VF.boat && VF.boat.has('sonar'); },
      options: [
        { label: 'ping it again', run: function (v) {
            if (VF.boat.level('sonar') >= 3) {
              VF.discovery.clue('trench_echo', true);
              return 'the second return is late and it is louder, and the set says the ' +
                     'lateness is a distance and the distance is wrong.';
            }
            return 'the second ping comes back with nothing on it. either it moved, or the ' +
                   'set is not good enough to say that it did not.';
          } },
        { label: 'go over the top of it', run: meet('lurker',
          'you pass directly above it at four knots and the whole crossing goes quiet.') },
        { label: 'alter course', run: function () { return 'you go round it by two miles and ' +
          'it stays exactly two miles away for the whole detour.'; } }
      ] },

    { id: 'stillwater', kind: 'CALM', weight: 10, name: 'Flat',
      text: 'The sea has stopped. Not calmed — stopped, out to the horizon in every direction, ' +
            'and the boat is sitting on it rather than in it.',
      test: function (d) { return VF.locations.index(d.location) >= 2; },
      options: [
        { label: 'wait for it to start again', run: function (v) {
            v.onArrive = { condition: 'stillness' };
            return 'four minutes. then it starts, all at once, everywhere, as though somebody ' +
                   'had been holding it.';
          } },
        { label: 'get off it', run: function (v) { v.slow = 0.8; return 'the engine finds ' +
          'nothing to push against for a moment and then it does.'; } }
      ] }
  ];

  const BY_ID = VF.util.byId(LIST);

  /* What could happen on this crossing. Recent events are damped rather than
     excluded — seeing the same derelict twice in a night is fine, seeing it
     four times in a row is not. */
  function pool() {
    const d = VF.state.data;
    const seen = d.seas || {};
    return LIST.filter(function (e) {
      if (e.once && seen[e.id]) return false;
      if (e.test) { try { return !!e.test(d); } catch (x) { return false; } }
      return true;
    });
  }

  function roll() {
    const d = VF.state.data;
    const seen = d.seas || {};
    const list = pool();
    if (!list.length) return null;
    return VF.rng.weighted(list, function (e) {
      return e.weight / (1 + (seen[e.id] || 0) * 0.55);
    }, VF.rng.g);
  }

  VF.seaData = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    pool: pool, roll: roll
  };
})(window.VF = window.VF || {});
