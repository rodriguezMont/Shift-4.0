import { minutesPerTick } from '@shift40/sim';
import { useRunner, useSimState } from '../simulation/context';

/** The shift's running totals; one definition shared by the HUD and the end-of-shift summary. */
export function ShiftStats() {
  const { world } = useRunner();
  const { stats, operators, receiving } = useSimState();
  const minutes = minutesPerTick(world.level);
  const averageWait =
    receiving.arrived > 0 ? (stats.dockWaitTicks / receiving.arrived) * minutes : 0;
  // Operator-minutes spent waiting for someone to clear the way.
  const lostInAisles = stats.congestionTicks * minutes;

  return (
    <dl>
      <dt>Operators</dt>
      <dd>{operators.length}</dd>
      <dt>Trucks unloaded</dt>
      <dd>{stats.trucksUnloaded}</dd>
      <dt>Avg dock wait</dt>
      <dd>{Math.round(averageWait)} min</dd>
      <dt>Lost in aisles</dt>
      <dd>{Math.round(lostInAisles)} min</dd>
      <dt>Put away</dt>
      <dd>{stats.putaways}</dd>
      <dt>Dispatched</dt>
      <dd>{stats.dispatches}</dd>
    </dl>
  );
}
