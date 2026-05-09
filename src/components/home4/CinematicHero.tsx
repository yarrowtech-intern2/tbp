import React, { useRef } from 'react';
import { useHome4HeroMotion } from '../../hooks/useHome4HeroMotion';

type CinematicHeroProps = {
  heroRef: React.RefObject<HTMLElement | null>;
  showcaseRef: React.RefObject<HTMLElement | null>;
};

const HERO_WORDS = ['THE', 'BETTER', 'PASS'];

export const CinematicHero: React.FC<CinematicHeroProps> = ({ heroRef, showcaseRef }) => {
  const introRef = useRef<HTMLParagraphElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const globeRef = useRef<HTMLDivElement>(null);
  const scrollCueRef = useRef<HTMLAnchorElement>(null);
  const titleWordRefs = useRef<Array<HTMLSpanElement | null>>([]);

  useHome4HeroMotion({
    sectionRef: heroRef,
    introRef,
    titleRef,
    globeRef,
    scrollCueRef,
    showcaseRef,
    titleWordRefs,
  });

  const setTitleWordRef = (index: number) => (node: HTMLSpanElement | null) => {
    titleWordRefs.current[index] = node;
  };

  return (
    <section
      id="h4-hero"
      ref={heroRef}
      className="h4-hero"
      aria-labelledby="h4-hero-title"
    >
      <div className="h4-hero-stage">
        <div className="h4-hero-noise" aria-hidden="true" />
        <div className="h4-hero-gradient h4-hero-gradient-a" aria-hidden="true" />
        <div className="h4-hero-gradient h4-hero-gradient-b" aria-hidden="true" />

        <div className="h4-hero-copy">
          <div className="h4-hero-intro-mask">
            <p ref={introRef} className="h4-hero-tagline">
              Enter the immersive world of
            </p>
          </div>

          <div className="h4-hero-title-shell">
            <div className="h4-hero-title-glow" aria-hidden="true" />
            <h1 id="h4-hero-title" ref={titleRef} className="h4-hero-title">
              {HERO_WORDS.map((word, index) => (
                <span key={word} className="h4-hero-title-mask">
                  <span ref={setTitleWordRef(index)} className="h4-hero-title-word">
                    {word}
                  </span>
                </span>
              ))}
            </h1>
          </div>
        </div>

        <div className="h4-hero-globe-wrap" aria-hidden="true">
          <div className="h4-hero-ambient" />
          <div className="h4-hero-sphere" ref={globeRef}>
            <img
              src="/images/home4/orb2.png"
              alt=""
              className="h4-hero-sphere-image"
              decoding="async"
              fetchPriority="high"
            />
            <div className="h4-hero-sphere-gloss" />
          </div>
        </div>

        <a
          ref={scrollCueRef}
          href="#h4-showcase"
          className="h4-hero-scroll"
          aria-label="Scroll to featured destinations"
        >
          Scroll
        </a>
      </div>
    </section>
  );
};
