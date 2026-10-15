import type { SimState } from '@shift40/sim';
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { SimulationRunner } from './runner';

export const RunnerContext = createContext<SimulationRunner | null>(null);

export function useRunner(): SimulationRunner {
  const runner = useContext(RunnerContext);
  if (runner === null) throw new Error('useRunner must be used inside <RunnerContext>');
  return runner;
}

/** Re-renders once per simulation tick. For per-frame motion, read the runner in `useFrame`. */
export function useSimState(): SimState {
  const runner = useRunner();
  return useSyncExternalStore(runner.subscribe, runner.getState);
}
