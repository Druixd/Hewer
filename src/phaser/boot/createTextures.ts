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
      if (block === "basalt") {
        // Dark basalt with horizontal strata layers
        graphics.fillStyle(0x0c0a07, 0.95);
        graphics.fillRect(0, 0, 24, 24);

        // Horizontal sediment strata lines
        graphics.lineStyle(1, 0x1a1610, 0.6);
        for (let row = 3; row < 24; row += 5) {
          graphics.lineBetween(0.5, row + ((row * 7) % 3) * 0.5, 23.5, row);
        }
        
        // Subtle outer border
        graphics.lineStyle(1, 0x1e1a12, 0.7);
        graphics.strokeRect(0.5, 0.5, 23, 23);
        graphics.lineStyle(1, config.glow, 0.5);
        graphics.strokeRect(3.5, 3.5, 17, 17);
        
        // Small grain dots scattered
        graphics.fillStyle(config.glow, 0.4);
        graphics.fillRect(6, 5, 1, 1);
        graphics.fillRect(17, 9, 1, 1);
        graphics.fillRect(10, 17, 1, 1);
        graphics.fillRect(19, 19, 1, 1);
        graphics.fillRect(4, 14, 1, 1);
      } else if (block === "ferrite") {
        // Layered mineral bands with metallic flecks
        graphics.fillStyle(0x12100a, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        // Horizontal mineral bands
        graphics.fillStyle(config.glow, 0.18);
        graphics.fillRect(0, 4, 24, 3);
        graphics.fillRect(0, 13, 24, 4);
        
        graphics.lineStyle(1, 0x7a6842, 0.6);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        graphics.lineStyle(1, config.glow, 0.7);
        graphics.strokeRect(4.5, 4.5, 15, 15);
        
        // Metallic fleck dots
        graphics.fillStyle(0xd4c090, 0.8);
        graphics.fillRect(3, 5, 1.5, 1.5);
        graphics.fillRect(14, 5, 1.5, 1.5);
        graphics.fillRect(8, 14, 1.5, 1.5);
        graphics.fillRect(18, 15, 1.5, 1.5);
        
        // Center mineral grain
        graphics.fillStyle(config.glow, 0.35);
        graphics.fillRect(9, 9, 6, 5);
      } else if (block === "shimmer") {
        // Crystal facet pattern
        graphics.fillStyle(0x0e0a18, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0x7a5da0, 0.85);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        
        // Crystal facet lines (angular cuts)
        graphics.lineStyle(1, config.glow, 0.7);
        graphics.lineBetween(4, 2, 20, 12);
        graphics.lineBetween(20, 12, 12, 22);
        graphics.lineBetween(12, 22, 4, 2);
        
        // Inner gleam highlight
        graphics.fillStyle(config.glow, 0.55);
        graphics.fillTriangle(10, 8, 16, 12, 12, 18);
        
        // Bright facet point
        graphics.fillStyle(0xe8d8b4, 0.7);
        graphics.fillCircle(12, 12, 1.5);
      } else if (block === "voltaic") {
        // Branching mineral vein pattern
        graphics.fillStyle(0x081614, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1.2, 0x4a9a8a, 0.9);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        
        // Branching vein lines (like real mineral veins)
        graphics.lineStyle(1.5, config.glow, 0.8);
        graphics.beginPath();
        graphics.moveTo(2, 10);
        graphics.lineTo(8, 12);
        graphics.lineTo(14, 8);
        graphics.lineTo(22, 11);
        graphics.moveTo(8, 12);
        graphics.lineTo(10, 20);
        graphics.moveTo(14, 8);
        graphics.lineTo(16, 2);
        graphics.strokePath();
        
        // Soft center vein node
        graphics.fillStyle(config.glow, 0.5);
        graphics.fillCircle(11, 12, 2.5);
      } else if (block === "aetherium") {
        // Fossil-like spiral organic pattern
        graphics.fillStyle(0x180e12, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0xa06878, 0.85);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        
        // Fossil spiral marks
        graphics.lineStyle(1.2, config.glow, 0.7);
        graphics.beginPath();
        graphics.arc(12, 12, 7, 0, Math.PI * 1.5, false);
        graphics.strokePath();
        graphics.beginPath();
        graphics.arc(12, 12, 4, Math.PI * 0.5, Math.PI * 2, false);
        graphics.strokePath();
        
        // Organic ring dots
        graphics.fillStyle(config.glow, 0.5);
        graphics.fillCircle(12, 12, 2);
        graphics.fillStyle(config.glow, 0.3);
        graphics.fillCircle(7, 8, 1.5);
        graphics.fillCircle(16, 16, 1.5);
      } else if (block === "ancient") {
        // Worn carved symbols, weathered edges
        graphics.fillStyle(0x060504, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0x221e16, 0.7);
        graphics.strokeRect(0.5, 0.5, 23, 23);
        
        graphics.lineStyle(1.2, 0x3a3222, 0.6);
        graphics.strokeRect(4.5, 4.5, 15, 15);
        
        // Worn carved marks
        graphics.lineStyle(1, config.glow, 0.45);
        graphics.lineBetween(8, 8, 16, 16);
        graphics.lineBetween(16, 8, 8, 16);
        graphics.fillStyle(config.glow, 0.3);
        graphics.fillCircle(12, 12, 2);
      }
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
    
    // Draw bubble pickup
    graphics.fillStyle(color, 0.35);
    graphics.fillCircle(10, 10, 9);
    graphics.lineStyle(1.5, color, 1.0);
    graphics.strokeCircle(10, 10, 7.5);
    graphics.fillStyle(0xffffff, 0.9);
    graphics.fillCircle(8, 8, 2); // shine
    
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
  if (!scene.textures.exists(TEXTURES.ship)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    
    // Sleek wing shapes (white)
    graphics.fillStyle(0xe8d8b4, 0.92);
    graphics.beginPath();
    graphics.moveTo(5, 8);
    graphics.lineTo(25, 22);
    graphics.lineTo(5, 36);
    graphics.lineTo(15, 22);
    graphics.closePath();
    graphics.fillPath();
    
    // Sleek cockpit / hull (golden yellow)
    graphics.fillStyle(0xd4845a, 1.0);
    graphics.beginPath();
    graphics.moveTo(13, 22);
    graphics.lineTo(25, 14);
    graphics.lineTo(48, 22);
    graphics.lineTo(25, 30);
    graphics.closePath();
    graphics.fillPath();
    
    // Energy engine lines
    graphics.lineStyle(1.5, 0xc4a86e, 0.9);
    graphics.lineBetween(13, 22, 48, 22);
    
    // Cockpit glass (white/cyan glow)
    graphics.fillStyle(0xe8d8b4, 0.92);
    graphics.fillCircle(30, 22, 4.5);
    graphics.fillStyle(0x5ab8a8, 0.75);
    graphics.fillCircle(31, 22, 2.5);
    
    graphics.generateTexture(TEXTURES.ship, 56, 44);
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
