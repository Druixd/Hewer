import type { BlockId, EnemyId, OreId } from "../simulation/types";

export const TEXTURES = {
  ship: "ship.pickaxe",
  shipGlow: "ship.pickaxe.glow",
  reticle: "ui.reticle",
  pickup: (ore: OreId) => `pickup.${ore}`,
  tile: (block: BlockId) => `tile.${block}`,
  enemy: (enemy: EnemyId) => `enemy.${enemy}`,
  bossHead: "boss.voltrix.head",
  bossSegment: "boss.voltrix.segment",
  particleWhite: "fx.particle.white",
  particleCyan: "fx.particle.cyan",
  particleAmber: "fx.particle.amber",
  particleMagenta: "fx.particle.magenta"
} as const;

