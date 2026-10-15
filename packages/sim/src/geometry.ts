/** A cell coordinate on the warehouse grid (or a fractional position between cells). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattanDistance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Indexes an array, throwing instead of silently yielding `undefined` when out of range. */
export function at<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) {
    throw new RangeError(`Index ${String(index)} out of range (length ${String(items.length)})`);
  }
  return item;
}
