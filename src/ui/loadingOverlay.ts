interface LoadingOverlay {
  root: HTMLDivElement;
  title: HTMLDivElement;
  detail: HTMLDivElement;
  meter: HTMLSpanElement;
}

let loadingOverlay: LoadingOverlay | null = null;

export function showLoadingOverlay(title: string, detail = "0%"): void {
  const overlay = ensureLoadingOverlay();
  if (!overlay) {
    return;
  }

  overlay.title.textContent = title;
  overlay.detail.textContent = detail;
  overlay.root.classList.remove("is-hidden");
}

export function updateLoadingOverlay(title: string, progress: number): void {
  const overlay = ensureLoadingOverlay();
  if (!overlay) {
    return;
  }

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  overlay.title.textContent = title;
  overlay.detail.textContent = `${percent}%`;
  overlay.meter.style.setProperty("--value", `${percent}%`);
  overlay.root.classList.remove("is-hidden");
}

export function hideLoadingOverlay(): void {
  if (!loadingOverlay) {
    return;
  }

  loadingOverlay.root.classList.add("is-hidden");
}

function ensureLoadingOverlay(): LoadingOverlay | null {
  if (loadingOverlay?.root.isConnected) {
    return loadingOverlay;
  }

  const app = document.querySelector<HTMLElement>("#app");
  if (!app) {
    return null;
  }

  const root = document.createElement("div");
  root.className = "loading-overlay";

  const panel = document.createElement("div");
  panel.className = "loading-panel";

  const kicker = document.createElement("div");
  kicker.className = "loading-kicker";
  kicker.textContent = "HEWER FIELD SYSTEM";

  const title = document.createElement("div");
  title.className = "loading-title";

  const rail = document.createElement("div");
  rail.className = "loading-rail";
  const meter = document.createElement("span");
  meter.style.setProperty("--value", "0%");
  rail.appendChild(meter);

  const detail = document.createElement("div");
  detail.className = "loading-detail";

  panel.append(kicker, title, rail, detail);
  root.appendChild(panel);
  app.appendChild(root);

  loadingOverlay = { root, title, detail, meter };
  return loadingOverlay;
}
