/* VOID FISHING — people noticing.

   The dialogue in this game is a ladder. Every NPC has an ordered list of
   stages, `availableIn` walks it and stops at the first entry whose condition
   fails, and the player climbs it one conversation at a time. That is exactly
   right for a story somebody is telling you and exactly wrong for everything
   else, because a ladder cannot say "you look terrible" — a ladder can only
   say the next thing.

   This is the other register. A reaction is a line somebody has because of
   how the world is RIGHT NOW: what you did last trip, what state the hull is
   in, what you have been told and by whom, what has turned out not to be
   true. It advances nothing, unlocks nothing and cannot be missed, because it
   is not on a track.

   SCORED, NOT ORDERED. Every reaction whose condition holds is a candidate,
   and the best one wins — highest weight, with a nudge for whichever has gone
   longest unsaid. That is the whole difference from the ladder: two people can
   have something to say about the same thing and say different things, and the
   same person can say a different thing next week without anybody having
   written a sequence.

   The cooldown is counted in CONVERSATIONS with that person, not in seconds.
   Somebody who says the same thing twice running is a machine; somebody who
   says it again three conversations later is a person with a preoccupation. */
(function (VF) {
  'use strict';

  /* How many conversations with this person have to pass before they will use
     the same reaction again. Two is enough that it never reads as a loop and
     small enough that a preoccupation can still recur. */
  const COOLDOWN = 2;

  function context() {
    const d = VF.state.data;
    const afloat = !!(VF.boat && VF.boat.afloat());
    return {
      d: d,
      /* the three ledgers, by their short names, so a condition reads as a
         sentence rather than as a path */
      h: VF.history,
      r: VF.rumours,
      zone: d.location,
      level: d.level | 0,
      afloat: afloat,
      hull: afloat && VF.boat ? VF.boat.integrity() : 1,
      phase: VF.time ? VF.time.phase() : 'day',
      weather: VF.weather ? VF.weather.id() : 'clear',
      fact: function (id) { return VF.chains ? VF.chains.fact(id) : undefined; },
      since: function (id) { return VF.history ? VF.history.since(id) : Infinity; },
      did: function (id) { return VF.history ? VF.history.has(id) : false; },
      times: function (id) { return VF.history ? VF.history.count(id) : 0; },
      heard: function (id) { return VF.rumours ? VF.rumours.heard(id) : false; },
      contested: function () { return VF.rumours ? VF.rumours.contested() : []; }
    };
  }

  /* What this person would remark on now, if anything. Null is the normal
     answer and always has to be survivable — the caller falls through to a
     rumour and then to small talk. */
  function offer(npcId) {
    const npc = VF.npcs.get(npcId);
    if (!npc || !npc.reacts || !npc.reacts.length) return null;
    const r = VF.npcs.peek(npcId);
    const said = r.said || {};
    const met = r.met | 0;
    const ctx = context();

    let best = null, bestScore = -Infinity;
    for (let i = 0; i < npc.reacts.length; i++) {
      const def = npc.reacts[i];
      const was = said[def.id];
      if (was && def.once) continue;
      if (was && (met - (was.met | 0)) < COOLDOWN) continue;
      let ok = false;
      try { ok = !!def.when(ctx); } catch (e) { ok = false; }
      if (!ok) continue;
      /* Weight is authored: how much this person wants to say this rather
         than anything else. Staleness is the tie-break, so two equal
         reactions alternate instead of one of them winning forever. */
      const stale = was ? Math.min(1, (met - (was.met | 0)) / 8) : 1;
      const score = (def.weight === undefined ? 1 : def.weight) + stale * 0.4;
      if (score > bestScore) { bestScore = score; best = def; }
    }
    if (!best) return null;

    let lines;
    try { lines = typeof best.lines === 'function' ? best.lines(ctx) : best.lines; }
    catch (e) { return null; }
    if (!lines || !lines.length) return null;
    return { id: best.id, npc: npcId, lines: lines };
  }

  /* Recorded when the conversation actually happened, not when the line was
     picked — walking away halfway through still counts as having heard it,
     which is the same rule the ladder and the rumours use. */
  function said(npcId, id) {
    const rec = VF.npcs.rec(npcId);
    if (!rec.said || typeof rec.said !== 'object') rec.said = {};
    rec.said[id] = { at: Date.now(), met: rec.met | 0 };
  }

  /* Does this person have a remark waiting? Read-only — used by the hub to
     put a mark over somebody's head without creating a record for them. */
  function has(npcId) { return !!offer(npcId); }

  VF.react = { offer: offer, said: said, has: has, context: context, COOLDOWN: COOLDOWN };
})(window.VF = window.VF || {});
