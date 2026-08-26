/* VOID FISHING — running the slate.
   Three jobs at a time. Finishing one pays, clears it, and chalks up another
   in its place, so the slate is always full and never becomes a checklist you
   are working down. Everything is driven off events the rest of the game
   already emits — nothing in here is wired into the fishing loop. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const SLOTS = 3;
  const REROLL_BASE = 140;   // what it costs to rub one out and chalk another

  function data() {
    const d = VF.state.data;
    if (!d.slate || typeof d.slate !== 'object' || Array.isArray(d.slate)) {
      d.slate = { jobs: [], rolled: 0, done: 0, seed: 0 };
    }
    if (!Array.isArray(d.slate.jobs)) d.slate.jobs = [];
    return d.slate;
  }

  /* ------------------------------------------------------------- rolling */

  function eligible(d) {
    return VF.slateData.list.filter(function (t) { return d.level >= (t.minLevel || 1); });
  }

  /* Roll one job that is not a repeat of anything currently on the slate.
     A template can decline (return null) when the save has nothing for it to
     ask about yet — a species job on an empty fishdex, say — so the picker
     retries rather than leaving a hole. */
  function rollOne(avoid) {
    const d = VF.state.data;
    const R = VF.rng.g;
    const pool = eligible(d);
    if (!pool.length) return null;

    /* Three jobs that all say "land N of tier X" is a slate nobody reads. A
       kind already on the board is excluded outright while there is anything
       else to ask for, and only allowed back when the alternatives run out. */
    const fresh = pool.filter(function (x) { return avoid.indexOf(x.id) < 0; });
    const from = fresh.length ? fresh : pool;

    for (let attempt = 0; attempt < 16; attempt++) {
      const t = VF.rng.weighted(from, function (x) { return x.weight; }, R);
      if (!t) return null;
      let spec = null;
      try { spec = t.roll(d, R); } catch (e) { spec = null; }
      if (!spec || !(spec.goal > 0)) continue;

      const job = {
        t: t.id,
        goal: Math.max(1, Math.round(spec.goal)),
        at: 0,
        id: (d.slate.rolled | 0) + 1 + '-' + t.id,
        /* The difficulty is stored and the money is worked out when it is
           read, not when it is chalked. A job rolled at level 4 and finished
           at level 40 pays what it is worth to a level 40 angler — otherwise
           the slate goes stale the moment you level, and the reroll price
           (which does track your level) overtakes the reward. */
        diff: spec.diff,
        // a token turns up on the harder jobs often enough to notice
        token: R() < 0.10 + spec.diff * 0.22
      };
      for (const k in spec) if (k !== 'goal' && k !== 'diff') job[k] = spec[k];
      return job;
    }
    return null;
  }

  /* What a job is worth right now. */
  function pay(job) {
    if (!job) return 0;
    return VF.slateData.reward({ diff: job.diff === undefined ? 0.3 : job.diff },
                               VF.state.data.level);
  }

  /* Keep the slate full. Safe to call at any time; it only ever adds. */
  function fill() {
    const s = data();
    let added = 0;
    for (let guard = 0; s.jobs.length < SLOTS && guard < 10; guard++) {
      const avoid = s.jobs.map(function (j) { return j.t; });
      const job = rollOne(avoid);
      if (!job) break;
      s.rolled = (s.rolled | 0) + 1;
      s.jobs.push(job);
      added++;
    }
    if (added) VF.bus.emit('slate:changed');
    return added;
  }

  /* Priced off what the board is actually paying, so rubbing one out is always
     a real cost and never more than a job is worth. */
  function rerollCost() {
    const jobs = data().jobs;
    if (!jobs.length) return REROLL_BASE;
    let total = 0;
    for (let i = 0; i < jobs.length; i++) total += pay(jobs[i]);
    return Math.max(REROLL_BASE, Math.round(total / jobs.length * 0.40));
  }

  function reroll(index) {
    const s = data();
    if (index < 0 || index >= s.jobs.length) return { ok: false, why: 'missing' };
    const cost = rerollCost();
    if (!VF.economy.spend(cost, 'slate')) return { ok: false, why: 'money' };
    const avoid = s.jobs.map(function (j) { return j.t; });
    const job = rollOne(avoid);
    if (!job) { VF.economy.earn(cost, 'refund'); return { ok: false, why: 'empty' }; }
    s.rolled = (s.rolled | 0) + 1;
    s.jobs[index] = job;
    VF.bus.emit('slate:changed');
    VF.save.save();
    return { ok: true, cost: cost };
  }

  /* --------------------------------------------------------------- text */

  function describe(job) {
    const t = VF.slateData.get(job.t);
    if (!t) return 'something, presumably';
    try { return t.text(job); } catch (e) { return 'something, presumably'; }
  }

  /* --------------------------------------------------------- progression */

  function bump(hook, arg) {
    const s = data();
    if (!s.jobs.length) return;
    let dirty = false;

    for (let i = s.jobs.length - 1; i >= 0; i--) {
      const job = s.jobs[i];
      const t = VF.slateData.get(job.t);
      if (!t || !t.on || !t.on[hook]) continue;
      let n = 0;
      try { n = t.on[hook](job, arg) | 0; } catch (e) { n = 0; }
      if (!n) continue;

      const was = job.at;
      // a streak job reads the running total; everything else counts up
      job.at = t.absolute ? Math.max(job.at, n) : job.at + n;
      if (job.at === was) continue;
      dirty = true;

      if (job.at >= job.goal) { complete(i); }
      else VF.bus.emit('slate:progress', { job: job, was: was });
    }
    if (dirty) VF.save.save();
  }

  function complete(index) {
    const s = data();
    const job = s.jobs[index];
    if (!job) return;
    const d = VF.state.data;

    const amount = pay(job);
    VF.economy.earn(amount, 'slate');
    if (job.token) d.caseTokens++;
    s.done = (s.done | 0) + 1;
    d.stats.slateDone = (d.stats.slateDone | 0) + 1;

    const text = describe(job);
    s.jobs.splice(index, 1);
    VF.bus.emit('slate:done', { job: job, text: text, pay: amount });
    fill();
    VF.save.save();
  }

  /* --------------------------------------------------------------- wiring */

  function init() {
    fill();
    VF.bus.on('fishing:landed', function (c) { bump('landed', c); });
    VF.bus.on('fishing:treasure', function (c) { bump('treasure', c); });
    VF.bus.on('catch:released', function (e) { bump('released', e); });
    // levelling opens templates that were out of reach, and the level scale
    // moves the pay, so a stale slate is topped up rather than left behind
    VF.bus.on('level:up', function () { fill(); });
    VF.bus.on('save:imported', function () { fill(); });
    VF.bus.on('save:reset', function () {
      VF.state.data.slate = { jobs: [], rolled: 0, done: 0, seed: 0 };
      fill();
    });
  }

  VF.slate = {
    SLOTS: SLOTS,
    init: init, fill: fill, reroll: reroll, rerollCost: rerollCost,
    describe: describe, pay: pay,
    jobs: function () { return data().jobs; },
    doneCount: function () { return data().done | 0; },
    /* how many are sitting one step from paying out, for the tab dot */
    ready: function () {
      return data().jobs.filter(function (j) { return j.at > 0; }).length;
    }
  };
})(window.VF = window.VF || {});
