import { isShiftOver } from './clock';
import { at, samePoint, type Point } from './geometry';
import type { Warehouse } from './layout';
import {
  advance,
  hasArrived,
  isHeldUp,
  isMoving,
  Occupancy,
  routeTo,
  walkerPosition,
  type Walker,
} from './movement';
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

/** `returning`: no work available, walking back to the operator's home cell. */
export type OperatorPhase =
  'idle' | 'returning' | 'toPickup' | 'picking' | 'toDropoff' | 'dropping';

export interface Operator extends Walker {
  readonly id: number;
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
  /** Sum over ticks of operators held up by traffic: blocked, or standing aside to give way. */
  readonly congestionTicks: number;
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
    const home = at(warehouse.operatorHomes, id);
    return {
      id,
      from: home,
      to: home,
      progress: 0,
      path: [],
      blockedTicks: 0,
      giveWayTicks: 0,
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
    stats: {
      putaways: 0,
      dispatches: 0,
      trucksUnloaded: 0,
      dockWaitTicks: 0,
      congestionTicks: 0,
    },
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

  // Operators move in id order; each sees the others where they are at that moment.
  const occupancy = new Occupancy(warehouse.grid, state.operators);
  const operators = state.operators.map((operator) => {
    occupancy.remove(operator);
    let next: Operator;
    [next, shared] = stepOperator(warehouse, operator, shared, occupancy);
    occupancy.add(next);
    return next;
  });

  const heldUp = operators.filter(isHeldUp).length;
  const stats = { ...shared.stats, congestionTicks: shared.stats.congestionTicks + heldUp };
  return { tick: state.tick + 1, operators, ...shared, stats };
}

/** Interpolated position between the cells an operator is walking across. */
export function operatorPosition(operator: Operator): Point {
  return walkerPosition(operator);
}

function stepOperator(
  warehouse: Warehouse,
  operator: Operator,
  shared: Shared,
  occupancy: Occupancy,
): [Operator, Shared] {
  switch (operator.phase) {
    case 'idle': {
      const [assigned, next] = assignTask(warehouse, operator, shared);
      if (assigned !== operator) return [assigned, next];
      const home = at(warehouse.operatorHomes, operator.id);
      if (samePoint(operator.from, home)) return [operator, shared];
      return [
        { ...operator, ...routeTo(warehouse.grid, operator.from, home), phase: 'returning' },
        shared,
      ];
    }

    case 'returning': {
      // Work beats walking home: take a task as soon as one appears.
      if (!isMoving(operator)) {
        const [assigned, next] = assignTask(warehouse, operator, shared);
        if (assigned !== operator) return [assigned, next];
      }
      const [walked, next] = move(warehouse, operator, shared, occupancy);
      return hasArrived(walked) ? [{ ...walked, phase: 'idle' }, next] : [walked, next];
    }

    case 'toPickup':
    case 'toDropoff': {
      const [walked, next] = hasArrived(operator)
        ? [operator, shared]
        : move(warehouse, operator, shared, occupancy);
      if (!hasArrived(walked)) return [walked, next];
      return operator.phase === 'toPickup'
        ? [{ ...walked, phase: 'picking', waitTicks: PICK_TICKS }, next]
        : [{ ...walked, phase: 'dropping', waitTicks: DROP_TICKS }, next];
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
          ...routeTo(warehouse.grid, operator.from, task.dropoff),
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

function move(
  warehouse: Warehouse,
  operator: Operator,
  shared: Shared,
  occupancy: Occupancy,
): [Operator, Shared] {
  const { walker, rng } = advance(operator, warehouse.grid, occupancy, shared.rng);
  return [walker, { ...shared, rng }];
}

/** @returns the same operator object when no task is available. */
function assignTask(warehouse: Warehouse, operator: Operator, shared: Shared): [Operator, Shared] {
  const drawn = drawTask(warehouse, shared);
  if (drawn === null) return [operator, shared];

  const { task, next } = drawn;
  const reservation: SlotStatus = task.kind === 'putaway' ? 'incoming' : 'outgoing';
  return [
    {
      ...operator,
      ...routeTo(warehouse.grid, operator.from, task.pickup),
      phase: 'toPickup',
      task,
    },
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
