import { BLOCK_CONFIG, ENEMY_CONFIG, ORE_CONFIG, WEAPON_CONFIG } from "../../content/config";
import { finishRun, storeCargo } from "../state";
import { canCraftActiveTask, getActiveTask, getTaskStepStates, hasUnlock, recordBossAchievement, recordTaskCollection } from "./progression";
import {
  TILE_SIZE,
  type BlockId,
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
  type PowerDropId,
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
const OBJECTIVE_TARGET_RADIUS_TILES = 34;
const OBJECTIVE_TARGET_LIMIT = 42;
const OBJECTIVE_TARGET_CACHE_TILE_STEP = 3;
const OBJECTIVE_WAVE_COOLDOWN = 8.5;
const CHASE_PATH_MARGIN_TILES = 12;
const CHASE_PATH_MAX_VISITS = 360;
const CHASE_PATH_FRAME_BUDGET = 2;
const CHASE_PATH_CACHE_TIME = 0.55;
const CHASE_PATH_REPATH_TILES = 3;
const ENEMY_ACTIVE_DISTANCE = 1350;
const ENEMY_ACTIVE_DISTANCE_SQ = ENEMY_ACTIVE_DISTANCE * ENEMY_ACTIVE_DISTANCE;
const NEAR_MISS_DISTANCE = 10;
const PLAYER_DAMAGE_KNOCKBACK = 118;
const PLAYER_DAMAGE_KNOCKBACK_MAX_SPEED = 360;
const POWER_DROP_COLORS: Record<PowerDropId, number> = {
  repairPack: 0xc45a4a,
  coolantCell: 0x5ab8a8,
  overdriveCell: 0xe8c86a,
  shieldCell: 0x8a6db8
};

interface PathTile {
  x: number;
  y: number;
}

type EnemyDraft = Omit<EnemyState, "elite" | "eliteTier">;

interface ChasePathCache {
  goalTile: PathTile;
  waypoint: Vec2;
  expiresAt: number;
}

interface ObjectiveTargetCache {
  ore: OreId | null;
  tileX: number;
  tileY: number;
  targets: ObjectiveTargetState[];
}

const chasePathCache = new WeakMap<Vec2, ChasePathCache>();
const objectiveTargetCache = new WeakMap<GameState, ObjectiveTargetCache>();
let chasePathBudget = CHASE_PATH_FRAME_BUDGET;

export function updateGame(state: GameState, actions: InputActions, dt: number): void {
  state.events = [];
  chasePathBudget = CHASE_PATH_FRAME_BUDGET;

  if (state.status !== "playing") {
    state.beam.active = false;
    return;
  }

  if (state.hitStopTimer > 0) {
    state.hitStopTimer = Math.max(0, state.hitStopTimer - dt);
    state.beam.active = false;
    return;
  }

  state.elapsed += dt;
  state.threat.zoneTimer += dt;
  state.threat.value = clamp(state.threat.value + dt * 0.32, 0, state.threat.max);
  state.mission.introTimer = Math.max(0, state.mission.introTimer - dt);
  updateRewardTimers(state, dt);
  if (!state.mission.started) {
    state.mission.started = true;
    addEvent(state, "mission-started", state.player.x, state.player.y, 0xe8c86a);
  }
  state.player.invulnerableTimer = Math.max(0, state.player.invulnerableTimer - dt);
  state.player.dashCooldown = Math.max(0, state.player.dashCooldown - dt);
  state.player.bombCooldown = Math.max(0, state.player.bombCooldown - dt);
  state.player.weaponCooldown = Math.max(0, state.player.weaponCooldown - dt);
  state.player.blastRepeatCooldown = Math.max(0, state.player.blastRepeatCooldown - dt);
  state.player.shieldActiveTimer = Math.max(0, state.player.shieldActiveTimer - dt);
  state.player.shieldCooldown = Math.max(0, state.player.shieldCooldown - dt);
  if (state.player.shieldActiveTimer <= 0 && state.player.shield < state.player.shieldMax) {
    state.player.shield = Math.min(state.player.shieldMax, state.player.shield + 9 * dt);
  }
  state.player.objectiveWaveCooldown = Math.max(0, state.player.objectiveWaveCooldown - dt);
  state.mission.waveTimer = Math.max(0, state.mission.waveTimer - dt);
  updateBlastRecharge(state, dt);
  state.player.collectionPulse = Math.max(0, state.player.collectionPulse - dt);

  state.beam.active = false;

  updateThreatMood(state);
  updateThreatDirection(state);
  movePlayer(state, actions, dt);
  activateShield(state, actions);
  fireSwarmBomb(state, actions);
  updateDrillShotWeapon(state, actions, dt);
  updateProjectiles(state, dt);
  updateEnemies(state, dt);
  updateBoss(state, dt);
  updateBombs(state, dt);
  updateHazards(state, dt);
  updatePickups(state, dt);
  updateMissionState(state);

  if (actions.extractPressed) {
    if (storeCargo(state)) {
      addEvent(state, "store-called", state.player.x, state.player.y, 0x5ab8a8);
    }
  }

  if (!state.boss.active && !state.boss.defeated && state.threat.value >= state.threat.max) {
    startBossBreakout(state);
  }

  if (state.player.hull <= 0) {
    finishRun(state, "destroyed");
  }
}

function updateRewardTimers(state: GameState, dt: number): void {
  state.player.temporarySpeedBoostTimer = Math.max(0, state.player.temporarySpeedBoostTimer - dt);
  state.player.weaponBoostTimer = Math.max(0, state.player.weaponBoostTimer - dt);
  state.player.miningStreak.timer = Math.max(0, state.player.miningStreak.timer - dt);
  state.player.miningStreak.magnetBoostTimer = Math.max(0, state.player.miningStreak.magnetBoostTimer - dt);
  if (state.player.miningStreak.timer <= 0) {
    state.player.miningStreak.ore = null;
    state.player.miningStreak.count = 0;
  }

  state.threat.dangerSwellTimer = Math.max(0, state.threat.dangerSwellTimer - dt);
  if (!state.threat.dangerSwellTriggered && state.threat.value >= state.threat.max * 0.9) {
    state.threat.dangerSwellTriggered = true;
    state.threat.dangerSwellTimer = 3;
    addEvent(state, "danger-swell", state.player.x, state.player.y, 0xc45a4a);
  }
}

function movePlayer(state: GameState, actions: InputActions, dt: number): void {
  const move = normalize(actions.move);
  const speed = state.stats.moveSpeed * (state.player.temporarySpeedBoostTimer > 0 ? 1.22 : 1);
  const targetVx = move.x * speed;
  const targetVy = move.y * speed;
  state.player.vx = lerp(state.player.vx, targetVx, 0.22);
  state.player.vy = lerp(state.player.vy, targetVy, 0.22);

  if (actions.dashPressed && state.player.dashCooldown <= 0) {
    if (!hasUnlock(state.upgrades, "dashModule")) {
      addEvent(state, "ability-locked", state.player.x, state.player.y, 0xc45a4a);
      return;
    }
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

  if (!hasUnlock(state.upgrades, "swarmBlast")) {
    addEvent(state, "ability-locked", state.player.x, state.player.y, 0xc45a4a);
    state.player.blastRepeatCooldown = 0.25;
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

function activateShield(state: GameState, actions: InputActions): void {
  if (!actions.shieldPressed) {
    return;
  }

  if (!hasUnlock(state.upgrades, "shieldEmitter")) {
    addEvent(state, "ability-locked", state.player.x, state.player.y, 0xc45a4a);
    return;
  }

  if (state.player.shieldCooldown > 0 || state.player.shield <= 0) {
    return;
  }

  state.player.shieldActiveTimer = 2.2;
  state.player.shieldCooldown = 5.8;
  state.player.shield = state.player.shieldMax;
  addEvent(state, "shield-activated", state.player.x, state.player.y, 0x5ab8a8);
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
      if (!tile) {
        continue;
      }
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
  const weapon = WEAPON_CONFIG[state.upgrades.equippedWeapon] ?? WEAPON_CONFIG.drillShot;

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
  const boosted = player.weaponBoostTimer > 0;
  const fireInterval = lerp(weapon.baseInterval, weapon.fastInterval, player.weaponSpool) * (boosted ? 0.82 : 1);
  const shotHeat = lerp(weapon.heatMax, weapon.heatMin, player.weaponSpool) * (boosted ? 0.86 : 1);
  player.heat += shotHeat;
  player.weaponCooldown = fireInterval;

  if (player.heat >= state.stats.heatCapacity) {
    player.heat = state.stats.heatCapacity;
    player.overheatedTimer = 1.45;
    addEvent(state, "overheat", player.x, player.y, 0xc45a4a);
    return;
  }

  const baseAngle = Math.atan2(direction.y, direction.x);
  for (let index = 0; index < weapon.projectileCount; index += 1) {
    const spreadIndex = index - (weapon.projectileCount - 1) / 2;
    const angle = baseAngle + spreadIndex * weapon.spread;
    const projectile: ProjectileState = {
      id: `shot-${state.elapsed.toFixed(3)}-${state.projectiles.length}-${index}`,
      owner: "player",
      x: player.x + Math.cos(angle) * 24,
      y: player.y + Math.sin(angle) * 24,
      vx: Math.cos(angle) * weapon.speed + player.vx * 0.12,
      vy: Math.sin(angle) * weapon.speed + player.vy * 0.12,
      radius: weapon.id === "piercer" ? 6 : 5,
      age: 0,
      lifetime: weapon.lifetime,
      damage: (weapon.damage + state.upgrades.laserPower * (weapon.id === "scatter" ? 2.4 : 4)) * (boosted ? 1.24 : 1),
      color: weapon.id === "piercer" ? 0xf0e4cc : weapon.id === "scatter" ? 0xd4845a : 0xe8c86a,
      pierces: weapon.pierces,
      nearMissed: false
    };
    state.projectiles.push(projectile);
    addEvent(state, "projectile-fired", projectile.x, projectile.y, projectile.color, player.weaponSpool);
  }
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
    if (projectile.owner === "enemy") {
      if (isSolid(tile)) {
        addEvent(state, "projectile-hit", nextX, nextY, projectile.color, projectile.damage);
        state.projectiles.splice(index, 1);
        continue;
      }

      if (distance({ x: nextX, y: nextY }, state.player) < projectile.radius + 13) {
        damagePlayer(state, projectile.damage, nextX, nextY);
        addEvent(state, "projectile-hit", nextX, nextY, projectile.color, projectile.damage);
        state.projectiles.splice(index, 1);
        continue;
      }

      if (!projectile.nearMissed) {
        const nearDistance = distanceToSegment(state.player, { x: projectile.x, y: projectile.y }, { x: nextX, y: nextY });
        if (nearDistance <= projectile.radius + NEAR_MISS_DISTANCE) {
          projectile.nearMissed = true;
          state.player.temporarySpeedBoostTimer = Math.max(state.player.temporarySpeedBoostTimer, 0.3);
          addEvent(state, "near-miss", nextX, nextY, 0xf0e4cc);
        }
      }

      projectile.x = nextX;
      projectile.y = nextY;
      continue;
    }

    if (isSolid(tile)) {
      const hitX = nextX;
      const hitY = nextY;
      const relevantOre = state.mission.focusedOre && tile.type === state.mission.focusedOre;
      damageTile(state, tile, projectile.damage * (tile.cracked ? 1.2 : 1));
      if (relevantOre) {
        triggerObjectiveWave(state, hitX, hitY);
      }
      addEvent(state, "projectile-hit", hitX, hitY, BLOCK_CONFIG[tile.type].glow, projectile.damage);
      if (projectile.pierces <= 0) {
        state.projectiles.splice(index, 1);
      } else {
        projectile.pierces -= 1;
        projectile.x = nextX;
        projectile.y = nextY;
      }
      continue;
    }

    let hitEnemy = false;
    for (const enemy of state.enemies) {
      if (distance({ x: nextX, y: nextY }, enemy) < enemy.radius + projectile.radius) {
        damageEnemy(state, enemy, projectile.damage * 1.15);
        addEvent(state, "projectile-hit", nextX, nextY, ENEMY_CONFIG[enemy.kind].color, projectile.damage);
        hitEnemy = true;
        if (projectile.pierces > 0) {
          projectile.pierces -= 1;
          hitEnemy = false;
        }
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
  state.objectiveTargets = focusedOre ? getCachedObjectiveTargets(state, focusedOre) : [];

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
  const extractReady = cargoValue > 0;
  if (extractReady && !state.mission.extractReady) {
    addEvent(state, "extract-ready", state.player.x, state.player.y, 0x5ab8a8);
  }
  state.mission.extractReady = extractReady;
}

function getCachedObjectiveTargets(state: GameState, ore: OreId): ObjectiveTargetState[] {
  const playerTileX = Math.floor(Math.floor(state.player.x / TILE_SIZE) / OBJECTIVE_TARGET_CACHE_TILE_STEP);
  const playerTileY = Math.floor(Math.floor(state.player.y / TILE_SIZE) / OBJECTIVE_TARGET_CACHE_TILE_STEP);
  const cached = objectiveTargetCache.get(state);
  if (cached && cached.ore === ore && cached.tileX === playerTileX && cached.tileY === playerTileY) {
    return cached.targets;
  }

  const targets = findObjectiveTargets(state, ore);
  objectiveTargetCache.set(state, {
    ore,
    tileX: playerTileX,
    tileY: playerTileY,
    targets
  });
  return targets;
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
    if (distance({ x, y }, state.player) < 320 || !isValidEnemySpawn(state, x, y, config.radius)) {
      continue;
    }

    return applyEliteRoll({
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
    }, state.elapsed + index, x, y);
  }

  return null;
}

function applyEliteRoll(enemy: EnemyDraft, seedValue: number, x: number, y: number): EnemyState {
  const elite = noiseFor(seedValue, x + enemy.radius, 934) < 0.12;
  if (!elite) {
    return {
      ...enemy,
      elite: false,
      eliteTier: null
    };
  }

  return {
    ...enemy,
    elite: true,
    eliteTier: 1,
    health: enemy.health * 1.8,
    maxHealth: enemy.maxHealth * 1.8,
    radius: enemy.radius * 1.3
  };
}

function updateEnemies(state: GameState, dt: number): void {
  for (let index = state.enemies.length - 1; index >= 0; index -= 1) {
    const enemy = state.enemies[index];
    const dxToPlayer = enemy.x - state.player.x;
    const dyToPlayer = enemy.y - state.player.y;
    const playerDistanceSq = dxToPlayer * dxToPlayer + dyToPlayer * dyToPlayer;
    if (playerDistanceSq > ENEMY_ACTIVE_DISTANCE_SQ) {
      enemy.timer += dt * 0.25;
      continue;
    }
    const playerDistance = Math.sqrt(playerDistanceSq);

    if (enemy.kind === "arcWarden") {
      enemy.timer += dt;
      const pulseActive = enemy.timer % 3.2 < 1.28;
      enemy.state = pulseActive ? "pulsing" : "idle";
      if (pulseActive && playerDistance < 70) {
        damagePlayer(state, enemyDamage(enemy) * dt * 1.3, enemy.x, enemy.y);
      }
    }

    if (enemy.kind === "prismStalker") {
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);

      if (enemy.state === "patrol") {
        const moved = moveEnemyWithCollision(state, enemy, enemy.direction * 64 * dt, 0, 0.18);
        if (moved.hitX) {
          enemy.direction *= -1;
        }
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
        const moved = moveEnemyWithCollision(state, enemy, enemy.vx * dt, enemy.vy * dt, -0.22);
        if (moved.hitX || moved.hitY) {
          enemy.timer = 0;
        }
        enemy.timer -= dt;
        if (playerDistance < enemy.radius + 14) {
          damagePlayer(state, enemyDamage(enemy), enemy.x, enemy.y);
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
      const dir = getChaseDirection(state, enemy, state.player, Math.max(8, enemy.radius * 0.72));
      enemy.vx = lerp(enemy.vx, dir.x * 78, 0.05);
      enemy.vy = lerp(enemy.vy, dir.y * 78, 0.05);
      const moved = moveEnemyWithCollision(state, enemy, enemy.vx * dt, enemy.vy * dt, 0.05);
      if (moved.hitX || moved.hitY) {
        enemy.timer += 1.4 * dt;
      }
      enemy.timer += dt;

      if (playerDistance < 42 || enemy.timer > 11) {
        explodeSparkSac(state, enemy);
        state.enemies.splice(index, 1);
      }
    }

    if (enemy.kind === "phaseMite") {
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      enemy.timer += dt;
      const playerDir = getChaseDirection(state, enemy, state.player, Math.max(8, enemy.radius * 0.72));
      const orbit = {
        x: -playerDir.y * Math.sin(enemy.timer * 2.4),
        y: playerDir.x * Math.sin(enemy.timer * 2.4)
      };
      enemy.vx = lerp(enemy.vx, (playerDir.x * 96 + orbit.x * 78), 0.045);
      enemy.vy = lerp(enemy.vy, (playerDir.y * 96 + orbit.y * 78), 0.045);
      const moved = moveEnemyWithCollision(state, enemy, enemy.vx * dt, enemy.vy * dt, -0.12);
      if (moved.hitX || moved.hitY) {
        enemy.cooldown = Math.max(enemy.cooldown, 0.34);
      }

      if (enemy.cooldown <= 0 && playerDistance < 280) {
        enemy.cooldown = 1.55;
        fireHostileProjectile(state, enemy.x, enemy.y, state.player.x, state.player.y, 260, enemyDamage(enemy) * 0.9, 0xe8c86a, 0.06);
      }

      if (playerDistance < enemy.radius + 13) {
        damagePlayer(state, enemyDamage(enemy), enemy.x, enemy.y);
      }
    }
  }
}

function updateBoss(state: GameState, dt: number): void {
  const boss = state.boss;
  if (!boss.active || boss.defeated) {
    return;
  }

  const dir = getChaseDirection(state, boss, state.player, 28);
  const bossSpeed = boss.kind === "sentinelEye" ? 92 : 126;
  boss.vx = lerp(boss.vx, dir.x * bossSpeed, 0.035);
  boss.vy = lerp(boss.vy, dir.y * bossSpeed, 0.035);
  const bossMoved = moveCircleWithCollision(state, boss.x, boss.y, boss.vx * dt, boss.vy * dt, 28, -0.08);
  boss.x = bossMoved.x;
  boss.y = bossMoved.y;
  if (bossMoved.hitX) {
    boss.vx *= -0.08;
  }
  if (bossMoved.hitY) {
    boss.vy *= -0.08;
  }

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
    boss.cooldown = boss.kind === "sentinelEye" ? 1.25 : 1.85;
    const spread = normalize({ x: state.player.x - boss.x, y: state.player.y - boss.y });
    const baseAngle = Math.atan2(spread.y, spread.x);
    const bulletCount = boss.kind === "sentinelEye" ? 5 : 3;
    for (let index = 0; index < bulletCount; index += 1) {
      const offset = index - (bulletCount - 1) / 2;
      fireHostileProjectile(
        state,
        boss.x,
        boss.y,
        boss.x + Math.cos(baseAngle + offset * 0.18) * 240,
        boss.y + Math.sin(baseAngle + offset * 0.18) * 240,
        boss.kind === "sentinelEye" ? 310 : 280,
        boss.kind === "sentinelEye" ? 12 : 14,
        boss.kind === "sentinelEye" ? 0xe8c86a : 0x8a6db8,
        0
      );
    }
    if (boss.kind === "sentinelEye") {
      const sideAngle = baseAngle + Math.PI / 2;
      fireHostileProjectile(state, boss.x, boss.y, boss.x + Math.cos(sideAngle) * 260, boss.y + Math.sin(sideAngle) * 260, 230, 10, 0xf0d38a, 0);
      fireHostileProjectile(state, boss.x, boss.y, boss.x - Math.cos(sideAngle) * 260, boss.y - Math.sin(sideAngle) * 260, 230, 10, 0xf0d38a, 0);
    }
  }
}

function fireHostileProjectile(
  state: GameState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  speed: number,
  damage: number,
  color: number,
  spread: number
): void {
  const angle = Math.atan2(toY - fromY, toX - fromX) + spread;
  state.projectiles.push({
    id: `enemy-shot-${state.elapsed.toFixed(3)}-${state.projectiles.length}`,
    owner: "enemy",
    x: fromX + Math.cos(angle) * 24,
    y: fromY + Math.sin(angle) * 24,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 7,
    age: 0,
    lifetime: 2.2,
    damage,
    color,
    pierces: 0,
    nearMissed: false
  });
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

    const magnetRadius = state.stats.magnetRadius * (state.player.miningStreak.magnetBoostTimer > 0 ? 1.3 : 1);
    if (dist < magnetRadius) {
      pickup.magnetized = true;
    }

    if (pickup.magnetized) {
      const dir = normalize({ x: state.player.x - pickup.x, y: state.player.y - pickup.y });
      const force = 440 + Math.max(0, magnetRadius - dist) * 4.8;
      pickup.vx = lerp(pickup.vx, dir.x * force, 0.15);
      pickup.vy = lerp(pickup.vy, dir.y * force, 0.15);
    } else {
      pickup.vx *= PICKUP_FRICTION;
      pickup.vy = pickup.vy * PICKUP_FRICTION + 14 * dt;
    }

    pickup.x += pickup.vx * dt;
    pickup.y += pickup.vy * dt;

    if (dist < 20) {
      if (pickup.kind === "power" && pickup.power) {
        applyPowerPickup(state, pickup.power);
        addEvent(state, "power-pickup-collected", pickup.x, pickup.y, POWER_DROP_COLORS[pickup.power], 1, undefined, undefined, pickup.power);
        state.pickups.splice(index, 1);
        continue;
      }
      if (!pickup.ore) {
        state.pickups.splice(index, 1);
        continue;
      }
      state.inventory[pickup.ore] += 1;
      const activeTask = getActiveTask(state.upgrades);
      const contributesToTask = Boolean(
        activeTask?.requirements.some((requirement) => requirement.kind === "collect" && requirement.ore === pickup.ore)
      );
      recordTaskCollection(state.upgrades, pickup.ore, 1);
      state.player.collectionPulse = 0.18;
      addEvent(state, "pickup-collected", pickup.x, pickup.y, ORE_CONFIG[pickup.ore].color, 1, undefined, undefined, pickup.ore);
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
    recordMiningStreak(state, config.drop);
    const count = config.dropMin + Math.floor(noiseFor(tile.x, tile.y, 500) * (config.dropMax - config.dropMin + 1));
    for (let index = 0; index < count; index += 1) {
      spawnPickup(state, config.drop, centerX, centerY, index);
    }
    state.threat.value = clamp(state.threat.value + ORE_CONFIG[config.drop].threat, 0, state.threat.max);
    maybeSpawnTilePowerDrop(state, config.drop, centerX, centerY, tile.x, tile.y);
  }

  setHitStop(state, hitStopForBlock(tile.type));
  objectiveTargetCache.delete(state);
  addEvent(state, "tile-broken", centerX, centerY, config.glow);
}

function recordMiningStreak(state: GameState, ore: OreId): void {
  const streak = state.player.miningStreak;
  if (streak.ore === ore && streak.timer > 0) {
    streak.count += 1;
  } else {
    streak.ore = ore;
    streak.count = 1;
  }

  streak.timer = 4;
  if (streak.count >= 5) {
    streak.magnetBoostTimer = Math.max(streak.magnetBoostTimer, 5);
  }
  if (streak.count >= 8) {
    state.player.temporarySpeedBoostTimer = Math.max(state.player.temporarySpeedBoostTimer, 1.2);
  }
}

function spawnPickup(state: GameState, ore: OreId, x: number, y: number, index: number): void {
  const angle = noiseFor(x + index, y, 601) * Math.PI * 2;
  const speed = 50 + noiseFor(y, x + index, 602) * 90;
  const pickup: PickupState = {
    id: `pickup-${state.elapsed.toFixed(3)}-${state.pickups.length}-${index}`,
    kind: "ore",
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

function spawnPowerPickup(state: GameState, power: PowerDropId, x: number, y: number, index: number): void {
  const angle = noiseFor(x + index, y, 771) * Math.PI * 2;
  const speed = 42 + noiseFor(y, x + index, 772) * 76;
  state.pickups.push({
    id: `power-${state.elapsed.toFixed(3)}-${state.pickups.length}-${index}`,
    kind: "power",
    power,
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    magnetized: false,
    age: 0
  });
}

function maybeSpawnTilePowerDrop(state: GameState, ore: OreId, x: number, y: number, tileX: number, tileY: number): void {
  const roll = noiseFor(tileX, tileY, 731);
  if (ore === "ferrite" && roll > 0.93) {
    spawnPowerPickup(state, "repairPack", x, y, 80);
  } else if (ore === "shimmer" && roll > 0.945) {
    spawnPowerPickup(state, "coolantCell", x, y, 81);
  } else if (ore === "voltaic" && roll > 0.92) {
    spawnPowerPickup(state, "overdriveCell", x, y, 82);
  } else if (ore === "aetherium" && roll > 0.88) {
    spawnPowerPickup(state, "shieldCell", x, y, 83);
  }
}

function applyPowerPickup(state: GameState, power: PowerDropId): void {
  if (power === "repairPack") {
    state.player.hull = Math.min(state.player.maxHull, state.player.hull + state.player.maxHull * 0.24);
  } else if (power === "coolantCell") {
    state.player.heat = Math.max(0, state.player.heat - state.stats.heatCapacity * 0.55);
    state.player.overheatedTimer = 0;
  } else if (power === "overdriveCell") {
    state.player.weaponBoostTimer = Math.max(state.player.weaponBoostTimer, 6);
  } else {
    state.player.shield = Math.min(state.player.shieldMax, state.player.shield + 38);
    state.player.shieldCooldown = Math.max(0, state.player.shieldCooldown - 2.4);
    state.player.invulnerableTimer = Math.max(state.player.invulnerableTimer, 0.18);
  }
  state.player.collectionPulse = 0.22;
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
  state.threat.value = clamp(state.threat.value + ENEMY_CONFIG[enemy.kind].threatOnKill * (enemy.elite ? 3 : 1), 0, state.threat.max);
  if (enemy.elite) {
    dropEliteReward(state, enemy);
  } else {
    maybeDropEnemyPower(state, enemy);
  }
  setHitStop(state, 0.04);
  addEvent(state, "enemy-killed", enemy.x, enemy.y, ENEMY_CONFIG[enemy.kind].color, undefined, undefined, undefined, enemyLabel(enemy));
}

function dropEliteReward(state: GameState, enemy: EnemyState): void {
  const count = 1 + Math.floor(noiseFor(enemy.x, enemy.y, 941) * 2);
  for (let index = 0; index < count; index += 1) {
    const roll = noiseFor(enemy.y + index, enemy.x, 942);
    const ore: OreId = roll > 0.78 ? "aetherium" : roll > 0.38 ? "voltaic" : "shimmer";
    spawnPickup(state, ore, enemy.x, enemy.y, 20 + index);
  }
  const eliteRoll = noiseFor(enemy.x, enemy.y, 946);
  spawnPowerPickup(state, eliteRoll > 0.66 ? "overdriveCell" : eliteRoll > 0.33 ? "repairPack" : "coolantCell", enemy.x, enemy.y, 34);
}

function maybeDropEnemyPower(state: GameState, enemy: EnemyState): void {
  const roll = noiseFor(enemy.x, enemy.y, 944);
  if (roll < 0.88) {
    return;
  }
  const power: PowerDropId = enemy.kind === "sparkSac"
    ? "coolantCell"
    : enemy.kind === "phaseMite"
      ? "overdriveCell"
      : roll > 0.96
        ? "shieldCell"
        : "repairPack";
  spawnPowerPickup(state, power, enemy.x, enemy.y, 30);
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
    damage: enemyDamage(enemy),
    applied: false
  };
  state.hazards.push(hazard);
  addEvent(state, "enemy-killed", enemy.x, enemy.y, ENEMY_CONFIG.sparkSac.color);
}

function startBossBreakout(state: GameState): void {
  const boss = state.boss;
  boss.active = true;
  boss.defeated = false;
  boss.kind = getActiveTask(state.upgrades)?.bossAchievement ?? "voltrixCore";
  boss.maxHealth = boss.kind === "sentinelEye" ? 320 : 420;
  boss.health = boss.maxHealth;
  const spawn = findBossSpawnPosition(state);
  boss.x = spawn.x;
  boss.y = spawn.y;
  boss.vx = -80;
  boss.vy = 20;
  boss.cooldown = 1.25;
  boss.segments = Array.from({ length: boss.kind === "sentinelEye" ? 4 : 7 }, (_, index) => ({
    x: boss.x + (index + 1) * 34,
    y: boss.y + Math.sin(index) * 12,
    radius: Math.max(17, 26 - index)
  }));
  state.threat.mood = "breakout";
  addEvent(state, "boss-breakout", state.player.x, state.player.y, boss.kind === "sentinelEye" ? 0xe8c86a : 0x8a6db8);
}

function findBossSpawnPosition(state: GameState): Vec2 {
  const preferredAngle = -0.28;
  const radiusOptions = [520, 620, 440, 700, 360, 780];
  for (const radius of radiusOptions) {
    for (let step = 0; step < 20; step += 1) {
      const angle = preferredAngle + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * 0.24;
      const x = state.player.x + Math.cos(angle) * radius;
      const y = state.player.y + Math.sin(angle) * radius;
      if (isValidEnemySpawn(state, x, y, 34)) {
        return { x, y };
      }
    }
  }

  for (let tileRadius = 8; tileRadius < 36; tileRadius += 2) {
    for (let angleStep = 0; angleStep < 24; angleStep += 1) {
      const angle = (angleStep / 24) * Math.PI * 2;
      const x = state.player.x + Math.cos(angle) * tileRadius * TILE_SIZE;
      const y = state.player.y + Math.sin(angle) * tileRadius * TILE_SIZE;
      if (isValidEnemySpawn(state, x, y, 34)) {
        return { x, y };
      }
    }
  }

  return { x: state.world.spawn.x, y: state.world.spawn.y };
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
    state.threat.value = 0;
    state.threat.zoneTimer = 0;
    state.threat.mood = "quiet";
    state.threat.directionAngle = null;
    state.threat.dangerSwellTimer = 0;
    state.threat.dangerSwellTriggered = false;
    dropBossReward(state);
    recordBossAchievement(state.upgrades, state.boss.kind);
    addEvent(state, "boss-defeated", state.boss.x, state.boss.y, 0xc47a8a);
  }
}

function dropBossReward(state: GameState): void {
  const drops: Array<{ ore: OreId; count: number }> = state.boss.kind === "sentinelEye"
    ? [
      { ore: "voltaic", count: 3 },
      { ore: "shimmer", count: 4 }
    ]
    : [
      { ore: "aetherium", count: 2 },
      { ore: "voltaic", count: 4 }
    ];

  let dropIndex = 0;
  for (const drop of drops) {
    for (let index = 0; index < drop.count; index += 1) {
      spawnPickup(state, drop.ore, state.boss.x, state.boss.y, 40 + dropIndex);
      dropIndex += 1;
    }
  }
  spawnPowerPickup(state, state.boss.kind === "sentinelEye" ? "overdriveCell" : "shieldCell", state.boss.x, state.boss.y, 90 + dropIndex);
  spawnPowerPickup(state, "repairPack", state.boss.x, state.boss.y, 91 + dropIndex);
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

  applyPlayerDamageKnockback(state, x, y);

  if (state.player.shieldActiveTimer > 0 && state.player.shield > 0) {
    const absorbed = Math.min(state.player.shield, amount);
    state.player.shield -= absorbed;
    amount -= absorbed;
    if (state.player.shield <= 0) {
      state.player.shieldActiveTimer = 0;
      state.player.shieldCooldown = Math.max(state.player.shieldCooldown, 4.8);
      addEvent(state, "shield-broken", state.player.x, state.player.y, 0x5ab8a8);
    }
    if (amount <= 0) {
      return;
    }
  }

  state.player.hull = Math.max(0, state.player.hull - amount);
  state.player.invulnerableTimer = 0.35;
  setHitStop(state, 0.025);
  addEvent(state, "player-hit", state.player.x, state.player.y, 0xc45a4a, amount, x, y);
}

function applyPlayerDamageKnockback(state: GameState, sourceX: number, sourceY: number): void {
  const player = state.player;
  let direction = normalize({ x: player.x - sourceX, y: player.y - sourceY });

  if (length(direction) === 0) {
    direction = normalize({ x: -player.vx, y: -player.vy });
  }

  if (length(direction) === 0) {
    direction = { x: -Math.cos(player.angle), y: -Math.sin(player.angle) };
  }

  player.vx += direction.x * PLAYER_DAMAGE_KNOCKBACK;
  player.vy += direction.y * PLAYER_DAMAGE_KNOCKBACK;

  const speed = Math.hypot(player.vx, player.vy);
  if (speed > PLAYER_DAMAGE_KNOCKBACK_MAX_SPEED) {
    const scale = PLAYER_DAMAGE_KNOCKBACK_MAX_SPEED / speed;
    player.vx *= scale;
    player.vy *= scale;
  }
}

function moveEnemyWithCollision(
  state: GameState,
  enemy: EnemyState,
  dx: number,
  dy: number,
  bounce: number
): { hitX: boolean; hitY: boolean } {
  const moved = moveCircleWithCollision(state, enemy.x, enemy.y, dx, dy, Math.max(8, enemy.radius * 0.72), bounce);
  enemy.x = moved.x;
  enemy.y = moved.y;
  if (moved.hitX) {
    enemy.vx *= bounce;
  }
  if (moved.hitY) {
    enemy.vy *= bounce;
  }
  return { hitX: moved.hitX, hitY: moved.hitY };
}

function moveCircleWithCollision(
  state: GameState,
  x: number,
  y: number,
  dx: number,
  dy: number,
  radius: number,
  _bounce: number
): { x: number; y: number; hitX: boolean; hitY: boolean } {
  const bounds = worldBounds(state.world);
  let nextX = clamp(x + dx, radius, bounds.width - radius);
  let nextY = y;
  let hitX = nextX !== x + dx;
  let hitY = false;

  if (circleHitsSolid(state, nextX, y, radius)) {
    nextX = x;
    hitX = true;
  }

  nextY = clamp(y + dy, radius, bounds.height - radius);
  hitY = nextY !== y + dy;
  if (circleHitsSolid(state, nextX, nextY, radius)) {
    nextY = y;
    hitY = true;
  }

  return { x: nextX, y: nextY, hitX, hitY };
}

function getChaseDirection(state: GameState, from: Vec2, to: Vec2, radius: number): Vec2 {
  const direct = normalize({ x: to.x - from.x, y: to.y - from.y });
  if (length(direct) === 0 || hasClearMovementLine(state, from, to, radius)) {
    return direct;
  }

  const goalTile = worldToTile(to);
  const cached = chasePathCache.get(from);
  if (cached && cached.expiresAt > state.elapsed && tileDistance(cached.goalTile, goalTile) <= CHASE_PATH_REPATH_TILES) {
    const cachedDirection = normalize({ x: cached.waypoint.x - from.x, y: cached.waypoint.y - from.y });
    if (length(cachedDirection) > 0 && hasClearMovementLine(state, from, cached.waypoint, radius)) {
      return cachedDirection;
    }
  }

  if (chasePathBudget <= 0) {
    return direct;
  }
  chasePathBudget -= 1;

  const pathTarget = findPathWaypoint(state, from, to, radius);
  if (!pathTarget) {
    return direct;
  }

  chasePathCache.set(from, {
    goalTile,
    waypoint: pathTarget,
    expiresAt: state.elapsed + CHASE_PATH_CACHE_TIME
  });
  const pathDirection = normalize({ x: pathTarget.x - from.x, y: pathTarget.y - from.y });
  return length(pathDirection) === 0 ? direct : pathDirection;
}

function hasClearMovementLine(state: GameState, from: Vec2, to: Vec2, radius: number): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 1) {
    return true;
  }

  const steps = Math.ceil(dist / (TILE_SIZE * 0.5));
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    if (circleHitsSolid(state, from.x + dx * t, from.y + dy * t, radius)) {
      return false;
    }
  }

  return true;
}

function findPathWaypoint(state: GameState, from: Vec2, to: Vec2, radius: number): Vec2 | null {
  const startTile = worldToTile(from);
  const goalTile = findNearestNavigableTile(state, worldToTile(to), radius);
  if (!goalTile) {
    return null;
  }

  if (startTile.x === goalTile.x && startTile.y === goalTile.y) {
    return {
      x: goalTile.x * TILE_SIZE + TILE_SIZE / 2,
      y: goalTile.y * TILE_SIZE + TILE_SIZE / 2
    };
  }

  const minX = Math.max(1, Math.min(startTile.x, goalTile.x) - CHASE_PATH_MARGIN_TILES);
  const maxX = Math.min(state.world.width - 2, Math.max(startTile.x, goalTile.x) + CHASE_PATH_MARGIN_TILES);
  const minY = Math.max(1, Math.min(startTile.y, goalTile.y) - CHASE_PATH_MARGIN_TILES);
  const maxY = Math.min(state.world.height - 2, Math.max(startTile.y, goalTile.y) + CHASE_PATH_MARGIN_TILES);
  const goalKey = tileKey(goalTile);
  const open: Array<PathTile & { f: number; g: number }> = [{ ...startTile, f: heuristic(startTile, goalTile), g: 0 }];
  const cameFrom = new Map<string, string>();
  const bestCost = new Map<string, number>([[tileKey(startTile), 0]]);
  const closed = new Set<string>();
  let visits = 0;

  while (open.length > 0 && visits < CHASE_PATH_MAX_VISITS) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      if (open[index].f < open[bestIndex].f) {
        bestIndex = index;
      }
    }

    const current = open.splice(bestIndex, 1)[0];
    const currentKey = tileKey(current);
    if (closed.has(currentKey)) {
      continue;
    }

    if (currentKey === goalKey) {
      return pathFirstWaypoint(cameFrom, startTile, goalTile);
    }

    closed.add(currentKey);
    visits += 1;

    for (const neighbor of getPathNeighbors(current)) {
      if (neighbor.x < minX || neighbor.x > maxX || neighbor.y < minY || neighbor.y > maxY) {
        continue;
      }
      if (!isNavigableForRadius(state, neighbor, radius)) {
        continue;
      }

      const neighborKey = tileKey(neighbor);
      if (closed.has(neighborKey)) {
        continue;
      }

      const nextCost = current.g + 1;
      if (nextCost >= (bestCost.get(neighborKey) ?? Number.POSITIVE_INFINITY)) {
        continue;
      }

      cameFrom.set(neighborKey, currentKey);
      bestCost.set(neighborKey, nextCost);
      open.push({
        ...neighbor,
        g: nextCost,
        f: nextCost + heuristic(neighbor, goalTile)
      });
    }
  }

  return null;
}

