/* VOID FISHING — the two GPU art layers, and the thing that makes porting safe.

   The scene is drawn back to front, and the 2D canvas sits entirely ABOVE the
   GL one. That single fact decides the whole migration: anything moved to the
   GPU lands behind everything still in Canvas 2D, so the ported set can only
   ever be a strict back-to-front PREFIX of the stage list. Not "the easiest
   module first" — the furthest one first, and then the next.

   There are two layers because the water is a hard boundary. js/gl/world.js
   draws sky and sea in ONE pass, so nothing can be slipped between them:

     · THE BACK LAYER — stars, clouds, the horizon feature, the land, and the
       landmarks standing at or beyond it. Resolved to a texture that the world
       shader composites over its sky and under its water, so the sea can still
       cover the foot of a headland.

     · THE FRONT LAYER — everything from the aurora forward. Drawn after the
       world pass into a second buffer and composited onto the canvas. It
       cannot simply be blitted: blitFramebuffer replaces rather than blends,
       and the default framebuffer has no multisampling, so it is an offscreen
       4x target, a resolve, and one full-screen source-over pass.

   Three of the layers' sources are already offscreen 2D canvases the scene
   blits — the star field, the cloud layers, the ridgeline — and they become
   textures, re-uploaded only when their bake changes. The rest is real
   per-frame path art through js/gl/path.js.

   NOT ONE ART FUNCTION IS EDITED. They are handed a different object.

   ------------------------------------------------------------------ the latch

   IT REFUSES TO DEGRADE, and it refuses one stage at a time.

   After every stage this asks js/gl/path.js what the stage asked for and did
   not get. The first stage that wants something the renderer has not got —
   an even-odd fill, text, one of the exotic blends — fixes the prefix there
   for the rest of the session, and the frame that discovered it throws its
   whole buffer away so that frame draws the old way too. Never a wrong frame,
   not even the one that finds out, and it converges in one.

   The stages past the prefix run in Canvas 2D on the canvas ABOVE this one,
   which is exactly where they belong in the order anyway. That is the whole
   reason a partial port is not a compromise: a prefix on the GPU and the
   remainder in 2D is the same picture, drawn by two renderers instead of one. */
(function (VF) {
  'use strict';

  /* The front layer onto the screen. Straight through, premultiplied; uv.y
     runs down and a texture's v runs up, so the sample is flipped. */
  const COMPOSITE_FS = `#version 300 es
    precision highp float;
    in vec2 uv;
    out vec4 frag;
    uniform sampler2D src;
    void main() { frag = texture(src, vec2(uv.x, 1.0 - uv.y)); }`;

  let comp = null, compFailed = false;

  function Layer(name) {
    return { name: name, limit: 1e9, missed: null, built: 0, count: 0 };
  }
  const back = Layer('back');
  const front = Layer('front');

  function ok() {
    return !!(VF.gl && VF.gl.ok() && VF.glPath && VF.glPath.ok());
  }

  function dirty() {
    const hit = VF.glPath.unsupported();
    for (const k in hit) return Object.keys(hit);
    return null;
  }

  /* Run a stage list into an offscreen multisampled buffer and hand back the
     resolved texture and how many stages went into it.

     `stages` is [{ name, fn(g) }, …] in draw order. `open` is given the
     context before anything is drawn, for the frame's own transform. `ground`
     is an opaque clear colour, for the comparison tools, which need both
     renders standing on the same thing; the game clears transparent because
     something else does its compositing. */
  function run(s, stages, open, ground) {
    if (!ok()) return null;
    const dpr = VF.gl.size().dpr || 1;
    const ms = VF.gl.msaa(s.name, 1);
    const flat = VF.gl.target(s.name, dpr, false);
    if (!ms || !flat) return null;

    VF.gl.bind(ms);
    const gl = VF.gl.ctx();
    gl.disable(gl.SCISSOR_TEST);
    if (ground) gl.clearColor(ground[0], ground[1], ground[2], 1);
    else gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const g = VF.glPath.begin(ms);
    if (!g) return null;
    /* Device pixels in the buffer, CSS pixels in the art — the same contract
       the 2D context is set up with every frame. */
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (open) open(g);

    let took = 0;
    for (let i = 0; i < stages.length && i < s.limit; i++) {
      try { stages[i].fn(g); }
      catch (e) {
        s.limit = i;
        s.missed = { stage: stages[i].name, threw: e && e.message || String(e) };
        VF.glPath.end(ms, null);
        return null;
      }
      const want = dirty();
      if (want) {
        s.limit = i;
        s.missed = { stage: stages[i].name, want: want };
        VF.glPath.end(ms, null);
        return null;
      }
      took = i + 1;
    }
    VF.glPath.end(ms, flat);
    s.built++;
    s.count = took;
    return { tex: flat, count: took };
  }

  /* Put the front layer on the screen. One textured pass, blended, because a
     resolve cannot blend and the canvas cannot multisample. */
  function composite(tex, to) {
    if (!tex || !ok()) return false;
    if (!comp && !compFailed) {
      comp = VF.gl.program('composite', COMPOSITE_FS);
      if (!comp) compFailed = true;
    }
    if (!comp) return false;
    const gl = VF.gl.ctx();
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    VF.gl.blend('source-over');
    /* Into the post buffer when the chain is open, so the front layer is
       exposed and graded with the world rather than pasted on afterwards —
       a rod lit brighter than the sea it is over is the tell that a frame
       was assembled rather than photographed. */
    return VF.gl.pass(comp, { src: tex }, to || null);
  }

  function report(s) {
    return { stages: s.count, limit: s.limit === 1e9 ? null : s.limit,
             missed: s.missed && Object.assign({}, s.missed), frames: s.built };
  }

  VF.glLayer = {
    ok: ok,
    back: function (stages, open, ground) { return run(back, stages, open, ground); },
    front: function (stages, open, ground) { return run(front, stages, open, ground); },
    composite: composite,
    /* what each layer took, and what stopped it — for the tools, and for
       anyone asking why a stage is still on the CPU */
    status: function () { return { back: report(back), front: report(front) }; },
    reset: function () {
      back.limit = front.limit = 1e9;
      back.missed = front.missed = null;
    }
  };
})(window.VF = window.VF || {});
