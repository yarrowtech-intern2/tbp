import { supabase } from './supabase';
import { PLATFORM_FEE_RATE } from './pricing';

export type HeroMessageMood = 'early' | 'morning' | 'afternoon' | 'sunset' | 'evening' | 'night';

export type FooterLink = {
    label: string;
    href?: string | null;
};

export type FooterContent = {
    description: string;
    columns: Array<{
        title: string;
        links: FooterLink[];
    }>;
    copyright: string;
    socials: FooterLink[];
};

export type HeroMessagesContent = Record<HeroMessageMood, string[]>;

export type AppContentConfig = {
    footer: FooterContent;
    heroMessages: HeroMessagesContent;
    salesSettings: SalesSettingsContent;
    aboutPage: AboutPageContent;
};

export type SalesSettingsContent = {
    platformFeeRate: number;
};

export type AboutPageCard = {
    id: string;
    label: string;
    title: string;
    shortText: string;
    fullText: string[];
    metric?: string;
    cta?: FooterLink;
};

export type AboutPageContent = {
    eyebrow: string;
    title: string;
    subtitle: string;
    backgroundImages: string[];
    cards: AboutPageCard[];
};

export const APP_CONTENT_KEYS = {
    footer: 'landing_footer',
    heroMessages: 'tourist_hero_messages',
    salesSettings: 'sales_settings',
    aboutPage: 'about_page',
} as const;

export const HERO_MESSAGE_MOODS: HeroMessageMood[] = ['early', 'morning', 'afternoon', 'sunset', 'evening', 'night'];

export const DEFAULT_HERO_MESSAGES: HeroMessagesContent = {
    early: [
        'Start softly somewhere new',
        'Let the day find you',
        'Chase quiet morning roads',
    ],
    morning: [
        'Wake up to somewhere better',
        'Your next story starts today',
        'Find a view worth waking for',
    ],
    afternoon: [
        'Step into a brighter detour',
        'Make today feel far away',
        'Follow the sun somewhere',
    ],
    sunset: [
        'Save sunset for somewhere special',
        'Let golden hour guide you',
        'Find your evening escape',
    ],
    evening: [
        'Plan tomorrow over tonight',
        'Turn tonight into a route',
        'Pick a place for the mood',
    ],
    night: [
        'Dream up the next getaway',
        'Let midnight map it out',
        'Your next escape is waiting',
    ],
};

export const DEFAULT_FOOTER_CONTENT: FooterContent = {
    description: 'Modern luxury travel with editorial clarity, refined stays, and calm itinerary design.',
    columns: [
        {
            title: 'Explore',
            links: [
                { label: 'Home', href: '#h4-hero' },
                { label: 'Destinations', href: '#h4-about' },
                { label: 'Newsletter', href: '#h4-contact' },
            ],
        },
        {
            title: 'Experiences',
            links: [
                { label: 'Beach Escapes' },
                { label: 'Mountain Stays' },
                { label: 'Cultural Routes' },
                { label: 'Luxury Resorts' },
            ],
        },
        {
            title: 'Contact',
            links: [
                { label: 'hello@thebetterpass.com', href: 'mailto:hello@thebetterpass.com' },
                { label: '+91 1800 000 000', href: 'tel:+911800000000' },
                { label: 'Member Login', href: '/auth' },
            ],
        },
    ],
    copyright: '(c) 2026 The Better Pass. All rights reserved.',
    socials: [
        { label: 'Instagram', href: '#' },
        { label: 'Twitter', href: '#' },
        { label: 'LinkedIn', href: '#' },
    ],
};

export const DEFAULT_SALES_SETTINGS: SalesSettingsContent = {
    platformFeeRate: PLATFORM_FEE_RATE,
};

