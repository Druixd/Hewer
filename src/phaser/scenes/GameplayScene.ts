import Phaser from "phaser";
import { TEXTURES } from "../../game/assets/manifest";
import { BLOCK_CONFIG } from "../../game/content/config";
import { createEmptyActions } from "../../game/input/actions";
import { createGameState } from "../../game/simulation/state";
import { bankRunResult, loadProgress, tryBuyUpgrade } from "../../game/simulation/systems/progression";
import { updateGame } from "../../game/simulation/systems/update";
import { TILE_SIZE, type EnemyState, type GameEvent, type GameState, type InputActions, type PickupState, type UpgradeState } from "../../game/simulation/types";
import { isSolid, worldBounds } from "../../game/simulation/world";
import { getHudController } from "../../ui/hud/HudController";

type KeyMap = Record<"W" | "A" | "S" | "D" | "UP" | "DOWN" | "LEFT" | "RIGHT" | "SPACE" | "ESC" | "E", Phaser.Input.Keyboard.Key>;

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
  private enemySprites = new Map<string, Phaser.GameObjects.Image>();
  private pickupSprites = new Map<string, Phaser.GameObjects.Image>();
  private bossHead: Phaser.GameObjects.Image | null = null;
  private bossSegments: Phaser.GameObjects.Image[] = [];
  private resultBanked = false;
  private isPaused = false;

  constructor() {
    super("GameplayScene");
  }

  create(data?: { seed?: string }): void {
    this.progress = loadProgress();
    const seed = data?.seed ?? `merope-shimmer-${this.progress.totalRuns + 1}`;
    this.state = createGameState(seed, this.progress);
    this.resultBanked = false;
    this.isPaused = false;

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
    this.handleEvents(this.state.events);
    hud.update(this.state, this.progress);

    if (this.state.runResult && !this.resultBanked) {
      this.resultBanked = true;
      this.progress = bankRunResult(this.progress, this.state.runResult);
      hud.showRunSummary(this.state.runResult, this.progress);
    }
  }

  private createWorldView(): void {
    this.add.rectangle(0, 0, 12000, 8000, 0x000000, 1).setOrigin(0);

    const stars = this.add.graphics();
    const bounds = worldBounds(this.state.world);
    for (let i = 0; i < 120; i += 1) {
      const x = (i * 997) % bounds.width;
      const y = (i * 593) % bounds.height;
      const alpha = 0.08 + ((i * 17) % 26) / 100;
      stars.fillStyle(i % 6 === 0 ? 0xff7b32 : 0xf5fbff, alpha);
      stars.fillRect(x, y, i % 7 === 0 ? 2 : 1, 1);
    }

    this.drawCavernAtmosphere();

    this.tileSprites = this.state.world.tiles.map((tile) => {
      if (!isSolid(tile)) {
        return null;
      }

      const texture = TEXTURES.tile(tile.type);
      const sprite = this.add.image(tile.x * TILE_SIZE + TILE_SIZE / 2, tile.y * TILE_SIZE + TILE_SIZE / 2, texture);
      const alpha = tile.type === "ancient" ? 0.18 : tile.type === "basalt" ? 0.26 : tile.type === "ferrite" ? 0.48 : 0.92;
      sprite.setAlpha(alpha);
      sprite.setBlendMode(tile.type === "basalt" || tile.type === "ancient" ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.ADD);
      if (tile.cracked) {
        sprite.setTint(0xd6ccff);
      }
      return sprite;
    });
  }

  private drawCavernAtmosphere(): void {
    const haze = this.add.graphics().setDepth(0);
    const edgeGlow = this.add.graphics().setDepth(1).setBlendMode(Phaser.BlendModes.ADD);

    for (const tile of this.state.world.tiles) {
      if (!isSolid(tile)) {
        continue;
      }

      const x = tile.x * TILE_SIZE + TILE_SIZE / 2;
      const y = tile.y * TILE_SIZE + TILE_SIZE / 2;

      if (tile.type === "shimmer") {
        edgeGlow.fillStyle(0x8066ff, 0.045);
        edgeGlow.fillCircle(x, y, 58);
      } else if (tile.type === "voltaic") {
        edgeGlow.fillStyle(0x35e5df, 0.052);
        edgeGlow.fillCircle(x, y, 52);
      } else if (tile.type === "aetherium") {
        edgeGlow.fillStyle(0xf05dff, 0.058);
        edgeGlow.fillCircle(x, y, 68);
      }

      if ((tile.x * 31 + tile.y * 17) % 43 === 0 && tile.type !== "ancient") {
        haze.fillStyle(tile.type === "basalt" ? 0x1b1430 : 0x39245f, 0.055);
        haze.fillRect(tile.x * TILE_SIZE - 18, tile.y * TILE_SIZE - 18, TILE_SIZE * 4, TILE_SIZE * 3);
      }
    }

    for (let i = 0; i < 34; i += 1) {
      const x = (i * 547) % (this.state.world.width * TILE_SIZE);
      const y = (i * 331) % (this.state.world.height * TILE_SIZE);
      haze.fillStyle(i % 3 === 0 ? 0x2b1848 : 0x140d22, 0.08);
      haze.fillRect(x, y, 120 + (i % 5) * 26, 42 + (i % 4) * 18);
    }
  }

  private createActors(): void {
    this.beamGraphics = this.add.graphics().setDepth(8);
    this.fieldGraphics = this.add.graphics().setDepth(4);
    this.hazardGraphics = this.add.graphics().setDepth(9);
    this.reticle = this.add.image(this.state.player.x, this.state.player.y, TEXTURES.reticle).setDepth(20).setBlendMode(Phaser.BlendModes.ADD);
    this.ship = this.add.image(this.state.player.x, this.state.player.y, TEXTURES.ship).setDepth(14).setBlendMode(Phaser.BlendModes.ADD);
  }

  private configureCamera(): void {
    const bounds = worldBounds(this.state.world);
    this.cameras.main.setBounds(0, 0, bounds.width, bounds.height);
    this.cameras.main.startFollow(this.ship, true, 0.09, 0.09);
    this.cameras.main.setZoom(window.innerWidth < 720 ? 0.74 : 0.9);
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

    actions.move.x = (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0);
    actions.move.y = (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) - (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0);
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
        sprite = this.add.image(enemy.x, enemy.y, TEXTURES.enemy(enemy.kind)).setDepth(12).setBlendMode(Phaser.BlendModes.ADD);
        this.enemySprites.set(enemy.id, sprite);
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
        sprite = this.add.image(pickup.x, pickup.y, TEXTURES.pickup(pickup.ore)).setDepth(11).setBlendMode(Phaser.BlendModes.ADD);
        this.pickupSprites.set(pickup.id, sprite);
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
      this.bossHead = this.add.image(boss.x, boss.y, TEXTURES.bossHead).setDepth(13).setBlendMode(Phaser.BlendModes.ADD);
    }

    this.bossHead.setPosition(boss.x, boss.y);
    this.bossHead.setRotation(Math.atan2(boss.vy, boss.vx));

    while (this.bossSegments.length < boss.segments.length) {
      this.bossSegments.push(this.add.image(0, 0, TEXTURES.bossSegment).setDepth(12).setBlendMode(Phaser.BlendModes.ADD));
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
      const sprite = this.tileSprites[ty * this.state.world.width + tx];
      sprite?.setVisible(false);
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
