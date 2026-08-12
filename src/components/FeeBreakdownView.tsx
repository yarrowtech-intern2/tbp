import React, { useMemo } from 'react';
import {
    PLATFORM_FEE_RATE,
    calculatePricingFromFeeBreakdown,
    normalizeListingFeeBreakdown,
    type ListingFeeBreakdown,
    type ListingFeeBreakdownBasis,
    type ListingFeeBreakdownStatus,
} from '../lib/pricing';
import './fee-breakdown-view.css';

type FeeBreakdownViewProps = {
    feeBreakdown?: ListingFeeBreakdown | null;
    peopleCount?: number;
    platformFeeRate?: number;
    title?: string;
    compact?: boolean;
    showUnavailable?: boolean;
    className?: string;
};

const formatCurrency = (value: number) => `Rs ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
}).format(Math.max(0, Math.round(value)))}`;

const basisLabel = (basis: ListingFeeBreakdownBasis) => (
    basis === 'per_package' ? 'Per package' : 'Per person'
);

const statusLabel = (status: ListingFeeBreakdownStatus) => {
    if (status === 'optional') return 'Optional';
    if (status === 'pay_at_location') return 'Pay at location';
    return 'Included';
};

export const FeeBreakdownView: React.FC<FeeBreakdownViewProps> = ({
    feeBreakdown,
    peopleCount = 1,
    platformFeeRate,
    title = 'Fee breakdown',
    compact = false,
    showUnavailable = true,
    className = '',
}) => {
    const normalized = useMemo(() => normalizeListingFeeBreakdown(feeBreakdown), [feeBreakdown]);
    const effectivePlatformFeeRate = platformFeeRate ?? normalized?.platform_fee_rate ?? PLATFORM_FEE_RATE;
    const pricing = useMemo(
        () => calculatePricingFromFeeBreakdown(normalized, peopleCount, effectivePlatformFeeRate),
        [normalized, peopleCount, effectivePlatformFeeRate],
    );

    if (!normalized) {
        if (!showUnavailable) return null;
        return (
            <section className={`fee-breakdown-view${compact ? ' fee-breakdown-view--compact' : ''}${className ? ` ${className}` : ''}`}>
                <div className="fbv-head">
                    <h2>{title}</h2>
                </div>
                <div className="fbv-empty">Not provided</div>
            </section>
        );
    }

    return (
        <section className={`fee-breakdown-view${compact ? ' fee-breakdown-view--compact' : ''}${className ? ` ${className}` : ''}`}>
            <div className="fbv-head">
                <h2>{title}</h2>
                {peopleCount > 1 && <span>{peopleCount} travelers</span>}
            </div>

            <div className="fbv-list">
                {normalized.items.map((item) => {
                    const displayAmount = item.basis === 'per_person'
                        ? item.amount * peopleCount
                        : item.amount;
                    return (
                        <div key={item.id} className="fbv-row">
                            <div className="fbv-row-main">
                                <strong>{item.label}</strong>
                                <div className="fbv-pills">
                                    <span>{basisLabel(item.basis)}</span>
                                    <span>{statusLabel(item.status)}</span>
                                </div>
                                {item.note && <p>{item.note}</p>}
                            </div>
                            <strong className="fbv-amount">{formatCurrency(displayAmount)}</strong>
                        </div>
                    );
                })}
            </div>

            <div className="fbv-totals">
                <div>
                    <span>Vendor package fee</span>
                    <strong>{formatCurrency(pricing.provider_subtotal)}</strong>
                </div>
                <div>
                    <span>Platform fee ({Math.round(pricing.platform_fee_rate * 100)}%)</span>
                    <strong>{formatCurrency(pricing.platform_fee_amount)}</strong>
                </div>
                <div>
                    <span>Tourist total</span>
                    <strong>{formatCurrency(pricing.total_price)}</strong>
                </div>
                {pricing.optional_total > 0 && (
                    <div>
                        <span>Optional items</span>
                        <strong>{formatCurrency(pricing.optional_total)}</strong>
                    </div>
                )}
                {pricing.pay_at_location_total > 0 && (
                    <div>
                        <span>Pay at location</span>
                        <strong>{formatCurrency(pricing.pay_at_location_total)}</strong>
                    </div>
                )}
            </div>
        </section>
    );
};