export const DEFAULT_ABOUT_PAGE_CONTENT: AboutPageContent = {
    eyebrow: 'About The Better Pass',
    title: 'A smarter travel ecosystem in one living pass.',
    subtitle: 'TBP connects travelers, local partners, verified services, and curated destination stories through one calm discovery and booking layer.',
    backgroundImages: [
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2200&q=85',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2200&q=85',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=2200&q=85',
        'https://images.unsplash.com/photo-1470770903676-69b98201ea1c?auto=format&fit=crop&w=2200&q=85',
    ],
    cards: [
        {
            id: 'story',
            label: '01',
            title: 'Our Story',
            shortText: 'Built to make travel discovery feel clear, local, and trustworthy.',
            fullText: [
                'The Better Pass started from a simple gap: travelers can find places everywhere, but understanding what is verified, nearby, bookable, and genuinely worth their time is still fragmented.',
                'TBP brings destinations, restaurants, brands, services, and guided experiences into one curated layer so each journey starts with clarity instead of scattered tabs.',
            ],
            cta: { label: 'Start exploring', href: '/auth' },
        },
        {
            id: 'mission',
            label: '02',
            title: 'Mission',
            shortText: 'Turn local discovery into a smooth path from inspiration to action.',
            fullText: [
                'Our mission is to help travelers move from seeing a place to experiencing it with confidence.',
                'We combine public content, verified partners, bookings, promotions, and profile-led discovery so travel decisions become faster and more dependable.',
            ],
            cta: { label: 'Explore the platform', href: '/auth' },
        },
        {
            id: 'travelers',
            label: '03',
            title: 'Travelers',
            shortText: 'A cleaner way to find places, services, stays, guides, and experiences.',
            fullText: [
                'For tourists, TBP is a discovery surface for nearby activities, routes, restaurants, trusted providers, and destination ideas.',
                'The experience is designed around scanning, saving, booking, chatting, and returning to one profile instead of rebuilding every trip from scratch.',
            ],
            cta: { label: 'Join as traveler', href: '/auth' },
        },
        {
            id: 'partners',
            label: '04',
            title: 'Partners',
            shortText: 'A growth channel for guides, brands, restaurants, and service providers.',
            fullText: [
                'Partners can bring listings, posts, promotions, and verified services into the same environment where travelers are already planning.',
                'The platform gives businesses a clearer path to visibility, trust, and conversion without relying only on social feeds or disconnected directories.',
            ],
            cta: { label: 'Become a partner', href: '/auth' },
        },
        {
            id: 'trust',
            label: '05',
            title: 'Trust Layer',
            shortText: 'Reviews, moderation, verification, and transparent listing flows.',
            fullText: [
                'TBP is built with admin review, provider approval, booking records, and content moderation as part of the product, not an afterthought.',
                'That structure helps travelers understand what they are choosing and helps partners compete on quality instead of noise.',
            ],
            cta: { label: 'See verified listings', href: '/auth' },
        },
        {
            id: 'platform',
            label: '06',
            title: 'Platform',
            shortText: 'Discovery, content, ads, payments, profiles, bookings, and support.',
            fullText: [
                'The product is an operating system for travel discovery: public landing content, user dashboards, provider studios, promotions, bookings, messages, and admin controls.',
                'Each part is designed to support the same loop: discover, trust, book, experience, and come back smarter.',
            ],
            cta: { label: 'Open dashboard', href: '/auth' },
        },
        {
            id: 'impact',
            label: '07',
            title: 'Impact',
            shortText: '20+ restaurants, 12+ brands, 8+ services, and 22+ countries.',
            fullText: [
                'The goal is not just more listings. The goal is a better travel graph where local value becomes easier to find and easier to support.',
                'As the partner network grows, TBP becomes a stronger bridge between destination demand and local businesses.',
            ],
            metric: '62+',
            cta: { label: 'View ecosystem', href: '/auth' },
        },
        {
            id: 'future',
            label: '08',
            title: 'Future',
            shortText: 'Smarter recommendations, richer local networks, and better trip planning.',
            fullText: [
                'The next stage of TBP is more intelligent discovery: better location context, richer content, stronger partner tools, and smoother planning from mobile.',
                'We are building toward a travel layer that feels personal without losing the reliability of a managed platform.',
            ],
            cta: { label: 'Follow the journey', href: '/auth' },
        },
    ],
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));

