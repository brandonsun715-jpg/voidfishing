/* VOID FISHING — the fishing loop.
   idle -> casting -> waiting -> bite -> reeling -> landed | lost -> idle
   Nothing here can deadlock: every state has a timeout or an exit condition,
   and a slack line resolves an unattended fight instead of hanging forever. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const CAST_CHARGE_TIME = 1.05;   // seconds to fill the power meter
  const CAST_FLIGHT_TIME = 0.72;   // bobber travel time
  const SWEET_FROM = 0.80;         // top of the meter gives a rare-chance bonus
  const BITE_WINDOW = 1.35;        // seconds to react to a bite
  const BITE_WINDOW_BIG = 2.6;     // an encounter is too rare to lose to a slow hand
  const SLACK_LIMIT = 3.6;         // seconds of no tension before the fish throws the hook
  const SNAP_GRACE = 0.45;         // seconds at max tension before the line goes

  const S = {
    state: 'idle',
    t: 0,                // time in current state

    charging: false,
    charge: 0,
    castPower: 0,
    sweet: false,

    /* bobber position in normalised scene space: 0 = at the rod, 1 = max range */
    castDist: 0,
    flight: 0,

    biteWait: 0,
    nibble: 0,           // small pre-bite bobber twitches
    nibbleTimer: 0,

    pending: null,       // rolled catch waiting to be hooked
    pendingOpts: null,   // forced roll options from an encounter
    biteWindow: BITE_WINDOW,
    fight: null,

    lastResult: null,
    encounterActive: false
  };

  /* ---------------------------------------------------------------- casting */

  function canCast() {
    return S.state === 'idle' && !VF.state.rt.panelOpen;
  }

  function beginCharge() {
    if (!canCast()) return false;
    if (!VF.bait.has(VF.state.data.bait)) {
      VF.bus.emit('ui:toast', { text: 'Out of ' + VF.bait.get(VF.state.data.bait).name + ' — switched to Worm', kind: 'warn' });
      VF.state.data.bait = 'worm';
      VF.bus.emit('bait:changed');
    }
    S.charging = true;
    S.charge = 0;
    VF.bus.emit('fishing:charge:start');
    return true;
  }

  function releaseCharge() {
    if (!S.charging) return;
    S.charging = false;
    cast(S.charge);
  }

  function cast(power) {
    const d = VF.state.data;
    S.pendingOpts = null;
    if (!VF.bait.consume(d.bait)) { d.bait = 'worm'; VF.bait.consume('worm'); }

    const rod = VF.rods.get(d.rod);
    S.castPower = U.clamp(power, 0, 1);
    S.sweet = S.castPower >= SWEET_FROM;
    S.castDist = U.clamp(rod.cast * (0.55 + 0.45 * S.castPower), 0.05, 1.6);
    S.flight = 0;
    S.pending = null;
    S.fight = null;
    d.stats.casts++;

    setState('casting');
    VF.bus.emit('fishing:cast', { power: S.castPower, sweet: S.sweet, dist: S.castDist });
  }

  /* ---------------------------------------------------------------- waiting */

  function beginWaiting() {
    const loc = VF.locations.current();
    const bait = VF.bait.get(VF.state.data.bait);
    const rod = VF.rods.get(VF.state.data.rod);

    // Better rods and further casts find fish sooner; deep spots make you wait.
    const base = VF.rng.g.range(4.2, 10.5);
    const build = VF.build ? VF.build.stats() : null;
    const cond = VF.conditions ? VF.conditions.mods() : null;
    const k = bait.bite * loc.biteBoost * VF.weather.bite() *
              (build ? build.bite / bait.bite : 1) *
              (cond ? cond.bite : 1) *
              (1 - U.clamp(rod.cast * 0.12, 0, 0.22)) *
              (1 - U.clamp(S.castPower * 0.10, 0, 0.10));
    S.biteWait = U.clamp(base * k, 1.6, 22);
    S.nibbleTimer = VF.rng.g.range(1.0, 2.4);
    S.nibble = 0;
    setState('waiting');
    VF.bus.emit('fishing:waiting');
    // the line goes somewhere it has not been before
    if (VF.secrets) VF.secrets.tryFind();
  }

  function triggerBite(opts) {
    opts = opts || {};
    if (S.sweet && !opts.minRank) opts = Object.assign({}, opts, { rareBoost: 1.12 });

    // an encounter is always a fish; otherwise the hook may have found an object
    if (!opts.minRank && VF.rng.g() < VF.treasureData.chance()) {
      const t = VF.treasureData.roll();
      if (t) {
        S.pending = { kind: 'treasure', treasure: t, rarity: t.rarity,
                      rarityDef: VF.rarities.get(t.rarity), traits: [],
                      fish: { name: t.name, diff: 0.2, art: null } };
        S.biteWindow = BITE_WINDOW;
        setState('bite');
        VF.bus.emit('fishing:bite', S.pending);
        return;
      }
    }

    S.pending = VF.loot.roll(opts);
    S.pending.kind = 'fish';
    S.biteWindow = opts.minRank ? BITE_WINDOW_BIG : BITE_WINDOW;
    setState('bite');
    VF.bus.emit('fishing:bite', S.pending);
  }

  /* ---------------------------------------------------------------- the fight */

  function hook() {
    if (S.state !== 'bite' || !S.pending) return false;
    const p = S.pending.kind === 'treasure' ? treasureFight() : VF.loot.fightParams(S.pending);
    S.fight = {
      c: S.pending,
      p: p,
      distance: 1,
      stamina: 1,
      tension: 0.18,
      reeling: false,
      surge: 0,
      surgeTime: 0,
      surgeDur: 0,
      nextSurge: VF.rng.g.range(1.4, 2.6) / p.surgeRate,
      telegraph: 0,
      snapTimer: 0,
      slack: 0,
      load: 0,
      perfect: true,
      inSweet: false,
      elapsed: 0,
      shakeAmt: 0
    };
    S.pending = null;
    setState('reeling');
    VF.bus.emit('fishing:hooked', S.fight);
    return true;
  }

  /* Objects do not fight back. They are just heavy and awkward. */
  function treasureFight() {
    const rod = VF.rods.get(VF.state.data.rod);
    const build = VF.build ? VF.build.stats() : null;
    return {
      power: 0.20, stamina: 0.55, surgeRate: 0.35,
      lineStrength: rod.line * (build ? build.line : 1),
      reelForce: rod.reel * (build ? build.reel : 1),
      erratic: 0.15
    };
  }

  function setReeling(on) {
    if (S.state !== 'reeling' || !S.fight) return;
    if (S.fight.reeling === on) return;
    S.fight.reeling = on;
    VF.bus.emit(on ? 'fishing:reel:start' : 'fishing:reel:stop');
  }

  function updateFight(dt) {
    const f = S.fight;
    // reeling without a fight is not a state the game can produce, but a bad
    // save or an interrupted transition should drop the rod, not the frame
    if (!f) { hardReset(); return; }
    const p = f.p;
    f.elapsed += dt;

    /* --- surges: the fish makes a run for it --- */
    if (f.surgeTime > 0) {
      f.surgeTime -= dt;
      const k = U.clamp(f.surgeTime / f.surgeDur, 0, 1);
      f.surge = Math.sin(k * Math.PI) * f.surgeStrength;
      if (f.surgeTime <= 0) {
        f.surge = 0;
        f.nextSurge = VF.rng.g.range(1.9, 4.4) / p.surgeRate;
      }
    } else {
      f.nextSurge -= dt;
      f.telegraph = U.clamp(1 - f.nextSurge / 0.45, 0, 1);
      if (f.nextSurge <= 0) {
        f.surgeDur = VF.rng.g.range(0.85, 1.75);
        f.surgeTime = f.surgeDur;
        f.surgeStrength = U.clamp(VF.rng.g.range(0.45, 1.0) * (0.55 + p.erratic * 0.7), 0.2, 1.15);
        f.telegraph = 0;
        VF.bus.emit('fishing:surge', f);
      }
    }

    /* --- pull: weakens as the fish tires --- */
    const pull = p.power * (0.34 + 0.66 * f.stamina) * (1 + f.surge * 1.55);

    /* --- tension ---
       Load is the fish's pull measured against what the line can take, so an
       over-matched rod is genuinely dangerous and a well-matched one is calm. */
    const load = pull / Math.max(0.35, p.lineStrength);
    f.load = load;
    if (f.reeling) {
      f.tension += (0.50 + load * 2.70) * dt;
      f.slack = 0;
    } else {
      // a heavily loaded line bleeds off slowly; a surging fish keeps loading it
      const bleed = 0.95 - Math.min(0.42, load * 0.75);
      f.tension += (f.surge * 0.30 - bleed) * dt;
      if (f.tension < 0.07) f.slack += dt; else f.slack = 0;
    }
    f.tension = U.clamp(f.tension, 0, 1.05);

    /* --- the sweet band: hold here and the fish comes in faster --- */
    f.inSweet = f.tension >= 0.45 && f.tension <= 0.74;
    if (f.tension > 0.82) f.perfect = false;

    /* --- distance --- */
    if (f.reeling) {
      const speed = (0.45 + Math.pow(p.reelForce, 0.6) * 0.32) / (0.85 + p.power * 5.6);
      const bonus = f.inSweet ? 1.35 : 1.0;
      const fight = 1 - U.clamp(f.surge * 0.55, 0, 0.75);
      f.distance -= speed * bonus * fight * dt;
      f.stamina -= dt / (p.stamina * 22);
    } else if (f.surge > 0.55) {
      // the fish takes line back if you let it run
      f.distance += f.surge * 0.055 * dt;
      f.stamina -= dt / (p.stamina * 64);
    }
    f.distance = U.clamp(f.distance, 0, 1.15);
    f.stamina = U.clamp(f.stamina, 0, 1);

    f.shakeAmt = U.clamp((f.tension - 0.72) / 0.28, 0, 1) * (0.5 + f.surge * 0.5);

    /* --- resolution --- */
    if (f.tension >= 0.995) {
      f.snapTimer += dt;
      if (f.snapTimer >= SNAP_GRACE) { lose('snap'); return; }
    } else {
      f.snapTimer = Math.max(0, f.snapTimer - dt * 1.6);
    }

    if (f.slack >= SLACK_LIMIT) { lose('slack'); return; }

    if (f.distance <= 0) { land(); return; }
  }

  /* ---------------------------------------------------------------- outcomes */

  function land() {
    const f = S.fight;
    const c = f.c;
    const d = VF.state.data;

    if (c.kind === 'treasure') { landTreasure(c, f); return; }

    d.stats.catches++;
    d.streak++;
    if (d.streak > d.records.bestStreak) d.records.bestStreak = d.streak;
    if (f.perfect) d.stats.perfectReels++;

    const rank = VF.rarities.rank(c.rarity);
    if (rank >= 4) d.stats.legendaryCatches++;
    if (rank >= 6) d.stats.voidCatches++;
    d.flags['rare_' + c.rarity] = true;

    const traits = c.traits || [];
    if (traits.length) {
      d.stats.mutationsFound++;
      if (traits.length >= 2) d.stats.multiTrait++;
      if (traits.length >= 3) d.flags.combo3 = true;
      if (traits.length >= 4) d.flags.combo4 = true;
      for (let i = 0; i < traits.length; i++) {
        d.traitsSeen[traits[i]] = (d.traitsSeen[traits[i]] | 0) + 1;
        d.flags['mut_' + traits[i]] = true;
        d.flags['trait_' + traits[i]] = true;
      }
    }
    if (c.isGiant) d.flags.caughtGiant = true;
    if (rank >= 6) VF.journal.add('firstvoid');

    /* fishdex */
    let entry = d.fishdex[c.id];
    if (!entry) {
      entry = d.fishdex[c.id] = { caught: 0, record: null, firstSeen: Date.now(), mutations: {} };
    }
    entry.caught++;
    if (!entry.traits) entry.traits = {};
    for (let i = 0; i < traits.length; i++) {
      entry.traits[traits[i]] = (entry.traits[traits[i]] | 0) + 1;
      entry.mutations[traits[i]] = (entry.mutations[traits[i]] | 0) + 1;
    }
    if (!entry.record || c.kg > entry.record.kg) {
      if (entry.record) d.stats.recordsBroken++;
      entry.record = { kg: c.kg, m: c.m, pct: c.pct, traits: traits.slice(),
                       mutation: traits.length ? traits[0] : null, at: Date.now() };
    }
    if (c.kg > d.stats.biggestKg) { d.stats.biggestKg = c.kg; d.stats.biggestFish = c.id; }
    if (rank > d.stats.rarestRank) { d.stats.rarestRank = rank; d.stats.rarestFish = c.id; }

    /* the record board */
    const R = d.records;
    if (c.kg > R.biggestKg) { R.biggestKg = c.kg; R.biggestId = c.id; R.biggestTraits = traits.slice(); }
    if (c.value > R.richest) { R.richest = c.value; R.richestId = c.id; R.richestTraits = traits.slice(); }
    const combo = VF.traits.comboScore(traits);
    if (combo > R.bestCombo) { R.bestCombo = combo; R.bestComboId = c.id; R.bestComboTraits = traits.slice(); }
    if (c.m > R.longestSpecies) { R.longestSpecies = c.m; R.longestId = c.id; }

    VF.progression.addXp(c.xp);

    S.fight = null;
    S.lastResult = c;
    S.encounterActive = false;
    setState('landed');
    VF.bus.emit('fishing:landed', c);
    VF.save.save();
  }

  /* Objects go straight into the record and the journal; there is no fight to
     have lost and no fishdex entry to make. */
  function landTreasure(c, f) {
    const d = VF.state.data;
    const t = c.treasure;
    d.stats.treasuresFound++;
    d.treasures[t.id] = (d.treasures[t.id] | 0) + 1;
    if (t.journal) VF.journal.add(t.journal);
    if (t.token) d.caseTokens++;
    if (t.relic) VF.charms.grant(t.relic);
    S.fight = null;
    S.lastResult = c;
    S.encounterActive = false;
    setState('landed');
    VF.bus.emit('fishing:treasure', c);
    VF.save.save();
  }

  function lose(reason) {
    const c = S.fight ? S.fight.c : null;
    VF.state.data.stats.escapes++;
    VF.state.data.streak = 0;
    if (reason === 'snap') VF.state.data.stats.linesSnapped++;
    S.fight = null;
    S.encounterActive = false;
    setState('idle');
    VF.bus.emit('fishing:lost', { reason: reason, catch: c });
  }

  /* Player reels in without a fish on (cancel a cast). */
  function reelIn() {
    if (S.state === 'waiting' || S.state === 'bite') {
      S.pending = null;
      setState('idle');
      VF.bus.emit('fishing:reelin');
      return true;
    }
    return false;
  }

  /* Called once the catch modal is dismissed. */
  function resolveCatch() {
    if (S.state !== 'landed') return;
    S.lastResult = null;
    setState('idle');
    VF.bus.emit('fishing:ready');
  }

  /* ---------------------------------------------------------------- driver */

  function setState(s) {
    S.state = s;
    S.t = 0;
    VF.bus.emit('fishing:state', s);
  }

  function tick(dt) {
    S.t += dt;

    if (S.charging) {
      S.charge += dt / CAST_CHARGE_TIME;
      if (S.charge >= 1) { S.charge = 1; releaseCharge(); }
    }

    switch (S.state) {
      case 'casting':
        S.flight = U.clamp(S.t / CAST_FLIGHT_TIME, 0, 1);
        if (S.t >= CAST_FLIGHT_TIME) {
          VF.bus.emit('fishing:splash', { dist: S.castDist });
          beginWaiting();
        }
        break;

      case 'waiting':
        S.biteWait -= dt;
        S.nibbleTimer -= dt;
        if (S.nibbleTimer <= 0) {
          S.nibble = 1;
          S.nibbleTimer = VF.rng.g.range(1.6, 4.2);
          VF.bus.emit('fishing:nibble');
        }
        S.nibble = Math.max(0, S.nibble - dt * 1.8);
        if (S.biteWait <= 0) {
          const opts = S.pendingOpts;
          S.pendingOpts = null;
          triggerBite(opts);
        }
        break;

      case 'bite':
        if (S.t >= (S.biteWindow || BITE_WINDOW)) {
          S.pending = null;
          VF.bus.emit('fishing:missed');
          beginWaiting();
        }
        break;

      case 'reeling':
        updateFight(dt);
        break;

      case 'landed':
        // watchdog: the catch card owns this state, so if it is gone the catch
        // is resolved here rather than leaving the rod unusable
        if (S.t > 25 && !(VF.catchUI && VF.catchUI.isOpen())) resolveCatch();
        break;
    }
  }

  /* Encounters force the next bite to be something enormous. */
  function queueEncounter(opts) {
    if (S.state !== 'waiting') return false;
    S.encounterActive = true;
    S.pendingOpts = opts;
    S.biteWait = Math.min(S.biteWait, opts.delay || 3.2);
    return true;
  }

  /* Return the rod to a usable state from anywhere (used by save reset). */
  function hardReset() {
    S.charging = false;
    S.charge = 0;
    S.pending = null;
    S.pendingOpts = null;
    S.fight = null;
    S.lastResult = null;
    S.encounterActive = false;
    if (S.state !== 'idle') setState('idle');
  }

  VF.fishing = {
    S: S,
    hardReset: hardReset,
    tick: tick,
    canCast: canCast,
    beginCharge: beginCharge,
    releaseCharge: releaseCharge,
    hook: hook,
    setReeling: setReeling,
    reelIn: reelIn,
    resolveCatch: resolveCatch,
    queueEncounter: queueEncounter,
    state: function () { return S.state; },
    CAST_CHARGE_TIME: CAST_CHARGE_TIME,
    BITE_WINDOW: BITE_WINDOW,
    SWEET_FROM: SWEET_FROM
  };
})(window.VF = window.VF || {});
