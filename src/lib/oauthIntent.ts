export type OAuthIntent = {
    provider: 'google';
    mode: 'signup';
    role: 'tourist';
    fullName?: string | null;
    phone?: string | null;
    country?: string | null;
    city?: string | null;
    bio?: string | null;
};

const OAUTH_INTENT_STORAGE_KEY = 'tbp.oauth.intent';

const isBrowser = () => typeof window !== 'undefined';

const normalizeOptionalString = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized || null;
};

export const getOAuthIntent = (): OAuthIntent | null => {
    if (!isBrowser()) return null;

    const raw = window.localStorage.getItem(OAUTH_INTENT_STORAGE_KEY);
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (parsed.provider !== 'google' || parsed.mode !== 'signup' || parsed.role !== 'tourist') {
            return null;
        }

        return {
            provider: 'google',
            mode: 'signup',
            role: 'tourist',
            fullName: normalizeOptionalString(parsed.fullName),
            phone: normalizeOptionalString(parsed.phone),
            country: normalizeOptionalString(parsed.country),
            city: normalizeOptionalString(parsed.city),
            bio: normalizeOptionalString(parsed.bio),
        };
    } catch {
        return null;
    }
};

export const setOAuthIntent = (intent: OAuthIntent) => {
    if (!isBrowser()) return;
    window.localStorage.setItem(OAUTH_INTENT_STORAGE_KEY, JSON.stringify(intent));
};

export const clearOAuthIntent = () => {
    if (!isBrowser()) return;
    window.localStorage.removeItem(OAUTH_INTENT_STORAGE_KEY);
};

export const isGoogleTouristSignupIntent = (intent: OAuthIntent | null): intent is OAuthIntent => (
    intent?.provider === 'google' && intent.mode === 'signup' && intent.role === 'tourist'
);
