import Phaser from "phaser";
import { BLOCK_CONFIG, ENEMY_CONFIG, ORE_CONFIG } from "../../game/content/config";
import { TEXTURES } from "../../game/assets/manifest";
import type { BlockId, EnemyId, OreId, ShipId, TerritoryId } from "../../game/simulation/types";

const TILE_VARIANT_COUNT = 4;
const ORE_GLOW_ALPHA_SCALE = 0.7;
export const BAKED_TEXTURE_PACK_URL = "/assets/generated/texture-pack.json";

export interface BakedTexturePack {
  version: 1;
  textures: Record<string, string>;
}

function oreGlowAlpha(alpha: number): number {
  return Phaser.Math.Clamp(alpha * ORE_GLOW_ALPHA_SCALE, 0, 1);
}

export function createGeneratedTextures(scene: Phaser.Scene): void {
  createTileTextures(scene);
  createPickupTextures(scene);
  createEnemyTextures(scene);
  createShipTexture(scene);
  createBossTextures(scene);
  createFxTextures(scene);
}

export function generatedTextureKeys(): string[] {
  const keys: string[] = [];
  const blocks = Object.keys(BLOCK_CONFIG) as BlockId[];
  const territories: TerritoryId[] = ["shimmerVeins", "cinderHollows"];
  for (const territory of territories) {
    for (const block of blocks) {
      const crackStates = block === "empty" ? [false] : [false, true];
      const visualVariants = block === "empty" ? [0] : Array.from({ length: TILE_VARIANT_COUNT }, (_, index) => index);
      for (const cracked of crackStates) {
        for (const variant of visualVariants) {
          keys.push(TEXTURES.tile(block, territory, cracked, variant));
        }
      }
    }
  }

  for (const ore of Object.keys(ORE_CONFIG) as OreId[]) {
    keys.push(TEXTURES.pickup(ore));
  }
  for (const power of ["repairPack", "coolantCell", "overdriveCell", "shieldCell"]) {
    keys.push(TEXTURES.powerPickup(power));
  }
  for (const enemy of Object.keys(ENEMY_CONFIG) as EnemyId[]) {
    keys.push(TEXTURES.enemy(enemy));
  }
  for (const ship of ["pickaxe", "lance", "titan"] as ShipId[]) {
    keys.push(TEXTURES.ship(ship));
  }
  keys.push(
    TEXTURES.reticle,
    TEXTURES.bossHead,
    TEXTURES.bossSegment,
    TEXTURES.particleWhite,
    TEXTURES.particleCyan,
    TEXTURES.particleAmber,
    TEXTURES.particleMagenta,
    TEXTURES.bombCore,
    "fx.glow.radial",
    "fx.visibility.vignette"
  );
  return keys;
}

export function exportGeneratedTexturePack(scene: Phaser.Scene): BakedTexturePack {
  const textures: Record<string, string> = {};
  for (const key of generatedTextureKeys()) {
    if (!scene.textures.exists(key)) {
      continue;
    }
    textures[key] = scene.textures.getBase64(key);
  }
  return {
    version: 1,
    textures
  };
}

function createTileTextures(scene: Phaser.Scene): void {
  const keys = Object.keys(BLOCK_CONFIG) as BlockId[];
  const territories: TerritoryId[] = ["shimmerVeins", "cinderHollows"];
  for (const territory of territories) {
    for (const block of keys) {
      const crackStates = block === "empty" ? [false] : [false, true];
      const visualVariants = block === "empty" ? [0] : Array.from({ length: TILE_VARIANT_COUNT }, (_, index) => index);
      for (const cracked of crackStates) {
        for (const variant of visualVariants) {
          const key = TEXTURES.tile(block, territory, cracked, variant);
          if (scene.textures.exists(key)) {
            continue;
          }

          const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
          graphics.clear();
          drawTileTexture(graphics, block, territory, cracked, variant);
          graphics.generateTexture(key, 24, 24);
          graphics.destroy();
        }
      }
    }
  }
}

interface TilePalette {
  core: number;
  inner: number;
  edge: number;
  glow: number;
  hot: number;
  dim: number;
}

function drawTileTexture(graphics: Phaser.GameObjects.Graphics, block: BlockId, territory: TerritoryId, cracked: boolean, variant: number): void {
  if (block === "empty") {
    return;
  }

  const palette = tilePalette(block, territory);
  if (block === "basalt" || block === "ancient") {
    drawCaveMassTexture(graphics, palette, block === "ancient" ? 0.08 : 0.06, variant);
    if (block === "ancient") {
      drawCircuitMark(graphics, palette, 0.06 + variant * 0.01, variant);
    }
    if (cracked) {
      drawCrackedOverlay(graphics, palette, variant, 0.32);
    }
    return;
  }

  drawBlockShell(graphics, palette, 0.58, variant);

  if (block === "ferrite") {
    drawGoldOre(graphics, palette, variant);
  } else if (block === "shimmer") {
    drawCrystalOre(graphics, palette, variant);
  } else if (block === "voltaic") {
    drawVoltaicOre(graphics, palette, variant);
  } else if (block === "aetherium") {
    drawAetheriumOre(graphics, palette, variant);
  }

  drawCornerNoise(graphics, palette, variant);
  if (cracked) {
    drawCrackedOverlay(graphics, palette, variant);
  }
}

