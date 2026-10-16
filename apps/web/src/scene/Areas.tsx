import { Instance, Instances } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Furniture, Point, StaffRoom } from '@shift40/sim';
import { useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useRunner } from '../simulation/context';
import { palette } from '../palette';
import { rectToScene, toScene, type Vec3 } from './coords';

/** Low, cut-away walls, so the isometric camera still sees what is behind them. */
const WALL_HEIGHT = 0.55;
const TABLE_HEIGHT = 0.72;
const COUNTER_HEIGHT = 0.9;
const BISTRO_HEIGHT = 1.05;
const SEAT_HEIGHT = 0.45;
const CONVEYOR_HEIGHT = 0.35;
/** Slats on the belt, spaced one cell apart, sliding along at this many cells per second. */
const BELT_SPEED = 0.6;
/** The renewal capsule spans a little more than one cell of belt. */
const CAPSULE_LENGTH = 1.6;

/** Walls, the furnished staff rooms and the robot area, all drawn from the floor plan. */
export function Areas() {
  const { warehouse } = useRunner();
  return (
    <group>
      <Walls />
      {warehouse.staffRooms.map((room) => (
        <StaffRoomFurniture key={room.kind} room={room} />
      ))}
      <RobotEquipment />
    </group>
  );
}

function Walls() {
  const { warehouse } = useRunner();
  const positions = useMemo(
    () => warehouse.walls.map((wall) => toScene(warehouse, wall, WALL_HEIGHT / 2)),
    [warehouse],
  );
  return (
    <Instances limit={positions.length} castShadow receiveShadow>
      <boxGeometry args={[1, WALL_HEIGHT, 1]} />
      <meshStandardMaterial color={palette.wall} />
      {positions.map((position, index) => (
        <Instance key={index} position={position} />
      ))}
    </Instances>
  );
}

function StaffRoomFurniture({ room }: { readonly room: StaffRoom }) {
  return (
    <group>
      {room.furniture.map((piece, index) => (
        <FurniturePiece key={index} piece={piece} />
      ))}
      {room.places.map((place) =>
        room.kind === 'canteen' ? (
          <Chair key={key(place)} place={place} room={room} />
        ) : (
          <StandingSpot key={key(place)} place={place} />
        ),
      )}
    </group>
  );
}

