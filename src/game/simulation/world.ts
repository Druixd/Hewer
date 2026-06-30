import { BLOCK_CONFIG, ENEMY_CONFIG } from "../content/config";
import { TILE_SIZE, type BlockId, type EnemyState, type TileState, type WorldState } from "./types";
import { coordNoise } from "./random";

const WORLD_WIDTH = 184;
const WORLD_HEIGHT = 88;
const MAX_ORE_DEPTH_FROM_OPEN = 4;

interface OreClusterRule {
  type: Extract<BlockId, "ferrite" | "shimmer" | "voltaic" | "aetherium">;
  salt: number;
  threshold: number;
  minX: number;
  minDepth: number;
  maxDepth: number;
  minYRatio?: number;
  radius: number;
}

const ORE_CLUSTER_RULES: OreClusterRule[] = [
  {
    type: "aetherium",
    salt: 820,
    threshold: 0.996,
    minX: 96,
    minDepth: 3,
    maxDepth: 4,
    minYRatio: 0.58,
    radius: 2
  },
  {
    type: "voltaic",
    salt: 720,
    threshold: 0.987,
    minX: 42,
    minDepth: 2,
    maxDepth: 4,
    radius: 2
  },
  {
    type: "shimmer",
    salt: 620,
    threshold: 0.968,
    minX: 18,
    minDepth: 1,
    maxDepth: 3,
    radius: 2
  },
  {
    type: "ferrite",
    salt: 520,
    threshold: 0.948,
    minX: 8,
    minDepth: 1,
    maxDepth: 2,
    radius: 3
  }
];

export function createWorld(seed: string): WorldState {
  const tiles: TileState[] = [];
  const spawnTile = { x: 36, y: Math.floor(WORLD_HEIGHT * 0.48) };

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const type = isAncientBorder(x, y) ? "ancient" : "basalt";
      const config = BLOCK_CONFIG[type];
      tiles.push({
        x,
        y,
        type,
        maxHealth: config.health,
        health: config.health,
        destroyed: false,
        cracked: coordNoise(seed, x, y, 90) > 0.965
      });
    }
  }

  carveCaveShape(seed, tiles, spawnTile);
  carveSafePocket(tiles, spawnTile.x, spawnTile.y, 6, 5);
  placeOreClusters(seed, tiles, spawnTile);

  return {
    seed,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    tileSize: TILE_SIZE,
    tiles,
    spawn: {
      x: spawnTile.x * TILE_SIZE + TILE_SIZE / 2,
      y: spawnTile.y * TILE_SIZE + TILE_SIZE / 2
    },
    extraction: {
      x: (spawnTile.x - 3) * TILE_SIZE + TILE_SIZE / 2,
      y: spawnTile.y * TILE_SIZE + TILE_SIZE / 2
    }
  };
}

export function createInitialEnemies(world: WorldState): EnemyState[] {
  const enemies: EnemyState[] = [];
  let id = 0;

  for (let x = 24; x < world.width - 18; x += 13) {
    const roll = coordNoise(world.seed, x, 17, 200);
    const kind = roll < 0.34 ? "arcWarden" : roll < 0.7 ? "prismStalker" : "sparkSac";
    const y = findOpenY(world, x, roll);

    if (y === null) {
      continue;
    }

    const config = ENEMY_CONFIG[kind];
    enemies.push({
      id: `enemy-${id}`,
      kind,
      x: x * TILE_SIZE + TILE_SIZE / 2,
      y: y * TILE_SIZE + TILE_SIZE / 2,
      vx: 0,
      vy: 0,
      anchorX: x * TILE_SIZE + TILE_SIZE / 2,
      anchorY: y * TILE_SIZE + TILE_SIZE / 2,
      health: config.health,
      maxHealth: config.health,
      radius: config.radius,
      state: kind === "arcWarden" ? "pulsing" : kind === "sparkSac" ? "chase" : "patrol",
      cooldown: 1.2 + roll * 2.2,
      timer: roll * 3,
      direction: roll > 0.5 ? 1 : -1,
      targetX: 0,
      targetY: 0
    });
    id += 1;
  }

  return enemies;
}

