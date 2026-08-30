/* VOID FISHING — what people say.

   A clue in js/data/discoveries.js is always true. Something happened, you saw
   it, it goes in the journal, and it opens a lead. That is the right shape for
   evidence and the wrong shape for everything else, because it means the only
   way this game can tell you anything is by having already proved it to you.

   A rumour is the other half. Somebody told you. They may be right.

     truth: 'true'         it is exactly so
            'partial'      the shape of it is right and a detail is wrong
            'outdated'     it was true. it is not any more
            'exaggerated'  something happened and it was smaller than this
            'false'        no

   The player is never shown which. There is no reliability bar and no little
   icon, because a rumour you can see through is not a rumour — the only way
   to find out is to go and look, and that is the entire mechanic.

   TOPICS are how two people disagree. Rumours on the same topic make a claim
   about the same thing, and the `claim` field is what they actually assert.
   Hearing two that disagree is the interesting state: the game does not
   resolve it, mark it, or put a quest in the journal. It just means you have
   been told two things.

   `settle` is what proves it, and it is always something the player DOES,
   never something they are told. When it fires, the world knows which of them
   was right — and so, from what they saw, does the player.

   Nothing in here says QUEST ACCEPTED. A rumour that pays off hands over a
   clue, and the clue machinery that already exists takes it from there. */
