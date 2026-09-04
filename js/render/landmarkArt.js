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

  /* A headland. The cliff face is a spline with noise deformation rather than
     a polygon: the strata and the erosion are what stop a large dark shape
     reading as a paper cut-out, and they have to be part of the outline, not
     drawn on top of it.

     IT HAS A TOP NOW, and how high that is comes off the distance. It used to
     run off the top of the frame at every range — "a headland running up out
     of the top of the frame" — which is right for one you are sitting under
     and wrong for one across the bay, and the Quiet Shore's is across the
     bay. A promontory with no sky above it is not a promontory, it is a
     curtain down one side of the picture, and that is exactly what it looked
     like: a flat dark slab with a lit dot in the corner.

     So: at the horizon it stands a fraction of the frame above it and you can
     see the sky over the top of it, and as it comes toward you it grows until
     it does run off the top, at which point the old drawing is the right
     drawing again. */
  ART.headland = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.62 * l.scale;
    const hy = L.horizonY;
    /* p.scale falls off with distance on the same ramp everything else uses,
       so this needs no distance term of its own. */
    const rise = L.h * 1.05 * p.scale * l.scale * (l.tall ? 1 : 0.62);
    const top = Math.max(-L.h * 0.06, hy - rise);
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
    /* When the top is in frame the ridge has to come DOWN to meet the land
       behind it, or the shape ends in a straight cut across the sky. */
    const capped = top > -L.h * 0.05;
    const ridge = [];
    if (capped) {
      const back = 7;
      for (let i = 0; i <= back; i++) {
        const k = i / back;
        const rx = U.lerp(pts[0].x, off, k);
        const n2 = (G.fbm(k * 2.6 + l.u * 3, 7714, 4, 0.55) - 0.5);
        ridge.push({ x: rx, y: top + Math.pow(k, 0.7) * rise * 0.22 + n2 * rise * 0.10 });
      }
    }

    g.save();
    g.beginPath();
    if (capped) {
      /* over the top and back down inland */
      g.moveTo(off, hy + 2);
      for (let i = ridge.length - 1; i >= 0; i--) {
        i === ridge.length - 1 ? g.lineTo(ridge[i].x, ridge[i].y) : g.lineTo(ridge[i].x, ridge[i].y);
      }
      G.path(g, pts, false);
    } else {
      g.moveTo(off, top - 20);
      g.lineTo(pts[0].x, top - 20);
      G.path(g, pts, false);
    }
    g.lineTo(off, hy + 2);
    g.closePath();

    /* Not a flat fill. The base of a cliff sits in its own shadow and the top
       is in whatever air there is, so the value runs the other way to the sky
       behind it — which is the whole of why it separates from the sky at all. */
    /* Darker than the air it stands in, at every distance. It used to take
       the atmospheric mix like everything else and come out at almost exactly
       the sky's value — so the fill vanished and all that was left was the
       lit edge, which read as a wire running down the side of the picture.
       Land at night is a hole in the sky first and a surface second. */
    const grad = g.createLinearGradient(0, top, 0, hy);
    grad.addColorStop(0, tone(P, l, p, 0.80));
    grad.addColorStop(0.62, tone(P, l, p, 0.90));
    grad.addColorStop(1, tone(P, l, p, 0.96));
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

    /* And the edge itself, lit only if the light is actually on that side —
       a rim on a shape, so it is hairline. At `w * 0.014` on a headland this
       size it was four pixels of bright grey and it read as cabling. */
    if (((L.glowX - x) > 0 ? 1 : -1) === sea) {
      g.save();
      g.beginPath();
      G.path(g, pts);
      g.strokeStyle = lit(P, p, 0.20);
      g.lineWidth = Math.max(1, Math.min(2.2, w * 0.006));
      g.stroke();
      g.restore();
    }
  };

  /* Where the top of a headland actually is, so anything standing on it can
     ask rather than guess. The same expression the headland draws itself
     with, in one place, because two copies of it drift. */
  function macroTop(macro, L) {
    if (!macro || macro.art !== 'headland' || !VF.space) return -L.h * 0.06;
    const p = VF.space.project(macro.u, macro.d, VF.camera ? VF.camera.get() : null);
    const rise = L.h * 1.05 * p.scale * (macro.scale || 1) * (macro.tall ? 1 : 0.62);
    return Math.max(-L.h * 0.06, L.horizonY - rise);
  }

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
    /* Up the cliff from the waterline, measured against the cliff's ACTUAL
       top rather than against the top of the frame. The headland has a height
       that falls off with distance now, so a perch expressed as a fraction of
       the screen put the light in the sky above a far one and inside a near
       one — it has to be a fraction of the rock. */
    const rise = macro ? Math.max(L.h * 0.06, hy - macroTop(macro, L)) : L.h * 0.5;
    const baseY = hy - rise * perch;
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

  /* ============================================================ THE TRENCH

     Everything here is vertical, and everything here is nearly invisible.
     The zone's air density is 0.92 against the shore's 0.20, so an object at
     the same distance arrives with four times as much water in front of it —
     which is the point, and is why these shapes are built to read as an
     outline against a slightly less black background rather than as an object
     with detail on it. */

  /* The far wall of the seam. It leaves the top of the frame and it does not
     have a bottom, because the bottom is eleven hundred metres down. */
  /* ------------------------------------------------------- the basin

     A bowl. The trench has one wall and open water in every other direction;
     this has to CLOSE, and enclosure is not one big rock — it is a far rim
     you cannot see past and masses at the edges of vision you cannot see
     round. Three shapes do it, and none of them is a headland: a headland is
     a thing you look AT, and these are things you are inside. */

  /* The far side of the bowl. Low and very wide — it is at the horizon and it
     runs most of the way across, so what it says is "that is as far as this
     water goes", which is the opposite of what a promontory says.

     Its profile is two frequencies: a long swell that gives it a shape, and a
     ridged detail that stops the outline reading as a curve somebody drew.
     Nothing on it is lit. You are not meant to be able to tell how far away
     it is, which is why the bowl feels big. */
  ART.basinrim = function (g, l, p, P, L) {
    const w = unit(p, L) * 1.45 * l.scale;
    const hy = L.horizonY;
    const h = p.scale * L.h * 0.085 * l.scale;
    const pts = [];
    const n = 30;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      /* Down at both ends: the rim runs away from you rather than stopping. */
      const shoulder = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, k))), 0.55);
      const swell = G.fbm(k * 2.2 + l.u * 3.0, 4409, 3, 0.55);
      const ridge = (G.ridged(k * 9.0 + l.u * 7, 4410, 3) - 0.5) * 0.30;
      const up = h * shoulder * (0.55 + swell * 0.75 + ridge);
      pts.push({ x: p.x + U.lerp(-w, w, k), y: hy + 1 - Math.max(0, up) });
    }
    g.beginPath();
    g.moveTo(p.x - w, hy + 2);
    G.path(g, pts, false);
    g.lineTo(p.x + w, hy + 2);
    g.closePath();
    const grad = g.createLinearGradient(0, hy - h, 0, hy);
    grad.addColorStop(0, tone(P, l, p, 0.52));
    grad.addColorStop(1, tone(P, l, p, 0.78));
    g.fillStyle = grad;
    g.fill();
  };

  /* One of the two masses at the sides. Taller than the rim and much nearer,
     so it is the thing that actually encloses — and because it is near, it is
     also what the sightline blocker in js/world/landmarks.js hangs water
     behind. In the one zone whose mechanic is watching a path of light on the
     water, a piece of water you cannot see is worth moving for. */
  ART.headwall = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.30 * l.scale;
    const hy = L.horizonY;
    const h = p.scale * L.h * 0.34 * l.scale;
    const x = p.x;
    /* Which way it faces: outward, toward the nearer frame edge. The bowl
       only closes if the two of them lean in. */
    const sea = l.u < 0 ? 1 : -1;

    const pts = [];
    const n = 16;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      /* A WALL, which is not a hill.

         The first version of this was pow(sin(k·π), 0.40) — up, over, down —
         and at close range it drew a smooth dome sitting in the middle of the
         water like a whale. A wall does not come back down: it goes up out of
         the water at the inboard end, stays up, and runs off the side of the
         frame. So the profile rises fast over the first fifth and then holds,
         and the top is uneven rather than curved. */
      const rise = Math.pow(Math.min(1, k / 0.22), 0.55);
      const top = 0.86 + G.fbm(k * 3.4 + l.u * 6, 4413, 3, 0.5) * 0.30;
      const crease = (G.ridged(k * 6.0 + l.u * 5, 4411, 3) - 0.48) * w * 0.22;
      pts.push({ x: x + sea * (U.lerp(-w * 0.15, w * 1.9, k) + crease),
                 y: p.y + 1 - h * rise * top });
    }
    g.save();
    g.beginPath();
    g.moveTo(x - sea * w, p.y + 2);
    G.path(g, pts, false);
    g.lineTo(x + sea * w, p.y + 2);
    g.closePath();
    const grad = g.createLinearGradient(0, p.y - h, 0, p.y);
    grad.addColorStop(0, tone(P, l, p, 0.70));
    grad.addColorStop(1, tone(P, l, p, 0.97));
    g.fillStyle = grad;
    g.fill();
    /* Verticals down the face, and only on the side away from the moon: the
       lit face is a silhouette and the shaded one is where the rock is. */
    g.clip();
    g.strokeStyle = U.rgbToCss(P.glow, 0.045 * p.contrast);
    g.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const fx = x + sea * U.lerp(-w * 0.8, w * 0.5, (i + 0.5) / 7);
      g.beginPath();
      g.moveTo(fx, p.y - h * 0.92);
      g.lineTo(fx + sea * w * 0.09, p.y);
      g.stroke();
    }
    g.restore();
  };

  /* The way in and the way out: two shoulders and a gap. The gap is the only
     direction in the frame that is not closed, and that is what tells you the
     rest of it is — an enclosure is legible from its one opening, never from
     its walls. The moonpath runs out through here. */
  ART.narrows = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.42 * l.scale;
    const hy = L.horizonY;
    const h = p.scale * L.h * 0.13 * l.scale;
    const gap = w * (0.20 + G.hash1(Math.round(l.u * 700), 53) * 0.10);

    function shoulder(cx, dir) {
      const pts = [];
      const n = 12;
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        /* Tall at the gap and running down away from it, which is what makes
           the space between them read as a passage rather than as two rocks. */
        const prof = Math.pow(1 - k, 0.62);
        const rough = (G.fbm(k * 5 + l.u * 9 + dir, 4412, 3, 0.5) - 0.5) * 0.4;
        pts.push({ x: cx + dir * U.lerp(0, w, k),
                   y: p.y + 1 - h * Math.max(0, prof * (1 + rough)) });
      }
      g.beginPath();
      g.moveTo(cx, p.y + 2);
      G.path(g, pts, false);
      g.lineTo(cx + dir * w, p.y + 2);
      g.closePath();
      g.fillStyle = tone(P, l, p, 0.88);
      g.fill();
    }
    shoulder(p.x - gap, -1);
    shoulder(p.x + gap, 1);
  };

  /* Something under the surface, seen through it.

     Nothing else in this game is drawn below the waterline as a solid, and
     this is the zone where it belongs: the basin is the still one, and still
     water is the only water you can see into. It is deliberately not
     identified — a straight edge and a right angle under two metres of black
     water, and no part of the game ever says what it was. */
  ART.submerged = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.13 * l.scale;
    const y = p.y;
    const sink = p.scale * L.h * 0.012;
    const tilt = (G.hash1(Math.round(l.u * 900), 71) - 0.5) * 0.5;

    g.save();
    /* Under water: low contrast, and the tone goes toward the water rather
       than toward the air, because there is no air in front of this. */
    g.globalAlpha = 0.30 + 0.22 * (1 - p.fade);
    g.fillStyle = U.rgbToCss(U.mixRgb(P.waterBot, P.glow, 0.18), 1);
    g.beginPath();
    g.moveTo(p.x - w, y + sink);
    g.lineTo(p.x - w * 0.86 + tilt * w, y + sink * 2.6);
    g.lineTo(p.x + w * 0.94 + tilt * w, y + sink * 2.2);
    g.lineTo(p.x + w, y + sink * 0.4);
    g.closePath();
    g.fill();
    /* One edge catching what light gets down there. A submerged thing reads
       from its edge, because that is the only part with any contrast. */
    g.globalAlpha = 0.20 * (1 - p.fade);
    g.strokeStyle = lit(P, p, 0.9);
    g.lineWidth = Math.max(1, w * 0.03);
    g.beginPath();
    g.moveTo(p.x - w, y + sink);
    g.lineTo(p.x + w, y + sink * 0.4);
    g.stroke();
    g.restore();
  };

  /* A piece of the rim that is missing.

     It is only ever seen as an absence — a notch with the sky in it — and it
     is only visible at all when the moon is low enough to be behind it. That
     is the entire discovery: you look at the far side of the bowl on the
     right night and there is a gap in it that was not there before, because
     on every other night there was nothing behind it to see it against. */
  ART.cleft = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.055 * l.scale;
    const hy = L.horizonY;
    const h = p.scale * L.h * 0.10 * l.scale;
    /* How much light is coming through it, which is how near the moon is to
       being in the gap. Nothing draws when nothing is behind it. */
    const near = 1 - U.clamp(Math.abs(p.x - L.glowX) / (L.w * 0.30), 0, 1);
    if (near <= 0.02) return;

    g.save();
    g.globalCompositeOperation = 'lighter';
    const grad = g.createLinearGradient(0, hy - h, 0, hy);
    grad.addColorStop(0, U.rgbToCss(P.glow, 0.0));
    grad.addColorStop(1, U.rgbToCss(P.glow, 0.16 * near * (1 - p.fade)));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(p.x - w, hy + 1);
    g.lineTo(p.x - w * 0.55, hy - h);
    g.lineTo(p.x + w * 0.55, hy - h);
    g.lineTo(p.x + w, hy + 1);
    g.closePath();
    g.fill();
    g.restore();
  };

  /* Micro: what collects at the foot of a wall. */
  ART.boulder = function (g, l, p, P, L) {
    const r = Math.max(1.2, p.scale * L.h * 0.013 * l.scale);
    const sq = 0.55 + G.hash1(Math.round(l.u * 1300), 29) * 0.5;
    g.beginPath();
    g.ellipse(p.x, p.y - r * sq * 0.5, r, r * sq, 0, Math.PI, 0);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.95);
    g.fill();
  };

  ART.driftlog = function (g, l, p, P, L) {
    const w = Math.max(2, p.scale * L.h * 0.026 * l.scale);
    const t = Math.max(1, w * 0.13);
    const lean = (G.hash1(Math.round(l.u * 1700), 37) - 0.5) * 0.6;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(lean * 0.30);
    g.fillStyle = tone(P, l, p, 0.93);
    g.fillRect(-w, -t, w * 2, t * 2);
    g.restore();
  };

  /* -------------------------------------------------------- the flats

     NOTHING TALL. Every other zone is shaped by something standing out of the
     water; this one is shaped by the fact that almost nothing does. The rule
     for everything here is that it should look like it was cut rather than
     eroded — the water model already makes the surface a mirror, and what a
     mirror needs above it is edges. */

  /* The far lip. Barely thicker than a line, and that is the point: it says
     the water goes to a definite end an enormous distance away, which is
     exactly the sentence a flat calm makes and no promontory ever could. */
  ART.glassshelf = function (g, l, p, P, L) {
    const w = unit(p, L) * 1.60 * l.scale;
    const hy = L.horizonY;
    const h = Math.max(1.2, p.scale * L.h * 0.012 * l.scale);
    g.save();
    /* Two bands: the shelf, and the sliver of its own reflection under it.
       Nothing else in the game reflects into the water in 2D, and here it is
       one rectangle, because the surface is glass and the shape is a line. */
    g.fillStyle = tone(P, l, p, 0.62);
    g.fillRect(p.x - w, hy - h, w * 2, h + 1);
    g.globalAlpha = 0.34;
    g.fillRect(p.x - w, hy + 1, w * 2, h * 0.8);
    /* Where it is broken. One gap, in a different place every world, and the
       only feature the horizon of this zone has. */
    const gx = p.x + (G.hash1(Math.round(l.u * 500), 61) - 0.5) * w * 1.2;
    const gw = w * 0.06;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(gx - gw, hy - h - 1, gw * 2, h + 3);
    g.restore();
  };

  /* A formation. Right angles, out of water that has no business making one.

     Built as a prism seen from an angle rather than as a rectangle: three
     faces, and the tone steps between them, because a flat fill at this size
     reads as a hole in the picture rather than as a solid. */
  ART.prism = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.055 * l.scale;
    const h = p.scale * L.h * (0.10 + G.hash1(Math.round(l.u * 900), 83) * 0.09) * l.scale;
    const x = p.x, y = p.y;
    const lean = (G.hash1(Math.round(l.u * 640), 19) - 0.5) * 0.22;
    const face = w * (0.34 + G.hash1(Math.round(l.u * 311), 7) * 0.3);

    g.save();
    // the near face
    g.beginPath();
    g.moveTo(x - w, y);
    g.lineTo(x - w + lean * h, y - h);
    g.lineTo(x + face + lean * h, y - h);
    g.lineTo(x + face, y);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.90);
    g.fill();
    // the side, one step darker, which is the whole of the solidity
    g.beginPath();
    g.moveTo(x + face, y);
    g.lineTo(x + face + lean * h, y - h);
    g.lineTo(x + w + lean * h, y - h * 0.94);
    g.lineTo(x + w, y - h * 0.02);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.99);
    g.fill();
    // and the top edge catching the sky, which is the only lit thing here
    g.strokeStyle = lit(P, p, 0.30);
    g.lineWidth = Math.max(1, w * 0.06);
    g.beginPath();
    g.moveTo(x - w + lean * h, y - h);
    g.lineTo(x + w + lean * h, y - h * 0.94);
    g.stroke();
    g.restore();
  };

  /* The channel. A line of stakes marking the only water across this zone
     with anything under it — which is not decoration: js/systems/boat.js
     grounds a deep hull in shallow water, and this is where a player can see
     that coming instead of reading about it afterwards.

     The stakes recede along the line rather than standing in a row across the
     frame, so the thing it draws is a DIRECTION. */
  ART.channel = function (g, l, p, P, L) {
    const n = 7;
    const run = unit(p, L) * 0.55 * l.scale;
    const bend = (G.hash1(Math.round(l.u * 210), 43) - 0.5) * 0.7;
    g.save();
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      /* Away from the viewer as it goes: each stake is further off, so it is
         smaller and hazier than the one before it. */
      const dd = U.clamp(l.d + k * 0.30, 0.05, 1.6);
      const sc = p.scale * (l.d / dd);
      const x = p.x + U.lerp(-run * 0.15, run, k) + bend * run * k * k;
      const y = U.lerp(p.y, L.horizonY + (p.y - L.horizonY) * 0.22, k);
      const h = sc * L.h * 0.030 * l.scale;
      g.fillStyle = tone(P, { d: dd }, p, 0.92);
      g.fillRect(x, y - h, Math.max(1, sc * L.h * 0.004), h);
      if (i % 2 === 0) {
        g.fillStyle = lit(P, p, 0.28 * (1 - k * 0.6));
        g.beginPath();
        g.arc(x, y - h, Math.max(0.8, sc * L.h * 0.005), 0, TAU);
        g.fill();
      }
    }
    g.restore();
  };

  /* Somebody who did not follow it. A hull sitting flat on the bottom in a
     foot of water, upright, undamaged and completely stuck — which is a
     different and worse picture than a wreck. */
  ART.aground = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.075 * l.scale;
    const y = p.y;
    const list = (G.hash1(Math.round(l.u * 880), 23) - 0.5) * 0.34;
    g.save();
    g.translate(p.x, y);
    g.rotate(list);
    g.fillStyle = tone(P, l, p, 0.94);
    g.beginPath();
    g.moveTo(-w, 0);
    g.quadraticCurveTo(-w * 0.75, -w * 0.44, w * 0.10, -w * 0.40);
    g.lineTo(w, -w * 0.24);
    g.quadraticCurveTo(w * 0.5, 0, -w, 0);
    g.closePath();
    g.fill();
    // the mast, still up, which is what makes it aground rather than sunk
    g.fillRect(-w * 0.06, -w * 1.5, Math.max(1, w * 0.05), w * 1.14);
    g.restore();
  };

  /* A rectangle standing in the water with nothing in it. Square-on from one
     bearing and edge-on from every other, so most of the time it is a line
     and you would never look twice. */
  ART.doorframe = function (g, l, p, P, L) {
    const face = 1 - U.clamp(Math.abs(l.u) * 1.6, 0, 1);   // how square-on it is
    const w = unit(p, L) * 0.045 * l.scale * (0.06 + face * 0.94);
    const h = p.scale * L.h * 0.075 * l.scale;
    const t = Math.max(1, h * 0.055);
    g.save();
    g.fillStyle = tone(P, l, p, 0.55);
    g.fillRect(p.x - w, p.y - h, t, h);
    g.fillRect(p.x + w - t, p.y - h, t, h);
    g.fillRect(p.x - w, p.y - h, w * 2, t);
    /* What is inside it is not what is behind it. Only visible square-on,
       which is the only reason anybody would notice at all. */
    if (face > 0.35) {
      g.globalAlpha = 0.16 * (face - 0.35) / 0.65;
      g.fillStyle = U.rgbToCss(P.glow, 1);
      g.fillRect(p.x - w + t, p.y - h + t, w * 2 - t * 2, h - t);
    }
    g.restore();
  };

  /* -------------------------------------------------------- the abyss

     A CAVERN, so what shapes the place is the space rather than the things in
     it. Everything here grows: the wall has crystal coming out of the foot of
     it, the spires are what that becomes given somewhere to start, and the
     crust is the same material earlier. One material, three ages. */

  ART.cavernwall = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.85 * l.scale;
    const hy = L.horizonY;
    const top = -L.h * 0.05;
    const x = p.x;

    const pts = [];
    const n = 22;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      /* Angular rather than eroded: the profile is built from a ridged noise
         with the smoothing turned down, so the outline is facets. */
      const facet = (G.ridged(k * 4.2 + l.u * 4, 6607, 3) - 0.42);
      const belly = Math.sin(k * Math.PI) * 0.5 + 0.5;
      pts.push({ x: x + U.lerp(-w, w, k) + facet * w * 0.10,
                 y: hy + 2 - (L.h * 0.16 + facet * L.h * 0.09) * belly * l.scale * p.scale });
    }
    g.save();
    g.beginPath();
    g.moveTo(x - w, hy + 2);
    G.path(g, pts, false);
    g.lineTo(x + w, hy + 2);
    g.closePath();
    const grad = g.createLinearGradient(0, hy - L.h * 0.22, 0, hy);
    grad.addColorStop(0, tone(P, l, p, 0.74));
    grad.addColorStop(1, tone(P, l, p, 0.94));
    g.fillStyle = grad;
    g.fill();
    g.restore();

    /* And what is growing out of the foot of it. Small, many, and lit — the
       wall is the dark and this is the only reason you can see where it ends. */
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) {
      const k = (i + 0.5) / 14;
      const gx = x + U.lerp(-w * 0.9, w * 0.9, k);
      const gh = p.scale * L.h * 0.012 * (0.5 + G.hash1(i + Math.round(l.u * 90), 11));
      g.fillStyle = lit(P, p, 0.10 + G.hash1(i, 3) * 0.12);
      g.beginPath();
      g.moveTo(gx, hy + 1);
      g.lineTo(gx - gh * 0.18, hy + 1 - gh);
      g.lineTo(gx + gh * 0.22, hy + 1 - gh * 0.8);
      g.closePath();
      g.fill();
    }
    g.restore();
  };

  /* A spire. The navigation of this zone — you steer by the formations
     because there is nothing else down here to steer by, so each one has to
     be a shape you could describe to somebody. */
  ART.crystalspire = function (g, l, p, P, L) {
    const h = p.scale * L.h * (0.16 + G.hash1(Math.round(l.u * 700), 31) * 0.16) * l.scale;
    const w = Math.max(2, h * 0.13);
    const x = p.x, y = p.y;
    const lean = (G.hash1(Math.round(l.u * 410), 17) - 0.5) * w * 3.0;
    const facets = 3 + Math.floor(G.hash1(Math.round(l.u * 130), 5) * 3);

    g.save();
    /* Built as a fan of long thin triangles from one base, which is how the
       real thing grows and is also the only construction that does not read
       as a cone. */
    for (let i = 0; i < facets; i++) {
      const k = (i + 0.5) / facets;
      const tipx = x + lean + U.lerp(-w * 0.9, w * 0.9, k) * 0.7;
      const tiph = h * (0.55 + G.hash1(i + Math.round(l.u * 55), 13) * 0.62);
      g.beginPath();
      g.moveTo(x + U.lerp(-w, w, k) - w * 0.35, y);
      g.lineTo(tipx, y - tiph);
      g.lineTo(x + U.lerp(-w, w, k) + w * 0.35, y);
      g.closePath();
      g.fillStyle = tone(P, l, p, 0.86 + (i % 2) * 0.10);
      g.fill();
    }
    /* Lit from inside rather than from outside. */
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(x, y, x + lean, y - h);
    gr.addColorStop(0, lit(P, p, 0.02));
    gr.addColorStop(1, lit(P, p, 0.22));
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - w * 0.5, y);
    g.lineTo(x + lean, y - h);
    g.lineTo(x + w * 0.5, y);
    g.closePath();
    g.fill();
    g.restore();
  };

  /* An opening in the wall with more cavern behind it. The one thing in the
     zone that says this is a chamber of something rather than a room, and
     nothing in the game ever goes through it. */
  ART.mouth = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.12 * l.scale;
    const h = p.scale * L.h * 0.10 * l.scale;
    const y = p.y;
    g.save();
    /* Darker than the wall it is in, and it fades UPWARD into nothing rather
       than having a top edge — an opening with a lintel is a door. */
    const grad = g.createLinearGradient(0, y - h, 0, y);
    grad.addColorStop(0, U.rgbToCss(P.fog, 0));
    grad.addColorStop(1, tone(P, l, p, 1.0));
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(p.x - w, y + 1);
    g.quadraticCurveTo(p.x - w * 0.82, y - h, p.x, y - h);
    g.quadraticCurveTo(p.x + w * 0.82, y - h, p.x + w, y + 1);
    g.closePath();
    g.fill();
    g.restore();
  };

  /* The same material, earlier: a low mass of it on the water, not yet a
     spire. Three ages of one substance is what makes a place look grown
     rather than decorated. */
  ART.crust = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.06 * l.scale;
    const y = p.y;
    g.save();
    g.fillStyle = tone(P, l, p, 0.93);
    g.beginPath();
    g.moveTo(p.x - w, y + 1);
    for (let i = 1; i < 7; i++) {
      const k = i / 7;
      const up = (0.25 + G.hash1(i + Math.round(l.u * 70), 9) * 0.75) * w * 0.55;
      g.lineTo(p.x + U.lerp(-w, w, k), y + 1 - up);
    }
    g.lineTo(p.x + w, y + 1);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lit(P, p, 0.07);
    g.fill();
    g.restore();
  };

  /* Light coming out of somewhere a long way into the rock. Never a source,
     only the light — and it moves, slowly, which is the part that matters. */
  ART.heartlight = function (g, l, p, P, L) {
    const r = Math.max(3, p.scale * L.h * 0.045 * l.scale);
    const t = VF.state.rt.t;
    const puls = 0.55 + Math.sin(t * 0.31 + l.u * 3) * 0.45;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(p.x, p.y - r * 0.3, 0, p.x, p.y - r * 0.3, r);
    gr.addColorStop(0, lit(P, p, 0.16 * puls));
    gr.addColorStop(1, lit(P, p, 0));
    g.fillStyle = gr;
    g.fillRect(p.x - r, p.y - r * 1.3, r * 2, r * 2);
    g.restore();
  };

  /* Micro, shared: a piece of the material, and a marker somebody left. */
  ART.shard = function (g, l, p, P, L) {
    const h = Math.max(1.5, p.scale * L.h * 0.016 * l.scale);
    const w = Math.max(1, h * 0.30);
    const lean = (G.hash1(Math.round(l.u * 1900), 41) - 0.5) * w * 2.4;
    g.beginPath();
    g.moveTo(p.x - w, p.y);
    g.lineTo(p.x + lean, p.y - h);
    g.lineTo(p.x + w, p.y);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.92);
    g.fill();
  };

  ART.marker = function (g, l, p, P, L) {
    const h = Math.max(2, p.scale * L.h * 0.022 * l.scale);
    g.fillStyle = tone(P, l, p, 0.90);
    g.fillRect(p.x, p.y - h, Math.max(1, h * 0.10), h);
    g.fillStyle = lit(P, p, 0.22);
    g.beginPath();
    g.arc(p.x, p.y - h, Math.max(0.8, h * 0.13), 0, TAU);
    g.fill();
  };

  /* ------------------------------------------------------- the cradle

     BUILT, which is the one thing none of the other eight are. So: no
     erosion, no scatter, no noise in any outline. Everything is an arc or a
     right angle, everything shares a centre, and the wear is structural
     failure — a missing panel, a sheared edge — rather than weather. */

  /* Where the ring comes down and goes into the water. The fact the zone is
     named for, drawn instead of described.

     It is an arc rather than a tower: the curvature is what says how big the
     whole thing is, because a straight column of that size is just a wall and
     tells you nothing about what it is part of. */
  ART.ringfoot = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.50 * l.scale;
    const hy = L.horizonY;
    const h = L.h * 0.90 * p.scale * l.scale;
    const x = p.x;
    const sea = l.u < 0 ? 1 : -1;
    const top = Math.max(-L.h * 0.10, hy - h);
    /* The radius of the ring, in this frame's pixels. Enormous on purpose. */
    const R = w * 9.0;

    g.save();
    g.beginPath();
    /* Two concentric arcs and the ends joined: a section of a ring seen
       nearly edge-on, entering the water. */
    const cx = x + sea * R * 0.86, cy = hy - R * 0.30;
    const a0 = Math.PI * (sea > 0 ? 0.86 : 0.14);
    const a1 = Math.PI * (sea > 0 ? 1.10 : -0.10);
    g.arc(cx, cy, R, a0, a1, sea < 0);
    g.arc(cx, cy, R - w * 0.9, a1, a0, sea > 0);
    g.closePath();
    const grad = g.createLinearGradient(0, top, 0, hy);
    grad.addColorStop(0, tone(P, l, p, 0.72));
    grad.addColorStop(1, tone(P, l, p, 0.96));
    g.fillStyle = grad;
    g.fill();

    /* Plating. Straight lines across a curved body, which is how a thing this
       size is actually made and is the whole reason it reads as built. */
    g.clip();
    g.strokeStyle = U.rgbToCss(P.glow, 0.055 * p.contrast);
    g.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const a = U.lerp(a0, a1, (i + 0.5) / 16);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      g.lineTo(cx + Math.cos(a) * (R - w), cy + Math.sin(a) * (R - w));
      g.stroke();
    }
    /* One panel gone, and the dark behind it. */
    const ga = U.lerp(a0, a1, 0.36);
    g.fillStyle = tone(P, l, p, 1.0);
    g.beginPath();
    g.arc(cx, cy, R - w * 0.10, ga, ga + 0.020, false);
    g.arc(cx, cy, R - w * 0.80, ga + 0.020, ga, true);
    g.closePath();
    g.fill();
    g.restore();
  };

  /* The same curve at a smaller radius, standing in the water. Two of these
     plus the foot is what gives the ring its real size — one enormous shape
     has no scale, and three related ones do. */
  ART.pylon = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.030 * l.scale;
    const h = p.scale * L.h * 0.26 * l.scale;
    const x = p.x, y = p.y;
    const lean = (G.hash1(Math.round(l.u * 400), 27) - 0.5) * 0.22;
    g.save();
    g.translate(x, y);
    g.rotate(lean);
    g.fillStyle = tone(P, l, p, 0.92);
    /* A tapered box, and a collar two thirds up where something attached. */
    g.beginPath();
    g.moveTo(-w, 0);
    g.lineTo(-w * 0.52, -h);
    g.lineTo(w * 0.52, -h);
    g.lineTo(w, 0);
    g.closePath();
    g.fill();
    g.fillRect(-w * 0.95, -h * 0.66, w * 1.9, Math.max(1, h * 0.035));
    /* A light on it, and it is on. Nothing here should be lit by the sky. */
    g.fillStyle = lit(P, p, 0.42);
    g.beginPath();
    g.arc(0, -h * 0.94, Math.max(0.9, w * 0.22), 0, TAU);
    g.fill();
    g.restore();
  };

  /* Steps into the water, continuing under it. The human scale of the zone:
     something the size of a district needs one thing on it a person could
     walk up, or it has no size at all. */
  ART.stair = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.070 * l.scale;
    const y = p.y;
    const rise = Math.max(1, p.scale * L.h * 0.008 * l.scale);
    g.save();
    g.fillStyle = tone(P, l, p, 0.90);
    for (let i = 0; i < 7; i++) {
      const ww = w * (1 - i * 0.055);
      g.fillRect(p.x - ww, y - rise * (i + 1), ww * 2, rise);
    }
    /* And the two below the line, which is the part that matters. */
    g.globalAlpha = 0.34;
    for (let i = 0; i < 2; i++) {
      const ww = w * (1 + i * 0.05);
      g.fillRect(p.x - ww, y + rise * i, ww * 2, rise);
    }
    g.restore();
  };

  /* A plinth with nothing on it. There is no version of this game where the
     player finds out what stood here. */
  ART.plinth = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.030 * l.scale;
    const h = p.scale * L.h * 0.030 * l.scale;
    g.save();
    g.fillStyle = tone(P, l, p, 0.93);
    g.fillRect(p.x - w, p.y - h, w * 2, h);
    g.fillRect(p.x - w * 1.25, p.y - h - Math.max(1, h * 0.10), w * 2.5, Math.max(1, h * 0.10));
    g.restore();
  };

  ART.rubble = function (g, l, p, P, L) {
    const s2 = Math.max(1.2, p.scale * L.h * 0.010 * l.scale);
    const a = G.hash1(Math.round(l.u * 2100), 47) * TAU;
    g.save();
    g.translate(p.x, p.y - s2 * 0.4);
    g.rotate(a);
    g.fillStyle = tone(P, l, p, 0.95);
    g.fillRect(-s2, -s2 * 0.42, s2 * 2, s2 * 0.84);
    g.restore();
  };

  /* A mark cut into something. Never legible, at any distance — the closest
     it ever gets is three strokes and a curve. */
  ART.glyph = function (g, l, p, P, L) {
    const s2 = Math.max(1.5, p.scale * L.h * 0.013 * l.scale);
    g.save();
    g.strokeStyle = lit(P, p, 0.16);
    g.lineWidth = Math.max(1, s2 * 0.14);
    g.beginPath();
    g.moveTo(p.x - s2 * 0.5, p.y);
    g.lineTo(p.x - s2 * 0.5, p.y - s2);
    g.moveTo(p.x - s2 * 0.5, p.y - s2 * 0.5);
    g.lineTo(p.x + s2 * 0.3, p.y - s2 * 0.5);
    g.moveTo(p.x + s2 * 0.5, p.y - s2 * 0.9);
    g.quadraticCurveTo(p.x + s2 * 0.9, p.y - s2 * 0.4, p.x + s2 * 0.4, p.y);
    g.stroke();
    g.restore();
  };

  /* A door in a structure with no building attached to it. */
  ART.doorway = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.020 * l.scale;
    const h = p.scale * L.h * 0.052 * l.scale;
    g.save();
    g.fillStyle = tone(P, l, p, 1.0);
    g.beginPath();
    g.moveTo(p.x - w, p.y);
    g.lineTo(p.x - w, p.y - h * 0.72);
    g.quadraticCurveTo(p.x, p.y - h, p.x + w, p.y - h * 0.72);
    g.lineTo(p.x + w, p.y);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lit(P, p, 0.10);
    g.fillRect(p.x - w, p.y - h * 0.08, w * 2, Math.max(1, h * 0.03));
    g.restore();
  };

  /* ------------------------------------------------------ the nowhere sea

     LANDMARKS YOU CANNOT USE. Harder to build than landmarks you can: a place
     is disorienting because the cues are WRONG, not because they are missing.
     An empty frame is restful, and this zone was an empty frame. */

  /* A mass at the horizon that is nearly land. The profile is right and the
     value is right and the one thing wrong with it is that it has no base —
     it does not meet the water, it stops just above it. */
  ART.falseland = function (g, l, p, P, L) {
    const w = unit(p, L) * 1.05 * l.scale;
    const hy = L.horizonY;
    const h = p.scale * L.h * 0.10 * l.scale;
    const pts = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const prof = Math.pow(Math.sin(k * Math.PI), 0.7);
      const rough = G.fbm(k * 3.6 + l.u * 5, 9001, 4, 0.55);
      pts.push({ x: p.x + U.lerp(-w, w, k), y: hy - h * prof * (0.4 + rough) });
    }
    const lift = h * 0.16;                     // the gap under it
    g.save();
    g.beginPath();
    g.moveTo(p.x - w, hy - lift);
    G.path(g, pts, false);
    g.lineTo(p.x + w, hy - lift);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.72);
    g.fill();
    g.restore();
  };

  /* The tell.

     THREE OF THESE ARE PLACED AND THEY ARE THE SAME OBJECT. Nothing in this
     drawing varies with `u` — no hash, no jitter, no per-instance anything —
     so the only difference between the three is how far away they are. A
     player who never notices loses nothing. A player who notices has found
     out something about where they are that no line of dialogue could
     deliver, and there is no line of dialogue about it. */
  ART.echo = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.045 * l.scale;
    const h = p.scale * L.h * 0.075 * l.scale;
    const x = p.x, y = p.y;
    g.save();
    g.fillStyle = tone(P, l, p, 0.94);
    g.beginPath();
    g.moveTo(x - w, y);
    g.lineTo(x - w * 0.62, y - h * 0.55);
    g.lineTo(x - w * 0.20, y - h * 0.42);
    g.lineTo(x + w * 0.12, y - h);
    g.lineTo(x + w * 0.55, y - h * 0.30);
    g.lineTo(x + w, y);
    g.closePath();
    g.fill();
    g.fillStyle = lit(P, p, 0.20);
    g.beginPath();
    g.arc(x + w * 0.12, y - h, Math.max(0.9, w * 0.10), 0, TAU);
    g.fill();
    g.restore();
  };

  /* A piece of the picture with nothing in it. Not black — black is a colour
     and would read as an object. This takes what is already there away, so
     what is behind it is the far side of the frame. */
  ART.absence = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.055 * l.scale;
    const h = p.scale * L.h * 0.055 * l.scale;
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.62;
    g.beginPath();
    g.ellipse(p.x, p.y - h * 0.4, w, h * 0.7, 0, 0, TAU);
    g.fill();
    g.restore();
  };

  ART.driftmark = function (g, l, p, P, L) {
    const w = Math.max(1.5, p.scale * L.h * 0.014 * l.scale);
    g.save();
    g.strokeStyle = tone(P, l, p, 0.88);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p.x - w, p.y);
    g.lineTo(p.x + w, p.y);
    g.stroke();
    g.restore();
  };

  /* A light out there, and it is going the other way. */
  ART.otherlight = function (g, l, p, P, L) {
    const r = Math.max(1.4, p.scale * L.h * 0.007 * l.scale);
    const t = VF.state.rt.t;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const a = 0.30 + Math.sin(t * 0.17) * 0.24;
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 7);
    gr.addColorStop(0, lit(P, p, a));
    gr.addColorStop(1, lit(P, p, 0));
    g.fillStyle = gr;
    g.fillRect(p.x - r * 7, p.y - r * 7, r * 14, r * 14);
    g.restore();
  };

  /* --------------------------------------------------------- beneath

     Four things in the whole frame. Everywhere else restraint is a
     preference; here `empty: 0.78` makes it the zone. Nothing stands ON the
     water because there is nothing for it to stand on. */

  /* Something enormous above and behind. Every other zone in this game has an
     empty sky; this one has a ceiling coming down into the back of the frame,
     and that alone is most of why being here is wrong. */
  ART.overhang = function (g, l, p, P, L) {
    const w = unit(p, L) * 1.20 * l.scale;
    const hy = L.horizonY;
    const drop = L.h * 0.42 * p.scale * l.scale;
    const pts = [];
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      const prof = Math.pow(Math.sin(k * Math.PI), 0.9);
      const rough = (G.fbm(k * 2.8 + l.u * 4, 3301, 3, 0.5) - 0.5) * 0.5;
      pts.push({ x: p.x + U.lerp(-w, w, k), y: -2 + drop * prof * (1 + rough) });
    }
    g.save();
    g.beginPath();
    g.moveTo(p.x - w, -4);
    G.path(g, pts, false);
    g.lineTo(p.x + w, -4);
    g.closePath();
    const grad = g.createLinearGradient(0, 0, 0, drop);
    grad.addColorStop(0, tone(P, l, p, 0.98));
    grad.addColorStop(1, tone(P, l, p, 0.80));
    g.fillStyle = grad;
    g.fill();
    g.restore();
  };

  /* A column through the water. Up out of sight and down out of sight, past
     both edges of what can be seen — the only shape that says "you are
     somewhere in the middle of something much larger" without writing it
     down. It does not have a top and it does not have a bottom. */
  ART.column = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.028 * l.scale;
    g.save();
    /* Above the line: full value, running off the top of the frame. */
    g.fillStyle = tone(P, l, p, 0.96);
    g.fillRect(p.x - w, -4, w * 2, p.y + 4);
    /* Below it: the same column, dimmer and slightly wider, because it is
       being seen through water. Continuing, not ending. */
    g.globalAlpha = 0.42;
    g.fillRect(p.x - w * 1.15, p.y, w * 2.3, L.h - p.y + 4);
    g.restore();
  };

  ART.mote = function (g, l, p, P, L) {
    const r = Math.max(0.8, p.scale * L.h * 0.004 * l.scale);
    const t = VF.state.rt.t;
    g.save();
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = lit(P, p, 0.18 + Math.sin(t * 0.7 + l.u * 9) * 0.10);
    g.beginPath();
    g.arc(p.x, p.y - Math.sin(t * 0.25 + l.u * 5) * r * 4, r, 0, TAU);
    g.fill();
    g.restore();
  };

  /* It is looking at you and it is the size of the zone. Drawn as an aperture
     rather than as an eye: a ring of light with a dark middle, because the
     moment it has a lid and a lash it is a monster, and this is not one. */
  ART.pupil = function (g, l, p, P, L) {
    const r = Math.max(6, p.scale * L.h * 0.13 * l.scale);
    const t = VF.state.rt.t;
    const open = 0.55 + Math.sin(t * 0.09) * 0.32;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(p.x, p.y, r * open * 0.55, p.x, p.y, r);
    gr.addColorStop(0, lit(P, p, 0));
    gr.addColorStop(0.72, lit(P, p, 0.13));
    gr.addColorStop(1, lit(P, p, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(p.x, p.y, r, 0, TAU);
    g.fill();
    g.restore();
  };

  /* --------------------------------------------------------- the heavens

     The one place where the geography is VERTICAL. Everywhere else the
     interesting axis runs away toward a horizon; here it runs up and down,
     because the water is a sheet lying on top of the weather and the only
     question about anything is which side of the sheet it is on. Nothing here
     is rock and nothing has a foot on the bottom. */

  /* A storm, from above. It is coming UP through the surface being fished on,
     which is a sentence nothing else in the game can say. */
  ART.thunderhead = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.42 * l.scale;
    const h = L.h * 0.62 * p.scale * l.scale;
    const x = p.x, base = p.y;
    g.save();
    /* Built out of stacked lobes rather than one outline: a cumulus tower is
       a pile of separate boils and drawing it as a silhouette makes a tree. */
    for (let i = 0; i < 9; i++) {
      const k = i / 8;
      const cy = base - h * Math.pow(k, 0.85);
      const cw = w * (1.0 - k * 0.55) * (0.55 + G.hash1(i + Math.round(l.u * 30), 71) * 0.6);
      const cx = x + (G.hash1(i, 13) - 0.5) * w * 0.5 * k;
      const grad = g.createRadialGradient(cx, cy - cw * 0.2, 0, cx, cy, cw);
      grad.addColorStop(0, tone(P, l, p, 0.28));
      grad.addColorStop(1, tone(P, l, p, 0.62));
      g.fillStyle = grad;
      g.beginPath();
      g.ellipse(cx, cy, cw, cw * 0.72, 0, 0, TAU);
      g.fill();
    }
    /* And the flat top where it hit the ceiling and spread — the anvil, which
       is the only part that tells you how high this actually is. */
    g.fillStyle = tone(P, l, p, 0.34);
    g.beginPath();
    g.ellipse(x, base - h, w * 1.5, h * 0.045, 0, 0, TAU);
    g.fill();
    g.restore();
  };

  /* A piece of ground with nothing under it. */
  ART.driftisle = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.075 * l.scale;
    const y = p.y;
    const h = w * 0.55;
    g.save();
    g.fillStyle = tone(P, l, p, 0.88);
    g.beginPath();
    g.moveTo(p.x - w, y - h * 0.2);
    for (let i = 1; i < 7; i++) {
      const k = i / 7;
      const up = Math.sin(k * Math.PI) * h * (0.5 + G.hash1(i + Math.round(l.u * 80), 23) * 0.7);
      g.lineTo(p.x + U.lerp(-w, w, k), y - h * 0.2 - up);
    }
    g.lineTo(p.x + w, y - h * 0.2);
    /* the underside: a keel of rock coming to a point, which is what makes it
       float rather than sit */
    g.lineTo(p.x + w * 0.18, y + h * 1.1);
    g.closePath();
    g.fill();
    g.restore();
  };

  /* A hole in the floor, with the world a very long way down through it. The
     only place in the zone where distance is legible at all. */
  ART.sunwell = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.085 * l.scale;
    const h = w * 0.34;
    g.save();
    /* The hole first: the surface taken away. */
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.ellipse(p.x, p.y, w, h, 0, 0, TAU);
    g.fill();
    /* Then what is down it — dark, and small, and a very long way off. */
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.55;
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, w);
    gr.addColorStop(0, U.rgbToCss(P.skyZen || P.fog, 1));
    gr.addColorStop(1, U.rgbToCss(P.fog, 0));
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(p.x, p.y, w, h, 0, 0, TAU);
    g.fill();
    /* And the lip, catching the light from up here. */
    g.globalAlpha = 1;
    g.strokeStyle = lit(P, p, 0.22);
    g.lineWidth = Math.max(1, w * 0.03);
    g.beginPath();
    g.ellipse(p.x, p.y, w, h, 0, 0, TAU);
    g.stroke();
    g.restore();
  };

  ART.feather = function (g, l, p, P, L) {
    const w = Math.max(1.5, p.scale * L.h * 0.012 * l.scale);
    const t = VF.state.rt.t;
    g.save();
    g.globalAlpha = 0.5;
    g.strokeStyle = lit(P, p, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(p.x - w, p.y + Math.sin(t * 0.3 + l.u * 7) * w * 0.3);
    g.quadraticCurveTo(p.x, p.y - w * 0.4, p.x + w, p.y);
    g.stroke();
    g.restore();
  };

  /* Something going up, out of the top of the frame, with no bottom to it. */
  ART.ascent = function (g, l, p, P, L) {
    const w = Math.max(1.5, unit(p, L) * 0.010 * l.scale);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(0, -4, 0, p.y);
    gr.addColorStop(0, lit(P, p, 0));
    gr.addColorStop(0.55, lit(P, p, 0.10));
    gr.addColorStop(1, lit(P, p, 0.02));
    g.fillStyle = gr;
    g.fillRect(p.x - w, -4, w * 2, p.y + 4);
    g.restore();
  };

  ART.trenchwall = function (g, l, p, P, L) {
    const w = unit(p, L) * 0.55 * l.scale;
    const hy = L.horizonY;
    const top = -L.h * 0.06;
    const x = p.x;
    const sea = l.u < 0 ? 1 : -1;
    const off = x - sea * w * 2.6;

    /* Ridged noise rather than smooth: a trench wall is fractured, and the
       creases are the only thing at this contrast that says rock rather than
       cloud. */
    const pts = [];
    for (let i = 0; i <= 13; i++) {
      const k = i / 13;
      const y = U.lerp(top, hy + 2, k);
      const crease = (G.ridged(k * 5.5 + l.u * 3, 8801, 4) - 0.45) * w * 0.44;
      pts.push({ x: x + sea * (w * 0.18 + crease), y: y });
    }

    g.save();
    g.beginPath();
    g.moveTo(off, top - 20);
    g.lineTo(pts[0].x, top - 20);
    G.path(g, pts, false);
    g.lineTo(off, hy + 2);
    g.closePath();
    const grad = g.createLinearGradient(0, top, 0, hy);
    grad.addColorStop(0, tone(P, l, p, 0.66));
    grad.addColorStop(1, tone(P, l, p, 0.96));
    g.fillStyle = grad;
    g.fill();

    /* Long descending lines down the face. Not strata — this is a wall that
       goes down, and what the eye needs is verticals. */
    g.clip();
    g.strokeStyle = U.rgbToCss(P.glow, 0.05 * p.contrast);
    g.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const fx = U.lerp(off, x + sea * w * 0.2, (i + 0.5) / 9);
      g.beginPath();
      g.moveTo(fx + w * 0.04, top);
      g.lineTo(fx - w * 0.04, hy);
      g.stroke();
    }
    g.restore();
  };

  /* A pinnacle: tall, narrow, standing off the wall. These are the zone's
     scale references — a thing you can see the top and bottom of, next to a
     thing you cannot. */
  ART.pinnacle = function (g, l, p, P, L) {
    const h = p.scale * L.h * 0.30 * l.scale;
    const w = Math.max(2, h * 0.085);
    const x = p.x, y = p.y;
    const lean = (G.hash1(Math.round(l.u * 800), 13) - 0.5) * w * 2.2;
    g.beginPath();
    g.moveTo(x - w, y);
    g.quadraticCurveTo(x - w * 0.5 + lean * 0.4, y - h * 0.55, x + lean, y - h);
    g.quadraticCurveTo(x + w * 0.55 + lean * 0.4, y - h * 0.5, x + w, y);
    g.closePath();
    g.fillStyle = tone(P, l, p, 0.94);
    g.fill();
    /* One light on it, most of the way up. It is the only thing in this zone
       that is ever lit, and it does not move. */
    if (G.hash1(Math.round(l.d * 900), 7) > 0.45) {
      const ly = y - h * 0.78;
      g.fillStyle = lit(P, p, 0.55);
      g.beginPath();
      g.arc(x + lean * 0.78, ly, Math.max(0.9, w * 0.16), 0, TAU);
      g.fill();
    }
  };

  /* A cable going over the side and down. What is on the end of it is not
     drawn, because it is eleven hundred metres away. */
  ART.cablehead = function (g, l, p, P, L) {
    const s = p.scale * L.h * 0.035 * l.scale;
    const x = p.x, y = p.y;
    g.save();
    g.strokeStyle = tone(P, l, p, 0.92);
    g.lineWidth = Math.max(1, s * 0.10);
    // the frame it runs over
    g.beginPath();
    g.moveTo(x - s * 0.7, y);
    g.lineTo(x - s * 0.5, y - s * 0.9);
    g.lineTo(x + s * 0.5, y - s * 0.9);
    g.lineTo(x + s * 0.7, y);
    g.stroke();
    // and the cable, going down into water rather than stopping at it
    g.beginPath();
    g.moveTo(x, y - s * 0.86);
    g.quadraticCurveTo(x + s * 0.25, y + s * 0.4, x + s * 0.1, y + s * 1.5);
    g.stroke();
    g.restore();
  };

  /* An observation station on legs. Nobody is on it. The only detail it gets
     is the one that says so: a door left open. */
  ART.station = function (g, l, p, P, L) {
    const s = p.scale * L.h * 0.045 * l.scale;
    const x = p.x, y = p.y;
    g.save();
    g.fillStyle = tone(P, l, p, 0.93);
    // legs, into the water
    const lw = Math.max(1, s * 0.07);
    [-0.62, -0.2, 0.2, 0.62].forEach(function (k) {
      g.fillRect(x + s * k - lw * 0.5, y - s * 0.55, lw, s * 0.75);
    });
    // the box
    g.fillRect(x - s * 0.78, y - s * 1.16, s * 1.56, s * 0.62);
    // a rail along the top
    g.strokeStyle = tone(P, l, p, 0.88);
    g.lineWidth = Math.max(1, s * 0.05);
    g.beginPath();
    g.moveTo(x - s * 0.8, y - s * 1.16);
    g.lineTo(x + s * 0.8, y - s * 1.16);
    g.stroke();
    // the door, open, and nothing behind it
    g.fillStyle = 'rgba(0,0,0,0.85)';
    g.fillRect(x + s * 0.18, y - s * 1.10, s * 0.22, s * 0.48);
    g.restore();
  };

  /* Bioluminescence: a point of light that is not lighting anything. */
  ART.spark = function (g, l, p, P, L) {
    const r = Math.max(0.8, p.scale * L.h * 0.004 * l.scale);
    const tw = 0.45 + 0.55 * Math.sin(VF.state.rt.t * (0.6 + l.scale) + l.u * 9);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
    gr.addColorStop(0, lit(P, p, 0.55 * tw));
    gr.addColorStop(1, U.rgbToCss(P.glow, 0));
    g.fillStyle = gr;
    g.fillRect(p.x - r * 5, p.y - r * 5, r * 10, r * 10);
    g.restore();
  };

  ART.debris = function (g, l, p, P, L) {
    const s = Math.max(1.5, p.scale * L.h * 0.008 * l.scale);
    g.save();
    g.translate(p.x, p.y);
    g.rotate((G.hash1(Math.round(l.u * 610), 29) - 0.5) * 1.4);
    g.fillStyle = tone(P, l, p, 0.9);
    g.fillRect(-s, -s * 0.22, s * 2, s * 0.44);
    g.restore();
  };

  /* And the one out past the range of the set. A light, and nothing around it
     to say how big whatever is carrying it might be. */
  ART.farlight = function (g, l, p, P, L) {
    const r = Math.max(1.2, p.scale * L.h * 0.005 * l.scale);
    const slow = Math.sin(VF.state.rt.t * 0.13 + l.u * 3);
    const a = U.clamp(0.16 + slow * 0.16, 0, 0.36);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 9);
    gr.addColorStop(0, U.rgbToCss(P.glow, a));
    gr.addColorStop(1, U.rgbToCss(P.glow, 0));
    g.fillStyle = gr;
    g.fillRect(p.x - r * 9, p.y - r * 9, r * 18, r * 18);
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
    drawSeam(ctx, L, P);
    const list = w.all.filter(function (l) { return l.d < 1; });
    list.sort(function (a, b) { return b.d - a.d; });
    for (let i = 0; i < list.length; i++) drawOne(ctx, list[i], L, P, cam);
  }

  /* The seam, when the set is up.

     The trench's whole navigation problem is that the deep water is a narrow
     band and there is no way to see where it is. With a sonar there is: a
     sweep that fades, so the answer has to be remembered rather than read off
     a permanent marker. Without one, nothing is drawn and the zone is
     genuinely harder — which is what the module is for.

     It is drawn on the water in perspective, converging with everything else,
     because a band that ignored the projection would read as a HUD element
     laid over the sea rather than as a place in it. */
  function drawSeam(ctx, L, P) {
    const w = VF.landmarks.world();
    if (!w || w.seam === undefined) return;
    if (!VF.boat || !VF.boat.has('sonar')) return;
    const cam = VF.camera.get();
    const t = VF.state.rt.t;
    /* One sweep every eight seconds, bright for about one of them. */
    const ping = Math.pow(Math.max(0, Math.sin(t * 0.78)), 8);
    if (ping < 0.01) return;

    const level = VF.boat.level ? VF.boat.level('sonar') : 1;
    const a = (0.10 + level * 0.035) * ping;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const half = (i ? 0.30 : 0.14);
      ctx.beginPath();
      for (let d = 0.08; d <= 0.98; d += 0.06) {
        const sp = VF.space.uSpan(d) * half;
        const x = VF.space.xAt(w.seam - sp, d, cam);
        const y = VF.space.yAt(d);
        if (d < 0.09) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (let d = 0.98; d >= 0.08; d -= 0.06) {
        const sp = VF.space.uSpan(d) * half;
        ctx.lineTo(VF.space.xAt(w.seam + sp, d, cam), VF.space.yAt(d));
      }
      ctx.closePath();
      ctx.fillStyle = U.rgbToCss(P.glow, a * (i ? 0.35 : 1));
      ctx.fill();
    }
    ctx.restore();
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
