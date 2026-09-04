/* VOID FISHING — the sky and the sea, on the GPU.

   These two are here and nothing else is, for a reason. The 2D renderer drew
   the water as about fifty stacked translucent fills: a depth gradient, a
   horizon seam, eleven belled bands for the light on the water, a hundred and
   thirty specular flecks, three swell bands and thirty-two wave lines, each
   one a full-width alpha-blended shape. They were most of the frame.

   All of it is one fragment shader, and the shader can do things the stack
   could not: the specular is computed from an actual surface normal rather
   than approximated with a wedge of haze, the foam knows where the crests are
   because it has the height field in hand, and the fog is applied per pixel
   by distance instead of as a band drawn over the top.

   Everything else in the scene — the creatures, the rod, the angler, the
   boat, the landmarks — stays in Canvas 2D on a transparent canvas stacked
   above this one. They are never uploaded. That is the whole architecture:
   the medium is GPU, the things in it are not, and they meet on the screen
   rather than in memory.

   ------------------------------------------------------------------------

   WHY THIS FILE WAS REWRITTEN.

   The sky was `mix(skyTop, skyBot, t)`. One linear ramp between two colours,
   plus a glow band at the horizon, for every place in the game. Nine
   locations ran the same four equations with different constants, which is
   the exact definition of "the same scene in a different colour" — and no
   amount of work on the water could fix it, because half of every frame is
   sky and that half was a gradient.

   So a place now declares an ATMOSPHERE and a WATER MODEL, not a palette:

     the vertical curve       three stops on non-linear ramps, so the dome
                              reads as air with depth in it rather than a fill
     the light                an actual body with a limb and a scattering
                              halo, sized and placed by elevation — the moon
                              over the basin is a different object from
                              whatever is over Heaven
     the cloud deck           FBM sampled in the deck's own plane, so it
                              compresses toward the horizon the way a real
                              overcast does, lit directionally from the light
                              and parallaxing against the camera
     the water model          open / mirror / swell / still — mirror reflects
                              the sky it is under and shows its own bed
                              through it; swell carries a long-period heave
                              the chop rides on; still has no surface motion
                              at all and is lit from underneath

   The models are the point. A zone is not a hue any more, it is a different
   set of equations, and tools/atmosphere.js fails the build if two zones
   come out looking alike in structure rather than merely in colour.

   The wave field is the one the 2D renderer used — the same five summed sines
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

/* The dome, in three stops rather than two. skyBot is the horizon, skyTop
   the middle of the sky, skyZen straight up — and the ramps between them
   are curved, which is the difference between air and a gradient. */
uniform vec3  skyZen;
uniform vec3  skyTop;
uniform vec3  skyBot;

uniform vec3  waterTop;
uniform vec3  waterBot;
uniform vec3  bed;          // what is under the water where you can see it
uniform vec3  glow;         // the colour of the one big light
uniform vec2  light;        // and where it is, in screen space
uniform float lightElev;    // 0 sitting on the horizon, 1 straight overhead
uniform float discR;        // its angular size. 0 for a place with no body in the sky
uniform vec3  fog;
uniform float fogAmt;
uniform float bright;
uniform float chop;         // wind and rain, minus whatever has gone still
uniform float calm;         // 0..1, how much the water has stopped
uniform float camU;         // lateral camera, so the field moves with the frame
uniform float voidK;        // how much of this place is not water
uniform float cloudAmt;     // 0 clear, 1 closed over
uniform float cloudY;       // how high the deck sits. low deck = fast, big shapes
uniform vec3  cloudTint;
uniform int   qual;        // 0 low · 1 medium · 2 high · 3 cinematic
uniform int   skyModel;     // 0 open · 1 closed · 2 inverted · 3 unbounded
uniform int   waterModel;   // 0 open · 1 mirror · 2 swell · 3 still
uniform sampler2D back;     // everything behind the water, already drawn
uniform bool  hasBack;

