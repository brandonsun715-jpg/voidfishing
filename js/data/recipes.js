/* VOID FISHING — what the objects are for.

   Twenty-nine things come up on the line instead of a fish, and almost all of
   them end as money. A bottle is worth sixty; a bottle is worth sixty a
   hundred times. The table has no second life in it, and the deep waters have
   no reason to be fished that is not rarity.

   So a few of them combine. Deliberately few — the point is that objects have
   uses, not that there is a crafting game underneath the fishing game. Nothing
   here makes anything that cannot be bought or found some other way, except
   the two at the bottom, which are the reason to keep reading.

   A recipe costs objects and nothing else. No station, no timer, no levels. */
(function (VF) {
  'use strict';

  const LIST = [
    /* ------------------------------------------------------- bait
       The early ones exist so that a beginner who is pulling up rubbish has
       something to do with it other than sell it at a loss. */
    { id: 'r_glow', name: 'Glow Worms, A Jar Of',
      need: { shell: 3, bottle: 1 },
      gives: { bait: 'glowworm', n: 12 },
      desc: 'Three shells and a bottle. Whatever is living in the shells will do.' },

    { id: 'r_cluster', name: 'A Knot Of Insects',
      need: { hookbox: 2, shell: 2 },
      gives: { bait: 'cluster', n: 12 },
      desc: 'The box came up full of something. It is still full of something.' },

    { id: 'r_deep', name: 'Deep Bait',
      need: { coins: 4, bottle: 2, hookbox: 1 },
      gives: { bait: 'deep', n: 12 },
      desc: 'Weighted with coins nobody will miss. It goes down further than it should.' },

    { id: 'r_prism', name: 'Prism Lure',
      need: { jewel: 2, lens: 1 },
      gives: { bait: 'prism', n: 10 },
      desc: 'The lens splits the light and the jewels give it something to split.' },

    { id: 'r_star', name: 'Star Bait',
      need: { crystal: 1, jewel: 3 },
      gives: { bait: 'star', n: 10 },
      desc: 'It is cold, and it stays cold, and things come up to see why.' },

    { id: 'r_void', name: 'Void Bait',
      need: { voidfrag: 1, crystal: 2, plate: 1 },
      gives: { bait: 'void', n: 8 },
      desc: 'A fragment of it, wrapped in something older, on a plate that has ' +
            'the wrong number of sides.' },

    /* ------------------------------------------------------- keys
       Cases are bought with money and opened with keys, and the water gives up
       keys rarely. This is the other way to get one, and it is not cheap. */
    { id: 'r_key', name: 'A Key, Cut',
      need: { hookbox: 3, coins: 6, fossil: 1 },
      gives: { token: 1 },
      desc: 'Filed down from a hook, on a blank of something that used to be alive. ' +
            'It fits. Nobody is sure why it fits.' },

    /* ------------------------------------------------------- the last two
       Neither of these can be bought, found or given. They are the reason the
       salvage table is worth reading twice. */
    { id: 'r_olderplate', name: 'The Older Plate',
      need: { plate: 2, fossil: 2, chart: 1 },
      gives: { charm: 'olderplate' },
      desc: 'Two plates, and a chart of somewhere neither of them is. Held together ' +
            'they are older than either.' },

    { id: 'r_nightglass', name: 'Night Glass',
      need: { lens: 2, crystal: 2, voidfrag: 1 },
      gives: { charm: 'nightglass' },
      desc: 'Ground from two lenses and something that does not reflect. You can see ' +
            'through it. That is the problem with it.' }
  ];

  const BY_ID = VF.util.byId(LIST);

  /* How many of an object the player has. Salvage is counted, not held as
     individual items — d.treasures is a tally — so making something spends
     from the tally. */
  function have(id) { return VF.state.data.treasures[id] | 0; }

  function canMake(r) {
    if (!r) return false;
    for (const k in r.need) if (have(k) < r.need[k]) return false;
    /* And whatever it makes has to be worth making. A charm you already own is
       not, and there is nothing else to spend the objects on afterwards. */
    if (r.gives.charm && VF.charms.owned(r.gives.charm)) return false;
    if (r.gives.charm && VF.runs && !VF.runs.charmsAllowed()) return false;
    return true;
  }

  /* Why not, in words. */
  function blocked(r) {
    if (!r) return 'no';
    if (r.gives.charm && VF.charms.owned(r.gives.charm)) return 'you have one';
    if (r.gives.charm && VF.runs && !VF.runs.charmsAllowed()) return VF.runs.why('charms');
    const short = [];
    for (const k in r.need) {
      const n = r.need[k] - have(k);
      if (n > 0) {
        const t = VF.treasureData.get(k);
        short.push(n + ' more ' + (t ? t.name.toLowerCase() : k));
      }
    }
    return short.length ? short.join(', ') : null;
  }

  function make(id) {
    const r = BY_ID[id];
    if (!canMake(r)) return null;
    const d = VF.state.data;
    for (const k in r.need) d.treasures[k] = (d.treasures[k] | 0) - r.need[k];
    if (r.gives.bait) VF.bait.add(r.gives.bait, r.gives.n || 1);
    if (r.gives.token) d.caseTokens = (d.caseTokens | 0) + r.gives.token;
    if (r.gives.charm) VF.charms.grant(r.gives.charm);
    d.stats.made = (d.stats.made | 0) + 1;
    VF.bus.emit('recipe:made', r);
    VF.save.save();
    return r;
  }

  /* What a recipe hands over, in one line. */
  function reward(r) {
    if (r.gives.bait) {
      const b = VF.bait.get(r.gives.bait);
      return (r.gives.n || 1) + ' × ' + (b ? b.name : r.gives.bait);
    }
    if (r.gives.token) return r.gives.token === 1 ? 'a key' : r.gives.token + ' keys';
    if (r.gives.charm) {
      const c = VF.charms.get(r.gives.charm);
      return c ? c.name : r.gives.charm;
    }
    return '—';
  }

  VF.recipes = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    have: have,
    canMake: canMake,
    blocked: blocked,
    make: make,
    reward: reward,
    /* Anything makeable right now, for the tab to mark itself with. */
    anyReady: function () { return LIST.some(canMake); }
  };
})(window.VF = window.VF || {});
