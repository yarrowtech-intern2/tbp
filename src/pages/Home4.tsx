import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Compass,
  Headphones,
  Hotel,
  Instagram,
  Landmark,
  Linkedin,
  Mail,
  MapPinned,
  Mountain,
  PlaneTakeoff,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trees,
  Twitter,
  type LucideIcon,
  Waves,
} from 'lucide-react';
import './home4.css';

type RevealBlockProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

const SLIDES = [
  {
    image: '/images/home4/beach.jpg',
    name: 'BEACHES',
    description:
      'Private coastlines, salt-air mornings, and resort experiences curated for travelers who want calm, clarity, and cinematic luxury by the sea.',
    cardTitle: 'Aerial arrival',
    cardText:
      'Discover secluded bays, signature dining, and glassy turquoise water with concierge-led stays designed around slow, elegant travel.',
  },
  {
    image: '/images/home4/desert.jpg',
    name: 'DESERTS',
    description:
      'Golden horizons, sculpted dunes, and silence-led retreats for travelers drawn to warm light, open space, and refined remote stays.',
    cardTitle: 'Sunset camps',
    cardText:
      'Move between private desert camps, curated tasting dinners, and sunset drives with every detail managed end to end.',
  },
  {
    image: '/images/home4/forrest.jpg',
    name: 'FORESTS',
    description:
      'Mist, cedar air, and immersive eco-luxury escapes built around slower routes, hidden lodges, and restorative green landscapes.',
    cardTitle: 'Canopy stays',
    cardText:
      'Wake to quiet trails, private decks, and wellness itineraries shaped for modern travelers who value nature without compromise.',
  },
  {
    image: '/images/home4/mopunts.jpg',
    name: 'MOUNTAINS',
    description:
      'Elevated hideaways, cold-air clarity, and iconic ridgelines curated into polished alpine journeys with seamless movement.',
    cardTitle: 'High-altitude calm',
    cardText:
      'From panoramic suites to guided ascent days, each stay is designed for comfort, perspective, and quiet grandeur.',
  },
  {
    image: '/images/home4/city.jpg',
    name: 'CITIES',
    description:
      'Design hotels, private tables, and cultured city energy packaged into precise itineraries for travelers who move with intent.',
    cardTitle: 'Urban editions',
    cardText:
      'Unlock skyline suites, chef-led reservations, and after-dark experiences curated with premium local access.',
  },
  {
    image: '/images/home4/temple.jpg',
    name: 'TEMPLES',
    description:
      'Sacred architecture, slow cultural journeys, and timeless heritage stays arranged with a contemporary luxury lens.',
    cardTitle: 'Heritage routes',
    cardText:
      'Travel through ceremonial landmarks, boutique stays, and deeply considered cultural experiences with calm precision.',
  },
];

const STATS = [
  { value: '20+', label: 'Restaurants' },
  { value: '8+', label: 'Services' },
  { value: '12+', label: 'Brands' },
  { value: '22+', label: 'Countries' },
];

const FEATURED_DESTINATIONS = [
  {
    title: 'Mandarmoni Coast',
    location: 'West Bengal, India',
    description: 'Private shoreline stays, clean sea light, and relaxed coastal pacing for weekend reset itineraries.',
    image: '/images/mandarmoni2.jpg',
  },
  {
    title: 'Sikkim Highlands',
    location: 'Eastern Himalayas',
    description: 'Layered mountain air, curated ridge drives, and alpine stays designed around clarity and quiet.',
    image: '/images/sikkim2.jpg',
  },
  {
    title: 'Kerala Backwaters',
    location: 'Kerala, India',
    description: 'Lagoon-facing suites, slow water routes, and wellness-led days with soft transitions throughout.',
    image: '/images/kerala1.jpg',
  },
  {
    title: 'Puri Heritage',
    location: 'Odisha, India',
    description: 'Temple architecture, heritage stays, and cultural routes framed with calm premium planning.',
    image: '/images/jagannath-puri-temple.jpg',
  },
];

