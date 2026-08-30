/* VOID FISHING — what is out there between two places.

   An event is:
     kind      what family of thing it is. Used to pick the stinger. It is
               NOT shown on the card — a category printed above a sighting
               turns it into a catalogue entry somebody else compiled.
     cls       how notable it is, in js/world/director.js's vocabulary. This is
               what the budget is spent from, and it is why a major encounter
               cannot follow a major encounter.
     weight(c) how likely, given the world right now — the zone's depth, the
               wind, whether there is a sonar aboard. A candidate that does not
               apply returns 0 and is not in the draw at all.
     name      what it is
     sight     what you can see of it from a long way off, before you decide
     text      what you can see once you are up against it
     onCourse  it is in the way rather than off to one side
     options   the answers that are actually different from each other

   An outcome is a function that gets the voyage and does something real:
   opens a lead, damages the hull, hands over a clue, starts an encounter on
   arrival, finds a secret. Nothing here pays out in a currency — the reward
   for investigating a derelict is that you now know something.

   Two things changed and they are the same change.

   Every crossing used to fire between one and three of these. Never zero — the
   roll was `1 + floor(rnd() * 2)`. An ocean where something always happens is
   not an ocean. Nothing here asks for an event any more; js/world/director.js
   is asked, and it usually says no.

   And a quarter of the options here did nothing. Every one of them was the
   same option wearing a different coat: "go round", "let her go", "note it and
   carry on", "log it and go on", "alter course". They printed a sentence and
   changed nothing, which is a choice in the shape of a choice.

   They are gone, and not replaced with better-written versions of themselves,
   because the game already had somewhere to put that decision: you can see the
   thing from a long way off, and you can hold your course. Declining is
   steering, not a button. What is left on a card is only the answers that
   differ once you have already decided to go and look.

   `once` means it never comes back after it has happened, which is how the
   chain events keep their shape. */
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

    { id: 'shoalcross', kind: 'ORDINARY', cls: 'ENVIRONMENT', weight: function (c) { return 26; },
      onCourse: 1,
      name: 'A Shoal, Crossing',
      text: 'Something small and numerous is going the other way, in a band about a hundred ' +
            'metres wide, and it does not part for the hull.',
      options: [
        { label: 'go through it', run: pay(900, 'they part late and close early. the deck is ' +
          'silver for about a minute and then it is not.') }
      ] },

    { id: 'weather', kind: 'WEATHER', cls: 'ENVIRONMENT', weight: function (c) { return 18 + c.wind * 26; },
      onCourse: 1,
      name: 'A Line Of Squalls',
      text: 'A grey wall across the course with light under it. It is not big and it is ' +
            'not going to move out of the way.',
      options: [
        { label: 'drive through', run: hurt(0.12, 'it is over in six minutes and the hull ' +
          'has taken some of it.') },
        { label: 'heave to and wait', run: function (v) { v.slow = 1.5; return 'you sit in it ' +
          'with the engine off and it goes over the top. slower, and nothing broken.'; } }
      ] },

    /* -------------------------------------------------------- the strange */

    { id: 'ghostship', kind: 'DERELICT', cls: 'DISCOVERY', weight: function (c) { return c.depth >= 2 ? 12 : 0; },
      name: 'A Ship, Under Way',
      sight: 'Hull down on the horizon, under way, on a heading that is not anywhere.',
      text: 'Hull down on the horizon and making about four knots on a heading that is not ' +
            'anywhere. There is a light on it. There is nobody on it — you can see the ' +
            'whole deck from here and the whole deck is empty.',
      options: [
        { label: 'follow it', run: lead('nowhere_drift',
          'it holds the heading for two hours and then it is not there, and where it stopped ' +
          'being there is now marked on the chart.') },
        { label: 'board her', run: clue('cradle_plate',
          'the log is dry and the last entry is in a hand you have seen before. one page has ' +
          'a plate wired to it.') }
      ] },

    { id: 'whirlpool', kind: 'ANOMALY', cls: 'DISCOVERY', weight: function (c) { return c.depth >= 3 ? 11 : 0; },
      name: 'A Turning',
      sight: 'The water ahead and to one side has gone completely flat, in a circle.',
      text: 'A hole in the sea about ninety metres across, going down further than the light ' +
            'goes, and the water around it is completely flat.',
      options: [
        { label: 'go in', run: function (v) {
            VF.boat.damage(0.22);
            VF.discovery.clue('beneath_way', true);
            return 'it takes eleven seconds and it is not eleven seconds of falling. at the ' +
                   'bottom there is a way out and it comes up somewhere the chart says is ' +
                   'four hundred kilometres away.';
          } }
      ] },

    { id: 'shadow', kind: 'CONTACT', cls: 'ENCOUNTER', weight: function (c) { return 10 + c.depth * 2; },
      onCourse: 1,
      name: 'Something Underneath',
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
        /* Not the same as holding the course. That one gets followed home;
           this one ends the conversation — it takes what it came for and the
           water closes, and the boat wears the turn. */
        { label: 'put a line in it', run: function (v) {
            VF.boat.damage(0.08);
            return 'it takes the line before the line lands, and the drag runs out to the ' +
                   'knot and stops. whatever was under the keel is not under it any more.';
          } }
      ] },

    { id: 'floating', kind: 'SALVAGE', cls: 'MINOR', weight: function (c) { return 16; },
      name: 'Something Floating',
      sight: 'Something low in the water off the course, catching the light in a way nothing organic does.',
      text: 'Low in the water, half a mile off the course, and catching the light in a way ' +
            'that nothing organic does.',
      options: [
        { label: 'come about for it', run: function () {
            const n = 2600 + Math.floor(VF.rng.g() * 9000);
            VF.economy.earn(n, 'sea');
            if (VF.rng.g() < 0.30) { VF.state.data.caseTokens++; return 'a crate, and a key taped inside the lid.'; }
            return 'a crate. the contents are worth having and the crate is worth more.';
          } }
      ] },

    { id: 'sos', kind: 'SIGNAL', cls: 'DISCOVERY', weight: function (c) { return c.depth >= 2 ? 9 : 0; },
      name: 'Somebody Is Calling',
      sight: 'A voice on a band nothing uses any more, and it is repeating a bearing.',
      text: 'A voice on a band nothing uses any more, repeating four words with a nine second ' +
            'gap. The four words are your own name and a bearing.',
      options: [
        { label: 'answer it', run: clue('watched',
          'the gap goes to four seconds. then to none. then it is saying it at the same time ' +
          'as you are thinking it, and then it stops.') },
        { label: 'run the bearing', run: lead('offshore_shadow',
          'the bearing is a point of open water with nothing on it, and something is standing ' +
          'in it.') }
      ] },

    { id: 'voidstorm', kind: 'VOID', cls: 'ENCOUNTER', weight: function (c) { return c.depth >= 5 ? 8 : 0; },
      onCourse: 1,
      name: 'The Weather Is Wrong',
      text: 'The sky has stopped being a sky and is now a surface, and it is about eleven ' +
            'metres above the mast, and it has a texture.',
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

    { id: 'island', kind: 'LANDFALL', cls: 'MAJOR', weight: function (c) { return c.depth >= 3 ? 7 : 0; },
      name: 'An Island',
      sight: 'A low island about two miles off with a stand of something on it. It is not on the chart.',
      text: 'A low island about two miles off with a stand of something on it. It is not on ' +
            'the chart and the chart is otherwise correct about this whole stretch.',
      once: 1,
      options: [
        { label: 'put in', run: function () {
            if (VF.secrets && !VF.secrets.found('lantern_isle')) {
              VF.secrets.discover('lantern_isle');
              return 'there is a lamp on it and the lamp is lit.';
            }
            VF.economy.earn(18000, 'sea');
            return 'nobody has been here and somebody has left things.';
          } }
      ] },

    { id: 'doublewake', kind: 'ANOMALY', cls: 'MINOR', weight: function (c) { return c.depth >= 4 ? 6 : 0; },
      onCourse: 1,
      name: 'Two Wakes',
      text: 'One astern, where it should be. One ahead, going the same way at the same speed, ' +
            'made by nothing.',
      options: [
        { label: 'match it', run: clue('nowhere_double',
          'you hold the same speed for an hour and the gap does not change by a metre.') },
        { label: 'overtake it', run: function (v) {
            VF.boat.damage(0.10);
            return 'you push the engine and close it, and at about ten metres it is your own ' +
                   'wake, and you have been overtaking yourself.';
          } }
      ] },

    { id: 'unknownmass', kind: 'SONAR', cls: 'DISCOVERY', weight: function (c) { return c.sonar ? 13 : 0; },
      name: 'A Return At Two Thousand Metres',
      sight: 'The set has put a return on the screen the size of a building, at a depth the chart calls the bottom.',
      text: 'The set has put a return on the screen the size of a building at a depth the ' +
            'chart calls the bottom, and the bottom here is eleven hundred metres.',
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
          'you pass directly above it at four knots and the whole crossing goes quiet.') }
      ] },

    { id: 'stillwater', kind: 'CALM', cls: 'MINOR', weight: function (c) { return c.depth >= 2 ? 10 : 0; },
      onCourse: 1,
      name: 'Flat',
      text: 'The sea has stopped. Not calmed — stopped, out to the horizon in every direction, ' +
            'and the boat is sitting on it rather than in it.',
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
  /* What could happen out here at all. `once` events drop out for good after
     they have happened; everything else is scored by its own weight function
     against the world, so a candidate that does not apply is not in the draw
     rather than being filtered out of it afterwards. */
  function pool() {
    const d = VF.state.data;
    const seen = d.seas || {};
    return LIST.filter(function (e) { return !(e.once && seen[e.id]); });
  }

  /* And whether anything happens at all is not this file's decision.

     It used to be: a crossing asked for one to three of these and always got
     them. Now the director is asked, it mostly says no, and the budget it
     spends from is what stops two remarkable things happening in a row. */
  function roll(ctx) {
    const list = pool();
    if (!list.length || !VF.director) return null;
    return VF.director.ask(list, { ctx: ctx });
  }

  VF.seaData = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    pool: pool, roll: roll
  };
})(window.VF = window.VF || {});
