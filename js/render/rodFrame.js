/* VOID FISHING — what a rod is actually built like.

   The problem this file exists to solve, stated plainly: every rod in the game
   was the same rod. One quadratic spine from butt to tip, one linear taper
   from thick to thin, the reel in the same place, the grip the same length,
   and then a different colour on top. js/render/rodSignature.js varied the
   FITTINGS — how many guides, what the grip is wrapped in, what shape the butt
   cap is — and that was worth doing, but fittings are jewellery. Put six of
   them in a row as black silhouettes and you could not tell which was which.

   A frame is the construction. It decides the things that survive being
   reduced to a silhouette:

     CURVATURE   how much the blank bends, and which way. A void rod bends the
                 wrong way. A whip folds. A harpoon does not bend at all.
     PROFILE     the thickness at every point along it, as a function rather
                 than a straight line from thick to thin. This is the single
                 biggest one: a telescopic rod has visible steps, a bamboo rod
                 has nodes, a crystal rod gets WIDER toward the tip, a harpoon
                 is a parallel shaft with no taper in it whatsoever.
     PROPORTION  where the grip ends and the blank begins, which is what makes
                 one rod read as a short heavy thing and another as a long
                 light one at the same drawn length.
     HARDWARE    where the reel sits — at the butt like a fly rod, halfway up,
                 or forward of the grip — how big it is, and which side.
     ENDS        what the tip is: a ring, a spear head, three prongs, a shard
                 cluster, a hook, a frayed split, an emitter with nothing solid
                 in it at all.
     STRUCTURE   the things bolted on that are part of the rod rather than
                 decoration on it — a crossbar, an exoskeleton, a counterweight,
                 rib spurs, a splint over a break.

   Eighteen of them, and a rod is given one by what it IS rather than by a
   hash: a rod with "leviathan" in its name gets the bone frame, "kingfisher"
   gets the light one, anything void-styled bends backwards. The seed only
   breaks ties, so the same rod is the same rod forever.

   The frame is chosen once and cached. js/render/rodArt.js draws it. */
