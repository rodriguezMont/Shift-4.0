import { isShiftOver } from './clock';
import { needsRest, nextEnergy, RESUME_AT, speedFactor, type Effort } from './fatigue';
import { at, samePoint, type Point } from './geometry';
import {
  advance,
  hasArrived,
  isHeldUp,
  isMoving,
  Occupancy,
  OPERATOR_SPEED,
  routeTo,
  walkerPosition,
  type Walker,
} from './movement';
import {
  claimOrderBox,
  createOrders,
  deliverBox,
  nextOrderToPick,
  type OrderProgress,
} from './orders';
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
/** When an operator could either unload a truck or pick for an order, the share that picks. */
const ORDER_PICK_SHARE = 0.5;
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

/** Pick a stored box for an order and bring it to the order's outbound dock. */
export interface DispatchTask {
  readonly kind: 'dispatch';
  readonly slotId: number;
  readonly orderId: number;
  readonly pickup: Point;
  readonly dropoff: Point;
}

export type Task = PutawayTask | DispatchTask;
export type TaskKind = Task['kind'];

/**
 * `returning`: no work available, walking back to the operator's home cell.
 * `toBreak` / `resting`: too tired to work, walking home for a break / on it.
 */
export type OperatorPhase =
  'idle' | 'returning' | 'toBreak' | 'resting' | 'toPickup' | 'picking' | 'toDropoff' | 'dropping';

export interface Operator extends Walker {
  /** Unique within a run and never reused, so views and player actions can name an operator. */
  readonly id: number;
  /** Where the operator starts, waits when idle and takes breaks. */
  readonly home: Point;
  readonly phase: OperatorPhase;
  readonly task: Task | null;
  readonly carrying: boolean;
  readonly waitTicks: number;
  /** Stamina from 0 (exhausted) to 1 (fresh). See `fatigue.ts`. */
  readonly energy: number;
}

export interface SimStats {
  readonly putaways: number;
  /** Boxes delivered to outbound docks for orders. */
  readonly dispatches: number;
  readonly ordersShipped: number;
  /** Shipped orders whose last box arrived after the deadline. */
  readonly ordersLate: number;
  readonly trucksUnloaded: number;
  /** Sum over ticks of trucks waiting for a dock; divide by trucks for the average wait. */
  readonly dockWaitTicks: number;
  /** Sum over ticks of operators held up by traffic: blocked, or standing aside to give way. */
  readonly congestionTicks: number;
  /** Sum over ticks of operators on a break. */
  readonly breakTicks: number;
  /** Sum over ticks of operators on the payroll, on a break or not. Salaries accrue from it. */
  readonly staffTicks: number;
}

/** Everything that changes during a run. Plain data: serialisable and comparable. */
export interface SimState {
  readonly tick: number;
  readonly rng: number;
  readonly operators: readonly Operator[];
  readonly slots: readonly SlotStatus[];
  readonly receiving: Receiving;
  /** One entry per scenario order, indexed by order id. */
  readonly orders: readonly OrderProgress[];
  readonly stats: SimStats;
}

/** The part of the state every operator update reads and may change. */
type Shared = Pick<SimState, 'rng' | 'slots' | 'receiving' | 'orders' | 'stats'>;

/** What an operator update can read but not change during one tick. */
interface Context {
  readonly world: World;
  readonly tick: number;
  readonly occupancy: Occupancy;
}

/** The state at the start of the level's shift, fully determined by the level and its seed. */
export function createInitialState({ warehouse, level, scenario }: World): SimState {
  const stocked = new Set(scenario.initialStock.map(({ slotId }) => slotId));
  const slots = warehouse.slots.map(({ id }): SlotStatus => (stocked.has(id) ? 'stored' : 'empty'));

  const operators = Array.from({ length: level.team.operators }, (_, id): Operator => {
    const home = at(warehouse.operatorHomes, id);
    return {
      id,
      home,
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
      energy: 1,
    };
  });

  return {
    tick: 0,
    rng: deriveSeed(level.seed, SIMULATION_STREAM),
    operators,
    slots,
    receiving: createReceiving(warehouse.inboundDocks.length),
    orders: createOrders(scenario, warehouse.outboundDocks.length),
    stats: {
      putaways: 0,
      dispatches: 0,
      ordersShipped: 0,
      ordersLate: 0,
      trucksUnloaded: 0,
      dockWaitTicks: 0,
      congestionTicks: 0,
      breakTicks: 0,
      staffTicks: 0,
    },
  };
}

