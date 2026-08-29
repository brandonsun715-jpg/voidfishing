/* VOID FISHING — a catch, as a picture you can keep.

   Every creature here is drawn procedurally at any size, and the catch card
   already composes the species, its tier, its weight and its traits. So the
   picture exists; it just had no way out of the tab. For a game with no
   marketing surface, the screenshot is the marketing surface — and this is
   the one screen worth taking one of.

   Drawn from scratch rather than scraped off the DOM: the card on screen is
   HTML with a canvas in it, and rasterising that would need a foreignObject
   round-trip that Safari renders differently and that taints the canvas the
   moment a font is involved. Composing it here is fewer moving parts and
   gives a 2x image that holds up when it is posted somewhere. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const W = 720, S = 2;                    // logical width, and the scale drawn at
  const TOP = 648;                         // the numbers end here; traits start below
  const FOOT = 96;                         // the rule, the place and the mark

  function line(g, x1, y1, x2, y2, col, w) {
    g.strokeStyle = col; g.lineWidth = w || 1;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  /* Small caps, letterspaced, the way the interface does it. Canvas has no
     letter-spacing, so it is drawn a glyph at a time. */
  function spaced(g, text, x, y, px) {
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      g.fillText(text[i], cx, y);
      cx += g.measureText(text[i]).width + px;
    }
    return cx - x - px;
  }
  function spacedWidth(g, text, px) {
    let w = 0;
    for (let i = 0; i < text.length; i++) w += g.measureText(text[i]).width + px;
    return w - px;
  }

  function draw(c) {
    const r = VF.rarities.get(c.rarity);
    const glow = U.hexToRgb(r.glow);
    const loc = VF.locations.get(c.location) || VF.locations.current();
    const traits = (c.traits || []).map(function (t) { return VF.traits.get(t); }).filter(Boolean);

    /* The card is as tall as what is on it. A catch with no traits was
       leaving a hand's width of empty above the footer, which reads as a
       layout that did not finish rather than as space. */
    const traitRows = traits.length ? Math.ceil(traits.length / 4) : 0;
    const H = TOP + (traitRows ? 24 + traitRows * 38 : 0) + FOOT;

    const cv = document.createElement('canvas');
    cv.width = W * S; cv.height = H * S;
    const g = cv.getContext('2d');
    g.scale(S, S);

    /* --- the ground --- */
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#070b12');
    sky.addColorStop(0.55, '#04060a');
    sky.addColorStop(1, '#020407');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);

    // the tier's light, behind the creature
    const halo = g.createRadialGradient(W / 2, 330, 10, W / 2, 330, 340);
    halo.addColorStop(0, U.rgbToCss(glow, 0.20));
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 90, W, 500);

    /* --- the banner --- */
    g.fillStyle = r.color;
    g.fillRect(0, 0, W, 6);

    /* --- the tier --- */
    g.font = '600 13px ui-monospace, "SF Mono", Menlo, monospace';
    g.fillStyle = r.color;
    g.textBaseline = 'alphabetic';
    const tierText = r.name.toUpperCase();
    spaced(g, tierText, 48, 64, 4);

    /* --- the name --- */
    g.font = '300 44px ui-sans-serif, -apple-system, "Segoe UI", Roboto, sans-serif';
    g.fillStyle = '#e9eff6';
    let name = c.fish ? c.fish.name : (c.treasure ? c.treasure.name : '—');
    while (g.measureText(name).width > W - 96 && name.length > 6) {
      g.font = (parseInt(g.font, 10) - 2) + 'px ui-sans-serif, -apple-system, sans-serif';
      if (parseInt(g.font, 10) < 22) break;
    }
    g.fillText(name, 48, 116);

    line(g, 48, 140, W - 48, 140, 'rgba(255,255,255,0.10)', 1);

    /* --- the creature --- */
    g.save();
    g.translate(W / 2, 330);
    try {
      if (c.kind === 'treasure' && VF.treasureArt) {
        VF.treasureArt.draw(g, c.treasure, 300);
      } else if (c.fish) {
        const size = VF.fishArt.fitSize(c.fish, 420);
        VF.fishArt.draw(g, c.fish, size, { time: 0.4, traits: c.traits || [] });
      }
    } catch (e) { /* a picture that will not draw is not worth losing the card over */ }
    g.restore();

    /* --- the numbers --- */
    const rows = [];
    if (c.kg !== undefined) rows.push(['weight', U.weight(c.kg)]);
    if (c.m !== undefined) rows.push(['length', U.length ? U.length(c.m) : c.m.toFixed(2) + ' m']);
    if (c.value !== undefined) rows.push(['worth', '◇ ' + U.money(c.value)]);

    let y = 560;
    line(g, 48, y - 34, W - 48, y - 34, 'rgba(255,255,255,0.10)', 1);
    const colW = (W - 96) / Math.max(1, rows.length);
    rows.forEach(function (row, i) {
      const x = 48 + i * colW;
      g.font = '500 11px ui-monospace, "SF Mono", Menlo, monospace';
      g.fillStyle = 'rgba(233,239,246,0.38)';
      spaced(g, row[0], x, y, 2.4);
      g.font = '400 30px ui-sans-serif, -apple-system, sans-serif';
      g.fillStyle = '#e9eff6';
      g.fillText(row[1], x, y + 40);
    });

    /* --- the traits --- */
    y = TOP + 40;
    if (traits.length) {
      let x = 48;
      traits.forEach(function (t) {
        g.font = '500 12px ui-monospace, "SF Mono", Menlo, monospace';
        const w = spacedWidth(g, t.name.toLowerCase(), 2.2) + 26;
        const col = U.hexToRgb(t.color);
        g.fillStyle = U.rgbToCss(col, 0.12);
        g.strokeStyle = U.rgbToCss(col, 0.55);
        g.lineWidth = 1;
        if (g.roundRect) { g.beginPath(); g.roundRect(x, y - 18, w, 28, 4); g.fill(); g.stroke(); }
        else { g.fillRect(x, y - 18, w, 28); g.strokeRect(x, y - 18, w, 28); }
        g.fillStyle = t.color;
        spaced(g, t.name.toLowerCase(), x + 13, y + 1, 2.2);
        x += w + 10;
        if (x > W - 150) { x = 48; y += 38; }
      });
    }

    /* --- where and when, which is most of the atmosphere --- */
    line(g, 48, H - 96, W - 48, H - 96, 'rgba(255,255,255,0.10)', 1);
    g.font = '500 12px ui-monospace, "SF Mono", Menlo, monospace';
    g.fillStyle = 'rgba(233,239,246,0.44)';
    const wx = VF.weatherData.get(c.weather);
    const bits = [loc ? loc.name.toLowerCase() : '', c.time || '',
                  wx ? wx.name.toLowerCase() : ''].filter(Boolean);
    spaced(g, bits.join('  ·  '), 48, H - 62, 1.6);

    g.fillStyle = 'rgba(233,239,246,0.22)';
    const mark = 'void fishing';
    const mw = spacedWidth(g, mark, 3);
    spaced(g, mark, W - 48 - mw, H - 62, 3);

    return cv;
  }

  /* The viewer's sandbox blocks a download the page starts itself in some
     hosts, so this opens the image rather than only offering a link: a picture
     on screen can always be saved by hand, a blocked download cannot. */
  function save(c) {
    let cv;
    try { cv = draw(c); } catch (e) { return false; }
    if (!cv) return false;
    const name = 'void-fishing-' +
      String((c.fish ? c.fish.name : 'catch')).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png';
    try {
      cv.toBlob(function (blob) {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 4000);
      }, 'image/png');
      return true;
    } catch (e) {
      try { window.open(cv.toDataURL('image/png'), '_blank'); return true; }
      catch (e2) { return false; }
    }
  }

  VF.catchCard = { draw: draw, save: save, W: W };
})(window.VF = window.VF || {});
