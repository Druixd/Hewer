import {
  BASE_STATS,
  BOSS_ACHIEVEMENTS,
  CRAFT_RECIPES,
  ORE_CONFIG,
  ORG_TASKS,
  SHIP_CONFIG,
  TERRITORY_CONFIG,
  UNLOCK_CONFIG,
  UPGRADE_CONFIG,
  WEAPON_CONFIG,
  upgradeCost,
  upgradeMaterialCost
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
  TaskGuidanceState,
  TaskStepState,
  TerritoryId,
  UpgradeId,
  UpgradeState,
  UnlockId,
  ShipId,
  WeaponId
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
    stockpile: emptyInventory(),
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
    bossAchievements: [],
    unlockedShopItems: ["dashModule", "shieldEmitter", "swarmBlast"],
    purchasedUnlocks: [],
    equippedWeapon: "drillShot",
    unlockedShips: ["pickaxe"],
    equippedShip: "pickaxe"
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

  const completedTasks = Array.from(new Set(progress.completedTasks ?? []));
  const unlockedShips = normalizeShips(progress.unlockedShips, completedTasks);
  const equippedShip = normalizeShip(progress.equippedShip, unlockedShips);

  return {
    ...fallback,
    ...progress,
    selectedTerritory,
    stockpile: {
      ...emptyInventory(),
      ...progress.stockpile
    },
    unlockedTerritories: Array.from(new Set(safeUnlockedTerritories)),
    activeTask: normalizeActiveTask(progress.activeTask ?? null),
    completedTasks,
    craftedItems: progress.craftedItems ?? {},
    bossAchievements: Array.from(new Set((progress.bossAchievements ?? []).filter((achievement): achievement is BossAchievementId => achievement in BOSS_ACHIEVEMENTS))),
    unlockedShopItems: normalizeUnlocks(progress.unlockedShopItems, fallback.unlockedShopItems),
    purchasedUnlocks: normalizeUnlocks(progress.purchasedUnlocks, []),
    equippedWeapon: normalizeWeapon(progress.equippedWeapon, progress.purchasedUnlocks),
    unlockedShips,
    equippedShip
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
    banked: Boolean(task.banked),
    bossDefeated: Boolean(task.bossDefeated),
    extracted: Boolean(task.extracted),
    completed: Boolean(task.completed)
  };
}

function normalizeUnlocks(value: UnlockId[] | undefined, fallback: UnlockId[]): UnlockId[] {
  const ids = value?.length ? value : fallback;
  return Array.from(new Set(ids.filter((id): id is UnlockId => id in UNLOCK_CONFIG)));
}

function normalizeWeapon(value: WeaponId | undefined, purchasedUnlocks: UnlockId[] | undefined): WeaponId {
  if (!value || !(value in WEAPON_CONFIG)) {
    return "drillShot";
  }
  const unlock = WEAPON_CONFIG[value].unlock;
  return !unlock || purchasedUnlocks?.includes(unlock) ? value : "drillShot";
}

function normalizeShips(value: ShipId[] | undefined, completedTasks: string[]): ShipId[] {
  const ids = new Set<ShipId>(["pickaxe"]);
  value?.forEach((id) => {
    if (id in SHIP_CONFIG) {
      ids.add(id);
    }
  });
  for (const ship of Object.values(SHIP_CONFIG)) {
    if (ship.unlockTask && completedTasks.includes(ship.unlockTask)) {
      ids.add(ship.id);
    }
  }
  return Array.from(ids);
}

function normalizeShip(value: ShipId | undefined, unlockedShips: ShipId[]): ShipId {
  return value && value in SHIP_CONFIG && unlockedShips.includes(value) ? value : "pickaxe";
}

