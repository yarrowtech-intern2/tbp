import { useSyncExternalStore } from 'react';

/** True while a festival poster (Kolkata Puja or Diwali) is on screen, so other popups (the guest offer) wait until it's closed. */
let pujaOpen = false;
let diwaliOpen = false;
let posterOpen = false;
const listeners = new Set<() => void>();

const sync = () => {
    const next = pujaOpen || diwaliOpen;
    if (posterOpen === next) return;
    posterOpen = next;
    listeners.forEach((listener) => listener());
};

export const setPujaPosterOpen = (open: boolean) => {
    pujaOpen = open;
    sync();
};

export const setDiwaliPosterOpen = (open: boolean) => {
    diwaliOpen = open;
    sync();
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const usePujaPosterOpen = () => useSyncExternalStore(subscribe, () => posterOpen, () => false);

const CITY_CACHE_KEY = 'tbp-visitor-city';
const KOLKATA_PATTERN = /kolkata|calcutta/i;

const lookups: Array<() => Promise<string>> = [
    async () => {
        const res = await fetch('https://ipwho.is/');
        const data = await res.json() as { success?: boolean; city?: string };
        if (data.success === false) throw new Error('ipwho.is lookup failed');
        return data.city || '';
    },
    async () => {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json() as { city?: string; error?: boolean };
        if (data.error) throw new Error('ipapi lookup failed');
        return data.city || '';
    },
];

/** Resolves true when the visitor's IP maps to Kolkata. The city is cached for the session; failures count as "not Kolkata". */
export const isVisitorInKolkata = async (): Promise<boolean> => {
    try {
        const cached = window.sessionStorage.getItem(CITY_CACHE_KEY);
        if (cached !== null) return KOLKATA_PATTERN.test(cached);
    } catch {
        // storage unavailable; just look it up
    }

    for (const lookup of lookups) {
        try {
            const city = await lookup();
            try {
                window.sessionStorage.setItem(CITY_CACHE_KEY, city);
            } catch {
                // best effort
            }
            return KOLKATA_PATTERN.test(city);
        } catch {
            // try the next provider
        }
    }
    return false;
};