const EXPERIENCE_CATEGORIES: Array<{
  title: string;
  description: string;
  image: string;
  icon: LucideIcon;
  className?: string;
}> = [
  {
    title: 'Beaches',
    description: 'Slow mornings, private shoreline stays, and warm-water itineraries designed for calm.',
    image: '/images/home4/beach.jpg',
    icon: Waves,
    className: 'is-large',
  },
  {
    title: 'Mountains',
    description: 'Elevated escapes with panoramic suites, alpine dining, and quiet high-altitude routes.',
    image: '/images/home4/mopunts.jpg',
    icon: Mountain,
  },
  {
    title: 'Adventure',
    description: 'Curated motion with paragliding, off-grid days, and seamless support around every transfer.',
    image: '/images/activities/paragliding.jpg',
    icon: Compass,
  },
  {
    title: 'Luxury Resorts',
    description: 'Design-led stays that bring together architecture, wellness, and concierge hospitality.',
    image: '/images/mandarmoni.jpg',
    icon: Hotel,
  },
  {
    title: 'Cultural Tours',
    description: 'Heritage routes, landmark access, and immersive stories told through place and craft.',
    image: '/images/temple2.jpg',
    icon: Landmark,
    className: 'is-wide',
  },
  {
    title: 'Wildlife',
    description: 'Soft expedition luxury with protected landscapes, local guides, and slow observation.',
    image: '/images/nature2.jpg',
    icon: Trees,
  },
];

const TRUST_FEATURES: Array<{ title: string; description: string; icon: LucideIcon }> = [
  {
    title: 'Curated Experiences',
    description: 'Every itinerary is edited for rhythm, quality, and a consistent premium standard.',
    icon: Sparkles,
  },
  {
    title: 'Best Value Planning',
    description: 'Transparent pricing and high-value stays chosen for quality, not noise.',
    icon: ShieldCheck,
  },
  {
    title: '24/7 Travel Support',
    description: 'Real assistance before departure, in transit, and during every stay.',
    icon: Headphones,
  },
  {
    title: 'Personalized Trips',
    description: 'Flexible route design shaped around pace, purpose, and traveler preferences.',
    icon: PlaneTakeoff,
  },
];

const PACKAGES = [
  {
    title: 'Himalayan Quiet Escape',
    image: '/images/sikkim1.jpg',
    duration: '5 Days / 4 Nights',
    price: 'From INR 68,000',
    rating: '4.9',
  },
  {
    title: 'Coastal Leisure Week',
    image: '/images/mandarmoni2.jpg',
    duration: '6 Days / 5 Nights',
    price: 'From INR 74,000',
    rating: '4.8',
  },
  {
    title: 'Temple & Heritage Route',
    image: '/images/temple1.jpg',
    duration: '4 Days / 3 Nights',
    price: 'From INR 49,000',
    rating: '4.7',
  },
  {
    title: 'Kerala Wellness Passage',
    image: '/images/kerala1.jpg',
    duration: '7 Days / 6 Nights',
    price: 'From INR 92,000',
    rating: '5.0',
  },
];

const TESTIMONIALS = [
  {
    name: 'Sarah Mitchell',
    role: 'Adventure Traveler',
    text: 'The pacing felt intentional from the first transfer to the final checkout. It was luxury travel without unnecessary friction.',
    rating: 5,
  },
  {
    name: 'Raj Patel',
    role: 'Private Group Traveler',
    text: 'Every hotel, route, and reservation felt considered. The result was calm, polished, and far more personal than a standard package.',
    rating: 5,
  },
  {
    name: 'Emma Thompson',
    role: 'Solo Explorer',
    text: 'I wanted independence without logistics fatigue. They delivered a beautifully structured itinerary that still felt effortless.',
    rating: 5,
  },
];

