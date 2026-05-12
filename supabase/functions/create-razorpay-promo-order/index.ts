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

interface PromoOrderBody {
    kind?: PromotionKind;
    plan_key?: PromotionPlanKey;
    post_id?: string;
    label?: string;
    title?: string;
}

const PROMOTION_PLANS: Record<PromotionPlanKey, { amount: number; label: string }> = {
    week: { amount: 299, label: '1 Week' },
    month: { amount: 1199, label: '1 Month' },
    half_year: { amount: 6999, label: '6 Months' },
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
        const body = (await req.json()) as PromoOrderBody;
        const kind = body.kind;
        const planKey = body.plan_key;

        if (kind !== 'boost' && kind !== 'ad') {
            return jsonResponse(400, { error: 'Invalid promotion kind.' });
        }
        if (!planKey || !(planKey in PROMOTION_PLANS)) {
            return jsonResponse(400, { error: 'Invalid promotion plan.' });
        }

        const plan = PROMOTION_PLANS[planKey];
        let itemLabel = kind === 'boost'
            ? normalizeLooseString(body.label) || 'Listing boost'
            : normalizeLooseString(body.title) || 'Advertisement';

        if (kind === 'boost') {
            const postId = normalizeLooseId(body.post_id);
            if (!postId) {
                return jsonResponse(400, { error: 'post_id is required for boost orders.' });
            }

            const supabaseUrl = ensureEnv('SUPABASE_URL');
            const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
            const admin = createClient(supabaseUrl, serviceRoleKey, {
                auth: { persistSession: false },
            });

            const { data: postRow, error: postError } = await admin
                .from('posts')
                .select('id, title, name, status, user_id, provider_user_id, is_boosted, boost_end')
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

            itemLabel = normalizeLooseString(postRow.title) || normalizeLooseString(postRow.name) || itemLabel;
        }

        const razorpayKeyId = ensureEnv('RAZORPAY_KEY_ID');
        const razorpayKeySecret = ensureEnv('RAZORPAY_KEY_SECRET');
        const basicToken = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        const receiptId = `tbp_promo_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

        const orderPayload = {
            amount: Math.round(plan.amount * 100),
            currency: 'INR',
            receipt: receiptId,
            notes: {
                user_id: user.id,
                promotion_kind: kind,
                plan_key: planKey,
                plan_label: plan.label,
                item_label: itemLabel.slice(0, 40),
                post_id: kind === 'boost' ? normalizeLooseId(body.post_id) : '',
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

        return jsonResponse(200, {
            order_id: orderId,
            amount: responseJson.amount,
            currency: responseJson.currency,
            key_id: razorpayKeyId,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        if (message === 'Unauthorized') {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        return jsonResponse(500, { error: message });
    }
});
