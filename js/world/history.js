/* VOID FISHING — what this particular player has actually done.

   Not statistics. `d.stats` already counts casts and catches and is the right
   place for a number that only ever goes up. This is the other thing: the
   handful of moments that were the FIRST of their kind, with enough around
   them to be quoted back.

   Two verbs, and the difference between them matters:

     mark(id)     the first time only. Nothing overwrites it, ever.
     tally(id)    every time, keeping a count and the most recent one.

   And one reading verb that is the whole reason the file exists:

     since(id)    how many trips ago, or Infinity if it never happened

   `since` is what lets somebody say "you have not been out since that" without
   the game having to store a sentence about it. A trip is a change of water —
   it ticks on location:changed — because that is the unit the player actually
   experiences the game in, and a delayed consequence measured in wall-clock
   seconds is a timer wearing a costume.

   Nothing here announces anything. No toast, no journal entry, no marker. It
   is a substrate: js/world/chains.js waits on it and js/world/react.js reads
   it, and the player only ever meets it through somebody's mouth. */
(function (VF) {
  'use strict';

  const U = VF.util;

  function rec() {
    const d = VF.state.data;
    if (!d.world || typeof d.world !== 'object') d.world = {};
    if (!d.world.history || typeof d.world.history !== 'object') {
      d.world.history = { at: {}, n: 0, trips: 0 };
    }
    const h = d.world.history;
    if (!h.at || typeof h.at !== 'object') h.at = {};
    if (typeof h.n !== 'number') h.n = 0;
    if (typeof h.trips !== 'number') h.trips = 0;
    return h;
  }

  /* Where the player was standing when it happened. Kept small on purpose —
     this is context for a line of dialogue, not a save file of its own. */
  function stamp() {
    const d = VF.state.data;
    return {
      when: Date.now(),
      trip: rec().trips,
      zone: d.location,
      level: d.level | 0,
      hull: VF.boat && VF.boat.afloat() ? Math.round(VF.boat.integrity() * 100) : -1
    };
  }

  /* ------------------------------------------------------------- writing */

  /* The first time, and only the first time. Returns true if this call was it,
     which is how a caller can do something extra on the first without having
     to ask twice. */
  function mark(id, meta) {
    const h = rec();
    if (h.at[id]) return false;
    h.at[id] = Object.assign(stamp(), { n: ++h.n, count: 1 }, meta || null);
    VF.bus.emit('history:first', { id: id, rec: h.at[id] });
    return true;
  }

  /* Every time. The first call also marks it, so `has` and `since` work on a
     tallied id exactly as they do on a marked one — `last` is the difference. */
  function tally(id, meta) {
    const h = rec();
    if (!h.at[id]) {
      mark(id, meta);
      return true;
    }
    const r = h.at[id];
    r.count = (r.count | 0) + 1;
    r.last = stamp();
    if (meta) Object.assign(r.last, meta);
    return false;
  }

  /* A high-water or low-water mark: kept only when it beats what is there.
     `dir` is 1 for "bigger is worse" and -1 for "smaller is worse". */
  function extreme(id, value, dir) {
    const h = rec();
    const r = h.at[id];
    if (!r) { mark(id, { value: value }); return true; }
    const beat = (dir < 0) ? (value < r.value) : (value > r.value);
    if (!beat) return false;
    r.value = value;
    r.last = stamp();
    return true;
  }

  /* --------------------------------------------------------- reading it */

  function get(id) { return rec().at[id] || null; }
  function has(id) { return !!rec().at[id]; }
  function count(id) { const r = get(id); return r ? (r.count | 0) : 0; }
  function value(id, dflt) { const r = get(id); return r && r.value !== undefined ? r.value : dflt; }

  /* Trips since it first happened. Infinity reads correctly in every
     comparison a condition wants to make — `since('x') > 3` is false for
     something that never happened only if you write it the other way round,
     so `has` is there for that and this is only ever "how long ago". */
  function since(id) {
    const r = get(id);
    if (!r) return Infinity;
    const at = (r.last && r.last.trip !== undefined) ? r.last.trip : r.trip;
    return Math.max(0, rec().trips - (at | 0));
  }

  function trips() { return rec().trips; }

  /* Newest first. Used by the port's desk and by nothing else yet. */
  function recent(n) {
    const h = rec();
    return Object.keys(h.at)
      .map(function (id) { return Object.assign({ id: id }, h.at[id]); })
      .sort(function (a, b) { return (b.n | 0) - (a.n | 0); })
      .slice(0, n || 8);
  }

  /* --------------------------------------------------- what gets recorded

     One place, so the list of what this game considers a moment is readable
     in one screen rather than scattered through the systems that emit it. */
  function bindWorld() {
    const B = VF.bus;

    B.on('location:changed', function () {
      rec().trips++;
      /* Whether you came home in one piece is a fact about the trip that just
         ended, and it is the one the mechanic cares about. */
      if (VF.boat && VF.boat.afloat() && VF.boat.integrity() < 0.6) {
        tally('came_back_damaged');
      }
    });

    B.on('voyage:start', function () { mark('first_voyage'); });
    B.on('voyage:passed', function (def) {
      if (def && def.kind === 'SIGNAL') tally('passed_signal', { where: def.id });
    });

    B.on('fishing:landed', function (c) {
      if (!c) return;
      const f = VF.fishing && VF.fishing.S ? VF.fishing.S.lastFight : null;
      if (f && f.perfect) mark('first_perfect', { fish: c.id });
      const rank = c.rarity ? VF.rarities.rank(c.rarity) : 0;
      if (rank >= 5) mark('first_rare', { fish: c.id, rarity: c.rarity });
      if (rank >= 6) tally('void_catch', { fish: c.id });
      if (VF.time && VF.time.phase && VF.time.phase() === 'night') mark('first_night');
    });

    B.on('creature:first', function (def) { mark('first_void', { creature: def && def.id }); });
    B.on('creature:end', function (e) {
      if (e && e.id) tally(e.won ? 'creature_won' : 'creature_lost', { creature: e.id });
    });

    B.on('boat:damaged', function (e) {
      mark('first_hull_damage');
      if (e && typeof e.wear === 'number') extreme('worst_hull', 1 - e.wear, -1);
    });

    B.on('secret:found', function (s) { mark('first_secret', { secret: s && s.id }); });
    B.on('discovery:found', function () { mark('first_place'); });
    B.on('rumour:settled', function (r) { tally('rumour_settled', { topic: r && r.topic }); });
    B.on('landmark:seen', function (l) { if (l && l.rank === 'secret') tally('found_secret_landmark'); });
  }

  function reset() {
    const d = VF.state.data;
    if (d.world) delete d.world.history;
  }

  VF.history = {
    mark: mark, tally: tally, extreme: extreme,
    get: get, has: has, count: count, value: value,
    since: since, trips: trips, recent: recent, reset: reset
  };

  bindWorld();
})(window.VF = window.VF || {});
