import { supabase } from './supabase';

export type CrmAccountSubjectType = 'traveler' | 'provider';

export type CrmAccountNote = {
    id: string;
    subject_type: CrmAccountSubjectType;
    subject_id: string;
    author_id: string;
    author_name: string;
    body: string;
    created_at: string;
};

type CrmAccountNoteProfileEmbed = { full_name?: unknown };

type CrmAccountNoteRow = {
    id?: unknown;
    subject_type?: unknown;
    subject_id?: unknown;
    author_id?: unknown;
    body?: unknown;
    created_at?: unknown;
    profiles?: CrmAccountNoteProfileEmbed[] | CrmAccountNoteProfileEmbed | null;
};

const normalizeText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const firstOfEmbed = <T,>(value: T[] | T | null | undefined): T | undefined => (
    Array.isArray(value) ? value[0] : value ?? undefined
);

const isPermissionError = (error: { message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('row-level security') || message.includes('permission denied') || message.includes('policy');
};

const isMissingTableError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === 'PGRST205'
        || (message.includes('relation') && message.includes('crm_account_notes') && message.includes('does not exist'))
        || (message.includes('could not find the table') && message.includes('crm_account_notes'))
    );
};

const toCrmAccountNoteErrorMessage = (
    error: { code?: string; message?: string } | null | undefined,
    action: 'select' | 'insert',
) => {
    if (isMissingTableError(error)) {
        return (
            'CRM account notes are not set up yet. Apply '
            + 'supabase/migrations/202608190002_create_crm_account_notes_and_traveler_rpc.sql, then retry. '
            + `Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`
        ).trim();
    }
    if (isPermissionError(error)) {
        return `This action is blocked by Supabase policy. Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`.trim();
    }
    return (
        `Failed to ${action} account notes. `
        + `Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`
    ).trim();
};

const normalizeCrmAccountNote = (row: CrmAccountNoteRow): CrmAccountNote => {
    const profileRow = firstOfEmbed(row.profiles);
    const subjectType = row.subject_type === 'provider' ? 'provider' : 'traveler';
    return {
        id: normalizeText(row.id),
        subject_type: subjectType,
        subject_id: normalizeText(row.subject_id),
        author_id: normalizeText(row.author_id),
        author_name: normalizeText(profileRow?.full_name, 'Team member'),
        body: normalizeText(row.body),
        created_at: normalizeText(row.created_at),
    };
};

export const getCrmAccountNotes = async (
    subjectType: CrmAccountSubjectType,
    subjectId: string,
): Promise<CrmAccountNote[]> => {
    const { data, error } = await supabase
        .from('crm_account_notes')
        .select('id, subject_type, subject_id, author_id, body, created_at, profiles!author_id(full_name)')
        .eq('subject_type', subjectType)
        .eq('subject_id', subjectId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('crm_account_notes select failed', error);
        throw new Error(toCrmAccountNoteErrorMessage(error, 'select'));
    }

    const rows = Array.isArray(data) ? data as CrmAccountNoteRow[] : [];
    return rows.map(normalizeCrmAccountNote).filter((row) => row.id.length > 0);
};

export const addCrmAccountNote = async (
    subjectType: CrmAccountSubjectType,
    subjectId: string,
    body: string,
    authorId: string,
): Promise<void> => {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Note cannot be empty.');

    const { error } = await supabase
        .from('crm_account_notes')
        .insert({ subject_type: subjectType, subject_id: subjectId, author_id: authorId, body: trimmed });

    if (error) {
        console.error('crm_account_notes insert failed', error);
        throw new Error(toCrmAccountNoteErrorMessage(error, 'insert'));
    }
};
