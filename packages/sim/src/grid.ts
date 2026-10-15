import type { Point } from './geometry';

export interface Grid {
  readonly width: number;
  readonly height: number;
  /** Row-major walkability flags; `false` marks a blocked cell such as a rack. */
  readonly walkable: readonly boolean[];
}

export function cellIndex(grid: Grid, point: Point): number {
  return point.y * grid.width + point.x;
}

export function pointAt(grid: Grid, index: number): Point {
  return { x: index % grid.width, y: Math.floor(index / grid.width) };
}

export function isInBounds(grid: Grid, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < grid.width && point.y < grid.height;
}

export function isWalkable(grid: Grid, point: Point): boolean {
  return isInBounds(grid, point) && grid.walkable[cellIndex(grid, point)] === true;
}
