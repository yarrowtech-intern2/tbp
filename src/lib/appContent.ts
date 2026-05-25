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
};

export type SalesSettingsContent = {
    platformFeeRate: number;
};

export const APP_CONTENT_KEYS = {
    footer: 'landing_footer',
    heroMessages: 'tourist_hero_messages',
    salesSettings: 'sales_settings',
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
        };
    }

    const rows = Array.isArray(data) ? data as Array<{ key?: unknown; value?: unknown }> : [];
    const byKey = new Map(rows.map((row) => [String(row.key || ''), row.value]));

    return {
        footer: normalizeFooterContent(byKey.get(APP_CONTENT_KEYS.footer)),
        heroMessages: normalizeHeroMessagesContent(byKey.get(APP_CONTENT_KEYS.heroMessages)),
        salesSettings: normalizeSalesSettingsContent(byKey.get(APP_CONTENT_KEYS.salesSettings)),
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
