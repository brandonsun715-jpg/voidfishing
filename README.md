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
| Press and hold **on a patch of water** | Aim there, and charge. Release to send it — the mark shows where you pointed, the cross where the rig will actually land. |
| Hold **Space** | The same, aimed at whatever the frame is centred on. |
| **← →** | Walk the aim along while the meter is filling; turn and look along the water when it is not. |
| Press again when the bobber goes under | Set the hook. |
| Hold | Drive the white bar right; let go and it runs back left. Keep the fish inside the bar and the meter fills. |
| **R** | Reel the line back in |
| Any of them | Skip a sequence. The catch is already recorded either way. |
| **Q F B T M** | Shop, Fishdex, Bag, Record, the Chart |
| **J C** | Journal, Wardrobe |
| **Esc** | Close a menu |
| **F8 F9** | Hide the interface; show the world's working (development keys) |

In the harbour there is no rod and nothing bites: click what you want to walk
up to, the arrows at the corners to move between views, and your boat to put
out again. You get there from the Chart — Vault Harbour sits at the top of the
rail, above the water, because it is not somewhere you fish.

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
                      charter, the harbour
js/gl/                the WebGL2 layer: context and passes, sky and sea
js/world/             world coordinates and the camera, the shapes a place is
                      built from, the landmark graph, the event director, the
                      rumour ledger, the player's history, delayed
                      consequences, and what people notice about you
js/render/            palette, particles, screen effects, fish art, the chart,
                      landmark art, the ground people stand on, the harbour,
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

**The sea is on the GPU; the things in it are not.** Two canvases, stacked,
and they never exchange pixels. WebGL2 draws the sky, the water, the light on
it and the air between you and the horizon; the fourteen thousand lines of
hand-tuned procedural art — creatures, rods, the angler, the boat, the
landmarks — keep drawing in Canvas 2D on a transparent canvas above it. The
reason they are kept apart is measured rather than assumed: pushing a
full-screen 2D canvas into a GPU texture is four and a half megabytes across
the bus and costs 30 ms here, which is more than the entire frame budget, so
the compositor does the one job it is very good at and neither layer ever has
to read the other. A 2D layer only becomes a texture when it is a bake that
changed, and those change a handful of times an hour.

The water was about fifty stacked translucent fills — a depth gradient, a
horizon seam, eleven belled bands for the light path, a hundred and thirty
specular flecks, three swell bands and thirty-two wave lines — and full-screen
translucent fills are the dominant cost of a 2D canvas. It is one fragment
shader now, and it can do things the stack could not: the light path is
computed from the actual slope of the surface, so the glints lie along the
crests and compress toward the horizon on their own, and the air is applied
per pixel by distance instead of as a band drawn over the top.

Everything degrades. No WebGL2, a lost context or a shader that will not
compile and the renderer keeps its old 2D path — `node tools/gl.js` refuses
the context outright and checks the game still draws water.

**Most crossings are water going past.** The sea used to roll one to three
events per trip, and the expression could not return zero, so in the whole
life of the game there was never an uneventful one. Nothing asks for an event
now: `js/world/director.js` is asked and usually says no. Notable things spend
from a budget and quiet refills it, so a major encounter cannot follow a major
encounter however the dice fall, and a candidate is a function of the world
rather than a number, so one that does not apply is not in the draw at all.

**Declining is steering, not a button.** A quarter of the options out there
did nothing — "go round", "let her go", "note it and carry on" — and they are
deleted rather than reworded, because the world is a better place to put that
decision. Something off the bow is a shape at a bearing, and holding your
course is how you decline; closing it costs time, which is what makes not
going a real alternative. Only the answers that differ once you are already
there stay on a card. `node tools/consequences.js` plays every branch from an
identical save and diffs the world with the text excluded, because a different
sentence is not a different outcome.

**Some things come back later.** A consequence you meet in the same breath as
the choice is a result, not a consequence. `js/world/chains.js` is the other
kind: a condition arms it, a distance measured in things the player DID —
crossings, casts, trips, conversations — has to pass, and then the world is
different and nothing says so. Sail past something calling on a crossing and
the game does not scold you; three crossings later there is a hull on the
shelf above the trench, a man on the shore who will tell you about it, and
somebody at the counter who says he makes it up. The delay is never in
seconds: a consequence on a wall clock would go off while the game sat on a
title screen, and `node tools/chains.js` asserts that six minutes of game time
fires nothing. A chain may set a fact, arm a rumour or write one journal line.
It may not raise a toast, open a panel or start a quest, and that is checked
too.

**People notice.** The dialogue is a ladder, and a ladder can only ever say
the next thing — which is right for a story somebody is telling you and wrong
for everything else, because a ladder cannot say "you look terrible". So
`js/world/react.js` sits between the ladder and the rumours: lines scored
against the state of the world rather than ordered, so the mechanic remarks on
the hull you keep breaking, the child on where your boots have been, the
cartographer on a number you have now settled. Nothing there advances
anything, so it cannot be missed and cannot be farmed. It is recorded, so
nobody says the same thing twice running.

