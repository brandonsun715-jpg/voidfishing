/* VOID FISHING — deciding what is on the end of the line.
   Fish are drawn directly (not tier-then-species) so a tier with no local species
   simply never comes up, and preference tags shift the odds inside a tier. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* Combined "rarity power". Additive over sources so stacking every bonus is
     strong but never runaway-exponential. */
  function rarityPower(opts) {
    const d = VF.state.data;
    const rod = VF.rods.get(d.rod);
    const bait = VF.bait.get(d.bait);
    const loc = VF.locations.current();
    const sum = Math.max(0,
      (rod.rare - 1) +
      (bait.rare - 1) +
      (VF.weather.rare() - 1) +
      (loc.rarityBoost - 1) +
      VF.progression.luck() * 0.5
    );
    // diminishing returns: stacking every bonus is strong, never runaway
    let rp = 1 + Math.pow(sum, 0.82);
    if (opts && opts.rareBoost) rp *= opts.rareBoost;
    return Math.max(1, rp);
  }

  /* Species not native to a spot can still stray in from one or two locations
     away, at heavily reduced odds. Keeps every tier populated everywhere without
     making the deep spots feel like the shallow ones. */
  const STRAY = [1, 0.22, 0.045, 0];

  function strayFactor(f, locIdx) {
    if (!f.locs.length) return 1;                 // "anywhere" species
    let best = 99;
    for (let i = 0; i < f.locs.length; i++) {
      const d = Math.abs(VF.locations.index(f.locs[i]) - locIdx);
      if (d < best) best = d;
    }
    return best < STRAY.length ? STRAY[best] : 0;
  }

  /* Pool for a location: every species with a non-zero presence, plus the
     summed presence per rarity so tier probability stays independent of how
     many species happen to sit in that tier. */
  function buildPool(locId) {
    const locIdx = VF.locations.index(locId);
    const pool = [];
    const perRarity = Object.create(null);
    const prefTotal = Object.create(null);
    for (let i = 0; i < VF.fish.list.length; i++) {
      const f = VF.fish.list[i];
      const s = strayFactor(f, locIdx);
      if (s <= 0) continue;
      pool.push({ f: f, stray: s });
      perRarity[f.rarity] = (perRarity[f.rarity] || 0) + s;
    }
    return { pool: pool, perRarity: perRarity, prefTotal: prefTotal };
  }

  const poolCache = Object.create(null);
  function pool(locId) {
    return poolCache[locId] || (poolCache[locId] = buildPool(locId));
  }

  /* Preference tags steer WHICH species inside a tier, not how likely the tier
     is — tier odds are bait.rare's job. So the bonus is normalised against the
     tier average before it is applied. */
  function prefBonus(f) {
    const d = VF.state.data;
    let k = 1;
    if (f.baits.length) k *= (f.baits.indexOf(d.bait) >= 0) ? 3.0 : 0.55;
    if (f.time.length) k *= (f.time.indexOf(VF.time.phase()) >= 0) ? 1.8 : 0.6;
    if (f.weather.length) k *= (f.weather.indexOf(VF.weather.id()) >= 0) ? 2.2 : 0.7;
    return k;
  }

  /* Mean preference bonus per rarity, recomputed whenever the inputs change. */
  let prefKey = '';
  let prefMean = Object.create(null);
  function prefMeans(p, locId) {
    const d = VF.state.data;
    const key = locId + '|' + d.bait + '|' + VF.time.phase() + '|' + VF.weather.id();
    if (key === prefKey) return prefMean;
    const sum = Object.create(null), cnt = Object.create(null);
    for (let i = 0; i < p.pool.length; i++) {
      const e = p.pool[i];
      sum[e.f.rarity] = (sum[e.f.rarity] || 0) + prefBonus(e.f) * e.stray;
      cnt[e.f.rarity] = (cnt[e.f.rarity] || 0) + e.stray;
    }
    const m = Object.create(null);
    for (const r in sum) m[r] = cnt[r] > 0 ? sum[r] / cnt[r] : 1;
    prefKey = key; prefMean = m;
    return m;
  }

  /* Pick a species. `opts.minRank` forces the draw up to a tier (legendary encounters). */
  function pickFish(opts) {
    opts = opts || {};
    const loc = VF.locations.current();
    const p = pool(loc.id);
    const rp = rarityPower(opts);
    const minRank = opts.minRank || 0;

    const candidates = minRank
      ? p.pool.filter(function (e) { return VF.rarities.rank(e.f.rarity) >= minRank; })
      : p.pool;
    if (!candidates.length) return VF.fish.byId('smallmouth') || VF.fish.list[0];

    let counts = p.perRarity;
    if (minRank) {
      counts = Object.create(null);
      for (let i = 0; i < candidates.length; i++) {
        counts[candidates[i].f.rarity] = (counts[candidates[i].f.rarity] || 0) + candidates[i].stray;
      }
    }
    const means = prefMeans(p, loc.id);

    const chosen = VF.rng.weighted(candidates, function (e) {
      const r = VF.rarities.get(e.f.rarity);
      const n = counts[e.f.rarity] || 1;
      const mean = means[e.f.rarity] || 1;
      // presence < 1 means this tier only drifts in from elsewhere — damp it
      const presence = Math.min(1, n);
      return (VF.rarities.weightAt(r, rp) * presence * e.stray / n) * (prefBonus(e.f) / mean);
    }, VF.rng.g);

    return chosen ? chosen.f : candidates[0].f;
  }

  /* Size roll. Low exponent = the tail gets fatter, so luck genuinely produces
     bigger fish rather than just more of them. */
  function rollSize(f, luck) {
    const exp = U.clamp(2.45 - luck * 0.30, 1.15, 2.45);
    let t = Math.pow(VF.rng.g(), exp);
    // rare "surge" roll: a small chance to re-roll high, creating trophy moments
    if (VF.rng.g() < 0.012 + luck * 0.006) t = Math.max(t, Math.pow(VF.rng.g(), 0.35));
    t = U.clamp(t, 0, 1);

    const kMin = Math.max(f.kg[0], 1e-4), kMax = Math.max(f.kg[1], kMin * 1.0001);
    const mMin = Math.max(f.m[0], 1e-4), mMax = Math.max(f.m[1], mMin * 1.0001);
    // exponential interpolation keeps most catches modest and makes the top end feel earned
    const kg = kMin * Math.pow(kMax / kMin, t);
    const m = mMin * Math.pow(mMax / mMin, U.clamp(t + VF.rng.g.range(-0.06, 0.06), 0, 1));
    return { kg: kg, m: m, pct: t };
  }

  /* Build the full catch record. */
  function roll(opts) {
    opts = opts || {};
    const d = VF.state.data;
    const loc = VF.locations.current();
    const luck = VF.progression.luck();

    const f = opts.forceFish ? (VF.fish.byId(opts.forceFish) || pickFish(opts)) : pickFish(opts);
    const size = rollSize(f, luck);
    const mut = VF.mutations.roll(luck + (opts.mutBoost || 0), VF.rng.g);
    const rarity = VF.rarities.get(f.rarity);

    const sizeValue = 0.55 + size.pct * 1.75;
    const value = Math.max(1, Math.round(
      f.value * sizeValue * (mut ? mut.mult : 1) * loc.valueBoost
    ));
    const xp = Math.max(1, Math.round(rarity.xp * (0.8 + size.pct * 0.6) * loc.xpBoost));

    const prev = d.fishdex[f.id];
    const isNew = !prev;
    const isRecord = !!prev && size.kg > (prev.record ? prev.record.kg : 0);
    const isGiant = size.pct >= 0.985;

    return {
      id: f.id, fish: f, rarity: f.rarity, rarityDef: rarity,
      mutation: mut ? mut.id : null, mutationDef: mut,
      kg: size.kg, m: size.m, pct: size.pct,
      value: value, xp: xp,
      isNew: isNew, isRecord: isRecord, isGiant: isGiant,
      location: loc.id, time: VF.time.phase(), weather: VF.weather.id(),
      at: Date.now()
    };
  }

  /* Fight parameters derived from the fish and the player's rod. */
  function fightParams(c) {
    const rod = VF.rods.get(VF.state.data.rod);
    const f = c.fish;
    const rank = VF.rarities.rank(c.rarity);
    // difficulty grows with species difficulty, rarity and how big this individual is
    const raw = f.diff * 0.55 + rank * 0.100 + c.pct * 0.16;
    const power = U.clamp(raw, 0.08, 1.35);
    return {
      power: power,                                   // how hard it pulls
      stamina: U.clamp(0.55 + raw * 0.85, 0.5, 1.6),  // how long it lasts
      surgeRate: U.clamp(0.55 + rank * 0.13 + f.diff * 0.5, 0.5, 2.1),
      lineStrength: rod.line,
      reelForce: rod.reel,
      erratic: U.clamp(f.diff * 0.8 + rank * 0.06, 0.1, 1.1)
    };
  }

  VF.loot = {
    roll: roll,
    pickFish: pickFish,
    fightParams: fightParams,
    rarityPower: rarityPower,
    invalidatePool: function () { for (const k in poolCache) delete poolCache[k]; prefKey = ''; }
  };
})(window.VF = window.VF || {});
