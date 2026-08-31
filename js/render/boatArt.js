/* VOID FISHING — drawing the boat.

   Two callers and one set of geometry. The scene draws it under the angler at
   about a fifth of the screen; the boatyard draws the same function at four
   times that with the camera off the bow. Nothing is a sprite, so the same
   code answers both and a new hull is five numbers rather than two pictures.

   A hull is described by:
     len     how long, against the beam
     sheer   how much the gunwale curves up toward the ends
     prow    how far the stem rakes forward past the waterline
     cabin   0 = open boat, >0 = a house on it that tall
     mast    0 = nothing standing, >0 = a spar that tall

   The silhouette is what has to survive being twenty pixels tall in the
   corner of a fishing view, so the differences are in the outline and never
   in the detail: the skiff is a shallow arc, the dory is long and high at
   both ends, the survey boat is a box with a house on it, the hunter has a
   gantry off the stern and the last one has no waterline at all. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = U.TAU;

  /* The gunwale, as a function of position along the boat. -1 is the stern
     and +1 is the stem; the value is how far above the waterline that point
     of the rail sits, in beam units. */
  function rail(g, u) {
    const s = g.sheer;
    const end = Math.pow(Math.abs(u), 2.2);
    /* The stem rises more sharply than the transom does, which is the single
       cheapest thing that makes a shape read as a boat pointing somewhere
       rather than as a symmetrical dish. */
    const fore = u > 0 ? 1 + g.prow * 0.85 * Math.pow(u, 1.6) : 1;
    return g.beam * (0.30 + s * end) * fore;
  }

  /* One boat, centred on its own waterline, `L` long from stem to stern. */
  function draw(ctx, spec, L, opts) {
    opts = opts || {};
    const t = opts.time || 0;
    /* `len` is the hull's own proportion and belongs here rather than at the
       call site: the scene and the boatyard both ask for "a boat about this
       big", and how long a Long Dory is compared to a skiff is the hull's
       business, not the caller's. */
    L = L * (spec.len || 1);
    const g = {
      beam: L * 0.30 * (spec.beam || 1),
      sheer: spec.sheer === undefined ? 0.3 : spec.sheer,
      prow: spec.prow || 0
    };
    const half = L * 0.5;
    /* The boat is in the scene, so it is lit by the scene. Without this it is
       a bright tan object sitting in a midnight blue frame with its own
       private sun, which is exactly what it looked like the first time. `lit`
       is the palette's brightness and `tint` is the water it is floating on. */
    const lg2 = opts.light;
    const wash = function (c) {
      if (!lg2) return c;
      let x = c.map(function (v) { return v * U.lerp(0.34, 1, lg2.bright === undefined ? 1 : lg2.bright); });
      if (lg2.tint) x = U.mixRgb(x, lg2.tint, lg2.k || 0);
      return x;
    };
    const hull = wash(U.hexToRgb(spec.hull || '#6a5a44'));
    const trim = wash(U.hexToRgb(spec.trim || '#3a3024'));
    const dark = U.shade(hull, -0.52);
    const lit = U.mixRgb(hull, [255, 255, 255], 0.18);

    ctx.save();

    /* --- the hull ------------------------------------------------------ */
    const N = 26;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + (i / N) * 2;
      const x = u * half;
      top.push([x, -rail(g, u)]);
      // the bottom is much flatter than the top, which is what makes a boat
      // read as a boat rather than as a leaf
      const dep = g.beam * 0.34 * (1 - Math.pow(Math.abs(u), 3.0));
      bot.push([x, dep]);
    }

    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    top.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
    for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
    ctx.closePath();
    const hg = ctx.createLinearGradient(0, -g.beam, 0, g.beam * 0.6);
    hg.addColorStop(0, U.rgbToCss(lit));
    hg.addColorStop(0.55, U.rgbToCss(hull));
    hg.addColorStop(1, U.rgbToCss(dark));
    ctx.fillStyle = hg;
    ctx.fill();

    /* the strake: one line along the side, which is most of what says
       "planked" at any size where planks would not survive */
    ctx.strokeStyle = U.rgbToCss(U.shade(hull, -0.34), 0.8);
    ctx.lineWidth = Math.max(0.5, L * 0.006);
    ctx.beginPath();
    top.forEach(function (p, i) {
      const y = U.lerp(p[1], bot[i][1], 0.42);
      i ? ctx.lineTo(p[0], y) : ctx.moveTo(p[0], y);
    });
    ctx.stroke();

    /* the rubbing strake along the rail, in the trim colour — the one part of
       the paint scheme that reads at twenty pixels */
    ctx.strokeStyle = U.rgbToCss(trim);
    ctx.lineWidth = Math.max(0.8, L * 0.014);
    ctx.beginPath();
    top.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); });
    ctx.stroke();

    /* --- the inside, which is what you sit in -------------------------- */
    ctx.fillStyle = U.rgbToCss(U.shade(hull, -0.68));
    ctx.beginPath();
    ctx.moveTo(top[1][0], top[1][1] + L * 0.010);
    for (let i = 1; i < N; i++) ctx.lineTo(top[i][0], top[i][1] + L * 0.010);
    for (let i = N - 1; i >= 1; i--) ctx.lineTo(top[i][0], top[i][1] + L * 0.030);
    ctx.closePath();
    ctx.fill();

    // thwarts
    ctx.strokeStyle = U.rgbToCss(U.mixRgb(hull, [255, 255, 255], 0.10));
    ctx.lineWidth = Math.max(0.6, L * 0.011);
    for (const u of [-0.36, 0.10]) {
      const y = -rail(g, u) + L * 0.016;
      ctx.beginPath();
      ctx.moveTo(u * half - L * 0.05, y);
      ctx.lineTo(u * half + L * 0.05, y);
      ctx.stroke();
    }

    /* --- a house, if it has one ---------------------------------------- */
    if (spec.cabin > 0) {
      const cw = L * 0.26, ch = g.beam * spec.cabin * 1.5;
      const cx = -L * 0.06, cy = -rail(g, -0.06);
      ctx.fillStyle = U.rgbToCss(U.shade(hull, 0.06));
      ctx.beginPath();
      ctx.moveTo(cx - cw * 0.5, cy);
      ctx.lineTo(cx - cw * 0.42, cy - ch);
      ctx.lineTo(cx + cw * 0.46, cy - ch);
      ctx.lineTo(cx + cw * 0.5, cy);
      ctx.closePath();
      ctx.fill();
      // roof
      ctx.fillStyle = U.rgbToCss(trim);
      ctx.fillRect(cx - cw * 0.50, cy - ch - L * 0.012, cw, L * 0.016);
      // windows, lit
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(255,226,168,0.55)';
        ctx.fillRect(cx - cw * 0.30 + i * cw * 0.24, cy - ch * 0.72, cw * 0.14, ch * 0.30);
      }
      ctx.restore();
    }

    /* --- a spar, if it has one ----------------------------------------- */
    if (spec.mast > 0) {
      const mx = L * 0.06;
      const my = -rail(g, 0.06);
      const mh = L * 0.52 * spec.mast;
      ctx.strokeStyle = U.rgbToCss(U.shade(hull, -0.20));
      ctx.lineWidth = Math.max(0.8, L * 0.012);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.sin(t * 0.6) * L * 0.008, my - mh);
      ctx.stroke();
    }

    /* --- what is fitted to her ----------------------------------------- */
    if (opts.modules) drawModules(ctx, opts.modules, L, g, hull, trim, t);

    /* --- and what has happened to her ---------------------------------- */
    if (opts.wear > 0.02) drawWear(ctx, opts.wear, L, g, top, bot, hull, trim);

    /* --- fitted trim --------------------------------------------------- */
    if (opts.trim) drawTrim(ctx, opts.trim, L, g, spec, t);

    /* --- what is on deck ----------------------------------------------- */
    if (opts.trophies && opts.trophies.length) {
      opts.trophies.forEach(function (id, i) {
        const f = VF.fish.byId(id);
        if (!f) return;
        const x = -L * (0.30 - i * 0.15);
        const y = -rail(g, x / half) - L * 0.030;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-1.35);
        ctx.globalAlpha = 0.95;
        try { VF.fishArt.draw(ctx, f, L * 0.045, { time: t, detail: false }); }
        catch (e) { /* a trophy must never take the frame down */ }
        ctx.restore();
      });
    }

    /* --- and whatever the last hull is made of ------------------------- */
    if (spec.glow || (opts.paint && opts.paint.glow)) {
      const gl = U.hexToRgb(spec.glow || opts.paint.glow);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rg = ctx.createLinearGradient(0, -g.beam, 0, g.beam);
      rg.addColorStop(0, U.rgbToCss(gl, 0.16));
      rg.addColorStop(1, U.rgbToCss(gl, 0));
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      top.forEach(function (p) { ctx.lineTo(p[0], p[1]); });
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  /* WHAT IS BOLTED TO HER.

     Until the harbour existed, the only way to know what a boat was carrying
     was to open a panel and read a list — and the winch and gantry this file
     already drew are TRIM, a cosmetic you buy for the look of it, not the
     survey module you paid twenty-six thousand for. So a fitted boat and a
     bare one were the same picture.

     Each of these is small and unmistakable at the size a boat is actually
     drawn: a dome, a davit, a hatch, a rack. Nothing is labelled. If you have
     never bought sonar you will not know what the dome is, and the first time
     you buy it you will notice it appear. */
  function drawModules(ctx, m, L, g, hull, trim, t) {
    if (!m) return;
    const lit = U.mixRgb(hull, [255, 255, 255], 0.24);
    const rail0 = -rail(g, 0);

    /* Sonar: a dome, and it sweeps. Aft of the house rather than amidships,
       because amidships is exactly where the house is on every hull that has
       one and the most load-bearing purchase in the game was invisible. */
    if (m.sonar > 0) {
      const x = L * 0.19, y = rail0 - L * 0.012;
      ctx.fillStyle = U.rgbToCss(U.shade(trim, 0.20));
      ctx.beginPath();
      ctx.ellipse(x, y, L * 0.030, L * 0.024, 0, Math.PI, 0);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = 0.18 + 0.16 * Math.max(0, Math.sin(t * 1.1));
      ctx.fillStyle = 'rgba(120,220,255,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(x, y - L * 0.006, L * 0.016, L * 0.012, 0, Math.PI, 0);
      ctx.fill();
      ctx.restore();
    }

    /* survey: a davit over the side with a line down from it */
    if (m.survey > 0) {
      const x = L * 0.26, y = -rail(g, 0.52);
      ctx.strokeStyle = U.rgbToCss(U.shade(trim, -0.10));
      ctx.lineWidth = Math.max(0.8, L * 0.012);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + L * 0.02, y - L * 0.10, x + L * 0.10, y - L * 0.085);
      ctx.stroke();
      ctx.strokeStyle = U.rgbToCss(U.shade(hull, -0.4), 0.85);
      ctx.lineWidth = Math.max(0.5, L * 0.005);
      ctx.beginPath();
      ctx.moveTo(x + L * 0.10, y - L * 0.082);
      ctx.lineTo(x + L * 0.10 + Math.sin(t * 0.8) * L * 0.004, y + L * 0.010);
      ctx.stroke();
    }

    /* hold: a hatch in the deck, raised, with a coaming round it */
    if (m.hold > 0) {
      const x = -L * 0.24, y = -rail(g, -0.48) + L * 0.004;
      ctx.fillStyle = U.rgbToCss(U.shade(hull, -0.30));
      ctx.fillRect(x - L * 0.045, y - L * 0.020, L * 0.090, L * 0.022);
      ctx.strokeStyle = U.rgbToCss(lit, 0.7);
      ctx.lineWidth = Math.max(0.5, L * 0.005);
      ctx.strokeRect(x - L * 0.045, y - L * 0.020, L * 0.090, L * 0.022);
    }

    /* tackle: a rack of rods along the far rail */
    if (m.tackle > 0) {
      const n = Math.min(4, m.tackle + 1);
      ctx.strokeStyle = U.rgbToCss(U.shade(trim, 0.30), 0.9);
      ctx.lineWidth = Math.max(0.5, L * 0.005);
      for (let i = 0; i < n; i++) {
        const u = -0.14 + i * 0.09;
        const y = -rail(g, u);
        ctx.beginPath();
        ctx.moveTo(u * (L * 0.5) - L * 0.020, y - L * 0.004);
        ctx.lineTo(u * (L * 0.5) + L * 0.055, y - L * 0.052);
        ctx.stroke();
      }
    }

    /* engine: a stack aft, and it is smoking if it is a big one */
    if (m.engine > 0) {
      const x = L * 0.34, y = -rail(g, 0.68);
      ctx.fillStyle = U.rgbToCss(U.shade(trim, -0.05));
      ctx.fillRect(x - L * 0.011, y - L * 0.055, L * 0.022, L * 0.058);
      ctx.fillStyle = U.rgbToCss(U.shade(trim, 0.25));
      ctx.fillRect(x - L * 0.014, y - L * 0.062, L * 0.028, L * 0.010);
    }
  }

  /* WHAT HAS HAPPENED TO HER.

     The game has always tracked hull integrity and has always spent it: a
     worn hull fights worse, bites worse and sails slower. It has never once
     LOOKED worn. Everything below reads at a glance and none of it is a
     number: a stain along the waterline, plates riveted over the damage, and
     at the bad end a rail that no longer runs fair.

     `w` is 0 to 1 of wear, so a boat you have not hurt draws exactly as it
     always did and nothing here costs anything until it has to. */
  function drawWear(ctx, w, L, g, top, bot, hull, trim) {
    const N = top.length - 1;
    ctx.save();
    /* the boot-top: growth and oil along the waterline, first and always */
    ctx.strokeStyle = U.rgbToCss(U.shade(hull, -0.62), 0.30 + w * 0.45);
    ctx.lineWidth = Math.max(1, L * 0.016 * (0.5 + w));
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const y = U.lerp(top[i][1], bot[i][1], 0.72);
      i ? ctx.lineTo(top[i][0], y) : ctx.moveTo(top[i][0], y);
    }
    ctx.stroke();

    /* plates. One at a third of the way gone, four when she is finished, and
       they are riveted rectangles because that is what he actually does —
       "i can plate it. i can plate it as many times as you like." */
    const plates = Math.floor(w * 5);
    for (let i = 0; i < plates; i++) {
      const u = -0.62 + ((i * 0.37) % 1.24);
      const idx = Math.round((u + 1) / 2 * N);
      const px = top[idx][0];
      const py = U.lerp(top[idx][1], bot[idx][1], 0.34 + (i % 3) * 0.14);
      const pw = L * (0.045 + (i % 2) * 0.020), ph = L * 0.030;
      ctx.fillStyle = U.rgbToCss(U.shade(hull, -0.30 - (i % 3) * 0.08), 0.95);
      ctx.fillRect(px - pw / 2, py - ph / 2, pw, ph);
      ctx.strokeStyle = U.rgbToCss(U.mixRgb(hull, [255, 255, 255], 0.18), 0.5);
      ctx.lineWidth = Math.max(0.4, L * 0.003);
      ctx.strokeRect(px - pw / 2, py - ph / 2, pw, ph);
      for (let r = 0; r < 4; r++) {
        ctx.fillStyle = U.rgbToCss(U.shade(hull, 0.25), 0.6);
        ctx.beginPath();
        ctx.arc(px - pw / 2 + pw * (r % 2 ? 0.85 : 0.15),
                py - ph / 2 + ph * (r < 2 ? 0.2 : 0.8),
                Math.max(0.5, L * 0.0035), 0, U.TAU);
        ctx.fill();
      }
    }

    /* and past two thirds, the rail itself has stopped running fair */
    if (w > 0.62) {
      const k = (w - 0.62) / 0.38;
      ctx.strokeStyle = U.rgbToCss(U.shade(trim, -0.45), 0.9);
      ctx.lineWidth = Math.max(0.8, L * 0.014);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const dent = Math.sin(i * 2.3) * Math.sin(i * 0.7) * L * 0.012 * k;
        i ? ctx.lineTo(top[i][0], top[i][1] + dent) : ctx.moveTo(top[i][0], top[i][1] + dent);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrim(ctx, fitted, L, g, spec, t) {
    const swing = Math.sin(t * 0.9) * 0.10;

    if (fitted.light) {
      const d = VF.boatData.trimOf(fitted.light);
      const col = U.hexToRgb((d && d.glow) || '#ffd8a0');
      if (fitted.light === 'lanterns' && spec.mast > 0) {
        for (let i = 0; i < 6; i++) {
          const u = -0.34 + i * 0.15;
          const x = u * L * 0.5;
          const y = -rail(g, u) - L * 0.07 * Math.sin((i / 5) * Math.PI) - L * 0.02;
          lamp(ctx, x, y + Math.sin(t * 1.4 + i) * L * 0.004, L * 0.014, col);
        }
      } else if (fitted.light === 'floodlight') {
        const x = -L * 0.30, y = -rail(g, -0.6) - L * 0.05;
        lamp(ctx, x, y, L * 0.026, col);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const bg = ctx.createLinearGradient(x, y, x - L * 0.36, y + L * 0.22);
        bg.addColorStop(0, U.rgbToCss(col, 0.24));
        bg.addColorStop(1, U.rgbToCss(col, 0));
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - L * 0.44, y + L * 0.12);
        ctx.lineTo(x - L * 0.40, y + L * 0.30);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        const x = -L * 0.44, y = -rail(g, -0.88) - L * 0.05;
        ctx.strokeStyle = U.rgbToCss(U.hexToRgb(spec.trim || '#3a3024'));
        ctx.lineWidth = Math.max(0.6, L * 0.008);
        ctx.beginPath();
        ctx.moveTo(x, y + L * 0.05);
        ctx.lineTo(x + Math.sin(swing) * L * 0.02, y);
        ctx.stroke();
        lamp(ctx, x + Math.sin(swing) * L * 0.02, y, L * 0.020, col);
      }
    }

    if (fitted.flag && spec.mast > 0) {
      const d = VF.boatData.trimOf(fitted.flag);
      const mx = L * 0.06, my = -rail(g, 0.06) - L * 0.52 * spec.mast;
      const w = L * 0.11, h = L * 0.055;
      ctx.save();
      ctx.translate(mx, my + L * 0.012);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(w * 0.5, Math.sin(t * 2.2) * h * 0.30, w, Math.sin(t * 2.2 + 1) * h * 0.2);
      ctx.lineTo(w, h);
      ctx.quadraticCurveTo(w * 0.5, h + Math.sin(t * 2.2 + 0.5) * h * 0.3, 0, h);
      ctx.closePath();
      if (fitted.flag === 'flagvoid') {
        /* An absence rather than a colour: it takes the frame out instead of
           putting anything into it. */
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = U.rgbToCss(U.hexToRgb(d.glow || '#9f7fff'), 0.55);
        ctx.lineWidth = Math.max(0.5, L * 0.005);
        ctx.stroke();
      } else {
        ctx.fillStyle = fitted.flag === 'flagdeep' ? '#2e6a86' : '#d8d2c4';
        ctx.fill();
      }
      ctx.restore();
    }

    if (fitted.deck) {
      if (fitted.deck === 'crate') {
        for (let i = 0; i < 2; i++) {
          const x = L * (0.20 + i * 0.10), y = -rail(g, x / (L * 0.5));
          ctx.fillStyle = U.rgbToCss(U.shade(U.hexToRgb(spec.hull || '#6a5a44'), 0.14));
          ctx.fillRect(x - L * 0.035, y - L * 0.055, L * 0.07, L * 0.055);
          ctx.strokeStyle = U.rgbToCss(U.hexToRgb(spec.trim || '#3a3024'), 0.7);
          ctx.lineWidth = Math.max(0.4, L * 0.004);
          ctx.strokeRect(x - L * 0.035, y - L * 0.055, L * 0.07, L * 0.055);
        }
      } else if (fitted.deck === 'winch' || fitted.deck === 'gantry') {
        const x = -L * 0.34, y = -rail(g, -0.68);
        ctx.strokeStyle = U.rgbToCss(U.shade(U.hexToRgb(spec.trim || '#3a3024'), 0.3));
        ctx.lineWidth = Math.max(0.8, L * 0.012);
        if (fitted.deck === 'gantry') {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - L * 0.20);
          ctx.lineTo(x - L * 0.16, y - L * 0.20);
          ctx.stroke();
          ctx.lineWidth = Math.max(0.4, L * 0.004);
          ctx.beginPath();
          ctx.moveTo(x - L * 0.16, y - L * 0.20);
          ctx.lineTo(x - L * 0.16, y - L * 0.04);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y - L * 0.035, L * 0.030, 0, TAU);
          ctx.stroke();
        }
      }
    }
  }

  function lamp(ctx, x, y, r, col) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
    g.addColorStop(0, U.rgbToCss(col, 0.55));
    g.addColorStop(0.4, U.rgbToCss(col, 0.16));
    g.addColorStop(1, U.rgbToCss(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.restore();
    ctx.fillStyle = U.rgbToCss(U.mixRgb(col, [255, 255, 255], 0.6));
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  /* The player's own boat, as it currently is. Everything that draws the
     boat asks for this rather than assembling the spec itself. */
  function spec() {
    const b = VF.boat.shape();
    const h = VF.boat.hull();
    const p = VF.boat.paint();
    return {
      len: h.len, beam: h.beam, sheer: h.sheer, prow: h.prow,
      cabin: h.cabin, mast: h.mast,
      hull: p.hull, trim: p.trim, glow: h.glow || p.glow || null
    };
  }

  /* The player's own boat, wherever it is drawn — on the water, in the
     harbour, on the hard in the yard. Wear and fitted modules come from the
     save by default rather than from the call site, so every place that draws
     her draws the boat you actually own in the state you actually left her.
     A caller can still override, which is what the shop preview does. */
  function drawMine(ctx, L, opts) {
    const b = VF.boat.shape();
    draw(ctx, spec(), L, Object.assign({
      trim: b.trim, trophies: b.trophies, paint: VF.boat.paint(),
      wear: b.wear || 0, modules: b.modules
    }, opts || {}));
  }

  /* A flat outline, for js/render/fishArt.js's `object: 'boat'` — the Other
     Boat out on the Nowhere Sea is drawn by whatever draws boats. */
  function silhouette(ctx, L, H, P) {
    ctx.save();
    ctx.translate(0, H * 0.28);
    draw(ctx, { beam: 1, sheer: 0.34, prow: 0.5, cabin: 0, mast: 0.6,
                hull: rgbHex(P.a), trim: rgbHex(P.b) }, L * 1.5, { time: 0 });
    ctx.restore();
  }
  function rgbHex(c) { return typeof c === 'string' ? c : '#6a5a44'; }

  VF.boatArt = { draw: draw, drawMine: drawMine, spec: spec, silhouette: silhouette };
})(window.VF = window.VF || {});
