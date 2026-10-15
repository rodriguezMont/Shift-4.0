import { TICKS_PER_SECOND } from './clock';
import type { LevelConfig } from './level';
import { createWorld, type World } from './world';

/** Five simulated minutes at 1x: a little longer than a real level. */
export const TEST_SHIFT_TICKS = 5 * 60 * TICKS_PER_SECOND;

interface TestLevelOptions {
  readonly seed?: number;
  readonly operators?: number;
  readonly durationTicks?: number;
}

/** A valid, already-parsed level for tests, so they do not depend on shipped level files. */
export function testLevel({
  seed = 1,
  operators = 1,
  durationTicks = TEST_SHIFT_TICKS,
}: TestLevelOptions = {}): LevelConfig {
  return {
    id: 'test',
    title: 'Test',
    seed,
    shift: { startMinute: 6 * 60, endMinute: 14 * 60, durationTicks },
    team: { operators },
  };
}

export function testWorld(options?: TestLevelOptions): World {
  return createWorld(testLevel(options));
}