/* --------------------------------------------------------------- noise

   Value noise and an FBM over it. Cheap on purpose: this is evaluated up to
   seven times per pixel in mirror water, and a gradient-noise implementation
   would put the sea back on the CPU's side of the budget. */
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  /* Quintic rather than cubic. A cubic smoothstep is continuous in value and
     first derivative but NOT the second, so the cell boundaries of the grid
     stay visible as faint creases — and summed over octaves they line up into
     the axis-aligned blocks that were showing along the horizon. */
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p, int oct) {
  float s = 0.0, a = 0.5;
  /* Every octave is rotated as well as scaled. Scaling alone leaves each
     octave on the same axis-aligned lattice as the last, so their cell edges
     coincide and reinforce; a rotation between them means no two octaves
     share a grid direction and the sum has no grain of its own. */
  const mat2 rot = mat2(0.8000, 0.6000, -0.6000, 0.8000);
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    s += a * vnoise(p);
    p = rot * p * 2.03 + vec2(11.3, 7.7);
    a *= 0.5;
  }
  return s;
}

/* ------------------------------------------------------------ the light

   A body, not a colour. discR is its angular radius as a fraction of the
   frame height; the limb is soft over the outer quarter of it because every
   light in this game is seen through some amount of air, and the halo is the
   scattering around it, which is what actually tells you how thick that air
   is. A place with discR 0 has no body in its sky and gets neither. */
vec3 lightBody(vec2 p, float aspect) {
  if (discR <= 0.0) return vec3(0.0);
  float d = length((p - light) * vec2(aspect, 1.0));
  float body = smoothstep(discR, discR * 0.74, d);
  float halo = pow(max(0.0, 1.0 - d / (discR * 11.0)), 3.2);
  /* Thick air spreads the halo and eats the limb — a moon in fog is all halo
     and no edge, and that reads as weather without drawing any. */
  float thick = clamp(fogAmt, 0.0, 1.0);
  return glow * (body * (0.85 - thick * 0.45) + halo * (0.16 + thick * 0.34)) *
         (0.55 + bright * 0.75);
}

/* ------------------------------------------------------------ the clouds

   Sampled in the DECK'S own plane rather than on the screen. A flat deck at
   altitude h, seen at angular height a above the horizon, has ground distance
   h/a — so the same 1/x compression the water uses, mirrored upward. Getting
   this wrong (sampling in screen space) is what makes procedural cloud look
   like marble: the shapes stay the same size all the way to the horizon,
   which no sky has ever done.

   Returns coverage in x and the directional lighting term in y. */
vec2 clouds(vec2 p, float hy, float aspect, int oct) {
  if (cloudAmt <= 0.001) return vec2(0.0);
  float ang = hy - p.y;                       // 0 at the horizon, hy overhead
  if (ang <= 0.0) return vec2(0.0);

  /* The distance is clamped well before the horizon. Un-clamped it runs to a
     hundred times its overhead value in the last two percent of the frame,
     and the deck stops being cloud and becomes horizontal stripes — correct
     perspective taken so far past what a screen can resolve that it reads as
     a different material.

     AND THE LATERAL TERM IS DAMPED, which is the other half and the one that
     made the sky unusable. A flat deck compresses toward the horizon as
     1/angle in BOTH axes, so taken literally the lateral scale also stretches
     by that factor — and lines of constant lateral coordinate are then lines
     through the vanishing point, which turns low-frequency noise into a fan
     of hard wedges radiating out of it. That is exactly what it drew.

     Real cloud does converge, but a camera's field of view is narrow enough
     that it converges gently over the part of the sky you can see. This is
     the same projection with the sideways term pulled most of the way back
     toward flat, which keeps the recession and loses the fan. */
  float dist = cloudY / max(ang, 0.055);
  float lat = mix(1.0, dist, 0.34);
  vec2 q = vec2((p.x - 0.5) * aspect * lat * 2.6 + camU * 0.9 + time * 0.010,
                dist * 1.5 + time * 0.004);

  float n = fbm(q, oct);
  /* Coverage. At 0 the threshold sits above almost everything the FBM
     produces, so a clear sky is genuinely clear rather than faintly cloudy
     everywhere — which is the failure mode of scaling an alpha instead. */
  float lo = mix(0.80, 0.28, cloudAmt);
  float cov = smoothstep(lo, lo + 0.22, n);

  /* The last sliver above the horizon is edge-on and a pixel tall; letting it
     resolve is nothing but aliasing. */
  cov *= smoothstep(0.0, 0.030, ang);

  /* Lit from the light rather than from above: sample again a short way
     toward it and take the difference.

     ONE OCTAVE, not a second whole FBM. What this term needs is the large
     shape of the deck — which side of a mass of cloud faces the light — and
     that lives entirely in the first octave; the rest was three more noise
     evaluations per pixel buying detail nobody can see in a shading term.
     Seven noise lookups per sky pixel to four, on half the frame, at sixty
     frames a second. */
  vec2 toL = normalize(vec2((light.x - p.x) * aspect, ang - (hy - light.y)) + vec2(1e-5));
  float n2 = vnoise(q + toL * vec2(1.6, 0.9)) * 0.5;
  float lit = clamp((n - n2) * 2.4 + 0.5, 0.0, 1.0);
  return vec2(cov, lit);
}

