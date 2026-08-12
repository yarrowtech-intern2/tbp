import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Home as HomeIcon, InfoCircle, Globe2, Envelope, CircleBottomUp, Send } from 'reicon-react';
import { FloatingDock, type FloatingDockItem } from '../components/ui/floating-dock';
import MacbookScrollDemo from '../components/macbook-scroll-demo';
import { TextReveal } from '../components/ui/text-reveal';
import WorldMap, { type WorldMapDot } from '../components/ui/world-map';
import { DEFAULT_FOOTER_CONTENT, getPublicAppContent, type FooterContent, type FooterLink } from '../lib/appContent';
import { submitContactSubmission } from '../lib/contactSubmissions';
import './home5.css';

const LazyGlobe = lazy(async () => ({ default: (await import('../components/ui/globe')).Globe }));

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

type DeferredMountProps = {
  children: React.ReactNode;
  className?: string;
  minHeight?: string;
  placeholderClassName?: string;
  rootMargin?: string;
};

const DeferredMount: React.FC<DeferredMountProps> = ({
  children,
  className,
  minHeight,
  placeholderClassName,
  rootMargin = '28% 0px',
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (mounted) return undefined;

    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [mounted, rootMargin]);

  return (
    <div ref={ref} className={className} style={!mounted && minHeight ? { minHeight } : undefined}>
      {mounted
        ? children
        : placeholderClassName
          ? <div className={placeholderClassName} aria-hidden="true" />
          : null}
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

const HOW_SECTION_MAP_DOTS: WorldMapDot[] = [
  {
    start: { lat: 64.2008, lng: -149.4937 },
    end: { lat: 34.0522, lng: -118.2437 },
  },
  {
    start: { lat: 64.2008, lng: -149.4937 },
    end: { lat: -15.7975, lng: -47.8919 },
  },
  {
    start: { lat: -15.7975, lng: -47.8919 },
    end: { lat: 38.7223, lng: -9.1393 },
  },
  {
    start: { lat: 51.5074, lng: -0.1278 },
    end: { lat: 28.6139, lng: 77.209 },
  },
  {
    start: { lat: 28.6139, lng: 77.209 },
    end: { lat: 43.1332, lng: 131.9113 },
  },
  {
    start: { lat: 28.6139, lng: 77.209 },
    end: { lat: -1.2921, lng: 36.8219 },
  },
];

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

const FINAL_CTA_COPY = 'The Better Pass brings trusted stays, guided experiences, local experts, and secure booking into one clear travel path, so you can stop juggling scattered plans and start choosing trips with confidence.';
const FINAL_CTA_WORDS = FINAL_CTA_COPY.split(/\s+/);

const HOME5_FOOTER_TITLE = 'Travel beautifully, hassle free\nwith The Better Pass';

const FAQ_ITEMS = [
  {
    question: 'What is The Better Pass?',
    answer: 'The Better Pass is a travel discovery and booking platform that brings stays, guided experiences, local experts, and secure booking into one place, so you can plan and book your entire trip without juggling tabs or scattered services.',
  },
  {
    question: 'How does booking work?',
    answer: 'It follows three simple steps: Discover listings for stays, tours, activities, and guides. Compare options side by side with clear pricing and inclusions. Then Book and pay securely — all in one flow.',
  },
  {
    question: 'Are the providers verified?',
    answer: 'Yes. Every provider on The Better Pass goes through an admin review and approval process before their listings go live. This ensures you only see trusted, vetted stays, guides, and experiences.',
  },
  {
    question: 'What can I book on The Better Pass?',
    answer: 'You can book across four categories: Stays (hotels, camps, villas), Experiences (safaris, walking tours, food trails, day plans), Guides (local hosts, drivers, experts), and Support (transfers, timing, day-of coordination).',
  },
  {
    question: 'Is my payment secure?',
    answer: 'Absolutely. All payments are processed through Razorpay, a trusted and secure payment gateway. Your financial information is never stored on our servers.',
  },
  {
    question: 'Can I message providers before booking?',
    answer: 'No, once your booking gets confirmed, U can directly message the provider.',
  },
] as const;

type HeroHeroLayer = {
  id: 'default' | 'beaches' | 'mountains' | 'deserts' | 'cities' | 'forests';
  title: string;
  poster?: string;
  video?: string;
  kind: 'white' | 'video';
};

const HERO_HERO_LAYERS: readonly HeroHeroLayer[] = [
  {
    id: 'default',
    title: 'Default',
    kind: 'white',
  },
  {
    id: 'beaches',
    title: 'Beaches',
    kind: 'video',
    poster: '/images/home4/beach-1600.jpg',
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1779877968/tbp-hero4_dmbfr5.mp4',
  },
  {
    id: 'forests',
    title: 'Forests',
    kind: 'video',
    poster: '/images/home4/forrest-1920.jpg',
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1781246935/forrest_ho0dak.mp4',
  },
  {
    id: 'mountains',
    title: 'Mountains',
    kind: 'video',
    poster: '/images/home5/mountain.png',
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1781246933/mountains_hbuxhy.mp4',
  },
  {
    id: 'cities',
    title: 'Cities',
    kind: 'video',
    poster: '/images/home4/city-1600.jpg',
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1781246934/cities_sg61vy.mp4',
  },
  {
    id: 'deserts',
    title: 'Deserts',
    kind: 'video',
    poster: '/images/home4/desert-1920.jpg',
    video: 'https://res.cloudinary.com/dc3qprub3/video/upload/v1781246931/desert_b5tdn9.mp4',
  },
] as const;

type VideoHeroContent = {
  eyebrow: string;
  title: string;
  stats: readonly {
    value: string;
    label: string;
  }[];
  description: string;
  ctaLabel: string;
};

type VideoHeroLayerId = Exclude<HeroHeroLayer['id'], 'default'>;
type VideoHeroStat = VideoHeroContent['stats'][number];

const isVideoHeroLayerId = (id: HeroHeroLayer['id']): id is VideoHeroLayerId => id !== 'default';

const HERO_VIDEO_CONTENT: Record<VideoHeroLayerId, VideoHeroContent> = {
  beaches: {
    eyebrow: 'Beach escapes',
    title: 'Beaches',
    stats: [
      { value: '18K+', label: 'Ocean travellers' },
      { value: '1.4K+', label: 'Coastal stays' },
      { value: '320+', label: 'Island routes' },
    ],
    description: 'Book sea-facing stays, boat days, and slow coastal plans that keep the trip easy from sunrise swims to sunset dinners.',
    ctaLabel: 'Book beach stays',
  },
  forests: {
    eyebrow: 'Forest journeys',
    title: 'Forests',
    stats: [
      { value: '9K+', label: 'Nature seekers' },
      { value: '860+', label: 'Cabin nights' },
      { value: '210+', label: 'Guided trails' },
    ],
    description: 'Move through hidden lodges, jungle trails, and local-led routes designed for quieter, deeper trips with less guesswork.',
    ctaLabel: 'Plan forest stays',
  },
  mountains: {
    eyebrow: 'Mountain stays',
    title: 'Mountains',
    stats: [
      { value: '12K+', label: 'Highland travellers' },
      { value: '980+', label: 'Chalet stays' },
      { value: '270+', label: 'Scenic routes' },
    ],
    description: 'Compare ridge-view hotels, alpine experiences, and transport support in one mountain plan built for altitude and ease.',
    ctaLabel: 'Explore mountain trips',
  },
  cities: {
    eyebrow: 'City breaks',
    title: 'Cityscapes',
    stats: [
      { value: '22K+', label: 'Urban travellers' },
      { value: '2.1K+', label: 'Boutique rooms' },
      { value: '540+', label: 'Curated experiences' },
    ],
    description: 'From design hotels to food trails and late-night culture, shape faster city itineraries without splitting bookings across tabs.',
    ctaLabel: 'Build a city trip',
  },
  deserts: {
    eyebrow: 'Desert routes',
    title: 'Dunes',
    stats: [
      { value: '7K+', label: 'Adventure travellers' },
      { value: '640+', label: 'Camp stays' },
      { value: '190+', label: 'Sunset experiences' },
    ],
    description: 'Plan camp nights, dune drives, and slow desert moments with trusted hosts and cleaner logistics from arrival to checkout.',
    ctaLabel: 'Start desert journeys',
  },
};

const getFooterHref = (link: FooterLink) => link.href?.trim() || '#';

const isRouteHref = (href: string) => href.startsWith('/');

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

const CONTACT_MODAL_TRANSITION_MS = 240;

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
  const [heroVideoIndex, setHeroVideoIndex] = useState(0);
  const [heroRevealIndex, setHeroRevealIndex] = useState<number | null>(null);
  const [heroVideoTransitioning, setHeroVideoTransitioning] = useState(false);
  const [heroTouchMode, setHeroTouchMode] = useState(false);
  const [heroCursorVisible, setHeroCursorVisible] = useState(false);
  const [heroInView, setHeroInView] = useState(true);
  const howProgressRef = useRef(0);
  const finalWordIndexRef = useRef(0);
  const howSceneRef = useRef<HTMLDivElement | null>(null);
  const flowNodesRef = useRef<(HTMLDivElement | null)[]>([]);
  const flowConnectorsRef = useRef<(HTMLDivElement | null)[]>([]);
  const finalWordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const [footerContent, setFooterContent] = useState<FooterContent>(DEFAULT_FOOTER_CONTENT);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactModalRendered, setContactModalRendered] = useState(false);
  const contactModalOpenFrameRef = useRef<number | null>(null);
  const [heroMenuOpen, setHeroMenuOpen] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormState>(EMPTY_CONTACT_FORM);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactStatus, setContactStatus] = useState<string | null>(null);
  const [contactError, setContactError] = useState<string | null>(null);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [stickyLogoVisible, setStickyLogoVisible] = useState(false);
  const stickyLogoOnDarkRef = useRef(false);
  const stickyMenuOnDarkRef = useRef(false);
  const stickyNavInHeroRef = useRef(true);
  const [shouldLoadFooterContent, setShouldLoadFooterContent] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const touchDeltaXRef = useRef(0);
  const bookingDragStartXRef = useRef<number | null>(null);
  const bookingDragDeltaXRef = useRef(0);
  const stickyLogoRef = useRef<HTMLAnchorElement | null>(null);
  const stickyMenuRef = useRef<HTMLDivElement | null>(null);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const heroBaseVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroPreviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const heroCursorFrameRef = useRef<number | null>(null);
  const heroTransitionTimerRef = useRef<number | null>(null);
  const heroCursorPointRef = useRef({ x: 0, y: 0 });
  const heroCursorTargetRef = useRef({ x: 0, y: 0 });
  const valueSectionRef = useRef<HTMLElement | null>(null);
  const logoActivatedRef = useRef(false);
  const howSectionRef = useRef<HTMLElement | null>(null);
  const finalSectionRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const activeHeroLayer = HERO_HERO_LAYERS[heroVideoIndex] ?? HERO_HERO_LAYERS[0];
  const nextHeroVideoIndex = (heroVideoIndex + 1) % HERO_HERO_LAYERS.length;
  const previewHeroLayer = HERO_HERO_LAYERS[nextHeroVideoIndex] ?? HERO_HERO_LAYERS[0];
  const revealHeroLayer = heroRevealIndex !== null
    ? (HERO_HERO_LAYERS[heroRevealIndex] ?? previewHeroLayer)
    : previewHeroLayer;
  const heroSubtitleOnDark = activeHeroLayer.kind === 'video'
    || (heroVideoTransitioning && revealHeroLayer.kind === 'video');
  const heroPreviewActive = heroInView && (heroCursorVisible || heroVideoTransitioning);
  const activeVideoHeroContent = activeHeroLayer.kind === 'video' && isVideoHeroLayerId(activeHeroLayer.id)
    ? HERO_VIDEO_CONTENT[activeHeroLayer.id]
    : null;
  const openContactModal = useCallback(() => {
    if (contactModalOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(contactModalOpenFrameRef.current);
    }
    setContactModalRendered(true);
    contactModalOpenFrameRef.current = window.requestAnimationFrame(() => {
      contactModalOpenFrameRef.current = null;
      setContactModalOpen(true);
    });
  }, []);
  const closeContactModal = useCallback(() => {
    if (contactModalOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(contactModalOpenFrameRef.current);
      contactModalOpenFrameRef.current = null;
    }
    setContactModalOpen(false);
  }, []);
  const mobileDockItems: FloatingDockItem[] = [
    {
      title: 'Home',
      icon: <HomeIcon />,
      to: '/',
    },
    {
      title: 'About us',
      icon: <InfoCircle />,
      to: '/about-final',
    },
    {
      title: 'Map',
      icon: <Globe2 />,
      to: '/map',
    },
    {
      title: 'Contact',
      icon: <Envelope />,
      onClick: openContactModal,
    },
    {
      title: 'Get started',
      icon: <CircleBottomUp />,
      to: '/auth',
      isPrimary: true,
    },
  ];

  useEffect(() => {
    if (shouldLoadFooterContent) return undefined;

    const node = footerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setShouldLoadFooterContent(true);
        observer.disconnect();
      },
      { rootMargin: '35% 0px', threshold: 0.01 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [shouldLoadFooterContent]);

  useEffect(() => {
    return () => {
      if (contactModalOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(contactModalOpenFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldLoadFooterContent) return undefined;

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
  }, [shouldLoadFooterContent]);

  useEffect(() => {
    if (contactModalOpen) {
      setContactModalRendered(true);
      return undefined;
    }

    if (!contactModalRendered) return undefined;

    const timer = window.setTimeout(() => {
      setContactModalRendered(false);
    }, CONTACT_MODAL_TRANSITION_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [contactModalOpen, contactModalRendered]);

  useEffect(() => {
    if (!contactModalRendered) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeContactModal();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeContactModal, contactModalRendered]);

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

  useEffect(() => {
    const updateStickyLogo = () => {
      if (logoActivatedRef.current) return;

      const node = valueSectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const triggerPoint = window.innerHeight * 0.82;
      if (rect.top <= triggerPoint) {
        logoActivatedRef.current = true;
        setStickyLogoVisible(true);
      }
    };

    updateStickyLogo();
    window.addEventListener('scroll', updateStickyLogo, { passive: true });
    window.addEventListener('resize', updateStickyLogo);

    return () => {
      window.removeEventListener('scroll', updateStickyLogo);
      window.removeEventListener('resize', updateStickyLogo);
    };
  }, []);

  useEffect(() => {
    const node = heroSectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        setHeroInView(entry.isIntersecting);
      },
      {
        threshold: 0.02,
        rootMargin: '20% 0px 20% 0px',
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(hover: hover) and (pointer: fine)');
    const updateMode = () => {
      const isFinePointer = media.matches;
      setHeroTouchMode(!isFinePointer);
      setHeroCursorVisible(false);
    };

    updateMode();
    media.addEventListener('change', updateMode);

    return () => {
      media.removeEventListener('change', updateMode);
    };
  }, []);

  useEffect(() => {
    const syncHeroCursorDefaults = () => {
      const node = heroSectionRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const fallbackPoint = {
        x: rect.width * (heroTouchMode ? 0.82 : 0.26),
        y: rect.height * 0.52,
      };

      heroCursorPointRef.current = fallbackPoint;
      heroCursorTargetRef.current = fallbackPoint;
      node.style.setProperty('--home5-hero-cursor-x', `${fallbackPoint.x}px`);
      node.style.setProperty('--home5-hero-cursor-y', `${fallbackPoint.y}px`);
      node.style.setProperty('--home5-hero-reveal-x', `${fallbackPoint.x}px`);
      node.style.setProperty('--home5-hero-reveal-y', `${fallbackPoint.y}px`);
      node.style.setProperty('--home5-hero-reveal-radius', '0px');
    };

    syncHeroCursorDefaults();
    window.addEventListener('resize', syncHeroCursorDefaults);

    return () => {
      window.removeEventListener('resize', syncHeroCursorDefaults);
    };
  }, [heroTouchMode]);

  useEffect(() => {
    const syncVideoPlayback = (video: HTMLVideoElement | null, shouldPlay: boolean) => {
      if (!video) return;
      if (shouldPlay) {
        const playAttempt = video.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(() => {});
        }
        return;
      }

      video.pause();
    };

    syncVideoPlayback(heroBaseVideoRef.current, heroInView && activeHeroLayer.kind === 'video');
    syncVideoPlayback(
      heroPreviewVideoRef.current,
      heroPreviewActive && revealHeroLayer.kind === 'video',
    );
  }, [activeHeroLayer.kind, heroInView, heroPreviewActive, revealHeroLayer.kind]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const pageVisible = document.visibilityState === 'visible';
      if (!pageVisible) {
        heroBaseVideoRef.current?.pause();
        heroPreviewVideoRef.current?.pause();
        return;
      }

      if (heroInView && activeHeroLayer.kind === 'video') {
        const playAttempt = heroBaseVideoRef.current?.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(() => {});
        }
      }
      if (heroPreviewActive && revealHeroLayer.kind === 'video') {
        const playAttempt = heroPreviewVideoRef.current?.play();
        if (playAttempt && typeof playAttempt.catch === 'function') {
          playAttempt.catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeHeroLayer.kind, heroInView, heroPreviewActive, revealHeroLayer.kind]);

  useEffect(() => {
    const updateStickyLogoTone = () => {
      const logoNode = stickyLogoRef.current;
      const footerNode = footerRef.current;
      if (!stickyLogoVisible || !logoNode || !footerNode) {
        if (stickyLogoOnDarkRef.current) {
          stickyLogoOnDarkRef.current = false;
          logoNode?.querySelector('img')?.setAttribute('src', '/logo/final-logo.png');
        }
        return;
      }

      const logoRect = logoNode.getBoundingClientRect();
      const footerRect = footerNode.getBoundingClientRect();
      const sampleX = logoRect.left + (logoRect.width / 2);
      const sampleY = logoRect.top + (logoRect.height / 2);
      const overlapsFooter = (
        sampleX >= footerRect.left
        && sampleX <= footerRect.right
        && sampleY >= footerRect.top
        && sampleY <= footerRect.bottom
      );

      if (stickyLogoOnDarkRef.current !== overlapsFooter) {
        stickyLogoOnDarkRef.current = overlapsFooter;
        logoNode.querySelector('img')?.setAttribute('src', overlapsFooter ? '/logo/final-logo-white.png' : '/logo/final-logo.png');
      }
    };

    updateStickyLogoTone();
    window.addEventListener('scroll', updateStickyLogoTone, { passive: true });
    window.addEventListener('resize', updateStickyLogoTone);

    return () => {
      window.removeEventListener('scroll', updateStickyLogoTone);
      window.removeEventListener('resize', updateStickyLogoTone);
    };
  }, [stickyLogoVisible]);

  useEffect(() => {
    const updateStickyMenuTone = () => {
      const menuNode = stickyMenuRef.current;
      if (!menuNode) return;

      const menuRect = menuNode.getBoundingClientRect();
      const sampleX = menuRect.left + (menuRect.width / 2);
      const sampleY = menuRect.top + (menuRect.height / 2);
      const footerRect = footerRef.current?.getBoundingClientRect();
      const heroRect = heroSectionRef.current?.getBoundingClientRect();
      const overlapsFooter = Boolean(
        footerRect
        && sampleX >= footerRect.left
        && sampleX <= footerRect.right
        && sampleY >= footerRect.top
        && sampleY <= footerRect.bottom
      );
      const overlapsHero = Boolean(
        heroRect
        && sampleX >= heroRect.left
        && sampleX <= heroRect.right
        && sampleY >= heroRect.top
        && sampleY <= heroRect.bottom
      );
      const nextToneOnDark = overlapsFooter || (overlapsHero && heroSubtitleOnDark);
      const nextNavInHero = overlapsHero;

      if (stickyNavInHeroRef.current !== nextNavInHero) {
        stickyNavInHeroRef.current = nextNavInHero;
        menuNode.classList.toggle('is-in-hero', nextNavInHero);
        menuNode.classList.toggle('is-glass', !nextNavInHero);
      }
      if (stickyMenuOnDarkRef.current !== nextToneOnDark) {
        stickyMenuOnDarkRef.current = nextToneOnDark;
        menuNode.classList.toggle('is-on-dark', nextToneOnDark);
      }
    };

    updateStickyMenuTone();
    window.addEventListener('scroll', updateStickyMenuTone, { passive: true });
    window.addEventListener('resize', updateStickyMenuTone);

    return () => {
      window.removeEventListener('scroll', updateStickyMenuTone);
      window.removeEventListener('resize', updateStickyMenuTone);
    };
  }, [heroSubtitleOnDark]);

  useEffect(() => () => {
    if (heroCursorFrameRef.current !== null) {
      window.cancelAnimationFrame(heroCursorFrameRef.current);
    }
    if (heroTransitionTimerRef.current !== null) {
      window.clearTimeout(heroTransitionTimerRef.current);
    }
  }, []);

  const flushHeroCursorPosition = () => {
    heroCursorFrameRef.current = null;
    const node = heroSectionRef.current;
    if (!node) return;

    const point = heroCursorTargetRef.current;
    heroCursorPointRef.current = point;
    node.style.setProperty('--home5-hero-cursor-x', `${point.x}px`);
    node.style.setProperty('--home5-hero-cursor-y', `${point.y}px`);
  };

  const updateHeroCursorPosition = (clientX: number, clientY: number) => {
    const node = heroSectionRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    heroCursorTargetRef.current = {
      x: clampValue(clientX - rect.left, 0, rect.width),
      y: clampValue(clientY - rect.top, 0, rect.height),
    };

    if (heroCursorFrameRef.current === null) {
      heroCursorFrameRef.current = window.requestAnimationFrame(flushHeroCursorPosition);
    }
  };

  const triggerHeroVideoReveal = () => {
    const node = heroSectionRef.current;
    if (!node || heroVideoTransitioning) return;

    const rect = node.getBoundingClientRect();
    const origin = heroCursorPointRef.current.x || heroCursorPointRef.current.y
      ? heroCursorPointRef.current
      : { x: rect.width * 0.5, y: rect.height * 0.5 };
    const nextIndex = (heroVideoIndex + 1) % HERO_HERO_LAYERS.length;
    const maxRadius = Math.max(
      Math.hypot(origin.x, origin.y),
      Math.hypot(rect.width - origin.x, origin.y),
      Math.hypot(origin.x, rect.height - origin.y),
      Math.hypot(rect.width - origin.x, rect.height - origin.y),
    );

    if (heroTransitionTimerRef.current !== null) {
      window.clearTimeout(heroTransitionTimerRef.current);
    }

    node.style.setProperty('--home5-hero-reveal-x', `${origin.x}px`);
    node.style.setProperty('--home5-hero-reveal-y', `${origin.y}px`);
    node.style.setProperty('--home5-hero-reveal-radius', '0px');
    setHeroRevealIndex(nextIndex);
    setHeroVideoTransitioning(true);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        node.style.setProperty('--home5-hero-reveal-radius', `${maxRadius}px`);
      });
    });

    heroTransitionTimerRef.current = window.setTimeout(() => {
      setHeroVideoIndex(nextIndex);
      setHeroRevealIndex(null);
      setHeroVideoTransitioning(false);
      node.style.setProperty('--home5-hero-reveal-radius', '0px');
    }, 920);
  };

  const handleHeroPointerEnter = (event: React.PointerEvent<HTMLElement>) => {
    if (heroTouchMode) return;
    setHeroCursorVisible(true);
    updateHeroCursorPosition(event.clientX, event.clientY);
  };

  const handleHeroPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
      setHeroCursorVisible(true);
    }
    updateHeroCursorPosition(event.clientX, event.clientY);
  };

  const handleHeroPointerLeave = () => {
    if (!heroTouchMode) {
      setHeroCursorVisible(false);
    }
  };

  const handleHeroPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.home5-mobile-dock') || target?.closest('.home5-hero-menu')) return;
    updateHeroCursorPosition(event.clientX, event.clientY);
  };

  const handleHeroClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('.home5-mobile-dock') || target?.closest('.home5-hero-menu') || target?.closest('.home5-hero-immersive-cta')) return;
    triggerHeroVideoReveal();
  };

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

      if (Math.abs(howProgressRef.current - nextProgress) < 0.001) return;
      howProgressRef.current = nextProgress;

      const intro = clampValue(nextProgress / 0.18, 0, 1);
      const discover = clampValue((nextProgress - 0.18) / 0.2, 0, 1);
      const compare = clampValue((nextProgress - 0.42) / 0.2, 0, 1);
      const book = clampValue((nextProgress - 0.68) / 0.2, 0, 1);

      const sceneNode = howSceneRef.current;
      if (sceneNode) {
        sceneNode.style.opacity = String(0.22 + (intro * 0.78));
        sceneNode.style.transform = `translateY(${(1 - intro) * 30}px)`;
      }

      const activeIdx = book > 0.08 ? 2 : compare > 0.08 ? 1 : discover > 0.08 ? 0 : -1;
      flowNodesRef.current.forEach((el, i) => {
        if (!el) return;
        if (i === activeIdx) { el.classList.add('is-active'); }
        else { el.classList.remove('is-active'); }
      });

      const connectorProgress = [discover, compare];
      flowConnectorsRef.current.forEach((el, i) => {
        if (!el) return;
        el.style.setProperty('--flow-progress', String(connectorProgress[i] ?? 0));
      });
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

      if (finalWordIndexRef.current === nextWordIndex) return;
      finalWordIndexRef.current = nextWordIndex;

      finalWordsRef.current.forEach((el, i) => {
        if (!el) return;
        if (i < nextWordIndex) {
          el.className = 'home5-final-word is-complete';
        } else if (i === nextWordIndex) {
          el.className = 'home5-final-word is-next';
        } else {
          el.className = 'home5-final-word is-pending';
        }
      });
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

  return (
    <main className="home5-page">
      <Link
        ref={stickyLogoRef}
        to="/"
        className={`home5-sticky-logo${stickyLogoVisible ? ' is-visible' : ''}`}
        aria-label="The Better Pass home"
      >
        <img src="/logo/final-logo.png" alt="The Better Pass" />
      </Link>

      <div
        ref={stickyMenuRef}
        className="home5-nav-shell is-in-hero"
      >
        <FloatingDock className="home5-mobile-dock" items={mobileDockItems} ariaLabel="Landing navigation" />

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
            <Link to="/map" onClick={() => setHeroMenuOpen(false)}>Map</Link>
            <Link to="/auth" onClick={() => setHeroMenuOpen(false)}>Get started</Link>
            <button
              type="button"
              onClick={() => {
                setHeroMenuOpen(false);
                openContactModal();
              }}
            >
              Contact
            </button>
          </nav>
        </div>
      </div>

      <section
        id="home5-hero"
        ref={heroSectionRef}
        className={`home5-hero${heroVideoTransitioning ? ' is-video-transitioning' : ''}${activeHeroLayer.kind === 'white' ? ' is-default-hero-layer' : ''}`}
        onPointerEnter={handleHeroPointerEnter}
        onPointerMove={handleHeroPointerMove}
        onPointerLeave={handleHeroPointerLeave}
        onPointerDown={handleHeroPointerDown}
        onClick={handleHeroClick}
      >
        <div className="home5-hero-media-stack" aria-hidden="true">
          {activeHeroLayer.kind === 'white' ? (
            <div className="home5-hero-bg-white home5-hero-bg-white-base" />
          ) : (
            <video
              ref={heroBaseVideoRef}
              key={`hero-base-${activeHeroLayer.id}`}
              className="home5-hero-bg-video home5-hero-bg-video-base"
              src={activeHeroLayer.video}
              poster={activeHeroLayer.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              disablePictureInPicture
            />
          )}
          {revealHeroLayer.kind === 'white' ? (
            <div
              className={`home5-hero-bg-white home5-hero-bg-white-preview${heroCursorVisible ? ' is-visible' : ''}${heroTouchMode ? ' is-touch' : ''}`}
            />
          ) : (
            <video
              ref={heroPreviewVideoRef}
              key={`hero-preview-${revealHeroLayer.id}-${heroRevealIndex ?? nextHeroVideoIndex}`}
              className={`home5-hero-bg-video home5-hero-bg-video-preview${heroCursorVisible ? ' is-visible' : ''}${heroTouchMode ? ' is-touch' : ''}`}
              src={revealHeroLayer.video}
              poster={revealHeroLayer.poster}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              disablePictureInPicture
            />
          )}
          <div className={`home5-hero-video-cursor${heroCursorVisible ? ' is-visible' : ''}${heroTouchMode ? ' is-touch' : ''}`} />
          <div className="home5-hero-media-vignette" />
          <div className="home5-hero-media-noise" />
        </div>

        <div className="home5-hero-shell">
          {activeHeroLayer.kind === 'white' ? (
            <>
              <div key={`copy-${activeHeroLayer.id}`} className="home5-copy">
                <h1 className="home5-title">The Better Pass</h1>
                <h2 className={`home5-subtitle${heroSubtitleOnDark ? ' is-light' : ''}`}>
                  <span>travel made</span>
                  <span>simple</span>
                </h2>
              </div>

              <div className="home5-globe-stage" aria-hidden="true">
                <div className="home5-globe-ground" />
                <Suspense fallback={<div className="home5-globe home5-globe-placeholder" aria-hidden="true" />}>
                  <LazyGlobe className="home5-globe" />
                </Suspense>
                <div className="home5-globe-fade" />
              </div>
            </>
          ) : activeVideoHeroContent ? (
            <div key={`immersive-${activeHeroLayer.id}`} className="home5-hero-immersive">
              <div className="home5-hero-immersive-head">
                <span className="home5-hero-immersive-eyebrow">{activeVideoHeroContent.eyebrow}</span>
                <h1 className="home5-hero-immersive-title">{activeVideoHeroContent.title}</h1>
              </div>

              <div className="home5-hero-immersive-bottom">
                <div className="home5-hero-immersive-stats" aria-label={`${activeVideoHeroContent.eyebrow} highlights`}>
                  {activeVideoHeroContent.stats.map((stat: VideoHeroStat) => (
                    <div className="home5-hero-immersive-stat" key={`${activeVideoHeroContent.title}-${stat.label}`}>
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>

                <div className="home5-hero-immersive-cta-row">
                  <Link className="home5-hero-immersive-cta" to="/auth">
                    <span>{activeVideoHeroContent.ctaLabel}</span>
                    <span className="home5-hero-immersive-cta-icon" aria-hidden="true">-&gt;</span>
                  </Link>
                  <p>{activeVideoHeroContent.description}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      <section ref={valueSectionRef} className="home5-value-section" id="home5-discover">
        <div className="container">
          <ScrollReveal className="home5-value-shell">
            <span className="home5-section-eyebrow">Why The Better Pass</span>
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

      <section ref={howSectionRef} className="home5-how-section" id="home5-flow">
        <div className="home5-how-track">
          <div className="home5-how-sticky">
            <WorldMap
              className="home5-how-map-bg"
              dots={HOW_SECTION_MAP_DOTS}
              lineColor="#ff6a00"
              aria-hidden="true"
            />
            <div className="container home5-how-content-layer">
              <div ref={howSceneRef} className="home5-how-scene" style={{ opacity: 0.22, transform: 'translateY(30px)' }}>
                <div className="home5-how-shell">
                  <span className="home5-how-eyebrow">Why choose The Better Pass</span>
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
                    {FLOW_STEPS.map((step, index) => (
                      <React.Fragment key={step.id}>
                        <div
                          ref={(el) => { flowNodesRef.current[index] = el; }}
                          className="home5-flow-node"
                        >
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
                            ref={(el) => { flowConnectorsRef.current[index] = el; }}
                            className="home5-flow-connector"
                            aria-hidden="true"
                          />
                        ) : null}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home5-book-section" id="home5-book">
        <div className="container">
          <ScrollReveal className="home5-book-shell">
            <span className="home5-book-eyebrow">What you can book</span>
            <div className="home5-book-heading">
              <h2 className="home5-book-title">Build the trip, not just one booking</h2>
              <p className="home5-book-copy">
                The Better Pass brings the stay, experience, guide, and support layer into one trip-building flow.
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

      <section className="home5-trust-section" id="home5-trust">
        <div className="container">
          <div className="home5-trust-layout">
            <ScrollReveal className="home5-trust-intro">
              <span className="home5-trust-eyebrow">Why trust The Better Pass</span>
              <h2 className="home5-trust-title">Book with people and plans you can trust</h2>
              <TextReveal className="home5-trust-reveal">
                Confidence comes from verified providers, clear details, connected support, and payment visibility in one place.
              </TextReveal>
            </ScrollReveal>

            <div className="home5-trust-list" aria-label="The Better Pass trust points">
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
                <h2 className="home5-final-title">Start exploring with The Better Pass</h2>
                <p className="home5-final-reveal" aria-label={FINAL_CTA_COPY}>
                  {FINAL_CTA_WORDS.map((word, index) => (
                    <span
                      key={`${word}-${index}`}
                      ref={(el) => { finalWordsRef.current[index] = el; }}
                      className="home5-final-word is-pending"
                      aria-hidden="true"
                    >
                      {word}
                      {index < FINAL_CTA_WORDS.length - 1 ? '\u00A0' : ''}
                    </span>
                  ))}
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
                <DeferredMount
                  className="home5-final-globe-mount"
                  placeholderClassName="home5-final-globe home5-globe-placeholder"
                  rootMargin="40% 0px"
                >
                  <Suspense fallback={<div className="home5-final-globe home5-globe-placeholder" aria-hidden="true" />}>
                    <LazyGlobe className="home5-final-globe" aria-hidden="true" />
                  </Suspense>
                </DeferredMount>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="home5-faq-section" id="home5-faq">
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
                      aria-expanded={isOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenFaqIndex(isOpen ? null : index);
                      }}
                    >
                      <span className="home5-faq-question">{item.question}</span>
                      <span className="home5-faq-icon" aria-hidden="true" />
                    </button>
                    <div
                      className="home5-faq-body"
                      style={{ maxHeight: isOpen ? '300px' : '0px' }}
                    >
                      <p>{item.answer}</p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>
      </section>

      <footer ref={footerRef} className="home5-footer" id="contact">
        <div className="home5-footer-inner">
          <div className="home5-footer-watermark" aria-hidden="true">The Better Pass</div>

          <div className="home5-footer-top">
            <div className="home5-footer-brand">
              <span className="home5-footer-eyebrow">The Better Pass</span>
              <p>{HOME5_FOOTER_TITLE}</p>
              <button type="button" className="home5-footer-contact-btn" onClick={openContactModal}>
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
                          {isRouteHref(href) ? (
                            <Link to={href}>{link.label}</Link>
                          ) : (
                            <a href={href} target={href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#') ? undefined : '_blank'} rel="noreferrer">
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

      {contactModalRendered && (
        <div
          className={`home5-contact-modal${contactModalOpen ? ' is-open' : ''}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="home5-contact-title"
        >
          <button type="button" className="home5-contact-backdrop" aria-label="Close contact form" onClick={closeContactModal} />
          <div className="home5-contact-panel">
            <div className="home5-contact-head">
              <div>
                <span>Contact Us</span>
                <h2 id="home5-contact-title">Tell us what you need</h2>
              </div>
              <button
                type="button"
                className="home5-contact-close"
                onClick={closeContactModal}
                aria-label="Close contact form"
              >
                <span aria-hidden="true" />
              </button>
            </div>

            <form className="home5-contact-form" onSubmit={(event) => void handleContactSubmit(event)}>
              <label className="home5-contact-field home5-contact-name-field">
                <span>Full Name</span>
                <input value={contactForm.name} onChange={(event) => updateContactField('name', event.target.value)} required />
              </label>
              <label className="home5-contact-field home5-contact-email-field">
                <span>Email</span>
                <input type="email" value={contactForm.email} onChange={(event) => updateContactField('email', event.target.value)} required />
              </label>
              <label className="home5-contact-field home5-contact-phone-field">
                <span>Phone</span>
                <input value={contactForm.phone} onChange={(event) => updateContactField('phone', event.target.value)} />
              </label>
              <label className="home5-contact-field home5-contact-message-field">
                <span>Your Message</span>
                <textarea value={contactForm.message} onChange={(event) => updateContactField('message', event.target.value)} required />
              </label>
              <div className="home5-contact-actions">
                <button type="submit" className="home5-contact-submit" disabled={contactSubmitting} aria-label="Send message">
                  {contactSubmitting ? <Loader2 size={22} className="home5-spin" /> : <Send size={24} aria-hidden="true" />}
                </button>
              </div>

              {contactStatus && <p className="home5-contact-status"><CheckCircle2 size={16} />{contactStatus}</p>}
              {contactError && <p className="home5-contact-error">{contactError}</p>}
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
