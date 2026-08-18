import { Suspense, useLayoutEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { DirectionalLight, PerspectiveCamera as PerspectiveCameraType } from 'three';

const MODEL_URL = '/models/tbp-hero-model.glb';
const CAM_START_NODE = 'cam-start';
const CAM_END_NODE = 'cam-end';

// Cloud bank sitting just beyond the window. As the camera dollies in
// (t 0->1), the clouds fade and drift apart partway through the approach —
// clearing the window's view just as the room copy ("Somewhere out
// there...") reveals. There's no backdrop plane behind them: the canvas is
// transparent there (see RoomModelStage's `gl.alpha`), and the real next
// section is pinned directly beneath the room (see CinematicHero), so
// clearing the clouds reveals the actual page through the glass instead of
// a painted scene.
type CloudConfig = {
  url: string;
  position: readonly [number, number, number];
  size: number;
  driftX: number;
  driftY: number;
};

const CLOUD_CONFIGS: CloudConfig[] = [
  { url: '/images/cloud-2.png', position: [-20, 10, 7], size: 36, driftX: -24, driftY: 10 },
  { url: '/images/cloud-3.png', position: [-27, 5, -9], size: 42, driftX: 28, driftY: -12 },
  { url: '/images/cloud-1.png', position: [-33, 12, 3], size: 30, driftX: -18, driftY: 15 },
];
const CLOUD_URLS = CLOUD_CONFIGS.map((cloud) => cloud.url);
const CLOUD_REVEAL_START = 0.18;
const CLOUD_REVEAL_END = 0.58;
const MAX_DEVICE_PIXEL_RATIO = 1.35;

export type CameraProgress = {
  t: number;
};

type SceneModelProps = {
  progressRef: React.MutableRefObject<CameraProgress>;
};

// The model is fixed (no rotation/animation of its own) — only the camera
// moves, dollying in a straight line from the cam-start empty to the
// cam-end empty authored in the GLB, always looking straight along that
// line (toward cam-end) so it travels *through* the window rather than
// drifting down toward the room's geometric center.
const tuneMaterialForRealism = (material: THREE.Material, meshName: string) => {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;

  const materialName = material.name.toLowerCase();
  const objectName = meshName.toLowerCase();
  const label = `${objectName} ${materialName}`;

  material.envMapIntensity = label.includes('window') || label.includes('glass') ? 1.25 : 0.78;
  material.roughness = THREE.MathUtils.clamp(material.roughness || 0.55, 0.34, 0.88);
  material.metalness = Math.min(material.metalness || 0, 0.16);

  if (label.includes('glass') || label.includes('window')) {
    material.transparent = true;
    material.opacity = Math.min(material.opacity, 0.58);
    material.roughness = 0.08;
    material.metalness = 0;
    material.depthWrite = false;
    return;
  }

  if (label.includes('wood') || label.includes('floor') || label.includes('table')) {
    material.roughness = 0.58;
    material.metalness = 0.02;
    material.envMapIntensity = 0.62;
  }

  if (label.includes('chair') || label.includes('fabric') || label.includes('sofa')) {
    material.roughness = 0.74;
    material.metalness = 0;
    material.envMapIntensity = 0.48;
  }
};

const SceneModel: React.FC<SceneModelProps> = ({ progressRef }) => {
  const { scene } = useGLTF(MODEL_URL);
  const cloudTextures = useTexture(CLOUD_URLS);
  const { camera } = useThree();
  const lightRef = useRef<DirectionalLight>(null!);
  const cloudMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const camStart = useRef(new THREE.Vector3());
  const camEnd = useRef(new THREE.Vector3());

  cloudTextures.forEach((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
  });

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
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => tuneMaterialForRealism(material, child.name));
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
      light.position.set(center.x - maxDim * 0.55, center.y + maxDim * 0.95, center.z + maxDim * 0.5);
      light.target.position.copy(center);
      light.target.updateMatrixWorld();
      const cam = light.shadow.camera;
      cam.left = -maxDim * 0.68;
      cam.right = maxDim * 0.68;
      cam.top = maxDim * 0.68;
      cam.bottom = -maxDim * 0.68;
      cam.near = maxDim / 50;
      cam.far = maxDim * 3.4;
      cam.updateProjectionMatrix();
      light.shadow.bias = -0.001;
      light.shadow.normalBias = 0.018;
    }
  }, [scene, camera]);

  useFrame(() => {
    const t = THREE.MathUtils.clamp(progressRef.current.t, 0, 1);
    camera.position.lerpVectors(camStart.current, camEnd.current, t);
    camera.lookAt(camEnd.current);

    const reveal = THREE.MathUtils.smoothstep(t, CLOUD_REVEAL_START, CLOUD_REVEAL_END);
    CLOUD_CONFIGS.forEach((cloud, i) => {
      const mesh = cloudMeshRefs.current[i];
      if (!mesh) return;
      const material = mesh.material as THREE.MeshBasicMaterial;
      material.opacity = 1 - reveal;
      mesh.position.x = cloud.position[0] + cloud.driftX * reveal;
      mesh.position.y = cloud.position[1] + cloud.driftY * reveal;
    });
  });

  return (
    <>
      <directionalLight
        ref={lightRef}
        intensity={3.05}
        color="#fff7e8"
        castShadow
        shadow-mapSize-width={1536}
        shadow-mapSize-height={1536}
      />
      <rectAreaLight position={[-18, 9, 0]} rotation={[0, Math.PI / 2, 0]} width={18} height={7} intensity={1.4} color="#d8ecff" />
      <primitive object={scene} />
      <ContactShadows position={[0, 0, 0]} opacity={0.64} scale={40} blur={2.2} far={18} resolution={768} />
      {CLOUD_CONFIGS.map((cloud, i) => (
        <mesh
          key={cloud.url}
          ref={(node) => { cloudMeshRefs.current[i] = node; }}
          position={cloud.position}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[cloud.size, cloud.size]} />
          <meshBasicMaterial
            map={cloudTextures[i]}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
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
    dpr={[1, MAX_DEVICE_PIXEL_RATIO]}
    gl={{
      antialias: true,
      alpha: true,
      toneMapping: THREE.ACESFilmicToneMapping,
      toneMappingExposure: 0.96,
    }}
    onCreated={({ gl }) => {
      gl.shadowMap.enabled = true;
      gl.shadowMap.type = THREE.PCFSoftShadowMap;
    }}
    camera={{ fov: 32 }}
  >
    <hemisphereLight intensity={0.58} color="#dcefff" groundColor="#382b21" />
    <ambientLight intensity={0.18} />
    <directionalLight position={[-4, -2, -3]} intensity={0.16} color="#bcd7ff" />
    <Suspense fallback={null}>
      <SceneModel progressRef={progressRef} />
    </Suspense>
    {/* Own Suspense boundary: this fetches an HDR file from a remote CDN
        for reflections. If that fetch is slow or fails, it must not block
        the room/camera above from rendering — sharing one boundary here
        left the entire canvas blank while the HDR request hung. */}
    <Suspense fallback={null}>
      <Environment preset="city" environmentIntensity={0.58} />
    </Suspense>
  </Canvas>
);
