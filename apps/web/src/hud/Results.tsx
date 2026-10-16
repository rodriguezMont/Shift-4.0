import { useEconomy, usePlayback, useRunner } from '../simulation/context';
import { Money } from './Money';

/** Score, stars and wallet; shared by the HUD and the end-of-shift summary. */
export function Results() {
  const { world } = useRunner();
  const { finished } = usePlayback();
  const { score, stars, wallet } = useEconomy();
  const thresholds = world.level.economy.stars;
  const nextStar = finished ? undefined : thresholds[stars];

  return (
    <dl aria-label="Results">
      <dt>Score</dt>
      <dd>
        {score}
        {nextStar !== undefined && <span className="hud-next"> · next ★ {nextStar}</span>}
      </dd>
      <dt>Stars</dt>
      <dd>
        <span
          className="stars"
          role="img"
          aria-label={`${String(stars)} of ${String(thresholds.length)} stars`}
        >
          {'★'.repeat(stars)}
          {'☆'.repeat(thresholds.length - stars)}
        </span>
      </dd>
      <dt>Wallet</dt>
      <dd>
        <Money amount={wallet} />
      </dd>
    </dl>
  );
}
