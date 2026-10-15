import { useCallback, useEffect, useState } from 'react';
import { DebugView } from './debug/DebugView';
import { Hud, type View } from './hud/Hud';
import { WarehouseScene } from './scene/WarehouseScene';
import { RunnerContext } from './simulation/context';
import { SimulationRunner } from './simulation/runner';

const SEED = 2026;
const OPERATOR_COUNT = 1;

export function App() {
  const [runner] = useState(() => new SimulationRunner(SEED, OPERATOR_COUNT));
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
      if (event.key.toLowerCase() === 'd' && !event.repeat) toggleView();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [toggleView]);

  return (
    <RunnerContext value={runner}>
      <main className="stage">
        {view === 'scene' ? <WarehouseScene /> : <DebugView />}
        <Hud view={view} onToggleView={toggleView} />
      </main>
    </RunnerContext>
  );
}
