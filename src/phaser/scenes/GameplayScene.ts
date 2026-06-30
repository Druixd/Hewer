import Phaser from "phaser";
import { TEXTURES } from "../../game/assets/manifest";
import { createEmptyActions } from "../../game/input/actions";
import { createGameState } from "../../game/simulation/state";
import { bankRunResult, loadProgress, tryBuyUpgrade } from "../../game/simulation/systems/progression";
import { updateGame } from "../../game/simulation/systems/update";
import { TILE_SIZE, type GameEvent, type GameState, type InputActions, type UpgradeState } from "../../game/simulation/types";
import { getTile, isSolid, worldBounds } from "../../game/simulation/world";
import { getHudController } from "../../ui/hud/HudController";

type KeyMap = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "SPACE" | "ESC" | "E", Phaser.Input.Keyboard.Key>;
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
  private tileSprites: Array<Phaser.GameObjects.Image | null> = [];
  private tileGlows: Array<Phaser.GameObjects.Image[] | null> = [];
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
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
    this.progress = loadProgress();
    const seed = data?.seed ?? `merope-shimmer-${this.progress.totalRuns + 1}`;
    this.state = createGameState(seed, this.progress);
    this.resultBanked = false;
    this.isPaused = false;
    this.lastTrailTime = 0;

    this.input.mouse?.disableContextMenu();
    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ESC,E") as KeyMap;

    this.createWorldView();
    this.createActors();
    this.configureCamera();
    this.configureHud();
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
    this.minimapGraphics.fillStyle(0x05060a, 0.82);
    this.minimapGraphics.fillCircle(player.x, player.y, MINIMAP_RADIUS * 0.98);

    this.minimapGraphics.lineStyle(8, 0x566f76, 0.44);
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

    this.minimapGraphics.fillStyle(0xff6a00, 0.95);
    for (const enemy of this.state.enemies) {
      if (this.isInMinimapRange(enemy.x, enemy.y)) {
        this.minimapGraphics.fillCircle(enemy.x, enemy.y, 24);
      }
    }

    if (this.isInMinimapRange(this.state.world.extraction.x, this.state.world.extraction.y)) {
      this.minimapGraphics.fillStyle(0x00f3ff, 0.95);
      this.minimapGraphics.fillCircle(this.state.world.extraction.x, this.state.world.extraction.y, 28);
    }

    this.minimapGraphics.fillStyle(0xfff4a0, 1);
    this.minimapGraphics.fillCircle(player.x, player.y, 34);
    this.minimapGraphics.fillStyle(0xffffff, 1);
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
    // Very dark purple-black backdrop instead of absolute pitch black
    this.backdropRect = this.add.rectangle(0, 0, 12000, 8000, 0x030206, 1).setOrigin(0);

    this.starsGraphics = this.add.graphics();
    const bounds = worldBounds(this.state.world);
    for (let i = 0; i < 120; i += 1) {
      const x = (i * 997) % bounds.width;
      const y = (i * 593) % bounds.height;
      const alpha = 0.05 + ((i * 17) % 20) / 100;
      this.starsGraphics.fillStyle(i % 6 === 0 ? 0xff7b32 : 0xf5fbff, alpha);
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
        glowColor = 0x8b6dff;
      } else if (tile.type === "voltaic") {
        glowColor = 0x41e6e2;
      } else if (tile.type === "aetherium") {
        glowColor = 0xf05dff;
      } else if (tile.type === "ferrite") {
        glowColor = 0xffa347; // Warm amber-orange glow
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
        sprite.setTint(0xd6ccff);
      }
      return sprite;
    });
  }

  private drawCavernAtmosphere(): void {
    const bounds = worldBounds(this.state.world);

    // Faint grid lines across the entire world to ensure there's always visibility
    this.cavernGrid = this.add.graphics().setDepth(0);
    this.cavernGrid.lineStyle(1, 0x1d1630, 0.28);
    for (let x = 0; x < bounds.width; x += TILE_SIZE) {
      this.cavernGrid.lineBetween(x, 0, x, bounds.height);
    }
    for (let y = 0; y < bounds.height; y += TILE_SIZE) {
      this.cavernGrid.lineBetween(0, y, bounds.width, y);
    }

    // Add ambient cave glow clouds randomly
    const ambientColors = [0x4d220a, 0x1f143d, 0x0f2a33, 0x2e0d36]; // Warm orange, deep purple, cyan, magenta
    for (let i = 0; i < 90; i++) {
      const cx = (i * 997) % bounds.width;
      const cy = (i * 613) % bounds.height;
      const color = ambientColors[i % ambientColors.length];
      const glow = this.add.image(cx, cy, "fx.glow.radial")
        .setDepth(0)
        .setOrigin(0.5)
        .setScale(4.5 + (i % 4) * 1.5)
        .setAlpha(0.2)
        .setTint(color)
        .setBlendMode(Phaser.BlendModes.ADD);
    }
  }

  private createActors(): void {
    this.beamGraphics = this.add.graphics().setDepth(8);
    this.fieldGraphics = this.add.graphics().setDepth(4);
    this.hazardGraphics = this.add.graphics().setDepth(9);
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
      newRun: () => this.scene.restart({ seed: `merope-shimmer-${Date.now().toString(36)}` }),
      buyUpgrade: (id) => {
        this.progress = tryBuyUpgrade(this.progress, id);
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
    this.reticle.setPosition(this.input.activePointer.worldX, this.input.activePointer.worldY);

    // Spawning expanding white bubble trail particles behind the ship
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > 15 && this.time.now - this.lastTrailTime > 35) {
      this.lastTrailTime = this.time.now;
      
      const angle = player.angle;
      const backX = player.x - Math.cos(angle) * 16 + (Math.random() - 0.5) * 4;
      const backY = player.y - Math.sin(angle) * 16 + (Math.random() - 0.5) * 4;
      
      const particle = this.add.image(backX, backY, TEXTURES.particleWhite)
        .setDepth(13)
        .setAlpha(0.9)
        .setScale(0.55 + Math.random() * 0.45);
        
      const driftAngle = angle + Math.PI + (Math.random() - 0.5) * 0.35;
      const dist = 16 + Math.random() * 20;
      
      this.tweens.add({
        targets: particle,
        x: backX + Math.cos(driftAngle) * dist,
        y: backY + Math.sin(driftAngle) * dist,
        scale: 1.4 + Math.random() * 0.6,
        alpha: 0,
        duration: 320 + Math.random() * 180,
        ease: "Quad.easeOut",
        onComplete: () => {
          particle.destroy();
        }
      });
    }

    this.syncEnemies();
    this.syncPickups();
    this.syncBoss();
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

    const color = beam.heat === "high" ? 0xfff1a0 : 0x46e6ff;
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
      this.fieldGraphics.lineStyle(active ? 2 : 1, 0x46f4ff, active ? 0.48 : 0.18);
      this.fieldGraphics.strokeCircle(enemy.x, enemy.y, active ? 70 : 44);
    }
  }

  private drawHazards(): void {
    this.hazardGraphics.clear();
    for (const hazard of this.state.hazards) {
      if (hazard.kind === "lightning") {
        const charged = hazard.age >= hazard.damageAt;
        this.hazardGraphics.lineStyle(charged ? 7 : 3, charged ? 0xe9fbff : 0x8b6dff, charged ? 0.92 : 0.32);
        this.hazardGraphics.lineBetween(hazard.x1, hazard.y1, hazard.x2, hazard.y2);
      } else {
        const progress = hazard.age / hazard.duration;
        this.hazardGraphics.lineStyle(3, 0xffc247, 1 - progress);
        this.hazardGraphics.strokeCircle(hazard.x1, hazard.y1, hazard.radius * progress);
        this.hazardGraphics.fillStyle(0xffc247, 0.14 * (1 - progress));
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

      if (event.type === "boss-breakout") {
        this.cameras.main.flash(220, 92, 58, 150, false);
        this.cameras.main.shake(430, 0.01);
      }

      if (event.type === "boss-defeated") {
        this.spawnBurst(event.x, event.y, event.color, 44, 360);
        this.cameras.main.flash(320, 240, 210, 255, false);
        this.cameras.main.shake(620, 0.014);
      }
    }
  }

  private spawnBurst(x: number, y: number, color: number, count: number, speed: number): void {
    const texture = color === 0xffc247 ? TEXTURES.particleAmber : color === 0xf05dff ? TEXTURES.particleMagenta : color === 0x41e6e2 ? TEXTURES.particleCyan : TEXTURES.particleWhite;

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
}
