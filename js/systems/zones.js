/* VOID FISHING — the rule that only applies here.

   One tick, dispatched on the current zone's `rule`. Everything in here is
   deliberately small: a zone mechanic that needs three hundred lines is a
   mini-game, and nine mini-games is nine games. What each of these does is
   change what the player is DOING for the minute they are standing in it —
   watching for a bottle, waiting out a moon, choosing which shape to cast at,
   pinging into the dark, deciding what the crystals discharge into.

   Per-zone progress lives in d.zoneState, a free-form map in the save, so a
   save from before any of this has none and gets it built on arrival.

   Nothing here is required to fish. Every zone is still a zone you can sit
   and cast in and ignore all of this, which is the game these mechanics are
   guests in. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Runtime only — where the bottle is, which marks are drifting, how long
     until the next ping. Losing it on a reload is correct: it is what is on
     the water right now. */
  const R = {
    bottle: null, bottleT: 40,
    marks: [], markT: 8,
    contact: null, contactT: 40,
    shards: [], shardT: 20,
    echoT: 60, passT: 50,
    prompt: '', promptT: 0, ghosts: null, receding: null, recedeT: 90,
    at: null
  };

  function st(id) {
    const d = VF.state.data;
    if (!d.zoneState || typeof d.zoneState !== 'object') d.zoneState = {};
    if (!d.zoneState[id]) d.zoneState[id] = {};
    return d.zoneState[id];
  }

  function here() { return VF.state.data.location; }
  function zone() { return VF.zoneData.get(here()); }
  function rule() { return VF.zoneData.rule(here()); }

  /* ============================================================ the moon

     A real 30-hour cycle off the wall clock, so it is the same phase for
     everybody at the same moment and it turns over often enough to be worth
     coming back for. Exported because the HUD, the loot roll and the basin's
     own species all ask. */
  const MOON_MS = 30 * 3600 * 1000;

  function moonK() { return ((Date.now() % MOON_MS) / MOON_MS); }

  function moonPhase() {
    const z = VF.zoneData.get('basin');
    if (!z) return null;
    const k = moonK();
    let best = z.phases[0];
    for (let i = 0; i < z.phases.length; i++) {
      const p = z.phases[i];
      const d = Math.abs(((k - p.k) % 1 + 1.5) % 1 - 0.5);
      const bd = Math.abs(((k - best.k) % 1 + 1.5) % 1 - 0.5);
      if (d < bd) best = p;
    }
    return best;
  }

  /* What the current zone is worth to a cast, folded in beside the charms.
     This is where a zone rule becomes a number, and it is the only place. */
  function stats(s) {
    const r = rule();
    if (r === 'moon') {
      const p = moonPhase();
      if (p && p.mods) for (const k in p.mods) if (s[k] !== undefined) s[k] *= p.mods[k];
    } else if (r === 'inverted') {
      const z = st('beneath');
      const dep = U.clamp(z.depth || 0, 0, 1);
      s.rare *= 1 + dep * 0.9;
      s.value *= 1 + dep * 0.6;
      s.bite *= 1 - dep * 0.20;
    } else if (r === 'sonar') {
      /* The trench without a set is the trench in the dark. It is not a
         penalty for not having bought something — it is what the zone is,
         and it is why the set exists. */
      if (!VF.boat || !VF.boat.has('sonar')) s.rare *= 0.86;
      else s.rare *= 1 + VF.boat.level('sonar') * 0.04;
    }
  }

  /* ------------------------------------------------------------ the tick */

  function tick(dt) {
    const id = here();
    if (R.at !== id) { arrive(id); }
    if (R.promptT > 0) { R.promptT -= dt; if (R.promptT <= 0) R.prompt = ''; }
    if (VF.state.rt.panelOpen) return;
    if (VF.creature && VF.creature.active()) return;

    switch (rule()) {
      case 'bottles': tickShore(dt); break;
      case 'moon': tickBasin(dt); break;
      case 'clearwater': tickFlats(dt); break;
      case 'sonar': tickTrench(dt); break;
      case 'resonance': tickAbyss(dt); break;
      case 'drift': tickNowhere(dt); break;
      case 'inverted': tickBeneath(dt); break;
      case 'celestial': tickHeavens(dt); break;
      default: break;
    }
  }

  function arrive(id) {
    R.at = id;
    R.bottle = null; R.marks = []; R.contact = null; R.shards = [];
    R.prompt = ''; R.promptT = 0; R.ghosts = null;
    R.receding = null; R.recedeT = VF.rng.g.range(70, 180);
    const z = VF.zoneData.get(id);
    if (!z) return;
    R.bottleT = z.bottle ? VF.rng.g.range(z.bottle[0], z.bottle[1]) * 0.4 : 999;
    R.markT = z.marks ? VF.rng.g.range(z.marks[0], z.marks[1]) * 0.3 : 999;
    R.contactT = z.contact ? VF.rng.g.range(z.contact[0], z.contact[1]) * 0.4 : 999;
    R.echoT = z.echoAt ? VF.rng.g.range(z.echoAt[0], z.echoAt[1]) : 999;
    R.passT = z.passAt ? VF.rng.g.range(z.passAt[0], z.passAt[1]) : 999;
    R.shardT = 14;
    VF.bus.emit('zone:arrive', id);
  }

  /* The prompt is for things the player would otherwise be confused by —
     a refusal, a rule they have just hit. It is NOT for announcing that
     something has appeared: a line saying "something is drifting in on the
     tide" over a bottle that is visibly drifting in on the tide turns a
     thing you noticed into a thing you were told, and the noticing was the
     whole point. Almost every call to this was doing exactly that, and
     almost every call to this is gone. */
  function say(text, secs) { R.prompt = text; R.promptT = secs || 5; }

  /* ------------------------------------------------- shore: things wash in */

  function tickShore(dt) {
    const z = zone();
    const s = st('shore');

    if (!R.bottle) {
      R.bottleT -= dt;
      if (R.bottleT <= 0) {
        R.bottleT = VF.rng.g.range(z.bottle[0], z.bottle[1]);
        if (VF.pace && !VF.pace.take(1)) return;
        R.bottle = { x: 1.05, y: VF.rng.g.range(0.62, 0.82), t: 0 };
        VF.audio.nibble();
      }
    } else {
      R.bottle.t += dt;
      R.bottle.x -= dt * 0.035;
      if (R.bottle.x < -0.1) R.bottle = null;
    }

    /* Once in a long while, one more island. It sits on the horizon where an
       island sits, at the size an island is, and then over about half a
       minute it gets further away — smaller, and lower, and sliding toward
       the vanishing point — until there is nothing there.

       There is no sound. Nothing is written down. It is not a clue, it does
       not open a lead, it does not count toward anything and there is no
       achievement for having seen it. If the player happens to be looking at
       the horizon, they will spend the rest of the evening wondering. If they
       are looking at the bag, it did not happen. That asymmetry is the point
       and it is the reason this one is silent: the moment a toast fires, the
       game has taken the noticing away and done it on the player's behalf. */
    if (R.receding) {
      R.receding.t += dt;
      if (R.receding.t > R.receding.dur) R.receding = null;
    } else {
      R.recedeT -= dt;
      if (R.recedeT <= 0) {
        R.recedeT = VF.rng.g.range(240, 620);
        if (VF.rng.g() < 0.34 && (!VF.pace || VF.pace.quiet() > 0.85)) {
          R.receding = { t: 0, dur: 34, x: VF.rng.g.range(0.40, 0.88) };
          if (VF.pace) VF.pace.spend(1);
        }
      }
    }

    /* And, once, early on, something that does not belong in ankle-deep
       water crosses the middle distance. It is not explained and there is
       nothing to press: it is the first sentence. */
    if (!s.anomaly && (VF.state.data.stats.casts | 0) >= z.anomalyAt) {
      s.anomaly = Date.now();
      VF.scene.addShadow({ x: -0.3, y: 0.22, sp: 0.030, size: 6.5, alpha: 0.55, life: 26, max: 26 });
      VF.audio.wrongShape();
      VF.fx.pulse(0.4);
      /* No line. Something the size of a house goes past in three feet of
         water and the game does not remark on it — it is on screen for
         twenty-six seconds and either you looked up or you did not. The
         journal entry lands well afterwards, so it reads as a memory of
         something rather than a caption on it. */
      setTimeout(function () { VF.discovery.clue('wrongwater', true); }, 14000);
    }
  }

  /* --------------------------------------------------- basin: the moon --- */

  let lastPhase = null;
  function tickBasin(dt) {
    const p = moonPhase();
    if (!p) return;
    if (lastPhase !== p.id) {
      const first = lastPhase !== null;
      lastPhase = p.id;
      if (first) {
        /* The moon is enormous and directly in front of you. Captioning it
           is telling somebody what colour the sky is. */
        VF.audio.stinger(p.id === 'eclipse' ? 'void' : 'soft', 3);
        VF.bus.emit('moon:phase', p);
      }
      if (p.id === 'eclipse') {
        VF.fx.flash('rgba(20,10,40,0.4)', 1.2, 2.4);
        const s = st('basin');
        if (!s.eclipse) { s.eclipse = Date.now(); VF.discovery.clue('heaven_light'); }
      }
    }
  }

  /* --------------------------------------- flats: you can see it coming --- */

  function tickFlats(dt) {
    const z = zone();
    R.marks.forEach(function (m) {
      m.x -= dt * m.sp;
      m.t += dt;
    });
    R.marks = R.marks.filter(function (m) { return m.x > -0.12; });

    R.markT -= dt;
    if (R.markT <= 0 && R.marks.length < 3) {
      R.markT = VF.rng.g.range(z.marks[0], z.marks[1]);
      /* Each mark is a real species drawn from this water's pool, so pressing
         one is a genuine choice between two fish rather than a guess. */
      const f = VF.loot.pickFish({});
      if (f) {
        R.marks.push({ id: f.id, x: 1.08, y: VF.rng.g.range(0.26, 0.62),
                       sp: VF.rng.g.range(0.020, 0.040), t: 0,
                       rank: VF.rarities.rank(f.rarity) });
      }
    }

    // and, rarely, it stops being water
    const s = st('flats');
    if (!s.cracked && VF.rng.g() < z.crackAt * dt && (!VF.pace || VF.pace.take(3))) {
      s.cracked = Date.now();
      VF.fx.shake(6, 3);
      VF.audio.snap();
      /* It is a crack across the whole zone and it never goes away. It does
         not need a sentence; it needs to still be there tomorrow. */
      VF.discovery.clue('glass_crack', true);
    }
  }

  /* Cast at a shape rather than at the water. The next bite is that one. */
  function pickMark(px, py) {
    if (rule() !== 'clearwater' || !R.marks.length) return false;
    const L = VF.scene.L;
    for (let i = 0; i < R.marks.length; i++) {
      const m = R.marks[i];
      const mx = L.w * m.x, my = L.horizonY + L.waterH * m.y;
      if (Math.hypot(px - mx, py - my) > L.w * 0.06) continue;
      const f = VF.fish.byId(m.id);
      if (!f) return false;
      VF.fishing.arm(m.id);
      R.marks.splice(i, 1);
      VF.fx.ripple(mx, my, L.w * 0.05, 2);
      VF.audio.click();
      return true;
    }
    return false;
  }

  /* ------------------------------------------------- trench: the dark ---- */

  function tickTrench(dt) {
    const z = zone();
    if (!VF.boat || !VF.boat.has('sonar')) return;

    if (R.contact) {
      R.contact.t += dt;
      R.contact.life -= dt;
      if (R.contact.life <= 0) { R.contact = null; }
      return;
    }
    if (R.ghosts) {
      let alive = 0;
      R.ghosts.forEach(function (gh) { gh.t += dt; if (gh.t < gh.life) alive++; });
      if (!alive) R.ghosts = null;
    }

    R.contactT -= dt;
    if (R.contactT > 0) return;
    R.contactT = VF.rng.g.range(z.contact[0], z.contact[1]);
    /* Roughly one sweep in thirty is not a contact, and it wants a long
       quiet in front of it — a screen full of returns is only frightening
       if the set has been showing you an empty ocean for twenty minutes. */
    if (!R.ghosts && VF.rng.g() < 0.034 && (!VF.pace || VF.pace.quiet() > 0.9)) {
      manyContacts();
      if (VF.pace) VF.pace.spend(2);
      return;
    }
    if (VF.pace && !VF.pace.take(2)) return;
    R.contact = {
      x: VF.rng.g.range(0.2, 0.85), y: VF.rng.g.range(0.24, 0.58),
      t: 0, life: 26,
      big: VF.rng.g() < 0.25 + VF.boat.level('sonar') * 0.05
    };
    VF.audio.nibble();
    VF.bus.emit('zone:contact', R.contact);
  }

  /* Once in a long while the set returns more than one, and then more, and
     then more — six or seven of them spread right across the sweep, holding
     station, none of them moving. They are gone in about four seconds and
     nothing is written down about it anywhere. There is no popup, no clue,
     no journal line and no achievement: the only record that it happened is
     that you were looking at the screen. */
  function manyContacts() {
    const n = 5 + Math.floor(VF.rng.g() * 3);
    R.ghosts = [];
    for (let i = 0; i < n; i++) {
      R.ghosts.push({ x: 0.10 + (i / n) * 0.82 + VF.rng.g() * 0.05,
                      y: VF.rng.g.range(0.22, 0.60), t: -i * 0.34, life: 4.6 });
    }
    VF.audio.nibble();
  }

  /* Investigate what the sonar found. This is the only route to two of the
     creatures and it is deliberately a press on the water rather than a
     button: you are pointing at a thing. */
  function pickContact(px, py) {
    if (!R.contact) return false;
    const L = VF.scene.L;
    const cx = L.w * R.contact.x, cy = L.horizonY + L.waterH * R.contact.y;
    if (Math.hypot(px - cx, py - cy) > L.w * 0.09) return false;
    const big = R.contact.big;
    R.contact = null;
    VF.fx.ripple(cx, cy, L.w * 0.10, 2.6);
    if (big && VF.creature) {
      VF.creature.begin('lurker');
    } else {
      VF.discovery.clue('trench_echo');
    }
    return true;
  }

  /* Forced by a lead that named the trench. */
  function forceContact() {
    if (rule() !== 'sonar') return false;
    R.contact = { x: 0.62, y: 0.36, t: 0, life: 40, big: true };
    return true;
  }

  /* ---------------------------------------------- abyss: the resonance --- */

  function tickAbyss(dt) {
    const z = zone();
    const s = st('abyss');
    if (VF.fishing.state() !== 'idle') s.charge = (s.charge || 0) + z.chargePer * dt;

    R.shards.forEach(function (x) { x.t += dt; x.y -= dt * 0.008; });
    R.shards = R.shards.filter(function (x) { return x.t < 30; });
    R.shardT -= dt;
    if (R.shardT <= 0 && R.shards.length < 4) {
      R.shardT = VF.rng.g.range(16, 40);
      R.shards.push({ x: VF.rng.g.range(0.18, 0.9), y: VF.rng.g.range(0.30, 0.70), t: 0,
                      k: Math.floor(VF.rng.g() * 3) });
    }

    if ((s.charge || 0) >= 1 && (!VF.pace || VF.pace.allow(3))) {
      s.charge = 0;
      if (VF.pace) VF.pace.spend(3);
      const tune = z.tunes.filter(function (x) { return x.id === s.tune; })[0] || z.tunes[0];
      s.lit = tune.colour;
      s.pending = tune.trait;
      VF.fx.flash('rgba(200,160,255,0.24)', 0.7, 2);
      VF.fx.shake(4, 2.4);
      VF.audio.stinger('void', 5);
      /* The pillars go up and the water lights. That IS the announcement —
         it is the largest thing that happens in the zone and it happens in
         the frame rather than in a box in the corner of it. */
      if (VF.conditions) VF.conditions.start('glowwater');
      VF.bus.emit('zone:resonance', tune);
    }
  }

  function pickShard(px, py) {
    if (rule() !== 'resonance' || !R.shards.length) return false;
    const L = VF.scene.L;
    for (let i = 0; i < R.shards.length; i++) {
      const x = R.shards[i];
      const sx = L.w * x.x, sy = L.horizonY + L.waterH * x.y;
      if (Math.hypot(px - sx, py - sy) > L.w * 0.045) continue;
      const z = VF.zoneData.get('abyss');
      const tune = z.tunes[x.k | 0] || z.tunes[0];
      R.shards.splice(i, 1);
      const s = st('abyss');
      s.shards = (s.shards | 0) + 1;
      /* Taking a shard IS the tuning. No menu, no spend, no confirmation. */
      s.tune = tune.id;
      s.charge = Math.min(1, (s.charge || 0) + 0.16);
      VF.fx.ripple(sx, sy, L.w * 0.04, 1.8, tune.colour, 1.2);
      VF.audio.nibble();
      return true;
    }
    return false;
  }


  /* Applied to a catch by js/systems/loot.js's parasite hook's neighbour —
     see the call in roll(). One catch, then it is spent. */
  function onRoll(c) {
    if (here() !== 'abyss') return;
    const s = st('abyss');
    if (!s.pending) return;
    if (!c.traits) c.traits = [];
    if (c.traits.indexOf(s.pending) < 0) {
      c.traits.push(s.pending);
      c.value = Math.round(c.value * 1.6);
    }
    s.pending = null;
  }

  /* ------------------------------------------- nowhere: the chart lies --- */

  function tickNowhere(dt) {
    R.echoT -= dt;
    if (R.echoT > 0) return;
    const z = zone();
    R.echoT = VF.rng.g.range(z.echoAt[0], z.echoAt[1]);
    /* Something repeats. The same shadow, on the same course, twice. */
    for (let i = 0; i < 2; i++) {
      setTimeout(function () {
        VF.scene.addShadow({ x: -0.2, y: 0.34, sp: 0.048, size: 1.8, alpha: 0.42, life: 18, max: 18 });
      }, i * 4200);
    }
    const s = st('nowhere');
    s.echoes = (s.echoes | 0) + 1;
    /* The first two of these are silent. The same shadow goes past twice and
       the game does not remark on it, so noticing is the player's. The third
       time, and only the third, it says the thing they have been thinking —
       which reads as agreement rather than as narration. */
    if (s.echoes === 3) {
      say('that has already happened once this evening', 6);
      VF.discovery.clue('nowhere_double');
    }
  }

  /* Called by the crossing when it leaves the Nowhere Sea. Returns the place
     it actually ends up, which is usually the one that was asked for. */
  function driftTo(wanted) {
    if (here() !== 'nowhere') return wanted;
    const z = zone();
    if (VF.rng.g() >= z.driftChance) return wanted;
    const open = VF.state.data.unlockedLocations.filter(function (x) {
      return x !== wanted && x !== 'nowhere';
    });
    if (!open.length) return wanted;
    return open[Math.floor(VF.rng.g() * open.length)];
  }

  /* ------------------------------------------------ beneath: downward --- */

  function tickBeneath(dt) {
    const z = zone();
    const s = st('beneath');
    if (VF.fishing.state() === 'waiting') s.depth = U.clamp((s.depth || 0) + z.depthPer * dt / 60, 0, 1);
    if ((s.depth || 0) > 0.99 && !s.deep) {
      s.deep = Date.now();
      VF.discovery.clue('beneath_way');
    }
  }

  /* -------------------------------------------- the heavens: something --- */

  function tickHeavens(dt) {
    R.passT -= dt;
    if (R.passT > 0) return;
    const z = zone();
    R.passT = VF.rng.g.range(z.passAt[0], z.passAt[1]);
    VF.scene.spawnMeteor();
    VF.fx.flash('rgba(255,240,200,0.16)', 0.8, 1.6);
  }

  /* ---------------------------------------------------------- the press

     Every zone that has something on the water to point at gets first refusal
     on a press, before the cast does. Returns true if it took it. */
  function press(px, py) {
    if (px === null || px === undefined) return false;
    if (R.bottle) {
      const L = VF.scene.L;
      const bx = L.w * R.bottle.x, by = L.horizonY + L.waterH * R.bottle.y;
      if (Math.hypot(px - bx, py - by) < L.w * 0.05) {
        R.bottle = null;
        VF.audio.splash(0.4);
        const s = st('shore');
        s.bottles = (s.bottles | 0) + 1;
        if (!VF.discovery.has('bottle_shore')) VF.discovery.clue('bottle_shore');
        else {
          VF.economy.earn(400 + Math.floor(VF.rng.g() * 2600), 'bottle');
          say('a note, and it is somebody\'s shopping list.', 5);
        }
        return true;
      }
    }
    if (pickContact(px, py)) return true;
    if (pickShard(px, py)) return true;
    if (pickMark(px, py)) return true;
    return false;
  }

  /* What the renderer and the HUD read. */
  function view() {
    return {
      id: R.at, rule: rule(),
      bottle: R.bottle, marks: R.marks, contact: R.contact, shards: R.shards,
      prompt: R.prompt,
      ghosts: R.ghosts,
      receding: R.receding,
      moon: rule() === 'moon' ? moonPhase() : null,
      charge: rule() === 'resonance' ? (st('abyss').charge || 0) : 0,
      depth: rule() === 'inverted' ? (st('beneath').depth || 0) : 0,
      blind: rule() === 'sonar' && (!VF.boat || !VF.boat.has('sonar'))
    };
  }

  /* The Cradle opens a section at a time, and what opens it is the total of
     everything the player has found — clues, secrets, creatures. It is the
     one zone whose progress is the whole game's progress. */
  function excavate() {
    const z = VF.zoneData.get('cradle');
    const s = st('cradle');
    if (!z) return null;
    const d = VF.state.data;
    const score = Object.keys(d.clues || {}).length +
                  Object.keys(d.secrets || {}).length * 2 +
                  VF.creatureData.counts().caught * 2;
    if (!s.open) s.open = [];
    for (let i = 0; i < z.sections.length; i++) {
      const sec = z.sections[i];
      if (s.open.indexOf(sec.id) >= 0) continue;
      if (score < sec.need) break;
      s.open.push(sec.id);
      VF.journal.addFree('cradle:' + sec.id, sec.name, sec.text, 'lore', i === 3 ? 1 : 0);
      VF.discovery.found('place', sec.name, 'a section of the ring has opened');
      if (sec.id === 'shaft') VF.discovery.openLead('beneath_way');
      VF.save.save();
      return sec;
    }
    return null;
  }

  VF.zones = {
    tick: tick, press: press, view: view, stats: stats,
    moonPhase: moonPhase, moonK: moonK,
    onRoll: onRoll,
    driftTo: driftTo, forceContact: forceContact, excavate: excavate,
    state: st,
    prompt: function () { return R.prompt; }
  };

  /* The ring is opened by everything else, so it is checked when everything
     else happens rather than on a timer. */
  VF.bus.on('clue:found', function () { excavate(); });
  VF.bus.on('creature:first', function () { excavate(); });
  VF.bus.on('secret:found', function () { excavate(); });
})(window.VF = window.VF || {});
