import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import { TRAVELER_BASE_POS } from './worldLayout';

interface PhoneProps {
  proxies: CinematicProxies;
}

const PHONE_ANCHOR: [number, number, number] = [
  TRAVELER_BASE_POS[0] + 0.34,
  TRAVELER_BASE_POS[1] + 1.42,
  TRAVELER_BASE_POS[2] + 0.32,
];

export const Phone: React.FC<PhoneProps> = ({ proxies }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#141416', roughness: 0.35, metalness: 0.2, transparent: true }),
    [],
  );
  const screenMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: '#d7864b',
      emissive: new THREE.Color('#d7864b'),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      transparent: true,
    }),
    [],
  );

  useFrame(() => {
    const { opacity, scale } = proxies.phone;
    bodyMat.opacity = opacity;
    screenMat.opacity = opacity;
    const group = groupRef.current;
    if (group) {
      group.scale.setScalar(scale);
      group.visible = opacity > 0.01;
    }
  });

  return (
    <group ref={groupRef} position={PHONE_ANCHOR} rotation={[0.15, -0.4, 0.08]}>
      <mesh material={bodyMat} castShadow>
        <boxGeometry args={[0.16, 0.32, 0.02]} />
      </mesh>
      <mesh position={[0, 0, 0.011]} material={screenMat}>
        <planeGeometry args={[0.13, 0.27]} />
      </mesh>
    </group>
  );
};
