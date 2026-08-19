/* VOID FISHING — boot and the frame loop. */
(function (VF) {
  'use strict';

  const U = VF.util;
  let last = 0, running = false, rafId = 0;
  let started = false;

  function boot() {
    const res = VF.save.load();
    const s = VF.state.data.settings;
    document.body.className = 'q-' + s.quality;

    const canvas = document.getElementById('scene');
    VF.scene.init(canvas);
    VF.palette.update();
    VF.scene.seedAmbient();

    VF.toast.init();
    VF.hud.init();
    VF.panels.init();
    VF.catchUI.init();

    VF.weather.reconcile();
    VF.secrets.registerFound();
    VF.loot.invalidatePool();

    window.addEventListener('resize', onResize, { passive: true });
    window.addEventListener('orientationchange', onResize, { passive: true });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') last = performance.now();
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
    VF.tutorial.init();
    VF.achievements.check();
    if (VF.state.data.stats.casts === 0) VF.hud.showPrompt(VF.locations.current().name, VF.locations.current().glow, 1.8);
  }

  function onResize() {
    VF.scene.resize();
    VF.scene.seedAmbient();
  }

  function startLoop() {
    if (running) return;
    running = true;
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (!(dt > 0)) dt = 0.016;
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
    } catch (err) {
      console.error('[frame]', err);
      // never let one bad frame kill the loop
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  VF.game = { start: start, restartLoop: startLoop };
})(window.VF = window.VF || {});
