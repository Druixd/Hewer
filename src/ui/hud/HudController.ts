import { CRAFT_RECIPES, ORE_CONFIG, ORG_TASKS, TERRITORY_CONFIG, UPGRADE_CONFIG, upgradeCost } from "../../game/content/config";
import { canCraftActiveTask, getActiveTask, getTaskRequirementProgress } from "../../game/simulation/systems/progression";
import type { GameState, RunResult, UpgradeId, UpgradeState } from "../../game/simulation/types";

interface HudHandlers {
  sameSeed: () => void;
  newRun: () => void;
  buyUpgrade: (id: UpgradeId) => UpgradeState;
  craftObjective: () => UpgradeState;
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
          <div class="meter-row">
            <div class="meter hull"><i data-meter="hull"></i></div>
            <b data-value="hull">100</b>
          </div>
          <div class="meter-row">
            <div class="meter heat"><i data-meter="heat"></i></div>
            <b data-value="heat">0</b>
          </div>
          <div class="ore-row">
            <div data-ore="ferrite"></div>
            <div data-ore="shimmer"></div>
            <div data-ore="voltaic"></div>
            <div data-ore="aetherium"></div>
          </div>
          <div class="slot-row">
            <div class="slot"><span class="slot-key">MBL</span><span class="slot-name">LASER</span></div>
            <div class="slot"><span class="slot-key">MBR</span><span class="slot-name">BOMB</span></div>
            <div class="slot"><span class="slot-key">SHIFT</span><span class="slot-name">DASH</span></div>
            <div class="slot"><span class="slot-key">SPC</span><span class="slot-name">HEAT</span></div>
            <div class="slot"><span class="slot-key">E</span><span class="slot-name">BANK</span></div>
          </div>
        </div>

        <div class="hud-task" data-panel="task">
          <div class="task-name" data-value="task-name">No active order</div>
          <div class="task-meta" data-value="task-meta"></div>
          <div class="task-progress" data-value="task-progress"></div>
        </div>
        
        <div class="hud-center">
          <div class="hud-score" data-value="score">0</div>
          <div class="hud-indicators">
            <span class="ind-item shimmer">0 ✦</span>
            <span class="ind-item voltaic">0 ❖</span>
            <span class="ind-item aetherium">0 ⬢</span>
            <span class="ind-item ferrite">0 ⬩</span>
          </div>
        </div>

        <div class="hud-boss" data-panel="boss">
          <div class="meter boss"><i data-meter="boss"></i></div><b data-value="boss">0</b>
        </div>
        <div class="dock-chip" data-panel="dock">E</div>
        
        <div class="hud-radar-wrapper">
          <div class="hud-radar-frame">
            <div class="hud-radar-grid"></div>
            <div class="hud-radar-ping"></div>
          </div>
        </div>
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

  update(state: GameState, _progress: UpgradeState): void {
    const progress = state.upgrades;
    setWidth(this.root, "hull", state.player.hull / state.player.maxHull);
    setWidth(this.root, "heat", state.player.heat / state.stats.heatCapacity);
    setText(this.root, "hull", `${Math.ceil(state.player.hull)}`);
    setText(this.root, "heat", state.player.overheatedTimer > 0 ? "LOCK" : `${Math.round(state.player.heat)}`);

    // Calculate current cargo value/score
    const cargoValue = 
      state.inventory.ferrite * ORE_CONFIG.ferrite.value +
      state.inventory.shimmer * ORE_CONFIG.shimmer.value +
      state.inventory.voltaic * ORE_CONFIG.voltaic.value +
      state.inventory.aetherium * ORE_CONFIG.aetherium.value;
    
    setText(this.root, "score", `${cargoValue}`);

    // Update bottom center indicators
    const shimNode = this.root.querySelector<HTMLElement>(".hud-indicators .shimmer");
    if (shimNode) shimNode.textContent = `${state.inventory.shimmer} ✦`;
    const voltNode = this.root.querySelector<HTMLElement>(".hud-indicators .voltaic");
    if (voltNode) voltNode.textContent = `${state.inventory.voltaic} ❖`;
    const aethNode = this.root.querySelector<HTMLElement>(".hud-indicators .aetherium");
    if (aethNode) aethNode.textContent = `${state.inventory.aetherium} ⬢`;
    const ferrNode = this.root.querySelector<HTMLElement>(".hud-indicators .ferrite");
    if (ferrNode) ferrNode.textContent = `${state.inventory.ferrite} ⬩`;

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

    this.renderTaskHud(progress);
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
    if (action === "craft-objective") {
      const progress = this.handlers.craftObjective();
      const activeResult = this.root.querySelector<HTMLElement>('[data-panel="summary"]')?.dataset.result;
      if (activeResult) {
        const result = JSON.parse(activeResult) as RunResult;
        this.renderSummary(result, progress);
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
    const outcome = result.outcome === "destroyed" ? "SHIP LOST" : "CARGO BANKED";
    const task = result.activeTaskId ? ORG_TASKS.find((candidate) => candidate.id === result.activeTaskId) : getActiveTask(progress);
    const taskLine = task ? getTaskRequirementProgress(progress, task) : "No active org order";
    const recipe = task?.recipe ? CRAFT_RECIPES[task.recipe] : null;
    const craftDisabled = !canCraftActiveTask(progress) ? "disabled" : "";
    const craftButton = recipe && !progress.activeTask?.completed
      ? `<button type="button" data-action="craft-objective" ${craftDisabled}>Craft ${recipe.label}</button>`
      : "";
    const taskState = progress.activeTask?.completed ? "Complete" : "In progress";
    const bossLine = result.voltrixCore ? "Voltrix Core achieved" : "No boss achievement";
    const rows = [
      ["Credits", `+${result.creditsEarned}`],
      ["Blocks", `${result.minedBlocks}`],
      ["Kills", `${result.enemiesKilled}`],
      ["Time", formatTime(result.duration)],
      ["Bank", `${progress.credits}`],
      ["Task", taskState],
      ["Boss", bossLine]
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
      <div class="summary-task">
        <b>${task?.label ?? "No active org order"}</b>
        <span>${taskLine}</span>
      </div>
      <div class="run-grid">
        ${rows.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}
      </div>
      <div class="upgrade-grid">${upgrades}</div>
      <div class="run-actions">
        ${craftButton}
        <button type="button" data-action="same-seed">Same Seed</button>
        <button type="button" data-action="new-run">New Run</button>
      </div>
    `;
  }

  private renderTaskHud(progress: UpgradeState): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="task"]');
    const name = this.root.querySelector<HTMLElement>('[data-value="task-name"]');
    const meta = this.root.querySelector<HTMLElement>('[data-value="task-meta"]');
    const line = this.root.querySelector<HTMLElement>('[data-value="task-progress"]');
    const task = getActiveTask(progress);

    if (!panel || !name || !meta || !line || !task || !progress.activeTask) {
      panel?.classList.add("is-hidden");
      return;
    }

    panel.classList.remove("is-hidden");
    name.textContent = progress.activeTask.completed ? `${task.label} complete` : task.label;
    meta.textContent = `${TERRITORY_CONFIG[task.territory].label} / ${task.mapVariant}`;
    line.textContent = getTaskRequirementProgress(progress, task);
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
