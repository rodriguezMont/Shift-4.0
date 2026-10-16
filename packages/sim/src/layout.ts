import { samePoint, type Point } from './geometry';
import type { Grid } from './grid';

const WIDTH = 26;
const HEIGHT = 26;

/**
 * The plan from back wall to front wall: the robot area, a wall with no door yet, the
 * warehouse floor, a wall with one door per staff room, then the staff rooms.
 */
const ROBOT_ROWS = { top: 0, bottom: 2 } as const;
const ROBOT_WALL_ROW = 3;
const FLOOR_ROWS = { top: 4, bottom: 20 } as const;
const STAFF_WALL_ROW = 21;
const STAFF_ROWS = { top: 22, bottom: HEIGHT - 1 } as const;

/** Rows where trucks unload (left wall) and orders leave (right wall). */
const DOCK_ROWS = [8, 12, 16] as const;
const INBOUND_COLUMN = 1;
const OUTBOUND_COLUMN = WIDTH - 2;
const DOCK_ZONE_COLUMNS = 3;
/** Operators wait against the receiving wall, off every route, around each dock row. */
const HOME_COLUMN = 0;
const HOME_ROW_OFFSETS = [0, -1, 1, -2] as const;
/** One home cell per operator, so the team size is capped by the floor plan. */
export const MAX_OPERATORS = DOCK_ROWS.length * HOME_ROW_OFFSETS.length;
/** Left column of each back-to-back rack pair; the columns between pairs are aisles. */
const RACK_PAIR_COLUMNS = [7, 10, 13, 16] as const;
/** Inclusive row ranges filled with racks; the rows around them are cross-aisles. */
const RACK_ROW_BLOCKS = [
  [6, 10],
  [14, 18],
] as const;
/** Splits the staff strip into the canteen (receiving side) and the café. */
const STAFF_PARTITION_COLUMN = 13;

/** A storage position: the blocked rack cell plus the aisle cell it is served from. */
export interface Slot {
  readonly id: number;
  readonly rack: Point;
  readonly access: Point;
}

/** An axis-aligned block of cells: `x`/`y` is the top-left cell. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type FurnitureKind = 'table' | 'fridge' | 'counter' | 'coffeeMachine' | 'bistroTable';

/** A piece of furniture; it blocks the cells it stands on. */
export interface Furniture {
  readonly kind: FurnitureKind;
  readonly cells: Rect;
}

export type StaffRoomKind = 'canteen' | 'cafe';

/** A break room off the warehouse floor, entered through its single door. */
export interface StaffRoom {
  readonly kind: StaffRoomKind;
  readonly bounds: Rect;
  /** The gap in the wall between the floor and the room. */
  readonly door: Point;
  /** Where one person sits to eat (canteen) or stands for coffee (café). */
  readonly places: readonly Point[];
  /** Floor cells beside the door where people wait when every place is taken. */
  readonly queue: readonly Point[];
  readonly furniture: readonly Furniture[];
}

/** Where robots will be serviced (Stage 2). Closed off from the floor for now. */
export interface RobotArea {
  readonly bounds: Rect;
  /** Maintenance conveyor cells, in the direction robots ride it: one straight run along a row. */
  readonly conveyor: readonly Point[];
  /** The renewal capsule robots pass through, midway along the conveyor. */
  readonly capsule: Point;
  readonly chargingPads: readonly Point[];
}

/** Static floor plan. Never changes during a run; dynamic data lives in `SimState`. */
export interface Warehouse {
  readonly grid: Grid;
  /** The working floor between the two walls: docks, racks and aisles. */
  readonly floor: Rect;
  readonly slots: readonly Slot[];
  readonly inboundDocks: readonly Point[];
  readonly outboundDocks: readonly Point[];
  /** Columns along each side wall reserved as the receiving / dispatch staging area. */
  readonly dockZoneColumns: number;
  /** Where each operator starts and waits when idle, indexed by operator id. */
  readonly operatorHomes: readonly Point[];
  /** Wall cells between the areas; doors are the gaps left in them. */
  readonly walls: readonly Point[];
  readonly staffRooms: readonly StaffRoom[];
  readonly robotArea: RobotArea;
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

  const staffRooms = createStaffRooms();
  const robotArea = createRobotArea();
  const doors = staffRooms.map(({ door }) => door);
  const wallLines: Point[] = [];
  for (let x = 0; x < WIDTH; x++)
    wallLines.push({ x, y: ROBOT_WALL_ROW }, { x, y: STAFF_WALL_ROW });
  for (let y = STAFF_ROWS.top; y <= STAFF_ROWS.bottom; y++) {
    wallLines.push({ x: STAFF_PARTITION_COLUMN, y });
  }
  const walls = wallLines.filter((cell) => !doors.some((door) => samePoint(door, cell)));

