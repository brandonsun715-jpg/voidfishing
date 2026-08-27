/* VOID FISHING — drawing the aquarium.

   The brief was that it should feel like walking into somewhere rather than
   opening a menu, and the difference between those two things is almost
   entirely light. A menu is a flat panel with rows on it. A room is a wall
   with a floor meeting it, a window with the outside behind it, and three or
   four lit objects standing in front of the wall casting light back onto it.

   So this draws a room: a back wall, a floor in perspective, a window onto the
   water the whole game happens in, the tanks standing along the wall with
   their own lighting spilling onto the floor in front of them, a desk with the
   research on it, and a cabinet. Everything is one canvas and one pass, and
   the layout is handed back so the screen can work out what was clicked.

   The tanks are the only expensive part, and they are only expensive because
   the fish inside them are the real procedural fish rather than icons. That is
   the point of housing one. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------- the layout

     Worked out once per frame from the canvas size and how many tanks the room
     has. Returned so the screen can hit-test against exactly what was drawn —
     there is no second copy of these numbers anywhere. */
  function layout(w, h, nTanks) {
    /* The wall meets the floor a little above halfway, which leaves the bottom
       third of the picture for the two things that stand ON the floor — the
       desk and the plinth. Put the join lower and they end up crammed against
       the bottom edge; put it higher and the tanks have nowhere to hang. */
    const wallY = Math.round(h * 0.555);
    const pad = Math.round(Math.min(64, w * 0.05));

    /* The tanks stand along the wall. More of them means each is narrower, but
       never so narrow that a fish inside is a smudge — past four the room
       gives up some of its margins instead. */
    const n = Math.max(1, nTanks);
    const gap = n > 4 ? 14 : 22;
    const strip = w - pad * 2;
    const tw = Math.max(120, Math.min(300, (strip - gap * (n - 1)) / n));
    const th = Math.round(Math.min(h * 0.30, tw * 0.70));
    const total = tw * n + gap * (n - 1);
    const x0 = Math.round((w - total) / 2);
    const ty = Math.round(wallY - th - h * 0.045);

    const tanks = [];
    for (let i = 0; i < n; i++) {
      tanks.push({ x: Math.round(x0 + i * (tw + gap)), y: ty,
                   w: Math.round(tw), h: th, i: i });
    }

    /* The window sits above the tanks where there is wall left, and shrinks
       out of the way rather than being drawn behind them. */
    const winTop = Math.round(h * 0.11);
    const winH = Math.max(0, Math.round(Math.min(h * 0.22, ty - winTop - 14)));
    const winW = Math.round(Math.min(w * 0.32, 360));
    const win = winH > 44
      ? { x: Math.round(w * 0.5 - winW / 2), y: winTop, w: winW, h: winH }
      : null;

    /* Desk front-left, cabinet back-right, pedestal front-centre. These are
       the three things in the room that are not tanks, and the room reads as
       lived in because of them rather than because of the tanks. */
    /* The floor band: everything standing on it sits between the join and the
       bottom edge, and the two objects that do are pushed to opposite sides so
       the middle of the floor stays clear. An empty middle is what makes the
       room feel walked into rather than filled up. */
    const band = h - wallY;
    const deskH = Math.round(Math.min(band * 0.80, 170));
    const deskW = Math.round(Math.min(300, w * 0.26));
    const desk = { x: Math.round(pad + w * 0.02),
                   y: Math.round(wallY + band * 0.16), w: deskW, h: deskH };

    const cabW = Math.round(Math.min(124, w * 0.10));
    const cabH = Math.round(Math.min(h * 0.30, 220));
    const cab = { x: w - pad - cabW, y: Math.round(wallY - cabH), w: cabW, h: cabH };

    const pedH = Math.round(Math.min(band * 0.66, 150));
    const pedW = Math.round(Math.min(190, w * 0.15));
    const ped = { x: Math.round(w - pad - pedW - w * 0.03),
                  y: Math.round(wallY + band * 0.24), w: pedW, h: pedH };

    return { w: w, h: h, wallY: wallY, tanks: tanks, window: win,
             desk: desk, cabinet: cab, pedestal: ped };
  }

  /* --------------------------------------------------------------- the room */

  function cfg(slot) {
    const c = VF.cosmetics.equippedIn(slot);
    return c ? (c.c || {}) : {};
  }

  function drawRoom(ctx, L, t) {
    const wall = cfg('roomWall');
    const floor = cfg('roomFloor');
    const light = cfg('roomLight');
    const w = L.w, h = L.h, wy = L.wallY;

    /* --- the wall --- */
    const wg = ctx.createLinearGradient(0, 0, 0, wy);
    wg.addColorStop(0, wall.c2 || '#0d141c');
    wg.addColorStop(0.62, wall.c1 || '#1b2430');
    wg.addColorStop(1, U.rgbToCss(U.shade(U.hexToRgb(wall.c1 || '#1b2430'), -0.28)));
    ctx.fillStyle = wg;
    ctx.fillRect(0, 0, w, wy);

    if (wall.tile) {
      // courses of something, faint enough to read as texture rather than grid
      ctx.strokeStyle = 'rgba(255,255,255,0.035)';
      ctx.lineWidth = 1;
      const step = wall.kind === 'anc' ? 46 : 34;
      for (let y = step; y < wy; y += step) {
        ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
      }
      for (let x = 0, r = 0; x < w; x += step * 2.2, r++) {
        const off = (r % 2) * step * 1.1;
        ctx.beginPath(); ctx.moveTo(x + off + 0.5, 0); ctx.lineTo(x + off + 0.5, wy); ctx.stroke();
      }
    }
    if (wall.rivets) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let x = 30; x < w; x += 58) {
        for (let y = 30; y < wy - 10; y += 58) {
          ctx.beginPath(); ctx.arc(x, y, 2.1, 0, TAU); ctx.fill();
        }
      }
    }
    if (wall.warp) {
      // the void wall does not hold still, and it is the only one that does not
      ctx.save();
      ctx.globalAlpha = 0.10;
      for (let i = 0; i < 5; i++) {
        const p = (t * 0.05 + i / 5) % 1;
        ctx.strokeStyle = '#b48aff';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let x = 0; x <= w; x += 12) {
          const y = wy * p + Math.sin(x * 0.012 + t * 0.6 + i) * 9;
          x ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
    }

    /* --- the floor ---
       Boards running away from the viewer. Perspective is faked with a power
       curve on the row spacing, which is enough at this angle and costs one
       multiply per line. */
    const fg = ctx.createLinearGradient(0, wy, 0, h);
    fg.addColorStop(0, U.rgbToCss(U.shade(U.hexToRgb(floor.c2 || '#171b21'), -0.2)));
    fg.addColorStop(0.35, floor.c2 || '#171b21');
    fg.addColorStop(1, floor.c1 || '#2b3138');
    ctx.fillStyle = fg;
    ctx.fillRect(0, wy, w, h - wy);

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      const y = wy + (h - wy) * Math.pow(i / 9, 1.7);
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }
    // and the receding ones, converging on a point behind the middle tank
    const vx = w * 0.5;
    for (let i = -7; i <= 7; i++) {
      ctx.beginPath();
      ctx.moveTo(vx + i * (w * 0.055), wy);
      ctx.lineTo(vx + i * (w * 0.26), h);
      ctx.stroke();
    }
    ctx.restore();

    // the seam where they meet, which is what sells the two as one room
    ctx.fillStyle = 'rgba(0,0,0,0.42)';
    ctx.fillRect(0, wy - 2, w, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, wy - 3, w, 1);

    /* --- the light in the room ---
       One soft pool from above, tinted by whatever is fitted. Drawn before the
       objects so they sit in it rather than under it. */
    const lc = U.hexToRgb(light.col || '#cfe0f0');
    const la = light.a === undefined ? 0.30 : light.a;
    const flick = light.flicker ? (0.86 + 0.14 * Math.sin(t * 21) * Math.sin(t * 7.3)) : 1;
    const g = ctx.createRadialGradient(w * 0.5, -h * 0.25, 0, w * 0.5, -h * 0.25, h * 1.25);
    g.addColorStop(0, U.rgbToCss(lc, la * flick));
    g.addColorStop(1, U.rgbToCss(lc, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (light.caustics) drawCaustics(ctx, L, t, lc);
  }

  /* Water light on a floor: two sets of crossing sine bands, multiplied
     together so the bright spots are where both are bright. Cheap and it reads
     immediately as being underneath something. */
  function drawCaustics(ctx, L, t, col) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, L.wallY, L.w, L.h - L.wallY);
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    const rows = 16;
    for (let i = 0; i < rows; i++) {
      const p = i / rows;
      const y = L.wallY + (L.h - L.wallY) * Math.pow(p, 1.5);
      const amp = 0.06 * (0.3 + p);
      for (let x = 0; x < L.w; x += 22) {
        const a = Math.sin(x * 0.021 + t * 0.7 + i) * Math.sin(x * 0.009 - t * 0.45 + i * 1.7);
        if (a <= 0) continue;
        ctx.fillStyle = U.rgbToCss(col, amp * a);
        ctx.fillRect(x, y, 22 + p * 26, 3 + p * 5);
      }
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------- the window

     What is on the other side is the same void the rest of the game is set in,
     so it is drawn the same way: a dark gradient, a few points of light, and
     something enormous going past every so often. It is the one thing in the
     room that says where the room IS. */
  function drawWindow(ctx, r, t) {
    if (!r) return;
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.clip();

    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#12283a');
    g.addColorStop(0.55, '#0a1926');
    g.addColorStop(1, '#040a12');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    // shafts from a surface a long way up
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const x = r.x + r.w * (0.22 + i * 0.28) + Math.sin(t * 0.18 + i) * 8;
      const gg = ctx.createLinearGradient(x, r.y, x + r.w * 0.08, r.y + r.h);
      gg.addColorStop(0, 'rgba(170,215,250,0.11)');
      gg.addColorStop(1, 'rgba(170,215,250,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.moveTo(x - 10, r.y); ctx.lineTo(x + 10, r.y);
      ctx.lineTo(x + r.w * 0.08 + 26, r.y + r.h); ctx.lineTo(x + r.w * 0.08 - 26, r.y + r.h);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // motes out there, drifting up
    const rnd = VF.rng.make(0x5EA1);
    for (let i = 0; i < 46; i++) {
      const bx = r.x + rnd() * r.w;
      const sp = 4 + rnd() * 14;
      const by = r.y + ((rnd() * r.h - t * sp) % r.h + r.h) % r.h;
      const a = 0.14 + rnd() * 0.34;
      ctx.fillStyle = U.rgbToCss([190, 222, 245], a);
      ctx.fillRect(bx, by, 1.3, 1.3);
    }

    // and something going past, slowly, once in a while
    const cyc = 46;
    const p = (t % cyc) / cyc;
    if (p < 0.34) {
      const k = p / 0.34;
      const cx = r.x - r.w * 0.4 + (r.w * 1.8) * k;
      const cy = r.y + r.h * (0.55 + Math.sin(k * 3.1) * 0.10);
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.72;
      ctx.fillStyle = '#020609';
      const bw = r.w * 0.40, bh = r.h * 0.115;
      // a body and a tail, so it reads as something alive rather than as a bar
      ctx.beginPath();
      ctx.ellipse(cx, cy, bw, bh, -0.05, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx - bw * 0.92, cy);
      ctx.lineTo(cx - bw * 1.45, cy - bh * 2.1);
      ctx.lineTo(cx - bw * 1.28, cy);
      ctx.lineTo(cx - bw * 1.45, cy + bh * 2.1);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // the frame
    ctx.strokeStyle = 'rgba(255,255,255,0.13)';
    ctx.lineWidth = 3;
    roundRect(ctx, r.x, r.y, r.w, r.h, 10);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 1;
    roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 12);
    ctx.stroke();
    // light coming through it, onto the wall below
    const wg = ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h + 90);
    wg.addColorStop(0, 'rgba(150,200,235,0.10)');
    wg.addColorStop(1, 'rgba(150,200,235,0)');
    ctx.fillStyle = wg;
    ctx.fillRect(r.x - 20, r.y + r.h, r.w + 40, 90);
  }

  /* --------------------------------------------------------------- the tank */

  /* The inside, behind the glass. Backdrop, floor, decoration, and then the
     specimens swimming in it — which are the real procedural fish, at a size
     that follows what they actually weighed. */
  function drawTank(ctx, r, tank, t, opt) {
    opt = opt || {};
    const bg = cfg('tankBg'), fl = cfg('tankFloor'), dc = cfg('tankDecor'), li = cfg('tankLight');
    const inner = { x: r.x + 5, y: r.y + 5, w: r.w - 10, h: r.h - 10 };

    ctx.save();
    ctx.beginPath();
    roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 4);
    ctx.clip();

    drawTankBg(ctx, inner, bg, t);
    drawTankFloor(ctx, inner, fl);
    drawDecor(ctx, inner, dc, t);

    /* the specimens */
    const fish = (tank && tank.fish) || [];
    for (let i = 0; i < fish.length; i++) {
      drawSpecimen(ctx, inner, fish[i], i, fish.length, t,
                   opt.selected === i ? 1 : 0);
    }

    /* the light in the water: a cone from the hood, and a wash over everything */
    const lc = U.hexToRgb(li.col || '#e8f2ff');
    const la = li.a === undefined ? 0.4 : li.a;
    const fl2 = li.flicker ? (0.80 + 0.20 * Math.sin(t * 17.3) * Math.sin(t * 5.1)) : 1;
    const beam = ctx.createLinearGradient(0, inner.y, 0, inner.y + inner.h);
    beam.addColorStop(0, U.rgbToCss(lc, la * 0.55 * fl2));
    beam.addColorStop(0.5, U.rgbToCss(lc, la * 0.16 * fl2));
    beam.addColorStop(1, U.rgbToCss(lc, 0));
    ctx.fillStyle = beam;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);

    if (li.aurora) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const hue = [[125, 255, 196], [140, 190, 255], [220, 150, 255]][i];
        const yy = inner.y + inner.h * (0.18 + 0.22 * i) + Math.sin(t * 0.5 + i) * 8;
        const g2 = ctx.createLinearGradient(0, yy - 18, 0, yy + 18);
        g2.addColorStop(0, U.rgbToCss(hue, 0));
        g2.addColorStop(0.5, U.rgbToCss(hue, 0.13));
        g2.addColorStop(1, U.rgbToCss(hue, 0));
        ctx.fillStyle = g2;
        ctx.fillRect(inner.x, yy - 18, inner.w, 36);
      }
      ctx.restore();
    }

    // the surface, seen from below the rim
    const sg = ctx.createLinearGradient(0, inner.y, 0, inner.y + 16);
    sg.addColorStop(0, 'rgba(255,255,255,0.14)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(inner.x, inner.y, inner.w, 16);

    ctx.restore();

    /* the glass: a highlight down the left, a darker right, and a frame */
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, inner.x, inner.y, inner.w, inner.h, 4);
    ctx.clip();
    const gl = ctx.createLinearGradient(inner.x, 0, inner.x + inner.w, 0);
    gl.addColorStop(0, 'rgba(255,255,255,0.11)');
    gl.addColorStop(0.12, 'rgba(255,255,255,0.02)');
    gl.addColorStop(0.88, 'rgba(0,0,0,0.10)');
    gl.addColorStop(1, 'rgba(0,0,0,0.26)');
    ctx.fillStyle = gl;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.restore();

    // frame
    ctx.strokeStyle = opt.hot ? 'rgba(180,220,255,0.85)' : 'rgba(255,255,255,0.16)';
    ctx.lineWidth = opt.hot ? 2 : 1.4;
    roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 6);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.stroke();

    // the hood on top, and the stand under it
    ctx.fillStyle = '#161c24';
    roundRect(ctx, r.x - 3, r.y - 10, r.w + 6, 12, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(r.x - 3, r.y - 10, r.w + 6, 1);
    ctx.fillStyle = '#10151c';
    roundRect(ctx, r.x + 8, r.y + r.h, r.w - 16, 18, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(r.x + 8, r.y + r.h + 15, r.w - 16, 3);

    /* the light this tank throws onto the floor in front of it — the single
       thing that makes the tanks part of the room instead of pictures hung
       on the wall */
    const spill = ctx.createLinearGradient(0, r.y + r.h, 0, r.y + r.h + 120);
    spill.addColorStop(0, U.rgbToCss(lc, 0.14 * la * 2.2));
    spill.addColorStop(1, U.rgbToCss(lc, 0));
    ctx.fillStyle = spill;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.lineTo(r.x + r.w + 40, r.y + r.h + 120);
    ctx.lineTo(r.x - 40, r.y + r.h + 120);
    ctx.closePath();
    ctx.fill();
  }

  function drawTankBg(ctx, r, bg, t) {
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, bg.a || '#16222e');
    g.addColorStop(1, bg.b || '#0a1018');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    const kind = bg.kind || 'plain';

    if (bg.stars || kind === 'space') {
      const rnd = VF.rng.make(0xA9A1);
      for (let i = 0; i < 90; i++) {
        const x = r.x + rnd() * r.w, y = r.y + rnd() * r.h;
        const m = Math.pow(rnd(), 3.4);
        ctx.fillStyle = U.rgbToCss([230, 236, 255], 0.12 + m * 0.7);
        ctx.fillRect(x, y, 0.7 + m * 1.2, 0.7 + m * 1.2);
      }
    }

    if (kind === 'ocean' || kind === 'frozen' || kind === 'city') {
      // shafts of light coming down through water
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = r.x + r.w * (0.16 + i * 0.23) + Math.sin(t * 0.22 + i) * 6;
        const gg = ctx.createLinearGradient(x, r.y, x + r.w * 0.10, r.y + r.h);
        gg.addColorStop(0, 'rgba(190,225,255,' + (0.09 * (bg.beam || 0.4) * 2.2).toFixed(3) + ')');
        gg.addColorStop(1, 'rgba(190,225,255,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.moveTo(x - 9, r.y); ctx.lineTo(x + 9, r.y);
        ctx.lineTo(x + r.w * 0.10 + 24, r.y + r.h); ctx.lineTo(x + r.w * 0.10 - 24, r.y + r.h);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }

    if (kind === 'ruins' || kind === 'city') {
      // silhouettes at the back: columns for ruins, towers for a city
      ctx.fillStyle = 'rgba(0,0,0,0.44)';
      const n = kind === 'city' ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const bw = r.w / n * (kind === 'city' ? 0.62 : 0.24);
        const bx = r.x + r.w * ((i + 0.5) / n) - bw / 2;
        const bh = r.h * (0.28 + ((i * 37) % 11) / 11 * 0.42);
        ctx.fillRect(bx, r.y + r.h - bh, bw, bh);
      }
      if (kind === 'city' && bg.lit) {
        ctx.fillStyle = U.rgbToCss(U.hexToRgb(bg.lit), 0.5);
        for (let i = 0; i < 26; i++) {
          const x = r.x + ((i * 91) % 100) / 100 * r.w;
          const y = r.y + r.h - ((i * 53) % 100) / 100 * r.h * 0.5;
          ctx.fillRect(x, y, 1.6, 1.6);
        }
      }
    }

    if (kind === 'neon') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const c = U.hexToRgb(bg.lit || '#ff4fd8');
      for (let i = 0; i < 5; i++) {
        const y = r.y + r.h * (0.2 + i * 0.16);
        ctx.strokeStyle = U.rgbToCss(c, 0.16);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(r.x, y + Math.sin(t * 0.6 + i) * 3);
        ctx.lineTo(r.x + r.w, y - Math.sin(t * 0.6 + i) * 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (kind === 'frozen') {
      ctx.strokeStyle = 'rgba(220,245,255,0.16)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const x = r.x + ((i * 71) % 100) / 100 * r.w;
        ctx.beginPath();
        ctx.moveTo(x, r.y);
        ctx.lineTo(x + 8, r.y + r.h * 0.4);
        ctx.lineTo(x - 5, r.y + r.h);
        ctx.stroke();
      }
    }

    if (bg.warp || kind === 'void') {
      ctx.save();
      ctx.globalAlpha = 0.30;
      for (let i = 0; i < 4; i++) {
        const rr = (r.w * 0.12) * (1 + i * 0.5) + Math.sin(t * 0.5 + i) * 6;
        ctx.strokeStyle = '#8a5cff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x + r.w * 0.5, r.y + r.h * 0.45, rr, rr * 0.62, 0, 0, TAU);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (bg.glitch || kind === 'wrong') {
      ctx.save();
      for (let i = 0; i < 7; i++) {
        const y = r.y + (((i * 37 + Math.floor(t * 11)) % 100) / 100) * r.h;
        ctx.fillStyle = i % 2 ? 'rgba(255,45,85,0.20)' : 'rgba(102,255,224,0.16)';
        ctx.fillRect(r.x, y, r.w, 2 + (i % 3));
      }
      ctx.restore();
    }
  }

  function drawTankFloor(ctx, r, fl) {
    const kind = fl.kind || 'sand';
    const fh = Math.max(10, r.h * 0.15);
    const y = r.y + r.h - fh;
    const g = ctx.createLinearGradient(0, y, 0, r.y + r.h);
    g.addColorStop(0, U.rgbToCss(U.shade(U.hexToRgb(fl.c2 || '#8f7f5c'), -0.15)));
    g.addColorStop(1, fl.c1 || '#d8c79a');

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y + r.h);
    ctx.lineTo(r.x, y + 4);
    // a slightly uneven bed, because a straight line reads as a shelf
    for (let x = 0; x <= r.w; x += 12) {
      ctx.lineTo(r.x + x, y + 4 + Math.sin(x * 0.09) * 3 + Math.sin(x * 0.031) * 2);
    }
    ctx.lineTo(r.x + r.w, r.y + r.h);
    ctx.closePath();
    ctx.fill();

    if (kind === 'rock' || kind === 'ruins') {
      ctx.fillStyle = U.rgbToCss(U.shade(U.hexToRgb(fl.c2 || '#33383e'), 0.18), 0.8);
      for (let i = 0; i < 9; i++) {
        const x = r.x + ((i * 83) % 100) / 100 * r.w;
        const s = 3 + ((i * 29) % 7);
        ctx.beginPath(); ctx.ellipse(x, y + 8 + (i % 3) * 3, s, s * 0.6, 0, 0, TAU); ctx.fill();
      }
    }
    if (fl.sheen) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(r.x, y + 3, r.w, 1.5);
    }
  }

  function drawDecor(ctx, r, dc, t) {
    const kind = dc.kind || 'none';
    if (kind === 'none') return;
    const baseY = r.y + r.h - Math.max(10, r.h * 0.15) + 6;
    const c1 = dc.c1 || '#888', c2 = dc.c2 || '#444';
    const x = r.x + r.w * 0.24;
    const scale = Math.min(1.2, r.h / 150);

    ctx.save();
    ctx.translate(x, baseY);
    ctx.scale(scale, scale);

    if (kind === 'coral') {
      for (let i = 0; i < 3; i++) {
        const cx = (i - 1) * 22;
        ctx.strokeStyle = i === 1 ? c1 : c2;
        ctx.lineWidth = 4 - i * 0.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, 0);
        ctx.quadraticCurveTo(cx + 6, -22, cx - 4, -40 - i * 6);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, -14); ctx.quadraticCurveTo(cx + 16, -22, cx + 18, -34);
        ctx.stroke();
      }
    } else if (kind === 'chest') {
      ctx.fillStyle = c2; roundRect(ctx, -22, -26, 44, 26, 3); ctx.fill();
      ctx.fillStyle = c1; roundRect(ctx, -22, -38, 44, 14, 6); ctx.fill();
      ctx.fillStyle = dc.gold || '#ffd75e';
      ctx.fillRect(-4, -30, 8, 8);
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 1.6);
      ctx.fillRect(-3, -29, 6, 6);
      ctx.globalAlpha = 1;
    } else if (kind === 'wreck') {
      ctx.fillStyle = c2;
      ctx.beginPath();
      ctx.moveTo(-56, 0); ctx.quadraticCurveTo(-20, -30, 46, -18);
      ctx.lineTo(40, 2); ctx.quadraticCurveTo(-14, 8, -56, 0);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = c1; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(6, -20); ctx.lineTo(14, -58); ctx.stroke();
    } else if (kind === 'statue') {
      ctx.fillStyle = c2; roundRect(ctx, -18, -10, 36, 10, 2); ctx.fill();
      ctx.fillStyle = c1;
      roundRect(ctx, -8, -52, 16, 44, 5); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -58, 8, 0, TAU); ctx.fill();
      ctx.fillStyle = c2;
      ctx.fillRect(-14, -44, 28, 3);
    } else if (kind === 'crystal') {
      for (let i = 0; i < 4; i++) {
        const cx = (i - 1.5) * 15, hgt = 26 + (i % 3) * 14;
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(cx, 0); ctx.lineTo(cx - 7, -hgt * 0.6);
        ctx.lineTo(cx, -hgt); ctx.lineTo(cx + 7, -hgt * 0.6);
        ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (dc.glow) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(0, -26, 0, 0, -26, 52);
        g.addColorStop(0, U.rgbToCss(U.hexToRgb(c1), 0.22 * dc.glow));
        g.addColorStop(1, U.rgbToCss(U.hexToRgb(c1), 0));
        ctx.fillStyle = g; ctx.fillRect(-60, -80, 120, 100);
        ctx.restore();
      }
    } else if (kind === 'pipes') {
      ctx.strokeStyle = c1; ctx.lineWidth = 7; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-24, -34); ctx.lineTo(6, -34); ctx.stroke();
      ctx.strokeStyle = c2; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(16, -22); ctx.stroke();
      if (dc.bubbles) {
        ctx.fillStyle = 'rgba(255,255,255,0.34)';
        for (let i = 0; i < 5; i++) {
          const p = ((t * 0.4 + i / 5) % 1);
          ctx.beginPath();
          ctx.arc(6 + Math.sin(p * 7 + i) * 3, -34 - p * (r.h * 0.6), 1.6 + p * 1.6, 0, TAU);
          ctx.fill();
        }
      }
    } else if (kind === 'machine') {
      ctx.fillStyle = c2; roundRect(ctx, -30, -46, 60, 46, 4); ctx.fill();
      ctx.strokeStyle = c1; ctx.lineWidth = 2.4;
      const a = t * (dc.spin ? 0.9 : 0);
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(0, -24);
        ctx.rotate(a + i * TAU / 3);
        ctx.beginPath(); ctx.ellipse(0, 0, 15, 6, 0, 0, TAU); ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = U.rgbToCss(U.hexToRgb(c1), 0.5 + 0.5 * Math.sin(t * 2.3));
      ctx.beginPath(); ctx.arc(0, -24, 3.4, 0, TAU); ctx.fill();
    } else if (kind === 'frag') {
      for (let i = 0; i < 6; i++) {
        const p = (t * 0.14 + i / 6) % 1;
        const fx = Math.sin(p * TAU + i) * 34;
        const fy = -18 - Math.cos(p * TAU * 0.7 + i) * 26;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(t * 0.5 + i);
        ctx.fillStyle = i % 2 ? c1 : c2;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 7); ctx.lineTo(-5, 1);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'hook') {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -r.h); ctx.lineTo(0, -34); ctx.stroke();
      ctx.strokeStyle = c1; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -34); ctx.lineTo(0, -16);
      ctx.arc(-6, -16, 6, 0, Math.PI, false);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* One specimen, swimming. Size follows what it actually weighed against the
     rest of its species, so a record fish in a tank is visibly a record fish
     and does not simply have a bigger number under it. */
  function drawSpecimen(ctx, r, k, i, n, t, hot) {
    const f = VF.fish.byId(k.id);
    if (!f) return;

    const bedY = r.y + r.h - Math.max(10, r.h * 0.15);
    const top = r.y + 14;
    const lane = (i + 0.5) / n;
    const span = Math.max(20, bedY - top);

    const sp = 0.10 + ((i * 37) % 13) / 13 * 0.14;
    const phase = (i * 1.37) % TAU;
    const p = (t * sp + phase / TAU) % 1;
    // there and back, so it turns at the glass rather than teleporting
    const tri = p < 0.5 ? p * 2 : 2 - p * 2;
    const dir = p < 0.5 ? 1 : -1;

    const pad = 26;
    const x = r.x + pad + (r.w - pad * 2) * tri;
    const y = top + span * (0.18 + lane * 0.64) + Math.sin(t * 0.8 + phase) * span * 0.06;

    // how big it is for its species, on the same 0..1 the catch card uses
    const pct = k.pct === undefined ? 0.5 : U.clamp(k.pct, 0, 1);
    const size = Math.max(9, Math.min(r.h * 0.30, (r.h * 0.10) * (0.62 + pct * 1.05)));

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    if (hot) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.6);
      g.addColorStop(0, 'rgba(180,220,255,0.20)');
      g.addColorStop(1, 'rgba(180,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-size * 3, -size * 3, size * 6, size * 6);
      ctx.restore();
    }
    try {
      VF.fishArt.draw(ctx, f, size, { time: t + phase, traits: k.traits || [] });
    } catch (e) { /* one bad specimen must not take the room down */ }
    ctx.restore();
  }

  /* ---------------------------------------------------- desk, cabinet, plinth */

  function drawDesk(ctx, r, t, hot) {
    // legs
    ctx.fillStyle = '#0d1219';
    ctx.fillRect(r.x + 8, r.y + r.h * 0.42, 7, r.h * 0.58);
    ctx.fillRect(r.x + r.w - 15, r.y + r.h * 0.42, 7, r.h * 0.58);
    // top
    ctx.fillStyle = '#1a222c';
    roundRect(ctx, r.x, r.y + r.h * 0.34, r.w, r.h * 0.12, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    ctx.fillRect(r.x, r.y + r.h * 0.34, r.w, 1.5);

    // the screen standing on it, which is the only thing in the room that is
    // showing you numbers
    const sw = r.w * 0.56, sh = r.h * 0.30;
    const sx = r.x + r.w * 0.10, sy = r.y + r.h * 0.34 - sh - 4;
    ctx.fillStyle = '#080c12';
    roundRect(ctx, sx, sy, sw, sh, 3); ctx.fill();
    ctx.strokeStyle = hot ? 'rgba(180,220,255,0.8)' : 'rgba(255,255,255,0.14)';
    ctx.lineWidth = hot ? 2 : 1;
    roundRect(ctx, sx, sy, sw, sh, 3); ctx.stroke();

    // lines of something scrolling on it
    ctx.save();
    ctx.beginPath(); roundRect(ctx, sx, sy, sw, sh, 3); ctx.clip();
    const rows = 6;
    for (let i = 0; i < rows; i++) {
      const yy = sy + 5 + i * (sh - 8) / rows;
      const wob = (Math.sin(t * 0.7 + i * 1.9) * 0.5 + 0.5);
      ctx.fillStyle = 'rgba(120,200,180,' + (0.18 + wob * 0.22).toFixed(3) + ')';
      ctx.fillRect(sx + 5, yy, (sw - 12) * (0.25 + wob * 0.6), 1.6);
    }
    ctx.restore();

    // the glow it throws
    const g = ctx.createRadialGradient(sx + sw / 2, sy + sh / 2, 0, sx + sw / 2, sy + sh / 2, sw);
    g.addColorStop(0, 'rgba(120,220,190,0.13)');
    g.addColorStop(1, 'rgba(120,220,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - sw, sy - sw, sw * 3, sw * 3);

    // a mug, because somebody works here
    ctx.fillStyle = '#c8ccd2';
    roundRect(ctx, r.x + r.w * 0.76, r.y + r.h * 0.34 - 13, 12, 13, 2); ctx.fill();
    ctx.strokeStyle = '#c8ccd2'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(r.x + r.w * 0.76 + 15, r.y + r.h * 0.34 - 7, 4, -1.2, 1.2); ctx.stroke();
  }

  function drawCabinet(ctx, r, t, hot) {
    // the carcass, lit down one side
    const cg = ctx.createLinearGradient(r.x, 0, r.x + r.w, 0);
    cg.addColorStop(0, '#1d2530');
    cg.addColorStop(0.4, '#151c25');
    cg.addColorStop(1, '#0c1118');
    ctx.fillStyle = cg;
    roundRect(ctx, r.x, r.y, r.w, r.h, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(r.x, r.y, r.w, 1.5);

    /* The top shelf is glass, and there is something on it. A cabinet with
       four closed drawers is a filing cabinet; one with a lit shelf is a
       cabinet somebody keeps things in. */
    const gh = Math.round(r.h * 0.30);
    ctx.fillStyle = 'rgba(120,190,220,0.10)';
    roundRect(ctx, r.x + 5, r.y + 6, r.w - 10, gh, 2); ctx.fill();
    const items = [['#d9ac52', 0.30], ['#bfe6f2', 0.58], ['#b48aff', 0.82]];
    items.forEach(function (it, i) {
      const x = r.x + 5 + (r.w - 10) * it[1];
      const hgt = 9 + (i % 2) * 6;
      ctx.fillStyle = U.rgbToCss(U.hexToRgb(it[0]), 0.62);
      roundRect(ctx, x - 4, r.y + 6 + gh - hgt - 3, 8, hgt, 2); ctx.fill();
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1;
    roundRect(ctx, r.x + 5, r.y + 6, r.w - 10, gh, 2); ctx.stroke();
    // the light inside it spilling out
    const sg = ctx.createLinearGradient(0, r.y + 6, 0, r.y + 6 + gh);
    sg.addColorStop(0, 'rgba(170,220,240,0.16)');
    sg.addColorStop(1, 'rgba(170,220,240,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(r.x + 5, r.y + 6, r.w - 10, gh);

    // and the drawers under it
    const top = r.y + 6 + gh + 8;
    const rows = 3;
    const rh = (r.y + r.h - 8 - top) / rows;
    for (let i = 0; i < rows; i++) {
      const y = top + i * rh;
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      roundRect(ctx, r.x + 5, y, r.w - 10, rh - 4, 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.42)';
      roundRect(ctx, r.x + 5, y, r.w - 10, rh - 4, 2); ctx.stroke();
      ctx.fillStyle = 'rgba(200,215,230,0.34)';
      ctx.fillRect(r.x + r.w * 0.5 - 10, y + (rh - 4) * 0.5 - 1, 20, 2.4);
    }

    ctx.strokeStyle = hot ? 'rgba(180,220,255,0.85)' : 'rgba(255,255,255,0.10)';
    ctx.lineWidth = hot ? 2 : 1;
    roundRect(ctx, r.x, r.y, r.w, r.h, 4); ctx.stroke();

    // a small light on it, on
    ctx.fillStyle = 'rgba(120,230,170,' + (0.45 + 0.4 * Math.sin(t * 1.1)).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(r.x + r.w - 11, r.y + r.h - 9, 2.2, 0, TAU); ctx.fill();
  }

  function drawPedestal(ctx, r, k, t, hot) {
    const pd = cfg('pedestal');
    const kind = pd.kind || 'none';
    if (kind === 'none' && !k) return;

    const cx = r.x + r.w / 2;
    const topY = r.y + r.h * 0.52;

    if (kind !== 'none' && kind !== 'null') {
      const c1 = U.hexToRgb(pd.c1 || '#8d9298');
      const c2 = U.hexToRgb(pd.c2 || '#43484e');
      // the column, lit from the same side as everything else in the room
      const cg = ctx.createLinearGradient(r.x + r.w * 0.20, 0, r.x + r.w * 0.80, 0);
      cg.addColorStop(0, U.rgbToCss(U.shade(c2, 0.22)));
      cg.addColorStop(0.35, U.rgbToCss(c2));
      cg.addColorStop(1, U.rgbToCss(U.shade(c2, -0.34)));
      ctx.fillStyle = cg;
      roundRect(ctx, r.x + r.w * 0.26, topY, r.w * 0.48, r.h * 0.46, 3); ctx.fill();
      // and its base, so it is standing on the floor rather than floating
      ctx.fillStyle = U.rgbToCss(U.shade(c2, -0.42));
      roundRect(ctx, r.x + r.w * 0.16, topY + r.h * 0.40, r.w * 0.68, r.h * 0.10, 2); ctx.fill();
      // the top slab
      const tg = ctx.createLinearGradient(0, topY - 11, 0, topY + 2);
      tg.addColorStop(0, U.rgbToCss(U.shade(c1, 0.16)));
      tg.addColorStop(1, U.rgbToCss(U.shade(c1, -0.28)));
      ctx.fillStyle = tg;
      roundRect(ctx, r.x + r.w * 0.12, topY - 11, r.w * 0.76, 13, 3); ctx.fill();
      if (pd.sheen) {
        ctx.fillStyle = 'rgba(255,255,255,0.20)';
        ctx.fillRect(r.x + r.w * 0.12, topY - 11, r.w * 0.76, 1.6);
      }
      // the shadow it casts
      ctx.fillStyle = 'rgba(0,0,0,0.34)';
      ctx.beginPath();
      ctx.ellipse(r.x + r.w * 0.5, topY + r.h * 0.51, r.w * 0.40, r.h * 0.05, 0, 0, TAU);
      ctx.fill();
    }
    if (kind === 'null') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(cx, topY, 0, cx, topY, r.w * 0.5);
      g.addColorStop(0, U.rgbToCss(U.hexToRgb(pd.c1 || '#b48aff'), 0.20));
      g.addColorStop(1, U.rgbToCss(U.hexToRgb(pd.c1 || '#b48aff'), 0));
      ctx.fillStyle = g;
      ctx.fillRect(r.x - 40, topY - r.h, r.w + 80, r.h * 2);
      ctx.restore();
    }

    if (k) {
      const f = VF.fish.byId(k.id);
      if (f) {
        const size = Math.min(r.w * 0.24, r.h * 0.28);
        ctx.save();
        // it hovers above the slab rather than growing out of it
        ctx.translate(cx, topY - 16 - size * 0.62 + Math.sin(t * 0.7) * 3);
        if (kind === 'glass') {
          ctx.save();
          ctx.globalAlpha = 0.10;
          ctx.fillStyle = '#bfe6f2';
          roundRect(ctx, -r.w * 0.30, -size * 1.5, r.w * 0.60, size * 2.6, 6);
          ctx.fill();
          ctx.restore();
        }
        try {
          VF.fishArt.draw(ctx, f, size, { time: t, traits: k.traits || [] });
        } catch (e) { /* nothing */ }
        ctx.restore();
      }
    }

    if (hot) {
      ctx.strokeStyle = 'rgba(180,220,255,0.7)';
      ctx.lineWidth = 1.6;
      roundRect(ctx, r.x, r.y, r.w, r.h, 6);
      ctx.stroke();
    }
  }

  /* ---------------------------------------------------------------- helpers */

  function roundRect(ctx, x, y, w, h, r) {
    const k = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + w - k, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + k);
    ctx.lineTo(x + w, y + h - k);
    ctx.quadraticCurveTo(x + w, y + h, x + w - k, y + h);
    ctx.lineTo(x + k, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - k);
    ctx.lineTo(x, y + k);
    ctx.quadraticCurveTo(x, y, x + k, y);
    ctx.closePath();
  }

  function hit(r, x, y) {
    return !!r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  /* What the pointer is over, in the order things sit in front of each other. */
  function pick(L, x, y) {
    if (hit(L.desk, x, y)) return { kind: 'desk' };
    if (hit(L.pedestal, x, y)) return { kind: 'pedestal' };
    if (hit(L.cabinet, x, y)) return { kind: 'cabinet' };
    for (let i = 0; i < L.tanks.length; i++) {
      const r = L.tanks[i];
      if (hit({ x: r.x - 6, y: r.y - 14, w: r.w + 12, h: r.h + 34 }, x, y)) {
        return { kind: 'tank', index: i };
      }
    }
    if (hit(L.window, x, y)) return { kind: 'window' };
    return null;
  }

  /* One frame of the whole room. */
  function draw(ctx, w, h, t, opt) {
    opt = opt || {};
    const tanks = VF.aquarium.tanks();
    const L = layout(w, h, tanks.length);

    drawRoom(ctx, L, t);
    drawWindow(ctx, L.window, t);
    drawCabinet(ctx, L.cabinet, t, opt.hot === 'cabinet');

    for (let i = 0; i < L.tanks.length; i++) {
      drawTank(ctx, L.tanks[i], tanks[i], t, {
        hot: opt.hot === 'tank' && opt.hotIndex === i,
        selected: opt.tank === i ? opt.specimen : -1
      });
    }

    drawPedestal(ctx, L.pedestal, opt.showpiece, t, opt.hot === 'pedestal');
    drawDesk(ctx, L.desk, t, opt.hot === 'desk');

    /* dust in the air, in front of everything — the cheapest thing there is
       for making a still room feel like it has air in it */
    const rnd = VF.rng.make(0xD057);
    ctx.save();
    for (let i = 0; i < 34; i++) {
      const bx = rnd() * w;
      const sp = 3 + rnd() * 9;
      const by = ((rnd() * h - t * sp) % h + h) % h;
      ctx.fillStyle = U.rgbToCss([220, 235, 255], 0.05 + rnd() * 0.10);
      ctx.fillRect(bx, by, 1.3, 1.3);
    }
    ctx.restore();

    // and a vignette, so the eye goes to the tanks
    const v = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.28, w * 0.5, h * 0.45, h * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    return L;
  }

  VF.aquariumArt = { draw: draw, layout: layout, pick: pick, roundRect: roundRect };
})(window.VF = window.VF || {});
