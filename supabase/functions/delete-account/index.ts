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

const ensureEnv = (name: string): string => {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
};

const normalize = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

const createAdminClient = () => createClient(
    ensureEnv('SUPABASE_URL'),
    ensureEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false } },
);

const authenticateUser = async (authHeader: string) => {
    const client = createClient(ensureEnv('SUPABASE_URL'), ensureEnv('SUPABASE_ANON_KEY'), {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('Unauthorized');
    return data.user;
};

const ignoreCleanupError = (label: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error || '');
    if (message) console.warn(`delete-account cleanup skipped: ${label}: ${message}`);
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

        const currentUser = await authenticateUser(authHeader);
        const email = normalize(currentUser.email).toLowerCase();
        const body = await req.json().catch(() => ({})) as { confirmation?: unknown };
        const confirmation = normalize(body.confirmation).toLowerCase();

        if (!email || confirmation !== email) {
            return jsonResponse(400, { error: 'Email confirmation did not match this account.' });
        }

        const admin = createAdminClient();
        const userId = currentUser.id;

        const deleteWhere = async (table: string, column: string) => {
            const { error } = await admin.from(table).delete().eq(column, userId);
            if (error) ignoreCleanupError(`${table}.${column}`, error);
        };

        const nullWhere = async (table: string, column: string) => {
            const { error } = await admin.from(table).update({ [column]: null }).eq(column, userId);
            if (error) ignoreCleanupError(`${table}.${column}`, error);
        };

        await Promise.all([
            deleteWhere('conversation_messages', 'sender_user_id'),
            deleteWhere('profile_follows', 'follower_user_id'),
            deleteWhere('profile_follows', 'followed_user_id'),
            deleteWhere('favorites', 'user_id'),
            deleteWhere('notifications', 'user_id'),
            nullWhere('notifications', 'actor_user_id'),
            deleteWhere('verification', 'user_id'),
            nullWhere('verification', 'reviewed_by'),
            deleteWhere('bookings', 'user_id'),
            nullWhere('bookings', 'provider_user_id'),
            deleteWhere('bookings_acts', 'user_id'),
            deleteWhere('conversations', 'traveler_id'),
            deleteWhere('conversations', 'provider_id'),
            deleteWhere('tourist_routes', 'user_id'),
            deleteWhere('ads', 'user_id'),
            deleteWhere('ad_payments', 'user_id'),
            deleteWhere('moderation_audit_logs', 'target_user_id'),
            nullWhere('moderation_audit_logs', 'actor_user_id'),
            deleteWhere('posts', 'provider_user_id'),
            deleteWhere('profiles', 'id'),
        ]);

        const { error: deleteUserError } = await admin.auth.admin.deleteUser(userId);
        if (deleteUserError) {
            console.error('delete-account auth user deletion failed', deleteUserError.message);
            return jsonResponse(500, { error: deleteUserError.message });
        }

        console.info('delete-account completed', { user_id: userId });
        return jsonResponse(200, { deleted: true });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('delete-account failed', message);
        return jsonResponse(500, { error: message });
    }
});
