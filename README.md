# VOID FISHING

A quiet fishing game at the edge of an endless void.

Ninety percent of it is sitting still. The water moves, the fog drifts, something
passes underneath and does not surface. Then the line goes tight and it is very
much not quiet any more.

## Running it

Open `index.html`. That is the whole install.

There is no build step, no bundler and no dependencies. The game is written as
classic scripts under a single `VF` namespace rather than ES modules, precisely
so it runs from `file://` — browsers block module loading over that protocol.
Progress saves to `localStorage` automatically; closing the tab is safe.

Tested in Chromium. Needs a browser with Canvas 2D and WebAudio, which is all of
them since about 2015.

## Playing

| Input | Does |
| --- | --- |
| Hold **Space**, or press and hold on the water | Charge a cast — release to send it. Filling the meter into the gold band improves the cast. |
| Press again when the bobber goes under | Set the hook. |
| Hold | Reel. Keep line tension out of the red; the green band brings the fish in fastest. |
| **R** | Reel the line back in |
| **Q F B T M** | Shop, Fishdex, Bag, Record, Map |
| **Esc** | Close a menu |

Catches can be sold for Brophys, kept for the collection, or released for
reputation — which quietly raises your luck, and occasionally earns you
something back.

## What is in it

- **94 species** across eight rarity tiers, from Smallmouth up through Void and
  whatever `!@#$%^&$#` is. Every creature is drawn procedurally from a spec of
  body type, fins, extras and palette — none of them are recoloured duplicates.
- **Six mutations** (Glowing through Void-Touched) multiplying value 4× to 100×.
- **Eight fishing spots**, unlocked by level, each with its own palette, horizon
  feature, distant land, fish pool, weather set and musical scale.
- **Twelve rods and ten baits**, each a real change to cast distance, reel force,
  line strength, rarity odds and luck.
- **Nine weather types** and a continuous day/night cycle, both purely additive —
  nothing here makes the game worse to sit in.
- **Ambient events and legendary encounters.** Occasionally the water goes
  completely still, the audio drops away, and something very large is below you.
- **37 achievements**, a full Fishdex with silhouettes for undiscovered species,
  per-species size records, and a statistics page.

## Layout

```
index.html            script order and the DOM skeleton
css/                  base tokens, HUD, panels
js/core/              utils, seeded RNG, event bus, game state, save
js/data/              fish, rods, bait, locations, weather, mutations,
                      rarities, achievements — all pure data
js/systems/           time, weather, progression, economy, loot, fishing,
                      catches, achievements, encounters
js/render/            palette, particles, screen effects, fish art, scene
js/audio/             procedural WebAudio engine
js/ui/                toast, HUD and input, panels, catch card, tutorial
js/main.js            boot and the frame loop
tools/                headless harness and test scripts (dev only)
```

Systems talk through `VF.bus` rather than reaching into each other, so the
fishing loop does not know the UI exists and the renderer does not know about
the economy.

## Notes on the design

**Fight model.** Line tension is driven by the fish's pull measured against the
rod's line strength, not by raw fish size. An over-matched rod is genuinely
dangerous and a well-matched one is calm, which is what makes buying the next rod
feel like something. A slack-line rule and a snap grace period mean a fight
always resolves — the rod can never be left unusable.

**Rarity.** Gear, bait, location and weather feed one combined "rarity power"
with diminishing returns, so stacking every bonus is strong without being
exponential. Tiers that only exist at a spot because they drifted in from
elsewhere are damped, so a Void fish never turns up at the Quiet Shore — but a
Mythic one, very rarely, can.

**Rendering.** Full-screen translucent fills dominate 2D canvas cost. The
vignette and film grain are CSS compositing layers, the horizon bloom and the
land reflection are cached sprites, and the depth ramp is folded into a single
water gradient. `VF.scene.profile(true)` turns on per-stage timing.

## Development tools

Run from the project root with `npm install playwright --no-save` first.

```
node tools/balance.js      rarity distribution and level curve per game stage
node tools/fight.js        fight duration and win rate per rod and tier
node tools/smoke.js        one full cycle in a real browser, console errors
node tools/soak.js 45      many cycles: stuck states, save round-trip, fps
node tools/ui-audit.js     clicks every control in every menu
node tools/responsive.js   layout overflow across viewport sizes
node tools/perf.js         per-stage render timings at each quality level
node tools/tour.js         screenshots every location and menu
node tools/gallery.js      renders the whole catalogue to one sheet
```

## Building a single file

`npm run build` inlines every stylesheet and script into
`dist/void-fishing.html` — one self-contained file you can move anywhere and
open. Because the game uses classic scripts rather than ES modules, this is a
straight concatenation in the same order `index.html` declares.
