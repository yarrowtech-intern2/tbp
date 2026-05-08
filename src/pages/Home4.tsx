import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Lottie from 'lottie-react';
import {
  Compass,
  Headphones,
  Hotel,
  Instagram,
  Landmark,
  Linkedin,
  Mail,
  MapPinned,
  Mountain,
  ShieldCheck,
  Smartphone,
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

type OrbitGlyphProps = {
  className?: string;
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

const VISUAL_SHOWCASE = [
  {
    title: 'Immersive travel visuals.',
    label: 'Cinematic Frame',
    description: 'Expansive horizon shots crafted to set mood, pace, and destination character in one glance.',
    image: '/images/home4/city.jpg',
    className: 'h4-gallery-cinematic',
  },
  {
    title: 'Coastal Light Stories',
    label: 'Beach Edit',
    description: 'Low-angle shoreline moments and sunset transitions from curated coast journeys.',
    image: '/images/home4/beach.jpg',
  },
  {
    title: 'Aerial Terrain Preview',
    label: 'Drone Footage',
    description: 'High-altitude route previews for terrain, access points, and scenic path planning.',
    image: '/images/home4/mopunts.jpg',
    mediaTag: 'Drone footage',
  },
  {
    title: 'Desert Motion Reels',
    label: 'Video Reel',
    description: 'Dynamic movement captures across dunes, camp routes, and golden-hour transitions.',
    image: '/images/home4/desert.jpg',
    mediaTag: 'Video reel',
  },
  {
    title: 'Forest Atmosphere',
    label: 'Nature Sequence',
    description: 'Textured canopy scenes and quiet trail visuals tuned for immersive storytelling.',
    image: '/images/home4/forrest.jpg',
  },
  {
    title: 'Heritage Perspective',
    label: 'Temple Capture',
    description: 'Architecture-focused visuals highlighting stone craft, scale, and cultural ambiance.',
    image: '/images/home4/temple.jpg',
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

const WHY_CHOOSE_US: Array<{
  title: string;
  description: string;
  icon: LucideIcon;
  className?: string;
}> = [
  {
    title: 'Best Pricing',
    description: 'Transparent rates and optimized package design so you get premium experiences without hidden costs.',
    icon: Landmark,
    className: 'is-hero',
  },
  {
    title: 'Verified Guides',
    description: 'Trusted local experts selected for professionalism, safety standards, and destination depth.',
    icon: ShieldCheck,
  },
  {
    title: '24/7 Support',
    description: 'Real-time travel assistance before departure, in transit, and at every stay touchpoint.',
    icon: Headphones,
  },
  {
    title: 'Handpicked Tours',
    description: 'Routes curated for pace, comfort, and memorable moments with less noise and better flow.',
    icon: Compass,
    className: 'is-wide',
  },
  {
    title: 'Secure Payments',
    description: 'Protected transactions with clear billing, verified vendors, and reliable booking confidence.',
    icon: Smartphone,
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
  },
  {
    id: 'australia',
    region: 'Australia',
    city: 'Sydney',
    country: 'Australia',
    markerX: 80.4,
    markerY: 76.2,
  },
  {
    id: 'africa',
    region: 'Africa',
    city: 'Marrakesh',
    country: 'Morocco',
    markerX: 53.9,
    markerY: 50.6,
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

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Slide Nav Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const OrbitGlyph: React.FC<OrbitGlyphProps> = ({ className = '' }) => {
  const [animationData, setAnimationData] = useState<object | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch('/animation/rotate-orbit.json')
      .then((res) => res.json())
      .then((data: object) => {
        if (!mounted) return;
        setAnimationData(data);
      })
      .catch(() => {
        if (!mounted) return;
        setAnimationData(null);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={`h4-featured-glyphs${className ? ` ${className}` : ''}`} aria-hidden="true">
      {animationData ? (
        <Lottie
          animationData={animationData}
          loop
          autoplay
          className="h4-featured-glyph-lottie"
        />
      ) : null}
    </div>
  );
};
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

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Slide Card Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
const SlideCard: React.FC<{ title: string; text: string }> = ({ title, text }) => {
  return (
    <div className="h4-slide-card">
      <svg
        className="h4-slide-card-shape"
        viewBox="0 0 430 280"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
<path
          className="h4-slide-card-shape-fill"
          d="M34 1H396C414 1 429 16 429 34V171C429 190 414 205 396 205H304C283 205 266 222 266 243V246C266 264 251 279 233 279H34C16 279 1 264 1 246V34C1 16 16 1 34 1Z"
        />
      </svg>
      <div className="h4-slide-card-copy">
        <span className="h4-slide-card-kicker">Curated stay</span>
        <h3 className="h4-slide-card-title">{title}</h3>
        <p className="h4-slide-card-text">{text}</p>
      </div>
      <div className="h4-slide-card-actions">
        <button className="h4-slide-card-explore">Explore</button>
      </div>
    </div>
  );
};

/* Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Main Component Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ */
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
  const experienceRailA = EXPERIENCE_CATEGORIES;
  const experienceRailB = [...EXPERIENCE_CATEGORIES].reverse();

  return (
    <div className="h4-page">
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Hero Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
      {/* Ã¢â€â‚¬Ã¢â€â‚¬ Showcase Section (auto-changing background) Ã¢â€â‚¬Ã¢â€â‚¬ */}
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
                    <div className="h4-experience-image" style={{ backgroundImage: `url(${item.image})` }} />
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
                    <div className="h4-experience-image" style={{ backgroundImage: `url(${item.image})` }} />
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
          <div className="h4-editorial-head h4-editorial-head-center h4-accent-head h4-choose-head">
            <OrbitGlyph className="h4-accent-glyphs" />
            <h2 className="h4-section-title h4-featured-gradient-title h4-accent-gradient-title">Why Choose Us</h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow h4-accent-subtitle">
              Trust-first travel planning with verified teams, clear value, and seamless execution across every journey stage.
            </p>
          </div>
          <div className="h4-choose-grid">
            {WHY_CHOOSE_US.map((item, index) => (
              <RevealBlock key={item.title} delay={index * 70}>
                <article className={`h4-choose-card${item.className ? ` ${item.className}` : ''}`}>
                  <div className="h4-choose-icon"><item.icon size={18} /></div>
                  <h3 className="h4-choose-title">{item.title}</h3>
                  <p className="h4-choose-text">{item.description}</p>
                </article>
              </RevealBlock>
            ))}
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
            <h2 className="h4-section-title h4-world-title">The TBP Map</h2>
            <p className="h4-editorial-copy h4-editorial-copy-narrow h4-world-subtitle">
              Explore the World Without Limits
            </p>
          </RevealBlock>

          <RevealBlock className="h4-world-stage-wrap">
            <div className="h4-world-stage">
              <div className="h4-world-grid" aria-hidden="true" />
              <div className="h4-world-paper-grain" aria-hidden="true" />
              <div className="h4-world-map-art" aria-hidden="true">
                <img src="/images/home4/tbp-map.png" alt="" />
              </div>

              <svg className="h4-world-routes" viewBox="0 0 1200 560" role="img" aria-label="Interactive destination map">
                <path className="h4-world-route h4-world-route-a" d="M206 184C335 108 507 105 600 186" />
                <path className="h4-world-route h4-world-route-b" d="M600 186C666 214 742 246 798 307" />
                <path className="h4-world-route h4-world-route-c" d="M534 255C580 250 635 249 699 271" />
                <path className="h4-world-route h4-world-route-d" d="M818 232C762 213 702 198 639 188" />
                <path className="h4-world-route h4-world-route-e" d="M214 184C257 293 286 385 322 428" />
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
                      } as React.CSSProperties
                    }
                  >
                    <button type="button" className="h4-world-pin" aria-label={`View ${item.region}: ${item.city}, ${item.country}`}>
                      <span className="h4-world-pin-core" />
                    </button>
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
              />
            </div>
          </RevealBlock>
        </div>
      </section>

      <section className="h4-story-section h4-story-section-tight h4-gallery-section">
        <div className="h4-container">
          <div className="h4-editorial-head h4-editorial-head-split">
            <div className="h4-featured-intro">
              <OrbitGlyph />
              <span className="h4-section-label">Gallery / Visual Showcase</span>
              <h2 className="h4-section-title h4-featured-gradient-title">Immersive travel visuals.</h2>
            </div>
            <p className="h4-editorial-copy">
              Masonry compositions, cinematic frames, and motion-oriented captures designed to preview journeys before they begin.
            </p>
          </div>
          <div className="h4-gallery-grid">
            {VISUAL_SHOWCASE.map((item, index) => (
              <RevealBlock
                key={item.title}
                delay={index * 70}
                className={item.className ?? ''}
              >
                <article className="h4-gallery-card">
                  <div className="h4-gallery-media" style={{ backgroundImage: `url(${item.image})` }}>
                    <span className="h4-gallery-eyebrow">{item.label}</span>
                    {item.mediaTag ? <span className="h4-gallery-media-tag">{item.mediaTag}</span> : null}
                  </div>
                  <div className="h4-gallery-body h4-reveal-copy">
                    <h3 className="h4-gallery-title">{item.title}</h3>
                    <p className="h4-gallery-caption">{item.description}</p>
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
              <img src="/logo/logo.png" alt="The Better Pass" className="h4-lux-footer-logo" />
              <p className="h4-lux-footer-text">
                Modern luxury travel with editorial clarity, refined stays, and calm itinerary design.
              </p>
            </div>
            <div className="h4-lux-footer-col">
              <h4>Explore</h4>
              <a href="#h4-hero">Home</a>
              <a href="#h4-about">Destinations</a>
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
            <span>(c) 2026 The Better Pass. All rights reserved.</span>
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