const GALLERY_IMAGES = [
  {
    image: '/images/kolkata1.jpg',
    label: 'City evenings',
    title: 'Rose-hour architecture',
    description: 'Reflections, symmetry, and warm city light captured with a calm editorial frame.',
  },
  {
    image: '/images/nature1.jpg',
    label: 'Forest air',
    title: 'Quiet canopy passage',
    description: 'Dense greens and bridge lines that make movement feel immersive rather than rushed.',
  },
  {
    image: '/images/rajsthan1.jpg',
    label: 'Desert light',
    title: 'Carved sandstone rhythm',
    description: 'Repeating geometry, soft neutrals, and shadow play that give the frame depth.',
  },
  {
    image: '/images/sikkim2.jpg',
    label: 'Ridgeline mornings',
    title: 'Elevation with breathing room',
    description: 'Layered hills and winding roads styled to feel expansive, clean, and premium.',
  },
  {
    image: '/images/mandarmoni.jpg',
    label: 'Sea horizon',
    title: 'Low-tide stillness',
    description: 'Open shoreline scenes with restrained color and cinematic negative space.',
  },
  {
    image: '/images/temple2.jpg',
    label: 'Timeless detail',
    title: 'Sculptural heritage texture',
    description: 'Stone, craft, and sacred forms arranged into tactile close-range compositions.',
  },
];

const RevealBlock: React.FC<RevealBlockProps> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.18, rootMargin: '0px 0px -10% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`h4-reveal${visible ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--h4-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
};

