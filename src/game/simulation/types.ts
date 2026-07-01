export const TILE_SIZE = 24;

export type OreId = "ferrite" | "shimmer" | "voltaic" | "aetherium";
export type BlockId = "empty" | "basalt" | "ferrite" | "shimmer" | "voltaic" | "aetherium" | "ancient";
export type EnemyId = "arcWarden" | "prismStalker" | "sparkSac";
export type UpgradeId = "laserPower" | "heatSink" | "magnetRadius" | "hull" | "engine";
export type TerritoryId = "shimmerVeins" | "cinderHollows";
export type MapVariantId = "ribbon" | "fracture" | "sink";
export type ObjectiveItemId = "relayFrame" | "voltaicKeystone" | "cinderBrace";
export type BossAchievementId = "voltrixCore" | "pyroclastMark";
export type RunStatus = "playing" | "extracted" | "destroyed" | "victory";
export type RunOutcome = Exclude<RunStatus, "playing">;

export interface Vec2 {
  x: number;
  y: number;
}

export interface TileState {
  x: number;
  y: number;
  type: BlockId;
  maxHealth: number;
  health: number;
  destroyed: boolean;
  cracked: boolean;
}

export interface WorldState {
  seed: string;
  territory: TerritoryId;
  variant: MapVariantId;
  width: number;
  height: number;
  tileSize: number;
  tiles: TileState[];
  spawn: Vec2;
  extraction: Vec2;
}

export interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hull: number;
  maxHull: number;
  heat: number;
  overheatedTimer: number;
  miningIntensity: "low" | "high";
  dashCooldown: number;
  bombCooldown: number;
  invulnerableTimer: number;
  collectionPulse: number;
}

export interface InventoryState {
  ferrite: number;
  shimmer: number;
  voltaic: number;
  aetherium: number;
}

export type InventoryCost = Partial<Record<OreId, number>>;

export type TaskRequirement =
  | {
      kind: "collect";
      ore: OreId;
      amount: number;
    }
  | {
      kind: "craft";
      item: ObjectiveItemId;
      amount: number;
    };

export interface CraftRecipe {
  id: ObjectiveItemId;
  label: string;
  costs: InventoryCost;
}

export interface OrgTask {
  id: string;
  label: string;
  territory: TerritoryId;
  mapVariant: MapVariantId;
  requirements: TaskRequirement[];
  recipe?: ObjectiveItemId;
  unlocksTerritory?: TerritoryId;
}

export interface ActiveTaskState {
  taskId: string;
  collected: InventoryState;
  materials: InventoryState;
  crafted: Partial<Record<ObjectiveItemId, number>>;
  completed: boolean;
}

export interface BossAchievement {
  id: BossAchievementId;
  label: string;
  territory: TerritoryId;
}

export interface UpgradeState {
  credits: number;
  laserPower: number;
  heatSink: number;
  magnetRadius: number;
  hull: number;
  engine: number;
  totalRuns: number;
  totalMined: number;
  voltrixCores: number;
  runSerial: number;
  selectedTerritory: TerritoryId;
  unlockedTerritories: TerritoryId[];
  activeTask: ActiveTaskState | null;
  completedTasks: string[];
  craftedItems: Partial<Record<ObjectiveItemId, number>>;
  bossAchievements: BossAchievementId[];
}

export interface EffectiveStats {
  laserDps: number;
  heatCapacity: number;
  heatBuildLow: number;
  heatBuildHigh: number;
  heatCoolRate: number;
  magnetRadius: number;
  maxHull: number;
  moveSpeed: number;
  dashDistance: number;
}

export interface ThreatState {
  value: number;
  max: number;
  mood: "quiet" | "waking" | "surging" | "breakout";
  zoneTimer: number;
}

export interface EnemyState {
  id: string;
  kind: EnemyId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  anchorX: number;
  anchorY: number;
  health: number;
  maxHealth: number;
  radius: number;
  state: "idle" | "patrol" | "windup" | "dash" | "chase" | "pulsing";
  cooldown: number;
  timer: number;
  direction: number;
  targetX: number;
  targetY: number;
}

export interface PickupState {
  id: string;
  ore: OreId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  magnetized: boolean;
  age: number;
}

export interface HazardState {
  id: string;
  kind: "lightning" | "sparkExplosion" | "swarmExplosion";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  radius: number;
  age: number;
  duration: number;
  damageAt: number;
  damage: number;
  applied: boolean;
}

export interface BombState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  age: number;
  lifetime: number;
  color: number;
}

export interface BossSegmentState {
  x: number;
  y: number;
  radius: number;
}

export interface BossState {
  active: boolean;
  defeated: boolean;
  health: number;
  maxHealth: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  cooldown: number;
  segments: BossSegmentState[];
}

export interface BeamState {
  active: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  heat: "low" | "high";
  hitKind: "none" | "tile" | "enemy" | "boss";
}

export interface GameEvent {
  type:
    | "tile-broken"
    | "pickup-collected"
    | "enemy-hit"
    | "enemy-killed"
    | "player-hit"
    | "overheat"
    | "player-dash"
    | "swarm-bomb-fired"
    | "swarm-bomb-exploded"
    | "boss-breakout"
    | "boss-hit"
    | "boss-defeated";
  x: number;
  y: number;
  color: number;
  amount?: number;
}

export interface RunResult {
  outcome: RunOutcome;
  inventory: InventoryState;
  minedBlocks: number;
  enemiesKilled: number;
  duration: number;
  creditsEarned: number;
  voltrixCore: boolean;
  taskCompleted: boolean;
  activeTaskId: string | null;
  bossAchievement: BossAchievementId | null;
}

export interface GameState {
  world: WorldState;
  player: PlayerState;
  inventory: InventoryState;
  upgrades: UpgradeState;
  stats: EffectiveStats;
  threat: ThreatState;
  enemies: EnemyState[];
  pickups: PickupState[];
  hazards: HazardState[];
  bombs: BombState[];
  boss: BossState;
  beam: BeamState;
  events: GameEvent[];
  status: RunStatus;
  runResult: RunResult | null;
  elapsed: number;
  minedBlocks: number;
  enemiesKilled: number;
}

export interface InputActions {
  move: Vec2;
  aim: Vec2;
  primaryFire: boolean;
  secondaryAbility: boolean;
  dashPressed: boolean;
  toggleIntensityPressed: boolean;
  pausePressed: boolean;
  extractPressed: boolean;
}
