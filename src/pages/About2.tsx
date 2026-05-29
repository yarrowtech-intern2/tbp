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
  type AboutPageCard,
  type AboutPageContent,
} from '../lib/appContent';
import './about.css';
import './about2.css';

const HERO_POSTER_IMAGE = 'https://res.cloudinary.com/dc3qprub3/video/upload/f_jpg,q_auto,w_1920/tbp-hero4_dmbfr5.jpg';
const HERO_VIDEO_URL = 'https://res.cloudinary.com/dc3qprub3/video/upload/f_auto,q_auto,w_1920/tbp-hero4_dmbfr5.mp4';
const EXTERNAL_HREF_PATTERN = /^(https?:|mailto:|tel:)/i;
const HASH_HREF_PATTERN = /^#/;

const renderCardCta = (card: AboutPageCard) => {
  const href = card.cta?.href?.trim();
  const label = card.cta?.label?.trim() || 'Open';
  if (!href) return null;

  if (EXTERNAL_HREF_PATTERN.test(href)) {
    const openNewTab = /^https?:/i.test(href);
    return (
      <a
        href={href}
        className="about-card-cta"
        onClick={(event) => event.stopPropagation()}
        target={openNewTab ? '_blank' : undefined}
        rel={openNewTab ? 'noopener noreferrer' : undefined}
      >
        {label}
        <ArrowUpRight size={16} />
      </a>
    );
  }

  if (HASH_HREF_PATTERN.test(href)) {
    return (
      <a href={href} className="about-card-cta" onClick={(event) => event.stopPropagation()}>
        {label}
        <ArrowUpRight size={16} />
      </a>
    );
  }

  return (
    <Link to={href} className="about-card-cta" onClick={(event) => event.stopPropagation()}>
      {label}
      <ArrowUpRight size={16} />
    </Link>
  );
};

export const About2: React.FC = () => {
  const [content, setContent] = useState<AboutPageContent>(DEFAULT_ABOUT_PAGE_CONTENT);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getPublicAppContent()
      .then((appContent) => {
        if (cancelled) return;
        setContent(appContent.aboutPage);
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
    <main className="about-page about2-theme">
      <video
        className="about2-video-bg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster={HERO_POSTER_IMAGE}
        aria-hidden="true"
      >
        <source src={HERO_VIDEO_URL} type="video/mp4" />
      </video>

      <Link to="/" className="about-home-btn" aria-label="Go home">
        <Home size={18} />
        <span>Home</span>
      </Link>

      <section className={`about-shell${activeCard ? ' has-active-card' : ''}`} aria-labelledby="about2-title">
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
                      <h1 id="about2-title">{content.title}</h1>
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
                    {renderCardCta(card)}
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
