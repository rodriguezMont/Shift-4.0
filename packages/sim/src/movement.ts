import { at, samePoint, type Point } from './geometry';
import { cellIndex, isWalkable, type Grid } from './grid';
import { findPath } from './pathfinding';
import { randomInt } from './rng';

/** Cells walked per tick (2.5 cells/s at 10 ticks/s). Must stay below 1. */
export const OPERATOR_SPEED = 0.25;
/** Ticks a worker waits behind someone before looking for another route. */
export const REPLAN_AFTER_TICKS = 5;
/**
 * Ticks before a blocked worker gives way by stepping into any free neighbouring cell.
 * Breaks stand-offs where two workers each need the cell the other is standing on.
 */
export const SIDESTEP_AFTER_TICKS = 20;
/**
 * Ticks a worker who stepped aside stays there, so the other one can pass before it
 * heads back into the aisle. Long enough to clear a few cells at walking speed.
 */
export const GIVE_WAY_TICKS = 16;

const NEIGHBOR_OFFSETS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

/** The moving part of a worker on the grid. */
export interface Walker {
  /** Cell being left, or the cell stood on when not moving. */
  readonly from: Point;
  /** Cell being walked to; equals `from` when not moving. */
  readonly to: Point;
  /** Progress from `from` to `to`, in [0, 1). */
  readonly progress: number;
  /** Cells still to walk after `to`. */
  readonly path: readonly Point[];
  /** Consecutive ticks spent unable to enter the next cell. */
  readonly blockedTicks: number;
  /** Ticks left to wait after stepping aside, before continuing (see `GIVE_WAY_TICKS`). */
  readonly giveWayTicks: number;
}

/**
 * Cells taken by workers during one tick: where each stands and, while moving, the
 * cell it is stepping into. Local scratch state inside a pure `step`.
 */
export class Occupancy {
  private readonly counts = new Map<number, number>();

  constructor(
    private readonly grid: Grid,
    walkers: readonly Walker[],
  ) {
    for (const walker of walkers) this.add(walker);
  }

  readonly isOccupied = (cell: Point): boolean =>
    (this.counts.get(cellIndex(this.grid, cell)) ?? 0) > 0;

  add(walker: Walker): void {
    for (const cell of cellsOf(walker)) {
      const index = cellIndex(this.grid, cell);
      this.counts.set(index, (this.counts.get(index) ?? 0) + 1);
    }
  }

  remove(walker: Walker): void {
    for (const cell of cellsOf(walker)) {
      const index = cellIndex(this.grid, cell);
      this.counts.set(index, (this.counts.get(index) ?? 1) - 1);
    }
  }
}

function cellsOf({ from, to }: Walker): Point[] {
  return samePoint(from, to) ? [from] : [from, to];
}

export function isMoving(walker: Walker): boolean {
  return !samePoint(walker.from, walker.to);
}

/** Whether traffic is costing the walker this tick: blocked, or standing aside to give way. */
export function isHeldUp(walker: Walker): boolean {
  return walker.blockedTicks > 0 || (walker.giveWayTicks > 0 && !isMoving(walker));
}

export function hasArrived(walker: Walker): boolean {
  return !isMoving(walker) && walker.path.length === 0;
}

/** Interpolated position between the cells a walker is crossing. */
export function walkerPosition({ from, to, progress }: Walker): Point {
  return { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress };
}

/**
 * Plans a route on the static floor plan, ignoring other workers (they move; traffic is
 * handled step by step). Throws if the floor plan itself makes the target unreachable.
 */
export function routeTo(
  grid: Grid,
  from: Point,
  target: Point,
): Pick<Walker, 'to' | 'path' | 'progress' | 'blockedTicks' | 'giveWayTicks'> {
  const path = findPath(grid, from, target);
  if (path === null) {
    throw new Error(
      `No route from (${String(from.x)},${String(from.y)}) to (${String(target.x)},${String(target.y)})`,
    );
  }
  return { to: from, path, progress: 0, blockedTicks: 0, giveWayTicks: 0 };
}

