/* VOID FISHING — what happens after the fish is on the bank.
   Sell for money, keep for the collection, or release for reputation. */
(function (VF) {
  'use strict';

  /* HOW MANY YOU CAN KEEP.

     This was a hardcoded 200, and the hold module — fourteen thousand Jia,
     with "every level is five more kept catches" written on the tin — added
     nothing to it, because nobody ever put the two numbers together. Two
     hundred is also not a ceiling anybody reaches, so the module's entire
     selling point was invisible twice over.

     Sixty is a ceiling a mid-game player meets. A save already over it keeps
     everything it has and simply cannot add — every caller tests `>=`, so
     that falls out for free and nothing is ever thrown away. */
  const KEEP_BASE = 60;
  function keepLimit() {
    return KEEP_BASE + (VF.boat ? VF.boat.keepBonus() : 0);
  }

  function last() { return VF.fishing.S.lastResult; }

  function sell() {
    const c = last();
    if (!c) return null;
    if (VF.runs && !VF.runs.sellAllowed()) return null;
    const d = VF.state.data;
    VF.economy.earn(c.value, 'catch');
    d.stats.sold++;
    VF.audio.sell();
    VF.bus.emit('catch:sold', c);
    VF.fishing.resolveCatch();
    VF.save.save();
    return c.value;
  }

  function keep() {
    const c = last();
    if (!c) return false;
    const d = VF.state.data;
    d.kept.push({
      id: c.id, kg: c.kg, m: c.m, pct: c.pct,
      /* The whole list, not just the first. A four-trait fish went into the
         bag as a one-trait fish and stayed that way — and the bag is the only
         place a catch survives as an object rather than a tally, so that was
         the sole record of a combination and it was lossy. The stored value
         was still the four-trait price, so the row showed a plain fish worth
         an inexplicable amount. */
      traits: (c.traits || []).slice(),
      mutation: c.mutation, value: c.value, at: c.at, location: c.location,
      rarity: c.rarity,
      /* The rest of the evening. A kept fish is the only thing in the game
         that survives as an object rather than a tally, and the aquarium reads
         every one of these off the plate under the glass — so a catch that
         does not carry them is a specimen with no provenance. Old saves have
         none of it and the aquarium says "unrecorded" rather than guessing. */
      weather: c.weather, time: c.time, bait: c.bait, rod: c.rod
    });
    if (d.kept.length > keepLimit()) d.kept.shift();
    VF.audio.click();
    VF.bus.emit('catch:kept', c);
    VF.fishing.resolveCatch();
    VF.save.save();
    return true;
  }

  /* Releasing trades money for reputation, which quietly raises luck.
     Occasionally the void says thank you. */
  function release() {
    const c = last();
    if (!c) return null;
    const d = VF.state.data;
    const rank = VF.rarities.rank(c.rarity);
    const rep = 1 + rank * 2;
    d.reputation += rep;
    d.stats.released++;
    VF.audio.release();

    let bonus = null;
    const roll = VF.rng.g();
    if (roll < 0.07) {
      // a handful of whatever bait the player can currently use
      const usable = VF.bait.available().filter(function (b) { return !b.unlimited && d.level >= b.level; });
      if (usable.length) {
        const b = usable[Math.min(usable.length - 1, VF.rng.g.int(Math.max(0, usable.length - 3), usable.length - 1))];
        const n = b.pack;
        VF.bait.add(b.id, n);
        bonus = { kind: 'bait', text: n + ' x ' + b.name };
      }
    } else if (roll < 0.13) {
      const amt = Math.round(c.value * VF.rng.g.range(0.25, 0.6));
      if (amt > 0) { VF.economy.earn(amt, 'gratitude'); bonus = { kind: 'money', amount: amt }; }
    }

    VF.bus.emit('catch:released', { catch: c, rep: rep, bonus: bonus });
    VF.fishing.resolveCatch();
    VF.save.save();
    return { rep: rep, bonus: bonus };
  }

  /* Selling from the Bag, after the fact. */
  function sellKept(index) {
    if (VF.runs && !VF.runs.sellAllowed()) return 0;
    const d = VF.state.data;
    if (index < 0 || index >= d.kept.length) return 0;
    const k = d.kept.splice(index, 1)[0];
    VF.economy.earn(k.value, 'kept');
    d.stats.sold++;
    VF.audio.sell();
    VF.save.save();
    return k.value;
  }

  function sellAllKept() {
    if (VF.runs && !VF.runs.sellAllowed()) return 0;
    const d = VF.state.data;
    let total = 0;
    for (let i = 0; i < d.kept.length; i++) total += d.kept[i].value;
    if (!total) return 0;
    d.stats.sold += d.kept.length;
    d.kept.length = 0;
    VF.economy.earn(total, 'kept');
    VF.audio.sell();
    VF.save.save();
    return total;
  }

  VF.catches = { sell: sell, keep: keep, release: release, sellKept: sellKept,
                 sellAllKept: sellAllKept, keepLimit: keepLimit, KEEP_BASE: KEEP_BASE,
                 /* kept as an accessor so the two existing call sites read the
                    live number rather than a frozen one */
                 get KEEP_LIMIT() { return keepLimit(); } };
})(window.VF = window.VF || {});
