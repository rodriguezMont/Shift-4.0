import { isShiftOver } from './clock';
import {
  BreakBook,
  choosePlace,
  chooseQueueSpot,
  roomOf,
  targetOf,
  type BreakPlan,
} from './breaks';
import { BREAK_ENDS_AT, needsRest, nextEnergy, speedFactor, type Effort } from './fatigue';
import { at, samePoint, type Point } from './geometry';
import { mayStepAside } from './layout';
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
 * `toBreak`: too tired to work, walking to a reserved place or to the queue.
 * `queueing`: waiting beside a staff-room door for a place to free up.
 * `eating` / `drinking`: on a break at a canteen chair / a café standing place.
 */
export type OperatorPhase =
  | 'idle'
  | 'returning'
  | 'toBreak'
  | 'queueing'
  | 'eating'
  | 'drinking'
  | 'toPickup'
  | 'picking'
  | 'toDropoff'
  | 'dropping';

/** Phases that make up a break, from leaving work to going back to it. */
export const BREAK_PHASES: readonly OperatorPhase[] = ['toBreak', 'queueing', 'eating', 'drinking'];

export interface Operator extends Walker {
  /** Unique within a run and never reused, so views and player actions can name an operator. */
  readonly id: number;
  /** Where the operator starts and waits when idle. */
  readonly home: Point;
  readonly phase: OperatorPhase;
  readonly task: Task | null;
  readonly carrying: boolean;
  readonly waitTicks: number;
  /** Stamina from 0 (exhausted) to 1 (fresh). See `fatigue.ts`. */
  readonly energy: number;
  /** Dismissed: finishes the current task, walks home and leaves the floor. */
  readonly leaving: boolean;
  /** The place or queue spot held for this operator's break; null when not on one. */
  readonly breakPlan: BreakPlan | null;
}

/** A hired operator on the way in, who appears at their home once `tick` is reached. */
export interface Arrival {
  readonly id: number;
  readonly home: Point;
  readonly tick: number;
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
  /** Sum over ticks of operators on a break: walking to it, queueing, eating or drinking. */
  readonly breakTicks: number;
  /** Sum over ticks of operators eating / drinking a coffee / waiting for a place. */
  readonly mealTicks: number;
  readonly coffeeTicks: number;
  readonly queueTicks: number;
  /** Breaks taken in the canteen and in the café. */
  readonly meals: number;
  readonly coffees: number;
  /** Sum over ticks of operators on the payroll, on a break or not. Salaries accrue from it. */
  readonly staffTicks: number;
  /** Operators hired and dismissed by the player; each costs a one-off fee. */
  readonly hires: number;
  readonly dismissals: number;
}

/** Everything that changes during a run. Plain data: serialisable and comparable. */
export interface SimState {
  readonly tick: number;
  readonly rng: number;
  readonly operators: readonly Operator[];
  /** Hired operators not on the floor yet, in hiring order. */
  readonly arrivals: readonly Arrival[];
  /** Id the next hired operator gets; ids are never reused. */
  readonly nextOperatorId: number;
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
  readonly breaks: BreakBook;
}

/** The state at the start of the level's shift, fully determined by the level and its seed. */
export function createInitialState({ warehouse, level, scenario }: World): SimState {
  const stocked = new Set(scenario.initialStock.map(({ slotId }) => slotId));
  const slots = warehouse.slots.map(({ id }): SlotStatus => (stocked.has(id) ? 'stored' : 'empty'));

  const operators = Array.from({ length: level.team.operators }, (_, id) =>
    newOperator(id, at(warehouse.operatorHomes, id)),
  );

  return {
    tick: 0,
    rng: deriveSeed(level.seed, SIMULATION_STREAM),
    operators,
    arrivals: [],
    nextOperatorId: operators.length,
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
      mealTicks: 0,
      coffeeTicks: 0,
      queueTicks: 0,
      meals: 0,
      coffees: 0,
      staffTicks: 0,
      hires: 0,
      dismissals: 0,
    },
  };
}

