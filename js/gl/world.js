/* VOID FISHING — the sky and the sea, on the GPU.

   These two are here and nothing else is, for a reason. The 2D renderer draws
   the water as about fifty stacked translucent fills: a depth gradient, a
   horizon seam, eleven belled bands for the light on the water, a hundred and
   thirty specular flecks, three swell bands and thirty-two wave lines, each
   one a full-width alpha-blended shape. The README already names full-screen
   translucent fills as the dominant cost of that renderer, and it is right —
   they were most of the frame.

   All of it is one fragment shader now, and the shader can do things the
   stack could not: the specular is computed from an actual surface normal
   rather than approximated with a wedge of haze, the foam knows where the
   crests are because it has the height field in hand, and the fog is applied
   per pixel by distance instead of as a band drawn over the top.

   Everything else in the scene — the creatures, the rod, the angler, the
   boat, the landmarks — stays in Canvas 2D on a transparent canvas stacked
   above this one. They are never uploaded. That is the whole architecture:
   the medium is GPU, the things in it are not, and they meet on the screen
   rather than in memory.

   The wave field is the same one the 2D renderer used — three sines summed
   with the same coefficients — deliberately, so the water did not change
   character when it changed renderer. It got better lit, not different. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const FS = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 frag;

uniform vec2  res;
uniform float time;
uniform float horizon;      // 0..1 down the screen
uniform vec3  skyTop;
uniform vec3  skyBot;
uniform vec3  waterTop;
uniform vec3  waterBot;
uniform vec3  glow;         // the colour of the one big light
uniform vec2  light;        // and where it is, in screen space
uniform vec3  fog;
uniform float fogAmt;
uniform float bright;
uniform float chop;         // wind and rain, minus whatever has gone still
uniform float calm;         // 0..1, how much the water has stopped
uniform float camU;         // lateral camera, so the field moves with the frame
uniform float voidK;        // how much of this place is not water

/* The surface, sampled in the plane's own coordinates rather than the
   screen's.

   A sea seen from a bank recedes, so a line of constant phase — a crest —
   appears as a roughly horizontal line that compresses toward the horizon.
   That means the phase has to run mostly with DEPTH, and depth is not screen
   y: it is 1/(distance), which is what puts a hundred waves in the last few
   pixels before the horizon and four across the bottom of the frame.

   Getting this backwards makes the phase run with screen x instead, and the
   water comes out as vertical spikes standing up out of the horizon — which
   is what it did, and which no sea has ever done. */
float wave(vec2 q, float sp) {
  return sin(q.y * 0.062 + q.x * 0.0035 + time * sp * 0.85)
       + sin(q.y * 0.131 - q.x * 0.0062 + time * sp * 1.45) * 0.44
       + sin(q.y * 0.284 + q.x * 0.0021 + time * sp * 2.10) * 0.17
       /* Two more octaves carrying almost no height and most of the slope.
          They cost nothing in displacement and are the entire reason the
          surface glitters rather than shining like silk. */
       + sin(q.y * 0.610 - q.x * 0.0140 + time * sp * 3.10) * 0.085
       + sin(q.y * 1.230 + q.x * 0.0090 + time * sp * 4.40) * 0.040;
}

/* Height of the surface under a point on the screen. Everything about the
   perspective lives in here, so the derivatives taken from it are correct in
   screen space without anybody having to think about it twice. */
float surf(vec2 sp2, float hy2, float camx) {
  float d01 = clamp((sp2.y - hy2) / max(0.0001, res.y - hy2), 0.0, 1.0);
  float k2 = pow(d01, 1.0 / 1.30);
  float dep = 46.0 / (k2 + 0.085);
  vec2 q = vec2(sp2.x * (0.30 + 0.70 * k2) + camx, dep);
  float amp = mix(0.5, 9.0, pow(k2, 1.45)) * chop;
  float speed = 0.4 + chop * 0.7;
  return wave(q, speed) * amp;
}

