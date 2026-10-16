import { describe, expect, it } from 'vitest';
import { BreakBook, choosePlace, chooseQueueSpot, facingOf, type BreakPlan } from './breaks';
import { at } from './geometry';
import { createWarehouse } from './layout';

const warehouse = createWarehouse();
const [canteen, cafe] = warehouse.staffRooms;
if (!canteen || !cafe) throw new Error('missing staff rooms');
const CANTEEN = 0;
const CAFE = 1;
/** Equally far from both doors' x, on the bottom aisle. */
const between = { x: Math.round((canteen.door.x + cafe.door.x) / 2), y: 20 };
const nearCafe = { x: cafe.door.x, y: 19 };

function bookWith(holds: readonly [room: number, place: number][]): BreakBook {
  return new BreakBook(holds.map(([room, place]): BreakPlan => ({ kind: 'place', room, place })));
}

describe('choosePlace', () => {
  it('picks the room with the most free places, even if it is further away', () => {
    const book = bookWith([
      [CAFE, 0],
      [CAFE, 1],
    ]);
    expect(choosePlace(warehouse, book, nearCafe)).toEqual({
      kind: 'place',
      room: CANTEEN,
      place: 0,
    });
  });

  it('breaks a tie with the nearest door', () => {
    const book = bookWith([]);
    expect(choosePlace(warehouse, book, nearCafe)?.room).toBe(CAFE);
    expect(choosePlace(warehouse, book, { x: canteen.door.x, y: 19 })?.room).toBe(CANTEEN);
  });

  it('skips places already held, and returns null once every place is taken', () => {
    const book = bookWith([[CANTEEN, 0]]);
    expect(choosePlace(warehouse, book, between)).toEqual({ kind: 'place', room: CAFE, place: 0 });
    const full = bookWith([
      ...canteen.places.map((_, place): [number, number] => [CANTEEN, place]),
      ...cafe.places.map((_, place): [number, number] => [CAFE, place]),
    ]);
    expect(choosePlace(warehouse, full, between)).toBeNull();
  });
});

describe('chooseQueueSpot', () => {
  it('takes the nearest free spot beside either door, and none when all are taken', () => {
    const book = new BreakBook([]);
    const first = chooseQueueSpot(warehouse, book, nearCafe, 10);
    if (first?.kind !== 'queue') throw new Error('expected a queue spot');
    expect(cafe.queue).toContainEqual(first.spot);
    for (const spot of [...canteen.queue, ...cafe.queue]) {
      book.hold({ kind: 'queue', spot, since: 0 });
    }
    expect(chooseQueueSpot(warehouse, book, nearCafe, 10)).toBeNull();
  });

  it('remembers when the wait started', () => {
    const plan = chooseQueueSpot(warehouse, new BreakBook([]), at(canteen.queue, 0), 42);
    expect(plan).toMatchObject({ kind: 'queue', since: 42 });
  });
});

describe('facingOf', () => {
  it('turns diners towards the canteen table and coffee drinkers towards their bistro table', () => {
    for (const [room, rooms] of [
      [CANTEEN, canteen],
      [CAFE, cafe],
    ] as const) {
      rooms.places.forEach((place, index) => {
        const facing = facingOf(warehouse, { kind: 'place', room, place: index });
        const table = rooms.furniture.find(
          ({ kind, cells }) =>
            (kind === 'table' || kind === 'bistroTable') &&
            Math.abs(cells.x + (cells.width - 1) / 2 - facing.x) < 1e-9 &&
            cells.y === facing.y,
        );
        expect(table).toBeDefined();
        expect(Math.abs(facing.x - place.x) + Math.abs(facing.y - place.y)).toBeLessThanOrEqual(
          1.5,
        );
      });
    }
  });
});
