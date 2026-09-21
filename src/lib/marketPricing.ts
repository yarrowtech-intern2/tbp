import type { PostRecord } from './destinations';
import type { ListingType } from './platform';
import {
    PLATFORM_FEE_RATE,
    calculatePricingFromProviderUnit,
    type ListingFeeBreakdown,
} from './pricing';

export type MarketPriceStatus = 'too_low' | 'low' | 'fair' | 'high' | 'too_high';
export type MarketConfidence = 'low' | 'medium' | 'high';

export interface MarketComparableTrip {
    title: string;
    location: string;
    providerPrice: number;
    touristPrice: number;
    score: number;
    source: 'marketplace' | 'global_benchmark';
}

export interface MarketPriceInsight {
    status: MarketPriceStatus;
    statusLabel: string;
    statusTone: 'positive' | 'warning' | 'danger' | 'neutral';
    headline: string;
    currentProviderPrice: number;
    currentTouristPrice: number;
    marketAverageProviderPrice: number;
    marketAverageTouristPrice: number;
    marketMedianProviderPrice: number;
    marketLowProviderPrice: number;
    marketHighProviderPrice: number;
    suggestedProviderPrice: number;
    suggestedTouristPrice: number;
    differencePercent: number;
    confidence: MarketConfidence;
    localComparableCount: number;
    benchmarkComparableCount: number;
    similarTrips: MarketComparableTrip[];
    signals: string[];
}

export interface MarketPriceInput {
    listingType: ListingType;
    title?: string | null;
    location?: string | null;
    category?: string | null;
    description?: string | null;
    providerPrice: number;
    touristPrice: number;
    platformFeeRate?: number;
    feeBreakdown?: ListingFeeBreakdown | null;
    comparables?: PostRecord[];
    excludeListingId?: string | null;
}

type BenchmarkProfile = {
    label: string;
    type: ListingType;
    min: number;
    max: number;
    keywords: string[];
    durationMode?: 'multiply_by_days' | 'single_session';
};

const BENCHMARKS: BenchmarkProfile[] = [
    {
        label: 'Global day-tour benchmark',
        type: 'tour',
        min: 1800,
        max: 6500,
        keywords: ['day', 'city', 'heritage', 'walking', 'sightseeing', 'local'],
        durationMode: 'multiply_by_days',
    },
    {
        label: 'Global multi-day tour benchmark',
        type: 'tour',
        min: 7000,
        max: 18000,
        keywords: ['multi', 'package', 'circuit', 'stay', 'transport', 'meals', 'hotel'],
        durationMode: 'multiply_by_days',
    },
    {
        label: 'Global premium tour benchmark',
        type: 'tour',
        min: 16000,
        max: 34000,
        keywords: ['premium', 'private', 'luxury', 'boutique', 'resort', 'exclusive'],
        durationMode: 'multiply_by_days',
    },
    {
        label: 'Global guided activity benchmark',
        type: 'activity',
        min: 900,
        max: 4500,
        keywords: ['workshop', 'class', 'wellness', 'food', 'culture', 'local'],
        durationMode: 'single_session',
    },
    {
        label: 'Global adventure activity benchmark',
        type: 'activity',
        min: 2500,
        max: 12000,
        keywords: ['adventure', 'kayak', 'trek', 'rafting', 'climb', 'safari', 'equipment'],
        durationMode: 'single_session',
    },
    {
        label: 'Global local guide benchmark',
        type: 'guide',
        min: 1200,
        max: 5500,
        keywords: ['guide', 'walk', 'market', 'culture', 'food', 'neighborhood'],
        durationMode: 'single_session',
    },
    {
        label: 'Global virtual/live guide benchmark',
        type: 'guide',
        min: 600,
        max: 2600,
        keywords: ['virtual', 'live', 'ar', 'vr', 'camera', 'stream'],
        durationMode: 'single_session',
    },
];

const STOP_WORDS = new Set([
    'the',
    'and',
    'for',
    'with',
    'from',
    'into',
    'your',
    'this',
    'that',
    'tour',
    'trip',
    'package',
    'activity',
    'event',
    'guide',
]);

const roundMoney = (value: number): number => Math.round(value * 100) / 100;
const roundToNearest = (value: number, unit: number): number => Math.max(unit, Math.round(value / unit) * unit);

const normalizeAmount = (value: unknown): number => {
    const amount = typeof value === 'number' ? value : Number(value || 0);
    return Number.isFinite(amount) && amount > 0 ? roundMoney(amount) : 0;
};

const tokenize = (...values: Array<string | null | undefined>): Set<string> => {
    const words = values
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z0-9\s/-]+/g, ' ')
        .split(/\s+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
    return new Set(words);
};

const overlapRatio = (a: Set<string>, b: Set<string>): number => {
    if (!a.size || !b.size) return 0;
    let matches = 0;
    a.forEach((token) => {
        if (b.has(token)) matches += 1;
    });
    return matches / Math.max(a.size, b.size);
};

