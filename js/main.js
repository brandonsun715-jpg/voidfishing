/* VOID FISHING — boot and the frame loop. */
(function (VF) {
  'use strict';

  const U = VF.util;
  let last = 0, running = false, rafId = 0;
  let started = false;

  function boot() {
    const res = VF.save.load();
    const s = VF.state.data.settings;
    U.syncBody();

    const canvas = document.getElementById('scene');
    VF.scene.init(canvas);
    VF.palette.update();
    VF.scene.seedAmbient();

    VF.toast.init();
    // the boot load has already been and gone; this is for a slot picked up later
    VF.bus.on('save:revoked', saidRevoked);
    VF.hud.init();
    VF.panels.init();
    VF.catchUI.init();
    VF.aquariumUI.init();

    VF.weather.reconcile();
    VF.secrets.registerFound();
    VF.loot.invalidatePool();
    // rolled here, shown after Begin — a catch card over the title card is a
    // strange way to say hello
    if (VF.away) VF.away.boot();

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      last = performance.now();
      // coming back from a background tab is not evidence about this machine
      perf.acc = 0; perf.frames = 0; perf.slow = 0; perf.bad = 0; perf.warm = 2;
    });
    document.addEventListener('contextmenu', function (e) {
      if (e.target && e.target.id === 'scene') e.preventDefault();
    });

    const bootEl = document.getElementById('boot');
    const startBtn = document.getElementById('bootStart');
    if (res.loaded && VF.state.data.stats.casts > 0) {
      startBtn.textContent = 'Continue';
      const note = U.qs('.boot-note');
      if (note) note.textContent = 'Level ' + VF.state.data.level + ' · ' +
        U.commas(VF.state.data.stats.catches) + ' caught';
    }
    startBtn.addEventListener('click', start);

    // draw one frame behind the title card so it is never a black screen
    VF.scene.update(0.016);
    VF.scene.draw();
    startLoop();
  }

  function start() {
    if (started) return;
    started = true;
    VF.audio.unlock();
    VF.audio.setVolumes();
    const bootEl = document.getElementById('boot');
    bootEl.classList.add('gone');
    setTimeout(function () { bootEl.style.display = 'none'; }, 750);
    document.getElementById('hud').classList.remove('hidden');
    VF.hud.show();
    VF.hud.refreshAll();
    saidRevoked(VF.save.revoked());
    VF.tutorial.init();
    VF.achievements.check();
    if (VF.state.data.stats.casts === 0) VF.hud.showPrompt(VF.locations.current().name, VF.locations.current().glow, 1.8);
    if (VF.away) VF.away.announce();
  }

  /* A save can arrive holding something no game could have given it. Taking
     it back quietly would read as the save being broken, so it is said out
     loud, once, and only to somebody it actually happened to.

     Boot has to ask save.js for this rather than listen for it: the load runs
     before there is a toast to show it in. A slot picked up later goes
     through the event instead, which by then has somewhere to land. */
  function saidRevoked(info) {
    if (!info) return;
    const bits = [];
    if (info.rods) bits.push(info.rods === 1 ? 'a rod that is not in the game'
                                            : info.rods + ' rods that are not in the game');
    if (info.took) bits.push(U.money(info.took));
    if (!bits.length) return;
    VF.toast.show('<strong>this save was carrying something it could not have earned</strong>' +
                  '<br><span style="color:var(--ink-3)">' + U.esc(bits.join(' and ')) +
                  ' taken back. everything you caught is still here.</span>', 'warn', 7000);
  }

  /* Dragging a window edge fires resize dozens of times a second, and every
     one of them was resizing the canvas, recomputing the layout, throwing away
     the baked backdrop and reseeding the drift. None of that can show up more
     than once a frame, so it only runs once a frame. */
  let resizePending = false;
  function onResize() {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(function () {
      resizePending = false;
      VF.scene.resize();
      VF.scene.seedAmbient();
    });
  }

  function startLoop() {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  /* ------------------------------------------------- adaptive quality
     The scene is heavier than it used to be. Rather than let a slow machine
     run it at twenty frames a second, watch the frame time and step the
     setting down — once, visibly, and never back up on its own, so the player
     stays in charge of it from Settings. */
  const perf = { acc: 0, frames: 0, slow: 0, bad: 0, warm: 4, stepped: 0 };

  function watchFrameRate(dt) {
    if (!started || perf.stepped >= 2 || VF.state.rt.panelOpen) return;
    if (perf.warm > 0) { perf.warm -= Math.min(dt, 0.1); return; }
    // half a second is not a slow machine, it is a tab that was somewhere else
    if (dt > 0.5) return;
    perf.acc += dt;
    perf.frames++;
    if (dt > 0.030) perf.slow++;
    if (perf.acc < 4) return;

    // the share of slow frames, not the mean: one garbage-collection pause in
    // four seconds should not be read as a machine that cannot cope
    const share = perf.slow / Math.max(1, perf.frames);
    const enough = perf.frames >= 40;
    perf.acc = 0; perf.frames = 0; perf.slow = 0;
    const q = VF.state.data.settings.quality;
    perf.share = share;
    if (enough && share > 0.55 && q !== 'low') {
      perf.bad++;
      if (perf.bad < 4) return;
      perf.bad = 0;
      perf.stepped++;
      const next = q === 'high' ? 'medium' : 'low';
      VF.state.data.settings.quality = next;
      U.syncBody();
      VF.scene.resize();
      VF.bus.emit('settings:quality');
      VF.save.save();
      VF.toast.show('graphics turned down to <strong>' + next + '</strong> to keep it smooth' +
                    ' &mdash; change it back in settings', null, 6000);
    } else {
      perf.bad = 0;
    }
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0.016;
    // the honest frame time, before the clamp, is what tells us how the
    // machine is coping — the clamp is for the simulation, not for measuring
    const raw = dt;
    // a long pause (tab in the background) must not fast-forward the fight
    if (dt > 0.1) dt = 0.1;

    const rt = VF.state.rt;
    rt.dt = dt;
    rt.t += dt;

    try {
      VF.time.tick(dt);
      VF.weather.tick(dt);
      VF.palette.update();

      if (started) {
        VF.visit.tick(dt);
        VF.fishing.tick(dt);
        VF.conditions.tick(dt);
        VF.encounters.tick(dt);
        VF.quests.tick(dt);
        VF.merchant.tick(dt);
        VF.charter.tick(dt);
        VF.aquarium.tick(dt);
        VF.cutscene.tick(dt);
        VF.wrong.tick(dt);
        VF.achievements.tick(dt);
        VF.state.data.stats.playSeconds += dt;
        VF.save.tick(dt);
      }

      VF.fx.update(dt);
      VF.scene.update(dt);
      VF.scene.draw();

      if (started) VF.hud.tick(dt);
      VF.audio.tick(dt);
      watchFrameRate(raw);
    } catch (err) {
      console.error('[frame]', err);
      // never let one bad frame kill the loop
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  VF.game = { start: start, restartLoop: startLoop, perf: perf };
})(window.VF = window.VF || {});
