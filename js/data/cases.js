/* VOID FISHING — cosmetic cases.
   Bought with Jias, contain cosmetics and nothing else, and the odds are
   printed on the front because hiding them would be the only dishonest part.

   What was wrong with them: every case ran on ONE odds table. A twelve-
   thousand Jias Harbour Case and a four-point-eight-million Case Of Nothing
   had exactly the same eight-in-ten-thousand chance of a mythic, which made
   the price of the expensive ones a lie — you were paying four hundred times
   as much for a different list of names, not for better odds. And the two
   tiers above mythic did not appear in the table at all, so a case could not
   pay one out however good the case was.

   Now every case carries its own table, the tables climb steeply with price
   and level, and the top two tiers are reachable in the last two cases. Every
   table sums to exactly one, and there is a test in tools/ that checks it. */
(function (VF) {
  'use strict';

  const TIERS = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'void', 'glitch'];

  /* The old single table, kept as what a case falls back on if it forgets to
     bring one of its own. */
  const ODDS = {
    common: 0.6200, uncommon: 0.2700, rare: 0.0900,
    epic: 0.0180, legendary: 0.0019, mythic: 0.0001,
    void: 0, glitch: 0
  };

  /* Every case stocks every tier its table names, all the way down to common.
     That is not padding: a table that says twenty per cent common while the
     pool holds nothing common is a table that quietly folds that twenty per
     cent into whatever the lowest stocked tier happens to be, and the number
     on the front of the box stops describing what comes out of it. The last
     case in the list really does hand you a Tarblack rod finish eight times in
     a hundred, and it says so. */
  const LIST = [
    { id: 'harbour', name: 'Harbour Case', cost: 12000, level: 4,
      blurb: 'Ordinary things, well made. The starting collection.',
      color: '#7fa8c8',
      odds: { common: 0.6200, uncommon: 0.2700, rare: 0.0900,
              epic: 0.0180, legendary: 0.0019, mythic: 0.0001 },
      pool: ['rod_bone', 'rod_tar', 'bob_slate', 'aq_bg_ocean', 'aq_fl_rock',
             'aq_dc_coral', 'aq_li_blue',
             'rod_verd', 'rod_rose', 'bob_buoy', 'line_copper', 'spl_gold',
             'cast_dust', 'catch_motes', 'ui_paper', 'fit_hood', 'aq_bg_frozen',
             'aq_dc_pipes', 'aq_dc_chest', 'aq_li_purple', 'aq_wa_lab',
             'aq_rf_metal', 'aq_pd_stone',
             'bob_pearl', 'bob_lantern', 'line_glow', 'spl_ink', 'cast_spark',
             'catch_coin', 'ui_tide', 'fit_scarf', 'rod_frost',
             'rod_orbit', 'catch_halo',
             'line_thread',
             'aq_li_aurora'] },

    /* The one the aquarium is for. Cheap, early, and almost entirely room —
       a player who has just been handed the key should be able to change
       something about it that afternoon rather than in three weeks. */
    { id: 'aquarist', name: "Aquarist's Case", cost: 34000, level: 8,
      blurb: 'Glass, gravel and a light. Everything a room needs to stop being a store cupboard.',
      color: '#5fd0a8',
      odds: { common: 0.5600, uncommon: 0.2800, rare: 0.1200,
              epic: 0.0330, legendary: 0.0065, mythic: 0.0005 },
      pool: ['aq_bg_ocean', 'aq_fl_rock', 'aq_dc_coral', 'aq_li_blue', 'bob_slate',
             'aq_bg_frozen', 'aq_dc_pipes', 'aq_dc_chest', 'aq_li_purple',
             'aq_wa_lab', 'aq_rf_metal', 'aq_pd_stone', 'rod_verd',
             'aq_bg_ruins', 'aq_fl_glass', 'aq_dc_wreck', 'aq_dc_statue',
             'aq_li_red', 'aq_wa_anc', 'aq_rl_neon', 'aq_pd_brass',
             'aq_bg_city', 'aq_bg_neon', 'aq_fl_metal', 'aq_dc_crystal',
             'aq_li_neon', 'aq_wa_deep', 'aq_rf_glass', 'aq_pd_glass',
             'aq_bg_space', 'aq_fl_ruins', 'aq_dc_machine', 'aq_wa_void',
             'aq_rl_abyss', 'aq_pd_null',
             'aq_dc_frag'] },

    { id: 'deepwater', name: 'Deepwater Case', cost: 90000, level: 16,
      blurb: 'Recovered from further down than anybody sells from.',
      color: '#5fd0e0',
      odds: { common: 0.4800, uncommon: 0.3000, rare: 0.1600,
              epic: 0.0500, legendary: 0.0090, mythic: 0.0010 },
      pool: ['rod_bone', 'rod_tar', 'bob_slate', 'aq_bg_ocean', 'aq_fl_rock', 'aq_li_blue',
             'rod_verd', 'rod_rose', 'line_copper', 'spl_gold', 'cast_dust',
             'catch_motes', 'ui_paper', 'fit_hood', 'aq_bg_frozen', 'aq_dc_pipes',
             'aq_li_purple', 'aq_wa_lab', 'aq_rf_metal', 'aq_pd_stone',
             'rod_ember', 'rod_frost', 'bob_pearl', 'bob_lantern', 'line_glow',
             'spl_ink', 'cast_spark', 'catch_coin', 'ui_tide', 'ui_ember',
             'fit_scarf', 'aq_bg_ruins', 'aq_fl_glass', 'aq_dc_wreck',
             'aq_dc_statue', 'aq_li_red', 'aq_wa_anc', 'aq_rl_neon', 'aq_pd_brass',
             'rod_orbit', 'bob_eye', 'line_pulse', 'spl_bloom', 'cast_comet',
             'catch_halo', 'ui_void', 'fit_lamp', 'aq_bg_city', 'aq_bg_neon',
             'aq_fl_metal', 'aq_dc_crystal', 'aq_li_neon', 'aq_wa_deep',
             'aq_rf_glass', 'aq_pd_glass',
             'rod_null', 'bob_star', 'line_thread', 'spl_shatter', 'catch_rift',
             'fit_starlit', 'aq_bg_space', 'aq_fl_ruins', 'aq_dc_machine',
             'aq_wa_void', 'aq_rl_abyss', 'aq_pd_null',
             'rod_tidal', 'line_sunder', 'fit_tide', 'aq_bg_void', 'aq_dc_frag',
             'aq_li_aurora'] },

    { id: 'cradle', name: 'Cradle Case', cost: 640000, level: 30,
      blurb: 'Salvage from the ring. Most of it should not still work.',
      color: '#ffd08a',
      odds: { common: 0.3600, uncommon: 0.3000, rare: 0.2200,
              epic: 0.0950, legendary: 0.0210, mythic: 0.0038, void: 0.0002 },
      pool: ['rod_bone', 'rod_tar', 'bob_slate', 'aq_bg_ocean', 'aq_fl_rock', 'aq_li_blue',
             'rod_verd', 'rod_rose', 'line_copper', 'spl_gold', 'cast_dust',
             'catch_motes', 'ui_paper', 'fit_hood', 'aq_bg_frozen', 'aq_dc_pipes',
             'aq_dc_chest', 'aq_li_purple', 'aq_wa_lab', 'aq_rf_metal', 'aq_pd_stone',
             'rod_ember', 'rod_frost', 'bob_pearl', 'bob_lantern', 'line_glow',
             'spl_ink', 'cast_spark', 'catch_coin', 'ui_tide', 'ui_ember',
             'fit_scarf', 'aq_bg_ruins', 'aq_fl_glass', 'aq_dc_wreck',
             'aq_dc_statue', 'aq_li_red', 'aq_wa_anc', 'aq_rl_neon', 'aq_pd_brass',
             'rod_orbit', 'bob_eye', 'line_pulse', 'spl_bloom', 'cast_comet',
             'catch_halo', 'ui_void', 'fit_lamp', 'aq_bg_city', 'aq_bg_neon',
             'aq_fl_metal', 'aq_dc_crystal', 'aq_li_neon', 'aq_wa_deep',
             'aq_rf_glass', 'aq_pd_glass',
             'rod_null', 'bob_star', 'line_thread', 'spl_shatter', 'catch_rift',
             'fit_starlit', 'aq_bg_space', 'aq_fl_ruins', 'aq_dc_machine',
             'aq_wa_void', 'aq_rl_abyss', 'aq_pd_null',
             'rod_tidal', 'line_sunder', 'fit_tide', 'aq_bg_void', 'aq_dc_frag',
             'aq_li_aurora',
             'rod_abyss', 'bob_hollow', 'line_null', 'spl_null', 'cast_null', 'fit_void'] },

    { id: 'nothing', name: 'Case Of Nothing', cost: 4800000, level: 46,
      blurb: 'The collector will not say where these come from.',
      color: '#a86bff',
      odds: { common: 0.2000, uncommon: 0.2700, rare: 0.2900,
              epic: 0.1800, legendary: 0.0500, mythic: 0.0090,
              void: 0.00098, glitch: 0.00002 },
      pool: ['rod_bone', 'rod_tar', 'bob_slate', 'aq_bg_ocean', 'aq_fl_rock', 'aq_li_blue',
             'rod_verd', 'rod_rose', 'line_copper', 'cast_dust', 'catch_motes',
             'ui_paper', 'fit_hood', 'aq_bg_frozen', 'aq_dc_pipes', 'aq_li_purple',
             'aq_wa_lab', 'aq_rf_metal', 'aq_pd_stone',
             'rod_ember', 'rod_frost', 'bob_pearl', 'bob_lantern', 'line_glow',
             'spl_ink', 'cast_spark', 'catch_coin', 'ui_tide', 'ui_ember',
             'fit_scarf', 'aq_bg_ruins', 'aq_fl_glass', 'aq_dc_wreck',
             'aq_dc_statue', 'aq_li_red', 'aq_wa_anc', 'aq_rl_neon', 'aq_pd_brass',
             'rod_orbit', 'bob_eye', 'line_pulse', 'spl_bloom', 'cast_comet',
             'catch_halo', 'ui_void', 'fit_lamp', 'aq_bg_city', 'aq_bg_neon',
             'aq_fl_metal', 'aq_dc_crystal', 'aq_li_neon', 'aq_wa_deep',
             'aq_rf_glass', 'aq_pd_glass',
             'rod_null', 'bob_star', 'line_thread', 'spl_shatter', 'catch_rift',
             'fit_starlit', 'aq_bg_space', 'aq_fl_ruins', 'aq_dc_machine',
             'aq_wa_void', 'aq_rl_abyss', 'aq_pd_null',
             'rod_tidal', 'line_sunder', 'fit_tide', 'aq_bg_void', 'aq_dc_frag',
             'aq_li_aurora',
             'rod_abyss', 'bob_hollow', 'line_null', 'spl_null', 'cast_null', 'fit_void',
             'rod_err'] },

    /* The end of the shelf. It costs what a very long evening is worth and the
       odds are the reason to buy it: nearly half of every one of these is epic
       or better, and it is the only case that pays out the last tier at odds
       worth printing. */
    { id: 'everything', name: 'Case Of Everything', cost: 62000000, level: 70,
      blurb: 'Somebody emptied all the others into one box and sealed it. It hums.',
      color: '#ff5c9e',
      odds: { common: 0.0800, uncommon: 0.1800, rare: 0.3000,
              epic: 0.2900, legendary: 0.1200, mythic: 0.0260,
              void: 0.0038, glitch: 0.0002 },
      pool: ['rod_bone', 'rod_tar', 'bob_slate', 'aq_bg_ocean', 'aq_fl_rock', 'aq_li_blue',
             'rod_verd', 'rod_rose', 'bob_buoy', 'line_copper', 'spl_gold',
             'cast_dust', 'catch_motes', 'ui_paper', 'fit_hood', 'aq_bg_frozen',
             'aq_dc_pipes', 'aq_dc_chest', 'aq_li_purple', 'aq_wa_lab',
             'aq_rf_metal', 'aq_pd_stone',
             'rod_ember', 'rod_frost', 'bob_pearl', 'bob_lantern', 'line_glow',
             'spl_ink', 'cast_spark', 'catch_coin', 'ui_tide', 'ui_ember',
             'fit_scarf', 'aq_bg_ruins', 'aq_fl_glass', 'aq_dc_wreck',
             'aq_dc_statue', 'aq_li_red', 'aq_wa_anc', 'aq_rl_neon', 'aq_pd_brass',
             'rod_orbit', 'bob_eye', 'line_pulse', 'spl_bloom', 'cast_comet',
             'catch_halo', 'ui_void', 'fit_lamp', 'aq_bg_city', 'aq_bg_neon',
             'aq_fl_metal', 'aq_dc_crystal', 'aq_li_neon', 'aq_wa_deep',
             'aq_rf_glass', 'aq_pd_glass',
             'rod_null', 'bob_star', 'line_thread', 'spl_shatter', 'catch_rift',
             'fit_starlit', 'aq_bg_space', 'aq_fl_ruins', 'aq_dc_machine',
             'aq_wa_void', 'aq_rl_abyss', 'aq_pd_null',
             'rod_tidal', 'line_sunder', 'fit_tide', 'aq_bg_void', 'aq_dc_frag',
             'aq_li_aurora',
             'rod_abyss', 'bob_hollow', 'line_null', 'spl_null', 'cast_null', 'fit_void',
             'rod_err'] }
  ];

  const BY_ID = VF.util.byId(LIST);

  function oddsOf(caseDef) { return (caseDef && caseDef.odds) || ODDS; }

  function itemsOf(caseDef) {
    return caseDef.pool.map(function (id) { return VF.cosmetics.get(id); })
                       .filter(function (c) { return !!c; });
  }

  /* Pick a tier by the printed odds, walking DOWN from the top so a table that
     does not quite sum to one errs toward the common end rather than silently
     dropping the top of it. */
  function pickTier(caseDef, rnd) {
    const odds = oddsOf(caseDef);
    let r = rnd(), acc = 0;
    for (let i = TIERS.length - 1; i >= 0; i--) {
      acc += odds[TIERS[i]] || 0;
      if (r <= acc) return TIERS[i];
    }
    return 'common';
  }

  /* Pick a tier by the printed odds, then a cosmetic of that tier from the
     case's pool. If the case has nothing at the drawn tier it steps down.

     Within a tier, something you do not already own is preferred. That is not
     a thumb on the printed odds — the tier is decided first and is exactly
     what the front of the case says — it only stops a case from handing you
     your fourth Verdigris while a Rosewood sits unfound in the same tier. */
  function rollFrom(caseDef, rnd) {
    const items = itemsOf(caseDef);
    const picked = pickTier(caseDef, rnd);
    for (let step = TIERS.indexOf(picked); step >= 0; step--) {
      const tier = TIERS[step];
      const at = items.filter(function (c) { return c.rarity === tier; });
      if (!at.length) continue;
      const fresh = at.filter(function (c) { return !VF.cosmetics.owned(c.id); });
      const from = fresh.length ? fresh : at;
      return { item: from[Math.floor(rnd() * from.length)], rarity: tier };
    }
    return { item: items[0], rarity: items[0] ? items[0].rarity : 'common' };
  }

  /* The strip the opening animation scrolls through: mostly filler, with the
     real result parked at a known index. The filler is drawn on the case's own
     odds now — it used to run on numbers typed into this function, so an
     expensive case scrolled past the same cheap parade as a starter one and
     the animation quietly contradicted the front of the box. */
  function buildStrip(caseDef, result, rnd) {
    const items = itemsOf(caseDef);
    const STRIP = 48;
    const WIN = 42;
    const strip = [];
    for (let i = 0; i < STRIP; i++) {
      if (i === WIN) { strip.push(result.item); continue; }
      const tier = pickTier(caseDef, rnd);
      let at = items.filter(function (c) { return c.rarity === tier; });
      if (!at.length) at = items;
      strip.push(at[Math.floor(rnd() * at.length)]);
    }
    return { strip: strip, winIndex: WIN };
  }

  /* A case cannot pay out a tier it does not stock, so the odds shown are the
     odds after those tiers fold down into the next one they can actually fill.
     This is what the shop prints, not the raw table. */
  function effectiveOdds(caseDef) {
    const odds = oddsOf(caseDef);
    const have = Object.create(null);
    caseDef.pool.forEach(function (id) {
      const c = VF.cosmetics.get(id);
      if (c) have[c.rarity] = true;
    });
    const out = Object.create(null);
    TIERS.forEach(function (t) { out[t] = 0; });
    TIERS.forEach(function (t) {
      const p = odds[t] || 0;
      if (!p) return;
      let target = null;
      for (let i = TIERS.indexOf(t); i >= 0; i--) {
        if (have[TIERS[i]]) { target = TIERS[i]; break; }
      }
      if (target === null) {
        // nothing at or below it either: give it to the lowest tier stocked
        for (let i = 0; i < TIERS.length; i++) if (have[TIERS[i]]) { target = TIERS[i]; break; }
      }
      if (target !== null) out[target] += p;
    });
    return out;
  }

  function completion(caseId) {
    const c = BY_ID[caseId];
    if (!c) return { have: 0, total: 0, pct: 0 };
    let have = 0;
    for (let i = 0; i < c.pool.length; i++) if (VF.cosmetics.owned(c.pool[i])) have++;
    return { have: have, total: c.pool.length, pct: have / c.pool.length };
  }

  /* For the tools, and for anybody reading the file who wants to know whether
     the tables are honest without adding them up by hand. */
  function checkOdds() {
    return LIST.map(function (c) {
      const o = oddsOf(c);
      let sum = 0;
      TIERS.forEach(function (t) { sum += o[t] || 0; });
      return { id: c.id, sum: sum, ok: Math.abs(sum - 1) < 1e-9 };
    });
  }

  VF.cases = {
    list: LIST, ODDS: ODDS, TIERS: TIERS,
    get: function (id) { return BY_ID[id] || null; },
    oddsOf: oddsOf,
    rollFrom: rollFrom, buildStrip: buildStrip, completion: completion,
    effectiveOdds: effectiveOdds, checkOdds: checkOdds
  };
})(window.VF = window.VF || {});
