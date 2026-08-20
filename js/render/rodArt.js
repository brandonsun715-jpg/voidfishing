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

  /* Point and tangent anywhere along the blank. */
  function ptAt(g, k) {
    const m = 1 - k;
    return {
      x: m * m * g.bx + 2 * m * k * g.cx + k * k * g.tx,
      y: m * m * g.by + 2 * m * k * g.cy + k * k * g.ty,
      dx: 2 * m * (g.cx - g.bx) + 2 * k * (g.tx - g.cx),
      dy: 2 * m * (g.cy - g.by) + 2 * k * (g.ty - g.cy)
    };
  }

  /* A tapered ribbon along the blank between two k values. Widths are in
     pixels and interpolate along the run. */
  function taper(ctx, g, k0, k1, w0, w1, steps) {
    steps = steps || 14;
    const lhs = [], rhs = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const k = k0 + (k1 - k0) * u;
      const p = ptAt(g, k);
      const m = Math.hypot(p.dx, p.dy) || 1;
      const w = (w0 + (w1 - w0) * u) * 0.5;
      const nx = -p.dy / m * w, ny = p.dx / m * w;
      lhs.push(p.x + nx, p.y + ny);
      rhs.push(p.x - nx, p.y - ny);
    }
    ctx.beginPath();
    ctx.moveTo(lhs[0], lhs[1]);
    for (let i = 2; i < lhs.length; i += 2) ctx.lineTo(lhs[i], lhs[i + 1]);
    for (let i = rhs.length - 2; i >= 0; i -= 2) ctx.lineTo(rhs[i], rhs[i + 1]);
    ctx.closePath();
  }

  /* Where the guides sit. They crowd together toward the tip on a real rod,
     because that is where the blank bends most. */
  const GUIDES = [0.30, 0.45, 0.58, 0.695, 0.795, 0.88, 0.95];

  /* g: { bx, by, cx, cy, tx, ty, len, angle } — butt, control, tip. */
  function draw(ctx, rod, g, t, opts) {
    opts = opts || {};
    const art = rod.art;
    // stroke weight tracks rod length; `weight` compensates for canvases
    // drawn at a higher resolution than they are displayed
    const scale = U.clamp(g.len / 300, 0.55, 1.35) * (opts.weight || 1);
    const tipRgb = U.hexToRgb(art.tip);
    const c1 = U.hexToRgb(art.c1), c2 = U.hexToRgb(art.c2);
    const gripRgb = U.hexToRgb(art.grip);
    const under = opts.under === undefined ? 1 : opts.under;   // which side the reel hangs

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

    /* ---- the blank: one continuous taper from a thick butt to a hair tip ---- */
    const wButt = Math.max(1.8, 5.0 * scale);
    const wTip = Math.max(0.55, 0.85 * scale);
    const blank = ctx.createLinearGradient(g.bx, g.by, g.tx, g.ty);
    blank.addColorStop(0, U.rgbToCss(U.shade(c2, -0.15)));
    blank.addColorStop(0.30, U.rgbToCss(c2));
    blank.addColorStop(0.72, U.rgbToCss(c1));
    blank.addColorStop(1, U.rgbToCss(U.mixRgb(c1, tipRgb, 0.75)));
    ctx.fillStyle = blank;
    taper(ctx, g, 0, 1, wButt, wTip, 12);
    ctx.fill();

    /* a specular line along the lit edge — the thing that makes a blank look
       like lacquered graphite rather than a drawn stroke */
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(c1, [255, 255, 255], 0.55));
    ctx.lineWidth = Math.max(0.5, 0.9 * scale);
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const k = 0.06 + (i / 10) * 0.92;
      const p = ptAt(g, k);
      const m = Math.hypot(p.dx, p.dy) || 1;
      const w = U.lerp(wButt, wTip, k) * 0.26;
      const x = p.x + p.dy / m * w * under, y = p.y - p.dx / m * w * under;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();

    drawStyle(ctx, art, g, t, scale, tipRgb);

    /* ---- guides ---- */
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(tipRgb, [220, 235, 250], 0.35), 0.72);
    for (let i = 0; i < GUIDES.length; i++) {
      const k = GUIDES[i];
      const p = ptAt(g, k);
      const m = Math.hypot(p.dx, p.dy) || 1;
      const nx = -p.dy / m * under, ny = p.dx / m * under;
      const rr = Math.max(0.8, U.lerp(3.0, 1.1, k) * scale);
      const foot = rr * 1.35;
      ctx.lineWidth = Math.max(0.4, 0.7 * scale);
      // the foot that binds the guide to the blank
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + nx * foot, p.y + ny * foot);
      ctx.stroke();
      // the ring itself
      ctx.beginPath();
      ctx.ellipse(p.x + nx * (foot + rr * 0.7), p.y + ny * (foot + rr * 0.7),
                  rr, rr * 0.72, Math.atan2(p.dy, p.dx), 0, TAU);
      ctx.stroke();
    }
    // tip-top ring
    {
      const p = ptAt(g, 1);
      const m = Math.hypot(p.dx, p.dy) || 1;
      const rr = Math.max(0.8, 1.5 * scale);
      ctx.lineWidth = Math.max(0.4, 0.7 * scale);
      ctx.beginPath();
      ctx.ellipse(p.x + p.dx / m * rr * 0.8, p.y + p.dy / m * rr * 0.8,
                  rr, rr * 0.78, Math.atan2(p.dy, p.dx), 0, TAU);
      ctx.stroke();
    }

    /* ---- grip, reel seat, reel ---- */
    const a = g.angle;
    const cosA = Math.cos(a), sinA = Math.sin(a);
    const gripEnd = 0.20;

    // cork, fattest in the middle where a hand closes on it
    const gg = ctx.createLinearGradient(g.bx - sinA * wButt * under, g.by + cosA * wButt * under,
                                        g.bx + sinA * wButt * under, g.by - cosA * wButt * under);
    gg.addColorStop(0, U.rgbToCss(U.shade(gripRgb, -0.35)));
    gg.addColorStop(0.55, U.rgbToCss(U.shade(gripRgb, 0.18)));
    gg.addColorStop(1, U.rgbToCss(U.shade(gripRgb, -0.5)));
    ctx.fillStyle = gg;
    taper(ctx, g, 0, gripEnd * 0.55, wButt * 1.55, wButt * 1.9, 5);
    ctx.fill();
    taper(ctx, g, gripEnd * 0.55, gripEnd, wButt * 1.9, wButt * 1.25, 5);
    ctx.fill();

    // butt cap
    ctx.fillStyle = U.rgbToCss(U.shade(gripRgb, -0.55));
    ctx.beginPath();
    ctx.ellipse(g.bx, g.by, wButt * 0.95, wButt * 0.95, 0, 0, TAU);
    ctx.fill();

    // binding bands
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(tipRgb, [0, 0, 0], 0.35), 0.7);
    ctx.lineWidth = Math.max(0.5, 1.0 * scale);
    for (let i = 0; i < 2; i++) {
      const k = 0.055 + i * 0.085;
      const p = ptAt(g, k);
      const m = Math.hypot(p.dx, p.dy) || 1;
      const w = wButt * 1.75;
      ctx.beginPath();
      ctx.moveTo(p.x - p.dy / m * w * 0.5, p.y + p.dx / m * w * 0.5);
      ctx.lineTo(p.x + p.dy / m * w * 0.5, p.y - p.dx / m * w * 0.5);
      ctx.stroke();
    }

    drawReel(ctx, g, art, t, scale, opts, under, tipRgb, c1, c2);
  }

  /* A spinning reel: seat, stem, spool with a line wrap, bail and a crank
     that actually turns when the player is reeling. */
  function drawReel(ctx, g, art, t, scale, opts, under, tipRgb, c1, c2) {
    const a = g.angle;
    const cosA = Math.cos(a), sinA = Math.sin(a);
    const nx = -sinA * under, ny = cosA * under;
    const rr = Math.max(2.8, 6.0 * scale);
    const sx = g.bx + cosA * g.len * 0.215;
    const sy = g.by + sinA * g.len * 0.215;
    const cx = sx + nx * rr * 1.9, cy = sy + ny * rr * 1.9;

    // reel seat: a short collar on the blank
    ctx.fillStyle = U.rgbToCss(U.shade(c2, 0.25));
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-rr * 1.1, -rr * 0.55, rr * 2.2, rr * 1.1, rr * 0.3);
    else ctx.rect(-rr * 1.1, -rr * 0.55, rr * 2.2, rr * 1.1);
    ctx.fill();
    ctx.restore();

    // stem down to the reel body
    ctx.strokeStyle = U.rgbToCss(U.shade(c2, 0.15));
    ctx.lineWidth = Math.max(1, rr * 0.55);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(cx - nx * rr * 0.6, cy - ny * rr * 0.6);
    ctx.stroke();

    // body
    const bg = ctx.createLinearGradient(cx - nx * rr, cy - ny * rr, cx + nx * rr, cy + ny * rr);
    bg.addColorStop(0, U.rgbToCss(U.shade(c1, 0.30)));
    bg.addColorStop(1, U.rgbToCss(U.shade(c2, -0.30)));
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr * 1.05, rr * 0.98, a, 0, TAU);
    ctx.fill();

    // the spool sits inside the housing, dark and recessed
    ctx.fillStyle = U.rgbToCss(U.shade(c2, -0.55));
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.66, 0, TAU);
    ctx.fill();
    // one bright rim is worth more than three faint ones at this size
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(tipRgb, [255, 255, 255], 0.4), 0.85);
    ctx.lineWidth = Math.max(0.5, 0.9 * scale);
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.66, 0, TAU);
    ctx.stroke();
    // the wrap of line on the spool
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(tipRgb, [235, 245, 255], 0.55), 0.35);
    ctx.lineWidth = Math.max(0.35, 0.6 * scale);
    ctx.beginPath();
    ctx.arc(cx, cy, rr * 0.42, 0, TAU);
    ctx.stroke();

    const spin = opts.spin === undefined ? t * 0.4 : opts.spin;

    // bail: half an arc across the face, not a closed ring
    ctx.lineWidth = Math.max(0.5, 0.85 * scale);
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(tipRgb, [220, 235, 250], 0.45), 0.9);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rr * 0.94, rr * 0.94, spin * 0.35, Math.PI * 0.15, Math.PI * 1.05);
    ctx.stroke();

    // the crank reaches clear of the housing so the turn is legible
    const hx = cx + Math.cos(spin) * rr * 1.75;
    const hy = cy + Math.sin(spin) * rr * 1.35;
    ctx.strokeStyle = U.rgbToCss(U.shade(c1, 0.42));
    ctx.lineWidth = Math.max(0.8, 1.3 * scale);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(spin) * rr * 0.4, cy + Math.sin(spin) * rr * 0.3);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = U.rgbToCss(U.shade(U.hexToRgb(art.grip), 0.20));
    ctx.beginPath();
    ctx.ellipse(hx, hy, rr * 0.36, rr * 0.28, spin, 0, TAU);
    ctx.fill();
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

      /* ------------------------------------------------- the far end ----
         These are the rods that are supposed to be absurd. Each one gets a
         mechanism of its own rather than another set of dots on the blank. */

      case 'storm': {
        // charge that has not finished leaving the blank: forks jumping
        // between the guides, redrawn on their own irregular clock
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const seed = Math.floor(t * 9);
        const rnd = VF.rng.make(seed * 2654435761 ^ 0x5701);
        const forks = 3;
        for (let f = 0; f < forks; f++) {
          const k0 = 0.18 + rnd() * 0.55;
          const k1 = Math.min(0.99, k0 + 0.14 + rnd() * 0.30);
          const a0 = at(k0), a1 = at(k1);
          ctx.strokeStyle = U.rgbToCss(tipRgb, 0.30 + rnd() * 0.5);
          ctx.lineWidth = Math.max(0.6, (0.8 + rnd() * 1.4) * scale);
          ctx.beginPath();
          ctx.moveTo(a0.x, a0.y);
          const steps = 4;
          for (let i = 1; i <= steps; i++) {
            const u = i / steps;
            const px = U.lerp(a0.x, a1.x, u) + (rnd() - 0.5) * 9 * scale;
            const py = U.lerp(a0.y, a1.y, u) + (rnd() - 0.5) * 9 * scale;
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        // a standing charge along the whole blank
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.16 + 0.10 * Math.sin(t * 5.5));
        ctx.lineWidth = Math.max(1.4, 2.4 * scale);
        ctx.beginPath();
        ctx.moveTo(g.bx, g.by);
        ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'bone': {
        // vertebrae down the blank, thinning toward a fang
        ctx.fillStyle = U.rgbToCss(U.mixRgb(tipRgb, [255, 255, 255], 0.25), 0.85);
        ctx.strokeStyle = U.rgbToCss(U.shade(tipRgb, -0.55), 0.7);
        ctx.lineWidth = Math.max(0.4, 0.6 * scale);
        for (let i = 0; i < 9; i++) {
          const k = 0.14 + i * 0.093;
          const p = at(k);
          const w = Math.max(1, (3.6 - i * 0.30) * scale);
          const ang = Math.atan2(p.y - at(Math.max(0, k - 0.02)).y, p.x - at(Math.max(0, k - 0.02)).x);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.ellipse(0, 0, w * 0.62, w, 0, 0, TAU);
          ctx.fill();
          ctx.stroke();
          // the transverse spurs, swept back the way a spine's are
          ctx.lineWidth = Math.max(0.5, 0.9 * scale);
          ctx.beginPath();
          ctx.moveTo(-w * 0.2, -w * 0.7); ctx.lineTo(-w * 1.1, -w * 2.0);
          ctx.moveTo(-w * 0.2, w * 0.7); ctx.lineTo(-w * 1.1, w * 2.0);
          ctx.stroke();
          ctx.lineWidth = Math.max(0.4, 0.6 * scale);
          ctx.restore();
        }
        // and it ends in the point it was taken from
        {
          const p = at(1), q = at(0.94);
          const ang = Math.atan2(p.y - q.y, p.x - q.x);
          const fw = Math.max(1.2, 2.2 * scale);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(ang);
          ctx.beginPath();
          ctx.moveTo(-fw * 3.2, -fw);
          ctx.quadraticCurveTo(fw * 1.2, -fw * 0.5, fw * 3.4, 0);
          ctx.quadraticCurveTo(fw * 1.2, fw * 0.5, -fw * 3.2, fw);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
        // marrow-light bleeding up the inside
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.10 + 0.06 * Math.sin(t * 1.3));
        ctx.lineWidth = Math.max(0.8, 1.6 * scale);
        ctx.beginPath();
        ctx.moveTo(g.bx, g.by);
        ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'chorus': {
        // a voice at every guide: rings that swell out of phase, and motes
        // that rise off the blank and go out
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 6; i++) {
          const p = at(0.22 + i * 0.14);
          const ph = (t * 0.55 + i * 0.17) % 1;
          const r = Math.max(1, (2 + ph * 11) * scale);
          ctx.strokeStyle = U.rgbToCss(tipRgb, (1 - ph) * 0.45);
          ctx.lineWidth = Math.max(0.5, (1.4 - ph) * scale);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, TAU);
          ctx.stroke();
          // the mote itself
          ctx.fillStyle = U.rgbToCss(tipRgb, 0.55 + 0.35 * Math.sin(t * 2.1 + i));
          ctx.beginPath();
          ctx.arc(p.x, p.y - ph * 9 * scale, Math.max(0.7, 1.5 * scale), 0, TAU);
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case 'eclipse': {
        // a covered sun at the tip, with a corona and a shadow pointing wrong
        ctx.save();
        const r = Math.max(3.2, 6.6 * scale);
        const pulse = 0.82 + 0.18 * Math.sin(t * 0.9);
        ctx.globalCompositeOperation = 'lighter';
        const cor = ctx.createRadialGradient(g.tx, g.ty, r * 0.9, g.tx, g.ty, r * 3.4 * pulse);
        cor.addColorStop(0, U.rgbToCss(tipRgb, 0.75));
        cor.addColorStop(0.30, U.rgbToCss(tipRgb, 0.22));
        cor.addColorStop(1, U.rgbToCss(tipRgb, 0));
        ctx.fillStyle = cor;
        ctx.beginPath(); ctx.arc(g.tx, g.ty, r * 3.4 * pulse, 0, TAU); ctx.fill();
        // flares licking off the rim
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.5);
        ctx.lineWidth = Math.max(0.5, 0.9 * scale);
        for (let i = 0; i < 7; i++) {
          const a = t * 0.5 + i * (TAU / 7);
          const len = r * (1.25 + 0.55 * Math.sin(t * 2.3 + i * 1.9));
          ctx.beginPath();
          ctx.moveTo(g.tx + Math.cos(a) * r, g.ty + Math.sin(a) * r);
          ctx.lineTo(g.tx + Math.cos(a) * len, g.ty + Math.sin(a) * len);
          ctx.stroke();
        }
        ctx.restore();
        // the disc itself, which is simply absent
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(g.tx, g.ty, r, 0, TAU); ctx.fill();
        // the second shadow, cast up the blank the wrong way
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#000';
        ctx.lineWidth = Math.max(1.2, 2.6 * scale);
        ctx.beginPath();
        ctx.moveTo(U.lerp(g.bx, g.tx, 0.25) + 5 * scale, U.lerp(g.by, g.ty, 0.25) + 5 * scale);
        ctx.quadraticCurveTo(g.cx + 5 * scale, g.cy + 5 * scale, g.tx + 5 * scale, g.ty + 5 * scale);
        ctx.stroke();
        ctx.restore();
        break;
      }

      case 'origin': {
        // the rod the others were drawn from: construction lines, ticks and
        // a core of raw light where the blank should be
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.85);
        ctx.lineWidth = Math.max(0.8, 1.5 * scale);
        ctx.beginPath();
        ctx.moveTo(g.bx, g.by);
        ctx.quadraticCurveTo(g.cx, g.cy, g.tx, g.ty);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        ctx.setLineDash([3 * scale, 4 * scale]);
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.30);
        ctx.lineWidth = Math.max(0.4, 0.6 * scale);
        // the chord the curve was struck against
        ctx.beginPath();
        ctx.moveTo(g.bx, g.by); ctx.lineTo(g.tx, g.ty);
        ctx.stroke();
        // and the control handle
        ctx.beginPath();
        ctx.moveTo(g.bx, g.by); ctx.lineTo(g.cx, g.cy); ctx.lineTo(g.tx, g.ty);
        ctx.stroke();
        ctx.setLineDash([]);
        // measurement ticks along the blank
        ctx.strokeStyle = U.rgbToCss(tipRgb, 0.45);
        for (let i = 1; i < 10; i++) {
          const k = i / 10;
          const p = at(k), q = at(Math.max(0, k - 0.015));
          const m = Math.hypot(p.x - q.x, p.y - q.y) || 1;
          const nx = -(p.y - q.y) / m, ny = (p.x - q.x) / m;
          const h = (i % 5 === 0 ? 5 : 3) * scale;
          ctx.beginPath();
          ctx.moveTo(p.x - nx * h, p.y - ny * h);
          ctx.lineTo(p.x + nx * h, p.y + ny * h);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'everything': {
        // it is every rod, so it runs every mechanism — three at a time,
        // rotating, so the blank never looks the same twice
        const all = ['storm', 'bone', 'chorus', 'eclipse', 'origin',
                     'celestial', 'void', 'runic', 'lunar', 'glitch'];
        const base = Math.floor(t * 0.5) % all.length;
        for (let i = 0; i < 3; i++) {
          const which = all[(base + i * 3) % all.length];
          ctx.save();
          ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 1.3 + i * 2.1);
          drawStyle(ctx, { style: which, tip: art.tip, glow: art.glow }, g, t + i * 3.7, scale, tipRgb);
          ctx.restore();
        }
        // and a halo that belongs to nothing else
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const ph = (t * 0.4 + i / 3) % 1;
          ctx.strokeStyle = U.rgbToCss(tipRgb, (1 - ph) * 0.4);
          ctx.lineWidth = Math.max(0.6, 1.6 * scale * (1 - ph));
          ctx.beginPath();
          ctx.arc(g.tx, g.ty, Math.max(1, ph * 26 * scale), 0, TAU);
          ctx.stroke();
        }
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
