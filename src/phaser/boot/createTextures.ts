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
        // Dark basalt wireframe block
        graphics.fillStyle(0x0b0713, 0.95);
        graphics.fillRect(0, 0, 24, 24);

        // Diagonal hatching lines (creates continuous diagonal scanline view on minimap)
        graphics.lineStyle(1, 0x1d1433, 0.7);
        for (let offset = -24; offset < 24; offset += 4) {
          graphics.lineBetween(offset, 0.5, offset + 24, 23.5);
        }
        
        // Double outline
        graphics.lineStyle(1, 0x221735, 0.8);
        graphics.strokeRect(0.5, 0.5, 23, 23);
        graphics.lineStyle(1, config.glow, 0.65);
        graphics.strokeRect(3.5, 3.5, 17, 17);
        
        // Diagonals connecting corners
        graphics.lineStyle(1, config.glow, 0.45);
        graphics.lineBetween(0.5, 0.5, 3.5, 3.5);
        graphics.lineBetween(23.5, 0.5, 20.5, 3.5);
        graphics.lineBetween(0.5, 23.5, 3.5, 20.5);
        graphics.lineBetween(23.5, 23.5, 20.5, 20.5);
        
        // Subtle inner dot
        graphics.fillStyle(config.glow, 0.55);
        graphics.fillRect(11, 11, 2, 2);
      } else if (block === "ferrite") {
        // Metallic plate with corner bolts
        graphics.fillStyle(0x111417, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0x5c6770, 0.7);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        graphics.lineStyle(1, config.glow, 0.85);
        graphics.strokeRect(4.5, 4.5, 15, 15);
        
        // Corner bolts
        graphics.fillStyle(0xd7e0e2, 0.9);
        graphics.fillRect(2.5, 2.5, 2, 2);
        graphics.fillRect(19.5, 2.5, 2, 2);
        graphics.fillRect(2.5, 19.5, 2, 2);
        graphics.fillRect(19.5, 19.5, 2, 2);
        
        // Center metal structural square
        graphics.fillStyle(0x5c6770, 0.4);
        graphics.fillRect(8.5, 8.5, 7, 7);
      } else if (block === "shimmer") {
        // Purple block with nested glowing rounded circles
        graphics.fillStyle(0x0e091f, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0x8f78ff, 0.95);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        
        // Concentric rings
        graphics.strokeCircle(12, 12, 8);
        graphics.lineStyle(1, 0x8f78ff, 0.6);
        graphics.strokeCircle(12, 12, 4);
        
        graphics.fillStyle(0x8f78ff, 0.8);
        graphics.fillCircle(12, 12, 2);
      } else if (block === "voltaic") {
        // Cyan/yellow with cracked crystal structures
        graphics.fillStyle(0x051a1e, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1.5, 0x41e6e2, 1.0);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        
        // Fracture lines
        graphics.beginPath();
        graphics.moveTo(1.5, 7);
        graphics.lineTo(10, 11);
        graphics.lineTo(22.5, 5);
        graphics.moveTo(10, 11);
        graphics.lineTo(13, 22.5);
        graphics.moveTo(10, 11);
        graphics.lineTo(1.5, 17);
        graphics.strokePath();
        
        // Glowing center shard
        graphics.fillStyle(0x41e6e2, 0.7);
        graphics.fillRect(9, 10, 4, 3);
      } else if (block === "aetherium") {
        // Magenta bubbly block
        graphics.fillStyle(0x190b20, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0xf05dff, 0.95);
        graphics.strokeRect(1.5, 1.5, 21, 21);
        
        // Bubble textures inside
        graphics.fillStyle(0xf05dff, 0.35);
        
        graphics.strokeCircle(7, 7, 4.5);
        graphics.fillCircle(7, 7, 3.5);
        
        graphics.strokeCircle(16.5, 15.5, 5.5);
        graphics.fillCircle(16.5, 15.5, 4.5);
        
        graphics.strokeCircle(9.5, 16.5, 3);
        graphics.fillCircle(9.5, 16.5, 2);
        
        graphics.strokeCircle(17, 6, 3.5);
        graphics.fillCircle(17, 6, 2.5);
      } else if (block === "ancient") {
        // Ancient bricks / runic design
        graphics.fillStyle(0x050408, 0.95);
        graphics.fillRect(0, 0, 24, 24);
        
        graphics.lineStyle(1, 0x292142, 0.8);
        graphics.strokeRect(0.5, 0.5, 23, 23);
        
        graphics.lineStyle(1.5, 0x5a4890, 0.75);
        graphics.strokeRect(4.5, 4.5, 15, 15);
        
        // Cross layout
        graphics.lineStyle(1, 0x292142, 0.6);
        graphics.lineBetween(12, 0.5, 12, 23.5);
        graphics.lineBetween(0.5, 12, 23.5, 12);
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
      graphics.lineStyle(2, 0xff2b2b, 1.0);
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
      
      graphics.fillStyle(0xffb22b, 1.0);
      graphics.fillCircle(24, 24, 5);
      graphics.fillStyle(0xffffff, 0.95);
      graphics.fillCircle(23, 23, 1.5);
    } else if (enemy === "prismStalker") {
      // Sleek prism diamond design
      graphics.fillStyle(0x1a0518, 0.85);
      graphics.beginPath();
      graphics.moveTo(24, 6);
      graphics.lineTo(43, 24);
      graphics.lineTo(24, 42);
      graphics.lineTo(5, 24);
      graphics.closePath();
      graphics.fillPath();
      
      graphics.lineStyle(2, color, 1.0);
      graphics.strokePath();
      
      graphics.lineStyle(1, 0xffffff, 0.65);
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
      graphics.fillStyle(0x051a24, 0.85);
      graphics.fillCircle(24, 24, 18);
      graphics.lineStyle(2.5, color, 1.0);
      graphics.strokeCircle(24, 24, 16);
      graphics.lineStyle(1.5, 0xffffff, 0.85);
      graphics.strokeRect(14, 14, 20, 20);
      
      graphics.fillStyle(0xffffff, 0.95);
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
    graphics.fillStyle(0xffffff, 0.95);
    graphics.beginPath();
    graphics.moveTo(5, 8);
    graphics.lineTo(25, 22);
    graphics.lineTo(5, 36);
    graphics.lineTo(15, 22);
    graphics.closePath();
    graphics.fillPath();
    
    // Sleek cockpit / hull (golden yellow)
    graphics.fillStyle(0xf8d54a, 1.0);
    graphics.beginPath();
    graphics.moveTo(13, 22);
    graphics.lineTo(25, 14);
    graphics.lineTo(48, 22);
    graphics.lineTo(25, 30);
    graphics.closePath();
    graphics.fillPath();
    
    // Energy engine lines
    graphics.lineStyle(1.5, 0xffc247, 0.9);
    graphics.lineBetween(13, 22, 48, 22);
    
    // Cockpit glass (white/cyan glow)
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillCircle(30, 22, 4.5);
    graphics.fillStyle(0x41e6e2, 0.8);
    graphics.fillCircle(31, 22, 2.5);
    
    graphics.generateTexture(TEXTURES.ship, 56, 44);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURES.reticle)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.lineStyle(1.5, 0xffffff, 0.85);
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
    graphics.fillStyle(0x231337, 0.95);
    graphics.fillCircle(36, 36, 32);
    
    graphics.lineStyle(3.5, 0xff9f43, 1.0);
    graphics.strokeCircle(36, 36, 29);
    
    // Concentric inner red-orange ring
    graphics.lineStyle(2, 0xff4c38, 0.9);
    graphics.strokeCircle(36, 36, 18);
    
    // Glowing cyan eyes
    graphics.fillStyle(0x41e6e2, 1.0);
    graphics.fillCircle(25, 25, 5.5);
    graphics.fillCircle(47, 25, 5.5);
    graphics.fillStyle(0xffffff, 0.95);
    graphics.fillCircle(24, 24, 2);
    graphics.fillCircle(46, 24, 2);
    
    // Feelers/spiky head structures
    graphics.lineStyle(2.5, 0xff9f43, 0.95);
    graphics.lineBetween(36, 4, 36, -8);
    graphics.lineBetween(12, 12, 0, 0);
    graphics.lineBetween(60, 12, 72, 0);
    
    graphics.generateTexture(TEXTURES.bossHead, 72, 72);
    graphics.destroy();
  }

  if (!scene.textures.exists(TEXTURES.bossSegment)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    
    // Dark segment body
    graphics.fillStyle(0x190c29, 0.95);
    graphics.fillCircle(28, 28, 25);
    
    // Orange segmented border
    graphics.lineStyle(3, 0xff9f43, 1.0);
    graphics.strokeCircle(28, 28, 22);
    
    graphics.lineStyle(1.5, 0x8b6dff, 0.85);
    graphics.strokeCircle(28, 28, 12);
    
    // Side circle legs/tentacles
    graphics.fillStyle(0xff9f43, 1.0);
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
  createParticle(scene, TEXTURES.particleCyan, 0x41e6e2);
  createParticle(scene, TEXTURES.particleAmber, 0xffc247);
  createParticle(scene, TEXTURES.particleMagenta, 0xf05dff);
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
  graphics.lineStyle(1.5, 0xffffff, 0.7);
  graphics.strokeCircle(8, 8, 7.5);
  
  graphics.generateTexture(key, 16, 16);
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
    grad.addColorStop(0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.3, "rgba(255, 255, 255, 0.5)");
    grad.addColorStop(0.7, "rgba(255, 255, 255, 0.12)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    canvas.refresh();
  }
}