/** A fresh, idle operator standing at their home. */
function newOperator(id: number, home: Point): Operator {
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
    leaving: false,
    breakPlan: null,
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

  const occupancy = new Occupancy(warehouse.grid, state.operators);
  const { arrived, arrivals } = admitArrivals(state, occupancy);
  const present = [...state.operators, ...arrived];
  const context: Context = {
    world,
    tick: state.tick,
    occupancy,
    breaks: new BreakBook(present.map((operator) => operator.breakPlan)),
  };
  let meals = 0;
  let coffees = 0;
  // Those waiting longest get freed places first, before anyone new can take them.
  // Operators then move in id order; each sees the others where they are at that moment.
  const moved = seatFromQueue(context, present).map((operator) => {
    context.occupancy.remove(operator);
    let next: Operator;
    [next, shared] = stepOperator(context, operator, shared);
    context.occupancy.add(next);
    if (next.phase !== operator.phase && next.phase === 'eating') meals++;
    if (next.phase !== operator.phase && next.phase === 'drinking') coffees++;
    const effort = effortOf(operator, next);
    return { ...next, energy: nextEnergy(next.energy, effort, level.shift.durationTicks) };
  });
  const operators = moved.filter((operator) => !hasLeft(operator));

  const count = (phases: readonly OperatorPhase[]) =>
    operators.filter((operator) => phases.includes(operator.phase)).length;
  const { stats: before } = shared;
  const stats = {
    ...before,
    congestionTicks: before.congestionTicks + operators.filter(isHeldUp).length,
    breakTicks: before.breakTicks + count(BREAK_PHASES),
    mealTicks: before.mealTicks + count(['eating']),
    coffeeTicks: before.coffeeTicks + count(['drinking']),
    queueTicks: before.queueTicks + count(['queueing']),
    meals: before.meals + meals,
    coffees: before.coffees + coffees,
    staffTicks: before.staffTicks + operators.length,
  };
  return {
    tick: state.tick + 1,
    operators,
    arrivals,
    nextOperatorId: state.nextOperatorId,
    ...shared,
    stats,
  };
}

/**
 * Hired operators whose time has come step onto the floor at their home, unless someone
 * is standing there; then they wait for the next tick.
 */
function admitArrivals(
  state: SimState,
  occupancy: Occupancy,
): { arrived: Operator[]; arrivals: readonly Arrival[] } {
  const arrived: Operator[] = [];
  const waiting: Arrival[] = [];
  for (const arrival of state.arrivals) {
    if (arrival.tick > state.tick || occupancy.isOccupied(arrival.home)) {
      waiting.push(arrival);
      continue;
    }
    const operator = newOperator(arrival.id, arrival.home);
    occupancy.add(operator);
    arrived.push(operator);
  }
  return { arrived, arrivals: waiting.length === state.arrivals.length ? state.arrivals : waiting };
}

/**
 * Hands freed places to those queueing, longest wait first (then lowest id). Someone still
 * walking towards the queue is redirected once they reach the next cell.
 */
function seatFromQueue(context: Context, operators: readonly Operator[]): Operator[] {
  const { warehouse } = context.world;
  const queued = operators
    .filter((operator) => operator.breakPlan?.kind === 'queue' && !operator.leaving)
    .filter((operator) => !isMoving(operator))
    .sort((a, b) => queuedSince(a) - queuedSince(b) || a.id - b.id);
  const seated = new Map<number, Operator>();
  for (const operator of queued) {
    const place = choosePlace(warehouse, context.breaks, operator.from);
    if (place === null) break;
    context.breaks.release(operator.breakPlan);
    context.breaks.hold(place);
    seated.set(operator.id, headFor(context, operator, place));
  }
  return operators.map((operator) => seated.get(operator.id) ?? operator);
}

function queuedSince(operator: Operator): number {
  return operator.breakPlan?.kind === 'queue' ? operator.breakPlan.since : Infinity;
}

/** Reserves a place for a tired operator, or a queue spot when every place is taken. */
function startBreak(context: Context, operator: Operator): Operator {
  const { warehouse } = context.world;
  const { breaks, tick } = context;
  // With every queue spot taken too (not possible with today's team cap), wait in place.
  const plan: BreakPlan = choosePlace(warehouse, breaks, operator.from) ??
    chooseQueueSpot(warehouse, breaks, operator.from, tick) ?? {
      kind: 'queue',
      spot: operator.from,
      since: tick,
    };
  breaks.hold(plan);
  return headFor(context, operator, plan);
}

