import { describe, expect, it } from 'vitest';
import { applyAction, hireDelayTicks, replay, type Action, type ActionRequest } from './actions';
import { economyOf } from './economy';
import { samePoint } from './geometry';
import { MAX_OPERATORS } from './layout';
import { createInitialState, operatorById, step, type SimState } from './simulation';
import { testWorld } from './testing';
import type { World } from './world';

/** 480 shift minutes over 4800 ticks: the 30-minute hiring delay is 300 ticks. */
const DURATION = 4800;

function act(world: World, state: SimState, request: ActionRequest): SimState {
  const result = applyAction(world, state, { ...request, tick: state.tick });
  if (!result.ok) throw new Error(`unexpected rejection: ${result.error}`);
  return result.state;
}

function rejection(world: World, state: SimState, request: ActionRequest) {
  const result = applyAction(world, state, { ...request, tick: state.tick });
  return result.ok ? null : result.error;
}

function advance(world: World, state: SimState, ticks: number): SimState {
  let next = state;
  for (let i = 0; i < ticks; i++) next = step(world, next);
  return next;
}

describe('hiring', () => {
  const world = testWorld({ operators: 2, durationTicks: DURATION });
  const start = createInitialState(world);

  it('charges the fee at once and brings the operator in after the delay', () => {
    const hired = act(world, start, { kind: 'hire' });
    expect(economyOf(world, hired).wallet).toBe(1000 - 150);
    expect(hired.operators).toHaveLength(2);
    expect(hired.arrivals).toEqual([
      { id: 2, home: world.warehouse.operatorHomes[2], tick: hireDelayTicks(world) },
    ]);
    expect(hireDelayTicks(world)).toBe(300);

    const before = advance(world, hired, 300);
    expect(before.operators).toHaveLength(2);
    const after = step(world, before);
    expect(after.operators.map((operator) => operator.id)).toEqual([0, 1, 2]);
    expect(after.arrivals).toEqual([]);
  });

  it('pays no salary until the new operator arrives', () => {
    const hired = advance(world, act(world, start, { kind: 'hire' }), 300);
    expect(hired.stats.staffTicks).toBe(2 * 300);
    expect(advance(world, hired, 10).stats.staffTicks).toBe(2 * 300 + 3 * 10);
  });

  it('refuses to hire without the cash for the fee', () => {
    const broke = testWorld({ operators: 2, economy: { startingWallet: 149 } });
    expect(rejection(broke, createInitialState(broke), { kind: 'hire' })).toBe('cannotAfford');
  });

  it('refuses to hire beyond one home per operator, counting those on their way', () => {
    const almost = testWorld({ operators: MAX_OPERATORS - 1, economy: { startingWallet: 5000 } });
    const full = act(almost, createInitialState(almost), { kind: 'hire' });
    expect(rejection(almost, full, { kind: 'hire' })).toBe('teamFull');
  });

  it('refuses actions once the shift is over, or stamped for another tick', () => {
    expect(rejection(world, { ...start, tick: DURATION }, { kind: 'hire' })).toBe('shiftOver');
    const stale = applyAction(world, start, { kind: 'hire', tick: 5 });
    expect(stale).toEqual({ ok: false, error: 'wrongTick' });
  });
});

