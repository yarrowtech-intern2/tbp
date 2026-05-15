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

interface CreateOrderBody {
    listing_id?: string;
    listing_type?: string;
    listing_title?: string;
    provider_user_id?: string | null;
    number_of_people?: number;
    unit_price?: number;
    total_price?: number;
    platform_fee_rate?: number;
    platform_fee_amount?: number;
    provider_payout_amount?: number;
    booking_date?: string | null;
    currency?: string;
}

type ListingType = 'tour' | 'activity' | 'guide';
const PLATFORM_FEE_RATE = 0.15;

const encoder = new TextEncoder();
const LEGACY_LISTING_ID_COLUMNS = ['listing_id', 'post_id', 'activity_id'] as const;

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

const normalizeInteger = (value: unknown, fallback = 1): number => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
    return fallback;
};

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
    return message.includes('cannot insert a non-default value into column');
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

const authenticateUser = async (authHeader: string) => {
    const supabaseUrl = ensureEnv('SUPABASE_URL');
    const supabaseAnonKey = ensureEnv('SUPABASE_ANON_KEY');

    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    try {
        const { data, error } = await client.auth.getUser();
        if (error || !data.user) {
            throw new Error('Unauthorized');
        }
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
        const body = (await req.json()) as CreateOrderBody;

        const listingId = normalizeLooseString(body.listing_id);
        const listingTypeInput = normalizeLooseString(body.listing_type);
        const listingTitleInput = normalizeLooseString(body.listing_title);
        const requestedTotalPrice = toPositiveNumber(body.total_price);
        const requestedUnitPrice = toPositiveNumber(body.unit_price);
        const numberOfPeople = normalizeInteger(body.number_of_people, 1);
        const requestedPlatformFeeRate = toOptionalPositiveNumber(body.platform_fee_rate);
        const currency = typeof body.currency === 'string' ? body.currency.trim().toUpperCase() : 'INR';

        if (!listingId || !listingTypeInput || !listingTitleInput) {
            return jsonResponse(400, { error: 'listing_id, listing_type, and listing_title are required.' });
        }
        if (listingTypeInput !== 'tour' && listingTypeInput !== 'activity' && listingTypeInput !== 'guide') {
            return jsonResponse(400, { error: 'Invalid listing_type.' });
        }
        if (!requestedTotalPrice || !requestedUnitPrice) {
            return jsonResponse(400, { error: 'unit_price and total_price must be positive numbers.' });
        }
        if (currency !== 'INR') {
            return jsonResponse(400, { error: 'Only INR currency is supported.' });
        }

        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        let listingType = listingTypeInput as ListingType;
        let listingTitle = listingTitleInput;
        let listingImage = '';
        let providerUserId = normalizeLooseString(body.provider_user_id);
        let providerUnitPrice = requestedUnitPrice;

        const listingLookup = await admin
            .from('posts')
            .select('id, title, name, type, price, image_url, cover_image_url, thumbnail_url, provider_user_id, user_id')
            .eq('id', listingId)
            .maybeSingle();

        if (!listingLookup.error && listingLookup.data) {
            const listingRow = listingLookup.data as Record<string, unknown>;
            const dbType = normalizeLooseString(listingRow.type).toLowerCase();
            if (dbType === 'tour' || dbType === 'activity') {
                listingType = dbType;
            } else if (dbType === 'guide' || dbType === 'event') {
                listingType = 'guide';
            }
            listingTitle = normalizeLooseString(listingRow.title)
                || normalizeLooseString(listingRow.name)
                || listingTitle;
            listingImage = normalizeLooseString(listingRow.image_url)
                || normalizeLooseString(listingRow.cover_image_url)
                || normalizeLooseString(listingRow.thumbnail_url);
            providerUserId = normalizeLooseString(listingRow.provider_user_id)
                || normalizeLooseString(listingRow.user_id)
                || providerUserId;
            const dbPrice = toPositiveNumber(listingRow.price);
            if (dbPrice) providerUnitPrice = dbPrice;
        }

        const pricing = calculatePricing(
            providerUnitPrice,
            numberOfPeople,
            requestedPlatformFeeRate ?? PLATFORM_FEE_RATE
        );

        if (Math.abs(pricing.totalPrice - requestedTotalPrice) > 0.5) {
            return jsonResponse(400, {
                error: `Price mismatch. Expected total is ${pricing.totalPrice.toFixed(2)} for ${numberOfPeople} traveler(s).`,
            });
        }

        const amountInPaise = Math.round(pricing.totalPrice * 100);
        if (amountInPaise <= 0) {
            return jsonResponse(400, { error: 'total_price must be greater than zero.' });
        }

        const razorpayKeyId = ensureEnv('RAZORPAY_KEY_ID');
        const razorpayKeySecret = ensureEnv('RAZORPAY_KEY_SECRET');
        const basicToken = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

        const receiptId = `tbp_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
        const orderPayload = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: receiptId,
            notes: {
                user_id: user.id,
                listing_id: listingId,
                listing_type: listingType,
                listing_title: listingTitle.slice(0, 40),
                number_of_people: String(numberOfPeople),
                provider_user_id: providerUserId,
                unit_price: String(pricing.providerUnitPrice),
                total_price: String(pricing.totalPrice),
                tourist_unit_price: String(pricing.touristUnitPrice),
                platform_fee_rate: String(pricing.platformFeeRate),
                platform_fee_amount: String(pricing.platformFeeAmount),
                provider_payout_amount: String(pricing.providerSubtotal),
                booking_date: body.booking_date || '',
            },
        };

        const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${basicToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderPayload),
        });

        const responseText = await razorpayResponse.text();
        let responseJson: Record<string, unknown> = {};
        try {
            responseJson = responseText ? JSON.parse(responseText) as Record<string, unknown> : {};
        } catch {
            responseJson = {};
        }

        if (!razorpayResponse.ok) {
            const apiMessage = typeof responseJson?.error === 'object'
                ? String((responseJson.error as Record<string, unknown>).description || 'Razorpay order creation failed.')
                : 'Razorpay order creation failed.';
            return jsonResponse(502, { error: apiMessage });
        }

        const orderId = typeof responseJson.id === 'string' ? responseJson.id.trim() : '';
        if (!orderId) {
            return jsonResponse(502, { error: 'Razorpay did not return an order id.' });
        }

        let uuidListingIdFallback: string | null = null;
        const travelerProfile = await admin
            .from('profiles')
            .select('full_name, email, phone')
            .eq('id', user.id)
            .maybeSingle();
        const travelerData = (travelerProfile.data as Record<string, unknown> | null) || null;
        const travelerName = normalizeLooseString(travelerData?.full_name)
            || normalizeLooseString(travelerData?.email)
            || null;
        const travelerEmail = normalizeLooseString(travelerData?.email) || null;
        const travelerPhone = normalizeLooseString(travelerData?.phone) || null;

        const pendingPayload: Record<string, unknown> = {
            user_id: user.id,
            provider_user_id: providerUserId || null,
            listing_id: listingId,
            post_id: listingId,
            source_listing_id: listingId,
            listing_type: listingType,
            listing_title: listingTitle,
            listing_image: listingImage || null,
            number_of_people: numberOfPeople,
            unit_price: pricing.providerUnitPrice,
            total_price: pricing.totalPrice,
            platform_fee_rate: pricing.platformFeeRate,
            platform_fee_amount: pricing.platformFeeAmount,
            provider_payout_amount: pricing.providerSubtotal,
            payout_status: 'pending_provider_acceptance',
            user_name: travelerName,
            user_email: travelerEmail,
            user_phone: travelerPhone,
            status: 'pending',
            payment_status: 'pending',
            payment_order_id: orderId,
            payment_currency: 'INR',
            booking_date: body.booking_date || null,
        };

        let pendingInserted = false;
        while (Object.keys(pendingPayload).length > 0) {
            const existingByOrder = await admin
                .from('bookings')
                .select('id')
                .eq('payment_order_id', orderId)
                .maybeSingle();

            if (!existingByOrder.error && existingByOrder.data?.id) {
                pendingInserted = true;
                break;
            }

            const result = await admin
                .from('bookings')
                .insert([pendingPayload])
                .select('id')
                .maybeSingle();

            if (!result.error) {
                pendingInserted = true;
                break;
            }

            if (
                isInvalidUuidInputError(result.error)
            ) {
                uuidListingIdFallback = uuidListingIdFallback || await deterministicListingUuid(listingType, listingId);
                if (applyUuidFallbackToNextListingIdColumn(pendingPayload, listingId, uuidListingIdFallback)) {
                    continue;
                }
            }

            if (
                isInvalidUuidInputError(result.error)
                && pendingPayload.source_listing_id === listingId
            ) {
                delete pendingPayload.source_listing_id;
                continue;
            }

            if (isNotNullViolationError(result.error)) {
                const notNullColumn = extractNotNullColumnName(result.error.message);
                if (
                    notNullColumn
                    && (LEGACY_LISTING_ID_COLUMNS as readonly string[]).includes(notNullColumn)
                    && !(notNullColumn in pendingPayload)
                ) {
                    pendingPayload[notNullColumn] = listingId;
                    continue;
                }
            }

            if (!isMissingColumnError(result.error) && !isDefaultOnlyColumnError(result.error)) {
                break;
            }

            const removableColumn = isMissingColumnError(result.error)
                ? extractMissingColumnName(result.error.message)
                : extractDefaultOnlyColumnName(result.error.message);
            if (!removableColumn || !(removableColumn in pendingPayload)) break;
            delete pendingPayload[removableColumn];
        }

        if (!pendingInserted) {
            // Keep a lightweight pending marker so other devices don't allow duplicate bookings.
            const legacyExisting = await admin
                .from('bookings_acts')
                .select('id')
                .eq('user_id', user.id)
                .eq('activity_id', listingId)
                .eq('status', 'pending')
                .maybeSingle();

            if (legacyExisting.error && isInvalidUuidInputError(legacyExisting.error)) {
                console.warn('create-razorpay-order skipped legacy pending marker for non-UUID activity_id', {
                    listing_id: listingId,
                    error: legacyExisting.error.message,
                });
            } else if (legacyExisting.error || !legacyExisting.data?.id) {
                await admin
                    .from('bookings_acts')
                    .insert([{
                        user_id: user.id,
                        activity_id: listingId,
                        number_of_people: numberOfPeople,
                        price: pricing.providerUnitPrice,
                        status: 'pending',
                    }]);
            }
        }

        return jsonResponse(200, {
            order_id: orderId,
            amount: responseJson.amount,
            currency: responseJson.currency,
            key_id: razorpayKeyId,
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        const message = error instanceof Error ? error.message : 'Internal server error';
        return jsonResponse(500, { error: message });
    }
});
