import { describe, expect, it } from 'vitest';
import {
  boxesLeft,
  claimBox,
  createReceiving,
  docksToRelease,
  liftBox,
  stepReceiving,
  TRUCK_MANEUVER_TICKS,
  type Receiving,
} from './receiving';
import type { Scenario, TruckArrival } from './scenario';

function scenarioWith(trucks: readonly TruckArrival[]): Scenario {
  return { items: [], initialStock: [], trucks, orders: [] };
}

const truck = (id: number, arrivalTick: number, itemIds: number[]): TruckArrival => ({
  id,
  arrivalTick,
  itemIds,
});

/** Steps receiving from `fromTick` for `ticks` ticks. */
function advance(scenario: Scenario, receiving: Receiving, fromTick: number, ticks: number) {
  let current = receiving;
  let unloaded = 0;
  for (let tick = fromTick; tick < fromTick + ticks; tick++) {
    const result = stepReceiving(scenario, current, tick);
    current = result.receiving;
    unloaded += result.trucksUnloaded;
  }
  return { receiving: current, unloaded };
}

describe('receiving', () => {
  it('docks a truck when it arrives and makes its boxes claimable once parked', () => {
    const scenario = scenarioWith([truck(0, 5, [10, 11])]);
    let { receiving } = advance(scenario, createReceiving(2), 0, 6);
    expect(receiving.docks[0]).toMatchObject({ truckId: 0, phase: 'arriving' });
    expect(claimBox(receiving)).toBeNull();

    ({ receiving } = advance(scenario, receiving, 6, TRUCK_MANEUVER_TICKS));
    expect(receiving.docks[0]?.phase).toBe('unloading');
    expect(claimBox(receiving)).toMatchObject({ dock: 0, itemId: 10 });
  });

  it('queues trucks when every dock is busy and serves them in arrival order', () => {
    const scenario = scenarioWith([truck(0, 0, [1]), truck(1, 0, [2]), truck(2, 1, [3])]);
    const { receiving } = advance(scenario, createReceiving(2), 0, 2);
    expect(receiving.docks.map((t) => t?.truckId)).toEqual([0, 1]);
    expect(receiving.queue).toEqual([2]);
  });

  it('keeps a truck docked until every claimed box is lifted, then lets it leave', () => {
    const scenario = scenarioWith([truck(0, 0, [7])]);
    let { receiving } = advance(scenario, createReceiving(1), 0, TRUCK_MANEUVER_TICKS + 1);

    const claim = claimBox(receiving);
    if (claim === null) throw new Error('expected a box to claim');
    let step = advance(scenario, claim.receiving, 100, 5);
    expect(step.receiving.docks[0]?.phase).toBe('unloading');
    expect(step.unloaded).toBe(0);

    receiving = liftBox(step.receiving, claim.dock);
    step = advance(scenario, receiving, 105, 1);
    expect(step.receiving.docks[0]?.phase).toBe('departing');
    expect(step.unloaded).toBe(1);

    step = advance(scenario, step.receiving, 106, TRUCK_MANEUVER_TICKS);
    expect(step.receiving.docks[0]).toBeNull();
  });

  it('unloads the truck that has been docked longest first', () => {
    const scenario = scenarioWith([truck(0, 0, [1]), truck(1, 0, [2])]);
    const { receiving } = advance(scenario, createReceiving(2), 0, TRUCK_MANEUVER_TICKS + 1);
    expect(claimBox(receiving)?.itemId).toBe(1);
  });

  describe('with trucks waiting', () => {
    // Three docks, all parked: 3, 1 and 2 boxes; two more trucks queuing.
    const scenario = scenarioWith([
      truck(0, 0, [10, 11, 12]),
      truck(1, 0, [20]),
      truck(2, 0, [30, 31]),
      truck(3, 0, [40]),
      truck(4, 0, [50]),
    ]);
    const { receiving } = advance(scenario, createReceiving(3), 0, TRUCK_MANEUVER_TICKS + 1);

    it('flags one dock to release per waiting truck, closest to finishing first', () => {
      expect(receiving.queue).toEqual([3, 4]);
      expect(docksToRelease(receiving)).toEqual([1, 2]);
    });

    it('unloads the truck with the fewest boxes left first', () => {
      expect(claimBox(receiving)).toMatchObject({ dock: 1, itemId: 20 });
    });

    it('counts claimed but unlifted boxes as still on the truck', () => {
      const claim = claimBox(receiving);
      if (claim === null) throw new Error('expected a box to claim');
      const docked = claim.receiving.docks[claim.dock];
      if (!docked) throw new Error('expected a docked truck');
      expect(boxesLeft(docked)).toBe(1);
    });
  });

  it('flags nothing to release when no truck is waiting', () => {
    const scenario = scenarioWith([truck(0, 0, [1, 2])]);
    const { receiving } = advance(scenario, createReceiving(2), 0, TRUCK_MANEUVER_TICKS + 1);
    expect(docksToRelease(receiving)).toEqual([]);
  });

  it('refuses to lift a box nobody claimed', () => {
    expect(() => liftBox(createReceiving(1), 0)).toThrow(/No claimed box/);
  });
});