function drawCaveMassTexture(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, alpha: number, variant: number): void {
  graphics.fillStyle(palette.core, 1);
  graphics.fillRect(0, 0, 24, 24);
  graphics.fillStyle(palette.inner, 0.46);
  graphics.fillRect(0, 0, 24, 24);
  graphics.fillStyle(palette.dim, 0.075);
  graphics.fillCircle(7 + variant * 2, 8 + (variant % 2) * 3, 8 + (variant % 3));
  graphics.fillCircle(19 - variant, 17 - (variant % 2) * 4, 6 + (variant % 2));
  graphics.fillStyle(palette.core, 0.09);
  graphics.fillCircle(14 - variant, 10 + variant, 9);

  graphics.lineStyle(1, palette.dim, alpha);
  graphics.beginPath();
  graphics.moveTo(-2, 7 + variant);
  graphics.lineTo(8 + variant, 5 + (variant % 2));
  graphics.lineTo(17 + (variant % 2) * 4, 8 + variant);
  graphics.moveTo(3 + variant, 19 - (variant % 2) * 3);
  graphics.lineTo(12, 21 - variant);
  graphics.lineTo(26 - variant, 15 + (variant % 3));
  if (variant % 2 === 1) {
    graphics.moveTo(-1, 13);
    graphics.lineTo(9, 12);
    graphics.lineTo(18, 15);
  }
  graphics.strokePath();

  graphics.fillStyle(palette.edge, alpha * 0.08);
  graphics.fillCircle(6 + variant, 8 + (variant % 2), 1.4);
  graphics.fillCircle(18 - (variant % 2) * 3, 17 - variant, 1.5);
}

function tilePalette(block: BlockId, territory: TerritoryId): TilePalette {
  if ((block === "basalt" || block === "ancient") && territory === "cinderHollows") {
    return {
      core: 0x110707,
      inner: block === "ancient" ? 0x2a0d0c : 0x1a0d0b,
      edge: block === "ancient" ? 0xc84a32 : 0x7a3428,
      glow: block === "ancient" ? 0xff5a24 : 0x9c2a1f,
      hot: 0xffb24a,
      dim: 0x33130e
    };
  }

  if (block === "ferrite") {
    return { core: 0x050403, inner: 0x12100a, edge: 0x8a6a24, glow: 0xe8c86a, hot: 0xfff0a8, dim: 0x3b2a10 };
  }
  if (block === "shimmer") {
    return { core: 0x05030a, inner: 0x10091c, edge: 0x5d429a, glow: 0x8a6db8, hot: 0xe7d8ff, dim: 0x201438 };
  }
  if (block === "voltaic") {
    return { core: 0x020807, inner: 0x061412, edge: 0x298f84, glow: 0x6effe7, hot: 0xe2fff8, dim: 0x0d332e };
  }
  if (block === "aetherium") {
    return { core: 0x080207, inner: 0x170812, edge: 0x9a3d78, glow: 0xff76c8, hot: 0xffe4f4, dim: 0x3a122a };
  }
  if (block === "ancient") {
    return { core: 0x0d0d18, inner: 0x17162b, edge: 0x6c60bf, glow: 0x9a8cff, hot: 0xe8e2ff, dim: 0x232044 };
  }

  return { core: 0x0b0e16, inner: 0x151a28, edge: 0x4c5684, glow: 0x8a88d8, hot: 0xd4d2ff, dim: 0x22283c };
}

function drawBlockShell(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, edgeAlpha: number, variant: number): void {
  graphics.fillStyle(palette.core, 0.98);
  graphics.fillRect(0, 0, 24, 24);
  graphics.fillStyle(palette.inner, 0.95);
  graphics.beginPath();
  graphics.moveTo(1, 5 + (variant % 2));
  graphics.lineTo(5 + variant, 1);
  graphics.lineTo(17 + (variant % 2), 1 + (variant % 3));
  graphics.lineTo(23, 5 + variant);
  graphics.lineTo(22 - (variant % 2), 17);
  graphics.lineTo(18 - variant, 23);
  graphics.lineTo(6, 23 - (variant % 2));
  graphics.lineTo(1, 19 - variant);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(palette.core, 0.96);
  graphics.beginPath();
  graphics.moveTo(5, 8 + (variant % 2));
  graphics.lineTo(9 + variant, 4);
  graphics.lineTo(17, 5 + variant);
  graphics.lineTo(20 - (variant % 2), 10);
  graphics.lineTo(18, 17 - (variant % 2));
  graphics.lineTo(13 - variant, 20);
  graphics.lineTo(7, 18 - variant);
  graphics.lineTo(4 + (variant % 2), 13);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(1.2, palette.edge, edgeAlpha * 0.52);
  graphics.beginPath();
  graphics.moveTo(2, 7);
  graphics.lineTo(6, 2);
  graphics.lineTo(16, 2);
  graphics.lineTo(22, 6);
  graphics.moveTo(22, 16);
  graphics.lineTo(17, 22);
  graphics.lineTo(7, 22);
  graphics.lineTo(2, 18);
  graphics.strokePath();
  graphics.fillStyle(palette.glow, oreGlowAlpha(0.055));
  graphics.fillCircle(12, 12, 9);
  drawReliefFrame(graphics, palette, variant, 0.48);
}

