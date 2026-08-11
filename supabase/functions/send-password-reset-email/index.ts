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

const normalize = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

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

const getAppUrl = (): string => (
    (Deno.env.get('PUBLIC_APP_URL') || Deno.env.get('VITE_PUBLIC_APP_URL') || '').trim().replace(/\/+$/, '')
);

const sendEmail = async (input: { to: string; actionLink: string }) => {
    const apiKey = ensureEnv('RESEND_API_KEY');
    const from = ensureEnv('EMAIL_FROM');
    const replyTo = Deno.env.get('EMAIL_REPLY_TO')?.trim();
    const payload: Record<string, unknown> = {
        from,
        to: input.to,
        subject: 'Reset your The Better Pass password',
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.5;color:#172033">
                <h2 style="margin:0 0 12px">Reset your password</h2>
                <p>Use the secure link below to set a new password for your The Better Pass account.</p>
                <p><a href="${escapeHtml(input.actionLink)}">Set a new password</a></p>
                <p>If you did not request this, you can ignore this email.</p>
            </div>
        `,
        text: [
            'Reset your The Better Pass password',
            `Set a new password: ${input.actionLink}`,
            'If you did not request this, you can ignore this email.',
        ].join('\n'),
    };

    if (replyTo) payload.reply_to = replyTo;

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
        throw new Error(details || `Email provider returned ${response.status}.`);
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
        const body = await req.json().catch(() => ({})) as { email?: unknown };
        const email = normalize(body.email).toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return jsonResponse(400, { error: 'Valid email is required.' });
        }

        const appUrl = getAppUrl();
        if (!appUrl) throw new Error('Missing PUBLIC_APP_URL.');

        const admin = createClient(ensureEnv('SUPABASE_URL'), ensureEnv('SUPABASE_SERVICE_ROLE_KEY'), {
            auth: { persistSession: false },
        });

        const { data, error } = await admin.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo: `${appUrl}/auth?mode=recovery`,
            },
        });

        if (error || !data.properties?.action_link) {
            const message = error?.message || 'Could not create recovery link.';
            if (message.toLowerCase().includes('not found')) {
                return jsonResponse(200, { sent: true });
            }
            throw new Error(message);
        }

        await sendEmail({ to: email, actionLink: data.properties.action_link });
        return jsonResponse(200, { sent: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Internal server error';
        console.error('send-password-reset-email failed', message);
        return jsonResponse(500, { error: message });
    }
});
