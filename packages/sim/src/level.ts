import { z } from 'zod';
import { TICKS_PER_SECOND } from './clock';
import { MAX_OPERATORS } from './layout';

/** Upper bound on generated arrivals per stream, to keep level files honest about load. */
const MAX_ARRIVALS = 200;

/** Inclusive integer range, e.g. boxes per truck. */
export type Range = readonly [min: number, max: number];

/** A window of the shift where arrivals are `weight` times more likely than elsewhere. */
export interface Peak {
  readonly startMinute: number;
  readonly endMinute: number;
  readonly weight: number;
}

export interface ArrivalStream {
  readonly count: number;
  readonly peaks: readonly Peak[];
}

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
  /** Inputs for the seeded generator that plans the day's trucks and orders. */
  readonly scenario: {
    /** Share of storage slots already holding a box when the shift starts, in [0, 1]. */
    readonly initialStock: number;
    /** Probability that any generated box is fragile, in [0, 1]. */
    readonly fragileRatio: number;
    readonly trucks: ArrivalStream & { readonly boxes: Range };
    readonly orders: ArrivalStream & { readonly boxes: Range; readonly deadlineMinutes: Range };
  };
}

const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected a 24-hour time such as "06:00"')
  .transform((time) => {
    const [hours = 0, minutes = 0] = time.split(':').map(Number);
    return hours * 60 + minutes;
  });

const ratio = z.number().min(0).max(1);

const range = z
  .tuple([z.int().min(1), z.int().min(1)])
  .refine(([min, max]) => min <= max, 'expected [min, max] with min <= max')
  .transform(([min, max]): Range => [min, max]);

const peak = z
  .strictObject({
    at: timeOfDay,
    minutes: z.int().min(1),
    /** How many times more likely an arrival is inside the peak than outside it. */
    weight: z.number().min(1),
  })
  .transform(({ at, minutes, weight }): Peak => ({
    startMinute: at,
    endMinute: at + minutes,
    weight,
  }));

const arrivalStream = {
  count: z.int().min(0).max(MAX_ARRIVALS),
  peaks: z.array(peak).default([]),
};

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
    scenario: z.strictObject({
      initialStock: ratio,
      fragileRatio: ratio,
      trucks: z.strictObject({ ...arrivalStream, boxes: range }),
      orders: z.strictObject({ ...arrivalStream, boxes: range, deadlineMinutes: range }),
    }),
  })
  .refine(({ shift }) => shift.end > shift.start, {
    message: 'the shift must end after it starts',
    path: ['shift', 'end'],
  })
  .transform(({ id, title, seed, shift, team, scenario }): LevelConfig => ({
    id,
    title,
    seed,
    shift: {
      startMinute: shift.start,
      endMinute: shift.end,
      durationTicks: Math.round(shift.durationSeconds * TICKS_PER_SECOND),
    },
    team,
    scenario,
  }));

/** Validates raw level data (e.g. a parsed JSON file), throwing a readable error if invalid. */
export function parseLevel(input: unknown): LevelConfig {
  const result = levelFileSchema.safeParse(input);
  if (!result.success) throw new Error(`Invalid level:\n${z.prettifyError(result.error)}`);
  return result.data;
}