function drawReliefFrame(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant: number, strength: number): void {
  const offset = variant % 2;
  graphics.lineStyle(1, palette.hot, strength);
  graphics.beginPath();
  graphics.moveTo(2, 5 + offset);
  graphics.lineTo(6 + variant, 2);
  graphics.lineTo(15 + offset, 2);
  graphics.moveTo(3, 9);
  graphics.lineTo(3, 17 - offset);
  graphics.strokePath();

  graphics.lineStyle(1, palette.core, strength * 1.45);
  graphics.beginPath();
  graphics.moveTo(21, 7 + offset);
  graphics.lineTo(21, 17);
  graphics.lineTo(17 - offset, 22);
  graphics.lineTo(8, 22);
  graphics.strokePath();

  graphics.fillStyle(0x000000, strength * 0.16);
  graphics.fillTriangle(17, 7 + offset, 22, 10, 21 - offset, 20);
  graphics.fillStyle(palette.hot, strength * 0.14);
  graphics.fillTriangle(3, 5 + offset, 8 + variant, 3, 6, 9 + offset);
}

function drawCircuitMark(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, alpha = 0.58, variant = 0): void {
  graphics.lineStyle(1, palette.glow, alpha);
  graphics.beginPath();
  graphics.arc(12, 12, 4.5 + (variant % 2), Math.PI * (0.1 + variant * 0.08), Math.PI * 1.55, false);
  graphics.strokePath();
  graphics.strokeRect(9.5 - (variant % 2), 9.5, 5, 5);
  graphics.lineBetween(4, 12 + (variant % 2), 9, 12);
  graphics.lineBetween(15, 12, 20, 12 - (variant % 2));
  graphics.fillStyle(palette.hot, alpha * 0.86);
  graphics.fillRect(11, 11, 2, 2);
}

function drawGoldOre(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant: number): void {
  const yShift = variant % 2 === 0 ? 0 : -3;
  graphics.lineStyle(2, palette.glow, oreGlowAlpha(0.9));
  graphics.beginPath();
  graphics.moveTo(3, 15 + yShift);
  graphics.lineTo(8, 12 + variant);
  graphics.lineTo(12 + (variant % 2) * 2, 15);
  graphics.lineTo(17, 8 + yShift);
  graphics.lineTo(22, 10 + variant);
  graphics.strokePath();
  graphics.fillStyle(palette.glow, oreGlowAlpha(0.68));
  graphics.fillTriangle(7 + variant, 9 + yShift, 13, 12 + variant, 9, 18);
  graphics.fillTriangle(15, 6 + variant, 21 - variant, 9, 17, 14 + yShift);
  graphics.fillStyle(palette.hot, oreGlowAlpha(0.84));
  graphics.fillRect(10, 13, 2, 2);
  graphics.fillRect(18, 9, 2, 2);
  graphics.lineStyle(1, 0xffffff, 0.24);
  graphics.lineBetween(8 + variant, 10 + yShift, 12, 12 + variant);
}

function drawCrystalOre(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant: number): void {
  const skew = variant - 1;
  graphics.lineStyle(1, palette.glow, oreGlowAlpha(0.84));
  graphics.lineBetween(4 + skew, 3 + variant, 20 - variant, 12);
  graphics.lineBetween(20 - variant, 12, 12 + skew, 22 - (variant % 2));
  graphics.lineBetween(12 + skew, 22 - (variant % 2), 4 + skew, 3 + variant);
  graphics.lineBetween(8 + variant, 6, 12 + skew, 22);
  graphics.fillStyle(palette.glow, oreGlowAlpha(0.46));
  graphics.fillTriangle(10 + skew, 7 + variant, 17 - variant, 12, 12, 18);
  graphics.fillStyle(palette.hot, oreGlowAlpha(0.72));
  graphics.fillCircle(13, 12, 1.4);
  graphics.lineStyle(1, 0xffffff, 0.28);
  graphics.lineBetween(8 + variant, 6, 13, 11 + (variant % 2));
}

