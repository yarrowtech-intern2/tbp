import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResponse = (status: number, payload: unknown): Response => (
    new Response(JSON.stringify(payload), {
        status,
        headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
        },
    })
);

const encoder = new TextEncoder();

const toHex = (buffer: ArrayBuffer): string => (
    Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
);

const hmacSha256Hex = async (secret: string, payload: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        {
            name: 'HMAC',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return toHex(signature);
};

type ListingType = 'tour' | 'activity' | 'guide';
const LEGACY_LISTING_ID_COLUMNS = ['listing_id', 'post_id', 'activity_id'] as const;

interface BookingPayload {
    listing_id?: string;
    listing_type?: ListingType;
    provider_user_id?: string | null;
    listing_title?: string;
    listing_image?: string;
    number_of_people?: number;
    unit_price?: number;
    total_price?: number;
    platform_fee_rate?: number;
    platform_fee_amount?: number;
    provider_payout_amount?: number;
    booking_date?: string | null;
    is_virtual_tour?: boolean;
}

interface PaymentPayload {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
}

interface ConfirmBody {
    booking?: BookingPayload;
    payment?: PaymentPayload;
}

interface TransactionalEmail {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

interface TransactionalEmailResult {
    ok: boolean;
    skipped: boolean;
    reason?: string;
}

interface RecipientEmailDelivery {
    sent: boolean;
    skipped: boolean;
    reason?: string;
}

interface BookingEmailDelivery {
    traveler: RecipientEmailDelivery;
    provider: RecipientEmailDelivery;
}

type SupabaseAdminClient = ReturnType<typeof createClient>;
const PLATFORM_FEE_RATE = 0.15;

const toPositiveNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
};

const toOptionalPositiveNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
};

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const calculatePricing = (providerUnitPrice: number, numberOfPeople: number, feeRate = PLATFORM_FEE_RATE) => {
    const safePeople = Math.max(1, Math.floor(numberOfPeople));
    const safeUnit = roundMoney(Math.max(0, providerUnitPrice));
    const safeRate = Number.isFinite(feeRate) && feeRate >= 0 ? feeRate : PLATFORM_FEE_RATE;
    const touristUnitPrice = roundMoney(safeUnit * (1 + safeRate));
    const providerSubtotal = roundMoney(safeUnit * safePeople);
    const totalPrice = roundMoney(touristUnitPrice * safePeople);
    const platformFeeAmount = roundMoney(totalPrice - providerSubtotal);
    return {
        providerUnitPrice: safeUnit,
        touristUnitPrice,
        providerSubtotal,
        platformFeeRate: safeRate,
        platformFeeAmount,
        totalPrice,
    };
};

const normalizePeopleCount = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return 1;
};

const ensureEnv = (name: string): string => {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeLooseString = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return '';
    return trimmed;
};

const normalizeOptionalUuid = (value: unknown): string | null => {
    const normalized = normalizeLooseString(value);
    if (!normalized) return null;
    return UUID_REGEX.test(normalized) ? normalized : null;
};

const deterministicListingUuid = async (listingType: string, listingId: string): Promise<string> => {
    const seed = encoder.encode(`tbp-listing:${listingType}:${listingId}`);
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', seed));
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = Array.from(hash.slice(0, 16))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const normalizeListingType = (value: unknown): ListingType | null => {
    const normalized = normalizeLooseString(value)?.toLowerCase();
    if (!normalized) return null;
    if (normalized === 'event') return 'guide';
    if (normalized === 'tour' || normalized === 'activity' || normalized === 'guide') return normalized;
    return null;
};

const asErrorMessage = (value: unknown): string => (
    value instanceof Error
        ? value.message
        : typeof value === 'string'
            ? value
            : ''
);

const formatInr = (value: number): string => (
    `INR ${Math.round(value).toLocaleString('en-IN')}`
);

const formatBookingDate = (value?: string | null): string => {
    if (!value) return 'To be coordinated with the provider';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};

const getAppUrl = (): string => (
    (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('VITE_PUBLIC_APP_URL') || '').trim().replace(/\/+$/, '')
);

const normalizeRecipients = (value: string | string[]): string[] => (
    (Array.isArray(value) ? value : [value])
        .map((email) => email.trim())
        .filter(Boolean)
);

const escapeHtml = (value: unknown): string => (
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
);

const sendTransactionalEmail = async (
    message: TransactionalEmail
): Promise<TransactionalEmailResult> => {
    const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
    const from = Deno.env.get('EMAIL_FROM')?.trim();
    const defaultReplyTo = Deno.env.get('EMAIL_REPLY_TO')?.trim();
    const to = normalizeRecipients(message.to);

    if (!to.length) {
        return { ok: false, skipped: true, reason: 'No recipient email address.' };
    }

    if (!apiKey || !from) {
        return { ok: false, skipped: true, reason: 'Email provider is not configured.' };
    }

    const payload: Record<string, unknown> = {
        from,
        to,
        subject: message.subject,
        html: message.html,
    };

    if (message.text?.trim()) payload.text = message.text.trim();
    if (message.replyTo?.trim() || defaultReplyTo) {
        payload.reply_to = message.replyTo?.trim() || defaultReplyTo;
    }

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const details = await response.text().catch(() => '');
        return {
            ok: false,
            skipped: false,
            reason: details || `Email provider returned ${response.status}.`,
        };
    }

    return { ok: true, skipped: false };
};

