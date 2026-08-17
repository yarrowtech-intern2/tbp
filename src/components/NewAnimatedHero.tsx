import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import './new-animated-hero.css';

const TRAVELER_IMAGE = 'https://res.cloudinary.com/dc3qprub3/image/upload/v1786955397/tbp-hero-boy_v9n8fd.webp';
const PHASE_COUNT = 4;

type FlipTileProps = {
  className: string;
  front: React.ReactNode;
  back: React.ReactNode;
};

export const NewAnimatedHero: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % PHASE_COUNT);
    }, 5600);

    return () => {
      window.clearInterval(timer);
    };
  }, [prefersReducedMotion]);

  return (
    <section
      id="tbp-editorial-hero"
      className={`tbp-editorial-hero tbp-editorial-hero--phase-${phase}`}
      aria-labelledby="tbp-editorial-title"
    >
      <HeroBackground />

      <div className="tbp-editorial-layout">
        <HeroIntro />
        <ProviderCount />
        <HeroCTA />
        <AnimatedCardGrid reducedMotion={Boolean(prefersReducedMotion)} />
      </div>

      <GridOverlay />
    </section>
  );
};

const HeroBackground: React.FC = () => (
  <div className="tbp-editorial-bg" aria-hidden="true" />
);

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
  <motion.div
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
  </motion.div>
);

const HeroCTA: React.FC = () => (
  <Link className="tbp-editorial-cta" to="/signup" aria-label="Get started with The Better Pass">
    <span>Get started</span>
    <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
  </Link>
);

const AnimatedCardGrid: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => (
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

    <ExploreTile reducedMotion={reducedMotion} />
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

const ExploreTile: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => (
  <article className="tbp-editorial-tile tbp-editorial-tile--explore">
    <div className="tbp-editorial-explore-copy">
      Explore
      <br />
      places, find
      <br />
      hidden gems,
      <br />
      explore with
      <br />
      locals
    </div>
    <motion.img
      className="tbp-editorial-traveler"
      src={TRAVELER_IMAGE}
      alt="Traveler with backpack"
      width={420}
      height={620}
      decoding="async"
      loading="eager"
      animate={reducedMotion ? undefined : { y: [0, -7, 0] }}
      transition={reducedMotion ? undefined : { duration: 4.8, repeat: Infinity, ease: 'easeInOut' }}
    />
  </article>
);
