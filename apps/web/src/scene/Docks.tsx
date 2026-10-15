import { useFrame } from '@react-three/fiber';
import { TRUCK_MANEUVER_TICKS, type DockedTruck, type Point } from '@shift40/sim';
import { useRef, type ReactNode } from 'react';
import type { Group, Mesh, MeshStandardMaterial } from 'three';
import { useRunner } from '../simulation/context';
import { palette } from '../palette';
import { toScene } from './coords';
import { TrafficLight } from './TrafficLight';

const TRAILER = { length: 3.2, height: 1.7, width: 1.3 } as const;
const CAB = { length: 1.1, height: 1.25, width: 1.2 } as const;
const DOOR_HEIGHT = 2;
const WALL_OFFSET = 0.5;
/** How far a truck travels while backing in or pulling away, in cells. */
const DRIVE_DISTANCE = 3;
/** Gap between the dock door and the trailer's rear, and the trailer's height off the floor. */
const TRAILER_GAP = 0.15;
const TRAILER_LIFT = 0.25;
/** One door hinged on each side of the trailer's rear opening. */
const HINGE_SIDES = [1, -1] as const;
/** How quickly the rear doors swing (per second, exponential approach). */
const DOOR_SWING_RATE = 6;
/** Slightly past 90° so open doors flare away from the trailer sides and stay visible. */
const DOOR_OPEN_ANGLE = Math.PI * 0.6;

/** Dock doors on both walls. Inbound trucks come and go with the simulation. */
export function Docks() {
  const { warehouse } = useRunner();
  const rightWall = warehouse.grid.width - 1 + WALL_OFFSET;

  return (
    <group>
      {warehouse.inboundDocks.map((dock, index) => (
        <DockBay key={`in-${String(dock.y)}`} wall={{ x: -WALL_OFFSET, y: dock.y }}>
          <TrafficLight dock={index} position={[0, DOOR_HEIGHT + 0.52, 0]} inward={1} />
          <InboundTruck dock={index} outward={-1} />
        </DockBay>
      ))}
      {/* Outbound trucks stay parked until orders drive dispatch (step 1.4b). */}
      {warehouse.outboundDocks.map((dock) => (
        <DockBay key={`out-${String(dock.y)}`} wall={{ x: rightWall, y: dock.y }}>
          <TruckBody outward={1} />
        </DockBay>
      ))}
    </group>
  );
}

function DockBay({ wall, children }: { wall: Point; children: ReactNode }) {
  const { warehouse } = useRunner();
  const [x, , z] = toScene(warehouse, wall);

  return (
    <group position={[x, 0, z]}>
      {[-0.7, 0.7].map((dz) => (
        <mesh key={dz} position={[0, DOOR_HEIGHT / 2, dz]} castShadow>
          <boxGeometry args={[0.12, DOOR_HEIGHT, 0.12]} />
          <meshStandardMaterial color={palette.dockFrame} />
        </mesh>
      ))}
      <mesh position={[0, DOOR_HEIGHT, 0]} castShadow>
        <boxGeometry args={[0.12, 0.12, 1.52]} />
        <meshStandardMaterial color={palette.dockFrame} />
      </mesh>
      {children}
    </group>
  );
}

interface TruckBodyProps {
  readonly outward: -1 | 1;
  readonly trailerRef?: React.Ref<Mesh>;
  readonly cabRef?: React.Ref<Mesh>;
}

