/* VOID FISHING — the boatyard.

   Built by js/ui/panels.js the way the admin console is: the panel scaffold
   is handed in, so this is a different set of rows inside the same furniture
   rather than a second panel system with its own idea of what a panel is.

   Four tabs, and the first one is the boat itself at four times the size it
   is in the fishing view — because the boat is the only thing you buy in this
   game that you then have to look at for the next six hours. */
(function (VF) {
  'use strict';

  const U = VF.util;
  let raf = 0, gen = 0;

  function stop() { gen++; if (raf) cancelAnimationFrame(raf); raf = 0; }

  function build(ui, tab) {
    stop();
    const d = VF.state.data;
    const b = VF.boat.shape();
    const h = VF.boat.hull();

    const p = ui.shell('The Boatyard',
      h.name.toLowerCase() + ' · ' + Math.round(VF.boat.integrity() * 100) + '% sound');
    p.appendChild(ui.tabs([
      { id: 'boat', label: 'boat' },
      { id: 'fit', label: 'fitting' },
      { id: 'paint', label: 'paint' },
      { id: 'deck', label: 'deck' }
    ], tab, function (id) { ui.refresh(id); }));

    const body = ui.body();
    if (tab === 'fit') fitting(body, ui);
    else if (tab === 'paint') paint(body, ui);
    else if (tab === 'deck') deck(body, ui);
    else boat(body, ui);
    p.appendChild(body);
    return p;
  }

  /* ------------------------------------------------------------ the boat */

  function boat(body, ui) {
    const d = VF.state.data;
    const b = VF.boat.shape();
    const h = VF.boat.hull();

    // a live portrait, rolling on its own swell
    const hero = U.el('div', 'boat-hero');
    const cv = U.el('canvas');
    hero.appendChild(cv);
    body.appendChild(hero);
    paintHero(cv, hero);

    const head = U.el('div', 'boat-tier');
    head.appendChild(U.el('span', 'n', h.name));
    head.appendChild(U.el('span', 't', h.tag));
    body.appendChild(head);
    body.appendChild(U.el('p', 'catch-desc', h.desc));

    // condition, and putting it right
    const cond = U.el('div', 'spot-meta');
    [['sound', Math.round(VF.boat.integrity() * 100) + '%'],
     ['speed', '×' + VF.boat.speed().toFixed(2)],
     ['hold', '+' + VF.boat.keepBonus() + ' kept'],
     ['sonar', VF.boat.has('sonar') ? 'level ' + VF.boat.level('sonar') : 'none']
    ].forEach(function (kv) {
      const c = U.el('div', 'spot-stat');
      c.appendChild(U.el('span', 'k', kv[0]));
      c.appendChild(U.el('span', 'v', kv[1]));
      cond.appendChild(c);
    });
    body.appendChild(cond);

    if (VF.boat.integrity() < 0.999) {
      const cost = VF.boat.repairCost();
      const btn = U.el('button', 'btn', cost ? 'put her right — ◈ ' + U.money(cost) : 'put her right');
      btn.disabled = cost > d.money;
      btn.addEventListener('click', function () {
        if (VF.boat.repair()) { VF.toast.plain('she is sound again.', 'good', 2600); ui.refresh(); }
      });
      body.appendChild(btn);
    }

    body.appendChild(U.el('div', 'panel-sep'));
    body.appendChild(U.el('div', 'panel-note', 'hulls'));

    VF.boatData.hulls.forEach(function (x) {
      body.appendChild(hullRow(x, ui));
    });
  }

  function hullRow(x, ui) {
    const d = VF.state.data;
    const b = VF.boat.shape();
    const owned = VF.boat.ownHull(x.id);
    const here = b.hull === x.id;
    const row = U.el('div', 'exp' + (here ? ' running' : ''));

    const head = U.el('div', 'exp-head');
    head.appendChild(U.el('span', 'exp-name', x.name));
    head.appendChild(U.el('span', 'exp-stage',
      here ? 'under you' : owned ? 'in the yard' : x.level ? 'level ' + x.level : ''));
    row.appendChild(head);
    row.appendChild(U.el('div', 'exp-obj', x.tag));

    /* What it opens and what it closes. A hull that reads as a speed bonus is
       a hull nobody has a reason to want — and one that reads as strictly
       better than the last one is a ladder, which is the thing this table
       stopped being. Both ratings are on every row, because the interesting
       fact about the biggest boat in the game is the water it cannot enter. */
    const f = U.el('div', 'exp-found');
    const WORDS = { crossings: 'crossings become gameplay', expeditions: 'expeditions' };
    x.unlocks.forEach(function (u) {
      f.appendChild(U.el('span', 'exp-chip', WORDS[u] || u));
    });
    f.appendChild(U.el('span', 'exp-chip', 'draws ' + (x.draught || 0).toFixed(2) + ' m'));
    f.appendChild(U.el('span', 'exp-chip',
      x.pressure >= 99999 ? 'rated for anything' : 'down to ' + x.pressure + ' m'));
    f.appendChild(U.el('span', 'exp-chip', (x.berth || 0) + ' berth'));
    row.appendChild(f);

    /* And, once you own her, the water she would open and the water she would
       shut — the actual question the yard is here to answer. */
    if (owned && !here && VF.locations) {
      const now = [], then = [];
      VF.locations.list.forEach(function (loc) {
        if (!VF.locations.isUnlocked(loc.id)) return;
        const fits = (x.draught || 0) <= VF.locations.shoal(loc.id) &&
                     (x.pressure || 0) >= VF.locations.sounding(loc.id);
        (fits ? then : now).push({ id: loc.id, name: loc.name.toLowerCase() });
      });
      const gain = then.filter(function (l) { return !!VF.boat.whyNot(l.id); });
      const lose = now.filter(function (l) { return !VF.boat.whyNot(l.id); });
      if (gain.length) row.appendChild(U.el('div', 'exp-obj good',
        'she would open ' + list(gain.map(function (l) { return l.name; })) + '.'));
      if (lose.length) row.appendChild(U.el('div', 'exp-obj warn',
        'and shut ' + list(lose.map(function (l) { return l.name; })) + '.'));
    }

    if (!owned) {
      const btn = U.el('button', 'mod-buy', '◈ ' + U.money(x.cost));
      btn.disabled = x.cost > d.money || (x.level || 0) > d.level;
      btn.title = (x.level || 0) > d.level ? 'level ' + x.level + ' first' : '';
      btn.addEventListener('click', function () {
        if (VF.boat.buyHull(x.id)) ui.refresh();
      });
      row.appendChild(btn);
    } else if (!here) {
      const btn = U.el('button', 'mod-buy', 'take her out');
      btn.addEventListener('click', function () { VF.boat.setHull(x.id); ui.refresh(); });
      row.appendChild(btn);
    }
    return row;
  }

  /* ------------------------------------------------------------- fitting */

  function fitting(body, ui) {
    const d = VF.state.data;
    const h = VF.boat.hull();
    body.appendChild(U.el('p', 'fit-say',
      'five slots, and she will not carry all of them. what is aboard is most of ' +
      'what you can do out there — and how much water she needs under her.'));

    /* --- the budget, and what it costs her --------------------------------

       Both numbers up top and both of them live, because the whole design is
       that fitting her out is a decision with a price, and a price you only
       meet at the chart when you are refused is a bug report. */
    const spent = VF.boat.spent(), berth = VF.boat.berth();
    const bar = U.el('div', 'berth');
    const fill = U.el('div', 'berth-fill');
    fill.style.width = Math.round(spent / Math.max(1, berth) * 100) + '%';
    bar.appendChild(fill);
    for (let i = 1; i < berth; i++) {
      const tick = U.el('div', 'berth-tick');
      tick.style.left = (i / berth * 100) + '%';
      bar.appendChild(tick);
    }
    const berthRow = U.el('div', 'berth-row');
    berthRow.appendChild(U.el('div', 'berth-k', 'berth'));
    berthRow.appendChild(bar);
    berthRow.appendChild(U.el('div', 'berth-v', spent + ' / ' + berth));
    body.appendChild(berthRow);

    const meta = U.el('div', 'spot-meta');
    [['draught', VF.boat.draught().toFixed(2) + ' m'],
     ['bare', (h.draught || 0).toFixed(2) + ' m'],
     ['rated to', h.pressure >= 99999 ? 'anything' : h.pressure + ' m']
    ].forEach(function (kv) {
      const c = U.el('div', 'spot-stat');
      c.appendChild(U.el('span', 'k', kv[0]));
      c.appendChild(U.el('span', 'v', kv[1]));
      meta.appendChild(c);
    });
    body.appendChild(meta);

    /* --- and the water it costs her --------------------------------------

       Every place she can no longer get into as she is fitted right now, and
       every place nothing on this hull will ever reach. Not a warning: a list
       of names, so the tradeoff is a thing you read rather than a thing you
       discover. */
    const shut = [], deep = [];
    VF.locations.list.forEach(function (loc) {
      if (!VF.locations.isUnlocked(loc.id)) return;
      const no = VF.boat.whyNot(loc.id);
      if (!no) return;
      (no.kind === 'shoal' ? shut : deep).push(loc.name.toLowerCase());
    });
    if (shut.length) {
      body.appendChild(U.el('p', 'fit-say warn',
        'as she sits she will not get into ' + list(shut) +
        '. take something off and she will.'));
    }
    if (deep.length) {
      body.appendChild(U.el('p', 'fit-say',
        'and she is not rated deep enough for ' + list(deep) + '. that is the hull, not the load.'));
    }

    const tools = U.el('div', 'berth-tools');
    const off = U.el('button', 'btn btn-sm', 'strip her');
    off.disabled = !spent;
    off.addEventListener('click', function () { VF.boat.strip(); ui.refresh('fit'); });
    const on = U.el('button', 'btn btn-sm', 'load her up');
    on.addEventListener('click', function () { VF.boat.refit(); ui.refresh('fit'); });
    tools.appendChild(off); tools.appendChild(on);
    body.appendChild(tools);

    const grid = U.el('div', 'mod-grid');
    VF.boatData.modules.forEach(function (m) {
      const cap = VF.boat.slotCap(m.id);
      const have = VF.boat.level(m.id);
      const own = VF.boat.owned(m.id);
      const card = U.el('div', 'mod' + (have ? ' on' : '') + (cap ? '' : ' locked'));

      const head = U.el('div', 'mod-head');
      head.appendChild(U.el('span', 'mod-name', m.name));
      head.appendChild(U.el('span', 'mod-lv', cap ? have + ' / ' + cap : 'no slot'));
      card.appendChild(head);
      card.appendChild(U.el('div', 'mod-desc', m.desc));

      const segs = U.el('div', 'mod-bar');
      for (let i = 0; i < Math.max(1, cap); i++) {
        /* three states, because owning it and carrying it are different: on,
           owned but ashore, and not bought. */
        segs.appendChild(U.el('div', 'mod-seg' +
          (i < have ? ' on' : i < own ? ' owned' : '')));
      }
      card.appendChild(segs);
      card.appendChild(U.el('div', 'mod-desc', m.line(have)));
      card.appendChild(U.el('div', 'mod-desc dim',
        (m.berth || 1) + ' berth a level' + (own > have ? ' · ' + (own - have) + ' ashore' : '')));

      if (cap) {
        const row = U.el('div', 'mod-row');
        /* aboard / ashore, when you own more than she is carrying */
        if (have < Math.min(own, cap)) {
          const up = U.el('button', 'mod-buy',
            VF.boat.berthLeft() >= (m.berth || 1) ? 'put it aboard' : 'no berth for it');
          up.disabled = VF.boat.berthLeft() < (m.berth || 1);
          up.addEventListener('click', function () { VF.boat.fit(m.id, have + 1); ui.refresh('fit'); });
          row.appendChild(up);
        }
        if (have > 0) {
          const dn = U.el('button', 'mod-buy ghost', 'take it off');
          dn.addEventListener('click', function () { VF.boat.fit(m.id, have - 1); ui.refresh('fit'); });
          row.appendChild(dn);
        }
        if (own < 5) {
          const cost = VF.boatData.modCost(m.id, own);
          const buy = U.el('button', 'mod-buy', 'buy — ◈ ' + U.money(cost));
          buy.disabled = cost > d.money;
          buy.addEventListener('click', function () {
            if (VF.boat.buyModule(m.id)) ui.refresh('fit');
          });
          row.appendChild(buy);
        }
        card.appendChild(row);
      } else {
        card.appendChild(U.el('div', 'mod-desc',
          own ? 'you own ' + own + ' of these. a bigger hull carries them.'
              : 'a bigger hull carries this.'));
      }
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }

  /* "a, b and c" — a list a person would say out loud. */
  function list(a) {
    if (a.length === 1) return a[0];
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  /* --------------------------------------------------------------- paint */

  function paint(body, ui) {
    const d = VF.state.data;
    const b = VF.boat.shape();
    body.appendChild(U.el('p', 'panel-note',
      'she is on screen in every frame of this game. it is worth doing.'));

    const hero = U.el('div', 'boat-hero');
    const cv = U.el('canvas');
    hero.appendChild(cv);
    body.appendChild(hero);
    paintHero(cv, hero);

    const row = U.el('div', 'paint-row');
    VF.boatData.paint.forEach(function (x) {
      if (x.need && !x.need(d) && b.paints.indexOf(x.id) < 0) return;
      const owned = b.paints.indexOf(x.id) >= 0;
      const sw = U.el('button', 'paint' + (b.paint === x.id ? ' on' : ''));
      sw.style.background = 'linear-gradient(135deg, ' + x.hull + ' 60%, ' + x.trim + ' 60%)';
      sw.title = x.name + (owned ? '' : ' — ◈ ' + U.money(x.cost));
      sw.setAttribute('aria-label', x.name);
      if (!owned) sw.style.opacity = x.cost > d.money ? '0.35' : '0.7';
      sw.addEventListener('click', function () {
        if (owned) VF.boat.setPaint(x.id);
        else if (!VF.boat.buyPaint(x.id)) { VF.audio.error(); return; }
        ui.refresh('paint');
      });
      row.appendChild(sw);
    });
    body.appendChild(row);

    const cur = VF.boat.paint();
    body.appendChild(U.el('div', 'panel-note', cur.name.toLowerCase()));
  }

  /* ---------------------------------------------------------------- deck */

  function deck(body, ui) {
    const d = VF.state.data;
    const b = VF.boat.shape();

    body.appendChild(U.el('p', 'panel-note',
      'lights, colours and the things you bolt on. all of it shows from the shore.'));

    ['light', 'flag', 'deck'].forEach(function (slot) {
      const list = VF.boatData.trim.filter(function (x) {
        return x.slot === slot && (!x.need || x.need(d) || b.trims.indexOf(x.id) >= 0);
      });
      if (!list.length) return;
      body.appendChild(U.el('div', 'panel-note',
        slot === 'light' ? 'lights' : slot === 'flag' ? 'colours' : 'on deck'));
      const row = U.el('div', 'trophy-row');
      list.forEach(function (x) {
        const owned = b.trims.indexOf(x.id) >= 0;
        const on = b.trim[slot] === x.id;
        const btn = U.el('button', 'trophy-pick' + (on ? ' on' : ''),
          x.name + (owned ? '' : ' · ◈ ' + U.money(x.cost)));
        btn.title = x.desc;
        btn.addEventListener('click', function () {
          if (owned) VF.boat.setTrim(x.id);
          else if (!VF.boat.buyTrim(x.id)) { VF.audio.error(); return; }
          ui.refresh('deck');
        });
        row.appendChild(btn);
      });
      body.appendChild(row);
    });

    /* Trophies. The one cosmetic in the game that cannot be bought — it is
       whatever you have actually landed, lashed to the foredeck. */
    body.appendChild(U.el('div', 'panel-sep'));
    body.appendChild(U.el('div', 'panel-note', 'lashed to the foredeck — up to three'));

    const caught = Object.keys(d.fishdex).map(function (id) { return VF.fish.byId(id); })
      .filter(Boolean)
      .sort(function (a, c) { return VF.rarities.rank(c.rarity) - VF.rarities.rank(a.rarity); })
      .slice(0, 24);

    if (!caught.length) {
      body.appendChild(U.el('div', 'empty', 'catch something first.'));
      return;
    }
    const row = U.el('div', 'trophy-row');
    caught.forEach(function (f) {
      const on = b.trophies.indexOf(f.id) >= 0;
      const btn = U.el('button', 'trophy-pick' + (on ? ' on' : ''), f.name);
      btn.style.borderLeft = '2px solid ' + VF.rarities.color(f.rarity);
      btn.addEventListener('click', function () {
        VF.boat.toggleTrophy(f.id);
        ui.refresh('deck');
      });
      row.appendChild(btn);
    });
    body.appendChild(row);
  }

  /* ---------------------------------------------------------- the portrait */

  function paintHero(cv, host) {
    const my = ++gen;
    const t0 = performance.now();
    (function frame() {
      if (my !== gen) return;
      raf = requestAnimationFrame(frame);
      if (!cv.isConnected) return;
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(r.width), h2 = Math.round(r.height);
      if (cv.width !== w * dpr || cv.height !== h2 * dpr) {
        cv.width = w * dpr; cv.height = h2 * dpr;
        cv.style.width = w + 'px'; cv.style.height = h2 + 'px';
      }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h2);
      const t = (performance.now() - t0) / 1000;

      // a waterline to float on, so it is a boat rather than a diagram
      const wl = h2 * 0.68;
      const wg = g.createLinearGradient(0, wl - 4, 0, h2);
      wg.addColorStop(0, 'rgba(90,140,190,0.16)');
      wg.addColorStop(1, 'rgba(10,18,28,0)');
      g.fillStyle = wg;
      g.fillRect(0, wl - 4, w, h2 - wl + 4);

      g.save();
      g.translate(w * 0.5, wl);
      g.rotate(Math.sin(t * 0.7) * 0.026);
      g.translate(0, Math.sin(t * 0.9) * h2 * 0.010);
      VF.boatArt.drawMine(g, Math.min(w * 0.74, h2 * 1.9), { time: t });
      g.restore();

      // and the line it sits on, over the top of the hull
      g.strokeStyle = 'rgba(180,215,245,0.20)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, wl + Math.sin(t * 0.9) * h2 * 0.010);
      g.lineTo(w, wl + Math.sin(t * 0.9) * h2 * 0.010);
      g.stroke();
    })();
  }

  VF.boatUI = { build: build, stop: stop };
})(window.VF = window.VF || {});
