/* VOID FISHING — canonical game state.
   Everything persistent lives here. Systems mutate it; the save layer serialises it. */
(function (VF) {
  'use strict';

  const SCHEMA = 2;

  function defaults() {
    return {
      schema: SCHEMA,
      created: Date.now(),

      /* --- player --- */
      money: 0,
      level: 1,
      xp: 0,
      /* Past the level cap the xp does not stop arriving, so it goes here
         instead of into a bar that cannot move. A fathom is a long way down. */
      fathoms: 0,
      fathomXp: 0,
      reputation: 0,          // earned by releasing fish

      /* --- equipment --- */
      rod: 'wood',
      ownedRods: ['wood'],
      bait: 'worm',
      baitCounts: {},         // id -> count. 'worm' is unlimited and not tracked here.
      /* Line, reel and hook. See js/data/mods.js. */
      ownedMods: [],
      mods: { line: null, reel: null, hook: null },

      charms: [],             // owned charm and relic ids
      charmSlots: [null, null, null, null, null],

      /* --- world --- */
      location: 'shore',
      unlockedLocations: ['shore'],
      seenLocations: ['shore'],

      /* --- collection ---
         fishdex[id] = { caught, record: {kg, m, pct, mutation}, firstSeen, mutations: {id:count} } */
      fishdex: {},
      kept: [],               // array of catch records the player chose to keep
      wall: [],               // the handful of them that are up on the wall
      traitsSeen: {},         // trait id -> times landed
      treasures: {},          // treasure id -> times pulled up
      secrets: {},            // secret id -> discovery timestamp
      journal: [],            // { id, title, text, at, kind }
      npcs: {},               // npc id -> { met, stage, heard: [] }
      quests: {},             // quest id -> { started, step, done, flags: {}, counts: {} }
      merchant: {             // the wanderer: when he is here, and what he brought
        until: 0,             // wall-clock ms he leaves at; 0 = not here
        next: 0,              // wall-clock ms he next turns up
        stock: [],            // rod ids he is carrying this visit
        sold: [],             // ids already bought out of this visit
        visits: 0
      },
      /* Where the rod was when the game was put down, so the line can still
         be out when it is picked up. Null while playing. */
      away: null,

      /* The one that comes back. See js/systems/returning.js. */
      returning: { stage: 0, lastCast: 0, done: false },

      /* Standing requests. See js/systems/bounties.js. */
      bounties: { list: [], at: 0 },

      cosmetics: [],          // owned cosmetic ids
      equipped: {},           // cosmetic slot -> id
      cases: {},              // case id -> times opened
      caseTokens: 0,          // spare keys found in the water

      records: {
        biggestKg: 0, biggestId: null, biggestTraits: [],
        richest: 0, richestId: null, richestTraits: [],
        bestCombo: 0, bestComboId: null, bestComboTraits: [],
        longestSpecies: 0, longestId: null,
        bestStreak: 0
      },
      streak: 0,              // consecutive catches without losing one

      /* The rule this game is played under, chosen when the slot was started
         and never changed after. See js/data/runs.js. */
      run: 'none',

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
        glitchCatches: 0,
        unknownCatches: 0,
        mutationsFound: 0,
        recordsBroken: 0,
        encounters: 0,
        playSeconds: 0,
        perfectReels: 0,
        linesSnapped: 0,
        secondChances: 0,
        treasuresFound: 0,
        casesOpened: 0,
        secretsFound: 0,
        multiTrait: 0,
        wrongEvents: 0,
        bounties: 0
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
