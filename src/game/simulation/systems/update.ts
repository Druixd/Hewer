import { BLOCK_CONFIG, ENEMY_CONFIG, ORE_CONFIG } from "../../content/config";
import { finishRun } from "../state";
import { canCraftActiveTask, getActiveTask, getTaskStepStates, recordBossAchievement, recordTaskCollection } from "./progression";
import {
  TILE_SIZE,
  type BombState,
  type BossSegmentState,
  type EnemyState,
  type GameEvent,
  type GameState,
  type HazardState,
  type InputActions,
  type ObjectiveTargetState,
  type OreId,
  type PickupState,
  type ProjectileState,
  type TileState,
  type Vec2
} from "../types";
import { getTile, isSolid, tileAtWorld, worldBounds } from "../world";

const PICKUP_FRICTION = 0.91;
const SWARM_BOMB_COUNT = 6;
const BLAST_MAX_CHARGES = 3;
const BLAST_REPEAT_COOLDOWN = 0.34;
const BLAST_RECHARGE_TIME = 4.2;
const SWARM_BOMB_SPEED = 360;
const SWARM_BOMB_DAMAGE = 42;
const SWARM_BOMB_TILE_DAMAGE = 34;
const SWARM_BOMB_RADIUS = 74;
const SWARM_BOMB_COLOR = 0xd4845a;
const PROJECTILE_SPEED = 720;
const PROJECTILE_LIFETIME = 0.64;
const PROJECTILE_BASE_INTERVAL = 0.3;
const PROJECTILE_FAST_INTERVAL = 0.105;
const OBJECTIVE_TARGET_RADIUS_TILES = 34;
const OBJECTIVE_TARGET_LIMIT = 80;
const OBJECTIVE_WAVE_COOLDOWN = 8.5;

export function updateGame(state: GameState, actions: InputActions, dt: number): void {
  state.events = [];

  if (state.status !== "playing") {
    state.beam.active = false;
    return;
  }

  state.elapsed += dt;
  state.threat.zoneTimer += dt;
  state.threat.value = clamp(state.threat.value + dt * 0.32, 0, state.threat.max);
  state.mission.introTimer = Math.max(0, state.mission.introTimer - dt);
  if (!state.mission.started) {
    state.mission.started = true;
    addEvent(state, "mission-started", state.player.x, state.player.y, 0xe8c86a);
  }
  state.player.invulnerableTimer = Math.max(0, state.player.invulnerableTimer - dt);
  state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
  state.player.bombCooldown = Math.max(0, state.player.bombCooldown - dt);
  state.player.weaponCooldown = Math.max(0, state.player.weaponCooldown - dt);
  state.player.blastRepeatCooldown = Math.max(0, state.player.blastRepeatCooldown - dt);
  state.player.objectiveWaveCooldown = Math.max(0, state.player.objectiveWaveCooldown - dt);
  state.mission.waveTimer = Math.max(0, state.mission.waveTimer - dt);
  updateBlastRecharge(state, dt);
  state.player.collectionPulse = Math.max(0, state.player.collectionPulse - dt);

  state.beam.active = false;

  updateThreatMood(state);
  movePlayer(state, actions, dt);
  fireSwarmBomb(state, actions);
  updateDrillShotWeapon(state, actions, dt);
  updateProjectiles(state, dt);
  updateEnemies(state, dt);
  updateBoss(state, dt);
  updateBombs(state, dt);
  updateHazards(state, dt);
  updatePickups(state, dt);
  updateMissionState(state);

  if (distance(state.player, state.world.extraction) <= 72 && actions.extractPressed) {
    finishRun(state, "extracted");
  }

  if (!state.boss.active && !state.boss.defeated && state.threat.value >= state.threat.max) {
    startBossBreakout(state);
  }

  if (state.player.hull <= 0) {
    finishRun(state, "destroyed");
  }
}

function movePlayer(state: GameState, actions: InputActions, dt: number): void {
  const move = normalize(actions.move);
  const speed = state.stats.moveSpeed;
  const targetVx = move.x * speed;
  const targetVy = move.y * speed;
  state.player.vx = lerp(state.player.vx, targetVx, 0.22);
  state.player.vy = lerp(state.player.vy, targetVy, 0.22);

  if (actions.dashPressed && state.player.dashCooldown <= 0) {
    const aimDir = normalize({
      x: actions.aim.x - state.player.x,
      y: actions.aim.y - state.player.y
    });
    const dash = length(aimDir) === 0 ? move : aimDir;
    state.player.vx += dash.x * state.stats.dashDistance * 4.2;
    state.player.vy += dash.y * state.stats.dashDistance * 4.2;
    state.player.dashCooldown = 1.45;
    state.player.invulnerableTimer = Math.max(state.player.invulnerableTimer, 0.22);
    addEvent(state, "player-dash", state.player.x, state.player.y, 0xe8c86a);
  }

  const angleVector = {
    x: actions.aim.x - state.player.x,
    y: actions.aim.y - state.player.y
  };
  if (length(angleVector) > 1) {
    state.player.angle = Math.atan2(angleVector.y, angleVector.x);
  }

  const bounds = worldBounds(state.world);
  const nextX = clamp(state.player.x + state.player.vx * dt, 16, bounds.width - 16);
  if (!circleHitsSolid(state, nextX, state.player.y, 10)) {
    state.player.x = nextX;
  } else {
    state.player.vx *= -0.2;
  }

  const nextY = clamp(state.player.y + state.player.vy * dt, 16, bounds.height - 16);
  if (!circleHitsSolid(state, state.player.x, nextY, 10)) {
    state.player.y = nextY;
  } else {
    state.player.vy *= -0.2;
  }
}

