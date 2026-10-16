import { describe, expect, it } from 'vitest';
import { REST_BELOW, RESUME_AT, speedFactor } from './fatigue';
import { at, manhattanDistance, samePoint } from './geometry';
import { isWalkable } from './grid';
import { MAX_OPERATORS } from './layout';
import { OPERATOR_SPEED, SIDESTEP_AFTER_TICKS } from './movement';
import {
  createInitialState,
  operatorPosition,
  step,
  type Operator,
  type SimState,
} from './simulation';
import { testWorld, TEST_SHIFT_TICKS } from './testing';
import type { World } from './world';

/** Runs a whole shift and returns every state, starting with the initial one. */
function run(world: World, ticks = TEST_SHIFT_TICKS): SimState[] {
  const states = [createInitialState(world)];
  for (let i = 0; i < ticks; i++) {
    states.push(step(world, at(states, states.length - 1)));
  }
  return states;
}

function finalState(world: World): SimState {
  const states = run(world);
  return at(states, states.length - 1);
}

/** Boxes in racks plus boxes being carried out; putaways add to it, dispatches remove. */
function boxesInWarehouse(state: SimState): number {
  const onShelves = state.slots.filter((s) => s === 'stored' || s === 'outgoing').length;
  const beingDispatched = state.operators.filter(
    (o) => o.carrying && o.task?.kind === 'dispatch',
  ).length;
  return onShelves + beingDispatched;
}

describe('simulation', () => {
  it('is deterministic: the same level always produces the same run', () => {
    expect(finalState(testWorld({ seed: 42 }))).toEqual(finalState(testWorld({ seed: 42 })));
  });

  it('produces different runs for different seeds', () => {
    expect(finalState(testWorld({ seed: 1 }))).not.toEqual(finalState(testWorld({ seed: 2 })));
  });

  it('starts with the team size the level defines', () => {
    expect(createInitialState(testWorld({ operators: 3 })).operators).toHaveLength(3);
  });

  it('starts with exactly the stock the scenario planned', () => {
    const world = testWorld({ scenario: { initialStock: 0.5 } });
    const stocked = createInitialState(world)
      .slots.flatMap((status, slotId) => (status === 'stored' ? [slotId] : []))
      .sort((a, b) => a - b);
    const planned = world.scenario.initialStock.map((s) => s.slotId).sort((a, b) => a - b);
    expect(stocked).toEqual(planned);
  });

  it('does not mutate the state it is given', () => {
    const world = testWorld({ seed: 7 });
    const initial = createInitialState(world);
    const snapshot: unknown = JSON.parse(JSON.stringify(initial));
    step(world, initial);
    expect(initial).toEqual(snapshot);
  });

  it('stops advancing once the shift is over', () => {
    const world = testWorld({ durationTicks: 50 });
    const states = run(world, 60);
    const final = at(states, 50);

    expect(final.tick).toBe(50);
    expect(step(world, final)).toBe(final);
    expect(at(states, states.length - 1)).toBe(final);
  });

  it('keeps operators on walkable cells and moving at most one step of speed per tick', () => {
    const world = testWorld({ seed: 3, operators: 3 });
    const states = run(world);
    for (let i = 1; i < states.length; i++) {
      const previous = at(states, i - 1);
      at(states, i).operators.forEach((operator, index) => {
        expect(isWalkable(world.warehouse.grid, operator.from)).toBe(true);
        expect(isWalkable(world.warehouse.grid, operator.to)).toBe(true);
        expect(
          manhattanDistance(
            operatorPosition(at(previous.operators, index)),
            operatorPosition(operator),
          ),
        ).toBeLessThanOrEqual(OPERATOR_SPEED + 1e-9);
      });
    }
  });

  it('completes work and conserves boxes across the whole shift', () => {
    const states = run(testWorld({ seed: 11, operators: 3 }));
    const initialBoxes = boxesInWarehouse(at(states, 0));

    for (const state of states) {
      const { putaways, dispatches } = state.stats;
      expect(boxesInWarehouse(state)).toBe(initialBoxes + putaways - dispatches);
    }
    const final = at(states, states.length - 1);
    expect(final.stats.putaways).toBeGreaterThan(0);
    expect(final.stats.dispatches).toBeGreaterThan(0);
  });

  it('never assigns the same slot to two operators at once', () => {
    for (const state of run(testWorld({ seed: 5, operators: 3 }))) {
      const reserved = state.operators.flatMap((o) => (o.task ? [o.task.slotId] : []));
      expect(new Set(reserved).size).toBe(reserved.length);
    }
  });
});

