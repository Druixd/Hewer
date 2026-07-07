import { CRAFT_RECIPES, ORE_CONFIG, ORG_TASKS, SHIP_CONFIG, TERRITORY_CONFIG, UNLOCK_CONFIG, UPGRADE_CONFIG, WEAPON_CONFIG, upgradeCost, upgradeMaterialCost } from "../../game/content/config";
import { canCraftActiveTask, getActiveTask, getTaskGuidance } from "../../game/simulation/systems/progression";
import type { CraftRecipe, GameState, InventoryCost, OreId, PowerDropId, RunResult, ShipId, TaskGuidanceState, UnlockId, UpgradeId, UpgradeState, WeaponId } from "../../game/simulation/types";

interface HudHandlers {
  sameSeed: () => void;
  newRun: () => void;
  buyUpgrade: (id: UpgradeId) => UpgradeState;
  buyUnlock: (id: UnlockId) => UpgradeState;
  equipWeapon: (id: WeaponId) => UpgradeState;
  equipShip: (id: ShipId) => UpgradeState;
  craftObjective: () => UpgradeState;
  resume: () => void;
  closeSummary: (result: RunResult | null) => void;
}

interface PickupToastState {
  element: HTMLElement;
  count: number;
  removeTimer: number;
  leaveTimer: number | null;
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
  private lastTaskSignature = "";
  private lastTaskRenderSignature = "";
  private lastCargoSignature = "";
  private lastBlastSignature = "";
  private lastShieldSignature = "";
  private lastAbilitySignature = "";
  private lastMissionIntroSignature = "";
  private lastPurchaseSignature = "";
  private readonly nodeCache = new Map<string, HTMLElement | null>();
  private activeServiceTab: "upgrades" | "unlocks" | "contract" = "upgrades";
  private lastSummaryProgress: UpgradeState | null = null;
  private pickupToastSerial = 0;
  private readonly pickupToasts = new Map<string, PickupToastState>();

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
          <div class="slot-row">
            <div class="slot"><span class="slot-key">MBL</span><span class="slot-name">DRILL</span></div>
            <div class="slot blast" data-slot="blast">
              <span class="slot-key">MBR</span>
              <span class="slot-name">BLAST</span>
              <span class="charge-pips" data-value="blast-pips"></span>
              <span class="charge-timer" data-value="blast-timer"></span>
            </div>
            <div class="slot shield" data-slot="shield"><span class="slot-key">SPACE</span><span class="slot-name">SHIELD</span><span class="charge-timer" data-value="shield-state"></span></div>
            <div class="slot" data-slot="dash"><span class="slot-key">SHIFT</span><span class="slot-name">DASH</span></div>
            <div class="slot"><span class="slot-key">E</span><span class="slot-name">STORE</span></div>
          </div>
        </div>

        <div class="mission-intro is-hidden" data-panel="mission-intro">
          <div class="mission-kicker" data-value="mission-territory"></div>
          <div class="mission-title" data-value="mission-title"></div>
          <div class="mission-loadout" data-value="mission-loadout"></div>
          <div class="mission-first" data-value="mission-first"></div>
        </div>

        <div class="hud-task" data-panel="task">
          <div class="task-header">
            <span data-value="task-name">Mission</span>
            <b data-value="task-meta"></b>
          </div>
          <div class="task-next" data-value="task-next">Find ore</div>
          <div class="task-progress-live" data-value="task-progress"></div>
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
        <div class="purchase-hint is-hidden" data-panel="purchase-hint">
          <span data-value="purchase-kicker">SERVICE BAY READY</span>
          <b data-value="purchase-title"></b>
          <em data-value="purchase-action"></em>
        </div>
        <div class="pickup-toast-stack" data-panel="pickup-toasts"></div>
        
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

    this.renderAbilitySlots(state);
    this.renderBlastCharges(state);
    this.renderShieldState(state);
    this.renderMissionIntro(state);
    this.renderPurchaseHint(progress, this.runSummaryVisible);

    // Calculate current cargo value/score
    const cargoValue = 
      state.inventory.ferrite * ORE_CONFIG.ferrite.value +
      state.inventory.shimmer * ORE_CONFIG.shimmer.value +
      state.inventory.voltaic * ORE_CONFIG.voltaic.value +
      state.inventory.aetherium * ORE_CONFIG.aetherium.value;
    
    setText(this.root, "score", `${cargoValue}`);

