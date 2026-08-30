/* VOID FISHING — the water between two places.

   Travel used to be a location id and a fade. With a hull under you it is a
   short crossing you sit through, and the crossing is where the sonar, the
   sea events, the followers and most of the discoveries in this update live.

   It owns its own screen the way js/systems/cutscene.js does — a full-bleed
   layer, a canvas, and a card when something happens — because it is a place
   rather than a menu. It is always skippable, and skipping is not a lesser
   version: the arrival is identical and any event that had already fired has
   already resolved.

   Nothing here decides where you end up. panels.travel() still does that; a
   voyage is what happens on the way, and it calls back into travel when it
   is done. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const S = {
    on: false, from: null, to: null,
    t: 0, dur: 18, slow: 1,
    event: null, sighting: null, heading: 0, steer: 0,
    showing: null, picked: -1, pickT: 0, pickMsg: '',
    onArrive: null, done: null,
    contact: 0, contactT: 0,
    closing: 0
  };

  let el = null, D = {};

  function dom() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'voyage';
    el.className = 'hidden';
    el.innerHTML =
      '<canvas id="voyageCanvas"></canvas>' +
      '<div class="vy-top">' +
        '<div class="vy-where">' +
          '<span class="vy-from" id="vyFrom"></span>' +
          '<span class="vy-arrow">&rarr;</span>' +
          '<span class="vy-to" id="vyTo"></span>' +
        '</div>' +
        '<button class="vy-skip" id="vySkip">put the engine up</button>' +
      '</div>' +
      '<div class="vy-progress"><div class="vy-progress-fill" id="vyFill"></div></div>' +
      '<div class="vy-event hidden" id="vyEvent">' +
        '<div class="vy-event-kind" id="vyKind"></div>' +
        '<div class="vy-event-name" id="vyName"></div>' +
        '<div class="vy-event-text" id="vyText"></div>' +
        '<div class="vy-event-opts" id="vyOpts"></div>' +
      '</div>' +
      '<div class="vy-note" id="vyNote"></div>' +
      '<div class="vy-instr" id="vyInstr"></div>';
    document.body.appendChild(el);
    ['vyFrom', 'vyTo', 'vySkip', 'vyFill', 'vyEvent', 'vyKind', 'vyName', 'vyText',
     'vyOpts', 'vyInstr', 'vyNote', 'voyageCanvas'].forEach(function (id) {
      D[id] = document.getElementById(id);
    });
    D.vySkip.addEventListener('click', skip);
    return el;
  }

  function active() { return S.on; }

  /* Is a crossing even a thing this save can have? A skiff is a skiff. */
  function possible(toId) {
    if (!VF.boat || !VF.boat.can('crossings')) return false;
    const d = VF.state.data;
    return toId && toId !== d.location;
  }

  function begin(toId, done) {
    if (S.on) return false;
    const d = VF.state.data;
    const from = VF.locations.get(d.location);
    /* Leaving the Nowhere Sea does not always work. The boat goes where it
       was pointed most of the time and somewhere else the rest of it, and
       the game says so on arrival rather than before — being warned that
       navigation is unreliable is not the same as it being unreliable. */
    const wanted = toId;
    if (VF.zones) toId = VF.zones.driftTo(toId);
    const to = VF.locations.get(toId);
    if (!to) return false;
    S.drifted = toId !== wanted ? wanted : null;
    S.realTo = toId;

    S.on = true;
    S.from = from; S.to = to;
    S.t = 0; S.slow = 1; S.closing = 0;
    S.onArrive = null; S.done = done || null;
    S.showing = null; S.picked = -1; S.pickMsg = ''; S.note = ''; S.noteT = 0;
    S.contact = 0; S.contactT = VF.rng.g.range(3, 7);
    S.rolledFollow = 0;

    /* How long, and what happens in it. Distance is how far apart the two
       places are in the progression — the shore to the basin is a morning and
       the Nowhere Sea to Beneath is not. */
    const dist = Math.abs(VF.locations.rank(to.id) - VF.locations.rank(from.id)) || 1;
    S.dur = U.clamp(9 + dist * 3.4, 10, 26) / Math.max(0.5, VF.boat.speed());

    /* One question, asked once, and the usual answer is nothing.

       This used to be `1 + floor(rnd() * 2)` events, clamped to at least one,
       so every crossing the game ever ran had something in it. The director
       has a budget and spends it slowly, so most crossings are now water going
       past — which is the only thing that makes the ones that are not worth
       sitting through. */
    VF.director.tick();
    const ctx = VF.director.context({ from: from.id, to: to.id, dist: dist });
    const def = VF.seaData.roll(ctx);

    S.event = null;
    S.sighting = null;
    if (def) {
      if (def.onCourse) {
        /* In the way rather than off to one side. It arrives whatever the
           helm does, and the decision is what to do about it. */
        S.event = { def: def, at: S.dur * (0.28 + VF.rng.g() * 0.30) };
      } else {
        /* Off the bow, and the whole of the first decision is whether to go
           and look. Holding the course is how you decline. */
        S.sighting = {
          def: def,
          bearing: (VF.rng.g() < 0.5 ? -1 : 1) * VF.rng.g.range(0.45, 0.95),
          from: S.dur * 0.22, until: S.dur * 0.80,
          close: 0, shown: 0, passed: 0
        };
      }
    }
    S.heading = 0;
    S.steer = 0;

    dom();
    D.vyFrom.textContent = from.name.toLowerCase();
    D.vyTo.textContent = to.name.toLowerCase();
    D.vyEvent.classList.add('hidden');
    el.classList.remove('hidden', 'out');
    instruments();
    VF.state.rt.panelOpen = 'voyage';
    const hud = document.getElementById('hud');
    if (hud) hud.classList.add('gone');
    VF.audio.duck(0.6);
    VF.bus.emit('voyage:start', { from: from.id, to: to.id });
    return true;
  }

  function skip() {
    if (!S.on || S.closing) return;
    /* Skipping past a card that is asking a question would be answering it
       for them. The card has to be resolved first, and pressing this while
       one is open takes the first option — which is always the cautious one. */
    if (S.showing) { choose(0); return; }
    /* Putting the engine up abandons a sighting rather than reaching it: you
       are choosing to be somewhere else, and the thing off the bow is a thing
       you decided not to look at. */
    if (S.sighting && !S.sighting.passed) S.sighting.until = 0;
    S.t = S.dur;
  }

  function finish() {
    const d = VF.state.data;
    d.voyages = (d.voyages | 0) + 1;
    const arrive = S.onArrive;
    const cb = S.done;
    const drifted = S.drifted;
    S.on = false;
    if (el) el.classList.add('out');
    setTimeout(function () { if (el && !S.on) el.classList.add('hidden'); }, 420);
    const hud = document.getElementById('hud');
    if (hud) hud.classList.remove('gone');
    VF.state.rt.panelOpen = null;
    VF.audio.duck(0);
    VF.bus.emit('voyage:end', {});

    if (cb) cb(S.realTo);
    if (drifted) {
      setTimeout(function () {
        VF.toast.show('<strong>this is not where you were going</strong><br>' +
          '<span style="color:var(--ink-3)">you set a course for ' +
          U.esc(VF.locations.get(drifted).name.toLowerCase()) +
          '. the chart is not what is wrong here.</span>', 'warn', 6500);
      }, 900);
    }

    /* Anything the crossing set up happens on the far side, after the arrival
       has been announced — an encounter that starts before the player knows
       where they are is an encounter they cannot read. */
    if (arrive) {
      setTimeout(function () {
        try {
          if (arrive.creature && VF.creature) VF.creature.begin(arrive.creature);
          if (arrive.condition && VF.conditions) VF.conditions.start(arrive.condition);
        } catch (e) { console.error('[voyage]', e); }
      }, 1400);
    }
    /* And a lead that was waiting for this water gets its moment now. */
    setTimeout(function () {
      if (VF.discovery) VF.discovery.tryHere(['creature', 'sonar']);
    }, 2600);
  }

  /* ---------------------------------------------------------------- tick */

  function tick(dt) {
    if (!S.on) return;
    if (S.showing) { tickCard(dt); paint(); return; }

    tickNote(dt);
    S.t += dt / Math.max(0.4, S.slow);
    D.vyFill.style.width = (U.clamp(S.t / S.dur, 0, 1) * 100).toFixed(1) + '%';

    // the sonar sweeps whether or not anything is there
    S.contactT -= dt;
    if (S.contactT <= 0) {
      S.contactT = VF.rng.g.range(4, 9);
      S.contact = VF.boat.has('sonar') && VF.rng.g() < 0.4 ? VF.rng.g.range(0.3, 1) : 0;
      instruments();
    }

    /* Something in the way arrives on its own. */
    if (S.event && S.t >= S.event.at) {
      const def = S.event.def;
      S.event = null;
      reach(def);
      return;
    }

    /* And something off the bow only arrives if the helm goes to it. */
    tickSighting(dt);

    /* And once per crossing, something can simply get in behind the boat.
       Rolled rather than scheduled: a follower that always arrives at the
       forty percent mark is a cutscene. */
    if (!S.rolledFollow && S.t > S.dur * 0.45) {
      S.rolledFollow = 1;
      const list = VF.creatureData.eligible('voyage', {});
      for (let i = 0; i < list.length; i++) {
        if (VF.rng.g() < (list[i].chance || 0)) { S.onArrive = { creature: list[i].id }; break; }
      }
    }

    if (S.t >= S.dur) finish();
    paint();
  }

  /* --------------------------------------------------------- the sighting

     The one decision the sea makes you take on every crossing that has
     anything in it: there is something over there, and you are pointed
     somewhere else.

     Closing it costs time — the crossing stretches while the helm is over —
     which is the price of curiosity and the reason holding the course is a
     real alternative rather than the boring one. Letting it go is recorded:
     the world knows what you saw and did not go to, and that is what an
     ignored distress signal is made of. */
  function tickSighting(dt) {
    const g = S.sighting;
    if (!g || g.passed || S.t < g.from) return;

    if (!g.shown) {
      g.shown = 1;
      VF.audio.nibble();
      VF.bus.emit('voyage:sighting', g.def);
    }

    /* The helm eases back to the course when nobody is holding it. */
    S.heading = U.approach(S.heading, S.steer, 0.012, dt);

    const off = Math.abs(S.heading - g.bearing);
    if (off < 0.30) {
      g.close = U.clamp(g.close + dt / 2.6, 0, 1);
      S.slow = 1.7;                       // going and looking takes longer
      if (g.close >= 1) {
        S.sighting = null;
        reach(g.def);
        return;
      }
    } else {
      g.close = Math.max(0, g.close - dt / 5.0);
      S.slow = 1;
    }

    if (S.t > g.until) {
      g.passed = 1;
      S.slow = 1;
      /* Not a failure and not a message. The world simply knows. */
      const d = VF.state.data;
      if (!d.world) d.world = {};
      if (!d.world.passed) d.world.passed = {};
      d.world.passed[g.def.id] = (d.world.passed[g.def.id] | 0) + 1;
      VF.bus.emit('voyage:passed', g.def);
    }
  }

  /* Whatever it was, you are up against it now. An event with more than one
     real answer asks; one with a single outcome simply happens, because a card
     with one button on it is a card that did not need to exist. */
  function reach(def) {
    VF.director.spend(def);
    if (def.options && def.options.length > 1) { show(def); return; }

    /* Something ordinary that just happened does not get the screen.

       A shoal crossing your bow is weather, not an event, and putting a card
       over the water to say so is the habit this whole pass exists to break.
       It runs, it says one line along the bottom, and the crossing carries on
       without stopping. */
    const quiet = def.cls === 'ENVIRONMENT' || def.cls === 'MINOR';
    if (quiet) {
      let line = '';
      try { line = def.options[0].run(S) || ''; } catch (e) { console.error('[sea]', e); }
      note(line || def.text);
      VF.bus.emit('voyage:event', def);
      const dd = VF.state.data;
      if (!dd.seas || typeof dd.seas !== 'object') dd.seas = {};
      dd.seas[def.id] = (dd.seas[def.id] | 0) + 1;
      return;
    }

    S.showing = def;
    S.picked = 0;
    S.pickT = 0;
    let line = '';
    try { line = def.options[0].run(S) || ''; } catch (e) { console.error('[sea]', e); }
    S.pickMsg = line;
    dom();
    D.vyKind.textContent = '';
    D.vyName.textContent = def.name;
    D.vyText.textContent = line || def.text;
    U.clear(D.vyOpts);
    D.vyEvent.classList.remove('hidden');
    VF.audio.stinger(def.kind === 'VOID' ? 'void' : 'bright', 3);
    VF.bus.emit('voyage:event', def);
    const d = VF.state.data;
    if (!d.seas || typeof d.seas !== 'object') d.seas = {};
    d.seas[def.id] = (d.seas[def.id] | 0) + 1;
  }

  /* One line along the bottom of the crossing, which fades. Not a card, not a
     toast, and nothing to dismiss. */
  function note(text) {
    if (!text) return;
    dom();
    S.note = text;
    S.noteT = 5.5;
    if (D.vyNote) { D.vyNote.textContent = text; D.vyNote.classList.add('on'); }
  }

  function tickNote(dt) {
    if (!S.noteT) return;
    S.noteT -= dt;
    if (S.noteT <= 0) { S.noteT = 0; if (D.vyNote) D.vyNote.classList.remove('on'); }
  }

  function paint() {
    if (!VF.voyageArt || !D.voyageCanvas) return;
    VF.voyageArt.draw(D.voyageCanvas, {
      from: S.from, to: S.to, k: U.clamp(S.t / S.dur, 0, 1),
      t: S.t, contact: S.contact, event: S.showing,
      sighting: S.sighting && S.sighting.shown && !S.sighting.passed ? S.sighting : null,
      heading: S.heading
    });
  }

  /* --------------------------------------------------------------- cards */

  function show(def) {
    S.showing = def;
    S.picked = -1; S.pickT = 0; S.pickMsg = '';
    const d = VF.state.data;
    if (!d.seas || typeof d.seas !== 'object') d.seas = {};
    d.seas[def.id] = (d.seas[def.id] | 0) + 1;

    /* The card used to carry a category in caps above the name — ANOMALY,
       DERELICT, SONAR, ORDINARY. It made every sighting an entry in a
       catalogue somebody else had already compiled, which is the opposite of
       coming across something. The word still exists in the data because the
       stinger below picks the sound off it; it is not shown to anybody. */
    D.vyKind.textContent = '';
    D.vyName.textContent = def.name;
    D.vyText.textContent = def.text;
    U.clear(D.vyOpts);
    def.options.forEach(function (o, i) {
      const b = U.el('button', 'enc-opt', o.label);
      b.addEventListener('click', function () { choose(i); });
      D.vyOpts.appendChild(b);
    });
    D.vyEvent.classList.remove('hidden');
    VF.audio.stinger(def.kind === 'VOID' ? 'void' : 'bright', 3);
    VF.bus.emit('voyage:event', def);
  }

  function choose(n) {
    const def = S.showing;
    if (!def || S.picked >= 0) return;
    const opt = def.options[n];
    if (!opt) return;
    S.picked = n;
    S.pickT = 0;
    let line = '';
    try { line = opt.run(S) || ''; } catch (e) { console.error('[sea]', e); }
    S.pickMsg = line;
    D.vyText.textContent = line || def.text;
    U.clear(D.vyOpts);
    VF.audio.click();
    instruments();
  }

  function tickCard(dt) {
    if (S.picked < 0) return;
    S.pickT += dt;
    if (S.pickT < 3.4) return;
    S.showing = null;
    D.vyEvent.classList.add('hidden');
    VF.save.save();
  }

  /* --------------------------------------------------------- instruments */

  /* This was a row of four gauges — speed to two decimal places, hull
     percentage, sonar state, bearing — sitting under a crossing that already
     shows you the water going past, the boat you are in and the name of the
     place you are headed at the top of the screen. It was a dashboard on a
     view out of a window.

     What is left is the one thing the crossing cannot show you: a hull that
     is not going to make many more of these. */
  function instruments() {
    if (!D.vyInstr) return;
    U.clear(D.vyInstr);
    if (VF.boat.integrity() >= 0.4) return;
    const g = U.el('div', 'vy-gauge alert');
    g.appendChild(U.el('span', 'k', 'hull'));
    g.appendChild(U.el('span', 'v', Math.round(VF.boat.integrity() * 100) + '%'));
    D.vyInstr.appendChild(g);
  }

  /* A press answers an open card. Otherwise it is the helm: press the side of
     the screen the thing is on and hold, and the boat goes over.

     This is the only steering in the game and it exists for one reason — the
     option that used to read "note it and carry on" was doing nothing, and
     the honest version of that decision is not a button, it is not turning. */
  function press(px) {
    if (!S.on) return false;
    if (S.showing && S.picked < 0) { choose(0); return true; }
    if (px !== undefined && px !== null && el) {
      const w = el.getBoundingClientRect().width || 1;
      S.steer = px < w * 0.5 ? -1 : 1;
    }
    return true;
  }

  function release() { S.steer = 0; }

  /* And the same on the keyboard, held rather than tapped. */
  function steer(dir) { S.steer = U.clamp(dir, -1, 1); }

  VF.voyage = {
    begin: begin, tick: tick, active: active, possible: possible,
    skip: skip, press: press, release: release, steer: steer, choose: choose,
    state: function () { return S.on ? { from: S.from, to: S.to, k: S.t / S.dur } : null; }
  };
})(window.VF = window.VF || {});
