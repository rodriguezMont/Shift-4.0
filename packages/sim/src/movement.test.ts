import { describe, expect, it } from 'vitest';
import { samePoint, type Point } from './geometry';
import type { Grid } from './grid';
import { advance, hasArrived, Occupancy, routeTo, type Walker } from './movement';

function gridFromRows(rows: readonly string[]): Grid {
  return {
    width: rows[0]?.length ?? 0,
    height: rows.length,
    walkable: rows.flatMap((row) => Array.from(row, (cell) => cell !== '#')),
  };
}

function walkerTo(grid: Grid, from: Point, goal: Point): Walker {
  return { from, ...routeTo(grid, from, goal) };
}

/** Steps walkers in order, each seeing the others, until all arrive or ticks run out. */
function simulate(grid: Grid, walkers: Walker[], ticks: number) {
  let rng = 1;
  const history: Walker[][] = [];
  for (let tick = 0; tick < ticks && !walkers.every(hasArrived); tick++) {
    const occupancy = new Occupancy(grid, walkers);
    walkers = walkers.map((walker) => {
      occupancy.remove(walker);
      const moved = advance(walker, grid, occupancy, rng);
      rng = moved.rng;
      occupancy.add(moved.walker);
      return moved.walker;
    });
    history.push(walkers);
  }
  return { walkers, history };
}

function cellsTaken(walker: Walker): string[] {
  const cells = samePoint(walker.from, walker.to) ? [walker.from] : [walker.from, walker.to];
  return cells.map((c) => `${String(c.x)},${String(c.y)}`);
}

describe('movement through traffic', () => {
  it('waits behind a worker standing in the way instead of walking through them', () => {
    const grid = gridFromRows(['.....']);
    const standing: Walker = {
      from: { x: 2, y: 0 },
      to: { x: 2, y: 0 },
      progress: 0,
      path: [],
      blockedTicks: 0,
      giveWayTicks: 0,
    };
    const walker = walkerTo(grid, { x: 0, y: 0 }, { x: 4, y: 0 });

    const { walkers } = simulate(grid, [walker, standing], 15);

    expect(walkers[0]?.from).toEqual({ x: 1, y: 0 });
    expect(walkers[0]?.blockedTicks).toBeGreaterThan(0);
  });

  it('detours around a blocked cell when another route exists', () => {
    const grid = gridFromRows(['.....', '.....']);
    const standing: Walker = {
      from: { x: 2, y: 0 },
      to: { x: 2, y: 0 },
      progress: 0,
      path: [],
      blockedTicks: 0,
      giveWayTicks: 0,
    };
    const walker = walkerTo(grid, { x: 0, y: 0 }, { x: 4, y: 0 });

    const { walkers } = simulate(grid, [walker, standing], 200);

    expect(walkers[0]?.from).toEqual({ x: 4, y: 0 });
  });

  it('resolves a head-on stand-off in a one-wide corridor using the only side pocket', () => {
    const grid = gridFromRows(['.......', '###.###']);
    const a = walkerTo(grid, { x: 0, y: 0 }, { x: 6, y: 0 });
    const b = walkerTo(grid, { x: 6, y: 0 }, { x: 0, y: 0 });

    const { walkers, history } = simulate(grid, [a, b], 2000);

    expect(walkers.map((w) => w.from)).toEqual([
      { x: 6, y: 0 },
      { x: 0, y: 0 },
    ]);
    for (const tick of history) {
      const taken = tick.flatMap(cellsTaken);
      expect(new Set(taken).size).toBe(taken.length);
    }
  });
});
