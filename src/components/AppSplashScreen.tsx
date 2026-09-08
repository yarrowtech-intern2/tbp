import React, { Suspense, lazy } from 'react';
import './app-splash-screen.css';

const LazyGlobe = lazy(async () => ({ default: (await import('./ui/globe')).Globe }));

type AppSplashScreenProps = {
  exiting?: boolean;
};

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({ exiting = false }) => (
  <div className={`app-splash-screen${exiting ? ' is-exiting' : ''}`} role="status" aria-label="Loading The Better Pass">
    <div className="app-splash-logo">
      <img src="/logo/final-logo.png" alt="The Better Pass" />
    </div>

    <div className="app-splash-globe-mask" aria-hidden="true">
      <div className="app-splash-globe-ground" />
      <Suspense fallback={<div className="app-splash-globe app-splash-globe-placeholder" />}>
        <LazyGlobe
          className="app-splash-globe"
          config={{
            dark: 0,
            diffuse: 1.08,
            mapSamples: 5000,
            mapBrightness: 7.4,
            baseColor: [0.95, 0.48, 0.12],
            glowColor: [1, 0.72, 0.36],
            markerColor: [0.05, 0.05, 0.05],
            scale: 1.12,
            offset: [-0.02, 0.07],
          }}
        />
      </Suspense>
      <div className="app-splash-globe-fade" />
    </div>
  </div>
);
