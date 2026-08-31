/* VOID FISHING — owning a boat.

   The boat is not a travel menu with a picture on it. It is under the angler
   in every frame of the game, it is what makes the water between two places
   into something rather than a fade, and three of its five modules are the
   only way to interact with whole zones.

   State lives in d.boat, which is null in every save that existed before this
   and is built by shape() the first time anything asks — so there is nothing
   to migrate and no version to check.

   Everything else in the expansion asks this module two questions:
     has(mod)     is that instrument fitted at all
     tierRank()   how much boat is under you                                 */
(function (VF) {
  'use strict';

  const U = VF.util;

  const DEFAULT = {
    hull: 'skiff',
    modules: { engine: 0, sonar: 0, hold: 0, survey: 0, tackle: 0 },
    paint: 'work',
    owned: ['skiff'],
    paints: ['work'],
    trim: { light: null, flag: null, deck: null },
    trims: [],
    trophies: [],          // fishdex ids displayed on deck, up to three
    wear: 0,               // 0..1 — how much of the hull the sea has had
    name: ''
  };

  function shape() {
    const d = VF.state.data;
    if (!d.boat || typeof d.boat !== 'object') {
      d.boat = JSON.parse(JSON.stringify(DEFAULT));
      VF.bus.emit('boat:changed');
    }
    const b = d.boat;
    if (!b.modules || typeof b.modules !== 'object') b.modules = { engine: 0, sonar: 0, hold: 0, survey: 0, tackle: 0 };
    if (!Array.isArray(b.owned) || !b.owned.length) b.owned = ['skiff'];
    if (!Array.isArray(b.paints) || !b.paints.length) b.paints = ['work'];
    if (!Array.isArray(b.trims)) b.trims = [];
    if (!Array.isArray(b.trophies)) b.trophies = [];
    if (!b.trim || typeof b.trim !== 'object') b.trim = { light: null, flag: null, deck: null };
    if (!VF.boatData.hull(b.hull) || b.owned.indexOf(b.hull) < 0) b.hull = b.owned[b.owned.length - 1];
    return b;
  }

  function hull() { return VF.boatData.hull(shape().hull); }
  function tierRank() { return hull().rank; }
  function can(what) { return hull().unlocks.indexOf(what) >= 0; }

  /* Level of a module, 0 if not fitted. Clamped by the hull, so moving DOWN a
     hull does not delete the levels — it just stops them counting until the
     bigger boat is back under you. */
  function level(id) {
    const b = shape();
    const cap = (hull().slots || {})[id] || 0;
    return U.clamp(b.modules[id] | 0, 0, cap);
  }
  function has(id) { return level(id) > 0; }

  /* What a module is currently worth, as the object its own `at()` returns. */
  function mod(id) {
    const def = VF.boatData.module(id);
    return def ? def.at(level(id)) : {};
  }

  /* ------------------------------------------------------------ buying */

  function ownHull(id) { return shape().owned.indexOf(id) >= 0; }

  function buyHull(id) {
    const h = VF.boatData.hull(id);
    const b = shape();
    const d = VF.state.data;
    if (!h || ownHull(id)) return false;
    if ((h.level || 0) > d.level) return false;
    if (!VF.economy.spend(h.cost, 'boat')) return false;
    b.owned.push(id);
    b.hull = id;
    b.wear = 0;
    VF.audio.stinger('grand', 5);
    VF.discovery.found('boat', h.name, h.tag);
    VF.bus.emit('boat:changed');
    VF.save.save();
    return true;
  }

  function setHull(id) {
    const b = shape();
    if (!ownHull(id) || b.hull === id) return false;
    b.hull = id;
    VF.audio.click();
    VF.bus.emit('boat:changed');
    VF.save.save();
    return true;
  }

  function buyModule(id) {
    const b = shape();
    const cap = (hull().slots || {})[id] || 0;
    const have = b.modules[id] | 0;
    if (have >= cap) return false;
    const cost = VF.boatData.modCost(id, have);
    if (!VF.economy.spend(cost, 'boat')) return false;
    b.modules[id] = have + 1;
    VF.audio.stinger('bright', 3);
    VF.bus.emit('boat:changed');
    VF.bus.emit('gear:changed');
    VF.save.save();
    return true;
  }

  function buyPaint(id) {
    const p = VF.boatData.paintOf(id);
    const b = shape();
    if (!p || b.paints.indexOf(id) >= 0) return false;
    if (!VF.economy.spend(p.cost, 'boat')) return false;
    b.paints.push(id);
    setPaint(id);
    return true;
  }
  function setPaint(id) {
    const b = shape();
    if (b.paints.indexOf(id) < 0) return false;
    b.paint = id;
    VF.audio.click();
    VF.bus.emit('boat:changed');
    VF.save.save();
    return true;
  }

  function buyTrim(id) {
    const t = VF.boatData.trimOf(id);
    const b = shape();
    if (!t || b.trims.indexOf(id) >= 0) return false;
    if (!VF.economy.spend(t.cost, 'boat')) return false;
    b.trims.push(id);
    setTrim(id);
    return true;
  }
  /* Fitting one takes the slot off whatever was in it. Passing the id that is
     already fitted takes it off, which is how you get an empty mast back. */
  function setTrim(id) {
    const t = VF.boatData.trimOf(id);
    const b = shape();
    if (!t || b.trims.indexOf(id) < 0) return false;
    b.trim[t.slot] = b.trim[t.slot] === id ? null : id;
    VF.audio.click();
    VF.bus.emit('boat:changed');
    VF.save.save();
    return true;
  }

  /* Up to three catches on deck. Not a stat — a boat that has been somewhere
     should look like it, and this is the only cosmetic in the game you earn
     by fishing rather than by paying. */
  function toggleTrophy(fishId) {
    const b = shape();
    const at = b.trophies.indexOf(fishId);
    if (at >= 0) b.trophies.splice(at, 1);
    else {
      if (!VF.state.data.fishdex[fishId]) return false;
      if (b.trophies.length >= 3) b.trophies.shift();
      b.trophies.push(fishId);
    }
    VF.audio.click();
    VF.bus.emit('boat:changed');
    VF.save.save();
    return true;
  }

  /* --------------------------------------------------------------- wear

     A crossing costs the hull something. It is not a fail state and it never
     sinks: at full wear the boat is slow, the instruments are unreliable and
     the sea events get rougher, and a repair is cheap. It exists so that
     sailing has a cost and so that "put in somewhere and fix it" is a reason
     to visit a place. */
  function integrity() {
    const h = hull();
    return U.clamp(1 - (shape().wear || 0), 0, 1);
  }

  function damage(k) {
    const b = shape();
    const m = mod('engine');
    /* How much punishment the hull itself absorbs. */
    const soak = h().integrity / 100;
    /* And the engine's share of it. A better engine is EASIER on the hull —
       the module's own description says so — so its `wear` is a multiplier on
       the damage taken. It used to multiply the soak instead, which inverted
       the whole thing: a rank-5 engine has wear 0.5, which halved the soak,
       which doubled every knock the hull took. Upgrading the engine made the
       boat twice as fragile and nothing in the interface said a word. */
    const mul = (m.wear === undefined ? 1 : Math.max(0.1, m.wear));
    const was = b.wear || 0;
    b.wear = U.clamp(was + k * mul / Math.max(0.2, soak), 0, 1);
    /* Any damage at all is a fact the world can react to; `boat:worn` is only
       the alarm at the top end and fires far too late to be a memory. */
    if (b.wear > was) VF.bus.emit('boat:damaged', { wear: b.wear, was: was, by: k });
    if (b.wear > 0.85) VF.bus.emit('boat:worn', b.wear);
    return b.wear;
  }
  function h() { return hull(); }

  function repairCost() {
    const b = shape();
    /* The mechanic has seen you bring it back like this twice now and has
       decided not to charge you for it. Nothing announced this and nothing
       will — the bill is simply not there, once. See js/data/chains.js. */
    if (VF.chains && VF.chains.fact('repair_owed')) return 0;
    return Math.round(hull().cost * 0.04 * (b.wear || 0)) + Math.round(300 * (b.wear || 0) * 10);
  }
  function repair() {
    const b = shape();
    if ((b.wear || 0) <= 0.001) return false;
    const cost = repairCost();
    if (cost > 0 && !VF.economy.spend(cost, 'boat')) return false;
    /* Once. He is not running a charity and the second free one would turn a
       gesture into a mechanic. */
    if (VF.chains) VF.chains.clearFact('repair_owed');
    b.wear = 0;
    VF.audio.stinger('soft', 2);
    VF.bus.emit('boat:changed');
    VF.save.save();
    return true;
  }

  /* --------------------------------------------------- what it is worth

     Folded into the loadout the same way a charm is, so a fully fitted deck
     is a real build rather than a second parallel stat system. */
  function stats(s) {
    const t = mod('tackle');
    if (t.bar) s.barSize *= t.bar;
    if (t.line) s.line *= t.line;
    const sv = mod('survey');
    if (sv.clues) s.secret *= 1 + sv.clues;
    // a worn hull is a worse platform to fish from, which is the whole cost
    const w = integrity();
    if (w < 1) { s.barSize *= U.lerp(0.88, 1, w); s.bite *= U.lerp(0.90, 1, w); }
  }

  /* How many kept catches the hold allows on top of the base. */
  function keepBonus() { return mod('hold').keep || 0; }

  /* Is there a boat under the angler at all? Everything visual asks this. */
  function afloat() {
    const d = VF.state.data;
    return !!(d.boat && d.boat.owned && d.stats.casts > 0);
  }

  VF.boat = {
    shape: shape, hull: hull, tierRank: tierRank, can: can,
    level: level, has: has, mod: mod,
    ownHull: ownHull, buyHull: buyHull, setHull: setHull,
    buyModule: buyModule,
    buyPaint: buyPaint, setPaint: setPaint,
    buyTrim: buyTrim, setTrim: setTrim,
    toggleTrophy: toggleTrophy,
    integrity: integrity, damage: damage, repair: repair, repairCost: repairCost,
    stats: stats, keepBonus: keepBonus, afloat: afloat,
    paint: function () { return VF.boatData.paintOf(shape().paint); },
    speed: function () {
      return hull().speed * (mod('engine').speed || 1) * U.lerp(0.7, 1, integrity());
    }
  };
})(window.VF = window.VF || {});
