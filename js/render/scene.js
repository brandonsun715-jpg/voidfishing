/* VOID FISHING — the scene.
   One canvas, drawn back to front: sky, stars, horizon feature, distant
   silhouettes, fog, water (gradient + reflection + moonpath + wave lines),
   underwater shapes, bobber and line, then the foreground ledge, the angler
   and the rod. Static layers are cached to offscreen canvases. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  let canvas = null, ctx = null;
  let W = 0, H = 0, DPR = 1;
  let t = 0;

  const L = {
    w: 0, h: 0, horizonY: 0, waterH: 0,
    rodTip: { x: 0, y: 0 }, rodHand: { x: 0, y: 0 },
    bobber: { x: 0, y: 0, scale: 1, visible: false, bob: 0 },
    castTarget: { x: 0, y: 0 },
    landPoint: { x: 0, y: 0 },
    glowX: 0, glowY: 0,
    figureH: 0, seatX: 0, seatY: 0
  };

  /* ---------------------------------------------------------------- stars */
  let stars = null;
  function buildStars() {
    const q = VF.state.data.settings.quality;
    const n = q === 'low' ? 90 : q === 'medium' ? 190 : 330;
    stars = new Array(n);
    const rnd = VF.rng.make(0xBEEF ^ VF.locations.index(VF.state.data.location) * 7919);
    for (let i = 0; i < n; i++) {
      stars[i] = {
        x: rnd(), y: Math.pow(rnd(), 1.35),
        s: 0.4 + Math.pow(rnd(), 2.6) * 2.1,
        tw: rnd() * TAU,
        sp: 0.4 + rnd() * 1.5,
        bright: 0.35 + rnd() * 0.65,
        big: rnd() < 0.05
      };
    }
  }

  /* ------------------------------------------------------- backdrop cache */
  let backdrop = null, backdropKey = '';

  function buildBackdrop() {
    const loc = VF.locations.current();
    const key = loc.id + ':' + Math.round(W) + 'x' + Math.round(H) + ':' + VF.state.data.settings.quality;
    if (backdropKey === key && backdrop) return;
    backdropKey = key;

    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H));
    const g = c.getContext('2d');
    const rnd = VF.rng.make(0xC0FFEE ^ VF.locations.index(loc.id) * 104729);
    const hy = L.horizonY;
    drawSilhouette(g, loc.silhouette, rnd, hy);
    backdrop = c;
  }

  /* Distant land: layered dark shapes sitting on the horizon line. */
  function drawSilhouette(g, style, rnd, hy) {
    if (style === 'none') return;
    const layers = 3;
    for (let l = 0; l < layers; l++) {
      const depth = l / (layers - 1 || 1);
      const alpha = 0.30 + depth * 0.55;
      const maxH = H * (0.026 + depth * 0.052);
      g.globalAlpha = alpha;
      g.fillStyle = '#000';
      g.beginPath();
      g.moveTo(-4, hy + 2);

      if (style === 'rocks') {
        // eroded, rounded headlands rather than sharp peaks
        let x = -4;
        let prev = 0;
        while (x < W + 8) {
          const wid = W * (0.08 + rnd() * 0.16);
          const ht = maxH * (0.30 + rnd() * 0.85);
          g.quadraticCurveTo(x + wid * 0.18, hy - ht * 0.85, x + wid * 0.42, hy - ht);
          g.quadraticCurveTo(x + wid * 0.70, hy - ht * (0.72 + rnd() * 0.28), x + wid, hy - prev);
          prev = maxH * (0.10 + rnd() * 0.30);
          x += wid;
        }
      } else if (style === 'trees') {
        let x = -4;
        while (x < W + 8) {
          const wid = W * (0.010 + rnd() * 0.024);
          const ht = maxH * (0.5 + rnd() * 1.3);
          g.lineTo(x, hy - ht * 0.2);
          g.lineTo(x + wid * 0.5, hy - ht);
          g.lineTo(x + wid, hy - ht * 0.15);
          x += wid * (1 + rnd() * 0.8);
        }
      } else if (style === 'spires') {
        let x = -4;
        while (x < W + 8) {
          const wid = W * (0.02 + rnd() * 0.05);
          const ht = maxH * (0.5 + rnd() * 1.6);
          g.lineTo(x + wid * 0.5, hy - ht);
          g.lineTo(x + wid, hy - ht * 0.08);
          x += wid * (1.1 + rnd() * 1.6);
        }
      } else if (style === 'crystals') {
        let x = -4;
        while (x < W + 8) {
          const wid = W * (0.03 + rnd() * 0.07);
          const ht = maxH * (0.4 + rnd() * 1.5);
          g.lineTo(x + wid * 0.2, hy - ht * 0.5);
          g.lineTo(x + wid * 0.5, hy - ht);
          g.lineTo(x + wid * 0.78, hy - ht * 0.42);
          g.lineTo(x + wid, hy);
          x += wid * (1 + rnd() * 1.1);
        }
      } else if (style === 'ruins') {
        let x = -4;
        while (x < W + 8) {
          const wid = W * (0.03 + rnd() * 0.08);
          const ht = maxH * (0.3 + rnd() * 1.2);
          if (rnd() < 0.7) {
            g.lineTo(x, hy - ht);
            g.lineTo(x + wid, hy - ht * (0.6 + rnd() * 0.5));
            g.lineTo(x + wid, hy);
          }
          x += wid * (1 + rnd() * 1.5);
        }
      } else if (style === 'bones') {
        let x = -4;
        while (x < W + 8) {
          const wid = W * (0.02 + rnd() * 0.05);
          const ht = maxH * (0.6 + rnd() * 1.5);
          g.lineTo(x + wid * 0.5, hy - ht);
          g.lineTo(x + wid * 0.5 + wid * 0.16, hy - ht * 0.86);
          g.lineTo(x + wid, hy - ht * 0.1);
          x += wid * (1.4 + rnd() * 2.4);
        }
      }
      g.lineTo(W + 8, hy + 2);
      g.closePath();
      g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- setup */

  function init(cv) {
    canvas = cv;
    ctx = cv.getContext('2d', { alpha: false });
    resize();
    VF.bus.on('location:changed', function () { backdropKey = ''; buildStars(); seedAmbient(); });
    VF.bus.on('settings:quality', function () { backdropKey = ''; buildStars(); VF.particles.clearAll(); seedAmbient(); });
  }

  function resize() {
    if (!canvas) return;
    DPR = Math.min(window.devicePixelRatio || 1, VF.state.data.settings.quality === 'low' ? 1 : 2);
    const r = canvas.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(240, r.height);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    L.w = W; L.h = H;
    computeLayout();
    backdropKey = '';
    if (!stars) buildStars();
  }

  function computeLayout() {
    const loc = VF.locations.current();
    L.horizonY = Math.round(H * (1 - loc.depth));
    L.waterH = H - L.horizonY;
    L.figureH = Math.min(H * 0.30, W * 0.20);
    L.glowX = W * 0.70;
    L.glowY = L.horizonY - H * 0.145;
    L.seatX = W * 0.20;
    L.seatY = H * 0.90;
    L.landPoint.x = W * 0.42;
    L.landPoint.y = L.horizonY + L.waterH * 0.90;
  }

  function seedAmbient() {
    VF.particles.clearKind(VF.particles.KIND.MOTE);
    const q = VF.state.data.settings.quality;
    const n = q === 'low' ? 14 : q === 'medium' ? 30 : 52;
    VF.particles.ambient(W, H, n, VF.palette.P.star);
  }

  /* ---------------------------------------------------------------- update */

  let castLateral = 0.62;

  function update(dt) {
    t += dt;
    computeLayout();
    updateRod(dt);
    updateBobber(dt);
    updateWeatherParticles(dt);
    VF.particles.update(dt, W, H, L.horizonY + L.waterH * 0.35);
  }

  /* Rod geometry. Bends under load and drifts gently when idle. */
  const rodState = { angle: 0, bend: 0, sway: 0 };

  function updateRod(dt) {
    const S = VF.fishing.S;
    const fh = L.figureH;
    L.rodHand.x = L.seatX + fh * 0.40;
    L.rodHand.y = L.seatY - fh * 0.52;

    let targetAngle = -0.62;                       // radians, up and to the right
    let targetBend = 0.10;

    if (S.state === 'casting') {
      const k = U.clamp(S.flight / 0.35, 0, 1);
      targetAngle = U.lerp(-1.25, -0.42, U.easeOutCubic(k));
      targetBend = U.lerp(0.55, 0.06, k);
    } else if (S.charging) {
      targetAngle = U.lerp(-0.62, -1.15, U.easeInOutSine(S.charge));
      targetBend = 0.10 + S.charge * 0.34;
    } else if (S.state === 'reeling' && S.fight) {
      targetAngle = -0.62 + S.fight.tension * 0.30;
      targetBend = 0.16 + S.fight.tension * 0.85 + S.fight.surge * 0.25;
    } else if (S.state === 'bite') {
      targetBend = 0.10 + Math.sin(t * 26) * 0.16;
    }

    rodState.sway = Math.sin(t * 0.55) * 0.014 + Math.sin(t * 0.23) * 0.02;
    rodState.angle = U.approach(rodState.angle, targetAngle, 0.0015, dt);
    rodState.bend = U.approach(rodState.bend, targetBend, 0.002, dt);
  }

  function rodTipPoint() {
    const fh = L.figureH;
    const len = fh * 1.85 * VF.rods.get(VF.state.data.rod).art.len;
    const a = rodState.angle + rodState.sway;
    const bend = rodState.bend;
    // quadratic curve: control point offset perpendicular to the rod line
    const ex = L.rodHand.x + Math.cos(a) * len;
    const ey = L.rodHand.y + Math.sin(a) * len;
    const nx = -Math.sin(a), ny = Math.cos(a);
    const cx = L.rodHand.x + Math.cos(a) * len * 0.5 + nx * len * bend * 0.30;
    const cy = L.rodHand.y + Math.sin(a) * len * 0.5 + ny * len * bend * 0.30;
    // tip follows the bend
    const tx = ex + nx * len * bend * 0.30;
    const ty = ey + ny * len * bend * 0.30;
    return { x: tx, y: ty, cx: cx, cy: cy, len: len, a: a };
  }

  function updateBobber(dt) {
    const S = VF.fishing.S;
    const tip = rodTipPoint();
    L.rodTip.x = tip.x; L.rodTip.y = tip.y;

    const b = L.bobber;
    const near = L.horizonY + L.waterH * 0.80;
    const far = L.horizonY + L.waterH * 0.09;
    const distT = U.clamp(S.castDist / 1.5, 0, 1);
    L.castTarget.x = W * castLateral;
    L.castTarget.y = U.lerp(near, far, distT);

    if (S.state === 'idle' || S.state === 'landed') { b.visible = false; return; }
    b.visible = true;

    if (S.state === 'casting') {
      const k = U.easeOutCubic(S.flight);
      b.x = U.lerp(tip.x, L.castTarget.x, k);
      const arc = Math.sin(S.flight * Math.PI) * L.waterH * 0.55;
      b.y = U.lerp(tip.y, L.castTarget.y, k) - arc;
      b.scale = U.lerp(1.0, scaleAt(L.castTarget.y), k);
    } else if (S.state === 'reeling' && S.fight) {
      const k = U.clamp(S.fight.distance, 0, 1);
      const swing = Math.sin(t * 3.1 + S.fight.elapsed) * S.fight.surge * L.waterH * 0.05;
      b.x = U.lerp(L.landPoint.x, L.castTarget.x, k) + swing;
      b.y = U.lerp(L.landPoint.y, L.castTarget.y, k);
      b.scale = scaleAt(b.y);
      b.bob = Math.sin(t * 9) * (0.5 + S.fight.surge) * 2.2;
    } else {
      b.x = L.castTarget.x;
      b.y = L.castTarget.y;
      b.scale = scaleAt(b.y);
      const nib = S.state === 'bite' ? 1 : S.nibble * 0.35;
      b.bob = Math.sin(t * (S.state === 'bite' ? 21 : 1.7)) * (1.4 + nib * 5.5);
    }
  }

  function scaleAt(y) {
    const k = U.clamp((y - L.horizonY) / Math.max(1, L.waterH), 0, 1);
    return U.lerp(0.34, 1.0, Math.pow(k, 0.85));
  }

  function newCastLateral() {
    castLateral = 0.54 + VF.rng.g() * 0.22;
  }

  /* ------------------------------------------------- weather particles */

  function updateWeatherParticles(dt) {
    const K = VF.particles.KIND;
    const q = VF.state.data.settings.quality;
    const scale = q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1;

    const rain = VF.weather.rain();
    if (rain > 0.02) {
      const want = Math.round(rain * 130 * scale);
      const have = VF.particles.countOf(K.RAIN);
      const spawnN = Math.min(8, Math.max(0, Math.round((want - have) * 0.25)));
      for (let i = 0; i < spawnN; i++) {
        VF.particles.spawn({
          x: Math.random() * (W * 1.3) - W * 0.15, y: -20,
          vx: 30 + rain * 60, vy: 620 + Math.random() * 340,
          life: 4, size: 0.6 + Math.random() * 0.9,
          color: [180, 210, 232], alpha: 0.18 + Math.random() * 0.22,
          kind: K.RAIN, drag: 1, grav: 60
        });
      }
    } else if (VF.particles.countOf(K.RAIN) > 0 && Math.random() < 0.2) {
      VF.particles.clearKind(K.RAIN);
    }

    const met = VF.weather.meteors();
    if (met > 0.05 && Math.random() < dt * 1.9 * met) spawnMeteor();
  }

  function spawnMeteor() {
    const K = VF.particles.KIND;
    const x = Math.random() * W * 1.2 - W * 0.1;
    const y = -20 - Math.random() * H * 0.15;
    const a = 0.55 + Math.random() * 0.5;
    const sp = 520 + Math.random() * 500;
    VF.particles.spawn({
      x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: 0.6 + Math.random() * 0.7, size: 1 + Math.random() * 2.1,
      color: [255, 232, 190], alpha: 0.9, kind: K.METEOR, drag: 1, grav: 0
    });
  }

  /* ---------------------------------------------------------------- draw */

  function draw() {
    const P = VF.palette.P;
    const q = VF.state.data.settings.quality;
    const shakeOff = VF.fx.shakeOffset();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shakeOff) ctx.translate(shakeOff.x, shakeOff.y);

    buildBackdrop();
    drawSky(P);
    drawStars(P, q);
    drawHorizonFeature(P);
    if (backdrop) ctx.drawImage(backdrop, 0, 0, W, H);
    drawAurora(P);
    drawFog(P, q);
    drawWater(P, q);
    drawUnderwater(P);
    VF.fx.drawRipples(ctx, 0.26);
    drawLineAndBobber(P);
    VF.particles.draw(ctx);
    drawForeground(P);
    drawVignette(P);
    VF.fx.drawOverlay(ctx, W, H);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }

  function drawSky(P) {
    const g = ctx.createLinearGradient(0, 0, 0, L.horizonY);
    g.addColorStop(0, U.rgbToCss(P.skyTop));
    g.addColorStop(1, U.rgbToCss(P.skyBot));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, L.horizonY + 31);

    // light gathering at the horizon — this is what makes distant land read
    const band = H * 0.26;
    const hg = ctx.createLinearGradient(0, L.horizonY - band, 0, L.horizonY);
    hg.addColorStop(0, U.rgbToCss(P.glow, 0));
    hg.addColorStop(0.62, U.rgbToCss(P.glow, 0.045 * P.bright + 0.020));
    hg.addColorStop(1, U.rgbToCss(P.glow, 0.115 * P.bright + 0.045));
    ctx.fillStyle = hg;
    ctx.fillRect(0, L.horizonY - band, W, band);
  }

  function drawStars(P, q) {
    if (P.starAlpha <= 0.01 || !stars) return;
    const sky = L.horizonY;
    const col = U.rgbToCss(P.star);
    ctx.fillStyle = col;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const y = s.y * sky;
      if (y > sky - 2) continue;
      const tw = 0.62 + 0.38 * Math.sin(t * s.sp + s.tw);
      const a = P.starAlpha * s.bright * tw;
      if (a <= 0.02) continue;
      ctx.globalAlpha = a;
      const x = s.x * W;
      if (s.big && q !== 'low') {
        ctx.globalAlpha = a * 0.22;
        ctx.beginPath(); ctx.arc(x, y, s.s * 3.2, 0, TAU); ctx.fill();
        ctx.globalAlpha = a;
      }
      ctx.fillRect(x - s.s * 0.5, y - s.s * 0.5, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  /* The one big light source: moon, ring, arch, monolith, crystal, tear, eye. */
  function drawHorizonFeature(P) {
    const loc = VF.locations.current();
    const gx = L.glowX, gy = L.glowY;
    const R = Math.min(W, H) * 0.046 * P.glowSize;
    const glow = U.rgbToCss(P.glow);

    // ambient bloom around the feature
    const bg = ctx.createRadialGradient(gx, gy, 0, gx, gy, R * 13);
    bg.addColorStop(0, U.rgbToCss(P.glow, 0.44 * P.bright + 0.16));
    bg.addColorStop(0.14, U.rgbToCss(P.glow, 0.20 * P.bright + 0.07));
    bg.addColorStop(0.42, U.rgbToCss(P.glow, 0.055 * P.bright + 0.022));
    bg.addColorStop(1, U.rgbToCss(P.glow, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = bg;
    ctx.fillRect(gx - R * 13, gy - R * 13, R * 26, R * 26);
    ctx.restore();

    ctx.save();
    switch (loc.horizon) {
      case 'moon': {
        ctx.fillStyle = U.rgbToCss(U.shade(P.glow, 0.55));
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(gx, gy, R, 0, TAU); ctx.fill();
        // craters
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(gx - R * 0.28, gy - R * 0.18, R * 0.22, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + R * 0.30, gy + R * 0.22, R * 0.15, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + R * 0.05, gy - R * 0.42, R * 0.10, 0, TAU); ctx.fill();
        break;
      }
      case 'ring': {
        ctx.strokeStyle = glow; ctx.globalAlpha = 0.55; ctx.lineWidth = R * 0.16;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 3.1, R * 0.85, -0.13, Math.PI * 0.06, Math.PI * 1.34); ctx.stroke();
        ctx.globalAlpha = 0.28; ctx.lineWidth = R * 0.07;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 3.6, R * 1.0, -0.13, Math.PI * 1.5, Math.PI * 1.92); ctx.stroke();
        ctx.globalAlpha = 0.85; ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gx, gy, R * 0.42, 0, TAU); ctx.fill();
        break;
      }
      case 'arch': {
        ctx.strokeStyle = glow; ctx.globalAlpha = 0.42; ctx.lineWidth = R * 0.20;
        ctx.beginPath(); ctx.arc(gx, L.horizonY, R * 3.4, Math.PI, TAU); ctx.stroke();
        ctx.globalAlpha = 0.20; ctx.lineWidth = R * 0.09;
        ctx.beginPath(); ctx.arc(gx, L.horizonY, R * 4.3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        break;
      }
      case 'monolith': {
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#05070b';
        const mw = R * 0.72, mh = R * 6.2;
        ctx.fillRect(gx - mw / 2, L.horizonY - mh, mw, mh);
        ctx.globalAlpha = 0.55; ctx.fillStyle = glow;
        ctx.fillRect(gx - mw * 0.10, L.horizonY - mh * 0.86, mw * 0.20, mh * 0.66);
        break;
      }
      case 'crystal': {
        ctx.globalAlpha = 0.70; ctx.fillStyle = glow;
        for (let i = 0; i < 5; i++) {
          const ox = gx + (i - 2) * R * 1.25;
          const hh = R * (2.0 + (i % 3) * 1.5);
          ctx.beginPath();
          ctx.moveTo(ox, L.horizonY - hh);
          ctx.lineTo(ox + R * 0.42, L.horizonY - hh * 0.35);
          ctx.lineTo(ox + R * 0.22, L.horizonY + 2);
          ctx.lineTo(ox - R * 0.26, L.horizonY + 2);
          ctx.lineTo(ox - R * 0.44, L.horizonY - hh * 0.38);
          ctx.closePath();
          ctx.globalAlpha = 0.22 + (i % 3) * 0.16;
          ctx.fill();
        }
        break;
      }
      case 'tear': {
        ctx.globalAlpha = 0.85; ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(gx, gy - R * 3.0);
        ctx.quadraticCurveTo(gx + R * 0.55, gy, gx, gy + R * 2.6);
        ctx.quadraticCurveTo(gx - R * 0.34, gy, gx, gy - R * 3.0);
        ctx.fill();
        ctx.globalAlpha = 0.6; ctx.strokeStyle = glow; ctx.lineWidth = R * 0.06;
        ctx.stroke();
        break;
      }
      case 'eye': {
        const open = 0.34 + 0.14 * Math.sin(t * 0.19);
        ctx.globalAlpha = 0.34; ctx.fillStyle = glow;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 4.2, R * 4.2 * open, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.95; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 1.5, R * 1.5 * Math.min(1, open * 2.4), 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.7; ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gx + R * 0.4, gy - R * 0.4, R * 0.22, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawAurora(P) {
    const a = VF.weather.aurora();
    if (a <= 0.02) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let b = 0; b < 3; b++) {
      const phase = t * (0.12 + b * 0.05) + b * 2.1;
      const baseY = L.horizonY * (0.24 + b * 0.14);
      const amp = L.horizonY * (0.06 + b * 0.03);
      const g = ctx.createLinearGradient(0, baseY - amp * 3, 0, baseY + amp * 3.5);
      const hue = b === 0 ? [90, 230, 190] : b === 1 ? [120, 170, 255] : [200, 130, 240];
      g.addColorStop(0, U.rgbToCss(hue, 0));
      g.addColorStop(0.5, U.rgbToCss(hue, 0.13 * a));
      g.addColorStop(1, U.rgbToCss(hue, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-10, baseY);
      for (let x = -10; x <= W + 10; x += 26) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.0055 + phase) * amp + Math.sin(x * 0.0021 - phase * 1.6) * amp * 0.7);
      }
      ctx.lineTo(W + 10, baseY - amp * 4);
      for (let x = W + 10; x >= -10; x -= 26) {
        ctx.lineTo(x, baseY + Math.sin(x * 0.0055 + phase) * amp - amp * (2.6 + Math.sin(x * 0.004 + phase) * 0.9));
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFog(P, q) {
    const amt = P.fogAmt;
    if (amt <= 0.02) return;
    const bands = q === 'low' ? 2 : 3;
    for (let i = 0; i < bands; i++) {
      const y = L.horizonY - H * (0.02 + i * 0.055);
      const hgt = H * (0.05 + i * 0.045);
      const drift = Math.sin(t * (0.045 + i * 0.02) + i * 2.2) * W * 0.09;
      const g = ctx.createLinearGradient(0, y - hgt, 0, y + hgt * 0.5);
      g.addColorStop(0, U.rgbToCss(P.fog, 0));
      g.addColorStop(0.55, U.rgbToCss(P.fog, amt * (0.30 - i * 0.06)));
      g.addColorStop(1, U.rgbToCss(P.fog, 0));
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(drift, 0);
      ctx.fillRect(-W * 0.2, y - hgt, W * 1.4, hgt * 1.5);
      ctx.restore();
    }
    // ground haze sitting on the water
    const g2 = ctx.createLinearGradient(0, L.horizonY - H * 0.01, 0, L.horizonY + L.waterH * 0.32);
    g2.addColorStop(0, U.rgbToCss(P.fog, amt * 0.34));
    g2.addColorStop(1, U.rgbToCss(P.fog, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, L.horizonY - H * 0.01, W, L.waterH * 0.34);
  }

  /* ---------------------------------------------------------------- water */

  function drawWater(P, q) {
    const hy = L.horizonY, wh = L.waterH;

    const g = ctx.createLinearGradient(0, hy, 0, H);
    g.addColorStop(0, U.rgbToCss(P.waterTop));
    g.addColorStop(0.55, U.rgbToCss(U.mixRgb(P.waterTop, P.waterBot, 0.7)));
    g.addColorStop(1, U.rgbToCss(P.waterBot));
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, wh + 2);

    // horizon seam: a thin bright line where sky meets water
    ctx.globalAlpha = 0.46 * P.bright + 0.14;
    ctx.fillStyle = U.rgbToCss(P.glow);
    ctx.fillRect(0, hy - 1, W, 1.3);
    ctx.globalAlpha = 1;

    if (q !== 'low') { drawBackdropReflection(P); drawReflection(P); }
    drawMoonpath(P);
    drawWaveLines(P, q);

    // deepen the very near water so the foreground reads as close
    const g3 = ctx.createLinearGradient(0, H - wh * 0.26, 0, H);
    g3.addColorStop(0, U.rgbToCss(P.waterBot, 0));
    g3.addColorStop(1, U.rgbToCss(P.waterBot, 0.55));
    ctx.fillStyle = g3;
    ctx.fillRect(0, H - wh * 0.26, W, wh * 0.26 + 2);
  }

  /* Mirror the distant land into the water, faded and wobbling. */
  function drawBackdropReflection(P) {
    if (!backdrop) return;
    const hy = L.horizonY, wh = L.waterH;
    const depth = Math.min(wh * 0.42, H * 0.20);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, hy, W, depth);
    ctx.clip();
    ctx.globalAlpha = 0.30;
    ctx.translate(0, hy * 2);
    ctx.scale(1, -1);
    // slight horizontal shear makes the mirror read as a moving surface
    ctx.transform(1, 0, Math.sin(t * 0.5) * 0.010, 1, 0, 0);
    ctx.drawImage(backdrop, 0, 0, W, H);
    ctx.restore();

    const fade = ctx.createLinearGradient(0, hy, 0, hy + depth);
    fade.addColorStop(0, U.rgbToCss(P.waterTop, 0.15));
    fade.addColorStop(1, U.rgbToCss(P.waterTop, 0.92));
    ctx.fillStyle = fade;
    ctx.fillRect(0, hy, W, depth);
  }

  function drawReflection(P) {
    if (P.starAlpha <= 0.03 || !stars) return;
    const hy = L.horizonY;
    ctx.fillStyle = U.rgbToCss(P.star);
    const limit = Math.min(stars.length, 150);
    for (let i = 0; i < limit; i++) {
      const s = stars[i];
      const sy = s.y * hy;
      const ry = hy + (hy - sy) * 0.55;
      if (ry > H) continue;
      const depth = (ry - hy) / Math.max(1, L.waterH);
      const wob = Math.sin(ry * 0.09 + t * 1.15) * (2 + depth * 12);
      const a = P.starAlpha * s.bright * 0.34 * (1 - depth * 0.8);
      if (a <= 0.015) continue;
      ctx.globalAlpha = a;
      ctx.fillRect(s.x * W + wob - s.s * 0.6, ry, s.s * 1.3, s.s * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  /* The signature look: a shimmering path of light from the horizon feature. */
  function drawMoonpath(P) {
    const hy = L.horizonY, wh = L.waterH;
    const steps = VF.state.data.settings.quality === 'low' ? 22 : 44;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < steps; i++) {
      const k = i / steps;
      const y = hy + Math.pow(k, 1.30) * wh;
      const spread = U.lerp(W * 0.022, W * 0.26, Math.pow(k, 0.70));
      const calmK = VF.encounters ? 1 - VF.encounters.calm() * 0.9 : 1;
      const wob = (Math.sin(y * 0.055 + t * 1.35) * spread * 0.42
                + Math.sin(y * 0.021 - t * 0.8) * spread * 0.30) * calmK;
      const a = (0.20 * P.bright + 0.075) * (1 - Math.pow(k, 1.7)) * (0.35 + 0.65 * (1 - k));
      if (a <= 0.004) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = U.rgbToCss(P.glow);
      const hgt = Math.max(1.1, wh / steps * 0.85);
      ctx.beginPath();
      ctx.ellipse(L.glowX + wob, y, spread * (0.6 + Math.sin(y * 0.08 + t) * 0.18), hgt * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* The surface. Lines are spaced and shaped irregularly and each carries its
     own phase and amplitude, so it reads as swell rather than as scanlines. */
  function drawWaveLines(P, q) {
    const hy = L.horizonY, wh = L.waterH;
    const lines = q === 'low' ? 18 : q === 'medium' ? 30 : 44;
    const seg = q === 'low' ? 12 : 22;
    const calm = VF.encounters ? VF.encounters.calm() : 0;
    const wind = (0.35 + VF.weather.wind() * 1.3) * (1 - calm * 0.88);
    const chop = (1 + VF.weather.rain() * 0.9 + VF.weather.wind() * 0.8) * (1 - calm * 0.92);

    const crest = U.mixRgb(P.waterTop, P.glow, 0.80);
    const trough = U.mixRgb(P.waterBot, [0, 0, 0], 0.35);

    ctx.lineWidth = 1;
    for (let i = 0; i < lines; i++) {
      // uneven spacing: each band is nudged by a fixed per-line offset
      const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const k = U.clamp((i + 0.35 + jitter * 0.55) / lines, 0, 1);
      const y = hy + Math.pow(k, 1.42) * wh;
      if (y > H + 4) continue;

      const amp = U.lerp(0.35, 6.4, Math.pow(k, 1.25)) * chop;
      const ph = i * 2.399;                       // golden-angle phase spread
      const f1 = 0.0055 + k * 0.010;
      const f2 = 0.021 + jitter * 0.014;
      const speed = wind * (0.45 + k * 1.1);

      // brighter bands catch the light, darker ones read as troughs
      const bright = 0.5 + 0.5 * Math.sin(i * 1.7 + t * 0.35);
      const col = bright > 0.55 ? crest : trough;
      const a = U.lerp(0.05, 0.30, Math.pow(k, 1.15)) * (0.35 + P.bright * 0.85) *
                (1 - calm * 0.5) * (bright > 0.55 ? bright : 0.55);
      if (a <= 0.012) continue;

      ctx.globalAlpha = a;
      ctx.strokeStyle = U.rgbToCss(col);
      ctx.beginPath();
      for (let j = 0; j <= seg; j++) {
        const x = (j / seg) * (W + 60) - 30;
        const yy = y
          + Math.sin(x * f1 + t * speed + ph) * amp
          + Math.sin(x * f2 - t * speed * 1.7 + ph * 1.7) * amp * 0.42
          + Math.sin(x * 0.0016 + t * 0.11 + ph) * amp * 1.15;
        if (j === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }

    // a handful of bright glints where the light lands on a crest
    if (q !== 'low') {
      ctx.globalCompositeOperation = 'lighter';
      const n = 14;
      for (let i = 0; i < n; i++) {
        const jitter = ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1;
        const k = 0.12 + jitter * 0.8;
        const y = hy + Math.pow(k, 1.4) * wh;
        const drift = (t * (6 + jitter * 14)) % (W + 200) - 100;
        const x = ((jitter * W * 1.7) + drift) % (W + 120) - 60;
        const tw = 0.5 + 0.5 * Math.sin(t * (1.4 + jitter * 2.6) + i);
        ctx.globalAlpha = 0.16 * tw * (0.3 + P.bright) * (1 - calm * 0.7);
        ctx.fillStyle = U.rgbToCss(P.glow);
        ctx.beginPath();
        ctx.ellipse(x, y, U.lerp(4, 22, k), U.lerp(0.5, 1.4, k), 0, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  /* Slow dark shapes drifting under the surface. Pure atmosphere. */
  const shadows = [];
  function addShadow(opts) {
    if (shadows.length > 6) shadows.shift();
    shadows.push(Object.assign({ life: 9, max: 9, x: -0.1, y: 0.5, sp: 0.06, size: 1, alpha: 0.5 }, opts));
  }

  function drawUnderwater(P) {
    const hy = L.horizonY, wh = L.waterH;
    for (let i = shadows.length - 1; i >= 0; i--) {
      const s = shadows[i];
      s.life -= 1 / 60;
      s.x += s.sp / 60;
      if (s.life <= 0 || s.x > 1.2) { shadows.splice(i, 1); continue; }
      const k = U.clamp(s.life / s.max, 0, 1);
      const fade = Math.sin(k * Math.PI);
      const y = hy + wh * s.y;
      const sc = scaleAt(y) * s.size;
      ctx.globalAlpha = s.alpha * fade;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(s.x * W, y + Math.sin(t * 0.8 + i) * 3, W * 0.075 * sc, wh * 0.028 * sc, Math.sin(t * 0.4 + i) * 0.12, 0, TAU);
      ctx.fill();
      if (s.glow) {
        ctx.globalAlpha = s.alpha * fade * 0.55;
        ctx.fillStyle = s.glow;
        ctx.beginPath();
        ctx.ellipse(s.x * W, y, W * 0.030 * sc, wh * 0.012 * sc, 0, 0, TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------- line + bobber */

  function drawLineAndBobber(P) {
    const b = L.bobber;
    if (!b.visible) return;
    const S = VF.fishing.S;
    const tip = L.rodTip;

    // The line sags when slack and straightens under tension.
    let tension = 0.25;
    if (S.state === 'reeling' && S.fight) tension = 0.15 + S.fight.tension * 0.85;
    else if (S.state === 'bite') tension = 0.55;
    const sag = (1 - tension) * Math.hypot(b.x - tip.x, b.y - tip.y) * 0.16;
    const mx = (tip.x + b.x) / 2;
    const my = (tip.y + b.y) / 2 + sag;

    const shake = (S.state === 'reeling' && S.fight) ? S.fight.shakeAmt : 0;
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.4),
                                 0.30 + tension * 0.35 + shake * 0.3);
    ctx.lineWidth = 1 + shake * 0.8;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo(mx + (shake ? Math.sin(t * 47) * shake * 4 : 0), my, b.x, b.y + b.bob);
    ctx.stroke();

    // The fish itself, rising as it comes in.
    if (S.state === 'reeling' && S.fight) drawHookedFish(S.fight, b);

    const by = b.y + b.bob;
    const r = 5.5 * b.scale;

    // bobber shadow on the water
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(b.x, by + r * 0.9, r * 1.5, r * 0.45, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#c8402f';
    ctx.beginPath(); ctx.arc(b.x, by - r * 0.3, r, Math.PI, TAU); ctx.fill();
    ctx.fillStyle = '#e8e4dc';
    ctx.beginPath(); ctx.arc(b.x, by - r * 0.3, r, 0, Math.PI); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(b.x, by - r * 0.3, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = U.rgbToCss(P.glow, 0.7);
    ctx.fillRect(b.x - r * 0.18, by - r * 1.5, r * 0.36, r * 0.7);
  }

  function drawHookedFish(f, b) {
    const c = f.c;
    const k = 1 - U.clamp(f.distance, 0, 1);
    if (k < 0.12) return;
    const sc = scaleAt(b.y);
    const size = Math.min(W, H) * 0.055 * sc * (0.5 + k) * (0.7 + VF.rarities.rank(c.rarity) * 0.09);
    const y = b.y + 14 * sc + Math.sin(t * 4) * 3 * f.surge;
    const x = b.x + Math.sin(t * 2.3) * 8 * sc * (0.4 + f.surge);
    ctx.save();
    ctx.globalAlpha = U.clamp((k - 0.1) * 1.4, 0, 1) * 0.85;
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 3.4) * 0.22 * (0.5 + f.surge));
    VF.fishArt.drawSilhouette(ctx, c.fish, size, k * 0.9);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------- foreground */

  function drawForeground(P) {
    const fh = L.figureH;
    const seatX = L.seatX, seatY = L.seatY;
    const rimA = 0.13 + P.bright * 0.16;
    const rim = U.rgbToCss(P.glow, rimA);
    const dark = '#03050a';

    /* --- the ledge the angler is sitting on --- */
    const lipY = seatY + fh * 0.16;
    ctx.beginPath();
    ctx.moveTo(-12, H + 12);
    ctx.lineTo(-12, lipY - fh * 0.10);
    ctx.quadraticCurveTo(W * 0.07, lipY - fh * 0.16, seatX + fh * 0.10, lipY - fh * 0.03);
    ctx.quadraticCurveTo(seatX + fh * 0.62, lipY + fh * 0.10, seatX + fh * 0.98, lipY + fh * 0.52);
    ctx.lineTo(seatX + fh * 1.3, H + 12);
    ctx.closePath();
    // a hair above pure black so the silhouette separates from the deep water
    const lg = ctx.createLinearGradient(0, lipY - fh * 0.2, 0, H);
    lg.addColorStop(0, '#080c13');
    lg.addColorStop(1, '#010204');
    ctx.fillStyle = lg;
    ctx.fill();

    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(-12, lipY - fh * 0.10);
    ctx.quadraticCurveTo(W * 0.07, lipY - fh * 0.16, seatX + fh * 0.10, lipY - fh * 0.03);
    ctx.quadraticCurveTo(seatX + fh * 0.62, lipY + fh * 0.10, seatX + fh * 0.98, lipY + fh * 0.52);
    ctx.stroke();

    drawAngler(seatX, seatY, fh, dark, rim);
    drawRod(P);
  }

  /* A seated figure in near-profile, facing the water.
     Proportions: total seated height fh, head about a seventh of it. */
  function drawAngler(x, y, fh, dark, rim) {
    const br = Math.sin(t * 0.85) * fh * 0.008;      // breathing
    const headR = fh * 0.082;
    const headX = x + fh * 0.12;
    const headY = y - fh * 0.855 + br;
    const neckY = y - fh * 0.735 + br;
    const shX = x + fh * 0.045, shY = y - fh * 0.685 + br;
    const hipX = x, hipY = y - fh * 0.055;
    const kneeX = x + fh * 0.52, kneeY = y - fh * 0.28;
    const footX = x + fh * 0.46, footY = y + fh * 0.10;

    ctx.fillStyle = dark;
    ctx.strokeStyle = dark;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    /* far leg, slightly behind */
    ctx.lineWidth = fh * 0.115;
    ctx.beginPath();
    ctx.moveTo(hipX + fh * 0.02, hipY);
    ctx.lineTo(kneeX - fh * 0.05, kneeY + fh * 0.05);
    ctx.lineTo(footX - fh * 0.06, footY);
    ctx.stroke();

    /* torso: hip to shoulder, hunched forward over the rod */
    ctx.beginPath();
    ctx.moveTo(hipX - fh * 0.15, hipY + fh * 0.06);
    ctx.quadraticCurveTo(hipX - fh * 0.21, y - fh * 0.42 + br, shX - fh * 0.10, shY);
    ctx.quadraticCurveTo(shX + fh * 0.09, shY - fh * 0.06, shX + fh * 0.17, shY + fh * 0.05);
    ctx.quadraticCurveTo(hipX + fh * 0.24, y - fh * 0.30, hipX + fh * 0.19, hipY + fh * 0.06);
    ctx.closePath();
    ctx.fill();

    /* near leg, knee up */
    ctx.lineWidth = fh * 0.125;
    ctx.beginPath();
    ctx.moveTo(hipX + fh * 0.06, hipY + fh * 0.01);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    /* boot */
    ctx.beginPath();
    ctx.ellipse(footX + fh * 0.04, footY + fh * 0.02, fh * 0.10, fh * 0.055, -0.12, 0, TAU);
    ctx.fill();

    /* neck + head */
    ctx.lineWidth = fh * 0.055;
    ctx.beginPath();
    ctx.moveTo(shX + fh * 0.03, shY);
    ctx.lineTo(headX - fh * 0.01, neckY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, TAU);
    ctx.fill();
    /* hood, drawn back over the skull and down the neck */
    ctx.beginPath();
    ctx.moveTo(headX - headR * 1.15, headY + headR * 0.55);
    ctx.quadraticCurveTo(headX - headR * 1.5, headY - headR * 1.5, headX + headR * 0.15, headY - headR * 1.35);
    ctx.quadraticCurveTo(headX + headR * 1.25, headY - headR * 1.1, headX + headR * 0.95, headY - headR * 0.15);
    ctx.quadraticCurveTo(headX - headR * 0.2, headY - headR * 0.75, headX - headR * 1.15, headY + headR * 0.55);
    ctx.closePath();
    ctx.fill();

    /* arm reaching out to the rod hand */
    ctx.lineWidth = fh * 0.075;
    ctx.beginPath();
    ctx.moveTo(shX + fh * 0.12, shY + fh * 0.06);
    ctx.quadraticCurveTo(x + fh * 0.30, y - fh * 0.60, L.rodHand.x, L.rodHand.y);
    ctx.stroke();
    /* second hand steadying the butt of the rod */
    ctx.lineWidth = fh * 0.062;
    ctx.beginPath();
    ctx.moveTo(shX + fh * 0.10, shY + fh * 0.12);
    ctx.quadraticCurveTo(x + fh * 0.16, y - fh * 0.44, L.rodHand.x - fh * 0.20, L.rodHand.y + fh * 0.12);
    ctx.stroke();

    /* rim light down the back and over the hood — the only thing separating
       the figure from the water behind it */
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hipX - fh * 0.15, hipY + fh * 0.02);
    ctx.quadraticCurveTo(hipX - fh * 0.21, y - fh * 0.42 + br, shX - fh * 0.10, shY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX - headR * 1.15, headY + headR * 0.5);
    ctx.quadraticCurveTo(headX - headR * 1.5, headY - headR * 1.5, headX + headR * 0.15, headY - headR * 1.35);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hipX + fh * 0.06, hipY);
    ctx.lineTo(kneeX, kneeY - fh * 0.05);
    ctx.stroke();
  }

  function drawRod(P) {
    const rod = VF.rods.get(VF.state.data.rod);
    const art = rod.art;
    const tip = rodTipPoint();
    const hand = L.rodHand;
    const a = tip.a;
    const buttX = hand.x - Math.cos(a) * tip.len * 0.13;
    const buttY = hand.y - Math.sin(a) * tip.len * 0.13;

    // glow for the fancier rods
    if (art.glow > 0.02) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgbToCss(U.hexToRgb(art.tip), 0.13 * art.glow);
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(buttX, buttY);
      ctx.quadraticCurveTo(tip.cx, tip.cy, tip.x, tip.y);
      ctx.stroke();
      ctx.restore();
    }

    // tapered blank: three passes from thick to thin
    const passes = [[3.2, art.c2, 0], [2.0, art.c1, 0.18], [0.9, art.tip, 0.45]];
    for (let i = 0; i < passes.length; i++) {
      const [wid, col, from] = passes[i];
      ctx.strokeStyle = col;
      ctx.lineWidth = wid;
      ctx.lineCap = 'round';
      ctx.beginPath();
      const sx = U.lerp(buttX, tip.x, from), sy = U.lerp(buttY, tip.y, from);
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(tip.cx, tip.cy, tip.x, tip.y);
      ctx.stroke();
    }

    // grip
    ctx.strokeStyle = art.grip;
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(buttX, buttY);
    ctx.lineTo(hand.x + Math.cos(a) * tip.len * 0.06, hand.y + Math.sin(a) * tip.len * 0.06);
    ctx.stroke();

    // reel
    const rx = hand.x + Math.cos(a) * tip.len * 0.09 - Math.sin(a) * 5;
    const ry = hand.y + Math.sin(a) * tip.len * 0.09 + Math.cos(a) * 5;
    ctx.fillStyle = art.c2;
    ctx.beginPath(); ctx.arc(rx, ry, 5.2, 0, TAU); ctx.fill();
    ctx.strokeStyle = art.tip; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(rx, ry, 5.2, 0, TAU); ctx.stroke();
    const spin = VF.fishing.S.state === 'reeling' && VF.fishing.S.fight && VF.fishing.S.fight.reeling ? t * 12 : t * 0.4;
    ctx.beginPath();
    ctx.moveTo(rx, ry);
    ctx.lineTo(rx + Math.cos(spin) * 4.2, ry + Math.sin(spin) * 4.2);
    ctx.stroke();

    // guides
    if (art.style !== 'plain') {
      ctx.fillStyle = art.tip;
      for (let i = 1; i <= 3; i++) {
        const k = 0.30 + i * 0.20;
        const gx = quadAt(buttX, tip.cx, tip.x, k);
        const gy = quadAt(buttY, tip.cy, tip.y, k);
        ctx.globalAlpha = 0.55 + art.glow * 0.4;
        ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  function quadAt(p0, p1, p2, k) {
    const m = 1 - k;
    return m * m * p0 + 2 * m * k * p1 + k * k * p2;
  }

  function drawVignette(P) {
    const pulse = VF.fx.pulseAmt();
    const g = ctx.createRadialGradient(W * 0.5, H * 0.52, Math.min(W, H) * 0.28,
                                       W * 0.5, H * 0.52, Math.max(W, H) * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,' + (0.55 + pulse * 0.3).toFixed(3) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  VF.scene = {
    init: init, resize: resize, update: update, draw: draw,
    L: L, addShadow: addShadow, newCastLateral: newCastLateral,
    spawnMeteor: spawnMeteor, seedAmbient: seedAmbient,
    rebuild: function () { backdropKey = ''; buildStars(); },
    size: function () { return { w: W, h: H }; },
    ctx: function () { return ctx; }
  };
})(window.VF = window.VF || {});
