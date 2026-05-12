import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Heart, Loader2, MapPin, MessageCircle, ShieldCheck, Star, TrendingUp, Users } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
    addListingFavorite,
    getCurrentUserListingReview,
    getBookings,
    getListingById,
    getListingReviewSummaryMap,
    getListingReviews,
    getOrCreateConversation,
    hasActiveBoost,
    isListingFavorited,
    removeListingFavorite,
    saveListingReview,
    type ListingReviewRecord,
    type PostRecord,
} from '../lib/destinations';
import type { ListingType } from '../lib/platform';
import { confirmRazorpayBooking, createRazorpayOrder, openRazorpayCheckout } from '../lib/payments';
import { getLocalBookedLookup, markListingBookedLocally, onBookingSync } from '../lib/bookingSync';
import {
    clearPendingBookingConfirmation,
    getPendingBookingConfirmation,
    savePendingBookingConfirmation,
} from '../lib/pendingBookingConfirmation';
import './listing-detail.css';

const toInternalListingType = (value: string | undefined): ListingType | undefined => {
    if (value === 'event') return 'guide';
    if (value === 'tour' || value === 'activity' || value === 'guide') return value;
    return undefined;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeLooseString = (value: unknown): string | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const lowered = trimmed.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return null;
    return trimmed;
};

const normalizeUuidString = (value: unknown): string | null => {
    const normalized = normalizeLooseString(value);
    if (!normalized) return null;
    return UUID_REGEX.test(normalized) ? normalized : null;
};

const getListingTitle = (listing: PostRecord): string => {
    const title = listing.title || listing.name;
    return typeof title === 'string' && title.trim().length > 0 ? title : 'Untitled listing';
};

const getListingImage = (listing: PostRecord): string => (
    listing.image_url
    || listing.cover_image_url
    || listing.thumbnail_url
    || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200'
);

const formatReviewSummary = (average: number | null, count: number): string => {
    if (!count || average === null) return 'No reviews yet';
    return `${average.toFixed(1)} from ${count} ${count === 1 ? 'rating' : 'ratings'}`;
};