const extractMissingColumnName = (message: string | undefined): string | null => {
    if (!message) return null;
    const quoted = message.match(/"([a-zA-Z_][a-zA-Z0-9_]*)"/);
    if (quoted?.[1]) return quoted[1];
    const alt = message.match(/column\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+does not exist/i);
    if (alt?.[1]) return alt[1];
    return null;
};

const extractDefaultOnlyColumnName = (message: string | undefined): string | null => {
    if (!message) return null;
    const match = message.match(/cannot insert a non-default value into column "([a-zA-Z_][a-zA-Z0-9_]*)"/i);
    if (match?.[1]) return match[1];
    const updateMatch = message.match(/column "([a-zA-Z_][a-zA-Z0-9_]*)" can only be updated to default/i);
    if (updateMatch?.[1]) return updateMatch[1];
    return null;
};

const extractNotNullColumnName = (message: string | undefined): string | null => {
    if (!message) return null;
    const match = message.match(/null value in column "([a-zA-Z_][a-zA-Z0-9_]*)"/i);
    return match?.[1] || null;
};

const isMissingColumnError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === '42703'
        || error?.code === 'PGRST204'
        || (message.includes('column') && message.includes('does not exist'))
    );
};

const isDefaultOnlyColumnError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('cannot insert a non-default value into column')
        || message.includes('can only be updated to default');
};

const isInvalidUuidInputError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === '22P02'
        || message.includes('invalid input syntax for type uuid')
        || message.includes('invalid input syntax for uuid')
    );
};

const isNotNullViolationError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return error?.code === '23502'
        || (message.includes('null value in column') && message.includes('violates not-null constraint'));
};

const applyUuidFallbackToNextListingIdColumn = (
    payload: Record<string, unknown>,
    listingId: string,
    fallbackId: string,
) => {
    for (const column of LEGACY_LISTING_ID_COLUMNS) {
        if (payload[column] === listingId) {
            payload[column] = fallbackId;
            return true;
        }
    }
    return false;
};

const insertNotificationsWithSchemaFallback = async (
    admin: SupabaseAdminClient,
    rows: Array<Record<string, unknown>>
) => {
    let payload = rows.map((row) => ({ ...row }));
    let attempt = 0;

    while (attempt < 8) {
        attempt += 1;
        const { error } = await admin.from('notifications').insert(payload);
        if (!error) return;

        const missingColumn = extractMissingColumnName(error.message);
        if (!missingColumn) {
            console.warn('Failed to insert booking notifications:', error.message);
            return;
        }

        let removedAny = false;
        payload = payload.map((row) => {
            if (missingColumn in row) {
                removedAny = true;
                const next = { ...row };
                delete next[missingColumn];
                return next;
            }
            return row;
        });

        if (!removedAny) {
            console.warn('Failed to insert booking notifications:', error.message);
            return;
        }
    }
};

const resolveProviderUserId = async (
    admin: SupabaseAdminClient,
    explicitProviderUserId: string | null,
    listingType: ListingType,
    listingId: string
): Promise<string | null> => {
    if (explicitProviderUserId) return explicitProviderUserId;

    const lookupById = async (table: string, columns: string): Promise<Record<string, unknown> | null> => {
        const lookup = await admin
            .from(table)
            .select(columns)
            .eq('id', listingId)
            .maybeSingle();

        if (lookup.error) {
            if (!isInvalidUuidInputError(lookup.error)) {
                console.warn('confirm-razorpay-booking provider lookup failed', {
                    table,
                    listing_id: listingId,
                    error: lookup.error.message,
                });
            }
            return null;
        }

        return (lookup.data as Record<string, unknown> | null) || null;
    };

    const postData = await lookupById('posts', 'provider_user_id, user_id');

    if (postData) {
        const providerFromPost = normalizeOptionalUuid(postData.provider_user_id);
        if (providerFromPost) return providerFromPost;
        const ownerFromPost = normalizeOptionalUuid(postData.user_id);
        if (ownerFromPost) return ownerFromPost;
    }

    if (listingType === 'activity') {
        const activityData = await lookupById('activities', 'user_id');

        if (activityData) {
            const owner = normalizeOptionalUuid(activityData.user_id);
            if (owner) return owner;
        }
    }

    if (listingType === 'tour') {
        const tourData = await lookupById('tours', 'user_id');

        if (tourData) {
            const owner = normalizeOptionalUuid(tourData.user_id);
            if (owner) return owner;
        }
    }

    if (listingType === 'guide') {
        const eventData = await lookupById('events', 'user_id');

        if (eventData) {
            const owner = normalizeOptionalUuid(eventData.user_id);
            if (owner) return owner;
        }
    }

    return null;
};

