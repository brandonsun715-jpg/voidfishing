/* VOID FISHING — the admin console.
   Everything in the game, grantable. This exists so the content can be looked
   at without playing forty hours to reach it: every rod, every finish, every
   charm, every spot, every object, and a way to put a named species with named
   traits on the end of the line.

   Two rules it keeps to. It only ever calls the same grant and unlock paths
   the game itself uses, so nothing it hands over is shaped differently from
   the earned version and nothing it does can leave the save in a state the
   sanitiser has not seen. And it marks the save the moment it is used, so a
   record that had help says so on the statistics page rather than quietly
   passing for an honest one.

   Opened with the backtick key, or from Settings. `VF.admin` is also on the
   console for anyone who would rather type. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Anything that hands out something the player has not earned trips this.
     Reading the state is free; changing it is not. */
  function touch() {
    const d = VF.state.data;
    if (!d.flags.adminUsed) {
      d.flags.adminUsed = true;
      VF.bus.emit('admin:used');
    }
  }

  /* A bulk grant runs a dozen of these in a row, and the toast rail holds four
     — so the last four would be all you saw, and none of them the one that
     mattered. Bulk operations go quiet and say one thing at the end. */
  let quiet = 0;

  function ok(text, n) {
    VF.save.save();
    VF.bus.emit('admin:changed');
    if (text && !quiet) VF.toast.plain(text, 'good', 2400);
    return n === undefined ? true : n;
  }

  function silently(fn) {
    quiet++;
    try { return fn(); } finally { quiet--; }
  }

  /* ------------------------------------------------------------ currency */

  function money(n) {
    n = Math.round(+n || 0);
    touch();
    const d = VF.state.data;
    if (n >= 0) VF.economy.earn(n, 'admin');
    else d.money = Math.max(0, d.money + n);
    VF.hud.refreshAll();
    return ok('◈ ' + U.money(Math.abs(n)) + (n < 0 ? ' removed' : ' granted'));
  }

  function level(n) {
    n = U.clamp(Math.floor(+n || 1), 1, VF.progression.MAX_LEVEL);
    touch();
    const d = VF.state.data;
    d.level = n;
    d.xp = 0;
    VF.progression.checkUnlocks();
    VF.bus.emit('level:up', { level: n, gained: 0, unlocked: { locations: [], rods: [], baits: [] } });
    VF.hud.refreshAll();
    return ok('level ' + n);
  }

  function xp(n) { touch(); VF.progression.addXp(Math.max(0, +n || 0)); VF.hud.refreshAll(); return ok('+' + U.commas(n) + ' xp'); }
  function reputation(n) { touch(); VF.state.data.reputation = Math.max(0, VF.state.data.reputation + (+n || 0)); return ok('reputation ' + Math.round(VF.state.data.reputation)); }
  function tokens(n) { touch(); VF.state.data.caseTokens = Math.max(0, VF.state.data.caseTokens + Math.floor(+n || 0)); return ok(VF.state.data.caseTokens + ' keys'); }

  /* ---------------------------------------------------------------- gear */

  function rod(id) {
    if (!VF.rods.get(id) || VF.rods.get(id).id !== id) return false;
    touch();
    VF.rods.grant(id);
    VF.hud.refreshAll();
    return ok(VF.rods.get(id).name);
  }

  function allRods() {
    touch();
    let n = 0;
    // the wanderer's hundred are appended to the same list once loaded, so
    // this covers his stock too rather than only the shelf
    VF.rods.list.forEach(function (r) { if (VF.rods.grant(r.id)) n++; });
    VF.hud.refreshAll();
    return ok(n + ' rods granted', n);
  }

  function bait(id, n) {
    const b = VF.bait.get(id);
    if (!b || b.id !== id) return false;
    touch();
    if (b.unlimited) return ok(b.name + ' is already endless');
    VF.bait.add(id, Math.max(1, Math.floor(+n || b.pack)));
    VF.hud.refreshAll();
    return ok(b.name + ' ×' + VF.bait.count(id));
  }

  function allBait(n) {
    touch();
    let c = 0;
    VF.bait.list.forEach(function (b) {
      if (b.unlimited) return;
      VF.bait.add(b.id, Math.max(1, Math.floor(+n || 250)));
      c++;
    });
    VF.hud.refreshAll();
    return ok(c + ' baits topped up', c);
  }

  function charm(id) {
    if (!VF.charms.get(id)) return false;
    touch();
    const got = VF.charms.grant(id);
    return ok(got ? VF.charms.get(id).name : 'already owned');
  }

  function allCharms() {
    touch();
    let n = 0;
    VF.charms.list.forEach(function (c) { if (VF.charms.grant(c.id)) n++; });
    return ok(n + ' charms and relics granted', n);
  }

  /* ----------------------------------------------------------- cosmetics */

  function cosmetic(id) {
    const c = VF.cosmetics.get(id);
    if (!c) return false;
    touch();
    const got = VF.cosmetics.grant(id);
    return ok(got ? c.name : 'already owned');
  }

  /* Grant a whole slot at once — every rod finish, every bobber, and so on. */
  function slot(slotId) {
    const list = VF.cosmetics.inSlot(slotId);
    if (!list.length) return false;
    touch();
    let n = 0;
    list.forEach(function (c) { if (VF.cosmetics.grant(c.id)) n++; });
    const def = VF.cosmetics.slots.filter(function (s) { return s.id === slotId; })[0];
    const name = def ? def.name : slotId;
    // "rod finish" pluralises to "rod finishes", not "rod finishs"
    const many = name + (/(s|x|z|ch|sh)$/.test(name) ? 'es' : 's');
    return ok(n + ' ' + (n === 1 ? name : many) + ' granted', n);
  }

  function allCosmetics() {
    touch();
    let n = 0;
    // including the five that only ever turn up in the water
    VF.cosmetics.list.forEach(function (c) { if (VF.cosmetics.grant(c.id)) n++; });
    return ok(n + ' cosmetics granted', n);
  }

  /* ------------------------------------------------------------- world */

  function location(id) {
    const d = VF.state.data;
    if (!VF.locations.isRegistered(id)) {
      // a secret spot has to be discovered before it is anywhere at all
      const s = VF.secrets.list.filter(function (x) { return x.loc.id === id; })[0];
      if (!s) return false;
      touch();
      VF.secrets.discover(s.id);
    }
    touch();
    if (d.unlockedLocations.indexOf(id) < 0) d.unlockedLocations.push(id);
    if (d.seenLocations.indexOf(id) < 0) d.seenLocations.push(id);
    return ok(VF.locations.get(id).name + ' unlocked');
  }

  function allLocations() {
    touch();
    const d = VF.state.data;
    VF.secrets.list.forEach(function (s) { if (!VF.secrets.found(s.id)) VF.secrets.discover(s.id); });
    VF.locations.list.forEach(function (l) {
      if (d.unlockedLocations.indexOf(l.id) < 0) d.unlockedLocations.push(l.id);
      if (d.seenLocations.indexOf(l.id) < 0) d.seenLocations.push(l.id);
    });
    VF.loot.invalidatePool();
    return ok('every spot open, hidden ones included');
  }

  function treasure(id) {
    const t = VF.treasureData.get ? VF.treasureData.get(id) : null;
    if (!t) return false;
    touch();
    const d = VF.state.data;
    d.treasures[id] = (d.treasures[id] | 0) + 1;
    d.stats.treasuresFound++;
    if (t.journal) VF.journal.add(t.journal);
    if (t.token) d.caseTokens++;
    if (t.relic) VF.charms.grant(t.relic);
    if (t.rod) VF.rods.grant(t.rod);
    return ok(t.name);
  }

  function allTreasure() {
    touch();
    let n = 0;
    silently(function () { VF.treasureData.list.forEach(function (t) { treasure(t.id); n++; }); });
    return ok(n + ' objects logged', n);
  }

  function achievements() {
    touch();
    const d = VF.state.data;
    let n = 0;
    VF.achievementData.list.forEach(function (a) {
      if (d.achievements[a.id]) return;
      d.achievements[a.id] = Date.now();
      n++;
    });
    return ok(n + ' achievements unlocked', n);
  }

  /* ------------------------------------------------------------- weather */

  function weather(id) {
    const w = VF.weatherData.get(id);
    if (!w) return false;
    touch();
    VF.weather.force(id);
    return ok(w.name);
  }

  function condition(id) {
    touch();
    VF.conditions.end();
    const r = VF.conditions.start(id);
    return r ? ok(VF.conditions.name()) : false;
  }

  /* The HUD clock maps the 0..1 cycle onto a 24h face a quarter-turn round;
     this is that mapping run backwards so an hour can be asked for directly. */
  function clock(hour) {
    touch();
    const h = U.clamp(+hour || 0, 0, 23.99);
    VF.time.setCycle((h / 24 - 0.25 + 1) % 1);
    return ok('the hour is ' + (Math.floor(h) < 10 ? '0' : '') + Math.floor(h) + ':00');
  }

  /* --------------------------------------------------- putting one on the line

     The one hook into the fishing loop. Everything is optional: a species, a
     floor on the tier, a size percentile, an exact list of traits. Whatever is
     left unset is rolled the way it always is. */

  function spawn(opts) {
    opts = opts || {};
    const out = {};
    if (opts.fish) out.forceFish = opts.fish;
    if (opts.rarity) {
      const r = VF.rarities.get(opts.rarity);
      if (r) out.minRank = r.rank;
    }
    if (opts.size !== undefined && opts.size !== null) out.forceSize = U.clamp(+opts.size, 0, 1);
    if (opts.traits && opts.traits.length) out.forceTraits = opts.traits.slice();
    if (opts.traitBoost) out.traitBoost = +opts.traitBoost;
    out.delay = opts.delay === undefined ? 1.0 : +opts.delay;

    touch();
    VF.fishing.forceNext(out);
    const what = opts.fish ? (VF.fish.byId(opts.fish) || {}).name
      : opts.rarity ? VF.rarities.get(opts.rarity).name + ' or better'
      : 'the next one';
    VF.toast.plain('armed: ' + what + ' — cast', 'good', 3200);
    return true;
  }

  function clearSpawn() { VF.fishing.forceNext(null); return ok('nothing armed'); }

  /* -------------------------------------------------------- the whole lot */

  function everything() {
    touch();
    const got = silently(function () {
      level(VF.progression.MAX_LEVEL);
      money(50000000);
      allLocations();
      const rods = allRods();
      const charms = allCharms();
      const cos = allCosmetics();
      allBait(999);
      allTreasure();
      tokens(50);
      const ach = achievements();
      return { rods: rods, charms: charms, cos: cos, ach: ach };
    });
    VF.hud.refreshAll();
    VF.toast.show('<strong>everything</strong><br><span style="color:var(--ink-3)">' +
      got.rods + ' rods · ' + got.cos + ' cosmetics · ' + got.charms + ' charms · ' +
      got.ach + ' achievements</span>', 'good', 5200);
    return ok(null);
  }

  /* --------------------------------------------------------------- undo-ish
     Not a rollback — there is no history — but a way to put a specific
     category back to nothing without wiping the save. */

  function clearCosmetics() { touch(); VF.state.data.cosmetics = []; VF.state.data.equipped = {}; return ok('cosmetics cleared'); }
  function clearFishdex() { touch(); VF.state.data.fishdex = {}; return ok('fishdex cleared'); }

  VF.admin = {
    money: money, level: level, xp: xp, reputation: reputation, tokens: tokens,
    rod: rod, allRods: allRods,
    bait: bait, allBait: allBait,
    charm: charm, allCharms: allCharms,
    cosmetic: cosmetic, slot: slot, allCosmetics: allCosmetics,
    location: location, allLocations: allLocations,
    treasure: treasure, allTreasure: allTreasure,
    achievements: achievements,
    weather: weather, condition: condition, clock: clock,
    spawn: spawn, clearSpawn: clearSpawn,
    everything: everything,
    clearCosmetics: clearCosmetics, clearFishdex: clearFishdex,
    used: function () { return !!VF.state.data.flags.adminUsed; },
    help: function () {
      /* eslint-disable no-console */
      console.log([
        'VF.admin — everything in the game, grantable.',
        '',
        '  money(n)  level(n)  xp(n)  reputation(n)  tokens(n)',
        '  rod(id)  allRods()  bait(id, n)  allBait(n)',
        '  charm(id)  allCharms()',
        '  cosmetic(id)  slot("rodSkin")  allCosmetics()',
        '  location(id)  allLocations()  treasure(id)  allTreasure()',
        '  achievements()  weather(id)  condition(id)  clock(hour)',
        '  spawn({ fish, rarity, size, traits: [] })  clearSpawn()',
        '  everything()',
        '',
        'Or press ` for the panel.'
      ].join('\n'));
      return true;
    }
  };
})(window.VF = window.VF || {});