export const ListingDetail: React.FC = () => {
    const { id, type } = useParams<{ id: string; type?: string }>();
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [bookingLoading, setBookingLoading] = useState(false);
    const [messageLoading, setMessageLoading] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const [isFavorite, setIsFavorite] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [confirmingBooking, setConfirmingBooking] = useState(false);
    const [bookingPendingSync, setBookingPendingSync] = useState(false);
    const [bookingError, setBookingError] = useState<string | null>(null);
    const [hasExistingBooking, setHasExistingBooking] = useState(false);
    const [bookingSyncTick, setBookingSyncTick] = useState(0);
    const [retryingConfirmation, setRetryingConfirmation] = useState(false);
    const [autoRetryAttempted, setAutoRetryAttempted] = useState(false);
    const [reviewLoading, setReviewLoading] = useState(false);
    const [reviewSaving, setReviewSaving] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewAverage, setReviewAverage] = useState<number | null>(null);
    const [reviewCount, setReviewCount] = useState(0);
    const [reviews, setReviews] = useState<ListingReviewRecord[]>([]);
    const [myReview, setMyReview] = useState<ListingReviewRecord | null>(null);
    const [selectedRating, setSelectedRating] = useState(0);
    const [checkIn, setCheckIn] = useState('');
    const [guests, setGuests] = useState(1);
    const [listing, setListing] = useState<PostRecord | null>(null);

    const listingType = toInternalListingType(type);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            setLoading(true);
            try {
                const row = await getListingById(id, listingType);
                setListing(row);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [id, listingType]);

    useEffect(() => {
        const listingId = normalizeLooseString(listing?.id) || normalizeLooseString(id);
        if (!listingId) {
            setReviewAverage(null);
            setReviewCount(0);
            setReviews([]);
            setMyReview(null);
            setSelectedRating(0);
            return;
        }

        let cancelled = false;
        const loadReviews = async () => {
            setReviewLoading(true);
            setReviewError(null);
            try {
                const [summaryMap, reviewRows, currentUserReview] = await Promise.all([
                    getListingReviewSummaryMap([listingId]),
                    getListingReviews(listingId),
                    user?.id && profile?.role === 'tourist' ? getCurrentUserListingReview(user.id, listingId) : Promise.resolve(null),
                ]);

                if (cancelled) return;

                const summary = summaryMap[listingId];
                setReviewAverage(summary?.average_rating ?? null);
                setReviewCount(summary?.review_count ?? 0);
                setReviews(reviewRows);
                setMyReview(currentUserReview);
                setSelectedRating(currentUserReview?.rating || 0);
            } catch (error) {
                console.error('Failed to load listing reviews:', error);
                if (!cancelled) {
                    setReviewError(error instanceof Error ? error.message : 'Could not load reviews.');
                    setReviewAverage(null);
                    setReviewCount(0);
                    setReviews([]);
                    setMyReview(null);
                    setSelectedRating(0);
                }
            } finally {
                if (!cancelled) setReviewLoading(false);
            }
        };

        void loadReviews();
        return () => {
            cancelled = true;
        };
    }, [id, listing?.id, profile?.role, user?.id]);

    const title = listing ? getListingTitle(listing) : '';
    const image = listing ? getListingImage(listing) : '';
    const description = typeof listing?.description === 'string' ? listing.description : 'No description provided yet.';
    const location = typeof listing?.location === 'string' ? listing.location : 'Location available after booking';
    const unitPrice = typeof listing?.price === 'number' ? listing.price : 0;
    const ownerUserId = normalizeUuidString(listing?.provider_user_id)
        || normalizeUuidString(listing?.user_id)
        || null;
    const listingTypeValue = listing?.type;
    const effectiveType: ListingType = toInternalListingType(listingTypeValue || undefined)
        ? (toInternalListingType(listingTypeValue || undefined) as ListingType)
        : (listingType || 'activity');
    const displayType = effectiveType === 'guide' ? 'event' : effectiveType;
    const total = useMemo(() => unitPrice * guests, [guests, unitPrice]);
    const canBook = profile?.role === 'tourist';
    const canFavorite = profile?.role === 'tourist';
    const canReview = profile?.role === 'tourist';
    const canMessageProviderAfterBooking = Boolean(
        user
        && ownerUserId
        && ownerUserId !== user.id
        && (bookingSuccess || hasExistingBooking)
        && !confirmingBooking
        && !bookingPendingSync
    );
    const boosted = listing ? hasActiveBoost(listing) : false;

    const retryPendingConfirmation = async () => {
        const currentUserId = normalizeUuidString(user?.id);
        const listingId = normalizeLooseString(listing?.id) || normalizeLooseString(id);
        if (!currentUserId || !listingId) return;

        const pending = getPendingBookingConfirmation({
            userId: currentUserId,
            listingId,
            listingType: effectiveType,
        });
        if (!pending) return;

        setRetryingConfirmation(true);
        setBookingError(null);
        try {
            await confirmRazorpayBooking({
                booking: pending.booking,
                payment: pending.payment,
            });
            clearPendingBookingConfirmation({
                userId: currentUserId,
                listingId,
                listingType: effectiveType,
            });
            setBookingSuccess(true);
            setHasExistingBooking(true);
            setBookingPendingSync(false);
            markListingBookedLocally({
                userId: currentUserId,
                listingId,
                listingType: effectiveType,
                listingTitle: title,
                listingImage: image,
            });
            setBookingSyncTick((value) => value + 1);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Booking confirmation retry failed.';
            setBookingError(message);
            setBookingPendingSync(true);
        } finally {
            setRetryingConfirmation(false);
        }
    };

    useEffect(() => {
        setAutoRetryAttempted(false);
    }, [user?.id, listing?.id, effectiveType]);

    useEffect(() => {
        if (!user || !listing?.id || !canFavorite) {
            setIsFavorite(false);
            return;
        }

        const loadFavorite = async () => {
            const favorited = await isListingFavorited(user.id, listing.id, effectiveType);
            setIsFavorite(favorited);
        };

        void loadFavorite();
    }, [canFavorite, effectiveType, listing?.id, user]);

    useEffect(() => {
        if (!user || !listing?.id || !canBook) {
            setHasExistingBooking(false);
            setBookingPendingSync(false);
            return;
        }

        let cancelled = false;
        const loadBookings = async () => {
            try {
                const rows = await getBookings(user.id);
                if (cancelled) return;
                const listingId = String(listing.id).trim();
                const localLookup = getLocalBookedLookup(user.id);
                const locallyBooked = localLookup.byTypeAndId.has(`${effectiveType}:${listingId}`) || localLookup.byId.has(listingId);
                const booked = rows.some((item) => {
                    const status = (item.status || '').toLowerCase();
                    if (status === 'cancelled' || status === 'canceled') return false;
                    return String(item.listing_id || '').trim() === listingId;
                });
                const hasPendingServerBooking = rows.some((item) => {
                    const status = (item.status || '').toLowerCase();
                    if (status !== 'pending') return false;
                    return String(item.listing_id || '').trim() === listingId;
                });
                setHasExistingBooking(booked);
                if (hasPendingServerBooking) {
                    setBookingPendingSync(true);
                } else if (booked) {
                    setBookingPendingSync(false);
                } else if (locallyBooked) {
                    setBookingPendingSync(true);
                } else {
                    setBookingPendingSync(false);
                }
            } catch {
                if (!cancelled) {
                    setHasExistingBooking(false);
                }
            }
        };

        void loadBookings();
        return () => {
            cancelled = true;
        };
    }, [canBook, effectiveType, listing?.id, user, bookingSyncTick]);

    useEffect(() => onBookingSync(() => setBookingSyncTick((value) => value + 1)), []);

    useEffect(() => {
        if (!user?.id || !listing?.id) return;
        if (hasExistingBooking || confirmingBooking || retryingConfirmation || autoRetryAttempted) return;

        const listingId = String(listing.id).trim();
        const pending = getPendingBookingConfirmation({
            userId: user.id,
            listingId,
            listingType: effectiveType,
        });

        if (pending) {
            setBookingPendingSync(true);
            setAutoRetryAttempted(true);
            void retryPendingConfirmation();
        }
    }, [
        user?.id,
        listing?.id,
        effectiveType,
        hasExistingBooking,
        confirmingBooking,
        retryingConfirmation,
        autoRetryAttempted,
    ]);

    const handleBooking = async (event: React.FormEvent) => {
        event.preventDefault();
        const currentUserId = normalizeUuidString(user?.id);
        const listingId = normalizeLooseString(listing?.id) || normalizeLooseString(id);
        if (!currentUserId) {
            setBookingError('Your session expired. Please sign in again.');
            navigate('/auth');
            return;
        }
        if (!listingId) {
            setBookingError('Listing id is invalid. Please reopen this listing from dashboard.');
            return;
        }
        if (!canBook) {
            alert('Only tourist accounts can place bookings.');
            return;
        }
        if (hasExistingBooking) {
            setBookingError('You have already booked this package.');
            return;
        }
        if (bookingPendingSync) {
            setBookingError('Your previous payment is still syncing. Please wait before trying again.');
            return;
        }

        setBookingLoading(true);
        setConfirmingBooking(false);
        setBookingPendingSync(false);
        setBookingError(null);
        let paymentCaptured = false;
        try {
            const bookingDraft = {
                listing_id: listingId,
                listing_type: effectiveType,
                provider_user_id: normalizeUuidString(ownerUserId),
                listing_title: title,
                listing_image: image,
                number_of_people: guests,
                unit_price: unitPrice,
                total_price: total,
                booking_date: checkIn || null,
            };

            const order = await createRazorpayOrder(bookingDraft);
            const payment = await openRazorpayCheckout({
                order,
                booking: bookingDraft,
                prefill: {
                    name: profile?.full_name || undefined,
                    email: user?.email || undefined,
                    contact: profile?.phone || undefined,
                },
            });
            paymentCaptured = true;
            setConfirmingBooking(true);
            setBookingPendingSync(true);

            savePendingBookingConfirmation({
                user_id: currentUserId,
                listing_id: listingId,
                listing_type: effectiveType,
                booking: bookingDraft,
                payment,
                created_at: new Date().toISOString(),
            });

            await confirmRazorpayBooking({
                booking: bookingDraft,
                payment,
            });
            setBookingSuccess(true);
            setHasExistingBooking(true);
            setConfirmingBooking(false);
            setBookingPendingSync(false);
            clearPendingBookingConfirmation({
                userId: currentUserId,
                listingId,
                listingType: effectiveType,
            });
            if (currentUserId) {
                markListingBookedLocally({
                    userId: currentUserId,
                    listingId,
                    listingType: effectiveType,
                    listingTitle: title,
                    listingImage: image,
                });
            }
        } catch (error) {
            console.error('Booking failed:', error);
            const message = error instanceof Error ? error.message : 'Booking failed. Please try again.';
            if (paymentCaptured) {
                setBookingPendingSync(true);
                setBookingError(`Payment captured but confirmation failed: ${message}`);
                if (currentUserId) {
                    markListingBookedLocally({
                        userId: currentUserId,
                        listingId,
                        listingType: effectiveType,
                        listingTitle: title,
                        listingImage: image,
                    });
                }
            } else {
                setBookingError(message);
            }
        } finally {
            setConfirmingBooking(false);
            setBookingLoading(false);
        }
    };

    const handleMessage = async () => {
        if (!user || !ownerUserId || ownerUserId === user.id) return;
        setMessageLoading(true);
        try {
            const conversation = await getOrCreateConversation(user.id, ownerUserId);
            navigate(`/messages?conversation=${conversation.id}`);
        } catch (error) {
            console.error('Conversation start failed:', error);
            alert(error instanceof Error ? error.message : 'Could not start chat right now.');
        } finally {
            setMessageLoading(false);
        }
    };

    const handleFavoriteToggle = async () => {
        if (!user || !listing?.id) {
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
                await removeListingFavorite(user.id, listing.id, effectiveType);
                setIsFavorite(false);
            } else {
                await addListingFavorite(user.id, listing.id, effectiveType);
                setIsFavorite(true);
            }
        } catch (error) {
            console.error('Favorite update failed:', error);
            alert('Could not update favorites. Please try again.');
        } finally {
            setFavoriteLoading(false);
        }
    };

    const handleReviewSave = async () => {
        const listingId = normalizeLooseString(listing?.id) || normalizeLooseString(id);
        if (!user || !listingId) {
            navigate('/auth');
            return;
        }
        if (!canReview) {
            alert('Only tourist accounts can submit ratings.');
            return;
        }
        if (!selectedRating) {
            setReviewError('Select a star rating before saving.');
            return;
        }

        setReviewSaving(true);
        setReviewError(null);
        try {
            const saved = await saveListingReview({
                listingId,
                userId: user.id,
                rating: selectedRating,
            });
            const summaryMap = await getListingReviewSummaryMap([listingId]);
            const latestReviews = await getListingReviews(listingId);
            const summary = summaryMap[listingId];
            setMyReview(saved);
            setReviewAverage(summary?.average_rating ?? null);
            setReviewCount(summary?.review_count ?? 0);
            setReviews(latestReviews);
        } catch (error) {
            console.error('Saving review failed:', error);
            setReviewError(error instanceof Error ? error.message : 'Could not save your rating.');
        } finally {
            setReviewSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="container" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', paddingTop: '120px' }}>
                <Loader2 className="animate-spin" size={38} />
            </main>
        );
    }

    if (!listing) {
        return (
            <main className="container" style={{ minHeight: '70vh', display: 'grid', placeItems: 'center', paddingTop: '120px' }}>
                <h2>Listing not found.</h2>
            </main>
        );
    }

    return (
        <main className="listing-detail-page">
            {confirmingBooking && (
                <div className="listing-payment-overlay" role="status" aria-live="polite" aria-label="Processing payment confirmation">
                    <div className="listing-payment-overlay-card">
                        <Loader2 size={24} className="animate-spin" />
                        <h3>Processing payment...</h3>
                        <p>Please wait while we confirm your booking.</p>
                    </div>
                </div>
            )}
            <div className="container listing-detail-shell">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="listing-detail-back"
                >
                    <ArrowLeft size={16} /> Back
                </button>

                <div className="listing-detail-grid">
                    <section className="listing-detail-card">
                        <div className="listing-detail-hero-image" style={{ backgroundImage: `url(${image})` }} />
                        <div className="listing-detail-content">
                            <div className="listing-detail-meta-row">
                                <span className="listing-detail-type-pill">{displayType}</span>
                                {boosted && (
                                    <span className="listing-detail-boost-pill">
                                        <TrendingUp size={14} /> Boosted
                                    </span>
                                )}
                                <span className={`listing-detail-review-pill${reviewCount ? '' : ' is-empty'}`}>
                                    <Star size={14} fill={reviewCount ? 'currentColor' : 'none'} />
                                    {formatReviewSummary(reviewAverage, reviewCount)}
                                </span>
                                <span className="listing-detail-location-chip">
                                    <MapPin size={14} /> {location}
                                </span>
                            </div>
                            <h1 className="listing-detail-title">{title}</h1>
                            <p className="listing-detail-description">{description}</p>
                            {ownerUserId && (
                                <div className="listing-detail-actions">
                                    <Link to={`/users/${ownerUserId}`} className="btn btn-secondary listing-detail-pill-btn">
                                        View Host
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={handleFavoriteToggle}
                                        className={`btn btn-secondary listing-detail-pill-btn${isFavorite ? ' listing-detail-fav-active' : ''}`}
                                        disabled={favoriteLoading || !canFavorite}
                                        title={canFavorite ? undefined : 'Only tourist accounts can save favorites'}
                                    >
                                        {favoriteLoading ? <Loader2 className="animate-spin" size={16} /> : <Heart size={16} fill={isFavorite ? 'currentColor' : 'none'} />}
                                        {isFavorite ? 'Saved' : 'Save'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className={`listing-book-card${bookingSuccess || hasExistingBooking || confirmingBooking || bookingPendingSync ? ' listing-book-card--booked' : ''}`}>
                        {bookingSuccess || hasExistingBooking || confirmingBooking || bookingPendingSync ? (
                            <div className="listing-book-success">
                                <h3>{confirmingBooking || bookingPendingSync ? 'Confirming booking' : 'Booking confirmed'}</h3>
                                <p>{confirmingBooking || bookingPendingSync ? 'Payment received. We are finalizing your booking now.' : 'Your spot is already reserved for this listing.'}</p>
                                {bookingError && (
                                    <p className="listing-book-warning">{bookingError}</p>
                                )}
                                <div className="listing-book-success-actions">
                                    {bookingPendingSync && (
                                        <button
                                            type="button"
                                            onClick={() => void retryPendingConfirmation()}
                                            className="btn btn-secondary listing-detail-pill-btn listing-detail-center-btn"
                                            disabled={retryingConfirmation}
                                        >
                                            {retryingConfirmation ? <Loader2 className="animate-spin" size={16} /> : 'Retry confirmation'}
                                        </button>
                                    )}
                                    {canMessageProviderAfterBooking && (
                                        <button type="button" onClick={handleMessage} className="btn btn-secondary listing-detail-pill-btn listing-detail-center-btn listing-message-provider-btn" disabled={messageLoading}>
                                            {messageLoading ? <Loader2 className="animate-spin" size={16} /> : <MessageCircle size={16} />}
                                            Message Provider
                                        </button>
                                    )}
                                    <Link to="/profile" className="btn btn-primary listing-detail-pill-btn listing-detail-center-btn">
                                        View My Bookings
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleBooking} className="listing-book-form">
                                <div className="listing-book-head">
                                    <h3>Reserve</h3>
                                    <strong>Rs {unitPrice.toLocaleString()}</strong>
                                </div>

                                <label className="listing-book-field">
                                    <span>Date</span>
                                    <span className="listing-book-input-wrap">
                                        <Calendar size={16} />
                                        <input value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required type="date" />
                                    </span>
                                </label>

                                <label className="listing-book-field">
                                    <span>Travelers</span>
                                    <span className="listing-book-input-wrap">
                                        <Users size={16} />
                                        <select value={guests} onChange={(e) => setGuests(Number(e.target.value))}>
                                            {[1, 2, 3, 4, 5, 6].map((count) => (
                                                <option key={count} value={count}>{count}</option>
                                            ))}
                                        </select>
                                    </span>
                                </label>

                                <div className="listing-book-total">
                                    <span>Total</span>
                                    <strong>Rs {total.toLocaleString()}</strong>
                                </div>

                                {!canBook && (
                                    <p className="listing-book-warning">
                                        Only tourist accounts can place bookings.
                                    </p>
                                )}

                                {bookingError && (
                                    <p className="listing-book-warning">
                                        {bookingError}
                                    </p>
                                )}

                                <button className="btn btn-primary listing-detail-pill-btn listing-detail-center-btn" type="submit" disabled={bookingLoading || !canBook}>
                                    {bookingLoading ? <Loader2 className="animate-spin" size={18} /> : 'Pay & Book'}
                                </button>

                                <p className="listing-book-security">
                                    <ShieldCheck size={14} /> Secure booking, no hidden charges.
                                </p>
                            </form>
                        )}
                    </aside>
                </div>

                <section className="listing-review-section">
                    <div className="listing-review-summary">
                        <div>
                            <p className="listing-review-kicker">Traveler Ratings</p>
                            <h2>Reviews</h2>
                        </div>
                        <div className="listing-review-score-card">
                            <strong>{reviewAverage?.toFixed(1) || '0.0'}</strong>
                            <span>{formatReviewSummary(reviewAverage, reviewCount)}</span>
                        </div>
                    </div>

                    {canReview && (
                        <div className="listing-review-editor">
                            <div>
                                <h3>{myReview ? 'Update your rating' : 'Rate this listing'}</h3>
                                <p>{myReview ? `You rated this ${myReview.rating} star${myReview.rating === 1 ? '' : 's'}.` : 'Leave a star rating for this listing.'}</p>
                            </div>
                            <div className="listing-review-star-row" role="radiogroup" aria-label="Listing rating">
                                {[1, 2, 3, 4, 5].map((value) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`listing-review-star${selectedRating >= value ? ' is-active' : ''}`}
                                        aria-pressed={selectedRating >= value}
                                        onClick={() => setSelectedRating(value)}
                                    >
                                        <Star size={20} fill={selectedRating >= value ? 'currentColor' : 'none'} />
                                        <span>{value}</span>
                                    </button>
                                ))}
                            </div>
                            {reviewError && <p className="listing-review-error">{reviewError}</p>}
                            <button
                                type="button"
                                className="btn btn-primary listing-detail-pill-btn"
                                onClick={() => void handleReviewSave()}
                                disabled={reviewSaving}
                            >
                                {reviewSaving ? <Loader2 className="animate-spin" size={16} /> : myReview ? 'Update Rating' : 'Submit Rating'}
                            </button>
                        </div>
                    )}

                    <div className="listing-review-list">
                        {reviewLoading ? (
                            <div className="listing-review-empty">
                                <Loader2 className="animate-spin" size={18} />
                                <span>Loading reviews...</span>
                            </div>
                        ) : reviews.length > 0 ? (
                            reviews.slice(0, 8).map((review) => (
                                <article key={review.id} className="listing-review-item">
                                    <div className="listing-review-avatar">
                                        {review.reviewer_avatar_url ? (
                                            <img src={review.reviewer_avatar_url} alt={review.reviewer_name || 'Traveler'} />
                                        ) : (
                                            <span>{(review.reviewer_name || 'T').charAt(0).toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className="listing-review-copy">
                                        <div className="listing-review-copy-top">
                                            <strong>{review.reviewer_name || 'Traveler'}</strong>
                                            <span>{new Date(review.updated_at || review.created_at || Date.now()).toLocaleDateString('en-IN')}</span>
                                        </div>
                                        <div className="listing-review-stars" aria-label={`${review.rating} star rating`}>
                                            {Array.from({ length: 5 }).map((_, index) => (
                                                <Star
                                                    key={`${review.id}-star-${index}`}
                                                    size={14}
                                                    fill={index < review.rating ? 'currentColor' : 'none'}
                                                />
                                            ))}
                                            <small>{review.rating}.0</small>
                                        </div>
                                    </div>
                                </article>
                            ))
                        ) : (
                            <div className="listing-review-empty">
                                <Star size={18} />
                                <span>No reviews yet.</span>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
};
