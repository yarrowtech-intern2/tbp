import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  ArrowUpRight,
  Hotel,
  Instagram,
  Landmark,
  Linkedin,
  Mail,
  MapPinned,
  Mountain,
  Smartphone,
  Trees,
  Twitter,
  type LucideIcon,
  Waves,
} from 'lucide-react';
import { DEFAULT_FOOTER_CONTENT, getPublicAppContent, type FooterLink } from '../lib/appContent';
import GallerySection from '../components/GallerySection';
import './home4.css';

type RevealBlockProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
};

type OrbitGlyphProps = {
  className?: string;
};

type VisualShowcaseItem = {
  title: string;
  label: string;
  description: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  poster?: string;
  mediaTag?: string;
  className?: string;
  aspectRatio?: string;
};

const LottiePlayer = lazy(() => import('lottie-react'));

let orbitAnimationDataCache: object | null = null;
let orbitAnimationPromise: Promise<object | null> | null = null;

const loadOrbitAnimationData = async (): Promise<object | null> => {
  if (orbitAnimationDataCache) return orbitAnimationDataCache;

  if (!orbitAnimationPromise) {
    orbitAnimationPromise = fetch('/animation/rotate-orbit.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load orbit animation');
        return res.json() as Promise<object>;
      })
      .then((data) => {
        orbitAnimationDataCache = data;
        return data;
      })
      .catch(() => null)
      .finally(() => {
        orbitAnimationPromise = null;
      });
  }

  return orbitAnimationPromise;
};

const canRunDecorativeMotion = () => {
  if (typeof window === 'undefined') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 768px), (pointer: coarse)').matches;
};

const isInternalHref = (href?: string | null) => Boolean(href && href.startsWith('/'));

const FooterTextOrLink: React.FC<{ item: FooterLink }> = ({ item }) => {
  if (!item.href) return <span>{item.label}</span>;
  if (isInternalHref(item.href)) return <Link to={item.href}>{item.label}</Link>;
  return <a href={item.href}>{item.label}</a>;
};

const STATS = [
  { value: 20, suffix: '+', label: 'Restaurants' },
  { value: 8, suffix: '+', label: 'Services' },
  { value: 12, suffix: '+', label: 'Brands' },
  { value: 22, suffix: '+', label: 'Countries' },
];

const HERO_POSTER_IMAGE = '/images/home4/beach-1600.jpg';
const HERO_VIDEO_URL = 'https://res.cloudinary.com/dc3qprub3/video/upload/f_auto,q_auto,w_1920/tbp-hero2_gur026.mp4';
const HERO_CARD_COPY =
  'Experience unforgettable journeys, breathtaking destinations, and adventures crafted for explorers who seek more than just travel. From snowy mountain escapes to tropical beaches and hidden cultural gems, we help you explore the world with curated experiences, seamless planning, and memories that last forever.';

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


