import type {
  BlockId,
  BossAchievement,
  CraftRecipe,
  EffectiveStats,
  EnemyId,
  InventoryCost,
  MapVariantId,
  OreId,
  OrgTask,
  TerritoryId,
  UpgradeId,
  UnlockId,
  ShipId,
  WeaponId
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

export interface UnlockConfig {
  id: UnlockId;
  label: string;
  description: string;
  cost: number;
  requiresTask?: string;
}

export interface WeaponConfig {
  id: WeaponId;
  label: string;
  unlock?: UnlockId;
  projectileCount: number;
  damage: number;
  speed: number;
  lifetime: number;
  baseInterval: number;
  fastInterval: number;
  heatMin: number;
  heatMax: number;
  spread: number;
  pierces: number;
}

export interface ShipConfig {
  id: ShipId;
  label: string;
  mk: string;
  description: string;
  unlockTask?: string;
  statScale: {
    laserDps: number;
    heatCapacity: number;
    maxHull: number;
    moveSpeed: number;
    dashDistance: number;
  };
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
    health: 28,
    color: 0x1a1710,
    glow: 0xc4a86e,
    drop: "ferrite",
    dropMin: 2,
    dropMax: 4
  },
  shimmer: {
    id: "shimmer",
    label: "Shimmer Crystal",
    health: 52,
    color: 0x151020,
    glow: 0x8a6db8,
    drop: "shimmer",
    dropMin: 1,
    dropMax: 2
  },
  voltaic: {
    id: "voltaic",
    label: "Voltaic Dust",
    health: 88,
    color: 0x0a1c1a,
    glow: 0x5ab8a8,
    drop: "voltaic",
    dropMin: 1,
    dropMax: 2
  },
  aetherium: {
    id: "aetherium",
    label: "Aetherium",
    health: 142,
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
  },
  phaseMite: {
    id: "phaseMite",
    label: "Phase Mite",
    health: 58,
    damage: 10,
    radius: 16,
    color: 0xe8c86a,
    threatOnKill: 7
  }
};

export const UPGRADE_CONFIG: Record<UpgradeId, UpgradeConfig> = {
  laserPower: {
    id: "laserPower",
    label: "Laser Power",
    maxLevel: 8,
    baseCost: 70,
    costStep: 86
  },
  heatSink: {
    id: "heatSink",
    label: "Heat Sink",
    maxLevel: 8,
    baseCost: 65,
    costStep: 78
  },
  magnetRadius: {
    id: "magnetRadius",
    label: "Magnet Radius",
    maxLevel: 8,
    baseCost: 55,
    costStep: 68
  },
  hull: {
    id: "hull",
    label: "Hull",
    maxLevel: 8,
    baseCost: 80,
    costStep: 88
  },
  engine: {
    id: "engine",
    label: "Engine",
    maxLevel: 8,
    baseCost: 75,
    costStep: 82
  }
};

export const UNLOCK_CONFIG: Record<UnlockId, UnlockConfig> = {
  dashModule: {
    id: "dashModule",
    label: "Dash Module",
    description: "Restores the emergency cursor dash.",
    cost: 120
  },
  shieldEmitter: {
    id: "shieldEmitter",
    label: "Shield Emitter",
    description: "Adds a short defensive shield on Space.",
    cost: 180
  },
  swarmBlast: {
    id: "swarmBlast",
    label: "Swarm Blast",
    description: "Unlocks the right-click burst-cluster blast.",
    cost: 220
  },
  piercerWeapon: {
    id: "piercerWeapon",
    label: "Piercer Weapon",
    description: "A slower heavy shot for tough ore and armored targets.",
    cost: 360,
    requiresTask: "sv-relay-frame"
  },
  scatterWeapon: {
    id: "scatterWeapon",
    label: "Scatter Weapon",
    description: "A close-range spread weapon for pressure clearing.",
    cost: 480,
    requiresTask: "sv-voltaic-keystone"
  }
};

