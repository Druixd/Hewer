# HEWER Tasks - 2 Jul

Author: Nitish

## Completed

- [x] Remove fake-normal relief frames from basalt and ancient cave-mass tiles so terrain stops reading as a square grid while preserving stronger relief on ores and emitted objects.
- [x] Update the lighting design direction to keep fake normals focused on ore, player, pickups, enemies, and other light-bearing elements.
- [x] Further flatten cave-mass mottling after screenshot review so dirt blocks read as continuous terrain instead of repeated cell texture.
- [x] Verify the cave-mass texture change with TypeScript and a browser smoke screenshot without running a production build.
- [x] Update the design direction for semi-open cave runs, darker player-centered exploration, hybrid unlock economy, and completable contracts.
- [x] Extend generated runs into larger branchier cave maps with deeper ore placement and local visibility falloff.
- [x] Add persistent unlock progression for dash, shield, swarm blast, Piercer, and Scatter while preserving old saves.
- [x] Rebalance ore durability by value and make successful extraction the source of banked credits.
- [x] Add shield ability behavior, weapon selection, Phase Mite enemy behavior, and Sentinel contract boss tuning.
- [x] Fix contract progression around gather, bank, craft, boss, and extraction states so tasks can complete and unlock later shop items.
- [x] Update the service bay HUD with unlock purchases, weapon equip controls, shield state, and clearer cargo exchange crediting.
- [x] Verify the semi-open progression pass with TypeScript only, without running a production build.
- [x] Replace Voltrix/Sentinel/Phase Mite line attacks with visible hostile bullet projectiles.
- [x] Hide locked ability controls from the live HUD while keeping unlocks discoverable in the service bay.
- [x] Compact the service bay into tabs for upgrades, unlocks/weapons, and contract/cargo to reduce clutter.
- [x] Increase player-centered darkness and local visibility falloff for stronger cave exploration mood.
- [x] Remove overlapping health/heat number labels from the live HUD and add clearer live contract progress feedback.
- [x] Verify the HUD/combat polish pass with TypeScript only, without running a production build.
- [x] Increase corner darkness and resize the screen-space vignette by viewport diagonal to remove the visible left-side cutoff line.
- [x] Add collision-aware movement for patrol, dash, chase, Phase Mite, and boss movement so enemies stay in navigable cave space instead of passing through solid terrain.
- [x] Add a visible service bay close button and compact local module icons for upgrades, unlocks, and weapons.
- [x] Validate initial, wave, and boss spawns against open collision-clear cave space so enemies do not appear inside non-moveable areas.
- [x] Hide the mission intro banner until real active-task text is rendered so placeholder "Org Order" copy never appears first.
- [x] Tune ore spawn density and hardness around rarity so Ferrite is common/easier, Shimmer moderate, Voltaic rare/tough, and Aetherium very rare/deep/hard.
- [x] Add persistent extracted-ore stockpile and require balanced ore counts plus credits for upgrade purchases.
- [x] Show stockpiled materials and upgrade material requirements in the service bay.
- [x] Make the service bay close button start the next run so closing the post-run upgrade screen returns to active play.
- [x] Add a readable HEWER favicon and document the small-size browser identity direction.
- [x] Add boss-defeat reward ore drops, a defeat confirmation notice, and hide the boss health bar after defeat.
- [x] Fix full-window darkness/canvas coverage and derive aim from current camera screen coordinates so stationary mouse aim does not become a stale world point.
- [x] Add a compact HUD purchase suggestion when a shop unlock or ship upgrade becomes affordable.
- [x] Replace fixed extraction with an anywhere Store shuttle that sells current cargo, opens the service bay, and resumes the same run on close.
- [x] Replace broken CSS upgrade/unlock icon drawings with compact Lucide-style inline SVG icons.