function headFor(context: Context, operator: Operator, plan: BreakPlan): Operator {
  const { warehouse } = context.world;
  return {
    ...operator,
    ...routeTo(warehouse.grid, operator.from, targetOf(warehouse, plan)),
    breakPlan: plan,
    phase: 'toBreak',
  };
}

/** Gives up the place or queue spot and becomes available again. */
function endBreak(context: Context, operator: Operator): Operator {
  context.breaks.release(operator.breakPlan);
  return { ...operator, breakPlan: null, phase: 'idle' };
}

/** A dismissed operator leaves once standing at home with nothing in hand. */
function hasLeft(operator: Operator): boolean {
  return (
    operator.leaving &&
    operator.task === null &&
    operator.breakPlan === null &&
    !isMoving(operator) &&
    samePoint(operator.from, operator.home)
  );
}

/** How hard an operator worked this tick, judged from where they were and are now. */
function effortOf(before: Operator, after: Operator): Effort {
  if (after.phase === 'eating' || after.phase === 'drinking') return after.phase;
  if (after.phase === 'picking' || after.phase === 'dropping') return 'handling';
  if (!samePoint(walkerPosition(before), walkerPosition(after))) {
    return after.carrying ? 'carrying' : 'walking';
  }
  // Standing anywhere (idle, queueing, in traffic) neither tires nor rests.
  return 'still';
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
      // Dismissed: no more work, just the walk home (`step` removes them there).
      if (operator.leaving) {
        return atHome
          ? [operator, shared]
          : [
              { ...operator, ...routeTo(warehouse.grid, operator.from, home), phase: 'returning' },
              shared,
            ];
      }
      // A tired operator finishes the current task, then goes for a break.
      if (needsRest(operator.energy)) return [startBreak(context, operator), shared];
      const [assigned, next] = assignTask(context, operator, shared);
      if (assigned !== operator) return [assigned, next];
      if (atHome) return [operator, shared];
      return [
        { ...operator, ...routeTo(warehouse.grid, operator.from, home), phase: 'returning' },
        shared,
      ];
    }

    case 'returning': {
      // Work beats walking home: take a task as soon as one appears, or a break if tired.
      if (!isMoving(operator) && !operator.leaving) {
        if (needsRest(operator.energy)) return [startBreak(context, operator), shared];
        const [assigned, next] = assignTask(context, operator, shared);
        if (assigned !== operator) return [assigned, next];
      }
      const [walked, next] = move(context, operator, shared);
      return hasArrived(walked) ? [{ ...walked, phase: 'idle' }, next] : [walked, next];
    }

    case 'toBreak': {
      // Dismissed on the way: no break, straight home (from the next cell).
      if (operator.leaving && !isMoving(operator)) return [endBreak(context, operator), shared];
      const [walked, next] = move(context, operator, shared);
      if (!hasArrived(walked)) return [walked, next];
      const plan = currentPlan(walked);
      if (plan.kind === 'queue') return [{ ...walked, phase: 'queueing' }, next];
      const phase = roomOf(warehouse, plan).kind === 'canteen' ? 'eating' : 'drinking';
      return [{ ...walked, phase }, next];
    }

    case 'queueing':
      // Seated from the queue at the start of a tick (`seatFromQueue`); otherwise wait.
      return operator.leaving ? [endBreak(context, operator), shared] : [operator, shared];

    case 'eating':
    case 'drinking': {
      const plan = currentPlan(operator);
      const room = plan.kind === 'place' ? roomOf(warehouse, plan) : null;
      const recovered = room === null || operator.energy >= BREAK_ENDS_AT[room.kind];
      return operator.leaving || recovered
        ? [endBreak(context, operator), shared]
        : [operator, shared];
    }

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
  const { warehouse } = context.world;
  const speed = OPERATOR_SPEED * speedFactor(operator.energy);
  // Giving way never sends someone into a doorway or from the floor into a room.
  const { walker, rng } = advance(
    operator,
    warehouse.grid,
    context.occupancy,
    shared.rng,
    speed,
    (from, to) => mayStepAside(warehouse, from, to),
  );
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

function currentPlan(operator: Operator): BreakPlan {
  if (operator.breakPlan === null) {
    throw new Error(`Operator ${String(operator.id)} is ${operator.phase} without a break plan`);
  }
  return operator.breakPlan;
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
