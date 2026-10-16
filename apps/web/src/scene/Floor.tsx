import type { Rect, StaffRoomKind } from '@shift40/sim';
import { useRunner } from '../simulation/context';
import { palette } from '../palette';
import { rectToScene } from './coords';

const ROOM_FLOOR: Record<StaffRoomKind, string> = {
  canteen: palette.canteenFloor,
  cafe: palette.cafeFloor,
};

/** Ground of every area: the working floor with its dock zones, the staff rooms and the robot area. */
export function Floor() {
  const { warehouse } = useRunner();
  const { floor, dockZoneColumns, staffRooms, robotArea } = warehouse;
  const zone = (x: number): Rect => ({ ...floor, x, width: dockZoneColumns });

  return (
    <group>
      <Ground rect={floor} color={palette.floor} elevation={-0.01} />
      <Ground rect={zone(floor.x)} color={palette.inboundZone} />
      <Ground rect={zone(floor.x + floor.width - dockZoneColumns)} color={palette.outboundZone} />
      {staffRooms.map((room) => (
        <Ground key={room.kind} rect={room.bounds} color={ROOM_FLOOR[room.kind]} />
      ))}
      {/* The room's floor runs through its doorway. */}
      {staffRooms.flatMap((room) =>
        room.doorway.map((gap) => (
          <Ground
            key={`${room.kind}:${String(gap.x)}`}
            rect={{ ...gap, width: 1, height: 1 }}
            color={ROOM_FLOOR[room.kind]}
          />
        )),
      )}
      <Ground rect={robotArea.bounds} color={palette.robotFloor} />

      {[...warehouse.inboundDocks, ...warehouse.outboundDocks].map((dock) => (
        <Ground
          key={`${String(dock.x)}:${String(dock.y)}`}
          rect={{ ...dock, width: 1, height: 1 }}
          inset={0.1}
          color={palette.dockMarker}
          elevation={0.005}
        />
      ))}
    </group>
  );
}

interface GroundProps {
  readonly rect: Rect;
  readonly color: string;
  readonly elevation?: number;
  /** Margin left uncovered on every side, in cells. */
  readonly inset?: number;
}

export function Ground({ rect, color, elevation = 0, inset = 0 }: GroundProps) {
  const { warehouse } = useRunner();
  const { position, size } = rectToScene(warehouse, rect, elevation);
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} receiveShadow>
      <planeGeometry args={[size[0] - 2 * inset, size[1] - 2 * inset]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}
