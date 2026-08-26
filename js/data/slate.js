/* VOID FISHING — the slate.
   Three small standing requests, chalked up somewhere near the counter. They
   are deliberately not a quest: nobody gives them to you, nothing in the story
   depends on them, and ignoring the slate forever costs you nothing but money.

   What they are for is the middle of a session. The quest runs in chapters and
   the achievements are a record of things you already did; between those two
   there was nothing to aim at, so an hour of fishing had no shape unless you
   brought one yourself. A job is that shape, small enough to finish inside one
   sitting.

   Each template turns into a concrete job when it is rolled — a goal, a
   subject, a line of text — and then watches the same events the rest of the
   game already emits. Nothing here reaches into the fishing loop. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Roughly what a job of this size ought to pay, before the level scale.
     Difficulty is a hand-set 0..1 rather than anything derived, because what
     makes a job annoying is not the same thing that makes a fish rare. */
  function reward(job, level) {
    const base = 260 + level * level * 1.15;
    return Math.max(120, Math.round(base * (0.55 + job.diff * 1.9)));
  }

  /* An article-aware join for the request lines, since species names in this
     game already carry their own determiners half the time. */
  function a(name) {
    return /^(the|a|an|some) /i.test(name) ? name : (/^[aeiou]/i.test(name) ? 'an ' : 'a ') + name;
  }

  /* Three kinds are open from the first cast — a tier, some salvage and a few
     put back — so a new save never gets three copies of the same question. The
     rest arrive as the level does. */
  const TEMPLATES = [
    /* ---------------------------------------------------------- by tier */
    {
      id: 'tier', weight: 24, minLevel: 1,
      roll: function (d, R) {
        // never ask for a tier the player has no realistic path to
        const reach = VF.rarities.list.filter(function (r) {
          return !r.hidden && r.rank >= 1 && r.rank <= 3 + Math.floor(VF.locations.index(d.location) / 2);
        });
        const r = reach[R.int(0, reach.length - 1)];
        const n = r.rank <= 1 ? R.int(6, 12) : r.rank === 2 ? R.int(3, 6) : R.int(2, 3);
        return { rarity: r.id, goal: n, diff: 0.18 + r.rank * 0.17 };
      },
      text: function (j) {
        const r = VF.rarities.get(j.rarity);
        return 'land ' + j.goal + ' ' + r.name.toLowerCase() + ' or better';
      },
      on: { landed: function (j, c) { return VF.rarities.rank(c.rarity) >= VF.rarities.rank(j.rarity) ? 1 : 0; } }
    },

    /* ------------------------------------------------------- somewhere */
    {
      id: 'spot', weight: 18, minLevel: 3,
      roll: function (d, R) {
        const open = VF.locations.list.filter(function (l) {
          return VF.locations.isUnlocked(l.id) && !VF.secrets.isSecretLoc(l.id);
        });
        const l = open[R.int(0, open.length - 1)];
        return { loc: l.id, goal: R.int(5, 10), diff: 0.22 };
      },
      text: function (j) { return 'land ' + j.goal + ' at ' + VF.locations.get(j.loc).name; },
      on: { landed: function (j, c) { return c.location === j.loc ? 1 : 0; } }
    },

    /* ------------------------------------------------------------ size */
    {
      id: 'heavy', weight: 16, minLevel: 2,
      roll: function (d, R) {
        // scaled off the player's own best, so it is always a stretch and
        // never a wall — and off the species range at this spot for a new save
        const best = Math.max(2, d.records.biggestKg || 0);
        const want = best * R.range(0.62, 0.95);
        return { kg: Math.max(1, Math.round(want * 10) / 10), goal: 1, diff: 0.42 };
      },
      text: function (j) { return 'bring in something over ' + U.weight(j.kg); },
      on: { landed: function (j, c) { return c.kg >= j.kg ? 1 : 0; } }
    },

    /* ---------------------------------------------------------- traits */
    {
      id: 'traits', weight: 15, minLevel: 6,
      roll: function (d, R) {
        const k = R() < 0.68 ? 1 : 2;
        return { need: k, goal: k === 1 ? R.int(3, 6) : R.int(2, 3), diff: 0.30 + k * 0.18 };
      },
      text: function (j) {
        return j.need === 1
          ? 'land ' + j.goal + ' fish carrying a trait'
          : 'land ' + j.goal + ' fish carrying two traits or more';
      },
      on: { landed: function (j, c) { return (c.traits || []).length >= j.need ? 1 : 0; } }
    },

    /* --------------------------------------------------------- salvage */
    {
      id: 'salvage', weight: 13, minLevel: 1,
      roll: function (d, R) { return { goal: R.int(3, 6), diff: 0.26 }; },
      text: function (j) { return 'pull up ' + j.goal + ' things that are not fish'; },
      on: { treasure: function () { return 1; } }
    },

    /* ---------------------------------------------------------- streak */
    {
      id: 'streak', weight: 11, minLevel: 5,
      roll: function (d, R) { return { goal: R.int(6, 12), diff: 0.40 }; },
      text: function (j) { return 'land ' + j.goal + ' in a row without losing one'; },
      // a streak is a state, not a tally: the job reads the running streak and
      // never walks backwards on its own, so a break costs the ground you had
      absolute: true,
      on: { landed: function (j) { return VF.state.data.streak; } }
    },

    /* --------------------------------------------------------- perfect */
    {
      id: 'perfect', weight: 10, minLevel: 8,
      roll: function (d, R) { return { goal: R.int(2, 4), diff: 0.46 }; },
      text: function (j) { return 'land ' + j.goal + ' without the fish ever leaving the bar'; },
      on: {
        landed: function () {
          const f = VF.fishing.S.lastFight;
          return f && f.perfect ? 1 : 0;
        }
      }
    },

    /* --------------------------------------------------------- release */
    {
      id: 'release', weight: 12, minLevel: 1,
      roll: function (d, R) { return { goal: R.int(4, 9), diff: 0.16 }; },
      text: function (j) { return 'put ' + j.goal + ' back'; },
      on: { released: function () { return 1; } }
    },

    /* --------------------------------------------------------- species */
    {
      id: 'species', weight: 14, minLevel: 4,
      roll: function (d, R) {
        // only ever a species already in the record, so the job is a return
        // trip rather than a hunt for something you have never seen
        const known = Object.keys(d.fishdex).filter(function (id) {
          const f = VF.fish.byId(id);
          return f && VF.rarities.rank(f.rarity) <= 4;
        });
        if (!known.length) return null;
        const id = known[R.int(0, known.length - 1)];
        const f = VF.fish.byId(id);
        const rank = VF.rarities.rank(f.rarity);
        return { fish: id, goal: rank >= 3 ? R.int(1, 2) : R.int(2, 5), diff: 0.20 + rank * 0.12 };
      },
      text: function (j) {
        const f = VF.fish.byId(j.fish);
        return 'land ' + (j.goal > 1 ? j.goal + ' more ' + f.name : a(f.name)) + ' again';
      },
      on: { landed: function (j, c) { return c.id === j.fish ? 1 : 0; } }
    },

    /* ----------------------------------------------------------- value */
    {
      id: 'value', weight: 12, minLevel: 7,
      roll: function (d, R) {
        const best = Math.max(200, d.records.richest || 0);
        return { worth: Math.round(best * R.range(0.55, 0.9)), goal: 1, diff: 0.38 };
      },
      text: function (j) { return 'bring in one worth ' + U.money(j.worth) + ' or more'; },
      on: { landed: function (j, c) { return c.value >= j.worth ? 1 : 0; } }
    }
  ];

  const BY_ID = U.byId(TEMPLATES);

  VF.slateData = {
    list: TEMPLATES,
    get: function (id) { return BY_ID[id] || null; },
    reward: reward
  };
})(window.VF = window.VF || {});
