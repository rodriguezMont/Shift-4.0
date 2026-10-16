import { BREAK_PHASES, minutesPerTick, openOrderCount, overdueOrderCount } from '@shift40/sim';
import { usePlayback, useRunner, useSimState } from '../simulation/context';

/** The shift's running totals; one definition shared by the HUD and the end-of-shift summary. */
export function ShiftStats() {
  const { world } = useRunner();
  const { tick, stats, operators, receiving, orders } = useSimState();
  const { finished } = usePlayback();
  const minutes = minutesPerTick(world.level);
  const averageWait =
    receiving.arrived > 0 ? (stats.dockWaitTicks / receiving.arrived) * minutes : 0;
  // Operator-minutes spent waiting for someone to clear the way.
  const lostInAisles = stats.congestionTicks * minutes;
  // Released but not shipped: still open during the shift, missed once it is over.
  const open = openOrderCount(world.scenario, orders, tick);
  // Past their deadline before shipping: each one cost score and money when it fell due.
  const overdue = overdueOrderCount(world.scenario, orders, tick);
  const onBreak = operators.filter((operator) => BREAK_PHASES.includes(operator.phase)).length;
  const averageEnergy =
    operators.reduce((sum, operator) => sum + operator.energy, 0) / Math.max(operators.length, 1);

  return (
    <dl>
      <dt>Orders shipped</dt>
      <dd>
        {stats.ordersShipped}/{world.scenario.orders.length}
      </dd>
      <dt>Overdue</dt>
      <dd>{overdue}</dd>
      <dt>Shipped late</dt>
      <dd>{stats.ordersLate}</dd>
      <dt>{finished ? 'Missed orders' : 'Open orders'}</dt>
      <dd>{open}</dd>
      <dt>Operators</dt>
      <dd>
        {operators.length}
        {onBreak > 0 && <span className="hud-next"> · {onBreak} on break</span>}
      </dd>
      <dt>Avg energy</dt>
      <dd>{Math.round(averageEnergy * 100)}%</dd>
      <dt>Break time</dt>
      <dd>{Math.round(stats.breakTicks * minutes)} min</dd>
      <dt>Meals · coffees</dt>
      <dd>
        {stats.meals} · {stats.coffees}
      </dd>
      <dt>Queue for a break</dt>
      <dd>{Math.round(stats.queueTicks * minutes)} min</dd>
      <dt>Trucks unloaded</dt>
      <dd>{stats.trucksUnloaded}</dd>
      <dt>Avg dock wait</dt>
      <dd>{Math.round(averageWait)} min</dd>
      <dt>Lost in aisles</dt>
      <dd>{Math.round(lostInAisles)} min</dd>
      <dt>Put away</dt>
      <dd>{stats.putaways}</dd>
      <dt>Boxes shipped</dt>
      <dd>{stats.dispatches}</dd>
    </dl>
  );
}
