# The Last Drive

A pixel-art motorcycle escape game with smooth scribble-horror creatures.

## Play

Open `index.html` in a modern desktop browser, or use the repository's GitHub Pages deployment when enabled. The game has no build step or external runtime dependencies.

- **WASD / arrow keys:** ride in any direction. Release the keys to stop.
- **Hold Space / Shift + a direction:** spend boost fuel for extra speed. Release boost to immediately save the remaining fuel. The HUD bar shows your fuel; a full tank lasts about 5.6 seconds and pickups add 35%.
- Head upward along the opening straight highway. After roughly 400 meters, its end opens into the natural world. The bike remains centered on screen.
- Houses, trees, rocks and other substantial scenery are solid. Slide around them; boost does not let you drive through them.
- The woman begins behind you as a person. She takes direct shortcuts and paths around obstacles, catches a stationary rider, and gradually becomes a scribble monster over **ten active minutes**. Memory events pause the world and her transformation.
- Most other monsters begin as ordinary pixel people. Forty identity-specific emergence variants include climbing from a collapsing human-shaped shell, unfolding, shadow-rising, crawling, peeling away as a double, spiraling and uncoiling. These are supernatural, non-gory transformations. Animation duration starts at about 1.87 seconds (1.5× the old speed), gradually reaches 1.4 seconds at ten active minutes (2×), and stays capped there. The additional 0.7-second escape grace is unchanged: amber means harmless transformation/grace, red means armed and lethal.
- Three challenge types rotate: number-memory doors, Echo Signal (watch and repeat arrows), and Engine Tune (stop a moving marker in the green zone). Number lengths, arrow sequences, and timing difficulty grow with active run time, within capped limits. All challenges pause pursuit, transformation clocks and fuel consumption. Correct memory doors fill the tank; other successes add 50%. Every completed challenge gives a 2.5-second safe head start, including after a mistake.
- Running creatures compress on landing, push off, and coast through a brief flight phase. Their actual pursuit speed pulses slightly with those push-offs rather than remaining completely uniform.

## World

Persistent, irregular regions extend in every direction: desert dunes and pyramids; jungle temples and pools; houses and fountains in towns; meadow barns and hay bales; snowy cabins and ice; coastal boats and lighthouses. Farther regions become corrupted forest, hollow ruins and monster-world terrain. The starting highway is the only road; outside it you ride through open terrain and natural gaps between solid landmarks. Traffic stays on the highway, while people wander through the world. Regions use a 6,000-unit spacing (six times the previous width), with variable boundaries and sizes rather than fixed distance stages. Stable numbered landmarks make a time-loop rewind recognizable. A loop restores a previous position, not a newly randomized view.

The world is generated from coordinates with a bounded cache. Encounters, pedestrians, traffic, pickups and rewind history are also bounded. There is no final level or forced ending.

The world is now nighttime, with a direction-following pixel headlight and locally illuminated warning rings and fuel pickups. Ordinary pedestrian starts, spawn rate and population cap are roughly one-third of their previous values. Only 24% of eligible building/major-structure placements remain; surviving structures carry stable three-digit landmark plates to help you recognize a time-loop return.

## Checks

Run `node tests/game.cjs` for regression tests covering directional motion, stopping and camera centering, the straight opening highway, irregular biomes, solid landmarks, pursuit and pathfinding, ten-minute transformation, monster contact, boosts, memory doors, coordinate-preserving loops, and a twelve-minute seeded simulation with retries. These tests simulate the DOM and canvas API; they are not browser play-testing. Native canvas renders separately verify the real creature atlas and terrain.

Creature artwork provenance and the generation prompt are in [assets/monster-art-notes.md](assets/monster-art-notes.md).
