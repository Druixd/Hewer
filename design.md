# HEWER Game Design

Author: Nitish

## Core Identity

HEWER is a casual sci-fi voxel mining side-scroller set inside the glowing caverns of Merope. The player pilots a compact mining ship through dark, bioluminescent caves, breaking mineral blocks, auto-collecting resources, fighting territorial lifeforms, and completing organization-issued resource and crafting contracts across territories.

The intended feel is casual, juicy, glowy, and readable: flow-state mining interrupted by panic combat. Visuals follow an analog retro space explorer style with space vibes: deep space indigo backdrop, warm star dust, organic geology tile patterns (sediment strata, crystal facets, mineral veins), warm candlelight radial halos instead of neon bloom, and an analog instrument panel HUD with warm cream and copper tones.

## World

Merope is a hollowed-out planet once mined by the Excavants. The launch design includes two territories:

- The Shimmer Veins: crystal/electric caverns ruled by Voltrix.
- The Cinder Hollows: magma/ash caverns ruled by Pyroclast.

The first playable slice implemented The Shimmer Veins only. Post-v0 progression may use an early Cinder Hollows profile for territory variety while full Cinder art, enemies, and Pyroclast remain later scope.

## Progression Direction

HEWER is now past the v0 slice. The main goal is no longer "beat Voltrix." The organization gives the player an active order tied to a territory. Orders ask the player to collect specific mineral amounts and craft named objective items from authored recipes. This gives each run a clear practical purpose even when the boss does not appear.

Bosses are territory achievements. Defeating Voltrix awards the Voltrix Core achievement and bonus value, but it does not replace the active org order and does not automatically complete the run. The player still needs to extract or bank cargo through the normal loop.

The first post-v0 progression pass uses automatic active orders instead of a full mission board. If the player has no active order, the game assigns the next incomplete order from unlocked territories. Completing key orders can unlock additional territories.

Run generation uses the active order as context. Normal runs are seeded from territory, map variant, run serial, and task id so repeated "New Run" starts do not keep loading the same layout. "Same Seed" remains an explicit replay/debug action.

### Shimmer Veins Generation Rules

The moveable area is any generated empty cave tile, including the spawn pocket, main tunnel ribbon, controlled pockets, branches, and vertical faults. Generation should happen in readable passes: build the ancient shell and basalt fill, carve moveable cave space, then place ore against that cave shape.

Ores should feel like exposed veins in the cave wall, not random treasure buried in the center of nowhere. Ore clusters may touch open cave space and may extend 1-4 tile layers into adjacent solid terrain. Ore should not appear as isolated deep-solid noise with no nearby open-space path.

Ore progression in The Shimmer Veins:

- Ferrite: common surface-adjacent clusters, often close to open space.
- Shimmer Crystal: uncommon clusters slightly deeper or farther from spawn.
- Voltaic Dust: rare clusters deeper into walls and farther into the run.
- Aetherium: very rare late-map/deeper clusters only.

## Player

Playable ships are called Hewers.

- MK-I "Pickaxe": balanced starter ship and the only v0 playable ship.
- MK-II "Lance": fast, fragile, high DPS ship for later.
- MK-III "Titan": slow armor/drill ship for later.

Core controls:

- WASD / Arrow Keys: move relative to cursor direction. W/Up moves toward the cursor, S/Down reverses, and A/D or Left/Right strafe.
- Mouse: aim and define forward direction.
- Left Click: fire mining laser / weapon.
- Right Click: throw a burst-cluster swarm bomb toward the cursor. Mini bombs explode on enemy, boss, or wall contact.
- Shift: dash toward the cursor with a long emergency burst.
- Space: toggle laser intensity.

## Mining And Collection

Blocks have durability and break under sustained laser fire. Ore blocks drop mineral pickups that magnetize to the ship inside the magnet radius. Collection should feel fast and satisfying with sparkle trails, ship pulses, and compact inventory feedback.

Core minerals:

- Ferrite: common repair/crafting material.
- Shimmer Crystal: Shimmer Veins uncommon material.
- Cinder Ore: Cinder Hollows later material.
- Voltaic Dust: Shimmer Veins rare material.
- Magma Pearl: Cinder Hollows later material.
- Aetherium: very rare deep material.

