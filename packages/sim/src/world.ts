import { createWarehouse, type Warehouse } from './layout';
import type { LevelConfig } from './level';
import { generateScenario, type Scenario } from './scenario';

/** Everything static during a run: the floor plan, the level, and the day it plans. */
export interface World {
  readonly warehouse: Warehouse;
  readonly level: LevelConfig;
  readonly scenario: Scenario;
}

export function createWorld(level: LevelConfig): World {
  const warehouse = createWarehouse();
  return { warehouse, level, scenario: generateScenario(level, warehouse.slots.length) };
}
