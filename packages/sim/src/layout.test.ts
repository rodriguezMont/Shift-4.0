import { describe, expect, it } from 'vitest';
import { manhattanDistance } from './geometry';
import { isWalkable } from './grid';
import { createWarehouse } from './layout';
import { findPath } from './pathfinding';

describe('createWarehouse', () => {
  const warehouse = createWarehouse();

  it('blocks every rack cell and serves it from an adjacent walkable aisle cell', () => {
    warehouse.slots.forEach((slot, index) => {
      expect(slot.id).toBe(index);
      expect(isWalkable(warehouse.grid, slot.rack)).toBe(false);
      expect(isWalkable(warehouse.grid, slot.access)).toBe(true);
      expect(manhattanDistance(slot.rack, slot.access)).toBe(1);
    });
  });

  it('connects every slot to every inbound and outbound dock', () => {
    for (const slot of warehouse.slots) {
      for (const dock of warehouse.inboundDocks) {
        expect(findPath(warehouse.grid, dock, slot.access)).not.toBeNull();
      }
      for (const dock of warehouse.outboundDocks) {
        expect(findPath(warehouse.grid, slot.access, dock)).not.toBeNull();
      }
    }
  });
});
