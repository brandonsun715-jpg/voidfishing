/* VOID FISHING — procedural creature rendering.
   Every species is drawn from its art{} spec: a body silhouette, fins, a set of
   extras, and eyes. Randomness is seeded from the species id so a given fish
   always looks the same. Fish face right; local origin is the body centre. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* Half-height of each body as a fraction of total length. The renderers and
     the UI sizing helpers all read this, so proportions stay consistent. */
  const BODY_H = {
    torpedo: 0.30, round: 0.38, eel: 0.13, serpent: 0.15, blob: 0.36,
    jelly: 0.34, ray: 0.22, shard: 0.34, orb: 0.46, crustacean: 0.32,
    whale: 0.27, ribbon: 0.20, anomaly: 0.36, fractal: 0.38
  };
  function bodyRatio(kind) { return BODY_H[kind] === undefined ? 0.30 : BODY_H[kind]; }

  /* ------------------------------------------------------------- bodies
     Each returns the path on ctx and reports its bounding half-height. */

  function bodyPath(ctx, kind, L, sway, rnd) {
    const H = L * bodyRatio(kind);

    ctx.beginPath();
    switch (kind) {
      case 'round':
        ctx.moveTo(L * 0.52, 0);
        ctx.bezierCurveTo(L * 0.44, -H * 1.05, -L * 0.16, -H * 1.10, -L * 0.40, -H * 0.34);
        ctx.bezierCurveTo(-L * 0.50, -H * 0.14, -L * 0.50, H * 0.14, -L * 0.40, H * 0.34);
        ctx.bezierCurveTo(-L * 0.16, H * 1.10, L * 0.44, H * 1.05, L * 0.52, 0);
        break;

      case 'orb':
        ctx.ellipse(0, 0, L * 0.50, H, 0, 0, TAU);
        break;

      case 'eel':
      case 'serpent': {
        const segs = 22, amp = H * (kind === 'serpent' ? 4.2 : 2.6);
        ctx.moveTo(L * 0.52, 0);
        for (let i = 0; i <= segs; i++) {
          const k = i / segs;
          const x = L * 0.52 - k * L;
          const y = Math.sin(k * Math.PI * 2.1 + sway) * amp * k;
          const th = H * (1 - k * 0.72) * (kind === 'serpent' ? 1 : 0.9);
          ctx.lineTo(x, y - th);
        }
        for (let i = segs; i >= 0; i--) {
          const k = i / segs;
          const x = L * 0.52 - k * L;
          const y = Math.sin(k * Math.PI * 2.1 + sway) * amp * k;
          const th = H * (1 - k * 0.72) * (kind === 'serpent' ? 1 : 0.9);
          ctx.lineTo(x, y + th);
        }
        break;
      }

      case 'ribbon': {
        const segs = 18;
        ctx.moveTo(L * 0.50, -H * 0.5);
        for (let i = 0; i <= segs; i++) {
          const k = i / segs;
          ctx.lineTo(L * 0.50 - k * L, Math.sin(k * 4.2 + sway) * H * 1.9 * k - H * (1 - k * 0.3));
        }
        for (let i = segs; i >= 0; i--) {
          const k = i / segs;
          ctx.lineTo(L * 0.50 - k * L, Math.sin(k * 4.2 + sway) * H * 1.9 * k + H * (1 - k * 0.3));
        }
        break;
      }

      case 'blob':
        ctx.moveTo(L * 0.48, -H * 0.12);
        ctx.bezierCurveTo(L * 0.34, -H * 1.15, -L * 0.22, -H * 1.25, -L * 0.44, -H * 0.30);
        ctx.bezierCurveTo(-L * 0.55, H * 0.10, -L * 0.34, H * 1.05, -L * 0.02, H * 1.02);
        ctx.bezierCurveTo(L * 0.28, H * 1.00, L * 0.50, H * 0.42, L * 0.48, -H * 0.12);
        break;

      case 'jelly': {
        ctx.moveTo(-L * 0.46, H * 0.08);
        ctx.bezierCurveTo(-L * 0.48, -H * 1.25, L * 0.48, -H * 1.25, L * 0.46, H * 0.08);
        const lobes = 5;
        for (let i = lobes; i >= 0; i--) {
          const k = i / lobes;
          const x = U.lerp(L * 0.46, -L * 0.46, 1 - k);
          ctx.quadraticCurveTo(x + L * 0.09, H * (0.42 + Math.sin(sway + i) * 0.12), x, H * 0.06);
        }
        break;
      }

      case 'ray': {
        // seen from above: broad wings, a pair of cephalic lobes at the head,
        // and a narrow body tapering to a whip
        const spanX = L * 0.42, spanY = H * 3.0;
        ctx.moveTo(spanX, -H * 0.30);
        ctx.quadraticCurveTo(L * 0.52, -H * 0.10, spanX + L * 0.02, H * 0.06);
        ctx.quadraticCurveTo(L * 0.50, H * 0.24, spanX - L * 0.02, H * 0.34);
        ctx.bezierCurveTo(L * 0.26, spanY * 0.34, L * 0.00, spanY * 0.94, -L * 0.34, spanY);
        ctx.bezierCurveTo(-L * 0.24, spanY * 0.40, -L * 0.30, spanY * 0.10, -L * 0.50, H * 0.06);
        ctx.lineTo(-L * 0.50, -H * 0.06);
        ctx.bezierCurveTo(-L * 0.30, -spanY * 0.10, -L * 0.24, -spanY * 0.40, -L * 0.34, -spanY);
        ctx.bezierCurveTo(L * 0.00, -spanY * 0.94, L * 0.26, -spanY * 0.34, spanX, -H * 0.30);
        break;
      }

      case 'shard':
        ctx.moveTo(L * 0.52, 0);
        ctx.lineTo(L * 0.06, -H);
        ctx.lineTo(-L * 0.30, -H * 0.52);
        ctx.lineTo(-L * 0.52, -H * 0.86);
        ctx.lineTo(-L * 0.40, 0);
        ctx.lineTo(-L * 0.52, H * 0.86);
        ctx.lineTo(-L * 0.30, H * 0.52);
        ctx.lineTo(L * 0.06, H);
        break;

      case 'crustacean':
        // carapace: wider than long, slightly squared at the front
        ctx.moveTo(L * 0.34, -H * 0.35);
        ctx.bezierCurveTo(L * 0.46, -H * 0.95, -L * 0.10, -H * 1.20, -L * 0.36, -H * 0.72);
        ctx.bezierCurveTo(-L * 0.50, -H * 0.34, -L * 0.50, H * 0.34, -L * 0.36, H * 0.72);
        ctx.bezierCurveTo(-L * 0.10, H * 1.20, L * 0.46, H * 0.95, L * 0.34, H * 0.35);
        ctx.quadraticCurveTo(L * 0.40, 0, L * 0.34, -H * 0.35);
        break;

      case 'whale':
        // blunt head, long tapering body, deeply forked flukes
        ctx.moveTo(L * 0.50, H * 0.05);
        ctx.bezierCurveTo(L * 0.50, -H * 0.85, L * 0.20, -H * 1.05, -L * 0.05, -H * 0.85);
        ctx.bezierCurveTo(-L * 0.22, -H * 0.70, -L * 0.30, -H * 0.42, -L * 0.36, -H * 0.20);
        ctx.lineTo(-L * 0.60, -H * 1.45);
        ctx.quadraticCurveTo(-L * 0.44, -H * 0.22, -L * 0.42, 0);
        ctx.quadraticCurveTo(-L * 0.44, H * 0.22, -L * 0.60, H * 1.45);
        ctx.lineTo(-L * 0.36, H * 0.20);
        ctx.bezierCurveTo(-L * 0.24, H * 0.62, L * 0.14, H * 1.00, L * 0.44, H * 0.72);
        ctx.quadraticCurveTo(L * 0.53, H * 0.42, L * 0.50, H * 0.05);
        break;

      case 'anomaly': {
        const pts = 11;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * TAU;
          const wob = 0.62 + rnd() * 0.62;
          const x = Math.cos(a) * L * 0.50 * wob;
          const y = Math.sin(a) * H * wob;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        break;
      }

      case 'fractal': {
        const pts = 9;
        for (let i = 0; i <= pts; i++) {
          const a = (i / pts) * TAU;
          const r = (i % 2 === 0) ? 1 : 0.42;
          if (i === 0) ctx.moveTo(Math.cos(a) * L * 0.5 * r, Math.sin(a) * H * r);
          else ctx.lineTo(Math.cos(a) * L * 0.5 * r, Math.sin(a) * H * r);
        }
        break;
      }

      default: /* torpedo */
        ctx.moveTo(L * 0.52, 0);
        ctx.bezierCurveTo(L * 0.34, -H * 1.02, -L * 0.14, -H * 1.00, -L * 0.36, -H * 0.30);
        ctx.quadraticCurveTo(-L * 0.42, 0, -L * 0.36, H * 0.30);
        ctx.bezierCurveTo(-L * 0.14, H * 1.00, L * 0.34, H * 1.02, L * 0.52, 0);
        break;
    }
    ctx.closePath();
    return H;
  }

  /* --------------------------------------------------------------- fins */

  /* Fins are membrane plus rays: fill the shape, then stroke thin supports
     radiating from where the fin meets the body. That single detail is most of
     what separates a fin from a triangle. */
  function paintFin(ctx, path, col, alpha, rays) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;
    ctx.fill(path);
    if (rays && rays.n > 1) {
      ctx.save();
      ctx.clip(path);
      ctx.strokeStyle = rays.col;
      ctx.globalAlpha = alpha * 0.55;
      ctx.lineWidth = rays.w;
      ctx.lineCap = 'round';
      for (let i = 0; i < rays.n; i++) {
        const t = i / (rays.n - 1);
        const a = rays.a0 + (rays.a1 - rays.a0) * t;
        ctx.beginPath();
        ctx.moveTo(rays.x, rays.y);
        ctx.lineTo(rays.x + Math.cos(a) * rays.len, rays.y + Math.sin(a) * rays.len);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = alpha;
  }

  function drawFins(ctx, style, L, H, sway, col, alpha, accent) {
    if (style === 'none') return;
    const rayCol = accent || col;
    const rw = Math.max(0.6, L * 0.006);
    const tailX = -L * 0.36;

    switch (style) {
      case 'legs': {
        ctx.strokeStyle = col;
        ctx.fillStyle = col;
        ctx.globalAlpha = alpha;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, L * 0.020);
        for (let side = -1; side <= 1; side += 2) {
          for (let j = 0; j < 4; j++) {
            const x = L * (0.14 - j * 0.15);
            const reach = H * (0.95 + j * 0.12);
            ctx.beginPath();
            ctx.moveTo(x, side * H * 0.62);
            ctx.quadraticCurveTo(x - L * 0.10, side * reach * 0.9,
                                 x - L * 0.22, side * reach + sway * 2);
            ctx.stroke();
          }
        }
        // claws: an upper arm, a forearm, then a two-part pincer
        for (let side = -1; side <= 1; side += 2) {
          const ex = L * 0.30, ey = side * H * 1.05;      // elbow
          const cx = L * 0.56, cy = side * H * 0.86;      // claw base
          ctx.lineWidth = Math.max(1.4, L * 0.030);
          ctx.beginPath();
          ctx.moveTo(L * 0.20, side * H * 0.55);
          ctx.lineTo(ex, ey);
          ctx.lineTo(cx, cy);
          ctx.stroke();
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(side * -0.5);
          ctx.beginPath();
          ctx.ellipse(0, 0, L * 0.085, H * 0.38, 0, 0, TAU);
          ctx.fill();
          ctx.lineWidth = Math.max(1.1, L * 0.020);
          ctx.beginPath();
          ctx.moveTo(L * 0.05, -H * 0.14);
          ctx.lineTo(L * 0.17, -H * 0.30);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(L * 0.05, H * 0.10);
          ctx.lineTo(L * 0.17, H * 0.02);
          ctx.stroke();
          ctx.restore();
        }
        break;
      }

      case 'wing': {
        for (let w = 0; w < 2; w++) {
          const dir = w ? 1 : -1;
          const reach = w ? 1 : 0.55;
          const p = new Path2D();
          p.moveTo(L * 0.18, dir * H * 0.30);
          p.quadraticCurveTo(L * 0.02, dir * H * (1.9 * reach) + sway * 5,
                             -L * 0.30, dir * H * (2.3 * reach) + sway * 7);
          p.quadraticCurveTo(-L * 0.14, dir * H * (1.0 * reach), -L * 0.10, dir * H * 0.28);
          p.closePath();
          paintFin(ctx, p, col, alpha * (w ? 1 : 0.55), {
            col: rayCol, w: rw, n: 6, x: L * 0.12, y: dir * H * 0.32, len: L * 0.62,
            a0: dir > 0 ? 0.5 : -0.5, a1: dir > 0 ? 2.5 : -2.5
          });
        }
        const d = new Path2D();
        d.moveTo(L * 0.10, -H * 0.78);
        d.quadraticCurveTo(-L * 0.04, -H * 1.7, -L * 0.24, -H * 0.70);
        d.closePath();
        paintFin(ctx, d, col, alpha, { col: rayCol, w: rw, n: 5, x: -L * 0.06,
          y: -H * 0.70, len: H * 1.2, a0: -2.2, a1: -1.0 });
        break;
      }

      case 'veil': {
        const t = new Path2D();
        t.moveTo(tailX, -H * 0.28);
        t.bezierCurveTo(-L * 0.72, -H * 1.5 + sway * 9, -L * 0.95, -H * 0.5, -L * 0.78, H * 0.15 + sway * 5);
        t.bezierCurveTo(-L * 0.95, H * 0.9, -L * 0.66, H * 1.6, tailX, H * 0.28);
        t.closePath();
        paintFin(ctx, t, col, alpha * 0.82, { col: rayCol, w: rw, n: 9,
          x: tailX, y: 0, len: L * 0.62, a0: -2.55, a1: 2.55 });
        const d = new Path2D();
        d.moveTo(L * 0.14, -H * 0.72);
        d.quadraticCurveTo(-L * 0.05, -H * 2.0 + sway * 7, -L * 0.30, -H * 0.7);
        d.closePath();
        paintFin(ctx, d, col, alpha * 0.82, { col: rayCol, w: rw, n: 7,
          x: -L * 0.08, y: -H * 0.70, len: H * 1.5, a0: -2.4, a1: -0.9 });
        break;
      }

      case 'long': {
        const t = new Path2D();
        t.moveTo(tailX, -H * 0.22);
        t.lineTo(-L * 0.88, -H * 1.25 + sway * 8);
        t.lineTo(-L * 0.66, 0);
        t.lineTo(-L * 0.88, H * 1.25 + sway * 8);
        t.lineTo(tailX, H * 0.22);
        t.closePath();
        paintFin(ctx, t, col, alpha, { col: rayCol, w: rw, n: 9,
          x: tailX, y: 0, len: L * 0.60, a0: -2.5, a1: 2.5 });
        const d = new Path2D();
        d.moveTo(L * 0.20, -H * 0.70);
        d.quadraticCurveTo(L * 0.02, -H * 1.85, -L * 0.28, -H * 0.66);
        d.closePath();
        paintFin(ctx, d, col, alpha, { col: rayCol, w: rw, n: 7,
          x: -L * 0.04, y: -H * 0.66, len: H * 1.4, a0: -2.3, a1: -0.85 });
        break;
      }

      case 'spiky': {
        const t = new Path2D();
        t.moveTo(tailX, -H * 0.24);
        t.lineTo(-L * 0.70, -H * 1.05 + sway * 6);
        t.lineTo(-L * 0.56, -H * 0.20);
        t.lineTo(-L * 0.72, H * 0.25);
        t.lineTo(-L * 0.62, H * 1.05 + sway * 6);
        t.lineTo(tailX, H * 0.24);
        t.closePath();
        paintFin(ctx, t, col, alpha, { col: rayCol, w: rw, n: 7,
          x: tailX, y: 0, len: L * 0.44, a0: -2.4, a1: 2.4 });
        ctx.globalAlpha = alpha;
        ctx.fillStyle = col;
        for (let i = 0; i < 5; i++) {
          const x = L * (0.24 - i * 0.13);
          ctx.beginPath();
          ctx.moveTo(x, -H * 0.75);
          ctx.lineTo(x - L * 0.05, -H * (1.35 - i * 0.09));
          ctx.lineTo(x - L * 0.10, -H * 0.72);
          ctx.closePath(); ctx.fill();
        }
        break;
      }

      case 'frill': {
        const d = new Path2D();
        d.moveTo(L * 0.30, -H * 0.62);
        for (let i = 0; i <= 9; i++) {
          const k = i / 9;
          const x = U.lerp(L * 0.30, -L * 0.42, k);
          d.lineTo(x, -H * (0.55 + Math.abs(Math.sin(k * 6 + sway)) * 0.95));
        }
        d.lineTo(-L * 0.42, -H * 0.4);
        d.closePath();
        paintFin(ctx, d, col, alpha, { col: rayCol, w: rw, n: 10,
          x: -L * 0.06, y: -H * 0.5, len: H * 1.5, a0: -2.7, a1: -0.5 });
        const t = new Path2D();
        t.moveTo(tailX, -H * 0.24);
        t.quadraticCurveTo(-L * 0.74, 0 + sway * 8, tailX, H * 0.24);
        t.closePath();
        paintFin(ctx, t, col, alpha, null);
        break;
      }

      default: { /* normal */
        const t = new Path2D();
        t.moveTo(tailX, -H * 0.24);
        t.lineTo(-L * 0.66, -H * 0.92 + sway * 7);
        t.lineTo(-L * 0.58, 0);
        t.lineTo(-L * 0.66, H * 0.92 + sway * 7);
        t.lineTo(tailX, H * 0.24);
        t.closePath();
        paintFin(ctx, t, col, alpha, { col: rayCol, w: rw, n: 8,
          x: tailX, y: 0, len: L * 0.36, a0: -2.4, a1: 2.4 });
        const d = new Path2D();
        d.moveTo(L * 0.16, -H * 0.72);
        d.quadraticCurveTo(-L * 0.02, -H * 1.5, -L * 0.24, -H * 0.68);
        d.closePath();
        paintFin(ctx, d, col, alpha, { col: rayCol, w: rw, n: 6,
          x: -L * 0.04, y: -H * 0.68, len: H * 1.1, a0: -2.3, a1: -0.9 });
        const an = new Path2D();
        an.moveTo(L * 0.10, H * 0.62);
        an.quadraticCurveTo(L * 0.00, H * 1.25, -L * 0.16, H * 0.60);
        an.closePath();
        paintFin(ctx, an, col, alpha, { col: rayCol, w: rw, n: 5,
          x: -L * 0.03, y: H * 0.60, len: H * 0.9, a0: 0.9, a1: 2.3 });
        break;
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------- extras */

  function drawExtras(ctx, list, L, H, sway, art, rnd, tm) {
    const acc = art.c3;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      ctx.save();
      switch (e) {
        case 'tentacles': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.6; ctx.lineCap = 'round';
          const n = 6;
          for (let j = 0; j < n; j++) {
            const x = U.lerp(-L * 0.38, L * 0.38, j / (n - 1));
            const len = H * (1.4 + rnd() * 1.9);
            ctx.lineWidth = Math.max(1, L * 0.014);
            ctx.beginPath();
            ctx.moveTo(x, H * 0.55);
            ctx.quadraticCurveTo(x + Math.sin(sway * 1.4 + j) * L * 0.10, H * 0.55 + len * 0.55,
                                 x + Math.sin(sway * 1.9 + j * 1.7) * L * 0.16, H * 0.55 + len);
            ctx.stroke();
          }
          break;
        }
        case 'threads': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.34; ctx.lineWidth = Math.max(0.7, L * 0.006);
          for (let j = 0; j < 7; j++) {
            const a0 = rnd() * TAU;
            const r0 = H * (0.5 + rnd() * 0.5);
            ctx.beginPath();
            ctx.moveTo(Math.cos(a0) * L * 0.3, Math.sin(a0) * r0);
            ctx.quadraticCurveTo(Math.cos(a0) * L * 0.6, Math.sin(a0) * r0 * 2.1 + Math.sin(sway + j) * 5,
                                 Math.cos(a0) * L * 0.5 - L * 0.3, Math.sin(a0) * r0 * 2.6);
            ctx.stroke();
          }
          break;
        }
        case 'halo': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.5;
          ctx.lineWidth = Math.max(1, L * 0.012);
          ctx.beginPath();
          ctx.ellipse(L * 0.06, 0, L * 0.62, H * 1.5, Math.sin(tm * 0.3) * 0.15, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 0.2;
          ctx.beginPath();
          ctx.ellipse(L * 0.06, 0, L * 0.74, H * 1.8, -Math.sin(tm * 0.24) * 0.2, 0, TAU);
          ctx.stroke();
          break;
        }
        case 'rings': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.42;
          ctx.lineWidth = Math.max(1, L * 0.010);
          for (let j = 0; j < 3; j++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, L * (0.34 + j * 0.14), H * (0.30 + j * 0.12),
                        tm * (0.2 + j * 0.1), 0, TAU);
            ctx.stroke();
          }
          break;
        }
        case 'crystals': {
          ctx.fillStyle = acc; ctx.globalAlpha = 0.72;
          for (let j = 0; j < 5; j++) {
            const x = U.lerp(-L * 0.3, L * 0.3, rnd());
            const y = (rnd() - 0.5) * H * 1.1;
            const s = L * (0.05 + rnd() * 0.07);
            ctx.beginPath();
            ctx.moveTo(x, y - s * 1.7); ctx.lineTo(x + s * 0.6, y);
            ctx.lineTo(x, y + s * 1.2); ctx.lineTo(x - s * 0.6, y);
            ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'spine': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.75;
          ctx.lineWidth = Math.max(1, L * 0.011);
          for (let j = 0; j < 8; j++) {
            const k = j / 8;
            const x = U.lerp(L * 0.30, -L * 0.30, k);
            ctx.beginPath();
            ctx.moveTo(x, -H * 0.68);
            ctx.lineTo(x - L * 0.02, -H * (1.05 + Math.sin(k * 4) * 0.25));
            ctx.stroke();
          }
          break;
        }
        case 'teeth': {
          // an open jaw at the head: dark inside, teeth along both edges
          const mx = L * 0.50, back = L * 0.14;
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = 'rgba(6,4,11,0.7)';
          ctx.beginPath();
          ctx.moveTo(mx, -H * 0.20);
          ctx.quadraticCurveTo(back + L * 0.08, -H * 0.10, back, H * 0.04);
          ctx.quadraticCurveTo(back + L * 0.08, H * 0.26, mx, H * 0.40);
          ctx.closePath(); ctx.fill();
          ctx.globalAlpha = 0.95;
          ctx.fillStyle = '#f4efe2';
          const nT = 8;
          for (let j = 0; j < nT; j++) {
            const t = j / (nT - 1);
            const xt = U.lerp(mx - L * 0.03, back + L * 0.04, t);
            const yTop = U.lerp(-H * 0.18, H * 0.02, t);
            const yBot = U.lerp(H * 0.37, H * 0.05, t);
            const sz = L * 0.015 * (1 - t * 0.45);
            ctx.beginPath();
            ctx.moveTo(xt - sz, yTop); ctx.lineTo(xt + sz, yTop);
            ctx.lineTo(xt, yTop + sz * 2.4); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(xt - sz, yBot); ctx.lineTo(xt + sz, yBot);
            ctx.lineTo(xt, yBot - sz * 2.4); ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'lantern': {
          const lx = L * 0.66, ly = -H * 1.15;
          ctx.strokeStyle = art.c2; ctx.globalAlpha = 0.85;
          ctx.lineWidth = Math.max(1, L * 0.012);
          ctx.beginPath();
          ctx.moveTo(L * 0.30, -H * 0.62);
          ctx.quadraticCurveTo(L * 0.62, -H * 1.5, lx, ly);
          ctx.stroke();
          const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, L * 0.30);
          g.addColorStop(0, acc);
          g.addColorStop(0.3, U.rgbToCss(U.hexToRgb(acc), 0.5));
          g.addColorStop(1, U.rgbToCss(U.hexToRgb(acc), 0));
          ctx.globalAlpha = 0.9; ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(lx, ly, L * 0.30, 0, TAU); ctx.fill();
          ctx.fillStyle = acc; ctx.globalAlpha = 1;
          ctx.beginPath(); ctx.arc(lx, ly, L * 0.045, 0, TAU); ctx.fill();
          break;
        }
        case 'horns': {
          ctx.fillStyle = acc; ctx.globalAlpha = 0.9;
          for (let j = -1; j <= 1; j += 2) {
            ctx.beginPath();
            ctx.moveTo(L * 0.18, -H * 0.7);
            ctx.quadraticCurveTo(L * (0.30 + j * 0.06), -H * 1.9, L * (0.40 + j * 0.10), -H * 2.1);
            ctx.quadraticCurveTo(L * 0.30, -H * 1.5, L * 0.26, -H * 0.68);
            ctx.closePath(); ctx.fill();
          }
          break;
        }
        case 'antenna': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.8;
          ctx.lineWidth = Math.max(0.8, L * 0.008);
          for (let j = -1; j <= 1; j += 2) {
            ctx.beginPath();
            ctx.moveTo(L * 0.40, H * 0.10 * j);
            ctx.quadraticCurveTo(L * 0.62, H * 0.5 * j, L * 0.78, H * 0.28 * j + Math.sin(sway + j) * 4);
            ctx.stroke();
          }
          break;
        }
        case 'runes': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.55;
          ctx.lineWidth = Math.max(0.8, L * 0.008);
          for (let j = 0; j < 5; j++) {
            const x = U.lerp(-L * 0.28, L * 0.30, rnd());
            const y = (rnd() - 0.5) * H * 1.0;
            const s = L * 0.05;
            ctx.beginPath();
            ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y - s * 0.3);
            ctx.lineTo(x - s * 0.4, y + s * 0.4); ctx.lineTo(x + s * 0.7, y + s);
            ctx.stroke();
          }
          break;
        }
        case 'chains': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.5;
          ctx.lineWidth = Math.max(1, L * 0.013);
          for (let j = 0; j < 3; j++) {
            const y0 = (j - 1) * H * 0.5;
            ctx.beginPath();
            for (let k = 0; k <= 8; k++) {
              const x = U.lerp(L * 0.40, -L * 0.46, k / 8);
              ctx.lineTo(x, y0 + Math.sin(k * 1.3 + sway + j) * H * 0.25);
            }
            ctx.stroke();
          }
          break;
        }
        case 'bubbles': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.4;
          ctx.lineWidth = Math.max(0.7, L * 0.006);
          for (let j = 0; j < 6; j++) {
            const x = L * 0.42 + rnd() * L * 0.35;
            const y = -H * (0.4 + rnd() * 1.6) - (tm * 12 % (H * 2));
            ctx.beginPath(); ctx.arc(x, y, L * (0.012 + rnd() * 0.022), 0, TAU); ctx.stroke();
          }
          break;
        }
        case 'fracture': {
          ctx.strokeStyle = acc; ctx.globalAlpha = 0.7;
          ctx.lineWidth = Math.max(0.9, L * 0.009);
          for (let j = 0; j < 4; j++) {
            let x = (rnd() - 0.5) * L * 0.7, y = (rnd() - 0.5) * H * 1.2;
            ctx.beginPath(); ctx.moveTo(x, y);
            for (let k = 0; k < 4; k++) {
              x += (rnd() - 0.5) * L * 0.28; y += (rnd() - 0.5) * H * 0.7;
              ctx.lineTo(x, y);
            }
            ctx.stroke();
          }
          break;
        }
        case 'stars': {
          ctx.fillStyle = acc; ctx.globalAlpha = 0.85;
          for (let j = 0; j < 9; j++) {
            const x = (rnd() - 0.5) * L * 0.80;
            const y = (rnd() - 0.5) * H * 1.5;
            const s = L * (0.008 + rnd() * 0.018);
            ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
          }
          break;
        }
        case 'wings': {
          ctx.fillStyle = acc; ctx.globalAlpha = 0.30;
          const f = Math.sin(tm * 3) * 0.25 + 1;
          for (let j = -1; j <= 1; j += 2) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(-L * 0.2, j * H * 2.6 * f, L * 0.34, j * H * 1.9 * f);
            ctx.quadraticCurveTo(L * 0.2, j * H * 0.8, 0, 0);
            ctx.fill();
          }
          break;
        }
        case 'mask': {
          ctx.fillStyle = acc; ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(L * 0.46, -H * 0.5);
          ctx.lineTo(L * 0.14, -H * 0.62);
          ctx.lineTo(L * 0.08, H * 0.42);
          ctx.lineTo(L * 0.44, H * 0.32);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#000'; ctx.globalAlpha = 0.9;
          ctx.beginPath(); ctx.ellipse(L * 0.32, -H * 0.14, L * 0.05, H * 0.10, 0, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.ellipse(L * 0.16, -H * 0.10, L * 0.04, H * 0.09, 0, 0, TAU); ctx.fill();
          break;
        }
        case 'eyes_extra': {
          ctx.fillStyle = '#f6f2e6'; ctx.globalAlpha = 0.92;
          for (let j = 0; j < 5; j++) {
            const x = (rnd() - 0.5) * L * 0.65;
            const y = (rnd() - 0.5) * H * 1.15;
            const s = L * (0.020 + rnd() * 0.020);
            ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
            ctx.fillStyle = '#0a0810';
            ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.fill();
            ctx.fillStyle = '#f6f2e6';
          }
          break;
        }
      }
      ctx.restore();
    }
  }

  /* --------------------------------------------------- surface detail
     Everything here paints inside the already-clipped body path. */

  /* Rows of overlapping arcs. Reads as scales without costing a texture. */
  function scaleTexture(ctx, L, H, col, rnd, dense) {
    const step = L * (dense ? 0.042 : 0.058);
    const r = step * 0.85;
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(0.4, L * 0.0035);
    ctx.globalAlpha = 0.13;
    let row = 0;
    for (let y = -H * 1.05; y < H * 1.05; y += step * 0.68) {
      const off = (row++ % 2) * step * 0.5;
      ctx.beginPath();
      for (let x = -L * 0.55 + off; x < L * 0.55; x += step) {
        ctx.moveTo(x - r * 0.5, y);
        ctx.arc(x, y, r * 0.5, Math.PI * 0.15, Math.PI * 0.85);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* The pale seam along the flank that most fish carry. */
  function lateralLine(ctx, L, H, col) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(0.6, L * 0.005);
    ctx.beginPath();
    ctx.moveTo(L * 0.38, -H * 0.12);
    ctx.quadraticCurveTo(0, H * 0.06, -L * 0.42, H * 0.02);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* Operculum: the plate behind the head. */
  function gillPlate(ctx, L, H, col) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.30;
    ctx.lineWidth = Math.max(0.6, L * 0.006);
    ctx.beginPath();
    ctx.moveTo(L * 0.30, -H * 0.70);
    ctx.quadraticCurveTo(L * 0.21, 0, L * 0.30, H * 0.62);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function mouthLine(ctx, L, H, col) {
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = Math.max(0.6, L * 0.006);
    ctx.beginPath();
    ctx.moveTo(L * 0.52, H * 0.02);
    ctx.quadraticCurveTo(L * 0.44, H * 0.16, L * 0.34, H * 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* A pectoral fin sitting in front of the flank, which is what gives a fish
     its sense of depth rather than reading as a flat cutout. */
  function pectoral(ctx, L, H, col, accent, sway) {
    const p = new Path2D();
    p.moveTo(L * 0.20, H * 0.12);
    p.quadraticCurveTo(L * 0.10, H * 0.78 + sway * 2, -L * 0.04, H * 0.56);
    p.quadraticCurveTo(L * 0.08, H * 0.34, L * 0.20, H * 0.12);
    p.closePath();
    paintFin(ctx, p, col, 0.38, { col: accent, w: Math.max(0.5, L * 0.004), n: 4,
      x: L * 0.19, y: H * 0.14, len: H * 0.8, a0: 1.3, a1: 2.4 });
    ctx.globalAlpha = 1;
  }

  function eye(ctx, x, y, r, iris) {
    ctx.fillStyle = '#f7f3e8';
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = iris;
    ctx.beginPath(); ctx.arc(x + r * 0.14, y, r * 0.74, 0, TAU); ctx.fill();
    ctx.fillStyle = '#08060e';
    ctx.beginPath(); ctx.arc(x + r * 0.20, y, r * 0.42, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath(); ctx.arc(x - r * 0.30, y - r * 0.32, r * 0.24, 0, TAU); ctx.fill();
  }

  /* Bodies built from panels rather than scales — the strange ones. */
  const SCALED = { torpedo: 1, round: 1, eel: 1, serpent: 1, shard: 1, crustacean: 1, whale: 1 };

  /* --------------------------------------------------------------- main */

  /* Traits stack: each one tints the body further, the rarest one hardest, so a
     four-trait fish is visibly the sum of its parts. */
  function palette(art, traits) {
    let c1 = U.hexToRgb(art.c1), c2 = U.hexToRgb(art.c2), c3 = U.hexToRgb(art.c3);
    const ids = !traits ? [] : (typeof traits === 'string' ? [traits] : traits);
    let top = null;
    const fx = { glow: 0, shimmer: 0, metal: 0, facet: 0, crust: 0, fracture: 0, darken: 0 };

    for (let i = 0; i < ids.length; i++) {
      const m = VF.traits.get(ids[i]);
      if (!m || !m.color) continue;
      if (!top || m.tier > top.tier) top = m;
      const col = U.hexToRgb(m.color);
      // later, rarer traits pull the body further toward their own colour
      const w = 0.26 + m.tier * 0.055;
      c1 = U.mixRgb(c1, col, w);
      c2 = U.mixRgb(c2, col, w * 0.72);
      c3 = U.mixRgb(c3, U.hexToRgb(m.tint || m.color), w * 0.85);
      for (const k in fx) if (m[k]) fx[k] = Math.max(fx[k], m[k]);
    }
    if (fx.darken) { c1 = U.shade(c1, -fx.darken * 0.45); c2 = U.shade(c2, -fx.darken * 0.5); }

    return {
      c1: U.rgbToCss(c1), c2: U.rgbToCss(c2), c3: U.rgbToCss(c3),
      mut: top, traits: ids, fx: fx
    };
  }

  /* size = half the body length in px. */
  function draw(ctx, fish, size, opts) {
    opts = opts || {};
    const art = fish.art;
    const tm = opts.time === undefined ? 0 : opts.time;
    const sway = Math.sin(tm * 2.1) * 0.55;
    const rnd = VF.rng.make(hash(fish.id));
    const L = size * 2;
    const pal = palette(art, opts.traits || opts.mutation);
    const glow = Math.min(1.4, art.glow * (pal.mut ? 1.25 : 1) + pal.fx.glow * 0.7);
    const j = jitter(fish.id);
    // below roughly 22px the fine detail is sub-pixel noise, so skip it
    const detail = opts.detail === undefined ? size >= 22 : opts.detail;

    ctx.save();
    // per-species proportion jitter, so two fish sharing a body type are never
    // the same fish in a different colour
    ctx.scale(j.x, j.y);

    // outer glow
    if (glow > 0.05) {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, L * 0.95);
      g.addColorStop(0, U.rgbToCss(U.hexToRgb(pal.c3), 0.30 * glow));
      g.addColorStop(0.5, U.rgbToCss(U.hexToRgb(pal.c3), 0.10 * glow));
      g.addColorStop(1, U.rgbToCss(U.hexToRgb(pal.c3), 0));
      ctx.fillStyle = g;
      ctx.fillRect(-L, -L, L * 2, L * 2);
    }

    // fins go behind the body
    const probe = VF.rng.make(hash(fish.id));
    const H0 = measureH(art.body, L);
    // a ray's body already is its wings, so a wing fin would only double it up
    if (!(art.body === 'ray' && art.fin === 'wing')) {
      drawFins(ctx, art.fin, L, H0, sway, pal.c2, 0.85, pal.c3);
    }

    // body
    const H = bodyPath(ctx, art.body, L, sway, probe);
    const c1 = U.hexToRgb(pal.c1), c2 = U.hexToRgb(pal.c2), c3 = U.hexToRgb(pal.c3);
    const rnd2 = VF.rng.make(hash(fish.id) ^ 0x1234);

    /* Counter-shading: dark along the back, pale along the belly. This is the
       single thing that stops a fish reading as a flat coloured shape. */
    const bg = ctx.createLinearGradient(0, -H * 1.05, 0, H * 1.05);
    // the belly lightens out of the body colour, never all the way to the
    // accent, or pale species bleach out entirely
    const belly = U.mixRgb(c1, c3, 0.45);
    bg.addColorStop(0.00, U.rgbToCss(U.shade(c2, -0.42)));
    bg.addColorStop(0.20, U.rgbToCss(U.mixRgb(c2, c1, 0.55)));
    bg.addColorStop(0.50, U.rgbToCss(c1));
    bg.addColorStop(0.80, U.rgbToCss(U.mixRgb(c1, belly, 0.7)));
    bg.addColorStop(1.00, U.rgbToCss(U.shade(belly, 0.10)));
    ctx.fillStyle = bg;
    ctx.fill();

    ctx.save();
    ctx.clip();

    // scale texture — skipped at small sizes where it would only be noise
    if (detail && SCALED[art.body]) scaleTexture(ctx, L, H, U.rgbToCss(U.shade(c2, -0.5)), rnd, art.body === 'round');

    // specular band along the upper flank
    const sp = ctx.createLinearGradient(0, -H * 0.95, 0, H * 0.10);
    sp.addColorStop(0, U.rgbToCss(c3, 0));
    sp.addColorStop(0.42, U.rgbToCss(U.mixRgb(c3, [255, 255, 255], 0.35), 0.18));
    sp.addColorStop(1, U.rgbToCss(c3, 0));
    ctx.fillStyle = sp;
    ctx.fillRect(-L, -H * 1.2, L * 2, H * 1.4);

    // and a soft glow from the belly for anything luminous
    if (glow > 0.15) {
      const bl = ctx.createRadialGradient(0, H * 0.6, 0, 0, H * 0.6, L * 0.55);
      bl.addColorStop(0, U.rgbToCss(c3, 0.34 * glow));
      bl.addColorStop(1, U.rgbToCss(c3, 0));
      ctx.fillStyle = bl;
      ctx.fillRect(-L, -H * 1.2, L * 2, H * 2.4);
    }

    /* trait surface treatments */
    if (pal.fx.metal) {
      const g = ctx.createLinearGradient(-L * 0.4, -H, L * 0.4, H);
      g.addColorStop(0, U.rgbToCss(c3, 0));
      g.addColorStop(0.42, U.rgbToCss(U.mixRgb(c3, [255, 255, 255], 0.6), 0.42));
      g.addColorStop(0.56, U.rgbToCss(c3, 0.08));
      g.addColorStop(1, U.rgbToCss(c3, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-L, -H * 1.3, L * 2, H * 2.6);
    }
    if (pal.fx.facet) {
      ctx.strokeStyle = U.rgbToCss(U.mixRgb(c3, [255, 255, 255], 0.5), 0.34);
      ctx.lineWidth = Math.max(0.6, L * 0.006);
      for (let i = 0; i < 7; i++) {
        const x0 = -L * 0.5 + (i / 6) * L;
        ctx.beginPath();
        ctx.moveTo(x0, -H * 1.2);
        ctx.lineTo(x0 + L * 0.16, H * 1.2);
        ctx.stroke();
      }
    }
    if (pal.fx.crust) {
      ctx.fillStyle = U.rgbToCss(U.shade(c2, -0.3), 0.5);
      for (let i = 0; i < 14; i++) {
        const x = (rnd2() - 0.5) * L * 0.85;
        const y = (rnd2() - 0.5) * H * 1.7;
        ctx.beginPath();
        ctx.arc(x, y, L * (0.008 + rnd() * 0.017), 0, TAU);
        ctx.fill();
      }
    }
    if (pal.fx.shimmer) {
      const g = ctx.createLinearGradient(-L * 0.5, 0, L * 0.5, 0);
      const hue = (tm * 40) % 360;
      for (let i = 0; i <= 4; i++) {
        const h = (hue + i * 72) % 360;
        g.addColorStop(i / 4, 'hsla(' + h.toFixed(0) + ',85%,72%,0.22)');
      }
      ctx.fillStyle = g;
      ctx.fillRect(-L, -H * 1.3, L * 2, H * 2.6);
    }
    if (pal.fx.fracture) {
      ctx.strokeStyle = U.rgbToCss(U.mixRgb(c3, [255, 255, 255], 0.4), 0.6);
      ctx.lineWidth = Math.max(0.7, L * 0.007);
      for (let i = 0; i < 4; i++) {
        let x = (rnd() - 0.5) * L * 0.6, y = (rnd() - 0.5) * H * 1.2;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rnd() - 0.5) * L * 0.24; y += (rnd() - 0.5) * H * 0.7;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }

    if (detail) {
      lateralLine(ctx, L, H, U.rgbToCss(U.mixRgb(c3, [255, 255, 255], 0.3)));
      if (SCALED[art.body] && art.body !== 'eel' && art.body !== 'serpent') {
        gillPlate(ctx, L, H, U.rgbToCss(U.shade(c2, -0.55)));
        if ((art.ex || []).indexOf('teeth') < 0) mouthLine(ctx, L, H, U.rgbToCss(U.shade(c2, -0.55)));
      }
    }
    ctx.restore();

    // pectoral fin, in front of the flank
    if (detail && SCALED[art.body] && art.body !== 'eel' && art.body !== 'serpent') {
      pectoral(ctx, L, H, pal.c2, pal.c3, sway);
    }

    // Outline, then a rim light. Without the rim the near-black species read as
    // holes rather than creatures.
    ctx.strokeStyle = U.rgbToCss(U.shade(U.hexToRgb(pal.c2), -0.5), 0.55);
    ctx.lineWidth = Math.max(0.8, L * 0.009);
    ctx.stroke();
    ctx.save();
    ctx.strokeStyle = U.rgbToCss(U.hexToRgb(pal.c3), 0.42);
    ctx.lineWidth = Math.max(0.7, L * 0.005);
    ctx.stroke();
    ctx.restore();

    drawExtras(ctx, art.ex || [], L, H, sway, { c1: pal.c1, c2: pal.c2, c3: pal.c3 }, rnd, tm);

    // eyes, irised in the species accent so they carry its colour
    const n = art.eyes | 0;
    if (n > 0) {
      const er = Math.max(1.2, L * 0.032);
      const iris = U.rgbToCss(U.mixRgb(c3, [40, 30, 60], 0.35));
      for (let i = 0; i < n; i++) {
        const ex = L * (0.32 - (i % 3) * 0.09);
        const ey = -H * 0.24 + Math.floor(i / 3) * H * 0.42;
        eye(ctx, ex, ey, er, iris);
      }
    }

    ctx.restore();
  }

  function measureH(kind, L) { return L * bodyRatio(kind); }

  /* Deterministic proportion jitter keyed to the species id. */
  const jitterCache = Object.create(null);
  function jitter(id) {
    let j = jitterCache[id];
    if (!j) {
      const r = VF.rng.make(hash(id) ^ 0x5bf03635);
      j = jitterCache[id] = { x: 0.90 + r() * 0.24, y: 0.84 + r() * 0.34 };
    }
    return j;
  }

  /* The largest half-size a creature can be drawn at and still fit a box. */
  function fitSize(fish, box) {
    const kind = fish.art.body;
    const r = bodyRatio(kind);
    // the paths overshoot the nominal half-height, most of all on the winged bodies
    const over = kind === 'ray' ? 3.3 : kind === 'jelly' ? 2.2
              : (kind === 'serpent' || kind === 'eel' || kind === 'ribbon') ? 3.4 : 1.35;
    const byHeight = (box * 0.46) / (r * 2 * over * 1.18);
    return Math.max(6, Math.min(box * 0.40, byHeight));
  }

  function drawSilhouette(ctx, fish, size, alpha) {
    const art = fish.art;
    const L = size * 2;
    const rnd = VF.rng.make(hash(fish.id));
    const H = measureH(art.body, L);
    const j = jitter(fish.id);
    ctx.save();
    ctx.scale(j.x, j.y);
    ctx.globalAlpha = alpha === undefined ? 0.8 : alpha;
    drawFins(ctx, art.fin, L, H, 0, '#000', 1);
    bodyPath(ctx, art.body, L, 0, rnd);
    ctx.fillStyle = '#000';
    ctx.fill();
    if (art.glow > 0.35) {
      ctx.globalAlpha *= art.glow * 0.5;
      ctx.fillStyle = art.c3;
      ctx.beginPath(); ctx.arc(L * 0.30, -H * 0.20, Math.max(1, L * 0.035), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  VF.fishArt = { draw: draw, drawSilhouette: drawSilhouette, palette: palette,
                 hash: hash, bodyRatio: bodyRatio, fitSize: fitSize };
})(window.VF = window.VF || {});
