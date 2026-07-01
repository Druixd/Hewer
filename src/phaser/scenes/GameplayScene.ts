import Phaser from "phaser";
import { TEXTURES } from "../../game/assets/manifest";
import { TERRITORY_CONFIG } from "../../game/content/config";
import { createEmptyActions } from "../../game/input/actions";
import { createGameState } from "../../game/simulation/state";
import {
  bankRunResult,
  createRunSeed,
  loadProgress,
  prepareProgressForNewRun,
  tryBuyUpgrade,
  tryCraftActiveTask
} from "../../game/simulation/systems/progression";
import { updateGame } from "../../game/simulation/systems/update";
import { TILE_SIZE, type GameEvent, type GameState, type InputActions, type UpgradeState } from "../../game/simulation/types";
import { getTile, isSolid, worldBounds } from "../../game/simulation/world";
import { getHudController } from "../../ui/hud/HudController";

type KeyMap = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "SPACE" | "SHIFT" | "ESC" | "E", Phaser.Input.Keyboard.Key>;
const MINIMAP_SIZE = 110;
const MINIMAP_MARGIN = 20;
const MINIMAP_ZOOM = 0.08;
const MINIMAP_RADIUS = MINIMAP_SIZE / MINIMAP_ZOOM / 2;
const MINIMAP_TILE_RANGE = Math.ceil(MINIMAP_RADIUS / TILE_SIZE) + 2;

export class GameplayScene extends Phaser.Scene {
  private state!: GameState;
  private progress!: UpgradeState;
  private keys!: KeyMap;
  private ship!: Phaser.GameObjects.Image;
  private reticle!: Phaser.GameObjects.Image;
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private fieldGraphics!: Phaser.GameObjects.Graphics;
  private hazardGraphics!: Phaser.GameObjects.Graphics;
  private playerLight!: Phaser.GameObjects.Image;
  private tileSprites: Array<Phaser.GameObjects.Image | null> = [];
  private tileGlows: Array<Phaser.GameObjects.Image[] | null> = [];
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private bombSprites = new Map<string, { core: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }>();
  private bossHead: Phaser.GameObjects.Image | null = null;
  private bossSegments: Phaser.GameObjects.Image[] = [];
  private resultBanked = false;
  private isPaused = false;
  private lastTrailTime = 0;
  private minimap!: Phaser.Cameras.Scene2D.Camera;
  private minimapGraphics!: Phaser.GameObjects.Graphics;

  private backdropRect!: Phaser.GameObjects.Rectangle;
  private starsGraphics!: Phaser.GameObjects.Graphics;
  private cavernGrid!: Phaser.GameObjects.Graphics;

  constructor() {
    super("GameplayScene");
  }

  create(data?: { seed?: string }): void {
    this.resetViewCaches();
    this.progress = loadProgress();
    if (!data?.seed) {
      this.progress = prepareProgressForNewRun(this.progress);
    }
    const seed = data?.seed ?? createRunSeed(this.progress);
    this.state = createGameState(seed, this.progress);
    this.progress = this.state.upgrades;
    this.resultBanked = false;
    this.isPaused = false;
    this.lastTrailTime = 0;

    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,ESC,E") as KeyMap;

    this.createWorldView();
    this.createActors();
    this.configureCamera();
    this.configureHud();
  }

  private resetViewCaches(): void {
    this.tileSprites = [];
    this.tileGlows = [];
    this.enemySprites.clear();
    this.pickupSprites.clear();
    this.bombSprites.clear();
    this.bossHead = null;
    this.bossSegments = [];
  }

  update(_time: number, deltaMs: number): void {
    const hud = getHudController();
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.isPaused = !this.isPaused;
      hud.setPaused(this.isPaused);
    }

    if (this.isPaused) {
      return;
    }

    const dt = Math.min(deltaMs / 1000, 0.034);
    const actions = this.collectActions();
    updateGame(this.state, actions, dt);

    this.syncTilesFromEvents(this.state.events);
    this.syncActors();
    this.drawTransientWorld();
    this.drawMinimap();
    this.handleEvents(this.state.events);
    hud.update(this.state, this.progress);

