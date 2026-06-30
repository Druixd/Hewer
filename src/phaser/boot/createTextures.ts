import Phaser from "phaser";
import { BLOCK_CONFIG, ENEMY_CONFIG, ORE_CONFIG } from "../../game/content/config";
import { TEXTURES } from "../../game/assets/manifest";
import type { BlockId, EnemyId, OreId } from "../../game/simulation/types";

export function createGeneratedTextures(scene: Phaser.Scene): void {
  createTileTextures(scene);
  createPickupTextures(scene);
  createEnemyTextures(scene);
  createShipTexture(scene);
  createBossTextures(scene);
  createFxTextures(scene);
}

function createTileTextures(scene: Phaser.Scene): void {
  const keys = Object.keys(BLOCK_CONFIG) as BlockId[];
  for (const block of keys) {
    const key = TEXTURES.tile(block);
    if (scene.textures.exists(key)) {
      continue;
    }

    const config = BLOCK_CONFIG[block];
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.clear();
    graphics.fillStyle(0x030306, block === "empty" ? 0 : 1);
    graphics.fillRect(0, 0, 24, 24);

    if (block !== "empty") {
      graphics.fillStyle(config.color, block === "ancient" ? 0.62 : 0.92);
      graphics.fillRect(1, 1, 22, 22);
      graphics.fillStyle(0x000000, 0.36);
      graphics.fillRect(5, 5, 14, 14);
      graphics.lineStyle(1, config.glow, block === "basalt" ? 0.34 : 0.82);
      graphics.strokeRect(1.5, 1.5, 21, 21);
      graphics.lineStyle(1, config.glow, block === "basalt" ? 0.18 : 0.48);
      graphics.strokeRect(6.5, 6.5, 11, 11);
    }

    if (block === "shimmer" || block === "voltaic" || block === "aetherium") {
      graphics.fillStyle(config.glow, 0.95);
      graphics.fillRect(8, 3, 7, 18);
      graphics.fillStyle(0xffffff, 0.42);
      graphics.fillRect(10, 5, 2, 12);
    }

    if (block === "ferrite") {
      graphics.fillStyle(0xd7e0e2, 0.55);
      graphics.fillRect(6, 6, 4, 4);
      graphics.fillRect(14, 13, 4, 4);
    }

    graphics.generateTexture(key, 24, 24);
    graphics.destroy();
  }
}

function createPickupTextures(scene: Phaser.Scene): void {
  const keys = Object.keys(ORE_CONFIG) as OreId[];
  for (const ore of keys) {
    const key = TEXTURES.pickup(ore);
    if (scene.textures.exists(key)) {
      continue;
    }

    const color = ORE_CONFIG[ore].color;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color, 0.25);
    graphics.fillCircle(10, 10, 9);
    graphics.fillStyle(color, 1);
    graphics.fillCircle(10, 10, 5);
    graphics.lineStyle(1, 0xffffff, 0.75);
    graphics.strokeCircle(10, 10, 7);
    graphics.generateTexture(key, 20, 20);
    graphics.destroy();
  }
}

function createEnemyTextures(scene: Phaser.Scene): void {
  const keys = Object.keys(ENEMY_CONFIG) as EnemyId[];
  for (const enemy of keys) {
    const key = TEXTURES.enemy(enemy);
    if (scene.textures.exists(key)) {
      continue;
    }

    const color = ENEMY_CONFIG[enemy].color;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(color, 0.22);
    graphics.fillCircle(24, 24, 22);
    graphics.lineStyle(2, color, 0.95);

    if (enemy === "arcWarden") {
      graphics.strokeCircle(24, 24, 16);
      graphics.strokeRect(13, 13, 22, 22);
      graphics.fillStyle(0xffffff, 0.9);
      graphics.fillCircle(24, 24, 4);
    } else if (enemy === "prismStalker") {
      graphics.beginPath();
      graphics.moveTo(24, 6);
      graphics.lineTo(43, 24);
      graphics.lineTo(24, 42);
      graphics.lineTo(5, 24);
      graphics.closePath();
      graphics.strokePath();
      graphics.fillStyle(color, 0.42);
      graphics.fillTriangle(24, 9, 39, 24, 24, 39);
    } else {
      graphics.strokeCircle(24, 24, 17);
      graphics.fillStyle(color, 0.8);
      graphics.fillCircle(24, 24, 10);
      graphics.fillStyle(0x000000, 0.65);
      graphics.fillCircle(24, 24, 5);
    }

    graphics.generateTexture(key, 48, 48);
    graphics.destroy();
  }
}

function createShipTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURES.ship)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x0d2f40, 0.7);
    graphics.fillCircle(28, 22, 20);
    graphics.lineStyle(2, 0x4beaff, 0.95);
    graphics.strokeCircle(28, 22, 14);
    graphics.fillStyle(0x46e6ff, 0.86);
    graphics.fillTriangle(44, 22, 18, 8, 18, 36);
    graphics.fillStyle(0xe9fbff, 1);
    graphics.fillRect(21, 17, 10, 10);
    graphics.lineStyle(2, 0xff4c6d, 0.9);
    graphics.strokeCircle(27, 22, 5);
    graphics.lineStyle(1, 0x8b6dff, 0.9);
    graphics.strokeRect(8, 13, 10, 18);
    graphics.strokeRect(30, 6, 8, 9);
    graphics.strokeRect(30, 29, 8, 9);
    graphics.generateTexture(TEXTURES.ship, 56, 44);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURES.reticle)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.lineStyle(1, 0xffffff, 0.8);
    graphics.strokeCircle(10, 10, 6);
    graphics.lineBetween(10, 0, 10, 5);
    graphics.lineBetween(10, 15, 10, 20);
    graphics.lineBetween(0, 10, 5, 10);
    graphics.lineBetween(15, 10, 20, 10);
    graphics.generateTexture(TEXTURES.reticle, 20, 20);
    graphics.destroy();
  }
}

function createBossTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURES.bossHead)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x2a1648, 0.92);
    graphics.fillCircle(36, 36, 31);
    graphics.lineStyle(3, 0x8b6dff, 1);
    graphics.strokeCircle(36, 36, 29);
    graphics.lineStyle(2, 0x41e6e2, 0.75);
    graphics.beginPath();
    graphics.moveTo(36, 6);
    graphics.lineTo(58, 36);
    graphics.lineTo(36, 66);
    graphics.lineTo(14, 36);
    graphics.closePath();
    graphics.strokePath();
    graphics.fillStyle(0xff4c6d, 0.85);
    graphics.fillCircle(36, 36, 7);
    graphics.generateTexture(TEXTURES.bossHead, 72, 72);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURES.bossSegment)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0x231337, 0.9);
    graphics.fillCircle(28, 28, 25);
    graphics.lineStyle(2, 0xff9f43, 0.88);
    graphics.strokeCircle(28, 28, 22);
    graphics.lineStyle(1, 0x8b6dff, 0.72);
    graphics.strokeCircle(28, 28, 12);
    graphics.generateTexture(TEXTURES.bossSegment, 56, 56);
    graphics.destroy();
  }
}

function createFxTextures(scene: Phaser.Scene): void {
  createParticle(scene, TEXTURES.particleWhite, 0xffffff);
  createParticle(scene, TEXTURES.particleCyan, 0x41e6e2);
  createParticle(scene, TEXTURES.particleAmber, 0xffc247);
  createParticle(scene, TEXTURES.particleMagenta, 0xf05dff);
}

function createParticle(scene: Phaser.Scene, key: string, color: number): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(color, 1);
  graphics.fillCircle(4, 4, 3);
  graphics.generateTexture(key, 8, 8);
  graphics.destroy();
}

