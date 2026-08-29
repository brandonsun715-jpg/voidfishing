/* VOID FISHING — how often anything is allowed to happen.

   Every system in this game can produce a moment on its own schedule: the
   zone has a bottle and a sonar return and a crack, the crossing has eleven
   sea events, the creatures have seven triggers, the weather turns, a lead
   fires, the wanderer arrives. Each of those is tuned so that on its own it
   is rare. Together they are not rare at all, and an evening spent on the
   water becomes one thing after another with no gap between them.

   That is the whole problem with the expansion this module is a correction
   to. Nothing in it was too frequent. All of it together was, and there is
   no per-system number you can lower to fix that, because the fault is not
   in any of the systems — it is in there being nine of them.

   The fix is one clock. Anything notable spends from it; nothing notable is
   allowed while it is still being paid back. What that buys is the quiet
   stretch, which is not dead time: it is the thing the next event is
   measured against. A shape on the horizon after forty minutes of nothing is
   the best moment this game has. The same shape eight minutes after the last
   one is scenery.

   Weights are in seconds of quiet that the moment costs:

     1   small   a bottle, a shard, a mark on the flats
     2   real    a sonar return, a sea event, a lead firing
     3   large   an encounter, a resonance, a new place

   Nothing here blocks the player's own actions. Casting, catching, sailing,
   talking and buying are never gated — a governor that stops you fishing is
   a worse problem than the one it solves. It gates only what the world does
   at you while you are not asking. */
(function (VF) {
  'use strict';

  const COST = { 1: 26, 2: 95, 3: 240 };

  /* Held in memory rather than in the save. A quiet stretch that survives
     closing the game means the first five minutes of a session are dead,
     which is exactly backwards — coming back should be the good bit. */
  let debt = 0;
  let last = { 1: 0, 2: 0, 3: 0 };

  function tick(dt) {
    if (debt > 0) debt = Math.max(0, debt - dt);
  }

  /* Would a moment of this size be welcome right now? A large one can push
     past a small debt, because the whole point of the big ones is that they
     are allowed to interrupt — but not past another large one. */
  function allow(weight) {
    const w = weight | 0 || 1;
    if (w >= 3) return debt <= COST[2];
    return debt <= 0;
  }

  /* Took the moment. Costs its own weight and a little of the next one down,
     so three small things in a row cost more than three times one. */
  function spend(weight) {
    const w = weight | 0 || 1;
    debt = Math.min(COST[3] * 1.4, debt + COST[w] + (last[w] ? COST[w] * 0.5 : 0));
    last = { 1: 0, 2: 0, 3: 0 };
    last[w] = 1;
  }

  /* Both at once, for the common case. Returns whether it went ahead. */
  function take(weight) {
    if (!allow(weight)) return false;
    spend(weight);
    return true;
  }

  /* How long it has been quiet, as a 0..1 ramp. A few things want to get
     RARER as the silence goes on rather than more likely, because the payoff
     is the silence itself. */
  function quiet() { return debt <= 0 ? 1 : 1 - Math.min(1, debt / COST[3]); }

  function clear() { debt = 0; last = { 1: 0, 2: 0, 3: 0 }; }

  VF.pace = { tick: tick, allow: allow, spend: spend, take: take,
              quiet: quiet, clear: clear,
              debt: function () { return debt; } };
})(window.VF = window.VF || {});
