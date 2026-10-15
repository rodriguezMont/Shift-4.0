import { isShiftOver } from './clock';
import { at, samePoint, type Point } from './geometry';
import type { Warehouse } from './layout';
import { findPath } from './pathfinding';
import {
  claimBox,
  createReceiving,
  hasBoxToUnload,
  liftBox,
  stepReceiving,
  type Receiving,
} from './receiving';
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

/** Unload one box from a docked truck and store it in a slot. */
export interface PutawayTask {
  readonly kind: 'putaway';
  readonly slotId: number;
  readonly itemId: number;
  /** Inbound dock index the box is collected from. */
  readonly dock: number;
  readonly pickup: Point;
  readonly dropoff: Point;
}

/** Take a stored box to an outbound dock. Placeholder until orders drive dispatch (1.4b). */
export interface DispatchTask {
  readonly kind: 'dispatch';
  readonly slotId: number;
  readonly pickup: Point;
  readonly dropoff: Point;
}

export type Task = PutawayTask | DispatchTask;
export type TaskKind = Task['kind'];

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
  readonly trucksUnloaded: number;
  /** Sum over ticks of trucks waiting for a dock; divide by trucks for the average wait. */
  readonly dockWaitTicks: number;
}

/** Everything that changes during a run. Plain data: serialisable and comparable. */
export interface SimState {
  readonly tick: number;
  readonly rng: number;
  readonly operators: readonly Operator[];
  readonly slots: readonly SlotStatus[];
  readonly receiving: Receiving;
  readonly stats: SimStats;
}

/** The part of the state every operator update reads and may change. */
type Shared = Pick<SimState, 'rng' | 'slots' | 'receiving' | 'stats'>;

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

  return {
    tick: 0,
    rng: deriveSeed(level.seed, SIMULATION_STREAM),
    operators,
    slots,
    receiving: createReceiving(warehouse.inboundDocks.length),
    stats: { putaways: 0, dispatches: 0, trucksUnloaded: 0, dockWaitTicks: 0 },
  };
}

/**
 * Advances the simulation by one fixed tick. Pure: the input state is never mutated.
 * Once the shift is over the state is final and is returned unchanged.
 */
export function step({ warehouse, level, scenario }: World, state: SimState): SimState {
  if (isShiftOver(level, state.tick)) return state;

  const inbound = stepReceiving(scenario, state.receiving, state.tick);
  let shared: Shared = {
    rng: state.rng,
    slots: state.slots,
    receiving: inbound.receiving,
    stats: {
      ...state.stats,
      trucksUnloaded: state.stats.trucksUnloaded + inbound.trucksUnloaded,
      dockWaitTicks: state.stats.dockWaitTicks + inbound.receiving.queue.length,
    },
  };
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
      const picked: Shared =
        task.kind === 'putaway'
          ? { ...shared, receiving: liftBox(shared.receiving, task.dock) }
          : { ...shared, slots: withSlot(shared.slots, task.slotId, 'empty') };
      return [
        {
          ...operator,
          ...routeTo(warehouse, operator.from, task.dropoff),
          phase: 'toDropoff',
          carrying: true,
          waitTicks: 0,
        },
        picked,
      ];
    }

    case 'dropping': {
      if (operator.waitTicks > 1)
        return [{ ...operator, waitTicks: operator.waitTicks - 1 }, shared];
      const task = currentTask(operator);
      const { stats } = shared;
      const done: Shared =
        task.kind === 'putaway'
          ? {
              ...shared,
              slots: withSlot(shared.slots, task.slotId, 'stored'),
              stats: { ...stats, putaways: stats.putaways + 1 },
            }
          : { ...shared, stats: { ...stats, dispatches: stats.dispatches + 1 } };
      return [{ ...operator, phase: 'idle', task: null, carrying: false, waitTicks: 0 }, done];
    }
  }
}

function assignTask(warehouse: Warehouse, operator: Operator, shared: Shared): [Operator, Shared] {
  const drawn = drawTask(warehouse, shared);
  if (drawn === null) return [operator, shared];

  const { task, next } = drawn;
  const reservation: SlotStatus = task.kind === 'putaway' ? 'incoming' : 'outgoing';
  return [
    { ...operator, ...routeTo(warehouse, operator.from, task.pickup), phase: 'toPickup', task },
    { ...next, slots: withSlot(next.slots, task.slotId, reservation) },
  ];
}

/**
 * Baseline policy: unload a docked truck into a random free slot, or ship a random
 * stored box. This is the "no automation" reference later decision engines are
 * measured against.
 */
function drawTask(warehouse: Warehouse, shared: Shared): { task: Task; next: Shared } | null {
  const empty = slotIdsWith(shared.slots, 'empty');
  const stored = slotIdsWith(shared.slots, 'stored');
  const canUnload = empty.length > 0 && hasBoxToUnload(shared.receiving);
  if (!canUnload && stored.length === 0) return null;

  const [roll, afterRoll] = nextRandom(shared.rng);
  const claim =
    canUnload && (stored.length === 0 || roll >= DISPATCH_PROBABILITY)
      ? claimBox(shared.receiving)
      : null;
  if (claim !== null) {
    const [slotPick, rng] = randomInt(afterRoll, empty.length);
    const slot = at(warehouse.slots, at(empty, slotPick));
    return {
      task: {
        kind: 'putaway',
        slotId: slot.id,
        itemId: claim.itemId,
        dock: claim.dock,
        pickup: at(warehouse.inboundDocks, claim.dock),
        dropoff: slot.access,
      },
      next: { ...shared, rng, receiving: claim.receiving },
    };
  }

  const [slotPick, afterSlot] = randomInt(afterRoll, stored.length);
  const slot = at(warehouse.slots, at(stored, slotPick));
  const [dockPick, rng] = randomInt(afterSlot, warehouse.outboundDocks.length);
  return {
    task: {
      kind: 'dispatch',
      slotId: slot.id,
      pickup: slot.access,
      dropoff: at(warehouse.outboundDocks, dockPick),
    },
    next: { ...shared, rng },
  };
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
