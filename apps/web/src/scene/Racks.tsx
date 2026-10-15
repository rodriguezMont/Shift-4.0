import { Instance, Instances } from '@react-three/drei';
import { useMemo } from 'react';
import { useRunner, useSimState } from '../simulation/context';
import { palette } from '../palette';
import { toScene, type Vec3 } from './coords';

const RACK_HEIGHT = 1.5;
const SHELF_LEVELS = [0.08, 0.75, 1.42] as const;
const POST_OFFSET = 0.42;
const BOX_SIZE = 0.55;

/** Racks are static, so their parts are instanced once: two draw calls for all of them. */
export function Racks() {
  const { warehouse } = useRunner();

  const { posts, shelves } = useMemo(() => {
    const postPositions: Vec3[] = [];
    const shelfPositions: Vec3[] = [];
    for (const { rack } of warehouse.slots) {
      const [x, , z] = toScene(warehouse, rack);
      for (const dx of [-POST_OFFSET, POST_OFFSET]) {
        for (const dz of [-POST_OFFSET, POST_OFFSET]) {
          postPositions.push([x + dx, RACK_HEIGHT / 2, z + dz]);
        }
      }
      for (const level of SHELF_LEVELS) shelfPositions.push([x, level, z]);
    }
    return { posts: postPositions, shelves: shelfPositions };
  }, [warehouse]);

  return (
    <group>
      <Instances limit={posts.length} castShadow receiveShadow>
        <boxGeometry args={[0.06, RACK_HEIGHT, 0.06]} />
        <meshStandardMaterial color={palette.rackUpright} />
        {posts.map((position, index) => (
          <Instance key={index} position={position} />
        ))}
      </Instances>
      <Instances limit={shelves.length} castShadow receiveShadow>
        <boxGeometry args={[0.92, 0.05, 0.92]} />
        <meshStandardMaterial color={palette.rackShelf} />
        {shelves.map((position, index) => (
          <Instance key={index} position={position} />
        ))}
      </Instances>
    </group>
  );
}

/** Boxes physically on a shelf: stored ones and those reserved for dispatch but not picked yet. */
export function StoredBoxes() {
  const { warehouse } = useRunner();
  const { slots } = useSimState();

  return (
    <Instances limit={warehouse.slots.length} castShadow receiveShadow>
      <boxGeometry args={[BOX_SIZE, BOX_SIZE * 0.8, BOX_SIZE]} />
      <meshStandardMaterial color={palette.box} />
      {warehouse.slots.map((slot) => {
        const status = slots[slot.id];
        if (status !== 'stored' && status !== 'outgoing') return null;
        // Spread boxes across levels so the racks read as shelving, not a flat grid.
        const level = SHELF_LEVELS[slot.id % SHELF_LEVELS.length] ?? 0;
        return (
          <Instance
            key={slot.id}
            position={toScene(warehouse, slot.rack, level + 0.025 + BOX_SIZE * 0.4)}
          />
        );
      })}
    </Instances>
  );
}
