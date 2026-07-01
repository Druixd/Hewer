import { CRAFT_RECIPES, ORE_CONFIG, ORG_TASKS, TERRITORY_CONFIG, UPGRADE_CONFIG, upgradeCost } from "../../game/content/config";
import { canCraftActiveTask, getActiveTask, getTaskGuidance } from "../../game/simulation/systems/progression";
import type { CraftRecipe, GameState, RunResult, TaskGuidanceState, UpgradeId, UpgradeState } from "../../game/simulation/types";

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
            <div class="slot"><span class="slot-key">MBL</span><span class="slot-name">DRILL</span></div>
            <div class="slot blast" data-slot="blast">
              <span class="slot-key">MBR</span>
              <span class="slot-name">BLAST</span>
              <span class="charge-pips" data-value="blast-pips"></span>
              <span class="charge-timer" data-value="blast-timer"></span>
            </div>
            <div class="slot"><span class="slot-key">SHIFT</span><span class="slot-name">DASH</span></div>
            <div class="slot"><span class="slot-key">E</span><span class="slot-name">BANK</span></div>
          </div>
        </div>

        <div class="mission-intro" data-panel="mission-intro">
          <div class="mission-kicker" data-value="mission-territory">FIELD MISSION</div>
          <div class="mission-title" data-value="mission-title">Org Order</div>
          <div class="mission-loadout" data-value="mission-loadout"></div>
          <div class="mission-first" data-value="mission-first"></div>
        </div>

        <div class="hud-task" data-panel="task">
          <div class="task-header">
            <span data-value="task-name">Mission</span>
            <b data-value="task-meta"></b>
          </div>
          <div class="task-next" data-value="task-next">Find ore</div>
          <div class="task-steps" data-value="task-steps"></div>
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
    this.root.dataset.mood = state.threat.mood;
    setWidth(this.root, "hull", state.player.hull / state.player.maxHull);
    setWidth(this.root, "heat", state.player.heat / state.stats.heatCapacity);
    setText(this.root, "hull", `${Math.ceil(state.player.hull)}`);
    setText(this.root, "heat", state.player.overheatedTimer > 0 ? "LOCK" : `${Math.round(state.player.heat)}`);

    this.renderBlastCharges(state);
    this.renderMissionIntro(state);

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

    if (shimNode) shimNode.innerHTML = renderOreCount("shimmer", state.inventory.shimmer);
    if (voltNode) voltNode.innerHTML = renderOreCount("voltaic", state.inventory.voltaic);
    if (aethNode) aethNode.innerHTML = renderOreCount("aetherium", state.inventory.aetherium);
    if (ferrNode) ferrNode.innerHTML = renderOreCount("ferrite", state.inventory.ferrite);

    for (const ore of Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>) {
      const node = this.root.querySelector<HTMLElement>(`[data-ore="${ore}"]`);
      if (node) {
        node.innerHTML = renderOreCount(ore, state.inventory[ore]);
      }
    }

    const bossPanel = this.root.querySelector<HTMLElement>('[data-panel="boss"]');
    if (bossPanel) {
      bossPanel.classList.toggle("is-hidden", !state.boss.active && !state.boss.defeated);
    }
    setWidth(this.root, "boss", state.boss.maxHealth > 0 ? state.boss.health / state.boss.maxHealth : 0);
    setText(this.root, "boss", `${Math.ceil(state.boss.health)}`);

    const dock = this.root.querySelector<HTMLElement>('[data-panel="dock"]');
    let distToExtraction = Number.POSITIVE_INFINITY;
    if (dock) {
      distToExtraction = Math.hypot(state.player.x - state.world.extraction.x, state.player.y - state.world.extraction.y);
      dock.classList.toggle("is-hidden", distToExtraction > 72 || state.status !== "playing");
    }

    this.renderTaskHud(progress, {
      cargoValue,
      distanceToExtraction: distToExtraction,
      threatMood: state.threat.mood,
      bossActive: state.boss.active,
      bossDefeated: state.boss.defeated
    });
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
        node.innerHTML = renderOreCount(ore, 0);
      }
    }
  }

  private renderBlastCharges(state: GameState): void {
    const slot = this.root.querySelector<HTMLElement>('[data-slot="blast"]');
    const pips = this.root.querySelector<HTMLElement>('[data-value="blast-pips"]');
    const timer = this.root.querySelector<HTMLElement>('[data-value="blast-timer"]');
    if (!slot || !pips || !timer) {
      return;
    }

    slot.classList.toggle("is-locked", state.player.blastCharges === 0);
    slot.classList.toggle("is-cooling", state.player.blastRepeatCooldown > 0);
    pips.innerHTML = Array.from({ length: 3 }, (_, index) => {
      const active = index < state.player.blastCharges ? "is-active" : "";
      return `<i class="${active}"></i>`;
    }).join("");
    timer.textContent = state.player.blastCharges === 0 ? `${Math.ceil(state.player.blastRechargeTimer)}s` : "";
  }

  private renderMissionIntro(state: GameState): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="mission-intro"]');
    const territory = this.root.querySelector<HTMLElement>('[data-value="mission-territory"]');
    const title = this.root.querySelector<HTMLElement>('[data-value="mission-title"]');
    const loadout = this.root.querySelector<HTMLElement>('[data-value="mission-loadout"]');
    const first = this.root.querySelector<HTMLElement>('[data-value="mission-first"]');
    const task = getActiveTask(state.upgrades);
    if (!panel || !territory || !title || !loadout || !first || !task || !state.upgrades.activeTask) {
      panel?.classList.add("is-hidden");
      return;
    }

    panel.classList.toggle("is-hidden", state.mission.introTimer <= 0 || state.status !== "playing");
    territory.textContent = TERRITORY_CONFIG[task.territory].label.toUpperCase();
    title.textContent = task.label.replace("Org Order: ", "");
    loadout.innerHTML = task.requirements
      .filter((requirement) => requirement.kind === "collect")
      .map((requirement) => `<span class="mission-material">${oreIcon(requirement.ore)}<b>${requirement.amount}</b></span>`)
      .join("");
    const guidance = getTaskGuidance(state.upgrades, task, {
      cargoValue: 0,
      distanceToExtraction: Number.POSITIVE_INFINITY,
      threatMood: state.threat.mood,
      bossActive: state.boss.active,
      bossDefeated: state.boss.defeated
    });
    first.textContent = guidance.nextAction;
  }

  private renderSummary(result: RunResult, progress: UpgradeState): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="summary"]');
    if (!panel) {
      return;
    }

    panel.dataset.result = JSON.stringify(result);
    const outcome = result.outcome === "destroyed" ? "SHIP LOST" : "CARGO BANKED";
    const task = result.activeTaskId ? ORG_TASKS.find((candidate) => candidate.id === result.activeTaskId) : getActiveTask(progress);
    const guidance = getTaskGuidance(progress, task ?? null, { cargoValue: result.creditsEarned, bossDefeated: result.voltrixCore });
    const recipe = task?.recipe ? CRAFT_RECIPES[task.recipe] : null;
    const craftDisabled = !canCraftActiveTask(progress) ? "disabled" : "";
    const craftButton = recipe && !progress.activeTask?.completed
      ? `<button class="workshop-action" type="button" data-action="craft-objective" ${craftDisabled}>Craft ${recipe.label}</button>`
      : "";
    const taskState = progress.activeTask?.completed ? "Complete" : "In progress";
    const bossLine = result.voltrixCore ? "Voltrix Core achieved" : "No boss achievement";
    const rows = [
      ["Blocks", `${result.minedBlocks}`],
      ["Kills", `${result.enemiesKilled}`],
      ["Time", formatTime(result.duration)],
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
        const label = upgradeDisplayLabel(id, config.label);
        const before = Math.round((level / config.maxLevel) * 100);
        const after = Math.round((Math.min(config.maxLevel, level + 1) / config.maxLevel) * 100);
        return `
          <button class="upgrade-node ${id}" type="button" data-action="upgrade" data-upgrade="${id}" ${disabled}>
            <span class="node-dot"></span>
            <span class="node-copy"><b>${label}</b><em>L${level} / ${config.maxLevel}</em></span>
            <span class="node-bars">
              <i style="--value:${before}%"></i>
              <i class="after" style="--value:${after}%"></i>
            </span>
            <strong>${price}</strong>
          </button>
        `;
      })
      .join("");

    panel.innerHTML = `
      <div class="service-console">
        <aside class="service-bank">
          <div class="bank-title">${outcome}</div>
          <div class="bank-readout">
            <span>Run credit</span>
            <b>+${result.creditsEarned}</b>
          </div>
          <div class="bank-readout">
            <span>Account</span>
            <b>${progress.credits}</b>
          </div>
          <div class="bank-cargo">
            ${renderCargoRows(result)}
          </div>
          <div class="bank-stamp">${result.outcome === "destroyed" ? "Cargo lost" : "Cargo credited"}</div>
        </aside>

        <section class="service-main">
          <div class="service-tabs">
            <span class="is-active">Upgrades & Repairs</span>
            <span>Workshop</span>
            <span>Cargo Exchange</span>
          </div>

          <div class="summary-task">
            <b>${task?.label ?? "No active org order"}</b>
            <span>${escapeHtml(guidance.nextAction)}</span>
            ${renderStepList(guidance, "summary-step-list")}
          </div>

          <div class="run-grid">
            ${rows.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}
          </div>

          <div class="ship-bay">
            <div class="ship-silhouette">
              <span class="ship-nose"></span>
              <span class="ship-core"></span>
              <span class="ship-wing left"></span>
              <span class="ship-wing right"></span>
            </div>
            <div class="upgrade-grid">${upgrades}</div>
          </div>

          <div class="service-lower">
            <div class="workshop-bay">
              <div class="bay-label">Workshop</div>
              <b>${recipe?.label ?? "No recipe queued"}</b>
              <div class="material-sockets">${recipe ? renderMaterialSockets(recipe, progress) : ""}</div>
              ${craftButton || `<button class="workshop-action" type="button" disabled>${progress.activeTask?.completed ? "Order complete" : "No craft available"}</button>`}
            </div>
            <div class="exchange-bay">
              <div class="bay-label">Cargo Exchange</div>
              <b>${result.outcome === "destroyed" ? "No transfer" : "Transfer complete"}</b>
              <div class="exchange-total"><span>Run cargo</span><strong>${result.creditsEarned}c</strong></div>
              <div class="exchange-total"><span>Voltrix core</span><strong>${result.voltrixCore ? "+220c" : "none"}</strong></div>
            </div>
          </div>
        </section>
      </div>
      <div class="run-actions">
        <button type="button" data-action="same-seed">Same Seed</button>
        <button type="button" data-action="new-run">New Run</button>
      </div>
    `;
  }

  private renderTaskHud(progress: UpgradeState, options: Parameters<typeof getTaskGuidance>[2]): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="task"]');
    const name = this.root.querySelector<HTMLElement>('[data-value="task-name"]');
    const next = this.root.querySelector<HTMLElement>('[data-value="task-next"]');
    const meta = this.root.querySelector<HTMLElement>('[data-value="task-meta"]');
    const steps = this.root.querySelector<HTMLElement>('[data-value="task-steps"]');
    const task = getActiveTask(progress);

    if (!panel || !name || !next || !meta || !steps || !task || !progress.activeTask) {
      panel?.classList.add("is-hidden");
      return;
    }

    const guidance = getTaskGuidance(progress, task, options);
    panel.classList.remove("is-hidden");
    panel.classList.toggle("is-ready", guidance.isCraftReady || guidance.isBankReady);
    panel.classList.toggle("is-danger", Boolean(guidance.bossCue && options?.threatMood !== "quiet"));
    name.textContent = guidance.label;
    next.textContent = guidance.nextAction;
    meta.textContent = `${TERRITORY_CONFIG[task.territory].label} / ${task.mapVariant}`;
    steps.innerHTML = renderObjectiveChips(guidance);
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