function findNearestNavigableTile(state: GameState, target: PathTile, radius: number): PathTile | null {
  if (isNavigableForRadius(state, target, radius)) {
    return target;
  }

  for (let searchRadius = 1; searchRadius <= 5; searchRadius += 1) {
    for (let y = target.y - searchRadius; y <= target.y + searchRadius; y += 1) {
      for (let x = target.x - searchRadius; x <= target.x + searchRadius; x += 1) {
        if (Math.abs(x - target.x) !== searchRadius && Math.abs(y - target.y) !== searchRadius) {
          continue;
        }

        const candidate = { x, y };
        if (isNavigableForRadius(state, candidate, radius)) {
          return candidate;
        }
      }
    }
  }

  return null;
}

function pathFirstWaypoint(cameFrom: Map<string, string>, start: PathTile, goal: PathTile): Vec2 | null {
  const startKey = tileKey(start);
  let currentKey = tileKey(goal);
  let previousKey = currentKey;

  while (cameFrom.has(currentKey) && cameFrom.get(currentKey) !== startKey) {
    previousKey = currentKey;
    currentKey = cameFrom.get(currentKey) ?? startKey;
  }

  if (cameFrom.get(currentKey) === startKey) {
    previousKey = currentKey;
  }

  const nextTile = keyToTile(previousKey);
  return {
    x: nextTile.x * TILE_SIZE + TILE_SIZE / 2,
    y: nextTile.y * TILE_SIZE + TILE_SIZE / 2
  };
}