/* ---------------------------------------------------------------- the sky

   Factored out because the mirror water has to be able to ask what is above
   it. lod drops cloud octaves for the reflected copy — a reflection carries
   the shape and the colour and nobody has ever resolved the fourth octave of
   a cloud in the water. */
/* The dome and the body of light in it, WITHOUT the cloud deck.

   Split out because the water wants to reflect the sky and the deck is the
   expensive half. On anything but glass the surface is broken enough that
   what comes back is the gradient and the light — a chop scatters cloud
   detail into nothing long before it scatters the sky's own colour — so open
   water reflects this and pays for none of the noise. */
vec3 skyBase(vec2 p, float hy, float aspect) {
  float t = clamp(p.y / max(0.0001, hy), 0.0, 1.0);
  vec3 c = mix(skyZen, skyTop, smoothstep(0.0, 1.0, pow(t, 0.88)));
  c = mix(c, skyBot, smoothstep(0.46, 1.0, t));
  if (skyModel == 2) c = mix(skyZen, skyBot, pow(t, 0.55));
  else if (skyModel == 3) c = mix(skyZen, skyTop, smoothstep(0.0, 1.0, pow(t, 0.95)));
  if (skyModel != 1) c += lightBody(p, aspect);
  if (skyModel != 3) {
    float hz = pow(t, 3.4);
    c = mix(c, fog, hz * clamp(fogAmt, 0.0, 1.0) * 0.78);
  }
  return c;
}

