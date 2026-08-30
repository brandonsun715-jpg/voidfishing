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
    /* Every target is sized off the screen, so they all go. They rebuild
       lazily on the next frame that asks for one. */
    for (const k in targets) {
      gl.deleteFramebuffer(targets[k].fbo);
      gl.deleteTexture(targets[k].tex);
      delete targets[k];
    }
  }

  VF.gl = {
    init: init, resize: resize,
    program: program, pass: pass, target: target, clear: clear,
    setUniforms: setUniforms, uniform: uniform,
    ctx: function () { return gl; },
    ok: function () { return ok && !lost; },
    caps: caps,
    size: function () { return { w: W, h: H, dpr: DPR }; },
    QUAD_VS: QUAD_VS
  };
})(window.VF = window.VF || {});
