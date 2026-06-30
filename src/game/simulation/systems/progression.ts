import { BASE_STATS, ORE_CONFIG, UPGRADE_CONFIG, upgradeCost } from "../../content/config";
import type { EffectiveStats, RunResult, UpgradeId, UpgradeState } from "../types";

const STORAGE_KEY = "hewer.progress.v0";

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
    voltrixCores: 0
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
    return {
      ...fallback,
      ...parsed
    };
  } catch {
    return fallback;
  }
}

export function saveProgress(progress: UpgradeState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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
  const next = { ...progress };
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

