/* VOID FISHING — canonical game state.
   Everything persistent lives here. Systems mutate it; the save layer serialises it. */
(function (VF) {
  'use strict';

  const SCHEMA = 1;

  function defaults() {
    return {
      schema: SCHEMA,
      created: Date.now(),

      /* --- player --- */
      money: 0,
      level: 1,
      xp: 0,
      reputation: 0,          // earned by releasing fish

      /* --- equipment --- */
      rod: 'wood',
      ownedRods: ['wood'],
      bait: 'worm',
      baitCounts: {},         // id -> count. 'worm' is unlimited and not tracked here.

      /* --- world --- */
      location: 'shore',
      unlockedLocations: ['shore'],
      seenLocations: ['shore'],

      /* --- collection ---
         fishdex[id] = { caught, record: {kg, m, pct, mutation}, firstSeen, mutations: {id:count} } */
      fishdex: {},
      kept: [],               // array of catch records the player chose to keep

      /* --- meta --- */
      stats: {
        casts: 0,
        catches: 0,
        escapes: 0,
        sold: 0,
        released: 0,
        earned: 0,
        spent: 0,
        biggestKg: 0,
        biggestFish: null,
        rarestRank: -1,
        rarestFish: null,
        legendaryCatches: 0,
        voidCatches: 0,
        mutationsFound: 0,
        recordsBroken: 0,
        encounters: 0,
        playSeconds: 0,
        perfectReels: 0,
        linesSnapped: 0
      },
      achievements: {},       // id -> unlock timestamp
      tutorial: { step: 0, done: false },
      flags: {},              // misc one-shot flags

      settings: {
        master: 0.8,
        music: 0.55,
        sfx: 0.75,
        quality: 'high',      // low | medium | high
        screenShake: true,
        reduceFlash: false,
        showHints: true
      }
    };
  }

  /* Runtime-only state (never saved) */
  const runtime = {
    t: 0,               // seconds since load
    dt: 0,
    paused: false,
    panelOpen: null,
    firstInteraction: false
  };

  VF.state = {
    SCHEMA: SCHEMA,
    defaults: defaults,
    data: defaults(),       // replaced on load
    rt: runtime
  };
})(window.VF = window.VF || {});
