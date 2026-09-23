export const PLATFORM_FEE_RATE = 0.15;

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const normalizePeople = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 1;
    return Math.max(1, Math.floor(value));
};

const normalizeAmount = (value: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return roundMoney(value);
};

export interface PricingBreakdown {
    provider_unit_price: number;
    tourist_unit_price: number;
    number_of_people: number;
    provider_subtotal: number;
    platform_fee_rate: number;
    platform_fee_amount: number;
    total_price: number;
    provider_payout_amount: number;
}

export type ListingFeeBreakdownBasis = 'per_person' | 'per_package';
export type ListingFeeBreakdownStatus = 'included' | 'optional' | 'pay_at_location';

export interface ListingFeeBreakdownItem {
    id: string;
    label: string;
    amount: number;
    basis: ListingFeeBreakdownBasis;
    status: ListingFeeBreakdownStatus;
    note?: string | null;
    is_custom?: boolean;
}

export type ListingFeeDiscountMode = 'percent' | 'flat';

export interface ListingFeeDiscount {
    /** 'percent' reduces the tourist price by a share; 'flat' removes a fixed INR amount. */
    mode: ListingFeeDiscountMode;
    /** Percent value (0-100) for 'percent' mode or flat INR amount for 'flat' mode. */
    value: number;
    /** Optional vendor-facing label, e.g. 'Monsoon offer'. */
    label?: string | null;
}

export interface ListingFeeBreakdown {
    version: 1;
    currency: 'INR';
    items: ListingFeeBreakdownItem[];
    provider_total?: number;
    platform_fee_rate?: number;
    platform_fee_amount?: number;
    tourist_total?: number;
    discount?: ListingFeeDiscount | null;
    updated_at?: string;
}

export interface ListingFeeDiscountResult {
    discount_mode: ListingFeeDiscountMode;
    discount_value: number;
    discount_label: string | null;
    /** Discount percent relative to the pre-discount tourist price. */
    discount_percent: number;
    discount_amount: number;
    /** Tourist price before the discount is applied. */
    tourist_total_before_discount: number;
    tourist_total: number;
    provider_payout_amount: number;
    platform_fee_amount: number;
}

export interface ListingFeePricingBreakdown extends PricingBreakdown {
    provider_per_person_total: number;
    provider_per_package_total: number;
    optional_total: number;
    pay_at_location_total: number;
}

export const getListingDiscountPercent = (
    discount: ListingFeeDiscount | null | undefined,
    touristTotalBeforeDiscount: number,
): number => {
    if (!discount || touristTotalBeforeDiscount <= 0) return 0;
    if (discount.mode === 'percent') {
        return Math.min(100, Math.max(0, discount.value));
    }
    return Math.min(100, (discount.value / touristTotalBeforeDiscount) * 100);
};

/**
 * Applies a vendor discount to a computed tourist price.
 *
 * The discount targets the final tourist price: the tourist pays
 * `touristTotalBeforeDiscount - discountAmount`, the platform fee stays a fixed
 * share of the vendor payout, and the vendor payout shrinks proportionally so
 * payout + platform fee always equal the discounted tourist price.
 */
export const applyListingDiscount = (
    touristTotalBeforeDiscount: number,
    discount: ListingFeeDiscount | null | undefined,
    platformFeeRate = PLATFORM_FEE_RATE,
): ListingFeeDiscountResult => {
    const rate = Number.isFinite(platformFeeRate) && platformFeeRate >= 0 ? platformFeeRate : PLATFORM_FEE_RATE;
    const before = touristTotalBeforeDiscount > 0 ? roundMoney(touristTotalBeforeDiscount) : 0;
    const normalized = normalizeListingDiscount(discount);
    const discountPercent = getListingDiscountPercent(normalized, before);
    const discountAmount = before > 0 ? Math.min(before, percentAmount(before, discountPercent)) : 0;
    const touristTotal = before > 0 ? roundMoney(Math.max(0, before - discountAmount)) : 0;

    // Keep the platform fee share consistent: payout = touristTotal / (1 + rate).
    const providerPayout = touristTotal > 0 ? roundMoney(touristTotal / (1 + rate)) : 0;
    const platformFeeAmount = touristTotal > 0 ? roundMoney(touristTotal - providerPayout) : 0;

    return {
        discount_mode: normalized?.mode || 'percent',
        discount_value: normalized?.value || 0,
        discount_label: normalized?.label || null,
        discount_percent: Math.round(discountPercent * 10) / 10,
        discount_amount: discountAmount,
        tourist_total_before_discount: before,
        tourist_total: touristTotal,
        provider_payout_amount: providerPayout,
        platform_fee_amount: platformFeeAmount,
    };
};

export const describeListingDiscount = (discount: ListingFeeDiscount | null | undefined): string | null => {
    const normalized = normalizeListingDiscount(discount);
    if (!normalized) return null;
    return normalized.mode === 'percent'
        ? `${Math.round(normalized.value)}% off`
        : `Rs ${Math.round(normalized.value)} off`;
};

