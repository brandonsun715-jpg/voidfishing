/* VOID FISHING — the frame, after it is drawn.

   Everything in this game was composited straight onto the canvas: the world
   shader wrote to the default framebuffer, the front layer was blended over
   it, and that was the picture. Whatever the art computed was what the screen
   got, clamped at 1.0, in sRGB, with no stage in between.

   That is the reason the game looked flat in a way no amount of work on the
   water could fix. A frame with no exposure has no time of day — only colours
   that happen to be darker. A frame with no tone curve has no highlights,
   because everything above 1.0 was thrown away at the moment it was written,
   so a moon on water and a lightning strike were both pure white. And a frame
   with no grade has no art direction; it has a palette.

   So the world is rendered into a HALF-FLOAT buffer instead, values are
   allowed to go above one, and this is the chain that turns that into an
   image:

     BRIGHT PASS   what is over the threshold, at half resolution
     BLUR          separable, two taps of six, ping-ponged
     RESOLVE       scene + bloom, exposure, tone curve, grade, vignette, grain

   WHAT THIS IS NOT. It is not a colour filter over the screen. Nothing here
   tints the frame toward a mood; the tone curve and the exposure are the same
   for every zone, and what differs per place is the physical description of
   its air, which js/data/locations.js already carries. A zone that wants to
   look colder gets colder light, not a blue layer.

   THE RESTRAINT IS THE POINT. Default bloom threshold is above the diffuse
   range, so only actual light sources bloom — a moon, a lantern, a crystal,
   the sun's own path on the water. Vignette is a few percent. Grain is in the
   shadows, where film has it, and is invisible in daylight. Chromatic
   aberration is zero unless something is actually happening.

   EVERY EFFECT SCALES OFF. `low` runs the resolve alone — one extra
   full-screen pass over what the game did before, and it still gets exposure
   and the tone curve, because those are the two that matter most and the two
   that cost nothing. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* ------------------------------------------------------------ bright pass

     A soft knee rather than a hard cut. A hard threshold makes bloom flicker:
     a highlight crossing 1.0 pops into existence over one frame, and on water,
     where every crest crosses it at a different moment, that reads as static. */
  const BRIGHT_FS = `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 frag;
    uniform sampler2D src;
    uniform float thresh;
    uniform float knee;
    void main() {
      vec3 c = texture(src, vec2(uv.x, 1.0 - uv.y)).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      /* quadratic through the knee, linear above it */
      float s = clamp(l - thresh + knee, 0.0, 2.0 * knee);
      s = s * s / (4.0 * knee + 1e-5);
      float w = max(s, l - thresh) / max(l, 1e-5);
      frag = vec4(c * w, 1.0);
    }`;

  /* Separable Gaussian, six taps a side, weights on a 1/3-pixel dilation so
     two passes at half resolution cover a radius worth having without a
     third. `dir` is the step in uv. */
  const BLUR_FS = `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 frag;
    uniform sampler2D src;
    uniform vec2 dir;
    void main() {
      vec2 p = vec2(uv.x, 1.0 - uv.y);
      vec3 c = texture(src, p).rgb * 0.1964;
      c += (texture(src, p + dir * 1.4117).rgb + texture(src, p - dir * 1.4117).rgb) * 0.2969;
      c += (texture(src, p + dir * 3.2941).rgb + texture(src, p - dir * 3.2941).rgb) * 0.0944;
      c += (texture(src, p + dir * 5.1764).rgb + texture(src, p - dir * 5.1764).rgb) * 0.0103;
      frag = vec4(c, 1.0);
    }`;

  const RESOLVE_FS = `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 frag;

    uniform sampler2D src;
    uniform sampler2D bloomTex;
    uniform vec2  res;
    uniform float time;
    uniform float exposure;
    uniform float bloomAmt;
    uniform float sat;
    uniform float con;
    uniform vec3  lift;      // what the shadows are made of
    uniform vec3  gain;      // and the highlights
    uniform float vig;
    uniform float grain;
    uniform float ca;
    uniform bool  hasBloom;

    float hash(vec2 p) {
      p = fract(p * vec2(443.897, 441.423));
      p += dot(p, p + 19.19);
      return fract(p.x * p.y);
    }

    /* The tone curve.

       ACES, in the fitted form everybody uses, because it is the curve the
       eye reads as photographic: a long toe that keeps shadow separation, a
       shoulder that rolls highlights off instead of clipping them, and a
       desaturation into the top end so a bright light goes white the way a
       real one does rather than going to its own hue at full saturation.

       That last property is why the moon on the water stopped looking like a
       sticker. Before this, every value over 1.0 clamped per channel, so a
       warm highlight clipped to pure yellow and only THEN to white. */
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    void main() {
      vec2 p = vec2(uv.x, 1.0 - uv.y);
      vec2 off = (uv - 0.5);
      float r2 = dot(off, off);

      /* Chromatic aberration, sampled radially so it is zero in the middle of
         the frame and only ever appears at the edges. Off entirely unless
         something is happening — it is an effect for a moment, not a look. */
      vec3 c;
      if (ca > 0.0001) {
        vec2 d = off * ca * r2;
        c = vec3(texture(src, p + d).r,
                 texture(src, p).g,
                 texture(src, p - d).b);
      } else {
        c = texture(src, p).rgb;
      }

      if (hasBloom) c += texture(bloomTex, p).rgb * bloomAmt;

      /* Exposure BEFORE the curve, which is the whole point of having one.
         Scaling after a tone map only crushes what the map already decided. */
      c *= exposure;
      c = aces(c);

      /* Grade, on the tone-mapped image, in the order a colourist works: the
         black point, then the white, then saturation, then contrast about
         middle grey. Lift and gain are per-channel, so a place can have cold
         shadows and warm highlights, which is most of what art direction is. */
      c = c * gain + lift * (1.0 - c);
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, sat);
      c = clamp((c - 0.5) * con + 0.5, 0.0, 1.0);

      /* Vignette. Smooth, wide, and a few percent — it is here to stop the
         corners competing with the middle of the frame, not to be seen. */
      c *= 1.0 - vig * smoothstep(0.18, 0.92, r2 * 2.2);

      /* Grain, weighted into the shadows the way film has it, and scaled by
         the pixel size so it does not turn into a moiré on a dense display. */
      if (grain > 0.0) {
        float n = hash(floor(uv * res * 0.5) + fract(time) * 71.7) - 0.5;
        c += n * grain * (1.0 - smoothstep(0.0, 0.6, l));
      }

      frag = vec4(c, 1.0);
    }`;

  let bright = null, blur = null, resolve = null;
  let failed = false, built = false;

  /* Exposure is smoothed in JS rather than measured off the frame. A real
     auto-exposure needs the finished image read back, and a readback is the
     one thing this renderer refuses to do per frame — it is four megabytes
     across the bus and it stalls the pipeline. The palette already knows how
     bright this place is at this hour; adapting to that gives the eye the
     same adjustment without the cost, and it cannot hunt. */
  let ev = 1;

  function programs() {
    if (built) return !failed;
    built = true;
    bright = VF.gl.program('post-bright', BRIGHT_FS);
    blur = VF.gl.program('post-blur', BLUR_FS);
    resolve = VF.gl.program('post-resolve', RESOLVE_FS);
    failed = !(bright && blur && resolve);
    return !failed;
  }

  function ok() { return !failed && VF.gl && VF.gl.ok(); }

  /* What each quality level buys. `low` still gets the resolve — exposure and
     the tone curve are the two effects that change the picture most and cost
     one pass between them. */
  function tier(q) {
    if (q === 'low') return { bloom: 0, grain: 0, vig: 0.14 };
    if (q === 'medium') return { bloom: 1, grain: 0, vig: 0.17 };
    if (q === 'cinematic') return { bloom: 2, grain: 0.020, vig: 0.20 };
    return { bloom: 1, grain: 0.013, vig: 0.18 };   // high
  }

  /* The scene buffer, at half float so highlights survive being written. */
  function sceneTarget() {
    const dpr = VF.gl.size().dpr || 1;
    return VF.gl.target('post-scene', dpr, true);
  }

  /* Open the frame. Everything drawn after this goes into the buffer instead
     of onto the canvas; end() puts it on the canvas. Returns null when post
     is unavailable, and every caller treats that as "draw straight to the
     screen the way you always did". */
  function begin() {
    if (!ok() || !programs()) return null;
    const t = sceneTarget();
    if (!t) return null;
    VF.gl.bind(t);
    const gl = VF.gl.ctx();
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return t;
  }

  /* Everything a place asks of the chain, in one object, defaulted so a
     location that says nothing gets a neutral photographic treatment rather
     than a look. */
  function gradeOf(P) {
    const g = (VF.locations.current().air || {}).grade || {};
    return {
      ev: g.ev === undefined ? 0 : g.ev,
      sat: g.sat === undefined ? 1.02 : g.sat,
      con: g.con === undefined ? 1.04 : g.con,
      lift: g.lift || [0, 0, 0],
      gain: g.gain || [1, 1, 1],
      bloom: g.bloom === undefined ? 1 : g.bloom,
      thresh: g.thresh === undefined ? 1.02 : g.thresh
    };
  }

  function end(L, P, q, dt) {
    if (!ok() || !programs()) return false;
    const t = VF.gl.target('post-scene', VF.gl.size().dpr || 1, true);
    if (!t) return false;
    const gl = VF.gl.ctx();
    const T = tier(q);
    const G = gradeOf(P);

    /* --- exposure ----------------------------------------------------

       IT ADAPTS TO THE WEATHER AND NOT TO THE HOUR, and getting that wrong
       the first time flattened the entire day: an automatic term keyed on the
       scene's brightness pulls night up, the hour's own offset pulls night up
       as well, and between them the Quiet Shore measured 110 at dawn, 92 at
       midday and 83 at night. A day whose darkest hour is its brightest one
       is not a day, and no amount of colour work would have saved it.

       So the two are separated by what they are for. The eye adapting to a
       squall closing over is real and belongs here, on the weather's own
       light factor. The difference between noon and midnight is not
       something the eye should undo — it is the thing being drawn — and it
       is carried entirely by the keyframes in js/render/palette.js. */
    const key = U.clamp(P.wxLight === undefined ? 1 : P.wxLight, 0.15, 1.6);
    const want = Math.pow(1 / key, 0.55) * Math.pow(2, G.ev + (P.dayEv || 0));
    const k = U.clamp((dt || 0.016) * 1.6, 0, 1);
    ev += (U.clamp(want, 0.55, 2.6) - ev) * k;

    /* --- bloom -------------------------------------------------------- */
    let bloomTex = null;
    if (T.bloom > 0 && G.bloom > 0) {
      const s = VF.gl.size().dpr * (T.bloom > 1 ? 0.5 : 0.34);
      const a = VF.gl.target('post-bloom-a', s, true);
      const b = VF.gl.target('post-bloom-b', s, true);
      if (a && b) {
        VF.gl.blend('source-over');
        gl.disable(gl.BLEND);
        VF.gl.bind(a);
        VF.gl.pass(bright, { src: t, thresh: G.thresh, knee: 0.42 }, a);
        const px = 1 / Math.max(1, a.w), py = 1 / Math.max(1, a.h);
        const n = T.bloom > 1 ? 2 : 1;
        for (let i = 0; i < n; i++) {
          const w = 1 + i * 1.7;
          VF.gl.pass(blur, { src: a, dir: [px * w, 0] }, b);
          VF.gl.pass(blur, { src: b, dir: [0, py * w] }, a);
        }
        bloomTex = a;
      }
    }

    /* --- resolve to the screen ---------------------------------------- */
    VF.gl.bind(null);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);

    /* Aberration only while something is happening to the world, and even
       then a fraction of a pixel at the corners. */
    const ab = Math.max(VF.wrong ? VF.wrong.intensity() : 0,
                        VF.fx && VF.fx.flashAmt ? VF.fx.flashAmt() * 0.6 : 0);

    return VF.gl.pass(resolve, {
      src: t,
      bloomTex: bloomTex || t,
      hasBloom: !!bloomTex,
      res: [t.w, t.h],
      time: VF.state.rt.t,
      exposure: ev,
      bloomAmt: 0.055 * G.bloom * (T.bloom > 1 ? 1.15 : 1),
      sat: G.sat * (P.daySat === undefined ? 1 : P.daySat),
      con: G.con,
      lift: G.lift,
      gain: G.gain,
      vig: T.vig,
      grain: T.grain,
      ca: ab * 0.020
    }, null);
  }

  VF.glPost = {
    ok: ok,
    begin: begin,
    end: end,
    /* the tools ask what the chain is doing, and force it off */
    exposure: function () { return ev; },
    disable: function (on) { failed = !!on; if (!on) built = false; }
  };
})(window.VF = window.VF || {});
