# The Last Drive

A pixel-art motorcycle escape game with smooth scribble-horror creatures.

## Play

Open `index.html` in a modern desktop browser, or use the repository's GitHub Pages deployment when enabled. The game has no build step or external runtime dependencies.

- **WASD / arrow keys:** ride in any direction. Release the keys to stop.
- **Hold Space / Shift + a direction:** spend boost fuel for extra speed. Release boost to immediately save the remaining fuel. The HUD bar shows your fuel; a full tank lasts about 5.6 seconds and pickups add 35%.
- Head upward along the opening straight highway. After roughly 400 meters, its end opens into the natural world. The bike remains centered on screen.
- Ruins, trees, rocks and other substantial scenery are solid. Slide around them; boost does not let you drive through them.
- The woman begins off-screen behind you. Stopping, circling or hitting obstacles lets her take shortcuts and catch up. She gives a 2.5-second audible/visible sprint warning, then attacks for seven seconds. The warning does not supply free fuel. Her changes happen in distinct two-minute stages: unnatural eyes, horns, a tail, a distorted hybrid, then her full scribble form at ten active minutes. Challenges pause her clock.
- Most other monsters begin as ordinary pixel people. Forty identity-specific emergence variants include climbing from a collapsing human-shaped shell, unfolding, shadow-rising, crawling, peeling away as a double, spiraling and uncoiling. These are supernatural, non-gory transformations. Animation duration starts at about 1.87 seconds (1.5× the old speed), gradually reaches 1.4 seconds at ten active minutes (2×), and stays capped there. The additional 0.7-second escape grace is unchanged: amber means harmless transformation/grace, red means armed and lethal.
- Three challenge types rotate: number-memory doors, Echo Signal (watch and repeat arrows), and Engine Tune (stop a moving marker in the green zone). Number lengths, arrow sequences, and timing difficulty grow with active run time, within capped limits. All challenges pause pursuit, transformation clocks and fuel consumption. Correct memory doors fill the tank; other successes add 50%. Every completed challenge gives a 2.5-second safe head start, including after a mistake.
- Running creatures compress on landing, push off, and coast through a brief flight phase. Their actual pursuit speed pulses slightly with those push-offs rather than remaining completely uniform.

## World

Persistent, irregular regions extend in every direction: desert dunes and pyramids; jungle temples and pools; abandoned ruins and fountains; meadow rocks and hay bales; snowy pines and ice; coastal boats and lighthouses. Farther regions become corrupted terrain with watching eye-pillars, barred arches and rune obelisks. Houses, barns and cabins no longer generate. The starting highway is the only road; outside it you ride through open terrain and natural gaps between solid landmarks. Traffic stays on the highway, while people wander through the world. Regions use a 6,000-unit spacing (six times the previous width), with variable boundaries and sizes rather than fixed distance stages. Stable numbered landmarks make a time-loop rewind recognizable. A loop restores a previous position, not a newly randomized view.

The world is generated from coordinates with a bounded cache. Encounters, pedestrians, traffic, pickups and rewind history are also bounded. There is no final level or forced ending.

The world is now nighttime, with a direction-following pixel headlight and locally illuminated warning rings and fuel pickups. Ordinary pedestrians are very sparse: four initially, at most six nearby. Random monster encounter slots occur roughly every 38–60 seconds, with at most one ordinary monster and no new transformations during the woman's sprint. Only 24% of eligible building/major-structure placements remain; surviving structures carry stable three-digit landmark plates to help you recognize a time-loop return.

## Survival and sound

Normal riding speed is 220; revealed monsters have base speeds of 275–295 and remain faster than normal riding throughout their stride. Her sprint speed is 315; even its fastest stride remains below a full boost's 380. Ordinary chases tire after eight seconds if you maintain enough separation. Keep a reserve for escaping, rather than holding boost constantly.

About one-quarter of rare encounter slots are off-screen rushers, approaching from the top, bottom, left or right. A directional message and sound warn you; their first 1.2 seconds are a slower, harmless approach. Once an ordinary monster has been visible, keeping its entire sprite outside the camera for 0.35 seconds ends that chase. Initial off-screen approach is not mistaken for an escape. The persistent following woman retains her separate off-screen pursuit rules.

Some rushers are Breathless sprinters: their 490 base speed beats even boost, but they can sustain it for only 1.6 seconds after the approach warning. Dodge or boost away to survive that burst. They then slump, stop permanently, turn harmless, and show a blue TIRED marker before fading away. These attacks retain the one-monster limit and do not overlap the woman's sprint.

Fuel pickups add 35% but now arrive only every 30–38 seconds of movement, with at most two nearby. Sprint warnings never generate a rescue pickup. Challenge rewards remain available. The design provides tested escape windows on clear routes with saved fuel; poor steering, missed pickups or wasting fuel can still end a run.

Audio starts only after clicking START DRIVE. Synthesized wind, low drones, approaching footsteps, heartbeat pulses, warning growls and encounter/death stingers build with danger. SOUND ON/OFF mutes them. Default output is kept moderate, and temporary voices are capped. No external audio downloads are required.

## Checks

Run `node tests/game.cjs` for regression tests covering directional motion, stopping and camera centering, the straight opening highway, irregular biomes, solid landmarks, pursuit and pathfinding, ten-minute transformation, monster contact, boosts, memory doors, coordinate-preserving loops, and a twelve-minute seeded simulation with retries. These tests simulate the DOM and canvas API; they are not browser play-testing. Native canvas renders separately verify the real creature atlas and terrain.

Creature artwork provenance and the generation prompt are in [assets/monster-art-notes.md](assets/monster-art-notes.md).
