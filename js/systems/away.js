/* VOID FISHING — the line you left out.

   The temptation here is idle income, and idle income would be the wrong game.
   Numbers going up while you sleep turn a quiet thing you choose to sit in
   into a thing that is owed to you, and then into a thing you check rather
   than play.

   So: one. Not one per hour, not one that stacks, not one worth more the
   longer you were away — one, or nothing, and nothing is common. It is caught
   on the rod and the bait you left equipped, at the water you left the line
   in, because you left it there. There is no timer to watch, nothing accrues,
   and coming back after a week is worth exactly what coming back after a night
   is worth, which is a single fish and the sentence about it. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Long enough that it is genuinely a return rather than a reload. */
  const MIN_AWAY = 6 * 3600 * 1000;
  /* And past this it stops mattering how much longer it was. */
  const FULL_AWAY = 30 * 3600 * 1000;

  const BASE_CHANCE = 0.30;
  const FULL_CHANCE = 0.72;

  let pending = null;      // the catch waiting to be shown, once the game starts

  /* Where the rod was left, written on the way out rather than reconstructed
     on the way in — the loadout may well have been changed since. */
  function mark() {
    const d = VF.state.data;
    d.away = {
      at: Date.now(),
      location: d.location,
      rod: d.rod,
      bait: d.bait
    };
  }

  /* Roll for it, once, on boot. Returns the catch or null and clears the mark
     either way, so a refusal cannot be re-rolled by reloading. */
  function claim() {
    const d = VF.state.data;
    const a = d.away;
    d.away = null;
    if (!a || !a.at) return null;
    if (d.stats.casts < 5) return null;          // not before the game has started

    const gone = Date.now() - a.at;
    if (gone < MIN_AWAY) return null;
    // a clock that went backwards is not a week away
    if (gone > 400 * 24 * 3600 * 1000) return null;

    const k = U.clamp((gone - MIN_AWAY) / (FULL_AWAY - MIN_AWAY), 0, 1);
    if (VF.rng.g() > BASE_CHANCE + (FULL_CHANCE - BASE_CHANCE) * k) return null;

    /* Rolled on the gear that was actually in the water. Swapped in, rolled,
       swapped back, so nothing else in the game sees the loadout flicker. */
    const was = { location: d.location, rod: d.rod, bait: d.bait };
    let c = null;
    try {
      if (VF.locations.isRegistered(a.location) &&
          d.unlockedLocations.indexOf(a.location) >= 0) d.location = a.location;
      if (VF.rods.get(a.rod).id === a.rod && d.ownedRods.indexOf(a.rod) >= 0) d.rod = a.rod;
      if (VF.bait.get(a.bait).id === a.bait) d.bait = a.bait;
      VF.loot.invalidatePool();
      c = VF.loot.roll({});
      c.kind = 'fish';
      c.away = true;
      c.awayFor = gone;
    } catch (e) {
      c = null;
    }
    d.location = was.location; d.rod = was.rod; d.bait = was.bait;
    VF.loot.invalidatePool();
    return c;
  }

  /* Landing it. Everything the ordinary path records has to be recorded here
     too — the fishdex, the records, the experience — or a fish caught this way
     is a fish that did not happen. Rather than duplicate all of that, it is
     handed to the fishing loop as a fight that has already been won. */
  function land(c) {
    VF.fishing.acceptCatch(c);
  }

  function howLong(ms) {
    const h = ms / 3600000;
    if (h < 20) return 'overnight';
    if (h < 48) return 'a day';
    const days = Math.round(h / 24);
    return days < 7 ? days + ' days' : days < 14 ? 'a week' : 'a while';
  }

  /* Called once the player has actually pressed Begin — a catch card over the
     title screen would be a strange way to say hello. */
  function announce() {
    if (!pending) return false;
    const c = pending;
    pending = null;
    VF.toast.show('<strong>the line was still out</strong><br>' +
                  '<span style="color:var(--ink-3)">' +
                  U.esc(howLong(c.awayFor)) + ', and something took it</span>', null, 5200);
    setTimeout(function () { land(c); }, 1400);
    return true;
  }

  function boot() {
    pending = claim();
    return !!pending;
  }

  VF.away = {
    mark: mark,
    boot: boot,
    announce: announce,
    has: function () { return !!pending; },
    MIN_AWAY: MIN_AWAY
  };

  /* The mark goes down whenever the game is put down. beforeunload is not
     reliable on a phone — the tab is more often backgrounded than closed — so
     visibility carries it too, and save.js is already listening to both for
     the same reason. */
  window.addEventListener('beforeunload', mark);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') mark();
  });
})(window.VF = window.VF || {});
