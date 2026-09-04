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

      /* --- and what is in it ---

         A BOWL, which is a shape the game has never drawn. The trench has one
         wall on one side and open water everywhere else; this has to close
         around you, and enclosure is not one big rock — it is a far rim you
         cannot see past and two masses at the edges of vision that you cannot
         see round.

         So the macro is the rim: low, continuous, at the horizon, running
         most of the way across. The two headwalls are meso rather than macro
         because they are near the frame edges where a macro would take the
         whole picture, and because js/world/landmarks.js places meso by
         sightline — which means they end up somewhere the rim and each other
         can actually see, and the bowl comes out shaped rather than typed.

         And the enclosure has to COST something, or it is scenery. Landmarks
         already block sightlines (blockersFor), so a headwall puts water
         behind it that cannot be seen from the seat — which in the one zone
         whose mechanic is watching the moonpath is a real thing to have to
         move around. */
      landmarks: {
        seed: 29,
        macro: { art: 'basinrim', side: -1, sMin: 0.05, sMax: 0.35,
                 dMin: 1.15, dMax: 1.40, tall: 0, scale: 1.5 },
        meso: [
          /* One a side, said as two entries rather than as count: 2 over a
             wide range — the placer is free inside what it is given, and given
             the whole frame it put a wall in the middle of the picture, which
             is a boulder in the way rather than a bowl around you. */
          { art: 'headwall', sMin: -1.30, sMax: -0.78, dMin: 0.70, dMax: 1.05, scale: 1.15 },
          { art: 'headwall', sMin: 0.78, sMax: 1.30, dMin: 0.70, dMax: 1.05, scale: 1.15 },
          /* The way in. Two shoulders and a gap, and the gap is where the
             moonpath runs out of the bowl — the one direction that is not
             closed, which is what tells you the rest of it is. */
          { art: 'narrows', sMin: -0.85, sMax: 0.85, dMin: 0.86, dMax: 1.08 },
          /* Under the surface rather than on it. Nothing else in the game is
             drawn below the waterline as a solid, and the basin is where the
             water is still enough to see one through. */
          { art: 'submerged', count: 2, sMin: -1.0, sMax: 1.0,
            dMin: 0.28, dMax: 0.60 }
        ],
        micro: { arts: ['boulder', 'driftlog'], count: 11, dMin: 0.12, dMax: 0.90 },
        /* A gap in the rim, and you only ever see it as a gap — a piece of
           the ring that is missing, lit from behind at the phase where the
           moon is low enough to be in it. */
        secret: { art: 'cleft', dMin: 1.10, dMax: 1.34, scale: 1.1 }
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

      /* --- and what is in it ---

         NOTHING TALL. Every other zone in the game is shaped by something
         standing up out of the water; the flats are shaped by the fact that
         nothing does. So the macro is a shelf at the horizon barely thicker
         than a line, and what gives the zone its shape is the SEABED — which
         you can see, because the water model here is a mirror over a floor.

         The formations are the exception and they are the whole point: three
         things in the entire frame that are not flat, and every one of them
         is a right angle, which is the one thing this water has no business
         producing. `shape: geometric` in the identity above is a claim, and
         these are it.

         And the channel is the danger. A hull with any draught at all cannot
         cross this water anywhere except where somebody has marked it, and
         the markers are the marking. js/systems/boat.js already grounds a
         deep hull in shallow water; this is where a player can SEE that
         before it happens instead of reading it in a panel. */
      landmarks: {
        seed: 41,
        macro: { art: 'glassshelf', side: 1, sMin: 0.10, sMax: 0.50,
                 dMin: 1.20, dMax: 1.55, tall: 0, scale: 1.6 },
        meso: [
          { art: 'prism', count: 3, sMin: -1.05, sMax: 1.05,
            dMin: 0.40, dMax: 1.05, scale: 1.0 },
          /* Where the water is deep enough. Not decoration — the one line
             across this zone a boat can actually follow. */
          { art: 'channel', sMin: -0.70, sMax: 0.70, dMin: 0.30, dMax: 0.78 },
          /* And what happens to the ones that did not follow it. */
          { art: 'aground', sMin: -1.10, sMax: 1.10, dMin: 0.34, dMax: 0.70 }
        ],
        micro: { arts: ['marker', 'shard'], count: 9, dMin: 0.12, dMax: 0.92 },
        /* A rectangle standing in the water with nothing in it and nothing
           on the other side of it. It is only ever square-on from one bearing,
           which is the only reason anybody would notice it is not a reflection. */
        secret: { art: 'doorframe', dMin: 0.90, dMax: 1.14, scale: 1 }
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

      /* --- and what is in it ---

         A CAVERN, so the shape of the place is the shape of the space rather
         than of anything in it. The macro is the far wall of the chamber and
         it has crystal growing out of the bottom of it; the spires are what
         the identity above calls `angular`, and they are the navigation,
         because in a cavern you steer by the formations and there is nothing
         else to steer by.

         The mouth is the reason this is not just a room: an opening in the
         wall with more of it behind, which says the cavern continues and you
         are in one chamber of it. Nothing in the game ever goes through. */
      landmarks: {
        seed: 53,
        macro: { art: 'cavernwall', side: -1, sMin: 0.30, sMax: 0.70,
                 dMin: 1.10, dMax: 1.45, tall: 1, scale: 1.35 },
        meso: [
          { art: 'crystalspire', count: 3, sMin: -1.15, sMax: 1.15,
            dMin: 0.34, dMax: 1.00, scale: 1.0 },
          { art: 'mouth', sMin: -1.0, sMax: 1.0, dMin: 0.80, dMax: 1.12, scale: 1.1 },
          /* Growth ON something, the way it actually grows — the spires are
             what happens when it has had somewhere to start. */
          { art: 'crust', count: 2, sMin: -1.0, sMax: 1.0, dMin: 0.22, dMax: 0.58 }
        ],
        micro: { arts: ['shard', 'spark'], count: 12, dMin: 0.10, dMax: 0.95 },
        /* Light from inside a chamber, a long way in. */
        secret: { art: 'heartlight', dMin: 0.92, dMax: 1.16, scale: 1 }
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

      /* --- and what is in it ---

         ARCHITECTURE, which is the one thing none of the other eight have.
         Everything here was BUILT, so nothing is eroded and nothing is
         scattered: the shapes are arcs and right angles, they are placed on a
         common centre, and the wear on them is structural failure rather than
         weather.

         The macro is where the ring comes down and enters the water — the
         single fact the zone is named for, drawn rather than described. The
         pylons carry the same curve at a smaller radius, so the eye gets the
         ring's real size from the relationship between them and not from the
         one enormous shape, which at this distance would just be a wall.

         And the stair is the human scale. Something the size of a district
         needs one thing on it a person could walk up, or it has no size at
         all — the lighthouse does this job on the Quiet Shore. */
      landmarks: {
        seed: 67,
        macro: { art: 'ringfoot', side: 1, sMin: 0.20, sMax: 0.62,
                 dMin: 1.05, dMax: 1.35, tall: 1, scale: 1.4 },
        meso: [
          { art: 'pylon', count: 2, sMin: -1.15, sMax: 1.15,
            dMin: 0.50, dMax: 1.00, scale: 1.0 },
          /* Steps going into the water, and they carry on under it. */
          { art: 'stair', sMin: -0.90, sMax: 0.90, dMin: 0.26, dMax: 0.55 },
          { art: 'plinth', sMin: -1.0, sMax: 1.0, dMin: 0.40, dMax: 0.80 }
        ],
        micro: { arts: ['rubble', 'glyph'], count: 12, dMin: 0.10, dMax: 0.90 },
        /* A door in a structure with no building attached to it. */
        secret: { art: 'doorway', dMin: 0.88, dMax: 1.12, scale: 1 }
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

      /* --- and what is in it ---

         LANDMARKS YOU CANNOT USE, which is a harder thing to build than
         landmarks you can. A place is disorienting because the cues are
         WRONG, not because they are absent — an empty frame is restful, and
         this zone has been an empty frame for its whole life.

         So: a mass at the horizon that is nearly land and is not; and then
         the tell, which is the same object drawn three times at three
         distances. Not three similar objects — one object, three times. A
         player who never notices loses nothing. A player who notices has
         found out something about where they are that no line of dialogue
         could deliver, and there is no line of dialogue about it. */
      landmarks: {
        seed: 83,
        macro: { art: 'falseland', side: -1, sMin: 0.15, sMax: 0.60,
                 dMin: 1.10, dMax: 1.50, tall: 0, scale: 1.3 },
        meso: [
          /* The repeat. Same art, three ranges, deliberately un-jittered in
             everything except distance. */
          { art: 'echo', count: 3, sMin: -1.10, sMax: 1.10,
            dMin: 0.30, dMax: 1.05, scale: 1.0 },
          /* And a piece of the picture with nothing in it, which is worse. */
          { art: 'absence', sMin: -0.95, sMax: 0.95, dMin: 0.45, dMax: 0.95 }
        ],
        micro: { arts: ['driftmark'], count: 7, dMin: 0.14, dMax: 0.92 },
        secret: { art: 'otherlight', dMin: 0.94, dMax: 1.20, scale: 1 }
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

      /* --- and what is in it ---

         The `empty` fraction here is 0.78, the highest in the game, and it is
         the constraint that matters most: four things in the entire frame.
         Everywhere else restraint is a preference; here it is the zone.

         Nothing stands ON the water because there is nothing for it to stand
         on. The columns go through it — up out of sight and down out of
         sight, continuing past both edges of what you can see — which is the
         only shape that says "you are somewhere in the middle of something
         much larger" without a word of it being written down.

         And the overhang is above and behind, which no other zone has: in
         every other place in the game the sky is empty. */
      landmarks: {
        seed: 97,
        macro: { art: 'overhang', side: 1, sMin: 0.0, sMax: 0.40,
                 dMin: 1.20, dMax: 1.60, tall: 1, scale: 1.5 },
        meso: [
          { art: 'column', count: 3, sMin: -1.05, sMax: 1.05,
            dMin: 0.34, dMax: 1.05, scale: 1.0 }
        ],
        micro: { arts: ['mote'], count: 6, dMin: 0.16, dMax: 0.94 },
        /* It is looking at you and it is the size of the zone. */
        secret: { art: 'pupil', dMin: 0.90, dMax: 1.18, scale: 1 }
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

      /* --- and what is in it ---

         The one place where the geography is VERTICAL. Everywhere else in the
         game the interesting axis runs away from you toward a horizon; here it
         runs up and down, because the water is a sheet lying on the top of the
         weather and the only question about anything is how far above or below
         the sheet it is.

         So the macro is a thunderhead — a storm seen from ABOVE, coming up
         through the surface the player is fishing on, which is a sentence
         nothing else in the game can say. The wells are holes in the sheet
         with the world a very long way down through them, and they are the
         only place in the zone where distance is legible at all.

         Nothing here is rock. Nothing here has a foot on the bottom. */
      landmarks: {
        seed: 109,
        macro: { art: 'thunderhead', side: -1, sMin: 0.25, sMax: 0.70,
                 dMin: 1.00, dMax: 1.40, tall: 1, scale: 1.5 },
        meso: [
          { art: 'driftisle', count: 2, sMin: -1.10, sMax: 1.10,
            dMin: 0.40, dMax: 1.00, scale: 1.0 },
          /* A hole in the floor, and the world through it. */
          { art: 'sunwell', sMin: -0.85, sMax: 0.85, dMin: 0.28, dMax: 0.72 }
        ],
        micro: { arts: ['feather'], count: 8, dMin: 0.12, dMax: 0.92 },
        secret: { art: 'ascent', dMin: 0.92, dMax: 1.18, scale: 1 }
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
