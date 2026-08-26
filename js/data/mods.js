/* VOID FISHING — line, reel and hook.

   A hundred and twenty-nine rods and every one of them is a rung: cast, line,
   reel, rarity and luck all go up together, so the only question a rod ever
   asks is whether you can afford it. Two rods of the same tier play the same.

   Three slots change that. Each one trades — none of them is free, and none of
   them is strictly better than another, so a rod becomes a shape rather than a
   number. Heavy line and a slow reel is a different fight from a light line
   and a fast one, and a mid-tier rod set up for what you are actually doing
   can beat a dearer one that is set up for nothing.

   They fit any rod, they move between rods freely, and they are not consumed.
   Buying one is buying an option, not a refill. */
(function (VF) {
  'use strict';

  const SLOTS = ['line', 'reel', 'hook'];

  const SLOT_NAMES = { line: 'Line', reel: 'Reel', hook: 'Hook' };

  /* Every mod states what it does in the same four terms the fight already
     reads, so nothing new has to be threaded through the minigame:

       line   width of the white bar
       reel   how fast the bar moves, and how sharply it answers
       fill   how fast the meter climbs while the fish is held
       rare   the rarity draw
       luck   size and traits
       bite   how long the wait is

     A value of 1 is no change. */
  const LIST = [
    /* ------------------------------------------------------------ line */
    { id: 'braid', slot: 'line', name: 'Braided Line', cost: 9000, level: 8,
      mods: { line: 1.22, reel: 0.92 },
      desc: 'Thicker through the guides. A wider bar, and slower to answer you.' },

    { id: 'mono', slot: 'line', name: 'Monofilament', cost: 9000, level: 8,
      mods: { line: 0.86, reel: 1.16 },
      desc: 'Thin and quick. A narrower bar that goes exactly where you put it.' },

    { id: 'wire', slot: 'line', name: 'Wire Trace', cost: 74000, level: 26,
      mods: { line: 1.40, fill: 0.88 },
      desc: 'Nothing bites through it. A much wider bar, and the meter climbs slower ' +
            'because the fish has nothing to tire itself against.' },

    { id: 'silk', slot: 'line', name: 'Drowned Silk', cost: 420000, level: 44,
      mods: { line: 1.14, rare: 1.18, bite: 1.20 },
      desc: 'It was somebody\'s once. Rarer things find it, and they take their time.' },

    /* ------------------------------------------------------------ reel */
    { id: 'gearbox', slot: 'reel', name: 'Low Gearing', cost: 12000, level: 10,
      mods: { reel: 0.78, fill: 1.24 },
      desc: 'Slow, heavy retrieve. The bar crawls; the meter climbs fast when you hold it.' },

    { id: 'highspeed', slot: 'reel', name: 'High Gearing', cost: 12000, level: 10,
      mods: { reel: 1.30, fill: 0.86 },
      desc: 'Quick and light. The bar chases anything; holding it is worth less.' },

    { id: 'drag', slot: 'reel', name: 'Sealed Drag', cost: 96000, level: 30,
      mods: { fill: 1.16, line: 1.08, rare: 0.92 },
      desc: 'Smooth under load. Better at landing things, worse at finding them.' },

    { id: 'silentreel', slot: 'reel', name: 'The Silent Reel', cost: 560000, level: 48,
      mods: { reel: 1.12, bite: 0.74, rare: 1.10 },
      desc: 'Makes no sound at all. Things come sooner, and stranger ones come.' },

    /* ------------------------------------------------------------ hook */
    { id: 'barbless', slot: 'hook', name: 'Barbless Hook', cost: 7000, level: 6,
      mods: { fill: 0.90, luck: 0.45 },
      desc: 'Harder to hold. They come up cleaner, and bigger, and stranger.' },

    { id: 'treble', slot: 'hook', name: 'Treble Hook', cost: 7000, level: 6,
      mods: { fill: 1.18, rare: 0.90 },
      desc: 'Three chances to stay in. Whatever takes it is usually ordinary.' },

    { id: 'circle', slot: 'hook', name: 'Circle Hook', cost: 88000, level: 28,
      mods: { fill: 1.10, line: 1.06, bite: 1.14 },
      desc: 'Sets itself in the corner of the mouth. Fewer bites, and they stick.' },

    { id: 'boneHook', slot: 'hook', name: 'A Hook Of Bone', cost: 640000, level: 50,
      mods: { luck: 0.80, rare: 1.24, fill: 0.88 },
      desc: 'Older than steel and it works better than steel, which nobody likes.' }
  ];

  const BY_ID = VF.util.byId(LIST);

  function fitted() {
    const d = VF.state.data;
    if (!d.mods || typeof d.mods !== 'object' || Array.isArray(d.mods)) {
      d.mods = { line: null, reel: null, hook: null };
    }
    return d.mods;
  }

  function owned(id) { return VF.state.data.ownedMods.indexOf(id) >= 0; }

  function fit(id) {
    const m = BY_ID[id];
    if (!m || !owned(id)) return false;
    fitted()[m.slot] = id;
    VF.bus.emit('mods:changed');
    VF.save.save();
    return true;
  }

  function remove(slot) {
    if (SLOTS.indexOf(slot) < 0) return false;
    fitted()[slot] = null;
    VF.bus.emit('mods:changed');
    VF.save.save();
    return true;
  }

  function buy(id) {
    const m = BY_ID[id];
    const d = VF.state.data;
    if (!m || owned(id)) return { ok: false, why: 'owned' };
    if (d.level < m.level) return { ok: false, why: 'level' };
    if (!VF.economy.spend(m.cost, 'mod')) return { ok: false, why: 'money' };
    d.ownedMods.push(id);
    fit(id);
    VF.bus.emit('mod:bought', m);
    return { ok: true };
  }

  /* What is actually in a slot. Ownership is checked here rather than trusted
     from the slot, because the two can disagree — an older save, an edited
     one, or a slot written before the buy went through — and when they do, the
     shop draws a row that is fitted and for sale at the same time and the
     fight quietly uses a fitting nobody bought. Owning it is the truth. */
  function inSlot(slot) {
    const m = BY_ID[fitted()[slot]];
    return m && owned(m.id) ? m : null;
  }

  /* Everything fitted, multiplied together. One object, the same shape as the
     charm build, so loadout() folds it in the same way and the fight never
     learns that mods exist. */
  function stats() {
    const out = { line: 1, reel: 1, fill: 1, rare: 1, luck: 0, bite: 1 };
    SLOTS.forEach(function (slot) {
      const m = inSlot(slot);
      if (!m) return;
      for (const k in m.mods) {
        if (k === 'luck') out.luck += m.mods[k];
        else out[k] *= m.mods[k];
      }
    });
    return out;
  }

  VF.mods = {
    SLOTS: SLOTS,
    SLOT_NAMES: SLOT_NAMES,
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    fitted: fitted,
    owned: owned,
    fit: fit,
    remove: remove,
    buy: buy,
    stats: stats,
    inSlot: inSlot
  };
})(window.VF = window.VF || {});
