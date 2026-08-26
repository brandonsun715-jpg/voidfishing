/* VOID FISHING — persistence via localStorage.
   Defensive: a corrupt or partial save must never brick the game. */
(function (VF) {
  'use strict';

  const KEY = 'voidfishing.save.v1';
  const AUTOSAVE_INTERVAL = 8; // seconds
  let sinceSave = 0;
  let available = true;

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

  function sanitise(d) {
    const U = VF.util;
    d.money = Math.max(0, isFinite(d.money) ? d.money : 0);
    d.level = U.clamp(Math.floor(d.level) || 1, 1, 999);
    d.xp = Math.max(0, isFinite(d.xp) ? d.xp : 0);
    if (!Array.isArray(d.ownedRods) || !d.ownedRods.length) d.ownedRods = ['wood'];
    if (d.ownedRods.indexOf('wood') < 0) d.ownedRods.unshift('wood');
    if (d.ownedRods.indexOf(d.rod) < 0) d.rod = d.ownedRods[d.ownedRods.length - 1];
    if (!Array.isArray(d.unlockedLocations) || !d.unlockedLocations.length) d.unlockedLocations = ['shore'];
    if (d.unlockedLocations.indexOf(d.location) < 0) d.location = 'shore';
    if (!Array.isArray(d.seenLocations)) d.seenLocations = d.unlockedLocations.slice();
    if (!d.fishdex || typeof d.fishdex !== 'object') d.fishdex = {};
    if (!Array.isArray(d.kept)) d.kept = [];
    const keepCap = (VF.catches && VF.catches.KEEP_LIMIT) || 200;
    if (d.kept.length > keepCap) d.kept = d.kept.slice(-keepCap);
    if (!d.baitCounts || typeof d.baitCounts !== 'object') d.baitCounts = {};
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
    if (!Array.isArray(d.cosmetics)) d.cosmetics = [];
    if (!Array.isArray(d.journal)) d.journal = [];
    if (d.journal.length > 300) d.journal = d.journal.slice(-300);
    if (!d.equipped || typeof d.equipped !== 'object') d.equipped = {};
    d.caseTokens = Math.max(0, Math.floor(d.caseTokens) || 0);
    d.xpOverflow = Math.max(0, +d.xpOverflow || 0);
    d.reputation = Math.max(0, +d.reputation || 0);
    d.charters = Math.max(0, Math.floor(d.charters) || 0);

    /* The slate: drop any job whose template has gone, and any that has lost
       the shape the tracker reads, rather than letting one throw every time a
       fish is landed. slate.fill() tops the list back up on boot. */
    if (!d.slate || typeof d.slate !== 'object' || Array.isArray(d.slate)) {
      d.slate = { jobs: [], rolled: 0, done: 0, seed: 0 };
    }
    if (!Array.isArray(d.slate.jobs)) d.slate.jobs = [];
    d.slate.jobs = d.slate.jobs.filter(function (j) {
      if (!j || typeof j !== 'object') return false;
      if (!VF.slateData || !VF.slateData.get(j.t)) return false;
      j.goal = Math.max(1, Math.floor(j.goal) || 1);
      j.at = U.clamp(Math.floor(j.at) || 0, 0, j.goal);
      j.diff = U.clamp(+j.diff || 0.3, 0, 1);
      delete j.pay;   // pay is worked out at read time now, not stored
      return true;
    }).slice(0, 3);
    d.slate.done = Math.max(0, Math.floor(d.slate.done) || 0);
    d.slate.rolled = Math.max(0, Math.floor(d.slate.rolled) || 0);

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
    for (let i = 0; i < d.kept.length; i++) {
      const k = d.kept[i];
      if (k && !k.traits) k.traits = k.mutation ? [k.mutation] : [];
    }
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
      const payload = JSON.stringify(VF.state.data);
      st.setItem(KEY, payload);
      sinceSave = 0;
      VF.bus.emit('save:written');
      return true;
    } catch (e) {
      console.warn('[save] failed', e);
      return false;
    }
  }

  function load() {
    const st = storage();
    const fresh = VF.state.defaults();
    if (!st) { VF.state.data = fresh; return { loaded: false, reason: 'unavailable' }; }
    let raw = null;
    try { raw = st.getItem(KEY); } catch (e) { /* ignore */ }
    if (!raw) { VF.state.data = fresh; return { loaded: false, reason: 'empty' }; }
    let parsed = null;
    try { parsed = JSON.parse(raw); }
    catch (e) {
      console.warn('[save] corrupt save discarded');
      VF.state.data = fresh;
      return { loaded: false, reason: 'corrupt' };
    }
    VF.state.data = sanitise(merge(fresh, parsed));
    return { loaded: true };
  }

  function reset() {
    const st = storage();
    if (st) { try { st.removeItem(KEY); } catch (e) { /* ignore */ } }
    VF.state.data = VF.state.defaults();
    VF.bus.emit('save:reset');
  }

  function tick(dt) {
    sinceSave += dt;
    if (sinceSave >= AUTOSAVE_INTERVAL) save();
  }

  /* ------------------------------------------------------------ transfer
     A single-file build gets moved around, and localStorage is scoped to an
     origin that moves with it. These two are how a run survives that. The
     string is base64 so it survives a copy-paste through anything, with a
     short prefix so a wrong paste is rejected by shape rather than by throwing
     somewhere deep in the merge. */

  const TAG = 'VF1:';

  function exportString() {
    try {
      return TAG + btoa(unescape(encodeURIComponent(JSON.stringify(VF.state.data))));
    } catch (e) { return null; }
  }

  /* Returns { ok } or { ok: false, why } — never throws, and never leaves the
     game holding a half-applied save: the parse and the merge both happen on a
     scratch object, and the live state is only replaced once it is whole. */
  function importString(str) {
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

    let merged = null;
    try { merged = sanitise(merge(VF.state.defaults(), parsed)); }
    catch (e) { return { ok: false, why: 'corrupt' }; }

    VF.state.data = merged;
    save();
    VF.bus.emit('save:imported');
    return { ok: true, data: merged };
  }

  VF.save = {
    save: save, load: load, reset: reset, tick: tick,
    exportString: exportString, importString: importString,
    isAvailable: function () { return available; }
  };

  /* Never lose progress on tab close. */
  window.addEventListener('beforeunload', function () { save(); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') save();
  });
})(window.VF = window.VF || {});
