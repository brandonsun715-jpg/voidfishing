# AGENTS.md — Void Fishing

## What this is
A pure client-side HTML5/Canvas fishing game. No build step, no bundler, no npm dependencies, no backend. Classic scripts under a global `VF` namespace (not ES modules) so it runs from `file://`. Progress saves to `localStorage`.

## Running it here
Served as static files by nginx (see `docker-compose.base44.yml`) on host port 3000.
- `nginx.base44.conf` runs nginx as `user root;` because the repo root dir is mode 0700 — the default non-root nginx worker can't read the bind mount without it.
- Edits to any file reflect on browser refresh (no live-reload server needed; it's plain static hosting).
- No secrets, no external services, no database.

## Code layout
- `index.html` — single page, loads CSS then classic scripts in order.
- `css/` — `base.css`, `hud.css`, `panels.css`.
- `js/main.js` — entry, wires everything together.
- `js/core/` — bus, rng, save, state, util.
- `js/data/` — all game data (fish, rods, bait, locations, quests, npcs, etc.).
- `js/render/` — canvas drawing.
- `js/systems/` — game systems (casting, reeling, weather, conditions, etc.).
- `js/ui/` — DOM/HUD panels.
- `js/audio/` — WebAudio.
- `tools/` — Node test/audit scripts (smoke, soak, ui-audit, responsive, balance, perf, etc.). Run with plain `node tools/<name>.js` (no deps).

## Verify it works
- `curl -sf http://localhost:3000/` returns the `index.html` source (HTTP 200).
- `npm test` runs the full tool suite (needs Node, no install).
- In the preview, click "Begin" on the title screen to start the game.
