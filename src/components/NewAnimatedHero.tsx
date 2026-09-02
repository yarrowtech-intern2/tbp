import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import './new-animated-hero.css';

const HERO_BACKGROUND_VIDEO = 'https://res.cloudinary.com/dc3qprub3/video/upload/v1779877968/tbp-hero4_dmbfr5.mp4';
const HERO_BACKGROUND_POSTER = 'https://res.cloudinary.com/dc3qprub3/video/upload/f_jpg,q_auto/v1779877968/tbp-hero4_dmbfr5.jpg';
const PHASE_COUNT = 4;

type FlipTileProps = {
  className: string;
  front: React.ReactNode;
  back: React.ReactNode;
};

const getPrefersReducedMotion = () => (
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
);

const usePrefersReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setPrefersReducedMotion(query.matches);

    updatePreference();
    query.addEventListener('change', updatePreference);

    return () => {
      query.removeEventListener('change', updatePreference);
    };
  }, []);

  return prefersReducedMotion;
};

export const NewAnimatedHero: React.FC = () => {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [phase, setPhase] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % PHASE_COUNT);
    }, 5600);

    return () => {
      window.clearInterval(timer);
    };
  }, [prefersReducedMotion]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.01 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <section
      ref={containerRef}
      id="tbp-editorial-hero"
      className={`tbp-editorial-hero tbp-editorial-hero--phase-${phase}`}
      aria-labelledby="tbp-editorial-title"
    >
      <HeroBackground isVisible={isVisible} />

      <div className="tbp-editorial-layout">
        <HeroIntro />
        <ProviderCount />
        <HeroCTA />
        <AnimatedCardGrid />
      </div>

      <GridOverlay />
    </section>
  );
};

const HeroBackground: React.FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isVisible) {
      const playAttempt = video.play();
      if (playAttempt && typeof playAttempt.catch === 'function') {
        playAttempt.catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [isVisible]);

  return (
    <div className="tbp-editorial-bg" aria-hidden="true">
      <video
        ref={videoRef}
        className="tbp-editorial-bg-video"
        muted
        loop
        playsInline
        preload="metadata"
        poster={HERO_BACKGROUND_POSTER}
        disablePictureInPicture
      >
        <source src={HERO_BACKGROUND_VIDEO} type="video/mp4" />
      </video>
    </div>
  );
};

const GridOverlay: React.FC = () => (
  <div className="tbp-editorial-grid-overlay" aria-hidden="true" />
);

const HeroIntro: React.FC = () => (
  <div className="tbp-editorial-intro">
    <h1 id="tbp-editorial-title">
      Dream It. Book It.
      <br />
      Live It.
    </h1>
    <p>Less planning. More exploring. Everything you need for your next unforgettable journey.</p>
  </div>
);

const ProviderCount: React.FC = () => (
  <div
    className="tbp-editorial-provider"
    aria-label="12K plus providers"
  >
    <div className="tbp-editorial-provider-dots" aria-hidden="true">
      <span className="tbp-editorial-dot tbp-editorial-dot--cream" />
      <span className="tbp-editorial-dot tbp-editorial-dot--coral" />
    </div>
    <div className="tbp-editorial-provider-copy">
      <strong>12K+</strong>
      <span>Providers</span>
    </div>
  </div>
);

const HeroCTA: React.FC = () => (
  <Link className="tbp-editorial-cta" to="/login" aria-label="Get started with The Better Pass">
    <span>Get started</span>
    <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
  </Link>
);

const AnimatedCardGrid: React.FC = () => (
  <div className="tbp-editorial-card-field" aria-label="The Better Pass highlights">
    <FlipTile
      className="tbp-editorial-tile tbp-editorial-tile--verified"
      front={(
        <>
          Verified
          <br />
          Providers
        </>
      )}
      back={(
        <>
          Trusted
          <br />
          Local Experts
        </>
      )}
    />

    <FlipTile
      className="tbp-editorial-tile tbp-editorial-tile--explore"
      front={(
        <>
          Explore
          <br />
          Places
        </>
      )}
      back={(
        <>
          Hidden Gems
          <br />
          With Locals
        </>
      )}
    />
  </div>
);

const FlipTile: React.FC<FlipTileProps> = ({ className, front, back }) => (
  <article className={`${className} tbp-editorial-flip`}>
    <div className="tbp-editorial-flipper">
      <div className="tbp-editorial-face tbp-editorial-face--front">
        <span>{front}</span>
      </div>
      <div className="tbp-editorial-face tbp-editorial-face--back">
        <span>{back}</span>
      </div>
    </div>
  </article>
);
