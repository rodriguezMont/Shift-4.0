/**
 * Operator stamina. Energy runs from 0 (exhausted) to 1 (fresh): work drains it, rest
 * restores it, and tired operators walk slower.
 *
 * Rates are expressed per shift, not per tick, so a level's real-time length never
 * changes how tiring a working day is. They are tuned so an operator busy all day hits
 * the break threshold around 11:00 and spends roughly forty minutes recovering.
 */

/** Below this energy an operator takes a break once their current task is done. */
export const REST_BELOW = 0.25;
/** A break lasts until energy is back to this level. */
export const RESUME_AT = 0.9;
/** Walking speed at zero energy, as a share of full speed. */
const EXHAUSTED_SPEED_SHARE = 0.7;

/** Energy spent over a whole shift of doing only this. */
const DRAIN_PER_SHIFT = {
  walking: 1.1,
  /** Extra while walking with a box. */
  carrying: 0.4,
  /** Lifting a box off a truck or shelf, or setting it down. */
  handling: 1.4,
} as const;

/** Energy regained over a whole shift of doing only this. */
const RECOVERY_PER_SHIFT = {
  /** On a break at the rest spot: about 40 game minutes from the threshold to resuming. */
  resting: 7.8,
  /** Standing idle without work. */
  waiting: 0.3,
} as const;

/** What an operator did during a tick, as far as their energy is concerned. */
export type Effort = 'resting' | 'waiting' | 'walking' | 'carrying' | 'handling' | 'still';

const CHANGE_PER_SHIFT: Record<Effort, number> = {
  resting: RECOVERY_PER_SHIFT.resting,
  waiting: RECOVERY_PER_SHIFT.waiting,
  walking: -DRAIN_PER_SHIFT.walking,
  carrying: -(DRAIN_PER_SHIFT.walking + DRAIN_PER_SHIFT.carrying),
  handling: -DRAIN_PER_SHIFT.handling,
  still: 0,
};

/** Energy after one tick of `effort`, in a shift lasting `shiftTicks` ticks. */
export function nextEnergy(energy: number, effort: Effort, shiftTicks: number): number {
  return Math.min(1, Math.max(0, energy + CHANGE_PER_SHIFT[effort] / shiftTicks));
}

/** Multiplier on walking speed: 1 when fresh, down to `EXHAUSTED_SPEED_SHARE` when spent. */
export function speedFactor(energy: number): number {
  return EXHAUSTED_SPEED_SHARE + (1 - EXHAUSTED_SPEED_SHARE) * energy;
}

export function needsRest(energy: number): boolean {
  return energy < REST_BELOW;
}
