/* VOID FISHING — the vocabulary a place is built out of.

   The renderer has been drawing environments with a rectangle, a circle and a
   loop that walks x forward by a random step. That is why the six silhouette
   styles all read as the same silhouette: they share a construction, and a
   construction is more visible than a shape.

   This file is the other set of tools. Curves that pass through points you
   chose, noise you can sample at a coordinate instead of stepping through,
   fields that say how crowded a patch of water should be, and a line-of-sight
   test so that one landmark can be placed where the last one points.

   Nothing here draws. It produces numbers and point lists; js/world/landmarks.js
   decides where things go and js/render/landmarkArt.js decides what they look
   like. Keeping those three apart is the whole reason a zone can be given a
   different spatial grammar without touching a renderer. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* ---------------------------------------------------------------- noise

     Value noise, hashed rather than seeded-sequential, so it can be sampled
     at any coordinate in any order and always gives the same answer. That is
     the property the whole placement system needs: a landmark's detail must
     not depend on how many landmarks were generated before it. */

  function hash1(x, seed) {
    let h = (x | 0) * 374761393 + ((seed | 0) * 668265263);
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function hash2(x, y, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + ((seed | 0) * 2246822519);
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function noise1(x, seed) {
    const i = Math.floor(x), f = x - i;
    const t = U.smoothstep(f);
    return U.lerp(hash1(i, seed), hash1(i + 1, seed), t);
  }

  function noise2(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = U.smoothstep(x - ix), fy = U.smoothstep(y - iy);
    const a = U.lerp(hash2(ix, iy, seed), hash2(ix + 1, iy, seed), fx);
    const b = U.lerp(hash2(ix, iy + 1, seed), hash2(ix + 1, iy + 1, seed), fx);
    return U.lerp(a, b, fy);
  }

  /* Layered noise. `gain` under 0.5 gives smooth swells; over 0.5 gives the
     eroded, self-similar edge that reads as rock. */
  function fbm(x, seed, octaves, gain) {
    octaves = octaves || 4;
    gain = gain === undefined ? 0.5 : gain;
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += noise1(x * freq, seed + i * 101) * amp;
      norm += amp;
      amp *= gain;
      freq *= 2.03;          // not exactly 2, or the octaves line up and band
    }
    return sum / norm;
  }

  /* Ridged noise: the absolute value folded, which puts creases where the
     signal crosses zero. This is what makes a crystal or a trench wall read as
     fractured rather than as a hill. */
  function ridged(x, seed, octaves) {
    octaves = octaves || 4;
    let sum = 0, amp = 1, freq = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(noise1(x * freq, seed + i * 131) * 2 - 1);
      sum += n * n * amp;
      norm += amp;
      amp *= 0.55; freq *= 2.07;
    }
    return sum / norm;
  }

  /* ---------------------------------------------------------------- curves

     Catmull-Rom, because it passes THROUGH its control points. A designer
     places five points where the headland should be and the curve is the
     headland; with Bezier the same five points are five suggestions. */

  function catmull(p0, p1, p2, p3, t, tension) {
    const s = tension === undefined ? 0.5 : tension;
    const t2 = t * t, t3 = t2 * t;
    const m1 = (p2 - p0) * s, m2 = (p3 - p1) * s;
    return (2 * t3 - 3 * t2 + 1) * p1 + (t3 - 2 * t2 + t) * m1 +
           (-2 * t3 + 3 * t2) * p2 + (t3 - t2) * m2;
  }

  /* Sample a whole spline through `pts` ([{x,y}, ...]) into `steps` points.
     Ends are duplicated rather than wrapped, so a coastline does not curl back
     on itself at the edge of the frame. */
  function spline(pts, steps, tension) {
    const n = pts.length;
    if (n < 2) return pts.slice();
    const out = [];
    const per = Math.max(1, Math.round(steps / (n - 1)));
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i - 1] || pts[i];
      const p1 = pts[i], p2 = pts[i + 1];
      const p3 = pts[i + 2] || pts[i + 1];
      const last = i === n - 2;
      for (let j = 0; j < per + (last ? 1 : 0); j++) {
        const t = j / per;
        out.push({ x: catmull(p0.x, p1.x, p2.x, p3.x, t, tension),
                   y: catmull(p0.y, p1.y, p2.y, p3.y, t, tension) });
      }
    }
    return out;
  }

  /* Lay a sampled spline into a canvas path. Quadratic midpoints rather than
     lineTo, so the curve stays smooth at low step counts and a distant ridge
     costs eight points instead of eighty. */
  function path(g, pts, moveTo) {
    if (!pts.length) return;
    if (moveTo !== false) g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) * 0.5;
      const my = (pts[i].y + pts[i + 1].y) * 0.5;
      g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    const l = pts[pts.length - 1];
    g.lineTo(l.x, l.y);
  }

  /* ---------------------------------------------------------------- fields

     A field says how much a place wants something at (u, d). Landmarks emit
     them, the zone emits one, and where they add up is where detail belongs —
     which is the difference between debris around a wreck and debris sprinkled
     over the sea. */

  /* Smooth falloff to zero at `r`. Squared-cosine rather than linear, so the
     edge of an influence is not a visible circle. */
  function falloff(dist, r) {
    if (dist >= r) return 0;
    const k = 1 - dist / r;
    return k * k * (3 - 2 * k);
  }

  function dist2(au, ad, bu, bd) {
    /* d is compressed relative to u — a world unit sideways is a much shorter
       trip than a unit outward — so distances are measured in a stretched
       space or every influence comes out as a horizontal smear. */
    const du = au - bu, dd = (ad - bd) * 2.1;
    return Math.sqrt(du * du + dd * dd);
  }

  /* Total influence at a point from a list of {u, d, r, w}. */
  function influence(sources, u, d) {
    let sum = 0;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      sum += falloff(dist2(u, d, s.u, s.d), s.r || 0.5) * (s.w === undefined ? 1 : s.w);
    }
    return sum;
  }

  /* Signed distance to the nearest source, negative inside its radius. Used
     for exclusion — the reason a macro landmark has room around it. */
  function clearance(sources, u, d) {
    let best = Infinity;
    for (let i = 0; i < sources.length; i++) {
      const s = sources[i];
      const k = dist2(u, d, s.u, s.d) - (s.keep || s.r || 0.4);
      if (k < best) best = k;
    }
    return best;
  }

  /* Nearest-site partition. Not a real Voronoi diagram — no edges are built —
     but "which cell is this point in" is the only question the placement code
     ever asks of one, and this answers it in a loop. */
  function cellAt(sites, u, d) {
    let best = null, bd = Infinity;
    for (let i = 0; i < sites.length; i++) {
      const k = dist2(u, d, sites[i].u, sites[i].d);
      if (k < bd) { bd = k; best = sites[i]; }
    }
    return best;
  }

  /* How far this point is from the boundary between its cell and the next —
     small values are ON a boundary, which is where cracks and seams go. */
  function cellEdge(sites, u, d) {
    let a = Infinity, b = Infinity;
    for (let i = 0; i < sites.length; i++) {
      const k = dist2(u, d, sites[i].u, sites[i].d);
      if (k < a) { b = a; a = k; } else if (k < b) { b = k; }
    }
    return b === Infinity ? Infinity : b - a;
  }

  /* ---------------------------------------------------------- placement

     Rejection sampling against a density function with a minimum separation.
     Slower than scattering at random and that is the point: it produces
     clusters and clearings instead of an even grey of objects. */
  function scatter(rnd, count, opts) {
    opts = opts || {};
    const uMin = opts.uMin === undefined ? -2.4 : opts.uMin;
    const uMax = opts.uMax === undefined ? 2.4 : opts.uMax;
    const dMin = opts.dMin === undefined ? 0.05 : opts.dMin;
    const dMax = opts.dMax === undefined ? 1.0 : opts.dMax;
    const sep = opts.sep === undefined ? 0.12 : opts.sep;
    const density = opts.density || null;
    const avoid = opts.avoid || [];
    const out = [];
    let tries = 0;
    const cap = count * 42;
    while (out.length < count && tries++ < cap) {
      const u = U.lerp(uMin, uMax, rnd());
      const d = U.lerp(dMin, dMax, rnd());
      if (density && rnd() > U.clamp(density(u, d), 0, 1)) continue;
      if (avoid.length && clearance(avoid, u, d) < 0) continue;
      let ok = true;
      for (let i = 0; i < out.length; i++) {
        if (dist2(u, d, out[i].u, out[i].d) < sep) { ok = false; break; }
      }
      if (ok) out.push({ u: u, d: d });
    }
    return out;
  }

  /* ------------------------------------------------------- line of sight

     Can a viewer at `from` see `to`, given things in the way? Walks the
     segment and asks whether any blocker's silhouette covers it. Used to
     place the second landmark where the first one points, which is what
     turns a set of objects into a route. */
  function visible(from, to, blockers, samples) {
    const n = samples || 12;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const u = U.lerp(from.u, to.u, t);
      const d = U.lerp(from.d, to.d, t);
      for (let b = 0; b < blockers.length; b++) {
        const k = blockers[b];
        if (k === to || k === from) continue;
        /* A blocker only blocks what is behind it. */
        if (k.d >= d) continue;
        if (dist2(u, d, k.u, k.d) < (k.block || k.r || 0.18)) return false;
      }
    }
    return true;
  }

  /* Pick the point in `candidates` that best satisfies a set of soft wants.
     Each want is {fn, weight}; fn returns 0..1. This is how "somewhere out to
     the left, in clear sight of the lighthouse, not on top of the wreck"
     becomes one call instead of four nested loops. */
  function best(candidates, wants) {
    let top = null, ts = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      let s = 0;
      for (let w = 0; w < wants.length; w++) {
        s += U.clamp(wants[w].fn(c), 0, 1) * (wants[w].weight === undefined ? 1 : wants[w].weight);
      }
      if (s > ts) { ts = s; top = c; }
    }
    return top;
  }

  VF.grammar = {
    hash1: hash1, hash2: hash2, noise1: noise1, noise2: noise2,
    fbm: fbm, ridged: ridged,
    catmull: catmull, spline: spline, path: path,
    falloff: falloff, dist2: dist2, influence: influence, clearance: clearance,
    cellAt: cellAt, cellEdge: cellEdge,
    scatter: scatter, visible: visible, best: best
  };
})(window.VF = window.VF || {});
