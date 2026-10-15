import { MAX_OPERATORS, type LevelConfig } from '@shift40/sim';

/**
 * Development-only tweaks read from the URL, e.g. `?operators=8` to test crowded aisles
 * before hiring exists. Ignored in production builds, so shipped levels stay as designed.
 */
export function withDevOverrides(level: LevelConfig): LevelConfig {
  if (!import.meta.env.DEV) return level;

  const operators = Number(new URLSearchParams(window.location.search).get('operators'));
  if (!Number.isInteger(operators) || operators < 1 || operators > MAX_OPERATORS) return level;
  return { ...level, team: { ...level.team, operators } };
}
