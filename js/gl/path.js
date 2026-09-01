/* VOID FISHING — the path renderer.

   Fourteen thousand lines of this game are hand-tuned Canvas 2D path art:
   beziers, gradients, clips, a hundred and thirty-two additive blends. It is
   the game's face. Moving it to the GPU cannot mean redrawing it, so this file
   is not a new way to draw — it is a CanvasRenderingContext2D-shaped object
   that happens to be a GPU.

   `VF.glPath.context()` answers to moveTo, quadraticCurveTo, fill, stroke,
   createLinearGradient, save, restore and the rest of the subset the art
   actually uses, so a module ports by being handed a different object and is
   not edited at all. 185 of the 603 drawing functions in js/render already
   take their context as the first argument. That is the whole reason this is
   possible.

   WHAT IT DOES NOT DO, and says so rather than approximating:

     multi-subpath fills   855 of the 888 path builds in this codebase are a
                           single closed shape. The 33 that are not, and every
                           even-odd fill (four call sites, all of them in the
                           chart and the harbour), fall back to Canvas 2D.
     shadowBlur            two calls, both in cosmeticArt.
     the exotic blends     nine calls in the whole game — destination-out,
                           source-in, saturation, multiply. 'lighter' and
                           'source-over' are 147 of the 157.

   `unsupported()` reports what a frame hit, so the migration harness can fail
   the build rather than let something quietly not draw.

   TWO THINGS ARE BORROWED FROM THE REFERENCE IMPLEMENTATION ON PURPOSE.
   Colours are parsed by painting them into a 1×1 2D canvas and reading the
   bytes back, and gradients are rasterised by painting the real CanvasGradient
   into a 256×1 canvas and uploading that as a lookup. Both are cached. It
   means every colour string the browser accepts works, and a gradient is not
   an approximation of Canvas's — it IS Canvas's, sampled. When the bar is
   "nothing may look different", the cheapest way to match a rasteriser is to
   ask it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------- shaders */

  const VS = `#version 300 es
    layout(location = 0) in vec2 aPos;
    layout(location = 1) in vec4 aCol;
    uniform vec2 res;
    out vec4 vCol;
    out vec2 vPos;
    void main() {
      vCol = aCol;
      vPos = aPos;
      /* Device pixels in, clip space out, with y running DOWN — every
         coordinate in this game is top-down and the art is written that way. */
      vec2 c = aPos / res * 2.0 - 1.0;
      gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
    }`;

  const FS = `#version 300 es
    precision highp float;
    in vec4 vCol;
    in vec2 vPos;
    out vec4 frag;

    uniform int   mode;      // 0 flat, 1 linear, 2 radial
    uniform vec4  g0;        // linear (x0,y0,x1,y1) · radial (x0,y0,r0,_)
    uniform vec4  g1;        // radial (x1,y1,r1,_)
    uniform float alpha;
    uniform sampler2D stops;

    void main() {
      if (mode == 0) { frag = vCol * alpha; return; }

      float t;
      if (mode == 1) {
        vec2 d = g0.zw - g0.xy;
        float len2 = dot(d, d);
        t = len2 > 0.0 ? dot(vPos - g0.xy, d) / len2 : 0.0;
      } else {
        /* The two-circle radial of the canvas spec: find the largest s for
           which the point lies on the circle interpolated between (c0,r0) and
           (c1,r1). Solved as a quadratic, exactly as the reference does. */
        vec2 c0 = g0.xy, c1 = g1.xy;
        float r0 = g0.z, r1 = g1.z;
        vec2 cd = c1 - c0;
        float dr = r1 - r0;
        vec2 pd = vPos - c0;
        float a = dot(cd, cd) - dr * dr;
        float b = dot(pd, cd) + r0 * dr;
        float c = dot(pd, pd) - r0 * r0;
        if (abs(a) < 1e-6) {
          t = abs(b) > 1e-9 ? c / (2.0 * b) : 0.0;
        } else {
          float disc = b * b - a * c;
          if (disc < 0.0) { frag = vec4(0.0); return; }
          float sq = sqrt(disc);
          float t1 = (b + sq) / a, t2 = (b - sq) / a;
          t = max(t1, t2);
          if (r0 + t * dr < 0.0) t = min(t1, t2);
          if (r0 + t * dr < 0.0) { frag = vec4(0.0); return; }
        }
      }
      frag = texture(stops, vec2(clamp(t, 0.0, 1.0), 0.5)) * alpha;
    }`;

  let prog = null, failed = false;
  let W = 0, H = 0;                 // device pixels of whatever we draw into
  const hit = {};                   // what a frame could not do

  function note(what) { hit[what] = (hit[what] | 0) + 1; }

  /* ------------------------------------------------------- borrowed colour

     A 1×1 canvas is the only colour parser that agrees with the one the art
     was tuned against, and it is right about 'hsl(200 30% 40% / .5)' and
     'rebeccapurple' without this file knowing they exist. Cached, so the cost
     is one fillRect per distinct string in the life of the page. */
  let probe = null, probeCtx = null;
  const colours = Object.create(null);

  function parse(css) {
    if (typeof css !== 'string') return [0, 0, 0, 1];
    let c = colours[css];
    if (c) return c;
    if (!probe) {
      probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      probeCtx = probe.getContext('2d', { willReadFrequently: true });
    }
    probeCtx.clearRect(0, 0, 1, 1);
    probeCtx.fillStyle = '#000';
    probeCtx.fillStyle = css;
    probeCtx.fillRect(0, 0, 1, 1);
    const d = probeCtx.getImageData(0, 0, 1, 1).data;
    /* getImageData is unpremultiplied, which is what we want to keep and
       premultiply ourselves at vertex time. */
    c = [d[0] / 255, d[1] / 255, d[2] / 255, d[3] / 255];
    colours[css] = c;
    return c;
  }

  /* ---------------------------------------------------- borrowed gradient

     Paint the real CanvasGradient into a 256×1 strip and upload it. The stops
     interpolate exactly as Canvas interpolates them because Canvas did the
     interpolating. */
  let lut = null, lutCtx = null;

  /* The art builds its gradients fresh inside the draw call — `const grad =
     g.createLinearGradient(...)` on every frame, at 223 call sites. So the
     cache cannot be keyed on the gradient OBJECT: that is a new GL texture
     sixty times a second, none of them ever deleted. It is keyed on the ramp
     itself, in a fixed ring of slots, so the same three stops asked for again
     next frame cost one lookup and the whole game costs LUTS textures for the
     life of the page. A ramp is only the stops — a linear and a radial with
     the same colours share one strip. */
  const LUTS = 32;
  const lutKey = new Array(LUTS);
  const lutSlot = Object.create(null);
  let lutNext = 0;

  function ramp(g) {
    let sig = '';
    for (let i = 0; i < g._stops.length; i++) {
      sig += U.clamp(g._stops[i][0], 0, 1).toFixed(4) + '\u0001' + g._stops[i][1] + '\u0002';
    }
    return sig;
  }

  function gradientTexture(g) {
    const sig = g._sig || (g._sig = ramp(g));
    let slot = lutSlot[sig];
    if (slot === undefined) {
      slot = lutNext; lutNext = (lutNext + 1) % LUTS;
      if (lutKey[slot] !== undefined) delete lutSlot[lutKey[slot]];
      lutKey[slot] = sig; lutSlot[sig] = slot;
      if (!lut) {
        lut = document.createElement('canvas');
        lut.width = 256; lut.height = 1;
        lutCtx = lut.getContext('2d', { willReadFrequently: true });
      }
      lutCtx.clearRect(0, 0, 256, 1);
      const strip = lutCtx.createLinearGradient(0, 0, 256, 0);
      for (let i = 0; i < g._stops.length; i++) {
        strip.addColorStop(U.clamp(g._stops[i][0], 0, 1), g._stops[i][1]);
      }
      lutCtx.fillStyle = strip;
      lutCtx.fillRect(0, 0, 256, 1);
    }
    g._slot = slot;
    /* On a hit VF.gl.texture matches the version and returns without reading
       the canvas, so the stale `lut` above is never sampled. */
    return VF.gl.texture('grad' + slot, lut, sig);
  }

  function Gradient(kind, a) {
    this._kind = kind; this._a = a;
    this._stops = []; this._sig = null; this._slot = -1;
  }
  Gradient.prototype.addColorStop = function (o, css) {
    this._stops.push([o, css]); this._sig = null;
    return this;
  };

  /* ------------------------------------------------------------ geometry */

  /* How finely to flatten a curve. Canvas picks a tolerance in device pixels;
     so does this, off the current transform's scale, so a shape drawn small
     costs few segments and the same shape drawn large stays smooth. */
  function steps(len) { return U.clamp(Math.ceil(Math.sqrt(len * 1.4)), 3, 96); }

  /* Ear clipping. Correct for any simple polygon — concave, any winding — and
     that is 96% of the paths in this game. It is not correct for one that
     crosses itself, and neither is anything else this cheap; the harness
     compares against Canvas and would show it. */
  function triangulate(pts, out) {
    const n = pts.length / 2;
    if (n < 3) return;
    /* Drop vertices that sit on top of the one before them, and the closing
       vertex when it repeats the opening one — which every `moveTo(a) … lineTo(a)
       closePath()` in this game produces, and that is most of them. A repeated
       point lies exactly ON both edges beside it, the containment test below
       counts a point on an edge as inside, and so no corner near it can ever be
       clipped: the fill stalls partway and the shape comes out with a straight
       bite taken out of it. */
    const idx = [];
    for (let i = 0; i < n; i++) {
      const px = pts[i * 2], py = pts[i * 2 + 1];
      if (idx.length) {
        const q = idx[idx.length - 1];
        if (Math.abs(pts[q * 2] - px) < 1e-6 && Math.abs(pts[q * 2 + 1] - py) < 1e-6) continue;
      }
      idx.push(i);
    }
    while (idx.length > 2) {
      const a = idx[0], b = idx[idx.length - 1];
      if (Math.abs(pts[a * 2] - pts[b * 2]) < 1e-6 &&
          Math.abs(pts[a * 2 + 1] - pts[b * 2 + 1]) < 1e-6) idx.pop();
      else break;
    }
    if (idx.length < 3) return;
    /* Orientation, so the ear test knows which side is inside. The ear test
       below wants a positive cross product at a convex corner, which in these
       y-down screen coordinates is the winding the shoelace sum calls
       NEGATIVE. Getting this backwards costs nothing visible in a triangle
       and everything in anything larger: every corner reads as reflex, no ear
       is ever found, and the function returns nothing at all. */
    let area = 0;
    for (let i = 0, j = idx.length - 1; i < idx.length; j = i++) {
      area += pts[idx[j] * 2] * pts[idx[i] * 2 + 1] - pts[idx[i] * 2] * pts[idx[j] * 2 + 1];
    }
    if (area < 0) idx.reverse();

    let guard = n * n + 32;
    while (idx.length > 3 && guard-- > 0) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i + idx.length - 1) % idx.length];
        const b = idx[i];
        const c = idx[(i + 1) % idx.length];
        const ax = pts[a * 2], ay = pts[a * 2 + 1];
        const bx = pts[b * 2], by = pts[b * 2 + 1];
        const cx = pts[c * 2], cy = pts[c * 2 + 1];
        const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
        if (cross <= 0) continue;                       // reflex
        let ok = true;
        for (let k = 0; k < idx.length; k++) {
          const p = idx[k];
          if (p === a || p === b || p === c) continue;
          const px = pts[p * 2], py = pts[p * 2 + 1];
          if (inside(ax, ay, bx, by, cx, cy, px, py)) { ok = false; break; }
        }
        if (!ok) continue;
        out.push(ax, ay, bx, by, cx, cy);
        idx.splice(i, 1);
        clipped = true;
        break;
      }
      /* No ear anywhere means the ring is degenerate here — three collinear
         points, or an outline that crosses itself. Abandoning it leaves a
         PARTLY filled shape, which is the one failure that reads as art gone
         wrong rather than as art missing, so instead the flattest corner is
         removed and the clip carries on. A corner flat enough to be rounding
         goes quietly; anything with real area in it says so, because that is a
         path this cannot be trusted with. */
      if (!clipped) {
        let flat = 0, least = Infinity;
        for (let i = 0; i < idx.length; i++) {
          const a = idx[(i + idx.length - 1) % idx.length];
          const b = idx[i];
          const c = idx[(i + 1) % idx.length];
          const k = Math.abs((pts[b * 2] - pts[a * 2]) * (pts[c * 2 + 1] - pts[a * 2 + 1]) -
                             (pts[b * 2 + 1] - pts[a * 2 + 1]) * (pts[c * 2] - pts[a * 2]));
          if (k < least) { least = k; flat = i; }
        }
        if (least > 0.5) note('fill:self-intersecting');
        idx.splice(flat, 1);
      }
    }
    if (idx.length === 3) {
      for (let i = 0; i < 3; i++) out.push(pts[idx[i] * 2], pts[idx[i] * 2 + 1]);
    }
  }

  /* Strictly inside. A point exactly ON an edge is NOT blocking — a shared
     vertex, a coincident point or a touching outline is otherwise enough to
     make a perfectly good ear unclippable. */
  function inside(ax, ay, bx, by, cx, cy, px, py) {
    const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
    const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
    const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
    const e = 1e-9;
    return (d1 < -e && d2 < -e && d3 < -e) || (d1 > e && d2 > e && d3 > e);
  }

  /* A polyline expanded to a ribbon of the given width, with joins and caps.
     Round joins and caps are fanned; the art asks for round almost everywhere
     (54 lineCap sets, 13 lineJoin) because everything in it is organic. */
  function strokePoly(pts, closed, w, cap, join, out) {
    const n = pts.length / 2;
    if (n < 2) {
      if (n === 1 && cap === 'round') fan(pts[0], pts[1], w * 0.5, out);
      return;
    }
    const h = w * 0.5;
    for (let i = 0; i < n - 1; i++) {
      seg(pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3], h, out);
    }
    if (closed && n > 2) seg(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], pts[0], pts[1], h, out);

    /* Joins. A disc at every interior vertex is a round join and is also a
       perfectly good stand-in for a miter at the widths this art uses — the
       widest stroke in the game is a few pixels. */
    const first = closed ? 0 : 1;
    const last = closed ? n : n - 1;
    for (let i = first; i < last; i++) fan(pts[i * 2], pts[i * 2 + 1], h, out);

    if (!closed && cap === 'round') {
      fan(pts[0], pts[1], h, out);
      fan(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], h, out);
    } else if (!closed && cap === 'square') {
      square(pts[2], pts[3], pts[0], pts[1], h, out);
      square(pts[(n - 2) * 2], pts[(n - 2) * 2 + 1], pts[(n - 1) * 2], pts[(n - 1) * 2 + 1], h, out);
    }
  }

  function seg(x0, y0, x1, y1, h, out) {
    const dx = x1 - x0, dy = y1 - y0;
    const m = Math.hypot(dx, dy);
    if (m < 1e-6) return;
    const nx = -dy / m * h, ny = dx / m * h;
    out.push(x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny);
    out.push(x0 + nx, y0 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny);
  }

  function fan(cx, cy, r, out) {
    const n = U.clamp(Math.ceil(r * 1.6), 6, 28);
    let px = cx + r, py = cy;
    for (let i = 1; i <= n; i++) {
      const a = i / n * TAU;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      out.push(cx, cy, px, py, x, y);
      px = x; py = y;
    }
  }

  function square(fx, fy, x, y, h, out) {
    const dx = x - fx, dy = y - fy;
    const m = Math.hypot(dx, dy);
    if (m < 1e-6) return;
    const ux = dx / m * h, uy = dy / m * h;
    const nx = -uy, ny = ux;
    out.push(x + nx, y + ny, x + nx + ux, y + ny + uy, x - nx + ux, y - ny + uy);
    out.push(x + nx, y + ny, x - nx + ux, y - ny + uy, x - nx, y - ny);
  }

  /* --------------------------------------------------------- the batcher

     Triangles pile up in one array and go to the GPU when the paint changes,
     the blend changes, or the frame ends. A flat colour is per-vertex, so a
     hundred differently coloured shapes are one draw; a gradient is a uniform,
     so it costs a flush. There are 223 gradient call sites in the whole game
     and a handful are live in any frame, which is a price worth paying to have
     them exact. */
  let verts = [], count = 0;
  let paint = null, blendMode = 'source-over', alpha = 1;

  function key(p) {
    return p ? (p.kind + ':' + p.id) : 'flat';
  }

  function want(nextPaint, nextBlend, nextAlpha) {
    if (key(nextPaint) !== key(paint) || nextBlend !== blendMode ||
        (nextPaint && nextAlpha !== alpha)) {
      flush();
      paint = nextPaint; blendMode = nextBlend; alpha = nextAlpha;
    }
  }

  function push(tris, r, g, b, a) {
    for (let i = 0; i < tris.length; i += 2) {
      /* premultiplied, because the target blends premultiplied */
      verts.push(tris[i], tris[i + 1], r * a, g * a, b * a, a);
      count++;
    }
  }

  function flush() {
    if (!count || !prog) { verts.length = 0; count = 0; return; }
    const gl = VF.gl.ctx();
    VF.gl.blend(blendMode);
    const b = VF.gl.upload('path', new Float32Array(verts),
                           [[0, 2, 0], [1, 4, 2]], 6);
    const vals = { res: [W, H], alpha: paint ? alpha : 1 };
    if (!paint) {
      vals.mode = 0;
    } else if (paint.kind === 'linear') {
      vals.mode = 1;
      vals.g0 = paint.a;
      vals.stops = paint.tex;
    } else {
      vals.mode = 2;
      vals.g0 = [paint.a[0], paint.a[1], paint.a[2], 0];
      vals.g1 = [paint.a[3], paint.a[4], paint.a[5], 0];
      vals.stops = paint.tex;
    }
    /* `mode` is an int uniform and setUniforms sends numbers as floats, so it
       is set directly rather than through the shape-guessing path. */
    gl.useProgram(prog);
    gl.uniform1i(VF.gl.uniform(prog, 'mode'), vals.mode);
    delete vals.mode;
    VF.gl.mesh(prog, vals, b, count);
    verts.length = 0; count = 0;
  }

  /* --------------------------------------------------------- the context */

  function Ctx() {
    this._m = [1, 0, 0, 1, 0, 0];
    this._stack = [];
    this._sub = [];          // subpaths: arrays of device-space coords
    this._cur = null;
    this._sx = 0; this._sy = 0;   // subpath start, for closePath
    this.fillStyle = '#000';
    this.strokeStyle = '#000';
    this.lineWidth = 1;
    this.lineCap = 'butt';
    this.lineJoin = 'miter';
    this.miterLimit = 10;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    this.font = '';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetic';
  }

  const P = Ctx.prototype;

  /* --- transform --- */
  function mul(m, n) {
    return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
            m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
            m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  }
  P.save = function () {
    this._stack.push({
      m: this._m.slice(), fill: this.fillStyle, stroke: this.strokeStyle,
      lw: this.lineWidth, cap: this.lineCap, join: this.lineJoin,
      ga: this.globalAlpha, gco: this.globalCompositeOperation,
      font: this.font, ta: this.textAlign, tb: this.textBaseline,
      clips: this._clips ? this._clips.length : 0
    });
  };
  P.restore = function () {
    const s = this._stack.pop();
    if (!s) return;
    this._m = s.m; this.fillStyle = s.fill; this.strokeStyle = s.stroke;
    this.lineWidth = s.lw; this.lineCap = s.cap; this.lineJoin = s.join;
    this.globalAlpha = s.ga; this.globalCompositeOperation = s.gco;
    this.font = s.font; this.textAlign = s.ta; this.textBaseline = s.tb;
    if (this._clips && this._clips.length !== s.clips) {
      this._clips.length = s.clips;
      applyClips(this._clips);
    }
  };
  P.translate = function (x, y) { this._m = mul(this._m, [1, 0, 0, 1, x, y]); };
  P.scale = function (x, y) { this._m = mul(this._m, [x, 0, 0, y, 0, 0]); };
  P.rotate = function (a) {
    const c = Math.cos(a), s = Math.sin(a);
    this._m = mul(this._m, [c, s, -s, c, 0, 0]);
  };
  P.transform = function (a, b, c, d, e, f) { this._m = mul(this._m, [a, b, c, d, e, f]); };
  P.setTransform = function (a, b, c, d, e, f) { this._m = [a, b, c, d, e, f]; };
  P.resetTransform = function () { this._m = [1, 0, 0, 1, 0, 0]; };

  P._pt = function (x, y) {
    const m = this._m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  };
  P._scale = function () {
    const m = this._m;
    return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) * 0.5;
  };

  /* --- building --- */
  P.beginPath = function () { this._sub = []; this._cur = null; };
  P.moveTo = function (x, y) {
    const p = this._pt(x, y);
    this._cur = [p[0], p[1]];
    this._sub.push({ pts: this._cur, closed: false });
    this._sx = p[0]; this._sy = p[1];
  };
  P.lineTo = function (x, y) {
    if (!this._cur) return this.moveTo(x, y);
    const p = this._pt(x, y);
    this._cur.push(p[0], p[1]);
  };
  P.closePath = function () {
    if (this._sub.length) this._sub[this._sub.length - 1].closed = true;
  };
  P.quadraticCurveTo = function (cx, cy, x, y) {
    if (!this._cur) this.moveTo(cx, cy);
    const a = [this._cur[this._cur.length - 2], this._cur[this._cur.length - 1]];
    const c = this._pt(cx, cy), e = this._pt(x, y);
    const n = steps(Math.hypot(c[0] - a[0], c[1] - a[1]) + Math.hypot(e[0] - c[0], e[1] - c[1]));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      this._cur.push(u * u * a[0] + 2 * u * t * c[0] + t * t * e[0],
                     u * u * a[1] + 2 * u * t * c[1] + t * t * e[1]);
    }
  };
  P.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
    if (!this._cur) this.moveTo(c1x, c1y);
    const a = [this._cur[this._cur.length - 2], this._cur[this._cur.length - 1]];
    const b = this._pt(c1x, c1y), c = this._pt(c2x, c2y), e = this._pt(x, y);
    const n = steps(Math.hypot(b[0] - a[0], b[1] - a[1]) +
                    Math.hypot(c[0] - b[0], c[1] - b[1]) +
                    Math.hypot(e[0] - c[0], e[1] - c[1]));
    for (let i = 1; i <= n; i++) {
      const t = i / n, u = 1 - t;
      const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
      this._cur.push(w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * e[0],
                     w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * e[1]);
    }
  };
  P.arc = function (x, y, r, a0, a1, ccw) { this.ellipse(x, y, r, r, 0, a0, a1, ccw); };
  P.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) {
    let d = a1 - a0;
    if (!ccw && d < 0) d = (d % TAU) + TAU;
    if (ccw && d > 0) d = (d % TAU) - TAU;
    if (Math.abs(d) > TAU) d = d > 0 ? TAU : -TAU;
    const n = U.clamp(Math.ceil(Math.abs(d) / TAU * steps(Math.max(rx, ry) * this._scale() * 7)), 4, 128);
    const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (let i = 0; i <= n; i++) {
      const a = a0 + d * (i / n);
      const px = Math.cos(a) * rx, py = Math.sin(a) * ry;
      const ux = x + px * cr - py * sr, uy = y + px * sr + py * cr;
      if (i === 0 && !this._cur) this.moveTo(ux, uy);
      else this.lineTo(ux, uy);
    }
  };
  P.rect = function (x, y, w, h) {
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h);
    this.lineTo(x, y + h); this.closePath();
  };
  P.roundRect = function (x, y, w, h, r) {
    const k = typeof r === 'number' ? r : (r && r[0]) || 0;
    const rr = Math.min(k, Math.abs(w) / 2, Math.abs(h) / 2);
    this.moveTo(x + rr, y);
    this.lineTo(x + w - rr, y);
    this.quadraticCurveTo(x + w, y, x + w, y + rr);
    this.lineTo(x + w, y + h - rr);
    this.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    this.lineTo(x + rr, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - rr);
    this.lineTo(x, y + rr);
    this.quadraticCurveTo(x, y, x + rr, y);
    this.closePath();
  };
  P.arcTo = function (x1, y1, x2, y2) { this.lineTo(x1, y1); this.lineTo(x2, y2); };

  /* --- paint --- */
  P.createLinearGradient = function (x0, y0, x1, y1) {
    const a = this._pt(x0, y0), b = this._pt(x1, y1);
    return new Gradient('linear', [a[0], a[1], b[0], b[1]]);
  };
  P.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
    const a = this._pt(x0, y0), b = this._pt(x1, y1), s = this._scale();
    return new Gradient('radial', [a[0], a[1], r0 * s, b[0], b[1], r1 * s]);
  };
  P.createPattern = function () { note('createPattern'); return '#000'; };
  P.createConicGradient = function () { note('createConicGradient'); return '#000'; };

  function paintOf(style) {
    if (style instanceof Gradient) {
      const tex = gradientTexture(style);
      /* The batch key is the ramp AND where it is put, because both are
         uniforms. Two fills asking for the same gradient in the same place —
         which the art does constantly, drawing a shape and then its shadow —
         then land in one draw instead of three. */
      return { kind: style._kind, id: style._slot + '@' + style._a.join(','),
               a: style._a, tex: tex };
    }
    return null;
  }

  P._blend = function () {
    const g = this.globalCompositeOperation;
    if (g === 'lighter') return 'lighter';
    if (g && g !== 'source-over') note('blend:' + g);
    return 'source-over';
  };

  P._emit = function (tris, style) {
    if (!tris.length) return;
    const pnt = paintOf(style);
    want(pnt, this._blend(), this.globalAlpha);
    if (pnt) {
      push(tris, 1, 1, 1, 1);
    } else {
      const c = parse(style);
      push(tris, c[0], c[1], c[2], c[3] * this.globalAlpha);
    }
  };

  P.fill = function (rule) {
    if (rule === 'evenodd') { note('fill:evenodd'); return; }
    if (this._sub.length > 1) { note('fill:multi-subpath'); return; }
    const tris = [];
    for (let i = 0; i < this._sub.length; i++) triangulate(this._sub[i].pts, tris);
    this._emit(tris, this.fillStyle);
  };
  P.stroke = function () {
    const w = Math.max(0.05, this.lineWidth * this._scale());
    const tris = [];
    for (let i = 0; i < this._sub.length; i++) {
      strokePoly(this._sub[i].pts, this._sub[i].closed, w, this.lineCap, this.lineJoin, tris);
    }
    this._emit(tris, this.strokeStyle);
  };
  P.fillRect = function (x, y, w, h) {
    this.beginPath(); this.rect(x, y, w, h); this.fill();
  };
  P.strokeRect = function (x, y, w, h) {
    this.beginPath(); this.rect(x, y, w, h); this.stroke();
  };
  P.clearRect = function () { note('clearRect'); };

  /* CLIPPING, which is a stencil or it is nothing.

     The path is written into the stencil buffer with the colour mask off, the
     depth goes up by one, and everything after it is drawn only where the
     stencil equals that depth. Nesting works because depths accumulate.

     Undoing one — which is what `restore` does — cannot subtract a shape from
     a stencil, so it clears the whole thing and replays the clips that are
     still standing. That is only cheap because this art nests at most one
     deep and there are thirty clips in the whole game. */
  P.clip = function (rule) {
    if (rule === 'evenodd') { note('clip:evenodd'); return; }
    const tris = [];
    for (let i = 0; i < this._sub.length; i++) triangulate(this._sub[i].pts, tris);
    /* An empty clip path shows nothing in Canvas, so it shows nothing here.
       Returning early instead would leave the stencil alone and let everything
       after it draw UNCLIPPED — a leak that looks like art gone astray across
       the frame rather than like a clip that failed, which is exactly how it
       read. Pushing the empty set is honest: applyClips writes no coverage for
       it and the depth test then rejects every fragment. */
    this._clips = this._clips || [];
    this._clips.push(tris);
    applyClips(this._clips);
  };
  P.setLineDash = function (a) { if (a && a.length) note('setLineDash'); };
  P.getLineDash = function () { return []; };
  P.fillText = function () { note('fillText'); };
  P.strokeText = function () { note('strokeText'); };
  P.measureText = function () { note('measureText'); return { width: 0 }; };
  P.drawImage = function () { note('drawImage'); };
  P.putImageData = function () { note('putImageData'); };
  P.getImageData = function () { note('getImageData'); return null; };

  /* Write a set of clip shapes into the stencil and test against the result.
     Called with the whole standing stack, so it is idempotent: clear, replay,
     test. */
  function applyClips(stack) {
    flush();
    if (!prog) return;
    const gl = VF.gl.ctx();
    gl.clearStencil(0);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    if (!stack.length) { gl.disable(gl.STENCIL_TEST); return; }

    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    for (let i = 0; i < stack.length; i++) {
      /* each shape raises the count by one wherever it covers */
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);
      gl.stencilFunc(gl.EQUAL, i, 0xff);
      if (!stack[i].length) continue;      // covers nothing, so nothing passes
      const v = [];
      for (let k = 0; k < stack[i].length; k += 2) {
        v.push(stack[i][k], stack[i][k + 1], 0, 0, 0, 0);
      }
      const b = VF.gl.upload('clip', new Float32Array(v), [[0, 2, 0], [1, 4, 2]], 6);
      gl.useProgram(prog);
      gl.uniform1i(VF.gl.uniform(prog, 'mode'), 0);
      VF.gl.mesh(prog, { res: [W, H], alpha: 1 }, b, stack[i].length / 2);
    }
    gl.colorMask(true, true, true, true);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.stencilFunc(gl.EQUAL, stack.length, 0xff);
  }

  /* --------------------------------------------------------------- frame */

  function build() {
    if (prog || failed) return prog;
    if (!VF.gl || !VF.gl.ok()) { failed = true; return null; }
    prog = VF.gl.program('path', FS, VS);
    if (!prog) failed = true;
    return prog;
  }

  /* Open a frame on a target. Everything drawn between here and `end` goes
     into it, and `end` resolves the multisampling down. */
  function begin(target) {
    if (!build()) return null;
    for (const k in hit) delete hit[k];
    W = target ? target.w : VF.gl.size().w * VF.gl.size().dpr;
    H = target ? target.h : VF.gl.size().h * VF.gl.size().dpr;
    VF.gl.bind(target);
    const gl = VF.gl.ctx();
    gl.disable(gl.STENCIL_TEST);
    gl.clearStencil(0);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    paint = null; blendMode = 'source-over'; alpha = 1;
    verts.length = 0; count = 0;
    return new Ctx();
  }

  function end(target, to) {
    flush();
    const gl = VF.gl.ctx();
    if (gl) gl.disable(gl.STENCIL_TEST);
    if (target && target.__ms) VF.gl.resolve(target, to || null);
  }

  VF.glPath = {
    context: function () { return new Ctx(); },
    begin: begin, end: end, flush: flush,
    ok: function () { return !failed && VF.gl && VF.gl.ok() && !!build(); },
    /* What the last frame asked for and did not get. The migration harness
       fails the build on any of it rather than letting a shape quietly not
       draw — a renderer that silently skips is worse than one that crashes. */
    unsupported: function () { return Object.assign({}, hit); },
    Gradient: Gradient,
    /* the tools reach in to check the pieces on their own */
    __parse: parse, __triangulate: triangulate, __strokePoly: strokePoly
  };
})(window.VF = window.VF || {});
