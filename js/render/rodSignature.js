/* VOID FISHING — what makes one rod not another rod.

   The problem this solves: there were a hundred and twenty-nine rods and
   thirty-one drawing styles, so twenty-two of them were "celestial" and
   thirteen were "tide", and inside a family the only difference was the
   colours. Worse, every rod in the game — the twelve-Jias starter and the
   thing at the end of the quest alike — had the same seven guides in the same
   seven places, the same cork grip, the same butt cap. The silhouette never
   changed. A rod that costs thirty billion looked like the first one with a
   better paint job.

   So this file does not draw anything. It answers one question about a rod —
   what is it actually built like — and rodArt draws the answer. Two ideas do
   all the work:

   GRADE. Every rod's numbers collapse to one 0..1 figure of how good it is,
   log-scaled because the ladder spans four orders of magnitude. Grade decides
   what the rod is allowed to be made of: how many guides it carries, whether
   they are wire rings or something with no wire in it at all, whether the grip
   is cork or bone or something quarried, whether there is anything inlaid down
   the blank. Better rods get more of everything and stranger versions of it,
   in that order, so the ladder is visible at a glance from across the shop.

   SEED. Inside what the grade allows, a hash of the rod's id picks. Two rods
   of the same power get different guide counts, different spacing, different
   wrap colours, a different butt. Nothing is random at runtime — the same rod
   is the same rod forever, in the shop, in the hand, and in the gallery sheet.

   The result is that no two rods share a silhouette, and the silhouette gets
   better as the numbers do. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* ------------------------------------------------------------------ grade

     The ladder runs from 0.09 (a stick somebody left at the shore) to about
     740 (the last rod in the quest), which is four orders of magnitude — so
     the useful measure is the log, not the number. Line and luck are folded in
     under a root because they matter less to how a rod should look than reach
     and pull do. */

  const LO = Math.log(0.06);
  const HI = Math.log(900);

  function power(rod) {
    const cast = Math.max(0.05, rod.cast || 0.2);
    const reel = Math.max(0.05, rod.reel || 0.4);
    const rare = Math.max(1, rod.rare || 1);
    const luck = Math.max(0, rod.luck || 0);
    const line = Math.max(1, rod.line || 1);
    return cast * reel * rare * (1 + luck * 0.55) * Math.pow(line, 0.22);
  }

  /* The log alone is not enough. The hundred rods the wanderer carries are
     bunched tightly in the middle of the ladder — on a pure log scale eighty
     of them land between 0.5 and 0.7 and come out looking like one another
     again, which is the whole problem this file exists to fix.

     So grade is mostly WHERE A ROD SITS IN THE LINE, not what its numbers are:
     sort every rod by power, and a rod's grade is how far along that queue it
     stands. That guarantees the roster uses the whole range, so each step up
     the shop shelf is a visible step. A little of the log measure is mixed
     back in so the genuine outliers at the top still read as outliers rather
     than merely as the last few in a queue.

     Built once, lazily, and thrown away when the roster changes — the
     wanderer's hundred are appended to the same list after boot. */

  let ranks = null;

  function buildRanks() {
    const list = (VF.rods && VF.rods.list) || [];
    const sorted = list.filter(function (r) { return r && r.id && !r.admin; })
                       .sort(function (a, b) { return power(a) - power(b); });
    ranks = Object.create(null);
    const n = Math.max(1, sorted.length - 1);
    for (let i = 0; i < sorted.length; i++) ranks[sorted[i].id] = i / n;
    return ranks;
  }

  function grade(rod) {
    // the admin rod is off the end of every scale; it is not a rung
    if (rod.admin) return 1;
    if (!ranks) buildRanks();
    const byRank = ranks[rod.id];
    const byLog = U.clamp((Math.log(power(rod)) - LO) / (HI - LO), 0, 1);
    if (byRank === undefined) return byLog;
    return U.clamp(byRank * 0.78 + byLog * 0.22, 0, 1);
  }

  /* ------------------------------------------------------------------- seed

     xmur3 over the id. Stable across reloads, across machines and across
     builds, which matters because a rod people have looked at should not
     quietly become a different rod. */
  function hash(str) {
    let h = 2166136261 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
      h = (h << 13) | (h >>> 19);
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    h ^= h >>> 13; h = Math.imul(h, 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  /* A tiny deterministic stream per rod, so each decision below is
     independent of the ones before it rather than all keyed off one number. */
  function stream(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Pick from a list of increasingly extravagant options, given how good the
     rod is. The one primitive the whole file is built on, and it does two
     distinct things:

     It CAPS. Grade decides how far up the list this rod may reach at all, so
     a twelve-Jias stick cannot come out with a quarried grip however the dice
     land. That is what makes the ladder legible: the top of the list is only
     ever on rods that earned it.

     Then it BIASES inside the cap, harder as grade climbs, so a good rod
     usually — not always — takes the best thing it is allowed. The "not
     always" is deliberate: a late rod that happens to have a plain butt cap
     reads as a choice somebody made rather than as a tier. */
  function pickUp(list, r, g, bias) {
    if (list.length <= 1) return list[0];
    const b = bias === undefined ? 1 : bias;
    const reach = U.clamp(Math.ceil(list.length * (0.24 + 0.76 * g)), 1, list.length);
    const shaped = Math.pow(r, Math.max(0.30, 1 - g * b * 0.72));
    return list[U.clamp(Math.floor(shaped * reach), 0, reach - 1)];
  }

  /* ------------------------------------------------------------------ build */

  const GUIDE_FORMS = ['ring', 'ring', 'double', 'double', 'spiral', 'braced', 'float', 'halo'];
  const GRIP_FORMS  = ['cork', 'cork', 'rubber', 'cord', 'scaled', 'bone', 'chased', 'quarried'];
  const INLAY_FORMS = ['none', 'none', 'dashes', 'chevrons', 'lattice', 'runes', 'filigree', 'constellation'];
  const BUTT_FORMS  = ['flat', 'flat', 'domed', 'ringed', 'faceted', 'gemmed', 'crowned'];
  const SEAT_FORMS  = ['plain', 'plain', 'banded', 'skeleton', 'chased', 'floating'];
  const TIP_FORMS   = ['plain', 'plain', 'lined', 'crowned', 'lit'];
  /* The reel is the single biggest thing bolted to a rod and it was the same
     reel on all hundred and twenty-nine. These are housings, not colours. */
  const REEL_FORMS  = ['open', 'open', 'ported', 'caged', 'spoked', 'orbital'];

  const cache = Object.create(null);

  function of(rod) {
    if (!rod || !rod.id) return fallback();
    const hit = cache[rod.id];
    if (hit) return hit;

    const g = grade(rod);
    const seed = hash(rod.id);
    const r = stream(seed);

    /* --- guides ---
       Five on a stick, ten on something that took a year to build. The spacing
       exponent is what stops them reading as the same rod: a low exponent
       bunches them toward the tip, a high one spreads them evenly, and the
       start point moves too. */
    const nGuides = Math.round(U.lerp(5, 10, g) + (r() * 2 - 1) * 1.2);
    const form = pickUp(GUIDE_FORMS, r(), g, 1);
    const spacing = U.lerp(0.72, 1.30, r());
    const start = U.lerp(0.245, 0.335, r());

    const guides = [];
    const n = U.clamp(nGuides, 4, 11);
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 1 : i / (n - 1);
      guides.push(start + (0.965 - start) * Math.pow(u, spacing));
    }

    /* --- the blank ---
       `taper` is how fast it thins: a fast taper is a whippy tip, a slow one
       is a broomstick. Ferrules are the joints, and only a rod that comes
       apart has them. */
    const taper = U.lerp(0.78, 1.34, r());
    const ferrules = g < 0.28 ? 0 : (g < 0.62 ? (r() < 0.55 ? 1 : 0) : (r() < 0.5 ? 2 : 1));
    const ferrAt = [];
    for (let i = 0; i < ferrules; i++) ferrAt.push(U.lerp(0.34, 0.72, (i + 0.5 + r() * 0.4) / Math.max(1, ferrules)));

    /* --- thread wraps ---
       The coloured silk at the foot of each guide. On a cheap rod there is one
       band and it is the same colour as the blank; on a good one there are
       three and the outer ones are metallic. */
    const wraps = g < 0.18 ? 0 : (g < 0.45 ? 1 : (g < 0.75 ? 2 : 3));

    /* --- everything else the grade gates --- */
    const grip = pickUp(GRIP_FORMS, r(), g, 1);
    const inlay = pickUp(INLAY_FORMS, r(), g, 1.15);
    const butt = pickUp(BUTT_FORMS, r(), g, 1);
    const seat = pickUp(SEAT_FORMS, r(), g, 1);
    const tip = pickUp(TIP_FORMS, r(), g, 1.2);
    const reel = pickUp(REEL_FORMS, r(), g, 1);

    const sig = {
      grade: g,
      seed: seed,
      guides: guides,
      guideForm: form,
      // ring size falls as the rod gets finer, and each rod sits a little
      // differently on that curve
      guideScale: U.lerp(1.18, 0.74, g) * U.lerp(0.9, 1.12, r()),
      taper: taper,
      ferrules: ferrAt,
      wraps: wraps,
      wrapWidth: U.lerp(0.007, 0.016, r()),
      grip: grip,
      gripLen: U.lerp(0.175, 0.235, r()),
      checks: g < 0.3 ? 1 : (g < 0.7 ? 2 : 3),
      seat: seat,
      inlay: inlay,
      inlayDensity: U.lerp(0.55, 1.45, r()),
      butt: butt,
      tip: tip,
      reel: reel,
      // even two rods with the same housing sit differently on the blank
      reelSize: U.lerp(0.88, 1.16, r()),
      reelAt: U.lerp(0.195, 0.240, r()),
      /* A phase per rod, so anything that pulses does not pulse in time with
         every other rod on the shop shelf. */
      phase: r() * Math.PI * 2
    };
    cache[rod.id] = sig;
    return sig;
  }

  function fallback() {
    return {
      grade: 0, seed: 1, guides: [0.30, 0.45, 0.58, 0.70, 0.80, 0.88, 0.95],
      guideForm: 'ring', guideScale: 1, taper: 1, ferrules: [], wraps: 0,
      wrapWidth: 0.01, grip: 'cork', gripLen: 0.20, checks: 1, seat: 'plain',
      inlay: 'none', inlayDensity: 1, butt: 'flat', tip: 'plain',
      reel: 'open', reelSize: 1, reelAt: 0.215, phase: 0
    };
  }

  VF.rodSig = {
    of: of, grade: grade, power: power,
    /* the tools sheet groups by these, and the shop sorts by grade */
    FORMS: { guide: GUIDE_FORMS, grip: GRIP_FORMS, inlay: INLAY_FORMS,
             butt: BUTT_FORMS, seat: SEAT_FORMS, tip: TIP_FORMS, reel: REEL_FORMS },
    /* The wanderer's hundred are appended after boot, which moves everybody's
       place in the queue — so both the ranks and the builds drawn from them
       are thrown away and worked out again. */
    clear: function () {
      ranks = null;
      for (const k in cache) delete cache[k];
    }
  };
})(window.VF = window.VF || {});
