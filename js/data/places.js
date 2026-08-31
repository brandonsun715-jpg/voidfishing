/* VOID FISHING — Vault Harbour.

   A place that is not a fishing spot. It never appears in the shelf of water
   you can cast into, nothing bites here, and the rod stays in the boat. It is
   where a trip starts and where it ends, and the whole reason it exists is
   that the shop, the boatyard and the chart were buttons, and a button is not
   somewhere you have been.

   FOUR VIEWPOINTS AND NOT FIVE. You move between framed views rather than
   walking, because this is a game you play sitting down and a character
   controller would be a different game. Four is the number at which a hub is
   still a place you know rather than a place you navigate — the moment there
   is a fifth, the player stops looking at any of them.

   THE FIELDS, once, so the data below reads without a legend:
     on:     which ground curve this stands on — 'ground' (default) or 'edge'
     at:     where along the frame, as a fraction of its width
     depth:  1 is right here, less is further back; it shrinks AND lifts
     opens:  the panel this is a way into
     act:    'look' or 'leave' — the two things that are not a panel
     talk:   the person this is

   Everything is laid out in fractions: `at` and the ground control points are
   fractions of the frame, so the harbour composes the same on a phone held
   upright and on a wide monitor. Heights are in figure-heights, so a crate is
   knee-high on every screen there is.

   WHO IS NOT HERE, deliberately. The old fisherman is at the far end of the
   shore facing away and he stays there. The drifter turns up wherever you
   were not looking. The astronomer is up where the ground runs out. Putting
   all nine people in one square would make the harbour a lobby and would cost
   three characters the only thing the writing gives them, which is where they
   stand. */