/**
 * Advances the simulation by one fixed tick. Pure: the input state is never mutated.
 * Once the shift is over the state is final and is returned unchanged.
 */
export function step(world: World, state: SimState): SimState {
  const { warehouse, level, scenario } = world;
  if (isShiftOver(level, state.tick)) return state;

  const inbound = stepReceiving(scenario, state.receiving, state.tick);
  let shared: Shared = {
    rng: state.rng,
    slots: state.slots,
    receiving: inbound.receiving,
    orders: state.orders,
    stats: {
      ...state.stats,
      trucksUnloaded: state.stats.trucksUnloaded + inbound.trucksUnloaded,
      dockWaitTicks: state.stats.dockWaitTicks + inbound.receiving.queue.length,
    },
  };

  // Operators move in id order; each sees the others where they are at that moment.
  const context: Context = {
    world,
    tick: state.tick,
    occupancy: new Occupancy(warehouse.grid, state.operators),
  };
  const operators = state.operators.map((operator) => {
    context.occupancy.remove(operator);
    let next: Operator;
    [next, shared] = stepOperator(context, operator, shared);
    context.occupancy.add(next);
    const effort = effortOf(operator, next);
    return { ...next, energy: nextEnergy(next.energy, effort, level.shift.durationTicks) };
  });

  const heldUp = operators.filter(isHeldUp).length;
  const onBreak = operators.filter((operator) => operator.phase === 'resting').length;
  const stats = {
    ...shared.stats,
    congestionTicks: shared.stats.congestionTicks + heldUp,
    breakTicks: shared.stats.breakTicks + onBreak,
    staffTicks: shared.stats.staffTicks + operators.length,
  };
  return { tick: state.tick + 1, operators, ...shared, stats };
}

/** How hard an operator worked this tick, judged from where they were and are now. */
function effortOf(before: Operator, after: Operator): Effort {
  if (after.phase === 'resting') return 'resting';
  if (after.phase === 'picking' || after.phase === 'dropping') return 'handling';
  if (!samePoint(walkerPosition(before), walkerPosition(after))) {
    return after.carrying ? 'carrying' : 'walking';
  }
  // Standing idle recovers a little; standing in traffic neither tires nor rests.
  return after.phase === 'idle' ? 'waiting' : 'still';
}

/** The operator with this id, wherever it sits in the list; null once it is gone. */
export function operatorById(operators: readonly Operator[], id: number): Operator | null {
  return operators.find((operator) => operator.id === id) ?? null;
}

/** Interpolated position between the cells an operator is walking across. */
export function operatorPosition(operator: Operator): Point {
  return walkerPosition(operator);
}

