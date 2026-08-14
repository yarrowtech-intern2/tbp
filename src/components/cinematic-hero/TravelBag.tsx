import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import { TRAVELER_BASE_POS } from './worldLayout';

interface TravelBagProps {
  proxies: CinematicProxies;
}

const BAG_ANCHOR: [number, number, number] = [
  TRAVELER_BASE_POS[0] - 0.42,
  0.14,
  TRAVELER_BASE_POS[2] + 0.1,
];

export const TravelBag: React.FC<TravelBagProps> = ({ proxies }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const lidRef = useRef<THREE.Group>(null!);
  const item1Ref = useRef<THREE.Mesh>(null!);
  const item2Ref = useRef<THREE.Mesh>(null!);
  const item3Ref = useRef<THREE.Mesh>(null!);

  const shellMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 0.85, transparent: true }),
    [],
  );
  const clothMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#e3ddd1', roughness: 0.9, transparent: true }),
    [],
  );
  const sunglassesMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.3, transparent: true }),
    [],
  );
  const bottleMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#7fb4c9', roughness: 0.2, transparent: true, opacity: 0.85 }),
    [],
  );

  useFrame(() => {
    const { opacity, openAmount } = proxies.bag;
    shellMat.opacity = opacity;
    clothMat.opacity = opacity;
    sunglassesMat.opacity = opacity;
    bottleMat.opacity = opacity * 0.85;

    if (groupRef.current) groupRef.current.visible = opacity > 0.01;
    if (lidRef.current) lidRef.current.rotation.x = THREE.MathUtils.lerp(0, -1.9, openAmount);

    const itemLift = THREE.MathUtils.smoothstep(openAmount, 0.15, 0.75);
    if (item1Ref.current) {
      item1Ref.current.position.y = THREE.MathUtils.lerp(0.02, 0.14, itemLift);
      item1Ref.current.scale.setScalar(THREE.MathUtils.lerp(0.2, 1, itemLift));
    }
    if (item2Ref.current) {
      item2Ref.current.position.y = THREE.MathUtils.lerp(0.02, 0.11, itemLift);
      item2Ref.current.scale.setScalar(THREE.MathUtils.lerp(0.2, 1, itemLift));
    }
    if (item3Ref.current) {
      item3Ref.current.position.y = THREE.MathUtils.lerp(0.02, 0.16, itemLift);
      item3Ref.current.scale.setScalar(THREE.MathUtils.lerp(0.2, 1, itemLift));
    }
  });

  return (
    <group ref={groupRef} position={BAG_ANCHOR}>
      {/* base */}
      <mesh position={[0, 0.09, 0]} material={shellMat} castShadow>
        <boxGeometry args={[0.42, 0.18, 0.28]} />
      </mesh>
      {/* lid, hinged at the back edge */}
      <group ref={lidRef} position={[0, 0.18, -0.14]}>
        <mesh position={[0, 0.03, 0.14]} material={shellMat} castShadow>
          <boxGeometry args={[0.42, 0.06, 0.28]} />
        </mesh>
      </group>
      {/* folded clothes */}
      <mesh ref={item1Ref} position={[-0.1, 0.02, 0]} material={clothMat}>
        <boxGeometry args={[0.14, 0.05, 0.18]} />
      </mesh>
      {/* sunglasses */}
      <mesh ref={item2Ref} position={[0.08, 0.02, -0.05]} material={sunglassesMat}>
        <boxGeometry args={[0.1, 0.02, 0.035]} />
      </mesh>
      {/* water bottle */}
      <mesh ref={item3Ref} position={[0.12, 0.02, 0.08]} material={bottleMat}>
        <cylinderGeometry args={[0.03, 0.03, 0.16, 10]} />
      </mesh>
    </group>
  );
};
