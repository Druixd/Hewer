import { ORE_CONFIG, UPGRADE_CONFIG, upgradeCost } from "../../game/content/config";
import type { GameState, RunResult, UpgradeId, UpgradeState } from "../../game/simulation/types";

interface HudHandlers {
  sameSeed: () => void;
  newRun: () => void;
  buyUpgrade: (id: UpgradeId) => UpgradeState;
  resume: () => void;
}

let controller: HudController | null = null;

export function setHudController(next: HudController): void {
  controller = next;
}

export function getHudController(): HudController {
  if (!controller) {
    throw new Error("HUD controller has not been created.");
  }

  return controller;
}

export class HudController {
  private readonly root: HTMLDivElement;
  private handlers: HudHandlers | null = null;
  private runSummaryVisible = false;

  constructor(root: HTMLDivElement) {
    this.root = root;
    this.root.innerHTML = `
      <div class="hud-shell">
        <div class="hud-primary">
          <div class="meter-row"><div class="meter hull"><i data-meter="hull"></i></div><b data-value="hull">100</b></div>
          <div class="meter-row"><div class="meter heat"><i data-meter="heat"></i></div><b data-value="heat">0</b></div>
          <div class="ore-row">
            <div data-ore="ferrite"></div>
            <div data-ore="shimmer"></div>
            <div data-ore="voltaic"></div>
            <div data-ore="aetherium"></div>
          </div>
          <div class="slot-row">
            <div>HEL</div>
            <div>MIN</div>
            <div data-value="intensity">LOW</div>
            <div data-value="mood">QUIET</div>
          </div>
        </div>
        <div class="hud-boss" data-panel="boss">
          <div class="meter boss"><i data-meter="boss"></i></div><b data-value="boss">0</b>
        </div>
        <div class="dock-chip" data-panel="dock">E</div>
      </div>
      <div class="pause-panel is-hidden" data-panel="pause">
        <div class="run-title">PAUSED</div>
        <button type="button" data-action="resume">Resume</button>
      </div>
      <div class="run-panel is-hidden" data-panel="summary"></div>
    `;

    this.root.addEventListener("click", (event) => this.handleClick(event));
    this.paintOreLabels();
  }

  setHandlers(handlers: HudHandlers): void {
    this.handlers = handlers;
  }

  update(state: GameState, progress: UpgradeState): void {
    setWidth(this.root, "hull", state.player.hull / state.player.maxHull);
    setWidth(this.root, "heat", state.player.heat / state.stats.heatCapacity);
    setText(this.root, "hull", `${Math.ceil(state.player.hull)}`);
    setText(this.root, "heat", state.player.overheatedTimer > 0 ? "LOCK" : `${Math.round(state.player.heat)}`);
    setText(this.root, "intensity", state.player.miningIntensity.toUpperCase());
    setText(this.root, "mood", state.threat.mood.toUpperCase());

    for (const ore of Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>) {
      const node = this.root.querySelector<HTMLElement>(`[data-ore="${ore}"]`);
      if (node) {
        node.textContent = `${oreGlyph(ore)} ${state.inventory[ore]}`;
      }
    }

    const bossPanel = this.root.querySelector<HTMLElement>('[data-panel="boss"]');
    if (bossPanel) {
      bossPanel.classList.toggle("is-hidden", !state.boss.active && !state.boss.defeated);
    }
    setWidth(this.root, "boss", state.boss.maxHealth > 0 ? state.boss.health / state.boss.maxHealth : 0);
    setText(this.root, "boss", `${Math.ceil(state.boss.health)}`);

    const dock = this.root.querySelector<HTMLElement>('[data-panel="dock"]');
    if (dock) {
      const dist = Math.hypot(state.player.x - state.world.extraction.x, state.player.y - state.world.extraction.y);
      dock.classList.toggle("is-hidden", dist > 72 || state.status !== "playing");
    }

    if (this.runSummaryVisible && state.runResult) {
      this.renderSummary(state.runResult, progress);
    }
  }

