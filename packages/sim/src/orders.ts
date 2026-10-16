import { at } from './geometry';
import type { Order, Scenario } from './scenario';

/** Progress of one scenario order. Indexed like `scenario.orders` (by order id). */
export interface OrderProgress {
  /** Outbound dock index the order ships from. */
  readonly dock: number;
  /** Boxes assigned to an operator for this order, delivered or not. */
  readonly claimed: number;
  /** Boxes already brought to the outbound dock. */
  readonly delivered: number;
  /** Tick the last box arrived, or null while the order is still open. */
  readonly shippedTick: number | null;
}

export type OrderOutcome = 'onTime' | 'late';

export function createOrders(scenario: Scenario, dockCount: number): readonly OrderProgress[] {
  return scenario.orders.map((order) => ({
    dock: order.id % dockCount,
    claimed: 0,
    delivered: 0,
    shippedTick: null,
  }));
}

export function isReleased(order: Order, tick: number): boolean {
  return order.releaseTick <= tick;
}

/**
 * The open order that should get the next box: released, still short of boxes, and
 * due soonest (earliest deadline first, then lowest id). Null when none needs a box.
 */
export function nextOrderToPick(
  scenario: Scenario,
  orders: readonly OrderProgress[],
  tick: number,
): Order | null {
  let best: Order | null = null;
  scenario.orders.forEach((order, id) => {
    const progress = at(orders, id);
    if (!isReleased(order, tick) || progress.claimed >= order.quantity) return;
    if (best === null || order.deadlineTick < best.deadlineTick) best = order;
  });
  return best;
}

/** Assigns one more box to the order; its delivery is tracked by `deliverBox`. */
export function claimOrderBox(
  orders: readonly OrderProgress[],
  orderId: number,
): readonly OrderProgress[] {
  return update(orders, orderId, (progress) => ({ ...progress, claimed: progress.claimed + 1 }));
}

/**
 * Records a box arriving at the order's outbound dock, shipping the order when it is
 * complete. @returns the new progress list and the outcome if the order just shipped.
 */
export function deliverBox(
  scenario: Scenario,
  orders: readonly OrderProgress[],
  orderId: number,
  tick: number,
): { orders: readonly OrderProgress[]; shipped: OrderOutcome | null } {
  const order = at(scenario.orders, orderId);
  const progress = at(orders, orderId);
  const delivered = progress.delivered + 1;
  if (delivered > progress.claimed) {
    throw new Error(`Order ${String(orderId)} received a box nobody was assigned`);
  }
  const complete = delivered === order.quantity;
  return {
    orders: update(orders, orderId, () => ({
      ...progress,
      delivered,
      shippedTick: complete ? tick : null,
    })),
    shipped: complete ? (tick <= order.deadlineTick ? 'onTime' : 'late') : null,
  };
}

/** Orders that were released but did not ship: missed when the shift ends. */
export function openOrderCount(
  scenario: Scenario,
  orders: readonly OrderProgress[],
  tick: number,
): number {
  return scenario.orders.filter(
    (order) => isReleased(order, tick) && at(orders, order.id).shippedTick === null,
  ).length;
}

/**
 * Orders whose deadline has passed without shipping on time, as seen at the start of
 * `tick`: a box delivered on the deadline tick itself still counts as on time. An
 * overdue order stays overdue even if it ships later.
 */
export function overdueOrderCount(
  scenario: Scenario,
  orders: readonly OrderProgress[],
  tick: number,
): number {
  return scenario.orders.filter(({ id, deadlineTick }) => {
    if (deadlineTick >= tick) return false;
    const { shippedTick } = at(orders, id);
    return shippedTick === null || shippedTick > deadlineTick;
  }).length;
}

function update(
  orders: readonly OrderProgress[],
  orderId: number,
  change: (progress: OrderProgress) => OrderProgress,
): readonly OrderProgress[] {
  return orders.map((progress, id) => (id === orderId ? change(progress) : progress));
}
