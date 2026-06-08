import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';
import './about-final.css';

const ABOUT_FINAL_TITLE = 'About Betterpass';
const ABOUT_FINAL_COPY = 'Betterpass exists to make travel feel clear before it becomes memorable. We bring trusted stays, guided experiences, local providers, and secure booking into one calm path, so every trip starts with confidence instead of scattered planning.';
const ABOUT_FINAL_WORDS = ABOUT_FINAL_COPY.split(/\s+/);

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const AboutFinal: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [activeWordIndex, setActiveWordIndex] = useState(0);

  useEffect(() => {
    let frame = 0;

    const updateActiveWord = () => {
      frame = 0;
      const node = sectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(rect.height - viewportHeight, 1);
      const progress = clampValue((-rect.top) / scrollableDistance, 0, 1);
      const nextWordIndex = Math.min(
        ABOUT_FINAL_WORDS.length,
        Math.floor(progress * (ABOUT_FINAL_WORDS.length + 1)),
      );

      setActiveWordIndex((current) => (current !== nextWordIndex ? nextWordIndex : current));
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateActiveWord);
    };

    updateActiveWord();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  return (
    <main className="about-final-page">
      <Link to="/" className="about-final-home" aria-label="Go home">
        <Home size={18} />
        <span>Home</span>
      </Link>

      <section ref={sectionRef} className="about-final-section" aria-labelledby="about-final-title">
        <div className="about-final-sticky">
          <div className="about-final-shell">
            <span className="about-final-eyebrow">The Betterpass story</span>
            <h1 id="about-final-title" className="about-final-title">{ABOUT_FINAL_TITLE}</h1>
            <p className="about-final-reveal" aria-label={ABOUT_FINAL_COPY}>
              {ABOUT_FINAL_WORDS.map((word, index) => {
                const revealState = index < activeWordIndex
                  ? 'is-complete'
                  : index === activeWordIndex
                    ? 'is-next'
                    : 'is-pending';

                return (
                  <span
                    key={`${word}-${index}`}
                    className={`about-final-word ${revealState}`}
                    aria-hidden="true"
                  >
                    {word}
                    {index < ABOUT_FINAL_WORDS.length - 1 ? '\u00A0' : ''}
                  </span>
                );
              })}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
