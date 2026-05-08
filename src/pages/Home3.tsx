import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    ChevronDown,
    Compass,
    Globe,
    MapPin,
    Mountain,
    Shield,
    Sparkles,
    Star,
    Users,
} from 'lucide-react';
import './home3.css';

/* ─── Scroll Reveal ────────────────────────────────────────────────── */
type RevealProps = { children: React.ReactNode; className?: string; delay?: number };

const Reveal: React.FC<RevealProps> = ({ children, className = '', delay = 0 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(node); } },
            { threshold: 0.1, rootMargin: '0px 0px -8% 0px' },
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`h3-reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
            style={{ '--delay': `${delay}ms` } as React.CSSProperties}
        >
            {children}
        </div>
    );
};

/* ─── Data ─────────────────────────────────────────────────────────── */
const services = [
    {
        icon: Compass,
        title: 'Guided Expeditions',
        description: 'Expert-led journeys through mountains, valleys, and hidden landscapes. Every trail hand-picked for wonder and discovery.',
        tag: 'Most Popular',
    },
    {
        icon: Mountain,
        title: 'Adventure Sports',
        description: 'White-water rafting, paragliding, rock climbing — adrenaline-fueled experiences for the bold and endlessly curious.',
        tag: null,
    },
    {
        icon: Sparkles,
        title: 'Cultural Immersion',
        description: 'Stay with locals, taste authentic cuisine, and witness traditions that no textbook can ever fully capture.',
        tag: null,
    },
    {
        icon: Star,
        title: 'Luxury Retreats',
        description: 'World-class resorts, private villas, and perfectly curated experiences for those who travel beautifully in style.',
        tag: 'Premium',
    },
];

const destinations = [
    {
        name: 'Delhi Heritage',
        country: 'India',
        description: 'The paradise on earth — emerald lakes, saffron fields, and snow-tipped Himalayan peaks at every horizon.',
        image: '/images/delhi1.jpg',
        tag: 'Trending',
        price: 'From ₹24,999',
        imgPos: 'center 42%',
    },
    {
        name: 'Kerala Backwaters',
        country: 'India',
        description: 'Coffee estates, mist-covered hills, and ancient temples — the Scotland of India, reimagined for explorers.',
        image: '/images/kerala1.jpg',
        tag: 'Nature',
        price: 'From ₹12,499',
        imgPos: 'center 52%',
    },
    {
        name: 'Sikkim Peaks',
        country: 'India',
        description: 'A cold desert valley sitting in the arms of the mighty Himalayas — raw, remote, and utterly breathtaking.',
        image: '/images/sikkim2.jpg',
        tag: 'Adventure',
        price: 'From ₹18,999',
        imgPos: 'center 46%',
    },
];

const testimonials = [
    {
        name: 'Priya Sharma',
        location: 'Mumbai, India',
        text: "The Kashmir trip exceeded every expectation. The guides knew every hidden gem, every secret viewpoint. I've already booked my next journey with Vagabond.",
        rating: 5,
        avatar: 'PS',
    },
    {
        name: 'Arjun Mehta',
        location: 'Bangalore, India',
        text: "Adventure sports in Coorg was a life-changing experience. The team handled absolutely everything so seamlessly — I just had to show up and enjoy.",
        rating: 5,
        avatar: 'AM',
    },
    {
        name: 'Neha Kapoor',
        location: 'Delhi, India',
        text: "Spiti Valley in winter — words genuinely can't describe it. Vagabond made what seemed like an impossible journey possible. Worth every single rupee.",
        rating: 5,
        avatar: 'NK',
    },
];

const stats = [
    { value: '200+', label: 'Destinations' },
    { value: '15K+', label: 'Happy Travelers' },
    { value: '8+', label: 'Years of Excellence' },
    { value: '98%', label: 'Satisfaction Rate' },
];

const horizontalCategories = [
    {
        title: 'India',
        label: 'Desert',
        video: '/video/horizontal-sect/desert.mp4',
        kicker: 'The Better Pass',
        description: 'Discover vast dunes, warm sunsets, and cinematic desert routes across India.',
        verticalText: 'Desert India',
        themeColor: '#a55a16',
        accentColor: '#f2d6b0',
    },
    {
        title: 'India',
        label: 'Coasts',
        video: '/video/horizontal-sect/ocean.mp4',
        kicker: 'The Better Pass',
        description: 'Follow shoreline escapes, sea breeze towns, and island-style stays on India’s coasts.',
        verticalText: 'Coastal India',
        themeColor: '#042b53',
        accentColor: '#fb4f68',
    },
    {
        title: 'India',
        label: 'Mountains',
        video: '/video/horizontal-sect/mountain.mp4',
        kicker: 'The Better Pass',
        description: 'Move through high-altitude valleys, snow lines, and mountain trails across India.',
        verticalText: 'Mountain India',
        themeColor: '#0b4b2d',
        accentColor: '#90f6b8',
    },
    {
        title: 'India',
        label: 'Cities',
        video: '/video/horizontal-sect/cityscape.mp4',
        kicker: 'The Better Pass',
        description: 'Explore skylines, food streets, culture hubs, and non-stop city energy in India.',
        verticalText: 'City India',
        themeColor: '#d0e685',
        accentColor: '#3f45d9',
    },
    {
        title: 'India',
        label: 'Forests',
        video: '/video/horizontal-sect/forrest.mp4',
        kicker: 'The Better Pass',
        description: 'Drift through rainforest trails, wildlife zones, and slow nature retreats in India.',
        verticalText: 'Forest India',
        themeColor: '#e52e34',
        accentColor: '#f7f6f3',
    },
];
const testimonialUpperRow = testimonials;
const testimonialLowerRow = [...testimonials].reverse();

/* ─── Component ─────────────────────────────────────────────────────── */
export const Home3: React.FC = () => {
    const heroSceneRef = useRef<HTMLElement>(null);
    const heroBgRef = useRef<HTMLDivElement>(null);
    const heroContentRef = useRef<HTMLDivElement>(null);
    const cloud1Ref = useRef<HTMLImageElement>(null);
    const cloud2Ref = useRef<HTMLImageElement>(null);
    const cloud3Ref = useRef<HTMLImageElement>(null);
    const cloud4Ref = useRef<HTMLImageElement>(null);
    const cloud5Ref = useRef<HTMLImageElement>(null);
    const cloud6Ref = useRef<HTMLImageElement>(null);
    const cloud7Ref = useRef<HTMLImageElement>(null);
    const cloud8Ref = useRef<HTMLImageElement>(null);
    const cloud9Ref = useRef<HTMLImageElement>(null);
    const cloud10Ref = useRef<HTMLImageElement>(null);
    const stripBgRef = useRef<HTMLDivElement>(null);
    const ctaBgRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);
    const mouse = useRef({ x: 0, y: 0, lx: 0, ly: 0 });
    const [activeHorizontalIndex, setActiveHorizontalIndex] = useState(0);
    const [hoveredHorizontalIndex, setHoveredHorizontalIndex] = useState<number | null>(null);
    const [isHoverDevice, setIsHoverDevice] = useState(false);
    const horizontalVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);
    const moodPanelRefs = useRef<(HTMLElement | null)[]>([]);
    const moodTouchStartXRef = useRef<number | null>(null);
    const moodTouchStartYRef = useRef<number | null>(null);
    const visibleHorizontalIndex = isHoverDevice ? hoveredHorizontalIndex : activeHorizontalIndex;
    const moodThemeIndex = visibleHorizontalIndex ?? activeHorizontalIndex;
    const activeMood = horizontalCategories[moodThemeIndex] ?? horizontalCategories[0];

    useEffect(() => {
        const scene = heroSceneRef.current;
        const bg = heroBgRef.current;
        const content = heroContentRef.current;
        const c1 = cloud1Ref.current;
        const c2 = cloud2Ref.current;
        const c3 = cloud3Ref.current;
        const c4 = cloud4Ref.current;
        const c5 = cloud5Ref.current;
        const c6 = cloud6Ref.current;
        const c7 = cloud7Ref.current;
        const c8 = cloud8Ref.current;
        const c9 = cloud9Ref.current;
        const c10 = cloud10Ref.current;
        const stripBg = stripBgRef.current;
        const ctaBg = ctaBgRef.current;

        if (!scene || !bg) return;

        // Only track mouse on non-touch devices
        const hasHover = window.matchMedia('(hover: hover)').matches;

        const onMouse = (e: MouseEvent) => {
            mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
            mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
        };

        const tick = () => {
            const m = mouse.current;
            // Lerp mouse for buttery smoothness
            m.lx += (m.x - m.lx) * 0.055;
            m.ly += (m.y - m.ly) * 0.055;

            // Hero scroll progress (0 → 1 over sticky range)
            const travel = Math.max(scene.offsetHeight - window.innerHeight, 1);
            const progress = Math.min(Math.max(window.scrollY / travel, 0), 1);
            const ph = progress * window.innerHeight;

            // Background — mouse parallax only on hover-capable devices
            const mx = hasHover ? m.lx * -22 : 0;
            const my = hasHover ? m.ly * -14 - progress * 90 : -progress * 90;
            bg.style.transform = `translate3d(${mx}px, ${my}px, 0) scale(1.2)`;

            // Content — rises and fades
            if (content) {
                content.style.transform = `translate3d(0, ${progress * -80}px, 0)`;
                content.style.opacity = String(Math.max(1 - progress * 2.8, 0));
            }

            // Clouds — three depth layers, slowest (back) → fastest (front)
            // Reduce travel on mobile for comfort
            const cloudScale = window.innerWidth < 768 ? 0.42 : 0.74;
            if (c1) c1.style.transform = `translate3d(0, ${-ph * 0.12 * cloudScale}px, 0)`;
            if (c2) c2.style.transform = `translate3d(0, ${-ph * 0.24 * cloudScale}px, 0)`;
            if (c3) c3.style.transform = `translate3d(0, ${-ph * 0.3 * cloudScale}px, 0)`;
            if (c4) c4.style.transform = `translate3d(0, ${-ph * 0.16 * cloudScale}px, 0)`;
            if (c5) c5.style.transform = `translate3d(0, ${-ph * 0.22 * cloudScale}px, 0)`;
            if (c6) c6.style.transform = `translate3d(0, ${-ph * 0.14 * cloudScale}px, 0)`;
            if (c7) c7.style.transform = `translate3d(0, ${-ph * 0.18 * cloudScale}px, 0)`;
            if (c8) c8.style.transform = `translate3d(0, ${-ph * 0.2 * cloudScale}px, 0)`;
            if (c9) c9.style.transform = `translate3d(0, ${-ph * 0.22 * cloudScale}px, 0)`;
            if (c10) c10.style.transform = `translate3d(0, ${-ph * 0.18 * cloudScale}px, 0)`;

            // Strip parallax
            if (stripBg) {
                const r = stripBg.parentElement?.getBoundingClientRect();
                if (r) stripBg.style.transform = `translate3d(0, ${-r.top * 0.28}px, 0) scale(1.15)`;
            }

            // CTA parallax
            if (ctaBg) {
                const r = ctaBg.parentElement?.getBoundingClientRect();
                if (r) ctaBg.style.transform = `translate3d(0, ${-r.top * 0.22}px, 0) scale(1.12)`;
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        if (hasHover) window.addEventListener('mousemove', onMouse, { passive: true });

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            if (hasHover) window.removeEventListener('mousemove', onMouse);
        };
    }, []);

    useEffect(() => {
        const media = window.matchMedia('(hover: hover) and (pointer: fine)');
        const updateMode = () => {
            setIsHoverDevice(media.matches);
        };

        updateMode();
        media.addEventListener('change', updateMode);
        window.addEventListener('resize', updateMode);

        return () => {
            media.removeEventListener('change', updateMode);
            window.removeEventListener('resize', updateMode);
        };
    }, []);

    useEffect(() => {
        setActiveHorizontalIndex(0);
        setHoveredHorizontalIndex(null);
    }, []);

    useEffect(() => {
        horizontalVideoRefs.current.forEach((video) => {
            if (!video) return;
            video.play().catch(() => {});
        });
    }, [activeHorizontalIndex]);

    useEffect(() => {
        if (isHoverDevice) return;
        const panels = moodPanelRefs.current.filter((panel): panel is HTMLElement => Boolean(panel));
        if (!panels.length) return;

        let activeIndex = activeHorizontalIndex;
        const observer = new IntersectionObserver(
            (entries) => {
                let bestIndex = activeIndex;
                let bestRatio = 0;

                entries.forEach((entry) => {
                    const target = entry.target as HTMLElement;
                    const idx = Number(target.dataset.panelIndex ?? -1);
                    if (!Number.isFinite(idx) || idx < 0) return;
                    if (entry.intersectionRatio > bestRatio) {
                        bestRatio = entry.intersectionRatio;
                        bestIndex = idx;
                    }
                });

                if (bestIndex !== activeIndex && bestRatio > 0.35) {
                    activeIndex = bestIndex;
                    setActiveHorizontalIndex(bestIndex);
                }
            },
            {
                threshold: [0.25, 0.35, 0.5, 0.65, 0.8],
                rootMargin: '-64px 0px -20% 0px',
            },
        );

        panels.forEach((panel) => observer.observe(panel));
        return () => observer.disconnect();
    }, [isHoverDevice, activeHorizontalIndex]);

    const laneWidth = 100 / horizontalCategories.length;
    const activePanelRatio = isHoverDevice ? 0.84 : 0.88;
    const panelInsetRatio = isHoverDevice ? 0.0 : 0.02;
    const getPanelStyle = (index: number) => {
        const isActive = visibleHorizontalIndex != null && index === visibleHorizontalIndex;
        const laneStart = laneWidth * index;
        const panelWidth = laneWidth * activePanelRatio;
        const left = laneStart + laneWidth * panelInsetRatio;
        const hiddenLeft = laneStart + laneWidth * 0.5;
        const reveal = isActive ? 1 : 0;
        const opacity = isActive ? 1 : 0;

        return {
            '--h3-panel-left': `${(isActive ? left : hiddenLeft).toFixed(4)}%`,
            '--h3-panel-width': `${(isActive ? panelWidth : 0.0001).toFixed(4)}%`,
            '--h3-panel-reveal': String(reveal),
            '--h3-panel-opacity': String(opacity),
            '--h3-stack-order': String(index + 1),
        } as React.CSSProperties;
    };

    const onMoodTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const touch = e.touches[0];
        if (!touch) return;
        moodTouchStartXRef.current = touch.clientX;
        moodTouchStartYRef.current = touch.clientY;
    };

    const onMoodTouchEnd: React.TouchEventHandler<HTMLDivElement> = (e) => {
        const startX = moodTouchStartXRef.current;
        const startY = moodTouchStartYRef.current;
        const touch = e.changedTouches[0];

        moodTouchStartXRef.current = null;
        moodTouchStartYRef.current = null;

        if (!touch || startX == null || startY == null) return;
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

        setActiveHorizontalIndex((prev) => {
            if (deltaX < 0) return Math.min(prev + 1, horizontalCategories.length - 1);
            return Math.max(prev - 1, 0);
        });
    };

    return (
        <main className="h3-page">

            {/* ── HERO ──────────────────────────────────────────────── */}
            <section ref={heroSceneRef} className="h3-hero-scene">
                <div className="h3-hero-sticky">

                    {/* Background clipped independently so clouds can bleed below */}
                    <div className="h3-hero-bg-clip">
                        <div ref={heroBgRef} className="h3-hero-bg" />
                    </div>
                    <div className="h3-hero-vignette" />
                    <div className="h3-hero-grad-bottom" />

                    <div ref={heroContentRef} className="h3-hero-content">
                        <div className="container h3-hero-copy-shell">
                            <span className="h3-eyebrow-hero">Discover the World</span>
                            <h1 className="h3-hero-title">
                                <span className="h3-word-shell" style={{ '--wi': 0 } as React.CSSProperties}>
                                    <span className="h3-word">Step</span>
                                </span>
                                <span className="h3-word-shell h3-word-shell-gap" style={{ '--wi': 1 } as React.CSSProperties}>
                                    <span className="h3-word">outside</span>
                                </span>
                            </h1>
                            <p className="h3-hero-sub">
                                <span className="h3-sub-line" style={{ '--li': 0 } as React.CSSProperties}>
                                    Your greatest adventure is just one step away.
                                </span>
                                <span className="h3-sub-line" style={{ '--li': 1 } as React.CSSProperties}>
                                    We craft journeys that move you — body, mind, and soul.
                                </span>
                            </p>
                            <div className="h3-hero-actions">
                                <Link to="/auth" className="h3-btn-hero-primary">
                                    Explore Journeys <ArrowRight size={18} />
                                </Link>
                                <a href="#discover" className="h3-btn-hero-glass">
                                    Our Story
                                </a>
                            </div>
                        </div>
                    </div>

                    {/*
                      Cloud layers — two concerns kept separate:
                        • Wrapper div  → CSS entry animation (slide from left/right)
                        • img element  → JS scroll parallax (translateY at different speeds)
                    */}
                    <div className="h3-cloud-layer" aria-hidden="true">
                        {/* Back-centre — fades up first */}
                        <div className="h3-cloud-wrap h3-cloud-wrap-3">
                            <div className="h3-cloud-float h3-cloud-float-slow">
                                <img ref={cloud3Ref} src="/images/cloud-3.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        {/* Left side */}
                        <div className="h3-cloud-wrap h3-cloud-wrap-1">
                            <div className="h3-cloud-float h3-cloud-float-mid">
                                <img ref={cloud1Ref} src="/images/cloud-1.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        {/* Right side */}
                        <div className="h3-cloud-wrap h3-cloud-wrap-2">
                            <div className="h3-cloud-float h3-cloud-float-fast">
                                <img ref={cloud2Ref} src="/images/cloud-2.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        {/* Extra lower-middle density */}
                        <div className="h3-cloud-wrap h3-cloud-wrap-4">
                            <div className="h3-cloud-float h3-cloud-float-mid">
                                <img ref={cloud4Ref} src="/images/cloud-1.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        <div className="h3-cloud-wrap h3-cloud-wrap-5">
                            <div className="h3-cloud-float h3-cloud-float-slow">
                                <img ref={cloud5Ref} src="/images/cloud-2.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        <div className="h3-cloud-wrap h3-cloud-wrap-6">
                            <div className="h3-cloud-float h3-cloud-float-fast">
                                <img ref={cloud6Ref} src="/images/cloud-3.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        <div className="h3-cloud-wrap h3-cloud-wrap-7">
                            <div className="h3-cloud-float h3-cloud-float-mid">
                                <img ref={cloud7Ref} src="/images/cloud-1.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        <div className="h3-cloud-wrap h3-cloud-wrap-8">
                            <div className="h3-cloud-float h3-cloud-float-slow">
                                <img ref={cloud8Ref} src="/images/cloud-3.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        <div className="h3-cloud-wrap h3-cloud-wrap-9">
                            <div className="h3-cloud-float h3-cloud-float-mid">
                                <img ref={cloud9Ref} src="/images/cloud-2.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                        <div className="h3-cloud-wrap h3-cloud-wrap-10">
                            <div className="h3-cloud-float h3-cloud-float-fast">
                                <img ref={cloud10Ref} src="/images/cloud-3.png" alt="" className="h3-cloud" />
                            </div>
                        </div>
                    </div>

                    <div className="h3-scroll-hint">
                        <ChevronDown size={18} />
                        <span>Scroll to explore</span>
                    </div>
                </div>
            </section>

            {/* ── STATS + ABOUT ─────────────────────────────────────── */}
            <section id="discover" className="h3-section h3-discover-section">
                <div className="container">

                    <div className="h3-stats-row">
                        {stats.map((s, i) => (
                            <Reveal key={s.label} delay={i * 70} className="h3-stat-item">
                                <span className="h3-stat-value">{s.value}</span>
                                <span className="h3-stat-label">{s.label}</span>
                            </Reveal>
                        ))}
                    </div>

                    <Reveal className="h3-about-grid" delay={60}>
                        <div className="h3-about-text">
                            <span className="h3-section-eyebrow">Our Story</span>
                            <h2>Born from a love<br />of wandering.</h2>
                            <p>
                                We started as a group of five friends who couldn't find a travel company that matched
                                our thirst for authentic, transformative experiences. So we built one.
                            </p>
                            <p>
                                Today, Vagabond is India's most trusted adventure travel platform — connecting
                                wanderers to the world's most extraordinary places. Every journey we craft is a
                                story waiting to be lived.
                            </p>
                            <Link to="/auth" className="h3-text-link">
                                Join our community <ArrowRight size={16} />
                            </Link>
                        </div>
                        <div className="h3-about-visual">
                            <img src="/images/nature1.jpg" alt="North" />
                            <div className="h3-about-badge">
                                <Globe size={20} />
                                <span>200+ Destinations<br />across 6 continents</span>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── SERVICES ──────────────────────────────────────────── */}
            <section id="services" className="h3-section h3-services-section">
                <div className="container">
                    <Reveal className="h3-section-head">
                        <span className="h3-section-eyebrow">What We Offer</span>
                        <h2>Adventures crafted<br />for every soul.</h2>
                    </Reveal>

                    <div className="h3-services-grid">
                        {services.map((svc, i) => {
                            const Icon = svc.icon;
                            return (
                                <Reveal key={svc.title} delay={i * 85}>
                                    <article className="h3-service-card">
                                        {svc.tag && <span className="h3-service-badge">{svc.tag}</span>}
                                        <div className="h3-service-icon"><Icon size={20} /></div>
                                        <h3>{svc.title}</h3>
                                        <p>{svc.description}</p>
                                        <Link to="/auth" className="h3-text-link h3-text-link-sm">
                                            Learn more <ArrowRight size={14} />
                                        </Link>
                                    </article>
                                </Reveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── DESTINATIONS ──────────────────────────────────────── */}
            <section
                className="h3-mood-scene"
                style={{
                    '--h3-mood-bg': activeMood.themeColor,
                    '--h3-mood-ink': activeMood.accentColor,
                } as React.CSSProperties}
            >
                <div
                    className="h3-mood-sticky"
                    onTouchStart={onMoodTouchStart}
                    onTouchEnd={onMoodTouchEnd}
                    onMouseLeave={() => { if (isHoverDevice) setHoveredHorizontalIndex(null); }}
                >
                    <div className="h3-mood-grid">
                        {horizontalCategories.map((item, index) => (
                            <div
                                key={item.label}
                                className={`h3-mood-lane ${visibleHorizontalIndex === index ? 'is-active' : ''}`}
                                onMouseEnter={() => { if (isHoverDevice) setHoveredHorizontalIndex(index); }}
                                onClick={() => {
                                    setActiveHorizontalIndex(index);
                                    if (isHoverDevice) setHoveredHorizontalIndex(index);
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setActiveHorizontalIndex(index);
                                        if (isHoverDevice) setHoveredHorizontalIndex(index);
                                    }
                                }}
                            >
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="h3-mood-panels">
                        {horizontalCategories.map((item, index) => (
                            <article
                                key={`panel-${item.label}`}
                                className={`h3-mood-panel ${visibleHorizontalIndex === index ? 'is-active' : ''}`}
                                aria-hidden={visibleHorizontalIndex === index ? undefined : true}
                                data-panel-index={index}
                                ref={(el) => { moodPanelRefs.current[index] = el; }}
                                style={getPanelStyle(index)}
                            >
                                <video
                                    ref={(el) => { horizontalVideoRefs.current[index] = el; }}
                                    className="h3-mood-video"
                                    src={item.video}
                                    loop
                                    muted
                                    playsInline
                                    preload="auto"
                                />
                                <div className="h3-mood-panel-overlay" />
                                <div className="h3-mood-vertical">{item.verticalText}</div>
                                <div className="h3-mood-panel-body">
                                    <h3>{item.label} <ArrowRight size={16} /></h3>
                                    <p>{item.description}</p>
                                    <Link to="/auth" className="h3-btn-hero-primary h3-mood-cta">
                                        Explore {item.label}
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>

                    <div className="h3-mood-headline">
                        <h2>
                            Your Gateway
                            <br />
                            to {activeMood.title}
                        </h2>
                    </div>

                        <div className="h3-mood-topbar">
                        <div className="h3-mood-brand">
                            <span>The Better</span>
                            <span>Pass</span>
                        </div>
                        <div className="h3-mood-count" aria-label="Current panel">
                            <span>{String(moodThemeIndex + 1).padStart(2, '0')}</span>
                            <small>/{String(horizontalCategories.length).padStart(2, '0')}</small>
                        </div>
                    </div>
                </div>
            </section>

            <section className="h3-section h3-dest-section">
                <div className="container">
                    <Reveal className="h3-section-head h3-section-head-row">
                        <div>
                            <span className="h3-section-eyebrow">Featured Destinations</span>
                            <h2>Popular right now.</h2>
                        </div>
                        <Link to="/auth" className="h3-text-link">
                            View all <ArrowRight size={16} />
                        </Link>
                    </Reveal>

                    <div className="h3-dest-grid">
                        {destinations.map((d, i) => (
                            <Reveal key={d.name} delay={i * 100} className="h3-dest-wrap">
                                <article className="h3-dest-card">
                                    <div className="h3-dest-img-wrap">
                                        <img src={d.image} alt={d.name} style={{ objectPosition: d.imgPos }} />
                                        <div className="h3-dest-img-overlay" />
                                        <span className="h3-dest-tag">{d.tag}</span>
                                    </div>
                                    <div className="h3-dest-body">
                                        <div className="h3-dest-loc">
                                            <MapPin size={13} /> {d.country}
                                        </div>
                                        <h3>{d.name}</h3>
                                        <p>{d.description}</p>
                                        <div className="h3-dest-footer">
                                            <span className="h3-dest-price">{d.price}</span>
                                            <Link to="/auth" className="h3-btn-pill">
                                                Book now <ArrowRight size={13} />
                                            </Link>
                                        </div>
                                    </div>
                                </article>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── PARALLAX QUOTE STRIP ──────────────────────────────── */}
            <section className="h3-strip">
                <div ref={stripBgRef} className="h3-strip-bg" />
                <div className="h3-strip-overlay" />
                <Reveal className="h3-strip-content container">
                    <blockquote>
                        "The world is a book, and those who do not travel read only one page."
                    </blockquote>
                    <cite>— Saint Augustine</cite>
                    <Link to="/auth" className="h3-btn-ghost-white">
                        Start Your Chapter <ArrowRight size={16} />
                    </Link>
                </Reveal>
            </section>

            {/* ── TESTIMONIALS ──────────────────────────────────────── */}
            <section id="testimonials" className="h3-section h3-testimonials-section">
                <div className="container">
                    <Reveal className="h3-section-head">
                        <span className="h3-section-eyebrow">Traveler Stories</span>
                        <h2>What our wanderers say.</h2>
                    </Reveal>

                    <div className="h3-review-rails">
                        <Reveal>
                            <div className="h3-review-rail" role="region" aria-label="Traveler reviews moving left to right">
                                <div className="h3-review-track h3-review-track-upper">
                                    {[...testimonialUpperRow, ...testimonialUpperRow].map((t, i) => (
                                        <article
                                            key={`upper-${t.name}-${i}`}
                                            className="h3-testimonial-card"
                                            aria-hidden={i >= testimonialUpperRow.length || undefined}
                                        >
                                            <div className="h3-stars">
                                                {Array.from({ length: t.rating }).map((_, si) => (
                                                    <Star key={si} size={13} fill="currentColor" />
                                                ))}
                                            </div>
                                            <p className="h3-testimonial-quote">"{t.text}"</p>
                                            <div className="h3-testimonial-author">
                                                <div className="h3-avatar">{t.avatar}</div>
                                                <div>
                                                    <strong>{t.name}</strong>
                                                    <span>{t.location}</span>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </Reveal>

                        <Reveal delay={90}>
                            <div className="h3-review-rail" role="region" aria-label="Traveler reviews moving right to left">
                                <div className="h3-review-track h3-review-track-lower">
                                    {[...testimonialLowerRow, ...testimonialLowerRow].map((t, i) => (
                                        <article
                                            key={`lower-${t.name}-${i}`}
                                            className="h3-testimonial-card"
                                            aria-hidden={i >= testimonialLowerRow.length || undefined}
                                        >
                                            <div className="h3-stars">
                                                {Array.from({ length: t.rating }).map((_, si) => (
                                                    <Star key={si} size={13} fill="currentColor" />
                                                ))}
                                            </div>
                                            <p className="h3-testimonial-quote">"{t.text}"</p>
                                            <div className="h3-testimonial-author">
                                                <div className="h3-avatar">{t.avatar}</div>
                                                <div>
                                                    <strong>{t.name}</strong>
                                                    <span>{t.location}</span>
                                                </div>
                                            </div>
                                        </article>
                                    ))}
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ── CTA ───────────────────────────────────────────────── */}
            <section id="cta" className="h3-cta-section">
                <div ref={ctaBgRef} className="h3-cta-bg" />
                <div className="h3-cta-overlay" />
                <Reveal className="h3-cta-content container">
                    <span className="h3-section-eyebrow h3-eyebrow-muted">Begin Your Adventure</span>
                    <h2>Ready to step outside?</h2>
                    <p>
                        Join 15,000+ travelers who've discovered the world with Vagabond.
                        Your next extraordinary journey is waiting.
                    </p>
                    <div className="h3-cta-actions">
                        <Link to="/auth" className="h3-btn-cta-white">
                            Book Your Journey <ArrowRight size={18} />
                        </Link>
                        <Link to="/auth" className="h3-btn-hero-glass">
                            Join Membership
                        </Link>
                    </div>
                    <div className="h3-trust-row">
                        <div className="h3-trust-item"><Shield size={13} /><span>Secure Booking</span></div>
                        <div className="h3-trust-item"><Users size={13} /><span>15K+ Happy Travelers</span></div>
                        <div className="h3-trust-item"><Star size={13} fill="currentColor" /><span>4.9 / 5 Rating</span></div>
                    </div>
                </Reveal>
            </section>

        </main>
    );
};