(function (VF) {
  'use strict';

  const VIEWS = [

    /* ============================================================== the dock

       You are standing on the boards near the seaward end. The harbour is
       ahead and to the right and it is the only view here with real open
       water in it, which is what makes arriving and leaving read as arriving
       and leaving. Your boat is moored on the near side, close enough that
       its wear is legible without anybody having to open a panel.

       The child is at the far end with her feet over, exactly where the
       writing has always said she is. */

    { id: 'dock', name: 'the dock',
      sub: 'boards, water, and the way out',
      horizon: 0.400,
      light: [0.76, 0.22],
      /* Two curves, because there are two surfaces here and confusing them is
         what makes a jetty look like a beach. `edge` is the quay: water above
         it, boards below. `ground` is where a person's feet actually are,
         which is a couple of paces in from the edge. */
      edge:   [[-0.06, 0.652], [0.28, 0.640], [0.58, 0.638], [0.84, 0.644], [1.06, 0.656]],
      ground: [[-0.06, 0.830], [0.30, 0.806], [0.60, 0.798], [0.86, 0.802], [1.06, 0.814]],
      water: 1.0,
      far: [{ art: 'town', at: 0.16, d: 0.94, scale: 1.0 },
            { art: 'mole', at: 0.62, d: 0.80, scale: 1.0 },
            { art: 'harbourlight', at: 0.905, d: 0.78, scale: 0.9 }],
      people: [
        { npc: 'child', at: 0.845, pose: 'sit', facing: -1, on: 'edge' }
      ],
      spots: [
        { id: 'boat', at: 0.395, on: 'edge', w: 1.9, h: 0.80, rise: 0.05,
          label: 'your boat', hint: 'put out', act: 'leave' },
        { id: 'child', at: 0.845, on: 'edge', w: 0.6, h: 0.62, rise: 0.0,
          talk: 'child', label: 'the child', hint: 'talk' }
      ],
      exits: [
        { to: 'yard', side: -1, label: 'the boatyard' },
        { to: 'market', side: -1, label: 'the market row' }
      ] },

    /* ============================================================= the yard

       A hull up on blocks, and it is enormous — it is here to tell you how
       big the thing you sail actually is, which nothing in this game has ever
       done. The mechanic is under it. Your own boat is on the hard beside it,
       close enough to walk round, showing every plate he has put on it. */

    { id: 'yard', name: 'the boatyard',
      sub: 'a hull on blocks, and the man under it',
      horizon: 0.455,
      light: [0.20, 0.26],
      ground: [[-0.06, 0.800], [0.28, 0.786], [0.58, 0.792], [0.84, 0.806], [1.06, 0.820]],
      water: 0.45,
      far: [{ art: 'shed', at: 0.60, d: 0.86, scale: 1.0 },
            { art: 'crane', at: 0.86, d: 0.90, scale: 0.9 },
            { art: 'mole', at: 0.35, d: 0.94, scale: 0.8 }],
      people: [
        { npc: 'mechanic', at: 0.345, pose: 'under', facing: 1 }
      ],
      spots: [
        { id: 'blocks', at: 0.300, w: 3.0, h: 1.55, rise: 0.46,
          label: 'somebody else\u2019s hull', hint: 'look', act: 'look',
          look: 'she has been on those blocks since before you started. he will not say whose she is.' },
        { id: 'mine', at: 0.790, w: 1.2, h: 0.62, rise: 0.22,
          label: 'your boat', hint: 'the fitting', opens: 'boat' },
        { id: 'mechanic', at: 0.415, w: 1.3, h: 0.32, rise: 0.0,
          talk: 'mechanic', label: 'the mechanic', hint: 'talk' }
      ],
      exits: [ { to: 'dock', side: 1, label: 'the dock' } ] },

    /* =========================================================== the market

       Three stations under one awning, in the order you meet them: what you
       need, what you want, and what you are not sure about. The archivist is
       at the back where the shelves are, because a room of shelves nobody
       remembers building is not a room you can put a door on. */

    { id: 'market', name: 'the market row',
      sub: 'a counter, a stall, and a table by the window',
      horizon: 0.470,
      light: [0.92, 0.24],
      ground: [[-0.06, 0.845], [0.30, 0.836], [0.62, 0.838], [0.88, 0.845], [1.06, 0.852]],
      water: 0.30,
      /* The row has a back to it, and the water shows past the end of it.
         Without the wall the awning is a roof over the open sea. */
      far: [{ art: 'backwall', at: 0.42, d: 0.74, scale: 1.0 },
            { art: 'mole', at: 0.86, d: 0.94, scale: 0.7 }],
      awning: { y: 0.300, from: -0.02, to: 0.86 },
      people: [
        { npc: 'keeper', at: 0.150, pose: 'lean', facing: 1, depth: 0.90 },
        { npc: 'collector', at: 0.420, pose: 'stand', facing: -1, depth: 0.90 },
        { npc: 'cartographer', at: 0.700, pose: 'lean', facing: -1, depth: 0.90 },
        { npc: 'archivist', at: 0.300, pose: 'stand', facing: 1, depth: 0.66 }
      ],
      spots: [
        { id: 'counter', at: 0.180, w: 1.5, h: 0.40, label: 'the counter',
          hint: 'buy', opens: 'shop' },
        { id: 'stall', at: 0.450, w: 1.3, h: 0.38, label: 'the stall',
          hint: 'the useless', opens: 'wardrobe' },
        { id: 'table', at: 0.730, w: 1.5, h: 0.36, label: 'the chart table',
          hint: 'the water', opens: 'map' },
        { id: 'keeper', at: 0.150, w: 0.60, h: 1.0, rise: 0.30, talk: 'keeper',
          label: 'the keeper', hint: 'talk' },
        { id: 'collector', at: 0.420, w: 0.60, h: 1.0, rise: 0.30, talk: 'collector',
          label: 'the collector', hint: 'talk' },
        { id: 'cartographer', at: 0.700, w: 0.60, h: 1.0, rise: 0.30, talk: 'cartographer',
          label: 'the cartographer', hint: 'talk' },
        { id: 'archivist', at: 0.300, w: 0.45, h: 0.80, depth: 0.66, talk: 'archivist',
          label: 'the archivist', hint: 'talk' }
      ],
      exits: [ { to: 'dock', side: -1, label: 'the dock' },
               { to: 'home', side: 1, label: 'home' } ] },

    /* ============================================================== at home

       One room, and it is the only interior. The window is not decoration:
       the sea behind it is the same sea the shader is drawing, seen through a
       hole in the wall, which is why it moves and why the light in here is
       whatever the light out there is.

       Nothing in this room is a shop. It is where what you have done is kept:
       the wall, the desk, the tanks next door. */

    { id: 'home', name: 'home',
      sub: 'one room, above the water',
      interior: 1,
      horizon: 0.355,
      light: [0.26, 0.20],
      /* The floor. In here the "horizon" is the line where the wall meets it. */
      ground: [[-0.06, 0.700], [0.30, 0.700], [0.62, 0.700], [0.88, 0.700], [1.06, 0.700]],
      water: 0.15,
      /* The hole in the wall, in fractions of the frame. The room is painted
         around it and the sea shows through. */
      window: [0.300, 0.190, 0.470, 0.430],
      people: [],
      spots: [
        { id: 'wall', at: 0.740, w: 1.15, h: 0.78, rise: 0.72,
          label: 'the wall', hint: 'what you have kept', opens: 'bag' },
        { id: 'desk', at: 0.430, w: 1.15, h: 0.46, label: 'the desk',
          hint: 'the journal', opens: 'journal' },
        { id: 'tanks', at: 0.100, w: 0.80, h: 1.55, rise: 0.0,
          label: 'the door', hint: 'the tanks', opens: 'aquarium' },
        { id: 'window', at: 0.385, w: 1.0, h: 0.90, rise: 1.05,
          label: 'the window', hint: 'look out', act: 'look',
          look: function () {
            const h = VF.history;
            if (!h || !h.has('first_voyage')) return 'the harbour, and past it the water you have not been on yet.';
            return 'the harbour. the boats are all in. one of them is yours.';
          } }
      ],
      exits: [ { to: 'market', side: -1, label: 'the market row' } ] }
  ];

  const BY_ID = VF.util.byId(VIEWS);

  /* The harbour's own light and colour, in the shape js/render/palette.js
     wants a location in — so time of day and weather work in here exactly as
     they do on the water, for free, and a harbour at four in the morning is a
     different harbour. `void: 0` because this is the most solid place in the
     game and that is the point of it. */
  const LOCATION = {
    id: 'harbour', name: 'Vault Harbour', level: 0, port: 1,
    sky: ['#141d33', '#33486a'], water: ['#1d2f42', '#0a1119'], glow: '#e8c88a',
    fog: '#2b3c52', fogAmt: 0.26, stars: 0.5, starTint: '#dce8f5',
    depth: 0.45, void: 0.00
  };

  VF.placeData = {
    views: VIEWS,
    view: function (id) { return BY_ID[id] || VIEWS[0]; },
    first: function () { return VIEWS[0].id; },
    location: LOCATION,
    ids: VIEWS.map(function (v) { return v.id; })
  };
})(window.VF = window.VF || {});