const createPaymentNotifications = async (args: {
    admin: SupabaseAdminClient;
    travelerId: string;
    providerId: string | null;
    bookingId: string;
    listingId: string;
    listingTitle: string;
    travelersCount: number;
    totalPrice: number;
    bookingDate?: string | null;
    isVirtualTour?: boolean;
    travelerName: string;
    travelerEmail: string;
    travelerPhone: string;
}) => {
    const touristRoute = args.isVirtualTour ? `/virtual-tours/live/${args.bookingId}` : '/dashboard/tourist?section=bookings';
    const providerRoute = args.isVirtualTour ? `/virtual-tours/live/${args.bookingId}` : '/dashboard/provider?section=bookings';
    const priorityMetadata = args.isVirtualTour ? { priority: 'live_tour' } : {};
    const providerBody = [
        `${args.travelerName} booked ${args.listingTitle}.`,
        `Travelers: ${args.travelersCount}.`,
        args.bookingDate ? `Date: ${args.bookingDate}.` : null,
        `Amount paid: INR ${Math.round(args.totalPrice).toLocaleString()}.`,
        args.travelerEmail ? `Email: ${args.travelerEmail}.` : null,
        args.travelerPhone ? `Phone: ${args.travelerPhone}.` : null,
    ].filter(Boolean).join(' ');

    const rows: Array<Record<string, unknown>> = [
        {
            user_id: args.travelerId,
            actor_user_id: args.travelerId,
            type: 'booking_created',
            title: args.isVirtualTour ? 'Live tour request submitted' : 'Booking request submitted',
            body: args.isVirtualTour
                ? `Payment received for ${args.listingTitle}. Waiting for the local guide to accept your live slot.`
                : `Payment received for ${args.listingTitle}. Waiting for provider confirmation.`,
            metadata: {
                booking_id: args.bookingId,
                listing_id: args.listingId,
                route: touristRoute,
                traveler_name: args.travelerName,
                traveler_email: args.travelerEmail,
                traveler_phone: args.travelerPhone,
                ...priorityMetadata,
            },
            is_read: false,
            read_at: null,
        },
        {
            user_id: args.travelerId,
            actor_user_id: args.travelerId,
            type: 'payment_paid',
            title: 'Payment successful',
            body: `Payment received for ${args.listingTitle}.`,
                metadata: {
                    booking_id: args.bookingId,
                    listing_id: args.listingId,
                    route: touristRoute,
                    ...priorityMetadata,
                },
            is_read: false,
            read_at: null,
        },
    ];

    if (args.providerId && args.providerId !== args.travelerId) {
        rows.push(
            {
                user_id: args.providerId,
                actor_user_id: args.travelerId,
                type: 'booking_created',
                title: args.isVirtualTour ? 'Priority live tour booking' : 'New booking received',
                body: providerBody,
                metadata: {
                    booking_id: args.bookingId,
                    listing_id: args.listingId,
                    route: providerRoute,
                    traveler_name: args.travelerName,
                    traveler_email: args.travelerEmail,
                    traveler_phone: args.travelerPhone,
                    amount_paid: args.totalPrice,
                    booking_date: args.bookingDate || null,
                    ...priorityMetadata,
                },
                is_read: false,
                read_at: null,
            },
            {
                user_id: args.providerId,
                actor_user_id: args.travelerId,
                type: 'payment_paid',
                title: 'Payment received',
                body: `Payment completed for ${args.listingTitle}.`,
                metadata: {
                    booking_id: args.bookingId,
                    listing_id: args.listingId,
                    route: providerRoute,
                    traveler_name: args.travelerName,
                    traveler_email: args.travelerEmail,
                    traveler_phone: args.travelerPhone,
                    ...priorityMetadata,
                },
                is_read: false,
                read_at: null,
            },
        );
    }

    await insertNotificationsWithSchemaFallback(args.admin, rows);
};

const safeCreatePaymentNotifications = async (
    args: Parameters<typeof createPaymentNotifications>[0]
) => {
    try {
        await createPaymentNotifications(args);
    } catch (error) {
        console.error('confirm-razorpay-booking notification write failed (non-blocking)', {
            error: asErrorMessage(error),
            traveler_id: args.travelerId,
            provider_id: args.providerId,
            booking_id: args.bookingId,
            listing_id: args.listingId,
        });
    }
};

const getAuthUserContact = async (
    admin: SupabaseAdminClient,
    userId: string | null | undefined
): Promise<{ email: string; name: string }> => {
    if (!userId) return { email: '', name: '' };

    try {
        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error || !data.user) {
            if (error) console.warn('Failed to load auth user contact for email fallback', error.message);
            return { email: '', name: '' };
        }

        const metadata = data.user.user_metadata || {};
        const fullName = normalizeLooseString(metadata.full_name)
            || normalizeLooseString(metadata.name)
            || normalizeLooseString(data.user.email?.split('@')[0]);

        return {
            email: normalizeLooseString(data.user.email),
            name: fullName,
        };
    } catch (error) {
        console.warn('Failed to load auth user contact for email fallback', asErrorMessage(error));
        return { email: '', name: '' };
    }
};