function fireSwarmBomb(state: GameState, actions: InputActions): void {
  if (!actions.secondaryPressed || state.player.blastRepeatCooldown > 0 || state.player.blastCharges <= 0) {
    return;
  }

  const aimDir = normalize({
    x: actions.aim.x - state.player.x,
    y: actions.aim.y - state.player.y
  });
  const baseAngle = length(aimDir) === 0 ? state.player.angle : Math.atan2(aimDir.y, aimDir.x);
  const startX = state.player.x + Math.cos(baseAngle) * 22;
  const startY = state.player.y + Math.sin(baseAngle) * 22;

  for (let index = 0; index < SWARM_BOMB_COUNT; index += 1) {
    const spread = (index - (SWARM_BOMB_COUNT - 1) / 2) * 0.11;
    const jitter = (noiseFor(state.elapsed * 100 + index, state.player.x, 911) - 0.5) * 0.08;
    const angle = baseAngle + spread + jitter;
    const speed = SWARM_BOMB_SPEED * (0.88 + noiseFor(state.player.y, index + state.elapsed * 77, 912) * 0.24);
    const bomb: BombState = {
      id: `bomb-${state.elapsed.toFixed(3)}-${index}-${state.bombs.length}`,
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed + state.player.vx * 0.14,
      vy: Math.sin(angle) * speed + state.player.vy * 0.14,
      radius: 8,
      age: 0,
      lifetime: 1.25 + index * 0.035,
      color: SWARM_BOMB_COLOR
    };
    state.bombs.push(bomb);
  }

  state.player.blastCharges = Math.max(0, state.player.blastCharges - 1);
  state.player.blastRepeatCooldown = BLAST_REPEAT_COOLDOWN;
  state.player.bombCooldown = state.player.blastRepeatCooldown;
  if (state.player.blastCharges === 0) {
    state.player.blastRechargeTimer = BLAST_RECHARGE_TIME;
  }
  state.threat.value = clamp(state.threat.value + 1.2, 0, state.threat.max);
  addEvent(state, "blast-charge-spent", startX, startY, SWARM_BOMB_COLOR, state.player.blastCharges);
  addEvent(state, "swarm-bomb-fired", startX, startY, SWARM_BOMB_COLOR);
}

function updateBlastRecharge(state: GameState, dt: number): void {
  if (state.player.blastCharges > 0 || state.player.blastRechargeTimer <= 0) {
    return;
  }

  state.player.blastRechargeTimer = Math.max(0, state.player.blastRechargeTimer - dt);
  if (state.player.blastRechargeTimer <= 0) {
    state.player.blastCharges = BLAST_MAX_CHARGES;
    addEvent(state, "blast-recharged", state.player.x, state.player.y, SWARM_BOMB_COLOR, BLAST_MAX_CHARGES);
  }
}

function updateBombs(state: GameState, dt: number): void {
  for (let index = state.bombs.length - 1; index >= 0; index -= 1) {
    const bomb = state.bombs[index];
    bomb.age += dt;

    const nextX = bomb.x + bomb.vx * dt;
    const nextY = bomb.y + bomb.vy * dt;

    let shouldExplode = bomb.age >= bomb.lifetime || isSolid(tileAtWorld(state.world, nextX, nextY));

    if (!shouldExplode) {
      for (const enemy of state.enemies) {
        if (distance({ x: nextX, y: nextY }, enemy) < enemy.radius + bomb.radius) {
          shouldExplode = true;
          break;
        }
      }
    }

    if (!shouldExplode && state.boss.active && !state.boss.defeated && bombHitsBoss(state, nextX, nextY, bomb.radius)) {
      shouldExplode = true;
    }

    if (shouldExplode) {
      explodeSwarmBomb(state, bomb, index);
      continue;
    }

    bomb.x = nextX;
    bomb.y = nextY;
    bomb.vx *= 0.992;
    bomb.vy *= 0.992;
  }
}