/* â”€â”€â”€ Slide Nav â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const SlideNav: React.FC<{ visible: boolean; theme: 'dark' | 'light' }> = ({ visible, theme }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    if (visible || !menuOpen) return;

    const timeout = window.setTimeout(() => {
      setMenuOpen(false);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [visible, menuOpen]);

  return (
    <nav
      className={`h4-slide-nav h4-showcase-nav h4-showcase-nav-${theme}${visible ? ' is-visible' : ''}`}
    >
      <img
        src={theme === 'light' ? '/logo/logo.png' : '/logo/logo-white.png'}
        alt="The Better Pass"
        className="h4-slide-nav-logo"
      />
      <div className="h4-slide-nav-links">
        <a href="#h4-hero" className="h4-slide-nav-link" onClick={closeMenu}>Home</a>
        <a href="#h4-about" className="h4-slide-nav-link" onClick={closeMenu}>About</a>
        <a href="#h4-contact" className="h4-slide-nav-link" onClick={closeMenu}>Contact</a>
      </div>
      <Link to="/auth" className="h4-slide-nav-login" onClick={closeMenu}>LOGIN</Link>
      <button
        type="button"
        className={`h4-slide-nav-toggle${menuOpen ? ' is-open' : ''}`}
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((prev) => !prev)}
      >
        <span />
        <span />
        <span />
      </button>
      <div className={`h4-slide-nav-mobile${menuOpen ? ' is-open' : ''}`}>
        <a href="#h4-hero" className="h4-slide-nav-mobile-link" onClick={closeMenu}>Home</a>
        <a href="#h4-about" className="h4-slide-nav-mobile-link" onClick={closeMenu}>About</a>
        <a href="#h4-contact" className="h4-slide-nav-mobile-link" onClick={closeMenu}>Contact</a>
        <Link to="/auth" className="h4-slide-nav-mobile-login" onClick={closeMenu}>LOGIN</Link>
      </div>
    </nav>
  );
};

/* â”€â”€â”€ Slide Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const SlideCard: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div className="h4-slide-card">
      <svg
        className="h4-slide-card-shape"
        viewBox="0 0 430 250"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          className="h4-slide-card-shape-fill"
          d="M30 1H396C414 1 429 16 429 34V122C429 143 412 160 391 160H297C281 160 268 173 268 189V218C268 234 255 247 239 247H30C13 247 1 235 1 218V30C1 13 13 1 30 1Z"
        />
      </svg>
      <div className="h4-slide-card-copy">
        <span className="h4-slide-card-kicker">Curated stay</span>
        <h3 className="h4-slide-card-title">{title}</h3>
        <p className="h4-slide-card-text">{text}</p>
      </div>
      <div className="h4-slide-card-actions">
        <button
          className="h4-slide-card-close"
          onClick={() => setVisible(false)}
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <button className="h4-slide-card-explore">Explore</button>
      </div>
    </div>
  );
};

/* â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export const Home4: React.FC = () => {
  const heroRef       = useRef<HTMLElement>(null);
  const showcaseRef   = useRef<HTMLElement>(null);
  const sphereRef     = useRef<HTMLDivElement>(null);
  const heroCopyRef   = useRef<HTMLDivElement>(null);
  const heroTitleRef  = useRef<HTMLDivElement>(null);
  const [navVisible, setNavVisible] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [showcaseVisible, setShowcaseVisible] = useState(false);

  useEffect(() => {
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const lerp = (start: number, end: number, progress: number) => start + (end - start) * progress;
    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);
    const easeInOutCubic = (value: number) => (
      value < 0.5
        ? 4 * value * value * value
        : 1 - Math.pow(-2 * value + 2, 3) / 2
    );

    let frame = 0;

    const updateScene = () => {
      frame = 0;
      const vh = window.innerHeight;
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        // Preserve smooth globe transition even when hero height is exactly one viewport.
        const heroScrollable = Math.max(vh * 0.38, heroRef.current.offsetHeight - vh);
        const heroProgress = clamp(-rect.top / heroScrollable, 0, 1);
        const orbRevealProgress = easeOutCubic(clamp(heroProgress / 0.72, 0, 1));
        const orbExitProgress = easeInOutCubic(clamp((heroProgress - 0.72) / 0.28, 0, 1));

        if (sphereRef.current) {
          const risePx = lerp(0, -vh * 0.48, orbRevealProgress) + lerp(0, -vh * 0.16, orbExitProgress);
          const scale = lerp(1.01, 0.74, orbRevealProgress) * lerp(1, 0.78, orbExitProgress);
          const rotate = lerp(-2, 0.8, orbRevealProgress);
          const opacity = heroProgress <= 0.76 ? 1 : 1 - orbExitProgress;
          const blur = lerp(0, 8, orbExitProgress);
          const brightness = lerp(1, 1.03, orbRevealProgress);
          const saturation = lerp(1, 1.08, orbRevealProgress);

          sphereRef.current.style.transform =
            `translate3d(-50%, ${risePx}px, 0) scale(${scale}) rotate(${rotate}deg)`;
          sphereRef.current.style.opacity = `${opacity}`;
          sphereRef.current.style.filter =
            `blur(${blur}px) brightness(${brightness}) saturate(${saturation})`;
        }

        if (heroCopyRef.current) {
          const copyLift = lerp(0, -vh * 0.14, heroProgress);
          const copyScale = lerp(1, 0.97, heroProgress);
          const copyOpacity = clamp(1 - heroProgress * 1.2, 0, 1);

          heroCopyRef.current.style.opacity = `${copyOpacity}`;
          heroCopyRef.current.style.transform =
            `translate3d(0, ${copyLift}px, 0) scale(${copyScale})`;
        }

        if (heroTitleRef.current) {
          const titleLift = lerp(0, -vh * 0.24, orbRevealProgress) + lerp(0, -vh * 0.08, orbExitProgress);
          const titleScale = lerp(1, 0.94, heroProgress);
          const titleOpacity = clamp(1 - heroProgress * 0.92, 0, 1);

          heroTitleRef.current.style.opacity = `${titleOpacity}`;
          heroTitleRef.current.style.transform =
            `translate3d(0, ${titleLift}px, 0) scale(${titleScale})`;
        }
      }

    };

    const queueUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScene);
    };

    window.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate);
    queueUpdate();

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      window.removeEventListener('scroll', queueUpdate);
      window.removeEventListener('resize', queueUpdate);
    };
  }, []);

  useEffect(() => {
    const node = heroRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setNavVisible(!(entry.isIntersecting && entry.intersectionRatio > 0.01));
      },
      { threshold: [0, 0.01, 0.2, 0.6, 1] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % SLIDES.length);
    }, 3500);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const node = showcaseRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowcaseVisible(entry.isIntersecting && entry.intersectionRatio > 0.2);
      },
      { threshold: [0, 0.2, 0.45, 0.7] }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.location.hash !== '#h4-showcase') return;
    const scrollToShowcase = () => {
      const top = heroRef.current?.offsetHeight ?? window.innerHeight;
      window.scrollTo({ top, behavior: 'auto' });
    };
    window.requestAnimationFrame(scrollToShowcase);
    const timeout = window.setTimeout(scrollToShowcase, 250);
    return () => window.clearTimeout(timeout);
  }, []);

  const activeSlide = SLIDES[activeSlideIndex];
  const navTheme = showcaseVisible ? 'dark' : 'light';

  return (
    <div className="h4-page">
      {/* â”€â”€ Hero â”€â”€ */}
      <section id="h4-hero" className="h4-hero" ref={heroRef}>
        <div className="h4-hero-stage">
          <div className="h4-hero-ambient" />

          <div className="h4-hero-copy" ref={heroCopyRef}>
            <p className="h4-hero-tagline">Luxury journeys shaped by place and pace</p>
          </div>

          <div className="h4-hero-title-shell" ref={heroTitleRef}>
            <h1 className="h4-hero-title" aria-label="The Better Pass">
              <span className="h4-hero-title-line">THE BETTER</span>
              <span className="h4-hero-title-line">PASS</span>
            </h1>
          </div>

          <div className="h4-hero-sphere" ref={sphereRef} aria-hidden="true">
            <img src="/images/home4/orb.png" alt="" className="h4-hero-sphere-image" />
            <div className="h4-hero-sphere-gloss" />
          </div>

          <span className="h4-hero-scroll">S c r o l l</span>
        </div>
      </section>
      <SlideNav visible={navVisible} theme={navTheme} />
      {/* â”€â”€ Showcase Section (auto-changing background) â”€â”€ */}
      <section id="h4-showcase" ref={showcaseRef} className="h4-showcase">
        <div className="h4-showcase-bg-layer-wrap" aria-hidden="true">
          {SLIDES.map((slide, index) => (
            <div
              key={slide.image}
              className={`h4-showcase-bg-layer${index === activeSlideIndex ? ' is-active' : ''}`}
              style={{ backgroundImage: `url(${slide.image})` }}
            />
          ))}
        </div>
        <div className={`h4-slide h4-showcase-slide${showcaseVisible ? ' is-visible' : ''}`}>
          <p key={`desc-${activeSlide.name}`} className="h4-slide-desc">{activeSlide.description}</p>
          <SlideCard key={activeSlide.name} title={activeSlide.cardTitle} text={activeSlide.cardText} />
          <h2 key={`title-${activeSlide.name}`} className="h4-slide-name">{activeSlide.name}</h2>
          <div key={`stats-${activeSlide.name}`} className="h4-slide-stats">
            {STATS.map((s) => (
              <div key={s.label} className="h4-slide-stat">
                <span className="h4-slide-stat-value">{s.value}</span>
                <span className="h4-slide-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="h4-about" className="h4-story-section h4-featured-section">
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-editorial-head-split h4-reveal-copy">
            <div className="h4-reveal-copy">
              <span className="h4-section-label">Featured Destinations</span>
              <h2 className="h4-section-title">Travel stories shaped through place, design, and pace.</h2>
            </div>
            <p className="h4-editorial-copy">
              Explore a refined edit of coastlines, mountain retreats, heritage routes, and slow escapes selected for visual beauty and seamless experience.
            </p>
          </RevealBlock>
          <div className="h4-featured-grid">
            {FEATURED_DESTINATIONS.map((item, index) => (
              <RevealBlock key={item.title} delay={index * 80}>
                <article className="h4-destination-card">
                  <div className="h4-destination-media" style={{ backgroundImage: `url(${item.image})` }} />
                  <div className="h4-destination-body h4-reveal-copy">
                    <h3 className="h4-destination-title">{item.title}</h3>
                    <span className="h4-destination-subtitle">{item.location}</span>
                    <p className="h4-destination-text">{item.description}</p>
                  </div>
                </article>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <section className="h4-story-section h4-experience-section">
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-reveal-copy">
            <span className="h4-section-label">Experience Categories</span>
            <h2 className="h4-section-title">A modern travel collection with distinct atmospheres.</h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow">
              From calm beach stays to high-altitude journeys, each category is built as a clean, premium experience with its own visual and emotional rhythm.
            </p>
          </RevealBlock>
          <div className="h4-experience-grid">
            {EXPERIENCE_CATEGORIES.map((item, index) => (
              <RevealBlock key={item.title} delay={index * 70}>
                <article className={`h4-experience-tile${item.className ? ` ${item.className}` : ''}`}>
                  <div className="h4-experience-image" style={{ backgroundImage: `url(${item.image})` }} />
                  <div className="h4-experience-content h4-reveal-copy">
                    <div className="h4-experience-icon"><item.icon size={18} /></div>
                    <h3 className="h4-experience-title">{item.title}</h3>
                    <p className="h4-experience-text">{item.description}</p>
                  </div>
                </article>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <section className="h4-story-section h4-why-section">
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-editorial-head-center h4-reveal-copy">
            <span className="h4-section-label">Why Travel With Us</span>
            <h2 className="h4-section-title">Luxury travel built with clarity, care, and quiet precision.</h2>
          </RevealBlock>
          <div className="h4-trust-grid">
            {TRUST_FEATURES.map((item, index) => (
              <RevealBlock key={item.title} delay={index * 80}>
                <article className="h4-trust-card h4-reveal-copy">
                  <div className="h4-trust-icon"><item.icon size={20} /></div>
                  <h3 className="h4-trust-title">{item.title}</h3>
                  <p className="h4-trust-text">{item.description}</p>
                </article>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <section className="h4-story-section h4-package-section">
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-editorial-head-split h4-reveal-copy">
            <div className="h4-reveal-copy">
              <span className="h4-section-label">Popular Packages</span>
              <h2 className="h4-section-title">Ready-to-book journeys with a polished luxury baseline.</h2>
            </div>
            <Link to="/auth" className="h4-inline-action">
              View all journeys <ArrowRight size={16} />
            </Link>
          </RevealBlock>
          <div className="h4-package-rail">
            {PACKAGES.map((item, index) => (
              <RevealBlock key={item.title} delay={index * 70}>
                <article className="h4-package-card">
                  <div className="h4-package-media" style={{ backgroundImage: `url(${item.image})` }} />
                  <div className="h4-package-body h4-reveal-copy">
                    <div className="h4-package-meta">
                      <span>{item.duration}</span>
                      <span className="h4-package-rating"><Star size={14} /> {item.rating}</span>
                    </div>
                    <h3 className="h4-package-title">{item.title}</h3>
                    <div className="h4-package-footer">
                      <span className="h4-package-price">{item.price}</span>
                      <button className="h4-package-cta">Reserve</button>
                    </div>
                  </div>
                </article>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <section id="h4-testimonials" className="h4-story-section h4-voices-section">
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-editorial-head-center h4-reveal-copy">
            <span className="h4-section-label">Testimonials</span>
            <h2 className="h4-section-title">What refined travel feels like to the people taking it.</h2>
          </RevealBlock>
          <div className="h4-voices-grid">
            {TESTIMONIALS.map((t, index) => (
              <RevealBlock key={t.name} delay={index * 90}>
                <article className="h4-voice-card h4-reveal-copy">
                  <div className="h4-voice-stars">{'\u2605'.repeat(t.rating)}</div>
                  <p className="h4-voice-text">"{t.text}"</p>
                  <div className="h4-voice-author">
                    <div className="h4-voice-avatar">{t.name[0]}</div>
                    <div>
                      <strong className="h4-voice-name">{t.name}</strong>
                      <span className="h4-voice-role">{t.role}</span>
                    </div>
                  </div>
                </article>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <section className="h4-story-section h4-gallery-section">
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-editorial-head-split h4-reveal-copy">
            <div className="h4-reveal-copy">
              <span className="h4-section-label">Travel Gallery</span>
              <h2 className="h4-section-title">Campaign-style photography with room to breathe.</h2>
            </div>
            <p className="h4-editorial-copy">
              A visual library of destinations, textures, and atmosphere designed to feel calm, premium, and quietly cinematic.
            </p>
          </RevealBlock>
          <div className="h4-gallery-grid">
            {GALLERY_IMAGES.map((item, index) => (
              <RevealBlock key={item.label} delay={index * 60}>
                <figure className="h4-gallery-card">
                  <div className="h4-gallery-media" style={{ backgroundImage: `url(${item.image})` }}>
                    <span className="h4-gallery-eyebrow">{item.label}</span>
                  </div>
                  <figcaption className="h4-gallery-body h4-reveal-copy">
                    <h3 className="h4-gallery-title">{item.title}</h3>
                    <p className="h4-gallery-caption">{item.description}</p>
                  </figcaption>
                </figure>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <section className="h4-story-section h4-app-section">
        <div className="h4-container">
          <RevealBlock className="h4-app-shell">
            <div className="h4-app-copy h4-reveal-copy">
              <span className="h4-section-label">Mobile App</span>
              <h2 className="h4-section-title">Plan your next journey effortlessly.</h2>
              <p className="h4-editorial-copy h4-editorial-copy-narrow">
                A calm travel companion for itinerary reviews, concierge updates, location context, and on-the-go booking access.
              </p>
              <div className="h4-app-actions">
                <Link to="/auth" className="h4-app-primary">Get Started</Link>
                <button className="h4-app-secondary">See Interface</button>
              </div>
              <div className="h4-app-points">
                <div><MapPinned size={16} /> Live itinerary map</div>
                <div><Smartphone size={16} /> Mobile-first booking flow</div>
                <div><Mail size={16} /> Concierge travel updates</div>
              </div>
            </div>
            <div className="h4-app-device-wrap" aria-hidden="true">
              <div className="h4-app-glow" />
              <div className="h4-phone-mockup">
                <div className="h4-phone-notch" />
                <div className="h4-phone-screen">
                  <div className="h4-phone-map-card">
                    <span className="h4-phone-pill">Next Stop</span>
                    <strong>Kerala Wellness Passage</strong>
                    <span>Check-in 4:30 PM</span>
                  </div>
                  <div className="h4-phone-route">
                    <div className="h4-phone-route-item">
                      <span>Day 01</span>
                      <strong>Arrival + Lagoon Suite</strong>
                    </div>
                    <div className="h4-phone-route-item">
                      <span>Day 02</span>
                      <strong>Private Houseboat Cruise</strong>
                    </div>
                    <div className="h4-phone-route-item">
                      <span>Day 03</span>
                      <strong>Ayurveda & Sunset Dinner</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      <section id="h4-contact" className="h4-story-section h4-newsletter-section">
        <div className="h4-container">
          <RevealBlock className="h4-newsletter-shell h4-reveal-copy">
            <span className="h4-section-label">Newsletter</span>
            <h2 className="h4-section-title">Receive destination edits, launch drops, and seasonal journeys.</h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow">
              Join a curated mailing list built for travelers who prefer fewer emails and better ideas.
            </p>
            <form className="h4-newsletter-form" onSubmit={(e) => e.preventDefault()}>
              <input className="h4-newsletter-input" type="email" placeholder="Email address" />
              <button type="submit" className="h4-newsletter-button">Subscribe</button>
            </form>
          </RevealBlock>
        </div>
      </section>

      <footer className="h4-lux-footer">
        <div className="h4-container">
          <div className="h4-lux-footer-top">
            <div className="h4-lux-footer-brand">
              <img src="/logo/logo.png" alt="The Better Pass" className="h4-lux-footer-logo" />
              <p className="h4-lux-footer-text">
                Modern luxury travel with editorial clarity, refined stays, and calm itinerary design.
              </p>
            </div>
            <div className="h4-lux-footer-col">
              <h4>Explore</h4>
              <a href="#h4-hero">Home</a>
              <a href="#h4-about">Destinations</a>
              <a href="#h4-testimonials">Testimonials</a>
              <a href="#h4-contact">Newsletter</a>
            </div>
            <div className="h4-lux-footer-col">
              <h4>Experiences</h4>
              <span>Beach Escapes</span>
              <span>Mountain Stays</span>
              <span>Cultural Routes</span>
              <span>Luxury Resorts</span>
            </div>
            <div className="h4-lux-footer-col">
              <h4>Contact</h4>
              <a href="mailto:hello@thebetterpass.com">hello@thebetterpass.com</a>
              <a href="tel:+911800000000">+91 1800 000 000</a>
              <Link to="/auth">Member Login</Link>
            </div>
          </div>
          <div className="h4-lux-footer-bottom">
            <span>© 2026 The Better Pass. All rights reserved.</span>
            <div className="h4-lux-footer-socials">
              <a href="#" aria-label="Instagram"><Instagram size={16} /></a>
              <a href="#" aria-label="Twitter"><Twitter size={16} /></a>
              <a href="#" aria-label="LinkedIn"><Linkedin size={16} /></a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
