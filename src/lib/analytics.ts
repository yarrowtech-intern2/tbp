import { supabase } from './supabase';

export type AnalyticsEventType =
    | 'page_view'
    | 'click'
    | 'login'
    | 'signup'
    | 'link_visit'
    | 'listing_view'
    | 'booking_started';

interface TrackOptions {
    target?: string | null;
    couponCode?: string | null;
    metadata?: Record<string, unknown>;
}

interface QueuedEvent {
    event_type: AnalyticsEventType;
    visitor_id: string;
    session_id: string;
    user_id: string | null;
    path: string;
    referrer_host: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    coupon_code: string | null;
    target: string | null;
    device: 'mobile' | 'tablet' | 'desktop';
    metadata: Record<string, unknown>;
}

const VISITOR_KEY = 'tbp:analytics:visitor';
const SESSION_KEY = 'tbp:analytics:session';
const ATTRIBUTION_KEY = 'tbp:analytics:attribution';
const FLUSH_INTERVAL_MS = 4000;
const MAX_BATCH = 20;
const MAX_QUEUE = 100;
const UNTRACKED_PATH_PREFIXES = ['/dashboard', '/admin', '/provider'];

const queue: QueuedEvent[] = [];
let currentUserId: string | null = null;
let accessToken: string | null = null;
let flushTimer: number | null = null;
let started = false;

const analyticsEnabled = (): boolean => {
    if (typeof window === 'undefined') return false;
    if (import.meta.env.VITE_ANALYTICS_ENABLED === 'false') return false;
    if (navigator.webdriver) return false;
    if (navigator.doNotTrack === '1') return false;
    return true;
};

const randomId = (): string => (
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
);

const readOrCreate = (storage: Storage, key: string): string => {
    try {
        const existing = storage.getItem(key);
        if (existing) return existing;
        const created = randomId();
        storage.setItem(key, created);
        return created;
    } catch {
        return randomId();
    }
};

const detectDevice = (): 'mobile' | 'tablet' | 'desktop' => {
    const width = window.innerWidth;
    if (width < 700) return 'mobile';
    if (width < 1100) return 'tablet';
    return 'desktop';
};

const cleanValue = (value: string | null | undefined, max: number): string | null => {
    const trimmed = (value || '').trim().slice(0, max);
    return trimmed || null;
};

interface Attribution {
    referrer_host: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
}

/** First-touch attribution, captured once per browser session. */
const getAttribution = (): Attribution => {
    try {
        const stored = window.sessionStorage.getItem(ATTRIBUTION_KEY);
        if (stored) return JSON.parse(stored) as Attribution;
    } catch {
        // fall through and rebuild
    }

    const params = new URLSearchParams(window.location.search);
    let referrerHost: string | null = null;
    try {
        const host = document.referrer ? new URL(document.referrer).host : '';
        referrerHost = host && host !== window.location.host ? host : null;
    } catch {
        referrerHost = null;
    }

    const attribution: Attribution = {
        referrer_host: cleanValue(referrerHost, 120),
        utm_source: cleanValue(params.get('utm_source') || params.get('ref'), 80),
        utm_medium: cleanValue(params.get('utm_medium'), 80),
        utm_campaign: cleanValue(params.get('utm_campaign'), 80),
    };

    try {
        window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch {
        // storage unavailable; attribution just won't persist across pages
    }
    return attribution;
};

export const isTrackablePath = (pathname: string): boolean => (
    !UNTRACKED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

const flush = async () => {
    flushTimer = null;
    if (queue.length === 0) return;

    const batch = queue.splice(0, MAX_BATCH);
    try {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(`${url}/rest/v1/analytics_events`, {
            method: 'POST',
            keepalive: true,
            headers: {
                apikey: key,
                Authorization: `Bearer ${accessToken || key}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
            },
            body: JSON.stringify(batch),
        });
        if (!response.ok) throw new Error(`analytics ${response.status}`);
    } catch {
        // Analytics is best-effort: drop the batch rather than retry forever.
    }

    if (queue.length > 0) scheduleFlush();
};

const scheduleFlush = () => {
    if (flushTimer !== null) return;
    flushTimer = window.setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
};

export const trackEvent = (eventType: AnalyticsEventType, options: TrackOptions = {}) => {
    if (!analyticsEnabled() || !isTrackablePath(window.location.pathname)) return;
    startAnalytics();

    if (queue.length >= MAX_QUEUE) queue.shift();
    queue.push({
        event_type: eventType,
        visitor_id: readOrCreate(window.localStorage, VISITOR_KEY),
        session_id: readOrCreate(window.sessionStorage, SESSION_KEY),
        user_id: currentUserId,
        path: window.location.pathname.slice(0, 300),
        ...getAttribution(),
        coupon_code: cleanValue(options.couponCode, 40),
        target: cleanValue(options.target, 120),
        device: detectDevice(),
        metadata: options.metadata || {},
    });

    if (queue.length >= MAX_BATCH) void flush();
    else scheduleFlush();
};

/** Login/signup happen on /login, which is trackable, but the user id is only known afterwards. */
export const trackAuthEvent = (eventType: 'login' | 'signup', userId?: string | null, provider = 'password') => {
    if (userId) currentUserId = userId;
    trackEvent(eventType, { metadata: { provider } });
};

export const setAnalyticsUser = (userId: string | null) => {
    currentUserId = userId;
};

function startAnalytics() {
    if (started || typeof window === 'undefined') return;
    started = true;

    void supabase.auth.getSession().then(({ data }) => {
        accessToken = data.session?.access_token || null;
    });
    supabase.auth.onAuthStateChange((_event, session) => {
        accessToken = session?.access_token || null;
    });

    const flushNow = () => {
        if (queue.length > 0) void flush();
    };
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushNow();
    });
    window.addEventListener('pagehide', flushNow);
}
