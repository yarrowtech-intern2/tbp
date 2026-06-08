import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { Globe } from '../components/ui/globe';
import MacbookScrollDemo from '../components/macbook-scroll-demo';
import { TextReveal } from '../components/ui/text-reveal';
import { DEFAULT_FOOTER_CONTENT, getPublicAppContent, type FooterContent, type FooterLink } from '../lib/appContent';
import { submitContactSubmission } from '../lib/contactSubmissions';
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

const FLOW_STEPS = [
  {
    id: 'discover',
    label: 'Discover',
  },
  {
    id: 'compare',
    label: 'Compare',
  },
  {
    id: 'book',
    label: 'Book',
  },
] as const;

const BOOKING_CATEGORIES = [
  {
    id: 'stays',
    kicker: 'Stay',
    title: 'Boutique stays and handpicked rooms',
    description: 'Compare location, mood, inclusions, and price without splitting the plan across tabs.',
    meta: 'Hotels, camps, villas',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/trip-card4_cbbvay',
  },
  {
    id: 'experiences',
    kicker: 'Experience',
    title: 'Activities that shape the trip',
    description: 'Add safaris, walking tours, food trails, and day plans that match the pace you want.',
    meta: 'Tours, tickets, day plans',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/trip-card2_jte8y0',
  },
  {
    id: 'guides',
    kicker: 'Guide',
    title: 'Local people who know the route',
    description: 'Book trusted hosts and guides when the trip needs context, coordination, or deeper access.',
    meta: 'Hosts, drivers, local experts',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/trip-card1_wynjds',
  },
  {
    id: 'support',
    kicker: 'Support',
    title: 'Trip details that keep it smooth',
    description: 'Keep transfers, timing, help, and day-of coordination in the same booking path.',
    meta: 'Transport, timing, assistance',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/f_auto,q_auto/trip-card3_puj8eh',
  },
] as const;

const TRUST_ITEMS = [
  {
    id: 'verified',
    title: 'Verified providers',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/v1780727230/trust-card1_h3it4f.png',
  },
  {
    id: 'details',
    title: 'Clear detailed trips',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/v1780727230/trust-card2_vl0ezr.png',
  },
  {
    id: 'support',
    title: 'Customer service',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/v1780727230/trust-card3_cxhqoj.png',
  },
  {
    id: 'payments',
    title: 'Secured payments',
    image: 'https://res.cloudinary.com/dc3qprub3/image/upload/v1780727230/trust-card4_kgblwi.png',
  },
] as const;

const FINAL_CTA_COPY = 'Betterpass brings trusted stays, guided experiences, local experts, and secure booking into one clear travel path, so you can stop juggling scattered plans and start choosing trips with confidence.';
const FINAL_CTA_WORDS = FINAL_CTA_COPY.split(/\s+/);

const HOME5_FOOTER_TITLE = 'Travel beautifully, hassle free\nwith The Betterpass';

const FAQ_ITEMS = [
  {
    question: 'What is Betterpass?',
    answer: 'Betterpass is a travel discovery and booking platform that brings stays, guided experiences, local experts, and secure booking into one place — so you can plan and book your entire trip without juggling tabs or scattered services.',
  },
  {
    question: 'How does booking work?',
    answer: 'It follows three simple steps: Discover listings for stays, tours, activities, and guides. Compare options side by side with clear pricing and inclusions. Then Book and pay securely — all in one flow.',
  },
  {
    question: 'Are the providers verified?',
    answer: 'Yes. Every provider on Betterpass goes through an admin review and approval process before their listings go live. This ensures you only see trusted, vetted stays, guides, and experiences.',
  },
  {
    question: 'What can I book on Betterpass?',
    answer: 'You can book across four categories: Stays (hotels, camps, villas), Experiences (safaris, walking tours, food trails, day plans), Guides (local hosts, drivers, experts), and Support (transfers, timing, day-of coordination).',
  },
  {
    question: 'Is my payment secure?',
    answer: 'Absolutely. All payments are processed through Razorpay, a trusted and secure payment gateway. Your financial information is never stored on our servers.',
  },
  {
    question: 'Can I message providers before booking?',
    answer: 'Yes. Betterpass has built-in messaging so you can chat directly with providers to ask questions, clarify details, or coordinate plans before you confirm a booking.',
  },
] as const;

const getFooterHref = (link: FooterLink) => link.href?.trim() || '#';

