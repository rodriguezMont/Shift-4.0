import { describe, expect, it } from 'vitest';
import { TICKS_PER_SECOND } from './clock';
import { parseLevel } from './level';
import { ORDER_POINTS } from './economy';
import { LEVELS } from './levels';

const validScenario = {
  initialStock: 0.3,
  fragileRatio: 0.1,
  trucks: { count: 8, boxes: [3, 6] },
  orders: {
    count: 18,
    boxes: [1, 2],
    deadlineMinutes: [90, 150],
    peaks: [{ at: '10:00', minutes: 60, weight: 3 }],
  },
};

const validEconomy = {
  startingWallet: 300,
  hiringFee: 150,
  dismissalCost: 400,
  salaryPerHour: 15,
  orderRevenue: 100,
  penalties: { overdueOrder: 60, truckWaitPerHour: 30 },
  stars: [200, 900, 1500],
};

const validLevel = {
  id: 'monday',
  title: 'Monday',
  seed: 123,
  shift: { start: '06:00', end: '14:00', durationSeconds: 210 },
  team: { operators: 2, hireDelayMinutes: 30 },
  scenario: validScenario,
  economy: validEconomy,
};

describe('parseLevel', () => {
  it('resolves times to minutes, duration to ticks and peaks to windows', () => {
    expect(parseLevel(validLevel)).toEqual({
      id: 'monday',
      title: 'Monday',
      seed: 123,
      shift: { startMinute: 360, endMinute: 840, durationTicks: 210 * TICKS_PER_SECOND },
      team: { operators: 2, hireDelayMinutes: 30 },
      scenario: {
        initialStock: 0.3,
        fragileRatio: 0.1,
        trucks: { count: 8, boxes: [3, 6], peaks: [] },
        orders: {
          count: 18,
          boxes: [1, 2],
          deadlineMinutes: [90, 150],
          peaks: [{ startMinute: 600, endMinute: 660, weight: 3 }],
        },
      },
      economy: validEconomy,
    });
  });

  const withScenario = (scenario: object) => ({ scenario: { ...validScenario, ...scenario } });
  const withEconomy = (economy: object) => ({ economy: { ...validEconomy, ...economy } });

  it.each([
    ['a malformed time', { shift: { ...validLevel.shift, start: '6am' } }],
    ['a shift ending before it starts', { shift: { ...validLevel.shift, end: '05:00' } }],
    ['a non-positive duration', { shift: { ...validLevel.shift, durationSeconds: 0 } }],
    ['a duration shorter than a tick', { shift: { ...validLevel.shift, durationSeconds: 0.04 } }],
    ['an empty team', { team: { operators: 0, hireDelayMinutes: 30 } }],
    ['a negative hiring delay', { team: { operators: 2, hireDelayMinutes: -1 } }],
    ['a non-integer seed', { seed: 1.5 }],
    ['an unknown key', { difficulty: 'hard' }],
    ['a missing scenario', { scenario: undefined }],
    ['a ratio above 1', withScenario({ fragileRatio: 1.5 })],
    ['an inverted range', withScenario({ trucks: { count: 8, boxes: [6, 3] } })],
    [
      'a peak weaker than baseline',
      withScenario({
        trucks: { count: 8, boxes: [1, 2], peaks: [{ at: '09:00', minutes: 30, weight: 0.5 }] },
      }),
    ],
    ['a missing economy', { economy: undefined }],
    ['a negative amount', withEconomy({ salaryPerHour: -5 })],
    ['a fractional amount', withEconomy({ orderRevenue: 99.5 })],
    ['star thresholds that do not rise', withEconomy({ stars: [900, 900, 1500] })],
    ['a missing star threshold', withEconomy({ stars: [200, 900] })],
    ['a dismissal cheaper than hiring', withEconomy({ dismissalCost: 100 })],
    ['a dismissal costing the same as hiring', withEconomy({ dismissalCost: 150 })],
  ])('rejects %s', (_, override) => {
    expect(() => parseLevel({ ...validLevel, ...override })).toThrow(/Invalid level/);
  });
});

describe('LEVELS', () => {
  it('ships valid levels with unique ids', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
    expect(new Set(LEVELS.map((level) => level.id)).size).toBe(LEVELS.length);
  });

  it.each(LEVELS.map((level) => [level.id, level] as const))(
    'makes three stars reachable on %s',
    (_, level) => {
      const bestScore = level.scenario.orders.count * ORDER_POINTS.onTime;
      expect(level.economy.stars[2]).toBeLessThanOrEqual(bestScore);
    },
  );

  it('starts the campaign on Monday', () => {
    expect(LEVELS[0]?.id).toBe('monday');
  });
});
