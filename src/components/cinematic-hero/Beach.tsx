import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import { PALETTE } from './worldLayout';

interface BeachProps {
  proxies: CinematicProxies;
}

const SAND_ANCHOR: [number, number, number] = [8.5, -0.01, -8];
const FOAM_ANCHOR: [number, number, number] = [12.5, 0, -8];

export const Beach: React.FC<BeachProps> = ({ proxies }) => {
  const sandRef = useRef<THREE.Mesh>(null!);
  const foamRef = useRef<THREE.Mesh>(null!);

  const sandMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1, transparent: true }),
    [],
  );
  const foamMat = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: PALETTE.oceanFoam,
      transparent: true,
      opacity: 0.6,
      roughness: 0.4,
    }),
    [],
  );

  useFrame((state) => {
    const reveal = proxies.ocean.reveal;
    sandMat.opacity = reveal;
    foamMat.opacity = reveal * (0.45 + Math.sin(state.clock.elapsedTime * 1.6) * 0.15);
    if (sandRef.current) sandRef.current.visible = reveal > 0.01;
    if (foamRef.current) foamRef.current.visible = reveal > 0.01;
  });

  return (
    <group>
      <mesh ref={sandRef} rotation={[-Math.PI / 2, 0, 0]} position={SAND_ANCHOR} material={sandMat} receiveShadow>
        <planeGeometry args={[9, 26]} />
      </mesh>
      <mesh ref={foamRef} rotation={[-Math.PI / 2, 0, 0]} position={FOAM_ANCHOR} material={foamMat}>
        <planeGeometry args={[1.2, 26]} />
      </mesh>
    </group>
  );
};