const isMissingContentTableError = (error: { code?: string; message?: string } | null | undefined): boolean => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === 'PGRST205'
        || message.includes('app_content')
        || (message.includes('relation') && message.includes('does not exist'))
    );
};

const normalizeText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const normalizeFooterLink = (value: unknown): FooterLink | null => {
    if (!isRecord(value)) return null;
    const label = normalizeText(value.label);
    if (!label) return null;
    const href = typeof value.href === 'string' && value.href.trim() ? value.href.trim() : null;
    return { label, href };
};

export const normalizeFooterContent = (value: unknown): FooterContent => {
    if (!isRecord(value)) return DEFAULT_FOOTER_CONTENT;

    const columns = Array.isArray(value.columns)
        ? value.columns
            .map((column) => {
                if (!isRecord(column)) return null;
                const title = normalizeText(column.title);
                const links = Array.isArray(column.links)
                    ? column.links.map(normalizeFooterLink).filter((item): item is FooterLink => Boolean(item))
                    : [];
                if (!title || links.length === 0) return null;
                return { title, links };
            })
            .filter((item): item is FooterContent['columns'][number] => Boolean(item))
        : DEFAULT_FOOTER_CONTENT.columns;

    const socials = Array.isArray(value.socials)
        ? value.socials.map(normalizeFooterLink).filter((item): item is FooterLink => Boolean(item))
        : DEFAULT_FOOTER_CONTENT.socials;

    return {
        description: normalizeText(value.description, DEFAULT_FOOTER_CONTENT.description),
        columns: columns.length > 0 ? columns : DEFAULT_FOOTER_CONTENT.columns,
        copyright: normalizeText(value.copyright, DEFAULT_FOOTER_CONTENT.copyright),
        socials: socials.length > 0 ? socials : DEFAULT_FOOTER_CONTENT.socials,
    };
};

export const normalizeHeroMessagesContent = (value: unknown): HeroMessagesContent => {
    if (!isRecord(value)) return DEFAULT_HERO_MESSAGES;

    return HERO_MESSAGE_MOODS.reduce((acc, mood) => {
        const messages = Array.isArray(value[mood])
            ? value[mood]
                .map((item) => normalizeText(item))
                .filter(Boolean)
            : [];
        acc[mood] = messages.length > 0 ? messages : DEFAULT_HERO_MESSAGES[mood];
        return acc;
    }, {} as HeroMessagesContent);
};

export const normalizeSalesSettingsContent = (value: unknown): SalesSettingsContent => {
    if (!isRecord(value)) return DEFAULT_SALES_SETTINGS;
    const rawRate = Number(value.platformFeeRate ?? value.platform_fee_rate);
    const platformFeeRate = Number.isFinite(rawRate) && rawRate >= 0 && rawRate <= 1
        ? rawRate
        : DEFAULT_SALES_SETTINGS.platformFeeRate;
    return { platformFeeRate };
};

const normalizeAboutCard = (value: unknown, fallback: AboutPageCard): AboutPageCard => {
    if (!isRecord(value)) return fallback;
    const fullText = Array.isArray(value.fullText)
        ? value.fullText.map((item) => normalizeText(item)).filter(Boolean)
        : Array.isArray(value.full_text)
            ? value.full_text.map((item) => normalizeText(item)).filter(Boolean)
            : fallback.fullText;
    const cta = normalizeFooterLink(value.cta);

    return {
        id: normalizeText(value.id, fallback.id).toLowerCase().replace(/[^a-z0-9_-]/g, '-') || fallback.id,
        label: normalizeText(value.label, fallback.label),
        title: normalizeText(value.title, fallback.title),
        shortText: normalizeText(value.shortText ?? value.short_text, fallback.shortText),
        fullText: fullText.length > 0 ? fullText : fallback.fullText,
        metric: typeof value.metric === 'string' && value.metric.trim() ? value.metric.trim() : fallback.metric,
        cta: cta || fallback.cta,
    };
};

