/* VOID FISHING — the person doing the fishing.
   Shared by the scene and by the outfit previews. Drawn with the seat at the
   local origin; the caller translates. Outfit cosmetics only change how they
   look — proportions and the rod hand stay exactly where they were. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  /* cfg: { body, rim, hood, scarf, lamp, stars, fade }
     hand: { x, y } in the same local space, or null for the preview pose. */
  function draw(ctx, cfg, fh, t, preview, hand, rimCol) {
    cfg = cfg || {};
    const dark = cfg.body || '#03050a';
    const rim = rimCol || 'rgba(200,220,255,0.20)';
    const br = Math.sin(t * 0.85) * fh * 0.008;
    const headR = fh * 0.082 * (cfg.hood ? 1.05 : 1);
    const headX = fh * 0.12;
    const headY = -fh * 0.855 + br;
    const neckY = -fh * 0.735 + br;
    const shX = fh * 0.045, shY = -fh * 0.685 + br;
    const hipX = 0, hipY = -fh * 0.055;
    const kneeX = fh * 0.52, kneeY = -fh * 0.28;
    const footX = fh * 0.46, footY = fh * 0.10;
    const handPt = hand || { x: fh * 0.40, y: -fh * 0.52 };

    ctx.save();
    if (cfg.fade) ctx.globalAlpha = 0.55 + 0.12 * Math.sin(t * 0.6);

    ctx.fillStyle = dark;
    ctx.strokeStyle = dark;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    /* far leg */
    ctx.lineWidth = fh * 0.115;
    ctx.beginPath();
    ctx.moveTo(hipX + fh * 0.02, hipY);
    ctx.lineTo(kneeX - fh * 0.05, kneeY + fh * 0.05);
    ctx.lineTo(footX - fh * 0.06, footY);
    ctx.stroke();

    /* torso */
    ctx.beginPath();
    ctx.moveTo(hipX - fh * 0.15, hipY + fh * 0.06);
    ctx.quadraticCurveTo(hipX - fh * 0.21, -fh * 0.42 + br, shX - fh * 0.10, shY);
    ctx.quadraticCurveTo(shX + fh * 0.09, shY - fh * 0.06, shX + fh * 0.17, shY + fh * 0.05);
    ctx.quadraticCurveTo(hipX + fh * 0.24, -fh * 0.30, hipX + fh * 0.19, hipY + fh * 0.06);
    ctx.closePath();
    ctx.fill();

    /* near leg and boot */
    ctx.lineWidth = fh * 0.125;
    ctx.beginPath();
    ctx.moveTo(hipX + fh * 0.06, hipY + fh * 0.01);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(footX + fh * 0.04, footY + fh * 0.02, fh * 0.10, fh * 0.055, -0.12, 0, TAU);
    ctx.fill();

    /* neck and head */
    ctx.lineWidth = fh * 0.055;
    ctx.beginPath();
    ctx.moveTo(shX + fh * 0.03, shY);
    ctx.lineTo(headX - fh * 0.01, neckY);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, TAU);
    ctx.fill();

    /* hood */
    const hs = cfg.hood || 1;
    ctx.beginPath();
    ctx.moveTo(headX - headR * 1.15 * hs, headY + headR * 0.55);
    ctx.quadraticCurveTo(headX - headR * 1.5 * hs, headY - headR * 1.5 * hs, headX + headR * 0.15, headY - headR * 1.35 * hs);
    ctx.quadraticCurveTo(headX + headR * 1.25, headY - headR * 1.1, headX + headR * 0.95, headY - headR * 0.15);
    ctx.quadraticCurveTo(headX - headR * 0.2, headY - headR * 0.75, headX - headR * 1.15 * hs, headY + headR * 0.55);
    ctx.closePath();
    ctx.fill();

    /* arms */
    ctx.lineWidth = fh * 0.075;
    ctx.beginPath();
    ctx.moveTo(shX + fh * 0.12, shY + fh * 0.06);
    ctx.quadraticCurveTo(fh * 0.30, -fh * 0.60, handPt.x, handPt.y);
    ctx.stroke();
    ctx.lineWidth = fh * 0.062;
    ctx.beginPath();
    ctx.moveTo(shX + fh * 0.10, shY + fh * 0.12);
    ctx.quadraticCurveTo(fh * 0.16, -fh * 0.44, handPt.x - fh * 0.20, handPt.y + fh * 0.12);
    ctx.stroke();

    /* ---- outfit flourishes ---- */
    if (cfg.scarf) {
      ctx.strokeStyle = 'rgba(190,70,80,0.9)';
      ctx.lineWidth = fh * 0.055;
      ctx.beginPath();
      ctx.moveTo(headX - headR * 0.9, neckY + fh * 0.02);
      ctx.quadraticCurveTo(shX - fh * 0.14, -fh * 0.55 + br,
                           shX - fh * 0.30 - Math.sin(t * 1.1) * fh * 0.06, -fh * 0.30 + Math.sin(t * 0.9) * fh * 0.04);
      ctx.stroke();
      ctx.lineWidth = fh * 0.04;
      ctx.beginPath();
      ctx.moveTo(headX - headR * 0.6, neckY + fh * 0.03);
      ctx.quadraticCurveTo(shX - fh * 0.05, -fh * 0.50, shX + fh * 0.02, -fh * 0.34);
      ctx.stroke();
    }
    if (cfg.lamp) {
      const lx = hipX - fh * 0.30, ly = -fh * 0.14;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, fh * 0.42);
      g.addColorStop(0, 'rgba(255,226,150,0.55)');
      g.addColorStop(1, 'rgba(255,226,150,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - fh * 0.42, ly - fh * 0.42, fh * 0.84, fh * 0.84);
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(lx, ly, fh * 0.035, 0, TAU); ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = fh * 0.018;
      ctx.strokeRect(lx - fh * 0.05, ly - fh * 0.06, fh * 0.10, fh * 0.12);
    }
    if (cfg.stars) {
      const rnd = VF.rng.make(0xA17E);
      ctx.fillStyle = 'rgba(220,235,255,0.9)';
      for (let i = 0; i < 12; i++) {
        const x = hipX + (rnd() - 0.5) * fh * 0.34;
        const y = -fh * (0.10 + rnd() * 0.55) + br;
        const tw = 0.35 + 0.65 * Math.sin(t * 1.6 + i);
        ctx.globalAlpha = (cfg.fade ? 0.6 : 1) * tw * 0.8;
        ctx.beginPath(); ctx.arc(x, y, fh * 0.010, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = cfg.fade ? 0.55 : 1;
    }

    /* rim light */
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(hipX - fh * 0.15, hipY + fh * 0.02);
    ctx.quadraticCurveTo(hipX - fh * 0.21, -fh * 0.42 + br, shX - fh * 0.10, shY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(headX - headR * 1.15 * hs, headY + headR * 0.5);
    ctx.quadraticCurveTo(headX - headR * 1.5 * hs, headY - headR * 1.5 * hs, headX + headR * 0.15, headY - headR * 1.35 * hs);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(hipX + fh * 0.06, hipY);
    ctx.lineTo(kneeX, kneeY - fh * 0.05);
    ctx.stroke();

    ctx.restore();
  }

  VF.anglerArt = { draw: draw };
})(window.VF = window.VF || {});
