import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import { PALETTE, TRAVELER_BASE_POS, BUS_DOOR_POS } from './worldLayout';

interface TravelerProps {
  proxies: CinematicProxies;
}

const basePos = new THREE.Vector3(...TRAVELER_BASE_POS);
const doorPos = new THREE.Vector3(...BUS_DOOR_POS);

export const Traveler: React.FC<TravelerProps> = ({ proxies }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const rightArmRef = useRef<THREE.Group>(null!);
  const leftArmRef = useRef<THREE.Group>(null!);
  const leftLegRef = useRef<THREE.Mesh>(null!);
  const rightLegRef = useRef<THREE.Mesh>(null!);

  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.travelerSkin, roughness: 0.7, transparent: true }),
    [],
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.travelerShirt, roughness: 0.8, transparent: true }),
    [],
  );
  const pantsMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.travelerPants, roughness: 0.85, transparent: true }),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const { opacity, armRaise, bagGrab, walk, visible } = proxies.traveler;
    const finalOpacity = opacity * visible;

    skinMat.opacity = finalOpacity;
    shirtMat.opacity = finalOpacity;
    pantsMat.opacity = finalOpacity;

    const group = groupRef.current;
    if (group) {
      group.position.lerpVectors(basePos, doorPos, walk);
      group.position.y += Math.sin(t * 1.2) * 0.02 * (1 - walk);
      group.visible = finalOpacity > 0.01;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(-0.15, -1.9, armRaise);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(0, -0.35, armRaise);
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(-0.1, 1.4, bagGrab);
    }

    const walking = walk > 0.015 && walk < 0.985;
    const legSwing = walking ? Math.sin(t * 9) * 0.5 : 0;
    if (leftLegRef.current) leftLegRef.current.rotation.x = legSwing;
    if (rightLegRef.current) rightLegRef.current.rotation.x = -legSwing;
  });

  return (
    <group ref={groupRef} position={TRAVELER_BASE_POS}>
      {/* torso */}
      <mesh position={[0, 1.05, 0]} material={shirtMat} castShadow>
        <capsuleGeometry args={[0.22, 0.5, 4, 8]} />
      </mesh>
      {/* head */}
      <mesh position={[0, 1.62, 0]} material={skinMat} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
      </mesh>
      {/* right arm (raises toward phone) */}
      <group ref={rightArmRef} position={[0.28, 1.28, 0]}>
        <mesh position={[0.08, -0.22, 0]} material={skinMat} castShadow>
          <capsuleGeometry args={[0.07, 0.42, 4, 8]} />
        </mesh>
      </group>
      {/* left arm (reaches for the bag) */}
      <group ref={leftArmRef} position={[-0.28, 1.28, 0]}>
        <mesh position={[-0.08, -0.22, 0]} material={skinMat} castShadow>
          <capsuleGeometry args={[0.07, 0.42, 4, 8]} />
        </mesh>
      </group>
      {/* legs */}
      <mesh ref={leftLegRef} position={[-0.11, 0.55, 0]} material={pantsMat} castShadow>
        <capsuleGeometry args={[0.09, 0.55, 4, 8]} />
      </mesh>
      <mesh ref={rightLegRef} position={[0.11, 0.55, 0]} material={pantsMat} castShadow>
        <capsuleGeometry args={[0.09, 0.55, 4, 8]} />
      </mesh>
    </group>
  );
};
