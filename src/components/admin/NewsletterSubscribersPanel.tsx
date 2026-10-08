import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, RefreshCw, Search } from 'lucide-react';
import {
    getNewsletterExportRows,
    setNewsletterSubscriberStatus,
    type NewsletterExportRow,
} from '../../lib/destinations';
import './newsletter-subscribers.css';

type StatusFilter = 'subscribed' | 'unsubscribed' | 'all';

const EXPORT_COLUMNS: Array<{ key: keyof NewsletterExportRow | 'role_label'; label: string; width: number }> = [
    { key: 'email', label: 'Email', width: 32 },
    { key: 'full_name', label: 'Name', width: 24 },
    { key: 'phone', label: 'Phone', width: 16 },
    { key: 'role_label', label: 'Account type', width: 16 },
    { key: 'status', label: 'Status', width: 13 },
    { key: 'source', label: 'Source', width: 12 },
    { key: 'subscribed_at', label: 'Subscribed at', width: 20 },
    { key: 'unsubscribed_at', label: 'Unsubscribed at', width: 20 },
    { key: 'account_created_at', label: 'Account created at', width: 20 },
];

// Byte-order mark so Excel opens UTF-8 CSV names correctly.
const BOM = String.fromCharCode(0xfeff);

const DATE_KEYS = new Set(['subscribed_at', 'unsubscribed_at', 'account_created_at']);

const roleLabel = (role: string | null) => {
    if (!role) return 'No account';
    if (role === 'tourist') return 'Tourist';
    if (role === 'admin' || role === 'marketing') return 'Staff';
    return 'Provider';
};

const formatDateTime = (value: string | null) => (
    value ? new Date(value).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
);

const cellValue = (row: NewsletterExportRow, key: (typeof EXPORT_COLUMNS)[number]['key']): string => {
    if (key === 'role_label') return roleLabel(row.role);
    const value = row[key];
    return value == null ? '' : String(value);
};

/** Local calendar day (YYYY-MM-DD) of a timestamp, for the date-range filter. */
const localDay = (value: string) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

