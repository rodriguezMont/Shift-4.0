import { MapControls, OrthographicCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { palette } from '../palette';
import { Areas } from './Areas';
import { useSelection } from '../simulation/selection';
import type { Vec3 } from './coords';
import { Docks } from './Docks';
import { Floor } from './Floor';
import { Operators } from './Operators';
import { Racks, StoredBoxes } from './Racks';

/** Approximate on-screen extent of the floor plus trucks, in world units, at isometric angle. */
const FRAME_WIDTH = 52;
const FRAME_HEIGHT = 32;
const SHADOW_EXTENT = 24;

export function WarehouseScene() {
  const { select } = useSelection();
  return (
    // A click that hits no operator clears the selection.
    <Canvas
      shadows
      dpr={[1, 2]}
      onPointerMissed={() => {
        select(null);
      }}
    >
      <color attach="background" args={[palette.background]} />
      <IsometricCamera />
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[12, 24, 8]}
        intensity={1.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
      />
      <Floor />
      <Areas />
      <Racks />
      <StoredBoxes />
      <Docks />
      <Operators />
    </Canvas>
  );
}

/**
 * Looks slightly left of the floor's centre so the plant sits right of the HUD panel,
 * keeping the inbound docks visible. Moving along (-1, 0, 1) is a pure screen-left shift.
 */
const VIEW_TARGET: Vec3 = [-4.5, 0, 4.5];
const CAMERA_OFFSET = 30;

/** Orthographic camera on the (1, 1, 1) diagonal: true isometric. Pan and zoom only. */
function IsometricCamera() {
  const size = useThree((state) => state.size);
  const zoom = Math.min(size.width / FRAME_WIDTH, size.height / FRAME_HEIGHT);
  const [x, y, z] = VIEW_TARGET;

  return (
    <>
      <OrthographicCamera
        makeDefault
        position={[x + CAMERA_OFFSET, y + CAMERA_OFFSET, z + CAMERA_OFFSET]}
        zoom={zoom}
        near={0.1}
        far={200}
      />
      <MapControls
        target={VIEW_TARGET}
        enableRotate={false}
        minZoom={zoom * 0.6}
        maxZoom={zoom * 4}
      />
    </>
  );
}
