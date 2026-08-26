/* VOID FISHING — day/night cycle.
   One full day is DAY_LENGTH real seconds and transitions continuously, so the
   scene is never abruptly repainted. Phases are named windows on that cycle. */
(function (VF) {
  'use strict';

  const DAY_LENGTH = 560;

  const PHASES = [
    { id: 'dawn',   name: 'Dawn',   from: 0.00, to: 0.18 },
    { id: 'day',    name: 'Day',    from: 0.18, to: 0.48 },
    { id: 'sunset', name: 'Sunset', from: 0.48, to: 0.64 },
    { id: 'night',  name: 'Night',  from: 0.64, to: 1.00 }
  ];

  let cycle = 0.66;   // start just into night — the game reads best at night
  let phaseId = 'night';

  function tick(dt) {
    const prev = phaseId;
    cycle = (cycle + dt / DAY_LENGTH) % 1;
    for (let i = 0; i < PHASES.length; i++) {
      if (cycle >= PHASES[i].from && cycle < PHASES[i].to) { phaseId = PHASES[i].id; break; }
    }
    if (phaseId !== prev) VF.bus.emit('time:phase', phaseId);
  }

  /* Sun elevation: 0 at deep night, 1 at midday. Drives global scene brightness. */
  function elevation() {
    // peak at cycle 0.33, trough at 0.83
    return VF.util.clamp(0.5 + 0.5 * Math.cos((cycle - 0.33) * VF.util.TAU), 0, 1);
  }

  /* Clock string for the HUD — cosmetic, mapped onto a 24h face. */
  function clock() {
    const total = ((cycle + 0.25) % 1) * 24;
    const h = Math.floor(total);
    const m = Math.floor((total - h) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  /* ------------------------------------------------------------- the moon

     There is a moon in the sky, a Moonlit Basin, a Moon Charm and a Moon
     Pearl, and the moon itself never did anything. It is the cheapest long
     cycle available here: a number that moves over real days rather than over
     the in-game clock, which is what makes it worth opening the game
     tomorrow rather than finishing it today.

     Read off the wall clock, not off play time, so it is the same moon for
     everybody on the same evening and cannot be scrubbed by leaving the tab
     open. The epoch is a known new moon; 29.53059 days is the synodic month. */
  const SYNODIC = 29.53059 * 86400000;
  const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

  const MOONS = [
    { id: 'new',      name: 'New Moon',       from: 0.000 },
    { id: 'waxcres',  name: 'Waxing Crescent', from: 0.035 },
    { id: 'firstq',   name: 'First Quarter',  from: 0.215 },
    { id: 'waxgib',   name: 'Waxing Gibbous', from: 0.285 },
    { id: 'full',     name: 'Full Moon',      from: 0.465 },
    { id: 'wangib',   name: 'Waning Gibbous', from: 0.535 },
    { id: 'lastq',    name: 'Last Quarter',   from: 0.715 },
    { id: 'wancres',  name: 'Waning Crescent', from: 0.785 },
    { id: 'new2',     name: 'New Moon',       from: 0.965 }
  ];

  /* 0 at new, 0.5 at full, back to 1 at the next new. */
  function moonAge(at) {
    const t = (at === undefined ? Date.now() : at) - NEW_MOON;
    const a = (t % SYNODIC) / SYNODIC;
    return a < 0 ? a + 1 : a;
  }

  /* How lit it is: 0 dark, 1 full. What the scene draws and what luck reads. */
  function moonLight(at) {
    return 0.5 - 0.5 * Math.cos(moonAge(at) * VF.util.TAU);
  }

  function moonPhase(at) {
    const a = moonAge(at);
    let out = MOONS[0];
    for (let i = 0; i < MOONS.length; i++) if (a >= MOONS[i].from) out = MOONS[i];
    return out.id === 'new2' ? MOONS[0] : out;
  }
  function moonName(at) { return moonPhase(at).name; }

  /* What the moon is worth to a night's fishing. Small on purpose — it is
     texture, and the day/night cycle is already the big lever. It only pays
     at night, because a full moon at midday is not doing anything. */
  function moonLuck() {
    const night = 1 - elevation();
    return (moonLight() - 0.5) * 0.30 * night;
  }

  function phase() { return phaseId; }
  function phaseName() {
    for (let i = 0; i < PHASES.length; i++) if (PHASES[i].id === phaseId) return PHASES[i].name;
    return 'Night';
  }
  function setCycle(c) { cycle = c % 1; }

  VF.time = {
    tick: tick,
    phase: phase,
    phaseName: phaseName,
    elevation: elevation,
    clock: clock,
    cycle: function () { return cycle; },
    setCycle: setCycle,
    moonAge: moonAge,
    moonLight: moonLight,
    moonPhase: moonPhase,
    moonName: moonName,
    moonLuck: moonLuck,
    MOONS: MOONS,
    DAY_LENGTH: DAY_LENGTH,
    PHASES: PHASES
  };
})(window.VF = window.VF || {});
