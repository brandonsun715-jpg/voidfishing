/* VOID FISHING — drawing the things js/world/landmarks.js placed.

   Everything here takes a landmark and its projection and draws it at that
   distance: the size, the haze, the flattening of its contrast and whether it
   is worth drawing at all all come out of `d` rather than out of a constant.
   That is what makes the same wreck at 0.4 and at 0.9 read as one object at
   two distances instead of as two different sprites, and it is the only way
   the player gets a sense of how far away anything is.

   Shapes are built from curves. The old environment art was a rectangle, a
   circle and a loop stepping x forward, and six different silhouettes drawn
   that way all read as the same silhouette, because a construction is more
   visible than the shape it makes.

   Nothing in here decides where anything goes. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const G = VF.grammar;
  const TAU = U.TAU;

  /* A landmark's colour: its own tone, taken toward the air by how much air
     is in front of it, then flattened. Distance does not only dim a thing. */
  function tone(P, l, p, k) {
    const base = U.mixRgb(P.fog, [0, 0, 0], U.clamp(k, 0, 1));
    return U.rgbToCss(VF.space.airMix(base, l.d));
  }

  function lit(P, p, a) {
    return U.rgbToCss(U.mixRgb(P.glow, P.fog, p.fade * 0.7), a * (1 - p.fade * 0.5));
  }

  /* Half the width of one world unit, in pixels, at this distance. Everything
     is sized in world units so that a dock is a dock however far off it is. */
  function unit(p, L) { return L.w * 0.5 * p.spread; }

  /* ------------------------------------------------------------ the arts */

  const ART = {};

  /* A headland running up out of the top of the frame. The cliff face is a
     spline with noise deformation rather than a polygon: the strata and the
     erosion are what stop a large dark shape reading as a paper cut-out, and
     they have to be part of the outline, not drawn on top of it. */
  ART.headland = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.62 * l.scale;
    const hy = L.horizonY;
    const top = -L.h * 0.06;
    const x = p.x;
    /* `u` is where the seaward face is. The rock is on the far side of it,
       running off the edge of the frame — a headland whose mass grows toward
       the middle of the picture is not a headland, it is a wall. */
    const sea = l.u < 0 ? 1 : -1;       // which way the open water lies
    const off = x - sea * w * 2.6;      // the landward end, off frame

    /* The seaward edge, top to waterline. It leans out as it comes down, the
       way a cliff standing in water does, and the noise is IN the outline
       rather than drawn over it — an outline with detail added afterwards
       still reads as a cut-out. */
    const pts = [];
    const n = 11;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const y = U.lerp(top, hy + 2, k);
      const bulge = (G.fbm(k * 3.4 + l.u * 7, 4102, 4, 0.55) - 0.5) * w * 0.34;
      const lean = w * U.lerp(0, 0.52, Math.pow(k, 1.4));
      pts.push({ x: x + sea * (lean + bulge), y: y });
    }

    g.save();
    g.beginPath();
    g.moveTo(off, top - 20);
    g.lineTo(pts[0].x, top - 20);
    G.path(g, pts, false);
    g.lineTo(off, hy + 2);
    g.closePath();

    /* Not a flat fill. The base of a cliff sits in its own shadow and the top
       is in whatever air there is, so the value runs the other way to the sky
       behind it — which is the whole of why it separates from the sky at all. */
    const grad = g.createLinearGradient(0, top, 0, hy);
    grad.addColorStop(0, tone(P, l, p, 0.58));
    grad.addColorStop(0.62, tone(P, l, p, 0.78));
    grad.addColorStop(1, tone(P, l, p, 0.90));
    g.fillStyle = grad;
    g.fill();

    /* Strata, clipped to the rock and following its lean, so they read as
       bedding planes rather than as lines ruled across a shape. */
    g.clip();
    g.strokeStyle = U.rgbToCss(P.skyBot, 0.10 * p.contrast);
    g.lineWidth = 1;
    for (let i = 1; i < 11; i++) {
      const k = i / 11;
      const y = U.lerp(top, hy, k);
      const dip = w * 0.13 * (1 + G.hash1(i, 61));
      g.beginPath();
      g.moveTo(off, y + dip);
      g.lineTo(x + sea * w * 0.9, y - dip * 0.5);
      g.stroke();
    }
    g.restore();

    /* And the edge itself, lit only if the light is actually on that side. */
    if (((L.glowX - x) > 0 ? 1 : -1) === sea) {
      g.save();
      g.beginPath();
      G.path(g, pts);
      g.strokeStyle = lit(P, p, 0.26);
      g.lineWidth = Math.max(1, w * 0.014);
      g.stroke();
      g.restore();
    }
  };

  /* The lighthouse. Small on purpose: it is a scale reference, and a scale
     reference that is impressive on its own is not doing the job. */
  ART.lighthouse = function (g, l, p, P, L) {
    const macro = VF.landmarks.world() && VF.landmarks.world().macro;
    const w = unit(p, L);
    const h = Math.max(6, w * 0.16 * l.scale);
    const bw = h * 0.26;
    /* It stands on the headland's shoulder rather than in the water: perch is
       how far up the cliff, measured from the waterline. */
    const hy = L.horizonY;
    const perch = l.perch === undefined ? 0.86 : l.perch;
    const baseY = macro ? U.lerp(hy, -L.h * 0.06, perch) : hy;
    const x = p.x;

    g.save();
    g.fillStyle = tone(P, l, p, 0.86);
    g.beginPath();
    g.moveTo(x - bw * 0.62, baseY);
    g.quadraticCurveTo(x - bw * 0.44, baseY - h * 0.55, x - bw * 0.34, baseY - h);
    g.lineTo(x + bw * 0.34, baseY - h);
    g.quadraticCurveTo(x + bw * 0.44, baseY - h * 0.55, x + bw * 0.62, baseY);
    g.closePath();
    g.fill();
    // the gallery, which is the detail that says lighthouse and not chimney
    g.fillRect(x - bw * 0.60, baseY - h - h * 0.09, bw * 1.20, Math.max(1, h * 0.06));
    g.fillRect(x - bw * 0.40, baseY - h - h * 0.22, bw * 0.80, Math.max(1, h * 0.14));
    // the seaward rim
    g.beginPath();
    g.moveTo(x - bw * 0.62, baseY);
    g.quadraticCurveTo(x - bw * 0.44, baseY - h * 0.55, x - bw * 0.34, baseY - h);
    g.strokeStyle = lit(P, p, 0.34);
    g.lineWidth = 1;
    g.stroke();
    g.restore();
    // where the lamp goes, for the live beam to hang off
    l.lamp = { x: x, y: baseY - h - h * 0.16, r: bw * 0.5 };
  };

  /* An island: a curve, not a bump. Three control points give a hill; seven
     with noise on them give somewhere that might have a beach on the far side. */
  ART.island = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.16 * l.scale;
    const h = w * (0.34 + G.hash1(Math.round(l.u * 1000), 91) * 0.5);
    const hy = L.horizonY;
    const pts = [];
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const prof = Math.sin(k * Math.PI);
      const rough = (G.fbm(k * 4 + l.u * 11, 733, 3, 0.5) - 0.5) * 0.5;
      pts.push({ x: p.x + U.lerp(-w, w, k),
                 y: hy + 1 - h * Math.max(0, prof * (1 + rough)) });
    }
    g.beginPath();
    g.moveTo(p.x - w, hy + 1);
    G.path(g, pts, false);
    g.lineTo(p.x + w, hy + 1);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.60);
    g.fill();
  };

  /* The dock. Posts of unequal length in unequal spacing, because a jetty
     that has been standing in water for a long time is not a comb. */
  ART.dock = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.30 * l.scale;
    const deck = Math.max(1.5, p.scale * L.h * 0.010);
    const y = p.y;
    const x0 = p.x - w, x1 = p.x + w;

    g.save();
    g.fillStyle = tone(P, l, p, 0.90);
    g.fillRect(x0, y - deck, w * 2, deck);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const k = (i + 0.4) / n;
      const px = U.lerp(x0, x1, k);
      const ph = p.scale * L.h * (0.024 + G.hash1(i + Math.round(l.u * 100), 17) * 0.020);
      g.fillRect(px, y, Math.max(1, deck * 0.5), ph);
    }
    // one post taller than the rest, with something still tied to it
    const tx = U.lerp(x0, x1, 0.93);
    const th = p.scale * L.h * 0.055;
    g.fillRect(tx, y - th, Math.max(1, deck * 0.6), th + p.scale * L.h * 0.02);
    g.beginPath();
    g.moveTo(x0, y - deck);
    g.lineTo(x1, y - deck);
    g.strokeStyle = lit(P, p, 0.18);
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  };

  /* A hull, half under. It reads from the broken mast rather than the hull —
     at forty pixels the hull is a dash and the mast is the sentence. */
  ART.wreck = function (g, l, p, P, L) {
    const bl = unit(p, L) * 0.085 * l.scale;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(0.18 + G.hash1(Math.round(l.u * 500), 5) * 0.2);
    g.fillStyle = tone(P, l, p, 0.88);
    g.beginPath();
    g.moveTo(-bl, 0);
    g.quadraticCurveTo(-bl * 0.5, -bl * 0.34, bl * 0.86, -bl * 0.16);
    g.lineTo(bl, bl * 0.02);
    g.quadraticCurveTo(0, bl * 0.14, -bl, 0);
    g.closePath();
    g.fill();
    g.strokeStyle = tone(P, l, p, 0.88);
    g.lineWidth = Math.max(1, bl * 0.06);
    g.beginPath();
    g.moveTo(-bl * 0.1, -bl * 0.22);
    g.lineTo(bl * 0.26, -bl * 1.05);
    g.stroke();
    g.beginPath();
    g.moveTo(bl * 0.26, -bl * 1.05);
    g.lineTo(bl * 0.62, -bl * 0.86);
    g.stroke();
    g.beginPath();
    g.moveTo(-bl * 0.9, -bl * 0.02);
    g.quadraticCurveTo(-bl * 0.4, -bl * 0.32, bl * 0.82, -bl * 0.15);
    g.strokeStyle = lit(P, p, 0.22);
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  };

  /* --------------------------------------------------------------- micro

     Small things, and the rule for all of them is the same: below about four
     pixels they stop being a shape and start being noise, so they are not
     drawn at all rather than drawn as a speck. */

  ART.buoy = function (g, l, p, P, L) {
    const r = Math.max(1, p.scale * L.h * 0.006 * l.scale);
    g.fillStyle = tone(P, l, p, 0.82);
    g.beginPath();
    g.ellipse(p.x, p.y, r, r * 0.8, 0, 0, TAU);
    g.fill();
    g.fillRect(p.x - r * 0.16, p.y - r * 2.4, r * 0.32, r * 1.8);
    g.fillStyle = lit(P, p, 0.5);
    g.fillRect(p.x - r * 0.3, p.y - r * 2.9, r * 0.6, r * 0.6);
  };

  ART.post = function (g, l, p, P, L) {
    const h = Math.max(2, p.scale * L.h * 0.022 * l.scale);
    const w = Math.max(1, h * 0.12);
    g.fillStyle = tone(P, l, p, 0.9);
    g.save();
    g.translate(p.x, p.y);
    g.rotate((G.hash1(Math.round(l.u * 900), 3) - 0.5) * 0.34);
    g.fillRect(-w * 0.5, -h, w, h);
    g.restore();
  };

  ART.crate = function (g, l, p, P, L) {
    const s = Math.max(2, p.scale * L.h * 0.010 * l.scale);
    g.save();
    g.translate(p.x, p.y);
    g.rotate((G.hash1(Math.round(l.u * 700), 9) - 0.5) * 0.5);
    g.fillStyle = tone(P, l, p, 0.86);
    g.fillRect(-s, -s * 0.62, s * 2, s * 0.9);
    g.restore();
  };

  ART.rock = function (g, l, p, P, L) {
    const s = Math.max(2, p.scale * L.h * 0.011 * l.scale);
    const pts = [];
    for (let i = 0; i <= 7; i++) {
      const a = (i / 7) * Math.PI;
      const rr = s * (0.7 + G.hash1(i + Math.round(l.u * 300), 21) * 0.6);
      pts.push({ x: p.x - Math.cos(a) * rr, y: p.y - Math.sin(a) * rr * 0.55 });
    }
    g.beginPath();
    g.moveTo(p.x - s, p.y);
    G.path(g, pts, false);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.84);
    g.fill();
  };

  /* A net, floating. Two arcs and some slack — the only thing that says net
     at this size is that it sags. */
  ART.net = function (g, l, p, P, L) {
    const w = Math.max(3, p.scale * L.h * 0.020 * l.scale);
    g.strokeStyle = tone(P, l, p, 0.70);
    g.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(p.x - w, p.y + i);
      g.quadraticCurveTo(p.x, p.y + w * 0.34 + i, p.x + w, p.y + i);
      g.stroke();
    }
  };

  /* --------------------------------------------------------------- secret

     Something standing in the water past the last island. It is drawn as an
     absence rather than an object: no detail, no edge light, nothing to
     resolve however hard it is looked at. */
  ART.standing = function (g, l, p, P, L) {
    const h = p.scale * L.h * 0.10 * l.scale;
    const w = Math.max(1.2, h * 0.075);
    g.save();
    /* Present but almost not: this is the thing the player is meant to doubt
       having seen, so it sits a hair above the fog rather than in front of it. */
    g.globalAlpha = U.clamp(0.55 - p.fade * 0.35, 0.08, 0.55);
    g.fillStyle = 'rgba(2,3,6,1)';
    g.beginPath();
    g.moveTo(p.x - w, p.y);
    g.quadraticCurveTo(p.x - w * 0.6, p.y - h, p.x, p.y - h * 1.06);
    g.quadraticCurveTo(p.x + w * 0.6, p.y - h, p.x + w, p.y);
    g.closePath();
    g.fill();
    g.restore();
  };

  /* ---------------------------------------------------------------- draw */

  /* Behind the water: anything at or past the horizon. Drawn back to front so
     a near island overlaps a far one rather than the other way round. */
  function drawBehind(ctx, L, P) {
    if (!VF.landmarks || !VF.space) return;
    const w = VF.landmarks.world();
    if (!w) return;
    const cam = VF.camera.get();
    const list = w.all.filter(function (l) { return l.d >= 1; });
    list.sort(function (a, b) { return b.d - a.d; });
    for (let i = 0; i < list.length; i++) drawOne(ctx, list[i], L, P, cam);
  }

  /* On the water: everything nearer than the horizon. */
  function drawOn(ctx, L, P) {
    if (!VF.landmarks || !VF.space) return;
    const w = VF.landmarks.world();
    if (!w) return;
    const cam = VF.camera.get();
    const list = w.all.filter(function (l) { return l.d < 1; });
    list.sort(function (a, b) { return b.d - a.d; });
    for (let i = 0; i < list.length; i++) drawOne(ctx, list[i], L, P, cam);
  }

  function drawOne(ctx, l, L, P, cam) {
    const fn = ART[l.art];
    if (!fn) return;
    const p = VF.space.project(l.u, l.d, cam);
    if (!p.visible) return;
    /* Fog takes it before the draw call does. Past this there is nothing on
       the screen to see and the work is wasted. */
    if (p.fade > 0.985) return;
    try { fn(ctx, l, p, P, L); }
    catch (e) { /* one bad landmark must not take the frame */ }
  }

  VF.landmarkArt = { drawBehind: drawBehind, drawOn: drawOn, ART: ART };
})(window.VF = window.VF || {});
