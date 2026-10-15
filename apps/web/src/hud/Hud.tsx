import { shiftClock } from '@shift40/sim';
import { usePlayback, useRunner, useSimState } from '../simulation/context';
import { SPEEDS } from '../simulation/runner';
import { formatMinuteOfDay } from './format';
import { ShiftStats } from './ShiftStats';

export type View = 'scene' | 'debug';

interface HudProps {
  readonly view: View;
  readonly onToggleView: () => void;
}

export function Hud({ view, onToggleView }: HudProps) {
  const runner = useRunner();
  const { tick } = useSimState();
  const { level } = runner.world;
  const clock = shiftClock(level, tick);

  return (
    <aside className="hud" aria-label="Shift status">
      <header>
        <h1>Shift 4.0</h1>
        <p>{level.title}</p>
      </header>

      <div className="hud-clock">
        <time aria-label="Shift time">{formatMinuteOfDay(clock.minuteOfDay)}</time>
        <span>{formatMinuteOfDay(level.shift.endMinute)}</span>
      </div>
      <progress max={1} value={clock.progress} aria-label="Shift progress" />

      <PlaybackControls />

      <ShiftStats />

      <button type="button" onClick={onToggleView}>
        {view === 'scene' ? 'Debug view' : '3D view'} (D)
      </button>
    </aside>
  );
}

function PlaybackControls() {
  const runner = useRunner();
  const { speed, paused, finished } = usePlayback();

  return (
    <div className="hud-playback" role="group" aria-label="Playback speed">
      <button
        type="button"
        aria-pressed={paused}
        disabled={finished}
        onClick={() => {
          runner.togglePause();
        }}
      >
        {paused ? 'Resume' : 'Pause'}
      </button>
      {SPEEDS.map((option, index) => (
        <button
          key={option}
          type="button"
          aria-pressed={!paused && speed === option}
          aria-keyshortcuts={String(index + 1)}
          disabled={finished}
          onClick={() => {
            runner.setSpeed(option);
          }}
        >
          {option}×
        </button>
      ))}
    </div>
  );
}
