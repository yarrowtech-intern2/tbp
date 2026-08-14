import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Sprite } from 'three';
import type { CinematicProxies } from './timelineConfig';
import { getCloudTextureDataUrl } from './cloudTexture';

interface CloudCurtainProps {
  proxies: CinematicProxies;
}

interface SpriteConfig {
  offsetX: number;
  offsetY: number;
  sizeFactor: number;
  rotation: number;
  opacity: number;
}

// A 3x3 grid of camera-facing sprites, generously overlapping, sized every
// frame from the camera's actual frustum at a fixed distance — unlike
// hand-placed world-space cloud puffs, this guarantees full viewport
// coverage regardless of aspect ratio, FOV, or window resizing. It's the
// "we're surrounded by clouds" guarantee; the world-placed <Clouds> blobs
// provide depth/parallax and remain as ambient sky dressing after it fades.
const GRID: SpriteConfig[] = [
  { offsetX: -0.55, offsetY: 0.5, sizeFactor: 0.78, rotation: 0.3, opacity: 0.85 },
  { offsetX: 0, offsetY: 0.55, sizeFactor: 0.8, rotation: -0.4, opacity: 0.9 },
  { offsetX: 0.55, offsetY: 0.5, sizeFactor: 0.78, rotation: 0.6, opacity: 0.85 },
  { offsetX: -0.6, offsetY: 0, sizeFactor: 0.85, rotation: -0.2, opacity: 0.95 },
  { offsetX: 0, offsetY: 0, sizeFactor: 0.9, rotation: 0.15, opacity: 1 },
  { offsetX: 0.6, offsetY: 0, sizeFactor: 0.85, rotation: -0.55, opacity: 0.95 },
  { offsetX: -0.55, offsetY: -0.5, sizeFactor: 0.78, rotation: 0.45, opacity: 0.85 },
  { offsetX: 0, offsetY: -0.55, sizeFactor: 0.8, rotation: -0.3, opacity: 0.9 },
  { offsetX: 0.55, offsetY: -0.5, sizeFactor: 0.78, rotation: 0.2, opacity: 0.85 },
];

const CURTAIN_DISTANCE = 2.4;

const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const center = new THREE.Vector3();
const worldPos = new THREE.Vector3();

export const CloudCurtain: React.FC<CloudCurtainProps> = ({ proxies }) => {
  const spriteRefs = useRef<(Sprite | null)[]>([]);
  const texture = useTexture(getCloudTextureDataUrl());

  useFrame(({ camera }) => {
    const spread = proxies.clouds.spread;
    // Fully gone well before the traveler needs to read clearly.
    const fade = THREE.MathUtils.clamp(1 - spread / 0.7, 0, 1);
    if (fade <= 0.001) {
      spriteRefs.current.forEach((sprite) => {
        if (sprite) sprite.visible = false;
      });
      return;
    }

    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    up.crossVectors(right, forward).normalize();
    center.copy(camera.position).addScaledVector(forward, CURTAIN_DISTANCE);

    const vFov = THREE.MathUtils.degToRad(
      camera instanceof THREE.PerspectiveCamera ? camera.fov : 50,
    );
    const height = 2 * Math.tan(vFov / 2) * CURTAIN_DISTANCE;
    const aspect = camera instanceof THREE.PerspectiveCamera ? camera.aspect : 16 / 9;
    const width = height * aspect;
    const spriteScale = Math.max(width, height);

    GRID.forEach((cfg, i) => {
      const sprite = spriteRefs.current[i];
      if (!sprite) return;

      worldPos.copy(center)
        .addScaledVector(right, cfg.offsetX * width)
        .addScaledVector(up, cfg.offsetY * height);
      sprite.position.copy(worldPos);
      sprite.scale.setScalar(spriteScale * cfg.sizeFactor);
      sprite.material.rotation = cfg.rotation;
      sprite.material.opacity = cfg.opacity * fade;
      sprite.visible = true;
    });
  });

  return (
    <>
      {GRID.map((_, i) => (
        <sprite
          key={i}
          ref={(el: Sprite | null) => {
            spriteRefs.current[i] = el;
          }}
        >
          <spriteMaterial
            map={texture}
            transparent
            depthWrite={false}
            fog={false}
            color="#ffffff"
          />
        </sprite>
      ))}
    </>
  );
};
