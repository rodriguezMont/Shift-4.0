import { useFrame } from '@react-three/fiber';
import { operatorById, REST_BELOW, samePoint } from '@shift40/sim';
import { useEffect, useRef } from 'react';
import type { Group, Mesh, MeshBasicMaterial } from 'three';
import { useRunner, useSimState } from '../simulation/context';
import { useSelection } from '../simulation/selection';
import { palette } from '../palette';
import { toScene } from './coords';

const TURN_RATE = 12;
const BOB_HEIGHT = 0.05;
const BOB_FREQUENCY = 11;
const BAR_WIDTH = 0.7;
const BAR_HEIGHT = 1.58;
/** The bar only appears once an operator has started to tire, to keep the floor calm. */
const BAR_HIDDEN_ABOVE = 0.98;
/** Below this the bar turns amber; below `REST_BELOW` (break time) it turns red. */
const TIRED_BELOW = 0.6;
const SELECTION_COLOR = '#1d2430';
const ENERGY_COLORS = {
  fresh: '#2fbf71',
  tired: '#ffb300',
  exhausted: '#ff1a1a',
  resting: '#3b82f6',
  track: '#1f242c',
} as const;

export function Operators() {
  const { operators } = useSimState();
  const { operatorId, select } = useSelection();
  return operators.map((operator) => (
    <OperatorFigure
      key={operator.id}
      id={operator.id}
      selected={operator.id === operatorId}
      onSelect={select}
    />
  ));
}

interface OperatorFigureProps {
  readonly id: number;
  readonly selected: boolean;
  readonly onSelect: (id: number) => void;
}

/**
 * Low-poly worker with a stamina bar; position, heading and energy are driven per frame
 * from the runner, not React state.
 */
function OperatorFigure({ id, selected, onSelect }: OperatorFigureProps) {
  const runner = useRunner();
  const root = useRef<Group>(null);
  const turn = useRef<Group>(null);
  const body = useRef<Group>(null);
  const carriedBox = useRef<Mesh>(null);
  const energyBar = useRef<Group>(null);
  const energyFill = useRef<Mesh>(null);
  const energyColor = useRef<MeshBasicMaterial>(null);
  const heading = useRef(0);
  // A figure removed under the pointer (a dismissed operator leaving) never gets pointer-out.
  useEffect(
    () => () => {
      document.body.style.cursor = '';
    },
    [],
  );

  useFrame(({ clock }, delta) => {
    const operator = operatorById(runner.getState().operators, id);
    const position = runner.operatorAt(id);
    if (!operator || !position || !root.current || !turn.current || !body.current) return;
    if (!carriedBox.current || !energyBar.current || !energyFill.current) return;

    const [x, , z] = toScene(runner.warehouse, position);
    root.current.position.set(x, 0, z);

    const moving = !samePoint(operator.from, operator.to);
    if (moving) {
      const target = Math.atan2(operator.to.x - operator.from.x, operator.to.y - operator.from.y);
      heading.current = turnTowards(heading.current, target, 1 - Math.exp(-TURN_RATE * delta));
    }
    turn.current.rotation.y = heading.current;
    body.current.position.y = moving
      ? Math.abs(Math.sin(clock.elapsedTime * BOB_FREQUENCY)) * BOB_HEIGHT
      : 0;
    carriedBox.current.visible = operator.carrying;

    // Stamina bar: hidden when fresh, left-anchored fill, blue while on a break.
    const resting = operator.phase === 'resting';
    energyBar.current.visible = resting || operator.energy < BAR_HIDDEN_ABOVE;
    energyFill.current.scale.x = Math.max(operator.energy, 0.001);
    energyFill.current.position.x = -((1 - operator.energy) * BAR_WIDTH) / 2;
    energyColor.current?.color.set(
      resting ? ENERGY_COLORS.resting : energyColorFor(operator.energy),
    );
  });

  return (
    <group
      ref={root}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
      }}
    >
      {selected && (
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.36, 0.46, 32]} />
          <meshBasicMaterial color={SELECTION_COLOR} toneMapped={false} />
        </mesh>
      )}
      {/* Turned to face the camera's horizontal (the isometric view looks along -x-z). */}
      <group ref={energyBar} position={[0, BAR_HEIGHT, 0]} rotation-y={Math.PI / 4} visible={false}>
        <mesh>
          <boxGeometry args={[BAR_WIDTH + 0.06, 0.17, 0.04]} />
          <meshBasicMaterial color={ENERGY_COLORS.track} toneMapped={false} />
        </mesh>
        <mesh ref={energyFill} position={[0, 0, 0.025]}>
          <boxGeometry args={[BAR_WIDTH, 0.11, 0.04]} />
          <meshBasicMaterial ref={energyColor} color={ENERGY_COLORS.fresh} toneMapped={false} />
        </mesh>
      </group>
      <group ref={turn}>
        <group ref={body}>
          <mesh position={[0, 0.23, 0]} castShadow>
            <boxGeometry args={[0.3, 0.46, 0.18]} />
            <meshStandardMaterial color={palette.operatorLegs} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <capsuleGeometry args={[0.19, 0.28, 4, 12]} />
            <meshStandardMaterial color={palette.operatorBody} />
          </mesh>
          <mesh position={[0, 1.12, 0]} castShadow>
            <sphereGeometry args={[0.14, 16, 12]} />
            <meshStandardMaterial color={palette.operatorSkin} />
          </mesh>
          <mesh position={[0, 1.15, 0]} castShadow>
            <sphereGeometry args={[0.155, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={palette.helmet} />
          </mesh>
          <mesh ref={carriedBox} position={[0, 0.78, 0.3]} castShadow visible={false}>
            <boxGeometry args={[0.4, 0.32, 0.4]} />
            <meshStandardMaterial color={palette.box} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

function energyColorFor(energy: number): string {
  if (energy >= TIRED_BELOW) return ENERGY_COLORS.fresh;
  return energy >= REST_BELOW ? ENERGY_COLORS.tired : ENERGY_COLORS.exhausted;
}

/** Rotates `current` towards `target` by fraction `t`, always the short way round. */
function turnTowards(current: number, target: number, t: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * t;
}
