import { useFrame } from '@react-three/fiber';
import { boxesLeft, docksToRelease, type Receiving } from '@shift40/sim';
import { useEffect, useRef, useState } from 'react';
import { CanvasTexture, SRGBColorSpace, type MeshBasicMaterial } from 'three';
import { useRunner, useSimState } from '../simulation/context';
import type { Vec3 } from './coords';

/** What a dock's light tells the floor. Derived from simulation state, never stored. */
type DockSignal = 'free' | 'busy' | 'release';

function dockSignal(receiving: Receiving, dock: number): DockSignal {
  if (!receiving.docks[dock]) return 'free';
  return docksToRelease(receiving).includes(dock) ? 'release' : 'busy';
}

/** Pure, unlit LED colours: they must read as signal colours whatever the scene lighting. */
const LED_COLORS: Record<DockSignal, string> = {
  free: '#00e05a',
  busy: '#ffb300',
  release: '#ff1a1a',
};
/** The red LED's "off" half of the blink: dark red, so it still reads as a red light. */
const LED_DIM = '#4d0a0a';
const HOUSING_COLOR = '#1f242c';
/** Blinks per second while a dock should be released. */
const BLINK_HZ = 2;

interface TrafficLightProps {
  readonly dock: number;
  /** Position relative to the dock bay. */
  readonly position: Vec3;
  /** +1 or -1: which way along x faces into the warehouse, where the LED points. */
  readonly inward: -1 | 1;
}

/**
 * Single-LED signal above an inbound dock door — green when free, amber while a truck
 * occupies it, blinking red when this dock should be freed for a waiting truck — with
 * a counter of the boxes still on the truck.
 */
export function TrafficLight({ dock, position, inward }: TrafficLightProps) {
  const runner = useRunner();
  const led = useRef<MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    if (!led.current) return;
    const signal = dockSignal(runner.getState().receiving, dock);
    const blinkOff = signal === 'release' && Math.floor(clock.elapsedTime * BLINK_HZ * 2) % 2 === 1;
    led.current.color.set(blinkOff ? LED_DIM : LED_COLORS[signal]);
  });

  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[0.22, 0.32, 0.32]} />
        <meshStandardMaterial color={HOUSING_COLOR} />
      </mesh>
      <mesh position={[inward * 0.1, 0, 0]}>
        <sphereGeometry args={[0.12, 24, 16]} />
        <meshBasicMaterial ref={led} color={LED_COLORS.free} toneMapped={false} />
      </mesh>
      <BoxesLeftDisplay dock={dock} />
    </group>
  );
}

/** Canvas size of the counter in pixels, and its size in the scene in world units. */
const DISPLAY_PIXELS = { width: 96, height: 48 } as const;
const DISPLAY_SIZE: Vec3 = [0.84, 0.42, 1];
const DISPLAY_TEXT = '#ffb300';
const DISPLAY_BACKGROUND = '#0d0f12';

/**
 * LED-style counter above the light: boxes still to unload, or a dash for a free dock.
 * Drawn into a canvas texture on a camera-facing sprite, and redrawn only on change.
 */
function BoxesLeftDisplay({ dock }: { dock: number }) {
  const { receiving } = useSimState();
  const truck = receiving.docks[dock];
  const text = truck ? String(boxesLeft(truck)) : '–';
  const [canvas] = useState(() => {
    const created = document.createElement('canvas');
    created.width = DISPLAY_PIXELS.width;
    created.height = DISPLAY_PIXELS.height;
    return created;
  });
  // Declared as a scene element, so react-three-fiber disposes it on unmount.
  const texture = useRef<CanvasTexture>(null);

  useEffect(() => {
    drawCounter(canvas, text);
    if (texture.current) texture.current.needsUpdate = true;
  }, [canvas, text]);

  return (
    <sprite position={[0, 0.46, 0]} scale={DISPLAY_SIZE}>
      <spriteMaterial toneMapped={false}>
        <canvasTexture ref={texture} attach="map" args={[canvas]} colorSpace={SRGBColorSpace} />
      </spriteMaterial>
    </sprite>
  );
}

function drawCounter(canvas: HTMLCanvasElement, text: string): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  context.fillStyle = DISPLAY_BACKGROUND;
  context.beginPath();
  context.roundRect(2, 2, width - 4, height - 4, 8);
  context.fill();
  context.fillStyle = DISPLAY_TEXT;
  context.font = '700 36px ui-monospace, Menlo, Consolas, monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, width / 2, height / 2 + 2);
}
