import {
    getBookings,
    getFavoriteListings,
    getProfile,
    getPublicListingsByType,
    type PostRecord,
    type Profile,
    type UnifiedBooking,
} from './destinations';
import type { ListingType } from './platform';
import { getRoleLabel, getVerificationLabel } from './platform';

export type ChatbotMode = 'ai' | 'rule-based';

export interface ChatbotHistoryTurn {
    role: 'user' | 'assistant';
    text: string;
}

export interface ChatbotReply {
    text: string;
    mode: ChatbotMode;
}

type RuleContext = {
    listingsByType: Record<ListingType, PostRecord[]>;
    allListings: PostRecord[];
    profile: Profile | null;
    bookings: UnifiedBooking[];
};

const RULE_CACHE_TTL_MS = 60_000;
const STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'be', 'can', 'do', 'for', 'from', 'help', 'i', 'in', 'is', 'me', 'my', 'of', 'on',
    'or', 'please', 'show', 'the', 'to', 'want', 'what', 'with', 'you',
]);

const ruleContextCache = new Map<string, { expiresAt: number; context: RuleContext }>();

const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
});

const hasAny = (text: string, tokens: string[]) => tokens.some((token) => text.includes(token));

const normalizeText = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

const listingTitle = (listing: PostRecord) => {
    const title = typeof listing.title === 'string' && listing.title.trim() ? listing.title.trim() : '';
    if (title) return title;
    const name = typeof listing.name === 'string' && listing.name.trim() ? listing.name.trim() : '';
    if (name) return name;
    return 'Untitled listing';
};

const listingLocation = (listing: PostRecord) => (
    typeof listing.location === 'string' && listing.location.trim() ? listing.location.trim() : 'Location unavailable'
);

const listingPrice = (listing: PostRecord) => (
    typeof listing.price === 'number' && Number.isFinite(listing.price) ? listing.price : null
);

const listingTypeLabel = (type: ListingType) => {
    if (type === 'guide') return 'events';
    return `${type}s`;
};

const toKey = (userId: string | null) => userId || 'anon';

const describeListing = (listing: PostRecord) => {
    const price = listingPrice(listing);
    const priceLabel = price === null ? 'Price on request' : inrFormatter.format(price);
    return `${listingTitle(listing)} (${listingLocation(listing)} | ${priceLabel})`;
};

const getToken = () => {
    const envToken = typeof import.meta.env.VITE_OPENAI_API_KEY === 'string'
        ? import.meta.env.VITE_OPENAI_API_KEY.trim()
        : '';
    if (envToken) return envToken;

    if (typeof window === 'undefined') return '';
    const localToken = window.localStorage.getItem('tbp_openai_api_key');
    return typeof localToken === 'string' ? localToken.trim() : '';
};

export const getConfiguredChatbotMode = (): ChatbotMode => (getToken() ? 'ai' : 'rule-based');

const detectListingType = (text: string): ListingType | null => {
    if (hasAny(text, [' tour ', ' tours ', ' trip ', ' trips '])) return 'tour';
    if (hasAny(text, [' activity ', ' activities ', ' adventure ', ' adventures '])) return 'activity';
    if (hasAny(text, [' event ', ' events ', ' guide ', ' guides '])) return 'guide';
    if (text.startsWith('tour') || text.endsWith('tour')) return 'tour';
    if (text.startsWith('activity') || text.endsWith('activity')) return 'activity';
    if (text.startsWith('event') || text.endsWith('event')) return 'guide';
    return null;
};

const extractLocationHint = (text: string) => {
    const match = text.match(/\bin\s+([a-z][a-z\s]{1,28})/i);
    if (!match) return null;
    return match[1].trim().replace(/\s+/g, ' ');
};

const findListingsByLocation = (listings: PostRecord[], locationHint: string | null) => {
    if (!locationHint) return listings;
    const normalizedHint = locationHint.toLowerCase();
    return listings.filter((listing) => listingLocation(listing).toLowerCase().includes(normalizedHint));
};

const scoreListingMatch = (queryTokens: string[], listing: PostRecord) => {
    const haystack = normalizeText(
        `${listingTitle(listing)} ${listingLocation(listing)} ${typeof listing.description === 'string' ? listing.description : ''}`
    );
    return queryTokens.reduce((score, token) => (haystack.includes(token) ? score + 1 : score), 0);
};

const rankListingsByQuery = (question: string, listings: PostRecord[]) => {
    const queryTokens = normalizeText(question)
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && !STOPWORDS.has(token));

    if (!queryTokens.length) return [];

    return listings
        .map((listing) => ({
            listing,
            score: scoreListingMatch(queryTokens, listing),
        }))
        .filter((row) => row.score > 0)
        .sort((a, b) => b.score - a.score)
        .map((row) => row.listing);
};

