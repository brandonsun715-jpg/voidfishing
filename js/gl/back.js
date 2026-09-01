/* VOID FISHING — the back of the frame, on the GPU.

   The scene is drawn back to front, and the 2D canvas sits entirely ABOVE the
   GL one. That single fact decides the whole migration: anything moved to the
   GPU lands behind everything still in Canvas 2D, so the ported set can only
   ever be a strict back-to-front PREFIX of the stage list. Not "the easiest
   module first" — the furthest one first, and then the next.

   The prefix this file takes is everything behind the water:

     sky (already GL) → stars → clouds → the horizon feature → the land →
     the landmarks and zone art that stand at or beyond the horizon

   Three of those are already offscreen 2D canvases that the scene blits — the
   star field, the cloud layers, the tinted ridgeline — and they become
   textures, re-uploaded only when their bake changes, which is a handful of
   times an hour. The other two are real per-frame path art and are the first
   customers of js/gl/path.js.

   NOT ONE ART FUNCTION IS EDITED. They are handed a different object.

   The result is resolved into a texture and given to js/gl/world.js, which
   composites it over the sky inside its own pass — rather than drawn on top
   afterwards, which would put the land in front of the sea.

   IT REFUSES TO DEGRADE. If any stage asks js/gl/path.js for something it
   does not do — an even-odd fill, text, one of the nine exotic blends — the
   backdrop is thrown away, this turns itself off for the session, and every
   stage goes back to Canvas 2D where it draws correctly. A frame that is
   nearly right is worse than a frame that is drawn the old way, because
   nobody will notice it in time. */
(function (VF) {
  'use strict';

  let failed = false;
  let missed = null;
  let built = 0;

  function ok() {
    return !failed && !!(VF.gl && VF.gl.ok() && VF.glPath && VF.glPath.ok());
  }

  /* Run `stages` into an offscreen multisampled buffer and hand back the
     resolved texture. `stages` is given the context to draw with; everything
     it draws is in CSS pixels, exactly as the 2D path expects. */
  function build(L, P, stages, ground) {
    if (!ok()) return null;
    const size = VF.gl.size();
    const dpr = size.dpr || 1;
    const ms = VF.gl.msaa('back', 1);
    const flat = VF.gl.target('back', dpr, false);
    if (!ms || !flat) return null;

    VF.gl.bind(ms);
    const gl = VF.gl.ctx();
    gl.disable(gl.SCISSOR_TEST);
    /* Transparent in the game, because the sky is behind it and the world
       shader does the compositing. `ground` is for the comparison tool, which
       needs both renders standing on the same opaque colour. */
    if (ground) gl.clearColor(ground[0], ground[1], ground[2], 1);
    else gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const g = VF.glPath.begin(ms);
    if (!g) return null;
    /* Device pixels in the buffer, CSS pixels in the art — the same contract
       the 2D context is set up with every frame. */
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { stages(g); }
    catch (e) {
      failed = true; missed = { threw: e && e.message || String(e) };
      VF.glPath.end(ms, null);
      return null;
    }
    VF.glPath.end(ms, flat);

    const hit = VF.glPath.unsupported();
    for (const k in hit) {
      /* One is enough. Something behind the water did not draw, and the only
         honest answer is to stop pretending this path is finished. */
      failed = true; missed = hit;
      return null;
    }
    built++;
    return flat;
  }

  VF.glBack = {
    build: build,
    ok: ok,
    /* what turned it off, for the tools and the debug overlay */
    missed: function () { return missed && Object.assign({}, missed); },
    /* how many frames the GPU has actually drawn the back of — the tools
       assert this moves, because a path that is never taken passes every
       comparison ever written about it */
    built: function () { return built; },
    disable: function (on) { failed = !!on; if (!on) missed = null; }
  };
})(window.VF = window.VF || {});
