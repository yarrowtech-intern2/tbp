import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useCinematicTimeline } from '../../hooks/useCinematicTimeline';
import { useDeviceQuality } from '../../hooks/useDeviceQuality';
import { CinematicLoader } from './CinematicLoader';
import { BetterPassUI } from './BetterPassUI';
import './cinematic-hero.css';

const LazyCinematicScene = lazy(() => import('./CinematicScene'));

const usePrefersReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
};

export const CinematicHero: React.FC = () => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const phoneUiRef = useRef<HTMLDivElement>(null);

  const [bookingStep, setBookingStep] = useState(0);
  const quality = useDeviceQuality();
  const prefersReducedMotion = usePrefersReducedMotion();

  const { proxies, requestRefresh } = useCinematicTimeline({
    wrapperRef,
    pinRef,
    prefersReducedMotion,
    onStepChange: setBookingStep,
    onTick: (currentProxies) => {
      const node = phoneUiRef.current;
      if (!node) return;
      const opacity = currentProxies.phone.opacity;
      node.style.opacity = String(opacity);
      node.style.pointerEvents = opacity > 0.05 ? 'auto' : 'none';
    },
  });

  const skipIntro = () => {
    document.getElementById('home5-hero')?.scrollIntoView({ block: 'start' });
  };

  return (
    <div ref={wrapperRef} id="cinematic-hero-wrapper" className="cinematic-hero-wrapper">
      <button type="button" className="cinematic-skip-intro" onClick={skipIntro}>
        Skip cinematic intro
      </button>

      <div ref={pinRef} className="cinematic-hero-pin">
        <div className="cinematic-canvas-layer" aria-hidden="true">
          <Suspense fallback={<CinematicLoader />}>
            <LazyCinematicScene proxies={proxies} quality={quality} onReady={requestRefresh} />
          </Suspense>
        </div>

        <BetterPassUI ref={phoneUiRef} step={bookingStep} />
      </div>
    </div>
  );
};
