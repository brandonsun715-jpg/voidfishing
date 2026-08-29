/* VOID FISHING — the water as a place rather than a band of pixels.

   Everything in this game has been drawn in screen coordinates against
   L.horizonY. That is why the horizon feature sits at W * 0.70 in all nine
   zones, why the pylons on the flats are a table of constants, and why you
   cannot look at anything: there is nowhere for a thing to BE.

   So the water gets coordinates.

     d   how far out. 0 at the hull, 1 at the horizon, and greater than 1 for
         everything past it — distant land at 2, a moon at 40. There is no
         upper bound and nothing beyond 1 is drawn any lower than the horizon
         line, which is what a horizon is.

     u   how far along. World units, not screen fractions. u = 0 is dead ahead
         of the angler and the world runs to about +-2.6, so there is water off
         both sides of the frame to turn the camera towards.

   The projection is deliberately built on the curve the water renderer already
   uses — y = horizon + (1-d)^1.30 * waterH is the same ramp drawMoonpath,
   drawWaveLines and drawShoal space themselves on. A landmark placed through
   here lands ON the surface those functions draw rather than near it.

   Lateral spread does the perspective and, because the camera translates
   rather than rotates, it does the parallax too: shifting the camera by one
   world unit moves near water by spread(0) and the horizon by spread(1), which
   is the whole of the effect and costs one multiply. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* The depth ramp, shared with the water. Nearness is (1 - d), and the
     exponent is what makes the near half of the screen the near tenth of the
     sea. */
  const DEPTH_POW = 1.30;

  /* How wide a world unit is at the hull and at the horizon, as a fraction of
     half the screen. The pair is chosen so that spread(0.5) === 1: a thing at
     mid-water sits where its u says it does, and everything else fans out or
     converges around that. */
  const SPREAD_NEAR = 1.45;
  const SPREAD_FAR = 0.55;

  /* Past the horizon the fan keeps closing, so a mountain at d=3 drifts less
     than an island at d=1 and a moon at d=40 does not drift at all. */
  const SPREAD_BEYOND = 0.30;

  /* Object scale. The near value is 1 by definition; the far value is small
     but never zero, because something a pixel high still wants to be drawn on
     the right side of the fog. */
  const SCALE_POW = 0.85;

  const S = {
    /* filled by sync() every frame from the scene layout */
    hy: 0, wh: 0, w: 0, h: 0,
    density: 0.6,        // how much air is between here and the horizon
    fog: [0, 0, 0],
    halfWorld: 2.6       // how far u runs before there is nothing out there
  };

  /* ------------------------------------------------------------- the ramp */

  /* Screen y of a point on the water at distance d. Anything at or past the
     horizon draws on the horizon line: the sea does not go up. */
  function yAt(d) {
    if (d >= 1) return S.hy;
    const near = 1 - U.clamp(d, 0, 1);
    return S.hy + Math.pow(near, DEPTH_POW) * S.wh;
  }

  /* And back again — which is the whole reason the player can point at water
     and have the line land there. Only meaningful below the horizon. */
  function dAt(y) {
    const k = U.clamp((y - S.hy) / Math.max(1, S.wh), 0, 1);
    return 1 - Math.pow(k, 1 / DEPTH_POW);
  }

  /* How wide one world unit is, in half-screens, at distance d. */
  function spread(d) {
    if (d <= 1) return U.lerp(SPREAD_NEAR, SPREAD_FAR, U.clamp(d, 0, 1));
    /* Beyond the horizon it keeps closing but never reaches zero, so a
       celestial object still moves a hair when the camera swings — enough to
       read as far away rather than as painted on the glass. */
    const k = 1 - 1 / (1 + (d - 1) * 0.5);
    return U.lerp(SPREAD_FAR, SPREAD_BEYOND, k);
  }

  /* Perspective scale. Matches the renderer's own scaleAt() for d in [0,1] so
     that a shadow placed the old way and a landmark placed the new way agree
     about how big a metre is. */
  function scaleAt(d) {
    if (d <= 1) {
      /* The renderer's scaleAt(y) raises the SCREEN fraction to 0.85, and the
         screen fraction is already (1-d)^1.30 — so matching it means one
         exponent, not two applied in sequence. Getting this wrong makes a
         shadow placed the old way and a landmark placed the new way disagree
         about the size of a metre by about six percent, which is exactly the
         kind of error that reads as "the art is a bit off" and never gets
         traced to a number. */
      const near = 1 - U.clamp(d, 0, 1);
      return U.lerp(0.34, 1.0, Math.pow(near, DEPTH_POW * SCALE_POW));
    }
    /* Past the horizon, keep shrinking on the same curve the spread uses, so
       an object that crosses the horizon does not pop. */
    return 0.34 * (spread(d) / SPREAD_FAR);
  }

  /* ----------------------------------------------- atmospheric perspective

     Beer-Lambert rather than a linear ramp, because the point of this is that
     distance should read as distance in a zone that is already black. A fog
     amount is an extinction coefficient: over a long enough path everything
     goes to the fog colour, and how long "long enough" is, is the zone. */
  function fadeAt(d) {
    return 1 - Math.exp(-S.density * Math.max(0, d) * 1.9);
  }

  /* What is left of an object's internal contrast at that distance. Distant
     things do not merely dim, they flatten — that is the cue the eye actually
     reads, and it works even when the whole frame is dark. */
  function contrastAt(d) {
    return U.clamp(1 - fadeAt(d) * 0.82, 0.10, 1);
  }

  /* An object's colour once the air between here and it has had its share. */
  function airMix(rgb, d) {
    return U.mixRgb(rgb, S.fog, fadeAt(d));
  }

  /* ------------------------------------------------------------ projection */

  const out = { x: 0, y: 0, scale: 1, fade: 0, contrast: 1, visible: false, spread: 1 };

  /* The one function everything else calls. Returns a shared object — this
     runs for every landmark of every layer every frame, and allocating a point
     each time is how a renderer ends up collecting garbage mid-cast. Copy what
     you need before calling it again. */
  function project(u, d, cam) {
    const c = cam || VF.camera.get();
    const sp = spread(d);
    out.spread = sp;
    out.x = S.w * 0.5 + (u - c.u) * S.w * 0.5 * sp;
    out.y = yAt(d);
    out.scale = scaleAt(d) * c.zoom;
    out.fade = fadeAt(d);
    out.contrast = contrastAt(d);
    /* Generous margin: a wide landmark whose centre is off-frame still has
       most of itself on it. Callers that know their own width should test
       against that instead. */
    const m = S.w * 0.75;
    out.visible = out.x > -m && out.x < S.w + m;
    return out;
  }

  /* Screen point to water point. Returns null above the horizon, because
     there is no water up there to mean anything. */
  function unproject(x, y, cam) {
    if (y <= S.hy) return null;
    const c = cam || VF.camera.get();
    const d = dAt(y);
    const sp = spread(d);
    const u = (x - S.w * 0.5) / Math.max(1e-4, S.w * 0.5 * sp) + c.u;
    return { u: u, d: d };
  }

  /* Just the horizontal half, for callers that already know their depth. */
  function xAt(u, d, cam) {
    const c = cam || VF.camera.get();
    return S.w * 0.5 + (u - c.u) * S.w * 0.5 * spread(d);
  }

  /* How far off the near edge of the world u is — used to keep the camera and
     the cast inside the water rather than out past the end of it. */
  function clampU(u) {
    return U.clamp(u, -S.halfWorld, S.halfWorld);
  }

  /* ---------------------------------------------------------------- sync

     Called once per frame from the scene, before anything is drawn, so every
     projection in the frame agrees about where the horizon is. Reads the
     layout the renderer already computed rather than recomputing it. */
  function sync(L, P) {
    S.hy = L.horizonY;
    S.wh = Math.max(1, L.waterH);
    S.w = L.w; S.h = L.h;
    S.fog = P.fog;
    /* Zone air density, thickened by weather. A zone that declares nothing
       falls back to the fog amount it already had in js/data/locations.js, so
       this is correct for all nine before any of them are touched. */
    const loc = VF.locations.current();
    const z = VF.zoneData && VF.zoneData.get(loc.id);
    const base = (z && z.spatial && z.spatial.air !== undefined)
      ? z.spatial.air : (loc.fogAmt || 0.3);
    S.density = U.clamp(base + (VF.weather ? VF.weather.fog() * 0.55 : 0), 0.05, 3.2);
    S.halfWorld = (z && z.spatial && z.spatial.width) || 2.6;
  }

  VF.space = {
    sync: sync,
    project: project, unproject: unproject,
    xAt: xAt, yAt: yAt, dAt: dAt,
    scaleAt: scaleAt, spread: spread,
    fadeAt: fadeAt, contrastAt: contrastAt, airMix: airMix,
    clampU: clampU,
    halfWorld: function () { return S.halfWorld; },
    density: function () { return S.density; },
    DEPTH_POW: DEPTH_POW
  };
})(window.VF = window.VF || {});
