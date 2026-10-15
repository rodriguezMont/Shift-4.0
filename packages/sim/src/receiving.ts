import { at } from './geometry';
import type { Scenario } from './scenario';

/** Ticks a truck takes to back into a dock, and again to pull away (2 s at 1x). */
export const TRUCK_MANEUVER_TICKS = 20;

export type DockPhase = 'arriving' | 'unloading' | 'departing';

/** A truck occupying an inbound dock. The dock stays busy while it maneuvers in and out. */
export interface DockedTruck {
  readonly truckId: number;
  readonly phase: DockPhase;
  /** Ticks left in the current maneuver; 0 while unloading. */
  readonly maneuverTicks: number;
  /** Boxes still on the truck that no operator has claimed yet. */
  readonly itemIds: readonly number[];
  /** Boxes claimed by an operator who has not lifted them off yet. The truck waits for them. */
  readonly awaitingPickup: number;
}

export interface Receiving {
  /** One entry per inbound dock: the truck there, or null when the dock is free. */
  readonly docks: readonly (DockedTruck | null)[];
  /** Trucks that have arrived but found every dock busy, in arrival order. */
  readonly queue: readonly number[];
  /** How many of the scenario's trucks (sorted by arrival) have arrived so far. */
  readonly arrived: number;
}

export function createReceiving(dockCount: number): Receiving {
  return { docks: Array.from({ length: dockCount }, () => null), queue: [], arrived: 0 };
}

/**
 * Advances the inbound side by one tick: maneuvers progress, emptied trucks leave,
 * due trucks arrive, and waiting trucks take any free dock (lowest dock first).
 *
 * @returns the new receiving state and how many trucks finished unloading this tick.
 */
export function stepReceiving(
  scenario: Scenario,
  receiving: Receiving,
  tick: number,
): { receiving: Receiving; trucksUnloaded: number } {
  let trucksUnloaded = 0;
  const docks = receiving.docks.map((truck): DockedTruck | null => {
    if (truck === null) return null;
    switch (truck.phase) {
      case 'arriving':
        return truck.maneuverTicks > 1
          ? { ...truck, maneuverTicks: truck.maneuverTicks - 1 }
          : { ...truck, phase: 'unloading', maneuverTicks: 0 };
      case 'unloading':
        if (truck.itemIds.length > 0 || truck.awaitingPickup > 0) return truck;
        trucksUnloaded++;
        return { ...truck, phase: 'departing', maneuverTicks: TRUCK_MANEUVER_TICKS };
      case 'departing':
        return truck.maneuverTicks > 1
          ? { ...truck, maneuverTicks: truck.maneuverTicks - 1 }
          : null;
    }
  });

  const queue = [...receiving.queue];
  let arrived = receiving.arrived;
  while (arrived < scenario.trucks.length && at(scenario.trucks, arrived).arrivalTick <= tick) {
    queue.push(arrived++);
  }

  for (let dock = 0; dock < docks.length; dock++) {
    if (docks[dock] !== null) continue;
    const truckId = queue.shift();
    if (truckId === undefined) break;
    docks[dock] = {
      truckId,
      phase: 'arriving',
      maneuverTicks: TRUCK_MANEUVER_TICKS,
      itemIds: at(scenario.trucks, truckId).itemIds,
      awaitingPickup: 0,
    };
  }

  return { receiving: { docks, queue, arrived }, trucksUnloaded };
}

/** Whether any parked truck still has a box nobody has claimed. */
export function hasBoxToUnload(receiving: Receiving): boolean {
  return receiving.docks.some((truck) => truck?.phase === 'unloading' && truck.itemIds.length > 0);
}

/** Boxes still physically on the truck: unclaimed ones plus those claimed but not lifted. */
export function boxesLeft(truck: DockedTruck): number {
  return truck.itemIds.length + truck.awaitingPickup;
}

/**
 * The docks to free next for trucks in the queue: one per waiting truck, choosing the
 * occupied docks closest to finishing (fewest boxes left, then earliest truck).
 * Empty when nobody is waiting.
 */
export function docksToRelease(receiving: Receiving): number[] {
  if (receiving.queue.length === 0) return [];
  return receiving.docks
    .flatMap((truck, dock) => (truck === null ? [] : [{ truck, dock }]))
    .sort((a, b) => boxesLeft(a.truck) - boxesLeft(b.truck) || a.truck.truckId - b.truck.truckId)
    .slice(0, receiving.queue.length)
    .map(({ dock }) => dock);
}

/**
 * Claims the next box to unload. With trucks waiting, it empties the truck closest to
 * finishing so a dock frees up sooner; otherwise it serves trucks in arrival order.
 * @returns null when no unloading truck has unclaimed boxes.
 */
export function claimBox(
  receiving: Receiving,
): { receiving: Receiving; dock: number; itemId: number } | null {
  const rush = receiving.queue.length > 0;
  const precedes = (a: DockedTruck, b: DockedTruck) =>
    rush ? boxesLeft(a) - boxesLeft(b) || a.truckId - b.truckId : a.truckId - b.truckId;

  let dock = -1;
  receiving.docks.forEach((truck, index) => {
    if (truck?.phase !== 'unloading' || truck.itemIds.length === 0) return;
    const best = receiving.docks[dock];
    if (best === undefined || best === null || precedes(truck, best) < 0) dock = index;
  });
  const truck = receiving.docks[dock];
  if (truck === undefined || truck === null) return null;

  const [itemId, ...rest] = truck.itemIds;
  if (itemId === undefined) return null;
  return {
    receiving: withDock(receiving, dock, {
      ...truck,
      itemIds: rest,
      awaitingPickup: truck.awaitingPickup + 1,
    }),
    dock,
    itemId,
  };
}

/** Records that a claimed box has been lifted off the truck at `dock`. */
export function liftBox(receiving: Receiving, dock: number): Receiving {
  const truck = receiving.docks[dock];
  if (truck === undefined || truck === null || truck.awaitingPickup === 0) {
    throw new Error(`No claimed box to lift at dock ${String(dock)}`);
  }
  return withDock(receiving, dock, { ...truck, awaitingPickup: truck.awaitingPickup - 1 });
}

function withDock(receiving: Receiving, dock: number, truck: DockedTruck): Receiving {
  return { ...receiving, docks: receiving.docks.map((t, i) => (i === dock ? truck : t)) };
}