/** Admin and marketing: newsletter subscriber list with filters, status changes and CSV / Excel export. */
export const NewsletterSubscribersPanel: React.FC = () => {
    const [rows, setRows] = useState<NewsletterExportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<StatusFilter>('subscribed');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [exporting, setExporting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            setRows(await getNewsletterExportRows());
        } catch (loadError) {
            setError(loadError instanceof Error ? loadError.message : 'Could not load subscribers.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const filtered = useMemo(() => {
        const query = search.trim().toLowerCase();
        return rows.filter((row) => {
            if (status !== 'all' && row.status !== status) return false;
            const day = localDay(row.subscribed_at);
            if (from && day < from) return false;
            if (to && day > to) return false;
            if (!query) return true;
            return `${row.email} ${row.full_name || ''} ${row.phone || ''}`.toLowerCase().includes(query);
        });
    }, [from, rows, search, status, to]);

    const subscribedCount = rows.filter((row) => row.status === 'subscribed').length;
    const fileStem = `newsletter-${status}-${new Date().toISOString().slice(0, 10)}`;

    const exportCsv = () => {
        const escape = (text: string) => (/[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text);
        const lines = filtered.map((row) => EXPORT_COLUMNS.map((column) => escape(cellValue(row, column.key))).join(','));
        const csv = `${BOM}${EXPORT_COLUMNS.map((column) => column.label).join(',')}\n${lines.join('\n')}`;
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${fileStem}.csv`);
    };

    const exportExcel = async () => {
        setExporting(true);
        try {
            const { default: writeXlsxFile } = await import('write-excel-file/browser');
            const header = EXPORT_COLUMNS.map((column) => ({ value: column.label, fontWeight: 'bold' as const }));
            const body = filtered.map((row) => EXPORT_COLUMNS.map((column) => {
                const raw = column.key === 'role_label' ? null : row[column.key];
                if (DATE_KEYS.has(column.key)) {
                    return raw ? { value: new Date(String(raw)), type: Date, format: 'dd mmm yyyy hh:mm' } : null;
                }
                return { value: cellValue(row, column.key), type: String };
            }));
            const blob = await writeXlsxFile([header, ...body], {
                columns: EXPORT_COLUMNS.map((column) => ({ width: column.width })),
                sheet: 'Subscribers',
                stickyRowsCount: 1,
            }).toBlob();
            downloadBlob(blob, `${fileStem}.xlsx`);
        } catch (exportError) {
            setError(exportError instanceof Error ? exportError.message : 'Could not create the Excel file.');
        } finally {
            setExporting(false);
        }
    };

    const toggleStatus = async (row: NewsletterExportRow) => {
        const next = row.status === 'subscribed' ? 'unsubscribed' : 'subscribed';
        try {
            await setNewsletterSubscriberStatus(row.id, next);
            const now = new Date().toISOString();
            setRows((current) => current.map((item) => (item.id === row.id
                ? { ...item, status: next, unsubscribed_at: next === 'unsubscribed' ? now : null, subscribed_at: next === 'subscribed' ? now : item.subscribed_at }
                : item)));
        } catch (updateError) {
            setError(updateError instanceof Error ? updateError.message : 'Could not update the subscriber.');
        }
    };

    return (
        <section className="nls">
            <header className="nls-head">
                <div>
                    <h2>Newsletter subscribers</h2>
                    <p>{subscribedCount} subscribed · {rows.length - subscribedCount} unsubscribed</p>
                </div>
                <div className="nls-actions">
                    <button type="button" className="nls-btn" onClick={() => void load()} disabled={loading} aria-label="Refresh">
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button type="button" className="nls-btn" onClick={exportCsv} disabled={!filtered.length}>
                        <Download size={15} /> CSV
                    </button>
                    <button type="button" className="nls-btn nls-btn--primary" onClick={() => void exportExcel()} disabled={!filtered.length || exporting}>
                        <FileSpreadsheet size={15} /> {exporting ? 'Preparing…' : 'Excel'}
                    </button>
                </div>
            </header>

            <div className="nls-filters">
                <label className="nls-search">
                    <Search size={15} aria-hidden="true" />
                    <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search email, name or phone" aria-label="Search subscribers" />
                </label>
                <div className="nls-segmented" role="group" aria-label="Status">
                    {(['subscribed', 'unsubscribed', 'all'] as StatusFilter[]).map((item) => (
                        <button key={item} type="button" className={status === item ? 'is-active' : ''} aria-pressed={status === item} onClick={() => setStatus(item)}>
                            {item === 'all' ? 'All' : item.charAt(0).toUpperCase() + item.slice(1)}
                        </button>
                    ))}
                </div>
                <label className="nls-date">
                    <span>From</span>
                    <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label className="nls-date">
                    <span>To</span>
                    <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
                </label>
            </div>

            <p className="nls-meta">
                {filtered.length} {filtered.length === 1 ? 'record' : 'records'} match. Exports include exactly these records.
            </p>

            {error ? <p className="nls-error" role="alert">{error}</p> : null}

            {loading && !rows.length ? (
                <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading subscribers…</p></div>
            ) : (
                <div className="nls-table-wrap">
                    <table className="nls-table">
                        <thead>
                            <tr>
                                <th>Subscriber</th>
                                <th>Phone</th>
                                <th>Account</th>
                                <th>Subscribed</th>
                                <th>Status</th>
                                <th aria-label="Actions" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 200).map((row) => (
                                <tr key={row.id}>
                                    <td>
                                        <strong>{row.full_name || row.email}</strong>
                                        {row.full_name ? <small>{row.email}</small> : null}
                                    </td>
                                    <td>{row.phone || '—'}</td>
                                    <td>{roleLabel(row.role)}<small>{row.source}</small></td>
                                    <td>{formatDateTime(row.subscribed_at)}</td>
                                    <td><span className={`nls-status is-${row.status}`}>{row.status}</span></td>
                                    <td>
                                        <button type="button" className="nls-link" onClick={() => void toggleStatus(row)}>
                                            {row.status === 'subscribed' ? 'Unsubscribe' : 'Resubscribe'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {!filtered.length ? <p className="rdb-empty">No subscribers match these filters.</p> : null}
                    {filtered.length > 200 ? <p className="nls-meta">Showing the first 200. Export to see all {filtered.length}.</p> : null}
                </div>
            )}
        </section>
    );
};
