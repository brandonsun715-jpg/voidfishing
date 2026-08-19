/* VOID FISHING — menus. One panel host, six views, all rebuilt on open so they
   never drift out of sync with the game state. */
(function (VF) {
  'use strict';

  const U = VF.util;
  let host = null, overlay = null, current = null, node = null;
  let gen = 0;   // guards the deferred teardown against a newer open
  let dexFilter = 'all', dexMode = 'all';

  function init() {
    host = document.getElementById('modal');
    overlay = document.getElementById('overlay');
    overlay.addEventListener('click', function () { if (current) close(); });
  }

  function isOpen() { return !!current; }

  function open(id, tab) {
    if (VF.catchUI.isOpen()) return;
    if (current === id) { close(); return; }
    if (current) closeNow();
    gen++;
    current = id;
    VF.state.rt.panelOpen = id;
    overlay.classList.remove('hidden', 'out');
    node = build(id, tab);
    U.clear(host);
    host.appendChild(node);
    host.classList.remove('hidden');
    U.qsa('.mbtn').forEach(function (b) { b.classList.toggle('active', b.dataset.panel === id); });
    VF.hud.pressEnd();
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
    current = null; node = null;
    VF.state.rt.panelOpen = null;
    U.qsa('.mbtn').forEach(function (b) { b.classList.remove('active'); });
    overlay.classList.add('hidden');
  }

  function refresh(tab) {
    if (!current) return;
    const id = current, prev = node;
    node = build(id, tab);
    if (prev && prev.parentNode) prev.parentNode.replaceChild(node, prev);
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
      default: return shell('—');
    }
  }

  /* ---------------------------------------------------------------- shop */

  function buildShop(tab) {
    const d = VF.state.data;
    const p = shell('Shop', 'Everything you will ever need, eventually');
    p.appendChild(tabs([{ id: 'rods', label: 'Rods' }, { id: 'bait', label: 'Bait' }], tab,
      function (t) { refresh(t); }));
    const b = body();

    if (tab === 'rods') {
      const eq = VF.rods.get(d.rod);
      const list = U.el('div', 'list');
      VF.rods.list.forEach(function (rod) {
        const owned = d.ownedRods.indexOf(rod.id) >= 0;
        const levelOk = d.level >= rod.level;
        const voidOk = !rod.requiresVoidCatch || d.stats.voidCatches >= 1;
        const locked = !levelOk || !voidOk;
        const can = VF.economy.canAfford(rod.cost);

        const row = U.el('div', 'row' + (owned ? ' owned' : '') + (locked && !owned ? ' locked' : '') +
                                  (d.rod === rod.id ? ' equipped' : ''));
        const mark = U.el('div', 'row-mark');
        mark.style.background = owned ? 'var(--good)' : (locked ? 'var(--line-2)' : 'var(--accent)');
        row.appendChild(mark);

        const main = U.el('div', 'row-main');
        const name = U.el('div', 'row-name');
        name.appendChild(U.el('span', null, rod.name));
        if (d.rod === rod.id) {
          const t = U.el('span', 'tag', 'equipped'); t.style.color = 'var(--accent)'; name.appendChild(t);
        } else if (owned) {
          const t = U.el('span', 'tag', 'owned'); t.style.color = 'var(--good)'; name.appendChild(t);
        }
        main.appendChild(name);
        main.appendChild(U.el('div', 'row-desc', locked && !owned
          ? (!levelOk ? 'Requires level ' + rod.level : 'Requires a Void-tier catch')
          : rod.desc));

        // comparison arrows only matter when deciding whether to buy
        const c = owned ? function () { return 0; } : cmp;
        const grid = U.el('div', 'stat-grid');
        grid.appendChild(statCell('Cast', rod.cast.toFixed(2), c(rod.cast, eq.cast)));
        grid.appendChild(statCell('Reel', rod.reel.toFixed(2), c(rod.reel, eq.reel)));
        grid.appendChild(statCell('Line', rod.line.toFixed(2), c(rod.line, eq.line)));
        grid.appendChild(statCell('Rare', '×' + rod.rare.toFixed(2), c(rod.rare, eq.rare)));
        grid.appendChild(statCell('Luck', '+' + rod.luck.toFixed(2), c(rod.luck, eq.luck)));
        main.appendChild(grid);
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

  /* ------------------------------------------------------------- fishdex */

  function buildDex() {
    const d = VF.state.data;
    const found = Object.keys(d.fishdex).length;
    const p = shell('Fishdex', found + ' of ' + VF.fish.count + ' species recorded');
    const b = body();

    const bar = U.el('div', 'dex-toolbar');
    const segR = U.el('div', 'seg');
    [{ id: 'all', label: 'All' }].concat(VF.rarities.list.map(function (r) {
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

    const list = VF.fish.list.filter(function (f) {
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
      cell.appendChild(U.el('div', 'dex-rec', has
        ? (entry.record ? U.weight(entry.record.kg) + ' · ×' + entry.caught : '×' + entry.caught)
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
    VF.fishArt.draw(g, f, 62, { time: 1.2, mutation: entry.record ? entry.record.mutation : null });
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
    const muts = Object.keys(entry.mutations || {});
    if (muts.length) {
      meta.appendChild(kv('Mutations seen', muts.map(function (x) {
        return VF.mutations.get(x).name + ' ×' + entry.mutations[x];
      }).join(', ')));
    }
    bd.appendChild(meta);

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
      { id: 'catches', label: 'Catches (' + d.kept.length + ')' },
      { id: 'rods', label: 'Rods' },
      { id: 'bait', label: 'Bait' }
    ], tab, function (t) { refresh(t); }));
    const b = body();

    if (tab === 'catches') {
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
          const mut = VF.mutations.get(k.mutation);
          const row = U.el('div', 'row');
          const mark = U.el('div', 'row-mark');
          mark.style.background = r.color;
          row.appendChild(mark);
          const main = U.el('div', 'row-main');
          const name = U.el('div', 'row-name');
          name.appendChild(U.el('span', null, f.name));
          const tg = U.el('span', 'tag', r.name); tg.style.color = r.color; name.appendChild(tg);
          if (mut) { const mt = U.el('span', 'tag', mut.name); mt.style.color = mut.color; name.appendChild(mt); }
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
          const row = U.el('div', 'row' + (d.rod === rod.id ? ' equipped' : ' owned'));
          const mark = U.el('div', 'row-mark');
          mark.style.background = rod.art.tip;
          row.appendChild(mark);
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

  function buildMap() {
    const d = VF.state.data;
    const p = shell('Where To Fish', 'Deeper water, stranger catches');
    const b = body();
    const list = U.el('div', 'loc-list');

    let shownLocked = 0;
    VF.locations.list.forEach(function (loc) {
      const unlocked = VF.locations.isUnlocked(loc.id);
      const isCur = d.location === loc.id;
      // only tease the next locked spot, so the map keeps its mystery
      if (!unlocked) { shownLocked++; if (shownLocked > 1) return; }

      const el = U.el('div', 'loc' + (isCur ? ' current' : '') + (unlocked ? '' : ' locked'));
      const mark = U.el('div', 'loc-mark');
      mark.style.background = unlocked ? loc.glow : 'var(--line-2)';
      el.appendChild(mark);

      const main = U.el('div');
      main.appendChild(U.el('div', 'loc-name', unlocked ? loc.name : '???'));
      main.appendChild(U.el('div', 'loc-tag', unlocked ? loc.tag : loc.hint));
      if (unlocked) {
        main.appendChild(U.el('div', 'loc-desc', loc.desc));
        const meta = U.el('div', 'loc-meta');
        meta.appendChild(U.el('span', null, 'rarity ×' + loc.rarityBoost.toFixed(2)));
        meta.appendChild(U.el('span', null, 'value ×' + loc.valueBoost.toFixed(2)));
        meta.appendChild(U.el('span', null, 'xp ×' + loc.xpBoost.toFixed(1)));
        main.appendChild(meta);
      } else {
        main.appendChild(U.el('div', 'loc-desc', 'Unlocks at level ' + loc.level + ' · you are level ' + d.level));
      }
      el.appendChild(main);

      const side = U.el('div', 'row-side');
      if (isCur) side.appendChild(U.el('div', 'row-price', 'you are here'));
      else if (unlocked) {
        const btn = U.el('button', 'btn btn-sm btn-primary', 'Travel');
        btn.addEventListener('click', function () { travel(loc.id); });
        side.appendChild(btn);
      } else {
        side.appendChild(U.el('div', 'row-price cant', 'LV ' + loc.level));
      }
      el.appendChild(side);
      list.appendChild(el);
    });

    b.appendChild(list);
    p.appendChild(b);
    return p;
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
    [['Hold Space / click', 'charge and cast, set the hook, reel'],
     ['R', 'reel the line back in'],
     ['Q / F / B / T / M', 'shop, fishdex, bag, record, map'],
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
      ? 'Progress saves automatically to this browser. Closing the tab is safe.'
      : 'Storage is unavailable in this browser, so progress will not persist.';
    data.appendChild(info);
    const row = U.el('div', 'set-row');
    const resetBtn = U.el('button', 'btn btn-sm btn-danger', 'Reset everything');
    resetBtn.addEventListener('click', confirmReset);
    row.appendChild(resetBtn);
    data.appendChild(row);
    b.appendChild(data);

    p.appendChild(b);
    return p;
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

  VF.panels = { init: init, open: open, close: close, isOpen: isOpen, refresh: refresh };
})(window.VF = window.VF || {});
