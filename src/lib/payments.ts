import { supabase } from './supabase';
import {
    FunctionsFetchError,
    FunctionsHttpError,
    FunctionsRelayError,
} from '@supabase/supabase-js';
import type {
    RazorpayCheckoutOptions,
    RazorpayPaymentSuccessResponse,
} from '../types/razorpay';
import type { ListingType } from './platform';

const RAZORPAY_SDK_URL = 'https://checkout.razorpay.com/v1/checkout.js';

let razorpaySdkPromise: Promise<void> | null = null;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const loadRazorpaySdk = async (): Promise<void> => {
    if (typeof window !== 'undefined' && window.Razorpay) return;
    if (razorpaySdkPromise) return razorpaySdkPromise;

    razorpaySdkPromise = new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SDK_URL}"]`);
        if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay checkout SDK.')), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = RAZORPAY_SDK_URL;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Razorpay checkout SDK.'));
        document.body.appendChild(script);
    });

    await razorpaySdkPromise;
};

export interface BookingPaymentDraft {
    listing_id: string;
    listing_type: ListingType;
    provider_user_id?: string | null;
    listing_title: string;
    listing_image: string;
    number_of_people: number;
    unit_price: number;
    total_price: number;
    booking_date?: string | null;
}

export interface RazorpayOrderPayload {
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
}

export interface RazorpayCheckoutPrefill {
    name?: string;
    email?: string;
    contact?: string;
}

const getFunctionErrorMessage = async (error: unknown, fallback: string): Promise<string> => {
    if (error instanceof FunctionsHttpError) {
        try {
            const contentType = error.context.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const payload = await error.context.json() as { error?: unknown; message?: unknown };
                if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
                if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
            }
        } catch {
            // Ignore parse errors and try text fallback.
        }

        try {
            const message = (await error.context.text()).trim();
            if (message) return message;
        } catch {
            // Ignore text parse errors.
        }

        return fallback;
    }

    if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
        return error.message || fallback;
    }

    if (error instanceof Error) {
        return error.message || fallback;
    }

    return fallback;
};

const getAccessTokenOrThrow = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
        throw new Error('Could not read your login session. Please sign in again.');
    }

    const token = data.session?.access_token?.trim() || '';
    if (!token) {
        throw new Error('Your session has expired. Please sign in and try again.');
    }

    const userId = data.session?.user?.id?.trim() || '';
    if (!userId || !UUID_REGEX.test(userId)) {
        throw new Error('Invalid login session. Please sign out and sign in again.');
    }

    return token;
};

export const createRazorpayOrder = async (booking: BookingPaymentDraft): Promise<RazorpayOrderPayload> => {
    const accessToken = await getAccessTokenOrThrow();
    const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: {
            ...booking,
            currency: 'INR',
        },
    });

    if (error) {
        throw new Error(await getFunctionErrorMessage(error, 'Could not create payment order.'));
    }

    const payload = data as Partial<RazorpayOrderPayload> | null;
    if (!payload?.order_id || !payload?.key_id || typeof payload.amount !== 'number' || !payload.currency) {
        throw new Error('Invalid payment order response from backend.');
    }

    return {
        order_id: payload.order_id,
        amount: payload.amount,
        currency: payload.currency,
        key_id: payload.key_id,
    };
};

export interface ConfirmRazorpayBookingInput {
    booking: BookingPaymentDraft;
    payment: RazorpayPaymentSuccessResponse;
}

export interface ConfirmRazorpayBookingResult {
    booking_id: string;
}

export const confirmRazorpayBooking = async (
    input: ConfirmRazorpayBookingInput
): Promise<ConfirmRazorpayBookingResult> => {
    const accessToken = await getAccessTokenOrThrow();
    const { data, error } = await supabase.functions.invoke('confirm-razorpay-booking', {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
        body: input,
    });

    if (error) {
        throw new Error(await getFunctionErrorMessage(error, 'Payment verification failed.'));
    }

    const payload = data as Partial<ConfirmRazorpayBookingResult> | null;
    if (!payload?.booking_id) {
        throw new Error('Booking confirmation response is missing booking_id.');
    }

    return { booking_id: payload.booking_id };
};

interface OpenCheckoutInput {
    order: RazorpayOrderPayload;
    booking: BookingPaymentDraft;
    prefill?: RazorpayCheckoutPrefill;
}

export const openRazorpayCheckout = async (
    input: OpenCheckoutInput
): Promise<RazorpayPaymentSuccessResponse> => {
    await loadRazorpaySdk();

    if (!window.Razorpay) {
        throw new Error('Razorpay checkout SDK is unavailable.');
    }
    const RazorpayCheckout = window.Razorpay;

    return new Promise<RazorpayPaymentSuccessResponse>((resolve, reject) => {
        let settled = false;
        const safeResolve = (value: RazorpayPaymentSuccessResponse) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const safeReject = (error: Error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };

        const options: RazorpayCheckoutOptions = {
            key: input.order.key_id,
            amount: input.order.amount,
            currency: input.order.currency,
            name: 'The Better Pass',
            description: `Booking for ${input.booking.listing_title}`,
            order_id: input.order.order_id,
            prefill: input.prefill,
            notes: {
                listing_id: input.booking.listing_id,
                listing_type: input.booking.listing_type,
                booking_date: input.booking.booking_date || '',
            },
            theme: { color: '#1769ff' },
            modal: {
                ondismiss: () => safeReject(new Error('Payment was cancelled.')),
            },
            handler: (response) => safeResolve(response),
        };

        const checkout = new RazorpayCheckout(options);
        checkout.on('payment.failed', (response) => {
            const description = response?.error?.description || response?.error?.reason || 'Payment failed.';
            safeReject(new Error(description));
        });
        checkout.open();
    });
};
