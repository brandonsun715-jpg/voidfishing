/* VOID FISHING — the eight.

   The last tier is not a rarer fish. It is eight things that are not fish at
   all, and none of them shares a line of drawing code with anything else in
   the game: js/render/fishArt.js knows about bodies and fins and builds every
   creature out of the same anatomy, which is exactly right for two hundred
   species and exactly wrong for a planet.

   So each of these is written on its own, from nothing, and they are drawn
   centred on the origin at a half-height of `size` the same way a fish is —
   that is the only thing they have in common with the rest of the catalogue.

   Two of them are meant to be too big for the frame. That is not a bug in the
   sizing: `fill` on the species says how much of the screen it takes, and the
   catch card and the scene both honour it, so the Earth genuinely does not fit
   and neither does the thing that comes up after it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  /* A deterministic stream per subject, so the same planet has the same
     continents forever. */
  function rnd(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Light with a body to it. Several passes, widest and faintest first. */
  function bloom(ctx, x, y, r, rgb, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const P = [[3.4, 0.07], [1.9, 0.13], [1.0, 0.26], [0.42, 0.7]];
    for (let i = 0; i < P.length; i++) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * P[i][0]);
      g.addColorStop(0, U.rgbToCss(rgb, P[i][1] * k));
      g.addColorStop(1, U.rgbToCss(rgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r * P[i][0], y - r * P[i][0], r * P[i][0] * 2, r * P[i][0] * 2);
    }
    ctx.restore();
  }

  /* A jagged arc of lightning from a to b, with forks. */
  function bolt(ctx, x0, y0, x1, y1, w, rgb, seed, forks) {
    const r = rnd(seed);
    const segs = 9;
    const pts = [[x0, y0]];
    for (let i = 1; i < segs; i++) {
      const u = i / segs;
      const dx = x1 - x0, dy = y1 - y0;
      const nx = -dy, ny = dx;
      const m = Math.hypot(nx, ny) || 1;
      const off = (r() - 0.5) * Math.hypot(dx, dy) * 0.16 * Math.sin(u * Math.PI);
      pts.push([x0 + dx * u + nx / m * off, y0 + dy * u + ny / m * off]);
    }
    pts.push([x1, y1]);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pass of [[w * 3.2, 0.13], [w * 1.7, 0.28], [w, 0.95]]) {
      ctx.strokeStyle = U.rgbToCss(pass[1] > 0.6 ? [255, 255, 255] : rgb, pass[1]);
      ctx.lineWidth = pass[0];
      ctx.beginPath();
      pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
      ctx.stroke();
    }
    if (forks) {
      for (let f = 0; f < forks; f++) {
        const at = 2 + Math.floor(r() * (segs - 3));
        const p = pts[at];
        const L = Math.hypot(x1 - x0, y1 - y0) * (0.16 + r() * 0.2);
        const a = Math.atan2(y1 - y0, x1 - x0) + (r() - 0.5) * 2.2;
        ctx.strokeStyle = U.rgbToCss(rgb, 0.55);
        ctx.lineWidth = w * 0.55;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0] + Math.cos(a) * L, p[1] + Math.sin(a) * L);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* One tentacle: a tapering curve with suckers down the near face. */
  function tentacle(ctx, x, y, len, w, ang, curl, t, phase, skin, dark, suckers) {
    const N = 16;
    const lhs = [], rhs = [];
    let px = x, py = y;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = ang + curl * u * u * 2.2 + Math.sin(t * 1.1 + phase + u * 3.4) * 0.14 * u;
      const step = len / N;
      px += Math.cos(a) * step;
      py += Math.sin(a) * step;
      const ww = w * (1 - u) * (1 - u * 0.35) * 0.5;
      lhs.push([px - Math.sin(a) * ww, py + Math.cos(a) * ww]);
      rhs.push([px + Math.sin(a) * ww, py - Math.cos(a) * ww]);
      if (suckers && i > 2 && i % 2 === 0) {
        suckers.push([px + Math.sin(a) * ww * 0.5, py - Math.cos(a) * ww * 0.5, ww * 0.34]);
      }
    }
    ctx.beginPath();
    ctx.moveTo(lhs[0][0], lhs[0][1]);
    lhs.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    for (let i = rhs.length - 1; i >= 0; i--) ctx.lineTo(rhs[i][0], rhs[i][1]);
    ctx.closePath();
    /* Across the tentacle, not down the frame. A vertical gradient is right
       for an arm that happens to lie sideways and catastrophically wrong for
       one that hangs straight down: everything past the base falls off the
       end of the ramp and comes out at the dark stop, which is how seven of
       these in a row turned into one black star on somebody's chest. */
    const nx = -Math.sin(ang) * w * 0.5, ny = Math.cos(ang) * w * 0.5;
    const g = ctx.createLinearGradient(x + nx, y + ny, x - nx, y - ny);
    g.addColorStop(0, U.rgbToCss(U.mixRgb(skin, [255, 255, 255], 0.30)));
    g.addColorStop(0.55, U.rgbToCss(skin));
    g.addColorStop(1, U.rgbToCss(dark));
    ctx.fillStyle = g;
    ctx.fill();
    /* and a hairline along one edge, so where two of them overlap there is
       still a line between them */
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(skin, [255, 255, 255], 0.42), 0.34);
    ctx.lineWidth = Math.max(0.35, w * 0.045);
    ctx.beginPath();
    ctx.moveTo(lhs[0][0], lhs[0][1]);
    lhs.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    ctx.stroke();
    return { x: px, y: py };
  }

  /* A robed or fleshed torso, used by the three that stand upright. */
  function torso(ctx, S, col, dark, lean) {
    ctx.beginPath();
    ctx.moveTo(-S * 0.30, -S * 0.34);
    ctx.quadraticCurveTo(-S * 0.46 + lean, S * 0.20, -S * 0.40, S * 0.86);
    ctx.lineTo(S * 0.40, S * 0.86);
    ctx.quadraticCurveTo(S * 0.46 + lean, S * 0.20, S * 0.30, -S * 0.34);
    ctx.closePath();
    const g = ctx.createLinearGradient(-S * 0.4, 0, S * 0.4, 0);
    g.addColorStop(0, U.rgbToCss(U.mixRgb(col, [255, 255, 255], 0.30)));
    g.addColorStop(0.45, U.rgbToCss(col));
    g.addColorStop(1, U.rgbToCss(dark));
    ctx.fillStyle = g;
    ctx.fill();
  }

  /* ================================================================= UFO */

  function ufo(ctx, S, t, c) {
    const hull = U.hexToRgb(c.c1), rim = U.hexToRgb(c.c2), lightC = U.hexToRgb(c.c3);
    const spin = t * 0.55;

    /* the beam first, so the craft sits in front of its own light */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const bg = ctx.createLinearGradient(0, S * 0.16, 0, S * 2.3);
    bg.addColorStop(0, U.rgbToCss(lightC, 0.34));
    bg.addColorStop(0.55, U.rgbToCss(lightC, 0.11));
    bg.addColorStop(1, U.rgbToCss(lightC, 0));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.30, S * 0.16);
    ctx.lineTo(S * 0.30, S * 0.16);
    ctx.lineTo(S * 1.15, S * 2.3);
    ctx.lineTo(-S * 1.15, S * 2.3);
    ctx.closePath();
    ctx.fill();
    // rings travelling down the beam
    for (let i = 0; i < 4; i++) {
      const u = ((t * 0.5 + i / 4) % 1);
      const y = S * 0.16 + u * S * 2.1;
      const w = S * (0.30 + u * 0.85);
      ctx.strokeStyle = U.rgbToCss(lightC, 0.30 * (1 - u));
      ctx.lineWidth = Math.max(0.8, S * 0.02);
      ctx.beginPath();
      ctx.ellipse(0, y, w, w * 0.22, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    /* the underside, in shadow */
    ctx.beginPath();
    ctx.ellipse(0, S * 0.09, S * 1.02, S * 0.30, 0, 0, TAU);
    ctx.fillStyle = U.rgbToCss(U.shade(rim, -0.62));
    ctx.fill();

    /* the hull: a wide lens, lit from above left */
    const hg = ctx.createLinearGradient(-S * 0.6, -S * 0.28, S * 0.5, S * 0.22);
    hg.addColorStop(0, U.rgbToCss(U.mixRgb(hull, [255, 255, 255], 0.55)));
    hg.addColorStop(0.42, U.rgbToCss(hull));
    hg.addColorStop(1, U.rgbToCss(U.shade(hull, -0.55)));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 1.05, S * 0.30, 0, 0, TAU);
    ctx.fill();

    /* panel lines radiating from the centre, foreshortened */
    ctx.strokeStyle = U.rgbToCss(U.shade(hull, -0.5), 0.55);
    ctx.lineWidth = Math.max(0.4, S * 0.012);
    for (let i = 0; i < 16; i++) {
      const a = spin * 0.3 + i * TAU / 16;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * S * 0.34, Math.sin(a) * S * 0.10);
      ctx.lineTo(Math.cos(a) * S * 1.02, Math.sin(a) * S * 0.29);
      ctx.stroke();
    }

    /* the rim, and the lights running round it */
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(rim, [255, 255, 255], 0.35));
    ctx.lineWidth = Math.max(0.8, S * 0.035);
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 1.05, S * 0.30, 0, 0, TAU);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = spin + i * TAU / 14;
      const x = Math.cos(a) * S * 1.05, y = Math.sin(a) * S * 0.30;
      const front = Math.sin(a) > -0.1;
      const k = front ? 1 : 0.28;
      const c2 = i % 3 === 0 ? lightC : U.mixRgb(lightC, [255, 255, 255], 0.5);
      bloom(ctx, x, y, S * 0.055, c2, 0.85 * k);
      ctx.fillStyle = U.rgbToCss([255, 255, 255], 0.9 * k);
      ctx.beginPath();
      ctx.arc(x, y, S * 0.026, 0, TAU);
      ctx.fill();
    }

    /* the dome */
    const dg = ctx.createRadialGradient(-S * 0.14, -S * 0.30, S * 0.02, 0, -S * 0.14, S * 0.46);
    dg.addColorStop(0, U.rgbToCss([255, 255, 255], 0.92));
    dg.addColorStop(0.35, U.rgbToCss(U.mixRgb(lightC, [255, 255, 255], 0.5), 0.72));
    dg.addColorStop(1, U.rgbToCss(U.shade(lightC, -0.3), 0.45));
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.10, S * 0.44, S * 0.40, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(rim, [255, 255, 255], 0.4), 0.7);
    ctx.lineWidth = Math.max(0.5, S * 0.02);
    ctx.stroke();
    // whatever is inside it
    ctx.fillStyle = U.rgbToCss(U.shade(hull, -0.7), 0.55);
    ctx.beginPath();
    ctx.ellipse(-S * 0.06, -S * 0.20, S * 0.10, S * 0.13, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(S * 0.12, -S * 0.17, S * 0.07, S * 0.10, 0, 0, TAU);
    ctx.fill();

    /* three landing pods under the rim */
    for (const sgn of [-1, 0, 1]) {
      const x = sgn * S * 0.62;
      ctx.fillStyle = U.rgbToCss(U.shade(rim, -0.4));
      ctx.beginPath();
      ctx.ellipse(x, S * 0.24, S * 0.09, S * 0.06, 0, 0, TAU);
      ctx.fill();
    }
    bloom(ctx, 0, S * 0.16, S * 0.5, lightC, 0.5);
  }

  /* ================================================================ ZEUS */

  /* A man, and then the weather he is standing in. The first pass drew the
     robe with the shared torso helper, which is a cone — and a cone with a
     beard on it is a chess piece, not a god. So this one has its own body:
     a bare chest and one arm holding the bolt up, with the himation draped
     off the far shoulder and falling past the knee. */
  function zeus(ctx, S, t, c) {
    const robe = U.hexToRgb(c.c1), skin = U.hexToRgb(c.c2), spark = U.hexToRgb(c.c3);
    const flick = 0.6 + 0.4 * Math.abs(Math.sin(t * 3.1) * Math.sin(t * 7.7));
    const dkSkin = U.shade(skin, -0.34);

    /* the storm he is standing in */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(0, -S * 0.2, S * 0.1, 0, -S * 0.2, S * 2.0);
    sg.addColorStop(0, U.rgbToCss(spark, 0.16 * flick));
    sg.addColorStop(1, U.rgbToCss(spark, 0));
    ctx.fillStyle = sg;
    ctx.fillRect(-S * 2, -S * 2.2, S * 4, S * 4);
    ctx.restore();

    /* the cloud he is standing on, layered so it has a top and an underside */
    ctx.save();
    for (let pass = 0; pass < 2; pass++) {
      ctx.globalAlpha = pass ? 0.55 : 0.30;
      for (let i = 0; i < 11; i++) {
        const r = rnd(0xC10D + i + pass * 97);
        const x = (r() - 0.5) * S * 2.6;
        const y = S * (pass ? 0.94 : 1.06) + (r() - 0.5) * S * 0.16;
        ctx.fillStyle = U.rgbToCss(pass ? U.mixRgb(robe, [255, 255, 255], 0.30)
                                        : U.shade(robe, -0.62));
        ctx.beginPath();
        ctx.ellipse(x, y, S * (0.24 + r() * 0.30), S * (0.09 + r() * 0.08), 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    /* the bolt, thrown up and out of the raised hand, behind the body */
    const hx = S * 0.74, hy = -S * 1.00;
    bolt(ctx, hx - S * 0.06, hy - S * 0.62, hx + S * 0.30, hy + S * 0.40,
         Math.max(1, S * 0.048), spark, 0x2E05, 3);
    bolt(ctx, hx, hy, hx + S * 1.20, hy - S * 0.58,
         Math.max(1, S * 0.036), spark, 0x2E06 + Math.floor(t * 2), 2);

    /* the far leg, then the near one: both bare, both taking weight */
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = U.rgbToCss(sgn > 0 ? skin : dkSkin);
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.03, S * 0.32);
      ctx.quadraticCurveTo(sgn * S * 0.24, S * 0.42, sgn * S * 0.22, S * 0.64);
      ctx.quadraticCurveTo(sgn * S * 0.17, S * 0.84, sgn * S * 0.19, S * 0.98);
      ctx.lineTo(sgn * S * 0.07, S * 0.99);
      ctx.quadraticCurveTo(sgn * S * 0.06, S * 0.78, sgn * S * 0.06, S * 0.60);
      ctx.quadraticCurveTo(sgn * S * 0.02, S * 0.46, sgn * S * 0.00, S * 0.34);
      ctx.closePath();
      ctx.fill();
      // sandal
      ctx.fillStyle = U.rgbToCss(U.shade([124, 92, 54], sgn > 0 ? 0 : -0.35));
      ctx.beginPath();
      ctx.ellipse(sgn * S * 0.14, S * 1.00, S * 0.115, S * 0.035, 0, 0, TAU);
      ctx.fill();
    }

    /* the body: chest, ribs, waist — a torso, not a cone */
    const cg = ctx.createLinearGradient(-S * 0.30, -S * 0.40, S * 0.30, S * 0.30);
    cg.addColorStop(0, U.rgbToCss(U.mixRgb(skin, [255, 255, 255], 0.24)));
    cg.addColorStop(0.5, U.rgbToCss(skin));
    cg.addColorStop(1, U.rgbToCss(U.shade(skin, -0.42)));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.07, -S * 0.44);
    ctx.quadraticCurveTo(-S * 0.30, -S * 0.40, -S * 0.32, -S * 0.24);   // shoulder
    ctx.quadraticCurveTo(-S * 0.25, S * 0.00, -S * 0.19, S * 0.16);     // waist
    ctx.quadraticCurveTo(-S * 0.22, S * 0.30, -S * 0.20, S * 0.38);     // hip
    ctx.lineTo(S * 0.20, S * 0.38);
    ctx.quadraticCurveTo(S * 0.22, S * 0.30, S * 0.19, S * 0.16);
    ctx.quadraticCurveTo(S * 0.25, S * 0.00, S * 0.32, -S * 0.24);
    ctx.quadraticCurveTo(S * 0.30, -S * 0.40, S * 0.07, -S * 0.44);
    ctx.closePath();
    ctx.fill();
    // pectorals, a sternum line and two rows of abdominals
    ctx.strokeStyle = U.rgbToCss(U.shade(skin, -0.40), 0.5);
    ctx.lineWidth = Math.max(0.5, S * 0.013);
    ctx.beginPath();
    ctx.moveTo(0, -S * 0.36); ctx.lineTo(0, S * 0.24);
    ctx.stroke();
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.02, -S * 0.16);
      ctx.quadraticCurveTo(sgn * S * 0.20, -S * 0.12, sgn * S * 0.27, -S * 0.24);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sgn * S * 0.02, S * (-0.03 + i * 0.09));
        ctx.quadraticCurveTo(sgn * S * 0.10, S * (-0.02 + i * 0.09), sgn * S * 0.16, S * (0.00 + i * 0.09));
        ctx.stroke();
      }
    }

    /* the himation: off the left shoulder, across the body, gathered at the
       hip and falling to the shin */
    const rg = ctx.createLinearGradient(-S * 0.34, -S * 0.36, S * 0.30, S * 0.90);
    rg.addColorStop(0, U.rgbToCss(U.mixRgb(robe, [255, 255, 255], 0.34)));
    rg.addColorStop(0.5, U.rgbToCss(robe));
    rg.addColorStop(1, U.rgbToCss(U.shade(robe, -0.44)));
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.30, -S * 0.36);
    ctx.quadraticCurveTo(-S * 0.44, S * 0.06, -S * 0.30, S * 0.34);
    ctx.quadraticCurveTo(-S * 0.36, S * 0.66, -S * 0.24, S * 0.86);
    ctx.lineTo(S * 0.20, S * 0.84);
    ctx.quadraticCurveTo(S * 0.32, S * 0.52, S * 0.24, S * 0.22);
    ctx.lineTo(-S * 0.06, S * 0.26);
    /* up the left side only. The right side of the chest stays bare, which is
       the whole reason to draw a body under a robe: a garment that covers
       everything is a cone with a head on it. */
    ctx.quadraticCurveTo(-S * 0.12, -S * 0.06, -S * 0.16, -S * 0.34);
    ctx.closePath();
    ctx.fill();
    // folds
    ctx.strokeStyle = U.rgbToCss(U.shade(robe, -0.48), 0.65);
    ctx.lineWidth = Math.max(0.5, S * 0.014);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(-S * (0.28 - i * 0.05), S * (0.14 + i * 0.03));
      ctx.quadraticCurveTo(-S * (0.30 - i * 0.09), S * 0.50, -S * (0.16 - i * 0.09), S * 0.84);
      ctx.stroke();
    }
    // the strap over the shoulder, catching the light
    ctx.fillStyle = U.rgbToCss(U.mixRgb(robe, [255, 255, 255], 0.55), 0.92);
    ctx.beginPath();
    ctx.moveTo(-S * 0.305, -S * 0.355);
    ctx.quadraticCurveTo(-S * 0.24, -S * 0.425, -S * 0.155, -S * 0.400);
    ctx.quadraticCurveTo(-S * 0.02, -S * 0.120, S * 0.120, S * 0.195);
    ctx.quadraticCurveTo(S * 0.055, S * 0.265, -S * 0.020, S * 0.245);
    ctx.quadraticCurveTo(-S * 0.16, -S * 0.060, -S * 0.305, -S * 0.355);
    ctx.closePath();
    ctx.fill();
    // the brooch that holds it
    ctx.fillStyle = U.rgbToCss([232, 212, 136]);
    ctx.beginPath();
    ctx.arc(-S * 0.24, -S * 0.37, S * 0.035, 0, TAU);
    ctx.fill();

    /* the lowered arm, then the raised one over everything */
    ctx.strokeStyle = U.rgbToCss(dkSkin);
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.3, S * 0.105);
    ctx.beginPath();
    ctx.moveTo(-S * 0.26, -S * 0.28);
    ctx.quadraticCurveTo(-S * 0.44, S * 0.02, -S * 0.34, S * 0.34);
    ctx.stroke();
    ctx.fillStyle = U.rgbToCss(dkSkin);
    ctx.beginPath(); ctx.arc(-S * 0.34, S * 0.37, S * 0.055, 0, TAU); ctx.fill();

    ctx.strokeStyle = U.rgbToCss(skin);
    ctx.lineWidth = Math.max(1.4, S * 0.115);
    ctx.beginPath();
    ctx.moveTo(S * 0.26, -S * 0.34);
    ctx.quadraticCurveTo(S * 0.62, -S * 0.52, hx, hy);
    ctx.stroke();
    // the fist round the bolt
    ctx.fillStyle = U.rgbToCss(U.mixRgb(skin, [255, 255, 255], 0.12));
    ctx.beginPath(); ctx.arc(hx, hy, S * 0.070, 0, TAU); ctx.fill();

    /* head, beard, laurel */
    ctx.save();
    ctx.translate(0, -S * 0.60);
    ctx.fillStyle = U.rgbToCss(skin);
    ctx.beginPath();
    ctx.ellipse(0, 0, S * 0.185, S * 0.215, 0, 0, TAU);
    ctx.fill();
    // the nose, in profile enough to be a nose
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.18), 0.8);
    ctx.beginPath();
    ctx.moveTo(-S * 0.006, -S * 0.010);
    ctx.quadraticCurveTo(-S * 0.032, S * 0.046, -S * 0.004, S * 0.066);
    ctx.quadraticCurveTo(S * 0.018, S * 0.068, S * 0.020, S * 0.048);
    ctx.closePath();
    ctx.fill();
    // the beard is most of the face: layered, not one shape
    const bgd = ctx.createLinearGradient(0, S * 0.02, 0, S * 0.50);
    bgd.addColorStop(0, U.rgbToCss([248, 250, 255]));
    bgd.addColorStop(1, U.rgbToCss([162, 178, 202]));
    ctx.fillStyle = bgd;
    ctx.beginPath();
    ctx.moveTo(-S * 0.185, S * 0.010);
    ctx.quadraticCurveTo(-S * 0.25, S * 0.38, 0, S * 0.54);
    ctx.quadraticCurveTo(S * 0.25, S * 0.38, S * 0.185, S * 0.010);
    ctx.quadraticCurveTo(S * 0.11, S * 0.140, 0, S * 0.132);
    ctx.quadraticCurveTo(-S * 0.11, S * 0.140, -S * 0.185, S * 0.010);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,170,0.5)';
    ctx.lineWidth = Math.max(0.4, S * 0.010);
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * S * 0.055, S * 0.15);
      ctx.quadraticCurveTo(i * S * 0.075, S * 0.34, i * S * 0.040, S * 0.50);
      ctx.stroke();
    }
    // the moustache, over the beard
    ctx.fillStyle = U.rgbToCss([238, 242, 250]);
    ctx.beginPath();
    ctx.moveTo(-S * 0.105, S * 0.088);
    ctx.quadraticCurveTo(0, S * 0.062, S * 0.105, S * 0.088);
    ctx.quadraticCurveTo(0, S * 0.136, -S * 0.105, S * 0.088);
    ctx.closePath();
    ctx.fill();
    // hair
    /* On top of the head, not over the face. Set an eighth of a head lower
       than this and it becomes a hood: the brow, the eyes and the bridge of
       the nose all disappear under it and what is left reads as a snowman. */
    ctx.fillStyle = U.rgbToCss([230, 236, 248]);
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.115, S * 0.205, S * 0.115, 0, Math.PI * 0.98, TAU * 1.02);
    ctx.fill();
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * S * 0.082, -S * 0.150, S * 0.058, S * 0.058, i * 0.3, 0, TAU);
      ctx.fill();
    }
    // the two locks that fall past the ear
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * S * 0.150, -S * 0.135);
      ctx.quadraticCurveTo(sx * S * 0.215, -S * 0.010, sx * S * 0.170, S * 0.090);
      ctx.quadraticCurveTo(sx * S * 0.135, S * 0.010, sx * S * 0.120, -S * 0.110);
      ctx.closePath();
      ctx.fill();
    }
    // the eyes, which are the only part of him that is not weather
    for (const sx of [-1, 1]) {
      const ex = sx * S * 0.076, ey = -S * 0.028;
      // the socket first, so the light has something to sit in
      ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.40), 0.7);
      ctx.beginPath();
      ctx.ellipse(ex, ey, S * 0.042, S * 0.028, 0, 0, TAU);
      ctx.fill();
      bloom(ctx, ex, ey, S * 0.028, spark, 0.8 * flick);
      ctx.fillStyle = U.rgbToCss(U.mixRgb(spark, [255, 255, 255], 0.7), 0.95);
      ctx.beginPath();
      ctx.ellipse(ex, ey, S * 0.026, S * 0.017, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(ex + sx * S * 0.004, ey, S * 0.008, 0, TAU);
      ctx.fill();
      // brow above it
      ctx.strokeStyle = U.rgbToCss([228, 234, 246], 0.9);
      ctx.lineWidth = Math.max(0.5, S * 0.016);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(ex - sx * S * 0.040, ey - S * 0.044);
      ctx.quadraticCurveTo(ex, ey - S * 0.058, ex + sx * S * 0.045, ey - S * 0.040);
      ctx.stroke();
    }
    // laurel
    ctx.strokeStyle = U.rgbToCss([216, 192, 106]);
    ctx.lineWidth = Math.max(0.6, S * 0.020);
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0, -S * 0.11, S * 0.245, sx > 0 ? -1.5 : Math.PI - 0.4,
              sx > 0 ? -0.2 : Math.PI + 1.3);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const a = (sx > 0 ? -1.35 + i * 0.30 : Math.PI + 0.15 + i * 0.30);
        const lx = Math.cos(a) * S * 0.245, ly = -S * 0.11 + Math.sin(a) * S * 0.245;
        ctx.fillStyle = U.rgbToCss([232, 212, 136]);
        ctx.beginPath();
        ctx.ellipse(lx, ly, S * 0.048, S * 0.021, a + 1.2, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* =============================================================== EARTH */

  function earth(ctx, S, t, c) {
    const sea = U.hexToRgb(c.c1), land = U.hexToRgb(c.c2), air = U.hexToRgb(c.c3);
    const spin = t * 0.05;
    const R = S;

    /* the atmosphere, outside the disc */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ag = ctx.createRadialGradient(0, 0, R * 0.94, 0, 0, R * 1.30);
    ag.addColorStop(0, U.rgbToCss(air, 0.55));
    ag.addColorStop(0.35, U.rgbToCss(air, 0.16));
    ag.addColorStop(1, U.rgbToCss(air, 0));
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.arc(0, 0, R * 1.32, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.clip();

    /* the ocean */
    const og = ctx.createRadialGradient(-R * 0.34, -R * 0.38, R * 0.05, 0, 0, R * 1.15);
    og.addColorStop(0, U.rgbToCss(U.mixRgb(sea, [255, 255, 255], 0.38)));
    og.addColorStop(0.55, U.rgbToCss(sea));
    og.addColorStop(1, U.rgbToCss(U.shade(sea, -0.55)));
    ctx.fillStyle = og;
    ctx.fillRect(-R, -R, R * 2, R * 2);

    /* Land. Blobs of overlapping circles laid on a sphere: latitude and a
       longitude that scrolls, projected so a landmass narrows as it turns
       toward the edge and disappears round the back. */
    /* One landmass. Eighty small blobs rather than twenty large ones, packed
       tightest at the middle and thinning to the edge — which is what gives a
       coastline. Twenty large ones give an amoeba, which is what the first
       pass of this drew. Each blob is squashed by how far round the sphere it
       has turned, and anything past the horizon is dropped. */
    function plot(lon, lat, rr, col, seed, n) {
      const r = rnd(seed);
      for (let i = 0; i < (n || 110); i++) {
        // two draws averaged: a cheap bell, so the mass has a middle
        const d1 = (r() + r() + r()) / 3 - 0.5;
        const d2 = (r() + r() + r()) / 3 - 0.5;
        const lo = lon + d1 * rr * 1.9;
        const la = lat + d2 * rr * 1.3;
        if (Math.abs(la) > 0.48) continue;
        const ph = ((lo + spin) % 1 + 1) % 1;
        const facing = Math.cos(ph * TAU);
        if (facing < 0.01) continue;                // round the back
        const x = Math.sin(ph * TAU) * R * Math.cos(la * Math.PI);
        const y = -Math.sin(la * Math.PI) * R;
        const edge = Math.max(Math.abs(d1), Math.abs(d2)) * 2;   // 0 middle, 1 coast
        /* Blobs shrink hard toward the coast. Same-sized blobs all the way out
           give a boundary made of arcs of one radius, which reads as bubbles;
           small ones at the edge give a coastline. */
        const rad = R * rr * (0.07 + Math.pow(1 - edge, 1.7) * 0.46) * (0.75 + r() * 0.5);
        // inland is darker and drier, the coast is greener
        ctx.fillStyle = U.rgbToCss(U.shade(col, 0.16 - edge * 0.30 + (r() - 0.5) * 0.16));
        ctx.beginPath();
        ctx.ellipse(x, y, rad * Math.max(0.05, facing), rad, 0, 0, TAU);
        ctx.fill();
      }
    }
    /* Latitude here is the sine of the angle, not the angle: 0.26 is not a
       quarter of the way up the disc, it is forty-seven degrees north and
       most of the way to the pole. Everything used to sit at 0.2 and above
       and the equator came out as open ocean all the way round. */
    plot(0.06, 0.14, 0.30, land, 0x0EA1, 260);       // a big northern mass
    plot(0.11, -0.10, 0.23, land, 0x0EA2, 190);      // and what hangs off it
    plot(0.44, 0.10, 0.24, U.shade(land, -0.10), 0x0EA3, 200);
    plot(0.56, -0.16, 0.26, U.shade(land, 0.08), 0x0EA4, 210);
    plot(0.79, -0.20, 0.18, U.shade(land, -0.04), 0x0EA5, 130);
    plot(0.30, 0.02, 0.07, U.shade(land, 0.06), 0x0EA8, 22);   // an island chain
    plot(0.68, 0.20, 0.06, U.shade(land, -0.02), 0x0EA9, 16);

    /* the caps: not blobs of pale land but the poles of the sphere, so they
       stay put while everything under them turns */
    for (const sgn of [-1, 1]) {
      const cg = ctx.createLinearGradient(0, sgn * R * 1.04, 0, sgn * R * 0.68);
      cg.addColorStop(0, 'rgba(246,250,255,0.94)');
      cg.addColorStop(0.6, 'rgba(238,246,255,0.55)');
      cg.addColorStop(1, 'rgba(232,242,255,0)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(0, sgn * R * 1.04, R * 0.80, R * (sgn < 0 ? 0.34 : 0.29), 0, 0, TAU);
      ctx.fill();
    }

    /* cloud, in bands, moving a little faster than the ground */
    ctx.save();
    ctx.globalAlpha = 0.42;
    for (let b = 0; b < 6; b++) {
      const lat = -0.62 + b * 0.25;
      const r = rnd(0xC10 + b);
      for (let i = 0; i < 16; i++) {
        const ph = ((r() + spin * 1.7 + t * 0.004) % 1 + 1) % 1;
        const facing = Math.cos(ph * TAU);
        if (facing < 0) continue;
        const x = Math.sin(ph * TAU) * R * Math.cos(lat * Math.PI);
        const y = -Math.sin(lat * Math.PI) * R;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(x, y, R * (0.05 + r() * 0.09) * Math.max(0.06, facing),
                    R * (0.018 + r() * 0.03), 0, 0, TAU);
        ctx.fill();
      }
    }
    /* one cyclone, spiralled, because banded cloud alone reads as stripes */
    const stLon = 0.30, stLat = -0.20;
    const stPh = ((stLon + spin * 1.7) % 1 + 1) % 1;
    if (Math.cos(stPh * TAU) > 0.16) {
      const sx = Math.sin(stPh * TAU) * R * Math.cos(stLat * Math.PI);
      const sy = -Math.sin(stLat * Math.PI) * R;
      const sq = Math.cos(stPh * TAU);
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 34; i++) {
        const u = i / 33;
        const a = u * 5.6 + t * 0.25;
        const rr2 = R * 0.035 + u * R * 0.16;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(sx + Math.cos(a) * rr2 * sq, sy + Math.sin(a) * rr2,
                    R * 0.030 * sq, R * 0.020, a, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    /* the terminator: night on the far side, and the cities in it */
    const ng = ctx.createLinearGradient(-R * 0.1, -R * 0.4, R * 1.1, R * 0.7);
    ng.addColorStop(0, 'rgba(0,0,0,0)');
    ng.addColorStop(0.44, 'rgba(2,4,10,0.30)');
    ng.addColorStop(1, 'rgba(1,2,6,0.90)');
    ctx.fillStyle = ng;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const rc = rnd(0x0C17);
    for (let i = 0; i < 60; i++) {
      const lo = rc(), la = (rc() - 0.5) * 1.1;
      const ph = ((lo + spin) % 1 + 1) % 1;
      const facing = Math.cos(ph * TAU);
      if (facing < 0.02) continue;
      const x = Math.sin(ph * TAU) * R * Math.cos(la * Math.PI);
      const y = -Math.sin(la * Math.PI) * R;
      if (x < R * 0.10) continue;                  // only on the night side
      ctx.fillStyle = U.rgbToCss([255, 214, 150], 0.5 + rc() * 0.4);
      ctx.fillRect(x, y, Math.max(0.6, R * 0.008), Math.max(0.6, R * 0.008));
    }
    ctx.restore();
    ctx.restore();

    /* the rim: a hard bright edge where the atmosphere catches the light */
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(air, [255, 255, 255], 0.6), 0.85);
    ctx.lineWidth = Math.max(0.8, R * 0.012);
    ctx.beginPath(); ctx.arc(0, 0, R * 0.995, -2.5, 0.6); ctx.stroke();

    /* and the moon, small, off to one side */
    const mx = -R * 1.46, my = -R * 0.86, mr = R * 0.145;
    const mg = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.35, mr * 0.05, mx, my, mr);
    mg.addColorStop(0, '#e8ecf2');
    mg.addColorStop(0.6, '#a9b2bf');
    mg.addColorStop(1, '#3b424c');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    for (let i = 0; i < 7; i++) {
      const a = i * 2.4, d = mr * (0.15 + (i % 4) * 0.18);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath();
      ctx.arc(mx + Math.cos(a) * d, my + Math.sin(a) * d, mr * (0.08 + (i % 3) * 0.05), 0, TAU);
      ctx.fill();
    }
  }

  /* =============================================================== KAIJU */

  /* Not a lizard drawn large. The thing that makes this silhouette is the
     line down its back: a single curve from the nape, over the hips and out
     along the tail, with the plates standing off its outward normal. The tail
     and the plates are sampled from that same curve rather than each being
     drawn on its own, which is the only reliable way to keep them from
     coming apart at the hip. */
  function kaiju(ctx, S, t, c) {
    const hide = U.hexToRgb(c.c1), belly = U.hexToRgb(c.c2), glow = U.hexToRgb(c.c3);
    const breathe = Math.sin(t * 0.9) * 0.018;
    const charge = 0.5 + 0.5 * Math.sin(t * 0.7);

    /* nape → shoulders → hips → tail tip, in units of S */
    const SP = [
      [-0.02, -0.72], [-0.20, -0.40], [-0.32, -0.02], [-0.34, 0.36],
      [-0.60, 0.66], [-1.04, 0.88], [-1.50, 0.98], [-1.96, 0.94]
    ];
    function spine(u) {
      const n = SP.length - 1;
      const f = U.clamp(u, 0, 1) * n;
      const i = Math.min(n - 1, Math.floor(f));
      const k = f - i;
      const p0 = SP[Math.max(0, i - 1)], p1 = SP[i], p2 = SP[i + 1], p3 = SP[Math.min(n, i + 2)];
      const h = function (a, b, d, e) {
        return 0.5 * (2 * b + (-a + d) * k + (2 * a - 5 * b + 4 * d - e) * k * k +
                      (-a + 3 * b - 3 * d + e) * k * k * k);
      };
      return [h(p0[0], p1[0], p2[0], p3[0]) * S, h(p0[1], p1[1], p2[1], p3[1]) * S];
    }
    /* The outward side of the back, as a unit vector. Everything that stands
       off the spine uses this, so nothing has to hard-code which way is up on
       an animal that is vertical at one end and horizontal at the other. */
    function out(u) {
      const p = spine(Math.max(0, u - 0.008)), q = spine(Math.min(1, u + 0.008));
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const m = Math.hypot(dx, dy) || 1;
      return [-dy / m, dx / m];
    }

    /* the tail: a tapering ribbon along the back two thirds of the spine */
    const U0 = 0.34;
    const A = [], B = [];
    for (let i = 0; i <= 30; i++) {
      const u = U0 + (i / 30) * (1 - U0);
      const p = spine(u), o = out(u);
      const w = S * 0.30 * Math.pow(1 - (u - U0) / (1 - U0), 1.3) + S * 0.010;
      A.push([p[0] + o[0] * w, p[1] + o[1] * w]);
      B.push([p[0] - o[0] * w, p[1] - o[1] * w]);
    }
    ctx.beginPath();
    ctx.moveTo(A[0][0], A[0][1]);
    A.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    for (let i = B.length - 1; i >= 0; i--) ctx.lineTo(B[i][0], B[i][1]);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, S * 0.3, -S * 1.9, S * 1.1);
    tg.addColorStop(0, U.rgbToCss(U.shade(hide, -0.14)));
    tg.addColorStop(1, U.rgbToCss(U.shade(hide, -0.62)));
    ctx.fillStyle = tg;
    ctx.fill();

    /* One leg. Digitigrade: the ankle is high and the heel never lands, which
       is most of why this reads as something enormous rather than as a man in
       a suit. Drawn twice, far side first and darker. */
    function leg(sgn, k) {
      const x0 = sgn * S * 0.15;
      ctx.fillStyle = U.rgbToCss(U.shade(hide, k));
      ctx.beginPath();
      ctx.moveTo(x0 - S * 0.26, S * 0.20);
      ctx.quadraticCurveTo(x0 - S * 0.40, S * 0.66, x0 - S * 0.20, S * 0.88);
      ctx.quadraticCurveTo(x0 - S * 0.13, S * 1.10, x0 - S * 0.26, S * 1.18);
      ctx.lineTo(x0 + S * 0.30, S * 1.20);
      ctx.quadraticCurveTo(x0 + S * 0.24, S * 0.98, x0 + S * 0.12, S * 0.86);
      ctx.quadraticCurveTo(x0 + S * 0.30, S * 0.52, x0 + S * 0.20, S * 0.16);
      ctx.closePath();
      ctx.fill();
      // the shin, one shade up, so the leg has a front and a back
      ctx.fillStyle = U.rgbToCss(U.shade(hide, k + 0.14));
      ctx.beginPath();
      ctx.moveTo(x0 - S * 0.02, S * 0.74);
      ctx.quadraticCurveTo(x0 + S * 0.16, S * 0.96, x0 + S * 0.06, S * 1.16);
      ctx.lineTo(x0 - S * 0.18, S * 1.15);
      ctx.quadraticCurveTo(x0 - S * 0.10, S * 0.94, x0 - S * 0.14, S * 0.76);
      ctx.closePath();
      ctx.fill();
      // three claws, forward
      for (let i = 0; i < 3; i++) {
        const cx = x0 + S * (0.06 + i * 0.11);
        ctx.fillStyle = U.rgbToCss([234, 239, 244], 0.95 - i * 0.08);
        ctx.beginPath();
        ctx.moveTo(cx, S * 1.13);
        ctx.lineTo(cx + S * 0.11, S * 1.25);
        ctx.lineTo(cx - S * 0.01, S * 1.22);
        ctx.closePath();
        ctx.fill();
      }
    }
    leg(-1, -0.52);

    /* the body: a barrel, leaning slightly forward off the hips */
    const bg = ctx.createLinearGradient(-S * 0.5, -S * 0.4, S * 0.5, S * 0.5);
    bg.addColorStop(0, U.rgbToCss(U.mixRgb(hide, [255, 255, 255], 0.18)));
    bg.addColorStop(0.44, U.rgbToCss(hide));
    bg.addColorStop(1, U.rgbToCss(U.shade(hide, -0.60)));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.26, -S * 0.68);
    ctx.quadraticCurveTo(-S * 0.52, -S * 0.16, -S * 0.42, S * 0.40);
    ctx.quadraticCurveTo(-S * 0.24, S * 0.66, S * 0.14, S * 0.56);
    ctx.quadraticCurveTo(S * 0.50, S * 0.24, S * 0.42, -S * 0.34);
    ctx.quadraticCurveTo(S * 0.34, -S * 0.72, -S * 0.26, -S * 0.68);
    ctx.closePath();
    ctx.fill();

    /* the belly: bands across the front, narrowing toward the throat */
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(S * 0.04, -S * 0.58);
    ctx.quadraticCurveTo(S * 0.40, -S * 0.18, S * 0.14, S * 0.50);
    ctx.quadraticCurveTo(-S * 0.02, S * 0.52, -S * 0.04, S * 0.28);
    ctx.quadraticCurveTo(-S * 0.06, -S * 0.22, S * 0.04, -S * 0.58);
    ctx.closePath();
    ctx.clip();
    /* Warm it toward the hide rather than laying a pale slab on the chest:
       at full strength this read as a bib rather than as the underside of an
       animal, which is what it is. */
    ctx.fillStyle = U.rgbToCss(U.mixRgb(belly, hide, 0.34), 0.88);
    ctx.fillRect(-S, -S, S * 2, S * 2);
    ctx.strokeStyle = U.rgbToCss(U.shade(belly, -0.44), 0.60);
    ctx.lineWidth = Math.max(0.5, S * 0.016);
    for (let i = 0; i < 11; i++) {
      const y = -S * 0.60 + i * S * 0.115;
      ctx.beginPath();
      ctx.moveTo(-S * 0.30, y);
      ctx.quadraticCurveTo(S * 0.06, y + S * 0.05, S * 0.50, y - S * 0.02);
      ctx.stroke();
    }
    ctx.restore();

    /* hide texture: rows of small scutes, only on the lit side */
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = U.rgbToCss(U.shade(hide, -0.75));
    ctx.lineWidth = Math.max(0.4, S * 0.010);
    for (let r2 = 0; r2 < 7; r2++) {
      for (let i = 0; i < 4; i++) {
        const x = -S * (0.38 - i * 0.09) + (r2 % 2) * S * 0.045;
        const y = -S * 0.56 + r2 * S * 0.17;
        ctx.beginPath();
        ctx.arc(x, y, S * 0.055, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* The arms. Short and thick and held forward — and drawn as limbs with a
       shoulder, an elbow and a hand rather than as a stroke with three white
       hairs on the end, which is what the first pass looked like at any size
       where you could see it. */
    for (const sgn of [1, -1]) {
      const k = sgn > 0 ? -0.10 : -0.44;
      const dy = sgn * S * 0.07;
      ctx.fillStyle = U.rgbToCss(U.shade(hide, k));
      ctx.beginPath();
      ctx.moveTo(S * 0.16, -S * 0.40 + dy);
      ctx.quadraticCurveTo(S * 0.52, -S * 0.34 + dy, S * 0.56, -S * 0.06 + dy);
      ctx.quadraticCurveTo(S * 0.58, S * 0.06 + dy, S * 0.48, S * 0.10 + dy);
      ctx.quadraticCurveTo(S * 0.42, -S * 0.12 + dy, S * 0.30, -S * 0.14 + dy);
      ctx.quadraticCurveTo(S * 0.20, -S * 0.18 + dy, S * 0.14, -S * 0.28 + dy);
      ctx.closePath();
      ctx.fill();
      // the hand, a knot at the wrist
      ctx.fillStyle = U.rgbToCss(U.shade(hide, k - 0.08));
      ctx.beginPath();
      ctx.ellipse(S * 0.52, S * 0.08 + dy, S * 0.075, S * 0.060, 0.3, 0, TAU);
      ctx.fill();
      // three claws, short, curving back under the hand
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = U.rgbToCss([230, 236, 242], 0.92);
        const cx = S * (0.50 + i * 0.045), cy = S * 0.12 + dy;
        ctx.beginPath();
        ctx.moveTo(cx - S * 0.014, cy);
        ctx.quadraticCurveTo(cx + S * 0.030, cy + S * 0.055, cx + S * 0.006, cy + S * 0.090);
        ctx.quadraticCurveTo(cx - S * 0.004, cy + S * 0.050, cx - S * 0.026, cy + S * 0.012);
        ctx.closePath();
        ctx.fill();
      }
    }

    leg(1, -0.16);

    /* the plates. Fourteen, standing off the outward normal of the spine, so
       they climb the neck, crest at the shoulder and run all the way out. */
    for (let i = 0; i < 14; i++) {
      const u = 0.02 + (i / 13) * 0.88;
      const p = spine(u), o = out(u);
      const tan = [-o[1], o[0]];
      const h = S * (0.40 - 0.30 * Math.pow(u, 0.75)) * (1 + breathe) *
                (i < 2 ? 0.62 + i * 0.19 : 1);
      const w = S * (0.15 - 0.095 * u);
      const bx = p[0], by = p[1];
      ctx.beginPath();
      ctx.moveTo(bx - tan[0] * w, by - tan[1] * w);
      ctx.quadraticCurveTo(bx + o[0] * h * 0.72 - tan[0] * w * 0.45,
                           by + o[1] * h * 0.72 - tan[1] * w * 0.45,
                           bx + o[0] * h, by + o[1] * h);
      ctx.quadraticCurveTo(bx + o[0] * h * 0.72 + tan[0] * w * 0.45,
                           by + o[1] * h * 0.72 + tan[1] * w * 0.45,
                           bx + tan[0] * w, by + tan[1] * w);
      ctx.closePath();
      /* they light back to front, one after another, rather than all at once */
      const lag = U.clamp(charge * 1.5 - u * 0.5, 0, 1);
      const pg = ctx.createLinearGradient(bx, by, bx + o[0] * h, by + o[1] * h);
      pg.addColorStop(0, U.rgbToCss(U.shade(hide, -0.55)));
      pg.addColorStop(0.45, U.rgbToCss(U.mixRgb(glow, [255, 255, 255], 0.18), 0.35 + lag * 0.6));
      pg.addColorStop(1, U.rgbToCss([255, 255, 255], 0.25 + lag * 0.7));
      ctx.fillStyle = pg;
      ctx.fill();
      bloom(ctx, bx + o[0] * h * 0.7, by + o[1] * h * 0.7, w * 1.5, glow, 0.75 * lag);
    }

    /* the neck, then the head, blunt and heavy and pointing forward */
    ctx.fillStyle = U.rgbToCss(U.shade(hide, -0.22));
    ctx.beginPath();
    ctx.moveTo(-S * 0.10, -S * 0.62);
    ctx.quadraticCurveTo(S * 0.06, -S * 0.86, S * 0.28, -S * 0.92);
    ctx.lineTo(S * 0.34, -S * 0.66);
    ctx.quadraticCurveTo(S * 0.16, -S * 0.60, S * 0.24, -S * 0.44);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    ctx.translate(S * 0.34, -S * 0.96);
    ctx.rotate(-0.10);
    // skull
    const kg = ctx.createLinearGradient(-S * 0.2, -S * 0.16, S * 0.3, S * 0.10);
    kg.addColorStop(0, U.rgbToCss(U.mixRgb(hide, [255, 255, 255], 0.26)));
    kg.addColorStop(1, U.rgbToCss(U.shade(hide, -0.52)));
    ctx.fillStyle = kg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.26, S * 0.02);
    ctx.quadraticCurveTo(-S * 0.22, -S * 0.22, S * 0.02, -S * 0.22);
    ctx.quadraticCurveTo(S * 0.34, -S * 0.20, S * 0.42, -S * 0.02);
    ctx.quadraticCurveTo(S * 0.44, S * 0.04, S * 0.32, S * 0.06);
    ctx.lineTo(-S * 0.22, S * 0.10);
    ctx.closePath();
    ctx.fill();
    // brow ridge
    ctx.fillStyle = U.rgbToCss(U.shade(hide, -0.05));
    ctx.beginPath();
    ctx.moveTo(-S * 0.10, -S * 0.16);
    ctx.quadraticCurveTo(S * 0.10, -S * 0.26, S * 0.26, -S * 0.14);
    ctx.quadraticCurveTo(S * 0.08, -S * 0.14, -S * 0.10, -S * 0.09);
    ctx.closePath();
    ctx.fill();
    // the jaw, dropped, with the throat glowing between
    ctx.fillStyle = U.rgbToCss(U.shade(hide, -0.62));
    ctx.beginPath();
    ctx.moveTo(-S * 0.20, S * 0.09);
    ctx.quadraticCurveTo(S * 0.10, S * 0.30, S * 0.36, S * 0.13);
    ctx.lineTo(S * 0.32, S * 0.05);
    ctx.lineTo(-S * 0.20, S * 0.04);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const th = ctx.createLinearGradient(0, S * 0.02, 0, S * 0.14);
    th.addColorStop(0, U.rgbToCss(glow, 0.55 * charge));
    th.addColorStop(1, U.rgbToCss(glow, 0));
    ctx.fillStyle = th;
    ctx.fillRect(-S * 0.18, S * 0.02, S * 0.52, S * 0.13);
    ctx.restore();
    // teeth, upper and lower
    ctx.fillStyle = '#f2f5f9';
    for (let i = 0; i < 8; i++) {
      const x = -S * 0.14 + i * S * 0.058;
      ctx.beginPath();
      ctx.moveTo(x, S * 0.035);
      ctx.lineTo(x + S * 0.016, S * 0.10);
      ctx.lineTo(x + S * 0.034, S * 0.035);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#dde3ea';
    for (let i = 0; i < 6; i++) {
      const x = -S * 0.10 + i * S * 0.070;
      ctx.beginPath();
      ctx.moveTo(x, S * 0.16);
      ctx.lineTo(x + S * 0.016, S * 0.10);
      ctx.lineTo(x + S * 0.032, S * 0.165);
      ctx.closePath();
      ctx.fill();
    }
    // nostril, then the eye
    ctx.fillStyle = U.rgbToCss(U.shade(hide, -0.8));
    ctx.beginPath();
    ctx.ellipse(S * 0.33, -S * 0.06, S * 0.022, S * 0.014, -0.3, 0, TAU);
    ctx.fill();
    bloom(ctx, S * 0.10, -S * 0.10, S * 0.055, glow, 0.95);
    ctx.fillStyle = '#fff8e2';
    ctx.beginPath();
    ctx.ellipse(S * 0.10, -S * 0.10, S * 0.042, S * 0.026, -0.18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#100a04';
    ctx.beginPath();
    ctx.ellipse(S * 0.11, -S * 0.10, S * 0.010, S * 0.024, -0.18, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ============================================================= CTHULHU */

  /* The face is the whole thing, and the first pass hid it: the tentacles
     were the same colour as the head they hung off, at the same alpha, and
     what came out was a green egg with two eyes on it. They are drawn dark
     against the chest now, in front of everything, with the light along their
     upper edge — which is also how you can tell there are seven of them. */
  function cthulhu(ctx, S, t, c) {
    const flesh = U.hexToRgb(c.c1), dark = U.hexToRgb(c.c2), eyeC = U.hexToRgb(c.c3);
    const sway = Math.sin(t * 0.5) * 0.05;
    const breathe = Math.sin(t * 0.7) * 0.012;

    /* the wings: membrane between four fingers, and a claw on each */
    for (const sgn of [-1, 1]) {
      ctx.save();
      ctx.scale(sgn, 1);
      /* Leading edge out to the far tip, then a scalloped trailing edge back
         through each finger. The scallops have to bow toward the shoulder or
         the membrane fills in between the fingers and the whole thing reads
         as a leaf, which is what the first pass of this was. */
      const ribs = [[1.90, -0.62], [1.52, 0.24], [1.02, 0.62], [0.58, 0.70]];
      ctx.beginPath();
      ctx.moveTo(S * 0.22, -S * 0.62);
      ctx.quadraticCurveTo(S * 1.20, -S * 1.60, S * ribs[0][0], S * ribs[0][1]);
      for (let i = 1; i < ribs.length; i++) {
        const a = ribs[i - 1], b = ribs[i];
        ctx.quadraticCurveTo(S * (a[0] * 0.52 + b[0] * 0.30), S * (a[1] * 0.30 + b[1] * 0.26),
                             S * b[0], S * b[1]);
      }
      ctx.quadraticCurveTo(S * 0.34, S * 0.34, S * 0.20, S * 0.04);
      ctx.closePath();
      const wg = ctx.createLinearGradient(S * 0.22, -S * 0.7, S * 1.9, S * 0.5);
      wg.addColorStop(0, U.rgbToCss(U.shade(dark, 0.18), 0.96));
      wg.addColorStop(0.55, U.rgbToCss(U.shade(dark, -0.10), 0.92));
      wg.addColorStop(1, U.rgbToCss(U.shade(dark, -0.55), 0.86));
      ctx.fillStyle = wg;
      ctx.fill();
      // the finger bones, and a hooked claw at the end of each
      ribs.forEach(function (e, i) {
        ctx.strokeStyle = U.rgbToCss(U.mixRgb(flesh, dark, 0.45), 0.85);
        ctx.lineWidth = Math.max(0.6, S * (0.030 - i * 0.005));
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(S * 0.26, -S * 0.56);
        ctx.quadraticCurveTo(S * e[0] * 0.58, -S * (0.86 - i * 0.16), S * e[0], S * e[1]);
        ctx.stroke();
        ctx.fillStyle = U.rgbToCss([228, 234, 226], 0.92);
        ctx.beginPath();
        ctx.moveTo(S * (e[0] - 0.03), S * (e[1] - 0.02));
        ctx.quadraticCurveTo(S * (e[0] + 0.09), S * (e[1] + 0.02), S * (e[0] + 0.05), S * (e[1] + 0.11));
        ctx.quadraticCurveTo(S * (e[0] + 0.02), S * (e[1] + 0.04), S * (e[0] - 0.03), S * (e[1] + 0.01));
        ctx.closePath();
        ctx.fill();
      });
      // veins in the membrane
      ctx.strokeStyle = U.rgbToCss(U.shade(dark, 0.35), 0.28);
      ctx.lineWidth = Math.max(0.3, S * 0.008);
      for (let i = 0; i < 7; i++) {
        const e = ribs[i % ribs.length];
        ctx.beginPath();
        ctx.moveTo(S * (0.30 + i * 0.05), -S * (0.50 - i * 0.03));
        ctx.quadraticCurveTo(S * e[0] * 0.66, -S * (0.42 - i * 0.07), S * e[0] * 0.92, S * (e[1] - 0.06));
        ctx.stroke();
      }
      ctx.restore();
    }

    /* the legs: crouched, taking the weight */
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = U.rgbToCss(U.shade(flesh, sgn > 0 ? -0.34 : -0.55));
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.10, S * 0.62);
      ctx.quadraticCurveTo(sgn * S * 0.52, S * 0.72, sgn * S * 0.44, S * 1.00);
      ctx.lineTo(sgn * S * 0.16, S * 1.04);
      ctx.quadraticCurveTo(sgn * S * 0.22, S * 0.84, sgn * S * 0.04, S * 0.76);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = U.rgbToCss([224, 230, 222], 0.9);
        const cx = sgn * S * (0.24 + i * 0.10);
        ctx.beginPath();
        ctx.moveTo(cx, S * 1.00);
        ctx.lineTo(cx + sgn * S * 0.08, S * 1.10);
        ctx.lineTo(cx - sgn * S * 0.01, S * 1.08);
        ctx.closePath();
        ctx.fill();
      }
    }

    /* the body: hunched, heavy shoulders, a barrel of a chest */
    const bg = ctx.createLinearGradient(-S * 0.5, -S * 0.4, S * 0.5, S * 0.7);
    bg.addColorStop(0, U.rgbToCss(U.mixRgb(flesh, [255, 255, 255], 0.26)));
    bg.addColorStop(0.5, U.rgbToCss(flesh));
    bg.addColorStop(1, U.rgbToCss(U.shade(dark, -0.18)));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.52, -S * 0.34);
    ctx.quadraticCurveTo(-S * 0.64, S * 0.30, -S * 0.38, S * 0.86);
    ctx.quadraticCurveTo(0, S * 0.98, S * 0.38, S * 0.86);
    ctx.quadraticCurveTo(S * 0.64, S * 0.30, S * 0.52, -S * 0.34);
    ctx.quadraticCurveTo(0, -S * 0.64 - breathe * S, -S * 0.52, -S * 0.34);
    ctx.closePath();
    ctx.fill();
    // pectorals and a ribcage under the skin
    ctx.strokeStyle = U.rgbToCss(U.shade(dark, -0.05), 0.40);
    ctx.lineWidth = Math.max(0.5, S * 0.016);
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.04, -S * 0.34);
      ctx.quadraticCurveTo(sgn * S * 0.36, -S * 0.24, sgn * S * 0.40, S * 0.06);
      ctx.stroke();
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(sgn * S * 0.06, S * (0.14 + i * 0.15));
        ctx.quadraticCurveTo(sgn * S * 0.30, S * (0.10 + i * 0.16), sgn * S * 0.40, S * (0.26 + i * 0.14));
        ctx.stroke();
      }
    }
    // scales across the shoulders
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = U.rgbToCss(U.shade(dark, -0.1));
    ctx.lineWidth = Math.max(0.4, S * 0.010);
    for (let r2 = 0; r2 < 3; r2++) {
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(i * S * 0.13 + (r2 % 2) * S * 0.065, S * (-0.34 + r2 * 0.13),
                S * 0.072, Math.PI * 0.12, Math.PI * 0.88);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* the arms: solid shapes, not strokes, with three claws on each hand */
    for (const sgn of [-1, 1]) {
      const k = sgn > 0 ? -0.08 : -0.44;
      ctx.fillStyle = U.rgbToCss(U.shade(flesh, k));
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.44, -S * 0.32);
      ctx.quadraticCurveTo(sgn * S * 0.96, -S * 0.04, sgn * S * 0.86, S * 0.54);
      ctx.lineTo(sgn * S * 0.60, S * 0.56);
      ctx.quadraticCurveTo(sgn * S * 0.70, S * 0.06, sgn * S * 0.30, -S * 0.18);
      ctx.closePath();
      ctx.fill();
      // an edge down the outside, so the arm is not the body's own outline
      ctx.strokeStyle = U.rgbToCss(U.shade(dark, -0.35), 0.65);
      ctx.lineWidth = Math.max(0.4, S * 0.012);
      ctx.stroke();
      // the hand
      ctx.fillStyle = U.rgbToCss(U.shade(flesh, k - 0.10));
      ctx.beginPath();
      ctx.ellipse(sgn * S * 0.73, S * 0.60, S * 0.145, S * 0.115, sgn * 0.2, 0, TAU);
      ctx.fill();
      for (let i = -1; i <= 1; i++) {
        ctx.fillStyle = U.rgbToCss([226, 232, 226], 0.95);
        const cx = sgn * S * (0.72 + i * 0.075), cy = S * 0.68;
        ctx.beginPath();
        ctx.moveTo(cx - sgn * S * 0.020, cy);
        ctx.quadraticCurveTo(cx + sgn * S * 0.045, cy + S * 0.075, cx + sgn * S * 0.010, cy + S * 0.125);
        ctx.quadraticCurveTo(cx - sgn * S * 0.006, cy + S * 0.070, cx - sgn * S * 0.038, cy + S * 0.016);
        ctx.closePath();
        ctx.fill();
      }
    }

    /* the head, and then the face under it */
    ctx.save();
    ctx.translate(0, -S * 0.66);
    ctx.rotate(sway);

    // the cranium: a smooth mass, lit from the upper left
    const hg = ctx.createRadialGradient(-S * 0.12, -S * 0.20, S * 0.03, 0, -S * 0.02, S * 0.46);
    hg.addColorStop(0, U.rgbToCss(U.mixRgb(flesh, [255, 255, 255], 0.44)));
    hg.addColorStop(0.6, U.rgbToCss(flesh));
    hg.addColorStop(1, U.rgbToCss(U.shade(dark, -0.05)));
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.33, S * 0.04);
    ctx.quadraticCurveTo(-S * 0.42, -S * 0.44, -S * 0.10, -S * 0.62);
    ctx.quadraticCurveTo(S * 0.16, -S * 0.72, S * 0.30, -S * 0.40);
    ctx.quadraticCurveTo(S * 0.40, -S * 0.16, S * 0.33, S * 0.04);
    ctx.quadraticCurveTo(S * 0.26, S * 0.26, 0, S * 0.28);
    ctx.quadraticCurveTo(-S * 0.26, S * 0.26, -S * 0.33, S * 0.04);
    ctx.closePath();
    ctx.fill();
    // the ridges over the crown
    ctx.strokeStyle = U.rgbToCss(U.shade(dark, 0.10), 0.34);
    ctx.lineWidth = Math.max(0.4, S * 0.012);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * S * 0.13 - S * 0.04, -S * 0.56);
      ctx.quadraticCurveTo(i * S * 0.20, -S * 0.26, i * S * 0.14, -S * 0.04);
      ctx.stroke();
    }
    // the brow: one heavy shelf across, which is what the eyes sit under
    ctx.fillStyle = U.rgbToCss(U.shade(flesh, -0.20), 0.9);
    ctx.beginPath();
    ctx.moveTo(-S * 0.30, -S * 0.10);
    ctx.quadraticCurveTo(0, -S * 0.24, S * 0.30, -S * 0.10);
    ctx.quadraticCurveTo(0, -S * 0.06, -S * 0.30, -S * 0.10);
    ctx.closePath();
    ctx.fill();

    // the eyes, which do not blink
    for (const sx of [-1, 1]) {
      const ex = sx * S * 0.150, ey = -S * 0.020;
      bloom(ctx, ex, ey, S * 0.085, eyeC, 0.9);
      ctx.fillStyle = U.rgbToCss(U.shade(dark, -0.4));
      ctx.beginPath();
      ctx.ellipse(ex, ey, S * 0.085, S * 0.065, sx * 0.15, 0, TAU);
      ctx.fill();
      const eg = ctx.createRadialGradient(ex - sx * S * 0.015, ey - S * 0.015, S * 0.004,
                                          ex, ey, S * 0.070);
      eg.addColorStop(0, U.rgbToCss(U.mixRgb(eyeC, [255, 255, 255], 0.70)));
      eg.addColorStop(0.6, U.rgbToCss(eyeC));
      eg.addColorStop(1, U.rgbToCss(U.shade(eyeC, -0.55)));
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.ellipse(ex, ey, S * 0.066, S * 0.050, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#0a0410';
      ctx.beginPath();
      ctx.ellipse(ex, ey, S * 0.014, S * 0.042, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.ellipse(ex - S * 0.022, ey - S * 0.020, S * 0.014, S * 0.008, -0.5, 0, TAU);
      ctx.fill();
    }

    /* and the face: seven of them, dark against the chest, hanging past the
       jaw. Drawn last so nothing is in front of them, and each one gets a
       highlight down its upper edge so seven overlapping tentacles do not
       merge into one shape. */
    const suck = [];
    for (let i = 0; i < 7; i++) {
      const u = (i - 3) / 3;
      const len = S * (1.14 - Math.abs(u) * 0.26);
      const wide = S * (0.34 - Math.abs(u) * 0.060);
      const ang = Math.PI * 0.5 + u * 0.62;
      const curl = (u < 0 ? -1 : 1) * (0.14 + Math.abs(u) * 0.26);
      /* Lit off the flesh rather than off the shadow. Shading these toward the
         body's dark colour made seven separate limbs into one black smear,
         which is the opposite of the point — the face is the thing you are
         supposed to be able to count. */
      tentacle(ctx, u * S * 0.150, S * 0.08, len, wide, ang, curl, t, i * 1.3,
               U.mixRgb(flesh, [255, 255, 255], 0.14 - Math.abs(u) * 0.10),
               U.shade(flesh, -0.58), i % 2 === 0 ? suck : null);
    }
    ctx.fillStyle = U.rgbToCss(U.mixRgb(flesh, [255, 244, 236], 0.5), 0.65);
    suck.forEach(function (s) {
      ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.35, s[2] * 0.8), 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  /* ============================================================== KRAKEN */

  /* A squid, at the size a squid is not. Eight arms and two feeding
     tentacles, which is the anatomy that separates this from an octopus at a
     glance — the two long ones reach past everything else and end in clubs.

     The arms fan rather than curl. An arm that curls more than about half a
     turn closes on itself and eight of them together stop reading as arms and
     start reading as a wheel, which is exactly what the first pass of this
     did. */
  function kraken(ctx, S, t, c) {
    const skin = U.hexToRgb(c.c1), dark = U.hexToRgb(c.c2), eyeC = U.hexToRgb(c.c3);
    const back = [], front = [];

    /* the two feeding tentacles, longest and furthest back: thin most of the
       way, then a club at the end */
    for (const sgn of [-1, 1]) {
      const tip = tentacle(ctx, sgn * S * 0.10, S * 0.18, S * 1.95, S * 0.13,
                           Math.PI * 0.5 + sgn * 0.62, sgn * 0.30, t, sgn > 0 ? 0.4 : 2.2,
                           U.shade(skin, -0.42), U.shade(dark, -0.35), null);
      // the club
      ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.30));
      ctx.save();
      ctx.translate(tip.x, tip.y);
      ctx.rotate(Math.PI * 0.5 + sgn * 1.1);
      ctx.beginPath();
      ctx.ellipse(0, 0, S * 0.075, S * 0.030, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = U.rgbToCss(U.mixRgb(skin, [255, 240, 235], 0.55), 0.8);
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * S * 0.026, 0, S * 0.010, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    /* four arms behind the mantle, fanned wide and back */
    for (let i = 0; i < 4; i++) {
      const u = (i - 1.5) / 1.5;                     // -1 … 1
      tentacle(ctx, u * S * 0.24, S * 0.16, S * (1.18 + Math.abs(u) * 0.16),
               S * 0.26, Math.PI * 0.5 + u * 0.92, u * 0.42, t, i * 2.1 + 0.9,
               U.shade(skin, -0.38), U.shade(dark, -0.34), back);
    }
    ctx.fillStyle = U.rgbToCss(U.mixRgb(U.shade(skin, -0.3), [255, 240, 235], 0.4), 0.6);
    back.forEach(function (s) {
      ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.4, s[2] * 0.85), 0, TAU); ctx.fill();
    });

    /* the mantle: a long cone, point up, with the two fins at the top */
    const mg = ctx.createLinearGradient(-S * 0.42, -S * 0.9, S * 0.42, S * 0.2);
    mg.addColorStop(0, U.rgbToCss(U.mixRgb(skin, [255, 255, 255], 0.34)));
    mg.addColorStop(0.5, U.rgbToCss(skin));
    mg.addColorStop(1, U.rgbToCss(U.shade(dark, -0.15)));
    ctx.fillStyle = mg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.40, S * 0.10);
    ctx.quadraticCurveTo(-S * 0.48, -S * 0.70, 0, -S * 1.16);
    ctx.quadraticCurveTo(S * 0.48, -S * 0.70, S * 0.40, S * 0.10);
    ctx.quadraticCurveTo(0, S * 0.30, -S * 0.40, S * 0.10);
    ctx.closePath();
    ctx.fill();
    // the fins, one either side of the point
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = U.rgbToCss(U.shade(skin, sgn > 0 ? -0.22 : -0.36), 0.94);
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.12, -S * 0.98);
      ctx.quadraticCurveTo(sgn * S * 0.82, -S * 1.04, sgn * S * 0.56, -S * 0.56);
      ctx.quadraticCurveTo(sgn * S * 0.34, -S * 0.74, sgn * S * 0.12, -S * 0.98);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = U.rgbToCss(U.shade(dark, 0.08), 0.55);
      ctx.lineWidth = Math.max(0.4, S * 0.012);
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sgn * S * 0.14, -S * 0.96);
        ctx.quadraticCurveTo(sgn * S * (0.36 + i * 0.10), -S * (0.94 - i * 0.05),
                             sgn * S * (0.30 + i * 0.09), -S * (0.62 + i * 0.04));
        ctx.stroke();
      }
    }
    // chromatophores, denser toward the point
    const rm = rnd(0x4B41);
    ctx.save();
    ctx.globalAlpha = 0.30;
    for (let i = 0; i < 46; i++) {
      const v = rm();
      const y = -S * 1.02 + v * S * 1.10;
      const halfw = S * 0.40 * Math.sin(U.clamp((y + S * 1.12) / (S * 1.24), 0, 1) * Math.PI * 0.82);
      const x = (rm() - 0.5) * 2 * halfw * 0.9;
      ctx.fillStyle = U.rgbToCss(U.shade(dark, 0.12 + rm() * 0.3));
      ctx.beginPath();
      ctx.ellipse(x, y, S * (0.014 + rm() * 0.038), S * (0.011 + rm() * 0.024), rm() * 3, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // the funnel, under the head
    ctx.fillStyle = U.rgbToCss(U.shade(dark, 0.05));
    ctx.beginPath();
    ctx.ellipse(S * 0.06, S * 0.10, S * 0.11, S * 0.055, -0.35, 0, TAU);
    ctx.fill();

    /* four arms in front, fanned the other way so they cross the back four */
    for (let i = 0; i < 4; i++) {
      const u = (i - 1.5) / 1.5;
      tentacle(ctx, u * S * 0.17, S * 0.14, S * (1.34 + Math.abs(u) * 0.22),
               S * 0.33, Math.PI * 0.5 + u * 0.56, u * 0.55, t, i * 1.7 + 0.3,
               skin, U.shade(dark, -0.1), front);
    }
    ctx.fillStyle = U.rgbToCss(U.mixRgb(skin, [255, 240, 235], 0.66), 0.9);
    front.forEach(function (s) {
      ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.5, s[2]), 0, TAU); ctx.fill();
      ctx.save();
      ctx.fillStyle = U.rgbToCss(U.shade(dark, 0.1), 0.5);
      ctx.beginPath(); ctx.arc(s[0], s[1], Math.max(0.2, s[2] * 0.45), 0, TAU); ctx.fill();
      ctx.restore();
      ctx.fillStyle = U.rgbToCss(U.mixRgb(skin, [255, 240, 235], 0.66), 0.9);
    });

    /* the beak, down between the arms */
    ctx.fillStyle = U.rgbToCss(U.shade(dark, -0.6));
    ctx.beginPath();
    ctx.moveTo(-S * 0.11, S * 0.14);
    ctx.quadraticCurveTo(-S * 0.02, S * 0.42, S * 0.01, S * 0.50);
    ctx.quadraticCurveTo(S * 0.05, S * 0.40, S * 0.12, S * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = U.rgbToCss([250, 246, 236], 0.85);
    ctx.beginPath();
    ctx.moveTo(-S * 0.05, S * 0.22);
    ctx.lineTo(S * 0.01, S * 0.46);
    ctx.lineTo(S * 0.06, S * 0.22);
    ctx.closePath();
    ctx.fill();

    /* the eye. One of them, huge, and it is looking at you. */
    const ex = -S * 0.29, ey = -S * 0.20;
    bloom(ctx, ex, ey, S * 0.17, eyeC, 0.7);
    // the lid, a fold of the same skin, so the eye sits in the head
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.28));
    ctx.beginPath();
    ctx.ellipse(ex, ey, S * 0.235, S * 0.20, -0.2, 0, TAU);
    ctx.fill();
    const eg = ctx.createRadialGradient(ex - S * 0.04, ey - S * 0.05, S * 0.01, ex, ey, S * 0.19);
    eg.addColorStop(0, U.rgbToCss(U.mixRgb(eyeC, [255, 255, 255], 0.78)));
    eg.addColorStop(0.55, U.rgbToCss(eyeC));
    eg.addColorStop(1, U.rgbToCss(U.shade(eyeC, -0.62)));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(ex, ey, S * 0.19, S * 0.155, -0.2, 0, TAU);
    ctx.fill();
    // the horizontal slit a cephalopod actually has
    ctx.fillStyle = '#08060c';
    ctx.beginPath();
    ctx.ellipse(ex, ey, S * 0.135, S * 0.032, -0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(ex - S * 0.06, ey - S * 0.06, S * 0.036, S * 0.021, -0.5, 0, TAU);
    ctx.fill();
  }

  /* ========================================================== THE TWO WHO
     are people, and are drawn as people: the game already has one of those in
     the tier below, and the joke of the tier is that two of the eight are
     simply somebody. */

  function person(ctx, S, t, c, kind) {
    const coat = U.hexToRgb(c.c1), skin = U.hexToRgb(c.c2), halo = U.hexToRgb(c.c3);
    const dkCoat = U.shade(coat, -0.46), ltCoat = U.mixRgb(coat, [255, 255, 255], 0.22);
    const hair = kind === 'sun' ? [58, 38, 24] : [24, 22, 28];
    const breath = Math.sin(t * 1.1) * 0.006;

    /* what is behind them, which is the only part that is not ordinary */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (kind === 'sun') {
      // a corona, with real flares off it
      const g = ctx.createRadialGradient(0, -S * 0.34, S * 0.10, 0, -S * 0.34, S * 1.5);
      g.addColorStop(0, U.rgbToCss(halo, 0.40));
      g.addColorStop(0.4, U.rgbToCss(halo, 0.12));
      g.addColorStop(1, U.rgbToCss(halo, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-S * 1.6, -S * 1.9, S * 3.2, S * 3.2);
      for (let i = 0; i < 30; i++) {
        const a = i * TAU / 30 + t * 0.08;
        const L = S * (0.78 + 0.36 * Math.abs(Math.sin(t * 0.9 + i * 1.7)));
        ctx.strokeStyle = U.rgbToCss(halo, i % 3 === 0 ? 0.30 : 0.16);
        ctx.lineWidth = Math.max(0.5, S * (i % 3 === 0 ? 0.020 : 0.010));
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * S * 0.60, -S * 0.34 + Math.sin(a) * S * 0.60);
        ctx.lineTo(Math.cos(a) * L, -S * 0.34 + Math.sin(a) * L);
        ctx.stroke();
      }
    } else {
      // coins, in orbit, two rings of them at different tilts
      for (let ring = 0; ring < 2; ring++) {
        for (let i = 0; i < 11; i++) {
          const a = t * (ring ? -0.38 : 0.5) + i * TAU / 11 + ring * 0.4;
          const rr = S * (ring ? 1.14 : 0.92) * (1 + 0.06 * Math.sin(i * 2.1));
          const x = Math.cos(a) * rr;
          const y = -S * 0.30 + Math.sin(a) * rr * (ring ? 0.20 : 0.36);
          const face = Math.abs(Math.cos(a + 1.2));
          ctx.fillStyle = U.rgbToCss(halo, 0.24 + face * 0.6);
          ctx.beginPath();
          ctx.ellipse(x, y, S * 0.052 * (0.22 + face * 0.78), S * 0.052, 0, 0, TAU);
          ctx.fill();
        }
      }
    }
    ctx.restore();

    /* And then a person. Not a cone with a face on it: shoulders that are
       wider than the waist, arms that are their own shapes rather than the
       silhouette's edge, legs under the coat and hands at the ends of the
       sleeves. Everything below is drawn back-to-front — far arm, legs,
       body, near arm, head — so the overlaps are the ones a body has. */

    // the far arm, behind the torso
    ctx.strokeStyle = U.rgbToCss(U.shade(coat, -0.52));
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1.2, S * 0.105);
    ctx.beginPath();
    ctx.moveTo(-S * 0.20, -S * 0.30);
    ctx.quadraticCurveTo(-S * 0.36, S * 0.00, -S * 0.30, S * 0.30);
    ctx.stroke();
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.30));
    ctx.beginPath();
    ctx.ellipse(-S * 0.30, S * 0.345, S * 0.044, S * 0.054, -0.15, 0, TAU);
    ctx.fill();

    // legs, in trousers, and shoes
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = U.rgbToCss(U.shade(coat, sgn > 0 ? -0.60 : -0.70));
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.04, S * 0.36);
      ctx.lineTo(sgn * S * 0.21, S * 0.38);
      ctx.quadraticCurveTo(sgn * S * 0.20, S * 0.72, sgn * S * 0.17, S * 0.92);
      ctx.lineTo(sgn * S * 0.05, S * 0.92);
      ctx.quadraticCurveTo(sgn * S * 0.06, S * 0.68, sgn * S * 0.04, S * 0.36);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = U.rgbToCss(U.shade(coat, -0.80));
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.04, S * 0.90);
      ctx.lineTo(sgn * S * 0.18, S * 0.90);
      ctx.quadraticCurveTo(sgn * S * 0.26, S * 0.94, sgn * S * 0.25, S * 0.98);
      ctx.lineTo(sgn * S * 0.03, S * 0.98);
      ctx.closePath();
      ctx.fill();
    }

    // the torso: shoulders wide, waist in, coat hem at the hip
    const tg = ctx.createLinearGradient(-S * 0.30, -S * 0.40, S * 0.30, S * 0.40);
    tg.addColorStop(0, U.rgbToCss(ltCoat));
    tg.addColorStop(0.46, U.rgbToCss(coat));
    tg.addColorStop(1, U.rgbToCss(dkCoat));
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.055, -S * 0.40);
    ctx.quadraticCurveTo(-S * 0.24, -S * 0.37, -S * 0.265, -S * 0.24);   // shoulder
    ctx.quadraticCurveTo(-S * 0.235, S * 0.02, -S * 0.215, S * 0.20);    // waist
    ctx.quadraticCurveTo(-S * 0.24, S * 0.36, -S * 0.23, S * 0.44);      // hem
    ctx.lineTo(S * 0.23, S * 0.44);
    ctx.quadraticCurveTo(S * 0.24, S * 0.36, S * 0.215, S * 0.20);
    ctx.quadraticCurveTo(S * 0.235, S * 0.02, S * 0.265, -S * 0.24);
    ctx.quadraticCurveTo(S * 0.24, -S * 0.37, S * 0.055, -S * 0.40);
    ctx.closePath();
    ctx.fill();

    // the shirt in the V of the coat, and the lapels over it
    ctx.fillStyle = U.rgbToCss(U.mixRgb([245, 247, 250], coat, kind === 'sun' ? 0.12 : 0.04));
    ctx.beginPath();
    ctx.moveTo(-S * 0.075, -S * 0.395);
    ctx.lineTo(S * 0.075, -S * 0.395);
    ctx.lineTo(S * 0.045, S * 0.10);
    ctx.lineTo(-S * 0.045, S * 0.10);
    ctx.closePath();
    ctx.fill();
    if (kind === 'coin') {
      // a tie, because he is the one who is here about money
      ctx.fillStyle = U.rgbToCss(U.shade(halo, -0.12));
      ctx.beginPath();
      ctx.moveTo(-S * 0.028, -S * 0.335);
      ctx.lineTo(S * 0.028, -S * 0.335);
      ctx.lineTo(S * 0.036, S * 0.08);
      ctx.lineTo(0, S * 0.14);
      ctx.lineTo(-S * 0.036, S * 0.08);
      ctx.closePath();
      ctx.fill();
    }
    for (const sgn of [-1, 1]) {
      ctx.fillStyle = U.rgbToCss(sgn > 0 ? U.shade(coat, -0.16) : U.mixRgb(coat, [255, 255, 255], 0.10));
      ctx.beginPath();
      ctx.moveTo(sgn * S * 0.055, -S * 0.40);
      ctx.lineTo(sgn * S * 0.185, -S * 0.36);
      ctx.lineTo(sgn * S * 0.105, S * 0.06);
      ctx.lineTo(sgn * S * 0.045, S * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    // buttons down the front
    ctx.fillStyle = U.rgbToCss(U.mixRgb(halo, [255, 255, 255], 0.35), 0.9);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(S * 0.055, S * (0.10 + i * 0.10), S * 0.017, 0, TAU);
      ctx.fill();
    }

    // the near arm, in front, and a hand at the end of it
    ctx.strokeStyle = U.rgbToCss(U.shade(coat, -0.18));
    ctx.lineWidth = Math.max(1.3, S * 0.112);
    ctx.beginPath();
    ctx.moveTo(S * 0.22, -S * 0.32);
    if (kind === 'coin') {
      // held out, offering the coin
      ctx.quadraticCurveTo(S * 0.40, -S * 0.10, S * 0.33, S * 0.10);
    } else {
      ctx.quadraticCurveTo(S * 0.38, -S * 0.02, S * 0.31, S * 0.30);
    }
    ctx.stroke();
    /* The cuff. A round-capped stroke this short is a disc, not a cuff — it
       came out as a white golf ball on the end of the sleeve — so it is a
       band across the sleeve with a butt cap instead. */
    const hx = kind === 'coin' ? S * 0.33 : S * 0.31;
    const hy = kind === 'coin' ? S * 0.08 : S * 0.27;
    ctx.save();
    ctx.lineCap = 'butt';
    ctx.strokeStyle = U.rgbToCss(U.mixRgb([245, 247, 250], coat, 0.16));
    ctx.lineWidth = Math.max(0.6, S * 0.020);
    ctx.beginPath();
    ctx.moveTo(hx - S * 0.055, hy - S * 0.012);
    ctx.lineTo(hx + S * 0.052, hy - S * 0.030);
    ctx.stroke();
    ctx.restore();
    ctx.lineCap = 'round';
    ctx.fillStyle = U.rgbToCss(skin);
    ctx.beginPath();
    ctx.ellipse(hx + S * 0.006, hy + S * 0.040, S * 0.048, S * 0.058, 0.2, 0, TAU);
    ctx.fill();
    // the thumb, so a hand is a hand rather than a bead
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.16));
    ctx.beginPath();
    ctx.ellipse(hx - S * 0.036, hy + S * 0.030, S * 0.020, S * 0.032, -0.5, 0, TAU);
    ctx.fill();
    if (kind === 'coin') {
      // the coin itself, edge on, held between finger and thumb
      ctx.save();
      ctx.translate(hx + S * 0.045, hy + S * 0.020);
      ctx.rotate(0.5);
      const cg = ctx.createLinearGradient(-S * 0.08, 0, S * 0.08, 0);
      cg.addColorStop(0, U.rgbToCss(U.shade(halo, -0.35)));
      cg.addColorStop(0.5, U.rgbToCss(U.mixRgb(halo, [255, 255, 255], 0.55)));
      cg.addColorStop(1, U.rgbToCss(U.shade(halo, -0.2)));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.ellipse(0, 0, S * 0.024, S * 0.078, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // neck, and the shadow the jaw casts on it
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.34));
    ctx.beginPath();
    ctx.moveTo(-S * 0.058, -S * 0.50);
    ctx.lineTo(S * 0.058, -S * 0.50);
    ctx.lineTo(S * 0.050, -S * 0.375);
    ctx.lineTo(-S * 0.050, -S * 0.375);
    ctx.closePath();
    ctx.fill();

    /* the head. Not an oval with two dots: a jaw that narrows to a chin, a
       brow, a nose with a shadow under it, ears, and hair with an edge. */
    ctx.save();
    ctx.translate(0, -S * 0.585 + breath * S);
    const fg = ctx.createLinearGradient(-S * 0.14, -S * 0.14, S * 0.12, S * 0.14);
    fg.addColorStop(0, U.rgbToCss(U.mixRgb(skin, [255, 255, 255], 0.30)));
    fg.addColorStop(0.6, U.rgbToCss(skin));
    fg.addColorStop(1, U.rgbToCss(U.shade(skin, -0.30)));
    // ears first, so the head sits over them
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.16));
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * S * 0.135, S * 0.006, S * 0.026, S * 0.040, 0, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-S * 0.132, -S * 0.030);
    ctx.quadraticCurveTo(-S * 0.140, -S * 0.150, 0, -S * 0.160);
    ctx.quadraticCurveTo(S * 0.140, -S * 0.150, S * 0.132, -S * 0.030);
    ctx.quadraticCurveTo(S * 0.122, S * 0.086, 0, S * 0.128);          // jaw to chin
    ctx.quadraticCurveTo(-S * 0.122, S * 0.086, -S * 0.132, -S * 0.030);
    ctx.closePath();
    ctx.fill();
    // hair: a mass with a parting, not a cap
    ctx.fillStyle = U.rgbToCss(hair);
    ctx.beginPath();
    ctx.moveTo(-S * 0.140, -S * 0.020);
    ctx.quadraticCurveTo(-S * 0.150, -S * 0.175, S * 0.010, -S * 0.176);
    ctx.quadraticCurveTo(S * 0.150, -S * 0.172, S * 0.140, -S * 0.024);
    ctx.quadraticCurveTo(S * 0.118, -S * 0.086, S * 0.060, -S * 0.096);
    ctx.quadraticCurveTo(-S * 0.030, -S * 0.112, -S * 0.098, -S * 0.062);
    ctx.quadraticCurveTo(-S * 0.128, -S * 0.040, -S * 0.140, -S * 0.020);
    ctx.closePath();
    ctx.fill();
    // brows
    ctx.strokeStyle = U.rgbToCss(U.shade(hair, 0.10));
    ctx.lineWidth = Math.max(0.5, S * 0.013);
    ctx.lineCap = 'round';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * S * 0.028, -S * 0.054);
      ctx.quadraticCurveTo(sx * S * 0.062, -S * 0.066, sx * S * 0.088, -S * 0.050);
      ctx.stroke();
    }
    // eyes: white, iris, pupil, and a catch light, at this size all four read
    for (const sx of [-1, 1]) {
      const ex = sx * S * 0.058, ey = -S * 0.020;
      ctx.fillStyle = '#f2f4f8';
      ctx.beginPath();
      ctx.ellipse(ex, ey, S * 0.030, S * 0.019, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = U.rgbToCss(kind === 'sun' ? [96, 66, 34] : [42, 58, 82]);
      ctx.beginPath();
      ctx.arc(ex + sx * S * 0.004, ey, S * 0.0155, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#100c0a';
      ctx.beginPath();
      ctx.arc(ex + sx * S * 0.004, ey, S * 0.0075, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(ex + sx * S * 0.001 - S * 0.008, ey - S * 0.007, S * 0.004, 0, TAU);
      ctx.fill();
      // the upper lid, a line rather than a shape
      ctx.strokeStyle = U.rgbToCss(U.shade(skin, -0.55), 0.75);
      ctx.lineWidth = Math.max(0.4, S * 0.006);
      ctx.beginPath();
      ctx.moveTo(ex - S * 0.030, ey - S * 0.012);
      ctx.quadraticCurveTo(ex, ey - S * 0.026, ex + S * 0.030, ey - S * 0.012);
      ctx.stroke();
    }
    // nose: no outline, only the shadow one side of it
    ctx.fillStyle = U.rgbToCss(U.shade(skin, -0.22), 0.75);
    ctx.beginPath();
    ctx.moveTo(-S * 0.006, -S * 0.014);
    ctx.quadraticCurveTo(-S * 0.024, S * 0.030, -S * 0.006, S * 0.040);
    ctx.quadraticCurveTo(S * 0.010, S * 0.042, S * 0.014, S * 0.030);
    ctx.quadraticCurveTo(S * 0.008, S * 0.006, S * 0.004, -S * 0.014);
    ctx.closePath();
    ctx.fill();
    // mouth
    ctx.strokeStyle = U.rgbToCss(U.shade(skin, -0.62), 0.85);
    ctx.lineWidth = Math.max(0.4, S * 0.009);
    ctx.beginPath();
    ctx.moveTo(-S * 0.034, S * 0.066);
    ctx.quadraticCurveTo(0, S * (kind === 'sun' ? 0.082 : 0.074), S * 0.034, S * 0.066);
    ctx.stroke();
    ctx.restore();

    /* and the halo, in front and behind at once — the front arc is drawn over
       the head, the back arc under it, which is the only way a flat ring
       reads as a ring around something rather than as a hoop in front of it */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = U.rgbToCss(halo, 0.55);
    ctx.lineWidth = Math.max(0.6, S * 0.017);
    ctx.beginPath();
    ctx.ellipse(0, -S * 0.80, S * 0.20, S * 0.055, 0, 0, TAU);
    ctx.stroke();
    bloom(ctx, 0, -S * 0.80, S * 0.16, halo, 0.35);
    ctx.restore();
  }

  /* ================================================================ entry */

  const DRAW = {
    ufo: ufo, zeus: zeus, earth: earth, kaiju: kaiju,
    cthulhu: cthulhu, kraken: kraken,
    sun: function (ctx, S, t, c) { person(ctx, S, t, c, 'sun'); },
    coin: function (ctx, S, t, c) { person(ctx, S, t, c, 'coin'); }
  };

  /* The rainbow the tier is drawn in, laid over the top of whatever the
     subject's own colours are. Not a tint — a thin sweep across it, so an
     Earth still looks like an Earth and still says which tier it is. */
  function sheen(ctx, S, t, seed) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) {
      const a = t * 0.19 + i / 5 + seed;
      const col = VF.rarities.hueRgb(((a % 1) + 1) % 1);
      const y = -S * 1.4 + ((a * 0.7 % 1) + 1) % 1 * S * 2.8;
      const g = ctx.createLinearGradient(0, y - S * 0.35, 0, y + S * 0.35);
      g.addColorStop(0, U.rgbToCss(col, 0));
      g.addColorStop(0.5, U.rgbToCss(col, 0.075));
      g.addColorStop(1, U.rgbToCss(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-S * 2, y - S * 0.35, S * 4, S * 0.7);
    }
    ctx.restore();
  }

  function draw(ctx, fish, size, opts) {
    opts = opts || {};
    const art = fish.art || {};
    const kind = art.astral || 'ufo';
    const fn = DRAW[kind];
    if (!fn) return;
    const t = opts.time === undefined ? 0 : opts.time;
    ctx.save();
    try {
      fn(ctx, size, t, art);
      if (opts.sheen !== false) sheen(ctx, size, t, (art.seed || 0) * 0.13);
    } catch (e) { /* one bad subject must not take the frame down */ }
    ctx.restore();
  }

  /* How much of the box this one wants. The two that are supposed to be too
     big for the frame say so here and everything that draws them honours it. */
  function fill(fish) {
    return (fish.art && fish.art.fill) || 1;
  }

  VF.astralArt = { draw: draw, fill: fill, kinds: Object.keys(DRAW) };
})(window.VF = window.VF || {});
