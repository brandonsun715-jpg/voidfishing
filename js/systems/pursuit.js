/* VOID FISHING — the one that got away is out there having got away.

   js/systems/creature.js runs an encounter beautifully and then forgets it
   ever happened. Every meeting is an independent roll against def.chance, so
   the fortieth time Hookfinger takes your bait is exactly as likely, and
   exactly as scripted, as the first — which makes nine hand-written scenes
   read like nine slot machines. js/data/creatures.js even says what it should
   do instead, in a comment over a filter that does nothing:

       "Anything already met is rarer afterwards rather than gone."

   This is that, plus the half that matters more: a creature that ESCAPED does
   not go back in the pool. It is owed. It cannot turn up again until enough
   has happened, and when it does turn up it is a second meeting rather than a
   repeat of the first — different opening, different odds, and the record
   remembers the shape of the thing from the last time.

   THE DELAY IS IN THE PLAYER'S OWN UNITS, never in seconds — the same rule
   js/world/chains.js is built on, and the same counters. A creature that came
   back ninety seconds later would be a timer wearing a costume: it would go
   off while the game sat behind a menu, and it would tell the player nothing
   about cause. Twelve casts means twelve casts.

   The store is the one d.creatures[id] record that has always been there.
   `escaped` was written and never read; now it is the spine of this. */
(function (VF) {
  'use strict';

  /* How long a thing that got away stays away, when its own def does not say.
     Long enough that the return is not the next cast, short enough that an
     evening's fishing gets you the rematch. */
  const AFTER = { casts: 14 };

  /* What a return match is worth on the roll. It knows the boat now. */
  const RETURN = 2.6;

  /* How fast a creature you have finished with recedes. Not to zero — meeting
     the thief twice is the thief being the thief — but the interesting
     version of that meeting has happened. */
  function faded(n) { return 1 / (1 + n * 0.85); }

  function rec(id) {
    const d = VF.state.data;
    if (!d.creatures || typeof d.creatures !== 'object') d.creatures = {};
    if (!d.creatures[id]) d.creatures[id] = { met: 0, caught: 0, seen: 0, escaped: 0 };
    return d.creatures[id];
  }

  /* The same units js/world/chains.js counts a delayed consequence in. Null
     when that file is not there — and the failure has to be "no delay" rather
     than "never again", because a counter that can never move would take a
     creature out of the game permanently the first time it got away. */
  function counters() {
    return VF.chains ? VF.chains.counters() : null;
  }

  /* Every counter named has to have moved far enough, exactly as
     js/world/chains.js measures a delayed consequence. */
  function moved(after, at, now) {
    for (const k in after) {
      if (((now[k] | 0) - (at[k] | 0)) < (after[k] | 0)) return false;
    }
    return true;
  }

  /* ------------------------------------------------------------ the ledger */

  /* Called at the end of every encounter. An escape opens the debt and stamps
     the moment in player-units; landing it — or watching it leave on its own
     terms, which is how the two encounterOnly ones end — closes it. */
  function note(def, won, verb) {
    if (!def) return;
    const r = rec(def.id);
    if (won) { delete r.gone; delete r.goneAt; return; }
    r.gone = verb || 'watch';
    r.goneAt = counters() || {};
    r.again = r.again | 0;
  }

  /* It got away and has not been met since. */
  function owed(def) {
    return !!def && !!rec(def.id).gone;
  }

  /* Owed, and enough has happened since. */
  function due(def) {
    if (!owed(def)) return false;
    const now = counters();
    if (!now) return true;
    const r = rec(def.id);
    const after = (def.again && def.again.after) || AFTER;
    return moved(after, r.goneAt || {}, now);
  }

  /* What is left before it can come back, for the tools and the debug
     overlay. Null when nothing is owed. */
  function left(def) {
    if (!owed(def)) return null;
    const r = rec(def.id);
    const after = (def.again && def.again.after) || AFTER;
    const now = counters() || {}, at = r.goneAt || {}, out = {};
    for (const k in after) out[k] = Math.max(0, (after[k] | 0) - ((now[k] | 0) - (at[k] | 0)));
    return out;
  }

  /* ------------------------------------------------------------- the roll */

  /* The multiplier js/systems/creature.js puts on def.chance. Three answers
     and each of them is the whole point of the file:

       0    it is owed and not yet due — it is not in the water, and no amount
            of casting will produce it until the thing that brings it back has
            happened;
       high it is owed and due — the rematch is not a coincidence, it is the
            consequence, so it should land soon rather than eventually;
       low  it is finished with — met, landed, receding. */
  function weight(def) {
    if (!def) return 1;
    const r = rec(def.id);
    if (r.gone) return due(def) ? ((def.again && def.again.chance) || RETURN) : 0;
    const done = (r.caught | 0) + (r.seen | 0);
    return done ? faded(done) : 1;
  }

  /* ------------------------------------------------------- the second time */

  /* Which script runs. A return match may have its own phases; failing that
     it gets the original list with a new opening line, so every creature has
     a second meeting that reads as one whether or not somebody wrote it a
     second scene. The list is never mutated — js/data/creatures.js is data. */
  function phasesFor(def) {
    if (!def) return [];
    if (!owed(def)) return def.phases;
    const ag = def.again || {};
    if (ag.phases) return ag.phases;
    const line = ag.text || backAgain(def);
    const out = def.phases.slice();
    if (out.length) {
      const first = {};
      for (const k in out[0]) first[k] = out[0][k];
      first.text = line;
      out[0] = first;
    }
    return out;
  }

  /* When nobody wrote the creature a second opening. Built from what it was
     doing when it left, because that is the one thing the player will
     remember about the last time. */
  function backAgain(def) {
    const verb = rec(def.id).gone;
    switch (verb) {
      case 'track':  return 'it is not hiding this time. it is waiting to see whether you look.';
      case 'chase':  return 'it does not run at first. it lets the line go tight and then it goes.';
      case 'hold':   return 'the pull arrives before the line does. it knows the weight of you.';
      case 'swarm':  return 'the small ones are already between you and it.';
      case 'choose': return 'the same question, from something that heard your answer.';
      case 'hook':   return 'it takes the hook the way something does that has been off one before.';
      default:       return 'it is back, and it is closer than it was.';
    }
  }

  /* Recorded on the return so a third meeting knows there was a second. */
  function returned(def) {
    if (!def) return false;
    const r = rec(def.id);
    if (!r.gone) return false;
    r.again = (r.again | 0) + 1;
    delete r.gone; delete r.goneAt;
    return true;
  }

  function times(id) { return rec(id).again | 0; }

  VF.pursuit = {
    AFTER: AFTER,
    note: note, owed: owed, due: due, left: left,
    weight: weight, phasesFor: phasesFor, returned: returned, times: times
  };
})(window.VF = window.VF || {});
