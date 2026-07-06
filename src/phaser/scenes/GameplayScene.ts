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
  tryEquipShip,
  tryEquipWeapon
} from "../../game/simulation/systems/progression";
import { updateGame } from "../../game/simulation/systems/update";
import { coordNoise } from "../../game/simulation/random";
import { TILE_SIZE, type BlockId, type GameEvent, type GameState, type InputActions, type OreId, type PickupState, type PowerDropId, type ShipId, type UnlockId, type UpgradeState, type WeaponId } from "../../game/simulation/types";
import { getTile, isSolid, worldBounds } from "../../game/simulation/world";
import { getHudController } from "../../ui/hud/HudController";

type KeyMap = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "SPACE" | "SHIFT" | "ESC" | "E" | "F3", Phaser.Input.Keyboard.Key>;
const MINIMAP_SIZE = 110;
const MINIMAP_MARGIN = 20;
const MINIMAP_ZOOM = 0.08;
const MINIMAP_RADIUS = MINIMAP_SIZE / MINIMAP_ZOOM / 2;
const MINIMAP_TILE_RANGE = Math.ceil(MINIMAP_RADIUS / TILE_SIZE) + 2;
const TILE_VARIANT_COUNT = 4;
const PLAYER_SHIP_VISUAL_SCALE = 0.84;
const MINIMAP_INTERVAL_MS = 125;
const MINIMAP_LOW_QUALITY_INTERVAL_MS = 220;
const OBJECTIVE_DRAW_INTERVAL_MS = 140;
const CAVE_EDGE_CHUNK_SIZE = 24;
const VISIBILITY_UPDATE_INTERVAL_MS = 70;
const VISIBILITY_LOW_QUALITY_UPDATE_INTERVAL_MS = 115;
const TERRAIN_CULL_MARGIN = 96;
const TERRAIN_CHUNK_SIZE = 16;
const TERRAIN_TILE_OVERLAP = 1;
const FIXED_QUALITY_LEVEL: 1 = 1;
const ORE_GLOW_POOL_SIZE = 72;
let glowAlphaScale = 0.58;

type FrameProfileKey = "sim" | "tiles" | "actors" | "transient" | "minimap" | "presentation" | "events" | "hud";
type FrameProfile = Record<FrameProfileKey, number>;

interface TerrainChunk {
  chunkX: number;
  chunkY: number;
  startTileX: number;
  startTileY: number;
  endTileX: number;
  endTileY: number;
  view: Phaser.GameObjects.RenderTexture;
}

interface OreGlowCandidate {
  x: number;
  y: number;
  color: number;
  alpha: number;
  scale: number;
  distanceSq: number;
  priority: number;
}

