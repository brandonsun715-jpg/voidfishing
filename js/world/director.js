/* VOID FISHING — deciding whether anything happens.

   Every crossing fired between one and three events. Not "up to three" —
   `clamp(1 + floor(rnd() * 2), 1, 3)` never returns zero, so the answer to
   "does something happen on this trip" was yes, every time, for the life of
   the game. A crossing is ten to twenty-six seconds and a card holds the
   screen for three and a half after it is answered, so most of a voyage was
   reading. That is the whole reason the sea stopped feeling like a place: an
   ocean where something always happens is not an ocean, it is a corridor with
   encounters in it.

   So nothing asks for an event any more. Things ASK THE DIRECTOR, and the
   director mostly says no.

   Two ideas do the work:

   THE BUDGET. Notable things spend from it and quiet refills it. A major
   encounter cannot follow a major encounter, however the dice fall, because
   the budget will not have recovered — and the quiet in between is not dead
   air, it is what makes the next one land. Restraint is the mechanism, not
   the intention.

   THE CONTEXT. A candidate is not a weight, it is a function of the world:
   where you are, the hour, the moon, the weather, the state of the hull, what
   you have already found, and what happened on the last few trips. A
   candidate that does not apply returns zero and is not in the draw at all,
   so the pool narrows itself instead of being filtered afterwards.

   It does not know what an event IS. It answers "how notable is the next
   thing, if anything" and hands back a candidate; placing it in the water and
   drawing it belongs to whoever asked. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* How notable a thing is, and what it costs to have happened. The names are
     the vocabulary the rest of the game uses to ask for something. */
  const CLASS = {
    NONE: 0,
    ENVIRONMENT: 1,   // weather, birds, a shoal going the other way. Not a card.
    MINOR: 2,         // something to notice. Still not a card.
    DISCOVERY: 3,     // something worth going to look at
    ENCOUNTER: 4,     // something that wants a decision
    MAJOR: 5          // the rare one
  };

  const NAME = ['none', 'environment', 'minor', 'discovery', 'encounter', 'major'];

  /* What each tier costs, and how much quiet it needs before it is even in the
     draw. `needs` is in units of budget, which recovers at RECOVER per trip.

     Indexed by the NUMBER, and candidates declare the NAME — `cls: 'MAJOR'`
     reads better in a data file than `cls: 5`. Going through CLASS to get from
     one to the other is not optional: indexing this array with the string
     silently returned undefined, fell through to the first tier, and made
     every event in the game cost 0.05 and need nothing. The budget was inert
     and nothing said so. */
  const TIER = [
    { cost: 0,    needs: 0 },
    { cost: 0.35, needs: 0 },
    { cost: 0.55, needs: 0.2 },
    { cost: 0.90, needs: 0.6 },
    { cost: 1.20, needs: 0.9 },
    { cost: 1.80, needs: 1.5 }
  ];

  /* Tuned against tools/trips.js rather than guessed. The first pass gave the
     cheapest tier a cost of 0.05 against a recovery of 0.42, so an ordinary
     event was free, the budget sat at its ceiling, and something happened on
     seven crossings in ten. Everything costs enough to be felt now. */
  const RECOVER = 0.26;      // budget per trip
  const CAP = 1.8;           // and the most it can bank, so quiet does not compound

  const S = {
    budget: 1.0,
    trips: 0,
    recent: [],              // { id, at } — what has happened lately
    lastClass: 0
  };

  function rec() {
    const d = VF.state.data;
    if (!d.world || typeof d.world !== 'object') d.world = {};
    if (!d.world.director || typeof d.world.director !== 'object') {
      d.world.director = { budget: 1.0, trips: 0, recent: [] };
    }
    const r = d.world.director;
    if (!Array.isArray(r.recent)) r.recent = [];
    if (typeof r.budget !== 'number') r.budget = 1.0;
    return r;
  }

  function load() {
    const r = rec();
    S.budget = r.budget; S.trips = r.trips | 0; S.recent = r.recent;
  }

  function save() {
    const r = rec();
    r.budget = S.budget; r.trips = S.trips;
    /* Only the last dozen matter — this is a damping term, not a history. The
       ledger of what actually happened lives in the journal and the clues. */
    r.recent = S.recent.slice(-12);
  }

  /* A trip has been made. Quiet is the only thing that pays for surprise. */
  function tick() {
    load();
    S.trips++;
    S.budget = Math.min(CAP, S.budget + RECOVER);
    save();
  }

  /* How recently this id fired, 0 (just now) to 1 (long ago or never). Used to
     damp rather than to exclude: seeing the same derelict twice in a night is
     fine, four times in a row is not. */
  function freshness(id) {
    load();
    for (let i = S.recent.length - 1; i >= 0; i--) {
      if (S.recent[i].id === id) {
        const ago = S.trips - S.recent[i].at;
        /* Squared, and hard against the last couple of trips. A linear ramp
           damped a repeat to a quarter of its weight, which was not nearly
           enough for the heaviest candidate in the pool: the squall line came
           up three crossings running and tools/trips.js caught it. Something
           that has just happened should be all but impossible next time out,
           and ordinary again about six trips later. */
        if (ago <= 1) return 0;
        const k = U.clamp((ago - 1) / 6, 0, 1);
        return k * k;
      }
    }
    return 1;
  }

  /* What the world looks like right now, handed to every candidate so none of
     them has to go and find out for itself. */
  function context(extra) {
    const d = VF.state.data;
    const ctx = {
      zone: d.location,
      depth: VF.locations.index(d.location),
      phase: VF.time.phase(),
      cycle: VF.time.cycle(),
      weather: VF.weather.id(),
      fog: VF.weather.fog(),
      wind: VF.weather.wind(),
      moon: VF.zones && VF.zones.moonPhase ? VF.zones.moonPhase() : null,
      level: d.level,
      hull: VF.boat && VF.boat.integrity ? VF.boat.integrity() : 1,
      sonar: !!(VF.boat && VF.boat.has && VF.boat.has('sonar')),
      trips: S.trips,
      budget: S.budget,
      clues: d.clues ? Object.keys(d.clues).length : 0,
      d: d
    };
    if (extra) for (const k in extra) ctx[k] = extra[k];
    return ctx;
  }

  /* ------------------------------------------------------------- the roll

     `candidates` is a list of { id, cls, weight(ctx) }. The answer is a
     candidate or null, and null is the common case by design.

     `pressure` lets a caller say how much this particular moment wants
     something — a first crossing to a new place is worth more than the
     hundredth run of a route already known. It moves the odds, never the
     budget rules. */
  function ask(candidates, opts) {
    opts = opts || {};
    load();
    const ctx = opts.ctx || context();
    const pressure = opts.pressure === undefined ? 1 : opts.pressure;

    /* Score everything that applies, and let the budget rule out whole tiers
       before any dice are thrown. */
    const pool = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const tier = TIER[CLASS[c.cls] || 1];
      if (S.budget < tier.needs) continue;
      let w = 0;
      try { w = c.weight(ctx) || 0; } catch (e) { w = 0; }
      if (w <= 0) continue;
      w *= freshness(c.id);
      if (w <= 0) continue;
      pool.push({ c: c, w: w });
    }
    if (!pool.length) return null;

    /* And then the question that was never being asked: does anything happen
       at all? The chance is small, rises with the budget, and is scaled by
       whatever the caller thinks this moment is worth. A full budget on a long
       crossing is still a little over even money. */
    const chance = U.clamp(0.04 + S.budget * 0.16, 0, 0.42) * pressure;
    if (VF.rng.g() > chance) return null;

    const pick = VF.rng.weighted(pool, function (e) { return e.w; }, VF.rng.g);
    if (!pick) return null;
    return pick.c;
  }

  /* It happened. Spend for it. Callers do this when the thing actually
     reaches the player, not when it is chosen — a sighting the player sailed
     past cost them nothing and should not cost the budget either. */
  function spend(candidate) {
    load();
    const tier = TIER[CLASS[candidate.cls] || 1];
    S.budget = Math.max(0, S.budget - tier.cost);
    S.recent.push({ id: candidate.id, at: S.trips });
    S.lastClass = CLASS[candidate.cls] || 1;
    save();
    VF.bus.emit('director:spent', { id: candidate.id, cls: candidate.cls });
  }

  /* For the tools, and for the F7 world-state view. */
  function state() {
    load();
    return { budget: +S.budget.toFixed(2), trips: S.trips,
             recent: S.recent.slice(-6).map(function (r) { return r.id; }) };
  }

  function reset() {
    const r = rec();
    r.budget = 1.0; r.trips = 0; r.recent = [];
    load();
  }

  VF.director = {
    CLASS: CLASS, NAME: NAME,
    ask: ask, spend: spend, tick: tick, context: context,
    freshness: freshness, state: state, reset: reset
  };
})(window.VF = window.VF || {});
