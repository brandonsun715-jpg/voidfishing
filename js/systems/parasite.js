/* VOID FISHING — what is living on the rod.

   The one encounter that does not end with something in the bag. It ends with
   something on the blank, about a third of the way up, and it stays there for
   a while and changes what the rod brings up.

   Deliberately a general mechanism rather than one effect: a parasite is a
   definition with a counter and two optional hooks, so the next one is data.

     onRoll(c)   runs on every catch record before the card opens. It may
                 change the catch — add a trait, move a tier, alter the value.
     stats(s)    folds into the loadout the same way a charm does.

   It is not a debuff and it is not a buff. Void-Touched is worth money and it
   is also the reason four of your last ten catches were the wrong shape. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const KINDS = {
    voidtouch: {
      name: 'Void-Touched',
      line: 'the next few catches are going to come up wrong',
      uses: 5,
      colour: '#b48aff',
      /* A flat chance per catch rather than a guarantee: five wrong fish in a
         row is a mechanic, and one wrong fish out of five you were not
         expecting is an event. */
      onRoll: function (c) {
        if (VF.rng.g() > 0.55) return false;
        if (!c.traits) c.traits = [];
        if (c.traits.indexOf('voidtouched') >= 0) return false;
        c.traits.push('voidtouched');
        c.value = Math.round(c.value * 1.8);
        return true;
      }
    },

    /* Left in as the second one so the shape of a second one is obvious.
       Nothing grants it yet. */
    deepdrag: {
      name: 'Deep Drag',
      line: 'the line goes down further than you are letting it',
      uses: 8,
      colour: '#5fa8c0',
      stats: function (s) { s.rare *= 1.22; s.bite *= 1.30; }
    }
  };

  function rec() {
    const d = VF.state.data;
    if (!d.flags || typeof d.flags !== 'object') d.flags = {};
    return d;
  }

  /* The live one, or null. Stored in flags rather than as its own top-level
     field so an old save needs no migration at all. */
  function current() {
    const p = rec().flags.parasite;
    if (!p || !KINDS[p.id] || (p.left | 0) <= 0) return null;
    return { id: p.id, def: KINDS[p.id], left: p.left | 0 };
  }

  function attach(id, from) {
    const def = KINDS[id];
    if (!def) return false;
    rec().flags.parasite = { id: id, left: def.uses, at: Date.now() };
    VF.audio.stinger('void', 6);
    VF.fx.flash(U.rgbToCss(U.hexToRgb(def.colour), 0.20), 0.5, 1.6);
    VF.toast.show('<strong>' + U.esc(def.name.toUpperCase()) + ' — attached</strong><br>' +
                  '<span style="color:var(--ink-3)">' + U.esc(def.line) + ' · ' +
                  def.uses + ' catches</span>', 'warn', 6500);
    VF.bus.emit('parasite:attach', { id: id, def: def, from: from || null });
    VF.save.save();
    return true;
  }

  function detach(quiet) {
    const p = current();
    if (!p) return false;
    delete rec().flags.parasite;
    if (!quiet) {
      VF.toast.plain(p.def.name.toLowerCase() + ' has let go of the rod.', null, 4000);
    }
    VF.bus.emit('parasite:detach', p);
    VF.save.save();
    return true;
  }

  /* Called by js/systems/loot.js at the end of a roll, before anything has
     been shown. Spends a use whether or not the effect fired, so the counter
     the HUD shows is a count of casts rather than a count of successes. */
  function onRoll(c) {
    const p = current();
    if (!p) return;
    let hit = false;
    if (p.def.onRoll) {
      try { hit = !!p.def.onRoll(c); } catch (e) { hit = false; }
    }
    if (hit) c.parasite = p.id;
    const f = rec().flags.parasite;
    f.left = (f.left | 0) - 1;
    if (f.left <= 0) setTimeout(function () { detach(); }, 1200);
  }

  /* Folded into the loadout alongside charms and mods. */
  function stats(s) {
    const p = current();
    if (!p || !p.def.stats) return;
    try { p.def.stats(s); } catch (e) { /* a bad passenger must not break a cast */ }
  }

  VF.parasite = {
    kinds: KINDS,
    attach: attach, detach: detach, current: current,
    onRoll: onRoll, stats: stats
  };
})(window.VF = window.VF || {});
