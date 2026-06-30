import type { BlockId, EffectiveStats, EnemyId, OreId, UpgradeId } from "../simulation/types";

export interface OreConfig {
  id: OreId;
  label: string;
  color: number;
  cssColor: string;
  value: number;
  threat: number;
}

export interface BlockConfig {
  id: BlockId;
  label: string;
  health: number;
  color: number;
  glow: number;
  drop?: OreId;
  dropMin: number;
  dropMax: number;
}

export interface EnemyConfig {
  id: EnemyId;
  label: string;
  health: number;
  damage: number;
  radius: number;
  color: number;
  threatOnKill: number;
}

export interface UpgradeConfig {
  id: UpgradeId;
  label: string;
  maxLevel: number;
  baseCost: number;
  costStep: number;
}

export const ORE_CONFIG: Record<OreId, OreConfig> = {
  ferrite: {
    id: "ferrite",
    label: "Ferrite",
    color: 0xa7b1ba,
    cssColor: "#a7b1ba",
    value: 3,
    threat: 0.8
  },
  shimmer: {
    id: "shimmer",
    label: "Shimmer",
    color: 0x8b6dff,
    cssColor: "#8b6dff",
    value: 9,
    threat: 2.4
  },
  voltaic: {
    id: "voltaic",
    label: "Voltaic",
    color: 0x41e6e2,
    cssColor: "#41e6e2",
    value: 22,
    threat: 6.5
  },
  aetherium: {
    id: "aetherium",
    label: "Aetherium",
    color: 0xf05dff,
    cssColor: "#f05dff",
    value: 90,
    threat: 18
  }
};

export const BLOCK_CONFIG: Record<BlockId, BlockConfig> = {
  empty: {
    id: "empty",
    label: "Empty",
    health: 0,
    color: 0x000000,
    glow: 0x000000,
    dropMin: 0,
    dropMax: 0
  },
  basalt: {
    id: "basalt",
    label: "Basalt",
    health: 24,
    color: 0x231a32,
    glow: 0x4c3a80,
    dropMin: 0,
    dropMax: 0
  },
  ferrite: {
    id: "ferrite",
    label: "Ferrite",
    health: 32,
    color: 0x3b414b,
    glow: 0xb8c5cc,
    drop: "ferrite",
    dropMin: 1,
    dropMax: 3
  },
  shimmer: {
    id: "shimmer",
    label: "Shimmer Crystal",
    health: 44,
    color: 0x3b2373,
    glow: 0x8b6dff,
    drop: "shimmer",
    dropMin: 1,
    dropMax: 2
  },
  voltaic: {
    id: "voltaic",
    label: "Voltaic Dust",
    health: 54,
    color: 0x103f4b,
    glow: 0x41e6e2,
    drop: "voltaic",
    dropMin: 1,
    dropMax: 2
  },
  aetherium: {
    id: "aetherium",
    label: "Aetherium",
    health: 72,
    color: 0x4a1e57,
    glow: 0xf05dff,
    drop: "aetherium",
    dropMin: 1,
    dropMax: 1
  },
  ancient: {
    id: "ancient",
    label: "Ancient Shell",
    health: 120,
    color: 0x120f1a,
    glow: 0x30234d,
    dropMin: 0,
    dropMax: 0
  }
};

export const ENEMY_CONFIG: Record<EnemyId, EnemyConfig> = {
  arcWarden: {
    id: "arcWarden",
    label: "Arc Warden",
    health: 46,
    damage: 9,
    radius: 20,
    color: 0x46f4ff,
    threatOnKill: 5
  },
  prismStalker: {
    id: "prismStalker",
    label: "Prism Stalker",
    health: 38,
    damage: 12,
    radius: 17,
    color: 0xff5ef1,
    threatOnKill: 6
  },
  sparkSac: {
    id: "sparkSac",
    label: "Spark Sac",
    health: 28,
    damage: 18,
    radius: 18,
    color: 0xffc247,
    threatOnKill: 4
  }
};

export const UPGRADE_CONFIG: Record<UpgradeId, UpgradeConfig> = {
  laserPower: {
    id: "laserPower",
    label: "Laser Power",
    maxLevel: 5,
    baseCost: 80,
    costStep: 68
  },
  heatSink: {
    id: "heatSink",
    label: "Heat Sink",
    maxLevel: 5,
    baseCost: 70,
    costStep: 58
  },
  magnetRadius: {
    id: "magnetRadius",
    label: "Magnet Radius",
    maxLevel: 5,
    baseCost: 60,
    costStep: 54
  },
  hull: {
    id: "hull",
    label: "Hull",
    maxLevel: 5,
    baseCost: 85,
    costStep: 72
  },
  engine: {
    id: "engine",
    label: "Engine",
    maxLevel: 5,
    baseCost: 75,
    costStep: 64
  }
};

export const BASE_STATS: EffectiveStats = {
  laserDps: 55,
  heatCapacity: 100,
  heatBuildLow: 22,
  heatBuildHigh: 41,
  heatCoolRate: 32,
  magnetRadius: 112,
  maxHull: 100,
  moveSpeed: 188,
  dashDistance: 132
};

export function upgradeCost(id: UpgradeId, level: number): number {
  const config = UPGRADE_CONFIG[id];
  return config.baseCost + config.costStep * level + Math.floor(level * level * 16);
}

