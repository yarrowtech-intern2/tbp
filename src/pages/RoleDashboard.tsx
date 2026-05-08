import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import {
    BadgeDollarSign,
    CheckCircle2,
    ClipboardList,
    Clock3,
    Compass,
    FileText,
    Globe2,
    Heart,
    LayoutDashboard,
    Loader2,
    MessageSquare,
    Package,
    Search,
    Shield,
    TrendingUp,
    Users,
    XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
    getAdminAccountLocations,
    getBookings,
    getContentModerationQueue,
    getConversations,
    getFavoriteListings,
    getModerationAuditLogs,
    getMyPosts,
    getNotifications,
    getPosts,
    getProviderBookings,
    getVerificationQueue,
    type AdminAccountLocationRecord,
    type AppNotificationRecord,
    type ConversationRecord,
    type FavoriteListingRecord,
    type ModerationAuditLogRecord,
    type PostRecord,
    type UnifiedBooking,
    type VerificationRecord,
} from '../lib/destinations';
import { isProviderRole, normalizeRoleValue } from '../lib/platform';
import './role-dashboard.css';

type DashboardRole = 'tourist' | 'provider' | 'admin';

type SidebarKey =
    | 'overview'
    | 'explore'
    | 'bookings'
    | 'favorites'
    | 'listings'
    | 'manage_posts'
    | 'messages'
    | 'moderation'
    | 'rejected'
    | 'users'
    | 'map'
    | 'audits';

type AdminProfileRow = {
    id: string;
    role?: string | null;
    full_name?: string | null;
    email?: string | null;
    created_at?: string | null;
};

type NavItem = {
    key: SidebarKey;
    label: string;
    icon: React.ElementType;
};

const LIVE_STATUSES = new Set(['live', 'published', 'approved']);

const normalizeRoleParam = (value?: string): DashboardRole | null => {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    if (v === 'tourist') return 'tourist';
    if (v === 'provider' || v === 'vendor') return 'provider';
    if (v === 'admin') return 'admin';
    return null;
};

const effectiveRoleFromProfile = (role?: string | null): DashboardRole => {
    const normalizedRole = normalizeRoleValue(role);
    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'provider' || normalizedRole === 'vendor') return 'provider';
    if (isProviderRole(normalizedRole)) return 'provider';
    return 'tourist';
};

const formatCurrency = (value: number) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
}).format(value);

