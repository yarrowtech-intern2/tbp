/**
 * Activity categories shared by the provider studio (picker) and the tourist
 * explore page (card badges + filters).
 *
 * The category is stored in `posts.sub_category`: known categories store their
 * label ("Pottery"); "Other" stores the provider's custom label (or "Other").
 * Legacy free-text values are mapped by keyword, falling back to "Other".
 */

export type ActivityCategoryKey = 'restaurant' | 'crafting' | 'pottery' | 'museums' | 'other';

export interface ActivityCategory {
    key: ActivityCategoryKey;
    label: string;
    /** Short description shown in the provider picker. */
    pickerHint: string;
    placeholderDescription: string;
    guidanceItems: string[];
    keywords: string[];
}

export const ACTIVITY_CATEGORIES: ActivityCategory[] = [
    {
        key: 'restaurant',
        label: 'Restaurant',
        pickerHint: 'Showcase special menus',
        placeholderDescription: 'Describe the special menu, signature dishes, cuisine, dietary options, seating, timings, and price per guest.',
        guidanceItems: ['Special menu or signature dishes', 'Dietary options and allergens', 'Seating, timings, and booking policy'],
        keywords: ['restaurant', 'dining', 'dine', 'menu', 'cuisine', 'food', 'cafe', 'culinary', 'thali'],
    },
    {
        key: 'crafting',
        label: 'Crafting',
        pickerHint: 'Handcraft activity',
        placeholderDescription: 'Describe the handcraft guests will make, materials provided, session length, skill level, and what they take home.',
        guidanceItems: ['Craft, materials, and tools provided', 'Session length and skill level', 'What guests take home'],
        keywords: ['craft', 'handicraft', 'handmade', 'weaving', 'loom', 'embroidery', 'block print', 'artisan', 'basket'],
    },
    {
        key: 'pottery',
        label: 'Pottery',
        pickerHint: 'Pottery workshop experience',
        placeholderDescription: 'Describe the pottery workshop: wheel or hand-building, clay and kiln details, duration, skill level, and whether guests keep their piece.',
        guidanceItems: ['Wheel or hand-building technique', 'Duration, skill level, and group size', 'Firing time and take-home piece'],
        keywords: ['pottery', 'potter', 'ceramic', 'clay', 'terracotta', 'kiln'],
    },
    {
        key: 'museums',
        label: 'Museums',
        pickerHint: 'Special events or museum tours',
        placeholderDescription: 'Describe the museum tour or special event: exhibits covered, guide language, duration, ticket inclusion, and accessibility.',
        guidanceItems: ['Exhibits or event highlights', 'Ticket inclusion and entry timings', 'Guide language and accessibility'],
        keywords: ['museum', 'gallery', 'exhibit', 'exhibition', 'heritage walk', 'archive'],
    },
    {
        key: 'other',
        label: 'Other',
        pickerHint: 'Anything else, name it yourself',
        placeholderDescription: 'Describe what guests will do, session length, equipment, safety notes, skill level, group size, and meeting point.',
        guidanceItems: ['Session duration and group size', 'Equipment, safety, and skill level', 'Meeting point and guest requirements'],
        keywords: [],
    },
];

const CATEGORY_BY_KEY = new Map<ActivityCategoryKey, ActivityCategory>(
    ACTIVITY_CATEGORIES.map((category) => [category.key, category]),
);

export const getActivityCategory = (key: ActivityCategoryKey): ActivityCategory => (
    CATEGORY_BY_KEY.get(key) as ActivityCategory
);

/** Resolves a stored `sub_category` string to a category key. */
export const resolveActivityCategoryKey = (value: string | null | undefined): ActivityCategoryKey => {
    const text = (value || '').trim().toLowerCase();
    if (!text) return 'other';

    const exact = ACTIVITY_CATEGORIES.find((category) => category.label.toLowerCase() === text);
    if (exact) return exact.key;

    const keywordMatch = ACTIVITY_CATEGORIES.find((category) => (
        category.keywords.some((keyword) => text.includes(keyword))
    ));
    return keywordMatch?.key ?? 'other';
};

/** Label shown on a card: custom "Other" labels are kept, known ones use the canonical label. */
export const getActivityCategoryDisplayLabel = (value: string | null | undefined): string => {
    const key = resolveActivityCategoryKey(value);
    const custom = (value || '').trim();
    if (key === 'other') return custom || 'Other';
    return getActivityCategory(key).label;
};

/**
 * Splits a stored value into the picker selection plus the custom label (Other only).
 * Exact label match only (no keywords), so a custom label typed under "Other"
 * never flips the picker to another category while the provider is typing.
 */
export const parseActivityCategoryValue = (value: string | null | undefined): { key: ActivityCategoryKey | null; customLabel: string } => {
    const text = (value || '').trim();
    if (!text) return { key: null, customLabel: '' };
    const exact = ACTIVITY_CATEGORIES.find((category) => category.label.toLowerCase() === text.toLowerCase());
    if (exact && exact.key !== 'other') return { key: exact.key, customLabel: '' };
    return { key: 'other', customLabel: exact ? '' : (value || '').trimStart() };
};

/** Builds the `sub_category` value to store for a picker selection. */
export const buildActivityCategoryValue = (key: ActivityCategoryKey | null, customLabel: string): string => {
    if (!key) return '';
    // Not trimmed on the trailing side so providers can type multi-word labels; saving trims it.
    if (key === 'other') return customLabel.trimStart() || 'Other';
    return getActivityCategory(key).label;
};
