/* VOID FISHING — a game played under a rule.

   Four save slots and no reason to fill the other three. A run is the reason:
   the same game with one thing taken away, declared when the slot is started
   and enforced for as long as it lasts.

   These are restrictions, not difficulty settings. Nothing here scales a
   number — each one removes something, and what is interesting is what the
   rest of the game turns into without it. The shore run never leaves the
   first water, so every rod past the third is pointless and the whole game
   becomes the trait roll. The empty-handed run has no charms, so a loadout is
   just a rod. The one that gives everything back never sells a fish, so money
   comes from salvage and gratitude and nothing else.

   A run is stored on the save and can never be turned off, because a rule you
   can switch off halfway is not a rule. */
(function (VF) {
  'use strict';

  const LIST = [
    { id: 'none', name: 'No rule', short: '',
      desc: 'The game as it is.' },

    { id: 'firstrod', name: 'The Rod You Were Left', short: 'first rod',
      desc: 'The old wooden rod, and nothing else, forever. Everything you would ' +
            'have bought a better rod for has to come out of the water instead.',
      /* Bait, charms and travel are all still yours — it is one thing taken
         away, not a hair shirt. */
      allowRod: function (id) { return id === 'wood'; } },

    { id: 'shore', name: 'Never Leaving', short: 'the shore',
      desc: 'The Quiet Shore and no further. The map still fills in. You will not be going.',
      allowTravel: function (id) { return id === 'shore'; } },

    { id: 'bare', name: 'Empty-Handed', short: 'no charms',
      desc: 'No charms, no relics, no slots. A loadout is a rod and a bait, ' +
            'and the fight is only ever yours.',
      allowCharms: false },

    { id: 'giveback', name: 'Everything Goes Back', short: 'release all',
      desc: 'Nothing is ever sold. Every catch is released. Money comes from what ' +
            'the water gives back and from nothing else — and your luck climbs ' +
            'the whole way.',
      noSell: true }
  ];

  const BY_ID = VF.util.byId(LIST);

  function current() {
    const r = VF.state.data.run;
    return (r && BY_ID[r]) || BY_ID.none;
  }
  function is(id) { return current().id === id; }
  function active() { return current().id !== 'none'; }

  /* Every question the rest of the game asks, answered in one place so a rule
     cannot be enforced in one path and forgotten in another. */
  function rodAllowed(id) {
    const r = current();
    return !r.allowRod || r.allowRod(id);
  }
  function travelAllowed(id) {
    const r = current();
    return !r.allowTravel || r.allowTravel(id);
  }
  function charmsAllowed() {
    return current().allowCharms !== false;
  }
  function sellAllowed() {
    return !current().noSell;
  }

  /* Why something is refused, in words, so the interface never has to guess. */
  function why(what) {
    const r = current();
    if (!active()) return null;
    switch (what) {
      case 'rod': return r.name.toLowerCase() + ' — this run is ' + r.short;
      case 'travel': return r.name.toLowerCase() + ' — you are not leaving';
      case 'charms': return r.name.toLowerCase() + ' — no charms on this run';
      case 'sell': return r.name.toLowerCase() + ' — nothing is sold on this run';
    }
    return r.name.toLowerCase();
  }

  VF.runs = {
    list: LIST,
    get: function (id) { return BY_ID[id] || BY_ID.none; },
    current: current, is: is, active: active, why: why,
    rodAllowed: rodAllowed,
    travelAllowed: travelAllowed,
    charmsAllowed: charmsAllowed,
    sellAllowed: sellAllowed
  };
})(window.VF = window.VF || {});
