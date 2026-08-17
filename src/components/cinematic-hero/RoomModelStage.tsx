import { Suspense, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { DirectionalLight, PerspectiveCamera as PerspectiveCameraType } from 'three';

const MODEL_URL = '/models/tbp-hero-model.glb';
const CAM_START_NODE = 'cam-start';
const CAM_END_NODE = 'cam-end';

export type CameraProgress = { t: number };

type SceneModelProps = {
  progressRef: React.MutableRefObject<CameraProgress>;
};

// The model is fixed (no rotation/animation of its own) — only the camera
// moves, dollying in a straight line from the cam-start empty to the
// cam-end empty authored in the GLB, always looking straight along that
// line (toward cam-end) so it travels *through* the window rather than
// drifting down toward the room's geometric center.
const SceneModel: React.FC<SceneModelProps> = ({ progressRef }) => {
  const { scene } = useGLTF(MODEL_URL);
  const { camera } = useThree();
  const lightRef = useRef<DirectionalLight>(null!);
  const camStart = useRef(new THREE.Vector3());
  const camEnd = useRef(new THREE.Vector3());

  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);

    const startNode = scene.getObjectByName(CAM_START_NODE);
    const endNode = scene.getObjectByName(CAM_END_NODE);
    if (startNode) startNode.getWorldPosition(camStart.current);
    if (endNode) endNode.getWorldPosition(camEnd.current);

    const box = new THREE.Box3().setFromObject(scene);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;

    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    const perspective = camera as PerspectiveCameraType;
    perspective.near = Math.max(maxDim / 200, 0.01);
    perspective.far = maxDim * 8;
    perspective.updateProjectionMatrix();

    camera.position.copy(camStart.current);
    camera.lookAt(camEnd.current);

    const light = lightRef.current;
    if (light) {
      light.position.set(center.x + maxDim * 0.5, center.y + maxDim * 0.9, center.z + maxDim * 0.6);
      light.target.position.copy(center);
      light.target.updateMatrixWorld();
      const cam = light.shadow.camera;
      cam.left = -maxDim * 0.75;
      cam.right = maxDim * 0.75;
      cam.top = maxDim * 0.75;
      cam.bottom = -maxDim * 0.75;
      cam.near = maxDim / 50;
      cam.far = maxDim * 4;
      cam.updateProjectionMatrix();
      light.shadow.bias = -0.0015;
    }
  }, [scene, camera]);

  useFrame(() => {
    const t = THREE.MathUtils.clamp(progressRef.current.t, 0, 1);
    camera.position.lerpVectors(camStart.current, camEnd.current, t);
    camera.lookAt(camEnd.current);
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={2.2}
        color="#fff3e0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <primitive object={scene} />
      <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={40} blur={2.4} far={20} />
    </>
  );
};

type RoomModelStageProps = {
  progressRef: React.MutableRefObject<CameraProgress>;
};

export const RoomModelStage: React.FC<RoomModelStageProps> = ({ progressRef }) => (
  <Canvas
    className="rtw-model-canvas"
    shadows="soft"
    dpr={[1, 2]}
    gl={{
      antialias: true,
      alpha: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 1.05,
    }}
    camera={{ fov: 32 }}
  >
    <ambientLight intensity={0.45} />
    <directionalLight position={[-4, -2, -3]} intensity={0.25} color="#bcd7ff" />
    <Suspense fallback={null}>
      <SceneModel progressRef={progressRef} />
      <Environment preset="apartment" />
    </Suspense>
  </Canvas>
);

useGLTF.preload(MODEL_URL);