vec3 skyAt(vec2 p, float hy, float aspect, bool reflected) {
  float t = clamp(p.y / max(0.0001, hy), 0.0, 1.0);   // 0 overhead, 1 horizon

  /* --- the vertical curve. Two curved ramps, not one straight one. The
     upper one is fast at the top and slow through the middle, which is where
     a real dome loses its depth; the lower one is confined to the last third,
     which is where the air stacks up. --- */
  vec3 c = mix(skyZen, skyTop, smoothstep(0.0, 1.0, pow(t, 0.88)));
  c = mix(c, skyBot, smoothstep(0.46, 1.0, t));

  if (skyModel == 1) {
    /* CLOSED. There is rock up there, not air. The ramp runs the other way —
       darkest overhead, and what light there is comes off the underside of
       the roof near the water. A low-frequency FBM gives it a surface so it
       does not read as a lid. */
    /* Two scales of it: the big shape of the roof, and a finer grain over the
       top so it has a surface. Without the second one a cavern ceiling is a
       smooth dome and reads as sky again, which is the whole failure this
       model exists to avoid. The vault is sampled with the same 1/x
       compression the cloud deck uses, so it recedes rather than tiling. */
    /* Clamped hard, for the same reason the cloud deck is: 1/ra runs to twenty
       in the last few rows above the water and the second octave lands at more
       than a cycle per pixel, which is not a rock face, it is speckle. It also
       reads to a star detector as a sky full of stars, which is how it was
       caught. */
    float ra = max(1.0 - t, 0.34);
    float rlat = mix(1.0, 1.0 / ra, 0.34);
    vec2 rq = vec2((p.x - 0.5) * aspect * 2.4 * rlat + camU * 1.6, 1.1 / ra);
    float rock = qual <= 0 ? fbm(rq, 2)
                           : fbm(rq, 3) * 0.68 + fbm(rq * 4.3, 2) * 0.32;
    c = mix(skyZen * 0.30, c, pow(t, 0.80));
    c *= 0.52 + rock * 1.05;
    /* Light off the underside of it, near the water where the water is
       throwing it back up. */
    c += glow * pow(t, 4.0) * 0.13 * bright * (0.35 + rock * 0.9);
  } else if (skyModel == 2) {
    /* INVERTED. The light is under you, so the air brightens DOWNWARD all the
       way to the water instead of banding at the horizon — t runs 0 overhead
       to 1 at the horizon, and this is the one model where that direction
       carries the light rather than the distance. What is overhead is the far
       side of wherever this is, and it has nothing in it. */
    c = mix(skyZen, skyBot, pow(t, 0.55));
    c += glow * pow(t, 2.4) * 0.16 * bright;
  } else if (skyModel == 3) {
    /* UNBOUNDED. No convergence: the dome keeps its colour all the way down
       and there is no horizon band, so the eye gets no distance cue from the
       air at all. That is the Nowhere Sea's entire problem stated in one
       line, and it is why standing there feels wrong before anything has
       happened. */
    c = mix(skyZen, skyTop, smoothstep(0.0, 1.0, pow(t, 0.95)));
  }

  /* --- the body of light in it --- */
  if (skyModel != 1) c += lightBody(p, aspect);

  /* --- the deck --- */
  if (skyModel != 1) {
    /* The reflected copy runs two octaves shallower. Mirror water evaluates
       the whole sky a second time, and nobody has ever resolved the fourth
       octave of a cloud in the water — the shape and the colour are the
       reflection, the grain is cost. */
    /* Octaves off the quality dial.

       The reflected copy runs shallower, because mirror water evaluates the
       whole sky a second time — EXCEPT on glass, where the reflection is the
       zone. Dropping two octaves there took the fine structure out of what
       the Glass Flats reflect, and tools/atmosphere.js caught it immediately:
       the correlation between that water and the sky above it fell from 0.79
       to 0.06, which is the difference between a mirror and a blue floor.
       Cheap in the wrong place is not cheap. */
    int co = qual <= 0 ? 2 : qual == 1 ? 3 : 4;
    int ro = waterModel == 1 ? co : max(2, co - 2);
    vec2 cl = clouds(p, hy, aspect, reflected ? ro : co);
    if (cl.x > 0.0) {
      /* A cloud is lit sky, so its colour starts from the sky it is in rather
         than from white — which is the difference between weather and a
         smear of grey. */
      vec3 dark = mix(c * 0.62, cloudTint * 0.45, 0.45);
      vec3 lite = mix(cloudTint, glow, 0.30 * bright);
      vec3 cc = mix(dark, lite, cl.y);
      float a = cl.x * (reflected ? 0.82 : 1.0);
      c = mix(c, cc, a * 0.92);
    }
  }

  /* --- aerial perspective. The same extinction the water uses, so the two
     halves of the frame meet at the horizon instead of butting together. --- */
  if (skyModel != 3) {
    float hz = pow(t, 3.4);
    c = mix(c, fog, hz * clamp(fogAmt, 0.0, 1.0) * 0.78);
  }
  return c;
}

