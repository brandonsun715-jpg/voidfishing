/* VOID FISHING — the small cast.
   Nobody here has a quest log. They have opinions, and the opinions change as
   you get further out. Their later lines are where the endgame is hidden. */
(function (VF) {
  'use strict';

  /* Each NPC has stages. A stage unlocks when its `at` test passes, and the
     player has to actually go and talk to them to hear it. */
  const LIST = [
    { id: 'keeper', name: 'The Keeper', role: 'shop', color: '#c8a870',
      where: 'behind the counter, always',
      blurb: 'Sells what you need. Buys what you would rather not carry.',
      stages: [
        { at: function () { return true; },
          lines: ['rods on the left. bait on the right. do not ask about the third shelf.',
                  'you will lose more line than you expect. everybody does. it is not a reflection on you.'] },
        { at: function (d) { return d.stats.catches >= 25; },
          lines: ['you have been at it a while now. the water notices that sort of thing.',
                  'somebody brought me a key once. brass. i still have the box it opens and no interest in opening it.'] },
        { at: function (d) { return !!d.treasures.key; },
          lines: ['that key. yes. i will take it — i have a box of things nobody claimed, and you may as well have one.',
                  'do not thank me. i want it out of the shop.'],
          gives: 'case' },
        { at: function (d) { return d.stats.voidCatches >= 1; },
          lines: ['you brought that up on purpose, did you.',
                  'the archivist will want to hear about it. i would rather you did not tell me.'] },
        { at: function (d) { return VF.secrets.found('the_last_water'); },
          lines: ['so you found it.', 'close the door behind you on the way out. it will not matter, but close it anyway.'] },
        { at: function (d) { return VF.secrets.found('the_last_water') && (d.stats.glitchCatches | 0) >= 1; },
          lines: ['right. under the counter. it has been under the counter the whole time you have been coming in here.',
                  'i was not keeping it from you. i was waiting to see whether you would come back after the last water. ' +
                  'most do not.',
                  'two of them. one at the tip and one at your hand. do not look directly at either.'],
          gives: 'rod', givesRod: 'twinsun' }
      ] },

    { id: 'archivist', name: 'The Archivist', role: 'lore', color: '#8fb8e8',
      where: 'a room of shelves nobody remembers building',
      blurb: 'Catalogues everything. Has never once been surprised.',
      stages: [
        { at: function (d) { return d.stats.catches >= 5; },
          lines: ['you are the one filling in the record. good. it has been mostly blank for a long time.',
                  'name a species and i will tell you what we know. it is usually less than you would hope.'] },
        { at: function (d) { return Object.keys(d.fishdex).length >= 18; },
          lines: ['eighteen. the previous record was eleven, and he stopped for reasons he did not write down.',
                  'the entries are not in the order they were caught. they are in the order they started existing.'] },
        { at: function (d) { return !!d.treasures.plate; },
          lines: ['the plate. the same names on both dates, four hundred years apart, and the second list is longer.',
                  'i have not been able to decide whether that is a record of who drowned or of who was here. it may not be two questions.'],
          journal: 'plate' },
        { at: function (d) { return d.stats.voidCatches >= 1; },
          lines: ['you understand that it should not have a weight.',
                  'and yet the scale gave you a number, and you wrote it down, and now it does. be careful what you measure.'],
          journal: 'firstvoid' },
        { at: function (d) { return VF.charms.owned('eye'); },
          lines: ['take it out of here.', 'i am not being dramatic. i am being specific. take it out of this room.'] },
        { at: function (d) { return VF.charms.owned('eye') && Object.keys(d.fishdex).length >= 60; },
          lines: ['sixty entries. the record has never been this complete and i have stopped enjoying reading it.',
                  'there is a rod on the shelf behind me. it is filed, not stocked — it came in as an object and it ' +
                  'answered a question, so it stayed.',
                  'take it. i would rather it was being used than being catalogued. that is the first time i have said that.'],
          gives: 'rod', givesRod: 'reliquary' }
      ] },

    { id: 'fisherman', name: 'The Old Fisherman', role: 'clue', color: '#a8c890',
      where: 'the far end of the shore, facing away',
      blurb: 'Has been here longer than the shore has.',
      stages: [
        { at: function (d) { return d.stats.catches >= 12; },
          lines: ['tension. that is all of it. everything else is decoration.',
                  'the line does not break because the fish is strong. it breaks because you were greedy for a second.'] },
        { at: function (d) { return VF.locations.index(d.location) >= 3 || d.level >= 18; },
          lines: ['the trench, is it. mm.',
                  'it has no bottom. people say that meaning it is very deep. i say it meaning it has no bottom.'] },
        { at: function (d) { return d.stats.encounters >= 2; },
          lines: ['when the water goes flat like a held breath — that is not calm. that is something large staying very still.',
                  'the flatness is the shape of its back. you have been fishing on top of it.'],
          journal: 'stillness' },
        { at: function (d) { return d.unlockedLocations.indexOf('beneath') >= 0; },
          lines: ['so you went under the nowhere sea. not many do.',
                  'and you noticed it goes further. of course you did. that is why you came to tell me.'],
          journal: 'beneath' },
        { at: function (d) { return VF.charms.owned('eye') && VF.journal.hintCount() >= 2; },
          lines: ['one more, then. under everything, where the map is not a map of anything but a lid.',
                  'you will not find it by going deeper. you find it by already knowing it is there. i have told you. now you know.'],
          journal: 'thelast' },
        { at: function (d) { return VF.charms.owned('eye') && VF.journal.hintCount() >= 2 &&
                                    d.stats.catches >= 220 && d.level >= 45; },
          lines: ['sit down. no — take this first.',
                  'sixty years of cord on that blank, one turn at a time. i knew what the cord was after the first ten. ' +
                  'i kept winding.',
                  'i am not giving it to you because you are good. you are adequate. i am giving it to you because ' +
                  'i have stopped going out and it should not be in a cupboard.'],
          gives: 'rod', givesRod: 'redthread' }
      ] },

    { id: 'drifter', name: 'The Drifter', role: 'wander', color: '#b8a8e8',
      where: 'wherever you were not looking a moment ago',
      blurb: 'Turns up. Does not arrive.',
      stages: [
        { at: function (d) { return d.stats.casts >= 40; },
          lines: ['oh — you are real. good. i lose track.',
                  'i left a lantern somewhere. if it turns up, it is not a gift, it is just where it ended up.'] },
        { at: function (d) { return Object.keys(d.secrets).length >= 1; },
          lines: ['you found one of the quiet ones. they move, you know.',
                  'not fast. but they are not where they were, and they were not where they are.'] },
        { at: function (d) { return VF.conditions && !!d.flags.sawThinPlace; },
          lines: ['thin places. yes. the water gets uncommitted.',
                  'i think they are looking for something as well. i have never worked out whether we are looking for the same thing.'],
          journal: 'thinplace' },
        { at: function (d) { return d.stats.wrongEvents >= 1; },
          lines: ['it stopped for you too, then.',
                  'do not tell the archivist. she will want to know for how long, and the answer is the frightening part.'],
          journal: 'firstwrong' },
        { at: function (d) { return VF.secrets.found('the_last_water'); },
          lines: ['ah.', 'i will not be coming with you. i have been. that is why i drift.'] }
      ] },

    { id: 'collector', name: 'The Collector', role: 'cosmetic', color: '#e8a0c8',
      where: 'a stall of things that do nothing',
      blurb: 'Deals only in the useless. Very serious about it.',
      stages: [
        { at: function (d) { return d.level >= 4; },
          lines: ['none of this helps you fish. that is the entire appeal.',
                  'a case, if you like. brophys only. i have no interest in what you pull out of the water.'] },
        { at: function (d) { return d.stats.casesOpened >= 5; },
          lines: ['you are getting a feel for it. most people stop at two and pretend they were never interested.',
                  'the odds are printed. i print them because people assume i do not.'] },
        { at: function (d) { return d.cosmetics.length >= 12; },
          lines: ['twelve. good. there are some i do not sell, you understand — they turn up in the water.',
                  'no, i will not tell you which. that would ruin the only interesting part.'] },
        { at: function (d) { return d.cosmetics.length >= 26; },
          lines: ['at this point you have better taste than i do, which is professionally humiliating.',
                  'take this one. it was never for sale.'],
          gives: 'cosmetic' },
        { at: function (d) { return d.cosmetics.length >= 40 && d.level >= 60; },
          lines: ['there is a lead box behind the stall. there has always been a lead box behind the stall.',
                  'i deal in the useless. that is the whole trade. this one is not useless, which is why it has ' +
                  'never been on the table.',
                  'it lights the inside of your hand from the wrong side. do not thank me — take it away from my stock.'],
          gives: 'rod', givesRod: 'halflife' }
      ] }
  ];

  const BY_ID = VF.util.byId(LIST);

  const NOBODY = { met: 0, stage: 0, heard: [] };

  /* Read-only. Asking whether somebody has something to say must not create a
     record for them — that is a write, and it made "speak to all five of them"
     true for a player who had spoken to none of them. */
  function peek(id) {
    return VF.state.data.npcs[id] || NOBODY;
  }

  /* Writable. Only called when something actually happens with that person. */
  function rec(id) {
    const d = VF.state.data;
    if (!d.npcs[id]) d.npcs[id] = { met: 0, stage: 0, heard: [] };
    return d.npcs[id];
  }

  /* The highest stage whose condition is satisfied. */
  function availableStage(npc) {
    const d = VF.state.data;
    let n = -1;
    for (let i = 0; i < npc.stages.length; i++) {
      let ok = false;
      try { ok = npc.stages[i].at(d); } catch (e) { ok = false; }
      if (ok) n = i; else break;
    }
    return n;
  }

  function hasNew(id) {
    const npc = BY_ID[id];
    if (!npc) return false;
    return availableStage(npc) > peek(id).stage - 1;
  }

  function anyNew() {
    for (let i = 0; i < LIST.length; i++) if (hasNew(LIST[i].id)) return true;
    return false;
  }

  /* Talking is what actually advances things — being eligible is not enough.
     The stage advances the moment the conversation starts, but what comes out
     of it — a journal entry, a key, a gift — is handed over by `commit`, which
     the visit calls once the last line has been read. */
  function talk(id, opts) {
    const npc = BY_ID[id];
    if (!npc) return null;
    const r = rec(id);
    const avail = availableStage(npc);
    if (avail < 0) return null;
    const stage = Math.min(avail, r.stage);
    const def = npc.stages[stage];
    const first = stage >= r.stage;
    r.met++;
    let done = false;
    function commit() {
      if (done || !first) return;
      done = true;
      if (def.journal) VF.journal.add(def.journal);
      if (def.gives) VF.bus.emit('npc:gives', { npc: npc, gives: def.gives, rod: def.givesRod });
      VF.bus.emit('npc:advanced', { npc: npc, stage: stage });
      VF.save.save();
    }
    if (first) {
      r.stage = stage + 1;
      if (r.heard.indexOf(stage) < 0) r.heard.push(stage);
    }
    const res = { npc: npc, stage: stage, lines: def.lines, fresh: first, commit: commit };
    if (!(opts && opts.defer)) commit();
    return res;
  }

  function unlocked(id) {
    const npc = BY_ID[id];
    return !!npc && availableStage(npc) >= 0;
  }

  VF.npcs = {
    list: LIST,
    get: function (id) { return BY_ID[id] || null; },
    rec: rec, peek: peek, talk: talk, hasNew: hasNew, anyNew: anyNew,
    met: function (id) { return peek(id).met > 0; },
    unlocked: unlocked, availableStage: availableStage
  };
})(window.VF = window.VF || {});
