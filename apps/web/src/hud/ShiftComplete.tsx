import { usePlayback, useRunner } from '../simulation/context';
import { ShiftStats } from './ShiftStats';

/** End-of-shift summary. Placeholder until the full report (score, stars, comparison) lands. */
export function ShiftComplete() {
  const runner = useRunner();
  const { finished } = usePlayback();
  if (!finished) return null;

  return (
    <section className="shift-complete" aria-labelledby="shift-complete-title">
      <h2 id="shift-complete-title">{runner.world.level.title} shift complete</h2>
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