function drawVoltaicOre(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant: number): void {
  graphics.lineStyle(1.5, palette.glow, oreGlowAlpha(0.9));
  graphics.beginPath();
  graphics.moveTo(2, 10 + variant);
  graphics.lineTo(7 + variant, 12);
  graphics.lineTo(13, 8 + (variant % 2));
  graphics.lineTo(21 - variant, 11);
  graphics.moveTo(7 + variant, 12);
  graphics.lineTo(9, 21 - variant);
  graphics.moveTo(13, 8 + (variant % 2));
  graphics.lineTo(16 + (variant % 2), 2 + variant);
  graphics.moveTo(13, 8);
  graphics.lineTo(18 - (variant % 2), 18);
  graphics.strokePath();
  graphics.fillStyle(palette.hot, oreGlowAlpha(0.7));
  graphics.fillCircle(12, 10, 1.8);
  graphics.fillCircle(18, 18, 1.2);
  graphics.lineStyle(1, 0xffffff, 0.22);
  graphics.lineBetween(8 + variant, 12, 13, 8 + (variant % 2));
}

function drawAetheriumOre(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant: number): void {
  graphics.lineStyle(1.2, palette.glow, oreGlowAlpha(0.84));
  graphics.strokeCircle(12, 12, 5.5 + (variant % 2));
  graphics.strokeCircle(7 + variant, 8, 2.3);
  graphics.strokeCircle(17 - (variant % 2), 16 - variant, 3.2);
  graphics.fillStyle(palette.glow, oreGlowAlpha(0.46));
  graphics.fillCircle(12, 12, 2.8 + (variant % 2) * 0.4);
  graphics.fillCircle(7 + variant, 8, 1.4);
  graphics.fillCircle(17 - (variant % 2), 16 - variant, 1.8);
  graphics.fillStyle(palette.hot, oreGlowAlpha(0.68));
  graphics.fillCircle(13, 11, 1);
  graphics.lineStyle(1, 0xffffff, 0.2);
  graphics.lineBetween(9 + variant, 8, 13, 11);
}

function drawCornerNoise(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant: number): void {
  graphics.fillStyle(palette.glow, oreGlowAlpha(0.32));
  graphics.fillRect(4 + variant, 4, 1, 1);
  graphics.fillRect(19 - variant, 5 + (variant % 2), 1, 1);
  graphics.fillRect(5, 19 - variant, 1, 1);
  graphics.fillRect(18 - (variant % 2), 18, 1, 1);
  graphics.fillStyle(palette.dim, 0.42);
  graphics.fillRect(9 + variant, 5 + (variant % 2), 1, 1);
  graphics.fillRect(14 - variant, 19 - (variant % 2), 1, 1);
}

function drawCrackedOverlay(graphics: Phaser.GameObjects.Graphics, palette: TilePalette, variant = 0, alpha = 0.92): void {
  graphics.lineStyle(1.5, palette.hot, alpha);
  graphics.beginPath();
  graphics.moveTo(3 + variant, 4);
  graphics.lineTo(8, 9 + variant);
  graphics.lineTo(6 + (variant % 2), 14);
  graphics.moveTo(8, 9 + variant);
  graphics.lineTo(14 + variant, 10);
  graphics.lineTo(19 - (variant % 2), 5 + variant);
  graphics.moveTo(13, 11);
  graphics.lineTo(17 - variant, 17);
  graphics.lineTo(21, 20 - variant);
  graphics.strokePath();

  graphics.lineStyle(1, 0xffffff, alpha * 0.38);
  graphics.lineBetween(8, 9, 14, 10);
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
    
    // Draw bubble pickup
    graphics.fillStyle(color, oreGlowAlpha(0.35));
    graphics.fillCircle(10, 10, 9);
    graphics.lineStyle(1.5, color, oreGlowAlpha(1.0));
    graphics.strokeCircle(10, 10, 7.5);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(8, 8, 2); // shine
    
    graphics.generateTexture(key, 20, 20);
    graphics.destroy();
  }

  createPowerPickupTexture(scene, "repairPack", 0xc45a4a);
  createPowerPickupTexture(scene, "coolantCell", 0x5ab8a8);
  createPowerPickupTexture(scene, "overdriveCell", 0xe8c86a);
  createPowerPickupTexture(scene, "shieldCell", 0x8a6db8);
}

