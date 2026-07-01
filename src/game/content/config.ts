import type {
  BlockId,
  BossAchievement,
  CraftRecipe,
  EffectiveStats,
  EnemyId,
  MapVariantId,
  OreId,
  OrgTask,
  TerritoryId,
  UpgradeId
} from "../simulation/types";

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

export interface TerritoryConfig {
  id: TerritoryId;
  label: string;
  bossAchievement: BossAchievement["id"];
  enemyDensity: number;
  oreRichness: number;
  depthBias: number;
  palette: {
    ambient: number[];
    accent: number;
  };
}

export interface MapVariantConfig {
  id: MapVariantId;
  label: string;
  tunnelScale: number;
  pocketThreshold: number;
  faultThreshold: number;
  branchThreshold: number;
  centerShift: number;
}

export const ORE_CONFIG: Record<OreId, OreConfig> = {
  ferrite: {
    id: "ferrite",
    label: "Ferrite",
    color: 0xc4a86e,
    cssColor: "#c4a86e",
    value: 3,
    threat: 0.8
  },
  shimmer: {
    id: "shimmer",
    label: "Shimmer",
    color: 0x8a6db8,
    cssColor: "#8a6db8",
    value: 9,
    threat: 2.4
  },
  voltaic: {
    id: "voltaic",
    label: "Voltaic",
    color: 0x5ab8a8,
    cssColor: "#5ab8a8",
    value: 22,
    threat: 6.5
  },
  aetherium: {
    id: "aetherium",
    label: "Aetherium",
    color: 0xc47a8a,
    cssColor: "#c47a8a",
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
    color: 0x0e0d0a,
    glow: 0x3d3223,
    dropMin: 0,
    dropMax: 0
  },
  ferrite: {
    id: "ferrite",
    label: "Ferrite",
    health: 32,
    color: 0x1a1710,
    glow: 0xc4a86e,
    drop: "ferrite",
    dropMin: 1,
    dropMax: 3
  },
  shimmer: {
    id: "shimmer",
    label: "Shimmer Crystal",
    health: 44,
    color: 0x151020,
    glow: 0x8a6db8,
    drop: "shimmer",
    dropMin: 1,
    dropMax: 2
  },
  voltaic: {
    id: "voltaic",
    label: "Voltaic Dust",
    health: 54,
    color: 0x0a1c1a,
    glow: 0x5ab8a8,
    drop: "voltaic",
    dropMin: 1,
    dropMax: 2
  },
  aetherium: {
    id: "aetherium",
    label: "Aetherium",
    health: 72,
    color: 0x201018,
    glow: 0xc47a8a,
    drop: "aetherium",
    dropMin: 1,
    dropMax: 1
  },
  ancient: {
    id: "ancient",
    label: "Ancient Shell",
    health: 120,
    color: 0x080706,
    glow: 0x2a231a,
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
    color: 0x6ec4b8,
    threatOnKill: 5
  },
  prismStalker: {
    id: "prismStalker",
    label: "Prism Stalker",
    health: 38,
    damage: 12,
    radius: 17,
    color: 0xb87a8a,
    threatOnKill: 6
  },
  sparkSac: {
    id: "sparkSac",
    label: "Spark Sac",
    health: 28,
    damage: 18,
    radius: 18,
    color: 0xd4845a,
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

export const TERRITORY_CONFIG: Record<TerritoryId, TerritoryConfig> = {
  shimmerVeins: {
    id: "shimmerVeins",
    label: "The Shimmer Veins",
    bossAchievement: "voltrixCore",
    enemyDensity: 1,
    oreRichness: 1,
    depthBias: 0,
    palette: {
      ambient: [0x2a1a0a, 0x1a1510, 0x0e1a18, 0x1e1015],
      accent: 0x8a6db8
    }
  },
  cinderHollows: {
    id: "cinderHollows",
    label: "The Cinder Hollows",
    bossAchievement: "pyroclastMark",
    enemyDensity: 1.18,
    oreRichness: 1.12,
    depthBias: 8,
    palette: {
      ambient: [0x2a1208, 0x24100a, 0x19120d, 0x2a1710],
      accent: 0xd4845a
    }
  }
};

export const MAP_VARIANTS: Record<MapVariantId, MapVariantConfig> = {
  ribbon: {
    id: "ribbon",
    label: "Ribbon Run",
    tunnelScale: 1,
    pocketThreshold: 0.72,
    faultThreshold: 0.86,
    branchThreshold: 0.82,
    centerShift: 0
  },
  fracture: {
    id: "fracture",
    label: "Fracture Run",
    tunnelScale: 0.86,
    pocketThreshold: 0.76,
    faultThreshold: 0.78,
    branchThreshold: 0.79,
    centerShift: -5
  },
  sink: {
    id: "sink",
    label: "Deep Sink",
    tunnelScale: 1.08,
    pocketThreshold: 0.69,
    faultThreshold: 0.84,
    branchThreshold: 0.86,
    centerShift: 8
  }
};

export const BOSS_ACHIEVEMENTS: Record<BossAchievement["id"], BossAchievement> = {
  voltrixCore: {
    id: "voltrixCore",
    label: "Voltrix Core",
    territory: "shimmerVeins"
  },
  pyroclastMark: {
    id: "pyroclastMark",
    label: "Pyroclast Mark",
    territory: "cinderHollows"
  }
};

export const CRAFT_RECIPES: Record<CraftRecipe["id"], CraftRecipe> = {
  relayFrame: {
    id: "relayFrame",
    label: "Relay Frame",
    costs: {
      ferrite: 24,
      shimmer: 8
    }
  },
  voltaicKeystone: {
    id: "voltaicKeystone",
    label: "Voltaic Keystone",
    costs: {
      ferrite: 36,
      shimmer: 14,
      voltaic: 5
    }
  },
  cinderBrace: {
    id: "cinderBrace",
    label: "Cinder Brace",
    costs: {
      ferrite: 34,
      shimmer: 10,
      voltaic: 8
    }
  }
};

export const ORG_TASKS: OrgTask[] = [
  {
    id: "sv-relay-frame",
    label: "Org Order: Relay Frame",
    territory: "shimmerVeins",
    mapVariant: "ribbon",
    recipe: "relayFrame",
    requirements: [
      { kind: "collect", ore: "ferrite", amount: 24 },
      { kind: "collect", ore: "shimmer", amount: 8 },
      { kind: "craft", item: "relayFrame", amount: 1 }
    ]
  },
  {
    id: "sv-voltaic-keystone",
    label: "Org Order: Voltaic Keystone",
    territory: "shimmerVeins",
    mapVariant: "fracture",
    recipe: "voltaicKeystone",
    unlocksTerritory: "cinderHollows",
    requirements: [
      { kind: "collect", ore: "ferrite", amount: 36 },
      { kind: "collect", ore: "shimmer", amount: 14 },
      { kind: "collect", ore: "voltaic", amount: 5 },
      { kind: "craft", item: "voltaicKeystone", amount: 1 }
    ]
  },
  {
    id: "ch-cinder-brace",
    label: "Org Order: Cinder Brace",
    territory: "cinderHollows",
    mapVariant: "sink",
    recipe: "cinderBrace",
    requirements: [
      { kind: "collect", ore: "ferrite", amount: 34 },
      { kind: "collect", ore: "shimmer", amount: 10 },
      { kind: "collect", ore: "voltaic", amount: 8 },
      { kind: "craft", item: "cinderBrace", amount: 1 }
    ]
  }
];

export const BASE_STATS: EffectiveStats = {
  laserDps: 55,
  heatCapacity: 100,
  heatBuildLow: 22,
  heatBuildHigh: 41,
  heatCoolRate: 32,
  magnetRadius: 112,
  maxHull: 100,
  moveSpeed: 188,
  dashDistance: 396
};

export function upgradeCost(id: UpgradeId, level: number): number {
  const config = UPGRADE_CONFIG[id];
  return config.baseCost + config.costStep * level + Math.floor(level * level * 16);
}