function explodeSwarmBomb(state: GameState, bomb: BombState, bombIndex: number): void {
  state.bombs.splice(bombIndex, 1);

  for (let enemyIndex = state.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
    const enemy = state.enemies[enemyIndex];
    const dist = distance(bomb, enemy);
    if (dist > SWARM_BOMB_RADIUS + enemy.radius) {
      continue;
    }

    const falloff = 1 - clamp(dist / (SWARM_BOMB_RADIUS + enemy.radius), 0, 0.82);
    damageEnemy(state, enemy, SWARM_BOMB_DAMAGE * (0.42 + falloff));
  }

  if (state.boss.active && !state.boss.defeated && bombHitsBoss(state, bomb.x, bomb.y, SWARM_BOMB_RADIUS)) {
    damageBoss(state, SWARM_BOMB_DAMAGE * 0.72, bomb.x, bomb.y);
  }

  damageTilesInExplosion(state, bomb.x, bomb.y);

  const hazard: HazardState = {
    id: `swarm-${state.elapsed.toFixed(3)}-${bomb.id}`,
    kind: "swarmExplosion",
    x1: bomb.x,
    y1: bomb.y,
    x2: bomb.x,
    y2: bomb.y,
    radius: SWARM_BOMB_RADIUS,
    age: 0,
    duration: 0.36,
    damageAt: 0,
    damage: 0,
    applied: true
  };
  state.hazards.push(hazard);
  addEvent(state, "swarm-bomb-exploded", bomb.x, bomb.y, bomb.color);
}

function damageTilesInExplosion(state: GameState, x: number, y: number): void {
  const minTileX = Math.floor((x - SWARM_BOMB_RADIUS) / TILE_SIZE);
  const maxTileX = Math.floor((x + SWARM_BOMB_RADIUS) / TILE_SIZE);
  const minTileY = Math.floor((y - SWARM_BOMB_RADIUS) / TILE_SIZE);
  const maxTileY = Math.floor((y + SWARM_BOMB_RADIUS) / TILE_SIZE);

  for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const tile = state.world.tiles[tileY * state.world.width + tileX];
      if (!isSolid(tile) || tile.type === "ancient") {
        continue;
      }

      const tileCenter = {
        x: tile.x * TILE_SIZE + TILE_SIZE / 2,
        y: tile.y * TILE_SIZE + TILE_SIZE / 2
      };
      const dist = distance({ x, y }, tileCenter);
      if (dist > SWARM_BOMB_RADIUS) {
        continue;
      }

      const falloff = 1 - clamp(dist / SWARM_BOMB_RADIUS, 0, 0.88);
      const centerPunch = dist < TILE_SIZE * 1.25 ? 1.35 : 1;
      damageTile(state, tile, SWARM_BOMB_TILE_DAMAGE * (0.32 + falloff) * centerPunch);
    }
  }
}

function bombHitsBoss(state: GameState, x: number, y: number, radius: number): boolean {
  if (distance({ x, y }, { x: state.boss.x, y: state.boss.y }) < radius + 30) {
    return true;
  }

  for (const segment of state.boss.segments) {
    if (distance({ x, y }, segment) < radius + segment.radius) {
      return true;
    }
  }

  return false;
}

function updateDrillShotWeapon(state: GameState, actions: InputActions, dt: number): void {
  const player = state.player;

  if (player.overheatedTimer > 0) {
    player.overheatedTimer = Math.max(0, player.overheatedTimer - dt);
    player.heat = Math.max(0, player.heat - state.stats.heatCoolRate * dt * 0.65);
    player.weaponSpool = Math.max(0, player.weaponSpool - dt * 1.5);
    return;
  }

  if (actions.primaryFire) {
    player.weaponSpool = clamp(player.weaponSpool + dt * 1.15, 0, 1);
  } else {
    player.weaponSpool = Math.max(0, player.weaponSpool - dt * 1.35);
    player.heat = Math.max(0, player.heat - state.stats.heatCoolRate * dt);
    return;
  }

  player.heat = Math.max(0, player.heat - state.stats.heatCoolRate * dt * 0.28);
  if (player.weaponCooldown > 0) {
    return;
  }

  const aimDir = normalize({
    x: actions.aim.x - player.x,
    y: actions.aim.y - player.y
  });
  const direction = length(aimDir) === 0
    ? { x: Math.cos(player.angle), y: Math.sin(player.angle) }
    : aimDir;
  const fireInterval = lerp(PROJECTILE_BASE_INTERVAL, PROJECTILE_FAST_INTERVAL, player.weaponSpool);
  const shotHeat = lerp(5.2, 3.6, player.weaponSpool);
  player.heat += shotHeat;
  player.weaponCooldown = fireInterval;

  if (player.heat >= state.stats.heatCapacity) {
    player.heat = state.stats.heatCapacity;
    player.overheatedTimer = 1.45;
    addEvent(state, "overheat", player.x, player.y, 0xc45a4a);
    return;
  }

  const projectile: ProjectileState = {
    id: `shot-${state.elapsed.toFixed(3)}-${state.projectiles.length}`,
    x: player.x + direction.x * 24,
    y: player.y + direction.y * 24,
    vx: direction.x * PROJECTILE_SPEED + player.vx * 0.12,
    vy: direction.y * PROJECTILE_SPEED + player.vy * 0.12,
    radius: 5,
    age: 0,
    lifetime: PROJECTILE_LIFETIME,
    damage: 13 + state.upgrades.laserPower * 4,
    color: 0xe8c86a
  };
  state.projectiles.push(projectile);
  addEvent(state, "projectile-fired", projectile.x, projectile.y, projectile.color, player.weaponSpool);
}