function FurniturePiece({ piece }: { readonly piece: Furniture }) {
  const { warehouse } = useRunner();
  const { position, size } = rectToScene(warehouse, piece.cells);
  const [width, depth] = size;
  const [x, , z] = position;

  switch (piece.kind) {
    case 'table':
      return (
        <group position={[x, 0, z]}>
          <Box
            size={[width - 0.1, 0.06, depth - 0.2]}
            at={[0, TABLE_HEIGHT, 0]}
            color={palette.furnitureWood}
          />
          {[-1, 1].flatMap((sx) =>
            [-1, 1].map((sz) => (
              <Box
                key={`${String(sx)}${String(sz)}`}
                size={[0.06, TABLE_HEIGHT, 0.06]}
                at={[sx * (width / 2 - 0.15), TABLE_HEIGHT / 2, sz * (depth / 2 - 0.2)]}
                color={palette.furnitureDark}
              />
            )),
          )}
        </group>
      );
    case 'fridge':
      return (
        <group position={[x, 0, z]}>
          <Box size={[0.8, 1.7, 0.8]} at={[0, 0.85, 0]} color={palette.furnitureLight} />
          <Box size={[0.04, 0.5, 0.05]} at={[0.36, 1.15, 0.42]} color={palette.furnitureDark} />
        </group>
      );
    case 'counter':
      return (
        <group position={[x, 0, z]}>
          <Box
            size={[width - 0.1, COUNTER_HEIGHT, depth - 0.1]}
            at={[0, COUNTER_HEIGHT / 2, 0]}
            color={palette.furnitureLight}
          />
          <Box
            size={[width - 0.05, 0.05, depth - 0.05]}
            at={[0, COUNTER_HEIGHT, 0]}
            color={palette.furnitureWood}
          />
        </group>
      );
    case 'coffeeMachine':
      return (
        <group position={[x, 0, z]}>
          <Box
            size={[0.9, COUNTER_HEIGHT, 0.9]}
            at={[0, COUNTER_HEIGHT / 2, 0]}
            color={palette.furnitureLight}
          />
          <Box
            size={[0.5, 0.6, 0.45]}
            at={[0, COUNTER_HEIGHT + 0.3, 0]}
            color={palette.furnitureDark}
          />
          <mesh position={[-0.26, COUNTER_HEIGHT + 0.45, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#ef4444" toneMapped={false} />
          </mesh>
        </group>
      );
    case 'bistroTable':
      return (
        <group position={[x, 0, z]}>
          <mesh position={[0, BISTRO_HEIGHT / 2, 0]} castShadow>
            <cylinderGeometry args={[0.04, 0.04, BISTRO_HEIGHT, 8]} />
            <meshStandardMaterial color={palette.furnitureDark} />
          </mesh>
          <mesh position={[0, BISTRO_HEIGHT, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.05, 20]} />
            <meshStandardMaterial color={palette.furnitureWood} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
            <meshStandardMaterial color={palette.furnitureDark} />
          </mesh>
        </group>
      );
  }
}

/** A chair facing the canteen table: its back is on the side away from the table. */
function Chair({ place, room }: { readonly place: Point; readonly room: StaffRoom }) {
  const { warehouse } = useRunner();
  const table = room.furniture.find((piece) => piece.kind === 'table');
  const awayFromTable = table && place.y < table.cells.y ? -1 : 1;
  const [x, , z] = toScene(warehouse, place);
  return (
    <group position={[x, 0, z]}>
      <Box size={[0.42, 0.05, 0.42]} at={[0, SEAT_HEIGHT, 0]} color={palette.furnitureWood} />
      <Box
        size={[0.42, 0.42, 0.05]}
        at={[0, SEAT_HEIGHT + 0.22, awayFromTable * 0.19]}
        color={palette.furnitureWood}
      />
      <Box
        size={[0.05, SEAT_HEIGHT, 0.05]}
        at={[0, SEAT_HEIGHT / 2, 0]}
        color={palette.furnitureDark}
      />
    </group>
  );
}

/** A floor marker where one person stands for coffee. */
function StandingSpot({ place }: { readonly place: Point }) {
  const { warehouse } = useRunner();
  return (
    <mesh rotation-x={-Math.PI / 2} position={toScene(warehouse, place, 0.006)}>
      <ringGeometry args={[0.2, 0.26, 24]} />
      <meshStandardMaterial color={palette.furnitureWood} />
    </mesh>
  );
}

/** Maintenance conveyor through the renewal capsule, and induction charging pads. */
function RobotEquipment() {
  const { warehouse } = useRunner();
  const { conveyor, capsule, chargingPads } = warehouse.robotArea;
  const first = conveyor[0];
  const last = conveyor[conveyor.length - 1];
  const slats = useRef<Group>(null);

  useFrame(({ clock }) => {
    // Slats slide along the belt and wrap every cell: a hint of motion, nothing to read.
    if (slats.current) slats.current.position.x = (clock.elapsedTime * BELT_SPEED) % 1;
  });

  if (!first || !last) return null;
  const length = last.x - first.x + 1;
  const [startX, , beltZ] = toScene(warehouse, first);
  const centerX = startX + (length - 1) / 2;
  const [capsuleX, , capsuleZ] = toScene(warehouse, capsule);

  return (
    <group>
      <Box
        size={[length, CONVEYOR_HEIGHT, 0.8]}
        at={[centerX, CONVEYOR_HEIGHT / 2, beltZ]}
        color={palette.conveyorFrame}
      />
      <Box
        size={[length, 0.03, 0.66]}
        at={[centerX, CONVEYOR_HEIGHT + 0.01, beltZ]}
        color={palette.conveyorBelt}
      />
      <group ref={slats}>
        {Array.from({ length: length - 1 }, (_, i) => (
          <Box
            key={i}
            size={[0.06, 0.02, 0.62]}
            at={[startX + i, CONVEYOR_HEIGHT + 0.035, beltZ]}
            color={palette.conveyorFrame}
          />
        ))}
      </group>

      {/* The capsule: a glass pod around the belt, lit rings where robots enter and leave. */}
      <group position={[capsuleX, CONVEYOR_HEIGHT + 0.3, capsuleZ]}>
        <mesh rotation-z={Math.PI / 2}>
          <capsuleGeometry args={[0.46, CAPSULE_LENGTH - 0.92, 8, 24]} />
          <meshStandardMaterial
            color={palette.charge}
            transparent
            opacity={0.3}
            depthWrite={false}
          />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[(side * CAPSULE_LENGTH) / 2.6, 0, 0]}
            rotation-y={Math.PI / 2}
          >
            <torusGeometry args={[0.47, 0.035, 10, 32]} />
            <meshBasicMaterial color={palette.charge} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {chargingPads.map((pad) => (
        <group key={key(pad)} position={toScene(warehouse, pad)}>
          <Box size={[0.84, 0.04, 0.84]} at={[0, 0.02, 0]} color={palette.furnitureDark} />
          <mesh rotation-x={-Math.PI / 2} position={[0, 0.045, 0]}>
            <ringGeometry args={[0.24, 0.3, 32]} />
            <meshBasicMaterial color={palette.charge} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Box({
  size,
  at,
  color,
}: {
  readonly size: Vec3;
  readonly at: Vec3;
  readonly color: string;
}) {
  return (
    <mesh position={at} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function key({ x, y }: Point): string {
  return `${String(x)}:${String(y)}`;
}