export function effectiveStats(upgrades: UpgradeState): EffectiveStats {
  const ship = SHIP_CONFIG[upgrades.equippedShip] ?? SHIP_CONFIG.pickaxe;
  return {
    laserDps: (BASE_STATS.laserDps + upgrades.laserPower * 13) * ship.statScale.laserDps,
    heatCapacity: (BASE_STATS.heatCapacity + upgrades.heatSink * 16) * ship.statScale.heatCapacity,
    heatBuildLow: Math.max(12, BASE_STATS.heatBuildLow - upgrades.heatSink * 1.8),
    heatBuildHigh: Math.max(22, BASE_STATS.heatBuildHigh - upgrades.heatSink * 2.5),
    heatCoolRate: BASE_STATS.heatCoolRate + upgrades.heatSink * 5,
    magnetRadius: BASE_STATS.magnetRadius + upgrades.magnetRadius * 24,
    maxHull: (BASE_STATS.maxHull + upgrades.hull * 22) * ship.statScale.maxHull,
    moveSpeed: (BASE_STATS.moveSpeed + upgrades.engine * 18) * ship.statScale.moveSpeed,
    dashDistance: (BASE_STATS.dashDistance + upgrades.engine * 13) * ship.statScale.dashDistance
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
  if (result.outcome !== "destroyed") {
    next.credits += result.creditsEarned;
    addInventory(next.stockpile, result.inventory);
  }
  if (result.mode === "run-end") {
    next.totalRuns += 1;
    next.totalMined += result.minedBlocks;
    next.voltrixCores += result.voltrixCore ? 1 : 0;
  }
  if (next.activeTask && next.activeTask.taskId === result.activeTaskId && result.outcome !== "destroyed") {
    next.activeTask.banked = true;
    next.activeTask.extracted = true;
    const task = getOrgTask(next.activeTask.taskId);
    if (task && isTaskComplete(next, task)) {
      completeTask(next, task);
    }
  }
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
  const materialCost = upgradeMaterialCost(id, level);
  if (progress.credits < cost || !canPay(progress.stockpile, materialCost)) {
    return progress;
  }

  const next = {
    ...progress,
    stockpile: { ...progress.stockpile },
    credits: progress.credits - cost,
    [id]: level + 1
  };
  payInventory(next.stockpile, materialCost);
  saveProgress(next);
  return next;
}

export function canBuyUnlock(progress: UpgradeState, id: UnlockId): boolean {
  const next = normalizeProgress(progress);
  const config = UNLOCK_CONFIG[id];
  if (!config || next.purchasedUnlocks.includes(id) || !next.unlockedShopItems.includes(id)) {
    return false;
  }
  if (config.requiresTask && !next.completedTasks.includes(config.requiresTask)) {
    return false;
  }
  return next.credits >= config.cost;
}

export function tryBuyUnlock(progress: UpgradeState, id: UnlockId): UpgradeState {
  const next = normalizeProgress(progress);
  if (!canBuyUnlock(next, id)) {
    return next;
  }

  next.credits -= UNLOCK_CONFIG[id].cost;
  next.purchasedUnlocks = Array.from(new Set([...next.purchasedUnlocks, id]));
  if (id === "piercerWeapon") {
    next.equippedWeapon = "piercer";
  } else if (id === "scatterWeapon") {
    next.equippedWeapon = "scatter";
  }
  saveProgress(next);
  return next;
}

export function tryEquipWeapon(progress: UpgradeState, id: WeaponId): UpgradeState {
  const next = normalizeProgress(progress);
  const config = WEAPON_CONFIG[id];
  if (!config) {
    return next;
  }
  if (config.unlock && !next.purchasedUnlocks.includes(config.unlock)) {
    return next;
  }
  next.equippedWeapon = id;
  saveProgress(next);
  return next;
}

export function tryEquipShip(progress: UpgradeState, id: ShipId): UpgradeState {
  const next = normalizeProgress(progress);
  if (!(id in SHIP_CONFIG) || !next.unlockedShips.includes(id)) {
    return next;
  }
  next.equippedShip = id;
  saveProgress(next);
  return next;
}

export function hasUnlock(progress: UpgradeState, id: UnlockId): boolean {
  return progress.purchasedUnlocks.includes(id);
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
    banked: false,
    bossDefeated: false,
    extracted: false,
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

  const requirementsDone = task.requirements.every((requirement) => {
    if (requirement.kind === "collect") {
      return active.collected[requirement.ore] >= requirement.amount || active.completed;
    }

    return (active.crafted[requirement.item] ?? 0) >= requirement.amount;
  });

  const bossDone = !task.bossAchievement || active.bossDefeated || progress.bossAchievements.includes(task.bossAchievement);
  return requirementsDone && active.banked && active.extracted && bossDone;
}

function completeTask(progress: UpgradeState, task: OrgTask): void {
  if (!progress.completedTasks.includes(task.id)) {
    progress.completedTasks.push(task.id);
  }

  if (task.unlocksTerritory && !progress.unlockedTerritories.includes(task.unlocksTerritory)) {
    progress.unlockedTerritories.push(task.unlocksTerritory);
  }

  if (task.unlocks) {
    progress.unlockedShopItems = Array.from(new Set([...progress.unlockedShopItems, ...task.unlocks]));
  }

  const rewardedShips = Object.values(SHIP_CONFIG)
    .filter((ship) => ship.unlockTask === task.id)
    .map((ship) => ship.id);
  if (rewardedShips.length) {
    progress.unlockedShips = Array.from(new Set([...progress.unlockedShips, ...rewardedShips]));
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

  const task = getActiveTask(progress);
  const active = progress.activeTask;
  if (task?.bossAchievement === achievement && active?.taskId === task.id) {
    active.bossDefeated = true;
    if (isTaskComplete(progress, task)) {
      completeTask(progress, task);
    }
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

export function getTaskGuidance(progress: UpgradeState, task: OrgTask | null, options?: {
  cargoValue?: number;
  threatMood?: "quiet" | "waking" | "surging" | "breakout";
  bossActive?: boolean;
  bossDefeated?: boolean;
}): TaskGuidanceState {
  const active = progress.activeTask;
  const stepStates = task && active?.taskId === task.id ? getTaskStepStates(progress, task) : [];
  const isCraftReady = canCraftActiveTask(progress);
  const isStoreReady = (options?.cargoValue ?? 0) > 0;
  const isBankReady = isStoreReady;
  const bossCue = getBossCue(options?.threatMood ?? "quiet", Boolean(options?.bossActive), Boolean(options?.bossDefeated));
  const label = task ? (active?.completed ? `${task.label} complete` : task.label) : "No active order";

  if (!task || !active || active.taskId !== task.id) {
    return {
      label,
      nextAction: bossCue ?? "Free mine and store cargo",
      stepStates,
      isCraftReady,
      isBankReady,
      bossCue
    };
  }

  if (bossCue && (options?.bossActive || options?.threatMood === "breakout" || options?.threatMood === "surging")) {
    return {
      label,
      nextAction: bossCue,
      stepStates,
      isCraftReady,
      isBankReady,
      bossCue
    };
  }

  if (active.completed) {
    return {
      label,
      nextAction: isBankReady ? "Store completed order" : "Call Store when ready",
      stepStates,
      isCraftReady,
      isBankReady,
      bossCue
    };
  }

  const collectedRequiredOre = task.requirements.every((requirement) => {
    return requirement.kind !== "collect" || active.collected[requirement.ore] >= requirement.amount || active.completed;
  });

  if (!active.banked && collectedRequiredOre) {
    return {
      label,
      nextAction: "Press E to store contract cargo",
      stepStates,
      isCraftReady,
      isBankReady,
      bossCue
    };
  }

  if (isCraftReady) {
    const recipe = task.recipe ? CRAFT_RECIPES[task.recipe] : null;
    return {
      label,
      nextAction: recipe ? `Store to craft ${recipe.label}` : "Store to craft objective",
      stepStates,
      isCraftReady,
      isBankReady,
      bossCue
    };
  }

  if (task.bossAchievement && !active.bossDefeated && !progress.bossAchievements.includes(task.bossAchievement)) {
    return {
      label,
      nextAction: options?.bossActive ? "Defeat contract boss" : "Mine deeper to wake contract boss",
      stepStates,
      isCraftReady,
      isBankReady,
      bossCue
    };
  }

  const nextMissingStep = stepStates.find((step) => !step.complete);
  return {
    label,
    nextAction: nextMissingStep ? actionForStep(nextMissingStep) : "Store cargo",
    stepStates,
    isCraftReady,
    isBankReady,
    bossCue
  };
}

export function getTaskStepStates(progress: UpgradeState, task: OrgTask): TaskStepState[] {
  const active = progress.activeTask;
  if (!active || active.taskId !== task.id) {
    return [];
  }

  const steps = task.requirements.map((requirement) => {
    if (requirement.kind === "collect") {
      const current = Math.min(active.collected[requirement.ore], requirement.amount);
      return {
        label: labelOre(requirement.ore),
        current,
        target: requirement.amount,
        complete: current >= requirement.amount || active.completed,
        kind: requirement.kind
      };
    }

    const recipe = CRAFT_RECIPES[requirement.item];
    const current = Math.min(active.crafted[requirement.item] ?? 0, requirement.amount);
    return {
      label: recipe.label,
      current,
      target: requirement.amount,
      complete: current >= requirement.amount || active.completed,
      kind: requirement.kind
    };
  });

  const collectTargets = task.requirements.filter((requirement) => requirement.kind === "collect").length;
  if (collectTargets > 0) {
    steps.push({
    label: "Store cargo",
      current: active.banked ? 1 : 0,
      target: 1,
      complete: active.banked || active.completed,
      kind: "collect"
    });
  }

  if (task.bossAchievement) {
    const achievement = BOSS_ACHIEVEMENTS[task.bossAchievement];
    steps.push({
      label: achievement.label,
      current: active.bossDefeated || progress.bossAchievements.includes(task.bossAchievement) ? 1 : 0,
      target: 1,
      complete: active.bossDefeated || progress.bossAchievements.includes(task.bossAchievement) || active.completed,
      kind: "craft"
    });
  }

  steps.push({
      label: "Store",
    current: active.extracted ? 1 : 0,
    target: 1,
    complete: active.extracted || active.completed,
    kind: "collect"
  });

  return steps;
}

export function canCraftActiveTask(progress: UpgradeState): boolean {
  const task = getActiveTask(progress);
  const active = progress.activeTask;
  if (!task?.recipe || !active || active.completed || !active.banked) {
    return false;
  }

  return canPay(active.materials, CRAFT_RECIPES[task.recipe].costs);
}

function canPay(inventory: InventoryState, costs: Partial<Record<OreId, number>>): boolean {
  return (Object.entries(costs) as Array<[OreId, number]>).every(([ore, amount]) => inventory[ore] >= amount);
}

function addInventory(target: InventoryState, source: InventoryState): void {
  target.ferrite += source.ferrite;
  target.shimmer += source.shimmer;
  target.voltaic += source.voltaic;
  target.aetherium += source.aetherium;
}

function payInventory(target: InventoryState, costs: Partial<Record<OreId, number>>): void {
  for (const [ore, amount] of Object.entries(costs) as Array<[OreId, number]>) {
    target[ore] = Math.max(0, target[ore] - amount);
  }
}

function labelOre(ore: OreId): string {
  return ORE_CONFIG[ore].label;
}

function actionForStep(step: TaskStepState): string {
  if (step.label === "Store cargo") {
    return "Store cargo";
  }
  if (step.label === "Store") {
    return "Store to finalize";
  }
  if (step.target === 1 && step.current === 0 && step.kind === "craft" && !step.label.includes("Frame") && !step.label.includes("Keystone") && !step.label.includes("Brace")) {
    return `Defeat ${step.label}`;
  }
  if (step.kind === "craft") {
    return `Gather materials for ${step.label}`;
  }

  return step.current > 0 ? `Mine ${step.label}` : `Find ${step.label}`;
}

function getBossCue(
  threatMood: "quiet" | "waking" | "surging" | "breakout",
  bossActive: boolean,
  bossDefeated: boolean
): string | null {
  if (bossDefeated) {
    return null;
  }
  if (bossActive || threatMood === "breakout") {
    return "Fight Voltrix";
  }
  if (threatMood === "surging") {
    return "Voltrix rising";
  }
  if (threatMood === "waking") {
    return "Voltrix stirring";
  }
  return null;
}
