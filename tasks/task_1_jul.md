# HEWER Tasks - 1 Jul

Author: Nitish

## Completed

- [x] Update the design doc for Shift dash, right-click swarm bombs, denser combat pressure, and local emitted lighting.
- [x] Move dash to Shift and triple the base dash distance.
- [x] Implement right-click burst-cluster swarm bombs with collision explosions and boss/enemy damage.
- [x] Increase enemy density and make seeded enemy placement less predictable while protecting the spawn area.
- [x] Add player-centered emitted light, bomb cores, additive glow pulses, and darker far-cave presentation.
- [x] Make swarm bomb explosions damage nearby destructible environment tiles and trigger normal ore drops.
- [x] Run TypeScript verification without running a production build.
- [x] Limit the mining laser endpoint to the cursor while preserving earlier collision hits.
- [x] Fix the post-run summary controls by keeping the panel DOM stable, aligning extract prompt behavior, and correcting HUD control labels.
- [x] Fix invisible enemies and Voltrix-lite after New Run by clearing scene render caches before each restarted run.
- [x] Update the design doc for post-v0 org tasks, territory progression, boss achievements, and task-based run seeds.
- [x] Add persistent active org tasks, authored collect-and-craft recipes, crafted items, boss achievements, unlocked territories, and run serial migration.
- [x] Make normal runs seed from territory, map variant, run serial, and active task while keeping Same Seed as explicit replay.
- [x] Add Shimmer Veins and early Cinder Hollows territory profiles with map variant generation changes.
- [x] Show compact active task progress in the HUD and separate cargo, task progress, crafting, and boss achievements in the run summary.
- [x] Make Voltrix defeat award an achievement/core without automatically ending the run.
- [x] Run TypeScript verification without running a production build.
- [x] Smoke test the dev server with system Chrome for canvas render, active task display, and progression helper behavior.
- [x] Replace the player smoke trail with a thin velocity-aligned line trail and document the trail direction.
- [x] Fix territory progression crash by filtering legacy saved territories and falling back to Shimmer Veins for invalid territory or map variant data.
- [x] Stop Voltrix from respawning after defeat by gating breakout on undefeated boss state and reducing threat pressure after the achievement kill.
- [x] Implement generated tileset direction with territory-aware procedural tile textures and cracked variants.
- [x] Update the design doc for guided order flow, action feedback, mood states, intensity feedback, and CC0 audio direction.
- [x] Replace flat order progress with next-action HUD guidance and structured task steps in the HUD and run summary.
- [x] Reduce empty-cave grid readability by replacing the full-screen cavern grid with sparse cavern dust and local glow cues.
- [x] Add event-driven action feedback for mining, pickups, task progress, intensity toggles, combat, bombs, overheat, boss states, crafting, and extraction cues.
- [x] Add Kenney CC0 sci-fi audio assets, Phaser preload keys, throttled SFX playback, and mood ambience layers gated behind user audio unlock.
- [x] Run TypeScript verification without running a production build.
- [x] Smoke test the dev server with system Chrome for canvas render, task guidance, mobile HUD spacing, and intensity toggle behavior.
- [x] Update the design doc for survival space adventure mission direction, projectile drill-shot combat, blast charges, procedural warm audio, pressure waves, and visual ship bay upgrades.
- [x] Add mission intro and objective preview HUD flow with relevant ore target highlighting and objective state events.
- [x] Replace the continuous mining laser with ramping projectile drill shots that mine tiles, hit enemies, and trigger impact feedback.
- [x] Rework right-click swarm bombs into a three-charge blast system with short repeat gating and full-charge recharge timing.
- [x] Add mission-relevant ore pressure waves that spawn short enemy bursts near valid open-space positions.
- [x] Replace harsh sample-driven gameplay feedback with warmer procedural WebAudio cues and restrained mood rumbles.
- [x] Rework the run summary upgrades into a visual ship bay with upgrade nodes, ship silhouette, and before/after bars while keeping save data compatible.
- [x] Run TypeScript verification without running a production build.
- [x] Smoke test the dev server with system Chrome for mission overlay, projectile/blast HUD behavior, desktop render, and narrow viewport layout.
- [x] Extend the design doc for a cockpit service-bay upgrade, workshop/crafting, and cargo exchange direction.
- [x] Rework the post-run summary into a service console with a bank column, upgrade category rail, workshop material sockets, and cargo exchange readout.
- [x] Verify the service console with TypeScript and Chrome desktop/mobile smoke testing without running a production build.
- [x] Remove unused sample audio preload references and delete the unused public audio asset folder after moving gameplay feedback to procedural WebAudio.
- [x] Redesign the in-run HUD toward minimal art-first objective/cargo chips, align ore glow colors, and soften breakable tile textures toward underworld cave mass instead of visible grid tiles.
- [x] Add parallax space-cave layers, brighter tile contrast, deterministic tile variants, readable mission frames, and stronger run-seed cave variation.
- [x] Remove random parallax glare blobs, brighten cave contrast, add readable wall edge outlines, and reduce player/ore glow washout.