const buildContext = async (userId: string | null): Promise<RuleContext> => {
    const [tours, activities, guides, profile, bookings] = await Promise.all([
        getPublicListingsByType('tour'),
        getPublicListingsByType('activity'),
        getPublicListingsByType('guide'),
        userId ? getProfile(userId) : Promise.resolve(null),
        userId ? getBookings(userId) : Promise.resolve([] as UnifiedBooking[]),
    ]);

    const allListings = [...tours, ...activities, ...guides].sort((a, b) => (
        new Date(b.created_at || b.starts_at || 0).getTime() - new Date(a.created_at || a.starts_at || 0).getTime()
    ));

    return {
        listingsByType: {
            tour: tours,
            activity: activities,
            guide: guides,
        },
        allListings,
        profile,
        bookings,
    };
};

const getRuleContext = async (userId: string | null) => {
    const key = toKey(userId);
    const now = Date.now();
    const cached = ruleContextCache.get(key);
    if (cached && cached.expiresAt > now) {
        return cached.context;
    }

    const context = await buildContext(userId);
    ruleContextCache.set(key, {
        context,
        expiresAt: now + RULE_CACHE_TTL_MS,
    });
    return context;
};

const buildHelpReply = () => (
    'Ask me about tours, activities, events, prices, or your account status. Example: "best tours in Manali" or "my booking status".'
);

const buildBookingReply = (bookings: UnifiedBooking[]) => {
    if (!bookings.length) return 'You have no bookings in the system yet.';

    const counts = bookings.reduce<Record<string, number>>((acc, booking) => {
        const key = booking.status || 'pending';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});
    const summary = Object.entries(counts)
        .map(([status, count]) => `${count} ${status}`)
        .join(', ');
    const latest = bookings[0];
    const latestTitle = latest.listing_title || 'Latest booking';
    return `You have ${bookings.length} bookings: ${summary}. Latest: ${latestTitle} (${latest.status}).`;
};

const buildFavoriteReply = async (userId: string) => {
    const favorites = await getFavoriteListings(userId);
    if (!favorites.length) return 'You do not have any saved favorites yet.';
    const top = favorites.slice(0, 3).map((item) => item.title).join(', ');
    return `You have ${favorites.length} favorites. Top saved: ${top}.`;
};

const buildVerificationReply = (profile: Profile | null) => {
    if (!profile) return 'I could not read your profile yet. Reload and try again.';
    const role = getRoleLabel(profile.role);
    const verification = getVerificationLabel(profile.verification_status);
    return `Your account role is ${role}. Verification status: ${verification}.`;
};

const buildPricingReply = (listings: PostRecord[], label: string) => {
    const prices = listings
        .map((listing) => listingPrice(listing))
        .filter((price): price is number => price !== null);

    if (!prices.length) return `I found ${label}, but no numeric prices are available yet.`;

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const avg = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    return `${label} pricing currently ranges from ${inrFormatter.format(min)} to ${inrFormatter.format(max)} (avg ${inrFormatter.format(avg)}).`;
};

const buildListingReply = (listings: PostRecord[], type: ListingType | null, locationHint: string | null) => {
    if (!listings.length) {
        return type
            ? `No ${listingTypeLabel(type)} are available right now.`
            : 'No listings are available right now.';
    }

    const filtered = findListingsByLocation(listings, locationHint);
    if (locationHint && !filtered.length) {
        return `I found ${listings.length} items, but none matched "${locationHint}". Try a different location.`;
    }

    const top = filtered.slice(0, 3).map((listing, index) => `${index + 1}. ${describeListing(listing)}`).join('\n');
    const label = type ? listingTypeLabel(type) : 'listings';
    return `I found ${filtered.length} ${label}.\n${top}`;
};

const summarizeContextForAI = (context: RuleContext, userId: string | null) => {
    const tourTop = context.listingsByType.tour.slice(0, 4).map(describeListing).join('; ');
    const activityTop = context.listingsByType.activity.slice(0, 4).map(describeListing).join('; ');
    const eventTop = context.listingsByType.guide.slice(0, 4).map(describeListing).join('; ');
    const bookingSummary = userId
        ? `User bookings: ${context.bookings.length}`
        : 'User not signed in.';
    const profileSummary = context.profile
        ? `User role: ${context.profile.role || 'member'}; verification: ${context.profile.verification_status || 'unknown'}`
        : 'No user profile context.';

    return [
        `Catalog counts -> tours: ${context.listingsByType.tour.length}, activities: ${context.listingsByType.activity.length}, events: ${context.listingsByType.guide.length}.`,
        `Top tours -> ${tourTop || 'none'}.`,
        `Top activities -> ${activityTop || 'none'}.`,
        `Top events -> ${eventTop || 'none'}.`,
        bookingSummary,
        profileSummary,
    ].join('\n');
};

