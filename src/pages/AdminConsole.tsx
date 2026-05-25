import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
    Activity,
    CheckCircle2,
    Clock,
    FileText,
    Globe2,
    Layers,
    Loader2,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Users,
    XCircle,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
    getAdminAccountLocations,
    getContentModerationQueue,
    getModerationAuditLogs,
    getVerificationQueue,
    reviewListing,
    reviewVerificationApplication,
    type AdminAccountLocationRecord,
    type ModerationAuditLogRecord,
    type PostRecord,
    type VerificationRecord,
} from '../lib/destinations';
import { getAccountRoleGroup, type AccountRoleGroup } from '../lib/accountGeo';
import { getProfileAvatarUrl } from '../lib/avatar';
import { LISTING_LABELS, getRoleLabel } from '../lib/platform';
import './admin-console.css';

type Tab = 'providers' | 'listings' | 'audit' | 'map';

type BulkConfirmationState =
    | { target: 'verification'; count: number }
    | { target: 'listing'; count: number }
    | null;

const LazyAdminAccountMap = lazy(async () => {
    const module = await import('../components/admin/AdminAccountMap');
    return { default: module.AdminAccountMap };
});

const statusPillClass = (status?: string | null) => {
    switch (status) {
        case 'approved':    return 'ac-pill ac-pill--approved';
        case 'live':
        case 'published':
            return 'ac-pill ac-pill--live';
        case 'rejected':    return 'ac-pill ac-pill--rejected';
        case 'resubmitted': return 'ac-pill ac-pill--resubmitted';
        default:            return 'ac-pill ac-pill--pending';
    }
};

const getListingStatusLabel = (status?: string | null) => {
    if (status === 'published') return 'live';
    return status || 'pending';
};

