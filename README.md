# The Last Drive

A pixel-art motorcycle escape game with smooth scribble-horror creatures.

## Play

Open `index.html` in a modern desktop browser, or use the repository's GitHub Pages deployment when enabled. The game has no build step or external runtime dependencies.

- **WASD / arrow keys:** ride in any direction. Release the keys to stop.
- **Space / Shift:** use a collected boost while holding a direction.
- Head upward along the opening straight highway. After roughly 400 meters, its end opens into the natural world. The bike remains centered on screen.
- Houses, trees, rocks and other substantial scenery are solid. Slide around them; boost does not let you drive through them.
- The woman begins behind you as a person. She takes direct shortcuts and paths around obstacles, catches a stationary rider, and gradually becomes a scribble monster over **ten active minutes**. Memory events pause the world and her transformation.
- Most other monsters begin as ordinary pixel people. Revealed monster contact is fatal; normal pedestrians are harmless.
- Remember the number and choose its matching door. Correct answers recharge your boost.

## World

Persistent, irregular regions extend in every direction: desert dunes and pyramids; jungle temples and pools; houses and fountains in towns; meadow barns and hay bales; snowy cabins and ice; coastal boats and lighthouses. Farther regions become corrupted forest, hollow ruins and monster-world terrain. The starting highway is the only road; outside it you ride through open terrain and natural gaps between solid landmarks. Traffic stays on the highway, while people wander through the world. Regions use a 6,000-unit spacing (six times the previous width), with variable boundaries and sizes rather than fixed distance stages. Stable numbered landmarks make a time-loop rewind recognizable. A loop restores a previous position, not a newly randomized view.

The world is generated from coordinates with a bounded cache. Encounters, pedestrians, traffic, pickups and rewind history are also bounded. There is no final level or forced ending.

## Checks

Run `node tests/game.cjs` for regression tests covering directional motion, stopping and camera centering, the straight opening highway, irregular biomes, solid landmarks, pursuit and pathfinding, ten-minute transformation, monster contact, boosts, memory doors, coordinate-preserving loops, and a twelve-minute seeded simulation with retries. These tests simulate the DOM and canvas API; they are not browser play-testing. Native canvas renders separately verify the real creature atlas and terrain.

Creature artwork provenance and the generation prompt are in [assets/monster-art-notes.md](assets/monster-art-notes.md).
