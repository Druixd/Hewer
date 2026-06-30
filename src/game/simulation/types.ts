export const TILE_SIZE = 24;

export type OreId = "ferrite" | "shimmer" | "voltaic" | "aetherium";
export type BlockId = "empty" | "basalt" | "ferrite" | "shimmer" | "voltaic" | "aetherium" | "ancient";
export type EnemyId = "arcWarden" | "prismStalker" | "sparkSac";
export type UpgradeId = "laserPower" | "heatSink" | "magnetRadius" | "hull" | "engine";
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
  invulnerableTimer: number;
  collectionPulse: number;
}

export interface InventoryState {
  ferrite: number;
  shimmer: number;
  voltaic: number;
  aetherium: number;
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
  kind: "lightning" | "sparkExplosion";
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
  toggleIntensityPressed: boolean;
  pausePressed: boolean;
  extractPressed: boolean;
}