function createPowerPickupTexture(scene: Phaser.Scene, id: string, color: number): void {
  const key = TEXTURES.powerPickup(id);
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(0x080706, 0.86);
  graphics.fillCircle(12, 12, 10);
  graphics.fillStyle(color, 0.32);
  graphics.fillCircle(12, 12, 9);
  graphics.lineStyle(2, color, 0.95);
  graphics.strokeCircle(12, 12, 8);
  graphics.lineStyle(2, 0xf0e4cc, 0.9);
  if (id === "repairPack") {
    graphics.lineBetween(12, 7, 12, 17);
    graphics.lineBetween(7, 12, 17, 12);
  } else if (id === "coolantCell") {
    graphics.lineBetween(12, 6, 8, 14);
    graphics.lineBetween(12, 6, 16, 14);
    graphics.lineBetween(8, 14, 16, 14);
  } else if (id === "overdriveCell") {
    graphics.beginPath();
    graphics.moveTo(13, 5);
    graphics.lineTo(8, 13);
    graphics.lineTo(13, 13);
    graphics.lineTo(11, 19);
    graphics.lineTo(18, 10);
    graphics.lineTo(13, 10);
    graphics.closePath();
    graphics.strokePath();
  } else {
    graphics.beginPath();
    graphics.moveTo(12, 5);
    graphics.lineTo(18, 8);
    graphics.lineTo(17, 15);
    graphics.lineTo(12, 19);
    graphics.lineTo(7, 15);
    graphics.lineTo(6, 8);
    graphics.closePath();
    graphics.strokePath();
  }
  graphics.fillStyle(0xffffff, 0.88);
  graphics.fillCircle(9, 8, 1.5);
  graphics.generateTexture(key, 24, 24);
  graphics.destroy();
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
    
    if (enemy === "sparkSac") {
      // Red/orange spiky gear-like hazard wheel with dark center
      graphics.fillStyle(0x000000, 0.85);
      graphics.fillCircle(24, 24, 12);
      graphics.lineStyle(2, 0xc45a4a, 0.95);
      graphics.strokeCircle(24, 24, 12);
      
      const numSpikes = 12;
      graphics.beginPath();
      for (let i = 0; i < numSpikes; i++) {
        const angle = (i / numSpikes) * Math.PI * 2;
        const x1 = 24 + Math.cos(angle) * 12;
        const y1 = 24 + Math.sin(angle) * 12;
        const x2 = 24 + Math.cos(angle + 0.13) * 22;
        const y2 = 24 + Math.sin(angle + 0.13) * 22;
        const x3 = 24 + Math.cos(angle + 0.26) * 12;
        const y3 = 24 + Math.sin(angle + 0.26) * 12;
        graphics.moveTo(x1, y1);
        graphics.lineTo(x2, y2);
        graphics.lineTo(x3, y3);
      }
      graphics.strokePath();
      
      graphics.fillStyle(0xd4845a, 0.95);
      graphics.fillCircle(24, 24, 5);
      graphics.fillStyle(0xffffff, 0.95);
      graphics.fillCircle(23, 23, 1.5);
    } else if (enemy === "prismStalker") {
      // Sleek prism diamond design
      graphics.fillStyle(0x180e12, 0.85);
      graphics.beginPath();
      graphics.moveTo(24, 6);
      graphics.lineTo(43, 24);
      graphics.lineTo(24, 42);
      graphics.lineTo(5, 24);
      graphics.closePath();
      graphics.fillPath();
      
      graphics.lineStyle(2, color, 1.0);
      graphics.strokePath();
      
      graphics.lineStyle(1, 0xe8d8b4, 0.6);
      graphics.beginPath();
      graphics.moveTo(24, 12);
      graphics.lineTo(37, 24);
      graphics.lineTo(24, 36);
      graphics.lineTo(11, 24);
      graphics.closePath();
      graphics.strokePath();
      
      graphics.fillStyle(color, 0.85);
      graphics.fillCircle(24, 24, 4);
    } else if (enemy === "phaseMite") {
      graphics.fillStyle(0x161006, 0.88);
      graphics.beginPath();
      graphics.moveTo(24, 5);
      graphics.lineTo(40, 18);
      graphics.lineTo(35, 40);
      graphics.lineTo(13, 40);
      graphics.lineTo(8, 18);
      graphics.closePath();
      graphics.fillPath();
      graphics.lineStyle(2, color, 0.95);
      graphics.strokePath();
      graphics.lineStyle(1, 0xf0e4cc, 0.72);
      graphics.lineBetween(24, 8, 24, 39);
      graphics.lineBetween(11, 20, 37, 20);
      graphics.fillStyle(0xe8c86a, 0.95);
      graphics.fillCircle(24, 24, 5);
      graphics.fillStyle(0xffffff, 0.85);
      graphics.fillCircle(22, 22, 1.4);
    } else {
      // Arc Warden cyan area controller
      graphics.fillStyle(0x0a1614, 0.85);
      graphics.fillCircle(24, 24, 18);
      graphics.lineStyle(2.5, color, 1.0);
      graphics.strokeCircle(24, 24, 16);
      graphics.lineStyle(1.5, 0xe8d8b4, 0.8);
      graphics.strokeRect(14, 14, 20, 20);
      
      graphics.fillStyle(0xe8d8b4, 0.9);
      graphics.fillCircle(24, 24, 4);
    }

    graphics.generateTexture(key, 48, 48);
    graphics.destroy();
  }
}

