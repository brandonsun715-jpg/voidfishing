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
  let glCanvas = null;          // the medium, kept so the shutter can reach it
  let glOn = false;
  let W = 0, H = 0, DPR = 1;
  let t = 0;

  const L = {
    w: 0, h: 0, horizonY: 0, waterH: 0,
    merchant: null,        // the wanderer's screen rectangle while he is here
    rodTip: { x: 0, y: 0 }, rodHand: { x: 0, y: 0 },
    bobber: { x: 0, y: 0, scale: 1, visible: false, bob: 0 },
    castTarget: { x: 0, y: 0 },
    landPoint: { x: 0, y: 0 },
    glowX: 0, glowY: 0,
    figureH: 0, seatX: 0, seatY: 0
  };

  /* ---------------------------------------------------------------- stars */
  let stars = null;
  /* The field is baked: magnitudes on a power law, colour temperature, and the
     galaxy lying across it. Only the two dozen brightest come back to be
     animated, because a blit cannot twinkle and a sky where nothing moves is a
     photograph. */
  function buildStars() {
    const q = VF.state.data.settings.quality;
    const loc = VF.locations.current();
    /* DPR is in the key because the field is baked at device resolution now —
       a field baked for one ratio and blitted at another is exactly the soft,
       doubled-up star it was built to stop being. */
    const key = loc.id + ':' + Math.round(W) + 'x' + Math.round(L.horizonY) + ':' + q + ':' + DPR;
    if (starKey === key && starField) return;
    starKey = key;
    const built = VF.skyArt.buildField(W, Math.max(8, L.horizonY),
                                       0xBEEF ^ VF.locations.index(loc.id) * 7919,
                                       q, U.hexToRgb(loc.starTint), DPR);
    starField = built.canvas;
    starField.__glRev = key;      // js/gl/path.js re-uploads on this and only this
    stars = built.bright;
  }

  /* --------------------------------------------------------------- clouds

     Two layers at different scales drifting at different speeds. Baked at a
     third resolution because a cloud has no edge worth resolving, and scrolled
     by drawing each twice side by side so the wrap is seamless. */
  function buildClouds() {
    const q = VF.state.data.settings.quality;
    if (q === 'low') { clouds = null; return; }
    const loc = VF.locations.current();
    const wx = VF.weather.id();
    const key = loc.id + ':' + wx + ':' + Math.round(W) + 'x' + Math.round(L.horizonY) + ':' + q;
    if (cloudKey === key && clouds) return;
    cloudKey = key;

    const P = VF.palette.P;
    const bandH = Math.max(24, L.horizonY);
    const seedBase = 0xC10D ^ VF.locations.index(loc.id) * 6151;
    // how much sky the weather is covering
    // clear weather means a few streaks, not an overcast lid
    const cover = U.clamp(0.10 + VF.weather.fog() * 0.30 + VF.weather.rain() * 0.34, 0.06, 0.70);

    clouds = [];
    const layers = q === 'high' ? 2 : 1;
    for (let i = 0; i < layers; i++) {
      const layer = VF.skyArt.buildCloudLayer(W, bandH, {
        downscale: q === 'high' ? 3 : 4,
        scale: i === 0 ? 2.4 : 4.6,
        seed: seedBase + i * 977,
        cover: cover * (i === 0 ? 1 : 0.78),
        soft: i === 0 ? 0.34 : 0.26,
        lit: U.mixRgb(U.hexToRgb(loc.glow), [255, 255, 255], 0.20),
        dark: U.mixRgb(U.hexToRgb(loc.fog), [0, 0, 0], 0.62),
        lightX: L.glowX / Math.max(1, W),
        lightY: L.glowY / Math.max(1, bandH)
      });
      layer.__glRev = key + ':' + i;
      clouds.push({
        canvas: layer,
        // the high layer is further away, so it moves slower
        speed: i === 0 ? 0.0042 : 0.0092,
        alpha: i === 0 ? 0.13 : 0.085,
        h: bandH
      });
    }
  }

  function drawClouds(P) {
    if (!clouds || !clouds.length) return;
    // they are the first thing the void takes away
    const k = U.clamp((0.85 - P.void) / 0.40, 0, 1);
    if (k <= 0.01) return;
    ctx.save();
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const off = ((t * c.speed) % 1) * W;
      // and they are lit by the sky, so at night there is very little of them
      ctx.globalAlpha = c.alpha * k * (0.18 + P.bright * 0.95);
      // twice, side by side, so the drift never shows a seam
      ctx.drawImage(c.canvas, -off, 0, W, c.h);
      ctx.drawImage(c.canvas, W - off, 0, W, c.h);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------- grain
     One 128px noise tile handed to the CSS layer. Static after boot. */
  function buildGrain() {
    const N = 128;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    const px = img.data;
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.random() * 255;
      px[i] = px[i + 1] = px[i + 2] = 255;
      px[i + 3] = v < 128 ? 0 : Math.round((v - 128) * 1.9);
    }
    g.putImageData(img, 0, 0);
    const el = document.getElementById('grain');
    if (!el) return;
    try { el.style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')'; }
    catch (e) { el.style.display = 'none'; }
  }

  /* ------------------------------------------------------- backdrop cache */
  let backdrop = null, backdropKey = '';
  let landPad = null, landOne = null, landKey = '';   // the tinted land, baked
  let starField = null, starKey = '';                 // the baked field
  let clouds = null, cloudKey = '';                   // the drifting layers

  /* The land was three layers of flat black at different opacities, which is
     why it read as cardboard: distance does not make a hill more transparent,
     it puts more air in front of it, and air has a colour. Each layer is baked
     on its own now and tinted at draw time toward whatever the fog is doing,
     so the far ridge sits back in the haze and the near one stands in front of
     it. The bake is still cached — only the tint is per frame. */
  function buildBackdrop() {
    const loc = VF.locations.current();
    const key = loc.id + ':' + Math.round(W) + 'x' + Math.round(H) + ':' + VF.state.data.settings.quality;
    if (backdropKey === key && backdrop) return;
    backdropKey = key;
    landKey = '';        // the tint is baked against the old ridges

    const hy = L.horizonY;
    backdrop = [];
    for (let l = 0; l < 5; l++) {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H));
      const g = c.getContext('2d');
      // the same seed for every layer, so the ridges stay the ridges
      const rnd = VF.rng.make(0xC0FFEE ^ VF.locations.index(loc.id) * 104729);
      drawSilhouette(g, loc.silhouette, rnd, hy, l);
      backdrop.push(c);
    }
  }

  /* Paint the three baked ridges, each mixed toward the haze by how far away
     it is.

     This has to be CACHED, not composited per frame. Tinting three full-screen
     layers with a source-atop fill and drawing them costs about 24ms — the
     whole frame budget and half again — which is the exact trap the renderer
     is otherwise built to avoid: full-screen translucent fills dominate 2D
     canvas cost, so anything that covers the screen gets baked once and
     blitted after.

     The tint only depends on the haze colours, and those move slowly, so the
     key is those colours quantised hard. In practice it rebakes a handful of
     times over a day/night cycle and blits on every other frame. */
  function drawLand(P) {
    if (!backdrop || !backdrop.length) return;
    const q = function (c) { return (c[0] >> 3) + ',' + (c[1] >> 3) + ',' + (c[2] >> 3); };
    const key = backdropKey + '|' + q(P.fog) + '|' + q(P.skyBot) + '|' + (P.fogAmt * 12 | 0) +
                '|' + (P.bright * 10 | 0) + '|' + (q(P.glow));
    if (key !== landKey || !landPad) {
      landKey = key;
      bakeLand(P);
      landPad.__glRev = key;
    }
    if (landPad) ctx.drawImage(landPad, 0, 0);
  }

  function bakeLand(P) {
    if (!landPad) landPad = document.createElement('canvas');
    if (landPad.width !== Math.round(W) || landPad.height !== Math.round(H)) {
      landPad.width = Math.max(1, Math.round(W)); landPad.height = Math.max(1, Math.round(H));
    }
    const pg = landPad.getContext('2d');
    const hy = L.horizonY;
    pg.clearRect(0, 0, landPad.width, landPad.height);

    if (!landOne) landOne = document.createElement('canvas');
    if (landOne.width !== landPad.width || landOne.height !== landPad.height) {
      landOne.width = landPad.width; landOne.height = landPad.height;
    }
    const og = landOne.getContext('2d');

    for (let l = 0; l < backdrop.length; l++) {
      // layer 0 is furthest: most air in front of it, and the least of it
      const far = 1 - l / Math.max(1, backdrop.length - 1);
      og.globalCompositeOperation = 'source-over';
      og.clearRect(0, 0, landOne.width, landOne.height);
      og.drawImage(backdrop[l], 0, 0);

      /* What is baked is the FORM in greys — where the light falls on the
         range — so the colour arrives in two passes here rather than being
         painted over the top of it.

         MULTIPLY puts the rock and the snow in: grey times a colour is that
         colour at that luminance, so the lit faces come out bright and the
         shadowed ones stay dark instead of the whole shape becoming one flat
         fill, which is what a source-atop pass would have done to it.

         Then SOURCE-ATOP lifts it toward the haze, which is the half of
         aerial perspective that a multiply cannot do: distance does not only
         dim a thing, it washes it out toward the colour of the air. */
      /* Near ranges are dark and far ones are pale — that is the whole of
         aerial perspective, and getting it the wrong way round turns a
         mountain into a fog bank. `far` runs 1 at the back to 0 at the front,
         so the rock darkens hard as it comes toward you. */
      const rock = U.shade(U.mixRgb(P.fog, [255, 255, 255], 0.26 + P.bright * 0.22),
                           -0.62 * (1 - far));
      og.globalCompositeOperation = 'multiply';
      const mg = og.createLinearGradient(0, hy - H * 0.16, 0, hy + 2);
      mg.addColorStop(0, U.rgbToCss(U.mixRgb(rock, [255, 255, 255], 0.14)));
      mg.addColorStop(1, U.rgbToCss(U.shade(rock, -0.42)));
      og.fillStyle = mg;
      og.fillRect(0, 0, landOne.width, landOne.height);

      /* A blend mode is not a mask. Canvas composites `multiply` as
         source-over wherever the destination is empty, so filling the whole
         canvas painted the colour across the entire sky as well as into the
         range — which is exactly what it did, turning a night into an
         overcast afternoon. Clip it back to the shape it was meant to tint. */
      og.globalCompositeOperation = 'destination-in';
      og.drawImage(backdrop[l], 0, 0);

      og.globalCompositeOperation = 'source-atop';
      const air = U.mixRgb(P.skyBot, P.fog, 0.42);
      const hazeK = far * (0.46 + P.fogAmt * 0.34);
      const ag = og.createLinearGradient(0, hy - H * 0.13, 0, hy + 2);
      ag.addColorStop(0, U.rgbToCss(air, hazeK * 0.80));
      ag.addColorStop(1, U.rgbToCss(air, hazeK));
      og.fillStyle = ag;
      og.fillRect(0, 0, landOne.width, landOne.height);
      og.globalCompositeOperation = 'source-over';

      pg.globalAlpha = U.lerp(0.86, 1, 1 - far);
      pg.drawImage(landOne, 0, 0);
      pg.globalAlpha = 1;
    }

    /* The haze band itself: the air at the waterline is thicker than the air
       above it, so the horizon is a soft seam rather than a cut edge. This is
       what actually sells the distance, and it bakes in with the rest. */
    /* The haze has to fade out at BOTH ends. Ramping up to full alpha and then
       stopping at the rectangle's edge draws a pale bar across the horizon
       with a hard bottom to it — which is worse than the clean seam it was
       meant to soften. */
    const top = hy - H * 0.085, bot = hy + H * 0.055;
    const band = pg.createLinearGradient(0, top, 0, bot);
    const hz = U.mixRgb(P.fog, P.glow, 0.20);
    const peak = (0.055 + P.fogAmt * 0.11) * (0.28 + P.bright * 0.72);
    band.addColorStop(0, U.rgbToCss(hz, 0));
    band.addColorStop(0.55, U.rgbToCss(hz, peak * 0.72));
    band.addColorStop(0.66, U.rgbToCss(hz, peak));
    band.addColorStop(0.80, U.rgbToCss(hz, peak * 0.45));
    band.addColorStop(1, U.rgbToCss(hz, 0));
    pg.fillStyle = band;
    pg.fillRect(0, top, W, bot - top);
  }

  /* Distant land: layered dark shapes sitting on the horizon line. */
  /* Distant land.

     It used to be a run of rounded bumps or a row of triangles — a shape with
     an outline and nothing inside it, which is why layering it still read as
     cardboard. A mountain is not an outline. It is a ridgeline with faces
     either side of it, and the faces are what you actually see: one turned
     toward the light and one away, snow above the line where snow stays, and
     rock showing wherever the slope is too steep to hold any.

     The ridgeline is ridged fractal noise — fBm with each octave folded around
     its midpoint, which is the fold that turns soft hills into crests. The
     part that took a rebuild: the shading cannot key on the slope between one
     column and the next. Noise that looks perfectly smooth still changes
     direction about thirty times across a screen, and shading off that gives
     you a barcode rather than a mountain. So the heights are built into an
     array first, smoothed, and the slope is measured across a window wide
     enough to mean "which face is this" rather than "which way is this one
     pixel going". */

  /* One range's heights, in pixels above the horizon. */
  function ridgeline(style, W2, step, seed, freq, phase, maxH) {
    const n = Math.ceil(W2 / step) + 3;
    const h = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = (i * step - step) / Math.max(1, W2);
      let v;
      if (style === 'spires' || style === 'crystals') {
        // sharper and taller at the peaks: these are not hills
        v = Math.pow(VF.skyArt.fbm(u * freq * 1.7 + phase, 0.37, seed, 4, 1.92, 0.42, true), 0.62);
      } else if (style === 'trees') {
        v = VF.skyArt.fbm(u * freq * 2.2 + phase, 0.61, seed, 3, 1.9, 0.5, false) * 0.6 + 0.22;
      } else if (style === 'bones' || style === 'ruins') {
        v = VF.skyArt.fbm(u * freq * 1.4 + phase, 0.5, seed, 4, 2.0, 0.44, true);
        // broken: stretches of the range are simply missing
        if (VF.skyArt.noise2(u * 5 + phase, 3.3, seed) < 0.30) v *= 0.20;
      } else {
        v = VF.skyArt.fbm(u * freq + phase, 0.5, seed, 4, 1.95, 0.45, true);
      }
      h[i] = v;   // raw for now; the range is normalised once it is all known
    }

    /* Ridged fBm comes out bunched around the middle — measured, about 0.46 to
       0.76 for the open styles — so used raw it gives gentle dunes rather than
       a range. It has to be stretched to fill the height.

       Stretching against FIXED bounds was the first attempt and it clipped:
       every peak that ran past the top came out as a flat-topped mesa, which
       is what the crystals at the abyss turned into. Normalising against what
       this particular range actually produced cannot clip, and works for
       whichever style asked. */
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { if (h[i] < lo) lo = h[i]; if (h[i] > hi) hi = h[i]; }
    const span = Math.max(1e-4, hi - lo);
    for (let i = 0; i < n; i++) {
      // a curve on the normalised value: most of a range is low, peaks are rare
      h[i] = Math.pow((h[i] - lo) / span, 1.30) * maxH;
    }
    /* Two passes of a small blur. The high octaves are what give a range its
       texture, and they are also what makes the slope meaningless; blurring
       the line keeps the shape and loses the jitter. */
    for (let pass = 0; pass < 2; pass++) {
      const c = h.slice();
      for (let i = 1; i < n - 1; i++) h[i] = c[i - 1] * 0.26 + c[i] * 0.48 + c[i + 1] * 0.26;
    }
    return h;
  }

  /* The same line, blurred much harder. Shading has to be read off THIS, not
     off the ridge: the ridge carries the texture that makes a range look like
     rock, and that texture is exactly what makes a slope measured on it
     meaningless. Two separate lines — one to draw, one to light by. */
  function shadingLine(h) {
    const n = h.length;
    let a = Float32Array.from(h);
    let b = new Float32Array(n);
    for (let pass = 0; pass < 8; pass++) {
      for (let i = 0; i < n; i++) {
        const p0 = a[Math.max(0, i - 2)], p1 = a[Math.max(0, i - 1)];
        const p2 = a[i];
        const p3 = a[Math.min(n - 1, i + 1)], p4 = a[Math.min(n - 1, i + 2)];
        b[i] = (p0 + p1 * 2 + p2 * 3 + p3 * 2 + p4) / 9;
      }
      const t2 = a; a = b; b = t2;
    }
    return a;
  }

  function drawSilhouette(g, style, rnd, hy, only) {
    if (style === 'none') return;
    const LAYERS = 5;
    const lightX = L.glowX / Math.max(1, W);

    for (let l = 0; l < LAYERS; l++) {
      const depth = l / (LAYERS - 1 || 1);       // 0 furthest, 1 nearest
      const seed = 7001 + l * 613 + Math.floor(rnd() * 4096);
      const freq = 3.4 + depth * 3.6 + rnd() * 1.4;
      const phase = rnd() * 40;
      if (only !== undefined && only !== l) continue;   // stream stays in step above

      const maxH = H * (0.052 + depth * 0.145);
      const step = depth < 0.5 ? 3 : 2;
      const h = ridgeline(style, W, step, seed, freq, phase, maxH);
      const sh = shadingLine(h);      // the same range, smooth enough to light by

      // the snow line, and the band it fades in over
      const snowAt = maxH * (0.56 - depth * 0.12);
      const snowFade = Math.max(1, maxH * 0.42);
      const win = Math.max(3, Math.round(26 / step));   // the face window

      /* Clip to the ridgeline before painting the strips. Without this a steep
         face comes out as a staircase, because each column is a rectangle and
         a rectangle has a flat top — on a gentle slope that is invisible and
         on a peak it is all you can see. The path is the real line; the strips
         only carry the shading. */
      g.save();
      g.beginPath();
      g.moveTo(-4, hy + 2);
      for (let i = 1; i < h.length - 1; i++) g.lineTo(i * step - step, hy - h[i]);
      g.lineTo(W + 4, hy + 2);
      g.closePath();
      g.clip();

      for (let i = 1; i < h.length - 1; i++) {
        const x = i * step - step;
        const ht = h[i];
        const y = hy - ht;

        /* Slope across a wide window on the SMOOTH line. Everything here is a
           smoothstep rather than a threshold: a shading model that can flip
           between two regimes on a small change in slope will find a way to do
           it every few pixels, which is a barcode, which is what this was. */
        const a2 = sh[Math.max(0, i - win)], b2 = sh[Math.min(sh.length - 1, i + win)];
        const slope = (b2 - a2) / (win * 2 * step);
        const u = x / Math.max(1, W);

        /* Which way the light is coming from. This used to be a sign flip at
           the moon's own x, which put a hard vertical seam down the middle of
           every range — the two halves lit oppositely with nothing between
           them. The moon is far away, so the direction barely changes across
           the scene: a tanh over the whole width turns that seam into the
           gentle sweep it should have been. */
        const toward = -Math.tanh((lightX - u) * 2.6);
        const facing = Math.tanh(slope * toward * 5.5);   // saturates, never clips

        let v = 0.44 + facing * 0.26;
        /* Snow on height alone, eased in over a band. Steepness used to gate
           it, which is true of real mountains and was the whole problem: the
           gate flipped. */
        const snow = U.smoothstep(U.clamp((ht - snowAt) / snowFade, 0, 1));
        v = U.clamp(U.lerp(v, 0.90 + facing * 0.09, snow * 0.85), 0.03, 1);

        /* Baked in greys: what is baked is the FORM — where the light falls —
           and the land pass multiplies the colour in afterwards. */
        const c = Math.round(U.lerp(8, 236, v));
        g.fillStyle = 'rgb(' + c + ',' + c + ',' + c + ')';
        // the clip owns the top edge, so overshoot it and let the path cut
        g.fillRect(x - 1, y - 3, step + 2, hy - y + 6);
      }
      g.restore();

      /* A hairline along the crest. Real ridges are lit along their edge
         because there is nothing behind them to block the sky, and this one
         line does more for the silhouette than everything above it. */
      g.strokeStyle = 'rgba(255,255,255,' + (0.16 + depth * 0.16).toFixed(2) + ')';
      g.lineWidth = 1;
      g.beginPath();
      for (let i = 1; i < h.length - 1; i++) {
        const x = i * step - step, y = hy - h[i];
        if (i === 1) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  /* Paint the three baked ridges, each mixed toward the haze by how far away
     it is.

     This has to be CACHED, not composited per frame. Tinting three full-screen
     layers with a source-atop fill and drawing them costs about 24ms — the
     whole frame budget and half again — which is the exact trap the renderer
     is otherwise built to avoid: full-screen translucent fills dominate 2D
     canvas cost, so anything that covers the screen gets baked once and
     blitted after.

     The tint only depends on the haze colours, and those move slowly, so the
     key is those colours quantised hard. In practice it rebakes a handful of
     times over a day/night cycle and blits on every other frame. */

  /* ---------------------------------------------------------------- setup */

  function init(cv) {
    canvas = cv;
    /* The GPU takes the sky and the sea if it can have them, and this canvas
       becomes the layer of things standing in that world rather than the world
       itself — so it needs an alpha channel to let the one underneath through.

       If WebGL2 is missing, or a shader will not compile, or the context is
       lost mid-session, glOn goes false and every stage below draws exactly
       what it always drew. The game runs on whatever somebody has. */
    glCanvas = document.getElementById('glscene');
    glOn = !!(glCanvas && VF.gl && VF.gl.init(glCanvas));
    ctx = cv.getContext('2d', { alpha: glOn });
    VF.bus.on('gl:lost', function () { glOn = false; });
    buildGrain();
    resize();
    VF.bus.on('location:changed', function () {
      backdropKey = ''; buildStars(); seedAmbient(); departure = null; shoalKey = '';
      if (VF.zoneArt) VF.zoneArt.invalidate();
    });
    VF.bus.on('fishing:lost', function (e) { beginDeparture(e.catch); });
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
    if (glOn && VF.gl) VF.gl.resize(W, H, DPR);
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
    L.seatX = W * U.lerp(0.20, 0.27, U.clamp(((loc.void || 0) - 0.5) / 0.5, 0, 1));
    /* On a shore the ledge runs off the bottom of the frame and the seat can
       sit low. Once it is a slab in nothing, the nothing under it is half the
       picture, so the whole thing lifts to make room for it. */
    const vd = U.clamp(loc.void || 0, 0, 1);
    L.seatY = H * U.lerp(0.90, 0.72, U.clamp((vd - 0.5) / 0.5, 0, 1));
    /* Where a fish is brought to hand. On a shore that is the water just in
       front of you. On a slab in nothing it has to be clear of the slab: the
       last seconds of every fight happen here, and so does everything a fish
       does after it gets off, and none of it is worth watching from behind the
       thing you are sitting on. */
    const nearEdge = U.clamp((vd - 0.5) / 0.5, 0, 1);
    L.landPoint.x = W * U.lerp(0.42, 0.55, nearEdge);
    L.landPoint.y = L.horizonY + L.waterH * U.lerp(0.90, 0.72, nearEdge);
  }

  /* The one big light — moon, ring, arch, monolith, crystal, tear, eye — was
     nailed to W * 0.70 in all nine zones, which is a large part of why they
     read as one place: the brightest thing on screen never moved. It is a
     world position now, out past the horizon where a celestial object belongs,
     and everything keyed off L.glowX — the moonpath, the horizon seam, the
     tilt on the water gradient — follows it for nothing.

     The default u is solved rather than typed, so with the camera centred the
     light lands exactly where it always did and the change is invisible until
     a zone asks for somewhere else. */
  const LIGHT_D = 6;

  function placeLight() {
    if (!VF.space) return;
    const loc = VF.locations.current();
    const z = VF.zoneData && VF.zoneData.get(loc.id);
    const lw = (z && z.spatial && z.spatial.light) || null;
    const d = lw && lw.d !== undefined ? lw.d : LIGHT_D;
    // 0.4 / spread(d) puts it at 0.70 W with the camera at rest
    const u0 = lw && lw.u !== undefined ? lw.u : 0.4 / VF.space.spread(d);
    const h0 = lw && lw.h !== undefined ? lw.h : 0.145;

    /* AND IT MOVES.

       It did not. The one big light sat at a fixed height and a fixed bearing
       in every zone at every hour of every day, and that is most of why a
       sunset here was a colour rather than an event: the sun did not go down,
       it went orange. Nothing keyed off it could say anything either — the
       lane it lays on the water, the seam under the horizon, the tilt of the
       water gradient are all correct machinery pointed at a nail.

       So it runs an arc. High at midday, low at both ends of the day, and
       lowest in the small hours — which is also what makes the reflection
       LONG in the evening, because a light near the horizon lays its path all
       the way to the boat and a light overhead lays none at all.

       It never goes under. This game has one celestial object per zone rather
       than a sun and a moon, so the arc bottoms out just above the water
       instead of setting: a moon low over the sea is the correct night and it
       keeps the signature reflection that half these zones are built around.

       A place with a roof does not get any of this. In the Abyss and the
       Cradle the light is a hole in the rock, and holes do not rise. */
    const air = loc.air || {};
    const fixed = air.sky === 'closed' || air.sky === 'inverted';
    const arc = VF.palette.sunArc ? VF.palette.sunArc() : 0.5;

    let u = u0, h = h0;
    if (!fixed) {
      /* Across the sky as well as up it, so the light is in a different part
         of the frame in the morning than in the evening and the water's lane
         swings with it over a session. Kept inside the frame's own span: this
         is a fixed camera looking one way, and a light that walks out of shot
         takes the composition with it. */
      const sweep = Math.sin(((VF.time.cycle() - 0.330 + 1) % 1) * Math.PI * 2);
      u = u0 - sweep * (0.62 / VF.space.spread(d));
      h = h0 * (0.20 + 1.05 * arc);
    }
    L.glowX = VF.space.xAt(u, d);
    L.glowY = L.horizonY - H * h;
  }

  function seedAmbient() {
    VF.particles.clearKind(VF.particles.KIND.MOTE);
    // nothing drifts in the last water, because there is nothing to drift in
    if ((VF.locations.current().void || 0) > 0.9) return;
    const q = VF.state.data.settings.quality;
    const n = q === 'low' ? 14 : q === 'medium' ? 30 : 52;
    VF.particles.ambient(W, H, n, VF.palette.P.star);
  }

  /* ---------------------------------------------------------------- update */


  function update(dt) {
    if (VF.creatureArt) VF.creatureArt.tick(dt);
    if (VF.zoneArt) VF.zoneArt.tick(dt);
    t += dt;

    computeLayout();
    /* The world learns where the horizon is, then the camera moves, then the
       light is projected through both — in that order, or the frame is drawn
       against last frame's geometry. */
    if (VF.space) VF.space.sync(L, VF.palette.P);
    if (VF.camera) VF.camera.tick(dt);
    placeLight();
    if (VF.landmarks) VF.landmarks.tick(dt);
    updateRod(dt);
    updateBobber(dt);
    VF.rodArt.tick(dt);
    if (departure) departure.t += dt;
    updateWeatherParticles(dt);
    VF.particles.update(dt, W, H, L.horizonY + L.waterH * 0.35);
  }

  /* Rod geometry. Bends under load and drifts gently when idle. */
  const rodState = { angle: 0, bend: 0, sway: 0 };

  function updateRod(dt) {
    const S = VF.fishing.S;
    const fh = L.figureH;
    // the body poses first; the rod hangs off whatever the hands are doing
    VF.anglerArt.update(dt, S);
    const h = VF.anglerArt.hand(fh, 'sit', 1);
    L.rodHand.x = L.seatX + h.x;
    L.rodHand.y = L.seatY + h.y;

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
      targetAngle = -0.62 + S.fight.tension * 0.22;
      targetBend = 0.16 + S.fight.tension * 0.40 + S.fight.surge * 0.16;
    } else if (S.state === 'bite') {
      targetBend = 0.10 + Math.sin(t * 26) * 0.16;
    }

    rodState.sway = Math.sin(t * 0.55) * 0.014 + Math.sin(t * 0.23) * 0.02;
    rodState.angle = U.approach(rodState.angle, targetAngle, 0.0015, dt);
    // a rod bends, it does not fold — the cap keeps the tip in front of the angler
    rodState.bend = U.clamp(U.approach(rodState.bend, targetBend, 0.002, dt), 0, 0.78);
  }

  /* A fishing rod is somewhere near twice the height of the person holding it.
     `art.len` drifted upward as rods were added — the shelf started at 0.78 and
     the newest ones are past 1.7, which came out over three times the angler —
     so the spread is compressed here, against the wooden rod as the anchor,
     rather than by rewriting sixty art blocks. Wood stays where it was; the top
     of the list lands near 2.2x instead of 3.2x. */
  const ROD_ANCHOR = 0.78, ROD_SPREAD = 0.435;

  /* --------------------------------------------------------- the rod stage

     Compressing the spread was not enough. The length still came out of the
     rod and the figure, and the frame had no say in it, so on a 1440x860 the
     endgame rod ran 563px from a hand at 0.20W and put its tip within twenty
     pixels of the exact centre of the screen — straight through the horizon,
     across whatever the zone had put out there, and over the water the player
     is supposed to be reading.

     So the frame decides, and the rod fits into it. The length falls out of
     the geometry rather than the geometry falling out of the length, and every
     rod at every viewport lands its tip in the same composed place.

     Rod identity survives — a long rod is still visibly long — but as a band
     around the stage rather than as an absolute, which is the difference
     between a rod that reads as bigger and a rod that eats the frame.

     The constraint that matters is horizontal. A rod tip crossing the skyline
     is what a held rod does and is fine; a rod tip arriving at the exact
     centre of the picture is not, because from there the blank is a diagonal
     through everything behind it. So the stage is a reach — TIP_X across the
     frame — and the vertical is left alone except for keeping the tip on it.

     Floored against the figure so that a narrow viewport, where the angler is
     width-capped and the reach to TIP_X is only a few dozen pixels, does not
     end up with a rod the size of a pencil; and ceilinged at the length the
     rod would have had anyway, so this can only ever make a rod smaller. */
  const TIP_X = 0.46;        // how far across the frame the tip may reach
  const TIP_TOP = 0.16;      // and how much sky it must leave above it
  const ROD_BAND = 0.16;     // +-16% of the stage, across the whole ladder

  /* Where the rod would reach if the frame had no opinion. Kept so the art can
     be drawn at the weight it was tuned for. */
  function rodNaturalLength() {
    const rl = VF.rods.get(VF.state.data.rod).art.len;
    return L.figureH * 1.85 * (ROD_ANCHOR + (rl - ROD_ANCHOR) * ROD_SPREAD);
  }

  function rodStageLength(a, k) {
    const cos = Math.cos(a), sin = Math.sin(a);
    let len = (W * TIP_X - L.rodHand.x) / Math.max(0.25, cos);
    len *= U.lerp(1 - ROD_BAND, 1 + ROD_BAND, k);
    len = U.clamp(len, L.figureH * 1.15, rodNaturalLength());
    // and it stays on the frame, however far back the cast has pulled it
    if (sin < -0.01) len = Math.min(len, (L.rodHand.y - H * TIP_TOP) / -sin);
    return Math.max(L.figureH * 0.9, len);
  }

  function rodTipPoint() {
    const rl = VF.rods.get(VF.state.data.rod).art.len;
    const a = rodState.angle + rodState.sway;
    /* Where this rod sits in the ladder, 0 at the wooden one and 1 at the top,
       mapped onto a band either side of the stage. */
    const k = U.clamp((rl - ROD_ANCHOR) / 0.95, 0, 1);
    const len = rodStageLength(a, k);
    const bend = rodState.bend;
    // quadratic curve: control point offset perpendicular to the rod line
    const ex = L.rodHand.x + Math.cos(a) * len;
    const ey = L.rodHand.y + Math.sin(a) * len;
    const nx = -Math.sin(a), ny = Math.cos(a);
    // the blank curves progressively: little deflection at the butt, most at the tip
    const cx = L.rodHand.x + Math.cos(a) * len * 0.5 + nx * len * bend * 0.10;
    const cy = L.rodHand.y + Math.sin(a) * len * 0.5 + ny * len * bend * 0.10;
    const tx = ex + nx * len * bend * 0.30;
    const ty = ey + ny * len * bend * 0.30;
    return { x: tx, y: ty, cx: cx, cy: cy, len: len, a: a };
  }

  function updateBobber(dt) {
    const S = VF.fishing.S;
    const tip = rodTipPoint();
    L.rodTip.x = tip.x; L.rodTip.y = tip.y;

    const b = L.bobber;
    /* The rig goes where the cast said it went. This used to be a random
       lateral times the width of the screen, thrown away and re-rolled on
       every throw — which is why nothing downstream could ever ask where the
       line was. How far out it reaches, including the collapse in water there
       is nothing to reach across, is settled in fishing.resolveCast now: it is
       a question about the cast rather than about the picture. */
    const pr = VF.space.project(S.castU, S.castD);
    L.castTarget.x = pr.x;
    L.castTarget.y = pr.y;

    const out = S.state === 'casting' || S.state === 'waiting' ||
                S.state === 'bite' || S.state === 'reeling';
    if (out) rigOut = true;
    else if (rigOut) beginRetract(b, tip);

    if (!out) return updateRetract(dt, b, tip);
    b.visible = true;

    if (S.state === 'casting') {
      const k = U.easeOutCubic(S.flight);
      b.x = U.lerp(tip.x, L.castTarget.x, k);
      /* The throw lifts on its way out, but the rig is a weight on a line, not
         a bird: it cannot climb over the horizon into the sky. The lift is
         capped at the water's top edge, and where the straight path is already
         higher than that — the first moments, leaving a raised tip — no lift
         is added at all. */
      const straight = U.lerp(tip.y, L.castTarget.y, k);
      // a longer throw carries a higher arc, and distance is how far out it went
      const arc = Math.sin(S.flight * Math.PI) * L.waterH * 0.42 * (0.35 + S.castD * 0.65);
      const ceiling = Math.min(straight, L.horizonY + L.waterH * 0.05);
      b.y = Math.max(ceiling, straight - arc);
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

  /* Bringing the line in is a movement, not a disappearance. Whatever the rig
     was doing, it travels back up the line to the rod tip and goes out there —
     otherwise it blinks out wherever it happened to be sitting, which is what
     it looked like every time a cast was cancelled or a fish came off. */
  let rigOut = false;
  const retract = { t: 0, dur: 0, x: 0, y: 0, scale: 1 };

  function beginRetract(b, tip) {
    rigOut = false;
    retract.x = b.x;
    retract.y = b.y + b.bob;
    retract.scale = b.scale;
    // a long cast takes longer to wind back than a short one
    const d = Math.hypot(retract.x - tip.x, retract.y - tip.y);
    retract.dur = U.clamp(0.16 + d / Math.max(1, W) * 0.55, 0.16, 0.52);
    retract.t = retract.dur;
  }

  function updateRetract(dt, b, tip) {
    if (retract.t <= 0) { b.visible = false; return; }
    retract.t = Math.max(0, retract.t - dt);
    const k = U.easeInCubic(1 - retract.t / retract.dur);   // slow off the water, quick at the hand
    b.visible = true;
    b.x = U.lerp(retract.x, tip.x, k);
    b.y = U.lerp(retract.y, tip.y, k);
    b.scale = U.lerp(retract.scale, 0.42, k);
    b.bob = 0;
  }

  function scaleAt(y) {
    const k = U.clamp((y - L.horizonY) / Math.max(1, L.waterH), 0, 1);
    return U.lerp(0.34, 1.0, Math.pow(k, 0.85));
  }

  /* newCastLateral used to live here: it re-rolled the bobber's lateral to
     0.54 + rnd() * 0.22 of the screen width on every cast and threw it away
     afterwards. The cast has a world position now and the renderer reads it,
     so there is nothing left to randomise. */

  /* ------------------------------------------------- weather particles */

  function updateWeatherParticles(dt) {
    const K = VF.particles.KIND;
    /* Rain needs somewhere to land and fog needs air to sit in. Neither is
       available at the bottom, and the weather still does everything it does
       to the odds — it simply stops being visible as weather. */
    if ((VF.locations.current().void || 0) > 0.9) return;
    const q = VF.state.data.settings.quality;
    const scale = q === 'low' ? 0.35 : q === 'medium' ? 0.65 : 1;

    const rain = VF.weather.rain();
    if (rain > 0.02) {
      const want = Math.round(rain * 190 * scale);
      const have = VF.particles.countOf(K.RAIN);
      const spawnN = Math.min(14, Math.max(0, Math.round((want - have) * 0.3)));
      for (let i = 0; i < spawnN; i++) {
        VF.particles.spawn({
          x: Math.random() * (W * 1.3) - W * 0.15, y: -20,
          vx: 30 + rain * 60, vy: 620 + Math.random() * 340,
          life: 4, size: 0.5 + Math.random() * 1.1,
          color: [186, 214, 236], alpha: 0.26 + Math.random() * 0.34,
          kind: K.RAIN, drag: 1, grav: 60
        });
      }
    } else if (VF.particles.countOf(K.RAIN) > 0 && Math.random() < 0.2) {
      VF.particles.clearKind(K.RAIN);
    }

    const met = VF.weather.meteors();
    if (met > 0.05 && Math.random() < dt * 1.9 * met) spawnMeteor();

    // distant lightning: a soft sky-wide bloom, well behind the horizon
    if (VF.weather.id() === 'storm') {
      lightning -= dt;
      if (lightning <= 0) {
        lightning = VF.rng.g.range(9, 26);
        flashT = 0.55;
        flashX = VF.rng.g.range(0.1, 0.9);
        VF.audio.thunder(VF.rng.g.range(1.4, 3.2));
      }
    }
    if (flashT > 0) flashT = Math.max(0, flashT - dt);

    updateSkyfall(dt);
  }

  let lightning = 12, flashT = 0, flashX = 0.5;

  /* Lightning is drawn as a bloom in the cloud layer, not a full-screen strobe. */
  function drawLightning(P) {
    if (flashT <= 0 || VF.state.data.settings.reduceFlash) return;
    const k = Math.pow(flashT / 0.55, 1.8) * (0.55 + 0.45 * Math.sin(flashT * 47));
    if (k <= 0.01) return;
    const x = flashX * W, y = L.horizonY * 0.52;
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, H) * 0.55);
    g.addColorStop(0, 'rgba(210,225,255,' + (0.30 * k).toFixed(3) + ')');
    g.addColorStop(0.35, 'rgba(170,195,240,' + (0.09 * k).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(150,180,230,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, L.horizonY);
    ctx.restore();
  }

  /* SKYFALL. Conditions have visual flags but nothing has ever read one except
     `calm`, so this is the only place the event exists on screen: lights that
     come down slowly, hit the water, and leave a ring. They are tracked here
     rather than handed to the particle system because the whole point is what
     happens when one lands. */
  const falling = [];
  const FALL_MAX = 26;

  function updateSkyfall(dt) {
    const k = VF.conditions ? VF.conditions.flag('skyfall') : 0;
    if (k <= 0.01 && !falling.length) return;
    const q = VF.state.data.settings.quality;
    const scale = q === 'low' ? 0.35 : q === 'medium' ? 0.7 : 1;

    if (k > 0.05 && falling.length < FALL_MAX * scale &&
        Math.random() < dt * 5.2 * k * scale) {
      const x = Math.random() * W;
      falling.push({
        x: x, y: -30 - Math.random() * H * 0.2,
        vx: (Math.random() - 0.5) * 26,
        vy: 105 + Math.random() * 130,
        // where the water is under this one, so it lands on the surface
        hit: L.horizonY + L.waterH * (0.06 + Math.random() * 0.72),
        r: 1.1 + Math.random() * 1.9,
        sway: Math.random() * 6.28
      });
    }

    for (let i = falling.length - 1; i >= 0; i--) {
      const f = falling[i];
      f.vy += 34 * dt;
      f.y += f.vy * dt;
      f.x += (f.vx + Math.sin(f.y * 0.012 + f.sway) * 9) * dt;
      if (f.y < f.hit) continue;
      falling.splice(i, 1);
      // it goes in, and the water says so
      VF.fx.ripple(f.x, f.hit, W * (0.020 + f.r * 0.010), 1.5, [255, 226, 160], 1.2);
      VF.particles.burst(f.x, f.hit, 5, {
        color: [255, 232, 176], angle: -Math.PI / 2, spread: 1.5,
        speedMin: 20, speedMax: 74, sizeMax: 1.7, grav: 190, lifeMax: 0.55
      });
      if (Math.random() < 0.22) VF.audio.splash(0.3);
    }
  }

  function drawSkyfall() {
    if (!falling.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < falling.length; i++) {
      const f = falling[i];
      const tail = Math.min(46, f.vy * 0.17);
      const g = ctx.createLinearGradient(f.x, f.y - tail, f.x, f.y + f.r);
      g.addColorStop(0, 'rgba(255,214,130,0)');
      g.addColorStop(1, 'rgba(255,238,190,0.75)');
      ctx.strokeStyle = g;
      ctx.lineWidth = f.r * 0.9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.x - Math.sin(f.y * 0.012 + f.sway) * 3, f.y - tail);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();
      const rg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
      rg.addColorStop(0, 'rgba(255,244,206,0.85)');
      rg.addColorStop(0.4, 'rgba(255,214,130,0.22)');
      rg.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 5, 0, TAU); ctx.fill();
    }
    ctx.restore();
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

  /* Opt-in stage timing. Off by default; VF.scene.profile(true) turns it on. */
  let prof = null;
  function mark(name, fn) {
    if (!prof) { fn(); return; }
    const t0 = performance.now();
    fn();
    prof.acc[name] = (prof.acc[name] || 0) + (performance.now() - t0);
  }

  /* ------------------------------------------------------------- the stages

     The frame in order, as two lists rather than a run of mark() calls.

     Every one of these draws through the module's own `ctx`, so porting a
     stage to the GPU is a matter of pointing that at js/gl/path.js for the
     length of the call — which is why not one art function is edited. Naming
     them and putting them in an array is what lets js/gl/layer.js take a
     PREFIX of the list and hand the rest back: whatever it declines runs in 2D
     on the canvas above, which is where those stages belong in the order
     anyway. A partial port is the same picture drawn by two renderers.

     The lists are built here and nowhere else, so that the comparison tools
     drive the code the frame actually runs instead of a re-listing of it. Two
     copies of a stage list are two stage lists that drift. */
  function stage(name, raw) {
    return { name: name, raw: raw, fn: function (g) {
      const held = ctx;
      ctx = g;
      try { mark(name, raw); } finally { ctx = held; }
    } };
  }

  /* Behind the water. */
  function backList(P, q) {
    return [
      stage('stars', function () { buildStars(); drawStars(P, q); }),
      stage('clouds', function () { buildClouds(); drawClouds(P); }),
      stage('horizon', function () { drawHorizonFeature(P); }),
      stage('land', function () { drawLand(P); }),
      /* The zone's landmarks: the ones at or past the horizon go in with the
         ridgeline, so they sit in the same weather as the distant land. Half
         of what makes a place a place. */
      stage('zoneback', function () {
        if (VF.landmarkArt) VF.landmarkArt.drawBehind(ctx, L, P);
        if (VF.zoneArt) VF.zoneArt.drawBack(ctx, L, P);
      })
    ];
  }

  /* On and in front of the water. `world` is whether the shader drew the sea,
     which two of these branch on. */
  function frontList(P, q, world) {
    return [
      stage('aurora', function () { drawAurora(P); }),
      stage('lightning', function () { drawLightning(P); }),
      stage('fog', function () { drawFog(P, q); }),
      /* The body of the water, its light and its surface belong to the shader
         when there is one. What stays here either way is what is reflected IN
         the water — the land and the stars — because those are cached sprites
         that already exist and blitting one costs less than sampling it. */
      stage('water', function () { if (world) drawWaterOver(P, q); else drawWater(P, q); }),
      stage('under', function () { if (P.void < 0.9) drawUnderwater(P); }),
      stage('shoal', function () { seedShoal(); drawShoal(P, q); }),
      stage('surface', function () {
        if (!world) { seedGlints(); drawSurface(P, q); }
        drawSurfaceMist(P, q);
      }),
      stage('skyfall', function () { drawSkyfall(); }),
      stage('ripples', function () { if (P.void < 0.9) VF.fx.drawRipples(ctx, 0.26); }),
      /* What is on the water HERE and nowhere else: the gulls, the panes, the
         crystals, the contacts, the bottle drifting in — and the landmarks
         standing in the water, which go over it and under the encounter
         layer, so a wreck is in the sea rather than on the screen. Half of
         what makes a zone a zone. */
      stage('zone', function () {
        if (VF.zoneArt) VF.zoneArt.drawFront(ctx, L, P);
        if (VF.landmarkArt) VF.landmarkArt.drawOn(ctx, L, P);
      }),
      /* An encounter draws under the line and over the surface: it is in the
         water, not on the screen. */
      stage('creature', function () { if (VF.creatureArt) VF.creatureArt.draw(ctx, L, P); }),
      stage('aim', function () { drawAim(P); }),
      stage('line', function () { drawLineAndBobber(P); drawDeparture(P); }),
      stage('particles', function () { VF.particles.draw(ctx); }),
      stage('fore', function () { drawForeground(P); }),
      stage('cutscene', function () { drawCutscene(); }),
      stage('overlay', function () { VF.fx.drawOverlay(ctx, W, H); })
    ];
  }

  /* Run a list from `from` onward on whatever context is current. The GPU took
     everything before `from`; this is the remainder. */
  function runFrom(list, from) {
    for (let i = from; i < list.length; i++) mark(list[i].name, list[i].raw);
  }

  /* The whole of one list into a given context, for the comparison tools. */
  function drawBack(g, P, q) {
    const list = backList(P, q);
    for (let i = 0; i < list.length; i++) list[i].fn(g);
  }
  function drawFront(g, P, q, world) {
    const list = frontList(P, q, world === undefined ? true : world);
    for (let i = 0; i < list.length; i++) list[i].fn(g);
  }

  function draw() {
    const P = VF.palette.P;
    const wrongK = VF.wrong ? VF.wrong.intensity() : 0;
    const q = VF.state.data.settings.quality;
    const shakeOff = VF.fx.shakeOffset();

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (shakeOff) ctx.translate(shakeOff.x, shakeOff.y);

    buildBackdrop();

    /* THE FRAME, IN TWO HALVES, ON WHICHEVER RENDERER CAN DRAW EACH.

       The 2D canvas sits above the GL one, so a stage can only move to the GPU
       if every stage behind it already has. js/gl/layer.js takes the longest
       prefix of each list it can actually draw and says how many it took; the
       rest run here, in 2D, above — which is where they belong in the order
       anyway. Nothing below knows or cares which renderer drew it. */
    const backs = backList(P, q);
    const useGl = glOn && VF.glWorld && VF.glWorld.ok() && VF.glLayer && VF.glLayer.ok();

    const world0 = glOn && VF.glWorld && VF.glWorld.ok();

    let backTex = null, backTook = 0;
    if (useGl) {
      const r = VF.glLayer.back(backs, function (g) {
        if (shakeOff) g.translate(shakeOff.x, shakeOff.y);
      });
      if (r) { backTex = r.tex; backTook = r.count; }
    }

    /* The world, with the backdrop composited inside it — over its sky and
       under its water, so the sea can cover the foot of a headland. It returns
       false if it could not draw at all, and then the 2D sky and water below
       draw exactly as they always did. */
    /* THE POST CHAIN. Open it and the world and the front layer both go into
       a half-float buffer instead of onto the canvas; js/gl/post.js puts the
       finished image on the canvas at the end of the frame. Null when it is
       unavailable, and then everything below writes straight to the screen
       exactly as it did before there was one. */
    const post = (world0 && useGl && VF.glPost) ? VF.glPost.begin(q) : null;
    /* The world goes into its own smaller buffer when the quality level asks
       for one, and is lifted into the scene before the art is drawn over it.
       Nothing about the world pass changes; it is handed a different target. */
    /* The backdrop goes to whichever pass is running at full size — the
       world shader when it is, and the lift when it is not. Handing it to a
       reduced-resolution world pass puts every star and cloud through the
       downscale, which is the one thing that scale exists to avoid. */
    const backToWorld = (post && !VF.glPost.wantsBack(q)) ? null : backTex;
    const world = glOn && VF.glWorld
      ? VF.glWorld.draw(L, P, backToWorld, post ? VF.glPost.worldInto(q) : null) : false;
    if (world && post) VF.glPost.lift(q, backToWorld ? null : backTex, L.horizonY / H);
    if (!world) { backTex = null; backTook = 0; }
    if (world) ctx.clearRect(0, 0, W, H);

    mark('sky', function () { if (!world) drawSky(P); });
    runFrom(backs, backTook);

    const fronts = frontList(P, q, world);
    let frontTook = 0;
    if (world && useGl) {
      const r = VF.glLayer.front(fronts, function (g) {
        if (shakeOff) g.translate(shakeOff.x, shakeOff.y);
      });
      if (r && r.count) {
        /* onto the canvas, blended, because a resolve cannot blend */
        if (VF.glLayer.composite(r.tex, post)) frontTook = r.count;
      }
    }
    runFrom(fronts, frontTook);

    /* And the chain onto the canvas. After the front layer and before any of
       the 2D remainder, because the remainder is on the canvas ABOVE this one
       and must not be graded twice. */
    if (post) VF.glPost.end(L, P, q, VF.state.rt.dt);
    syncVignette();

    if (wrongK > 0.01) drawWrong(wrongK);
    if (debugOn) drawDebug();
    if (prof) { prof.frames++; }
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    /* THE SHUTTER, and it has to be here.

       The GL context is created with preserveDrawingBuffer:false — the right
       setting, and the reason a photograph cannot be taken from anywhere else:
       once this frame returns, that buffer is gone. So js/systems/album.js
       arms, and the picture is taken at the tail of the draw that follows,
       while both canvases still hold the frame the player was looking at. */
    if (VF.album && VF.album.pending()) {
      VF.album.capture(VF.gl && VF.gl.ok() ? glCanvas : null, canvas);
    }
  }

  /* Where the line is going, while the meter is filling.

     Two marks rather than one, and the gap between them is the whole lesson:
     the ring is what the player pointed at, and the cross is where the rig
     will actually land — short of it on a soft throw, and short of it however
     hard it is thrown if the rod cannot reach that far. Nothing has to explain
     that a longer rod reaches further once you have watched the gap close.

     It is drawn on the water rather than over it: a flat ellipse on the
     surface, sized by the perspective, so it reads as a place rather than as a
     cursor. */
  function drawAim(P) {
    const S = VF.fishing.S;
    if (!S.charging || !VF.space) return;
    const landD = Math.min(U.clamp(S.aimD, 0.04, 1), VF.fishing.reach()) *
                  (0.62 + 0.38 * S.charge);

    const want = VF.space.project(S.aimU, S.aimD);
    const wx = want.x, wy = want.y, ws = want.scale;
    const land = VF.space.project(S.aimU, landD);

    ctx.save();
    ctx.lineWidth = 1.2;

    /* The ring reports the water under it. Deep water draws it heavier, and on
       the trench that is the only reading the player gets of where the seam
       is between one sonar sweep and the next — so the mark is an instrument
       as well as a cursor, and the zone's navigation problem is something the
       hand can solve rather than something the interface announces. */
    const deep = VF.zones && VF.zones.depthAt ? VF.zones.depthAt(S.aimU, S.aimD) : S.aimD;
    const r = Math.max(5, W * 0.016 * ws);
    ctx.strokeStyle = U.rgbToCss(P.glow, 0.18 + deep * 0.34);
    ctx.lineWidth = 1 + deep * 1.1;
    ctx.beginPath();
    ctx.ellipse(wx, wy, r, r * 0.30, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 1.2;

    // and where it is actually going to go
    const short = Math.abs(land.y - wy) > 2;
    if (short) {
      ctx.strokeStyle = U.rgbToCss(P.glow, 0.5);
      const c = Math.max(3, W * 0.008 * land.scale);
      ctx.beginPath();
      ctx.moveTo(land.x - c, land.y); ctx.lineTo(land.x + c, land.y);
      ctx.moveTo(land.x, land.y - c * 0.42); ctx.lineTo(land.x, land.y + c * 0.42);
      ctx.stroke();
      // the shortfall, drawn as the distance it is
      ctx.strokeStyle = U.rgbToCss(P.glow, 0.14);
      ctx.beginPath();
      ctx.moveTo(land.x, land.y); ctx.lineTo(wx, wy);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ F9

     The world with its working shown: the (u, d) lattice the water is
     addressed by, where the camera is pointed, and — once there are any — the
     landmark graph with its sightlines.

     This is not a nicety. Placement that is planned rather than scattered is
     invisible when it works, so the only way to tell a deliberate composition
     from a lucky one is to be able to see the grid it was composed on. */
  let debugOn = false;

  function drawDebug() {
    if (!VF.space || !VF.camera) return;
    const cam = VF.camera.get();
    ctx.save();
    ctx.lineWidth = 1;

    // lines of constant u, running out to the horizon
    ctx.strokeStyle = 'rgba(120,220,255,0.22)';
    for (let u = -3; u <= 3; u += 0.5) {
      ctx.beginPath();
      for (let d = 0; d <= 1.0001; d += 0.05) {
        const x = VF.space.xAt(u, d), y = VF.space.yAt(d);
        if (d === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // and of constant d, across it
    ctx.strokeStyle = 'rgba(120,220,255,0.16)';
    for (let d = 0; d <= 1.0001; d += 0.1) {
      const y = VF.space.yAt(d);
      ctx.beginPath();
      ctx.moveTo(VF.space.xAt(-3, d), y);
      ctx.lineTo(VF.space.xAt(3, d), y);
      ctx.stroke();
    }

    // the edge of the world, which is what the camera is clamped to
    const hw = VF.space.halfWorld();
    ctx.strokeStyle = 'rgba(255,180,90,0.55)';
    [-hw, hw].forEach(function (u) {
      ctx.beginPath();
      for (let d = 0; d <= 1.0001; d += 0.05) {
        const x = VF.space.xAt(u, d), y = VF.space.yAt(d);
        if (d === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    });

    if (VF.landmarks && VF.landmarks.debugDraw) VF.landmarks.debugDraw(ctx);

    // the rod stage, so the composition rule is visible rather than asserted
    ctx.strokeStyle = 'rgba(255,90,120,0.5)';
    ctx.beginPath();
    ctx.moveTo(W * TIP_X, L.horizonY);
    ctx.lineTo(W * TIP_X, H);
    ctx.moveTo(0, H * TIP_TOP);
    ctx.lineTo(W, H * TIP_TOP);
    ctx.stroke();

    ctx.fillStyle = 'rgba(230,245,255,0.9)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('cam u ' + cam.u.toFixed(2) + '  zoom ' + cam.zoom.toFixed(2) +
                 '  ' + cam.mode + (cam.enabled ? '' : ' (locked)') +
                 '   air ' + VF.space.density().toFixed(2) +
                 '   rod ' + Math.round(rodTipPoint().len) + 'px', 12, H - 14);
    ctx.restore();
  }

  function drawSky(P) {
    const g = ctx.createLinearGradient(0, 0, 0, L.horizonY);
    g.addColorStop(0, U.rgbToCss(P.skyTop));
    g.addColorStop(1, U.rgbToCss(P.skyBot));
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, L.horizonY + 31);

    // light gathering at the horizon — this is what makes distant land read
    const band = H * 0.26;
    const far = 1 - P.void;                 // there is no distance in the void
    const hg = ctx.createLinearGradient(0, L.horizonY - band, 0, L.horizonY);
    hg.addColorStop(0, U.rgbToCss(P.glow, 0));
    hg.addColorStop(0.62, U.rgbToCss(P.glow, (0.045 * P.bright + 0.020) * far));
    hg.addColorStop(1, U.rgbToCss(P.glow, (0.115 * P.bright + 0.045) * far));
    ctx.fillStyle = hg;
    ctx.fillRect(0, L.horizonY - band, W, band);
  }

  function drawStars(P, q) {
    if (P.starAlpha <= 0.01) return;
    const sky = L.horizonY;

    // the baked field: one blit for two thousand stars and a galaxy
    if (starField) {
      ctx.globalAlpha = P.starAlpha;
      ctx.drawImage(starField, 0, 0, W, sky);
      ctx.globalAlpha = 1;
    }
    if (!stars) return;

    /* The ten worth animating — a blit cannot twinkle, and a sky where nothing
       moves is a photograph. Two or three of them carry diffraction spikes: the
       cross an eye or a lens puts on a point source, and the cheapest thing
       there is for making a star read as BRIGHT rather than as big.

       Everything here used to be about three times this size. A halo nine
       pixels across on two dozen stars is not a sky, it is a scattering of
       soft lamps, and it was the loudest thing above the horizon. */
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const y = s.y * sky;
      if (y > sky - 2) continue;
      const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.tw);
      const a = P.starAlpha * (0.45 + s.mag * 0.55) * tw;
      if (a <= 0.02) continue;
      const x = s.x * W;

      ctx.globalAlpha = 1;
      // the halo, close in and barely there
      ctx.fillStyle = U.rgbToCss(s.col, a * 0.10);
      ctx.beginPath(); ctx.arc(x, y, s.s * 2.0, 0, TAU); ctx.fill();

      if (s.spikes && q === 'high') {
        ctx.strokeStyle = U.rgbToCss(s.col, a * 0.34);
        ctx.lineWidth = 0.5;
        const len = s.s * (2.0 + tw * 1.1);
        ctx.beginPath();
        ctx.moveTo(x - len, y); ctx.lineTo(x + len, y);
        ctx.moveTo(x, y - len); ctx.lineTo(x, y + len);
        ctx.stroke();
      }
      ctx.fillStyle = U.rgbToCss(s.col, a);
      ctx.fillRect(x - s.s * 0.5, y - s.s * 0.5, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  /* Zero unless a surge is running somewhere the surge cannot otherwise be
     seen. It rises and falls across about eight seconds of a twenty-second
     cycle, so it reads as something looking up and then away rather than as a
     light being switched on and left on. */
  function surgeLook(P) {
    const s = VF.weather.surge();
    if (s <= 0.01 || (P.void || 0) < 0.9) return 0;
    const c = (t * 0.05) % 1;
    if (c > 0.40) return 0;
    return Math.pow(Math.sin((c / 0.40) * Math.PI), 1.7) * 0.46 * s;
  }

  /* The one big light source: moon, ring, arch, monolith, crystal, tear, eye. */
  function drawHorizonFeature(P) {
    const loc = VF.locations.current();
    const gx = L.glowX, gy = L.glowY;
    const R = Math.min(W, H) * 0.046 * P.glowSize;
    const glow = U.rgbToCss(P.glow);

    /* Whatever is out there does not survive the descent, and at the bottom it
       does not survive at all. A dim shape is still a shape: against a ground
       of rgb(9,5,18) even a quarter-strength one came out three times the
       brightness of everything around it, with an edge you could trace. */
    /* Except while a surge is running. Down there the weather has nothing left
       to move — no rain to slant, no fog to thicken, not one particle — so it
       expresses itself through the only thing still out there: the eye opens,
       looks for a few seconds, and closes again. */
    const feat = Math.max(U.clamp((0.92 - P.void) / 0.32, 0, 1), surgeLook(P));
    if (feat <= 0.001) return;

    ctx.save();
    ctx.globalAlpha = feat;

    // ambient bloom around the feature
    drawBloom(P, gx, gy, R);

    switch (loc.horizon) {
      case 'moon': {
        /* The lit face, and the shadow the earth is putting on it. `age` runs
           0 at new through 0.5 at full and back; the terminator is an ellipse
           whose width is the cosine of that, which is why a quarter moon is a
           straight edge and a crescent is a curve going the other way. */
        const age = VF.time.moonAge ? VF.time.moonAge() : 0.5;
        const lit = U.clamp(VF.time.moonLight ? VF.time.moonLight() : 1, 0, 1);

        // the dark disc is still there — it occults stars, so it is drawn
        ctx.globalAlpha = (0.55) * feat;
        ctx.fillStyle = U.rgbToCss(U.shade(P.glow, -0.72));
        ctx.beginPath(); ctx.arc(gx, gy, R, 0, TAU); ctx.fill();

        ctx.save();
        ctx.beginPath(); ctx.arc(gx, gy, R, 0, TAU); ctx.clip();
        ctx.fillStyle = U.rgbToCss(U.shade(P.glow, 0.55));
        ctx.globalAlpha = (1) * feat;
        if (lit > 0.995) {
          ctx.beginPath(); ctx.arc(gx, gy, R, 0, TAU); ctx.fill();
        } else if (lit > 0.005) {
          /* Waxing lights from the right, waning from the left. */
          const waxing = age < 0.5;   // which limb is lit
          const k = Math.cos(age * TAU);          // +1 new, -1 full
          const half = waxing ? -Math.PI / 2 : Math.PI / 2;
          ctx.beginPath();
          ctx.arc(gx, gy, R, half, half + Math.PI);              // the lit limb
          /* The terminator bulges toward the lit limb on a crescent and away
             from it on a gibbous, which is the sign of k in both directions —
             waxing or waning does not enter into it, only which side the limb
             is on, and `half` has already said that. */
          ctx.ellipse(gx, gy, R * Math.abs(k), R, 0,
                      half + Math.PI, half, k > 0);              // the terminator
          ctx.closePath();
          ctx.fill();
        }
        /* Maria: broad, soft, low-contrast darkenings rather than three hard
           black dots. A moon is mostly featureless with a few large stains on
           it, and the stains have no edges. */
        const mr = VF.rng.make(0x3f00d);
        for (let i = 0; i < 9; i++) {
          const a2 = mr() * TAU, rad = Math.sqrt(mr()) * R * 0.82;
          const cx2 = gx + Math.cos(a2) * rad, cy2 = gy + Math.sin(a2) * rad;
          const rr2 = R * (0.10 + mr() * 0.26);
          const mg = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, rr2);
          mg.addColorStop(0, 'rgba(0,0,0,' + (0.055 + mr() * 0.075).toFixed(3) + ')');
          mg.addColorStop(0.6, 'rgba(0,0,0,' + (0.03 + mr() * 0.04).toFixed(3) + ')');
          mg.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.globalAlpha = feat;
          ctx.fillStyle = mg;
          ctx.beginPath(); ctx.arc(cx2, cy2, rr2, 0, TAU); ctx.fill();
        }

        /* Limb darkening. A sphere lit from in front is not a flat disc: it
           falls off toward the edge, and without this the moon reads as a
           sticker cut out of paper — which is exactly what it was. */
        const ld = ctx.createRadialGradient(gx - R * 0.12, gy - R * 0.12, R * 0.18, gx, gy, R);
        /* The falloff has to start early and stay gentle. Stacked hard against
           the edge it stops being a sphere and becomes a disc with a line
           drawn round it, which is a different wrong answer to the one this
           replaced. */
        ld.addColorStop(0, 'rgba(255,255,255,0.11)');
        ld.addColorStop(0.42, 'rgba(255,255,255,0)');
        ld.addColorStop(0.70, U.rgbToCss(U.shade(P.glow, -0.5), 0.06));
        ld.addColorStop(0.90, U.rgbToCss(U.shade(P.glow, -0.6), 0.15));
        ld.addColorStop(1, U.rgbToCss(U.shade(P.glow, -0.62), 0.20));
        ctx.globalAlpha = feat;
        ctx.fillStyle = ld;
        ctx.beginPath(); ctx.arc(gx, gy, R, 0, TAU); ctx.fill();
        ctx.restore();

        /* The air immediately around it. The wide bloom is already down; this
           is the tight ring of scattered light that a bright thing actually
           has against a dark sky, and it is what makes it read as a source
           rather than a shape. */
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = feat;
        const hal = ctx.createRadialGradient(gx, gy, R * 0.92, gx, gy, R * 3.2);
        hal.addColorStop(0, U.rgbToCss(P.glow, 0.22 * (0.4 + P.bright * 0.6)));
        hal.addColorStop(0.35, U.rgbToCss(P.glow, 0.06 * (0.4 + P.bright * 0.6)));
        hal.addColorStop(1, U.rgbToCss(P.glow, 0));
        ctx.fillStyle = hal;
        ctx.beginPath(); ctx.arc(gx, gy, R * 3.2, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = feat;
        break;
      }
      case 'ring': {
        ctx.strokeStyle = glow; ctx.globalAlpha = (0.55) * feat; ctx.lineWidth = R * 0.16;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 3.1, R * 0.85, -0.13, Math.PI * 0.06, Math.PI * 1.34); ctx.stroke();
        ctx.globalAlpha = (0.28) * feat; ctx.lineWidth = R * 0.07;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 3.6, R * 1.0, -0.13, Math.PI * 1.5, Math.PI * 1.92); ctx.stroke();
        ctx.globalAlpha = (0.85) * feat; ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gx, gy, R * 0.42, 0, TAU); ctx.fill();
        break;
      }
      case 'arch': {
        ctx.strokeStyle = glow; ctx.globalAlpha = (0.42) * feat; ctx.lineWidth = R * 0.20;
        ctx.beginPath(); ctx.arc(gx, L.horizonY, R * 3.4, Math.PI, TAU); ctx.stroke();
        ctx.globalAlpha = (0.20) * feat; ctx.lineWidth = R * 0.09;
        ctx.beginPath(); ctx.arc(gx, L.horizonY, R * 4.3, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        break;
      }
      case 'monolith': {
        ctx.globalAlpha = (0.9) * feat; ctx.fillStyle = '#05070b';
        const mw = R * 0.72, mh = R * 6.2;
        ctx.fillRect(gx - mw / 2, L.horizonY - mh, mw, mh);
        ctx.globalAlpha = (0.55) * feat; ctx.fillStyle = glow;
        ctx.fillRect(gx - mw * 0.10, L.horizonY - mh * 0.86, mw * 0.20, mh * 0.66);
        break;
      }
      case 'crystal': {
        ctx.globalAlpha = (0.70) * feat; ctx.fillStyle = glow;
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
          ctx.globalAlpha = (0.22 + (i % 3) * 0.16) * feat;
          ctx.fill();
        }
        break;
      }
      case 'tear': {
        ctx.globalAlpha = (0.85) * feat; ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(gx, gy - R * 3.0);
        ctx.quadraticCurveTo(gx + R * 0.55, gy, gx, gy + R * 2.6);
        ctx.quadraticCurveTo(gx - R * 0.34, gy, gx, gy - R * 3.0);
        ctx.fill();
        ctx.globalAlpha = (0.6) * feat; ctx.strokeStyle = glow; ctx.lineWidth = R * 0.06;
        ctx.stroke();
        break;
      }
      case 'eye': {
        const open = 0.34 + 0.14 * Math.sin(t * 0.19);
        ctx.globalAlpha = (0.34) * feat; ctx.fillStyle = glow;
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 4.2, R * 4.2 * open, 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = (0.95) * feat; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(gx, gy, R * 1.5, R * 1.5 * Math.min(1, open * 2.4), 0, 0, TAU); ctx.fill();
        ctx.globalAlpha = (0.7) * feat; ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(gx + R * 0.4, gy - R * 0.4, R * 0.22, 0, TAU); ctx.fill();
        break;
      }
    }
    ctx.restore();
    ctx.globalAlpha = (1) * feat;
  }

  /* The bloom around the horizon feature is a big translucent radial fill, so it
     is rendered once into a small sprite and blitted, rebuilt only when its
     colour or brightness actually moves. */
  let bloom = null, bloomKey = '';
  function drawBloom(P, gx, gy, R) {
    const key = (P.glow[0] | 0) + ',' + (P.glow[1] | 0) + ',' + (P.glow[2] | 0) + ',' + Math.round(P.bright * 12);
    if (key !== bloomKey || !bloom) {
      bloomKey = key;
      const S = 192;
      const c = bloom && bloom.width === S ? bloom : document.createElement('canvas');
      c.width = c.height = S;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      grad.addColorStop(0, U.rgbToCss(P.glow, 0.44 * P.bright + 0.16));
      grad.addColorStop(0.14, U.rgbToCss(P.glow, 0.20 * P.bright + 0.07));
      grad.addColorStop(0.42, U.rgbToCss(P.glow, 0.055 * P.bright + 0.022));
      grad.addColorStop(1, U.rgbToCss(P.glow, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
      c.__glRev = key;
      bloom = c;
    }
    const d = R * 24;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(bloom, gx - d / 2, gy - d / 2, d, d);
    ctx.restore();
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
    const bands = q === 'high' ? 3 : q === 'medium' ? 2 : 1;
    for (let i = 0; i < bands; i++) {
      const y = L.horizonY - H * (0.02 + i * 0.055);
      const hgt = H * (0.05 + i * 0.045);
      const g = ctx.createLinearGradient(0, y - hgt, 0, y + hgt * 0.5);
      g.addColorStop(0, U.rgbToCss(P.fog, 0));
      g.addColorStop(0.55, U.rgbToCss(P.fog, amt * (0.30 - i * 0.06)));
      g.addColorStop(1, U.rgbToCss(P.fog, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - hgt, W, hgt * 1.5);
    }
    // ground haze sitting on the water
    const g2 = ctx.createLinearGradient(0, L.horizonY - H * 0.01, 0, L.horizonY + L.waterH * 0.32);
    g2.addColorStop(0, U.rgbToCss(P.fog, amt * 0.34));
    g2.addColorStop(1, U.rgbToCss(P.fog, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, L.horizonY - H * 0.01, W, L.waterH * 0.34);
  }

  /* ---------------------------------------------------------------- water */

  /* What still belongs to this canvas once the shader owns the water.

     The land's reflection and the stars' are baked sprites — the flipped
     ridgeline strip and the star field — and blitting one is cheaper than
     asking a shader to reproduce it, so they stay. Everything the shader does
     better than a stack of translucent fills has gone into the shader. */
  function drawWaterOver(P, q) {
    if (q === 'low') return;
    drawBackdropReflection(P);
    drawReflection(P);
  }

  function drawWater(P, q) {
    const hy = L.horizonY, wh = L.waterH;

    // one gradient carries the whole depth ramp, including the near-shore
    // darkening that used to be a second translucent pass
    // the ramp is tilted rather than vertical, so the side away from the light
    // sits deeper without costing a second full-water pass
    const tilt = U.clamp(L.glowX / W, 0.15, 0.85);
    const g = ctx.createLinearGradient(W * tilt * 0.9, hy - wh * 0.10, W * (1 - tilt) * 0.7, H);
    g.addColorStop(0, U.rgbToCss(P.waterTop));
    g.addColorStop(0.50, U.rgbToCss(U.mixRgb(P.waterTop, P.waterBot, 0.68)));
    g.addColorStop(0.78, U.rgbToCss(P.waterBot));
    g.addColorStop(1, U.rgbToCss(U.mixRgb(P.waterBot, [0, 0, 0], 0.45 * (1 - P.void))));
    ctx.fillStyle = g;
    ctx.fillRect(0, hy, W, wh + 2);

    // horizon seam: brightest where the light source meets it, gone at the
    // edges — and gone everywhere once there is no far side for it to be the
    // near edge of
    const seam = ctx.createLinearGradient(0, 0, W, 0);
    const seamA = (0.55 * P.bright + 0.16) * (1 - P.void);
    seam.addColorStop(0, U.rgbToCss(P.glow, seamA * 0.18));
    seam.addColorStop(U.clamp(L.glowX / W, 0.05, 0.95), U.rgbToCss(P.glow, seamA));
    seam.addColorStop(1, U.rgbToCss(P.glow, seamA * 0.22));
    ctx.fillStyle = seam;
    ctx.fillRect(0, hy - 1, W, 1.4);
    ctx.globalAlpha = 1;

    /* Everything that makes water read as water — a reflection, a path of
       light across it, swell, the lines of the waves — is a property of a
       surface, and the surface is what the void takes last. */
    const surf = 1 - P.void;
    if (surf > 0.02) {
      ctx.save();
      ctx.globalAlpha = surf;
      if (q !== 'low') { drawBackdropReflection(P); drawReflection(P); }
      drawMoonpath(P);
      drawSwell(P, q);
      drawWaveLines(P, q);
      ctx.restore();
    }

  }

  /* Mirror the distant land into the water. The flip and the depth fade are
     baked into a cached strip, so each frame is a single sheared blit. */
  let reflect = null, reflectKey = '';

  /* The mirror has to be of the land AS PAINTED, not of the shapes it was
     built from. Those are baked in greys — the FORM, where the light falls —
     and the colour only arrives when bakeLand multiplies it in. Mirroring the
     raw layers put a pale grey band of upside-down mountains across the top of
     the water with a hard edge under it, which is what a mirror of the wrong
     thing looks like. So this keys off the tinted result and rebuilds whenever
     that does. */
  function buildReflection() {
    if (!landPad || !landKey) return;
    const key = landKey + ':' + Math.round(L.horizonY);
    if (reflectKey === key && reflect) return;
    reflectKey = key;
    const hy = L.horizonY;
    const depth = Math.max(2, Math.round(Math.min(L.waterH * 0.42, H * 0.20)));
    const c = reflect && reflect.width === Math.round(W) ? reflect : document.createElement('canvas');
    c.width = Math.max(1, Math.round(W));
    c.height = depth;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, depth);
    g.save();
    g.globalAlpha = 0.30;
    g.translate(0, hy);
    g.scale(1, -1);
    // one image: the whole range, already coloured and already hazed
    g.drawImage(landPad, 0, 0, W, H);
    g.restore();
    // erase with a downward ramp so the mirror dissolves into the water
    g.globalCompositeOperation = 'destination-out';
    const fade = g.createLinearGradient(0, 0, 0, depth);
    fade.addColorStop(0, 'rgba(0,0,0,0.12)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = fade;
    g.fillRect(0, 0, c.width, depth);
    g.globalCompositeOperation = 'source-over';
    c.__glRev = key;      // js/gl/path.js re-uploads on this and only this
    reflect = c;
  }

  function drawBackdropReflection(P) {
    buildReflection();
    if (!reflect) return;
    ctx.save();
    ctx.translate(0, L.horizonY);
    // a slight shear makes the mirror read as a moving surface
    ctx.transform(1, 0, Math.sin(t * 0.5) * 0.012, 1, 0, 0);
    ctx.drawImage(reflect, 0, 0);
    ctx.restore();
  }

  function drawReflection(P) {
    if (P.starAlpha <= 0.03 || !stars) return;
    const hy = L.horizonY;
    ctx.fillStyle = U.rgbToCss(P.star);
    const limit = Math.min(stars.length, VF.state.data.settings.quality === 'high' ? 110 : 70);
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

  /* The signature look. A real moonpath is not a painted stripe — it is one
     soft wedge of haze with a few hundred separate specular flecks blinking on
     and off inside it, denser and narrower the closer you look to the source.
     So that is what this draws: a wedge, then the flecks. */
  function moonSpread(k) { return U.lerp(W * 0.020, W * 0.30, Math.pow(k, 0.72)); }

  function drawMoonpath(P) {
    const hy = L.horizonY, wh = L.waterH;
    const q = VF.state.data.settings.quality;
    const gx = L.glowX;
    const calmK = VF.encounters ? 1 - VF.encounters.calm() * 0.85 : 1;
    const chop = (0.55 + VF.weather.wind() * 0.9 + VF.weather.rain() * 0.5) * calmK;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    /* The diffuse wedge, as a stack of horizontally-belled bands. A clipped
       shape would give the path a hard V for an edge; this way every edge of
       it is soft, which is the only way it reads as light on water. */
    const bands = q === 'low' ? 6 : q === 'medium' ? 9 : 11;
    for (let i = 0; i < bands; i++) {
      const k0 = i / bands, k1 = (i + 1) / bands;
      const y0 = hy + Math.pow(k0, 1.30) * wh;
      const y1 = hy + Math.pow(k1, 1.30) * wh;
      if (y0 > H) break;
      const km = (k0 + k1) * 0.5;
      const spread = moonSpread(km) * 1.45;
      const wob = Math.sin(y0 * 0.03 + t * 0.5) * spread * 0.10 * chop;
      const a = (0.30 * P.bright + 0.06) * (1 - Math.pow(km, 1.35) * 0.60);
      if (a <= 0.006) continue;
      const cx = gx + wob;
      const bandG = ctx.createLinearGradient(cx - spread, 0, cx + spread, 0);
      bandG.addColorStop(0, U.rgbToCss(P.glow, 0));
      bandG.addColorStop(0.26, U.rgbToCss(P.glow, a * 0.28));
      bandG.addColorStop(0.50, U.rgbToCss(P.glow, a));
      bandG.addColorStop(0.74, U.rgbToCss(P.glow, a * 0.28));
      bandG.addColorStop(1, U.rgbToCss(P.glow, 0));
      ctx.fillStyle = bandG;
      ctx.fillRect(cx - spread, y0, spread * 2, y1 - y0 + 1.2);
    }

    /* the flecks. Placement is seeded so they stay put and blink rather than
       sliding across the surface, which is what real chop does. */
    const n = q === 'low' ? 44 : q === 'medium' ? 90 : 132;
    const glow = P.glow;
    let bucket = -1;
    for (let i = 0; i < n; i++) {
      const r1 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const r2 = ((Math.sin(i * 78.2331) * 43758.5453) % 1 + 1) % 1;
      const r3 = ((Math.sin(i * 41.1177) * 43758.5453) % 1 + 1) % 1;

      const k = Math.pow(r1, 0.85);
      const y = hy + Math.pow(k, 1.30) * wh;
      if (y > H + 2) continue;
      const spread = moonSpread(k);
      // clustered toward the centre line, the way specular scatter falls off
      const off = (r2 * 2 - 1);
      const lateral = off * Math.abs(off) * spread;
      const drift = (Math.sin(y * 0.045 + t * (0.9 + r3 * 0.7)) * spread * 0.24 +
                     Math.sin(y * 0.018 - t * 0.55) * spread * 0.16) * chop;
      const x = gx + lateral + drift;

      // each fleck has its own blink, and the near ones are longer and lazier
      const sp = 1.1 + r3 * 3.2;
      let tw = Math.sin(t * sp + r2 * 12.0) * 0.5 + 0.5;
      tw = tw * tw * (1 - Math.abs(off) * 0.55);
      const a = tw * (0.42 * P.bright + 0.09) * (1 - Math.pow(k, 2.1) * 0.55) * calmK;
      if (a <= 0.012) continue;

      const wdt = U.lerp(1.6, 30, Math.pow(k, 1.25)) * (0.55 + r3 * 0.9);
      const hgt = Math.max(0.7, U.lerp(0.7, 2.6, k));
      // four alpha buckets keep the fill-style churn down
      const b = a < 0.08 ? 0 : a < 0.16 ? 1 : a < 0.26 ? 2 : 3;
      if (b !== bucket) {
        bucket = b;
        ctx.fillStyle = U.rgbToCss(glow, [0.08, 0.18, 0.30, 0.46][b]);
      }
      ctx.fillRect(x - wdt * 0.5, y, wdt, hgt);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* Broad, slow bands of sheen. The wave lines give the surface its texture;
     this gives it a body of water underneath, moving on a much longer period. */
  function drawSwell(P, q) {
    if (q === 'low') return;
    const hy = L.horizonY, wh = L.waterH;
    const calm = VF.encounters ? VF.encounters.calm() : 0;
    const n = q === 'medium' ? 2 : 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const ph = i * 2.399;
      const k = 0.34 + i * 0.15;
      const y = hy + Math.pow(k, 1.30) * wh + Math.sin(t * 0.20 + ph) * wh * 0.045;
      const h = wh * (0.055 + i * 0.018);
      const a = (0.055 * P.bright + 0.014) * (0.55 + 0.45 * Math.sin(t * 0.28 + ph)) * (1 - calm * 0.5);
      if (a <= 0.004) continue;
      const g = ctx.createLinearGradient(0, y - h, 0, y + h);
      g.addColorStop(0, U.rgbToCss(P.glow, 0));
      g.addColorStop(0.5, U.rgbToCss(P.glow, a));
      g.addColorStop(1, U.rgbToCss(P.glow, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, y - h, W, h * 2);
    }
    ctx.restore();
  }

  /* One shared height field. Sampling every line from it is what makes the
     surface coherent — the lines behave like contours of a single moving
     sheet of water rather than a stack of independent wiggles. */
  function field(x, y, sp) {
    return Math.sin(x * 0.0042 + y * 0.0060 + t * sp * 0.85)
         + Math.sin(x * 0.0113 - y * 0.0038 + t * sp * 1.45) * 0.44
         + Math.sin(x * 0.0271 + y * 0.0021 + t * sp * 2.10) * 0.17;
  }

  /* The surface. Lines are spaced and shaped irregularly and each carries its
     own phase and amplitude, so it reads as swell rather than as scanlines. */
  function drawWaveLines(P, q) {
    const hy = L.horizonY, wh = L.waterH;
    const lines = q === 'low' ? 15 : q === 'medium' ? 24 : 32;
    const seg = q === 'low' ? 11 : 18;
    const calm = Math.max(VF.encounters ? VF.encounters.calm() : 0,
                          VF.conditions ? VF.conditions.flag('calm') * 0.8 : 0,
                          VF.wrong ? VF.wrong.intensity() : 0);
    const wind = (0.35 + VF.weather.wind() * 1.3) * (1 - calm * 0.88);
    const chop = (1 + VF.weather.rain() * 0.9 + VF.weather.wind() * 0.8) * (1 - calm * 0.92);

    const crest = U.mixRgb(P.waterTop, P.glow, 0.80);
    const trough = U.mixRgb(P.waterBot, [0, 0, 0], 0.35);

    const crestCss = U.rgbToCss(crest);
    const troughCss = U.rgbToCss(trough);

    for (let i = 0; i < lines; i++) {
      // uneven spacing: each band is nudged by a fixed per-line offset
      const jitter = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      const k = U.clamp((i + 0.35 + jitter * 0.55) / lines, 0, 1);
      const y = hy + Math.pow(k, 1.42) * wh;
      if (y > H + 4) continue;

      const amp = U.lerp(0.4, 13, Math.pow(k, 1.55)) * chop;
      const ph = i * 2.399;                       // golden-angle phase spread
      const speed = wind * (0.45 + k * 1.1);

      // brighter bands catch the light, darker ones read as troughs
      const bright = 0.5 + 0.5 * Math.sin(i * 1.7 + t * 0.35);
      const col = bright > 0.55 ? crest : trough;
      const a = U.lerp(0.08, 0.46, Math.pow(k, 1.10)) * (0.35 + P.bright * 0.85) *
                (1 - calm * 0.5) * (bright > 0.55 ? bright : 0.55);
      if (a <= 0.012) continue;

      ctx.globalAlpha = a;
      ctx.strokeStyle = bright > 0.55 ? crestCss : troughCss;
      // near swell is heavier than the compressed bands out by the horizon
      ctx.lineWidth = U.lerp(0.85, 1.5, Math.pow(k, 2.2));
      ctx.beginPath();
      for (let j = 0; j <= seg; j++) {
        const x = (j / seg) * (W + 60) - 30;
        // every line samples the same field, so neighbours rise and fall
        // together and the surface reads as swell instead of as loose squiggles
        const yy = y + field(x, y, speed) * amp
          + Math.sin(x * 0.019 + t * speed * 1.9 + ph * 1.7) * amp * 0.14;
        if (j === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // a handful of bright glints where the light lands on a crest
    if (q !== 'low') {
      ctx.globalCompositeOperation = 'lighter';
      const n = 9;
      for (let i = 0; i < n; i++) {
        const jitter = ((Math.sin(i * 78.233) * 43758.5453) % 1 + 1) % 1;
        const k = 0.12 + jitter * 0.8;
        const y = hy + Math.pow(k, 1.4) * wh;
        const drift = (t * (6 + jitter * 14)) % (W + 200) - 100;
        const x = ((jitter * W * 1.7) + drift) % (W + 120) - 60;
        const tw = 0.5 + 0.5 * Math.sin(t * (1.4 + jitter * 2.6) + i);
        const ga = 0.19 * tw * tw * (0.3 + P.bright) * (1 - calm * 0.7);
        if (ga <= 0.012) continue;
        const gw = U.lerp(5, 26, k), gh = U.lerp(0.6, 1.7, k);
        ctx.globalAlpha = ga;
        // a soft halo with a hard core reads as light on water, not as a dash
        const hg = ctx.createRadialGradient(x, y, 0, x, y, gw);
        hg.addColorStop(0, U.rgbToCss(P.glow, 0.9));
        hg.addColorStop(0.35, U.rgbToCss(P.glow, 0.30));
        hg.addColorStop(1, U.rgbToCss(P.glow, 0));
        ctx.fillStyle = hg;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(1, gh / gw);
        ctx.beginPath();
        ctx.arc(0, 0, gw, 0, TAU);
        ctx.fill();
        ctx.restore();
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

  /* The shadow of something rare crossing the water toward the hook, in the
     seconds before it takes it. Nothing below the void tier gets one: the
     whole value of it is that seeing one means something. */
  function drawApproach() {
    const A = VF.fishing.S.approach;
    if (!A) return;
    const b = L.bobber;
    if (!b.visible) return;
    const wh = L.waterH;
    const k = U.clamp(A.t / Math.max(0.5, A.dur), 0, 1);
    const e = U.smoothstep(k);

    // out of the deep water on the far side, in toward the line
    const fromX = W * 1.06, fromY = L.horizonY + wh * 0.10;
    const x = U.lerp(fromX, b.x, e);
    const y = U.lerp(fromY, b.y + wh * 0.10, e * e);
    const sc = scaleAt(y) * U.lerp(0.55, 2.35, e);
    // it fades up out of nothing and thins again as it reaches the hook
    const a = U.clamp(Math.sin(Math.min(1, k * 1.12) * Math.PI) * 1.45, 0, 1);
    if (a <= 0.01) return;

    const col = VF.rarities.colorAt(A.rarity, t);
    const wob = Math.sin(t * 1.7) * wh * 0.012 * (1 - e * 0.6);

    ctx.save();
    // the shape itself
    ctx.globalAlpha = a * 0.82;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y + wob, W * 0.085 * sc, wh * 0.030 * sc,
                Math.sin(t * 0.5) * 0.10 - (1 - e) * 0.18, 0, TAU);
    ctx.fill();
    // a second, smaller mass behind it, so it reads as long rather than round
    ctx.globalAlpha = a * 0.5;
    ctx.beginPath();
    ctx.ellipse(x + W * 0.070 * sc, y + wob * 0.6, W * 0.040 * sc, wh * 0.017 * sc,
                Math.sin(t * 0.5 + 1) * 0.14, 0, TAU);
    ctx.fill();

    // and the colour of whatever tier it is, bleeding up through the water
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * (0.22 + 0.16 * Math.sin(t * 2.4));
    const g = ctx.createRadialGradient(x, y + wob, 0, x, y + wob, W * 0.20 * sc);
    g.addColorStop(0, U.rgbToCss(col, 0.55));
    g.addColorStop(0.45, U.rgbToCss(col, 0.13));
    g.addColorStop(1, U.rgbToCss(col, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - W * 0.20 * sc, y - W * 0.20 * sc, W * 0.40 * sc, W * 0.40 * sc);
    ctx.restore();
  }

  /* ------------------------------------------------------------ the shoal

     The water had nothing in it. It was a surface with lines on it, and
     whatever you were fishing for existed only at the moment it took the hook.

     These are the species that actually live at this spot, cruising below the
     surface at depth. Which is the point of drawing them from the real pool
     rather than inventing a generic fish shape: the water shows you what is in
     it, so a strange silhouette going past at the Cradle is a real thing you
     could catch, and the shoal at the shore is minnows because the shore has
     minnows in it.

     Perspective does the work. Depth 0 is up at the horizon — small, faint,
     slow, barely a mark — and depth 1 is close to the near bank, large and
     dark and quick. Nothing here is a particle system; it is a dozen shapes
     with a sine on them, which is all a fish seen through water is. */

  const shoal = [];
  let shoalKey = '';

  /* Every one of these is a full procedural species — scales, fins, gradients,
     the lot — and drawing fourteen of them a frame cost seven milliseconds,
     which is most of a frame for something nobody is looking straight at. They
     are baked to small sprites instead, one per species per size bucket, and
     blitted. Buckets are coarse because at this size and this alpha nobody can
     tell the difference between a fish drawn at 19 pixels and one drawn at 20. */
  const finCache = Object.create(null);
  const FIN_PAD = 1.7;   // room for fins and tail beyond the nominal size

  function finSprite(fish, size) {
    const bucket = Math.max(3, Math.round(size / 3) * 3);
    const key = fish.id + '@' + bucket;
    const hit = finCache[key];
    if (hit) return hit;
    const S = Math.ceil(bucket * FIN_PAD * 2);
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    // baked at full strength; the alpha goes on at blit time
    try { VF.fishArt.drawSilhouette(g, fish, bucket, 1); } catch (e) { /* leave it blank */ }
    c.__glRev = key;      // baked once per species per size bucket, never repainted
    const sp = { canvas: c, half: S / 2, bucket: bucket };
    finCache[key] = sp;
    return sp;
  }

  function seedShoal() {
    const loc = VF.locations.current();
    const q = VF.state.data.settings.quality;
    const key = loc.id + ':' + q;
    if (shoalKey === key && shoal.length) return;
    shoalKey = key;
    shoal.length = 0;
    for (const k in finCache) delete finCache[k];

    /* The species that are native here, cheapest tiers first — a shoal is
       made of common things, and a Void fish drifting past every ten seconds
       would spend the mystery the game is built on. */
    const pool = (VF.fish.knownList ? VF.fish.knownList() : VF.fish.list).filter(function (f) {
      return f.locs && f.locs.indexOf(loc.id) >= 0 && VF.rarities.rank(f.rarity) <= 2;
    });
    if (!pool.length) return;

    const n = q === 'low' ? 5 : q === 'medium' ? 9 : 14;
    const rnd = VF.rng.make(0x5F0A1 ^ VF.locations.index(loc.id) * 5471);
    for (let i = 0; i < n; i++) {
      shoal.push({
        f: pool[Math.floor(rnd() * pool.length)],
        x: rnd(),
        // biased shallow: most of what you can see is near the surface
        depth: Math.pow(rnd(), 1.5),
        dir: rnd() < 0.5 ? -1 : 1,
        speed: 0.010 + rnd() * 0.030,
        size: 0.7 + rnd() * 0.7,
        wob: rnd() * TAU,
        wobSp: 0.6 + rnd() * 1.1,
        // one in a few drifts up toward the surface and back down again
        rise: rnd() < 0.35 ? 0.25 + rnd() * 0.5 : 0,
        riseSp: 0.05 + rnd() * 0.12,
        risePh: rnd() * TAU
      });
    }
  }

  function drawShoal(P, q) {
    if (!shoal.length) return;
    /* They are the first thing to go when the water stops being water, and
       they are not down there at all once the void has taken the place. */
    const k = U.clamp((0.80 - P.void) / 0.40, 0, 1) *
              (VF.encounters ? 1 - VF.encounters.calm() * 0.9 : 1);
    if (k <= 0.02) return;

    const hy = L.horizonY, wh = L.waterH;
    ctx.save();
    for (let i = 0; i < shoal.length; i++) {
      const s = shoal[i];
      s.x += s.speed * s.dir * VF.state.rt.dt;
      if (s.x > 1.15) s.x = -0.15; else if (s.x < -0.15) s.x = 1.15;

      // where it is, right now, including whatever rising it is doing
      const rise = s.rise ? s.rise * (0.5 + 0.5 * Math.sin(t * s.riseSp + s.risePh)) : 0;
      const d = U.clamp(s.depth - rise * s.depth, 0.02, 1);

      /* Perspective. The near bank is the bottom of the frame, so depth maps
         through a curve — the same one the water gradient uses — and size and
         contrast follow it. */
      const y = hy + Math.pow(d, 1.28) * wh;
      const wobble = Math.sin(t * s.wobSp + s.wob) * wh * 0.006 * (0.3 + d);
      const x = s.x * W;
      const size = U.lerp(4, 26, Math.pow(d, 1.15)) * s.size *
                   U.clamp(Math.min(W, H) / 760, 0.6, 1.5);

      /* Deep water swallows contrast before it swallows anything else, so a
         far fish is barely a smudge and a near one is a shape. Kept low on
         purpose: at full strength these stop being things seen THROUGH water
         and become black cut-outs sitting on top of it, which is worse than
         having nothing down there at all. */
      const a = k * U.lerp(0.085, 0.26, Math.pow(d, 0.85));
      if (a <= 0.012 || size < 2) continue;

      const sp = finSprite(s.f, size);
      const k2 = size / sp.bucket;          // the bit the bucket rounded off
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x, y + wobble);
      if (s.dir < 0) ctx.scale(-1, 1);
      // a fish seen from above and to the side is foreshortened
      ctx.scale(k2, k2 * 0.82);
      ctx.drawImage(sp.canvas, -sp.half, -sp.half);
      ctx.restore();
    }
    ctx.restore();
  }

  /* ---------------------------------------------------- light on the water

     The surface had bands on it and nothing else. Bands say "there are waves";
     they do not say "this is water", because what actually tells you a thing
     is water at night is specular — individual facets catching the light and
     losing it again, hard and quick, thousands of them, concentrated under
     whatever is bright and thinning out to nothing away from it.

     So: a field of points that flash rather than pulse. The flash is a sine
     raised to a high power, which spends most of its time near zero and snaps
     to full for an instant — a wave facet is either pointing at you or it is
     not. Brightness falls off away from the light with distance, and the
     points crowd toward the horizon because perspective crowds everything
     toward the horizon.

     Nothing here is baked. It is a few hundred small fills and it has to move
     every frame, which is the whole point of it. */

  const glints = [];
  let glintKey = '';

  function seedGlints() {
    const q = VF.state.data.settings.quality;
    const key = q + ':' + Math.round(W) + 'x' + Math.round(H);
    if (glintKey === key && glints.length) return;
    glintKey = key;
    glints.length = 0;
    const n = q === 'low' ? 70 : q === 'medium' ? 180 : 340;
    const rnd = VF.rng.make(0x91177);
    for (let i = 0; i < n; i++) {
      glints.push({
        u: rnd(),
        // crowded toward the horizon, the way a receding plane is
        d: Math.pow(rnd(), 2.1),
        ph: rnd() * TAU,
        sp: 0.7 + rnd() * 2.6,
        // how sharp this facet is: some wink, some hold for a moment
        sharp: 5 + rnd() * 16,
        size: 0.6 + rnd() * 1.5,
        drift: (rnd() * 2 - 1) * 0.006
      });
    }
  }

  function drawSurface(P, q) {
    if (!glints.length) return;
    const hy = L.horizonY, wh = L.waterH;
    // dead calm means a mirror, and a mirror has no facets to catch anything
    const calm = Math.max(VF.encounters ? VF.encounters.calm() : 0,
                          VF.conditions ? VF.conditions.flag('calm') * 0.85 : 0);
    const chop = U.clamp(0.30 + VF.weather.wind() * 0.9 + VF.weather.rain() * 0.6, 0, 1.6) *
                 (1 - calm * 0.95);
    // and the void takes the light long before it takes the water
    const k = U.clamp((0.92 - P.void) / 0.35, 0, 1) * (0.15 + P.bright * 1.0) * chop;
    if (k <= 0.02) return;

    const gx = L.glowX;
    const spread = W * 0.34;          // how far from the light the path reaches
    const col = U.mixRgb(P.glow, [255, 255, 255], 0.55);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < glints.length; i++) {
      const s = glints[i];
      s.u += s.drift * VF.state.rt.dt;
      if (s.u > 1.05) s.u -= 1.1; else if (s.u < -0.05) s.u += 1.1;

      const y = hy + Math.pow(s.d, 1.42) * wh;
      if (y > H + 2) continue;
      const x = s.u * W;

      /* Away from the light there is nothing to catch. A gaussian rather than
         a cutoff, so the glade has no edge — the moment it has an edge it
         stops being light on water and becomes a shape drawn on water. */
      const dx = (x - gx) / spread;
      const near = Math.exp(-dx * dx * 0.9);
      if (near < 0.012) continue;

      /* The flash. sin^n spends almost all of its time dark and snaps to full
         for an instant, which is what a facet turning through the light
         actually does; a smooth pulse reads as a firefly. */
      const w = Math.sin(t * s.sp + s.ph) * 0.5 + 0.5;
      const flash = Math.pow(w, s.sharp);
      if (flash < 0.02) continue;

      const a = k * near * flash * U.lerp(0.5, 1, s.d);
      const r = s.size * U.lerp(0.5, 2.3, s.d) * U.clamp(Math.min(W, H) / 800, 0.6, 1.5);

      ctx.fillStyle = U.rgbToCss(col, a * 0.5);
      ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, TAU); ctx.fill();
      ctx.fillStyle = U.rgbToCss([255, 255, 255], a);
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();

      // the brightest ones streak along the wave they are sitting on
      if (q === 'high' && a > 0.35) {
        ctx.strokeStyle = U.rgbToCss(col, a * 0.5);
        ctx.lineWidth = Math.max(0.4, r * 0.6);
        ctx.beginPath();
        ctx.moveTo(x - r * 3.4, y); ctx.lineTo(x + r * 3.4, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* Mist sitting on the water. Very little of it, very faint, moving slowly —
     it is there to stop the surface meeting the air along a clean line, which
     is the last thing on the horizon that still looked drawn. */
  function drawSurfaceMist(P, q) {
    if (q === 'low') return;
    const amt = U.clamp(P.fogAmt * 0.8 + VF.weather.fog() * 0.7, 0, 1);
    if (amt < 0.05) return;
    const hy = L.horizonY, wh = L.waterH;
    const col = U.mixRgb(P.fog, P.glow, 0.22);
    ctx.save();
    const n = q === 'high' ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const ph = i * 2.399;
      const d = 0.04 + (i / n) * 0.30;
      const y = hy + Math.pow(d, 1.4) * wh;
      const x = ((t * (0.008 + i * 0.004) + i * 0.37) % 1.3 - 0.15) * W;
      const rw = W * (0.16 + (i % 3) * 0.09);
      const rh = wh * 0.055 * (1 + d * 2);
      const a = amt * 0.055 * (0.4 + P.bright * 0.8) * (0.6 + 0.4 * Math.sin(t * 0.2 + ph));
      const gr = ctx.createRadialGradient(x, y, 0, x, y, rw);
      gr.addColorStop(0, U.rgbToCss(col, a));
      gr.addColorStop(1, U.rgbToCss(col, 0));
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, y, rw, rh, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawUnderwater(P) {
    const hy = L.horizonY, wh = L.waterH;
    drawApproach();
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
    const lineCfg = VF.cosmetics.cfg('line');
    const lineRgb = lineCfg.col ? U.hexToRgb(lineCfg.col) : U.mixRgb(P.glow, [255, 255, 255], 0.4);
    const lineA = (lineCfg.a === undefined ? 0.30 : lineCfg.a * 0.7) + tension * 0.35 + shake * 0.3;
    if (lineCfg.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = U.rgbToCss(lineRgb, 0.22);
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y + b.bob);
      ctx.stroke();
      ctx.restore();
    }
    const pulse = lineCfg.pulse ? 0.75 + 0.25 * Math.sin(t * 4) : 1;
    ctx.strokeStyle = U.rgbToCss(lineRgb, lineA * pulse);
    ctx.lineWidth = 1 + shake * 0.8;
    ctx.beginPath();
    ctx.moveTo(tip.x, tip.y);
    ctx.quadraticCurveTo(mx + (shake ? Math.sin(t * 47) * shake * 4 : 0), my, b.x, b.y + b.bob);
    ctx.stroke();

    // The fish itself, rising as it comes in.
    if (S.state === 'reeling' && S.fight) drawHookedFish(S.fight, b);

    const by = b.y + b.bob;
    const r = 5.5 * b.scale;

    // bobber shadow on the water — where there is water for it to be on
    if (P.void < 0.9) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(b.x, by + r * 0.9, r * 1.5, r * 0.45, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }

    const bc = VF.cosmetics.cfg('bobber');
    const cy2 = by - r * 0.3;
    if (bc.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(b.x, cy2, 0, b.x, cy2, r * 5);
      g.addColorStop(0, U.rgbToCss(U.hexToRgb(bc.bot || '#ffd060'), 0.5));
      g.addColorStop(1, U.rgbToCss(U.hexToRgb(bc.bot || '#ffd060'), 0));
      ctx.fillStyle = g;
      ctx.fillRect(b.x - r * 5, cy2 - r * 5, r * 10, r * 10);
      ctx.restore();
    }
    if (bc.hole) {
      ctx.fillStyle = '#05030a';
      ctx.beginPath(); ctx.arc(b.x, cy2, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = U.rgbToCss(U.hexToRgb(bc.bot || '#1a1030'), 0.9);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, cy2, r, 0, TAU); ctx.stroke();
    } else {
      ctx.fillStyle = bc.top || '#c8402f';
      ctx.beginPath(); ctx.arc(b.x, cy2, r, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = bc.bot || '#e8e4dc';
      ctx.beginPath(); ctx.arc(b.x, cy2, r, 0, Math.PI); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(b.x, cy2, r, 0, TAU); ctx.stroke();
    }
    if (bc.lamp) {
      ctx.fillStyle = '#ffe8a0';
      ctx.beginPath(); ctx.arc(b.x, cy2 - r * 0.2, r * 0.42, 0, TAU); ctx.fill();
    }
    if (bc.eye) {
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath(); ctx.arc(b.x, cy2, r * 0.44, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a0810';
      ctx.beginPath(); ctx.arc(b.x + Math.sin(t * 0.8) * r * 0.12, cy2, r * 0.2, 0, TAU); ctx.fill();
    }
    if (bc.star) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#fff6d0';
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(b.x, cy2, r * 2.6, r * 0.16, t * 0.5 + i * Math.PI / 2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = U.rgbToCss(P.glow, 0.7);
    ctx.fillRect(b.x - r * 0.18, by - r * 1.5, r * 0.36, r * 0.7);
  }

  /* What a fish does after it has got off. Up top it turns and goes: one hard
     kick sideways, down and away under the surface, with a boil left behind on
     the water. At the bottom there is no water to swim in and nothing to swim
     away through, so it does the only other thing available and falls —
     straight down, turning over, getting smaller until the dark has it. */
  let departure = null;

  function beginDeparture(c) {
    if (!c) return;
    const b = L.bobber;
    const vd = VF.palette.P.void || 0;
    const falls = vd > 0.9;
    departure = {
      c: c, t: 0, dur: falls ? 2.05 : 1.15, falls: falls,
      x: b.x, y: b.y + b.bob, scale: b.scale,
      /* Away from the ledge, whichever side of it the hook is on. A fish that
         drops straight down from where the fight ended goes behind the thing
         you are sitting on and is never seen again, which is not the same
         picture as watching it go. */
      dir: b.x >= L.seatX ? 1 : -1,
      spin: (VF.rng.g() - 0.5) * 1.6,
      rank: VF.rarities.rank(c.rarity)
    };
    if (!falls) {
      VF.fx.ripple(b.x, b.y + b.bob, L.w * 0.055 * b.scale, 1.5);
      VF.fx.ripple(b.x, b.y + b.bob, L.w * 0.028 * b.scale, 1.0);
    }
  }

  function drawDeparture(P) {
    const d = departure;
    if (!d) return;
    const k = U.clamp(d.t / d.dur, 0, 1);
    if (k >= 1) { departure = null; return; }

    const base = Math.min(W, H) * 0.055 * d.scale * 1.4 * (0.7 + d.rank * 0.09);
    let x, y, rot, size, a;

    let near;
    if (d.falls) {
      /* Falling, not sinking. It leaves the hook already moving and picks up
         speed, and it keeps its colour on the way down instead of going
         straight to a silhouette — against a ground with nothing in it, a dark
         shape on dark is not a fish falling, it is nothing happening. */
      const g = k * 0.30 + k * k * 0.70;
      // out into the open as it goes, and turning over as it falls
      x = d.x + d.dir * (base * (0.35 + k * 2.4) + Math.sin(k * 3.4) * base * 0.22);
      y = d.y + g * (H - d.y + base * 3.0);
      rot = d.spin * k * 2.4 + 0.5;
      size = base * (1 - k * 0.66);
      a = U.clamp((1 - k) * 1.35, 0, 1) * 0.95;
      near = 0.85 * (1 - k);
    } else {
      /* Away and down, the tail doing the work: fast at first, then the water
         between you and it does the rest. */
      const e = U.easeOutCubic(k);
      x = d.x + d.dir * e * W * 0.30;
      y = d.y + e * L.waterH * 0.30;
      rot = d.dir * 0.34 + Math.sin(d.t * 22) * 0.16 * (1 - k);
      size = base * (1 - k * 0.55);
      a = U.clamp((1 - k) * 1.5, 0, 1) * 0.9;
      near = 0.55 * (1 - k);
    }

    ctx.save();
    /* Falling into a place with no light in it, a dark fish on a dark ground is
       nothing happening. It takes its own halo down with it — which is also the
       only thing down there that ever lights anything. */
    if (d.falls) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(x, y, 0, x, y, size * 2.1);
      gr.addColorStop(0, U.rgbToCss(P.glow, 0.34 * a));
      gr.addColorStop(0.45, U.rgbToCss(P.glow, 0.13 * a));
      gr.addColorStop(1, U.rgbToCss(P.glow, 0));
      ctx.fillStyle = gr;
      ctx.fillRect(x - size * 2.1, y - size * 2.1, size * 4.2, size * 4.2);
      ctx.restore();
    }
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (d.dir < 0) ctx.scale(-1, 1);
    if (d.c.kind === 'treasure') {
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.ellipse(0, 0, size * 0.85, size * 0.62, 0, 0, TAU); ctx.fill();
    } else if (d.c.fish && d.c.fish.id) {
      VF.fishArt.drawSilhouette(ctx, d.c.fish, size, 0.95, near);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawHookedFish(f, b) {
    const c = f.c;
    const k = 1 - U.clamp(f.distance, 0, 1);
    if (k < 0.12) return;
    const sc = scaleAt(b.y);
    const rank = VF.rarities.rank(c.rarity);
    const size = Math.min(W, H) * 0.055 * sc * (0.5 + k) * (0.7 + rank * 0.09);
    const y = b.y + 14 * sc + Math.sin(t * 4) * 3 * f.surge;
    const x = b.x + Math.sin(t * 2.3) * 8 * sc * (0.4 + f.surge);
    ctx.save();
    ctx.globalAlpha = U.clamp((k - 0.1) * 1.4, 0, 1) * 0.85;
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 3.4) * 0.22 * (0.5 + f.surge));
    if (c.kind === 'treasure') {
      // an object has no species art, so it comes up as a plain dark mass
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.85, size * 0.62, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha *= 0.55;
      ctx.strokeStyle = c.treasure.color;
      ctx.lineWidth = Math.max(1, size * 0.07);
      ctx.stroke();
    } else if (c.fish && c.fish.id) {
      // it comes out of the dark as it comes up
      VF.fishArt.drawSilhouette(ctx, c.fish, size, k * 0.9, Math.pow(k, 1.5));
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------- foreground */

  /* Where the top of the ledge is at a given x.

     The maths moved to js/render/ground.js so that a dock, a boatyard floor
     and the boards of a room can be grounds too — the numbers below are the
     ledge's own and are unchanged, so this is the same curve it always was.
     Rebuilt only when the layout moves, because a figure asks for this once
     per frame and inverting five quadratics per call would be silly. */
  let ledge = null, ledgeKey = '';

  function ledgeCurve() {
    const fh = L.figureH, seatX = L.seatX, lipY = L.seatY + fh * 0.16;
    const key = fh + ':' + seatX + ':' + lipY + ':' + W;
    if (ledge && ledgeKey === key) return ledge;
    const midX = seatX + fh * 0.10;
    ledgeKey = key;
    ledge = VF.ground.curve([
      [-12,               lipY - fh * 0.10],
      [W * 0.07,          lipY - fh * 0.16],
      [midX,              lipY - fh * 0.03],
      [seatX + fh * 0.62, lipY + fh * 0.10],
      [seatX + fh * 0.98, lipY + fh * 0.52]
    ]);
    return ledge;
  }

  function groundY(x) { return ledgeCurve().yAt(x); }

  /* Where the two of you end up standing. The angler steps off the seat and
     turns; the visitor comes in along the shore from the left. */
  function visitSpots() {
    const fh = L.figureH, seatX = L.seatX;
    return {
      anglerFrom: seatX,
      anglerTo: seatX + fh * 0.04,
      npcFrom: -fh * 0.55,
      npcTo: seatX - fh * 0.60
    };
  }

  function drawForeground(P) {
    const fh = L.figureH;
    const seatX = L.seatX, seatY = L.seatY;
    const rimA = 0.13 + P.bright * 0.16;
    const rim = U.rgbToCss(P.glow, rimA);
    const dark = '#03050a';

    /* --- what you are sitting on ---
       On the shore this is a shore: it runs off the left of the frame and down
       past the bottom of it, because there is more of it in both directions.
       The further down the map you go the less of it there is, until the last
       water, where it is a slab with nothing under it and nothing beside it —
       which is the whole of what that place is. The top edge is sampled off
       groundY rather than drawn as its own curve, so the ledge and the thing
       standing on it can never disagree about where the ground is. */
    const lipY = seatY + fh * 0.16;
    const slab = U.clamp((P.void - 0.5) / 0.5, 0, 1);
    const xL = U.lerp(-12, seatX - fh * 0.72, slab);
    const endX = seatX + fh * 0.98;
    const keel = U.lerp(H + 12, lipY + fh * (0.48 + 0.34 * slab), slab);

    const top = [];
    const STEPS = 9;
    for (let i = 0; i <= STEPS; i++) {
      const x = U.lerp(xL, endX, i / STEPS);
      top.push([x, groundY(x)]);
    }

    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
    // the near end, then the underside back to where it started
    ctx.lineTo(U.lerp(seatX + fh * 1.3, endX + fh * 0.16, slab),
               U.lerp(H + 12, keel - fh * 0.34, slab));
    ctx.lineTo(U.lerp(seatX + fh * 1.3, endX - fh * 0.30, slab), keel);
    ctx.lineTo(U.lerp(-12, xL + fh * 0.46, slab), U.lerp(H + 12, keel - fh * 0.22, slab));
    ctx.lineTo(xL, U.lerp(H + 12, top[0][1] + fh * 0.30, slab));
    ctx.closePath();
    // a hair above pure black so the silhouette separates from the deep water
    const lg = ctx.createLinearGradient(0, lipY - fh * 0.2, 0, U.lerp(H, keel, slab));
    lg.addColorStop(0, U.rgbToCss(U.mixRgb([8, 12, 19], [16, 12, 30], slab)));
    lg.addColorStop(0.55, U.rgbToCss(U.mixRgb([4, 6, 12], [8, 5, 18], slab)));
    lg.addColorStop(1, U.rgbToCss(U.mixRgb([1, 2, 4], [2, 1, 6], slab), U.lerp(1, 0.5, slab)));
    ctx.fillStyle = lg;
    ctx.fill();

    /* Under a slab there is nothing to catch light off, so the underside gets
       the faintest edge there is — enough that the thing you are sitting on
       has a bottom, not enough to make it look like it is standing on
       something. */
    if (slab > 0.02) {
      ctx.strokeStyle = U.rgbToCss(P.glow, (0.05 + P.bright * 0.05) * slab);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(top[top.length - 1][0], top[top.length - 1][1]);
      ctx.lineTo(U.lerp(seatX + fh * 1.3, endX + fh * 0.16, slab),
                 U.lerp(H + 12, keel - fh * 0.34, slab));
      ctx.lineTo(U.lerp(seatX + fh * 1.3, endX - fh * 0.30, slab), keel);
      ctx.lineTo(U.lerp(-12, xL + fh * 0.46, slab), U.lerp(H + 12, keel - fh * 0.22, slab));
      ctx.lineTo(xL, U.lerp(H + 12, top[0][1] + fh * 0.30, slab));
      ctx.stroke();
    }

    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(top[0][0], top[0][1]);
    for (let i = 1; i < top.length; i++) ctx.lineTo(top[i][0], top[i][1]);
    ctx.stroke();

    /* The boat, moored off the end of the ledge.

       It is alongside rather than underneath on purpose. Every location in
       this game is a place to sit at the edge of water — that composition is
       what the nine zones ARE — and putting the angler in a hull would have
       rewritten all nine of them to add one. Moored, it is on screen in every
       frame, it carries the paint and the trim and whatever is on its deck,
       and it reads correctly: that is how you got here and how you leave. */
    drawBoat(P, endX, lipY);

    if (VF.visit && VF.visit.active()) { L.merchant = null; drawVisit(P, rim); return; }

    ctx.save();
    ctx.translate(seatX, seatY);
    const look = L.bobber.visible ? L.bobber : L.castTarget;
    VF.anglerArt.draw(ctx, VF.cosmetics.cfg('outfit'), fh, t, {
      mode: 'sit',
      rim: rim,
      hand: { x: L.rodHand.x - seatX, y: L.rodHand.y - seatY },
      rodAngle: rodState.angle + rodState.sway,
      aim: { x: look.x - seatX, y: look.y - seatY },
      handOver: true
    });
    ctx.restore();
    drawRod(P);
    // the hand closes over the grip, so it goes on after the rod
    VF.anglerArt.drawHand(ctx, VF.cosmetics.cfg('outfit'), fh, L.rodHand,
                          rodState.angle + rodState.sway);

    drawMerchant(P, rim);
  }

  function drawBoat(P, endX, lipY) {
    if (!VF.boat || !VF.boatArt || !VF.boat.afloat()) return;
    const fh = L.figureH;
    /* Moored out rather than alongside the camera. It sits at the depth the
       perspective ramp calls two thirds of the way out, and takes that
       depth's scale, so it is unmistakably a boat and unmistakably not the
       subject of the shot — the subject is the water. */
    const by = L.horizonY + L.waterH * 0.42;
    const sc = scaleAt(by);
    const len = fh * 0.66 * sc;
    const bx = Math.max(endX + len * 0.80, W * 0.52);
    const roll = Math.sin(t * 0.7) * 0.030 + Math.sin(t * 1.9) * 0.010;
    const lift = Math.sin(t * 0.9 + 1) * fh * 0.010 * sc;
    const light = { bright: P.bright, tint: P.waterTop, k: 0.30 + P.fogAmt * 0.35 };

    ctx.save();
    // the mooring line back to the ledge
    ctx.strokeStyle = U.rgbToCss(P.glow, 0.13);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(endX - fh * 0.10, lipY);
    ctx.quadraticCurveTo((endX + bx) * 0.5, by + fh * 0.16,
                         bx - len * 0.46, by + lift - len * 0.06);
    ctx.stroke();

    // and its reflection, before the boat, so the boat sits on top of it
    ctx.save();
    ctx.globalAlpha = 0.20 * (1 - P.void * 0.7);
    ctx.translate(bx, by + lift + len * 0.09);
    ctx.scale(1, -0.55);
    ctx.rotate(roll);
    VF.boatArt.drawMine(ctx, len, { time: t, light: light });
    ctx.restore();

    ctx.translate(bx, by + lift);
    ctx.rotate(roll);
    VF.boatArt.drawMine(ctx, len, { time: t, light: light });
    ctx.restore();

    // the water it is displacing
    if (Math.sin(t * 0.7) > 0.985) VF.fx.ripple(bx, by + len * 0.08, len * 0.55, 2.2);
  }

  /* The wanderer stands a little up the shore with a case at his side and the
     time he has left over his head. He is drawn after the angler so he reads
     as further along the ledge, and the rectangle he occupies is kept on L so
     the input layer can tell when he has been clicked. */
  const MERCH_NPC = { id: 'merchant', name: 'The Wanderer', color: '#e8c88a' };

  function drawMerchant(P, rim) {
    L.merchant = null;
    if (!VF.merchant || !VF.merchant.here()) return;
    const fh = L.figureH;
    // up the shore rather than down it: to the right the ledge falls away and
    // he ends up standing off the bottom of the frame
    const x = L.seatX - fh * 0.58;
    const y = groundY(x);
    // a slow arrival, so he does not simply blink into existence
    const inK = U.clamp((VF.merchant.STAY - VF.merchant.leavesIn()) / 1400, 0, 1);
    const outK = U.clamp(VF.merchant.leavesIn() / 4000, 0, 1);
    const a = U.smoothstep(Math.min(inK, outK));
    if (a <= 0.01) return;

    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    VF.npcArt.draw(ctx, MERCH_NPC, fh, t, {
      facing: 1, rim: rim, walk: 0, phase: 0, talking: false
    });
    ctx.restore();

    /* the countdown, on a small plate above him */
    const ms = VF.merchant.leavesIn();
    const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
    const label = mm + ':' + (ss < 10 ? '0' : '') + ss;
    const py = y - fh * 1.08;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '600 ' + Math.round(fh * 0.085) + 'px ui-monospace, monospace';
    const tw = ctx.measureText(label).width;
    const pw = tw + fh * 0.15, ph = fh * 0.145;
    ctx.fillStyle = 'rgba(8,11,17,0.82)';
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - pw / 2, py - ph, pw, ph, ph * 0.32); ctx.fill(); }
    else ctx.fillRect(x - pw / 2, py - ph, pw, ph);
    ctx.strokeStyle = 'rgba(232,200,138,' + (0.45 + 0.25 * Math.sin(t * 2.2)).toFixed(2) + ')';
    ctx.lineWidth = 1.1;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - pw / 2, py - ph, pw, ph, ph * 0.32); ctx.stroke(); }
    ctx.fillStyle = ms < 60000 ? '#ff9a8a' : '#e8c88a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, py - ph * 0.52);
    // and a nudge that he can be clicked
    ctx.font = '500 ' + Math.round(fh * 0.062) + 'px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232,200,138,' + (0.34 + 0.24 * Math.sin(t * 2.2)).toFixed(2) + ')';
    ctx.fillText('click to trade', x, py + fh * 0.075);
    ctx.restore();

    L.merchant = { x: x - fh * 0.34, y: y - fh * 1.30, w: fh * 0.68, h: fh * 1.34 };
  }

  /* Both figures on the near shore. The rod stays behind, propped on the ledge
     where it was put down, because you do not carry a rod to a conversation. */
  function drawVisit(P, rim) {
    const V = VF.visit.S;
    const fh = L.figureH;
    const sp = visitSpots();
    const out = V.phase === 'out';
    const back = V.phase === 'back';
    const k = U.smoothstep(V.k);

    const ax = back ? U.lerp(sp.anglerTo, sp.anglerFrom, k)
                    : out ? U.lerp(sp.anglerFrom, sp.anglerTo, k) : sp.anglerTo;
    const nx = back ? U.lerp(sp.npcTo, sp.npcFrom, k)
                    : out ? U.lerp(sp.npcFrom, sp.npcTo, k) : sp.npcTo;

    drawRestingRod(P);

    // the visitor: walks in facing the way they are going, then turns to you
    if (V.npc) {
      ctx.save();
      ctx.translate(nx, groundY(nx));
      VF.npcArt.draw(ctx, V.npc, fh, t, {
        facing: back ? -1 : 1,
        rim: rim,
        walk: V.walk,
        phase: t * 6.2,
        talking: V.phase === 'talk' && !!VF.visit.line()
      });
      ctx.restore();
    }

    // the angler, standing, facing whoever they came to see
    // the angler does not walk anywhere — they get up off the ledge and turn.
    // The visitor is the one crossing the shore.
    ctx.save();
    ctx.translate(ax, groundY(ax));
    VF.anglerArt.draw(ctx, VF.cosmetics.cfg('outfit'), fh, t, {
      mode: 'stand',
      rim: rim,
      walk: 0,
      phase: 0,
      facing: back ? 1 : -1,
      // look at whoever you came to see
      aim: { x: (nx - ax) * 0.6, y: -fh * 0.55 }
    });
    ctx.restore();
  }

  /* The equipped rod with the player's finish on it. A finish repaints — it
     does not replace what the rod is, so an apex rod keeps its own flourish
     and simply wears the new colours: a Gilt dragon is a gold dragon, not a
     gold rod with no dragon on it. Length and stats are never touched. */
  function paintedRod() {
    const rod = VF.rods.get(VF.state.data.rod);
    const skin = VF.cosmetics.cfg('rodSkin');
    if (!skin || !skin.c1) return rod;
    const paint = Object.assign({}, skin);
    if (rod.art.apex) delete paint.style;
    return { art: Object.assign({}, rod.art, paint, { len: rod.art.len }) };
  }

  /* The rod, left leaning against the ledge at the seat. */
  function drawRestingRod(P) {
    const fh = L.figureH;
    const rod = paintedRod();
    const len = fh * 1.30 * rod.art.len;
    const bx = L.seatX + fh * 0.46, by = L.seatY + fh * 0.22;
    const a = -1.06;
    const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
    VF.rodArt.draw(ctx, rod, {
      bx: bx, by: by,
      cx: (bx + tx) / 2 + fh * 0.02, cy: (by + ty) / 2,
      tx: tx, ty: ty, len: len, angle: a
    }, t, { spin: t * 0.25 });
  }

  /* Rod geometry lives here; the drawing is shared with the shop previews. */
  function drawRod(P) {
    const rod = paintedRod();
    const tip = rodTipPoint();
    const hand = L.rodHand;
    const a = tip.a;
    const S = VF.fishing.S;
    const reeling = S.state === 'reeling' && S.fight && S.fight.reeling;
    /* rodArt sizes its guides, bindings and reel off clamp(len / 300) — an
       absolute pixel count. Shortening the rod to fit the stage would
       therefore have thinned sixty rods' worth of hand-tuned detail as a side
       effect of a composition change. So the weight is handed over separately:
       draw at the stage length, detail at the length the art was tuned for. */
    const weight = U.clamp(rodNaturalLength() / Math.max(1, tip.len), 0.85, 1.9);
    VF.rodArt.draw(ctx, rod, {
      bx: hand.x - Math.cos(a) * tip.len * 0.13,
      by: hand.y - Math.sin(a) * tip.len * 0.13,
      cx: tip.cx, cy: tip.cy,
      tx: tip.x, ty: tip.y,
      len: tip.len, angle: a
    }, t, { spin: reeling ? t * 12 : t * 0.4, weight: weight });
  }

  /* The two sequences, drawn over the shore rather than instead of it: the
     water and the sky keep running underneath, which is most of why it reads
     as something happening here rather than as a cut to somewhere else.

     Nessie is drawn at very nearly the height of the frame. That is not a
     flourish — the whole claim the tier makes about her is scale, and a
     tastefully sized Nessie would be a different animal. */
  function drawCutscene() {
    const C = VF.cutscene && VF.cutscene.state();
    if (!C) return;
    const fish = C.fish && C.fish.fish;

    // the frame goes down, but never all the way — the water stays visible
    if (C.dark > 0.01) {
      const g = ctx.createRadialGradient(W * 0.5, L.horizonY + L.waterH * 0.30, 0,
                                         W * 0.5, L.horizonY + L.waterH * 0.30,
                                         Math.max(W, H) * 0.78);
      g.addColorStop(0, 'rgba(0,0,0,' + (C.dark * 0.42).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,' + Math.min(0.96, C.dark * 1.05).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // something the width of the bay, passing underneath
    if (C.shadow > 0.01) {
      const y = L.horizonY + L.waterH * 0.46;
      const sg = ctx.createLinearGradient(0, y - L.waterH * 0.30, 0, y + L.waterH * 0.34);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.5, 'rgba(0,0,0,' + (0.80 * C.shadow).toFixed(3) + ')');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg;
      ctx.save();
      ctx.translate(Math.sin(t * 0.22) * W * 0.05, 0);
      ctx.beginPath();
      ctx.ellipse(W * 0.5, y, W * 0.78, L.waterH * 0.30, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (!fish || C.rise <= 0.01) return;

    /* Both of them are drawn from their own centre, and neither one is
       centred inside its own silhouette: she is nearly all neck above hers,
       he is a person and splits about evenly. So the frame is worked out from
       the parts that have to be in shot rather than from the middle. */
    const F = C.frame || { box: [0.76, 0.55], top: 0.90, bot: 0.95, surf: 0.58 };
    const TOP = F.top;                     // reach above centre, in half-heights
    const BOT = F.bot;                     // reach below it
    const box = Math.min(H * F.box[0], W * F.box[1]);
    const size = VF.fishArt.fitSize(fish, box);
    // whatever body it has — a being, an object or an ordinary fish
    const half = size * 2 * VF.fishArt.bodyRatio(fish.art.body,
                                                 fish.art.being || fish.art.object ||
                                                 fish.art.astral);
    const surface = L.horizonY + L.waterH * F.surf;
    const k = U.smootherstep(U.clamp(C.rise, 0, 1));

    /* The letterbox bars are DOM, drawn over the canvas, so the renderer has
       to know where they land or it will put the best part of the shot behind
       one. They are 11vh, 8vh on a narrow screen. */
    const bar = H * (W < 760 ? 0.085 : 0.115);
    const ceiling = bar + H * 0.035 + half * TOP;

    /* She sits at her own waterline; he stands on the surface. Either way the
       figure is pushed down far enough to clear the top bar — a reveal you
       cannot see the head of is not a reveal. */
    /* Something that sits in the water rests at its own waterline; something
       that stands on it clears the surface entirely. `sink` is how much of it
       stays under when it has finished coming up. */
    const cyEnd = Math.max(ceiling,
                           F.sink !== undefined ? surface - half * F.sink
                                                : surface - half * BOT);
    const cyStart = surface + half * (BOT + 1.30);
    const cy = U.lerp(cyStart, cyEnd, k);
    const cx = W * 0.5;

    ctx.save();
    // clip at the surface so nothing floats above water it has not left yet
    ctx.beginPath();
    ctx.rect(-20, -20, W + 40, surface + L.waterH * 0.30 + 20);
    ctx.clip();
    ctx.translate(cx, cy);

    // the water it is displacing
    ctx.save();
    ctx.globalAlpha = 0.55 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(0, half * 0.92, size * 1.25, L.waterH * 0.055, 0, 0, TAU);
    ctx.fill();
    ctx.restore();

    if (C.lit > 0.02) {
      // a light on it that is not coming from the sky
      const gl = ctx.createRadialGradient(0, -half * 0.2, 0, 0, -half * 0.2, size * 1.6);
      const acc = U.hexToRgb(fish.art.c3);
      gl.addColorStop(0, U.rgbToCss(acc, 0.20 * C.lit));
      gl.addColorStop(1, U.rgbToCss(acc, 0));
      ctx.fillStyle = gl;
      ctx.fillRect(-size * 1.8, -size * 1.8, size * 3.6, size * 3.6);
    }

    // she comes out of the dark as she comes up, the same way a hooked fish does
    if (C.lit < 0.96) {
      ctx.save();
      ctx.globalAlpha = 1 - C.lit;
      VF.fishArt.drawSilhouette(ctx, fish, size, 0.96, k * 0.85);
      ctx.restore();
    }
    if (C.lit > 0.02) {
      ctx.save();
      ctx.globalAlpha = C.lit;
      VF.fishArt.draw(ctx, fish, size, { time: t, traits: C.fish ? C.fish.traits : null });
      ctx.restore();
    }
    ctx.restore();
  }

  /* Nothing dramatic — the colour drains, the frame stops, and a few lights
     appear where there is no reason for lights. */
  function drawWrong(k) {
    ctx.save();
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = 'hsl(0,' + Math.round((1 - k) * 100) + '%,50%)';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const n = 5;
    for (let i = 0; i < n; i++) {
      const seed = i * 12.9898;
      const x = ((Math.sin(seed) * 43758.5453) % 1 + 1) % 1 * W;
      const y = L.horizonY - H * (0.05 + (((Math.sin(seed * 1.7) * 43758.5453) % 1 + 1) % 1) * 0.25);
      const r = H * 0.02 * (0.6 + Math.sin(t * 0.6 + i) * 0.4);
      const a = k * 0.5 * (0.4 + 0.6 * Math.sin(t * 0.35 + i * 2));
      if (a <= 0.01 || r <= 0) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r * 6));
      g.addColorStop(0, 'rgba(210,225,255,' + a.toFixed(3) + ')');
      g.addColorStop(1, 'rgba(210,225,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);
    }
    ctx.restore();
  }

  /* The vignette is a CSS layer; only its pulse strength is driven from here. */
  let pulseEl = null, lastPulse = -1;
  function syncVignette() {
    if (!pulseEl) pulseEl = document.getElementById('vigPulse');
    if (!pulseEl) return;
    /* The other half of a surge with nothing to blow around: the frame itself.
       The edges of the picture draw in and let go on a ten-second breath, under
       everything else, so the place feels like it is doing something even when
       nothing on screen has moved. */
    let raw = VF.fx.pulseAmt();
    const sg = VF.weather.surge();
    if (sg > 0.01 && (VF.locations.current().void || 0) > 0.9) {
      const br = 0.5 - 0.5 * Math.cos(t * 0.62);
      raw = Math.max(raw, Math.pow(br, 1.8) * 0.30 * sg);
    }
    const v = Math.round(raw * 100) / 100;
    if (v !== lastPulse) { lastPulse = v; pulseEl.style.opacity = v; }
  }

  VF.scene = {
    init: init, resize: resize, update: update, draw: draw,
    L: L, addShadow: addShadow,
    debug: function (on) { debugOn = on === undefined ? !debugOn : !!on; return debugOn; },
    rodLength: function () { return rodTipPoint().len; },
    /* what a lost fish is doing right now, for the tools */
    debugDeparture: function () {
      return departure ? { t: departure.t, x: departure.x, y: departure.y,
                           falls: departure.falls } : null;
    },
    groundY: groundY, visitSpots: visitSpots,
    /* the two stage sets, so the comparison tools drive the code the renderer
       actually runs rather than a re-listing of it */
    drawBack: drawBack, drawFront: drawFront,
    /* and the lists themselves, so a tool can hand them to js/gl/layer.js the
       same way the frame does — including the per-stage latch */
    __backStages: backList,
    __frontStages: function (P, q, world) {
      return frontList(P, q, world === undefined ? true : world);
    },
    /* Is this canvas point on the wanderer? The input layer asks before it
       decides a press was the start of a cast. */
    merchantHit: function (px, py) {
      const r = L.merchant;
      if (!r) return false;
      const pad = L.figureH * 0.10;
      return px >= r.x - pad && px <= r.x + r.w + pad &&
             py >= r.y - pad && py <= r.y + r.h + pad;
    },
    spawnMeteor: spawnMeteor, seedAmbient: seedAmbient,
    rebuild: function () { backdropKey = ''; buildStars(); },
    __backdrop: function () { return backdrop; },
    profile: function (on) {
      if (on) { prof = { acc: {}, frames: 0 }; return; }
      if (!prof) return null;
      const out = { frames: prof.frames, ms: {} };
      let total = 0;
      for (const k in prof.acc) { out.ms[k] = +(prof.acc[k] / prof.frames).toFixed(3); total += prof.acc[k]; }
      out.totalPerFrame = +(total / prof.frames).toFixed(3);
      prof = null;
      return out;
    },
    size: function () { return { w: W, h: H }; },
    ctx: function () { return ctx; }
  };
})(window.VF = window.VF || {});
