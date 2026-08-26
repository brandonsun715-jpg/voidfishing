/* VOID FISHING — persistence via localStorage.
   Defensive: a corrupt or partial save must never brick the game. */
(function (VF) {
  'use strict';

  /* Four games, not one. `KEY` is where the single save used to live and is
     read once, on the first boot after this change, so nobody's game is left
     behind in it. */
  const KEY = 'voidfishing.save.v1';
  const SLOT_KEY = 'voidfishing.save.v1.s';
  const ACTIVE_KEY = 'voidfishing.slot';
  const SLOTS = 4;

  const AUTOSAVE_INTERVAL = 8; // seconds
  let sinceSave = 0;
  let available = true;
  let active = 0;
  let lastRevoke = null;   // what the save just picked up had taken back, if any

  function slotKey(i) { return SLOT_KEY + (i | 0); }
  function clampSlot(i) { return Math.max(0, Math.min(SLOTS - 1, i | 0)); }

  function storage() {
    try {
      const s = window.localStorage;
      s.setItem('__vf_probe', '1'); s.removeItem('__vf_probe');
      return s;
    } catch (e) { available = false; return null; }
  }

  /* Merge a loaded object onto fresh defaults so new fields added in later
     versions appear automatically and unknown fields are dropped. */
  function merge(target, src) {
    if (!src || typeof src !== 'object') return target;
    for (const k in target) {
      if (!Object.prototype.hasOwnProperty.call(target, k)) continue;
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      const tv = target[k], sv = src[k];
      if (sv === null || sv === undefined) continue;
      if (Array.isArray(tv)) {
        if (Array.isArray(sv)) target[k] = sv;
      } else if (tv && typeof tv === 'object' && sv && typeof sv === 'object') {
        // free-form maps (fishdex, baitCounts, achievements, flags) copy wholesale
        if (k === 'fishdex' || k === 'baitCounts' || k === 'achievements' || k === 'flags' ||
            k === 'mutations' || k === 'traits' || k === 'traitsSeen' || k === 'treasures' ||
            k === 'secrets' || k === 'npcs' || k === 'equipped' || k === 'cases' ||
            k === 'quests') {
          target[k] = sv;
        } else {
          merge(tv, sv);
        }
      } else if (typeof sv === typeof tv) {
        target[k] = sv;
      } else if (typeof tv === 'number' && typeof sv === 'string' && isFinite(+sv)) {
        target[k] = +sv;
      }
    }
    return target;
  }

  /* Take back what a save was handed rather than earned.

     A save can name a rod this build does not have, or one it does have and
     never sells, drops or gives. Either way it did not come from playing, so
     it comes off — along with money there is no honest way to be holding.

     It is not a wipe. The fishdex, the quests, the journal, the rods that
     were really bought and every fish ever caught stay where they are. */
  function revoke(d) {
/* @admin-only */
    // the owner's own save, in the owner's own build, is left exactly alone
    if (VF.adminConsole) return null;
/* @end-admin */

    const held = d.ownedRods.filter(function (id) {
      const r = VF.rods.get(id);
      /* Two ways to fail: a rod flagged as not being in the game, and a rod
         id this build has never heard of — get() falls back to the wooden rod
         for anything unknown, so a mismatched id is the tell. The second case
         is what a save from a differently-built copy looks like. */
      return !r || r.id !== id || r.admin;
    });
    if (!held.length && !(d.flags && d.flags.adminTouched)) return null;

    held.forEach(function (id) { d.ownedRods.splice(d.ownedRods.indexOf(id), 1); });
    if (!d.ownedRods.length) d.ownedRods = ['wood'];
    if (d.ownedRods.indexOf(d.rod) < 0) d.rod = d.ownedRods[d.ownedRods.length - 1];

    /* Money is the harder half: nothing records what was earned, only what is
       sitting there now. The dearest rod actually owned is the closest honest
       floor — somebody holding the Abyss Rod plainly had 62,000 at some point
       — so that is the ceiling, and a save already under it is left alone.
       An honest player never meets this: it only runs on a marked save. */
    const ceiling = Math.max(1000, d.ownedRods.reduce(function (n, id) {
      const r = VF.rods.get(id);
      return r && r.id === id ? Math.max(n, r.cost || 0) : n;
    }, 0));
    const took = d.money > ceiling ? d.money - ceiling : 0;
    if (took) d.money = ceiling;

    if (!d.flags || typeof d.flags !== 'object') d.flags = {};
    d.flags.adminTouched = true;   // stays marked however the save is edited after
    return { rods: held.length, took: took };
  }

  function sanitise(d, track) {
    const U = VF.util;
    d.money = Math.max(0, isFinite(d.money) ? d.money : 0);
    d.level = U.clamp(Math.floor(d.level) || 1, 1, 999);
    d.xp = Math.max(0, isFinite(d.xp) ? d.xp : 0);
    if (!Array.isArray(d.ownedRods) || !d.ownedRods.length) d.ownedRods = ['wood'];
    if (d.ownedRods.indexOf('wood') < 0) d.ownedRods.unshift('wood');
    if (d.ownedRods.indexOf(d.rod) < 0) d.rod = d.ownedRods[d.ownedRods.length - 1];
    /* Only a save actually being picked up reports what it lost. The slot
       list sanitises all four to draw its rows, and those are read and
       thrown away — they must not overwrite what the live one had taken. */
    const r = revoke(d);
    if (track) { lastRevoke = r; if (r) VF.bus.emit('save:revoked', r); }
    if (!Array.isArray(d.unlockedLocations) || !d.unlockedLocations.length) d.unlockedLocations = ['shore'];
    if (d.unlockedLocations.indexOf(d.location) < 0) d.location = 'shore';
    if (!Array.isArray(d.seenLocations)) d.seenLocations = d.unlockedLocations.slice();
    if (!d.fishdex || typeof d.fishdex !== 'object') d.fishdex = {};
    if (!Array.isArray(d.kept)) d.kept = [];
    if (!Array.isArray(d.wall)) d.wall = [];
    d.wall = d.wall.filter(function (k) { return k && typeof k === 'object' && k.id; }).slice(0, 12);
    if (d.kept.length > 400) d.kept = d.kept.slice(-400);
    if (!d.baitCounts || typeof d.baitCounts !== 'object') d.baitCounts = {};
    if (!Array.isArray(d.ownedMods)) d.ownedMods = [];
    d.ownedMods = d.ownedMods.filter(function (id) { return !!VF.mods.get(id); });
    if (!d.mods || typeof d.mods !== 'object' || Array.isArray(d.mods)) {
      d.mods = { line: null, reel: null, hook: null };
    }
    VF.mods.SLOTS.forEach(function (slot) {
      const m = VF.mods.get(d.mods[slot]);
      // fitted but not owned is a save that has been edited, or an older one
      if (!m || m.slot !== slot || d.ownedMods.indexOf(m.id) < 0) d.mods[slot] = null;
    });
    if (!Array.isArray(d.charms)) d.charms = [];
    d.charms = d.charms.filter(function (id) { return !!VF.charms.get(id); });
    if (!Array.isArray(d.charmSlots)) d.charmSlots = [null, null, null, null, null];
    d.charmSlots.length = 5;
    for (let i = 0; i < 5; i++) {
      if (d.charmSlots[i] && d.charms.indexOf(d.charmSlots[i]) < 0) d.charmSlots[i] = null;
      if (d.charmSlots[i] === undefined) d.charmSlots[i] = null;
    }
    if (!d.merchant || typeof d.merchant !== 'object' || Array.isArray(d.merchant)) {
      d.merchant = { until: 0, next: 0, stock: [], sold: [], visits: 0 };
    }
    if (!Array.isArray(d.merchant.stock)) d.merchant.stock = [];
    if (!Array.isArray(d.merchant.sold)) d.merchant.sold = [];
    d.merchant.stock = d.merchant.stock.filter(function (id) {
      const r = VF.rods.get(id);
      return r && r.id === id;
    });
    if (!d.quests || typeof d.quests !== 'object' || Array.isArray(d.quests)) d.quests = {};
    for (const qid in d.quests) {
      const q = d.quests[qid];
      if (!q || typeof q !== 'object') { delete d.quests[qid]; continue; }
      q.step = Math.max(0, Math.floor(q.step) || 0);
      if (!q.flags || typeof q.flags !== 'object') q.flags = {};
      if (!q.counts || typeof q.counts !== 'object') q.counts = {};
    }
    if (!d.returning || typeof d.returning !== 'object' || Array.isArray(d.returning)) {
      d.returning = { stage: 0, lastCast: 0, done: false };
    }
    d.returning.stage = U.clamp(Math.floor(d.returning.stage) || 0, 0, 3);
    if (!d.bounties || typeof d.bounties !== 'object' || Array.isArray(d.bounties)) {
      d.bounties = { list: [], at: 0 };
    }
    if (!Array.isArray(d.bounties.list)) d.bounties.list = [];
    d.bounties.list = d.bounties.list.filter(function (b) {
      // a request naming a species that no longer exists is not a request
      return b && typeof b === 'object' && VF.fish.byId(b.fish) && b.want > 0;
    }).slice(0, 8);
    if (typeof d.run !== 'string' || !VF.runs.get(d.run) || VF.runs.get(d.run).id !== d.run) d.run = 'none';
    if (d.away && (typeof d.away !== 'object' || Array.isArray(d.away) || !d.away.at)) d.away = null;
    if (!Array.isArray(d.cosmetics)) d.cosmetics = [];
    if (!Array.isArray(d.journal)) d.journal = [];
    if (d.journal.length > 300) d.journal = d.journal.slice(-300);
    if (!d.equipped || typeof d.equipped !== 'object') d.equipped = {};
    d.caseTokens = Math.max(0, Math.floor(d.caseTokens) || 0);

    /* Schema 1 stored one mutation per catch; traits are a list. */
    for (const id in d.fishdex) {
      const e = d.fishdex[id];
      if (!e || typeof e !== 'object') { delete d.fishdex[id]; continue; }
      if (!e.traits) {
        e.traits = {};
        if (e.mutations) for (const m in e.mutations) e.traits[m] = e.mutations[m];
      }
      if (e.record && e.record.mutation && !e.record.traits) e.record.traits = [e.record.mutation];
      if (e.record && !e.record.traits) e.record.traits = [];
    }
    /* Older saves stored one mutation per kept fish; the list is the record
       now. The wall holds the same shape, so it gets the same repair. */
    d.kept.concat(d.wall).forEach(function (k) {
      if (k && !k.traits) k.traits = k.mutation ? [k.mutation] : [];
    });
    for (const k in d.baitCounts) {
      const n = Math.floor(d.baitCounts[k]);
      if (!isFinite(n) || n <= 0) delete d.baitCounts[k];
      else d.baitCounts[k] = Math.min(n, 99999);
    }
    const s = d.settings;
    s.master = U.clamp(+s.master || 0, 0, 1);
    s.music = U.clamp(+s.music || 0, 0, 1);
    s.sfx = U.clamp(+s.sfx || 0, 0, 1);
    if (['low', 'medium', 'high'].indexOf(s.quality) < 0) s.quality = 'high';
    return d;
  }

  function save() {
    const st = storage();
    if (!st) return false;
    try {
      st.setItem(slotKey(active), JSON.stringify(VF.state.data));
      st.setItem(ACTIVE_KEY, String(active));
      sinceSave = 0;
      VF.bus.emit('save:written');
      return true;
    } catch (e) {
      console.warn('[save] failed', e);
      return false;
    }
  }

  /* Whatever is in a slot, as game state, or null. Nothing here touches the
     game that is running — the panel asks this four times to draw the list.

     `track` says this slot is being picked up to play rather than merely read
     for that list, so anything the revoke takes off it is worth reporting.
     It clears first: an empty slot has nothing taken from it, and the last
     slot's answer must not be left standing as this one's. */
  function readSlot(i, track) {
    if (track) lastRevoke = null;
    const st = storage();
    if (!st) return null;
    let raw = null;
    try { raw = st.getItem(slotKey(i)); } catch (e) { return null; }
    if (!raw) return null;
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (e) {
      console.warn('[save] slot ' + i + ' is corrupt');
      return null;
    }
    if (!parsed || typeof parsed !== 'object') return null;
    return sanitise(merge(VF.state.defaults(), parsed), track);
  }

  /* The one line the slot list draws per row. */
  function summary(i) {
    const d = readSlot(i);
    if (!d) return { slot: i, empty: true };
    return {
      slot: i, empty: false,
      level: d.level, fathoms: d.fathoms | 0,
      money: d.money, species: Object.keys(d.fishdex).length,
      playSeconds: d.stats.playSeconds | 0,
      location: d.location,
      run: d.run || 'none',
      created: d.created || 0
    };
  }
  function slots() {
    const out = [];
    for (let i = 0; i < SLOTS; i++) out.push(summary(i));
    return out;
  }

  /* Anything left in the old single-save key belongs to whoever was playing
     it, so it becomes slot one the first time this build opens. */
  function migrate(st) {
    let legacy = null;
    try { legacy = st.getItem(KEY); } catch (e) { return; }
    if (!legacy) return;
    try {
      if (!st.getItem(slotKey(0))) st.setItem(slotKey(0), legacy);
      st.removeItem(KEY);
    } catch (e) { /* a full disk is not worth breaking the boot over */ }
  }

  function load() {
    const st = storage();
    const fresh = VF.state.defaults();
    if (!st) { VF.state.data = fresh; return { loaded: false, reason: 'unavailable' }; }
    migrate(st);
    let want = 0;
    try { want = clampSlot(parseInt(st.getItem(ACTIVE_KEY), 10) || 0); } catch (e) { want = 0; }
    active = want;
    const d = readSlot(active, true);
    if (!d) { VF.state.data = fresh; return { loaded: false, reason: 'empty', slot: active }; }
    VF.state.data = d;
    return { loaded: true, slot: active };
  }

  /* Put the running game down and pick another one up. The game being left is
     written first, or switching away from it loses up to eight seconds. */
  function use(i) {
    i = clampSlot(i);
    save();
    active = i;
    const st = storage();
    if (st) { try { st.setItem(ACTIVE_KEY, String(active)); } catch (e) { /* ignore */ } }
    const d = readSlot(active, true);
    const startedFresh = !d;
    VF.state.data = d || VF.state.defaults();
    if (startedFresh) save();
    VF.bus.emit('save:slot', { slot: active, fresh: startedFresh });
    return { slot: active, fresh: startedFresh };
  }

  /* Empty a slot. Emptying the one being played leaves a new game in it,
     because there has to be a game. */
  function erase(i) {
    i = clampSlot(i);
    const st = storage();
    if (st) { try { st.removeItem(slotKey(i)); } catch (e) { /* ignore */ } }
    if (i === active) {
      VF.state.data = VF.state.defaults();
      VF.bus.emit('save:reset');
    }
    VF.bus.emit('save:slot', { slot: active, fresh: i === active });
    return i === active;
  }

  function reset() { erase(active); }

  /* ------------------------------------------------------------ transfer

     Slots solve having four games on one machine. They do not solve moving a
     game off the machine — localStorage belongs to the address the file was
     opened from, so a build that gets copied to a laptop, or simply moved to
     another folder, leaves all four behind.

     These two are that. Export writes the slot you are playing; import reads
     one back into a slot you name. The string is base64 with a short tag on
     the front, so a wrong paste is refused by its shape rather than by
     throwing somewhere deep inside the merge. */

  const TAG = 'VF1:';

  function exportString(i) {
    const d = i === undefined || i === active ? VF.state.data : readSlot(i);
    if (!d) return null;
    try { return TAG + btoa(unescape(encodeURIComponent(JSON.stringify(d)))); }
    catch (e) { return null; }
  }

  /* Decode and check, without touching anything. The panel calls this before
     it asks whether to overwrite, so a bad paste never gets as far as the
     warning. */
  function parseString(str) {
    if (typeof str !== 'string') return { ok: false, why: 'empty' };
    let body = str.trim().replace(/\s+/g, '');
    if (!body) return { ok: false, why: 'empty' };
    if (body.slice(0, TAG.length) === TAG) body = body.slice(TAG.length);

    let json = null;
    try { json = decodeURIComponent(escape(atob(body))); }
    catch (e) { return { ok: false, why: 'notasave' }; }

    let parsed = null;
    try { parsed = JSON.parse(json); }
    catch (e) { return { ok: false, why: 'notasave' }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, why: 'notasave' };
    }
    // a save has these; a JSON blob that wandered in from somewhere else does not
    if (!('fishdex' in parsed) || !('ownedRods' in parsed) || !('stats' in parsed)) {
      return { ok: false, why: 'notasave' };
    }
    return { ok: true, raw: parsed };
  }

  /* What a pasted string would be, for the confirmation to describe. Read
     through the same sanitise a slot read uses, so what is previewed is what
     would actually be played — including anything the revoke would take. */
  function previewString(str) {
    const p = parseString(str);
    if (!p.ok) return p;
    let d = null;
    try { d = sanitise(merge(VF.state.defaults(), p.raw)); }
    catch (e) { return { ok: false, why: 'corrupt' }; }
    return {
      ok: true,
      level: d.level, fathoms: d.fathoms | 0, money: d.money,
      species: Object.keys(d.fishdex).length,
      playSeconds: d.stats.playSeconds | 0,
      run: d.run || 'none'
    };
  }

  /* Write a pasted save into a slot. Goes through exactly the path a slot
     read does — merge, sanitise and, in a build without the console, revoke —
     so importing is not a way round anything a load is not a way round. */
  function importString(str, i) {
    const p = parseString(str);
    if (!p.ok) return p;
    const target = i === undefined ? active : clampSlot(i);

    const st = storage();
    if (!st) return { ok: false, why: 'unavailable' };

    let d = null;
    try { d = sanitise(merge(VF.state.defaults(), p.raw), true); }
    catch (e) { return { ok: false, why: 'corrupt' }; }

    try { st.setItem(slotKey(target), JSON.stringify(d)); }
    catch (e) { return { ok: false, why: 'full' }; }

    // land in the slot that was just written, so import and play are one step
    if (target === active) {
      VF.state.data = d;
      VF.bus.emit('save:slot', { slot: active, fresh: false });
    } else {
      use(target);
    }
    VF.bus.emit('save:imported', { slot: target });
    return { ok: true, slot: target, revoked: lastRevoke };
  }

  function tick(dt) {
    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_INTERVAL) save();
  }

  VF.save = {
    save: save, load: load, reset: reset, tick: tick,
    SLOTS: SLOTS,
    slots: slots, summary: summary, use: use, erase: erase,
    exportString: exportString, importString: importString, previewString: previewString,
    slot: function () { return active; },
    /* { rods, took } if the save now being played had something taken back on
       the way in, null if it did not. Boot reads this once: at that point the
       save:revoked event has already gone out with nothing listening yet. */
    revoked: function () { return lastRevoke; },
    isAvailable: function () { return available; }
  };

  /* Never lose progress on tab close. */
  window.addEventListener('beforeunload', function () { save(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') save();
  });
})(window.VF = window.VF || {});
