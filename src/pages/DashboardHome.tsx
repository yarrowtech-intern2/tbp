import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Heart,
  Home,
  LayoutDashboard,
  Loader2,
  MapPin,
  Search,
  Star,
  TrendingUp,
  UserCircle2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  addListingFavorite,
  getActivePaidAds,
  getBookings,
  getListingReviewSummaryMap,
  getPublicListingsByType,
  hasActiveBoost,
  type PaidAdRecord,
  type ListingReviewSummary,
  isListingFavorited,
  removeListingFavorite,
  type PostRecord,
  type UnifiedBooking,
} from '../lib/destinations';
import type { ListingType } from '../lib/platform';
import { isProviderRole, normalizeRoleValue } from '../lib/platform';
import { onBookingSync } from '../lib/bookingSync';
import { DEFAULT_HERO_MESSAGES, getDynamicHeroMessage, getPublicAppContent, type HeroMessagesContent } from '../lib/appContent';
import { getListingImages } from '../lib/listingImages';
import { useStaggeredImageRotation } from '../hooks/useStaggeredImageRotation';
import './dashboard-home.css';
import '../components/listing-card.css';

type RevealProps = { children: React.ReactNode; className?: string; delay?: number };
type SectionTab = 'tours' | 'activities' | 'events';
type TouristMobileNavKey = 'home' | 'explore' | 'dashboard' | 'bookings' | 'profile';
const FALLBACK_IMAGE = '/images/home4/forrest.jpg';

const Reveal: React.FC<RevealProps> = ({ children, className = '', delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
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

const TOURIST_MOBILE_NAV_ITEMS: Array<{ key: TouristMobileNavKey; label: string; icon: LucideIcon }> = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'explore', label: 'Explore', icon: Search },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'bookings', label: 'Bookings', icon: ClipboardList },
  { key: 'profile', label: 'Profile', icon: UserCircle2 },
];

const getPostTitle = (post: PostRecord): string => {
  const candidate = post.title || post.name;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : 'Untitled listing';
};

const getPostLocation = (post: PostRecord): string => {
  return typeof post.location === 'string' && post.location.trim().length > 0
    ? post.location.trim()
    : 'Location shared after booking';
};

const getPostSubtitle = (post: PostRecord): string => {
  if (typeof post.description === 'string' && post.description.trim().length > 0) {
    return post.description.trim().slice(0, 96);
  }
  return 'Curated experience with guided details and booking support.';
};

const getPostType = (post: PostRecord): SectionTab => {
  if (post.type === 'tour') return 'tours';
  if (post.type === 'guide' || post.type === 'event') return 'events';
  return 'activities';
};

const getSectionTitle = (section: SectionTab): string => {
  if (section === 'tours') return 'Tours';
  if (section === 'activities') return 'Activities';
  return 'Guides';
};

const getSectionHeading = (section: SectionTab): string => {
  if (section === 'tours') return 'Top Tour Packages';
  if (section === 'activities') return 'Top Activities';
  return 'Local Guides';
};

const getSectionHelper = (section: SectionTab): string => {
  if (section === 'tours') return 'Multi-day plans built for slower, better travel.';
  if (section === 'activities') return 'Short-format experiences you can book quickly.';
  return 'Guide-led picks for local stories, routes, and expertise.';
};

