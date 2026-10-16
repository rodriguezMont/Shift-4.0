import { describe, expect, it } from 'vitest';
import { at } from './geometry';
import { createWarehouse } from './layout';
import { BUSY_AISLE_PENALTY, chooseWork, nearestSlot } from './policy';
import type { Order } from './scenario';
import type { SlotStatus } from './simulation';

const URGENT = 100;
const order = (deadlineTick: number): Order => ({
  id: 0,
  releaseTick: 0,
  deadlineTick,
  quantity: 1,
});

describe('chooseWork', () => {
  it('picks for an order about to fall due, even with a truck to unload', () => {
    expect(chooseWork({ canUnload: true, order: order(150), tick: 50, urgentTicks: URGENT })).toBe(
      'pick',
    );
  });

  it('unloads while the next order can wait', () => {
    expect(chooseWork({ canUnload: true, order: order(151), tick: 50, urgentTicks: URGENT })).toBe(
      'unload',
    );
  });

  it('picks ahead when there is nothing to unload, and rests when there is nothing at all', () => {
    expect(chooseWork({ canUnload: false, order: order(900), tick: 0, urgentTicks: URGENT })).toBe(
      'pick',
    );
    expect(chooseWork({ canUnload: true, order: null, tick: 0, urgentTicks: URGENT })).toBe(
      'unload',
    );
    expect(chooseWork({ canUnload: false, order: null, tick: 0, urgentTicks: URGENT })).toBeNull();
  });
});

describe('nearestSlot', () => {
  const warehouse = createWarehouse();
  const allSlots = warehouse.slots.map(({ id }) => id);
  const idle: SlotStatus[] = warehouse.slots.map(() => 'empty');
  const inbound = at(warehouse.inboundDocks, 0);
  const outbound = at(warehouse.outboundDocks, 0);
  const distance = (id: number, to: { x: number; y: number }) => {
    const { access } = at(warehouse.slots, id);
    return Math.abs(access.x - to.x) + Math.abs(access.y - to.y);
  };

  it('stores near the door a box came through, and picks near the door it leaves by', () => {
    const forInbound = nearestSlot(warehouse, allSlots, inbound, idle);
    const forOutbound = nearestSlot(warehouse, allSlots, outbound, idle);
    if (!forInbound || !forOutbound) throw new Error('expected slots');
    const closest = (to: typeof inbound) => Math.min(...allSlots.map((id) => distance(id, to)));
    expect(distance(forInbound.id, inbound)).toBe(closest(inbound));
    expect(distance(forOutbound.id, outbound)).toBe(closest(outbound));
    expect(forInbound.access.x).toBeLessThan(forOutbound.access.x);
  });

  it('breaks ties on the lowest slot id, so the same situation always gets the same slot', () => {
    const first = nearestSlot(warehouse, allSlots, inbound, idle);
    const reversed = nearestSlot(warehouse, [...allSlots].reverse(), inbound, idle);
    expect(reversed?.id).toBe(first?.id);
  });

  it('steers away from an aisle colleagues are already heading for', () => {
    const preferred = nearestSlot(warehouse, allSlots, inbound, idle);
    if (!preferred) throw new Error('expected a slot');
    // Enough colleagues in that aisle to outweigh the walk to the next one.
    const crowded = warehouse.slots.map(({ id, access }): SlotStatus =>
      access.x === preferred.access.x && id !== preferred.id ? 'incoming' : 'empty',
    );
    const next = nearestSlot(warehouse, allSlots, inbound, crowded);
    if (!next) throw new Error('expected a slot');
    expect(next.access.x).not.toBe(preferred.access.x);
    // It moved because the crowd outweighs the extra walk, not for any other reason.
    const busyCount = crowded.filter((status) => status === 'incoming').length;
    const extraWalk = distance(next.id, inbound) - distance(preferred.id, inbound);
    expect(busyCount * BUSY_AISLE_PENALTY).toBeGreaterThan(extraWalk);
  });

  it('finds nothing among no candidates', () => {
    expect(nearestSlot(warehouse, [], inbound, idle)).toBeNull();
  });
});