  showRunSummary(result: RunResult, progress: UpgradeState): void {
    this.runSummaryVisible = true;
    this.renderSummary(result, progress);
    const panel = this.root.querySelector<HTMLElement>('[data-panel="summary"]');
    panel?.classList.remove("is-hidden");
  }

  hideRunSummary(): void {
    this.runSummaryVisible = false;
    const panel = this.root.querySelector<HTMLElement>('[data-panel="summary"]');
    panel?.classList.add("is-hidden");
  }

  setPaused(paused: boolean): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="pause"]');
    panel?.classList.toggle("is-hidden", !paused);
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLButtonElement>("button[data-action]");
    if (!button || !this.handlers) {
      return;
    }

    const action = button.dataset.action;
    if (action === "same-seed") {
      this.handlers.sameSeed();
    }
    if (action === "new-run") {
      this.handlers.newRun();
    }
    if (action === "resume") {
      this.handlers.resume();
    }
    if (action === "upgrade") {
      const id = button.dataset.upgrade as UpgradeId | undefined;
      if (id) {
        const progress = this.handlers.buyUpgrade(id);
        const activeResult = this.root.querySelector<HTMLElement>('[data-panel="summary"]')?.dataset.result;
        if (activeResult) {
          const result = JSON.parse(activeResult) as RunResult;
          this.renderSummary(result, progress);
        }
      }
    }
  }

  private paintOreLabels(): void {
    for (const ore of Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>) {
      const node = this.root.querySelector<HTMLElement>(`[data-ore="${ore}"]`);
      if (node) {
        node.style.borderColor = ORE_CONFIG[ore].cssColor;
        node.textContent = `${oreGlyph(ore)} 0`;
      }
    }
  }

  private renderSummary(result: RunResult, progress: UpgradeState): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="summary"]');
    if (!panel) {
      return;
    }

    panel.dataset.result = JSON.stringify(result);
    const outcome = result.outcome === "victory" ? "VOLTRIX CORE SECURED" : result.outcome === "destroyed" ? "SHIP LOST" : "CARGO BANKED";
    const rows = [
      ["Credits", `+${result.creditsEarned}`],
      ["Blocks", `${result.minedBlocks}`],
      ["Kills", `${result.enemiesKilled}`],
      ["Time", formatTime(result.duration)],
      ["Bank", `${progress.credits}`]
    ];

    const upgrades = (Object.keys(UPGRADE_CONFIG) as UpgradeId[])
      .map((id) => {
        const config = UPGRADE_CONFIG[id];
        const level = progress[id];
        const cost = upgradeCost(id, level);
        const maxed = level >= config.maxLevel;
        const disabled = maxed || progress.credits < cost ? "disabled" : "";
        const price = maxed ? "MAX" : `${cost}c`;
        return `<button type="button" data-action="upgrade" data-upgrade="${id}" ${disabled}>${config.label} L${level} ${price}</button>`;
      })
      .join("");

    panel.innerHTML = `
      <div class="run-title">${outcome}</div>
      <div class="run-grid">
        ${rows.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}
      </div>
      <div class="upgrade-grid">${upgrades}</div>
      <div class="run-actions">
        <button type="button" data-action="same-seed">Same Seed</button>
        <button type="button" data-action="new-run">New Run</button>
      </div>
    `;
  }
}

function setWidth(root: HTMLElement, key: string, value: number): void {
  const node = root.querySelector<HTMLElement>(`[data-meter="${key}"]`);
  if (node) {
    node.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  }
}

function setText(root: HTMLElement, key: string, value: string): void {
  const node = root.querySelector<HTMLElement>(`[data-value="${key}"]`);
  if (node) {
    node.textContent = value;
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

function oreGlyph(ore: keyof typeof ORE_CONFIG): string {
  if (ore === "ferrite") {
    return "F";
  }
  if (ore === "shimmer") {
    return "S";
  }
  if (ore === "voltaic") {
    return "V";
  }
  return "A";
}
