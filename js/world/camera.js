/* VOID FISHING — where the frame is looking.

   The game has never had a camera. It had one transform, the screen shake,
   and a horizon line that jumped 22% of the screen height whenever you moved
   spot. A camera is what turns "there is a lighthouse at u = -1.4" into
   something the player can go and look at, and it is the difference between a
   landmark and a decoration.

   It translates rather than rotates, which is why js/world/space.js gets its
   parallax for free: one world unit is wider near than far, so sliding the
   camera slides near water further than the horizon without anybody having to
   say so.

   Modes are contexts rather than animations. Nothing here cuts; every mode is
   a set of targets and the springs get there. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const C = {
    u: 0, zoom: 1, pitch: 0,           // pitch: -1 look down at the water, +1 up
    tu: 0, tzoom: 1, tpitch: 0,
    vu: 0,                             // lateral velocity, for the drag release
    mode: 'rest',
    look: null,                        // {u, d} something has asked to be framed
    lookT: 0,
    userT: 0,                          // seconds since the player last steered
    restPhase: 0,
    /* Off until a zone has a world wide enough to look around in.

       The distant plates — the baked ridgeline, the zone's back layer — are
       full-screen canvases blitted at the origin. Sliding the frame across
       them before they are baked with margins would drag empty edges into
       shot. So the camera is live, ticking and spring-loaded from the moment
       it loads, and it does not move until js/world/landmarks.js says the
       place it is looking at extends past the frame. */
    enabled: false
  };

  /* How hard each mode pulls, and how far it lets the frame travel. `rest` is
     deliberately the loosest: the idle camera drifts, it does not patrol. */
  const MODES = {
    rest:      { rate: 0.55, zoom: 1.00, pitch: 0.00, lead: 0.30 },
    aim:       { rate: 0.10, zoom: 1.00, pitch: -0.06, lead: 1.00 },
    fish:      { rate: 0.40, zoom: 1.00, pitch: -0.03, lead: 0.55 },
    observe:   { rate: 0.30, zoom: 0.96, pitch: 0.02, lead: 0.85 },
    encounter: { rate: 0.22, zoom: 0.88, pitch: 0.05, lead: 0.70 },
    crossing:  { rate: 0.90, zoom: 1.00, pitch: 0.00, lead: 0.00 }
  };

  function def() { return MODES[C.mode] || MODES.rest; }

  /* ------------------------------------------------------------- steering */

  /* The player pans. Drag on the water, or A/D. This wins over everything a
     system asked for, for a few seconds afterwards — being dragged back to
     what the game thinks is interesting is the fastest way to make a camera
     feel like it is not yours. */
  function steer(du) {
    if (!C.enabled) return;
    C.tu = VF.space.clampU(C.tu + du);
    C.userT = 3.2;
  }

  function setMode(m) {
    if (!MODES[m] || C.mode === m) return;
    C.mode = m;
  }

  /* A system says "this matters, put it in frame". Honoured softly and only
     while the player is not steering. */
  function look(u, d, weight) {
    C.look = { u: u, d: d === undefined ? 0.5 : d, w: weight === undefined ? 1 : weight };
    C.lookT = 2.4;
  }

  function release() { C.look = null; C.lookT = 0; }

  /* --------------------------------------------------------------- update */

  function tick(dt) {
    const m = def();
    C.userT = Math.max(0, C.userT - dt);
    C.lookT = Math.max(0, C.lookT - dt);

    if (!C.enabled) {
      /* Still springs, so that turning it on mid-zone eases in rather than
         snapping, and so the projection has a settled camera to read. */
      C.tu = 0;
      C.u = U.approach(C.u, 0, 0.01, dt);
      C.zoom = U.approach(C.zoom, 1, 0.02, dt);
      C.pitch = U.approach(C.pitch, 0, 0.03, dt);
      return;
    }

    /* Where the frame wants to be, if nobody is holding the wheel. */
    if (C.userT <= 0) {
      if (C.look && C.lookT > 0) {
        C.tu = VF.space.clampU(U.lerp(C.tu, C.look.u, m.lead * C.look.w * Math.min(1, dt * 2.4)));
      } else if (C.mode === 'rest') {
        /* A slow wander, so a still frame is not a photograph. Two periods
           that do not divide into each other, or it reads as a metronome. */
        C.restPhase += dt;
        const drift = Math.sin(C.restPhase * 0.074) * 0.16 + Math.sin(C.restPhase * 0.031) * 0.09;
        C.tu = VF.space.clampU(drift);
      }
    }

    C.tzoom = m.zoom;
    C.tpitch = m.pitch;

    /* Critically damped enough to never overshoot into a wobble, which on a
       horizon line reads as seasickness rather than as weight. */
    C.u = U.approach(C.u, C.tu, m.rate * 0.01, dt);
    C.zoom = U.approach(C.zoom, C.tzoom, 0.02, dt);
    C.pitch = U.approach(C.pitch, C.tpitch, 0.03, dt);
  }

  /* What the pitch does to the horizon, in pixels. Small: this is a nod
     towards looking up or down, not a flight simulator. */
  function pitchOffset(h) { return C.pitch * h * 0.055; }

  function reset(u) {
    C.u = C.tu = u || 0;
    C.zoom = C.tzoom = 1;
    C.pitch = C.tpitch = 0;
    C.vu = 0; C.look = null; C.lookT = 0; C.userT = 0;
    C.mode = 'rest';
  }

  VF.camera = {
    tick: tick, steer: steer, setMode: setMode, look: look, release: release,
    reset: reset, pitchOffset: pitchOffset,
    get: function () { return C; },
    mode: function () { return C.mode; },
    u: function () { return C.u; },
    enabled: function () { return C.enabled; },
    enable: function (on) { C.enabled = !!on; if (!on) { C.tu = 0; C.userT = 0; } },
    /* the tools and the debug overlay drive it directly */
    set: function (u) { C.u = C.tu = VF.space.clampU(u); C.userT = 0; }
  };

  VF.bus.on('location:changed', function () { reset(0); });
})(window.VF = window.VF || {});
