import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Compass,
    Heart,
    Loader2,
    MapPin,
    Search,
    Sparkles,
    Ticket,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
    addListingFavorite,
    getBookings,
    getPublicListingsByType,
    isListingFavorited,
    removeListingFavorite,
    type PostRecord,
    type UnifiedBooking,
} from '../lib/destinations';
import type { ListingType } from '../lib/platform';
import { isProviderRole, normalizeRoleValue } from '../lib/platform';
import { onBookingSync } from '../lib/bookingSync';
import './dashboard-home.css';
import '../components/listing-card.css';

type RevealProps = { children: React.ReactNode; className?: string; delay?: number };

const Reveal: React.FC<RevealProps> = ({ children, className = '', delay = 0 }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;

        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    obs.unobserve(node);
                }
            },
            { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
        );

        obs.observe(node);
        return () => obs.disconnect();
    }, []);

    return (
        <div
            ref={ref}
            className={`dh-reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
            style={{ '--delay': `${delay}ms` } as React.CSSProperties}
        >
            {children}
        </div>
    );
};

type SectionTab = 'tours' | 'activities' | 'events';
type GreetingPhase = 'morning' | 'afternoon' | 'night';
type GreetingAudience = 'tourist' | 'provider';

type TabConfig = {
    id: SectionTab;
    label: string;
    icon: LucideIcon;
    helper: string;
};

const TAB_CONFIG: TabConfig[] = [
    { id: 'tours', label: 'Tours', icon: Compass, helper: 'Multi-day plans' },
    { id: 'activities', label: 'Activities', icon: Sparkles, helper: 'One-day moments' },
    { id: 'events', label: 'Events', icon: Ticket, helper: 'Live experiences' },
];

const GREETING_COPY: Record<GreetingAudience, Record<GreetingPhase, string[]>> = {
    tourist: {
        morning: [
            'Let us build a travel plan for today.',
            'Ready to map your next getaway?',
            'Morning is perfect for planning your next trip.',
            'Pick a destination and start your adventure.',
        ],
        afternoon: [
            'Let us shape your next travel plan.',
            'Got time for a quick trip plan today?',
            'Your next tour is a few taps away.',
            'Plan now, travel smoother later.',
        ],
        night: [
            'Wind down by planning your next escape.',
            'Tonight is great for your next travel plan.',
            'Browse now and lock in your next journey.',
            'Dream destination? Let us plan it tonight.',
        ],
    },
    provider: {
        morning: [
            'Ready to post a new tour package?',
            'Start the day by publishing a fresh listing.',
            'Morning momentum: add your next package.',
            'Update your catalog and reach new travelers.',
        ],
        afternoon: [
            'Up for posting a new tour package?',
            'Afternoon push: publish a new listing now.',
            'Add a new package while demand is active.',
            'Refresh your offerings with a new post.',
        ],
        night: [
            'Close the day by posting a new package.',
            'Night shift: prep tomorrow with a new listing.',
            'Publish tonight, capture bookings tomorrow.',
            'One more listing can boost tomorrow leads.',
        ],
    },
};

const getGreetingPhase = (): GreetingPhase => {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'night';
};

const getGreetingHeading = (phase: GreetingPhase): string => {
    if (phase === 'morning') return 'Good Morning';
    if (phase === 'afternoon') return 'Good Afternoon';
    return 'Good Evening';
};

const pickRandom = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const getPostImage = (post: PostRecord): string | undefined => {
    const candidate = post.image_url || post.cover_image_url || post.thumbnail_url;
    return typeof candidate === 'string' ? candidate : undefined;
};

const getPostTitle = (post: PostRecord): string => {
    const candidate = post.title || post.name;
    return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : 'Untitled listing';
};

const getPostSubtitle = (post: PostRecord): string => {
    if (typeof post.description === 'string' && post.description.trim().length > 0) {
        return post.description.trim().slice(0, 90);
    }
    if (typeof post.location === 'string' && post.location.trim().length > 0) {
        return post.location.trim();
    }
    return 'Curated experience with guided details.';
};

const getPostType = (post: PostRecord): SectionTab => {
    if (post.type === 'tour') return 'tours';
    if (post.type === 'guide' || post.type === 'event') return 'events';
    return 'activities';
};

const toListingTypePath = (tab: SectionTab): 'tour' | 'activity' | 'event' => {
    if (tab === 'tours') return 'tour';
    if (tab === 'events') return 'event';
    return 'activity';
};

const toListingTypeValue = (tab: SectionTab): ListingType => {
    if (tab === 'tours') return 'tour';
    if (tab === 'events') return 'guide';
    return 'activity';
};

const formatPrice = (price: number | null | undefined): string => {
    if (typeof price !== 'number' || Number.isNaN(price) || price <= 0) {
        return 'Price on request';
    }
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(price);
};

const formatStartDate = (startsAt: string | undefined): string | null => {
    if (!startsAt) return null;
    const parsed = new Date(startsAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const getSectionHelper = (section: SectionTab): string => {
    if (section === 'tours') return 'Signature routes with curated itineraries.';
    if (section === 'activities') return 'Short experiences for flexible schedules.';
    return 'Upcoming hosted moments you can lock quickly.';
};

const getToneClass = (section: SectionTab): string => `dh-tone-${section}`;

const ListingCard: React.FC<{ post: PostRecord; isBooked: boolean }> = ({ post, isBooked }) => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const canFavorite = profile?.role === 'tourist';
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);

    const image = getPostImage(post);
    const title = getPostTitle(post);
    const subtitle = getPostSubtitle(post);
    const type = getPostType(post);
    const listingTypePath = toListingTypePath(type);
    const listingTypeValue = toListingTypeValue(type);
    const location = typeof post.location === 'string' && post.location.trim().length > 0
        ? post.location.trim()
        : 'Location shared after booking';
    const startsAt = formatStartDate(typeof post.starts_at === 'string' ? post.starts_at : undefined);
    const priceLabel = formatPrice(post.price);
    const chipLabel = post.sub_category && post.sub_category.trim().length > 0
        ? post.sub_category.trim()
        : type.slice(0, -1).toUpperCase();

    useEffect(() => {
        if (!user || !post.id || !canFavorite) {
            setIsFavorite(false);
            return;
        }

        const loadFavorite = async () => {
            const favorited = await isListingFavorited(user.id, post.id, listingTypeValue);
            setIsFavorite(favorited);
        };

        void loadFavorite();
    }, [canFavorite, listingTypeValue, post.id, user]);

    const handleFavoriteToggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        if (!user) {
            navigate('/auth');
            return;
        }

        if (!canFavorite) {
            alert('Only tourist accounts can save favorites.');
            return;
        }

        setFavoriteLoading(true);
        try {
            if (isFavorite) {
                await removeListingFavorite(user.id, post.id, listingTypeValue);
                setIsFavorite(false);
            } else {
                await addListingFavorite(user.id, post.id, listingTypeValue);
                setIsFavorite(true);
            }
        } catch (error) {
            console.error('Favorite update failed:', error);
            alert('Could not update favorites. Please try again.');
        } finally {
            setFavoriteLoading(false);
        }
    };

    const openListing = () => navigate(`/listings/${listingTypePath}/${post.id}`);

    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openListing();
        }
    };

    return (
        <article
            className={`listing-card dh-tone-${type}${isBooked ? ' is-booked' : ''}`}
            role="link"
            tabIndex={0}
            onClick={openListing}
            onKeyDown={handleCardKeyDown}
            aria-label={`Open ${title}`}
        >
            <div className={`listing-card-media${image ? '' : ' is-fallback'}`}>
                <div
                    className="listing-card-media-bg"
                    style={image ? { backgroundImage: `url(${image})` } : undefined}
                />
                <div className="listing-card-media-overlay" />
                <div className="listing-card-media-top">
                    <span className="listing-card-chip">{chipLabel}</span>
                    {isBooked && <span className="listing-card-booked-pill">Booked</span>}
                    <button
                        type="button"
                        className={`listing-card-fav-btn${isFavorite ? ' is-active' : ''}`}
                        onClick={handleFavoriteToggle}
                        disabled={favoriteLoading || !canFavorite}
                        title={canFavorite ? undefined : 'Only tourist accounts can save favorites'}
                    >
                        {favoriteLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                        )}
                    </button>
                </div>

                {!image && (
                    <div className="listing-card-fallback-text" aria-hidden="true">
                        {title.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="listing-card-title-static-wrap">
                    <h3 className="listing-card-title-static">{title}</h3>
                </div>

                <div className="listing-card-reveal-panel">
                    <p className="listing-card-sub">{subtitle}</p>

                    <div className="listing-card-meta">
                        <span className="listing-card-meta-item">
                            <MapPin size={14} />
                            <span>{location}</span>
                        </span>
                        {startsAt && (
                            <span className="listing-card-meta-item">
                                <CalendarDays size={14} />
                                <span>{startsAt}</span>
                            </span>
                        )}
                    </div>

                    <div className="listing-card-actions">
                        <span className="listing-card-price">{priceLabel}</span>
                        {isBooked ? (
                            <span className="listing-btn-booked">Booked</span>
                        ) : (
                            <Link
                                to={`/listings/${listingTypePath}/${post.id}`}
                                className="listing-btn-book"
                                onClick={(event) => event.stopPropagation()}
                            >
                                Book Now
                            </Link>
                        )}
                    </div>
                </div>
            </div>
            <div className="listing-card-mobile-content">
                <h3 className="listing-card-title">{title}</h3>
                <p className="listing-card-sub">{subtitle}</p>

                <div className="listing-card-meta">
                    <span className="listing-card-meta-item">
                        <MapPin size={14} />
                        <span>{location}</span>
                    </span>
                    {startsAt && (
                        <span className="listing-card-meta-item">
                            <CalendarDays size={14} />
                            <span>{startsAt}</span>
                        </span>
                    )}
                </div>

                <div className="listing-card-actions">
                    <span className="listing-card-price">{priceLabel}</span>
                    {isBooked ? (
                        <span className="listing-btn-booked">Booked</span>
                    ) : (
                        <Link to={`/listings/${listingTypePath}/${post.id}`} className="listing-btn-book" onClick={(event) => event.stopPropagation()}>
                            Book Now
                        </Link>
                    )}
                </div>
            </div>
        </article>
    );
};

const CarouselRow: React.FC<{
    posts: PostRecord[];
    expanded: boolean;
    bookedLookup: {
        byTypeAndId: Set<string>;
        byId: Set<string>;
    };
    indexOffset?: number;
}> = ({ posts, expanded, bookedLookup, indexOffset = 0 }) => {
    const rowRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    useEffect(() => {
        const el = rowRef.current;
        if (!el) return;

        const check = () => {
            if (expanded) {
                setCanScrollLeft(false);
                setCanScrollRight(false);
                return;
            }
            setCanScrollLeft(el.scrollLeft > 4);
            setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
        };

        check();
        el.addEventListener('scroll', check, { passive: true });
        window.addEventListener('resize', check, { passive: true });
        return () => {
            el.removeEventListener('scroll', check);
            window.removeEventListener('resize', check);
        };
    }, [expanded, posts.length]);

    const scroll = (dir: 'left' | 'right') => {
        const el = rowRef.current;
        if (!el) return;
        el.scrollBy({
            left: dir === 'right' ? el.clientWidth * 0.8 : -(el.clientWidth * 0.8),
            behavior: 'smooth',
        });
    };

    return (
        <div className="dh-carousel-wrap">
            {canScrollLeft && (
                <button
                    type="button"
                    className="dh-carousel-arrow dh-carousel-arrow--left"
                    onClick={() => scroll('left')}
                    aria-label="Scroll left"
                >
                    <ChevronLeft size={18} />
                </button>
            )}
            <div
                ref={rowRef}
                className={`dh-listing-row${expanded ? ' dh-listing-row--expanded' : ''}`}
            >
                {posts.map((post, i) => (
                    <Reveal key={post.id} delay={indexOffset * 100 + (i + 1) * 60}>
                        <ListingCard
                            post={post}
                            isBooked={
                                bookedLookup.byTypeAndId.has(`${toListingTypeValue(getPostType(post))}:${String(post.id).trim()}`)
                                || bookedLookup.byId.has(String(post.id).trim())
                            }
                        />
                    </Reveal>
                ))}
            </div>
            {canScrollRight && (
                <button
                    type="button"
                    className="dh-carousel-arrow dh-carousel-arrow--right"
                    onClick={() => scroll('right')}
                    aria-label="Scroll right"
                >
                    <ChevronRight size={18} />
                </button>
            )}
        </div>
    );
};

const Section: React.FC<{
    section: SectionTab;
    title: string;
    posts: PostRecord[];
    bookedLookup: {
        byTypeAndId: Set<string>;
        byId: Set<string>;
    };
    indexOffset: number;
}> = ({ section, title, posts, bookedLookup, indexOffset }) => {
    const [expanded, setExpanded] = useState(false);
    const postsToShow = expanded ? posts : posts.slice(0, 8);

    return (
        <section className={`dh-listing-section ${getToneClass(section)}`}>
            <Reveal delay={indexOffset * 100}>
                <div className="dh-section-header">
                    <div className="dh-section-heading">
                        <h2 className="dh-listing-section-title">{title}</h2>
                        <p className="dh-listing-section-sub">{getSectionHelper(section)}</p>
                    </div>
                    {posts.length > 4 && (
                        <button
                            type="button"
                            className="dh-more-link"
                            onClick={() => setExpanded((e) => !e)}
                        >
                            {expanded ? 'Less' : 'More'}
                        </button>
                    )}
                </div>
            </Reveal>

            {posts.length > 0 ? (
                <CarouselRow posts={postsToShow} expanded={expanded} bookedLookup={bookedLookup} indexOffset={indexOffset} />
            ) : (
                <Reveal delay={indexOffset * 100 + 80}>
                    <p className="dh-empty-text">No {title.toLowerCase()} available yet.</p>
                </Reveal>
            )}
        </section>
    );
};

const SuggestedSection: React.FC<{
    posts: PostRecord[];
    bookedLookup: {
        byTypeAndId: Set<string>;
        byId: Set<string>;
    };
}> = ({ posts, bookedLookup }) => {
    if (posts.length === 0) return null;

    return (
        <section className="dh-suggested-section">
            <div className="dh-section-header">
                <div className="dh-section-heading">
                    <h2 className="dh-listing-section-title dh-suggested-title">
                        <Sparkles size={16} />
                        Suggested for You
                    </h2>
                    <p className="dh-listing-section-sub">Picked based on your activity</p>
                </div>
            </div>
            <CarouselRow posts={posts} expanded={false} bookedLookup={bookedLookup} indexOffset={0} />
        </section>
    );
};

export const DashboardHome: React.FC = () => {
    const { user, profile, isProvider, isAdmin, roleLabel } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [tourPosts, setTourPosts] = useState<PostRecord[]>([]);
    const [activityPosts, setActivityPosts] = useState<PostRecord[]>([]);
    const [eventPosts, setEventPosts] = useState<PostRecord[]>([]);
    const [suggestedPosts, setSuggestedPosts] = useState<PostRecord[]>([]);
    const [touristBookings, setTouristBookings] = useState<UnifiedBooking[]>([]);

    const activeTab = useMemo<SectionTab | null>(() => {
        const tab = searchParams.get('tab');
        if (tab === 'tours' || tab === 'activities' || tab === 'events') return tab;
        if (tab === 'guides') return 'events';
        return null;
    }, [searchParams]);

    const resolvedRole = typeof profile?.role === 'string' && profile.role.trim()
        ? normalizeRoleValue(profile.role)
        : typeof user?.user_metadata?.role === 'string' && user.user_metadata.role.trim()
            ? normalizeRoleValue(user.user_metadata.role)
            : null;
    const providerAccount = isProvider || isProviderRole(resolvedRole) || resolvedRole === 'provider' || resolvedRole === 'vendor';
    const providerByLabel = roleLabel.trim().toLowerCase() === 'tour company'
        || roleLabel.trim().toLowerCase() === 'tour instructor'
        || roleLabel.trim().toLowerCase() === 'tour guide'
        || roleLabel.trim().toLowerCase() === 'provider'
        || roleLabel.trim().toLowerCase() === 'vendor';
    const adminAccount = isAdmin || resolvedRole === 'admin';

    const greetingPhase = useMemo(() => getGreetingPhase(), []);
    const greeting = useMemo(() => getGreetingHeading(greetingPhase), [greetingPhase]);
    const providerView = providerAccount;
    const greetingAudience: GreetingAudience = providerView ? 'provider' : 'tourist';
    const greetingSub = useMemo(
        () => pickRandom(GREETING_COPY[greetingAudience][greetingPhase]),
        [greetingAudience, greetingPhase],
    );
    const name = profile?.full_name || user?.email?.split('@')[0] || 'Explorer';
    const searchQueryNormalized = searchQuery.trim().toLowerCase();

    const filterPosts = (posts: PostRecord[]): PostRecord[] => {
        if (!searchQueryNormalized) return posts;
        return posts.filter((post) => {
            const title = getPostTitle(post).toLowerCase();
            const subtitle = getPostSubtitle(post).toLowerCase();
            const location = typeof post.location === 'string' ? post.location.toLowerCase() : '';
            return title.includes(searchQueryNormalized)
                || subtitle.includes(searchQueryNormalized)
                || location.includes(searchQueryNormalized);
        });
    };

    const filteredTourPosts = useMemo(() => filterPosts(tourPosts), [tourPosts, searchQueryNormalized]);
    const filteredActivityPosts = useMemo(() => filterPosts(activityPosts), [activityPosts, searchQueryNormalized]);
    const filteredEventPosts = useMemo(() => filterPosts(eventPosts), [eventPosts, searchQueryNormalized]);

    const totalListings = filteredTourPosts.length + filteredActivityPosts.length + filteredEventPosts.length;
    const activeTabText = activeTab ? `Showing ${activeTab}. Tap again to reset.` : 'Showing all categories.';
    const primaryTabCount = activeTab
        ? activeTab === 'tours'
            ? filteredTourPosts.length
            : activeTab === 'activities'
                ? filteredActivityPosts.length
                : filteredEventPosts.length
        : totalListings;
    const tabSummary = `${primaryTabCount} option${primaryTabCount === 1 ? '' : 's'} live`;
    const searchPlaceholder = activeTab === 'events'
        ? 'Search Events'
        : activeTab === 'activities'
            ? 'Search Activities'
            : 'Search Tours';

    const bookedLookup = useMemo(() => {
        const byTypeAndId = new Set<string>();
        const byId = new Set<string>();
        touristBookings.forEach((booking) => {
            const status = (booking.status || '').toLowerCase();
            if (status === 'cancelled' || status === 'canceled') return;

            const listingId = String(booking.listing_id || '').trim();
            if (!listingId) return;

            byId.add(listingId);
            byTypeAndId.add(`${booking.listing_type}:${listingId}`);
        });

        return { byTypeAndId, byId };
    }, [touristBookings]);

    useEffect(() => {
        if (!user) return;

        const load = async () => {
            setLoading(true);
            try {
                const [tours, activities, events, bookings] = await Promise.all([
                    getPublicListingsByType('tour'),
                    getPublicListingsByType('activity'),
                    getPublicListingsByType('guide'),
                    getBookings(user.id),
                ]);

                setTourPosts(tours);
                setActivityPosts(activities);
                setEventPosts(events);
                setTouristBookings(bookings);

                const all = [...tours, ...activities, ...events];
                const shuffled = [...all].sort(() => Math.random() - 0.5);
                setSuggestedPosts(shuffled.slice(0, 8));
            } catch (error) {
                console.error('Dashboard load error:', error);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, [user]);

    useEffect(() => {
        if (!user) return;
        const unsubscribe = onBookingSync(() => {
            void getBookings(user.id).then((rows) => setTouristBookings(rows)).catch(() => undefined);
        });
        return unsubscribe;
    }, [user]);

    if (!user) return null;
    if (providerAccount || providerByLabel || adminAccount) return <Navigate to={(providerAccount || providerByLabel) ? '/dashboard/provider' : '/dashboard/admin'} replace />;

    const showAll = activeTab === null;
    const showTours = showAll || activeTab === 'tours';
    const showActivities = showAll || activeTab === 'activities';
    const showEvents = showAll || activeTab === 'events';

    let sectionIndexOffset = 0;

    const handleTab = (tab: SectionTab) => {
        if (activeTab === tab) {
            setSearchParams({});
        } else {
            setSearchParams({ tab });
        }
    };

    return (
        <main className="dh-page">
            <div className="container dh-shell">
                <Reveal delay={0}>
                    <section className="dh-top-panel">
                        <div className="dh-search-wrap">
                            <label className="dh-search" aria-label="Search listings">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder={searchPlaceholder}
                                />
                                <button type="button" aria-label="Search">
                                    <Search size={20} />
                                </button>
                            </label>
                        </div>

                        <div className="dh-greeting">
                            <p className="dh-greeting-kicker">Travel Workspace</p>
                            <h1 className="dh-greeting-title">{greeting}</h1>
                            <p className="dh-greeting-name">{name}</p>
                            <p className="dh-greeting-sub">{greetingSub}</p>
                        </div>

                        {providerView && (
                            <div className="dh-provider-cta-row">
                                <Link to="/provider/studio" className="dh-provider-cta-primary">
                                    Post Tours, Activities, Events
                                </Link>
                                <Link to="/provider/studio" className="dh-provider-cta-secondary">
                                    Open Provider Studio
                                </Link>
                            </div>
                        )}
                    </section>
                </Reveal>

                {!loading && suggestedPosts.length > 0 && (
                    <Reveal delay={140}>
                        <SuggestedSection posts={suggestedPosts} bookedLookup={bookedLookup} />
                    </Reveal>
                )}

                <Reveal delay={150}>
                    <div className="dh-tab-strip-wrapper">
                        <div className="dh-tab-strip-head">
                            <p className="dh-tab-strip-status">{activeTabText}</p>
                            <p className="dh-tab-strip-count">{tabSummary}</p>
                        </div>

                        <div className="dh-tab-strip" role="tablist" aria-label="Content filter">
                            {TAB_CONFIG.map((tab) => {
                                const Icon = tab.icon;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={activeTab === tab.id}
                                        className={`dh-tab-pill ${getToneClass(tab.id)}${activeTab === tab.id ? ' is-active' : ''}`}
                                        onClick={() => handleTab(tab.id)}
                                    >
                                        <span className="dh-tab-pill-top">
                                            <Icon size={14} />
                                            <span>{tab.label}</span>
                                        </span>
                                        <span className="dh-tab-pill-helper">{tab.helper}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </Reveal>

                {loading ? (
                    <Reveal delay={220}>
                        <div className="dh-loading">
                            <Loader2 size={36} className="animate-spin" />
                        </div>
                    </Reveal>
                ) : (
                    <div className="dh-sections">
                        {showTours && (
                            <Section
                                section="tours"
                                title="Tours"
                                posts={filteredTourPosts}
                                bookedLookup={bookedLookup}
                                indexOffset={sectionIndexOffset++}
                            />
                        )}

                        {showActivities && (
                            <Section
                                section="activities"
                                title="Activities"
                                posts={filteredActivityPosts}
                                bookedLookup={bookedLookup}
                                indexOffset={sectionIndexOffset++}
                            />
                        )}

                        {showEvents && (
                            <Section
                                section="events"
                                title="Events"
                                posts={filteredEventPosts}
                                bookedLookup={bookedLookup}
                                indexOffset={sectionIndexOffset++}
                            />
                        )}
                    </div>
                )}
            </div>
        </main>
    );
};
