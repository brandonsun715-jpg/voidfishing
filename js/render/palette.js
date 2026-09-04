/* VOID FISHING — colour for the scene.
   Location supplies base tones; the time of day and the weather are layered on
   top as continuous interpolations so the sky never snaps between states. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* The day, as eleven named states rather than four.

     There were seven keyframes and the four that mattered were dawn, day,
     sunset and night — so the hour of a frame was legible as one of four
     moods and the transitions between them were a straight line through
     nowhere. A sunset in particular was "orange, and less bright", which is
     what a filter does, not what an evening does.

     What an evening does is a SEQUENCE, and the parts of it are not
     interpolations of each other: golden hour is warm and bright and highly
     saturated; sunset is warm and dim and MORE saturated still; twilight is
     magenta and desaturating fast with the light source gone under the
     horizon; blue hour is cold, dim, and the most saturated blue of the whole
     day. A ramp from orange to navy passes through none of that.

     `ev` is an exposure offset in stops, which the post chain reads. It is
     what keeps the middle of the day from being a wall of white and the small
     hours from being a black rectangle: the eye adapts, and the number says
     how much. `sat` is a grade multiplier, not a colour — the ends of the day
     ARE more saturated than noon, in the air and on film both. */
  const KEYS = [
    /* first light. The sun is still down; what is lit is the air above it. */
    { at: 0.000, tint: '#c9a0a8', k: 0.24, bright: 0.34, star: 0.62, glow: '#e8b09a', glowSize: 1.20, warm: 0.55, ev: 0.30, sat: 1.02 },
    /* early morning — the sun clears the horizon and everything goes warm */
    { at: 0.055, tint: '#ffbc86', k: 0.30, bright: 0.58, star: 0.24, glow: '#ffc48a', glowSize: 1.16, warm: 0.78, ev: 0.10, sat: 1.10 },
    /* morning: the warmth burns off */
    { at: 0.135, tint: '#e3ddd2', k: 0.20, bright: 0.86, star: 0.07, glow: '#fff2e0', glowSize: 0.94, warm: 0.42, ev: -0.05, sat: 1.02 },
    { at: 0.235, tint: '#cfe2f5', k: 0.15, bright: 0.96, star: 0.03, glow: '#f6faff', glowSize: 0.82, warm: 0.28, ev: -0.10, sat: 0.99 },
    /* midday. The flattest light of the day and the least interesting, which
       is correct — it is what the other ten are measured against. */
    { at: 0.330, tint: '#bcd8f0', k: 0.12, bright: 1.00, star: 0.02, glow: '#ffffff', glowSize: 0.74, warm: 0.22, ev: -0.16, sat: 0.96 },
    /* afternoon, warming again */
    { at: 0.425, tint: '#dcd8c8', k: 0.17, bright: 0.94, star: 0.03, glow: '#fff4d8', glowSize: 0.86, warm: 0.42, ev: -0.08, sat: 1.02 },
    /* GOLDEN HOUR. Bright and warm at the same time, which happens nowhere
       else in the cycle, and the reason the water goes to sheet metal. */
    { at: 0.492, tint: '#ffa860', k: 0.30, bright: 0.80, star: 0.08, glow: '#ffb066', glowSize: 1.10, warm: 0.90, ev: 0.02, sat: 1.16 },
    /* SUNSET. Dimmer than golden hour and deeper in colour, not the same
       thing further along. */
    { at: 0.552, tint: '#ff7a4a', k: 0.36, bright: 0.54, star: 0.26, glow: '#ff8a52', glowSize: 1.30, warm: 0.96, ev: 0.20, sat: 1.22 },
    /* TWILIGHT — the light is under the horizon and only the air is lit */
    { at: 0.610, tint: '#a2628c', k: 0.30, bright: 0.36, star: 0.58, glow: '#d69ac0', glowSize: 1.14, warm: 0.55, ev: 0.34, sat: 1.10 },
    /* BLUE HOUR. The coldest and most saturated part of the day. */
    { at: 0.668, tint: '#3f5590', k: 0.30, bright: 0.26, star: 0.86, glow: '#a8c0ff', glowSize: 1.02, warm: 0.16, ev: 0.46, sat: 1.14 },
    /* night, and then the small hours, which are colder and darker again */
    { at: 0.760, tint: '#2c3c6e', k: 0.22, bright: 0.20, star: 1.00, glow: '#c8d8ff', glowSize: 1.00, warm: 0.08, ev: 0.58, sat: 1.00 },
    { at: 0.880, tint: '#22305c', k: 0.20, bright: 0.16, star: 1.00, glow: '#bcd0ff', glowSize: 0.98, warm: 0.05, ev: 0.66, sat: 0.96 },
    /* pre-dawn: the first cool lift, before any colour */
    { at: 0.955, tint: '#4a5578', k: 0.22, bright: 0.22, star: 0.86, glow: '#cbb8c0', glowSize: 1.10, warm: 0.24, ev: 0.52, sat: 0.98 },
    { at: 1.000, tint: '#c9a0a8', k: 0.24, bright: 0.34, star: 0.62, glow: '#e8b09a', glowSize: 1.20, warm: 0.55, ev: 0.30, sat: 1.02 }
  ];

  /* Where the one big light is on its arc: 1 at midday, 0 in the small hours,
     0.5 at both ends of the day. Everything that wants to know how high the
     light is asks this rather than re-deriving it from the clock, so the sky,
     the water and the layout cannot disagree about where the sun is. */
  function sunArc() {
    const c = VF.time.cycle();
    return 0.5 + 0.5 * Math.cos(((c - 0.330 + 1) % 1) * Math.PI * 2);
  }

  const rgbCache = Object.create(null);
  function rgb(hex) { return rgbCache[hex] || (rgbCache[hex] = U.hexToRgb(hex)); }

  function dayKey(cycle) {
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (cycle >= KEYS[i].at && cycle <= KEYS[i + 1].at) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const t = U.smoothstep(U.invLerp(a.at, b.at, cycle));
    return {
      tint: U.mixRgb(rgb(a.tint), rgb(b.tint), t),
      k: U.lerp(a.k, b.k, t),
      bright: U.lerp(a.bright, b.bright, t),
      star: U.lerp(a.star, b.star, t),
      glow: U.mixRgb(rgb(a.glow), rgb(b.glow), t),
      glowSize: U.lerp(a.glowSize, b.glowSize, t),
      warm: U.lerp(a.warm, b.warm, t),
      ev: U.lerp(a.ev === undefined ? 0 : a.ev, b.ev === undefined ? 0 : b.ev, t),
      sat: U.lerp(a.sat === undefined ? 1 : a.sat, b.sat === undefined ? 1 : b.sat, t)
    };
  }

  /* ------------------------------------------------------------ the air

     A place used to be four colours: two for the sky and two for the water.
     That is why nine locations looked like one location recoloured — the
     equations were identical and only the constants moved.

     `loc.air` is the rest of it. It says what KIND of sky this is and what
     kind of water, which selects different code in js/gl/world.js rather than
     different numbers in the same code:

       sky    open       air, with a dome and a deck and a body of light in it
              closed     there is rock up there. the ramp runs the other way
              inverted   the light is underneath you
              unbounded  no horizon convergence at all — no distance cue

       water  open       an ordinary sea
              mirror     glass. reflects the sky above it and shows its bed
              swell      a long heave the chop rides on, and thick air
              still      no surface motion whatsoever, lit from below

     Everything else in the block is the shape of the air rather than its
     colour: how high the light sits, how big a body it has, how much cloud
     and how far up. A location that declares none of it gets the open model
     with defaults derived from the two sky colours it already had, which is
     what keeps the six secret locations and the harbour working untouched. */
  const SKY_MODEL = { open: 0, closed: 1, inverted: 2, unbounded: 3 };
  const WATER_MODEL = { open: 0, mirror: 1, swell: 2, still: 3 };

  const AIR_DEFAULT = {
    sky: 'open', water: 'open',
    elev: 0.30,        // 0 sitting on the horizon, 1 straight overhead
    disc: 0.048,       // angular radius of the light body, 0 for none
    cloud: 0.30,       // the place's own baseline cover
    wxCloud: 1.0,      // how much the weather is allowed to add to it
    cloudY: 0.34       // deck altitude. low = big fast shapes overhead
  };

  function airOf(loc) {
    const a = loc.air || AIR_DEFAULT;
    return {
      sky: SKY_MODEL[a.sky === undefined ? 'open' : a.sky] || 0,
      water: WATER_MODEL[a.water === undefined ? 'open' : a.water] || 0,
      elev: a.elev === undefined ? AIR_DEFAULT.elev : a.elev,
      disc: a.disc === undefined ? AIR_DEFAULT.disc : a.disc,
      cloud: a.cloud === undefined ? AIR_DEFAULT.cloud : a.cloud,
      wxCloud: a.wxCloud === undefined ? AIR_DEFAULT.wxCloud : a.wxCloud,
      cloudY: a.cloudY === undefined ? AIR_DEFAULT.cloudY : a.cloudY,
      /* The zenith and the bed are colours, so they fall back to the two the
         location already had rather than to a constant — an undeclared sky
         darkens upward from its own top tone, and an undeclared bed is its
         own deep water lightened, which is what a bed under clear water
         actually looks like. */
      zen: a.zen || null,
      cloudTint: a.cloudTint || null,
      bed: a.bed || null
    };
  }

  /* The full resolved palette for this frame. */
  const P = {
    skyZen: [0, 0, 0], skyTop: [0, 0, 0], skyBot: [0, 0, 0], void: 0,
    waterTop: [0, 0, 0], waterBot: [0, 0, 0], bed: [0, 0, 0],
    glow: [255, 255, 255], glowSize: 1,
    fog: [0, 0, 0], fogAmt: 0,
    star: [255, 255, 255], starAlpha: 1,
    accent: [255, 255, 255],
    bright: 1, warm: 0,
    /* the air */
    skyModel: 0, waterModel: 0,
    lightElev: 0.3, discR: 0.05,
    cloudAmt: 0, cloudY: 0.34, cloudTint: [200, 210, 225]
  };

  /* What is left of a colour once the void has had it. Nothing down there is
     lit by the sky, so the day cycle stops reaching the tones long before the
     tones stop existing. */
  const VOID_TONE = [6, 3, 14];

  function apply(base, day, wx, k, vd) {
    let c = U.mixRgb(base, day.tint, day.k * (1 - vd * 0.85));
    c = c.map(function (v) { return v * U.lerp(1, day.bright, 0.78 * (1 - vd * 0.7)) * k; });
    if (wx) c = U.mixRgb(c, rgb(wx.c), wx.k * 0.30 * (1 - vd * 0.5));
    if (vd > 0) c = U.mixRgb(c, VOID_TONE, Math.pow(vd, 1.35) * 0.88);
    return c;
  }

  function update() {
    /* While the harbour is up it is the only thing on the screen, so one
       global palette is still one place's palette — and the port gets time of
       day and weather for nothing rather than authoring them a second time.
       See js/systems/place.js. */
    const loc = (VF.place && VF.place.isOpen() && VF.place.palette()) ||
                VF.locations.current();
    const day = dayKey(VF.time.cycle());
    const wx = VF.weather.tint();
    const light = VF.weather.light();

    const vd = U.clamp(loc.void || 0, 0, 1);
    const air = airOf(loc);
    P.void = vd;

    /* The deck, computed first because the star field reads it. The place's
       own baseline and whatever the weather is doing, whichever is thicker —
       a shore is not cloudless because it is a shore, and a cavern does not
       acquire an overcast because it started raining outside. `wxCloud` is
       how much of the weather a place's sky is even able to have. */
    P.cloudAmt = U.clamp(Math.max(air.cloud, VF.weather.cloud() * air.wxCloud) *
                         (1 - vd * 0.6), 0, 1);
    P.skyTop = apply(rgb(loc.sky[0]), day, wx, light, vd);
    P.skyBot = apply(rgb(loc.sky[1]), day, wx, light, vd);
    /* Straight up. Undeclared, it is the sky's own top tone taken down and
       cooled — which is what the top of a dome does, and what a two-stop ramp
       could never say because it had nowhere to say it. */
    P.skyZen = air.zen ? apply(rgb(air.zen), day, wx, light, vd)
                       : U.mixRgb(P.skyTop.map(function (v) { return v * 0.38; }),
                                  [8, 11, 26], 0.34);
    /* Past about three quarters the surface stops being a surface: the water
       tone is pulled up to meet the sky so there is no seam left to read as a
       horizon, which is most of what makes a place look like a place. */
    const merge = U.clamp((vd - 0.55) / 0.45, 0, 1);
    /* The sky lightening toward the horizon is what puts a bright band across
       the middle of the frame. It is the right instinct on a shore and the
       wrong one in a place with no horizon, so it flattens out as it goes. */
    P.skyBot = U.mixRgb(P.skyBot, P.skyTop, merge);
    P.waterTop = U.mixRgb(apply(rgb(loc.water[0]), day, wx, light * 0.92, vd),
                          P.skyBot, merge);
    /* And the water tone ends where it starts. Anything left between the two
       is a band across the middle of the frame saying there is a surface. */
    P.waterBot = U.mixRgb(apply(rgb(loc.water[1]), day, wx, light * 0.86, vd),
                          P.waterTop, merge);
    P.glow = U.mixRgb(rgb(loc.glow), day.glow, 0.45);
    P.glowSize = day.glowSize;
    P.fog = U.mixRgb(rgb(loc.fog), day.tint, day.k * 0.6);
    /* Fog is a thing air does. The band across the middle of the last water
       was this, at a tenth of an alpha, in a tone six times lighter than the
       ground it was sitting on. */
    P.fogAmt = U.clamp((loc.fogAmt + VF.weather.fog() * 0.55) * (1 - vd), 0, 1);
    P.star = rgb(loc.starTint);
    /* Some of them stay. Whatever those are, they are not stars, and there
       are fewer of them the further down you go. */
    /* And cloud takes them. This has to happen here rather than in the shader:
       the stars are drawn into the back buffer with the ridgeline and that
       buffer is composited over the sky, so a deck painted underneath them
       cannot cover them. A closed sky with every star still in it was the one
       thing that gave the new weather away. */
    /* A cavern has no stars. The three places with a closed sky were carrying
       a full star field on the underside of several million tonnes of rock,
       which is the single clearest way a scene can say "this is a backdrop
       and nobody thought about what is above you". */
    const roofed = air.sky === SKY_MODEL.closed ? 0 : 1;
    P.starAlpha = U.clamp(day.star * loc.stars * U.lerp(1, 0.35, VF.weather.fog()) *
                          (1 - vd * 0.72) * (1 - P.cloudAmt * 0.92) * roofed, 0, 1);
    P.accent = rgb(loc.glow);
    P.bright = day.bright * light;
    P.warm = day.warm;
    /* The hour's own exposure and saturation, for the post chain. Kept on P
       rather than read from the clock there, so everything about how a frame
       is lit arrives from one place. */
    P.dayEv = day.ev;
    P.daySat = day.sat;
    /* What the WEATHER is doing to the light, on its own, with the hour taken
       out. The post chain adapts its exposure to this and to nothing else —
       see js/gl/post.js. */
    P.wxLight = light;
    /* How high the light is, on its own arc through the day. 1 at midday, 0
       in the small hours. The sky shader bands its haze off this and the
       water lays its lane by it — a light that never rises is a zone with one
       hour in it, which is what nine of them had. */
    P.sunArc = sunArc();

    /* ---------------------------------------------------------- the air */

    P.skyModel = air.sky;
    P.waterModel = air.water;
    P.lightElev = air.elev;

    P.cloudY = air.cloudY;
    /* Cloud is lit sky, so its tone starts from the horizon's — and it warms
       with the day exactly as everything else does rather than being a fixed
       grey that goes wrong at dawn. */
    P.cloudTint = air.cloudTint ? apply(rgb(air.cloudTint), day, wx, light, vd)
                                : U.mixRgb(P.skyBot, day.tint, 0.42)
                                    .map(function (v) { return Math.min(255, v * 1.55 + 26); });

    /* And the body of light. It grows at the ends of the day the way the old
       glow did, and heavy cloud takes it away entirely — which is the whole
       of "you cannot see the moon tonight", drawn rather than described. */
    P.discR = U.clamp(air.disc * day.glowSize * (1 - P.cloudAmt * 0.88), 0, 0.6);

    /* What is under the water where you can see through it. Only the mirror
       and the still models read it. */
    P.bed = air.bed ? apply(rgb(air.bed), day, wx, light * 0.8, vd)
                    : U.mixRgb(P.waterBot, [130, 140, 128], 0.34);
    return P;
  }

  VF.palette = { P: P, update: update, rgb: rgb, sunArc: sunArc };
})(window.VF = window.VF || {});
