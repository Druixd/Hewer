import type { BlockId, EnemyId, OreId, TerritoryId } from "../simulation/types";

export const TEXTURES = {
  ship: "ship.pickaxe",
  shipGlow: "ship.pickaxe.glow",
  reticle: "ui.reticle",
  pickup: (ore: OreId) => `pickup.${ore}`,
  tile: (block: BlockId, territory: TerritoryId = "shimmerVeins", cracked = false, variant = 0) => `tile.${territory}.${block}.v${variant}${cracked ? ".cracked" : ""}`,
  enemy: (enemy: EnemyId) => `enemy.${enemy}`,
  bossHead: "boss.voltrix.head",
  bossSegment: "boss.voltrix.segment",
  particleWhite: "fx.particle.white",
  particleCyan: "fx.particle.cyan",
  particleAmber: "fx.particle.amber",
  particleMagenta: "fx.particle.magenta",
  bombCore: "fx.bomb.swarm.core"
} as const;