function getPathNeighbors(tile: PathTile): PathTile[] {
  return [
    { x: tile.x - 1, y: tile.y },
    { x: tile.x + 1, y: tile.y },
    { x: tile.x, y: tile.y - 1 },
    { x: tile.x, y: tile.y + 1 }
  ];
}

function isNavigableForRadius(state: GameState, tile: PathTile, radius: number): boolean {
  const centerX = tile.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = tile.y * TILE_SIZE + TILE_SIZE / 2;
  return !isSolid(getTile(state.world, tile.x, tile.y)) && !circleHitsSolid(state, centerX, centerY, radius);
}

function worldToTile(point: Vec2): PathTile {
  return {
    x: Math.floor(point.x / TILE_SIZE),
    y: Math.floor(point.y / TILE_SIZE)
  };
}

function tileKey(tile: PathTile): string {
  return `${tile.x},${tile.y}`;
}

function keyToTile(key: string): PathTile {
  const [x, y] = key.split(",").map(Number);
  return { x, y };
}

function heuristic(a: PathTile, b: PathTile): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function tileDistance(a: PathTile, b: PathTile): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isValidEnemySpawn(state: GameState, x: number, y: number, radius: number): boolean {
  const bounds = worldBounds(state.world);
  if (x < radius || y < radius || x > bounds.width - radius || y > bounds.height - radius) {
    return false;
  }

  if (circleHitsSolid(state, x, y, radius)) {
    return false;
  }

  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);
  const center = getTile(state.world, tileX, tileY);
  if (isSolid(center)) {
    return false;
  }

  let openNeighbors = 0;
  const checks = [
    [tileX - 1, tileY],
    [tileX + 1, tileY],
    [tileX, tileY - 1],
    [tileX, tileY + 1],
    [tileX - 1, tileY - 1],
    [tileX + 1, tileY + 1]
  ];
  for (const [xTile, yTile] of checks) {
    if (!isSolid(getTile(state.world, xTile, yTile))) {
      openNeighbors += 1;
    }
  }

  return openNeighbors >= 3;
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
    state.threat.directionAngle = Math.atan2(state.boss.y - state.player.y, state.boss.x - state.player.x);
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

