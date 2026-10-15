import monday from '../levels/monday.json';
import { parseLevel, type LevelConfig } from './level';

/** The campaign, in play order. Level files are validated when this module loads. */
export const LEVELS: readonly LevelConfig[] = [monday].map(parseLevel);
