import React, { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import './app-splash-screen.css';

const LazyGlobe = lazy(async () => ({
  default: (await import('./ui/globe')).Globe,
}));

type AppSplashScreenProps = {
  exiting?: boolean;
  lightweight?: boolean;
  actionHref?: string;
  actionLabel?: string;
};

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  exiting = false,
  lightweight = false,
  actionHref,
  actionLabel = 'Lets go',
}) => (
  <div
    className={`app-splash-screen${exiting ? ' is-exiting' : ''}${
      lightweight ? ' is-lightweight' : ''
    }`}
    role="status"
    aria-label="Loading The Better Pass"
  >
    <div className="app-splash-logo">
      <img src="/logo/final-logo.png" alt="The Better Pass" />
    </div>

    <div className="app-splash-copy">
      <h1>Ready for your next unforgettable trip?</h1>
      <p>
        Find trusted local guides, exciting experiences, and easy bookings with
        The Better Pass.
      </p>
    </div>

    <div className="app-splash-globe-mask">
      <div className="app-splash-globe-ground" />

      {lightweight ? (
        <div
          className="app-splash-globe app-splash-globe-placeholder"
          aria-hidden="true"
        />
      ) : (
        <Suspense
          fallback={
            <div
              className="app-splash-globe app-splash-globe-placeholder"
              aria-hidden="true"
            />
          }
        >
          <LazyGlobe
            className="app-splash-globe"
            aria-hidden="true"
            config={{
              dark: 0,
              diffuse: 0.88,
              mapSamples: 1200,
              mapBrightness: 4.4,
              baseColor: [0.9, 0.9, 0.88],
              glowColor: [0.96, 0.96, 0.93],
              markerColor: [0.4, 0.4, 0.38],
              scale: 1.08,
              offset: [-0.02, 0.07],
              markers: [],
            }}
          />
        </Suspense>
      )}

      {actionHref ? (
        <Link
          className="app-splash-action"
          to={actionHref}
          aria-label={actionLabel}
        >
          <span>{actionLabel}</span>
        </Link>
      ) : null}

      <div className="app-splash-globe-fade" />
    </div>
  </div>
);
