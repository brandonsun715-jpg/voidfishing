/* VOID FISHING — what each place actually DOES.

   js/data/locations.js says what a spot looks like and how the odds lean.
   That was enough when a zone was a backdrop and a fish table. It is not
   enough now, and it never made the nine places feel like nine places: they
   were one place with different multipliers.

   So every zone gets a `rule` — one or two mechanics that only exist there
   and that change what the player DOES, not what the numbers are:

     shore     bottles wash in, and something is offshore that should not be
     basin     the moon has phases and the water answers to them
     flats     you can see what is coming, and you can pick which one
     trench    the dark is real; the sonar is the only way through it
     abyss     the crystals charge, and what they discharge into is your choice
     cradle    the ring opens a section at a time and each one says something
     nowhere   the chart lies, and leaving does not always work
     beneath   down is a direction rather than a depth
     heavens   the light does not come from the sun and it notices you

   `ambient` names the visual layer js/render/zoneArt.js draws over the water,
   which is the other half of "I know where I am within five seconds".        */
(function (VF) {
  'use strict';

  const ZONES = {

    shore: {
      rule: 'bottles',
      ambient: 'gulls',
      line: 'calm, shallow, and about four degrees warmer than it has any right to be',

      /* --- what kind of space this is ---

         `shape`, `movement`, `light`, `nav` and `mechanic` are the identity
         matrix, and tools/zonecheck.js fails the build if two zones share a
         navigation problem, a main mechanic, or the whole look. They are a
         constraint rather than documentation: the failure mode this whole
         rebuild exists to prevent is nine places that differ by palette, and
         the only reliable guard against it is one that can go red.

         `empty` is the fraction of the water that must have nothing in it.
         The reflex when a frame looks thin is to add a rock; this is the
         number that says no. */
      spatial: {
        shape: 'curves', movement: 'calm', light: 'warm',
        nav: 'landmarks', mechanic: 'exploration',
        question: 'why does nobody go past the lighthouse?',
        air: 0.20, width: 2.2, empty: 0.42
      },

      /* --- and what is in it ---

         Not coordinates. A macro landmark's side and distance band, a set of
         meso landmarks described by what they should be near, and micro
         detail that collects in their influence. js/world/landmarks.js does
         the placing, by sightline, and the arrangement comes out different
         from the one anybody would have typed. */
      landmarks: {
        seed: 11,
        /* `s` is lateral in frames from centre, so -0.8 is most of the way
           to the left edge whatever the depth.

           THE HEADLAND CAME IN. It used to sit at d 1.45–1.95 — well past the
           horizon — which drew it small, high and half out of the top of the
           frame, and the generic ridgeline behind it won every time. It is
           the thing you are supposed to know this place by, so it is at the
           horizon now rather than beyond it, and further round to the left so
           the middle of the frame is water. */
        macro: { art: 'headland', side: -1, sMin: 0.72, sMax: 0.92,
                 dMin: 1.02, dMax: 1.18, tall: 1, scale: 1.25 },
        meso: [
          /* On the headland, not beside it: it is there to say how big the
             headland is, which is a job only something small can do. `du` is
             a hair landward of the seaward face, which is where a light
             actually stands. */
          { art: 'lighthouse', on: 'macro', du: -0.05, perch: 0.42, scale: 1.6 },
          /* A dock is attached to somewhere. Under the headland, in the
             midground — it is there to say that people come here and to give
             the cliff behind it a size. */
          { art: 'dock', sMin: -1.05, sMax: -0.45, dMin: 0.46, dMax: 0.70 },
          /* And the hull is kept well over the other way, because a wreck and
             a working dock in the same corner read as one confused object. */
          { art: 'wreck', sMin: 0.15, sMax: 0.95, dMin: 0.35, dMax: 0.62 },
          { art: 'island', count: 3, near: 'far', dMin: 0.80, dMax: 1.05 }
        ],
        micro: { arts: ['buoy', 'post', 'crate', 'rock', 'net'], count: 15,
                 dMin: 0.10, dMax: 0.95 },
        /* the thing that is out past all of it */
        secret: { art: 'standing', dMin: 0.86, dMax: 1.02, scale: 1 }
      },
      /* How often a bottle comes in, in seconds of fishing. Generous: this is
         the tutorial zone for the whole discovery system and a player who
         never sees one never learns that the system exists. */
      bottle: [95, 210],
      /* And once, early, something that does not belong in ankle-deep water
         crosses the middle distance. It is the first sentence of the game's
         longest chain and it is deliberately not explained. */
      anomalyAt: 6
    },

    basin: {
      rule: 'moon',
      ambient: 'moonpath',
      line: 'the moon has not moved since anyone started keeping records',
      spatial: {
        shape: 'rings', movement: 'slow', light: 'moonlight',
        nav: 'moonpath', mechanic: 'lunar',
        question: 'why does what lives here answer to a moon that never moves?',
        air: 0.34, width: 2.4, empty: 0.48
      },
      /* Five phases on a real 30-hour cycle, so it is the same for everybody
         at the same moment and turns over often enough to be worth planning
         around. Eclipse is rare and is the one that changes the zone. */
      phases: [
        { id: 'new', name: 'New', k: 0.00, span: 0.16,
          mods: { rare: 0.92, bite: 1.10 }, note: 'no moon at all. the water is black and busy.' },
        { id: 'crescent', name: 'Crescent', k: 0.22, span: 0.20,
          mods: { rare: 1.06 }, note: 'a rind of it. the reflection is a line.' },
        { id: 'half', name: 'Half', k: 0.44, span: 0.18,
          mods: { rare: 1.18, value: 1.10 }, note: 'half lit, and the lit half is the one nearer you.' },
        { id: 'full', name: 'Full', k: 0.66, span: 0.22,
          mods: { rare: 1.45, trait: 1.6, encounter: 1.5 }, glowWater: 1,
          note: 'the water is making its own light and the moon is not the reason.' },
        { id: 'eclipse', name: 'Eclipse', k: 0.92, span: 0.08,
          mods: { rare: 2.2, 'void': 1.8, encounter: 2.4 }, dark: 1,
          note: 'something is in front of it. it is not the world.' }
      ]
    },

    flats: {
      rule: 'clearwater',
      ambient: 'panes',
      line: 'you can see the bottom, and the bottom is a long way down, and it is flat',
      spatial: {
        shape: 'geometric', movement: 'flat', light: 'reflective',
        nav: 'visibility', mechanic: 'seeing-beneath',
        question: 'what is under water this clear, and why is it in rows?',
        air: 0.18, width: 2.6, empty: 0.44
      },
      /* The whole zone is one idea: the water is so clear that what is coming
         is visible before it arrives, and you can choose. Marks drift in from
         the edges and casting at one takes that one. */
      marks: [12, 26],
      /* And the other half of the idea: it is not water. */
      crackAt: 0.008
    },

    trench: {
      rule: 'sonar',
      ambient: 'dark',
      line: 'the light stops about nine metres down and the trench is eleven hundred',
      spatial: {
        shape: 'vertical', movement: 'still', light: 'bioluminescent',
        nav: 'sonar', mechanic: 'depth',
        question: 'what is moving below the range of the set?',
        air: 0.92, width: 2.2, empty: 0.72
      },

      /* The trench is a seam, and the whole zone is about not being able to
         see where it is. Everything here is vertical — walls that leave the
         top of the frame, pinnacles standing off them — because the shape
         language is the other half of knowing where you are, and it is the
         half that survives the dark.

         Six things in a very large amount of nothing. The empty budget is
         0.72 and it is the highest in the game: a trench that is furnished is
         not a trench, and the moment where a single light appears eight
         hundred metres out does not work if there are already nine of them. */
      landmarks: {
        seed: 23,
        /* The seam runs down the frame rather than across it, so the macro is
           the wall on the far side of it: close enough to loom, far enough
           that the water in front of it is the water you fish. */
        seam: { sMin: -0.45, sMax: 0.30 },
        macro: { art: 'trenchwall', side: 1, sMin: 0.70, sMax: 1.00,
                 dMin: 1.30, dMax: 1.75, tall: 1, scale: 1 },
        meso: [
          { art: 'pinnacle', count: 2, dMin: 0.55, dMax: 0.95, sMin: -1.1, sMax: 1.1 },
          /* The chain: a cable going down, and the thing at the top of it that
             nobody came back for. Neither is explained anywhere. */
          { art: 'cablehead', dMin: 0.40, dMax: 0.66, sMin: -0.9, sMax: 0.2 },
          { art: 'station', dMin: 0.46, dMax: 0.72, sMin: 0.1, sMax: 1.0 }
        ],
        micro: { arts: ['spark', 'debris'], count: 9, dMin: 0.15, dMax: 0.95 },
        /* And past the range of the set, one light. */
        secret: { art: 'farlight', dMin: 0.88, dMax: 1.0, scale: 1 },
        /* Not part of the grammar. This is here only if a chain in
           js/data/chains.js has put it here, which happens only if the player
           sailed past somebody calling and kept going. Nothing announces it.
           It is on the near side of the seam, in the open, where a hull that
           went down within sight of help would be. */
        consequences: [
          { fact: 'wreck_at_signal', art: 'wreck', kind: 'meso',
            s: -0.62, d: 0.52, scale: 0.85 }
        ]
      },
      /* Without a set, this zone is genuinely harder to fish: you cannot see
         an approach coming and you get no warning at all. With one, contacts
         appear and can be investigated, which is the only way to reach two of
         the creatures. */
      contact: [70, 165],
      blind: 0.62
    },

    abyss: {
      rule: 'resonance',
      ambient: 'crystals',
      line: 'the structures are warm, and they are still growing',
      spatial: {
        shape: 'angular', movement: 'pulsing', light: 'crystal',
        nav: 'formations', mechanic: 'resonance',
        question: 'who grew these, and what are they growing towards?',
        air: 0.40, width: 2.4, empty: 0.46
      },
      /* A charge that builds while you fish and discharges into whatever the
         last shard you picked up was.

         It used to be "spend three shards to tune the resonance toward a
         trait", which had a shard counter, a percentage readout and a choice
         of three named modes — and no interface anywhere in the game to make
         the choice with, so in practice it was a system the player was told
         about and could not touch. Now the shards come up in three colours,
         you take the one you want, and the water comes back that colour.
         Nothing explains this. Doing it twice explains it. */
      chargePer: 0.055,
      tunes: [
        { id: 'size',   colour: [255, 216, 150], trait: 'massive',     note: 'bigger' },
        { id: 'colour', colour: [150, 236, 255], trait: 'shimmering',  note: 'lit' },
        { id: 'void',   colour: [196, 148, 255], trait: 'voidtouched', note: 'wrong' }
      ]
    },

    cradle: {
      rule: 'excavate',
      ambient: 'ring',
      line: 'the ring overhead is most of a ring, and the missing part is below you',
      spatial: {
        shape: 'arcs', movement: 'mechanical', light: 'artificial',
        nav: 'structure', mechanic: 'excavation',
        question: 'what was a ring this size built to hold?',
        air: 0.32, width: 2.0, empty: 0.40
      },
      /* Four sections, opened one at a time by things the player does
         elsewhere. Each writes a piece of what the ring was for, and the last
         one is the way down. */
      sections: [
        { id: 'rim', name: 'The Outer Rim', need: 3,
          text: 'the outer plating comes away in sheets and there is a corridor behind it that ' +
                'ran all the way round. it was pressurised. some of it still is.' },
        { id: 'spine', name: 'The Spine', need: 8,
          text: 'the load path goes inward, not down. whatever this was built to hold was in ' +
                'the middle of the ring, and the middle of the ring is where the water is.' },
        { id: 'yard', name: 'The Yard', need: 16,
          text: 'a bay with the doors open and the gantries still extended. something the size ' +
                'of a district was assembled here and then it left through the bottom.' },
        { id: 'shaft', name: 'The Shaft', need: 28,
          text: 'the missing part of the ring is not missing. it goes down, and it is still ' +
                'going down, and it has been going down for four hundred years.' }
      ]
    },

    nowhere: {
      rule: 'drift',
      ambient: 'wrongsky',
      line: 'no coordinates were recorded and none can be',
      spatial: {
        shape: 'broken', movement: 'unstable', light: 'impossible',
        nav: 'unreliable', mechanic: 'anomaly',
        question: 'where is this?',
        air: 0.62, width: 2.8, empty: 0.66
      },
      /* Leaving does not always work. A crossing out of the Nowhere Sea has a
         real chance of landing somewhere other than where it was pointed, and
         the game says so afterwards rather than before. */
      driftChance: 0.26,
      /* And things repeat out here. */
      echoAt: [40, 110]
    },

    beneath: {
      rule: 'inverted',
      ambient: 'under',
      line: 'there is no surface. the line goes down and down is a direction, not a depth',
      spatial: {
        shape: 'impossible', movement: 'strange', light: 'void',
        nav: 'orientation', mechanic: 'descent',
        question: 'what is underneath an ocean?',
        air: 1.15, width: 1.8, empty: 0.78
      },
      /* Down is somewhere you can go further into. Each cast at depth adds to
         a reading; the deeper the reading the better the water, and it resets
         if you leave. It is the one zone that rewards staying put. */
      depthPer: 0.06
    },

    the_heavens: {
      rule: 'celestial',
      ambient: 'above',
      line: 'water lying on top of the cloud, with nothing under it but weather',
      spatial: {
        shape: 'vast', movement: 'floating', light: 'celestial',
        nav: 'vertical', mechanic: 'ascension',
        question: 'why does this exist, and who is it for?',
        air: 0.24, width: 3.0, empty: 0.58
      },
      /* The light up here is a thing rather than a condition, and it moves. */
      passAt: [80, 170]
    }
  };

  VF.zoneData = {
    zones: ZONES,
    get: function (id) { return ZONES[id] || null; },
    rule: function (id) { const z = ZONES[id]; return z ? z.rule : null; },
    ambient: function (id) { const z = ZONES[id]; return z ? z.ambient : null; }
  };
})(window.VF = window.VF || {});