/** Trailer against the door, cab on the far side. Positioned relative to the dock door. */
function TruckBody({ outward, trailerRef, cabRef }: TruckBodyProps) {
  const trailerX = outward * (TRAILER.length / 2 + TRAILER_GAP);
  const cabX = trailerX + outward * (TRAILER.length / 2 + CAB.length / 2 + 0.1);

  return (
    <>
      <mesh
        ref={trailerRef}
        position={[trailerX, TRAILER.height / 2 + TRAILER_LIFT, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[TRAILER.length, TRAILER.height, TRAILER.width]} />
        <meshStandardMaterial color={palette.truckTrailer} />
      </mesh>
      <mesh ref={cabRef} position={[cabX, CAB.height / 2 + 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[CAB.length, CAB.height, CAB.width]} />
        <meshStandardMaterial color={palette.truckCab} />
      </mesh>
    </>
  );
}

/**
 * The truck at one inbound dock, driven per frame from simulation state: it backs in
 * and fades in while arriving, opens its rear doors while unloading, and pulls away
 * fading out.
 */
function InboundTruck({ dock, outward }: { dock: number; outward: -1 | 1 }) {
  const runner = useRunner();
  const group = useRef<Group>(null);
  const trailer = useRef<Mesh>(null);
  const cab = useRef<Mesh>(null);
  const doors = useRef<Group>(null);
  const hinges = useRef<(Group | null)[]>([]);
  const openness = useRef(0);

  useFrame((_, delta) => {
    if (!group.current || !trailer.current || !cab.current || !doors.current) return;
    const { previous, current, alpha } = runner.frame();
    const truck = current.receiving.docks[dock] ?? null;
    const presence = dockPresence(previous.receiving.docks[dock] ?? null, truck, alpha);

    group.current.visible = presence > 0;
    if (presence <= 0) return;

    // Doors swing open once the truck is parked and unloading, and shut when it leaves.
    const target = truck?.phase === 'unloading' ? 1 : 0;
    openness.current += (target - openness.current) * (1 - Math.exp(-DOOR_SWING_RATE * delta));
    doors.current.visible = presence >= 1 && openness.current > 0.01;
    hinges.current.forEach((hinge, index) => {
      const side = HINGE_SIDES[index] ?? 1;
      if (hinge) hinge.rotation.y = openness.current * side * -outward * DOOR_OPEN_ANGLE;
    });

    group.current.position.x = outward * DRIVE_DISTANCE * (1 - smoothstep(presence));
    // Blend only while fading; a parked truck renders in the cheaper, artefact-free opaque pass.
    const fading = presence < 1;
    for (const mesh of [trailer.current, cab.current]) {
      const material = mesh.material as MeshStandardMaterial;
      if (material.transparent !== fading) {
        material.transparent = fading;
        material.needsUpdate = true;
      }
      material.opacity = presence;
      mesh.castShadow = !fading;
    }
  });

  const rearX = outward * TRAILER_GAP;
  const doorY = TRAILER.height / 2 + TRAILER_LIFT;
  const doorWidth = TRAILER.width / 2 - 0.02;

  return (
    <group ref={group} visible={false}>
      <TruckBody outward={outward} trailerRef={trailer} cabRef={cab} />
      <group ref={doors} visible={false}>
        {/* The dark cargo opening revealed behind the doors. */}
        <mesh position={[rearX - outward * 0.005, doorY, 0]}>
          <boxGeometry args={[0.01, TRAILER.height - 0.12, TRAILER.width - 0.1]} />
          <meshStandardMaterial color={palette.truckInterior} />
        </mesh>
        {HINGE_SIDES.map((side, index) => (
          <group
            key={side}
            ref={(hinge) => {
              hinges.current[index] = hinge;
            }}
            position={[rearX - outward * 0.025, doorY, side * (TRAILER.width / 2 + 0.03)]}
          >
            <mesh position={[0, 0, (-side * doorWidth) / 2]} castShadow>
              <boxGeometry args={[0.04, TRAILER.height - 0.08, doorWidth]} />
              <meshStandardMaterial color={palette.truckDoor} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/**
 * How present a truck is at its dock, from 0 (gone) to 1 (parked), smoothed between
 * the last two ticks. A truck that has just left fades from its last value to zero.
 */
function dockPresence(previous: DockedTruck | null, current: DockedTruck | null, alpha: number) {
  if (current === null) return previous === null ? 0 : lerp(presence(previous), 0, alpha);
  const from = previous?.truckId === current.truckId ? presence(previous) : presence(current);
  return lerp(from, presence(current), alpha);
}

function presence(truck: DockedTruck): number {
  switch (truck.phase) {
    case 'arriving':
      return 1 - truck.maneuverTicks / TRUCK_MANEUVER_TICKS;
    case 'unloading':
      return 1;
    case 'departing':
      return truck.maneuverTicks / TRUCK_MANEUVER_TICKS;
  }
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}
