import { usePlayback, useRunner } from '../simulation/context';
import { useSelection } from '../simulation/selection';
import { Ledger } from './Ledger';
import { Results } from './Results';
import { ShiftStats } from './ShiftStats';

/** End-of-shift summary. The full report (comparison, system behaviour) lands in step 5.4. */
export function ShiftComplete() {
  const runner = useRunner();
  const { finished } = usePlayback();
  const { select } = useSelection();
  if (!finished) return null;

  return (
    <section className="shift-complete" aria-labelledby="shift-complete-title">
      <h2 id="shift-complete-title">{runner.world.level.title} shift complete</h2>
      <Results />
      <Ledger />
      <ShiftStats />
      <button
        type="button"
        onClick={() => {
          // A new run reuses the starting ids: a kept selection would name someone else.
          select(null);
          runner.restart();
        }}
      >
        Play again
      </button>
    </section>
  );
}
