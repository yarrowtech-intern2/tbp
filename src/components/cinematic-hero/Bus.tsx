import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import { PALETTE, BUS_BASE_POS } from './worldLayout';

interface BusProps {
  proxies: CinematicProxies;
}

const wheelPositions: [number, number, number][] = [
  [-0.72, 0.28, 0.78],
  [0.72, 0.28, 0.78],
  [-0.72, 0.28, -0.78],
  [0.72, 0.28, -0.78],
];

export const Bus: React.FC<BusProps> = ({ proxies }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const doorRef = useRef<THREE.Group>(null!);
  const wheelRefs = useRef<THREE.Mesh[]>([]);

  const bodyMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.busBody, roughness: 0.5, metalness: 0.1 }),
    [],
  );
  const accentMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: PALETTE.busAccent, roughness: 0.55 }),
    [],
  );
  const glassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8fd4e8', roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.75 }),
    [],
  );
  const wheelMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#1c1c1e', roughness: 0.9 }),
    [],
  );

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (group) {
      group.rotation.y = proxies.bus.rotY;
      const bounce = proxies.bus.speed > 0.01
        ? Math.sin(state.clock.elapsedTime * 14) * 0.01 * proxies.bus.speed
        : 0;
      group.position.set(BUS_BASE_POS[0], BUS_BASE_POS[1] + bounce, BUS_BASE_POS[2]);
    }

    if (doorRef.current) {
      doorRef.current.rotation.y = THREE.MathUtils.lerp(0, -1.4, proxies.bus.doorOpen);
    }

    const spin = proxies.bus.speed * delta * 18;
    wheelRefs.current.forEach((wheel) => {
      if (wheel) wheel.rotation.x -= spin;
    });
  });

  return (
    <group ref={groupRef} position={BUS_BASE_POS}>
      {/* main body */}
      <mesh position={[0, 0.62, 0]} material={bodyMat} castShadow receiveShadow>
        <boxGeometry args={[1.6, 0.7, 3.6]} />
      </mesh>
      {/* roof taper */}
      <mesh position={[0, 1.02, 0]} material={bodyMat} castShadow>
        <boxGeometry args={[1.5, 0.14, 3.4]} />
      </mesh>
      {/* accent stripe */}
      <mesh position={[0, 0.5, 0]} material={accentMat}>
        <boxGeometry args={[1.62, 0.14, 3.62]} />
      </mesh>
      {/* windows strip */}
      <mesh position={[0.81, 0.78, 0]} material={glassMat}>
        <boxGeometry args={[0.02, 0.32, 3]} />
      </mesh>
      <mesh position={[-0.81, 0.78, 0]} material={glassMat}>
        <boxGeometry args={[0.02, 0.32, 3]} />
      </mesh>
      {/* door, hinged */}
      <group ref={doorRef} position={[0.81, 0.5, 1.5]}>
        <mesh position={[0, 0.28, 0.15]} material={glassMat} castShadow>
          <boxGeometry args={[0.04, 0.56, 0.3]} />
        </mesh>
      </group>
      {/* wheels */}
      {wheelPositions.map((pos, i) => (
        <mesh
          key={pos.join('-')}
          ref={(el: THREE.Mesh | null) => {
            if (el) wheelRefs.current[i] = el;
          }}
          position={pos}
          rotation={[0, 0, Math.PI / 2]}
          material={wheelMat}
          castShadow
        >
          <cylinderGeometry args={[0.28, 0.28, 0.2, 16]} />
        </mesh>
      ))}
    </group>
  );
};
