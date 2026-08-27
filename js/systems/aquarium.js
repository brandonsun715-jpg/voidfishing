/* VOID FISHING — the aquarium.

   Three verbs used to be the whole of what happened after a fish was landed:
   sell it, keep it, let it go. Selling pays, releasing buys luck, and keeping
   put a row in a list that nothing ever read again — including the player.
   The wall fixed a handful of them. This is the rest of the answer.

   A specimen in a tank is somewhere you go rather than something you own. It
   remembers the evening it was caught, down to the weather and what was on the
   hook. It pays a little for its own glass. And if you leave it long enough,
   and put the right thing next to it, the room tells you something about the
   water that is not written down anywhere else — including, three times, a
   species that was not in the game until the tank worked out that it should be.

   What this file does NOT do is turn the game into one you check rather than
   play. The income is small on purpose and the buffer stops filling after six
   hours, for the same reason js/systems/away.js gives you one fish and not one
   per hour: a quiet thing you choose to sit in should not become a thing that
   is owed to you. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const A = VF.aquariumData;

  /* ------------------------------------------------------------- the state

     Lives on the save under `aquarium`. Shaped here rather than in state.js so
     an older save grows one the first time the door is opened, which is also
     what happens to a save from before this existed. */
  function st() {
    const d = VF.state.data;
    let a = d.aquarium;
    if (!a || !Array.isArray(a.tanks) || !a.tanks.length) {
      a = d.aquarium = {
        tanks: [{ slots: A.TANK_BASE, fish: [] }],
        research: {},          // species id -> 0..1
        seen: {},              // "species:milestone" -> true, so a line fires once
        log: [],               // { id, title, text, kind, at }
        bank: 0,               // Jias earned and not yet collected
        at: Date.now()         // when the bank was last brought up to date
      };
    }
    if (!a.research) a.research = {};
    if (!a.seen) a.seen = {};
    if (!a.log) a.log = [];
    if (typeof a.bank !== 'number') a.bank = 0;
    if (!a.at) a.at = Date.now();
    if (!d.discovered) d.discovered = {};
    return a;
  }

  /* ------------------------------------------------------------- the room */

  function tanks() { return st().tanks; }
  function tankCount() { return st().tanks.length; }

  function nextTank() {
    const have = tankCount();
    if (have >= A.TANKS.length) return null;
    const def = A.TANKS[have];
    return { index: have, cost: def.cost, level: def.level,
             locked: VF.state.data.level < def.level };
  }

  function addTank() {
    const n = nextTank();
    if (!n || n.locked) return false;
    if (n.cost > 0 && !VF.economy.spend(n.cost, 'aquarium')) return false;
    st().tanks.push({ slots: A.TANK_BASE, fish: [] });
    VF.bus.emit('aquarium:changed');
    VF.save.save();
    return true;
  }

  function slotUpgrade(i) {
    const t = st().tanks[i];
    if (!t) return null;
    if (t.slots >= A.TANK_MAX_SLOTS) return null;
    return { cost: A.slotCost(t.slots), from: t.slots, to: t.slots + A.TANK_STEP };
  }

  function upgradeTank(i) {
    const up = slotUpgrade(i);
    if (!up) return false;
    if (!VF.economy.spend(up.cost, 'aquarium')) return false;
    st().tanks[i].slots = up.to;
    VF.bus.emit('aquarium:changed');
    VF.save.save();
    return true;
  }

  function space(i) {
    const t = st().tanks[i];
    if (!t) return 0;
    return Math.max(0, t.slots - t.fish.length);
  }

  function housed() {
    let n = 0;
    st().tanks.forEach(function (t) { n += t.fish.length; });
    return n;
  }

  /* ---------------------------------------------------------- the specimens

     Housing takes the fish out of the bag, the same way mounting one does.
     That is the point of both: a catch stops being inventory. */

  function house(keptIndex, tankIndex) {
    const d = VF.state.data;
    const a = st();
    const t = a.tanks[tankIndex];
    if (!t) return false;
    if (keptIndex < 0 || keptIndex >= d.kept.length) return false;
    if (!space(tankIndex)) return false;
    settle();
    const k = d.kept.splice(keptIndex, 1)[0];
    if (!k) return false;
    k.housedAt = Date.now();
    t.fish.push(k);
    VF.bus.emit('aquarium:changed');
    checkFindings();
    VF.save.save();
    return true;
  }

  /* Back to the bag — which may itself be full, and refusing is better than
     deleting. */
  function retrieve(tankIndex, i) {
    const d = VF.state.data;
    const t = st().tanks[tankIndex];
    if (!t || i < 0 || i >= t.fish.length) return false;
    if (d.kept.length >= VF.catches.KEEP_LIMIT) return false;
    settle();
    const k = t.fish.splice(i, 1)[0];
    delete k.housedAt;
    d.kept.push(k);
    VF.bus.emit('aquarium:changed');
    VF.save.save();
    return true;
  }

  /* Its own door rather than going through the bag, so it is never something
     that happens on the way to selling everything else. */
  function sellFrom(tankIndex, i) {
    if (VF.runs && !VF.runs.sellAllowed()) return 0;
    const t = st().tanks[tankIndex];
    if (!t || i < 0 || i >= t.fish.length) return 0;
    settle();
    const k = t.fish.splice(i, 1)[0];
    VF.economy.earn(k.value, 'aquarium');
    VF.state.data.stats.sold++;
    VF.audio.sell();
    VF.bus.emit('aquarium:changed');
    VF.save.save();
    return k.value;
  }

  function move(fromTank, i, toTank) {
    const a = st();
    const f = a.tanks[fromTank], t = a.tanks[toTank];
    if (!f || !t || fromTank === toTank) return false;
    if (i < 0 || i >= f.fish.length) return false;
    if (!space(toTank)) return false;
    t.fish.push(f.fish.splice(i, 1)[0]);
    VF.bus.emit('aquarium:changed');
    checkFindings();
    VF.save.save();
    return true;
  }

  /* ------------------------------------------------------------ the income

     Per second, across everything housed. Small: see the note at the top. */
  function rate() {
    let n = 0;
    st().tanks.forEach(function (t) {
      t.fish.forEach(function (k) { n += (k.value || 0) * A.RATE; });
    });
    return n;
  }

  /* Bring the bank up to the wall clock. Called on every tick, on the way in,
     and before anything that changes what is housed — so the money a specimen
     earned is banked before it is taken out of the tank. */
  function settle() {
    const a = st();
    const now = Date.now();
    const gone = Math.max(0, now - a.at) / 1000;
    a.at = now;
    if (gone <= 0) return;
    // a clock that went backwards, or a machine that slept for a fortnight
    const capped = Math.min(gone, A.BUFFER_HOURS * 3600);
    a.bank += rate() * capped;
  }

  function bank() { settle(); return st().bank; }

  function collect() {
    settle();
    const a = st();
    const n = Math.floor(a.bank);
    if (n < 1) return 0;
    a.bank -= n;
    VF.economy.earn(n, 'aquarium');
    VF.audio.sell();
    VF.bus.emit('aquarium:changed');
    VF.save.save();
    return n;
  }

  /* ---------------------------------------------------------- the research */

  function research(id) { return U.clamp(st().research[id] || 0, 0, 1); }

  /* How fast a species fills up: rarer is slower, and a second specimen of the
     same species helps without doubling the pace — two Moonfish are still one
     Moonfish as far as anybody watching them learns. */
  function researchRate(speciesId, n) {
    const rank = VF.rarities.rank((VF.fish.byId(speciesId) || {}).rarity || 'common');
    return A.RESEARCH_RATE / (1 + rank * 0.55) * Math.sqrt(Math.max(1, n));
  }

  function counts() {
    const out = Object.create(null);
    st().tanks.forEach(function (t) {
      t.fish.forEach(function (k) { out[k.id] = (out[k.id] | 0) + 1; });
    });
    return out;
  }

  let acc = 0;
  function tick(dt) {
    const d = VF.state.data;
    if (!d.aquarium) return;              // not opened yet: nothing to run
    /* Once a second is plenty for a bar that takes half an hour to fill, and
       it keeps the findings check off the frame budget entirely. */
    acc += dt;
    if (acc < 1) return;
    const step = acc;
    acc = 0;

    settle();
    const a = st();
    const c = counts();
    let fired = false;
    for (const id in c) {
      const before = a.research[id] || 0;
      if (before >= 1) continue;
      const after = U.clamp(before + researchRate(id, c[id]) * step, 0, 1);
      a.research[id] = after;
      for (let i = 0; i < A.MILESTONES.length; i++) {
        const m = A.MILESTONES[i];
        if (before < m.at && after >= m.at) { announce(id, m); fired = true; }
      }
    }
    if (fired) { checkFindings(); VF.save.save(); }
  }

  function announce(speciesId, m) {
    const f = VF.fish.byId(speciesId);
    if (!f) return;
    const a = st();
    const key = speciesId + ':' + m.at;
    if (a.seen[key]) return;
    a.seen[key] = true;
    VF.bus.emit('aquarium:research', { fish: f, milestone: m });
    if (m.at >= 1) {
      VF.toast.show('<strong>' + U.esc(f.name) + '</strong> — research complete' +
                    '<br><span style="color:var(--ink-3)">the desk has something to say about it</span>',
                    'good', 5200);
    }
  }

  /* -------------------------------------------------------- the discoveries

     Both halves fully researched AND both in the same tank. Two conditions
     rather than one, because "study these two" and "put them together" are
     different instructions and the second one is the interesting one. */

  function pairState(rec) {
    const a = st();
    const ra = research(rec.a), rb = research(rec.b);
    let together = false;
    a.tanks.forEach(function (t) {
      let ha = false, hb = false;
      t.fish.forEach(function (k) { if (k.id === rec.a) ha = true; if (k.id === rec.b) hb = true; });
      if (ha && hb) together = true;
    });
    return {
      rec: rec,
      done: !!VF.state.data.discovered[rec.id],
      a: ra, b: rb,
      ready: ra >= 1 && rb >= 1,
      together: together
    };
  }

  /* Everything the desk is allowed to talk about: a recipe stays invisible
     until at least one half of it has been studied to the end, so the list is
     something you uncover rather than a checklist handed over on day one. */
  function findings() {
    return A.DISCOVERIES.map(pairState).filter(function (p) {
      return p.done || p.a >= 1 || p.b >= 1;
    });
  }

  function checkFindings() {
    const d = VF.state.data;
    A.DISCOVERIES.forEach(function (rec) {
      if (d.discovered[rec.id]) return;
      const p = pairState(rec);
      if (!p.ready || !p.together) return;
      grant(rec);
    });
  }

  function grant(rec) {
    const d = VF.state.data;
    d.discovered[rec.id] = Date.now();
    st().log.unshift({ id: rec.id, title: rec.title, text: rec.text,
                       kind: rec.kind, at: Date.now() });
    if (st().log.length > 40) st().log.pop();
    d.stats.discoveries = (d.stats.discoveries | 0) + 1;

    /* A new species has to reach the water, not just the log. */
    if (rec.kind === 'species' || rec.kind === 'lure') VF.loot.invalidatePool();

    VF.audio.stinger('grand', 5);
    VF.fx.flash('rgba(200,180,255,0.42)', 0.5, 1.6);
    VF.fx.pulse(0.7);
    VF.bus.emit('aquarium:discovery', rec);

    const what = rec.kind === 'species' ? 'a new species is in the water'
               : rec.kind === 'lure'    ? 'a new lure is on the shelf'
               : rec.kind === 'spot'    ? 'somewhere new to stand'
               : rec.kind === 'boss'    ? 'behaviour documented'
               : 'something down there, written down';
    VF.toast.show('<strong>NEW DISCOVERY — ' + U.esc(rec.title) + '</strong>' +
                  '<br><span style="color:var(--ink-3)">' + what + '</span>', 'good', 8000);
    VF.save.save();
  }

  /* What the desk says it is worth trying next: the strongest hint available,
     or nothing, which is also an answer. */
  function nextHint() {
    const list = A.DISCOVERIES.map(pairState).filter(function (p) { return !p.done; });
    // one that is ready and only needs putting together beats one still being studied
    const ready = list.filter(function (p) { return p.ready && !p.together; });
    if (ready.length) return ready[0];
    const half = list.filter(function (p) { return p.a >= 1 || p.b >= 1; })
                     .sort(function (x, y) { return (y.a + y.b) - (x.a + x.b); });
    return half.length ? half[0] : null;
  }

  /* Whether the room is open at all. It is not a menu that has always been
     there — somebody hands you the key once you have kept something. */
  function unlocked() {
    const d = VF.state.data;
    if (d.flags.aquarium) return true;
    if (d.level >= 6 || d.kept.length || (d.aquarium && housed())) {
      d.flags.aquarium = true;
      return true;
    }
    return false;
  }

  VF.aquarium = {
    state: st, tanks: tanks, tankCount: tankCount,
    nextTank: nextTank, addTank: addTank,
    slotUpgrade: slotUpgrade, upgradeTank: upgradeTank,
    space: space, housed: housed,
    house: house, retrieve: retrieve, sellFrom: sellFrom, move: move,
    rate: rate, bank: bank, collect: collect, settle: settle,
    research: research, counts: counts, tick: tick,
    findings: findings, pairState: pairState, nextHint: nextHint,
    checkFindings: checkFindings,
    log: function () { return st().log; },
    unlocked: unlocked
  };
})(window.VF = window.VF || {});
