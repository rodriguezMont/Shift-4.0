import { describe, expect, it } from 'vitest';
import { claimOrderBox, createOrders, deliverBox, nextOrderToPick, openOrderCount } from './orders';
import type { Order, Scenario } from './scenario';

const order = (id: number, releaseTick: number, deadlineTick: number, quantity: number): Order => ({
  id,
  releaseTick,
  deadlineTick,
  quantity,
});

function scenarioWith(orders: readonly Order[]): Scenario {
  return { items: [], initialStock: [], trucks: [], orders };
}

describe('orders', () => {
  const scenario = scenarioWith([order(0, 0, 500, 2), order(1, 0, 300, 1), order(2, 100, 200, 1)]);

  it('picks for the released order due soonest', () => {
    const orders = createOrders(scenario, 3);
    expect(nextOrderToPick(scenario, orders, 50)?.id).toBe(1);
    // Order 2 is due even sooner, but only once it has been released.
    expect(nextOrderToPick(scenario, orders, 100)?.id).toBe(2);
  });

  it('moves on once an order has all the boxes it needs assigned', () => {
    const orders = claimOrderBox(createOrders(scenario, 3), 1);
    expect(nextOrderToPick(scenario, orders, 50)?.id).toBe(0);
  });

  it('ships an order on its last box, on time or late against its deadline', () => {
    let orders = createOrders(scenario, 3);
    orders = claimOrderBox(claimOrderBox(orders, 0), 0);

    const first = deliverBox(scenario, orders, 0, 400);
    expect(first.shipped).toBeNull();
    const second = deliverBox(scenario, first.orders, 0, 450);
    expect(second.shipped).toBe('onTime');
    expect(second.orders[0]?.shippedTick).toBe(450);

    const late = deliverBox(scenario, claimOrderBox(orders, 1), 1, 301);
    expect(late.shipped).toBe('late');
  });

  it('refuses a delivery nobody was assigned', () => {
    expect(() => deliverBox(scenario, createOrders(scenario, 3), 0, 10)).toThrow(/nobody/);
  });

  it('counts released orders that have not shipped as open', () => {
    const orders = createOrders(scenario, 3);
    expect(openOrderCount(scenario, orders, 50)).toBe(2);
    expect(openOrderCount(scenario, orders, 150)).toBe(3);
  });

  it('spreads orders across the outbound docks', () => {
    expect(createOrders(scenario, 3).map((o) => o.dock)).toEqual([0, 1, 2]);
  });
});