(function (VF) {
  'use strict';

  const U = VF.util;

  /* ---------------------------------------------------------- the profiles

     A profile is a multiplier on the blank's thickness at k, where k runs 0 at
     the butt to 1 at the tip. Returning 1 everywhere gives the old rod. These
     are what the eye actually reads. */

  function even() { return 1; }

  // a parallel shaft: no taper at all until the very end
  function shaft(k) { return k < 0.86 ? 1.55 : U.lerp(1.55, 0.7, (k - 0.86) / 0.14); }

  // steps, like a telescopic rod collapsed and pulled out again
  function stepped(n) {
    return function (k) {
      const seg = Math.min(n - 1, Math.floor(k * n));
      const inSeg = k * n - seg;
      // each section is a shallow taper of its own, then drops to the next
      return U.lerp(1.28, 0.62, seg / Math.max(1, n - 1)) * U.lerp(1.04, 0.94, inSeg);
    };
  }

  // bamboo: nodes are bulges at regular intervals along an otherwise thin cane
  function noded(n) {
    return function (k) {
      const p = (k * n) % 1;
      const bulge = Math.pow(Math.max(0, 1 - Math.abs(p - 0.5) * 4), 2);
      return 0.82 + bulge * 0.55;
    };
  }

  // gets WIDER toward the tip — nothing else in the game does this
  function reverse(k) { return U.lerp(0.62, 1.42, Math.pow(k, 1.6)); }

  // heavy at the hand, then almost nothing for the last two thirds
  function whip(k) { return k < 0.28 ? U.lerp(1.5, 0.85, k / 0.28) : U.lerp(0.85, 0.24, Math.pow((k - 0.28) / 0.72, 0.65)); }

  // thick and even, then a sudden shoulder — a club with a rod on the end
  function club(k) { return k < 0.42 ? 1.9 : U.lerp(1.9, 0.55, Math.pow((k - 0.42) / 0.58, 0.8)); }

  // a thin ribbon that swells once in the middle
  function spindle(k) { return 0.55 + Math.pow(Math.max(0, 1 - Math.abs(k - 0.42) * 2.6), 1.6) * 0.95; }

  // organic: tapers, but with a run of swellings like vertebrae
  function boned(k) {
    const ripple = Math.sin(k * Math.PI * 7) * 0.5 + 0.5;
    return U.lerp(1.35, 0.5, Math.pow(k, 0.9)) * (0.88 + ripple * 0.30);
  }

  // segments with real gaps in them; the gaps are drawn as nothing
  function segmented(n) {
    return function (k) {
      const p = (k * n) % 1;
      if (p > 0.86) return 0;                     // the gap
      return U.lerp(1.22, 0.58, k) * U.lerp(1.0, 0.86, p);
    };
  }

  // a plain rod, but noticeably fatter throughout
  function heavy(k) { return U.lerp(1.85, 0.72, Math.pow(k, 1.15)); }

  // a plain rod, but noticeably thinner throughout
  function slight(k) { return U.lerp(0.66, 0.34, Math.pow(k, 0.85)); }

  // broken and mended: a fat wrapped splint at 0.44
  function splinted(k) {
    const s = Math.pow(Math.max(0, 1 - Math.abs(k - 0.44) * 9), 1.4);
    return U.lerp(1.15, 0.6, k) + s * 0.85;
  }

  // asymmetric growth: swells twice, at different sizes, off rhythm
  function grown(k) {
    const a = Math.pow(Math.max(0, 1 - Math.abs(k - 0.30) * 5.5), 1.5) * 0.75;
    const b = Math.pow(Math.max(0, 1 - Math.abs(k - 0.66) * 7.5), 1.5) * 0.45;
    return U.lerp(1.05, 0.5, k) + a + b;
  }

  /* ------------------------------------------------------------ the frames

     `bend` multiplies the curvature the scene asked for; negative bends the
     other way. `blankAt` is where the blank starts, so a long grip and a short
     blank is a different object from the reverse at the same drawn length. */

  const FRAMES = [
    { id: 'switch', name: 'traditional',
      bend: 0.9, profile: even, wButt: 1.16, wTip: 1.1, blankAt: 0.16,
      guides: { n: 5, spread: 0.86, scale: 1.42, form: 'ring' },
      grip: { len: 0.155, kind: 'cork' }, reel: { at: 0.205, kind: 'spin', scale: 1.0 },
      tip: 'plain', extras: ['ferruleBrass'] },

    { id: 'bamboo', name: 'bamboo',
      bend: 1.55, profile: noded(7), sections: [5, 10], mk: noded, wButt: 0.82, wTip: 0.72, blankAt: 0.09,
      guides: { n: 9, spread: 1.10, scale: 0.62, form: 'ring' },
      grip: { len: 0.095, kind: 'cord' }, reel: { at: 0.115, kind: 'pin', scale: 0.72 },
      tip: 'plain', extras: ['nodeRings', 'whipping'] },

    { id: 'industrial', name: 'industrial',
      bend: 0.35, profile: stepped(4), sections: [3, 5], mk: stepped, wButt: 1.5, wTip: 1.35, blankAt: 0.20,
      guides: { n: 6, spread: 0.92, scale: 1.15, form: 'braced' },
      grip: { len: 0.185, kind: 'rubber', fore: 1 }, reel: { at: 0.255, kind: 'drum', scale: 1.35 },
      tip: 'plain', extras: ['bolts', 'sectionCollars', 'counterweight'] },

    { id: 'ornate', name: 'ornate',
      bend: 1.2, scurve: 0.55, profile: spindle, wButt: 1.05, wTip: 0.95, blankAt: 0.14,
      guides: { n: 7, spread: 1.0, scale: 1.05, form: 'double' },
      grip: { len: 0.135, kind: 'chased' }, reel: { at: 0.20, kind: 'spin', scale: 0.95 },
      tip: 'crowned', extras: ['scrollwork', 'flaredCollars', 'finial'] },

    { id: 'harpoon', name: 'harpoon',
      bend: 0.10, profile: shaft, wButt: 1.7, wTip: 1.7, blankAt: 0.22,
      guides: { n: 3, spread: 1.4, scale: 1.5, form: 'braced' },
      grip: { len: 0.20, kind: 'cord' }, reel: { at: 0.42, kind: 'drum', scale: 1.1 },
      tip: 'spear', reach: 0.16, extras: ['crossbar', 'lashings'] },

    { id: 'scifi', name: 'sci-fi',
      bend: 0.45, profile: segmented(5), sections: [4, 7], mk: segmented, wButt: 1.28, wTip: 1.2, blankAt: 0.17,
      guides: { n: 4, spread: 1.05, scale: 1.3, form: 'halo' },
      grip: { len: 0.145, kind: 'rubber' }, reel: { at: 0.215, kind: 'disc', scale: 1.05 },
      tip: 'emitter', reach: 0.07, extras: ['floatGaps', 'rail'] },

    { id: 'crystal', name: 'crystal',
      bend: 0.30, profile: reverse, wButt: 0.95, wTip: 1.6, blankAt: 0.13,
      guides: { n: 5, spread: 1.0, scale: 1.25, form: 'float' },
      grip: { len: 0.125, kind: 'quarried' }, reel: { at: 0.19, kind: 'orb', scale: 0.9 },
      tip: 'shard', reach: 0.09, extras: ['facets'] },

    { id: 'voidbent', name: 'void-bent',
      bend: -1.35, profile: whip, wButt: 1.1, wTip: 0.9, blankAt: 0.12,
      guides: { n: 6, spread: 1.25, scale: 0.95, form: 'halo' },
      grip: { len: 0.13, kind: 'bone' }, reel: { at: 0.185, kind: 'orb', scale: 0.95 },
      tip: 'split', extras: ['strands', 'wrongShadow'] },

    { id: 'bone', name: 'bone',
      bend: 1.35, profile: boned, wButt: 1.32, wTip: 1.0, blankAt: 0.15,
      guides: { n: 6, spread: 0.88, scale: 1.1, form: 'spiral' },
      grip: { len: 0.15, kind: 'bone' }, reel: { at: 0.21, kind: 'spin', scale: 1.0 },
      tip: 'hook', reach: 0.05, extras: ['ribs', 'vertebrae'] },

    { id: 'regal', name: 'regal',
      bend: 0.55, profile: even, wButt: 1.22, wTip: 1.05, blankAt: 0.20,
      guides: { n: 8, spread: 0.96, scale: 1.0, form: 'double' },
      grip: { len: 0.175, kind: 'chased', fore: 1 }, reel: { at: 0.33, kind: 'tall', scale: 1.15 },
      tip: 'crowned', extras: ['banner', 'flaredCollars', 'finial'] },

    { id: 'titan', name: 'titan',
      bend: 0.70, profile: club, wButt: 1.9, wTip: 1.5, blankAt: 0.24,
      guides: { n: 5, spread: 0.80, scale: 1.6, form: 'braced' },
      grip: { len: 0.215, kind: 'rubber', fore: 1 }, reel: { at: 0.29, kind: 'drum', scale: 1.55 },
      tip: 'plain', extras: ['shoulderPlate', 'counterweight', 'bolts'] },

    { id: 'minimal', name: 'minimal',
      bend: 0.22, profile: slight, wButt: 0.72, wTip: 0.6, blankAt: 0.10,
      guides: { n: 3, spread: 1.15, scale: 0.72, form: 'ring' },
      grip: { len: 0.10, kind: 'cord' }, reel: { at: 0.145, kind: 'inline', scale: 0.66 },
      tip: 'plain', extras: [] },

    { id: 'telescopic', name: 'telescopic',
      bend: 0.80, profile: stepped(6), sections: [4, 8], mk: stepped, wButt: 1.3, wTip: 1.25, blankAt: 0.11,
      guides: { n: 7, spread: 1.0, scale: 0.9, form: 'ring' },
      grip: { len: 0.105, kind: 'rubber' }, reel: { at: 0.155, kind: 'spin', scale: 0.85 },
      tip: 'plain', extras: ['sectionCollars'] },

    { id: 'centerpin', name: 'centrepin',
      bend: 1.15, profile: even, wButt: 0.9, wTip: 0.85, blankAt: 0.21,
      guides: { n: 9, spread: 1.05, scale: 0.68, form: 'ring' },
      // the reel is at the very butt, behind the hand — a fly rod, not a spinner
      grip: { len: 0.20, kind: 'cork', fore: 1 }, reel: { at: 0.045, kind: 'pin', scale: 1.25, side: -1 },
      tip: 'plain', extras: ['whipping'] },

    { id: 'whip', name: 'whip',
      bend: 1.85, profile: whip, wButt: 1.05, wTip: 0.8, blankAt: 0.08,
      guides: { n: 10, spread: 1.30, scale: 0.60, form: 'ring' },
      grip: { len: 0.085, kind: 'cord' }, reel: { at: 0.125, kind: 'inline', scale: 0.72 },
      tip: 'plain', extras: [] },

    { id: 'trident', name: 'trident',
      bend: 0.40, profile: shaft, wButt: 1.55, wTip: 1.5, blankAt: 0.19,
      guides: { n: 4, spread: 1.2, scale: 1.35, form: 'braced' },
      grip: { len: 0.17, kind: 'scaled' }, reel: { at: 0.235, kind: 'drum', scale: 1.05 },
      tip: 'prong', reach: 0.13, extras: ['lashings'] },

    { id: 'alien', name: 'alien',
      bend: 1.6, scurve: 0.85, profile: grown, wButt: 1.15, wTip: 0.95, blankAt: 0.13,
      guides: { n: 5, spread: 0.75, scale: 1.2, form: 'float' },
      grip: { len: 0.13, kind: 'scaled' }, reel: { at: 0.31, kind: 'orb', scale: 1.1 },
      tip: 'curl', reach: 0.06, extras: ['growths', 'offSpine'] },

    { id: 'relic', name: 'relic',
      bend: 1.0, profile: splinted, wButt: 1.25, wTip: 0.95, blankAt: 0.155,
      guides: { n: 6, spread: 0.92, scale: 1.08, form: 'ring' },
      grip: { len: 0.145, kind: 'cord' }, reel: { at: 0.225, kind: 'pin', scale: 0.95 },
      tip: 'chipped', extras: ['splint', 'mismatch', 'lashings'] }
  ];

  const BY_ID = U.byId(FRAMES);

  /* ------------------------------------------------------- who gets which

     By what the rod IS. The name comes first because that is what the player
     reads — a rod called Leviathan Rod should be a great ribbed bone thing and
     a rod called Kingfisher Rod should be the light quick one, and no hash can
     know that. The drawing style is the second vote, the tier is the third,
     and only then does the seed break a tie.

     Matched longest-first so 'leviathan king' does not land on 'king'. */

  /* A theme names a SET of frames, not one.

     Naming one was the first attempt and it failed on the numbers: twenty-two
     rods are drawn in the celestial style, so twenty-two rods came out as the
     same regal frame, and forty-seven landed on the fallback. A theme that
     picks between three frames that all suit it keeps the promise — a rod
     called Leviathan is still a great ribbed bone thing — while spreading a
     hundred and twenty-eight rods across eighteen constructions instead of
     four.

     Matched on word boundaries, not substrings. 'old' as a substring matches
     Goldstar, and that is how half the shop ended up holding the same stick. */

  const BY_NAME = [
    /* Ordered by how much a word says about the OBJECT rather than about its
       standing. "Crystal Emperor" is an emperor, but what it is made of tells
       you more about what it looks like than what it is called does — so the
       material, creature and element families are asked first and the titles
       last. Getting that the wrong way round put a crystal rod and a bone rod
       on the same frame because both were emperors. */
    ['leviathan|kraken|serpent|wyrm|hydra|drowned', ['bone', 'alien', 'titan']],
    ['bone|fang|tooth|claw|spine|rib|skull', ['bone', 'relic', 'harpoon']],
    ['dragon|wyvern|drake', ['bone', 'regal', 'titan']],
    ['crystal|prism|glass|diamond|shard|quartz|gem|facet|sapphire|opal',
      ['crystal', 'scifi', 'minimal']],
    ['frost|ice|frozen|glacier|glacierheart|rime|winter|snow', ['crystal', 'minimal', 'bamboo']],
    ['void|null|abyss|abyssal|abysswalker|nothing|hollow|unmaking|singularity|entropy|rift',
      ['voidbent', 'alien', 'relic']],
    ['nebula|quantum|photon|plasma|reactor|nova|pulse|halflife|aether|neon|circuit|flux',
      ['scifi', 'crystal', 'minimal']],
    ['alien|outer|strange|wrong|other|arms|eye|eyes|watching|dream|dreaming|phantom',
      ['alien', 'voidbent', 'scifi']],
    ['harpoon|spear|lance|whaler|impaler|pierce|barb', ['harpoon', 'trident', 'industrial']],
    ['trident|fork|triple|poseidon|neptune|three', ['trident', 'harpoon', 'regal']],
    ['titan|colossus|behemoth|juggernaut|giant|mountain|worldbreaker|world',
      ['titan', 'industrial', 'harpoon']],
    ['thunder|thundercoil|storm|stormglass|tempest|lightning|hammer|strike|breaker|moonbreaker',
      ['titan', 'industrial', 'trident']],
    ['machine|engine|iron|steel|forge|gear|chain|piston|rig|orrery|clock|hour|cog|coil',
      ['industrial', 'telescopic', 'titan']],
    ['relic|ruin|ruined|forgotten|broken|shattered|lost|rust|rusted|salvage|wreck|black',
      ['relic', 'industrial', 'bone']],
    ['ancient|elder|eldritch|primordial|first', ['ornate', 'relic', 'alien']],
    ['kingfisher|swift|feather|wing|winged|arrow|dart|zephyr|gale|quill',
      ['whip', 'minimal', 'bamboo']],
    ['thread|silk|hair|wisp|thin|slender|line|shadowline', ['whip', 'minimal', 'centerpin']],
    ['bamboo|cane|reed|river|brook|creek|willow|garden|meadow|riftwood|riftwalker',
      ['bamboo', 'switch', 'centerpin']],
    ['wood|wooden|oak|pine|old|simple|plain|starter|worn|fiberglass|composite',
      ['switch', 'bamboo', 'relic']],
    ['tide|tidal|current|drift|angler|fly|stream|shore|harbour|coast|wave|duskwave|dreamwave',
      ['centerpin', 'switch', 'whip']],
    ['moon|lunar|moonlit|moonveil|quiet|silent|still|white|pale|veil|ghost|ghostcurrent',
      ['minimal', 'whip', 'crystal']],
    ['pocket|field|pack|traveller|folding|telescopic|telescope', ['telescopic', 'minimal', 'switch']],
    ['ember|emberstrike|flame|fire|pyre|cinder|ash|volcanic|magma|inferno|sun|solar|solaris|dawn|sunflare',
      ['industrial', 'harpoon', 'ornate']],
    ['deep|deepwater|deepstar|sunken|trench|fathom|drown|ocean|oceanheart|sea|seaborn',
      ['harpoon', 'centerpin', 'bone']],
    ['star|starforged|starshard|stellar|astral|cosmos|cosmic|galaxy|celestial|heaven|heavens|orbit|orbital|eclipse|aurora',
      ['regal', 'crystal', 'scifi']],
    /* and only now what it is called */
    ['crown|king|emperor|empress|royal|imperial|sovereign|monarch|throne|regent',
      ['regal', 'ornate', 'titan']],
    ['gilded|gilt|golden|god|godfall|seraph|divine|saint|angel', ['regal', 'ornate', 'crystal']]
  ].map(function (e) { return [new RegExp('\\b(?:' + e[0] + ')\\b', 'i'), e[1]]; });

  /* The drawing style is the second vote and it names a set too, for the same
     reason: twelve rods share a style. */
  const BY_STYLE = {
    plain: ['switch', 'bamboo', 'telescopic'],
    tide: ['centerpin', 'bamboo', 'whip'],
    storm: ['titan', 'industrial', 'trident'],
    thunder: ['titan', 'trident', 'industrial'],
    frost: ['crystal', 'minimal', 'bamboo'],
    glass: ['crystal', 'scifi', 'minimal'],
    mirror: ['crystal', 'minimal', 'alien'],
    prism: ['crystal', 'scifi', 'ornate'],
    ember: ['industrial', 'harpoon', 'titan'],
    ash: ['relic', 'industrial', 'bone'],
    lunar: ['minimal', 'whip', 'crystal'],
    celestial: ['regal', 'crystal', 'scifi'],
    heavens: ['regal', 'ornate', 'titan'],
    solar: ['regal', 'ornate', 'industrial'],
    runic: ['ornate', 'relic', 'bone'],
    crown: ['regal', 'ornate', 'trident'],
    gilt: ['regal', 'ornate', 'crystal'],
    void: ['voidbent', 'alien', 'relic'],
    abyssal: ['voidbent', 'bone', 'harpoon'],
    deep: ['harpoon', 'centerpin', 'bone'],
    glitch: ['alien', 'voidbent', 'relic'],
    kraken: ['bone', 'alien', 'trident'],
    hemo: ['bone', 'voidbent', 'relic'],
    thorn: ['bone', 'ornate', 'relic'],
    bloom: ['bamboo', 'alien', 'ornate'],
    fungal: ['alien', 'bone', 'bamboo'],
    spiral: ['alien', 'ornate', 'scifi'],
    neon: ['scifi', 'crystal', 'minimal'],
    corded: ['industrial', 'telescopic', 'switch'],
    clockwork: ['industrial', 'telescopic', 'ornate'],
    chrono: ['industrial', 'ornate', 'scifi'],
    quill: ['whip', 'minimal', 'bamboo'],
    wrap: ['relic', 'switch', 'centerpin']
  };

  /* And when nothing has an opinion, spread the tier across frames that suit
     it rather than giving them all the same one. */
  const BY_TIER = [
    ['switch', 'bamboo', 'centerpin', 'minimal', 'telescopic'],
    ['switch', 'telescopic', 'centerpin', 'industrial', 'whip', 'bamboo'],
    ['industrial', 'harpoon', 'ornate', 'bone', 'crystal', 'scifi', 'telescopic'],
    ['bone', 'crystal', 'regal', 'trident', 'scifi', 'titan', 'relic', 'harpoon'],
    ['regal', 'titan', 'voidbent', 'alien', 'crystal', 'ornate', 'trident']
  ];

  function hash(str) {
    let h = 2166136261 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
      h = (h << 13) | (h >>> 19);
    }
    h ^= h >>> 16; h = Math.imul(h, 2246822507);
    return (h ^ (h >>> 13)) >>> 0;
  }

  function pick(rod) {
    const name = String(rod.name || rod.id || '');
    const h = hash(rod.id || name);
    for (let i = 0; i < BY_NAME.length; i++) {
      if (BY_NAME[i][0].test(name)) {
        /* The first frame in a family is the obvious answer for that theme and
           gets half the rods; the other two keep the shelf from being a row of
           identical bone rods. */
        const set = BY_NAME[i][1];
        const w = [set[0], set[0], set[1] || set[0], set[2] || set[0]];
        return w[h % 4];
      }
    }
    const st = rod.art && rod.art.style;
    if (st && BY_STYLE[st]) {
      const set = BY_STYLE[st];
      const w = [set[0], set[0], set[1] || set[0], set[2] || set[0]];
      return w[h % 4];
    }
    const g = VF.rodSig ? VF.rodSig.grade(rod) : 0.5;
    const band = BY_TIER[U.clamp(Math.floor(g * BY_TIER.length), 0, BY_TIER.length - 1)];
    return band[h % band.length];
  }

  const cache = Object.create(null);

  function of(rod) {
    /* Something with no id is a swatch rather than a rod — the Wardrobe draws
       rod finishes on a stub to show what the paint looks like. It still gets
       a fully built frame rather than the raw table entry, because the table
       entries are templates and half their fields are only filled in below;
       handing one straight back put an undefined through Math.max and a NaN
       into a gradient. */
    const key = (rod && rod.id) || '\u0000swatch';
    const hit = cache[key];
    if (hit) return hit;
    const base = (rod && rod.id ? BY_ID[pick(rod)] : null) || BY_ID.switch;

    /* Two rods on the same frame are the same construction, which is right —
       a bone rod is a bone rod — but they must not be the same object. Seven
       rods per frame is what a hundred and twenty-eight across eighteen comes
       to, and seven identical bone rods is the bug this file exists to fix,
       one level further down.

       So the variation here is wide enough to matter and confined to things
       that do not change what the rod IS: how hard it bends and which way, how
       much of it is grip, how thick it runs, how many sections a sectioned one
       has, how many guides and how they are spaced, and where the reel sits.
       Two rods on the bone frame are both ribbed and hooked, and one of them
       is a long thin one with nine guides and the other a short fat one with
       five. */
    const h = hash(key);
    const r1 = ((h >>> 2) & 255) / 255, r2 = ((h >>> 10) & 255) / 255;
    const r3 = ((h >>> 18) & 255) / 255, r4 = ((h >>> 6) & 127) / 127;
    const r5 = ((h >>> 14) & 127) / 127, r6 = ((h >>> 22) & 127) / 127;

    /* The profile is the biggest single contributor to a silhouette, so it is
       varied twice: how many sections a sectioned frame has, and how far the
       whole shape is pushed away from a plain taper. */
    let prof = base.profile;
    if (base.mk && base.sections) {
      const n = Math.round(U.lerp(base.sections[0], base.sections[1], r4));
      prof = base.mk(n);
    }
    const amt = U.lerp(0.72, 1.34, r5);
    const wobF = 2 + Math.floor(r6 * 4);
    const wobA = U.lerp(0.02, 0.11, r6);
    const wobP = r1 * Math.PI * 2;
    const profile = function (k) {
      const b = prof(k);
      if (b <= 0.02) return 0;                     // a gap the frame asked for stays a gap
      return Math.max(0.06, (1 + (b - 1) * amt) * (1 + Math.sin(k * Math.PI * wobF + wobP) * wobA));
    };

    const f = {
      id: base.id, name: base.name,
      profile: profile,
      bend: base.bend * U.lerp(0.62, 1.44, r1),
      scurve: (base.scurve || 0) * U.lerp(0.7, 1.3, r3),
      wButt: base.wButt * U.lerp(0.80, 1.22, r2),
      wTip: base.wTip * U.lerp(0.78, 1.26, r5),
      blankAt: U.clamp(base.blankAt * U.lerp(0.74, 1.30, r3), 0.05, 0.30),
      guides: {
        n: U.clamp(base.guides.n + Math.round((r1 - 0.5) * 4), 3, 11),
        spread: base.guides.spread * U.lerp(0.80, 1.24, r2),
        scale: base.guides.scale * U.lerp(0.80, 1.24, r3),
        form: base.guides.form
      },
      grip: { len: base.grip.len * U.lerp(0.74, 1.34, r2),
              kind: base.grip.kind, fore: base.grip.fore || 0 },
      reel: { at: base.reel.at + (r3 - 0.5) * 0.075, kind: base.reel.kind,
              scale: base.reel.scale * U.lerp(0.82, 1.20, r1),
              side: base.reel.side || 1 },
      tip: base.tip,
      reach: (base.reach || 0) * U.lerp(0.75, 1.3, r4),
      /* The first extra is the frame's signature and every rod on it keeps
         that one — a harpoon has a crossbar, a bone rod has ribs. The rest are
         thinned by the seed, so two harpoons are not the same harpoon with the
         same three things bolted to it in the same three places. */
      extras: base.extras.filter(function (e, i) {
        if (i === 0) return true;
        return ((h >>> (24 + i)) & 3) !== 0;
      }),
      phase: r1 * Math.PI * 2
    };
    // the positions the guides actually sit at, off this frame's own spread
    f.guideAt = [];
    const start = U.clamp(f.blankAt + f.grip.len + 0.055, 0.18, 0.42);
    for (let i = 0; i < f.guides.n; i++) {
      const u = f.guides.n === 1 ? 1 : i / (f.guides.n - 1);
      f.guideAt.push(start + (0.965 - start) * Math.pow(u, f.guides.spread));
    }
    cache[key] = f;
    return f;
  }

  VF.rodFrame = {
    list: FRAMES,
    of: of,
    get: function (id) { return BY_ID[id] || null; },
    /* the tools sheet groups by these */
    frameId: function (rod) { return of(rod).id; },
    clear: function () { for (const k in cache) delete cache[k]; }
  };
})(window.VF = window.VF || {});