const getSectionKicker = (section: SectionTab): string => {
  if (section === 'tours') return 'Curated journeys';
  if (section === 'activities') return 'Do more today';
  return 'Meet the locals';
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

const getReviewLabel = (summary: ListingReviewSummary | undefined): string => {
  if (!summary || summary.review_count === 0 || summary.average_rating === null) {
    return 'No reviews yet';
  }
  return `${summary.average_rating.toFixed(1)} · ${summary.review_count} ${summary.review_count === 1 ? 'review' : 'reviews'}`;
};

const getToneClass = (section: SectionTab): string => `dh-tone-${section}`;

const dedupePosts = (posts: PostRecord[]): PostRecord[] => {
  const seen = new Set<string>();
  return posts.filter((post) => {
    const id = String(post.id || '').trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const filterPostsByQuery = (posts: PostRecord[], query: string): PostRecord[] => {
  if (!query) return posts;

  return posts.filter((post) => {
    const title = getPostTitle(post).toLowerCase();
    const subtitle = getPostSubtitle(post).toLowerCase();
    const location = getPostLocation(post).toLowerCase();
    return title.includes(query) || subtitle.includes(query) || location.includes(query);
  });
};

const scoreRecommendation = (post: PostRecord): number => {
  let score = 0;
  if (post.image_url || post.cover_image_url || post.thumbnail_url) score += 4;
  if (typeof post.price === 'number' && post.price > 0) score += 2;
  if (typeof post.description === 'string' && post.description.trim().length > 0) score += 2;
  if (typeof post.location === 'string' && post.location.trim().length > 0) score += 1;
  if (getPostType(post) === 'tours') score += 1;
  return score;
};

const isExternalHref = (href?: string | null): boolean => Boolean(href && /^https?:\/\//i.test(href));

const tokenize = (value: string): string[] => value
  .toLowerCase()
  .split(/[^a-z0-9]+/i)
  .map((item) => item.trim())
  .filter((item) => item.length > 2);

const scoreAdRelevance = (ad: PaidAdRecord, posts: PostRecord[]): number => {
  const adTokens = new Set(tokenize(`${ad.title || ''} ${ad.link || ''}`));
  if (adTokens.size === 0) return 0;

  let bestScore = 0;
  posts.forEach((post) => {
    const postTokens = new Set(tokenize(`${getPostTitle(post)} ${getPostLocation(post)} ${post.sub_category || ''}`));
    let overlap = 0;
    adTokens.forEach((token) => {
      if (postTokens.has(token)) overlap += 1;
    });
    if (typeof ad.link === 'string' && ad.link.includes(String(post.id))) overlap += 4;
    if (overlap > bestScore) bestScore = overlap;
  });

  return bestScore;
};

const ListingCard: React.FC<{
  post: PostRecord;
  isBooked: boolean;
  reviewSummary?: ListingReviewSummary;
  cardIndex: number;
}> = ({ post, isBooked, reviewSummary, cardIndex }) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const canFavorite = profile?.role === 'tourist';
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [isImagePaused, setIsImagePaused] = useState(false);

  const images = useMemo(() => {
    const uploadedImages = getListingImages(post);
    return uploadedImages.length > 0 ? uploadedImages : [FALLBACK_IMAGE];
  }, [post]);
  const { activeImageIndex, previousImageIndex, setActiveImageIndex, transitionKey } = useStaggeredImageRotation({
    imageCount: images.length,
    cardIndex,
    paused: isImagePaused,
  });
  const activeImage = images[activeImageIndex] || images[0] || FALLBACK_IMAGE;
  const previousImage = images[previousImageIndex] || activeImage;
  const hasMultipleImages = images.length > 1;
  const title = getPostTitle(post);
  const subtitle = getPostSubtitle(post);
  const type = getPostType(post);
  const listingTypePath = toListingTypePath(type);
  const listingTypeValue = toListingTypeValue(type);
  const location = getPostLocation(post);
  const startsAt = formatStartDate(typeof post.starts_at === 'string' ? post.starts_at : undefined);
  const priceLabel = formatPrice(post.price);
  const boosted = hasActiveBoost(post);
  const chipLabel = post.sub_category && post.sub_category.trim().length > 0
    ? post.sub_category.trim()
    : getSectionTitle(type).slice(0, -1);

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

  useEffect(() => {
    setActiveImageIndex(0);
  }, [post.id, setActiveImageIndex]);

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

  const handleImageStep = (event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveImageIndex((current) => (current + direction + images.length) % images.length);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openListing();
    }
  };

  return (
    <article
      className={`listing-card ${getToneClass(type)}${isBooked ? ' is-booked' : ''}`}
      role="link"
      tabIndex={0}
      onClick={openListing}
      onKeyDown={handleCardKeyDown}
      onMouseEnter={() => setIsImagePaused(true)}
      onMouseLeave={() => setIsImagePaused(false)}
      onFocus={() => setIsImagePaused(true)}
      onBlur={() => setIsImagePaused(false)}
      aria-label={`Open ${title}`}
    >
      <div className={`listing-card-media${activeImage ? '' : ' is-fallback'}`}>
        <div
          key={`listing-prev-${post.id}-${transitionKey}`}
          className="listing-card-media-bg listing-card-media-bg--previous"
          style={{ backgroundImage: `url(${previousImage})` }}
        />
        <div
          key={`listing-current-${post.id}-${transitionKey}`}
          className="listing-card-media-bg listing-card-media-bg--current"
          style={{ backgroundImage: `url(${activeImage})` }}
        />
        <div className="listing-card-media-overlay" />
        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="listing-card-gallery-btn listing-card-gallery-btn--prev"
              aria-label="Previous listing image"
              onClick={(event) => handleImageStep(event, -1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="listing-card-gallery-btn listing-card-gallery-btn--next"
              aria-label="Next listing image"
              onClick={(event) => handleImageStep(event, 1)}
            >
              <ChevronRight size={14} />
            </button>
            <div className="listing-card-gallery-meta" aria-label={`${images.length} listing images`}>
              <span>{activeImageIndex + 1}/{images.length}</span>
            </div>
            <div className="listing-card-gallery-dots" aria-hidden="true">
              {images.slice(0, 6).map((url, index) => (
                <span key={`${url}-${index}`} className={index === activeImageIndex ? 'is-active' : ''} />
              ))}
            </div>
          </>
        )}
        <div className="listing-card-media-top">
          <div className="listing-card-badge-cluster">
            <span className="listing-card-chip">{chipLabel}</span>
            {boosted && (
              <span className="listing-card-boost-badge">
                <TrendingUp size={12} />
                Boosted
              </span>
            )}
            {isBooked && <span className="listing-card-booked-pill">Booked</span>}
          </div>
          <button
            type="button"
            className={`listing-card-fav-btn${isFavorite ? ' is-active' : ''}`}
            onClick={handleFavoriteToggle}
            disabled={favoriteLoading || !canFavorite}
            title={canFavorite ? undefined : 'Only tourist accounts can save favorites'}
          >
            {favoriteLoading ? (
              <Loader2 size={16} className="dh-spin" />
            ) : (
              <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />
            )}
          </button>
        </div>

        {!activeImage && (
          <div className="listing-card-fallback-text" aria-hidden="true">
            {title.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="listing-card-content-overlay">
          <h3 className="listing-card-title">{title}</h3>
          <p className="listing-card-sub">{subtitle}</p>

          <div className="listing-card-meta">
            <span className={`listing-card-meta-item${reviewSummary?.review_count ? ' listing-card-review-pill' : ' listing-card-review-empty'}`}>
              <Star size={14} fill={reviewSummary?.review_count ? 'currentColor' : 'none'} />
              <span>{getReviewLabel(reviewSummary)}</span>
            </span>
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
    </article>
  );
};

const PromoBanner: React.FC<{
  title: string;
  subtitle: string;
  image: string;
  badge: string;
  cta: string;
  href?: string;
  compact?: boolean;
}> = ({ title, subtitle, image, badge, cta, href, compact = false }) => {
  const content = (
    <>
      <div className="dh-ad-media" style={{ backgroundImage: `url(${image})` }} />
      <div className="dh-ad-overlay" />
      <div className="dh-ad-copy">
        <span className="dh-ad-badge">{badge}</span>
        <h3 className="dh-ad-title">{title}</h3>
        <p className="dh-ad-sub">{subtitle}</p>
        <span className="dh-ad-cta">
          {cta}
          <ArrowRight size={16} />
        </span>
      </div>
      <span className="dh-ad-mark">Ad</span>
    </>
  );

  if (!href) {
    return <article className={`dh-ad-banner${compact ? ' is-compact' : ''}`}>{content}</article>;
  }

  if (isExternalHref(href)) {
    return (
      <a
        href={href}
        className={`dh-ad-banner${compact ? ' is-compact' : ''}`}
        target="_blank"
        rel="noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link to={href} className={`dh-ad-banner${compact ? ' is-compact' : ''}`}>
      {content}
    </Link>
  );
};

const CarouselRow: React.FC<{
  posts: PostRecord[];
  bookedLookup: {
    byTypeAndId: Set<string>;
    byId: Set<string>;
  };
  reviewSummaryByPostId?: Record<string, ListingReviewSummary>;
  indexOffset?: number;
}> = ({ posts, bookedLookup, reviewSummaryByPostId = {}, indexOffset = 0 }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    const check = () => {
      setCanScrollLeft(element.scrollLeft > 4);
      setCanScrollRight(element.scrollLeft < element.scrollWidth - element.clientWidth - 4);
    };

    check();
    element.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });

    return () => {
      element.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [posts.length]);

  const scroll = (direction: 'left' | 'right') => {
    const element = rowRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction === 'right' ? element.clientWidth * 0.82 : -(element.clientWidth * 0.82),
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

      <div ref={rowRef} className="dh-listing-row">
        {posts.map((post, index) => (
          <Reveal key={post.id} delay={indexOffset * 100 + (index + 1) * 55}>
            <ListingCard
              post={post}
              cardIndex={index}
              reviewSummary={reviewSummaryByPostId[String(post.id).trim()]}
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

const AdCarousel: React.FC<{ ads: PaidAdRecord[] }> = ({ ads }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const element = rowRef.current;
    if (!element) return;

    const check = () => {
      setCanScrollLeft(element.scrollLeft > 4);
      setCanScrollRight(element.scrollLeft < element.scrollWidth - element.clientWidth - 4);
    };

    check();
    element.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });

    return () => {
      element.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [ads.length]);

  const scroll = (direction: 'left' | 'right') => {
    const element = rowRef.current;
    if (!element) return;
    element.scrollBy({
      left: direction === 'right' ? element.clientWidth * 0.92 : -(element.clientWidth * 0.92),
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
          aria-label="Scroll ad carousel left"
        >
          <ChevronLeft size={18} />
        </button>
      )}

      <div ref={rowRef} className="dh-ad-row">
        {ads.map((ad, index) => (
          <Reveal key={ad.id} className="dh-ad-row-item" delay={(index + 1) * 45}>
            <PromoBanner
              title={ad.title?.trim() || 'Sponsored placement'}
              subtitle={ad.cta_text?.trim() || 'Sponsored promotion from a live provider listing.'}
              image={ad.image_url?.trim() || FALLBACK_IMAGE}
              badge="Sponsored"
              cta={ad.cta_text?.trim() || 'Open now'}
              href={ad.link?.trim() || undefined}
            />
          </Reveal>
        ))}
      </div>

      {canScrollRight && (
        <button
          type="button"
          className="dh-carousel-arrow dh-carousel-arrow--right"
          onClick={() => scroll('right')}
          aria-label="Scroll ad carousel right"
        >
          <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
};

const Section: React.FC<{
  section: SectionTab;
  posts: PostRecord[];
  bookedLookup: {
    byTypeAndId: Set<string>;
    byId: Set<string>;
  };
  reviewSummaryByPostId: Record<string, ListingReviewSummary>;
  indexOffset: number;
  activeTab: SectionTab | null;
  onToggleFilter: (tab: SectionTab) => void;
}> = ({ section, posts, bookedLookup, reviewSummaryByPostId, indexOffset, activeTab, onToggleFilter }) => {
  return (
    <section className={`dh-listing-section ${getToneClass(section)}`}>
      <Reveal delay={indexOffset * 100}>
        <div className="dh-section-top">
          <div className="dh-section-heading">
            <p className="dh-section-kicker">{getSectionKicker(section)}</p>
            <h2 className="dh-listing-section-title">{getSectionHeading(section)}</h2>
            <p className="dh-listing-section-sub">{getSectionHelper(section)}</p>
          </div>

          <div className="dh-section-actions">
            <span className="dh-section-count">
              {posts.length} {posts.length === 1 ? 'listing' : 'listings'}
            </span>
            <button type="button" className="dh-section-link" onClick={() => onToggleFilter(section)}>
              {activeTab === section ? 'Show all' : `Only ${getSectionTitle(section)}`}
            </button>
          </div>
        </div>
      </Reveal>

      {posts.length > 0 ? (
        <CarouselRow
          posts={posts}
          bookedLookup={bookedLookup}
          reviewSummaryByPostId={reviewSummaryByPostId}
          indexOffset={indexOffset}
        />
      ) : (
        <Reveal delay={indexOffset * 100 + 80}>
          <p className="dh-empty-text">No {getSectionTitle(section).toLowerCase()} available yet.</p>
        </Reveal>
      )}
    </section>
  );
};

export const DashboardHome: React.FC = () => {
  const { user, profile, isProvider, isAdmin, roleLabel } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [tourPosts, setTourPosts] = useState<PostRecord[]>([]);
  const [activityPosts, setActivityPosts] = useState<PostRecord[]>([]);
  const [eventPosts, setEventPosts] = useState<PostRecord[]>([]);
  const [paidAds, setPaidAds] = useState<PaidAdRecord[]>([]);
  const [suggestedPosts, setSuggestedPosts] = useState<PostRecord[]>([]);
  const [reviewSummaryByPostId, setReviewSummaryByPostId] = useState<Record<string, ListingReviewSummary>>({});
  const [touristBookings, setTouristBookings] = useState<UnifiedBooking[]>([]);
  const [localNow, setLocalNow] = useState(() => new Date());
  const [heroMessages, setHeroMessages] = useState<HeroMessagesContent>(DEFAULT_HERO_MESSAGES);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const heroTitle = useMemo(() => getDynamicHeroMessage(localNow, heroMessages), [heroMessages, localNow]);
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
  const normalizedRoleLabel = (roleLabel || '').trim().toLowerCase();
  const providerByLabel = normalizedRoleLabel === 'tour company'
    || normalizedRoleLabel === 'tour instructor'
    || normalizedRoleLabel === 'tour guide'
    || normalizedRoleLabel === 'provider'
    || normalizedRoleLabel === 'vendor';
  const providerAccount = isProvider || isProviderRole(resolvedRole) || resolvedRole === 'provider' || resolvedRole === 'vendor';
  const adminAccount = isAdmin || resolvedRole === 'admin';
  const marketingAccount = resolvedRole === 'marketing';

  const firstName = useMemo(() => {
    const fullName = profile?.full_name?.trim();
    if (fullName) return fullName.split(' ')[0];
    return user?.email?.split('@')[0] || 'Explorer';
  }, [profile?.full_name, user?.email]);

  const searchQueryNormalized = deferredSearchQuery.trim().toLowerCase();

  const filteredTourPosts = useMemo(
    () => filterPostsByQuery(tourPosts, searchQueryNormalized),
    [tourPosts, searchQueryNormalized]
  );
  const filteredActivityPosts = useMemo(
    () => filterPostsByQuery(activityPosts, searchQueryNormalized),
    [activityPosts, searchQueryNormalized]
  );
  const filteredEventPosts = useMemo(
    () => filterPostsByQuery(eventPosts, searchQueryNormalized),
    [eventPosts, searchQueryNormalized]
  );

  const recommendedPosts = useMemo(() => {
    const filteredSuggested = filterPostsByQuery(suggestedPosts, searchQueryNormalized);
    const pool = dedupePosts([
      ...filteredSuggested,
      ...filteredTourPosts,
      ...filteredActivityPosts,
      ...filteredEventPosts,
    ]);

    return [...pool]
      .sort((a, b) => {
        const boostDelta = Number(hasActiveBoost(b)) - Number(hasActiveBoost(a));
        if (boostDelta !== 0) return boostDelta;

        const scoreDelta = scoreRecommendation(b) - scoreRecommendation(a);
        if (scoreDelta !== 0) return scoreDelta;

        const boostEndDelta = new Date(b.boost_end || 0).getTime() - new Date(a.boost_end || 0).getTime();
        if (boostEndDelta !== 0) return boostEndDelta;

        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .slice(0, 8);
  }, [
    suggestedPosts,
    filteredTourPosts,
    filteredActivityPosts,
    filteredEventPosts,
    searchQueryNormalized,
  ]);

  const rankedAds = useMemo(() => {
    const sourcePosts = recommendedPosts.length > 0
      ? recommendedPosts
      : dedupePosts([...filteredTourPosts, ...filteredActivityPosts, ...filteredEventPosts]);

    return [...paidAds].sort((a, b) => {
      const amountDelta = (b.payment_amount || 0) - (a.payment_amount || 0);
      if (amountDelta !== 0) return amountDelta;

      const relevanceDelta = scoreAdRelevance(b, sourcePosts) - scoreAdRelevance(a, sourcePosts);
      if (relevanceDelta !== 0) return relevanceDelta;

      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [filteredActivityPosts, filteredEventPosts, filteredTourPosts, paidAds, recommendedPosts]);

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

    const interval = window.setInterval(() => setLocalNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    void getPublicAppContent()
      .then((content) => {
        if (!cancelled) setHeroMessages(content.heroMessages);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const [tours, activities, events, ads, bookings] = await Promise.all([
          getPublicListingsByType('tour'),
          getPublicListingsByType('activity'),
          getPublicListingsByType('guide'),
          getActivePaidAds(),
          getBookings(user.id),
        ]);

        setTourPosts(tours);
        setActivityPosts(activities);
        setEventPosts(events);
        setPaidAds(ads);
        setTouristBookings(bookings);

        const all = dedupePosts([...tours, ...activities, ...events]);
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
    const listingIds = dedupePosts([...tourPosts, ...activityPosts, ...eventPosts])
      .map((post) => String(post.id || '').trim())
      .filter(Boolean);

    if (listingIds.length === 0) {
      setReviewSummaryByPostId({});
      return;
    }

    let cancelled = false;

    void getListingReviewSummaryMap(listingIds)
      .then((summary) => {
        if (!cancelled) setReviewSummaryByPostId(summary);
      })
      .catch((error) => {
        console.error('Review summary load failed:', error);
        if (!cancelled) setReviewSummaryByPostId({});
      });

    return () => {
      cancelled = true;
    };
  }, [activityPosts, eventPosts, tourPosts]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onBookingSync(() => {
      void getBookings(user.id)
        .then((rows) => setTouristBookings(rows))
        .catch(() => undefined);
    });

    return unsubscribe;
  }, [user]);

  if (!user) return null;
  if (providerAccount || providerByLabel || adminAccount || marketingAccount) {
    const dashboardPath = (providerAccount || providerByLabel)
      ? '/dashboard/provider'
      : marketingAccount
        ? '/dashboard/marketing'
        : '/dashboard/admin';
    return <Navigate to={dashboardPath} replace />;
  }

  const showAll = activeTab === null;
  const showTours = showAll || activeTab === 'tours';
  const showActivities = showAll || activeTab === 'activities';
  const showEvents = showAll || activeTab === 'events';
  const activeMobileNav: TouristMobileNavKey = 'home';

  let sectionIndexOffset = 0;

  const handleTab = (tab: SectionTab) => {
    if (activeTab === tab) {
      setSearchParams({});
      return;
    }
    setSearchParams({ tab });
  };

  const handleMobileNav = (key: TouristMobileNavKey) => {
    if (key === 'home') {
      navigate('/');
      return;
    }
    if (key === 'explore') {
      navigate('/explore');
      return;
    }
    if (key === 'dashboard') {
      navigate('/dashboard/tourist');
      return;
    }
    if (key === 'profile') {
      navigate('/profile');
      return;
    }
    if (key === 'bookings') {
      navigate('/dashboard/tourist?section=bookings');
      return;
    }
  };

  return (
    <main className="dh-page">
      <div className="container dh-shell">
        <Reveal delay={0}>
          <section className="dh-hero">
            <div className="dh-hero-copy">
              {/* <span className="dh-hero-kicker">Explore</span> */}

              <div className="dh-hero-head">
                <div className="dh-hero-head-copy">
                  <h1 className="dh-hero-title">
                    <span className="dh-hero-greeting">Hi {firstName},</span>
                    <span>{heroTitle}</span>
                  </h1>
                  {/* <p className="dh-hero-sub">
                    Recommendations first, then curated ads, then live tours, activities, and guides you can browse in rails.
                  </p> */}
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {!loading && recommendedPosts.length > 0 && (
          <Reveal delay={70}>
            <section className="dh-recommend-section">
              <div className="dh-section-top">
                <div className="dh-section-heading">
                  {/* <p className="dh-section-kicker">Recommended</p> */}
                  <h2 className="dh-listing-section-title">Recommended Packages for you</h2>
                  {/* <p className="dh-listing-section-sub">High-visibility cards for your next shortlist.</p> */}
                </div>
              </div>

              <CarouselRow
                posts={recommendedPosts.slice(0, 8)}
                bookedLookup={bookedLookup}
                reviewSummaryByPostId={reviewSummaryByPostId}
                indexOffset={0}
              />
            </section>
          </Reveal>
        )}

        <Reveal delay={110}>
          <section className="dh-ad-section">
            <div className="dh-section-top">
              <div className="dh-section-heading">
                {/* <p className="dh-section-kicker">Advertisements</p> */}
                <h2 className="dh-listing-section-title">Sponsored</h2>
                {/* <p className="dh-listing-section-sub">Paid placements ordered by campaign weight and listing relevance.</p> */}
              </div>
            </div>

            {rankedAds.length > 0 ? (
              <AdCarousel ads={rankedAds} />
            ) : (
              <p className="dh-empty-text">No sponsored ads are live right now.</p>
            )}
          </section>
        </Reveal>

        {loading ? (
          <Reveal delay={160}>
            <div className="dh-loading">
              <Loader2 size={34} className="dh-spin" />
            </div>
          </Reveal>
        ) : (
          <div className="dh-sections">
            {showTours && (
              <Section
                section="tours"
                posts={filteredTourPosts}
                bookedLookup={bookedLookup}
                reviewSummaryByPostId={reviewSummaryByPostId}
                indexOffset={sectionIndexOffset++}
                activeTab={activeTab}
                onToggleFilter={handleTab}
              />
            )}

            {showActivities && (
              <Section
                section="activities"
                posts={filteredActivityPosts}
                bookedLookup={bookedLookup}
                reviewSummaryByPostId={reviewSummaryByPostId}
                indexOffset={sectionIndexOffset++}
                activeTab={activeTab}
                onToggleFilter={handleTab}
              />
            )}

            {showEvents && (
              <Section
                section="events"
                posts={filteredEventPosts}
                bookedLookup={bookedLookup}
                reviewSummaryByPostId={reviewSummaryByPostId}
                indexOffset={sectionIndexOffset++}
                activeTab={activeTab}
                onToggleFilter={handleTab}
              />
            )}
          </div>
        )}
      </div>

      <nav className="dh-bottom-nav" aria-label="Tourist mobile navigation">
        <div className="dh-bottom-nav-track">
          {TOURIST_MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeMobileNav;
            return (
              <button
                type="button"
                key={`dh-mob-${item.key}`}
                className={`dh-bottom-nav-btn${isActive ? ' is-active' : ''}`}
                onClick={() => handleMobileNav(item.key)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="dh-bottom-nav-icon">
                  <Icon size={20} />
                </span>
                <span className="dh-bottom-nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
};
