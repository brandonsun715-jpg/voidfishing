/* VOID FISHING — levels, XP and unlocks.
   Curve is tuned so the early game moves fast and the deep locations arrive
   at a steady clip rather than after an hour of grinding. */
(function (VF) {
  'use strict';

  const MAX_LEVEL = 99;

  function xpForLevel(n) {
    return Math.round(30 * Math.pow(n, 1.72));
  }
  function xpToNext() { return xpForLevel(VF.state.data.level); }

  /* Past the cap the ladder is over, but the fishing is not — and the last
     gate in the game is a rod at level 84, so a capped player who kept fishing
     used to be pouring experience into a number that had stopped reading it.
     Overflow becomes reputation instead, which is already the quiet luck track
     the release button feeds, so the top of the curve keeps paying into
     something the loot roll can actually see. */
  const OVERFLOW_PER_REP = 900;

  function addXp(amount) {
    const d = VF.state.data;
    if (d.level >= MAX_LEVEL) return { levels: 0, rep: overflow(amount) };
    d.xp += amount;
    let gained = 0;
    while (d.level < MAX_LEVEL && d.xp >= xpForLevel(d.level)) {
      d.xp -= xpForLevel(d.level);
      d.level++;
      gained++;
    }
    let rep = 0;
    // the level that caps carries its remainder over rather than dropping it
    if (d.level >= MAX_LEVEL && d.xp > 0) { rep = overflow(d.xp); d.xp = 0; }
    if (gained) {
      const unlocked = checkUnlocks();
      VF.bus.emit('level:up', { level: d.level, gained: gained, unlocked: unlocked });
    }
    return { levels: gained, rep: rep };
  }

  /* Fractional remainder is kept, so a small catch at the cap is never worth
     exactly nothing — it is worth a fraction of a point that the next one
     finishes off. */
  function overflow(xp) {
    const d = VF.state.data;
    if (!(xp > 0)) return 0;
    d.xpOverflow = (d.xpOverflow || 0) + xp;
    const whole = Math.floor(d.xpOverflow / OVERFLOW_PER_REP);
    if (whole <= 0) return 0;
    d.xpOverflow -= whole * OVERFLOW_PER_REP;
    d.reputation += whole;
    VF.bus.emit('reputation:overflow', { rep: whole });
    return whole;
  }

  /* How far through the current point the overflow sits, for the HUD. */
  function overflowFrac() {
    const d = VF.state.data;
    return ((d.xpOverflow || 0) % OVERFLOW_PER_REP) / OVERFLOW_PER_REP;
  }

  /* Returns the list of things that became available at the new level. */
  function checkUnlocks() {
    const d = VF.state.data;
    const out = { locations: [], rods: [], baits: [] };
    for (let i = 0; i < VF.locations.list.length; i++) {
      const l = VF.locations.list[i];
      if (d.level >= l.level && d.unlockedLocations.indexOf(l.id) < 0) {
        d.unlockedLocations.push(l.id);
        out.locations.push(l);
      }
    }
    for (let i = 0; i < VF.rods.list.length; i++) {
      const r = VF.rods.list[i];
      if (d.level === r.level) out.rods.push(r);
    }
    for (let i = 0; i < VF.bait.list.length; i++) {
      const b = VF.bait.list[i];
      if (d.level === b.level) out.baits.push(b);
    }
    return out;
  }

  /* Aggregate luck from rod + bait + weather + reputation. Feeds size & mutation rolls. */
  /* Reputation used to hit a wall at 480 and stop meaning anything, which
     also meant capped-level overflow would have been paying into a dead
     number. A saturating curve keeps the first few hundred points feeling the
     same as they always did — 480 still lands near 1.2 — and then keeps
     paying, slower and slower, without ever running away. */
  function repLuck(rep) {
    if (!(rep > 0)) return 0;
    return 2.6 * (1 - Math.exp(-rep / 640));
  }

  function luck() {
    const d = VF.state.data;
    const rod = VF.rods.get(d.rod);
    const bait = VF.bait.get(d.bait);
    return rod.luck + bait.luck + VF.weather.luck() + repLuck(d.reputation);
  }

  /* Aggregate rare-tier multiplier. */
  function rareMult() {
    const d = VF.state.data;
    return VF.rods.get(d.rod).rare * VF.bait.get(d.bait).rare *
           VF.weather.rare() * VF.locations.current().rarityBoost;
  }

  VF.progression = {
    MAX_LEVEL: MAX_LEVEL,
    OVERFLOW_PER_REP: OVERFLOW_PER_REP,
    xpForLevel: xpForLevel,
    xpToNext: xpToNext,
    addXp: addXp,
    checkUnlocks: checkUnlocks,
    luck: luck,
    repLuck: repLuck,
    overflowFrac: overflowFrac,
    atCap: function () { return VF.state.data.level >= MAX_LEVEL; },
    rareMult: rareMult
  };
})(window.VF = window.VF || {});
