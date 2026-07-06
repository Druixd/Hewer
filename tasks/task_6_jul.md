# HEWER Tasks - 6 Jul

Author: Nitish

## Completed

- [x] Document gameplay-impact, reward-feedback, and danger-cue direction in `design.md`.
- [x] Add simulation state for hit-stop, elite enemies, kill chains, temporary boosts, mining streaks, threat direction, danger swell, and chain bonus credits.
- [x] Implement hit-stop durations for ore breaks, enemy kills, and player damage.
- [x] Add deterministic elite enemy rolls for initial enemies and objective waves, including health/radius scaling, increased damage, bonus drops, and threat scaling.
- [x] Add kill-chain tracking, chain-tier events, chain bonus credit value, and run-summary reporting.
- [x] Add mining streak tracking with magnet and speed reward timers.
- [x] Add near-miss detection for hostile projectiles with a short speed reward.
- [x] Add threat direction calculation and danger-swell event timing.
- [x] Add Phaser feedback for camera punches, pulse rings, elite markers, hull-critical overlay, damage direction flashes, near-miss streaks, chain callouts, minimap threat line, and new audio cues.
- [x] Add compact HUD reward chips and killfeed entries without expanding persistent playfield UI.
- [x] Verify the gameplay impact pass with `npm run typecheck` only.
- [x] Remove arcade combat chain presentation, including triple-kill style callouts, chain HUD, killfeed, and chain credit rewards.
- [x] Recenter reward feedback around ore/mining streaks in the HUD and design direction.
- [x] Fix screen-space threat, hull, and damage direction overlays so they account for camera zoom and fill the viewport.
- [x] Clear threat overlay state after boss defeat.
- [x] Verify the overlay and reward cleanup with `npm run typecheck` only.
- [x] Re-anchor fullscreen Phaser overlays by center with bleed so atmosphere, threat, hull, and hit-direction effects cover top and left viewport edges.
- [x] Convert the base cave backdrop to a fixed fullscreen camera layer so parallax movement cannot expose black strips on the top or left edges.
- [x] Add health and field power drops to the design direction.
- [x] Add repair, coolant, overdrive, and shield-cell pickups with magnet collection, generated art, audio/FX feedback, and ore/enemy/boss drop sources.
- [x] Verify health and power drops with `npm run typecheck` only.
- [x] Add Hewer ship evolution direction to `design.md`.
- [x] Add MK-I Pickaxe, MK-II Lance, and MK-III Titan as generated playable ship textures.
- [x] Add saved ship unlock/equip progress, contract reward unlocks, service-bay ship selection, and ship stat identities.
- [x] Verify playable ship evolution with `npm run typecheck` only.
- [x] Re-sync Hewer ship art with the dark analog mining-game palette, keeping the reference sheet as silhouette inspiration only.
- [x] Verify the ship art sync pass with `npm run typecheck` only.
- [x] Slim Hewer ship silhouettes for a faster sonic feel with sharper noses, swept stabilizers, and less bulky hull mass.
- [x] Verify the slim ship silhouette pass with `npm run typecheck` only.
- [x] Add pickup toast notifications for ore and field power drops.
- [x] Verify pickup toast notifications with `npm run typecheck` only.
- [x] Redesign Hewer ships toward a sleek race-car chassis silhouette instead of a thinner fighter wedge.
- [x] Verify the race-car Hewer silhouette pass with `npm run typecheck` only.
- [x] Redesign Hewer ship art again toward angular manta/delta reference craft with colored top panels, dark under-fins, and centered canopy.
- [x] Verify the angular manta Hewer redesign with `npm run typecheck` only.
- [x] Reduce Hewer ship bulk with tighter wings, smaller fins, slimmer cockpit details, shorter engine trails, and a smaller in-game visual scale.
- [x] Verify the compact Hewer ship pass with `npm run typecheck` only.
- [x] Aggregate repeated pickup toasts by ore or field power type, pulse the existing toast, and update the collected count instead of stacking duplicates.
- [x] Verify aggregated pickup toasts with `npm run typecheck` only.
- [x] Add slight Hewer knockback away from valid attack sources when the ship takes damage.
- [x] Verify damage knockback with `npm run typecheck` only.
- [x] Remove boss-hit time slowdown so attacking Voltrix stays fluid while preserving boss hit feedback.
- [x] Update `design.md` to keep boss-hit pulse/audio feedback without freezing time.
- [x] Verify the Voltrix hit-stop removal with `npm run typecheck` only.
- [x] Add compact enemy takedown toasts with enemy names and repeated-name aggregation.
- [x] Verify enemy takedown toasts with `npm run typecheck` only.
- [x] Remove the duplicate E Store chip beside the minimap and stretch the lower-left action slots to the hull/heat meter width with smaller fitted labels.
- [x] Verify the HUD sizing cleanup with `npm run typecheck` only.
- [x] Remove the duplicate lower-left ore counter row and make visible action slots share the full hull/heat meter width.
- [x] Verify the ore-row removal and action-slot width fix with `npm run typecheck` only.
- [x] Increase lower-left hint key and action label text sizes while keeping the HUD slot footprint unchanged.
- [x] Verify the hint typography update with `npm run typecheck` only.