export const WEAPON_CONFIG: Record<WeaponId, WeaponConfig> = {
  drillShot: {
    id: "drillShot",
    label: "Drill Shot",
    projectileCount: 1,
    damage: 13,
    speed: 720,
    lifetime: 0.64,
    baseInterval: 0.3,
    fastInterval: 0.105,
    heatMin: 3.6,
    heatMax: 5.2,
    spread: 0,
    pierces: 0
  },
  piercer: {
    id: "piercer",
    label: "Piercer",
    unlock: "piercerWeapon",
    projectileCount: 1,
    damage: 28,
    speed: 780,
    lifetime: 0.78,
    baseInterval: 0.46,
    fastInterval: 0.22,
    heatMin: 7.8,
    heatMax: 10.4,
    spread: 0,
    pierces: 2
  },
  scatter: {
    id: "scatter",
    label: "Scatter",
    unlock: "scatterWeapon",
    projectileCount: 5,
    damage: 8,
    speed: 620,
    lifetime: 0.42,
    baseInterval: 0.42,
    fastInterval: 0.19,
    heatMin: 8,
    heatMax: 11,
    spread: 0.18,
    pierces: 0
  }
};

export const SHIP_CONFIG: Record<ShipId, ShipConfig> = {
  pickaxe: {
    id: "pickaxe",
    label: "Pickaxe",
    mk: "MK-I",
    description: "Balanced starter Hewer.",
    statScale: {
      laserDps: 1,
      heatCapacity: 1,
      maxHull: 1,
      moveSpeed: 1,
      dashDistance: 1
    }
  },
  lance: {
    id: "lance",
    label: "Lance",
    mk: "MK-II",
    description: "Fast fragile striker rewarded by Relay Frame.",
    unlockTask: "sv-relay-frame",
    statScale: {
      laserDps: 1.12,
      heatCapacity: 0.94,
      maxHull: 0.82,
      moveSpeed: 1.18,
      dashDistance: 1.14
    }
  },
  titan: {
    id: "titan",
    label: "Titan",
    mk: "MK-III",
    description: "Heavy armored miner rewarded by Voltaic Keystone.",
    unlockTask: "sv-voltaic-keystone",
    statScale: {
      laserDps: 1.18,
      heatCapacity: 1.1,
      maxHull: 1.28,
      moveSpeed: 0.86,
      dashDistance: 0.9
    }
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
  sentinelEye: {
    id: "sentinelEye",
    label: "Sentinel Eye",
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
    unlocks: ["piercerWeapon"],
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
    bossAchievement: "sentinelEye",
    unlocks: ["scatterWeapon"],
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
    bossAchievement: "voltrixCore",
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

export function upgradeMaterialCost(id: UpgradeId, level: number): InventoryCost {
  const tier = level + 1;
  const common = 6 + tier * 4;
  const uncommon = Math.max(0, tier - 1) * 2;
  const rare = Math.max(0, tier - 3);
  const deep = Math.max(0, tier - 6);

  if (id === "laserPower") {
    return {
      ferrite: common,
      shimmer: uncommon + 1,
      voltaic: rare,
      aetherium: deep
    };
  }

  if (id === "heatSink") {
    return {
      ferrite: Math.ceil(common * 0.7),
      shimmer: uncommon + 2,
      voltaic: Math.max(0, rare - 1)
    };
  }

  if (id === "magnetRadius") {
    return {
      ferrite: common + 2,
      shimmer: Math.max(0, uncommon - 1),
      voltaic: Math.max(0, rare - 1)
    };
  }

  if (id === "hull") {
    return {
      ferrite: common + 6,
      shimmer: Math.max(0, uncommon - 1),
      voltaic: rare
    };
  }

  return {
    ferrite: common,
    shimmer: uncommon,
    voltaic: rare + 1,
    aetherium: deep
  };
}
