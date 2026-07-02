# HEWER Prototype Report

Author: Nitish

## Bottom Line

HEWER is a playable browser prototype about mining under pressure. The player pilots a compact ship through dark voxel caverns, cuts ore out of the walls, survives hostile cave life, calls Store to bank cargo, and turns that run value into contracts, crafting, upgrades, and unlocks.

The important part is not that HEWER has mining and combat. Plenty of games do. The useful hook is that both verbs feed the same decision: **push deeper for better progress, or bank now before the cave pushes back**.

This report treats the current project as the prototype subject only. It does not propose code changes.

## Pitch

HEWER is a casual sci-fi mining action game set inside Merope, a hollow planet full of bioluminescent caverns, territorial creatures, and organization-issued extraction contracts.

The player is not a fantasy hero clearing rooms. They are an operator doing dangerous field work. Every run asks a practical question: can you gather the materials, survive the pressure, and get the cargo into the system before the cave turns hostile?

The prototype already has the right base tension:

- **Mining creates value.** Ferrite, Shimmer, Voltaic, and Aetherium feed credits, stockpile, crafting, and upgrades.
- **Mining creates risk.** Ore value and cave time increase threat, enemy pressure, and boss escalation.
- **Store creates relief.** The player can call Store, bank cargo, check contracts, craft, and upgrade.
- **Contracts create purpose.** Runs are not only about wandering or boss hunting; they have a current task with material and crafting targets.

The day-1 hook is clear: **mine, survive, call Store, and watch the contract system turn one run into lasting ship progress**.

## Core Loop And First Session

The first session starts with an active org order rather than a blank sandbox. That matters because a first-time player needs a reason to care about the ore in front of them.

The practical loop is:

1. Enter a generated cave tied to the active territory, map variant, run serial, and task id.
2. Navigate with mouse-aimed ship movement.
3. Fire drill shots into terrain, enemies, and bosses.
4. Break ore tiles and collect magnetized pickups.
5. Manage hull, heat, visibility, enemy pressure, and threat.
6. Call Store with `E` when cargo or task progress is worth protecting.
7. Bank cargo into credits and persistent stockpile.
8. Craft contract items, buy upgrades, unlock modules, or equip weapons in the service bay.
9. Resume the run or start another run with stronger long-term state.

The run is not only a score chase. It has **field work, extraction, and service-bay decisions**. That gives the prototype a stronger shape than a pure arena survival test.

### First-Session Read

A good first session should teach five things without heavy explanation:

- Ore is the player's first visible reward.
- Enemies are not random interruptions; they are the cost of staying active in the cave.
- Store is the safety valve and progression bridge.
- Contracts define the next useful thing to do.
- Ship upgrades and unlocks make the next run feel different.

The edge case: bosses should not steal the whole identity. HEWER currently frames bosses as achievements and pressure spikes inside the contract economy, not as the only reason to play. That is the correct hierarchy for this prototype.

## Progression And Metagame

HEWER's progression works because it has three layers that feed each other without becoming the same system.

### Contract Progression

Org orders ask for authored material amounts and crafted objective items. Current examples include Relay Frame, Voltaic Keystone, and Cinder Brace style orders. These tasks give each run a reason to exist beyond raw money.

The useful design move is persistence. Materials, crafting, boss events, and extraction state can matter across Store visits. A run can be partial but still meaningful.

### Ship Progression

Credits and stockpiled ore buy upgrades:

- Weapon Output
- Fire Control
- Cargo Magnet
- Hull
- Engine

This is a clean stat layer because each upgrade maps to a felt run problem. You mine faster, fire longer, collect wider, survive more pressure, or move better.

### Module And Weapon Progression

Unlocks add new verbs:

- Dash Module
- Shield Emitter
- Swarm Blast
- Piercer Weapon
- Scatter Weapon

This is stronger than only raising numbers. A new module changes how the player handles danger. The design risk is unlock overload, but the current service-bay structure gives the prototype a readable place to reveal these tools.

## Monetization Direction