function stepOperator(context: Context, operator: Operator, shared: Shared): [Operator, Shared] {
  const { warehouse, scenario } = context.world;
  switch (operator.phase) {
    case 'idle': {
      const { home } = operator;
      const atHome = samePoint(operator.from, home);
      // A tired operator finishes the current task, then takes a break at home.
      if (needsRest(operator.energy)) {
        return atHome
          ? [{ ...operator, phase: 'resting' }, shared]
          : [
              { ...operator, ...routeTo(warehouse.grid, operator.from, home), phase: 'toBreak' },
              shared,
            ];
      }
      const [assigned, next] = assignTask(context, operator, shared);
      if (assigned !== operator) return [assigned, next];
      if (atHome) return [operator, shared];
      return [
        { ...operator, ...routeTo(warehouse.grid, operator.from, home), phase: 'returning' },
        shared,
      ];
    }

    case 'returning': {
      // Work beats walking home: take a task as soon as one appears.
      if (!isMoving(operator) && !needsRest(operator.energy)) {
        const [assigned, next] = assignTask(context, operator, shared);
        if (assigned !== operator) return [assigned, next];
      }
      const [walked, next] = move(context, operator, shared);
      if (!hasArrived(walked)) return [walked, next];
      return [{ ...walked, phase: needsRest(walked.energy) ? 'resting' : 'idle' }, next];
    }

    case 'toBreak': {
      const [walked, next] = move(context, operator, shared);
      return hasArrived(walked) ? [{ ...walked, phase: 'resting' }, next] : [walked, next];
    }

    case 'resting':
      return operator.energy >= RESUME_AT
        ? [{ ...operator, phase: 'idle' }, shared]
        : [operator, shared];

    case 'toPickup':
    case 'toDropoff': {
      const [walked, next] = hasArrived(operator)
        ? [operator, shared]
        : move(context, operator, shared);
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
      let done: Shared;
      if (task.kind === 'putaway') {
        done = {
          ...shared,
          slots: withSlot(shared.slots, task.slotId, 'stored'),
          stats: { ...stats, putaways: stats.putaways + 1 },
        };
      } else {
        const delivery = deliverBox(scenario, shared.orders, task.orderId, context.tick);
        done = {
          ...shared,
          orders: delivery.orders,
          stats: {
            ...stats,
            dispatches: stats.dispatches + 1,
            ordersShipped: stats.ordersShipped + (delivery.shipped ? 1 : 0),
            ordersLate: stats.ordersLate + (delivery.shipped === 'late' ? 1 : 0),
          },
        };
      }
      return [{ ...operator, phase: 'idle', task: null, carrying: false, waitTicks: 0 }, done];
    }
  }
}

function move(context: Context, operator: Operator, shared: Shared): [Operator, Shared] {
  const { grid } = context.world.warehouse;
  const speed = OPERATOR_SPEED * speedFactor(operator.energy);
  const { walker, rng } = advance(operator, grid, context.occupancy, shared.rng, speed);
  return [walker, { ...shared, rng }];
}

/** @returns the same operator object when no task is available. */
function assignTask(context: Context, operator: Operator, shared: Shared): [Operator, Shared] {
  const drawn = drawTask(context, shared);
  if (drawn === null) return [operator, shared];

  const { task, next } = drawn;
  const reservation: SlotStatus = task.kind === 'putaway' ? 'incoming' : 'outgoing';
  return [
    {
      ...operator,
      ...routeTo(context.world.warehouse.grid, operator.from, task.pickup),
      phase: 'toPickup',
      task,
    },
    { ...next, slots: withSlot(next.slots, task.slotId, reservation) },
  ];
}

/**
 * Baseline policy — the "no automation" reference later decision engines are measured
 * against. Unload a docked truck into a random free slot, or pick a random stored box
 * for the open order due soonest; when both are possible, choose at random.
 */
function drawTask(context: Context, shared: Shared): { task: Task; next: Shared } | null {
  const { warehouse, scenario } = context.world;
  const empty = slotIdsWith(shared.slots, 'empty');
  const stored = slotIdsWith(shared.slots, 'stored');
  const canUnload = empty.length > 0 && hasBoxToUnload(shared.receiving);
  const order = stored.length > 0 ? nextOrderToPick(scenario, shared.orders, context.tick) : null;
  if (!canUnload && order === null) return null;

  const [roll, afterRoll] = nextRandom(shared.rng);
  const claim =
    canUnload && (order === null || roll >= ORDER_PICK_SHARE) ? claimBox(shared.receiving) : null;
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
  if (order === null) return null;

  const [slotPick, rng] = randomInt(afterRoll, stored.length);
  const slot = at(warehouse.slots, at(stored, slotPick));
  const { dock } = at(shared.orders, order.id);
  return {
    task: {
      kind: 'dispatch',
      slotId: slot.id,
      orderId: order.id,
      pickup: slot.access,
      dropoff: at(warehouse.outboundDocks, dock),
    },
    next: { ...shared, rng, orders: claimOrderBox(shared.orders, order.id) },
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
