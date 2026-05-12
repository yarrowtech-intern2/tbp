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

type PromotionPlanKey = 'week' | 'month' | 'half_year';
type PromotionKind = 'boost' | 'ad';

interface PaymentPayload {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
}

interface ConfirmPromoBody {
    kind?: PromotionKind;
    plan_key?: PromotionPlanKey;
    payment?: PaymentPayload;
    boost?: {
        post_id?: string;
    };
    ad?: {
        title?: string;
        image_url?: string;
        link?: string;
        cta_text?: string;
    };
}

const encoder = new TextEncoder();

const PROMOTION_PLANS: Record<PromotionPlanKey, { amount: number; durationDays: number }> = {
    week: { amount: 299, durationDays: 7 },
    month: { amount: 1199, durationDays: 30 },
    half_year: { amount: 6999, durationDays: 180 },
};

const toHex = (buffer: ArrayBuffer): string => (
    Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
);

const hmacSha256Hex = async (secret: string, payload: string): Promise<string> => {
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return toHex(signature);
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

const normalizeLooseId = (value: unknown): string => {
    if (typeof value === 'string') return normalizeLooseString(value);
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return '';
};

const authenticateUser = async (authHeader: string) => {
    const supabaseUrl = ensureEnv('SUPABASE_URL');
    const supabaseAnonKey = ensureEnv('SUPABASE_ANON_KEY');
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) {
        throw new Error('Unauthorized');
    }
    return data.user;
};

const getPromotionWindow = (planKey: PromotionPlanKey) => {
    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    if (planKey === 'week') {
        endsAt.setUTCDate(endsAt.getUTCDate() + 7);
    } else if (planKey === 'month') {
        endsAt.setUTCMonth(endsAt.getUTCMonth() + 1);
    } else {
        endsAt.setUTCMonth(endsAt.getUTCMonth() + 6);
    }

    const durationDays = Math.max(
        1,
        Math.round((endsAt.getTime() - startsAt.getTime()) / 86400000),
    );
    return {
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        durationDays,
    };
};