describe('dismissing', () => {
  const world = testWorld({ operators: 3, durationTicks: DURATION });
  const start = createInitialState(world);

  it('costs more than hiring, charged at once', () => {
    const dismissed = act(world, start, { kind: 'dismiss', operatorId: 1 });
    expect(economyOf(world, dismissed).wallet).toBe(1000 - 400);
    expect(operatorById(dismissed.operators, 1)?.leaving).toBe(true);
  });

  it('lets the operator finish the current task, walk home and leave', () => {
    let state = start;
    while (state.operators.every((operator) => operator.task === null)) {
      state = step(world, state);
    }
    const busy = state.operators.find((operator) => operator.task !== null);
    if (busy === undefined) throw new Error('nobody started working');
    state = act(world, state, { kind: 'dismiss', operatorId: busy.id });

    let last = operatorById(state.operators, busy.id);
    while (last !== null) {
      // While still on the floor they never take on new work.
      if (last.task !== null) expect(last.task).toEqual(busy.task);
      const next = step(world, state);
      const after = operatorById(next.operators, busy.id);
      if (after === null) {
        expect(last.task).toBeNull();
        expect(samePoint(last.from, busy.home) || samePoint(last.to, busy.home)).toBe(true);
      }
      state = next;
      last = after;
    }
    // Nothing was left half-done: no slot stays reserved without someone on the job.
    const reserved = state.slots.filter((slot) => slot === 'incoming' || slot === 'outgoing');
    const onTheJob = state.operators.filter((operator) => operator.task !== null);
    expect(reserved.length).toBe(onTheJob.length);
  });

  it('cuts a break short: a dismissed operator gives up their place and leaves', () => {
    const tired = createInitialState(world);
    let state: SimState = {
      ...tired,
      operators: tired.operators.map((operator) =>
        operator.id === 1 ? { ...operator, energy: 0.1 } : operator,
      ),
    };
    while (
      operatorById(state.operators, 1)?.phase !== 'eating' &&
      operatorById(state.operators, 1)?.phase !== 'drinking'
    ) {
      state = step(world, state);
    }
    state = act(world, state, { kind: 'dismiss', operatorId: 1 });
    for (let i = 0; i < 2000 && operatorById(state.operators, 1) !== null; i++) {
      state = step(world, state);
      const operator = operatorById(state.operators, 1);
      if (operator !== null) expect(['eating', 'drinking']).not.toContain(operator.phase);
    }
    expect(operatorById(state.operators, 1)).toBeNull();
  });

  it('stops paying salary once the operator has left', () => {
    let state = act(world, start, { kind: 'dismiss', operatorId: 2 });
    state = advance(world, state, 50); // idle at home: leaves at once
    expect(state.operators.map((operator) => operator.id)).toEqual([0, 1]);
    const paid = state.stats.staffTicks;
    expect(advance(world, state, 10).stats.staffTicks).toBe(paid + 2 * 10);
  });

  it('never reuses an id, and frees the home of someone who left', () => {
    let state = act(world, start, { kind: 'dismiss', operatorId: 0 });
    state = advance(world, state, 5);
    state = act(world, state, { kind: 'hire' });
    expect(state.arrivals[0]?.id).toBe(3);
    expect(state.arrivals[0]?.home).toEqual(world.warehouse.operatorHomes[0]);
  });

  it.each([
    ['an operator who is not on the floor', 99, 'unknownOperator'],
    ['an operator already leaving', 1, 'alreadyLeaving'],
  ] as const)('refuses to dismiss %s', (_, operatorId, error) => {
    const state = act(world, start, { kind: 'dismiss', operatorId: 1 });
    expect(rejection(world, state, { kind: 'dismiss', operatorId })).toBe(error);
  });

  it('refuses to dismiss the last operator staying, or without the cash', () => {
    const solo = testWorld({ operators: 1 });
    const alone = createInitialState(solo);
    expect(rejection(solo, alone, { kind: 'dismiss', operatorId: 0 })).toBe('lastOperator');

    const broke = testWorld({ operators: 2, economy: { startingWallet: 399 } });
    const state = createInitialState(broke);
    expect(rejection(broke, state, { kind: 'dismiss', operatorId: 0 })).toBe('cannotAfford');
  });
});

describe('replay', () => {
  const world = testWorld({ operators: 2, durationTicks: DURATION });

  /** Plays live, as the app does: actions applied to the current state as they happen. */
  function playLive(requests: ReadonlyMap<number, ActionRequest>): {
    final: SimState;
    log: Action[];
  } {
    const log: Action[] = [];
    let state = createInitialState(world);
    while (state.tick < DURATION) {
      const request = requests.get(state.tick);
      if (request) {
        const action = { ...request, tick: state.tick };
        const result = applyAction(world, state, action);
        if (result.ok) {
          state = result.state;
          log.push(action);
        }
      }
      state = step(world, state);
    }
    return { final: state, log };
  }

  it('recomputes the exact live run from its action log', () => {
    const { final, log } = playLive(
      new Map<number, ActionRequest>([
        [100, { kind: 'hire' }],
        [900, { kind: 'hire' }],
        [1500, { kind: 'dismiss', operatorId: 0 }],
        [2600, { kind: 'dismiss', operatorId: 3 }],
      ]),
    );
    expect(log).toHaveLength(4);
    expect(replay(world, log)).toEqual(final);
  });

  it('matches a run with no actions at all', () => {
    expect(replay(world, [])).toEqual(playLive(new Map()).final);
  });

  it('rejects a log that could not have been played', () => {
    expect(() => replay(world, [{ kind: 'dismiss', operatorId: 7, tick: 10 }])).toThrow(
      /rejected: unknownOperator/,
    );
    const outOfOrder: Action[] = [
      { kind: 'hire', tick: 50 },
      { kind: 'hire', tick: 20 },
    ];
    expect(() => replay(world, outOfOrder)).toThrow(/out of order/);
    expect(() => replay(world, [{ kind: 'hire', tick: DURATION }])).toThrow(/shiftOver/);
    // A tampered entry from outside the app is rejected, not crashed on.
    const tampered = [{ kind: 'promote', tick: 10 }] as unknown as Action[];
    expect(() => replay(world, tampered)).toThrow(/rejected: invalidAction/);
  });
});
