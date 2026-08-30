/* VOID FISHING — the crossing, drawn.

   This is the one screen in the game where you can see the world change. It
   holds the two zones' own palettes at once and interpolates between them
   across the crossing, so the sky, the water, the fog and the star density
   all arrive at the destination gradually — which is the whole answer to
   "travelling between zones should feel physical".

   It does not use js/render/scene.js. The scene renders one place, standing
   still, from the shore; this renders motion between two places from a deck,
   and sharing code between those two would have meant a scene renderer with a
   travelling mode bolted on. Both are about two hundred lines and neither has
   to know about the other. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  let stars = null, starKey = '';

  function rgb(h) { return U.hexToRgb(h); }

  /* The two places, blended. Everything below reads this and nothing below
     knows which zone it is drawing. */
  function mix(a, b, k) {
    const e = U.smootherstep(k);
    return {
      skyTop: U.mixRgb(rgb(a.sky[0]), rgb(b.sky[0]), e),
      skyBot: U.mixRgb(rgb(a.sky[1]), rgb(b.sky[1]), e),
      waterTop: U.mixRgb(rgb(a.water[0]), rgb(b.water[0]), e),
      waterBot: U.mixRgb(rgb(a.water[1]), rgb(b.water[1]), e),
      glow: U.mixRgb(rgb(a.glow), rgb(b.glow), e),
      fog: U.mixRgb(rgb(a.fog), rgb(b.fog), e),
      fogAmt: U.lerp(a.fogAmt, b.fogAmt, e),
      stars: U.lerp(a.stars, b.stars, e),
      starTint: U.mixRgb(rgb(a.starTint), rgb(b.starTint), e),
      voidK: U.lerp(a.void || 0, b.void || 0, e)
    };
  }

  function buildStars(w, h) {
    const key = w + 'x' + h;
    if (stars && starKey === key) return stars;
    starKey = key;
    const r = VF.rng.make(0x5EA);
    stars = [];
    for (let i = 0; i < 260; i++) {
      stars.push({ x: r(), y: r() * 0.62, m: Math.pow(r(), 3.6), p: r() * 6 });
    }
    return stars;
  }

  function draw(cv, opts) {
    const host = cv.parentNode;
    if (!host) return;
    const r = host.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(r.width), h = Math.round(r.height);
    if (cv.width !== w * dpr || cv.height !== h * dpr) {
      cv.width = w * dpr; cv.height = h * dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const P = mix(opts.from, opts.to, opts.k);
    const t = opts.t;
    const hy = h * 0.46;

    /* --- sky ---------------------------------------------------------- */
    const sg = g.createLinearGradient(0, 0, 0, hy);
    sg.addColorStop(0, U.rgbToCss(P.skyTop));
    sg.addColorStop(1, U.rgbToCss(P.skyBot));
    g.fillStyle = sg;
    g.fillRect(0, 0, w, hy + 1);

    /* --- stars, thinning and thickening as the zones swap -------------- */
    const list = buildStars(w, h);
    g.save();
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      const a = s.m * P.stars * (0.55 + 0.45 * Math.sin(t * 1.4 + s.p));
      if (a < 0.02) continue;
      g.fillStyle = U.rgbToCss(P.starTint, a);
      const sz = 0.6 + s.m * 1.5;
      g.fillRect(s.x * w, s.y * hy, sz, sz);
    }
    g.restore();

    /* --- the horizon, and what is standing on it ---------------------- */
    horizonBand(g, w, hy, P, opts);

    /* --- water -------------------------------------------------------- */
    const wg = g.createLinearGradient(0, hy, 0, h);
    wg.addColorStop(0, U.rgbToCss(P.waterTop));
    wg.addColorStop(1, U.rgbToCss(P.waterBot));
    g.fillStyle = wg;
    g.fillRect(0, hy, w, h - hy);

    /* Motion is the point. The swell scrolls toward the camera at a speed
       that reads as travelling, and the lines get further apart as they come
       forward, which is the only perspective cue there is out here. */
    g.save();
    g.globalAlpha = 0.5;
    for (let i = 0; i < 26; i++) {
      const u0 = (i / 26 + (t * 0.10) % (1 / 26));
      const u = u0 % 1;
      const y = hy + Math.pow(u, 2.1) * (h - hy);
      const amp = (h - hy) * 0.008 * (0.3 + u);
      g.strokeStyle = U.rgbToCss(U.mixRgb(P.waterTop, P.glow, 0.30), 0.10 + u * 0.18);
      g.lineWidth = 0.6 + u * 1.4;
      g.beginPath();
      for (let x = 0; x <= w; x += 22) {
        const yy = y + Math.sin(x * 0.012 + t * 1.6 + i) * amp;
        x ? g.lineTo(x, yy) : g.moveTo(x, yy);
      }
      g.stroke();
    }
    g.restore();

    /* --- fog ----------------------------------------------------------- */
    if (P.fogAmt > 0.02) {
      const fg = g.createLinearGradient(0, hy - h * 0.16, 0, hy + h * 0.16);
      fg.addColorStop(0, U.rgbToCss(P.fog, 0));
      fg.addColorStop(0.5, U.rgbToCss(P.fog, P.fogAmt * 0.85));
      fg.addColorStop(1, U.rgbToCss(P.fog, 0));
      g.fillStyle = fg;
      g.fillRect(0, hy - h * 0.16, w, h * 0.32);
    }

    /* --- the sonar sweep, if there is a set --------------------------- */
    if (VF.boat && VF.boat.has('sonar')) sonar(g, w, h, P, t, opts.contact);

    /* --- the boat, from behind and slightly above --------------------- */
    /* Off the quarter and small: the crossing is about the water, and a boat
       that fills a third of the frame is a boat portrait with some weather
       behind it. Small enough that the horizon is the subject and large
       enough that the paint, the lamp and the flag all read. */
    const bx = w * 0.5, by = h * 0.78;
    const bl = Math.min(w * 0.19, h * 0.30);
    const roll = Math.sin(t * 0.9) * 0.028 + Math.sin(t * 2.3) * 0.008;

    // the wake it is making, which is what says "moving" more than anything
    g.save();
    g.globalAlpha = 0.42;
    for (let i = 0; i < 7; i++) {
      const u = ((t * 0.4 + i / 7) % 1);
      const ww = bl * (0.24 + u * 1.5);
      g.strokeStyle = U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.4), 0.28 * (1 - u));
      g.lineWidth = 1 + u * 2;
      g.beginPath();
      g.ellipse(bx, by + bl * 0.10 + u * (h - by) * 0.9, ww, ww * 0.20, 0, 0, TAU);
      g.stroke();
    }
    g.restore();

    if (VF.boatArt) {
      g.save();
      g.translate(bx, by);
      g.rotate(roll);
      g.translate(0, Math.sin(t * 1.1) * bl * 0.014);
      VF.boatArt.drawMine(g, bl, {
        time: t,
        light: { bright: 0.55 + 0.45 * (1 - P.voidK), tint: P.waterTop, k: 0.24 }
      });
      g.restore();
    }

    /* --- something off the bow, and where the helm is pointed ---------- */
    if (opts.sighting) drawSighting(g, w, h, hy, P, opts);

    /* --- a vignette, so the card reads over it ------------------------- */
    const vg = g.createRadialGradient(w * 0.5, h * 0.46, Math.min(w, h) * 0.24,
                                      w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
  }

  /* The thing you can see, and how far over the helm is.

     Deliberately not a marker with a distance on it. It is a shape on the
     water at a bearing, and the only feedback that you are closing it is that
     it grows and the horizon slides — because the decision this is asking for
     is "is that worth the detour", and a percentage would answer it for you.

     The bar along the bottom is the helm, not a progress meter: it shows where
     the boat is pointed against where the thing is, which is the one piece of
     information a helmsman actually has. */
  function drawSighting(g, w, h, hy, P, opts) {
    const gt = opts.sighting;
    const head = opts.heading || 0;
    /* Bearing relative to the bow: closing on it walks it toward the middle
       of the frame, which is what steering toward something looks like. */
    const rel = gt.bearing - head;
    const x = w * (0.5 + U.clamp(rel, -1.4, 1.4) * 0.42);
    const grow = 1 + gt.close * 2.6;
    const y = hy - h * 0.012 * grow;
    const sz = Math.max(2, h * 0.014 * grow);

    g.save();
    // it sits in the haze at the horizon and comes out of it as you close
    g.globalAlpha = U.clamp(0.32 + gt.close * 0.68, 0, 1);
    g.fillStyle = U.rgbToCss(U.mixRgb(P.fog, [0, 0, 0], 0.55));
    g.beginPath();
    g.ellipse(x, y, sz * 1.9, sz, 0, 0, Math.PI * 2);
    g.fill();
    // and a mast or a light, so it is a thing rather than a smudge
    g.fillRect(x - sz * 0.10, y - sz * 2.2, sz * 0.20, sz * 2.2);
    if (gt.def && gt.def.kind === 'SIGNAL') {
      g.globalAlpha = 0.5 + 0.5 * Math.sin(opts.t * 3.1);
      g.fillStyle = U.rgbToCss(P.glow, 0.8);
      g.beginPath(); g.arc(x, y - sz * 2.4, Math.max(1, sz * 0.28), 0, Math.PI * 2); g.fill();
    }
    g.restore();

    /* The helm. A line for the bow, a mark for the bearing, and nothing else. */
    const by = h - h * 0.055, bw = w * 0.30;
    g.save();
    g.strokeStyle = U.rgbToCss(P.glow, 0.20);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(w * 0.5 - bw, by); g.lineTo(w * 0.5 + bw, by); g.stroke();
    g.fillStyle = U.rgbToCss(P.glow, 0.75);
    g.fillRect(w * 0.5 + head * bw * 0.7 - 1, by - 5, 2, 10);
    g.fillStyle = U.rgbToCss(P.glow, 0.35);
    g.beginPath();
    g.arc(w * 0.5 + gt.bearing * bw * 0.7, by, 3, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  /* Whatever the two places have standing on their horizons, crossfaded.
     Cheap shapes on purpose: at this distance a monolith is a rectangle and a
     ring is an arc, and drawing them properly would be drawing the scene. */
  function horizonBand(g, w, hy, P, opts) {
    const k = U.smootherstep(opts.k);
    const pairs = [[opts.from, 1 - k], [opts.to, k]];
    pairs.forEach(function (pr) {
      const loc = pr[0], a = pr[1];
      if (a < 0.02) return;
      g.save();
      g.globalAlpha = a;
      g.fillStyle = 'rgba(4,7,12,0.80)';
      const feat = loc.horizon;
      if (feat === 'moon') {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const mx = w * 0.74, my = hy - w * 0.06;
        const mg = g.createRadialGradient(mx, my, 0, mx, my, w * 0.10);
        mg.addColorStop(0, U.rgbToCss(P.glow, 0.55 * a));
        mg.addColorStop(1, U.rgbToCss(P.glow, 0));
        g.fillStyle = mg;
        g.fillRect(mx - w * 0.12, my - w * 0.12, w * 0.24, w * 0.24);
        g.fillStyle = U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.6), 0.9 * a);
        g.beginPath(); g.arc(mx, my, w * 0.026, 0, TAU); g.fill();
        g.restore();
      } else if (feat === 'monolith') {
        g.fillRect(w * 0.20, hy - w * 0.13, w * 0.017, w * 0.13);
        g.fillRect(w * 0.83, hy - w * 0.09, w * 0.013, w * 0.09);
      } else if (feat === 'ring') {
        g.strokeStyle = 'rgba(6,9,14,0.8)';
        g.lineWidth = w * 0.010;
        g.beginPath();
        g.arc(w * 0.5, hy - w * 0.02, w * 0.20, Math.PI * 1.06, Math.PI * 1.94);
        g.stroke();
      } else if (feat === 'crystal') {
        for (const x of [0.16, 0.30, 0.78]) {
          g.beginPath();
          g.moveTo(w * x - w * 0.014, hy);
          g.lineTo(w * x, hy - w * (0.05 + x * 0.10));
          g.lineTo(w * x + w * 0.014, hy);
          g.closePath();
          g.fill();
        }
      } else if (feat === 'arch') {
        g.strokeStyle = 'rgba(6,9,14,0.8)';
        g.lineWidth = w * 0.012;
        g.beginPath();
        g.arc(w * 0.30, hy, w * 0.07, Math.PI, TAU);
        g.stroke();
      } else if (feat === 'tear' || feat === 'eye') {
        g.save();
        g.globalCompositeOperation = feat === 'eye' ? 'lighter' : 'source-over';
        g.fillStyle = feat === 'eye' ? U.rgbToCss(P.glow, 0.30 * a) : 'rgba(2,2,6,0.9)';
        g.beginPath();
        g.ellipse(w * 0.5, hy - w * 0.05, w * 0.10, w * 0.030, 0, 0, TAU);
        g.fill();
        g.restore();
      }
      g.restore();
    });

    // and the line itself
    g.strokeStyle = U.rgbToCss(U.mixRgb(P.glow, P.skyBot, 0.5), 0.32);
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, hy); g.lineTo(w, hy); g.stroke();
  }

  /* The set, bottom right: a sweep, a range ring and a return when there is
     something out there. It is instruments, so it is drawn like instruments. */
  function sonar(g, w, h, P, t, contact) {
    const R = Math.min(w, h) * 0.11;
    const cx = w - R - 26, cy = h - R - 26;
    const a = (t * 1.1) % TAU;

    g.save();
    g.globalAlpha = 0.9;
    g.fillStyle = 'rgba(6,10,16,0.62)';
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    g.strokeStyle = U.rgbToCss(P.glow, 0.30);
    g.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      g.beginPath(); g.arc(cx, cy, R * i / 3, 0, TAU); g.stroke();
    }
    // the sweep
    const sg = g.createConicGradient ? null : null;
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 12; i++) {
      const aa = a - i * 0.05;
      g.strokeStyle = U.rgbToCss(P.glow, 0.14 * (1 - i / 12));
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(aa) * R, cy + Math.sin(aa) * R);
      g.stroke();
    }
    g.restore();
    if (contact > 0) {
      const ca = 2.1, cr = R * (0.4 + contact * 0.5);
      const near = Math.abs(((a - ca + Math.PI * 3) % TAU) - Math.PI) > 2.4 ? 1 : 0.35;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = U.rgbToCss(contact > 0.66 ? [255, 150, 120] : P.glow, 0.85 * near);
      g.beginPath();
      g.arc(cx + Math.cos(ca) * cr, cy + Math.sin(ca) * cr, R * 0.06, 0, TAU);
      g.fill();
      g.restore();
    }
    g.restore();
  }

  VF.voyageArt = { draw: draw };
})(window.VF = window.VF || {});