function updateProjectiles(state: GameState, dt: number): void {
  for (let index = state.projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = state.projectiles[index];
    projectile.age += dt;
    const nextX = projectile.x + projectile.vx * dt;
    const nextY = projectile.y + projectile.vy * dt;

    if (projectile.age >= projectile.lifetime) {
      state.projectiles.splice(index, 1);
      continue;
    }

    const tile = tileAtWorld(state.world, nextX, nextY);
    if (isSolid(tile)) {
      const hitX = nextX;
      const hitY = nextY;
      const relevantOre = state.mission.focusedOre && tile.type === state.mission.focusedOre;
      damageTile(state, tile, projectile.damage * (tile.cracked ? 1.2 : 1));
      if (relevantOre) {
        triggerObjectiveWave(state, hitX, hitY);
      }
      addEvent(state, "projectile-hit", hitX, hitY, BLOCK_CONFIG[tile.type].glow, projectile.damage);
      state.projectiles.splice(index, 1);
      continue;
    }

    let hitEnemy = false;
    for (const enemy of state.enemies) {
      if (distance({ x: nextX, y: nextY }, enemy) < enemy.radius + projectile.radius) {
        damageEnemy(state, enemy, projectile.damage * 1.15);
        addEvent(state, "projectile-hit", nextX, nextY, ENEMY_CONFIG[enemy.kind].color, projectile.damage);
        hitEnemy = true;
        break;
      }
    }

    if (hitEnemy) {
      state.projectiles.splice(index, 1);
      continue;
    }

    if (state.boss.active && !state.boss.defeated && bombHitsBoss(state, nextX, nextY, projectile.radius)) {
      damageBoss(state, projectile.damage * 0.72, nextX, nextY);
      addEvent(state, "projectile-hit", nextX, nextY, 0x8a6db8, projectile.damage);
      state.projectiles.splice(index, 1);
      continue;
    }

    projectile.x = nextX;
    projectile.y = nextY;
  }
}

function updateMissionState(state: GameState): void {
  const task = getActiveTask(state.upgrades);
  const active = state.upgrades.activeTask;
  const previousOre = state.mission.focusedOre;
  const focusedOre = getFocusedObjectiveOre(state);
  state.mission.focusedOre = focusedOre;
  state.objectiveTargets = focusedOre ? findObjectiveTargets(state, focusedOre) : [];

  if (focusedOre !== previousOre) {
    addEvent(state, "objective-focused", state.player.x, state.player.y, focusedOre ? ORE_CONFIG[focusedOre].color : 0xe8c86a);
  }

  if (task && active?.taskId === task.id) {
    const completedStepCount = getTaskStepStates(state.upgrades, task).filter((step) => step.complete).length;
    if (completedStepCount > state.mission.completedStepCount) {
      addEvent(state, "objective-complete", state.player.x, state.player.y, focusedOre ? ORE_CONFIG[focusedOre].color : 0x5ab8a8, completedStepCount);
    }
    state.mission.completedStepCount = completedStepCount;
  } else {
    state.mission.completedStepCount = 0;
  }

  const craftReady = canCraftActiveTask(state.upgrades);
  if (craftReady && !state.mission.craftReady) {
    addEvent(state, "craft-ready", state.player.x, state.player.y, 0x5ab8a8);
  }
  state.mission.craftReady = craftReady;

  const cargoValue =
    state.inventory.ferrite * ORE_CONFIG.ferrite.value +
    state.inventory.shimmer * ORE_CONFIG.shimmer.value +
    state.inventory.voltaic * ORE_CONFIG.voltaic.value +
    state.inventory.aetherium * ORE_CONFIG.aetherium.value;
  const extractReady = cargoValue > 0 && distance(state.player, state.world.extraction) <= 96;
  if (extractReady && !state.mission.extractReady) {
    addEvent(state, "extract-ready", state.world.extraction.x, state.world.extraction.y, 0x5ab8a8);
  }
  state.mission.extractReady = extractReady;
}

