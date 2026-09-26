export interface ListingGuidelines {
    dos: string[];
    donts: string[];
    rules: string[];
    what_to_carry: string[];
}

export type GuidelineKey = keyof ListingGuidelines;

export const GUIDELINE_MAX_ITEMS = 12;
export const GUIDELINE_MAX_LENGTH = 160;
export const MAX_LISTING_GROUP_SIZE = 100;

export const EMPTY_LISTING_GUIDELINES = (): ListingGuidelines => ({
    dos: [],
    donts: [],
    rules: [],
    what_to_carry: [],
});

const normalizeGuidelineList = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const items: string[] = [];
    for (const entry of value) {
        if (typeof entry !== 'string') continue;
        const text = entry.trim().replace(/\s+/g, ' ').slice(0, GUIDELINE_MAX_LENGTH);
        const key = text.toLowerCase();
        if (!text || seen.has(key)) continue;
        seen.add(key);
        items.push(text);
        if (items.length >= GUIDELINE_MAX_ITEMS) break;
    }
    return items;
};

export const normalizeListingGuidelines = (value: unknown): ListingGuidelines => {
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return {
        dos: normalizeGuidelineList(record.dos),
        donts: normalizeGuidelineList(record.donts),
        rules: normalizeGuidelineList(record.rules),
        what_to_carry: normalizeGuidelineList(record.what_to_carry),
    };
};

export const hasListingGuidelines = (guidelines: ListingGuidelines): boolean => (
    guidelines.dos.length + guidelines.donts.length + guidelines.rules.length + guidelines.what_to_carry.length > 0
);

const toGuestCount = (value: unknown): number | null => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : null;
};

/** Returns a cleaned min/max pair, or an error message when the pair is not valid. */
export const resolveGroupSize = (
    minValue: unknown,
    maxValue: unknown,
): { min: number | null; max: number | null; error: string | null } => {
    const min = toGuestCount(minValue);
    const max = toGuestCount(maxValue);
    if (max !== null && max > MAX_LISTING_GROUP_SIZE) {
        return { min, max, error: `Maximum heads cannot be more than ${MAX_LISTING_GROUP_SIZE}.` };
    }
    if (min !== null && max !== null && max < min) {
        return { min, max, error: 'Maximum heads must be equal to or more than minimum heads.' };
    }
    return { min, max, error: null };
};

export const formatGroupSize = (min: number | null, max: number | null): string | null => {
    if (min !== null && max !== null) return min === max ? `${min} heads` : `${min}-${max} heads`;
    if (min !== null) return `Min ${min} heads`;
    if (max !== null) return `Up to ${max} heads`;
    return null;
};
