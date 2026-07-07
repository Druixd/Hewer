import Phaser from "phaser";
import "./styles.css";
import { BootScene } from "./phaser/scenes/BootScene";
import { GameplayScene } from "./phaser/scenes/GameplayScene";
import { HudController, setHudController } from "./ui/hud/HudController";
import { showLoadingOverlay } from "./ui/loadingOverlay";

const gameRoot = document.querySelector<HTMLDivElement>("#game-root");
const uiRoot = document.querySelector<HTMLDivElement>("#ui-root");

if (!gameRoot || !uiRoot) {
  throw new Error("HEWER root elements are missing.");
}

const hud = new HudController(uiRoot);
setHudController(hud);
showLoadingOverlay("CALIBRATING CAVE SCAN");

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  backgroundColor: "#06080f",
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  physics: {
    default: "arcade",
    arcade: {
      debug: false
    }
  },
  audio: {
    noAudio: true
  },
  input: {
    mouse: {
      target: gameRoot
    }
  },
  render: {
    antialias: false,
    antialiasGL: false,
    powerPreference: "high-performance",
    batchSize: 8192,
    pixelArt: true,
    roundPixels: true
  },
  scene: [BootScene, GameplayScene]
});

window.addEventListener("beforeunload", () => {
  game.destroy(true);
});