HEWER fits best as a premium indie game or paid early-access project, not as a friction-heavy free-to-play economy.

The reason is mechanical. The core loop already depends on mining, banking, stockpile, crafting, and upgrade pressure. If the game sells relief from that pressure, it risks turning its best tension into a payment problem.

A cleaner commercial model:

- Paid base game.
- Early access during contract, territory, boss, and progression tuning.
- Optional soundtrack, art book, or cosmetic DLC later.
- Optional ship skins, HUD themes, or non-power visual packs if the game grows.

Avoid:

- Paid ore boosters that collapse the mining loop.
- Energy timers that block the run loop.
- Paid revives that make danger feel negotiable.
- Loot boxes for core ship power.

The principle is simple: **monetize ownership and identity, not progression relief**.

## AI Usage

The current prototype should describe AI as a production support tool, not a runtime feature.

Runtime behavior is authored and systemic: procedural cave generation, enemy movement, threat escalation, generated textures, WebAudio-style feedback, contracts, upgrades, and save progression are code-driven. That distinction matters because HEWER's feel depends on predictable rules. The player learns the cave by reading systems, not by guessing what a model might do next.

AI can still support production:

- design drafting and critique
- report writing
- UX review
- content ideation
- implementation iteration
- reference synthesis

The boundary is important. Use AI to accelerate development, but keep the shipped game legible, deterministic, and tunable.

## Shipping Strategy

The right shipping message is not "full game." It is **playable systems prototype**.

The current build can be positioned as a browser prototype that proves the core:

- Phaser + TypeScript + Vite runtime
- dark sci-fi cavern playfield
- mining and pickup economy
- projectile combat
- threat escalation and boss pressure
- Store banking
- service-bay upgrades and unlocks
- contracts, materials, crafting, and local progression

The next public-facing milestone should sell the loop, not the roadmap. A player should understand within minutes that the game is about extracting value under pressure.

Recommended release framing:

- Platform: web prototype.
- Save model: local browser progress.
- Scope: focused playable slice, not content-complete launch.
- Promise: mine, survive, bank, upgrade, repeat.
- Constraint: do not overpromise full territory count, boss roster, economy complexity, or platform support.

The failure state is breadth inflation. If the prototype tries to look like a full live product too early, the core loop becomes harder to read.

## Reference Games

HEWER sits between mining progression, survival pressure, and arcade combat. These references help explain its edges:

- **SteamWorld Dig / SteamWorld Dig 2:** mining, return rhythm, and upgrade pressure.
- **Motherload / Super Motherload:** readable mineral economy and "one more haul" extraction tension.
- **Dome Keeper:** mining decisions under time pressure, with danger pulling the player back.
- **Deep Rock Galactic: Survivor:** compact mission pressure, mining/combat blend, and escalating cave hostility.
- **Noita:** procedural cave danger and material readability, though HEWER is more directed and accessible.
- **Terraria:** mining as progression fuel, but HEWER compresses the session into an arcade extraction loop.

HEWER should not copy any one of these. Its own angle is the Store-centered loop: **mine in the field, bank through a service bay, and convert messy cave pressure into practical contract progress**.

## Sources And Local References

- Project design: [design.md](../design.md)
- Content configuration: [src/game/content/config.ts](../src/game/content/config.ts)
- Simulation types: [src/game/simulation/types.ts](../src/game/simulation/types.ts)
- HUD/service bay implementation: [src/ui/hud/HudController.ts](../src/ui/hud/HudController.ts)
- Tech stack: [package.json](../package.json)
- Deep Rock Galactic: Survivor official Steam page: [store.steampowered.com](https://store.steampowered.com/app/2321470/Deep_Rock_Galactic_Survivor/)
- Dome Keeper official Steam page: [store.steampowered.com](https://store.steampowered.com/app/1637320/Dome_Keeper/)
- SteamWorld Dig 2 official Steam page: [store.steampowered.com](https://store.steampowered.com/app/571310/SteamWorld_Dig_2/)