function getFocusedObjectiveOre(state: GameState): OreId | null {
  const task = getActiveTask(state.upgrades);
  const active = state.upgrades.activeTask;
  if (!task || !active || active.taskId !== task.id || active.completed) {
    return null;
  }

  for (const requirement of task.requirements) {
    if (requirement.kind === "collect" && active.collected[requirement.ore] < requirement.amount) {
      return requirement.ore;
    }
  }

  return null;
}

function findObjectiveTargets(state: GameState, ore: OreId): ObjectiveTargetState[] {
  const playerTileX = Math.floor(state.player.x / TILE_SIZE);
  const playerTileY = Math.floor(state.player.y / TILE_SIZE);
  const candidates: Array<ObjectiveTargetState & { distanceSq: number }> = [];

  for (let y = playerTileY - OBJECTIVE_TARGET_RADIUS_TILES; y <= playerTileY + OBJECTIVE_TARGET_RADIUS_TILES; y += 1) {
    for (let x = playerTileX - OBJECTIVE_TARGET_RADIUS_TILES; x <= playerTileX + OBJECTIVE_TARGET_RADIUS_TILES; x += 1) {
      const tile = getTile(state.world, x, y);
      if (!isSolid(tile) || tile.type !== ore) {
        continue;
      }

      const dx = x - playerTileX;
      const dy = y - playerTileY;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > OBJECTIVE_TARGET_RADIUS_TILES * OBJECTIVE_TARGET_RADIUS_TILES) {
        continue;
      }

      candidates.push({ tileX: x, tileY: y, ore, distanceSq });
    }
  }

  return candidates
    .sort((a, b) => a.distanceSq - b.distanceSq)
    .slice(0, OBJECTIVE_TARGET_LIMIT)
    .map(({ tileX, tileY, ore: targetOre }) => ({ tileX, tileY, ore: targetOre }));
}

function triggerObjectiveWave(state: GameState, x: number, y: number): void {
  if (state.player.objectiveWaveCooldown > 0 || state.status !== "playing") {
    return;
  }

  state.player.objectiveWaveCooldown = OBJECTIVE_WAVE_COOLDOWN;
  state.mission.waveTimer = 1.2;
  const waveSize = state.threat.mood === "quiet" ? 2 : state.threat.mood === "waking" ? 3 : 4;
  let spawned = 0;
  for (let index = 0; index < waveSize; index += 1) {
    const enemy = createObjectiveWaveEnemy(state, index);
    if (enemy) {
      state.enemies.push(enemy);
      spawned += 1;
    }
  }

  if (spawned > 0) {
    state.threat.value = clamp(state.threat.value + spawned * 1.4, 0, state.threat.max);
    addEvent(state, "enemy-wave-started", x, y, 0xd4845a, spawned);
  }
}

function createObjectiveWaveEnemy(state: GameState, index: number): EnemyState | null {
  const kinds: EnemyState["kind"][] = ["sparkSac", "prismStalker", "sparkSac", "arcWarden"];
  const kind = kinds[(index + Math.floor(state.elapsed)) % kinds.length];
  const config = ENEMY_CONFIG[kind];
  const playerTileX = Math.floor(state.player.x / TILE_SIZE);
  const playerTileY = Math.floor(state.player.y / TILE_SIZE);

  for (let attempt = 0; attempt < 34; attempt += 1) {
    const angle = noiseFor(state.elapsed * 17 + index, attempt, 930) * Math.PI * 2;
    const radiusTiles = 17 + Math.floor(noiseFor(index + attempt, state.elapsed * 11, 931) * 11);
    const tileX = playerTileX + Math.round(Math.cos(angle) * radiusTiles);
    const tileY = playerTileY + Math.round(Math.sin(angle) * radiusTiles);
    const tile = getTile(state.world, tileX, tileY);
    if (isSolid(tile)) {
      continue;
    }

    const x = tileX * TILE_SIZE + TILE_SIZE / 2;
    const y = tileY * TILE_SIZE + TILE_SIZE / 2;
    if (distance({ x, y }, state.player) < 320 || circleHitsSolid(state, x, y, config.radius)) {
      continue;
    }

    return {
      id: `wave-${state.elapsed.toFixed(3)}-${index}-${state.enemies.length}`,
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      anchorX: x,
      anchorY: y,
      health: config.health,
      maxHealth: config.health,
      radius: config.radius,
      state: kind === "prismStalker" ? "patrol" : kind === "arcWarden" ? "idle" : "chase",
      cooldown: 0.75 + index * 0.18,
      timer: noiseFor(x, y, 932) * 2,
      direction: noiseFor(y, x, 933) > 0.5 ? 1 : -1,
      targetX: state.player.x,
      targetY: state.player.y
    };
  }

  return null;
}

