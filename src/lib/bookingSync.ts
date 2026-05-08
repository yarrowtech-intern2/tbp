import type { ListingType } from './platform';

const BOOKING_SYNC_EVENT = 'tbp:booking-sync';
const BOOKING_LOCAL_STORAGE_KEY = 'tbp:local-bookings:v1';
const MAX_LOCAL_BOOKING_AGE_MS = 1000 * 60 * 60 * 24 * 14;

type LocalBookingMarker = {
    user_id: string;
    listing_id: string;
    listing_type: ListingType;
    listing_title?: string;
    listing_image?: string;
    created_at: string;
};

const canUseDom = () => typeof window !== 'undefined';

const readLocalMarkers = (): LocalBookingMarker[] => {
    if (!canUseDom()) return [];
    try {
        const raw = window.localStorage.getItem(BOOKING_LOCAL_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((item) => item as Partial<LocalBookingMarker>)
            .filter((item) => (
                typeof item?.user_id === 'string'
                && typeof item?.listing_id === 'string'
                && typeof item?.listing_type === 'string'
                && typeof item?.created_at === 'string'
            )) as LocalBookingMarker[];
    } catch {
        return [];
    }
};

const writeLocalMarkers = (markers: LocalBookingMarker[]) => {
    if (!canUseDom()) return;
    try {
        window.localStorage.setItem(BOOKING_LOCAL_STORAGE_KEY, JSON.stringify(markers));
    } catch {
        // Ignore localStorage failures in private mode or quota issues.
    }
};

const pruneOldMarkers = (markers: LocalBookingMarker[]): LocalBookingMarker[] => {
    const now = Date.now();
    return markers.filter((item) => {
        const ts = new Date(item.created_at).getTime();
        if (Number.isNaN(ts)) return false;
        return now - ts <= MAX_LOCAL_BOOKING_AGE_MS;
    });
};

export const emitBookingSync = () => {
    if (!canUseDom()) return;
    window.dispatchEvent(new CustomEvent(BOOKING_SYNC_EVENT));
};

export const onBookingSync = (handler: () => void) => {
    if (!canUseDom()) return () => undefined;
    const listener = () => handler();
    window.addEventListener(BOOKING_SYNC_EVENT, listener);
    return () => window.removeEventListener(BOOKING_SYNC_EVENT, listener);
};

export const markListingBookedLocally = (args: {
    userId: string;
    listingId: string;
    listingType: ListingType;
    listingTitle?: string;
    listingImage?: string;
}) => {
    const listingId = args.listingId.trim();
    if (!listingId || !args.userId) return;

    const current = pruneOldMarkers(readLocalMarkers());
    const marker: LocalBookingMarker = {
        user_id: args.userId,
        listing_id: listingId,
        listing_type: args.listingType,
        listing_title: args.listingTitle?.trim() || undefined,
        listing_image: args.listingImage?.trim() || undefined,
        created_at: new Date().toISOString(),
    };

    const next = [marker, ...current.filter((item) => !(
        item.user_id === marker.user_id
        && item.listing_id === marker.listing_id
        && item.listing_type === marker.listing_type
    ))];

    writeLocalMarkers(next);
    emitBookingSync();
};

export const getLocalBookedLookup = (userId: string) => {
    const byId = new Set<string>();
    const byTypeAndId = new Set<string>();
    if (!userId) return { byId, byTypeAndId };

    const markers = pruneOldMarkers(readLocalMarkers()).filter((item) => item.user_id === userId);
    for (const marker of markers) {
        const listingId = marker.listing_id.trim();
        if (!listingId) continue;
        byId.add(listingId);
        byTypeAndId.add(`${marker.listing_type}:${listingId}`);
    }
    return { byId, byTypeAndId };
};

export const getLocalBookingMarkersForUser = (userId: string): LocalBookingMarker[] => {
    if (!userId) return [];
    return pruneOldMarkers(readLocalMarkers()).filter((item) => item.user_id === userId);
};
