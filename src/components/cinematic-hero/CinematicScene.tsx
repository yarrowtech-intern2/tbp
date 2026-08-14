import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import type { CinematicProxies } from './timelineConfig';
import type { DeviceQualityTier } from '../../hooks/useDeviceQuality';
import { CameraController } from './CameraController';
import { Clouds } from './Clouds';
import { Traveler } from './Traveler';
import { Phone } from './Phone';
import { TravelBag } from './TravelBag';
import { Bus } from './Bus';
import { Road } from './Road';
import { Environment } from './Environment';
import { Ocean } from './Ocean';
import { Beach } from './Beach';

interface CinematicSceneProps {
  proxies: CinematicProxies;
  quality: DeviceQualityTier;
  onReady: () => void;
}

const MIST_COLOR = new THREE.Color('#eef1f4');
const SKY_INLAND = new THREE.Color('#bcd6ea');
const SKY_COASTAL = new THREE.Color('#d9f0f4');
const tmpSky = new THREE.Color();
const tmpSky2 = new THREE.Color();

const Atmosphere: React.FC<{ proxies: CinematicProxies }> = ({ proxies }) => {
  const { scene } = useThree();

  const fog = useMemo(() => new THREE.Fog(SKY_INLAND.getHex(), 10, 85), []);

  useEffect(() => {
    scene.fog = fog;
    return () => {
      scene.fog = null;
    };
  }, [scene, fog]);

  useFrame(() => {
    tmpSky.lerpColors(MIST_COLOR, SKY_INLAND, proxies.clouds.spread);
    tmpSky2.lerpColors(tmpSky, SKY_COASTAL, proxies.environment.mix);
    scene.background = tmpSky2;
    fog.color.copy(tmpSky2);
    fog.far = THREE.MathUtils.lerp(85, 160, proxies.environment.mix);
  });

  return null;
};

const SceneContents: React.FC<{ proxies: CinematicProxies; quality: DeviceQualityTier }> = ({ proxies, quality }) => (
  <>
    <PerspectiveCamera makeDefault position={[0, 1.6, 8]} fov={50} near={0.1} far={220} />
    <CameraController proxies={proxies} />
    <Atmosphere proxies={proxies} />

    <ambientLight intensity={0.65} />
    <hemisphereLight args={['#ffffff', '#9aa1a8', 2.2]} />
    <directionalLight
      position={[8, 14, 6]}
      intensity={1.1}
      castShadow
      shadow-mapSize={quality === 'high' ? [1024, 1024] : [512, 512]}
      shadow-camera-near={1}
      shadow-camera-far={60}
      shadow-camera-left={-20}
      shadow-camera-right={20}
      shadow-camera-top={20}
      shadow-camera-bottom={-20}
    />

    <Clouds proxies={proxies} quality={quality} />
    <Traveler proxies={proxies} />
    <Phone proxies={proxies} />
    <TravelBag proxies={proxies} />
    <Bus proxies={proxies} />
    <Road proxies={proxies} quality={quality} />
    <Environment proxies={proxies} quality={quality} />
    <Ocean proxies={proxies} quality={quality} />
    <Beach proxies={proxies} />
  </>
);

const CinematicScene: React.FC<CinematicSceneProps> = ({ proxies, quality, onReady }) => {
  const readyFired = useRef(false);

  return (
    <Canvas
      shadows={quality === 'high'}
      dpr={quality === 'high' ? [1, 2] : [1, 1]}
      gl={{ antialias: true, powerPreference: 'high-performance', alpha: false }}
      onCreated={() => {
        if (!readyFired.current) {
          readyFired.current = true;
          onReady();
        }
      }}
    >
      <SceneContents proxies={proxies} quality={quality} />
    </Canvas>
  );
};

export default CinematicScene;