function renderStepList(guidance: TaskGuidanceState, className: string): string {
  if (!guidance.stepStates.length) {
    return "";
  }

  return `
    <div class="${className}">
      ${guidance.stepStates
        .map((step) => {
          const state = step.complete ? "done" : "open";
          return `<div class="task-step ${state}"><span>${escapeHtml(step.label)}</span><b>${step.current}/${step.target}</b></div>`;
        })
        .join("")}
    </div>
  `;
}

function renderObjectiveChips(guidance: TaskGuidanceState): string {
  if (!guidance.stepStates.length) {
    return "";
  }

  return `
    <div class="objective-chip-list">
      ${guidance.stepStates
        .map((step) => {
          const state = step.complete ? "done" : "open";
          const ore = oreFromStepLabel(step.label);
          const icon = step.kind === "collect" && ore ? oreIcon(ore) : `<span class="craft-art"></span>`;
          return `<span class="objective-chip ${state}">${icon}<i>${step.current}/${step.target}</i></span>`;
        })
        .join("")}
    </div>
  `;
}

function renderCargoRows(result: RunResult): string {
  return (Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>)
    .map((ore) => {
      const count = result.inventory[ore];
      return `<div>${oreIcon(ore)}<b>${count}</b><i>${count * ORE_CONFIG[ore].value}c</i></div>`;
    })
    .join("");
}