describe('aisle traffic', () => {
  const cellsTaken = (operator: Operator) =>
    [operator.from, operator.to]
      .filter((cell, index) => index === 0 || !samePoint(cell, operator.from))
      .map((cell) => `${String(cell.x)},${String(cell.y)}`);

  it.each([4, 8, MAX_OPERATORS])('never puts two of %i operators in the same cell', (count) => {
    for (const state of run(testWorld({ seed: 31, operators: count }))) {
      const taken = state.operators.flatMap(cellsTaken);
      expect(new Set(taken).size).toBe(taken.length);
    }
  });

  it('never leaves anyone stuck: everyone keeps working through a crowded shift', () => {
    const states = run(testWorld({ seed: 31, operators: MAX_OPERATORS }));
    const longestWait = Math.max(...states.flatMap((s) => s.operators.map((o) => o.blockedTicks)));
    expect(longestWait).toBeLessThan(SIDESTEP_AFTER_TICKS * 3);
    // With a full team, gridlock is the only thing that could leave the day's work undone.
    const world = testWorld({ seed: 31, operators: MAX_OPERATORS });
    const final = at(states, states.length - 1);
    expect(final.stats.trucksUnloaded).toBe(world.scenario.trucks.length);
    expect(final.stats.ordersShipped).toBe(world.scenario.orders.length);
  });

  it('costs more time to congestion as the team grows', () => {
    const lostPerOperator = (count: number) => {
      const final = at(run(testWorld({ seed: 31, operators: count })), TEST_SHIFT_TICKS);
      return final.stats.congestionTicks / count;
    };
    expect(lostPerOperator(MAX_OPERATORS)).toBeGreaterThan(lostPerOperator(2));
  });

  it('starts everyone at their own home and keeps idle operators there', () => {
    const world = testWorld({
      operators: 6,
      scenario: { initialStock: 0, trucks: { count: 0, boxes: [1, 1], peaks: [] } },
    });
    const final = at(run(world, 200), 200);
    final.operators.forEach((operator) => {
      expect(operator.from).toEqual(world.warehouse.operatorHomes[operator.id]);
      expect(operator.phase).toBe('idle');
    });
  });
});

