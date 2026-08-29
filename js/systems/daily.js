/* VOID FISHING — the same water, for everybody, today.

   Nothing else in this game is shared. Two people playing it have different
   saves, different weather, different everything, and so there is nothing they
   can say to each other more specific than "it is good". A day's water fixes
   that for the cost of a seeded draw: one spot, one condition, one sky, chosen
   from the date, identical for anyone who opens the game on the same day.

   It is not a mode and it is not a reward. Travelling there gives you the
   water it describes rather than the water the simulation would have rolled;
   everything else — the loot, the fight, the record — is the ordinary game.
   The point is that it is the same one, so it is worth mentioning.

   The date is taken locally, so it turns over at your midnight rather than at
   somebody else's. Two people either side of a date line get consecutive days
   rather than the same one, which is the correct trade: a day's water should
   be today's. */
(function (VF) {
  'use strict';

  const U = VF.util;

  function dayKey(at) {
    const d = at ? new Date(at) : new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  /* A stable 32-bit hash of the day, so every client draws the same water
     without anything having to agree with anything. */
  function seedOf(key) {
    let h = 0x811c9dc5;
    const s = 'voidfishing:' + key;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  let cached = null;

  function today() {
    const key = dayKey();
    if (cached && cached.key === key) return cached;

    const rnd = VF.rng.make(seedOf(key));

    /* Only water the player could reach anyway — a day's water at a spot
       nobody has unlocked is an advert, not an invitation. The draw is over
       the whole list so it is the same everywhere; whether it is reachable is
       a question asked afterwards. */
    const spots = VF.locations.shelf();
    const loc = spots[Math.floor(rnd() * spots.length)] || VF.locations.list[0];

    const conds = VF.conditionData.list;
    const cond = conds[Math.floor(rnd() * conds.length)];

    const wxList = VF.weatherData.list.filter(function (w) {
      return !loc.weather || loc.weather.indexOf(w.id) >= 0;
    });
    const wx = wxList[Math.floor(rnd() * wxList.length)] || VF.weatherData.list[0];

    cached = { key: key, loc: loc, cond: cond, weather: wx };
    return cached;
  }

  function isHere() {
    const t = today();
    return VF.state.data.location === t.loc.id;
  }

  function unlocked() {
    return VF.state.data.unlockedLocations.indexOf(today().loc.id) >= 0;
  }

  /* Arriving. The condition and the sky are put where the day says they are,
     rather than left to the simulation — that is the whole of what makes it
     the same water as everybody else's. */
  function arrive() {
    const t = today();
    if (VF.state.data.location !== t.loc.id) return false;
    try {
      VF.weather.force(t.weather.id);
      VF.conditions.end();
      VF.conditions.start(t.cond.id);
    } catch (e) { return false; }
    VF.bus.emit('daily:arrived', t);
    return true;
  }

  /* One line, for the map and for anybody who asks. */
  function line() {
    const t = today();
    return t.cond.name.toLowerCase() + ' at ' + t.loc.name.toLowerCase() +
           ', under ' + t.weather.name.toLowerCase();
  }

  VF.daily = {
    today: today,
    line: line,
    isHere: isHere,
    unlocked: unlocked,
    arrive: arrive,
    dayKey: dayKey
  };
})(window.VF = window.VF || {});