function glowAlpha(alpha: number): number {
  return Phaser.Math.Clamp(alpha * glowAlphaScale, 0, 1);
}

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
  private caveEdgeChunks = new Map<string, Phaser.GameObjects.Graphics>();
  private caveEdgeAlpha = 0.78;
  private terrainChunks: TerrainChunk[] = [];
  private oreGlowPool: Phaser.GameObjects.Image[] = [];
  private oreGlowCandidates: OreGlowCandidate[] = [];
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private enemyGlowSprites = new Map<string, Phaser.GameObjects.Image>();
  private enemyEliteRings = new Map<string, Phaser.GameObjects.Arc>();
  private enemyEliteMarkers = new Map<string, Phaser.GameObjects.Triangle>();
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
  private visibleCaveEdgeChunkKeys = new Set<string>();
  private lastVisibilityCenterTileX = Number.NaN;
  private lastVisibilityCenterTileY = Number.NaN;
  private lastVisibilityDrawAt = 0;
  private lastMinimapTileX = Number.NaN;
  private lastMinimapTileY = Number.NaN;
  private lastMinimapDrawAt = 0;
  private lastObjectiveSignature = "";
  private lastObjectiveDrawAt = 0;
  private fpsOverlay: HTMLDivElement | null = null;
  private fpsVisible = false;
  private fpsFrameCount = 0;
  private fpsSampleMs = 0;
  private fpsLastValue = 0;
  private frameMsLastValue = 0;
  private lowFpsSamples = 0;
  private highFpsSamples = 0;
  private qualityLevel: 0 | 1 | 2 = FIXED_QUALITY_LEVEL;
  private renderStressLevel: 0 | 1 | 2 = 0;
  private frameProfile: FrameProfile = this.createEmptyFrameProfile();
  private profileAccumulator: FrameProfile = this.createEmptyFrameProfile();
  private profileSampleCount = 0;
  private profileSummary = "";

  private backdropRect!: Phaser.GameObjects.Rectangle;
  private starsGraphics!: Phaser.GameObjects.Graphics;
  private cavernGrid!: Phaser.GameObjects.Graphics;
  private parallaxCaveLayers: Phaser.GameObjects.Graphics[] = [];
  private moodOverlay!: Phaser.GameObjects.Rectangle;
  private hullCriticalOverlay!: Phaser.GameObjects.Rectangle;
  private atmosphereOverlay: HTMLDivElement | null = null;
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
    this.lastVisibilityCenterTileX = Number.NaN;
    this.lastVisibilityCenterTileY = Number.NaN;
    this.lastVisibilityDrawAt = 0;
    this.lastMinimapTileX = Number.NaN;
    this.lastMinimapTileY = Number.NaN;
    this.lastMinimapDrawAt = 0;
    this.lastObjectiveSignature = "";
    this.lastObjectiveDrawAt = 0;
    this.fpsVisible = false;
    this.fpsFrameCount = 0;
    this.fpsSampleMs = 0;
    this.fpsLastValue = 0;
    this.frameMsLastValue = 0;
    this.lowFpsSamples = 0;
    this.highFpsSamples = 0;
    this.qualityLevel = FIXED_QUALITY_LEVEL;
    this.renderStressLevel = 0;
    this.applyAdaptiveQuality();

    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,ESC,E,F3") as KeyMap;

    this.createWorldView();
    this.createActors();
    this.createAtmosphereOverlay();
    this.audioFeedback = new GameplayAudio(this);
    this.configureCamera();
    this.configureHud();
  }

  private resetViewCaches(): void {
    this.terrainChunks.forEach((chunk) => chunk.view.destroy());
    this.terrainChunks = [];
    this.oreGlowPool.forEach((glow) => glow.destroy());
    this.oreGlowPool = [];
    this.oreGlowCandidates = [];
    this.visibleCaveEdgeChunkKeys.clear();
    this.caveEdgeChunks.forEach((chunk) => chunk.destroy());
    this.caveEdgeChunks.clear();
    this.enemySprites.clear();
    this.enemyGlowSprites.clear();
    this.enemyEliteRings.clear();
    this.enemyEliteMarkers.clear();
    this.pickupSprites.clear();
    this.pickupGlowSprites.clear();
    this.projectileSprites.clear();
    this.bombSprites.clear();
    this.bossHead = null;
    this.bossSegments = [];
    this.parallaxCaveLayers = [];
    this.atmosphereOverlay?.remove();
    this.atmosphereOverlay = null;
    this.fpsOverlay?.remove();
    this.fpsOverlay = null;
  }

  update(_time: number, deltaMs: number): void {
    const hud = getHudController();
    this.updatePerformanceMonitor(deltaMs);
    this.frameProfile = this.createEmptyFrameProfile();
    if (Phaser.Input.Keyboard.JustDown(this.keys.F3)) {
      this.toggleFpsOverlay();
    }
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
    this.profile("sim", () => updateGame(this.state, actions, dt));

    this.profile("tiles", () => this.syncTilesFromEvents(this.state.events));
    this.profile("actors", () => this.syncActors());
    this.profile("transient", () => this.drawTransientWorld());
    this.profile("minimap", () => this.maybeDrawMinimap());
    this.profile("presentation", () => this.updateMoodPresentation());
    this.audioFeedback.updateMood(this.state.threat.mood);
    this.audioFeedback.updateHull(this.state.player.hull / this.state.player.maxHull);
    this.profile("events", () => this.handleEvents(this.state.events));
    this.profile("hud", () => hud.update(this.state, this.progress));
    this.updateProfileSummary();

    this.maybeShowRunResult(hud);
  }

  private createEmptyFrameProfile(): FrameProfile {
    return {
      sim: 0,
      tiles: 0,
      actors: 0,
      transient: 0,
      minimap: 0,
      presentation: 0,
      events: 0,
      hud: 0
    };
  }

  private profile(key: FrameProfileKey, work: () => void): void {
    const start = performance.now();
    work();
    this.frameProfile[key] += performance.now() - start;
  }

  private updateProfileSummary(): void {
    this.profileSampleCount += 1;
    for (const key of Object.keys(this.frameProfile) as FrameProfileKey[]) {
      this.profileAccumulator[key] += this.frameProfile[key];
    }

    if (this.profileSampleCount < 45) {
      return;
    }

    const averages = (Object.keys(this.profileAccumulator) as FrameProfileKey[])
      .map((key) => ({
        key,
        value: this.profileAccumulator[key] / this.profileSampleCount
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 2);
    this.profileSummary = averages.map((entry) => `${entry.key[0]}${entry.value.toFixed(1)}`).join(" ");
    this.profileAccumulator = this.createEmptyFrameProfile();
    this.profileSampleCount = 0;
  }

  private updatePerformanceMonitor(deltaMs: number): void {
    this.fpsFrameCount += 1;
    this.fpsSampleMs += deltaMs;
    if (this.fpsSampleMs < 1000) {
      return;
    }

    const fps = (this.fpsFrameCount * 1000) / this.fpsSampleMs;
    this.fpsLastValue = fps;
    this.frameMsLastValue = this.fpsSampleMs / Math.max(1, this.fpsFrameCount);
    this.fpsFrameCount = 0;
    this.fpsSampleMs = 0;

    if (this.frameMsLastValue > 27) {
      this.lowFpsSamples += 1;
      this.highFpsSamples = 0;
    } else if (this.frameMsLastValue < 18.5) {
      this.highFpsSamples += 1;
      this.lowFpsSamples = 0;
    } else {
      this.lowFpsSamples = 0;
      this.highFpsSamples = 0;
    }

    if (this.lowFpsSamples >= 2 && this.renderStressLevel < 2) {
      this.renderStressLevel = this.renderStressLevel === 0 ? 1 : 2;
      this.lowFpsSamples = 0;
    } else if (this.highFpsSamples >= 5 && this.renderStressLevel > 0) {
      this.renderStressLevel = this.renderStressLevel === 2 ? 1 : 0;
      this.highFpsSamples = 0;
    }

    this.updateFpsOverlayText();
  }

  private applyAdaptiveQuality(): void {
    glowAlphaScale = 0.58;
  }

  private toggleFpsOverlay(): void {
    this.fpsVisible = !this.fpsVisible;
    this.fpsOverlay?.classList.toggle("is-hidden", !this.fpsVisible);
    this.updateFpsOverlayText();
  }

  private updateFpsOverlayText(): void {
    if (!this.fpsOverlay || !this.fpsVisible) {
      return;
    }

    const quality = this.qualityLevel === 0 ? "Q0" : this.qualityLevel === 1 ? "Q1" : "Q2";
    const profile = this.profileSummary ? ` / ${this.profileSummary}` : "";
    this.fpsOverlay.textContent = `${Math.round(this.fpsLastValue)} FPS / ${this.frameMsLastValue.toFixed(1)} MS / ${quality}${profile}`;
  }

  private maybeDrawMinimap(): void {
    const playerTileX = Math.floor(this.state.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.state.player.y / TILE_SIZE);
    const interval = this.renderStressLevel > 0 ? MINIMAP_LOW_QUALITY_INTERVAL_MS + this.renderStressLevel * 120 : MINIMAP_INTERVAL_MS;
    const tileChanged = playerTileX !== this.lastMinimapTileX || playerTileY !== this.lastMinimapTileY;
    if (!tileChanged && this.time.now - this.lastMinimapDrawAt < interval) {
      return;
    }

    this.lastMinimapTileX = playerTileX;
    this.lastMinimapTileY = playerTileY;
    this.lastMinimapDrawAt = this.time.now;
    this.drawMinimap();
  }

  private qualityParticleCount(count: number): number {
    if (this.renderStressLevel === 2) {
      return Math.max(1, Math.ceil(count * 0.45));
    }
    if (this.renderStressLevel === 1 || this.qualityLevel === 1) {
      return Math.max(1, Math.ceil(count * 0.68));
    }
    return count;
  }

  private trailIntervalMs(): number {
    return this.renderStressLevel === 2 ? 90 : this.renderStressLevel === 1 ? 64 : 42;
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

    if (this.state.threat.directionAngle !== null && this.state.threat.value >= this.state.threat.max * 0.5) {
      const threatRatio = Phaser.Math.Clamp(this.state.threat.value / this.state.threat.max, 0, 1);
      const pulse = 0.5 + Math.sin(this.state.elapsed * 6.5) * 0.5;
      const color = threatRatio > 0.82 ? 0xc45a4a : 0xd4845a;
      const lineLength = MINIMAP_RADIUS * (0.54 + threatRatio * 0.34);
      this.minimapGraphics.lineStyle(16, color, 0.16 + pulse * 0.2 + threatRatio * 0.16);
      this.minimapGraphics.lineBetween(
        player.x,
        player.y,
        player.x + Math.cos(this.state.threat.directionAngle) * lineLength,
        player.y + Math.sin(this.state.threat.directionAngle) * lineLength
      );
      this.minimapGraphics.lineStyle(4, 0xf0d38a, 0.28 + pulse * 0.26);
      this.minimapGraphics.lineBetween(
        player.x,
        player.y,
        player.x + Math.cos(this.state.threat.directionAngle) * lineLength,
        player.y + Math.sin(this.state.threat.directionAngle) * lineLength
      );
    }

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
    this.backdropRect = this.add.rectangle(0, 0, 1, 1, 0x111826, 1)
      .setDepth(-8)
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.fitScreenOverlay(this.backdropRect, Math.max(this.scale.width, window.innerWidth), Math.max(this.scale.height, window.innerHeight));
    this.drawParallaxSpaceCave(bounds);
    this.drawCavernAtmosphere();
    this.createTerrainChunks();
    this.createOreGlowPool();
    this.drawCaveEdges();
  }

  private createTerrainChunks(): void {
    this.terrainChunks = [];
    const chunkColumns = Math.ceil(this.state.world.width / TERRAIN_CHUNK_SIZE);
    const chunkRows = Math.ceil(this.state.world.height / TERRAIN_CHUNK_SIZE);

    for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
      for (let chunkX = 0; chunkX < chunkColumns; chunkX += 1) {
        const startTileX = chunkX * TERRAIN_CHUNK_SIZE;
        const startTileY = chunkY * TERRAIN_CHUNK_SIZE;
        const endTileX = Math.min(this.state.world.width, startTileX + TERRAIN_CHUNK_SIZE);
        const endTileY = Math.min(this.state.world.height, startTileY + TERRAIN_CHUNK_SIZE);
        const width = (endTileX - startTileX) * TILE_SIZE;
        const height = (endTileY - startTileY) * TILE_SIZE;
        const view = this.add.renderTexture(startTileX * TILE_SIZE, startTileY * TILE_SIZE, width, height)
          .setDepth(2)
          .setOrigin(0, 0)
          .setVisible(false)
          .setAlpha(0);

        const chunk = {
          chunkX,
          chunkY,
          startTileX,
          startTileY,
          endTileX,
          endTileY,
          view
        };
        this.terrainChunks.push(chunk);
        this.redrawTerrainChunk(chunk);
      }
    }
  }

  private redrawTerrainChunk(chunk: TerrainChunk): void {
    chunk.view.clear();
    for (let tileY = chunk.startTileY; tileY < chunk.endTileY; tileY += 1) {
      for (let tileX = chunk.startTileX; tileX < chunk.endTileX; tileX += 1) {
        const tile = this.state.world.tiles[tileY * this.state.world.width + tileX];
        if (!isSolid(tile)) {
          continue;
        }
        const texture = TEXTURES.tile(tile.type, this.state.world.territory, tile.cracked, tileVisualVariant(this.state.world.seed, tile.x, tile.y, tile.type, tile.cracked));
        const scale = tile.type === "basalt" || tile.type === "ancient" ? 1 + TERRAIN_TILE_OVERLAP / TILE_SIZE : 1;
        chunk.view.stamp(
          texture,
          undefined,
          (tileX - chunk.startTileX) * TILE_SIZE + TILE_SIZE / 2,
          (tileY - chunk.startTileY) * TILE_SIZE + TILE_SIZE / 2,
          {
            alpha: 1,
            originX: 0.5,
            originY: 0.5,
            scale,
            tint: 0xffffff
          }
        );
      }
    }
  }

  private terrainChunkAt(tileX: number, tileY: number): TerrainChunk | undefined {
    const chunkX = Math.floor(tileX / TERRAIN_CHUNK_SIZE);
    const chunkY = Math.floor(tileY / TERRAIN_CHUNK_SIZE);
    return this.terrainChunks.find((chunk) => chunk.chunkX === chunkX && chunk.chunkY === chunkY);
  }

  private createOreGlowPool(): void {
    this.oreGlowPool = [];
    for (let index = 0; index < ORE_GLOW_POOL_SIZE; index += 1) {
      const glow = this.add.image(0, 0, "fx.glow.radial")
        .setDepth(3)
        .setOrigin(0.5)
        .setScale(0.92)
        .setAlpha(0)
        .setVisible(false)
        .setBlendMode(Phaser.BlendModes.ADD);
      this.oreGlowPool.push(glow);
    }
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
    this.caveEdgeChunks.forEach((chunk) => chunk.destroy());
    this.caveEdgeChunks.clear();
    this.caveEdgeGraphics = this.add.graphics().setDepth(4).setVisible(false);
    this.minimap?.ignore(this.caveEdgeGraphics);

    const chunkColumns = Math.ceil(this.state.world.width / CAVE_EDGE_CHUNK_SIZE);
    const chunkRows = Math.ceil(this.state.world.height / CAVE_EDGE_CHUNK_SIZE);
    for (let chunkY = 0; chunkY < chunkRows; chunkY += 1) {
      for (let chunkX = 0; chunkX < chunkColumns; chunkX += 1) {
        this.redrawCaveEdgeChunk(chunkX, chunkY);
      }
    }
  }

  private redrawCaveEdgeChunk(chunkX: number, chunkY: number): void {
    if (chunkX < 0 || chunkY < 0) {
      return;
    }

    const startX = chunkX * CAVE_EDGE_CHUNK_SIZE;
    const startY = chunkY * CAVE_EDGE_CHUNK_SIZE;
    if (startX >= this.state.world.width || startY >= this.state.world.height) {
      return;
    }

    const key = `${chunkX},${chunkY}`;
    let graphics = this.caveEdgeChunks.get(key);
    if (!graphics) {
      graphics = this.add.graphics().setDepth(4).setAlpha(this.caveEdgeAlpha).setVisible(false);
      this.caveEdgeChunks.set(key, graphics);
      this.minimap?.ignore(graphics);
    }

    graphics.clear();
    graphics.lineStyle(2, 0x7f88a8, 0.34);

    const endX = Math.min(this.state.world.width, startX + CAVE_EDGE_CHUNK_SIZE);
    const endY = Math.min(this.state.world.height, startY + CAVE_EDGE_CHUNK_SIZE);
    for (let tileY = startY; tileY < endY; tileY += 1) {
      for (let tileX = startX; tileX < endX; tileX += 1) {
        const tile = getTile(this.state.world, tileX, tileY);
        if (!isSolid(tile)) {
          continue;
        }

        const left = tile.x * TILE_SIZE;
        const top = tile.y * TILE_SIZE;
        const right = left + TILE_SIZE;
        const bottom = top + TILE_SIZE;

        if (!isSolid(getTile(this.state.world, tile.x - 1, tile.y))) {
          graphics.lineBetween(left, top, left, bottom);
        }
        if (!isSolid(getTile(this.state.world, tile.x + 1, tile.y))) {
          graphics.lineBetween(right, top, right, bottom);
        }
        if (!isSolid(getTile(this.state.world, tile.x, tile.y - 1))) {
          graphics.lineBetween(left, top, right, top);
        }
        if (!isSolid(getTile(this.state.world, tile.x, tile.y + 1))) {
          graphics.lineBetween(left, bottom, right, bottom);
        }
      }
    }
  }

  private refreshCaveEdgesNearTile(tileX: number, tileY: number): void {
    const chunks = new Set<string>();
    for (let y = tileY - 1; y <= tileY + 1; y += 1) {
      for (let x = tileX - 1; x <= tileX + 1; x += 1) {
        chunks.add(`${Math.floor(x / CAVE_EDGE_CHUNK_SIZE)},${Math.floor(y / CAVE_EDGE_CHUNK_SIZE)}`);
      }
    }

    chunks.forEach((key) => {
      const [chunkX, chunkY] = key.split(",").map(Number);
      this.redrawCaveEdgeChunk(chunkX, chunkY);
    });
  }

  private createActors(): void {
    this.beamGraphics = this.add.graphics().setDepth(8);
    this.fieldGraphics = this.add.graphics().setDepth(4);
    this.hazardGraphics = this.add.graphics().setDepth(9);
    this.objectiveGraphics = this.add.graphics().setDepth(7).setBlendMode(Phaser.BlendModes.ADD);
    this.moodOverlay = this.add.rectangle(0, 0, 1, 1, 0x000000, 0)
      .setDepth(6)
      .setOrigin(0.5)
      .setScrollFactor(0);
    this.hullCriticalOverlay = this.add.rectangle(0, 0, 1, 1, 0xc45a4a, 0)
      .setDepth(19)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.fitScreenOverlay(this.moodOverlay, this.scale.width, this.scale.height);
    this.fitScreenOverlay(this.hullCriticalOverlay, this.scale.width, this.scale.height);
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
      .setAlpha(glowAlpha(0.34))
      .setTint(0xc4a86e)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.reticle = this.add.image(this.state.player.x, this.state.player.y, TEXTURES.reticle).setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
    this.ship = this.add.image(this.state.player.x, this.state.player.y, TEXTURES.ship(this.progress.equippedShip)).setDepth(14);

    // Local navigation graphics are rendered only by the minimap camera.
    this.minimapGraphics = this.add.graphics().setDepth(21);
    this.cameras.main.ignore(this.minimapGraphics);
  }

  private configureCamera(): void {
    const bounds = worldBounds(this.state.world);
    
    // Main camera follow configuration
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.setBackgroundColor(0x111826);
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
    if (this.hullCriticalOverlay) this.minimap.ignore(this.hullCriticalOverlay);
    if (this.visibilityVignette) this.minimap.ignore(this.visibilityVignette);
    if (this.extractionGlow) this.minimap.ignore(this.extractionGlow);
    if (this.playerLight) this.minimap.ignore(this.playerLight);
    this.oreGlowPool.forEach((glow) => this.minimap.ignore(glow));
    if (this.reticle) this.minimap.ignore(this.reticle);
    if (this.ship) this.minimap.ignore(this.ship);
    this.terrainChunks.forEach((chunk) => this.minimap.ignore(chunk.view));
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
      equipShip: (id: ShipId) => {
        const hullRatio = this.state.player.maxHull > 0 ? this.state.player.hull / this.state.player.maxHull : 1;
        this.progress = tryEquipShip(this.progress, id);
        this.state.upgrades = this.progress;
        this.state.stats = effectiveStats(this.progress);
        this.state.player.maxHull = this.state.stats.maxHull;
        this.state.player.hull = Math.max(1, Math.min(this.state.player.maxHull, this.state.player.maxHull * hullRatio));
        this.ship.setTexture(TEXTURES.ship(this.progress.equippedShip));
        this.state.events.push({ type: "weapon-switched", x: this.state.player.x, y: this.state.player.y, color: 0x5ab8a8 });
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

  private createAtmosphereOverlay(): void {
    this.atmosphereOverlay?.remove();
    this.fpsOverlay?.remove();
    const app = document.querySelector<HTMLElement>("#app");
    if (!app) {
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "game-atmosphere-overlay";
    app.appendChild(overlay);
    this.atmosphereOverlay = overlay;

    const fps = document.createElement("div");
    fps.className = "game-fps-overlay is-hidden";
    fps.textContent = "0 FPS / 0.0 MS / Q0";
    app.appendChild(fps);
    this.fpsOverlay = fps;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      overlay.remove();
      if (this.atmosphereOverlay === overlay) {
        this.atmosphereOverlay = null;
      }
      fps.remove();
      if (this.fpsOverlay === fps) {
        this.fpsOverlay = null;
      }
    });
  }

  private fitVisibilityVignette(width: number, height: number): void {
    if (!this.visibilityVignette) {
      return;
    }

    const zoom = this.cameras.main.zoom || 1;
    this.visibilityVignette.setPosition(width / (2 * zoom), height / (2 * zoom));
    const cover = Math.hypot(width, height) * 1.32;
    this.visibilityVignette.setDisplaySize(cover / zoom, cover / zoom);
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
    this.fitScreenOverlay(this.backdropRect, width, height);
    this.fitScreenOverlay(this.moodOverlay, width, height);
    this.fitScreenOverlay(this.hullCriticalOverlay, width, height);
    this.fitVisibilityVignette(width, height);
    this.minimap?.setPosition(width - MINIMAP_SIZE - MINIMAP_MARGIN, height - MINIMAP_SIZE - MINIMAP_MARGIN);
  }

  private fitScreenOverlay(overlay: Phaser.GameObjects.Rectangle | undefined, width: number, height: number): void {
    if (!overlay) {
      return;
    }

    const zoom = this.cameras.main.zoom || 1;
    const bleed = 160 / zoom;
    overlay.setPosition(width / (2 * zoom), height / (2 * zoom));
    overlay.setSize(width / zoom + bleed * 2, height / zoom + bleed * 2);
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
    this.ship.setScale(PLAYER_SHIP_VISUAL_SCALE * (player.collectionPulse > 0 ? 1.08 : 1));
    this.ship.setAlpha(player.invulnerableTimer > 0 ? 0.72 : 1);
    this.playerLight.setPosition(player.x, player.y);
    const speed = Math.hypot(player.vx, player.vy);
    const movementGlow = Phaser.Math.Clamp(speed / 520, 0, 0.22);
    const lightPulse = Math.sin(this.state.elapsed * 3.2) * 0.025;
    this.playerLight.setScale((player.invulnerableTimer > 0 ? 4.8 : 4.1) + movementGlow);
    this.playerLight.setAlpha(glowAlpha((player.invulnerableTimer > 0 ? 0.46 : 0.34) + movementGlow * 0.36 + lightPulse));
    const aim = this.currentAimWorldPoint();
    this.reticle.setPosition(aim.x, aim.y);
    this.extractionGlow.setAlpha(0);

    if (speed > 35 && this.time.now - this.lastTrailTime > this.trailIntervalMs()) {
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
    const centerTileX = Math.floor(player.x / TILE_SIZE);
    const centerTileY = Math.floor(player.y / TILE_SIZE);
    const interval = this.renderStressLevel > 0
      ? VISIBILITY_LOW_QUALITY_UPDATE_INTERVAL_MS + this.renderStressLevel * 45
      : VISIBILITY_UPDATE_INTERVAL_MS;
    const tileChanged = centerTileX !== this.lastVisibilityCenterTileX || centerTileY !== this.lastVisibilityCenterTileY;
    if (!tileChanged && this.time.now - this.lastVisibilityDrawAt < interval) {
      this.updateDynamicObjectVisibility();
      return;
    }

    this.lastVisibilityDrawAt = this.time.now;
    const worldView = this.cameras.main.worldView;
    const minTileX = Math.max(0, Math.floor((worldView.x - TERRAIN_CULL_MARGIN) / TILE_SIZE));
    const maxTileX = Math.min(this.state.world.width - 1, Math.ceil((worldView.right + TERRAIN_CULL_MARGIN) / TILE_SIZE));
    const minTileY = Math.max(0, Math.floor((worldView.y - TERRAIN_CULL_MARGIN) / TILE_SIZE));
    const maxTileY = Math.min(this.state.world.height - 1, Math.ceil((worldView.bottom + TERRAIN_CULL_MARGIN) / TILE_SIZE));
    const visibleChunkKeys = this.visibleCaveEdgeChunkKeys;
    visibleChunkKeys.clear();
    const glowCandidates = this.oreGlowCandidates;
    glowCandidates.length = 0;
    const focusedOre = this.state.mission.focusedOre;

    const alphaFor = (x: number, y: number, minAlpha: number, maxAlpha: number) => {
      const dist = Math.hypot(x - player.x, y - player.y);
      const t = Phaser.Math.Clamp((dist - inner) / (outer - inner), 0, 1);
      return Phaser.Math.Linear(maxAlpha, minAlpha, t);
    };

    for (const chunk of this.terrainChunks) {
      const chunkLeft = chunk.startTileX * TILE_SIZE;
      const chunkTop = chunk.startTileY * TILE_SIZE;
      const chunkRight = chunk.endTileX * TILE_SIZE;
      const chunkBottom = chunk.endTileY * TILE_SIZE;
      const visible = chunkRight >= worldView.x - TERRAIN_CULL_MARGIN
        && chunkLeft <= worldView.right + TERRAIN_CULL_MARGIN
        && chunkBottom >= worldView.y - TERRAIN_CULL_MARGIN
        && chunkTop <= worldView.bottom + TERRAIN_CULL_MARGIN;
      chunk.view.setVisible(visible);
      if (visible) {
        chunk.view.setAlpha(1);
      }
    }

    for (let y = minTileY; y <= maxTileY; y += 1) {
      for (let x = minTileX; x <= maxTileX; x += 1) {
        const index = y * this.state.world.width + x;
        const tile = this.state.world.tiles[index];
        if (!isSolid(tile)) {
          continue;
        }
        visibleChunkKeys.add(`${Math.floor(x / CAVE_EDGE_CHUNK_SIZE)},${Math.floor(y / CAVE_EDGE_CHUNK_SIZE)}`);

        const glowColor = oreGlowForTile(tile.type);
        if (glowColor !== null) {
          const tileCenterX = tile.x * TILE_SIZE + TILE_SIZE / 2;
          const tileCenterY = tile.y * TILE_SIZE + TILE_SIZE / 2;
          const dx = tileCenterX - player.x;
          const dy = tileCenterY - player.y;
          const distanceSq = dx * dx + dy * dy;
          const distanceAlpha = alphaFor(tileCenterX, tileCenterY, 0, tile.type === focusedOre ? 0.30 : 0.22);
          if (distanceAlpha > 0.035) {
            glowCandidates.push({
              x: tileCenterX,
              y: tileCenterY,
              color: glowColor,
              alpha: distanceAlpha,
              scale: tile.type === "aetherium" ? 0.95 : tile.type === focusedOre ? 0.82 : 0.68,
              distanceSq,
              priority: tile.type === focusedOre ? 1 : 0
            });
          }
        }
      }
    }

    glowCandidates.sort((a, b) => b.priority - a.priority || a.distanceSq - b.distanceSq);
    const visibleGlowCount = Math.min(this.oreGlowPool.length, glowCandidates.length);
    for (let index = 0; index < visibleGlowCount; index += 1) {
      const candidate = glowCandidates[index];
      const glow = this.oreGlowPool[index];
      glow.setVisible(true);
      glow.setPosition(Math.round(candidate.x), Math.round(candidate.y));
      glow.setTint(candidate.color);
      glow.setScale(candidate.scale);
      glow.setAlpha(glowAlpha(candidate.alpha));
    }

    for (let index = visibleGlowCount; index < this.oreGlowPool.length; index += 1) {
      this.oreGlowPool[index].setVisible(false);
      this.oreGlowPool[index].setAlpha(0);
    }

    this.lastVisibilityCenterTileX = centerTileX;
    this.lastVisibilityCenterTileY = centerTileY;
    this.updateCaveEdgeChunkVisibility(visibleChunkKeys);

    this.updateDynamicObjectVisibility();
  }

  private updateCaveEdgeChunkVisibility(visibleChunkKeys: Set<string>): void {
    this.caveEdgeChunks.forEach((chunk, key) => {
      chunk.setVisible(visibleChunkKeys.has(key));
      chunk.setAlpha(this.caveEdgeAlpha);
    });
  }

  private updateDynamicObjectVisibility(): void {
    const player = this.state.player;
    const inner = 230;
    const outer = 760;
    const alphaFor = (x: number, y: number, minAlpha: number, maxAlpha: number) => {
      const dist = Math.hypot(x - player.x, y - player.y);
      const t = Phaser.Math.Clamp((dist - inner) / (outer - inner), 0, 1);
      return Phaser.Math.Linear(maxAlpha, minAlpha, t);
    };

    this.enemySprites.forEach((sprite) => sprite.setAlpha(alphaFor(sprite.x, sprite.y, 0.18, 1)));
    this.enemyGlowSprites.forEach((sprite) => sprite.setAlpha(glowAlpha(alphaFor(sprite.x, sprite.y, 0.04, 0.42))));
    this.pickupSprites.forEach((sprite) => sprite.setAlpha(alphaFor(sprite.x, sprite.y, 0.2, 1)));
    this.pickupGlowSprites.forEach((sprite) => sprite.setAlpha(glowAlpha(alphaFor(sprite.x, sprite.y, 0.04, 0.52))));
    this.caveEdgeAlpha = alphaFor(player.x, player.y, 0.48, 0.78);
  }

  private updateMoodPresentation(): void {
    if (!this.moodOverlay) {
      return;
    }

    const swell = this.state.threat.dangerSwellTimer > 0 ? this.state.threat.dangerSwellTimer / 3 : 0;
    let cssTint = "rgba(0, 0, 0, 0)";
    if (this.state.threat.mood === "breakout") {
      this.moodOverlay.setFillStyle(0x4a1630, 0.14 + Math.sin(this.state.elapsed * 9) * 0.035 + swell * 0.08);
      cssTint = `rgba(74, 22, 48, ${0.14 + Math.sin(this.state.elapsed * 9) * 0.035 + swell * 0.08})`;
    } else if (this.state.threat.mood === "surging") {
      this.moodOverlay.setFillStyle(0x32150a, 0.09 + Math.sin(this.state.elapsed * 5) * 0.025 + swell * 0.08);
      cssTint = `rgba(50, 21, 10, ${0.09 + Math.sin(this.state.elapsed * 5) * 0.025 + swell * 0.08})`;
    } else if (this.state.threat.mood === "waking") {
      this.moodOverlay.setFillStyle(0x1a1228, 0.055 + Math.sin(this.state.elapsed * 3) * 0.014 + swell * 0.04);
      cssTint = `rgba(26, 18, 40, ${0.055 + Math.sin(this.state.elapsed * 3) * 0.014 + swell * 0.04})`;
    } else {
      this.moodOverlay.setFillStyle(0x000000, swell * 0.04);
      cssTint = `rgba(0, 0, 0, ${swell * 0.04})`;
    }
    this.moodOverlay.setAlpha(0);
    if (this.atmosphereOverlay) {
      this.atmosphereOverlay.style.background = cssTint;
    }

    const hullRatio = this.state.player.hull / this.state.player.maxHull;
    if (this.hullCriticalOverlay && hullRatio < 0.35) {
      const danger = Phaser.Math.Clamp((0.35 - hullRatio) / 0.35, 0, 1);
      const pulseRate = hullRatio < 0.25 ? 12 : 7;
      const pulse = 0.5 + Math.sin(this.state.elapsed * pulseRate) * 0.5;
      this.hullCriticalOverlay.setFillStyle(0xc45a4a, 0.035 + danger * 0.14 + pulse * danger * 0.045);
    } else {
      this.hullCriticalOverlay?.setFillStyle(0xc45a4a, 0);
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
      .setAlpha(glowAlpha(0.92))
      .setBlendMode(Phaser.BlendModes.ADD);

    trail.lineStyle(7, 0xe8c86a, glowAlpha(0.2));
    trail.beginPath();
    trail.moveTo(noseX, noseY);
    trail.lineTo(tailX, tailY);
    trail.strokePath();
    trail.lineStyle(3, 0xfff5d7, glowAlpha(0.72));
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
      let eliteRing = this.enemyEliteRings.get(enemy.id);
      let eliteMarker = this.enemyEliteMarkers.get(enemy.id);
      if (!sprite) {
        glow = this.add.image(enemy.x, enemy.y, "fx.glow.radial")
          .setDepth(10)
          .setTint(enemyGlowColor(enemy.kind))
          .setScale(enemy.kind === "arcWarden" ? 1.15 : 0.84)
          .setAlpha(glowAlpha(0.32))
          .setBlendMode(Phaser.BlendModes.ADD);
        sprite = this.add.image(enemy.x, enemy.y, TEXTURES.enemy(enemy.kind)).setDepth(12);
        this.enemySprites.set(enemy.id, sprite);
        this.enemyGlowSprites.set(enemy.id, glow);
        this.minimap?.ignore(glow);
        this.minimap?.ignore(sprite); // Ignore enemies on minimap to keep it clean
      }

      if (enemy.elite && !eliteRing) {
        eliteRing = this.add.circle(enemy.x, enemy.y, enemy.radius + 6)
          .setDepth(11)
          .setFillStyle(0x000000, 0)
          .setStrokeStyle(2, 0xf0d38a, 0.58);
        eliteMarker = this.add.triangle(enemy.x, enemy.y - enemy.radius - 13, 0, 10, 7, 0, 14, 10, 0xf0d38a, 0.92)
          .setDepth(13)
          .setOrigin(0.5);
        this.enemyEliteRings.set(enemy.id, eliteRing);
        this.enemyEliteMarkers.set(enemy.id, eliteMarker);
        this.minimap?.ignore(eliteRing);
        this.minimap?.ignore(eliteMarker);
      } else if (!enemy.elite && eliteRing) {
        eliteRing.destroy();
        eliteMarker?.destroy();
        this.enemyEliteRings.delete(enemy.id);
        this.enemyEliteMarkers.delete(enemy.id);
      }

      const activePulse = enemy.state === "pulsing" || enemy.state === "windup" ? 0.12 : 0;
      const glowPulse = Math.sin(this.state.elapsed * 5 + enemy.timer) * 0.04;
      glow?.setPosition(enemy.x, enemy.y);
      glow?.setTint(enemy.elite ? 0xf0d38a : enemyGlowColor(enemy.kind));
      glow?.setScale(((enemy.kind === "arcWarden" ? 1.18 : 0.86) + activePulse) * (enemy.elite ? 1.18 : 1));
      glow?.setAlpha(glowAlpha(0.28 + activePulse + glowPulse + (enemy.elite ? 0.1 : 0)));
      sprite.setPosition(enemy.x, enemy.y);
      sprite.setRotation(enemy.kind === "prismStalker" ? Math.atan2(enemy.vy, enemy.vx) : enemy.timer);
      sprite.setAlpha(enemy.state === "windup" ? 0.72 : 1);
      sprite.setScale((enemy.state === "pulsing" ? 1.08 : 1) * (enemy.elite ? 1.25 : 1));
      if (enemy.elite) {
        sprite.setTint(0xf0d38a);
        eliteRing?.setPosition(enemy.x, enemy.y);
        eliteRing?.setRadius(enemy.radius + 5 + Math.sin(this.state.elapsed * 5) * 1.5);
        eliteRing?.setAlpha(0.44 + Math.sin(this.state.elapsed * 4) * 0.12);
        eliteMarker?.setPosition(enemy.x, enemy.y - enemy.radius - 13);
        eliteMarker?.setRotation(Math.sin(this.state.elapsed * 3) * 0.08);
      } else {
        sprite.clearTint();
      }
    }

    for (const [id, sprite] of this.enemySprites) {
      if (!live.has(id)) {
        sprite.destroy();
        this.enemyGlowSprites.get(id)?.destroy();
        this.enemyEliteRings.get(id)?.destroy();
        this.enemyEliteMarkers.get(id)?.destroy();
        this.enemySprites.delete(id);
        this.enemyGlowSprites.delete(id);
        this.enemyEliteRings.delete(id);
        this.enemyEliteMarkers.delete(id);
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
        const pickupColor = colorForPickup(pickup);
        glow = this.add.image(pickup.x, pickup.y, "fx.glow.radial")
          .setDepth(9)
          .setTint(pickupColor)
          .setScale(0.54)
          .setAlpha(glowAlpha(0.32))
          .setBlendMode(Phaser.BlendModes.ADD);
        sprite = this.add.image(pickup.x, pickup.y, textureForPickup(pickup)).setDepth(11);
        this.pickupSprites.set(pickup.id, sprite);
        this.pickupGlowSprites.set(pickup.id, glow);
        this.minimap?.ignore(glow);
        this.minimap?.ignore(sprite); // Ignore pickups on minimap to keep it clean
      }

      const pickupPulse = pickup.magnetized ? 0.16 : Math.sin(this.state.elapsed * 5 + pickup.age) * 0.03;
      glow?.setPosition(pickup.x, pickup.y);
      glow?.setScale(pickup.magnetized ? 0.78 : 0.56);
      glow?.setAlpha(glowAlpha(0.3 + pickupPulse));
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
          .setAlpha(glowAlpha(0.58))
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
      sprites.glow.setAlpha(glowAlpha(projectile.owner === "enemy" ? 0.28 + life * 0.5 : 0.18 + life * 0.42));
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
          .setAlpha(glowAlpha(0.58))
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
    const focusedOre = this.state.mission.focusedOre;
    if (!focusedOre || this.state.objectiveTargets.length === 0) {
      if (this.lastObjectiveSignature !== "") {
        this.objectiveGraphics.clear();
        this.lastObjectiveSignature = "";
      }
      return;
    }

    const playerTileX = Math.floor(this.state.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.state.player.y / TILE_SIZE);
    const signature = `${focusedOre}:${playerTileX},${playerTileY}:${this.state.objectiveTargets.map((target) => `${target.tileX},${target.tileY}`).join("|")}`;
    if (signature === this.lastObjectiveSignature && this.time.now - this.lastObjectiveDrawAt < OBJECTIVE_DRAW_INTERVAL_MS) {
      return;
    }

    this.lastObjectiveSignature = signature;
    this.lastObjectiveDrawAt = this.time.now;
    this.objectiveGraphics.clear();

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
      const distanceFade = Phaser.Math.Clamp(1 - Math.sqrt(distanceSq) / 720, 0.18, 1);
      const alpha = glowAlpha(lineAlpha * distanceFade);
      const left = target.tileX * TILE_SIZE + 4;
      const top = target.tileY * TILE_SIZE + 4;
      const right = left + TILE_SIZE - 8;
      const bottom = top + TILE_SIZE - 8;
      const bracket = 7;
      this.objectiveGraphics.lineStyle(2, color, alpha);
      this.objectiveGraphics.lineBetween(left, top, left + bracket, top);
      this.objectiveGraphics.lineBetween(left, top, left, top + bracket);
      this.objectiveGraphics.lineBetween(right, top, right - bracket, top);
      this.objectiveGraphics.lineBetween(right, top, right, top + bracket);
      this.objectiveGraphics.lineBetween(left, bottom, left + bracket, bottom);
      this.objectiveGraphics.lineBetween(left, bottom, left, bottom - bracket);
      this.objectiveGraphics.lineBetween(right, bottom, right - bracket, bottom);
      this.objectiveGraphics.lineBetween(right, bottom, right, bottom - bracket);
      this.objectiveGraphics.fillStyle(color, glowAlpha(0.055 * distanceFade + lineAlpha * 0.035));
      this.objectiveGraphics.fillCircle(centerX, centerY, 4.5);
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
    this.beamGraphics.lineStyle(beam.heat === "high" ? 12 : 8, color, glowAlpha(beam.heat === "high" ? 0.24 : 0.18));
    this.beamGraphics.lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    this.beamGraphics.lineStyle(beam.heat === "high" ? 4.5 * pulse : 3, color, glowAlpha(0.95));
    this.beamGraphics.lineBetween(beam.x1, beam.y1, beam.x2, beam.y2);
    this.beamGraphics.fillStyle(0xffffff, glowAlpha(0.9));
    this.beamGraphics.fillCircle(beam.x2, beam.y2, beam.heat === "high" ? 7 * pulse : 4);
  }

  private drawEnemyFields(): void {
    this.fieldGraphics.clear();
    if (this.state.player.shieldActiveTimer > 0 && this.state.player.shield > 0) {
      const shieldRatio = this.state.player.shield / this.state.player.shieldMax;
      this.fieldGraphics.lineStyle(3, 0x5ab8a8, glowAlpha(0.42 + shieldRatio * 0.28));
      this.fieldGraphics.strokeCircle(this.state.player.x, this.state.player.y, 34 + Math.sin(this.state.elapsed * 12) * 2);
      this.fieldGraphics.fillStyle(0x5ab8a8, glowAlpha(0.035 + shieldRatio * 0.035));
      this.fieldGraphics.fillCircle(this.state.player.x, this.state.player.y, 34);
    }
    for (const enemy of this.state.enemies) {
      if (enemy.kind !== "arcWarden") {
        continue;
      }

      const active = enemy.state === "pulsing";
      this.fieldGraphics.lineStyle(active ? 2 : 1, 0x6ec4b8, glowAlpha(active ? 0.48 : 0.18));
      this.fieldGraphics.strokeCircle(enemy.x, enemy.y, active ? 70 : 44);
    }
  }

  private drawHazards(): void {
    this.hazardGraphics.clear();
    for (const hazard of this.state.hazards) {
      if (hazard.kind === "lightning") {
        const charged = hazard.age >= hazard.damageAt;
        this.hazardGraphics.lineStyle(charged ? 7 : 3, charged ? 0xf0e4cc : 0x8a6db8, glowAlpha(charged ? 0.88 : 0.28));
        this.hazardGraphics.lineBetween(hazard.x1, hazard.y1, hazard.x2, hazard.y2);
      } else {
        const progress = hazard.age / hazard.duration;
        const color = hazard.kind === "swarmExplosion" ? 0xe8c86a : 0xd4845a;
        const alpha = hazard.kind === "swarmExplosion" ? 0.22 : 0.14;
        this.hazardGraphics.lineStyle(hazard.kind === "swarmExplosion" ? 5 : 3, color, glowAlpha(1 - progress));
        this.hazardGraphics.strokeCircle(hazard.x1, hazard.y1, hazard.radius * progress);
        this.hazardGraphics.fillStyle(color, glowAlpha(alpha * (1 - progress)));
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
      const chunk = this.terrainChunkAt(tx, ty);
      if (chunk) {
        this.redrawTerrainChunk(chunk);
      }

      this.refreshCaveEdgesNearTile(tx, ty);
    }
  }

  private handleEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === "tile-broken") {
        this.audioFeedback.play("tileBreak");
        this.spawnBurst(event.x, event.y, event.color, 10, 130);
        if (event.color === 0x8a6db8 || event.color === 0x5ab8a8 || event.color === 0xc47a8a) {
          this.spawnPulseRing(event.x, event.y, event.color, 260);
        }
        this.cameraPunch(event.x, event.y, event.color === 0xc47a8a || event.color === 0x5ab8a8 ? 15 : 7);
        this.cameras.main.shake(36, 0.0015);
      }

      if (event.type === "pickup-collected") {
        this.audioFeedback.play("pickup");
        this.spawnBurst(event.x, event.y, event.color, 4, 70);
        if (event.context) {
          getHudController().showPickupToast("ore", event.context as OreId);
        }
      }

      if (event.type === "power-pickup-collected") {
        this.audioFeedback.play("powerPickup");
        this.spawnBurst(event.x, event.y, event.color, 8, 110);
        this.spawnGlowPulse(event.x, event.y, event.color, 1.05, 180);
        if (event.context) {
          getHudController().showPickupToast("power", event.context as PowerDropId);
        }
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
        this.spawnPulseRing(event.x, event.y, event.color, 300);
        this.cameraPunch(event.x, event.y, 18);
        this.cameras.main.shake(70, 0.003);
        if (event.context) {
          getHudController().showEnemyTakedownToast(event.context);
        }
      }

      if (event.type === "player-hit") {
        this.audioFeedback.play("damage");
        this.spawnBurst(this.state.player.x, this.state.player.y, event.color, 9, 85);
        this.spawnDamageEdgeFlash(event);
        this.cameraPunch(event.sourceX ?? event.x, event.sourceY ?? event.y, 20);
        this.cameras.main.shake(74, 0.0045);
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
        this.spawnPulseRing(event.x, event.y, event.color, 240);
        this.cameraPunch(event.x, event.y, 16);
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

      if (event.type === "near-miss") {
        this.audioFeedback.play("nearMiss");
        this.spawnNearMissFeedback(event.x, event.y);
        this.spawnGlowPulse(this.state.player.x, this.state.player.y, event.color, 0.55, 130);
      }

      if (event.type === "danger-swell") {
        this.audioFeedback.play("dangerSwell");
        this.cameras.main.shake(190, 0.003);
      }
    }
  }

  private spawnMuzzleFlash(x: number, y: number, color: number): void {
    const flash = this.add.image(x, y, "fx.glow.radial")
      .setDepth(30)
      .setTint(color)
      .setScale(0.42)
      .setAlpha(glowAlpha(0.72))
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
    const particleCount = this.qualityParticleCount(count);

    for (let index = 0; index < particleCount; index += 1) {
      const angle = (index / particleCount) * Math.PI * 2 + Math.random() * 0.45;
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
    const shuttle = this.add.image(startX, startY, TEXTURES.ship("pickaxe"))
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
      .setAlpha(glowAlpha(0.64))
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

  private spawnPulseRing(x: number, y: number, color: number, duration: number): void {
    const ring = this.add.graphics()
      .setDepth(28)
      .setAlpha(glowAlpha(0.86))
      .setBlendMode(Phaser.BlendModes.ADD);
    ring.lineStyle(3, color, glowAlpha(0.92));
    ring.strokeCircle(0, 0, 18);
    ring.setPosition(x, y);
    this.minimap?.ignore(ring);

    this.tweens.add({
      targets: ring,
      scale: 3.2,
      alpha: 0,
      duration,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private cameraPunch(x: number, y: number, strength: number): void {
    const dx = x - this.state.player.x;
    const dy = y - this.state.player.y;
    const length = Math.hypot(dx, dy) || 1;
    const offset = {
      x: Phaser.Math.Clamp((-dx / length) * strength, -28, 28),
      y: Phaser.Math.Clamp((-dy / length) * strength, -28, 28)
    };
    this.cameras.main.setFollowOffset(offset.x, offset.y);
    this.tweens.add({
      targets: offset,
      x: 0,
      y: 0,
      duration: 120,
      ease: "Cubic.easeOut",
      onUpdate: () => this.cameras.main.setFollowOffset(offset.x, offset.y),
      onComplete: () => this.cameras.main.setFollowOffset(0, 0)
    });
  }

  private spawnDamageEdgeFlash(event: GameEvent): void {
    const sourceX = event.sourceX ?? event.x;
    const sourceY = event.sourceY ?? event.y;
    const dx = sourceX - this.state.player.x;
    const dy = sourceY - this.state.player.y;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    const zoom = this.cameras.main.zoom || 1;
    const width = this.scale.width / zoom;
    const height = this.scale.height / zoom;
    const thickness = 64 / zoom;
    const bleed = 120 / zoom;
    const flash = horizontal
      ? this.add.rectangle(dx >= 0 ? width + bleed - thickness / 2 : -bleed + thickness / 2, height / 2, thickness + bleed, height + bleed * 2, 0xc45a4a, 0.24)
      : this.add.rectangle(width / 2, dy >= 0 ? height + bleed - thickness / 2 : -bleed + thickness / 2, width + bleed * 2, thickness + bleed, 0xc45a4a, 0.24);
    flash.setDepth(82).setScrollFactor(0).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 220,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  private spawnNearMissFeedback(x: number, y: number): void {
    const streak = this.add.graphics()
      .setDepth(31)
      .setAlpha(glowAlpha(0.9))
      .setBlendMode(Phaser.BlendModes.ADD);
    streak.lineStyle(4, 0xf0e4cc, glowAlpha(0.84));
    streak.lineBetween(-18, 0, 18, 0);
    streak.setPosition(x, y);
    streak.setRotation(this.state.player.angle + Math.PI / 2);
    this.minimap?.ignore(streak);
    this.tweens.add({
      targets: streak,
      alpha: 0,
      scaleX: 1.8,
      duration: 180,
      ease: "Quad.easeOut",
      onComplete: () => streak.destroy()
    });

    const text = this.add.text(x, y - 26, "CLOSE", {
      fontFamily: "Bahnschrift, DIN Condensed, Aptos, sans-serif",
      fontSize: "12px",
      fontStyle: "900",
      color: "#f0e4cc",
      stroke: "#120b08",
      strokeThickness: 3
    }).setDepth(32).setOrigin(0.5);
    this.minimap?.ignore(text);
    this.tweens.add({
      targets: text,
      y: y - 44,
      alpha: 0,
      duration: 420,
      ease: "Quad.easeOut",
      onComplete: () => text.destroy()
    });
  }

}

type AudioCue =
  | "weaponShot"
  | "tileHit"
  | "tileBreak"
  | "pickup"
  | "powerPickup"
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
  | "nearMiss"
  | "heartbeat"
  | "dangerSwell"
  | "bossBreakout"
  | "bossHit"
  | "bossDefeat";

class GameplayAudio {
  private readonly cooldowns = new Map<AudioCue, number>();
  private unlocked = false;
  private nextRumbleAt = 0;
  private nextHeartbeatAt = 0;

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

  updateHull(hullRatio: number): void {
    if (!this.unlocked || hullRatio >= 0.25) {
      return;
    }

    const now = this.scene.time.now;
    if (now < this.nextHeartbeatAt) {
      return;
    }

    const context = this.audioContext();
    if (context) {
      const intensity = Phaser.Math.Clamp((0.25 - hullRatio) / 0.25, 0, 1);
      playTone(context, 38, 0.1, 0.025 + intensity * 0.035, "sine");
      playNoise(context, 0.055, 0.012 + intensity * 0.018, 190);
    }
    this.nextHeartbeatAt = now + 260 + hullRatio * 1200;
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
    powerPickup: { volume: 0.18, cooldown: 56 },
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
    nearMiss: { volume: 0.11, cooldown: 140 },
    heartbeat: { volume: 0.12, cooldown: 250 },
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
  } else if (cue === "powerPickup") {
    playTone(context, 260 * pitch, 0.1, volume * 0.36, "triangle");
    playTone(context, 520 * pitch, 0.14, volume * 0.28, "triangle", 0.03);
    playTone(context, 780 * pitch, 0.12, volume * 0.16, "sine", 0.075);
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
  } else if (cue === "nearMiss") {
    playNoise(context, 0.07, volume * 0.34, 1100);
    playTone(context, 280 * pitch, 0.08, volume * 0.24, "triangle");
  } else if (cue === "heartbeat") {
    playTone(context, 38 * pitch, 0.1, volume * 0.44, "sine");
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

function textureForPickup(pickup: PickupState): string {
  if (pickup.kind === "power" && pickup.power) {
    return TEXTURES.powerPickup(pickup.power);
  }
  return TEXTURES.pickup((pickup.ore ?? "ferrite") as OreId);
}

function colorForPickup(pickup: PickupState): number {
  if (pickup.kind === "power") {
    if (pickup.power === "repairPack") {
      return 0xc45a4a;
    }
    if (pickup.power === "coolantCell") {
      return 0x5ab8a8;
    }
    if (pickup.power === "overdriveCell") {
      return 0xe8c86a;
    }
    return 0x8a6db8;
  }
  if (pickup.ore === "ferrite") {
    return 0xc4a86e;
  }
  if (pickup.ore === "shimmer") {
    return 0x8a6db8;
  }
  if (pickup.ore === "voltaic") {
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
