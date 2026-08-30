/* VOID FISHING — menus. One panel host, six views, all rebuilt on open so they
   never drift out of sync with the game state. */
(function (VF) {
  'use strict';

  const U = VF.util;
  let host = null, overlay = null, current = null, node = null, curTab = null;
  let gen = 0;   // guards the deferred teardown against a newer open
  let rodCanvases = [];   // live rod previews, animated while the shop is open
  let rodRaf = 0;

  /* Rod previews animate — the flourishes on the late-tier rods are the point
     of showing them at all — so they run their own loop while visible. */
  function startRodLoop() {
    stopRodLoop();
    if (!rodCanvases.length) return;
    const t0 = performance.now();
    (function frame() {
      if (!rodCanvases.length) { rodRaf = 0; return; }
      const t = (performance.now() - t0) / 1000;
      for (let i = 0; i < rodCanvases.length; i++) {
        const e = rodCanvases[i];
        if (!e.cv.isConnected) continue;
        // a stood-up preview carries its own painter, transform and all
        if (e.paint) { e.paint(e.ctx, t + e.phase); continue; }
        const g = e.ctx;
        g.clearRect(0, 0, e.cv.width, e.cv.height);
        VF.rodArt.preview(g, e.rod, e.cv.width, e.cv.height, t + e.phase);
      }
      rodRaf = requestAnimationFrame(frame);
    })();
  }
  function stopRodLoop() {
    if (rodRaf) cancelAnimationFrame(rodRaf);
    rodRaf = 0;
    rodCanvases = [];
  }

  /* Owning a rod and being allowed to swing it are two different things — the
     one at the end of the long thread arrives well before its level. Both
     places that offer an Equip button go through here so they cannot disagree
     about it. */
  function equipButton(rod, onDone, cls) {
    if (!VF.rods.canEquip(rod)) {
      const wait = U.el('div', 'row-price', 'needs lv ' + rod.level);
      wait.style.color = 'var(--warn)';
      return wait;
    }
    const btn = U.el('button', 'btn btn-sm' + (cls || ''), 'Equip');
    btn.addEventListener('click', function () {
      VF.state.data.rod = rod.id;
      VF.audio.click(); VF.bus.emit('gear:changed'); VF.save.save();
      onDone();
    });
    return btn;
  }

  /* What tier a rod sits in, for the badge on its card. Merchant rods carry
     one; shelf rods do not, so it comes off the same grade the drawing uses. */
  /* Weighted toward the bottom on purpose. Grade is rank across all hundred
     and twenty-nine rods, and the thirty on the shelf are the bottom of that
     queue — split evenly they would all read Common, which tells the player
     nothing about which of the thirty is better than which. */
  const ROD_TIERS = [
    [0.08, 'Common',    '#9db4c6'], [0.20, 'Uncommon',  '#5fd699'],
    [0.36, 'Rare',      '#4aa8ff'], [0.56, 'Epic',      '#b06bff'],
    [0.78, 'Legendary', '#ffb03a'], [1.01, 'Mythic',    '#ff5c9e']
  ];
  function rodRarity(rod) {
    if (rod.rarity) {
      const r = VF.rarities.get(rod.rarity);
      return { name: r.name, color: r.color };
    }
    const g = VF.rodSig ? VF.rodSig.grade(rod) : 0.4;
    for (let i = 0; i < ROD_TIERS.length; i++) {
      if (g < ROD_TIERS[i][0]) return { name: ROD_TIERS[i][1], color: ROD_TIERS[i][2] };
    }
    return { name: 'Mythic', color: '#ff5c9e' };
  }

  function rcStat(host, k, v, dir) {
    const row = U.el('div', 'rc-stat');
    row.appendChild(U.el('span', 'rc-k', k));
    const val = U.el('span', 'rc-v', v);
    if (dir > 0) val.classList.add('up');
    else if (dir < 0) val.classList.add('down');
    row.appendChild(val);
    host.appendChild(row);
  }

  /* A control in a panel that keeps focus after a mouse click keeps the space
     bar with it — see the same helper in js/ui/hud.js. */
  function dropFocusIn(e) {
    if (e && e.detail > 0 && e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
  }

  function rodPreview(rod, i, dim) {
    const cv = U.el('canvas', 'rod-art');
    cv.width = 300; cv.height = 132;
    const g = cv.getContext('2d');
    if (dim) cv.style.opacity = '0.45';
    VF.rodArt.preview(g, rod, cv.width, cv.height, i * 0.9);
    rodCanvases.push({ cv: cv, ctx: g, rod: rod, phase: i * 0.9 });
    return cv;
  }

  /* The same drawing, stood up.

     A rod is a long thin object and a shop is a list of them, so drawing them
     lying down means each one gets a strip a hundred pixels tall and the thing
     that distinguishes it — its outline — is the part there is no room for.
     Stood up in a card it gets the whole height, which is the difference
     between seeing that two rods are different and being told so. */
  function rodPreviewV(rod, i, dim, w, h) {
    const cv = U.el('canvas', 'rod-art-v');
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d');
    if (dim) cv.style.opacity = '0.45';
    const paint = function (ctx, t) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, w, h);
      /* butt at the bottom, tip at the top: rotate the frame a quarter turn
         and hand the flat renderer a landscape box inside it */
      ctx.translate(w * 0.5, h * 0.5);
      ctx.rotate(-Math.PI / 2);
      ctx.translate(-h * 0.5, -w * 0.5);
      VF.rodArt.preview(ctx, rod, h, w, t);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    };
    paint(g, i * 0.9);
    rodCanvases.push({ cv: cv, ctx: g, rod: rod, phase: i * 0.9, paint: paint });
    return cv;
  }
  let dexFilter = 'all', dexMode = 'all', dexTab = 'waters', dexLoc = 'all';

  /* ---------------------------------------------------------------- focus

     A panel is a modal, and until now the keyboard did not know that: Tab from
     inside an open panel walked straight out into the HUD behind it, and
     closing one left focus wherever it happened to land. Both are fixed here
     rather than per-panel, so every view gets it — including the ones that do
     not exist yet. */

  let lastFocus = null;

  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), ' +
                    'select, textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function focusables() {
    if (!node) return [];
    return U.qsa(FOCUSABLE, node).filter(function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }

  function trapTab(e) {
    if (!current || e.code !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0], last = list[list.length - 1];
    const at = document.activeElement;
    // wrap at both ends, and catch the case where focus escaped entirely
    if (e.shiftKey && (at === first || !node.contains(at))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (at === last || !node.contains(at))) { e.preventDefault(); first.focus(); }
  }

  /* Was the thing that opened this panel reached by keyboard? Only then is it
     worth handing focus back when the panel closes. Returning focus to a button
     somebody clicked with a mouse puts a ring on it that they did not ask for
     and cannot get rid of — and leaves the space bar pointed at it. */
  function reachedByKey(el) {
    if (!el || !el.matches) return false;
    try { return el.matches(':focus-visible'); } catch (e) { return false; }
  }

  function takeFocus() {
    lastFocus = reachedByKey(document.activeElement) ? document.activeElement : null;
    setTimeout(function () {
      if (!current || !node) return;
      // the close button is a poor first stop; the first real control is better
      const list = focusables();
      const skipClose = list.filter(function (el) { return !el.classList.contains('panel-close'); });
      const target = (skipClose[0] || list[0]);
      if (target) target.focus();
    }, 30);
  }

  function returnFocus() {
    const el = lastFocus;
    lastFocus = null;
    if (el && el.isConnected && typeof el.focus === 'function') el.focus();
  }

  function init() {
    host = document.getElementById('modal');
    overlay = document.getElementById('overlay');
    overlay.addEventListener('click', function () { if (current) close(); });
    window.addEventListener('keydown', trapTab, true);
  }

  function isOpen() { return !!current; }

  function open(id, tab) {
    if (VF.catchUI.isOpen()) return;
    /* The aquarium is not a panel. It is the one thing on the menu bar that
       takes the whole screen instead of floating over the water, so the button
       routes straight past all of this — see js/ui/aquarium.js. */
    if (id === 'aquarium') {
      if (current) close();
      /* It opens whether or not there is anything to put in it. It used to
         refuse below level six with nothing kept, and all a refusal can do is
         throw a line of toast that scrolls past under whatever else is on
         screen — from the player's side that is a menu button that does
         nothing when pressed. An empty room explains itself; a dead button
         does not. */
      VF.aquariumUI.show();
      return;
    }
    if (current === id) { close(); return; }
    if (current) closeNow();
    stopRodLoop();
    stopMapLoop();
    if (VF.boatUI) VF.boatUI.stop();
    gen++;
    current = id;
    curTab = tab === undefined ? null : tab;
    VF.state.rt.panelOpen = id;
    overlay.classList.remove('hidden', 'out');
    node = build(id, tab);
    U.clear(host);
    host.appendChild(node);
    host.classList.remove('hidden');
    startRodLoop();
    U.qsa('.mbtn').forEach(function (b) { b.classList.toggle('active', b.dataset.panel === id); });
    VF.hud.pressEnd();
    takeFocus();
  }

  function close() {
    if (!current) return;
    VF.audio.back();
    if (node) node.classList.add('out');
    overlay.classList.add('out');
    const n = node;
    const myGen = ++gen;
    setTimeout(function () {
      // a panel opened during the exit animation owns the host now — leave it alone
      if (myGen !== gen) return;
      if (n && n.parentNode) n.parentNode.removeChild(n);
      if (!current) {
        host.classList.add('hidden');
        overlay.classList.add('hidden');
        overlay.classList.remove('out');
      }
    }, 200);
    closeNow();
  }

  function closeNow() {
    stopRodLoop();
    stopMapLoop();
    if (VF.boatUI) VF.boatUI.stop();
    current = null; node = null; curTab = null;
    returnFocus();
    VF.state.rt.panelOpen = null;
    U.qsa('.mbtn').forEach(function (b) { b.classList.remove('active'); });
    /* The overlay is NOT hidden here. It carries the blur behind the panel, and
       hiding it in the same frame the panel starts leaving meant the whole
       backdrop snapped back to sharp while the panel was still fading — the one
       piece of the interface that visibly stuttered on every close. The
       deferred tidy-up in close() puts it away once its own fade has run;
       open() clears it directly when one panel is replacing another. */
  }

  /* Rebuilding without naming a tab stays on the tab that is open — a row
     that grants or buys something should not throw you back to the first. */
  function refresh(tab) {
    if (!current) return;
    stopRodLoop();
    stopMapLoop();
    if (VF.boatUI) VF.boatUI.stop();
    if (tab === undefined) tab = curTab; else curTab = tab;
    const id = current, prev = node;
    /* Where the reader was. A panel is rebuilt from scratch on every change,
       and settings is long enough that acting on something near the bottom —
       loading a slot, erasing one — used to throw the page back to the top and
       leave them hunting for the row they had just pressed. */
    const wasAt = prev ? (prev.querySelector('.panel-body') || {}).scrollTop || 0 : 0;
    node = build(id, tab);
    if (prev && prev.parentNode) prev.parentNode.replaceChild(node, prev);
    if (wasAt) {
      const bodyEl = node.querySelector('.panel-body');
      if (bodyEl) bodyEl.scrollTop = wasAt;
    }
    startRodLoop();
  }

  /* ------------------------------------------------------------ scaffold */

  function shell(title, sub) {
    const p = U.el('div', 'panel');
    const head = U.el('div', 'panel-head');
    const left = U.el('div');
    left.appendChild(U.el('div', 'panel-title', title));
    if (sub) left.appendChild(U.el('div', 'panel-sub', sub));
    head.appendChild(left);
    const x = U.el('button', 'panel-close', '×');
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', close);
    head.appendChild(x);
    p.appendChild(head);
    return p;
  }

  function tabs(items, active, onPick) {
    const bar = U.el('div', 'tabs');
    items.forEach(function (it) {
      const b = U.el('button', 'tab' + (it.id === active ? ' active' : ''), it.label);
      b.addEventListener('click', function () { VF.audio.click(); onPick(it.id); });
      bar.appendChild(b);
    });
    return bar;
  }

  function body() { return U.el('div', 'panel-body scroll'); }

  function priceEl(cost, affordable) {
    const s = U.el('div', 'row-price' + (affordable ? '' : ' cant'));
    s.textContent = '◈ ' + U.money(cost);
    return s;
  }

  function statCell(k, v, dir) {
    const c = U.el('div', 'stat-cell');
    c.appendChild(U.el('span', 'k', k));
    const val = U.el('span', 'v' + (dir > 0 ? ' up' : dir < 0 ? ' down' : ''), v);
    c.appendChild(val);
    return c;
  }

  /* The panel furniture, as an object a module outside this file can build
     with. Nothing in here is stateful; `refresh` and `close` are the two live
     wires and both already exist. */
  function scaffold() {
    return { shell: shell, body: body, tabs: function (items, active, pick) {
               return tabs(items, active, pick);
             },
             statCell: statCell, priceEl: priceEl,
             refresh: refresh, close: close };
  }

  function build(id, tab) {
    switch (id) {
      case 'shop': return buildShop(tab || 'rods');
      case 'fishdex': return buildDex();
      case 'bag': return buildBag(tab || 'catches');
      case 'stats': return buildStats(tab || 'stats');
      case 'settings': return buildSettings();
      case 'map': return buildMap();
      /* Built by its own module, handed the same scaffold every other panel
         is built from — so the boatyard is a different set of rows inside the
         same furniture rather than a second panel system. */
      case 'boat': return VF.boatUI.build(scaffold(), tab || 'boat');
      case 'merchant': return buildMerchant();
      case 'cases': return buildCases();
      case 'wardrobe': return buildWardrobe(tab || 'all');
      // a running quest is what the journal is for while there is one
      case 'journal': return buildJournal(tab || (VF.quests.activeCount() ? 'quests' : 'entries'));
      /* Built by its own module. There is no button for it — three slashes
         are the only way in — so it is not in the menu bar either, and in a
         build without that module it is not a panel at all. */
/* @admin-only */
      case 'admin': return VF.adminConsole ? VF.adminConsole.build(shell, body) : shell('—');
/* @end-admin */

      default: return shell('—');
    }
  }

  /* ---------------------------------------------------------------- shop */

  /* The cheapest rod that is actually better than the one in your hand and
     that you could actually get. With a hundred and twenty-nine rods on the
     shelf, "what should I be saving for" is the question the list is worst at
     answering — the comparison arrows only compare against what you already
     hold, one row at a time, and the ladder interleaves so the next row down
     is often not the next rod up.

     Better means better at the thing rods are for: reach, line and reel, plus
     the rarity it draws. A rod that is worse at all four is not an upgrade
     however much it costs. */
  function betterThan(rod, eq) {
    let up = 0, down = 0;
    [['cast', 1], ['line', 1], ['reel', 1], ['rare', 1], ['luck', 1]].forEach(function (k) {
      if (rod[k[0]] > eq[k[0]] + 1e-9) up++;
      else if (rod[k[0]] < eq[k[0]] - 1e-9) down++;
    });
    return up >= 3 && up > down;
  }

  function nextUpgrade(eq) {
    const d = VF.state.data;
    const box = U.el('div', 'next-up');

    let best = null;
    VF.rods.list.forEach(function (rod) {
      if (d.ownedRods.indexOf(rod.id) >= 0) return;
      if (rod.admin || rod.noShop || rod.quest) return;
      if (rod.merchant) return;                    // he is not always here
      if (VF.rods.blocked(rod)) return;            // out of reach for a reason
      if (!betterThan(rod, eq)) return;
      if (!best || rod.cost < best.cost) best = rod;
    });

    if (!best) {
      box.classList.add('quiet');
      box.appendChild(U.el('div', 'next-up-k', 'nothing on the shelf beats what you are holding'));
      return box;
    }

    const short = Math.max(0, best.cost - d.money);
    box.appendChild(U.el('div', 'next-up-k', 'next upgrade'));
    const row = U.el('div', 'next-up-row');
    row.appendChild(U.el('span', 'next-up-name', best.name));
    row.appendChild(U.el('span', 'next-up-cost', '◇ ' + U.money(best.cost)));
    box.appendChild(row);
    box.appendChild(U.el('div', 'next-up-sub', short > 0
      ? U.money(short) + ' short'
      : 'you can afford this now'));
    if (!short) box.classList.add('ready');
    return box;
  }

  /* Line, reel and hook. Every rod is a rung — cast, line, reel, rarity and
     luck all climb together — so two rods of a tier play the same. These are
     the only place a rod becomes a shape rather than a number, and every one
     of them trades something for something. */
  function modStrip() {
    const strip = U.el('div', 'modslots');
    VF.mods.SLOTS.forEach(function (slot) {
      const m = VF.mods.inSlot(slot);
      const cell = U.el('div', 'modslot' + (m ? ' on' : ''));
      cell.appendChild(U.el('div', 'modslot-k', VF.mods.SLOT_NAMES[slot].toLowerCase()));
      cell.appendChild(U.el('div', 'modslot-v', m ? m.name : 'nothing fitted'));
      if (m) {
        const off = U.el('button', 'btn btn-sm', 'Remove');
        off.addEventListener('click', function () {
          VF.audio.click(); VF.mods.remove(slot); refresh();
        });
        cell.appendChild(off);
      }
      strip.appendChild(cell);
    });
    return strip;
  }

  function modRow(m, owned) {
    const d = VF.state.data;
    const fittedHere = VF.mods.inSlot(m.slot);
    const isOn = fittedHere && fittedHere.id === m.id;
    const locked = !owned && d.level < m.level;
    const row = U.el('div', 'row row-mod' + (isOn ? ' equipped' : owned ? ' owned' : '') +
                              (locked ? ' locked' : ''));
    const mark = U.el('div', 'row-mark');
    mark.style.background = isOn ? 'var(--accent)' : owned ? 'var(--good)' : locked ? 'var(--line-2)' : 'var(--accent)';
    row.appendChild(mark);

    const main = U.el('div', 'row-main');
    const nm = U.el('div', 'row-name');
    nm.appendChild(U.el('span', null, m.name));
    nm.appendChild(U.el('span', 'mod-slot', VF.mods.SLOT_NAMES[m.slot].toLowerCase()));
    if (isOn) { const t = U.el('span', 'tag', 'fitted'); t.style.color = 'var(--accent)'; nm.appendChild(t); }
    main.appendChild(nm);
    main.appendChild(U.el('div', 'row-desc', m.desc));

    /* What it trades, in the terms the rod row already uses. */
    const grid = U.el('div', 'mod-effects');
    const NAMES = { line: 'bar width', reel: 'bar speed', fill: 'meter', rare: 'rarity', luck: 'luck', bite: 'wait' };
    for (const k in m.mods) {
      const v = m.mods[k];
      const good = k === 'bite' ? v < 1 : v > (k === 'luck' ? 0 : 1);
      const chip = U.el('span', 'mod-eff ' + (good ? 'up' : 'down'));
      chip.textContent = NAMES[k] + ' ' + (k === 'luck'
        ? (v >= 0 ? '+' : '') + v.toFixed(2)
        : (v > 1 ? '+' : '') + Math.round((v - 1) * 100) + '%');
      grid.appendChild(chip);
    }
    main.appendChild(grid);
    row.appendChild(main);

    const side = U.el('div', 'row-side');
    if (owned) {
      if (!isOn) {
        const fitBtn = U.el('button', 'btn btn-sm btn-primary', 'Fit');
        fitBtn.addEventListener('click', function () { VF.audio.click(); VF.mods.fit(m.id); refresh(); });
        side.appendChild(fitBtn);
      } else {
        const off = U.el('button', 'btn btn-sm', 'Remove');
        off.addEventListener('click', function () { VF.audio.click(); VF.mods.remove(m.slot); refresh(); });
        side.appendChild(off);
      }
    } else if (locked) {
      side.appendChild(U.el('div', 'row-desc', 'level ' + m.level));
    } else {
      side.appendChild(priceEl(m.cost, VF.economy.canAfford(m.cost)));
      const buy = U.el('button', 'btn btn-sm' + (VF.economy.canAfford(m.cost) ? ' btn-primary' : ''), 'Buy');
      buy.disabled = !VF.economy.canAfford(m.cost);
      buy.addEventListener('click', function () {
        const res = VF.mods.buy(m.id);
        if (res.ok) { VF.audio.sell(); VF.toast.plain(m.name.toLowerCase() + ' — fitted', 'good', 2800); }
        else VF.audio.error();
        refresh();
      });
      side.appendChild(buy);
    }
    row.appendChild(side);
    return row;
  }

  function modShop() {
    const wrap = U.el('div');
    wrap.appendChild(modStrip());
    const list = U.el('div', 'list');
    VF.mods.SLOTS.forEach(function (slot) {
      VF.mods.list.filter(function (m) { return m.slot === slot; })
        .forEach(function (m) { list.appendChild(modRow(m, VF.mods.owned(m.id))); });
    });
    wrap.appendChild(list);
    return wrap;
  }

  function buildShop(tab) {
    const d = VF.state.data;
    const p = shell('Shop', 'Everything you will ever need, eventually · paid in Jias');
    p.appendChild(tabs([
      { id: 'rods', label: 'rods' }, { id: 'bait', label: 'bait' },
      { id: 'mods', label: 'fittings' },
      { id: 'charms', label: 'charms' }, { id: 'cases', label: 'cases' },
      { id: 'charter', label: 'charter' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'charter') { b.appendChild(charterShop()); p.appendChild(b); return p; }
    if (tab === 'mods') { b.appendChild(modShop()); p.appendChild(b); return p; }
    if (tab === 'charms') { b.appendChild(charmShop()); p.appendChild(b); return p; }
    if (tab === 'cases') { b.appendChild(caseList()); p.appendChild(b); return p; }

    if (tab === 'rods') {
      /* Cards rather than rows.

         A row is the right shape for a list of prices and the wrong one for a
         list of objects: it gives a rod a hundred-pixel strip lying on its
         side, which is exactly the amount of room its outline needs and does
         not get. A card stands the rod up, gives it the full height, and puts
         the numbers where they can be read down rather than across. */
      const eq = VF.rods.get(d.rod);
      b.appendChild(nextUpgrade(eq));
      const grid = U.el('div', 'rod-cards');
      VF.rods.list.forEach(function (rod, idx) {
        const owned = d.ownedRods.indexOf(rod.id) >= 0;
        // earned rods and the wanderer's stock are never on the shelf; they
        // turn up here once they are yours
        if ((rod.quest || rod.merchant || rod.admin) && !owned) return;
        const block = owned ? null : VF.rods.blocked(rod);
        const locked = !!block || (!owned && rod.noShop);
        const can = VF.economy.canAfford(rod.cost);
        const inHand = d.rod === rod.id;
        const rar = rodRarity(rod);

        const card = U.el('div', 'rod-card' + (owned ? ' owned' : '') +
                          (locked && !owned ? ' locked' : '') + (inHand ? ' equipped' : ''));
        card.style.setProperty('--rar', rar.color);

        /* the numbers, read down */
        const stats = U.el('div', 'rc-stats');
        const c = owned ? function () { return 0; } : cmp;
        rcStat(stats, 'Cast', rod.cast.toFixed(2), c(rod.cast, eq.cast));
        rcStat(stats, 'Reel', rod.reel.toFixed(2), c(rod.reel, eq.reel));
        rcStat(stats, 'Line', rod.line.toFixed(2), c(rod.line, eq.line));
        rcStat(stats, 'Rarity', '\u00d7' + rod.rare.toFixed(2), c(rod.rare, eq.rare));
        rcStat(stats, 'Luck', '+' + rod.luck.toFixed(2), c(rod.luck, eq.luck));
        rcStat(stats, 'Bar', Math.round((rod.barSize || 1) * 100) + '%',
               c(rod.barSize || 1, eq.barSize || 1));
        card.appendChild(stats);

        /* the rod, stood up */
        const art = U.el('div', 'rc-art');
        art.appendChild(rodPreviewV(rod, idx, locked && !owned, 150, 240));
        card.appendChild(art);

        /* what it is */
        const badge = U.el('div', 'rc-rarity');
        badge.style.color = rar.color;
        badge.appendChild(U.el('span', 'rc-star', '\u2605'));
        badge.appendChild(U.el('span', null, rar.name));
        badge.appendChild(U.el('span', 'rc-star', '\u2605'));
        card.appendChild(badge);

        card.appendChild(U.el('div', 'rc-name', '[' + rod.name + ']'));
        card.appendChild(U.el('div', 'rc-build', VF.rodFrame ? VF.rodFrame.of(rod).name + ' build' : ''));

        card.appendChild(U.el('div', 'rc-desc', !locked || owned ? rod.desc
          : rod.noShop ? (rod.notForSale || 'Not for sale. Somebody has to give you this one.')
          : block.note));
        if (rod.perk && (!locked || owned)) {
          const pk = U.el('div', 'rc-perk', rod.perk);
          card.appendChild(pk);
        }
        card.appendChild(U.el('div', 'rc-bar', rodBarNote(rod)));

        /* and the one thing you can do about it */
        const foot = U.el('div', 'rc-foot');
        if (owned) {
          if (inHand) {
            foot.appendChild(U.el('div', 'rc-btn is-on', '[Equipped]'));
          } else {
            if (!VF.rods.canEquip(rod)) {
              foot.appendChild(U.el('div', 'rc-btn is-off', '[Needs LV ' + rod.level + ']'));
            } else {
              const eb = U.el('button', 'rc-btn', '[Equip]');
              eb.addEventListener('click', function (e2) {
                dropFocusIn(e2);
                VF.state.data.rod = rod.id;
                VF.audio.click(); VF.bus.emit('gear:changed'); VF.save.save();
                VF.hud.refreshGear();
                refresh('rods');
              });
              foot.appendChild(eb);
            }
          }
        } else if (rod.noShop) {
          foot.appendChild(U.el('div', 'rc-btn is-off', '[Not For Sale]'));
        } else {
          const price = U.el('div', 'rc-price' + (can && !locked ? '' : ' cant'),
                             U.money(rod.cost) + ' jias');
          foot.appendChild(price);
          const bb = U.el('button', 'rc-btn' + (can && !locked ? ' is-buy' : ''),
                          locked ? '[Locked]' : '[Buy]');
          bb.disabled = locked || !can;
          bb.addEventListener('click', function (e2) {
            dropFocusIn(e2);
            const r = VF.economy.buyRod(rod.id);
            if (r.ok) {
              VF.audio.buy();
              VF.toast.show('Equipped <strong>' + U.esc(rod.name) + '</strong>', 'good');
              VF.hud.refreshGear(); VF.achievements.check(); refresh('rods');
            } else { VF.audio.error(); }
          });
          foot.appendChild(bb);
        }
        card.appendChild(foot);
        grid.appendChild(card);
      });
      b.appendChild(grid);
    } else {
      const list = U.el('div', 'list');
      VF.bait.available().forEach(function (bt) {
        const levelOk = d.level >= bt.level;
        const have = VF.bait.count(bt.id);
        const row = U.el('div', 'row' + (levelOk ? '' : ' locked') + (d.bait === bt.id ? ' equipped' : ''));
        const mark = U.el('div', 'row-mark');
        mark.style.background = bt.color;
        row.appendChild(mark);

        const main = U.el('div', 'row-main');
        const name = U.el('div', 'row-name');
        name.appendChild(U.el('span', null, bt.name));
        if (d.bait === bt.id) { const t = U.el('span', 'tag', 'equipped'); t.style.color = 'var(--accent)'; name.appendChild(t); }
        if (bt.unlimited) { const t = U.el('span', 'tag', 'unlimited'); t.style.color = 'var(--ink-3)'; name.appendChild(t); }
        main.appendChild(name);
        main.appendChild(U.el('div', 'row-desc', levelOk ? bt.desc : 'Requires level ' + bt.level));
        const grid = U.el('div', 'stat-grid');
        grid.appendChild(statCell('Held', have === Infinity ? '∞' : U.commas(have), 0));
        grid.appendChild(statCell('Bite', (bt.bite < 1 ? '' : '+') + Math.round((1 - bt.bite) * 100) + '%', bt.bite < 1 ? 1 : bt.bite > 1 ? -1 : 0));
        grid.appendChild(statCell('Rare', '×' + bt.rare.toFixed(2), bt.rare > 1 ? 1 : 0));
        grid.appendChild(statCell('Luck', '+' + bt.luck.toFixed(2), bt.luck > 0 ? 1 : 0));
        main.appendChild(grid);
        row.appendChild(main);

        const side = U.el('div', 'row-side');
        if (!bt.unlimited) side.appendChild(priceEl(bt.cost, VF.economy.canAfford(bt.cost)));
        const acts = U.el('div', 'row-actions');
        if (!bt.unlimited) {
          [1, 5, 25].forEach(function (n) {
            const btn = U.el('button', 'btn btn-sm', '+' + (bt.pack * n));
            btn.title = 'Buy ' + n + ' pack' + (n > 1 ? 's' : '') + ' — ◈ ' + U.money(bt.cost * n);
            btn.disabled = !levelOk || !VF.economy.canAfford(bt.cost * n);
            btn.addEventListener('click', function () {
              const r = VF.economy.buyBait(bt.id, n);
              if (r.ok) { VF.audio.buy(); VF.hud.refreshGear(); refresh('bait'); }
              else VF.audio.error();
            });
            acts.appendChild(btn);
          });
        }
        if (d.bait !== bt.id && levelOk && (bt.unlimited || have > 0)) {
          const eqb = U.el('button', 'btn btn-sm btn-primary', 'Use');
          eqb.addEventListener('click', function () {
            d.bait = bt.id; VF.audio.click(); VF.bus.emit('bait:changed'); VF.save.save(); refresh('bait');
          });
          acts.appendChild(eqb);
        }
        side.appendChild(acts);
        row.appendChild(side);
        list.appendChild(row);
      });
      b.appendChild(list);
    }
    p.appendChild(b);
    return p;
  }

  function cmp(a, b) { return a > b + 1e-9 ? 1 : a < b - 1e-9 ? -1 : 0; }

  /* What a rod is worth once the fish is on: line strength is what widens the
     white bar, reel force is what steadies it and sharpens how fast it answers
     the key. Same arithmetic as loot.fightParams — stated here so the shop is
     not describing a bonus the fight does not actually give. */
  /* The totals, not the parts: what this rod does to the white bar once its
     line, its reel force and anything it declares for itself are all in. */
  function rodBarNote(rod) {
    /* A rod may state its own, and one does. Nothing that can be bought is
       allowed to — a rod for sale has to say what the fight will really do. */
    if (rod.barNote) return rod.barNote;
    const q = U.clamp((rod.reel - 0.40) / 2.70, 0, VF.loot.Q_MAX);
    const bar = (1 + 0.155 * (Math.log(Math.max(0.25, rod.line)) / Math.LN2)) * (rod.barSize || 1);
    const wider = Math.round((bar - 1) * 100);
    /* It cannot promise more slowing than the fight will actually give, and
       what the fight will actually give is the floor barMul clamps to. */
    const capped = Math.max(VF.loot.SLOW_FLOOR, (1 - 0.20 * q) * (rod.barSpeed || 1));
    const move = Math.round((capped - 1) * 100);
    const sharper = Math.round(60 * q);
    // reel force drives the meter as well as the key, so this carries the same
    // (1 + 0.35q) the fight applies — without it a rod with a stated −3%
    // drawback advertised a penalty while actually reeling a fifth faster
    const fill = Math.round(((1 + 0.35 * q) * (rod.barFill || 1) - 1) * 100);
    if (wider <= 0 && !move && !fill) {
      return 'white bar: the baseline every other rod is measured against';
    }
    const bits = [];
    if (wider > 0) bits.push('white bar +' + wider + '%');
    if (move) bits.push('bar movement ' + (move > 0 ? '+' : '−') + Math.abs(move) + '%');
    if (sharper > 0) bits.push(sharper + '% sharper on the key');
    if (fill) bits.push('progress ' + (fill > 0 ? '+' : '−') + Math.abs(fill) + '%');
    return bits.join(' · ');
  }

  /* What the wanderer is carrying, for as long as he is carrying it. Rows are
     the same shape as the shop's rods, because they are rods — the only real
     difference is that the stock is twenty of a hundred and it goes with him. */
  function buildMerchant() {
    const d = VF.state.data;
    const ms = VF.merchant.leavesIn();
    const mm = Math.floor(ms / 60000), ss = Math.floor((ms % 60000) / 1000);
    const p = shell('The Wanderer', VF.merchant.here()
      ? 'twenty of the hundred, and then he walks on · leaves in ' + mm + ':' + (ss < 10 ? '0' : '') + ss
      : 'he has gone');
    const b = body();

    const stock = VF.merchant.stock();
    if (!stock.length) {
      b.appendChild(U.el('div', 'empty', VF.merchant.here()
        ? 'his case is empty. you have bought everything he was carrying.'
        : 'there is nobody there. he turns up when he turns up.'));
      p.appendChild(b);
      return p;
    }

    b.appendChild(U.el('div', 'merch-intro',
      'he does not haggle and he does not come back for anything he did not sell. ' +
      'the numbers on the right are what the catch bar will actually do.'));

    const list = U.el('div', 'list');
    stock.forEach(function (rod) {
      const owned = d.ownedRods.indexOf(rod.id) >= 0;
      const gone = VF.merchant.sold(rod.id) || owned;
      const can = VF.economy.canAfford(rod.cost);
      const row = U.el('div', 'row row-rod' + (gone ? ' owned' : '') + (!can && !gone ? ' locked' : ''));
      const mark = U.el('div', 'row-mark');
      VF.rarities.paint(mark, rod.rarity, 'background');
      row.appendChild(mark);

      const art = U.el('div', 'rod-art-box');
      art.appendChild(rodPreview(rod, VF.rods.index(rod.id), false));
      row.appendChild(art);

      const main = U.el('div', 'row-main');
      const name = U.el('div', 'row-name');
      name.appendChild(U.el('span', null, rod.name));
      const rt = U.el('span', 'tag', VF.rarities.get(rod.rarity).name);
      VF.rarities.paint(rt, rod.rarity, 'color');
      name.appendChild(rt);
      if (gone) {
        const t2 = U.el('span', 'tag', owned ? 'yours' : 'sold');
        t2.style.color = 'var(--good)';
        name.appendChild(t2);
      }
      main.appendChild(name);
      main.appendChild(U.el('div', 'row-desc', rod.good + '.'));
      if (rod.bad) {
        const bad = U.el('div', 'row-desc', rod.bad);
        bad.style.color = 'var(--warn)';
        main.appendChild(bad);
      }

      const grid = U.el('div', 'stat-grid');
      grid.appendChild(statCell('Bar', '+' + Math.round((rod.barSize - 1) * 100) + '%', 1));
      const sp = Math.round((rod.barSpeed - 1) * 100);
      grid.appendChild(statCell('Movement', (sp > 0 ? '+' : '') + sp + '%', 0));
      if (rod.barFill && rod.barFill !== 1) {
        grid.appendChild(statCell('Progress', Math.round((rod.barFill - 1) * 100) + '%', -1));
      }
      grid.appendChild(statCell('Line', rod.line.toFixed(2), 0));
      grid.appendChild(statCell('Rare', '×' + rod.rare.toFixed(2), 0));
      main.appendChild(grid);
      row.appendChild(main);

      const side = U.el('div', 'row-side');
      if (gone) {
        const btn = U.el('button', 'btn btn-sm', owned && d.rod !== rod.id ? 'Equip' : 'Equipped');
        btn.disabled = d.rod === rod.id || !owned;
        btn.addEventListener('click', function () {
          d.rod = rod.id; VF.audio.click(); VF.bus.emit('gear:changed');
          VF.save.save(); refresh();
        });
        side.appendChild(btn);
      } else {
        side.appendChild(priceEl(rod.cost, can));
        const btn = U.el('button', 'btn btn-sm' + (can ? ' btn-primary' : ''), 'buy');
        btn.disabled = !can;
        btn.addEventListener('click', function () {
          if (!VF.merchant.buy(rod.id)) { VF.audio.error(); return; }
          VF.audio.buy();
          VF.toast.show('<strong>' + U.esc(rod.name) + '</strong><br><span style="color:var(--ink-3)">' +
            U.esc(rod.good) + '</span>', 'good', 5000);
          refresh();
        });
        side.appendChild(btn);
      }
      row.appendChild(side);
      list.appendChild(row);
    });
    b.appendChild(list);
    p.appendChild(b);
    return p;
  }

  /* --------------------------------------------------------- charms */

  /* ------------------------------------------------------------- charter

     Where the money goes late on. Conditions are the strongest thing in the
     game and the only one you could never influence; this is the lever. The
     price climbs with each charter and falls back over about ten minutes, so
     the answer to "can I just keep buying Thin Places" is yes, at a price. */

  function charterShop() {
    const wrap = U.el('div');
    const loc = VF.locations.current();

    const blurb = U.el('div', 'case-blurb');
    blurb.textContent = 'the water at ' + loc.name.toLowerCase() +
      ' can be persuaded, for a while, to be doing something else. it costs more each time' +
      ' you ask, and the asking price settles again if you leave it alone.';
    wrap.appendChild(blurb);

    const block = VF.charter.blocked();
    if (block) {
      const note = U.el('div', 'charter-note' + (block === 'busy' ? ' good' : ''));
      note.textContent = block === 'busy'
        ? 'the water is already doing something. ' +
          (VF.conditions.name() || '').toLowerCase() + ' has to finish first.'
        : 'land what is on the line first.';
      wrap.appendChild(note);
    }

    const sur = VF.charter.surcharge();
    if (sur > 0.02) {
      const s2 = U.el('div', 'charter-sur');
      s2.textContent = 'asking price is up ' + Math.round(sur * 100) + '% — it falls back on its own';
      wrap.appendChild(s2);
    }

    const list = U.el('div', 'list charter-list');
    const offered = VF.charter.offered();
    if (!offered.length) {
      wrap.appendChild(U.el('div', 'empty', 'this water does not do anything on request.'));
      return wrap;
    }

    offered.slice().sort(function (a, b) {
      return VF.charter.power(a) - VF.charter.power(b);
    }).forEach(function (c) {
      const cost = VF.charter.price(c);
      const can = VF.economy.canAfford(cost) && !block;

      const row = U.el('div', 'row' + (block ? ' locked' : ''));
      const mark = U.el('div', 'row-mark');
      mark.style.background = c.tint;
      mark.style.boxShadow = '0 0 10px ' + U.rgbToCss(U.hexToRgb(c.tint), 0.5);
      row.appendChild(mark);

      const main = U.el('div', 'row-main');
      const name = U.el('div', 'row-name');
      const nm = U.el('span', null, c.name);
      nm.style.color = c.tint;
      name.appendChild(nm);
      const dur = U.el('span', 'tag', Math.round(c.dur[0] / 60) + '–' + Math.round(c.dur[1] / 60) + ' min');
      name.appendChild(dur);
      main.appendChild(name);
      main.appendChild(U.el('div', 'row-desc', c.blurb));

      // the actual numbers, so the price can be judged against them
      const mods = U.el('div', 'stat-grid');
      const LABEL = { bite: 'bites', rare: 'rarity', trait: 'traits', treasure: 'salvage',
                      encounter: 'encounters', size: 'size', value: 'value', secret: 'hidden water',
                      'void': 'void' };
      for (const k in c.mods) {
        const v = c.mods[k];
        if (v === 1) continue;
        // a bite modifier under 1 means sooner, which is better, not worse
        const better = k === 'bite' ? v < 1 : v > 1;
        const shown = k === 'bite' ? (v < 1 ? '×' + (1 / v).toFixed(2) + ' faster' : '×' + v.toFixed(2) + ' slower')
                                   : '×' + v.toFixed(2);
        mods.appendChild(statCell(LABEL[k] || k, shown, better ? 1 : -1));
      }
      main.appendChild(mods);
      row.appendChild(main);

      const side = U.el('div', 'row-side');
      side.appendChild(priceEl(cost, can));
      const buy = U.el('button', 'btn btn-sm' + (can ? ' btn-primary' : ''), 'Charter');
      buy.disabled = !can;
      buy.addEventListener('click', function () {
        const res = VF.charter.buy(c.id);
        if (!res.ok) {
          VF.audio.error();
          VF.toast.plain(res.why === 'money' ? 'not enough Jias'
            : res.why === 'busy' ? 'the water is already busy'
            : res.why === 'fishing' ? 'land it first' : 'not here', 'warn');
          return;
        }
        VF.audio.sell();
        VF.toast.show('the water turns — <strong>' + U.esc(c.name) + '</strong>', 'good', 4200);
        close();
      });
      side.appendChild(buy);
      row.appendChild(side);
      list.appendChild(row);
    });

    wrap.appendChild(list);
    return wrap;
  }

  function charmIcon(c, size) {
    const cv = U.el('canvas');
    cv.width = cv.height = size * 2;
    cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d');
    const col = U.hexToRgb(VF.rarities.color(c.rarity));
    g.translate(size, size);
    const R = size * 0.72;
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, R * 1.6);
    grd.addColorStop(0, U.rgbToCss(col, 0.30));
    grd.addColorStop(1, U.rgbToCss(col, 0));
    g.fillStyle = grd;
    g.fillRect(-R * 1.6, -R * 1.6, R * 3.2, R * 3.2);
    g.strokeStyle = U.rgbToCss(col, 0.9);
    g.lineWidth = Math.max(1.4, size * 0.05);
    g.beginPath();
    if (c.kind === 'relic') {
      // relics are drawn as a broken ring, charms as a closed one
      g.arc(0, 0, R * 0.62, 0.5, Math.PI * 1.7);
    } else {
      g.arc(0, 0, R * 0.62, 0, VF.util.TAU);
    }
    g.stroke();
    g.fillStyle = U.rgbToCss(col, 0.55);
    const n = c.kind === 'relic' ? 3 : 4;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * VF.util.TAU - 0.6;
      g.beginPath();
      g.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, size * 0.07, 0, VF.util.TAU);
      g.fill();
    }
    // charms that carry an emblem wear it in the middle of the ring
    if (c.icon) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = Math.round(size * 0.62) + 'px ' +
               '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
      g.fillText(c.icon, 0, size * 0.03);
    }
    return cv;
  }

  function statLine(c) {
    const parts = [];
    const st = c.stats || {};
    const NAMES = { luck: 'luck', rare: 'rarity', value: 'value', xp: 'xp', bite: 'bite time',
                    reel: 'reel', line: 'line', size: 'size', trait: 'traits',
                    treasure: 'salvage', encounter: 'encounters', secret: 'discovery', 'void': 'the deep',
                    barSize: 'white bar size', barSpeed: 'bar movement' };
    for (const k in st) {
      const v = st[k];
      if (k === 'luck') { parts.push({ t: 'luck +' + v.toFixed(2), good: v > 0 }); continue; }
      // a lower bite figure is faster, so it reads as an improvement
      // bar movement is a preference, not an upgrade — it is left uncoloured
      const better = k === 'barSpeed' ? null : (k === 'bite' ? v < 1 : v > 1);
      const pctv = Math.round(Math.abs(v - 1) * 100);
      parts.push({ t: NAMES[k] + ' ' + (v > 1 ? '+' : '−') + pctv + '%', good: better });
    }
    const row = U.el('div', 'stat-grid');
    parts.forEach(function (p) {
      const cell = U.el('div', 'stat-cell');
      const val = U.el('span', 'v' + (p.good === null ? '' : p.good ? ' up' : ' down'), p.t);
      cell.appendChild(val);
      row.appendChild(cell);
    });
    return row;
  }

  function charmShop() {
    const d = VF.state.data;
    const wrap = U.el('div');

    wrap.appendChild(slotStrip());

    const list = U.el('div', 'list');
    VF.charms.list.forEach(function (c) {
      const own = VF.charms.owned(c.id);
      if (c.found && !own) return;                 // relics are never for sale
      const levelOk = !c.level || d.level >= c.level;
      const can = c.cost ? VF.economy.canAfford(c.cost) : true;
      const row = U.el('div', 'row' + (own ? ' owned' : '') + (levelOk ? '' : ' locked') +
                              (VF.charms.isEquipped(c.id) ? ' equipped' : ''));
      const mark = U.el('div', 'row-mark');
      VF.rarities.paint(mark, c.rarity, 'background');
      row.appendChild(mark);

      const iconBox = U.el('div', 'rod-art-box');
      iconBox.style.width = '84px';
      iconBox.style.flex = '0 0 84px';
      iconBox.style.display = 'grid';
      iconBox.style.placeItems = 'center';
      iconBox.appendChild(charmIcon(c, 56));
      row.appendChild(iconBox);
      row.className += ' row-rod';

      const main = U.el('div', 'row-main');
      const name = U.el('div', 'row-name');
      name.appendChild(U.el('span', null, c.name));
      const kt = U.el('span', 'tag', c.kind);
      VF.rarities.paint(kt, c.rarity, 'color');
      name.appendChild(kt);
      if (VF.charms.isEquipped(c.id)) {
        const t = U.el('span', 'tag', 'worn'); t.style.color = 'var(--accent)'; name.appendChild(t);
      }
      main.appendChild(name);
      main.appendChild(U.el('div', 'row-desc', levelOk ? c.desc : 'requires level ' + c.level));
      const note = U.el('div', 'row-desc');
      note.style.color = 'var(--ink-2)';
      note.textContent = c.note;
      main.appendChild(note);
      main.appendChild(statLine(c));
      row.appendChild(main);

      const side = U.el('div', 'row-side');
      if (own) {
        const eqd = VF.charms.isEquipped(c.id);
        const btn = U.el('button', 'btn btn-sm' + (eqd ? '' : ' btn-primary'), eqd ? 'take off' : 'wear');
        btn.disabled = !eqd && VF.charms.slotCount() === 0;
        btn.addEventListener('click', function () {
          if (eqd) VF.charms.unequip(d.charmSlots.indexOf(c.id));
          else VF.charms.equip(c.id);
          VF.audio.click(); VF.save.save(); refresh('charms');
        });
        side.appendChild(btn);
      } else {
        side.appendChild(priceEl(c.cost, can && levelOk));
        const btn = U.el('button', 'btn btn-sm' + (can && levelOk ? ' btn-primary' : ''), 'buy');
        btn.disabled = !levelOk || !can;
        btn.addEventListener('click', function () {
          if (!VF.economy.spend(c.cost, 'charm')) { VF.audio.error(); return; }
          VF.charms.grant(c.id);
          if (VF.charms.slotCount() > VF.charms.equipped().length) VF.charms.equip(c.id);
          VF.audio.buy();
          VF.toast.show('<strong>' + U.esc(c.name) + '</strong> — ' + U.esc(c.note), 'good', 4200);
          VF.achievements.check(); VF.save.save(); refresh('charms');
        });
        side.appendChild(btn);
      }
      row.appendChild(side);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  /* The worn row, plus what the loadout currently adds up to. */
  function slotStrip() {
    const d = VF.state.data;
    const wrap = U.el('div');
    const max = VF.charms.slotCount();
    const row = U.el('div', 'slot-row');
    for (let i = 0; i < 5; i++) {
      const id = d.charmSlots[i];
      const c = VF.charms.get(id);
      const el = U.el('div', 'slot' + (i >= max ? ' locked' : c ? ' filled' : ''));
      if (i >= max) {
        const nx = VF.charms.SLOT_LEVELS[i];
        el.appendChild(U.el('div', 'slot-name', 'level ' + nx));
      } else if (c) {
        el.appendChild(charmIcon(c, 38));
        el.appendChild(U.el('div', 'slot-name', c.name));
        el.title = c.note;
        el.addEventListener('click', function () {
          VF.charms.unequip(i); VF.audio.back(); VF.save.save(); refresh(current === 'shop' ? 'charms' : 'charms');
        });
      } else {
        el.appendChild(U.el('div', 'slot-name', 'empty'));
      }
      row.appendChild(el);
    }
    wrap.appendChild(row);

    const bs = VF.build.charmStats();
    const line = U.el('div', 'build-line');
    line.appendChild(U.el('span', 'k', 'charms'));
    const tag = U.el('span', 'v');
    tag.textContent = VF.build.describe();
    line.appendChild(tag);
    const show = [['rarity', bs.rare, false], ['size', bs.size, false], ['traits', bs.trait, false],
                  ['value', bs.value, false], ['bite time', bs.bite, true], ['line', bs.line, false],
                  ['salvage', bs.treasure, false], ['discovery', bs.secret, false],
                  ['white bar', bs.barSize, false], ['bar movement', bs.barSpeed, null]];
    show.forEach(function (row2) {
      const v = row2[1];
      if (Math.abs(v - 1) < 0.02) return;
      const better = row2[2] === null ? null : row2[2] ? v < 1 : v > 1;
      const el = U.el('span', 'v' + (better === null ? '' : better ? ' good' : ' bad'),
        row2[0] + ' ' + (v > 1 ? '+' : '−') + Math.round(Math.abs(v - 1) * 100) + '%');
      line.appendChild(el);
    });
    if (bs.luck > 0.01) line.appendChild(U.el('span', 'v good', 'luck +' + bs.luck.toFixed(2)));
    else if (bs.luck < -0.01) line.appendChild(U.el('span', 'v bad', 'luck ' + bs.luck.toFixed(2)));
    if (line.children.length <= 2) line.appendChild(U.el('span', 'v', 'nothing worn'));
    wrap.appendChild(line);
    return wrap;
  }

  /* ---------------------------------------------------------- cases */

  function caseIcon(c, size) {
    const cv = U.el('canvas', 'case-icon');
    cv.width = cv.height = size * 2;
    cv.style.width = cv.style.height = size + 'px';
    const g = cv.getContext('2d');
    const col = U.hexToRgb(c.color);
    g.translate(size, size);
    const S = size * 0.62;
    const grd = g.createLinearGradient(-S, -S, S, S);
    grd.addColorStop(0, U.rgbToCss(U.shade(col, -0.25)));
    grd.addColorStop(1, U.rgbToCss(U.shade(col, -0.62)));
    g.fillStyle = grd;
    g.fillRect(-S, -S * 0.78, S * 2, S * 1.56);
    g.strokeStyle = U.rgbToCss(col, 0.95);
    g.lineWidth = Math.max(1.4, size * 0.045);
    g.strokeRect(-S, -S * 0.78, S * 2, S * 1.56);
    g.fillStyle = U.rgbToCss(col, 0.85);
    g.fillRect(-S, -S * 0.16, S * 2, S * 0.32);
    g.fillStyle = U.rgbToCss(U.shade(col, 0.5), 0.95);
    g.fillRect(-S * 0.18, -S * 0.34, S * 0.36, S * 0.68);
    return cv;
  }

  function caseList() {
    const d = VF.state.data;
    const wrap = U.el('div');

    if (d.caseTokens > 0) {
      const note = U.el('div', 'relic-note');
      note.appendChild(U.el('span', 'k', 'keys'));
      note.appendChild(U.el('div', null, d.caseTokens + ' spare ' +
        (d.caseTokens === 1 ? 'key' : 'keys') + ' — the next case is free.'));
      wrap.appendChild(note);
    }

    const list = U.el('div', 'list');
    VF.cases.list.forEach(function (c) {
      const levelOk = d.level >= c.level;
      const comp = VF.cases.completion(c.id);
      const check = VF.caseOpen.canBuy(c.id);
      const card = U.el('div', 'case-card' + (levelOk ? '' : ' locked'));
      card.appendChild(caseIcon(c, 62));

      const main = U.el('div');
      main.appendChild(U.el('div', 'case-name', c.name));
      main.appendChild(U.el('div', 'case-blurb', levelOk ? c.blurb : 'requires level ' + c.level));

      const odds = U.el('div', 'odds');
      /* Every tier the case can actually pay, including the two the old list
         stopped short of — a case that promises two in a hundred thousand of
         something has to say so, or the tier is a rumour. */
      const eff = VF.cases.effectiveOdds(c);
      VF.cases.TIERS.forEach(function (r) {
        const pc = eff[r] * 100;
        if (pc <= 0) return;
        const sp = U.el('span', null, VF.rarities.get(r).name + ' ' +
          (pc >= 1 ? pc.toFixed(1) : pc >= 0.01 ? pc.toFixed(2) : pc.toFixed(4)) + '%');
        VF.rarities.paint(sp, r, 'color');
        odds.appendChild(sp);
      });
      main.appendChild(odds);

      const bar = U.el('div', 'bar-mini');
      const fill = U.el('div');
      fill.style.width = (comp.pct * 100).toFixed(1) + '%';
      fill.style.background = c.color;
      bar.appendChild(fill);
      main.appendChild(bar);
      const cnt = U.el('div', 'case-blurb', 'collection ' + comp.have + ' / ' + comp.total);
      cnt.style.marginTop = '5px';
      main.appendChild(cnt);
      card.appendChild(main);

      const side = U.el('div', 'row-side');
      side.appendChild(priceEl(check.free ? 0 : c.cost, check.ok));
      if (check.free) side.lastChild.textContent = 'free — key';
      const btn = U.el('button', 'btn btn-sm' + (check.ok ? ' btn-primary' : ''), 'open');
      btn.disabled = !check.ok;
      btn.addEventListener('click', function () { openCase(c.id); });
      side.appendChild(btn);
      card.appendChild(side);
      list.appendChild(card);
    });
    wrap.appendChild(list);

    const foot = U.el('div', 'case-blurb');
    foot.style.marginTop = '14px';
    foot.textContent = 'cases contain cosmetics only. nothing inside changes how you fish. ' +
                       'duplicates are refunded.';
    wrap.appendChild(foot);
    return wrap;
  }

  /* -------------------------------------------------------- wardrobe */

  function cosThumb(cos, w, h, t) {
    const cv = U.el('canvas', 'cos-art');
    cv.width = w * 2; cv.height = h * 2;
    const g = cv.getContext('2d');
    g.scale(2, 2);
    VF.cosmeticArt.draw(g, cos, w, h, t || 0);
    return cv;
  }

  function buildWardrobe(tab) {
    const d = VF.state.data;
    const comp = VF.cosmetics.gearCompletion();
    const p = shell('Wardrobe', comp.have + ' of ' + comp.total + ' owned · ' +
                    Math.round(comp.pct * 100) + '% complete');
    const items = [{ id: 'all', label: 'all' }].concat(
      VF.cosmetics.slots.map(function (s2) { return { id: s2.id, label: s2.name }; }));
    p.appendChild(tabs(items, tab, function (t) { refresh(t); }));
    const b = body();

    const bar = U.el('div', 'bar-mini');
    const fill = U.el('div');
    fill.style.width = (comp.pct * 100).toFixed(1) + '%';
    bar.appendChild(fill);
    b.appendChild(bar);
    const spacer = U.el('div');
    spacer.style.height = '14px';
    b.appendChild(spacer);

    /* Gear only. The room's backdrops and plinths are cosmetics in every
       other respect — same cases, same ownership, same rarity — but they are
       fitted in the aquarium's own cabinet, because filing a tank backdrop in
       a tab next to a rod finish files it by what it is made of rather than by
       what it is for. */
    const list = VF.cosmetics.gear.filter(function (c) { return tab === 'all' || c.slot === tab; });
    list.sort(function (a, c) {
      const ra = VF.rarities.rank(a.rarity), rc = VF.rarities.rank(c.rarity);
      if (ra !== rc) return rc - ra;
      return a.name.localeCompare(c.name);
    });

    const grid = U.el('div', 'cos-grid');
    list.forEach(function (c, i) {
      const own = VF.cosmetics.owned(c.id);
      const on = VF.cosmetics.equippedIn(c.slot) === c;
      const cell = U.el('div', 'cos-cell' + (own ? '' : ' locked') + (on ? ' on' : ''));
      const pip = U.el('div', 'cos-pip');
      VF.rarities.paint(pip, c.rarity, 'background');
      if (own) pip.style.boxShadow = '0 0 8px ' + U.rgbToCss(U.hexToRgb(VF.rarities.get(c.rarity).glow), 0.7);
      cell.appendChild(pip);

      if (own) {
        cell.appendChild(cosThumb(c, 118, 54, i * 0.6));
        cell.appendChild(U.el('div', 'cos-name', c.name));
      } else {
        const blank = U.el('canvas', 'cos-art');
        blank.width = 236; blank.height = 108;
        const g = blank.getContext('2d');
        g.scale(2, 2);
        g.globalAlpha = 0.16;
        VF.cosmeticArt.draw(g, c, 118, 54, 0);
        cell.appendChild(blank);
        cell.appendChild(U.el('div', 'cos-name', '?????'));
      }
      cell.appendChild(U.el('div', 'cos-slot',
        (VF.cosmetics.slots.filter(function (s2) { return s2.id === c.slot; })[0] || {}).name || c.slot));

      if (own) {
        cell.addEventListener('click', function () {
          if (on) VF.cosmetics.unequip(c.slot);
          else VF.cosmetics.equip(c.id);
          VF.audio.click(); VF.save.save(); refresh(tab);
        });
      }
      grid.appendChild(cell);
    });
    b.appendChild(grid);
    p.appendChild(b);
    return p;
  }

  /* --------------------------------------------------- journal + people */

  /* The board. Three standing requests, no timer on them, and the only place
     in the game that ever asks for a fish by name. */
  function boardView() {
    const wrap = U.el('div');
    VF.bounties.refresh();
    const list = VF.bounties.list();

    const note = U.el('div', 'board-note',
      'People want particular things. They will wait.');
    wrap.appendChild(note);

    if (!list.length) {
      wrap.appendChild(U.el('div', 'empty',
        'nobody is asking for anything you could go and get yet.'));
      return wrap;
    }

    list.forEach(function (bnt) {
      const f = VF.fish.byId(bnt.fish);
      if (!f) return;
      const r = VF.rarities.get(f.rarity);
      const done = VF.bounties.ready(bnt);
      const row = U.el('div', 'bounty' + (done ? ' done' : ''));

      const mark = U.el('div', 'bounty-mark');
      mark.style.background = done ? 'var(--good)' : r.color;
      row.appendChild(mark);

      const art = U.el('canvas', 'bounty-art');
      art.width = 168; art.height = 84;
      const g = art.getContext('2d');
      g.save(); g.translate(84, 42);
      const got = !!VF.state.data.fishdex[f.id];
      if (got) VF.fishArt.draw(g, f, VF.fishArt.fitSize(f, 84, false), { time: 0.3 });
      else { g.globalAlpha = 0.34; VF.fishArt.drawSilhouette(g, f, VF.fishArt.fitSize(f, 84, false), 0.85); }
      g.restore();
      row.appendChild(art);

      const main = U.el('div', 'bounty-main');
      const who = VF.npcs.get(bnt.who);
      const head = U.el('div', 'bounty-who', (who ? who.name : 'somebody') + ' wants');
      main.appendChild(head);

      /* The name, whether or not it is in the record. Somebody asking you for
         a fish tells you which fish — the silhouette above is you not knowing
         what it looks like yet, which is a different thing and the interesting
         one. A board that says ????? is not a request, it is a riddle. */
      const nm = U.el('div', 'bounty-name', f.name + (bnt.want > 1 ? ' ×' + bnt.want : ''));
      nm.style.color = r.color;
      main.appendChild(nm);

      const where = f.locs.length ? VF.locations.get(f.locs[0]).name.toLowerCase() : 'anywhere';
      main.appendChild(U.el('div', 'bounty-where', r.name.toLowerCase() + ' · ' + where));

      const track = U.el('div', 'bounty-track');
      const fill = U.el('div', 'bounty-fill');
      fill.style.width = (Math.min(1, bnt.have / bnt.want) * 100) + '%';
      if (done) fill.style.background = 'var(--good)';
      track.appendChild(fill);
      main.appendChild(track);
      main.appendChild(U.el('div', 'bounty-n', bnt.have + ' / ' + bnt.want));
      row.appendChild(main);

      const acts = U.el('div', 'bounty-acts');
      acts.appendChild(U.el('div', 'bounty-pay', '◇ ' + U.money(bnt.pay)));
      if (done) {
        const hand = U.el('button', 'btn btn-sm btn-primary', 'Hand it over');
        hand.addEventListener('click', function () {
          const res = VF.bounties.claim(bnt.id);
          VF.audio.sell();
          if (res) VF.toast.plain('◇ ' + U.money(res.pay) + ' — that is what they wanted', 'good', 3000);
          refresh('board');
        });
        acts.appendChild(hand);
      } else {
        const give = U.el('button', 'btn btn-sm', 'Pass');
        give.title = 'Take it off the board. Somebody will ask for something else.';
        give.addEventListener('click', function () {
          VF.audio.click();
          VF.bounties.drop(bnt.id);
          refresh('board');
        });
        acts.appendChild(give);
      }
      row.appendChild(acts);
      wrap.appendChild(row);
    });
    return wrap;
  }

  /* Leads, and the expeditions they open into. What the player is currently
     chasing, in the order they could act on it. */
  /* What you have been told, and have not been out to check.

     Deliberately not a quest list. There is no marker, no objective and no
     tick box, because a rumour is not a task — it is a thing somebody said,
     and the game's position on whether it is true is that it does not say.

     Two accounts of the same thing are shown together, with who said each.
     That pairing is the whole of the interface: nothing labels one of them
     wrong, and the player is left holding a disagreement, which is the state
     the system exists to produce. */
  function saidView(b) {
    if (!VF.rumours) return;
    const heard = VF.rumours.all().filter(function (r) { return !r.settled; });
    if (!heard.length) return;

    b.appendChild(U.el('div', 'quest-sep', 'and what people say'));

    const contested = {};
    VF.rumours.contested().forEach(function (c) { contested[c.topic] = 1; });

    const byTopic = {};
    heard.forEach(function (r) { (byTopic[r.topic] = byTopic[r.topic] || []).push(r); });

    Object.keys(byTopic).forEach(function (topic) {
      const set = byTopic[topic];
      const card = U.el('div', 'lead' + (contested[topic] ? ' said-split' : ''));
      set.forEach(function (r) {
        const who = r.from ? VF.npcs.name(r.from) : 'somebody';
        card.appendChild(U.el('div', 'lead-name', who.toLowerCase()));
        card.appendChild(U.el('div', 'lead-note', r.line));
      });
      if (contested[topic]) {
        card.appendChild(U.el('div', 'lead-need', 'these do not agree'));
      }
      b.appendChild(card);
    });
  }

  function leadsView(b, leads) {
    const d = VF.state.data;
    const run = VF.expedition ? VF.expedition.current() : null;

    if (run) {
      b.appendChild(U.el('div', 'panel-note', 'under way'));
      b.appendChild(expCard({ def: run.def, started: 1, done: 0, leg: run.rec.leg, open: 1 }, run));
    }

    if (!leads.length) {
      /* Only when this is the whole of what the panel has to say. Inside the
         threads list an empty leads section is just an empty section. */
      if (!b.childElementCount) {
        b.appendChild(U.el('div', 'empty',
          'nothing is pointing anywhere yet. strange catches leave clues, and clues point somewhere.'));
      }
    } else {
      leads.forEach(function (l) {
        const card = U.el('div', 'lead' + (l.ready ? ' ready' : ''));
        card.appendChild(U.el('div', 'lead-name', l.def.name));
        card.appendChild(U.el('div', 'lead-note', l.def.note));
        const where = l.def.where ? VF.locations.get(l.def.where).name : 'anywhere';
        const need = U.el('div', 'lead-need' + (l.ready ? ' met' : ''),
          where.toLowerCase() + (l.def.need ? ' · ' + l.def.need : '') +
          (l.ready ? ' · you are standing in it' : ''));
        card.appendChild(need);
        b.appendChild(card);
      });
    }

    /* Expeditions that a lead has opened but that are not running. */
    const offer = VF.expedition ? VF.expedition.offered().filter(function (x) {
      return x.open && !x.started;
    }) : [];
    if (offer.length) {
      b.appendChild(U.el('div', 'panel-note', 'expeditions'));
      offer.forEach(function (x) { b.appendChild(expCard(x, null)); });
    }
    /* Finished expeditions used to be listed underneath the open ones. A
       list of things you are doing should not be mostly things you have
       already done — they are on the field tab, with the rest of the record. */
  }

  function expCard(x, run) {
    const def = x.def;
    const card = U.el('div', 'exp' + (x.started && !x.done ? ' running' : ''));
    const head = U.el('div', 'exp-head');
    head.appendChild(U.el('span', 'exp-name', def.name));
    head.appendChild(U.el('span', 'exp-stage',
      x.done ? 'done' : x.started ? 'leg ' + (x.leg + 1) + ' of ' + def.legs.length : 'ready'));
    card.appendChild(head);
    card.appendChild(U.el('div', 'exp-obj', def.objective));

    const legs = U.el('div', 'exp-legs');
    def.legs.forEach(function (_, i) {
      legs.appendChild(U.el('div', 'exp-leg' +
        (i < x.leg ? ' done' : i === x.leg && x.started && !x.done ? ' now' : '')));
    });
    card.appendChild(legs);

    if (x.started && !x.done && run && run.leg) {
      card.appendChild(U.el('div', 'exp-obj', run.leg.task));
      const w = run.leg.at ? VF.locations.get(run.leg.at).name : 'anywhere';
      card.appendChild(U.el('div', 'exp-where',
        w.toLowerCase() + (run.leg.hint ? ' · ' + run.leg.hint : '')));
    } else if (!x.started) {
      card.appendChild(U.el('div', 'exp-where', def.need));
      const btn = U.el('button', 'mod-buy', 'begin');
      btn.addEventListener('click', function () {
        if (VF.expedition.begin(def.id)) refresh('leads');
      });
      card.appendChild(btn);
    }
    return card;
  }

  /* The field notes: what has been met, and what it did. A creature that has
     escaped but never been landed is listed with what is known about it,
     which is the escape line and nothing else. */
  function fieldView(b) {
    const d = VF.state.data;
    const seen = VF.creatureData.list.filter(function (c) {
      return (d.creatures || {})[c.id];
    });
    if (!seen.length) {
      b.appendChild(U.el('div', 'empty',
        'nothing has happened to you yet that was not a fish.'));
      return;
    }
    const cc = VF.creatureData.counts();
    b.appendChild(U.el('div', 'panel-note',
      cc.caught + ' landed · ' + cc.met + ' met · ' + cc.total + ' out there'));
    seen.forEach(function (c) {
      const r = d.creatures[c.id];
      const card = U.el('div', 'exp' + (r.caught ? ' running' : ''));
      const head = U.el('div', 'exp-head');
      head.appendChild(U.el('span', 'exp-name', r.caught ? c.name : '???'));
      head.appendChild(U.el('span', 'exp-stage',
        r.caught ? 'landed ×' + r.caught : 'met ×' + r.met));
      card.appendChild(head);
      card.appendChild(U.el('div', 'exp-obj', r.caught ? c.journal : c.blurb));
      const f = U.el('div', 'exp-found');
      if (r.escaped) f.appendChild(U.el('span', 'exp-chip', 'got away ×' + r.escaped));
      if (c.on.locs.length && r.caught) {
        c.on.locs.forEach(function (l) {
          f.appendChild(U.el('span', 'exp-chip', VF.locations.get(l).name.toLowerCase()));
        });
      }
      if (f.childElementCount) card.appendChild(f);
      b.appendChild(card);
    });
  }

  function buildJournal(tab) {
    /* Saved state and old deep links can still name the tab that used to
       exist. It is the threads list now. Redirected here rather than in the
       body below, so nothing renders twice. */
    if (tab === 'leads') tab = 'quests';
    const d = VF.state.data;
    const p = shell('Journal', d.journal.length + ' entries · ' +
                    Object.keys(d.secrets).length + ' hidden places found');
    const qn = VF.quests.activeCount();
    const bn = VF.bounties.list().length;
    /* A lead, a creature and an expedition are all the same thing to the
       player — something written down that they have not finished — so they
       live in the journal rather than in panels of their own. */
    const leads = VF.discovery ? VF.discovery.open() : [];
    const ready = leads.filter(function (l) { return l.ready; }).length;
    const cc = VF.creatureData ? VF.creatureData.counts() : { met: 0, caught: 0 };
    /* This had seven tabs. Three of them — quests, leads, field — were three
       lists of the same sentence: a thing you are part way through and have
       not finished. A player looking for "what am I supposed to be doing"
       had to check three places and hold the difference between a quest, a
       lead and an expedition in their head, and the difference is an
       implementation detail of this codebase. They are one list now, in the
       order you would want them: what is ready, then what is open, then what
       is waiting on somebody. */
    const openN = qn + leads.length;
    p.appendChild(tabs([
      { id: 'quests', label: 'threads' + (ready ? ' •' : (openN ? ' ' + openN : '')) },
      { id: 'field', label: 'field' + (cc.met ? ' ' + cc.met : '') },
      { id: 'board', label: 'board' + (VF.bounties.anyReady() ? ' •' : (bn ? ' ' + bn : '')) },
      { id: 'entries', label: 'entries' },
      { id: 'people', label: 'people' + (VF.npcs.anyNew() ? ' •' : '') },
      { id: 'records', label: 'records' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'board') { b.appendChild(boardView()); p.appendChild(b); return p; }
    if (tab === 'field') { fieldView(b); p.appendChild(b); return p; }

    if (tab === 'quests') {
      const open = VF.quests.visible();
      /* Threads that have not opened, and what each is waiting for. Without
         this a quest becomes available in silence and the only way to find out
         is to go round talking to everybody again on the off chance. */
      const soon = VF.quests.locked();
      const said = VF.rumours ? VF.rumours.all().filter(function (r) { return !r.settled; }) : [];
      if (!open.length && !soon.length && !leads.length && !said.length) {
        b.appendChild(U.el('div', 'empty',
          'nothing is asking anything of you yet. keep fishing, and talk to people.'));
      } else {
        open.forEach(function (v) { b.appendChild(questCard(v)); });
        if (leads.length) {
          if (open.length) b.appendChild(U.el('div', 'quest-sep', 'and these'));
          leadsView(b, leads);
        }
        saidView(b);
        if (soon.length) {
          const h = U.el('div', 'quest-sep',
                         (open.length || leads.length) ? 'not yet' : 'somebody has something to say');
          b.appendChild(h);
          soon.forEach(function (l) { b.appendChild(lockedCard(l)); });
        }
      }
    } else if (tab === 'entries') {
      if (!d.journal.length) {
        b.appendChild(U.el('div', 'empty', 'nothing written down yet. keep fishing.'));
      } else {
        d.journal.slice().reverse().forEach(function (e) {
          const el = U.el('div', 'entry' + (e.hint ? ' hint' : ''));
          const head = U.el('div');
          head.appendChild(U.el('span', 'entry-title', e.title));
          head.appendChild(U.el('span', 'entry-kind', e.kind));
          el.appendChild(head);
          el.appendChild(U.el('div', 'entry-text', e.text));
          b.appendChild(el);
        });
      }
    } else if (tab === 'people') {
      VF.npcs.list.forEach(function (n) {
        const known = VF.npcs.unlocked(n.id);
        const el = U.el('div', 'npc-row' + (known ? '' : ' locked'));
        const mark = U.el('div', 'npc-mark');
        mark.style.background = known ? n.color : 'var(--line-2)';
        el.appendChild(mark);
        const main = U.el('div');
        const nm = U.el('div', 'npc-name', known ? n.name : '?????');
        main.appendChild(nm);
        main.appendChild(U.el('div', 'npc-where', known ? n.where : 'you have not run into them yet'));
        if (known) main.appendChild(U.el('div', 'npc-blurb', n.blurb));
        el.appendChild(main);
        const side = U.el('div', 'row-side');
        if (known) {
          if (VF.npcs.hasNew(n.id)) side.appendChild(U.el('div', 'npc-new', 'has something to say'));
          const btn = U.el('button', 'btn btn-sm' + (VF.npcs.hasNew(n.id) ? ' btn-primary' : ''),
                           'go and see them');
          btn.addEventListener('click', function () { speak(n.id); });
          side.appendChild(btn);
        }
        el.appendChild(side);
        b.appendChild(el);
      });
    } else {
      const R = d.records;
      const grid = U.el('div', 'stats-grid');
      function nameOf(id, traits) {
        const f = VF.fish.byId(id);
        if (!f) return '—';
        return VF.traits.title(traits, f.name);
      }
      const tiles = [
        ['biggest fish', R.biggestKg ? U.weight(R.biggestKg) : '—', nameOf(R.biggestId, R.biggestTraits)],
        ['most valuable', R.richest ? '◈ ' + U.money(R.richest) : '—', nameOf(R.richestId, R.richestTraits)],
        ['rarest combination', R.bestComboTraits && R.bestComboTraits.length
          ? R.bestComboTraits.length + ' traits' : '—', nameOf(R.bestComboId, R.bestComboTraits)],
        ['longest specimen', R.longestSpecies ? U.length(R.longestSpecies) : '—', nameOf(R.longestId)],
        ['longest streak', U.commas(R.bestStreak), 'landed without a loss'],
        ['current streak', U.commas(d.streak), d.streak ? 'still going' : 'start again']
      ];
      tiles.forEach(function (t) {
        const tile = U.el('div', 'stat-tile');
        tile.appendChild(U.el('span', 'k', t[0]));
        tile.appendChild(U.el('div', 'v', t[1]));
        if (t[2]) tile.appendChild(U.el('div', 'sub', t[2]));
        grid.appendChild(tile);
      });
      b.appendChild(grid);

      const th = U.el('div');
      th.style.marginTop = '18px';
      th.appendChild(U.el('span', 'k', 'traits recorded'));
      const tg = U.el('div', 'cos-grid');
      tg.style.marginTop = '10px';
      VF.traits.list.forEach(function (tr) {
        const n = d.traitsSeen[tr.id] | 0;
        const cell = U.el('div', 'cos-cell' + (n ? '' : ' locked'));
        cell.style.cursor = 'default';
        const pip = U.el('div', 'cos-pip');
        pip.style.background = tr.color;
        cell.appendChild(pip);
        const nm = U.el('div', 'cos-name', n ? tr.name : '?????');
        nm.style.marginTop = '2px';
        cell.appendChild(nm);
        cell.appendChild(U.el('div', 'cos-slot', n ? '×' + U.commas(n) + ' · value ×' + tr.mult : 'not yet'));
        if (n) cell.title = tr.desc;
        tg.appendChild(cell);
      });
      th.appendChild(tg);
      b.appendChild(th);
    }
    p.appendChild(b);
    return p;
  }

  /* A thread that has not opened: who is carrying it, what it is about, and
     the list of what is still missing with how far along each one is. The list
     is the quest's own — the same one the engine tests — so it cannot say one
     thing and require another. */
  function lockedCard(l) {
    const def = l.def;
    const card = U.el('div', 'quest locked' + (l.ready ? ' ready' : ''));

    const head = U.el('div', 'quest-head');
    head.appendChild(U.el('span', 'quest-name', l.ready ? def.name : '?????'));
    if (def.difficulty) {
      const t = U.el('span', 'quest-tag', def.difficulty);
      t.style.color = 'var(--ink-4)';
      head.appendChild(t);
    }
    head.appendChild(U.el('span', 'quest-of',
      l.ready ? 'go and see ' + VF.npcs.name(def.giver).toLowerCase()
              : VF.npcs.name(def.giver).toLowerCase()));
    card.appendChild(head);
    card.appendChild(U.el('div', 'quest-blurb', l.ready ? def.blurb : (def.rumour || def.blurb)));

    if (l.ready) {
      card.appendChild(U.el('div', 'quest-where',
        VF.npcs.name(def.giver).toLowerCase() + ' is waiting to say it'));
      return card;
    }

    const list = U.el('div', 'quest-check');
    l.needs.forEach(function (n) {
      const row = U.el('div', 'quest-need' + (n.done ? ' done' : ''));
      row.appendChild(U.el('span', 'quest-box', n.done ? '✓' : ''));
      const main = U.el('div');
      main.appendChild(U.el('span', null, n.label));
      if (n.note) main.appendChild(U.el('div', 'quest-need-note', n.note));
      row.appendChild(main);
      if (n.need > 1) {
        row.appendChild(U.el('span', 'quest-need-at',
          U.commas(Math.min(n.have, n.need)) + ' / ' + U.commas(n.need)));
      }
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  /* One quest, and where in it the player currently is. Everything drawn here
     comes off the quest definition, so a second quest needs no new UI. */
  function questCard(v) {
    const def = v.def, q = v.q;
    const card = U.el('div', 'quest' + (v.done ? ' done' : '') + (def.id === 'heavens' ? ' gold' : ''));

    const head = U.el('div', 'quest-head');
    head.appendChild(U.el('span', 'quest-name', def.name));
    if (def.difficulty) {
      const t = U.el('span', 'quest-tag', def.difficulty);
      t.style.color = v.done ? 'var(--good)' : '#ffd88a';
      head.appendChild(t);
    }
    head.appendChild(U.el('span', 'quest-of', v.done ? 'complete'
      : 'chapter ' + (q.step + 1) + ' / ' + def.chapters.length));
    card.appendChild(head);
    card.appendChild(U.el('div', 'quest-blurb', def.blurb));

    if (v.done) {
      card.appendChild(U.el('div', 'quest-done-line', 'finished. it is in the journal.'));
      return card;
    }

    const o = VF.quests.objective(def.id);
    if (!o) return card;

    const ch = U.el('div', 'quest-ch');
    ch.appendChild(U.el('div', 'quest-ch-name', o.chapter.name));
    if (o.text) ch.appendChild(U.el('div', 'quest-text', o.text));
    ch.appendChild(U.el('div', 'quest-task', o.task));
    if (o.talk) {
      const who = VF.npcs.name(o.talk);
      const ready = VF.npcs.hasNew(o.talk);
      ch.appendChild(U.el('div', 'quest-where',
        ready ? who.toLowerCase() + ' is waiting to say it' : 'you need ' + who.toLowerCase() + ' first'));
    } else if (o.where) {
      ch.appendChild(U.el('div', 'quest-where', o.where));
    }

    if (o.goal) {
      const tr = U.el('div', 'quest-track');
      const fl = U.el('div', 'quest-fill');
      fl.style.width = Math.round(U.clamp(o.goal.have / Math.max(1, o.goal.need), 0, 1) * 100) + '%';
      tr.appendChild(fl);
      ch.appendChild(tr);
      ch.appendChild(U.el('div', 'quest-count', o.goal.have + ' / ' + o.goal.need + ' ' + o.goal.unit));
    }

    if (o.checklist && o.checklist.length) {
      const list = U.el('div', 'quest-list');
      o.checklist.forEach(function (it) {
        const row = U.el('div', 'quest-item' + (it.done ? ' on' : ''));
        row.appendChild(U.el('span', 'tick', it.done ? '\u2713' : '\u25cb'));
        row.appendChild(U.el('span', 'who', it.label));
        row.appendChild(U.el('span', 'want', it.done ? 'given' : it.task));
        list.appendChild(row);
      });
      ch.appendChild(list);
    }

    card.appendChild(ch);
    return card;
  }

  /* Talking is not a card any more — the panel closes and the two of you go
     and have the conversation out on the shore where it can be seen. */
  function speak(id) {
    if (!VF.visit.canVisit()) {
      VF.toast.show('reel in before you walk off', null, 2600);
      return;
    }
    close();
    // let the panel finish getting out of the way first
    setTimeout(function () { VF.visit.start(id); }, 190);
  }

  /* ------------------------------------------------------------- fishdex */

  /* Which waters the index can talk about: the ones the player has been to.
     A spot they have not found is not a gap in their record, it is a place
     that does not exist yet. */
  function dexWaters() {
    return VF.locations.list.filter(function (l) {
      return VF.state.data.seenLocations.indexOf(l.id) >= 0 ||
             VF.locations.isUnlocked(l.id);
    });
  }

  /* One water: what lives in it, what comes up out of it, and how much of both
     is in the record. The index is built around this now — a spot's roster is
     its own, and seeing them side by side is the point of having eight of them. */
  function waterCard(loc) {
    const d = VF.state.data;
    const here = d.location === loc.id;
    const fish = VF.fish.nativeTo(loc.id).filter(function (f) { return !f.hidden || d.fishdex[f.id]; });
    const home = fish.filter(function (f) { return f.locs[0] === loc.id; });
    const got = fish.filter(function (f) { return !!d.fishdex[f.id]; }).length;
    const objs = VF.treasureData.nativeTo(loc.id);
    const sig = objs.filter(function (t) { return t.locs && t.locs.length === 1; });
    const gotObj = objs.filter(function (t) { return (d.treasures[t.id] | 0) > 0; }).length;

    const card = U.el('div', 'water' + (here ? ' here' : ''));
    const head = U.el('div', 'water-head');
    const mark = U.el('div', 'water-mark');
    mark.style.background = loc.glow;
    head.appendChild(mark);
    const nm = U.el('div');
    const line = U.el('div', 'water-name');
    line.appendChild(U.el('span', null, loc.name));
    if (here) {
      const t = U.el('span', 'tag', 'here');
      t.style.color = 'var(--accent)';
      line.appendChild(t);
    }
    nm.appendChild(line);
    nm.appendChild(U.el('div', 'water-tag', loc.tag));
    head.appendChild(nm);
    head.appendChild(U.el('div', 'water-of', got + ' / ' + fish.length));
    card.appendChild(head);

    const track = U.el('div', 'water-track');
    const fill = U.el('div', 'water-fill');
    fill.style.width = (fish.length ? got / fish.length * 100 : 0).toFixed(1) + '%';
    fill.style.background = 'linear-gradient(90deg, ' +
      U.rgbToCss(U.shade(U.hexToRgb(loc.glow), -0.45)) + ', ' + loc.glow + ')';
    track.appendChild(fill);
    card.appendChild(track);

    /* The tier mix, which is most of what makes one water not another. */
    const pips = U.el('div', 'water-tiers');
    VF.rarities.visible().forEach(function (r) {
      const n = fish.filter(function (f) { return f.rarity === r.id; }).length;
      if (!n) return;
      const pip = U.el('span', 'water-tier');
      const dot = U.el('span', 'water-dot');
      dot.style.background = r.color;
      dot.style.boxShadow = '0 0 6px ' + U.rgbToCss(U.hexToRgb(r.glow), 0.6);
      pip.appendChild(dot);
      pip.appendChild(U.el('span', null, String(n)));
      pip.title = n + ' ' + r.name.toLowerCase();
      pips.appendChild(pip);
    });
    card.appendChild(pips);

    const foot = U.el('div', 'water-foot');
    foot.appendChild(U.el('span', null, home.length + ' live only here'));
    foot.appendChild(U.el('span', null, gotObj + ' / ' + objs.length + ' objects'));
    if (sig.length) {
      const s1 = sig[0];
      const has = (d.treasures[s1.id] | 0) > 0;
      const el = U.el('span', 'water-sig');
      el.appendChild(U.el('span', 'water-sig-k', 'only here'));
      const v = U.el('span', null, has ? s1.name : '?????');
      v.style.color = has ? s1.color : 'var(--ink-4)';
      el.appendChild(v);
      el.title = has ? s1.desc : 'one object comes up here and nowhere else';
      foot.appendChild(el);
    }
    card.appendChild(foot);

    const go = U.el('button', 'btn btn-sm', here ? 'Show its species' : 'Show its species');
    go.addEventListener('click', function () {
      dexTab = 'species'; dexLoc = loc.id; dexFilter = 'all';
      VF.audio.click(); refresh();
    });
    card.appendChild(go);
    return card;
  }

  function buildDex() {
    const d = VF.state.data;
    /* Species in a hidden tier are not in the total, not in the filter row and
       not in the grid until one has been caught — so the record never shows a
       gap the player has no way to explain. */
    const shown = VF.fish.knownList();
    const found = shown.filter(function (f) { return !!d.fishdex[f.id]; }).length;
    const p = shell('Fishdex', found + ' of ' + shown.length + ' species recorded');

    p.appendChild(tabs([
      { id: 'waters', label: 'waters' },
      { id: 'species', label: 'species' }
    ], dexTab, function (t) { dexTab = t; refresh(); }));

    const b = body();

    if (dexTab === 'waters') {
      const grid = U.el('div', 'water-grid');
      dexWaters().forEach(function (l) { grid.appendChild(waterCard(l)); });
      b.appendChild(grid);
      /* And the ones that are not from anywhere, which is its own fact about
         them rather than a hole in the record. */
      const odd = VF.fish.unplaced().filter(function (f) { return !f.hidden || d.fishdex[f.id]; });
      const oddGot = odd.filter(function (f) { return !!d.fishdex[f.id]; }).length;
      const note = U.el('div', 'water-odd');
      note.appendChild(U.el('div', 'water-odd-k', 'from no particular water'));
      note.appendChild(U.el('div', 'water-odd-v', oddGot + ' / ' + odd.length +
        ' — the wrong ones, and whatever a falling sky brings'));
      const oddGo = U.el('button', 'btn btn-sm', 'Show them');
      oddGo.addEventListener('click', function () {
        dexTab = 'species'; dexLoc = 'none'; dexFilter = 'all';
        VF.audio.click(); refresh();
      });
      note.appendChild(oddGo);
      b.appendChild(note);
      p.appendChild(b);
      return p;
    }

    const bar = U.el('div', 'dex-toolbar');

    /* Which water's roster is on screen. This is the spine of the index now:
       a spot's species are its own, and browsing all four hundred at once was
       the only way to look at them. */
    const segL = U.el('div', 'seg');
    [{ id: 'all', label: 'Everywhere' }].concat(dexWaters().map(function (l) {
      return { id: l.id, label: l.name.replace(/^The /, '') };
    })).concat([{ id: 'none', label: 'Nowhere' }]).forEach(function (o) {
      const btn = U.el('button', dexLoc === o.id ? 'active' : '', o.label);
      btn.addEventListener('click', function () { dexLoc = o.id; VF.audio.click(); refresh(); });
      segL.appendChild(btn);
    });
    bar.appendChild(segL);
    const segR = U.el('div', 'seg');
    [{ id: 'all', label: 'All' }].concat(VF.rarities.visible().map(function (r) {
      return { id: r.id, label: r.name };
    })).forEach(function (o) {
      const btn = U.el('button', dexFilter === o.id ? 'active' : '', o.label);
      if (o.id !== 'all') {
        const col = VF.rarities.color(o.id);
        btn.style.color = dexFilter === o.id ? col : '';
        const dot = U.el('span');
        dot.style.cssText = 'display:inline-block;width:5px;height:5px;border-radius:50%;' +
          'margin-right:6px;vertical-align:middle;background:' + col +
          ';box-shadow:0 0 6px ' + U.rgbToCss(U.hexToRgb(VF.rarities.get(o.id).glow), 0.6);
        // the one tier whose dot cannot be a hex
        if (VF.rarities.rainbow(o.id)) {
          dot.classList.add('bow-bg');
          if (dexFilter === o.id) btn.classList.add('bow-fg');
        }
        btn.insertBefore(dot, btn.firstChild);
      }
      btn.addEventListener('click', function () { dexFilter = o.id; VF.audio.click(); refresh(); });
      segR.appendChild(btn);
    });
    bar.appendChild(segR);

    const segM = U.el('div', 'seg');
    [{ id: 'all', label: 'Every' }, { id: 'found', label: 'Found' }, { id: 'missing', label: 'Missing' }].forEach(function (o) {
      const btn = U.el('button', dexMode === o.id ? 'active' : '', o.label);
      btn.addEventListener('click', function () { dexMode = o.id; VF.audio.click(); refresh(); });
      segM.appendChild(btn);
    });
    bar.appendChild(segM);
    b.appendChild(bar);

    const list = shown.filter(function (f) {
      if (dexLoc === 'none' && f.locs.length) return false;
      if (dexLoc !== 'all' && dexLoc !== 'none' && f.locs.indexOf(dexLoc) < 0) return false;
      if (dexFilter !== 'all' && f.rarity !== dexFilter) return false;
      const has = !!d.fishdex[f.id];
      if (dexMode === 'found' && !has) return false;
      if (dexMode === 'missing' && has) return false;
      return true;
    });
    /* Home water first, so a spot's own species lead and the ones that merely
       range in from next door follow. */
    if (dexLoc !== 'all' && dexLoc !== 'none') {
      list.sort(function (a, b) {
        return (a.locs[0] === dexLoc ? 0 : 1) - (b.locs[0] === dexLoc ? 0 : 1);
      });
    }

    const cnt = U.el('div', 'dex-count', list.length + ' shown');
    bar.appendChild(cnt);

    if (!list.length) { b.appendChild(U.el('div', 'empty', 'Nothing here yet.')); p.appendChild(b); return p; }

    /* Read once for the whole grid rather than per cell — it is the same
       answer for every one of them, and there can be four hundred. */
    const share = VF.loot.tierShare();
    const THIN = 0.02;

    const grid = U.el('div', 'dex-grid');
    list.forEach(function (f, i) {
      const entry = d.fishdex[f.id];
      const has = !!entry;
      const cell = U.el('div', 'dex-cell' + (has ? '' : ' undiscovered'));
      const r = VF.rarities.get(f.rarity);

      const idx = U.el('div', 'dex-n', '#' + String(VF.fish.list.indexOf(f) + 1).padStart(2, '0'));
      cell.appendChild(idx);
      const pip = U.el('div', 'dex-pip');
      pip.style.background = has ? r.color : 'var(--line-2)';
      if (has) pip.style.boxShadow = '0 0 8px ' + U.rgbToCss(U.hexToRgb(r.glow), 0.7);
      cell.appendChild(pip);

      const cv = U.el('canvas', 'dex-art');
      cv.width = 240; cv.height = 132;
      const g = cv.getContext('2d');
      g.save(); g.translate(120, 66);
      const sz = VF.fishArt.fitSize(f, 118, false);
      if (has) VF.fishArt.draw(g, f, sz, { time: i * 0.7 });
      else { g.globalAlpha = 0.34; VF.fishArt.drawSilhouette(g, f, sz, 0.85); }
      g.restore();
      cell.appendChild(cv);

      cell.appendChild(U.el('div', 'dex-name', has ? f.name : '?????'));
      const nTraits = has ? Object.keys(entry.traits || {}).length : 0;
      cell.appendChild(U.el('div', 'dex-rec', has
        ? (entry.record ? U.weight(entry.record.kg) + ' · ×' + entry.caught +
            (nTraits ? ' · ' + nTraits + 't' : '') : '×' + entry.caught)
        : r.name));

      /* Why a gap is a gap. A tier the current loadout has all but stopped
         drawing is the commonest reason a species stays missing, and the game
         never said so — the fix is to fish down, and nothing pointed at it. */
      if (!has && share[f.rarity] !== undefined && share[f.rarity] < THIN) {
        const w = U.el('div', 'dex-thin',
          share[f.rarity] < THIN * 0.1 ? 'your gear has stopped finding these'
                                       : 'rare on this loadout');
        cell.appendChild(w);
      }

      if (has) {
        cell.addEventListener('click', function () { VF.audio.click(); showDexDetail(f, entry); });
      }
      grid.appendChild(cell);
    });
    b.appendChild(grid);
    p.appendChild(b);
    return p;
  }

  function showDexDetail(f, entry) {
    const r = VF.rarities.get(f.rarity);
    const card = U.el('div', 'catch-card');
    const ban = U.el('div', 'catch-banner', r.name);
    ban.style.background = r.color;
    card.appendChild(ban);

    const hero = U.el('div', 'catch-hero');
    hero.style.background = 'radial-gradient(ellipse at 50% 55%, ' + U.rgbToCss(U.hexToRgb(r.glow), 0.14) + ', rgba(0,0,0,0) 68%)';
    const cv = U.el('canvas');
    cv.width = 400; cv.height = 168;
    cv.style.width = '100%'; cv.style.height = '168px';
    const g = cv.getContext('2d');
    g.save(); g.translate(200, 84);
    // objects are boxier than any fish, so the hero has to be fitted, not fixed
    VF.fishArt.draw(g, f, Math.min(62, VF.fishArt.fitSize(f, cv.height, false)),
                    { time: 1.2, mutation: entry.record ? entry.record.mutation : null });
    g.restore();
    hero.appendChild(cv);
    card.appendChild(hero);

    const bd = U.el('div', 'catch-body');
    bd.appendChild(U.el('h2', 'catch-name', f.name));
    bd.appendChild(U.el('p', 'catch-desc', f.desc));

    /* And what catching it repeatedly taught you. Only for the species that
       have any written — the record does not promise a paragraph it does not
       have, and a locked line for four hundred species that will never fill
       is worse than no line at all. */
    if (VF.lore.has(f.id)) {
      const caught = entry.caught | 0;
      VF.lore.unlocked(f.id, caught).forEach(function (l) {
        const para = U.el('p', 'catch-desc lore');
        const tag = U.el('span', 'lore-at', '×' + l.at);
        para.appendChild(tag);
        para.appendChild(document.createTextNode(l.text));
        bd.appendChild(para);
      });
      const nxt = VF.lore.next(f.id, caught);
      if (nxt) {
        bd.appendChild(U.el('p', 'lore-soon',
          'something else at ' + nxt + ' — ' + caught + ' so far'));
      }
    }

    const m = U.el('div', 'catch-metrics');
    m.appendChild(metricEl('Record', entry.record ? U.weight(entry.record.kg) : '—'));
    m.appendChild(metricEl('Caught', U.commas(entry.caught)));
    m.appendChild(metricEl('Base value', '◈ ' + U.money(f.value)));
    bd.appendChild(m);

    const where = f.locs.length ? f.locs.map(function (l) { return VF.locations.get(l).name; }).join(' · ') : 'anywhere at all';
    const baits = f.baits.length ? f.baits.map(function (x) { return VF.bait.get(x).name; }).join(', ') : 'anything';
    const meta = U.el('div');
    meta.style.cssText = 'font-size:11.5px;line-height:1.7;color:var(--ink-3);margin-bottom:14px';
    meta.appendChild(kv('Found at', where));
    meta.appendChild(kv('Prefers', baits));
    if (f.time.length) meta.appendChild(kv('Active', f.time.join(', ')));
    if (f.weather.length) meta.appendChild(kv('Weather', f.weather.map(function (w) { return VF.weatherData.get(w).name; }).join(', ')));
    bd.appendChild(meta);

    /* every trait, with the ones seen on this species filled in */
    const tw = U.el('div');
    tw.appendChild(U.el('span', 'k', 'traits recorded on this species'));
    const trow = U.el('div', 'trait-row');
    trow.style.marginTop = '8px';
    const seen = entry.traits || {};
    VF.traits.list.forEach(function (tr) {
      const n = seen[tr.id] | 0;
      const chip = U.el('span', 'trait-chip', n ? tr.name + ' ×' + n : '?????');
      chip.style.color = n ? tr.color : 'var(--ink-4)';
      chip.style.borderColor = n ? U.rgbToCss(U.hexToRgb(tr.color), 0.42) : 'var(--line)';
      if (n) chip.title = tr.desc;
      trow.appendChild(chip);
    });
    tw.appendChild(trow);
    bd.appendChild(tw);

    const acts = U.el('div', 'catch-actions');
    acts.style.gridTemplateColumns = '1fr';
    const back = U.el('button', 'btn btn-primary', 'Back');
    back.addEventListener('click', function () { VF.audio.back(); refresh(); });
    acts.appendChild(back);
    bd.appendChild(acts);
    card.appendChild(bd);

    const prev = node;
    node = card;
    if (prev && prev.parentNode) prev.parentNode.replaceChild(card, prev);
  }

  function metricEl(k, v) {
    const el = U.el('div', 'metric');
    el.appendChild(U.el('span', 'k', k));
    el.appendChild(U.el('span', 'v', v));
    return el;
  }
  function kv(k, v) {
    const row = U.el('div');
    const kk = U.el('span', 'k', k + ' ');
    kk.style.marginRight = '6px';
    row.appendChild(kk);
    row.appendChild(document.createTextNode(v));
    return row;
  }

  /* ----------------------------------------------------------------- bag */

  /* One catch per mount, drawn at the size it was, with what it weighed and
     what it was carrying on the plate. The wall is where a fish stops being
     inventory. */
  function wallView() {
    const d = VF.state.data;
    const wrap = U.el('div');
    const n = VF.wall.mounts();
    const up = VF.wall.list();

    const head = U.el('div', 'wall-head');
    head.appendChild(U.el('span', null, up.length + ' of ' + n + ' mounted'));
    if (VF.wall.nextAt()) {
      head.appendChild(U.el('span', 'wall-next', 'another at level ' + VF.wall.nextAt()));
    }
    if (up.length) head.appendChild(U.el('span', 'wall-worth', '◇ ' + U.money(VF.wall.value())));
    wrap.appendChild(head);

    const grid = U.el('div', 'wall-grid');
    for (let i = 0; i < n; i++) {
      const k = up[i];
      const cell = U.el('div', 'mount' + (k ? '' : ' bare'));
      if (!k) {
        cell.appendChild(U.el('div', 'mount-empty', 'empty'));
        grid.appendChild(cell);
        continue;
      }
      const f = VF.fish.byId(k.id);
      const r = VF.rarities.get((f && f.rarity) || k.rarity || 'common');

      const cv = U.el('canvas', 'mount-art');
      cv.width = 320; cv.height = 150;
      const g = cv.getContext('2d');
      g.save(); g.translate(160, 72);
      if (f) VF.fishArt.draw(g, f, VF.fishArt.fitSize(f, 150, false), { time: i * 0.9, traits: k.traits || [] });
      g.restore();
      cell.appendChild(cv);

      const plate = U.el('div', 'mount-plate');
      const nm = U.el('div', 'mount-name', f ? f.name : k.id);
      nm.style.color = r.color;
      plate.appendChild(nm);
      plate.appendChild(U.el('div', 'mount-kg', U.weight(k.kg) + ' · ' + U.length(k.m)));
      const tr = (k.traits || []).map(function (t) { return VF.traits.get(t); }).filter(Boolean);
      if (tr.length) {
        const row = U.el('div', 'mount-traits');
        tr.forEach(function (t) {
          const chip = U.el('span', 'mount-trait', t.name.toLowerCase());
          chip.style.color = t.color;
          chip.style.borderColor = U.rgbToCss(U.hexToRgb(t.color), 0.45);
          row.appendChild(chip);
        });
        plate.appendChild(row);
      }
      plate.appendChild(U.el('div', 'mount-where',
        (VF.locations.get(k.location) || {}).name || ''));
      cell.appendChild(plate);

      const acts = U.el('div', 'mount-acts');
      const down = U.el('button', 'btn btn-sm', 'Take down');
      down.addEventListener('click', function () {
        VF.audio.click();
        if (!VF.wall.unmount(i)) VF.toast.plain('the bag is full', 'warn', 2200);
        refresh('wall');
      });
      acts.appendChild(down);
      if (!VF.runs || VF.runs.sellAllowed()) {
        const sellIt = U.el('button', 'btn btn-sm', 'Sell ◇ ' + U.money(k.value));
        sellIt.addEventListener('click', function () {
          VF.wall.sell(i);
          refresh('wall');
        });
        acts.appendChild(sellIt);
      }
      cell.appendChild(acts);
      grid.appendChild(cell);
    }
    wrap.appendChild(grid);

    /* And what is in the bag that could go up there. */
    if (!VF.wall.full() && d.kept.length) {
      wrap.appendChild(U.el('div', 'wall-sub', 'in the bag'));
      const pick = U.el('div', 'wall-pick');
      d.kept.slice().reverse().slice(0, 24).forEach(function (k) {
        const realIndex = d.kept.indexOf(k);
        const f = VF.fish.byId(k.id);
        const btn = U.el('button', 'wall-pick-row');
        btn.appendChild(U.el('span', 'wall-pick-name', f ? f.name : k.id));
        btn.appendChild(U.el('span', 'wall-pick-kg', U.weight(k.kg)));
        btn.addEventListener('click', function () {
          VF.audio.click();
          VF.wall.mount(realIndex);
          refresh('wall');
        });
        pick.appendChild(btn);
      });
      wrap.appendChild(pick);
    } else if (VF.wall.full()) {
      wrap.appendChild(U.el('div', 'wall-sub', 'the wall is full. take one down to put another up.'));
    } else {
      wrap.appendChild(U.el('div', 'wall-sub', 'nothing kept. keep a catch and it can go up here.'));
    }
    return wrap;
  }

  /* What the objects are for. It lives on the salvage tab because that is
     where the objects already are — a separate crafting screen would be a
     second place to look for the same tally. */
  function makeList() {
    const wrap = U.el('div', 'make');
    wrap.appendChild(U.el('div', 'make-k', 'some of it goes together'));

    const list = U.el('div', 'make-list');
    VF.recipes.list.forEach(function (r) {
      const can = VF.recipes.canMake(r);
      const row = U.el('div', 'make-row' + (can ? ' can' : ''));

      const main = U.el('div', 'make-main');
      const head = U.el('div', 'make-name');
      head.appendChild(U.el('span', null, r.name));
      const gv = U.el('span', 'make-gives', VF.recipes.reward(r));
      head.appendChild(gv);
      main.appendChild(head);
      main.appendChild(U.el('div', 'make-desc', r.desc));

      const need = U.el('div', 'make-need');
      for (const k in r.need) {
        const t = VF.treasureData.get(k);
        const have = VF.recipes.have(k);
        const want = r.need[k];
        const chip = U.el('span', 'make-chip' + (have >= want ? ' ok' : ''));
        chip.textContent = (t ? t.name.toLowerCase() : k) + ' ' + Math.min(have, want) + '/' + want;
        need.appendChild(chip);
      }
      main.appendChild(need);
      row.appendChild(main);

      const acts = U.el('div', 'make-acts');
      if (can) {
        const go = U.el('button', 'btn btn-sm btn-primary', 'Make');
        go.addEventListener('click', function () {
          const made = VF.recipes.make(r.id);
          if (made) {
            VF.audio.discover();
            VF.toast.plain(VF.recipes.reward(made).toLowerCase() + ' — made', 'good', 3000);
          }
          refresh('salvage');
        });
        acts.appendChild(go);
      } else {
        acts.appendChild(U.el('div', 'make-why', VF.recipes.blocked(r) || ''));
      }
      row.appendChild(acts);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function buildBag(tab) {
    const d = VF.state.data;
    const p = shell('Bag', 'What you are carrying');
    p.appendChild(tabs([
      { id: 'catches', label: 'catches (' + d.kept.length + ')' },
      { id: 'wall', label: 'wall (' + VF.wall.count() + '/' + VF.wall.mounts() + ')' },
      { id: 'rods', label: 'rods' },
      { id: 'bait', label: 'bait' },
      { id: 'charms', label: 'charms' },
      { id: 'salvage', label: 'salvage' + (VF.recipes.anyReady() ? ' •' : '') }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'wall') { b.appendChild(wallView()); p.appendChild(b); return p; }

    if (tab === 'charms') {
      b.appendChild(slotStrip());
      const owned = d.charms.map(function (id) { return VF.charms.get(id); }).filter(Boolean);
      if (!owned.length) {
        b.appendChild(U.el('div', 'empty', 'no charms yet. the shop sells some; the water gives up the rest.'));
      } else {
        const list = U.el('div', 'list');
        owned.forEach(function (c) {
          const eqd = VF.charms.isEquipped(c.id);
          const row = U.el('div', 'row row-rod' + (eqd ? ' equipped' : ' owned'));
          const mark = U.el('div', 'row-mark');
          VF.rarities.paint(mark, c.rarity, 'background');
          row.appendChild(mark);
          const iconBox = U.el('div', 'rod-art-box');
          iconBox.style.cssText = 'width:84px;flex:0 0 84px;display:grid;place-items:center';
          iconBox.appendChild(charmIcon(c, 56));
          row.appendChild(iconBox);
          const main = U.el('div', 'row-main');
          const nm = U.el('div', 'row-name');
          nm.appendChild(U.el('span', null, c.name));
          const kt = U.el('span', 'tag', c.kind);
          VF.rarities.paint(kt, c.rarity, 'color');
          nm.appendChild(kt);
          main.appendChild(nm);
          main.appendChild(U.el('div', 'row-desc', c.desc));
          const note = U.el('div', 'row-desc');
          note.style.color = 'var(--ink-2)';
          note.textContent = c.note;
          main.appendChild(note);
          main.appendChild(statLine(c));
          row.appendChild(main);
          const side = U.el('div', 'row-side');
          const btn = U.el('button', 'btn btn-sm' + (eqd ? '' : ' btn-primary'), eqd ? 'take off' : 'wear');
          btn.addEventListener('click', function () {
            if (eqd) VF.charms.unequip(d.charmSlots.indexOf(c.id));
            else VF.charms.equip(c.id);
            VF.audio.click(); VF.save.save(); refresh('charms');
          });
          side.appendChild(btn);
          row.appendChild(side);
          list.appendChild(row);
        });
        b.appendChild(list);
      }
    } else if (tab === 'salvage') {
      b.appendChild(makeList());
      const ids = Object.keys(d.treasures);
      if (!ids.length) {
        b.appendChild(U.el('div', 'empty', 'nothing but fish so far.'));
      } else {
        const grid = U.el('div', 'cos-grid');
        VF.treasureData.list.forEach(function (t) {
          const n = d.treasures[t.id] | 0;
          const cell = U.el('div', 'cos-cell' + (n ? '' : ' locked'));
          cell.style.cursor = 'default';
          const pip = U.el('div', 'cos-pip');
          VF.rarities.paint(pip, t.rarity, 'background');
          cell.appendChild(pip);
          const cv = U.el('canvas', 'cos-art');
          cv.width = 236; cv.height = 108;
          const g = cv.getContext('2d');
          g.scale(2, 2); g.translate(59, 27);
          if (!n) g.globalAlpha = 0.18;
          VF.treasureArt.draw(g, t, 22, 1.1);
          cell.appendChild(cv);
          cell.appendChild(U.el('div', 'cos-name', n ? t.name : '?????'));
          cell.appendChild(U.el('div', 'cos-slot', n ? '×' + n : VF.rarities.get(t.rarity).name));
          if (n) cell.title = t.desc;
          grid.appendChild(cell);
        });
        b.appendChild(grid);
      }
    } else if (tab === 'catches') {
      if (!d.kept.length) {
        b.appendChild(U.el('div', 'empty', 'Nothing kept. Choose "Keep" on a catch to store it here.'));
      } else {
        let total = 0;
        d.kept.forEach(function (k) { total += k.value; });
        const bar = U.el('div', 'dex-toolbar');
        const sellAll = U.el('button', 'btn btn-sm btn-primary', 'Sell everything · ◈ ' + U.money(total));
        sellAll.addEventListener('click', function () {
          const got = VF.catches.sellAllKept();
          if (got) VF.toast.show('Sold everything for <strong class="mono">' + U.money(got) + '</strong>', 'good');
          refresh('catches');
        });
        bar.appendChild(sellAll);
        b.appendChild(bar);

        const list = U.el('div', 'list');
        d.kept.slice().reverse().forEach(function (k, ri) {
          const idx = d.kept.length - 1 - ri;
          const f = VF.fish.byId(k.id);
          if (!f) return;
          const r = VF.rarities.get(f.rarity);
          const kTraits = k.traits || (k.mutation ? [k.mutation] : []);
          const row = U.el('div', 'row');
          const mark = U.el('div', 'row-mark');
          mark.style.background = r.color;
          row.appendChild(mark);
          const main = U.el('div', 'row-main');
          const name = U.el('div', 'row-name');
          name.appendChild(U.el('span', null, VF.traits.title(kTraits, f.name)));
          const tg = U.el('span', 'tag', r.name); tg.style.color = r.color; name.appendChild(tg);
          kTraits.forEach(function (tid) {
            const tr = VF.traits.get(tid);
            if (!tr) return;
            const mt = U.el('span', 'tag', tr.name);
            mt.style.color = tr.color;
            name.appendChild(mt);
          });
          main.appendChild(name);
          main.appendChild(U.el('div', 'row-desc',
            U.weight(k.kg) + ' · ' + U.length(k.m) + ' · ' + U.ordinalPercentile(k.pct) +
            ' · from ' + VF.locations.get(k.location).name));
          row.appendChild(main);
          const side = U.el('div', 'row-side');
          side.appendChild(priceEl(k.value, true));
          const btn = U.el('button', 'btn btn-sm', 'Sell');
          btn.addEventListener('click', function () {
            const got = VF.catches.sellKept(idx);
            if (got) VF.toast.show('Sold for <strong class="mono">' + U.money(got) + '</strong>', 'good', 2200);
            refresh('catches');
          });
          side.appendChild(btn);
          row.appendChild(side);
          list.appendChild(row);
        });
        b.appendChild(list);
      }
    } else if (tab === 'rods') {
      const list = U.el('div', 'list');
      d.ownedRods.map(function (id) { return VF.rods.get(id); })
        .sort(function (a, c) { return VF.rods.index(a.id) - VF.rods.index(c.id); })
        .forEach(function (rod) {
          const row = U.el('div', 'row row-rod' + (d.rod === rod.id ? ' equipped' : ' owned'));
          const mark = U.el('div', 'row-mark');
          mark.style.background = rod.art.tip;
          row.appendChild(mark);
          const artBox = U.el('div', 'rod-art-box');
          artBox.appendChild(rodPreview(rod, VF.rods.index(rod.id), false));
          row.appendChild(artBox);
          const main = U.el('div', 'row-main');
          const name = U.el('div', 'row-name');
          name.appendChild(U.el('span', null, rod.name));
          if (d.rod === rod.id) { const t = U.el('span', 'tag', 'equipped'); t.style.color = 'var(--accent)'; name.appendChild(t); }
          main.appendChild(name);
          main.appendChild(U.el('div', 'row-desc', rod.desc));
          const grid = U.el('div', 'stat-grid');
          grid.appendChild(statCell('Cast', rod.cast.toFixed(2), 0));
          grid.appendChild(statCell('Reel', rod.reel.toFixed(2), 0));
          grid.appendChild(statCell('Line', rod.line.toFixed(2), 0));
          grid.appendChild(statCell('Rare', '×' + rod.rare.toFixed(2), 0));
          grid.appendChild(statCell('Luck', '+' + rod.luck.toFixed(2), 0));
          main.appendChild(grid);
          row.appendChild(main);
          const side = U.el('div', 'row-side');
          if (d.rod !== rod.id) {
            side.appendChild(equipButton(rod, function () { refresh('rods'); }, ' btn-primary'));
          }
          row.appendChild(side);
          list.appendChild(row);
        });
      b.appendChild(list);
    } else {
      const list = U.el('div', 'list');
      VF.bait.available().forEach(function (bt) {
        const have = VF.bait.count(bt.id);
        if (!bt.unlimited && have <= 0) return;
        const row = U.el('div', 'row' + (d.bait === bt.id ? ' equipped' : ''));
        const mark = U.el('div', 'row-mark');
        mark.style.background = bt.color;
        row.appendChild(mark);
        const main = U.el('div', 'row-main');
        const name = U.el('div', 'row-name');
        name.appendChild(U.el('span', null, bt.name));
        if (d.bait === bt.id) { const t = U.el('span', 'tag', 'equipped'); t.style.color = 'var(--accent)'; name.appendChild(t); }
        main.appendChild(name);
        main.appendChild(U.el('div', 'row-desc', bt.desc));
        row.appendChild(main);
        const side = U.el('div', 'row-side');
        side.appendChild(U.el('div', 'row-price', have === Infinity ? '∞' : U.commas(have) + ' left'));
        if (d.bait !== bt.id) {
          const btn = U.el('button', 'btn btn-sm btn-primary', 'Use');
          btn.addEventListener('click', function () {
            d.bait = bt.id; VF.audio.click(); VF.bus.emit('bait:changed'); VF.save.save(); refresh('bait');
          });
          side.appendChild(btn);
        }
        row.appendChild(side);
        list.appendChild(row);
      });
      if (!list.children.length) b.appendChild(U.el('div', 'empty', 'No bait. Worms are always free in the shop.'));
      else b.appendChild(list);
    }

    p.appendChild(b);
    return p;
  }

  /* --------------------------------------------------------------- stats */

  function buildStats(tab) {
    const d = VF.state.data, s = d.stats;
    const done = VF.achievements.unlockedCount();
    const p = shell('Record', 'A quiet accounting');
    p.appendChild(tabs([
      { id: 'stats', label: 'Statistics' },
      { id: 'ach', label: 'Achievements (' + done + '/' + VF.achievementData.list.length + ')' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'stats') {
      const grid = U.el('div', 'stats-grid');
      const big = VF.fish.byId(s.biggestFish);
      const rare = VF.fish.byId(s.rarestFish);
      const tiles = [
        ['Fish landed', U.commas(s.catches), U.commas(s.casts) + ' casts'],
        (d.level >= VF.progression.MAX_LEVEL
          ? ['Fathoms', U.commas(d.fathoms | 0),
             U.commas(d.fathomXp | 0) + ' / ' + U.commas(VF.progression.FATHOM_XP) + ' to the next']
          : ['Level', String(d.level), U.commas(d.xp) + ' / ' + U.commas(VF.progression.xpToNext())]),
        ['Discovered', Object.keys(d.fishdex).length + ' / ' + VF.fish.count, 'species'],
        ['Biggest catch', s.biggestKg ? U.weight(s.biggestKg) : '—', big ? big.name : ''],
        ['Rarest catch', rare ? VF.rarities.get(rare.rarity).name : '—', rare ? rare.name : ''],
        ['Total earned', '◈ ' + U.money(s.earned), '◈ ' + U.money(s.spent) + ' spent'],
        ['Fish sold', U.commas(s.sold), U.commas(s.released) + ' released'],
        ['Legendary+', U.commas(s.legendaryCatches), U.commas(s.voidCatches) + ' void'],
        /* The two rarest tiers were counted and never shown anywhere. A tier
           you can catch and cannot see the count of may as well not be kept. */
        ['!@#$%^&$#', U.commas(s.glitchCatches | 0),
         (s.unknownCatches | 0) ? U.commas(s.unknownCatches | 0) + ' of the other thing' : 'and one tier above it'],
        ['Mutations', U.commas(s.mutationsFound), U.commas(s.recordsBroken) + ' records broken'],
        ['Escapes', U.commas(s.escapes), U.commas(s.linesSnapped) + ' lines snapped'],
        ['Clean fights', U.commas(s.perfectReels), 'never in the red'],
        ['Second chances', U.commas(s.secondChances | 0), 'the rod would not have it'],
        ['Encounters', U.commas(s.encounters), 'something below'],
        /* Reputation stops paying into luck at 480 and nothing said so, which
           made releasing quietly worthless from a point nobody could see. */
        ['Reputation', U.commas(d.reputation),
         d.reputation >= VF.progression.REP_FULL ? 'the water knows you'
           : Math.round(d.reputation / VF.progression.REP_FULL * 100) + '% of what it is worth'],
        ['Time at the water', U.duration(s.playSeconds), 'longest run ' + U.commas(d.records.bestStreak | 0)]
      ];
      tiles.forEach(function (t) {
        const tile = U.el('div', 'stat-tile');
        tile.appendChild(U.el('span', 'k', t[0]));
        tile.appendChild(U.el('div', 'v', t[1]));
        if (t[2]) tile.appendChild(U.el('div', 'sub', t[2]));
        grid.appendChild(tile);
      });
      b.appendChild(grid);
    } else {
      const grid = U.el('div', 'ach-grid');
      VF.achievementData.list.forEach(function (a) {
        const got = !!d.achievements[a.id];
        const hidden = a.hidden && !got;
        const el = U.el('div', 'ach ' + (got ? 'done' : 'locked'));
        el.appendChild(U.el('div', 'ach-mark'));
        const main = U.el('div');
        main.appendChild(U.el('div', 'ach-name', hidden ? '??????' : a.name));
        main.appendChild(U.el('div', 'ach-desc', hidden ? 'Hidden' : a.desc));
        /* How far along, for the ones that count something. Not for the
           hidden ones — a bar creeping toward a target nobody has been told
           about would give away that there is one, and the blankness is the
           effect. And not for the ones already earned. */
        /* A bar that reads 0 / 1 is a bar saying "no". Only worth drawing
           where there is a distance to show. */
        if (!got && !hidden && a.count && a.count[1] > 1) {
          let have = 0;
          try { have = a.count[0](d) || 0; } catch (e) { have = 0; }
          const target = a.count[1];
          const k = U.clamp(have / target, 0, 1);
          const bar = U.el('div', 'ach-prog');
          const fill = U.el('div', 'ach-prog-fill');
          fill.style.width = (k * 100).toFixed(1) + '%';
          bar.appendChild(fill);
          main.appendChild(bar);
          main.appendChild(U.el('div', 'ach-prog-n',
            U.commas(Math.min(Math.floor(have), target)) + ' / ' + U.commas(target)));
        }
        if (a.reward) main.appendChild(U.el('div', 'ach-reward', '◈ ' + U.money(a.reward)));
        el.appendChild(main);
        grid.appendChild(el);
      });
      b.appendChild(grid);
    }
    p.appendChild(b);
    return p;
  }

  /* ----------------------------------------------------------------- map */

  /* ------------------------------------------------------------------ chart

     A sounding rather than a list. Everywhere in this game is arranged by how
     far down it is — the ladder descends, the hidden water hangs off the side
     of it, and the two ends of the quest are the only things that break the
     pattern — so the map is one plumb line dropped through the whole world
     with every place hung off it at its own depth.

     The chart is a canvas because it animates (where you are standing pulses)
     and because the water column behind it is sampled from the real palette of
     each spot, which is a gradient rather than a stack of divs. render/mapArt
     draws and hit-tests; this decides what is on it. */

  let mapNodes = [];
  let mapSel = null;
  let mapRaf = 0;
  let mapGen = 0;   // the chart a running loop belongs to

  function stopMapLoop() {
    if (mapRaf) cancelAnimationFrame(mapRaf);
    mapRaf = 0;
    mapGen++;
    mapNodes = [];
  }

  function mapPlaces() {
    const d = VF.state.data;
    const out = [];
    let shownLocked = 0;
    VF.locations.list.forEach(function (loc) {
      const unlocked = VF.locations.isUnlocked(loc.id);
      const secret = VF.secrets.isSecretLoc(loc.id);
      // hidden water is not on the chart until it has been stood in
      if (secret && !unlocked) return;
      // and only the next rung down is teased, so the column keeps its bottom
      if (!unlocked) { shownLocked++; if (shownLocked > 1) return; }
      out.push({
        id: loc.id, name: loc.name, level: loc.level, glow: loc.glow,
        water: loc.water, unlocked: unlocked, secret: secret, loc: loc
      });
    });
    return out;
  }

  function buildMap() {
    const d = VF.state.data;
    const nFound = VF.secrets.countFound();
    const p = shell('The Chart', nFound
      ? 'deeper water, stranger catches · ' + nFound + ' hidden ' +
        (nFound === 1 ? 'place' : 'places') + ' found'
      : 'deeper water, stranger catches');
    p.classList.add('panel-map');

    const b = U.el('div', 'panel-body map-body');
    const wrap = U.el('div', 'map-wrap');

    const chart = U.el('div', 'map-chart');
    const cv = U.el('canvas', 'map-canvas');
    chart.appendChild(cv);
    wrap.appendChild(chart);

    const side = U.el('div', 'map-side scroll');
    wrap.appendChild(side);
    b.appendChild(wrap);
    p.appendChild(b);

    // stop the old loop before laying out the new chart — it clears the node
    // list, and a chart with no nodes is a gradient and nothing else
    stopMapLoop();
    const myGen = mapGen;

    const places = mapPlaces();
    if (!mapSel || !places.some(function (x) { return x.id === mapSel; })) mapSel = d.location;
    mapNodes = VF.mapArt.layout(places);

    function paintSide() {
      U.clear(side);
      /* The day is the same everywhere and for everybody, so it sits above the
         one place you happen to be looking at rather than inside it. */
      side.appendChild(dailyCard());
      const sel = places.filter(function (x) { return x.id === mapSel; })[0];
      if (!sel) { side.appendChild(U.el('div', 'empty', 'pick somewhere.')); return; }
      side.appendChild(spotCard(sel));
    }

    const t0 = performance.now();
    function sizeAndPaint() {
      /* The panel is built before it is appended, so the first frame runs on a
         canvas that is not in the document yet. Not being ready is a frame to
         skip, not a reason to stop — only stopMapLoop ends this. */
      if (!cv.isConnected) return;
      const r = chart.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(r.width), h = Math.round(r.height);
      if (cv.width !== w * dpr || cv.height !== h * dpr) {
        cv.width = w * dpr; cv.height = h * dpr;
        cv.style.width = w + 'px'; cv.style.height = h + 'px';
      }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      VF.mapArt.draw(g, w, h, mapNodes, {
        time: (performance.now() - t0) / 1000,
        selected: mapSel, current: d.location
      });
    }

    (function frame() {
      if (myGen !== mapGen) return;
      sizeAndPaint();
      mapRaf = requestAnimationFrame(frame);
    })();

    function pickAt(e) {
      const r = cv.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return VF.mapArt.hit(mapNodes, e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    }
    cv.addEventListener('click', function (e) {
      const nd = pickAt(e);
      if (!nd || nd.p.id === mapSel) return;
      mapSel = nd.p.id;
      VF.audio.click();
      paintSide();
    });
    cv.addEventListener('pointermove', function (e) {
      cv.style.cursor = pickAt(e) ? 'pointer' : 'default';
    });
    // the chart is a control, so it answers the keyboard too
    cv.tabIndex = 0;
    cv.setAttribute('role', 'listbox');
    cv.setAttribute('aria-label', 'Fishing spots, by depth');
    cv.addEventListener('keydown', function (e) {
      const open = mapNodes.filter(function (nd) { return nd.p.unlocked; });
      if (!open.length) return;
      let i = open.findIndex(function (nd) { return nd.p.id === mapSel; });
      if (e.code === 'ArrowDown' || e.code === 'ArrowRight') { i = Math.min(open.length - 1, i + 1); }
      else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') { i = Math.max(0, i - 1); }
      else if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        if (mapSel !== d.location) travel(mapSel);
        return;
      } else return;
      e.preventDefault();
      mapSel = open[i].p.id;
      VF.audio.hover();
      paintSide();
    });

    paintSide();
    return p;
  }

  /* Everything worth knowing about one place, including — new here — what
     actually lives in it and how much of it you have on record. */
  function spotCard(sel) {
    const d = VF.state.data;
    const loc = sel.loc;
    const card = U.el('div', 'spot');

    const head = U.el('div', 'spot-head');
    const mark = U.el('div', 'spot-mark');
    mark.style.background = loc.glow;
    mark.style.boxShadow = '0 0 12px ' + U.rgbToCss(U.hexToRgb(loc.glow), 0.65);
    head.appendChild(mark);
    const ht = U.el('div');
    ht.appendChild(U.el('div', 'spot-name', loc.name));
    ht.appendChild(U.el('div', 'spot-tag', loc.tag));
    head.appendChild(ht);
    card.appendChild(head);

    card.appendChild(U.el('p', 'spot-desc', loc.desc));

    /* What lives here. The list printed three multipliers and nothing about
       the fish, which made it a teleport menu rather than a choice. */
    const pool = poolFor(loc.id);
    if (pool.total) {
      const dex = U.el('div', 'spot-dex');
      const bar = U.el('div', 'spot-bar');
      const fill = U.el('div', 'spot-bar-fill');
      fill.style.width = Math.round(pool.have / pool.total * 100) + '%';
      fill.style.background = loc.glow;
      bar.appendChild(fill);
      dex.appendChild(bar);
      dex.appendChild(U.el('div', 'spot-dex-n',
        pool.have + ' of ' + pool.total + ' recorded here'));
      card.appendChild(dex);

      const tiers = U.el('div', 'spot-tiers');
      VF.rarities.visible().forEach(function (r) {
        const n = pool.byTier[r.id];
        if (!n) return;
        const chip = U.el('span', 'spot-tier');
        const dot = U.el('span', 'spot-dot');
        dot.style.background = r.color;
        chip.appendChild(dot);
        chip.appendChild(document.createTextNode(String(n)));
        chip.title = n + ' ' + r.name.toLowerCase() + ' species live here';
        tiers.appendChild(chip);
      });
      card.appendChild(tiers);
    }

    /* Anything currently pointing at this water. The chart is where a player
       decides where to go, so it is where a lead has to be readable. */
    const ptr = VF.discovery ? VF.discovery.forPlace(loc.id) : [];
    ptr.forEach(function (l) {
      const el = U.el('div', 'lead' + (l.ready ? ' ready' : ''));
      el.appendChild(U.el('div', 'lead-name', l.def.name));
      el.appendChild(U.el('div', 'lead-note', l.def.note));
      if (l.def.need) el.appendChild(U.el('div', 'lead-need', l.def.need));
      card.appendChild(el);
    });

    const meta = U.el('div', 'spot-meta');
    [['rarity', '×' + loc.rarityBoost.toFixed(2)],
     ['value', '×' + loc.valueBoost.toFixed(2)],
     ['xp', '×' + loc.xpBoost.toFixed(1)],
     ['bite', '×' + loc.biteBoost.toFixed(2)]].forEach(function (kv) {
      const c = U.el('div', 'spot-stat');
      c.appendChild(U.el('span', 'k', kv[0]));
      c.appendChild(U.el('span', 'v', kv[1]));
      meta.appendChild(c);
    });
    card.appendChild(meta);

    const sky = (loc.weather || []).map(function (w) { return VF.weatherData.get(w).name; }).join(' · ');
    if (sky) {
      const wl = U.el('div', 'spot-line');
      wl.appendChild(U.el('span', 'k', 'sky '));
      wl.appendChild(document.createTextNode(sky));
      card.appendChild(wl);
    }

    const acts = U.el('div', 'spot-actions');
    if (sel.id === d.location) {
      acts.appendChild(U.el('div', 'spot-here', 'you are here'));
      // the water can be paid to do something, but only where you are standing
      const ch = U.el('button', 'btn btn-sm', 'Charter the water');
      ch.addEventListener('click', function () { VF.audio.click(); open('shop', 'charter'); });
      acts.appendChild(ch);
    } else {
      const go = U.el('button', 'btn btn-primary', 'Travel');
      go.addEventListener('click', function () { travel(sel.id); });
      acts.appendChild(go);
    }
    card.appendChild(acts);
    return card;
  }

  /* Which species can actually turn up at a spot, and how many are on record.
     Native only — strays from one spot over are not what somebody asking
     "what lives here" means. */
  const spotPoolCache = Object.create(null);
  function poolFor(locId) {
    const d = VF.state.data;
    let cached = spotPoolCache[locId];
    if (!cached) {
      cached = spotPoolCache[locId] = VF.fish.knownList().filter(function (f) {
        return f.locs && f.locs.indexOf(locId) >= 0;
      });
    }
    const byTier = Object.create(null);
    let have = 0;
    for (let i = 0; i < cached.length; i++) {
      const f = cached[i];
      byTier[f.rarity] = (byTier[f.rarity] | 0) + 1;
      if (d.fishdex[f.id]) have++;
    }
    return { total: cached.length, have: have, byTier: byTier };
  }

  /* Nothing else in this game is shared between two people playing it. This
     is, and saying so is most of the point — the water itself is ordinary. */
  function dailyCard() {
    const t = VF.daily.today();
    const box = U.el('div', 'daily');
    box.appendChild(U.el('div', 'daily-k', 'today, everywhere'));
    box.appendChild(U.el('div', 'daily-v', VF.daily.line()));
    if (!VF.daily.unlocked()) {
      box.appendChild(U.el('div', 'daily-sub', 'you have not been there yet'));
      box.classList.add('locked');
    } else if (VF.daily.isHere()) {
      box.appendChild(U.el('div', 'daily-sub', 'you are standing in it'));
      box.classList.add('here');
    } else {
      const go = U.el('button', 'btn btn-sm', 'Go');
      go.addEventListener('click', function () { travel(t.loc.id); });
      box.appendChild(go);
    }
    return box;
  }

  function travel(id) {
    if (VF.runs && !VF.runs.travelAllowed(id)) {
      VF.toast.plain(VF.runs.why('travel'), 'warn', 3000);
      return;
    }
    const st = VF.fishing.state();
    if (st === 'reeling' || st === 'bite') {
      VF.audio.error();
      VF.toast.plain('Land it first', 'warn', 2000);
      return;
    }
    VF.fishing.reelIn();
    /* With a hull that can cross, the water between two places is a place.
       The arrival is identical either way — everything below runs when the
       crossing lands — so this is the same function with a scene in front of
       it rather than a second way to travel. */
    if (VF.voyage && VF.voyage.possible(id)) {
      close();
      // where the crossing actually ended up, which is not always where it was pointed
      VF.voyage.begin(id, function (real) { arrive(real || id); });
      return;
    }
    arrive(id);
  }

  function arrive(id) {
    const d = VF.state.data;
    d.location = id;
    if (d.seenLocations.indexOf(id) < 0) d.seenLocations.push(id);
    VF.loot.invalidatePool();
    VF.weather.reconcile();
    VF.encounters.reset();
    VF.fx.reset();
    VF.audio.click();
    VF.bus.emit('location:changed', id);
    /* Arriving at the day's water puts the sky and the condition where the day
       says they are. It has to happen after location:changed, which resets the
       conditions for the new spot. */
    const isDaily = VF.daily && VF.daily.today().loc.id === id;
    if (isDaily) VF.daily.arrive();
    VF.save.save();
    const loc = VF.locations.get(id);
    VF.toast.show('<strong>' + U.esc(loc.name) + '</strong><br><span style="color:var(--ink-3)">' +
                  U.esc(isDaily ? VF.daily.line() : loc.tag) + '</span>', null, 4000);
    VF.hud.showPrompt(loc.name, loc.glow, 1.6);
    close();
  }

  /* ------------------------------------------------------------ settings */

  function buildSettings() {
    const s = VF.state.data.settings;
    const p = shell('Settings');
    const b = body();

    const audio = U.el('div', 'set-group');
    audio.appendChild(U.el('span', 'k', 'Audio'));
    audio.appendChild(slider('Master', s.master, function (v) { s.master = v; VF.audio.setVolumes(); }));
    audio.appendChild(slider('Music', s.music, function (v) { s.music = v; VF.audio.setVolumes(); }));
    audio.appendChild(slider('Effects', s.sfx, function (v) { s.sfx = v; VF.audio.setVolumes(); }));
    b.appendChild(audio);

    const vis = U.el('div', 'set-group');
    vis.appendChild(U.el('span', 'k', 'Display'));
    const qRow = U.el('div', 'set-row');
    qRow.appendChild(U.el('label', null, 'Graphics'));
    const qSeg = U.el('div', 'seg');
    [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']].forEach(function (o) {
      const btn = U.el('button', s.quality === o[0] ? 'active' : '', o[1]);
      btn.addEventListener('click', function () {
        s.quality = o[0];
        U.syncBody();
        VF.audio.click();
        VF.scene.resize();
        VF.bus.emit('settings:quality');
        VF.save.save();
        refresh();
      });
      qSeg.appendChild(btn);
    });
    qRow.appendChild(qSeg);
    vis.appendChild(qRow);
    vis.appendChild(toggle('Screen shake', s.screenShake, function (v) { s.screenShake = v; }));
    vis.appendChild(toggle('Reduce flashing', s.reduceFlash, function (v) { s.reduceFlash = v; U.syncBody(); }));
    vis.appendChild(toggle('Show hints', s.showHints, function (v) { s.showHints = v; if (!v) VF.hud.clearHint(); }));

    const fsRow = U.el('div', 'set-row');
    fsRow.appendChild(U.el('label', null, 'Fullscreen'));
    const fsBtn = U.el('button', 'btn btn-sm', document.fullscreenElement ? 'Exit' : 'Enter');
    fsBtn.addEventListener('click', function () {
      VF.audio.click();
      if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); fsBtn.textContent = 'Enter'; }
      else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().then(function () { fsBtn.textContent = 'Exit'; }).catch(function () {});
      }
    });
    fsRow.appendChild(fsBtn);
    vis.appendChild(fsRow);
    b.appendChild(vis);

    const ctrl = U.el('div', 'set-group');
    ctrl.appendChild(U.el('span', 'k', 'Controls'));
    const keys = U.el('div');
    keys.style.cssText = 'font-size:11.5px;line-height:1.9;color:var(--ink-3)';
    /* Every key the game actually binds. J and C were bound and listed
       nowhere, which made two panels keyboard-only secrets. The door is not
       here on purpose — it is not in the build most people have, and naming
       it in the one that does would defeat the point of it. */
    [['Hold Space / click', 'charge and cast, set the hook, reel'],
     ['R', 'reel the line back in'],
     ['Q / B', 'shop, bag'],
     ['F / T', 'fishdex, record'],
     ['M', 'the chart'],
     ['J / C', 'journal, wardrobe'],
     ['Esc', 'close a menu']].forEach(function (k) {
      const row = U.el('div');
      const kk = U.el('span', 'mono');
      kk.style.cssText = 'color:var(--ink-2);display:inline-block;min-width:150px';
      kk.textContent = k[0];
      row.appendChild(kk);
      row.appendChild(document.createTextNode(k[1]));
      keys.appendChild(row);
    });
    ctrl.appendChild(keys);
    b.appendChild(ctrl);

    const data = U.el('div', 'set-group');
    data.appendChild(U.el('span', 'k', 'Save data'));
    const info = U.el('div');
    info.style.cssText = 'font-size:11.5px;color:var(--ink-3);margin-bottom:12px;line-height:1.6';
    info.textContent = VF.save.isAvailable()
      ? 'Four games. The one you are playing saves itself; the others sit where you left them.'
      : 'Storage is unavailable in this browser, so nothing here will persist.';
    data.appendChild(info);
    /* Four games, side by side. A row says what is in the slot so the choice
       is made on what the game looks like rather than on a number. */
    const list = U.el('div', 'saveslot-list');
    VF.save.slots().forEach(function (sl) {
      const here = sl.slot === VF.save.slot();
      /* `blank`, not `empty`: a global `.empty` already exists for the
         placeholder a panel shows when a list has nothing in it, and it is
         centred with forty-four pixels of padding. */
      const row = U.el('div', 'saveslot' + (here ? ' here' : '') + (sl.empty ? ' blank' : ''));

      const mark = U.el('div', 'saveslot-mark');
      mark.style.background = here ? 'var(--accent)' : (sl.empty ? 'var(--line-2)' : 'var(--good)');
      row.appendChild(mark);

      const main = U.el('div', 'saveslot-main');
      const name = U.el('div', 'saveslot-name');
      name.appendChild(U.el('span', null, 'slot ' + (sl.slot + 1)));
      if (here) {
        const t = U.el('span', 'tag', 'playing');
        t.style.color = 'var(--accent)';
        name.appendChild(t);
      }
      main.appendChild(name);
      if (!sl.empty && sl.run && sl.run !== 'none') {
        const rt = U.el('span', 'run-tag', VF.runs.get(sl.run).short || VF.runs.get(sl.run).name);
        name.appendChild(rt);
      }
      main.appendChild(U.el('div', 'saveslot-desc', sl.empty ? 'empty'
        : (sl.level >= VF.progression.MAX_LEVEL
             ? 'lv 99 · ' + sl.fathoms + ' fathoms' : 'lv ' + sl.level) +
          ' · ' + U.commas(sl.species) + ' species · ◈ ' + U.money(sl.money)));
      if (!sl.empty) {
        main.appendChild(U.el('div', 'saveslot-sub',
          VF.locations.get(sl.location).name + ' · ' + U.duration(sl.playSeconds)));
      }
      row.appendChild(main);

      const acts = U.el('div', 'saveslot-acts');
      if (!here) {
        const go = U.el('button', 'btn btn-sm' + (sl.empty ? '' : ' btn-primary'),
                        sl.empty ? 'Start here' : 'Load');
        go.addEventListener('click', function () {
          if (sl.empty) chooseRun(sl); else switchSlot(sl);
        });
        acts.appendChild(go);
      }
      if (!sl.empty) {
        const del = U.el('button', 'btn btn-sm btn-danger', 'Erase');
        del.addEventListener('click', function () { confirmErase(sl); });
        acts.appendChild(del);
      }
      row.appendChild(acts);
      list.appendChild(row);
    });
    data.appendChild(list);
    data.appendChild(transferRow());
    b.appendChild(data);

    p.appendChild(b);
    return p;
  }

  /* ------------------------------------------------ moving a game off here

     The four slots are four games on this machine. They are not four games
     you can take anywhere: localStorage belongs to the address the file was
     opened from, so copying the build to a laptop — or just moving it to
     another folder — leaves every slot behind.

     This sits under the slots because that is the question it answers. Export
     writes the slot you are playing; import reads one back into whichever
     slot you point it at, through the same path a normal load takes. */

  function transferRow() {
    const wrap = U.el('div', 'transfer');

    const head = U.el('div', 'transfer-head');
    head.appendChild(U.el('span', 'k', 'Move a game'));
    const hint = U.el('span', 'transfer-hint',
      'a slot lives in this browser, at this address. this is how one leaves.');
    head.appendChild(hint);
    wrap.appendChild(head);

    const area = document.createElement('textarea');
    area.className = 'transfer-box mono';
    area.spellcheck = false;
    area.setAttribute('aria-label', 'Save data');
    area.placeholder = 'export writes slot ' + (VF.save.slot() + 1) +
                       ' here — or paste a save in and choose a slot to import it into';

    const acts = U.el('div', 'set-row transfer-acts');

    const ex = U.el('button', 'btn btn-sm', 'Export slot ' + (VF.save.slot() + 1));
    ex.addEventListener('click', function () {
      const str = VF.save.exportString();
      if (!str) { VF.audio.error(); VF.toast.plain('could not read that slot', 'warn'); return; }
      area.value = str;
      area.select();
      VF.audio.click();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(str).then(function () {
          VF.toast.plain('slot ' + (VF.save.slot() + 1) + ' copied to the clipboard', 'good', 2800);
        }).catch(function () {
          VF.toast.plain('written below — copy it out', 'good', 3000);
        });
      } else {
        VF.toast.plain('written below — copy it out', 'good', 3000);
      }
    });
    acts.appendChild(ex);

    /* Import needs a slot, and picking one afterwards is a dialog nobody
       wants — so there is a button per slot, and each says what it would
       overwrite. */
    const into = U.el('div', 'transfer-into');
    into.appendChild(U.el('span', 'k', 'import into'));
    const slotRow = U.el('div', 'transfer-slots');
    VF.save.slots().forEach(function (sl) {
      const b2 = U.el('button', 'btn btn-sm', String(sl.slot + 1));
      b2.title = sl.empty ? 'slot ' + (sl.slot + 1) + ' is empty'
        : 'slot ' + (sl.slot + 1) + ' holds lv ' + sl.level + ', ' + sl.species + ' species';
      if (sl.slot === VF.save.slot()) b2.classList.add('is-cur');
      if (!sl.empty) b2.classList.add('is-full');
      b2.addEventListener('click', function () {
        const raw = area.value;
        if (!raw.trim()) { VF.audio.error(); VF.toast.plain('paste a save into the box first', 'warn'); return; }
        const peek = VF.save.previewString(raw);
        if (!peek.ok) {
          VF.audio.error();
          VF.toast.plain(peek.why === 'notasave' ? 'that is not a Void Fishing save'
            : peek.why === 'empty' ? 'nothing to import' : 'that save could not be read', 'warn', 3400);
          return;
        }
        confirmImport(raw, sl, peek);
      });
      slotRow.appendChild(b2);
    });
    into.appendChild(slotRow);

    wrap.appendChild(area);
    wrap.appendChild(acts);
    wrap.appendChild(into);
    return wrap;
  }

  /* Importing throws a slot away, so it says which one and what is in it. */
  function confirmImport(raw, sl, peek) {
    VF.audio.click();
    const dlg = U.el('div', 'dialog');
    dlg.appendChild(U.el('h3', null, sl.empty
      ? 'Import into slot ' + (sl.slot + 1) + '?'
      : 'Overwrite slot ' + (sl.slot + 1) + '?'));

    const incoming = 'The pasted game is level ' + peek.level +
      (peek.fathoms ? ' · ' + peek.fathoms + ' fathoms' : '') +
      ', ' + U.commas(peek.species) + ' species, ' + U.duration(peek.playSeconds) + ' played.';
    dlg.appendChild(U.el('p', null, sl.empty
      ? incoming + ' Slot ' + (sl.slot + 1) + ' is empty, so nothing is lost.'
      : incoming + ' Slot ' + (sl.slot + 1) + ' currently holds level ' + sl.level + ', ' +
        U.commas(sl.species) + ' species — that game is gone. Export it first if you want it.'));

    const acts = U.el('div', 'dialog-actions');
    const no = U.el('button', 'btn', 'Cancel');
    no.addEventListener('click', function () { VF.audio.back(); refresh(); });
    const yes = U.el('button', 'btn' + (sl.empty ? ' btn-primary' : ' btn-danger'),
                     sl.empty ? 'Import' : 'Overwrite');
    yes.addEventListener('click', function () {
      const res = VF.save.importString(raw, sl.slot);
      if (!res.ok) {
        VF.audio.error();
        VF.toast.plain(res.why === 'full' ? 'no room left in this browser'
          : res.why === 'unavailable' ? 'storage is unavailable here'
          : 'that save could not be read', 'warn', 3400);
        refresh();
        return;
      }
      adoptGame();
      close();
      const d = VF.state.data;
      VF.toast.show('imported into <strong>slot ' + (res.slot + 1) + '</strong><br>' +
        '<span style="color:var(--ink-3)">level ' + d.level + ' · ' +
        U.commas(Object.keys(d.fishdex).length) + ' species</span>', 'good', 5000);
      if (res.revoked && res.revoked.rods) {
        VF.toast.plain(res.revoked.rods + ' rod' + (res.revoked.rods === 1 ? '' : 's') +
                       ' that save was given rather than earned came off it', 'warn', 6000);
      }
    });
    acts.appendChild(no); acts.appendChild(yes);
    dlg.appendChild(acts);
    const prev = node;
    node = dlg;
    if (prev && prev.parentNode) prev.parentNode.replaceChild(dlg, prev);
  }

  function slider(label, value, onChange) {
    const row = U.el('div', 'set-row');
    row.appendChild(U.el('label', null, label));
    const inp = document.createElement('input');
    inp.type = 'range'; inp.min = '0'; inp.max = '1'; inp.step = '0.01'; inp.value = String(value);
    const val = U.el('span', 'val', Math.round(value * 100) + '%');
    inp.addEventListener('input', function () {
      const v = parseFloat(inp.value);
      val.textContent = Math.round(v * 100) + '%';
      onChange(v);
    });
    inp.addEventListener('change', function () { VF.save.save(); });
    row.appendChild(inp);
    row.appendChild(val);
    return row;
  }

  function toggle(label, value, onChange) {
    const row = U.el('div', 'set-row');
    row.appendChild(U.el('label', null, label));
    const sw = U.el('div', 'switch' + (value ? ' on' : ''));
    sw.setAttribute('role', 'switch');
    sw.setAttribute('tabindex', '0');
    sw.setAttribute('aria-checked', value ? 'true' : 'false');
    function flip() {
      const on = !sw.classList.contains('on');
      sw.classList.toggle('on', on);
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      onChange(on);
      VF.audio.click();
      VF.save.save();
    }
    sw.addEventListener('click', flip);
    sw.addEventListener('keydown', function (e) { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); flip(); } });
    row.appendChild(sw);
    return row;
  }

  /* The one door that discards a game. It shows what is about to be replaced
     and what is about to replace it, and it puts the outgoing save in the box
     on the way past so a mistaken paste is recoverable. */
  /* Everything the world has to be told when the game underneath it changes.
     Both slot doors go through here, and so does erasing the one in play. */
  function adoptGame() {
    VF.catchUI.close();
    VF.fishing.hardReset();
    VF.loot.invalidatePool();
    VF.encounters.reset();
    VF.fx.reset();
    VF.particles.clearAll();
    VF.scene.rebuild();
    VF.scene.seedAmbient();
    VF.audio.setVolumes();
    U.syncBody();
    VF.bus.emit('gear:changed');
    VF.bus.emit('location:changed');
    VF.hud.refreshAll();
  }

  /* Four slots and no reason to fill the other three. A rule is that reason,
     and it is chosen here because it can only be chosen here: a restriction
     you can turn on after the fact is not a restriction, and one you can turn
     off is not one either. */
  function chooseRun(sl) {
    VF.audio.click();
    const card = U.el('div', 'run-pick');
    card.appendChild(U.el('div', 'run-pick-k', 'slot ' + (sl.slot + 1) + ' — a new game'));
    card.appendChild(U.el('div', 'run-pick-sub',
      'Played under a rule, if you like. It is fixed for the life of the save.'));

    const list = U.el('div', 'run-list');
    VF.runs.list.forEach(function (r) {
      const row = U.el('button', 'run-row');
      const nm = U.el('div', 'run-name');
      nm.appendChild(U.el('span', null, r.name));
      if (r.short) {
        const t = U.el('span', 'tag', r.short);
        t.style.color = 'var(--warn)';
        nm.appendChild(t);
      }
      row.appendChild(nm);
      row.appendChild(U.el('div', 'run-desc', r.desc));
      row.addEventListener('click', function () {
        VF.audio.click();
        startRun(sl, r.id);
      });
      list.appendChild(row);
    });
    card.appendChild(list);

    const cancel = U.el('button', 'btn btn-sm', 'Not now');
    cancel.addEventListener('click', function () { VF.audio.click(); refresh('settings'); });
    card.appendChild(cancel);

    const b = body();
    b.appendChild(card);
    const p = shell('A New Game', 'and how it will be played');
    p.appendChild(b);
    U.clear(host);
    host.appendChild(p);
  }

  function startRun(sl, runId) {
    const res = VF.save.use(sl.slot);
    VF.state.data.run = runId;
    /* A rule that removes charms removes the ones already in the slots too —
       a fresh slot has none, but this is also the only place the value is
       ever set, so it is the only place that can be sure. */
    if (!VF.runs.charmsAllowed()) {
      VF.state.data.charms = [];
      VF.state.data.charmSlots = [null, null, null, null, null];
    }
    if (!VF.runs.rodAllowed(VF.state.data.rod)) VF.state.data.rod = 'wood';
    VF.save.save();
    adoptGame();
    VF.tutorial.reset();
    refresh('settings');
    const r = VF.runs.get(runId);
    VF.toast.plain('slot ' + (sl.slot + 1) + ' · ' +
                   (runId === 'none' ? 'a new game' : r.name.toLowerCase()), 'good', 3600);
  }

  function switchSlot(sl) {
    VF.audio.click();
    const res = VF.save.use(sl.slot);
    adoptGame();
    if (res.fresh) VF.tutorial.reset();
    refresh('settings');
    VF.toast.plain(res.fresh
      ? 'slot ' + (sl.slot + 1) + ' · a new game'
      : 'slot ' + (sl.slot + 1) + ' · level ' + sl.level + ' · ' +
        U.commas(sl.species) + ' species', 'good', 3600);
  }

  function confirmErase(sl) {
    VF.audio.click();
    const here = sl.slot === VF.save.slot();
    const dlg = U.el('div', 'dialog');
    dlg.appendChild(U.el('h3', null, 'Erase slot ' + (sl.slot + 1) + '?'));
    dlg.appendChild(U.el('p', null,
      'Level ' + sl.level + ', ' + U.commas(sl.species) + ' species and ' +
      U.duration(sl.playSeconds) + ' at the water.' +
      (here ? ' It is the game you are playing, and it will start again empty.' : '') +
      ' This cannot be undone.'));
    const acts = U.el('div', 'dialog-actions');
    const no = U.el('button', 'btn', 'Cancel');
    no.addEventListener('click', function () { VF.audio.back(); refresh('settings'); });
    const yes = U.el('button', 'btn btn-danger', 'Erase');
    yes.addEventListener('click', function () {
      const wasHere = VF.save.erase(sl.slot);
      if (wasHere) { adoptGame(); VF.tutorial.reset(); }
      refresh('settings');
      VF.toast.plain('slot ' + (sl.slot + 1) + ' erased', 'warn', 3000);
    });
    acts.appendChild(no); acts.appendChild(yes);
    dlg.appendChild(acts);
    const prev = node;
    node = dlg;
    if (prev && prev.parentNode) prev.parentNode.replaceChild(dlg, prev);
  }


  /* ------------------------------------------------- the case opening
     The result is decided before the animation starts. The strip is then
     positioned so it lands on it, easing out over roughly six seconds. */
  function openCase(caseId) {
    const res = VF.caseOpen.buy(caseId);
    if (!res) { VF.audio.error(); return; }

    stopRodLoop();
    const rank = VF.rarities.rank(res.rarity);
    const box = U.el('div', 'opener');

    const head = U.el('div', 'opener-head');
    head.appendChild(U.el('div', 'opener-title', res.caseDef.name));
    box.appendChild(head);

    const win = U.el('div', 'reel-window');
    const strip = U.el('div', 'reel-strip');
    const ITEM = 118, GAP = 8, STEP = ITEM + GAP;
    res.strip.forEach(function (it, i) {
      const cell = U.el('div', 'reel-item');
      cell.appendChild(cosThumb(it, 118, 70, i * 0.4));
      cell.appendChild(U.el('div', 'rn', it.name));
      const bar = U.el('div', 'rbar');
      VF.rarities.paint(bar, it.rarity, 'background');
      cell.appendChild(bar);
      strip.appendChild(cell);
    });
    win.appendChild(strip);
    win.appendChild(U.el('div', 'reel-fade'));
    win.appendChild(U.el('div', 'reel-marker'));
    box.appendChild(win);

    const resultBox = U.el('div', 'opener-result');
    resultBox.style.display = 'none';
    box.appendChild(resultBox);

    const acts = U.el('div', 'opener-actions');
    acts.style.display = 'none';
    box.appendChild(acts);

    const prev = node;
    node = box;
    if (prev && prev.parentNode) prev.parentNode.replaceChild(box, prev);

    // land the winning cell under the marker
    const winW = win.clientWidth || 720;
    const target = -(res.winIndex * STEP) + winW / 2 - ITEM / 2 - 8;
    const start = 0;
    const DUR = 6.1;
    let t0 = 0, lastTick = -1, raf = 0;

    VF.audio.caseRoll();

    function frame(now) {
      if (!t0) t0 = now;
      const el = (now - t0) / 1000;
      const k = Math.min(1, el / DUR);
      // strong ease-out: fast blur, long slow crawl into the result
      const e = 1 - Math.pow(1 - k, 4.2);
      const x = start + (target - start) * e;
      strip.style.transform = 'translateX(' + x.toFixed(2) + 'px)';

      // one tick per cell that passes the marker, thinning out as it slows
      const idx = Math.floor(-x / STEP);
      if (idx !== lastTick) { lastTick = idx; VF.audio.caseTick(k); }

      if (k < 1) { raf = requestAnimationFrame(frame); return; }
      finish();
    }

    function finish() {
      cancelAnimationFrame(raf);
      if (rank >= 5) box.classList.add('hit-mythic');
      else if (rank >= 4) box.classList.add('hit-legendary');
      VF.audio.stinger(rank >= 4 ? 'grand' : rank >= 2 ? 'bright' : 'soft', rank);
      if (rank >= 3) VF.fx.shake(2 + rank * 1.6, 3.4);
      if (rank >= 2) VF.fx.flash(U.rgbToCss(U.hexToRgb(VF.rarities.get(res.rarity).glow), 0.18),
                                 0.16 + rank * 0.04, 1.8);

      resultBox.style.display = '';
      resultBox.appendChild(cosThumb(res.item, 300, 96, 1.4));
      resultBox.appendChild(U.el('div', 'result-name', res.item.name));
      const slotName = (VF.cosmetics.slots.filter(function (s2) { return s2.id === res.item.slot; })[0] || {}).name;
      resultBox.appendChild(U.el('div', 'result-slot', slotName || res.item.slot));
      const rr = U.el('div', 'result-rarity', VF.rarities.get(res.rarity).name);
      VF.rarities.paint(rr, res.rarity, 'color');
      resultBox.appendChild(rr);
      if (res.duplicate) {
        resultBox.appendChild(U.el('div', 'result-dupe',
          'already owned — refunded ◈ ' + U.money(res.refund)));
      }

      acts.style.display = '';
      if (!res.duplicate) {
        const eq = U.el('button', 'btn btn-primary', 'wear it');
        eq.addEventListener('click', function () {
          VF.cosmetics.equip(res.item.id);
          VF.audio.click(); VF.save.save();
          VF.toast.show('wearing <strong>' + U.esc(res.item.name) + '</strong>', 'good', 2600);
          refresh('cases');
        });
        acts.appendChild(eq);
      }
      const again = U.el('button', 'btn', 'open another');
      again.addEventListener('click', function () {
        if (VF.caseOpen.canBuy(caseId).ok) openCase(caseId);
        else { VF.audio.error(); refresh('cases'); }
      });
      acts.appendChild(again);
      const done = U.el('button', 'btn', 'done');
      done.addEventListener('click', function () { VF.audio.back(); refresh('cases'); });
      acts.appendChild(done);

      VF.achievements.check();
    }

    raf = requestAnimationFrame(frame);
  }

  VF.panels = { init: init, open: open, close: close, isOpen: isOpen, refresh: refresh,
                openCase: openCase };
})(window.VF = window.VF || {});
