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

const authenticateUser = async (authHeader: string) => {
    const supabaseUrl = ensureEnv('SUPABASE_URL');
    const supabaseAnonKey = ensureEnv('SUPABASE_ANON_KEY');
    const client = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await client.auth.getUser();
    if (error || !data.user) throw new Error('Unauthorized');
    return data.user;
};

const collectAccountUserIds = async (
    admin: ReturnType<typeof createClient>,
    currentUser: Awaited<ReturnType<typeof authenticateUser>>
) => {
    const ids = new Set<string>([currentUser.id]);
    const email = currentUser.email?.trim().toLowerCase();
    if (!email) return Array.from(ids);

    // Prefer public.profiles.email because it's accessible via REST + service role.
    const relatedProfiles = await admin
        .from('profiles')
        .select('id, email')
        .ilike('email', email);

    if (!relatedProfiles.error) {
        for (const row of relatedProfiles.data || []) {
            const id = typeof row.id === 'string' ? row.id.trim() : '';
            if (id) ids.add(id);
        }
    } else {
        console.warn('get-account-bookings: failed loading related profile users', relatedProfiles.error.message);
    }

    // Best effort: also try auth.users if available in this project.
    const relatedAuthUsers = await admin
        .schema('auth')
        .from('users')
        .select('id')
        .eq('email', email);

    if (relatedAuthUsers.error) {
        console.warn('get-account-bookings: failed loading related auth users', relatedAuthUsers.error.message);
        return Array.from(ids);
    }

    for (const row of relatedAuthUsers.data || []) {
        const id = typeof row.id === 'string' ? row.id.trim() : '';
        if (id) ids.add(id);
    }

    return Array.from(ids);
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
        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        const accountUserIds = await collectAccountUserIds(admin, currentUser);
        console.log('get-account-bookings invoked', {
            user_id: currentUser.id,
            email: currentUser.email || null,
            account_user_ids_count: accountUserIds.length,
        });

        const [unified, legacy] = await Promise.all([
            admin
                .from('bookings')
                .select('*')
                .in('user_id', accountUserIds)
                .order('created_at', { ascending: false }),
            admin
                .from('bookings_acts')
                .select(`
                    id,
                    user_id,
                    activity_id,
                    number_of_people,
                    price,
                    total_price,
                    status,
                    created_at,
                    activities:activity_id (
                        title,
                        image_url
                    )
                `)
                .in('user_id', accountUserIds)
                .order('created_at', { ascending: false }),
        ]);

        if (unified.error) {
            console.error('get-account-bookings unified query failed', unified.error.message);
            return jsonResponse(500, { error: unified.error.message || 'Failed loading unified bookings.' });
        }

        if (legacy.error) {
            console.warn('get-account-bookings legacy query failed', legacy.error.message);
        }

        return jsonResponse(200, {
            user_ids: accountUserIds,
            unified: unified.data || [],
            legacy: legacy.error ? [] : (legacy.data || []),
        });
    } catch (error) {
        if (error instanceof Error && error.message === 'Unauthorized') {
            return jsonResponse(401, { error: 'Unauthorized' });
        }
        const message = error instanceof Error ? error.message : 'Internal server error';
        return jsonResponse(500, { error: message });
    }
});
