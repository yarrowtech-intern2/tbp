import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import type { DeviceQualityTier } from '../../hooks/useDeviceQuality';
import {
  BUS_BASE_POS,
  ROAD_SEGMENT_COUNT_HIGH,
  ROAD_SEGMENT_COUNT_LOW,
  ROAD_SEGMENT_LENGTH,
  ROAD_TRAVEL_SCALE,
} from './worldLayout';

interface RoadProps {
  proxies: CinematicProxies;
  quality: DeviceQualityTier;
}

const dummy = new THREE.Object3D();
const MARKERS_PER_SEGMENT = 3;

export const Road: React.FC<RoadProps> = ({ proxies, quality }) => {
  const segmentCount = quality === 'high' ? ROAD_SEGMENT_COUNT_HIGH : ROAD_SEGMENT_COUNT_LOW;
  const slabRef = useRef<THREE.InstancedMesh>(null!);
  const markerRef = useRef<THREE.InstancedMesh>(null!);
  const markerMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4e7c9' }), []);
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a3a3f', roughness: 0.95 }), []);

  const totalSpan = segmentCount * ROAD_SEGMENT_LENGTH;
  const markerCount = segmentCount * MARKERS_PER_SEGMENT;

  useFrame(() => {
    const scrolled = proxies.bus.travel * ROAD_TRAVEL_SCALE;

    const slabs = slabRef.current;
    if (slabs) {
      for (let i = 0; i < segmentCount; i += 1) {
        const baseZ = BUS_BASE_POS[2] - i * ROAD_SEGMENT_LENGTH;
        const wrappedZ = (((baseZ + scrolled) % totalSpan) + totalSpan) % totalSpan - totalSpan / 2 + BUS_BASE_POS[2];
        dummy.position.set(BUS_BASE_POS[0], 0.01, wrappedZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        slabs.setMatrixAt(i, dummy.matrix);
      }
      slabs.instanceMatrix.needsUpdate = true;
    }

    const markers = markerRef.current;
    if (markers) {
      for (let i = 0; i < markerCount; i += 1) {
        const baseZ = BUS_BASE_POS[2] - i * (ROAD_SEGMENT_LENGTH / MARKERS_PER_SEGMENT);
        const wrappedZ = (((baseZ + scrolled) % totalSpan) + totalSpan) % totalSpan - totalSpan / 2 + BUS_BASE_POS[2];
        dummy.position.set(BUS_BASE_POS[0], 0.03, wrappedZ);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        markers.setMatrixAt(i, dummy.matrix);
      }
      markers.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group>
      <instancedMesh ref={slabRef} args={[undefined, undefined, segmentCount]} material={roadMat} receiveShadow>
        <boxGeometry args={[2.6, 0.02, ROAD_SEGMENT_LENGTH + 0.05]} />
      </instancedMesh>
      <instancedMesh ref={markerRef} args={[undefined, undefined, markerCount]} material={markerMat}>
        <boxGeometry args={[0.14, 0.01, 0.6]} />
      </instancedMesh>
    </group>
  );
};
