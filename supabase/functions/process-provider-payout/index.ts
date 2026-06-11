import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-payout-secret',
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

interface ProcessPayoutBody {
    booking_id?: string;
    limit?: number;
    dry_run?: boolean;
}

interface BookingRow {
    id: string;
    provider_user_id: string | null;
    payment_id: string | null;
    payment_status: string | null;
    payout_status: string | null;
    payout_reference: string | null;
    provider_payout_amount: number | string | null;
    total_price?: number | string | null;
    platform_fee_amount?: number | string | null;
    listing_title?: string | null;
}

interface OnboardingRow {
    user_id: string;
    status: string | null;
    razorpay_account_id: string | null;
}

interface PayoutResult {
    booking_id: string;
    status: 'skipped' | 'dry_run' | 'paid_out' | 'failed';
    message?: string;
    transfer_id?: string;
}

const ensureEnv = (name: string): string => {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
};

const normalizeLooseString = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return '';
    return trimmed;
};

const toPositiveNumber = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return null;
};

const normalizeLimit = (value: unknown): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return 10;
    return Math.min(50, Math.floor(parsed));
};

const asErrorMessage = (value: unknown): string => (
    value instanceof Error
        ? value.message
        : typeof value === 'string'
            ? value
            : 'Unknown error'
);

const getBasicAuthToken = (): string => {
    const keyId = ensureEnv('RAZORPAY_KEY_ID');
    const keySecret = ensureEnv('RAZORPAY_KEY_SECRET');
    return btoa(`${keyId}:${keySecret}`);
};

const getTransferId = (payload: unknown): string => {
    if (!payload || typeof payload !== 'object') return '';
    const record = payload as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id.startsWith('trf_')) return record.id;
    const transfers = record.transfers;
    if (transfers && typeof transfers === 'object') {
        const transferItems = (transfers as Record<string, unknown>).items;
        if (Array.isArray(transferItems)) {
            const transfer = transferItems.find((item) => (
                item
                && typeof item === 'object'
                && typeof (item as Record<string, unknown>).id === 'string'
            ));
            if (transfer) return String((transfer as Record<string, unknown>).id);
        }
    }
    const items = record.items;
    if (Array.isArray(items)) {
        const transfer = items.find((item) => (
            item
            && typeof item === 'object'
            && typeof (item as Record<string, unknown>).id === 'string'
        ));
        if (transfer) return String((transfer as Record<string, unknown>).id);
    }
    return '';
};

const getTransferErrorMessage = (payload: unknown, fallback: string): string => {
    if (!payload || typeof payload !== 'object') return fallback;
    const record = payload as Record<string, unknown>;
    const error = record.error;
    if (error && typeof error === 'object') {
        const err = error as Record<string, unknown>;
        return normalizeLooseString(err.description) || normalizeLooseString(err.reason) || normalizeLooseString(err.code) || fallback;
    }
    return normalizeLooseString(record.message) || fallback;
};

const findMatchingTransfer = (payload: unknown, args: {
    bookingId: string;
    accountId: string;
    amountPaise: number;
}): string => {
    if (!payload || typeof payload !== 'object') return '';
    const items = (payload as Record<string, unknown>).items;
    if (!Array.isArray(items)) return '';

    for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const transfer = item as Record<string, unknown>;
        const notes = transfer.notes && typeof transfer.notes === 'object'
            ? transfer.notes as Record<string, unknown>
            : {};
        const transferId = normalizeLooseString(transfer.id);
        const recipient = normalizeLooseString(transfer.recipient);
        const amount = typeof transfer.amount === 'number' ? transfer.amount : Number(transfer.amount);
        const noteBookingId = normalizeLooseString(notes.booking_id);

        if (
            transferId
            && recipient === args.accountId
            && amount === args.amountPaise
            && noteBookingId === args.bookingId
        ) {
            return transferId;
        }
    }

    return '';
};

