import type { Point, Rect, Warehouse } from '@shift40/sim';

export type Vec3 = [x: number, y: number, z: number];

/** Maps grid (x, y) to scene (x, height, z), centring the floor on the origin. One cell = one unit. */
/** Centre of a block of cells in scene units, and its size: for floor zones and furniture. */
export function rectToScene(
  warehouse: Warehouse,
  { x, y, width, height }: Rect,
  elevation = 0,
): { position: Vec3; size: [width: number, depth: number] } {
  return {
    position: toScene(warehouse, { x: x + (width - 1) / 2, y: y + (height - 1) / 2 }, elevation),
    size: [width, height],
  };
}

export function toScene(warehouse: Warehouse, point: Point, height = 0): Vec3 {
  const { width, height: depth } = warehouse.grid;
  return [point.x - (width - 1) / 2, height, point.y - (depth - 1) / 2];
}
