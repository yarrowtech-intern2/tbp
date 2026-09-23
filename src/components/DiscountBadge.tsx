import React from 'react';
import { resolveListingDisplayPricing } from '../lib/pricing';
import './discount-badge.css';

type DiscountBadgeProps = {
    discountPercent: number;
    variant?: 'starburst' | 'pill';
    className?: string;
};

/**
 * High-visibility discount badge for public listing cards.
 * Renders a yellow starburst (like classic sale stickers) by default.
 */
export const DiscountBadge: React.FC<DiscountBadgeProps> = ({
    discountPercent,
    variant = 'starburst',
    className = '',
}) => {
    const percent = Math.round(discountPercent);
    if (!Number.isFinite(percent) || percent <= 0) return null;

    if (variant === 'pill') {
        return (
            <span className={`discount-badge-pill${className ? ` ${className}` : ''}`}>
                {percent}% OFF
            </span>
        );
    }

    return (
        <span className={`discount-badge-starburst${className ? ` ${className}` : ''}`} aria-label={`${percent} percent off`}>
            <span className="discount-badge-starburst-text">
                <strong>{percent}%</strong>
                <em>OFF</em>
            </span>
        </span>
    );
};

/** Convenience helper: builds badge props from a raw listing record. */
export const getListingDiscountPercentForCard = (listing: {
    price?: number | null;
    fee_breakdown?: { discount?: unknown } | null;
} | null | undefined): number => {
    if (!listing) return 0;
    const discount = listing.fee_breakdown?.discount;
    if (!discount || typeof discount !== 'object') return 0;
    const row = discount as { mode?: unknown; value?: unknown };
    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (row.mode === 'percent') return Math.min(100, value);
    // Flat discount needs the pre-discount tourist price to compute a percent.
    const pricing = resolveListingDisplayPricing({
        price: listing.price,
        feeBreakdown: listing.fee_breakdown as never,
    });
    return pricing.discountPercent;
};
