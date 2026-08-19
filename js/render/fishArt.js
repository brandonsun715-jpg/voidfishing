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
        // seen from above: a broad diamond of wing with a whip of tail behind
        const spanX = L * 0.46, spanY = H * 3.0;
        ctx.moveTo(spanX, 0);
        ctx.bezierCurveTo(L * 0.30, -spanY * 0.30, L * 0.02, -spanY * 0.92, -L * 0.34, -spanY);
        ctx.bezierCurveTo(-L * 0.24, -spanY * 0.42, -L * 0.26, -spanY * 0.14, -L * 0.30, 0);
        ctx.bezierCurveTo(-L * 0.26, spanY * 0.14, -L * 0.24, spanY * 0.42, -L * 0.34, spanY);
        ctx.bezierCurveTo(L * 0.02, spanY * 0.92, L * 0.30, spanY * 0.30, spanX, 0);
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

  function drawFins(ctx, style, L, H, sway, col, alpha) {
    if (style === 'none') return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = col;

    const tailX = -L * 0.36;
    switch (style) {
      case 'legs': {
        ctx.strokeStyle = col;
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(1, L * 0.020);
        for (let side = -1; side <= 1; side += 2) {
          for (let j = 0; j < 3; j++) {
            const x = L * (0.10 - j * 0.20);
            const reach = H * (1.5 + j * 0.25);
            ctx.beginPath();
            ctx.moveTo(x, side * H * 0.55);
            ctx.quadraticCurveTo(x - L * 0.06, side * reach * 0.75,
                                 x - L * 0.14, side * reach + sway * 3);
            ctx.stroke();
          }
        }
        // claws, held forward
        for (let side = -1; side <= 1; side += 2) {
          ctx.lineWidth = Math.max(1, L * 0.026);
          ctx.beginPath();
          ctx.moveTo(L * 0.26, side * H * 0.45);
          ctx.lineTo(L * 0.50, side * H * 1.15);
          ctx.stroke();
          ctx.beginPath();
          ctx.ellipse(L * 0.56, side * H * 1.30, L * 0.075, H * 0.42, side * 0.7, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'wing':
        // pectoral fins sweeping back and down from behind the head
        for (let w = 0; w < 2; w++) {
          const dir = w ? 1 : -1;
          const reach = w ? 1 : 0.55;      // near fin larger than the far one
          ctx.beginPath();
          ctx.moveTo(L * 0.18, dir * H * 0.30);
          ctx.quadraticCurveTo(L * 0.02, dir * H * (1.9 * reach) + sway * 5,
                               -L * 0.30, dir * H * (2.3 * reach) + sway * 7);
          ctx.quadraticCurveTo(-L * 0.14, dir * H * (1.0 * reach), -L * 0.10, dir * H * 0.28);
          ctx.closePath();
          ctx.globalAlpha = alpha * (w ? 1 : 0.55);
          ctx.fill();
        }
        ctx.globalAlpha = alpha;
        // dorsal
        ctx.beginPath();
        ctx.moveTo(L * 0.10, -H * 0.78);
        ctx.quadraticCurveTo(-L * 0.04, -H * 1.7, -L * 0.24, -H * 0.70);
        ctx.closePath(); ctx.fill();
        break;
      case 'veil':
        ctx.beginPath();
        ctx.moveTo(tailX, -H * 0.28);
        ctx.bezierCurveTo(-L * 0.72, -H * 1.5 + sway * 9, -L * 0.95, -H * 0.5, -L * 0.78, H * 0.15 + sway * 5);
        ctx.bezierCurveTo(-L * 0.95, H * 0.9, -L * 0.66, H * 1.6, tailX, H * 0.28);
        ctx.closePath(); ctx.fill();
        // dorsal veil
        ctx.beginPath();
        ctx.moveTo(L * 0.14, -H * 0.72);
        ctx.quadraticCurveTo(-L * 0.05, -H * 2.0 + sway * 7, -L * 0.30, -H * 0.7);
        ctx.closePath(); ctx.fill();
        break;
      case 'long':
        ctx.beginPath();
        ctx.moveTo(tailX, -H * 0.22);
        ctx.lineTo(-L * 0.88, -H * 1.25 + sway * 8);
        ctx.lineTo(-L * 0.66, 0);
        ctx.lineTo(-L * 0.88, H * 1.25 + sway * 8);
        ctx.lineTo(tailX, H * 0.22);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(L * 0.20, -H * 0.70);
        ctx.quadraticCurveTo(L * 0.02, -H * 1.85, -L * 0.28, -H * 0.66);
        ctx.closePath(); ctx.fill();
        break;
      case 'spiky':
        ctx.beginPath();
        ctx.moveTo(tailX, -H * 0.24);
        ctx.lineTo(-L * 0.70, -H * 1.05 + sway * 6);
        ctx.lineTo(-L * 0.56, -H * 0.20);
        ctx.lineTo(-L * 0.72, H * 0.25);
        ctx.lineTo(-L * 0.62, H * 1.05 + sway * 6);
        ctx.lineTo(tailX, H * 0.24);
        ctx.closePath(); ctx.fill();
        for (let i = 0; i < 5; i++) {
          const x = L * (0.24 - i * 0.13);
          ctx.beginPath();
          ctx.moveTo(x, -H * 0.75);
          ctx.lineTo(x - L * 0.05, -H * (1.35 - i * 0.09));
          ctx.lineTo(x - L * 0.10, -H * 0.72);
          ctx.closePath(); ctx.fill();
        }
        break;
      case 'frill':
        ctx.beginPath();
        ctx.moveTo(L * 0.30, -H * 0.62);
        for (let i = 0; i <= 9; i++) {
          const k = i / 9;
          const x = U.lerp(L * 0.30, -L * 0.42, k);
          ctx.lineTo(x, -H * (0.55 + Math.abs(Math.sin(k * 6 + sway)) * 0.95));
        }
        ctx.lineTo(-L * 0.42, -H * 0.4);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tailX, -H * 0.24);
        ctx.quadraticCurveTo(-L * 0.74, 0 + sway * 8, tailX, H * 0.24);
        ctx.closePath(); ctx.fill();
        break;
      default: /* normal */
        ctx.beginPath();
        ctx.moveTo(tailX, -H * 0.24);
        ctx.lineTo(-L * 0.66, -H * 0.92 + sway * 7);
        ctx.lineTo(-L * 0.58, 0);
        ctx.lineTo(-L * 0.66, H * 0.92 + sway * 7);
        ctx.lineTo(tailX, H * 0.24);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(L * 0.16, -H * 0.72);
        ctx.quadraticCurveTo(-L * 0.02, -H * 1.5, -L * 0.24, -H * 0.68);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(L * 0.10, H * 0.62);
        ctx.quadraticCurveTo(L * 0.00, H * 1.25, -L * 0.16, H * 0.60);
        ctx.closePath(); ctx.fill();
        break;
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
          ctx.fillStyle = '#f2ede0'; ctx.globalAlpha = 0.9;
          for (let j = 0; j < 6; j++) {
            const x = L * (0.44 - j * 0.055);
            const s = L * 0.026;
            ctx.beginPath();
            ctx.moveTo(x, H * 0.06); ctx.lineTo(x + s, H * 0.06);
            ctx.lineTo(x + s * 0.5, H * 0.30); ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(x, -H * 0.02); ctx.lineTo(x + s, -H * 0.02);
            ctx.lineTo(x + s * 0.5, -H * 0.24); ctx.closePath(); ctx.fill();
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

  /* --------------------------------------------------------------- main */

  function palette(art, mutation) {
    let c1 = art.c1, c2 = art.c2, c3 = art.c3;
    const m = VF.mutations.get(mutation);
    if (m) {
      const t = m.id === 'shadow' ? 0.82 : m.id === 'voidtouched' ? 0.62 : 0.68;
      c1 = U.rgbToCss(U.mixRgb(U.hexToRgb(c1), U.hexToRgb(m.color), t));
      c2 = U.rgbToCss(U.mixRgb(U.hexToRgb(c2), U.hexToRgb(m.color), t * 0.75));
      c3 = m.tint;
    }
    return { c1: c1, c2: c2, c3: c3, mut: m };
  }

  /* size = half the body length in px. */
  function draw(ctx, fish, size, opts) {
    opts = opts || {};
    const art = fish.art;
    const tm = opts.time === undefined ? 0 : opts.time;
    const sway = Math.sin(tm * 2.1) * 0.55;
    const rnd = VF.rng.make(hash(fish.id));
    const L = size * 2;
    const pal = palette(art, opts.mutation);
    const glow = art.glow * (pal.mut ? 1.25 : 1);
    const j = jitter(fish.id);

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
    drawFins(ctx, art.fin, L, H0, sway, pal.c2, 0.85);

    // body
    const H = bodyPath(ctx, art.body, L, sway, probe);
    const bg = ctx.createLinearGradient(0, -H, 0, H);
    bg.addColorStop(0, pal.c1);
    bg.addColorStop(0.55, pal.c2);
    bg.addColorStop(1, U.rgbToCss(U.shade(U.hexToRgb(pal.c2), -0.28)));
    ctx.fillStyle = bg;
    ctx.fill();

    // top light
    ctx.save();
    ctx.clip();
    const hl = ctx.createLinearGradient(0, -H * 1.1, 0, H * 0.2);
    hl.addColorStop(0, U.rgbToCss(U.hexToRgb(pal.c3), 0.34));
    hl.addColorStop(1, U.rgbToCss(U.hexToRgb(pal.c3), 0));
    ctx.fillStyle = hl;
    ctx.fillRect(-L, -H * 1.3, L * 2, H * 1.6);
    ctx.restore();

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

    // eyes
    const n = art.eyes | 0;
    if (n > 0) {
      const er = Math.max(1.2, L * 0.030);
      for (let i = 0; i < n; i++) {
        const ex = L * (0.32 - (i % 3) * 0.09);
        const ey = -H * 0.24 + Math.floor(i / 3) * H * 0.42;
        ctx.fillStyle = '#f7f3e8';
        ctx.beginPath(); ctx.arc(ex, ey, er, 0, TAU); ctx.fill();
        ctx.fillStyle = '#0a0810';
        ctx.beginPath(); ctx.arc(ex + er * 0.22, ey, er * 0.52, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(ex - er * 0.28, ey - er * 0.3, er * 0.22, 0, TAU); ctx.fill();
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
    const over = (kind === 'ray' || kind === 'jelly') ? 2.2 : (kind === 'serpent' || kind === 'eel' || kind === 'ribbon') ? 3.4 : 1.35;
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