const sendBookingEmails = async (args: {
    travelerEmail: string;
    travelerName: string;
    providerEmail: string;
    providerName: string;
    bookingId: string;
    listingTitle: string;
    travelersCount: number;
    totalPrice: number;
    bookingDate?: string | null;
}): Promise<BookingEmailDelivery> => {
    const appUrl = getAppUrl();
    const touristBookingsUrl = appUrl ? `${appUrl}/dashboard/tourist?section=bookings` : '';
    const providerBookingsUrl = appUrl ? `${appUrl}/dashboard/provider?section=bookings` : '';
    const safeListingTitle = escapeHtml(args.listingTitle);
    const safeBookingId = escapeHtml(args.bookingId);
    const safeTravelerName = escapeHtml(args.travelerName || 'Traveler');
    const safeProviderName = escapeHtml(args.providerName || 'Provider');
    const bookingDate = escapeHtml(formatBookingDate(args.bookingDate));
    const paidAmount = escapeHtml(formatInr(args.totalPrice));

    const travelerHtml = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
            <h2 style="margin:0 0 12px">Booking request submitted</h2>
            <p>Hi ${safeTravelerName}, your payment was received and your booking request for <strong>${safeListingTitle}</strong> has been submitted.</p>
            <p><strong>Booking ID:</strong> ${safeBookingId}<br>
            <strong>Travelers:</strong> ${args.travelersCount}<br>
            <strong>Date:</strong> ${bookingDate}<br>
            <strong>Amount paid:</strong> ${paidAmount}</p>
            <p>The provider will review and confirm the request from their dashboard.</p>
            ${touristBookingsUrl ? `<p><a href="${escapeHtml(touristBookingsUrl)}">View your booking</a></p>` : ''}
        </div>
    `;

    const providerHtml = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
            <h2 style="margin:0 0 12px">New booking received</h2>
            <p>Hi ${safeProviderName},</p>
            <p>${safeTravelerName} booked <strong>${safeListingTitle}</strong>.</p>
            <p><strong>Booking ID:</strong> ${safeBookingId}<br>
            <strong>Travelers:</strong> ${args.travelersCount}<br>
            <strong>Date:</strong> ${bookingDate}<br>
            <strong>Amount paid:</strong> ${paidAmount}</p>
            <p>Open your dashboard to accept or reject this booking.</p>
            ${providerBookingsUrl ? `<p><a href="${escapeHtml(providerBookingsUrl)}">Open provider bookings</a></p>` : ''}
        </div>
    `;
    let traveler: RecipientEmailDelivery = {
        sent: false,
        skipped: true,
        reason: 'No traveler email address.',
    };
    let provider: RecipientEmailDelivery = {
        sent: false,
        skipped: true,
        reason: 'No provider email address.',
    };

    if (args.travelerEmail) {
        const result = await sendTransactionalEmail({
            to: args.travelerEmail,
            subject: `Booking received: ${args.listingTitle}`,
            html: travelerHtml,
            text: [
                `Hi ${args.travelerName || 'Traveler'}, your payment was received.`,
                `Booking: ${args.listingTitle}`,
                `Booking ID: ${args.bookingId}`,
                `Travelers: ${args.travelersCount}`,
                `Date: ${formatBookingDate(args.bookingDate)}`,
                `Amount paid: ${formatInr(args.totalPrice)}`,
                touristBookingsUrl ? `View: ${touristBookingsUrl}` : '',
            ].filter(Boolean).join('\n'),
        });
        traveler = {
            sent: result.ok,
            skipped: result.skipped,
            reason: result.ok ? undefined : result.reason,
        };
        if (!result.ok) console.warn('Booking traveler email was not sent', result.reason);
        else console.info('Booking traveler email sent', { booking_id: args.bookingId });
    } else {
        console.warn('Booking traveler email skipped: no traveler email address.', {
            booking_id: args.bookingId,
        });
    }

    if (args.providerEmail && args.providerEmail.toLowerCase() !== args.travelerEmail.toLowerCase()) {
        const result = await sendTransactionalEmail({
            to: args.providerEmail,
            subject: `New booking: ${args.listingTitle}`,
            html: providerHtml,
            text: [
                `${args.travelerName || 'A traveler'} booked ${args.listingTitle}.`,
                `Booking ID: ${args.bookingId}`,
                `Travelers: ${args.travelersCount}`,
                `Date: ${formatBookingDate(args.bookingDate)}`,
                `Amount paid: ${formatInr(args.totalPrice)}`,
                providerBookingsUrl ? `Open: ${providerBookingsUrl}` : '',
            ].filter(Boolean).join('\n'),
        });
        provider = {
            sent: result.ok,
            skipped: result.skipped,
            reason: result.ok ? undefined : result.reason,
        };
        if (!result.ok) console.warn('Booking provider email was not sent', result.reason);
        else console.info('Booking provider email sent', { booking_id: args.bookingId });
    } else if (!args.providerEmail) {
        console.warn('Booking provider email skipped: no provider email address.', {
            booking_id: args.bookingId,
        });
    } else {
        provider = {
            sent: false,
            skipped: true,
            reason: 'Provider email matches traveler email.',
        };
    }

    return { traveler, provider };
};