Mining heat builds while firing. High intensity mines faster but heats faster. At max heat, the laser overheats and disables briefly.

## Combat And Boss Pressure

Shimmer enemies for launch design:

- Arc Warden: stationary area controller with pulsing electric field.
- Prism Stalker: patrol hunter that dashes when alerted.
- Spark Sac: explosive enemy that approaches and detonates.

Threat builds from mining ore, rare drops, enemy kills, and time spent in a zone. At max threat, Voltrix breaks out and hunts the player. Full Voltrix has burrow/lightning phases; the v0 implementation uses a simplified segmented chase boss with lightning bursts.

The combat feel should lean slightly more bullet-hell-like than the first slice: enemies appear in denser, less predictable pockets, the player has a longer dash to cut through pressure, and right click provides a burst-cluster swarm bomb for clearing immediate threats. The swarm bomb should feel like warm emitted energy: bright cores, additive halos, fast sparks, and impact shake, not a translucent sprite fade.

## Base Loop

Between runs, the player sees a compact run summary, sells collected minerals, and buys visible ship upgrades. The first slice keeps this as a DOM post-run screen with local save data:

- Laser Power
- Heat Sink
- Magnet Radius
- Hull
- Engine

Mission board, market saturation, ship bay cosmetics, and complex crafting are later scope.

## Playable Slice v0

The v0 target was a playable Shimmer Veins slice, not the full launch MVP. Current work is post-v0 and starts adding the real progression frame around that slice.

Included:

- Phaser + TypeScript + Vite app.
- Seeded Shimmer Veins cavern generation.
- Procedural pixel/voxel sprites and generated texture manifest.
- MK-I movement, mouse aim, mining laser, heat, overheat, Shift dash, and right-click swarm bomb.
- Destructible blocks with Ferrite, Shimmer Crystal, Voltaic Dust, and rare Aetherium drops.
- Pickup magnetization and inventory HUD.
- Arc Warden, Prism Stalker, and Spark Sac enemy prototypes.
- Hidden threat simulation with readable ambient danger cues.
- Voltrix-lite segmented breakout encounter.
- Run summary and localStorage upgrades.

Original v0 out of scope:

- Cinder Hollows and Pyroclast.
- MK-II and MK-III ship unlocks.
- Full mission board.
- Complex/procedural crafting recipes.
- Market saturation.
- Cave-in simulation.
- Imported or generated bitmap sprite sheets.
- Production build or deployment.

## Post-v0 Progression Slice

Included now:

- Auto-assigned org orders.
- Persistent task progress.
- Authored collect-and-craft recipes.
- Territory-specific run context.
- Shimmer Veins and an early Cinder Hollows territory profile.
- Boss achievements separated from task completion.
- Fresh run seeds based on territory, map variant, run serial, and task id.

Still later scope:

- Player-selected mission board.
- Narrative contract chains.
- Full Cinder Hollows art, enemies, and Pyroclast encounter.
- Market saturation and advanced economy pressure.

## UX Direction

The game should prioritize playfield readability. Persistent UI stays compact, mostly in the lower-left and edge zones. The center and lower-middle playfield should stay clear during normal play. Menus and run summaries are DOM overlays that appear only when the run is paused or finished.

The main camera should keep the player centered with a slight delayed follow. It should not use aim look-ahead or offsets during normal play because aiming, mining, and HUD readability depend on a stable center point.

The minimap is a local navigation instrument, not a full level map. It should stay player-centered, show only nearby movable-area edges and in-range tactical markers, and avoid revealing the complete cave layout. Compass labels should not appear unless the game adds a real north/orientation system.

The visual target is not a generic dashboard. The HUD should feel like functional mining ship instrumentation: compact bars, mineral counters, small state readouts, and restrained transitions. Strong motion is reserved for danger, impact, mineral collection, boss breakout, and rewards.

The cave should not read as fully visible at all times. Keep the far environment dark, use local visibility around the player, and make important ores, enemies, bombs, and hazards read through additive emission-style glow. Avoid relying on sprite opacity as the primary lighting language.

Player movement trails should read as clean velocity-aligned energy streaks, not smoke or expanding bubble particles. The trail should stay thin, readable, and attached to ship motion so it supports speed feedback without covering cave detail.
