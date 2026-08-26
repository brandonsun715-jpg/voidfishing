/* VOID FISHING — the wall.

   Keeping was the weakest of the three verbs. Selling gives money, releasing
   gives luck, and keeping gave you a row in a list that silently deleted its
   own oldest entry once there were two hundred of them. Nothing looked at a
   kept fish ever again, including the player.

   A wall is somewhere for them to go. A handful of mounts, each holding one
   catch drawn at the size it actually was, with what it weighed and what it
   was carrying on the plate underneath. It costs no new art — the creature is
   the same procedural drawing the catch card uses — and it gives the bag a
   reason to have a limit, because a mount is a decision about which one.

   Mounting takes the fish out of the bag. That is the point: the wall is
   where a catch stops being inventory. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Room on it. Two to start with, because two is enough to make the second
     one a choice, and it opens up as the game does. */
  const AT_LEVEL = [1, 1, 12, 26, 42, 60, 82];

  function mounts() {
    const lv = VF.state.data.level;
    let n = 0;
    for (let i = 0; i < AT_LEVEL.length; i++) if (lv >= AT_LEVEL[i]) n++;
    return n;
  }

  function nextAt() {
    const lv = VF.state.data.level;
    for (let i = 0; i < AT_LEVEL.length; i++) if (lv < AT_LEVEL[i]) return AT_LEVEL[i];
    return 0;
  }

  function wall() {
    const d = VF.state.data;
    if (!Array.isArray(d.wall)) d.wall = [];
    return d.wall;
  }

  function count() { return wall().length; }
  function full() { return count() >= mounts(); }

  /* Take one out of the bag and put it up. */
  function mount(index) {
    const d = VF.state.data;
    if (index < 0 || index >= d.kept.length) return false;
    if (full()) return false;
    const k = d.kept.splice(index, 1)[0];
    if (!k) return false;
    k.mountedAt = Date.now();
    wall().push(k);
    VF.bus.emit('wall:changed');
    VF.save.save();
    return true;
  }

  /* And take one down. It goes back to the bag, which may itself be full —
     refusing is better than deleting, and better than a fish that is neither
     on the wall nor in the bag. */
  function unmount(index) {
    const d = VF.state.data;
    const w = wall();
    if (index < 0 || index >= w.length) return false;
    if (d.kept.length >= VF.catches.KEEP_LIMIT) return false;
    const k = w.splice(index, 1)[0];
    delete k.mountedAt;
    d.kept.push(k);
    VF.bus.emit('wall:changed');
    VF.save.save();
    return true;
  }

  /* Selling one off the wall. Deliberately its own door rather than going
     through the bag, so it is never something that happens by accident on the
     way to selling everything else. */
  function sell(index) {
    if (VF.runs && !VF.runs.sellAllowed()) return 0;
    const w = wall();
    if (index < 0 || index >= w.length) return 0;
    const k = w.splice(index, 1)[0];
    VF.economy.earn(k.value, 'wall');
    VF.state.data.stats.sold++;
    VF.audio.sell();
    VF.bus.emit('wall:changed');
    VF.save.save();
    return k.value;
  }

  /* What the wall is worth, which is the only number it keeps. */
  function value() {
    return wall().reduce(function (n, k) { return n + (k.value | 0); }, 0);
  }

  /* The heaviest thing on it, for anything that wants a one-line summary. */
  function best() {
    let out = null;
    wall().forEach(function (k) { if (!out || k.kg > out.kg) out = k; });
    return out;
  }

  VF.wall = {
    AT_LEVEL: AT_LEVEL,
    list: wall,
    mounts: mounts,
    nextAt: nextAt,
    count: count,
    full: full,
    mount: mount,
    unmount: unmount,
    sell: sell,
    value: value,
    best: best
  };
})(window.VF = window.VF || {});
