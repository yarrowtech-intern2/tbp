import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Loader2, Mail, MapPin, Phone, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import {
    getCrmTravelerBookingSummary,
    getCrmTravelers,
    type CrmTraveler,
    type CrmTravelerBookingSummary,
} from '../../lib/crmTravelers';
import { addCrmAccountNote, getCrmAccountNotes, type CrmAccountNote } from '../../lib/crmAccountNotes';
import { CrmNotesTimeline } from './CrmNotesTimeline';
import './crm-leads-panel.css';

const formatTimestamp = (value: string | null) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatCurrency = (amount: number) => (
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
);

const SEARCH_DEBOUNCE_MS = 350;

export const CrmTravelersPanel: React.FC = () => {
    const { user, profile } = useAuth();

    const [travelers, setTravelers] = useState<CrmTraveler[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const [bookingsByTraveler, setBookingsByTraveler] = useState<Record<string, CrmTravelerBookingSummary>>({});
    const [bookingsLoading, setBookingsLoading] = useState<Record<string, boolean>>({});
    const [bookingsError, setBookingsError] = useState<Record<string, string>>({});

    const [notesByTraveler, setNotesByTraveler] = useState<Record<string, CrmAccountNote[]>>({});
    const [notesLoading, setNotesLoading] = useState<Record<string, boolean>>({});
    const [notesError, setNotesError] = useState<Record<string, string>>({});
    const [noteDraftByTraveler, setNoteDraftByTraveler] = useState<Record<string, string>>({});
    const [noteSubmitting, setNoteSubmitting] = useState<Record<string, boolean>>({});

    const load = useCallback(async (term: string, background = false) => {
        if (background) setRefreshing(true);
        else setLoading(true);
        setLoadError(null);
        try {
            const nextTravelers = await getCrmTravelers(term);
            setTravelers(nextTravelers);
        } catch (error) {
            setLoadError(error instanceof Error ? error.message : 'Failed to load travelers.');
        } finally {
            if (background) setRefreshing(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load('');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handle = setTimeout(() => {
            void load(searchInput);
        }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    const loadBookings = useCallback(async (travelerId: string) => {
        setBookingsLoading((prev) => ({ ...prev, [travelerId]: true }));
        setBookingsError((prev) => {
            const next = { ...prev };
            delete next[travelerId];
            return next;
        });
        try {
            const summary = await getCrmTravelerBookingSummary(travelerId);
            setBookingsByTraveler((prev) => ({ ...prev, [travelerId]: summary }));
        } catch (error) {
            setBookingsError((prev) => ({
                ...prev,
                [travelerId]: error instanceof Error ? error.message : 'Failed to load bookings.',
            }));
        } finally {
            setBookingsLoading((prev) => ({ ...prev, [travelerId]: false }));
        }
    }, []);

    const loadNotes = useCallback(async (travelerId: string) => {
        setNotesLoading((prev) => ({ ...prev, [travelerId]: true }));
        setNotesError((prev) => {
            const next = { ...prev };
            delete next[travelerId];
            return next;
        });
        try {
            const notes = await getCrmAccountNotes('traveler', travelerId);
            setNotesByTraveler((prev) => ({ ...prev, [travelerId]: notes }));
        } catch (error) {
            setNotesError((prev) => ({
                ...prev,
                [travelerId]: error instanceof Error ? error.message : 'Failed to load notes.',
            }));
        } finally {
            setNotesLoading((prev) => ({ ...prev, [travelerId]: false }));
        }
    }, []);

    const toggleExpand = useCallback((travelerId: string) => {
        setExpandedId((current) => {
            const next = current === travelerId ? null : travelerId;
            if (next && !(next in bookingsByTraveler)) void loadBookings(next);
            if (next && !(next in notesByTraveler)) void loadNotes(next);
            return next;
        });
    }, [bookingsByTraveler, loadBookings, loadNotes, notesByTraveler]);

    const handleAddNote = useCallback(async (travelerId: string) => {
        const draft = (noteDraftByTraveler[travelerId] || '').trim();
        if (!draft || !user?.id) return;
        setActionError(null);
        setNoteSubmitting((prev) => ({ ...prev, [travelerId]: true }));
        try {
            await addCrmAccountNote('traveler', travelerId, draft, user.id);
            setNoteDraftByTraveler((prev) => ({ ...prev, [travelerId]: '' }));
            await loadNotes(travelerId);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : 'Failed to add note.');
        } finally {
            setNoteSubmitting((prev) => ({ ...prev, [travelerId]: false }));
        }
    }, [loadNotes, noteDraftByTraveler, user?.id]);

    return (
        <section className="rdb-content-grid crm-panel">
            <article className="rdb-panel rdb-panel-wide">
                <div className="rdb-panel-head">
                    <div>
                        <h2>Travelers</h2>
                        <small>Tourist accounts, booking history, and relationship notes</small>
                    </div>
                    <button type="button" className="rdb-inline-link" onClick={() => void load(searchInput, true)} disabled={loading || refreshing}>
                        {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        Refresh
                    </button>
                </div>
                <div className="rdb-stat-list">
                    <div><span>Showing</span><strong>{travelers.length}</strong></div>
                    <div><span>Mode</span><strong>{searchInput.trim().length >= 2 ? 'Search' : 'Recent'}</strong></div>
                </div>
            </article>

            <article className="rdb-panel rdb-panel-wide">
                <div className="rdb-panel-head">
                    <h2>Accounts</h2>
                    <small>Most recent 50 shown by default</small>
                </div>

                <div className="crm-toolbar">
                    <label className="crm-search">
                        <Search size={16} />
                        <input
                            type="text"
                            placeholder="Search name, email, or phone (2+ characters)"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                        />
                    </label>
                </div>

                {actionError && <p className="rdb-error">{actionError}</p>}

                {loading ? (
                    <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading travelers...</p></div>
                ) : loadError ? (
                    <p className="rdb-error">{loadError}</p>
                ) : travelers.length === 0 ? (
                    <p className="rdb-empty">{searchInput.trim() ? 'No travelers match this search.' : 'No traveler accounts yet.'}</p>
                ) : (
                    <div className="rdb-list crm-lead-list">
                        {travelers.map((traveler) => {
                            const isExpanded = expandedId === traveler.id;
                            const bookings = bookingsByTraveler[traveler.id];
                            const travelerNotes = notesByTraveler[traveler.id] || [];
                            return (
                                <div className="crm-lead-item" key={traveler.id}>
                                    <button
                                        type="button"
                                        className={`rdb-list-row rdb-list-row-button crm-lead-row${isExpanded ? ' is-active' : ''}`}
                                        onClick={() => toggleExpand(traveler.id)}
                                    >
                                        <div>
                                            <strong>{traveler.full_name}</strong>
                                            <small>{traveler.email || 'No email on file'} &middot; Joined {formatTimestamp(traveler.created_at)}</small>
                                        </div>
                                        <ChevronDown size={16} className={`crm-chevron${isExpanded ? ' is-open' : ''}`} />
                                    </button>

                                    {isExpanded && (
                                        <div className="crm-lead-detail">
                                            <div className="crm-lead-contact">
                                                {traveler.email && <a href={`mailto:${traveler.email}`}><Mail size={14} />{traveler.email}</a>}
                                                {traveler.phone && <a href={`tel:${traveler.phone.replace(/[^\d+]/g, '')}`}><Phone size={14} />{traveler.phone}</a>}
                                                {(traveler.city || traveler.country) && (
                                                    <span><MapPin size={14} />{[traveler.city, traveler.country].filter(Boolean).join(', ')}</span>
                                                )}
                                            </div>

                                            <div className="crm-status-row">
                                                <label>Bookings</label>
                                                <div className="crm-status-control">
                                                    {bookingsLoading[traveler.id] ? (
                                                        <span className="crm-inline-loading"><Loader2 size={14} className="animate-spin" /> Loading bookings...</span>
                                                    ) : bookingsError[traveler.id] ? (
                                                        <span className="rdb-error">{bookingsError[traveler.id]}</span>
                                                    ) : (
                                                        <strong>{bookings?.totalCount ?? 0} total</strong>
                                                    )}
                                                </div>
                                            </div>

                                            {bookings && bookings.recent.length > 0 && (
                                                <div className="crm-booking-list">
                                                    {bookings.recent.map((booking) => (
                                                        <div className="crm-booking-row" key={booking.id}>
                                                            <div>
                                                                <strong>{booking.listing_title}</strong>
                                                                <small>{booking.listing_type} &middot; {formatTimestamp(booking.created_at)}</small>
                                                            </div>
                                                            <div className="crm-booking-row-meta">
                                                                <span className={`rdb-pill rdb-pill-${booking.status}`}>{booking.status}</span>
                                                                <strong>{formatCurrency(booking.total_price)}</strong>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <CrmNotesTimeline
                                                notes={travelerNotes}
                                                loading={Boolean(notesLoading[traveler.id])}
                                                error={notesError[traveler.id] || null}
                                                draft={noteDraftByTraveler[traveler.id] || ''}
                                                onDraftChange={(value) => setNoteDraftByTraveler((prev) => ({ ...prev, [traveler.id]: value }))}
                                                onSubmit={() => void handleAddNote(traveler.id)}
                                                submitting={Boolean(noteSubmitting[traveler.id])}
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
