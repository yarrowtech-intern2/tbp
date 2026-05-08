import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    Compass,
    Loader2,
    MapPin,
    MoveRight,
    ShieldCheck,
    Sparkles,
    Stars,
} from 'lucide-react';
import { getActivities } from '../lib/destinations';
import type { Destination } from '../lib/destinations';
import './home2.css';

type ScrollRevealProps = {
    children: React.ReactNode;
    className?: string;
    delay?: number;
};

type InsightCard = {
    eyebrow: string;
    title: string;
    copy: string;
    image: string;
    link: string;
};

const ScrollReveal: React.FC<ScrollRevealProps> = ({ children, className = '', delay = 0 }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;

        if (!node) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.unobserve(node);
                }
            },
            {
                threshold: 0.16,
                rootMargin: '0px 0px -10% 0px',
            },
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`home2-reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
            style={{ '--delay': `${delay}ms` } as React.CSSProperties}
        >
            {children}
        </div>
    );
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 0,
    }).format(Math.round(value));

const getLocationLabel = (location?: string) => location?.split(',')[0]?.trim() || 'Curated destination';

const summarize = (text?: string, maxLength = 110) => {
    if (!text) {
        return 'A curated escape shaped to feel premium, clear, and immediate from the first glance.';
    }

    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength).trimEnd()}...`;
};

const MOOD_TABS = [
    { label: 'Desert',     description: 'Golden dunes, silence, and endless horizons.',          video: '/video/horizontal-sect/desert.mp4' },
    { label: 'Ocean',      description: 'Where the water meets your deepest need for calm.',      video: '/video/horizontal-sect/ocean.mp4' },
    { label: 'Mountains',  description: 'Peaks that put everything in perspective.',              video: '/video/horizontal-sect/mountain.mp4' },
    { label: 'Cityscapes', description: 'The electric pulse of worlds built by millions.',        video: '/video/horizontal-sect/cityscape.mp4' },
    { label: 'Forest',     description: 'Ancient canopies and the sound of stillness.',           video: '/video/horizontal-sect/forrest.mp4' },
];

const MOOD_SLOT = 180; // px: label width (140) + gap (40)

