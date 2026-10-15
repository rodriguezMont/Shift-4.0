import { describe, expect, it } from 'vitest';
import { isShiftOver, shiftClock } from './clock';
import { testLevel } from './testing';

describe('shiftClock', () => {
  const level = testLevel({ durationTicks: 2000 });

  it('maps the first and last tick onto the start and end of the shift', () => {
    expect(shiftClock(level, 0)).toEqual({ minuteOfDay: 6 * 60, progress: 0 });
    expect(shiftClock(level, 2000)).toEqual({ minuteOfDay: 14 * 60, progress: 1 });
  });

  it('advances linearly in between', () => {
    expect(shiftClock(level, 500)).toEqual({ minuteOfDay: 8 * 60, progress: 0.25 });
  });

  it('clamps ticks beyond the end of the shift', () => {
    expect(shiftClock(level, 2500).minuteOfDay).toBe(14 * 60);
  });
});

describe('isShiftOver', () => {
  it('is true from the final tick on', () => {
    const level = testLevel({ durationTicks: 10 });
    expect(isShiftOver(level, 9)).toBe(false);
    expect(isShiftOver(level, 10)).toBe(true);
  });
});
