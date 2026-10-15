import { describe, expect, it } from 'vitest';
import { tickAtMinute } from './clock';
import type { LevelConfig } from './level';
import { generateScenario } from './scenario';
import { testLevel } from './testing';

const SLOT_COUNT = 80;
const generate = (level: LevelConfig) => generateScenario(level, SLOT_COUNT);

describe('generateScenario', () => {
  it('is deterministic for a level and varies with its seed', () => {
    expect(generate(testLevel({ seed: 9 }))).toEqual(generate(testLevel({ seed: 9 })));
    expect(generate(testLevel({ seed: 9 }))).not.toEqual(generate(testLevel({ seed: 10 })));
  });

  it('generates the configured number of trucks and orders, sorted by time', () => {
    const { trucks, orders } = generate(testLevel());
    expect(trucks).toHaveLength(6);
    expect(orders).toHaveLength(10);
    const arrivals = trucks.map((t) => t.arrivalTick);
    const releases = orders.map((o) => o.releaseTick);
    expect(arrivals).toEqual([...arrivals].sort((a, b) => a - b));
    expect(releases).toEqual([...releases].sort((a, b) => a - b));
  });

  it('keeps sizes and deadlines within the configured ranges', () => {
    const level = testLevel({
      scenario: {
        trucks: { count: 40, boxes: [3, 5], peaks: [] },
        orders: { count: 40, boxes: [2, 3], deadlineMinutes: [30, 45], peaks: [] },
      },
    });
    const { trucks, orders } = generate(level);
    const ticksPerMinute =
      level.shift.durationTicks / (level.shift.endMinute - level.shift.startMinute);
    const endTick = level.shift.durationTicks;

    for (const truck of trucks) {
      expect(truck.itemIds.length).toBeGreaterThanOrEqual(3);
      expect(truck.itemIds.length).toBeLessThanOrEqual(5);
    }
    for (const order of orders) {
      expect(order.quantity).toBeGreaterThanOrEqual(2);
      expect(order.quantity).toBeLessThanOrEqual(3);
      expect(order.deadlineTick).toBeLessThanOrEqual(endTick);
      // Rounding to whole ticks can shift either end by one tick.
      const minutes = (order.deadlineTick - order.releaseTick) / ticksPerMinute;
      expect(minutes).toBeGreaterThanOrEqual(30 - 1 / ticksPerMinute);
      expect(minutes).toBeLessThanOrEqual(45 + 1 / ticksPerMinute);
    }
  });

  it('never gives an order less than its shortest deadline, even late in the shift', () => {
    const level = testLevel({
      scenario: { orders: { count: 200, boxes: [1, 1], deadlineMinutes: [120, 180], peaks: [] } },
    });
    const ticksPerMinute =
      level.shift.durationTicks / (level.shift.endMinute - level.shift.startMinute);
    for (const order of generate(level).orders) {
      const minutes = (order.deadlineTick - order.releaseTick) / ticksPerMinute;
      expect(minutes).toBeGreaterThanOrEqual(120 - 1 / ticksPerMinute);
    }
  });

  it('keeps sections independent: changing trucks does not move orders or stock', () => {
    const base = generate(testLevel());
    const moreTrucks = generate(
      testLevel({ scenario: { trucks: { count: 30, boxes: [2, 4], peaks: [] } } }),
    );
    expect(moreTrucks.orders).toEqual(base.orders);
    expect(moreTrucks.initialStock).toEqual(base.initialStock);
  });

  it('stops arrivals an hour before the shift ends', () => {
    const level = testLevel({
      scenario: { trucks: { count: 100, boxes: [1, 1], peaks: [] } },
    });
    const cutoff = tickAtMinute(level, level.shift.endMinute - 60);
    for (const truck of generate(level).trucks) expect(truck.arrivalTick).toBeLessThan(cutoff);
  });

  it('concentrates arrivals inside a peak', () => {
    // A 60-minute peak out of a 420-minute window, ten times as likely: expected share ~61%.
    const level = testLevel({
      scenario: {
        orders: {
          count: 200,
          boxes: [1, 1],
          deadlineMinutes: [60, 60],
          peaks: [{ startMinute: 10 * 60, endMinute: 11 * 60, weight: 10 }],
        },
      },
    });
    const [from, to] = [tickAtMinute(level, 10 * 60), tickAtMinute(level, 11 * 60)];
    const inPeak = generate(level).orders.filter(
      (o) => o.releaseTick >= from && o.releaseTick <= to,
    );
    expect(inPeak.length / 200).toBeGreaterThan(0.45);
  });

  it('marks boxes fragile according to the configured ratio', () => {
    const fragileShare = (fragileRatio: number) => {
      const level = testLevel({
        scenario: { fragileRatio, trucks: { count: 100, boxes: [5, 5], peaks: [] } },
      });
      const { items } = generate(level);
      return items.filter((item) => item.fragile).length / items.length;
    };
    expect(fragileShare(0)).toBe(0);
    expect(fragileShare(1)).toBe(1);
    expect(fragileShare(0.3)).toBeCloseTo(0.3, 1);
  });

  it('stocks distinct slots with distinct items, and every item id is unique', () => {
    const { items, initialStock, trucks } = generate(
      testLevel({ scenario: { initialStock: 0.5 } }),
    );
    expect(initialStock).toHaveLength(40);
    expect(new Set(initialStock.map((s) => s.slotId)).size).toBe(40);
    for (const { slotId } of initialStock) expect(slotId).toBeLessThan(SLOT_COUNT);

    const referenced = [...initialStock.map((s) => s.itemId), ...trucks.flatMap((t) => t.itemIds)];
    expect(new Set(referenced).size).toBe(referenced.length);
    expect(referenced).toHaveLength(items.length);
  });
});
