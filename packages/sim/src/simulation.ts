import { isShiftOver } from './clock';
import { at, samePoint, type Point } from './geometry';
import type { Warehouse } from './layout';
import { findPath } from './pathfinding';
import { deriveSeed, nextRandom, randomInt } from './rng';
import type { World } from './world';

/** Cells walked per tick (2.5 cells/s at 10 ticks/s). Must stay below 1. */
export const OPERATOR_SPEED = 0.25;
export const PICK_TICKS = 8;
export const DROP_TICKS = 8;
const DISPATCH_PROBABILITY = 0.4;
/** Random stream id for the simulation; the scenario generator draws from its own stream. */
const SIMULATION_STREAM = 0;

/**
 * `incoming` and `outgoing` reserve a slot while a box is on its way in or out,
 * so two workers can never be sent to the same position.
 */
export type SlotStatus = 'empty' | 'incoming' | 'stored' | 'outgoing';

export type TaskKind = 'putaway' | 'dispatch';

export interface Task {
  readonly kind: TaskKind;
  readonly slotId: number;
  readonly pickup: Point;
  readonly dropoff: Point;
}

export type OperatorPhase = 'idle' | 'toPickup' | 'picking' | 'toDropoff' | 'dropping';

export interface Operator {
  readonly id: number;
  /** Cell being left, or the cell stood on when not moving. */
  readonly from: Point;
  /** Cell being walked to; equals `from` when not moving. */
  readonly to: Point;
  /** Progress from `from` to `to`, in [0, 1). */
  readonly progress: number;
  /** Cells still to walk after `to`. */
  readonly path: readonly Point[];
  readonly phase: OperatorPhase;
  readonly task: Task | null;
  readonly carrying: boolean;
  readonly waitTicks: number;
}

export interface SimStats {
  readonly putaways: number;
  readonly dispatches: number;
}

/** Everything that changes during a run. Plain data: serialisable and comparable. */
export interface SimState {
  readonly tick: number;
  readonly rng: number;
  readonly operators: readonly Operator[];
  readonly slots: readonly SlotStatus[];
  readonly stats: SimStats;
}

/** The part of the state every operator update reads and may change. */
type Shared = Pick<SimState, 'rng' | 'slots' | 'stats'>;

/** The state at the start of the level's shift, fully determined by the level and its seed. */
export function createInitialState({ warehouse, level, scenario }: World): SimState {
  const stocked = new Set(scenario.initialStock.map(({ slotId }) => slotId));
  const slots = warehouse.slots.map(({ id }): SlotStatus => (stocked.has(id) ? 'stored' : 'empty'));

  const operators = Array.from({ length: level.team.operators }, (_, id): Operator => {
    const spawn = at(warehouse.inboundDocks, id % warehouse.inboundDocks.length);
    return {
      id,
      from: spawn,
      to: spawn,
      progress: 0,
      path: [],
      phase: 'idle',
      task: null,
      carrying: false,
      waitTicks: 0,
    };
  });

  const rng = deriveSeed(level.seed, SIMULATION_STREAM);
  return { tick: 0, rng, operators, slots, stats: { putaways: 0, dispatches: 0 } };
}

/**
 * Advances the simulation by one fixed tick. Pure: the input state is never mutated.
 * Once the shift is over the state is final and is returned unchanged.
 */
export function step({ warehouse, level }: World, state: SimState): SimState {
  if (isShiftOver(level, state.tick)) return state;
  let shared: Shared = { rng: state.rng, slots: state.slots, stats: state.stats };
  const operators = state.operators.map((operator) => {
    let next: Operator;
    [next, shared] = stepOperator(warehouse, operator, shared);
    return next;
  });
  return { tick: state.tick + 1, operators, ...shared };
}

/** Interpolated position between the cells an operator is walking across. */
export function operatorPosition(operator: Operator): Point {
  const { from, to, progress } = operator;
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}

