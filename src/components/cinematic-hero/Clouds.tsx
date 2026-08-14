import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Cloud, Clouds as CloudsGroup } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import type { CinematicProxies } from './timelineConfig';
import type { DeviceQualityTier } from '../../hooks/useDeviceQuality';
import { getCloudTextureDataUrl } from './cloudTexture';

interface CloudsProps {
  proxies: CinematicProxies;
  quality: DeviceQualityTier;
}

interface BlobConfig {
  base: [number, number, number];
  parted: [number, number, number];
  scale: number;
  swayPhase: number;
  // A flat billboard puff can't self-shade like real volumetric geometry, so
  // each blob gets a slightly different tint (brighter, sun-catching tops vs.
  // cooler, shadowed lower puffs) to fake dimension across the whole bank.
  tint: string;
}

// Hand-placed so the bank reads as "filling the frame" at spread=0 (several
// puffs sit close to the camera's starting position) and disperses outward /
// upward / back into the sky as spread -> 1, clearing the center for the
// traveler reveal.
const BLOBS: BlobConfig[] = [
  // Low-center pair fills the horizon gap directly in front of the camera.
  { base: [-0.5, 0.95, 1.8], parted: [-4.5, 0.3, -1.5], scale: 1.15, swayPhase: 2.0, tint: '#e7e9eb' },
  { base: [0.6, 0.85, 1.9], parted: [4.6, 0.2, -1.6], scale: 1.1, swayPhase: 5.2, tint: '#e9eaec' },
  { base: [-2.4, 2.1, 1.5], parted: [-8, 3.4, -3], scale: 1.3, swayPhase: 0, tint: '#ffffff' },
  { base: [2.5, 1.9, 1.3], parted: [8.2, 3.2, -3.2], scale: 1.25, swayPhase: 0.8, tint: '#ffffff' },
  { base: [-3.4, 0.7, 0.2], parted: [-9.5, 1.4, -2.5], scale: 1.5, swayPhase: 1.6, tint: '#eef0f1' },
  { base: [3.5, 0.6, 0.1], parted: [9.7, 1.2, -2.7], scale: 1.45, swayPhase: 2.4, tint: '#eef0f1' },
  { base: [-1.1, 2.9, 0.6], parted: [-6, 4.4, -4], scale: 1.0, swayPhase: 3.2, tint: '#ffffff' },
  { base: [1.3, 2.7, 0.4], parted: [6.2, 4.2, -4.2], scale: 0.95, swayPhase: 4.0, tint: '#fffdf7' },
  { base: [-1.6, 1.3, 2.4], parted: [-7.5, 0.6, -1], scale: 1.1, swayPhase: 4.8, tint: '#e5e7e9' },
  { base: [1.8, 1.2, 2.5], parted: [7.6, 0.5, -1.2], scale: 1.05, swayPhase: 5.6, tint: '#e5e7e9' },
];

const tmpVec = new THREE.Vector3();

export const Clouds: React.FC<CloudsProps> = ({ proxies, quality }) => {
  const blobs = quality === 'high' ? BLOBS : BLOBS.slice(0, 6);
  const segments = quality === 'high' ? 9 : 5;
  const limit = blobs.length * segments;

  const groupRefs = useRef<(Group | null)[]>([]);
  const texture = useMemo(() => getCloudTextureDataUrl(), []);

  useFrame((state) => {
    const spread = proxies.clouds.spread;
    const t = state.clock.elapsedTime;

    blobs.forEach((blob, i) => {
      const group = groupRefs.current[i];
      if (!group) return;

      tmpVec.set(
        THREE.MathUtils.lerp(blob.base[0], blob.parted[0], spread),
        THREE.MathUtils.lerp(blob.base[1], blob.parted[1], spread),
        THREE.MathUtils.lerp(blob.base[2], blob.parted[2], spread),
      );

      const sway = 0.12;
      tmpVec.x += Math.sin(t * 0.15 + blob.swayPhase) * sway;
      tmpVec.y += Math.cos(t * 0.12 + blob.swayPhase) * sway * 0.6;

      group.position.copy(tmpVec);
    });
  });

  return (
    <CloudsGroup texture={texture} limit={limit} range={limit} frustumCulled={false}>
      {blobs.map((blob, i) => (
        <Cloud
          key={i}
          ref={(el: Group | null) => {
            groupRefs.current[i] = el;
          }}
          position={blob.base}
          scale={blob.scale}
          segments={segments}
          bounds={[1.8, 1.1, 1.1]}
          volume={1.2}
          smallestVolume={0.4}
          growth={1.5}
          speed={0.25}
          fade={6}
          opacity={0.85}
          color={blob.tint}
          concentrate="inside"
          seed={i * 17.3}
        />
      ))}
    </CloudsGroup>
  );
};
