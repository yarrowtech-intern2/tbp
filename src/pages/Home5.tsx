import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Globe } from '../components/ui/globe';
import { TextReveal } from '../components/ui/text-reveal';
import './home5.css';

type ScrollRevealProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, className, delay = 0 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: '0px 0px -12% 0px' },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`home5-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const VALUE_IMAGE_CARDS = [
  {
    id: 'planning',
    title: 'All in one planning',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/tbp-card1_e6jedz',
  },
  {
    id: 'guides',
    title: 'Trusted local guides',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/card2_byj9ht',
  },
  {
    id: 'bookings',
    title: 'Simple bookings',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/tbp-card3_etqxzt',
  },
] as const;

const getCarouselOffset = (index: number, activeIndex: number, total: number) => {
  let offset = index - activeIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
};

export const Home5: React.FC = () => {
  const [activeCard, setActiveCard] = useState(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);

  const goToCard = (index: number) => {
    const total = VALUE_IMAGE_CARDS.length;
    setActiveCard(((index % total) + total) % total);
  };

  const goToNextCard = () => {
    goToCard(activeCard + 1);
  };

  const goToPrevCard = () => {
    goToCard(activeCard - 1);
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartXRef.current === null) return;
    const currentX = event.touches[0]?.clientX ?? touchStartXRef.current;
    touchDeltaXRef.current = currentX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null) return;
    if (touchDeltaXRef.current <= -36) goToNextCard();
    if (touchDeltaXRef.current >= 36) goToPrevCard();
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;
  };

  return (
    <main className="home5-page">
      <section className="home5-hero">
        <div className="home5-hero-shell">
          <div className="home5-copy">
            <h1 className="home5-title">The Betterpass</h1>
            <h2 className="home5-subtitle">
              <span>travel made</span>
              <span>simple</span>
            </h2>
          </div>

          <div className="home5-globe-stage" aria-hidden="true">
            <div className="home5-globe-ground" />
            <Globe className="home5-globe" />
            <div className="home5-globe-fade" />
          </div>
        </div>
      </section>

      <section className="home5-value-section">
        <div className="container">
          <ScrollReveal className="home5-value-shell">
            <span className="home5-section-eyebrow">Why The Betterpass</span>
            <h2 className="home5-section-title">Why travel feels easier here</h2>
            <TextReveal className="home5-value-reveal">
              Plan less, compare faster, and move through trips with fewer decisions.
            </TextReveal>
          </ScrollReveal>

          <div className="home5-value-grid home5-value-grid-desktop">
            {VALUE_IMAGE_CARDS.map((card, index) => (
              <ScrollReveal key={card.id} delay={40 + (index * 80)}>
                <article className="home5-value-image-card">
                  <img src={card.image} alt={card.title} loading="lazy" decoding="async" />
                </article>
              </ScrollReveal>
            ))}
          </div>

          <ScrollReveal className="home5-value-carousel" delay={80}>
            <div
              className="home5-carousel-stage"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <button
                type="button"
                className="home5-carousel-arrow home5-carousel-arrow-left"
                aria-label="Previous card"
                onClick={goToPrevCard}
              >
                <ChevronLeft size={20} />
              </button>

              <div className="home5-carousel-stack">
                {VALUE_IMAGE_CARDS.map((card, index) => {
                  const offset = getCarouselOffset(index, activeCard, VALUE_IMAGE_CARDS.length);
                  const positionClass = offset === 0
                    ? 'is-active'
                    : offset === -1
                      ? 'is-prev'
                      : offset === 1
                        ? 'is-next'
                        : 'is-hidden';

                  return (
                    <article
                      key={card.id}
                      className={`home5-carousel-card ${positionClass}`}
                      aria-hidden={offset !== 0}
                    >
                      <img src={card.image} alt={card.title} loading="lazy" decoding="async" />
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="home5-carousel-arrow home5-carousel-arrow-right"
                aria-label="Next card"
                onClick={goToNextCard}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="home5-carousel-dots" aria-label="Card navigation">
              {VALUE_IMAGE_CARDS.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  className={`home5-carousel-dot${index === activeCard ? ' is-active' : ''}`}
                  aria-label={`Go to ${card.title}`}
                  aria-pressed={index === activeCard}
                  onClick={() => goToCard(index)}
                />
              ))}
            </div>
          </ScrollReveal>

          <div className="home5-value-grid home5-value-grid-mobile-fallback">
            {VALUE_IMAGE_CARDS.map((card) => (
              <article key={card.id} className="home5-value-image-card">
                <img src={card.image} alt={card.title} loading="lazy" decoding="async" />
              </article>
            ))}
          </div>

          <ScrollReveal className="home5-proof-row" delay={120}>
            <span>activities</span>
            <span>stays</span>
            <span>guides</span>
            <span>support</span>
          </ScrollReveal>
        </div>
      </section>
    </main>
  );
};
