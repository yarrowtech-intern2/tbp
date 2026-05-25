import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, ClipboardList, Home, LayoutDashboard, Loader2, Search, UserCircle2, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getProfileAvatarUrl } from '../lib/avatar';
import { getListingImages, getPrimaryListingImage } from '../lib/listingImages';
import {
  addListingFavorite,
  getBookings,
  getListingReviewSummaryMap,
  getPublicListingsByType,
  hasActiveBoost,
  isListingFavorited,
  removeListingFavorite,
  type ListingReviewSummary,
  type PostRecord,
  type UnifiedBooking,
} from '../lib/destinations';
import { calculatePricingFromProviderUnit } from '../lib/pricing';
import { isProviderRole, normalizeRoleValue, type ListingType } from '../lib/platform';
import { onBookingSync } from '../lib/bookingSync';
import { useStaggeredImageRotation } from '../hooks/useStaggeredImageRotation';
import './tourist-explore-page.css';

type ExploreFilter = 'all' | 'tours' | 'activities' | 'guides';
type TouristMobileNavKey = 'home' | 'explore' | 'dashboard' | 'bookings' | 'profile';

type ExploreCardRecord = PostRecord & {
  exploreType: ExploreFilter;
};

const FILTERS: Array<{ id: ExploreFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'tours', label: 'Tours' },
  { id: 'activities', label: 'Activities' },
  { id: 'guides', label: 'Guides' },
];

const CARD_SIZE_PATTERN = ['tall', 'medium', 'short', 'medium', 'short', 'tall'] as const;
const FALLBACK_IMAGE = '/images/home4/forrest.jpg';
const TOURIST_MOBILE_NAV_ITEMS: Array<{ key: TouristMobileNavKey; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'explore', label: 'Explore', icon: Search },
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'bookings', label: 'Bookings', icon: ClipboardList },
  { key: 'profile', label: 'Profile', icon: UserCircle2 },
];

const getExploreType = (post: PostRecord): ExploreFilter => {
  if (post.type === 'tour') return 'tours';
  if (post.type === 'guide' || post.type === 'event') return 'guides';
  return 'activities';
};

const getPostImage = (post: PostRecord): string => {
  return getPrimaryListingImage(post, FALLBACK_IMAGE);
};

const getPostTitle = (post: PostRecord): string => {
  const candidate = post.title || post.name || post.location || 'Untitled';
  return String(candidate).trim() || 'Untitled';
};

const limitWords = (value: string, maxWords: number): string => {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return value.trim();
  return `${words.slice(0, maxWords).join(' ')}...`;
};

const getPostSubtitle = (post: PostRecord): string => {
  if (typeof post.description === 'string' && post.description.trim().length > 0) {
    return limitWords(post.description, 12);
  }
  return 'Curated experience with guided details and booking support.';
};

const getPostLocation = (post: PostRecord): string => {
  return typeof post.location === 'string' && post.location.trim().length > 0
    ? post.location.trim()
    : 'Location unavailable';
};

