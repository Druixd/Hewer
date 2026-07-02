import Phaser from "phaser";
import { TEXTURES } from "../../game/assets/manifest";
import { TERRITORY_CONFIG } from "../../game/content/config";
import { createEmptyActions } from "../../game/input/actions";
import { createGameState } from "../../game/simulation/state";
import {
  bankRunResult,
  canCraftActiveTask,
  createRunSeed,
  effectiveStats,
  loadProgress,
  prepareProgressForNewRun,
  tryBuyUnlock,
  tryBuyUpgrade,
  tryCraftActiveTask,
  tryEquipWeapon
} from "../../game/simulation/systems/progression";
import { updateGame } from "../../game/simulation/systems/update";
import { coordNoise } from "../../game/simulation/random";
import { TILE_SIZE, type BlockId, type GameEvent, type GameState, type InputActions, type UnlockId, type UpgradeState, type WeaponId } from "../../game/simulation/types";
import { getTile, isSolid, worldBounds } from "../../game/simulation/world";
import { getHudController } from "../../ui/hud/HudController";

type KeyMap = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "SPACE" | "SHIFT" | "ESC" | "E", Phaser.Input.Keyboard.Key>;
const MINIMAP_SIZE = 110;
const MINIMAP_MARGIN = 20;
const MINIMAP_ZOOM = 0.08;
const MINIMAP_RADIUS = MINIMAP_SIZE / MINIMAP_ZOOM / 2;
const MINIMAP_TILE_RANGE = Math.ceil(MINIMAP_RADIUS / TILE_SIZE) + 2;
const TILE_VARIANT_COUNT = 4;

export class GameplayScene extends Phaser.Scene {
  private state!: GameState;
  private progress!: UpgradeState;
  private keys!: KeyMap;
  private ship!: Phaser.GameObjects.Image;
  private reticle!: Phaser.GameObjects.Image;
  private beamGraphics!: Phaser.GameObjects.Graphics;
  private fieldGraphics!: Phaser.GameObjects.Graphics;
  private hazardGraphics!: Phaser.GameObjects.Graphics;
  private objectiveGraphics!: Phaser.GameObjects.Graphics;
  private playerLight!: Phaser.GameObjects.Image;
  private caveEdgeGraphics!: Phaser.GameObjects.Graphics;
  private tileSprites: Array<Phaser.GameObjects.Image | null> = [];
  private tileGlows: Array<Phaser.GameObjects.Image[] | null> = [];
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private enemyGlowSprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupGlowSprites = new Map<string, Phaser.GameObjects.Image>();
  private projectileSprites = new Map<string, { core: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }>();
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
  private parallaxCaveLayers: Phaser.GameObjects.Graphics[] = [];
  private moodOverlay!: Phaser.GameObjects.Rectangle;
  private visibilityVignette!: Phaser.GameObjects.Image;
  private extractionGlow!: Phaser.GameObjects.Image;
  private audioFeedback!: GameplayAudio;
  private wasRightDown = false;
  private screenWidth = 0;
  private screenHeight = 0;
  private pendingStoreResultAt = 0;
  private storeShuttle: Phaser.GameObjects.Image | null = null;

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
    this.wasRightDown = false;
    this.screenWidth = 0;
    this.screenHeight = 0;
    this.pendingStoreResultAt = 0;
    this.storeShuttle = null;

    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,ESC,E") as KeyMap;