const authenticateAdminOrSecret = async (
    req: Request,
    admin: ReturnType<typeof createClient>,
): Promise<{ ok: boolean; mode: 'secret' | 'admin' | 'user' | 'none'; userId?: string; error?: string }> => {
    const configuredSecret = Deno.env.get('PAYOUT_PROCESSOR_SECRET')?.trim();
    const providedSecret = req.headers.get('x-payout-secret')?.trim();
    if (configuredSecret && providedSecret && providedSecret === configuredSecret) {
        return { ok: true, mode: 'secret' };
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return { ok: false, mode: 'none', error: 'Missing Authorization header or payout secret.' };

    const supabaseUrl = ensureEnv('SUPABASE_URL');
    const supabaseAnonKey = ensureEnv('SUPABASE_ANON_KEY');
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) return { ok: false, mode: 'none', error: 'Unauthorized.' };

    const profile = await admin
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();
    const role = normalizeLooseString((profile.data as Record<string, unknown> | null)?.role).toLowerCase();
    if (profile.error) return { ok: false, mode: 'none', error: 'Forbidden.' };
    if (role !== 'admin') return { ok: true, mode: 'user', userId: data.user.id };

    return { ok: true, mode: 'admin', userId: data.user.id };
};

const fetchReadyBookings = async (
    admin: ReturnType<typeof createClient>,
    args: { bookingId: string; limit: number },
): Promise<BookingRow[]> => {
    let query = admin
        .from('bookings')
        .select('id, provider_user_id, payment_id, payment_status, payout_status, payout_reference, provider_payout_amount, total_price, platform_fee_amount, listing_title')
        .eq('payment_status', 'paid')
        .eq('payout_status', 'ready_for_payout')
        .not('payment_id', 'is', null)
        .order('paid_at', { ascending: true, nullsFirst: false })
        .limit(args.limit);

    if (args.bookingId) {
        query = query.eq('id', args.bookingId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as BookingRow[];
};

const fetchOnboardingRows = async (
    admin: ReturnType<typeof createClient>,
    providerIds: string[],
): Promise<Map<string, OnboardingRow>> => {
    if (providerIds.length === 0) return new Map();

    const { data, error } = await admin
        .from('provider_payout_onboarding')
        .select('user_id, status, razorpay_account_id')
        .in('user_id', providerIds);
    if (error) throw error;

    const map = new Map<string, OnboardingRow>();
    for (const row of (data || []) as OnboardingRow[]) {
        map.set(row.user_id, row);
    }
    return map;
};

const updateBookingPayout = async (
    admin: ReturnType<typeof createClient>,
    bookingId: string,
    payload: Record<string, unknown>,
) => {
    const { error } = await admin
        .from('bookings')
        .update(payload)
        .eq('id', bookingId);
    if (error) throw error;
};

const processBooking = async (
    admin: ReturnType<typeof createClient>,
    booking: BookingRow,
    onboarding: OnboardingRow | undefined,
    dryRun: boolean,
    basicToken: string,
): Promise<PayoutResult> => {
    const bookingId = normalizeLooseString(booking.id);
    const paymentId = normalizeLooseString(booking.payment_id);
    const providerId = normalizeLooseString(booking.provider_user_id);
    const payoutAmount = toPositiveNumber(booking.provider_payout_amount);
    const accountId = normalizeLooseString(onboarding?.razorpay_account_id);
    const onboardingStatus = normalizeLooseString(onboarding?.status).toLowerCase();

    if (!bookingId || !paymentId || !providerId || !payoutAmount) {
        return {
            booking_id: bookingId || 'unknown',
            status: 'skipped',
            message: 'Booking is missing payment id, provider id, or payout amount.',
        };
    }

    if (!accountId) {
        await updateBookingPayout(admin, bookingId, {
            payout_error: 'Provider has no Razorpay linked account id.',
        });
        return {
            booking_id: bookingId,
            status: 'skipped',
            message: 'Provider has no Razorpay linked account id.',
        };
    }

    if (onboardingStatus && onboardingStatus !== 'completed') {
        await updateBookingPayout(admin, bookingId, {
            payout_error: `Provider payout onboarding is ${onboardingStatus}.`,
        });
        return {
            booking_id: bookingId,
            status: 'skipped',
            message: `Provider payout onboarding is ${onboardingStatus}.`,
        };
    }

    const amountPaise = Math.round(payoutAmount * 100);
    if (amountPaise <= 0) {
        await updateBookingPayout(admin, bookingId, {
            payout_error: 'Provider payout amount must be greater than zero.',
        });
        return {
            booking_id: bookingId,
            status: 'skipped',
            message: 'Provider payout amount must be greater than zero.',
        };
    }

    if (dryRun) {
        return {
            booking_id: bookingId,
            status: 'dry_run',
            message: `Would transfer INR ${payoutAmount.toFixed(2)} to ${accountId}.`,
        };
    }

    await updateBookingPayout(admin, bookingId, {
        payout_status: 'processing',
        payout_error: null,
    });

    const existingTransferResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/transfers`, {
        method: 'GET',
        headers: {
            Authorization: `Basic ${basicToken}`,
        },
    });

    if (existingTransferResponse.ok) {
        const existingPayload = await existingTransferResponse.json();
        const existingTransferId = findMatchingTransfer(existingPayload, {
            bookingId,
            accountId,
            amountPaise,
        });

        if (existingTransferId) {
            await updateBookingPayout(admin, bookingId, {
                payout_status: 'paid_out',
                payout_reference: existingTransferId,
                payout_processed_at: new Date().toISOString(),
                payout_error: null,
            });

            return {
                booking_id: bookingId,
                status: 'paid_out',
                transfer_id: existingTransferId,
                message: 'Existing matching Razorpay transfer reused.',
            };
        }
    }

    const transferPayload = {
        transfers: [
            {
                account: accountId,
                amount: amountPaise,
                currency: 'INR',
                notes: {
                    booking_id: bookingId,
                    provider_user_id: providerId,
                    listing_title: normalizeLooseString(booking.listing_title).slice(0, 120),
                },
            },
        ],
    };

    const transferResponse = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/transfers`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${basicToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(transferPayload),
    });

    let transferJson: unknown = {};
    try {
        transferJson = await transferResponse.json();
    } catch {
        transferJson = {};
    }

    if (!transferResponse.ok) {
        const message = getTransferErrorMessage(transferJson, 'Razorpay transfer failed.');
        await updateBookingPayout(admin, bookingId, {
            payout_status: 'failed',
            payout_error: message,
        });
        return {
            booking_id: bookingId,
            status: 'failed',
            message,
        };
    }

    const transferId = getTransferId(transferJson);
    await updateBookingPayout(admin, bookingId, {
        payout_status: 'paid_out',
        payout_reference: transferId || null,
        payout_processed_at: new Date().toISOString(),
        payout_error: null,
    });

    return {
        booking_id: bookingId,
        status: 'paid_out',
        transfer_id: transferId || undefined,
    };
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        const auth = await authenticateAdminOrSecret(req, admin);
        if (!auth.ok) {
            return jsonResponse(auth.error === 'Forbidden.' ? 403 : 401, { error: auth.error });
        }

        const body = (await req.json().catch(() => ({}))) as ProcessPayoutBody;
        const bookingId = normalizeLooseString(body.booking_id);
        const limit = bookingId ? 1 : normalizeLimit(body.limit);
        const dryRun = body.dry_run === true;

        const bookings = await fetchReadyBookings(admin, { bookingId, limit });
        if (auth.mode === 'user') {
            if (!bookingId) {
                return jsonResponse(403, { error: 'Only admins can process multiple payouts.' });
            }
            const booking = bookings[0];
            if (!booking || normalizeLooseString(booking.provider_user_id) !== auth.userId) {
                return jsonResponse(403, { error: 'You can only process your own ready payout.' });
            }
        }

        const providerIds = Array.from(new Set(
            bookings
                .map((booking) => normalizeLooseString(booking.provider_user_id))
                .filter(Boolean)
        ));
        const onboardingRows = await fetchOnboardingRows(admin, providerIds);
        const basicToken = dryRun ? '' : getBasicAuthToken();

        const results: PayoutResult[] = [];
        for (const booking of bookings) {
            try {
                const providerId = normalizeLooseString(booking.provider_user_id);
                results.push(await processBooking(
                    admin,
                    booking,
                    onboardingRows.get(providerId),
                    dryRun,
                    basicToken,
                ));
            } catch (error) {
                const bookingIdForError = normalizeLooseString(booking.id) || 'unknown';
                const message = asErrorMessage(error);
                try {
                    await updateBookingPayout(admin, bookingIdForError, {
                        payout_status: 'failed',
                        payout_error: message,
                    });
                } catch (updateError) {
                    console.error('Failed to record payout error', {
                        booking_id: bookingIdForError,
                        error: asErrorMessage(updateError),
                    });
                }
                results.push({
                    booking_id: bookingIdForError,
                    status: 'failed',
                    message,
                });
            }
        }

        return jsonResponse(200, {
            mode: auth.mode,
            dry_run: dryRun,
            processed: results.length,
            results,
        });
    } catch (error) {
        return jsonResponse(500, { error: asErrorMessage(error) });
    }
});
