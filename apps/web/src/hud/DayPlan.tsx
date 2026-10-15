import { shiftClock, type LevelConfig } from '@shift40/sim';
import { useMemo } from 'react';
import { useRunner, useSimState } from '../simulation/context';
import { formatMinuteOfDay } from './format';

/** What the day's scenario has delivered so far, and when the next arrival is due. */
export function DayPlan() {
  const { world } = useRunner();
  const { tick, receiving } = useSimState();
  const busyDocks = receiving.docks.filter((truck) => truck !== null).length;
  // The scenario is fixed for the run, so the arrival timelines are computed once.
  const { truckTicks, orderTicks } = useMemo(
    () => ({
      truckTicks: world.scenario.trucks.map((t) => t.arrivalTick),
      orderTicks: world.scenario.orders.map((o) => o.releaseTick),
    }),
    [world],
  );

  return (
    <dl aria-label="Day plan">
      <dt>Trucks</dt>
      <dd>
        <Arrivals level={world.level} tick={tick} ticks={truckTicks} />
      </dd>
      <dt>Docks</dt>
      <dd>
        {busyDocks}/{receiving.docks.length} busy
        {receiving.queue.length > 0 && (
          <span className="hud-next"> · {receiving.queue.length} waiting</span>
        )}
      </dd>
      <dt>Orders</dt>
      <dd>
        <Arrivals level={world.level} tick={tick} ticks={orderTicks} />
      </dd>
    </dl>
  );
}

interface ArrivalsProps {
  readonly level: LevelConfig;
  readonly tick: number;
  /** Arrival ticks, sorted ascending. */
  readonly ticks: readonly number[];
}

function Arrivals({ level, tick, ticks }: ArrivalsProps) {
  const arrived = ticks.filter((arrival) => arrival <= tick).length;
  const next = ticks[arrived];
  return (
    <>
      {arrived}/{ticks.length}
      {next !== undefined && (
        <span className="hud-next">
          {' '}
          · next {formatMinuteOfDay(shiftClock(level, next).minuteOfDay)}
        </span>
      )}
    </>
  );
}
