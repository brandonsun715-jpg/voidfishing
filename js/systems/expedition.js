/* VOID FISHING — running an expedition.

   The same shape as js/systems/quests.js and deliberately so: a record per
   expedition, a leg index, and a check that runs on the events that could
   plausibly satisfy the current leg. What is different is what a leg IS — a
   quest chapter waits for a catch or a conversation, and an expedition leg
   waits for a sonar fix, a crossing, a depth reading or a creature.

   Nothing here knows about any particular expedition. js/data/expeditions.js
   writes them; this walks them; the journal draws them.

   `found` is a free-form counter bag per expedition, which is how a leg says
   "three sonar contacts" without this file knowing what a sonar contact is:
   whatever raises the counter calls note(), and the leg reads it. */
(function (VF) {
  'use strict';

  const U = VF.util;

  function rec(id) {
    const d = VF.state.data;
    if (!d.expeditions || typeof d.expeditions !== 'object') d.expeditions = {};
    if (!d.expeditions[id]) d.expeditions[id] = { started: 0, leg: 0, done: 0, found: {} };
    const e = d.expeditions[id];
    if (!e.found) e.found = {};
    return e;
  }

  function peek(id) { return VF.state.data.expeditions ? VF.state.data.expeditions[id] : null; }
  function started(id) { const e = peek(id); return !!(e && e.started); }
  function complete(id) { const e = peek(id); return !!(e && e.done); }

  /* The one that is running, if any. Only one at a time: an expedition that
     can be run alongside two others is a checklist. */
  function current() {
    const d = VF.state.data;
    for (const id in (d.expeditions || {})) {
      const e = d.expeditions[id];
      if (e.started && !e.done) {
        const def = VF.expeditionData.get(id);
        if (def) return { id: id, def: def, rec: e, leg: def.legs[e.leg] || null };
      }
    }
    return null;
  }

  function begin(id) {
    const def = VF.expeditionData.get(id);
    if (!def || started(id)) return false;
    /* The Survey Vessel Wren is described as "the first thing you have owned
       that can be sent somewhere with a question", and until now nothing
       asked. `can('expeditions')` was a string in a list that no line of code
       had ever read. */
    if (VF.boat && !VF.boat.can('expeditions')) {
      VF.toast.plain('you need a boat with a bench of instruments on it.', 'warn', 3600);
      return false;
    }
    if (current()) {
      VF.toast.plain('one at a time. finish what you are on.', 'warn', 3600);
      return false;
    }
    const e = rec(id);
    e.started = Date.now();
    e.leg = 0;
    VF.audio.stinger('grand', 5);
    VF.discovery.found('expedition', def.name, def.objective);
    VF.journal.addFree('exp:' + id, def.name, def.objective + ' ' + def.blurb, 'event', 1);
    enterLeg(def, e);
    VF.bus.emit('expedition:start', def);
    VF.save.save();
    return true;
  }

  function enterLeg(def, e) {
    const leg = def.legs[e.leg];
    if (!leg) return;
    if (leg.enter) { try { leg.enter(VF.state.data, e); } catch (x) { console.error('[exp]', x); } }
    VF.bus.emit('expedition:leg', { def: def, leg: leg, index: e.leg });
  }

  /* Raise a counter on the running expedition. Everything that could be part
     of a leg calls this and does not care whether an expedition is running. */
  function note(key, n) {
    const c = current();
    if (!c) return;
    c.rec.found[key] = (c.rec.found[key] | 0) + (n === undefined ? 1 : n);
    check();
  }

  /* Is the current leg satisfied? Called on the handful of events that could
     have satisfied it rather than every frame. */
  function check() {
    const c = current();
    if (!c || !c.leg) return false;
    const d = VF.state.data;
    if (c.leg.at && d.location !== c.leg.at) return false;
    let ok = false;
    try { ok = !!c.leg.need(d, c.rec); } catch (x) { ok = false; }
    if (!ok) return false;

    if (c.leg.done) { try { c.leg.done(d, c.rec); } catch (x) { console.error('[exp]', x); } }
    c.rec.leg++;
    VF.audio.stinger('bright', 4);
    VF.fx.pulse(0.4);

    if (c.rec.leg >= c.def.legs.length) return finish(c);

    VF.toast.show('<strong>' + U.esc(c.def.name) + '</strong><br>' +
                  '<span style="color:var(--ink-3)">' +
                  U.esc(c.def.legs[c.rec.leg].task) + '</span>', 'good', 6500);
    enterLeg(c.def, c.rec);
    VF.save.save();
    return true;
  }

  function finish(c) {
    c.rec.done = Date.now();
    const rw = c.def.reward || {};
    if (rw.money) VF.economy.earn(rw.money, 'expedition');
    if (rw.xp) VF.progression.addXp(rw.xp);
    if (rw.trim && VF.boat) {
      const b = VF.boat.shape();
      if (b.trims.indexOf(rw.trim) < 0) b.trims.push(rw.trim);
    }
    VF.audio.stinger('grand', 6);
    VF.fx.flash('rgba(200,230,255,0.24)', 0.8, 1.8);
    VF.discovery.found('expedition complete', c.def.name, c.def.objective);
    VF.bus.emit('expedition:done', c.def);
    VF.save.save();
    return true;
  }

  /* An expedition can hand over a whole stretch of water. Registered exactly
     the way a secret is, so the chart, the loot pool, the palette and the map
     pick it up with no changes at all. */
  function grantPlace(loc, line) {
    const d = VF.state.data;
    if (VF.locations.isRegistered(loc.id)) return false;
    loc.secret = true;
    VF.locations.register(loc);
    if (d.unlockedLocations.indexOf(loc.id) < 0) d.unlockedLocations.push(loc.id);
    d.secrets[loc.id] = Date.now();
    d.stats.secretsFound++;
    VF.loot.invalidatePool();
    VF.discovery.found('water', loc.name, line || loc.tag);
    VF.journal.addFree('place:' + loc.id, loc.name, loc.desc, 'find', 1);
    VF.save.save();
    return true;
  }

  /* Expeditions the player could start: unlocked by a lead, gated by boat. */
  function offered() {
    const d = VF.state.data;
    return VF.expeditionData.list.map(function (def) {
      const e = peek(def.id);
      return {
        def: def,
        started: !!(e && e.started), done: !!(e && e.done),
        leg: e ? e.leg : 0,
        open: !!(d.leads && Object.keys(d.leads).some(function (k) {
          const l = VF.discoveryData.lead(k);
          return l && l.kind === 'expedition' && l.target === def.id;
        }))
      };
    });
  }

  /* ------------------------------------------------------- the listeners

     Everything that can move a leg forward is here, in one place, so a new
     leg verb is a line rather than a hunt through six files. */
  VF.bus.on('fishing:landed', function (c) {
    const cur = current();
    if (!cur) return;
    const at = VF.state.data.location;
    if (at === 'abyss') note('seen');
    if (at === 'cradle') note('up');
    if (at === 'sunken_city') note('bell');
    check();
  });
  VF.bus.on('fishing:cast', function () {
    if (VF.state.data.location === 'cradle') note('cast');
  });
  VF.bus.on('voyage:end', function () { note('crossed'); });
  VF.bus.on('clue:found', function () { check(); });
  VF.bus.on('creature:end', function () { check(); });
  VF.bus.on('location:changed', function () { check(); });
  VF.bus.on('zone:contact', function () { note('pings'); });

  VF.expedition = {
    begin: begin, check: check, note: note, current: current,
    started: started, complete: complete, offered: offered,
    grantPlace: grantPlace
  };
})(window.VF = window.VF || {});
