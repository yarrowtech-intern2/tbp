import { supabase } from './supabase';

export type ContactSubmissionInput = {
    name: string;
    email: string;
    phone: string;
    location: string;
    message: string;
    sourcePage?: string | null;
};

export type ContactSubmissionRecord = {
    id: string;
    name: string;
    email: string;
    phone: string;
    location: string;
    message: string;
    source_page: string;
    created_at: string;
};

type ContactSubmissionRow = Partial<ContactSubmissionRecord> & {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    location?: unknown;
    message?: unknown;
    source_page?: unknown;
    created_at?: unknown;
};

const normalizeText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const isMissingContactSubmissionsTableError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === 'PGRST205'
        || message.includes('contact_submissions')
        || (message.includes('relation') && message.includes('does not exist'))
    );
};

const isPermissionError = (error: { message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('row-level security') || message.includes('permission denied') || message.includes('policy');
};

const toContactSubmissionErrorMessage = (
    error: { code?: string; message?: string } | null | undefined,
    action: 'insert' | 'select',
) => {
    if (isMissingContactSubmissionsTableError(error)) {
        return 'Contact submissions are not configured yet. Apply `docs/contact-submissions-migration.sql` in Supabase.';
    }
    if (isPermissionError(error)) {
        return action === 'insert'
            ? 'Contact form submission is blocked by Supabase policy. Apply `docs/contact-submissions-migration.sql` and retry.'
            : 'Contact submissions are blocked by Supabase policy. Apply `docs/contact-submissions-migration.sql` and retry.';
    }
    return error?.message || (action === 'insert' ? 'Failed to submit contact form.' : 'Failed to load contact submissions.');
};

const normalizeContactSubmission = (row: ContactSubmissionRow): ContactSubmissionRecord => ({
    id: normalizeText(row.id),
    name: normalizeText(row.name, 'Unknown'),
    email: normalizeText(row.email),
    phone: normalizeText(row.phone),
    location: normalizeText(row.location, 'Not provided'),
    message: normalizeText(row.message),
    source_page: normalizeText(row.source_page, 'landing_page'),
    created_at: normalizeText(row.created_at),
});

export const submitContactSubmission = async (input: ContactSubmissionInput): Promise<string> => {
    const payload = {
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        location: input.location.trim(),
        message: input.message.trim(),
        source_page: input.sourcePage?.trim() || 'landing_page',
    };

    const { error } = await supabase
        .from('contact_submissions')
        .insert(payload);

    if (error) throw new Error(toContactSubmissionErrorMessage(error, 'insert'));

    return '';
};

export const getContactSubmissions = async (): Promise<ContactSubmissionRecord[]> => {
    const { data, error } = await supabase
        .from('contact_submissions')
        .select('id, name, email, phone, location, message, source_page, created_at')
        .order('created_at', { ascending: false });

    if (error) throw new Error(toContactSubmissionErrorMessage(error, 'select'));

    const rows = Array.isArray(data) ? data as ContactSubmissionRow[] : [];
    return rows.map(normalizeContactSubmission).filter((row) => row.id.length > 0);
};
