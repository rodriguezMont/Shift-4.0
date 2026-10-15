import type { Point } from '@shift40/sim';
import { useRunner } from '../simulation/context';
import { palette } from '../palette';
import { toScene } from './coords';

const TRAILER = { length: 3.2, height: 1.7, width: 1.3 } as const;
const CAB = { length: 1.1, height: 1.25, width: 1.2 } as const;
const DOOR_HEIGHT = 2;

/** Trucks backed up to each dock: unloading on the left wall, loading on the right. */
export function Docks() {
  const { warehouse } = useRunner();
  const wallOffset = 0.5;
  const rightWall = warehouse.grid.width - 1 + wallOffset;

  return (
    <group>
      {warehouse.inboundDocks.map((dock) => (
        <DockBay key={`in-${String(dock.y)}`} wall={{ x: -wallOffset, y: dock.y }} outward={-1} />
      ))}
      {warehouse.outboundDocks.map((dock) => (
        <DockBay key={`out-${String(dock.y)}`} wall={{ x: rightWall, y: dock.y }} outward={1} />
      ))}
    </group>
  );
}

function DockBay({ wall, outward }: { wall: Point; outward: -1 | 1 }) {
  const { warehouse } = useRunner();
  const [x, , z] = toScene(warehouse, wall);
  const trailerX = x + outward * (TRAILER.length / 2 + 0.15);
  const cabX = trailerX + outward * (TRAILER.length / 2 + CAB.length / 2 + 0.1);

  return (
    <group>
      {[-0.7, 0.7].map((dz) => (
        <mesh key={dz} position={[x, DOOR_HEIGHT / 2, z + dz]} castShadow>
          <boxGeometry args={[0.12, DOOR_HEIGHT, 0.12]} />
          <meshStandardMaterial color={palette.dockFrame} />
        </mesh>
      ))}
      <mesh position={[x, DOOR_HEIGHT, z]} castShadow>
        <boxGeometry args={[0.12, 0.12, 1.52]} />
        <meshStandardMaterial color={palette.dockFrame} />
      </mesh>

      <mesh position={[trailerX, TRAILER.height / 2 + 0.25, z]} castShadow receiveShadow>
        <boxGeometry args={[TRAILER.length, TRAILER.height, TRAILER.width]} />
        <meshStandardMaterial color={palette.truckTrailer} />
      </mesh>
      <mesh position={[cabX, CAB.height / 2 + 0.2, z]} castShadow receiveShadow>
        <boxGeometry args={[CAB.length, CAB.height, CAB.width]} />
        <meshStandardMaterial color={palette.truckCab} />
      </mesh>
    </group>
  );
}