export function getTile(world: WorldState, x: number, y: number): TileState | null {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) {
    return null;
  }

  return world.tiles[y * world.width + x] ?? null;
}

export function isSolid(tile: TileState | null | undefined): tile is TileState {
  return Boolean(tile && tile.type !== "empty" && !tile.destroyed);
}

export function tileAtWorld(world: WorldState, x: number, y: number): TileState | null {
  return getTile(world, Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
}

export function worldBounds(world: WorldState): { width: number; height: number } {
  return {
    width: world.width * TILE_SIZE,
    height: world.height * TILE_SIZE
  };
}

function carveCaveShape(seed: string, tiles: TileState[], spawn: { x: number; y: number }): void {
  for (let y = 2; y < WORLD_HEIGHT - 2; y += 1) {
    for (let x = 2; x < WORLD_WIDTH - 2; x += 1) {
      const center = caveCenterY(x);
      const cavernBand = 8.8 + coordNoise(seed, x, y, 12) * 4.4;
      const mainTunnel = Math.abs(y - center) < cavernBand;
      const pocketNoise = coordNoise(seed, Math.floor(x / 4), Math.floor(y / 4), 33);
      const pocket = pocketNoise > 0.72 && Math.abs(y - center) < 26;
      const faultNoise = coordNoise(seed, Math.floor(x / 7), 0, 71);
      const verticalFault = faultNoise > 0.86 && Math.abs(y - center) < 22;
      const branchSeed = coordNoise(seed, Math.floor(x / 12), 0, 111);
      const branchCenter = center + Math.sin(x * 0.18 + branchSeed * 6) * 18;
      const branchNoise = coordNoise(seed, Math.floor(x / 8), Math.floor(y / 5), 121);
      const sideBranch = x > spawn.x + 16 && branchNoise > 0.82 && Math.abs(y - branchCenter) < 3.4;
      const nearSpawn = Math.abs(x - spawn.x) < 8 && Math.abs(y - spawn.y) < 7;

      if (nearSpawn || mainTunnel || pocket || verticalFault || sideBranch) {
        setTileType(tiles, x, y, "empty", seed);
      }
    }
  }
}

function carveSafePocket(tiles: TileState[], centerX: number, centerY: number, radiusX: number, radiusY: number): void {
  for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
      if (x < 0 || y < 0 || x >= WORLD_WIDTH || y >= WORLD_HEIGHT) {
        continue;
      }

      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1.15) {
        setTileType(tiles, x, y, "empty", "");
      }
    }
  }
}

function placeOreClusters(seed: string, tiles: TileState[], spawn: { x: number; y: number }): void {
  const openDepths = measureDistanceFromOpenSpace(tiles, MAX_ORE_DEPTH_FROM_OPEN);

  for (let y = 3; y < WORLD_HEIGHT - 3; y += 2) {
    for (let x = 3; x < WORLD_WIDTH - 3; x += 2) {
      for (const rule of ORE_CLUSTER_RULES) {
        if (!canStartOreCluster(seed, tiles, openDepths, spawn, x, y, rule)) {
          continue;
        }

        paintOreCluster(seed, tiles, openDepths, x, y, rule);
        break;
      }
    }
  }
}

function canStartOreCluster(
  seed: string,
  tiles: TileState[],
  openDepths: number[],
  spawn: { x: number; y: number },
  x: number,
  y: number,
  rule: OreClusterRule
): boolean {
  const tile = tiles[y * WORLD_WIDTH + x];
  const openDepth = openDepths[y * WORLD_WIDTH + x];
  const spawnDistance = Math.abs(x - spawn.x) + Math.abs(y - spawn.y);

  if (tile.type !== "basalt" || spawnDistance < 13 || x < rule.minX) {
    return false;
  }

  if (openDepth < rule.minDepth || openDepth > rule.maxDepth) {
    return false;
  }

  if (rule.minYRatio !== undefined && y / WORLD_HEIGHT < rule.minYRatio) {
    return false;
  }

  return coordNoise(seed, Math.floor(x / 2), Math.floor(y / 2), rule.salt) > rule.threshold;
}

