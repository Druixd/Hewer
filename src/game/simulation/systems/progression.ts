import {
  BASE_STATS,
  BOSS_ACHIEVEMENTS,
  CRAFT_RECIPES,
  ORE_CONFIG,
  ORG_TASKS,
  TERRITORY_CONFIG,
  UPGRADE_CONFIG,
  upgradeCost
} from "../../content/config";
import type {
  ActiveTaskState,
  BossAchievementId,
  EffectiveStats,
  InventoryState,
  ObjectiveItemId,
  OreId,
  OrgTask,
  RunResult,
  TerritoryId,
  UpgradeId,
  UpgradeState
} from "../types";

const STORAGE_KEY = "hewer.progress.v0";

function emptyInventory(): InventoryState {
  return {
    ferrite: 0,
    shimmer: 0,
    voltaic: 0,
    aetherium: 0
  };
}

export function createDefaultProgress(): UpgradeState {
  return {
    credits: 0,
    laserPower: 0,
    heatSink: 0,
    magnetRadius: 0,
    hull: 0,
    engine: 0,
    totalRuns: 0,
    totalMined: 0,
    voltrixCores: 0,
    runSerial: 0,
    selectedTerritory: "shimmerVeins",
    unlockedTerritories: ["shimmerVeins"],
    activeTask: null,
    completedTasks: [],
    craftedItems: {},
    bossAchievements: []
  };
}

export function loadProgress(): UpgradeState {
  const fallback = createDefaultProgress();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<UpgradeState>;
    return normalizeProgress(parsed);
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: UpgradeState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(progress)));
}

export function normalizeProgress(progress: Partial<UpgradeState>): UpgradeState {
  const fallback = createDefaultProgress();
  const unlockedTerritories = (progress.unlockedTerritories?.length ? progress.unlockedTerritories : fallback.unlockedTerritories)
    .filter((territory): territory is TerritoryId => territory in TERRITORY_CONFIG);
  const safeUnlockedTerritories = unlockedTerritories.length ? unlockedTerritories : fallback.unlockedTerritories;
  const selectedTerritory = safeUnlockedTerritories.includes(progress.selectedTerritory ?? "shimmerVeins")
    ? progress.selectedTerritory ?? "shimmerVeins"
    : "shimmerVeins";

  return {
    ...fallback,
    ...progress,
    selectedTerritory,
    unlockedTerritories: Array.from(new Set(safeUnlockedTerritories)),
    activeTask: normalizeActiveTask(progress.activeTask ?? null),
    completedTasks: Array.from(new Set(progress.completedTasks ?? [])),
    craftedItems: progress.craftedItems ?? {},
    bossAchievements: Array.from(new Set(progress.bossAchievements ?? []))
  };
}

function normalizeActiveTask(task: ActiveTaskState | null): ActiveTaskState | null {
  if (!task || !ORG_TASKS.some((candidate) => candidate.id === task.taskId)) {
    return null;
  }

  return {
    taskId: task.taskId,
    collected: {
      ...emptyInventory(),
      ...(task.collected ?? task.materials)
    },
    materials: {
      ...emptyInventory(),
      ...task.materials
    },
    crafted: task.crafted ?? {},
    completed: Boolean(task.completed)
  };
}

export function effectiveStats(upgrades: UpgradeState): EffectiveStats {
  return {
    laserDps: BASE_STATS.laserDps + upgrades.laserPower * 13,
    heatCapacity: BASE_STATS.heatCapacity + upgrades.heatSink * 16,
    heatBuildLow: Math.max(12, BASE_STATS.heatBuildLow - upgrades.heatSink * 1.8),
    heatBuildHigh: Math.max(22, BASE_STATS.heatBuildHigh - upgrades.heatSink * 2.5),
    heatCoolRate: BASE_STATS.heatCoolRate + upgrades.heatSink * 5,
    magnetRadius: BASE_STATS.magnetRadius + upgrades.magnetRadius * 24,
    maxHull: BASE_STATS.maxHull + upgrades.hull * 22,
    moveSpeed: BASE_STATS.moveSpeed + upgrades.engine * 18,
    dashDistance: BASE_STATS.dashDistance + upgrades.engine * 13
  };
}

export function calculateRunValue(result: Pick<RunResult, "inventory" | "voltrixCore">): number {
  let credits = 0;
  credits += result.inventory.ferrite * ORE_CONFIG.ferrite.value;
  credits += result.inventory.shimmer * ORE_CONFIG.shimmer.value;
  credits += result.inventory.voltaic * ORE_CONFIG.voltaic.value;
  credits += result.inventory.aetherium * ORE_CONFIG.aetherium.value;
  credits += result.voltrixCore ? 220 : 0;
  return credits;
}

export function bankRunResult(progress: UpgradeState, result: RunResult): UpgradeState {
  const next = ensureActiveTask(normalizeProgress(progress));
  next.credits += result.creditsEarned;
  next.totalRuns += 1;
  next.totalMined += result.minedBlocks;
  next.voltrixCores += result.voltrixCore ? 1 : 0;
  saveProgress(next);
  return next;
}

export function tryBuyUpgrade(progress: UpgradeState, id: UpgradeId): UpgradeState {
  const config = UPGRADE_CONFIG[id];
  const level = progress[id];
  if (level >= config.maxLevel) {
    return progress;
  }

  const cost = upgradeCost(id, level);
  if (progress.credits < cost) {
    return progress;
  }

  const next = {
    ...progress,
    credits: progress.credits - cost,
    [id]: level + 1
  };
  saveProgress(next);
  return next;
}

