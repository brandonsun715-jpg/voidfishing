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
| Hold | Drive the white bar right; let go and it runs back left. Keep the fish inside the bar and the meter fills. |
| **R** | Reel the line back in |
| Any of them | Skip a sequence. The catch is already recorded either way. |
| **Q F B T M** | Shop, Fishdex, Bag, Record, the Chart |
| **J C** | Journal, Wardrobe |
| **Esc** | Close a menu |

Catches can be sold for Jias, kept for the collection, or released for
reputation — which quietly raises your luck, and occasionally earns you
something back.

Progress lives in this browser, under the address you opened the game from.
**Settings → Save data** exports it as a string and imports one back, which is
how a run moves between machines or follows a single-file build to a new folder.

## What is in it

- **214 species** across nine rarity tiers, from Smallmouth up through Void,
  whatever `!@#$%^&$#` is, and the one above that. Every creature is drawn
  procedurally from a spec of body type, fins, extras and palette — none of them
  are recoloured duplicates.
- **The `!@#$%^&$#` tier is not fish.** Almost nothing in it has a fin. A hook is
  a hook, a chair is a chair, a boot is a boot — each entry is drawn as the
  object itself, with the wrongness laid over the top rather than built into the
  anatomy, and it comes up out of the dark as that shape too. The handful of
  exceptions are the ones where being a fish is the joke. A handful of entries
  go the other way entirely and are not objects either — things far too large
  and far too old to have a body plan worth describing.
- **The `?` tier is not on the record until you have been in it.** It is not
  listed, its two entries are not counted in the Fishdex total, and nothing in
  the game acknowledges it exists until one of them is on the line. There are
  exactly two, they are the only catches that stop the game to show you
  something, and both are a scripted fight rather than the usual one. Landing
  either is roughly a one-in-twelve-thousand cast with every rarity charm you
  own and the best rod in the game, and flatly impossible on a first rod at the
  shore.
- **Ten traits** that stack. A catch can be Ancient *and* Golden *and* Massive
  *and* Aggressive at once, each multiplying its value, with a further bonus for
  the combination. Tiny and Massive are read off the size roll rather than
  rolled, so they always mean what they say.
- **Charms and relics** in up to five slots. Charms are bought; relics are found
  in the water. Almost every one costs you something — the Broken Compass finds
  far rarer fish and takes much longer to find them — so a loadout has a shape
  rather than just a size.
- **Salvage**: coins, bottles, fossils, keys, charts, lenses and relics come up
  on the line instead of fish. Some sell. Some are how you find the rest.
- **Conditions** that change a spot for a few minutes — migrations, glowing
  water, dead calm, feeding frenzies, thin places — layered on top of weather.
- **Hidden water.** Spots that are never listed until found, each behind a
  different condition. The last ones are not level unlocks: you have to have
  been told where they are, and one of them is the end of the quest.
- **Six people** with dialogue that moves as you do, and a journal that writes
  itself as you turn things up.
- **Cosmetic cases** bought with Jias, containing cosmetics and nothing else:
  rod finishes, bobbers, line and splash effects, cast trails, catch effects,
  interface themes and outfits. The odds are printed, per case, after folding in
  what that case actually stocks. Duplicates are refunded.
- **"Something is wrong"**, very rarely. The water stops, the music cuts, the
  interface goes, something passes underneath, and then everything is exactly as
  it was and nothing is said about it.
- **Eight fishing spots**, unlocked by level, each with its own palette, horizon
  feature, distant land, fish pool, weather set and musical scale — plus six
  more that are never listed until found.
- **123 rods and ten baits**, each a real change to cast distance, reel force,
  line strength, rarity odds and luck. Twenty-three sit on the shelf; the other
  hundred are the wanderer's, and he only ever carries twenty of them at a time.
- **Ten of the shelf rods are not a straight continuation of the ladder.** They
  interleave with the tiers around them, and **six are never for sale**: the old
  fisherman hands you the one he bound himself, the archivist and the collector
  give up theirs once you have earned it, the keeper has had one under the
  counter the whole time, and two come up on the line wrapped in cloth. The four
  that *are* sold still want something first: water that is not on the map, an
  object out of the trench, or a particular species in the record.