/**
 * Moves a walker one tick through traffic. It never enters an occupied cell: it waits,
 * looks for a detour every few blocked ticks, and eventually steps aside.
 * `occupancy` must not include the walker itself. `speed` is in cells per tick, at most
 * `OPERATOR_SPEED` (a tired walker is slower). `mayStepInto` limits where stepping aside
 * may lead.
 */
export function advance<T extends Walker>(
  walker: T,
  grid: Grid,
  occupancy: Occupancy,
  rng: number,
  speed: number = OPERATOR_SPEED,
  mayStepInto: (from: Point, to: Point) => boolean = () => true,
): { walker: T; rng: number } {
  let current = walker;
  let state = rng;
  const blocked = walker.blockedTicks;

  if (!isMoving(current) && blocked > 0) {
    if (blocked >= SIDESTEP_AFTER_TICKS) {
      [current, state] = sidestep(current, grid, occupancy, state, mayStepInto);
    } else if (blocked % REPLAN_AFTER_TICKS === 0) {
      current = detour(current, grid, occupancy);
    }
  }
  return { walker: walk(current, occupancy, speed), rng: state };
}

function walk<T extends Walker>(walker: T, occupancy: Occupancy, speed: number): T {
  let { from, to, path } = walker;
  let progress = walker.progress;

  if (!isMoving(walker)) {
    if (walker.giveWayTicks > 0) return { ...walker, giveWayTicks: walker.giveWayTicks - 1 };
    const [next, ...rest] = path;
    if (next === undefined) return walker;
    if (occupancy.isOccupied(next)) return { ...walker, blockedTicks: walker.blockedTicks + 1 };
    to = next;
    path = rest;
    progress = 0;
  }

  progress += speed;
  while (progress >= 1) {
    from = to;
    const [next, ...rest] = path;
    // Stop on the cell boundary when the route ends, the next cell is taken, or the
    // walker has just stepped aside and must give way first.
    if (next === undefined || walker.giveWayTicks > 0 || occupancy.isOccupied(next)) {
      progress = 0;
      break;
    }
    to = next;
    path = rest;
    progress -= 1;
  }
  return { ...walker, from, to, path, progress, blockedTicks: 0 };
}

/** Re-plans to the same destination, treating every other worker as an obstacle. */
function detour<T extends Walker>(walker: T, grid: Grid, occupancy: Occupancy): T {
  const goal = walker.path.at(-1);
  if (goal === undefined) return walker;
  const path = findPath(grid, walker.from, goal, occupancy.isOccupied);
  return path === null ? walker : { ...walker, path };
}

/** Steps into a random free neighbouring cell, then heads for the destination from there. */
function sidestep<T extends Walker>(
  walker: T,
  grid: Grid,
  occupancy: Occupancy,
  rng: number,
  mayStepInto: (from: Point, to: Point) => boolean,
): [T, number] {
  const free = NEIGHBOR_OFFSETS.map(({ x, y }) => ({
    x: walker.from.x + x,
    y: walker.from.y + y,
  })).filter(
    (cell) =>
      isWalkable(grid, cell) && !occupancy.isOccupied(cell) && mayStepInto(walker.from, cell),
  );
  if (free.length === 0) return [walker, rng];

  const [pick, next] = randomInt(rng, free.length);
  const aside = at(free, pick);
  const goal = walker.path.at(-1) ?? walker.from;
  const onward = findPath(grid, aside, goal) ?? [];
  // Start moving into the free cell now and hold there once arrived, letting the other pass.
  return [
    {
      ...walker,
      to: aside,
      path: onward,
      progress: 0,
      blockedTicks: 0,
      giveWayTicks: GIVE_WAY_TICKS,
    },
    next,
  ];
}