export const AdminConsole: React.FC = () => {
    const { user, isAdmin, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<Tab>('providers');
    const [queue, setQueue] = useState<VerificationRecord[]>([]);
    const [listingQueue, setListingQueue] = useState<PostRecord[]>([]);
    const [auditLogs, setAuditLogs] = useState<ModerationAuditLogRecord[]>([]);
    const [accountLocations, setAccountLocations] = useState<AdminAccountLocationRecord[]>([]);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [fetching, setFetching] = useState(true);
    const [mapFetching, setMapFetching] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [verificationRejectReason, setVerificationRejectReason] = useState<Record<string, string>>({});
    const [listingRejectReason, setListingRejectReason] = useState<Record<string, string>>({});
    const [verificationStatusFilter, setVerificationStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'resubmitted'>('all');
    const [verificationRoleFilter, setVerificationRoleFilter] = useState<'all' | 'tour_company' | 'tour_instructor' | 'tour_guide'>('all');
    const [listingStatusFilter, setListingStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
    const [listingTypeFilter, setListingTypeFilter] = useState<'all' | 'tour' | 'activity' | 'guide'>('all');
    const [verificationSearch, setVerificationSearch] = useState('');
    const [listingSearch, setListingSearch] = useState('');
    const [mapSearch, setMapSearch] = useState('');
    const [verificationSort, setVerificationSort] = useState<'updated_desc' | 'updated_asc' | 'reviewed_desc'>('updated_desc');
    const [listingSort, setListingSort] = useState<'created_desc' | 'created_asc' | 'reviewed_desc'>('created_desc');
    const [mapRoleFilter, setMapRoleFilter] = useState<'all' | AccountRoleGroup>('all');
    const [selectedVerificationIds, setSelectedVerificationIds] = useState<string[]>([]);
    const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
    const [bulkBusy, setBulkBusy] = useState<'verification' | 'listing' | null>(null);
    const [bulkVerificationRejectReason, setBulkVerificationRejectReason] = useState('');
    const [bulkListingRejectReason, setBulkListingRejectReason] = useState('');
    const [bulkConfirmation, setBulkConfirmation] = useState<BulkConfirmationState>(null);

    const loadQueue = async () => {
        setFetching(true);
        try {
            const [data, listings, logs] = await Promise.all([
                getVerificationQueue(),
                getContentModerationQueue(),
                getModerationAuditLogs(),
            ]);
            setQueue(data);
            setListingQueue(listings);
            setAuditLogs(logs);
        } finally {
            setFetching(false);
        }
    };

    const loadAccountLocations = async (force = false) => {
        if (mapFetching) return;
        if (mapLoaded && !force) return;

        setMapFetching(true);
        try {
            const accounts = await getAdminAccountLocations();
            setAccountLocations(accounts);
            setMapLoaded(true);
        } finally {
            setMapFetching(false);
        }
    };

    useEffect(() => {
        if (!user || !isAdmin) return;
        void loadQueue();
    }, [isAdmin, user]);

    useEffect(() => {
        if (!user || !isAdmin || activeTab !== 'map') return;
        void loadAccountLocations();
    }, [activeTab, isAdmin, user]);

    const pendingCount = useMemo(() => queue.filter((i) => i.status === 'pending' || i.status === 'resubmitted').length, [queue]);
    const approvedCount = useMemo(() => queue.filter((i) => i.status === 'approved').length, [queue]);
    const rejectedCount = useMemo(() => queue.filter((i) => i.status === 'rejected').length, [queue]);
    const pendingListingCount = useMemo(() => listingQueue.filter((i) => i.status === 'pending').length, [listingQueue]);
    const rejectedListingCount = useMemo(() => listingQueue.filter((i) => i.status === 'rejected').length, [listingQueue]);

    const filteredVerificationQueue = useMemo(() => {
        const q = verificationSearch.trim().toLowerCase();
        return queue
            .filter((item) => {
                // Default queue view should focus on actionable items.
                // Approved records stay available via explicit "approved" filter.
                const matchStatus = verificationStatusFilter === 'all'
                    ? item.status !== 'approved'
                    : item.status === verificationStatusFilter;
                const matchRole = verificationRoleFilter === 'all' || item.role === verificationRoleFilter;
                const hay = [item.profiles?.full_name, item.profiles?.email, item.profiles?.phone, item.company_name, item.role]
                    .filter(Boolean).join(' ').toLowerCase();
                return matchStatus && matchRole && (!q || hay.includes(q));
            })
            .sort((a, b) => {
                if (verificationSort === 'updated_asc') return new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime();
                if (verificationSort === 'reviewed_desc') return new Date(b.reviewed_at || 0).getTime() - new Date(a.reviewed_at || 0).getTime();
                return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime();
            });
    }, [queue, verificationRoleFilter, verificationSearch, verificationSort, verificationStatusFilter]);

    const filteredListingQueue = useMemo(() => {
        const q = listingSearch.trim().toLowerCase();
        return listingQueue
            .filter((item) => {
                const matchStatus = listingStatusFilter === 'all' || item.status === listingStatusFilter;
                const normType = item.type === 'event' ? 'guide' : item.type;
                const matchType = listingTypeFilter === 'all' || normType === listingTypeFilter;
                const hay = [item.title, item.name, item.location, normType, item.sub_category].filter(Boolean).join(' ').toLowerCase();
                return matchStatus && matchType && (!q || hay.includes(q));
            })
            .sort((a, b) => {
                if (listingSort === 'created_asc') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                if (listingSort === 'reviewed_desc') return new Date(b.reviewed_at || 0).getTime() - new Date(a.reviewed_at || 0).getTime();
                return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            });
    }, [listingQueue, listingSearch, listingSort, listingStatusFilter, listingTypeFilter]);

    const filteredMapAccounts = useMemo(() => {
        const query = mapSearch.trim().toLowerCase();

        return [...accountLocations]
            .filter((account) => {
                const roleGroup = getAccountRoleGroup(account.role);
                const matchesRole = mapRoleFilter === 'all' || roleGroup === mapRoleFilter;
                const haystack = [
                    account.full_name,
                    account.email,
                    account.role,
                    account.city,
                    account.country,
                ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();

                return matchesRole && (!query || haystack.includes(query));
            })
            .sort((left, right) => {
                const leftTime = new Date(left.created_at || 0).getTime();
                const rightTime = new Date(right.created_at || 0).getTime();
                return rightTime - leftTime;
            });
    }, [accountLocations, mapRoleFilter, mapSearch]);

    const handleReview = async (item: VerificationRecord, decision: 'approved' | 'rejected') => {
        setBusyId(item.id);
        try {
            await reviewVerificationApplication(item, decision, {
                reviewerId: user?.id,
                reason: decision === 'rejected' ? verificationRejectReason[item.id]?.trim() : undefined,
            });
            await loadQueue();
            setVerificationRejectReason((c) => ({ ...c, [item.id]: '' }));
        } catch (err) {
            console.error(`Failed to ${decision}:`, err);
            alert(`Failed to mark application as ${decision}.`);
        } finally {
            setBusyId(null);
        }
    };

    const handleListingReview = async (listingId: string, decision: 'live' | 'rejected') => {
        setBusyId(listingId);
        try {
            await reviewListing(listingId, decision, {
                reviewerId: user?.id,
                reason: decision === 'rejected' ? listingRejectReason[listingId]?.trim() : undefined,
            });
            await loadQueue();
            setListingRejectReason((c) => ({ ...c, [listingId]: '' }));
        } catch (err) {
            console.error(`Failed to ${decision}:`, err);
            alert(`Failed to mark listing as ${decision}.`);
        } finally {
            setBusyId(null);
        }
    };

    const toggleVerificationSelection = (id: string) =>
        setSelectedVerificationIds((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);

    const toggleListingSelection = (id: string) =>
        setSelectedListingIds((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);

    const toggleAllVerifications = () => {
        const ids = filteredVerificationQueue.map((i) => i.id);
        const allSelected = ids.length > 0 && ids.every((id) => selectedVerificationIds.includes(id));
        setSelectedVerificationIds(allSelected ? [] : ids);
    };

    const toggleAllListings = () => {
        const ids = filteredListingQueue.map((i) => i.id);
        const allSelected = ids.length > 0 && ids.every((id) => selectedListingIds.includes(id));
        setSelectedListingIds(allSelected ? [] : ids);
    };

    const handleBulkVerificationReview = async (decision: 'approved' | 'rejected') => {
        const items = filteredVerificationQueue.filter((i) => selectedVerificationIds.includes(i.id));
        if (!items.length) return;
        setBulkBusy('verification');
        try {
            for (const item of items) {
                await reviewVerificationApplication(item, decision, {
                    reviewerId: user?.id,
                    reason: decision === 'rejected' ? (bulkVerificationRejectReason.trim() || verificationRejectReason[item.id]?.trim()) : undefined,
                });
            }
            await loadQueue();
            setSelectedVerificationIds([]);
            setBulkVerificationRejectReason('');
        } catch (err) {
            console.error(`Bulk verification ${decision} failed:`, err);
            alert(`Bulk ${decision} failed.`);
        } finally {
            setBulkBusy(null);
        }
    };

    const handleBulkListingReview = async (decision: 'live' | 'rejected') => {
        const items = filteredListingQueue.filter((i) => selectedListingIds.includes(i.id));
        if (!items.length) return;
        setBulkBusy('listing');
        try {
            for (const item of items) {
                await reviewListing(item.id, decision, {
                    reviewerId: user?.id,
                    reason: decision === 'rejected' ? (bulkListingRejectReason.trim() || listingRejectReason[item.id]?.trim()) : undefined,
                });
            }
            await loadQueue();
            setSelectedListingIds([]);
            setBulkListingRejectReason('');
        } catch (err) {
            console.error(`Bulk listing ${decision} failed:`, err);
            alert(`Bulk ${decision} failed.`);
        } finally {
            setBulkBusy(null);
        }
    };

    const resetVerificationControls = () => {
        setVerificationStatusFilter('all');
        setVerificationRoleFilter('all');
        setVerificationSearch('');
        setVerificationSort('updated_desc');
        setSelectedVerificationIds([]);
        setBulkVerificationRejectReason('');
        setBulkConfirmation((c) => (c?.target === 'verification' ? null : c));
    };

    const resetListingControls = () => {
        setListingStatusFilter('all');
        setListingTypeFilter('all');
        setListingSearch('');
        setListingSort('created_desc');
        setSelectedListingIds([]);
        setBulkListingRejectReason('');
        setBulkConfirmation((c) => (c?.target === 'listing' ? null : c));
    };

    const resetMapControls = () => {
        setMapRoleFilter('all');
        setMapSearch('');
    };

    const handleRefresh = async () => {
        await Promise.all([
            loadQueue(),
            activeTab === 'map' ? loadAccountLocations(true) : Promise.resolve(),
        ]);
    };

    const formatAuditAction = (log: ModerationAuditLogRecord) => {
        if (log.entity_type === 'verification') {
            if (log.action === 'approved') return 'Approved provider verification';
            if (log.action === 'rejected') return 'Rejected provider verification';
            return 'Provider verification resubmitted';
        }
        if (log.action === 'published' || log.action === 'live') return 'Listing went live';
        if (log.action === 'approved') return 'Approved listing';
        if (log.action === 'rejected') return 'Rejected listing';
        return 'Listing resubmitted';
    };

    if (loading) return null;
    if (!user || !isAdmin) return <Navigate to="/dashboard" replace />;

    return (
        <main className="ac-page animate-fade">
            <div className="container" style={{ maxWidth: '1180px' }}>

                {/* ── Header ── */}
                <div className="ac-header">
                    <div>
                        <span className="ac-badge"><ShieldCheck size={12} /> Admin Console</span>
                        <h1 className="ac-title">Dashboard</h1>
                        <p className="ac-subtitle">
                            Manage provider verifications, review listings, and monitor moderation activity.
                        </p>
                    </div>
                    <button className="ac-refresh-btn" onClick={() => void handleRefresh()} disabled={fetching || mapFetching}>
                        <RefreshCw size={15} className={fetching || mapFetching ? 'animate-spin' : ''} />
                        {fetching || mapFetching ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                {/* ── Stats ── */}
                <div className="ac-stats">
                    <div className="ac-stat-card">
                        <div className="ac-stat-icon ac-stat-icon--amber"><Clock size={20} /></div>
                        <div>
                            <div className="ac-stat-value">{pendingCount.toString().padStart(2, '0')}</div>
                            <div className="ac-stat-label">Pending</div>
                        </div>
                    </div>
                    <div className="ac-stat-card">
                        <div className="ac-stat-icon ac-stat-icon--green"><CheckCircle2 size={20} /></div>
                        <div>
                            <div className="ac-stat-value">{approvedCount.toString().padStart(2, '0')}</div>
                            <div className="ac-stat-label">Approved</div>
                        </div>
                    </div>
                    <div className="ac-stat-card">
                        <div className="ac-stat-icon ac-stat-icon--red"><XCircle size={20} /></div>
                        <div>
                            <div className="ac-stat-value">{rejectedCount.toString().padStart(2, '0')}</div>
                            <div className="ac-stat-label">Rejected</div>
                        </div>
                    </div>
                    <div className="ac-stat-card">
                        <div className="ac-stat-icon ac-stat-icon--blue"><FileText size={20} /></div>
                        <div>
                            <div className="ac-stat-value">{pendingListingCount.toString().padStart(2, '0')}</div>
                            <div className="ac-stat-label">Pending Listings</div>
                        </div>
                    </div>
                    <div className="ac-stat-card">
                        <div className="ac-stat-icon ac-stat-icon--purple"><Layers size={20} /></div>
                        <div>
                            <div className="ac-stat-value">{rejectedListingCount.toString().padStart(2, '0')}</div>
                            <div className="ac-stat-label">Rejected Listings</div>
                        </div>
                    </div>
                </div>

                {/* ── Tabs ── */}
                <div className="ac-tabs">
                    <button
                        className={`ac-tab${activeTab === 'providers' ? ' ac-tab--active' : ''}`}
                        onClick={() => setActiveTab('providers')}
                    >
                        <Users size={15} />
                        Providers
                        <span className="ac-tab-count">{queue.length}</span>
                    </button>
                    <button
                        className={`ac-tab${activeTab === 'listings' ? ' ac-tab--active' : ''}`}
                        onClick={() => setActiveTab('listings')}
                    >
                        <Layers size={15} />
                        Listings
                        <span className="ac-tab-count">{listingQueue.length}</span>
                    </button>
                    <button
                        className={`ac-tab${activeTab === 'audit' ? ' ac-tab--active' : ''}`}
                        onClick={() => setActiveTab('audit')}
                    >
                        <Activity size={15} />
                        Audit Log
                        <span className="ac-tab-count">{auditLogs.length}</span>
                    </button>
                    <button
                        className={`ac-tab${activeTab === 'map' ? ' ac-tab--active' : ''}`}
                        onClick={() => setActiveTab('map')}
                    >
                        <Globe2 size={15} />
                        Map
                        <span className="ac-tab-count">{accountLocations.length}</span>
                    </button>
                </div>

                {/* ═══════════════════════════════════════
                    TAB: PROVIDERS
                ═══════════════════════════════════════ */}
                {activeTab === 'providers' && (
                    <div>
                        <div className="ac-section-head">
                            <div>
                                <h2 className="ac-section-title">Provider Verification Queue</h2>
                                <p className="ac-section-sub">
                                    Review onboarding requests, approve trusted accounts, reject incomplete applications.
                                </p>
                            </div>
                        </div>

                        {/* Filter bar */}
                        <div className="ac-filter-bar">
                            <div className="ac-filter-group" style={{ minWidth: '180px', flex: 2 }}>
                                <span className="ac-filter-label">Search</span>
                                <input
                                    className="ac-filter-input"
                                    value={verificationSearch}
                                    onChange={(e) => setVerificationSearch(e.target.value)}
                                    placeholder="Name, email, company…"
                                />
                            </div>
                            <div className="ac-filter-group">
                                <span className="ac-filter-label">Status</span>
                                <select
                                    className="ac-filter-select"
                                    value={verificationStatusFilter}
                                    onChange={(e) => setVerificationStatusFilter(e.target.value as typeof verificationStatusFilter)}
                                >
                                    <option value="all">All statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="resubmitted">Resubmitted</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="ac-filter-group">
                                <span className="ac-filter-label">Role</span>
                                <select
                                    className="ac-filter-select"
                                    value={verificationRoleFilter}
                                    onChange={(e) => setVerificationRoleFilter(e.target.value as typeof verificationRoleFilter)}
                                >
                                    <option value="all">All roles</option>
                                    <option value="tour_company">Tour Company</option>
                                    <option value="tour_instructor">Tour Instructor</option>
                                    <option value="tour_guide">Tour Guide</option>
                                </select>
                            </div>
                            <div className="ac-filter-group">
                                <span className="ac-filter-label">Sort</span>
                                <select
                                    className="ac-filter-select"
                                    value={verificationSort}
                                    onChange={(e) => setVerificationSort(e.target.value as typeof verificationSort)}
                                >
                                    <option value="updated_desc">Newest updated</option>
                                    <option value="updated_asc">Oldest updated</option>
                                    <option value="reviewed_desc">Latest reviewed</option>
                                </select>
                            </div>
                            <button className="ac-filter-reset" onClick={resetVerificationControls}>
                                Reset
                            </button>
                        </div>

                        {fetching ? (
                            <div className="ac-loading"><Loader2 className="animate-spin" size={32} /></div>
                        ) : filteredVerificationQueue.length === 0 ? (
                            <div className="ac-empty">
                                <ShieldCheck size={32} />
                                <strong>No records match these filters</strong>
                                <p>Adjust the filters to inspect a different slice of the verification queue.</p>
                            </div>
                        ) : (
                            <>
                                {/* Bulk bar */}
                                <div className="ac-bulk-bar">
                                    <div className="ac-bulk-left">
                                        <label className="ac-select-all-label">
                                            <input
                                                type="checkbox"
                                                checked={filteredVerificationQueue.length > 0 && filteredVerificationQueue.every((i) => selectedVerificationIds.includes(i.id))}
                                                onChange={toggleAllVerifications}
                                            />
                                            Select visible
                                        </label>
                                        <span className="ac-bulk-count">{selectedVerificationIds.length} selected</span>
                                    </div>
                                    <div className="ac-bulk-actions">
                                        <button
                                            className="ac-btn ac-btn--approve"
                                            disabled={selectedVerificationIds.length === 0 || bulkBusy === 'verification'}
                                            onClick={() => void handleBulkVerificationReview('approved')}
                                        >
                                            {bulkBusy === 'verification' ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                            Approve ({selectedVerificationIds.length})
                                        </button>
                                        <button
                                            className="ac-btn ac-btn--reject"
                                            disabled={selectedVerificationIds.length === 0 || bulkBusy === 'verification'}
                                            onClick={() => {
                                                if (filteredVerificationQueue.filter((i) => selectedVerificationIds.includes(i.id)).length)
                                                    setBulkConfirmation({ target: 'verification', count: selectedVerificationIds.length });
                                            }}
                                        >
                                            <XCircle size={14} />
                                            Reject ({selectedVerificationIds.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Bulk rejection confirmation */}
                                {bulkConfirmation?.target === 'verification' && (
                                    <div className="ac-confirm-banner">
                                        <div>
                                            <p className="ac-confirm-title">Confirm bulk rejection</p>
                                            <p className="ac-confirm-desc">
                                                Rejecting {bulkConfirmation.count} provider application{bulkConfirmation.count === 1 ? '' : 's'}.
                                                {bulkVerificationRejectReason.trim() ? ' Shared reason will be applied.' : ' Per-record reasons used if available.'}
                                            </p>
                                        </div>
                                        <div className="ac-confirm-actions">
                                            <button className="ac-btn ac-btn--soft" disabled={bulkBusy === 'verification'} onClick={() => setBulkConfirmation(null)}>
                                                Cancel
                                            </button>
                                            <button
                                                className="ac-btn ac-btn--danger"
                                                disabled={bulkBusy === 'verification'}
                                                onClick={async () => {
                                                    await handleBulkVerificationReview('rejected');
                                                    setBulkConfirmation(null);
                                                }}
                                            >
                                                {bulkBusy === 'verification' ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                                Confirm Reject ({bulkConfirmation.count})
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Shared bulk reason */}
                                <div className="ac-bulk-reason">
                                    <span className="ac-bulk-reason-label">Shared bulk reject reason (optional)</span>
                                    <textarea
                                        className="ac-bulk-reason-textarea"
                                        value={bulkVerificationRejectReason}
                                        onChange={(e) => setBulkVerificationRejectReason(e.target.value)}
                                        placeholder="Optional shared reason applied to all selected rejections."
                                    />
                                </div>

                                {/* Queue items */}
                                <div className="ac-queue">
                                    {filteredVerificationQueue.map((item) => {
                                        const isBusy = busyId === item.id;
                                        const profile = item.profiles;
                                        return (
                                            <article key={item.id} className="ac-queue-card">
                                                <div className="ac-queue-card-top">
                                                    <div className="ac-queue-card-identity">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedVerificationIds.includes(item.id)}
                                                            onChange={() => toggleVerificationSelection(item.id)}
                                                        />
                                                        <img
                                                            className="ac-applicant-avatar"
                                                            src={getProfileAvatarUrl(profile?.profile_image_url, item.user_id, profile?.full_name, profile?.email)}
                                                            alt={profile?.full_name || profile?.email || 'Applicant'}
                                                        />
                                                        <div>
                                                            <div className="ac-applicant-pills">
                                                                <span className="ac-pill ac-pill--role">{getRoleLabel(item.role)}</span>
                                                                <span className={statusPillClass(item.status)}>{item.status || 'pending'}</span>
                                                            </div>
                                                            <p className="ac-applicant-name">{profile?.full_name || 'Unnamed applicant'}</p>
                                                            <p className="ac-applicant-contact">
                                                                {profile?.email || 'No email'}
                                                                {profile?.phone ? ` · ${profile.phone}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="ac-queue-card-actions">
                                                        <button
                                                            className="ac-btn ac-btn--approve"
                                                            disabled={isBusy || item.status === 'approved'}
                                                            onClick={() => void handleReview(item, 'approved')}
                                                        >
                                                            {isBusy ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                                            Approve
                                                        </button>
                                                        <button
                                                            className="ac-btn ac-btn--reject"
                                                            disabled={isBusy || item.status === 'rejected'}
                                                            onClick={() => void handleReview(item, 'rejected')}
                                                        >
                                                            {isBusy ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className={`ac-detail-grid ac-detail-grid--3`}>
                                                    <div className="ac-detail-cell">
                                                        <span className="ac-detail-key">Company</span>
                                                        <span className="ac-detail-val">{item.company_name || profile?.company_name || 'Independent'}</span>
                                                    </div>
                                                    <div className="ac-detail-cell">
                                                        <span className="ac-detail-key">Location</span>
                                                        <span className="ac-detail-val">{[profile?.city, profile?.country].filter(Boolean).join(', ') || 'Not provided'}</span>
                                                    </div>
                                                    <div className="ac-detail-cell">
                                                        <span className="ac-detail-key">Experience</span>
                                                        <span className="ac-detail-val">{item.years_experience ? `${item.years_experience} years` : 'Not provided'}</span>
                                                    </div>
                                                </div>

                                                <div className={`ac-detail-grid ac-detail-grid--2`} style={{ marginTop: '10px' }}>
                                                    <div className="ac-detail-cell">
                                                        <span className="ac-detail-key">Verification refs</span>
                                                        <span className="ac-detail-val">{item.government_id_ref || item.license_number || item.certificate_id || 'Not provided'}</span>
                                                    </div>
                                                    <div className="ac-detail-cell">
                                                        <span className="ac-detail-key">Works under company</span>
                                                        <span className="ac-detail-val">{item.works_under_company ? 'Yes' : 'No'}</span>
                                                    </div>
                                                </div>

                                                <div className="ac-bio-cell">
                                                    <span className="ac-detail-key">Bio / summary</span>
                                                    <p>{item.bio || profile?.bio || 'No summary provided.'}</p>
                                                </div>

                                                <div className="ac-reject-reason">
                                                    <span className="ac-reject-reason-label">Reject reason for provider</span>
                                                    <textarea
                                                        className="ac-reject-textarea"
                                                        value={verificationRejectReason[item.id] || ''}
                                                        onChange={(e) => setVerificationRejectReason((c) => ({ ...c, [item.id]: e.target.value }))}
                                                        placeholder="Explain what the provider needs to fix before resubmission."
                                                    />
                                                    {item.rejection_reason && (
                                                        <p className="ac-reject-current">Current reason: {item.rejection_reason}</p>
                                                    )}
                                                </div>

                                                {item.reviewed_at && (
                                                    <p className="ac-last-reviewed">
                                                        Last reviewed {new Date(item.reviewed_at).toLocaleDateString()}
                                                    </p>
                                                )}

                                                {item.status === 'rejected' && (
                                                    <div className="ac-rejected-note">
                                                        <ShieldAlert size={16} />
                                                        Rejected applicants can resubmit from their account after addressing the review reason.
                                                    </div>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════
                    TAB: LISTINGS
                ═══════════════════════════════════════ */}
                {activeTab === 'listings' && (
                    <div>
                        <div className="ac-section-head">
                            <div>
                                <h2 className="ac-section-title">Listing Review Queue</h2>
                                <p className="ac-section-sub">
                                    Review and approve provider listings before they go live.
                                </p>
                            </div>
                        </div>

                        {/* Filter bar */}
                        <div className="ac-filter-bar">
                            <div className="ac-filter-group" style={{ minWidth: '180px', flex: 2 }}>
                                <span className="ac-filter-label">Search</span>
                                <input
                                    className="ac-filter-input"
                                    value={listingSearch}
                                    onChange={(e) => setListingSearch(e.target.value)}
                                    placeholder="Title, location, type…"
                                />
                            </div>
                            <div className="ac-filter-group">
                                <span className="ac-filter-label">Status</span>
                                <select
                                    className="ac-filter-select"
                                    value={listingStatusFilter}
                                    onChange={(e) => setListingStatusFilter(e.target.value as typeof listingStatusFilter)}
                                >
                                    <option value="all">All statuses</option>
                                    <option value="pending">Pending</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                            </div>
                            <div className="ac-filter-group">
                                <span className="ac-filter-label">Type</span>
                                <select
                                    className="ac-filter-select"
                                    value={listingTypeFilter}
                                    onChange={(e) => setListingTypeFilter(e.target.value as typeof listingTypeFilter)}
                                >
                                    <option value="all">All types</option>
                                    <option value="tour">{LISTING_LABELS.tour}</option>
                                    <option value="activity">{LISTING_LABELS.activity}</option>
                                    <option value="guide">{LISTING_LABELS.guide}</option>
                                </select>
                            </div>
                            <div className="ac-filter-group">
                                <span className="ac-filter-label">Sort</span>
                                <select
                                    className="ac-filter-select"
                                    value={listingSort}
                                    onChange={(e) => setListingSort(e.target.value as typeof listingSort)}
                                >
                                    <option value="created_desc">Newest</option>
                                    <option value="created_asc">Oldest</option>
                                    <option value="reviewed_desc">Latest reviewed</option>
                                </select>
                            </div>
                            <button className="ac-filter-reset" onClick={resetListingControls}>Reset</button>
                        </div>

                        {fetching ? (
                            <div className="ac-loading"><Loader2 className="animate-spin" size={32} /></div>
                        ) : filteredListingQueue.length === 0 ? (
                            <div className="ac-empty">
                                <CheckCircle2 size={32} />
                                <strong>No listings match these filters</strong>
                                <p>New submissions will appear here for moderation.</p>
                            </div>
                        ) : (
                            <>
                                {/* Bulk bar */}
                                <div className="ac-bulk-bar">
                                    <div className="ac-bulk-left">
                                        <label className="ac-select-all-label">
                                            <input
                                                type="checkbox"
                                                checked={filteredListingQueue.length > 0 && filteredListingQueue.every((i) => selectedListingIds.includes(i.id))}
                                                onChange={toggleAllListings}
                                            />
                                            Select visible
                                        </label>
                                        <span className="ac-bulk-count">{selectedListingIds.length} selected</span>
                                    </div>
                                    <div className="ac-bulk-actions">
                                        <button
                                            className="ac-btn ac-btn--approve"
                                            disabled={selectedListingIds.length === 0 || bulkBusy === 'listing'}
                                            onClick={() => void handleBulkListingReview('live')}
                                        >
                                            {bulkBusy === 'listing' ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                            Approve & Go Live ({selectedListingIds.length})
                                        </button>
                                        <button
                                            className="ac-btn ac-btn--reject"
                                            disabled={selectedListingIds.length === 0 || bulkBusy === 'listing'}
                                            onClick={() => {
                                                if (filteredListingQueue.filter((i) => selectedListingIds.includes(i.id)).length)
                                                    setBulkConfirmation({ target: 'listing', count: selectedListingIds.length });
                                            }}
                                        >
                                            <XCircle size={14} />
                                            Reject ({selectedListingIds.length})
                                        </button>
                                    </div>
                                </div>

                                {/* Bulk rejection confirmation */}
                                {bulkConfirmation?.target === 'listing' && (
                                    <div className="ac-confirm-banner">
                                        <div>
                                            <p className="ac-confirm-title">Confirm bulk rejection</p>
                                            <p className="ac-confirm-desc">
                                                Rejecting {bulkConfirmation.count} listing{bulkConfirmation.count === 1 ? '' : 's'}.
                                                {bulkListingRejectReason.trim() ? ' Shared reason will be applied.' : ' Per-record reasons used if available.'}
                                            </p>
                                        </div>
                                        <div className="ac-confirm-actions">
                                            <button className="ac-btn ac-btn--soft" disabled={bulkBusy === 'listing'} onClick={() => setBulkConfirmation(null)}>
                                                Cancel
                                            </button>
                                            <button
                                                className="ac-btn ac-btn--danger"
                                                disabled={bulkBusy === 'listing'}
                                                onClick={async () => {
                                                    await handleBulkListingReview('rejected');
                                                    setBulkConfirmation(null);
                                                }}
                                            >
                                                {bulkBusy === 'listing' ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                                Confirm Reject ({bulkConfirmation.count})
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Shared bulk reason */}
                                <div className="ac-bulk-reason">
                                    <span className="ac-bulk-reason-label">Shared bulk reject reason (optional)</span>
                                    <textarea
                                        className="ac-bulk-reason-textarea"
                                        value={bulkListingRejectReason}
                                        onChange={(e) => setBulkListingRejectReason(e.target.value)}
                                        placeholder="Optional shared reason applied to all selected listing rejections."
                                    />
                                </div>

                                {/* Listing queue items */}
                                <div className="ac-queue">
                                    {filteredListingQueue.map((listing) => {
                                        const isBusy = busyId === listing.id;
                                        const normType = ((listing.type === 'event' ? 'guide' : listing.type) as 'tour' | 'activity' | 'guide');
                                        return (
                                            <article key={listing.id} className="ac-queue-card">
                                                <div className="ac-queue-card-top">
                                                    <div className="ac-queue-card-identity">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedListingIds.includes(listing.id)}
                                                            onChange={() => toggleListingSelection(listing.id)}
                                                        />
                                                        <div>
                                                            <div className="ac-applicant-pills">
                                                                <span className="ac-pill ac-pill--role">{LISTING_LABELS[normType] || 'Listing'}</span>
                                                                <span className={statusPillClass(listing.status)}>{getListingStatusLabel(listing.status)}</span>
                                                            </div>
                                                            <p className="ac-applicant-name">{listing.title || listing.name || 'Untitled listing'}</p>
                                                            <p className="ac-applicant-contact">
                                                                {listing.location || 'No location'}
                                                                {typeof listing.price === 'number' ? ` · Rs ${listing.price.toLocaleString()}` : ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="ac-queue-card-actions">
                                                        <button
                                                            className="ac-btn ac-btn--approve"
                                                            disabled={isBusy || listing.status === 'live' || listing.status === 'published'}
                                                            onClick={() => void handleListingReview(listing.id, 'live')}
                                                        >
                                                            {isBusy ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                                                            Approve & Go Live
                                                        </button>
                                                        <button
                                                            className="ac-btn ac-btn--reject"
                                                            disabled={isBusy || listing.status === 'rejected'}
                                                            onClick={() => void handleListingReview(listing.id, 'rejected')}
                                                        >
                                                            {isBusy ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="ac-bio-cell">
                                                    <span className="ac-detail-key">Description</span>
                                                    <p>{listing.description || 'No description provided.'}</p>
                                                </div>

                                                <div className="ac-reject-reason">
                                                    <span className="ac-reject-reason-label">Reject reason for provider</span>
                                                    <textarea
                                                        className="ac-reject-textarea"
                                                        value={listingRejectReason[listing.id] || ''}
                                                        onChange={(e) => setListingRejectReason((c) => ({ ...c, [listing.id]: e.target.value }))}
                                                        placeholder="Explain what needs to change before this listing can be published."
                                                    />
                                                    {listing.rejection_reason && (
                                                        <p className="ac-reject-current">Current reason: {listing.rejection_reason}</p>
                                                    )}
                                                </div>

                                                {listing.reviewed_at && (
                                                    <p className="ac-last-reviewed">
                                                        Last reviewed {new Date(listing.reviewed_at).toLocaleDateString()}
                                                    </p>
                                                )}
                                            </article>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════
                    TAB: MAP
                ═══════════════════════════════════════ */}
                {activeTab === 'map' && (
                    <div>
                        <div className="ac-section-head">
                            <div>
                                <h2 className="ac-section-title">Account Geography</h2>
                                <p className="ac-section-sub">
                                    Explore where tourist and provider accounts are based, then open each profile directly from the globe.
                                </p>
                            </div>
                        </div>

                        <div className="ac-filter-bar">
                            <div className="ac-filter-group" style={{ minWidth: '220px', flex: 2 }}>
                                <span className="ac-filter-label">Search</span>
                                <input
                                    className="ac-filter-input"
                                    value={mapSearch}
                                    onChange={(e) => setMapSearch(e.target.value)}
                                    placeholder="Name, email, city, country..."
                                />
                            </div>
                            <div className="ac-filter-group" style={{ minWidth: '180px' }}>
                                <span className="ac-filter-label">Role</span>
                                <select
                                    className="ac-filter-select"
                                    value={mapRoleFilter}
                                    onChange={(e) => setMapRoleFilter(e.target.value as typeof mapRoleFilter)}
                                >
                                    <option value="all">All roles</option>
                                    <option value="tourist">Tourists</option>
                                    <option value="provider">Providers</option>
                                    <option value="admin">Admins</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <button className="ac-filter-reset" onClick={resetMapControls}>Reset</button>
                        </div>

                        {mapFetching && !mapLoaded ? (
                            <div className="ac-loading"><Loader2 className="animate-spin" size={32} /></div>
                        ) : filteredMapAccounts.length === 0 ? (
                            <div className="ac-empty">
                                <Globe2 size={32} />
                                <strong>No accounts match these map filters</strong>
                                <p>Widen the role filter or search term. Profiles without country data will stay in the unmapped list inside the panel.</p>
                            </div>
                        ) : (
                            <Suspense fallback={<div className="ac-loading"><Loader2 className="animate-spin" size={32} /></div>}>
                                <LazyAdminAccountMap accounts={filteredMapAccounts} />
                            </Suspense>
                        )}
                    </div>
                )}

                {/* ═══════════════════════════════════════
                    TAB: AUDIT LOG
                ═══════════════════════════════════════ */}
                {activeTab === 'audit' && (
                    <div>
                        <div className="ac-section-head">
                            <div>
                                <h2 className="ac-section-title">Audit Trail</h2>
                                <p className="ac-section-sub">
                                    {auditLogs.length} recent moderation action{auditLogs.length === 1 ? '' : 's'}
                                </p>
                            </div>
                        </div>

                        {fetching ? (
                            <div className="ac-loading"><Loader2 className="animate-spin" size={32} /></div>
                        ) : auditLogs.length === 0 ? (
                            <div className="ac-empty">
                                <Activity size={32} />
                                <strong>No audit records yet</strong>
                                <p>Apply the SQL migration for moderation_audit_logs, then approval, rejection, and resubmission events will appear here.</p>
                            </div>
                        ) : (
                            <div className="ac-audit-list">
                                {auditLogs.map((log) => (
                                    <article key={log.id} className="ac-audit-row">
                                        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                                            <div className="ac-audit-action">{formatAuditAction(log)}</div>
                                            <div className="ac-audit-pills">
                                                <span
                                                    className="ac-pill"
                                                    style={{
                                                        background: log.entity_type === 'verification' ? 'rgba(162,75,24,0.1)' : 'rgba(37,99,235,0.1)',
                                                        color: log.entity_type === 'verification' ? 'var(--accent)' : '#1d4ed8',
                                                    }}
                                                >
                                                    {log.entity_type}
                                                </span>
                                                <span className="ac-pill" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-light)', color: 'var(--text-muted)' }}>
                                                    {log.action}
                                                </span>
                                            </div>
                                            <p className="ac-audit-meta">
                                                Record {log.entity_id}
                                                {log.target_user_id ? ` · target ${log.target_user_id}` : ''}
                                                {log.actor_user_id ? ` · actor ${log.actor_user_id}` : ''}
                                            </p>
                                            {log.reason && <p className="ac-audit-reason">Reason: {log.reason}</p>}
                                        </div>
                                        <div className="ac-audit-time">
                                            <div className="ac-audit-date">
                                                {log.created_at ? new Date(log.created_at).toLocaleDateString() : 'Unknown'}
                                            </div>
                                            <div className="ac-audit-clock">
                                                {log.created_at ? new Date(log.created_at).toLocaleTimeString() : ''}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </main>
    );
};
