/* VOID FISHING — the one that comes back.

   Everything else here is a species. You catch a Nettle Eel, and then another
   Nettle Eel, and the second one has no opinion about the first. That is the
   right model for a catalogue and the wrong one for a story, and this game has
   exactly enough machinery lying around to tell one: scripted fights, the
   second-chance save, the approach shadow, the journal, the encounter system.

   So: an individual. Not a rarity, not a tier — one animal, which you meet
   three times.

   The first time it takes the bait and goes, and there is nothing you can do
   about it: the fight is scripted to be lost, because a story where the first
   meeting is a coin flip is a story that usually does not happen. The second
   time it is bigger, and your old hook is still in it, and it can be landed by
   somebody paying attention. The third time is the third time.

   Gated on casts rather than on a clock, so it is paced by playing rather than
   by waiting, and it never interrupts anything that matters — it will not
   turn up during a quest trial or on top of an encounter. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Which species it is. Chosen for the shape and for what is already written
     about it — "you do not see it, you see the length of time during which you
     cannot see anything else" is a description of something that has been
     there a while, which is what this needs. */
  const SPECIES = 'long_dark';

  /* How many casts between meetings, at the earliest. The gaps are long
     because the point is that it has been away. */
  const STAGES = [
    { at: 220,  name: 'The One That Went',
      lead: 'something takes it, and keeps going' },
    { at: 700,  name: 'It Came Back',
      lead: 'the same one. your hook is still in it' },
    { at: 1500, name: 'The Last Time',
      lead: 'it is not running this time' }
  ];

  /* The three fights. The first cannot be won and says so with its numbers:
     the meter only goes down, and it ends on a clock, because a meter that
     only falls does not fall while the player is holding the fish inside the
     bar — without the clock, somebody good enough could hold a hopeless fight
     open for as long as they liked. Eleven seconds is long enough to
     understand what is happening and short enough not to be a punishment.

     The second and third are winnable and hard. */
  const FIGHTS = [
    { unwinnable: true,
      phases: [
        { at: 0.00, name: 'It Has The Bait', start: 0.42,
          barW: 0.150, barSpeed: 1.30, fishSpeed: 1.10, fishTurn: 0.22, dart: 0.85,
          evade: 0.55, fill: 0.000, drain: 0.130, maxTime: 11, gearFill: 0, gearBar: 0 }
      ] },
    { phases: [
        { at: 0.00, name: 'It Remembers This', start: 0.30,
          barW: 0.185, barSpeed: 1.22, fishSpeed: 0.90, fishTurn: 0.34, dart: 0.58,
          fill: 0.062, drain: 0.150, gearFill: 0.35, gearBar: 0.40 },
        { at: 0.52, name: 'The Old Hook',
          barW: 0.152, barSpeed: 1.36, fishSpeed: 1.02, fishTurn: 0.26, dart: 0.70,
          evade: 0.30, fill: 0.058, drain: 0.170, gearFill: 0.35, gearBar: 0.40 }
      ] },
    { phases: [
        { at: 0.00, name: 'It Is Not Running', start: 0.26,
          barW: 0.170, barSpeed: 1.28, fishSpeed: 0.98, fishTurn: 0.30, dart: 0.62,
          evade: 0.18, fill: 0.052, drain: 0.160, gearFill: 0.35, gearBar: 0.40 },
        { at: 0.40, name: 'All Of It',
          barW: 0.142, barSpeed: 1.42, fishSpeed: 1.10, fishTurn: 0.22, dart: 0.74,
          evade: 0.40, fill: 0.048, drain: 0.180, gearFill: 0.35, gearBar: 0.40 },
        { at: 0.78, name: 'And Then Nothing',
          barW: 0.120, barSpeed: 1.56, fishSpeed: 1.18, fishTurn: 0.17, dart: 0.82,
          evade: 0.52, fill: 0.056, drain: 0.200, gearFill: 0.35, gearBar: 0.40 }
      ] }
  ];

  function state() {
    const d = VF.state.data;
    if (!d.returning || typeof d.returning !== 'object' || Array.isArray(d.returning)) {
      d.returning = { stage: 0, lastCast: 0, done: false };
    }
    return d.returning;
  }

  /* Is it due? Asked on every cast, and cheap. */
  function due() {
    const r = state();
    if (r.done || r.stage >= STAGES.length) return false;
    const d = VF.state.data;
    if (VF.fish.byId(SPECIES) === null) return false;
    // never on top of something that is already an event
    if (VF.quests && VF.quests.anyArmed()) return false;
    if (VF.encounters && VF.encounters.active()) return false;
    const need = STAGES[r.stage].at;
    return d.stats.casts >= need && d.stats.casts - (r.lastCast | 0) >= 40;
  }

  /* Build the catch. It is the species, at the top of its size range and a
     little past it each time, carrying the scars as traits. */
  function build() {
    const r = state();
    const i = Math.min(r.stage, FIGHTS.length - 1);
    const c = VF.loot.roll({ forceFish: SPECIES, traitBoost: 0 });
    c.kind = 'fish';
    /* Bigger every time, and that has to be guaranteed rather than likely.
       Multiplying the rolled size did not do it: the species spans 150kg to
       2600kg, so a big first meeting and a small second one came out
       backwards, and "it is the same one and it has grown" is the entire
       point. So the size is written, at a fixed place in the range each time,
       and the last one is past the top of it. */
    const f = VF.fish.byId(SPECIES);
    const at = [0.55, 0.86, 1.22][i];
    const kMin = Math.max(f.kg[0], 1e-4), kMax = Math.max(f.kg[1], kMin * 1.0001);
    const mMin = Math.max(f.m[0], 1e-4), mMax = Math.max(f.m[1], mMin * 1.0001);
    c.kg = kMin * Math.pow(kMax / kMin, at);
    c.m = mMin * Math.pow(mMax / mMin, Math.min(at, 1.06));
    c.pct = Math.min(1, at);
    c.isGiant = i >= 1;
    c.value = Math.round(c.value * (1.4 + i * 1.2));
    c.xp = Math.round(c.xp * (1.5 + i));
    c.traits = i === 0 ? [] : ['ancient'];
    c.returning = i;
    c.trial = { phases: FIGHTS[i].phases, tier: 'returning', generated: true };
    c.wide = true;
    if (FIGHTS[i].unwinnable) c.unwinnable = true;
    return c;
  }

  /* Called by the fishing loop when it is deciding what is on the line. */
  function offer() {
    if (!due()) return null;
    const r = state();
    r.lastCast = VF.state.data.stats.casts;
    VF.bus.emit('returning:coming', { stage: r.stage, spec: STAGES[r.stage] });
    return build();
  }

  /* It got away, or it did not. Either advances the story: losing the first
     one is the story. */
  function resolved(c, won) {
    if (!c || c.returning === undefined) return;
    const r = state();
    const i = c.returning;
    if (i !== r.stage) return;
    /* The first meeting advances however it went, because it cannot be won.
       The others only advance when it is landed — losing it means it is still
       out there, which is the whole point of it. */
    if (i === 0 || won) {
      r.stage = i + 1;
      if (r.stage >= STAGES.length) r.done = true;
      VF.journal.add(i === 0 ? 'returning1' : r.done ? 'returning3' : 'returning2');
      VF.bus.emit('returning:advanced', { stage: r.stage, done: r.done, won: won });
    }
    VF.save.save();
  }

  VF.returning = {
    SPECIES: SPECIES,
    STAGES: STAGES,
    offer: offer,
    due: due,
    resolved: resolved,
    stage: function () { return state().stage; },
    done: function () { return !!state().done; }
  };

  VF.bus.on('fishing:landed', function (c) { resolved(c, true); });
  VF.bus.on('fishing:lost', function (e) { resolved(e && e.catch, false); });
})(window.VF = window.VF || {});
