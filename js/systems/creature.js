/* VOID FISHING — running an encounter.

   One state machine, nine verbs, and no knowledge whatsoever of any
   particular creature. js/data/creatures.js writes a list of phases; this
   walks it; js/render/creatureArt.js draws whatever the current phase says is
   on the water; js/ui/hud.js routes the one press this game has into it.

   Two rules the whole thing is built on:

   1. An encounter borrows the rod, it does not replace it. The `hook` verb
      hands straight back to the ordinary fight — same minigame, same trials,
      same catch card, same fishdex — so everything downstream of landing a
      fish works on these with no special cases at all. What is new is the
      three minutes in front of that.

   2. Losing is an ending, not a failure screen. Every creature has an
      onEscape, and most of them leave a clue on the way out, so the worst
      case is that the world gets one sentence larger. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Runtime only. An encounter interrupted by a reload is simply over — it
     lives in the moment it is happening and there is nothing sensible to
     restore it into. What it produced (clues, the fishdex row, the journal)
     is saved as it happens, so nothing that mattered is lost. */
  const S = {
    id: null, def: null, i: -1, t: 0, phase: null,
    text: '', hint: '', title: '',
    slots: [], round: 0, hot: -1,
    progress: 0, held: false, band: 0.5, bandOk: 0,
    swarm: [], cleared: 0,
    options: null, picked: -1, pickMsg: '', pickT: 0,
    disguise: null, revealed: 0,
    lead: null, fromCatch: null,
    waiting: 0,           // 'hook' is parked here until the fight resolves
    ending: null,         // 'land' | 'escape'
    shake: 0
  };

  let cooldown = 40;      // seconds before an unsolicited encounter may fire

  function active() { return !!S.id; }
  /* While these are true the ordinary rod does nothing on its own: no bite
     timer, no secret roll, no ambient encounter. The line is busy. */
  function holdsRod() { return !!S.id && S.phase && S.phase.verb !== 'hook'; }

  function rec(id) {
    const d = VF.state.data;
    if (!d.creatures || typeof d.creatures !== 'object') d.creatures = {};
    if (!d.creatures[id]) d.creatures[id] = { met: 0, caught: 0, seen: 0, escaped: 0 };
    return d.creatures[id];
  }

  /* --------------------------------------------------------------- begin */

  function begin(id, opts) {
    if (S.id) return false;
    const def = VF.creatureData.get(id);
    if (!def) return false;
    opts = opts || {};

    S.id = id; S.def = def; S.i = -1; S.t = 0; S.phase = null;
    S.lead = opts.lead || null;
    S.fromCatch = opts.c || null;
    S.ending = null;
    if (VF.pace) VF.pace.spend(3); S.waiting = 0; S.shake = 0;
    S.disguise = null; S.revealed = 0;

    const r = rec(id);
    const first = !r.met;
    r.met = (r.met | 0) + 1;

    /* Named only once it has been landed. Until then the HUD says what it is
       doing, not what it is called — being told the name of the thing you
       cannot see yet is most of the mystery gone. */
    S.title = r.caught ? def.name : (first ? 'unknown' : '???');

    VF.state.data.stats.encounters++;
    VF.audio.encounter();
    VF.audio.duck(1);
    VF.fx.pulse(0.6);
    VF.bus.emit('creature:start', { id: id, def: def, first: first });
    next();
    VF.save.save();
    return true;
  }

  function abort() {
    if (!S.id) return;
    S.id = null; S.def = null; S.phase = null; S.ending = null;
    VF.bus.emit('creature:end', {});
  }

  /* ---------------------------------------------------------- the phases */

  function next(jump) {
    const def = S.def;
    if (!def) return;
    if (jump === 'escape') return finish(false);
    S.i = (typeof jump === 'number') ? jump : S.i + 1;
    const ph = def.phases[S.i];
    if (!ph) return finish(true);

    S.phase = ph;
    S.t = 0;
    S.text = ph.text || '';
    S.hint = ph.hint || '';
    S.options = null; S.picked = -1; S.pickMsg = ''; S.pickT = 0;
    S.waiting = 0;

    switch (ph.verb) {
      case 'track': setupTrack(ph); break;
      case 'chase': S.progress = 0.10; S.held = false; break;
      case 'hold': S.band = 0.5; S.bandOk = 0; S.held = false; break;
      case 'swarm': setupSwarm(ph); break;
      case 'choose': S.options = ph.options.slice(); break;
      case 'reveal': S.revealed = 0; break;
      case 'hook': doHook(ph); break;
      case 'land': return finish(true);
      /* Not everything out here is a fight. Two of these end with the thing
         going away again while you sit there — nothing hooked, nothing
         landed, nothing in the fishdex, and it still counts, because what
         happened was that you were there and it looked at you. `leave` is
         how a phase list says so. */
      case 'leave': return finish(true);
      case 'escape': return finish(false);
      default: break;
    }
    if (ph.disguise) pickDisguise();
    VF.bus.emit('creature:phase', { id: S.id, phase: ph, index: S.i });
  }

  /* --- track: it is under one of these and only one --------------------- */

  function setupTrack(ph) {
    const n = ph.slots || 4;
    S.slots = [];
    for (let i = 0; i < n; i++) {
      S.slots.push({
        x: 0.14 + (i + 0.5) / n * 0.72 + VF.rng.g.range(-0.04, 0.04),
        y: VF.rng.g.range(0.20, 0.52),
        t: VF.rng.g() * 6
      });
    }
    S.hot = Math.floor(VF.rng.g() * n);
    S.round = 0;
  }

  function trackRoll() {
    /* It relocates rather than swims, so the tell is which patch of water is
       wrong rather than which way something is going. The hot slot gets a
       disturbance the others do not; the disturbance is subtle at first and
       plainer each round, because a puzzle nobody can read is not a puzzle. */
    const n = S.slots.length;
    let k = Math.floor(VF.rng.g() * n);
    if (k === S.hot) k = (k + 1 + Math.floor(VF.rng.g() * (n - 1))) % n;
    S.hot = k;
    S.t = 0;
    VF.audio.nibble();
    VF.fx.ripple(slotX(S.slots[k]), slotY(S.slots[k]), VF.scene.L.w * 0.06, 2.2);
  }

  function slotX(sl) { return VF.scene.L.w * sl.x; }
  function slotY(sl) {
    const L = VF.scene.L;
    return L.horizonY + L.waterH * sl.y;
  }

  /* --- swarm: small things between you and the thing ------------------- */

  function setupSwarm(ph) {
    const n = ph.count || 8;
    S.swarm = [];
    S.cleared = 0;
    for (let i = 0; i < n; i++) {
      S.swarm.push({
        x: VF.rng.g.range(0.12, 0.88), y: VF.rng.g.range(0.20, 0.66),
        vx: VF.rng.g.range(-0.05, 0.05), vy: VF.rng.g.range(-0.03, 0.03),
        alive: 1, pop: 0, ph: VF.rng.g() * 6
      });
    }
  }

  /* --- mimic: what it is pretending to be ------------------------------ */

  function pickDisguise() {
    const d = VF.state.data;
    /* It copies something the player has actually landed, which is the joke:
       it can only be as convincing as your own collection. With an empty
       fishdex it falls back to something plausible. */
    const known = Object.keys(d.fishdex).filter(function (id) {
      const f = VF.fish.byId(id);
      return f && VF.rarities.rank(f.rarity) >= 3 && VF.rarities.rank(f.rarity) <= 5;
    });
    const id = known.length ? known[Math.floor(VF.rng.g() * known.length)] : 'moonfish';
    S.disguise = VF.fish.byId(id) || VF.fish.list[0];
    S.title = S.disguise.name;
  }

  /* --- hook: hand the rod back ---------------------------------------- */

  function doHook(ph) {
    const def = S.def;
    S.waiting = 1;
    S.text = ph.text || S.text;
    /* Everything the ordinary fight needs, plus a tag so the landing comes
       back here. The wide bite window is not generosity — losing one of these
       on the hookset after two minutes of tracking would be miserable. */
    const ok = VF.fishing.putOnLine(def.fish, {
      creature: def.id,
      rarity: def.rarity,
      wide: true
    });
    if (!ok) finish(false);
  }

  /* ------------------------------------------------------------- endings */

  function finish(won) {
    const def = S.def;
    if (!def) { abort(); return; }
    S.ending = won ? 'land' : 'escape';
    const r = rec(def.id);

    if (won) {
      /* An encounter that ended without a catch is still an encounter, and
         it is recorded as one — separately, because "seen it three times"
         and "landed it three times" are not the same sentence and the ones
         you cannot land are the ones where the difference matters. */
      const met = def.encounterOnly;
      if (met) r.seen = (r.seen | 0) + 1;
      else r.caught = (r.caught | 0) + 1;
      grantReward(def);
      VF.journal.addFree('creature:' + def.id, def.name, def.journal, 'creature', 0);
      if ((met ? r.seen : r.caught) === 1) {
        VF.discovery.found('creature', def.name, def.blurb);
        VF.bus.emit('creature:first', def);
      }
      if (def.attach && VF.parasite) VF.parasite.attach(def.attach, def);
    } else {
      r.escaped = (r.escaped | 0) + 1;
      const esc = def.onEscape || {};
      if (esc.clue) VF.discovery.clue(esc.clue);
      /* Some of them are supposed to be missed the first time. Putting the
         lead back is how a chain survives a bad night. */
      if (esc.keepLead && S.lead) {
        const d = VF.state.data;
        if (d.leads[S.lead]) d.leads[S.lead].done = 0;
      }
      VF.toast.plain(esc.text || 'it is gone.', 'warn', 4200);
    }

    VF.audio.duck(0);
    VF.bus.emit('creature:end', { id: def.id, won: won });
    S.id = null; S.def = null; S.phase = null;
    cooldown = won ? 220 : 120;
    VF.save.save();
  }

  function grantReward(def) {
    const rw = def.reward || {};
    const d = VF.state.data;
    if (rw.money) VF.economy.earn(rw.money, 'encounter');
    if (rw.xp) VF.progression.addXp(rw.xp);
    if (rw.bait) VF.bait.add(rw.bait[0], rw.bait[1]);
    if (rw.clue) VF.discovery.clue(rw.clue, true);
  }

  /* ---------------------------------------------------------------- tick */

  function tick(dt) {
    if (cooldown > 0) cooldown -= dt;
    if (!S.id) return;
    S.t += dt;
    S.shake = Math.max(0, S.shake - dt * 2);
    const ph = S.phase;
    if (!ph) return;

    switch (ph.verb) {
      case 'watch':
      case 'reveal': {
        if (ph.verb === 'reveal') S.revealed = U.clamp(S.t / (ph.dur || 3), 0, 1);
        if (S.t >= (ph.dur || 3)) next();
        break;
      }
      case 'track': {
        S.slots.forEach(function (sl) { sl.t += dt; });
        if (S.t >= (ph.window || 4.5)) {
          /* A round timed out. It moves and you are one round worse off, but
             the encounter does not end — running out of guesses is the
             failure state, not running out of clock. */
          S.round++;
          if (S.round >= (ph.rounds || 3) + 1) return next('escape');
          trackRoll();
        }
        break;
      }
      case 'chase': {
        const gain = ph.gain || 0.3, flee = ph.speed || 0.6;
        S.progress += (S.held ? gain : -flee * 0.42) * dt;
        S.progress = U.clamp(S.progress, 0, 1);
        if (S.held) VF.audio.reelTension && VF.audio.reelTension(S.progress);
        if (S.progress >= 1) return next();
        if (S.t >= (ph.dur || 9)) return next('escape');
        break;
      }
      case 'hold': {
        S.band += (S.held ? 0.85 : -0.75) * dt;
        S.band = U.clamp(S.band, 0, 1);
        const lo = ph.band[0], hi = ph.band[1];
        const inside = S.band >= lo && S.band <= hi;
        S.bandOk += (inside ? dt : -dt * 1.6);
        S.bandOk = U.clamp(S.bandOk, 0, ph.dur || 6);
        if (S.bandOk >= (ph.dur || 6)) return next();
        if (S.t > (ph.dur || 6) * 2.6) return next('escape');
        break;
      }
      case 'swarm': {
        S.swarm.forEach(function (m) {
          if (!m.alive) { m.pop += dt * 3; return; }
          m.ph += dt;
          m.x += m.vx * dt; m.y += m.vy * dt;
          if (m.x < 0.10 || m.x > 0.90) m.vx *= -1;
          if (m.y < 0.18 || m.y > 0.68) m.vy *= -1;
        });
        if (S.cleared >= S.swarm.length) return next();
        if (S.t >= (ph.dur || 12)) return next('escape');
        break;
      }
      case 'choose': {
        if (S.picked >= 0) {
          S.pickT += dt;
          if (S.pickT > 2.2) resolveChoice();
        }
        break;
      }
      case 'hook': {
        // parked. fishing:landed / fishing:lost move it on.
        break;
      }
      default: break;
    }
  }

  /* --------------------------------------------------------------- input */

  /* One press, wherever the game's one press comes from. `px`/`py` are scene
     coordinates when it came from the water and null when it came from a key. */
  function press(px, py) {
    const ph = S.phase;
    if (!ph) return false;
    S.held = true;

    if (ph.verb === 'track' && px !== null) {
      const hit = nearestSlot(px, py);
      if (hit < 0) return true;
      if (hit === S.hot) {
        S.round++;
        VF.fx.ripple(slotX(S.slots[hit]), slotY(S.slots[hit]), VF.scene.L.w * 0.10, 2.6);
        VF.audio.splash(0.6);
        if (S.round >= (ph.rounds || 3)) { next(); return true; }
        S.text = ['there. it was there.', 'again. it moved before you finished looking.',
                  'once more and you will have it.'][Math.min(2, S.round - 1)];
        trackRoll();
      } else {
        VF.audio.error();
        S.shake = 1;
        S.round++;
        if (S.round >= (ph.rounds || 3) + 1) { next('escape'); return true; }
        S.text = 'nothing under that one.';
        trackRoll();
      }
      return true;
    }

    if (ph.verb === 'swarm' && px !== null) {
      const L = VF.scene.L;
      for (let i = 0; i < S.swarm.length; i++) {
        const m = S.swarm[i];
        if (!m.alive) continue;
        const mx = L.w * m.x, my = L.horizonY + L.waterH * m.y;
        if (Math.hypot(px - mx, py - my) < L.w * 0.045) {
          m.alive = 0; S.cleared++;
          VF.fx.ripple(mx, my, L.w * 0.035, 1.8);
          VF.audio.nibble();
          return true;
        }
      }
      return true;
    }

    /* watch and reveal are read, not played, but a player who has read the
       line should not have to wait out the rest of the beat. */
    if ((ph.verb === 'watch' || ph.verb === 'reveal') && S.t > 1.1) { next(); return true; }
    return true;
  }

  function release() { S.held = false; }

  function nearestSlot(px, py) {
    const L = VF.scene.L;
    let best = -1, bd = L.w * 0.13;
    for (let i = 0; i < S.slots.length; i++) {
      const dx = px - slotX(S.slots[i]), dy = py - slotY(S.slots[i]);
      const dd = Math.hypot(dx, dy);
      if (dd < bd) { bd = dd; best = i; }
    }
    return best;
  }

  /* --- choices, which are the only thing with real buttons -------------- */

  function choose(n) {
    const ph = S.phase;
    if (!ph || ph.verb !== 'choose' || S.picked >= 0) return;
    const opt = S.options[n];
    if (!opt) return;
    S.picked = n;
    S.pickT = 0;
    const good = opt.good === undefined ? 1 : opt.good;
    const won = VF.rng.g() < good;
    S.pickWon = won;
    S.pickMsg = won ? (opt.win || '') : (opt.lose || opt.win || '');
    VF.audio.click();
    VF.bus.emit('creature:choice', { id: S.id, option: opt, won: won });
  }

  function resolveChoice() {
    const opt = S.options[S.picked];
    const then = opt.then || 'next';
    if (!S.pickWon && opt.lose) {
      /* A bad outcome on a branch that had a good one costs the phase, not
         the encounter — except where the option was the safe one, which does
         exactly what it said it would. */
      if (then === 'escape') return next('escape');
      return next('escape');
    }
    if (then === 'escape') return next('escape');
    if (then === 'hook') {
      const at = S.def.phases.findIndex(function (p) { return p.verb === 'hook'; });
      return next(at >= 0 ? at : S.i + 1);
    }
    if (then === 'devour') {
      /* The one branch that changes what is on the line. The fish being
         reeled is gone and something much larger has it. */
      if (S.fromCatch) S.fromCatch.eaten = 1;
      return next();
    }
    return next();
  }

  /* -------------------------------------------------- the rod comes back */

  VF.bus.on('fishing:landed', function (c) {
    if (!S.id || !S.waiting) return;
    if (!c || c.creature !== S.id) return;
    S.waiting = 0;
    next();
  });
  VF.bus.on('fishing:lost', function (e) {
    if (!S.id || !S.waiting) return;
    const c = e && e.catch;
    if (c && c.creature && c.creature !== S.id) return;
    S.waiting = 0;
    next('escape');
  });

  /* ------------------------------------------------------ how they start */

  /* A bite that is not a bite. Called by js/systems/fishing.js just before it
     hands a catch over, so an encounter can take the moment instead. */
  function tryOnBite(c) {
    if (S.id || cooldown > 0) return null;
    if (VF.state.rt.panelOpen) return null;
    /* The per-creature cooldown above stops the same one twice. It does not
       stop a different one landing forty seconds after the last, and with
       nine of these plus the zones plus the crossings that is what happened.
       js/systems/pace.js is the shared clock. */
    if (VF.pace && !VF.pace.allow(3)) return null;
    const list = VF.creatureData.eligible('bite', { rank: VF.rarities.rank(c && c.rarity) });
    for (let i = 0; i < list.length; i++) {
      const def = list[i];
      if (VF.rng.g() >= (def.chance || 0) * luckK()) continue;
      if (def.steal && c) VF.bait.consume(VF.state.data.bait);
      begin(def.id, { c: c });
      return def;
    }
    return null;
  }

  /* Something arriving under a fight already in progress. */
  function tryOnReel(c, progress) {
    if (S.id || cooldown > 0) return null;
    if (progress < 0.45 || progress > 0.85) return null;
    if (VF.pace && !VF.pace.allow(3)) return null;
    const list = VF.creatureData.eligible('reel', { rank: VF.rarities.rank(c && c.rarity) });
    for (let i = 0; i < list.length; i++) {
      const def = list[i];
      if (VF.rng.g() >= (def.chance || 0) * luckK()) continue;
      begin(def.id, { c: c });
      return def;
    }
    return null;
  }

  function luckK() {
    const b = VF.build ? VF.build.stats() : null;
    return U.clamp(1 + (b ? (b.encounter - 1) * 0.6 : 0) + VF.progression.luck() * 0.10, 0.6, 2.4);
  }

  /* ------------------------------------------------------------- reading */

  /* Everything the renderer and the HUD need, in one object, so neither of
     them ever reaches into S. */
  function view() {
    if (!S.id) return null;
    const ph = S.phase || {};
    return {
      id: S.id, title: S.title, verb: ph.verb, text: S.text, hint: S.hint,
      t: S.t, dur: ph.dur || 0, shake: S.shake,
      far: ph.far, wake: ph.wake, shadow: ph.shadow, swarmIn: ph.swarmIn,
      devour: ph.devour, disguise: S.disguise, revealed: S.revealed,
      slots: ph.verb === 'track' ? S.slots : null,
      hot: S.hot, round: S.round, rounds: ph.rounds || 0,
      progress: S.progress, band: S.band, bandRange: ph.band || null,
      bandOk: S.bandOk / (ph.dur || 6),
      swarm: ph.verb === 'swarm' ? S.swarm : null,
      cleared: S.cleared, total: S.swarm.length,
      options: S.picked < 0 ? S.options : null,
      picked: S.picked, pickMsg: S.pickMsg,
      kind: S.def ? S.def.kind : null,
      left: ph.dur ? Math.max(0, ph.dur - S.t) : 0
    };
  }

  function reset() { abort(); cooldown = 40; }

  VF.creature = {
    begin: begin, tick: tick, press: press, release: release, choose: choose,
    active: active, holdsRod: holdsRod, view: view, reset: reset,
    tryOnBite: tryOnBite, tryOnReel: tryOnReel,
    /* the admin console and the tools drive it directly */
    abort: abort,
    current: function () { return S.id; }
  };
})(window.VF = window.VF || {});