function paintOreCluster(
  seed: string,
  tiles: TileState[],
  openDepths: number[],
  centerX: number,
  centerY: number,
  rule: OreClusterRule
): void {
  for (let y = centerY - rule.radius; y <= centerY + rule.radius; y += 1) {
    for (let x = centerX - rule.radius; x <= centerX + rule.radius; x += 1) {
      if (x < 2 || y < 2 || x >= WORLD_WIDTH - 2 || y >= WORLD_HEIGHT - 2) {
        continue;
      }

      const tile = tiles[y * WORLD_WIDTH + x];
      const depth = openDepths[y * WORLD_WIDTH + x];
      const dx = Math.abs(x - centerX);
      const dy = Math.abs(y - centerY);
      const clusterDistance = dx + dy * 0.85;
      const raggedEdge = coordNoise(seed, x, y, rule.salt + 37) * 1.15;

      if (tile.type !== "basalt" || depth < rule.minDepth || depth > rule.maxDepth) {
        continue;
      }

      if (clusterDistance <= rule.radius - 0.15 + raggedEdge) {
        setTileType(tiles, x, y, rule.type, seed);
      }
    }
  }
}

function measureDistanceFromOpenSpace(tiles: TileState[], maxDepth: number): number[] {
  const depths = new Array<number>(WORLD_WIDTH * WORLD_HEIGHT).fill(Number.POSITIVE_INFINITY);
  const queue: Array<{ x: number; y: number }> = [];
  let head = 0;

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      if (tiles[y * WORLD_WIDTH + x].type === "empty") {
        depths[y * WORLD_WIDTH + x] = 0;
        queue.push({ x, y });
      }
    }
  }

  while (head < queue.length) {
    const current = queue[head];
    head += 1;

    const currentDepth = depths[current.y * WORLD_WIDTH + current.x];
    if (currentDepth >= maxDepth) {
      continue;
    }

    for (const neighbor of getCardinalNeighbors(current.x, current.y)) {
      if (neighbor.x < 0 || neighbor.y < 0 || neighbor.x >= WORLD_WIDTH || neighbor.y >= WORLD_HEIGHT) {
        continue;
      }

      const index = neighbor.y * WORLD_WIDTH + neighbor.x;
      const tile = tiles[index];
      const nextDepth = currentDepth + 1;

      if (tile.type === "ancient" || depths[index] <= nextDepth) {
        continue;
      }

      depths[index] = nextDepth;
      queue.push(neighbor);
    }
  }

  return depths;
}

function getCardinalNeighbors(x: number, y: number): Array<{ x: number; y: number }> {
  return [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 }
  ];
}

function caveCenterY(x: number): number {
  return WORLD_HEIGHT * 0.47 + Math.sin(x * 0.095) * 9 + Math.sin(x * 0.035) * 16;
}

function isAncientBorder(x: number, y: number): boolean {
  return x <= 1 || y <= 1 || x >= WORLD_WIDTH - 2 || y >= WORLD_HEIGHT - 2;
}

function setTileType(tiles: TileState[], x: number, y: number, type: BlockId, seed: string): void {
  const tile = tiles[y * WORLD_WIDTH + x];
  const config = BLOCK_CONFIG[type];

  tile.type = type;
  tile.maxHealth = config.health;
  tile.health = config.health;
  tile.destroyed = false;
  tile.cracked = type !== "empty" && coordNoise(seed, x, y, 90) > 0.965;
}

function findOpenY(world: WorldState, x: number, roll: number): number | null {
  const preferred = Math.floor(world.height * (0.34 + roll * 0.34));

  for (let offset = 0; offset < world.height / 2; offset += 1) {
    const candidates = [preferred + offset, preferred - offset];
    for (const y of candidates) {
      const tile = getTile(world, x, y);
      const below = getTile(world, x, y + 1);
      if (tile?.type === "empty" && below?.type !== "empty") {
        return y;
      }

      if (tile?.type === "empty" && coordNoise(world.seed, x, y, 302) > 0.56) {
        return y;
      }
    }
  }

  return null;
}