const safeSendBookingEmails = async (
    args: Parameters<typeof sendBookingEmails>[0]
): Promise<BookingEmailDelivery> => {
    try {
        return await sendBookingEmails(args);
    } catch (error) {
        console.error('confirm-razorpay-booking email send failed (non-blocking)', {
            error: asErrorMessage(error),
            booking_id: args.bookingId,
        });
        return {
            traveler: {
                sent: false,
                skipped: false,
                reason: asErrorMessage(error) || 'Traveler email send failed.',
            },
            provider: {
                sent: false,
                skipped: false,
                reason: asErrorMessage(error) || 'Provider email send failed.',
            },
        };
    }
};

const skippedBookingEmailDelivery = (reason: string): BookingEmailDelivery => ({
    traveler: {
        sent: false,
        skipped: true,
        reason,
    },
    provider: {
        sent: false,
        skipped: true,
        reason,
    },
});

const authenticateUser = async (authHeader: string) => {
    const supabaseUrl = ensureEnv('SUPABASE_URL');
    const supabaseAnonKey = ensureEnv('SUPABASE_ANON_KEY');
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    try {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) throw new Error('Unauthorized');
        return data.user;
    } catch {
        throw new Error('Unauthorized');
    }
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) return jsonResponse(401, { error: 'Missing Authorization header.' });

        const user = await authenticateUser(authHeader);
        const body = (await req.json()) as ConfirmBody;
        const booking = body.booking;
        const payment = body.payment;

        const orderId = normalizeLooseString(payment?.razorpay_order_id);
        const paymentId = normalizeLooseString(payment?.razorpay_payment_id);
        const signature = normalizeLooseString(payment?.razorpay_signature);

        if (!orderId || !paymentId || !signature) {
            return jsonResponse(400, { error: 'Payment data is incomplete.' });
        }

        const razorpaySecret = ensureEnv('RAZORPAY_KEY_SECRET');
        const signedPayload = `${orderId}|${paymentId}`;
        const expectedSignature = await hmacSha256Hex(razorpaySecret, signedPayload);
        if (expectedSignature !== signature) {
            return jsonResponse(400, { error: 'Payment signature verification failed.' });
        }

        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        let listingId = normalizeLooseString(booking?.listing_id);
        let listingType = normalizeListingType(booking?.listing_type);
        let listingTitle = normalizeLooseString(booking?.listing_title);
        let listingImage = normalizeLooseString(booking?.listing_image);
        let providerUserId = normalizeOptionalUuid(booking?.provider_user_id);
        let numberOfPeople = normalizePeopleCount(booking?.number_of_people);
        let unitPrice = toPositiveNumber(booking?.unit_price);
        let totalPrice = toPositiveNumber(booking?.total_price);
        let platformFeeRate = toOptionalPositiveNumber(booking?.platform_fee_rate);
        let platformFeeAmount = toOptionalPositiveNumber(booking?.platform_fee_amount);
        let providerPayoutAmount = toOptionalPositiveNumber(booking?.provider_payout_amount);
        let bookingDateRaw = normalizeLooseString(booking?.booking_date);
        let bookingDate = bookingDateRaw || null;
        let isVirtualTour = booking?.is_virtual_tour === true;

        const hydrateFromPending = await admin
            .from('bookings')
            .select('*')
            .eq('user_id', user.id)
            .eq('payment_order_id', orderId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!hydrateFromPending.error && hydrateFromPending.data) {
            const pending = hydrateFromPending.data as Record<string, unknown>;
            listingId = listingId || normalizeLooseString(pending.source_listing_id) || normalizeLooseString(pending.listing_id);
            listingType = listingType || normalizeListingType(pending.listing_type);
            listingTitle = listingTitle || normalizeLooseString(pending.listing_title);
            listingImage = listingImage || normalizeLooseString(pending.listing_image);
            providerUserId = providerUserId || normalizeOptionalUuid(pending.provider_user_id);
            if (!unitPrice) unitPrice = toPositiveNumber(pending.unit_price);
            if (!totalPrice) totalPrice = toPositiveNumber(pending.total_price);
            if (!platformFeeRate) platformFeeRate = toOptionalPositiveNumber(pending.platform_fee_rate);
            if (!platformFeeAmount) platformFeeAmount = toOptionalPositiveNumber(pending.platform_fee_amount);
            if (!providerPayoutAmount) providerPayoutAmount = toOptionalPositiveNumber(pending.provider_payout_amount);
            if (!bookingDate) {
                bookingDateRaw = normalizeLooseString(pending.booking_date);
                bookingDate = bookingDateRaw || null;
            }
            isVirtualTour = isVirtualTour || pending.is_virtual_tour === true;
            if (!booking?.number_of_people && pending.number_of_people !== undefined && pending.number_of_people !== null) {
                numberOfPeople = normalizePeopleCount(pending.number_of_people);
            }
        }

        if (!listingId || !listingType || !listingTitle || !unitPrice || !totalPrice) {
            const razorpayKeyId = ensureEnv('RAZORPAY_KEY_ID');
            const basicToken = btoa(`${razorpayKeyId}:${razorpaySecret}`);
            const orderLookup = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}`, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${basicToken}`,
                },
            });

            if (orderLookup.ok) {
                let orderPayload: Record<string, unknown> = {};
                try {
                    orderPayload = await orderLookup.json() as Record<string, unknown>;
                } catch {
                    orderPayload = {};
                }
                const notes = (orderPayload.notes || {}) as Record<string, unknown>;
                listingId = listingId || normalizeLooseString(notes.listing_id);
                listingType = listingType || normalizeListingType(notes.listing_type);
                listingTitle = listingTitle || normalizeLooseString(notes.listing_title);
                providerUserId = providerUserId || normalizeOptionalUuid(notes.provider_user_id);
                if (!unitPrice) unitPrice = toPositiveNumber(notes.unit_price);
                if (!platformFeeRate) platformFeeRate = toOptionalPositiveNumber(notes.platform_fee_rate);
                if (!platformFeeAmount) platformFeeAmount = toOptionalPositiveNumber(notes.platform_fee_amount);
                if (!providerPayoutAmount) providerPayoutAmount = toOptionalPositiveNumber(notes.provider_payout_amount);
                if (!bookingDate) {
                    bookingDateRaw = normalizeLooseString(notes.booking_date);
                    bookingDate = bookingDateRaw || null;
                }
                const noteVirtual = normalizeLooseString(notes.is_virtual_tour).toLowerCase();
                isVirtualTour = isVirtualTour || noteVirtual === 'true' || noteVirtual === '1';
                if (!booking?.number_of_people) {
                    numberOfPeople = normalizePeopleCount(notes.number_of_people);
                }
                const amountFromOrder = toPositiveNumber(orderPayload.amount);
                if (!totalPrice && amountFromOrder) totalPrice = amountFromOrder / 100;
            } else {
                const orderLookupError = await orderLookup.text();
                console.warn('confirm-razorpay-booking failed to hydrate order metadata from Razorpay', orderLookupError);
            }
        }

        if (!listingId || !listingType || !listingTitle) {
            return jsonResponse(400, { error: 'listing_id, listing_type, and listing_title are required.' });
        }
        if (!unitPrice) {
            return jsonResponse(400, { error: 'Invalid booking amount.' });
        }
        const computedPricing = calculatePricing(unitPrice, numberOfPeople, platformFeeRate ?? PLATFORM_FEE_RATE);
        totalPrice = totalPrice && totalPrice > 0 ? roundMoney(totalPrice) : computedPricing.totalPrice;
        if (Math.abs(totalPrice - computedPricing.totalPrice) > 0.5) {
            totalPrice = computedPricing.totalPrice;
        }
        platformFeeRate = computedPricing.platformFeeRate;
        platformFeeAmount = platformFeeAmount && platformFeeAmount > 0
            ? roundMoney(platformFeeAmount)
            : roundMoney(Math.max(0, totalPrice - computedPricing.providerSubtotal));
        providerPayoutAmount = providerPayoutAmount && providerPayoutAmount > 0
            ? roundMoney(providerPayoutAmount)
            : computedPricing.providerSubtotal;

        const existingLookup = await admin
            .from('bookings')
            .select('id, status, payment_status')
            .eq('payment_id', paymentId)
            .maybeSingle();

        if (!existingLookup.error && existingLookup.data?.id) {
            return jsonResponse(200, {
                booking_id: existingLookup.data.id,
                email_delivery: skippedBookingEmailDelivery('Booking payment was already confirmed.'),
            });
        }

        const resolvedProviderUserId = await resolveProviderUserId(
            admin,
            providerUserId,
            listingType,
            listingId
        );
        const travelerProfile = await admin
            .from('profiles')
            .select('full_name, email, phone')
            .eq('id', user.id)
            .maybeSingle();
        const travelerAuthContact = {
            email: normalizeLooseString(user.email),
            name: normalizeLooseString(user.user_metadata?.full_name)
                || normalizeLooseString(user.user_metadata?.name),
        };
        const travelerName = normalizeLooseString((travelerProfile.data as Record<string, unknown> | null)?.full_name)
            || normalizeLooseString((travelerProfile.data as Record<string, unknown> | null)?.email)
            || travelerAuthContact.name
            || normalizeLooseString(travelerAuthContact.email.split('@')[0])
            || 'A traveler';
        const travelerEmail = normalizeLooseString((travelerProfile.data as Record<string, unknown> | null)?.email)
            || travelerAuthContact.email;
        const travelerPhone = normalizeLooseString((travelerProfile.data as Record<string, unknown> | null)?.phone);
        let providerName = 'Provider';
        let providerEmail = '';

        if (resolvedProviderUserId) {
            const providerProfile = await admin
                .from('profiles')
                .select('full_name, email, company_name')
                .eq('id', resolvedProviderUserId)
                .maybeSingle();
            const providerData = (providerProfile.data as Record<string, unknown> | null) || null;
            const providerAuthContact = await getAuthUserContact(admin, resolvedProviderUserId);
            providerName = normalizeLooseString(providerData?.company_name)
                || normalizeLooseString(providerData?.full_name)
                || providerAuthContact.name
                || normalizeLooseString(providerAuthContact.email.split('@')[0])
                || 'Provider';
            providerEmail = normalizeLooseString(providerData?.email)
                || providerAuthContact.email;
        }

        let uuidListingIdFallback: string | null = null;
        const getUuidListingIdFallback = async () => {
            uuidListingIdFallback = uuidListingIdFallback || await deterministicListingUuid(listingType, listingId);
            return uuidListingIdFallback;
        };

        const bookingPayload: Record<string, unknown> = {
            provider_user_id: resolvedProviderUserId || null,
            listing_id: listingId,
            post_id: listingId,
            source_listing_id: listingId,
            listing_type: listingType,
            listing_title: listingTitle,
            listing_image: listingImage || null,
            number_of_people: numberOfPeople,
            unit_price: unitPrice,
            total_price: totalPrice,
            platform_fee_rate: platformFeeRate,
            platform_fee_amount: platformFeeAmount,
            provider_payout_amount: providerPayoutAmount,
            payout_status: 'pending_provider_acceptance',
            status: 'pending',
            payment_status: 'paid',
            payment_order_id: orderId,
            payment_id: paymentId,
            payment_signature: signature,
            payment_currency: 'INR',
            paid_at: new Date().toISOString(),
            booking_date: bookingDate,
            user_name: travelerName,
            user_email: travelerEmail || null,
            user_phone: travelerPhone || null,
            is_virtual_tour: isVirtualTour,
        };

        const pendingMatch = await admin
            .from('bookings')
            .select('id')
            .eq('user_id', user.id)
            .eq('payment_order_id', orderId)
            .maybeSingle();

        if (!pendingMatch.error && pendingMatch.data?.id) {
            const updatePayload: Record<string, unknown> = {
                ...bookingPayload,
            };
            let confirmExisting: {
                data: { id?: string } | null;
                error: { code?: string; message?: string } | null;
            } = { data: null, error: null };

            while (Object.keys(updatePayload).length > 0) {
                const updateResult = await admin
                    .from('bookings')
                    .update(updatePayload)
                    .eq('id', pendingMatch.data.id)
                    .select('id')
                    .maybeSingle();

                if (!updateResult.error) {
                    confirmExisting = {
                        data: updateResult.data as { id?: string } | null,
                        error: null,
                    };
                    break;
                }

                if (
                    isInvalidUuidInputError(updateResult.error)
                ) {
                    if (applyUuidFallbackToNextListingIdColumn(updatePayload, listingId, await getUuidListingIdFallback())) {
                        continue;
                    }
                }

                if (
                    isInvalidUuidInputError(updateResult.error)
                    && updatePayload.source_listing_id === listingId
                ) {
                    delete updatePayload.source_listing_id;
                    continue;
                }

                if (isNotNullViolationError(updateResult.error)) {
                    const notNullColumn = extractNotNullColumnName(updateResult.error.message);
                    if (
                        notNullColumn
                        && (LEGACY_LISTING_ID_COLUMNS as readonly string[]).includes(notNullColumn)
                        && !(notNullColumn in updatePayload)
                    ) {
                        updatePayload[notNullColumn] = listingId;
                        continue;
                    }
                }

                if (!isMissingColumnError(updateResult.error) && !isDefaultOnlyColumnError(updateResult.error)) {
                    confirmExisting = {
                        data: null,
                        error: updateResult.error,
                    };
                    break;
                }

                const removableColumn = isMissingColumnError(updateResult.error)
                    ? extractMissingColumnName(updateResult.error.message)
                    : extractDefaultOnlyColumnName(updateResult.error.message);

                if (!removableColumn || !(removableColumn in updatePayload)) {
                    confirmExisting = {
                        data: null,
                        error: updateResult.error,
                    };
                    break;
                }

                console.warn('confirm-razorpay-booking removing non-writable column from update payload', removableColumn);
                delete updatePayload[removableColumn];
            }

            if (!confirmExisting.error && confirmExisting.data?.id) {
                await safeCreatePaymentNotifications({
                    admin,
                    travelerId: user.id,
                    providerId: resolvedProviderUserId,
                    bookingId: confirmExisting.data.id,
                    listingId,
                    listingTitle,
                    travelersCount: numberOfPeople,
                    totalPrice,
                    bookingDate,
                    isVirtualTour,
                    travelerName,
                    travelerEmail,
                    travelerPhone,
                });
                const emailDelivery = await safeSendBookingEmails({
                    travelerEmail,
                    travelerName,
                    providerEmail,
                    providerName,
                    bookingId: confirmExisting.data.id,
                    listingTitle,
                    travelersCount: numberOfPeople,
                    totalPrice,
                    bookingDate,
                });
                return jsonResponse(200, {
                    booking_id: confirmExisting.data.id,
                    email_delivery: emailDelivery,
                });
            }
        }

        let bookingInsert: {
            data: { id?: string } | null;
            error: { code?: string; message?: string } | null;
        } = { data: null, error: null };

        while (Object.keys(bookingPayload).length > 0) {
            const result = await admin
                .from('bookings')
                .insert([{ user_id: user.id, ...bookingPayload }])
                .select('id')
                .maybeSingle();

            if (!result.error) {
                bookingInsert = {
                    data: result.data as { id?: string } | null,
                    error: null,
                };
                break;
            }

            if (
                isInvalidUuidInputError(result.error)
            ) {
                if (applyUuidFallbackToNextListingIdColumn(bookingPayload, listingId, await getUuidListingIdFallback())) {
                    continue;
                }
            }

            if (
                isInvalidUuidInputError(result.error)
                && bookingPayload.source_listing_id === listingId
            ) {
                delete bookingPayload.source_listing_id;
                continue;
            }

            if (isNotNullViolationError(result.error)) {
                const notNullColumn = extractNotNullColumnName(result.error.message);
                if (
                    notNullColumn
                    && (LEGACY_LISTING_ID_COLUMNS as readonly string[]).includes(notNullColumn)
                    && !(notNullColumn in bookingPayload)
                ) {
                    bookingPayload[notNullColumn] = listingId;
                    continue;
                }
            }

            if (!isMissingColumnError(result.error) && !isDefaultOnlyColumnError(result.error)) {
                bookingInsert = {
                    data: null,
                    error: result.error,
                };
                break;
            }

            const removableColumn = isMissingColumnError(result.error)
                ? extractMissingColumnName(result.error.message)
                : extractDefaultOnlyColumnName(result.error.message);

            if (!removableColumn || !(removableColumn in bookingPayload)) {
                bookingInsert = {
                    data: null,
                    error: result.error,
                };
                break;
            }

            console.warn('confirm-razorpay-booking removing non-writable column from insert payload', removableColumn);
            delete bookingPayload[removableColumn];
        }

        if (!bookingInsert.error && bookingInsert.data?.id) {
            await safeCreatePaymentNotifications({
                admin,
                travelerId: user.id,
                providerId: resolvedProviderUserId,
                bookingId: bookingInsert.data.id,
                listingId,
                listingTitle,
                travelersCount: numberOfPeople,
                    totalPrice,
                    bookingDate,
                    isVirtualTour,
                    travelerName,
                    travelerEmail,
                    travelerPhone,
            });
            const emailDelivery = await safeSendBookingEmails({
                travelerEmail,
                travelerName,
                providerEmail,
                providerName,
                bookingId: bookingInsert.data.id,
                listingTitle,
                travelersCount: numberOfPeople,
                totalPrice,
                bookingDate,
            });
            return jsonResponse(200, {
                booking_id: bookingInsert.data.id,
                email_delivery: emailDelivery,
            });
        }

        const bookingInsertError = bookingInsert.error?.message || 'Booking insert failed.';
        console.error('confirm-razorpay-booking bookings insert failed, attempting legacy fallback', {
            error: bookingInsert.error,
            listing_id: listingId,
            listing_type: listingType,
            user_id: user.id,
        });

        // Fall back to bookings_acts so payment does not fail after capture.
        const legacyInsert = await admin
            .from('bookings_acts')
            .insert([{
                user_id: user.id,
                activity_id: listingId,
                number_of_people: numberOfPeople,
                price: unitPrice,
                status: 'confirmed',
            }])
            .select('id')
            .maybeSingle();

        if (legacyInsert.error || !legacyInsert.data?.id) {
            const fallbackMessage = legacyInsert.error?.message || 'Legacy booking insert failed.';
            const message = isInvalidUuidInputError(legacyInsert.error)
                ? bookingInsertError
                : fallbackMessage;
            console.error('confirm-razorpay-booking legacy fallback failed', {
                bookings_error: bookingInsert.error,
                legacy_error: legacyInsert.error,
                user_id: user.id,
                listing_id: listingId,
                payment_id: paymentId,
            });
            return jsonResponse(500, {
                error: message,
                primary_error: bookingInsertError,
                fallback_error: fallbackMessage,
            });
        }

        const fallbackBookingId = String(legacyInsert.data.id);
        await safeCreatePaymentNotifications({
            admin,
            travelerId: user.id,
            providerId: resolvedProviderUserId,
            bookingId: fallbackBookingId,
            listingId,
            listingTitle,
            travelersCount: numberOfPeople,
            totalPrice,
            bookingDate,
            isVirtualTour,
            travelerName,
            travelerEmail,
            travelerPhone,
        });
        const emailDelivery = await safeSendBookingEmails({
            travelerEmail,
            travelerName,
            providerEmail,
            providerName,
            bookingId: fallbackBookingId,
            listingTitle,
            travelersCount: numberOfPeople,
            totalPrice,
            bookingDate,
        });

        return jsonResponse(200, {
            booking_id: fallbackBookingId,
            storage: 'bookings_acts',
            email_delivery: emailDelivery,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        const message = asErrorMessage(error) || 'Internal server error';
        const stack = error instanceof Error ? error.stack : null;
        console.error('confirm-razorpay-booking unhandled error', { message, stack });
        return jsonResponse(500, { error: message, stack });
    }
});
