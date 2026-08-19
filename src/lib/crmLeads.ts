import { supabase } from './supabase';

export type CrmLeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'closed';

// All stored/displayable values. 'converted' is intentionally excluded from
// CRM_LEAD_MANUAL_STATUSES below — it is computed automatically (see
// CrmLead.is_converted / public.get_crm_leads()), not chosen from the dropdown.
export const CRM_LEAD_STATUSES: CrmLeadStatus[] = ['new', 'contacted', 'qualified', 'converted', 'closed'];

export const CRM_LEAD_MANUAL_STATUSES: CrmLeadStatus[] = ['new', 'contacted', 'qualified', 'closed'];

export const CRM_LEAD_STATUS_LABELS: Record<CrmLeadStatus, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    converted: 'Converted',
    closed: 'Closed',
};

export type CrmLead = {
    id: string;
    name: string;
    email: string;
    phone: string;
    location: string;
    message: string;
    source_page: string;
    created_at: string;
    status: CrmLeadStatus;
    status_updated_at: string | null;
    is_converted: boolean;
};

export type CrmLeadNote = {
    id: string;
    contact_submission_id: string;
    author_id: string;
    author_name: string;
    body: string;
    created_at: string;
};

type CrmLeadRow = {
    id?: unknown;
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    location?: unknown;
    message?: unknown;
    source_page?: unknown;
    created_at?: unknown;
    status?: unknown;
    status_updated_at?: unknown;
    is_converted?: unknown;
};

type CrmLeadNoteProfileEmbed = { full_name?: unknown };

type CrmLeadNoteRow = {
    id?: unknown;
    contact_submission_id?: unknown;
    author_id?: unknown;
    body?: unknown;
    created_at?: unknown;
    profiles?: CrmLeadNoteProfileEmbed[] | CrmLeadNoteProfileEmbed | null;
};

const normalizeText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const normalizeStatus = (value: unknown): CrmLeadStatus => {
    const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return (CRM_LEAD_STATUSES as string[]).includes(text) ? (text as CrmLeadStatus) : 'new';
};

const firstOfEmbed = <T,>(value: T[] | T | null | undefined): T | undefined => (
    Array.isArray(value) ? value[0] : value ?? undefined
);

const isMissingTableError = (error: { code?: string; message?: string } | null | undefined, table: string) => {
    const message = error?.message?.toLowerCase() || '';
    return (
        error?.code === 'PGRST205'
        || (message.includes('relation') && message.includes(table) && message.includes('does not exist'))
        || (message.includes('could not find the table') && message.includes(table))
    );
};

const isMissingFunctionError = (error: { code?: string; message?: string } | null | undefined, fn: string) => {
    const message = error?.message?.toLowerCase() || '';
    return error?.code === 'PGRST202' || (message.includes('function') && message.includes(fn));
};

const isPermissionError = (error: { message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('row-level security') || message.includes('permission denied') || message.includes('policy');
};

const toCrmErrorMessage = (
    error: { code?: string; message?: string } | null | undefined,
    subject: string,
    action: 'select' | 'insert' | 'update',
    migrationFile: string,
) => {
    if (isMissingTableError(error, subject) || isMissingFunctionError(error, subject)) {
        return (
            `CRM is not fully set up yet (missing "${subject}"). Apply `
            + `supabase/migrations/${migrationFile}, then retry. `
            + `Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`
        ).trim();
    }
    if (isPermissionError(error)) {
        return `This action is blocked by Supabase policy. Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`.trim();
    }
    return (
        `Failed to ${action} ${subject.replace(/_/g, ' ')}. `
        + `Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`
    ).trim();
};

const normalizeCrmLead = (row: CrmLeadRow): CrmLead => ({
    id: normalizeText(row.id),
    name: normalizeText(row.name, 'Unknown'),
    email: normalizeText(row.email),
    phone: normalizeText(row.phone),
    location: normalizeText(row.location, 'Not provided'),
    message: normalizeText(row.message),
    source_page: normalizeText(row.source_page, 'landing_page'),
    created_at: normalizeText(row.created_at),
    status: normalizeStatus(row.status),
    status_updated_at: typeof row.status_updated_at === 'string' ? row.status_updated_at : null,
    is_converted: row.is_converted === true,
});

const normalizeCrmLeadNote = (row: CrmLeadNoteRow): CrmLeadNote => {
    const profileRow = firstOfEmbed(row.profiles);
    return {
        id: normalizeText(row.id),
        contact_submission_id: normalizeText(row.contact_submission_id),
        author_id: normalizeText(row.author_id),
        author_name: normalizeText(profileRow?.full_name, 'Team member'),
        body: normalizeText(row.body),
        created_at: normalizeText(row.created_at),
    };
};

export const getCrmLeads = async (): Promise<CrmLead[]> => {
    const { data, error } = await supabase.rpc('get_crm_leads');

    if (error) {
        console.error('get_crm_leads rpc failed', error);
        throw new Error(toCrmErrorMessage(error, 'get_crm_leads', 'select', '202608190003_create_crm_leads_conversion_rpc.sql'));
    }

    const rows = Array.isArray(data) ? data as CrmLeadRow[] : [];
    return rows.map(normalizeCrmLead).filter((row) => row.id.length > 0);
};

export const updateCrmLeadStatus = async (
    contactSubmissionId: string,
    status: CrmLeadStatus,
    updatedBy: string | null,
): Promise<void> => {
    const { error } = await supabase
        .from('crm_lead_status')
        .upsert(
            {
                contact_submission_id: contactSubmissionId,
                status,
                updated_by: updatedBy,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'contact_submission_id' },
        );

    if (error) {
        console.error('crm_lead_status upsert failed', error);
        throw new Error(toCrmErrorMessage(error, 'crm_lead_status', 'update', '202608190001_create_crm_lead_tables.sql'));
    }
};

export const getCrmLeadNotes = async (contactSubmissionId: string): Promise<CrmLeadNote[]> => {
    const { data, error } = await supabase
        .from('crm_lead_notes')
        .select('id, contact_submission_id, author_id, body, created_at, profiles!author_id(full_name)')
        .eq('contact_submission_id', contactSubmissionId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('crm_lead_notes select failed', error);
        throw new Error(toCrmErrorMessage(error, 'crm_lead_notes', 'select', '202608190001_create_crm_lead_tables.sql'));
    }

    const rows = Array.isArray(data) ? data as CrmLeadNoteRow[] : [];
    return rows.map(normalizeCrmLeadNote).filter((row) => row.id.length > 0);
};

export const addCrmLeadNote = async (
    contactSubmissionId: string,
    body: string,
    authorId: string,
): Promise<void> => {
    const trimmed = body.trim();
    if (!trimmed) throw new Error('Note cannot be empty.');

    const { error } = await supabase
        .from('crm_lead_notes')
        .insert({ contact_submission_id: contactSubmissionId, author_id: authorId, body: trimmed });

    if (error) {
        console.error('crm_lead_notes insert failed', error);
        throw new Error(toCrmErrorMessage(error, 'crm_lead_notes', 'insert', '202608190001_create_crm_lead_tables.sql'));
    }
};
