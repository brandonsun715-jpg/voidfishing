/* VOID FISHING — the GPU, and the rules for using it.

   The game has been Canvas 2D since the first line of it: one context, and
   about fourteen thousand lines of hand-tuned path art drawn into it. That art
   is the game's face and none of it is being thrown away. What is moving to
   the GPU is the part 2D was always bad at — the water, the air between you
   and the horizon, and the light — because those are full-screen and
   full-screen translucent fills are the single most expensive thing a 2D
   canvas does.

   THE ONE RULE THAT SHAPED THIS FILE. Pushing a full-screen 2D canvas into a
   texture costs 30ms here and is expensive even on real hardware: it is four
   and a half megabytes across the bus, every frame. So it is never done per
   frame. The world is drawn in GL, the figures are drawn in 2D on a canvas
   stacked above it, and the two never meet in memory. A 2D layer only becomes
   a texture when it is a bake that changed — the ridgeline, the star field —
   and those change a handful of times an hour.

   Everything here degrades. If there is no WebGL2, if the context is lost, or
   if a shader will not compile, `VF.gl.ok()` goes false and the renderer keeps
   its old 2D path. The game runs from file:// on whatever somebody has. */
(function (VF) {
  'use strict';

  let canvas = null, gl = null;
  let ok = false, lost = false;
  let W = 0, H = 0, DPR = 1;

  const programs = Object.create(null);
  const targets = Object.create(null);
  let quadVAO = null;

  /* ------------------------------------------------------------- context */

  function init(cv) {
    canvas = cv;
    try {
      gl = cv.getContext('webgl2', {
        alpha: true,               // the 2D layer sits above, so keep the alpha
        depth: false,              // everything here is a full-screen pass
        stencil: false,
        antialias: false,          // nothing is geometry-edged; post does the work
        premultipliedAlpha: true,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false
      });
    } catch (e) { gl = null; }
    if (!gl) return false;

    /* Float targets are what make an HDR chain possible — a bloom that works
       on values above one rather than on whatever survived being clamped. If
       the extension is missing the chain runs at 8 bits and looks flatter, and
       that is a fallback rather than a failure. */
    const fl = gl.getExtension('EXT_color_buffer_float');
    const li = gl.getExtension('OES_texture_float_linear');
    caps.float = !!fl;
    caps.floatLinear = !!li;
    caps.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);

    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      lost = true; ok = false;
      VF.bus.emit('gl:lost');
    }, false);
    cv.addEventListener('webglcontextrestored', function () {
      lost = false;
      for (const k in programs) delete programs[k];
      for (const k in targets) delete targets[k];
      quadVAO = null;
      ok = buildQuad();
      VF.bus.emit('gl:restored');
    }, false);

    ok = buildQuad();
    return ok;
  }

  const caps = { float: false, floatLinear: false, maxTex: 0 };

  /* One triangle that covers the screen. Not two — a single oversized triangle
     has no seam down the diagonal and rasterises marginally better, and every
     pass in this renderer is a full-screen pass. */
  /* uv.y runs 0 at the TOP, like every other coordinate in this game.

     GL's clip space is bottom-up and Canvas 2D is top-down, and the whole
     renderer — the horizon, the projection in js/world/space.js, every layout
     number in the scene — is top-down. Flipping here rather than in each
     fragment shader means there is exactly one place that knows, and the
     shaders read the same way as the code they sit next to. Getting it wrong
     draws the sky underneath the sea, which is precisely what it did. */
  const QUAD_VS = `#version 300 es
    out vec2 uv;
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      uv = vec2(p.x, 1.0 - p.y);
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;

  function buildQuad() {
    try {
      quadVAO = gl.createVertexArray();
      return true;
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------ programs */

  function compile(type, src, name) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('[gl] ' + name + ' ' +
        (type === gl.VERTEX_SHADER ? 'vertex' : 'fragment') + ':\n' +
        gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  /* A named program, compiled once and kept. Returns null on failure, and a
     null program is survivable everywhere it is used — a missing pass is a
     missing effect, not a black screen. */
  function program(name, fs, vs) {
    if (programs[name] !== undefined) return programs[name];
    if (!ok) return (programs[name] = null);
    const v = compile(gl.VERTEX_SHADER, vs || QUAD_VS, name);
    const f = v && compile(gl.FRAGMENT_SHADER, fs, name);
    if (!v || !f) return (programs[name] = null);
    const p = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.linkProgram(p);
    gl.deleteShader(v); gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      console.error('[gl] link ' + name + ': ' + gl.getProgramInfoLog(p));
      return (programs[name] = null);
    }
    /* Uniform locations are looked up once and cached on the program object.
       getUniformLocation is a string lookup into the driver and doing it per
       frame per uniform is a real cost at sixty frames a second. */
    p._u = Object.create(null);
    programs[name] = p;
    return p;
  }

  function uniform(p, name) {
    if (p._u[name] === undefined) p._u[name] = gl.getUniformLocation(p, name);
    return p._u[name];
  }

  /* Set uniforms from a plain object, by the shape of the value. Keeps the
     call sites reading as what they mean rather than as a wall of gl.uniform*. */
  function setUniforms(p, vals) {
    let unit = 0;
    for (const k in vals) {
      const loc = uniform(p, k);
      if (loc === null) continue;
      const v = vals[k];
      if (typeof v === 'number') gl.uniform1f(loc, v);
      else if (typeof v === 'boolean') gl.uniform1i(loc, v ? 1 : 0);
      /* An INT uniform has to say so. `typeof v === 'number'` means float here
         — every other uniform in the game is one and half of them are
         integral by coincidence — so a shader that selects a model with an
         int gets uniform1f, which is a GL error, and the selector silently
         stays at whatever it was. See int() below. */
      else if (v && v.__int !== undefined) gl.uniform1i(loc, v.__int);
      else if (v && v.__tex) {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v.tex);
        gl.uniform1i(loc, unit);
        unit++;
      } else if (v && v.length === 2) gl.uniform2f(loc, v[0], v[1]);
      else if (v && v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
      else if (v && v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    }
  }

  /* An integer uniform, wrapped so setUniforms can tell it from a float.
     Wrappers are cached rather than allocated: this is called for every model
     selector on every frame, and a per-frame object per uniform is exactly
     the kind of garbage a render loop should not make. */
  const INTS = [];
  function int(n) {
    n = n | 0;
    if (n < 0) n = 0;
    return INTS[n] || (INTS[n] = { __int: n });
  }

  /* ------------------------------------------------------------ geometry

     Everything in this file used to be a full-screen pass: one oversized
     triangle, no attributes, no buffers. The path renderer needs actual
     geometry, so this is the smallest thing that gives it some — a dynamic
     buffer per name, orphaned on every upload so the driver never has to wait
     for the last frame to finish reading it. */

  const buffers = Object.create(null);

  function buffer(name) {
    let b = buffers[name];
    if (b) return b;
    b = { buf: gl.createBuffer(), vao: gl.createVertexArray(), cap: 0, attrs: null };
    buffers[name] = b;
    return b;
  }

  /* Upload and describe in one call. `attrs` is [[location, size, offset], …]
     in floats, and the stride is worked out from the widest one — the layout
     is described once and then remembered on the VAO. */
  function upload(name, data, attrs, stride) {
    const b = buffer(name);
    gl.bindVertexArray(b.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.buf);
    /* Orphan: hand the driver a fresh store rather than waiting on the old
       one. This is the whole reason a per-frame dynamic buffer is affordable. */
    const bytes = data.byteLength;
    if (bytes > b.cap) {
      gl.bufferData(gl.ARRAY_BUFFER, Math.max(bytes, 65536), gl.STREAM_DRAW);
      b.cap = Math.max(bytes, 65536);
    } else {
      gl.bufferData(gl.ARRAY_BUFFER, b.cap, gl.STREAM_DRAW);
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
    const key = JSON.stringify(attrs) + ':' + stride;
    if (b.attrs !== key) {
      b.attrs = key;
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i];
        gl.enableVertexAttribArray(a[0]);
        gl.vertexAttribPointer(a[0], a[1], gl.FLOAT, false, stride * 4, a[2] * 4);
      }
    }
    return b;
  }

  /* Draw geometry with a program. The counterpart to `pass`, which draws the
     screen; this draws things in it. */
  function mesh(p, vals, b, count, mode) {
    if (!ok || !p || !count) return false;
    gl.useProgram(p);
    if (vals) setUniforms(p, vals);
    gl.bindVertexArray(b.vao);
    gl.drawArrays(mode === undefined ? gl.TRIANGLES : mode, 0, count);
    return true;
  }

  /* ------------------------------------------------------------- targets */

  /* A named offscreen buffer at some fraction of the screen. Bloom runs at a
     quarter and nobody can tell, which is most of why it is affordable. */
  function target(name, scale, float) {
    const w = Math.max(1, Math.round(W * (scale || 1)));
    const h = Math.max(1, Math.round(H * (scale || 1)));
    let t = targets[name];
    if (t && t.w === w && t.h === h) return t;
    if (t) { gl.deleteFramebuffer(t.fbo); gl.deleteTexture(t.tex); }

    const wantFloat = float !== false && caps.float;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, wantFloat ? gl.RGBA16F : gl.RGBA8,
                  w, h, 0, gl.RGBA, wantFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
    const smooth = !wantFloat || caps.floatLinear;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, smooth ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, smooth ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    t = { __tex: 1, name: name, tex: tex, fbo: fbo, w: w, h: h };
    targets[name] = t;
    return t;
  }

  /* --------------------------------------------------------------- MSAA

     Canvas 2D antialiases every path it draws. A GL context created with
     `antialias:false` — which this one is, because every pass so far has been
     full-screen and had no edges — does not, so path art drawn straight to it
     comes out with hard stair-stepped edges and looks nothing like the art it
     replaced.

     WebGL2 can multisample an offscreen buffer, which WebGL1 could not: a
     multisampled renderbuffer to draw into, and a blit to resolve it into an
     ordinary texture. Measured here: MAX_SAMPLES is 4, and RGBA8 supports 4×.

     This is the piece that makes the migration possible at all. Without it
     there is no version of the ported art that matches the original. */
  function msaa(name, scale) {
    const w = Math.max(1, Math.round(W * DPR * (scale || 1)));
    const h = Math.max(1, Math.round(H * DPR * (scale || 1)));
    let t = targets['ms:' + name];
    if (t && t.w === w && t.h === h) return t;
    if (t) {
      gl.deleteFramebuffer(t.fbo); gl.deleteRenderbuffer(t.rb);
      if (t.sb) gl.deleteRenderbuffer(t.sb);
    }

    /* Samples off the quality dial. Two full-resolution 4x multisampled
       buffers per frame — one for each art layer — is the largest single
       piece of bandwidth this renderer spends, and it was spending it the
       same way on every machine. Four is worth having on the edges of a
       headland; on a low setting it is worth nothing at all. */
    const want = { low: 1, medium: 2, cinematic: 4 }[
      (VF.state && VF.state.data && VF.state.data.settings.quality) || 'high'];
    const samples = Math.min(want === undefined ? 4 : want,
                             gl.getParameter(gl.MAX_SAMPLES) || 0);
    const rb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
    if (samples > 1) {
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.RGBA8, w, h);
    } else {
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, w, h);
    }
    /* And a stencil beside it, because `clip` is a real thing the art does —
       thirty call sites, and two of them are the cliff faces that the strata
       are drawn inside. A clip to an arbitrary shape is a stencil or it is
       nothing. */
    const sb = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, sb);
    if (samples > 1) {
      gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH24_STENCIL8, w, h);
    } else {
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h);
    }
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, sb);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    t = { __ms: 1, name: name, fbo: fbo, rb: rb, sb: sb, w: w, h: h, samples: samples };
    targets['ms:' + name] = t;
    return t;
  }

  /* Resolve a multisampled buffer down. `to` null means the screen, which is
     the ordinary case: draw the art at 4× into the offscreen buffer and blit
     it onto the canvas in one go. */
  function resolve(from, to) {
    if (!ok || !from) return false;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from.fbo);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to ? to.fbo : null);
    const dw = to ? to.w : Math.round(W * DPR), dh = to ? to.h : Math.round(H * DPR);
    gl.blitFramebuffer(0, 0, from.w, from.h, 0, 0, dw, dh,
                       gl.COLOR_BUFFER_BIT, gl.LINEAR);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  /* Bind a target (multisampled or not) and set the viewport to it. */
  function bind(t) {
    if (!ok) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
    gl.viewport(0, 0, t ? t.w : Math.round(W * DPR), t ? t.h : Math.round(H * DPR));
  }

  /* ------------------------------------------------------------ textures

     A 2D canvas becomes a texture only when the bake behind it changed — the
     star field, the cloud layers, the ridgeline, a glyph sheet. `version` is
     whatever the caller uses to know that: a key string, a counter. Passing
     the same one twice costs nothing. */
  function texture(name, source, version, smooth) {
    let t = targets['tx:' + name];
    if (t && t.version === version) return t;
    if (!t) {
      t = { __tex: 1, name: name, tex: gl.createTexture(), w: 0, h: 0, version: null };
      targets['tx:' + name] = t;
    }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    const f = smooth === false ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.w = source.width; t.h = source.height; t.version = version;
    return t;
  }

  /* Raw pixels, already premultiplied.

     texture() above hands a canvas to texImage2D with
     UNPACK_PREMULTIPLY_ALPHA_WEBGL on, which means the browser reads the
     canvas back UNPREMULTIPLIED and then premultiplies it again. For anything
     opaque that round trip is lossless and nobody notices. For a nearly
     transparent colour it destroys the colour outright: a fill at alpha
     2/255 is stored premultiplied as round(28 * 2/255) = 0, un-premultiplies
     to 0, and comes back black — so the GPU darkens where the 2D canvas
     tints. This takes bytes that are already premultiplied and uploads them
     as they are. */
  function textureData(name, data, w, h, version, smooth) {
    let t = targets['tx:' + name];
    if (t && t.version === version) return t;
    if (!t) {
      t = { __tex: 1, name: name, tex: gl.createTexture(), w: 0, h: 0, version: null };
      targets['tx:' + name] = t;
    }
    gl.bindTexture(gl.TEXTURE_2D, t.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    const f = smooth === false ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.w = w; t.h = h; t.version = version;
    return t;
  }

  /* ------------------------------------------------------------- blending

     Three modes, because three is what the art uses ON A LIVE CONTEXT: 132 of
     the 157 globalCompositeOperation calls are 'lighter', 16 are
     'source-over', and three are 'destination-out' — the void flag on a boat
     and two knocked-out holes in fishArt.

     The other six exotic calls turn out not to matter at all. Both 'source-in'
     uses and all three of 'multiply', 'destination-in' and 'source-atop' are
     on private scratch canvases that build a mask or a bake and are never
     handed a GPU context; 'saturation' is in drawWrong, which runs after the
     whole stage list on the 2D canvas above it. Six operations that looked
     like a wall and are not in the way. */
  /* Is this texture already uploaded at this version? A cache that paints its
     own source lazily has to be able to ask, rather than assume — assuming is
     what made the resize bug above invisible for a whole round. */
  function hasTexture(name, version) {
    const t = targets['tx:' + name];
    return !!(t && t.version === version);
  }

  function blend(mode) {
    if (!ok) return;
    gl.enable(gl.BLEND);
    if (mode === 'lighter') gl.blendFunc(gl.ONE, gl.ONE);
    /* An absence rather than a colour: the source's alpha is subtracted from
       what is already there and none of its colour is added. Exact, on
       premultiplied content. */
    else if (mode === 'destination-out') gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    else gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }

  /* Draw one full-screen pass. `to` is a target or null for the screen. */
  function pass(p, vals, to) {
    if (!ok || !p) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, to ? to.fbo : null);
    gl.viewport(0, 0, to ? to.w : Math.round(W * DPR), to ? to.h : Math.round(H * DPR));
    gl.useProgram(p);
    if (vals) setUniforms(p, vals);
    gl.bindVertexArray(quadVAO);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  function clear(r, g2, b, a) {
    if (!ok) return;
    gl.clearColor(r || 0, g2 || 0, b || 0, a === undefined ? 0 : a);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /* --------------------------------------------------------------- size */

  function resize(w, h, dpr) {
    if (!canvas) return;
    W = w; H = h; DPR = dpr;
    const cw = Math.max(1, Math.round(w * dpr));
    const ch = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw; canvas.height = ch;
    }
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    /* Offscreen BUFFERS are sized off the screen, so they all go and rebuild
       lazily on the next frame that asks for one.

       UPLOADED TEXTURES ARE NOT. The star field, the cloud layers, the
       ridgeline, the shoal's silhouettes and the gradient ramps have nothing
       to do with the size of the window, and dropping them here was a real
       bug with a long fuse: the caches that own them live in js/gl/path.js and
       went on believing they were uploaded, so the next cache HIT re-uploaded
       whatever unrelated thing the shared 256x1 strip happened to hold at the
       time — and served that ramp, under the right key, for the life of the
       page. Every gradient in the game came out at nearly four times its
       contrast, and only after a resize, which is why the frame looked right
       and the comparison tool did not. */
    for (const k in targets) {
      const t = targets[k];
      if (k.indexOf('tx:') === 0) continue;
      if (t.fbo) gl.deleteFramebuffer(t.fbo);
      if (t.tex) gl.deleteTexture(t.tex);
      if (t.rb) gl.deleteRenderbuffer(t.rb);
      if (t.sb) gl.deleteRenderbuffer(t.sb);
      delete targets[k];
    }
  }

  VF.gl = {
    int: int,
    init: init, resize: resize,
    program: program, pass: pass, target: target, clear: clear,
    textureData: textureData,
    setUniforms: setUniforms, uniform: uniform,
    buffer: buffer, upload: upload, mesh: mesh,
    msaa: msaa, resolve: resolve, bind: bind, texture: texture, blend: blend,
    hasTexture: hasTexture,
    ctx: function () { return gl; },
    ok: function () { return ok && !lost; },
    caps: caps,
    size: function () { return { w: W, h: H, dpr: DPR }; },
    QUAD_VS: QUAD_VS
  };
})(window.VF = window.VF || {});