const extractDurationDays = (...values: Array<string | null | undefined>): number => {
    const text = values.join(' ').toLowerCase();
    const compact = text.match(/(\d+)\s*d\s*\/\s*(\d+)\s*n/);
    if (compact) return Math.max(1, Number(compact[1]) || 1);

    const days = text.match(/(\d+)\s*(day|days|d)\b/);
    if (days) return Math.max(1, Number(days[1]) || 1);

    const nights = text.match(/(\d+)\s*(night|nights|n)\b/);
    if (nights) return Math.max(1, (Number(nights[1]) || 0) + 1);

    return 1;
};

const getIncludedTokens = (feeBreakdown?: ListingFeeBreakdown | null): Set<string> => (
    tokenize(...(feeBreakdown?.items || [])
        .filter((item) => item.status === 'included' && normalizeAmount(item.amount) > 0)
        .map((item) => `${item.label || ''} ${item.note || ''}`))
);

const median = (values: number[]): number => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? roundMoney((sorted[middle - 1] + sorted[middle]) / 2)
        : sorted[middle];
};

const percentile = (values: number[], fraction: number): number => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * fraction)));
    return sorted[index];
};

const getPostPrice = (post: PostRecord): number => {
    const feeTotal = normalizeAmount(post.fee_breakdown?.provider_total);
    if (feeTotal > 0) return feeTotal;
    return normalizeAmount(post.price);
};

const buildMarketplaceComparables = (input: MarketPriceInput): MarketComparableTrip[] => {
    const targetTokens = tokenize(input.title, input.location, input.category, input.description);
    const locationTokens = tokenize(input.location);
    const categoryTokens = tokenize(input.category);
    const includedTokens = getIncludedTokens(input.feeBreakdown);
    const durationDays = extractDurationDays(input.title, input.description, input.category);

    return (input.comparables || [])
        .filter((post) => post.id !== input.excludeListingId)
        .map((post): MarketComparableTrip | null => {
            const providerPrice = getPostPrice(post);
            if (providerPrice <= 0) return null;

            const postType = typeof post.type === 'string' ? post.type : null;
            if (postType && postType !== input.listingType) return null;

            const postTokens = tokenize(post.title, post.name, post.location, post.sub_category, post.description);
            const postLocationTokens = tokenize(post.location);
            const postCategoryTokens = tokenize(post.sub_category);
            const postIncludedTokens = getIncludedTokens(post.fee_breakdown);
            const postDurationDays = extractDurationDays(post.title, post.name, post.description, post.sub_category);
            const durationScore = 1 - Math.min(Math.abs(durationDays - postDurationDays), 5) / 5;
            const inclusionScore = includedTokens.size && postIncludedTokens.size
                ? overlapRatio(includedTokens, postIncludedTokens)
                : 0;
            const score = roundMoney(
                (overlapRatio(targetTokens, postTokens) * 0.3)
                + (overlapRatio(locationTokens, postLocationTokens) * 0.25)
                + (overlapRatio(categoryTokens, postCategoryTokens) * 0.16)
                + (durationScore * 0.14)
                + (inclusionScore * 0.15)
            );

            if (score < 0.14) return null;

            return {
                title: post.title || post.name || 'Similar listing',
                location: post.location || 'Global marketplace',
                providerPrice,
                touristPrice: normalizeAmount(post.fee_breakdown?.tourist_total)
                    || calculatePricingFromProviderUnit(providerPrice, 1, input.platformFeeRate ?? PLATFORM_FEE_RATE).tourist_unit_price,
                score,
                source: 'marketplace',
            };
        })
        .filter((item): item is MarketComparableTrip => Boolean(item))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
};