function updateEnemies(state: GameState, dt: number): void {
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    const playerDistance = distance(enemy, state.player);

    if (enemy.kind === "arcWarden") {
      enemy.timer += dt;
      const pulseActive = enemy.timer % 3.2 < 1.28;
      enemy.state = pulseActive ? "pulsing" : "idle";
      if (pulseActive && playerDistance < 70) {
        damagePlayer(state, ENEMY_CONFIG.arcWarden.damage * dt * 1.3, enemy.x, enemy.y);
      }
    }

    if (enemy.kind === "prismStalker") {
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);

      if (enemy.state === "patrol") {
        enemy.x += enemy.direction * 64 * dt;
        if (Math.abs(enemy.x - enemy.anchorX) > 74) {
          enemy.direction *= -1;
        }

        if (playerDistance < 250 && enemy.cooldown <= 0) {
          enemy.state = "windup";
          enemy.timer = 0.36;
          enemy.targetX = state.player.x;
          enemy.targetY = state.player.y;
        }
      } else if (enemy.state === "windup") {
        enemy.timer -= dt;
        if (enemy.timer <= 0) {
          const dir = normalize({ x: enemy.targetX - enemy.x, y: enemy.targetY - enemy.y });
          enemy.vx = dir.x * 360;
          enemy.vy = dir.y * 360;
          enemy.timer = 0.42;
          enemy.state = "dash";
        }
      } else if (enemy.state === "dash") {
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.timer -= dt;
        if (playerDistance < enemy.radius + 14) {
          damagePlayer(state, ENEMY_CONFIG.prismStalker.damage, enemy.x, enemy.y);
        }
        if (enemy.timer <= 0) {
          enemy.cooldown = 1.6;
          enemy.state = "patrol";
          enemy.vx = 0;
          enemy.vy = 0;
        }
      }
    }

    if (enemy.kind === "sparkSac") {
      const dir = normalize({ x: state.player.x - enemy.x, y: state.player.y - enemy.y });
      enemy.vx = lerp(enemy.vx, dir.x * 78, 0.05);
      enemy.vy = lerp(enemy.vy, dir.y * 78, 0.05);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;
      enemy.timer += dt;

      if (playerDistance < 42 || enemy.timer > 11) {
        explodeSparkSac(state, enemy);
        state.enemies.splice(index, 1);
      }
    }
  }
}

function updateBoss(state: GameState, dt: number): void {
  const boss = state.boss;
  if (!boss.active || boss.defeated) {
    return;
  }

  const dir = normalize({ x: state.player.x - boss.x, y: state.player.y - boss.y });
  boss.vx = lerp(boss.vx, dir.x * 126, 0.035);
  boss.vy = lerp(boss.vy, dir.y * 126, 0.035);
  boss.x += boss.vx * dt;
  boss.y += boss.vy * dt;

  const previous: BossSegmentState = { x: boss.x, y: boss.y, radius: 26 };
  for (const segment of boss.segments) {
    const segmentDir = normalize({ x: previous.x - segment.x, y: previous.y - segment.y });
    const desired = previous.radius + segment.radius + 5;
    const gap = distance(segment, previous);
    if (gap > desired) {
      segment.x += segmentDir.x * (gap - desired) * 0.18;
      segment.y += segmentDir.y * (gap - desired) * 0.18;
    }
    previous.x = segment.x;
    previous.y = segment.y;
    previous.radius = segment.radius;

    if (distance(segment, state.player) < segment.radius + 11) {
      damagePlayer(state, 15 * dt, segment.x, segment.y);
    }
  }

  if (distance({ x: boss.x, y: boss.y }, state.player) < 42) {
    damagePlayer(state, 18 * dt, boss.x, boss.y);
  }

  boss.cooldown -= dt;
  if (boss.cooldown <= 0) {
    boss.cooldown = 2.15;
    const spread = normalize({ x: state.player.x - boss.x, y: state.player.y - boss.y });
    createLightning(state, boss.x, boss.y, boss.x + spread.x * 380, boss.y + spread.y * 380);
  }
}

function updateHazards(state: GameState, dt: number): void {
  for (let index = state.hazards.length - 1; index >= 0; index -= 1) {
    const hazard = state.hazards[index];
    hazard.age += dt;

    if (!hazard.applied && hazard.age >= hazard.damageAt) {
      hazard.applied = true;
      if (hazard.kind === "lightning") {
        const dist = distanceToSegment(state.player, { x: hazard.x1, y: hazard.y1 }, { x: hazard.x2, y: hazard.y2 });
        if (dist < hazard.radius) {
          damagePlayer(state, hazard.damage, hazard.x1, hazard.y1);
        }
      } else {
        const dist = distance(state.player, { x: hazard.x1, y: hazard.y1 });
        if (dist < hazard.radius) {
          damagePlayer(state, hazard.damage, hazard.x1, hazard.y1);
        }
      }
    }

    if (hazard.age >= hazard.duration) {
      state.hazards.splice(index, 1);
    }
  }
}

