/* VOID FISHING — the record, as a book of findings.

   d.fishdex was a checklist: an entry existed or it did not, and the whole
   index was a percentage. That is a list of what the GAME contains, and the
   player is only ever told how much of it they have not got. It also threw
   away the most interesting thing that happens while fishing, which is that
   you keep meeting something you cannot land.

   So knowledge is partial and it is earned in stages:

     glimpsed   something took an interest and was gone before you set the hook
     hooked     it took the hook and it got away
     landed     you brought one in
     known      you have brought in enough of them to know their habits

   Each stage says more. A glimpse is a shape and a count. A hooking adds what
   it felt like — the weight it pulled at. Landing gives you the animal, its
   name and its measure. Only landing them repeatedly gives you the thing an
   angler actually wants, which is where and when and on what.

   None of this is a new store. It is the same d.fishdex entry with the counts
   it should always have kept, and old saves grow them on first read: a species
   caught three times has plainly also been hooked and seen, so it is credited
   with both. The migration only ever runs forward. */
(function (VF) {
  'use strict';

  /* How many landings before a species stops being a specimen and starts being
     something you know. Five is enough for the tallies underneath to mean
     something and few enough to reach on a species you like. */
  const KNOWN = 5;

  const RANK = { unknown: 0, glimpsed: 1, hooked: 2, landed: 3, known: 4 };

  function dex() { return VF.state.data.fishdex; }

  /* Bring an entry up to the current shape. Called on every read, so a save
     written before any of this existed grows into it the first time it is
     looked at rather than needing a migration pass at load. */
  function norm(e) {
    if (!e) return e;
    if (e.caught === undefined) e.caught = 0;
    if (!e.mutations) e.mutations = {};
    if (!e.traits) e.traits = {};
    /* Landing one means having hooked it and seen it, whatever the old save
       happened to record. Never the other way round. */
    if (e.seen === undefined || e.seen < e.caught) e.seen = Math.max(e.seen | 0, e.caught | 0);
    if (e.hooked === undefined || e.hooked < e.caught) e.hooked = Math.max(e.hooked | 0, e.caught | 0);
    if (!e.where) e.where = {};
    if (!e.when) e.when = {};
    if (!e.weather) e.weather = {};
    if (!e.bait) e.bait = {};
    return e;
  }

  function entry(id) { return norm(dex()[id]); }

  function ensure(id) {
    const d = dex();
    if (!d[id]) {
      d[id] = { caught: 0, record: null, firstSeen: Date.now(), mutations: {}, traits: {},
                seen: 0, hooked: 0, where: {}, when: {}, weather: {}, bait: {} };
    }
    return norm(d[id]);
  }

  function state(id) {
    const e = entry(id);
    if (!e) return 'unknown';
    if (e.caught >= KNOWN) return 'known';
    if (e.caught > 0) return 'landed';
    if (e.hooked > 0) return 'hooked';
    if (e.seen > 0) return 'glimpsed';
    return 'unknown';
  }

  function rank(id) { return RANK[state(id)]; }

  /* What the book is allowed to show at this stage. Asked rather than worked
     out at each call site, so the rule lives in one place and the UI cannot
     drift from it. */
  function knows(id, what) {
    const r = rank(id);
    switch (what) {
      case 'shape':  return r >= 1;   // a silhouette
      case 'weight': return r >= 2;   // what it pulled like
      case 'name':   return r >= 3;
      case 'art':    return r >= 3;
      case 'habits': return r >= 4;
      default: return false;
    }
  }

  /* --------------------------------------------------------------- events */

  /* It brushed the bait and was gone.

     `how` is what kind of sighting it was: nothing, for the ordinary one at
     the end of a line, or 'met' for the handful that are encountered rather
     than fished for — js/systems/creature.js credits a sighting when one of
     those gets away, and two of them can never be landed at all, so the book
     must not describe them as having taken a bait they were never offered. */
  function glimpse(id, how) {
    if (!id || !VF.fish.byId(id)) return;
    const e = ensure(id);
    e.seen++;
    if (how) e.how = how;
    VF.bus.emit('record:changed', { id: id, how: 'glimpsed' });
  }

  /* It took the hook and got off. The weight is worth keeping even though the
     fish is not — it is the whole of what you learned. */
  function hooked(c) {
    if (!c || !c.id || !VF.fish.byId(c.id)) return;
    const e = ensure(c.id);
    e.hooked++;
    if (c.kg && (!e.felt || c.kg > e.felt)) e.felt = c.kg;
    VF.bus.emit('record:changed', { id: c.id, how: 'hooked' });
  }

  /* Landed. The counts and the record itself stay in js/systems/fishing.js,
     which has always owned them; this is the half it never kept — where, when,
     and what with, which is what turns a tally into a habit. */
  function landed(c) {
    if (!c || !c.id) return;
    const e = ensure(c.id);
    if (c.location) e.where[c.location] = (e.where[c.location] | 0) + 1;
    if (c.time !== undefined && c.time !== null) e.when[c.time] = (e.when[c.time] | 0) + 1;
    if (c.weather) e.weather[c.weather] = (e.weather[c.weather] | 0) + 1;
    if (c.bait) e.bait[c.bait] = (e.bait[c.bait] | 0) + 1;
  }

  /* ------------------------------------------------------------- readings */

  function top(map) {
    let best = null, n = 0, total = 0;
    for (const k in map) { total += map[k]; if (map[k] > n) { n = map[k]; best = k; } }
    return best === null ? null : { key: best, n: n, of: total };
  }

  /* What you have found out, once you have found out enough to say. Null
     before that — an answer drawn from two catches is a guess with a number
     on it, which is worse than saying nothing. */
  function habits(id) {
    if (!knows(id, 'habits')) return null;
    const e = entry(id);
    if (!e) return null;
    return { where: top(e.where), when: top(e.when),
             weather: top(e.weather), bait: top(e.bait), of: e.caught };
  }

  /* The index's own summary, in the terms the book is written in rather than
     as one number over another. */
  function counts(list) {
    const all = list || VF.fish.knownList();
    const c = { unknown: 0, glimpsed: 0, hooked: 0, landed: 0, known: 0, of: all.length };
    all.forEach(function (f) { c[state(f.id)]++; });
    /* everything that is not a blank page */
    c.met = c.glimpsed + c.hooked + c.landed + c.known;
    c.held = c.landed + c.known;
    return c;
  }

  /* The two questions the rest of the game actually asks. Before this file an
     entry existing WAS "have you caught one", and now it is not — a species
     you glimpsed once has an entry too. Every caller that meant "caught" says
     so here rather than testing the store, which is what let the meaning
     change under them in the first place. */
  function held(id) { const e = entry(id); return !!e && e.caught > 0; }
  function met(id) { return state(id) !== 'unknown'; }

  VF.record = {
    KNOWN: KNOWN,
    entry: entry, ensure: ensure, norm: norm,
    state: state, rank: rank, knows: knows,
    held: held, met: met,
    glimpse: glimpse, hooked: hooked, landed: landed,
    habits: habits, counts: counts
  };

  /* Wired to the events rather than into the fishing code, so the three
     moments that teach you something stay in one place and js/systems/
     fishing.js does not have to know this file exists. */
  if (VF.bus) {
    VF.bus.on('fishing:missed', function (e) { if (e && e.id) glimpse(e.id); });
    VF.bus.on('fishing:lost', function (e) { if (e && e.catch) hooked(e.catch); });
    VF.bus.on('fishing:landed', function (c) { landed(c); });
  }
})(window.VF = window.VF || {});
