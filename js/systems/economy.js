/* VOID FISHING — money in, money out. */
(function (VF) {
  'use strict';

  function earn(amount, reason) {
    amount = Math.max(0, Math.round(amount));
    if (!amount) return 0;
    const d = VF.state.data;
    d.money += amount;
    d.stats.earned += amount;
    VF.bus.emit('money:changed', { delta: amount, reason: reason || '' });
    return amount;
  }

  function canAfford(cost) { return VF.state.data.money >= cost; }

  function spend(cost, reason) {
    cost = Math.max(0, Math.round(cost));
    const d = VF.state.data;
    if (d.money < cost) return false;
    d.money -= cost;
    d.stats.spent += cost;
    VF.bus.emit('money:changed', { delta: -cost, reason: reason || '' });
    return true;
  }

  function buyRod(id) {
    const rod = VF.rods.get(id);
    const d = VF.state.data;
    if (!rod || d.ownedRods.indexOf(id) >= 0) return { ok: false, why: 'owned' };
    if (d.level < rod.level) return { ok: false, why: 'level' };
    if (rod.requiresVoidCatch && d.stats.voidCatches < 1) return { ok: false, why: 'void' };
    if (rod.requiresGlitchCatch && (d.stats.glitchCatches | 0) < 1) return { ok: false, why: 'glitch' };
    if (rod.requiresSecret && !VF.secrets.found(rod.requiresSecret)) return { ok: false, why: 'secret' };
    if (!spend(rod.cost, 'rod')) return { ok: false, why: 'money' };
    d.ownedRods.push(id);
    d.rod = id;
    VF.bus.emit('rod:bought', rod);
    VF.save.save();
    return { ok: true };
  }

  function buyBait(id, packs) {
    const bait = VF.bait.get(id);
    const d = VF.state.data;
    packs = Math.max(1, packs | 0);
    if (!bait || bait.unlimited) return { ok: false, why: 'free' };
    if (d.level < bait.level) return { ok: false, why: 'level' };
    const cost = bait.cost * packs;
    if (!spend(cost, 'bait')) return { ok: false, why: 'money' };
    VF.bait.add(id, bait.pack * packs);
    VF.bus.emit('bait:bought', { bait: bait, packs: packs });
    VF.save.save();
    return { ok: true, amount: bait.pack * packs };
  }

  VF.economy = { earn: earn, spend: spend, canAfford: canAfford, buyRod: buyRod, buyBait: buyBait };
})(window.VF = window.VF || {});
