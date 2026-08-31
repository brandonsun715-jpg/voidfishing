/* VOID FISHING — things that come back later.

   A consequence the player sees in the same breath as the choice is not a
   consequence, it is a result. This is the machinery for the other kind: you
   did something, the game said nothing, and three crossings later the water
   has changed and nobody explains why.

   A chain is three parts:

     when(ctx)   the condition that ARMS it. Checked until it is true once.
     after       how much has to happen in between — voyages, casts, trips,
                 visits. Counted in things the player DID, never in seconds.
     then(ctx)   what the world is like afterwards.

   THE RULE ABOUT `then`. It may set a fact, arm a rumour, mark a piece of
   history, or write one journal line. It may NOT open a panel, raise a toast,
   start a quest or interrupt anything. The moment a delayed consequence
   announces itself it becomes a notification with a timer on it, which is the
   exact thing this is here instead of. tools/chains.js asserts it.

   And the delay is measured in the player's own units. A chain that fired
   after ninety seconds would be a timer wearing a costume: it would go off
   while the game sat on a title screen, and it would tell the player nothing
   about cause. Three crossings means three crossings. */
(function (VF) {
  'use strict';

  let busy = false;

  function rec() {
    const d = VF.state.data;
    if (!d.world || typeof d.world !== 'object') d.world = {};
    if (!d.world.chains || typeof d.world.chains !== 'object') d.world.chains = {};
    const c = d.world.chains;
    if (!c.armed || typeof c.armed !== 'object') c.armed = {};
    if (!c.fired || typeof c.fired !== 'object') c.fired = {};
    if (!c.facts || typeof c.facts !== 'object') c.facts = {};
    if (typeof c.visits !== 'number') c.visits = 0;
    return c;
  }

  /* --------------------------------------------------------------- facts

     The world's memory of itself, as opposed to js/world/history.js which is
     its memory of the player. Read by the landmark builder, by NPC reactions
     and by repair pricing; written only from a chain's `then`. */
  function fact(id) { return rec().facts[id]; }
  function setFact(id, v) {
    const f = rec().facts;
    const was = f[id];
    f[id] = (v === undefined) ? 1 : v;
    if (was !== f[id]) VF.bus.emit('fact:changed', { id: id, was: was, now: f[id] });
    return f[id];
  }
  function clearFact(id) {
    const f = rec().facts;
    if (f[id] === undefined) return false;
    delete f[id];
    VF.bus.emit('fact:changed', { id: id, now: undefined });
    return true;
  }

  /* ------------------------------------------------------------ counting */

  function counters() {
    const d = VF.state.data;
    return {
      voyages: d.voyages | 0,
      casts: (d.stats && d.stats.casts) | 0,
      trips: VF.history ? VF.history.trips() : 0,
      visits: rec().visits | 0
    };
  }

  /* Every counter named in `after` has to have moved far enough. An empty
     `after` is legal and means "next beat", which is how a chain that only
     wants to be conditional rather than delayed is written. */
  function due(after, at, now) {
    if (!after) return true;
    for (const k in after) {
      const need = after[k] | 0;
      const moved = (now[k] | 0) - (at[k] | 0);
      if (moved < need) return false;
    }
    return true;
  }

  function context() {
    const d = VF.state.data;
    return {
      d: d,
      h: VF.history,
      r: VF.rumours,
      fact: fact, setFact: setFact, clearFact: clearFact,
      zone: d.location,
      level: d.level | 0,
      hull: VF.boat && VF.boat.afloat() ? VF.boat.integrity() : 1,
      counts: counters()
    };
  }

  /* --------------------------------------------------------------- the beat

     Event-driven rather than ticked, because every counter it watches only
     moves on an event. Re-entrant calls are swallowed: a `then` that arms a
     rumour emits, and the emit lands back here. */
  function check() {
    if (busy || !VF.chainData) return false;
    busy = true;
    let any = false;
    try {
      const S = rec();
      const c = counters();
      const ctx = context();
      const list = VF.chainData.list;
      for (let i = 0; i < list.length; i++) {
        const def = list[i];
        if (S.fired[def.id]) continue;
        if (!S.armed[def.id]) {
          let ok = false;
          try { ok = !!def.when(ctx); } catch (e) { ok = false; }
          if (!ok) continue;
          S.armed[def.id] = { at: c, when: Date.now() };
          VF.bus.emit('chain:armed', def);
          any = true;
        }
        if (!due(def.after, S.armed[def.id].at, c)) continue;
        S.fired[def.id] = Date.now();
        try { def.then(ctx); }
        catch (e) { console.error('[chain] ' + def.id, e); }
        VF.bus.emit('chain:fired', def);
        any = true;
      }
    } finally { busy = false; }
    if (any && VF.save) VF.save.save();
    return any;
  }

  /* ---------------------------------------------------------------- state */

  function armed(id) { return !!rec().armed[id]; }
  function fired(id) { return !!rec().fired[id]; }
  /* How much further this chain has to go, for the tools and the debug
     overlay. Null when it is not armed or is already spent. */
  function pending(id) {
    const S = rec();
    if (!S.armed[id] || S.fired[id]) return null;
    const def = VF.chainData.get(id);
    if (!def || !def.after) return { };
    const now = counters(), at = S.armed[id].at, left = {};
    for (const k in def.after) left[k] = Math.max(0, (def.after[k] | 0) - ((now[k] | 0) - (at[k] | 0)));
    return left;
  }

  function reset() {
    const d = VF.state.data;
    if (d.world) delete d.world.chains;
  }

  function bindWorld() {
    const B = VF.bus;
    /* Everything that can move a counter or satisfy a condition. Note what is
       NOT here: no timer, and nothing that fires on its own. */
    ['voyage:end', 'location:changed', 'fishing:landed', 'fishing:cast',
     'boat:damaged', 'rumour:settled', 'rumour:heard', 'history:first',
     'secret:found', 'clue:found'].forEach(function (ev) {
      B.on(ev, function () { check(); });
    });
    /* A conversation is a unit of delay in its own right — "the next time you
       see anybody" is a real and useful remove. */
    B.on('visit:end', function () { rec().visits++; check(); });
  }

  VF.chains = {
    check: check, fact: fact, setFact: setFact, clearFact: clearFact,
    armed: armed, fired: fired, pending: pending,
    counters: counters, context: context, reset: reset,
    count: function () {
      const S = rec();
      return { armed: Object.keys(S.armed).length, fired: Object.keys(S.fired).length,
               facts: Object.keys(S.facts).length };
    }
  };

  bindWorld();
})(window.VF = window.VF || {});