- **A wanderer** who is somewhere else most of the time. When he is here he is
  here for half an hour, carrying twenty rods drawn from his hundred, weighted
  so the good ones are rare rather than absent, and he does not restock what he
  sells you this visit.
- **A quest in eleven chapters**, given by an astronomer who is not looking for
  a fish. It runs through five people, three trials of a different kind of
  fishing, an event that only happens while it is running, and water that is not
  on any map.
- **Nine weather types** and a continuous day/night cycle, both purely additive —
  nothing here makes the game worse to sit in.
- **Ambient events and legendary encounters.** Occasionally the water goes
  completely still, the audio drops away, and something very large is below you.
- **63 achievements**, a full Fishdex with silhouettes for undiscovered species,
  per-species size records, and a statistics page.
- **The chart.** The map is a sounding rather than a list: one plumb line
  dropped through the whole world with every place hung off it at its own
  depth. The ladder descends the spine, hidden water branches off it as
  diamonds, THE HEAVENS floats above the waterline and THE LAST WATER sits
  under the bottom. The column is sampled from the real palette of each spot,
  so it darkens through the colours the game is about to show you. Locked water
  is a depth reading with nothing named against it. Picking a place says what
  actually lives there — how many of its species are on your record, broken
  down by tier.
- **Chartering the water.** Conditions are the strongest thing in the game and
  the only one you could never influence. Late on, Jias stop having anywhere to
  go — so the shop will sell you one. The price scales with your level and
  climbs each time you ask, falling back over about ten minutes, so the answer
  to "can I just keep buying Thin Places" is yes, at a price that climbs faster
  than you can fish.
- **Four save slots**, and a way to move one. A slot lives in this browser at
  the address the file was opened from, so copying the build to a laptop — or
  just moving it to another folder — leaves every slot behind. **Settings →
  Save data** exports the slot you are playing as a string and imports one back
  into whichever slot you point it at, through the same merge, sanitise and
  revoke a normal load goes through.

## The two builds

`npm run build` makes the game you hand to anybody. `npm run build -- --admin`
makes the one with the door in it.

The difference is not a flag the player build carries and ignores. The owner
build has two files the player build does not have at all — `js/core/authcode.js`
and `js/ui/console.js`, plus `css/console.css` — and the handful of lines
elsewhere that reach for them are cut out between `/* @admin-only */` and
`/* @end-admin */`. Take those away and there is no word to guess, no key
sequence to find and no salt to read: the door is not hidden, it is absent.
The build refuses to write a player file if any of it leaks through.

**Getting in**, in the owner build: press **###**, three times quickly, and the
door opens. It wants four digits. `npm run authenticator` builds a small
self-contained page — put it on a phone, open it offline — that derives the
same code from the same clock, because it inlines `authcode.js` verbatim rather
than keeping its own copy of the maths. The code rolls every thirty minutes and
the windows either side are honoured, so two clocks do not have to agree
exactly. The way in lasts fifteen minutes. Typing `admin` does the same thing
once you are already through.

What that gate is honestly worth: the salt ships in the owner build, so anybody
willing to open devtools can compute the code or call straight past it. It is a
bolt on the inside of a door that is already not in the player's house. The
build split is the lock that works.

## Layout

```
index.html            script order and the DOM skeleton
css/                  base tokens, HUD, panels
js/core/              utils, seeded RNG, event bus, game state, save (four
                      slots), authcode (owner build only)
js/data/              fish, rods, merchant rods, bait, locations, weather,
                      mutations, rarities, quests, achievements, runs, trials,
                      recipes, mods, lore — all pure data
js/systems/           time, weather, progression, economy, loot, fishing,
                      catches, quests, merchant, cutscenes, achievements,
                      encounters, daily, bounties, wall, away, returning,
                      charter
js/render/            palette, particles, screen effects, fish art, the chart,
                      scene
js/audio/             procedural WebAudio engine
js/ui/                toast, HUD and input, panels, catch card, tutorial,
                      console (owner build only)
js/main.js            boot and the frame loop
tools/                headless harness and test scripts (dev only)
```

