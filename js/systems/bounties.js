/* VOID FISHING — somebody wants a particular fish.

   The verb this game did not have was going fishing FOR something. You cast
   and you took what arrived; the only way to want a specific fish was to
   decide privately to want it, and nothing in the game ever noticed. A board
   turns a session into a plan — this bait, this weather, this spot, that fish
   — and it is the only thing here that ever asks you for something by name.

   It is also the answer to two other problems. The endgame's income was
   selling, at about two hundred catches for the last rod, and a board is money
   that is not selling. And good gear stops finding small fish, so a request
   for a shore common is a reason to put the plain worm on and go back, which
   is a choice rather than a chore reverse-engineered.

   Deliberately small: three at a time, no timer, no streak, no board level.
   They sit there until they are filled. */
(function (VF) {
  'use strict';

  const U = VF.util;

  const SLOTS = 3;
  /* Long enough that the board is not a slot machine, short enough that a
     request you cannot fill is not a permanent occupant. */
  const REROLL_AFTER = 20 * 60 * 1000;

  /* Who asks, and what they are like about it. */
  const ASKERS = ['keeper', 'archivist', 'fisherman', 'collector'];

  function st() {
    const d = VF.state.data;
    if (!d.bounties || typeof d.bounties !== 'object' || Array.isArray(d.bounties)) {
      d.bounties = { list: [], at: 0 };
    }
    if (!Array.isArray(d.bounties.list)) d.bounties.list = [];
    return d.bounties;
  }

  /* --------------------------------------------------------------- rolling */

  /* Species a request could name: reachable somewhere the player has been,
     and not from a tier that is a lightning strike. Asking for a Void fish is
     asking for a month. */
  function candidates() {
    const d = VF.state.data;
    const seen = d.unlockedLocations;
    return VF.fish.list.filter(function (f) {
      if (f.hidden || f.event) return false;
      const rank = VF.rarities.rank(f.rarity);
      if (rank > 4) return false;                 // legendary at the very top
      if (!f.locs.length) return false;           // the ones from nowhere
      for (let i = 0; i < f.locs.length; i++) if (seen.indexOf(f.locs[i]) >= 0) return true;
      return false;
    });
  }

  /* What a request is worth. Read off the fish rather than invented, so a
     board reward can never be better than fishing is and can never be so
     thin it is not worth reading. */
  function payFor(f, count) {
    const r = VF.rarities.get(f.rarity);
    const base = f.value * (1.9 + VF.rarities.rank(f.rarity) * 0.55);
    return Math.max(60, Math.round(base * count));
  }

  function rollOne(taken) {
    const pool = candidates().filter(function (f) { return taken.indexOf(f.id) < 0; });
    if (!pool.length) return null;
    const f = VF.rng.g.pick(pool);
    const rank = VF.rarities.rank(f.rarity);
    /* Fewer of the rare ones. Three legendaries would be a wall, and one
       common is not a request, it is an accident waiting to happen. */
    const count = rank <= 1 ? VF.rng.g.int(2, 4)
                : rank <= 2 ? VF.rng.g.int(1, 3)
                : rank <= 3 ? VF.rng.g.int(1, 2) : 1;
    return {
      id: 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      fish: f.id,
      want: count,
      have: 0,
      pay: payFor(f, count),
      who: VF.rng.g.pick(ASKERS),
      at: Date.now()
    };
  }

  /* Fill empty slots. Never replaces a standing request — the board is a
     board, not a rotation. */
  function refresh(force) {
    const s = st();
    const now = Date.now();
    if (!force && s.list.length >= SLOTS) return false;
    if (!force && now - (s.at || 0) < REROLL_AFTER && s.list.length) return false;
    const taken = s.list.map(function (b) { return b.fish; });
    let added = 0;
    while (s.list.length < SLOTS) {
      const b = rollOne(taken);
      if (!b) break;
      taken.push(b.fish);
      s.list.push(b);
      added++;
    }
    if (added) { s.at = now; VF.bus.emit('bounty:posted', added); }
    return added > 0;
  }

  /* --------------------------------------------------------------- filling */

  /* Every catch is offered to the board. A request only counts a fish that is
     actually kept, sold or released — that is, one that was landed — so this
     hangs off the same event the record does. */
  function offer(c) {
    if (!c || c.kind === 'treasure') return;
    const s = st();
    let changed = false;
    for (let i = 0; i < s.list.length; i++) {
      const b = s.list[i];
      if (b.fish !== c.id || b.have >= b.want) continue;
      b.have++;
      changed = true;
      if (b.have >= b.want) VF.bus.emit('bounty:ready', b);
      else VF.bus.emit('bounty:progress', b);
    }
    if (changed) VF.save.save();
  }

  function ready(b) { return b.have >= b.want; }
  function anyReady() { return st().list.some(ready); }

  /* Handing one in. Paid here rather than on the catch, so the board is
     somewhere you go rather than something that happens to you. */
  function claim(id) {
    const s = st();
    const i = s.list.findIndex(function (b) { return b.id === id; });
    if (i < 0) return null;
    const b = s.list[i];
    if (!ready(b)) return null;
    s.list.splice(i, 1);
    VF.economy.earn(b.pay, 'bounty');
    const d = VF.state.data;
    d.stats.bounties = (d.stats.bounties | 0) + 1;
    VF.bus.emit('bounty:claimed', b);
    refresh(true);
    VF.save.save();
    return b;
  }

  /* Giving up on one. It costs nothing but the slot, and without it a request
     for something the player cannot reach sits there forever. */
  function drop(id) {
    const s = st();
    const i = s.list.findIndex(function (b) { return b.id === id; });
    if (i < 0) return false;
    s.list.splice(i, 1);
    refresh(true);
    VF.save.save();
    return true;
  }

  function list() { return st().list.slice(); }

  VF.bounties = {
    SLOTS: SLOTS,
    list: list,
    refresh: refresh,
    claim: claim,
    drop: drop,
    ready: ready,
    anyReady: anyReady,
    offer: offer
  };

  VF.bus.on('fishing:landed', offer);
})(window.VF = window.VF || {});
