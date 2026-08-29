/* VOID FISHING — what an encounter looks like on the water.

   One entry point, called from the scene's draw list between the surface and
   the line. It reads js/systems/creature.js's view() and nothing else, and it
   draws in scene coordinates, so it inherits the water, the fog, the palette
   and the shake for free.

   Everything here is drawn IN the water rather than over it. An encounter
   that puts a sprite on top of the frame is a different game happening in
   front of this one; the whole effect depends on the thing being under the
   same surface as everything else. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  let t = 0;

  function tick(dt) { t += dt; }

  /* A patch of water that is not behaving. The only tell the tracking phase
     gives, and it is deliberately close to the ambient ripples the game
     already draws — the player has to learn the difference. */
  function disturbance(ctx, x, y, r, k, col, hot) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.55 + i / 3) % 1);
      const rr = r * (0.35 + u * 0.9);
      /* The gap between a hot patch and a cold one has to be readable at a
         glance and still be something you could miss. Cold is faint and thin;
         hot is twice the alpha, twice the weight, and drifting. */
      ctx.strokeStyle = U.rgbToCss(col, (0.16 + hot * 0.52) * (1 - u) * k);
      ctx.lineWidth = Math.max(0.6, r * 0.035 * (1 + hot * 1.8));
      ctx.beginPath();
      ctx.ellipse(x, y, rr, rr * 0.30, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    /* Under a hot one there is something with an edge. Never enough of it to
       be a shape — the shape is the payoff and it is three phases away. */
    if (hot > 0.02) {
      ctx.save();
      ctx.globalAlpha = 0.62 * hot * k;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(t * 0.7) * r * 0.10, y + r * 0.06,
                  r * 0.86, r * 0.22, Math.sin(t * 0.4) * 0.12, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  /* The far shape: a vertical mark on the water at the horizon, which is what
     a person standing a long way off looks like and also what a post looks
     like. It is drawn at exactly the size where the player cannot tell. */
  function standing(ctx, L, near, col) {
    const y = L.horizonY + L.waterH * U.lerp(0.02, 0.34, near);
    const h = L.waterH * U.lerp(0.030, 0.30, Math.pow(near, 1.4));
    const w = h * 0.24;
    const x = L.w * 0.68;

    ctx.save();
    ctx.globalAlpha = U.lerp(0.34, 0.92, near);
    ctx.fillStyle = 'rgba(2,4,8,0.92)';
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.quadraticCurveTo(x - w * 0.62, y - h * 0.62, x, y - h);
    ctx.quadraticCurveTo(x + w * 0.62, y - h * 0.62, x + w * 0.5, y);
    ctx.closePath();
    ctx.fill();
    // its reflection, which is a beat behind it and slightly the wrong shape
    ctx.globalAlpha *= 0.30;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5, y);
    ctx.quadraticCurveTo(x - w * 0.5, y + h * 0.5,
                         x + Math.sin(t * 0.5) * w * 0.4, y + h * 0.78);
    ctx.quadraticCurveTo(x + w * 0.5, y + h * 0.5, x + w * 0.5, y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (near > 0.55) {
      // and once it is close enough, the thing that makes it not a post
      const ey = y - h * 0.86;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, ey, 0, x, ey, h * 0.28);
      g.addColorStop(0, U.rgbToCss(col, 0.55 * (near - 0.55) / 0.45));
      g.addColorStop(1, U.rgbToCss(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - h * 0.3, ey - h * 0.3, h * 0.6, h * 0.6);
      ctx.restore();
    }
  }

  /* Something the size of the frame passing underneath, seen only as the
     water above it going dark and smooth. */
  function bigShadow(ctx, L, k, span) {
    const y = L.horizonY + L.waterH * 0.52;
    const x = L.w * (0.5 + Math.sin(t * 0.22) * 0.10);
    const g = ctx.createLinearGradient(0, y - L.waterH * 0.30, 0, y + L.waterH * 0.34);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,' + (0.74 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, L.w * (span || 0.76), L.waterH * 0.28, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* The wake behind a boat, widened by whatever is sitting in it. */
  function wake(ctx, L, k) {
    const y = L.horizonY + L.waterH * 0.74;
    const x = L.w * 0.28;
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      const u = ((t * 0.35 + i / 5) % 1);
      const w = L.w * (0.06 + u * (0.16 + k * 0.42));
      ctx.strokeStyle = U.rgbToCss([200, 224, 245], 0.34 * (1 - u));
      ctx.lineWidth = Math.max(0.8, L.w * 0.0035);
      ctx.beginPath();
      ctx.ellipse(x + u * L.w * 0.22, y + u * L.waterH * 0.10, w, w * 0.18, 0, 0, TAU);
      ctx.stroke();
    }
    if (k > 0.5) {
      ctx.globalAlpha = 0.44 * (k - 0.5) / 0.5;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(x + L.w * 0.16, y + L.waterH * 0.05,
                  L.w * 0.20, L.waterH * 0.07, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* The small ones. Each is a dart with a light in it; a dead one flashes and
     goes. Drawn from the encounter's own list so hit-testing and drawing can
     never disagree about where they are. */
  function swarm(ctx, L, list, col) {
    ctx.save();
    list.forEach(function (m) {
      const x = L.w * m.x, y = L.horizonY + L.waterH * m.y;
      const r = L.w * 0.016;
      if (!m.alive) {
        if (m.pop > 1) return;
        ctx.globalAlpha = 1 - m.pop;
        ctx.strokeStyle = U.rgbToCss(col, 0.8);
        ctx.lineWidth = Math.max(0.6, r * 0.3);
        ctx.beginPath();
        ctx.arc(x, y, r * (1 + m.pop * 3), 0, TAU);
        ctx.stroke();
        return;
      }
      ctx.globalAlpha = 1;
      const a = Math.atan2(m.vy, m.vx);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = 'rgba(4,7,12,0.86)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.6, r * 0.55, 0, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = U.rgbToCss(col, 0.55 + 0.35 * Math.sin(m.ph * 3));
      ctx.beginPath();
      ctx.arc(r * 0.7, 0, r * 0.34, 0, TAU);
      ctx.fill();
      ctx.restore();
    });
    ctx.restore();
  }

  /* The chase: the thing running, drawn as distance rather than as a bar. The
     bar is in the HUD; this is what the bar is about. */
  function chase(ctx, L, k, col) {
    const y = L.horizonY + L.waterH * U.lerp(0.16, 0.58, k);
    const x = L.w * U.lerp(0.92, 0.52, k);
    const s = L.w * U.lerp(0.02, 0.075, k);
    ctx.save();
    ctx.globalAlpha = U.lerp(0.45, 0.95, k);
    ctx.fillStyle = 'rgba(3,6,10,0.9)';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 1.9, s * 0.6, Math.sin(t * 4) * 0.16, 0, TAU);
    ctx.fill();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = U.rgbToCss(col, 0.5);
    ctx.beginPath();
    ctx.arc(x + s * 1.1, y - s * 0.1, s * 0.28, 0, TAU);
    ctx.fill();
    ctx.restore();
    // the water it is tearing up
    VF.fx.ripple(x, y, s * 2.4, 0.5, col, 0.5);
  }

  /* The disguise coming off: the fish it was pretending to be, drawn over
     itself with the colour running out of it. */
  function reveal(ctx, L, fish, k, col) {
    if (!fish) return;
    const y = L.horizonY + L.waterH * 0.42;
    const x = L.w * 0.5;
    const size = Math.min(L.w * 0.10, L.waterH * 0.22);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = 1 - k * 0.55;
    try { VF.fishArt.draw(ctx, fish, size, { time: t, detail: false }); } catch (e) { /* ignore */ }
    ctx.restore();

    if (k > 0.02) {
      // it runs downward, because that is what a colour that is not attached
      // to anything does in water
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        const u = ((t * 0.5 + i / 14) % 1);
        const px = x + Math.sin(i * 2.4) * size * 1.5;
        const py = y + u * size * 2.4;
        ctx.fillStyle = U.rgbToCss(col, 0.30 * k * (1 - u));
        ctx.fillRect(px, py, Math.max(1, size * 0.03), size * 0.20);
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------- entry */

  function draw(ctx, L, P) {
    const v = VF.creature && VF.creature.view();
    if (!v) return;
    // P.glow is already resolved rgb — the palette does the day and the water
    const col = (P && P.glow) || [159, 200, 232];

    if (v.far !== undefined && v.far !== null) standing(ctx, L, 1 - v.far, col);
    if (v.shadow) bigShadow(ctx, L, U.clamp(v.t / 1.4, 0, 1), 0.5);
    if (v.devour) bigShadow(ctx, L, 1, 0.9);
    if (v.wake !== undefined && v.wake !== null) wake(ctx, L, v.wake);

    if (v.verb === 'watch' && v.kind === 'lurker' && !v.far) {
      bigShadow(ctx, L, U.clamp(v.t / 1.8, 0, 1) * 0.8, 0.62);
    }

    if (v.slots) {
      const grow = U.clamp(v.round / Math.max(1, v.rounds), 0, 1);
      v.slots.forEach(function (sl, i) {
        const x = L.w * sl.x, y = L.horizonY + L.waterH * sl.y;
        const isHot = i === v.hot;
        /* The hot one is only fractionally louder to begin with. By the last
           round it is obvious, which is the difficulty curve: the encounter
           teaches you what to look for while you are already looking. */
        disturbance(ctx, x, y, L.w * 0.055, 1, col, isHot ? 0.42 + grow * 0.45 : 0);
      });
    }

    if (v.swarm) swarm(ctx, L, v.swarm, col);
    if (v.verb === 'chase') chase(ctx, L, v.progress, col);
    if (v.verb === 'reveal' || (v.verb === 'watch' && v.disguise)) {
      reveal(ctx, L, v.disguise, v.revealed, col);
    }

    /* And a thin cold border on the whole frame while any of it is running,
       so the water reads as somebody else's for as long as it is. */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, L.horizonY, 0, L.h);
    g.addColorStop(0, U.rgbToCss(col, 0.05));
    g.addColorStop(1, U.rgbToCss(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
    ctx.restore();
  }

  VF.creatureArt = { draw: draw, tick: tick };
})(window.VF = window.VF || {});
