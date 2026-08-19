/* VOID FISHING — rod rendering.
   Shared by the scene (where geometry comes from the angler's hand and the
   bend under load) and the shop (where the rod is laid out flat in a box).
   `art.style` adds the flourish that makes each tier visually distinct. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  function quadAt(p0, p1, p2, k) {
    const m = 1 - k;
    return m * m * p0 + 2 * m * k * p1 + k * k * p2;
  }

  /* g: { bx, by, cx, cy, tx, ty, len, angle } — butt, control, tip. */
  function draw(ctx, rod, g, t, opts) {
    opts = opts || {};
    const art = rod.art;
    // stroke weight tracks rod length; `weight` compensates for canvases
    // drawn at a higher resolution than they are displayed
    const scale = U.clamp(g.len / 300, 0.55, 1.35) * (opts.weight || 1);
    const tipRgb = U.hexToRgb(art.tip);

    if (art.glow > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgbToCss(tipRgb, 0.13 * art.glow);
      ctx.lineWidth = Math.max(4, 7 * scale);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(g.bx, g.by);
      ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
      ctx.stroke();
      ctx.restore();
    }

    /* tapered blank: three passes, each starting further along the rod */
    const w = Math.max(1, 3.2 * scale);
    const passes = [[w, art.c2, 0], [w * 0.62, art.c1, 0.18], [w * 0.28, art.tip, 0.45]];
    for (let i = 0; i < passes.length; i++) {
      const pw = passes[i][0], col = passes[i][1], from = passes[i][2];
      ctx.strokeStyle = col;
      ctx.lineWidth = Math.max(0.7, pw);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(U.lerp(g.bx, g.tx, from), U.lerp(g.by, g.ty, from));
      ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
      ctx.stroke();
    }

    drawStyle(ctx, art, g, t, scale, tipRgb);

    /* grip */
    const a = g.angle;
    ctx.strokeStyle = art.grip;
    ctx.lineWidth = Math.max(2.4, 5.5 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(g.bx, g.by);
    ctx.lineTo(g.bx + Math.cos(a) * g.len * 0.19, g.by + Math.sin(a) * g.len * 0.19);
    ctx.stroke();

    /* reel seat and spool */
    const rr = Math.max(2.6, 5.2 * scale);
    const rx = g.bx + Math.cos(a) * g.len * 0.22 - Math.sin(a) * rr;
    const ry = g.by + Math.sin(a) * g.len * 0.22 + Math.cos(a) * rr;
    ctx.fillStyle = art.c2;
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.fill();
    ctx.strokeStyle = art.tip;
    ctx.lineWidth = Math.max(0.8, 1.1 * scale);
    ctx.beginPath(); ctx.arc(rx, ry, rr, 0, TAU); ctx.stroke();
    const spin = opts.spin === undefined ? t * 0.4 : opts.spin;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(spin) * rr * 0.8, ry + Math.sin(spin) * rr * 0.8);
    ctx.stroke();

    /* line guides */
    if (art.style !== 'plain') {
      ctx.fillStyle = art.tip;
      for (let i = 1; i <= 3; i++) {
        const k = 0.30 + i * 0.20;
        ctx.globalAlpha = 0.55 + art.glow * 0.4;
        ctx.beginPath();
        ctx.arc(quadAt(g.bx, g.cx, g.tx, k), quadAt(g.by, g.cy, g.ty, k),
                Math.max(1, 1.5 * scale), 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* Per-tier flourishes along the blank. */
  function drawStyle(ctx, art, g, t, scale, tipRgb) {
    const at = function (k) {
      return { x: quadAt(g.bx, g.cx, g.tx, k), y: quadAt(g.by, g.cy, g.ty, k) };
    };
    switch (art.style) {
      case 'wrap': {
        ctx.strokeStyle = art.tip;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = Math.max(0.7, 1.2 * scale);
        for (let i = 0; i < 5; i++) {
          const p = at(0.26 + i * 0.15);
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.6, 2.6 * scale), 0, TAU);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'runic': {
        ctx.strokeStyle = art.tip;
        ctx.lineWidth = Math.max(0.6, 1 * scale);
        for (let i = 0; i < 6; i++) {
          const p = at(0.20 + i * 0.13);
          const pulse = 0.35 + 0.35 * Math.sin(t * 1.6 + i);
          ctx.globalAlpha = pulse;
          const s = Math.max(1.4, 2.4 * scale);
          ctx.beginPath();
          ctx.moveTo(p.x - s, p.y - s); ctx.lineTo(p.x + s, p.y);
          ctx.lineTo(p.x - s, p.y + s);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'lunar': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.22);
        ctx.lineWidth = Math.max(1.6, 2.6 * scale);
        ctx.beginPath();
        ctx.moveTo(g.bx, g.by);
        ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'celestial': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const p = at(0.24 + i * 0.17);
          // keep the twinkle strictly positive: a negative radius throws
          const tw = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7);
          const r = Math.max(0.8, Math.max(1.6, 3.4 * scale) * tw);
          const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 1.9);
          grd.addColorStop(0, U.rgbToCss(tipRgb, 0.62));
          grd.addColorStop(0.4, U.rgbToCss(tipRgb, 0.16));
          grd.addColorStop(1, U.rgbToCss(tipRgb, 0));
          ctx.fillStyle = grd;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.9, 0, TAU); ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'glass': {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = Math.max(0.5, 0.9 * scale);
        ctx.beginPath();
        ctx.moveTo(U.lerp(g.bx, g.tx, 0.16), U.lerp(g.by, g.ty, 0.16));
        ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
        ctx.stroke();
        break;
      }
      case 'void': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 7; i++) {
          const k = ((t * 0.14 + i / 7) % 1) * 0.85 + 0.12;
          const p = at(k);
          ctx.fillStyle = U.rgbToCss(tipRgb, 0.5 * Math.sin(k * Math.PI));
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.9, 1.7 * scale), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        break;
      }
      case 'singularity': {
        ctx.save();
        const r = Math.max(3, 6 * scale);
        const grd = ctx.createRadialGradient(g.tx, g.ty, 0, g.tx, g.ty, r * 2.6);
        grd.addColorStop(0, 'rgba(0,0,0,0.95)');
        grd.addColorStop(0.55, U.rgbToCss(tipRgb, 0.45));
        grd.addColorStop(1, U.rgbToCss(tipRgb, 0));
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(g.tx, g.ty, r * 2.6, 0, TAU); ctx.fill();
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.7);
        ctx.lineWidth = Math.max(0.6, 1 * scale);
        ctx.beginPath();
        ctx.ellipse(g.tx, g.ty, r * 1.9, r * 0.7, t * 0.7, 0, TAU);
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'glitch': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const off = Math.max(1, 2 * scale);
        [['#ff2d55', -off], ['#66ffe0', off]].forEach(function (pair) {
          ctx.strokeStyle = pair[0];
          ctx.globalAlpha = 0.4 + 0.25 * Math.sin(t * 9 + (pair[1] > 0 ? 1 : 0));
          ctx.lineWidth = Math.max(0.7, 1.3 * scale);
          ctx.beginPath();
          ctx.moveTo(g.bx + pair[1], g.by);
          ctx.quadraticCurveTo(g.cx + pair[1], g.cy, g.tx + pair[1], g.ty);
          ctx.stroke();
        });
        ctx.restore();
        break;
      }
    }
  }

  /* Lay a rod out across a box, butt at the lower left, tip at the upper
     right, with a gentle idle flex. Used for shop previews. */
  function preview(ctx, rod, w, h, t) {
    const pad = w * 0.035;
    const bx = pad, by = h * 0.86;
    const tx = w - pad, ty = h * 0.16;
    const len = Math.hypot(tx - bx, ty - by);
    const angle = Math.atan2(ty - by, tx - bx);
    const flex = 0.10 + Math.sin(t * 0.8) * 0.02;
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const g = {
      bx: bx, by: by,
      cx: (bx + tx) / 2 + nx * len * flex * 0.45,
      cy: (by + ty) / 2 + ny * len * flex * 0.45,
      tx: tx, ty: ty, len: len, angle: angle
    };
    draw(ctx, rod, g, t, { spin: t * 0.5, weight: 2.1 });

    /* a short length of line hanging from the tip sells it as a rod */
    ctx.strokeStyle = U.rgbToCss(U.hexToRgb(rod.art.tip), 0.32);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + w * 0.02, ty + h * 0.30, tx - w * 0.03, h * 0.92);
    ctx.stroke();
  }

  VF.rodArt = { draw: draw, preview: preview, quadAt: quadAt };
})(window.VF = window.VF || {});