**People tell you things, and they may be wrong.** A clue is always true, has
no source, and always opens a lead — the right shape for evidence and the
wrong shape for everything else. A rumour is somebody telling you: true,
partial, outdated, exaggerated, or flatly false. Which it is never appears in
the interface, because a rumour you can see through is a quest with extra
steps. Two people can make different claims about the same thing and the game
leaves them disagreeing until you go and look, and what settles it is always
something you did.

**Somewhere that is not water.** The shop was a panel, the boatyard was a
panel, the chart was a panel, and the mechanic — whose written station is
"under a hull, mostly" — had no hull to be under. Vault Harbour is four framed
viewpoints you move between: the dock with your boat moored at the quay and
the child sitting on the end of it, the yard with somebody else's hull up on
blocks and him underneath it, the market row, and one room above the water.
You do not walk; a character controller would be a different game. It draws
into the same two canvases the sea uses — the GL sky and water at the
harbour's own horizon, the boards and the people above — so the sea in the
window of the room is not a picture of the sea, it is a hole in the wall with
the shader behind it. The panels still open, because 3,500 lines of working
shop are not thrown away to make a point; what changed is that you reach them
by standing at a counter. `node tools/port.js` shoots all four with the
interface off and refuses a hotspot that is off the frame, cannot be clicked,
or opens nothing.

**Your boat looks like your boat.** Hull integrity has always been tracked and
always been spent — a worn hull fights worse, bites worse and sails slower —
and it has never once been visible. Now it is planking: a stain along the
waterline, plates riveted over the damage, and past two thirds a rail that no
longer runs fair. The fitted modules are on deck too — a sonar dome that
sweeps, a survey davit, a hold hatch, a rack of rods — none of them labelled,
so the first time you buy sonar you notice a dome appear. And a bug the yard
made obvious: `damage()` multiplied the soak by the engine's `wear` figure,
which goes DOWN as the engine gets better, so a rank-5 engine halved the soak
and exactly doubled every knock the hull took. The best engine in the game
made the boat twice as fragile and nothing said so. `node tools/boatmath.js`
asserts the direction of every hull and module relationship.

**There is no best boat.** Every hull used to be the last one with bigger
numbers: more speed, more integrity, more of every slot, and nothing given up.
So there was never a decision, only a queue. Now each hull has two ratings that
pull against each other — a DRAUGHT, how much water she needs under her, and a
PRESSURE rating, how deep she can work — and both go up with size. The skiff
draws forty centimetres and is rated for two hundred metres; THE UNDERSIDE
draws three and a half metres and is rated for anything. Each of them reaches
water the other never will, and every hull between owns a band.

Fitting her out is a build rather than a shopping list: the five modules spend
BERTH, a budget the hull has, and THE UNDERSIDE has five slots of everything
and can afford eighteen of twenty-five levels. And what you bolt on puts weight
in her, so displacement adds draught — a fully instrumented survey vessel draws
more than a bare one and loses the shallow water for it. Owning a module and
having it aboard are separate, and moving it either way is free, so stripping
her down to get into the Glass Flats is a thing you do in the yard in thirty
seconds rather than a purchase you regret. `node tools/reach.js` prints the
grid and asserts the three things that make it a tradeoff instead of a ladder:
no water unreachable, no hull that reaches everything, and the smallest and the
largest each reaching water the other cannot.

**The chart is geography now.** It was a plumb line — one vertical spine with
every place hung off it by depth — because there were no coordinates anywhere
in the build. That was a true thing to say about the progression and the only
thing the map could say: two places adjacent on the ladder were adjacent on the
chart whether they were an hour apart or a week, and a man had been telling the
player about the EASTERN markers since level four in a world with no east in
it. Every place carries `at` now, leagues east and south with the harbour at
the origin, and the chart draws the sea that implies: a coastline generated
from eleven control points and a noise field, isobaths round the deep places,
the shoal patches and the deep marked because the boat has a draught, routes
with their real length — and unsurveyed water, blank and hatched, which is the
whole point of having a chart and the one thing a column could never show.

A crossing's duration comes off that distance rather than off progression rank,
so the harbour is genuinely a hop from the shore and the trench to the cradle
is genuinely a haul. And with survey gear aboard you can take a sounding in the
blank: what comes back is one line about what might be out there, never a
marker. `node tools/chart.js` checks the positions are distinct, that hidden
water sits beside the place its data has always said it was near, that every
crossing lands in a sane band, and that east is east.

**The water has coordinates.** Everything used to be drawn in screen space
against one horizon line, which is why the big light sat at 0.70 of the way
across the frame in all nine zones, why the pylons on the Glass Flats were a
table of constants, and why nothing could be looked at: there was nowhere for a
thing to *be*. The water is now a plane addressed as `(u, d)` — how far along,
how far out — projected on the same depth ramp the wave lines and the moonpath
were already spaced on, so anything placed through it lands on the surface the
water renderer is drawing rather than near it. The camera translates rather
than rotates, which is where the parallax comes from for free: a world unit is
1.45 half-screens wide at the hull and 0.55 at the horizon, so sliding the
frame slides near water further than it slides the sky.

