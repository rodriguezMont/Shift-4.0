import { z } from 'zod';
import { TICKS_PER_SECOND } from './clock';

/** Upper bound on the starting team; keeps level files within what the floor plan can hold. */
const MAX_OPERATORS = 12;

/** A level as the simulation consumes it: validated, with times resolved to numbers. */
export interface LevelConfig {
  readonly id: string;
  readonly title: string;
  readonly seed: number;
  readonly shift: {
    /** Minutes since midnight. */
    readonly startMinute: number;
    readonly endMinute: number;
    /** Length of the shift in simulation ticks at 1x speed. */
    readonly durationTicks: number;
  };
  readonly team: {
    readonly operators: number;
  };
}

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected a 24-hour time such as "06:00"')
  .transform((time) => {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
  });

/** Schema for level files: human-friendly on disk, strict about unknown keys. */
const levelFileSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'expected a kebab-case id'),
    title: z.string().min(1),
    seed: z.int().min(0).max(0xffffffff),
    shift: z.strictObject({
      start: timeOfDay,
      end: timeOfDay,
      /** Real seconds the shift lasts at 1x speed. At least one, so it spans whole ticks. */
      durationSeconds: z.number().min(1),
    }),
    team: z.strictObject({
      operators: z.int().min(1).max(MAX_OPERATORS),
    }),
  })
  .refine(({ shift }) => shift.end > shift.start, {
    message: 'the shift must end after it starts',
    path: ['shift', 'end'],
  })
  .transform(({ id, title, seed, shift, team }): LevelConfig => ({
    id,
    title,
    seed,
    shift: {
      startMinute: shift.start,
      endMinute: shift.end,
      durationTicks: Math.round(shift.durationSeconds * TICKS_PER_SECOND),
    },
    team,
  }));

/** Validates raw level data (e.g. a parsed JSON file), throwing a readable error if invalid. */
export function parseLevel(input: unknown): LevelConfig {
  const result = levelFileSchema.safeParse(input);
  if (!result.success) throw new Error(`Invalid level:\n${z.prettifyError(result.error)}`);
  return result.data;
}
