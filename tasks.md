# Tasks

## 2026-07-06
- Investigated low FPS during gameplay.
- Culled distant terrain sprites and cave-edge graphics outside local visibility.
- Throttled local visibility refreshes and reduced ore glow rendering in low-quality mode.
- Fixed gameplay rendering at Q1 while adding internal adaptive render cadence.
- Removed per-ore radial glow sprites and tightened terrain culling to the camera view.
- Tuned Phaser WebGL settings for high-performance GPU preference and larger batches.
- Added an F3 frame-phase profiler for simulation, terrain, actor sync, minimap, events, and HUD timing.
- Replaced per-tile terrain images with cached render-texture terrain chunks.
- Restored ore glow using a capped reusable additive glow pool.
- Added baked generated texture-pack loading with procedural fallback.
- Added a browser bake mode for exporting stable procedural textures as `texture-pack.json`.
- Fixed intrusive F3 profiler text and removed chunk-level terrain fade rectangles.
- Reduced simulation cost with far-enemy sleep, lower chase pathfinding budget, and coarser objective target caching.
- Reworked ore glow pooling to prioritize nearby and mission-relevant ore.
- Replaced filled objective highlight boxes with subtle additive brackets and glints.
- Reverted the oversized terrain cache attempt and restored the stable chunked glow alignment path.

## 2026-07-02
- Reworked mobile market research around unexplored, winnable F2P opportunities.
- Updated the main recommendation toward casual extraction mining for HEWER.
- Replaced the ten-option report with ranked opportunities, risks, and source links.
- Corrected the mobile market reports to be standalone research rather than HEWER-specific analysis.