export const resolveListingDisplayPricing = (args: {
    price: number | null | undefined;
    feeBreakdown?: ListingFeeBreakdown | null;
    peopleCount?: number;
    platformFeeRate?: number;
}): { discountPercent: number; touristTotalBeforeDiscount: number; touristTotal: number } => {
    const people = normalizePeople(args.peopleCount ?? 1);
    const rate = Number.isFinite(args.platformFeeRate) && (args.platformFeeRate as number) >= 0
        ? (args.platformFeeRate as number)
        : PLATFORM_FEE_RATE;
    const breakdownPricing = args.feeBreakdown
        ? calculatePricingFromFeeBreakdown(args.feeBreakdown, people, rate)
        : calculatePricingFromProviderUnit(Number(args.price || 0), people, rate);
    const result = applyListingDiscount(breakdownPricing.total_price, args.feeBreakdown?.discount, rate);

    return {
        discountPercent: result.discount_percent,
        touristTotalBeforeDiscount: result.tourist_total_before_discount,
        touristTotal: result.tourist_total || breakdownPricing.total_price,
    };
};

const isFeeBasis = (value: unknown): value is ListingFeeBreakdownBasis => (
    value === 'per_person' || value === 'per_package'
);

const isFeeStatus = (value: unknown): value is ListingFeeBreakdownStatus => (
    value === 'included' || value === 'optional' || value === 'pay_at_location'
);

const normalizeCurrency = (value: unknown): 'INR' => (value === 'INR' ? 'INR' : 'INR');

export const MAX_LISTING_DISCOUNT_PERCENT = 90;

export const isListingDiscountMode = (value: unknown): value is ListingFeeDiscountMode => (
    value === 'percent' || value === 'flat'
);

export const normalizeListingDiscount = (value: unknown): ListingFeeDiscount | null => {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const mode = isListingDiscountMode(row.mode) ? row.mode : 'percent';
    const rawValue = Number(row.value);
    if (!Number.isFinite(rawValue) || rawValue <= 0) return null;
    if (mode === 'percent' && rawValue > MAX_LISTING_DISCOUNT_PERCENT) return null;
    return {
        mode,
        value: mode === 'percent' ? Math.round(rawValue * 100) / 100 : roundMoney(rawValue),
        label: typeof row.label === 'string' && row.label.trim() ? row.label.trim() : null,
    };
};

const percentAmount = (base: number, percent: number): number => roundMoney(base * (percent / 100));

const normalizeFeeItem = (value: unknown): ListingFeeBreakdownItem | null => {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const amount = normalizeAmount(typeof row.amount === 'number' ? row.amount : Number(row.amount || 0));
    if (!label || amount <= 0) return null;

    return {
        id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label,
        amount,
        basis: isFeeBasis(row.basis) ? row.basis : 'per_person',
        status: isFeeStatus(row.status) ? row.status : 'included',
        note: typeof row.note === 'string' && row.note.trim() ? row.note.trim() : null,
        is_custom: row.is_custom === true,
    };
};

export const normalizeListingFeeBreakdown = (value: unknown): ListingFeeBreakdown | null => {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, unknown>;
    const rawItems = Array.isArray(row.items) ? row.items : [];
    const items = rawItems
        .map((item) => normalizeFeeItem(item))
        .filter((item): item is ListingFeeBreakdownItem => Boolean(item));

    if (!items.length) return null;

    return {
        version: 1,
        currency: normalizeCurrency(row.currency),
        items,
        provider_total: normalizeAmount(Number(row.provider_total || 0)) || undefined,
        platform_fee_rate: Number.isFinite(Number(row.platform_fee_rate)) ? Number(row.platform_fee_rate) : undefined,
        platform_fee_amount: normalizeAmount(Number(row.platform_fee_amount || 0)) || undefined,
        tourist_total: normalizeAmount(Number(row.tourist_total || 0)) || undefined,
        discount: normalizeListingDiscount(row.discount),
        updated_at: typeof row.updated_at === 'string' ? row.updated_at : undefined,
    };
};

export const calculatePricingFromProviderUnit = (
    providerUnitPrice: number,
    peopleCount = 1,
    feeRate = PLATFORM_FEE_RATE
): PricingBreakdown => {
    const providerUnit = normalizeAmount(providerUnitPrice);
    const people = normalizePeople(peopleCount);
    const rate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : PLATFORM_FEE_RATE;
    const touristUnit = roundMoney(providerUnit * (1 + rate));
    const providerSubtotal = roundMoney(providerUnit * people);
    const totalPrice = roundMoney(touristUnit * people);
    const platformFeeAmount = roundMoney(totalPrice - providerSubtotal);

    return {
        provider_unit_price: providerUnit,
        tourist_unit_price: touristUnit,
        number_of_people: people,
        provider_subtotal: providerSubtotal,
        platform_fee_rate: rate,
        platform_fee_amount: platformFeeAmount,
        total_price: totalPrice,
        provider_payout_amount: providerSubtotal,
    };
};

