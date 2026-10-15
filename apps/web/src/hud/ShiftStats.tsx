import { useSimState } from '../simulation/context';

/** The shift's running totals; one definition shared by the HUD and the end-of-shift summary. */
export function ShiftStats() {
  const { stats, operators } = useSimState();

  return (
    <dl>
      <dt>Operators</dt>
      <dd>{operators.length}</dd>
      <dt>Put away</dt>
      <dd>{stats.putaways}</dd>
      <dt>Dispatched</dt>
      <dd>{stats.dispatches}</dd>
    </dl>
  );
}
