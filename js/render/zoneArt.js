/* VOID FISHING — the layer that says where you are.

   The zones already had their own palettes, horizons and silhouettes, and it
   was not enough: nine places lit differently is still one place. This is the
   other half — the thing that is on the water HERE and nowhere else, drawn
   over the surface and under the line, and it is mostly the zone's own
   mechanic made visible.

   A gull is not a mechanic. It is on the shore because the shore is the one
   place in this game where something is alive above the water, and five
   seconds of looking at a gull tells you where you are faster than any amount
   of colour grading. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  let t = 0;
  let gulls = null, panes = null, motes = null, seedKey = '';

  function tick(dt) { t += dt; }

  function seed(L, id) {
    const key = id + '|' + Math.round(L.w) + 'x' + Math.round(L.h);
    if (seedKey === key) return;
    seedKey = key;
    const r = VF.rng.make(0x2011 + id.length);
    gulls = [];
    for (let i = 0; i < 5; i++) {
      gulls.push({ x: r(), y: 0.10 + r() * 0.34, sp: 0.008 + r() * 0.020,
                   s: 0.5 + r() * 0.8, p: r() * 6 });
    }
    panes = [];
    for (let i = 0; i < 9; i++) {
      panes.push({ x: r(), y: 0.20 + r() * 0.60, w: 0.06 + r() * 0.16, a: r() * 0.5 });
    }
    motes = [];
    for (let i = 0; i < 34; i++) {
      motes.push({ x: r(), y: r(), sp: 0.004 + r() * 0.016, s: 0.4 + r() * 1.6, p: r() * 6 });
    }
  }

  /* ------------------------------------------------------------ ambients */

  function drawGulls(ctx, L, P) {
    ctx.save();
    ctx.globalAlpha = 0.30 + P.bright * 0.28;
    ctx.strokeStyle = 'rgba(232,240,248,0.9)';
    gulls.forEach(function (b) {
      const x = ((b.x + t * b.sp) % 1.2 - 0.1) * L.w;
      const y = L.horizonY * (0.30 + b.y * 0.5) + Math.sin(t * 0.7 + b.p) * L.h * 0.010;
      const s = L.w * 0.006 * b.s;
      const flap = Math.sin(t * 3.4 + b.p) * 0.5;
      ctx.lineWidth = Math.max(0.7, s * 0.34);
      ctx.beginPath();
      ctx.moveTo(x - s, y + flap * s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.3, y - s * 0.4, x, y);
      ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.4, x + s, y + flap * s * 0.6);
      ctx.stroke();
    });
    ctx.restore();
  }

  /* The Glass Flats: rectangular sheets of something with a surface, laid
     over the water, catching the light at their own angles. */
  function drawPanes(ctx, L, P, cracked) {
    ctx.save();
    panes.forEach(function (p, i) {
      const x = L.w * p.x, y = L.horizonY + L.waterH * p.y;
      const w = L.w * p.w, h = w * 0.16;
      ctx.globalAlpha = 0.055 + p.a * 0.085 + Math.sin(t * 0.5 + i) * 0.02;
      ctx.fillStyle = U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.5));
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, y);
      ctx.lineTo(x - w * 0.34, y - h);
      ctx.lineTo(x + w * 0.5, y - h);
      ctx.lineTo(x + w * 0.34, y);
      ctx.closePath();
      ctx.fill();
    });
    if (cracked) {
      /* One line, permanent, going right across. Water does not do this. */
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.7), 0.6);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let y = L.horizonY + L.waterH * 0.44;
      ctx.moveTo(0, y);
      for (let x = 0; x <= L.w; x += L.w * 0.07) {
        y += (((x * 7919) % 97) / 97 - 0.5) * L.waterH * 0.05;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* The trench without a set: the frame closes in. This is the visibility
     mechanic and it is the whole reason to buy sonar. */
  function drawDark(ctx, L, P, blind) {
    const k = blind ? 0.78 : 0.42;
    const g = ctx.createRadialGradient(L.w * 0.32, L.horizonY + L.waterH * 0.72,
                                       L.w * (blind ? 0.06 : 0.14),
                                       L.w * 0.32, L.horizonY + L.waterH * 0.72,
                                       L.w * (blind ? 0.42 : 0.72));
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(1,3,6,' + k.toFixed(2) + ')');
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
    ctx.restore();
  }

  /* The Crystal Abyss: structures standing up out of the deep and stopping
     just below the surface, lit from inside, breathing on the charge. */
  function drawCrystals(ctx, L, P, charge) {
    ctx.save();
    const glow = U.mixRgb(P.glow, [255, 255, 255], 0.25);
    for (let i = 0; i < 6; i++) {
      const x = L.w * (0.10 + i * 0.16 + Math.sin(i * 3.1) * 0.03);
      const base = L.horizonY + L.waterH * (0.30 + (i % 3) * 0.14);
      const h = L.waterH * (0.14 + (i % 4) * 0.06);
      const w = h * 0.24;
      const pulse = 0.4 + 0.6 * charge * (0.6 + 0.4 * Math.sin(t * 1.4 + i));
      ctx.globalAlpha = 0.24 + pulse * 0.30;
      const cg = ctx.createLinearGradient(x, base, x, base - h);
      cg.addColorStop(0, U.rgbToCss(glow, 0.05));
      cg.addColorStop(1, U.rgbToCss(glow, 0.55));
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(x - w, base);
      ctx.lineTo(x, base - h);
      ctx.lineTo(x + w, base);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  /* The Nowhere Sea: a sky that is not behaving. Stars in the wrong places
     and a second horizon that is a few degrees off the first. */
  function drawWrongSky(ctx, L, P) {
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = U.rgbToCss(P.glow, 0.20);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, L.horizonY - L.h * 0.035);
    ctx.lineTo(L.w, L.horizonY + L.h * 0.018);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    motes.forEach(function (m, i) {
      if (i % 3) return;
      const x = ((m.x + Math.sin(t * 0.05 + m.p) * 0.02) % 1) * L.w;
      const y = m.y * L.horizonY;
      ctx.fillStyle = U.rgbToCss(P.star || [220, 200, 255], 0.7);
      ctx.fillRect(x, y, m.s, m.s);
    });
    ctx.restore();
  }

  /* Beneath: there is no surface, so the water goes up as well as down and
     the motes fall the wrong way. */
  function drawUnder(ctx, L, P, depth) {
    ctx.save();
    ctx.globalAlpha = 0.35 + depth * 0.3;
    motes.forEach(function (m) {
      const y = L.horizonY + ((1 - ((m.y + t * m.sp) % 1)) * (L.h - L.horizonY));
      const x = (m.x + Math.sin(t * 0.2 + m.p) * 0.01) * L.w;
      ctx.fillStyle = U.rgbToCss(P.glow, 0.30);
      ctx.fillRect(x, y, m.s, m.s * 2.4);
    });
    if (depth > 0.02) {
      // the reading, as a band that closes in from both sides
      ctx.globalAlpha = 0.10 + depth * 0.22;
      const g = ctx.createLinearGradient(0, L.horizonY, 0, L.h);
      g.addColorStop(0, U.rgbToCss(P.glow, 0));
      g.addColorStop(1, U.rgbToCss(P.glow, 0.4));
      ctx.fillStyle = g;
      ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
    }
    ctx.restore();
  }

  /* The Heavens: you are standing on cloud, so the cloud is under the water. */
  function drawAbove(ctx, L, P) {
    ctx.save();
    ctx.globalAlpha = 0.24;
    for (let i = 0; i < 5; i++) {
      const y = L.horizonY + L.waterH * (0.30 + i * 0.14);
      const x = ((i * 0.23 + t * 0.006) % 1.3 - 0.15) * L.w;
      ctx.fillStyle = 'rgba(255,246,224,0.5)';
      ctx.beginPath();
      ctx.ellipse(x, y, L.w * 0.16, L.waterH * 0.035, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /* -------------------------------------------- what is on the water now */

  function drawThings(ctx, L, P, v) {
    // the bottle, drifting in
    if (v.bottle) {
      const x = L.w * v.bottle.x, y = L.horizonY + L.waterH * v.bottle.y;
      const bob = Math.sin(t * 1.8) * L.w * 0.003;
      ctx.save();
      ctx.translate(x, y + bob);
      ctx.rotate(Math.sin(t * 0.9) * 0.3 - 0.4);
      ctx.fillStyle = 'rgba(150,190,170,0.75)';
      ctx.beginPath();
      ctx.ellipse(0, 0, L.w * 0.011, L.w * 0.0042, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,232,240,0.7)';
      ctx.fillRect(-L.w * 0.004, -L.w * 0.0016, L.w * 0.008, L.w * 0.0032);
      ctx.restore();
      ring(ctx, x, y, L.w * 0.026, P.glow, 0.4);
    }

    // the shapes coming in over the flats, each drawn as itself
    if (v.marks) {
      v.marks.forEach(function (m) {
        const f = VF.fish.byId(m.id);
        if (!f) return;
        const x = L.w * m.x, y = L.horizonY + L.waterH * m.y;
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.22 + Math.min(0.26, m.rank * 0.05);
        try { VF.fishArt.drawSilhouette(ctx, f, L.w * 0.017, 0.9, 0.5); }
        catch (e) { /* never worth the frame */ }
        ctx.restore();
        if (m.rank >= 4) ring(ctx, x, y, L.w * 0.05, P.glow, 0.30);
      });
    }

    // the sonar return
    if (v.contact) {
      const x = L.w * v.contact.x, y = L.horizonY + L.waterH * v.contact.y;
      const k = 0.5 + 0.5 * Math.sin(t * 2.2);
      const r = L.w * (v.contact.big ? 0.075 : 0.042);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const u = ((t * 0.55 + i / 3) % 1);
        ctx.strokeStyle = U.rgbToCss(v.contact.big ? [255, 150, 120] : P.glow,
                                     0.42 * (1 - u) * (0.6 + k * 0.4));
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(x, y, r * (0.3 + u), r * (0.3 + u) * 0.3, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
      if (v.contact.big) {
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(x, y + r * 0.1, r * 1.5, r * 0.34, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
    }

    // shards on the surface
    if (v.shards) {
      v.shards.forEach(function (s) {
        const x = L.w * s.x, y = L.horizonY + L.waterH * s.y;
        const a = 0.5 + 0.5 * Math.sin(t * 2 + s.x * 9);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(x, y);
        ctx.rotate(t * 0.5 + s.x * 6);
        ctx.fillStyle = U.rgbToCss([200, 160, 255], 0.45 + a * 0.4);
        ctx.beginPath();
        ctx.moveTo(0, -L.w * 0.010);
        ctx.lineTo(L.w * 0.005, 0);
        ctx.lineTo(0, L.w * 0.010);
        ctx.lineTo(-L.w * 0.005, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    }
  }

  function ring(ctx, x, y, r, col, a) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const u = (t * 0.6) % 1;
    ctx.strokeStyle = U.rgbToCss(col, a * (1 - u));
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, r * (0.4 + u), r * (0.4 + u) * 0.3, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------------------------------- entry */

  function draw(ctx, L, P) {
    if (!VF.zones) return;
    const v = VF.zones.view();
    if (!v || !v.id) return;
    seed(L, v.id);
    const amb = VF.zoneData.ambient(v.id);

    switch (amb) {
      case 'gulls': drawGulls(ctx, L, P); break;
      case 'panes': drawPanes(ctx, L, P, !!VF.zones.state('flats').cracked); break;
      case 'dark': drawDark(ctx, L, P, v.blind); break;
      case 'crystals': drawCrystals(ctx, L, P, v.charge); break;
      case 'wrongsky': drawWrongSky(ctx, L, P); break;
      case 'under': drawUnder(ctx, L, P, v.depth); break;
      case 'above': drawAbove(ctx, L, P); break;
      default: break;
    }
    drawThings(ctx, L, P, v);
  }

  VF.zoneArt = { draw: draw, tick: tick };
})(window.VF = window.VF || {});