  const walkable = new Array<boolean>(WIDTH * HEIGHT).fill(true);
  const block = ({ x, y }: Point) => {
    walkable[y * WIDTH + x] = false;
  };
  slots.forEach(({ rack }) => {
    block(rack);
  });
  walls.forEach(block);
  for (const room of staffRooms) {
    for (const { cells } of room.furniture) cellsOf(cells).forEach(block);
  }
  // Equipment, not floor: robots will ride the conveyor rather than walk it.
  robotArea.conveyor.forEach(block);

  return {
    grid: { width: WIDTH, height: HEIGHT, walkable },
    floor: rows(FLOOR_ROWS.top, FLOOR_ROWS.bottom),
    slots,
    inboundDocks: DOCK_ROWS.map((y) => ({ x: INBOUND_COLUMN, y })),
    outboundDocks: DOCK_ROWS.map((y) => ({ x: OUTBOUND_COLUMN, y })),
    dockZoneColumns: DOCK_ZONE_COLUMNS,
    // Spread across the docks first, so a small team starts near every door.
    operatorHomes: HOME_ROW_OFFSETS.flatMap((offset) =>
      DOCK_ROWS.map((row) => ({ x: HOME_COLUMN, y: row + offset })),
    ),
    walls,
    staffRooms,
    robotArea,
  };
}

/** Every cell a rectangle covers, row by row. */
export function cellsOf({ x, y, width, height }: Rect): Point[] {
  const cells: Point[] = [];
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) cells.push({ x: x + dx, y: y + dy });
  }
  return cells;
}

/** Whether a cell lies inside a block of cells. */
export function contains({ x, y, width, height }: Rect, point: Point): boolean {
  return point.x >= x && point.x < x + width && point.y >= y && point.y < y + height;
}

/**
 * Giving way never takes someone off the working floor: never into a doorway, and never
 * from the floor into a room. Someone already in a room or a doorway may step anywhere.
 */
export function mayStepAside(warehouse: Warehouse, from: Point, to: Point): boolean {
  if (warehouse.staffRooms.some(({ door }) => samePoint(door, to))) return false;
  return !contains(warehouse.floor, from) || contains(warehouse.floor, to);
}

/** The two floor cells either side of the cell in front of a door, leaving the way in clear. */
function besideDoor(doorX: number): Point[] {
  return [
    { x: doorX - 1, y: FLOOR_ROWS.bottom },
    { x: doorX + 1, y: FLOOR_ROWS.bottom },
  ];
}

function rows(top: number, bottom: number, x = 0, width = WIDTH): Rect {
  return { x, y: top, width, height: bottom - top + 1 };
}

/**
 * Canteen on the receiving side: one table with four chairs, a fridge and a counter.
 * Café on the dispatch side: a coffee counter and two bistro tables with two standing
 * places each. Places sit clear of the doors so nobody seated blocks the way in.
 */
function createStaffRooms(): StaffRoom[] {
  const { top, bottom } = STAFF_ROWS;
  return [
    {
      kind: 'canteen',
      bounds: rows(top, bottom, 0, STAFF_PARTITION_COLUMN),
      door: { x: 4, y: STAFF_WALL_ROW },
      queue: besideDoor(4),
      places: [
        { x: 8, y: top },
        { x: 9, y: top },
        { x: 8, y: top + 2 },
        { x: 9, y: top + 2 },
      ],
      furniture: [
        { kind: 'table', cells: { x: 8, y: top + 1, width: 2, height: 1 } },
        { kind: 'fridge', cells: { x: 0, y: top, width: 1, height: 1 } },
        { kind: 'counter', cells: { x: 0, y: top + 1, width: 1, height: 3 } },
      ],
    },
    {
      kind: 'cafe',
      bounds: rows(top, bottom, STAFF_PARTITION_COLUMN + 1, WIDTH - STAFF_PARTITION_COLUMN - 1),
      door: { x: 19, y: STAFF_WALL_ROW },
      queue: besideDoor(19),
      places: [
        { x: 16, y: top + 2 },
        { x: 18, y: top + 2 },
        { x: 20, y: top + 2 },
        { x: 22, y: top + 2 },
      ],
      furniture: [
        { kind: 'counter', cells: { x: 22, y: top, width: 3, height: 1 } },
        { kind: 'coffeeMachine', cells: { x: WIDTH - 1, y: top, width: 1, height: 1 } },
        { kind: 'bistroTable', cells: { x: 17, y: top + 2, width: 1, height: 1 } },
        { kind: 'bistroTable', cells: { x: 21, y: top + 2, width: 1, height: 1 } },
      ],
    },
  ];
}

/** Maintenance on the receiving side (a conveyor through a capsule), charging beyond it. */
function createRobotArea(): RobotArea {
  const row = ROBOT_ROWS.top + 1;
  const conveyor = Array.from({ length: 12 }, (_, i) => ({ x: 1 + i, y: row }));
  return {
    bounds: rows(ROBOT_ROWS.top, ROBOT_ROWS.bottom),
    conveyor,
    capsule: { x: 6, y: row },
    chargingPads: Array.from({ length: 6 }, (_, i) => ({ x: 14 + 2 * i, y: row })),
  };
}
