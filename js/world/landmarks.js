/* VOID FISHING — the things in a place, and what they have to do with
   each other.

   The Quiet Shore already had a headland, a lighthouse, three islands, a dock
   and a wreck, and every one of them was a number between 0 and 1 times the
   width of the screen. That is the whole problem in one sentence: they were
   at positions rather than in relationships. The dock was at 0.145W whether
   or not anything else was there, the lighthouse pointed at nothing, and none
   of it could be looked at, approached, missed or found, because none of it
   was anywhere — it was drawn at a screen fraction and screen fractions do
   not survive a camera.

   So a zone gets a graph.

     MACRO    one thing, visible from most of the water. It is what tells you
              which zone you are in from the silhouette alone.
     MESO     three to five, placed by sightline: each one goes where an
              earlier one can see it, so the set reads as a route rather than
              as a distribution.
     MICRO    small things, clustered in the influence of the larger ones,
              because debris collects around a wreck and not evenly across a
              sea.
     SECRET   deliberately outside the frame you start in, and deliberately
              on a sightline from one of the meso landmarks — so it is found
              by looking at something else and noticing, which is the only
              kind of finding worth having.

   Placement is planned and then checked. A zone declares how much of itself
   must stay empty, and generation retries until it does: negative space is a
   budget here rather than an aspiration, because the reflex when a frame
   looks thin is always to put another rock in it. */