function renderMaterialSockets(recipe: CraftRecipe, progress: UpgradeState): string {
  const materials = progress.activeTask?.materials;
  return (Object.entries(recipe.costs) as Array<[keyof typeof ORE_CONFIG, number]>)
    .map(([ore, amount]) => {
      const current = materials ? materials[ore] : 0;
      const ready = current >= amount ? "ready" : "missing";
      return `<span class="${ready}">${oreIcon(ore)}<i>${Math.min(current, amount)}/${amount}</i></span>`;
    })
    .join("");
}

function renderOreCount(ore: keyof typeof ORE_CONFIG, count: number): string {
  return `${oreIcon(ore)}<b>${count}</b>`;
}

function oreIcon(ore: keyof typeof ORE_CONFIG): string {
  return `<span class="ore-art ${ore}" aria-label="${escapeHtml(ORE_CONFIG[ore].label)}"></span>`;
}

function oreFromStepLabel(label: string): keyof typeof ORE_CONFIG | null {
  const match = (Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>).find((ore) => ORE_CONFIG[ore].label === label);
  return match ?? null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${rest}`;
}

function upgradeDisplayLabel(id: UpgradeId, fallback: string): string {
  if (id === "laserPower") {
    return "Weapon Output";
  }
  if (id === "heatSink") {
    return "Fire Control";
  }
  if (id === "magnetRadius") {
    return "Cargo Magnet";
  }
  return fallback;
}
