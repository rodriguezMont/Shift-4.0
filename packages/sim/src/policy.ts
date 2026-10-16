/**
 * The baseline policy: how a sensible supervisor runs the floor without automation. It is
 * the reference every decision engine is measured against on the same seed, so it must be
 * reasonable rather than a straw man, and fully deterministic — the same situation always
 * gets the same answer, so a change in results means a change in the game, not noise.
 * See docs/decisions/0001-baseline-policy.md.
 */
import { minutesPerTick } from './clock';
import { at, manhattanDistance, type Point } from './geometry';
import type { Slot, Warehouse } from './layout';
import type { LevelConfig } from './level';
import type { Order } from './scenario';
import type { SlotStatus } from './simulation';

/**
 * An order due within this many game minutes takes priority over unloading. Orders come
 * due 90 to 150 minutes after release, so picking starts early enough to beat the
 * deadline even when tired walkers cross the floor; unloading fills the slack. Chosen
 * from a sweep of 30 to 120 minutes over three seeds (see the ADR).
 */
export const URGENT_WITHIN_MINUTES = 120;

/**
 * Extra distance, in cells, a slot counts for each colleague already heading for a slot
 * in the same aisle: a supervisor spreads people across aisles instead of sending
 * everyone down the one nearest the door.
 */
export const BUSY_AISLE_PENALTY = 12;

export type WorkKind = 'unload' | 'pick';

export interface WorkOptions {
  /** A docked truck has an unclaimed box and there is a free slot to store it in. */
  readonly canUnload: boolean;
  /** The open order that should get the next box (earliest deadline first), if any. */
  readonly order: Order | null;
  readonly tick: number;
  /** See `urgentTicks`. */
  readonly urgentTicks: number;
}

/**
 * What a free operator does next: pick for an order that is about to fall due; otherwise
 * keep the docks moving by unloading; otherwise pick ahead for the next order. Null when
 * there is nothing to do.
 */
export function chooseWork({ canUnload, order, tick, urgentTicks }: WorkOptions): WorkKind | null {
  if (order !== null && order.deadlineTick - tick <= urgentTicks) return 'pick';
  if (canUnload) return 'unload';
  return order === null ? null : 'pick';
}

/** `URGENT_WITHIN_MINUTES` in ticks of this level's shift. */
export function urgentTicks(level: LevelConfig): number {
  return Math.round(URGENT_WITHIN_MINUTES / minutesPerTick(level));
}

/**
 * Of the given slots, the one closest to `target` (a dock) once busy aisles are counted
 * as further away; lowest id on a tie. Boxes go in near the door they came through and
 * leave from near the door they go out of, without crowding one aisle. Straight-line grid
 * distance stands in for walking distance, which it tracks closely on this floor of
 * parallel aisles. `statuses` tells which slots someone is already heading for. Null
 * when `slotIds` is empty.
 */
export function nearestSlot(
  warehouse: Warehouse,
  slotIds: readonly number[],
  target: Point,
  statuses: readonly SlotStatus[],
): Slot | null {
  const busy = new Map<number, number>();
  statuses.forEach((status, id) => {
    if (status !== 'incoming' && status !== 'outgoing') return;
    const aisle = at(warehouse.slots, id).access.x;
    busy.set(aisle, (busy.get(aisle) ?? 0) + 1);
  });
  let best: { slot: Slot; cost: number } | null = null;
  for (const id of slotIds) {
    const slot = at(warehouse.slots, id);
    const cost =
      manhattanDistance(slot.access, target) + BUSY_AISLE_PENALTY * (busy.get(slot.access.x) ?? 0);
    const better =
      best === null || cost < best.cost || (cost === best.cost && slot.id < best.slot.id);
    if (better) best = { slot, cost };
  }
  return best?.slot ?? null;
}
