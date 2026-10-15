import type { Point, Warehouse } from '@shift40/sim';

export type Vec3 = [x: number, y: number, z: number];

/** Maps grid (x, y) to scene (x, height, z), centring the floor on the origin. One cell = one unit. */
export function toScene(warehouse: Warehouse, point: Point, height = 0): Vec3 {
  const { width, height: depth } = warehouse.grid;
  return [point.x - (width - 1) / 2, height, point.y - (depth - 1) / 2];
}
