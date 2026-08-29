/* VOID FISHING — cosmetics.
   None of these touch a single gameplay number. That is the deal: cases cost
   Jias, cases contain only this, and nothing in here makes you fish better. */
(function (VF) {
  'use strict';

  const SLOTS = [
    { id: 'rodSkin',   name: 'rod finish' },
    { id: 'bobber',    name: 'bobber' },
    { id: 'line',      name: 'line' },
    { id: 'splash',    name: 'splash' },
    { id: 'cast',      name: 'cast trail' },
    { id: 'catchFx',   name: 'catch effect' },
    { id: 'theme',     name: 'interface' },
    { id: 'outfit',    name: 'outfit' }
  ];

  /* The aquarium's slots. Same objects, same cases, same ownership — they are
     simply worn by a room rather than by a person, so they are equipped from
     inside the aquarium and the Wardrobe does not list them. Putting a tank
     background in a tab next to a rod finish would be filing them by what they
     are made of instead of by what they are for. */
  const AQUA_SLOTS = [
    { id: 'tankBg',    name: 'tank backdrop' },
    { id: 'tankFloor', name: 'tank floor' },
    { id: 'tankDecor', name: 'decoration' },
    { id: 'tankLight', name: 'tank lighting' },
    { id: 'roomWall',  name: 'wall' },
    { id: 'roomFloor', name: 'room floor' },
    { id: 'roomLight', name: 'room lighting' },
    { id: 'pedestal',  name: 'pedestal' }
  ];

  /* `c` fields are read by the renderers; every one is purely visual. */
  const LIST = [
    /* ---------------- rod finishes ---------------- */
    /* A finish carries a metal and a stone as well as the blank's two colours:
       the apex flourishes are built out of those, so without them a Gilt rod
       came out gold with somebody else's purple dragon still on it. */
    { id: 'rod_bone',   slot: 'rodSkin', name: 'Bonewhite', rarity: 'common',   c: { c1: '#e8e2d2', c2: '#a8a294', tip: '#ffffff', metal: '#f4f0e2', stone: '#d8cfae' } },
    { id: 'rod_tar',    slot: 'rodSkin', name: 'Tarblack',  rarity: 'common',   c: { c1: '#2a2a30', c2: '#0e0e12', tip: '#6a6a78', metal: '#8a8a9a', stone: '#4a4a58' } },
    { id: 'rod_verd',   slot: 'rodSkin', name: 'Verdigris', rarity: 'uncommon', c: { c1: '#4a8a78', c2: '#22463c', tip: '#9fe8d0', metal: '#7cc8ac', stone: '#d0fff0' } },
    { id: 'rod_rose',   slot: 'rodSkin', name: 'Rosewood',  rarity: 'uncommon', c: { c1: '#8a4a48', c2: '#4a2422', tip: '#e0a090', metal: '#c88878', stone: '#ffd0b8' } },
    { id: 'rod_ember',  slot: 'rodSkin', name: 'Ember',     rarity: 'rare',     c: { c1: '#8a3a18', c2: '#3a1206', tip: '#ffb066', glow: 0.5, metal: '#ff8a3a', stone: '#ffe0a0' } },
    { id: 'rod_frost',  slot: 'rodSkin', name: 'Hoarfrost', rarity: 'rare',     c: { c1: '#cfe8f5', c2: '#7fa8bc', tip: '#ffffff', glow: 0.4, metal: '#eaf6ff', stone: '#a8dcff' } },
    { id: 'rod_orbit',  slot: 'rodSkin', name: 'Orbital',   rarity: 'epic',     c: { c1: '#3a4a8a', c2: '#141a38', tip: '#c8e0ff', glow: 0.8, style: 'celestial', metal: '#8aa8f0', stone: '#ffffff' } },
    { id: 'rod_null',   slot: 'rodSkin', name: 'Null',      rarity: 'legendary',c: { c1: '#0a0812', c2: '#000000', tip: '#b48aff', glow: 1, style: 'void', metal: '#8a5cff', stone: '#d8c0ff' } },
    { id: 'rod_gilt',   slot: 'rodSkin', name: 'Gilt',      rarity: 'mythic',   c: { c1: '#e8b83a', c2: '#7a5a10', tip: '#fff0b0', glow: 0.9, style: 'lunar', metal: '#ffd75e', stone: '#fff8d8' } },

    /* ---------------- bobbers ---------------- */
    { id: 'bob_classic', slot: 'bobber', name: 'Classic Red', rarity: 'common',   c: { top: '#c8402f', bot: '#e8e4dc' } },
    { id: 'bob_slate',   slot: 'bobber', name: 'Slate',       rarity: 'common',   c: { top: '#5a6470', bot: '#c0c8d0' } },
    { id: 'bob_buoy',    slot: 'bobber', name: 'Harbour Buoy',rarity: 'uncommon', c: { top: '#e8a030', bot: '#204050' } },
    { id: 'bob_pearl',   slot: 'bobber', name: 'Pearl',       rarity: 'rare',     c: { top: '#f0ecf8', bot: '#c8c0e0', sheen: 1 } },
    { id: 'bob_lantern', slot: 'bobber', name: 'Little Lantern', rarity: 'rare',  c: { top: '#3a3020', bot: '#ffd884', lamp: 1 } },
    { id: 'bob_eye',     slot: 'bobber', name: 'It Blinks',   rarity: 'epic',     c: { top: '#e8e0d0', bot: '#c04030', eye: 1 } },
    { id: 'bob_star',    slot: 'bobber', name: 'Caught Star', rarity: 'legendary',c: { top: '#fff4c0', bot: '#ffd060', star: 1, glow: 1 } },
    { id: 'bob_void',    slot: 'bobber', name: 'Absence',     rarity: 'mythic',   c: { top: '#0a0612', bot: '#1a1030', hole: 1 } },

    /* ---------------- line ---------------- */
    { id: 'line_plain',  slot: 'line', name: 'Monofilament', rarity: 'common',   c: { col: '#ffffff', a: 0.4 } },
    { id: 'line_copper', slot: 'line', name: 'Copper Braid', rarity: 'uncommon', c: { col: '#e0a060', a: 0.55 } },
    { id: 'line_glow',   slot: 'line', name: 'Glowline',     rarity: 'rare',     c: { col: '#8ffbe0', a: 0.75, glow: 1 } },
    { id: 'line_pulse',  slot: 'line', name: 'Pulseline',    rarity: 'epic',     c: { col: '#b48aff', a: 0.8, pulse: 1 } },
    { id: 'line_thread', slot: 'line', name: 'Red Thread',   rarity: 'legendary',c: { col: '#ff5a6a', a: 0.9, glow: 1, pulse: 1 } },

    /* ---------------- splash ---------------- */
    { id: 'spl_plain',  slot: 'splash', name: 'Clean Entry',  rarity: 'common',   c: { col: [200, 228, 248] } },
    { id: 'spl_gold',   slot: 'splash', name: 'Gold Leaf',    rarity: 'uncommon', c: { col: [255, 216, 130] } },
    { id: 'spl_ink',    slot: 'splash', name: 'Ink',          rarity: 'rare',     c: { col: [90, 70, 140], n: 1.5 } },
    { id: 'spl_bloom',  slot: 'splash', name: 'Bloom',        rarity: 'epic',     c: { col: [150, 255, 220], n: 2, ring: 1 } },
    { id: 'spl_shatter',slot: 'splash', name: 'Shatter',      rarity: 'legendary',c: { col: [220, 240, 255], n: 3, ring: 2, shard: 1 } },

    /* ---------------- cast trail ---------------- */
    { id: 'cast_none',  slot: 'cast', name: 'Nothing At All', rarity: 'common',   c: {} },
    { id: 'cast_dust',  slot: 'cast', name: 'Dust',           rarity: 'uncommon', c: { col: [220, 210, 180], n: 1 } },
    { id: 'cast_spark', slot: 'cast', name: 'Sparks',         rarity: 'rare',     c: { col: [255, 190, 110], n: 2 } },
    { id: 'cast_comet', slot: 'cast', name: 'Comet',          rarity: 'epic',     c: { col: [180, 220, 255], n: 3, tail: 1 } },
    { id: 'cast_rift',  slot: 'cast', name: 'Rift',           rarity: 'mythic',   c: { col: [180, 130, 255], n: 4, tail: 1, warp: 1 } },

    /* ---------------- catch effect ---------------- */
    { id: 'catch_none', slot: 'catchFx', name: 'Restraint',   rarity: 'common',   c: {} },
    { id: 'catch_motes',slot: 'catchFx', name: 'Motes',       rarity: 'uncommon', c: { col: [220, 240, 255], n: 14 } },
    { id: 'catch_coin', slot: 'catchFx', name: 'Coinfall',    rarity: 'rare',     c: { col: [255, 210, 120], n: 22 } },
    { id: 'catch_halo', slot: 'catchFx', name: 'Halo',        rarity: 'epic',     c: { col: [200, 230, 255], n: 20, halo: 1 } },
    { id: 'catch_rift', slot: 'catchFx', name: 'Unmaking',    rarity: 'legendary',c: { col: [190, 140, 255], n: 30, halo: 1, warp: 1 } },

    /* ---------------- interface themes ---------------- */
    { id: 'ui_default', slot: 'theme', name: 'Default',       rarity: 'common',   c: {} },
    { id: 'ui_paper',   slot: 'theme', name: 'Ledger',        rarity: 'uncommon', c: { ink: '#e8e2d0', accent: '#c8a860' } },
    { id: 'ui_tide',    slot: 'theme', name: 'Tideglass',     rarity: 'rare',     c: { ink: '#dff2f8', accent: '#5fd0e0' } },
    { id: 'ui_ember',   slot: 'theme', name: 'Emberlight',    rarity: 'rare',     c: { ink: '#f8e8d8', accent: '#ff9a5a' } },
    { id: 'ui_void',    slot: 'theme', name: 'Voidwork',      rarity: 'epic',     c: { ink: '#e8dcff', accent: '#a86bff' } },
    { id: 'ui_wrong',   slot: 'theme', name: 'Incorrect',     rarity: 'mythic',   c: { ink: '#ffe8ec', accent: '#ff2d55', glitch: 1 } },

    /* ---------------- outfits ---------------- */
    { id: 'fit_coat',   slot: 'outfit', name: 'Oilskin',      rarity: 'common',   c: { body: '#0a0d14', rim: 0.16 } },
    { id: 'fit_hood',   slot: 'outfit', name: 'Deep Hood',    rarity: 'uncommon', c: { body: '#0d0a16', rim: 0.2, hood: 1.2 } },
    { id: 'fit_scarf',  slot: 'outfit', name: 'Long Scarf',   rarity: 'rare',     c: { body: '#0a0d14', rim: 0.18, scarf: 1 } },
    { id: 'fit_lamp',   slot: 'outfit', name: 'Lampbearer',   rarity: 'epic',     c: { body: '#0a0a12', rim: 0.24, lamp: 1 } },
    { id: 'fit_starlit',slot: 'outfit', name: 'Starlit',      rarity: 'legendary',c: { body: '#080a14', rim: 0.3, stars: 1 } },
    { id: 'fit_absent', slot: 'outfit', name: 'Not Quite There', rarity: 'mythic',c: { body: '#06060c', rim: 0.36, fade: 1 } },

    /* ================================================================
       THE AQUARIUM

       Everything below dresses the room rather than the angler. None of it
       touches a number either — a Void backdrop houses a specimen exactly as
       well as a bare glass tank does. What it changes is whether the room is
       somewhere you want to stand.

       `c.kind` is what the renderer switches on; the colours travel with it so
       a new backdrop is a line in this file and nothing else. */

    /* ---------------- tank backdrops ---------------- */
    { id: 'aq_bg_plain',  slot: 'tankBg', aqua: true, name: 'Bare Glass',   rarity: 'common',    c: { kind: 'plain',  a: '#16222e', b: '#0a1018' } },
    { id: 'aq_bg_ocean',  slot: 'tankBg', aqua: true, name: 'Deep Ocean',   rarity: 'common',    c: { kind: 'ocean',  a: '#123048', b: '#03080f', beam: 0.5 } },
    { id: 'aq_bg_frozen', slot: 'tankBg', aqua: true, name: 'Frozen',       rarity: 'uncommon',  c: { kind: 'frozen', a: '#9fd0e6', b: '#1d3b52', beam: 0.3 } },
    { id: 'aq_bg_ruins',  slot: 'tankBg', aqua: true, name: 'Ancient Ruins',rarity: 'rare',      c: { kind: 'ruins',  a: '#3b3a2a', b: '#0e0f0c', beam: 0.4 } },
    { id: 'aq_bg_city',   slot: 'tankBg', aqua: true, name: 'Sunken City',  rarity: 'epic',      c: { kind: 'city',   a: '#1a3a44', b: '#050c12', beam: 0.55, lit: '#ffd08a' } },
    { id: 'aq_bg_neon',   slot: 'tankBg', aqua: true, name: 'Neon',         rarity: 'epic',      c: { kind: 'neon',   a: '#2a0f4a', b: '#08030f', beam: 0.2, lit: '#ff4fd8' } },
    { id: 'aq_bg_space',  slot: 'tankBg', aqua: true, name: 'Space',        rarity: 'legendary', c: { kind: 'space',  a: '#0d1030', b: '#01020a', stars: 1 } },
    { id: 'aq_bg_void',   slot: 'tankBg', aqua: true, name: 'Void',         rarity: 'mythic',    c: { kind: 'void',   a: '#150a2a', b: '#000000', warp: 1 } },
    { id: 'aq_bg_wrong',  slot: 'tankBg', aqua: true, name: 'No Backdrop Loaded', rarity: 'glitch', c: { kind: 'wrong', a: '#2a0010', b: '#000000', glitch: 1 } },

    /* ---------------- tank floors ---------------- */
    { id: 'aq_fl_sand',   slot: 'tankFloor', aqua: true, name: 'Sand',   rarity: 'common',    c: { kind: 'sand',  c1: '#d8c79a', c2: '#8f7f5c' } },
    { id: 'aq_fl_rock',   slot: 'tankFloor', aqua: true, name: 'Rock',   rarity: 'common',    c: { kind: 'rock',  c1: '#6a6f76', c2: '#33383e' } },
    { id: 'aq_fl_glass',  slot: 'tankFloor', aqua: true, name: 'Glass',  rarity: 'rare',      c: { kind: 'glass', c1: '#bfe6f2', c2: '#4c7f92', sheen: 1 } },
    { id: 'aq_fl_metal',  slot: 'tankFloor', aqua: true, name: 'Metal',  rarity: 'epic',      c: { kind: 'metal', c1: '#aab3bd', c2: '#4a5158', sheen: 1 } },
    { id: 'aq_fl_ruins',  slot: 'tankFloor', aqua: true, name: 'Ruins',  rarity: 'legendary', c: { kind: 'ruins', c1: '#a89a76', c2: '#413b2c' } },

    /* ---------------- decorations ---------------- */
    { id: 'aq_dc_none',   slot: 'tankDecor', aqua: true, name: 'Nothing In It',    rarity: 'common',    c: { kind: 'none' } },
    { id: 'aq_dc_coral',  slot: 'tankDecor', aqua: true, name: 'Coral',            rarity: 'common',    c: { kind: 'coral',   c1: '#ff8a6a', c2: '#c04f6a' } },
    { id: 'aq_dc_pipes',  slot: 'tankDecor', aqua: true, name: 'Pipes',            rarity: 'uncommon',  c: { kind: 'pipes',   c1: '#7f8a94', c2: '#3c444c', bubbles: 1 } },
    { id: 'aq_dc_chest',  slot: 'tankDecor', aqua: true, name: 'Treasure Chest',   rarity: 'uncommon',  c: { kind: 'chest',   c1: '#8a5a2c', c2: '#4a2f16', gold: '#ffd75e' } },
    { id: 'aq_dc_wreck',  slot: 'tankDecor', aqua: true, name: 'Shipwreck',        rarity: 'rare',      c: { kind: 'wreck',   c1: '#5a4632', c2: '#2a2016' } },
    { id: 'aq_dc_statue', slot: 'tankDecor', aqua: true, name: 'Statue',           rarity: 'rare',      c: { kind: 'statue',  c1: '#cfd6d0', c2: '#6f7a72' } },
    { id: 'aq_dc_crystal',slot: 'tankDecor', aqua: true, name: 'Crystals',         rarity: 'epic',      c: { kind: 'crystal', c1: '#a8e8ff', c2: '#4a7fc0', glow: 0.8 } },
    { id: 'aq_dc_machine',slot: 'tankDecor', aqua: true, name: 'Ancient Machinery',rarity: 'legendary', c: { kind: 'machine', c1: '#b8a05a', c2: '#4a3c1c', glow: 0.6, spin: 1 } },
    { id: 'aq_dc_frag',   slot: 'tankDecor', aqua: true, name: 'Void Fragments',   rarity: 'mythic',    c: { kind: 'frag',    c1: '#b48aff', c2: '#2a1050', glow: 1, drift: 1 } },
    { id: 'aq_dc_hook',   slot: 'tankDecor', aqua: true, name: 'A Hook, Just Hanging There', rarity: 'void', c: { kind: 'hook', c1: '#c8d0da', c2: '#5a636e', glow: 0.4 } },

    /* ---------------- tank lighting ---------------- */
    { id: 'aq_li_white',  slot: 'tankLight', aqua: true, name: 'White',   rarity: 'common',    c: { col: '#e8f2ff', a: 0.40 } },
    { id: 'aq_li_blue',   slot: 'tankLight', aqua: true, name: 'Blue',    rarity: 'common',    c: { col: '#5aa8ff', a: 0.48 } },
    { id: 'aq_li_purple', slot: 'tankLight', aqua: true, name: 'Purple',  rarity: 'uncommon',  c: { col: '#a86bff', a: 0.50 } },
    { id: 'aq_li_red',    slot: 'tankLight', aqua: true, name: 'Red',     rarity: 'rare',      c: { col: '#ff5a5a', a: 0.46 } },
    { id: 'aq_li_neon',   slot: 'tankLight', aqua: true, name: 'Neon',    rarity: 'epic',      c: { col: '#ff4fd8', a: 0.56, flicker: 1 } },
    { id: 'aq_li_aurora', slot: 'tankLight', aqua: true, name: 'Aurora',  rarity: 'mythic',    c: { col: '#7dffc4', a: 0.60, aurora: 1 } },

    /* ---------------- the room: walls ---------------- */
    { id: 'aq_wa_std',    slot: 'roomWall', aqua: true, name: 'Standard',   rarity: 'common',    c: { kind: 'std',  c1: '#1b2430', c2: '#0d141c' } },
    { id: 'aq_wa_lab',    slot: 'roomWall', aqua: true, name: 'Laboratory', rarity: 'uncommon',  c: { kind: 'lab',  c1: '#233240', c2: '#101922', tile: 1 } },
    { id: 'aq_wa_anc',    slot: 'roomWall', aqua: true, name: 'Ancient',    rarity: 'rare',      c: { kind: 'anc',  c1: '#3a3323', c2: '#1a170f', tile: 1 } },
    { id: 'aq_wa_deep',   slot: 'roomWall', aqua: true, name: 'Deep Sea',   rarity: 'epic',      c: { kind: 'deep', c1: '#12303c', c2: '#050f16', rivets: 1 } },
    { id: 'aq_wa_void',   slot: 'roomWall', aqua: true, name: 'Void',       rarity: 'legendary', c: { kind: 'void', c1: '#150c28', c2: '#020105', warp: 1 } },

    /* ---------------- the room: floor ---------------- */
    { id: 'aq_rf_conc',   slot: 'roomFloor', aqua: true, name: 'Concrete', rarity: 'common',   c: { kind: 'conc',  c1: '#2b3138', c2: '#171b21' } },
    { id: 'aq_rf_metal',  slot: 'roomFloor', aqua: true, name: 'Metal',    rarity: 'uncommon', c: { kind: 'metal', c1: '#39414a', c2: '#1d2229', sheen: 1 } },
    { id: 'aq_rf_glass',  slot: 'roomFloor', aqua: true, name: 'Glass',    rarity: 'epic',     c: { kind: 'glass', c1: '#20404e', c2: '#0a161e', sheen: 1, mirror: 1 } },

    /* ---------------- the room: lighting ---------------- */
    { id: 'aq_rl_norm',   slot: 'roomLight', aqua: true, name: 'Normal',   rarity: 'common',   c: { col: '#cfe0f0', a: 0.30 } },
    { id: 'aq_rl_neon',   slot: 'roomLight', aqua: true, name: 'Neon',     rarity: 'rare',     c: { col: '#ff4fd8', a: 0.34, flicker: 1 } },
    { id: 'aq_rl_abyss',  slot: 'roomLight', aqua: true, name: 'Abyssal',  rarity: 'legendary',c: { col: '#4f9fff', a: 0.22, caustics: 1 } },

    /* ---------------- the pedestal ---------------- */
    { id: 'aq_pd_none',   slot: 'pedestal', aqua: true, name: 'No Pedestal', rarity: 'common',    c: { kind: 'none' } },
    { id: 'aq_pd_stone',  slot: 'pedestal', aqua: true, name: 'Stone Plinth',rarity: 'uncommon',  c: { kind: 'stone', c1: '#8d9298', c2: '#43484e' } },
    { id: 'aq_pd_brass',  slot: 'pedestal', aqua: true, name: 'Brass Stand', rarity: 'rare',      c: { kind: 'brass', c1: '#d9ac52', c2: '#6c4f18', sheen: 1 } },
    { id: 'aq_pd_glass',  slot: 'pedestal', aqua: true, name: 'Glass Case',  rarity: 'epic',      c: { kind: 'glass', c1: '#bfe6f2', c2: '#3c6070', sheen: 1 } },
    { id: 'aq_pd_null',   slot: 'pedestal', aqua: true, name: 'Nothing Holding It Up', rarity: 'legendary', c: { kind: 'null', c1: '#b48aff', c2: '#1a0f30', glow: 1 } },

    /* ================================================================
       The tiers above mythic had nothing in them at all, so a case could not
       pay one out however good the case was. These are what those tiers are
       for: one apiece, and they are meant to be the best thing in the game to
       look at rather than merely the rarest. */
    { id: 'rod_tidal',  slot: 'rodSkin', name: 'Tidewrought', rarity: 'mythic', c: { c1: '#1f6a7c', c2: '#08222c', tip: '#a8f0ff', glow: 0.9, style: 'tide', metal: '#7fe0f0', stone: '#e0ffff' } },
    { id: 'line_sunder',slot: 'line',   name: 'Sunderline',  rarity: 'mythic', c: { col: '#ffd75e', a: 0.85, glow: 1, pulse: 1 } },
    { id: 'fit_tide',   slot: 'outfit', name: 'Tidecoat',    rarity: 'mythic', c: { body: '#08202a', rim: 0.30, scarf: 1, lamp: 1 } },

    { id: 'rod_abyss',  slot: 'rodSkin', name: 'Abyssal',    rarity: 'void',   c: { c1: '#0a1a2c', c2: '#01060c', tip: '#5fd0ff', glow: 1, style: 'tide',   metal: '#5fd0ff', stone: '#d8f4ff' } },
    { id: 'rod_err',    slot: 'rodSkin', name: 'ERR_FINISH', rarity: 'glitch', c: { c1: '#ff2d55', c2: '#0a0004', tip: '#66ffe0', glow: 1, style: 'wrong',  metal: '#66ffe0', stone: '#ff2d55' } },
    { id: 'bob_hollow', slot: 'bobber', name: 'Hollow',      rarity: 'void',   c: { top: '#120a24', bot: '#3a2470', hole: 1, glow: 1 } },
    { id: 'line_null',  slot: 'line',   name: 'No Line',     rarity: 'void',   c: { col: '#8a5cff', a: 0.30, glow: 1, pulse: 1 } },
    { id: 'spl_null',   slot: 'splash', name: 'Silence',     rarity: 'void',   c: { col: [150, 110, 255], n: 4, ring: 3, shard: 1 } },
    { id: 'cast_null',  slot: 'cast',   name: 'Absence',     rarity: 'void',   c: { col: [140, 100, 255], n: 5, tail: 1, warp: 1 } },
    { id: 'catch_err',  slot: 'catchFx',name: 'Overflow',    rarity: 'glitch', c: { col: [255, 45, 85], n: 44, halo: 1, warp: 1 } },
    { id: 'fit_void',   slot: 'outfit', name: 'Void Coat',   rarity: 'void',   c: { body: '#070518', rim: 0.34, stars: 1, fade: 1 } }
  ];

  /* Some cosmetics never appear in a case — they only turn up in the water. */
  /* Never in a case. Some are pulled out of the water; the rest are not
     obtained at all in any way that has been written down.

     `rod_err` is deliberately NOT on this list. The last tier had nothing in it
     that a case could reach, which made the line printed on the front of the
     last two cases a line that could never pay — so exactly one thing lives
     there, at two in a hundred thousand, and it is the only way to see the
     tier at all. */
  const SECRET = ['bob_void', 'rod_gilt', 'ui_wrong', 'fit_absent', 'cast_rift',
                  'catch_err', 'aq_bg_wrong', 'aq_dc_hook'];

  const BY_ID = VF.util.byId(LIST);
  const BY_SLOT = Object.create(null);
  for (let i = 0; i < LIST.length; i++) {
    LIST[i].secret = SECRET.indexOf(LIST[i].id) >= 0;
    (BY_SLOT[LIST[i].slot] || (BY_SLOT[LIST[i].slot] = [])).push(LIST[i]);
  }

  /* Defaults are owned from the start so every slot always has something in it. */
  const DEFAULTS = { rodSkin: null, bobber: 'bob_classic', line: 'line_plain',
                     splash: 'spl_plain', cast: 'cast_none', catchFx: 'catch_none',
                     theme: 'ui_default', outfit: 'fit_coat',
                     /* the room as it is on the day you are given the key */
                     tankBg: 'aq_bg_plain', tankFloor: 'aq_fl_sand',
                     tankDecor: 'aq_dc_none', tankLight: 'aq_li_white',
                     roomWall: 'aq_wa_std', roomFloor: 'aq_rf_conc',
                     roomLight: 'aq_rl_norm', pedestal: 'aq_pd_none' };

  function owned(id) {
    const d = VF.state.data;
    return d.cosmetics.indexOf(id) >= 0 || isDefault(id);
  }
  function isDefault(id) {
    for (const k in DEFAULTS) if (DEFAULTS[k] === id) return true;
    return false;
  }

  function grant(id) {
    const d = VF.state.data;
    const c = BY_ID[id];
    if (!c) return false;
    if (d.cosmetics.indexOf(id) >= 0) return false;
    d.cosmetics.push(id);
    VF.bus.emit('cosmetic:found', c);
    return true;
  }

  function equip(id) {
    const c = BY_ID[id];
    if (!c || !owned(id)) return false;
    VF.state.data.equipped[c.slot] = id;
    VF.bus.emit('cosmetic:changed', c);
    return true;
  }
  function unequip(slot) {
    VF.state.data.equipped[slot] = DEFAULTS[slot] || null;
    VF.bus.emit('cosmetic:changed', null);
  }
  function equippedIn(slot) {
    const id = VF.state.data.equipped[slot];
    if (id && owned(id)) return BY_ID[id] || null;
    const dflt = DEFAULTS[slot];
    return dflt ? BY_ID[dflt] : null;
  }
  /* Convenience for the renderers: the config object, or an empty one. */
  function cfg(slot) {
    const c = equippedIn(slot);
    return c ? c.c : {};
  }

  function completion() { return over(LIST); }
  /* The Wardrobe's own number: things a person wears, not things a room does. */
  function gearCompletion() { return over(LIST.filter(function (c) { return !c.aqua; })); }

  function over(list) {
    let have = 0;
    for (let i = 0; i < list.length; i++) if (owned(list[i].id)) have++;
    return { have: have, total: list.length, pct: list.length ? have / list.length : 0 };
  }

  VF.cosmetics = {
    list: LIST, slots: SLOTS, aquaSlots: AQUA_SLOTS, DEFAULTS: DEFAULTS,
    /* What the Wardrobe shows: things worn by a person. The aquarium's own
       slots are equipped in the aquarium. */
    gear: LIST.filter(function (c) { return !c.aqua; }),
    get: function (id) { return BY_ID[id] || null; },
    inSlot: function (slot) { return BY_SLOT[slot] || []; },
    owned: owned, grant: grant, equip: equip, unequip: unequip,
    equippedIn: equippedIn, cfg: cfg, completion: completion,
    gearCompletion: gearCompletion,
    caseable: LIST.filter(function (c) { return !c.secret && !isDefault(c.id); })
  };
})(window.VF = window.VF || {});
