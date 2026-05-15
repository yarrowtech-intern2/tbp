import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bell,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    Compass,
    ExternalLink,
    FileText,
    Heart,
    Home,
    LayoutDashboard,
    Loader2,
    Megaphone,
    MessageSquare,
    Menu,
    MapPin,
    Package,
    Search,
    Settings2,
    Star,
    SquarePen,
    Sun,
    Moon,
    Shield,
    Upload,
    UserCircle2,
    Users,
    XCircle,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import {
    getAdminAccountLocations,
    getBookings,
    getContentModerationQueue,
    getConversations,
    getFavoriteListings,
    getListingReviewSummaryMap,
    getListingReviewsForListingIds,
    getModerationAuditLogs,
    getMyAds,
    getMyPosts,
    getPosts,
    getProviderBookings,
    respondToBookingRequest,
    getVerificationQueue,
    hasActiveBoost,
    type AdminAccountLocationRecord,
    type PaidAdRecord,
    type AppNotificationRecord,
    type ConversationRecord,
    type FavoriteListingRecord,
    type ListingReviewRecord,
    type ListingReviewSummary,
    type ModerationAuditLogRecord,
    type PostRecord,
    type UnifiedBooking,
    type VerificationRecord,
} from '../lib/destinations';
import { isProviderRole, normalizeRoleValue } from '../lib/platform';
import {
    confirmPromotionPurchase,
    createPromotionOrder,
    openPromotionRazorpayCheckout,
} from '../lib/payments';
import {
    PROMOTION_PLAN_LIST,
    getPromotionPlan,
    isPromotionWindowActive,
    type PromotionPlanKey,
} from '../lib/promotions';
import './role-dashboard.css';

type DashboardRole = 'tourist' | 'provider' | 'admin';

type SidebarKey =
    | 'overview'
    | 'revenue'
    | 'explore'
    | 'bookings'
    | 'favorites'
    | 'listings'
    | 'advertisements'
    | 'studio'
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

type AdminDashboardSnapshot = {
    posts: PostRecord[];
    queuePosts: PostRecord[];
    verifications: VerificationRecord[];
    audits: ModerationAuditLogRecord[];
    users: AdminProfileRow[];
    revenue: number;
    revenueRows: AdminRevenueBookingRow[];
};

type AdminRevenueBookingRow = {
    id: string;
    listing_title: string;
    listing_type: string;
    traveler_id: string;
    provider_id: string;
    payment_id: string;
    payment_order_id: string;
    status: string;
    payment_status: string;
    booking_date: string | null;
    created_at: string | null;
    paid_at: string | null;
    total_price: number;
    unit_price: number;
    number_of_people: number;
    revenue_amount: number;
    revenue_amount_source: 'total_price' | 'unit_price_x_people';
    included_in_revenue: boolean;
    exclusion_reason: string | null;
};

type AccountRevenueRow = {
    id: string;
    listing_title: string;
    listing_type: string;
    payment_id: string;
    payment_order_id: string;
    status: string;
    payment_status: string;
    booking_date: string | null;
    created_at: string | null;
    paid_at: string | null;
    total_price: number;
    unit_price: number;
    number_of_people: number;
    revenue_amount: number;
    revenue_amount_source: 'total_price' | 'unit_price_x_people';
    included_in_revenue: boolean;
    exclusion_reason: string | null;
    traveler_id: string;
    provider_id: string;
    traveler_name: string | null;
    traveler_email: string | null;
    traveler_phone: string | null;
};

type NavItem = {
    key: SidebarKey;
    label: string;
    icon: React.ElementType;
};

type MobileNavItem = {
    id: string;
    label: string;
    icon: React.ElementType;
    section?: SidebarKey;
    countKey?: SidebarKey;
    to?: string;
};

type BoostDialogState = {
    postId: string;
    title: string;
    planKey: PromotionPlanKey;
    planLabel: string;
    amount: number;
    status: 'confirm' | 'creating_order' | 'checkout' | 'activating' | 'success' | 'error';
    message?: string | null;
    endsAt?: string | null;
};

const LIVE_STATUSES = new Set(['live', 'published', 'approved']);
const PROMO_IMAGE_BUCKET = 'avatars';
const MAX_PROMO_IMAGE_MB = 8;

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

const formatRupeeShort = (value: number) => `Rs ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
}).format(Math.max(0, Math.round(value)))}`;

const toFiniteNumber = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const sumBookedRevenue = (rows: Array<Record<string, unknown>>): number => rows.reduce((sum, row) => {
    const status = String(row.status || '').toLowerCase();
    const paymentStatus = String(row.payment_status || '').toLowerCase();
    const hasPaidAt = typeof row.paid_at === 'string' && row.paid_at.trim().length > 0;
    if (status === 'cancelled' || status === 'rejected' || paymentStatus === 'refunded') return sum;
    if (paymentStatus !== 'paid' && !hasPaidAt) return sum;
    const total = Math.max(0, toFiniteNumber(row.total_price));
    if (total > 0) return sum + total;
    const unit = Math.max(0, toFiniteNumber(row.unit_price));
    const people = Math.max(1, Math.floor(toFiniteNumber(row.number_of_people)));
    return sum + (unit * people);
}, 0);

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

const buildAccountRevenueRow = (item: UnifiedBooking): AccountRevenueRow => {
    const status = String(item.status || '').trim().toLowerCase();
    const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
    const totalPrice = Math.max(0, toFiniteNumber(item.total_price));
    const unitPrice = Math.max(0, toFiniteNumber(item.unit_price));
    const numberOfPeople = Math.max(1, Math.floor(toFiniteNumber(item.number_of_people)));
    const revenueAmount = totalPrice > 0 ? totalPrice : (unitPrice * numberOfPeople);
    const revenueAmountSource = totalPrice > 0 ? 'total_price' : 'unit_price_x_people';
    const hasPaidAt = typeof item.paid_at === 'string' && item.paid_at.trim().length > 0;
    const isPaid = paymentStatus === 'paid' || hasPaidAt;
    const isRefunded = paymentStatus === 'refunded';
    const isCancelledOrRejected = status === 'cancelled' || status === 'canceled' || status === 'rejected' || status === 'declined';
    const includedInRevenue = isPaid && !isRefunded && !isCancelledOrRejected && revenueAmount > 0;

    let exclusionReason: string | null = null;
    if (!includedInRevenue) {
        if (isRefunded) exclusionReason = 'Refunded payment';
        else if (isCancelledOrRejected) exclusionReason = 'Cancelled/rejected booking';
        else if (!isPaid) exclusionReason = 'Payment not settled';
        else exclusionReason = 'Amount unavailable';
    }

    return {
        id: String(item.id || ''),
        listing_title: String(item.listing_title || 'Untitled booking'),
        listing_type: String(item.listing_type || 'unknown'),
        payment_id: String(item.payment_id || ''),
        payment_order_id: String(item.payment_order_id || ''),
        status: String(item.status || 'pending'),
        payment_status: String(item.payment_status || 'pending'),
        booking_date: item.booking_date || null,
        created_at: item.created_at || null,
        paid_at: item.paid_at || null,
        total_price: totalPrice,
        unit_price: unitPrice,
        number_of_people: numberOfPeople,
        revenue_amount: revenueAmount,
        revenue_amount_source: revenueAmountSource,
        included_in_revenue: includedInRevenue,
        exclusion_reason: exclusionReason,
        traveler_id: String(item.user_id || ''),
        provider_id: String(item.provider_user_id || ''),
        traveler_name: item.traveler_name || null,
        traveler_email: item.traveler_email || null,
        traveler_phone: item.traveler_phone || null,
    };
};

const getNotificationRoute = (item: AppNotificationRecord, role: DashboardRole): string | null => {
    const metadata = item.metadata && typeof item.metadata === 'object'
        ? item.metadata as Record<string, unknown>
        : null;
    const route = metadata && typeof metadata.route === 'string'
        ? metadata.route.trim()
        : '';
    if (route.startsWith('/dashboard') || route.startsWith('/messages')) return route;
    if (item.type === 'message_new' && metadata && typeof metadata.conversation_id === 'string') {
        return `/messages?conversation=${encodeURIComponent(metadata.conversation_id)}`;
    }
    if (item.type.startsWith('booking_') || item.type.startsWith('payment_')) {
        return role === 'provider'
            ? '/dashboard/provider?section=bookings'
            : '/dashboard/tourist?section=bookings';
    }
    return null;
};

const formatRatingSummary = (summary?: ListingReviewSummary): string => {
    if (!summary || summary.review_count === 0 || summary.average_rating === null) return 'No reviews yet';
    return `${summary.average_rating.toFixed(1)} average from ${summary.review_count} ${summary.review_count === 1 ? 'rating' : 'ratings'}`;
};

const titleForPost = (item: PostRecord) => item.title || item.name || 'Untitled listing';
const toListingPathType = (type: string | null | undefined): 'tour' | 'activity' | 'event' => {
    if (type === 'tour') return 'tour';
    if (type === 'guide' || type === 'event') return 'event';
    return 'activity';
};

const parseTouristSection = (value: string | null): SidebarKey | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'overview') return 'overview';
    if (normalized === 'explore') return 'explore';
    if (normalized === 'bookings') return 'bookings';
    if (normalized === 'revenue' || normalized === 'spend') return 'revenue';
    if (normalized === 'messages') return 'messages';
    if (normalized === 'favorites' || normalized === 'favs') return 'favorites';
    return null;
};

const parseProviderSection = (value: string | null): SidebarKey | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'overview' || normalized === 'dashboard') return 'overview';
    if (normalized === 'bookings') return 'bookings';
    if (normalized === 'revenue') return 'revenue';
    if (normalized === 'listings') return 'listings';
    if (normalized === 'studio' || normalized === 'create') return 'studio';
    if (normalized === 'advertisements' || normalized === 'ads' || normalized === 'ad') return 'advertisements';
    if (normalized === 'manage_posts' || normalized === 'manage-posts' || normalized === 'posts') return 'studio';
    if (normalized === 'messages') return 'messages';
    return null;
};

const parseAdminSection = (value: string | null): SidebarKey | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'overview' || normalized === 'dashboard') return 'overview';
    if (normalized === 'messages') return 'messages';
    if (normalized === 'notifications') return 'messages';
    if (normalized === 'revenue') return 'revenue';
    if (normalized === 'moderation') return 'moderation';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'users') return 'users';
    if (normalized === 'map') return 'map';
    if (normalized === 'audits' || normalized === 'audit') return 'audits';
    return null;
};

const LazyAdminAccountMap = lazy(async () => {
    const module = await import('../components/admin/AdminAccountMap');
    return { default: module.AdminAccountMap };
});

const LazyProviderStudio = lazy(async () => {
    const module = await import('./ProviderStudio');
    return { default: module.ProviderStudio };
});