export function ensureActiveTask(progress: UpgradeState): UpgradeState {
  const next = normalizeProgress(progress);
  if (next.activeTask && !next.activeTask.completed) {
    const activeConfig = getOrgTask(next.activeTask.taskId);
    if (activeConfig && next.unlockedTerritories.includes(activeConfig.territory)) {
      next.selectedTerritory = activeConfig.territory;
      return next;
    }
  }

  const task = ORG_TASKS.find((candidate) => {
    return next.unlockedTerritories.includes(candidate.territory) && !next.completedTasks.includes(candidate.id);
  });

  if (!task) {
    next.activeTask = null;
    return next;
  }

  next.activeTask = {
    taskId: task.id,
    collected: emptyInventory(),
    materials: emptyInventory(),
    crafted: {},
    completed: false
  };
  next.selectedTerritory = task.territory;
  return next;
}

export function prepareProgressForNewRun(progress: UpgradeState): UpgradeState {
  const next = ensureActiveTask(progress);
  next.runSerial += 1;
  saveProgress(next);
  return next;
}

export function createRunSeed(progress: UpgradeState): string {
  const task = getActiveTask(progress);
  const territory = task?.territory ?? progress.selectedTerritory;
  const variant = task?.mapVariant ?? "ribbon";
  const taskId = task?.id ?? "free-run";
  return `${territory}-${variant}-${progress.runSerial}-${taskId}`;
}

export function getActiveTask(progress: UpgradeState): OrgTask | null {
  if (!progress.activeTask) {
    return null;
  }

  return getOrgTask(progress.activeTask.taskId);
}

export function getOrgTask(taskId: string): OrgTask | null {
  return ORG_TASKS.find((task) => task.id === taskId) ?? null;
}

export function recordTaskCollection(progress: UpgradeState, ore: OreId, amount: number): void {
  const task = getActiveTask(progress);
  const active = progress.activeTask;
  if (!task || !active || active.completed) {
    return;
  }

  if (!task.requirements.some((requirement) => requirement.kind === "collect" && requirement.ore === ore)) {
    return;
  }

  active.materials[ore] += amount;
  active.collected[ore] += amount;
}

export function tryCraftActiveTask(progress: UpgradeState): UpgradeState {
  const next = ensureActiveTask(progress);
  const active = next.activeTask;
  const task = getActiveTask(next);
  if (!active || !task || !task.recipe || active.completed) {
    saveProgress(next);
    return next;
  }

  const recipe = CRAFT_RECIPES[task.recipe];
  if (!canPay(active.materials, recipe.costs)) {
    saveProgress(next);
    return next;
  }

  for (const [ore, amount] of Object.entries(recipe.costs) as Array<[OreId, number]>) {
    active.materials[ore] -= amount;
  }

  active.crafted[recipe.id] = (active.crafted[recipe.id] ?? 0) + 1;
  next.craftedItems[recipe.id] = (next.craftedItems[recipe.id] ?? 0) + 1;

  if (isTaskComplete(next, task)) {
    completeTask(next, task);
  }

  saveProgress(next);
  return next;
}

export function isTaskComplete(progress: UpgradeState, task: OrgTask): boolean {
  const active = progress.activeTask;
  if (!active || active.taskId !== task.id) {
    return false;
  }

  return task.requirements.every((requirement) => {
    if (requirement.kind === "collect") {
      return active.collected[requirement.ore] >= requirement.amount || active.completed;
    }

    return (active.crafted[requirement.item] ?? 0) >= requirement.amount;
  });
}

function completeTask(progress: UpgradeState, task: OrgTask): void {
  if (!progress.completedTasks.includes(task.id)) {
    progress.completedTasks.push(task.id);
  }

  if (task.unlocksTerritory && !progress.unlockedTerritories.includes(task.unlocksTerritory)) {
    progress.unlockedTerritories.push(task.unlocksTerritory);
  }

  if (progress.activeTask?.taskId === task.id) {
    progress.activeTask.completed = true;
  }
}

export function recordBossAchievement(progress: UpgradeState, achievement: BossAchievementId): void {
  if (!BOSS_ACHIEVEMENTS[achievement]) {
    return;
  }

  if (!progress.bossAchievements.includes(achievement)) {
    progress.bossAchievements.push(achievement);
  }
}

export function getTaskRequirementProgress(progress: UpgradeState, task: OrgTask): string {
  const active = progress.activeTask;
  if (!active || active.taskId !== task.id) {
    return "";
  }

  return task.requirements
    .map((requirement) => {
      if (requirement.kind === "collect") {
        const current = Math.min(active.collected[requirement.ore], requirement.amount);
        return `${labelOre(requirement.ore)} ${current}/${requirement.amount}`;
      }

      const recipe = CRAFT_RECIPES[requirement.item];
      const current = Math.min(active.crafted[requirement.item] ?? 0, requirement.amount);
      return `${recipe.label} ${current}/${requirement.amount}`;
    })
    .join(" | ");
}

export function canCraftActiveTask(progress: UpgradeState): boolean {
  const task = getActiveTask(progress);
  const active = progress.activeTask;
  if (!task?.recipe || !active || active.completed) {
    return false;
  }

  return canPay(active.materials, CRAFT_RECIPES[task.recipe].costs);
}

function canPay(inventory: InventoryState, costs: Partial<Record<OreId, number>>): boolean {
  return (Object.entries(costs) as Array<[OreId, number]>).every(([ore, amount]) => inventory[ore] >= amount);
}

function labelOre(ore: OreId): string {
  return ORE_CONFIG[ore].label;
}