function updatePickups(state: GameState, dt: number): void {
  for (let index = state.pickups.length - 1; index >= 0; index -= 1) {
    const pickup = state.pickups[index];
    pickup.age += dt;
    const dist = distance(pickup, state.player);

    if (dist < state.stats.magnetRadius) {
      pickup.magnetized = true;
    }

    if (pickup.magnetized) {
      const dir = normalize({ x: state.player.x - pickup.x, y: state.player.y - pickup.y });
      const force = 440 + Math.max(0, state.stats.magnetRadius - dist) * 4.8;
      pickup.vx = lerp(pickup.vx, dir.x * force, 0.15);
      pickup.vy = lerp(pickup.vy, dir.y * force, 0.15);
    } else {
      pickup.vx *= PICKUP_FRICTION;
      pickup.vy = pickup.vy * PICKUP_FRICTION + 14 * dt;
    }

    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;

    if (dist < 20) {
      state.inventory[pickup.ore] += 1;
      const activeTask = getActiveTask(state.upgrades);
      const contributesToTask = Boolean(
        activeTask?.requirements.some((requirement) => requirement.kind === "collect" && requirement.ore === pickup.ore)
      );
      recordTaskCollection(state.upgrades, pickup.ore, 1);
      state.player.collectionPulse = 0.18;
      addEvent(state, "pickup-collected", pickup.x, pickup.y, ORE_CONFIG[pickup.ore].color);
      if (contributesToTask) {
        addEvent(state, "task-progress", pickup.x, pickup.y, ORE_CONFIG[pickup.ore].color, 1);
      }
      state.pickups.splice(index, 1);
    }
  }
}

function damageTile(state: GameState, tile: TileState, amount: number): void {
  tile.health -= amount * (tile.cracked ? 1.45 : 1);
  state.threat.value = clamp(state.threat.value + amount * 0.006, 0, state.threat.max);

  if (tile.health > 0) {
    return;
  }

  tile.destroyed = true;
  tile.health = 0;
  state.minedBlocks += 1;
  const config = BLOCK_CONFIG[tile.type];
  const centerX = tile.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = tile.y * TILE_SIZE + TILE_SIZE / 2;
  state.threat.value = clamp(state.threat.value + 0.5, 0, state.threat.max);

  if (config.drop) {
    const count = config.dropMin + Math.floor(noiseFor(tile.x, tile.y, 500) * (config.dropMax - config.dropMin + 1));
    for (let index = 0; index < count; index += 1) {
      spawnPickup(state, config.drop, centerX, centerY, index);
    }
    state.threat.value = clamp(state.threat.value + ORE_CONFIG[config.drop].threat, 0, state.threat.max);
  }

  addEvent(state, "tile-broken", centerX, centerY, config.glow);
}

function spawnPickup(state: GameState, ore: OreId, x: number, y: number, index: number): void {
  const angle = noiseFor(x + index, y, 601) * Math.PI * 2;
  const speed = 50 + noiseFor(y, x + index, 602) * 90;
  const pickup: PickupState = {
    id: `pickup-${state.elapsed.toFixed(3)}-${state.pickups.length}-${index}`,
    ore,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    magnetized: false,
    age: 0
  };
  state.pickups.push(pickup);
}

function damageEnemy(state: GameState, enemy: EnemyState, amount: number): void {
  enemy.health -= amount;
  addEvent(state, "enemy-hit", enemy.x, enemy.y, ENEMY_CONFIG[enemy.kind].color, amount);

  if (enemy.health > 0) {
    return;
  }

  const index = state.enemies.indexOf(enemy);
  if (index >= 0) {
    state.enemies.splice(index, 1);
  }

  if (enemy.kind === "sparkSac") {
    explodeSparkSac(state, enemy);
  }

  state.enemiesKilled += 1;
  state.threat.value = clamp(state.threat.value + ENEMY_CONFIG[enemy.kind].threatOnKill, 0, state.threat.max);
  addEvent(state, "enemy-killed", enemy.x, enemy.y, ENEMY_CONFIG[enemy.kind].color);
}

function explodeSparkSac(state: GameState, enemy: EnemyState): void {
  const hazard: HazardState = {
    id: `spark-${state.elapsed.toFixed(3)}-${enemy.id}`,
    kind: "sparkExplosion",
    x1: enemy.x,
    y1: enemy.y,
    x2: enemy.x,
    y2: enemy.y,
    radius: 82,
    age: 0,
    duration: 0.42,
    damageAt: 0.06,
    damage: ENEMY_CONFIG.sparkSac.damage,
    applied: false
  };
  state.hazards.push(hazard);
  addEvent(state, "enemy-killed", enemy.x, enemy.y, ENEMY_CONFIG.sparkSac.color);
}

