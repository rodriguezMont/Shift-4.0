import { MapControls, OrthographicCamera } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { palette } from '../palette';
import { Docks } from './Docks';
import { Floor } from './Floor';
import { Operators } from './Operators';
import { Racks, StoredBoxes } from './Racks';

/** Approximate on-screen extent of the floor plus trucks, in world units, at isometric angle. */
const FRAME_WIDTH = 46;
const FRAME_HEIGHT = 28;
const SHADOW_EXTENT = 20;

export function WarehouseScene() {
  return (
    <Canvas shadows dpr={[1, 2]}>
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
      <Racks />
      <StoredBoxes />
      <Docks />
      <Operators />
    </Canvas>
  );
}

/** Orthographic camera on the (1, 1, 1) diagonal: true isometric. Pan and zoom only. */
function IsometricCamera() {
  const size = useThree((state) => state.size);
  const zoom = Math.min(size.width / FRAME_WIDTH, size.height / FRAME_HEIGHT);

  return (
    <>
      <OrthographicCamera makeDefault position={[30, 30, 30]} zoom={zoom} near={0.1} far={200} />
      <MapControls enableRotate={false} minZoom={zoom * 0.6} maxZoom={zoom * 4} />
    </>
  );
}
