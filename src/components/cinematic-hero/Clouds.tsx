import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import type { DeviceQualityTier } from '../../hooks/useDeviceQuality';
import { CLOUD_PUFF_COUNT_HIGH, CLOUD_PUFF_COUNT_LOW } from './worldLayout';

interface CloudsProps {
  proxies: CinematicProxies;
  quality: DeviceQualityTier;
}

interface PuffSeed {
  baseX: number;
  baseY: number;
  baseZ: number;
  side: number;
  scale: number;
  driftSpeed: number;
  driftPhase: number;
}

const dummy = new THREE.Object3D();

export const Clouds: React.FC<CloudsProps> = ({ proxies, quality }) => {
  const count = quality === 'high' ? CLOUD_PUFF_COUNT_HIGH : CLOUD_PUFF_COUNT_LOW;
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null!);

  const seeds = useMemo<PuffSeed[]>(() => {
    const arr: PuffSeed[] = [];
    for (let i = 0; i < count; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      arr.push({
        baseX: side * (0.4 + Math.random() * 2.2),
        baseY: 0.4 + Math.random() * 3.2,
        baseZ: -6 + Math.random() * 10,
        side,
        scale: 1.1 + Math.random() * 2.1,
        driftSpeed: 0.06 + Math.random() * 0.08,
        driftPhase: Math.random() * Math.PI * 2,
      });
    }
    return arr;
  }, [count]);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const spread = proxies.clouds.spread;
    const t = state.clock.elapsedTime;

    seeds.forEach((seed, i) => {
      const partX = seed.side * spread * 7.5;
      const drift = Math.sin(t * seed.driftSpeed + seed.driftPhase) * 0.3;
      dummy.position.set(seed.baseX + partX, seed.baseY + drift * 0.4, seed.baseZ + drift);
      const scaleBoost = 1 + spread * 0.6;
      dummy.scale.setScalar(seed.scale * scaleBoost);
      dummy.rotation.set(0, seed.driftPhase, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    if (materialRef.current) {
      materialRef.current.opacity = Math.max(0.08, 1 - spread * 0.85);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 12, 10]} />
      <meshStandardMaterial
        ref={materialRef}
        color="#ffffff"
        roughness={1}
        transparent
        opacity={1}
        depthWrite={false}
        fog
      />
    </instancedMesh>
  );
};
