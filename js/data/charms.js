/* VOID FISHING — charms and relics.
   These are the build layer. Rods and bait are raw power; charms are where a
   loadout gets a shape, and almost every one of them costs you something.
   Charms are bought. Relics are found, and are stronger and stranger. */
(function (VF) {
  'use strict';

  /* Stat keys, all multiplicative around 1 except `slots`:
       luck rare value xp bite reel line size trait treasure encounter void  */

  const LIST = [
    /* ------------------------------------------------------------ charms */
    { id: 'moon', name: 'Moon Charm', kind: 'charm', rarity: 'uncommon', cost: 4200, level: 6,
      desc: 'Cold to hold. Works best when nothing is looking.',
      note: 'stronger at night, weaker in daylight',
      stats: { luck: 0.35, rare: 1.20 },
      dynamic: function (s) {
        const night = VF.time.phase() === 'night' || VF.time.phase() === 'dawn';
        s.rare *= night ? 1.25 : 0.82;
        s.luck += night ? 0.35 : -0.10;
      } },

    { id: 'goldhook', name: 'Golden Hook', kind: 'charm', rarity: 'rare', cost: 26000, level: 12,
      desc: 'Bent from something that was already valuable.',
      note: 'catches are worth far more, but bite far less often',
      stats: { value: 1.55, bite: 1.38, rare: 1.05 } },

    { id: 'compass', name: 'Broken Compass', kind: 'charm', rarity: 'rare', cost: 34000, level: 14,
      desc: 'The needle settles eventually. Never on north.',
      note: 'far rarer catches, but the line takes much longer to find them',
      stats: { rare: 1.65, bite: 1.55, encounter: 1.30 } },

    { id: 'sinker', name: 'Lead Sinker', kind: 'charm', rarity: 'uncommon', cost: 6800, level: 8,
      desc: 'Drops fast and lands hard. Nothing subtle about it.',
      note: 'bites arrive quickly, but what bites is more ordinary',
      stats: { bite: 0.66, rare: 0.80, reel: 1.12 } },

    { id: 'tooth', name: 'Ancient Tooth', kind: 'charm', rarity: 'epic', cost: 180000, level: 22,
      desc: 'Not from anything in the catalogue. Still sharp.',
      note: 'much larger fish, and they fight far harder',
      stats: { size: 1.40, trait: 1.35, line: 0.80 } },

    { id: 'lure', name: 'Whistling Lure', kind: 'charm', rarity: 'uncommon', cost: 9500, level: 10,
      desc: 'Makes a sound underwater that carries a very long way.',
      note: 'fast bites and quick reeling, at the cost of value',
      stats: { bite: 0.74, reel: 1.28, value: 0.86 } },

    { id: 'lens', name: 'Salt Lens', kind: 'charm', rarity: 'rare', cost: 48000, level: 16,
      desc: 'Everything seen through it is slightly further away than it is.',
      note: 'more experience and better odds, at the cost of line strength',
      stats: { xp: 1.45, rare: 1.18, line: 0.86 } },

    { id: 'net', name: 'Fine Mesh', kind: 'charm', rarity: 'uncommon', cost: 12000, level: 11,
      desc: 'Catches things the hook would have missed entirely.',
      note: 'far more objects come up, and slightly fewer fish',
      stats: { treasure: 3.2, rare: 0.92 } },

    { id: 'bell', name: 'Drowned Bell', kind: 'charm', rarity: 'epic', cost: 320000, level: 26,
      desc: 'Rings once when something enormous passes beneath you.',
      note: 'strange encounters far more often, in exchange for value',
      stats: { encounter: 2.4, rare: 1.22, value: 0.78 } },

    { id: 'scale', name: 'Prism Scale', kind: 'charm', rarity: 'epic', cost: 420000, level: 28,
      desc: 'Shed by something that had a great many of them.',
      note: 'traits appear far more often, and fish run smaller',
      stats: { trait: 2.6, size: 0.84 } },

    /* ------------------------------------------------------------ relics
       Found, never sold. Slot cost 1 like a charm but the effects are larger
       and the drawbacks are real. */
    { id: 'voidfrag', name: 'Void Fragment', kind: 'relic', rarity: 'legendary', found: true,
      desc: 'A piece of the place where the water stops being water.',
      note: 'opens the deep tiers, and everything ordinary avoids you',
      stats: { void: 2.2, rare: 1.45, bite: 1.22, value: 1.15 } },

    { id: 'eye', name: 'Unknown Eye', kind: 'relic', rarity: 'mythic', found: true,
      desc: 'It is open. It was open when you found it.',
      note: 'sees what is coming — enormous odds, at a heavy cost to the line',
      stats: { rare: 1.9, trait: 1.8, encounter: 1.6, line: 0.62, bite: 1.15 } },

    { id: 'hookring', name: 'Ring Of Hooks', kind: 'relic', rarity: 'epic', found: true,
      desc: 'Twelve hooks welded into a circle. All of them used.',
      note: 'holds anything, but nothing rare comes near it',
      stats: { line: 1.75, reel: 1.25, rare: 0.72 } },

    { id: 'fossil', name: 'Fossil Heart', kind: 'relic', rarity: 'legendary', found: true,
      desc: 'Still faintly warm after all this time.',
      note: 'draws the old and the enormous',
      stats: { size: 1.55, trait: 1.45, xp: 1.3, bite: 1.30 } },

    { id: 'lantern', name: "Drifter's Lantern", kind: 'relic', rarity: 'epic', found: true,
      desc: 'The flame is the wrong colour and does not move.',
      note: 'reveals hidden water, and the light keeps the shy ones away',
      stats: { secret: 2.4, treasure: 1.8, encounter: 1.35, rare: 0.88 } },

    { id: 'coin', name: 'Tideworn Coin', kind: 'relic', rarity: 'rare', found: true,
      desc: 'Currency of somewhere that no longer takes payment.',
      note: 'everything sells for more',
      stats: { value: 1.65, xp: 0.88 } }
  ];

  const BY_ID = VF.util.byId(LIST);

  /* Slots open up as the player levels, so a build gets more expressive rather
     than just stronger. */
  const SLOT_LEVELS = [6, 14, 26, 42, 58];
  function slotCount() {
    const lv = VF.state.data.level;
    let n = 0;
    for (let i = 0; i < SLOT_LEVELS.length; i++) if (lv >= SLOT_LEVELS[i]) n++;
    return n;
  }
  function nextSlotLevel() {
    const lv = VF.state.data.level;
    for (let i = 0; i < SLOT_LEVELS.length; i++) if (lv < SLOT_LEVELS[i]) return SLOT_LEVELS[i];
    return null;
  }

  function owned(id) { return VF.state.data.charms.indexOf(id) >= 0; }
  function equipped() {
    return VF.state.data.charmSlots.filter(function (x) { return !!x; });
  }
  function isEquipped(id) { return VF.state.data.charmSlots.indexOf(id) >= 0; }

  function grant(id) {
    const d = VF.state.data;
    if (!BY_ID[id] || owned(id)) return false;
    d.charms.push(id);
    VF.bus.emit('charm:found', BY_ID[id]);
    return true;
  }

  function equip(id, slot) {
    const d = VF.state.data;
    if (!owned(id)) return false;
    const max = slotCount();
    if (slot === undefined || slot < 0 || slot >= max) {
      slot = d.charmSlots.findIndex(function (x, i) { return i < max && !x; });
      if (slot < 0) slot = 0;
    }
    const already = d.charmSlots.indexOf(id);
    if (already >= 0) d.charmSlots[already] = null;
    d.charmSlots[slot] = id;
    VF.bus.emit('charm:changed');
    return true;
  }

  function unequip(slot) {
    const d = VF.state.data;
    if (slot < 0 || slot >= d.charmSlots.length) return;
    d.charmSlots[slot] = null;
    VF.bus.emit('charm:changed');
  }

  VF.charms = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    slotCount: slotCount, nextSlotLevel: nextSlotLevel, SLOT_LEVELS: SLOT_LEVELS,
    owned: owned, equipped: equipped, isEquipped: isEquipped,
    grant: grant, equip: equip, unequip: unequip
  };
})(window.VF = window.VF || {});
