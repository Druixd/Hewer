import { BLOCK_CONFIG, ENEMY_CONFIG } from "../content/config";
import { TILE_SIZE, type BlockId, type EnemyState, type TileState, type Vec2, type WorldState } from "./types";
import { coordNoise } from "./random";

const WORLD_WIDTH = 184;
const WORLD_HEIGHT = 88;

export function createWorld(seed: string): WorldState {
  const tiles: TileState[] = [];
  const spawnTile = { x: 9, y: Math.floor(WORLD_HEIGHT * 0.48) };

  for (let y = 0; y < WORLD_HEIGHT; y += 1) {
    for (let x = 0; x < WORLD_WIDTH; x += 1) {
      const type = chooseBlock(seed, x, y, spawnTile);
      const config = BLOCK_CONFIG[type];
      tiles.push({
        x,
        y,
        type,
        maxHealth: config.health,
        health: config.health,
        destroyed: false,
        cracked: type !== "empty" && coordNoise(seed, x, y, 90) > 0.965
      });
    }
  }

  carveSafePocket(tiles, spawnTile.x, spawnTile.y, 6, 5);

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

function chooseBlock(seed: string, x: number, y: number, spawn: Vec2): BlockId {
  const edge = x <= 1 || y <= 1 || x >= WORLD_WIDTH - 2 || y >= WORLD_HEIGHT - 2;
  if (edge) {
    return "ancient";
  }

  const center = WORLD_HEIGHT * 0.47 + Math.sin(x * 0.095) * 9 + Math.sin(x * 0.035) * 16;
  const cavernBand = 8.8 + coordNoise(seed, x, y, 12) * 4.4;
  const ribbon = Math.abs(y - center) < cavernBand;
  const pocketNoise = coordNoise(seed, Math.floor(x / 4), Math.floor(y / 4), 33);
  const pocket = pocketNoise > 0.72 && Math.abs(y - center) < 26;
  const verticalFault = coordNoise(seed, Math.floor(x / 7), 0, 71) > 0.86 && Math.abs(y - center) < 22;
  const nearSpawn = Math.abs(x - spawn.x) < 8 && Math.abs(y - spawn.y) < 7;

  if (nearSpawn || ribbon || pocket || verticalFault) {
    return "empty";
  }

  const depth = y / WORLD_HEIGHT;
  const roll = coordNoise(seed, x, y, 44);

  if (depth > 0.58 && roll > 0.996) {
    return "aetherium";
  }

  if (x > 18 && roll > 0.982) {
    return "voltaic";
  }

  if (x > 10 && roll > 0.924) {
    return "shimmer";
  }

  if (roll > 0.82) {
    return "ferrite";
  }

  return "basalt";
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
        const tile = tiles[y * WORLD_WIDTH + x];
        tile.type = "empty";
        tile.health = 0;
        tile.maxHealth = 0;
        tile.destroyed = false;
        tile.cracked = false;
      }
    }
  }
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
