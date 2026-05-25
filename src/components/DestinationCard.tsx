import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { addListingFavorite, isListingFavorited, removeListingFavorite } from '../lib/destinations';
import { calculatePricingFromProviderUnit } from '../lib/pricing';
import type { ListingType } from '../lib/platform';
import './listing-card.css';

interface DestinationProps {
    id: string;
    title: string;
    location: string;
    price: number;
    rating?: number;
    reviewCount?: number;
    image_url: string;
    description?: string;
    category?: string;
    listingType?: ListingType;
    isBooked?: boolean;
    isBoosted?: boolean;
}

const formatPrice = (providerPrice: number | null | undefined): string => {
    if (typeof providerPrice !== 'number' || Number.isNaN(providerPrice) || providerPrice <= 0) {
        return 'Price on request';
    }
    const touristPrice = calculatePricingFromProviderUnit(providerPrice, 1).tourist_unit_price;

    return `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(touristPrice)}`;
};

const limitWords = (value: string, maxWords: number): string => {
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return value.trim();
    return `${words.slice(0, maxWords).join(' ')}...`;
};

export const DestinationCard: React.FC<DestinationProps> = ({
    id,
    title,
    price,
    image_url,
    description,
    listingType = 'activity',
    isBooked = false,
    isBoosted = false,
}) => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const canFavorite = profile?.role === 'tourist';
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const listingPathType = listingType === 'guide' ? 'event' : listingType;
    const displayTitle = limitWords(title, 6);
    const subtitle = description?.trim()
        ? limitWords(description, 12)
        : 'Curated listing with complete details available on open.';
    const priceLabel = formatPrice(price);

    useEffect(() => {
        if (!user || !id || !canFavorite) {
            setIsFavorite(false);
            return;
        }

        const loadFavorite = async () => {
            const favorited = await isListingFavorited(user.id, id, listingType);
            setIsFavorite(favorited);
        };

        void loadFavorite();
    }, [canFavorite, id, listingType, user]);

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
                await removeListingFavorite(user.id, id, listingType);
                setIsFavorite(false);
            } else {
                await addListingFavorite(user.id, id, listingType);
                setIsFavorite(true);
            }
        } catch (error) {
            console.error('Favorite update failed:', error);
            alert('Could not update favorites. Please try again.');
        } finally {
            setFavoriteLoading(false);
        }
    };

    const openListing = () => navigate(`/listings/${listingPathType}/${id}`);
    const handleCardKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openListing();
        }
    };
    const mediaStyle = image_url ? { backgroundImage: `url(${image_url})` } : undefined;

    return (
        <article
            className="listing-card"
            role="link"
            tabIndex={0}
            onClick={openListing}
            onKeyDown={handleCardKeyDown}
            aria-label={`Open ${title}`}
        >
            <div className={`listing-card-media${image_url ? '' : ' is-fallback'}`} style={mediaStyle}>
                <div className="listing-card-media-overlay" />

                <div className="listing-card-media-top">
                    <div className="listing-card-badge-cluster">
                        {isBooked && <span className="listing-card-booked-pill">Booked</span>}
                        {isBoosted && (
                            <span className="listing-card-boost-badge" aria-label="Boosted listing" title="Boosted">
                                <ArrowUpRight size={15} />
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className={`listing-card-fav-btn${isFavorite ? ' is-active' : ''}`}
                        onClick={handleFavoriteToggle}
                        disabled={favoriteLoading}
                        title={isFavorite ? 'Remove from saved' : 'Save listing'}
                        aria-label={isFavorite ? 'Remove from saved listings' : 'Save listing'}
                    >
                        {favoriteLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Bookmark size={18} fill={isFavorite ? 'currentColor' : 'none'} />
                        )}
                    </button>
                </div>

                {!image_url && (
                    <div className="listing-card-fallback-text" aria-hidden="true">
                        {title.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="listing-card-title-static-wrap">
                    <h3 className="listing-card-title-static">{title}</h3>
                </div>

                <div className="listing-card-reveal-panel">
                    <h3 className="listing-card-title">{displayTitle}</h3>
                    <p className="listing-card-sub">{subtitle}</p>

                    <div className="listing-card-actions">
                        <span className="listing-card-price">{priceLabel}</span>
                        <Link
                            to={`/listings/${listingPathType}/${id}`}
                            className="listing-btn-book"
                            onClick={(event) => event.stopPropagation()}
                        >
                            BOOK
                        </Link>
                    </div>
                </div>
            </div>

            <div className="listing-card-mobile-content">
                <h3 className="listing-card-title">{displayTitle}</h3>
                <p className="listing-card-sub">{subtitle}</p>

                <div className="listing-card-actions">
                    <span className="listing-card-price">{priceLabel}</span>
                    <Link to={`/listings/${listingPathType}/${id}`} className="listing-btn-book" onClick={(event) => event.stopPropagation()}>
                        BOOK
                    </Link>
                </div>
            </div>
        </article>
    );
};
