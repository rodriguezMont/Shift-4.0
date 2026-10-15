import { LEVELS } from '@shift40/sim';
import { useCallback, useEffect, useState } from 'react';
import { DebugView } from './debug/DebugView';
import { Hud, type View } from './hud/Hud';
import { ShiftComplete } from './hud/ShiftComplete';
import { WarehouseScene } from './scene/WarehouseScene';
import { RunnerContext } from './simulation/context';
import { withDevOverrides } from './simulation/devOverrides';
import { SimulationRunner, SPEEDS } from './simulation/runner';

const FIRST_LEVEL = LEVELS[0];

export function App() {
  const [runner] = useState(() => {
    if (FIRST_LEVEL === undefined) throw new Error('No levels are defined');
    return new SimulationRunner(withDevOverrides(FIRST_LEVEL));
  });
  const [view, setView] = useState<View>('scene');
  const toggleView = useCallback(() => {
    setView((current) => (current === 'scene' ? 'debug' : 'scene'));
  }, []);

  useEffect(() => {
    runner.start();
    return () => {
      runner.stop();
    };
  }, [runner]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTextEntry(event.target)) return;
      const speed = SPEEDS[Number(event.key) - 1];
      if (speed !== undefined) {
        runner.setSpeed(speed);
      } else if (event.key.toLowerCase() === 'd') {
        toggleView();
      } else if (event.code === 'Space') {
        event.preventDefault();
        runner.togglePause();
      }
    };
    // Space always means pause, even when a button has focus. Buttons activate on keyup,
    // so the native click has to be blocked there too or it would undo the pause.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' && !isTextEntry(event.target)) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [runner, toggleView]);

  return (
    <RunnerContext value={runner}>
      <main className="stage">
        {view === 'scene' ? <WarehouseScene /> : <DebugView />}
        <Hud view={view} onToggleView={toggleView} />
        <ShiftComplete />
      </main>
    </RunnerContext>
  );
}

/** Shortcuts must not fire while the player is typing (e.g. a nickname). */
function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'))
  );
}
