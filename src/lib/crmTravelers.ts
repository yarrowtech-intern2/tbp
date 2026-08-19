import { supabase } from './supabase';

export type CrmTraveler = {
    id: string;
    full_name: string;
    email: string;
    phone: string;
    city: string;
    country: string;
    created_at: string | null;
};

type CrmTravelerRow = {
    id?: unknown;
    full_name?: unknown;
    email?: unknown;
    phone?: unknown;
    city?: unknown;
    country?: unknown;
    created_at?: unknown;
};

export type CrmTravelerBooking = {
    id: string;
    listing_title: string;
    listing_type: string;
    status: string;
    payment_status: string;
    total_price: number;
    created_at: string;
};

type CrmTravelerBookingRow = {
    id?: unknown;
    listing_title?: unknown;
    listing_type?: unknown;
    status?: unknown;
    payment_status?: unknown;
    total_price?: unknown;
    created_at?: unknown;
};

export type CrmTravelerBookingSummary = {
    totalCount: number;
    recent: CrmTravelerBooking[];
};

const normalizeText = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return trimmed || fallback;
};

const isPermissionError = (error: { message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return message.includes('row-level security') || message.includes('permission denied') || message.includes('policy');
};

const isMissingFunctionError = (error: { code?: string; message?: string } | null | undefined) => {
    const message = error?.message?.toLowerCase() || '';
    return error?.code === 'PGRST202' || (message.includes('function') && message.includes('get_crm_travelers'));
};

const toCrmTravelerErrorMessage = (
    error: { code?: string; message?: string } | null | undefined,
    action: string,
) => {
    if (isMissingFunctionError(error)) {
        return (
            'CRM traveler lookup is not set up yet. Apply '
            + 'supabase/migrations/202608190002_create_crm_account_notes_and_traveler_rpc.sql, then retry. '
            + `Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`
        ).trim();
    }
    if (isPermissionError(error)) {
        return `This action is blocked by Supabase policy. Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`.trim();
    }
    return (
        `Failed to ${action}. `
        + `Supabase said: ${error?.code || 'unknown'} ${error?.message || ''}`
    ).trim();
};

const normalizeCrmTraveler = (row: CrmTravelerRow): CrmTraveler => ({
    id: normalizeText(row.id),
    full_name: normalizeText(row.full_name, 'Unnamed traveler'),
    email: normalizeText(row.email),
    phone: normalizeText(row.phone),
    city: normalizeText(row.city),
    country: normalizeText(row.country),
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
});

const normalizeCrmTravelerBooking = (row: CrmTravelerBookingRow): CrmTravelerBooking => ({
    id: normalizeText(row.id),
    listing_title: normalizeText(row.listing_title, 'Untitled listing'),
    listing_type: normalizeText(row.listing_type, 'listing'),
    status: normalizeText(row.status, 'pending'),
    payment_status: normalizeText(row.payment_status, 'pending'),
    total_price: typeof row.total_price === 'number' ? row.total_price : Number(row.total_price) || 0,
    created_at: normalizeText(row.created_at),
});

export const getCrmTravelers = async (searchTerm = ''): Promise<CrmTraveler[]> => {
    const term = searchTerm.trim().replace(/[%,]/g, ' ').trim();

    const { data, error } = await supabase.rpc('get_crm_travelers', { search_term: term || null });

    if (error) {
        console.error('get_crm_travelers rpc failed', error);
        throw new Error(toCrmTravelerErrorMessage(error, 'load travelers'));
    }

    const rows = Array.isArray(data) ? data as CrmTravelerRow[] : [];
    return rows.map(normalizeCrmTraveler).filter((row) => row.id.length > 0);
};

export const getCrmTravelerBookingSummary = async (userId: string): Promise<CrmTravelerBookingSummary> => {
    const [countResult, listResult] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase
            .from('bookings')
            .select('id, listing_title, listing_type, status, payment_status, total_price, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10),
    ]);

    if (countResult.error) {
        console.error('crm traveler booking count failed', countResult.error);
        throw new Error(toCrmTravelerErrorMessage(countResult.error, 'load booking count'));
    }
    if (listResult.error) {
        console.error('crm traveler booking list failed', listResult.error);
        throw new Error(toCrmTravelerErrorMessage(listResult.error, 'load bookings'));
    }

    const rows = Array.isArray(listResult.data) ? listResult.data as CrmTravelerBookingRow[] : [];
    return {
        totalCount: countResult.count ?? rows.length,
        recent: rows.map(normalizeCrmTravelerBooking).filter((row) => row.id.length > 0),
    };
};
