/* VOID FISHING — the shape of each place.

   The first version of this file was wrong and worth saying why: it drew
   TEXTURE. Five gull strokes, nine translucent parallelograms, six little
   triangles. A texture tells you the water is a different colour here. It
   does not tell you where you are, and it does not give you anything to look
   at, and nine textures is still one place.

   This draws COMPOSITION. Every zone has:

     one enormous thing   that runs off the edge of the frame, so the eye has
                          no way to measure it and gives up
     two or three medium  landmarks with a silhouette you could name
     small detail         that moves
     one thing            you will probably not see

   Rules the whole file follows:

   - Landmarks are SILHOUETTES. Almost everything here is one dark shape
     against the sky, because a shape is legible at any size and a rendering
     is not, and because the game already looks like that.
   - Scale comes from putting something small next to something huge. The
     lighthouse at the shore is there to make the cliff behind it enormous.
   - Empty space is a landmark. The trench is mostly nothing on purpose.
   - Nothing here explains itself, moves to get your attention, or arrives
     with a caption.

   Two passes. `drawBack` runs immediately after the land, so the fog and the
   water go over the top of it and it sits in the weather. `drawFront` runs
   over the surface, for the few things that are floating on it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  let t = 0;
  let bake = null, bakeKey = '';
  let rnd = null, seedKey = '';
  let motes = null, gulls = null;

  function tick(dt) { t += dt; }

  /* ------------------------------------------------------------ helpers */

  function shade(P, k) {
    /* One family of darks for every silhouette in the game, pulled off the
       sky rather than hard-coded, so a landmark sits in the same air as the
       ridgeline behind it. */
    return U.rgbToCss(U.mixRgb(P.skyBot, [2, 3, 6], k));
  }

  /* The edge light. A dark shape against a dark sky is not a silhouette, it
     is a smudge — what makes it read as a form is one lit edge on the side
     the light is on. Every landmark in this file that matters gets one, and
     it is the single change that made the trench stop being grey soup. */
  function rim(P, a) {
    return U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.30), a);
  }
  function edge(g, P, a, w) {
    g.strokeStyle = rim(P, a);
    g.lineWidth = w || 1.2;
    g.stroke();
  }

  function seed(id, L) {
    const key = id + '|' + Math.round(L.w) + 'x' + Math.round(L.h);
    if (seedKey === key) return;
    seedKey = key;
    rnd = VF.rng.make(0xC0FFEE ^ (id.length * 2654435761));
    motes = [];
    for (let i = 0; i < 40; i++) {
      motes.push({ x: rnd(), y: rnd(), sp: 0.003 + rnd() * 0.014,
                   s: 0.4 + rnd() * 1.5, p: rnd() * 6 });
    }
    gulls = [];
    for (let i = 0; i < 4; i++) {
      gulls.push({ x: rnd(), y: 0.24 + rnd() * 0.36, sp: 0.006 + rnd() * 0.014,
                   s: 0.5 + rnd() * 0.7, p: rnd() * 6 });
    }
  }

  /* ============================================================ THE SHORE

     A coastline, not a beach. The enormous thing is a headland on the left
     that goes up out of frame; the lighthouse standing on the end of it is
     there to say how big the headland is. Then a dock, then a wreck, then
     gulls. The thing you may not see is out past all of it. */
  /* The headland, the lighthouse and the three islands used to be drawn here,
     each at a hardcoded fraction of the screen width. They are landmarks now —
     placed by js/world/landmarks.js on sightlines, drawn by
     js/render/landmarkArt.js at whatever distance they were placed at, and
     able to be looked at, approached and missed, none of which a screen
     fraction can do.

     What is left in the back layer for this zone is nothing, and that is the
     right answer: the shore's distance is the ridgeline and its landmarks,
     and a third layer between them was only ever making the frame busier. */

  function shoreFront(g, L, P, v) {
    const hy = L.horizonY, W = L.w, wh = L.waterH;

    /* The island that goes away. Same silhouette and same value as the three
       that are actually there, so for the first few seconds it is simply a
       fourth island — which is what makes the next thirty seconds work. */
    if (v.receding) {
      const k = U.clamp(v.receding.t / v.receding.dur, 0, 1);
      const sz = Math.pow(1 - k, 1.7);
      const x = W * U.lerp(v.receding.x, 0.62, Math.pow(k, 1.4));
      const w = W * 0.030 * sz, h = L.h * 0.020 * sz;
      if (w > 0.4) {
        g.save();
        g.globalAlpha = Math.min(1, sz * 1.6);
        g.fillStyle = shade(P, 0.58);
        g.beginPath();
        g.moveTo(x - w, hy + 1);
        g.quadraticCurveTo(x - w * 0.3, hy - h * 1.15, x + w * 0.15, hy - h * 0.72);
        g.quadraticCurveTo(x + w * 0.62, hy - h * 0.34, x + w, hy + 1);
        g.closePath();
        g.fill();
        g.restore();
      }
    }


    /* The dock, the wreck and the thing standing out past the last island
       were all here, at fractions of the screen width. They are landmarks now.
       What stays in the front layer is what belongs to the zone's RULE rather
       than to its geography: the island that goes away, and the gulls. */

    gullsOver(g, L, P);

  }

  function gullsOver(g, L, P) {
    g.save();
    g.globalAlpha = 0.22 + P.bright * 0.30;
    g.strokeStyle = 'rgba(226,236,246,0.9)';
    gulls.forEach(function (b) {
      const x = ((b.x + t * b.sp) % 1.25 - 0.12) * L.w;
      const y = L.horizonY * (0.34 + b.y * 0.42) + Math.sin(t * 0.6 + b.p) * L.h * 0.008;
      const s = L.w * 0.0045 * b.s;
      const flap = Math.sin(t * 3.1 + b.p) * 0.55;
      g.lineWidth = Math.max(0.7, s * 0.30);
      g.beginPath();
      g.moveTo(x - s, y + flap * s * 0.7);
      g.quadraticCurveTo(x - s * 0.3, y - s * 0.35, x, y);
      g.quadraticCurveTo(x + s * 0.3, y - s * 0.35, x + s, y + flap * s * 0.7);
      g.stroke();
    });
    g.restore();
  }

  /* =========================================================== THE BASIN

     The enormous thing is the bowl. A continuous wall of cliff all the way
     round the horizon with one gap in it, so the water reads as enclosed and
     the moon reads as directly overhead rather than far away. */
  function basinBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;

    g.fillStyle = shade(P, 0.66);
    g.beginPath();
    g.moveTo(-4, hy + 2);
    /* Height falls toward the middle and rises again, which is what a bowl
       seen from inside it looks like. The gap on the right is where the moon
       gets in and is the only way out. */
    const N = 40;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const x = -4 + u * (W + 8);
      let h = (0.34 - Math.sin(u * Math.PI) * 0.20) * hy;
      // the gap
      const gap = Math.exp(-Math.pow((u - 0.74) / 0.075, 2));
      h *= 1 - gap * 0.94;
      // and a little jaggedness so it is rock rather than a curve
      h *= 1 + Math.sin(u * 41.3) * 0.07 + Math.sin(u * 17.1) * 0.05;
      g.lineTo(x, hy - h);
    }
    g.lineTo(W + 4, hy + 2);
    g.closePath();
    g.fill();

    /* Something built on the rim. Three of them, evenly spaced, which is the
       tell — rocks are not evenly spaced. */
    g.fillStyle = shade(P, 0.86);
    [0.22, 0.40, 0.58].forEach(function (u) {
      const x = W * u;
      const base = hy - (0.34 - Math.sin(u * Math.PI) * 0.20) * hy *
                   (1 + Math.sin(u * 41.3) * 0.07);
      const h = hy * 0.085;
      g.beginPath();
      g.moveTo(x - hy * 0.008, base);
      g.lineTo(x - hy * 0.004, base - h);
      g.lineTo(x + hy * 0.004, base - h);
      g.lineTo(x + hy * 0.008, base);
      g.closePath();
      g.fill();
    });
  }

  function basinFront(g, L, P, v) {
    /* mist, lying on the water in bands and not moving much */
    g.save();
    for (let i = 0; i < 4; i++) {
      const y = L.horizonY + L.waterH * (0.06 + i * 0.09);
      const drift = Math.sin(t * 0.05 + i) * L.w * 0.04;
      g.globalAlpha = 0.10 - i * 0.018;
      g.fillStyle = U.rgbToCss(U.mixRgb(P.fog, [255, 255, 255], 0.4));
      g.beginPath();
      g.ellipse(L.w * 0.5 + drift, y, L.w * (0.7 - i * 0.08), L.waterH * 0.035, 0, 0, TAU);
      g.fill();
    }
    g.restore();

    /* On an eclipse the basin stops being lit at all and the things in the
       water stop pretending. */
    if (v.moon && v.moon.id === 'eclipse') {
      g.save();
      g.globalAlpha = 0.55;
      g.fillStyle = '#05030c';
      g.fillRect(0, 0, L.w, L.h);
      g.restore();
      for (let i = 0; i < 5; i++) {
        const x = L.w * (0.14 + i * 0.18);
        const y = L.horizonY + L.waterH * (0.22 + (i % 3) * 0.16);
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = 'rgba(200,160,255,' + (0.20 + 0.16 * Math.sin(t * 1.4 + i)).toFixed(3) + ')';
        g.beginPath();
        g.arc(x, y, L.w * 0.004, 0, TAU);
        g.fill();
        g.restore();
      }
    }
  }

  /* ====================================================== THE GLASS FLATS

     The whole zone is one idea: you can see too much. So the enormous thing
     is UNDER the water — a formation the size of a district, in plan, with
     the water lying flat over the top of it like a sheet of glass over a
     drawing. Nothing here is above the horizon at all, which is its own kind
     of composition. */
  /* The four pylons. Shared by the back pass and the reflection, because the
     whole point of the place is that the two copies are IDENTICAL — if the
     reflection is drawn from different numbers than the thing it reflects,
     the illusion is gone and it just looks like more scenery. */
  const FLATS_PYLONS = [[0.815, 0.062, 0.0045], [0.847, 0.040, 0.0032],
                        [0.782, 0.031, 0.0026], [0.404, 0.021, 0.0020]];

  function flatsPylons(g, L, P, up, alpha) {
    const hy = L.horizonY, W = L.w, H = L.h;
    g.save();
    g.globalAlpha = alpha;
    FLATS_PYLONS.forEach(function (a, i) {
      const x = W * a[0], h = H * a[1], w = Math.max(1.6, W * a[2]);
      const y0 = hy, y1 = hy + (up ? -h : h);
      g.fillStyle = shade(P, 0.44 + i * 0.05);
      g.fillRect(x - w * 0.5, Math.min(y0, y1), w, h);
      // the crossarm, two thirds up, which is what makes it a made thing
      const cy = hy + (up ? -h * 0.68 : h * 0.68);
      g.fillRect(x - w * 2.1, cy, w * 4.2, Math.max(1, w * 0.5));
      // one lit edge, on the side the light is on
      g.beginPath();
      g.moveTo(x + w * 0.5, y0);
      g.lineTo(x + w * 0.5, y1);
      edge(g, P, 0.28, 1);
    });
    g.restore();
  }

  function flatsBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;
    /* The horizon here is a ruled line. No ridgeline (locations.js sets the
       silhouette to none for this zone on purpose) — a mountain range is the
       one thing the Glass Flats cannot have, and having one was what made
       this place look exactly like the shore. */
    g.save();
    g.strokeStyle = rim(P, 0.20);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(-4, hy);
    g.lineTo(W + 4, hy);
    g.stroke();
    g.restore();

    flatsPylons(g, L, P, true, 1);
  }

  function flatsFront(g, L, P, v) {
    const hy = L.horizonY, W = L.w, wh = L.waterH;

    /* Everything above, doubled below. Drawn over the water rather than
       behind it, because a reflection the water covers up is not one. It is
       a fraction too sharp and it does not move with the swell, and that is
       the tell — but nobody is told. */
    flatsPylons(g, L, P, false, 0.55);

    /* The formation. Straight lines under water, which is the whole
       discomfort of the place: it is laid out. */
    g.save();
    g.globalAlpha = 0.30;
    g.strokeStyle = U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.35), 0.5);
    for (let i = 0; i < 7; i++) {
      const y = hy + wh * (0.14 + i * 0.115);
      const sc = 0.25 + i * 0.13;                 // perspective: wider as it nears
      g.lineWidth = Math.max(0.5, 0.5 + i * 0.28);
      g.globalAlpha = 0.10 + i * 0.045;
      g.beginPath();
      g.moveTo(W * (0.5 - sc), y);
      g.lineTo(W * (0.5 + sc), y);
      g.stroke();
    }
    // and the ribs going away from you, converging on a point past the horizon
    for (let i = -4; i <= 4; i++) {
      g.globalAlpha = 0.15;
      g.beginPath();
      g.moveTo(W * (0.5 + i * 0.028), hy + wh * 0.13);
      g.lineTo(W * (0.5 + i * 0.20), L.h + 10);
      g.stroke();
    }
    g.restore();

    /* One enormous block down there, off to the side, with a corner. */
    g.save();
    g.globalAlpha = 0.22;
    g.fillStyle = U.rgbToCss(U.mixRgb(P.waterBot, [255, 255, 255], 0.30));
    g.beginPath();
    g.moveTo(W * 0.66, hy + wh * 0.30);
    g.lineTo(W * 1.02, hy + wh * 0.22);
    g.lineTo(W * 1.02, hy + wh * 0.72);
    g.lineTo(W * 0.62, hy + wh * 0.92);
    g.closePath();
    g.fill();
    g.restore();

    /* The crack, once it has happened. It stays for good. */
    const cracked = VF.zones.state('flats').cracked;
    if (cracked) {
      g.save();
      g.strokeStyle = 'rgba(255,255,255,0.42)';
      g.lineWidth = 1.2;
      let y = hy + wh * 0.40, x = 0;
      g.beginPath();
      g.moveTo(0, y);
      while (x < W) {
        x += W * 0.055;
        y += (((Math.floor(x) * 7919) % 89) / 89 - 0.5) * wh * 0.06;
        g.lineTo(x, y);
      }
      g.stroke();
      // and two shorter ones off it
      g.lineWidth = 0.7;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.moveTo(W * 0.34, hy + wh * 0.40);
      g.lineTo(W * 0.28, hy + wh * 0.72);
      g.moveTo(W * 0.71, hy + wh * 0.41);
      g.lineTo(W * 0.80, hy + wh * 0.66);
      g.stroke();
      g.restore();
    }
  }

  /* ======================================================= THE TRENCH

     The enormous thing is a wall, and the composition is mostly nothing.
     The near wall takes the left quarter of the frame and leaves the top; the
     far wall is a paler slab on the right; between them is a gap of dark
     that is the whole point of the zone. */
  function trenchBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;

    // far wall, right: lighter, so the gap between the two reads as distance
    g.fillStyle = shade(P, 0.52);
    g.beginPath();
    g.moveTo(W + 4, -4);
    g.lineTo(W * 0.76, -4);
    g.quadraticCurveTo(W * 0.735, hy * 0.44, W * 0.790, hy + 2);
    g.lineTo(W + 4, hy + 2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(W * 0.76, -4);
    g.quadraticCurveTo(W * 0.735, hy * 0.44, W * 0.790, hy + 2);
    edge(g, P, 0.14, 1);

    // near wall, left: almost black, and it goes off the top and the bottom
    g.fillStyle = shade(P, 0.90);
    g.beginPath();
    g.moveTo(-4, -4);
    g.lineTo(W * 0.235, -4);
    g.quadraticCurveTo(W * 0.30, hy * 0.30, W * 0.255, hy * 0.72);
    g.quadraticCurveTo(W * 0.225, hy * 0.94, W * 0.265, hy + 2);
    g.lineTo(-4, hy + 2);
    g.closePath();
    g.fill();
    /* and the edge of it, lit. Without this the wall and the sky are the
       same colour and the biggest thing in the zone is invisible. */
    g.beginPath();
    g.moveTo(W * 0.235, -4);
    g.quadraticCurveTo(W * 0.30, hy * 0.30, W * 0.255, hy * 0.72);
    g.quadraticCurveTo(W * 0.225, hy * 0.94, W * 0.265, hy + 2);
    edge(g, P, 0.26, 1.6);
    /* One ledge, with something on it. Both of these were black on black and
       came out as a smudge hanging in mid-air with nothing under it — the
       ledge needs a lit top surface before the eye will accept that the boat
       is standing on anything. */
    g.fillStyle = shade(P, 0.90);
    g.beginPath();
    g.moveTo(W * 0.16, hy * 0.497);
    g.lineTo(W * 0.335, hy * 0.531);
    g.lineTo(W * 0.328, hy * 0.572);
    g.lineTo(W * 0.16, hy * 0.548);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(W * 0.16, hy * 0.497);
    g.lineTo(W * 0.335, hy * 0.531);
    edge(g, P, 0.34, 1.3);

    /* The boat that did not come back. Tipped over on the ledge, and its
       lamp is still lit. Nothing in the game ever mentions it. */
    g.save();
    g.translate(W * 0.283, hy * 0.521);
    g.rotate(0.26);
    g.fillStyle = shade(P, 1);
    g.beginPath();
    g.moveTo(-W * 0.024, 0);
    g.quadraticCurveTo(0, W * 0.013, W * 0.024, -W * 0.002);
    g.lineTo(W * 0.020, -W * 0.009);
    g.quadraticCurveTo(0, -W * 0.001, -W * 0.021, -W * 0.007);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-W * 0.021, -W * 0.007);
    g.quadraticCurveTo(0, -W * 0.001, W * 0.020, -W * 0.009);
    edge(g, P, 0.40, 1);
    // the snapped mast
    g.strokeStyle = rim(P, 0.24);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(W * 0.002, -W * 0.005);
    g.lineTo(W * 0.011, -W * 0.030);
    g.stroke();
    g.restore();

    g.save();
    g.globalCompositeOperation = 'lighter';
    const wx = W * 0.297, wy = hy * 0.512;
    const wg = g.createRadialGradient(wx, wy, 0, wx, wy, W * 0.030);
    wg.addColorStop(0, 'rgba(255,206,140,0.30)');
    wg.addColorStop(1, 'rgba(255,206,140,0)');
    g.fillStyle = wg;
    g.fillRect(wx - W * 0.034, wy - W * 0.034, W * 0.068, W * 0.068);
    g.restore();
  }

  function trenchFront(g, L, P, v) {
    const hy = L.horizonY, W = L.w, wh = L.waterH;

    /* Bioluminescence. Not decoration — it is the only light in the zone and
       it is what the darkness is measured against. */
    g.save();
    g.globalCompositeOperation = 'lighter';
    motes.forEach(function (m, i) {
      const x = ((m.x + Math.sin(t * 0.04 + m.p) * 0.012) % 1) * W;
      const y = hy + ((m.y + t * m.sp * 0.4) % 1) * wh;
      const a = (0.20 + 0.30 * Math.sin(t * 1.1 + m.p)) * (i % 5 ? 0.5 : 1);
      if (a <= 0.02) return;
      g.fillStyle = U.rgbToCss(P.glow, a * 0.55);
      g.beginPath();
      g.arc(x, y, m.s * 0.9, 0, TAU);
      g.fill();
    });
    g.restore();

    /* The dark. Heavy without a set, and the set is the only thing that
       lifts it — which is the whole reason the set exists. */
    const k = v.blind ? 0.80 : 0.44;
    const gr = g.createRadialGradient(W * 0.34, hy + wh * 0.74, W * (v.blind ? 0.05 : 0.13),
                                      W * 0.34, hy + wh * 0.74, W * (v.blind ? 0.44 : 0.78));
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(1,3,6,' + k.toFixed(2) + ')');
    g.fillStyle = gr;
    g.fillRect(0, hy, W, L.h - hy);

    /* And once, for one second in about twenty minutes, the gap between the
       walls is not empty. It does not repeat and it makes no sound. */
    const eye = Math.sin(t * 0.0083);
    if (eye > 0.99975) {
      const kk = Math.sin(((eye - 0.99975) / 0.00025) * Math.PI);
      g.save();
      g.globalCompositeOperation = 'lighter';
      const ex = W * 0.52, ey = hy + wh * 0.30;
      const er = W * 0.045;
      g.fillStyle = 'rgba(220,240,255,' + (0.20 * kk).toFixed(3) + ')';
      g.beginPath();
      g.ellipse(ex, ey, er, er * 0.52, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(6,10,16,' + (0.9 * kk).toFixed(3) + ')';
      g.beginPath();
      g.ellipse(ex, ey, er * 0.30, er * 0.44, 0, 0, TAU);
      g.fill();
      g.restore();
    }
  }

  /* ====================================================== THE CRYSTAL ABYSS

     The crystals are the architecture. Three of them come up out of the water
     and leave the top of the frame; everything else in the zone is lit by
     them. */
  function abyssBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;
    const pillars = [
      { x: 0.13, w: 0.055, h: 1.30, lean: -0.05 },
      { x: 0.70, w: 0.085, h: 1.62, lean: 0.03 },
      { x: 0.90, w: 0.040, h: 0.86, lean: 0.08 }
    ];
    pillars.forEach(function (p, i) {
      const bx = W * p.x, bw = W * p.w, top = hy - hy * p.h;
      const lean = W * p.lean;
      g.fillStyle = shade(P, 0.78);
      g.beginPath();
      g.moveTo(bx - bw, hy + 2);
      g.lineTo(bx - bw * 0.34 + lean, top);
      g.lineTo(bx + bw * 0.30 + lean, top - hy * 0.05);
      g.lineTo(bx + bw, hy + 2);
      g.closePath();
      g.fill();
      /* one lit facet down each, which is what says crystal rather than rock */
      const fg = g.createLinearGradient(bx, hy, bx + lean, top);
      const c = U.mixRgb(P.glow, [255, 255, 255], 0.30);
      fg.addColorStop(0, U.rgbToCss(c, 0.05));
      fg.addColorStop(1, U.rgbToCss(c, 0.30));
      g.fillStyle = fg;
      g.beginPath();
      g.moveTo(bx - bw * 0.10, hy + 2);
      g.lineTo(bx - bw * 0.05 + lean, top);
      g.lineTo(bx + bw * 0.22 + lean, top - hy * 0.03);
      g.lineTo(bx + bw * 0.30, hy + 2);
      g.closePath();
      g.fill();
    });
  }

  function abyssFront(g, L, P, v) {
    const hy = L.horizonY, W = L.w, wh = L.waterH;

    /* The smaller ones, under the surface, and the charge running up them.
       They brighten together as the resonance builds, which is the only
       warning the zone gives before it fires. */
    const ch = v.charge || 0;
    g.save();
    for (let i = 0; i < 5; i++) {
      const x = W * (0.24 + i * 0.13);
      const base = hy + wh * (0.24 + (i % 3) * 0.13);
      const h = wh * (0.10 + (i % 4) * 0.045);
      const pulse = 0.25 + 0.75 * ch * (0.55 + 0.45 * Math.sin(t * 1.8 + i * 1.3));
      g.globalAlpha = 0.12 + pulse * 0.26;
      const cg = g.createLinearGradient(x, base, x, base - h);
      cg.addColorStop(0, U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.2), 0.02));
      cg.addColorStop(1, U.rgbToCss(U.mixRgb(P.glow, [255, 255, 255], 0.55), 0.5));
      g.fillStyle = cg;
      g.beginPath();
      g.moveTo(x - h * 0.16, base);
      g.lineTo(x, base - h);
      g.lineTo(x + h * 0.16, base);
      g.closePath();
      g.fill();
    }
    g.restore();

    if (ch > 0.7) {
      // the water starts answering before anything happens
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = (ch - 0.7) / 0.3 * 0.10;
      const gr = g.createLinearGradient(0, hy, 0, L.h);
      gr.addColorStop(0, U.rgbToCss(P.glow, 0));
      gr.addColorStop(1, U.rgbToCss(P.glow, 0.7));
      g.fillStyle = gr;
      g.fillRect(0, hy, W, L.h - hy);
      g.restore();
    }
  }

  /* =========================================================== THE CRADLE

     The enormous thing is overhead. The inner face of the ring fills the top
     third of the frame, close enough that you can see plating on it, and it
     curves down past both edges — so the water you are fishing in is inside
     something. */
  function cradleBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;
    /* You are underneath it. The arc across the top of the frame is the
       INNER face of something in orbit, close enough to see plating on, and
       the frame cannot hold any part of its width — it leaves both sides.

       Two earlier versions of this were wrong in instructive ways. The first
       put the whole arc above the frame and drew nothing at all. The second
       drew the arc but filled it with sky-coloured dark, so all that showed
       was a hairline, and hung an axis-aligned black rectangle off it for the
       opening, which read as a broken sprite. A ceiling needs MASS — it has
       to be lighter near its lit edge and go to nothing further up, the way
       a surface lit from below actually looks. */
    const R = H * 1.02;
    const arcY = function (x) {
      const dx = (x - W * 0.5) / R;
      return -H * 0.205 + R * Math.sqrt(Math.max(0, 1 - dx * dx)) * 0.42;
    };
    const arcSlope = function (x) {
      const h = W * 0.01;
      return Math.atan2(arcY(x + h) - arcY(x - h), h * 2);
    };
    const low = arcY(W * 0.5);

    g.save();
    /* The mass. This is the part that kept failing: a dark shape painted in
       sky colours on a dark sky is not a ceiling, and with nothing overhead
       to be a hole IN, the opening below just read as a lit object floating
       on a wire. So the surface is a hard dark that is DARKER than the sky
       it covers — the boundary is the whole point — and it holds its value
       right up out of the frame instead of dissolving into it. */
    g.beginPath();
    g.moveTo(-6, -6);
    g.lineTo(W + 6, -6);
    for (let i = 0; i <= 48; i++) {
      const x = W + 6 - (i / 48) * (W + 12);
      g.lineTo(x, arcY(x));
    }
    g.closePath();
    g.save();
    g.clip();
    const mg = g.createLinearGradient(0, -H * 0.16, 0, low);
    mg.addColorStop(0, 'rgb(3,3,7)');
    mg.addColorStop(0.62, 'rgb(9,9,17)');
    mg.addColorStop(1, U.rgbToCss(U.mixRgb([16, 16, 26], P.glow, 0.10), 1));
    g.fillStyle = mg;
    g.fillRect(-8, -H * 0.2, W + 16, low + H * 0.2 + 8);

    /* Circumference bands. A cylinder seen from the inside shows its rings
       before it shows anything else, and these — parallel to the near edge,
       crowding together as they go away from you — are what make it read as
       curved rather than as a wall. */
    for (let b = 1; b <= 7; b++) {
      const off = H * (0.021 * b + 0.010 * b * b);
      g.beginPath();
      for (let i = 0; i <= 48; i++) {
        const x = (i / 48) * W;
        const y = arcY(x) - off;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.strokeStyle = rim(P, 0.16 / (1 + b * 0.45));
      g.lineWidth = 1;
      g.stroke();
    }

    /* Ribs running away from you between the bands, and every fourth one
       carries a light. The lights are what say "built" rather than "rock". */
    for (let i = 0; i <= 26; i++) {
      const x = (i / 26) * W;
      const y = arcY(x);
      const lean = (x - W * 0.5) * 0.16;
      const rg = g.createLinearGradient(x, y, x + lean, y - H * 0.30);
      rg.addColorStop(0, rim(P, 0.20));
      rg.addColorStop(1, rim(P, 0));
      g.strokeStyle = rg;
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + lean, y - H * 0.30);
      g.stroke();
      if (i % 4 === 2) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        const px = x + lean * 0.10, py = y - H * 0.026;
        const pg = g.createRadialGradient(px, py, 0, px, py, W * 0.009);
        pg.addColorStop(0, 'rgba(255,214,150,0.26)');
        pg.addColorStop(1, 'rgba(255,214,150,0)');
        g.fillStyle = pg;
        g.fillRect(px - W * 0.011, py - W * 0.011, W * 0.022, W * 0.022);
        g.restore();
      }
    }
    g.restore();

    /* The opening. It sits ON the surface, so it takes the surface's angle,
       and its light spills out onto the plating around it rather than
       stopping at a border. Nothing about it is explained anywhere. */
    const ox = W * 0.40, oy = arcY(ox);
    g.save();
    g.translate(ox, oy);
    g.rotate(arcSlope(ox));
    const ow = W * 0.150, oh = H * 0.052;
    g.beginPath();
    g.moveTo(-ow * 0.5, 0);
    g.lineTo(-ow * 0.40, -oh);
    g.lineTo(ow * 0.40, -oh);
    g.lineTo(ow * 0.5, 0);
    g.closePath();
    g.fillStyle = 'rgba(1,1,3,0.96)';
    g.fill();
    g.save();
    g.globalCompositeOperation = 'lighter';
    const og = g.createLinearGradient(0, 0, 0, -oh);
    og.addColorStop(0, 'rgba(255,206,132,0.20)');
    og.addColorStop(0.45, 'rgba(255,180,110,0.06)');
    og.addColorStop(1, 'rgba(255,180,110,0)');
    g.fillStyle = og;
    g.fill();
    g.restore();
    // the lip, lit only along the near edge
    g.beginPath();
    g.moveTo(-ow * 0.5, 0);
    g.lineTo(ow * 0.5, 0);
    g.strokeStyle = 'rgba(255,222,168,0.34)';
    g.lineWidth = 1.4;
    g.stroke();
    g.restore();

    // the spill from it, on the plating
    g.save();
    g.globalCompositeOperation = 'lighter';
    const sg = g.createRadialGradient(ox, oy, 0, ox, oy, W * 0.16);
    sg.addColorStop(0, 'rgba(255,198,128,0.09)');
    sg.addColorStop(1, 'rgba(255,198,128,0)');
    g.fillStyle = sg;
    g.fillRect(ox - W * 0.18, oy - W * 0.18, W * 0.36, W * 0.36);
    g.restore();

    // and the near edge itself, which is what gives the whole thing a bottom
    g.beginPath();
    for (let i = 0; i <= 48; i++) {
      const x = (i / 48) * W;
      i ? g.lineTo(x, arcY(x)) : g.moveTo(x, arcY(x));
    }
    edge(g, P, 0.40, 1.6);
    g.restore();

    /* And the part of it that is not there any more, coming up out of the
       water at both edges: the ring goes all the way round, and two of its
       ends are down here. */
    g.fillStyle = shade(P, 0.62);
    g.beginPath();
    g.moveTo(-4, hy + 2);
    g.lineTo(-4, hy - hy * 0.16);
    g.lineTo(W * 0.055, hy - hy * 0.12);
    g.lineTo(W * 0.075, hy + 2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(-4, hy - hy * 0.16);
    g.lineTo(W * 0.055, hy - hy * 0.12);
    edge(g, P, 0.26, 1.2);

    g.fillStyle = shade(P, 0.62);
    g.beginPath();
    g.moveTo(W + 4, hy + 2);
    g.lineTo(W + 4, hy - hy * 0.20);
    g.lineTo(W * 0.93, hy - hy * 0.15);
    g.lineTo(W * 0.915, hy + 2);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(W + 4, hy - hy * 0.20);
    g.lineTo(W * 0.93, hy - hy * 0.15);
    edge(g, P, 0.26, 1.2);
  }

  function cradleFront(g, L, P, v) {
    /* debris, hanging in the water where it fell, at the angle it fell at */
    g.save();
    g.globalAlpha = 0.36;
    g.fillStyle = 'rgba(4,6,12,0.9)';
    for (let i = 0; i < 7; i++) {
      const x = L.w * (0.10 + ((i * 0.173) % 0.82));
      const y = L.horizonY + L.waterH * (0.14 + ((i * 0.29) % 0.6));
      const s = L.w * (0.004 + (i % 3) * 0.003);
      g.save();
      g.translate(x, y + Math.sin(t * 0.4 + i) * L.waterH * 0.006);
      g.rotate(i * 1.1);
      g.fillRect(-s, -s * 0.24, s * 2, s * 0.48);
      g.restore();
    }
    g.restore();
  }

  /* ======================================================= THE NOWHERE SEA

     One rule: everything here is doubled, and the copy is wrong. A second
     horizon a few degrees off the first; the same island twice, one of them
     upside down; stars below the waterline. It has to read as WRONG rather
     than as random, so the wrongness is systematic. */
  function nowhereBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;

    /* The second horizon. Not a hairline — a whole second sea, tilted a few
       degrees off the real one and hanging in the sky above it, with its own
       water under it. Drawn faint enough to miss on a bright night and
       impossible to miss on a dark one. The earlier version was a single
       grey stroke and nobody would ever have noticed it. */
    const y0 = hy - H * 0.072, y1 = hy - H * 0.012;
    g.save();
    g.beginPath();
    g.moveTo(-6, y0);
    g.lineTo(W + 6, y1);
    g.lineTo(W + 6, hy + 4);
    g.lineTo(-6, hy + 4);
    g.closePath();
    const sg = g.createLinearGradient(0, y0, 0, hy);
    sg.addColorStop(0, U.rgbToCss(U.mixRgb(P.skyBot, P.waterTop, 0.55), 0.55));
    sg.addColorStop(1, U.rgbToCss(U.mixRgb(P.skyBot, P.waterTop, 0.55), 0));
    g.fillStyle = sg;
    g.fill();
    g.beginPath();
    g.moveTo(-6, y0);
    g.lineTo(W + 6, y1);
    edge(g, P, 0.26, 1);
    g.restore();

    /* An island, and the same island again, upside down, above it. Same
       silhouette, same size, same everything — if the two copies are not
       obviously ONE island the zone reads as random rather than as wrong. */
    function isle(x, y, s, flip, lit) {
      g.save();
      g.translate(W * x, y);
      g.scale(1, flip ? -1 : 1);
      /* A low mound with the peak off to one side. It has to be an ISLAND —
         the first attempt used control points that pushed past the peak on
         both sides and produced a flat-topped box, and two flat-topped boxes
         nose to nose read as an hourglass rather than as one island and its
         wrong copy. */
      g.beginPath();
      g.moveTo(-W * s, 0);
      g.bezierCurveTo(-W * s * 0.66, -H * s * 0.30,
                      -W * s * 0.46, -H * s * 0.86,
                      -W * s * 0.16, -H * s * 0.92);
      g.bezierCurveTo(W * s * 0.10, -H * s * 0.97,
                      W * s * 0.30, -H * s * 0.52,
                      W * s * 0.58, -H * s * 0.40);
      g.bezierCurveTo(W * s * 0.80, -H * s * 0.31, W * s * 0.92, -H * s * 0.12, W * s, 0);
      g.closePath();
      g.fillStyle = shade(P, flip ? 0.26 : 0.44);
      g.fill();
      g.strokeStyle = rim(P, lit);
      g.lineWidth = 1.1;
      g.stroke();
      g.restore();
    }
    const IS = 0.072;
    isle(0.30, hy + 1, IS, false, 0.26);
    isle(0.30, hy - H * 0.250, IS, true, 0.34);

    /* The light on the hanging one comes from underneath it. There is
       nothing underneath it. */
    g.save();
    g.globalCompositeOperation = 'lighter';
    const ix = W * 0.30, iy = hy - H * 0.250;
    const ig = g.createLinearGradient(ix, iy - H * 0.010, ix, iy + H * 0.026);
    ig.addColorStop(0, U.rgbToCss(P.glow, 0));
    ig.addColorStop(0.35, U.rgbToCss(P.glow, 0.20));
    ig.addColorStop(1, U.rgbToCss(P.glow, 0));
    g.fillStyle = ig;
    g.fillRect(ix - W * IS * 1.2, iy - H * 0.010, W * IS * 2.4, H * 0.036);
    g.restore();

    // and one more of it, much further off, where there is no room for it
    isle(0.84, hy + 1, 0.026, false, 0.20);
  }

  function nowhereFront(g, L, P, v) {
    /* stars under the water. Not a reflection — they are in the wrong
       places and they do not move with the swell. */
    g.save();
    motes.forEach(function (m, i) {
      if (i % 2) return;
      const x = m.x * L.w;
      const y = L.horizonY + m.y * L.waterH * 0.9;
      g.fillStyle = U.rgbToCss(P.starTint || [220, 200, 255], 0.30 + 0.2 * Math.sin(t + m.p));
      g.fillRect(x, y, m.s * 0.8, m.s * 0.8);
    });
    g.restore();
  }

  /* ============================================================= BENEATH

     No surface, no horizon, no landmark at eye level — the composition is a
     column of nothing with things in it that have no bottom. What makes it
     read as somewhere you should not be is that everything is VERTICAL and
     nothing rests on anything. */
  function beneathBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;
    /* This one was a black screen. shade(P, 0.94) against a sky that is
       already almost black is not a silhouette, it is nothing — down here
       the only way a shape exists is if something lights an edge of it.
       So: three structures hanging out of the dark with a light running
       down one side, no tops, and no bottoms either — they do not end, they
       stop being visible, which is worse. */
    [[0.15, 0.034, 0.66, 1], [0.57, 0.062, 0.92, -1], [0.88, 0.026, 0.48, 1]]
      .forEach(function (a, i) {
        const x = W * a[0], w = W * a[1], bot = hy * a[2], side = a[3];

        // the body. Barely above the ground, but above it.
        g.save();
        g.beginPath();
        g.moveTo(x - w, -4);
        g.lineTo(x + w, -4);
        g.lineTo(x + w * 0.58, bot);
        g.lineTo(x - w * 0.58, bot);
        g.closePath();
        const bg = g.createLinearGradient(0, 0, 0, bot);
        bg.addColorStop(0, U.rgbToCss(U.mixRgb(P.skyTop, [26, 22, 40], 0.55), 1));
        bg.addColorStop(0.72, U.rgbToCss(U.mixRgb(P.skyBot, [14, 11, 24], 0.75), 1));
        bg.addColorStop(1, U.rgbToCss(P.skyBot, 0));   // no bottom. it just stops.
        g.fillStyle = bg;
        g.fill();

        // banding, so it reads as built and as very tall
        g.strokeStyle = 'rgba(2,2,6,0.45)';
        g.lineWidth = 1;
        for (let k = 1; k < 11; k++) {
          const y = (k / 11) * bot;
          const hw = U.lerp(w, w * 0.58, k / 11);
          g.beginPath();
          g.moveTo(x - hw, y);
          g.lineTo(x + hw, y);
          g.stroke();
        }
        g.restore();

        /* one lit edge, fading out with the body. This single stroke is the
           difference between a structure and a black rectangle. */
        g.save();
        const eg = g.createLinearGradient(0, 0, 0, bot);
        eg.addColorStop(0, rim(P, 0.00));
        eg.addColorStop(0.30, rim(P, 0.34));
        eg.addColorStop(1, rim(P, 0));
        g.strokeStyle = eg;
        g.lineWidth = 1.4;
        g.beginPath();
        g.moveTo(x + side * w, -4);
        g.lineTo(x + side * w * 0.58, bot);
        g.stroke();
        g.restore();

        // and a light on it, small, steady, at no particular height
        g.save();
        g.globalCompositeOperation = 'lighter';
        const ly = bot * (0.42 + i * 0.16);
        const lg = g.createRadialGradient(x + side * w * 0.7, ly, 0,
                                          x + side * w * 0.7, ly, w * 2.4);
        lg.addColorStop(0, U.rgbToCss(P.glow, 0.20));
        lg.addColorStop(1, U.rgbToCss(P.glow, 0));
        g.fillStyle = lg;
        g.fillRect(x - w * 3, ly - w * 3, w * 6, w * 6);
        g.restore();
      });
  }

  function beneathFront(g, L, P, v) {
    /* everything falls upward */
    g.save();
    g.globalAlpha = 0.40;
    motes.forEach(function (m) {
      const y = L.horizonY + (1 - ((m.y + t * m.sp) % 1)) * (L.h - L.horizonY);
      const x = (m.x + Math.sin(t * 0.15 + m.p) * 0.008) * L.w;
      g.fillStyle = U.rgbToCss(P.glow, 0.26);
      g.fillRect(x, y, m.s * 0.7, m.s * 2.6);
    });
    g.restore();

    /* and a column of water standing on nothing, off to one side, which is
       the one thing in the zone that is unambiguously impossible */
    const d = v.depth || 0;
    g.save();
    g.globalAlpha = 0.10 + d * 0.14;
    const cx = L.w * 0.80;
    const cg = g.createLinearGradient(cx, L.horizonY, cx, L.h);
    cg.addColorStop(0, U.rgbToCss(P.glow, 0));
    cg.addColorStop(0.5, U.rgbToCss(P.glow, 0.5));
    cg.addColorStop(1, U.rgbToCss(P.glow, 0));
    g.fillStyle = cg;
    g.fillRect(cx - L.w * 0.028, L.horizonY, L.w * 0.056, L.h - L.horizonY);
    g.restore();
  }

  /* ============================================================= THE HEAVENS

     Cloud below, gates on the horizon. The enormous thing is a pair of
     uprights so far apart that the gap between them is most of the frame,
     and they go off the top. */
  function heavensBack(g, L, P) {
    const hy = L.horizonY, W = L.w, H = L.h;
    g.fillStyle = 'rgba(60,44,28,0.42)';
    [[0.20, 0.030], [0.80, 0.030]].forEach(function (a) {
      const x = W * a[0], w = W * a[1];
      g.beginPath();
      g.moveTo(x - w, hy + 2);
      g.lineTo(x - w * 0.72, -4);
      g.lineTo(x + w * 0.72, -4);
      g.lineTo(x + w, hy + 2);
      g.closePath();
      g.fill();
    });
    // a lintel, only just in frame
    g.fillRect(W * 0.16, -4, W * 0.68, H * 0.045);
  }

  function heavensFront(g, L, P, v) {
    g.save();
    g.globalAlpha = 0.22;
    for (let i = 0; i < 5; i++) {
      const y = L.horizonY + L.waterH * (0.24 + i * 0.15);
      const x = ((i * 0.23 + t * 0.004) % 1.3 - 0.15) * L.w;
      g.fillStyle = 'rgba(255,246,224,0.5)';
      g.beginPath();
      g.ellipse(x, y, L.w * 0.19, L.waterH * 0.030, 0, 0, TAU);
      g.fill();
    }
    g.restore();
  }

  /* ============================================ what is on the water now

     The zone's own interactive things. Nothing here has a label, an arrow or
     a ring around it — if the player has not noticed the bottle, the bottle
     drifts past and there will be another one. */
  function things(g, L, P, v) {
    const hy = L.horizonY, W = L.w, wh = L.waterH;

    if (v.bottle) {
      const x = W * v.bottle.x, y = hy + wh * v.bottle.y;
      g.save();
      g.translate(x, y + Math.sin(t * 1.7) * wh * 0.004);
      g.rotate(Math.sin(t * 0.8) * 0.28 - 0.35);
      g.fillStyle = 'rgba(150,190,170,0.8)';
      g.beginPath();
      g.ellipse(0, 0, W * 0.010, W * 0.0040, 0, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(224,234,242,0.65)';
      g.fillRect(W * 0.004, -W * 0.0014, W * 0.006, W * 0.0028);
      g.restore();
    }

    if (v.marks) {
      v.marks.forEach(function (m) {
        const f = VF.fish.byId(m.id);
        if (!f) return;
        const x = W * m.x, y = hy + wh * m.y;
        g.save();
        g.translate(x, y);
        g.globalAlpha = 0.20 + Math.min(0.24, m.rank * 0.045);
        try { VF.fishArt.drawSilhouette(g, f, W * 0.016, 0.9, 0.35); }
        catch (e) { /* never worth the frame */ }
        g.restore();
      });
    }

    /* The sweep that returns too many. They come up one at a time, left to
       right, hold for a moment and go. No label, no count, no journal entry —
       if the player is looking at the bag when it happens then it did not
       happen to them. */
    if (v.ghosts) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      v.ghosts.forEach(function (gh) {
        if (gh.t < 0 || gh.t > gh.life) return;
        const a = Math.min(1, gh.t * 3.2) * Math.min(1, (gh.life - gh.t) * 1.4);
        const x = W * gh.x, y = hy + wh * gh.y, r = W * 0.030;
        g.strokeStyle = U.rgbToCss(P.glow, 0.46 * a);
        g.lineWidth = 1.1;
        g.beginPath();
        g.ellipse(x, y, r, r * 0.28, 0, 0, TAU);
        g.stroke();
        g.fillStyle = U.rgbToCss(P.glow, 0.22 * a);
        g.beginPath();
        g.ellipse(x, y, r * 0.30, r * 0.30 * 0.28, 0, 0, TAU);
        g.fill();
      });
      g.restore();
    }

    if (v.contact) {
      const x = W * v.contact.x, y = hy + wh * v.contact.y;
      const r = W * (v.contact.big ? 0.070 : 0.038);
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const u = ((t * 0.42 + i / 2) % 1);
        g.strokeStyle = U.rgbToCss(P.glow, 0.30 * (1 - u));
        g.lineWidth = 1.2;
        g.beginPath();
        g.ellipse(x, y, r * (0.3 + u), r * (0.3 + u) * 0.28, 0, 0, TAU);
        g.stroke();
      }
      g.restore();
      if (v.contact.big) {
        g.save();
        g.globalAlpha = 0.30;
        g.fillStyle = '#000';
        g.beginPath();
        g.ellipse(x, y, r * 1.7, r * 0.32, 0, 0, TAU);
        g.fill();
        g.restore();
      }
    }

    if (v.shards) {
      v.shards.forEach(function (s) {
        const x = W * s.x, y = hy + wh * s.y;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.translate(x, y);
        g.rotate(t * 0.4 + s.x * 6);
        /* Three colours, and the one you pick up is the colour the water
           comes back. Nothing in the game says so. */
        const zc = VF.zoneData && VF.zoneData.get('abyss');
        const tn = zc && zc.tunes && zc.tunes[s.k | 0];
        const col = (tn && tn.colour) || U.mixRgb(P.glow, [255, 255, 255], 0.5);
        g.fillStyle = U.rgbToCss(col, 0.44 + 0.34 * Math.sin(t * 2 + s.x * 9));
        g.beginPath();
        g.moveTo(0, -W * 0.008);
        g.lineTo(W * 0.004, 0);
        g.lineTo(0, W * 0.008);
        g.lineTo(-W * 0.004, 0);
        g.closePath();
        g.fill();
        g.restore();
      });
    }
  }

  /* ================================================================ entry */

  /* The zones whose back layer is still a painted plate.

     A plate is one shape at one distance with nothing behind it and nothing
     in front of it, and it is what made eight of these places read as
     backdrops. As each zone gets a landmark graph in js/data/zones.js it
     comes off this list, because a graph and a plate are two horizons
     competing and the one that means something loses — the Quiet Shore
     proved that, and the Moonlit Basin proved it again with two rims in the
     same frame. */
  const BACK = {
    trench: trenchBack
  };
  const FRONT = {
    shore: shoreFront, basin: basinFront, flats: flatsFront, trench: trenchFront,
    abyss: abyssFront, cradle: cradleFront, nowhere: nowhereFront,
    beneath: beneathFront, the_heavens: heavensFront
  };

  /* The static half of a composition is baked once per zone per size. It is
     twelve landmarks made of forty path segments each and it does not change
     between frames; redrawing it sixty times a second was the one honest
     performance risk in the whole file. */
  function baked(id, L, P) {
    const fn = BACK[id];
    if (!fn) return null;
    const key = id + '|' + Math.round(L.w) + 'x' + Math.round(L.h) + '|' +
                Math.round(L.horizonY) + '|' + P.skyBot.map(Math.round).join(',');
    if (bake && bakeKey === key) return bake;
    bakeKey = key;
    if (!bake) bake = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    bake.width = Math.max(1, Math.round(L.w * dpr));
    bake.height = Math.max(1, Math.round(L.h * dpr));
    const g = bake.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, L.w, L.h);
    try { fn(g, L, P); } catch (e) { /* a bad landmark must not take the frame */ }
    /* js/gl/path.js re-uploads this to the GPU on this and only this — it has
       no way of seeing that a canvas was repainted underneath it. */
    bake.__glRev = key;
    return bake;
  }

  function drawBack(ctx, L, P) {
    if (!VF.zones) return;
    const id = VF.state.data.location;
    seed(id, L);
    /* The lighthouse turns and the ring's opening breathes, so those two draw
       live over the baked plate rather than into it — and the shore has no
       plate left at all, only the turning light. */
    if (BACK[id]) {
      const b = baked(id, L, P);
      if (b) ctx.drawImage(b, 0, 0, L.w, L.h);
    }
    if (id === 'shore') lighthouseBeam(ctx, L, P);
  }

  /* The light turns. It is a cone that sweeps across the frame once every
     nine seconds and faces you for about one of them — which is nine times
     more interesting than a lamp that is on. */
  /* The beam is live rather than baked — `t` inside a bake is whatever the
     clock said the one time the canvas was drawn, which is how an earlier
     version ended up with a permanent white sun in the corner of the sky.

     It hangs off wherever the lighthouse was actually placed. landmarkArt
     leaves its lamp position on the landmark as it draws it, so the light
     comes out of the tower instead of out of a coordinate that used to agree
     with where the tower was. */
  function lighthouseBeam(g, L, P) {
    const W = L.w;
    const w = VF.landmarks && VF.landmarks.world();
    let lamp = null;
    if (w) {
      for (let i = 0; i < w.meso.length; i++) {
        if (w.meso[i].art === 'lighthouse' && w.meso[i].lamp) { lamp = w.meso[i].lamp; break; }
      }
    }
    if (!lamp) return;
    const lx = lamp.x, ly = lamp.y;
    const a = (t * 0.70) % TAU;
    const face = Math.pow(Math.max(0, Math.sin(t * 0.70)), 6);

    /* The first version of this was a grey wedge across a third of the sky
       and a bloom the size of the moon, and it read as weather rather than
       as a light. A lighthouse beam seen from the water is thin, and mostly
       you see it in the air rather than as a shape: short, narrow, and only
       there at all for the second it is pointed near you. */
    const swing = Math.sin(a);
    const dir = -0.10 + swing * 0.30;
    const near = Math.pow(Math.max(0, Math.cos(a)), 3);   // pointing our way

    g.save();
    g.globalCompositeOperation = 'lighter';
    const len = W * (0.42 + near * 0.30);
    const spread = 0.022;
    const bg = g.createLinearGradient(lx, ly, lx + Math.cos(dir) * len, ly + Math.sin(dir) * len);
    bg.addColorStop(0, 'rgba(255,238,200,' + (0.030 + 0.055 * near).toFixed(3) + ')');
    bg.addColorStop(1, 'rgba(255,238,200,0)');
    g.fillStyle = bg;
    g.beginPath();
    g.moveTo(lx, ly);
    g.lineTo(lx + Math.cos(dir - spread) * len, ly + Math.sin(dir - spread) * len);
    g.lineTo(lx + Math.cos(dir + spread) * len, ly + Math.sin(dir + spread) * len);
    g.closePath();
    g.fill();
    // the lamp. Small enough that it is a lamp and not a second moon.
    const r = W * 0.014;
    const lg = g.createRadialGradient(lx, ly, 0, lx, ly, r);
    lg.addColorStop(0, 'rgba(255,242,212,' + (0.22 + 0.55 * face).toFixed(3) + ')');
    lg.addColorStop(1, 'rgba(255,242,212,0)');
    g.fillStyle = lg;
    g.fillRect(lx - r, ly - r, r * 2, r * 2);
    g.restore();
  }

  function drawFront(ctx, L, P) {
    if (!VF.zones) return;
    const v = VF.zones.view();
    if (!v || !v.id) return;
    seed(v.id, L);
    const fn = FRONT[v.id];
    if (fn) { try { fn(ctx, L, P, v); } catch (e) { /* ditto */ } }
    things(ctx, L, P, v);
  }

  VF.zoneArt = { drawBack: drawBack, drawFront: drawFront, tick: tick,
                 invalidate: function () { bakeKey = ''; seedKey = ''; } };
})(window.VF = window.VF || {});
