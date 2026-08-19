/* VOID FISHING — journal entries.
   Written by the game as things happen. Read in order they tell you what this
   place is, and eventually where the last of it is. */
(function (VF) {
  'use strict';

  const ENTRIES = {
    bottle: { title: 'the note in the bottle', kind: 'find',
      text: 'the handwriting is careful and the ink is not wet. it reads: "the shore is not the first shore. count backwards." there is no signature.' },
    fossil: { title: 'on the fossil', kind: 'find',
      text: 'nothing here has bones like this. the archivist would say that means it did not come from here. she would then ask where it did come from, and wait.' },
    key: { title: 'the brass key', kind: 'find',
      text: 'the keeper turned it over twice and said he had a box it might open, and that the box was full of things nobody had claimed. he took it and gave you nothing, which felt fair at the time.' },
    plate: { title: 'the engraved plate', kind: 'lore',
      text: 'a list of names. then a date. then, much further down and in a different hand, a second date roughly four hundred years later. the same names.' },
    chart: { title: 'the ruined chart', kind: 'lore', hint: 1,
      text: 'most of it has dissolved. one marked position survives, well past the trench, in water the current charts leave blank. somebody drew a small circle there and did not write anything next to it.' },
    lens: { title: 'the clouded lens', kind: 'lore',
      text: 'looking through it at the water, the water is about a metre to the left of where it is. looking through it at the sky is not recommended and you will only do it once.' },
    voidfrag: { title: 'the fragment', kind: 'lore',
      text: 'it is cold in a way that has nothing to do with temperature. holding it, the sense of down gets much stronger, and points somewhere the trench does not go.' },
    lantern: { title: "the drifter's lantern", kind: 'lore',
      text: 'still lit. the flame is the wrong colour and does not move when you do. the drifter said he had left it somewhere, once, and did not seem surprised to hear where it turned up.' },
    fossilheart: { title: 'the warm fossil', kind: 'lore',
      text: 'stone all the way through, and warm. it beats, if you are patient and hold it long enough, about once every four minutes.' },
    eye: { title: 'the eye', kind: 'lore',
      text: 'it is open. it does not blink, it does not track, and it is definitely looking. the archivist would not take it and asked you to keep it somewhere she was not.' },
    strange: { title: 'the unidentifiable thing', kind: 'lore',
      text: 'you can describe every part of it. the parts do not add up to anything. writing this down has not helped.' },

    firstvoid: { title: 'the first void catch', kind: 'event',
      text: 'it came up wrong. not damaged — wrong, in the way a sentence can be grammatical and still mean nothing. it is in the fishdex now, which is the only reason you believe it happened.' },
    firstwrong: { title: 'the quiet minute', kind: 'event',
      text: 'the water stopped. not calmed — stopped, entirely, like a held frame. it lasted under a minute and then went back to being water. nothing was on the line before or after.' },
    stillness: { title: 'on dead calm', kind: 'event',
      text: 'the old fisherman says the water goes flat like that when something large is holding still underneath it, and that the flatness is the shape of its back.' },
    thinplace: { title: 'thin places', kind: 'event',
      text: 'the water gets uncommitted. you can see through it to somewhere that is not the bottom. the drifter calls these thin places and says they move, and that they are looking for something too.' },

    beneath: { title: 'below the nowhere sea', kind: 'lore', hint: 1,
      text: 'the charts stop at the nowhere sea because the people drawing them stopped. it goes further. the old fisherman has been once and will not say how, only that you have to already know it is there.' },
    thelast: { title: 'the last water', kind: 'lore', hint: 2,
      text: 'every clue points the same direction and none of them name it. the chart circle, the plate\'s second date, the fragment\'s sense of down. there is one more place. it is not on the map because the map is what it is under.' }
  };

  /* Add an entry once. Later entries never overwrite earlier ones. */
  function add(id, extra) {
    const d = VF.state.data;
    const def = ENTRIES[id];
    if (!def) return false;
    for (let i = 0; i < d.journal.length; i++) if (d.journal[i].id === id) return false;
    d.journal.push({
      id: id, title: def.title, text: extra ? def.text + ' ' + extra : def.text,
      kind: def.kind, hint: def.hint || 0, at: Date.now()
    });
    if (d.journal.length > 300) d.journal.shift();
    VF.bus.emit('journal:entry', def);
    return true;
  }

  function has(id) {
    const d = VF.state.data;
    for (let i = 0; i < d.journal.length; i++) if (d.journal[i].id === id) return true;
    return false;
  }

  /* How many of the entries that actually point somewhere the player has. */
  function hintCount() {
    const d = VF.state.data;
    let n = 0;
    for (let i = 0; i < d.journal.length; i++) n += d.journal[i].hint || 0;
    return n;
  }

  VF.journal = { entries: ENTRIES, add: add, has: has, hintCount: hintCount };
})(window.VF = window.VF || {});