(function (VF) {
  'use strict';

  const LIST = [

    /* ================================================== the eastern markers

       The opening thread, and the one that teaches the system: two people who
       both saw something, neither of whom is lying, and a number that does not
       match. The fisherman is out of date rather than wrong. */

    { id: 'markers_three', topic: 'markers', claim: 3, truth: 'outdated',
      from: ['fisherman'],
      line: 'three boats went out past the eastern markers and none of them came back.',
      needs: function (c) { return c.level >= 4; } },

    { id: 'markers_four', topic: 'markers', claim: 4, truth: 'true',
      from: ['keeper', 'mechanic'],
      line: 'four. he always says three. he does not count the one that was his.',
      needs: function (c) { return c.heard('markers_three'); },
      opens: 'offshore_shadow',
      settle: {
        when: function (d) { return VF.discovery.has('bottle_shore'); },
        text: 'the note in the bottle counts eleven evenings and does not mention a boat at ' +
              'all. whoever wrote it was not counting boats.'
      } },

    /* ==================================================== what is in the deep

       An exaggeration and a truth about the same animal. The drifter's version
       is the one people repeat; the archivist's is the one that is useful. */

    { id: 'deep_size', topic: 'thedeep', claim: 'enormous', truth: 'exaggerated',
      from: ['drifter'],
      line: 'the thing under the trench is longer than the harbour wall. i have seen the ' +
            'sounder go flat with it.',
      needs: function (c) { return c.depth >= 2; } },

    { id: 'deep_patient', topic: 'thedeep', claim: 'patient', truth: 'true',
      from: ['archivist'],
      line: 'size is the least interesting thing about it. it waits. that is the part ' +
            'nobody repeats because it is not frightening enough.',
      needs: function (c) { return c.heard('deep_size'); },
      opens: 'trench_contact',
      settle: {
        when: function (d) { return VF.discovery.has('trench_echo'); },
        text: 'the second return was late, and the lateness was a distance, and the distance ' +
              'was wrong. it had not moved. it had waited.'
      } },

    /* ==================================================== the light offshore

       Flatly false, and the only way to know is to go out there on a clear
       night and find nothing. The child is not lying — the child believes it. */

    { id: 'light_wreck', topic: 'offshore_light', claim: 'a wreck', truth: 'false',
      from: ['child'],
      line: 'the light out past the point is a boat that sank with its lamp still on. ' +
            'my brother says it burns underwater.',
      needs: function (c) { return c.level >= 6; },
      settle: {
        when: function (d) { return VF.locations.index(d.location) >= 1 && (d.stats.casts | 0) > 40; },
        text: 'there is no wreck out past the point. there is a light, and it is not ' +
              'underneath anything.'
      } },

    { id: 'light_standing', topic: 'offshore_light', claim: 'standing', truth: 'true',
      from: ['fisherman'],
      line: 'it is not a wreck and it is not a boat. it stands there. i have stopped ' +
            'looking at it.',
      needs: function (c) { return c.heard('light_wreck'); },
      opens: 'offshore_shadow' },

    /* ======================================================== the chart itself

       The cartographer is precise and the drifter is not, and on this one the
       imprecise account is closer. */

    { id: 'chart_complete', topic: 'chart', claim: 'complete', truth: 'partial',
      from: ['cartographer'],
      line: 'the chart is finished. every sounding on it was taken twice. there is ' +
            'nothing out there that is not on it.',
      needs: function (c) { return c.depth >= 3; } },

    { id: 'chart_missing', topic: 'chart', claim: 'incomplete', truth: 'true',
      from: ['drifter', 'keeper'],
      line: 'she has a chart with nine places on it and she has been to six.',
      needs: function (c) { return c.heard('chart_complete'); },
      settle: {
        when: function (d) { return Object.keys(d.secrets || {}).length >= 1; },
        text: 'the place you put in at is not on her chart, and it has been there longer ' +
              'than the chart has.'
      } },

    /* ==================================================== the quiet water

       Nobody disagrees about this one. It is here because not every rumour
       needs to be a mystery, and a piece of ordinary true fishing advice makes
       the strange ones sound stranger. */

    { id: 'quiet_bite', topic: 'quietwater', claim: 'still', truth: 'true',
      from: ['fisherman', 'mechanic'],
      line: 'when it goes flat like that, put it further out. everything comes up ' +
            'and nothing is near the bank.',
      needs: function (c) { return c.level >= 3; } },

    /* ================================================= what the player has done

       Spawned rather than authored: the world starts saying things about you.
       These are not in the pool until js/world/rumours.js puts them there. */

    { id: 'you_east', topic: 'you', claim: 'east', truth: 'true', spawned: 1,
      from: ['keeper', 'mechanic', 'child'],
      line: 'you have been out east. no, nobody said. your boots.' },

    { id: 'you_caught', topic: 'you', claim: 'caught', truth: 'exaggerated', spawned: 1,
      from: ['child', 'collector'],
      line: 'they are saying it was twice the length of the boat. it was not, was it.' },

    { id: 'you_ignored', topic: 'you', claim: 'ignored', truth: 'true', spawned: 1,
      from: ['fisherman', 'keeper'],
      line: 'somebody was calling out there a while back. they stopped.' },

    /* ===================================================== the boat that went

       Spawned by the chain in js/data/chains.js, three crossings after the
       player sailed past a signal and kept going. Two accounts, and the one
       that is false is the comfortable one — which is the point. It settles
       by going to the trench and seeing the hull, not by being told a third
       time and not by waiting. */

    { id: 'wreck_went', topic: 'thewreck', claim: 'went down', truth: 'true', spawned: 1,
      from: ['fisherman'],
      line: 'a boat was calling on the crossing a while back and then it was not. ' +
            'she is on the shelf above the trench now, if you want to go and look at her.',
      settle: {
        when: function () {
          return VF.landmarks && VF.landmarks.seenAnywhere('consequence:wreck_at_signal');
        },
        text: 'she is there. bow into the seam, on the shelf, exactly where he said. ' +
              'nobody has been down to her.'
      } },

    { id: 'wreck_nothing', topic: 'thewreck', claim: 'nothing', truth: 'false', spawned: 1,
      from: ['keeper', 'collector'],
      line: 'he tells that one to everybody. there is no boat out there. there has never ' +
            'been a boat out there.',
      needs: function (c) { return c.heard('wreck_went'); } }
  ];

  const BY_ID = VF.util.byId(LIST);

  function byTopic(topic) {
    return LIST.filter(function (r) { return r.topic === topic; });
  }

  VF.rumourData = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    byTopic: byTopic,
    topics: function () {
      const seen = {};
      LIST.forEach(function (r) { seen[r.topic] = 1; });
      return Object.keys(seen);
    }
  };
})(window.VF = window.VF || {});
