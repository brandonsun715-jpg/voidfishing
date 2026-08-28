/* VOID FISHING — finding out.

   Three verbs and a ledger. Everything in the expansion talks to this module
   rather than to each other, which is what stops the whole thing becoming a
   pile of features that happen to be in the same build:

     clue(id)     something was learned. Writes the journal, opens a lead.
     ready(id)    is this lead's condition true right now, here?
     satisfy(id)  the player did the thing. Fires whatever the lead pointed at.

   A lead is never a waypoint marker with a distance on it. It is a sentence
   and a condition, and the player has to work out that the sentence means
   "sail to the trench at night with a sonar". The chart says where; it does
   not say when or with what. */
(function (VF) {
  'use strict';

  const U = VF.util;

  function rec() {
    const d = VF.state.data;
    if (!d.clues || typeof d.clues !== 'object') d.clues = {};
    if (!d.leads || typeof d.leads !== 'object') d.leads = {};
    return d;
  }

  /* ------------------------------------------------------------- clues */

  function hasClue(id) { return !!rec().clues[id]; }

  /* Learn something. Returns false if it was already known, so a caller can
     roll this every cast without checking first. */
  function clue(id, quiet) {
    const def = VF.discoveryData.clue(id);
    if (!def || hasClue(id)) return false;
    const d = rec();
    d.clues[id] = { at: Date.now() };
    d.stats.discoveries++;

    /* The journal is the record and there is only one of it. Rather than a
       second parallel list of clue text, a clue writes an ordinary entry —
       which means the existing journal panel, hint count and save all work on
       it with no changes at all. */
    VF.journal.addFree('clue:' + id, def.title, def.text, 'clue', def.opens ? 1 : 0);

    if (def.opens) openLead(def.opens);
    VF.bus.emit('clue:found', { id: id, def: def });
    if (!quiet) {
      VF.audio.discover();
      VF.toast.show('<strong>' + U.esc(def.title) + '</strong><br>' +
                    '<span style="color:var(--ink-3)">written down in the journal</span>',
                    'good', 5200);
    }
    VF.save.save();
    return true;
  }

  /* ------------------------------------------------------------- leads */

  function leadRec(id) { return rec().leads[id] || null; }
  function hasLead(id) { const l = leadRec(id); return !!(l && !l.done); }
  function leadDone(id) { const l = leadRec(id); return !!(l && l.done); }

  function openLead(id) {
    const def = VF.discoveryData.lead(id);
    if (!def) return false;
    const d = rec();
    if (d.leads[id]) return false;
    d.leads[id] = { at: Date.now(), done: 0 };
    VF.bus.emit('lead:open', { id: id, def: def });
    return true;
  }

  /* Every lead the player is currently carrying, nearest first — a lead you
     could act on where you are standing sorts above one that needs a journey. */
  function open() {
    const d = rec();
    const here = d.location;
    const out = [];
    for (const id in d.leads) {
      if (d.leads[id].done) continue;
      const def = VF.discoveryData.lead(id);
      if (!def) continue;
      out.push({ id: id, def: def, here: !def.where || def.where === here, ready: ready(id) });
    }
    out.sort(function (a, b) {
      return (b.ready ? 1 : 0) - (a.ready ? 1 : 0) || (b.here ? 1 : 0) - (a.here ? 1 : 0);
    });
    return out;
  }

  /* Is this lead's condition true, right here, right now? */
  function ready(id) {
    const def = VF.discoveryData.lead(id);
    if (!def || !hasLead(id)) return false;
    if (def.where && VF.state.data.location !== def.where) return false;
    try { return !!def.test(VF.state.data); } catch (e) { return false; }
  }

  /* Leads pointing at this place, whether or not their condition is met —
     what the chart draws next to a spot. */
  function forPlace(locId) {
    return open().filter(function (l) { return l.def.where === locId; });
  }

  /* The player did the thing. Fires what the lead pointed at and closes it. */
  function satisfy(id) {
    const def = VF.discoveryData.lead(id);
    if (!def || !hasLead(id)) return false;
    const d = rec();
    d.leads[id].done = Date.now();
    VF.bus.emit('lead:done', { id: id, def: def });

    try {
      if (def.kind === 'creature' && VF.creature) VF.creature.begin(def.target, { lead: id });
      else if (def.kind === 'expedition' && VF.expedition) VF.expedition.begin(def.target);
      else if (def.kind === 'sonar' && VF.zones) VF.zones.forceContact(def.target);
      else if (def.kind === 'place' && VF.secrets) VF.secrets.discover(def.target);
    } catch (e) { console.error('[discovery]', e); }

    VF.save.save();
    return true;
  }

  /* Anything ready and standing right here. Called by the systems that can
     legitimately interrupt — a cast landing, a voyage arriving — rather than
     on a timer, so a lead fires at a moment the player was already having. */
  function tryHere(kinds) {
    const list = open();
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      if (!l.ready) continue;
      if (kinds && kinds.indexOf(l.def.kind) < 0) continue;
      if (satisfy(l.id)) return l;
    }
    return null;
  }

  /* ------------------------------------------------------- announcements

     A discovery that scrolls past in a toast did not happen. Anything that
     adds to the world permanently goes through here, which shakes the frame,
     plays the sting and writes it down — one code path, so a new species and
     a new stretch of water feel like the same size of event. */
  function found(kind, name, line) {
    VF.audio.discover();
    VF.fx.flash('rgba(200,230,255,0.22)', 0.5, 1.6);
    VF.fx.pulse(0.5);
    VF.state.data.stats.discoveries++;
    VF.toast.show('<strong>' + U.esc(kind) + ' — ' + U.esc(name) + '</strong>' +
                  (line ? '<br><span style="color:var(--ink-3)">' + U.esc(line) + '</span>' : ''),
                  'good', 6000);
    VF.bus.emit('discovery:found', { kind: kind, name: name });
  }

  VF.discovery = {
    clue: clue, has: hasClue,
    openLead: openLead, hasLead: hasLead, leadDone: leadDone,
    open: open, ready: ready, satisfy: satisfy, forPlace: forPlace, tryHere: tryHere,
    found: found,
    count: function () {
      const d = rec();
      return { clues: Object.keys(d.clues).length, leads: open().length };
    }
  };
})(window.VF = window.VF || {});
