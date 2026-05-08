import React, { useEffect, useState } from 'react';
import { Heart, Loader2, MapPin } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { addListingFavorite, isListingFavorited, removeListingFavorite } from '../lib/destinations';
import type { ListingType } from '../lib/platform';
import './listing-card.css';

interface DestinationProps {
    id: string;
    title: string;
    location: string;
    price: number;
    rating?: number;
    image_url: string;
    description?: string;
    category?: string;
    listingType?: ListingType;
}

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

export const DestinationCard: React.FC<DestinationProps> = ({
    id,
    title,
    location,
    price,
    image_url,
    description,
    category,
    listingType = 'activity',
}) => {
    const navigate = useNavigate();
    const { user, profile } = useAuth();
    const canFavorite = profile?.role === 'tourist';
    const [isFavorite, setIsFavorite] = useState(false);
    const [favoriteLoading, setFavoriteLoading] = useState(false);
    const listingPathType = listingType === 'guide' ? 'event' : listingType;
    const subtitle = description?.trim() || 'Curated listing with complete details available on open.';
    const locationLabel = location?.split(',')[0]?.trim() || 'Location available after booking';
    const chipLabel = category?.trim() || listingPathType.toUpperCase();
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
                    <span className="listing-card-chip">{chipLabel}</span>
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

                {!image_url && (
                    <div className="listing-card-fallback-text" aria-hidden="true">
                        {title.charAt(0).toUpperCase()}
                    </div>
                )}

                <div className="listing-card-title-static-wrap">
                    <h3 className="listing-card-title-static">{title}</h3>
                </div>

                <div className="listing-card-reveal-panel">
                    <h3 className="listing-card-title">{title}</h3>
                    <p className="listing-card-sub">{subtitle}</p>

                    <div className="listing-card-meta">
                        <span className="listing-card-meta-item">
                            <MapPin size={14} />
                            <span>{locationLabel}</span>
                        </span>
                    </div>

                    <div className="listing-card-actions">
                        <span className="listing-card-price">{priceLabel}</span>
                        <Link
                            to={`/listings/${listingPathType}/${id}`}
                            className="listing-btn-book"
                            onClick={(event) => event.stopPropagation()}
                        >
                            Book Now
                        </Link>
                    </div>
                </div>
            </div>

            <div className="listing-card-mobile-content">
                <h3 className="listing-card-title">{title}</h3>
                <p className="listing-card-sub">{subtitle}</p>

                <div className="listing-card-meta">
                    <span className="listing-card-meta-item">
                        <MapPin size={14} />
                        <span>{locationLabel}</span>
                    </span>
                </div>

                <div className="listing-card-actions">
                    <span className="listing-card-price">{priceLabel}</span>
                    <Link to={`/listings/${listingPathType}/${id}`} className="listing-btn-book" onClick={(event) => event.stopPropagation()}>
                        Book Now
                    </Link>
                </div>
            </div>
        </article>
    );
};
