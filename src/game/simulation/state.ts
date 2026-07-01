import { calculateRunValue, effectiveStats, ensureActiveTask, getActiveTask } from "./systems/progression";
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
  const progress = ensureActiveTask(upgrades);
  const activeTask = getActiveTask(progress);
  const world = createWorld(seed, activeTask?.territory ?? progress.selectedTerritory, activeTask?.mapVariant ?? "ribbon");
  const stats = effectiveStats(progress);

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
      bombCooldown: 0,
      weaponCooldown: 0,
      weaponSpool: 0,
      blastCharges: 3,
      blastRepeatCooldown: 0,
      blastRechargeTimer: 0,
      objectiveWaveCooldown: 0,
      invulnerableTimer: 0,
      collectionPulse: 0
    },
    inventory: createEmptyInventory(),
    upgrades: progress,
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
    projectiles: [],
    bombs: [],
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
    objectiveTargets: [],
    mission: {
      introTimer: 4.2,
      started: false,
      focusedOre: null,
      completedStepCount: 0,
      craftReady: false,
      extractReady: false,
      waveTimer: 0
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

  const voltrixCore = state.boss.defeated;
  const inventory = { ...state.inventory };
  const result = {
    outcome,
    inventory,
    minedBlocks: state.minedBlocks,
    enemiesKilled: state.enemiesKilled,
    duration: state.elapsed,
    creditsEarned: calculateRunValue({ inventory, voltrixCore }),
    voltrixCore,
    taskCompleted: Boolean(state.upgrades.activeTask?.completed),
    activeTaskId: state.upgrades.activeTask?.taskId ?? null,
    bossAchievement: voltrixCore ? "voltrixCore" as const : null
  };

  state.status = outcome;
  state.runResult = result;
  state.beam.active = false;
}
