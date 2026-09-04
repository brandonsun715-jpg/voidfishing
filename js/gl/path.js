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

    uniform int   mode;      // 0 flat, 1 linear, 2 radial, 3 image
    uniform vec4  g0;        // linear (x0,y0,x1,y1) · radial (x0,y0,r0,_)
                             // image  (the 2x2 of device pixels -> uv)
    uniform vec4  g1;        // radial (x1,y1,r1,_) · image (the translation)
    uniform float alpha;
    uniform sampler2D stops;
    uniform sampler2D img;

    void main() {
      if (mode == 0) { frag = vCol * alpha; return; }
      if (mode == 3) {
        /* One inverse affine takes a device pixel straight to a source pixel,
           so a baked canvas blits under any transform the art had set without
           the geometry carrying texture coordinates of its own. */
        frag = texture(img, vec2(g0.x * vPos.x + g0.y * vPos.y + g1.x,
                                 g0.z * vPos.x + g0.w * vPos.y + g1.y)) * alpha;
        return;
      }

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
  /* What the last frame cost, in the only units that mean anything here:
     draw calls and triangles. Headless fps is SwiftShader and is twenty to
     fifty times pessimistic, so it is not the number to tune against. */
  const stats = { batch: 0, stencil: 0, tris: 0 };

  let lut = null;

  /* The art builds its gradients fresh inside the draw call — `const grad =
     g.createLinearGradient(...)` on every frame, at 223 call sites. So the
     cache cannot be keyed on the gradient OBJECT: that is a new GL texture
     sixty times a second, none of them ever deleted. It is keyed on the ramp
     itself, in a fixed ring of slots, so the same three stops asked for again
     next frame cost one lookup and the whole game costs LUTS textures for the
     life of the page. A ramp is only the stops — a linear and a radial with
     the same colours share one strip. */
  const LUTS = 64;
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
    }
    g._slot = slot;
    /* Paint whenever the texture is not already there at this version — not
       merely when the SLOT is new. One strip canvas is shared by every ramp,
       so if the upload is going to happen the strip has to be holding the
       right ramp when it does; skipping the paint on a slot hit and trusting
       the texture to still be uploaded is a bet on another module's cache, and
       it lost. */
    if (!VF.gl.hasTexture('grad' + slot, sig)) {
      if (!lut) lut = new Uint8Array(256 * 4);
      /* Built here rather than by painting the real CanvasGradient into a
         256x1 canvas and uploading that.

         The canvas was the right instinct — let the reference rasteriser do
         the interpolating — and it has one failure, which took a whole zone
         to find. A canvas stores premultiplied 8-bit, texImage2D reads it
         back UNPREMULTIPLIED and premultiplies it again, and at very low
         alpha that round trip destroys the colour: a stop at rgba(28,20,54,
         0.008) stores as round(28 * 2/255) = 0, un-premultiplies to 0, and
         arrives black. So the GPU DARKENED where the 2D canvas tinted, which
         is what the Nowhere Sea's surface mist did — seven nearly invisible
         ellipses that came out as a black smear, on the GPU only.

         Interpolating in premultiplied space is also what the canvas spec
         says gradients do, so this is the same maths at full precision
         instead of through two 8-bit conversions. */
      const st = [];
      for (let i = 0; i < g._stops.length; i++) {
        const c = parse(g._stops[i][1]);
        st.push([U.clamp(g._stops[i][0], 0, 1), c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]]);
      }
      st.sort(function (a, b) { return a[0] - b[0]; });
      if (!st.length) { lut.fill(0); }
      else {
        let k = 0;
        for (let i = 0; i < 256; i++) {
          const x = i / 255;
          while (k < st.length - 2 && x > st[k + 1][0]) k++;
          const a = st[Math.min(k, st.length - 1)];
          const b = st[Math.min(k + 1, st.length - 1)];
          const span = b[0] - a[0];
          /* Before the first stop and after the last, canvas holds the end
             colour rather than extrapolating. */
          const u = x <= a[0] ? 0 : x >= b[0] ? 1 : (span > 0 ? (x - a[0]) / span : 0);
          const o = i * 4;
          lut[o]     = Math.round(U.clamp(a[1] + (b[1] - a[1]) * u, 0, 1) * 255);
          lut[o + 1] = Math.round(U.clamp(a[2] + (b[2] - a[2]) * u, 0, 1) * 255);
          lut[o + 2] = Math.round(U.clamp(a[3] + (b[3] - a[3]) * u, 0, 1) * 255);
          lut[o + 3] = Math.round(U.clamp(a[4] + (b[4] - a[4]) * u, 0, 1) * 255);
        }
      }
    }
    return VF.gl.textureData('grad' + slot, lut, 256, 1, sig);
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
  /* How many segments a curve of this length needs. A quadratic's worst-case
     sag over a chord goes as length squared over the segment count squared, so
     the count goes as the square root of the length over the tolerance — and
     the tolerance has to be about a fifth of a pixel, which is where Canvas
     puts it. At a quarter of that count a rod's line guides came out as visible
     pentagons and every small ring in the game was a difference. */
  function steps(len) { return U.clamp(Math.ceil(Math.sqrt(len * 12)), 3, 220); }

  /* Ear clipping. Correct for any simple polygon — concave, any winding — and
     that is 96% of the paths in this game. It is not correct for one that
     crosses itself, and neither is anything else this cheap; the harness
     compares against Canvas and would show it. */
  /* Returns true if it ever had to force its way past a corner. That is the
     signal that this ring is not something ear clipping should be trusted
     with — the fills that came out as a spray of wedges radiating from the
     middle of a fish all took that path, and none of them looked degenerate
     enough to notice from the code. Anything that stalls goes to the stencil
     instead, which does not care. */
  function triangulate(pts, out) {
    let stalled = false;
    const base = out.length;
    const n = pts.length / 2;
    if (n < 3) return false;
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
    if (idx.length < 3) return false;
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
         points, or an outline that crosses itself. The flattest corner comes
         out and the clip carries on so this terminates, but the caller is told
         it stalled and throws the result away in favour of the stencil, which
         does not care what shape the ring is. */
      if (!clipped) {
        stalled = true;
        let flat = 0, least = Infinity;
        for (let i = 0; i < idx.length; i++) {
          const a = idx[(i + idx.length - 1) % idx.length];
          const b = idx[i];
          const c = idx[(i + 1) % idx.length];
          const k = Math.abs((pts[b * 2] - pts[a * 2]) * (pts[c * 2 + 1] - pts[a * 2 + 1]) -
                             (pts[b * 2 + 1] - pts[a * 2 + 1]) * (pts[c * 2] - pts[a * 2]));
          if (k < least) { least = k; flat = i; }
        }
        idx.splice(flat, 1);
      }
    }
    if (idx.length === 3) {
      for (let i = 0; i < 3; i++) out.push(pts[idx[i] * 2], pts[idx[i] * 2 + 1]);
    }
    if (stalled) return true;

    /* AND THEN CHECK ITS WORK.

       A ring that crosses itself has no ear decomposition, but ear clipping
       does not notice: it finds corners that pass every local test and emits
       triangles that spill outside the outline. That is what a fish drawn as a
       spray of pale wedges radiating from its own middle actually is, and no
       amount of care in the ear test would have caught it, because each ear
       was locally fine.

       The area does catch it, in one pass: triangles that tile a polygon sum
       to its area, and triangles that escape it sum to more. Anything that
       does not add up goes to the stencil, which needs no decomposition. */
    let ring = 0;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      ring += pts[j * 2] * pts[i * 2 + 1] - pts[i * 2] * pts[j * 2 + 1];
    }
    ring = Math.abs(ring) * 0.5;
    let sum = 0;
    for (let i = base; i < out.length; i += 6) {
      sum += Math.abs((out[i + 2] - out[i]) * (out[i + 5] - out[i + 1]) -
                      (out[i + 3] - out[i + 1]) * (out[i + 4] - out[i])) * 0.5;
    }
    if (Math.abs(sum - ring) > 0.01 * Math.max(1, ring)) {
      out.length = base;
      return true;
    }
    return false;
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
    stats.batch++; stats.tris += count / 3;
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
      vals.stops = paint.tex; vals.img = paint.tex;
    } else if (paint.kind === 'image') {
      vals.mode = 3;
      vals.g0 = [paint.a[0], paint.a[1], paint.a[2], paint.a[3]];
      vals.g1 = [paint.a[4], paint.a[5], 0, 0];
      vals.stops = paint.tex; vals.img = paint.tex;
    } else {
      vals.mode = 2;
      vals.g0 = [paint.a[0], paint.a[1], paint.a[2], 0];
      vals.g1 = [paint.a[3], paint.a[4], paint.a[5], 0];
      vals.stops = paint.tex; vals.img = paint.tex;
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
    this._dash = null;
    this.lineDashOffset = 0;
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
      dash: this._dash, doff: this.lineDashOffset,
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
    this._dash = s.dash; this.lineDashOffset = s.doff;
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
    /* An arc's sag is r(1 - cos(half the step)), so the step angle goes as the
       square root of the tolerance over the radius and the count as the square
       root of the radius. A two-pixel ring wants seven sides and a hundred-pixel
       one wants fifty; a single formula for both is why this is not `steps`. */
    const rr = Math.max(0.01, Math.max(rx, ry) * this._scale());
    const n = U.clamp(Math.ceil(Math.abs(d) / TAU * 5.0 * Math.sqrt(rr)), 4, 256);
    /* A polygon through points ON the circle is entirely INSIDE it, so every
       ring comes out systematically small — which on a head reads as a thin
       crescent down one side and was the last shape in the game that differed.
       A closed ring is pushed out by half the sag instead, so it straddles the
       true curve rather than sitting under it; an open arc is left alone,
       because its ends have to meet whatever they are joined to. */
    const closed = Math.abs(d) >= TAU - 1e-6;
    const k = 1 / Math.cos(Math.abs(d) / n / 2);
    const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
    for (let i = 0; i <= n; i++) {
      const a = a0 + d * (i / n);
      /* an open arc's ends stay exactly where they were asked for, because
         something else is joined to them */
      const ki = closed || (i > 0 && i < n) ? k : 1;
      const px = Math.cos(a) * rx * ki, py = Math.sin(a) * ry * ki;
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
  /* IN USER SPACE, NOT DEVICE SPACE.

     A gradient is painted through the transform standing when it is USED, not
     the one standing when it was made — which matters because the art makes
     one ramp for a whole figure and then draws the head inside its own
     translate and rotate. Baking the coordinates at creation left the head lit
     from the wrong end of its own body: the neck matched and the skull did
     not, which is a very small clue for a very clear rule. */
  P.createLinearGradient = function (x0, y0, x1, y1) {
    return new Gradient('linear', [x0, y0, x1, y1]);
  };
  P.createRadialGradient = function (x0, y0, r0, x1, y1, r1) {
    return new Gradient('radial', [x0, y0, r0, x1, y1, r1]);
  };
  P.createPattern = function () { note('createPattern'); return '#000'; };
  P.createConicGradient = function () { note('createConicGradient'); return '#000'; };

  function paintOf(ctx, style) {
    if (style instanceof Gradient) {
      const tex = gradientTexture(style);
      const u = style._a;
      let a;
      if (style._kind === 'linear') {
        const p0 = ctx._pt(u[0], u[1]), p1 = ctx._pt(u[2], u[3]);
        a = [p0[0], p0[1], p1[0], p1[1]];
      } else {
        const p0 = ctx._pt(u[0], u[1]), p1 = ctx._pt(u[3], u[4]), sc = ctx._scale();
        a = [p0[0], p0[1], u[2] * sc, p1[0], p1[1], u[5] * sc];
      }
      /* The batch key is the ramp AND where it lands, because both are
         uniforms. Two fills asking for the same gradient in the same place —
         which the art does constantly, drawing a shape and then its shadow —
         then land in one draw instead of three. */
      return { kind: style._kind, id: style._slot + '@' + a.join(','), a: a, tex: tex };
    }
    return null;
  }

  P._blend = function () {
    const g = this.globalCompositeOperation;
    if (g === 'lighter') return 'lighter';
    if (g === 'destination-out') return 'destination-out';
    if (g && g !== 'source-over') note('blend:' + g);
    return 'source-over';
  };

  P._emit = function (tris, style) {
    if (!tris.length) return;
    const pnt = paintOf(this, style);
    want(pnt, this._blend(), this.globalAlpha);
    if (pnt) {
      push(tris, 1, 1, 1, 1);
    } else {
      const c = parse(style);
      push(tris, c[0], c[1], c[2], c[3] * this.globalAlpha);
    }
  };

  /* Replay a recorded Path2D into this context's path builder, so everything
     downstream — flattening, triangulation, the stencil — sees an ordinary
     path. Returns false when the recording is not there to replay. */
  P._replay = function (p) {
    const ops = p && p.__ops;
    if (!ops) { note('Path2D:opaque'); return false; }
    this.beginPath();
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      this[op[0]].apply(this, op.slice(1));
    }
    return true;
  };

  P.fill = function (rule) {
    if (rule && typeof rule === 'object') {
      if (!this._replay(rule)) return;
      rule = arguments[1];
    }
    const evenodd = rule === 'evenodd';
    const subs = [];
    for (let i = 0; i < this._sub.length; i++) {
      if (this._sub[i].pts.length >= 6) subs.push(this._sub[i].pts);
    }
    if (!subs.length) return;
    /* One well-behaved ring is triangulated and batched with everything else,
       because that is most fills and batching is most of the speed. Anything
       else — more than one ring, an even-odd rule, or a ring the clipper had
       to force — goes to the stencil, which is slower and always right. */
    if (!evenodd && subs.length === 1) {
      const tris = [];
      if (!triangulate(subs[0], tris)) { this._emit(tris, this.fillStyle); return; }
    }
    fillStencil(this, subs, this.fillStyle, evenodd);
  };
  P.stroke = function (path) {
    if (path && typeof path === 'object' && !this._replay(path)) return;
    const w = Math.max(0.05, this.lineWidth * this._scale());
    const tris = [];
    let subs = this._sub;
    if (this._dash) {
      const cut = [];
      for (let i = 0; i < subs.length; i++) {
        dashify(subs[i].pts, subs[i].closed, this._dash, this.lineDashOffset || 0,
                this._scale(), cut);
      }
      subs = cut;
    }
    for (let i = 0; i < subs.length; i++) {
      strokePoly(subs[i].pts, subs[i].closed, w, this.lineCap, this.lineJoin, tris);
    }
    if (!tris.length) return;
    if (this._solid(this.strokeStyle)) { this._emit(tris, this.strokeStyle); return; }
    strokeStencil(this, tris, this.strokeStyle);
  };

  /* Is this paint fully opaque? Only then can overlapping geometry be drawn
     piece by piece without the overlaps showing. A gradient is assumed not to
     be: they are rare in strokes and usually the reason one is soft. */
  P._solid = function (style) {
    if (style instanceof Gradient) return false;
    if (this.globalAlpha < 0.999) return false;
    return parse(style)[3] > 0.999;
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
    if (rule && typeof rule === 'object') {
      if (!this._replay(rule)) return;
      rule = arguments[1];
    }
    const subs = [];
    for (let i = 0; i < this._sub.length; i++) {
      if (this._sub[i].pts.length >= 6) subs.push(this._sub[i].pts);
    }
    this._clips = this._clips || [];
    this._clips.push({ subs: subs, evenodd: rule === 'evenodd' });
    applyClips(this._clips);
  };
  P.setLineDash = function (a) {
    this._dash = (a && a.length) ? a.slice() : null;
    /* An odd-length pattern repeats doubled, per the spec. */
    if (this._dash && this._dash.length % 2) this._dash = this._dash.concat(this._dash);
  };
  P.getLineDash = function () { return this._dash ? this._dash.slice() : []; };

  /* Cut a polyline into the pattern's "on" runs before it is expanded. Done on
     the flattened points in device space, so the pattern is scaled the way the
     transform scales everything else. */
  function dashify(pts, closed, pattern, offset, scale, out) {
    const pat = [];
    let total = 0;
    for (let i = 0; i < pattern.length; i++) {
      const v = Math.max(0, pattern[i] * scale);
      pat.push(v); total += v;
    }
    if (total <= 1e-6) { out.push({ pts: pts, closed: closed }); return; }

    let idx = 0, left = pat[0], on = true;
    let skip = ((offset || 0) * scale) % total;
    if (skip < 0) skip += total;
    while (skip > 0) {
      if (skip < left) { left -= skip; skip = 0; }
      else { skip -= left; idx = (idx + 1) % pat.length; left = pat[idx]; on = !on; }
    }

    let run = on ? [pts[0], pts[1]] : null;
    const n = pts.length / 2;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const ax = pts[(i % n) * 2], ay = pts[(i % n) * 2 + 1];
      const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
      let seg = Math.hypot(bx - ax, by - ay);
      let t0 = 0;
      while (seg - t0 > 1e-9) {
        const step = Math.min(left, seg - t0);
        const t1 = t0 + step;
        const px = ax + (bx - ax) * (t1 / seg), py = ay + (by - ay) * (t1 / seg);
        if (on) {
          if (!run) run = [ax + (bx - ax) * (t0 / seg), ay + (by - ay) * (t0 / seg)];
          run.push(px, py);
        }
        left -= step; t0 = t1;
        if (left <= 1e-9) {
          if (on && run) { out.push({ pts: run, closed: false }); run = null; }
          idx = (idx + 1) % pat.length; left = pat[idx]; on = !on;
        }
      }
    }
    if (on && run && run.length >= 4) out.push({ pts: run, closed: false });
  }
  /* THE BAKED LAYERS.

     The star field, the two cloud layers and the tinted ridgeline are already
     offscreen 2D canvases that the scene blits — the exact case a texture is
     for, and the one js/gl/core.js's own header carves out. Supporting
     drawImage here rather than building a separate blitter means those three
     stages port the same way everything else does: by being handed a different
     object. `ctx.drawImage(starField, 0, 0, W, sky)` is unchanged.

     A canvas must say when its bake changed, through `__glRev`. There is no
     way to see that from here, and re-uploading every frame to be safe is how
     a texture cache becomes a leak. Without one this reports and does not
     draw, because a stale sky is a worse answer than a loud one. */
  /* Bounded, for the same reason the gradient ramps are. The shoal bakes one
     silhouette per species per size bucket and never repaints it, so the set
     is immutable but open-ended — forty species times eight buckets is three
     hundred textures nobody ever frees. A ring of slots reuses the GL texture
     objects, so the page owns IMGS of them for its whole life however many
     distinct canvases pass through. */
  const IMGS = 96;
  const imgRing = new Array(IMGS);
  const imgIds = new WeakMap();
  let imgNext = 0;

  function imageTexture(src, rev) {
    let e = imgIds.get(src);
    if (!e) {
      const slot = imgNext; imgNext = (imgNext + 1) % IMGS;
      const old = imgRing[slot];
      if (old) imgIds.delete(old.src);
      e = { name: 'img' + slot, src: src };
      imgRing[slot] = e;
      imgIds.set(src, e);
    }
    return { name: e.name, tex: VF.gl.texture(e.name, src, String(rev)) };
  }

  P.drawImage = function (src, a, b, c, d, e, f, g2, h2) {
    if (!src) return;
    const iw = src.width || src.naturalWidth || 0;
    const ih = src.height || src.naturalHeight || 0;
    if (!iw || !ih) return;
    const rev = src.__glRev;
    if (rev === undefined || rev === null) { note('drawImage:unversioned'); return; }

    let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw, dh;
    if (f === undefined) { dx = a; dy = b; dw = c === undefined ? iw : c; dh = d === undefined ? ih : d; }
    else { sx = a; sy = b; sw = c; sh = d; dx = e; dy = f; dw = g2; dh = h2; }
    if (!dw || !dh || !sw || !sh) return;

    /* the destination quad, in device pixels */
    const p0 = this._pt(dx, dy), p1 = this._pt(dx + dw, dy);
    const p2 = this._pt(dx + dw, dy + dh), p3 = this._pt(dx, dy + dh);
    const tris = [p0[0], p0[1], p1[0], p1[1], p2[0], p2[1],
                  p0[0], p0[1], p2[0], p2[1], p3[0], p3[1]];

    /* and the affine that runs the other way, device pixel back to source */
    const m = this._m;
    const det = m[0] * m[3] - m[1] * m[2];
    if (!det) return;
    const ia = m[3] / det, ib = -m[1] / det, ic = -m[2] / det, id = m[0] / det;
    const ie = (m[2] * m[5] - m[3] * m[4]) / det;
    const iff = (m[1] * m[4] - m[0] * m[5]) / det;
    const kx = sw / (iw * dw), ky = sh / (ih * dh);
    const A = [kx * ia, kx * ic, ky * ib, ky * id,
               kx * (ie - dx) + sx / iw, ky * (iff - dy) + sy / ih];

    const im = imageTexture(src, rev);
    want({ kind: 'image', id: im.name + '@' + rev + '@' + A.join(','), a: A, tex: im.tex },
         this._blend(), this.globalAlpha);
    push(tris, 1, 1, 1, 1);
  };

  /* ----------------------------------------------------------------- text

     The one thing not worth reimplementing, and now it does not have to be:
     the string is drawn by Canvas into a small scratch canvas at the device
     scale and blitted through the same texture path the baked layers use. It
     is cached on everything that changes the picture — the text, the font, the
     colour, the alignment and the scale it was rendered at — in a bounded ring,
     so a label redrawn every frame costs one lookup.

     The metrics come from the same Canvas that will draw it, which is the only
     way the box can be right. */
  const TEXTS = 48;
  const textRing = new Array(TEXTS);
  const textSlot = Object.create(null);
  let textNext = 0;
  let mCv = null, mCtx = null;

  function metrics(ctx, str) {
    if (!mCv) {
      mCv = document.createElement('canvas');
      mCv.width = mCv.height = 8;
      mCtx = mCv.getContext('2d');
    }
    mCtx.font = ctx.font;
    mCtx.textAlign = ctx.textAlign;
    mCtx.textBaseline = ctx.textBaseline;
    return mCtx.measureText(str);
  }

  function textImage(ctx, str, fillOrStroke) {
    const sc = U.clamp(ctx._scale(), 0.5, 8);
    const q = Math.round(sc * 8) / 8;
    const style = fillOrStroke ? ctx.strokeStyle : ctx.fillStyle;
    if (typeof style !== 'string') { note('text:gradient'); return null; }
    const key = str + '\u0001' + ctx.font + '\u0001' + style + '\u0001' +
                ctx.textAlign + '\u0001' + ctx.textBaseline + '\u0001' + q +
                '\u0001' + (fillOrStroke ? 's' + ctx.lineWidth : 'f');
    let e = textSlot[key];
    if (e) return e;

    const m = metrics(ctx, str);
    const l = m.actualBoundingBoxLeft, r = m.actualBoundingBoxRight;
    const a = m.actualBoundingBoxAscent, d = m.actualBoundingBoxDescent;
    if (!isFinite(l) || !isFinite(r) || !isFinite(a) || !isFinite(d)) {
      note('text:metrics'); return null;
    }
    const pad = 2;
    const w = Math.ceil(l + r) + pad * 2, h = Math.ceil(a + d) + pad * 2;
    if (w <= pad * 2 || h <= pad * 2) return null;

    const slot = textNext; textNext = (textNext + 1) % TEXTS;
    if (textRing[slot]) delete textSlot[textRing[slot].key];
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * q));
    cv.height = Math.max(1, Math.ceil(h * q));
    const g = cv.getContext('2d');
    g.scale(q, q);
    g.font = ctx.font;
    g.textAlign = ctx.textAlign;
    g.textBaseline = ctx.textBaseline;
    if (fillOrStroke) {
      g.strokeStyle = style; g.lineWidth = ctx.lineWidth;
      g.strokeText(str, pad + l, pad + a);
    } else {
      g.fillStyle = style;
      g.fillText(str, pad + l, pad + a);
    }
    cv.__glRev = 'text' + slot + ':' + key;
    e = { key: key, cv: cv, w: w, h: h, l: l, a: a, pad: pad, name: 'text' + slot };
    textRing[slot] = e; textSlot[key] = e;
    return e;
  }

  function drawText(ctx, str, x, y, stroke) {
    const s = String(str);
    if (!s) return;
    const e = textImage(ctx, s, stroke);
    if (!e) return;
    ctx.drawImage(e.cv, x - e.l - e.pad, y - e.a - e.pad, e.w, e.h);
  }

  P.fillText = function (str, x, y) { drawText(this, str, x, y, false); };
  P.strokeText = function (str, x, y) { drawText(this, str, x, y, true); };
  P.measureText = function (str) { return metrics(this, String(str)); };
  P.putImageData = function () { note('putImageData'); };
  P.getImageData = function () { note('getImageData'); return null; };

  /* Write a set of clip shapes into the stencil and test against the result.
     Called with the whole standing stack, so it is idempotent: clear, replay,
     test. */
  /* THE STENCIL, WHICH TWO THINGS WANT AT ONCE.

     Clipping needs a standing "inside every clip" mask that survives across
     draws. Filling needs a scratch winding counter that lives for the length
     of one fill. They are the same eight bits, so they are split:

       bit  0x80   inside every standing clip
       bits 0x7F   the winding number of the fill being drawn right now

     Which makes the fill's cover test one comparison rather than two:
     `LESS, ref 0x80, mask 0xFF` passes exactly where the clip bit is set AND
     the count is not zero, because 0x80|count > 0x80 iff count > 0, and
     without the clip bit the value cannot reach 0x80 at all. Even-odd is the
     same test through mask 0x81 — the parity bit alone. */
  const CLIP_BIT = 0x80, COUNT_BITS = 0x7f;

  /* Everything after a clip is drawn where the mask bit stands. */
  function clipTest() {
    const gl = VF.gl.ctx();
    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(COUNT_BITS);          // fills may scribble on the low bits
    gl.stencilFunc(gl.EQUAL, CLIP_BIT, CLIP_BIT);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  }

  /* Feed one ring's fan into the stencil, counting winding. Not culled: the
     rasteriser's own front/back decides the sign, which is what makes this
     work for either winding and for a shape that crosses itself. */
  function windPass(subs) {
    const gl = VF.gl.ctx();
    const v = [];
    for (let s = 0; s < subs.length; s++) {
      const p = subs[s];
      if (p.length < 6) continue;
      for (let i = 2; i + 3 < p.length; i += 2) {
        v.push(p[0], p[1], 0, 0, 0, 0,
               p[i], p[i + 1], 0, 0, 0, 0,
               p[i + 2], p[i + 3], 0, 0, 0, 0);
      }
    }
    if (!v.length) return false;
    gl.disable(gl.CULL_FACE);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
    gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    const b = VF.gl.upload('sten', new Float32Array(v), [[0, 2, 0], [1, 4, 2]], 6);
    gl.useProgram(prog);
    gl.uniform1i(VF.gl.uniform(prog, 'mode'), 0);
    VF.gl.mesh(prog, { res: [W, H], alpha: 1 }, b, v.length / 6);
    return true;
  }

  function bounds(subs) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let s = 0; s < subs.length; s++) {
      const p = subs[s];
      for (let i = 0; i < p.length; i += 2) {
        if (p[i] < x0) x0 = p[i];
        if (p[i] > x1) x1 = p[i];
        if (p[i + 1] < y0) y0 = p[i + 1];
        if (p[i + 1] > y1) y1 = p[i + 1];
      }
    }
    if (!(x1 > x0) || !(y1 > y0)) return null;
    return [Math.max(0, Math.floor(x0) - 1), Math.max(0, Math.floor(y0) - 1),
            Math.min(W, Math.ceil(x1) + 1), Math.min(H, Math.ceil(y1) + 1)];
  }

  /* One full-frame quad, painted through the path program and shaped entirely
     by whatever stencil test is standing. Used only by the clip knock-out,
     which genuinely is frame-wide. */
  function fullQuad() {
    const gl = VF.gl.ctx();
    const t = [0, 0, W, 0, W, H, 0, 0, W, H, 0, H];
    const v = [];
    for (let i = 0; i < t.length; i += 2) v.push(t[i], t[i + 1], 0, 0, 0, 0);
    const b = VF.gl.upload('sten', new Float32Array(v), [[0, 2, 0], [1, 4, 2]], 6);
    gl.useProgram(prog);
    gl.uniform1i(VF.gl.uniform(prog, 'mode'), 0);
    VF.gl.mesh(prog, { res: [W, H], alpha: 1 }, b, 6);
  }

  /* Write the whole clip stack into the mask bit: start with everything in,
     then knock out whatever each clip shape does not cover. */
  function applyClips(stack) {
    flush();
    if (!prog) return;
    const gl = VF.gl.ctx();
    gl.enable(gl.STENCIL_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.stencilMask(0xff);
    gl.clearStencil(CLIP_BIT);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.colorMask(false, false, false, false);

    for (let i = 0; i < stack.length; i++) {
      gl.stencilMask(COUNT_BITS);
      gl.clearStencil(0);
      gl.clear(gl.STENCIL_BUFFER_BIT);
      /* An empty clip path shows nothing in Canvas, so it shows nothing here:
         no coverage is written, and the knock-out below clears the mask
         everywhere. Returning early instead would leave the stencil alone and
         let everything after it draw UNCLIPPED — a leak that reads as art gone
         astray across the frame rather than as a clip that failed. */
      windPass(stack[i].subs);
      /* wherever that ring's winding came out zero, this clip is not covering,
         so the standing mask loses its bit there */
      gl.stencilMask(CLIP_BIT);
      gl.stencilFunc(gl.EQUAL, 0, stack[i].evenodd ? 1 : COUNT_BITS);
      /* (fail, depth-fail, pass) — and the FIRST one is what happens where the
         test does NOT pass, which is where this clip DOES cover. Zeroing there
         too clears the mask everywhere and nothing downstream draws at all. */
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
      fullQuad();
    }

    gl.colorMask(true, true, true, true);
    clipTest();
  }

  /* Write a set of triangles into the stencil and then pay the colour in
     through it, TWICE OVER THE SAME GEOMETRY.

     The obvious cover is a quad over the shape's bounding box, and it is what
     this did first: correct, and half the frame rate, because a long diagonal
     stroke has a bounding box the size of the screen and every pixel in it
     gets shaded. Covering with the MARKING geometry instead touches only what
     the shape touches — and clearing the mark as it goes means a pixel is
     painted exactly ONCE however many pieces overlap it, which is the whole
     reason the stencil was needed. It leaves the buffer clean behind it too,
     so there is no clear to pay for either.

     `mark` is 'wind' for a fill, where the winding number decides what is
     inside, or 'cover' for a stroke, where covered is covered. */
  function stencilPaint(ctx, verts, count, style, mark, evenodd) {
    flush();
    if (!prog || !count) return;
    stats.stencil++; stats.tris += count / 3;
    const gl = VF.gl.ctx();
    const b = VF.gl.upload('sten', verts, [[0, 2, 0], [1, 4, 2]], 6);

    /* 1. the mark, with no colour written */
    gl.colorMask(false, false, false, false);
    gl.stencilMask(COUNT_BITS);
    gl.stencilFunc(gl.ALWAYS, 1, 0xff);
    if (mark === 'wind') {
      gl.disable(gl.CULL_FACE);
      gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
      gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
    } else {
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
    }
    gl.useProgram(prog);
    gl.uniform1i(VF.gl.uniform(prog, 'mode'), 0);
    VF.gl.mesh(prog, { res: [W, H], alpha: 1 }, b, count);

    /* 2. the colour, once per pixel, clearing the mark as it lands */
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.LESS, CLIP_BIT, evenodd ? (CLIP_BIT | 1) : 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
    VF.gl.blend(ctx._blend());
    const pnt = paintOf(ctx, style);
    const vals = { res: [W, H], alpha: pnt ? ctx.globalAlpha : 1 };
    let m = 0;
    if (pnt) {
      if (pnt.kind === 'linear') { m = 1; vals.g0 = pnt.a; }
      else { m = 2; vals.g0 = [pnt.a[0], pnt.a[1], pnt.a[2], 0];
             vals.g1 = [pnt.a[3], pnt.a[4], pnt.a[5], 0]; }
      vals.stops = pnt.tex; vals.img = pnt.tex;
    }
    gl.useProgram(prog);
    gl.uniform1i(VF.gl.uniform(prog, 'mode'), m);
    VF.gl.mesh(prog, vals, b, count);

    clipTest();
  }

  /* Vertices for a triangle list with a flat paint baked in. A gradient needs
     no vertex colour at all — the shader takes it from the ramp. */
  function verts6(tris, ctx, style) {
    const out = new Float32Array(tris.length * 3);
    let r = 1, g = 1, b = 1, a = 1;
    if (!(style instanceof Gradient)) {
      const c = parse(style);
      a = c[3] * ctx.globalAlpha;
      r = c[0] * a; g = c[1] * a; b = c[2] * a;
    }
    for (let i = 0, k = 0; i < tris.length; i += 2, k += 6) {
      out[k] = tris[i]; out[k + 1] = tris[i + 1];
      out[k + 2] = r; out[k + 3] = g; out[k + 4] = b; out[k + 5] = a;
    }
    return out;
  }

  /* A TRANSLUCENT STROKE IS ONE SHAPE, NOT A HUNDRED.

     Expanding a polyline gives a quad per segment and a disc per join, and
     those overlap each other by design. Canvas rasterises the whole stroke as
     one coverage region and blends it once; blending each piece separately
     builds the alpha up at every join and every segment boundary, which on a
     rod turned a soft grey glow into a hard white band twice as bright.

     Opaque strokes skip all of this, because drawing an opaque colour twice is
     the same as drawing it once, and most strokes are opaque. */
  function strokeStencil(ctx, tris, style) {
    stencilPaint(ctx, verts6(tris, ctx, style), tris.length / 2, style, 'cover', false);
  }

  /* A fill that ear clipping should not be trusted with: more than one
     subpath, an even-odd rule, or a ring that made the clipper force its way
     past a corner. The winding number goes into the stencil from a fan and the
     same fan pays the colour in through it — exact for holes, for crossings
     and for either rule, which the alternative is not. */
  function fillStencil(ctx, subs, style, evenodd) {
    const tris = [];
    for (let s = 0; s < subs.length; s++) {
      const p = subs[s];
      if (p.length < 6) continue;
      for (let i = 2; i + 3 < p.length; i += 2) {
        tris.push(p[0], p[1], p[i], p[i + 1], p[i + 2], p[i + 3]);
      }
    }
    if (!tris.length) return;
    stencilPaint(ctx, verts6(tris, ctx, style), tris.length / 2, style, 'wind', evenodd);
  }

  /* ------------------------------------------------------------- Path2D

     fishArt builds its fins as Path2D objects and hands them to `fill`. A
     Path2D cannot be read back — the browser keeps its geometry to itself —
     so the GPU renderer filled whatever subpath happened to be lying around
     from the call before, which for the first fin was the glow's full-frame
     rectangle. A fish came out as a solid rectangle, and then as a spray of
     wedges as later fins reused later leftovers.

     So Path2D is replaced, once, by a subclass of itself that also remembers
     the calls made to it. Canvas gets a real Path2D and behaves exactly as it
     did; the GPU gets the recording and replays it into its own path builder,
     under the transform standing at fill time, which is what the spec says a
     Path2D is drawn with. The art is not touched, which is the whole point.

     Anything constructed from an SVG string cannot be recorded, and says so
     rather than drawing the wrong shape. */
  const RECORDED = ['moveTo', 'lineTo', 'bezierCurveTo', 'quadraticCurveTo',
                    'arc', 'arcTo', 'ellipse', 'rect', 'roundRect', 'closePath'];

  function installPath2D() {
    const Native = window.Path2D;
    if (!Native || Native.__vf) return;
    function Recording(arg) {
      const self = new Native(arg);
      Object.setPrototypeOf(self, Recording.prototype);
      self.__ops = [];
      if (arg !== undefined) {
        if (arg && arg.__ops) self.__ops = arg.__ops.slice();
        else self.__ops = null;              // an SVG string: opaque, and said so
      }
      return self;
    }
    Recording.prototype = Object.create(Native.prototype);
    Recording.prototype.constructor = Recording;
    RECORDED.forEach(function (k) {
      if (typeof Native.prototype[k] !== 'function') return;
      Recording.prototype[k] = function () {
        if (this.__ops) this.__ops.push([k].concat([].slice.call(arguments)));
        return Native.prototype[k].apply(this, arguments);
      };
    });
    Recording.prototype.addPath = function (other, tf) {
      if (this.__ops) {
        if (other && other.__ops && !tf) this.__ops = this.__ops.concat(other.__ops);
        else this.__ops = null;
      }
      return Native.prototype.addPath.apply(this, arguments);
    };
    Recording.__vf = 1;
    window.Path2D = Recording;
  }
  installPath2D();

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
    stats.batch = 0; stats.stencil = 0; stats.tris = 0;
    W = target ? target.w : VF.gl.size().w * VF.gl.size().dpr;
    H = target ? target.h : VF.gl.size().h * VF.gl.size().dpr;
    VF.gl.bind(target);
    const gl = VF.gl.ctx();
    /* The clip bit starts set everywhere — nothing is clipped out yet — so
       every draw can use one standing test whether or not a clip is in force. */
    gl.disable(gl.SCISSOR_TEST);
    gl.stencilMask(0xff);
    gl.clearStencil(CLIP_BIT);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    clipTest();
    paint = null; blendMode = 'source-over'; alpha = 1;
    verts.length = 0; count = 0;
    return new Ctx();
  }

  function end(target, to) {
    flush();
    const gl = VF.gl.ctx();
    if (gl) {
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.stencilMask(0xff);
    }
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
    __parse: parse, __triangulate: triangulate, __strokePoly: strokePoly,
    /* the ramp a gradient would actually be drawn with, so a tool can read the
       texture back rather than infer it from the pixels it came out as */
    /* the ramp a gradient would actually be drawn with, so a tool can read the
       texture back rather than infer it from the pixels it came out as — which
       is how a whole round's worth of wrong colour was finally cornered */
    stats: function () { return Object.assign({}, stats); },
    __lut: gradientTexture
  };
})(window.VF = window.VF || {});