const isBoostActive = (row: Record<string, unknown> | null): boolean => {
    if (!row || row.is_boosted !== true) return false;
    const boostEnd = typeof row.boost_end === 'string' ? row.boost_end : '';
    if (!boostEnd) return false;
    const boostEndTime = new Date(boostEnd).getTime();
    return Number.isFinite(boostEndTime) && boostEndTime > Date.now();
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
        const body = (await req.json()) as ConfirmPromoBody;
        const kind = body.kind;
        const planKey = body.plan_key;
        const orderId = normalizeLooseString(body.payment?.razorpay_order_id);
        const paymentId = normalizeLooseString(body.payment?.razorpay_payment_id);
        const signature = normalizeLooseString(body.payment?.razorpay_signature);

        if (kind !== 'boost' && kind !== 'ad') {
            return jsonResponse(400, { error: 'Invalid promotion kind.' });
        }
        if (!planKey || !(planKey in PROMOTION_PLANS)) {
            return jsonResponse(400, { error: 'Invalid promotion plan.' });
        }
        if (!orderId || !paymentId || !signature) {
            return jsonResponse(400, { error: 'Payment data is incomplete.' });
        }

        const razorpaySecret = ensureEnv('RAZORPAY_KEY_SECRET');
        const expectedSignature = await hmacSha256Hex(razorpaySecret, `${orderId}|${paymentId}`);
        if (expectedSignature !== signature) {
            return jsonResponse(400, { error: 'Payment signature verification failed.' });
        }

        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        const plan = PROMOTION_PLANS[planKey];
        const { startsAt, endsAt, durationDays } = getPromotionWindow(planKey);

        if (kind === 'boost') {
            const postId = normalizeLooseId(body.boost?.post_id);
            if (!postId) {
                return jsonResponse(400, { error: 'post_id is required for boost confirmation.' });
            }

            const existingPayment = await admin
                .from('post_boost_payments')
                .select('id, post_id, starts_at, ends_at')
                .eq('payment_id', paymentId)
                .maybeSingle();

            if (!existingPayment.error && existingPayment.data?.id) {
                return jsonResponse(200, {
                    kind: 'boost',
                    post_id: String(existingPayment.data.post_id || postId),
                    starts_at: existingPayment.data.starts_at || null,
                    ends_at: existingPayment.data.ends_at || null,
                });
            }

            const { data: postRow, error: postError } = await admin
                .from('posts')
                .select('id, status, user_id, provider_user_id, is_boosted, boost_end')
                .eq('id', postId)
                .or(`user_id.eq.${user.id},provider_user_id.eq.${user.id}`)
                .maybeSingle();

            if (postError || !postRow) {
                return jsonResponse(404, { error: 'Live listing not found for this account.' });
            }

            const status = typeof postRow.status === 'string' ? postRow.status.toLowerCase() : '';
            if (status !== 'live' && status !== 'published') {
                return jsonResponse(400, { error: 'Only live listings can be boosted.' });
            }
            if (isBoostActive(postRow as Record<string, unknown>)) {
                return jsonResponse(409, { error: 'This listing is already boosted.' });
            }

            const boostInsert = await admin
                .from('post_boost_payments')
                .insert([{
                    post_id: postId,
                    user_id: user.id,
                    plan_key: planKey,
                    duration_days: durationDays,
                    amount: plan.amount,
                    status: 'paid',
                    payment_order_id: orderId,
                    payment_id: paymentId,
                    payment_signature: signature,
                    starts_at: startsAt,
                    ends_at: endsAt,
                }])
                .select('id')
                .maybeSingle();

            if (boostInsert.error) {
                return jsonResponse(500, { error: boostInsert.error.message || 'Could not store boost payment.' });
            }

            const updatePost = await admin
                .from('posts')
                .update({
                    is_boosted: true,
                    boost_start: startsAt,
                    boost_end: endsAt,
                })
                .eq('id', postId);

            if (updatePost.error) {
                return jsonResponse(500, { error: updatePost.error.message || 'Could not activate boost on post.' });
            }

            return jsonResponse(200, {
                kind: 'boost',
                post_id: postId,
                starts_at: startsAt,
                ends_at: endsAt,
            });
        }

        const title = normalizeLooseString(body.ad?.title);
        const imageUrl = normalizeLooseString(body.ad?.image_url);
        const link = normalizeLooseString(body.ad?.link);
        const ctaText = normalizeLooseString(body.ad?.cta_text);

        if (!title || !imageUrl || !link || !ctaText) {
            return jsonResponse(400, { error: 'title, image_url, link, and cta_text are required for ads.' });
        }

        const existingAdPayment = await admin
            .from('ad_payments')
            .select('id, ad_id, starts_at, ends_at')
            .eq('payment_id', paymentId)
            .maybeSingle();

        if (!existingAdPayment.error && existingAdPayment.data?.id) {
            return jsonResponse(200, {
                kind: 'ad',
                ad_id: String(existingAdPayment.data.ad_id || ''),
                starts_at: existingAdPayment.data.starts_at || null,
                ends_at: existingAdPayment.data.ends_at || null,
            });
        }

        const adInsert = await admin
            .from('ads')
            .insert([{
                user_id: user.id,
                image_url: imageUrl,
                link,
                created_at: new Date().toISOString(),
                title,
                cta_text: ctaText,
            }])
            .select('id')
            .maybeSingle();

        if (adInsert.error || !adInsert.data?.id) {
            return jsonResponse(500, { error: adInsert.error?.message || 'Could not create ad.' });
        }

        const adId = String(adInsert.data.id);
        const adPaymentInsert = await admin
            .from('ad_payments')
            .insert([{
                ad_id: adId,
                user_id: user.id,
                plan_key: planKey,
                duration_days: durationDays,
                amount: plan.amount,
                status: 'paid',
                payment_order_id: orderId,
                payment_id: paymentId,
                payment_signature: signature,
                starts_at: startsAt,
                ends_at: endsAt,
            }])
            .select('id')
            .maybeSingle();

        if (adPaymentInsert.error) {
            return jsonResponse(500, { error: adPaymentInsert.error.message || 'Could not store ad payment.' });
        }

        return jsonResponse(200, {
            kind: 'ad',
            ad_id: adId,
            starts_at: startsAt,
            ends_at: endsAt,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        if (message === 'Unauthorized') {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        return jsonResponse(500, { error: message });
    }
});