const isInternalHref = (href: string) => href.startsWith('/') || href.startsWith('#');

type ContactFormState = {
  name: string;
  email: string;
  phone: string;
  location: string;
  message: string;
};

const EMPTY_CONTACT_FORM: ContactFormState = {
  name: '',
  email: '',
  phone: '',
  location: '',
  message: '',
};

const getCarouselOffset = (index: number, activeIndex: number, total: number) => {
  let offset = index - activeIndex;
  if (offset > total / 2) offset -= total;
  if (offset < -total / 2) offset += total;
  return offset;
};

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const Home5: React.FC = () => {
  const [activeCard, setActiveCard] = useState(0);
  const [activeBookingCard, setActiveBookingCard] = useState(0);
  const [howProgress, setHowProgress] = useState(0);
  const [finalRevealWordIndex, setFinalRevealWordIndex] = useState(0);
  const [footerContent, setFooterContent] = useState<FooterContent>(DEFAULT_FOOTER_CONTENT);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [heroMenuOpen, setHeroMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);
  const bookingDragStartXRef = useRef<number | null>(null);
  const bookingDragDeltaXRef = useRef(0);
  const howSectionRef = useRef<HTMLElement | null>(null);
  const finalSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPublicAppContent()
      .then((content) => {
        if (!cancelled) setFooterContent(content.footer);
      })
      .catch((error) => {
        console.error('Failed to load landing footer content:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!contactModalOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContactModalOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contactModalOpen]);

  useEffect(() => {
    if (!heroMenuOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHeroMenuOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('.home5-hero-menu')) setHeroMenuOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [heroMenuOpen]);

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

  const goToBookingCard = (index: number) => {
    const total = BOOKING_CATEGORIES.length;
    setActiveBookingCard(((index % total) + total) % total);
  };

  const goToNextBookingCard = () => {
    goToBookingCard(activeBookingCard + 1);
  };

  const goToPrevBookingCard = () => {
    goToBookingCard(activeBookingCard - 1);
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

  const handleBookingPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    bookingDragStartXRef.current = event.clientX;
    bookingDragDeltaXRef.current = 0;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleBookingPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (bookingDragStartXRef.current === null) return;
    bookingDragDeltaXRef.current = event.clientX - bookingDragStartXRef.current;
  };

  const handleBookingPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (bookingDragStartXRef.current === null) return;
    if (bookingDragDeltaXRef.current <= -40) goToNextBookingCard();
    if (bookingDragDeltaXRef.current >= 40) goToPrevBookingCard();
    bookingDragStartXRef.current = null;
    bookingDragDeltaXRef.current = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const updateContactField = <K extends keyof ContactFormState>(key: K, value: ContactFormState[K]) => {
    setContactForm((current) => ({ ...current, [key]: value }));
  };

  const handleContactSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactSubmitting(true);
    setContactStatus(null);
    setContactError(null);

    try {
      await submitContactSubmission({
        ...contactForm,
        sourcePage: 'home_landing_footer',
      });
      setContactStatus('Thanks. We received your message and will get back to you soon.');
      setContactForm(EMPTY_CONTACT_FORM);
    } catch (error) {
      setContactError(error instanceof Error ? error.message : 'Failed to submit your message.');
    } finally {
      setContactSubmitting(false);
    }
  };

  useEffect(() => {
    let frame = 0;

    const updateHowProgress = () => {
      frame = 0;
      const node = howSectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(rect.height - viewportHeight, 1);
      const nextProgress = clampValue((-rect.top) / scrollableDistance, 0, 1);

      setHowProgress((current) => (Math.abs(current - nextProgress) > 0.001 ? nextProgress : current));
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateHowProgress);
    };

    updateHowProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  useEffect(() => {
    let frame = 0;

    const updateFinalProgress = () => {
      frame = 0;
      const node = finalSectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollableDistance = Math.max(rect.height - viewportHeight, 1);
      const nextProgress = clampValue((-rect.top) / scrollableDistance, 0, 1);
      const nextWordIndex = Math.min(
        FINAL_CTA_WORDS.length,
        Math.floor(nextProgress * (FINAL_CTA_WORDS.length + 1)),
      );

      setFinalRevealWordIndex((current) => (current !== nextWordIndex ? nextWordIndex : current));
    };

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateFinalProgress);
    };

    updateFinalProgress();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);

  const introProgress = clampValue(howProgress / 0.18, 0, 1);
  const discoverProgress = clampValue((howProgress - 0.18) / 0.2, 0, 1);
  const compareProgress = clampValue((howProgress - 0.42) / 0.2, 0, 1);
  const bookProgress = clampValue((howProgress - 0.68) / 0.2, 0, 1);
  const leftLineProgress = discoverProgress;
  const rightLineProgress = compareProgress;
  const flowConnectorProgress = [leftLineProgress, rightLineProgress];
  const activeFlowIndex = bookProgress > 0.08
    ? 2
    : compareProgress > 0.08
      ? 1
      : discoverProgress > 0.08
        ? 0
        : -1;
  const howSceneStyle = {
    opacity: 0.22 + (introProgress * 0.78),
    transform: `translateY(${(1 - introProgress) * 30}px)`,
  } satisfies React.CSSProperties;
  return (
    <main className="home5-page">
      <section className="home5-hero">
        <div className={`home5-hero-menu${heroMenuOpen ? ' is-open' : ''}`}>
          <button
            type="button"
            className="home5-hero-menu-toggle"
            aria-label={heroMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={heroMenuOpen}
            aria-controls="home5-hero-menu-panel"
            onClick={() => setHeroMenuOpen((current) => !current)}
          >
            <span className="home5-hero-menu-line" />
            <span className="home5-hero-menu-line" />
            <span className="home5-hero-menu-line" />
          </button>

          <nav id="home5-hero-menu-panel" className="home5-hero-menu-panel" aria-label="Landing navigation">
            <Link to="/" onClick={() => setHeroMenuOpen(false)}>Home</Link>
            <Link to="/about-final" onClick={() => setHeroMenuOpen(false)}>About us</Link>
            <Link to="/auth" onClick={() => setHeroMenuOpen(false)}>Login</Link>
            <button
              type="button"
              onClick={() => {
                setHeroMenuOpen(false);
                setContactModalOpen(true);
              }}
            >
              Contact
            </button>
          </nav>
        </div>

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

      <section ref={howSectionRef} className="home5-how-section">
        <div className="home5-how-track">
          <div className="home5-how-sticky">
            <div className="container">
              <div className="home5-how-scene" style={howSceneStyle}>
                <div className="home5-how-shell">
                  <span className="home5-how-eyebrow">Why choose betterpass</span>
                  <div className="home5-how-heading">
                    <h2 className="home5-how-section-title">Three simple steps</h2>
                    <p className="home5-how-section-subtitle">from idea to booked experience</p>
                  </div>
                  <p className="home5-how-support">
                    Discover, compare and confirm with one cleaner path through the trip.
                  </p>
                </div>

                <div className="home5-flow-stage" aria-label="How it works flow">
                  <div className="home5-flow-row">
                    {FLOW_STEPS.map((step, index) => {
                      const isActive = activeFlowIndex === index;

                      return (
                        <React.Fragment key={step.id}>
                          <div className={`home5-flow-node${isActive ? ' is-active' : ''}`}>
                            <svg className="home5-flow-ripple" viewBox="0 0 200 200" aria-hidden="true">
                              <circle className="home5-flow-ring home5-flow-ring-1" cx="100" cy="100" r="64" />
                              <circle className="home5-flow-ring home5-flow-ring-2" cx="100" cy="100" r="78" />
                              <circle className="home5-flow-ring home5-flow-ring-3" cx="100" cy="100" r="92" />
                            </svg>
                            <div className="home5-flow-core">
                              <span>{step.label}</span>
                            </div>
                          </div>
                          {index < FLOW_STEPS.length - 1 ? (
                            <div
                              className="home5-flow-connector"
                              aria-hidden="true"
                              style={{ '--flow-progress': flowConnectorProgress[index] } as React.CSSProperties}
                            />
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home5-book-section">
        <div className="container">
          <ScrollReveal className="home5-book-shell">
            <span className="home5-book-eyebrow">What you can book</span>
            <div className="home5-book-heading">
              <h2 className="home5-book-title">Build the trip, not just one booking</h2>
              <p className="home5-book-copy">
                Betterpass brings the stay, experience, guide, and support layer into one trip-building flow.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal className="home5-book-carousel" delay={70}>
            <div className="home5-book-carousel-stage">
              <button
                type="button"
                className="home5-book-carousel-arrow home5-book-carousel-arrow-left"
                aria-label="Previous booking card"
                onClick={goToPrevBookingCard}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ChevronLeft size={24} />
              </button>

              <div
                className="home5-book-carousel-stack"
                onPointerDown={handleBookingPointerDown}
                onPointerMove={handleBookingPointerMove}
                onPointerUp={handleBookingPointerEnd}
                onPointerCancel={handleBookingPointerEnd}
              >
                {BOOKING_CATEGORIES.map((item, index) => {
                  const offset = getCarouselOffset(index, activeBookingCard, BOOKING_CATEGORIES.length);
                  const positionClass = offset === 0
                    ? 'is-active'
                    : offset === -1
                      ? 'is-prev'
                      : offset === 1
                        ? 'is-next'
                        : 'is-hidden';

                  return (
                    <article
                      key={item.id}
                      className={`home5-book-card ${positionClass}`}
                      aria-hidden={offset !== 0}
                    >
                      <img src={item.image} alt={item.title} loading="lazy" decoding="async" />
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="home5-book-carousel-arrow home5-book-carousel-arrow-right"
                aria-label="Next booking card"
                onClick={goToNextBookingCard}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <ChevronRight size={24} />
              </button>
            </div>

            <div className="home5-book-carousel-dots" aria-label="Booking card navigation">
              {BOOKING_CATEGORIES.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={`home5-book-carousel-dot${index === activeBookingCard ? ' is-active' : ''}`}
                  aria-label={`Go to ${item.kicker}`}
                  aria-pressed={index === activeBookingCard}
                  onClick={() => goToBookingCard(index)}
                />
              ))}
            </div>
          </ScrollReveal>

          <ScrollReveal className="home5-trip-card" delay={120}>
            <picture className="home5-trip-picture">
              <source
                media="(max-width: 640px)"
                srcSet="https://res.cloudinary.com/dc3qprub3/image/upload/e_opacity_threshold:100/f_auto,q_auto/wide-card-mobile_ykdljd"
              />
              <img
                src="https://res.cloudinary.com/dc3qprub3/image/upload/e_opacity_threshold:100/f_auto,q_auto/wide-card_zvtgez"
                alt="Sample trip build overview"
                loading="lazy"
                decoding="async"
              />
            </picture>
          </ScrollReveal>
        </div>
      </section>

      <section className="home5-trust-section">
        <div className="container">
          <div className="home5-trust-layout">
            <ScrollReveal className="home5-trust-intro">
              <span className="home5-trust-eyebrow">Why trust Betterpass</span>
              <h2 className="home5-trust-title">Book with people and plans you can trust</h2>
              <TextReveal className="home5-trust-reveal">
                Confidence comes from verified providers, clear details, connected support, and payment visibility in one place.
              </TextReveal>
            </ScrollReveal>

            <div className="home5-trust-list" aria-label="Betterpass trust points">
              {TRUST_ITEMS.map((item, index) => (
                <ScrollReveal
                  key={item.id}
                  className="home5-trust-item"
                  delay={80 + (index * 70)}
                >
                  <span className="home5-trust-label">{item.title}</span>
                  <img src={item.image} alt={item.title} loading="lazy" decoding="async" />
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <MacbookScrollDemo />

      <section ref={finalSectionRef} className="home5-final-section">
        <div className="container">
          <div className="home5-final-sticky">
            <div className="home5-final-layout">
              <div className="home5-final-content">
                <span className="home5-final-eyebrow">Ready when you are</span>
                <h2 className="home5-final-title">Start exploring with Betterpass</h2>
                <p className="home5-final-reveal" aria-label={FINAL_CTA_COPY}>
                  {FINAL_CTA_WORDS.map((word, index) => {
                    const revealState = index < finalRevealWordIndex
                      ? 'is-complete'
                      : index === finalRevealWordIndex
                        ? 'is-next'
                        : 'is-pending';
                    return (
                      <span
                        key={`${word}-${index}`}
                        className={`home5-final-word ${revealState}`}
                        aria-hidden="true"
                      >
                        {word}
                        {index < FINAL_CTA_WORDS.length - 1 ? '\u00A0' : ''}
                      </span>
                    );
                  })}
                </p>
              </div>
              <div className="home5-final-visual-slot">
                <div className="home5-final-cta-field" aria-hidden="true">
                  <span className="home5-final-cta-ripple home5-final-cta-ripple-1" />
                  <span className="home5-final-cta-ripple home5-final-cta-ripple-2" />
                  <span className="home5-final-cta-ripple home5-final-cta-ripple-3" />
                </div>
                <Link className="home5-final-orb-cta" to="/auth" aria-label="Login to explore">
                  <span>Explore</span>
                </Link>
                <div className="home5-final-globe-ground" aria-hidden="true" />
                <Globe className="home5-final-globe" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home5-faq-section">
        <div className="container">
          <ScrollReveal>
            <span className="home5-section-eyebrow">Support</span>
          </ScrollReveal>
          <ScrollReveal delay={80}>
            <h2 className="home5-faq-title">Frequently asked questions</h2>
          </ScrollReveal>
          <div className="home5-faq-grid">
            {FAQ_ITEMS.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <ScrollReveal key={item.question} delay={100 + index * 60}>
                  <div className={`home5-faq-card${isOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="home5-faq-trigger"
                      onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                      aria-expanded={isOpen}
                    >
                      <span className="home5-faq-question">{item.question}</span>
                      <span className="home5-faq-icon" aria-hidden="true">
                        <span /><span />
                      </span>
                    </button>
                    <div className="home5-faq-body">
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="home5-footer" id="contact">
        <div className="home5-footer-inner">
          <div className="home5-footer-watermark" aria-hidden="true">Betterpass</div>

          <div className="home5-footer-top">
            <div className="home5-footer-brand">
              <span className="home5-footer-eyebrow">The Betterpass</span>
              <p>{HOME5_FOOTER_TITLE}</p>
              <button type="button" className="home5-footer-contact-btn" onClick={() => setContactModalOpen(true)}>
                Contact us
              </button>
            </div>

            <nav className="home5-footer-columns" aria-label="Footer navigation">
              {footerContent.columns.map((column) => (
                <div className="home5-footer-column" key={column.title}>
                  <h2>{column.title}</h2>
                  <ul>
                    {column.links.map((link, index) => {
                      const href = getFooterHref(link);
                      return (
                        <li key={`${column.title}-${link.label}-${index}`}>
                          {isInternalHref(href) ? (
                            <Link to={href}>{link.label}</Link>
                          ) : (
                            <a href={href} target={href.startsWith('mailto:') || href.startsWith('tel:') ? undefined : '_blank'} rel="noreferrer">
                              {link.label}
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="home5-footer-bottom">
            <p>{footerContent.copyright}</p>
            <div className="home5-footer-socials" aria-label="Social links">
              {footerContent.socials.map((link, index) => {
                const href = getFooterHref(link);
                return (
                  <a
                    key={`${link.label}-${index}`}
                    href={href}
                    target={href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') ? undefined : '_blank'}
                    rel="noreferrer"
                  >
                    {link.label}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>

      {contactModalOpen && (
        <div className="home5-contact-modal" role="dialog" aria-modal="true" aria-labelledby="home5-contact-title">
          <button type="button" className="home5-contact-backdrop" aria-label="Close contact form" onClick={() => setContactModalOpen(false)} />
          <div className="home5-contact-panel">
            <div className="home5-contact-head">
              <div>
                <span>Contact</span>
                <h2 id="home5-contact-title">Tell us what you need</h2>
              </div>
              <button type="button" className="home5-contact-close" onClick={() => setContactModalOpen(false)} aria-label="Close contact form">
                <X size={20} />
              </button>
            </div>

            <form className="home5-contact-form" onSubmit={(event) => void handleContactSubmit(event)}>
              <label>
                <span>Name</span>
                <input value={contactForm.name} onChange={(event) => updateContactField('name', event.target.value)} required />
              </label>
              <label>
                <span>Email</span>
                <input type="email" value={contactForm.email} onChange={(event) => updateContactField('email', event.target.value)} required />
              </label>
              <label>
                <span>Phone</span>
                <input value={contactForm.phone} onChange={(event) => updateContactField('phone', event.target.value)} />
              </label>
              <label>
                <span>Location</span>
                <input value={contactForm.location} onChange={(event) => updateContactField('location', event.target.value)} />
              </label>
              <label className="home5-contact-wide">
                <span>Message</span>
                <textarea value={contactForm.message} onChange={(event) => updateContactField('message', event.target.value)} required />
              </label>

              {contactStatus && <p className="home5-contact-status"><CheckCircle2 size={16} />{contactStatus}</p>}
              {contactError && <p className="home5-contact-error">{contactError}</p>}

              <button type="submit" className="home5-contact-submit" disabled={contactSubmitting}>
                {contactSubmitting ? <Loader2 size={17} className="home5-spin" /> : null}
                Send message
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
