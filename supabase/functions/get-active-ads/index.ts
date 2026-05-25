import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const ACTIVE_ADS_CACHE_KEY = 'edge:get-active-ads:v1';
const ACTIVE_ADS_CACHE_TTL_SECONDS = 60;

type RedisCommandResponse<T> = {
    result?: T;
    error?: string;
};

const corsHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

const ensureEnv = (name: string): string => {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
};

const getRedisConfig = () => {
    const url = Deno.env.get('UPSTASH_REDIS_REST_URL')?.trim();
    const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')?.trim();
    if (!url || !token) return null;
    return {
        url: url.replace(/\/+$/, ''),
        token,
    };
};

const runRedisCommand = async <T,>(command: unknown[]): Promise<T | null> => {
    const config = getRedisConfig();
    if (!config) return null;

    try {
        const response = await fetch(config.url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(command),
        });

        if (!response.ok) {
            console.warn('Redis cache command failed', response.status, await response.text());
            return null;
        }

        const payload = await response.json() as RedisCommandResponse<T>;
        if (payload.error) {
            console.warn('Redis cache command returned error', payload.error);
            return null;
        }

        return payload.result ?? null;
    } catch (error) {
        console.warn('Redis cache unavailable', error instanceof Error ? error.message : error);
        return null;
    }
};

const getJsonCache = async <T,>(key: string): Promise<T | null> => {
    const cached = await runRedisCommand<string>(['GET', key]);
    if (!cached) return null;

    try {
        return JSON.parse(cached) as T;
    } catch {
        return null;
    }
};

const setJsonCache = async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
    if (ttlSeconds <= 0) return;
    await runRedisCommand(['SETEX', key, ttlSeconds, JSON.stringify(value)]);
};

const normalizeLooseString = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return '';
    return trimmed;
};

const isActiveWindow = (startsAt: unknown, endsAt: unknown): boolean => {
    const start = typeof startsAt === 'string' ? new Date(startsAt).getTime() : Number.NaN;
    const end = typeof endsAt === 'string' ? new Date(endsAt).getTime() : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    const now = Date.now();
    return start <= now && end >= now;
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'GET' && req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const cached = await getJsonCache<{ ads: unknown[] }>(ACTIVE_ADS_CACHE_KEY);
        if (cached) {
            return jsonResponse(200, cached);
        }

        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        const { data: paymentRows, error: paymentError } = await admin
            .from('ad_payments')
            .select('*')
            .order('amount', { ascending: false })
            .order('created_at', { ascending: false });

        if (paymentError) {
            return jsonResponse(500, { error: paymentError.message || 'Could not load ad payments.' });
        }

        const activePayments = (Array.isArray(paymentRows) ? paymentRows : [])
            .filter((row) => {
                const normalizedStatus = normalizeLooseString((row as Record<string, unknown>).status).toLowerCase();
                const statusAllowed = !normalizedStatus || normalizedStatus === 'paid' || normalizedStatus === 'active';
                return statusAllowed && isActiveWindow(
                    (row as Record<string, unknown>).starts_at,
                    (row as Record<string, unknown>).ends_at,
                );
            });

        if (activePayments.length === 0) {
            const payload = { ads: [] };
            await setJsonCache(ACTIVE_ADS_CACHE_KEY, payload, ACTIVE_ADS_CACHE_TTL_SECONDS);
            return jsonResponse(200, payload);
        }

        const adIdSet = new Set(
            activePayments
                .map((row) => {
                    const raw = (row as Record<string, unknown>).ad_id;
                    return typeof raw === 'string'
                        ? raw.trim()
                        : typeof raw === 'number' && Number.isFinite(raw)
                            ? String(raw)
                            : '';
                })
                .filter(Boolean),
        );

        const { data: adRows, error: adError } = await admin
            .from('ads')
            .select('*')
            .order('created_at', { ascending: false });

        if (adError) {
            return jsonResponse(500, { error: adError.message || 'Could not load ads.' });
        }

        const adsById = new Map<string, Record<string, unknown>>();
        (Array.isArray(adRows) ? adRows : []).forEach((row) => {
            const raw = (row as Record<string, unknown>).id;
            const id = typeof raw === 'string'
                ? raw.trim()
                : typeof raw === 'number' && Number.isFinite(raw)
                    ? String(raw)
                    : '';
            if (id) adsById.set(id, row as Record<string, unknown>);
        });

        const ads = activePayments
            .map((payment) => {
                const paymentRow = payment as Record<string, unknown>;
                const rawAdId = paymentRow.ad_id;
                const adId = typeof rawAdId === 'string'
                    ? rawAdId.trim()
                    : typeof rawAdId === 'number' && Number.isFinite(rawAdId)
                        ? String(rawAdId)
                        : '';
                if (!adId || !adIdSet.has(adId)) return null;
                const ad = adsById.get(adId);
                if (!ad) return null;

                return {
                    id: adId,
                    user_id: typeof ad.user_id === 'string' ? ad.user_id : '',
                    image_url: typeof ad.image_url === 'string' ? ad.image_url : null,
                    link: typeof ad.link === 'string' ? ad.link : null,
                    created_at: typeof ad.created_at === 'string' ? ad.created_at : null,
                    title: typeof ad.title === 'string' ? ad.title : null,
                    cta_text: typeof ad.cta_text === 'string' ? ad.cta_text : null,
                    payment_amount: typeof paymentRow.amount === 'number' ? paymentRow.amount : Number(paymentRow.amount || 0) || 0,
                    payment_status: typeof paymentRow.status === 'string' ? paymentRow.status : null,
                    plan_key: typeof paymentRow.plan_key === 'string' ? paymentRow.plan_key : null,
                    starts_at: typeof paymentRow.starts_at === 'string' ? paymentRow.starts_at : null,
                    ends_at: typeof paymentRow.ends_at === 'string' ? paymentRow.ends_at : null,
                };
            })
            .filter(Boolean);

        const payload = { ads };
        await setJsonCache(ACTIVE_ADS_CACHE_KEY, payload, ACTIVE_ADS_CACHE_TTL_SECONDS);
        return jsonResponse(200, payload);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        return jsonResponse(500, { error: message });
    }
});
