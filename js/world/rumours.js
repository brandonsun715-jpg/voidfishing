/* VOID FISHING — being told things, and finding out.

   The ledger for js/data/rumours.js, and the three verbs around it:

     offer(npc)     what this person would say to you now, if anything
     hear(id)       you were told it. Recorded with who said it and when.
     settle()       the world proved or disproved something you were told

   What this deliberately does NOT do:

   It does not open a quest. It does not put a marker on the chart. It does not
   tell the player whether what they just heard is true — there is no
   reliability score anywhere in the interface, because a rumour you can see
   through is not a rumour, it is a quest with extra steps.

   And it does not resolve a contradiction. When two people have told you
   different numbers, the game's position is that you have been told two
   things. It stays that way until you go and look.

   Settling is always something the player DID. Every `settle` in the data
   hangs off a clue they found, a place they put in at, or a number of casts
   they made — never off time passing, and never off being told a third time. */
(function (VF) {
  'use strict';

  const U = VF.util;

  function rec() {
    const d = VF.state.data;
    if (!d.world || typeof d.world !== 'object') d.world = {};
    if (!d.world.rumours || typeof d.world.rumours !== 'object') d.world.rumours = {};
    return d.world.rumours;
  }

  function heard(id) { return !!rec()[id]; }

  function all() {
    const r = rec();
    return Object.keys(r).map(function (id) {
      const def = VF.rumourData.get(id);
      return def ? Object.assign({}, def, r[id]) : null;
    }).filter(Boolean);
  }

  /* Everything you have been told about one thing. */
  function onTopic(topic) {
    return all().filter(function (r) { return r.topic === topic; });
  }

  /* Topics where you have been told two different things and neither has been
     settled. This is the state the whole system exists to produce. */
  function contested() {
    const out = [];
    const seen = {};
    all().forEach(function (r) {
      if (seen[r.topic]) return;
      seen[r.topic] = 1;
      const set = onTopic(r.topic);
      if (set.length < 2) return;
      if (set.some(function (x) { return x.settled; })) return;
      const claims = {};
      set.forEach(function (x) { claims[String(x.claim)] = 1; });
      if (Object.keys(claims).length > 1) out.push({ topic: r.topic, rumours: set });
    });
    return out;
  }

  /* ------------------------------------------------------------- hearing */

  /* The context a rumour's `needs` is tested against. `heard` is on here so a
     follow-up can require that you were told the first half — which is how a
     disagreement gets built one conversation at a time rather than dumped. */
  function context() {
    const d = VF.state.data;
    return {
      level: d.level,
      depth: VF.locations.index(d.location),
      zone: d.location,
      casts: d.stats.casts | 0,
      clues: d.clues ? Object.keys(d.clues).length : 0,
      secrets: Object.keys(d.secrets || {}).length,
      heard: heard,
      d: d
    };
  }

  /* Is this rumour available from this person right now? */
  function ready(def, npcId, c) {
    if (!def || heard(def.id)) return false;
    if (def.from && def.from.indexOf(npcId) < 0) return false;
    /* Spawned rumours are about the player and are not in the pool until
       something the player did puts them there. */
    if (def.spawned && !rec()['?' + def.id]) return false;
    if (def.needs) { try { return !!def.needs(c); } catch (e) { return false; } }
    return true;
  }

  /* What this person would tell you, if anything. Returns a def or null, and
     null is fine — most people, most of the time, have nothing new. */
  function offer(npcId) {
    const c = context();
    const pool = VF.rumourData.list.filter(function (def) { return ready(def, npcId, c); });
    if (!pool.length) return null;
    /* The oldest available one first, so a thread is told in the order it was
       written rather than shuffled into nonsense. */
    return pool[0];
  }

  function hear(id, npcId) {
    const def = VF.rumourData.get(id);
    if (!def || heard(id)) return false;
    rec()[id] = { at: Date.now(), from: npcId || null };
    /* A rumour that pays off hands over a clue and the existing machinery
       takes it from there — this module does not own leads. */
    if (def.opens && VF.discovery) VF.discovery.openLead(def.opens);
    VF.bus.emit('rumour:heard', def);
    return true;
  }

  /* Mark that the world is now willing to say this thing about the player. */
  function arm(id) {
    const r = rec();
    if (r['?' + id]) return false;
    r['?' + id] = 1;
    return true;
  }

  /* --------------------------------------------------------- finding out */

  /* Has anything you were told been proved or disproved by something you did?
     Checked on a slow beat and after the events that could settle one. */
  function settle() {
    const r = rec();
    const d = VF.state.data;
    let any = false;
    all().forEach(function (rum) {
      if (rum.settled || !rum.settle) return;
      let ok = false;
      try { ok = !!rum.settle.when(d); } catch (e) { ok = false; }
      if (!ok) return;
      r[rum.id].settled = Date.now();
      any = true;
      /* Settling one settles the topic: the other accounts are now answered
         too, and which of them was right is a thing the player watched happen
         rather than a thing the game announced. */
      onTopic(rum.topic).forEach(function (o) {
        if (r[o.id] && !r[o.id].settled) r[o.id].settled = Date.now();
      });
      /* Written down as a note under its own id — addFree already exists for
         exactly this and dedups on the id, so a repeated settle cannot write
         the same line twice. */
      if (rum.settle.text && VF.journal) {
        VF.journal.addFree('rumour:' + rum.topic, 'what it turned out to be',
                           rum.settle.text, 'note', 0);
      }
      VF.bus.emit('rumour:settled', rum);
    });
    if (any) VF.save.save();
    return any;
  }

  /* --------------------------------------------------------- the world talks

     What the player has done starts coming back at them. Not a reward and not
     an announcement — the next time somebody has nothing else to say, they say
     this instead. */
  function bindWorld() {
    VF.bus.on('secret:found', function () { arm('you_east'); });
    VF.bus.on('voyage:passed', function (def) {
      if (def && def.kind === 'SIGNAL') arm('you_ignored');
    });
    VF.bus.on('fishing:landed', function (c) {
      if (c && c.rarity && VF.rarities.rank(c.rarity) >= 5) arm('you_caught');
    });
    /* And anything the player does can settle something they were told. */
    VF.bus.on('clue:found', settle);
    VF.bus.on('secret:found', settle);
    VF.bus.on('location:changed', settle);
  }

  function reset() {
    const d = VF.state.data;
    if (d.world) d.world.rumours = {};
  }

  VF.rumours = {
    offer: offer, hear: hear, heard: heard, all: all,
    onTopic: onTopic, contested: contested, settle: settle, arm: arm,
    context: context, reset: reset,
    count: function () {
      const a = all();
      return { heard: a.length, settled: a.filter(function (r) { return r.settled; }).length,
               contested: contested().length };
    }
  };

  bindWorld();
})(window.VF = window.VF || {});