function createShipTexture(scene: Phaser.Scene): void {
  const ships: ShipId[] = ["pickaxe", "lance", "titan"];
  for (const ship of ships) {
    const key = TEXTURES.ship(ship);
    if (scene.textures.exists(key)) {
      continue;
    }
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    drawHewerShip(graphics, ship);
    graphics.generateTexture(key, 76, 56);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURES.reticle)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.lineStyle(1.5, 0xe8d8b4, 0.8);
    graphics.strokeCircle(10, 10, 6.5);
    graphics.lineBetween(10, 0, 10, 4);
    graphics.lineBetween(10, 16, 10, 20);
    graphics.lineBetween(0, 10, 4, 10);
    graphics.lineBetween(16, 10, 20, 10);
    graphics.generateTexture(TEXTURES.reticle, 20, 20);
    graphics.destroy();
  }
}

function drawHewerShip(graphics: Phaser.GameObjects.Graphics, ship: ShipId): void {
  const centerY = 28;
  const profile = ship === "lance"
    ? { nose: 66, tail: 12, cockpitX: 44, wingTipX: 31, wingSpan: 17, bodyHalf: 6, rearHalf: 9, finDrop: 14 }
    : ship === "titan"
      ? { nose: 63, tail: 11, cockpitX: 40, wingTipX: 29, wingSpan: 19, bodyHalf: 8, rearHalf: 11, finDrop: 15 }
      : { nose: 64, tail: 12, cockpitX: 41, wingTipX: 30, wingSpan: 18, bodyHalf: 7, rearHalf: 10, finDrop: 14 };

  const top = ship === "lance" ? 0xd3bd54 : ship === "titan" ? 0x8d4cb8 : 0x2b9a8b;
  const topDark = ship === "lance" ? 0x7f742e : ship === "titan" ? 0x472b68 : 0x15534f;
  const topLight = ship === "lance" ? 0xf0d38a : ship === "titan" ? 0xc47aee : 0x75d6c8;
  const underside = 0x121516;
  const inner = 0x252a2a;
  const plate = 0xc8bfa8;
  const plateDim = 0x8e816b;
  const outline = 0x08090a;
  const copper = 0xd4845a;
  const red = 0xc45a4a;
  const cyan = 0x5ab8a8;
  const cyanHot = 0xe2fff8;

  graphics.fillStyle(0x000000, 0.24);
  graphics.fillEllipse(37, centerY + 2, ship === "titan" ? 50 : 47, ship === "titan" ? 18 : 16);

  // Dark underside fins first, so the colored top shell sits inside the silhouette.
  graphics.fillStyle(underside, 0.98);
  graphics.lineStyle(2, outline, 0.94);
  graphics.beginPath();
  graphics.moveTo(profile.tail + 11, centerY - 4);
  graphics.lineTo(profile.wingTipX - 6, centerY - profile.wingSpan);
  graphics.lineTo(profile.wingTipX + 9, centerY - 11);
  graphics.lineTo(profile.cockpitX - 10, centerY - profile.bodyHalf);
  graphics.lineTo(profile.tail + 17, centerY - 2);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  graphics.beginPath();
  graphics.moveTo(profile.tail + 11, centerY + 4);
  graphics.lineTo(profile.wingTipX - 6, centerY + profile.wingSpan);
  graphics.lineTo(profile.wingTipX + 9, centerY + 11);
  graphics.lineTo(profile.cockpitX - 10, centerY + profile.bodyHalf);
  graphics.lineTo(profile.tail + 17, centerY + 2);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  // Bright swept top panels, closer to the provided angular ship references.
  graphics.fillStyle(top, 0.96);
  graphics.lineStyle(2.4, outline, 0.98);
  graphics.beginPath();
  graphics.moveTo(profile.tail + 5, centerY - profile.rearHalf);
  graphics.lineTo(profile.wingTipX + 5, centerY - profile.wingSpan + 4);
  graphics.lineTo(profile.cockpitX + 6, centerY - 7);
  graphics.lineTo(profile.nose - 5, centerY - 3);
  graphics.lineTo(profile.nose + 4, centerY);
  graphics.lineTo(profile.nose - 5, centerY + 3);
  graphics.lineTo(profile.cockpitX + 6, centerY + 7);
  graphics.lineTo(profile.wingTipX + 5, centerY + profile.wingSpan - 4);
  graphics.lineTo(profile.tail + 5, centerY + profile.rearHalf);
  graphics.lineTo(profile.tail + 17, centerY);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  // Dark center spine and nose reinforce direction.
  graphics.fillStyle(inner, 0.92);
  graphics.beginPath();
  graphics.moveTo(profile.tail + 14, centerY - 8);
  graphics.lineTo(profile.cockpitX - 7, centerY - 6);
  graphics.lineTo(profile.nose - 14, centerY - 2);
  graphics.lineTo(profile.nose - 6, centerY);
  graphics.lineTo(profile.nose - 14, centerY + 2);
  graphics.lineTo(profile.cockpitX - 7, centerY + 6);
  graphics.lineTo(profile.tail + 14, centerY + 8);
  graphics.closePath();
  graphics.fillPath();

  graphics.fillStyle(topDark, 0.74);
  graphics.beginPath();
  graphics.moveTo(profile.tail + 10, centerY - profile.rearHalf + 3);
  graphics.lineTo(profile.wingTipX + 6, centerY - profile.wingSpan + 7);
  graphics.lineTo(profile.cockpitX - 3, centerY - 6);
  graphics.lineTo(profile.tail + 18, centerY - 4);
  graphics.closePath();
  graphics.fillPath();
  graphics.beginPath();
  graphics.moveTo(profile.tail + 10, centerY + profile.rearHalf - 3);
  graphics.lineTo(profile.wingTipX + 6, centerY + profile.wingSpan - 7);
  graphics.lineTo(profile.cockpitX - 3, centerY + 6);
  graphics.lineTo(profile.tail + 18, centerY + 4);
  graphics.closePath();
  graphics.fillPath();

  graphics.lineStyle(1.3, plate, 0.72);
  graphics.beginPath();
  graphics.moveTo(profile.tail + 16, centerY - 8);
  graphics.lineTo(profile.cockpitX + 7, centerY - 6);
  graphics.moveTo(profile.tail + 16, centerY + 8);
  graphics.lineTo(profile.cockpitX + 7, centerY + 6);
  graphics.strokePath();

  // Accent slashes match the reference vibe without copying it.
  graphics.lineStyle(2, ship === "lance" ? cyan : red, 0.86);
  graphics.beginPath();
  graphics.moveTo(profile.wingTipX + 1, centerY - profile.wingSpan + 6);
  graphics.lineTo(profile.cockpitX + 2, centerY - 6);
  graphics.moveTo(profile.wingTipX + 1, centerY + profile.wingSpan - 6);
  graphics.lineTo(profile.cockpitX + 2, centerY + 6);
  graphics.strokePath();

  // Centered canopy.
  graphics.fillStyle(cyan, 0.82);
  graphics.lineStyle(2, outline, 0.86);
  graphics.beginPath();
  graphics.moveTo(profile.cockpitX - 7, centerY - 6);
  graphics.lineTo(profile.cockpitX + 5, centerY - 4);
  graphics.lineTo(profile.cockpitX + 10, centerY);
  graphics.lineTo(profile.cockpitX + 5, centerY + 4);
  graphics.lineTo(profile.cockpitX - 7, centerY + 6);
  graphics.lineTo(profile.cockpitX - 4, centerY);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();
  graphics.fillStyle(cyanHot, 0.9);
  graphics.fillCircle(profile.cockpitX + 2, centerY - 2, 1.4);

  // Drill-nose and engine pods.
  graphics.fillStyle(copper, 0.88);
  graphics.lineStyle(2, outline, 0.8);
  graphics.beginPath();
  graphics.moveTo(profile.nose - 7, centerY - 3);
  graphics.lineTo(profile.nose + 5, centerY);
  graphics.lineTo(profile.nose - 7, centerY + 3);
  graphics.closePath();
  graphics.fillPath();
  graphics.strokePath();

  graphics.fillStyle(outline, 0.96);
  graphics.fillRoundedRect(profile.tail - 1, centerY - 10, 10, 5, 2);
  graphics.fillRoundedRect(profile.tail - 1, centerY + 5, 10, 5, 2);
  graphics.fillStyle(copper, 0.82);
  graphics.fillRect(profile.tail - 6, centerY - 8, 5, 2);
  graphics.fillRect(profile.tail - 6, centerY + 7, 5, 2);

  graphics.lineStyle(2, cyan, 0.54);
  graphics.lineBetween(profile.tail - 7, centerY - 7, profile.tail - 15, centerY - 7);
  graphics.lineBetween(profile.tail - 7, centerY + 8, profile.tail - 15, centerY + 8);

  graphics.lineStyle(1.5, plateDim, 0.72);
  const ventCount = ship === "lance" ? 3 : 4;
  for (let i = 0; i < ventCount; i += 1) {
    const x = profile.tail + 15 + i * 5;
    graphics.lineBetween(x, centerY - 15, x + 3, centerY - 15);
    graphics.lineBetween(x, centerY + 15, x + 3, centerY + 15);
  }

  if (ship === "titan") {
    graphics.fillStyle(0x17191a, 0.86);
    graphics.lineStyle(2, plateDim, 0.72);
    graphics.strokeRoundedRect(22, centerY - 15, 12, 4, 2);
    graphics.strokeRoundedRect(22, centerY + 11, 12, 4, 2);
    graphics.fillRoundedRect(10, centerY - 13, 8, 4, 2);
    graphics.fillRoundedRect(10, centerY + 9, 8, 4, 2);
  } else if (ship === "lance") {
    graphics.lineStyle(1.5, topLight, 0.68);
    graphics.lineBetween(37, centerY - 9, 58, centerY - 3);
    graphics.lineBetween(37, centerY + 9, 58, centerY + 3);
  }
}

function createBossTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists(TEXTURES.bossHead)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    
    // Bulbous orange head
    graphics.fillStyle(0x1a1210, 0.95);
    graphics.fillCircle(36, 36, 32);
    
    graphics.lineStyle(3.5, 0xd4845a, 1.0);
    graphics.strokeCircle(36, 36, 29);
    
    // Concentric inner red-orange ring
    graphics.lineStyle(2, 0xc45a4a, 0.85);
    graphics.strokeCircle(36, 36, 18);
    
    // Glowing cyan eyes
    graphics.fillStyle(0x5ab8a8, 1.0);
    graphics.fillCircle(25, 25, 5.5);
    graphics.fillCircle(47, 25, 5.5);
    graphics.fillStyle(0xe8d8b4, 0.9);
    graphics.fillCircle(24, 24, 2);
    graphics.fillCircle(46, 24, 2);
    
    // Feelers/spiky head structures
    graphics.lineStyle(2.5, 0xd4845a, 0.9);
    graphics.lineBetween(36, 4, 36, -8);
    graphics.lineBetween(12, 12, 0, 0);
    graphics.lineBetween(60, 12, 72, 0);
    
    graphics.generateTexture(TEXTURES.bossHead, 72, 72);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURES.bossSegment)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    
    // Dark segment body
    graphics.fillStyle(0x140e0a, 0.95);
    graphics.fillCircle(28, 28, 25);
    
    // Orange segmented border
    graphics.lineStyle(3, 0xd4845a, 1.0);
    graphics.strokeCircle(28, 28, 22);
    
    graphics.lineStyle(1.5, 0x8a6db8, 0.8);
    graphics.strokeCircle(28, 28, 12);
    
    // Side circle legs/tentacles
    graphics.fillStyle(0xd4845a, 1.0);
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      graphics.fillCircle(28 + Math.cos(angle) * 23.5, 28 + Math.sin(angle) * 23.5, 3.5);
    }
    
    graphics.generateTexture(TEXTURES.bossSegment, 56, 56);
    graphics.destroy();
  }
}

