import { describe, expect, it } from 'vitest';
import { at, manhattanDistance } from './geometry';
import { isWalkable } from './grid';
import { createWarehouse, MAX_OPERATORS } from './layout';
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

  it('gives every possible operator a distinct, reachable home off the dock cells', () => {
    const homes = warehouse.operatorHomes;
    expect(homes).toHaveLength(MAX_OPERATORS);
    expect(new Set(homes.map((h) => `${String(h.x)},${String(h.y)}`)).size).toBe(homes.length);
    const docks = [...warehouse.inboundDocks, ...warehouse.outboundDocks];
    for (const home of homes) {
      expect(isWalkable(warehouse.grid, home)).toBe(true);
      expect(docks).not.toContainEqual(home);
      expect(findPath(warehouse.grid, home, at(warehouse.inboundDocks, 0))).not.toBeNull();
    }
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
