import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Loader2, Mail, MapPin, Phone, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
    addCrmLeadNote,
    CRM_LEAD_MANUAL_STATUSES,
    CRM_LEAD_STATUSES,
    CRM_LEAD_STATUS_LABELS,
    getCrmLeadNotes,
    getCrmLeads,
    updateCrmLeadStatus,
    type CrmLead,
    type CrmLeadNote,
    type CrmLeadStatus,
} from '../../lib/crmLeads';
import { CrmNotesTimeline } from './CrmNotesTimeline';
import './crm-leads-panel.css';

const formatTimestamp = (value: string) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

// A lead displays as "converted" the moment its email matches a paying customer
// (public.get_crm_leads() computes is_converted), regardless of its manually-set
// pipeline status — conversion is automatic, not a dropdown choice.
const getDisplayStatus = (lead: CrmLead): CrmLeadStatus => (lead.is_converted ? 'converted' : lead.status);

type StatusFilter = 'all' | CrmLeadStatus;

export const CrmLeadsPanel: React.FC = () => {
    const { user, profile } = useAuth();

    const [leads, setLeads] = useState<CrmLead[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});
    const [actionError, setActionError] = useState<string | null>(null);

    const [notesByLead, setNotesByLead] = useState<Record<string, CrmLeadNote[]>>({});
    const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
    const [notesError, setNotesError] = useState<Record<string, string>>({});
    const [noteDraftByLead, setNoteDraftByLead] = useState<Record<string, string>>({});
    const [noteSubmitting, setNoteSubmitting] = useState<Record<string, boolean>>({});

    const load = useCallback(async (background = false) => {
        if (background) setRefreshing(true);
        else setLoading(true);
        setLoadError(null);
        try {
            const nextLeads = await getCrmLeads();
            setLeads(nextLeads);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Failed to load leads.');
        } finally {
            if (background) setRefreshing(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const loadNotes = useCallback(async (contactSubmissionId: string) => {
        setNotesLoading((prev) => ({ ...prev, [contactSubmissionId]: true }));
        setNotesError((prev) => {
            const next = { ...prev };
            delete next[contactSubmissionId];
            return next;
        });
        try {
            const notes = await getCrmLeadNotes(contactSubmissionId);
            setNotesByLead((prev) => ({ ...prev, [contactSubmissionId]: notes }));
        } catch (error) {
            setNotesError((prev) => ({
                ...prev,
                [contactSubmissionId]: error instanceof Error ? error.message : 'Failed to load notes.',
            }));
        } finally {
            setNotesLoading((prev) => ({ ...prev, [contactSubmissionId]: false }));
        }
    }, []);

    const toggleExpand = useCallback((contactSubmissionId: string) => {
        setExpandedId((current) => {
            const next = current === contactSubmissionId ? null : contactSubmissionId;
            if (next && !(next in notesByLead)) {
                void loadNotes(next);
            }
            return next;
        });
    }, [loadNotes, notesByLead]);

    const handleStatusChange = useCallback(async (lead: CrmLead, nextStatus: CrmLeadStatus) => {
        if (nextStatus === lead.status) return;
        const previousStatus = lead.status;
        setActionError(null);
        setStatusUpdating((prev) => ({ ...prev, [lead.id]: true }));
        setLeads((prev) => prev.map((row) => (row.id === lead.id ? { ...row, status: nextStatus } : row)));
        try {
            await updateCrmLeadStatus(lead.id, nextStatus, user?.id ?? null);
        } catch (error) {
            setLeads((prev) => prev.map((row) => (row.id === lead.id ? { ...row, status: previousStatus } : row)));
            setActionError(error instanceof Error ? error.message : 'Failed to update status.');
        } finally {
            setStatusUpdating((prev) => ({ ...prev, [lead.id]: false }));
        }
    }, [user?.id]);

    const handleAddNote = useCallback(async (contactSubmissionId: string) => {
        const draft = (noteDraftByLead[contactSubmissionId] || '').trim();
        if (!draft || !user?.id) return;
        setActionError(null);
        setNoteSubmitting((prev) => ({ ...prev, [contactSubmissionId]: true }));
        try {
            await addCrmLeadNote(contactSubmissionId, draft, user.id);
            setNoteDraftByLead((prev) => ({ ...prev, [contactSubmissionId]: '' }));
            await loadNotes(contactSubmissionId);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Failed to add note.');
        } finally {
            setNoteSubmitting((prev) => ({ ...prev, [contactSubmissionId]: false }));
        }
    }, [loadNotes, noteDraftByLead, user?.id]);

    const filteredLeads = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return leads.filter((lead) => {
            if (statusFilter !== 'all' && getDisplayStatus(lead) !== statusFilter) return false;
            if (!term) return true;
            return (
                lead.name.toLowerCase().includes(term)
                || lead.email.toLowerCase().includes(term)
                || lead.phone.toLowerCase().includes(term)
                || lead.location.toLowerCase().includes(term)
            );
        });
    }, [leads, searchTerm, statusFilter]);

    const stats = useMemo(() => ({
        total: leads.length,
        new: leads.filter((lead) => getDisplayStatus(lead) === 'new').length,
        inProgress: leads.filter((lead) => {
            const status = getDisplayStatus(lead);
            return status === 'contacted' || status === 'qualified';
        }).length,
        converted: leads.filter((lead) => lead.is_converted).length,
    }), [leads]);

    return (
        <section className="rdb-content-grid crm-panel">
            <article className="rdb-panel rdb-panel-wide">
                <div className="rdb-panel-head">
                    <div>
                        <h2>Leads</h2>
                        <small>Pipeline built from Contact Leads, with status and follow-up notes</small>
                    </div>
                    <button type="button" className="rdb-inline-link" onClick={() => void load(true)} disabled={loading || refreshing}>
                        {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        Refresh
                    </button>
                </div>
                <div className="rdb-stat-list">
                    <div><span>Total Leads</span><strong>{stats.total}</strong></div>
                    <div><span>New</span><strong>{stats.new}</strong></div>
                    <div><span>In Progress</span><strong>{stats.inProgress}</strong></div>
                    <div><span>Converted</span><strong>{stats.converted}</strong></div>
                </div>
            </article>

            <article className="rdb-panel rdb-panel-wide">
                <div className="rdb-panel-head">
                    <h2>Pipeline</h2>
                    <small>{filteredLeads.length} of {leads.length} leads</small>
                </div>

                <div className="crm-toolbar">
                    <label className="crm-search">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search name, email, phone, location"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                        />
                    </label>
                    <select
                        className="crm-status-filter"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                    >
                        <option value="all">All statuses</option>
                        {CRM_LEAD_STATUSES.map((status) => (
                            <option key={status} value={status}>{CRM_LEAD_STATUS_LABELS[status]}</option>
                        ))}
                    </select>
                </div>

                {actionError && <p className="rdb-error">{actionError}</p>}

                {loading ? (
                    <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading leads...</p></div>
                ) : loadError ? (
                    <p className="rdb-error">{loadError}</p>
                ) : filteredLeads.length === 0 ? (
                    <p className="rdb-empty">{leads.length === 0 ? 'No leads yet.' : 'No leads match these filters.'}</p>
                ) : (
                    <div className="rdb-list crm-lead-list">
                        {filteredLeads.map((lead) => {
                            const isExpanded = expandedId === lead.id;
                            const leadNotes = notesByLead[lead.id] || [];
                            return (
                                <div className="crm-lead-item" key={lead.id}>
                                    <button
                                        type="button"
                                        className={`rdb-list-row rdb-list-row-button crm-lead-row${isExpanded ? ' is-active' : ''}`}
                                        onClick={() => toggleExpand(lead.id)}
                                    >
                                        <div>
                                            <strong>{lead.name}</strong>
                                            <small>{lead.email} &middot; {formatTimestamp(lead.created_at)}</small>
                                        </div>
                                        <span className={`rdb-pill crm-pill-${getDisplayStatus(lead)}`}>{CRM_LEAD_STATUS_LABELS[getDisplayStatus(lead)]}</span>
                                        <ChevronDown size={16} className={`crm-chevron${isExpanded ? ' is-open' : ''}`} />
                                    </button>

                                    {isExpanded && (
                                        <div className="crm-lead-detail">
                                            <div className="crm-lead-contact">
                                                <a href={`mailto:${lead.email}`}><Mail size={14} />{lead.email}</a>
                                                <a href={`tel:${lead.phone.replace(/[^\d+]/g, '')}`}><Phone size={14} />{lead.phone}</a>
                                                <span><MapPin size={14} />{lead.location}</span>
                                            </div>
                                            <p className="crm-lead-message">{lead.message}</p>
                                            <p className="crm-lead-source">Source: {lead.source_page.replace(/_/g, ' ')}</p>

                                            <div className="crm-status-row">
                                                <label htmlFor={`crm-status-${lead.id}`}>Status</label>
                                                {lead.is_converted ? (
                                                    <p className="crm-converted-note">
                                                        <CheckCircle2 size={14} />
                                                        Automatically marked Converted — this email has a paid booking.
                                                    </p>
                                                ) : (
                                                    <div className="crm-status-control">
                                                        <select
                                                            id={`crm-status-${lead.id}`}
                                                            value={lead.status}
                                                            disabled={statusUpdating[lead.id]}
                                                            onChange={(event) => void handleStatusChange(lead, event.target.value as CrmLeadStatus)}
                                                        >
                                                            {CRM_LEAD_MANUAL_STATUSES.map((status) => (
                                                                <option key={status} value={status}>{CRM_LEAD_STATUS_LABELS[status]}</option>
                                                            ))}
                                                        </select>
                                                        {statusUpdating[lead.id] && <Loader2 size={14} className="animate-spin" />}
                                                    </div>
                                                )}
                                            </div>

                                            <CrmNotesTimeline
                                                notes={leadNotes}
                                                loading={Boolean(notesLoading[lead.id])}
                                                error={notesError[lead.id] || null}
                                                draft={noteDraftByLead[lead.id] || ''}
                                                onDraftChange={(value) => setNoteDraftByLead((prev) => ({ ...prev, [lead.id]: value }))}
                                                onSubmit={() => void handleAddNote(lead.id)}
                                                submitting={Boolean(noteSubmitting[lead.id])}
                                                placeholder={profile?.full_name ? `Add a note as ${profile.full_name}...` : 'Add a follow-up note...'}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </article>
        </section>
    );
};
