import type { Point } from './geometry';
import type { Grid } from './grid';

const WIDTH = 26;
const HEIGHT = 17;
/** Rows where trucks unload (left wall) and orders leave (right wall). */
const DOCK_ROWS = [4, 8, 12] as const;
const INBOUND_COLUMN = 1;
const OUTBOUND_COLUMN = WIDTH - 2;
const DOCK_ZONE_COLUMNS = 3;
/** Left column of each back-to-back rack pair; the columns between pairs are aisles. */
const RACK_PAIR_COLUMNS = [7, 10, 13, 16] as const;
/** Inclusive row ranges filled with racks; the rows around them are cross-aisles. */
const RACK_ROW_BLOCKS = [
  [2, 6],
  [10, 14],
] as const;

/** A storage position: the blocked rack cell plus the aisle cell it is served from. */
export interface Slot {
  readonly id: number;
  readonly rack: Point;
  readonly access: Point;
}

/** Static floor plan. Never changes during a run; dynamic data lives in `SimState`. */
export interface Warehouse {
  readonly grid: Grid;
  readonly slots: readonly Slot[];
  readonly inboundDocks: readonly Point[];
  readonly outboundDocks: readonly Point[];
  /** Columns along each side wall reserved as the receiving / dispatch staging area. */
  readonly dockZoneColumns: number;
}

export function createWarehouse(): Warehouse {
  const slots: Slot[] = [];
  for (const left of RACK_PAIR_COLUMNS) {
    for (const [top, bottom] of RACK_ROW_BLOCKS) {
      for (let y = top; y <= bottom; y++) {
        // Each rack in a pair faces the aisle on its own side.
        slots.push({ id: slots.length, rack: { x: left, y }, access: { x: left - 1, y } });
        slots.push({ id: slots.length, rack: { x: left + 1, y }, access: { x: left + 2, y } });
      }
    }
  }

  const walkable = new Array<boolean>(WIDTH * HEIGHT).fill(true);
  for (const { rack } of slots) walkable[rack.y * WIDTH + rack.x] = false;

  return {
    grid: { width: WIDTH, height: HEIGHT, walkable },
    slots,
    inboundDocks: DOCK_ROWS.map((y) => ({ x: INBOUND_COLUMN, y })),
    outboundDocks: DOCK_ROWS.map((y) => ({ x: OUTBOUND_COLUMN, y })),
    dockZoneColumns: DOCK_ZONE_COLUMNS,
  };
}