const AdminBarChart: React.FC<{
    data: Array<{ month: string; count: number; isCurrentMonth: boolean }>;
}> = ({ data }) => {
    const max = Math.max(...data.map((d) => d.count), 1);
    return (
        <div className="rdb-admin-bar-chart">
            {data.map(({ month, count, isCurrentMonth }) => (
                <div key={month} className="rdb-admin-bar-item">
                    <div className="rdb-admin-bar-track">
                        <div
                            className={`rdb-admin-bar-fill${isCurrentMonth ? ' rdb-admin-bar-fill--active' : ''}`}
                            style={{ height: `${(count / max) * 100}%` }}
                        />
                    </div>
                    <span className="rdb-admin-bar-label">{month}</span>
                </div>
            ))}
        </div>
    );
};

const AdminLineChart: React.FC<{ data: number[] }> = ({ data }) => {
    const max = Math.max(...data, 1);
    const W = 300;
    const H = 120;
    const padTop = 6;
    const padBottom = 12;
    const step = W / Math.max(data.length - 1, 1);
    const pts = data.map((val, idx) => ({
        x: idx * step,
        y: H - padBottom - (val / max) * (H - padTop - padBottom),
    }));
    return (
        <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="rdb-admin-line-chart"
            aria-hidden="true"
        >
            <line
                x1="0"
                y1={H - 2}
                x2={W}
                y2={H - 2}
                stroke="rgba(0, 0, 0, 0.68)"
                strokeWidth="1.1"
            />
            <polyline
                points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            {pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="3.2" fill="#0f0f0f" />
            ))}
        </svg>
    );
};

type RoleChartSegment = {
    label: string;
    value: number;
    color: string;
};

const buildRollingMonthlyCounts = (
    values: Array<string | null | undefined>,
    monthsCount = 5,
): Array<{ month: string; count: number; isCurrentMonth: boolean }> => {
    const safeMonths = Math.max(1, Math.min(12, Math.trunc(monthsCount)));
    const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const monthKeys: string[] = [];
    const labels: string[] = [];

    for (let idx = safeMonths - 1; idx >= 0; idx -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - idx, 1);
        monthKeys.push(`${d.getFullYear()}-${d.getMonth()}`);
        labels.push(monthLabels[d.getMonth()]);
    }

    const counts = monthKeys.map(() => 0);
    values.forEach((value) => {
        if (!value) return;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const keyIndex = monthKeys.indexOf(key);
        if (keyIndex >= 0) counts[keyIndex] += 1;
    });

    return labels.map((month, index) => ({
        month,
        count: counts[index],
        isCurrentMonth: index === labels.length - 1,
    }));
};

const buildRollingDailyCounts = (
    values: Array<string | null | undefined>,
    daysCount = 10,
): number[] => {
    const safeDays = Math.max(2, Math.trunc(daysCount));
    const counts = new Array(safeDays).fill(0);
    const dayMs = 86400000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    values.forEach((value) => {
        if (!value) return;
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return;
        const bucket = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const age = Math.floor((todayMs - bucket) / dayMs);
        if (age >= 0 && age < safeDays) {
            counts[safeDays - 1 - age] += 1;
        }
    });

    return counts;
};

const RoleDonutChart: React.FC<{ segments: RoleChartSegment[]; centerValue: number; label: string }> = ({
    segments,
    centerValue,
    label,
}) => {
    const normalizedSegments = segments
        .map((segment) => ({ ...segment, value: Math.max(0, Math.round(segment.value)) }))
        .filter((segment) => segment.value > 0);

    const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
    let angle = 0;
    const gradient = total > 0
        ? `conic-gradient(${normalizedSegments.map((segment) => {
            const start = angle;
            angle += (segment.value / total) * 360;
            return `${segment.color} ${start.toFixed(1)}deg ${angle.toFixed(1)}deg`;
        }).join(', ')})`
        : 'conic-gradient(#c7c7cb 0deg 360deg)';

    const ariaText = `${label}: ${segments.map((segment) => `${segment.label} ${Math.max(0, Math.round(segment.value))}`).join(', ')}`;

    return (
        <div className="rdb-role-donut" role="img" aria-label={ariaText}>
            <div className="rdb-role-donut-ring" style={{ background: gradient }} />
            <strong>{Math.max(0, Math.round(centerValue))}</strong>
        </div>
    );
};