/* ------------------------------------------------------------- the surface

   A sea seen from a bank recedes, so a line of constant phase — a crest —
   appears as a roughly horizontal line that compresses toward the horizon.
   The phase runs mostly with DEPTH, and depth is not screen y: it is
   1/(distance), which is what puts a hundred waves in the last few pixels
   before the horizon and four across the bottom of the frame.

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

  /* STILL water has no surface motion. Not a small amount — none. Anything
     above zero here reads as an ordinary sea that happens to be calm, and the
     whole point of the place is that it is not one. */
  if (waterModel == 3) return 0.0;

  /* MIRROR is a sea with the chop taken out of it and the long swell left in,
     so it still moves, but only at a scale you can see across the whole frame
     rather than under the boat. */
  if (waterModel == 1) { amp *= 0.13; speed *= 0.45; }

  float h = wave(q, speed) * amp;

  /* SWELL adds a long-period heave underneath the chop. Low frequency, high
     amplitude, and slow — the water in a deep place moves as one body and the
     ripples ride on top of that rather than being all there is. */
  if (waterModel == 2) {
    h += sin(dep * 0.021 - time * 0.42) * mix(1.5, 15.0, pow(k2, 1.25));
    h += sin(dep * 0.013 + sp2.x * 0.0018 + time * 0.27) * mix(1.0, 9.0, pow(k2, 1.2));
  }
  return h;
}

