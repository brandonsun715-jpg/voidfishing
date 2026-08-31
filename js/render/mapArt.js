/* VOID FISHING — the chart.

   IT USED TO BE A PLUMB LINE. One vertical spine with every place hung off it
   at its own depth, because everywhere in this game is arranged by how far
   down it is. That was a true thing to say about the progression and it was
   the only thing the map could say: there were no coordinates anywhere in the
   build, so there was no north, no east, no distance and no shape. Two places
   adjacent on the ladder were adjacent on the chart whether they were an hour
   apart or a week, and a man had been telling the player about the EASTERN
   markers since level four in a world that had no east in it.

   So now there is one. Every place carries `at` — leagues east and south,
   with the harbour at the origin — and this file draws the sea it implies:

     a coastline, generated rather than drawn, so the land has the same kind
       of grain as everything else in this game and costs eleven control
       points instead of a bitmap
     soundings and contours where you have been
     UNSURVEYED WATER, which is the whole point of having a chart at all —
       blank, hatched, and honest about how much of this you have not seen
     the shoal patches and the deep, because the boat has a draught and a
       pressure rating now and those are facts about water rather than about
       boats
     routes with their real length, which is where a crossing's duration
       comes from

   THE RULE THIS FILE KEPT FROM THE OLD ONE: it draws and it hit-tests, and it
   reads no game state. What is unlocked, what is current, what is secret and
   what has been surveyed all arrive in the node list from the panel. Four
   functions out, the same four as before, so js/ui/panels.js kept its shape. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const G = VF.grammar;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------ the land

     Eleven control points and a noise field. The coast runs west to east
     across the top of the world with a bay in it where the harbour is, and
     there is an arm coming down the western side — which is why the Glass
     Flats sit in a bight and the Nowhere Sea does not sit in anything.

     It is generated at a fixed seed, so it is the same coastline in every
     save and on every machine, and nobody has to store it. */
  const COAST = [
    { x: -16.0, y: 13.0 }, { x: -13.4, y: 6.0 }, { x: -12.2, y: 0.6 },
    { x: -10.6, y: -3.2 }, { x: -8.6, y: -5.0 }, { x: -6.4, y: -5.8 },
    { x: -4.4, y: -5.6 },
    /* The bay, and it takes four points rather than two — with two the coast
       came to a V and read as a wedge cut out of the land rather than as
       water reaching in. The harbour is at the head of it. */
    { x: -3.0, y: -4.4 }, { x: -1.6, y: -3.0 }, { x: -0.2, y: -2.4 },
    { x: 1.0, y: -2.8 },
    /* and the headland east of it — the one with the light on the end */
    { x: 2.0, y: -3.9 }, { x: 3.4, y: -5.2 }, { x: 5.4, y: -6.2 },
    { x: 9.0, y: -7.4 }, { x: 13.0, y: -8.4 }, { x: 18.0, y: -9.2 }
  ];

  /* Small ground that is not the mainland. Lantern Isle has one because it is
     one; the other two are there because a sea with nothing in it but the
     places you fish is a diagram. */
  const ISLES = [
    { x: 7.1, y: 1.0, r: 0.55, seed: 31 },
    { x: -6.2, y: 1.4, r: 0.34, seed: 77 },
    { x: 4.4, y: 4.8, r: 0.22, seed: 12 }
  ];

  let coastCache = null;
  let LAST = null, LAST_NODES = [];       // the view and marks of the last frame
  function coast() {
    if (coastCache) return coastCache;
    const smooth = G.spline(COAST, 150, 0.5);
    /* the grain: a coastline that is a smooth curve is a road */
    coastCache = smooth.map(function (p, i) {
      const n = G.fbm(i * 0.09, 4409, 4, 0.55) - 0.5;
      const m = G.fbm(i * 0.31, 991, 3, 0.5) - 0.5;
      return { x: p.x + m * 0.55, y: p.y + n * 1.5 };
    });
    return coastCache;
  }

  function isleRing(is) {
    const out = [];
    for (let i = 0; i <= 22; i++) {
      const a = i / 22 * TAU;
      const r = is.r * (0.72 + G.noise1(i * 0.7, is.seed) * 0.62);
      out.push({ x: is.x + Math.cos(a) * r, y: is.y + Math.sin(a) * r * 0.8 });
    }
    return out;
  }

  /* ---------------------------------------------------------- projection

     The view is a world point at the centre of the canvas and a scale in
     pixels per league. Both live on the caller so the chart can be dragged
     and pinched without this file holding any state. */
  function toScreen(v, wx, wy, w, h) {
    return { x: w * 0.5 + (wx - v.cx) * v.scale,
             y: h * 0.5 + (wy - v.cy) * v.scale };
  }
  function toWorld(v, px, py, w, h) {
    return { x: v.cx + (px - w * 0.5) / v.scale,
             y: v.cy + (py - h * 0.5) / v.scale };
  }

  /* A view that fits everything the player knows about, with a margin — what
     the panel opens on and what "recentre" goes back to. */
  function fit(nodes, w, h) {
    if (!nodes.length) return { cx: 0, cy: 0, scale: 26 };
    let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
    nodes.forEach(function (nd, i) {
      if (!i) { x0 = x1 = nd.wx; y0 = y1 = nd.wy; return; }
      x0 = Math.min(x0, nd.wx); x1 = Math.max(x1, nd.wx);
      y0 = Math.min(y0, nd.wy); y1 = Math.max(y1, nd.wy);
    });
    const pad = 3.2;
    const sx = w / Math.max(1, (x1 - x0) + pad * 2);
    const sy = h / Math.max(1, (y1 - y0) + pad * 2);
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, scale: Math.min(sx, sy) };
  }

  /* -------------------------------------------------------------- layout

     A node per place, in WORLD coordinates. Screen positions are worked out
     at draw time from the view, and written back onto the node so `hit` can
     use them — the same arrangement the plumb line used, for the same reason:
     the panel owns the node list and passes it to both. */
  function layout(places) {
    return places.map(function (p) {
      const at = (p.loc && p.loc.at) || [0, 0];
      return {
        p: p, wx: at[0], wy: at[1],
        kind: p.secret ? 'hidden' : 'shelf',
        x: 0, y: 0, r: 0
      };
    });
  }

  /* The sounding at a mark, as a person would write it on a chart. */
  function sounding(node) {
    const m = node && node.p && node.p.loc ? (node.p.loc.depthM || 0) : 0;
    if (!m) return null;
    return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m';
  }

  /* ------------------------------------------------------------ surveyed

     What you have seen. A disc around every mark you have stood in, plus the
     harbour, and everything outside is blank. This is the single most useful
     thing a chart can say and the plumb line could not say it at all: how
     much of this there is that you have not been to. */
  function coverage(nodes) {
    const out = [{ x: 0, y: 0, r: 4.5 }];          // the harbour, always
    nodes.forEach(function (nd) {
      if (!nd.p.unlocked) return;
      out.push({ x: nd.wx, y: nd.wy, r: nd.p.secret ? 2.4 : 3.8 });
    });
    return out;
  }
  function surveyed(cov, x, y) {
    for (let i = 0; i < cov.length; i++) {
      const c = cov[i];
      if ((x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) < c.r * c.r) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- paint */

  function draw(g, w, h, nodes, opts) {
    opts = opts || {};
    const t = opts.time || 0;
    const v = opts.view || fit(nodes, w, h);
    const sel = opts.selected, cur = opts.current;
    const boat = opts.boat || null;      // { draught, pressure, name }

    /* The view this frame was drawn with, kept where the tools can read it.
       The chart animates — the ring on where you are breathes — so comparing
       two frames pixel for pixel cannot tell a drag from a heartbeat, and a
       test that cannot tell those apart is a test that passes for free. */
    LAST = v;
    LAST_NODES = nodes;

    /* screen positions, written back for the hit test */
    nodes.forEach(function (nd) {
      const s = toScreen(v, nd.wx, nd.wy, w, h);
      nd.x = s.x; nd.y = s.y;
      nd.r = nd.p.secret ? 5 : 7;
    });

    const cov = coverage(nodes);

    /* --- the paper -------------------------------------------------------
       A chart is ink on something. The something is the reason it does not
       read as a screen with dots on it. */
    g.clearRect(0, 0, w, h);
    const paper = g.createLinearGradient(0, 0, w * 0.4, h);
    paper.addColorStop(0, '#0b1017');
    paper.addColorStop(1, '#070a10');
    g.fillStyle = paper;
    g.fillRect(0, 0, w, h);

    /* --- the surveyed sea ------------------------------------------------
       Everything inside coverage is water somebody has taken soundings in.
       It is drawn as a tint that deepens with the sounding, so the chart
       carries the vertical as well as the plan. */
    g.save();
    g.beginPath();
    cov.forEach(function (c) {
      const s = toScreen(v, c.x, c.y, w, h);
      g.moveTo(s.x + c.r * v.scale, s.y);
      g.arc(s.x, s.y, c.r * v.scale, 0, TAU);
    });
    g.clip();
    g.fillStyle = '#0e1a26';
    g.fillRect(0, 0, w, h);
    /* deeper water is darker, sampled off the marks themselves */
    nodes.forEach(function (nd) {
      if (!nd.p.unlocked) return;
      const m = (nd.p.loc && nd.p.loc.depthM) || 0;
      const k = U.clamp(m / 4000, 0, 1);
      const rg = g.createRadialGradient(nd.x, nd.y, 0, nd.x, nd.y, 3.2 * v.scale);
      rg.addColorStop(0, 'rgba(2,6,12,' + (0.10 + k * 0.55).toFixed(3) + ')');
      rg.addColorStop(1, 'rgba(2,6,12,0)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(nd.x, nd.y, 3.2 * v.scale, 0, TAU); g.fill();
    });
    drawContours(g, w, h, v, nodes);
    g.restore();

    /* --- unsurveyed water, hatched --------------------------------------
       Not decoration. This is the negative space of the whole game, and the
       chart is the only place it can be seen at once. */
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    cov.forEach(function (c) {
      const s = toScreen(v, c.x, c.y, w, h);
      g.moveTo(s.x + c.r * v.scale, s.y);
      g.arc(s.x, s.y, c.r * v.scale, 0, TAU, true);
    });
    g.clip('evenodd');
    g.strokeStyle = 'rgba(120,160,200,0.055)';
    g.lineWidth = 1;
    const step = 13;
    g.beginPath();
    for (let i = -h; i < w + h; i += step) { g.moveTo(i, 0); g.lineTo(i + h, h); }
    g.stroke();
    g.restore();

    /* --- the land --------------------------------------------------------
       Drawn only where it has been surveyed, because a coastline you have
       never seen is a coastline nobody drew. */
    g.save();
    g.beginPath();
    cov.forEach(function (c) {
      const s = toScreen(v, c.x, c.y, w, h);
      g.moveTo(s.x + c.r * v.scale, s.y);
      g.arc(s.x, s.y, c.r * v.scale, 0, TAU);
    });
    g.clip();
    drawLand(g, w, h, v);
    g.restore();
    /* And a ghost of it outside the survey, so the world does not stop at the
       edge of what you have seen — clipped to the UNSURVEYED side, or it lays
       a stain over the properly drawn coast rather than continuing it. */
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h);
    cov.forEach(function (c) {
      const s2 = toScreen(v, c.x, c.y, w, h);
      g.moveTo(s2.x + c.r * v.scale, s2.y);
      g.arc(s2.x, s2.y, c.r * v.scale, 0, TAU, true);
    });
    g.clip('evenodd');
    g.globalAlpha = 0.30;
    drawLand(g, w, h, v, true);
    g.restore();

    /* --- what the boat can and cannot work ------------------------------- */
    if (boat) drawBand(g, w, h, v, nodes, boat);

    /* --- routes ---------------------------------------------------------- */
    drawRoutes(g, nodes, cur, sel);

    /* --- home ------------------------------------------------------------
       Always on the chart, always at the origin, and drawn before the water
       so a mark that happens to sit near it wins. It is not a fishing spot
       and it does not get a sounding. */
    drawHome(g, w, h, v, sel === 'harbour');

    /* --- the marks ------------------------------------------------------- */
    nodes.forEach(function (nd) { drawMark(g, nd, t, nd.p.id === sel, nd.p.id === cur); });

    /* --- and the furniture a chart has ----------------------------------- */
    drawRose(g, w, h);
    drawScale(g, w, h, v);
  }

  /* Depth contours: closed-ish lines at a few soundings, from the same noise
     the coast uses so they belong to the same hand. */
  /* Isobaths. Around the deep places rather than around the middle of the
     canvas, because a contour is a line joining points of equal depth and a
     ring drawn at an arbitrary centre is a decoration pretending to be one.
     Three per mark, widening outwards, so the chart says "it shelves towards
     here" — which is the one thing about the vertical a plan view CAN say. */
  function drawContours(g, w, h, v, nodes) {
    g.lineWidth = 1;
    nodes.forEach(function (nd, k) {
      if (!nd.p.unlocked || !nd.p.loc) return;
      const m = nd.p.loc.depthM || 0;
      if (m < 300) return;                       // shallow water has no shelf
      const rings = m > 2000 ? 3 : 2;
      for (let ring = 1; ring <= rings; ring++) {
        const r = (0.5 + ring * 0.62) * (1 + U.clamp(m / 4000, 0, 1));
        g.strokeStyle = 'rgba(150,200,240,' + (0.24 - ring * 0.05).toFixed(3) + ')';
        g.beginPath();
        for (let i = 0; i <= 48; i++) {
          const a = i / 48 * TAU;
          const wob = 1 + (G.noise1(i * 0.19 + ring * 5 + k * 13, 313) - 0.5) * 0.42;
          const p = toScreen(v, nd.wx + Math.cos(a) * r * wob,
                                nd.wy + Math.sin(a) * r * wob * 0.88, w, h);
          i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
        }
        g.closePath();
        g.stroke();
      }
    });
  }

  function drawLand(g, w, h, v, ghost) {
    const c = coast();
    g.beginPath();
    const first = toScreen(v, c[0].x, c[0].y, w, h);
    g.moveTo(first.x, first.y);
    for (let i = 1; i < c.length; i++) {
      const p = toScreen(v, c[i].x, c[i].y, w, h);
      g.lineTo(p.x, p.y);
    }
    /* close it off the top of the world — everything north of the line is
       ground, and how far north is nobody's business */
    const last = toScreen(v, c[c.length - 1].x, c[c.length - 1].y, w, h);
    g.lineTo(last.x + 4000, last.y);
    g.lineTo(last.x + 4000, -4000);
    g.lineTo(first.x - 4000, -4000);
    g.lineTo(first.x - 4000, first.y);
    g.closePath();
    g.fillStyle = ghost ? 'rgba(48,58,44,0.85)' : '#232a1e';
    g.fill();
    if (!ghost) {
      g.strokeStyle = 'rgba(198,216,172,0.55)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(first.x, first.y);
      for (let i = 1; i < c.length; i++) {
        const p = toScreen(v, c[i].x, c[i].y, w, h);
        g.lineTo(p.x, p.y);
      }
      g.stroke();
    }

    ISLES.forEach(function (is) {
      const ring = isleRing(is);
      g.beginPath();
      ring.forEach(function (p, i) {
        const s = toScreen(v, p.x, p.y, w, h);
        i ? g.lineTo(s.x, s.y) : g.moveTo(s.x, s.y);
      });
      g.closePath();
      g.fillStyle = ghost ? 'rgba(48,58,44,0.85)' : '#232a1e';
      g.fill();
      if (!ghost) {
        g.strokeStyle = 'rgba(198,216,172,0.55)';
        g.lineWidth = 1;
        g.stroke();
      }
    });
  }

  /* The water this boat can work, as a band on the chart rather than as a
     sentence in a menu. Shoal water she draws too much for is crossed out;
     water she is not rated deep enough for is shaded. */
  function drawBand(g, w, h, v, nodes, boat) {
    nodes.forEach(function (nd) {
      if (!nd.p.unlocked || !nd.p.loc) return;
      const shoal = nd.p.loc.shoal === undefined ? 99 : nd.p.loc.shoal;
      const deep = nd.p.loc.depthM || 0;
      const tooBig = boat.draught > shoal;
      const tooDeep = boat.pressure < deep;
      if (!tooBig && !tooDeep) return;
      /* A ring and a bar through it. Orange for "she draws too much", violet
         for "she is not rated deep enough" — the two are different problems
         with different answers (take something off; buy a bigger hull) and a
         single warning colour would say neither. */
      const col = tooBig ? 'rgba(255,168,110,0.72)' : 'rgba(168,150,235,0.68)';
      g.save();
      g.strokeStyle = col;
      g.lineWidth = 1.3;
      g.setLineDash(tooBig ? [4, 3] : [1.5, 3.5]);
      g.beginPath(); g.arc(nd.x, nd.y, 14, 0, TAU); g.stroke();
      g.setLineDash([]);
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(nd.x - 9.9, nd.y - 9.9); g.lineTo(nd.x + 9.9, nd.y + 9.9);
      g.stroke();
      g.restore();
    });
  }

  function drawRoutes(g, nodes, cur, sel) {
    const from = nodes.filter(function (nd) { return nd.p.id === cur; })[0];
    if (!from) return;
    g.save();
    nodes.forEach(function (nd) {
      if (nd === from || !nd.p.unlocked) return;
      const on = nd.p.id === sel;
      g.strokeStyle = on ? 'rgba(200,230,255,0.75)' : 'rgba(150,190,225,0.22)';
      g.lineWidth = on ? 1.6 : 1;
      g.setLineDash(on ? [] : [2, 5]);
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(nd.x, nd.y);
      g.stroke();
      if (on) {
        /* how far it actually is, on the line, because that is the number the
           crossing is about to spend */
        const mx = (from.x + nd.x) / 2, my = (from.y + nd.y) / 2;
        const lg = Math.hypot(nd.wx - from.wx, nd.wy - from.wy);
        g.setLineDash([]);
        g.font = '9px ui-monospace, Menlo, monospace';
        g.fillStyle = 'rgba(190,225,255,0.65)';
        g.textAlign = 'center';
        g.fillText(lg.toFixed(1) + ' leagues', mx, my - 5);
      }
    });
    g.setLineDash([]);
    g.restore();
  }

  function drawMark(g, nd, t, isSel, isCur) {
    const p = nd.p;
    const col = p.unlocked ? (p.glow || '#8fb8d8') : 'rgba(150,180,205,0.45)';
    g.save();

    if (isCur) {
      /* where you are: a ring that breathes, and it is the only thing on the
         chart that moves */
      const pr = 12 + Math.sin(t * 1.6) * 1.6;
      g.strokeStyle = U.rgbToCss(U.hexToRgb(p.glow || '#8fb8d8'), 0.34);
      g.lineWidth = 1;
      g.beginPath(); g.arc(nd.x, nd.y, pr, 0, TAU); g.stroke();
    }
    if (isSel) {
      g.strokeStyle = 'rgba(220,240,255,0.85)';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(nd.x, nd.y, nd.r + 5, 0, TAU); g.stroke();
    }

    if (!p.unlocked) {
      /* Water you have been told about and not stood in: a bare cross with no
         name against it, which is exactly how much you know. */
      g.strokeStyle = col; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(nd.x - 4, nd.y); g.lineTo(nd.x + 4, nd.y);
      g.moveTo(nd.x, nd.y - 4); g.lineTo(nd.x, nd.y + 4);
      g.stroke();
      g.restore();
      return;
    }

    g.fillStyle = col;
    if (p.secret) {
      /* hidden water is a different mark, not a smaller one */
      g.beginPath();
      g.moveTo(nd.x, nd.y - nd.r); g.lineTo(nd.x + nd.r, nd.y);
      g.lineTo(nd.x, nd.y + nd.r); g.lineTo(nd.x - nd.r, nd.y);
      g.closePath(); g.fill();
    } else {
      g.beginPath(); g.arc(nd.x, nd.y, nd.r * 0.55, 0, TAU); g.fill();
      g.strokeStyle = col; g.lineWidth = 1;
      g.beginPath(); g.arc(nd.x, nd.y, nd.r, 0, TAU); g.stroke();
    }

    g.font = '10.5px ui-sans-serif, system-ui, sans-serif';
    g.fillStyle = isSel || isCur ? 'rgba(235,245,255,0.95)' : 'rgba(200,220,240,0.62)';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(p.name, nd.x + nd.r + 6, nd.y);
    const s = sounding(nd);
    if (s) {
      g.font = '9px ui-monospace, Menlo, monospace';
      g.fillStyle = 'rgba(170,200,225,0.40)';
      g.fillText(s, nd.x + nd.r + 6, nd.y + 11);
    }
    g.restore();
  }

  /* Home. An anchor, because everything else on this chart is a circle or a
     diamond and the one place you sleep should not be another circle. */
  function drawHome(g, w, h, v, isSel) {
    const at = (VF.placeData && VF.placeData.location.at) || [0, 0];
    const s = toScreen(v, at[0], at[1], w, h);
    g.save();
    if (isSel) {
      g.strokeStyle = 'rgba(220,240,255,0.85)';
      g.lineWidth = 1.2;
      g.beginPath(); g.arc(s.x, s.y, 12, 0, TAU); g.stroke();
    }
    g.strokeStyle = '#e8c88a';
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(s.x, s.y - 6); g.lineTo(s.x, s.y + 5);
    g.moveTo(s.x - 4, s.y - 3.5); g.lineTo(s.x + 4, s.y - 3.5);
    g.moveTo(s.x - 5, s.y + 1.5);
    g.quadraticCurveTo(s.x, s.y + 8.5, s.x + 5, s.y + 1.5);
    g.stroke();
    g.beginPath(); g.arc(s.x, s.y - 7.6, 1.7, 0, TAU); g.stroke();
    g.font = '10.5px ui-sans-serif, system-ui, sans-serif';
    g.fillStyle = 'rgba(232,200,138,0.85)';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText('Vault Harbour', s.x + 11, s.y);
    g.restore();
    return s;
  }

  /* North, because a chart without one is a picture. */
  function drawRose(g, w, h) {
    const x = w - 34, y = 34, r = 13;
    g.save();
    g.strokeStyle = 'rgba(180,210,235,0.30)';
    g.lineWidth = 1;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
    g.beginPath();
    g.moveTo(x, y - r - 3); g.lineTo(x - 3.5, y + 2); g.lineTo(x + 3.5, y + 2);
    g.closePath();
    g.fillStyle = 'rgba(200,225,245,0.70)';
    g.fill();
    g.font = '8px ui-monospace, Menlo, monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(180,210,235,0.55)';
    g.fillText('N', x, y - r - 9);
    g.restore();
  }

  /* And a bar, because "leagues" means nothing without one. */
  function drawScale(g, w, h, v) {
    const want = 90;
    let lg = 1;
    while (lg * v.scale < want) lg *= 2;
    while (lg * v.scale > want * 2) lg /= 2;
    const px = lg * v.scale;
    const x = 16, y = h - 18;
    g.save();
    g.strokeStyle = 'rgba(180,210,235,0.40)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y - 4); g.lineTo(x, y); g.lineTo(x + px, y); g.lineTo(x + px, y - 4);
    g.moveTo(x + px / 2, y); g.lineTo(x + px / 2, y - 2.5);
    g.stroke();
    g.font = '9px ui-monospace, Menlo, monospace';
    g.fillStyle = 'rgba(180,210,235,0.55)';
    g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText(lg + (lg === 1 ? ' league' : ' leagues'), x + px + 6, y + 1);
    g.restore();
  }

  /* --------------------------------------------------------------- input */

  function hit(nodes, px, py) {
    let best = null, bd = 26 * 26;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const dx = px - nd.x, dy = py - nd.y;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = nd; }
    }
    return best;
  }

  VF.mapArt = {
    layout: layout, draw: draw, hit: hit, sounding: sounding,
    fit: fit, toWorld: toWorld, toScreen: toScreen,
    coverage: coverage, surveyed: surveyed, coast: coast,
    lastView: function () { return LAST; },
    lastNodes: function () { return LAST_NODES; }
  };
})(window.VF = window.VF || {});