function createFxTextures(scene: Phaser.Scene): void {
  createParticle(scene, TEXTURES.particleWhite, 0xffffff);
  createParticle(scene, TEXTURES.particleCyan, 0x5ab8a8);
  createParticle(scene, TEXTURES.particleAmber, 0xd4845a);
  createParticle(scene, TEXTURES.particleMagenta, 0xc47a8a);
  createBombCoreTexture(scene);
  createRadialGlowTexture(scene);
  createVisibilityVignetteTexture(scene);
}

function createParticle(scene: Phaser.Scene, key: string, color: number): void {
  if (scene.textures.exists(key)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  
  // Smooth circular particles matching references (flat, crisp circle look)
  graphics.fillStyle(color, 1.0);
  graphics.fillCircle(8, 8, 6.5);
  graphics.lineStyle(1.5, 0xe8d8b4, 0.65);
  graphics.strokeCircle(8, 8, 7.5);
  
  graphics.generateTexture(key, 16, 16);
  graphics.destroy();
}

function createBombCoreTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURES.bombCore)) {
    return;
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
  graphics.fillStyle(0x2a1208, 0.9);
  graphics.fillCircle(12, 12, 10);
  graphics.fillStyle(0xd4845a, 1);
  graphics.fillCircle(12, 12, 6.5);
  graphics.fillStyle(0xe8d8b4, 0.95);
  graphics.fillCircle(10, 10, 2.5);
  graphics.lineStyle(2, 0xc4a86e, 0.95);
  graphics.strokeCircle(12, 12, 9);
  graphics.generateTexture(TEXTURES.bombCore, 24, 24);
  graphics.destroy();
}

function createRadialGlowTexture(scene: Phaser.Scene): void {
  const key = "fx.glow.radial";
  if (scene.textures.exists(key)) {
    return;
  }

  const size = 128;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (canvas) {
    const ctx = canvas.getContext();
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, "rgba(232, 200, 160, 1)");
    grad.addColorStop(0.3, "rgba(232, 200, 160, 0.45)");
    grad.addColorStop(0.7, "rgba(232, 200, 160, 0.1)");
    grad.addColorStop(1, "rgba(232, 200, 160, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}

function createVisibilityVignetteTexture(scene: Phaser.Scene): void {
  const key = "fx.visibility.vignette";
  if (scene.textures.exists(key)) {
    return;
  }

  const size = 512;
  const canvas = scene.textures.createCanvas(key, size, size);
  if (!canvas) {
    return;
  }

  const ctx = canvas.getContext();
  const center = size / 2;
  const grad = ctx.createRadialGradient(center, center, size * 0.1, center, center, size * 0.72);
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.28, "rgba(0, 0, 0, 0.06)");
  grad.addColorStop(0.55, "rgba(0, 0, 0, 0.5)");
  grad.addColorStop(0.78, "rgba(0, 0, 0, 0.82)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.98)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
}
