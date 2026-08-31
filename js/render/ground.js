/* VOID FISHING — standing on something.

   There is exactly one place in this game where a figure's feet meet the
   world, and it was written for the shore: two quadratics describing the lip
   of the ledge, inverted numerically so that given an x you get back the y of
   the ground under it. `ctx.translate(x, groundY(x))` and any feet-at-origin
   figure is standing there, at the right height, on a slope.

   That primitive is correct and general and it was hard-coded to one ledge.
   This is the same maths with the shape taken out of it, so a dock, a
   boatyard floor, a market row and the boards of a room can all be a ground
   that people stand on, and so a figure placed on any of them uses the same
   two lines of code it always did.

   A curve is a run of quadratic segments given as alternating anchor and
   control points:

     ground.curve([A0, C0, A1, C1, A2, ...])

   Anchors are where the ground actually passes through. Controls bend it in
   between. Outside the first and last anchor the ends are held flat, because
   a figure standing off the end of the world should stand on the end of it
   rather than fly off a parabola. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Which parameter along a quadratic lands on this x. Inverted rather than
     stepped, so the answer is exact and costs one square root. */
  function quadSolve(p0, p1, p2, x) {
    const a = p0 - 2 * p1 + p2, b = 2 * (p1 - p0), c = p0 - x;
    if (Math.abs(a) < 1e-6) return b === 0 ? 0 : U.clamp(-c / b, 0, 1);
    const disc = b * b - 4 * a * c;
    if (disc < 0) return 0.5;
    const r = Math.sqrt(disc);
    const u1 = (-b + r) / (2 * a), u2 = (-b - r) / (2 * a);
    if (u1 >= -0.001 && u1 <= 1.001) return U.clamp(u1, 0, 1);
    return U.clamp(u2, 0, 1);
  }

  function quadAt(p0, p1, p2, u) {
    const m = 1 - u;
    return m * m * p0 + 2 * m * u * p1 + u * u * p2;
  }

  function curve(pts) {
    /* [anchor, control, anchor, control, anchor, ...] — an even count is a
       malformed curve and the last dangling control is simply ignored. */
    const segs = [];
    for (let i = 0; i + 2 < pts.length; i += 2) {
      segs.push({ a: pts[i], c: pts[i + 1], b: pts[i + 2] });
    }
    const first = pts[0], last = pts[pts.length - 1];

    function yAt(x) {
      if (!segs.length) return first ? first[1] : 0;
      if (x <= first[0]) return first[1];
      if (x >= last[0]) return last[1];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (x > s.b[0] && i < segs.length - 1) continue;
        const u = quadSolve(s.a[0], s.c[0], s.b[0], U.clamp(x, s.a[0], s.b[0]));
        return quadAt(s.a[1], s.c[1], s.b[1], u);
      }
      return last[1];
    }

    /* The top edge as a polyline, for whoever is drawing the ground itself.
       Sampled off the same function the figures stand on, so the ledge and the
       thing standing on it cannot disagree. */
    function sample(x0, x1, step) {
      const out = [];
      const s = Math.max(1, step || 6);
      for (let x = x0; x <= x1; x += s) out.push([x, yAt(x)]);
      out.push([x1, yAt(x1)]);
      return out;
    }

    /* The ground as a path on a context, ready to be filled or stroked. */
    function trace(ctx, x0, x1) {
      const pts2 = [];
      for (let i = 0; i < segs.length; i++) pts2.push(segs[i]);
      ctx.moveTo(x0, yAt(x0));
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (s.b[0] < x0 || s.a[0] > x1) continue;
        ctx.quadraticCurveTo(s.c[0], s.c[1], s.b[0], s.b[1]);
      }
      ctx.lineTo(x1, yAt(x1));
    }

    /* The slope, for anything that has to lean with the ground. */
    function slopeAt(x) {
      const e = 2;
      return (yAt(x + e) - yAt(x - e)) / (2 * e);
    }

    return {
      yAt: yAt, sample: sample, trace: trace, slopeAt: slopeAt,
      from: first ? first[0] : 0, to: last ? last[0] : 0,
      points: pts
    };
  }

  VF.ground = { curve: curve, quadSolve: quadSolve, quadAt: quadAt };
})(window.VF = window.VF || {});