export const normalizeAboutPageContent = (value: unknown): AboutPageContent => {
    if (!isRecord(value)) return DEFAULT_ABOUT_PAGE_CONTENT;
    const backgroundImages = Array.isArray(value.backgroundImages)
        ? value.backgroundImages.map((item) => normalizeText(item)).filter(Boolean)
        : Array.isArray(value.background_images)
            ? value.background_images.map((item) => normalizeText(item)).filter(Boolean)
            : DEFAULT_ABOUT_PAGE_CONTENT.backgroundImages;
    const sourceCards = Array.isArray(value.cards) ? value.cards : [];
    const cards = DEFAULT_ABOUT_PAGE_CONTENT.cards.map((fallback, index) => (
        normalizeAboutCard(sourceCards[index], fallback)
    ));

    return {
        eyebrow: normalizeText(value.eyebrow, DEFAULT_ABOUT_PAGE_CONTENT.eyebrow),
        title: normalizeText(value.title, DEFAULT_ABOUT_PAGE_CONTENT.title),
        subtitle: normalizeText(value.subtitle, DEFAULT_ABOUT_PAGE_CONTENT.subtitle),
        backgroundImages: backgroundImages.length > 0 ? backgroundImages : DEFAULT_ABOUT_PAGE_CONTENT.backgroundImages,
        cards,
    };
};

export const getHeroMessageMood = (hour: number): HeroMessageMood => {
    if (hour < 6) return 'night';
    if (hour < 9) return 'early';
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    if (hour < 19) return 'sunset';
    if (hour < 22) return 'evening';
    return 'night';
};

export const getDynamicHeroMessage = (date: Date, source: HeroMessagesContent = DEFAULT_HERO_MESSAGES): string => {
    const mood = getHeroMessageMood(date.getHours());
    const messages = source[mood]?.length ? source[mood] : DEFAULT_HERO_MESSAGES[mood];
    const rotationSeed = date.getDate() + date.getHours() + Math.floor(date.getMinutes() / 10);
    return messages[rotationSeed % messages.length];
};

export const getPublicAppContent = async (): Promise<AppContentConfig> => {
    const { data, error } = await supabase
        .from('app_content')
        .select('key, value')
        .in('key', Object.values(APP_CONTENT_KEYS));

    if (error) {
        if (!isMissingContentTableError(error)) {
            console.error('Error fetching app content:', error);
        }
        return {
            footer: DEFAULT_FOOTER_CONTENT,
            heroMessages: DEFAULT_HERO_MESSAGES,
            salesSettings: DEFAULT_SALES_SETTINGS,
            aboutPage: DEFAULT_ABOUT_PAGE_CONTENT,
        };
    }

    const rows = Array.isArray(data) ? data as Array<{ key?: unknown; value?: unknown }> : [];
    const byKey = new Map(rows.map((row) => [String(row.key || ''), row.value]));

    return {
        footer: normalizeFooterContent(byKey.get(APP_CONTENT_KEYS.footer)),
        heroMessages: normalizeHeroMessagesContent(byKey.get(APP_CONTENT_KEYS.heroMessages)),
        salesSettings: normalizeSalesSettingsContent(byKey.get(APP_CONTENT_KEYS.salesSettings)),
        aboutPage: normalizeAboutPageContent(byKey.get(APP_CONTENT_KEYS.aboutPage)),
    };
};

export const saveAppContentValue = async (key: typeof APP_CONTENT_KEYS[keyof typeof APP_CONTENT_KEYS], value: unknown, userId?: string | null) => {
    const payload = {
        key,
        value,
        updated_by: userId || null,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
        .from('app_content')
        .upsert(payload, { onConflict: 'key' });

    if (error) throw error;
};
