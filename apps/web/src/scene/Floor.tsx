import { useRunner } from '../simulation/context';
import { palette } from '../palette';
import { toScene } from './coords';

export function Floor() {
  const { warehouse } = useRunner();
  const { width, height } = warehouse.grid;
  const zoneColumns = warehouse.dockZoneColumns;
  const middleRow = (height - 1) / 2;

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={palette.floor} />
      </mesh>

      <mesh
        rotation-x={-Math.PI / 2}
        position={toScene(warehouse, { x: (zoneColumns - 1) / 2, y: middleRow }, 0)}
        receiveShadow
      >
        <planeGeometry args={[zoneColumns, height]} />
        <meshStandardMaterial color={palette.inboundZone} />
      </mesh>
      <mesh
        rotation-x={-Math.PI / 2}
        position={toScene(warehouse, { x: width - (zoneColumns + 1) / 2, y: middleRow }, 0)}
        receiveShadow
      >
        <planeGeometry args={[zoneColumns, height]} />
        <meshStandardMaterial color={palette.outboundZone} />
      </mesh>

      {[...warehouse.inboundDocks, ...warehouse.outboundDocks].map((dock) => (
        <mesh
          key={`${String(dock.x)}:${String(dock.y)}`}
          rotation-x={-Math.PI / 2}
          position={toScene(warehouse, dock, 0.005)}
          receiveShadow
        >
          <planeGeometry args={[0.8, 0.8]} />
          <meshStandardMaterial color={palette.dockMarker} />
        </mesh>
      ))}
    </group>
  );
}