void main() {
  vec2 px = uv * res;
  float y = uv.y;
  float hy = horizon;
  float aspect = res.x / max(1.0, res.y);

  /* ------------------------------------------------------------ the sky */
  if (y < hy) {
    vec3 c = skyAt(uv, hy, aspect, false);
    /* The stars, the clouds, the ridgeline and whatever stands on it, drawn
       by js/gl/layer.js into a buffer of their own and composited HERE rather
       than over the finished frame — the water has to be able to cover the
       foot of a headland, and a layer laid on afterwards cannot be covered by
       anything. Premultiplied, because that is how it was blended. uv.y runs
       down and a texture's v runs up, so the sample is flipped. */
    if (hasBack) {
      vec4 bk = texture(back, vec2(uv.x, 1.0 - uv.y));
      c = bk.rgb + c * (1.0 - bk.a);
    }
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

  /* --- water you can see the bottom of ---------------------------------

     MIRROR and STILL are shallow or clear enough that the bed is part of the
     picture. It is FBM at two scales in the plane's own coordinates, so it
     recedes with everything else, and it is strongest close to the boat where
     you would actually be able to make it out. A flat that is only a
     reflection is a mirror; a flat you can see the floor of is a place. */
  if (waterModel == 1 || waterModel == 3) {
    float dep = 46.0 / (k + 0.085);
    vec2 bq = vec2(px.x * (0.30 + 0.70 * k) * 0.022 + camU * 5.0, dep * 0.16);
    float g = qual <= 0 ? fbm(bq, 2)
                        : fbm(bq, 3) * 0.72 + fbm(bq * 3.7, 2) * 0.28;
    float show = smoothstep(0.02, 0.55, k) * (1.0 - fogAmt * 0.5);
    base = mix(base, mix(base, bed, 0.30 + g * 0.62), show * 0.80);
  }

  /* --- what the surface reflects ---------------------------------------

     EVERY SEA REFLECTS ITS SKY. Only the two mirror models did, and what the
     other three had instead was one line — mix thirty percent of skyBot into
     the crests — which is a constant colour, not a reflection. It cannot know
     that the sky above it is orange on one side and blue on the other, so at
     sunset the water went warm only where the light's own lane fell and
     stayed grey everywhere else. That is the single largest reason the ocean
     read as a surface with lighting on it rather than as water.

     Fresnel decides how much: almost everything at a grazing angle out by the
     horizon, very little looking straight down past the gunwale, which is
     both correct and the reason a reflection makes distance legible. The
     sample is taken through the surface slope, so it breaks where the water
     does — the one thing that stops it looking like a second sky pasted
     below the first.

     Open water reflects the dome and the light and not the cloud deck: a
     chop scatters cloud detail into nothing long before it scatters the sky's
     colour, and the deck is the expensive half. */
  if (waterModel != 1 && waterModel != 3) {
    float my = clamp(hy - (y - hy) * mix(1.00, 0.34, k), 0.0, hy);
    float bend = dhx * mix(0.0018, 0.022, k);
    vec3 sky = skyBase(vec2(clamp(uv.x + bend, 0.0, 1.0), my), hy, aspect);
    /* Schlick, near enough. Water reflects about two percent of what hits it
       head-on and very nearly all of it at a grazing angle, and that enormous
       range is exactly what makes a sea legible as a receding plane: the
       horizon is a mirror and the water by the boat is a window.

       The first version of this used a plain power with a ceiling of 0.56 and
       was almost invisible at the one place it matters most. */
    float fres = 0.03 + 0.97 * pow(1.0 - k, 3.4);
    /* Chop breaks a reflection up; a calm sea holds it. */
    float hold = mix(0.62, 0.95, calm);
    base = mix(base, sky, clamp(fres * hold, 0.0, 0.95));
  }

  /* And glass gets the whole sky, deck and all, at its own weight — the two
     blocks are exclusive, because running both mixes a reflection into a
     reflection and the Glass Flats came out as an unbroken sheet of sky with
     no water left in it. */
  if (waterModel == 1 || waterModel == 3) {
    float my = clamp(hy - (y - hy) * mix(1.00, 0.34, k), 0.0, hy);
    float bend = dhx * mix(0.0025, 0.030, k);
    vec3 sky = skyAt(vec2(clamp(uv.x + bend, 0.0, 1.0), my), hy, aspect, true);
    /* Fresnel: a reflection is almost everything at a glancing angle out by
       the horizon and very little of it straight down past the gunwale. */
    float fres = pow(1.0 - k, 2.2);
    float amt = mix(0.30, 0.92, fres) * (waterModel == 3 ? 0.72 : 1.0);
    base = mix(base, sky, amt);
  }

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
  /* A mirror returns the light in a much tighter cone. Same equation, sharper
     exponent — which is what makes the flats read as glass rather than as a
     calm sea, without a second lighting model to keep in step. */
  float g0 = (waterModel == 1) ? 0.002 : 0.010;
  float g1 = (waterModel == 1) ? 0.022 : 0.090;
  float glint = smoothstep(g0, g1, toward) * (0.35 + 0.65 * smoothstep(0.0, 0.5, k));
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

  /* A little of the sky on every crest. Much less than it was: this used to
     be the only reflection in the game and had to carry the whole job, and
     with a real one above it the old weight double-counted and flattened the
     near water into haze. What is left is the face of a crest catching a
     different part of the sky than the trough beside it. */
  float crest = smoothstep(-0.020, 0.055, -dhy);
  col = mix(col, mix(col, skyBot, 0.30), crest * (0.05 + 0.10 * k) * (1.0 - calm * 0.6));

  /* Foam, only where it is genuinely steep and only near enough to resolve.
     A mirror does not break, so it does not get any. */
  if (waterModel != 1 && waterModel != 3) {
    float steep = abs(dhx) + abs(dhy);
    float foam = smoothstep(0.10, 0.24, steep) * smoothstep(0.30, 0.85, k);
    col = mix(col, mix(col, vec3(1.0), 0.6), foam * 0.22 * (1.0 - calm));
  }

  /* Air. Beer-Lambert by distance, so the horizon dissolves into the sky
     rather than meeting it at a line — and so distance still reads in a zone
     that is already black, which darkness alone cannot do.

     SWELL doubles the density: the far water in a deep place goes to nothing
     well before the horizon does, and that is most of what makes a trench
     feel like one. */
  float dist = 1.0 - k;
  float dens = fogAmt * ((waterModel == 2) ? 2.1 : 1.0);
  float ext = 1.0 - exp(-dens * dist * 3.2);
  col = mix(col, fog, ext * 0.92);

  /* And the seam itself: the water immediately under the horizon is lit by
     everything beyond it. */
  float seam = pow(smoothstep(0.055, 0.0, d01), 1.6);
  col += glow * seam * (0.22 * bright + 0.05) * (0.25 + 0.75 * (1.0 - clamp(abs(uv.x - light.x) * 1.4, 0.0, 1.0)));

  /* Light coming UP through it, where the light is underneath. The one place
     in the game where the water is brighter the further down you look. */
  if (skyModel == 2) {
    float up = pow(clamp(k, 0.0, 1.0), 1.6) * (1.0 - clamp(abs(uv.x - light.x) * 1.1, 0.0, 1.0));
    col += glow * up * (0.26 * bright + 0.06);
  }

  /* Places that are not water at all keep the shape and lose the sea. */
  col = mix(col, col * 0.35, voidK);

  frag = vec4(col, 1.0);
}
`;

  const QUAL = { low: 0, medium: 1, high: 2, cinematic: 3 };

  let prog = null;
  let failed = false;

  /* Everything the shader needs, pulled from the same places the 2D renderer
     pulls it from — so the two paths cannot drift apart in colour. What the
     2D path cannot follow it into is the cloud deck and the mirror: those are
     per-pixel FBM and a second evaluation of the sky, and reimplementing them
     as stacked fills is the renderer this file exists to replace. The 2D path
     is the no-WebGL fallback; it draws the same place in the same light with
     a plainer sky, which is the correct trade. */
  function uniforms(L, P, back) {
    const w = Math.max(1, L.w), h = Math.max(1, L.h);
    const calm = Math.max(VF.encounters ? VF.encounters.calm() : 0,
                          VF.conditions ? VF.conditions.flag('calm') * 0.8 : 0,
                          VF.wrong ? VF.wrong.intensity() : 0);
    const chop = (0.35 + VF.weather.wind() * 1.3 + VF.weather.rain() * 0.5) *
                 (1 - calm * 0.88);
    const n = function (c) { return [c[0] / 255, c[1] / 255, c[2] / 255]; };
    return {
      res: [w, h],
      time: VF.state.rt.t,
      horizon: L.horizonY / h,
      skyZen: n(P.skyZen),
      skyTop: n(P.skyTop),
      skyBot: n(P.skyBot),
      waterTop: n(P.waterTop),
      waterBot: n(P.waterBot),
      bed: n(P.bed),
      glow: n(P.glow),
      light: [L.glowX / w, L.glowY / h],
      lightElev: U.clamp(P.lightElev, 0, 1),
      discR: U.clamp(P.discR, 0, 0.6),
      fog: n(P.fog),
      fogAmt: U.clamp(P.fogAmt, 0, 1),
      bright: U.clamp(P.bright, 0, 2),
      chop: U.clamp(chop, 0.05, 3),
      calm: U.clamp(calm, 0, 1),
      camU: VF.camera ? VF.camera.u() : 0,
      voidK: U.clamp(P.void || 0, 0, 1),
      cloudAmt: U.clamp(P.cloudAmt, 0, 1),
      cloudY: U.clamp(P.cloudY, 0.02, 1.2),
      cloudTint: n(P.cloudTint),
      qual: VF.gl.int(QUAL[VF.state.data.settings.quality] === undefined
                        ? 2 : QUAL[VF.state.data.settings.quality]),
      skyModel: VF.gl.int(P.skyModel),
      waterModel: VF.gl.int(P.waterModel),
      back: back || null,
      hasBack: !!back
    };
  }

  /* Returns true if it drew, and false if the 2D path should do it instead.
     Every caller checks, so losing the context mid-frame degrades rather than
     failing. */
  function draw(L, P, back, to) {
    if (failed || !VF.gl || !VF.gl.ok()) return false;
    if (!prog) {
      prog = VF.gl.program('world', FS);
      if (!prog) { failed = true; return false; }
    }
    /* `to` is the post chain's buffer when there is one, and null when there
       is not. Nothing else changes: the world does not know or care whether
       what it writes goes to the screen or through a tone curve first. */
    return VF.gl.pass(prog, uniforms(L, P, back), to || null);
  }

  VF.glWorld = {
    draw: draw,
    ok: function () { return !failed && VF.gl && VF.gl.ok(); },
    /* the tools force the fallback to check it still renders */
    disable: function (on) { failed = !!on; }
  };
})(window.VF = window.VF || {});