describe('fatigue in the simulation', () => {
  // A small team facing a heavy day, so operators run down and need breaks.
  const world = testWorld({
    seed: 51,
    operators: 2,
    scenario: {
      trucks: { count: 30, boxes: [4, 6], peaks: [] },
      orders: { count: 30, boxes: [1, 3], deadlineMinutes: [60, 120], peaks: [] },
    },
  });
  const states = run(world);

  it('keeps every operator between exhausted and fresh', () => {
    for (const state of states) {
      for (const operator of state.operators) {
        expect(operator.energy).toBeGreaterThanOrEqual(0);
        expect(operator.energy).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sends tired operators on a break at home, without work, until they recover', () => {
    let breaks = 0;
    for (let i = 1; i < states.length; i++) {
      const previous = at(states, i - 1);
      at(states, i).operators.forEach((operator, index) => {
        const before = at(previous.operators, index);
        if (operator.phase === 'resting') {
          expect(operator.task).toBeNull();
          expect(operator.from).toEqual(world.warehouse.operatorHomes[operator.id]);
          if (before.phase !== 'resting') {
            breaks++;
            expect(before.energy).toBeLessThan(REST_BELOW);
          }
        }
        if (before.phase === 'resting' && operator.phase !== 'resting') {
          expect(before.energy).toBeGreaterThanOrEqual(RESUME_AT);
        }
      });
    }
    expect(breaks).toBeGreaterThan(0);
    const final = at(states, states.length - 1);
    expect(final.stats.breakTicks).toBeGreaterThan(0);
    // Salaries accrue for every operator on every tick, breaks included.
    expect(final.stats.staffTicks).toBe(final.operators.length * final.tick);
  });

  it('makes tired operators walk slower', () => {
    for (let i = 1; i < states.length; i++) {
      const previous = at(states, i - 1);
      at(states, i).operators.forEach((operator, index) => {
        const before = at(previous.operators, index);
        const moved = manhattanDistance(operatorPosition(before), operatorPosition(operator));
        expect(moved).toBeLessThanOrEqual(OPERATOR_SPEED * speedFactor(before.energy) + 1e-9);
      });
    }
  });
});

describe('orders in the simulation', () => {
  const world = testWorld({ seed: 41, operators: 3 });
  const states = run(world);

  it('only picks for released orders, and never more boxes than an order needs', () => {
    for (const state of states) {
      for (const operator of state.operators) {
        if (operator.task?.kind !== 'dispatch') continue;
        const order = at(world.scenario.orders, operator.task.orderId);
        expect(order.releaseTick).toBeLessThanOrEqual(state.tick);
      }
      state.orders.forEach((progress, id) => {
        const order = at(world.scenario.orders, id);
        expect(progress.delivered).toBeLessThanOrEqual(progress.claimed);
        expect(progress.claimed).toBeLessThanOrEqual(order.quantity);
      });
    }
  });

  it('counts every delivered box and every shipped order exactly once', () => {
    const final = at(states, states.length - 1);
    const delivered = final.orders.reduce((sum, progress) => sum + progress.delivered, 0);
    const shippedTicks = final.orders.map((progress) => progress.shippedTick);
    const shipped = shippedTicks.filter((tick) => tick !== null).length;
    const late = shippedTicks.filter(
      (tick, id) => tick !== null && tick > at(world.scenario.orders, id).deadlineTick,
    ).length;
    expect(final.stats.dispatches).toBe(delivered);
    expect(final.stats.ordersShipped).toBe(shipped);
    expect(final.stats.ordersLate).toBe(late);
    expect(final.stats.ordersShipped).toBeGreaterThan(0);
  });

  it('dispatches nothing when there are no orders', () => {
    const quiet = testWorld({
      operators: 3,
      scenario: { orders: { count: 0, boxes: [1, 1], deadlineMinutes: [60, 60], peaks: [] } },
    });
    for (const state of run(quiet)) {
      expect(state.operators.some((o) => o.task?.kind === 'dispatch')).toBe(false);
      expect(state.stats.dispatches).toBe(0);
    }
  });
});

describe('receiving in the simulation', () => {
  const world = testWorld({ seed: 21, operators: 3 });
  const states = run(world);

  it('only stores boxes that came off a truck, and accounts for every one of them', () => {
    for (const state of states) {
      const { docks, queue, arrived } = state.receiving;
      const putawayTasks = state.operators.flatMap((o) => (o.task?.kind === 'putaway' ? [o] : []));
      const docked = world.scenario.trucks
        .slice(0, arrived)
        .filter((truck) => !queue.includes(truck.id));
      const boxesDelivered = docked.reduce((sum, truck) => sum + truck.itemIds.length, 0);
      const stillOnTrucks = docks.reduce((sum, truck) => sum + (truck?.itemIds.length ?? 0), 0);

      // Every box from a docked truck is still on it, claimed, being carried, or stored.
      expect(stillOnTrucks + putawayTasks.length + state.stats.putaways).toBe(boxesDelivered);
      // The truck tracks exactly the operators that have claimed but not yet lifted a box.
      const awaiting = docks.reduce((sum, truck) => sum + (truck?.awaitingPickup ?? 0), 0);
      expect(awaiting).toBe(putawayTasks.filter((o) => !o.carrying).length);
    }
  });

  it('collects each box at the dock where its truck is parked', () => {
    for (const state of states) {
      for (const operator of state.operators) {
        if (operator.task?.kind !== 'putaway' || operator.carrying) continue;
        expect(state.receiving.docks[operator.task.dock]?.phase).toBe('unloading');
      }
    }
  });

  it('receives and unloads the whole day of trucks, given enough hands', () => {
    // A generous team, so the check is about the flow working, not about balance.
    const staffed = testWorld({ seed: 21, operators: 6 });
    const final = at(run(staffed), TEST_SHIFT_TICKS);
    expect(final.receiving.arrived).toBe(staffed.scenario.trucks.length);
    expect(final.stats.trucksUnloaded).toBe(staffed.scenario.trucks.length);
  });

  it('makes trucks wait when all docks are busy, and counts the wait', () => {
    const rush = testWorld({
      operators: 1,
      scenario: {
        trucks: {
          count: 12,
          boxes: [4, 4],
          peaks: [{ startMinute: 360, endMinute: 380, weight: 100 }],
        },
      },
    });
    const rushStates = run(rush);
    expect(rushStates.some((s) => s.receiving.queue.length > 0)).toBe(true);
    expect(at(rushStates, rushStates.length - 1).stats.dockWaitTicks).toBeGreaterThan(0);
  });
});
