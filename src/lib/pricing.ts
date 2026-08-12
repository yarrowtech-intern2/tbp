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

export interface ListingFeeBreakdown {
    version: 1;
    currency: 'INR';
    items: ListingFeeBreakdownItem[];
    provider_total?: number;
    platform_fee_rate?: number;
    platform_fee_amount?: number;
    tourist_total?: number;
    updated_at?: string;
}

export interface ListingFeePricingBreakdown extends PricingBreakdown {
    provider_per_person_total: number;
    provider_per_package_total: number;
    optional_total: number;
    pay_at_location_total: number;
}

const isFeeBasis = (value: unknown): value is ListingFeeBreakdownBasis => (
    value === 'per_person' || value === 'per_package'
);

const isFeeStatus = (value: unknown): value is ListingFeeBreakdownStatus => (
    value === 'included' || value === 'optional' || value === 'pay_at_location'
);

const normalizeCurrency = (value: unknown): 'INR' => (value === 'INR' ? 'INR' : 'INR');

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

    return {
        ...normalized,
        provider_total: pricing.provider_subtotal,
        platform_fee_rate: pricing.platform_fee_rate,
        platform_fee_amount: pricing.platform_fee_amount,
        tourist_total: pricing.total_price,
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
