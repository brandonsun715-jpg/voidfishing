/* VOID FISHING — drawing Vault Harbour.

   Four compositions, and they have one job between them: to look like
   somewhere rather than like a background behind some buttons. The test is
   the one in the brief — hide the interface, take the screenshot, and if what
   is left reads as a menu with a painting on it, the view has failed.

   So each view is built the way the water is: a far layer that is only
   silhouette and haze, a middle that is the thing you came for, and a near
   layer you are standing behind. The ground is a real curve out of
   js/render/ground.js, so people stand ON it at the height it actually is,
   and it is the same primitive the shore ledge uses.

   Everything is lit by js/render/palette.js, which is lit by the time of day
   and the weather, so the harbour at four in the morning is a different
   harbour and nobody had to author it twice. The warm lamps are the one thing
   that is not: a harbour with its lights on is the whole feeling of coming
   back, and they burn at the same colour at every hour.

   The sky and the sea are not in here at all. They are the GL layer
   underneath, drawn at this view's own horizon, and in the room they are seen
   through a hole in the wall rather than painted on it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  const DARK = [5, 7, 12];
  const LAMP = [255, 196, 122];

  let ctx = null, t = 0;
  /* The star field, baked once per size the way the water's is. The shader
     draws the sky's colour and its light but not its stars, and a harbour at
     midnight under an empty sky is a gradient with a boat in front of it. */
  let stars = null, starKey = '';

  function buildStars(L) {
    const q = VF.state.data.settings.quality;
    const key = Math.round(L.w) + 'x' + Math.round(L.horizonY) + ':' + q;
    if (starKey === key) return;
    starKey = key;
    stars = VF.skyArt.buildField(L.w, Math.max(8, L.horizonY), 0x5A17,
                                 q, U.hexToRgb('#dce8f5'), 1).canvas;
  }

  /* ------------------------------------------------------------- helpers */

  function css(rgb, a) { return U.rgbToCss(rgb, a === undefined ? 1 : a); }

  /* Everything structural is nearly black with a little of the sky in it, so
     the harbour sits in the same air as the water behind it. */
  function solid(P, k, warm) {
    let c = U.mixRgb(DARK, P.skyBot, U.clamp(k, 0, 1) * 0.5);
    if (warm) c = U.mixRgb(c, LAMP, warm);
    return c;
  }

  function poly(pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
  }

  /* A warm point of light, and the air around it. The only thing in the
     harbour that is not the palette's colour. */
  /* The pool a lamp lays on the surface under it. Without this the lamps are
     bright dots in the dark and the boards they stand on are unlit, which is
     the clearest way to make a scene look like separate sprites in front of a
     background rather than like a place. */
  function pool(x, y, rx, ry, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y); ctx.scale(1, ry / rx); ctx.translate(-x, -y);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, css(LAMP, 0.22 * k));
    g.addColorStop(0.45, css(LAMP, 0.075 * k));
    g.addColorStop(1, css(LAMP, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, rx, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* A light lying on the water: a narrow vertical smear that breaks up as it
     comes toward you. Cheap, and it is most of what makes a harbour at night
     read as a harbour rather than as a wall with lamps on it. */
  function reflect(x, y, w2, h2, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const steps = 9;
    for (let i = 0; i < steps; i++) {
      const u = i / (steps - 1);
      const yy = y - h2 * (1 - u);
      const a = 0.055 * k * (0.35 + u * 0.65) * (0.6 + 0.4 * Math.sin(t * 1.6 + i * 1.9));
      const ww = w2 * (0.35 + u * 1.5);
      ctx.fillStyle = css(LAMP, a);
      ctx.beginPath();
      ctx.ellipse(x + Math.sin(t * 0.9 + i * 2.3) * w2 * 0.22, yy,
                  ww, Math.max(1, h2 * 0.035), 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function lamp(x, y, r, k) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 7);
    g.addColorStop(0, css(LAMP, 0.85 * k));
    g.addColorStop(0.22, css(LAMP, 0.30 * k));
    g.addColorStop(1, css(LAMP, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 7, 0, TAU); ctx.fill();
    ctx.fillStyle = css([255, 236, 200], 0.95 * k);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* An upright — piling, post, leg of a crane. Lit down one side. */
  function post(x, yTop, yBot, w, P, k) {
    const c = solid(P, k === undefined ? 0.10 : k);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    g.addColorStop(0, css(U.mixRgb(c, P.glow, 0.16)));
    g.addColorStop(0.45, css(c));
    g.addColorStop(1, css(U.shade(c, -0.35)));
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, yTop, w, yBot - yTop);
  }

  /* A rectangular thing with a lit top face — a crate, a counter, a block.
     Two trapezoids and it reads as a solid from any angle that matters. */
  function box(x, base, w, h, depth, P, k, warm) {
    const c = solid(P, k === undefined ? 0.14 : k, warm);
    const d = depth === undefined ? h * 0.28 : depth;
    // the top face, going away and to the light
    poly([[x - w / 2, base - h], [x - w / 2 + d * 0.7, base - h - d],
          [x + w / 2 + d * 0.7, base - h - d], [x + w / 2, base - h]],
         css(U.mixRgb(c, P.glow, 0.26)));
    // the front
    const g = ctx.createLinearGradient(0, base - h, 0, base);
    g.addColorStop(0, css(U.mixRgb(c, P.glow, 0.10)));
    g.addColorStop(1, css(U.shade(c, -0.42)));
    ctx.fillStyle = g;
    ctx.fillRect(x - w / 2, base - h, w, h);
    // and the side
    poly([[x + w / 2, base - h], [x + w / 2 + d * 0.7, base - h - d],
          [x + w / 2 + d * 0.7, base - d], [x + w / 2, base]],
         css(U.shade(c, -0.20)));
  }

  /* ------------------------------------------------------------- the ground

     Boards, hardstanding or floor, sampled off the same curve the figures
     stand on so the two can never disagree. The planks run away from you and
     converge, which is the only cue in a still frame that says how big the
     space is. */
  function drawGround(L, P, curve, kind) {
    const g = curve;
    const w = L.w, h = L.h, fh = L.figureH;
    const top = g.sample(-10, w + 10, 8);
    const base = solid(P, kind === 'floor' ? 0.05 : 0.08, kind === 'floor' ? 0.09 : 0);

    function outline() {
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
      ctx.lineTo(w + 10, h + 10); ctx.lineTo(-10, h + 10);
      ctx.closePath();
    }

    /* The mass of it, dark at the near edge because the near edge is under
       you and nothing is lighting it. */
    outline();
    const y0 = g.yAt(w * 0.5);
    const gr = ctx.createLinearGradient(0, y0, 0, h);
    gr.addColorStop(0, css(U.mixRgb(base, P.glow, 0.20)));
    gr.addColorStop(0.35, css(base));
    gr.addColorStop(1, css(U.shade(base, -0.62)));
    ctx.fillStyle = gr;
    ctx.fill();

    /* THE PLANKS. Filled bands rather than hairlines, converging on a point
       above the frame, because a hairline at 5% alpha on a near-black fill is
       a plank nobody can see — which is exactly what the first pass drew. */
    ctx.save();
    outline(); ctx.clip();
    /* Planking reads as the SEAMS between boards, not as alternating stripes.
       Filled bands at any contrast that made them visible turned the dock
       into a zebra crossing; a dark line every plank-width, converging, is
       what a deck actually looks like. A few boards are a shade different
       because a few boards always are. */
    const vpx = w * 0.5, vpy = y0 - fh * 5.0;
    const pitch = fh * 0.19;
    const n = Math.ceil(w / pitch) + 8;
    for (let i = -n; i <= n; i++) {
      const far = vpx + i * pitch * 0.10;
      const near = vpx + i * pitch;
      if (Math.abs(Math.sin(i * 12.9898)) > 0.82) {
        ctx.beginPath();
        ctx.moveTo(far, vpy); ctx.lineTo(far + pitch * 0.10, vpy);
        ctx.lineTo(near + pitch, h + 20); ctx.lineTo(near, h + 20);
        ctx.closePath();
        ctx.fillStyle = css(U.shade(base, Math.sin(i * 78.233) > 0 ? 0.22 : -0.22), 0.30);
        ctx.fill();
      }
      ctx.strokeStyle = css(U.shade(base, -0.75), 0.55);
      ctx.lineWidth = Math.max(1, fh * 0.006);
      ctx.beginPath();
      ctx.moveTo(far, vpy); ctx.lineTo(near, h + 20);
      ctx.stroke();
    }
    /* and the joints across them, compressing with distance */
    for (let j = 1; j < 10; j++) {
      const f = Math.pow(j / 10, 1.9);
      const yy = y0 + f * (h - y0) * 1.2;
      const tilt = (g.yAt(w) - g.yAt(0)) * (1 - f * 0.5);
      ctx.strokeStyle = css(U.shade(base, -0.7), 0.30);
      ctx.lineWidth = Math.max(1, fh * 0.010 * (0.4 + f));
      ctx.beginPath();
      ctx.moveTo(-10, yy - tilt * 0.5);
      ctx.lineTo(w + 10, yy + tilt * 0.5);
      ctx.stroke();
    }
    ctx.restore();

    /* The lit lip where this surface ends and whatever is beyond it starts.
       On the dock that is the quay edge and it is the single most important
       line in the frame: above it is water, below it is somewhere to stand. */
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
    ctx.strokeStyle = css(U.mixRgb(P.glow, [255, 255, 255], 0.25), 0.22 + P.bright * 0.20);
    ctx.lineWidth = Math.max(1.4, fh * 0.020);
    ctx.stroke();
    /* the shadow it throws down its own face */
    ctx.save();
    outline(); ctx.clip();
    const sh = ctx.createLinearGradient(0, y0, 0, y0 + fh * 0.30);
    sh.addColorStop(0, 'rgba(0,0,0,0.42)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = sh;
    ctx.fillRect(-10, y0 - fh * 0.1, w + 20, fh * 0.5);
    ctx.restore();
  }

  /* -------------------------------------------------------- the far layer

     Silhouette and haze only. Everything here is one flat tone lifted toward
     the fog by distance, because that is what distance looks like and because
     detail out here is what makes a backdrop look like wallpaper. */
  const FAR = {
    mole: function (x, y, s2, P, a) {
      const w = s2 * 3.4, h = s2 * 0.22;
      poly([[x - w, y], [x - w * 0.88, y - h], [x + w * 0.55, y - h * 0.82],
            [x + w, y - h * 0.42], [x + w, y + h * 0.5], [x - w, y + h * 0.5]], a);
    },
    harbourlight: function (x, y, s2, P, a) {
      const h = s2 * 1.05, w = s2 * 0.17;
      poly([[x - w, y], [x - w * 0.60, y - h * 0.80], [x + w * 0.60, y - h * 0.80],
            [x + w, y]], a);
      poly([[x - w * 0.80, y - h * 0.80], [x - w * 0.46, y - h],
            [x + w * 0.46, y - h], [x + w * 0.80, y - h * 0.80]], a);
    },
    town: function (x, y, s2, P, a) {
      /* Roofs at different heights, which is the only thing that makes them
         read as a town rather than as a comb. */
      const hs = [0.44, 0.78, 0.34, 0.95, 0.60, 0.28, 0.55, 0.86, 0.40, 0.66];
      let cx = x - s2 * 2.4;
      for (let i = 0; i < hs.length; i++) {
        const w = s2 * (0.34 + (i % 3) * 0.14);
        const h = s2 * hs[i] * 0.85;
        poly([[cx, y], [cx, y - h], [cx + w * 0.5, y - h - s2 * 0.16],
              [cx + w, y - h], [cx + w, y]], a);
        cx += w * 1.02;
      }
    },
    shed: function (x, y, s2, P, a) {
      const w = s2 * 1.5, h = s2 * 0.95;
      poly([[x - w, y], [x - w, y - h * 0.66], [x, y - h],
            [x + w, y - h * 0.66], [x + w, y]], a);
    },
    crane: function (x, y, s2, P, a) {
      const h = s2 * 1.9;
      poly([[x - s2 * 0.11, y], [x - s2 * 0.055, y - h], [x + s2 * 0.055, y - h],
            [x + s2 * 0.11, y]], a);
      poly([[x - s2 * 0.06, y - h], [x - s2 * 0.04, y - h * 0.88],
            [x - s2 * 1.25, y - h * 0.64], [x - s2 * 1.25, y - h * 0.74]], a);
    },
    /* The back of the market row. Without it the awning is a roof over the
       open sea, which is what it looked like. */
    backwall: function (x, y, s2, P, a) {
      const w = s2 * 5.2, h = s2 * 2.4;
      ctx.fillStyle = a;
      ctx.fillRect(x - w, y - h, w * 2, h);
      /* shelves on it, because this is where the archivist stands */
      ctx.fillStyle = css(U.shade(U.hexToRgb('#000000'), 0), 0.16);
      for (let i = 1; i < 5; i++) {
        ctx.fillRect(x - w * 0.9, y - h * (i / 5), w * 1.8, Math.max(1, s2 * 0.03));
      }
    }
  };

  function drawFar(L, P) {
    const v = L.view;
    if (!v.far) return;
    const edgeY = (L.edge || L.ground).yAt(L.w * 0.5);
    for (let i = 0; i < v.far.length; i++) {
      const f = v.far[i];
      const fn = FAR[f.art];
      if (!fn) continue;
      const x = f.at * L.w;
      /* d is how far off it is. 1 is on the horizon; less brings the base
         down the frame toward the near edge of the water. */
      const y = L.horizonY + (1 - f.d) * Math.max(0, edgeY - L.horizonY) * 0.85;
      const s2 = L.figureH * (f.scale || 1) * U.lerp(1.15, 0.40, f.d);
      const fade = 1 - Math.exp(-(P.fogAmt + 0.16) * f.d * 2.2);
      const col = U.mixRgb(solid(P, 0.26), P.fog, fade);
      ctx.save();
      ctx.globalAlpha = U.clamp(1 - fade * 0.30, 0.18, 1);
      fn(x, y, s2, P, css(col));
      ctx.restore();
      if (f.art === 'harbourlight') {
        lamp(x, y - s2 * 0.98, Math.max(1.5, s2 * 0.085), 0.60 + 0.12 * Math.sin(t * 0.7));
        reflect(x, y + (edgeY - y) * 0.55, s2 * 0.13, (edgeY - y) * 0.55, 0.55);
      }
      if (f.art === 'town') {
        for (let j = 0; j < 13; j++) {
          if (Math.sin(j * 78.233 + 1.7) < -0.2) continue;
          const wx = x + (j - 6) * s2 * 0.40 + Math.sin(j * 12.9898) * s2 * 0.09;
          const wy = y - s2 * (0.14 + ((j * 7) % 5) * 0.115);
          lamp(wx, wy, Math.max(0.8, s2 * 0.026), 0.28);
        }
      }
    }
  }

  /* --------------------------------------------------------- the middles

     One function per view. This is where the thing you came for lives, and it
     is the only part that is bespoke. */

  function dock(L, P, S) {
    const edge = L.edge, fh = L.figureH;

    /* pilings standing up out of the water on the far side of the quay. They
       are what say the boards are a structure IN water rather than a beach. */
    for (let i = 0; i < 9; i++) {
      const x = L.w * (0.03 + i * 0.118);
      const ey = edge.yAt(x);
      post(x, ey - fh * (0.26 + 0.06 * Math.sin(i * 2.7)), ey + fh * 0.04,
           fh * 0.055, P, 0.06);
    }

    /* your boat, moored, in the water, showing what state it is in */
    const sp = spotById(L, 'boat');
    if (sp) drawMoored(L, P, sp);

    /* bollards on the boards, and a coil of rope */
    [0.185, 0.615].forEach(function (f) {
      const x = L.w * f, gy = L.ground.yAt(x);
      box(x, gy, fh * 0.11, fh * 0.17, fh * 0.05, P, 0.14);
    });
    ropeCoil(L.w * 0.68, L.ground.yAt(L.w * 0.68), fh * 0.11, P);

    /* two lamps on the quay, standing on the boards and leaning over the
       water, which is what a harbour lamp does */
    [0.115, 0.545].forEach(function (f) {
      const x = L.w * f, gy = L.ground.yAt(x);
      post(x, gy - fh * 1.45, gy, fh * 0.038, P, 0.12);
      ctx.strokeStyle = css(solid(P, 0.16));
      ctx.lineWidth = Math.max(1.5, fh * 0.028);
      ctx.beginPath();
      ctx.moveTo(x, gy - fh * 1.42);
      ctx.quadraticCurveTo(x, gy - fh * 1.58, x + fh * 0.16, gy - fh * 1.56);
      ctx.stroke();
      lamp(x + fh * 0.16, gy - fh * 1.52, Math.max(1.8, fh * 0.038), 0.90);
      pool(x + fh * 0.16, gy + fh * 0.34, fh * 1.6, fh * 0.60, 0.8);
      /* and the same light lying on the water on the other side of the quay,
         which is half of what a harbour at night is */
      reflect(x + fh * 0.16, edge.yAt(x), fh * 0.22, fh * 1.1, 0.8);
    });
  }

  function yard(L, P) {
    const g = L.ground, fh = L.figureH;

    /* THE hull. It is the biggest object anywhere in this game and it is here
       to tell you how big the thing you sail actually is, which nothing in
       this game has ever done. She is on blocks, so the blocks go under her
       first and her keel sits on them rather than above them. */
    const r = spotById(L, 'blocks');
    const bx = r ? r.cx : L.w * 0.285;
    const by = r ? r.base : g.yAt(bx);
    const lift = fh * 0.46;
    for (let i = -1; i <= 1; i++) {
      box(bx + i * fh * 0.78, by, fh * 0.36, lift, fh * 0.11, P, 0.09);
    }
    /* the dark she casts on the ground under herself, which is what makes the
       gap under a hull on blocks read as a gap you could lie down in */
    ctx.save();
    const ug = ctx.createLinearGradient(0, by - lift, 0, by + fh * 0.10);
    ug.addColorStop(0, 'rgba(0,0,0,0.55)');
    ug.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ug;
    ctx.fillRect(bx - fh * 1.35, by - lift, fh * 2.7, lift + fh * 0.10);
    ctx.restore();

    /* The props holding her upright, BEFORE her, or they read as poles driven
       through the hull rather than as shores leaning on it. */
    [-1, 1].forEach(function (sgn) {
      ctx.strokeStyle = css(solid(P, 0.13));
      ctx.lineWidth = Math.max(2, fh * 0.038);
      ctx.beginPath();
      ctx.moveTo(bx + sgn * fh * 1.62, by);
      ctx.lineTo(bx + sgn * fh * 1.10, by - lift - fh * 0.34);
      ctx.stroke();
    });
    ctx.save();
    ctx.translate(bx, by - lift - fh * 0.06);
    VF.boatArt.draw(ctx, { len: 1, beam: 1.40, sheer: 0.36, prow: 0.55,
                           cabin: 0.42, mast: 0, hull: '#2b2620', trim: '#463c32' },
                    fh * 3.1,
                    { time: t, light: { bright: P.bright * 0.7, tint: P.fog, k: 0.26 } });
    ctx.restore();

    /* a brazier between the two of them: a second light source, and the only
       warm thing in a yard */
    const fx = L.w * 0.505, fy = g.yAt(L.w * 0.505);
    box(fx, fy, fh * 0.20, fh * 0.17, fh * 0.06, P, 0.13);
    lamp(fx, fy - fh * 0.21,
         Math.max(2, fh * 0.042) * (1 + 0.12 * Math.sin(t * 5.1)), 0.95);
    pool(fx, fy + fh * 0.06, fh * 1.5, fh * 0.44, 0.9);

    /* His work lamp, on the ground beside him under her. It is the only thing
       that makes a man lying in the dark under a hull visible at all, and a
       mechanic with a lamp is what the writing already says he is. */
    const mp = (L.view.people || []).filter(function (q) { return q.pose === 'under'; })[0];
    if (mp) {
      const mx = mp.at * L.w, my = g.yAt(mx);
      lamp(mx - fh * 0.34, my - fh * 0.07, Math.max(1.6, fh * 0.030), 0.85);
      pool(mx, my + fh * 0.02, fh * 0.95, fh * 0.28, 1.0);
    }

    /* and your own boat, on a cradle, close enough to read every plate */
    const mine = spotById(L, 'mine');
    if (mine) drawOnHard(L, P, mine);
  }

  function market(L, P) {
    const g = L.ground, fh = L.figureH;
    const v = L.view;
    const aw = v.awning;
    const y0 = aw.y * L.h;
    const x0 = aw.from * L.w, x1 = aw.to * L.w;

    /* the awning: one roof over all three, thin, and lit on its underside so
       it is a canvas rather than a hole in the top of the frame */
    ctx.fillStyle = css(solid(P, 0.07));
    ctx.beginPath();
    ctx.moveTo(x0, y0 + fh * 0.16);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 - fh * 0.10, x1, y0 + fh * 0.18);
    ctx.lineTo(x1, y0 - fh * 0.06);
    ctx.quadraticCurveTo((x0 + x1) / 2, y0 - fh * 0.32, x0, y0 - fh * 0.08);
    ctx.closePath();
    ctx.fill();
    /* the scalloped hem, hanging off the front edge of it */
    ctx.strokeStyle = css(U.mixRgb(P.glow, LAMP, 0.55), 0.26);
    ctx.lineWidth = Math.max(1, fh * 0.016);
    ctx.beginPath();
    const step = fh * 0.30;
    for (let x = x0; x < x1; x += step) {
      const u = (x - x0) / (x1 - x0);
      const yy = y0 + fh * 0.16 + Math.sin(u * Math.PI) * -fh * 0.26 + fh * 0.26;
      ctx.moveTo(x, yy - fh * 0.10);
      ctx.quadraticCurveTo(x + step * 0.5, yy + fh * 0.14, x + step, yy - fh * 0.10);
    }
    ctx.stroke();
    /* the poles */
    [0.02, 0.30, 0.58, 0.84].forEach(function (f) {
      const x = L.w * f;
      post(x, y0 + fh * 0.10, g.yAt(x), fh * 0.036, P, 0.09);
    });
    /* lanterns strung under it */
    for (let i = 0; i < 7; i++) {
      const u = (i + 0.5) / 7;
      const x = x0 + (x1 - x0) * u;
      const yy = y0 + fh * 0.16 + Math.sin(u * Math.PI) * -fh * 0.22 + fh * 0.34;
      ctx.strokeStyle = css(solid(P, 0.24), 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yy - fh * 0.22); ctx.lineTo(x, yy); ctx.stroke();
      lamp(x, yy, Math.max(1.5, fh * 0.030), 0.78);
      /* and the light they lay on the boards under the row */
      pool(x, g.yAt(x) + fh * 0.10, fh * 1.1, fh * 0.34, 0.55);
    }
  }

  /* The stations are drawn AFTER the people, because a shopkeeper stands
     behind their counter and a counter drawn first cuts them off at the
     knee — which is exactly what it did. */
  function marketFront(L, P) {
    stall(L, P, spotById(L, 'counter'), 'counter');
    stall(L, P, spotById(L, 'stall'), 'stall');
    stall(L, P, spotById(L, 'table'), 'table');
  }

  function home(L, P) {
    const g = L.ground, fh = L.figureH;
    const v = L.view;
    const floorY = g.yAt(L.w * 0.5);

    const win = v.window;
    const wx0 = win[0] * L.w, wy0 = win[1] * L.h;
    const wx1 = win[2] * L.w, wy1 = win[3] * L.h;

    /* The wall, painted around the window. The hole is left unpainted and what
       is behind it is the shader — so the sea in the window moves, and the
       light in the room is whatever the light outside is. */
    const wall = solid(P, 0.09, 0.14);
    ctx.save();
    const wg = ctx.createLinearGradient(0, 0, 0, floorY);
    wg.addColorStop(0, css(U.shade(wall, -0.52)));
    wg.addColorStop(0.70, css(wall));
    wg.addColorStop(1, css(U.mixRgb(wall, LAMP, 0.12)));
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.rect(-10, -10, L.w + 20, floorY + 10);
    ctx.rect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.fill('evenodd');
    ctx.restore();

    /* boards on the wall too, vertical, so the room is built out of something */
    ctx.save();
    ctx.beginPath();
    ctx.rect(-10, -10, L.w + 20, floorY + 10);
    ctx.rect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.clip('evenodd');
    ctx.strokeStyle = css(U.shade(wall, -0.45), 0.5);
    ctx.lineWidth = Math.max(1, fh * 0.010);
    for (let x = 0; x < L.w; x += fh * 0.40) {
      ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x, floorY); ctx.stroke();
    }
    ctx.restore();

    /* skirting: the line where the wall stops. Without it the room is one
       flat colour with things floating in it. */
    ctx.fillStyle = css(U.shade(wall, -0.30));
    ctx.fillRect(-10, floorY - fh * 0.11, L.w + 20, fh * 0.11);
    ctx.strokeStyle = css(U.mixRgb(P.glow, LAMP, 0.5), 0.16);
    ctx.lineWidth = Math.max(1, fh * 0.012);
    ctx.beginPath();
    ctx.moveTo(-10, floorY - fh * 0.11); ctx.lineTo(L.w + 10, floorY - fh * 0.11);
    ctx.stroke();

    /* the frame and the bars — a window with no frame is a rectangle of sea */
    ctx.strokeStyle = css(U.shade(solid(P, 0.12), -0.15));
    ctx.lineWidth = Math.max(3, fh * 0.052);
    ctx.strokeRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
    ctx.lineWidth = Math.max(1.5, fh * 0.020);
    ctx.beginPath();
    ctx.moveTo((wx0 + wx1) / 2, wy0); ctx.lineTo((wx0 + wx1) / 2, wy1);
    ctx.moveTo(wx0, (wy0 + wy1) / 2); ctx.lineTo(wx1, (wy0 + wy1) / 2);
    ctx.stroke();
    /* the light it throws across the floor */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = ctx.createLinearGradient(0, wy1, 0, L.h);
    fl.addColorStop(0, css(P.glow, 0.09 * P.bright + 0.03));
    fl.addColorStop(1, css(P.glow, 0));
    ctx.fillStyle = fl;
    ctx.beginPath();
    ctx.moveTo(wx0 - fh * 0.1, wy1); ctx.lineTo(wx1 + fh * 0.1, wy1);
    ctx.lineTo(wx1 + fh * 1.1, L.h); ctx.lineTo(wx0 - fh * 1.1, L.h);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    /* the door through to the tanks, inset into the wall */
    const door = spotById(L, 'tanks');
    if (door) {
      ctx.fillStyle = css(U.shade(wall, -0.62));
      ctx.fillRect(door.x, door.y, door.w, door.h);
      ctx.strokeStyle = css(U.mixRgb(wall, P.glow, 0.30), 0.85);
      ctx.lineWidth = Math.max(1.5, fh * 0.020);
      ctx.strokeRect(door.x, door.y, door.w, door.h);
      ctx.fillStyle = css(U.mixRgb(P.glow, [255, 255, 255], 0.3), 0.5);
      ctx.beginPath();
      ctx.arc(door.x + door.w * 0.86, door.y + door.h * 0.55, fh * 0.022, 0, TAU);
      ctx.fill();
      /* the green of the tanks, coming under it */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const dg = ctx.createLinearGradient(door.x, 0, door.x + door.w, 0);
      dg.addColorStop(0, css([110, 220, 200], 0));
      dg.addColorStop(0.5, css([110, 220, 200], 0.16));
      dg.addColorStop(1, css([110, 220, 200], 0));
      ctx.fillStyle = dg;
      ctx.fillRect(door.x, door.y + door.h - fh * 0.035, door.w, fh * 0.035);
      ctx.restore();
    }

    /* the wall of catches */
    const wall2 = spotById(L, 'wall');
    if (wall2) drawCatchWall(L, P, wall2);

    /* the desk, the book open on it, and the lamp that is the only reason you
       can see any of this */
    const desk = spotById(L, 'desk');
    if (desk) {
      box(desk.cx, desk.base, desk.w, desk.h, fh * 0.13, P, 0.13, 0.08);
      const bx = desk.cx - desk.w * 0.10, by = desk.base - desk.h - fh * 0.008;
      poly([[bx - fh * 0.19, by], [bx, by - fh * 0.032],
            [bx + fh * 0.19, by], [bx, by + fh * 0.022]],
           css(U.mixRgb([214, 204, 182], LAMP, 0.30), 0.92));
      ctx.strokeStyle = css([60, 55, 48], 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(bx, by - fh * 0.030); ctx.lineTo(bx, by + fh * 0.020); ctx.stroke();
      const lx = desk.cx + desk.w * 0.34, ly = desk.base - desk.h;
      post(lx, ly - fh * 0.30, ly, fh * 0.016, P, 0.22);
      /* The lamp lights the room, not only itself. Without these two the desk
         is a box in the dark with a bright dot on it. */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const wl = ctx.createRadialGradient(lx, ly - fh * 0.32, 0, lx, ly - fh * 0.32, fh * 2.6);
      wl.addColorStop(0, css(LAMP, 0.16));
      wl.addColorStop(0.4, css(LAMP, 0.05));
      wl.addColorStop(1, css(LAMP, 0));
      ctx.fillStyle = wl;
      ctx.fillRect(lx - fh * 2.6, ly - fh * 2.9, fh * 5.2, fh * 5.2);
      ctx.restore();
      pool(desk.cx, desk.base + fh * 0.10, fh * 1.9, fh * 0.52, 0.9);
      lamp(lx, ly - fh * 0.32, Math.max(1.8, fh * 0.032), 0.95);
    }
  }

  /* ------------------------------------------------------------ the props */

  function ropeCoil(x, y, r, P) {
    ctx.strokeStyle = css(solid(P, 0.20), 0.85);
    ctx.lineWidth = Math.max(1.2, r * 0.14);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.10 * i, r * (1 - i * 0.16), r * 0.34 * (1 - i * 0.14), 0, 0, TAU);
      ctx.stroke();
    }
  }

  function stall(L, P, r, kind) {
    if (!r) return;
    const fh = L.figureH;
    box(r.cx, r.base, r.w, r.h, fh * 0.10, P, 0.18, 0.09);
    if (kind === 'counter') {
      /* things on it, in a row, because a shop counter with nothing on it is
         a table */
      for (let i = 0; i < 5; i++) {
        const x = r.cx - r.w * 0.32 + i * r.w * 0.16;
        box(x, r.base - r.h - fh * 0.05, fh * 0.085, fh * 0.11, fh * 0.03, P, 0.26, 0.14);
      }
      /* and a lamp on the end of it */
      lamp(r.cx + r.w * 0.44, r.base - r.h - fh * 0.14, Math.max(1.4, fh * 0.026), 0.8);
    } else if (kind === 'stall') {
      /* useless things, hanging on strings above it */
      for (let i = 0; i < 6; i++) {
        const x = r.cx - r.w * 0.40 + i * r.w * 0.16;
        const yy = r.y - fh * (0.52 + 0.18 * Math.abs(Math.sin(i * 1.7)));
        ctx.strokeStyle = css(solid(P, 0.26), 0.45);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, yy - fh * 0.40); ctx.lineTo(x, yy); ctx.stroke();
        ctx.fillStyle = css(U.mixRgb(solid(P, 0.34), P.glow, 0.40), 0.9);
        ctx.beginPath(); ctx.arc(x, yy, fh * 0.030, 0, TAU); ctx.fill();
      }
    } else {
      /* the chart, unrolled, weighted at the corners */
      const cx = r.cx, cy = r.base - r.h - fh * 0.012;
      poly([[cx - r.w * 0.44, cy], [cx + r.w * 0.44, cy - fh * 0.016],
            [cx + r.w * 0.40, cy - fh * 0.10], [cx - r.w * 0.40, cy - fh * 0.084]],
           css(U.mixRgb([198, 186, 154], LAMP, 0.26), 0.9));
      ctx.strokeStyle = css([80, 100, 122], 0.55);
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - r.w * 0.34, cy - fh * 0.026 - i * fh * 0.020);
        ctx.lineTo(cx + r.w * 0.28, cy - fh * 0.036 - i * fh * 0.017);
        ctx.stroke();
      }
      [-1, 1].forEach(function (sg) {
        box(cx + sg * r.w * 0.36, cy - fh * 0.05, fh * 0.05, fh * 0.05, fh * 0.02, P, 0.3);
      });
    }
  }

  function drawCatchWall(L, P, r) {
    const fh = L.figureH;
    const d = VF.state.data;
    /* a board on the wall with pegs in it, not a black rectangle */
    ctx.fillStyle = css(U.shade(solid(P, 0.09, 0.10), -0.30));
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = css(U.mixRgb(solid(P, 0.22), LAMP, 0.25), 0.75);
    ctx.lineWidth = Math.max(1.5, fh * 0.018);
    ctx.strokeRect(r.x, r.y, r.w, r.h);

    const kept = (d.catches || []).slice(-6);
    const cols = 3, rows = 2;
    for (let i = 0; i < cols * rows; i++) {
      const cx = r.x + r.w * ((i % cols) + 0.5) / cols;
      const cy = r.y + r.h * (Math.floor(i / cols) + 0.5) / rows;
      /* the peg is always there. What hangs off it is what you kept. */
      ctx.fillStyle = css(U.shade(solid(P, 0.26), -0.1), 0.7);
      ctx.beginPath();
      ctx.arc(cx, cy - r.h / rows * 0.34, Math.max(1.2, fh * 0.016), 0, TAU);
      ctx.fill();
      const c = kept[i];
      const f = c && c.id && VF.fish ? VF.fish.get(c.id) : null;
      if (!f) continue;
      ctx.save();
      ctx.translate(cx, cy + r.h / rows * 0.04);
      ctx.globalAlpha = 0.92;
      VF.fishArt.drawSilhouette(ctx, f, Math.min(r.w / cols, r.h / rows) * 0.88, 1, 0.45);
      ctx.restore();
    }
    if (!kept.length) {
      ctx.fillStyle = css(U.mixRgb(solid(P, 0.34), LAMP, 0.3), 0.30);
      ctx.font = '400 ' + Math.round(fh * 0.062) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('empty pegs', r.x + r.w / 2, r.y + r.h + fh * 0.13);
    }
  }

  /* ---------------------------------------------------------- your boat

     Moored, and showing its actual condition. Until now boatArt drew neither
     the wear nor the modules — the winch and gantry it draws are trim
     cosmetics — so the only way to know the state of your hull was to open a
     panel and read a percentage. Here it is planking. */
  function drawMoored(L, P, r) {
    const fh = L.figureH;
    /* boatArt multiplies by the hull's own `len`, so a hull that is half as
       long again would come out half as long again here. Dividing it back out
       means the boat is the size the composition asked for whatever you own —
       and a survey vessel still looks bigger than a skiff, because it is
       drawn beamier and taller, which is where that difference belongs. */
    const len = r.w / Math.max(0.4, VF.boatArt.spec().len || 1);
    const roll = Math.sin(t * 0.62) * 0.016;
    const lift = Math.sin(t * 0.85) * r.w * 0.005;
    const b = VF.boat.shape();
    ctx.save();
    /* The dock is between you and her, so everything below the quay line is
       behind it. Clipping there is what stops a moored boat reading as a boat
       standing on the planks. */
    const top2 = L.edge.sample(-10, L.w + 10, 10);
    ctx.beginPath();
    ctx.moveTo(-10, -20); ctx.lineTo(L.w + 10, -20);
    for (let i = top2.length - 1; i >= 0; i--) ctx.lineTo(top2[i][0], top2[i][1] + fh * 0.03);
    ctx.closePath();
    ctx.clip();
    ctx.translate(r.cx, r.base - fh * 0.02 + lift);
    ctx.rotate(roll);
    VF.boatArt.drawMine(ctx, len, {
      time: t, light: { bright: P.bright, tint: P.waterTop, k: 0.22 },
      wear: b.wear || 0, modules: b.modules
    });
    ctx.restore();
    /* the line holding her to the bollard: the difference between moored and
       simply floating next to a dock */
    ctx.strokeStyle = css(solid(P, 0.28), 0.75);
    ctx.lineWidth = Math.max(1.2, fh * 0.016);
    ctx.beginPath();
    ctx.moveTo(r.cx - r.w * 0.34, r.base - fh * 0.10);
    ctx.quadraticCurveTo(r.cx - r.w * 0.52, r.base + fh * 0.16,
                         L.w * 0.185, L.ground.yAt(L.w * 0.185) - fh * 0.14);
    ctx.stroke();
  }

  function drawOnHard(L, P, r) {
    const fh = L.figureH;
    const len = r.w / Math.max(0.4, VF.boatArt.spec().len || 1);
    const b = VF.boat.shape();
    /* the cradle, first, so she sits in it */
    for (let i = -1; i <= 1; i += 2) {
      box(r.cx + i * r.w * 0.26, r.base, fh * 0.24, fh * 0.22, fh * 0.07, P, 0.09);
    }
    ctx.save();
    ctx.translate(r.cx, r.base - fh * 0.20);
    VF.boatArt.drawMine(ctx, len, {
      time: t, light: { bright: P.bright * 0.85, tint: P.fog, k: 0.20 },
      wear: b.wear || 0, modules: b.modules
    });
    ctx.restore();
  }

  /* -------------------------------------------------------------- people */

  function drawPeople(L, P, S) {
    const v = L.view;
    const rim = U.rgbToCss(P.glow, 0.13 + P.bright * 0.16);
    for (let i = 0; i < v.people.length; i++) {
      const p = v.people[i];
      const npc = VF.npcs.get(p.npc);
      if (!npc) continue;
      const a = VF.place.anchor(p, L);
      const talking = !!(S.talk && S.talk.id === p.npc);
      ctx.save();
      ctx.translate(a.x, a.y);
      if (p.depth && p.depth < 1) ctx.globalAlpha = U.lerp(0.45, 1, p.depth);
      VF.npcArt.draw(ctx, npc, a.fh, t, {
        facing: p.facing === undefined ? 1 : p.facing,
        rim: rim, walk: 0, phase: 0, pose: p.pose || 'stand',
        talking: talking
      });
      ctx.restore();
      /* somebody with something to say has a light on them, not an icon */
      if (!S.talk && S.words[p.npc]) {
        /* A light on them, not an icon over them — and not over the head of
           somebody whose head is currently under a boat. */
        const ly = p.pose === 'under' ? a.y - a.fh * 0.26
                 : p.pose === 'sit'   ? a.y - a.fh * 0.86
                 : a.y - a.fh * 1.16;
        lamp(a.x + (p.pose === 'under' ? a.fh * 0.42 : 0), ly,
             Math.max(1.4, a.fh * 0.022), 0.30 + 0.16 * Math.sin(t * 1.6 + i));
      }
    }
  }

  /* ---------------------------------------------------------- the chrome

     Drawn on the canvas rather than in HTML, deliberately. A place that
     labels itself is a place; a place with a bar of buttons over it is a
     menu, and telling the difference is most of what this whole file is for. */
  function drawChrome(L, P, S) {
    const fh = L.figureH;
    const v = L.view;

    /* The ways out, in fixed lanes at the bottom corners. Always the same two
       places in every view, so the player learns where a door is once rather
       than hunting for one in each new composition. */
    const lanes = VF.place.exitLanes(L);
    for (let i = 0; i < lanes.length; i++) {
      const e = lanes[i].exit, r = lanes[i].rect, side = lanes[i].side;
      const on = S.hover && S.hover.kind === 'exit' && S.hover.exit.to === e.to;
      ctx.save();
      ctx.globalAlpha = (on ? 1 : 0.48) * (S.talk ? 0.22 : 1);
      const ay = r.y + r.h * 0.5;
      const ax = side < 0 ? r.x + fh * 0.16 : r.x + r.w - fh * 0.16;
      ctx.strokeStyle = U.rgbToCss(P.glow, 0.9);
      ctx.lineWidth = Math.max(1.6, fh * 0.026);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(ax - side * fh * 0.10, ay - fh * 0.10);
      ctx.lineTo(ax + side * fh * 0.08, ay);
      ctx.lineTo(ax - side * fh * 0.10, ay + fh * 0.10);
      ctx.stroke();
      ctx.fillStyle = U.rgbToCss(P.glow, on ? 0.95 : 0.8);
      ctx.font = '500 ' + Math.round(fh * 0.082) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = side < 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(e.label, side < 0 ? ax + fh * 0.22 : ax - fh * 0.22, ay);
      ctx.restore();
    }

    /* what the pointer is over. One line, at the thing, not in a corner. */
    if (S.hover && S.hover.kind === 'spot' && !S.talk) {
      const r = S.hover.rect, sp = S.hover.spot;
      ctx.save();
      ctx.strokeStyle = U.rgbToCss(P.glow, 0.30);
      ctx.lineWidth = Math.max(1, fh * 0.014);
      const c = fh * 0.13;
      [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1],
       [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]].forEach(function (q) {
        ctx.beginPath();
        ctx.moveTo(q[0] + q[2] * c, q[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.lineTo(q[0], q[1] + q[3] * c);
        ctx.stroke();
      });
      ctx.fillStyle = U.rgbToCss(P.glow, 0.92);
      ctx.font = '500 ' + Math.round(fh * 0.082) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(sp.label, r.x + r.w / 2, r.y - fh * 0.06);
      if (sp.hint) {
        ctx.globalAlpha = 0.55;
        ctx.font = '400 ' + Math.round(fh * 0.064) + 'px ui-sans-serif, system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(sp.hint, r.x + r.w / 2, r.y + r.h + fh * 0.05);
      }
      ctx.restore();
    }

    /* where you are. Small, top left, and it fades once you have arrived. */
    const nameA = U.clamp(1.6 - S.arrive * 0.9, 0.30, 1) * (S.talk ? 0.3 : 1);
    ctx.save();
    ctx.globalAlpha = nameA;
    ctx.fillStyle = U.rgbToCss(P.glow, 0.9);
    ctx.font = '600 ' + Math.round(fh * 0.095) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(v.name, fh * 0.22, fh * 0.20);
    ctx.globalAlpha = nameA * 0.5;
    ctx.font = '400 ' + Math.round(fh * 0.068) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(v.sub, fh * 0.22, fh * 0.34);
    ctx.restore();

    /* a line somebody is saying, or a thing you looked at */
    const said = S.talk ? VF.place.line() : (S.look ? S.look.text : null);
    if (said) {
      const who = S.talk ? VF.npcs.name(S.talk.id).toLowerCase() : null;
      ctx.save();
      const y = L.h - fh * 0.60;
      ctx.textAlign = 'center';
      if (who) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = U.rgbToCss(U.hexToRgb(S.talk.npc.color || '#8fa8c0'), 1);
        ctx.font = '600 ' + Math.round(fh * 0.062) + 'px ui-sans-serif, system-ui, sans-serif';
        ctx.textBaseline = 'bottom';
        ctx.fillText(who, L.w / 2, y - fh * 0.13);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(232,240,250,0.94)';
      ctx.font = '400 ' + Math.round(fh * 0.088) + 'px ui-sans-serif, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      wrapped(said, L.w / 2, y, L.w * 0.72, fh * 0.115);
      ctx.restore();
    }
  }

  function wrapped(text, cx, y, maxW, lh) {
    const words = String(text).split(' ');
    let line = '', yy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy); yy += lh; line = words[i];
      } else line = test;
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  /* ------------------------------------------------------------------ draw */

  function spotById(L, id) {
    const v = L.view;
    for (let i = 0; i < v.spots.length; i++) {
      if (v.spots[i].id === id) return VF.place.rectOf(v.spots[i], L);
    }
    return null;
  }

  const MIDDLE = { dock: dock, yard: yard, market: market, home: home };
  /* Drawn after the people, because these are things people stand behind. */
  const FRONT = { market: marketFront };

  function draw(L, P, S) {
    ctx = VF.scene.ctx();
    if (!ctx) return;
    t = VF.state.rt.t;

    /* The sky and the sea, on the GPU, at this view's own horizon. In the
       room it is what shows through the window; everywhere else the far layer
       and the ground stand in front of most of it. */
    const glOn = VF.glWorld && VF.glWorld.draw(L, P);
    ctx.clearRect(0, 0, L.w, L.h);
    if (!glOn) {
      /* No WebGL2 here, so the sky and the water are two fills. It is flatter
         and it is a place rather than a black screen. */
      const sg = ctx.createLinearGradient(0, 0, 0, L.horizonY);
      sg.addColorStop(0, css(P.skyTop)); sg.addColorStop(1, css(P.skyBot));
      ctx.fillStyle = sg; ctx.fillRect(0, 0, L.w, L.horizonY);
      const wg = ctx.createLinearGradient(0, L.horizonY, 0, L.h);
      wg.addColorStop(0, css(P.waterTop)); wg.addColorStop(1, css(P.waterBot));
      ctx.fillStyle = wg; ctx.fillRect(0, L.horizonY, L.w, L.h - L.horizonY);
    }

    /* Stepping between views: the new one comes up as the old one goes, with
       a small rise, so it reads as turning round rather than as a cut. */
    const k = U.smoothstep(S.cross);
    ctx.save();
    ctx.globalAlpha = U.clamp(k, 0, 1) * U.clamp(S.arrive * 1.4, 0, 1);
    if (k < 1) ctx.translate(0, (1 - k) * L.figureH * 0.10);

    /* Back to front, and the order is the composition:

       what is far away and only a shape → the surface you are standing on →
       what is on it → the people → and last whatever they are standing
       BEHIND, because a shopkeeper is behind their counter and drawing the
       counter first cut all three of them off at the knee. */
    /* Stars first, because they are behind everything including the air. */
    if (!L.view.interior) {
      buildStars(L, P);
      if (stars) {
        ctx.save();
        ctx.globalAlpha = U.clamp(P.starAlpha === undefined ? 0.5 : P.starAlpha, 0, 1);
        ctx.drawImage(stars, 0, 0, L.w, L.horizonY);
        ctx.restore();
      }
    }
    drawFar(L, P);
    /* The surface that is DRAWN is the outermost one — on the dock that is
       the quay edge, with water above it and boards all the way down to the
       bottom of the frame. Figures stand on `ground`, a couple of paces in
       from that line, which is inside the fill. Drawing the inner curve
       instead left everything on the dock floating over open water. */
    drawGround(L, P, L.edge || L.ground, L.view.interior ? 'floor' : 'boards');
    const mid = MIDDLE[L.view.id];
    if (mid) mid(L, P, S);
    drawPeople(L, P, S);
    const front = FRONT[L.view.id];
    if (front) front(L, P, S);

    ctx.restore();

    ctx.save();
    ctx.globalAlpha = U.clamp(k, 0, 1);
    drawChrome(L, P, S);
    ctx.restore();

    /* Arriving from the water: black, briefly. */
    if (S.arrive < 1) {
      ctx.fillStyle = 'rgba(2,3,6,' + (1 - U.smoothstep(S.arrive)).toFixed(3) + ')';
      ctx.fillRect(0, 0, L.w, L.h);
    }
  }

  VF.portArt = { draw: draw };
})(window.VF = window.VF || {});