Systems talk through `VF.bus` rather than reaching into each other, so the
fishing loop does not know the UI exists and the renderer does not know about
the economy.

## Notes on the design

**Fight model.** One control, one job. Hold and the white bar drives right; let
go and it runs back left. Keep the fish inside the bar and the meter fills, let
it out and the meter drains, and there is no randomness in the loop beyond where
the fish decides to go next. How hard that is comes entirely out of the species,
its rarity, its size, the rod and the worn charms — an over-matched rod gives you
a narrow bar and a fish that turns constantly, a well-matched one is calm, which
is what makes buying the next rod feel like something. Tension, distance and
stamina are derived from the minigame every frame rather than simulated
separately; they are what the rod bends on and what the reel audio tracks.

**Scripted fights.** A few catches replace the single set of numbers with a list
of phases, each with its own bar width, bar speed, fill rate and name. Phases are
gated on the meter rather than on a clock, so the fight is as long as the player
makes it, and they only ever go forwards — losing ground in the last phase does
not put you back in the first. The rod and charm loadout still applies on top of
the authored numbers, so gear matters in a scripted fight exactly as much as it
does anywhere else.

**Traits and builds.** Traits are rolled independently, so a combination is the
product of its odds rather than a special case — which is what makes a four-trait
fish genuinely rare instead of merely tagged as rare. Charm effects fold into one
build object that the loot roll, the fight and the treasure roll all read, so a
loadout changes the whole game rather than one number.

**Rarity.** Gear, bait, location and weather feed one combined "rarity power"
with diminishing returns, so stacking every bonus is strong without being
exponential. Tiers that only exist at a spot because they drifted in from
elsewhere are damped, so a Void fish never turns up at the Quiet Shore — but a
Mythic one, very rarely, can.

**Rendering.** Full-screen translucent fills dominate 2D canvas cost. The
vignette and film grain are CSS compositing layers, the horizon bloom and the
land reflection are cached sprites, and the depth ramp is folded into a single
water gradient. `VF.scene.profile(true)` turns on per-stage timing.

**Creatures.** Counter-shading — dark along the back, pale along the belly — is
what stops a procedural fish reading as a flat coloured shape. On top of that
sit a clipped scale texture, a lateral line, a gill plate, fins built from
membrane plus rays, and an iris in the species' accent colour. Fine detail is
skipped below about 22px, where it would only be noise.

**Audio.** Everything runs through a limiter and a warmth shelf, so overlapping
effects never turn brittle. The pad is two banks of detuned sine and triangle
voices that crossfade on a chord change rather than gliding, widened by a pair
of modulated delay lines. Every envelope opens and closes on a ramp — instant
starts are what make small synthesised effects click. The ambient bed eases
back while a fish is on the line so the reel cuts through.

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
node tools/closeup.js      renders a few species large, to judge surface detail
node tools/rods.js         renders every rod preview to one sheet
node tools/audio.js        measures output level, spectral balance and clipping
node tools/systems.js      traits, builds, conditions, salvage, secrets, cases
node tools/newui.js        screenshots the charm, case, wardrobe and journal panels
node tools/newcontent.js   are the newer species actually reachable, or only present
node tools/rodgates.js     every gated rod states the right reason it is out of reach
node tools/hooked.js       the shape coming up out of the dark, at several distances
node tools/distcheck.js    the single file behaves exactly like the folder
node tools/unknown.js      the ? tier: hidden until caught, the odds, both sequences
```

## Taking a build apart

`node tools/unbuild.js <file.html> [outDir]` reverses the build. The single file
is a straight concatenation with a `/* path */` line in front of every file, so
it splits back into the css/ and js/ trees and an index.html exactly — verified
by rebuilding the result and diffing it against what it came from. This exists
because a source tree can go missing while the build survives.

## Building a single file

`npm run build` inlines every stylesheet and script into
`dist/void-fishing.html` — one self-contained file you can move anywhere and
open. Because the game uses classic scripts rather than ES modules, this is a
straight concatenation in the same order `index.html` declares.

`npm run build:admin` writes `dist/void-fishing-admin.html` instead, which is
the same game with the door in it. Keep that one.
