import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import type { DeviceQualityTier } from '../../hooks/useDeviceQuality';
import {
  BUS_BASE_POS,
  PALETTE,
  ROAD_SEGMENT_LENGTH,
  ROAD_TRAVEL_SCALE,
  VEGETATION_COUNT_HIGH,
  VEGETATION_COUNT_LOW,
} from './worldLayout';

interface EnvironmentProps {
  proxies: CinematicProxies;
  quality: DeviceQualityTier;
}

interface VegetationSeed {
  side: number;
  offsetX: number;
  baseZ: number;
  height: number;
}

const dummy = new THREE.Object3D();
const groundInland = new THREE.Color(PALETTE.groundInland);
const groundCoastal = new THREE.Color(PALETTE.groundCoastal);
const vegInland = new THREE.Color(PALETTE.vegetationInland);
const vegCoastal = new THREE.Color(PALETTE.vegetationCoastal);
const tmpColor = new THREE.Color();

const generateSeeds = (count: number): VegetationSeed[] => {
  const arr: VegetationSeed[] = [];
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    arr.push({
      side,
      offsetX: 1.9 + Math.random() * 2.4,
      baseZ: BUS_BASE_POS[2] - i * (ROAD_SEGMENT_LENGTH / 3),
      height: 0.6 + Math.random() * 0.9,
    });
  }
  return arr;
};

export const Environment: React.FC<EnvironmentProps> = ({ proxies, quality }) => {
  const groundRef = useRef<THREE.Mesh>(null!);
  const groundMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.groundInland, roughness: 1 }), []);
  const vegMat = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.vegetationInland, roughness: 0.9 }), []);
  const vegMeshRef = useRef<THREE.InstancedMesh>(null!);

  // Seeded once via useState's lazy initializer (React's sanctioned one-time
  // impure init, unlike useMemo) using the quality tier at first mount.
  const [seeds] = useState<VegetationSeed[]>(() => (
    generateSeeds(quality === 'high' ? VEGETATION_COUNT_HIGH : VEGETATION_COUNT_LOW)
  ));
  const count = seeds.length;
  const segmentSpan = count * (ROAD_SEGMENT_LENGTH / 3);

  useFrame(() => {
    const mix = proxies.environment.mix;
    tmpColor.lerpColors(groundInland, groundCoastal, mix);
    groundMat.color.copy(tmpColor);
    tmpColor.lerpColors(vegInland, vegCoastal, mix);
    vegMat.color.copy(tmpColor);

    const scrolled = proxies.bus.travel * ROAD_TRAVEL_SCALE;
    const mesh = vegMeshRef.current;
    if (mesh) {
      seeds.forEach((seed, i) => {
        const wrappedZ = (((seed.baseZ + scrolled) % segmentSpan) + segmentSpan) % segmentSpan
          - segmentSpan / 2 + BUS_BASE_POS[2];
        dummy.position.set(seed.side * seed.offsetX, seed.height / 2, wrappedZ);
        dummy.scale.set(1, seed.height, 1);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -60]} material={groundMat} receiveShadow>
        <planeGeometry args={[160, 260]} />
      </mesh>
      <instancedMesh ref={vegMeshRef} args={[undefined, undefined, count]} material={vegMat} castShadow>
        <coneGeometry args={[0.32, 1, 7]} />
      </instancedMesh>
    </group>
  );
};