function updateThreatDirection(state: GameState): void {
  if (state.boss.active) {
    state.threat.directionAngle = Math.atan2(state.boss.y - state.player.y, state.boss.x - state.player.x);
    return;
  }

  if (state.threat.value < state.threat.max * 0.5) {
    state.threat.directionAngle = null;
    return;
  }

  const target = findThreatDirectionTarget(state);
  state.threat.directionAngle = Math.atan2(target.y - state.player.y, target.x - state.player.x);
}

function findThreatDirectionTarget(state: GameState): Vec2 {
  const preferredAngle = -0.28;
  const radiusOptions = [520, 620, 440, 700, 360, 780];
  let fallback = { x: state.player.x + Math.cos(preferredAngle) * 520, y: state.player.y + Math.sin(preferredAngle) * 520 };
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const radius of radiusOptions) {
    for (let step = 0; step < 20; step += 1) {
      const angle = preferredAngle + (step % 2 === 0 ? 1 : -1) * Math.ceil(step / 2) * 0.24;
      const x = state.player.x + Math.cos(angle) * radius;
      const y = state.player.y + Math.sin(angle) * radius;
      const dist = distance({ x, y }, state.player);
      if (dist < bestDistance) {
        fallback = { x, y };
        bestDistance = dist;
      }
      if (isValidEnemySpawn(state, x, y, 34)) {
        return { x, y };
      }
    }
  }

  return fallback;
}

function addEvent(
  state: GameState,
  type: GameEvent["type"],
  x: number,
  y: number,
  color: number,
  amount?: number,
  sourceX?: number,
  sourceY?: number,
  context?: string
): void {
  state.events.push({ type, x, y, color, amount, sourceX, sourceY, context });
}

function setHitStop(state: GameState, duration: number): void {
  state.hitStopTimer = Math.max(state.hitStopTimer, duration);
}

function hitStopForBlock(block: BlockId): number {
  if (block === "aetherium" || block === "voltaic") {
    return 0.06;
  }
  if (block === "shimmer") {
    return 0.035;
  }
  if (block === "ferrite") {
    return 0.018;
  }
  return 0.01;
}

function enemyDamage(enemy: EnemyState): number {
  return ENEMY_CONFIG[enemy.kind].damage * (enemy.elite ? 1.4 : 1);
}

function enemyLabel(enemy: EnemyState): string {
  const label = ENEMY_CONFIG[enemy.kind].label;
  return enemy.elite ? `Elite ${label}` : label;
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
