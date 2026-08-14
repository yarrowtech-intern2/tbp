import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import type { DeviceQualityTier } from '../../hooks/useDeviceQuality';
import { PALETTE } from './worldLayout';

interface OceanProps {
  proxies: CinematicProxies;
  quality: DeviceQualityTier;
}

const OCEAN_ANCHOR: [number, number, number] = [15, 0, -8];

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uReveal;
  varying float vWave;

  void main() {
    vec3 pos = position;
    float wave = sin(pos.x * 0.6 + uTime * 1.1) * 0.12
      + sin(pos.y * 0.9 - uTime * 0.8) * 0.08;
    pos.z += wave * uReveal;
    vWave = wave;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform float uReveal;
  varying float vWave;

  void main() {
    float foamFactor = smoothstep(0.08, 0.2, vWave);
    vec3 color = mix(uDeep, uFoam, foamFactor * 0.6);
    gl_FragColor = vec4(color, uReveal);
  }
`;

export const Ocean: React.FC<OceanProps> = ({ proxies, quality }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const segments = quality === 'high' ? 48 : 18;

  const material = useMemo(
    () => new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uReveal: { value: 0 },
        uDeep: { value: new THREE.Color(PALETTE.ocean) },
        uFoam: { value: new THREE.Color(PALETTE.oceanFoam) },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
    }),
    [],
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    material.uniforms.uReveal.value = proxies.ocean.reveal;
    if (meshRef.current) {
      meshRef.current.visible = proxies.ocean.reveal > 0.01;
      meshRef.current.position.y = THREE.MathUtils.lerp(-1.2, 0, proxies.ocean.reveal);
    }
  });

  return (
    <mesh ref={meshRef} position={OCEAN_ANCHOR} rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[26, 40, segments, segments]} />
    </mesh>
  );
};
