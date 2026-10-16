import { usePlayback, useRunner } from '../simulation/context';
import { Ledger } from './Ledger';
import { Results } from './Results';
import { ShiftStats } from './ShiftStats';

/** End-of-shift summary. The full report (comparison, system behaviour) lands in step 5.4. */
export function ShiftComplete() {
  const runner = useRunner();
  const { finished } = usePlayback();
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
          runner.restart();
        }}
      >
        Play again
      </button>
    </section>
  );
}