export const RoleDashboard: React.FC = () => {
    const { user, profile, profileLoading } = useAuth();
    const {
        unreadCount,
        notifications: centerNotifications,
        markAsRead,
        markAllAsRead,
        refresh: refreshNotifications,
    } = useNotifications();
    const { theme, toggleTheme } = useTheme();
    const { role: roleParam } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const search = '';
    const [activeSection, setActiveSection] = useState<SidebarKey>('overview');
    const [isDesktopDashboard, setIsDesktopDashboard] = useState(
        typeof window === 'undefined' ? true : window.innerWidth >= 700,
    );

    const routeRole = normalizeRoleParam(roleParam);
    const requestedTouristSection = useMemo(
        () => parseTouristSection(searchParams.get('section')),
        [searchParams],
    );
    const requestedProviderSection = useMemo(
        () => parseProviderSection(searchParams.get('section')),
        [searchParams],
    );
    const requestedAdminSection = useMemo(
        () => parseAdminSection(searchParams.get('section')),
        [searchParams],
    );
    const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const effectiveRole = useMemo(
        () => effectiveRoleFromProfile(profile?.role || metadataRole),
        [metadataRole, profile?.role],
    );

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [touristBookings, setTouristBookings] = useState<UnifiedBooking[]>([]);
    const [touristFavorites, setTouristFavorites] = useState<FavoriteListingRecord[]>([]);
    const [touristConversations, setTouristConversations] = useState<ConversationRecord[]>([]);

    const [providerListings, setProviderListings] = useState<PostRecord[]>([]);
    const [providerAds, setProviderAds] = useState<PaidAdRecord[]>([]);
    const [providerBookings, setProviderBookings] = useState<UnifiedBooking[]>([]);
    const [providerConversations, setProviderConversations] = useState<ConversationRecord[]>([]);
    const [providerReviewSummaryByPostId, setProviderReviewSummaryByPostId] = useState<Record<string, ListingReviewSummary>>({});
    const [providerListingReviews, setProviderListingReviews] = useState<ListingReviewRecord[]>([]);
    const [boostingPostId, setBoostingPostId] = useState<string | null>(null);
    const [boostPlanByPostId, setBoostPlanByPostId] = useState<Record<string, PromotionPlanKey>>({});
    const [boostDialog, setBoostDialog] = useState<BoostDialogState | null>(null);
    const [adSubmitting, setAdSubmitting] = useState(false);
    const [adImageUploading, setAdImageUploading] = useState(false);
    const [adForm, setAdForm] = useState({
        title: '',
        image_url: '',
        link: '',
        cta_text: '',
        plan_key: 'week' as PromotionPlanKey,
    });
    const adImageInputRef = useRef<HTMLInputElement>(null);

    const [adminPublishedPosts, setAdminPublishedPosts] = useState<PostRecord[]>([]);
    const [adminQueuePosts, setAdminQueuePosts] = useState<PostRecord[]>([]);
    const [adminVerifications, setAdminVerifications] = useState<VerificationRecord[]>([]);
    const [adminAuditLogs, setAdminAuditLogs] = useState<ModerationAuditLogRecord[]>([]);
    const [adminUsers, setAdminUsers] = useState<AdminProfileRow[]>([]);
    const [adminAccountLocations, setAdminAccountLocations] = useState<AdminAccountLocationRecord[]>([]);
    const [adminRevenueRows, setAdminRevenueRows] = useState<AdminRevenueBookingRow[]>([]);
    const [selectedModerationId, setSelectedModerationId] = useState<string | null>(null);
    const [selectedRejectedId, setSelectedRejectedId] = useState<string | null>(null);
    const [adminRevenueDb, setAdminRevenueDb] = useState(0);
    const [adminMobileMenuOpen, setAdminMobileMenuOpen] = useState(false);
    const [mapFetching, setMapFetching] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [providerBookingStatusFilter, setProviderBookingStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'>('all');
    const [providerPaymentStatusFilter, setProviderPaymentStatusFilter] = useState<'all' | 'pending' | 'paid' | 'refunded'>('all');
    const [providerPackageTypeFilter, setProviderPackageTypeFilter] = useState<'all' | 'tour' | 'activity' | 'guide'>('all');
    const [providerBookingDateFrom, setProviderBookingDateFrom] = useState('');
    const [providerBookingDateTo, setProviderBookingDateTo] = useState('');
    const [providerBookingActionId, setProviderBookingActionId] = useState<string | null>(null);

    const fetchAdminDashboardSnapshot = useCallback(async (): Promise<AdminDashboardSnapshot> => {
        const [posts, queuePosts, verifications, audits, usersResult, bookingsResult, revenueResult] = await Promise.all([
            getPosts(),
            getContentModerationQueue(),
            getVerificationQueue(),
            getModerationAuditLogs(),
            supabase
                .from('profiles')
                .select('id, role, full_name, email, created_at')
                .order('created_at', { ascending: false }),
            supabase
                .from('bookings')
                .select('id, listing_title, listing_type, user_id, provider_user_id, payment_id, payment_order_id, status, payment_status, booking_date, created_at, paid_at, total_price, unit_price, number_of_people')
                .order('created_at', { ascending: false }),
            supabase.rpc('get_admin_revenue'),
        ]);

        if (bookingsResult.error) {
            console.error('Error fetching admin revenue rows:', bookingsResult.error);
        }
        if (revenueResult.error) {
            console.warn('get_admin_revenue RPC unavailable, using bookings fallback:', revenueResult.error.message);
        }

        const bookingRows = Array.isArray(bookingsResult.data)
            ? bookingsResult.data as Array<Record<string, unknown>>
            : [];
        const detailedRevenueRows: AdminRevenueBookingRow[] = bookingRows.map((row) => {
            const status = String(row.status || '').trim().toLowerCase();
            const paymentStatus = String(row.payment_status || '').trim().toLowerCase();
            const hasPaidAt = typeof row.paid_at === 'string' && row.paid_at.trim().length > 0;
            const totalPrice = Math.max(0, toFiniteNumber(row.total_price));
            const unitPrice = Math.max(0, toFiniteNumber(row.unit_price));
            const numberOfPeople = Math.max(1, Math.floor(toFiniteNumber(row.number_of_people)));
            const revenueAmount = totalPrice > 0 ? totalPrice : (unitPrice * numberOfPeople);
            const revenueAmountSource = totalPrice > 0 ? 'total_price' : 'unit_price_x_people';
            const isRefunded = paymentStatus === 'refunded';
            const isCancelledOrRejected = status === 'cancelled' || status === 'canceled' || status === 'rejected' || status === 'declined';
            const isPaid = paymentStatus === 'paid' || hasPaidAt;
            const includedInRevenue = isPaid && !isRefunded && !isCancelledOrRejected && revenueAmount > 0;

            let exclusionReason: string | null = null;
            if (!includedInRevenue) {
                if (isRefunded) exclusionReason = 'Refunded payment';
                else if (isCancelledOrRejected) exclusionReason = 'Cancelled/rejected booking';
                else if (!isPaid) exclusionReason = 'Payment not settled';
                else exclusionReason = 'Amount unavailable';
            }

            return {
                id: String(row.id || ''),
                listing_title: String(row.listing_title || 'Untitled booking'),
                listing_type: String(row.listing_type || 'unknown'),
                traveler_id: String(row.user_id || ''),
                provider_id: String(row.provider_user_id || ''),
                payment_id: String(row.payment_id || ''),
                payment_order_id: String(row.payment_order_id || ''),
                status: String(row.status || 'pending'),
                payment_status: String(row.payment_status || 'pending'),
                booking_date: typeof row.booking_date === 'string' ? row.booking_date : null,
                created_at: typeof row.created_at === 'string' ? row.created_at : null,
                paid_at: typeof row.paid_at === 'string' ? row.paid_at : null,
                total_price: totalPrice,
                unit_price: unitPrice,
                number_of_people: numberOfPeople,
                revenue_amount: revenueAmount,
                revenue_amount_source: revenueAmountSource,
                included_in_revenue: includedInRevenue,
                exclusion_reason: exclusionReason,
            };
        });
        const rpcRevenueRow = Array.isArray(revenueResult.data)
            ? revenueResult.data[0] as Record<string, unknown> | undefined
            : (revenueResult.data as Record<string, unknown> | null) || null;
        const revenueFromRpc = rpcRevenueRow
            ? Math.max(0, toFiniteNumber(rpcRevenueRow.net_revenue ?? rpcRevenueRow.gross_revenue))
            : 0;
        const hasRpcRevenue = !revenueResult.error && Boolean(rpcRevenueRow);

        return {
            posts,
            queuePosts,
            verifications,
            audits,
            users: usersResult.error ? [] : (usersResult.data as AdminProfileRow[] || []),
            revenue: hasRpcRevenue ? revenueFromRpc : sumBookedRevenue(bookingRows),
            revenueRows: detailedRevenueRows,
        };
    }, []);

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
        if (isDesktopDashboard) {
            setAdminMobileMenuOpen(false);
        }
    }, [isDesktopDashboard]);

    useEffect(() => {
        setAdminMobileMenuOpen(false);
    }, [activeSection]);

    useEffect(() => {
        if (effectiveRole === 'admin') {
            setActiveSection(requestedAdminSection || 'overview');
            return;
        }
        if (effectiveRole === 'provider') {
            setActiveSection(requestedProviderSection || 'overview');
            return;
        }
        setActiveSection(requestedTouristSection || 'overview');
    }, [effectiveRole, requestedAdminSection, requestedProviderSection, requestedTouristSection]);

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
                    const [bookings, favorites, conversations] = await Promise.all([
                        getBookings(user.id),
                        getFavoriteListings(user.id),
                        getConversations(user.id),
                    ]);
                    if (cancelled) return;
                    setTouristBookings(bookings);
                    setTouristFavorites(favorites);
                    setTouristConversations(conversations);
                }

                if (effectiveRole === 'provider') {
                    const [listings, ads, bookings, conversations] = await Promise.all([
                        getMyPosts(user.id),
                        getMyAds(user.id),
                        getProviderBookings(user.id),
                        getConversations(user.id),
                    ]);
                    if (cancelled) return;
                    setProviderListings(listings);
                    setProviderAds(ads);
                    setProviderBookings(bookings);
                    setProviderConversations(conversations);
                }

                if (effectiveRole === 'admin') {
                    const adminSnapshot = await fetchAdminDashboardSnapshot();
                    if (cancelled) return;
                    setAdminPublishedPosts(adminSnapshot.posts);
                    setAdminQueuePosts(adminSnapshot.queuePosts);
                    setAdminVerifications(adminSnapshot.verifications);
                    setAdminAuditLogs(adminSnapshot.audits);
                    setAdminUsers(adminSnapshot.users);
                    setAdminRevenueDb(adminSnapshot.revenue);
                    setAdminRevenueRows(adminSnapshot.revenueRows);
                }
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
    }, [effectiveRole, fetchAdminDashboardSnapshot, profileLoading, user]);

    useEffect(() => {
        if (!user || profileLoading || effectiveRole !== 'admin') return;
        let disposed = false;

        const refreshAdminLiveData = async () => {
            try {
                const snapshot = await fetchAdminDashboardSnapshot();
                if (disposed) return;
                setAdminPublishedPosts(snapshot.posts);
                setAdminQueuePosts(snapshot.queuePosts);
                setAdminVerifications(snapshot.verifications);
                setAdminAuditLogs(snapshot.audits);
                setAdminUsers(snapshot.users);
                setAdminRevenueDb(snapshot.revenue);
                setAdminRevenueRows(snapshot.revenueRows);
            } catch (err) {
                if (disposed) return;
                console.error('Failed to refresh admin dashboard live data:', err);
            }
        };

        const channel = supabase
            .channel(`rdb-admin-live-${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
                void refreshAdminLiveData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                void refreshAdminLiveData();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
                void refreshAdminLiveData();
            })
            .subscribe();

        const refreshInterval = window.setInterval(() => {
            void refreshAdminLiveData();
        }, 30000);

        return () => {
            disposed = true;
            window.clearInterval(refreshInterval);
            void supabase.removeChannel(channel);
        };
    }, [effectiveRole, fetchAdminDashboardSnapshot, profileLoading, user]);

    useEffect(() => {
        if (effectiveRole !== 'admin' || activeSection !== 'map') return;
        void loadAdminAccountLocations();
    }, [activeSection, effectiveRole]);

    useEffect(() => {
        if (effectiveRole !== 'provider') {
            setProviderReviewSummaryByPostId({});
            setProviderListingReviews([]);
            return;
        }

        const listingIds = providerListings
            .map((item) => String(item.id || '').trim())
            .filter(Boolean);

        if (listingIds.length === 0) {
            setProviderReviewSummaryByPostId({});
            setProviderListingReviews([]);
            return;
        }

        let cancelled = false;
        void Promise.all([
            getListingReviewSummaryMap(listingIds),
            getListingReviewsForListingIds(listingIds),
        ])
            .then(([summary, reviews]) => {
                if (cancelled) return;
                setProviderReviewSummaryByPostId(summary);
                setProviderListingReviews(reviews);
            })
            .catch((err) => {
                console.error('Provider review data load failed:', err);
                if (!cancelled) {
                    setProviderReviewSummaryByPostId({});
                    setProviderListingReviews([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [effectiveRole, providerListings]);

    const navItems: NavItem[] = useMemo(() => {
        if (effectiveRole === 'admin') {
            return [
                { key: 'overview', label: 'Dashboard', icon: FileText },
                { key: 'revenue', label: 'Revenue', icon: CalendarDays },
                { key: 'moderation', label: 'Moderation', icon: SquarePen },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
                { key: 'users', label: 'Users', icon: Users },
                { key: 'map', label: 'Map', icon: MapPin },
                { key: 'audits', label: 'Settings', icon: Settings2 },
                { key: 'rejected', label: 'Rejected', icon: Shield },
            ];
        }
        if (effectiveRole === 'provider') {
            return [
                { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                { key: 'bookings', label: 'Bookings', icon: ClipboardList },
                { key: 'revenue', label: 'Revenue', icon: CalendarDays },
                { key: 'studio', label: 'Studio', icon: SquarePen },
                { key: 'listings', label: 'Listings', icon: Package },
                { key: 'advertisements', label: 'Advertisements', icon: Megaphone },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
            ];
        }
        return [
            { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'explore', label: 'Explore', icon: Compass },
            { key: 'bookings', label: 'Bookings', icon: ClipboardList },
            { key: 'revenue', label: 'Spend', icon: CalendarDays },
            { key: 'messages', label: 'Messages', icon: MessageSquare },
            { key: 'favorites', label: 'Favorites', icon: Heart },
        ];
    }, [effectiveRole]);

    const mobileNavItems = useMemo<MobileNavItem[]>(() => {
        if (effectiveRole === 'admin') {
            return navItems
                .filter((item) => item.key !== 'map')
                .map((item) => ({ id: item.key, label: item.label, icon: item.icon, section: item.key, countKey: item.key }));
        }
        if (effectiveRole === 'provider') {
            return navItems
                .map((item) => ({ id: item.key, label: item.label, icon: item.icon, section: item.key, countKey: item.key }));
        }
        return [
            { id: 'home', label: 'Home', icon: Home, to: '/' },
            { id: 'explore', label: 'Explore', icon: Search, to: '/explore' },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
            { id: 'bookings', label: 'Bookings', icon: ClipboardList, section: 'bookings' },
            { id: 'revenue', label: 'Spend', icon: CalendarDays, section: 'revenue' },
            { id: 'profile', label: 'Profile', icon: UserCircle2, to: '/profile' },
        ];
    }, [effectiveRole, navItems]);

    const query = search.trim().toLowerCase();

    const touristMetrics = useMemo(() => {
        const completed = touristBookings.filter((item) => item.status === 'completed').length;
        const upcoming = touristBookings.filter((item) => {
            if (item.status !== 'pending' && item.status !== 'confirmed') return false;
            if (!item.booking_date) return true;
            return new Date(item.booking_date).getTime() >= Date.now() - 86400000;
        }).length;
        const spend = touristBookings
            .map((item) => buildAccountRevenueRow(item))
            .filter((item) => item.included_in_revenue)
            .reduce((sum, item) => sum + item.revenue_amount, 0);

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
            .map((item) => buildAccountRevenueRow(item))
            .filter((item) => item.included_in_revenue)
            .reduce((sum, item) => sum + item.revenue_amount, 0);
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
        let companyCount = 0;
        let instructorCount = 0;
        let guideCount = 0;
        for (const row of adminUsers) {
            const role = normalizeRoleValue(row.role || null);
            if (role === 'admin') {
                adminCount += 1;
            } else if (role === 'tour_company') {
                providerCount += 1;
                companyCount += 1;
            } else if (role === 'tour_instructor') {
                providerCount += 1;
                instructorCount += 1;
            } else if (role === 'tour_guide') {
                providerCount += 1;
                guideCount += 1;
            } else if (isProviderRole(role)) {
                providerCount += 1;
            } else {
                touristCount += 1;
            }
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
            companyCount,
            instructorCount,
            guideCount,
            pendingPosts,
            rejectedPosts,
            approvedPosts,
            pendingVerifications: adminVerifications.filter((v) => v.status === 'pending' || v.status === 'resubmitted').length,
        };
    }, [adminPublishedPosts, adminQueuePosts, adminUsers, adminVerifications]);

    const adminPackageTypeBreakdown = useMemo(() => {
        const all = [...adminPublishedPosts, ...adminQueuePosts];
        return {
            tours: all.filter((p) => p.type === 'tour').length,
            activities: all.filter((p) => p.type === 'activity').length,
            guides: all.filter((p) => p.type === 'guide' || p.type === 'event').length,
        };
    }, [adminPublishedPosts, adminQueuePosts]);

    const adminMonthlyPackages = useMemo(() => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const counts = new Array(12).fill(0);
        [...adminPublishedPosts, ...adminQueuePosts].forEach((post) => {
            if (!post.created_at) return;
            const d = new Date(post.created_at);
            if (d.getFullYear() === currentYear) counts[d.getMonth()]++;
        });
        const start = Math.max(0, currentMonth - 4);
        return months.slice(start, currentMonth + 1).map((month, idx) => ({
            month,
            count: counts[start + idx],
            isCurrentMonth: start + idx === currentMonth,
        }));
    }, [adminPublishedPosts, adminQueuePosts]);

    const adminAuditTrend = useMemo(() => {
        const days = 10;
        const counts = new Array(days).fill(0);
        const now = Date.now();
        const DAY = 86400000;
        adminAuditLogs.forEach((log) => {
            if (!log.created_at) return;
            const age = Math.floor((now - new Date(log.created_at).getTime()) / DAY);
            if (age >= 0 && age < days) counts[days - 1 - age]++;
        });
        return counts;
    }, [adminAuditLogs]);

    const touristBookingStatusBreakdown = useMemo(() => {
        let pending = 0;
        let confirmed = 0;
        let completed = 0;
        let cancelled = 0;
        for (const item of touristBookings) {
            const status = (item.status || '').toLowerCase();
            if (status === 'cancelled' || status === 'rejected') {
                cancelled += 1;
            } else if (status === 'completed') {
                completed += 1;
            } else if (status === 'confirmed') {
                confirmed += 1;
            } else {
                pending += 1;
            }
        }
        return { pending, confirmed, completed, cancelled };
    }, [touristBookings]);

    const providerListingTypeBreakdown = useMemo(() => ({
        tours: providerListings.filter((item) => item.type === 'tour').length,
        activities: providerListings.filter((item) => item.type === 'activity').length,
        guides: providerListings.filter((item) => item.type === 'guide' || item.type === 'event').length,
    }), [providerListings]);

    const providerBookingStatusBreakdown = useMemo(() => {
        let pending = 0;
        let confirmed = 0;
        let completed = 0;
        let cancelled = 0;
        for (const item of providerBookings) {
            const status = (item.status || '').toLowerCase();
            if (status === 'cancelled' || status === 'rejected') {
                cancelled += 1;
            } else if (status === 'completed') {
                completed += 1;
            } else if (status === 'confirmed') {
                confirmed += 1;
            } else {
                pending += 1;
            }
        }
        return { pending, confirmed, completed, cancelled };
    }, [providerBookings]);

    const touristMonthlyBookings = useMemo(
        () => buildRollingMonthlyCounts(touristBookings.map((item) => item.booking_date || item.created_at)),
        [touristBookings],
    );

    const providerMonthlyListings = useMemo(
        () => buildRollingMonthlyCounts(providerListings.map((item) => item.created_at)),
        [providerListings],
    );

    const touristNotificationRows = centerNotifications
        .filter((item) => !query || `${item.title || ''} ${item.body || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const providerNotificationRows = centerNotifications
        .filter((item) => !query || `${item.title || ''} ${item.body || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const touristActivityTrend = useMemo(
        () => buildRollingDailyCounts([
            ...touristBookings.map((item) => item.created_at || item.booking_date),
            ...touristNotificationRows.map((item) => item.created_at),
        ]),
        [touristBookings, touristNotificationRows],
    );

    const providerBookingTrend = useMemo(
        () => buildRollingDailyCounts(providerBookings.map((item) => item.booking_date || item.created_at)),
        [providerBookings],
    );

    const touristRows = touristBookings
        .filter((item) => !query || `${item.listing_title || ''} ${item.status || ''}`.toLowerCase().includes(query));

    const touristRevenueRows = touristBookings.map((item) => buildAccountRevenueRow(item));
    const touristRevenueFilteredRows = touristRevenueRows
        .filter((item) => !query || `${item.id} ${item.listing_title} ${item.listing_type} ${item.payment_id} ${item.payment_order_id} ${item.status} ${item.payment_status}`.toLowerCase().includes(query));

    const favoriteRows = touristFavorites
        .filter((item) => !query || `${item.title || ''} ${item.location || ''} ${item.listing_type || ''}`.toLowerCase().includes(query));

    const providerRows = providerListings
        .filter((item) => !query || `${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const providerListingMap = useMemo(() => {
        const map = new Map<string, PostRecord>();
        providerListings.forEach((item) => {
            const id = String(item.id || '').trim();
            if (id) map.set(id, item);
        });
        return map;
    }, [providerListings]);

    const providerAdRows = providerAds
        .filter((item) => !query || `${item.title || ''} ${item.link || ''} ${item.cta_text || ''}`.toLowerCase().includes(query));

    const providerBookingRows = providerBookings
        .filter((item) => !query || `${item.listing_title || ''} ${item.status || ''} ${item.traveler_name || ''} ${item.traveler_email || ''} ${item.traveler_phone || ''}`.toLowerCase().includes(query));

    const providerRevenueRows = providerBookings.map((item) => buildAccountRevenueRow(item));
    const providerRevenueFilteredRows = providerRevenueRows
        .filter((item) => !query || `${item.id} ${item.listing_title} ${item.listing_type} ${item.payment_id} ${item.payment_order_id} ${item.status} ${item.payment_status} ${item.traveler_name || ''} ${item.traveler_email || ''}`.toLowerCase().includes(query));

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

    const handleProviderBookingDecision = async (
        booking: UnifiedBooking,
        decision: 'accept' | 'reject'
    ) => {
        if (!user?.id) return;

        const bookingId = String(booking.id || '').trim();
        if (!bookingId) {
            alert('Booking id is missing.');
            return;
        }

        let rejectionReason: string | null = null;
        if (decision === 'reject') {
            const input = window.prompt('Optional rejection reason for traveler and admin:', '');
            if (input === null) return;
            rejectionReason = input.trim() || null;
        }

        setProviderBookingActionId(bookingId);
        try {
            const updated = await respondToBookingRequest({
                bookingId,
                providerUserId: user.id,
                decision,
                rejectionReason,
            });

            setProviderBookings((current) => current.map((item) => (
                item.id === bookingId ? updated : item
            )));
            await refreshNotifications();
        } catch (error) {
            console.error('Provider booking decision failed:', error);
            const fallback = 'Could not update booking status.';
            if (error instanceof Error) {
                alert(error.message || fallback);
            } else if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
                alert((error as { message: string }).message || fallback);
            } else {
                alert(fallback);
            }
        } finally {
            setProviderBookingActionId(null);
        }
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

    const adminRevenueFilteredRows = adminRevenueRows
        .filter((item) => !query || `${item.id} ${item.listing_title} ${item.listing_type} ${item.payment_id} ${item.payment_order_id} ${item.traveler_id} ${item.provider_id} ${item.status} ${item.payment_status}`.toLowerCase().includes(query));

    const adminNotificationRows = centerNotifications
        .filter((item) => !query || `${item.title || ''} ${item.body || ''} ${item.type || ''}`.toLowerCase().includes(query));

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
    const userName = profile?.full_name || user?.email?.split('@')[0] || 'User';
    const userEmail = user?.email || '';
    const userInitials = userName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() ?? '')
        .join('');

    const sectionCounts: Partial<Record<SidebarKey, number>> = useMemo(() => {
        if (effectiveRole === 'tourist') {
            return {
                bookings: touristRows.length,
                revenue: touristRevenueFilteredRows.length,
                messages: touristNotificationRows.length,
                favorites: favoriteRows.length,
            };
        }
        if (effectiveRole === 'provider') {
            return {
                bookings: providerBookingRows.length,
                revenue: providerRevenueFilteredRows.length,
                studio: providerRows.length,
                listings: providerRows.length,
                advertisements: providerAdRows.length,
                messages: providerNotificationRows.length,
            };
        }
        return {
            revenue: adminRevenueFilteredRows.length,
            messages: adminNotificationRows.length,
            moderation: adminQueueRows.length,
            rejected: adminRejectedRows.length,
            users: adminUserRows.length,
            map: adminAccountLocations.length,
            audits: adminAuditRows.length,
        };
    }, [
        adminAccountLocations.length,
        adminAuditRows.length,
        adminRevenueFilteredRows.length,
        adminNotificationRows.length,
        adminQueueRows.length,
        adminRejectedRows.length,
        adminUserRows.length,
        effectiveRole,
        favoriteRows.length,
        providerBookingRows.length,
        providerRevenueFilteredRows.length,
        providerNotificationRows.length,
        providerAdRows.length,
        providerRows.length,
        touristNotificationRows.length,
        touristRevenueFilteredRows.length,
        touristRows.length,
    ]);

    const refreshProviderPromotionState = async () => {
        if (!user) return;
        const [nextListings, nextAds] = await Promise.all([
            getMyPosts(user.id),
            getMyAds(user.id),
        ]);
        setProviderListings(nextListings);
        setProviderAds(nextAds);
    };

    const isBoostableListing = (item: PostRecord) => {
        const status = (item.status || '').toLowerCase();
        return status === 'live' || status === 'published';
    };

    const handleBoostPurchase = async (item: PostRecord) => {
        if (!user) return;
        const postId = String(item.id || '').trim();
        if (!postId) {
            alert('This listing is missing an id, so it cannot be boosted.');
            return;
        }
        if (!isBoostableListing(item)) {
            alert('Only live listings can be boosted.');
            return;
        }
        if (hasActiveBoost(item)) {
            alert('This listing already has an active boost.');
            return;
        }

        const planKey = boostPlanByPostId[item.id] || 'week';
        const plan = getPromotionPlan(planKey);
        setBoostDialog({
            postId,
            title: titleForPost(item),
            planKey,
            planLabel: plan.label,
            amount: plan.amount,
            status: 'confirm',
            message: null,
            endsAt: null,
        });
    };

    const closeBoostDialog = () => {
        if (!boostDialog) return;
        if (boostDialog.status === 'creating_order' || boostDialog.status === 'checkout' || boostDialog.status === 'activating') {
            return;
        }
        setBoostDialog(null);
    };

    const confirmBoostPurchase = async () => {
        if (!user || !boostDialog) return;
        const { postId, title, planKey, planLabel } = boostDialog;
        setBoostingPostId(postId);
        setBoostDialog((current) => current ? {
            ...current,
            status: 'creating_order',
            message: 'Creating your boost payment order…',
        } : current);

        try {
            const order = await createPromotionOrder({
                kind: 'boost',
                post_id: postId,
                plan_key: planKey,
                label: title,
            });
            setBoostDialog((current) => current ? {
                ...current,
                status: 'checkout',
                message: 'Payment order is ready. Complete the checkout to start the boost.',
            } : current);
            const payment = await openPromotionRazorpayCheckout({
                order,
                item_label: `${title} (${planLabel})`,
                prefill: {
                    name: profile?.full_name || undefined,
                    email: user.email || undefined,
                    contact: profile?.phone || undefined,
                },
            });
            setBoostDialog((current) => current ? {
                ...current,
                status: 'activating',
                message: 'Payment received. Activating the boost on your listing…',
            } : current);
            const result = await confirmPromotionPurchase({
                kind: 'boost',
                plan_key: planKey,
                payment,
                boost: { post_id: postId },
            });
            await refreshProviderPromotionState();
            setBoostDialog((current) => current ? {
                ...current,
                status: 'success',
                message: `Boost activated successfully for ${planLabel}.`,
                endsAt: result.ends_at || null,
            } : current);
        } catch (error) {
            console.error('Boost purchase failed:', error);
            setBoostDialog((current) => current ? {
                ...current,
                status: 'error',
                message: error instanceof Error ? error.message : 'Could not complete boost purchase.',
            } : current);
        } finally {
            setBoostingPostId(null);
        }
    };

    const uploadPromoImage = async (file: File): Promise<string> => {
        if (!user) throw new Error('You must be logged in to upload an image.');

        const ext = file.name.split('.').pop() || 'jpg';
        const path = `${user.id}/promo-ad-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
            .from(PROMO_IMAGE_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });

        if (error) throw error;

        const { data } = supabase.storage.from(PROMO_IMAGE_BUCKET).getPublicUrl(path);
        return `${data.publicUrl}?t=${Date.now()}`;
    };

    const handleAdImageUpload = async (file: File) => {
        if (!user) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        if (file.size > MAX_PROMO_IMAGE_MB * 1024 * 1024) {
            alert(`Image is too large. Max allowed size is ${MAX_PROMO_IMAGE_MB}MB.`);
            return;
        }

        setAdImageUploading(true);
        try {
            const uploadedUrl = await uploadPromoImage(file);
            setAdForm((current) => ({ ...current, image_url: uploadedUrl }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to upload ad image.';
            console.error('Ad image upload failed:', error);
            alert(message);
        } finally {
            setAdImageUploading(false);
        }
    };

    const handleAdSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!user || adSubmitting || adImageUploading) return;

        const title = adForm.title.trim();
        const imageUrl = adForm.image_url.trim();
        const link = adForm.link.trim();
        const ctaText = adForm.cta_text.trim();
        if (!title || !imageUrl || !link || !ctaText) {
            alert('Title, uploaded image, link, and CTA text are required.');
            return;
        }

        const plan = getPromotionPlan(adForm.plan_key);
        setAdSubmitting(true);

        try {
            const order = await createPromotionOrder({
                kind: 'ad',
                plan_key: adForm.plan_key,
                title,
            });
            const payment = await openPromotionRazorpayCheckout({
                order,
                item_label: `${title} (${plan.label})`,
                prefill: {
                    name: profile?.full_name || undefined,
                    email: user.email || undefined,
                    contact: profile?.phone || undefined,
                },
            });
            await confirmPromotionPurchase({
                kind: 'ad',
                plan_key: adForm.plan_key,
                payment,
                ad: {
                    title,
                    image_url: imageUrl,
                    link,
                    cta_text: ctaText,
                },
            });
            setAdForm({
                title: '',
                image_url: '',
                link: '',
                cta_text: '',
                plan_key: 'week',
            });
            await refreshProviderPromotionState();
            alert(`Advertisement is live for ${plan.label}.`);
        } catch (error) {
            console.error('Ad purchase failed:', error);
            alert(error instanceof Error ? error.message : 'Could not complete advertisement purchase.');
        } finally {
            setAdSubmitting(false);
        }
    };

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

        if (activeSection === 'revenue') {
            const includedRows = touristRevenueFilteredRows.filter((item) => item.included_in_revenue);
            const excludedRows = touristRevenueFilteredRows.filter((item) => !item.included_in_revenue);
            const derivedSpend = includedRows.reduce((sum, item) => sum + item.revenue_amount, 0);

            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Spend Breakdown</h2>
                        <div className="rdb-stat-list">
                            <div><span>Total Spend</span><strong>{formatRupeeShort(touristMetrics.spend)}</strong></div>
                            <div><span>Contributing Rows</span><strong>{includedRows.length}</strong></div>
                            <div><span>Excluded Rows</span><strong>{excludedRows.length}</strong></div>
                            <div><span>Derived Spend</span><strong>{formatRupeeShort(derivedSpend)}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Spend Source Rows</h2>
                            <small>{query ? `Filtered by "${search}"` : `${touristRevenueFilteredRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {touristRevenueFilteredRows.slice(0, 80).map((item) => (
                                <div key={item.id || `${item.payment_id}-${item.payment_order_id}`} className="rdb-list-row">
                                    <div>
                                        <p>{item.listing_title} ({item.listing_type})</p>
                                        <small>Booking ID: {item.id || 'N/A'} | Payment ID: {item.payment_id || 'N/A'} | Order ID: {item.payment_order_id || 'N/A'}</small>
                                        <small>Status: {item.status} | Payment: {item.payment_status} | Source: {item.revenue_amount_source === 'total_price' ? 'total_price' : 'unit_price x travelers'}</small>
                                        <small>Created: {formatDateTime(item.created_at)} | Paid: {formatDateTime(item.paid_at)} | Date: {formatDate(item.booking_date)}</small>
                                        {!item.included_in_revenue && <small>Excluded: {item.exclusion_reason || 'Not eligible for spend'}</small>}
                                    </div>
                                    <div className="rdb-row-actions">
                                        <span className={`rdb-pill ${item.included_in_revenue ? 'rdb-pill-paid' : 'rdb-pill-cancelled'}`}>
                                            {item.included_in_revenue ? 'included' : 'excluded'}
                                        </span>
                                        <span className="rdb-pill rdb-pill-live">{formatCurrency(item.revenue_amount)}</span>
                                    </div>
                                </div>
                            ))}
                            {touristRevenueFilteredRows.length === 0 && <p className="rdb-empty">No spend rows found.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Notifications</h2>
                        <div className="rdb-stat-list">
                            <div><span>Conversations</span><strong>{touristConversations.length}</strong></div>
                            <div><span>Unread Alerts</span><strong>{touristNotificationRows.filter((item) => !item.is_read).length}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => void refreshNotifications()}>
                                Refresh
                            </button>
                            <button
                                type="button"
                                className="rdb-inline-link"
                                onClick={() => void markAllAsRead()}
                                disabled={touristNotificationRows.every((item) => item.is_read)}
                            >
                                Mark all read
                            </button>
                            <Link to="/messages" className="rdb-inline-link">Open Message Center</Link>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent Notifications</h2>
                            <small>{touristNotificationRows.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {touristNotificationRows.slice(0, 12).map((item) => {
                                const route = getNotificationRoute(item, 'tourist');
                                const rowContent = (
                                    <>
                                        <div>
                                            <p>{item.title || 'Notification'}</p>
                                            <small>{item.body || item.type || 'No details available'}</small>
                                        </div>
                                        <div className="rdb-row-actions">
                                            {!item.is_read && (
                                                <button
                                                    type="button"
                                                    className="rdb-row-edit-link"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        void markAsRead(item.id);
                                                    }}
                                                >
                                                    Mark read
                                                </button>
                                            )}
                                            <small>{formatDateTime(item.created_at)}</small>
                                        </div>
                                    </>
                                );
                                if (!route) {
                                    return <div key={item.id} className="rdb-list-row">{rowContent}</div>;
                                }
                                return (
                                    <Link key={item.id} to={route} className="rdb-list-row rdb-list-row-link">
                                        {rowContent}
                                    </Link>
                                );
                            })}
                            {touristNotificationRows.length === 0 && <p className="rdb-empty">No notifications yet.</p>}
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
                <div className="rdb-admin-kpi-row">
                    <article className="rdb-admin-dark-card">
                        <div className="rdb-admin-dark-card-layout">
                            <div className="rdb-admin-dark-main">
                                <p className="rdb-admin-dark-card-title">Total</p>
                                <h2 className="rdb-admin-dark-card-heading">Bookings</h2>
                                <strong className="rdb-admin-dark-card-number">{touristBookings.length}</strong>
                            </div>
                            <div className="rdb-admin-dark-breakdown">
                                <span>Confirmed <strong>{touristBookingStatusBreakdown.confirmed}</strong></span>
                                <span>Pending <strong>{touristBookingStatusBreakdown.pending}</strong></span>
                                <span>Completed <strong>{touristBookingStatusBreakdown.completed}</strong></span>
                            </div>
                        </div>
                    </article>

                    <article className="rdb-admin-light-card rdb-admin-light-card--users">
                        <p className="rdb-admin-light-card-title">Trip</p>
                        <h2 className="rdb-admin-light-card-heading">Status</h2>
                        <div className="rdb-admin-users-layout rdb-role-users-layout">
                            <RoleDonutChart
                                segments={[
                                    { label: 'Completed', value: touristBookingStatusBreakdown.completed, color: '#ff6700' },
                                    { label: 'Confirmed', value: touristBookingStatusBreakdown.confirmed, color: '#2f2f33' },
                                    { label: 'Pending', value: touristBookingStatusBreakdown.pending, color: '#b7b7bd' },
                                    { label: 'Cancelled', value: touristBookingStatusBreakdown.cancelled, color: '#8f8f95' },
                                ]}
                                centerValue={touristBookings.length}
                                label="Tourist booking status"
                            />
                            <div className="rdb-admin-users-breakdown">
                                <div>Completed <span>{touristBookingStatusBreakdown.completed}</span></div>
                                <div>Upcoming <span>{touristMetrics.upcoming}</span></div>
                                <div>Saved Places <span>{touristFavorites.length}</span></div>
                                <div>Messages <span>{touristConversations.length}</span></div>
                            </div>
                        </div>
                    </article>

                    <article className="rdb-admin-light-card rdb-admin-light-card--revenue">
                        <div className="rdb-admin-revenue-head">
                            <div>
                                <p className="rdb-admin-light-card-title">Total</p>
                                <h2 className="rdb-admin-light-card-heading">Spend</h2>
                            </div>
                            <button
                                type="button"
                                className="rdb-admin-arrow-btn"
                                onClick={() => setActiveSection('revenue')}
                                title="Open spend breakdown"
                            >
                                <ExternalLink size={15} />
                            </button>
                        </div>
                        <strong className="rdb-admin-light-card-number rdb-admin-light-card-number--revenue">{formatRupeeShort(touristMetrics.spend)}</strong>
                    </article>
                </div>

                <div className="rdb-admin-charts-row">
                    <article className="rdb-admin-chart-card">
                        <h3>Bookings</h3>
                        <p>Total count per month</p>
                        <AdminBarChart data={touristMonthlyBookings} />
                    </article>

                    <article className="rdb-admin-chart-card">
                        <h3>Trip Activity</h3>
                        <div className="rdb-admin-mod-list">
                            {touristRows.slice(0, 3).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-admin-mod-item"
                                    onClick={() => setActiveSection('bookings')}
                                >
                                    {item.listing_title || 'Package'} • {item.status}
                                </button>
                            ))}
                            {touristRows.length === 0 && (
                                <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No bookings yet</p>
                            )}
                        </div>
                        <AdminLineChart data={touristActivityTrend} />
                    </article>
                </div>
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
                        <select value={providerBookingStatusFilter} onChange={(e) => setProviderBookingStatusFilter(e.target.value as 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected')}>
                            <option value="all">All Booking Status</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="rejected">Rejected</option>
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
                            const hasPaidSignal = paymentStatus === 'paid'
                                || Boolean(item.paid_at)
                                || Boolean(item.payment_id);
                            const canDecideBooking = bookingStatus === 'pending' && hasPaidSignal;
                            const actionLoading = providerBookingActionId === item.id;
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
                                        {canDecideBooking && (
                                            <>
                                                <button
                                                    type="button"
                                                    className="rdb-row-edit-link rdb-row-edit-link--approve"
                                                    onClick={() => void handleProviderBookingDecision(item, 'accept')}
                                                    disabled={actionLoading}
                                                >
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Accept Booking'}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rdb-row-edit-link rdb-row-edit-link--reject"
                                                    onClick={() => void handleProviderBookingDecision(item, 'reject')}
                                                    disabled={actionLoading}
                                                >
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Reject Booking'}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                        {providerBookingFilteredRows.length === 0 && <p className="rdb-empty">No matching bookings.</p>}
                    </div>
                </section>
            );
        }

        if (activeSection === 'revenue') {
            const includedRows = providerRevenueFilteredRows.filter((item) => item.included_in_revenue);
            const excludedRows = providerRevenueFilteredRows.filter((item) => !item.included_in_revenue);
            const derivedRevenue = includedRows.reduce((sum, item) => sum + item.revenue_amount, 0);

            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Revenue Breakdown</h2>
                        <div className="rdb-stat-list">
                            <div><span>Total Revenue</span><strong>{formatRupeeShort(providerMetrics.revenue)}</strong></div>
                            <div><span>Contributing Rows</span><strong>{includedRows.length}</strong></div>
                            <div><span>Excluded Rows</span><strong>{excludedRows.length}</strong></div>
                            <div><span>Derived Revenue</span><strong>{formatRupeeShort(derivedRevenue)}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Revenue Source Rows</h2>
                            <small>{query ? `Filtered by "${search}"` : `${providerRevenueFilteredRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {providerRevenueFilteredRows.slice(0, 80).map((item) => (
                                <div key={item.id || `${item.payment_id}-${item.payment_order_id}`} className="rdb-list-row">
                                    <div>
                                        <p>{item.listing_title} ({item.listing_type})</p>
                                        <small>Booking ID: {item.id || 'N/A'} | Payment ID: {item.payment_id || 'N/A'} | Order ID: {item.payment_order_id || 'N/A'}</small>
                                        <small>Traveler: {item.traveler_name || item.traveler_id || 'N/A'} | Email: {item.traveler_email || 'N/A'} | Phone: {item.traveler_phone || 'N/A'}</small>
                                        <small>Status: {item.status} | Payment: {item.payment_status} | Source: {item.revenue_amount_source === 'total_price' ? 'total_price' : 'unit_price x travelers'}</small>
                                        <small>Created: {formatDateTime(item.created_at)} | Paid: {formatDateTime(item.paid_at)} | Date: {formatDate(item.booking_date)}</small>
                                        {!item.included_in_revenue && <small>Excluded: {item.exclusion_reason || 'Not eligible for revenue'}</small>}
                                    </div>
                                    <div className="rdb-row-actions">
                                        <span className={`rdb-pill ${item.included_in_revenue ? 'rdb-pill-paid' : 'rdb-pill-cancelled'}`}>
                                            {item.included_in_revenue ? 'included' : 'excluded'}
                                        </span>
                                        <span className="rdb-pill rdb-pill-live">{formatCurrency(item.revenue_amount)}</span>
                                    </div>
                                </div>
                            ))}
                            {providerRevenueFilteredRows.length === 0 && <p className="rdb-empty">No revenue rows found.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Notifications</h2>
                        <div className="rdb-stat-list">
                            <div><span>Conversations</span><strong>{providerConversations.length}</strong></div>
                            <div><span>Unread Alerts</span><strong>{providerNotificationRows.filter((item) => !item.is_read).length}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => void refreshNotifications()}>
                                Refresh
                            </button>
                            <button
                                type="button"
                                className="rdb-inline-link"
                                onClick={() => void markAllAsRead()}
                                disabled={providerNotificationRows.every((item) => item.is_read)}
                            >
                                Mark all read
                            </button>
                            <Link to="/messages" className="rdb-inline-link">Open Message Center</Link>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent Notifications</h2>
                            <small>{providerNotificationRows.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {providerNotificationRows.slice(0, 12).map((item) => {
                                const route = getNotificationRoute(item, 'provider');
                                const rowContent = (
                                    <>
                                        <div>
                                            <p>{item.title || 'Notification'}</p>
                                            <small>{item.body || item.type || 'No details available'}</small>
                                        </div>
                                        <div className="rdb-row-actions">
                                            {!item.is_read && (
                                                <button
                                                    type="button"
                                                    className="rdb-row-edit-link"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        event.stopPropagation();
                                                        void markAsRead(item.id);
                                                    }}
                                                >
                                                    Mark read
                                                </button>
                                            )}
                                            <small>{formatDateTime(item.created_at)}</small>
                                        </div>
                                    </>
                                );
                                if (!route) {
                                    return <div key={item.id} className="rdb-list-row">{rowContent}</div>;
                                }
                                return (
                                    <Link
                                        key={item.id}
                                        to={route}
                                        className="rdb-list-row rdb-list-row-link"
                                    >
                                        {rowContent}
                                    </Link>
                                );
                            })}
                            {providerNotificationRows.length === 0 && <p className="rdb-empty">No notifications yet.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'listings') {
            return (
                <>
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
                                    <small className="rdb-review-summary-line">
                                        {formatRatingSummary(providerReviewSummaryByPostId[String(item.id || '').trim()])}
                                    </small>
                                    {hasActiveBoost(item) && (
                                        <small>Boost active until {formatDate(item.boost_end || null)}</small>
                                    )}
                                </div>
                                <div className="rdb-row-actions rdb-row-actions-promo">
                                    <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                                    {hasActiveBoost(item) ? (
                                        <span className="rdb-pill rdb-pill-paid">Boosted</span>
                                    ) : isBoostableListing(item) ? (
                                        <>
                                            <select
                                                className="rdb-promo-select"
                                                value={boostPlanByPostId[item.id] || 'week'}
                                                onChange={(e) => setBoostPlanByPostId((current) => ({
                                                    ...current,
                                                    [item.id]: e.target.value as PromotionPlanKey,
                                                }))}
                                                aria-label={`Boost plan for ${titleForPost(item)}`}
                                            >
                                                {PROMOTION_PLAN_LIST.map((plan) => (
                                                    <option key={plan.key} value={plan.key}>
                                                        {plan.label} - {formatCurrency(plan.amount)}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="rdb-post-edit-btn"
                                                onClick={() => void handleBoostPurchase(item)}
                                                disabled={boostingPostId === String(item.id || '').trim()}
                                            >
                                                {boostingPostId === String(item.id || '').trim() ? 'Processing…' : 'Boost'}
                                            </button>
                                        </>
                                    ) : null}
                                </div>
                            </div>
                        ))}
                        {providerRows.length === 0 && <p className="rdb-empty">No matching listings.</p>}
                    </div>
                </section>
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Latest Ratings Received</h2>
                        <small>{providerListingReviews.length} records</small>
                    </div>
                    <div className="rdb-list">
                        {providerListingReviews.slice(0, 12).map((item) => {
                            const listing = providerListingMap.get(item.listing_id);
                            return (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{listing ? titleForPost(listing) : 'Listing'}</p>
                                        <small>{item.reviewer_name || 'Traveler'} - {formatDate(item.updated_at || item.created_at)}</small>
                                    </div>
                                    <div className="rdb-review-stars" aria-label={`${item.rating} star rating`}>
                                        {Array.from({ length: 5 }).map((_, index) => (
                                            <Star key={`${item.id}-star-${index}`} size={14} fill={index < item.rating ? 'currentColor' : 'none'} />
                                        ))}
                                        <strong>{item.rating}.0</strong>
                                    </div>
                                </div>
                            );
                        })}
                        {providerListingReviews.length === 0 && <p className="rdb-empty">No reviews yet.</p>}
                    </div>
                </section>
                </>
            );
        }

        if (activeSection === 'studio') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Provider Studio</h2>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('studio')}>Open Studio</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('studio')}>Create Listing</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('advertisements')}>Open ads panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('listings')}>View listing statuses</button>
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide rdb-panel-wide--studio">
                        <div className="rdb-panel-head">
                            <h2>Provider Studio</h2>
                            <small>Full post creation and management</small>
                        </div>
                        <Suspense fallback={<div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading studio...</p></div>}>
                            <LazyProviderStudio embedded />
                        </Suspense>
                    </article>
                </section>
            );
        }

        if (activeSection === 'advertisements') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <div className="rdb-panel-head">
                            <h2>Create Advertisement</h2>
                            <small>{formatCurrency(getPromotionPlan(adForm.plan_key).amount)} plan</small>
                        </div>
                        <form className="rdb-ad-form" onSubmit={handleAdSubmit}>
                            <label className="rdb-ad-field">
                                <span>Title</span>
                                <input
                                    value={adForm.title}
                                    onChange={(e) => setAdForm((current) => ({ ...current, title: e.target.value }))}
                                    placeholder="Weekend staycation launch"
                                    required
                                />
                            </label>
                            <label className="rdb-ad-field">
                                <span>Ad Image</span>
                                <div className="rdb-ad-upload-row">
                                    <button
                                        type="button"
                                        className="rdb-row-edit-link"
                                        disabled={adImageUploading}
                                        onClick={() => adImageInputRef.current?.click()}
                                    >
                                        <Upload size={13} />
                                        <span>{adImageUploading ? 'Uploading…' : 'Upload from device'}</span>
                                    </button>
                                    <small>Required. Use a banner-style image for best results.</small>
                                </div>
                                <input
                                    ref={adImageInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="rdb-ad-file-input"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleAdImageUpload(file);
                                        e.target.value = '';
                                    }}
                                />
                                {adForm.image_url && (
                                    <div className="rdb-ad-preview">
                                        <img src={adForm.image_url} alt="Ad preview" />
                                    </div>
                                )}
                            </label>
                            <label className="rdb-ad-field">
                                <span>Destination Link</span>
                                <input
                                    value={adForm.link}
                                    onChange={(e) => setAdForm((current) => ({ ...current, link: e.target.value }))}
                                    placeholder="/listings/tour/..."
                                    required
                                />
                            </label>
                            <label className="rdb-ad-field">
                                <span>CTA Text</span>
                                <input
                                    value={adForm.cta_text}
                                    onChange={(e) => setAdForm((current) => ({ ...current, cta_text: e.target.value }))}
                                    placeholder="Book now"
                                    required
                                />
                            </label>
                            <label className="rdb-ad-field">
                                <span>Plan</span>
                                <select
                                    value={adForm.plan_key}
                                    onChange={(e) => setAdForm((current) => ({ ...current, plan_key: e.target.value as PromotionPlanKey }))}
                                >
                                    {PROMOTION_PLAN_LIST.map((plan) => (
                                        <option key={plan.key} value={plan.key}>
                                            {plan.label} - {formatCurrency(plan.amount)}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <button type="submit" className="rdb-btn rdb-btn-full" disabled={adSubmitting || adImageUploading}>
                                {adSubmitting || adImageUploading ? 'Processing…' : 'Pay & Publish Ad'}
                            </button>
                        </form>
                    </article>

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Your Advertisements</h2>
                            <small>{query ? `Filtered by "${search}"` : `${providerAdRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {providerAdRows.slice(0, 16).map((ad) => {
                                const isActive = isPromotionWindowActive(ad.starts_at, ad.ends_at);
                                return (
                                    <div key={ad.id} className="rdb-list-row rdb-list-row-ad">
                                        <div className="rdb-ad-row-main">
                                            <div className="rdb-ad-thumb">
                                                {ad.image_url ? <img src={ad.image_url} alt={ad.title || 'Ad'} /> : <Megaphone size={18} />}
                                            </div>
                                            <div className="rdb-ad-row-copy">
                                                <p>{ad.title || 'Untitled ad'}</p>
                                                <small>{ad.cta_text || 'CTA missing'} - {ad.link || 'No link'}</small>
                                                <small>
                                                    {ad.plan_key ? `${getPromotionPlan(ad.plan_key).label} • ` : ''}
                                                    {ad.ends_at ? `Ends ${formatDate(ad.ends_at)}` : 'No end date'}
                                                </small>
                                            </div>
                                        </div>
                                        <div className="rdb-row-actions">
                                            <span className={`rdb-pill rdb-pill-${isActive ? 'paid' : 'pending'}`}>{isActive ? 'active' : 'expired'}</span>
                                            <span className="rdb-pill rdb-pill-live">{formatCurrency(ad.payment_amount || 0)}</span>
                                            <a
                                                href={ad.link || '#'}
                                                className="rdb-row-edit-link"
                                                target={ad.link?.startsWith('http') ? '_blank' : undefined}
                                                rel={ad.link?.startsWith('http') ? 'noreferrer' : undefined}
                                            >
                                                <ExternalLink size={13} />
                                                <span>Open</span>
                                            </a>
                                        </div>
                                    </div>
                                );
                            })}
                            {providerAdRows.length === 0 && <p className="rdb-empty">No ads yet. Create your first paid advertisement here.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        return (
            <>
                <div className="rdb-admin-kpi-row">
                    <article className="rdb-admin-dark-card">
                        <div className="rdb-admin-dark-card-layout">
                            <div className="rdb-admin-dark-main">
                                <p className="rdb-admin-dark-card-title">Total</p>
                                <h2 className="rdb-admin-dark-card-heading">Listings</h2>
                                <strong className="rdb-admin-dark-card-number">{providerListings.length}</strong>
                            </div>
                            <div className="rdb-admin-dark-breakdown">
                                <span>Tours <strong>{providerListingTypeBreakdown.tours}</strong></span>
                                <span>Activities <strong>{providerListingTypeBreakdown.activities}</strong></span>
                                <span>Guides <strong>{providerListingTypeBreakdown.guides}</strong></span>
                            </div>
                        </div>
                    </article>

                    <article className="rdb-admin-light-card rdb-admin-light-card--users">
                        <p className="rdb-admin-light-card-title">Total</p>
                        <h2 className="rdb-admin-light-card-heading">Bookings</h2>
                        <div className="rdb-admin-users-layout rdb-role-users-layout">
                            <RoleDonutChart
                                segments={[
                                    { label: 'Confirmed', value: providerBookingStatusBreakdown.confirmed, color: '#ff6700' },
                                    { label: 'Completed', value: providerBookingStatusBreakdown.completed, color: '#2f2f33' },
                                    { label: 'Pending', value: providerBookingStatusBreakdown.pending, color: '#b7b7bd' },
                                    { label: 'Cancelled', value: providerBookingStatusBreakdown.cancelled, color: '#8f8f95' },
                                ]}
                                centerValue={providerBookingRows.length}
                                label="Provider booking status"
                            />
                            <div className="rdb-admin-users-breakdown">
                                <div>Pending <span>{providerMetrics.pending}</span></div>
                                <div>Live <span>{providerMetrics.live}</span></div>
                                <div>Rejected <span>{providerMetrics.rejected}</span></div>
                                <div>Messages <span>{providerConversations.length}</span></div>
                            </div>
                        </div>
                    </article>

                    <article className="rdb-admin-light-card rdb-admin-light-card--revenue">
                        <div className="rdb-admin-revenue-head">
                            <div>
                                <p className="rdb-admin-light-card-title">Total</p>
                                <h2 className="rdb-admin-light-card-heading">Revenue</h2>
                            </div>
                            <button
                                type="button"
                                className="rdb-admin-arrow-btn"
                                onClick={() => setActiveSection('revenue')}
                                title="Open revenue breakdown"
                            >
                                <ExternalLink size={15} />
                            </button>
                        </div>
                        <strong className="rdb-admin-light-card-number rdb-admin-light-card-number--revenue">{formatRupeeShort(providerMetrics.revenue)}</strong>
                    </article>
                </div>

                <div className="rdb-admin-charts-row">
                    <article className="rdb-admin-chart-card">
                        <h3>Listings</h3>
                        <p>Total created per month</p>
                        <AdminBarChart data={providerMonthlyListings} />
                    </article>

                    <article className="rdb-admin-chart-card">
                        <h3>Bookings</h3>
                        <div className="rdb-admin-mod-list">
                            {providerBookingRows.slice(0, 3).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-admin-mod-item"
                                    onClick={() => setActiveSection('bookings')}
                                >
                                    {item.listing_title || 'Package'} • {item.status}
                                </button>
                            ))}
                            {providerBookingRows.length === 0 && (
                                <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No bookings yet</p>
                            )}
                        </div>
                        <AdminLineChart data={providerBookingTrend} />
                    </article>
                </div>
            </>
        );
    };

    const renderAdminSection = () => {
        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Notifications</h2>
                        <div className="rdb-stat-list">
                            <div><span>Unread</span><strong>{unreadCount}</strong></div>
                            <div><span>Total Alerts</span><strong>{centerNotifications.length}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => void refreshNotifications()}>
                                Refresh
                            </button>
                            <button
                                type="button"
                                className="rdb-inline-link"
                                onClick={() => void markAllAsRead()}
                                disabled={unreadCount === 0}
                            >
                                Mark all read
                            </button>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Recent Notifications</h2>
                            <small>{adminNotificationRows.length} records</small>
                        </div>
                        <div className="rdb-list">
                            {adminNotificationRows.slice(0, 14).map((item) => (
                                <div key={item.id} className="rdb-list-row">
                                    <div>
                                        <p>{item.title || 'Notification'}</p>
                                        <small>{item.body || item.type || 'No details available'}</small>
                                    </div>
                                    <div className="rdb-row-actions">
                                        {!item.is_read && (
                                            <button
                                                type="button"
                                                className="rdb-row-edit-link"
                                                onClick={() => void markAsRead(item.id)}
                                            >
                                                Mark read
                                            </button>
                                        )}
                                        <small>{formatDateTime(item.created_at)}</small>
                                    </div>
                                </div>
                            ))}
                            {adminNotificationRows.length === 0 && <p className="rdb-empty">No notifications available yet.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'revenue') {
            const includedRows = adminRevenueFilteredRows.filter((item) => item.included_in_revenue);
            const excludedRows = adminRevenueFilteredRows.filter((item) => !item.included_in_revenue);
            const derivedRevenue = includedRows.reduce((sum, item) => sum + item.revenue_amount, 0);

            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Revenue Breakdown</h2>
                        <div className="rdb-stat-list">
                            <div><span>Net Revenue</span><strong>{formatRupeeShort(adminRevenueDb)}</strong></div>
                            <div><span>Contributing Rows</span><strong>{includedRows.length}</strong></div>
                            <div><span>Excluded Rows</span><strong>{excludedRows.length}</strong></div>
                            <div><span>Derived Total</span><strong>{formatRupeeShort(derivedRevenue)}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => setActiveSection('overview')}>
                                Back to Dashboard
                            </button>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Revenue Source Rows</h2>
                            <small>{query ? `Filtered by "${search}"` : `${adminRevenueFilteredRows.length} records`}</small>
                        </div>
                        <div className="rdb-list">
                            {adminRevenueFilteredRows.slice(0, 80).map((item) => (
                                <div key={item.id || `${item.payment_id}-${item.payment_order_id}`} className="rdb-list-row">
                                    <div>
                                        <p>{item.listing_title} ({item.listing_type})</p>
                                        <small>Booking ID: {item.id || 'N/A'} | Payment ID: {item.payment_id || 'N/A'} | Order ID: {item.payment_order_id || 'N/A'}</small>
                                        <small>Traveler: {item.traveler_id || 'N/A'} | Provider: {item.provider_id || 'N/A'}</small>
                                        <small>Status: {item.status} | Payment: {item.payment_status} | Source: {item.revenue_amount_source === 'total_price' ? 'total_price' : 'unit_price x travelers'}</small>
                                        <small>Created: {formatDateTime(item.created_at)} | Paid: {formatDateTime(item.paid_at)} | Date: {formatDate(item.booking_date)}</small>
                                        {!item.included_in_revenue && <small>Excluded: {item.exclusion_reason || 'Not eligible for revenue'}</small>}
                                    </div>
                                    <div className="rdb-row-actions">
                                        <span className={`rdb-pill ${item.included_in_revenue ? 'rdb-pill-paid' : 'rdb-pill-cancelled'}`}>
                                            {item.included_in_revenue ? 'included' : 'excluded'}
                                        </span>
                                        <span className="rdb-pill rdb-pill-live">{formatCurrency(item.revenue_amount)}</span>
                                    </div>
                                </div>
                            ))}
                            {adminRevenueFilteredRows.length === 0 && <p className="rdb-empty">No revenue rows found.</p>}
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
                                            backgroundImage: (() => {
                                                const image = selectedModerationItem.image_url
                                                    || selectedModerationItem.cover_image_url
                                                    || selectedModerationItem.thumbnail_url;
                                                return image ? `url(${image})` : undefined;
                                            })(),
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
                                            backgroundImage: (() => {
                                                const image = selectedRejectedItem.image_url
                                                    || selectedRejectedItem.cover_image_url
                                                    || selectedRejectedItem.thumbnail_url;
                                                return image ? `url(${image})` : undefined;
                                            })(),
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
                {/* KPI cards row */}
                <div className="rdb-admin-kpi-row">
                    <article className="rdb-admin-dark-card">
                        <div className="rdb-admin-dark-card-layout">
                            <div className="rdb-admin-dark-main">
                                <p className="rdb-admin-dark-card-title">Total</p>
                                <h2 className="rdb-admin-dark-card-heading">Packages</h2>
                                <strong className="rdb-admin-dark-card-number">{adminMetrics.totalPackages}</strong>
                            </div>
                            <div className="rdb-admin-dark-breakdown">
                                <span>Tours <strong>{adminPackageTypeBreakdown.tours}</strong></span>
                                <span>Activities <strong>{adminPackageTypeBreakdown.activities}</strong></span>
                                <span>Guides <strong>{adminPackageTypeBreakdown.guides}</strong></span>
                            </div>
                        </div>
                    </article>

                    <article className="rdb-admin-light-card rdb-admin-light-card--revenue">
                        <div className="rdb-admin-revenue-head">
                            <div>
                                <p className="rdb-admin-light-card-title">Total</p>
                                <h2 className="rdb-admin-light-card-heading">Revenue</h2>
                            </div>
                            <button
                                type="button"
                                className="rdb-admin-arrow-btn"
                                onClick={() => setActiveSection('revenue')}
                                title="Open Revenue Breakdown"
                            >
                                <ExternalLink size={15} />
                            </button>
                        </div>
                        <strong className="rdb-admin-light-card-number rdb-admin-light-card-number--revenue">{formatRupeeShort(adminRevenueDb)}</strong>
                    </article>

                    <article className="rdb-admin-light-card rdb-admin-light-card--users">
                        <p className="rdb-admin-light-card-title">Total</p>
                        <h2 className="rdb-admin-light-card-heading">Users</h2>
                        <div className="rdb-admin-users-layout">
                            <strong className="rdb-admin-light-card-number">{adminMetrics.totalUsers}</strong>
                            <div className="rdb-admin-users-breakdown">
                                <div>Admin <span>{adminMetrics.adminCount}</span></div>
                                <div>Tourists <span>{adminMetrics.touristCount}</span></div>
                                <div>Tour Companies <span>{adminMetrics.companyCount}</span></div>
                                <div>Instructors <span>{adminMetrics.instructorCount}</span></div>
                                <div>Tour guides <span>{adminMetrics.guideCount}</span></div>
                            </div>
                        </div>
                    </article>
                </div>

                {/* Charts row */}
                <div className="rdb-admin-charts-row">
                    <article className="rdb-admin-chart-card">
                        <h3>Packages</h3>
                        <p>Total view per month</p>
                        <AdminBarChart data={adminMonthlyPackages} />
                    </article>

                    <article className="rdb-admin-chart-card">
                        <h3>Moderations</h3>
                        <div className="rdb-admin-mod-list">
                            {adminQueueRows.slice(0, 3).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-admin-mod-item"
                                    onClick={() => {
                                        setSelectedModerationId(item.id);
                                        setActiveSection('moderation');
                                    }}
                                >
                                    {titleForPost(item)} needs review
                                </button>
                            ))}
                            {adminQueueRows.length === 0 && (
                                <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No pending items</p>
                            )}
                        </div>
                        <AdminLineChart data={adminAuditTrend} />
                    </article>
                </div>
            </>
        );
    };

    if (!user || profileLoading) return null;

    const adminDateStr = new Date().toLocaleDateString('en-GB').split('/').join('.');
    const dashboardRoleLabel = effectiveRole === 'admin' ? 'Admin' : effectiveRole === 'provider' ? 'Provider' : 'Tourist';
    const isDarkTheme = theme === 'dark';

    return (
        <main className="rdb-page rdb-page--admin">
            <div className="container rdb-shell rdb-shell--admin">
                <aside className="rdb-sidebar">
                    <nav className="rdb-nav" aria-label="Dashboard menu">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    type="button"
                                    key={item.key}
                                    className={`rdb-nav-item${item.key === activeSection ? ' is-active' : ''}`}
                                    onClick={() => {
                                        setActiveSection(item.key);
                                        if (!isDesktopDashboard) {
                                            setAdminMobileMenuOpen(false);
                                        }
                                    }}
                                    title={item.label}
                                >
                                    <span className="rdb-nav-item-content">
                                        <Icon size={18} />
                                        <span>{item.label}</span>
                                    </span>
                                    {typeof sectionCounts[item.key] === 'number' && (
                                        <span className="rdb-nav-count">{sectionCounts[item.key]}</span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>

                    <button
                        type="button"
                        className="rdb-admin-sidebar-theme"
                        onClick={toggleTheme}
                        title={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
                        aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
                    >
                        {isDarkTheme ? <Sun size={20} /> : <Moon size={20} />}
                    </button>

                    <button
                        type="button"
                        className="rdb-admin-sidebar-back"
                        onClick={() => navigate(-1)}
                        title="Go back"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="rdb-profile">
                        <div className="rdb-profile-avatar">{userInitials || '?'}</div>
                        <div className="rdb-profile-info">
                            <p className="rdb-profile-name">{userName}</p>
                            <p className="rdb-profile-email">{userEmail}</p>
                        </div>
                    </div>
                </aside>

                <section className="rdb-main">
                    <header className={`rdb-admin-topbar${isDesktopDashboard ? ' is-desktop' : ' is-mobile'}${activeSection !== 'overview' ? ' is-subpage' : ''}`}>
                        <div className="rdb-admin-topbar-main">
                            <div className="rdb-admin-topbar-title">
                                <small>{dashboardRoleLabel}</small>
                                <h1>Dashboard</h1>
                            </div>
                            <div className="rdb-admin-topbar-controls">
                                {!isDesktopDashboard && (
                                    <button
                                        type="button"
                                        className={`rdb-admin-ctrl-btn rdb-admin-menu-btn${adminMobileMenuOpen ? ' is-open' : ''}`}
                                        title="Open dashboard menu"
                                        aria-expanded={adminMobileMenuOpen}
                                        aria-controls="rdb-admin-mobile-menu"
                                        onClick={() => setAdminMobileMenuOpen((open) => !open)}
                                    >
                                        <Menu size={18} />
                                    </button>
                                )}
                                {isDesktopDashboard && (
                                    <button
                                        type="button"
                                        className="rdb-admin-ctrl-btn"
                                        title="Notifications"
                                        aria-label="Open notifications"
                                        onClick={() => setActiveSection('messages')}
                                    >
                                        <Bell size={18} />
                                        {unreadCount > 0 && (
                                            <span className="rdb-admin-ctrl-badge">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </button>
                                )}
                                {isDesktopDashboard && (
                                    <div className="rdb-admin-date-pill">
                                        <div>
                                            <span className="rdb-admin-date-label">Date</span>
                                            <span className="rdb-admin-date-value">{adminDateStr}</span>
                                        </div>
                                        <span className="rdb-admin-date-icon">
                                            <CalendarDays size={19} />
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {!isDesktopDashboard && adminMobileMenuOpen && (
                            <nav id="rdb-admin-mobile-menu" className="rdb-admin-mobile-menu" aria-label="Dashboard sections">
                                {navItems.map((item) => {
                                    const isActive = item.key === activeSection;
                                    return (
                                        <button
                                            type="button"
                                            key={`mobile-${item.key}`}
                                            className={`rdb-admin-mobile-menu-item${isActive ? ' is-active' : ''}`}
                                            onClick={() => {
                                                setActiveSection(item.key);
                                                setAdminMobileMenuOpen(false);
                                            }}
                                        >
                                            <span>{item.label}</span>
                                            {typeof sectionCounts[item.key] === 'number' && (
                                                <strong>{sectionCounts[item.key]}</strong>
                                            )}
                                        </button>
                                    );
                                })}
                            </nav>
                        )}
                    </header>

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

            {boostDialog && (
                <div className="rdb-modal-backdrop" onClick={closeBoostDialog}>
                    <section
                        className="rdb-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="boost-modal-title"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="rdb-modal-head">
                            <div>
                                <p className="rdb-modal-kicker">Boost Listing</p>
                                <h2 id="boost-modal-title">{boostDialog.title}</h2>
                            </div>
                            <button
                                type="button"
                                className="rdb-modal-close"
                                onClick={closeBoostDialog}
                                disabled={boostDialog.status === 'creating_order' || boostDialog.status === 'checkout' || boostDialog.status === 'activating'}
                                aria-label="Close boost dialog"
                            >
                                ×
                            </button>
                        </div>

                        <div className="rdb-modal-body">
                            <div className="rdb-stat-list">
                                <div><span>Plan</span><strong>{boostDialog.planLabel}</strong></div>
                                <div><span>Cost</span><strong>{formatCurrency(boostDialog.amount)}</strong></div>
                                <div><span>Status</span><strong>{boostDialog.status.replace('_', ' ')}</strong></div>
                                {boostDialog.endsAt && (
                                    <div><span>Active Until</span><strong>{formatDate(boostDialog.endsAt)}</strong></div>
                                )}
                            </div>

                            {boostDialog.status === 'confirm' && (
                                <p className="rdb-modal-copy">
                                    Your listing will be promoted to the top of the recommendation row for the selected time window.
                                    Payment is processed in Razorpay test mode.
                                </p>
                            )}

                            {(boostDialog.status === 'creating_order' || boostDialog.status === 'checkout' || boostDialog.status === 'activating') && (
                                <div className="rdb-modal-status is-progress">
                                    <Loader2 size={18} className="animate-spin" />
                                    <p>{boostDialog.message || 'Processing your boost…'}</p>
                                </div>
                            )}

                            {boostDialog.status === 'success' && (
                                <div className="rdb-modal-status is-success">
                                    <CheckCircle2 size={18} />
                                    <p>{boostDialog.message}</p>
                                </div>
                            )}

                            {boostDialog.status === 'error' && (
                                <div className="rdb-modal-status is-error">
                                    <XCircle size={18} />
                                    <p>{boostDialog.message}</p>
                                </div>
                            )}
                        </div>

                        <div className="rdb-modal-actions">
                            {boostDialog.status === 'confirm' && (
                                <>
                                    <button type="button" className="rdb-modal-btn rdb-modal-btn--ghost" onClick={closeBoostDialog}>
                                        Cancel
                                    </button>
                                    <button type="button" className="rdb-modal-btn rdb-modal-btn--primary" onClick={() => void confirmBoostPurchase()}>
                                        Continue to Payment
                                    </button>
                                </>
                            )}

                            {boostDialog.status === 'success' && (
                                <button type="button" className="rdb-modal-btn rdb-modal-btn--primary" onClick={closeBoostDialog}>
                                    Done
                                </button>
                            )}

                            {boostDialog.status === 'error' && (
                                <>
                                    <button type="button" className="rdb-modal-btn rdb-modal-btn--ghost" onClick={closeBoostDialog}>
                                        Close
                                    </button>
                                    <button type="button" className="rdb-modal-btn rdb-modal-btn--primary" onClick={() => void confirmBoostPurchase()}>
                                        Try Again
                                    </button>
                                </>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {!isDesktopDashboard && (
                <nav className="rdb-bottom-nav" aria-label="Mobile dashboard navigation">
                    <div className="rdb-bottom-nav-track">
                        {mobileNavItems.map((item) => {
                            const Icon = item.icon;
                            const count = item.countKey ? sectionCounts[item.countKey] : undefined;
                            const isActive = item.section === activeSection;
                            return (
                                <button
                                    type="button"
                                    key={`mob-${item.id}`}
                                    className={`rdb-bottom-nav-btn${isActive ? ' is-active' : ''}`}
                                    onClick={() => {
                                        if (item.section) {
                                            setActiveSection(item.section);
                                            setAdminMobileMenuOpen(false);
                                            return;
                                        }
                                        if (item.to) {
                                            setAdminMobileMenuOpen(false);
                                            navigate(item.to);
                                        }
                                    }}
                                    aria-current={isActive ? 'page' : undefined}
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
            )}
        </main>
    );
};
