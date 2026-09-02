/* VOID FISHING — the album.

   A photograph is not a screenshot. A screenshot is a picture of a program; a
   photograph is a record that you were somewhere and something was in front of
   you. So each one keeps what the lens was pointed at as well as the light:
   the place, the hour, the weather, and whatever was on the line — which is
   deliberately vague when you did not land it, because "something took the
   bait at the Quiet Shore before dawn" is what you actually know, and the
   record in js/systems/fishing.js is what will one day say more.

   ------------------------------------------------------------------ timing

   The GL context is created with preserveDrawingBuffer:false, which is the
   right setting and the reason this cannot be a function you call whenever you
   like: after a frame returns, that buffer is gone. So the shutter ARMS, and
   the capture happens at the tail of js/render/scene.js's draw, in the same
   task, while both canvases still hold the frame you were looking at.

   ------------------------------------------------------------------ storage

   Not in the save. The save is stringified whole every eight seconds, and
   putting a few hundred kilobytes of JPEG through that would make the
   autosave the most expensive thing in the game. The album lives in its own
   key per slot and is written only when a photograph is taken or thrown away.
   It is capped, and the oldest goes first — an album that grows without limit
   is a save that stops fitting in localStorage, which loses the GAME, not the
   pictures. */
(function (VF) {
  'use strict';

  const KEY = 'voidfishing.photos.v1.s';
  const CAP = 30;                 // how many are kept
  const WIDE = 480;               // the long edge a photograph is stored at
  const QUALITY = 0.62;

  let armed = false;
  let shots = null;               // the loaded album, or null until first read
  let loadedSlot = -1;

  function slot() { return VF.save ? VF.save.slot() : 0; }
  function key(i) { return KEY + (i | 0); }

  function read() {
    const s = slot();
    if (shots && loadedSlot === s) return shots;
    loadedSlot = s;
    shots = [];
    try {
      const raw = window.localStorage.getItem(key(s));
      if (raw) {
        const v = JSON.parse(raw);
        if (Array.isArray(v)) shots = v.filter(function (p) { return p && p.img; });
      }
    } catch (e) { shots = []; }
    return shots;
  }

  function write() {
    try { window.localStorage.setItem(key(slot()), JSON.stringify(shots || [])); }
    catch (e) {
      /* Out of room. Drop the oldest half rather than lose the lot, and try
         once more — a full album must never be the thing that stops a game
         from saving. */
      if (shots && shots.length > 2) {
        shots = shots.slice(Math.floor(shots.length / 2));
        try { window.localStorage.setItem(key(slot()), JSON.stringify(shots)); }
        catch (e2) { /* then it does not persist, and the game still runs */ }
      }
    }
  }

  /* What was in front of the lens. Named only as far as you actually know it:
     a creature announces itself, a fish on the line does not. */
  function subject() {
    if (VF.creature && VF.creature.active()) {
      const v = VF.creature.view();
      return { kind: 'creature', id: VF.creature.current(),
               name: (v && v.revealed && v.title) ? v.title : 'something out there' };
    }
    const st = VF.fishing ? VF.fishing.state() : 'idle';
    if (st === 'reeling' || st === 'bite') {
      const c = VF.fishing.S && VF.fishing.S.pending;
      return { kind: 'onLine', id: c && c.fish ? c.fish.id : null,
               name: 'something on the line' };
    }
    if (VF.visit && VF.visit.active()) return { kind: 'someone', id: null, name: 'company' };
    return { kind: 'place', id: null, name: null };
  }

  function stamp() {
    const loc = VF.locations ? VF.locations.current() : null;
    return {
      id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      when: Date.now(),
      place: loc ? loc.id : null,
      placeName: loc ? loc.name : '',
      phase: VF.time ? VF.time.phaseName() : '',
      clock: VF.time && VF.time.clock ? VF.time.clock() : '',
      weather: VF.weather ? VF.weather.name() : '',
      afloat: !!(VF.boat && VF.boat.afloat()),
      subject: subject()
    };
  }

  /* Arm the shutter. The frame after this one is the one that gets taken. */
  function shoot() {
    if (armed) return false;
    armed = true;
    return true;
  }

  function pending() { return armed; }

  /* Called from the tail of the frame, both canvases still live. */
  function capture(gl, flat) {
    if (!armed) return null;
    armed = false;
    if (!flat) return null;
    try {
      const sw = flat.width, sh = flat.height;
      if (!sw || !sh) return null;
      const k = Math.min(1, WIDE / sw);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(sw * k));
      c.height = Math.max(1, Math.round(sh * k));
      const g = c.getContext('2d');
      /* the medium first, then everything in it — the same order the screen
         composites them, because that is what the player was looking at */
      g.fillStyle = '#05070c';
      g.fillRect(0, 0, c.width, c.height);
      if (gl && gl.width) g.drawImage(gl, 0, 0, c.width, c.height);
      g.drawImage(flat, 0, 0, c.width, c.height);

      const p = stamp();
      p.w = c.width; p.h = c.height;
      p.img = c.toDataURL('image/jpeg', QUALITY);
      if (!p.img || p.img.length < 64) return null;

      const list = read();
      list.push(p);
      while (list.length > CAP) list.shift();
      write();
      VF.bus.emit('album:shot', p);
      return p;
    } catch (e) { return null; }
  }

  function list() { return read().slice().reverse(); }   // newest first
  function count() { return read().length; }
  function get(id) { return read().filter(function (p) { return p.id === id; })[0] || null; }

  function remove(id) {
    const l = read();
    const i = l.findIndex(function (p) { return p.id === id; });
    if (i < 0) return false;
    l.splice(i, 1);
    write();
    VF.bus.emit('album:changed');
    return true;
  }

  /* Erasing a slot erases its album with it — otherwise a new game opens
     somebody else's photographs. */
  function clear(which) {
    const s = which === undefined ? slot() : which;
    try { window.localStorage.removeItem(key(s)); } catch (e) { /* nothing to do */ }
    if (s === loadedSlot) { shots = []; loadedSlot = -1; }
    VF.bus.emit('album:changed');
  }

  /* The slot changed under us; the next read reloads. */
  function invalidate() { shots = null; loadedSlot = -1; }

  /* The album belongs to the slot, so it follows the slot: a game erased takes
     its photographs with it, and switching slots drops what was loaded rather
     than showing one game's plates inside another. */
  if (VF.bus) {
    VF.bus.on('save:erased', function (e) { clear(e && e.slot); });
    VF.bus.on('save:slot', function () { invalidate(); });
  }

  VF.album = {
    shoot: shoot, pending: pending, capture: capture,
    list: list, count: count, get: get, remove: remove,
    clear: clear, invalidate: invalidate,
    CAP: CAP
  };
})(window.VF = window.VF || {});
