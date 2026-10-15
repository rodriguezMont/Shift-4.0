import { describe, expect, it } from 'vitest';
import { manhattanDistance, type Point } from './geometry';
import { isWalkable, type Grid } from './grid';
import { findPath } from './pathfinding';

/** Builds a grid from ASCII rows: `#` is blocked, anything else is walkable. */
function gridFromRows(rows: readonly string[]): Grid {
  const width = rows[0]?.length ?? 0;
  return {
    width,
    height: rows.length,
    walkable: rows.flatMap((row) => Array.from(row, (cell) => cell !== '#')),
  };
}

function expectContiguous(start: Point, path: readonly Point[]): void {
  let previous = start;
  for (const cell of path) {
    expect(manhattanDistance(previous, cell)).toBe(1);
    previous = cell;
  }
}

describe('findPath', () => {
  it('finds a shortest path on an open grid', () => {
    const grid = gridFromRows(['.....', '.....', '.....']);
    const start = { x: 0, y: 0 };
    const goal = { x: 4, y: 2 };

    const path = findPath(grid, start, goal);

    expect(path).toHaveLength(manhattanDistance(start, goal));
    expect(path?.at(-1)).toEqual(goal);
    expectContiguous(start, path ?? []);
  });

  it('returns an empty path when start and goal coincide', () => {
    const grid = gridFromRows(['...']);
    expect(findPath(grid, { x: 1, y: 0 }, { x: 1, y: 0 })).toEqual([]);
  });

  it('routes around blocked cells through the only gap', () => {
    const grid = gridFromRows(['..#..', '..#..', '.....']);
    const start = { x: 0, y: 0 };

    const path = findPath(grid, start, { x: 4, y: 0 }) ?? [];

    expect(path).toContainEqual({ x: 2, y: 2 });
    expect(path.every((cell) => isWalkable(grid, cell))).toBe(true);
    expectContiguous(start, path);
  });

  it('returns null when the goal is unreachable or blocked', () => {
    const walledOff = gridFromRows(['..#..', '..#..']);
    expect(findPath(walledOff, { x: 0, y: 0 }, { x: 4, y: 0 })).toBeNull();
    expect(findPath(walledOff, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });
});
