import { createWarehouse, type Warehouse } from './layout';
import type { LevelConfig } from './level';

/** Everything static during a run: the floor plan and the level being played. */
export interface World {
  readonly warehouse: Warehouse;
  readonly level: LevelConfig;
}

export function createWorld(level: LevelConfig): World {
  return { warehouse: createWarehouse(), level };
}
