import { describe, expect, it } from 'vitest';
import { at, manhattanDistance } from './geometry';
import { isWalkable } from './grid';
import {
  createInitialState,
  operatorPosition,
  step,
  OPERATOR_SPEED,
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
