import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DEFAULT_FOOTER_CONTENT,
  getFooterContactDetails,
  getPublicAppContent,
  type FooterContent,
  type FooterLink,
} from '../lib/appContent';
import './about-final.css';

const ABOUT_STORY_SECTIONS = [
  {
    id: 'intro',
    eyebrow: 'The Better Pass story',
    title: 'About The Better Pass',
    // copy: 'The Better Pass exists to make travel feel clear before it becomes memorable. We bring trusted stays, guided experiences, local providers, and secure booking into one calm path, so every trip starts with confidence instead of scattered planning.',

    copy: 'The Better Pass is a modern travel companion designed to make exploring new destinations easier, more enjoyable, and more memorable. Our platform helps travelers discover attractions, activities, unique experiences, and travel opportunities while providing all the essential information needed for a seamless journey.',
    image: undefined,
    video: undefined,
    mediaAlt: undefined,
  },
  {
    id: 'why',
    eyebrow: 'Why The Better Pass exists',
    title: 'Travel should feel clear before it feels memorable',
    copy: 'The Better Pass exists because planning a trip should not mean juggling scattered tabs, uncertain providers, vague details, and last minute doubt. We bring stays, guided experiences, local experts, and booking decisions into one calm path so travelers can move from curiosity to confidence faster.',
    image: undefined,
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1780904026/3_pcoth2.mp4',
    mediaAlt: 'Travel planning video placeholder for why The Better Pass exists',
  },
  {
    id: 'safer',
    eyebrow: 'How we make travel safer',
    title: 'Trust is designed into every step',
    copy: 'Safer travel starts before checkout. The Better Pass helps travelers compare clearer listings, understand who is hosting the experience, see what is included, and choose providers with stronger signals. The goal is simple: fewer surprises, better decisions, and a booking path that feels transparent.',
    image: undefined,
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1780904026/1_zldhdr.mp4',
    mediaAlt: 'Travel safety video placeholder for The Better Pass trust',
  },
  {
    id: 'community',
    eyebrow: 'Community',
    title: 'Better trips are built with local people',
    copy: 'The Better Pass community connects travelers with hosts, guides, tour operators, and local businesses who shape the real texture of a place. We believe memorable travel comes from context, care, timing, and people who know the route beyond the surface.',
    image: undefined,
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1780904026/2_raucel.mp4',
    mediaAlt: 'Community travel video placeholder for local people',
  },
] as const;

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getFooterHref = (link: FooterLink) => link.href?.trim() || '#';

const shouldOpenInNewTab = (href: string) => (
  !href.startsWith('mailto:')
  && !href.startsWith('tel:')
  && !href.startsWith('#')
  && !href.startsWith('/')
);

type AboutStorySectionProps = {
  id: string;
  eyebrow: string;
  title: string;
  copy: string;
  image?: string;
  video?: string;
  mediaAlt?: string;
};

const AboutStorySection: React.FC<AboutStorySectionProps> = ({ id, eyebrow, title, copy, image, video, mediaAlt }) => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const words = useMemo(() => copy.split(/\s+/), [copy]);
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
      const nextWordIndex = Math.min(words.length, Math.floor(progress * (words.length + 1)));

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
  }, [words]);

  return (
    <section ref={sectionRef} className={`about-final-section about-final-section-${id}`} aria-labelledby={`about-final-${id}`}>
      <div className="about-final-sticky">
        <div className="about-final-shell">
          <div className="about-final-copy">
            <span className="about-final-eyebrow">{eyebrow}</span>
            <h1 id={`about-final-${id}`} className="about-final-title">{title}</h1>
            <p className="about-final-reveal" aria-label={copy}>
              {words.map((word, index) => {
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
                    {index < words.length - 1 ? '\u00A0' : ''}
                  </span>
                );
              })}
            </p>
          </div>

          {image || video ? (
            <figure className="about-final-media-wrap" aria-label={mediaAlt}>
              {video ? (
                <video
                  src={video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={mediaAlt}
                />
              ) : (
                <img src={image} alt={mediaAlt || ''} loading="lazy" decoding="async" />
              )}
            </figure>
          ) : null}
        </div>
      </div>
    </section>
  );
};

const AboutFinalContactSection: React.FC<{ footerContent: FooterContent }> = ({ footerContent }) => {
  const contactDetails = getFooterContactDetails(footerContent);
  const contactLinks = [
    contactDetails.phone ? { ...contactDetails.phone, type: 'Phone' } : null,
    contactDetails.email ? { ...contactDetails.email, type: 'Email' } : null,
  ].filter((item): item is FooterLink & { type: string } => Boolean(item));

  return (
    <section className="about-final-contact-section" aria-labelledby="about-final-contact-title">
      <div className="about-final-contact-shell">
        <div className="about-final-contact-copy">
          <span className="about-final-eyebrow">Where was The Better Pass born?</span>
          <h2 id="about-final-contact-title" className="about-final-contact-title">Kolkata, India</h2>

          <div className="about-final-contact-links" aria-label="The Better Pass contact details">
            {contactLinks.map((link) => {
              const href = getFooterHref(link);
              return (
                <a
                  className="about-final-contact-link"
                  key={`${link.type}-${link.label}`}
                  href={href}
                >
                  <span>{link.type}</span>
                  <strong>{link.label}</strong>
                </a>
              );
            })}
          </div>

          {footerContent.socials.length > 0 ? (
            <div className="about-final-contact-socials" aria-label="Social links">
              {footerContent.socials.map((link, index) => {
                const href = getFooterHref(link);
                return (
                  <a
                    key={`${link.label}-${index}`}
                    href={href}
                    target={shouldOpenInNewTab(href) ? '_blank' : undefined}
                    rel={shouldOpenInNewTab(href) ? 'noreferrer' : undefined}
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          ) : null}
        </div>

        <figure className="about-final-map-wrap" aria-label="Kolkata map">
          <img src="/map/kolkata-map.svg" alt="Kolkata map showing The Better Pass address" loading="lazy" decoding="async" />
        </figure>
      </div>
    </section>
  );
};

export const AboutFinal: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [footerContent, setFooterContent] = useState<FooterContent>(DEFAULT_FOOTER_CONTENT);

  useEffect(() => {
    let cancelled = false;

    getPublicAppContent()
      .then((content) => {
        if (!cancelled) setFooterContent(content.footer);
      })
      .catch((error) => {
        console.error('Failed to load about contact footer content:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.about-final-menu')) setMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <main className="about-final-page">
      <div className={`about-final-menu${menuOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="about-final-menu-toggle"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="about-final-menu-panel"
          onClick={() => setMenuOpen((current) => !current)}
        >
          <span className="about-final-menu-line" />
          <span className="about-final-menu-line" />
          <span className="about-final-menu-line" />
        </button>

        <nav id="about-final-menu-panel" className="about-final-menu-panel" aria-label="About page navigation">
          <Link to="/" onClick={() => setMenuOpen(false)}>Home</Link>
          <Link to="/about-final" onClick={() => setMenuOpen(false)}>About us</Link>
          <Link to="/login" onClick={() => setMenuOpen(false)}>Login</Link>
          <Link to="/#contact" onClick={() => setMenuOpen(false)}>Contact</Link>
        </nav>
      </div>

      {ABOUT_STORY_SECTIONS.map((section) => (
        <AboutStorySection
          key={section.id}
          id={section.id}
          eyebrow={section.eyebrow}
          title={section.title}
          copy={section.copy}
          image={section.image}
          video={section.video}
          mediaAlt={section.mediaAlt}
        />
      ))}

      <AboutFinalContactSection footerContent={footerContent} />
    </main>
  );
};
