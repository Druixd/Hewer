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

Bosses are territory achievements. Defeating Voltrix awards the Voltrix Core achievement and bonus value, but it does not replace the active org order and does not automatically complete the run. The player still needs to call Store and bank cargo through the normal loop.

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

Hewer visuals should evolve as a readable top-down modular ship family, but external spaceship sheets are silhouette reference only. In-game ships should read as compact sleek angular manta/delta craft rather than large or bulky fighters: swept wings kept tight to the body, dark underside fins, colored top panels, a centered cyan canopy, sharp drill-nose directionality, warm cream edge plating, and compact rear engine machinery. MK-I Pickaxe uses teal/copper mining panels, MK-II Lance is the sharpest gold/cyan high-speed silhouette, and MK-III Titan uses violet/magenta armored panels while staying streamlined. MK-II is rewarded by completing the Relay Frame contract, and MK-III is rewarded by completing the Voltaic Keystone contract.

Core controls:

- WASD / Arrow Keys: move relative to cursor direction. W/Up moves toward the cursor, S/Down reverses, and A/D or Left/Right strafe.
- Mouse: aim and define forward direction.
- Left Click: fire mining laser / weapon.
- Right Click: throw a burst-cluster swarm bomb toward the cursor. Mini bombs explode on enemy, boss, or wall contact.
- Shift: dash toward the cursor with a long emergency burst.
- Space: toggle laser intensity.

## Mining And Collection

Blocks have durability and break under sustained laser fire. Ore blocks drop mineral pickups that magnetize to the ship inside the magnet radius. Collection should feel fast and satisfying with sparkle trails, ship pulses, and compact inventory feedback.

Some drops are field support pickups instead of cargo. Repair packs restore hull, coolant cells dump heat and clear overheat, overdrive cells briefly improve weapon tempo/output, and shield cells refill shield capacity and reduce shield downtime. These should stay rarer than ore and read as emergency survival tools, not as a second currency. They use the same magnet behavior as ore pickups so collection remains fast and readable.

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

When Store is called, the player sees a compact service-bay summary, sells collected minerals, and buys visible ship upgrades without leaving the current cave. The first slice keeps this as a DOM service screen with local save data:

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

Performance should protect playability before decoration. On older devices the game may reduce decorative glow intensity, particle burst counts, movement trail frequency, minimap refresh cadence, and other nonessential atmosphere, but mining feedback, enemy readability, pickups, collision, objective guidance, HUD state, and the F3 FPS display must remain clear and responsive.

Browser identity should follow the same readable mining-instrument language. The favicon should stay legible at small tab sizes, use the HEWER mark or initial clearly, and pull from the dark hull, warm cream, copper, and cyan accent palette rather than decorative detail.

The cave should not read as fully visible at all times. Keep the far environment dark, use local visibility around the player, and make important ores, enemies, bombs, and hazards read through additive emission-style glow. Avoid relying on sprite opacity as the primary lighting language.

Lighting should fake depth before attempting expensive true normal-map rendering. The first lighting pass uses a player-centered visibility falloff, additive light blooms from pickups/enemies/projectiles/bombs/objective cues, and procedural relief only where it improves readability: ore facets, player/emitted objects, cracked-tile hot edges, and other light-bearing elements. Plain basalt and ancient cave mass should avoid per-tile normal frames because they make the level read as a square grid; terrain mass should stay low-contrast, softly mottled, and readable mainly by its outer cave edges. Real shader normal maps remain later scope only if the cheaper visual language is not enough.

Player movement trails should read as clean velocity-aligned energy streaks, not smoke or expanding bubble particles. The trail should stay thin, readable, and attached to ship motion so it supports speed feedback without covering cave detail.

Terrain tiles should move toward the generated dark sci-fi tileset direction: compact black-core blocks with luminous material edges, readable destructible damage, and distinct ore identities. Shimmer Veins terrain uses purple-blue ancient/cave blocks, cyan crystal fractures, electric voltaic seams, warm gold ferrite veins, and magenta organic aetherium hazards. Early Cinder Hollows terrain can reuse the same block IDs with red-orange cinder shell styling for basalt and ancient blocks until full Cinder-specific resources exist.

## Gameplay Impact, Reward Feedback, And Danger Cues

Impact feedback should make mining and combat feel heavier without hiding the playfield. Short hit-stop, camera punches, pulse rings, bursts, and warm low-pitch audio are reserved for meaningful events: ore breaks, enemy kills, player damage, chain thresholds, and boss-pressure spikes. Boss hits should keep audio, pulse, and camera feedback without freezing time so sustained Voltrix attacks stay fluid. When the Hewer takes a valid attack, it should receive a slight velocity push away from the attack source so damage has physical read without stealing control. Routine projectile impacts can stay small.

Reward feedback should remain compact, stateful, and mining-led. Material progress may surface through objective chips, cargo readouts, and compact collection toasts, but ore or pickup combo counters should stay out of normal play. Enemy takedowns may show a compact named toast, but broad combat callouts, killfeed entries, and arcade kill-chain language should stay out of the normal mining loop. Contract material counts remain the clearest reward signal.

