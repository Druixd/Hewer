import Phaser from "phaser";
import {
  BAKED_TEXTURE_PACK_URL,
  createGeneratedTextures,
  exportGeneratedTexturePack,
  generatedTextureKeys,
  type BakedTexturePack
} from "../boot/createTextures";
import { updateLoadingOverlay } from "../../ui/loadingOverlay";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    updateLoadingOverlay("CALIBRATING CAVE SCAN", 0.04);
    void this.prepareTextures();
  }

  private async prepareTextures(): Promise<void> {
    updateLoadingOverlay("FORGING FIELD TEXTURES", 0.12);
    await this.loadBakedTexturePack();
    createGeneratedTextures(this);
    updateLoadingOverlay("LOCKING TERRAIN ATLAS", 0.3);
    this.maybeExportTexturePack();
    this.scene.start("GameplayScene");
  }

  private async loadBakedTexturePack(): Promise<void> {
    if (!shouldLoadBakedTexturePack()) {
      return;
    }

    const pack = await fetchBakedTexturePack();
    if (!pack) {
      return;
    }

    const expectedKeys = new Set(generatedTextureKeys());
    let queued = 0;
    for (const [key, dataUri] of Object.entries(pack.textures)) {
      if (!expectedKeys.has(key) || this.textures.exists(key)) {
        continue;
      }
      this.load.image(key, dataUri);
      queued += 1;
    }

    if (queued === 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  private maybeExportTexturePack(): void {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("bakeTextures")) {
      return;
    }

    const pack = exportGeneratedTexturePack(this);
    const blob = new Blob([JSON.stringify(pack)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "texture-pack.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

function shouldLoadBakedTexturePack(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has("loadBakedTextures");
}

async function fetchBakedTexturePack(): Promise<BakedTexturePack | null> {
  try {
    const response = await fetch(BAKED_TEXTURE_PACK_URL, { cache: "force-cache" });
    if (!response.ok) {
      return null;
    }
    const pack = await response.json() as BakedTexturePack;
    return pack.version === 1 && pack.textures ? pack : null;
  } catch {
    return null;
  }
}