export const calculatePricingFromFeeBreakdown = (
    feeBreakdown: ListingFeeBreakdown | null | undefined,
    peopleCount = 1,
    feeRate = PLATFORM_FEE_RATE
): ListingFeePricingBreakdown => {
    const people = normalizePeople(peopleCount);
    const rate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : PLATFORM_FEE_RATE;
    const items = feeBreakdown?.items || [];

    const providerPerPersonTotal = roundMoney(items.reduce((sum, item) => (
        item.status === 'included' && item.basis === 'per_person'
            ? sum + normalizeAmount(item.amount)
            : sum
    ), 0));
    const providerPerPackageTotal = roundMoney(items.reduce((sum, item) => (
        item.status === 'included' && item.basis === 'per_package'
            ? sum + normalizeAmount(item.amount)
            : sum
    ), 0));
    const providerSubtotal = roundMoney((providerPerPersonTotal * people) + providerPerPackageTotal);
    const platformFeeAmount = roundMoney(providerSubtotal * rate);
    const totalPrice = roundMoney(providerSubtotal + platformFeeAmount);
    const providerUnitPrice = people > 0 ? roundMoney(providerSubtotal / people) : providerSubtotal;
    const touristUnitPrice = people > 0 ? roundMoney(totalPrice / people) : totalPrice;
    const optionalTotal = roundMoney(items.reduce((sum, item) => (
        item.status === 'optional' ? sum + normalizeAmount(item.amount) : sum
    ), 0));
    const payAtLocationTotal = roundMoney(items.reduce((sum, item) => (
        item.status === 'pay_at_location' ? sum + normalizeAmount(item.amount) : sum
    ), 0));

    return {
        provider_unit_price: providerUnitPrice,
        tourist_unit_price: touristUnitPrice,
        number_of_people: people,
        provider_subtotal: providerSubtotal,
        platform_fee_rate: rate,
        platform_fee_amount: platformFeeAmount,
        total_price: totalPrice,
        provider_payout_amount: providerSubtotal,
        provider_per_person_total: providerPerPersonTotal,
        provider_per_package_total: providerPerPackageTotal,
        optional_total: optionalTotal,
        pay_at_location_total: payAtLocationTotal,
    };
};

export const buildListingFeeBreakdownForStorage = (
    feeBreakdown: ListingFeeBreakdown,
    feeRate = PLATFORM_FEE_RATE
): ListingFeeBreakdown | null => {
    const normalized = normalizeListingFeeBreakdown(feeBreakdown);
    if (!normalized) return null;
    const pricing = calculatePricingFromFeeBreakdown(normalized, 1, feeRate);
    if (pricing.provider_subtotal <= 0) return null;

    // Stored totals reflect the final discounted tourist price when a discount is set.
    const discountResult = applyListingDiscount(pricing.total_price, normalized.discount, feeRate);
    const hasDiscount = discountResult.discount_amount > 0;

    return {
        ...normalized,
        provider_total: hasDiscount ? discountResult.provider_payout_amount : pricing.provider_subtotal,
        platform_fee_rate: pricing.platform_fee_rate,
        platform_fee_amount: hasDiscount ? discountResult.platform_fee_amount : pricing.platform_fee_amount,
        tourist_total: hasDiscount ? discountResult.tourist_total : pricing.total_price,
        updated_at: new Date().toISOString(),
    };
};

export const deriveBookingAmounts = (args: {
    unitPrice: number;
    totalPrice: number;
    numberOfPeople: number;
    platformFeeRate?: number | null;
    platformFeeAmount?: number | null;
    providerPayoutAmount?: number | null;
}) => {
    const people = normalizePeople(args.numberOfPeople);
    const unit = normalizeAmount(args.unitPrice);
    const total = normalizeAmount(args.totalPrice);
    const providerSubtotal = unit > 0 ? roundMoney(unit * people) : 0;
    const fallbackRate = Number.isFinite(args.platformFeeRate) && (args.platformFeeRate as number) >= 0
        ? (args.platformFeeRate as number)
        : PLATFORM_FEE_RATE;
    const fallbackFromUnit = calculatePricingFromProviderUnit(unit, people, fallbackRate);
    const effectiveTotal = total > 0 ? total : fallbackFromUnit.total_price;

    const providerPayout = normalizeAmount(args.providerPayoutAmount ?? 0) || providerSubtotal || fallbackFromUnit.provider_payout_amount;
    const platformFee = normalizeAmount(args.platformFeeAmount ?? 0) || roundMoney(Math.max(0, effectiveTotal - providerPayout));
    const effectiveRate = providerPayout > 0
        ? platformFee / providerPayout
        : fallbackFromUnit.platform_fee_rate;
    const touristUnit = people > 0 ? roundMoney(effectiveTotal / people) : fallbackFromUnit.tourist_unit_price;

    return {
        provider_unit_price: unit || fallbackFromUnit.provider_unit_price,
        tourist_unit_price: touristUnit,
        number_of_people: people,
        provider_subtotal: providerPayout,
        platform_fee_rate: effectiveRate,
        platform_fee_amount: platformFee,
        total_price: effectiveTotal,
        provider_payout_amount: providerPayout,
    };
};
