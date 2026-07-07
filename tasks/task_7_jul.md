# HEWER Tasks - 7 Jul

Author: Nitish

## Completed

- [x] Batch terrain-break redraw work so rapid mining or bomb explosions redraw each affected terrain and cave-edge chunk once per frame instead of once per broken tile.
- [x] Verify the terrain-break log reduction pass with `npm run typecheck` only.
- [x] Add a visible mining-instrument loading overlay for boot and run restarts.
- [x] Remove the default missing baked texture-pack request so first load no longer logs `/assets/generated/texture-pack.json` 404.
- [x] Stage GameplayScene startup so world setup and terrain chunk stamping yield across frames instead of holding a black screen.
- [x] Gate procedural audio behind the first user gesture with a local AudioContext so pre-gesture AudioContext warnings do not spam.
- [x] Verify first load, New Run restart, Store resume, and clean warning/error logs in the dev server.
- [x] Verify the black-startup and new-run stall fix with `npm run typecheck` only.
- [x] Start play after only the starter cave terrain chunks are stamped, then stamp far terrain chunks in the background.
- [x] Verify starter-chunk startup optimization on first load and New Run with clean warning/error logs.
- [x] Throttle post-loader background terrain stamping with a longer delay, idle frame budget, movement gate, and interval so the first playable seconds stay responsive.
- [x] Verify the post-loader terrain throttle with `npm run typecheck` only.
- [x] Remove the ore combo counter HUD chip and document that normal play should not show ore or pickup combo counters.
- [x] Verify the combo-counter removal with `npm run typecheck` only.
- [x] Make hostile enemy and boss projectiles damage terrain on impact instead of only playing hit feedback.
- [x] Make Spark Sac explosions apply radial terrain damage while preserving ancient border safety.
- [x] Verify hostile environment damage with `npm run typecheck` only.
