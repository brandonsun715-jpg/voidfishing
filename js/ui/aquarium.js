/* VOID FISHING — the aquarium screen.

   Not a panel. Panels are a rectangle over the top of the water with rows in
   them, and they are the right shape for a shop and the wrong shape for a
   place. This takes the whole screen, the water goes away behind it, and what
   you are looking at is a room drawn in perspective that you click things
   inside — a tank, the desk, the cabinet, the plinth. The rows are still there
   because rows are how you actually move a fish from A to B, but they arrive
   in a drawer underneath whatever you just walked up to, rather than being the
   thing itself.

   The room is js/render/aquariumArt.js. The rules are js/systems/aquarium.js.
   This file is the door, the drawer, and the plate under the glass. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const A = VF.aquariumData;

  let root = null, canvas = null, ctx = null, drawer = null, hintEl = null, bankEl = null;
  let open = false, raf = 0, t = 0, last = 0;
  let W = 0, H = 0, DPR = 1;
  /* How much of the canvas the rail is covering. The room is laid out into
     what is left, so nothing it puts on the floor ends up underneath the
     drawer — which was the one thing wrong with the first version of it. */
  let roomW = 0, roomH = 0;
  let L = null;                       // last layout, for hit-testing
  let hot = null;                     // what the pointer is over
  let view = { kind: 'tank', index: 0 };

  /* ------------------------------------------------------------------ door */

  function isOpen() { return open; }

  function show() {
    if (open) return;
    if (VF.catchUI.isOpen()) return;
    VF.aquarium.settle();
    build();
    open = true;
    VF.state.rt.panelOpen = 'aquarium';
    VF.audio.click();
    document.body.classList.add('in-room');
    root.classList.remove('hidden');
    // the arrival: the room comes toward you rather than fading up in place
    root.classList.add('arriving');
    setTimeout(function () { if (root) root.classList.remove('arriving'); }, 620);
    resize();
    last = performance.now();
    loop();
    VF.hud.pressEnd();
    refresh();
  }

  function close() {
    if (!open) {
      if (VF.state.rt.panelOpen === 'aquarium') VF.state.rt.panelOpen = null;
      return;
    }
    open = false;
    VF.state.rt.panelOpen = null;
    VF.audio.back();
    cancelAnimationFrame(raf); raf = 0;
    document.body.classList.remove('in-room');
    root.classList.add('leaving');
    const myRoot = root;
    setTimeout(function () {
      if (!myRoot) return;
      myRoot.classList.add('hidden');
      myRoot.classList.remove('leaving');
    }, 240);
    VF.save.save();
  }

  /* ----------------------------------------------------------------- build */

  function build() {
    if (root) return;
    root = U.el('div', 'hidden');
    root.id = 'aquariumScreen';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'The aquarium');

    canvas = document.createElement('canvas');
    canvas.className = 'aq-room';
    root.appendChild(canvas);
    ctx = canvas.getContext('2d');

    const top = U.el('div', 'aq-top');
    const title = U.el('div', 'aq-title');
    title.appendChild(U.el('span', 'aq-title-main', 'the aquarium'));
    title.appendChild(U.el('span', 'aq-title-sub', 'specimens, and what they are telling us'));
    top.appendChild(title);

    const right = U.el('div', 'aq-top-right');
    bankEl = U.el('button', 'aq-bank');
    bankEl.addEventListener('click', function (e) {
      e.stopPropagation();
      const n = VF.aquarium.collect();
      if (n > 0) VF.toast.plain('Collected ' + U.money(n) + ' from the tanks', 'good', 2600);
      refresh();
    });
    right.appendChild(bankEl);

    const x = U.el('button', 'aq-close', '×');
    x.setAttribute('aria-label', 'Leave the aquarium');
    x.addEventListener('click', function (e) { e.stopPropagation(); close(); });
    right.appendChild(x);
    top.appendChild(right);
    root.appendChild(top);

    hintEl = U.el('div', 'aq-hint');
    root.appendChild(hintEl);

    drawer = U.el('div', 'aq-drawer');
    root.appendChild(drawer);

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', function () { hot = null; canvas.style.cursor = ''; });
    canvas.addEventListener('pointerdown', onDown);

    document.getElementById('app').appendChild(root);
    window.addEventListener('resize', function () { if (open) resize(); });
  }

  function resize() {
    if (!canvas) return;
    const r = root.getBoundingClientRect();
    W = Math.max(360, r.width);
    H = Math.max(320, r.height);
    DPR = Math.min(window.devicePixelRatio || 1,
                   VF.state.data.settings.quality === 'low' ? 1 : 2);
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    /* The rail is a fraction of the width, capped, and it is zero once the
       screen is too narrow for it — at which point the stylesheet has already
       turned it back into a drawer along the bottom and the room uses the
       whole width again. */
    const rail = W >= 900 ? Math.round(Math.min(400, W * 0.30)) : 0;
    root.style.setProperty('--rail', rail + 'px');
    roomW = Math.max(360, W - rail);
    /* Below the rail's width the drawer goes back along the bottom, and the
       room gets the height above it rather than the whole screen — otherwise
       the desk and the plinth, which stand on the floor, stand behind it. The
       stylesheet uses the same `min(46vh, 320px)`; the two have to agree. */
    roomH = rail ? H : Math.max(250, H - Math.min(H * 0.46, 320));
  }

  /* ------------------------------------------------------------------ loop */

  function loop() {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0) || dt > 0.25) dt = 0.016;
    t += dt;
    try {
      L = VF.aquariumArt.draw(ctx, roomW || W, roomH || H, t, {
        hot: hot && hot.kind, hotIndex: hot && hot.index,
        tank: view.kind === 'tank' ? view.index : -1,
        specimen: view.kind === 'tank' ? view.specimen : -1,
        showpiece: currentShowpiece()
      });
    } catch (e) {
      console.error('[aquarium]', e);
      cancelAnimationFrame(raf); raf = 0;
    }
    // the bank ticks up while you stand here, because it is
    if (bankEl && Math.floor(t * 2) % 2 === 0) paintBank();
  }

  function currentShowpiece() {
    const a = VF.aquarium.state();
    if (!a.showpiece) return null;
    const t2 = a.tanks[a.showpiece.tank];
    if (!t2) return null;
    return t2.fish[a.showpiece.i] || null;
  }

  /* ------------------------------------------------------------- the mouse */

  function onMove(e) {
    if (!L) return;
    const r = canvas.getBoundingClientRect();
    hot = VF.aquariumArt.pick(L, e.clientX - r.left, e.clientY - r.top);
    canvas.style.cursor = hot && hot.kind !== 'window' ? 'pointer' : '';
  }

  function onDown(e) {
    if (!L) return;
    const r = canvas.getBoundingClientRect();
    const p = VF.aquariumArt.pick(L, e.clientX - r.left, e.clientY - r.top);
    if (!p) return;
    VF.audio.click();
    if (p.kind === 'tank') view = { kind: 'tank', index: p.index, specimen: -1 };
    else if (p.kind === 'window') return;
    else view = { kind: p.kind };
    refresh();
  }

  /* ---------------------------------------------------------------- drawer */

  function paintBank() {
    const n = VF.aquarium.bank();
    const rate = VF.aquarium.rate();
    bankEl.innerHTML = '';
    bankEl.appendChild(U.el('span', 'aq-bank-k', 'tanks'));
    bankEl.appendChild(U.el('span', 'aq-bank-v', U.money(Math.floor(n))));
    bankEl.appendChild(U.el('span', 'aq-bank-rate',
      rate > 0 ? '+' + U.money(rate * 60) + ' / min' : 'nothing housed'));
    bankEl.disabled = Math.floor(n) < 1;
  }

  function refresh() {
    if (!open) return;
    paintBank();
    U.clear(drawer);
    if (view.kind === 'tank') drawerTank(view.index);
    else if (view.kind === 'desk') drawerDesk();
    else if (view.kind === 'cabinet') drawerCabinet();
    else if (view.kind === 'pedestal') drawerPedestal();
    paintHint();
  }

  function paintHint() {
    const h = VF.aquarium.nextHint();
    U.clear(hintEl);
    if (!h) { hintEl.classList.add('empty'); return; }
    hintEl.classList.remove('empty');
    const fa = VF.fish.byId(h.rec.a), fb = VF.fish.byId(h.rec.b);
    if (h.ready && !h.together) {
      hintEl.appendChild(U.el('span', 'aq-hint-k', 'the desk suggests'));
      hintEl.appendChild(U.el('span', 'aq-hint-v',
        'try ' + (fa ? fa.name : h.rec.a) + ' and ' + (fb ? fb.name : h.rec.b) + ' in the same tank'));
    } else {
      hintEl.appendChild(U.el('span', 'aq-hint-k', 'under study'));
      hintEl.appendChild(U.el('span', 'aq-hint-v', h.rec.hint));
    }
  }

  function head(text, sub) {
    const h = U.el('div', 'aq-head');
    h.appendChild(U.el('div', 'aq-head-t', text));
    if (sub) h.appendChild(U.el('div', 'aq-head-s', sub));
    return h;
  }

  function btn(label, cls, fn, disabled) {
    const b = U.el('button', 'aq-btn' + (cls ? ' ' + cls : ''), label);
    if (disabled) b.disabled = true;
    else b.addEventListener('click', function (e) { e.stopPropagation(); VF.audio.click(); fn(); });
    return b;
  }

  /* ------------------------------------------------------------ tank drawer */

  function drawerTank(i) {
    const tanks = VF.aquarium.tanks();
    const tk = tanks[i];
    if (!tk) { view = { kind: 'tank', index: 0 }; return drawerTank(0); }

    drawer.appendChild(head('tank ' + (i + 1),
      tk.fish.length + ' of ' + tk.slots + ' housed'));

    const row = U.el('div', 'aq-row');

    /* Nothing housed and nothing to house: say what the room is for rather
       than showing five empty boxes and a greyed-out button. */
    if (!tk.fish.length && !VF.state.data.kept.length) {
      drawer.appendChild(U.el('div', 'aq-empty',
        'The tanks are empty and so is the bag.'));
      drawer.appendChild(U.el('div', 'aq-note',
        'Land something and choose KEEP rather than sell or release. Kept catches ' +
        'can be housed here, where they pay a little toward their own glass and ' +
        'slowly get studied \u2014 and two things studied to the end, in the same ' +
        'tank, sometimes turn up a third.'));
      const back = U.el('div', 'aq-acts');
      back.appendChild(btn('go and catch something', 'primary', function () { close(); }));
      drawer.appendChild(back);
      return;
    }

    /* the specimens */
    const grid = U.el('div', 'aq-grid');
    tk.fish.forEach(function (k, idx) {
      grid.appendChild(specimenChip(k, i, idx));
    });
    for (let e = tk.fish.length; e < tk.slots; e++) {
      const empty = U.el('div', 'aq-chip empty', 'empty');
      grid.appendChild(empty);
    }
    row.appendChild(grid);
    drawer.appendChild(row);

    /* whatever is selected, in full */
    if (view.specimen >= 0 && tk.fish[view.specimen]) {
      drawer.appendChild(plate(tk.fish[view.specimen], i, view.specimen));
    }

    /* the controls */
    const acts = U.el('div', 'aq-acts');
    const bag = VF.state.data.kept.length;
    acts.appendChild(btn('house a catch · ' + bag + ' in the bag', 'primary',
                         function () { housePicker(i); }, !bag || !VF.aquarium.space(i)));

    const up = VF.aquarium.slotUpgrade(i);
    if (up) {
      acts.appendChild(btn('widen to ' + up.to + ' · ' + U.money(up.cost), '',
                           function () {
                             if (VF.aquarium.upgradeTank(i)) {
                               VF.toast.plain('Tank widened to ' + up.to + ' specimens', 'good', 2400);
                             } else VF.toast.plain('Not enough Jias', 'warn', 2000);
                             refresh();
                           }, !VF.economy.canAfford(up.cost)));
    } else {
      acts.appendChild(U.el('div', 'aq-note', 'this tank is as wide as they go'));
    }

    const nx = VF.aquarium.nextTank();
    if (nx) {
      acts.appendChild(btn(nx.locked ? 'another tank at level ' + nx.level
                                     : 'another tank · ' + (nx.cost ? U.money(nx.cost) : 'free'),
                           '', function () {
                             if (VF.aquarium.addTank()) {
                               view = { kind: 'tank', index: VF.aquarium.tankCount() - 1, specimen: -1 };
                               VF.toast.plain('The room is bigger than it was', 'good', 2600);
                             } else VF.toast.plain('Not enough Jias', 'warn', 2000);
                             refresh();
                           }, nx.locked || (nx.cost > 0 && !VF.economy.canAfford(nx.cost))));
    }
    drawer.appendChild(acts);
  }

  function specimenChip(k, tankIndex, idx) {
    const f = VF.fish.byId(k.id);
    const on = view.kind === 'tank' && view.index === tankIndex && view.specimen === idx;
    const c = U.el('button', 'aq-chip' + (on ? ' on' : ''));
    const pip = U.el('span', 'aq-pip');
    pip.style.background = VF.rarities.color(k.rarity);
    c.appendChild(pip);
    c.appendChild(U.el('span', 'aq-chip-n', f ? f.name : k.id));
    c.appendChild(U.el('span', 'aq-chip-w', U.weight(k.kg)));
    const r = VF.aquarium.research(k.id);
    const bar = U.el('span', 'aq-chip-bar');
    const fill = U.el('span');
    fill.style.transform = 'scaleX(' + r.toFixed(3) + ')';
    fill.style.background = r >= 1 ? 'var(--good)' : 'var(--accent)';
    bar.appendChild(fill);
    c.appendChild(bar);
    c.addEventListener('click', function (e) {
      e.stopPropagation();
      VF.audio.click();
      view = { kind: 'tank', index: tankIndex, specimen: on ? -1 : idx };
      refresh();
    });
    return c;
  }

  /* The plate under the glass. This is the whole reason a specimen is a
     specimen rather than a tally: it is not "Moonfish x1", it is the fish you
     caught, at the weight it was, on the evening you caught it, with the rod
     you were holding and the bait that was on the hook. Older catches were
     stored before the game recorded half of that, and they say so rather than
     inventing it. */
  function plate(k, tankIndex, idx) {
    const f = VF.fish.byId(k.id);
    const r = VF.rarities.get(k.rarity);
    const p = U.el('div', 'aq-plate');
    p.style.setProperty('--rar', r.color);

    const hd = U.el('div', 'aq-plate-head');
    hd.appendChild(U.el('div', 'aq-plate-name', (f ? f.name : k.id).toUpperCase()));
    hd.appendChild(U.el('div', 'aq-plate-kg', U.weight(k.kg)));
    p.appendChild(hd);

    const tags = U.el('div', 'aq-tags');
    const rt = U.el('span', 'aq-tag rar', r.name);
    rt.style.color = r.color;
    rt.style.borderColor = U.rgbToCss(U.hexToRgb(r.color), 0.4);
    tags.appendChild(rt);
    (k.traits || []).forEach(function (id) {
      const tr = VF.traits.get(id);
      if (!tr) return;
      const el = U.el('span', 'aq-tag', tr.name);
      el.style.color = tr.color;
      el.style.borderColor = U.rgbToCss(U.hexToRgb(tr.color), 0.4);
      tags.appendChild(el);
    });
    p.appendChild(tags);

    const facts = U.el('div', 'aq-facts');
    const unk = 'unrecorded';
    fact(facts, 'caught at', k.location ? VF.locations.get(k.location).name : unk);
    fact(facts, 'weather', k.weather ? VF.weatherData.get(k.weather).name : unk);
    fact(facts, 'time', k.time ? phaseName(k.time) : unk);
    fact(facts, 'bait', k.bait ? VF.bait.get(k.bait).name : unk);
    fact(facts, 'rod', k.rod ? VF.rods.get(k.rod).name : unk);
    fact(facts, 'date', k.at ? dateOf(k.at) : unk);
    fact(facts, 'valued at', U.money(k.value || 0));
    p.appendChild(facts);

    /* what studying it has turned up */
    const res = VF.aquarium.research(k.id);
    const rw = U.el('div', 'aq-research');
    const rl = U.el('div', 'aq-research-l');
    rl.appendChild(U.el('span', null, 'research'));
    rl.appendChild(U.el('span', 'aq-research-p', Math.floor(res * 100) + '%'));
    rw.appendChild(rl);
    const bar = U.el('div', 'aq-bar');
    const fill = U.el('div');
    fill.style.transform = 'scaleX(' + res.toFixed(3) + ')';
    bar.appendChild(fill);
    rw.appendChild(bar);
    const done = A.MILESTONES.filter(function (m) { return res >= m.at; });
    if (done.length) {
      rw.appendChild(U.el('div', 'aq-research-m',
        done[done.length - 1].label));
    }
    p.appendChild(rw);

    const acts = U.el('div', 'aq-acts tight');
    acts.appendChild(btn('put on the plinth', '', function () {
      const a = VF.aquarium.state();
      a.showpiece = { tank: tankIndex, i: idx };
      VF.save.save();
      view = { kind: 'pedestal' };
      refresh();
    }));
    if (VF.aquarium.tankCount() > 1) {
      acts.appendChild(btn('move tank', '', function () { movePicker(tankIndex, idx); }));
    }
    acts.appendChild(btn('back to the bag', '', function () {
      if (VF.aquarium.retrieve(tankIndex, idx)) {
        view.specimen = -1;
        VF.toast.plain('Back in the bag', null, 2000);
      } else VF.toast.plain('The bag is full', 'warn', 2200);
      refresh();
    }));
    const sellOk = !(VF.runs && !VF.runs.sellAllowed());
    acts.appendChild(btn('sell · ' + U.money(k.value || 0), 'danger', function () {
      const n = VF.aquarium.sellFrom(tankIndex, idx);
      if (n) VF.toast.plain('Sold for ' + U.money(n), 'good', 2400);
      view.specimen = -1;
      refresh();
    }, !sellOk));
    p.appendChild(acts);
    return p;
  }

  function fact(host, k, v) {
    const row = U.el('div', 'aq-fact');
    row.appendChild(U.el('span', 'aq-fact-k', k));
    row.appendChild(U.el('span', 'aq-fact-v', v));
    host.appendChild(row);
  }

  function phaseName(id) {
    const P = VF.time.PHASES || [];
    for (let i = 0; i < P.length; i++) if (P[i].id === id) return P[i].name;
    return id;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dateOf(ms) {
    const d = new Date(ms);
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* ------------------------------------------------------------- the pickers */

  function housePicker(tankIndex) {
    const d = VF.state.data;
    U.clear(drawer);
    drawer.appendChild(head('house a catch', 'tank ' + (tankIndex + 1) + ' has room for ' +
                            VF.aquarium.space(tankIndex)));
    const grid = U.el('div', 'aq-grid tall');
    d.kept.forEach(function (k, idx) {
      const f = VF.fish.byId(k.id);
      const c = U.el('button', 'aq-chip');
      const pip = U.el('span', 'aq-pip');
      pip.style.background = VF.rarities.color(k.rarity);
      c.appendChild(pip);
      c.appendChild(U.el('span', 'aq-chip-n', f ? f.name : k.id));
      c.appendChild(U.el('span', 'aq-chip-w', U.weight(k.kg)));
      c.addEventListener('click', function (e) {
        e.stopPropagation();
        VF.audio.click();
        if (VF.aquarium.house(idx, tankIndex)) {
          VF.toast.plain((f ? f.name : 'It') + ' is in the tank', 'good', 2400);
          view = { kind: 'tank', index: tankIndex, specimen: -1 };
        } else VF.toast.plain('No room', 'warn', 2000);
        refresh();
      });
      grid.appendChild(c);
    });
    if (!d.kept.length) grid.appendChild(U.el('div', 'aq-note', 'nothing in the bag. keep a catch first.'));
    drawer.appendChild(grid);
    const acts = U.el('div', 'aq-acts');
    acts.appendChild(btn('back', '', function () {
      view = { kind: 'tank', index: tankIndex, specimen: -1 }; refresh();
    }));
    drawer.appendChild(acts);
  }

  function movePicker(from, idx) {
    U.clear(drawer);
    drawer.appendChild(head('move it where', ''));
    const acts = U.el('div', 'aq-acts');
    VF.aquarium.tanks().forEach(function (tk, j) {
      if (j === from) return;
      acts.appendChild(btn('tank ' + (j + 1) + ' · ' + tk.fish.length + '/' + tk.slots, '',
        function () {
          if (VF.aquarium.move(from, idx, j)) {
            view = { kind: 'tank', index: j, specimen: -1 };
            VF.toast.plain('Moved to tank ' + (j + 1), null, 2000);
          } else VF.toast.plain('That tank is full', 'warn', 2000);
          refresh();
        }, !VF.aquarium.space(j)));
    });
    acts.appendChild(btn('back', '', function () {
      view = { kind: 'tank', index: from, specimen: idx }; refresh();
    }));
    drawer.appendChild(acts);
  }

  /* ------------------------------------------------------------ desk drawer */

  function drawerDesk() {
    drawer.appendChild(head('the desk', 'what the tanks have taught us so far'));

    /* the log first — a finding is the point of the whole room */
    const log = VF.aquarium.log();
    if (log.length) {
      const wrap = U.el('div', 'aq-findings');
      log.forEach(function (e) {
        const card = U.el('div', 'aq-finding');
        card.appendChild(U.el('div', 'aq-finding-t', e.title));
        card.appendChild(U.el('div', 'aq-finding-x', e.text));
        card.appendChild(U.el('div', 'aq-finding-k', e.kind + ' · ' + dateOf(e.at)));
        wrap.appendChild(card);
      });
      drawer.appendChild(wrap);
    }

    /* what is being studied */
    const counts = VF.aquarium.counts();
    const ids = Object.keys(counts).sort(function (a, b) {
      return VF.aquarium.research(b) - VF.aquarium.research(a);
    });
    if (ids.length) {
      const list = U.el('div', 'aq-studies');
      ids.forEach(function (id) {
        const f = VF.fish.byId(id);
        const res = VF.aquarium.research(id);
        const row = U.el('div', 'aq-study');
        row.appendChild(U.el('span', 'aq-study-n', (f ? f.name : id) +
                             (counts[id] > 1 ? '  ×' + counts[id] : '')));
        const bar = U.el('span', 'aq-bar');
        const fill = U.el('div');
        fill.style.transform = 'scaleX(' + res.toFixed(3) + ')';
        if (res >= 1) fill.style.background = 'var(--good)';
        bar.appendChild(fill);
        row.appendChild(bar);
        row.appendChild(U.el('span', 'aq-study-p', Math.floor(res * 100) + '%'));
        list.appendChild(row);
      });
      drawer.appendChild(list);
    } else {
      drawer.appendChild(U.el('div', 'aq-note',
        'nothing housed. a specimen in a tank studies itself, slowly.'));
    }

    /* the recipes, once at least one half of one has been finished */
    const f2 = VF.aquarium.findings();
    if (f2.length) {
      const wrap = U.el('div', 'aq-pairs');
      wrap.appendChild(U.el('div', 'aq-sub', 'lines of enquiry'));
      f2.forEach(function (p) {
        const fa = VF.fish.byId(p.rec.a), fb = VF.fish.byId(p.rec.b);
        const row = U.el('div', 'aq-pair' + (p.done ? ' done' : ''));
        row.appendChild(U.el('div', 'aq-pair-t',
          p.done ? p.rec.title : (fa ? fa.name : p.rec.a) + '  +  ' + (fb ? fb.name : p.rec.b)));
        row.appendChild(U.el('div', 'aq-pair-x',
          p.done ? 'confirmed'
                 : p.ready ? (p.together ? 'both present — watching'
                                         : 'both studied. they are not in the same tank.')
                           : p.rec.hint));
        wrap.appendChild(row);
      });
      drawer.appendChild(wrap);
    }
  }

  /* --------------------------------------------------------- cabinet drawer */

  function drawerCabinet() {
    drawer.appendChild(head('the cabinet', 'everything the room can be dressed in'));
    VF.cosmetics.aquaSlots.forEach(function (slot) {
      const items = VF.cosmetics.inSlot(slot.id).filter(function (c) {
        return VF.cosmetics.owned(c.id);
      });
      if (!items.length) return;
      const grp = U.el('div', 'aq-slot');
      grp.appendChild(U.el('div', 'aq-sub', slot.name));
      const g = U.el('div', 'aq-swatches');
      items.sort(function (a, b) {
        return VF.rarities.rank(a.rarity) - VF.rarities.rank(b.rarity);
      });
      items.forEach(function (c) {
        const on = VF.cosmetics.equippedIn(slot.id) === c;
        const b = U.el('button', 'aq-sw' + (on ? ' on' : ''));
        const sw = U.el('span', 'aq-sw-c');
        sw.style.background = swatch(c);
        sw.style.boxShadow = 'inset 0 0 0 1px ' +
          U.rgbToCss(U.hexToRgb(VF.rarities.color(c.rarity)), 0.55);
        b.appendChild(sw);
        b.appendChild(U.el('span', 'aq-sw-n', c.name));
        b.addEventListener('click', function (e) {
          e.stopPropagation();
          VF.audio.click();
          VF.cosmetics.equip(c.id);
          VF.save.save();
          refresh();
        });
        g.appendChild(b);
      });
      grp.appendChild(g);
      drawer.appendChild(grp);
    });
    const owned = VF.cosmetics.list.filter(function (c) {
      return c.aqua && VF.cosmetics.owned(c.id);
    }).length;
    const total = VF.cosmetics.list.filter(function (c) { return c.aqua && !c.secret; }).length;
    drawer.appendChild(U.el('div', 'aq-note',
      owned + ' of ' + total + ' found. the rest are in cases.'));
  }

  /* A two-colour smear that says what a thing looks like without drawing it. */
  function swatch(c) {
    const k = c.c || {};
    const a = k.a || k.c1 || k.col || '#666';
    const b = k.b || k.c2 || k.col || a;
    const A2 = typeof a === 'string' ? a : U.rgbToCss(a);
    const B2 = typeof b === 'string' ? b : U.rgbToCss(b);
    return 'linear-gradient(135deg, ' + A2 + ', ' + B2 + ')';
  }

  /* -------------------------------------------------------- pedestal drawer */

  function drawerPedestal() {
    drawer.appendChild(head('the plinth', 'one specimen, lit, in the middle of the room'));
    const cur = currentShowpiece();
    if (cur) {
      const f = VF.fish.byId(cur.id);
      drawer.appendChild(U.el('div', 'aq-note',
        'currently: ' + (f ? f.name : cur.id) + ' · ' + U.weight(cur.kg)));
    }
    const grid = U.el('div', 'aq-grid tall');
    VF.aquarium.tanks().forEach(function (tk, ti) {
      tk.fish.forEach(function (k, i) {
        const f = VF.fish.byId(k.id);
        const on = cur === k;
        const c = U.el('button', 'aq-chip' + (on ? ' on' : ''));
        const pip = U.el('span', 'aq-pip');
        pip.style.background = VF.rarities.color(k.rarity);
        c.appendChild(pip);
        c.appendChild(U.el('span', 'aq-chip-n', f ? f.name : k.id));
        c.appendChild(U.el('span', 'aq-chip-w', U.weight(k.kg)));
        c.addEventListener('click', function (e) {
          e.stopPropagation();
          VF.audio.click();
          VF.aquarium.state().showpiece = { tank: ti, i: i };
          VF.save.save();
          refresh();
        });
        grid.appendChild(c);
      });
    });
    if (!VF.aquarium.housed()) {
      grid.appendChild(U.el('div', 'aq-note', 'nothing housed to put on it yet.'));
    }
    drawer.appendChild(grid);
    if (cur) {
      const acts = U.el('div', 'aq-acts');
      acts.appendChild(btn('take it down', '', function () {
        VF.aquarium.state().showpiece = null;
        VF.save.save();
        refresh();
      }));
      drawer.appendChild(acts);
    }
  }

  /* ------------------------------------------------------------------ keys */

  function init() {
    window.addEventListener('keydown', function (e) {
      if (!open) return;
      if (e.code === 'Escape') { e.preventDefault(); close(); }
    }, true);
    VF.bus.on('aquarium:discovery', function () { if (open) refresh(); });
    VF.bus.on('aquarium:changed', function () { if (open) refresh(); });
    VF.bus.on('save:reset', function () {
      if (open) close();
      view = { kind: 'tank', index: 0 };
    });
  }

  VF.aquariumUI = { init: init, show: show, close: close, isOpen: isOpen };
})(window.VF = window.VF || {});
