import type { BookingPaymentDraft } from './payments';
import type { RazorpayPaymentSuccessResponse } from '../types/razorpay';

const PENDING_BOOKING_CONFIRMATION_KEY = 'tbp:pending-booking-confirmations:v1';

type PendingBookingConfirmation = {
    user_id: string;
    listing_id: string;
    listing_type: string;
    booking: BookingPaymentDraft;
    payment: RazorpayPaymentSuccessResponse;
    created_at: string;
};

const canUseDom = () => typeof window !== 'undefined';

const readAll = (): PendingBookingConfirmation[] => {
    if (!canUseDom()) return [];
    try {
        const raw = window.localStorage.getItem(PENDING_BOOKING_CONFIRMATION_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return [];
        return parsed as PendingBookingConfirmation[];
    } catch {
        return [];
    }
};

const writeAll = (rows: PendingBookingConfirmation[]) => {
    if (!canUseDom()) return;
    try {
        window.localStorage.setItem(PENDING_BOOKING_CONFIRMATION_KEY, JSON.stringify(rows));
    } catch {
        // Ignore storage write issues.
    }
};

export const savePendingBookingConfirmation = (row: PendingBookingConfirmation) => {
    const existing = readAll();
    const next = [
        row,
        ...existing.filter((item) => !(
            item.user_id === row.user_id
            && item.listing_id === row.listing_id
            && item.listing_type === row.listing_type
        )),
    ];
    writeAll(next);
};

export const getPendingBookingConfirmation = (args: {
    userId: string;
    listingId: string;
    listingType: string;
}): PendingBookingConfirmation | null => {
    const rows = readAll();
    return rows.find((item) => (
        item.user_id === args.userId
        && item.listing_id === args.listingId
        && item.listing_type === args.listingType
    )) || null;
};

export const clearPendingBookingConfirmation = (args: {
    userId: string;
    listingId: string;
    listingType: string;
}) => {
    const rows = readAll();
    const next = rows.filter((item) => !(
        item.user_id === args.userId
        && item.listing_id === args.listingId
        && item.listing_type === args.listingType
    ));
    writeAll(next);
};
