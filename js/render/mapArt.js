/* VOID FISHING — the chart.
   The map was a list of rows, which is the one shape that says nothing about
   this particular set of places. Everywhere in this game is arranged by how
   far down it is: the ladder descends, the hidden water hangs off the side of
   it, and the two ends of the quest are the only things that break the
   pattern — THE HEAVENS is above the waterline, and THE LAST WATER is under
   the bottom.

   So the map is a sounding: one plumb line dropped through the whole world,
   with every place hung off it at its own depth. Locked water is a depth
   reading with nothing named against it, which is exactly how much you are
   supposed to know about it.

   This module only draws and hit-tests. Everything about what is unlocked,
   what is current and what is secret arrives in the node list from the panel,
   so nothing here reads game state. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Where the hidden water hangs off the ladder. The two ends of the quest are
     not on the ladder at all and are handled separately. */
  const BRANCH_AT = {
    lantern_isle: 1.35,
    glass_shallows: 2.40,
    sunken_arch: 3.45,
    drowned_hall: 4.55
  };
  const ABOVE = 'the_heavens';
  const BELOW = 'the_last_water';

  const PAD_TOP = 0.055;      // where the sky ends and the ladder starts
  const PAD_BOT = 0.945;
  const SPINE_X = 0.235;      // the plumb line, in canvas widths

  /* -------------------------------------------------------------- layout

     Returns a node per place, with a normalised y and a side. Ladder spots sit
     on the spine; hidden water hangs off it; the two ends of the quest sit
     outside the ladder entirely. */
  function layout(places) {
    const ladder = places.filter(function (p) { return !p.secret; });
    const n = Math.max(1, ladder.length);
    const top = 0.145, bot = 0.885;
    const step = n > 1 ? (bot - top) / (n - 1) : 0;

    const nodes = [];
    let li = 0;
    for (let i = 0; i < places.length; i++) {
      const p = places[i];
      let y, side = 0, kind = 'ladder';

      if (p.id === ABOVE) { y = 0.052; kind = 'above'; }
      else if (p.id === BELOW) { y = 0.962; kind = 'below'; }
      else if (p.secret) {
        const at = BRANCH_AT[p.id];
        // an unlisted branch still needs somewhere to go
        y = top + step * (at === undefined ? n - 1.5 : at);
        side = 1;
        kind = 'branch';
      } else {
        y = top + step * li;
        li++;
      }
      nodes.push({ p: p, y: y, side: side, kind: kind, x: 0, py: 0, r: 0 });
    }
    return nodes;
  }

  /* A plausible sounding for each rung. Not a real number — there isn't one —
     but it climbs with the ladder, which is the only thing it has to do. */
  function sounding(node, index) {
    if (node.kind === 'above') return null;
    if (node.kind === 'below') return '∞';
    const m = Math.round((30 + Math.pow(index + 1, 2.15) * 46) / 5) * 5;
    return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m + ' m';
  }

  /* ---------------------------------------------------------------- paint */

  function draw(g, w, h, nodes, opts) {
    opts = opts || {};
    const t = opts.time || 0;
    const sel = opts.selected;
    const cur = opts.current;

    g.clearRect(0, 0, w, h);

    const ladder = nodes.filter(function (nd) { return nd.kind === 'ladder'; });
    const waterY = ladder.length ? (ladder[0].y * h - 30) : h * 0.10;

    /* --- the sky above the waterline ---
       Almost nothing happens up here, which is the point: there is one place
       above the water and you have to be told it exists. */
    const sky = g.createLinearGradient(0, 0, 0, waterY);
    sky.addColorStop(0, '#0a0d18');
    sky.addColorStop(1, '#141d2c');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, waterY);

    /* --- the water ---
       Sampled off the real palette of each spot on the ladder, so the column
       darkens through the actual colours the game is about to show you. */
    const water = g.createLinearGradient(0, waterY, 0, h);
    for (let i = 0; i < ladder.length; i++) {
      const nd = ladder[i];
      const stop = U.clamp((nd.y * h - waterY) / Math.max(1, h - waterY), 0, 1);
      const col = nd.p.water ? nd.p.water[0] : '#101820';
      g.fillStyle = col;
      water.addColorStop(stop, col);
    }
    if (!ladder.length) { water.addColorStop(0, '#101820'); water.addColorStop(1, '#010206'); }
    else water.addColorStop(1, '#000104');
    g.fillStyle = water;
    g.fillRect(0, waterY, w, h - waterY);

    // the light gives out on the way down
    const dark = g.createLinearGradient(0, waterY, 0, h);
    dark.addColorStop(0, 'rgba(0,0,0,0)');
    dark.addColorStop(0.55, 'rgba(0,0,0,0.30)');
    dark.addColorStop(1, 'rgba(0,0,0,0.72)');
    g.fillStyle = dark;
    g.fillRect(0, waterY, w, h - waterY);

    /* --- the waterline --- */
    g.strokeStyle = 'rgba(180,215,240,0.42)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, Math.round(waterY) + 0.5);
    g.lineTo(w, Math.round(waterY) + 0.5);
    g.stroke();
    g.fillStyle = 'rgba(180,215,240,0.30)';
    g.font = '9px ui-monospace, Menlo, monospace';
    g.textAlign = 'right';
    g.fillText('surface', w - 10, waterY - 7);

    /* --- depth rules ---
       One per rung, faint, with the sounding in the margin. They are what make
       the column read as a measurement rather than a decoration. */
    g.textAlign = 'left';
    g.font = '9px ui-monospace, Menlo, monospace';
    let idx = 0;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      if (nd.kind !== 'ladder') continue;
      const y = Math.round(nd.y * h) + 0.5;
      g.strokeStyle = 'rgba(255,255,255,0.055)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(w * SPINE_X, y);
      g.lineTo(w - 8, y);
      g.stroke();
      const s = sounding(nd, idx);
      if (s) {
        g.fillStyle = nd.p.unlocked ? 'rgba(233,239,246,0.30)' : 'rgba(233,239,246,0.14)';
        g.fillText(s, 8, y + 3);
      }
      idx++;
    }

    /* --- the plumb line ---
       Solid as far as the deepest water you have opened, dotted past it. */
    const sx = Math.round(w * SPINE_X) + 0.5;
    let lastOpen = waterY;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      if (nd.p.unlocked && nd.kind !== 'above') lastOpen = Math.max(lastOpen, nd.y * h);
    }
    g.strokeStyle = 'rgba(190,220,245,0.30)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(sx, waterY); g.lineTo(sx, lastOpen); g.stroke();

    g.setLineDash([2, 5]);
    g.strokeStyle = 'rgba(190,220,245,0.13)';
    g.beginPath(); g.moveTo(sx, lastOpen); g.lineTo(sx, h - 6); g.stroke();
    g.setLineDash([]);

    /* --- the line up to the one place that is not underwater --- */
    const up = nodes.filter(function (nd) { return nd.kind === 'above'; })[0];
    if (up && up.p.unlocked) {
      g.setLineDash([2, 4]);
      g.strokeStyle = 'rgba(255,230,168,0.30)';
      g.beginPath(); g.moveTo(sx, waterY); g.lineTo(sx, up.y * h + 9); g.stroke();
      g.setLineDash([]);
    }

    /* --- the nodes --- */
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const p = nd.p;
      const branch = nd.kind === 'branch';
      const y = nd.y * h;
      const x = branch ? sx + w * 0.135 : sx;
      nd.x = x; nd.py = y;

      // the hairline out to a place that is not on the ladder
      if (branch) {
        g.strokeStyle = p.unlocked ? 'rgba(255,195,106,0.30)' : 'rgba(255,255,255,0.07)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(sx, y);
        g.bezierCurveTo(sx + (x - sx) * 0.55, y, sx + (x - sx) * 0.45, y, x, y);
        g.stroke();
      }

      const glow = p.unlocked ? U.hexToRgb(p.glow || '#7fa8c8') : [120, 138, 155];
      const isCur = p.id === cur;
      const isSel = p.id === sel;
      const r = branch ? 4.6 : 6.2;
      nd.r = r;

      if (!p.unlocked) {
        /* Locked water is a reading and a ring, and nothing else. */
        g.strokeStyle = 'rgba(233,239,246,0.20)';
        g.lineWidth = 1;
        g.setLineDash([1.5, 2.5]);
        g.beginPath(); g.arc(x, y, r, 0, U.TAU); g.stroke();
        g.setLineDash([]);
        continue;
      }

      // a soft halo, brighter for where you are and what you are looking at
      const pulse = isCur ? 0.5 + 0.5 * Math.sin(t * 2.0) : 0;
      const halo = r * (isSel ? 4.0 : 3.0) * (1 + pulse * 0.25);
      const rg = g.createRadialGradient(x, y, 0, x, y, halo);
      rg.addColorStop(0, U.rgbToCss(glow, (isSel ? 0.42 : 0.24) + pulse * 0.12));
      rg.addColorStop(1, U.rgbToCss(glow, 0));
      g.fillStyle = rg;
      g.beginPath(); g.arc(x, y, halo, 0, U.TAU); g.fill();

      if (branch) {
        // hidden water is a diamond, so it never reads as another rung
        g.save();
        g.translate(x, y); g.rotate(Math.PI / 4);
        g.fillStyle = U.rgbToCss(glow, 0.95);
        g.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
        g.restore();
      } else {
        g.fillStyle = U.rgbToCss(glow, 0.95);
        g.beginPath(); g.arc(x, y, r * 0.62, 0, U.TAU); g.fill();
      }

      // the ring: doubled where you are standing
      g.strokeStyle = U.rgbToCss(glow, isSel ? 0.95 : 0.55);
      g.lineWidth = isSel ? 1.6 : 1;
      g.beginPath(); g.arc(x, y, r, 0, U.TAU); g.stroke();
      if (isCur) {
        g.strokeStyle = U.rgbToCss(glow, 0.30 + pulse * 0.42);
        g.lineWidth = 1;
        g.beginPath(); g.arc(x, y, r + 3.5 + pulse * 2.6, 0, U.TAU); g.stroke();
      }
    }

    /* --- names ---
       Drawn last so a halo never sits on top of a label. */
    g.textAlign = 'left';
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      const p = nd.p;
      const isSel = p.id === sel;
      const isCur = p.id === cur;
      const lx = nd.x + nd.r + 9;

      if (!p.unlocked) {
        g.fillStyle = 'rgba(233,239,246,0.22)';
        g.font = '10px ui-sans-serif, system-ui, sans-serif';
        g.fillText('level ' + p.level, lx, nd.py + 3.5);
        continue;
      }
      g.font = (isSel || isCur ? '600 ' : '') + '11px ui-sans-serif, system-ui, sans-serif';
      g.fillStyle = isSel ? '#eef4fa' : isCur ? 'rgba(233,239,246,0.88)' : 'rgba(233,239,246,0.58)';
      g.fillText(p.name.toLowerCase(), lx, nd.py + 3.5);

      if (isCur) {
        const wname = g.measureText(p.name.toLowerCase()).width;
        g.font = '8.5px ui-monospace, Menlo, monospace';
        g.fillStyle = U.rgbToCss(U.hexToRgb(p.glow || '#7fa8c8'), 0.8);
        g.fillText('here', lx + wname + 8, nd.py + 3);
      }
    }
  }

  /* Nearest node to a point, within a forgiving radius — the diamonds are
     small and a chart you have to aim at is not a chart. */
  function hit(nodes, x, y, w, h) {
    let best = null, bestD = 26 * 26;
    for (let i = 0; i < nodes.length; i++) {
      const nd = nodes[i];
      if (!nd.p.unlocked) continue;
      const dx = x - nd.x, dy = y - nd.py;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = nd; }
    }
    return best;
  }

  VF.mapArt = { layout: layout, draw: draw, hit: hit, sounding: sounding };
})(window.VF = window.VF || {});
