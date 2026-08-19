/* VOID FISHING — the catch card.
   The payoff screen: species art, rarity, mutation, size against the species
   record, value, and what to do with it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  let host = null, card = null, open = false, raf = 0, art = null, artCtx = null;
  let current = null, artT = 0, lastFrame = 0;

  function init() {
    host = document.getElementById('modal');
    VF.bus.on('fishing:landed', function (c) { setTimeout(function () { show(c); }, 340); });
  }

  function banner(c) {
    if (c.rarity === 'glitch') return { text: 'THIS SHOULD NOT BE HERE', color: '#ff2d55' };
    if (c.isNew) return { text: 'NEW DISCOVERY', color: VF.rarities.color(c.rarity) };
    if (c.isGiant) return { text: 'ENORMOUS', color: '#ffb03a' };
    if (c.isRecord) return { text: 'PERSONAL BEST', color: '#6fd8a4' };
    return { text: VF.rarities.get(c.rarity).name, color: VF.rarities.color(c.rarity) };
  }

  function show(c) {
    if (!c || open) return;
    current = c;
    open = true;
    VF.state.rt.panelOpen = 'catch';

    const r = VF.rarities.get(c.rarity);
    const mut = c.mutationDef;
    const b = banner(c);
    const rank = r.rank;

    /* --- audio + screen feedback scaled to how special this is --- */
    VF.audio.stinger(r.stinger, rank);
    if (r.shake > 0) VF.fx.shake(r.shake, 3.6);
    if (rank >= 2) VF.fx.flash(U.rgbToCss(U.hexToRgb(r.glow), 0.20), 0.24 + rank * 0.035, 1.8);
    if (rank >= 4 || c.isGiant) VF.fx.pulse(0.55);
    if (mut) VF.fx.flash(U.rgbToCss(U.hexToRgb(mut.color), 0.18), 0.22, 2.0);

    const scn = VF.scene.L;
    VF.particles.burst(scn.landPoint.x, scn.landPoint.y, 14 + rank * 5, {
      color: U.hexToRgb(r.glow), angle: -Math.PI / 2, spread: 2.0,
      speedMin: 40, speedMax: 130 + rank * 30, sizeMax: 2.6, grav: 260, lifeMax: 1.0
    });

    /* --- build the card --- */
    card = U.el('div', 'catch-card');

    const ban = U.el('div', 'catch-banner', b.text);
    ban.style.background = b.color;
    card.appendChild(ban);

    const hero = U.el('div', 'catch-hero');
    hero.style.background = 'radial-gradient(ellipse at 50% 55%, ' +
      U.rgbToCss(U.hexToRgb(r.glow), 0.14) + ', rgba(0,0,0,0) 68%)';
    art = U.el('canvas');
    art.width = 400; art.height = 168;
    art.style.width = '100%'; art.style.height = '168px';
    artCtx = art.getContext('2d');
    hero.appendChild(art);
    card.appendChild(hero);

    const body = U.el('div', 'catch-body');

    if (c.isRecord && !c.isNew) {
      const flag = U.el('div', 'record-flag');
      flag.appendChild(U.el('span', null, '↑'));
      flag.appendChild(U.el('span', null, 'beat your previous best'));
      body.appendChild(flag);
    }

    const rr = U.el('div', 'catch-rarity', r.name);
    rr.style.color = b.color;
    body.appendChild(rr);

    body.appendChild(U.el('h2', 'catch-name', c.fish.name));

    if (mut) {
      const m = U.el('div', 'catch-mut', mut.name + ' · value ×' + mut.mult);
      m.style.color = mut.color;
      body.appendChild(m);
    }

    body.appendChild(U.el('p', 'catch-desc', mut ? mut.desc : c.fish.desc));

    const metrics = U.el('div', 'catch-metrics');
    metrics.appendChild(metric('Weight', U.weight(c.kg)));
    metrics.appendChild(metric('Length', U.length(c.m)));
    metrics.appendChild(metric('Size', U.ordinalPercentile(c.pct)));
    body.appendChild(metrics);

    const track = U.el('div', 'size-track');
    const fill = U.el('div', 'size-fill');
    fill.style.background = 'linear-gradient(90deg, ' + U.rgbToCss(U.hexToRgb(r.color), 0.35) + ', ' + r.glow + ')';
    track.appendChild(fill);
    body.appendChild(track);

    const note = U.el('div', 'size-note');
    note.appendChild(U.el('span', null, 'runt'));
    note.appendChild(U.el('span', null, c.isGiant ? 'a specimen' : 'giant'));
    body.appendChild(note);

    const val = U.el('div', 'catch-value');
    const coin = U.el('span', 'coin', '◈');
    coin.style.color = 'var(--accent)';
    val.appendChild(coin);
    val.appendChild(U.el('span', 'amt', U.money(c.value)));
    body.appendChild(val);

    const acts = U.el('div', 'catch-actions');
    const sellBtn = U.el('button', 'btn btn-primary', 'Sell');
    sellBtn.addEventListener('click', function () { act('sell'); });
    const keepBtn = U.el('button', 'btn', 'Keep');
    keepBtn.title = 'Store it in your bag. Sell it later.';
    keepBtn.addEventListener('click', function () { act('keep'); });
    const relBtn = U.el('button', 'btn', 'Release');
    relBtn.title = 'Let it go for reputation, which quietly improves your luck.';
    relBtn.addEventListener('click', function () { act('release'); });
    acts.appendChild(sellBtn); acts.appendChild(keepBtn); acts.appendChild(relBtn);
    body.appendChild(acts);

    card.appendChild(body);
    U.clear(host);
    host.appendChild(card);
    host.classList.remove('hidden');

    requestAnimationFrame(function () { fill.style.width = (c.pct * 100).toFixed(1) + '%'; });

    if (c.isNew) {
      VF.audio.discover();
      VF.toast.show('<strong>' + U.esc(c.fish.name) + '</strong> added to the Fishdex', 'good', 4200);
    }
    VF.achievements.check();

    artT = 0;
    lastFrame = performance.now();
    loop();
    setTimeout(function () { sellBtn.focus(); }, 60);
  }

  function metric(k, v) {
    const el = U.el('div', 'metric');
    el.appendChild(U.el('span', 'k', k));
    el.appendChild(U.el('span', 'v', v));
    return el;
  }

  function loop() {
    if (!open) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    artT += dt;

    const c = current;
    const g = artCtx;
    g.clearRect(0, 0, art.width, art.height);
    g.save();
    g.translate(art.width / 2, art.height / 2 + Math.sin(artT * 1.4) * 4);
    g.rotate(Math.sin(artT * 0.85) * 0.055);
    const size = fitSize(c.fish, 150);
    VF.fishArt.draw(g, c.fish, size, { time: artT, mutation: c.mutation });
    g.restore();
    raf = requestAnimationFrame(loop);
  }

  /* Keep very long or very tall species inside the hero box. */
  function fitSize(f, box) {
    const tall = { orb: 0.72, round: 0.62, blob: 0.58, jelly: 0.55, anomaly: 0.52,
                   fractal: 0.50, crustacean: 0.44, ray: 0.42, shard: 0.40, whale: 0.38 }[f.art.body] || 0.30;
    const byHeight = (box * 0.46) / (tall * 2);
    return Math.min(box * 0.42, byHeight);
  }

  function act(kind) {
    if (!open) return;
    let r;
    if (kind === 'sell') { r = VF.catches.sell(); if (r) VF.toast.show('Sold for <strong class="mono">' + U.money(r) + '</strong>', 'good', 2400); }
    else if (kind === 'keep') { VF.catches.keep(); VF.toast.plain('Kept in your bag', null, 2000); }
    else {
      const res = VF.catches.release();
      if (res) {
        let msg = 'Released · <span class="mono">+' + res.rep + '</span> reputation';
        if (res.bonus && res.bonus.kind === 'bait') msg += '<br><span style="color:var(--good)">Found: ' + U.esc(res.bonus.text) + '</span>';
        if (res.bonus && res.bonus.kind === 'money') msg += '<br><span style="color:var(--good)">Gratitude: ' + U.money(res.bonus.amount) + '</span>';
        VF.toast.show(msg, 'good', 3600);
      }
    }
    close();
  }

  function defaultAction() { act('sell'); }

  function close() {
    if (!open) return;
    open = false;
    VF.state.rt.panelOpen = null;
    cancelAnimationFrame(raf);
    raf = 0;
    if (card) card.classList.add('out');
    setTimeout(function () {
      host.classList.add('hidden');
      U.clear(host);
      card = null; art = null; artCtx = null; current = null;
    }, 210);
    VF.hud.pressEnd();
  }

  VF.catchUI = { init: init, isOpen: function () { return open; }, defaultAction: defaultAction, close: close };
})(window.VF = window.VF || {});