function stepOperator(
  warehouse: Warehouse,
  operator: Operator,
  shared: Shared,
): [Operator, Shared] {
  switch (operator.phase) {
    case 'idle':
      return assignTask(warehouse, operator, shared);

    case 'toPickup':
    case 'toDropoff': {
      const walked = hasArrived(operator) ? operator : walk(operator);
      if (!hasArrived(walked)) return [walked, shared];
      return operator.phase === 'toPickup'
        ? [{ ...walked, phase: 'picking', waitTicks: PICK_TICKS }, shared]
        : [{ ...walked, phase: 'dropping', waitTicks: DROP_TICKS }, shared];
    }

    case 'picking': {
      if (operator.waitTicks > 1)
        return [{ ...operator, waitTicks: operator.waitTicks - 1 }, shared];
      const task = currentTask(operator);
      const slots =
        task.kind === 'dispatch' ? withSlot(shared.slots, task.slotId, 'empty') : shared.slots;
      return [
        {
          ...operator,
          ...routeTo(warehouse, operator.from, task.dropoff),
          phase: 'toDropoff',
          carrying: true,
          waitTicks: 0,
        },
        { ...shared, slots },
      ];
    }

    case 'dropping': {
      if (operator.waitTicks > 1)
        return [{ ...operator, waitTicks: operator.waitTicks - 1 }, shared];
      const task = currentTask(operator);
      const { putaways, dispatches } = shared.stats;
      const done: Shared =
        task.kind === 'putaway'
          ? {
              ...shared,
              slots: withSlot(shared.slots, task.slotId, 'stored'),
              stats: { putaways: putaways + 1, dispatches },
            }
          : { ...shared, stats: { putaways, dispatches: dispatches + 1 } };
      return [{ ...operator, phase: 'idle', task: null, carrying: false, waitTicks: 0 }, done];
    }
  }
}

function assignTask(warehouse: Warehouse, operator: Operator, shared: Shared): [Operator, Shared] {
  const drawn = drawTask(warehouse, shared);
  if (drawn === null) return [operator, shared];

  const { task, rng } = drawn;
  const reservation: SlotStatus = task.kind === 'putaway' ? 'incoming' : 'outgoing';
  return [
    { ...operator, ...routeTo(warehouse, operator.from, task.pickup), phase: 'toPickup', task },
    { ...shared, rng, slots: withSlot(shared.slots, task.slotId, reservation) },
  ];
}

/**
 * Baseline policy: a random free or stored slot and a random dock. This is the
 * "no automation" reference later decision engines will be measured against.
 */
function drawTask(warehouse: Warehouse, shared: Shared): { task: Task; rng: number } | null {
  const empty = slotIdsWith(shared.slots, 'empty');
  const stored = slotIdsWith(shared.slots, 'stored');
  if (empty.length === 0 && stored.length === 0) return null;

  const [roll, afterRoll] = nextRandom(shared.rng);
  const kind: TaskKind =
    empty.length === 0 || (stored.length > 0 && roll < DISPATCH_PROBABILITY)
      ? 'dispatch'
      : 'putaway';
  const candidates = kind === 'dispatch' ? stored : empty;
  const [slotPick, afterSlot] = randomInt(afterRoll, candidates.length);
  const slot = at(warehouse.slots, at(candidates, slotPick));

  const docks = kind === 'putaway' ? warehouse.inboundDocks : warehouse.outboundDocks;
  const [dockPick, rng] = randomInt(afterSlot, docks.length);
  const dock = at(docks, dockPick);
  const task: Task =
    kind === 'putaway'
      ? { kind, slotId: slot.id, pickup: dock, dropoff: slot.access }
      : { kind, slotId: slot.id, pickup: slot.access, dropoff: dock };
  return { task, rng };
}

function walk(operator: Operator): Operator {
  let { from, to, path } = operator;
  let progress = operator.progress + OPERATOR_SPEED;
  while (progress >= 1) {
    from = to;
    const [next, ...rest] = path;
    if (next === undefined) {
      progress = 0;
      break;
    }
    to = next;
    path = rest;
    progress -= 1;
  }
  return { ...operator, from, to, path, progress };
}

function hasArrived(operator: Operator): boolean {
  return samePoint(operator.from, operator.to) && operator.path.length === 0;
}

function routeTo(
  warehouse: Warehouse,
  from: Point,
  target: Point,
): Pick<Operator, 'to' | 'path' | 'progress'> {
  const path = findPath(warehouse.grid, from, target);
  if (path === null) {
    throw new Error(
      `No route from (${String(from.x)},${String(from.y)}) to (${String(target.x)},${String(target.y)})`,
    );
  }
  const [first, ...rest] = path;
  return { to: first ?? from, path: rest, progress: 0 };
}

function currentTask(operator: Operator): Task {
  if (operator.task === null) {
    throw new Error(`Operator ${String(operator.id)} is ${operator.phase} without a task`);
  }
  return operator.task;
}

function slotIdsWith(slots: readonly SlotStatus[], status: SlotStatus): number[] {
  const ids: number[] = [];
  slots.forEach((slot, id) => {
    if (slot === status) ids.push(id);
  });
  return ids;
}

function withSlot(
  slots: readonly SlotStatus[],
  slotId: number,
  status: SlotStatus,
): readonly SlotStatus[] {
  return slots.map((current, id) => (id === slotId ? status : current));
}