const formatDate = (value?: string | null) => {
    if (!value) return 'N/A';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return 'N/A';
    return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (value?: string | null) => {
    if (!value) return 'Just now';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return 'Just now';
    return dt.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const titleForPost = (item: PostRecord) => item.title || item.name || 'Untitled listing';
const toListingPathType = (type: string | null | undefined): 'tour' | 'activity' | 'event' => {
    if (type === 'tour') return 'tour';
    if (type === 'guide' || type === 'event') return 'event';
    return 'activity';
};

const sectionMeta: Record<SidebarKey, { title: string; subtitle: string }> = {
    overview: { title: 'Dashboard', subtitle: 'Your role-based operational summary.' },
    explore: { title: 'Explore', subtitle: 'Suggested items and quick jump context.' },
    bookings: { title: 'Bookings', subtitle: 'Booking records and status timelines.' },
    favorites: { title: 'Favorites', subtitle: 'Saved listings from your activity.' },
    listings: { title: 'Listings', subtitle: 'Provider listing lifecycle and publication state.' },
    manage_posts: { title: 'Manage Posts', subtitle: 'Create, edit, and monitor your listing submissions.' },
    messages: { title: 'Messages', subtitle: 'Conversation and notification overview.' },
    moderation: { title: 'Moderation', subtitle: 'Queue and verification decisions.' },
    rejected: { title: 'Rejected', subtitle: 'Listings removed from the active moderation queue.' },
    users: { title: 'Users', subtitle: 'Platform user distribution and recent profiles.' },
    map: { title: 'Map', subtitle: 'Account geography and role-based location visibility.' },
    audits: { title: 'Audit Logs', subtitle: 'Recent administrative actions on platform entities.' },
};

const LazyAdminAccountMap = lazy(async () => {
    const module = await import('../components/admin/AdminAccountMap');
    return { default: module.AdminAccountMap };
});

export const RoleDashboard: React.FC = () => {
    const { user, profile, profileLoading } = useAuth();
    const { role: roleParam } = useParams();
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [activeSection, setActiveSection] = useState<SidebarKey>('overview');
    const [isDesktopDashboard, setIsDesktopDashboard] = useState(
        typeof window === 'undefined' ? true : window.innerWidth >= 700,
    );

    const routeRole = normalizeRoleParam(roleParam);
    const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const effectiveRole = useMemo(
        () => effectiveRoleFromProfile(profile?.role || metadataRole),
        [metadataRole, profile?.role],
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

    const [touristBookings, setTouristBookings] = useState<UnifiedBooking[]>([]);
    const [touristFavorites, setTouristFavorites] = useState<FavoriteListingRecord[]>([]);
    const [touristConversations, setTouristConversations] = useState<ConversationRecord[]>([]);
    const [touristNotifications, setTouristNotifications] = useState<AppNotificationRecord[]>([]);

    const [providerListings, setProviderListings] = useState<PostRecord[]>([]);
    const [providerBookings, setProviderBookings] = useState<UnifiedBooking[]>([]);
    const [providerConversations, setProviderConversations] = useState<ConversationRecord[]>([]);
    const [providerNotifications, setProviderNotifications] = useState<AppNotificationRecord[]>([]);

    const [adminPublishedPosts, setAdminPublishedPosts] = useState<PostRecord[]>([]);
    const [adminQueuePosts, setAdminQueuePosts] = useState<PostRecord[]>([]);
    const [adminVerifications, setAdminVerifications] = useState<VerificationRecord[]>([]);
    const [adminAuditLogs, setAdminAuditLogs] = useState<ModerationAuditLogRecord[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminProfileRow[]>([]);
    const [adminAccountLocations, setAdminAccountLocations] = useState<AdminAccountLocationRecord[]>([]);
    const [selectedModerationId, setSelectedModerationId] = useState<string | null>(null);
    const [selectedRejectedId, setSelectedRejectedId] = useState<string | null>(null);
    const [mapFetching, setMapFetching] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [providerBookingStatusFilter, setProviderBookingStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled'>('all');
    const [providerPaymentStatusFilter, setProviderPaymentStatusFilter] = useState<'all' | 'pending' | 'paid' | 'refunded'>('all');
    const [providerPackageTypeFilter, setProviderPackageTypeFilter] = useState<'all' | 'tour' | 'activity' | 'guide'>('all');
    const [providerBookingDateFrom, setProviderBookingDateFrom] = useState('');
    const [providerBookingDateTo, setProviderBookingDateTo] = useState('');

    useEffect(() => {
        const media = window.matchMedia('(min-width: 700px)');
        const sync = (event?: MediaQueryListEvent) => {
            setIsDesktopDashboard(event ? event.matches : media.matches);
        };

        sync();
        media.addEventListener('change', sync);
        return () => media.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        if (!user || profileLoading) return;
        if (!routeRole || routeRole !== effectiveRole) {
            navigate(`/dashboard/${effectiveRole}`, { replace: true });
        }
    }, [effectiveRole, navigate, profileLoading, routeRole, user]);

    useEffect(() => {
        if (effectiveRole === 'admin' && !isDesktopDashboard && activeSection === 'map') {
            setActiveSection('overview');
        }
    }, [activeSection, effectiveRole, isDesktopDashboard]);

    useEffect(() => {
        if (effectiveRole === 'admin') {
            setActiveSection('overview');
            return;
        }
        if (effectiveRole === 'provider') {
            setActiveSection('overview');
            return;
        }
        setActiveSection('bookings');
    }, [effectiveRole]);

    const loadAdminAccountLocations = async (force = false) => {
        if (effectiveRole !== 'admin') return;
        if (mapFetching) return;
        if (mapLoaded && !force) return;

        setMapFetching(true);
        try {
            const accounts = await getAdminAccountLocations();
            setAdminAccountLocations(accounts);
            setMapLoaded(true);
        } finally {
            setMapFetching(false);
        }
    };

    useEffect(() => {
        if (!user || profileLoading) return;
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                if (effectiveRole === 'tourist') {
                    const [bookings, favorites, conversations, notifications] = await Promise.all([
                        getBookings(user.id),
                        getFavoriteListings(user.id),
                        getConversations(user.id),
                        getNotifications(user.id, 50),
                    ]);
                    if (cancelled) return;
                    setTouristBookings(bookings);
                    setTouristFavorites(favorites);
                    setTouristConversations(conversations);
                    setTouristNotifications(notifications);
                }

                if (effectiveRole === 'provider') {
                    const [listings, bookings, conversations, notifications] = await Promise.all([
                        getMyPosts(user.id),
                        getProviderBookings(user.id),
                        getConversations(user.id),
                        getNotifications(user.id, 50),
                    ]);
                    if (cancelled) return;
                    setProviderListings(listings);
                    setProviderBookings(bookings);
                    setProviderConversations(conversations);
                    setProviderNotifications(notifications);
                }

                if (effectiveRole === 'admin') {
                    const [posts, queuePosts, verifications, audits, usersResult] = await Promise.all([
                        getPosts(),
                        getContentModerationQueue(),
                        getVerificationQueue(),
                        getModerationAuditLogs(),
                        supabase
                            .from('profiles')
                            .select('id, role, full_name, email, created_at')
                            .order('created_at', { ascending: false })
                            .limit(5000),
                    ]);
                    if (cancelled) return;
                    setAdminPublishedPosts(posts);
                    setAdminQueuePosts(queuePosts);
                    setAdminVerifications(verifications);
                    setAdminAuditLogs(audits);
                    setAdminUsers(usersResult.error ? [] : (usersResult.data as AdminProfileRow[] || []));
                }
                if (!cancelled) setLastLoadedAt(new Date().toISOString());
            } catch (err: unknown) {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void run();
        return () => {
            cancelled = true;
        };
    }, [effectiveRole, profileLoading, user]);

    useEffect(() => {
        if (effectiveRole !== 'admin' || activeSection !== 'map') return;
        void loadAdminAccountLocations();
    }, [activeSection, effectiveRole]);

    const navItems: NavItem[] = useMemo(() => {
        if (effectiveRole === 'admin') {
            return [
                { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
                { key: 'moderation', label: 'Moderation', icon: Shield },
                { key: 'rejected', label: 'Rejected', icon: XCircle },
                { key: 'users', label: 'Users', icon: Users },
                { key: 'map', label: 'Map', icon: Globe2 },
                { key: 'audits', label: 'Audit Logs', icon: FileText },
            ];
        }
        if (effectiveRole === 'provider') {
            return [
                { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                { key: 'bookings', label: 'Bookings', icon: ClipboardList },
                { key: 'listings', label: 'Listings', icon: Package },
                { key: 'manage_posts', label: 'Manage Posts', icon: FileText },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
            ];
        }
        return [
            { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'explore', label: 'Explore', icon: Compass },
            { key: 'bookings', label: 'Bookings', icon: ClipboardList },
            { key: 'messages', label: 'Messages', icon: MessageSquare },
            { key: 'favorites', label: 'Favorites', icon: Heart },
        ];
    }, [effectiveRole]);

    const mobileNavItems = useMemo(
        () => (effectiveRole === 'admin' ? navItems.filter((item) => item.key !== 'map') : navItems),
        [effectiveRole, navItems],
    );

    const query = search.trim().toLowerCase();

    const touristMetrics = useMemo(() => {
        const completed = touristBookings.filter((item) => item.status === 'completed').length;
        const upcoming = touristBookings.filter((item) => {
            if (item.status !== 'pending' && item.status !== 'confirmed') return false;
            if (!item.booking_date) return true;
            return new Date(item.booking_date).getTime() >= Date.now() - 86400000;
        }).length;
        const spend = touristBookings
            .filter((item) => item.status !== 'cancelled')
            .reduce((sum, item) => sum + (item.total_price || 0), 0);

        return {
            completed,
            upcoming,
            spend,
            reviewable: completed,
        };
    }, [touristBookings]);

    const providerMetrics = useMemo(() => {
        const pending = providerListings.filter((item) => item.status === 'pending').length;
        const live = providerListings.filter((item) => LIVE_STATUSES.has((item.status || '').toLowerCase())).length;
        const revenue = providerBookings
            .filter((item) => item.status !== 'cancelled')
            .reduce((sum, item) => sum + (item.total_price || 0), 0);
        const rejected = providerListings.filter((item) => item.status === 'rejected').length;
        return { pending, live, revenue, rejected };
    }, [providerBookings, providerListings]);

    const adminMetrics = useMemo(() => {
        const packageIds = new Set<string>();
        for (const p of adminPublishedPosts) if (p.id) packageIds.add(p.id);
        for (const p of adminQueuePosts) if (p.id) packageIds.add(p.id);

        let adminCount = 0;
        let providerCount = 0;
        let touristCount = 0;
        for (const row of adminUsers) {
            if (row.role === 'admin') adminCount += 1;
            else if (isProviderRole(row.role || null)) providerCount += 1;
            else touristCount += 1;
        }

        const pendingPosts = adminQueuePosts.filter((item) => item.status === 'pending').length;
        const rejectedPosts = adminQueuePosts.filter((item) => item.status === 'rejected').length;
        const approvedPosts = adminQueuePosts.filter((item) => item.status === 'approved').length + adminPublishedPosts.length;

        return {
            totalPackages: packageIds.size,
            totalUsers: adminUsers.length,
            adminCount,
            providerCount,
            touristCount,
            pendingPosts,
            rejectedPosts,
            approvedPosts,
            pendingVerifications: adminVerifications.filter((v) => v.status === 'pending' || v.status === 'resubmitted').length,
        };
    }, [adminPublishedPosts, adminQueuePosts, adminUsers, adminVerifications]);

    const touristRows = touristBookings
        .filter((item) => !query || `${item.listing_title || ''} ${item.status || ''}`.toLowerCase().includes(query));

    const favoriteRows = touristFavorites
        .filter((item) => !query || `${item.title || ''} ${item.location || ''} ${item.listing_type || ''}`.toLowerCase().includes(query));

    const providerRows = providerListings
        .filter((item) => !query || `${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const providerBookingRows = providerBookings
        .filter((item) => !query || `${item.listing_title || ''} ${item.status || ''} ${item.traveler_name || ''} ${item.traveler_email || ''} ${item.traveler_phone || ''}`.toLowerCase().includes(query));

    const providerBookingFilteredRows = useMemo(() => {
        const fromTime = providerBookingDateFrom ? new Date(`${providerBookingDateFrom}T00:00:00`).getTime() : null;
        const toTime = providerBookingDateTo ? new Date(`${providerBookingDateTo}T23:59:59`).getTime() : null;

        return providerBookingRows.filter((item) => {
            if (providerBookingStatusFilter !== 'all' && (item.status || '').toLowerCase() !== providerBookingStatusFilter) return false;
            if (providerPaymentStatusFilter !== 'all' && (item.payment_status || 'pending').toLowerCase() !== providerPaymentStatusFilter) return false;
            if (providerPackageTypeFilter !== 'all' && (item.listing_type || '').toLowerCase() !== providerPackageTypeFilter) return false;

            if (fromTime !== null || toTime !== null) {
                const sourceDate = item.booking_date || item.created_at;
                const valueTime = sourceDate ? new Date(sourceDate).getTime() : Number.NaN;
                if (Number.isNaN(valueTime)) return false;
                if (fromTime !== null && valueTime < fromTime) return false;
                if (toTime !== null && valueTime > toTime) return false;
            }
            return true;
        });
    }, [
        providerBookingDateFrom,
        providerBookingDateTo,
        providerBookingRows,
        providerBookingStatusFilter,
        providerPackageTypeFilter,
        providerPaymentStatusFilter,
    ]);

    const exportProviderBookingsCsv = () => {
        const rows = providerBookingFilteredRows;
        const escapeCsv = (value: unknown) => {
            const text = String(value ?? '');
            if (text.includes(',') || text.includes('"') || text.includes('\n')) {
                return `"${text.replace(/"/g, '""')}"`;
            }
            return text;
        };

        const header = [
            'booking_id',
            'listing_title',
            'listing_type',
            'booking_status',
            'payment_status',
            'traveler_name',
            'traveler_email',
            'traveler_phone',
            'number_of_people',
            'unit_price',
            'total_price',
            'currency',
            'booking_date',
            'created_at',
            'paid_at',
            'payment_order_id',
            'payment_id',
        ];

        const lines = rows.map((item) => ([
            item.id,
            item.listing_title || '',
            item.listing_type || '',
            item.status || '',
            item.payment_status || 'pending',
            item.traveler_name || '',
            item.traveler_email || '',
            item.traveler_phone || '',
            item.number_of_people ?? '',
            item.unit_price ?? '',
            item.total_price ?? '',
            item.payment_currency || 'INR',
            item.booking_date || '',
            item.created_at || '',
            item.paid_at || '',
            item.payment_order_id || '',
            item.payment_id || '',
        ]).map(escapeCsv).join(','));

        const csv = `${header.join(',')}\n${lines.join('\n')}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const dateStamp = new Date().toISOString().slice(0, 10);
        anchor.href = url;
        anchor.download = `provider-bookings-${dateStamp}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const adminQueueRows = adminQueuePosts
        .filter((item) => (item.status || '').toLowerCase() !== 'rejected')
        .filter((item) => !query || `${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const adminRejectedRows = adminQueuePosts
        .filter((item) => (item.status || '').toLowerCase() === 'rejected')
        .filter((item) => !query || `${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const selectedModerationItem = useMemo(
        () => adminQueueRows.find((item) => item.id === selectedModerationId) || null,
        [adminQueueRows, selectedModerationId],
    );

    const selectedRejectedItem = useMemo(
        () => adminRejectedRows.find((item) => item.id === selectedRejectedId) || null,
        [adminRejectedRows, selectedRejectedId],
    );

    const adminAuditRows = adminAuditLogs
        .filter((item) => !query || `${item.entity_type} ${item.action} ${item.entity_id}`.toLowerCase().includes(query));

    const adminUserRows = adminUsers
        .filter((item) => !query || `${item.full_name || ''} ${item.email || ''} ${item.role || ''}`.toLowerCase().includes(query));

    useEffect(() => {
        if (effectiveRole !== 'admin') return;
        if (!adminQueueRows.length) {
            setSelectedModerationId(null);
            return;
        }
        const selectedStillVisible = selectedModerationId
            ? adminQueueRows.some((item) => item.id === selectedModerationId)
            : false;
        if (!selectedStillVisible) {
            setSelectedModerationId(adminQueueRows[0].id);
        }
    }, [adminQueueRows, effectiveRole, selectedModerationId]);

    useEffect(() => {
        if (effectiveRole !== 'admin') return;
        if (!adminRejectedRows.length) {
            setSelectedRejectedId(null);
            return;
        }
        const selectedStillVisible = selectedRejectedId
            ? adminRejectedRows.some((item) => item.id === selectedRejectedId)
            : false;
        if (!selectedStillVisible) {
            setSelectedRejectedId(adminRejectedRows[0].id);
        }
    }, [adminRejectedRows, effectiveRole, selectedRejectedId]);

    const getBookingDetailPath = (item: UnifiedBooking): string | null => {
        const listingId = typeof item.listing_id === 'string' ? item.listing_id.trim() : '';
        if (!listingId) return null;
        return `/listings/${toListingPathType(item.listing_type)}/${listingId}`;
    };
    const getTravelerSummary = (item: UnifiedBooking): string => {
        const name = item.traveler_name?.trim() || 'Traveler';
        const email = item.traveler_email?.trim() || '';
        const phone = item.traveler_phone?.trim() || '';
        return [name, email, phone].filter(Boolean).join(' - ') || 'Traveler details unavailable';
    };
    const userName = profile?.full_name || user?.email?.split('@')[0] || 'User';
    const userEmail = user?.email || '';
    const userInitials = userName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('');

    const headerMeta = sectionMeta[activeSection] || sectionMeta.overview;
    const activeNavLabel = navItems.find((item) => item.key === activeSection)?.label || 'Dashboard';
    const sectionCounts: Partial<Record<SidebarKey, number>> = useMemo(() => {
        if (effectiveRole === 'tourist') {
            return {
                bookings: touristRows.length,
                messages: touristConversations.length,
                favorites: favoriteRows.length,
            };
        }
        if (effectiveRole === 'provider') {
            return {
                bookings: providerBookingRows.length,
                listings: providerRows.length,
                manage_posts: providerRows.length,
                messages: providerNotifications.length,
            };
        }
        return {
            messages: adminAuditRows.length,
            moderation: adminQueueRows.length,
            rejected: adminRejectedRows.length,
            users: adminUserRows.length,
            map: adminAccountLocations.length,
            audits: adminAuditRows.length,
        };
    }, [
        adminAccountLocations.length,
        adminAuditRows.length,
        adminQueueRows.length,
        adminRejectedRows.length,
        adminUserRows.length,
        effectiveRole,
        favoriteRows.length,
        providerBookingRows.length,
        providerNotifications.length,
        providerRows.length,
        touristRows.length,
    ]);

    const renderTouristSection = () => {
        if (activeSection === 'bookings') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Bookings</h2>
                        <small>{query ? `Filtered by "${search}"` : `${touristRows.length} records`}</small>
                    </div>
                    <div className="rdb-list">
                        {touristRows.slice(0, 16).map((item) => {
                            const bookingPath = getBookingDetailPath(item);
                            const rowContent = (
                                <>
                                    <div>
                                        <p>{item.listing_title || 'Package'}</p>
                                        <small>{formatDate(item.booking_date || item.created_at)}</small>
                                    </div>
                                    <span className={`rdb-pill rdb-pill-${item.status}`}>{item.status}</span>
                                </>
                            );

                            if (!bookingPath) {
                                return <div key={item.id} className="rdb-list-row">{rowContent}</div>;
                            }

                            return (
                                <Link key={item.id} to={bookingPath} className="rdb-list-row rdb-list-row-link">
                                    {rowContent}
                                </Link>
                            );
                        })}
                        {touristRows.length === 0 && <p className="rdb-empty">No matching bookings.</p>}
                    </div>
                </section>
            );
        }

        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Messages</h2>
                        <div className="rdb-stat-list">
                            <div><span>Conversations</span><strong>{touristConversations.length}</strong></div>
                            <div><span>Unread Alerts</span><strong>{touristNotifications.filter((n) => !n.is_read && n.type === 'message_new').length}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <Link to="/messages" className="rdb-inline-link">Open Message Center</Link>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent Conversations</h2>
                            <small>{touristConversations.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {touristConversations.slice(0, 10).map((item) => (
                                <Link
                                    key={item.id}
                                    to={`/messages?conversation=${encodeURIComponent(item.id)}`}
                                    className="rdb-list-row rdb-list-row-link"
                                >
                                    <div>
                                        <p>Conversation {item.id.slice(0, 8)}</p>
                                        <small>Created {formatDate(item.created_at)}</small>
                                    </div>
                                    <span className="rdb-pill rdb-pill-approved">Open</span>
                                </Link>
                            ))}
                            {touristConversations.length === 0 && <p className="rdb-empty">No conversations yet. Messaging is enabled after a confirmed booking.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'favorites') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Favorites</h2>
                        <small>{query ? `Filtered by "${search}"` : `${favoriteRows.length} records`}</small>
                    </div>
                    <div className="rdb-list">
                        {favoriteRows.slice(0, 16).map((item) => (
                            <div key={item.favorite_id} className="rdb-list-row">
                                <div>
                                    <p>{item.title}</p>
                                    <small>{item.location || 'N/A'} - {item.listing_type}</small>
                                </div>
                                <small>{formatDate(item.created_at)}</small>
                            </div>
                        ))}
                        {favoriteRows.length === 0 && <p className="rdb-empty">No matching favorites.</p>}
                    </div>
                </section>
            );
        }

        if (activeSection === 'explore') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Travel Snapshot</h2>
                        <div className="rdb-stat-list">
                            <div><span>Upcoming Trips</span><strong>{touristMetrics.upcoming}</strong></div>
                            <div><span>Completed Trips</span><strong>{touristMetrics.completed}</strong></div>
                            <div><span>Saved Places</span><strong>{touristFavorites.length}</strong></div>
                            <div><span>Total Spend</span><strong>{formatCurrency(touristMetrics.spend)}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel">
                        <h2>Quick Actions</h2>
                        <div className="rdb-action-list">
                            <Link to="/?tab=tours" className="rdb-inline-link">Open tours</Link>
                            <Link to="/?tab=activities" className="rdb-inline-link">Open activities</Link>
                            <Link to="/profile" className="rdb-inline-link">Open profile bookings</Link>
                        </div>
                    </article>
                </section>
            );
        }

        return (
            <>
                <section className="rdb-kpis">
                    <article className="rdb-kpi rdb-kpi-highlight">
                        <div className="rdb-kpi-head"><ClipboardList size={15} /><p>Total Bookings</p></div>
                        <strong>{touristBookings.length}</strong>
                        <span>All trips booked by you</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><CheckCircle2 size={15} /><p>Completed</p></div>
                        <strong>{touristMetrics.completed}</strong>
                        <span>Trips completed</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><TrendingUp size={15} /><p>Upcoming</p></div>
                        <strong>{touristMetrics.upcoming}</strong>
                        <span>Pending and confirmed</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><Heart size={15} /><p>Favorites</p></div>
                        <strong>{touristFavorites.length}</strong>
                        <span>Saved places</span>
                    </article>
                </section>

                <section className="rdb-content-grid">
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Upcoming and Recent Trips</h2>
                            <small>{query ? `Filtered by "${search}"` : 'Latest 6 records'}</small>
                        </div>
                        <div className="rdb-list">
                            {touristRows.slice(0, 6).map((item) => {
                                const bookingPath = getBookingDetailPath(item);
                                const rowContent = (
                                    <>
                                        <div>
                                            <p>{item.listing_title || 'Package'}</p>
                                            <small>{formatDate(item.booking_date || item.created_at)}</small>
                                        </div>
                                        <span className={`rdb-pill rdb-pill-${item.status}`}>{item.status}</span>
                                    </>
                                );

                                if (!bookingPath) {
                                    return <div key={item.id} className="rdb-list-row">{rowContent}</div>;
                                }

                                return (
                                    <Link key={item.id} to={bookingPath} className="rdb-list-row rdb-list-row-link">
                                        {rowContent}
                                    </Link>
                                );
                            })}
                            {touristRows.length === 0 && <p className="rdb-empty">No matching bookings.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <h2>Quick Snapshot</h2>
                        <div className="rdb-stat-list">
                            <div><span>Review Queue</span><strong>{touristMetrics.reviewable}</strong></div>
                            <div><span>Total Spend</span><strong>{formatCurrency(touristMetrics.spend)}</strong></div>
                            <div><span>Conversations</span><strong>{touristConversations.length}</strong></div>
                            <div><span>Notifications</span><strong>{touristNotifications.length}</strong></div>
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <h2>Suggested Actions</h2>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('explore')}>Open explore panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('bookings')}>Open bookings panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('messages')}>Open messages panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('favorites')}>Open favorites panel</button>
                        </div>
                    </article>
                </section>
            </>
        );
    };

    const renderProviderSection = () => {
        if (activeSection === 'bookings') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Provider Bookings</h2>
                        <small>{query ? `Filtered by "${search}"` : `${providerBookingFilteredRows.length} records`}</small>
                    </div>

                    <div className="rdb-provider-booking-filters">
                        <select value={providerBookingStatusFilter} onChange={(e) => setProviderBookingStatusFilter(e.target.value as 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled')}>
                            <option value="all">All Booking Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>

                        <select value={providerPaymentStatusFilter} onChange={(e) => setProviderPaymentStatusFilter(e.target.value as 'all' | 'pending' | 'paid' | 'refunded')}>
                            <option value="all">All Payment Status</option>
                            <option value="pending">Pending</option>
                            <option value="paid">Paid</option>
                            <option value="refunded">Refunded</option>
                        </select>

                        <select value={providerPackageTypeFilter} onChange={(e) => setProviderPackageTypeFilter(e.target.value as 'all' | 'tour' | 'activity' | 'guide')}>
                            <option value="all">All Package Types</option>
                            <option value="tour">Tour</option>
                            <option value="activity">Activity</option>
                            <option value="guide">Guide</option>
                        </select>

                        <input
                            type="date"
                            value={providerBookingDateFrom}
                            onChange={(e) => setProviderBookingDateFrom(e.target.value)}
                            aria-label="Booking date from"
                        />
                        <input
                            type="date"
                            value={providerBookingDateTo}
                            onChange={(e) => setProviderBookingDateTo(e.target.value)}
                            aria-label="Booking date to"
                        />

                        <button
                            type="button"
                            className="rdb-row-edit-link"
                            onClick={exportProviderBookingsCsv}
                            disabled={providerBookingFilteredRows.length === 0}
                        >
                            Export CSV
                        </button>
                    </div>

                    <div className="rdb-provider-bookings-grid">
                        {providerBookingFilteredRows.slice(0, 24).map((item) => {
                            const bookingPath = getBookingDetailPath(item);
                            const bookingStatus = (item.status || 'pending').toLowerCase();
                            const paymentStatus = (item.payment_status || 'pending').toLowerCase();
                            const travelerId = typeof item.user_id === 'string' ? item.user_id.trim() : '';
                            return (
                                <article key={item.id} className="rdb-provider-booking-card">
                                    <div className="rdb-provider-booking-head">
                                        <div>
                                            <p>{item.listing_title || 'Package'}</p>
                                            <small>Booked on {formatDate(item.created_at)}</small>
                                        </div>
                                        <div className="rdb-provider-booking-pills">
                                            <span className={`rdb-pill rdb-pill-${bookingStatus}`}>{bookingStatus}</span>
                                            <span className={`rdb-pill rdb-pill-${paymentStatus}`}>{paymentStatus}</span>
                                        </div>
                                    </div>

                                    <div className="rdb-provider-booking-meta">
                                        <div><span>Traveler</span><strong>{item.traveler_name || 'N/A'}</strong></div>
                                        <div><span>Email</span><strong>{item.traveler_email || 'N/A'}</strong></div>
                                        <div><span>Phone</span><strong>{item.traveler_phone || 'N/A'}</strong></div>
                                        <div><span>Travelers</span><strong>{item.number_of_people || 0}</strong></div>
                                        <div><span>Date</span><strong>{formatDate(item.booking_date || item.created_at)}</strong></div>
                                        <div><span>Total Paid</span><strong>{formatCurrency(item.total_price || 0)}</strong></div>
                                        <div><span>Unit Price</span><strong>{formatCurrency(item.unit_price || 0)}</strong></div>
                                        <div><span>Booking ID</span><strong>{item.id || 'N/A'}</strong></div>
                                        <div><span>Order ID</span><strong>{item.payment_order_id || 'N/A'}</strong></div>
                                        <div><span>Payment ID</span><strong>{item.payment_id || 'N/A'}</strong></div>
                                        <div><span>Currency</span><strong>{item.payment_currency || 'INR'}</strong></div>
                                        <div><span>Paid At</span><strong>{formatDateTime(item.paid_at || item.created_at)}</strong></div>
                                    </div>

                                    <div className="rdb-provider-booking-actions">
                                        {bookingPath && (
                                            <Link to={bookingPath} className="rdb-row-edit-link">
                                                View Package
                                            </Link>
                                        )}
                                        {travelerId && travelerId !== user?.id ? (
                                            <Link
                                                to={`/messages?user=${encodeURIComponent(travelerId)}`}
                                                className="rdb-row-edit-link"
                                            >
                                                Contact Traveler
                                            </Link>
                                        ) : (
                                            <button type="button" className="rdb-row-edit-link" disabled>
                                                Contact Traveler
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            className="rdb-row-edit-link"
                                            onClick={() => setActiveSection('messages')}
                                        >
                                            Open Messages
                                        </button>
                                    </div>
                                </article>
                            );
                        })}
                        {providerBookingFilteredRows.length === 0 && <p className="rdb-empty">No matching bookings.</p>}
                    </div>
                </section>
            );
        }

        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Communication</h2>
                        <div className="rdb-stat-list">
                            <div><span>Conversations</span><strong>{providerConversations.length}</strong></div>
                            <div><span>Notifications</span><strong>{providerNotifications.length}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <Link to="/messages" className="rdb-inline-link">Open Message Center</Link>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent Conversations</h2>
                            <small>{providerConversations.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {providerConversations.slice(0, 12).map((item) => {
                                const otherUserId = item.traveler_id === user?.id ? item.provider_id : item.traveler_id;
                                return (
                                    <Link
                                        key={item.id}
                                        to={`/messages?conversation=${encodeURIComponent(item.id)}`}
                                        className="rdb-list-row rdb-list-row-link"
                                    >
                                        <div>
                                            <p>Conversation {item.id.slice(0, 8)}</p>
                                            <small>{otherUserId ? `Participant ${otherUserId.slice(0, 8)}` : 'Participant unavailable'}</small>
                                        </div>
                                        <small>{formatDate(item.created_at)}</small>
                                    </Link>
                                );
                            })}
                            {providerConversations.length === 0 && <p className="rdb-empty">No conversations yet. Travelers can contact you only after confirmed purchase.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'listings') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Listings and Status</h2>
                        <small>{query ? `Filtered by "${search}"` : `${providerRows.length} records`}</small>
                    </div>
                    <div className="rdb-list">
                        {providerRows.slice(0, 18).map((item) => (
                            <div key={item.id} className="rdb-list-row">
                                <div>
                                    <p>{titleForPost(item)}</p>
                                    <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                </div>
                                <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                            </div>
                        ))}
                        {providerRows.length === 0 && <p className="rdb-empty">No matching listings.</p>}
                    </div>
                </section>
            );
        }

        if (activeSection === 'manage_posts') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Post Management</h2>
                        <div className="rdb-action-list">
                            <Link to="/provider/studio" className="rdb-inline-link">Open Provider Studio</Link>
                            <Link to="/provider/studio" className="rdb-inline-link">Create New Post</Link>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('listings')}>View listing statuses</button>
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Your Posts</h2>
                            <small>{query ? `Filtered by "${search}"` : `${providerRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {providerRows.slice(0, 12).map((item) => (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{titleForPost(item)}</p>
                                        <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                    </div>
                                    <div className="rdb-row-actions">
                                        <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                                        <button
                                            type="button"
                                            className="rdb-post-edit-btn"
                                            onClick={() => navigate(`/provider/studio?edit=${encodeURIComponent(item.id)}`)}
                                        >
                                            Edit Post
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {providerRows.length === 0 && <p className="rdb-empty">No posts yet. Open Provider Studio to create one.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        return (
            <>
                <section className="rdb-kpis">
                    <article className="rdb-kpi rdb-kpi-highlight">
                        <div className="rdb-kpi-head"><LayoutDashboard size={15} /><p>Total Listings</p></div>
                        <strong>{providerListings.length}</strong>
                        <span>All provider posts</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><Clock3 size={15} /><p>Pending</p></div>
                        <strong>{providerMetrics.pending}</strong>
                        <span>Awaiting admin review</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><CheckCircle2 size={15} /><p>Live</p></div>
                        <strong>{providerMetrics.live}</strong>
                        <span>Currently published</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><BadgeDollarSign size={15} /><p>Revenue</p></div>
                        <strong>{formatCurrency(providerMetrics.revenue)}</strong>
                        <span>Non-cancelled bookings</span>
                    </article>
                </section>

                <section className="rdb-content-grid">
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Listings and Status</h2>
                            <small>{query ? `Filtered by "${search}"` : 'Latest 6 records'}</small>
                        </div>
                        <div className="rdb-list">
                            {providerRows.slice(0, 6).map((item) => (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{titleForPost(item)}</p>
                                        <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                    </div>
                                    <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                                </div>
                            ))}
                            {providerRows.length === 0 && <p className="rdb-empty">No matching listings.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <h2>Operational Summary</h2>
                        <div className="rdb-stat-list">
                            <div><span>Rejected Listings</span><strong>{providerMetrics.rejected}</strong></div>
                            <div><span>Total Bookings</span><strong>{providerBookings.length}</strong></div>
                            <div><span>Conversations</span><strong>{providerConversations.length}</strong></div>
                            <div><span>Notifications</span><strong>{providerNotifications.length}</strong></div>
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <div className="rdb-panel-head">
                            <h2>Recent Bookings</h2>
                            <small>{providerBookingRows.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {providerBookingRows.slice(0, 5).map((item) => (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{item.listing_title || 'Package'}</p>
                                        <small>{formatDate(item.booking_date || item.created_at)}</small>
                                        <small>{getTravelerSummary(item)}</small>
                                    </div>
                                    <span className={`rdb-pill rdb-pill-${item.status}`}>{item.status}</span>
                                </div>
                            ))}
                            {providerBookingRows.length === 0 && <p className="rdb-empty">No bookings yet.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <h2>Suggested Actions</h2>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('bookings')}>Open bookings panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('listings')}>Open listings panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('messages')}>Open messages panel</button>
                        </div>
                    </article>
                </section>
            </>
        );
    };

    const renderAdminSection = () => {
        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Admin Messaging</h2>
                        <div className="rdb-stat-list">
                            <div><span>Audit Events</span><strong>{adminAuditLogs.length}</strong></div>
                            <div><span>Recent Users</span><strong>{adminUserRows.length}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <Link to="/messages" className="rdb-inline-link">Open Message Center</Link>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent System Notifications</h2>
                            <small>{adminAuditRows.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {adminAuditRows.slice(0, 12).map((item) => (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{item.entity_type} - {item.action}</p>
                                        <small>{item.entity_id}</small>
                                    </div>
                                    <small>{formatDate(item.created_at)}</small>
                                </div>
                            ))}
                            {adminAuditRows.length === 0 && <p className="rdb-empty">No recent system messages.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'users') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>User Categories</h2>
                        <div className="rdb-user-split">
                            <div><p>Tourists</p><strong>{adminMetrics.touristCount}</strong></div>
                            <div><p>Providers</p><strong>{adminMetrics.providerCount}</strong></div>
                            <div><p>Admins</p><strong>{adminMetrics.adminCount}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent Users</h2>
                            <small>{query ? `Filtered by "${search}"` : `${adminUserRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {adminUserRows.slice(0, 16).map((item) => (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{item.full_name || item.email || 'Unnamed user'}</p>
                                        <small>{item.email || 'N/A'}</small>
                                    </div>
                                    <small>{item.role || 'tourist'}</small>
                                </div>
                            ))}
                            {adminUserRows.length === 0 && <p className="rdb-empty">No matching users.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'map') {
            if (!isDesktopDashboard) {
                return (
                    <section className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Account Geography</h2>
                            <small>Desktop only</small>
                        </div>
                        <p className="rdb-empty">The admin map is available on desktop only.</p>
                    </section>
                );
            }

            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Account Geography</h2>
                        <small>{adminAccountLocations.length} accounts</small>
                        <button
                            type="button"
                            className="rdb-row-edit-link"
                            onClick={() => void loadAdminAccountLocations(true)}
                        >
                            Refresh Map
                        </button>
                    </div>

                    {mapFetching && !mapLoaded ? (
                        <div className="rdb-loading">
                            <Loader2 size={32} className="animate-spin" />
                            <p>Loading map…</p>
                        </div>
                    ) : adminAccountLocations.length === 0 ? (
                        <p className="rdb-empty">No accounts with usable profile location data are available yet.</p>
                    ) : (
                        <Suspense fallback={<div className="rdb-loading"><Loader2 size={32} className="animate-spin" /><p>Loading map…</p></div>}>
                            <LazyAdminAccountMap accounts={adminAccountLocations} />
                        </Suspense>
                    )}
                </section>
            );
        }

        if (activeSection === 'moderation') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Moderation Totals</h2>
                        <div className="rdb-stat-list">
                            <div><span>Approved Posts</span><strong>{adminMetrics.approvedPosts}</strong></div>
                            <div><span>Pending Posts</span><strong>{adminMetrics.pendingPosts}</strong></div>
                            <div><span>Rejected Posts</span><strong>{adminMetrics.rejectedPosts}</strong></div>
                            <div><span>Pending Verifications</span><strong>{adminMetrics.pendingVerifications}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Moderation Queue</h2>
                            <small>{query ? `Filtered by "${search}"` : `${adminQueueRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {adminQueueRows.slice(0, 16).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`rdb-list-row rdb-list-row-button${selectedModerationId === item.id ? ' is-active' : ''}`}
                                    onClick={() => setSelectedModerationId(item.id)}
                                >
                                    <div>
                                        <p>{titleForPost(item)}</p>
                                        <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                    </div>
                                    <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                                </button>
                            ))}
                            {adminQueueRows.length === 0 && <p className="rdb-empty">No matching moderation items.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Listing Details</h2>
                            <small>{selectedModerationItem ? `ID: ${selectedModerationItem.id}` : 'Select a listing'}</small>
                        </div>
                        {selectedModerationItem ? (
                            <div className="rdb-moderation-detail">
                                <div className="rdb-moderation-media-wrap">
                                    <div
                                        className="rdb-moderation-media"
                                        style={{
                                            backgroundImage: `url(${selectedModerationItem.image_url || selectedModerationItem.cover_image_url || selectedModerationItem.thumbnail_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200'})`,
                                        }}
                                    />
                                </div>
                                <div className="rdb-moderation-info">
                                    <h3>{titleForPost(selectedModerationItem)}</h3>
                                    <p className="rdb-moderation-desc">{selectedModerationItem.description || 'No description provided.'}</p>
                                    <div className="rdb-stat-list">
                                        <div><span>Status</span><strong>{selectedModerationItem.status || 'pending'}</strong></div>
                                        <div><span>Type</span><strong>{selectedModerationItem.type || 'listing'}</strong></div>
                                        <div><span>Location</span><strong>{selectedModerationItem.location || 'N/A'}</strong></div>
                                        <div><span>Price</span><strong>{formatCurrency(selectedModerationItem.price || 0)}</strong></div>
                                        <div><span>Created</span><strong>{formatDate(selectedModerationItem.created_at)}</strong></div>
                                        <div><span>Reviewed</span><strong>{formatDate(selectedModerationItem.reviewed_at || null)}</strong></div>
                                    </div>
                                    <div className="rdb-moderation-actions">
                                        <button
                                            type="button"
                                            className="rdb-btn"
                                            onClick={() => navigate(`/admin/review/${encodeURIComponent(selectedModerationItem.id)}`)}
                                        >
                                            View More Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="rdb-empty">Select any queue listing to review full details and take action.</p>
                        )}
                    </article>
                </section>
            );
        }

        if (activeSection === 'rejected') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Rejected Summary</h2>
                        <div className="rdb-stat-list">
                            <div><span>Rejected Posts</span><strong>{adminRejectedRows.length}</strong></div>
                            <div><span>Active Queue</span><strong>{adminQueueRows.length}</strong></div>
                            <div><span>Total Packages</span><strong>{adminMetrics.totalPackages}</strong></div>
                            <div><span>Pending Verifications</span><strong>{adminMetrics.pendingVerifications}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Rejected Listings</h2>
                            <small>{query ? `Filtered by "${search}"` : `${adminRejectedRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {adminRejectedRows.slice(0, 16).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`rdb-list-row rdb-list-row-button${selectedRejectedId === item.id ? ' is-active' : ''}`}
                                    onClick={() => setSelectedRejectedId(item.id)}
                                >
                                    <div>
                                        <p>{titleForPost(item)}</p>
                                        <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                    </div>
                                    <span className="rdb-pill rdb-pill-rejected">rejected</span>
                                </button>
                            ))}
                            {adminRejectedRows.length === 0 && <p className="rdb-empty">No rejected listings found.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Rejected Listing Details</h2>
                            <small>{selectedRejectedItem ? `ID: ${selectedRejectedItem.id}` : 'Select a rejected listing'}</small>
                        </div>
                        {selectedRejectedItem ? (
                            <div className="rdb-moderation-detail">
                                <div className="rdb-moderation-media-wrap">
                                    <div
                                        className="rdb-moderation-media"
                                        style={{
                                            backgroundImage: `url(${selectedRejectedItem.image_url || selectedRejectedItem.cover_image_url || selectedRejectedItem.thumbnail_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200'})`,
                                        }}
                                    />
                                </div>
                                <div className="rdb-moderation-info">
                                    <h3>{titleForPost(selectedRejectedItem)}</h3>
                                    <p className="rdb-moderation-desc">{selectedRejectedItem.description || 'No description provided.'}</p>
                                    <div className="rdb-stat-list">
                                        <div><span>Status</span><strong>{selectedRejectedItem.status || 'rejected'}</strong></div>
                                        <div><span>Type</span><strong>{selectedRejectedItem.type || 'listing'}</strong></div>
                                        <div><span>Location</span><strong>{selectedRejectedItem.location || 'N/A'}</strong></div>
                                        <div><span>Price</span><strong>{formatCurrency(selectedRejectedItem.price || 0)}</strong></div>
                                        <div><span>Created</span><strong>{formatDate(selectedRejectedItem.created_at)}</strong></div>
                                        <div><span>Reviewed</span><strong>{formatDate(selectedRejectedItem.reviewed_at || null)}</strong></div>
                                        <div><span>Reason</span><strong>{selectedRejectedItem.rejection_reason || 'No reason recorded.'}</strong></div>
                                    </div>
                                    <div className="rdb-moderation-actions">
                                        <button
                                            type="button"
                                            className="rdb-btn"
                                            onClick={() => navigate(`/admin/review/${encodeURIComponent(selectedRejectedItem.id)}`)}
                                        >
                                            View More Details
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <p className="rdb-empty">Select a rejected listing to inspect why it was removed from the queue.</p>
                        )}
                    </article>
                </section>
            );
        }

        if (activeSection === 'audits') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Recent Audit Events</h2>
                        <small>{query ? `Filtered by "${search}"` : `${adminAuditRows.length} records`}</small>
                    </div>
                    <div className="rdb-list">
                        {adminAuditRows.slice(0, 18).map((item) => (
                            <div key={item.id} className="rdb-list-row">
                                <div>
                                    <p>{item.entity_type} - {item.action}</p>
                                    <small>{item.entity_id}</small>
                                </div>
                                <small>{formatDate(item.created_at)}</small>
                            </div>
                        ))}
                        {adminAuditRows.length === 0 && <p className="rdb-empty">No matching audit events.</p>}
                    </div>
                </section>
            );
        }

        return (
            <>
                <section className="rdb-kpis">
                    <article className="rdb-kpi rdb-kpi-highlight">
                        <div className="rdb-kpi-head"><LayoutDashboard size={15} /><p>Total Packages</p></div>
                        <strong>{adminMetrics.totalPackages}</strong>
                        <span>Published and queued posts</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><Users size={15} /><p>Total Users</p></div>
                        <strong>{adminMetrics.totalUsers}</strong>
                        <span>All profiles</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><CheckCircle2 size={15} /><p>Approved</p></div>
                        <strong>{adminMetrics.approvedPosts}</strong>
                        <span>Approved plus published</span>
                    </article>
                    <article className="rdb-kpi">
                        <div className="rdb-kpi-head"><Clock3 size={15} /><p>Pending</p></div>
                        <strong>{adminMetrics.pendingPosts}</strong>
                        <span>Awaiting moderation</span>
                    </article>
                </section>

                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>User Categories</h2>
                        <div className="rdb-user-split">
                            <div><p>Tourists</p><strong>{adminMetrics.touristCount}</strong></div>
                            <div><p>Providers</p><strong>{adminMetrics.providerCount}</strong></div>
                            <div><p>Admins</p><strong>{adminMetrics.adminCount}</strong></div>
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <h2>Control Summary</h2>
                        <div className="rdb-stat-list">
                            <div><span>Rejected Posts</span><strong>{adminMetrics.rejectedPosts}</strong></div>
                            <div><span>Pending Verifications</span><strong>{adminMetrics.pendingVerifications}</strong></div>
                            <div><span>Verification Records</span><strong>{adminVerifications.length}</strong></div>
                            <div><span>Audit Events</span><strong>{adminAuditLogs.length}</strong></div>
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Moderation Queue</h2>
                            <small>{query ? `Filtered by "${search}"` : 'Latest 6 records'}</small>
                        </div>
                        <div className="rdb-list">
                            {adminQueueRows.slice(0, 6).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-list-row rdb-list-row-button"
                                    onClick={() => {
                                        setSelectedModerationId(item.id);
                                        setActiveSection('moderation');
                                    }}
                                >
                                    <div>
                                        <p>{titleForPost(item)}</p>
                                        <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                    </div>
                                    <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                                </button>
                            ))}
                            {adminQueueRows.length === 0 && <p className="rdb-empty">No matching moderation items.</p>}
                        </div>
                    </article>
                </section>
            </>
        );
    };

    if (!user || profileLoading) return null;

    return (
        <main className="rdb-page">
            <div className="container rdb-shell">
                <aside className="rdb-sidebar">
                    <div className="rdb-brand">
                        <span className="rdb-brand-mark" />
                        <div>
                            <p className="rdb-brand-name">The Better Pass</p>
                            <p className="rdb-brand-role">{effectiveRole} Dashboard</p>
                        </div>
                    </div>

                    <nav className="rdb-nav" aria-label="Dashboard menu">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    type="button"
                                    key={item.key}
                                    className={`rdb-nav-item${item.key === activeSection ? ' is-active' : ''}`}
                                    onClick={() => setActiveSection(item.key)}
                                >
                                    <span className="rdb-nav-item-content">
                                        <Icon size={15} />
                                        <span>{item.label}</span>
                                    </span>
                                    {typeof sectionCounts[item.key] === 'number' && (
                                        <span className="rdb-nav-count">{sectionCounts[item.key]}</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <div className="rdb-profile">
                        <div className="rdb-profile-avatar">{userInitials || '?'}</div>
                        <div className="rdb-profile-info">
                            <p className="rdb-profile-name">{userName}</p>
                            <p className="rdb-profile-email">{userEmail}</p>
                        </div>
                    </div>
                </aside>

                <section className="rdb-main">
                    <header className="rdb-header">
                        <div className="rdb-search">
                            <Search size={16} />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search in dashboard..."
                                aria-label="Search dashboard data"
                            />
                        </div>

                        <div className="rdb-header-actions">
                            {effectiveRole === 'admin' && <Link to="/admin" className="rdb-btn">Admin Console</Link>}
                            {effectiveRole === 'provider' && <Link to="/provider/studio" className="rdb-btn">Provider Studio</Link>}
                            {effectiveRole === 'tourist' && <Link to="/?tab=tours" className="rdb-btn">Explore Trips</Link>}
                        </div>
                    </header>

                    <section className="rdb-title-row">
                        <div className="rdb-title-head">
                            <h1>{headerMeta.title}</h1>
                            <div className="rdb-title-badges">
                                <span className="rdb-chip">{activeNavLabel}</span>
                                <span className="rdb-chip">Updated {formatDateTime(lastLoadedAt)}</span>
                            </div>
                        </div>
                        <p>{headerMeta.subtitle}</p>
                    </section>

                    <nav className="rdb-inline-nav" aria-label="Dashboard quick sections">
                        {navItems.map((item) => (
                            <button
                                type="button"
                                key={`inline-${item.key}`}
                                className={`rdb-inline-tab${item.key === activeSection ? ' is-active' : ''}`}
                                onClick={() => setActiveSection(item.key)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </nav>

                    {loading ? (
                        <div className="rdb-loading">
                            <Loader2 size={32} className="animate-spin" />
                            <p>Loading dashboard…</p>
                        </div>
                    ) : error ? (
                        <div className="rdb-error">{error}</div>
                    ) : (
                        <>
                            {effectiveRole === 'tourist' && renderTouristSection()}
                            {effectiveRole === 'provider' && renderProviderSection()}
                            {effectiveRole === 'admin' && renderAdminSection()}
                        </>
                    )}
                </section>
            </div>

            <nav className="rdb-bottom-nav" aria-label="Mobile dashboard navigation">
                <div className="rdb-bottom-nav-track">
                    {mobileNavItems.map((item) => {
                        const Icon = item.icon;
                        const count = sectionCounts[item.key];
                        return (
                            <button
                                type="button"
                                key={`mob-${item.key}`}
                                className={`rdb-bottom-nav-btn${item.key === activeSection ? ' is-active' : ''}`}
                                onClick={() => setActiveSection(item.key)}
                                aria-current={item.key === activeSection ? 'page' : undefined}
                            >
                                <span className="rdb-bottom-nav-icon">
                                    <Icon size={20} />
                                </span>
                                <span className="rdb-bottom-nav-label">{item.label}</span>
                                {typeof count === 'number' && count > 0 && (
                                    <span className="rdb-bottom-nav-badge">{count}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </nav>
        </main>
    );
};
