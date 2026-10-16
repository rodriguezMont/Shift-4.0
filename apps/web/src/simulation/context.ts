import { economyOf, type Economy, type SimState } from '@shift40/sim';
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Playback, SimulationRunner } from './runner';

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

/** Wallet, score and stars for the current tick, derived by the simulation's economy rules. */
export function useEconomy(): Economy {
  const { world } = useRunner();
  return economyOf(world, useSimState());
}

/** Speed, pause and end-of-shift state; re-renders only when one of them changes. */
export function usePlayback(): Playback {
  const runner = useRunner();
  return useSyncExternalStore(runner.subscribe, runner.getPlayback);
}
