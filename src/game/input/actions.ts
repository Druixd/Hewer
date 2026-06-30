import type { InputActions } from "../simulation/types";

export function createEmptyActions(): InputActions {
  return {
    move: { x: 0, y: 0 },
    aim: { x: 0, y: 0 },
    primaryFire: false,
    secondaryAbility: false,
    toggleIntensityPressed: false,
    pausePressed: false,
    extractPressed: false
  };
}