    if (this.state.runResult && !this.resultBanked) {
      this.resultBanked = true;
      this.progress = bankRunResult(this.progress, this.state.runResult);
      hud.showRunSummary(this.state.runResult, this.progress);
    }
  }

  private drawMinimap(): void {
    if (!this.minimapGraphics) return;

    const player = this.state.player;
    this.minimap.centerOn(player.x, player.y);
    const centerTileX = Math.floor(player.x / TILE_SIZE);
    const centerTileY = Math.floor(player.y / TILE_SIZE);
    const radiusSq = MINIMAP_RADIUS * MINIMAP_RADIUS;

    this.minimapGraphics.clear();
    this.minimapGraphics.fillStyle(0x0a0908, 0.82);
    this.minimapGraphics.fillCircle(player.x, player.y, MINIMAP_RADIUS * 0.98);

    this.minimapGraphics.lineStyle(8, 0x6a5a42, 0.40);
    for (let y = centerTileY - MINIMAP_TILE_RANGE; y <= centerTileY + MINIMAP_TILE_RANGE; y += 1) {
      for (let x = centerTileX - MINIMAP_TILE_RANGE; x <= centerTileX + MINIMAP_TILE_RANGE; x += 1) {
        const tile = getTile(this.state.world, x, y);
        if (!isSolid(tile)) {
          continue;
        }

        const tileCenterX = x * TILE_SIZE + TILE_SIZE / 2;
        const tileCenterY = y * TILE_SIZE + TILE_SIZE / 2;
        const dx = tileCenterX - player.x;
        const dy = tileCenterY - player.y;
        if (dx * dx + dy * dy > radiusSq) {
          continue;
        }

        this.drawMinimapEdge(x, y, x - 1, y, "left");
        this.drawMinimapEdge(x, y, x + 1, y, "right");
        this.drawMinimapEdge(x, y, x, y - 1, "top");
        this.drawMinimapEdge(x, y, x, y + 1, "bottom");
      }
    }

    this.minimapGraphics.fillStyle(0xd4845a, 0.90);
    for (const enemy of this.state.enemies) {
      if (this.isInMinimapRange(enemy.x, enemy.y)) {
        this.minimapGraphics.fillCircle(enemy.x, enemy.y, 24);
      }
    }

    if (this.isInMinimapRange(this.state.world.extraction.x, this.state.world.extraction.y)) {
      this.minimapGraphics.fillStyle(0x5ab8a8, 0.90);
      this.minimapGraphics.fillCircle(this.state.world.extraction.x, this.state.world.extraction.y, 28);
    }

    this.minimapGraphics.fillStyle(0xe8c86a, 1);
    this.minimapGraphics.fillCircle(player.x, player.y, 34);
    this.minimapGraphics.fillStyle(0xe8d8b4, 1);
    this.minimapGraphics.fillTriangle(
      player.x + Math.cos(player.angle) * 36,
      player.y + Math.sin(player.angle) * 36,
      player.x + Math.cos(player.angle + 2.35) * 22,
      player.y + Math.sin(player.angle + 2.35) * 22,
      player.x + Math.cos(player.angle - 2.35) * 22,
      player.y + Math.sin(player.angle - 2.35) * 22
    );
  }

  private drawMinimapEdge(tileX: number, tileY: number, neighborX: number, neighborY: number, side: "left" | "right" | "top" | "bottom"): void {
    if (isSolid(getTile(this.state.world, neighborX, neighborY))) {
      return;
    }

    const left = tileX * TILE_SIZE;
    const top = tileY * TILE_SIZE;
    const right = left + TILE_SIZE;
    const bottom = top + TILE_SIZE;

    if (side === "left") {
      this.minimapGraphics.lineBetween(left, top, left, bottom);
    } else if (side === "right") {
      this.minimapGraphics.lineBetween(right, top, right, bottom);
    } else if (side === "top") {
      this.minimapGraphics.lineBetween(left, top, right, top);
    } else {
      this.minimapGraphics.lineBetween(left, bottom, right, bottom);
    }
  }

  private isInMinimapRange(x: number, y: number): boolean {
    const dx = x - this.state.player.x;
    const dy = y - this.state.player.y;
    return dx * dx + dy * dy <= MINIMAP_RADIUS * MINIMAP_RADIUS;
  }

  private createWorldView(): void {
    this.backdropRect = this.add.rectangle(0, 0, 12000, 8000, 0x06080f, 1).setOrigin(0);

    this.starsGraphics = this.add.graphics();
    const bounds = worldBounds(this.state.world);
    for (let i = 0; i < 140; i += 1) {
      const x = (i * 997) % bounds.width;
      const y = (i * 593) % bounds.height;
      const alpha = 0.04 + ((i * 17) % 26) / 100;
      const color = i % 5 === 0 ? 0xd4845a : i % 8 === 0 ? 0x5ab8a8 : 0xf0e4cc;
      this.starsGraphics.fillStyle(color, alpha);
      this.starsGraphics.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
    }

    this.drawCavernAtmosphere();

    this.tileGlows = new Array(this.state.world.tiles.length).fill(null);
    this.tileSprites = this.state.world.tiles.map((tile, index) => {
      if (!isSolid(tile)) {
        return null;
      }

      const x = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const y = tile.y * TILE_SIZE + TILE_SIZE / 2;

      let glowColor: number | null = null;
      if (tile.type === "shimmer") {
        glowColor = 0x8a6db8;
      } else if (tile.type === "voltaic") {
        glowColor = 0x5ab8a8;
      } else if (tile.type === "aetherium") {
        glowColor = 0xc47a8a;
      } else if (tile.type === "ferrite") {
        glowColor = 0xc4a86e; // Warm brass glow
      }

      if (glowColor !== null) {
        // Reduced background glow to prevent stack overlay
        const bgGlow = this.add.image(x, y, "fx.glow.radial")
          .setDepth(0)
          .setOrigin(0.5)
          .setScale(1.5)
          .setAlpha(0.12)
          .setTint(glowColor)
          .setBlendMode(Phaser.BlendModes.ADD);
        
        // Reduced core glow (layered directly on top of basalt to look emitted from ore itself)
        const coreGlow = this.add.image(x, y, "fx.glow.radial")
          .setDepth(3)
          .setOrigin(0.5)
          .setScale(0.65)
          .setAlpha(0.24)
          .setTint(glowColor)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.tileGlows[index] = [bgGlow, coreGlow];
      }

      const texture = TEXTURES.tile(tile.type);
      const sprite = this.add.image(x, y, texture).setDepth(2);

      // High opacity for basalt/metals to keep beautiful silhouettes
      const alpha = tile.type === "basalt" ? 0.95 : tile.type === "ancient" ? 0.85 : 1.0;
      sprite.setAlpha(alpha);
      sprite.setBlendMode(Phaser.BlendModes.NORMAL);
      if (tile.cracked) {
        sprite.setTint(0xd6c8a8);
      }
      return sprite;
    });
  }

  private drawCavernAtmosphere(): void {
    const bounds = worldBounds(this.state.world);

    this.cavernGrid = this.add.graphics().setDepth(0);
    this.cavernGrid.lineStyle(1, 0x1e1a12, 0.08);
    for (let x = 0; x < bounds.width; x += TILE_SIZE) {
      this.cavernGrid.lineBetween(x, 0, x, bounds.height);
    }
    for (let y = 0; y < bounds.height; y += TILE_SIZE) {
      this.cavernGrid.lineBetween(0, y, bounds.width, y);
    }

    const ambientColors = (TERRITORY_CONFIG[this.state.world.territory] ?? TERRITORY_CONFIG.shimmerVeins).palette.ambient;
    for (let i = 0; i < 90; i++) {
      const cx = (i * 997) % bounds.width;
      const cy = (i * 613) % bounds.height;
      const color = ambientColors[i % ambientColors.length];
      const glow = this.add.image(cx, cy, "fx.glow.radial")
        .setDepth(0)
        .setOrigin(0.5)
        .setScale(4.5 + (i % 4) * 1.5)
        .setAlpha(0.08)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  private createActors(): void {
    this.beamGraphics = this.add.graphics().setDepth(8);
    this.fieldGraphics = this.add.graphics().setDepth(4);
    this.hazardGraphics = this.add.graphics().setDepth(9);
    this.playerLight = this.add.image(this.state.player.x, this.state.player.y, "fx.glow.radial")
      .setDepth(5)
      .setOrigin(0.5)
      .setScale(4.8)
      .setAlpha(0.34)
      .setTint(0xc4a86e)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.reticle = this.add.image(this.state.player.x, this.state.player.y, TEXTURES.reticle).setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
    this.ship = this.add.image(this.state.player.x, this.state.player.y, TEXTURES.ship).setDepth(14);

    // Local navigation graphics are rendered only by the minimap camera.
    this.minimapGraphics = this.add.graphics().setDepth(21);
    this.cameras.main.ignore(this.minimapGraphics);
  }

  private configureCamera(): void {
    const bounds = worldBounds(this.state.world);
    
    // Main camera follow configuration
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.ship, true, 0.075, 0.075);
    this.cameras.main.setDeadzone(0, 0);
    this.cameras.main.setFollowOffset(0, 0);
    this.cameras.main.setZoom(window.innerWidth < 720 ? 0.74 : 0.9);

    // Circular minimap camera in bottom-right corner
    this.minimap = this.cameras.add(
      window.innerWidth - MINIMAP_SIZE - MINIMAP_MARGIN,
      window.innerHeight - MINIMAP_SIZE - MINIMAP_MARGIN,
      MINIMAP_SIZE,
      MINIMAP_SIZE
    );
    this.minimap.startFollow(this.ship, true, 1, 1);
    this.minimap.setZoom(MINIMAP_ZOOM);
    this.minimap.setBackgroundColor("rgba(0, 0, 0, 0)");
    this.minimap.setRoundPixels(true);

    // The radar draws its own local edge layer; ignore live world objects so it cannot reveal the level.
    if (this.backdropRect) this.minimap.ignore(this.backdropRect);
    if (this.starsGraphics) this.minimap.ignore(this.starsGraphics);
    if (this.cavernGrid) this.minimap.ignore(this.cavernGrid);
    if (this.beamGraphics) this.minimap.ignore(this.beamGraphics);
    if (this.fieldGraphics) this.minimap.ignore(this.fieldGraphics);
    if (this.hazardGraphics) this.minimap.ignore(this.hazardGraphics);
    if (this.playerLight) this.minimap.ignore(this.playerLight);
    if (this.reticle) this.minimap.ignore(this.reticle);
    if (this.ship) this.minimap.ignore(this.ship);
    this.tileSprites.forEach((sprite) => {
      if (sprite) {
        this.minimap.ignore(sprite);
      }
    });
    this.tileGlows.forEach((glows) => {
      glows?.forEach((glow) => this.minimap.ignore(glow));
    });

    this.children.each((child) => {
      if (child instanceof Phaser.GameObjects.Image && child.texture?.key === "fx.glow.radial") {
        this.minimap.ignore(child);
      }
    });

    // Handle resizing positions dynamically
    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.minimap.setPosition(gameSize.width - MINIMAP_SIZE - MINIMAP_MARGIN, gameSize.height - MINIMAP_SIZE - MINIMAP_MARGIN);
    });
  }

  private configureHud(): void {
    const hud = getHudController();
    hud.setHandlers({
      sameSeed: () => this.scene.restart({ seed: this.state.world.seed }),
      newRun: () => {
        this.progress = prepareProgressForNewRun(this.progress);
        this.scene.restart({ seed: createRunSeed(this.progress) });
      },
      buyUpgrade: (id) => {
        this.progress = tryBuyUpgrade(this.progress, id);
        return this.progress;
      },
      craftObjective: () => {
        this.progress = tryCraftActiveTask(this.progress);
        this.state.upgrades = this.progress;
        return this.progress;
      },
      resume: () => {
        this.isPaused = false;
        hud.setPaused(false);
      }
    });
    hud.update(this.state, this.progress);
    hud.hideRunSummary();
    hud.setPaused(false);
  }

  private collectActions(): InputActions {
    const actions = createEmptyActions();
    const pointer = this.input.activePointer;
    const player = this.state.player;

    const forwardFromPointer = {
      x: pointer.worldX - player.x,
      y: pointer.worldY - player.y
    };
    const forwardLength = Math.hypot(forwardFromPointer.x, forwardFromPointer.y);
    const forward = forwardLength > 1
      ? {
          x: forwardFromPointer.x / forwardLength,
          y: forwardFromPointer.y / forwardLength
        }
      : {
          x: Math.cos(player.angle),
          y: Math.sin(player.angle)
        };
    const right = { x: -forward.y, y: forward.x };
    const forwardAxis = (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0) - (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0);
    const strafeAxis = (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    const move = {
      x: forward.x * forwardAxis + right.x * strafeAxis,
      y: forward.y * forwardAxis + right.y * strafeAxis
    };
    const moveLength = Math.hypot(move.x, move.y);

    actions.move = moveLength > 1
      ? {
          x: move.x / moveLength,
          y: move.y / moveLength
        }
      : move;
    actions.aim = { x: pointer.worldX, y: pointer.worldY };
    actions.primaryFire = pointer.leftButtonDown();
    actions.secondaryAbility = pointer.rightButtonDown();
    actions.dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    actions.toggleIntensityPressed = Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    actions.pausePressed = false;
    actions.extractPressed = Phaser.Input.Keyboard.JustDown(this.keys.E);
    return actions;
  }

  private syncActors(): void {
    const player = this.state.player;
    this.ship.setPosition(player.x, player.y);
    this.ship.setRotation(player.angle);
    this.ship.setScale(player.collectionPulse > 0 ? 1.08 : 1);
    this.ship.setAlpha(player.invulnerableTimer > 0 ? 0.72 : 1);
    this.playerLight.setPosition(player.x, player.y);
    this.playerLight.setScale(player.invulnerableTimer > 0 ? 5.4 : 4.8);
    this.playerLight.setAlpha(player.invulnerableTimer > 0 ? 0.46 : 0.34);
    this.reticle.setPosition(this.input.activePointer.worldX, this.input.activePointer.worldY);

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 35 && this.time.now - this.lastTrailTime > 24) {
      this.lastTrailTime = this.time.now;
      this.spawnPlayerTrailLine(player.x, player.y, player.vx, player.vy, speed);
    }

    this.syncEnemies();
    this.syncPickups();
    this.syncBombs();
    this.syncBoss();
  }

  private spawnPlayerTrailLine(x: number, y: number, vx: number, vy: number, speed: number): void {
    const trailDirX = -vx / speed;
    const trailDirY = -vy / speed;
    const sideX = -trailDirY;
    const sideY = trailDirX;
    const length = Phaser.Math.Clamp(speed * 0.035, 18, 42);
    const sideOffset = (Math.random() - 0.5) * 3;
    const noseX = x + trailDirX * 15 + sideX * sideOffset;
    const noseY = y + trailDirY * 15 + sideY * sideOffset;
    const tailX = noseX + trailDirX * length;
    const tailY = noseY + trailDirY * length;

    const trail = this.add.graphics()
      .setDepth(13)
      .setAlpha(0.92)
      .setBlendMode(Phaser.BlendModes.ADD);

    trail.lineStyle(7, 0xe8c86a, 0.2);
    trail.beginPath();
    trail.moveTo(noseX, noseY);
    trail.lineTo(tailX, tailY);
    trail.strokePath();
    trail.lineStyle(3, 0xfff5d7, 0.72);
    trail.beginPath();
    trail.moveTo(noseX, noseY);
    trail.lineTo(tailX, tailY);
    trail.strokePath();

    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 170,
      ease: "Cubic.easeOut",
      onComplete: () => {
        trail.destroy();
      }
    });
  }

  private syncEnemies(): void {
    const live = new Set<string>();
    for (const enemy of this.state.enemies) {
      live.add(enemy.id);
      let sprite = this.enemySprites.get(enemy.id);
      if (!sprite) {
        sprite = this.add.image(enemy.x, enemy.y, TEXTURES.enemy(enemy.kind)).setDepth(12);
        this.enemySprites.set(enemy.id, sprite);
        this.minimap?.ignore(sprite); // Ignore enemies on minimap to keep it clean
      }

      sprite.setPosition(enemy.x, enemy.y);
      sprite.setRotation(enemy.kind === "prismStalker" ? Math.atan2(enemy.vy, enemy.vx) : enemy.timer);
      sprite.setAlpha(enemy.state === "windup" ? 0.72 : 1);
      sprite.setScale(enemy.state === "pulsing" ? 1.08 : 1);
    }

    for (const [id, sprite] of this.enemySprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.enemySprites.delete(id);
      }
    }
  }

  private syncPickups(): void {
    const live = new Set<string>();
    for (const pickup of this.state.pickups) {
      live.add(pickup.id);
      let sprite = this.pickupSprites.get(pickup.id);
      if (!sprite) {
        sprite = this.add.image(pickup.x, pickup.y, TEXTURES.pickup(pickup.ore)).setDepth(11);
        this.pickupSprites.set(pickup.id, sprite);
        this.minimap?.ignore(sprite); // Ignore pickups on minimap to keep it clean
      }

      sprite.setPosition(pickup.x, pickup.y);
      sprite.setRotation(pickup.age * 4);
      sprite.setScale(pickup.magnetized ? 1.1 : 0.92);
    }

    for (const [id, sprite] of this.pickupSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.pickupSprites.delete(id);
      }
    }
  }

  private syncBombs(): void {
    const live = new Set<string>();
    for (const bomb of this.state.bombs) {
      live.add(bomb.id);
      let sprites = this.bombSprites.get(bomb.id);
      if (!sprites) {
        const glow = this.add.image(bomb.x, bomb.y, "fx.glow.radial")
          .setDepth(10)
          .setScale(0.8)
          .setTint(bomb.color)
          .setAlpha(0.58)
          .setBlendMode(Phaser.BlendModes.ADD);
        const core = this.add.image(bomb.x, bomb.y, TEXTURES.bombCore)
          .setDepth(15)
          .setBlendMode(Phaser.BlendModes.ADD);
        sprites = { core, glow };
        this.bombSprites.set(bomb.id, sprites);
        this.minimap?.ignore(glow);
        this.minimap?.ignore(core);
      }

      const pulse = 1 + Math.sin(bomb.age * 32) * 0.08;
      sprites.core.setPosition(bomb.x, bomb.y);
      sprites.core.setRotation(bomb.age * 7);
      sprites.core.setScale(pulse);
      sprites.glow.setPosition(bomb.x, bomb.y);
      sprites.glow.setScale(0.72 + pulse * 0.18);
    }

    for (const [id, sprites] of this.bombSprites) {
      if (!live.has(id)) {
        sprites.core.destroy();
        sprites.glow.destroy();
        this.bombSprites.delete(id);
      }
    }
  }

  private syncBoss(): void {
    const boss = this.state.boss;
    if (!boss.active && !boss.defeated) {
      return;
    }

    if (!boss.active && boss.defeated) {
      this.bossHead?.destroy();
      this.bossHead = null;
      this.bossSegments.forEach((segment) => segment.destroy());
      this.bossSegments = [];
      return;
    }

    if (!this.bossHead) {
      this.bossHead = this.add.image(boss.x, boss.y, TEXTURES.bossHead).setDepth(13);
      this.minimap?.ignore(this.bossHead); // Ignore boss head on minimap
    }

    this.bossHead.setPosition(boss.x, boss.y);
    this.bossHead.setRotation(Math.atan2(boss.vy, boss.vx));

    while (this.bossSegments.length < boss.segments.length) {
      const segmentSprite = this.add.image(0, 0, TEXTURES.bossSegment).setDepth(12);
      this.minimap?.ignore(segmentSprite); // Ignore boss segments on minimap
      this.bossSegments.push(segmentSprite);
    }

    boss.segments.forEach((segment, index) => {
      const sprite = this.bossSegments[index];
      sprite.setPosition(segment.x, segment.y);
      sprite.setScale(segment.radius / 24);
      sprite.setRotation(index * 0.36 + this.state.elapsed);
    });
  }

  private drawTransientWorld(): void {
    this.drawBeam();
    this.drawEnemyFields();
    this.drawHazards();
  }

  private drawBeam(): void {
    this.beamGraphics.clear();
    const beam = this.state.beam;
    if (!beam.active) {
      return;
    }

    const color = beam.heat === "high" ? 0xd4845a : 0x5ab8a8;
    this.beamGraphics.lineStyle(8, color, 0.18);
    this.beamGraphics.lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    this.beamGraphics.lineStyle(3, color, 0.95);
    this.beamGraphics.lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    this.beamGraphics.fillStyle(0xffffff, 0.9);
    this.beamGraphics.fillCircle(beam.x2, beam.y2, beam.heat === "high" ? 6 : 4);
  }

  private drawEnemyFields(): void {
    this.fieldGraphics.clear();
    for (const enemy of this.state.enemies) {
      if (enemy.kind !== "arcWarden") {
        continue;
      }

      const active = enemy.state === "pulsing";
      this.fieldGraphics.lineStyle(active ? 2 : 1, 0x6ec4b8, active ? 0.48 : 0.18);
      this.fieldGraphics.strokeCircle(enemy.x, enemy.y, active ? 70 : 44);
    }
  }

  private drawHazards(): void {
    this.hazardGraphics.clear();
    for (const hazard of this.state.hazards) {
      if (hazard.kind === "lightning") {
        const charged = hazard.age >= hazard.damageAt;
        this.hazardGraphics.lineStyle(charged ? 7 : 3, charged ? 0xf0e4cc : 0x8a6db8, charged ? 0.88 : 0.28);
        this.hazardGraphics.lineBetween(hazard.x1, hazard.y1, hazard.x2, hazard.y2);
      } else {
        const progress = hazard.age / hazard.duration;
        const color = hazard.kind === "swarmExplosion" ? 0xe8c86a : 0xd4845a;
        const alpha = hazard.kind === "swarmExplosion" ? 0.22 : 0.14;
        this.hazardGraphics.lineStyle(hazard.kind === "swarmExplosion" ? 5 : 3, color, 1 - progress);
        this.hazardGraphics.strokeCircle(hazard.x1, hazard.y1, hazard.radius * progress);
        this.hazardGraphics.fillStyle(color, alpha * (1 - progress));
        this.hazardGraphics.fillCircle(hazard.x1, hazard.y1, hazard.radius * progress);
      }
    }
  }

  private syncTilesFromEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type !== "tile-broken") {
        continue;
      }

      const tx = Math.floor(event.x / TILE_SIZE);
      const ty = Math.floor(event.y / TILE_SIZE);
      const idx = ty * this.state.world.width + tx;
      
      const sprite = this.tileSprites[idx];
      sprite?.setVisible(false);

      const glows = this.tileGlows[idx];
      if (glows) {
        glows.forEach((g) => g.destroy());
        this.tileGlows[idx] = null;
      }
    }
  }

  private handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === "tile-broken") {
        this.spawnBurst(event.x, event.y, event.color, 10, 130);
        this.cameras.main.shake(52, 0.0025);
      }

      if (event.type === "pickup-collected") {
        this.spawnBurst(event.x, event.y, event.color, 4, 70);
      }

      if (event.type === "enemy-killed") {
        this.spawnBurst(event.x, event.y, event.color, 16, 180);
        this.cameras.main.shake(92, 0.004);
      }

      if (event.type === "player-hit") {
        this.cameras.main.shake(90, 0.006);
      }

      if (event.type === "overheat") {
        this.spawnBurst(event.x, event.y, event.color, 12, 95);
        this.cameras.main.shake(80, 0.003);
      }

      if (event.type === "player-dash") {
        this.spawnGlowPulse(event.x, event.y, event.color, 1.5, 170);
      }

      if (event.type === "swarm-bomb-fired") {
        this.spawnBurst(event.x, event.y, event.color, 8, 92);
        this.spawnGlowPulse(event.x, event.y, event.color, 1.1, 150);
      }

      if (event.type === "swarm-bomb-exploded") {
        this.spawnBurst(event.x, event.y, event.color, 18, 190);
        this.spawnGlowPulse(event.x, event.y, event.color, 1.9, 260);
        this.cameras.main.shake(76, 0.0035);
      }

      if (event.type === "boss-breakout") {
        this.cameras.main.flash(220, 140, 90, 60, false);
        this.cameras.main.shake(430, 0.01);
      }

      if (event.type === "boss-defeated") {
        this.spawnBurst(event.x, event.y, event.color, 44, 360);
        this.cameras.main.flash(320, 232, 216, 180, false);
        this.cameras.main.shake(620, 0.014);
      }
    }
  }

  private spawnBurst(x: number, y: number, color: number, count: number, speed: number): void {
    const texture = color === 0xd4845a ? TEXTURES.particleAmber : color === 0xc47a8a ? TEXTURES.particleMagenta : color === 0x5ab8a8 ? TEXTURES.particleCyan : TEXTURES.particleWhite;

    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.45;
      const distance = speed * (0.25 + Math.random() * 0.75);
      const particle = this.add.image(x, y, texture).setDepth(30).setTint(color).setBlendMode(Phaser.BlendModes.ADD);
      particle.setScale(0.7 + Math.random() * 0.9);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.1,
        duration: 260 + Math.random() * 240,
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private spawnGlowPulse(x: number, y: number, color: number, scale: number, duration: number): void {
    const glow = this.add.image(x, y, "fx.glow.radial")
      .setDepth(29)
      .setTint(color)
      .setScale(scale)
      .setAlpha(0.64)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.minimap?.ignore(glow);
    this.tweens.add({
      targets: glow,
      scale: scale * 2.8,
      alpha: 0,
      duration,
      ease: "Quad.easeOut",
      onComplete: () => glow.destroy()
    });
  }
}