**The Quiet Shore, re-passed.** It declared a landmark graph with a headland
in it AND `silhouette: 'rocks'`, the generic procedural ridgeline — two
horizons competing, and the one that means something lost. What the screenshot
showed with the interface off was a row of grey triangles, a smudge in the top
corner where the headland was, and a lit dot floating beside it. The ridgeline
is gone, and the headland has a top now: it used to run off the top of the
frame at every distance, which is right for one you are sitting under and wrong
for one across the bay, and a promontory with no sky above it is a curtain down
one side of the picture. Its height falls off with distance like everything
else, it is darker than the air it stands in rather than the same value as it,
and the light stands on its actual ridge rather than on a fraction of the
screen. The bay reads as a bay, and the question the zone declares — *why does
nobody go past the lighthouse?* — is now a thing you can see.

**A zone is a graph, not a list of positions.** One macro landmark you can
know the place by, three to five meso landmarks placed *by sightline* — each
where an earlier one can see it, so the set reads as a route — micro detail
scattered against the influence field of everything larger, so debris collects
around a wreck instead of evenly over a sea, and a secret placed off the
bearing you start on but in view of something else, so it is found by looking
at one thing and noticing another. Every zone also declares how much of itself
must stay **empty**, and generation backs off until it does. The reflex when a
frame looks thin is to put another rock in it; that number is what says no.

**The identity matrix is a test.** Each zone declares a shape language, how its
water moves, where its light comes from, the navigation problem it poses and
the mechanic that only exists there — and `tools/zonecheck.js` fails if two
zones share a navigation problem, a mechanic or a whole look, or if one is
missing something to know it by, something that is not obvious, a question it
does not answer, or the empty water it promised. Two zones may share a shape
if they do something different with it; the Basin's rings and the Cradle's arcs
are both round and are not the same place.

**Where you cast is a decision.** The bobber used to land at
`0.54 + random() * 0.22` of the screen width, thrown away and re-rolled every
throw, and nothing downstream ever saw it — which is why no zone could make
"where do I put the line" into a question. Pointing at water aims there; the
rod's reach decides whether it can get that far and the meter decides how close
to the mark it lands, so a longer rod is a visible gap closing rather than a
number. Where it lands is then read for depth, cover and light, and those feed
the bite timer and a fourth species-preference axis alongside bait, hour and
weather. The Deepwater Trench is the case the system exists for: its deep water
is a narrow seam, nothing on the surface says where, and the sonar sweep that
shows it fades — so the answer has to be remembered rather than read off a
marker, and a rod dropped over the shelf waits nearly twice as long as one
dropped over the seam.

**F8 is the acceptance test.** It takes the whole interface away. A scene can
be carried entirely by the panels sitting on top of it without anyone noticing,
and the only way to find that out is to look; if the frame does not hold up
with the HUD gone — a silhouette you can name, one thing worth looking at,
foreground and distance that are different distances — the environment is not
finished, whatever it looked like with a cast meter over it. F9 draws the
working underneath: the `(u, d)` lattice, the landmark graph and its
sightlines, the edge of the world and the rod's stage.

**The rod is composed into the frame rather than sized by itself.** Its length
used to come out of the rod and the angler with the picture getting no say, so
the endgame blank ran 557px from a hand at 0.26W and put its tip past the
centre of the screen. The frame now decides: the tip reaches a fixed fraction
across at whatever angle the rod is held, and rod identity survives as a band
either side of that. The art is still drawn at the weight it was tuned for, so
shortening the blank did not thin sixty rods' worth of detail as a side effect.

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
node tools/world.js       every zone with the interface off, two times of day
node tools/zonecheck.js   the identity matrix, and the landmark graph's shape
node tools/space.js       the projection's invariants: round-trip, parallax,
                          scale agreement, and that a cast lands where aimed
node tools/trips.js       fifty crossings: how many of them ask you anything
node tools/consequences.js every branch of every choice, diffed
node tools/rumours.js     being told two things and finding out which was right
node tools/chains.js      a consequence arms, waits, fires once, and announces
                          nothing — and time passing alone fires nothing at all
node tools/react.js       ten states of the world, and what the same nine people
                          say in each of them
node tools/boatmath.js    a better engine takes LESS hull damage, on every hull,
                          the berth budget holds, and the hold does its job
node tools/reach.js       which boat can work which water, as a grid — and the
                          three assertions that make it a tradeoff not a ladder
node tools/chart.js       the world has a shape, distance means something, and
                          the chart drags, zooms and holds up at every size
node tools/port.js        all four harbour viewpoints with the interface off, and
                          every hotspot in frame, clickable, and not a dead click
node tools/gl.js          every shader builds, the water has light in it, and
                          the game still draws with WebGL2 refused
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
