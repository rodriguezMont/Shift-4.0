import type { LevelConfig } from './level';

export const TICKS_PER_SECOND = 10;

export interface ShiftClock {
  /** In-game time as minutes since midnight (e.g. 360 = 06:00). */
  readonly minuteOfDay: number;
  /** Fraction of the shift elapsed, in [0, 1]. */
  readonly progress: number;
}

/** Maps a tick onto the level's figurative shift: real seconds compressed into work hours. */
export function shiftClock(level: LevelConfig, tick: number): ShiftClock {
  const { startMinute, endMinute, durationTicks } = level.shift;
  const progress = Math.min(Math.max(tick / durationTicks, 0), 1);
  return { minuteOfDay: startMinute + (endMinute - startMinute) * progress, progress };
}

export function isShiftOver(level: LevelConfig, tick: number): boolean {
  return tick >= level.shift.durationTicks;
}
