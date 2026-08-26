/* VOID FISHING — chartering the water.
   Late on, Jias stop having anywhere to go. Rods cap out, bait is loose
   change, the charms are a finite list, and cases are cosmetic by design — so
   selling, keeping and releasing collapse into the same shrug.

   This is where the money goes. Conditions are the strongest thing in the
   game and the only thing you cannot influence; paying to bring one on turns
   a pile of Jias into the one lever that was missing.

   The price does two things at once. It scales with level, so it is always a
   real fraction of what you earn rather than loose change at 80 and a wall at
   20. And each charter leaves a surcharge that decays over about ten minutes
   of real time, so the answer to "can I just keep buying Thin Places" is yes,
   at a price that climbs faster than you can fish. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const SURCHARGE_STEP = 0.62;   // what one charter adds to the multiplier
  const SURCHARGE_TAU = 380;     // seconds for that to fall back off
  const SURCHARGE_MAX = 7.5;

  let surcharge = 0;             // runtime only: it does not survive a reload

  function tick(dt) {
    if (surcharge > 0) surcharge = Math.max(0, surcharge - dt / SURCHARGE_TAU * (1 + surcharge));
  }

  /* How much a condition is actually worth having. Read off its own modifiers
     rather than hand-priced, so a new condition in the data file gets a
     sensible price without anyone touching this file. */
  function power(c) {
    const m = c.mods || {};
    let p = 1;
    // a bite modifier below 1 means bites come sooner, which is worth paying for
    if (m.bite !== undefined) p *= m.bite < 1 ? (1 + (1 - m.bite) * 0.9) : (1 + (m.bite - 1) * 0.5);
    ['rare', 'trait', 'treasure', 'encounter', 'size', 'value', 'secret', 'void'].forEach(function (k) {
      if (m[k] !== undefined && m[k] > 1) p *= 1 + (m[k] - 1) * (k === 'rare' ? 1.15 : 0.55);
    });
    return p;
  }

  function price(c) {
    const d = VF.state.data;
    const base = 620 + d.level * d.level * 2.4;
    return Math.max(150, Math.round(base * Math.pow(power(c), 1.35) * (1 + surcharge)));
  }

  /* The conditions this stretch of water will actually do — the same filter
     the natural roll uses, so nothing can be bought here that could not have
     turned up on its own. */
  function offered() {
    const li = VF.locations.index(VF.state.data.location);
    const d = VF.state.data;
    return VF.conditionData.list.filter(function (c) {
      if (c.minLoc && li < c.minLoc) return false;
      if (c.test) { try { return !!c.test(d); } catch (e) { return false; } }
      return true;
    });
  }

  function blocked() {
    if (VF.conditions.current()) return 'busy';
    const st = VF.fishing.state();
    if (st === 'reeling' || st === 'bite') return 'fishing';
    return null;
  }

  function buy(id) {
    const c = VF.conditionData.get(id);
    if (!c) return { ok: false, why: 'missing' };
    const block = blocked();
    if (block) return { ok: false, why: block };
    if (offered().indexOf(c) < 0) return { ok: false, why: 'nothere' };

    const cost = price(c);
    if (!VF.economy.spend(cost, 'charter')) return { ok: false, why: 'money' };

    surcharge = Math.min(SURCHARGE_MAX, surcharge + SURCHARGE_STEP);
    const d = VF.state.data;
    d.charters = (d.charters | 0) + 1;
    d.stats.chartered = (d.stats.chartered | 0) + 1;

    VF.conditions.start(id);
    VF.bus.emit('charter:bought', { cond: c, cost: cost });
    VF.save.save();
    return { ok: true, cost: cost, cond: c };
  }

  VF.charter = {
    tick: tick,
    offered: offered,
    price: price,
    power: power,
    blocked: blocked,
    buy: buy,
    surcharge: function () { return surcharge; }
  };
})(window.VF = window.VF || {});
