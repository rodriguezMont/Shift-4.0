import { useFrame } from '@react-three/fiber';
import { samePoint } from '@shift40/sim';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';
import { useRunner, useSimState } from '../simulation/context';
import { palette } from '../palette';
import { toScene } from './coords';

const TURN_RATE = 12;
const BOB_HEIGHT = 0.05;
const BOB_FREQUENCY = 11;

export function Operators() {
  const { operators } = useSimState();
  return operators.map((operator) => <OperatorFigure key={operator.id} index={operator.id} />);
}

/** Low-poly worker; position and heading are driven per frame from the runner, not React state. */
function OperatorFigure({ index }: { index: number }) {
  const runner = useRunner();
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const carriedBox = useRef<Mesh>(null);
  const heading = useRef(0);

  useFrame(({ clock }, delta) => {
    const operator = runner.getState().operators[index];
    const position = runner.operatorAt(index);
    if (!operator || !position || !root.current || !body.current || !carriedBox.current) return;

    const [x, , z] = toScene(runner.warehouse, position);
    root.current.position.set(x, 0, z);

    const moving = !samePoint(operator.from, operator.to);
    if (moving) {
      const target = Math.atan2(operator.to.x - operator.from.x, operator.to.y - operator.from.y);
      heading.current = turnTowards(heading.current, target, 1 - Math.exp(-TURN_RATE * delta));
    }
    root.current.rotation.y = heading.current;
    body.current.position.y = moving
      ? Math.abs(Math.sin(clock.elapsedTime * BOB_FREQUENCY)) * BOB_HEIGHT
      : 0;
    carriedBox.current.visible = operator.carrying;
  });

  return (
    <group ref={root}>
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
  );
}

/** Rotates `current` towards `target` by fraction `t`, always the short way round. */
function turnTowards(current: number, target: number, t: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + difference * t;
}
