/* VOID FISHING — the sky, properly.

   What was there: two hundred and fifty-five white squares of one colour at
   random positions, and no clouds at all. It read as static because it was
   static — a starfield with no structure and no temperature, over an empty
   gradient.

   What is here now is three things, all of them baked and none of them costing
   anything per frame beyond a blit:

   THE FIELD. Stars have magnitudes, and the distribution of magnitudes is not
   uniform — there are a very few bright ones and an enormous number you can
   barely see, which is what makes a real sky look deep rather than sprinkled.
   They have colour temperature too, from cold blue-white through to red, and
   the galaxy is a band of unresolved ones lying across the whole thing at an
   angle. All of that bakes once.

   THE BRIGHT ONES. Perhaps twenty stars are worth animating. They come back
   as a list so the scene can twinkle them live over the baked field, with
   diffraction spikes on the brightest — a blit cannot twinkle, and a sky where
   nothing moves is a photograph.

   THE CLOUDS. Fractal noise, thresholded into a mass, lit from wherever the
   light is and shaded away from it, baked at a third of the resolution because
   a cloud has no edges worth resolving. Two layers at different scales
   drifting at different speeds is parallax, and parallax is most of what makes
   a sky feel like it has depth in it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ noise

     Value noise with a hashed lattice — no gradient table to carry, and for
     clouds the difference between value and gradient noise is invisible once
     five octaves are stacked. */

  function hash2(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695040888963407) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function noise2(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return U.lerp(U.lerp(a, b, u), U.lerp(c, d, u), v);
  }

  /* Stacked octaves. `ridged` folds each octave around its midpoint, which is
     what turns soft blobs into the sharp crests a mountain needs. */
  function fbm(x, y, seed, octaves, lacunarity, gain, ridged) {
    let sum = 0, amp = 0.5, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      let n = noise2(x * freq, y * freq, seed + i * 131);
      if (ridged) { n = 1 - Math.abs(n * 2 - 1); n *= n; }
      sum += n * amp;
      norm += amp;
      freq *= lacunarity;
      amp *= gain;
    }
    return sum / (norm || 1);
  }

  /* -------------------------------------------------------------- the field

     Magnitudes are drawn from a power law: the exponent is what decides
     whether the sky looks like a real one or like confetti. Colour comes off a
     rough main-sequence ramp, weighted so most stars are the boring white ones
     they actually are. */

  const TEMPS = [
    [155, 176, 255],   // O — the rare blue ones
    [170, 191, 255],   // B
    [202, 216, 255],   // A
    [248, 247, 255],   // F
    [255, 244, 234],   // G, the sun's colour
    [255, 210, 161],   // K
    [255, 174, 111]    // M — the common dim red ones nobody notices
  ];

  function starColour(r) {
    // most stars are late-type; the blue ones are rare and should feel it
    const i = Math.min(TEMPS.length - 1, Math.floor(Math.pow(r, 0.55) * TEMPS.length));
    return TEMPS[i];
  }

  /* Returns { canvas, bright } — the baked field, and the handful worth
     twinkling live on top of it. */
  function buildField(w, h, seed, quality, tint) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d');
    const rnd = VF.rng.make(seed);

    const n = quality === 'low' ? 420 : quality === 'medium' ? 1100 : 2400;

    /* --- the galaxy ---
       A band of stars too far away to resolve, lying across the sky at an
       angle, thickest along its spine and torn by a dust lane down the middle.
       It is drawn as a dense scatter rather than a gradient, so it dissolves
       into the field around it instead of ending. */
    const bandA = -0.34 + rnd() * 0.16;          // its tilt
    const bandY = 0.30 + rnd() * 0.26;           // where it crosses
    const dust = 0.13 + rnd() * 0.06;            // the lane down the spine
    const bandN = quality === 'low' ? 700 : quality === 'medium' ? 2200 : 5200;

    for (let i = 0; i < bandN; i++) {
      const u = rnd();
      // gaussian-ish across the band, so it has a spine and soft edges
      const off = (rnd() + rnd() + rnd() + rnd() - 2) * 0.5;
      const bx = u * 1.35 - 0.17;
      const by = bandY + Math.tan(bandA) * (bx - 0.5) + off * 0.115;
      if (by < 0 || by > 1) continue;
      // the dust lane: a gap along the spine where the light is blocked
      if (Math.abs(off) < dust && rnd() < 0.80) continue;
      const a = (0.05 + Math.pow(rnd(), 2.2) * 0.30) * (1 - Math.abs(off) * 0.7);
      const col = starColour(rnd());
      g.fillStyle = U.rgbToCss(U.mixRgb(col, tint, 0.35), a);
      const s = 0.5 + rnd() * 0.7;
      g.fillRect(bx * c.width, by * c.height, s, s);
    }

    /* --- the field proper --- */
    const bright = [];
    for (let i = 0; i < n; i++) {
      const x = rnd(), y = Math.pow(rnd(), 1.22);
      /* Magnitude on a power law. A high exponent means almost everything is
         faint, which is the whole trick: the eye reads the few bright ones as
         stars and the rest as depth behind them. */
      const mag = Math.pow(rnd(), 3.1);
      const col = U.mixRgb(starColour(rnd()), tint, 0.28);
      const a = 0.10 + mag * 0.9;
      const s = 0.45 + mag * 1.9;

      if (mag > 0.72 && bright.length < 26) {
        // handed back for live twinkling rather than baked flat
        bright.push({ x: x, y: y, s: s * 1.15, col: col, mag: mag,
                      tw: rnd() * TAU, sp: 0.35 + rnd() * 1.3,
                      spikes: mag > 0.88 });
        continue;
      }

      g.fillStyle = U.rgbToCss(col, a);
      if (s > 1.5) {
        // the faint halo a bright star has, at almost no cost
        g.globalAlpha = a * 0.16;
        g.beginPath(); g.arc(x * c.width, y * c.height, s * 2.4, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = U.rgbToCss(col, a);
      }
      g.fillRect(x * c.width - s * 0.5, y * c.height - s * 0.5, s, s);
    }

    return { canvas: c, bright: bright };
  }

  /* -------------------------------------------------------------- the clouds

     Baked at a third of the resolution and scaled up, because a cloud has no
     edge worth resolving and the noise costs per pixel. Each layer is one
     ImageData pass: fBm for the mass, a second lookup offset toward the light
     for the shading, and the difference between them is the form. */

  function buildCloudLayer(w, h, opt) {
    const DS = opt.downscale || 3;
    const cw = Math.max(8, Math.round(w / DS));
    const ch = Math.max(8, Math.round(h / DS));
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    const img = g.createImageData(cw, ch);
    const d = img.data;

    const scale = opt.scale || 3.2;
    const seed = opt.seed || 1;
    const cover = opt.cover === undefined ? 0.5 : opt.cover;   // 0 clear, 1 overcast
    const soft = opt.soft === undefined ? 0.30 : opt.soft;
    const lit = opt.lit || [255, 255, 255];
    const dark = opt.dark || [40, 46, 62];
    // where the light is, in the layer's own space, so shading has a direction
    const lx = (opt.lightX === undefined ? 0.7 : opt.lightX);
    const ly = (opt.lightY === undefined ? 0.25 : opt.lightY);

    /* The threshold has to fall off toward the top of the band or the layer
       ends in a straight line across the sky. */
    for (let y = 0; y < ch; y++) {
      const v = y / ch;
      // clouds thin out with altitude and pile up toward the horizon
      const band = Math.pow(U.clamp(v, 0, 1), 0.72);
      for (let x = 0; x < cw; x++) {
        const u = x / cw;
        // stretched horizontally: clouds are wider than they are tall
        const m = fbm(u * scale * 2.6, v * scale * 5.2, seed, 5, 2.05, 0.52, false);
        const t = m - (1 - cover * band) * 0.62 - 0.16;
        if (t <= 0) continue;
        const alpha = U.clamp(t / Math.max(0.02, soft), 0, 1);

        /* Shading: sample the mass again a short way toward the light. Where
           there is more cloud between here and the light, here is in shadow.
           That is the whole of it, and it is enough to give a flat noise field
           a top and a bottom. */
        const dxs = (lx - u) * 0.10, dys = (ly - v) * 0.10;
        const m2 = fbm((u + dxs) * scale * 2.6, (v + dys) * scale * 5.2, seed, 3, 2.05, 0.52, false);
        const k = U.clamp(0.5 + (m2 - m) * 4.2, 0, 1);

        const col = U.mixRgb(dark, lit, k);
        const i4 = (y * cw + x) * 4;
        d[i4] = col[0] | 0; d[i4 + 1] = col[1] | 0; d[i4 + 2] = col[2] | 0;
        d[i4 + 3] = (alpha * 255) | 0;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  VF.skyArt = {
    noise2: noise2, fbm: fbm,
    buildField: buildField,
    buildCloudLayer: buildCloudLayer,
    starColour: starColour
  };
})(window.VF = window.VF || {});