const extractResponseText = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object') return '';
    if ('output_text' in payload && typeof payload.output_text === 'string') {
        return payload.output_text.trim();
    }

    const output = 'output' in payload ? payload.output : null;
    if (!Array.isArray(output)) return '';

    for (const item of output) {
        if (!item || typeof item !== 'object') continue;
        if ('content' in item && Array.isArray(item.content)) {
            for (const contentItem of item.content) {
                if (!contentItem || typeof contentItem !== 'object') continue;
                if ('text' in contentItem && typeof contentItem.text === 'string') {
                    return contentItem.text.trim();
                }
            }
        }
    }

    return '';
};

const requestAIReply = async (
    question: string,
    history: ChatbotHistoryTurn[],
    context: RuleContext,
    userId: string | null
) => {
    const token = getToken();
    if (!token) return null;

    const recentHistory = history.slice(-6).map((turn) => ({
        role: turn.role,
        content: turn.text,
    }));

    const systemInstruction = [
        'You are the in-app assistant for a travel platform.',
        'Answer strictly from provided context.',
        'Be direct, short, and action-oriented.',
        'When data is missing, say so clearly without guessing.',
    ].join(' ');

    const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: import.meta.env.VITE_OPENAI_MODEL || 'gpt-4.1-mini',
            temperature: 0.2,
            max_output_tokens: 240,
            input: [
                { role: 'system', content: systemInstruction },
                ...recentHistory,
                {
                    role: 'user',
                    content: [
                        `Database context:`,
                        summarizeContextForAI(context, userId),
                        '',
                        `User question: ${question}`,
                        '',
                        'Give a concise answer.',
                    ].join('\n'),
                },
            ],
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const payload = await response.json();
    const text = extractResponseText(payload);
    if (!text) {
        throw new Error('OpenAI response was empty.');
    }

    return text;
};

const generateRuleReply = async (
    question: string,
    userId: string | null,
    context: RuleContext
) => {
    const normalized = ` ${normalizeText(question)} `;
    const listingType = detectListingType(normalized);
    const locationHint = extractLocationHint(normalized);

    const asksHelp = hasAny(normalized, [' help ', ' what can you do ', ' how to use ', 'hello', 'hi ', ' hey ']);
    if (asksHelp) {
        return buildHelpReply();
    }

    const asksBookings = hasAny(normalized, [' booking ', ' bookings ', ' reservation ', ' reservations ', ' booked ']);
    if (asksBookings) {
        if (!userId) return 'Sign in to see your booking status.';
        return buildBookingReply(context.bookings);
    }

    const asksFavorites = hasAny(normalized, [' favorite ', ' favourites ', ' favourite ', ' favorites ', ' wishlist ', ' saved ']);
    if (asksFavorites) {
        if (!userId) return 'Sign in to check your saved favorites.';
        return buildFavoriteReply(userId);
    }

    const asksVerification = hasAny(normalized, [
        ' verification ',
        ' verified ',
        ' approval ',
        ' approved ',
        ' account status ',
        ' profile status ',
        ' role ',
    ]);
    if (asksVerification) {
        if (!userId) return 'Sign in to check account and verification status.';
        return buildVerificationReply(context.profile);
    }

    const asksPricing = hasAny(normalized, [' price ', ' pricing ', ' cost ', ' budget ', ' expensive ', ' cheap ', ' rate ']);
    if (asksPricing) {
        const source = listingType ? context.listingsByType[listingType] : context.allListings;
        const label = listingType ? listingTypeLabel(listingType) : 'available listings';
        return buildPricingReply(findListingsByLocation(source, locationHint), label);
    }

    const asksCatalog = listingType
        || hasAny(normalized, [' recommend ', ' suggestion ', ' suggest ', ' best ', ' top ', ' list ', ' available ', ' show ']);

    if (asksCatalog) {
        const source = listingType ? context.listingsByType[listingType] : context.allListings;
        return buildListingReply(source, listingType, locationHint);
    }

    const matched = rankListingsByQuery(question, context.allListings).slice(0, 3);
    if (matched.length) {
        const top = matched.map((listing, index) => `${index + 1}. ${describeListing(listing)}`).join('\n');
        return `Closest matches from current data:\n${top}`;
    }

    return 'I could not map that query to current system data. Ask about listings, prices, bookings, favorites, or account status.';
};

export const getChatbotReply = async (input: {
    question: string;
    userId: string | null;
    history: ChatbotHistoryTurn[];
}): Promise<ChatbotReply> => {
    const question = input.question.trim();
    if (!question) {
        return { text: 'Please type a question first.', mode: 'rule-based' };
    }

    const context = await getRuleContext(input.userId);
    const aiEnabled = getConfiguredChatbotMode() === 'ai';

    if (aiEnabled) {
        try {
            const aiText = await requestAIReply(question, input.history, context, input.userId);
            if (aiText) {
                return {
                    text: aiText,
                    mode: 'ai',
                };
            }
        } catch (error) {
            console.error('AI response failed, switching to rule-based mode:', error);
        }
    }

    return {
        text: await generateRuleReply(question, input.userId, context),
        mode: 'rule-based',
    };
};
