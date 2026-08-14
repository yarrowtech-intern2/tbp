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

interface SignupEmailBody {
    user_id?: string;
    role?: string;
}

interface TransactionalEmail {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeLooseString = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lowered = trimmed.toLowerCase();
    if (lowered === 'undefined' || lowered === 'null') return '';
    return trimmed;
};

const ensureEnv = (name: string): string => {
    const value = Deno.env.get(name)?.trim();
    if (!value) throw new Error(`Missing environment variable: ${name}`);
    return value;
};

const escapeHtml = (value: unknown): string => (
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
);

const normalizeRecipients = (value: string | string[]): string[] => (
    (Array.isArray(value) ? value : [value])
        .map((email) => email.trim())
        .filter(Boolean)
);

const getAppUrl = (): string => (
    (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('VITE_PUBLIC_APP_URL') || '').trim().replace(/\/+$/, '')
);

const getRoleLabel = (role: string): string => {
    switch (role) {
        case 'tour_company':
            return 'Tour Company';
        case 'tour_instructor':
            return 'Tour Instructor';
        case 'tour_guide':
            return 'Tour Guide';
        case 'tourist':
            return 'Tourist';
        default:
            return 'Member';
    }
};

const sendTransactionalEmail = async (message: TransactionalEmail) => {
    const apiKey = Deno.env.get('RESEND_API_KEY')?.trim();
    const from = Deno.env.get('EMAIL_FROM')?.trim();
    const defaultReplyTo = Deno.env.get('EMAIL_REPLY_TO')?.trim();
    const to = normalizeRecipients(message.to);

    if (!to.length) return { ok: false, reason: 'No recipient email address.' };
    if (!apiKey || !from) return { ok: false, reason: 'Email provider is not configured.' };

    const payload: Record<string, unknown> = {
        from,
        to,
        subject: message.subject,
        html: message.html,
    };

    if (message.text?.trim()) payload.text = message.text.trim();
    if (defaultReplyTo) payload.reply_to = defaultReplyTo;

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
        return { ok: false, reason: details || `Email provider returned ${response.status}.` };
    }

    return { ok: true, reason: '' };
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: 'Method not allowed' });
    }

    try {
        const body = (await req.json()) as SignupEmailBody;
        const userId = normalizeLooseString(body.user_id);
        if (!userId || !UUID_REGEX.test(userId)) {
            return jsonResponse(400, { error: 'Valid user_id is required.' });
        }

        const supabaseUrl = ensureEnv('SUPABASE_URL');
        const serviceRoleKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
        const admin = createClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false },
        });

        const { data, error } = await admin.auth.admin.getUserById(userId);
        if (error || !data.user) {
            return jsonResponse(404, { error: 'Signup user was not found.' });
        }

        const user = data.user;
        const email = normalizeLooseString(user.email);
        if (!email) {
            console.warn('Signup email skipped: auth user has no email.', { user_id: userId });
            return jsonResponse(200, { skipped: true, reason: 'No user email.' });
        }

        const appMetadata = user.app_metadata || {};
        if (typeof appMetadata.signup_welcome_email_sent_at === 'string') {
            return jsonResponse(200, { skipped: true, reason: 'Signup email already sent.' });
        }

        const createdAt = new Date(user.created_at || '').getTime();
        const ageMs = Date.now() - createdAt;
        if (!Number.isFinite(createdAt) || ageMs > 24 * 60 * 60 * 1000) {
            return jsonResponse(200, { skipped: true, reason: 'Signup is outside welcome email window.' });
        }

        const metadata = user.user_metadata || {};
        const fullName = normalizeLooseString(metadata.full_name)
            || normalizeLooseString(metadata.name)
            || normalizeLooseString(email.split('@')[0])
            || 'there';
        const role = normalizeLooseString(metadata.role) || normalizeLooseString(body.role);
        const roleLabel = getRoleLabel(role);
        const appUrl = getAppUrl();
        const authUrl = appUrl ? `${appUrl}/login` : '';
        const dashboardUrl = appUrl
            ? role === 'tourist'
                ? `${appUrl}/explore`
                : `${appUrl}/dashboard/provider`
            : '';

        const result = await sendTransactionalEmail({
            to: email,
            subject: 'Welcome to The Better Pass',
            html: `
                <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
                    <h2 style="margin:0 0 12px">Welcome to The Better Pass</h2>
                    <p>Hi ${escapeHtml(fullName)}, your ${escapeHtml(roleLabel)} account has been created.</p>
                    <p>You can now sign in and continue setting up your travel profile.</p>
                    ${dashboardUrl ? `<p><a href="${escapeHtml(dashboardUrl)}">Continue in The Better Pass</a></p>` : ''}
                    ${authUrl ? `<p>If the button does not work, sign in here: ${escapeHtml(authUrl)}</p>` : ''}
                </div>
            `,
            text: [
                `Hi ${fullName}, your ${roleLabel} account has been created.`,
                dashboardUrl ? `Continue: ${dashboardUrl}` : '',
                authUrl ? `Sign in: ${authUrl}` : '',
            ].filter(Boolean).join('\n'),
        });

        if (!result.ok) {
            console.warn('Signup welcome email was not sent', {
                user_id: userId,
                reason: result.reason,
            });
            return jsonResponse(200, { sent: false, reason: result.reason });
        }

        await admin.auth.admin.updateUserById(userId, {
            app_metadata: {
                ...appMetadata,
                signup_welcome_email_sent_at: new Date().toISOString(),
            },
        });

        console.info('Signup welcome email sent', { user_id: userId });
        return jsonResponse(200, { sent: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('send-signup-email failed', message);
        return jsonResponse(500, { error: message });
    }
});
