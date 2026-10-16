/**
 * Operator stamina. Energy runs from 0 (exhausted) to 1 (fresh): work drains it, and only
 * a break restores it — eating a meal in the canteen or having a coffee in the café.
 * Standing around, in a room or anywhere else, restores nothing.
 *
 * Rates are expressed per shift, not per tick, so a level's real-time length never
 * changes how tiring a working day is. They are tuned so an operator busy all day hits
 * the break threshold around 11:00.
 */
import type { StaffRoomKind } from './layout';

/** Below this energy an operator takes a break once their current task is done. */
export const REST_BELOW = 0.25;
/** A break lasts until energy is back to this level: a meal restores more than a coffee. */
export const BREAK_ENDS_AT: Record<StaffRoomKind, number> = { canteen: 0.9, cafe: 0.6 };
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
  /** Seated meal: about 40 game minutes from the break threshold back to 90%. */
  eating: 7.8,
  /** Standing coffee: quicker, about 12 game minutes from the threshold back to 60%. */
  drinking: 14,
} as const;

/** What an operator did during a tick, as far as their energy is concerned. */
export type Effort = 'eating' | 'drinking' | 'walking' | 'carrying' | 'handling' | 'still';

const CHANGE_PER_SHIFT: Record<Effort, number> = {
  eating: RECOVERY_PER_SHIFT.eating,
  drinking: RECOVERY_PER_SHIFT.drinking,
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
