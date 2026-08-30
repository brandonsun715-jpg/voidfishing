/* VOID FISHING — the delayed consequences.

   Three of them, and three is deliberate. A world where everything comes back
   is a world where nothing lands: the player learns that every action has a
   sequel and stops reading any of them. These are the ones worth waiting for.

   Read js/world/chains.js for the rules. The short version: `when` arms it,
   `after` is a distance measured in things the player did, and `then` changes
   what the world is like without ever saying so.

   Note what none of these do. No toast. No journal popup. No quest. No marker
   on the chart. Two of them write a single line into the journal, which is a
   book the player opens on purpose, and the third writes nothing at all — the
   only way to find out about it is to talk to somebody or go and look. */
(function (VF) {
  'use strict';

  const LIST = [

    /* ================================================== the boat that called

       The single best thing the event director can offer, because the cost of
       ignoring it is invisible at the time and total afterwards. You were
       crossing, something was calling, you kept going. The game said nothing —
       no penalty, no reproach, no "are you sure".

       Three crossings later there is a hull on the shelf above the trench that
       was not there before, and a man on the shore who will tell you about it
       if you ask him twice. The keeper says he makes it up. One of them is
       wrong and the water settles it. */

    { id: 'signal_ignored',
      when: function (c) { return c.h.count('passed_signal') >= 1; },
      after: { voyages: 3 },
      then: function (c) {
        c.setFact('wreck_at_signal', 1);
        if (c.r) { c.r.arm('wreck_went'); c.r.arm('wreck_nothing'); }
        /* One line, in a book. Not a notification. */
        if (VF.journal) {
          VF.journal.addFree('chain:signal',
            'the crossing',
            'there was something calling on the water and i put the engine up. it has been ' +
            'three crossings and i have not heard it again.',
            'note', 0);
        }
      } },

    /* ================================================== bringing it back bad

       Twice is a pattern and the mechanic is the person who notices patterns
       in hulls. He does not lecture and he does not charge for the second one.
       The player is never told the repair was free until the bill is not
       there, which is the only way a gesture like that reads as a gesture
       rather than as a reward. */

    { id: 'hull_neglect',
      when: function (c) { return c.h.count('came_back_damaged') >= 2; },
      after: { trips: 1 },
      then: function (c) {
        c.setFact('mechanic_worried', 1);
        c.setFact('repair_owed', 1);
      } },

    /* ================================================ finding out he was wrong

       The drifter's version of what is in the trench is the one everybody
       repeats and it is an exaggeration. When the player settles that topic by
       going and looking, the drifter does not get a cutscene about it — the
       next time they happen to talk, he has changed the subject slightly, in
       the way people do. */

    { id: 'deep_corrected',
      when: function (c) {
        if (!c.r) return false;
        return c.r.onTopic('thedeep').some(function (r) { return r.settled; });
      },
      after: { visits: 1 },
      then: function (c) { c.setFact('deep_corrected', 1); } }
  ];

  const BY_ID = VF.util.byId(LIST);

  VF.chainData = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; }
  };
})(window.VF = window.VF || {});
