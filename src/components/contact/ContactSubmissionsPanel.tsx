import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, MapPin, Phone, RefreshCw } from 'lucide-react';
import {
    getContactSubmissions,
    type ContactSubmissionRecord,
} from '../../lib/contactSubmissions';

const formatTimestamp = (value: string) => {
    if (!value) return 'Unknown time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown time';
    return new Intl.DateTimeFormat('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
};

export const ContactSubmissionsPanel: React.FC = () => {
    const [rows, setRows] = useState<ContactSubmissionRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (background = false) => {
        if (background) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const nextRows = await getContactSubmissions();
            setRows(nextRows);
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Failed to load contact submissions.');
        } finally {
            if (background) setRefreshing(false);
            else setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentCount = rows.filter((row) => {
        const timestamp = new Date(row.created_at).getTime();
        return Number.isFinite(timestamp) && timestamp >= recentCutoff;
    }).length;

    return (
        <section className="rdb-content-grid">
            <article className="rdb-panel rdb-panel-wide">
                <div className="rdb-panel-head">
                    <div>
                        <h2>Contact Leads</h2>
                        <small>Landing page submissions visible to admin and marketing accounts</small>
                    </div>
                    <button type="button" className="rdb-inline-link" onClick={() => void load(true)} disabled={loading || refreshing}>
                        {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                        Refresh
                    </button>
                </div>
                <div className="rdb-stat-list">
                    <div><span>Total Leads</span><strong>{rows.length}</strong></div>
                    <div><span>Last 7 Days</span><strong>{recentCount}</strong></div>
                    <div><span>Latest Source</span><strong>{rows[0]?.source_page || 'landing_page'}</strong></div>
                </div>
            </article>

            <article className="rdb-panel rdb-panel-wide">
                <div className="rdb-panel-head">
                    <h2>Recent Submissions</h2>
                    <small>{rows.length} records</small>
                </div>

                {loading ? (
                    <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading contact submissions...</p></div>
                ) : error ? (
                    <p className="rdb-error">{error}</p>
                ) : rows.length === 0 ? (
                    <p className="rdb-empty">No contact submissions yet.</p>
                ) : (
                    <div className="rdb-list">
                        {rows.map((row) => (
                            <article className="rdb-list-row" key={row.id} style={{ alignItems: 'flex-start' }}>
                                <div style={{ display: 'grid', gap: '10px', width: '100%' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                                        <div>
                                            <strong>{row.name}</strong>
                                            <small>{formatTimestamp(row.created_at)}</small>
                                        </div>
                                        <span className="rdb-pill rdb-pill-live">{row.source_page.replace(/_/g, ' ')}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 18px', color: 'var(--text-muted)' }}>
                                        <a href={`mailto:${row.email}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'none' }}>
                                            <Mail size={14} />
                                            {row.email}
                                        </a>
                                        <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'none' }}>
                                            <Phone size={14} />
                                            {row.phone}
                                        </a>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                            <MapPin size={14} />
                                            {row.location}
                                        </span>
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.7 }}>{row.message}</p>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </article>
        </section>
    );
};
