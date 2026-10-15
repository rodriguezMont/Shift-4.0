import { manhattanDistance, type Point } from './geometry';
import { cellIndex, isWalkable, pointAt, type Grid } from './grid';
import { MinHeap } from './heap';

/** Fixed neighbour order keeps tie-breaking, and therefore every run, deterministic. */
const NEIGHBOR_OFFSETS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

interface OpenNode {
  readonly index: number;
  readonly g: number;
  readonly h: number;
  readonly order: number;
}

function compareNodes(a: OpenNode, b: OpenNode): number {
  return a.g + a.h - (b.g + b.h) || a.h - b.h || a.order - b.order;
}

/**
 * Shortest 4-connected path using A* with a Manhattan heuristic.
 *
 * `isBlocked` adds temporary obstacles on top of the grid (e.g. other workers); it is
 * never applied to `goal`, so a route can lead up to a cell someone is standing on.
 *
 * @returns the cells to walk, excluding `start` and including `goal` (empty when they
 * coincide), or `null` when either end is blocked or the goal is unreachable.
 */
export function findPath(
  grid: Grid,
  start: Point,
  goal: Point,
  isBlocked: (cell: Point) => boolean = () => false,
): Point[] | null {
  if (!isWalkable(grid, start) || !isWalkable(grid, goal)) return null;

  const startIndex = cellIndex(grid, start);
  const goalIndex = cellIndex(grid, goal);
  const cellCount = grid.width * grid.height;
  const cameFrom = new Int32Array(cellCount).fill(-1);
  const bestG = new Float64Array(cellCount).fill(Infinity);
  const open = new MinHeap(compareNodes);
  let order = 0;

  bestG[startIndex] = 0;
  open.push({ index: startIndex, g: 0, h: manhattanDistance(start, goal), order: order++ });

  for (let node = open.pop(); node !== undefined; node = open.pop()) {
    if (node.index === goalIndex) return reconstructPath(grid, cameFrom, startIndex, goalIndex);
    // Skip stale heap entries superseded by a cheaper route found later.
    if (node.g > (bestG[node.index] ?? Infinity)) continue;

    const current = pointAt(grid, node.index);
    for (const offset of NEIGHBOR_OFFSETS) {
      const neighbor = { x: current.x + offset.x, y: current.y + offset.y };
      if (!isWalkable(grid, neighbor)) continue;
      const neighborIndex = cellIndex(grid, neighbor);
      if (neighborIndex !== goalIndex && isBlocked(neighbor)) continue;

      const g = node.g + 1;
      if (g >= (bestG[neighborIndex] ?? Infinity)) continue;

      bestG[neighborIndex] = g;
      cameFrom[neighborIndex] = node.index;
      open.push({ index: neighborIndex, g, h: manhattanDistance(neighbor, goal), order: order++ });
    }
  }
  return null;
}

function reconstructPath(
  grid: Grid,
  cameFrom: Int32Array,
  startIndex: number,
  goalIndex: number,
): Point[] {
  const path: Point[] = [];
  for (let index = goalIndex; index !== startIndex; index = cameFrom[index] ?? startIndex) {
    path.push(pointAt(grid, index));
  }
  return path.reverse();
}
