import { describe, expect, it } from 'vitest';
import { at, manhattanDistance, samePoint, type Point } from './geometry';
import { isWalkable } from './grid';
import { cellsOf, createWarehouse, MAX_OPERATORS, mayStepAside, type Rect } from './layout';
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

  const inside = ({ x, y, width, height }: Rect, point: Point) =>
    point.x >= x && point.x < x + width && point.y >= y && point.y < y + height;
  const home = at(warehouse.operatorHomes, 0);

  it('keeps docks, racks and homes on the warehouse floor', () => {
    const onFloor = [
      ...warehouse.inboundDocks,
      ...warehouse.outboundDocks,
      ...warehouse.operatorHomes,
      ...warehouse.slots.flatMap(({ rack, access }) => [rack, access]),
    ];
    for (const point of onFloor) expect(inside(warehouse.floor, point)).toBe(true);
  });

  it('walls the floor off, leaving one door per staff room', () => {
    for (const wall of warehouse.walls) expect(isWalkable(warehouse.grid, wall)).toBe(false);
    for (const { door } of warehouse.staffRooms) {
      expect(isWalkable(warehouse.grid, door)).toBe(true);
      expect(warehouse.walls).not.toContainEqual(door);
    }
  });

  it('seats four in the canteen and four at the café, every place reachable from the floor', () => {
    const [canteen, cafe] = warehouse.staffRooms;
    expect(canteen?.kind).toBe('canteen');
    expect(cafe?.kind).toBe('cafe');
    // The canteen sits on the receiving side, the café towards dispatch.
    expect(canteen && cafe && canteen.door.x < cafe.door.x).toBe(true);

    for (const room of warehouse.staffRooms) {
      expect(room.places).toHaveLength(4);
      for (const place of room.places) {
        expect(inside(room.bounds, place)).toBe(true);
        expect(isWalkable(warehouse.grid, place)).toBe(true);
        expect(samePoint(place, { x: room.door.x, y: room.door.y + 1 })).toBe(false);
        expect(findPath(warehouse.grid, home, place)).not.toBeNull();
      }
      for (const { cells } of room.furniture) {
        for (const cell of cellsOf(cells)) {
          expect(inside(room.bounds, cell)).toBe(true);
          expect(isWalkable(warehouse.grid, cell)).toBe(false);
        }
      }
    }
  });

  it('gives each room two queue spots beside its door, keeping the way in clear', () => {
    for (const room of warehouse.staffRooms) {
      expect(room.queue).toHaveLength(2);
      for (const spot of room.queue) {
        expect(inside(warehouse.floor, spot)).toBe(true);
        expect(isWalkable(warehouse.grid, spot)).toBe(true);
        expect(manhattanDistance(spot, room.door)).toBe(2);
        expect(samePoint(spot, { x: room.door.x, y: room.door.y - 1 })).toBe(false);
      }
    }
  });

  it('never lets giving way lead from the floor into a doorway or a room', () => {
    const [canteen] = warehouse.staffRooms;
    if (!canteen) throw new Error('missing canteen');
    const { door } = canteen;
    const inFront = { x: door.x, y: door.y - 1 };
    const inside = { x: door.x, y: door.y + 1 };
    expect(mayStepAside(warehouse, inFront, door)).toBe(false);
    expect(mayStepAside(warehouse, inFront, { x: inFront.x + 1, y: inFront.y })).toBe(true);
    // Someone leaving a room may step back in or out of the doorway to let others pass.
    expect(mayStepAside(warehouse, door, inside)).toBe(true);
    expect(mayStepAside(warehouse, door, inFront)).toBe(true);
    expect(mayStepAside(warehouse, inside, { x: inside.x + 1, y: inside.y })).toBe(true);
  });

  it('only connects the two rooms through the warehouse floor', () => {
    const [canteen, cafe] = warehouse.staffRooms;
    if (!canteen || !cafe) throw new Error('missing staff rooms');
    const path = findPath(warehouse.grid, at(canteen.places, 0), at(cafe.places, 0));
    expect(path?.some((cell) => inside(warehouse.floor, cell))).toBe(true);
  });

  it('builds the robot area behind a wall nobody on the floor can cross yet', () => {
    const { robotArea } = warehouse;
    expect(robotArea.conveyor).toContainEqual(robotArea.capsule);
    // The scene draws the belt as one straight run: consecutive cells along a row.
    robotArea.conveyor.forEach((cell, i) => {
      expect(cell).toEqual({ x: at(robotArea.conveyor, 0).x + i, y: at(robotArea.conveyor, 0).y });
    });
    expect(robotArea.chargingPads.length).toBeGreaterThan(0);
    const equipment = [...robotArea.conveyor, ...robotArea.chargingPads];
    for (const cell of equipment) expect(inside(robotArea.bounds, cell)).toBe(true);
    for (const pad of robotArea.chargingPads) {
      expect(findPath(warehouse.grid, home, pad)).toBeNull();
    }
  });
});
