import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Home,
  X,
} from 'lucide-react';
import {
  DEFAULT_ABOUT_PAGE_CONTENT,
  getPublicAppContent,
  type AboutPageContent,
} from '../lib/appContent';
import './about.css';

const randomFrom = (items: string[]) => {
  if (items.length === 0) return DEFAULT_ABOUT_PAGE_CONTENT.backgroundImages[0];
  return items[Math.floor(Math.random() * items.length)];
};

export const About: React.FC = () => {
  const [content, setContent] = useState<AboutPageContent>(DEFAULT_ABOUT_PAGE_CONTENT);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [backgroundImage, setBackgroundImage] = useState(() => randomFrom(DEFAULT_ABOUT_PAGE_CONTENT.backgroundImages));

  useEffect(() => {
    let cancelled = false;

    void getPublicAppContent()
      .then((appContent) => {
        if (cancelled) return;
        setContent(appContent.aboutPage);
        setBackgroundImage(randomFrom(appContent.aboutPage.backgroundImages));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveCardId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const activeCard = useMemo(
    () => content.cards.find((card) => card.id === activeCardId) || null,
    [activeCardId, content.cards]
  );

  return (
    <main className="about-page" style={{ '--about-image': `url("${backgroundImage}")` } as React.CSSProperties}>
      <Link to="/" className="about-home-btn" aria-label="Go home">
        <Home size={18} />
        <span>Home</span>
      </Link>

      <section className={`about-shell${activeCard ? ' has-active-card' : ''}`} aria-labelledby="about-title">
        <div className="about-bento" data-active={activeCard?.id || 'none'}>
          {content.cards.map((card, index) => {
            const isActive = card.id === activeCardId;
            const isCompressed = Boolean(activeCardId && !isActive);
            const isHeroCard = index === 0;
            const isImageCard = index === 2;

            return (
              <article
                key={card.id}
                className={`about-bento-card${isActive ? ' is-active' : ''}${isCompressed ? ' is-compressed' : ''}${isHeroCard ? ' is-hero-card' : ''}${isImageCard ? ' is-image-card' : ''}`}
                style={{ '--about-card-delay': `${index * 760}ms` } as React.CSSProperties}
                tabIndex={0}
                role="button"
                aria-expanded={isActive}
                onClick={() => setActiveCardId((current) => (current === card.id ? null : card.id))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveCardId((current) => (current === card.id ? null : card.id));
                  }
                }}
              >
                <div className="about-card-top">
                  <span className="about-card-label">{isHeroCard ? content.eyebrow : card.label}</span>
                  <span className="about-card-dots" aria-hidden="true">...</span>
                </div>
                <div className="about-card-main">
                  {isHeroCard ? (
                    <>
                      <strong className="about-card-metric">{card.metric || '62+'}</strong>
                      <h1 id="about-title">{content.title}</h1>
                      <p className="about-card-short">{content.subtitle}</p>
                    </>
                  ) : (
                    <>
                      {card.metric ? <strong className="about-card-metric">{card.metric}</strong> : null}
                      <h2>{card.title}</h2>
                      <p className="about-card-short">{card.shortText}</p>
                    </>
                  )}
                  <div className="about-card-full">
                    {card.fullText.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    {card.cta?.href ? (
                      <Link
                        to={card.cta.href}
                        className="about-card-cta"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {card.cta.label}
                        <ArrowUpRight size={16} />
                      </Link>
                    ) : null}
                  </div>
                </div>
                {!isActive ? <ArrowUpRight className="about-card-corner" size={24} aria-hidden="true" /> : null}
                {isActive ? (
                  <button
                    type="button"
                    className="about-card-close"
                    aria-label="Collapse card"
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveCardId(null);
                    }}
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};
