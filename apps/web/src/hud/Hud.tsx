import { TICKS_PER_SECOND } from '@shift40/sim';
import { useSimState } from '../simulation/context';

export type View = 'scene' | 'debug';

interface HudProps {
  readonly view: View;
  readonly onToggleView: () => void;
}

export function Hud({ view, onToggleView }: HudProps) {
  const { tick, stats, operators } = useSimState();

  return (
    <aside className="hud" aria-label="Simulation status">
      <h1>Shift 4.0</h1>
      <p>Milestone 0 · movement prototype</p>
      <dl>
        <dt>Elapsed</dt>
        <dd>{formatElapsed(tick)}</dd>
        <dt>Operators</dt>
        <dd>{operators.length}</dd>
        <dt>Put away</dt>
        <dd>{stats.putaways}</dd>
        <dt>Dispatched</dt>
        <dd>{stats.dispatches}</dd>
      </dl>
      <button type="button" onClick={onToggleView}>
        {view === 'scene' ? 'Debug view' : '3D view'} (D)
      </button>
    </aside>
  );
}

function formatElapsed(tick: number): string {
  const seconds = Math.floor(tick / TICKS_PER_SECOND);
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