Repeated collection feedback for the same ore or field pickup should update one existing toast with a refreshed count and a short pulse instead of stacking duplicate rows. The player should read this as an instrument counter changing, not as a feed of repeated receipts.

Danger feedback should give the player anticipation and recovery reads. Low hull uses a red screen-space pressure overlay and heartbeat pulse, damage flashes from the incoming side, near misses create a short movement reward, and high threat points the local radar toward the likely boss approach. These cues should intensify the survival-space tone while staying readable on mobile and desktop.

## Mission Direction, Combat Feel, And Audio Rework

The active org order should feel like a field mission in a survival space adventure, not a resource checklist. A new run opens with a non-pausing mission banner that announces the territory, order, required materials, and first action. After the intro collapses, a compact objective preview remains on-screen with the current objective and small material progress marks. The persistent HUD should behave more like GTA or Far Cry objective guidance than an inventory receipt.

Mission-relevant ore should be discoverable without revealing the full map. When an order asks for an ore, nearby relevant clusters may receive a warm pulse or outline while they are visible or near the player. The highlight is guidance, not a wallhack: it should help the player understand what to mine without flattening exploration.

The primary weapon changes from a continuous laser beam to a tactile drill-shot weapon. Left click fires single shots; holding fire ramps the cadence over a short spool window until it reaches a fast arcade rhythm. Shots mine tiles and damage enemies through impact events, sparks, short hit-stop, and chunk feedback. Space/intensity is no longer a core visible mode for this pass.

Right click becomes a three-charge blast system. Each click spends one charge and fires the existing swarm-style blast after a short repeat gate. When all charges are spent, one longer recharge restores all three charges at once. The HUD should show three clear charge pips and the recharge state.

Mining mission-relevant ore should trigger authored pressure. Small swarms spawn near valid offscreen/open-space positions while the player is working the objective. The pressure should create survival adventure tension without constant flooding or unfair spawn damage.

Audio should stop sounding robotic or aggressively sci-fi. The target is warm survival space adventure: low thumps, muffled metal impacts, soft mineral chimes, thruster whooshes, distant cave rumble, and non-melodic danger swells. Procedural WebAudio should be the main feedback layer, with short tails, lower pitch, small random variance, and per-cue cooldowns. Existing CC0 files may remain as fallback assets, but they should not define the main moment-to-moment sound.

The post-run upgrade menu should become a visual ship bay. The player should see the ship silhouette and five upgrade nodes around it for weapon output, fire control/cooling, magnet, hull, and engine. Buying or previewing an upgrade should show before/after bars and a short pulse on the affected ship area instead of relying on text-heavy buttons.

The same cockpit service-bay language should extend to crafting and selling. After Store docks, the player should read the screen as a ship console: a left bank/cargo column, a main services board, and clear category rails for upgrades, workshop/crafting, and cargo exchange. Upgrades keep the ship-node layout. Crafting uses a modified workshop panel that shows the current order recipe, required material sockets, readiness, and a single craft action. Selling/banking uses a cargo exchange panel that shows stored cargo value, account balance, and the already-banked result without implying a second manual sell step.

## Cave Readability And Minimal HUD Pass

The HUD should prioritize art and state over text. Objective requirements, cargo readouts, mission intro materials, crafting sockets, and exchange rows should show the actual ore/pickup artwork with compact counts instead of letter placeholders. Text should be limited to the current objective, score/value, and necessary action prompts.

Ore color identity must be consistent from world tile to glow to pickup art to HUD icon. Ferrite reads warm gold, Shimmer reads violet crystal, Voltaic reads cyan/green electric mineral, and Aetherium reads magenta/pink. Any generated glow or impact cue should use the same family as the material it represents.

Breakable cave tiles should stop reading as a visible square grid. Solid terrain remains tile-based internally, but the art should read as underworld space cave mass: dark basalt/ancient chunks with irregular silhouettes, low-contrast internal texture, soft edge scars, and ore embedded into the rock. Avoid repeated nested square outlines on every breakable tile.

Normal gameplay UI should be stripped back. Keep a small objective chip, compact hull/heat strips, art-based cargo row, blast/dash/store controls, score, boss bar, Store prompt, and minimap. Remove redundant territory/order labels from persistent HUD where the current objective and icon progress already communicate the mission.

## Semi-Open Progression, Unlocks, And Contract Fix Pass

Runs should now feel semi-open instead of like a fully visible fixed-size level. The first version keeps one generated map loaded per run, but makes that map larger, branchier, and deeper. Streaming chunks are later scope. The Shimmer Veins should support long side pockets, vertical faults, deeper ore bands, and late-run boss pressure while keeping spawn readable near the starting pocket.

The cave should be darker. The player ship is the primary readable light source: nearby walls, ore, enemies, pickups, hazards, and objective highlights remain readable, while distant terrain falls into darkness. The minimap stays local and player-centered and must not reveal the whole run.

Mining durability should follow ore value. Ferrite breaks quickly, Shimmer takes longer, Voltaic is meaningfully tough, and Aetherium is the slow rare target. Basalt should stay usable for traversal; ore hardness should create progression pressure without making basic cave movement tedious.