const VISUAL_SHOWCASE: VisualShowcaseItem[] = [
  {
    title: 'Immersive travel visuals.',
    label: 'Cinematic Frame',
    description: 'Expansive horizon shots crafted to set mood, pace, and destination character in one glance.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=1800&q=80',
    aspectRatio: '16 / 10',
  },
  {
    title: 'Coastal Light Stories',
    label: 'Beach Edit',
    description: 'Low-angle shoreline moments and sunset transitions from curated coast journeys.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1300&q=80',
    aspectRatio: '4 / 5',
  },
  {
    title: 'Aerial Terrain Preview',
    label: 'Drone Footage',
    description: 'High-altitude route previews for terrain, access points, and scenic path planning.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80',
    aspectRatio: '3 / 4',
    mediaTag: 'Drone footage',
  },
  {
    title: 'Desert Motion Reels',
    label: 'Video Reel',
    description: 'Dynamic movement captures across dunes, camp routes, and golden-hour transitions.',
    mediaType: 'video',
    mediaUrl: 'https://www.pexels.com/download/video/855564/',
    poster: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?auto=format&fit=crop&w=1400&q=80',
    aspectRatio: '9 / 16',
    mediaTag: 'Pexels video',
  },
  {
    title: 'Forest Atmosphere',
    label: 'Nature Sequence',
    description: 'Textured canopy scenes and quiet trail visuals tuned for immersive storytelling.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80',
    aspectRatio: '4 / 5',
  },
  {
    title: 'Heritage Perspective',
    label: 'Temple Capture',
    description: 'Architecture-focused visuals highlighting stone craft, scale, and cultural ambiance.',
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=1200&q=80',
    aspectRatio: '4 / 5',
  },
  {
    title: 'Night Transit Story',
    label: 'Motion Clip',
    description: 'Urban night movement captured as a seamless flow for momentum-led travel stories.',
    mediaType: 'video',
    mediaUrl: 'https://www.pexels.com/download/video/3129957/',
    poster: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80',
    aspectRatio: '3 / 4',
    mediaTag: 'Pexels video',
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
    image: '/images/home4/beach-1600.jpg',
    icon: Waves,
    className: 'is-large',
  },
  {
    title: 'Mountains',
    description: 'Elevated escapes with panoramic suites, alpine dining, and quiet high-altitude routes.',
    image: '/images/home4/mopunts-1920.jpg',
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

const WORLD_MAP_POINTS: Array<{
  id: string;
  region: string;
  city: string;
  country: string;
  markerX: number;
  markerY: number;
  cardX?: number;
  cardY?: number;
  preview?: {
    title: string;
    description: string;
    image: string;
    rating: string;
    travelers: string;
  };
}> = [
  {
    id: 'north-america',
    region: 'North America',
    city: 'Vancouver',
    country: 'Canada',
    markerX: 17.4,
    markerY: 32.8,
    cardX: 25.2,
    cardY: 24.4,
    preview: {
      title: 'Nature Escape',
      description: 'Coastline forests, alpine viewpoints, and private-lodge routes.',
      image: '/images/nature1.jpg',
      rating: '4.8',
      travelers: '2.1k',
    },
  },
  {
    id: 'south-america',
    region: 'South America',
    city: 'Patagonia',
    country: 'Chile',
    markerX: 31.3,
    markerY: 76.5,
    cardX: 38.3,
    cardY: 67.4,
    preview: {
      title: 'Mountain Road',
      description: 'Editorial drives, glacier valleys, and premium ridge lodges.',
      image: '/images/sikkim2.jpg',
      rating: '4.9',
      travelers: '1.7k',
    },
  },
  {
    id: 'europe',
    region: 'Europe',
    city: 'Paris',
    country: 'France',
    markerX: 49.8,
    markerY: 33.4,
    cardX: 42.2,
    cardY: 23.4,
    preview: {
      title: 'City Icons',
      description: 'Museum districts, heritage boulevards, and polished boutique stays.',
      image: '/images/home4/city.jpg',
      rating: '4.7',
      travelers: '2.3k',
    },
  },
  {
    id: 'middle-east',
    region: 'Middle East',
    city: 'Dubai',
    country: 'UAE',
    markerX: 57.9,
    markerY: 45.1,
    cardX: 49.5,
    cardY: 52.1,
    preview: {
      title: 'Desert Oasis',
      description: 'Golden horizons, private camps, and sunset culinary rituals.',
      image: '/images/rajsthan1.jpg',
      rating: '4.8',
      travelers: '2.8k',
    },
  },
  {
    id: 'india',
    region: 'India',
    city: 'Kerala',
    country: 'India',
    markerX: 66.6,
    markerY: 54.7,
    cardX: 68.6,
    cardY: 63.5,
    preview: {
      title: 'Tropical Beach',
      description: 'Palm-shaded waters, lagoon villas, and calm wellness itineraries.',
      image: '/images/kerala1.jpg',
      rating: '5.0',
      travelers: '4.4k',
    },
  },
  {
    id: 'southeast-asia',
    region: 'Southeast Asia',
    city: 'Bali',
    country: 'Indonesia',
    markerX: 72.5,
    markerY: 58.9,
    cardX: 79.1,
    cardY: 54.8,
    preview: {
      title: 'Luxury Resort',
      description: 'Cliffside suites, spa sanctuaries, and curated ocean dining.',
      image: '/images/mandarmoni2.jpg',
      rating: '4.9',
      travelers: '3.2k',
    },
  },
  {
    id: 'japan',
    region: 'Japan',
    city: 'Kyoto',
    country: 'Japan',
    markerX: 83.1,
    markerY: 41.4,
    cardX: 88.2,
    cardY: 31.6,
    preview: {
      title: 'Temple Routes',
      description: 'Lantern-lit lanes, heritage temples, and seasonal cultural journeys.',
      image: '/images/temple2.jpg',
      rating: '4.8',
      travelers: '2.0k',
    },
  },
  {
    id: 'australia',
    region: 'Australia',
    city: 'Sydney',
    country: 'Australia',
    markerX: 80.4,
    markerY: 76.2,
    cardX: 74.6,
    cardY: 66.4,
    preview: {
      title: 'Coastal Drive',
      description: 'Ocean roads, skyline bays, and private resort weekends by the sea.',
      image: '/images/mandarmoni.jpg',
      rating: '4.7',
      travelers: '1.6k',
    },
  },
  {
    id: 'africa',
    region: 'Africa',
    city: 'Marrakesh',
    country: 'Morocco',
    markerX: 53.9,
    markerY: 50.6,
    cardX: 45.1,
    cardY: 60.2,
    preview: {
      title: 'Desert Heritage',
      description: 'Courtyard riads, medina craft routes, and atlas-view stays.',
      image: '/images/rajsthan1.jpg',
      rating: '4.6',
      travelers: '1.4k',
    },
  },
];

const WORLD_MAP_CONNECTIONS: Array<[string, string]> = [
  ['north-america', 'south-america'],
  ['north-america', 'europe'],
  ['europe', 'middle-east'],
  ['middle-east', 'africa'],
  ['middle-east', 'india'],
  ['india', 'southeast-asia'],
  ['southeast-asia', 'japan'],
  ['southeast-asia', 'australia'],
  ['africa', 'south-america'],
];

const MAP_VIEWBOX_WIDTH = 1200;
const MAP_VIEWBOX_HEIGHT = 560;

const getMapRoutePath = (
  from: { markerX: number; markerY: number },
  to: { markerX: number; markerY: number }
) => {
  const startX = (from.markerX / 100) * MAP_VIEWBOX_WIDTH;
  const startY = (from.markerY / 100) * MAP_VIEWBOX_HEIGHT;
  const endX = (to.markerX / 100) * MAP_VIEWBOX_WIDTH;
  const endY = (to.markerY / 100) * MAP_VIEWBOX_HEIGHT;
  const midX = (startX + endX) / 2;
  const arcLift = Math.max(22, Math.min(72, Math.abs(endX - startX) * 0.12));
  const controlY = Math.min(startY, endY) - arcLift;

  return `M${startX.toFixed(1)} ${startY.toFixed(1)} Q${midX.toFixed(1)} ${controlY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`;
};

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
const OrbitGlyph: React.FC<OrbitGlyphProps> = ({ className = '' }) => {
  const [motionEnabled, setMotionEnabled] = useState(canRunDecorativeMotion);
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce), (max-width: 768px), (pointer: coarse)');
    const updateMotionPreference = () => setMotionEnabled(!media.matches);

    updateMotionPreference();
    media.addEventListener('change', updateMotionPreference);

    return () => media.removeEventListener('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    if (!motionEnabled) {
      const timeout = window.setTimeout(() => setAnimationData(null), 0);
      return () => window.clearTimeout(timeout);
    }

    let mounted = true;
    loadOrbitAnimationData().then((data) => {
      if (!mounted) return;
      setAnimationData(data);
    });

    return () => {
      mounted = false;
    };
  }, [motionEnabled]);

  return (
    <div className={`h4-featured-glyphs${className ? ` ${className}` : ''}`} aria-hidden="true">
      {animationData ? (
        <Suspense fallback={null}>
          <LottiePlayer
            animationData={animationData}
            loop
            autoplay
            className="h4-featured-glyph-lottie"
          />
        </Suspense>
      ) : null}
    </div>
  );
};

