import { TICKS_PER_SECOND } from './clock';
import type { LevelConfig } from './level';
import { createWorld, type World } from './world';

/** Five simulated minutes at 1x: a little longer than a real level. */
export const TEST_SHIFT_TICKS = 5 * 60 * TICKS_PER_SECOND;

interface TestLevelOptions {
  readonly seed?: number;
  readonly operators?: number;
  readonly durationTicks?: number;
  readonly scenario?: Partial<LevelConfig['scenario']>;
  readonly economy?: Partial<LevelConfig['economy']>;
}

/** A valid, already-parsed level for tests, so they do not depend on shipped level files. */
export function testLevel({
  seed = 1,
  operators = 1,
  durationTicks = TEST_SHIFT_TICKS,
  scenario,
  economy,
}: TestLevelOptions = {}): LevelConfig {
  return {
    id: 'test',
    title: 'Test',
    seed,
    shift: { startMinute: 6 * 60, endMinute: 14 * 60, durationTicks },
    team: { operators, hireDelayMinutes: 30 },
    scenario: {
      initialStock: 0.3,
      fragileRatio: 0,
      trucks: { count: 6, boxes: [2, 4], peaks: [] },
      orders: { count: 10, boxes: [1, 2], deadlineMinutes: [60, 120], peaks: [] },
      ...scenario,
    },
    economy: {
      startingWallet: 1000,
      hiringFee: 150,
      dismissalCost: 400,
      salaryPerHour: 10,
      orderRevenue: 100,
      penalties: { overdueOrder: 60, truckWaitPerHour: 30 },
      stars: [100, 500, 900],
      ...economy,
    },
  };
}

export function testWorld(options?: TestLevelOptions): World {
  return createWorld(testLevel(options));
}