export const Home2: React.FC = () => {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [heroReady, setHeroReady] = useState(false);
    const heroSectionRef = useRef<HTMLElement | null>(null);
    const heroVideoRef = useRef<HTMLVideoElement | null>(null);
    const scrollFrameRef = useRef<number | null>(null);

    const [activeMoodTab, setActiveMoodTab] = useState(0);
    const [moodTabProgress, setMoodTabProgress] = useState(0);
    const moodSectionRef = useRef<HTMLElement | null>(null);
    const moodRafRef = useRef<number | null>(null);
    const moodVideoRefs = useRef<(HTMLVideoElement | null)[]>([]);

    useEffect(() => {
        let mounted = true;

        getActivities().then((data: Destination[]) => {
            if (!mounted) {
                return;
            }

            setDestinations(data);
            setLoading(false);
        });

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        const heroSection = heroSectionRef.current;
        const heroVideo = heroVideoRef.current;

        if (!heroSection || !heroVideo) {
            return;
        }

        let videoDuration = 0;
        let primed = false;

        const seekVideo = (time: number) => {
            const boundedTime = Math.min(Math.max(time, 0), Math.max(videoDuration - 0.05, 0));

            if (typeof heroVideo.fastSeek === 'function') {
                heroVideo.fastSeek(boundedTime);
                return;
            }

            heroVideo.currentTime = boundedTime;
        };

        const syncScrollScene = () => {
            const rect = heroSection.getBoundingClientRect();
            const travel = Math.max(rect.height - window.innerHeight, 1);
            const progress = Math.min(Math.max(-rect.top / travel, 0), 1);

            heroSection.style.setProperty('--hero-progress', progress.toFixed(4));

            if (videoDuration > 0 && primed) {
                const targetTime = progress * videoDuration;

                if (Math.abs(heroVideo.currentTime - targetTime) > 0.033) {
                    seekVideo(targetTime);
                }
            }

            scrollFrameRef.current = null;
        };

        const requestScrollSync = () => {
            if (scrollFrameRef.current === null) {
                scrollFrameRef.current = window.requestAnimationFrame(syncScrollScene);
            }
        };

        const primeVideo = async () => {
            if (primed) {
                return;
            }

            try {
                await heroVideo.play();
            } catch {
                // Ignore autoplay priming failures and fall back to direct seeks.
            } finally {
                heroVideo.pause();
                seekVideo(0);
                primed = true;
                setHeroReady(true);
                requestScrollSync();
            }
        };

        const handleMetadata = () => {
            videoDuration = heroVideo.duration || 0;
        };

        const handleLoadedData = () => {
            void primeVideo();
            requestScrollSync();
        };

        heroVideo.pause();
        heroVideo.addEventListener('loadedmetadata', handleMetadata);
        heroVideo.addEventListener('loadeddata', handleLoadedData);
        window.addEventListener('scroll', requestScrollSync, { passive: true });
        window.addEventListener('resize', requestScrollSync);

        heroVideo.load();
        requestScrollSync();

        return () => {
            heroVideo.removeEventListener('loadedmetadata', handleMetadata);
            heroVideo.removeEventListener('loadeddata', handleLoadedData);
            window.removeEventListener('scroll', requestScrollSync);
            window.removeEventListener('resize', requestScrollSync);

            if (scrollFrameRef.current !== null) {
                window.cancelAnimationFrame(scrollFrameRef.current);
            }
        };
    }, []);

    // Mood section scroll → horizontal tab switching
    useEffect(() => {
        const section = moodSectionRef.current;
        if (!section) return;

        const numTabs = MOOD_TABS.length;

        const syncMood = () => {
            const rect = section.getBoundingClientRect();
            const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
            const progress = Math.min(Math.max(-rect.top / travel, 0), 1);

            const tabFloat = progress * numTabs;
            const tabIndex = Math.min(Math.floor(tabFloat), numTabs - 1);
            const tabProg = tabFloat - tabIndex;

            setActiveMoodTab(tabIndex);
            setMoodTabProgress(tabIndex === numTabs - 1 ? 1 : tabProg);
            moodRafRef.current = null;
        };

        const onScroll = () => {
            if (moodRafRef.current === null) {
                moodRafRef.current = window.requestAnimationFrame(syncMood);
            }
        };

        window.addEventListener('scroll', onScroll, { passive: true });
        syncMood();

        return () => {
            window.removeEventListener('scroll', onScroll);
            if (moodRafRef.current !== null) window.cancelAnimationFrame(moodRafRef.current);
        };
    }, []);

    // Play only the active mood video
    useEffect(() => {
        moodVideoRefs.current.forEach((video, i) => {
            if (!video) return;
            if (i === activeMoodTab) {
                video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    }, [activeMoodTab]);

    const featuredDestinations = destinations.slice(0, 6);
    const heroDestination = featuredDestinations[0];
    const companionDestination = featuredDestinations[1];

    const categoryCount = new Set(destinations.map((destination) => destination.category).filter(Boolean)).size;
    const locationCount = new Set(destinations.map((destination) => getLocationLabel(destination.location))).size;
    const averagePrice =
        destinations.length > 0
            ? Math.round(destinations.reduce((sum, destination) => sum + destination.price, 0) / destinations.length)
            : 0;

    const reasonCards = [
        {
            icon: Sparkles,
            eyebrow: 'Curated journeys',
            title: loading ? 'Loading the collection.' : `${destinations.length}+ experiences across ${categoryCount} categories.`,
            copy: 'The content still comes from the current activity feed, but the page now surfaces it with cleaner pacing and stronger hierarchy.',
        },
        {
            icon: Compass,
            eyebrow: 'Destination spread',
            title: loading ? 'Loading destinations.' : `${locationCount} locations, easier to compare at a glance.`,
            copy: 'Large headings, quiet spacing, and wide cards make discovery feel more editorial and less crowded.',
        },
        {
            icon: ShieldCheck,
            eyebrow: 'Pricing clarity',
            title: loading ? 'Loading pricing.' : `Journeys starting around INR ${formatCurrency(averagePrice)}.`,
            copy: 'Users can qualify price, category, and location before opening a detail page, which keeps the flow calm and deliberate.',
        },
        {
            icon: Stars,
            eyebrow: 'Launch-page motion',
            title: 'Minimal animation, product-page rhythm.',
            copy: 'Scroll-triggered reveals, dark feature cards, and oversized section titles follow the iPhone website’s logic without copying it literally.',
        },
    ];

    const insightCards: InsightCard[] = featuredDestinations.slice(0, 4).map((destination) => ({
        eyebrow: destination.category || 'Featured',
        title: destination.title,
        copy: summarize(destination.description, 88),
        image: destination.image_url,
        link: `/listings/activity/${destination.id}`,
    }));

    const essentials = [
        {
            eyebrow: 'Activities',
            title: 'Curated activity drops.',
            copy: 'Browse the latest experiences with the same premium visual logic, faster scanning, and cleaner decision points.',
            action: 'Explore activities',
            link: '/activities',
            image: featuredDestinations[2]?.image_url || heroDestination?.image_url || '',
        },
        {
            eyebrow: 'Membership',
            title: 'Planning, saved in one place.',
            copy: 'Create an account to manage bookings, revisit destinations, and move through the travel flow with less friction.',
            action: 'Join membership',
            link: '/auth',
            image: featuredDestinations[3]?.image_url || companionDestination?.image_url || heroDestination?.image_url || '',
        },
    ];

    const heroLabel = heroDestination?.category || 'Immersive hero';
    const heroLocation = getLocationLabel(heroDestination?.location);

    return (
        <main className="home2-page">
            <section ref={heroSectionRef} className="home2-immersive-hero">
                <div className="home2-immersive-sticky">
                    <div className="home2-hero-media">
                        <video
                            ref={heroVideoRef}
                            className="home2-hero-video"
                            src="/video/3.mp4"
                            muted
                            playsInline
                            disablePictureInPicture
                            preload="auto"
                        />
                        {!heroReady && (
                            <div className="home2-hero-loading">
                                <Loader2 className="animate-spin" size={28} />
                                <span>Preparing immersive reel</span>
                            </div>
                        )}
                        <div className="home2-hero-video-glow" />
                        <div className="home2-hero-vignette" />
                        <div className="home2-hero-noise" />
                    </div>

                    <div className="container home2-immersive-shell">
                        <div className="home2-immersive-copy">
                            <span className="home2-mini-label home2-immersive-label">{heroLabel}</span>
                            <h1>Travel that moves as you do.</h1>
                            <p>
                                Scroll through an immersive Vagabond reel built for depth, motion, and premium pacing.
                                Video, title, subtitle, and actions all respond together before the page opens into the
                                next section.
                            </p>

                            <div className="home2-immersive-actions">
                                <Link to="/activities" className="home2-cta-dark">
                                    Explore activities
                                    <ArrowRight size={18} />
                                </Link>
                                <Link to="/tours" className="home2-cta-glass">
                                    Browse tours
                                    <MoveRight size={18} />
                                </Link>
                            </div>

                            <div className="home2-immersive-meta-block">
                                {loading ? (
                                    <div className="home2-loading-block home2-loading-block-compact">
                                        <Loader2 className="animate-spin" size={22} />
                                    </div>
                                ) : (
                                    <>
                                        <span className="home2-card-eyebrow home2-immersive-meta-label">Now playing</span>
                                        <div className="home2-immersive-meta-inline">
                                            <strong>{heroDestination?.title || 'Featured journey'}</strong>
                                            <span>
                                                <MapPin size={14} />
                                                {heroLocation}
                                            </span>
                                            {heroDestination?.price ? <span>INR {formatCurrency(heroDestination.price)}</span> : null}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="home2-immersive-indicator">
                            <span className="home2-immersive-indicator-line" />
                            <span>Scroll to reveal the page</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Curated Mood: scroll-driven horizontal tabs ── */}
            <section
                ref={moodSectionRef}
                className="home2-mood-section"
                style={{ '--mood-tabs': MOOD_TABS.length } as React.CSSProperties}
            >
                <div className="home2-mood-sticky">
                    {/* Videos — all rendered, only active one plays / is visible */}
                    <div className="home2-mood-videos">
                        {MOOD_TABS.map((tab, i) => (
                            <video
                                key={tab.label}
                                ref={(el) => { moodVideoRefs.current[i] = el; }}
                                className={`home2-mood-video${i === activeMoodTab ? ' is-active' : ''}`}
                                src={tab.video}
                                muted
                                playsInline
                                loop
                                disablePictureInPicture
                                preload="auto"
                            />
                        ))}
                    </div>

                    {/* Overlays */}
                    <div className="home2-mood-vignette" />
                    <div className="home2-mood-noise" />

                    {/* Content — changes per tab */}
                    <div className="home2-mood-content" key={activeMoodTab}>
                        <span className="home2-mini-label home2-mood-eyebrow">Curated Mood</span>
                        <h2 className="home2-mood-title">{MOOD_TABS[activeMoodTab].label}</h2>
                        <p className="home2-mood-desc">{MOOD_TABS[activeMoodTab].description}</p>
                    </div>

                    {/* Horizontal tab bar */}
                    <div className="home2-mood-tabbar-outer">
                        <div
                            className="home2-mood-tab-track"
                            style={{
                                transform: `translateX(calc(50vw - ${activeMoodTab * MOOD_SLOT + MOOD_SLOT / 2}px))`,
                            }}
                        >
                            {MOOD_TABS.map((tab, i) => (
                                <div
                                    key={tab.label}
                                    className={`home2-mood-tab${i === activeMoodTab ? ' is-active' : ''}`}
                                >
                                    <span className="home2-mood-tab-label">{tab.label}</span>
                                    <div
                                        className="home2-mood-tab-bar"
                                        style={
                                            i === activeMoodTab
                                                ? ({ '--prog': moodTabProgress } as React.CSSProperties)
                                                : i < activeMoodTab
                                                ? ({ '--prog': 1 } as React.CSSProperties)
                                                : ({ '--prog': 0 } as React.CSSProperties)
                                        }
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scroll hint (first tab only) */}
                    {activeMoodTab === 0 && moodTabProgress < 0.15 && (
                        <div className="home2-mood-scroll-hint">
                            <span className="home2-mood-scroll-line" />
                            <span>Scroll to explore moods</span>
                        </div>
                    )}
                </div>
            </section>

            <section className="home2-section">
                <div className="container">
                    <ScrollReveal className="home2-heading-block">
                        <h2>Take a closer look.</h2>
                    </ScrollReveal>

                    <ScrollReveal delay={80}>
                        <div className="home2-film-card">
                            {loading ? (
                                <div className="home2-loading-block">
                                    <Loader2 className="animate-spin" size={30} />
                                    <span>Loading featured story</span>
                                </div>
                            ) : heroDestination ? (
                                <>
                                    <div className="home2-film-copy">
                                        <span className="home2-card-eyebrow">Featured film</span>
                                        <h3>
                                            A guided tour of {heroDestination.title} and the journeys around it.
                                        </h3>
                                        <p>{summarize(heroDestination.description, 150)}</p>

                                        <div className="home2-film-actions">
                                            <Link to={`/listings/activity/${heroDestination.id}`} className="home2-cta-dark">
                                                Start exploring
                                                <ArrowRight size={18} />
                                            </Link>
                                            <div className="home2-film-meta">
                                                <span>
                                                    <MapPin size={14} />
                                                    {getLocationLabel(heroDestination.location)}
                                                </span>
                                                <span>{heroDestination.category}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="home2-film-visual">
                                        <div className="home2-film-visual-gradient" />
                                        <img src={heroDestination.image_url} alt={heroDestination.title} />
                                    </div>
                                </>
                            ) : (
                                <div className="home2-empty-panel">
                                    <p>No featured activity is available yet.</p>
                                </div>
                            )}
                        </div>
                    </ScrollReveal>
                </div>
            </section>

            <section className="home2-section">
                <div className="container">
                    <ScrollReveal className="home2-heading-row">
                        <h2>Why Vagabond is the best place to start your next trip.</h2>
                        <Link to="/activities" className="home2-text-link">
                            Explore all journeys
                            <MoveRight size={18} />
                        </Link>
                    </ScrollReveal>

                    <div className="home2-reasons-grid">
                        {reasonCards.map((card, index) => {
                            const Icon = card.icon;

                            return (
                                <ScrollReveal key={card.title} delay={index * 80}>
                                    <article className="home2-reason-card">
                                        <div className="home2-reason-icon">
                                            <Icon size={18} />
                                        </div>
                                        <span className="home2-card-eyebrow">{card.eyebrow}</span>
                                        <h3>{card.title}</h3>
                                        <p>{card.copy}</p>
                                    </article>
                                </ScrollReveal>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="home2-section">
                <div className="container">
                    <ScrollReveal className="home2-heading-block">
                        <h2>Get to know the collection.</h2>
                    </ScrollReveal>

                    {loading ? (
                        <div className="home2-rail home2-rail-loading">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="home2-rail-skeleton" />
                            ))}
                        </div>
                    ) : insightCards.length > 0 ? (
                        <div className="home2-rail">
                            {insightCards.map((card, index) => (
                                <ScrollReveal key={card.title} className="home2-rail-wrap" delay={index * 90}>
                                    <Link to={card.link} className="home2-rail-card">
                                        <img src={card.image} alt={card.title} />
                                        <div className="home2-rail-overlay" />
                                        <div className="home2-rail-content">
                                            <span className="home2-rail-eyebrow">{card.eyebrow}</span>
                                            <h3>{card.title}</h3>
                                            <p>{card.copy}</p>
                                            <span className="home2-circle-action">
                                                <ArrowRight size={18} />
                                            </span>
                                        </div>
                                    </Link>
                                </ScrollReveal>
                            ))}
                        </div>
                    ) : (
                        <div className="home2-empty-panel">
                            <p>No activity cards are available yet.</p>
                        </div>
                    )}
                </div>
            </section>

            <section className="home2-section">
                <div className="container">
                    <ScrollReveal className="home2-heading-row">
                        <h2>Journey essentials.</h2>
                        <Link to="/activities" className="home2-text-link">
                            All activities
                            <MoveRight size={18} />
                        </Link>
                    </ScrollReveal>

                    <div className="home2-essentials-grid">
                        {essentials.map((item, index) => (
                            <ScrollReveal key={item.title} delay={index * 100}>
                                <Link to={item.link} className="home2-essential-card">
                                    <div className="home2-essential-copy">
                                        <span className="home2-card-eyebrow">{item.eyebrow}</span>
                                        <h3>{item.title}</h3>
                                        <p>{item.copy}</p>
                                        <span className="home2-text-link home2-text-link-inline">
                                            {item.action}
                                            <ArrowRight size={18} />
                                        </span>
                                    </div>

                                    <div className="home2-essential-media">
                                        {item.image ? (
                                            <img src={item.image} alt={item.title} />
                                        ) : (
                                            <div className="home2-loading-block">
                                                <Loader2 className="animate-spin" size={28} />
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            </ScrollReveal>
                        ))}
                    </div>
                </div>
            </section>

            <section className="home2-section">
                <div className="container">
                    <ScrollReveal className="home2-heading-block">
                        <h2>Significant others.</h2>
                    </ScrollReveal>

                    <div className="home2-cta-grid">
                        <ScrollReveal>
                            <article className="home2-cta-panel home2-cta-panel-dark">
                                <span className="home2-card-eyebrow">Tours</span>
                                <h3>Longer itineraries with the same premium browse experience.</h3>
                                <p>
                                    The same visual system can extend into tours, curated edits, and featured campaigns
                                    without breaking the current API-driven structure.
                                </p>
                                <Link to="/tours" className="home2-cta-dark">
                                    Browse tours
                                    <ArrowRight size={18} />
                                </Link>
                            </article>
                        </ScrollReveal>

                        <ScrollReveal delay={100}>
                            <article className="home2-cta-panel">
                                <span className="home2-card-eyebrow">Compare views</span>
                                <h3>This version keeps the data model and changes the presentation system.</h3>
                                <p>
                                    You can review the existing home and this Apple-style direction side by side before
                                    deciding whether `/home2` should replace the current root route.
                                </p>
                                <Link to="/" className="home2-text-link home2-text-link-inline">
                                    View current home
                                    <MoveRight size={18} />
                                </Link>
                            </article>
                        </ScrollReveal>
                    </div>
                </div>
            </section>
        </main>
    );
};







