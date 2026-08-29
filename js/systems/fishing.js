/* VOID FISHING — the fishing loop.
   idle -> casting -> waiting -> bite -> reeling -> landed | lost -> idle
   Nothing here can deadlock: every state has a timeout or an exit condition,
   and the fight drains to nothing on its own if it is left unattended. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const CAST_CHARGE_TIME = 1.05;   // seconds to fill the power meter
  const CAST_FLIGHT_TIME = 0.72;   // bobber travel time
  const SWEET_FROM = 0.80;         // top of the meter gives a rare-chance bonus
  const BITE_WINDOW = 1.35;        // seconds to react to a bite
  const BITE_WINDOW_BIG = 2.6;     // an encounter is too rare to lose to a slow hand
  const FISH_EDGE = 0.012;         // the indicator has width; it stops short of the wall
  const SURGE_GAP = 0.85;          // seconds between the runs that shake the screen

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

    /* Where the line is going, in world coordinates.

       The cast used to have no position at all: the renderer picked a random
       lateral every time and threw it away afterwards, and nothing downstream
       ever saw it. That is why no zone could make "where do I put the bobber"
       into a question — there was no answer to give.

       `aimU`/`aimD` are what the player is pointing at; `castU`/`castD` are
       where it actually went, which is short of the aim on a weak throw, past
       the rod's reach never, and somewhere else entirely in water that does
       not agree with charts. */
    aimU: 0, aimD: 0.55,
    castU: 0, castD: 0.55,
    castCtx: null,       // what the water is like where it landed

    biteWait: 0,
    nibble: 0,           // small pre-bite bobber twitches
    nibbleTimer: 0,

    pending: null,       // rolled catch waiting to be hooked
    pendingOpts: null,   // forced roll options from an encounter
    armed: null,         // a species the owner console put on the next cast
    biteWindow: BITE_WINDOW,
    fight: null,

    lastResult: null,
    lastFight: null,     // how the last fight went, for anything watching
    approach: null,      // { rank, rarity, t, dur } while something rare closes in
    encounterActive: false
  };

  /* How long before the bite the roll happens. Anything from the void tier up
     is visible on its way in, so what is on the end of the line has to be
     decided before the line knows about it. */
  const APPROACH_LEAD = 5.5;
  const APPROACH_MIN = 4.2;    // and the wait stretches so there is time to see it

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
    /* Ordinarily this clears whatever the last cast left armed. If the owner
       console has named a species for the next cast, that is not leftovers —
       it is the instruction — so it survives into pendingOpts and is spent
       here rather than lingering into the cast after. */
    S.pendingOpts = S.armed ? { forceFish: S.armed } : null;
    S.armed = null;
    if (!VF.bait.consume(d.bait)) { d.bait = 'worm'; VF.bait.consume('worm'); }

    const rod = VF.rods.get(d.rod);
    S.castPower = U.clamp(power, 0, 1);
    S.sweet = S.castPower >= SWEET_FROM;
    S.castDist = U.clamp(rod.cast * (0.55 + 0.45 * S.castPower), 0.05, 1.6);
    resolveCast(rod);
    S.flight = 0;
    S.pending = null;
    S.fight = null;
    d.stats.casts++;

    setState('casting');
    VF.bus.emit('fishing:cast', { power: S.castPower, sweet: S.sweet, dist: S.castDist,
                                  u: S.castU, d: S.castD });
  }

  /* Where the throw lands.

     The rod's `cast` is a reach now rather than an abstract number: point at
     something further out than the rod can manage and the rig falls short of
     it, which is a far better argument for the next rod than a percentage.
     The meter is accuracy on top of that — a weak throw drops in early — so
     the gold band is worth hitting for a reason you can see.

     A zone gets the last word through `castScatter`, because the one place
     where the line does not go where it was pointed should be the one that
     tells you the chart is wrong. */
  /* How far out this rod can put the rig, as a distance across the water.

     `rod.cast` runs 0.22 on the wooden one to 1.84 at the top of the ladder,
     so the mapping has to give the starter rod somewhere useful to fish — a
     third of the way out — and the best rod the horizon. Treating cast as a
     fraction directly put every rod's limit at a tenth of the water and made
     aiming pointless, which is the sort of thing that looks like a design
     problem and is arithmetic.

     Lives here rather than in the renderer so the mark the player is shown and
     the place the rig lands cannot disagree. */
  function reach() {
    const rod = VF.rods.get(VF.state.data.rod);
    /* Where there is no water to reach across — the last water, and Beneath —
       the same throw puts the hook straight down instead, so the range
       collapses toward the near end however good the rod is. */
    const vd = U.clamp(VF.palette.P.void || 0, 0, 1);
    return U.clamp((0.26 + rod.cast * 0.42) * (1 - vd * 0.55), 0.12, 1.0);
  }

  function resolveCast(rod) {
    const r = reach();
    const want = U.clamp(S.aimD, 0.04, 1.0);
    const got = Math.min(want, r) * (0.62 + 0.38 * S.castPower);
    S.castD = U.clamp(got, 0.03, 1.0);
    S.castU = S.aimU;

    const rule = VF.zones && VF.zones.castScatter ? VF.zones.castScatter() : 0;
    if (rule > 0) {
      const sp = VF.space ? VF.space.uSpan(S.castD) : 1;
      S.castU += (VF.rng.g() * 2 - 1) * rule * sp;
      S.castD = U.clamp(S.castD + (VF.rng.g() * 2 - 1) * rule * 0.30, 0.03, 1.0);
    }
    S.castCtx = null;
  }

  /* What the water is like where the rig went down. Resolved once, on the
     splash, and read by the bite timer and the species roll — so a cast beside
     a wreck is a different cast from one into open water, in a way the player
     can see the reason for before they make it. */
  function readWater() {
    if (!VF.space || !VF.landmarks) { S.castCtx = null; return; }
    const near = VF.landmarks.nearest(S.castU, S.castD);
    const inf = VF.landmarks.influenceAt(S.castU, S.castD);
    S.castCtx = {
      u: S.castU, d: S.castD,
      /* depth reads off the zone's own profile where it has one, and off the
         distance from the bank where it does not */
      depth: VF.zones && VF.zones.depthAt ? VF.zones.depthAt(S.castU, S.castD) : S.castD,
      cover: U.clamp(inf, 0, 2),
      landmark: near && near.dist < VF.landmarks.radiusOf(near.landmark) * 1.4
        ? near.landmark : null,
      lit: VF.zones && VF.zones.lightAt ? VF.zones.lightAt(S.castU, S.castD) : 0.5
    };
    VF.bus.emit('fishing:water', S.castCtx);
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
              (VF.mods ? VF.mods.stats().bite : 1) *
              (1 - U.clamp(rod.cast * 0.12, 0, 0.22)) *
              (1 - U.clamp(S.castPower * 0.10, 0, 0.10)) *
              /* and where it went. Structure holds fish: dropping the rig
                 beside something is worth about a third off the wait, and
                 open water in the middle of nowhere is worth a penalty. */
              (S.castCtx ? U.clamp(1 - S.castCtx.cover * 0.34, 0.55, 1.25) : 1) *
              (VF.zones && VF.zones.biteAt ? VF.zones.biteAt(S.castCtx) : 1);
    S.biteWait = U.clamp(base * k, 1.6, 22);
    // it is already there. it has been there for four hundred years.
    if (VF.quests && VF.quests.anyArmed()) S.biteWait = Math.min(S.biteWait, 2.6);
    S.nibbleTimer = VF.rng.g.range(1.0, 2.4);
    S.nibble = 0;
    setState('waiting');
    VF.bus.emit('fishing:waiting');
    // the line goes somewhere it has not been before
    if (VF.secrets) VF.secrets.tryFind();
  }

  /* What is on the end of the line. Decided here rather than at the moment of
     the bite, because something rare enough is seen coming before it arrives
     and that is only possible if the roll has already happened. Returns the
     record and changes nothing. */
  function rollBite(opts) {
    opts = opts || {};

    /* A quest that has put something specific in the water gets first refusal:
       no treasure, no roll, and the window is generous — losing the heaven's
       trial to a slow hand on the hookset would be a poor way to lose it. */
    const armed = VF.quests && VF.quests.anyArmed();
    if (armed && armed.trial && !opts.minRank) {
      const c = VF.loot.roll({ forceFish: armed.trial.fish });
      c.kind = 'fish';
      c.trial = armed.trial;
      c.wide = true;
      return c;
    }

    /* And then the one that comes back, if it is due. Ahead of the treasure
       roll and the ordinary draw, behind the quest, because a thread already
       running outranks a story that has waited this long and can wait another
       cast. */
    if (!opts.minRank && VF.returning) {
      const back = VF.returning.offer();
      if (back) return back;
    }

    if (S.sweet && !opts.minRank) opts = Object.assign({}, opts, { rareBoost: 1.12 });

    // an encounter is always a fish; otherwise the hook may have found an object
    if (!opts.minRank && VF.rng.g() < VF.treasureData.chance()) {
      const t = VF.treasureData.roll();
      if (t) {
        return { kind: 'treasure', treasure: t, rarity: t.rarity,
                 rarityDef: VF.rarities.get(t.rarity), traits: [],
                 fish: { name: t.name, diff: 0.2, art: null } };
      }
    }

    const c = VF.loot.roll(opts);
    c.kind = 'fish';
    if (opts.minRank) c.wide = true;
    /* A species can carry its own scripted fight. It runs on exactly the same
       machinery the heaven's trial does, so the phase announcements and the
       loadout maths come along with it and nothing here has to know which
       species it is. Losing one of these to a slow hand on the hookset would
       be a miserable way to lose it, so the window opens wide. */
    if (c.fish && c.fish.trial) { c.trial = c.fish.trial; c.wide = true; }
    /* And above Legendary, the tier writes one if the species did not. A rare
       fish used to be a slightly longer version of a common one; now it is a
       different fight, which is what all the machinery in front of it — the
       shadow coming in, the ducked audio, the prompt — was announcing. */
    else if (VF.trials) {
      const t = VF.trials.forCatch(c);
      if (t) { c.trial = t; c.wide = true; }
    }
    return c;
  }

  /* The shadow crossing the water toward the hook. Only the top of the
     catalogue gets one — below that a bite should still be a surprise. */
  function beginApproach(c) {
    if (!c || c.kind !== 'fish') return false;
    const rank = VF.rarities.rank(c.rarity);
    if (rank < 6) return false;
    // stretch the wait if there is not enough of it left to see anything
    S.biteWait = Math.max(S.biteWait, APPROACH_MIN);
    S.approach = { rank: rank, rarity: c.rarity, t: 0, dur: S.biteWait };
    VF.bus.emit('fishing:approach', S.approach);
    return true;
  }

  function endApproach() {
    if (!S.approach) return;
    S.approach = null;
    VF.bus.emit('fishing:approach:end');
  }

  function triggerBite(opts) {
    if (!S.pending) S.pending = rollBite(opts || S.pendingOpts);
    S.pendingOpts = null;
    /* An encounter gets first refusal on the moment of the bite. Some of them
       are the bite — the thief takes the bait instead of taking the hook —
       and the only way for that to read as one event rather than two is for
       it to happen here, before the ordinary bite is announced. */
    if (VF.creature && VF.creature.tryOnBite(S.pending)) {
      S.pending = null;
      endApproach();
      setState('waiting');
      S.biteWait = 9999;         // the encounter owns the rod now
      return;
    }
    S.biteWindow = S.pending.wide ? BITE_WINDOW_BIG : BITE_WINDOW;
    endApproach();
    setState('bite');
    VF.bus.emit('fishing:bite', S.pending);
  }

  /* Put a named species on the line right now, hooked and fighting.

     This is how an encounter hands the rod back: it has already done the
     tracking, the chase and the choice, and what is left is the fight, which
     the game already has and which there is no reason to write twice. The
     catch that comes out the far end is an ordinary catch with a `creature`
     tag on it, so the card, the fishdex, the wall and the aquarium need to
     know nothing about any of this. */
  function putOnLine(fishId, extra) {
    const f = VF.fish.byId(fishId);
    if (!f) return false;
    const c = VF.loot.roll({ forceFish: fishId });
    c.kind = 'fish';
    if (extra) for (const k in extra) c[k] = extra[k];
    if (c.fish && c.fish.trial) c.trial = c.fish.trial;
    else if (VF.trials) { const t = VF.trials.forCatch(c); if (t) c.trial = t; }
    c.wide = true;
    S.pending = c;
    S.biteWindow = BITE_WINDOW_BIG * 2;
    endApproach();
    setState('bite');
    VF.bus.emit('fishing:bite', c);
    /* Set for them. Making somebody react to a hookset they were not told was
       coming, at the end of an encounter they have been playing for two
       minutes, is a way to lose one to a keystroke. */
    hook();
    return true;
  }

  /* ---------------------------------------------------------------- the fight

     One control, one job. Hold and the white bar drives right; let go and it
     runs back left. Keep the fish inside the bar and the progress bar fills;
     let the fish out and it drains. Full is a fish on the bank, empty is a
     fish that got away.

     Everything about how hard that is comes out of loot.fightParams() — the
     species, its rarity, its size, the rod and the worn charms — so the loop
     below has no randomness in it beyond where the fish decides to go next.

     The fight object also keeps `tension`, `surge`, `distance`, `stamina` and
     `shakeAmt` up to date. Those are what the scene bends the rod with, what
     the angler leans on and what the reel audio tracks; they are derived from
     the minigame every frame rather than simulated separately. */

  function hook() {
    if (S.state !== 'bite' || !S.pending) return false;
    const spec = S.pending.trial || null;
    const p = spec ? VF.loot.trialParams(spec.phases[0])
            : S.pending.kind === 'treasure' ? treasureFight()
            : VF.loot.fightParams(S.pending);
    S.fight = {
      c: S.pending,
      p: p,

      /* the white bar — centre and velocity, both in track widths */
      bar: 0.5,
      barV: 0,
      barW: p.barW,
      held: false,

      /* the fish indicator */
      fish: 0.5,
      fishV: 0,
      target: 0.5,
      turn: 0.30,
      wob: VF.rng.g.range(0, Math.PI * 2),
      lastSurge: 0,

      /* the bottom bar */
      progress: p.start,
      inside: true,
      outsideT: 0,
      lastEdge: -9,        // when grip/slip last spoke, so it cannot chatter
      perfect: true,
      saved: false,          // whether a rod has already pulled this one back
      penalty: null,         // and what that cost the fish, if it has
      elapsed: 0,

      /* derived each frame for the scene, the angler and the audio */
      tension: 0.40, surge: 0, distance: 1, stamina: 1,
      shakeAmt: 0, reeling: true,

      /* a scripted fight walks its phases as the meter climbs, and never
         walks back down them */
      trial: spec ? { spec: spec, i: 0 } : null
    };
    S.pending = null;
    if (spec) VF.bus.emit('fishing:phase', { fight: S.fight, index: 0,
      name: spec.phases[0].name, of: spec.phases.length });
    setState('reeling');
    VF.bus.emit('fishing:hooked', S.fight);
    return true;
  }

  /* Objects do not fight back. They are heavy and awkward and they sit still,
     so the bar is generous and the thing on the end of it barely moves. */
  function treasureFight() {
    // the same loadout as any other fight: salvage was the one place the rod's
    // own bar stats did nothing while the charms' identical stats still worked
    const L = VF.loot.loadout();
    return {
      diff: 0.12,
      barW: U.clamp(0.34 * L.rodBar * L.barSize, 0.12, 0.52),
      barSpeed: 0.78 * L.barMul,
      barTau: 0.170 / (1 + 0.60 * L.q),
      fishSpeed: 0.16, fishStiff: 6, fishDrag: 1.10 * Math.sqrt(6),
      fishTurn: 1.5, dart: 0.05, evade: 0, wobble: 0.015,
      fill: 0.42 * L.fillMul, drain: 0.20, start: 0.40
    };
  }

  /* The one control. The HUD calls this from every input path it owns —
     space, enter, mouse and touch all arrive here. */
  function setReeling(on) {
    if (S.state !== 'reeling' || !S.fight) return;
    if (S.fight.held === on) return;
    S.fight.held = on;
  }

  /* Where the fish decides to go next. Rare fish turn more often, run harder,
     and — only at the very top of the catalogue — start reading where the bar
     is and going the other way. */
  function pickFishTarget(f) {
    const p = f.p;
    const R = VF.rng.g;
    f.turn = p.fishTurn * R.range(0.62, 1.42);

    if (R() < p.dart) {
      /* a hard run to the other end of the track */
      let t = R() < 0.5 ? R.range(0.03, 0.34) : R.range(0.66, 0.97);
      if (R() < p.evade) t = f.bar < 0.5 ? R.range(0.62, 0.97) : R.range(0.03, 0.38);
      f.target = t;
      f.fishV += (t > f.fish ? 1 : -1) * p.fishSpeed * R.range(0.45, 0.90);
      f.turn *= 0.80;
      // the screen only shakes for runs that are worth shaking for
      if (f.elapsed - f.lastSurge > SURGE_GAP && p.fishSpeed > 0.34) {
        f.lastSurge = f.elapsed;
        VF.bus.emit('fishing:surge', f);
      }
    } else {
      /* a short drift, further the harder the fish is */
      f.target = U.clamp(f.fish + R.range(-0.30, 0.30) * (0.55 + p.diff), 0.03, 0.97);
    }
  }

  /* The frame loop clamps dt to 100ms, which on a machine having a bad moment
     is six frames of fight in one step. The fish's pull toward its target is a
     plain Euler integration, so a step that large would overshoot and jitter.
     Slicing it keeps the fight identical at 144Hz and at 15fps. */
  const MAX_STEP = 1 / 60;

  /* Phases are gated on the meter rather than on a clock, so the fight is as
     long as the player makes it, and they only ever go one way — losing ground
     inside the void does not put you back in the storm. */
  /* Whatever the fish learned on its way off the hook, re-applied to the
     numbers currently in force. */
  function applyPenalty(f) {
    if (!f.penalty) return;
    f.p.fishSpeed *= f.penalty.speed;
    f.p.dart = Math.min(0.95, f.p.dart * f.penalty.dart);
    f.p.drain *= f.penalty.drain;
  }

  function advancePhase(f) {
    const ph = f.trial.spec.phases;
    let want = f.trial.i;
    for (let i = f.trial.i + 1; i < ph.length; i++) if (f.progress >= ph[i].at) want = i;
    if (want === f.trial.i) return;
    f.trial.i = want;
    const np = VF.loot.trialParams(ph[want]);
    f.p = np;
    applyPenalty(f);
    f.barW = np.barW;
    // the walls move; the bar stays where the player left it
    f.bar = U.clamp(f.bar, np.barW / 2, 1 - np.barW / 2);
    VF.bus.emit('fishing:phase', { fight: f, index: want, name: ph[want].name, of: ph.length });
  }

  function updateFight(dt) {
    if (!S.fight) { hardReset(); return; }
    /* Something can arrive under a fight already in progress and take it
       over. Checked once a frame rather than once a step: the devourer is a
       rare event, not a per-substep dice roll, and it must not become more
       likely on a machine with a long frame. */
    if (VF.creature && !VF.creature.active() && !S.fight.c.creature) {
      const took = VF.creature.tryOnReel(S.fight.c, S.fight.progress);
      if (took) { interrupt(S.fight.c); return; }
    }
    let left = dt;
    while (left > 1e-6 && S.state === 'reeling' && S.fight) {
      const h = Math.min(MAX_STEP, left);
      left -= h;
      stepFight(h);
    }
  }

  /* A fight taken off the rod by something else. Not a loss: nothing is
     recorded, no streak is broken and no line is snapped — what was on the
     hook is now part of whatever is happening instead. */
  function interrupt(c) {
    S.fight = null;
    S.pending = null;
    S.encounterActive = false;
    S.biteWait = 9999;
    setState('waiting');
    VF.bus.emit('fishing:interrupt', c);
  }

  function stepFight(dt) {
    const f = S.fight;
    if (f.trial) advancePhase(f);
    const p = f.p;
    f.elapsed += dt;

    /* --- the white bar ---
       Velocity chases +speed while held and -speed while not, on an
       exponential approach, so it accelerates and decelerates instead of
       snapping between positions. The same curve at any frame rate, and a
       quick tap moves it a little rather than not at all. */
    const half = f.barW / 2;
    const lo = half, hi = 1 - half;
    const want = f.held ? p.barSpeed : -p.barSpeed;
    f.barV += (want - f.barV) * (1 - Math.exp(-dt / p.barTau));
    f.bar += f.barV * dt;
    // the bar stops at the ends of the track rather than running past them,
    // and drops the momentum it had so it leaves again from a standstill
    if (f.bar <= lo) { f.bar = lo; if (f.barV < 0) f.barV = 0; }
    else if (f.bar >= hi) { f.bar = hi; if (f.barV > 0) f.barV = 0; }

    /* --- the fish --- */
    f.turn -= dt;
    if (f.turn <= 0) pickFishTarget(f);
    const wob = Math.sin(f.elapsed * 2.3 + f.wob) * p.wobble;
    f.fishV += ((f.target + wob) - f.fish) * p.fishStiff * dt;
    f.fishV *= Math.exp(-p.fishDrag * dt);
    f.fishV = U.clamp(f.fishV, -p.fishSpeed, p.fishSpeed);
    f.fish += f.fishV * dt;
    if (f.fish < FISH_EDGE) {
      f.fish = FISH_EDGE; f.fishV = Math.abs(f.fishV) * 0.45;
      f.target = VF.rng.g.range(0.18, 0.70);
    } else if (f.fish > 1 - FISH_EDGE) {
      f.fish = 1 - FISH_EDGE; f.fishV = -Math.abs(f.fishV) * 0.45;
      f.target = VF.rng.g.range(0.30, 0.82);
    }

    /* --- the bar either has the fish or it does not --- */
    const gap = Math.abs(f.fish - f.bar);
    const was = f.inside;
    f.inside = gap <= half;
    if (f.inside) {
      f.outsideT = 0;
      f.progress += p.fill * dt;
    } else {
      f.outsideT += dt;
      f.perfect = false;
      // the further out the fish gets, the faster the progress goes
      const away = U.clamp((gap - half) / 0.22, 0, 1);
      // and it takes a moment to get going, so a slip the player catches
      // straight away costs a little rather than most of the bar
      const ramp = U.clamp(f.outsideT / 0.18, 0.25, 1);
      f.progress -= p.drain * (0.62 + 0.58 * away) * ramp * dt;
    }
    f.progress = U.clamp(f.progress, 0, 1);
    /* Holding the fish against the edge of the bar is exactly what good play
       looks like, and `inside` can flip on consecutive frames there. The
       progress above uses every one of those frames; the announcement does
       not, or it would fire sixty times a second. */
    if (f.inside !== was && f.elapsed - f.lastEdge > 0.15) {
      f.lastEdge = f.elapsed;
      VF.bus.emit(f.inside ? 'fishing:grip' : 'fishing:slip', f);
    }

    /* --- what the rest of the game reads ---
       The rod bends off `tension`, the hooked shadow swims in on `distance`
       and thrashes on `surge`. All three are the minigame, seen from outside. */
    const speed01 = U.clamp(Math.abs(f.fishV) / Math.max(0.05, p.fishSpeed), 0, 1);
    const edge = half > 0 ? U.clamp(gap / half, 0, 1) : 1;
    f.tension = f.inside ? 0.30 + edge * 0.34 : U.clamp(0.70 + (gap - half) * 1.3, 0, 1);
    f.surge = speed01;
    // the ground gained on top of where the fight started, so the hooked
    // shadow swims up out of the dark rather than starting a third of the way in
    f.distance = 1 - U.clamp((f.progress - p.start) / Math.max(0.05, 1 - p.start), 0, 1);
    f.stamina = U.clamp(1 - f.progress * 0.92, 0, 1);
    f.shakeAmt = f.inside ? 0 : U.clamp(f.outsideT * 1.5, 0, 1) * (0.45 + speed01 * 0.55);
    f.reeling = f.inside;

    /* --- resolution --- */
    if (f.progress >= 1) { land(); return; }
    if (f.progress <= 0) { lose(gap > half + 0.20 ? 'snap' : 'slack'); return; }
    /* One fight in the game is written to be lost, and a meter that only ever
       falls does not fall while the player is holding it — so somebody good
       enough could hold a hopeless fight open indefinitely. It ends on a clock
       instead. Nothing else sets this. */
    if (p.maxTime && f.elapsed >= p.maxTime) { lose('slack'); return; }
  }

  /* ---------------------------------------------------------------- outcomes */

  function land() {
    const f = S.fight;
    const c = f.c;

    // the fight is about to be thrown away; anything that wants to know how it
    // went — the quest trials, mostly — reads it from here
    S.lastFight = { perfect: f.perfect, barW: f.barW, diff: f.p.diff,
                    elapsed: f.elapsed, trial: !!f.trial };

    if (c.kind === 'treasure') { landTreasure(c, f); return; }
    record(c);
  }

  /* A catch that arrived without a fight. There is exactly one of these — the
     line left out overnight — and it has to be written down the same way
     everything else is, or it is a fish that did not happen: no fishdex entry,
     no record broken, no experience, no achievement.

     So the recording is its own function and both doors reach it. It is also
     the only sane place to put it: duplicating sixty lines of bookkeeping for
     one feature is how the two copies start disagreeing. */
  function acceptCatch(c) {
    if (!c || S.state === 'reeling') return false;
    S.fight = null;
    S.lastFight = null;
    record(c);
    return true;
  }

  function record(c) {
    const d = VF.state.data;

    d.stats.catches++;
    d.streak++;
    if (d.streak > d.records.bestStreak) d.records.bestStreak = d.streak;
    if (S.lastFight && S.lastFight.perfect) d.stats.perfectReels++;

    const rank = VF.rarities.rank(c.rarity);
    if (rank >= 4) d.stats.legendaryCatches++;
    if (rank >= 6) d.stats.voidCatches++;
    if (rank >= 7) d.stats.glitchCatches = (d.stats.glitchCatches | 0) + 1;
    if (rank >= 8) d.stats.unknownCatches = (d.stats.unknownCatches | 0) + 1;
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
    if (t.rod) VF.rods.grant(t.rod);
    S.fight = null;
    S.lastResult = c;
    S.encounterActive = false;
    setState('landed');
    VF.bus.emit('fishing:treasure', c);
    VF.save.save();
  }

  function lose(reason) {
    const f = S.fight;

    /* A rod may be allowed to not have lost. The line goes, and then it has
       not gone: the fish is still on, the meter restarts partway down and the
       fight carries on from there. Once per fish, and it costs the clean-fight
       flag, because whatever that was it was not clean. */
    if (f && !f.saved && VF.rods.get(VF.state.data.rod).secondChance) {
      f.saved = true;
      /* It costs, or it is not a perk, it is a better rod with a nicer name.
         The meter restarts well down rather than partway, and whatever that was
         has learned something on its way off the hook: for the rest of this
         fight it is quicker, it runs more often, and it takes the meter back
         faster when it is out of the bar. */
      f.progress = Math.max(0.10, f.p.start * 0.45);
      /* Kept on the fight rather than burned into the current params, because
         a scripted fight replaces those wholesale at the next phase boundary
         and the penalty went with them — refunding the cost of the save on
         precisely the fights where it is worth taking. */
      f.penalty = { speed: 1.22, dart: 1.30, drain: 1.18 };
      applyPenalty(f);
      f.bar = 0.5; f.barV = 0;
      f.fish = 0.5; f.fishV = 0; f.target = 0.5;
      f.inside = true; f.outsideT = 0;
      f.lastEdge = -9;
      f.perfect = false;
      f.held = false;
      const d0 = VF.state.data;
      d0.stats.secondChances = (d0.stats.secondChances | 0) + 1;
      VF.bus.emit('fishing:saved', { reason: reason, catch: f.c });
      return;
    }

    const c = f ? f.c : null;
    /* What the run was worth, read before it is taken away. Losing a fish
       costs the fish and the run, and the second one is the part nobody sees
       happen — so it goes out with the event and gets said out loud. */
    const hadStreak = VF.state.data.streak | 0;
    const lostBonus = Math.round((VF.progression.streakMult() - 1) * 100);
    VF.state.data.stats.escapes++;
    VF.state.data.streak = 0;
    if (reason === 'snap') VF.state.data.stats.linesSnapped++;
    S.fight = null;
    S.encounterActive = false;
    setState('idle');
    VF.bus.emit('fishing:lost', { reason: reason, catch: c,
                                  streak: hadStreak, bonus: lostBonus });
  }

  /* Player reels in without a fish on (cancel a cast). */
  function reelIn() {
    if (S.state === 'waiting' || S.state === 'bite') {
      S.pending = null;
      endApproach();
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
          readWater();
          VF.bus.emit('fishing:splash', { dist: S.castDist, u: S.castU, d: S.castD });
          beginWaiting();
        }
        break;

      case 'waiting':
        /* An encounter has the rod. The bite timer, the nibbles and the
           approach all stop where they are rather than running underneath it
           — a second fish arriving in the middle of the Lurker would be a
           bug the player would read as the game being broken. */
        if (VF.creature && VF.creature.holdsRod()) break;
        S.biteWait -= dt;
        S.nibbleTimer -= dt;
        if (S.nibbleTimer <= 0) {
          S.nibble = 1;
          S.nibbleTimer = VF.rng.g.range(1.6, 4.2);
          VF.bus.emit('fishing:nibble');
        }
        S.nibble = Math.max(0, S.nibble - dt * 1.8);
        /* The roll happens a few seconds early so anything from the void tier
           up can be watched on its way in. Everything else is rolled and
           bitten in the same breath, exactly as before. */
        if (!S.pending && S.biteWait <= APPROACH_LEAD) {
          S.pending = rollBite(S.pendingOpts);
          S.pendingOpts = null;
          beginApproach(S.pending);
        }
        if (S.approach) S.approach.t += dt;
        if (S.biteWait <= 0) triggerBite(null);
        break;

      case 'bite':
        if (S.t >= (S.biteWindow || BITE_WINDOW)) {
          S.pending = null;
          VF.bus.emit('fishing:missed');
          beginWaiting();
        }
        break;

      case 'reeling':
        // nothing opens over a fight by design, but if anything ever does the
        // fight waits rather than draining away behind it
        if (!VF.state.rt.panelOpen) updateFight(dt);
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
    // whatever was already rolled for this cast is not what is coming now
    S.pending = null;
    endApproach();
    S.encounterActive = true;
    S.pendingOpts = opts;
    S.biteWait = Math.min(S.biteWait, opts.delay || 3.2);
    return true;
  }

  /* Put a species on the next cast, whatever the water would have given you.
     Only the owner console calls this. It arms rather than spawning, because
     the interesting part of a rare catch is not the card at the end — it is
     the shadow coming in, the fight and the sequence, and a catch conjured
     straight onto the stone skips all three. */
  function arm(id) {
    const f = VF.fish.byId(id);
    if (!f) return false;
    S.armed = f.id;
    return true;
  }

  /* Return the rod to a usable state from anywhere (used by save reset). */
  function hardReset() {
    S.charging = false;
    S.charge = 0;
    S.pending = null;
    endApproach();
    S.pendingOpts = null;
    S.armed = null;
    S.fight = null;
    S.lastResult = null;
    S.encounterActive = false;
    if (S.state !== 'idle') setState('idle');
  }

  /* The input layer points; this is where it says so. Clamped to the water so
     that a press on the sky, or on the far side of the world, still means the
     nearest sensible patch of sea. */
  function aimAt(u, d) {
    if (!VF.space) return;
    S.aimU = VF.space.clampU(u);
    S.aimD = U.clamp(d, 0.04, 1.0);
  }

  VF.fishing = {
    S: S,
    hardReset: hardReset,
    arm: arm,
    putOnLine: putOnLine,
    acceptCatch: acceptCatch,
    tick: tick,
    canCast: canCast, aimAt: aimAt, readWater: readWater, reach: reach,
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
