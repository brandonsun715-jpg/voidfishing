/* VOID FISHING — procedural audio.
   Everything is synthesised at runtime: noise beds for water/wind/rain, a slow
   generative pad keyed to the location's scale, and short synthesised effects.
   The context is created lazily and only starts after a user gesture. */
(function (VF) {
  'use strict';

  const U = VF.util;

  let ac = null;
  let ready = false;
  let master, musicBus, sfxBus, verb, verbSend;
  let beds = null;
  let music = null;
  let reelLoop = null;
  let ducking = 0;

  /* ------------------------------------------------------------- buffers */
  let noiseWhite = null, noiseBrown = null;

  function makeNoise(kind) {
    const len = ac.sampleRate * 3;
    const b = ac.createBuffer(1, len, ac.sampleRate);
    const d = b.getChannelData(0);
    if (kind === 'brown') {
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.2;
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return b;
  }

  function makeImpulse(seconds, decay) {
    const len = Math.floor(ac.sampleRate * seconds);
    const b = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return b;
  }

  /* ---------------------------------------------------------------- init */

  function init() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ac = new AC(); } catch (e) { return false; }

    noiseWhite = makeNoise('white');
    noiseBrown = makeNoise('brown');

    master = ac.createGain();
    master.gain.value = VF.state.data.settings.master;
    master.connect(ac.destination);

    verb = ac.createConvolver();
    verb.buffer = makeImpulse(3.4, 2.6);
    verbSend = ac.createGain();
    verbSend.gain.value = 0.5;
    verbSend.connect(verb);
    verb.connect(master);

    musicBus = ac.createGain();
    musicBus.gain.value = VF.state.data.settings.music;
    musicBus.connect(master);
    musicBus.connect(verbSend);

    sfxBus = ac.createGain();
    sfxBus.gain.value = VF.state.data.settings.sfx;
    sfxBus.connect(master);

    buildBeds();
    buildMusic();
    ready = true;
    return true;
  }

  function loopSource(buffer) {
    const s = ac.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start();
    return s;
  }

  function buildBeds() {
    /* water: brown noise through a slowly breathing lowpass */
    const wSrc = loopSource(noiseBrown);
    const wLp = ac.createBiquadFilter();
    wLp.type = 'lowpass'; wLp.frequency.value = 420; wLp.Q.value = 0.6;
    const wGain = ac.createGain(); wGain.gain.value = 0;
    wSrc.connect(wLp); wLp.connect(wGain); wGain.connect(sfxBus);

    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = ac.createGain(); lfoG.gain.value = 180;
    lfo.connect(lfoG); lfoG.connect(wLp.frequency); lfo.start();

    /* wind: white noise through a wandering bandpass */
    const nSrc = loopSource(noiseWhite);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 620; bp.Q.value = 0.85;
    const nGain = ac.createGain(); nGain.gain.value = 0;
    nSrc.connect(bp); bp.connect(nGain); nGain.connect(sfxBus);

    const lfo2 = ac.createOscillator();
    lfo2.frequency.value = 0.043;
    const lfo2G = ac.createGain(); lfo2G.gain.value = 300;
    lfo2.connect(lfo2G); lfo2G.connect(bp.frequency); lfo2.start();

    /* rain: bright noise */
    const rSrc = loopSource(noiseWhite);
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1600;
    const rGain = ac.createGain(); rGain.gain.value = 0;
    rSrc.connect(hp); hp.connect(rGain); rGain.connect(sfxBus);

    /* deep drone for the far locations */
    const dOsc = ac.createOscillator();
    dOsc.type = 'sine'; dOsc.frequency.value = 42;
    const dGain = ac.createGain(); dGain.gain.value = 0;
    dOsc.connect(dGain); dGain.connect(master); dOsc.start();

    beds = { water: wGain, wind: nGain, rain: rGain, drone: dGain, droneOsc: dOsc, waterLp: wLp };
  }

  /* -------------------------------------------------------------- music */

  function midiHz(n) { return 440 * Math.pow(2, (n - 69) / 12); }

  function buildMusic() {
    const g = ac.createGain(); g.gain.value = 0.0;
    g.connect(musicBus);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.4;
    lp.connect(g);

    const voices = [];
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sawtooth';
      o.frequency.value = 110;
      o.detune.value = (i - 1) * 7;
      const vg = ac.createGain();
      vg.gain.value = i === 0 ? 0.5 : 0.16;
      o.connect(vg); vg.connect(lp);
      o.start();
      voices.push(o);
    }
    music = { out: g, lp: lp, voices: voices, nextChord: 0, nextNote: 2, chordIdx: 0, tension: 0 };
  }

  function setChord() {
    if (!music) return;
    const loc = VF.locations.current();
    const sc = loc.music.scale;
    const root = loc.music.root + (VF.rng.g() < 0.3 ? 12 : 0);
    const degs = [0, 2, 4];
    const off = VF.rng.g.int(0, sc.length - 1);
    for (let i = 0; i < music.voices.length; i++) {
      const d = sc[(off + degs[i]) % sc.length] + 12 * Math.floor((off + degs[i]) / sc.length);
      const hz = midiHz(root + d);
      music.voices[i].frequency.setTargetAtTime(hz, ac.currentTime, 2.2);
    }
  }

  function bell(note, when, gainAmt, decay) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.value = midiHz(note);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gainAmt, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    o.connect(g); g.connect(musicBus); g.connect(verbSend);
    o.start(when); o.stop(when + decay + 0.05);
  }

  /* --------------------------------------------------------------- tick */

  function tick(dt) {
    if (!ready || ac.state !== 'running') return;
    const now = ac.currentTime;
    const loc = VF.locations.current();
    const q = VF.state.data.settings;

    /* environment beds follow weather smoothly */
    const wet = VF.weather.rain();
    const wind = VF.weather.wind();
    const depth = VF.locations.index(loc.id) / 7;
    const duck = 1 - ducking * 0.85;

    beds.water.gain.setTargetAtTime(0.16 * duck * (1 - depth * 0.35), now, 0.6);
    beds.wind.gain.setTargetAtTime((0.012 + wind * 0.055) * duck, now, 0.9);
    beds.rain.gain.setTargetAtTime(wet * 0.052 * duck, now, 0.7);
    beds.drone.gain.setTargetAtTime((0.008 + depth * 0.05) * duck * q.master, now, 1.5);
    beds.droneOsc.frequency.setTargetAtTime(38 - depth * 12, now, 3);

    /* generative pad */
    music.nextChord -= dt;
    if (music.nextChord <= 0) {
      music.nextChord = 11 + VF.rng.g() * 9;
      setChord();
    }
    music.out.gain.setTargetAtTime(0.052 * loc.music.pad * duck, now, 2.5);
    music.lp.frequency.setTargetAtTime(620 + depth * 340 + music.tension * 700, now, 1.2);

    music.nextNote -= dt;
    if (music.nextNote <= 0) {
      music.nextNote = 3.5 + VF.rng.g() * 9 / (0.4 + loc.music.tempo * 4);
      const sc = loc.music.scale;
      const n = loc.music.root + 24 + sc[VF.rng.g.int(0, sc.length - 1)] + (VF.rng.g() < 0.35 ? 12 : 0);
      bell(n, now + 0.02, 0.055, 2.6 + VF.rng.g() * 2.4);
    }

    ducking = Math.max(0, ducking - dt * 0.5);
  }

  /* -------------------------------------------------------------- sfx */

  function env(node, when, a, d, peak) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + a);
    g.gain.exponentialRampToValueAtTime(0.0001, when + a + d);
    node.connect(g);
    return g;
  }

  function noiseBurst(when, dur, filterType, freq, peak, sweepTo, dest) {
    const s = ac.createBufferSource();
    s.buffer = noiseWhite;
    s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ac.createBiquadFilter();
    f.type = filterType; f.frequency.setValueAtTime(freq, when);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), when + dur);
    s.connect(f);
    const g = env(f, when, 0.008, dur, peak);
    g.connect(dest || sfxBus);
    s.start(when); s.stop(when + dur + 0.08);
  }

  function tone(when, freq, dur, type, peak, sweepTo, dest) {
    const o = ac.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, when);
    if (sweepTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), when + dur);
    const g = env(o, when, 0.01, dur, peak);
    g.connect(dest || sfxBus);
    o.start(when); o.stop(when + dur + 0.08);
    return o;
  }

  const SFX = {
    click: function () { tone(ac.currentTime, 1180, 0.045, 'sine', 0.06); },
    hover: function () { tone(ac.currentTime, 1560, 0.028, 'sine', 0.022); },
    back: function () { tone(ac.currentTime, 640, 0.06, 'sine', 0.05, 430); },
    error: function () { tone(ac.currentTime, 200, 0.16, 'square', 0.05, 140); },
    buy: function () {
      const n = ac.currentTime;
      tone(n, 780, 0.1, 'sine', 0.07);
      tone(n + 0.07, 1170, 0.16, 'sine', 0.06);
    },
    charge: function () {
      const n = ac.currentTime;
      const o = tone(n, 180, VF.fishing.CAST_CHARGE_TIME * 1.05, 'sawtooth', 0.018, 520);
      return o;
    },
    cast: function (power) {
      const n = ac.currentTime;
      noiseBurst(n, 0.28 + power * 0.18, 'bandpass', 900 + power * 900, 0.10, 260);
      tone(n, 320 + power * 200, 0.14, 'sine', 0.03, 180);
    },
    splash: function (size) {
      const n = ac.currentTime;
      size = size === undefined ? 1 : size;
      noiseBurst(n, 0.14 * size, 'lowpass', 2600, 0.16 * size, 500);
      noiseBurst(n + 0.02, 0.34 * size, 'bandpass', 700, 0.09 * size, 240);
      tone(n, 190, 0.18 * size, 'sine', 0.05 * size, 90);
    },
    nibble: function () {
      const n = ac.currentTime;
      noiseBurst(n, 0.05, 'bandpass', 1800, 0.035, 900);
    },
    bite: function (rank) {
      const n = ac.currentTime;
      noiseBurst(n, 0.2, 'lowpass', 1400, 0.20, 300);
      tone(n, 150, 0.30, 'sine', 0.11, 78);
      tone(n + 0.01, 520, 0.22, 'triangle', 0.05, 900);
      if (rank >= 4) { tone(n + 0.05, 88, 0.9, 'sine', 0.10, 55); ducking = 0.8; }
    },
    reelStart: function () {
      if (reelLoop) return;
      const s = ac.createBufferSource();
      s.buffer = noiseWhite; s.loop = true;
      s.playbackRate.value = 0.35;
      const f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 2200; f.Q.value = 5.5;
      const g = ac.createGain(); g.gain.value = 0;
      g.gain.setTargetAtTime(0.035, ac.currentTime, 0.05);
      s.connect(f); f.connect(g); g.connect(sfxBus);
      s.start();
      reelLoop = { src: s, gain: g, filt: f };
    },
    reelStop: function () {
      if (!reelLoop) return;
      const r = reelLoop; reelLoop = null;
      r.gain.gain.setTargetAtTime(0, ac.currentTime, 0.04);
      setTimeout(function () { try { r.src.stop(); } catch (e) {} }, 260);
    },
    reelTension: function (v) {
      if (!reelLoop) return;
      reelLoop.filt.frequency.setTargetAtTime(1500 + v * 2600, ac.currentTime, 0.08);
      reelLoop.gain.gain.setTargetAtTime(0.028 + v * 0.05, ac.currentTime, 0.08);
    },
    strain: function (v) {
      const n = ac.currentTime;
      tone(n, 900 + v * 700, 0.12, 'sawtooth', 0.02 * v);
    },
    snap: function () {
      const n = ac.currentTime;
      noiseBurst(n, 0.10, 'highpass', 2800, 0.25);
      tone(n, 1400, 0.09, 'square', 0.07, 200);
      tone(n + 0.05, 130, 0.5, 'sine', 0.06, 70);
    },
    surge: function () {
      const n = ac.currentTime;
      noiseBurst(n, 0.4, 'lowpass', 800, 0.09, 220);
      tone(n, 110, 0.45, 'sine', 0.06, 72);
    },
    stinger: function (kind, rank) {
      const n = ac.currentTime;
      const loc = VF.locations.current();
      const root = loc.music.root + 12;
      const sc = loc.music.scale;
      if (kind === 'soft') {
        bell(root + 12 + sc[0], n, 0.09, 1.4);
        bell(root + 12 + sc[2], n + 0.09, 0.07, 1.6);
      } else if (kind === 'bright') {
        for (let i = 0; i < 4; i++) bell(root + 12 + sc[i % sc.length] + (i > 2 ? 12 : 0), n + i * 0.075, 0.085, 2.0);
      } else if (kind === 'grand') {
        ducking = 1;
        for (let i = 0; i < 6; i++) bell(root + sc[i % sc.length] + 12 * Math.floor(i / sc.length), n + i * 0.085, 0.10, 3.2);
        tone(n, 62, 2.2, 'sine', 0.10, 48);
      } else if (kind === 'void') {
        ducking = 1;
        tone(n, 46, 3.4, 'sine', 0.14, 32);
        for (let i = 0; i < 5; i++) bell(root - 12 + sc[i % sc.length], n + i * 0.16, 0.11, 4.5);
        noiseBurst(n, 1.6, 'lowpass', 400, 0.06, 90);
      } else {
        ducking = 1;
        for (let i = 0; i < 9; i++) {
          tone(n + i * 0.045, 200 + Math.random() * 2400, 0.09, Math.random() < 0.5 ? 'square' : 'sawtooth', 0.05);
        }
        tone(n, 39, 3.0, 'sine', 0.15, 28);
      }
    },
    levelUp: function () {
      const n = ac.currentTime;
      const sc = VF.locations.current().music.scale;
      const root = VF.locations.current().music.root + 24;
      for (let i = 0; i < 4; i++) bell(root + sc[i % sc.length], n + i * 0.075, 0.10, 1.8);
    },
    discover: function () {
      const n = ac.currentTime;
      tone(n, 900, 0.2, 'sine', 0.07, 1500);
      tone(n + 0.1, 1500, 0.4, 'sine', 0.05, 2100);
    },
    achievement: function () {
      const n = ac.currentTime;
      bell(72, n, 0.09, 1.2); bell(76, n + 0.08, 0.09, 1.4); bell(79, n + 0.16, 0.10, 2.2);
    },
    encounter: function () {
      const n = ac.currentTime;
      ducking = 1;
      tone(n, 55, 4.5, 'sine', 0.16, 34);
      noiseBurst(n + 0.2, 2.4, 'lowpass', 260, 0.07, 70);
    },
    thunder: function (delay) {
      // low, distant, and slow to arrive
      const n = ac.currentTime + (delay || 2);
      noiseBurst(n, 2.6, 'lowpass', 220, 0.075, 55);
      tone(n + 0.1, 44, 2.4, 'sine', 0.055, 30);
    },
    sell: function () {
      const n = ac.currentTime;
      tone(n, 1050, 0.07, 'triangle', 0.055);
      tone(n + 0.06, 1400, 0.11, 'triangle', 0.045);
    },
    release: function () {
      const n = ac.currentTime;
      noiseBurst(n, 0.3, 'lowpass', 1600, 0.09, 400);
      tone(n, 700, 0.4, 'sine', 0.04, 1200);
    }
  };

  /* Public wrappers guard against the context not existing yet. */
  const api = {};
  Object.keys(SFX).forEach(function (k) {
    api[k] = function () {
      if (!ready || !ac || ac.state !== 'running') return;
      try { return SFX[k].apply(null, arguments); }
      catch (e) { /* audio must never break gameplay */ }
    };
  });

  function unlock() {
    if (!init()) return false;
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  function setVolumes() {
    if (!ready) return;
    const s = VF.state.data.settings;
    const n = ac.currentTime;
    master.gain.setTargetAtTime(s.master, n, 0.05);
    musicBus.gain.setTargetAtTime(s.music, n, 0.05);
    sfxBus.gain.setTargetAtTime(s.sfx, n, 0.05);
  }

  function setTension(v) { if (music) music.tension = v; }
  function duck(a) { ducking = Math.max(ducking, a); }

  VF.audio = Object.assign(api, {
    unlock: unlock, tick: tick, setVolumes: setVolumes,
    setTension: setTension, duck: duck,
    isReady: function () { return ready && ac && ac.state === 'running'; }
  });
})(window.VF = window.VF || {});
