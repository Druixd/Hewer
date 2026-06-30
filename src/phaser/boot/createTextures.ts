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
    if (block !== "empty") {
      const isOre = block === "shimmer" || block === "voltaic" || block === "aetherium";
      const isMetal = block === "ferrite";
      const fillAlpha = block === "ancient" ? 0.14 : isOre ? 0.36 : isMetal ? 0.28 : 0.18;
      const edgeAlpha = block === "ancient" ? 0.22 : isOre ? 0.82 : isMetal ? 0.54 : 0.28;
      graphics.fillStyle(config.color, fillAlpha);
      graphics.fillRect(2, 2, 20, 20);
      graphics.fillStyle(0x000000, isOre ? 0.64 : 0.74);
      graphics.fillRect(6, 6, 12, 12);
      graphics.lineStyle(1, config.glow, edgeAlpha);
      graphics.strokeRect(1.5, 1.5, 21, 21);
      graphics.lineStyle(1, config.glow, edgeAlpha * 0.46);
      graphics.strokeRect(7.5, 7.5, 9, 9);
      graphics.fillStyle(config.glow, block === "basalt" || block === "ancient" ? 0.1 : 0.2);
      graphics.fillRect(3, 3, 2, 2);
      graphics.fillRect(19, 18, 2, 2);
    }

    if (block === "shimmer" || block === "voltaic" || block === "aetherium") {
      graphics.fillStyle(config.glow, 0.95);
      graphics.fillRect(9, 3, 5, 18);
      graphics.fillStyle(0xffffff, 0.42);
      graphics.fillRect(10, 5, 1, 12);
    }

    if (block === "ferrite") {
      graphics.fillStyle(0xd7e0e2, 0.46);
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
    graphics.fillStyle(0xffffff, 0.2);
    graphics.fillCircle(26, 22, 20);
    graphics.fillStyle(0xf8d54a, 0.95);
    graphics.fillCircle(26, 22, 10);
    graphics.fillStyle(0xfff4c0, 1);
    graphics.fillTriangle(44, 22, 23, 12, 23, 32);
    graphics.fillStyle(0xfff8dc, 0.95);
    graphics.fillCircle(24, 22, 5);
    graphics.lineStyle(2, 0xffc247, 0.9);
    graphics.strokeCircle(26, 22, 13);
    graphics.lineStyle(1, 0xffffff, 0.76);
    graphics.lineBetween(14, 12, 5, 8);
    graphics.lineBetween(14, 32, 5, 36);
    graphics.fillStyle(0xffffff, 0.82);
    graphics.fillCircle(9, 22, 3);
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
