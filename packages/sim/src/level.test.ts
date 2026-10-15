import { describe, expect, it } from 'vitest';
import { TICKS_PER_SECOND } from './clock';
import { parseLevel } from './level';
import { LEVELS } from './levels';

const validLevel = {
  id: 'monday',
  title: 'Monday',
  seed: 123,
  shift: { start: '06:00', end: '14:00', durationSeconds: 210 },
  team: { operators: 2 },
};

describe('parseLevel', () => {
  it('resolves times to minutes and duration to ticks', () => {
    expect(parseLevel(validLevel)).toEqual({
      id: 'monday',
      title: 'Monday',
      seed: 123,
      shift: { startMinute: 360, endMinute: 840, durationTicks: 210 * TICKS_PER_SECOND },
      team: { operators: 2 },
    });
  });

  it.each([
    ['a malformed time', { shift: { ...validLevel.shift, start: '6am' } }],
    ['a shift ending before it starts', { shift: { ...validLevel.shift, end: '05:00' } }],
    ['a non-positive duration', { shift: { ...validLevel.shift, durationSeconds: 0 } }],
    ['a duration shorter than a tick', { shift: { ...validLevel.shift, durationSeconds: 0.04 } }],
    ['an empty team', { team: { operators: 0 } }],
    ['a non-integer seed', { seed: 1.5 }],
    ['an unknown key', { difficulty: 'hard' }],
  ])('rejects %s', (_, override) => {
    expect(() => parseLevel({ ...validLevel, ...override })).toThrow(/Invalid level/);
  });
});

describe('LEVELS', () => {
  it('ships valid levels with unique ids', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
  });

  it('starts the campaign on Monday', () => {
    expect(LEVELS[0]?.id).toBe('monday');
  });
});
