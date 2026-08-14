import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';

interface CameraControllerProps {
  proxies: CinematicProxies;
}

const lookTarget = new THREE.Vector3();

export const CameraController: React.FC<CameraControllerProps> = ({ proxies }) => {
  useFrame(({ camera }) => {
    const { camera: cam } = proxies;
    camera.position.set(cam.x, cam.y, cam.z);
    lookTarget.set(cam.lookX, cam.lookY, cam.lookZ);
    camera.lookAt(lookTarget);

    if (camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - cam.fov) > 0.01) {
      camera.fov = cam.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
};
