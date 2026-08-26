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

  function rodPreview(rod, i, dim) {
    const cv = U.el('canvas', 'rod-art');
    cv.width = 300; cv.height = 132;
    const g = cv.getContext('2d');
    if (dim) cv.style.opacity = '0.45';
    VF.rodArt.preview(g, rod, cv.width, cv.height, i * 0.9);
    rodCanvases.push({ cv: cv, ctx: g, rod: rod, phase: i * 0.9 });
    return cv;
  }
  let dexFilter = 'all', dexMode = 'all';

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

  function takeFocus() {
    lastFocus = document.activeElement;
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
    if (current === id) { close(); return; }
    if (current) closeNow();
    stopRodLoop();
    stopMapLoop();
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
      if (!current) { host.classList.add('hidden'); overlay.classList.add('hidden'); }
    }, 210);
    closeNow();
  }

  function closeNow() {
    stopRodLoop();
    stopMapLoop();
    current = null; node = null; curTab = null;
    VF.state.rt.panelOpen = null;
    returnFocus();
    U.qsa('.mbtn').forEach(function (b) { b.classList.remove('active'); });
    overlay.classList.add('hidden');
  }

  /* Rebuilding without naming a tab stays on the tab that is open — a row
     that grants something should not throw you back to the first tab. */
  function refresh(tab) {
    if (!current) return;
    stopRodLoop();
    stopMapLoop();
    if (tab === undefined) tab = curTab; else curTab = tab;
    const id = current, prev = node;
    node = build(id, tab);
    if (prev && prev.parentNode) prev.parentNode.replaceChild(node, prev);
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

  function build(id, tab) {
    switch (id) {
      case 'shop': return buildShop(tab || 'rods');
      case 'fishdex': return buildDex();
      case 'bag': return buildBag(tab || 'catches');
      case 'stats': return buildStats(tab || 'stats');
      case 'settings': return buildSettings();
      case 'map': return buildMap();
      case 'admin': return buildAdmin(tab || 'give');
      case 'merchant': return buildMerchant();
      case 'cases': return buildCases();
      case 'wardrobe': return buildWardrobe(tab || 'all');
      // a running quest is what the journal is for while there is one
      case 'journal': return buildJournal(tab || (VF.quests.activeCount() ? 'quests' : 'entries'));
      default: return shell('—');
    }
  }

  /* ---------------------------------------------------------------- shop */

  function buildShop(tab) {
    const d = VF.state.data;
    const p = shell('Shop', 'Everything you will ever need, eventually · paid in Brophys');
    p.appendChild(tabs([
      { id: 'rods', label: 'rods' }, { id: 'bait', label: 'bait' },
      { id: 'charms', label: 'charms' }, { id: 'cases', label: 'cases' },
      { id: 'charter', label: 'charter' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'charms') { b.appendChild(charmShop()); p.appendChild(b); return p; }
    if (tab === 'cases') { b.appendChild(caseList()); p.appendChild(b); return p; }
    if (tab === 'charter') { b.appendChild(charterShop()); p.appendChild(b); return p; }

    if (tab === 'rods') {
      const eq = VF.rods.get(d.rod);
      const list = U.el('div', 'list');
      VF.rods.list.forEach(function (rod) {
        const owned = d.ownedRods.indexOf(rod.id) >= 0;
        // earned rods and the wanderer's stock are never on the shelf; they
        // turn up here once they are yours
        if ((rod.quest || rod.merchant) && !owned) return;
        const block = owned ? null : VF.rods.blocked(rod);
        const locked = !!block || (!owned && rod.noShop);
        const can = VF.economy.canAfford(rod.cost);

        const row = U.el('div', 'row row-rod' + (owned ? ' owned' : '') + (locked && !owned ? ' locked' : '') +
                                  (d.rod === rod.id ? ' equipped' : ''));
        const mark = U.el('div', 'row-mark');
        mark.style.background = owned ? 'var(--good)' : (locked ? 'var(--line-2)' : 'var(--accent)');
        row.appendChild(mark);

        const art = U.el('div', 'rod-art-box');
        art.appendChild(rodPreview(rod, VF.rods.index(rod.id), locked && !owned));
        row.appendChild(art);

        const main = U.el('div', 'row-main');
        const name = U.el('div', 'row-name');
        name.appendChild(U.el('span', null, rod.name));
        if (d.rod === rod.id) {
          const t = U.el('span', 'tag', 'equipped'); t.style.color = 'var(--accent)'; name.appendChild(t);
        } else if (owned) {
          const t = U.el('span', 'tag', 'owned'); t.style.color = 'var(--good)'; name.appendChild(t);
        }
        main.appendChild(name);
        // a rod that is never sold has no purchase requirement worth stating —
        // the level it sits at is not what is standing between you and it
        main.appendChild(U.el('div', 'row-desc', !locked || owned ? rod.desc
          : rod.noShop ? (rod.notForSale || 'Not for sale. Somebody has to give you this one.')
          : block.note));

        // comparison arrows only matter when deciding whether to buy
        const c = owned ? function () { return 0; } : cmp;
        const grid = U.el('div', 'stat-grid');
        grid.appendChild(statCell('Cast', rod.cast.toFixed(2), c(rod.cast, eq.cast)));
        grid.appendChild(statCell('Reel', rod.reel.toFixed(2), c(rod.reel, eq.reel)));
        grid.appendChild(statCell('Line', rod.line.toFixed(2), c(rod.line, eq.line)));
        grid.appendChild(statCell('Rare', '×' + rod.rare.toFixed(2), c(rod.rare, eq.rare)));
        grid.appendChild(statCell('Luck', '+' + rod.luck.toFixed(2), c(rod.luck, eq.luck)));
        main.appendChild(grid);
        const bn = U.el('div', 'row-desc', rodBarNote(rod));
        bn.style.color = 'var(--ink-2)';
        main.appendChild(bn);
        row.appendChild(main);

        const side = U.el('div', 'row-side');
        if (owned) {
          if (d.rod !== rod.id) {
            const btn = U.el('button', 'btn btn-sm', 'Equip');
            btn.addEventListener('click', function () {
              d.rod = rod.id; VF.audio.click(); VF.bus.emit('gear:changed');
              VF.save.save(); refresh('rods');
            });
            side.appendChild(btn);
          } else {
            side.appendChild(U.el('div', 'row-price', 'in hand'));
          }
        } else if (rod.noShop) {
          /* the keeper does not stock these and will not be talked into it */
          const n = U.el('div', 'row-price', 'not for sale');
          n.style.color = 'var(--ink-3)';
          side.appendChild(n);
        } else {
          side.appendChild(priceEl(rod.cost, can && !locked));
          const btn = U.el('button', 'btn btn-sm' + (can && !locked ? ' btn-primary' : ''), 'Buy');
          btn.disabled = locked || !can;
          btn.addEventListener('click', function () {
            const r = VF.economy.buyRod(rod.id);
            if (r.ok) {
              VF.audio.buy();
              VF.toast.show('Equipped <strong>' + U.esc(rod.name) + '</strong>', 'good');
              VF.hud.refreshGear(); VF.achievements.check(); refresh('rods');
            } else { VF.audio.error(); }
          });
          side.appendChild(btn);
        }
        row.appendChild(side);
        list.appendChild(row);
      });
      b.appendChild(list);
    } else {
      const list = U.el('div', 'list');
      VF.bait.list.forEach(function (bt) {
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
  function rodBarNote(rod) {
    const q = U.clamp((rod.reel - 0.40) / 2.70, 0, 1.25);
    const sharper = Math.round(60 * q);
    const fill = Math.round(((rod.barFill || 1) - 1) * 100);
    const bits = [];
    if (rod.barSize !== undefined) {
      // it states its own; print exactly what the fight will use
      bits.push('white bar +' + Math.round((rod.barSize - 1) * 100) + '%');
      const spd = Math.round((rod.barSpeed - 1) * 100);
      if (spd) bits.push('bar movement ' + (spd > 0 ? '+' : '−') + Math.abs(spd) + '%');
    } else {
      const wider = Math.round(15.5 * (Math.log(Math.max(0.25, rod.line)) / Math.LN2));
      const steadier = Math.round(20 * q);
      if (wider <= 0 && steadier <= 0) {
        return 'white bar: the baseline every other rod is measured against';
      }
      if (wider > 0) bits.push('white bar +' + wider + '%');
      if (steadier > 0) bits.push(steadier + '% steadier');
    }
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
      mark.style.background = VF.rarities.color(rod.rarity);
      row.appendChild(mark);

      const art = U.el('div', 'rod-art-box');
      art.appendChild(rodPreview(rod, VF.rods.index(rod.id), false));
      row.appendChild(art);

      const main = U.el('div', 'row-main');
      const name = U.el('div', 'row-name');
      name.appendChild(U.el('span', null, rod.name));
      const rt = U.el('span', 'tag', VF.rarities.get(rod.rarity).name);
      rt.style.color = VF.rarities.color(rod.rarity);
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
          VF.toast.plain(res.why === 'money' ? 'not enough Brophys'
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
      mark.style.background = VF.rarities.color(c.rarity);
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
      kt.style.color = VF.rarities.color(c.rarity);
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
      const eff = VF.cases.effectiveOdds(c);
      ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'].forEach(function (r) {
        const pc = eff[r] * 100;
        if (pc <= 0) return;
        const sp = U.el('span', null, VF.rarities.get(r).name + ' ' +
          (pc >= 1 ? pc.toFixed(1) : pc.toFixed(2)) + '%');
        sp.style.color = VF.rarities.color(r);
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
    const comp = VF.cosmetics.completion();
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

    const list = VF.cosmetics.list.filter(function (c) { return tab === 'all' || c.slot === tab; });
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
      pip.style.background = VF.rarities.color(c.rarity);
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

  function buildJournal(tab) {
    const d = VF.state.data;
    const p = shell('Journal', d.journal.length + ' entries · ' +
                    Object.keys(d.secrets).length + ' hidden places found');
    const qn = VF.quests.activeCount();
    p.appendChild(tabs([
      { id: 'quests', label: 'quests' + (qn ? ' ' + qn : '') },
      { id: 'slate', label: 'slate' + (VF.slate.ready() ? ' •' : '') },
      { id: 'entries', label: 'entries' },
      { id: 'people', label: 'people' + (VF.npcs.anyNew() ? ' •' : '') },
      { id: 'records', label: 'records' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'slate') { b.appendChild(slateList()); p.appendChild(b); return p; }

    if (tab === 'quests') {
      const open = VF.quests.visible();
      if (!open.length) {
        b.appendChild(U.el('div', 'empty',
          'nothing is asking anything of you yet. keep fishing, and talk to people.'));
      } else {
        open.forEach(function (v) { b.appendChild(questCard(v)); });
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

  /* One quest, and where in it the player currently is. Everything drawn here
     comes off the quest definition, so a second quest needs no new UI. */
  /* -------------------------------------------------------------- slate

     Three small standing requests. Not a quest and not an achievement: the
     quest runs in chapters and the achievements are a record of things you
     already did, and between the two there was nothing to aim at inside a
     single sitting. Finishing one pays and chalks up another, so the slate is
     never a checklist you work down to nothing. */

  function slateList() {
    const wrap = U.el('div');
    const jobs = VF.slate.jobs();

    const blurb = U.el('div', 'case-blurb');
    blurb.textContent = 'small things somebody would like doing. nothing depends on them.' +
      ' finish one and another goes up in its place.';
    wrap.appendChild(blurb);

    if (!jobs.length) {
      wrap.appendChild(U.el('div', 'empty', 'the slate is clean. it will not stay that way.'));
      return wrap;
    }

    const cost = VF.slate.rerollCost();
    const list = U.el('div', 'list');

    jobs.forEach(function (job, i) {
      const at = Math.min(job.at, job.goal);
      const frac = U.clamp(at / job.goal, 0, 1);
      const row = U.el('div', 'row job');

      const mark = U.el('div', 'row-mark');
      mark.style.background = frac >= 1 ? 'var(--good)' : frac > 0 ? 'var(--warn)' : 'var(--line-2)';
      row.appendChild(mark);

      const main = U.el('div', 'row-main');
      main.appendChild(U.el('div', 'row-name', VF.slate.describe(job)));

      const track = U.el('div', 'job-track');
      const fill = U.el('div', 'job-fill');
      fill.style.width = (frac * 100).toFixed(1) + '%';
      track.appendChild(fill);
      main.appendChild(track);

      const foot = U.el('div', 'job-foot');
      foot.appendChild(U.el('span', 'job-n', at + ' / ' + job.goal));
      foot.appendChild(U.el('span', 'job-pay', '◈ ' + U.money(VF.slate.pay(job))));
      if (job.token) {
        const t = U.el('span', 'tag', 'key');
        t.style.color = 'var(--warn)';
        foot.appendChild(t);
      }
      main.appendChild(foot);
      row.appendChild(main);

      const side = U.el('div', 'row-side');
      const rr = U.el('button', 'btn btn-sm', 'Rub out · ◈ ' + U.money(cost));
      rr.title = 'chalk up a different job in its place';
      rr.disabled = !VF.economy.canAfford(cost);
      rr.addEventListener('click', function () {
        const res = VF.slate.reroll(i);
        if (!res.ok) {
          VF.audio.error();
          VF.toast.plain(res.why === 'money' ? 'not enough Brophys' : 'nothing else to ask for', 'warn');
          return;
        }
        VF.audio.click();
        refresh('slate');
      });
      side.appendChild(rr);
      row.appendChild(side);
      list.appendChild(row);
    });

    wrap.appendChild(list);

    const done = VF.slate.doneCount();
    if (done) {
      const f = U.el('div', 'case-blurb');
      f.style.marginTop = '14px';
      f.textContent = done + (done === 1 ? ' job' : ' jobs') + ' done.';
      wrap.appendChild(f);
    }
    return wrap;
  }

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

  function buildDex() {
    const d = VF.state.data;
    /* Species in a hidden tier are not in the total, not in the filter row and
       not in the grid until one has been caught — so the record never shows a
       gap the player has no way to explain. */
    const shown = VF.fish.knownList();
    const found = shown.filter(function (f) { return !!d.fishdex[f.id]; }).length;
    const p = shell('Fishdex', found + ' of ' + shown.length + ' species recorded');
    const b = body();

    const bar = U.el('div', 'dex-toolbar');
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
      if (dexFilter !== 'all' && f.rarity !== dexFilter) return false;
      const has = !!d.fishdex[f.id];
      if (dexMode === 'found' && !has) return false;
      if (dexMode === 'missing' && has) return false;
      return true;
    });

    const cnt = U.el('div', 'dex-count', list.length + ' shown');
    bar.appendChild(cnt);

    if (!list.length) { b.appendChild(U.el('div', 'empty', 'Nothing here yet.')); p.appendChild(b); return p; }

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
      const sz = VF.fishArt.fitSize(f, 118);
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
    VF.fishArt.draw(g, f, Math.min(62, VF.fishArt.fitSize(f, cv.height)),
                    { time: 1.2, mutation: entry.record ? entry.record.mutation : null });
    g.restore();
    hero.appendChild(cv);
    card.appendChild(hero);

    const bd = U.el('div', 'catch-body');
    bd.appendChild(U.el('h2', 'catch-name', f.name));
    bd.appendChild(U.el('p', 'catch-desc', f.desc));

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

  function buildBag(tab) {
    const d = VF.state.data;
    const p = shell('Bag', 'What you are carrying');
    p.appendChild(tabs([
      { id: 'catches', label: 'catches (' + d.kept.length + ')' },
      { id: 'rods', label: 'rods' },
      { id: 'bait', label: 'bait' },
      { id: 'charms', label: 'charms' },
      { id: 'salvage', label: 'salvage' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

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
          mark.style.background = VF.rarities.color(c.rarity);
          row.appendChild(mark);
          const iconBox = U.el('div', 'rod-art-box');
          iconBox.style.cssText = 'width:84px;flex:0 0 84px;display:grid;place-items:center';
          iconBox.appendChild(charmIcon(c, 56));
          row.appendChild(iconBox);
          const main = U.el('div', 'row-main');
          const nm = U.el('div', 'row-name');
          nm.appendChild(U.el('span', null, c.name));
          const kt = U.el('span', 'tag', c.kind);
          kt.style.color = VF.rarities.color(c.rarity);
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
          pip.style.background = VF.rarities.color(t.rarity);
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
            const btn = U.el('button', 'btn btn-sm btn-primary', 'Equip');
            btn.addEventListener('click', function () {
              d.rod = rod.id; VF.audio.click(); VF.bus.emit('gear:changed'); VF.save.save(); refresh('rods');
            });
            side.appendChild(btn);
          }
          row.appendChild(side);
          list.appendChild(row);
        });
      b.appendChild(list);
    } else {
      const list = U.el('div', 'list');
      VF.bait.list.forEach(function (bt) {
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
        ['Discovered', Object.keys(d.fishdex).length + ' / ' + VF.fish.count, 'species'],
        ['Biggest catch', s.biggestKg ? U.weight(s.biggestKg) : '—', big ? big.name : ''],
        ['Rarest catch', rare ? VF.rarities.get(rare.rarity).name : '—', rare ? rare.name : ''],
        ['Total earned', '◈ ' + U.money(s.earned), '◈ ' + U.money(s.spent) + ' spent'],
        ['Fish sold', U.commas(s.sold), U.commas(s.released) + ' released'],
        ['Legendary+', U.commas(s.legendaryCatches), U.commas(s.voidCatches) + ' void'],
        ['Mutations', U.commas(s.mutationsFound), U.commas(s.recordsBroken) + ' records broken'],
        ['Escapes', U.commas(s.escapes), U.commas(s.linesSnapped) + ' lines snapped'],
        ['Clean fights', U.commas(s.perfectReels), 'never in the red'],
        ['Encounters', U.commas(s.encounters), 'something below'],
        ['Time at the water', U.duration(s.playSeconds), 'reputation ' + U.commas(d.reputation)]
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

  /* ------------------------------------------------------------------ map

     A sounding rather than a list: one plumb line through the whole world with
     every place hung off it at its own depth. The chart is a canvas because it
     animates — where you are standing pulses — and because the water column
     behind it is sampled from the real palette of each spot, which is a
     gradient and not a stack of divs.

     The chart draws; this decides what is on it and what happens when one is
     clicked. mapArt never reads game state. */

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
      ? 'deeper water, stranger catches · ' + nFound + ' hidden ' + (nFound === 1 ? 'place' : 'places') + ' found'
      : 'deeper water, stranger catches');
    p.classList.add('panel-map');

    const b = U.el('div', 'panel-body map-body');
    const wrap = U.el('div', 'map-wrap');

    /* --- the chart --- */
    const chart = U.el('div', 'map-chart');
    const cv = U.el('canvas', 'map-canvas');
    chart.appendChild(cv);
    wrap.appendChild(chart);

    /* --- the readout beside it --- */
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
      const sel = places.filter(function (x) { return x.id === mapSel; })[0];
      if (!sel) { side.appendChild(U.el('div', 'empty', 'pick somewhere.')); return; }
      side.appendChild(spotCard(sel));
    }

    /* --- the loop ---
       Only the pulse on the current node moves, so this is a handful of arcs a
       frame. It stops the moment the panel is replaced. */
    const t0 = performance.now();
    function sizeAndPaint() {
      /* The panel is built before it is appended, so the first frame of this
         loop runs on a canvas that is not in the document yet. Treating that
         as "gone" would kill the loop before it ever drew — which is exactly
         what it did. Not being ready is a frame to skip, not a reason to stop;
         only stopMapLoop, by bumping the generation, ends it. */
      if (!cv.isConnected) return true;
      const r = chart.getBoundingClientRect();
      if (!r.width || !r.height) return true;
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
      return true;
    }

    (function frame() {
      if (myGen !== mapGen) return;
      sizeAndPaint();
      mapRaf = requestAnimationFrame(frame);
    })();

    /* --- picking --- */
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

    /* --- what lives here ---
       The chart used to print three multipliers and nothing about the fish,
       which made it a teleport menu. This is the part that makes it a place
       worth choosing. */
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

  /* Which species can actually turn up at a spot, and how many of them are on
     the record. Native only — strays from one spot over are not what somebody
     asking "what lives here" means. */
  const poolCache = Object.create(null);
  function poolFor(locId) {
    const d = VF.state.data;
    let cached = poolCache[locId];
    if (!cached) {
      const list = VF.fish.knownList().filter(function (f) {
        return f.locs && f.locs.indexOf(locId) >= 0;
      });
      cached = poolCache[locId] = list;
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

  function travel(id) {
    const st = VF.fishing.state();
    if (st === 'reeling' || st === 'bite') {
      VF.audio.error();
      VF.toast.plain('Land it first', 'warn', 2000);
      return;
    }
    VF.fishing.reelIn();
    const d = VF.state.data;
    d.location = id;
    if (d.seenLocations.indexOf(id) < 0) d.seenLocations.push(id);
    VF.loot.invalidatePool();
    VF.weather.reconcile();
    VF.encounters.reset();
    VF.fx.reset();
    VF.audio.click();
    VF.bus.emit('location:changed', id);
    VF.save.save();
    const loc = VF.locations.get(id);
    VF.toast.show('<strong>' + U.esc(loc.name) + '</strong><br><span style="color:var(--ink-3)">' + U.esc(loc.tag) + '</span>', null, 4000);
    VF.hud.showPrompt(loc.name, loc.glow, 1.6);
    close();
  }

  /* ------------------------------------------------------------------ admin

     Everything in the game, grantable. This is a tool, not a screen the player
     is meant to live in, so it is built for finding one thing fast: every list
     is filtered by the same search box, every row grants on click, and every
     section has a "all of it" at the top.

     Nothing here writes state directly — it all goes through VF.admin, which
     goes through the same grant paths the game uses. */

  let adminQ = '';

  function buildAdmin(tab) {
    const p = shell('Admin', VF.admin.used()
      ? 'this save has been helped'
      : 'everything in the game, grantable');
    p.classList.add('panel-admin');
    p.appendChild(tabs([
      { id: 'give', label: 'give' },
      { id: 'rods', label: 'rods' },
      { id: 'looks', label: 'cosmetics' },
      { id: 'charms', label: 'charms' },
      { id: 'world', label: 'world' },
      { id: 'spawn', label: 'on the line' }
    ], tab, function (t) { adminQ = ''; refresh(t); }));

    const b = body();
    if (tab !== 'give' && tab !== 'world' && tab !== 'spawn') b.appendChild(adminSearch(tab));

    if (tab === 'give') b.appendChild(adminGive());
    else if (tab === 'rods') b.appendChild(adminRods());
    else if (tab === 'looks') b.appendChild(adminLooks());
    else if (tab === 'charms') b.appendChild(adminCharms());
    else if (tab === 'world') b.appendChild(adminWorld());
    else if (tab === 'spawn') b.appendChild(adminSpawn());

    p.appendChild(b);
    return p;
  }

  /* One search box, reused. It filters in place rather than rebuilding the
     panel, so typing does not cost a relayout of two hundred rows. */
  function adminSearch(tab) {
    const bar = U.el('div', 'admin-search');
    const inp = document.createElement('input');
    inp.type = 'search';
    inp.className = 'admin-input';
    inp.placeholder = 'filter by name…';
    inp.value = adminQ;
    inp.addEventListener('input', function () {
      adminQ = inp.value.trim().toLowerCase();
      applyAdminFilter();
    });
    bar.appendChild(inp);
    const n = U.el('span', 'admin-count');
    n.id = 'adminCount';
    bar.appendChild(n);
    setTimeout(function () { inp.focus(); }, 40);
    return bar;
  }

  function applyAdminFilter() {
    const rows = U.qsa('[data-admin-name]');
    let shown = 0;
    rows.forEach(function (r) {
      const hit = !adminQ || r.dataset.adminName.indexOf(adminQ) >= 0;
      r.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    const c = document.getElementById('adminCount');
    if (c) c.textContent = shown + ' shown';
    /* A group whose every row is filtered out goes too — but only if it had
       filterable rows to begin with. The tier, size and trait pickers hold
       buttons, not rows, and hiding those was hiding half the tab. */
    U.qsa('.admin-group').forEach(function (g) {
      const rows = U.qsa('[data-admin-name]', g);
      if (!rows.length) return;
      const any = rows.some(function (r) { return r.style.display !== 'none'; });
      g.style.display = any ? '' : 'none';
    });
  }

  function adminBtn(label, fn, cls) {
    const b = U.el('button', 'btn btn-sm' + (cls ? ' ' + cls : ''), label);
    b.addEventListener('click', function () { fn(); refresh(); });
    return b;
  }

  /* A row that grants one thing. `owned` greys it without hiding it — knowing
     you already have something is as useful as being able to get it. */
  function adminRow(name, sub, owned, colour, give, art) {
    const row = U.el('div', 'row admin-row' + (owned ? ' owned' : ''));
    row.dataset.adminName = String(name).toLowerCase();
    const mark = U.el('div', 'row-mark');
    mark.style.background = colour || 'var(--line-2)';
    row.appendChild(mark);
    if (art) row.appendChild(art);
    const main = U.el('div', 'row-main');
    const nm = U.el('div', 'row-name');
    nm.appendChild(U.el('span', null, name));
    if (owned) { const t = U.el('span', 'tag', 'have'); t.style.color = 'var(--good)'; nm.appendChild(t); }
    main.appendChild(nm);
    if (sub) main.appendChild(U.el('div', 'row-desc', sub));
    row.appendChild(main);
    const side = U.el('div', 'row-side');
    const b = U.el('button', 'btn btn-sm' + (owned ? '' : ' btn-primary'), owned ? 'Again' : 'Give');
    b.addEventListener('click', function () { give(); refresh(); });
    side.appendChild(b);
    row.appendChild(side);
    return row;
  }

  function adminGroup(title, actions) {
    const g = U.el('div', 'admin-group');
    const h = U.el('div', 'admin-group-head');
    h.appendChild(U.el('span', 'k', title));
    if (actions) { const a = U.el('div', 'admin-acts'); actions.forEach(function (x) { a.appendChild(x); }); h.appendChild(a); }
    g.appendChild(h);
    return g;
  }

  /* ------------------------------------------------------------ give */

  function adminGive() {
    const d = VF.state.data;
    const wrap = U.el('div');

    const all = U.el('div', 'admin-hero');
    all.appendChild(U.el('div', 'admin-hero-t', 'everything'));
    all.appendChild(U.el('div', 'admin-hero-d',
      'max level, fifty million Brophys, every spot including the hidden ones, ' +
      'every rod, charm, finish, object and achievement.'));
    const go = U.el('button', 'btn btn-primary', 'Give me everything');
    go.addEventListener('click', function () { VF.admin.everything(); refresh(); });
    all.appendChild(go);
    wrap.appendChild(all);

    const money = adminGroup('Brophys · ◈ ' + U.money(d.money));
    const mr = U.el('div', 'admin-acts wrap');
    [1000, 25000, 500000, 10000000].forEach(function (n) {
      mr.appendChild(adminBtn('+' + U.money(n), function () { VF.admin.money(n); }));
    });
    mr.appendChild(adminBtn('clear', function () { VF.admin.money(-d.money); }, 'btn-danger'));
    money.appendChild(mr);
    wrap.appendChild(money);

    const lv = adminGroup('Level · ' + d.level + ' of ' + VF.progression.MAX_LEVEL);
    const lr = U.el('div', 'admin-acts wrap');
    [10, 25, 45, 58, 84, 99].forEach(function (n) {
      lr.appendChild(adminBtn('lv ' + n, function () { VF.admin.level(n); }));
    });
    lr.appendChild(adminBtn('+1', function () { VF.admin.level(d.level + 1); }));
    lr.appendChild(adminBtn('+250k xp', function () { VF.admin.xp(250000); }));
    lv.appendChild(lr);
    wrap.appendChild(lv);

    const rep = adminGroup('Reputation · ' + Math.round(d.reputation) +
      ' (luck +' + VF.progression.repLuck(d.reputation).toFixed(2) + ')');
    const rr = U.el('div', 'admin-acts wrap');
    [100, 500, 2500].forEach(function (n) {
      rr.appendChild(adminBtn('+' + n, function () { VF.admin.reputation(n); }));
    });
    rep.appendChild(rr);
    wrap.appendChild(rep);

    const tk = adminGroup('Case keys · ' + d.caseTokens);
    const tr = U.el('div', 'admin-acts wrap');
    [1, 10, 50].forEach(function (n) { tr.appendChild(adminBtn('+' + n, function () { VF.admin.tokens(n); })); });
    tk.appendChild(tr);
    wrap.appendChild(tk);

    const ba = adminGroup('Bait');
    const br = U.el('div', 'admin-acts wrap');
    br.appendChild(adminBtn('999 of everything', function () { VF.admin.allBait(999); }));
    VF.bait.list.forEach(function (bt) {
      if (bt.unlimited) return;
      br.appendChild(adminBtn(bt.name.toLowerCase() + ' ×' + bt.pack, function () { VF.admin.bait(bt.id, bt.pack); }));
    });
    ba.appendChild(br);
    wrap.appendChild(ba);

    const misc = adminGroup('Everything else');
    const mi = U.el('div', 'admin-acts wrap');
    mi.appendChild(adminBtn('all 63 achievements', function () { VF.admin.achievements(); }));
    mi.appendChild(adminBtn('every object', function () { VF.admin.allTreasure(); }));
    mi.appendChild(adminBtn('wipe the fishdex', function () { VF.admin.clearFishdex(); }, 'btn-danger'));
    mi.appendChild(adminBtn('wipe cosmetics', function () { VF.admin.clearCosmetics(); }, 'btn-danger'));
    misc.appendChild(mi);
    wrap.appendChild(misc);

    return wrap;
  }

  /* ------------------------------------------------------------ rods */

  function adminRods() {
    const d = VF.state.data;
    const wrap = U.el('div');
    const g = adminGroup('Every rod · ' + d.ownedRods.length + ' of ' + VF.rods.list.length + ' owned',
      [adminBtn('give me all of them', function () { VF.admin.allRods(); })]);
    wrap.appendChild(g);

    const list = U.el('div', 'list');
    VF.rods.list.forEach(function (rod, i) {
      const owned = d.ownedRods.indexOf(rod.id) >= 0;
      const art = U.el('div', 'rod-art-box admin-rod');
      art.appendChild(rodPreview(rod, i, false));
      list.appendChild(adminRow(
        rod.name,
        'lv ' + rod.level + ' · cast ' + rod.cast.toFixed(2) + ' · reel ' + rod.reel.toFixed(2) +
        ' · rare ×' + rod.rare.toFixed(2) + (rod.merchant ? ' · wanderer' : rod.noShop ? ' · never sold' : ''),
        owned, owned ? 'var(--good)' : 'var(--accent)',
        function () { VF.admin.rod(rod.id); }, art));
    });
    wrap.appendChild(list);
    setTimeout(applyAdminFilter, 0);
    return wrap;
  }

  /* ------------------------------------------------------- cosmetics */

  function adminLooks() {
    const wrap = U.el('div');
    const c = VF.cosmetics.completion();
    const head = adminGroup('Every cosmetic · ' + c.have + ' of ' + c.total,
      [adminBtn('give me all of them', function () { VF.admin.allCosmetics(); })]);
    wrap.appendChild(head);

    VF.cosmetics.slots.forEach(function (slot) {
      const items = VF.cosmetics.inSlot(slot.id);
      if (!items.length) return;
      const have = items.filter(function (x) { return VF.cosmetics.owned(x.id); }).length;
      const g = adminGroup(slot.name + ' · ' + have + ' of ' + items.length,
        [adminBtn('all ' + plural(slot.name), function () { VF.admin.slot(slot.id); })]);

      const grid = U.el('div', 'admin-cos');
      items.forEach(function (it, i) {
        const owned = VF.cosmetics.owned(it.id);
        const cell = U.el('div', 'cos-cell admin-cos-cell' + (owned ? ' owned' : ''));
        cell.dataset.adminName = it.name.toLowerCase();
        cell.appendChild(cosThumb(it, 120, 66, i * 0.4));
        cell.appendChild(U.el('div', 'cos-name', it.name));
        const r = VF.rarities.get(it.rarity);
        const tag = U.el('div', 'cos-rar', it.secret ? r.name + ' · never in a case' : r.name);
        tag.style.color = r.color;
        cell.appendChild(tag);
        cell.addEventListener('click', function () {
          VF.admin.cosmetic(it.id);
          VF.cosmetics.equip(it.id);
          refresh();
        });
        cell.title = owned ? 'equip it' : 'give it and equip it';
        grid.appendChild(cell);
      });
      g.appendChild(grid);
      wrap.appendChild(g);
    });
    setTimeout(applyAdminFilter, 0);
    return wrap;
  }

  /* ---------------------------------------------------------- charms */

  function adminCharms() {
    const d = VF.state.data;
    const wrap = U.el('div');
    wrap.appendChild(adminGroup('Charms and relics · ' + d.charms.length + ' of ' + VF.charms.list.length,
      [adminBtn('give me all of them', function () { VF.admin.allCharms(); })]));
    const list = U.el('div', 'list');
    VF.charms.list.forEach(function (c) {
      list.appendChild(adminRow(c.name, c.desc, VF.charms.owned(c.id),
        c.relic ? 'var(--warn)' : 'var(--accent)',
        function () { VF.admin.charm(c.id); }));
    });
    wrap.appendChild(list);
    setTimeout(applyAdminFilter, 0);
    return wrap;
  }

  /* ----------------------------------------------------------- world */

  function adminWorld() {
    const d = VF.state.data;
    const wrap = U.el('div');

    const locs = adminGroup('Spots · ' + d.unlockedLocations.length + ' open',
      [adminBtn('open everything, hidden included', function () { VF.admin.allLocations(); })]);
    const lr = U.el('div', 'admin-acts wrap');
    VF.locations.list.forEach(function (l) {
      const open = VF.locations.isUnlocked(l.id);
      const b = adminBtn(l.name.toLowerCase(), function () {
        VF.admin.location(l.id);
        if (VF.locations.isUnlocked(l.id)) travel(l.id);
      });
      if (open) b.classList.add('is-open');
      if (d.location === l.id) b.classList.add('is-cur');
      lr.appendChild(b);
    });
    // the hidden ones that have not been found are still grantable by name
    VF.secrets.list.forEach(function (sc) {
      if (VF.secrets.found(sc.id)) return;
      const b = adminBtn('◈ ' + sc.name.toLowerCase(), function () { VF.admin.location(sc.loc.id); });
      b.classList.add('is-secret');
      lr.appendChild(b);
    });
    locs.appendChild(lr);
    wrap.appendChild(locs);

    const wx = adminGroup('Sky · ' + VF.weather.name().toLowerCase());
    const wr = U.el('div', 'admin-acts wrap');
    VF.weatherData.list.forEach(function (w) {
      wr.appendChild(adminBtn(w.name.toLowerCase(), function () { VF.admin.weather(w.id); }));
    });
    wx.appendChild(wr);
    wrap.appendChild(wx);

    const cd = adminGroup('Water · ' + (VF.conditions.name() || 'nothing').toLowerCase());
    const cr = U.el('div', 'admin-acts wrap');
    VF.conditionData.list.forEach(function (c) {
      const b = adminBtn(c.name.toLowerCase(), function () { VF.admin.condition(c.id); });
      b.style.borderColor = U.rgbToCss(U.hexToRgb(c.tint), 0.45);
      cr.appendChild(b);
    });
    cr.appendChild(adminBtn('stop it', function () { VF.conditions.end(); refresh(); }, 'btn-danger'));
    cd.appendChild(cr);
    wrap.appendChild(cd);

    const tm = adminGroup('Hour · ' + VF.time.clock() + ' · ' + VF.time.phaseName().toLowerCase());
    const tr = U.el('div', 'admin-acts wrap');
    [['dawn', 6], ['midday', 12], ['sunset', 19], ['night', 1]].forEach(function (o) {
      tr.appendChild(adminBtn(o[0], function () { VF.admin.clock(o[1]); refresh(); }));
    });
    tm.appendChild(tr);
    wrap.appendChild(tm);

    return wrap;
  }

  /* --------------------------------------------------- on the line */

  /* `size: null` means "roll it the way you always would" — the default, so
     arming a tier on its own still produces an ordinary fish of that tier. */
  const spawnPick = { fish: null, rarity: null, size: null, traits: [] };

  /* "rod finish" pluralises to "rod finishes", not "rod finishs". */
  function plural(word) {
    return word + (/(s|x|z|ch|sh)$/.test(word) ? 'es' : 's');
  }

  function adminSpawn() {
    const wrap = U.el('div');
    const blurb = U.el('div', 'case-blurb');
    blurb.textContent = 'arm the next bite. anything left unset is rolled the way it always is, ' +
      'so a tier on its own still picks a real species out of the water you are standing in.';
    wrap.appendChild(blurb);

    /* --- tier floor --- */
    const tg = adminGroup('Tier floor');
    const trow = U.el('div', 'admin-acts wrap');
    trow.appendChild(pickBtn('any', spawnPick.rarity === null, function () { spawnPick.rarity = null; refresh('spawn'); }));
    VF.rarities.list.forEach(function (r) {
      const b = pickBtn(r.name.toLowerCase(), spawnPick.rarity === r.id, function () {
        spawnPick.rarity = r.id; spawnPick.fish = null; refresh('spawn');
      });
      b.style.color = r.color;
      trow.appendChild(b);
    });
    tg.appendChild(trow);
    wrap.appendChild(tg);

    /* --- size --- */
    const sg = adminGroup('Size');
    const srow = U.el('div', 'admin-acts wrap');
    [['rolled', null], ['runt', 0.02], ['average', 0.5], ['large', 0.85], ['record', 1]].forEach(function (o) {
      const on = o[1] === null ? spawnPick.size === null
                               : spawnPick.size !== null && Math.abs(spawnPick.size - o[1]) < 1e-6;
      srow.appendChild(pickBtn(o[0], on, function () { spawnPick.size = o[1]; refresh('spawn'); }));
    });
    sg.appendChild(srow);
    wrap.appendChild(sg);

    /* --- traits --- */
    const gg = adminGroup('Traits · ' + (spawnPick.traits.length || 'rolled'));
    const grow = U.el('div', 'admin-acts wrap');
    VF.traits.list.forEach(function (t) {
      const on = spawnPick.traits.indexOf(t.id) >= 0;
      const b = pickBtn(t.name.toLowerCase(), on, function () {
        const i = spawnPick.traits.indexOf(t.id);
        if (i >= 0) spawnPick.traits.splice(i, 1);
        else spawnPick.traits.push(t.id);
        refresh('spawn');
      });
      b.style.color = t.color;
      grow.appendChild(b);
    });
    if (spawnPick.traits.length) {
      grow.appendChild(adminBtn('none', function () { spawnPick.traits = []; refresh('spawn'); }, 'btn-danger'));
    }
    gg.appendChild(grow);
    wrap.appendChild(gg);

    /* --- the arm button --- */
    const arm = U.el('div', 'admin-hero');
    const what = spawnPick.fish
      ? (VF.fish.byId(spawnPick.fish) || {}).name
      : spawnPick.rarity ? VF.rarities.get(spawnPick.rarity).name + ' or better' : 'whatever bites';
    arm.appendChild(U.el('div', 'admin-hero-t', what));
    arm.appendChild(U.el('div', 'admin-hero-d',
      (spawnPick.traits.length ? spawnPick.traits.join(' · ') + ' · ' : '') +
      (spawnPick.size === null ? 'size rolled as usual'
        : spawnPick.size >= 1 ? 'record size'
        : spawnPick.size <= 0.05 ? 'runt'
        : 'size ' + Math.round(spawnPick.size * 100) + '%')));
    const go = U.el('button', 'btn btn-primary', 'Put it on the line');
    go.addEventListener('click', function () {
      VF.admin.spawn({
        fish: spawnPick.fish, rarity: spawnPick.rarity,
        size: spawnPick.size, traits: spawnPick.traits
      });
      close();
    });
    arm.appendChild(go);
    const clr = U.el('button', 'btn btn-sm', 'Disarm');
    clr.addEventListener('click', function () { VF.admin.clearSpawn(); refresh('spawn'); });
    arm.appendChild(clr);
    wrap.appendChild(arm);

    /* --- species --- */
    const fg = adminGroup('Or name one · ' + VF.fish.list.length + ' species');
    wrap.appendChild(fg);
    wrap.appendChild(adminSearch('spawn'));

    const list = U.el('div', 'list admin-fish');
    VF.fish.list.forEach(function (f) {
      const r = VF.rarities.get(f.rarity);
      const row = U.el('div', 'row admin-row' + (spawnPick.fish === f.id ? ' equipped' : ''));
      row.dataset.adminName = f.name.toLowerCase();
      const mark = U.el('div', 'row-mark');
      mark.style.background = r.color;
      row.appendChild(mark);

      const art = U.el('canvas', 'admin-fish-art');
      art.width = 200; art.height = 74;
      const g = art.getContext('2d');
      g.save(); g.translate(100, 37);
      VF.fishArt.draw(g, f, VF.fishArt.fitSize(f, 62), { time: 0.6 });
      g.restore();
      row.appendChild(art);

      const main = U.el('div', 'row-main');
      const nm = U.el('div', 'row-name');
      nm.appendChild(U.el('span', null, f.name));
      const tg2 = U.el('span', 'tag', r.name); tg2.style.color = r.color;
      nm.appendChild(tg2);
      main.appendChild(nm);
      main.appendChild(U.el('div', 'row-desc',
        U.weight(f.kg[0]) + '–' + U.weight(f.kg[1]) + ' · ◈ ' + U.money(f.value)));
      row.appendChild(main);

      const side = U.el('div', 'row-side');
      const b = U.el('button', 'btn btn-sm btn-primary', 'Hook it');
      b.addEventListener('click', function () {
        spawnPick.fish = f.id;
        VF.admin.spawn({ fish: f.id, size: spawnPick.size, traits: spawnPick.traits });
        close();
      });
      side.appendChild(b);
      row.appendChild(side);
      list.appendChild(row);
    });
    wrap.appendChild(list);
    setTimeout(applyAdminFilter, 0);
    return wrap;
  }

  function pickBtn(label, on, fn) {
    const b = U.el('button', 'btn btn-sm admin-pick' + (on ? ' on' : ''), label);
    b.addEventListener('click', function () { VF.audio.click(); fn(); });
    return b;
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
        document.body.className = 'q-' + o[0];
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
    vis.appendChild(toggle('Reduce flashing', s.reduceFlash, function (v) { s.reduceFlash = v; }));
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
    /* Every key the game actually binds. J, C and the backtick were bound and
       listed nowhere, which made two panels and the console keyboard-only
       secrets. */
    [['Hold Space / click', 'charge and cast, set the hook, reel'],
     ['R', 'reel the line back in'],
     ['Q / B', 'shop, bag'],
     ['F / T', 'fishdex, record'],
     ['M', 'the chart'],
     ['J / C', 'journal and the slate, wardrobe'],
     ['`', 'admin console'],
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

    const ctrl2 = U.el('div', 'set-group');
    ctrl2.appendChild(U.el('span', 'k', 'Admin'));
    const ainfo = U.el('div');
    ainfo.style.cssText = 'font-size:11.5px;color:var(--ink-3);margin-bottom:10px;line-height:1.6';
    ainfo.textContent = 'Everything in the game, grantable — every rod, finish, charm, spot ' +
      'and object, and a way to put a named species on the line. Press ` at any time.';
    ctrl2.appendChild(ainfo);
    const arow = U.el('div', 'set-row');
    const abtn = U.el('button', 'btn btn-sm', 'Open the admin console');
    abtn.addEventListener('click', function () { VF.audio.click(); open('admin'); });
    arow.appendChild(abtn);
    if (VF.admin.used()) {
      const used = U.el('span', 'tag', 'used on this save');
      used.style.color = 'var(--warn)';
      arow.appendChild(used);
    }
    ctrl2.appendChild(arow);
    b.appendChild(ctrl2);

    const data = U.el('div', 'set-group');
    data.appendChild(U.el('span', 'k', 'Save data'));
    const info = U.el('div');
    info.style.cssText = 'font-size:11.5px;color:var(--ink-3);margin-bottom:12px;line-height:1.6';
    info.textContent = VF.save.isAvailable()
      ? 'Progress saves automatically to this browser. Closing the tab is safe — but a save ' +
        'belongs to the address you opened the game from, so moving the file means taking ' +
        'the save with you.'
      : 'Storage is unavailable in this browser, so progress will not persist. Export before you close.';
    data.appendChild(info);
    data.appendChild(transferRow());
    const row = U.el('div', 'set-row');
    const resetBtn = U.el('button', 'btn btn-sm btn-danger', 'Reset everything');
    resetBtn.addEventListener('click', confirmReset);
    row.appendChild(resetBtn);
    data.appendChild(row);
    b.appendChild(data);

    p.appendChild(b);
    return p;
  }

  /* ----------------------------------------------------- moving a save

     A single-file build is meant to be moved, and localStorage is scoped to
     the address it was opened from — so without this, moving the file loses
     the run. Export writes a string to the box and to the clipboard where the
     browser allows it; import goes through the same merge and sanitise path a
     loaded save does, so a mangled paste is refused rather than half-applied. */

  function transferRow() {
    const box = U.el('div', 'transfer');

    const area = document.createElement('textarea');
    area.className = 'transfer-box mono';
    area.spellcheck = false;
    area.setAttribute('aria-label', 'Save data');
    area.placeholder = 'export writes your save here — or paste one in and press Import';

    const acts = U.el('div', 'set-row');

    const ex = U.el('button', 'btn btn-sm', 'Export');
    ex.addEventListener('click', function () {
      const str = VF.save.exportString();
      if (!str) { VF.audio.error(); VF.toast.plain('could not read the save', 'warn'); return; }
      area.value = str;
      area.select();
      VF.audio.click();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(str).then(function () {
          VF.toast.plain('save copied to the clipboard', 'good', 2600);
        }).catch(function () {
          VF.toast.plain('save written below — copy it out', 'good', 3000);
        });
      } else {
        VF.toast.plain('save written below — copy it out', 'good', 3000);
      }
    });
    acts.appendChild(ex);

    const im = U.el('button', 'btn btn-sm', 'Import');
    im.addEventListener('click', function () {
      const raw = area.value;
      if (!raw.trim()) { VF.audio.error(); VF.toast.plain('paste a save into the box first', 'warn'); return; }
      confirmImport(raw);
    });
    acts.appendChild(im);

    box.appendChild(area);
    box.appendChild(acts);
    return box;
  }

  /* Importing throws away the run that is open, so it asks first — and it
     parses before it asks, so a bad string never gets as far as the warning. */
  function confirmImport(raw) {
    VF.audio.click();
    const dlg = U.el('div', 'dialog');
    dlg.appendChild(U.el('h3', null, 'Replace this save?'));
    dlg.appendChild(U.el('p', null,
      'The run currently open — level ' + VF.state.data.level + ', ' +
      U.commas(VF.state.data.stats.catches) + ' caught — is overwritten by the pasted one. ' +
      'Export it first if you want to keep it.'));
    const acts = U.el('div', 'dialog-actions');
    const no = U.el('button', 'btn', 'Cancel');
    no.addEventListener('click', function () { VF.audio.back(); refresh(); });
    const yes = U.el('button', 'btn btn-danger', 'Import');
    yes.addEventListener('click', function () {
      const res = VF.save.importString(raw);
      if (!res.ok) {
        VF.audio.error();
        VF.toast.plain(res.why === 'notasave' ? 'that is not a Void Fishing save'
          : res.why === 'empty' ? 'nothing to import' : 'that save could not be read', 'warn', 3400);
        refresh();
        return;
      }
      // everything that caches state has to be told the world changed
      VF.catchUI.close();
      VF.fishing.hardReset();
      VF.secrets.registerFound();
      VF.loot.invalidatePool();
      VF.encounters.reset();
      VF.conditions.reset();
      VF.weather.reconcile();
      VF.fx.reset();
      VF.particles.clearAll();
      VF.scene.rebuild();
      VF.scene.seedAmbient();
      VF.audio.setVolumes();
      document.body.className = 'q-' + VF.state.data.settings.quality;
      VF.hud.refreshAll();
      close();
      VF.toast.show('save imported — <strong>level ' + VF.state.data.level + '</strong>, ' +
        U.commas(VF.state.data.stats.catches) + ' caught', 'good', 5000);
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

  function confirmReset() {
    VF.audio.click();
    const dlg = U.el('div', 'dialog');
    dlg.appendChild(U.el('h3', null, 'Reset everything?'));
    dlg.appendChild(U.el('p', null,
      'This erases your money, level, collection, records and settings. It cannot be undone.'));
    const acts = U.el('div', 'dialog-actions');
    const no = U.el('button', 'btn', 'Cancel');
    no.addEventListener('click', function () { VF.audio.back(); refresh(); });
    const yes = U.el('button', 'btn btn-danger', 'Reset');
    yes.addEventListener('click', function () {
      VF.save.reset();
      VF.catchUI.close();
      VF.fishing.hardReset();
      VF.loot.invalidatePool();
      VF.encounters.reset();
      VF.fx.reset();
      VF.particles.clearAll();
      VF.scene.rebuild();
      VF.scene.seedAmbient();
      VF.audio.setVolumes();
      document.body.className = 'q-' + VF.state.data.settings.quality;
      VF.hud.refreshAll();
      VF.tutorial.reset();
      close();
      VF.toast.plain('Everything reset', 'warn');
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
      bar.style.background = VF.rarities.color(it.rarity);
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
      rr.style.color = VF.rarities.color(res.rarity);
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
