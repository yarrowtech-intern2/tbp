import { supabase } from './supabase';

export type AnalyticsRangeKey = '7d' | '30d' | '90d';

export const ANALYTICS_RANGES: Array<{ key: AnalyticsRangeKey; label: string; days: number }> = [
    { key: '7d', label: '7 days', days: 7 },
    { key: '30d', label: '30 days', days: 30 },
    { key: '90d', label: '90 days', days: 90 },
];

export interface AnalyticsTotals {
    visitors: number;
    sessions: number;
    page_views: number;
    clicks: number;
    logins: number;
    signups: number;
    link_visits: number;
    listing_views: number;
    booking_starts: number;
    signed_in_visitors?: number;
    returning_visitors?: number;
}

export interface AnalyticsDay {
    day: string;
    visitors: number;
    page_views: number;
    clicks: number;
    logins: number;
    signups: number;
    link_visits: number;
    listing_views: number;
    booking_starts: number;
}

export interface AnalyticsSummary {
    range: { from: string; to: string; tz: string };
    totals: AnalyticsTotals;
    previous: AnalyticsTotals;
    daily: AnalyticsDay[];
    top_pages: Array<{ path: string; views: number; visitors: number }>;
    top_sources: Array<{ source: string; visitors: number }>;
    top_clicks: Array<{ target: string; clicks: number }>;
    top_links: Array<{ link: string; visits: number; visitors: number }>;
    devices: Array<{ device: string; visitors: number }>;
    heatmap: Array<{ dow: number; hour: number; events: number }>;
    funnel: { visited: number; viewed_listing: number; authenticated: number; started_booking: number };
    active_now: number;
}

export class AnalyticsNotReadyError extends Error {
    constructor() {
        super('Analytics database functions are not installed yet.');
        this.name = 'AnalyticsNotReadyError';
    }
}

const getTimeZone = (): string => {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    } catch {
        return 'Asia/Kolkata';
    }
};

export const getAnalyticsRangeDates = (key: AnalyticsRangeKey): { from: Date; to: Date; days: number } => {
    const days = ANALYTICS_RANGES.find((range) => range.key === key)?.days ?? 7;
    const to = new Date();
    const from = new Date(to);
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (days - 1));
    return { from, to, days };
};

const emptyTotals = (): AnalyticsTotals => ({
    visitors: 0,
    sessions: 0,
    page_views: 0,
    clicks: 0,
    logins: 0,
    signups: 0,
    link_visits: 0,
    listing_views: 0,
    booking_starts: 0,
});

const dayKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

/** Ensures every calendar day in the range exists, so charts never skip empty days. */
export const fillMissingDays = (daily: AnalyticsDay[], from: Date, days: number): AnalyticsDay[] => {
    const byDay = new Map(daily.map((row) => [row.day, row]));
    return Array.from({ length: days }, (_, index) => {
        const date = new Date(from);
        date.setDate(from.getDate() + index);
        const key = dayKey(date);
        return byDay.get(key) || {
            day: key,
            visitors: 0,
            page_views: 0,
            clicks: 0,
            logins: 0,
            signups: 0,
            link_visits: 0,
            listing_views: 0,
            booking_starts: 0,
        };
    });
};

export const fetchAdminAnalyticsSummary = async (key: AnalyticsRangeKey): Promise<AnalyticsSummary> => {
    const { from, to, days } = getAnalyticsRangeDates(key);
    const { data, error } = await supabase.rpc('admin_analytics_summary', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_tz: getTimeZone(),
    });

    if (error) {
        const message = `${error.code || ''} ${error.message || ''}`;
        if (/PGRST202|42883|admin_analytics_summary/i.test(message) && !/42501/.test(message)) {
            throw new AnalyticsNotReadyError();
        }
        throw new Error(error.message || 'Could not load analytics.');
    }

    const raw = (data || {}) as Partial<AnalyticsSummary>;
    return {
        range: raw.range || { from: from.toISOString(), to: to.toISOString(), tz: getTimeZone() },
        totals: { ...emptyTotals(), ...(raw.totals || {}) },
        previous: { ...emptyTotals(), ...(raw.previous || {}) },
        daily: fillMissingDays(raw.daily || [], from, days),
        top_pages: raw.top_pages || [],
        top_sources: raw.top_sources || [],
        top_clicks: raw.top_clicks || [],
        top_links: raw.top_links || [],
        devices: raw.devices || [],
        heatmap: raw.heatmap || [],
        funnel: raw.funnel || { visited: 0, viewed_listing: 0, authenticated: 0, started_booking: 0 },
        active_now: raw.active_now || 0,
    };
};

export const percentChange = (current: number, previous: number): number | null => {
    if (previous <= 0) return current > 0 ? null : 0;
    return ((current - previous) / previous) * 100;
};

const compactFormatter = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });
const fullFormatter = new Intl.NumberFormat('en-IN');

export const formatCompact = (value: number): string => (value < 10000 ? fullFormatter.format(value) : compactFormatter.format(value));
export const formatFull = (value: number): string => fullFormatter.format(value);

export const buildAnalyticsCsv = (daily: AnalyticsDay[]): string => {
    const header = ['date', 'visitors', 'page_views', 'link_visits', 'listing_views', 'clicks', 'logins', 'signups', 'booking_starts'];
    const rows = daily.map((row) => [
        row.day, row.visitors, row.page_views, row.link_visits, row.listing_views, row.clicks, row.logins, row.signups, row.booking_starts,
    ].join(','));
    return [header.join(','), ...rows].join('\n');
};
