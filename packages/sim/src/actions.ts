/**
 * Player actions and the action log. A run is fully determined by its level (and seed)
 * plus the list of actions the player took, each stamped with the tick it applies to.
 * The same rules validate an action live and when a log is replayed, so a server can
 * recompute any run from its log and reject one that could not have been played.
 */
import { isShiftOver, minutesPerTick } from './clock';
import { economyOf } from './economy';
import { samePoint } from './geometry';
import { createInitialState, operatorById, step, type SimState } from './simulation';
import type { World } from './world';

/** What the player asks for; the tick is added when the action is taken. */
export type ActionRequest =
  { readonly kind: 'hire' } | { readonly kind: 'dismiss'; readonly operatorId: number };

/** An entry of the action log: applied to the state at `tick`, before that tick runs. */
export type Action = ActionRequest & { readonly tick: number };

export type ActionError =
  | 'invalidAction'
  | 'shiftOver'
  | 'wrongTick'
  | 'cannotAfford'
  | 'teamFull'
  | 'unknownOperator'
  | 'alreadyLeaving'
  | 'lastOperator';

export type ActionResult =
  | { readonly ok: true; readonly state: SimState }
  | { readonly ok: false; readonly error: ActionError };

/** Why the player cannot hire right now, or null if they can. */
export function hireBlocker(world: World, state: SimState): ActionError | null {
  if (isShiftOver(world.level, state.tick)) return 'shiftOver';
  if (state.operators.length + state.arrivals.length >= world.warehouse.operatorHomes.length) {
    return 'teamFull';
  }
  if (economyOf(world, state).wallet < world.level.economy.hiringFee) return 'cannotAfford';
  return null;
}

/** Why the player cannot dismiss this operator right now, or null if they can. */
export function dismissBlocker(
  world: World,
  state: SimState,
  operatorId: number,
): ActionError | null {
  if (isShiftOver(world.level, state.tick)) return 'shiftOver';
  const operator = operatorById(state.operators, operatorId);
  if (operator === null) return 'unknownOperator';
  if (operator.leaving) return 'alreadyLeaving';
  // Someone has to stay: the floor never runs with nobody on the payroll.
  if (state.operators.filter((other) => !other.leaving).length <= 1) return 'lastOperator';
  if (economyOf(world, state).wallet < world.level.economy.dismissalCost) return 'cannotAfford';
  return null;
}

/** Validates and applies one action. Pure: the input state is never mutated. */
export function applyAction(world: World, state: SimState, action: Action): ActionResult {
  if (action.tick !== state.tick) return { ok: false, error: 'wrongTick' };
  // Logs may come from outside (a replay on the server): never trust the shape.
  switch (action.kind) {
    case 'hire': {
      const error = hireBlocker(world, state);
      return error === null ? { ok: true, state: hire(world, state) } : { ok: false, error };
    }
    case 'dismiss': {
      const error = dismissBlocker(world, state, action.operatorId);
      return error === null
        ? { ok: true, state: dismiss(state, action.operatorId) }
        : { ok: false, error };
    }
    default:
      return { ok: false, error: 'invalidAction' };
  }
}

/**
 * Plays a whole shift from its first tick, applying each logged action at its tick.
 * Throws if the log is out of order or holds an action the rules reject.
 */
export function replay(world: World, actions: readonly Action[]): SimState {
  let state = createInitialState(world);
  let next = 0;
  for (;;) {
    for (let action = actions[next]; action?.tick === state.tick; action = actions[next]) {
      const result = applyAction(world, state, action);
      if (!result.ok) {
        throw new Error(
          `Action ${String(next)} (${action.kind} at tick ${String(action.tick)}) was rejected: ${result.error}`,
        );
      }
      state = result.state;
      next++;
    }
    if (isShiftOver(world.level, state.tick)) break;
    state = step(world, state);
  }
  if (next < actions.length) {
    throw new Error(`Action ${String(next)} is out of order or after the end of the shift`);
  }
  return state;
}

/** Ticks between hiring an operator and their arrival, from the level's game minutes. */
export function hireDelayTicks(world: World): number {
  return Math.round(world.level.team.hireDelayMinutes / minutesPerTick(world.level));
}

function hire(world: World, state: SimState): SimState {
  const taken = [...state.operators, ...state.arrivals].map(({ home }) => home);
  const home = world.warehouse.operatorHomes.find(
    (candidate) => !taken.some((used) => samePoint(used, candidate)),
  );
  // `hireBlocker` guarantees a free home whenever the team is below the cap.
  if (home === undefined) throw new Error('No free home for a new operator');
  return {
    ...state,
    arrivals: [
      ...state.arrivals,
      { id: state.nextOperatorId, home, tick: state.tick + hireDelayTicks(world) },
    ],
    nextOperatorId: state.nextOperatorId + 1,
    stats: { ...state.stats, hires: state.stats.hires + 1 },
  };
}

function dismiss(state: SimState, operatorId: number): SimState {
  return {
    ...state,
    operators: state.operators.map((operator) =>
      operator.id === operatorId ? { ...operator, leaving: true } : operator,
    ),
    stats: { ...state.stats, dismissals: state.stats.dismissals + 1 },
  };
}