const buildBenchmarkComparables = (input: MarketPriceInput): MarketComparableTrip[] => {
    const tokens = tokenize(input.title, input.location, input.category, input.description);
    const durationDays = extractDurationDays(input.title, input.description, input.category);
    const feeRate = input.platformFeeRate ?? PLATFORM_FEE_RATE;
    const includedTokens = getIncludedTokens(input.feeBreakdown);
    const includedBonus = includedTokens.size >= 4 ? 1.08 : includedTokens.size >= 2 ? 1.03 : 1;

    return BENCHMARKS
        .filter((profile) => profile.type === input.listingType)
        .map((profile): MarketComparableTrip => {
            const keywordTokens = new Set(profile.keywords);
            const match = overlapRatio(tokens, keywordTokens);
            const multiplier = profile.durationMode === 'multiply_by_days' ? Math.max(1, durationDays) : 1;
            const midpoint = ((profile.min + profile.max) / 2) * multiplier * includedBonus;
            const adjusted = match > 0 ? midpoint * (1 + Math.min(match, 0.35)) : midpoint;
            const providerPrice = roundToNearest(adjusted, 100);
            return {
                title: profile.label,
                location: 'Global benchmark',
                providerPrice,
                touristPrice: calculatePricingFromProviderUnit(providerPrice, 1, feeRate).tourist_unit_price,
                score: roundMoney(0.38 + Math.min(match, 0.32)),
                source: 'global_benchmark',
            };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
};

const getStatus = (differencePercent: number): MarketPriceStatus => {
    if (differencePercent <= -25) return 'too_low';
    if (differencePercent <= -10) return 'low';
    if (differencePercent >= 25) return 'too_high';
    if (differencePercent >= 10) return 'high';
    return 'fair';
};

const getStatusCopy = (status: MarketPriceStatus): Pick<MarketPriceInsight, 'statusLabel' | 'statusTone' | 'headline'> => {
    switch (status) {
        case 'too_low':
            return {
                statusLabel: 'Too low',
                statusTone: 'danger',
                headline: 'Your price is far below similar trips.',
            };
        case 'low':
            return {
                statusLabel: 'Low',
                statusTone: 'warning',
                headline: 'Your price is lower than the market range.',
            };
        case 'high':
            return {
                statusLabel: 'High',
                statusTone: 'warning',
                headline: 'Your price is higher than similar trips.',
            };
        case 'too_high':
            return {
                statusLabel: 'Too high',
                statusTone: 'danger',
                headline: 'Your price is far above similar trips.',
            };
        default:
            return {
                statusLabel: 'Fair',
                statusTone: 'positive',
                headline: 'Your price is within the expected market range.',
            };
    }
};

export const buildMarketPriceInsight = (input: MarketPriceInput): MarketPriceInsight | null => {
    const providerPrice = normalizeAmount(input.providerPrice);
    const touristPrice = normalizeAmount(input.touristPrice);
    if (providerPrice <= 0) return null;

    const marketplaceComparables = buildMarketplaceComparables(input);
    const benchmarkComparables = buildBenchmarkComparables(input);
    const comparables = [...marketplaceComparables, ...benchmarkComparables];
    if (!comparables.length) return null;

    const weightedPrices = comparables.flatMap((item) => {
        const weight = item.source === 'marketplace' ? Math.max(2, Math.round(item.score * 8)) : Math.max(1, Math.round(item.score * 4));
        return Array.from({ length: weight }, () => item.providerPrice);
    });
    const prices = weightedPrices.length ? weightedPrices : comparables.map((item) => item.providerPrice);
    const average = roundMoney(prices.reduce((sum, value) => sum + value, 0) / prices.length);
    const marketMedianProviderPrice = median(prices);
    const marketLowProviderPrice = percentile(prices, 0.2);
    const marketHighProviderPrice = percentile(prices, 0.8);
    const differencePercent = average > 0 ? roundMoney(((providerPrice - average) / average) * 100) : 0;
    const status = getStatus(differencePercent);
    const statusCopy = getStatusCopy(status);
    const anchorPrice = roundMoney((average + marketMedianProviderPrice) / 2);
    const suggestedProviderPrice = status === 'fair'
        ? providerPrice
        : roundToNearest(anchorPrice, anchorPrice >= 10000 ? 500 : 100);
    const feeRate = input.platformFeeRate ?? PLATFORM_FEE_RATE;
    const suggestedTouristPrice = calculatePricingFromProviderUnit(suggestedProviderPrice, 1, feeRate).tourist_unit_price;
    const marketAverageTouristPrice = calculatePricingFromProviderUnit(average, 1, feeRate).tourist_unit_price;
    const localComparableCount = marketplaceComparables.length;
    const benchmarkComparableCount = benchmarkComparables.length;
    const confidence: MarketConfidence = localComparableCount >= 6
        ? 'high'
        : localComparableCount >= 3
            ? 'medium'
            : 'low';

    const signals = [
        `${localComparableCount} marketplace comparable${localComparableCount === 1 ? '' : 's'}`,
        `${benchmarkComparableCount} global benchmark${benchmarkComparableCount === 1 ? '' : 's'}`,
        `${extractDurationDays(input.title, input.description, input.category)} day duration signal`,
        getIncludedTokens(input.feeBreakdown).size > 0 ? 'inclusion match used' : 'add inclusions for sharper advice',
    ];

    return {
        status,
        ...statusCopy,
        currentProviderPrice: providerPrice,
        currentTouristPrice: touristPrice,
        marketAverageProviderPrice: average,
        marketAverageTouristPrice,
        marketMedianProviderPrice,
        marketLowProviderPrice,
        marketHighProviderPrice,
        suggestedProviderPrice,
        suggestedTouristPrice,
        differencePercent,
        confidence,
        localComparableCount,
        benchmarkComparableCount,
        similarTrips: comparables.slice(0, 5),
        signals,
    };
};