The economy shifts from only stat upgrades to hybrid unlock progression. The player stores mineables through the summoned Store shuttle, cargo exchange banks the value into credits, and the service bay sells meaningful modules. The default ship starts with only the basic drill-shot. Dash, shield, and right-click swarm blast are unlockables. Stronger weapon modules and boss-tier tools can be gated by completed contracts before they become purchasable.

The first complete unlock tier includes:

- Dash Module: restores the existing emergency dash after purchase.
- Shield Emitter: adds a short defensive shield with its own cooldown and break state.
- Swarm Blast: unlocks the existing right-click burst swarm.
- Piercer weapon: a slower, harder-hitting drill-shot for tough ore and armored targets.
- Scatter weapon: a close-range multi-shot weapon for pressure clearing.

Contracts replace weak checklist-style tasks. A contract has explicit steps: gather required ore, Store/bank the required materials into contract storage, craft the required item if needed, defeat a boss if required, then Store/finalize completion. Progress must persist after Store, crafting, and boss events. HUD guidance should always show the next practical step, and the service bay should show missing materials, craft readiness, boss requirements, and completion state.

Combat growth should be focused, not broad prototype sprawl. Add one more complex enemy archetype and one additional boss for this pass, with config and progression structures ready for more later.

The first polish pass after unlocks should remove beam-like enemy/boss attacks. Voltrix, Sentinel-style bosses, and Phase Mites should fire visible projectile bullets/orbs with readable travel time instead of instant line strikes. Persistent controls should only show tools the player actually owns, with unavailable modules discoverable in the service bay. The service bay should be compact and tabbed: upgrades, unlocks/weapons, and workshop/cargo must be separate views instead of one tall cluttered page. Task HUD feedback should show live progress and a short completion pulse when a contract part finishes.

The screen-space darkness must cover the full viewport without visible texture cut lines. Use an oversized diagonal-fit vignette so corners darken consistently on wide screens and no left/right strip appears outside the overlay.

Enemies should obey cave collision and movement physics. Patrol, chase, dash, and boss movement must resolve against solid tiles instead of passing through terrain; wall hits should stop, bounce, or redirect the enemy depending on behavior. Enemies actively chasing the player should use tile-aware pathfinding when the direct route is blocked, steering through navigable cave openings instead of pushing into terrain. Enemy projectiles may collide with terrain, but enemy bodies should remain in navigable cave space.

Initial run generation should guarantee a small nearby starter enemy pocket after validating open, collision-clear cave space. The larger procedural enemy distribution can still place deeper pockets, but the player should not need to cross a large dark map before seeing any hostile life.

The service bay must have a visible close control and every purchasable module should have a compact visual icon. Use local icon shapes or existing generated art first; online image assets are not required for the current HUD scale.

Closing the post-run service bay should return the player to active play by starting the next run. It should not merely hide the panel because the previous run is already finished and cannot resume.

Enemy and boss spawns must validate open, collision-clear cave space before placement. Clamped coordinates are not enough; boss breakout should search around the player for a valid open pocket and fall back to spawn only if no valid combat space exists.

Mission intro banners should never show placeholder copy. Keep the banner hidden until the active task, territory, material list, and first action text have been rendered.

Ore and upgrade economy should be material-driven as well as credit-driven. Stored ore enters a persistent stockpile. Upgrade purchases require credits plus authored ore counts: early levels lean on Ferrite and small Shimmer amounts, mid levels introduce Voltaic, and late levels can require Aetherium. Ore generation density should follow rarity, with Ferrite common and easy, Shimmer moderate, Voltaic rare/tough, and Aetherium very rare/deep/hard.

Boss defeat should feel resolved immediately. When a boss dies, its health bar must disappear, a short on-screen confirmation should name the defeated boss, and the cave should drop valuable reward ore at the boss position so victory feeds the same cargo/extraction economy.

Mouse aim must be derived from the current screen pointer through the active main camera every frame. Do not rely on cached pointer world coordinates, because the player-follow camera moves while the mouse can stay still; stale world aim makes the ship chase an old point and causes movement jitter.

When the player has enough banked credits and materials for an upgrade or enough credits for a shop unlock, the HUD should surface one compact purchase suggestion. The prompt should name the highest-priority available item, such as "Dash Module available to unlock", and point the player toward the service bay without covering the center playfield.

The fixed extraction point is replaced by an on-demand Store call. Pressing Store summons a small service shuttle near the player, sells the whole current cargo load into account credit and persistent material stock, and opens the service bay over the paused current run. Closing that service bay resumes the same cave instead of forcing a new run. Destroyed runs can still use the same service bay shell, but close/new-run behavior remains run-ending.

Upgrade and unlock icons should use reliable SVG icon markup in the HUD, following a Lucide-style stroke language, instead of fragile CSS pseudo-element drawings. Icons must stay readable at the compact service-bay size and should map clearly to weapon output, cooling, cargo magnet, hull, engine, dash, shield, swarm, piercer, scatter, and drill shot.
