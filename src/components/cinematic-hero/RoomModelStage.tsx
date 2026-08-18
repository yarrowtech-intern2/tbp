import { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { DirectionalLight, PerspectiveCamera as PerspectiveCameraType } from 'three';

const MODEL_URL = '/models/tbp-hero-model.glb';
const CAM_START_NODE = 'cam-start';
const CAM_END_NODE = 'cam-end';

const getIsCompactDevice = () => (
  typeof window !== 'undefined'
    ? window.matchMedia('(max-width: 900px)').matches || window.matchMedia('(pointer: coarse)').matches
    : false
);

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
  isCompact: boolean;
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
  // The GLB's actual window pane is the "Plane" mesh (a plain alpha-blended
  // material, not glTF transmission) — name-based matching is kept as a
  // fallback for future re-exports that name things descriptively.
  const isWindowPane = objectName === 'plane' || label.includes('window') || label.includes('glass');

  // Every OTHER material in this export — couch, TV console, table — was
  // left with KHR_materials_transmission on from a shared Blender node
  // group. GLTFLoader turns that into real see-through glass, which is why
  // the furniture reads as washed-out/translucent instead of solid, and
  // it's also one of the most expensive things a WebGL renderer can do
  // (an extra full-scene render pass per transmissive surface). Only the
  // window should ever be transmissive.
  if (!isWindowPane && material instanceof THREE.MeshPhysicalMaterial && material.transmission > 0) {
    material.transmission = 0;
  }

  if (isWindowPane) {
    material.transparent = true;
    material.opacity = Math.min(material.opacity, 0.58);
    material.roughness = 0.05;
    material.metalness = 0;
    material.envMapIntensity = 1.4;
    material.depthWrite = false;
    return;
  }

  material.envMapIntensity = 0.92;
  material.roughness = THREE.MathUtils.clamp(material.roughness || 0.55, 0.3, 0.85);
  material.metalness = Math.min(material.metalness || 0, 0.16);

  if (label.includes('wood') || label.includes('floor') || label.includes('table')) {
    material.roughness = 0.52;
    material.metalness = 0.02;
    material.envMapIntensity = 0.78;
  }

  if (label.includes('chair') || label.includes('fabric') || label.includes('sofa') || label.includes('couch')) {
    material.roughness = 0.7;
    material.metalness = 0;
    material.envMapIntensity = 0.62;
  }
};

const SceneModel: React.FC<SceneModelProps> = ({ progressRef, isCompact }) => {
  const { scene } = useGLTF(MODEL_URL);
  const cloudTextures = useTexture(CLOUD_URLS);
  const { camera, gl } = useThree();
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
        child.castShadow = !isCompact;
        child.receiveShadow = !isCompact;
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

      if (!isCompact) {
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

        // Only the camera moves during the scroll-scrub — the room, its
        // light, and its shadows never change — so the shadow map only
        // needs to be baked once instead of every frame for the whole
        // multi-screen scroll.
        gl.shadowMap.needsUpdate = true;
      }
    }
  }, [scene, camera, gl, isCompact]);

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
        castShadow={!isCompact}
        shadow-mapSize-width={isCompact ? 512 : 1536}
        shadow-mapSize-height={isCompact ? 512 : 1536}
      />
      {/* Soft blue window-side fill. A real <rectAreaLight> would read
          slightly better here, but it requires three.js's ~300KB LTC
          lookup-texture data file just for this one secondary light —
          not worth it against an already-oversized bundle, so a cheap
          point light approximates the same fill instead. */}
      {!isCompact ? (
        <pointLight position={[-16, 8, 0]} intensity={22} decay={2} color="#d8ecff" />
      ) : null}
      <primitive object={scene} />
      <ContactShadows
        position={[0, 0, 0]}
        opacity={isCompact ? 0.5 : 0.64}
        scale={40}
        blur={2.2}
        far={18}
        resolution={isCompact ? 320 : 768}
        frames={1}
      />
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

export const RoomModelStage: React.FC<RoomModelStageProps> = ({ progressRef }) => {
  // Decided once per mount — a device doesn't change class mid-session, and
  // reacting to it live would mean tearing down/rebuilding the canvas.
  const isCompact = useMemo(getIsCompactDevice, []);

  return (
    <Canvas
      className="rtw-model-canvas"
      shadows={isCompact ? false : 'soft'}
      dpr={isCompact ? [1, 1] : [1, MAX_DEVICE_PIXEL_RATIO]}
      gl={{
        antialias: !isCompact,
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 0.98,
      }}
      onCreated={({ gl }) => {
        if (isCompact) return;
        gl.shadowMap.enabled = true;
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        // Baked once (see SceneModel) since only the camera moves.
        gl.shadowMap.autoUpdate = false;
      }}
      camera={{ fov: 32 }}
    >
      <hemisphereLight intensity={0.6} color="#dcefff" groundColor="#382b21" />
      <ambientLight intensity={0.2} />
      <directionalLight position={[-4, -2, -3]} intensity={0.16} color="#bcd7ff" />
      <Suspense fallback={null}>
        <SceneModel progressRef={progressRef} isCompact={isCompact} />
      </Suspense>
      {/* Own Suspense boundary: this fetches an HDR file from a remote CDN
          for reflections. If that fetch is slow or fails, it must not block
          the room/camera above from rendering — sharing one boundary here
          left the entire canvas blank while the HDR request hung. It's
          preloaded (see preloadRoomModelStage) so this normally resolves
          before the stage is ever visible. */}
      <Suspense fallback={null}>
        <Environment preset="city" environmentIntensity={isCompact ? 0.5 : 0.66} />
      </Suspense>
    </Canvas>
  );
};