    this.createWorldView();
    this.createActors();
    this.audioFeedback = new GameplayAudio(this);
    this.configureCamera();
    this.configureHud();
  }

  private resetViewCaches(): void {
    this.tileSprites = [];
    this.tileGlows = [];
    this.enemySprites.clear();
    this.enemyGlowSprites.clear();
    this.pickupSprites.clear();
    this.pickupGlowSprites.clear();
    this.projectileSprites.clear();
    this.bombSprites.clear();
    this.bossHead = null;
    this.bossSegments = [];
    this.parallaxCaveLayers = [];
  }

  update(_time: number, deltaMs: number): void {
    const hud = getHudController();
    if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.isPaused = !this.isPaused;
      hud.setPaused(this.isPaused);
    }

    if (this.isPaused) {
      this.maybeShowRunResult(hud);
      return;
    }

    const dt = Math.min(deltaMs / 1000, 0.034);
    this.syncScreenSpaceLayout();
    const actions = this.collectActions();
    updateGame(this.state, actions, dt);

    this.syncTilesFromEvents(this.state.events);
    this.syncActors();
    this.drawTransientWorld();
    this.drawMinimap();
    this.updateMoodPresentation();
    this.audioFeedback.updateMood(this.state.threat.mood);
    this.handleEvents(this.state.events);
    hud.update(this.state, this.progress);

    this.maybeShowRunResult(hud);
  }

  private maybeShowRunResult(hud = getHudController()): void {
    if (!this.state.runResult || this.resultBanked) {
      return;
    }
    if (this.state.runResult.mode === "store" && this.time.now < this.pendingStoreResultAt) {
      return;
    }

    this.resultBanked = true;
    this.progress = bankRunResult(this.progress, this.state.runResult);
    this.state.upgrades = this.progress;
    hud.showRunSummary(this.state.runResult, this.progress);
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
    const bounds = worldBounds(this.state.world);
    this.backdropRect = this.add.rectangle(0, 0, bounds.width * 1.12, bounds.height * 1.12, 0x111826, 1)
      .setDepth(-8)
      .setOrigin(0)
      .setScrollFactor(0.04);
    this.drawParallaxSpaceCave(bounds);
    this.drawCavernAtmosphere();

    this.tileGlows = new Array(this.state.world.tiles.length).fill(null);
    this.tileSprites = this.state.world.tiles.map((tile, index) => {
      if (!isSolid(tile)) {
        return null;
      }

      const x = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const y = tile.y * TILE_SIZE + TILE_SIZE / 2;

      const glowColor = oreGlowForTile(tile.type);

      if (glowColor !== null) {
        const bgGlow = this.add.image(x, y, "fx.glow.radial")
          .setDepth(0)
          .setOrigin(0.5)
          .setScale(1.35)
          .setAlpha(0.13)
          .setTint(glowColor)
          .setBlendMode(Phaser.BlendModes.ADD);
        
        const coreGlow = this.add.image(x, y, "fx.glow.radial")
          .setDepth(3)
          .setOrigin(0.5)
          .setScale(0.58)
          .setAlpha(0.28)
          .setTint(glowColor)
          .setBlendMode(Phaser.BlendModes.ADD);

        this.tileGlows[index] = [bgGlow, coreGlow];
      }

      const texture = TEXTURES.tile(tile.type, this.state.world.territory, tile.cracked, tileVisualVariant(this.state.world.seed, tile.x, tile.y, tile.type, tile.cracked));
      const sprite = this.add.image(x, y, texture).setDepth(2);

      // Keep cave mass visible without competing with ore, ship, and enemies.
      const alpha = tile.type === "basalt" ? 1 : tile.type === "ancient" ? 0.96 : 1.0;
      sprite.setAlpha(alpha);
      sprite.setScale(tile.type === "basalt" || tile.type === "ancient" ? 1.045 : 1.02);
      sprite.setBlendMode(Phaser.BlendModes.NORMAL);
      return sprite;
    });

    this.drawCaveEdges();
  }

  private drawParallaxSpaceCave(bounds: { width: number; height: number }): void {
    this.starsGraphics = this.add.graphics().setDepth(-7).setScrollFactor(0.11);
    for (let i = 0; i < 210; i += 1) {
      const x = coordNoise(this.state.world.seed, i, 0, 910) * bounds.width;
      const y = coordNoise(this.state.world.seed, i, 0, 911) * bounds.height;
      const alpha = 0.08 + coordNoise(this.state.world.seed, i, 0, 912) * 0.22;
      const color = i % 7 === 0 ? 0xd8a05a : i % 9 === 0 ? 0x64c8b7 : 0xf0e4cc;
      this.starsGraphics.fillStyle(color, alpha);
      this.starsGraphics.fillRect(x, y, i % 11 === 0 ? 2 : 1, 1);
    }

    const farStrata = this.add.graphics().setDepth(-6).setScrollFactor(0.24);
    for (let i = 0; i < 42; i += 1) {
      const x = coordNoise(this.state.world.seed, i, 1, 920) * bounds.width;
      const y = coordNoise(this.state.world.seed, i, 1, 921) * bounds.height;
      const length = 120 + coordNoise(this.state.world.seed, i, 1, 922) * 280;
      const color = i % 4 === 0 ? 0x26354a : i % 4 === 1 ? 0x243c3a : 0x31253d;
      farStrata.lineStyle(2, color, 0.16);
      farStrata.lineBetween(x, y, Math.min(bounds.width, x + length), y + (coordNoise(this.state.world.seed, i, 1, 923) - 0.5) * 18);
    }

    const midStrata = this.add.graphics().setDepth(-5).setScrollFactor(0.46);
    for (let i = 0; i < 58; i += 1) {
      const x = coordNoise(this.state.world.seed, i, 2, 930) * bounds.width;
      const y = coordNoise(this.state.world.seed, i, 2, 931) * bounds.height;
      const length = 48 + coordNoise(this.state.world.seed, i, 2, 933) * 130;
      midStrata.lineStyle(1, i % 3 === 0 ? 0x3a4d62 : i % 3 === 1 ? 0x36554d : 0x52405f, 0.12);
      midStrata.lineBetween(x, y, Math.min(bounds.width, x + length), y);
    }

    const foregroundDust = this.add.graphics().setDepth(1).setScrollFactor(0.72);
    for (let i = 0; i < 260; i += 1) {
      const x = coordNoise(this.state.world.seed, i, 3, 940) * bounds.width;
      const y = coordNoise(this.state.world.seed, i, 3, 941) * bounds.height;
      const alpha = 0.018 + coordNoise(this.state.world.seed, i, 3, 942) * 0.06;
      const color = i % 5 === 0 ? 0xc4a86e : i % 8 === 0 ? 0x5ab8a8 : 0xb796d8;
      foregroundDust.fillStyle(color, alpha);
      foregroundDust.fillCircle(x, y, i % 9 === 0 ? 1.9 : 0.9);
    }

    this.parallaxCaveLayers.push(farStrata, midStrata, foregroundDust);
  }

  private drawCavernAtmosphere(): void {
    const bounds = worldBounds(this.state.world);

    this.cavernGrid = this.add.graphics().setDepth(0).setScrollFactor(0.95);
    for (let i = 0; i < 220; i += 1) {
      const x = coordNoise(this.state.world.seed, i, 5, 960) * bounds.width;
      const y = coordNoise(this.state.world.seed, i, 5, 961) * bounds.height;
      const alpha = 0.028 + coordNoise(this.state.world.seed, i, 5, 962) * 0.032;
      const color = i % 6 === 0 ? 0xd4845a : i % 9 === 0 ? 0x5ab8a8 : 0xe8d8b4;
      this.cavernGrid.fillStyle(color, alpha);
      this.cavernGrid.fillCircle(x, y, i % 5 === 0 ? 1.6 : 0.8);
    }

  }

  private drawCaveEdges(): void {
    this.caveEdgeGraphics = this.add.graphics().setDepth(4);
    this.minimap?.ignore(this.caveEdgeGraphics);
    this.caveEdgeGraphics.lineStyle(2, 0x7f88a8, 0.34);

    for (const tile of this.state.world.tiles) {
      if (!isSolid(tile)) {
        continue;
      }

      const left = tile.x * TILE_SIZE;
      const top = tile.y * TILE_SIZE;
      const right = left + TILE_SIZE;
      const bottom = top + TILE_SIZE;

      if (!isSolid(getTile(this.state.world, tile.x - 1, tile.y))) {
        this.caveEdgeGraphics.lineBetween(left, top, left, bottom);
      }
      if (!isSolid(getTile(this.state.world, tile.x + 1, tile.y))) {
        this.caveEdgeGraphics.lineBetween(right, top, right, bottom);
      }
      if (!isSolid(getTile(this.state.world, tile.x, tile.y - 1))) {
        this.caveEdgeGraphics.lineBetween(left, top, right, top);
      }
      if (!isSolid(getTile(this.state.world, tile.x, tile.y + 1))) {
        this.caveEdgeGraphics.lineBetween(left, bottom, right, bottom);
      }
    }
  }

  private createActors(): void {
    this.beamGraphics = this.add.graphics().setDepth(8);
    this.fieldGraphics = this.add.graphics().setDepth(4);
    this.hazardGraphics = this.add.graphics().setDepth(9);
    this.objectiveGraphics = this.add.graphics().setDepth(7);
    this.moodOverlay = this.add.rectangle(0, 0, 1, 1, 0x000000, 0)
      .setDepth(6)
      .setOrigin(0)
      .setScrollFactor(0);
    this.moodOverlay.setSize(this.scale.width, this.scale.height);
    this.visibilityVignette = this.add.image(this.scale.width / 2, this.scale.height / 2, "fx.visibility.vignette")
      .setDepth(18)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(1);
    this.fitVisibilityVignette(this.scale.width, this.scale.height);
    this.scale.on("resize", (gameSize: Phaser.Structs.Size) => {
      this.syncScreenSpaceLayout(gameSize.width, gameSize.height);
    });
    this.extractionGlow = this.add.image(this.state.world.extraction.x, this.state.world.extraction.y, "fx.glow.radial")
      .setDepth(6)
      .setOrigin(0.5)
      .setScale(1.35)
      .setAlpha(0)
      .setTint(0x5ab8a8)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.playerLight = this.add.image(this.state.player.x, this.state.player.y, "fx.glow.radial")
      .setDepth(5)
      .setOrigin(0.5)
      .setScale(4.1)
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
    if (this.caveEdgeGraphics) this.minimap.ignore(this.caveEdgeGraphics);
    this.parallaxCaveLayers.forEach((layer) => this.minimap.ignore(layer));
    if (this.beamGraphics) this.minimap.ignore(this.beamGraphics);
    if (this.fieldGraphics) this.minimap.ignore(this.fieldGraphics);
    if (this.hazardGraphics) this.minimap.ignore(this.hazardGraphics);
    if (this.objectiveGraphics) this.minimap.ignore(this.objectiveGraphics);
    if (this.moodOverlay) this.minimap.ignore(this.moodOverlay);
    if (this.visibilityVignette) this.minimap.ignore(this.visibilityVignette);
    if (this.extractionGlow) this.minimap.ignore(this.extractionGlow);
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
      this.cameras.main.setViewport(0, 0, gameSize.width, gameSize.height);
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
        const previousMaxHull = this.state.player.maxHull;
        this.progress = tryBuyUpgrade(this.progress, id);
        this.state.upgrades = this.progress;
        this.state.stats = effectiveStats(this.progress);
        this.state.player.maxHull = this.state.stats.maxHull;
        if (this.state.player.maxHull > previousMaxHull) {
          this.state.player.hull += this.state.player.maxHull - previousMaxHull;
        }
        return this.progress;
      },
      buyUnlock: (id: UnlockId) => {
        this.progress = tryBuyUnlock(this.progress, id);
        this.state.upgrades = this.progress;
        return this.progress;
      },
      equipWeapon: (id: WeaponId) => {
        this.progress = tryEquipWeapon(this.progress, id);
        this.state.upgrades = this.progress;
        this.state.events.push({ type: "weapon-switched", x: this.state.player.x, y: this.state.player.y, color: 0xe8c86a });
        return this.progress;
      },
      craftObjective: () => {
        const wasReady = canCraftActiveTask(this.progress);
        this.progress = tryCraftActiveTask(this.progress);
        this.state.upgrades = this.progress;
        if (wasReady) {
          this.audioFeedback.play("craftSuccess");
          this.spawnGlowPulse(this.state.player.x, this.state.player.y, 0x5ab8a8, 1.3, 210);
        } else {
          this.audioFeedback.play("craftBlocked");
          this.cameras.main.shake(60, 0.0018);
        }
        return this.progress;
      },
      resume: () => {
        this.isPaused = false;
        hud.setPaused(false);
      },
      closeSummary: (result) => {
        hud.hideRunSummary();
        if (result?.mode === "store") {
          this.state.runResult = null;
          this.resultBanked = false;
          this.pendingStoreResultAt = 0;
          this.isPaused = false;
          this.spawnGlowPulse(this.state.player.x, this.state.player.y, 0x5ab8a8, 1.05, 180);
          return;
        }

        this.progress = prepareProgressForNewRun(this.progress);
        this.scene.restart({ seed: createRunSeed(this.progress) });
      }
    });
    hud.update(this.state, this.progress);
    hud.hideRunSummary();
    hud.setPaused(false);
  }

  private fitVisibilityVignette(width: number, height: number): void {
    if (!this.visibilityVignette) {
      return;
    }

    this.visibilityVignette.setPosition(width / 2, height / 2);
    const cover = Math.hypot(width, height) * 1.32;
    this.visibilityVignette.setDisplaySize(cover, cover);
  }

  private syncScreenSpaceLayout(width = Math.max(this.scale.width, window.innerWidth), height = Math.max(this.scale.height, window.innerHeight)): void {
    if (Math.abs(this.scale.width - window.innerWidth) > 1 || Math.abs(this.scale.height - window.innerHeight) > 1) {
      this.scale.resize(window.innerWidth, window.innerHeight);
      width = window.innerWidth;
      height = window.innerHeight;
    }

    if (width === this.screenWidth && height === this.screenHeight) {
      return;
    }

    this.screenWidth = width;
    this.screenHeight = height;
    this.cameras.main.setViewport(0, 0, width, height);
    this.moodOverlay?.setSize(width, height);
    this.fitVisibilityVignette(width, height);
    this.minimap?.setPosition(width - MINIMAP_SIZE - MINIMAP_MARGIN, height - MINIMAP_SIZE - MINIMAP_MARGIN);
  }

  private currentAimWorldPoint(): Phaser.Math.Vector2 {
    const pointer = this.input.activePointer;
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private collectActions(): InputActions {
    const actions = createEmptyActions();
    const pointer = this.input.activePointer;
    const aim = this.currentAimWorldPoint();
    const player = this.state.player;

    const forwardFromPointer = {
      x: aim.x - player.x,
      y: aim.y - player.y
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
    actions.aim = { x: aim.x, y: aim.y };
    actions.primaryFire = pointer.leftButtonDown();
    const rightDown = pointer.rightButtonDown();
    actions.secondaryAbility = rightDown;
    actions.secondaryPressed = rightDown && !this.wasRightDown;
    this.wasRightDown = rightDown;
    actions.dashPressed = Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    actions.shieldPressed = Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    actions.toggleIntensityPressed = false;
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
    const speed = Math.hypot(player.vx, player.vy);
    const movementGlow = Phaser.Math.Clamp(speed / 520, 0, 0.22);
    const lightPulse = Math.sin(this.state.elapsed * 3.2) * 0.025;
    this.playerLight.setScale((player.invulnerableTimer > 0 ? 4.8 : 4.1) + movementGlow);
    this.playerLight.setAlpha((player.invulnerableTimer > 0 ? 0.46 : 0.34) + movementGlow * 0.36 + lightPulse);
    const aim = this.currentAimWorldPoint();
    this.reticle.setPosition(aim.x, aim.y);
    this.extractionGlow.setAlpha(0);

    if (speed > 35 && this.time.now - this.lastTrailTime > 24) {
      this.lastTrailTime = this.time.now;
      this.spawnPlayerTrailLine(player.x, player.y, player.vx, player.vy, speed);
    }

    this.syncEnemies();
    this.syncPickups();
    this.syncProjectiles();
    this.syncBombs();
    this.syncBoss();
    this.updateLocalVisibility();
  }

  private updateLocalVisibility(): void {
    const player = this.state.player;
    const inner = 230;
    const outer = 760;

    const alphaFor = (x: number, y: number, minAlpha: number, maxAlpha: number) => {
      const dist = Math.hypot(x - player.x, y - player.y);
      const t = Phaser.Math.Clamp((dist - inner) / (outer - inner), 0, 1);
      return Phaser.Math.Linear(maxAlpha, minAlpha, t);
    };

    for (let index = 0; index < this.tileSprites.length; index += 1) {
      const sprite = this.tileSprites[index];
      if (!sprite?.visible) {
        continue;
      }
      const tile = this.state.world.tiles[index];
      const maxAlpha = tile.type === "ancient" ? 0.88 : tile.type === "basalt" ? 0.92 : 1;
      sprite.setAlpha(alphaFor(sprite.x, sprite.y, tile.type === "basalt" || tile.type === "ancient" ? 0.035 : 0.09, maxAlpha));
      const glows = this.tileGlows[index];
      glows?.forEach((glow) => glow.setAlpha(alphaFor(glow.x, glow.y, 0.01, tile.type === "basalt" ? 0.08 : 0.28)));
    }

    this.enemySprites.forEach((sprite) => sprite.setAlpha(alphaFor(sprite.x, sprite.y, 0.18, 1)));
    this.enemyGlowSprites.forEach((sprite) => sprite.setAlpha(alphaFor(sprite.x, sprite.y, 0.04, 0.42)));
    this.pickupSprites.forEach((sprite) => sprite.setAlpha(alphaFor(sprite.x, sprite.y, 0.2, 1)));
    this.pickupGlowSprites.forEach((sprite) => sprite.setAlpha(alphaFor(sprite.x, sprite.y, 0.04, 0.52)));
    this.caveEdgeGraphics?.setAlpha(alphaFor(player.x, player.y, 0.48, 0.78));
  }

  private updateMoodPresentation(): void {
    if (!this.moodOverlay) {
      return;
    }

    if (this.state.threat.mood === "breakout") {
      this.moodOverlay.setFillStyle(0x4a1630, 0.14 + Math.sin(this.state.elapsed * 9) * 0.035);
    } else if (this.state.threat.mood === "surging") {
      this.moodOverlay.setFillStyle(0x32150a, 0.09 + Math.sin(this.state.elapsed * 5) * 0.025);
    } else if (this.state.threat.mood === "waking") {
      this.moodOverlay.setFillStyle(0x1a1228, 0.055 + Math.sin(this.state.elapsed * 3) * 0.014);
    } else {
      this.moodOverlay.setFillStyle(0x000000, 0.1);
    }
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
      let glow = this.enemyGlowSprites.get(enemy.id);
      if (!sprite) {
        glow = this.add.image(enemy.x, enemy.y, "fx.glow.radial")
          .setDepth(10)
          .setTint(enemyGlowColor(enemy.kind))
          .setScale(enemy.kind === "arcWarden" ? 1.15 : 0.84)
          .setAlpha(0.32)
          .setBlendMode(Phaser.BlendModes.ADD);
        sprite = this.add.image(enemy.x, enemy.y, TEXTURES.enemy(enemy.kind)).setDepth(12);
        this.enemySprites.set(enemy.id, sprite);
        this.enemyGlowSprites.set(enemy.id, glow);
        this.minimap?.ignore(glow);
        this.minimap?.ignore(sprite); // Ignore enemies on minimap to keep it clean
      }

      const activePulse = enemy.state === "pulsing" || enemy.state === "windup" ? 0.12 : 0;
      const glowPulse = Math.sin(this.state.elapsed * 5 + enemy.timer) * 0.04;
      glow?.setPosition(enemy.x, enemy.y);
      glow?.setScale((enemy.kind === "arcWarden" ? 1.18 : 0.86) + activePulse);
      glow?.setAlpha(0.28 + activePulse + glowPulse);
      sprite.setPosition(enemy.x, enemy.y);
      sprite.setRotation(enemy.kind === "prismStalker" ? Math.atan2(enemy.vy, enemy.vx) : enemy.timer);
      sprite.setAlpha(enemy.state === "windup" ? 0.72 : 1);
      sprite.setScale(enemy.state === "pulsing" ? 1.08 : 1);
    }

    for (const [id, sprite] of this.enemySprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.enemyGlowSprites.get(id)?.destroy();
        this.enemySprites.delete(id);
        this.enemyGlowSprites.delete(id);
      }
    }
  }

  private syncPickups(): void {
    const live = new Set<string>();
    for (const pickup of this.state.pickups) {
      live.add(pickup.id);
      let sprite = this.pickupSprites.get(pickup.id);
      let glow = this.pickupGlowSprites.get(pickup.id);
      if (!sprite) {
        glow = this.add.image(pickup.x, pickup.y, "fx.glow.radial")
          .setDepth(9)
          .setTint(oreGlowForPickup(pickup.ore))
          .setScale(0.54)
          .setAlpha(0.32)
          .setBlendMode(Phaser.BlendModes.ADD);
        sprite = this.add.image(pickup.x, pickup.y, TEXTURES.pickup(pickup.ore)).setDepth(11);
        this.pickupSprites.set(pickup.id, sprite);
        this.pickupGlowSprites.set(pickup.id, glow);
        this.minimap?.ignore(glow);
        this.minimap?.ignore(sprite); // Ignore pickups on minimap to keep it clean
      }

      const pickupPulse = pickup.magnetized ? 0.16 : Math.sin(this.state.elapsed * 5 + pickup.age) * 0.03;
      glow?.setPosition(pickup.x, pickup.y);
      glow?.setScale(pickup.magnetized ? 0.78 : 0.56);
      glow?.setAlpha(0.3 + pickupPulse);
      sprite.setPosition(pickup.x, pickup.y);
      sprite.setRotation(pickup.age * 4);
      sprite.setScale(pickup.magnetized ? 1.1 : 0.92);
    }

    for (const [id, sprite] of this.pickupSprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.pickupGlowSprites.get(id)?.destroy();
        this.pickupSprites.delete(id);
        this.pickupGlowSprites.delete(id);
      }
    }
  }

  private syncProjectiles(): void {
    const live = new Set<string>();
    for (const projectile of this.state.projectiles) {
      live.add(projectile.id);
      let sprites = this.projectileSprites.get(projectile.id);
      if (!sprites) {
        const glow = this.add.image(projectile.x, projectile.y, "fx.glow.radial")
          .setDepth(13)
          .setTint(projectile.color)
          .setScale(0.44)
          .setAlpha(0.58)
          .setBlendMode(Phaser.BlendModes.ADD);
        const core = this.add.image(projectile.x, projectile.y, TEXTURES.particleAmber)
          .setDepth(16)
          .setTint(projectile.owner === "enemy" ? projectile.color : 0xf0e4cc)
          .setScale(projectile.owner === "enemy" ? 1.35 : 1.15)
          .setBlendMode(Phaser.BlendModes.ADD);
        sprites = { core, glow };
        this.projectileSprites.set(projectile.id, sprites);
        this.minimap?.ignore(glow);
        this.minimap?.ignore(core);
      }

      const angle = Math.atan2(projectile.vy, projectile.vx);
      const life = 1 - projectile.age / projectile.lifetime;
      sprites.core.setPosition(projectile.x, projectile.y);
      sprites.core.setRotation(angle);
      sprites.core.setScale(projectile.owner === "enemy" ? 0.9 + life * 0.42 : 1.05 + life * 0.28, projectile.owner === "enemy" ? 0.9 + life * 0.42 : 0.72);
      sprites.core.setAlpha(0.72 + life * 0.28);
      sprites.glow.setPosition(projectile.x, projectile.y);
      sprites.glow.setScale(projectile.owner === "enemy" ? 0.55 + life * 0.42 : 0.34 + life * 0.32);
      sprites.glow.setAlpha(projectile.owner === "enemy" ? 0.28 + life * 0.5 : 0.18 + life * 0.42);
    }

    for (const [id, sprites] of this.projectileSprites) {
      if (!live.has(id)) {
        sprites.core.destroy();
        sprites.glow.destroy();
        this.projectileSprites.delete(id);
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
    this.drawObjectiveTargets();
    this.drawEnemyFields();
    this.drawHazards();
  }

  private drawObjectiveTargets(): void {
    this.objectiveGraphics.clear();
    const focusedOre = this.state.mission.focusedOre;
    if (!focusedOre || this.state.objectiveTargets.length === 0) {
      return;
    }

    const pulse = 0.45 + Math.sin(this.state.elapsed * 5.8) * 0.18;
    const lineAlpha = Phaser.Math.Clamp(pulse, 0.18, 0.68);
    for (const target of this.state.objectiveTargets) {
      const centerX = target.tileX * TILE_SIZE + TILE_SIZE / 2;
      const centerY = target.tileY * TILE_SIZE + TILE_SIZE / 2;
      const dx = centerX - this.state.player.x;
      const dy = centerY - this.state.player.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > 720 * 720) {
        continue;
      }

      const color = target.ore === "ferrite"
        ? 0xe8c86a
        : target.ore === "shimmer"
          ? 0x8a6db8
          : target.ore === "voltaic"
            ? 0x5ab8a8
            : 0xc47a8a;
      this.objectiveGraphics.lineStyle(2, color, lineAlpha);
      this.objectiveGraphics.strokeRoundedRect(target.tileX * TILE_SIZE + 2, target.tileY * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4, 4);
      this.objectiveGraphics.fillStyle(color, 0.035 + lineAlpha * 0.035);
      this.objectiveGraphics.fillRoundedRect(target.tileX * TILE_SIZE + 3, target.tileY * TILE_SIZE + 3, TILE_SIZE - 6, TILE_SIZE - 6, 3);
    }
  }

  private drawBeam(): void {
    this.beamGraphics.clear();
    const beam = this.state.beam;
    if (!beam.active) {
      return;
    }

    const color = beam.heat === "high" ? 0xd4845a : 0x5ab8a8;
    const pulse = beam.heat === "high" ? 1 + Math.sin(this.state.elapsed * 34) * 0.16 : 1;
    this.beamGraphics.lineStyle(beam.heat === "high" ? 12 : 8, color, beam.heat === "high" ? 0.24 : 0.18);
    this.beamGraphics.lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    this.beamGraphics.lineStyle(beam.heat === "high" ? 4.5 * pulse : 3, color, 0.95);
    this.beamGraphics.lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    this.beamGraphics.fillStyle(0xffffff, 0.9);
    this.beamGraphics.fillCircle(beam.x2, beam.y2, beam.heat === "high" ? 7 * pulse : 4);
  }

  private drawEnemyFields(): void {
    this.fieldGraphics.clear();
    if (this.state.player.shieldActiveTimer > 0 && this.state.player.shield > 0) {
      const shieldRatio = this.state.player.shield / this.state.player.shieldMax;
      this.fieldGraphics.lineStyle(3, 0x5ab8a8, 0.42 + shieldRatio * 0.28);
      this.fieldGraphics.strokeCircle(this.state.player.x, this.state.player.y, 34 + Math.sin(this.state.elapsed * 12) * 2);
      this.fieldGraphics.fillStyle(0x5ab8a8, 0.035 + shieldRatio * 0.035);
      this.fieldGraphics.fillCircle(this.state.player.x, this.state.player.y, 34);
    }
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
    let edgeRefreshNeeded = false;
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

      edgeRefreshNeeded = true;
    }

    if (edgeRefreshNeeded) {
      this.caveEdgeGraphics?.destroy();
      this.drawCaveEdges();
    }
  }

  private handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === "tile-broken") {
        this.audioFeedback.play("tileBreak");
        this.spawnBurst(event.x, event.y, event.color, 10, 130);
        this.cameras.main.shake(52, 0.0025);
      }

      if (event.type === "pickup-collected") {
        this.audioFeedback.play("pickup");
        this.spawnBurst(event.x, event.y, event.color, 4, 70);
      }

      if (event.type === "task-progress") {
        this.audioFeedback.play("orderTick");
        this.spawnGlowPulse(event.x, event.y, event.color, 0.7, 150);
      }

      if (event.type === "projectile-fired") {
        this.audioFeedback.play("weaponShot", 0.12 + Math.min(0.08, (event.amount ?? 0) * 0.08));
        this.spawnMuzzleFlash(event.x, event.y, event.color);
      }

      if (event.type === "projectile-hit") {
        this.audioFeedback.play("tileHit");
        this.spawnBurst(event.x, event.y, event.color, 4, 58);
        this.cameras.main.shake(32, 0.0014);
      }

      if (event.type === "enemy-hit") {
        this.audioFeedback.play("tileHit");
        this.spawnBurst(event.x, event.y, event.color, 2, 38);
      }

      if (event.type === "enemy-killed") {
        this.audioFeedback.play("enemyKill");
        this.spawnBurst(event.x, event.y, event.color, 16, 180);
        this.cameras.main.shake(92, 0.004);
      }

      if (event.type === "player-hit") {
        this.audioFeedback.play("damage");
        this.spawnBurst(this.state.player.x, this.state.player.y, event.color, 9, 85);
        this.cameras.main.shake(90, 0.006);
      }

      if (event.type === "overheat") {
        this.audioFeedback.play("overheat");
        this.spawnBurst(event.x, event.y, event.color, 12, 95);
        this.cameras.main.shake(80, 0.003);
      }

      if (event.type === "player-dash") {
        this.audioFeedback.play("dash");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.5, 170);
      }

      if (event.type === "blast-charge-spent") {
        this.audioFeedback.play("bombLaunch");
        this.spawnGlowPulse(event.x, event.y, event.color, 0.9, 130);
      }

      if (event.type === "blast-recharged") {
        this.audioFeedback.play("blastReady");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.35, 190);
      }

      if (event.type === "ability-locked") {
        this.audioFeedback.play("craftBlocked");
        this.spawnGlowPulse(event.x, event.y, event.color, 0.55, 120);
      }

      if (event.type === "shield-activated") {
        this.audioFeedback.play("objectiveComplete");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.45, 220);
      }

      if (event.type === "shield-broken") {
        this.audioFeedback.play("damage");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.1, 150);
      }

      if (event.type === "weapon-switched") {
        this.audioFeedback.play("objectiveFocus");
      }

      if (event.type === "swarm-bomb-fired") {
        this.spawnBurst(event.x, event.y, event.color, 8, 92);
        this.spawnGlowPulse(event.x, event.y, event.color, 1.1, 150);
      }

      if (event.type === "swarm-bomb-exploded") {
        this.audioFeedback.play("explosion");
        this.spawnBurst(event.x, event.y, event.color, 18, 190);
        this.spawnGlowPulse(event.x, event.y, event.color, 1.9, 260);
        this.cameras.main.shake(76, 0.0035);
      }

      if (event.type === "boss-breakout") {
        this.audioFeedback.play("bossBreakout");
        this.cameras.main.flash(220, 140, 90, 60, false);
        this.cameras.main.shake(430, 0.01);
      }

      if (event.type === "boss-hit") {
        this.audioFeedback.play("bossHit");
        this.spawnBurst(event.x, event.y, event.color, 3, 58);
      }

      if (event.type === "boss-defeated") {
        this.audioFeedback.play("bossDefeat");
        this.spawnBurst(event.x, event.y, event.color, 44, 360);
        this.showBossDefeatNotice();
        this.cameras.main.flash(320, 232, 216, 180, false);
        this.cameras.main.shake(620, 0.014);
      }

      if (event.type === "mission-started") {
        this.audioFeedback.play("missionStart");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.25, 260);
      }

      if (event.type === "objective-focused") {
        this.audioFeedback.play("objectiveFocus");
      }

      if (event.type === "objective-complete") {
        this.audioFeedback.play("objectiveComplete");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.45, 220);
      }

      if (event.type === "craft-ready" || event.type === "extract-ready") {
        this.audioFeedback.play("objectiveComplete");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.2, 210);
      }

      if (event.type === "store-called") {
        this.audioFeedback.play("objectiveComplete");
        this.pendingStoreResultAt = this.time.now + 720;
        this.isPaused = true;
        this.spawnStoreShuttle(event.x, event.y);
      }

      if (event.type === "enemy-wave-started") {
        this.audioFeedback.play("dangerSwell");
        this.spawnGlowPulse(event.x, event.y, event.color, 1.7, 260);
        this.cameras.main.shake(110, 0.0028);
      }
    }
  }

  private spawnMuzzleFlash(x: number, y: number, color: number): void {
    const flash = this.add.image(x, y, "fx.glow.radial")
      .setDepth(30)
      .setTint(color)
      .setScale(0.42)
      .setAlpha(0.72)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.minimap?.ignore(flash);
    this.tweens.add({
      targets: flash,
      scale: 1.15,
      alpha: 0,
      duration: 95,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
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

  private showBossDefeatNotice(): void {
    const bossName = this.state.boss.kind === "sentinelEye" ? "SENTINEL EYE" : "VOLTRIX CORE";
    const notice = this.add.text(this.scale.width / 2, this.scale.height * 0.22, `${bossName} DEFEATED\nReward ore released`, {
      fontFamily: "system-ui, sans-serif",
      fontSize: "18px",
      fontStyle: "900",
      color: "#f7df9e",
      align: "center",
      stroke: "#120b08",
      strokeThickness: 5
    })
      .setDepth(80)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0);

    this.tweens.add({
      targets: notice,
      alpha: 1,
      y: this.scale.height * 0.2,
      duration: 160,
      ease: "Quad.easeOut",
      yoyo: true,
      hold: 1200,
      onComplete: () => notice.destroy()
    });
  }

  private spawnStoreShuttle(x: number, y: number): void {
    this.storeShuttle?.destroy();
    const startX = x - 260;
    const startY = y - 160;
    const dockX = x - 54;
    const dockY = y - 42;
    const shuttle = this.add.image(startX, startY, TEXTURES.ship)
      .setDepth(32)
      .setScale(0.58)
      .setAlpha(0)
      .setRotation(Math.atan2(dockY - startY, dockX - startX))
      .setTint(0x9fe8d8)
      .setBlendMode(Phaser.BlendModes.ADD);

    this.storeShuttle = shuttle;
    this.minimap?.ignore(shuttle);
    this.spawnGlowPulse(dockX, dockY, 0x5ab8a8, 0.95, 220);

    this.tweens.add({
      targets: shuttle,
      x: dockX,
      y: dockY,
      alpha: 0.96,
      scale: 0.78,
      duration: 520,
      ease: "Cubic.easeOut",
      onComplete: () => {
        this.spawnGlowPulse(dockX, dockY, 0x5ab8a8, 1.45, 240);
        this.tweens.add({
          targets: shuttle,
          alpha: 0,
          scale: 0.52,
          duration: 210,
          ease: "Quad.easeIn",
          onComplete: () => {
            if (this.storeShuttle === shuttle) {
              this.storeShuttle = null;
            }
            shuttle.destroy();
          }
        });
      }
    });
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

type AudioCue =
  | "weaponShot"
  | "tileHit"
  | "tileBreak"
  | "pickup"
  | "orderTick"
  | "missionStart"
  | "objectiveFocus"
  | "objectiveComplete"
  | "craftSuccess"
  | "craftBlocked"
  | "dash"
  | "bombLaunch"
  | "blastReady"
  | "explosion"
  | "overheat"
  | "damage"
  | "enemyKill"
  | "dangerSwell"
  | "bossBreakout"
  | "bossHit"
  | "bossDefeat";

class GameplayAudio {
  private readonly cooldowns = new Map<AudioCue, number>();
  private unlocked = false;
  private nextRumbleAt = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.scene.input.once("pointerdown", () => {
      this.unlocked = true;
      resumeAudioContext(this.scene.sound);
    });
    this.scene.input.keyboard?.once("keydown", () => {
      this.unlocked = true;
      resumeAudioContext(this.scene.sound);
    });
  }

  updateMood(mood: GameState["threat"]["mood"]): void {
    if (!this.unlocked) {
      return;
    }

    const now = this.scene.time.now;
    if (now < this.nextRumbleAt) {
      return;
    }

    const context = this.audioContext();
    if (!context) {
      return;
    }

    if (mood === "breakout") {
      playTone(context, 46, 0.42, 0.048, "sine");
      playNoise(context, 0.34, 0.035, 260);
      this.nextRumbleAt = now + 1150 + Math.random() * 380;
    } else if (mood === "surging") {
      playTone(context, 52, 0.34, 0.034, "sine");
      this.nextRumbleAt = now + 1600 + Math.random() * 620;
    } else if (mood === "waking") {
      playTone(context, 58, 0.25, 0.022, "sine");
      this.nextRumbleAt = now + 2400 + Math.random() * 900;
    } else {
      playTone(context, 42, 0.2, 0.012, "sine");
      this.nextRumbleAt = now + 4300 + Math.random() * 1300;
    }
  }

  play(cue: AudioCue, volume?: number): void {
    if (!this.unlocked) {
      return;
    }

    const now = this.scene.time.now;
    const nextAllowed = this.cooldowns.get(cue) ?? 0;
    if (now < nextAllowed) {
      return;
    }

    const config = audioCueConfig(cue);
    const context = this.audioContext();
    if (context) {
      synthCue(context, cue, volume ?? config.volume);
    }
    this.cooldowns.set(cue, now + config.cooldown);
  }

  private audioContext(): AudioContext | null {
    const sound = this.scene.sound;
    if ("context" in sound && sound.context instanceof AudioContext) {
      return sound.context;
    }
    return null;
  }
}

function audioCueConfig(cue: AudioCue): { volume: number; cooldown: number } {
  const map: Record<AudioCue, { volume: number; cooldown: number }> = {
    weaponShot: { volume: 0.18, cooldown: 44 },
    tileHit: { volume: 0.16, cooldown: 58 },
    tileBreak: { volume: 0.24, cooldown: 72 },
    pickup: { volume: 0.13, cooldown: 42 },
    orderTick: { volume: 0.12, cooldown: 110 },
    missionStart: { volume: 0.22, cooldown: 900 },
    objectiveFocus: { volume: 0.08, cooldown: 280 },
    objectiveComplete: { volume: 0.18, cooldown: 220 },
    craftSuccess: { volume: 0.22, cooldown: 220 },
    craftBlocked: { volume: 0.13, cooldown: 220 },
    dash: { volume: 0.18, cooldown: 120 },
    bombLaunch: { volume: 0.18, cooldown: 105 },
    blastReady: { volume: 0.15, cooldown: 420 },
    explosion: { volume: 0.28, cooldown: 90 },
    overheat: { volume: 0.18, cooldown: 300 },
    damage: { volume: 0.24, cooldown: 190 },
    enemyKill: { volume: 0.2, cooldown: 82 },
    dangerSwell: { volume: 0.2, cooldown: 650 },
    bossBreakout: { volume: 0.34, cooldown: 1200 },
    bossHit: { volume: 0.14, cooldown: 130 },
    bossDefeat: { volume: 0.34, cooldown: 1200 }
  };

  return map[cue];
}

function synthCue(context: AudioContext, cue: AudioCue, baseVolume: number): void {
  const volume = baseVolume * (0.86 + Math.random() * 0.2);
  const pitch = 0.93 + Math.random() * 0.14;
  if (cue === "weaponShot") {
    playTone(context, 96 * pitch, 0.06, volume * 0.46, "triangle");
    playNoise(context, 0.055, volume * 0.28, 840);
  } else if (cue === "tileHit" || cue === "bossHit") {
    playTone(context, (cue === "bossHit" ? 64 : 78) * pitch, 0.08, volume * 0.42, "sine");
    playNoise(context, 0.07, volume * 0.34, cue === "bossHit" ? 520 : 720);
  } else if (cue === "tileBreak") {
    playNoise(context, 0.13, volume * 0.48, 620);
    playTone(context, 360 * pitch, 0.16, volume * 0.18, "triangle", 0.025);
  } else if (cue === "pickup") {
    playTone(context, 420 * pitch, 0.09, volume * 0.34, "triangle");
    playTone(context, 640 * pitch, 0.12, volume * 0.24, "sine", 0.035);
  } else if (cue === "orderTick" || cue === "objectiveFocus") {
    playTone(context, 260 * pitch, 0.08, volume * 0.32, "triangle");
    playTone(context, 380 * pitch, 0.1, volume * 0.16, "sine", 0.04);
  } else if (cue === "objectiveComplete" || cue === "craftSuccess" || cue === "blastReady") {
    playTone(context, 220 * pitch, 0.12, volume * 0.3, "triangle");
    playTone(context, 440 * pitch, 0.16, volume * 0.26, "triangle", 0.05);
    playTone(context, 660 * pitch, 0.18, volume * 0.16, "sine", 0.105);
  } else if (cue === "craftBlocked") {
    playTone(context, 86 * pitch, 0.12, volume * 0.36, "sine");
    playNoise(context, 0.08, volume * 0.14, 340);
  } else if (cue === "dash") {
    playNoise(context, 0.13, volume * 0.36, 1200);
    playTone(context, 116 * pitch, 0.1, volume * 0.2, "triangle");
  } else if (cue === "bombLaunch") {
    playNoise(context, 0.16, volume * 0.36, 980);
    playTone(context, 72 * pitch, 0.16, volume * 0.34, "sine");
  } else if (cue === "explosion" || cue === "enemyKill") {
    playTone(context, (cue === "explosion" ? 52 : 72) * pitch, 0.23, volume * 0.48, "sine");
    playNoise(context, cue === "explosion" ? 0.24 : 0.12, volume * 0.46, cue === "explosion" ? 420 : 680);
  } else if (cue === "overheat") {
    playNoise(context, 0.26, volume * 0.42, 760);
    playTone(context, 92 * pitch, 0.2, volume * 0.18, "triangle");
  } else if (cue === "damage") {
    playTone(context, 48 * pitch, 0.18, volume * 0.56, "sine");
    playNoise(context, 0.09, volume * 0.28, 480);
  } else if (cue === "missionStart") {
    playTone(context, 88 * pitch, 0.2, volume * 0.42, "sine");
    playTone(context, 176 * pitch, 0.22, volume * 0.22, "triangle", 0.07);
    playNoise(context, 0.18, volume * 0.16, 620);
  } else if (cue === "dangerSwell") {
    playSwell(context, 58 * pitch, 104 * pitch, 0.62, volume * 0.4);
    playNoise(context, 0.34, volume * 0.22, 380);
  } else if (cue === "bossBreakout") {
    playSwell(context, 42 * pitch, 88 * pitch, 0.82, volume * 0.54);
    playNoise(context, 0.52, volume * 0.38, 300);
  } else if (cue === "bossDefeat") {
    playTone(context, 44 * pitch, 0.34, volume * 0.54, "sine");
    playNoise(context, 0.34, volume * 0.42, 360);
    playTone(context, 330 * pitch, 0.26, volume * 0.22, "triangle", 0.09);
  }
}

function playTone(
  context: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType,
  delay = 0
): void {
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playSwell(context: AudioContext, from: number, to: number, duration: number, volume: number): void {
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + duration * 0.44);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.025);
}

function playNoise(context: AudioContext, duration: number, volume: number, frequency: number): void {
  const sampleCount = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const output = buffer.getChannelData(0);
  for (let index = 0; index < sampleCount; index += 1) {
    output[index] = (Math.random() * 2 - 1) * (1 - index / sampleCount);
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(frequency, context.currentTime);
  gain.gain.setValueAtTime(Math.max(0.0001, volume), context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start();
}

function resumeAudioContext(soundManager: Phaser.Sound.BaseSoundManager): void {
  if ("context" in soundManager && soundManager.context instanceof AudioContext) {
    void soundManager.context.resume();
  }
}

function oreGlowForTile(block: BlockId): number | null {
  if (block === "ferrite") {
    return 0xc4a86e;
  }
  if (block === "shimmer") {
    return 0x8a6db8;
  }
  if (block === "voltaic") {
    return 0x5ab8a8;
  }
  if (block === "aetherium") {
    return 0xc47a8a;
  }
  return null;
}

function oreGlowForPickup(ore: string): number {
  if (ore === "ferrite") {
    return 0xc4a86e;
  }
  if (ore === "shimmer") {
    return 0x8a6db8;
  }
  if (ore === "voltaic") {
    return 0x5ab8a8;
  }
  return 0xc47a8a;
}

function enemyGlowColor(kind: string): number {
  if (kind === "sparkSac") {
    return 0xd4845a;
  }
  if (kind === "prismStalker") {
    return 0xc47a8a;
  }
  if (kind === "phaseMite") {
    return 0xe8c86a;
  }
  return 0x5ab8a8;
}

function tileVisualVariant(seed: string, tileX: number, tileY: number, block: BlockId, cracked: boolean): number {
  if (block === "empty") {
    return 0;
  }

  const crackSalt = cracked ? 39 : 0;
  return Math.floor(coordNoise(seed, tileX, tileY, 1200 + crackSalt) * TILE_VARIANT_COUNT) % TILE_VARIANT_COUNT;
}