(function (VF) {
  'use strict';

  const U = VF.util;
  const G = VF.grammar;

  /* Where the player is standing, in world terms. Everything is placed to be
     seen from here first. */
  const EYE = { u: 0, d: 0 };

  let built = null;         // { zone, seed, all, macro, meso, micro, secret }
  let buildKey = '';

  /* ------------------------------------------------------------- building */

  function grammarFor(id) {
    const z = VF.zoneData && VF.zoneData.get(id);
    return (z && z.landmarks) || null;
  }

  function spatialFor(id) {
    const z = VF.zoneData && VF.zoneData.get(id);
    return (z && z.spatial) || null;
  }

  /* Lateral placement is a fraction of the frame at that depth, not a raw u.
     See VF.space.uSpan: the visible water is a wedge, so a flat u range puts
     everything near the player off the sides of the screen. `s` runs -1..1
     across the frame; `spread` is how many frames wide the world is. */
  function toU(s, d) {
    return s * VF.space.uSpan(d);
  }

  function scatterFrustum(rnd, n, o) {
    const pts = G.scatter(rnd, n, {
      uMin: o.sMin, uMax: o.sMax, dMin: o.dMin, dMax: o.dMax,
      sep: o.sep, density: o.density, avoid: null
    });
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const u = toU(pts[i].u, pts[i].d);
      if (o.avoid && G.clearance(o.avoid, u, pts[i].d) < 0) continue;
      out.push({ u: u, d: pts[i].d });
    }
    return out;
  }

  function make(kind, art, u, d, extra) {
    return Object.assign({
      id: art + '@' + u.toFixed(3) + ',' + d.toFixed(3),
      kind: kind, art: art, u: u, d: d,
      scale: 1, importance: kind === 'macro' ? 1 : kind === 'meso' ? 0.6 : 0.2,
      /* How far away it can still be made out. Not a draw cut-off — the fog
         does that — but how far away it can be RECOGNISED, which is what
         navigating by it depends on. */
      visibility: kind === 'macro' ? 4.0 : kind === 'meso' ? 2.2 : 0.9,
      edges: [], discovered: false, seen: 0
    }, extra || {});
  }

  /* Two different radii, and conflating them is why the first pass could not
     satisfy its own empty budget with two objects in the water.

     INFLUENCE is how far a landmark reaches into the fishing: the water beside
     a wreck is different water for a long way out, and this is what the cast
     reads and what micro detail clusters in.

     FOOTPRINT is how much of the picture it actually covers. A wreck is a
     dash on the horizon; its influence is most of a frame wide and the thing
     itself is not. The empty budget is about the picture, so it measures the
     second. */
  function radiusOf(l) {
    return l.kind === 'macro' ? 0.85 : l.kind === 'meso' ? 0.38 : 0.10;
  }

  function footprintOf(l) {
    return l.kind === 'macro' ? 0.55 : l.kind === 'meso' ? 0.16 : 0.05;
  }

  /* What can hide what.

     Only the big things occlude, and only things their own size or smaller. A
     floating spark does not hide a pinnacle and a pinnacle does not hide a
     trench wall — getting this wrong made the trench's macro landmark
     unreachable from the chair, which is the one thing a macro landmark must
     never be. */
  const RANK = { macro: 3, meso: 2, micro: 1, secret: 2 };

  function blockersFor(list, target) {
    const tr = RANK[target] || 1;
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      const r = RANK[l.kind] || 1;
      if (r < 2) continue;            // micro detail hides nothing
      if (r < tr) continue;           // and nothing hides something bigger
      out.push({ u: l.u, d: l.d, block: radiusOf(l) * 0.7 });
    }
    return out;
  }

  function build(id) {
    const gr = grammarFor(id);
    if (!gr) return null;
    const sp = spatialFor(id) || {};
    const seed = 0x5EA1 ^ (id.length * 2654435761) ^ ((gr.seed || 7) * 40503);
    const rnd = VF.rng.make(seed);
    const halfW = sp.width || 2.4;

    const all = [];
    let macro = null;

    /* --- the macro. A side and a distance band; where exactly, inside that,
       comes off the noise, so a zone reads the same every time but was not
       typed in by hand. --- */
    if (gr.macro) {
      const m = gr.macro;
      const side = m.side === undefined ? -1 : m.side;
      const d = U.lerp(m.dMin === undefined ? 1.6 : m.dMin,
                       m.dMax === undefined ? 3.2 : m.dMax, rnd());
      const u = toU(side * U.lerp(m.sMin === undefined ? 0.55 : m.sMin,
                                  m.sMax === undefined ? 0.9 : m.sMax, rnd()), d);
      macro = make('macro', m.art, u, d, { scale: m.scale || 1, tall: m.tall || 0 });
      all.push(macro);
    }

    /* --- the meso set. Each is chosen from a field of candidates by what it
       ought to satisfy, rather than dropped at a coordinate: in sight from
       where the player sits, in sight of something already placed, clear of
       the macro, and not stacked on its neighbours. --- */
    const meso = [];
    (gr.meso || []).forEach(function (spec) {
      const n = spec.count || 1;
      for (let i = 0; i < n; i++) {
        /* Some things stand ON the macro rather than near it. The lighthouse
           is the whole reason the headland reads as big — a scale reference
           is not a neighbour, it is a passenger — so it is placed at the
           macro's own coordinates with an offset up its face, and the two are
           wired together rather than left to a proximity test. */
        if (spec.on === 'macro' && macro) {
          const l = make('meso', spec.art, macro.u + (spec.du || 0), macro.d, {
            scale: spec.scale || 1,
            perch: spec.perch === undefined ? 0.86 : spec.perch,
            visibility: 4.0
          });
          l.edges.push({ to: macro.id, kind: 'pairedWith' });
          macro.edges.push({ to: l.id, kind: 'pairedWith' });
          meso.push(l); all.push(l);
          continue;
        }
        const cand = scatterFrustum(rnd, 40, {
          sMin: spec.sMin === undefined ? -1.15 : spec.sMin,
          sMax: spec.sMax === undefined ? 1.15 : spec.sMax,
          dMin: spec.dMin === undefined ? 0.35 : spec.dMin,
          dMax: spec.dMax === undefined ? 1.6 : spec.dMax,
          sep: 0.05,
          avoid: all.map(function (l) { return { u: l.u, d: l.d, keep: radiusOf(l) }; })
        });
        if (!cand.length) continue;

        const placed = all.slice();
        const blockers = blockersFor(all, 'meso');

        /* Being in sight of something is a requirement, not a preference.
           Scoring it and taking the best still places a landmark nothing can
           see when every candidate happens to be blocked — which is how the
           trench ended up with a pinnacle that no other object in the zone,
           and no viewer, could ever have seen. Filter first; fall back to the
           unfiltered set only if the zone genuinely has nowhere to put it. */
        const reachable = cand.filter(function (c) {
          if (G.visible(EYE, c, blockers)) return true;
          for (let k = 0; k < placed.length; k++) {
            if (G.visible(placed[k], c, blockers)) return true;
          }
          return false;
        });
        const from = reachable.length ? reachable : cand;

        const pick = G.best(from, [
          /* seen from the seat — the first thing a landmark has to be */
          { fn: function (c) { return G.visible(EYE, c, blockers) ? 1 : 0; }, weight: 2.4 },
          /* and seen from something already here, so one leads to the next */
          { fn: function (c) {
              if (!placed.length) return 1;
              for (let k = 0; k < placed.length; k++) {
                if (G.visible(placed[k], c, blockers)) return 1;
              }
              return 0;
            }, weight: 1.6 },
          /* spread across the water rather than bunched on one bearing */
          { fn: function (c) {
              let worst = 1;
              for (let k = 0; k < meso.length; k++) {
                worst = Math.min(worst, Math.abs(c.u - meso[k].u) / 1.1);
              }
              return worst;
            }, weight: 1.5 },
          /* and where the zone said this kind of thing belongs */
          { fn: function (c) {
              if (spec.near === 'macro' && macro) {
                return 1 - U.clamp(G.dist2(c.u, c.d, macro.u, macro.d) / 2.2, 0, 1);
              }
              if (spec.near === 'far') return U.clamp(c.d, 0, 1);
              if (spec.near === 'near') return 1 - U.clamp(c.d, 0, 1);
              return 0.5;
            }, weight: 1.2 }
        ]);
        if (!pick) continue;
        const l = make('meso', spec.art, pick.u, pick.d, {
          scale: spec.scale || 1, tall: spec.tall || 0
        });
        meso.push(l); all.push(l);
      }
    });

    /* --- micro. Density is the influence of everything already placed, so
       small things collect where large things are and the open water stays
       open. --- */
    const micro = [];
    if (gr.micro) {
      /* The empty budget binds here, because micro detail is the only thing
         the zone has a lot of and therefore the only thing worth taking away.
         The count comes down until the water is as empty as the zone said it
         had to be — which is the opposite of the reflex, and the reflex is
         what fills a frame with rocks. */
      let count = gr.micro.count || 12;
      const sources = all.map(function (l) {
        return { u: l.u, d: l.d, r: radiusOf(l) * (l.kind === 'macro' ? 1.5 : 2.6), w: 1 };
      });
      const pts = scatterFrustum(rnd, count, {
        sMin: -1.3, sMax: 1.3,
        dMin: gr.micro.dMin === undefined ? 0.06 : gr.micro.dMin,
        dMax: gr.micro.dMax === undefined ? 1.1 : gr.micro.dMax,
        sep: 0.09,
        density: function (s2, d) {
          return U.clamp(G.influence(sources, toU(s2, d), d) * 0.9, 0, 1);
        },
        avoid: all.map(function (l) { return { u: l.u, d: l.d, keep: radiusOf(l) * 0.55 }; })
      });
      const arts = gr.micro.arts || ['debris'];
      const want = sp.empty === undefined ? 0.4 : sp.empty;
      /* Place, measure, and drop the last few if the water came out too busy.
         Measuring after the fact rather than reserving space in advance keeps
         the clustering honest: the detail still collects around the landmarks,
         there is simply less of it. */
      for (let pass = 0; pass < 10; pass++) {
        micro.length = 0;
        const keep = all.slice();
        pts.slice(0, count).forEach(function (pt) {
          const l = make('micro', arts[Math.floor(G.hash1(Math.round(pt.u * 997), 31) * arts.length)],
                         pt.u, pt.d, { scale: 0.7 + G.hash1(Math.round(pt.d * 997), 47) * 0.6 });
          micro.push(l); keep.push(l);
        });
        const frac = emptyFraction({ all: keep, halfW: halfW });
        const last = pass === 9 || count <= 2;
        if (frac >= want || last) break;
        count = Math.max(2, count - Math.max(1, Math.round(count * 0.18)));
      }
      /* Commit whatever the last pass settled on. An earlier version broke out
         of the loop on success and fell off the end on failure, which quietly
         dropped every piece of micro detail in the zone rather than dropping
         some of it. */
      for (let i = 0; i < micro.length; i++) all.push(micro[i]);
    }

    /* --- the secret. Out of the frame the player starts in, and in sight of
       one of the meso landmarks. Being told a thing is there is not finding
       it; noticing it while looking at something else is. --- */
    let secret = null;
    if (gr.secret && meso.length) {
      const anchor = meso[Math.floor(rnd() * meso.length)];
      const cand = scatterFrustum(rnd, 60, {
        sMin: -1.7, sMax: 1.7,
        dMin: gr.secret.dMin === undefined ? 0.5 : gr.secret.dMin,
        dMax: gr.secret.dMax === undefined ? 1.5 : gr.secret.dMax,
        sep: 0.05,
        avoid: all.map(function (l) { return { u: l.u, d: l.d, keep: radiusOf(l) }; })
      });
      const pick = G.best(cand, [
        /* off the bearing you sit facing — if it is dead ahead it is not a
           secret, it is the view */
        { fn: function (c) {
            const frac = Math.abs(c.u) / Math.max(0.01, VF.space.uSpan(c.d));
            return U.clamp((frac - 0.7) / 0.8, 0, 1);
          }, weight: 2.0 },
        { fn: function (c) { return G.visible(anchor, c, []) ? 1 : 0; }, weight: 1.5 },
        { fn: function (c) { return U.clamp(c.d, 0, 1); }, weight: 0.8 }
      ]);
      if (pick) {
        secret = make('secret', gr.secret.art, pick.u, pick.d,
                      { scale: gr.secret.scale || 1, importance: 0.9, visibility: 1.4 });
        secret.edges.push({ to: anchor.id, kind: 'visibleFrom' });
        anchor.edges.push({ to: secret.id, kind: 'leadsTo' });
        all.push(secret);
      }
    }

    /* --- consequences. Things that are in this water because of something
       the player did, rather than because of the zone's grammar.

       They are placed by hand rather than by the scatter, because the whole
       point of one is that it is where it is for a reason. They get a stable
       id off the fact that put them there, so "have you seen it yet" is one
       lookup rather than a search of the seen-set. --- */
    if (gr.consequences && VF.chains) {
      gr.consequences.forEach(function (c) {
        if (!VF.chains.fact(c.fact)) return;
        const l = make(c.kind || 'meso', c.art, toU(c.s, c.d), c.d, {
          id: 'consequence:' + c.fact,
          scale: c.scale || 1,
          consequence: c.fact
        });
        all.push(l);
        if ((c.kind || 'meso') === 'meso') meso.push(l);
      });
    }

    /* --- the edges. Typed, and computed once: which of these can see which
       other, which is what the composition and the discovery both read. --- */
    for (let i = 0; i < all.length; i++) {
      const blockers = blockersFor(all, all[i].kind);
      /* The most important sightline in the zone is the one from the chair,
         and it is not an edge because the player is not a landmark. It still
         has to be recorded, or a thing standing in plain view of the angler
         reads as unreachable simply because no other object happens to face
         it. */
      all[i].fromEye = G.visible(EYE, all[i], blockers);
      for (let j = 0; j < all.length; j++) {
        if (i === j) continue;
        if (all[i].kind === 'micro' && all[j].kind === 'micro') continue;
        if (G.visible(all[i], all[j], blockers)) {
          all[i].edges.push({ to: all[j].id, kind: 'visibleFrom' });
        }
      }
    }

    /* Where the deep water runs, for the zones that have a seam rather than a
       slope. Fixed per zone rather than per visit: a trench that moved between
       casts would not be a place, and finding it once has to be worth
       something. */
    let seam;
    if (gr.seam) {
      seam = toU(U.lerp(gr.seam.sMin === undefined ? -0.5 : gr.seam.sMin,
                        gr.seam.sMax === undefined ? 0.5 : gr.seam.sMax, rnd()), 0.6);
    }

    const world = { zone: id, seed: seed, all: all, macro: macro, seam: seam,
                    meso: meso, micro: micro, secret: secret, halfW: halfW };
    world.empty = emptyFraction(world);
    return world;
  }

  /* How much of this water has nothing in it. The number the zone check reads,
     and the reason a frame is allowed to be mostly nothing. */
  function emptyFraction(world) {
    const sources = world.all.map(function (l) {
      return { u: l.u, d: l.d, r: footprintOf(l) * 2.2, w: 1 };
    });
    let empty = 0, total = 0;
    /* Sampled across the water the player can actually turn towards, in the
       same frame-relative lateral the placement uses — measuring a wedge on a
       rectangular grid counts a great deal of water that is not there. */
    for (let s = -world.halfW; s <= world.halfW; s += 0.1) {
      for (let d = 0.05; d <= 1.0; d += 0.05) {
        total++;
        if (G.influence(sources, toU(s, d), d) < 0.02) empty++;
      }
    }
    return total ? empty / total : 1;
  }

  /* ---------------------------------------------------------------- access */

  function world() {
    const id = VF.state.data.location;
    if (buildKey === id && built) return built;
    const w = build(id);
    buildKey = id;
    built = w;
    /* The camera is only worth having where there is something off-frame to
       turn towards. */
    if (VF.camera) VF.camera.enable(!!w);
    if (w) restore(w);
    return w;
  }

  /* Discovery survives a save; geometry does not — it comes back off the seed.
     Only which of them have been noticed is worth a byte. */
  function stateFor(zone) {
    const d = VF.state.data;
    if (!d.world || typeof d.world !== 'object') d.world = {};
    if (!d.world[zone] || typeof d.world[zone] !== 'object') d.world[zone] = { seen: {} };
    if (!d.world[zone].seen) d.world[zone].seen = {};
    return d.world[zone];
  }

  function restore(w) {
    const s = stateFor(w.zone);
    w.all.forEach(function (l) { if (s.seen[l.id]) l.discovered = true; });
  }

  function markSeen(l) {
    if (l.discovered) return false;
    l.discovered = true;
    const w = built;
    if (!w) return true;
    stateFor(w.zone).seen[l.id] = Date.now();
    VF.bus.emit('landmark:seen', l);
    return true;
  }

  /* ---------------------------------------------------------------- tick

     Noticing, rather than announcing. A landmark becomes discovered when the
     player has actually had it in frame and near the middle of it for a few
     seconds — which is what looking at something is — or when the line lands
     inside its influence. Nothing pops. */
  function tick(dt) {
    const w = world();
    if (!w || !VF.space || !VF.camera) return;
    const cam = VF.camera.get();
    const bob = VF.scene.L.bobber;

    for (let i = 0; i < w.all.length; i++) {
      const l = w.all[i];
      if (l.discovered) continue;
      if (l.kind === 'micro') continue;          // scenery is not a discovery

      /* Far enough away and it cannot be made out however long you stare. */
      if (l.d > l.visibility) continue;

      const p = VF.space.project(l.u, l.d, cam);
      const centred = 1 - U.clamp(Math.abs(p.x - VF.scene.L.w * 0.5) / (VF.scene.L.w * 0.42), 0, 1);
      const looked = centred > 0.25 && p.fade < 0.86;
      if (looked) l.seen += dt * (0.5 + centred);

      /* Or the line went there, which counts for rather more than a glance. */
      if (bob && bob.visible) {
        const at = VF.space.unproject(bob.x, bob.y, cam);
        if (at && G.dist2(at.u, at.d, l.u, l.d) < radiusOf(l) * 1.3) l.seen += dt * 3.2;
      }

      if (l.seen > 2.6) markSeen(l);
    }
  }

  /* --------------------------------------------------------------- queries */

  /* Everything that could be on screen, sorted back to front so the painter's
     algorithm does the depth for us. */
  function visible(kind) {
    const w = world();
    if (!w) return [];
    const cam = VF.camera.get();
    const out = [];
    for (let i = 0; i < w.all.length; i++) {
      const l = w.all[i];
      if (kind && l.kind !== kind) continue;
      const p = VF.space.project(l.u, l.d, cam);
      if (!p.visible) continue;
      out.push(l);
    }
    out.sort(function (a, b) { return b.d - a.d; });
    return out;
  }

  function nearest(u, d, kind) {
    const w = world();
    if (!w) return null;
    let best = null, bd = Infinity;
    for (let i = 0; i < w.all.length; i++) {
      const l = w.all[i];
      if (kind && l.kind !== kind) continue;
      const k = G.dist2(u, d, l.u, l.d);
      if (k < bd) { bd = k; best = l; }
    }
    return best ? { landmark: best, dist: bd } : null;
  }

  /* How much cover, structure and interest the water at (u,d) has. This is
     what the cast reads: water beside a wreck is not the same water as open
     sea, and a zone that says so is a zone with somewhere to aim. */
  function influenceAt(u, d) {
    const w = world();
    if (!w) return 0;
    const sources = w.all.map(function (l) {
      return { u: l.u, d: l.d, r: radiusOf(l) * 2.0, w: l.importance };
    });
    return G.influence(sources, u, d);
  }

  /* ----------------------------------------------------------------- F9 */

  function debugDraw(ctx) {
    const w = world();
    if (!w) return;
    const cam = VF.camera.get();
    const L = VF.scene.L;
    const pos = {};
    w.all.forEach(function (l) {
      const p = VF.space.project(l.u, l.d, cam);
      pos[l.id] = { x: p.x, y: p.y };
    });

    // sightlines first, so the nodes sit on top of them
    ctx.strokeStyle = 'rgba(120,255,180,0.16)';
    ctx.lineWidth = 1;
    w.all.forEach(function (l) {
      if (l.kind === 'micro') return;
      l.edges.forEach(function (e) {
        const a = pos[l.id], b = pos[e.to];
        if (!a || !b) return;
        ctx.strokeStyle = e.kind === 'leadsTo' ? 'rgba(255,220,120,0.55)' : 'rgba(120,255,180,0.14)';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      });
    });

    w.all.forEach(function (l) {
      const p = pos[l.id];
      const r = l.kind === 'macro' ? 9 : l.kind === 'meso' ? 6 : 3;
      ctx.fillStyle = l.kind === 'secret' ? 'rgba(255,120,220,0.95)'
                    : l.kind === 'macro' ? 'rgba(255,240,160,0.95)'
                    : l.kind === 'meso' ? 'rgba(140,220,255,0.9)'
                    : 'rgba(200,220,235,0.45)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, U.TAU); ctx.fill();
      if (!l.discovered && l.kind !== 'micro') {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(p.x, p.y, r + 4, 0, U.TAU); ctx.stroke();
      }
      if (l.kind !== 'micro') {
        ctx.fillStyle = 'rgba(230,245,255,0.75)';
        ctx.font = '10px ui-monospace, monospace';
        ctx.fillText(l.art, p.x + r + 4, p.y + 3);
      }
    });

    ctx.fillStyle = 'rgba(230,245,255,0.9)';
    ctx.font = '11px ui-monospace, monospace';
    ctx.fillText('landmarks ' + w.all.length + '  empty ' + (w.empty * 100 | 0) + '%', 12, L.h - 30);
  }

  VF.landmarks = {
    world: world, tick: tick, visible: visible, nearest: nearest,
    influenceAt: influenceAt, radiusOf: radiusOf, footprintOf: footprintOf,
    debugDraw: debugDraw,
    markSeen: markSeen,
    /* Has this exact landmark been noticed, in any water? Only consequence
       landmarks have ids stable enough for this to be worth asking, which is
       exactly who asks — a rumour settles when you have SEEN the thing, and
       the seen-set is where that already lives. */
    seenAnywhere: function (lid) {
      const d = VF.state.data;
      if (!d.world) return false;
      for (const z in d.world) {
        const s = d.world[z];
        if (s && s.seen && s.seen[lid]) return true;
      }
      return false;
    },
    /* the tools rebuild without a page reload */
    invalidate: function () { buildKey = ''; built = null; },
    emptyFraction: emptyFraction, build: build
  };

  VF.bus.on('location:changed', function () { buildKey = ''; built = null; });
})(window.VF = window.VF || {});