const formatPrice = (providerPrice: number | null | undefined): string => {
  if (typeof providerPrice !== 'number' || Number.isNaN(providerPrice) || providerPrice <= 0) return 'Custom';
  const touristPrice = calculatePricingFromProviderUnit(providerPrice, 1).tourist_unit_price;
  return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(touristPrice)}`;
};

const getListingTypeValue = (post: ExploreCardRecord): ListingType => {
  if (post.exploreType === 'tours') return 'tour';
  if (post.exploreType === 'guides') return 'guide';
  return 'activity';
};

const getListingHref = (post: ExploreCardRecord): string => {
  const type = post.exploreType === 'tours' ? 'tour' : post.exploreType === 'guides' ? 'event' : 'activity';
  return `/listings/${type}/${post.id}`;
};



const ExploreListingCard: React.FC<{
  post: ExploreCardRecord;
  size: typeof CARD_SIZE_PATTERN[number];
  reviewSummary: ListingReviewSummary | undefined;
  cardIndex: number;
  isBooked: boolean;
}> = ({ post, size, cardIndex, isBooked }) => {
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
  const activeImage = images[activeImageIndex] || getPostImage(post);
  const previousImage = images[previousImageIndex] || activeImage;
  const hasMultipleImages = images.length > 1;
  const href = getListingHref(post);
  const listingTypeValue = getListingTypeValue(post);
  const title = getPostTitle(post);
  const displayTitle = limitWords(title, 6);
  const subtitle = getPostSubtitle(post);
  const boosted = hasActiveBoost(post);

  useEffect(() => {
    setActiveImageIndex(0);
  }, [post.id, setActiveImageIndex]);

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

  const openListing = () => navigate(href);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openListing();
    }
  };

  const handleImageStep = (event: React.MouseEvent<HTMLButtonElement>, direction: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    setActiveImageIndex((current) => (current + direction + images.length) % images.length);
  };

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

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={openListing}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsImagePaused(true)}
      onMouseLeave={() => setIsImagePaused(false)}
      onFocus={() => setIsImagePaused(true)}
      onBlur={() => setIsImagePaused(false)}
      className={`txp-card txp-card--${size}`}
      aria-label={`Open ${title}`}
    >
      <div className="txp-card-media">
        <div
          key={`txp-prev-${post.id}-${transitionKey}`}
          className="txp-card-image txp-card-image--previous"
          style={{ backgroundImage: `url(${previousImage})` }}
        />
        <div
          key={`txp-current-${post.id}-${transitionKey}`}
          className="txp-card-image txp-card-image--current"
          style={{ backgroundImage: `url(${activeImage})` }}
        />
        <div className="txp-card-overlay" />
        {hasMultipleImages && (
          <>
            <button
              type="button"
              className="txp-gallery-btn txp-gallery-btn--prev"
              aria-label="Previous listing image"
              onClick={(event) => handleImageStep(event, -1)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              className="txp-gallery-btn txp-gallery-btn--next"
              aria-label="Next listing image"
              onClick={(event) => handleImageStep(event, 1)}
            >
              <ChevronRight size={14} />
            </button>
            <div className="txp-gallery-dots" aria-hidden="true">
              {images.slice(0, 6).map((url, imageIndex) => (
                <span key={`${url}-${imageIndex}`} className={imageIndex === activeImageIndex ? 'is-active' : ''} />
              ))}
            </div>
          </>
        )}
        <div className="txp-card-content">
          <div className="txp-card-top">
            <div className="txp-card-badges">
              {isBooked && <span className="txp-card-booked">Booked</span>}
              {boosted && (
                <span className="txp-card-boosted" aria-label="Boosted listing" title="Boosted">
                  <ArrowUpRight size={15} />
                </span>
              )}
            </div>
            <button
              type="button"
              className={`txp-card-save${isFavorite ? ' is-active' : ''}`}
              onClick={handleFavoriteToggle}
              disabled={favoriteLoading}
              title={isFavorite ? 'Remove from saved' : 'Save listing'}
              aria-label={isFavorite ? 'Remove from saved listings' : 'Save listing'}
            >
              {favoriteLoading ? (
                <Loader2 size={16} className="txp-spin" />
              ) : (
                <Bookmark size={18} fill={isFavorite ? 'currentColor' : 'none'} />
              )}
            </button>
          </div>
          <div className="txp-card-copy">
            <h2>{displayTitle}</h2>
            <p>{subtitle}</p>
            <div className="txp-card-actions">
              <strong>{formatPrice(post.price)}</strong>
              <Link to={href} className="txp-card-book" onClick={(event) => event.stopPropagation()}>
                BOOK
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

export const TouristExplorePage: React.FC = () => {
  const { user, profile, isAdmin, isProvider, roleLabel } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [posts, setPosts] = useState<ExploreCardRecord[]>([]);
  const [touristBookings, setTouristBookings] = useState<UnifiedBooking[]>([]);
  const [reviewSummaryByPostId, setReviewSummaryByPostId] = useState<Record<string, ListingReviewSummary>>({});

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

  const activeFilter = useMemo<ExploreFilter>(() => {
    const tab = (searchParams.get('tab') || '').toLowerCase();
    if (tab === 'tours') return 'tours';
    if (tab === 'activities') return 'activities';
    if (tab === 'guides' || tab === 'events') return 'guides';
    return 'all';
  }, [searchParams]);

  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase());

  const fullName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Traveler';
  const displayRole = roleLabel?.trim() || 'Tourist';
  const avatarSrc = getProfileAvatarUrl(profile?.profile_image_url, user?.id, profile?.full_name, user?.email, 'tourist');
  const activeMobileNav: TouristMobileNavKey = 'explore';

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);
      try {
        const [tours, activities, guides, bookings] = await Promise.all([
          getPublicListingsByType('tour'),
          getPublicListingsByType('activity'),
          getPublicListingsByType('guide'),
          getBookings(user.id),
        ]);

        const mapped: ExploreCardRecord[] = [...tours, ...activities, ...guides].map((post) => ({
          ...post,
          exploreType: getExploreType(post),
        }));

        setPosts(mapped);
        setTouristBookings(bookings);
      } catch (error) {
        console.error('Failed loading explore listings:', error);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [user]);

  useEffect(() => {
    const listingIds = posts
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
        console.error('Failed loading review summaries for explore:', error);
        if (!cancelled) setReviewSummaryByPostId({});
      });

    return () => {
      cancelled = true;
    };
  }, [posts]);

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
  if (providerAccount || providerByLabel || adminAccount) {
    return <Navigate to={(providerAccount || providerByLabel) ? '/dashboard/provider' : '/dashboard/admin'} replace />;
  }

  const filteredPosts = posts.filter((post) => {
    if (activeFilter !== 'all' && post.exploreType !== activeFilter) return false;
    if (!deferredSearchQuery) return true;

    const haystack = `${getPostTitle(post)} ${getPostLocation(post)} ${typeof post.description === 'string' ? post.description : ''}`.toLowerCase();
    return haystack.includes(deferredSearchQuery);
  });

  const bookedLookup = touristBookings.reduce(
    (lookup, booking) => {
      const status = (booking.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'canceled') return lookup;

      const listingId = String(booking.listing_id || '').trim();
      if (!listingId) return lookup;

      lookup.byId.add(listingId);
      lookup.byTypeAndId.add(`${booking.listing_type}:${listingId}`);
      return lookup;
    },
    { byTypeAndId: new Set<string>(), byId: new Set<string>() }
  );

  const handleFilter = (filter: ExploreFilter) => {
    if (filter === 'all') {
      setSearchParams({});
      return;
    }
    setSearchParams({ tab: filter });
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
    if (key === 'bookings') {
      navigate('/dashboard/tourist?section=bookings');
      return;
    }
    if (key === 'profile') {
      navigate('/profile');
    }
  };

  return (
    <main className="txp-page">
      <div className="txp-shell">
        {searchOpen ? (
          <div className="txp-searchbar">
            <Search size={18} />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search destinations, tours, guides"
              aria-label="Search explore listings"
            />
          </div>
        ) : null}

        <section className="txp-profile-row">
          <div className="txp-profile">
            <img src={avatarSrc} alt={fullName} className="txp-profile-avatar" />
            <div className="txp-profile-copy">
              <h1>{fullName}</h1>
              <p>{displayRole}</p>
            </div>
          </div>
          <div className="txp-topbar-actions">
            <button
              type="button"
              className={`txp-icon-btn${searchOpen ? ' is-active' : ''}`}
              aria-label={searchOpen ? 'Close search' : 'Open search'}
              onClick={() => {
                setSearchOpen((prev) => !prev);
              }}
            >
              {searchOpen ? <X size={22} /> : <Search size={22} />}
            </button>
          </div>
        </section>

        <section className="txp-filters" aria-label="Explore categories">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`txp-filter-chip${activeFilter === filter.id ? ' is-active' : ''}`}
              onClick={() => handleFilter(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="txp-state">Loading explore feed...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="txp-state">No listings match this filter right now.</div>
        ) : (
          <section className="txp-grid" aria-label="Explore results">
            {filteredPosts.map((post, index) => {
              const size = CARD_SIZE_PATTERN[index % CARD_SIZE_PATTERN.length];
              const reviewSummary = reviewSummaryByPostId[String(post.id || '').trim()];
              return (
                <ExploreListingCard
                  key={`txp-card-${post.id}`}
                  post={post}
                  size={size}
                  cardIndex={index}
                  reviewSummary={reviewSummary}
                  isBooked={
                    bookedLookup.byTypeAndId.has(`${getListingTypeValue(post)}:${String(post.id).trim()}`)
                    || bookedLookup.byId.has(String(post.id).trim())
                  }
                />
              );
            })}
          </section>
        )}
      </div>

      <nav className="txp-bottom-nav" aria-label="Tourist mobile navigation">
        <div className="txp-bottom-nav-track">
          {TOURIST_MOBILE_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeMobileNav;
            return (
              <button
                type="button"
                key={`txp-mob-${item.key}`}
                className={`txp-bottom-nav-btn${isActive ? ' is-active' : ''}`}
                onClick={() => handleMobileNav(item.key)}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="txp-bottom-nav-icon">
                  <Icon size={20} />
                </span>
                <span className="txp-bottom-nav-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );
};