function startBossBreakout(state: GameState): void {
  const boss = state.boss;
  boss.active = true;
  boss.defeated = false;
  boss.health = boss.maxHealth;
  boss.x = clamp(state.player.x + 620, 220, state.world.width * TILE_SIZE - 220);
  boss.y = clamp(state.player.y - 180, 120, state.world.height * TILE_SIZE - 120);
  boss.vx = -80;
  boss.vy = 20;
  boss.cooldown = 1.25;
  boss.segments = Array.from({ length: 7 }, (_, index) => ({
    x: boss.x + (index + 1) * 34,
    y: boss.y + Math.sin(index) * 12,
    radius: Math.max(17, 26 - index)
  }));
  state.threat.mood = "breakout";
  addEvent(state, "boss-breakout", state.player.x, state.player.y, 0x8a6db8);
}

function damageBoss(state: GameState, amount: number, x: number, y: number): void {
  if (!state.boss.active || state.boss.defeated) {
    return;
  }

  state.boss.health -= amount;
  addEvent(state, "boss-hit", x, y, 0x8a6db8, amount);

  if (state.boss.health <= 0) {
    state.boss.health = 0;
    state.boss.defeated = true;
    state.boss.active = false;
    state.threat.value = Math.min(state.threat.value, state.threat.max * 0.42);
    state.threat.zoneTimer = 0;
    recordBossAchievement(state.upgrades, "voltrixCore");
    addEvent(state, "boss-defeated", state.boss.x, state.boss.y, 0xc47a8a);
  }
}

function createLightning(state: GameState, x1: number, y1: number, x2: number, y2: number): void {
  state.hazards.push({
    id: `lightning-${state.elapsed.toFixed(3)}-${state.hazards.length}`,
    kind: "lightning",
    x1,
    y1,
    x2,
    y2,
    radius: 22,
    age: 0,
    duration: 0.72,
    damageAt: 0.34,
    damage: 18,
    applied: false
  });
}

function damagePlayer(state: GameState, amount: number, x: number, y: number): void {
  if (amount <= 0 || state.player.invulnerableTimer > 0) {
    return;
  }

  state.player.hull = Math.max(0, state.player.hull - amount);
  state.player.invulnerableTimer = 0.35;
  addEvent(state, "player-hit", x, y, 0xc45a4a, amount);
}

function circleHitsSolid(state: GameState, x: number, y: number, radius: number): boolean {
  const minX = Math.floor((x - radius) / TILE_SIZE);
  const maxX = Math.floor((x + radius) / TILE_SIZE);
  const minY = Math.floor((y - radius) / TILE_SIZE);
  const maxY = Math.floor((y + radius) / TILE_SIZE);

  for (let ty = minY; ty <= maxY; ty += 1) {
    for (let tx = minX; tx <= maxX; tx += 1) {
      const tile = state.world.tiles[ty * state.world.width + tx];
      if (!tile) {
        return true;
      }

      if (isSolid(tile)) {
        return true;
      }
    }
  }

  return false;
}

function updateThreatMood(state: GameState): void {
  if (state.boss.active) {
    state.threat.mood = "breakout";
    return;
  }

  if (state.threat.value > 68) {
    state.threat.mood = "surging";
  } else if (state.threat.value > 36) {
    state.threat.mood = "waking";
  } else {
    state.threat.mood = "quiet";
  }
}

function addEvent(state: GameState, type: GameEvent["type"], x: number, y: number, color: number, amount?: number): void {
  state.events.push({ type, x, y, color, amount });
}

function normalize(vector: Vec2): Vec2 {
  const magnitude = length(vector);
  if (magnitude <= 0.0001) {
    return { x: 0, y: 0 };
  }

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude
  };
}

function length(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const ap = { x: point.x - a.x, y: point.y - a.y };
  const abLength = ab.x * ab.x + ab.y * ab.y;
  const t = abLength === 0 ? 0 : clamp((ap.x * ab.x + ap.y * ab.y) / abLength, 0, 1);
  const closest = {
    x: a.x + ab.x * t,
    y: a.y + ab.y * t
  };
  return distance(point, closest);
}

function rayCircle(origin: Vec2, dir: Vec2, circle: Vec2 & { radius: number }, radius: number): { distance: number; x: number; y: number } | null {
  const toCircle = { x: circle.x - origin.x, y: circle.y - origin.y };
  const projection = toCircle.x * dir.x + toCircle.y * dir.y;
  if (projection < 0) {
    return null;
  }

  const closest = {
    x: origin.x + dir.x * projection,
    y: origin.y + dir.y * projection
  };
  const dist = distance(closest, circle);
  if (dist > radius) {
    return null;
  }

  return {
    distance: projection,
    x: closest.x,
    y: closest.y
  };
}

function noiseFor(x: number, y: number, salt: number): number {
  const xi = Math.floor(x * 13 + salt * 37);
  const yi = Math.floor(y * 17 + salt * 41);
  let value = xi * 374761393 + yi * 668265263;
  value = (value ^ (value >> 13)) * 1274126177;
  return ((value ^ (value >> 16)) >>> 0) / 4294967295;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
