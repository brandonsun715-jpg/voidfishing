/* VOID FISHING — being somewhere that is not water.

   The shop was a panel. The boatyard was a panel. The chart was a panel. The
   people you talk to were rows in a list with a button on the end, and the
   mechanic — whose entire written characterisation is "under a hull, mostly"
   — had no hull to be under. This is the fix, and it is not a bigger menu.

   A PLACE is a small number of framed views with things in them you can walk
   up to. You do not walk: you look at one composition, click something in it,
   and the thing you clicked is the shop rather than being a button that opens
   the shop. That distinction is the entire design. The panel still opens —
   3,500 lines of working shop is not thrown away to prove a point — but it
   arrives underneath a counter you were standing at, which is the same
   argument js/ui/aquarium.js already makes in its own header and wins.

   HOW IT SHARES THE SCREEN. It draws into the same two canvases the game
   always uses: the sky and the sea are the GL layer with the harbour's own
   light and horizon, and the boards, hulls, awnings and people are Canvas 2D
   on the layer above. Nothing new is allocated and nothing is uploaded. The
   window in the room is not a picture of the sea — it is a hole in the wall
   with the shader behind it.

   The people here stand at their stations and are already present, so there
   is no walking-in: js/systems/visit.js keeps that, because on the water
   somebody arriving IS the event. Here you are the one who came. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const S = {
    open: false,
    view: null,
    from: null,          // the view we are crossing from
    cross: 1,            // 0..1 through the cross-fade
    t: 0,
    /* Who has something to say, worked out on a slow beat rather than per
       figure per frame: asking walks two dialogue ladders and scores every
       reaction, which is nothing once a second and real work sixty times. */
    words: {}, wordsT: 0,
    hover: null,         // spot or exit under the pointer
    px: 0, py: 0,
    talk: null,          // { id, npc, lines, index, lineT, result }
    look: null,          // { text, t } — a thing you looked at
    arrive: 0            // 0..1 the fade in on entering
  };

  const CROSS = 0.34;    // seconds between viewpoints
  const MIN_LINE = 0.55; // the same floor visit.js uses: a line cannot be skipped instantly

  function view() { return VF.placeData.view(S.view || VF.placeData.first()); }
  function isOpen() { return S.open; }

  /* ------------------------------------------------------------- layout

     Rebuilt per frame. It is a handful of multiplications and it means the
     harbour is correct the instant the window is resized, with no invalidation
     to get wrong. */
  function layout() {
    const sz = VF.scene.size();
    const v = view();
    const w = sz.w, h = sz.h;
    const L = { w: w, h: h, view: v };
    /* Bigger than the figures on the water: out there you are looking at a
       horizon, in here you are standing next to somebody. */
    /* Slightly smaller than the figure on the water. Out there the angler is
       the subject; in here they are one of the things in the room, and a
       figure at a third of the frame makes every piece of furniture beside it
       look like a monument. */
    L.figureH = Math.min(h * 0.30, w * 0.155);
    L.horizonY = Math.round(h * v.horizon);
    L.waterH = h - L.horizonY;
    L.glowX = v.light[0] * w;
    L.glowY = v.light[1] * h;
    function curve(pts) {
      return VF.ground.curve(pts.map(function (p) { return [p[0] * w, p[1] * h]; }));
    }
    L.ground = curve(v.ground);
    /* A view can have a second surface. On the dock it is the quay: the water
       is above that line and the boards are below it, and a boat moored at it
       is in the water rather than standing on the planks. */
    L.edge = v.edge ? curve(v.edge) : L.ground;
    return L;
  }

  /* Which surface a thing stands on. */
  function surface(spec, L) { return spec.on === 'edge' ? L.edge : L.ground; }

  /* Where a thing is, given the ground it stands on. Everything in a view is
     anchored this way — figures, furniture, hotspots — so nothing can float
     and nothing has to carry a y. */
  function anchor(spec, L) {
    const d = spec.depth === undefined ? 1 : spec.depth;
    const fh = L.figureH * d;
    const x = spec.at * L.w;
    /* Depth is not a scale factor. Something further away is smaller AND
       higher up the frame, and doing only the first is what makes a distant
       figure read as a small person standing next to you. */
    const gy = surface(spec, L).yAt(x);
    const y = d >= 1 ? gy : U.lerp(L.horizonY, gy, d);
    return { x: x, y: y, fh: fh, depth: d };
  }

  /* The ways out, in fixed lanes at the bottom corners of the frame.

     They used to be anchored to a point in the scene, which put an arrow and
     a word across the bow of the boat on the dock and through the counter in
     the market. A way out of a picture belongs at the edge of the picture:
     always the same two places, so the player learns them once. */
  function exitLanes(L) {
    const v = view();
    const fh = L.figureH;
    const n = { '-1': 0, '1': 0 };
    return v.exits.map(function (e) {
      const side = e.side === undefined ? -1 : e.side;
      const i = n[String(side)]++;
      const w = fh * 1.45, h = fh * 0.44;
      const x = side < 0 ? fh * 0.16 : L.w - fh * 0.16 - w;
      const y = L.h - fh * (0.42 + i * 0.52) - h;
      return { exit: e, side: side, index: i,
               rect: { x: x, y: y, w: w, h: h, cx: x + w / 2, base: y + h } };
    });
  }

  /* A thing you can walk up to, as a rectangle.

     THE FLOOR IS NOT COSMETIC. On a phone held upright the figure height
     comes off the WIDTH, so a hotspot that is a third of a figure tall is
     nineteen pixels — visible, and impossible to hit with a thumb. The
     drawing is unaffected: this only ever grows the region that answers a
     press, around the same centre. */
  const MIN_HIT = 30;

  function rectOf(sp, L) {
    const a = anchor(sp, L);
    const w = Math.max(MIN_HIT, a.fh * (sp.w || 1));
    const h = Math.max(MIN_HIT, a.fh * (sp.h || 1));
    /* `rise` and the height are the drawn ones; the grown box is centred on
       where the thing actually is rather than sliding off it. */
    const drawnH = a.fh * (sp.h || 1);
    const top = a.y - drawnH - a.fh * (sp.rise || 0);
    return { x: a.x - w / 2, y: top - (h - drawnH) / 2, w: w, h: h,
             cx: a.x, base: a.y };
  }

  /* -------------------------------------------------------------- the door */

  function enter(viewId) {
    if (S.open) { if (viewId) go(viewId); return true; }
    /* You cannot walk off a hooked fish, same rule as a conversation. */
    const st = VF.fishing.state();
    if (st === 'reeling' || st === 'bite') {
      VF.toast.plain('land it first', 'warn', 2000);
      return false;
    }
    VF.fishing.hardReset();
    if (VF.visit && VF.visit.active()) VF.visit.leave();
    S.open = true;
    S.view = viewId || VF.placeData.first();
    S.from = null; S.cross = 1; S.arrive = 0;
    S.hover = null; S.talk = null; S.look = null;
    S.words = {}; S.wordsT = 0;
    document.body.classList.add('in-port');
    VF.audio.click();
    VF.bus.emit('place:enter', { view: S.view });
    /* The harbour has its own light, and the palette is global because when
       the harbour is up it is the only thing on the screen. */
    VF.palette.update();
    return true;
  }

  function leave() {
    if (!S.open) return;
    finishTalk();
    S.open = false;
    S.talk = null; S.look = null; S.hover = null;
    document.body.classList.remove('in-port');
    document.body.classList.remove('port-hot');
    VF.audio.back();
    VF.bus.emit('place:leave', {});
    VF.palette.update();
    VF.save.save();
  }

  function go(id) {
    if (!S.open || id === S.view) return;
    const v = VF.placeData.view(id);
    if (!v) return;
    finishTalk();
    S.from = S.view;
    S.view = id;
    S.cross = 0;
    S.hover = null; S.look = null;
    S.wordsT = 0;
    VF.audio.click();
    VF.bus.emit('place:view', { view: id });
  }

  /* ------------------------------------------------------------- talking

     The same `npcs.talk` the shore uses, deferred the same way, so a person
     here and a person on the water advance exactly the same ladders and give
     exactly the same things. What is different is that nobody walks in. */
  function talkTo(id) {
    if (S.talk) return false;
    const res = VF.npcs.talk(id, { defer: true });
    if (!res) {
      /* Somebody with nothing to say should not be a dead click. */
      S.look = { text: VF.npcs.name(id).toLowerCase() + ' has nothing for you today.', t: 0 };
      return false;
    }
    S.talk = { id: id, npc: res.npc, lines: res.lines.slice(), index: 0,
               lineT: 0, result: res };
    VF.audio.click();
    VF.bus.emit('place:talk', { npc: res.npc });
    return true;
  }

  function advanceTalk() {
    if (!S.talk) return false;
    if (S.talk.lineT < MIN_LINE) return true;
    S.talk.index++;
    S.talk.lineT = 0;
    if (S.talk.index >= S.talk.lines.length) { finishTalk(); return true; }
    VF.audio.click();
    return true;
  }

  /* Walking off counts — you heard them. Same rule as the shore. */
  function finishTalk() {
    if (!S.talk) return;
    const t = S.talk;
    S.talk = null;
    if (t.result && t.result.commit) t.result.commit();
    VF.audio.back();
    VF.bus.emit('visit:end', { npc: t.npc });
  }

  function line() {
    if (!S.talk) return null;
    return S.talk.lines[S.talk.index] || null;
  }

  /* ------------------------------------------------------------ acting on it

     A hotspot's `on` is the name of the panel it opens, or one of three verbs.
     Opening the panel that already exists is the honest thing to do: the shop
     works, and replacing it with an in-place drawer to prove a point would
     cost a thousand lines and buy nothing this round. What changed is that
     you are now standing at a counter rather than pressing a button on a bar. */
  function act(sp) {
    if (!sp) return;
    if (sp.talk) { talkTo(sp.talk); return; }
    if (sp.act === 'look') {
      const txt = typeof sp.look === 'function' ? sp.look() : sp.look;
      S.look = { text: txt || '', t: 0 };
      VF.audio.click();
      return;
    }
    if (sp.act === 'leave') {
      /* The boat is the way out, and the way out is the chart. */
      VF.audio.click();
      VF.panels.open('map');
      return;
    }
    if (sp.opens) {
      VF.audio.click();
      /* Not everything the harbour opens is a panel. The aquarium is already
         a room of its own — the one piece of prior art in this codebase that
         argues a place should not be a list — so the door in the wall opens
         the room, not a rectangle over the top of one. */
      if (sp.opens === 'aquarium') {
        if (VF.aquariumUI) VF.aquariumUI.show();
        return;
      }
      VF.panels.open(sp.opens);
    }
  }

  /* ------------------------------------------------------------------ input */

  function pick(px, py) {
    const L = layout();
    const v = view();
    const pad = L.figureH * 0.06;
    /* Spots before exits: an exit is the whole edge of the frame and would
       swallow anything standing near it. */
    for (let i = 0; i < v.spots.length; i++) {
      const r = rectOf(v.spots[i], L);
      if (px >= r.x - pad && px <= r.x + r.w + pad &&
          py >= r.y - pad && py <= r.y + r.h + pad) {
        return { kind: 'spot', spot: v.spots[i], rect: r };
      }
    }
    const lanes = exitLanes(L);
    for (let i = 0; i < lanes.length; i++) {
      const r = lanes[i].rect;
      if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) {
        return { kind: 'exit', exit: lanes[i].exit, rect: r };
      }
    }
    return null;
  }

  function move(px, py) {
    if (!S.open) return;
    S.px = px; S.py = py;
    S.hover = S.talk ? null : pick(px, py);
    document.body.classList.toggle('port-hot', !!S.hover);
  }

  function press(px, py) {
    if (!S.open) return false;
    if (VF.state.rt.panelOpen) return false;
    if (S.talk) { advanceTalk(); return true; }
    if (S.look) { S.look = null; }
    const h = pick(px, py);
    if (!h) return true;                 // a press on the boards is not a cast
    if (h.kind === 'exit') { go(h.exit.to); return true; }
    act(h.spot);
    return true;
  }

  /* ------------------------------------------------------------------- tick */

  function tick(dt) {
    if (!S.open) return;
    S.t += dt;
    S.wordsT -= dt;
    if (S.wordsT <= 0) {
      S.wordsT = 0.9;
      S.words = {};
      (view().people || []).forEach(function (p) {
        S.words[p.npc] = VF.npcs.hasNew(p.npc);
      });
    }
    S.arrive = Math.min(1, S.arrive + dt * 2.6);
    if (S.cross < 1) S.cross = Math.min(1, S.cross + dt / CROSS);
    if (S.talk) S.talk.lineT += dt;
    if (S.look) {
      S.look.t += dt;
      if (S.look.t > 6) S.look = null;
    }
  }

  function draw() {
    if (!S.open || !VF.portArt) return;
    VF.portArt.draw(layout(), VF.palette.P, S);
  }

  VF.place = {
    S: S,
    enter: enter, leave: leave, go: go, isOpen: isOpen,
    tick: tick, draw: draw,
    press: press, move: move, pick: pick,
    talkTo: talkTo, advanceTalk: advanceTalk, line: line,
    layout: layout, rectOf: rectOf, anchor: anchor,
    exitLanes: exitLanes, surface: surface,
    view: function () { return S.view; },
    viewDef: view,
    talking: function () { return !!S.talk; },
    /* What js/render/palette.js should colour the world as while we are in
       here. Null when we are not, and then it uses the water as always. */
    palette: function () { return S.open ? VF.placeData.location : null; }
  };
})(window.VF = window.VF || {});
