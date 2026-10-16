/**
 * Breaks in the staff rooms. A tired operator reserves a free place — a chair in the
 * canteen or a standing place in the café — in the room with the most free places, the
 * nearest one on a tie, so the team spreads across both rooms. When every place is
 * taken they wait beside a door, and the longest-waiting person gets the next place.
 */
import { at, manhattanDistance, samePoint, type Point } from './geometry';
import type { StaffRoom, Warehouse } from './layout';

/** What a tired operator is heading for: a reserved place, or a spot in the queue. */
export type BreakPlan =
  | { readonly kind: 'place'; readonly room: number; readonly place: number }
  | { readonly kind: 'queue'; readonly spot: Point; readonly since: number };

export type PlacePlan = Extract<BreakPlan, { kind: 'place' }>;

/**
 * Places and queue spots held during one tick. Local scratch state inside a pure `step`,
 * like `Occupancy`: built from the operators' plans, updated as they choose and leave.
 */
export class BreakBook {
  private readonly held = new Set<string>();

  constructor(plans: readonly (BreakPlan | null)[]) {
    for (const plan of plans) if (plan !== null) this.hold(plan);
  }

  hold(plan: BreakPlan): void {
    this.held.add(keyOf(plan));
  }

  release(plan: BreakPlan | null): void {
    if (plan !== null) this.held.delete(keyOf(plan));
  }

  isHeld(plan: BreakPlan): boolean {
    return this.held.has(keyOf(plan));
  }
}

/**
 * A free place in the room with the most free places; on a tie, the room whose door is
 * nearest to `from`, then the first room. Null when every place is taken.
 */
export function choosePlace(warehouse: Warehouse, book: BreakBook, from: Point): PlacePlan | null {
  let best: { plan: PlacePlan; free: number; distance: number } | null = null;
  for (const [roomIndex, room] of warehouse.staffRooms.entries()) {
    const free = room.places
      .map((_, place): PlacePlan => ({ kind: 'place', room: roomIndex, place }))
      .filter((plan) => !book.isHeld(plan));
    const first = free[0];
    if (first === undefined) continue;
    const distance = manhattanDistance(from, room.door);
    if (
      best === null ||
      free.length > best.free ||
      (free.length === best.free && distance < best.distance)
    ) {
      best = { plan: first, free: free.length, distance };
    }
  }
  return best?.plan ?? null;
}

/** The free queue spot nearest to `from`, across both doors; null if all are taken. */
export function chooseQueueSpot(
  warehouse: Warehouse,
  book: BreakBook,
  from: Point,
  since: number,
): BreakPlan | null {
  let best: { plan: BreakPlan; distance: number } | null = null;
  for (const room of warehouse.staffRooms) {
    for (const spot of room.queue) {
      const plan: BreakPlan = { kind: 'queue', spot, since };
      const distance = manhattanDistance(from, spot);
      if (!book.isHeld(plan) && (best === null || distance < best.distance)) {
        best = { plan, distance };
      }
    }
  }
  return best?.plan ?? null;
}

/** The room a place belongs to. */
export function roomOf(warehouse: Warehouse, plan: PlacePlan): StaffRoom {
  return at(warehouse.staffRooms, plan.room);
}

/** The cell a plan leads to. */
export function targetOf(warehouse: Warehouse, plan: BreakPlan): Point {
  return plan.kind === 'queue' ? plan.spot : at(roomOf(warehouse, plan).places, plan.place);
}

/** Where someone at this place looks: the centre of the nearest table in the room. */
export function facingOf(warehouse: Warehouse, plan: PlacePlan): Point {
  const room = roomOf(warehouse, plan);
  const place = at(room.places, plan.place);
  let best: { point: Point; distance: number } | null = null;
  for (const { kind, cells } of room.furniture) {
    if (kind !== 'table' && kind !== 'bistroTable') continue;
    const point = { x: cells.x + (cells.width - 1) / 2, y: cells.y + (cells.height - 1) / 2 };
    const distance = manhattanDistance(place, point);
    if (best === null || distance < best.distance) best = { point, distance };
  }
  return best?.point ?? place;
}

/** Whether an operator standing at `cell` has reached what the plan leads to. */
export function isAt(warehouse: Warehouse, plan: BreakPlan, cell: Point): boolean {
  return samePoint(targetOf(warehouse, plan), cell);
}

function keyOf(plan: BreakPlan): string {
  return plan.kind === 'place'
    ? `place:${String(plan.room)}:${String(plan.place)}`
    : `queue:${String(plan.spot.x)}:${String(plan.spot.y)}`;
}
