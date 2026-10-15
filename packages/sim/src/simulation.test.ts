import { describe, expect, it } from 'vitest';
import { at, manhattanDistance } from './geometry';
import { isWalkable } from './grid';
import { createWarehouse } from './layout';
import {
  createInitialState,
  operatorPosition,
  step,
  OPERATOR_SPEED,
  TICKS_PER_SECOND,
  type SimState,
} from './simulation';

const warehouse = createWarehouse();
/** Five simulated minutes: roughly one match. */
const MATCH_TICKS = 5 * 60 * TICKS_PER_SECOND;

function run(seed: number, ticks: number, operatorCount = 1): SimState[] {
  const states = [createInitialState(warehouse, { seed, operatorCount })];
  for (let i = 0; i < ticks; i++) {
    const last = at(states, states.length - 1);
    states.push(step(warehouse, last));
  }
  return states;
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
  it('is deterministic: the same seed always produces the same run', () => {
    expect(run(42, MATCH_TICKS).at(-1)).toEqual(run(42, MATCH_TICKS).at(-1));
  });

  it('produces different runs for different seeds', () => {
    expect(run(1, MATCH_TICKS).at(-1)).not.toEqual(run(2, MATCH_TICKS).at(-1));
  });

  it('does not mutate the state it is given', () => {
    const initial = createInitialState(warehouse, { seed: 7 });
    const snapshot: unknown = JSON.parse(JSON.stringify(initial));
    step(warehouse, initial);
    expect(initial).toEqual(snapshot);
  });

  it('keeps operators on walkable cells and moving at most one step of speed per tick', () => {
    const states = run(3, MATCH_TICKS, 3);
    for (let i = 1; i < states.length; i++) {
      const previous = at(states, i - 1);
      const current = at(states, i);
      current.operators.forEach((operator, index) => {
        expect(isWalkable(warehouse.grid, operator.from)).toBe(true);
        expect(isWalkable(warehouse.grid, operator.to)).toBe(true);
        const before = previous.operators[index];
        if (before === undefined) throw new Error('operator disappeared');
        expect(
          manhattanDistance(operatorPosition(before), operatorPosition(operator)),
        ).toBeLessThanOrEqual(OPERATOR_SPEED + 1e-9);
      });
    }
  });

  it('completes work and conserves boxes across the whole shift', () => {
    const states = run(11, MATCH_TICKS, 3);
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
    for (const state of run(5, MATCH_TICKS, 3)) {
      const reserved = state.operators.flatMap((o) => (o.task ? [o.task.slotId] : []));
      expect(new Set(reserved).size).toBe(reserved.length);
    }
  });
});
