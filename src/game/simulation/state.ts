import { calculateRunValue, effectiveStats } from "./systems/progression";
import type { GameState, InventoryState, RunOutcome, UpgradeState } from "./types";
import { createInitialEnemies, createWorld } from "./world";

export function createEmptyInventory(): InventoryState {
  return {
    ferrite: 0,
    shimmer: 0,
    voltaic: 0,
    aetherium: 0
  };
}

export function createGameState(seed: string, upgrades: UpgradeState): GameState {
  const world = createWorld(seed);
  const stats = effectiveStats(upgrades);

  return {
    world,
    player: {
      x: world.spawn.x,
      y: world.spawn.y,
      vx: 0,
      vy: 0,
      angle: 0,
      hull: stats.maxHull,
      maxHull: stats.maxHull,
      heat: 0,
      overheatedTimer: 0,
      miningIntensity: "low",
      dashCooldown: 0,
      invulnerableTimer: 0,
      collectionPulse: 0
    },
    inventory: createEmptyInventory(),
    upgrades,
    stats,
    threat: {
      value: 0,
      max: 100,
      mood: "quiet",
      zoneTimer: 0
    },
    enemies: createInitialEnemies(world),
    pickups: [],
    hazards: [],
    boss: {
      active: false,
      defeated: false,
      health: 420,
      maxHealth: 420,
      x: world.spawn.x + 720,
      y: world.spawn.y - 120,
      vx: 0,
      vy: 0,
      cooldown: 2.6,
      segments: []
    },
    beam: {
      active: false,
      x1: 0,
      y1: 0,
      x2: 0,
      y2: 0,
      heat: "low",
      hitKind: "none"
    },
    events: [],
    status: "playing",
    runResult: null,
    elapsed: 0,
    minedBlocks: 0,
    enemiesKilled: 0
  };
}

export function finishRun(state: GameState, outcome: RunOutcome): void {
  if (state.status !== "playing") {
    return;
  }

  const voltrixCore = outcome === "victory";
  const inventory = { ...state.inventory };
  const result = {
    outcome,
    inventory,
    minedBlocks: state.minedBlocks,
    enemiesKilled: state.enemiesKilled,
    duration: state.elapsed,
    creditsEarned: calculateRunValue({ inventory, voltrixCore }),
    voltrixCore
  };

  state.status = outcome;
  state.runResult = result;
  state.beam.active = false;
}