interface RollingTickerProps {
  value: number;
  delay?: number;
}

const RollingTicker: React.FC<RollingTickerProps> = ({ value, delay = 0 }) => {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimate(true);
    }, delay + 150);
    return () => clearTimeout(timer);
  }, [delay]);

  const digits = String(value).split('');

  return (
    <span className="rolling-ticker">
      {digits.map((digitChar, colIdx) => {
        const targetDigit = animate ? parseInt(digitChar, 10) : 0;
        return (
          <span key={colIdx} className="rolling-ticker-digit-container">
            <span
              className="rolling-ticker-digit-column"
              style={{
                transform: `translateY(-${targetDigit * 10}%)`,
              }}
            >
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <span key={n} className="rolling-ticker-digit-val">
                  {n}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};

/* ─── Main Component ────────────────────────────────────────────────── */
export const Home4: React.FC = () => {
  const heroRef       = useRef<HTMLElement>(null);
  const showcaseRef   = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [footerContent, setFooterContent] = useState(DEFAULT_FOOTER_CONTENT);

  useEffect(() => {
    let cancelled = false;

    void getPublicAppContent()
      .then((content) => {
        if (!cancelled) setFooterContent(content.footer);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  // Simple scrolled listener for floating/blur sticky navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const experienceRailA = EXPERIENCE_CATEGORIES;
  const experienceRailB = [...EXPERIENCE_CATEGORIES].reverse();

  // Smooth navigation helper
  const handleSectionNav = (sectionId: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    setMenuOpen(false);
    const node = document.getElementById(sectionId);
    if (!node) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    if (window.location.hash) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  };

  return (
    <div className="h4-page">
      {/* ─── Premium Integrated Beach Hero Redesign ─── */}
      <section 
        id="h4-hero" 
        className="h4-beach-hero" 
        ref={heroRef}
      >
        {/* Showcase Background Layer (dynamic cross-fade carousel) */}
        <div className="h4-beach-bg-wrap" ref={showcaseRef}>
          <video
            className="h4-beach-bg-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={HERO_POSTER_IMAGE}
          >
            <source
              src={HERO_VIDEO_URL}
              type="video/mp4"
            />
          </video>
        </div>

        {/* Translucent Capsule Navbar */}
        <nav className={`h4-custom-navbar ${isScrolled ? 'is-scrolled' : ''}`}>
          <div className="h4-custom-nav-container">
            {/* Logo */}
            <Link to="/" className="h4-custom-nav-logo">
              <img
                src={isScrolled ? '/logo/logo.png' : '/logo/logo-white.png'}
                alt="The Better PASS"
                className="h4-custom-nav-logo-image"
                loading="eager"
                decoding="async"
              />
            </Link>

            {/* Links Capsule */}
            <div className="h4-custom-nav-capsule">
              <a href="#h4-hero" className="h4-custom-nav-link" onClick={handleSectionNav('h4-hero')}>Home</a>
              <a href="#h4-about" className="h4-custom-nav-link" onClick={handleSectionNav('h4-about')}>About</a>
              <a href="#h4-choose-us" className="h4-custom-nav-link" onClick={handleSectionNav('h4-choose-us')}>Contact</a>
            </div>

            {/* Login Button */}
            <Link to="/auth" className="h4-custom-nav-login" aria-label="Login or sign up">
              <ArrowRight size={22} aria-hidden="true" />
            </Link>
            
            {/* Mobile Menu Toggle Button */}
            <button
              type="button"
              className={`h4-custom-nav-toggle ${menuOpen ? 'is-open' : ''}`}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(prev => !prev)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {/* Mobile Dropdown Panel */}
          <div className={`h4-custom-nav-mobile-panel ${menuOpen ? 'is-open' : ''}`}>
            <a href="#h4-hero" className="h4-custom-nav-mobile-link" onClick={handleSectionNav('h4-hero')}>Home</a>
            <a href="#h4-about" className="h4-custom-nav-mobile-link" onClick={handleSectionNav('h4-about')}>About</a>
            <a href="#h4-choose-us" className="h4-custom-nav-mobile-link" onClick={handleSectionNav('h4-choose-us')}>Contact</a>
            <Link to="/auth" className="h4-custom-nav-mobile-login" onClick={() => setMenuOpen(false)}>LOGIN</Link>
          </div>
        </nav>

        {/* Central Split Layout Content */}
        <div className="h4-beach-hero-content">
          <div className="h4-glass-card">
            <p className="h4-glass-card-text">{HERO_CARD_COPY}</p>
            <Link to="/auth" className="h4-glass-card-explore-btn" aria-label="Explore">
              <ArrowUpRight size={36} aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Bottom Title & Stats */}
        <div className="h4-beach-hero-bottom">
          <p className="h4-beach-hero-kicker">Discover the World Beyond the</p>
          <h1 className="h4-beach-hero-title">
            HORIZON
          </h1>
          
          <div className="h4-beach-hero-stats">
            {STATS.map((s, idx) => (
              <div key={s.label} className="h4-beach-hero-stat">
                <div className="h4-beach-hero-stat-value">
                  <RollingTicker key={idx} value={s.value} delay={idx * 120} />
                  <span className="h4-stat-suffix">{s.suffix}</span>
                </div>
                <span className="h4-beach-hero-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="h4-about" className="h4-story-section h4-featured-section">
        <div className="h4-container">
          <div className="h4-editorial-head h4-editorial-head-split h4-featured-head">
            <div className="h4-featured-intro">
              <OrbitGlyph />
              <span className="h4-section-label">Featured Destinations</span>
              <h2 className="h4-section-title h4-featured-gradient-title">Stories in Motion, Places in Color.</h2>
              <p className="h4-featured-subtitle">
                A bright collection of coasts, highlands, temple routes, and slow-luxury stays curated for calm and character.
              </p>
            </div>
            <p className="h4-editorial-copy h4-featured-support">
              Explore a refined edit of coastlines, mountain retreats, heritage routes, and slow escapes selected for visual beauty and seamless experience.
            </p>
          </div>
          <div className="h4-featured-rail-head">
            <div className="h4-featured-rail-copy">
              <h3 className="h4-featured-rail-title">Top Picks This Season</h3>
              <p className="h4-featured-rail-subtitle">
                Handpicked routes with a balance of nature, heritage, and luxury pacing.
              </p>
            </div>
          </div>
          <div className="h4-featured-grid">
            {FEATURED_DESTINATIONS.map((item, index) => (
              <RevealBlock key={item.title} delay={index * 80}>
                <article className="h4-destination-card">
                  <div className="h4-destination-media">
                    <img
                      src={item.image}
                      alt=""
                      className="h4-card-image"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
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

      <GallerySection />

      <section className="h4-story-section h4-story-section-tight h4-experience-section">
        <div className="h4-container">
          <div className="h4-editorial-head h4-editorial-head-center h4-accent-head h4-experience-head-outside">
            <OrbitGlyph className="h4-accent-glyphs" />
            <h2 className="h4-section-title h4-featured-gradient-title h4-accent-gradient-title">A modern travel collection with distinct atmospheres.</h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow h4-accent-subtitle">
              From calm beach stays to high-altitude journeys, each category is built as a clean, premium experience with its own visual and emotional rhythm.
            </p>
          </div>
          <div className="h4-experience-marquee" aria-label="Experience categories">
            <div className="h4-experience-rail h4-experience-rail-forward">
              <div className="h4-experience-track">
                {[...experienceRailA, ...experienceRailA].map((item, index) => (
                  <article
                    key={`exp-a-${item.title}-${index}`}
                    className={`h4-experience-tile${item.className ? ` ${item.className}` : ''}`}
                    aria-hidden={index >= experienceRailA.length}
                  >
                    <div className="h4-experience-image">
                      <img
                        src={item.image}
                        alt=""
                        className="h4-card-image"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="h4-experience-content">
                      <div className="h4-experience-icon"><item.icon size={18} /></div>
                      <h3 className="h4-experience-title">{item.title}</h3>
                      <p className="h4-experience-text">{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="h4-experience-rail h4-experience-rail-reverse">
              <div className="h4-experience-track">
                {[...experienceRailB, ...experienceRailB].map((item, index) => (
                  <article
                    key={`exp-b-${item.title}-${index}`}
                    className={`h4-experience-tile${item.className ? ` ${item.className}` : ''}`}
                    aria-hidden={index >= experienceRailB.length}
                  >
                    <div className="h4-experience-image">
                      <img
                        src={item.image}
                        alt=""
                        className="h4-card-image"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                    <div className="h4-experience-content">
                      <div className="h4-experience-icon"><item.icon size={18} /></div>
                      <h3 className="h4-experience-title">{item.title}</h3>
                      <p className="h4-experience-text">{item.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="h4-choose-us" className="h4-story-section h4-story-section-tight h4-choose-section">
        <div className="h4-container">
          <div className="h4-editorial-head h4-editorial-head-center h4-accent-head h4-intent-head">
            <OrbitGlyph className="h4-accent-glyphs" />
            <h2 className="h4-section-title h4-featured-gradient-title h4-accent-gradient-title h4-intent-title">
              Why Choose Us
            </h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow h4-accent-subtitle h4-intent-subtitle">
              Built for travelers who want premium planning, clear pricing, and dependable execution from first call
              to final return.
            </p>
          </div>
          <div className="h4-intent-grid h4-intent-grid-legacy">
            <RevealBlock className="h4-intent-tile h4-intent-photo-a" delay={20}>
              <img
                src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80"
                alt="Team in strategy discussion"
                className="h4-card-image"
                loading="lazy"
                decoding="async"
              />
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-dedication h4-reveal-copy" delay={60}>
              <strong className="h4-intent-metric">100</strong>
              <h3 className="h4-intent-tile-title">Dedication</h3>
              <p className="h4-intent-tile-text">
                We are committed to excellence and continuous improvement in every project.
              </p>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-mission h4-reveal-copy" delay={100}>
              <strong className="h4-intent-metric">01</strong>
              <h3 className="h4-intent-tile-title">Mission</h3>
              <p className="h4-intent-tile-text">
                To deliver innovative solutions that enhance everyday life through user-centric design.
              </p>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-roi h4-reveal-copy" delay={140}>
              <strong className="h4-intent-metric">500</strong>
              <h3 className="h4-intent-tile-title">ROI</h3>
              <p className="h4-intent-tile-text">
                Achieve measurable returns with proven strategy and strong operational execution.
              </p>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-brand-a" delay={180}>
              <span aria-hidden="true">Be</span>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-brand-b" delay={210}>
              <span aria-hidden="true">8</span>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-team h4-reveal-copy" delay={240}>
              <strong className="h4-intent-metric">35</strong>
              <h3 className="h4-intent-tile-title">Team members</h3>
              <p className="h4-intent-tile-text">
                Our team is committed to delivering exceptional results with unwavering dedication.
              </p>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-branch h4-reveal-copy" delay={280}>
              <strong className="h4-intent-metric">7</strong>
              <h3 className="h4-intent-tile-title">Office Branch</h3>
            </RevealBlock>
            <RevealBlock className="h4-intent-tile h4-intent-photo-b" delay={320}>
              <img
                src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80"
                alt="Collaborative office workspace"
                className="h4-card-image"
                loading="lazy"
                decoding="async"
              />
            </RevealBlock>
          </div>
          <div className="h4-intent-grid h4-intent-grid-modern">
            <RevealBlock className="h4-intent-tile h4-intent-media-card h4-intent-card-concierge h4-reveal-copy" delay={30}>
              <img
                src="https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80"
                alt="Dedicated travel concierge team at work"
                className="h4-card-image"
                loading="lazy"
                decoding="async"
              />
              <div className="h4-intent-tile-body">
                <h3 className="h4-intent-tile-title">Dedicated concierge team</h3>
                <p className="h4-intent-tile-text">Real people planning every leg, stay, and transfer around your pace.</p>
              </div>
            </RevealBlock>

            <RevealBlock className="h4-intent-tile h4-intent-card-trust h4-reveal-copy" delay={70}>
              <strong className="h4-intent-metric">4.9</strong>
              <h3 className="h4-intent-tile-title">Verified traveler rating</h3>
              <p className="h4-intent-tile-text">
                Consistent delivery across route planning, stays, and on-ground support.
              </p>
            </RevealBlock>

            <RevealBlock className="h4-intent-tile h4-intent-card-pricing h4-reveal-copy" delay={110}>
              <strong className="h4-intent-metric">0</strong>
              <h3 className="h4-intent-tile-title">Hidden charges</h3>
              <p className="h4-intent-tile-text">Transparent pricing with clear inclusions before you confirm.</p>
            </RevealBlock>

            <RevealBlock className="h4-intent-tile h4-intent-media-card h4-intent-card-video h4-reveal-copy" delay={150}>
              <video
                src="https://www.pexels.com/download/video/3129957/"
                className="h4-card-image h4-intent-video"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
              />
              <div className="h4-intent-tile-body">
                <h3 className="h4-intent-tile-title">Cinematic itineraries</h3>
                <p className="h4-intent-tile-text">Journeys designed for smooth flow, not rushed checklists.</p>
              </div>
            </RevealBlock>

            <RevealBlock className="h4-intent-tile h4-intent-card-support h4-reveal-copy" delay={190}>
              <strong className="h4-intent-metric">24/7</strong>
              <h3 className="h4-intent-tile-title">On-trip support</h3>
              <p className="h4-intent-tile-text">Live updates, fast re-routing, and direct help while you travel.</p>
            </RevealBlock>

            <RevealBlock className="h4-intent-tile h4-intent-media-card h4-intent-card-destinations h4-reveal-copy" delay={230}>
              <img
                src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1500&q=80"
                alt="Scenic destination landscape"
                className="h4-card-image"
                loading="lazy"
                decoding="async"
              />
              <div className="h4-intent-tile-body">
                <strong className="h4-intent-metric">120+</strong>
                <h3 className="h4-intent-tile-title">Handpicked destinations</h3>
                <p className="h4-intent-tile-text">Only tested stays, trusted partners, and quality-first routes.</p>
              </div>
            </RevealBlock>
          </div>
        </div>
      </section>

      <section className="h4-story-section h4-story-section-tight h4-world-section">
        <div className="h4-world-atmosphere" aria-hidden="true">
          <span className="h4-world-particle h4-world-particle-a" />
          <span className="h4-world-particle h4-world-particle-b" />
          <span className="h4-world-particle h4-world-particle-c" />
          <span className="h4-world-particle h4-world-particle-d" />
        </div>
        <div className="h4-container">
          <RevealBlock className="h4-editorial-head h4-editorial-head-center h4-reveal-copy h4-world-head">
            <h2 className="h4-section-title h4-world-title h4-featured-gradient-title">The TBP Map</h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow h4-world-subtitle">
              Explore the World Without Limits
            </p>
          </RevealBlock>

          <RevealBlock className="h4-world-stage-wrap">
            <div className="h4-world-stage">
              <div className="h4-world-grid" aria-hidden="true" />
              <div className="h4-world-paper-grain" aria-hidden="true" />
              <div className="h4-world-map-art" aria-hidden="true">
                <img src="/images/home4/tbp-map.png" alt="" loading="lazy" decoding="async" />
              </div>

              <svg
                className="h4-world-routes"
                viewBox={`0 0 ${MAP_VIEWBOX_WIDTH} ${MAP_VIEWBOX_HEIGHT}`}
                role="img"
                aria-label="Interactive destination map"
              >
                {WORLD_MAP_CONNECTIONS.map(([fromId, toId], index) => {
                  const from = WORLD_MAP_POINTS.find((item) => item.id === fromId);
                  const to = WORLD_MAP_POINTS.find((item) => item.id === toId);
                  if (!from || !to) return null;

                  return (
                    <path
                      key={`${fromId}-${toId}`}
                      className="h4-world-route"
                      d={getMapRoutePath(from, to)}
                      style={{ '--h4-route-delay': `${index * 0.45}s` } as React.CSSProperties}
                    />
                  );
                })}
              </svg>

              <div className="h4-world-hotspots">
                {WORLD_MAP_POINTS.map((item) => (
                  <div
                    key={item.id}
                    className="h4-world-hotspot"
                    style={
                      {
                        '--h4-hotspot-x': `${item.markerX}%`,
                        '--h4-hotspot-y': `${item.markerY}%`,
                        '--h4-card-x': `${item.cardX ?? Math.min(90, item.markerX + 7)}%`,
                        '--h4-card-y': `${item.cardY ?? Math.max(12, item.markerY - 8)}%`,
                      } as React.CSSProperties
                    }
                  >
                    <button type="button" className="h4-world-pin" aria-label={`View ${item.region}: ${item.city}, ${item.country}`}>
                      <span className="h4-world-pin-core" />
                    </button>
                    {item.preview ? (
                      <article className="h4-world-preview">
                        <div className="h4-world-preview-media" style={{ backgroundImage: `url('${item.preview.image}')` }} />
                        <div className="h4-world-preview-body">
                          <strong className="h4-world-preview-place">
                            {item.preview.title} · {item.city}
                          </strong>
                          <p className="h4-world-preview-text">{item.preview.description}</p>
                          <div className="h4-world-preview-meta">
                            <span>? {item.preview.rating}</span>
                            <span>{item.preview.travelers} travelers</span>
                          </div>
                        </div>
                      </article>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </RevealBlock>
        </div>
      </section>

      <section className="h4-story-section h4-story-section-tight h4-app-section">
        <div className="h4-container">
          <RevealBlock className="h4-app-shell">
            <div className="h4-app-copy h4-reveal-copy">
              <OrbitGlyph className="h4-accent-glyphs" />
              <h2 className="h4-section-title h4-featured-gradient-title h4-accent-gradient-title">Plan your next journey effortlessly.</h2>
              <p className="h4-editorial-copy h4-editorial-copy-narrow h4-accent-subtitle">
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
              <img
                src="/UI/image.png"
                alt="TBP app interface"
                className="h4-app-ui-image"
                loading="lazy"
                decoding="async"
              />
            </div>
          </RevealBlock>
        </div>
      </section>

      <section className="h4-story-section h4-story-section-tight h4-gallery-section">
        <div className="h4-container">
          <div className="h4-editorial-head h4-editorial-head-center h4-gallery-head">
            <div className="h4-featured-intro h4-gallery-intro">
              <OrbitGlyph />
              <span className="h4-section-label">Gallery / Visual Showcase</span>
              <h2 className="h4-section-title h4-featured-gradient-title">Immersive travel visuals.</h2>
              <p className="h4-editorial-copy h4-gallery-copy">
                Masonry compositions, cinematic frames, and motion-oriented captures designed to preview journeys before they begin.
              </p>
            </div>
          </div>
          <div className="h4-gallery-grid">
            {VISUAL_SHOWCASE.map((item, index) => (
              <RevealBlock
                key={item.title}
                delay={index * 70}
                className={item.className ?? ''}
              >
                <article className="h4-gallery-card h4-gallery-card-media-only">
                  <div
                    className="h4-gallery-media"
                    style={
                      item.aspectRatio
                        ? ({ aspectRatio: item.aspectRatio } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {item.mediaType === 'video' ? (
                      <video
                        src={item.mediaUrl}
                        poster={item.poster}
                        className="h4-card-image h4-gallery-video"
                        autoPlay
                        loop
                        muted
                        playsInline
                        controls
                        preload="metadata"
                      />
                    ) : (
                      <img
                        src={item.mediaUrl}
                        alt=""
                        className="h4-card-image"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                </article>
              </RevealBlock>
            ))}
          </div>
        </div>
      </section>

      <footer id="h4-contact" className="h4-lux-footer">
        <div className="h4-container">
          <div className="h4-lux-footer-top">
            <div className="h4-lux-footer-brand">
              <img src="/logo/logo.png" alt="The Better Pass" className="h4-lux-footer-logo" loading="lazy" decoding="async" />
              <p className="h4-lux-footer-text">
                {footerContent.description}
              </p>
            </div>
            {footerContent.columns.map((column) => (
              <div className="h4-lux-footer-col" key={column.title}>
                <h4>{column.title}</h4>
                {column.links.map((item) => (
                  <FooterTextOrLink item={item} key={`${column.title}-${item.label}-${item.href || ''}`} />
                ))}
              </div>
            ))}
          </div>
          <div className="h4-lux-footer-bottom">
            <span>{footerContent.copyright}</span>
            <div className="h4-lux-footer-socials">
              {footerContent.socials.map((item) => {
                const normalizedLabel = item.label.trim().toLowerCase();
                const Icon = normalizedLabel.includes('instagram')
                  ? Instagram
                  : normalizedLabel.includes('twitter') || normalizedLabel === 'x'
                    ? Twitter
                    : normalizedLabel.includes('linkedin')
                      ? Linkedin
                      : ArrowUpRight;
                return (
                  <a href={item.href || '#'} aria-label={item.label} key={`${item.label}-${item.href || ''}`}>
                    <Icon size={16} />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
