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
    events: [], next: 0, showing: null, picked: -1, pickT: 0, pickMsg: '',
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
      '<div class="vy-instr" id="vyInstr"></div>';
    document.body.appendChild(el);
    ['vyFrom', 'vyTo', 'vySkip', 'vyFill', 'vyEvent', 'vyKind', 'vyName', 'vyText',
     'vyOpts', 'vyInstr', 'voyageCanvas'].forEach(function (id) {
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
    S.showing = null; S.picked = -1; S.pickMsg = '';
    S.contact = 0; S.contactT = VF.rng.g.range(3, 7);
    S.rolledFollow = 0;

    /* How long, and what happens in it. Distance is how far apart the two
       places are in the progression — the shore to the basin is a morning and
       the Nowhere Sea to Beneath is not. */
    const dist = Math.abs(VF.locations.rank(to.id) - VF.locations.rank(from.id)) || 1;
    S.dur = U.clamp(9 + dist * 3.4, 10, 26) / Math.max(0.5, VF.boat.speed());

    S.events = [];
    const n = U.clamp(1 + Math.floor(VF.rng.g() * (dist > 2 ? 3 : 2)), 1, 3);
    for (let i = 0; i < n; i++) {
      const e = VF.seaData.roll();
      if (e && !S.events.some(function (x) { return x.def.id === e.id; })) {
        S.events.push({ def: e, at: S.dur * (0.22 + i * 0.30 + VF.rng.g() * 0.08) });
      }
    }
    S.next = 0;

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

    S.t += dt / Math.max(0.4, S.slow);
    D.vyFill.style.width = (U.clamp(S.t / S.dur, 0, 1) * 100).toFixed(1) + '%';

    // the sonar sweeps whether or not anything is there
    S.contactT -= dt;
    if (S.contactT <= 0) {
      S.contactT = VF.rng.g.range(4, 9);
      S.contact = VF.boat.has('sonar') && VF.rng.g() < 0.4 ? VF.rng.g.range(0.3, 1) : 0;
      instruments();
    }

    while (S.next < S.events.length && S.t >= S.events[S.next].at) {
      show(S.events[S.next].def);
      S.next++;
      return;
    }

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

  function paint() {
    if (!VF.voyageArt || !D.voyageCanvas) return;
    VF.voyageArt.draw(D.voyageCanvas, {
      from: S.from, to: S.to, k: U.clamp(S.t / S.dur, 0, 1),
      t: S.t, contact: S.contact, event: S.showing
    });
  }

  /* --------------------------------------------------------------- cards */

  function show(def) {
    S.showing = def;
    S.picked = -1; S.pickT = 0; S.pickMsg = '';
    const d = VF.state.data;
    if (!d.seas || typeof d.seas !== 'object') d.seas = {};
    d.seas[def.id] = (d.seas[def.id] | 0) + 1;

    D.vyKind.textContent = def.kind;
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

  function instruments() {
    if (!D.vyInstr) return;
    U.clear(D.vyInstr);
    const rows = [
      ['speed', VF.boat.speed().toFixed(2) + ' kn', 0],
      ['hull', Math.round(VF.boat.integrity() * 100) + '%', VF.boat.integrity() < 0.4 ? 1 : 0]
    ];
    if (VF.boat.has('sonar')) {
      rows.push(['sonar', S.contact > 0.66 ? 'CONTACT' : S.contact > 0 ? 'return' : 'clear',
                 S.contact > 0.66 ? 1 : 0]);
    }
    rows.push(['bearing', S.to ? S.to.name.toLowerCase() : '—', 0]);
    rows.forEach(function (r) {
      const g = U.el('div', 'vy-gauge' + (r[2] ? ' alert' : ''));
      g.appendChild(U.el('span', 'k', r[0]));
      g.appendChild(U.el('span', 'v', r[1]));
      D.vyInstr.appendChild(g);
    });
  }

  /* A press anywhere during a crossing takes the first option if a card is
     open and does nothing otherwise — the crossing is something you sit
     through, not something you hold a button for. */
  function press() {
    if (!S.on) return false;
    if (S.showing && S.picked < 0) { choose(0); return true; }
    return true;
  }

  VF.voyage = {
    begin: begin, tick: tick, active: active, possible: possible,
    skip: skip, press: press, choose: choose,
    state: function () { return S.on ? { from: S.from, to: S.to, k: S.t / S.dur } : null; }
  };
})(window.VF = window.VF || {});