void main() {
  vec2 px = uv * res;
  float y = uv.y;
  float hy = horizon;

  /* ------------------------------------------------------------ the sky */
  if (y < hy) {
    float t = y / max(0.0001, hy);
    vec3 c = mix(skyTop, skyBot, t);
    /* Light gathering at the horizon. This is what makes distant land read
       against the sky at all, and it is stronger nearer the light. */
    float band = smoothstep(0.0, 1.0, pow(t, 3.0));
    float near = 1.0 - clamp(abs(uv.x - light.x) * 1.6, 0.0, 1.0);
    c += glow * band * (0.045 * bright + 0.02) * (0.4 + near * 0.6);
    frag = vec4(c, 1.0);
    return;
  }

  /* ---------------------------------------------------------- the water

     k is nearness: 0 at the horizon, 1 at the bottom of the frame, on the
     same 1.30 ramp the projection in js/world/space.js uses, so anything
     placed through that projection sits on this surface rather than near it. */
  float d01 = (y - hy) / max(0.0001, 1.0 - hy);
  float k = pow(clamp(d01, 0.0, 1.0), 1.0 / 1.30);

  /* The body of the water. Tilted toward the light rather than vertical, so
     the side away from it sits deeper. */
  float tilt = clamp(light.x, 0.15, 0.85);
  float ramp = clamp(d01 * 0.82 + (uv.x - tilt) * 0.12 + 0.05, 0.0, 1.0);
  vec3 base = mix(waterTop, waterBot, smoothstep(0.0, 0.9, ramp));
  base = mix(base, base * 0.55, smoothstep(0.78, 1.0, ramp));

  /* The slope of that surface, in screen pixels, from three samples. */
  float hyPx = hy * res.y;
  float camx = camU * 240.0;
  float e = 2.0;
  float h   = surf(px, hyPx, camx);
  float dhx = (surf(px + vec2(e, 0.0), hyPx, camx) - h) / e;
  float dhy = (surf(px + vec2(0.0, e), hyPx, camx) - h) / e;

  /* The lane the light lays down: narrow at the horizon, spreading toward
     you, exactly as it does on real water. */
  float lane = 1.0 - clamp(abs(uv.x - light.x) / mix(0.05, 0.34, pow(k, 0.72)), 0.0, 1.0);
  lane = pow(max(0.0, lane), 1.4);

  /* And the glints inside it: the faces of the crests that are tilted back
     toward the light. On a receding plane that is the DEPTH slope, so this
     keys on dhy and only leans on the sideways slope, which is what makes the
     highlights lie along the crests instead of standing up out of them.

     The sideways term is blended across the light's own column rather than
     switched at it: a ternary here cut a hard vertical edge down the water at
     exactly light.x — a box visible in a screenshot and invisible in code. */
  float side = clamp((light.x - uv.x) * 7.0, -1.0, 1.0);
  float toward = -dhy + dhx * side * 0.35;
  float glint = smoothstep(0.010, 0.090, toward) * (0.35 + 0.65 * smoothstep(0.0, 0.5, k));
  float sheen = smoothstep(-0.020, 0.075, -dhy);

  /* Two parts, and dropping the first one is what made the moonpath vanish.

     A real path of light on water is a wedge of haze with glints inside it.
     The haze does not need a wave to exist — it is the light scattering off
     the whole surface — and out near the horizon, where the waves are a
     fraction of a pixel and the slope is effectively zero, the haze is all
     there is. Building the lighting purely out of slope left the far half of
     the path unlit and the near half looking like scratches. */
  float haze = lane * (1.0 - pow(k, 1.35) * 0.55) * (1.0 - calm * 0.85);
  float spec = lane * (glint * 0.85 + sheen * 0.25) * (1.0 - calm * 0.8);
  vec3 col = base + glow * (haze * (0.30 * bright + 0.05) + spec * (1.5 * bright + 0.35));

  /* A little of the sky on every crest, so the water away from the light is
     still a surface rather than a fill. */
  float crest = smoothstep(-0.020, 0.055, -dhy);
  col = mix(col, mix(col, skyBot, 0.30), crest * (0.16 + 0.30 * k) * (1.0 - calm * 0.6));

  /* Foam, only where it is genuinely steep and only near enough to resolve. */
  float steep = abs(dhx) + abs(dhy);
  float foam = smoothstep(0.10, 0.24, steep) * smoothstep(0.30, 0.85, k);
  col = mix(col, mix(col, vec3(1.0), 0.6), foam * 0.22 * (1.0 - calm));

  /* Air. Beer-Lambert by distance, so the horizon dissolves into the sky
     rather than meeting it at a line — and so distance still reads in a zone
     that is already black, which darkness alone cannot do. */
  float dist = 1.0 - k;
  float ext = 1.0 - exp(-fogAmt * dist * 3.2);
  col = mix(col, fog, ext * 0.92);

  /* And the seam itself: the water immediately under the horizon is lit by
     everything beyond it. */
  float seam = pow(smoothstep(0.055, 0.0, d01), 1.6);
  col += glow * seam * (0.22 * bright + 0.05) * (0.25 + 0.75 * (1.0 - clamp(abs(uv.x - light.x) * 1.4, 0.0, 1.0)));

  /* Places that are not water at all keep the shape and lose the sea. */
  col = mix(col, col * 0.35, voidK);

  frag = vec4(col, 1.0);
}`;

  let prog = null;
  let failed = false;

  /* Everything the shader needs, pulled from the same places the 2D renderer
     pulls it from — so the two paths cannot drift apart in colour. */
  function uniforms(L, P) {
    const w = Math.max(1, L.w), h = Math.max(1, L.h);
    const calm = Math.max(VF.encounters ? VF.encounters.calm() : 0,
                          VF.conditions ? VF.conditions.flag('calm') * 0.8 : 0,
                          VF.wrong ? VF.wrong.intensity() : 0);
    const chop = (0.35 + VF.weather.wind() * 1.3 + VF.weather.rain() * 0.5) *
                 (1 - calm * 0.88);
    return {
      res: [w, h],
      time: VF.state.rt.t,
      horizon: L.horizonY / h,
      skyTop: P.skyTop.map(function (v) { return v / 255; }),
      skyBot: P.skyBot.map(function (v) { return v / 255; }),
      waterTop: P.waterTop.map(function (v) { return v / 255; }),
      waterBot: P.waterBot.map(function (v) { return v / 255; }),
      glow: P.glow.map(function (v) { return v / 255; }),
      light: [L.glowX / w, L.glowY / h],
      fog: P.fog.map(function (v) { return v / 255; }),
      fogAmt: U.clamp(P.fogAmt, 0, 1),
      bright: U.clamp(P.bright, 0, 2),
      chop: U.clamp(chop, 0.05, 3),
      calm: U.clamp(calm, 0, 1),
      camU: VF.camera ? VF.camera.u() : 0,
      voidK: U.clamp(P.void || 0, 0, 1)
    };
  }

  /* Returns true if it drew, and false if the 2D path should do it instead.
     Every caller checks, so losing the context mid-frame degrades rather than
     failing. */
  function draw(L, P) {
    if (failed || !VF.gl || !VF.gl.ok()) return false;
    if (!prog) {
      prog = VF.gl.program('world', FS);
      if (!prog) { failed = true; return false; }
    }
    return VF.gl.pass(prog, uniforms(L, P), null);
  }

  VF.glWorld = {
    draw: draw,
    ok: function () { return !failed && VF.gl && VF.gl.ok(); },
    /* the tools force the fallback to check it still renders */
    disable: function (on) { failed = !!on; }
  };
})(window.VF = window.VF || {});