    const cargoSignature = `${state.inventory.shimmer}|${state.inventory.voltaic}|${state.inventory.aetherium}|${state.inventory.ferrite}`;
    if (cargoSignature !== this.lastCargoSignature) {
      this.lastCargoSignature = cargoSignature;
      const shimNode = this.getNode(".hud-indicators .shimmer");
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

    }

    const bossPanel = this.getNode('[data-panel="boss"]');
    if (bossPanel) {
      bossPanel.classList.toggle("is-hidden", !state.boss.active || state.boss.defeated);
    }
    setWidth(this.root, "boss", state.boss.maxHealth > 0 ? state.boss.health / state.boss.maxHealth : 0);
    setText(this.root, "boss", `${Math.ceil(state.boss.health)}`);

    this.renderTaskHud(progress, {
      cargoValue,
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

  private getNode<T extends HTMLElement = HTMLElement>(selector: string): T | null {
    if (!this.nodeCache.has(selector)) {
      this.nodeCache.set(selector, this.root.querySelector<T>(selector));
    }
    return this.nodeCache.get(selector) as T | null;
  }

  showPickupToast(kind: "ore" | "power", id: OreId | PowerDropId): void {
    const stack = this.root.querySelector<HTMLElement>('[data-panel="pickup-toasts"]');
    if (!stack) {
      return;
    }

    const key = `${kind}:${id}`;
    const existing = this.pickupToasts.get(key);
    if (existing && existing.element.isConnected) {
      existing.count += 1;
      this.updatePickupToastContent(existing.element, kind, id, existing.count);
      existing.element.classList.remove("is-leaving", "is-updated");
      void existing.element.offsetWidth;
      existing.element.classList.add("is-updated");
      window.clearTimeout(existing.removeTimer);
      if (existing.leaveTimer !== null) {
        window.clearTimeout(existing.leaveTimer);
        existing.leaveTimer = null;
      }
      existing.removeTimer = this.schedulePickupToastRemoval(key, existing);
      stack.prepend(existing.element);
      return;
    }

    const toast = document.createElement("div");
    const serial = this.pickupToastSerial += 1;
    toast.className = `pickup-toast ${kind}`;
    toast.dataset.toast = `${serial}`;
    toast.dataset.toastKey = key;
    this.updatePickupToastContent(toast, kind, id, 1);

    stack.prepend(toast);
    const toastState: PickupToastState = {
      element: toast,
      count: 1,
      removeTimer: 0,
      leaveTimer: null
    };
    toastState.removeTimer = this.schedulePickupToastRemoval(key, toastState);
    this.pickupToasts.set(key, toastState);

    while (stack.children.length > 4) {
      const last = stack.lastElementChild as HTMLElement | null;
      if (!last) {
        break;
      }
      this.removePickupToastState(last.dataset.toastKey ?? "");
      last.remove();
    }
  }

  showEnemyTakedownToast(enemyName: string): void {
    const stack = this.root.querySelector<HTMLElement>('[data-panel="pickup-toasts"]');
    if (!stack) {
      return;
    }

    const label = enemyName.trim();
    if (!label) {
      return;
    }

    const key = `enemy:${label.toLowerCase()}`;
    const existing = this.pickupToasts.get(key);
    if (existing && existing.element.isConnected) {
      existing.count += 1;
      this.updateEnemyTakedownToastContent(existing.element, label, existing.count);
      existing.element.classList.remove("is-leaving", "is-updated");
      void existing.element.offsetWidth;
      existing.element.classList.add("is-updated");
      window.clearTimeout(existing.removeTimer);
      if (existing.leaveTimer !== null) {
        window.clearTimeout(existing.leaveTimer);
        existing.leaveTimer = null;
      }
      existing.removeTimer = this.schedulePickupToastRemoval(key, existing);
      stack.prepend(existing.element);
      return;
    }

    const toast = document.createElement("div");
    const serial = this.pickupToastSerial += 1;
    toast.className = "pickup-toast enemy";
    toast.dataset.toast = `${serial}`;
    toast.dataset.toastKey = key;
    this.updateEnemyTakedownToastContent(toast, label, 1);

    stack.prepend(toast);
    const toastState: PickupToastState = {
      element: toast,
      count: 1,
      removeTimer: 0,
      leaveTimer: null
    };
    toastState.removeTimer = this.schedulePickupToastRemoval(key, toastState);
    this.pickupToasts.set(key, toastState);

    while (stack.children.length > 4) {
      const last = stack.lastElementChild as HTMLElement | null;
      if (!last) {
        break;
      }
      this.removePickupToastState(last.dataset.toastKey ?? "");
      last.remove();
    }
  }

  private updatePickupToastContent(toast: HTMLElement, kind: "ore" | "power", id: OreId | PowerDropId, count: number): void {
    const amount = count > 1 ? count : 1;
    toast.innerHTML = kind === "ore"
      ? `${oreIcon(id as OreId)}<span><b>${escapeHtml(ORE_CONFIG[id as OreId].label)}</b><em>Collected +${amount}</em></span>`
      : `${powerIcon(id as PowerDropId)}<span><b>${powerDropLabel(id as PowerDropId)}</b><em>${powerDropDetail(id as PowerDropId)} +${amount}</em></span>`;
  }

  private updateEnemyTakedownToastContent(toast: HTMLElement, enemyName: string, count: number): void {
    const suffix = count > 1 ? ` +${count}` : "";
    toast.innerHTML = `${enemyIcon()}<span><b>${escapeHtml(enemyName)}</b><em>Takedown${suffix}</em></span>`;
  }

  private schedulePickupToastRemoval(key: string, toastState: PickupToastState): number {
    return window.setTimeout(() => {
      toastState.element.classList.add("is-leaving");
      toastState.leaveTimer = window.setTimeout(() => {
        toastState.element.remove();
        this.pickupToasts.delete(key);
      }, 260);
    }, 1500);
  }

  private removePickupToastState(key: string): void {
    const toastState = this.pickupToasts.get(key);
    if (!toastState) {
      return;
    }

    window.clearTimeout(toastState.removeTimer);
    if (toastState.leaveTimer !== null) {
      window.clearTimeout(toastState.leaveTimer);
    }
    this.pickupToasts.delete(key);
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
    if (action === "close-summary") {
      const activeResult = this.root.querySelector<HTMLElement>('[data-panel="summary"]')?.dataset.result;
      this.handlers.closeSummary(activeResult ? JSON.parse(activeResult) as RunResult : null);
    }
    if (action === "resume") {
      this.handlers.resume();
    }
    if (action === "service-tab") {
      const tab = button.dataset.tab as HudController["activeServiceTab"] | undefined;
      if (tab) {
        this.activeServiceTab = tab;
        const activeResult = this.root.querySelector<HTMLElement>('[data-panel="summary"]')?.dataset.result;
        if (activeResult && this.lastSummaryProgress) {
          const result = JSON.parse(activeResult) as RunResult;
          this.renderSummary(result, this.lastSummaryProgress);
        }
      }
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
    if (action === "unlock") {
      const id = button.dataset.unlock as UnlockId | undefined;
      if (id) {
        const progress = this.handlers.buyUnlock(id);
        const activeResult = this.root.querySelector<HTMLElement>('[data-panel="summary"]')?.dataset.result;
        if (activeResult) {
          const result = JSON.parse(activeResult) as RunResult;
          this.renderSummary(result, progress);
        }
      }
    }
    if (action === "equip-weapon") {
      const id = button.dataset.weapon as WeaponId | undefined;
      if (id) {
        const progress = this.handlers.equipWeapon(id);
        const activeResult = this.root.querySelector<HTMLElement>('[data-panel="summary"]')?.dataset.result;
        if (activeResult) {
          const result = JSON.parse(activeResult) as RunResult;
          this.renderSummary(result, progress);
        }
      }
    }
    if (action === "equip-ship") {
      const id = button.dataset.ship as ShipId | undefined;
      if (id) {
        const progress = this.handlers.equipShip(id);
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

  private renderBlastCharges(state: GameState): void {
    const unlocked = state.upgrades.purchasedUnlocks.includes("swarmBlast");
    const signature = `${unlocked}|${state.player.blastCharges}|${Math.ceil(state.player.blastRechargeTimer)}|${state.player.blastRepeatCooldown > 0}`;
    if (signature === this.lastBlastSignature) {
      return;
    }
    this.lastBlastSignature = signature;

    const slot = this.getNode('[data-slot="blast"]');
    const pips = this.getNode('[data-value="blast-pips"]');
    const timer = this.getNode('[data-value="blast-timer"]');
    if (!slot || !pips || !timer) {
      return;
    }

    slot.classList.toggle("is-hidden", !unlocked);
    slot.classList.toggle("is-locked", unlocked && state.player.blastCharges === 0);
    slot.classList.toggle("is-cooling", state.player.blastRepeatCooldown > 0);
    pips.innerHTML = Array.from({ length: 3 }, (_, index) => {
      const active = index < state.player.blastCharges ? "is-active" : "";
      return `<i class="${active}"></i>`;
    }).join("");
    timer.textContent = state.player.blastCharges === 0 ? `${Math.ceil(state.player.blastRechargeTimer)}s` : "";
  }

  private renderShieldState(state: GameState): void {
    const unlocked = state.upgrades.purchasedUnlocks.includes("shieldEmitter");
    const signature = `${unlocked}|${state.player.shieldActiveTimer > 0}|${Math.ceil(state.player.shieldCooldown)}|${Math.ceil(state.player.shield)}`;
    if (signature === this.lastShieldSignature) {
      return;
    }
    this.lastShieldSignature = signature;

    const slot = this.getNode('[data-slot="shield"]');
    const stateNode = this.getNode('[data-value="shield-state"]');
    if (!slot || !stateNode) {
      return;
    }

    slot.classList.toggle("is-hidden", !unlocked);
    slot.classList.toggle("is-locked", !unlocked);
    slot.classList.toggle("is-cooling", unlocked && state.player.shieldCooldown > 0);
    if (!unlocked) {
      stateNode.textContent = "LOCK";
    } else if (state.player.shieldActiveTimer > 0) {
      stateNode.textContent = "ON";
    } else if (state.player.shieldCooldown > 0) {
      stateNode.textContent = `${Math.ceil(state.player.shieldCooldown)}s`;
    } else {
      stateNode.textContent = `${Math.ceil(state.player.shield)}`;
    }
  }

  private renderAbilitySlots(state: GameState): void {
    const signature = `${state.upgrades.purchasedUnlocks.includes("dashModule")}`;
    if (signature === this.lastAbilitySignature) {
      return;
    }
    this.lastAbilitySignature = signature;
    const dash = this.getNode('[data-slot="dash"]');
    dash?.classList.toggle("is-hidden", !state.upgrades.purchasedUnlocks.includes("dashModule"));
  }

  private renderMissionIntro(state: GameState): void {
    const panel = this.getNode('[data-panel="mission-intro"]');
    const territory = this.getNode('[data-value="mission-territory"]');
    const title = this.getNode('[data-value="mission-title"]');
    const loadout = this.getNode('[data-value="mission-loadout"]');
    const first = this.getNode('[data-value="mission-first"]');
    const task = getActiveTask(state.upgrades);
    if (!panel || !territory || !title || !loadout || !first || !task || !state.upgrades.activeTask) {
      panel?.classList.add("is-hidden");
      this.lastMissionIntroSignature = "";
      return;
    }

    const guidance = getTaskGuidance(state.upgrades, task, {
      cargoValue: 0,
      threatMood: state.threat.mood,
      bossActive: state.boss.active,
      bossDefeated: state.boss.defeated
    });
    const visible = state.mission.introTimer > 0 && state.status === "playing";
    const signature = `${visible}|${task.id}|${guidance.nextAction}`;
    if (signature !== this.lastMissionIntroSignature) {
      this.lastMissionIntroSignature = signature;
      territory.textContent = TERRITORY_CONFIG[task.territory].label.toUpperCase();
      title.textContent = task.label.replace("Org Order: ", "");
      loadout.innerHTML = task.requirements
        .filter((requirement) => requirement.kind === "collect")
        .map((requirement) => `<span class="mission-material">${oreIcon(requirement.ore)}<b>${requirement.amount}</b></span>`)
        .join("");
      first.textContent = guidance.nextAction;
      panel.classList.toggle("is-hidden", !visible || title.textContent.trim().length === 0);
    }
  }

  private renderPurchaseHint(progress: UpgradeState, serviceBayOpen: boolean): void {
    const panel = this.getNode('[data-panel="purchase-hint"]');
    const title = this.getNode('[data-value="purchase-title"]');
    const action = this.getNode('[data-value="purchase-action"]');
    if (!panel || !title || !action) {
      return;
    }

    const suggestion = findPurchaseSuggestion(progress);
    if (!suggestion) {
      panel.classList.add("is-hidden");
      this.lastPurchaseSignature = "";
      return;
    }

    const signature = `${serviceBayOpen}|${suggestion.kind}|${suggestion.title}`;
    if (signature === this.lastPurchaseSignature) {
      return;
    }
    this.lastPurchaseSignature = signature;
    panel.classList.remove("is-hidden");
    panel.classList.toggle("is-service-open", serviceBayOpen);
    panel.classList.toggle("is-unlock", suggestion.kind === "unlock");
    title.textContent = suggestion.title;
    action.textContent = serviceBayOpen ? suggestion.serviceAction : suggestion.fieldAction;
  }

  private renderSummary(result: RunResult, progress: UpgradeState): void {
    const panel = this.root.querySelector<HTMLElement>('[data-panel="summary"]');
    if (!panel) {
      return;
    }

    panel.dataset.result = JSON.stringify(result);
    this.lastSummaryProgress = progress;
    this.renderPurchaseHint(progress, true);
    const outcome = result.outcome === "destroyed" ? "SHIP LOST" : result.mode === "store" ? "STORE DOCKED" : "CARGO BANKED";
    const creditedValue = result.outcome === "destroyed" ? 0 : result.creditsEarned;
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
        const materials = upgradeMaterialCost(id, level);
        const maxed = level >= config.maxLevel;
        const disabled = maxed || progress.credits < cost || !canPayMaterials(progress.stockpile, materials) ? "disabled" : "";
        const price = maxed ? "MAX" : `${cost}c`;
        const label = upgradeDisplayLabel(id, config.label);
        const before = Math.round((level / config.maxLevel) * 100);
        const after = Math.round((Math.min(config.maxLevel, level + 1) / config.maxLevel) * 100);
        return `
          <button class="upgrade-node ${id}" type="button" data-action="upgrade" data-upgrade="${id}" ${disabled}>
            ${moduleIcon(id)}
            <span class="node-copy"><b>${label}</b><em>L${level} / ${config.maxLevel}</em></span>
            <span class="upgrade-materials">${renderMaterialCost(materials, progress.stockpile)}</span>
            <span class="node-bars">
              <i style="--value:${before}%"></i>
              <i class="after" style="--value:${after}%"></i>
            </span>
            <strong>${price}</strong>
          </button>
        `;
      })
      .join("");
    const unlocks = renderUnlockShop(progress);
    const weapons = renderWeaponBay(progress);
    const ships = renderShipBay(progress);
    const tab = this.activeServiceTab;
    const tabContent = tab === "upgrades"
      ? `
        <div class="run-grid compact">
          ${rows.map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`).join("")}
        </div>
        <div class="upgrade-grid compact">${upgrades}</div>
      `
      : tab === "unlocks"
        ? `
          <div class="ship-bay compact">
            <div class="bay-label">Hewers</div>
            <div class="ship-grid">${ships}</div>
          </div>
          <div class="unlock-bay compact">
            <div class="bay-label">Unlocks</div>
            <div class="unlock-grid">${unlocks}</div>
          </div>
          <div class="weapon-bay compact">
            <div class="bay-label">Weapons</div>
            <div class="weapon-grid">${weapons}</div>
          </div>
        `
        : `
          <div class="summary-task">
            <b>${task?.label ?? "No active org order"}</b>
            <span>${escapeHtml(guidance.nextAction)}</span>
            ${renderStepList(guidance, "summary-step-list")}
          </div>
          <div class="service-lower compact">
            <div class="workshop-bay">
              <div class="bay-label">Workshop</div>
              <b>${recipe?.label ?? "No recipe queued"}</b>
              <div class="material-sockets">${recipe ? renderMaterialSockets(recipe, progress) : ""}</div>
              ${craftButton || `<button class="workshop-action" type="button" disabled>${progress.activeTask?.completed ? "Order complete" : "No craft available"}</button>`}
            </div>
            <div class="exchange-bay">
              <div class="bay-label">Cargo Exchange</div>
              <b>${result.outcome === "destroyed" ? "No transfer" : "Store transfer complete"}</b>
              <div class="exchange-total"><span>Run cargo</span><strong>${creditedValue}c</strong></div>
              <div class="exchange-total"><span>Voltrix core</span><strong>${result.voltrixCore ? "+220c" : "none"}</strong></div>
            </div>
          </div>
        `;

    panel.innerHTML = `
      <button class="summary-close" type="button" data-action="close-summary" aria-label="Close summary">X</button>
      <div class="service-console">
        <aside class="service-bank">
          <div class="bank-title">${outcome}</div>
          <div class="bank-readout">
            <span>Run credit</span>
            <b>+${creditedValue}</b>
          </div>
          <div class="bank-readout">
            <span>Account</span>
            <b>${progress.credits}</b>
          </div>
          <div class="bank-stockpile">
            ${renderStockpileRows(progress)}
          </div>
          <div class="bank-cargo">
            ${renderCargoRows(result)}
          </div>
          <div class="bank-stamp">${result.outcome === "destroyed" ? "Cargo lost" : result.mode === "store" ? "Cargo sold" : "Cargo credited"}</div>
        </aside>

        <section class="service-main">
          <div class="service-tabs">
            <button type="button" data-action="service-tab" data-tab="upgrades" class="${tab === "upgrades" ? "is-active" : ""}">Upgrades</button>
            <button type="button" data-action="service-tab" data-tab="unlocks" class="${tab === "unlocks" ? "is-active" : ""}">Unlocks</button>
            <button type="button" data-action="service-tab" data-tab="contract" class="${tab === "contract" ? "is-active" : ""}">Contract</button>
          </div>
          ${tabContent}
        </section>
      </div>
      <div class="run-actions">
        ${result.mode === "store" ? `<button type="button" data-action="close-summary">Resume Run</button>` : `<button type="button" data-action="same-seed">Same Seed</button>`}
        <button type="button" data-action="new-run">New Run</button>
      </div>
    `;
  }

  private renderTaskHud(progress: UpgradeState, options: Parameters<typeof getTaskGuidance>[2]): void {
    const panel = this.getNode('[data-panel="task"]');
    const name = this.getNode('[data-value="task-name"]');
    const next = this.getNode('[data-value="task-next"]');
    const meta = this.getNode('[data-value="task-meta"]');
    const progressLine = this.getNode('[data-value="task-progress"]');
    const steps = this.getNode('[data-value="task-steps"]');
    const task = getActiveTask(progress);

    if (!panel || !name || !next || !meta || !progressLine || !steps || !task || !progress.activeTask) {
      panel?.classList.add("is-hidden");
      return;
    }

    const guidance = getTaskGuidance(progress, task, options);
    panel.classList.remove("is-hidden");
    panel.classList.toggle("is-ready", guidance.isCraftReady || guidance.isBankReady);
    panel.classList.toggle("is-danger", Boolean(guidance.bossCue && options?.threatMood !== "quiet"));
    const signature = guidance.stepStates.map((step) => `${step.label}:${step.current}/${step.target}:${step.complete}`).join("|");
    const renderSignature = `${guidance.label}|${guidance.nextAction}|${currentProgressLine(guidance)}|${task.territory}|${task.mapVariant}|${signature}`;
    if (renderSignature !== this.lastTaskRenderSignature) {
      this.lastTaskRenderSignature = renderSignature;
      name.textContent = guidance.label;
      next.textContent = guidance.nextAction;
      progressLine.textContent = currentProgressLine(guidance);
      meta.textContent = `${TERRITORY_CONFIG[task.territory].label} / ${task.mapVariant}`;
      steps.innerHTML = renderObjectiveChips(guidance);
    }
    if (this.lastTaskSignature && signature !== this.lastTaskSignature) {
      panel.classList.remove("is-progress-pulse");
      void panel.offsetWidth;
      panel.classList.add("is-progress-pulse");
    }
    this.lastTaskSignature = signature;
  }

}

function setWidth(root: HTMLElement, key: string, value: number): void {
  const node = root.querySelector<HTMLElement>(`[data-meter="${key}"]`);
  if (node) {
    const width = `${Math.max(0, Math.min(1, value)) * 100}%`;
    if (node.style.width !== width) {
      node.style.width = width;
    }
  }
}

function setText(root: HTMLElement, key: string, value: string): void {
  const node = root.querySelector<HTMLElement>(`[data-value="${key}"]`);
  if (node && node.textContent !== value) {
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

function currentProgressLine(guidance: TaskGuidanceState): string {
  const active = guidance.stepStates.find((step) => !step.complete);
  if (!active) {
    return "Contract ready to complete";
  }
  return `${active.label} ${active.current}/${active.target}`;
}

function renderCargoRows(result: RunResult): string {
  return (Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>)
    .map((ore) => {
      const count = result.inventory[ore];
      return `<div>${oreIcon(ore)}<b>${count}</b><i>${count * ORE_CONFIG[ore].value}c</i></div>`;
    })
    .join("");
}

function renderStockpileRows(progress: UpgradeState): string {
  return (Object.keys(ORE_CONFIG) as Array<keyof typeof ORE_CONFIG>)
    .map((ore) => `<div>${oreIcon(ore)}<b>${progress.stockpile[ore]}</b></div>`)
    .join("");
}

function renderMaterialCost(costs: InventoryCost, stockpile: UpgradeState["stockpile"]): string {
  return (Object.entries(costs) as Array<[keyof typeof ORE_CONFIG, number]>)
    .filter(([, amount]) => amount > 0)
    .map(([ore, amount]) => {
      const ready = stockpile[ore] >= amount ? "ready" : "missing";
      return `<i class="${ready}">${oreIcon(ore)}${stockpile[ore]}/${amount}</i>`;
    })
    .join("");
}

function canPayMaterials(stockpile: UpgradeState["stockpile"], costs: InventoryCost): boolean {
  return (Object.entries(costs) as Array<[keyof typeof ORE_CONFIG, number]>)
    .every(([ore, amount]) => stockpile[ore] >= amount);
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

function renderUnlockShop(progress: UpgradeState): string {
  return (Object.keys(UNLOCK_CONFIG) as UnlockId[])
    .map((id) => {
      const config = UNLOCK_CONFIG[id];
      const purchased = progress.purchasedUnlocks.includes(id);
      const shopUnlocked = progress.unlockedShopItems.includes(id);
      const taskReady = !config.requiresTask || progress.completedTasks.includes(config.requiresTask);
      const canBuy = shopUnlocked && taskReady && !purchased && progress.credits >= config.cost;
      const disabled = purchased || !canBuy ? "disabled" : "";
      const state = purchased ? "OWNED" : !shopUnlocked || !taskReady ? "GATED" : `${config.cost}c`;
      return `
        <button class="unlock-node ${purchased ? "is-owned" : ""}" type="button" data-action="unlock" data-unlock="${id}" ${disabled}>
          ${moduleIcon(id)}
          <b>${escapeHtml(config.label)}</b>
          <strong>${state}</strong>
        </button>
      `;
    })
    .join("");
}

function renderWeaponBay(progress: UpgradeState): string {
  return (Object.keys(WEAPON_CONFIG) as WeaponId[])
    .map((id) => {
      const config = WEAPON_CONFIG[id];
      const owned = !config.unlock || progress.purchasedUnlocks.includes(config.unlock);
      const active = progress.equippedWeapon === id;
      const disabled = !owned || active ? "disabled" : "";
      return `
        <button class="weapon-node ${active ? "is-active" : ""}" type="button" data-action="equip-weapon" data-weapon="${id}" ${disabled}>
          ${moduleIcon(id)}
          <b>${escapeHtml(config.label)}</b>
          <strong>${active ? "EQUIPPED" : owned ? "EQUIP" : "LOCKED"}</strong>
        </button>
      `;
    })
    .join("");
}

function renderShipBay(progress: UpgradeState): string {
  return (Object.keys(SHIP_CONFIG) as ShipId[])
    .map((id) => {
      const config = SHIP_CONFIG[id];
      const owned = progress.unlockedShips.includes(id);
      const active = progress.equippedShip === id;
      const disabled = !owned || active ? "disabled" : "";
      const state = active ? "ACTIVE" : owned ? "EQUIP" : shipUnlockLabel(config.unlockTask);
      return `
        <button class="ship-node ${active ? "is-active" : ""} ${owned ? "is-owned" : ""}" type="button" data-action="equip-ship" data-ship="${id}" ${disabled}>
          ${shipIcon(id)}
          <span><b>${config.mk} ${escapeHtml(config.label)}</b><em>${escapeHtml(config.description)}</em></span>
          <strong>${state}</strong>
        </button>
      `;
    })
    .join("");
}

function shipUnlockLabel(taskId: string | undefined): string {
  if (taskId === "sv-relay-frame") {
    return "RELAY";
  }
  if (taskId === "sv-voltaic-keystone") {
    return "KEYSTONE";
  }
  return "LOCKED";
}

function shipIcon(id: ShipId): string {
  return `<span class="ship-token ${id}" aria-hidden="true"><i></i><b></b></span>`;
}

interface PurchaseSuggestion {
  kind: "unlock" | "upgrade";
  title: string;
  fieldAction: string;
  serviceAction: string;
}

function findPurchaseSuggestion(progress: UpgradeState): PurchaseSuggestion | null {
  const unlockPriority: UnlockId[] = ["dashModule", "shieldEmitter", "swarmBlast", "piercerWeapon", "scatterWeapon"];
  for (const id of unlockPriority) {
    const config = UNLOCK_CONFIG[id];
    const taskReady = !config.requiresTask || progress.completedTasks.includes(config.requiresTask);
    if (
      progress.unlockedShopItems.includes(id) &&
      taskReady &&
      !progress.purchasedUnlocks.includes(id) &&
      progress.credits >= config.cost
    ) {
      return {
        kind: "unlock",
        title: `${config.label} available to unlock`,
        fieldAction: "Store to install",
        serviceAction: "Buy in Unlocks"
      };
    }
  }

  const upgradePriority: UpgradeId[] = ["laserPower", "heatSink", "engine", "magnetRadius", "hull"];
  for (const id of upgradePriority) {
    const config = UPGRADE_CONFIG[id];
    const level = progress[id];
    if (level >= config.maxLevel) {
      continue;
    }

    const cost = upgradeCost(id, level);
    const materials = upgradeMaterialCost(id, level);
    if (progress.credits >= cost && canPayMaterials(progress.stockpile, materials)) {
      return {
        kind: "upgrade",
        title: `${upgradeDisplayLabel(id, config.label)} upgrade available`,
        fieldAction: "Store to fit",
        serviceAction: "Buy in Upgrades"
      };
    }
  }

  return null;
}

function moduleIcon(id: UpgradeId | UnlockId | WeaponId): string {
  const paths: Record<string, string> = {
    laserPower: `<path d="M4 12h10"/><path d="m14 6 6 6-6 6"/><path d="M5 5 3 7"/><path d="M5 19 3 17"/>`,
    heatSink: `<path d="M8 3v10a4 4 0 1 0 8 0V3"/><path d="M8 7h8"/><path d="M8 11h8"/>`,
    magnetRadius: `<path d="M6 4v7a6 6 0 0 0 12 0V4"/><path d="M6 4h4"/><path d="M14 4h4"/><path d="M6 12H3"/><path d="M21 12h-3"/>`,
    hull: `<path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/><path d="M12 7v10"/>`,
    engine: `<path d="M12 2c3 3 5 6 5 10a5 5 0 0 1-10 0c0-4 2-7 5-10Z"/><path d="M9 17c-1 1.3-1.5 2.6-1.5 4"/><path d="M15 17c1 1.3 1.5 2.6 1.5 4"/>`,
    dashModule: `<path d="M4 12h10"/><path d="m13 5 7 7-7 7"/><path d="M4 6h4"/><path d="M4 18h4"/>`,
    shieldEmitter: `<path d="M12 3 20 7v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/><path d="M9 12h6"/>`,
    swarmBlast: `<circle cx="7" cy="8" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="12" cy="16" r="2"/><path d="M9 9.5 11 14"/><path d="m14.5 8.5-2 5.5"/>`,
    piercerWeapon: `<path d="M3 12h12"/><path d="m14 5 7 7-7 7"/><path d="M6 7h4"/><path d="M6 17h4"/>`,
    scatterWeapon: `<path d="M4 12h6"/><path d="m10 12 8-6"/><path d="m10 12 8 6"/><path d="m10 12h10"/>`,
    drillShot: `<path d="m14 4 6 6-8 8-6-6 8-8Z"/><path d="m4 20 4-4"/><path d="m12 6 6 6"/>`,
    piercer: `<path d="M3 12h12"/><path d="m14 5 7 7-7 7"/><path d="M7 9h4"/><path d="M7 15h4"/>`,
    scatter: `<path d="M4 12h6"/><path d="m10 12 8-6"/><path d="m10 12 8 6"/><path d="m10 12h10"/>`
  };
  return `<span class="module-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${paths[id] ?? paths.laserPower}</svg></span>`;
}

function renderOreCount(ore: keyof typeof ORE_CONFIG, count: number): string {
  return `${oreIcon(ore)}<b>${count}</b>`;
}

function oreIcon(ore: keyof typeof ORE_CONFIG): string {
  return `<span class="ore-art ${ore}" aria-label="${escapeHtml(ORE_CONFIG[ore].label)}"></span>`;
}

function powerIcon(power: PowerDropId): string {
  return `<span class="power-art ${power}" aria-label="${escapeHtml(powerDropLabel(power))}"></span>`;
}

function enemyIcon(): string {
  return `<span class="enemy-art" aria-hidden="true"></span>`;
}

function powerDropLabel(power: PowerDropId): string {
  if (power === "repairPack") {
    return "Repair Pack";
  }
  if (power === "coolantCell") {
    return "Coolant Cell";
  }
  if (power === "overdriveCell") {
    return "Overdrive Cell";
  }
  return "Shield Cell";
}

function powerDropDetail(power: PowerDropId): string {
  if (power === "repairPack") {
    return "Hull restored";
  }
  if (power === "coolantCell") {
    return "Heat dumped";
  }
  if (power === "overdriveCell") {
    return "Weapon boosted";
  }
  return "Shield refilled";
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
