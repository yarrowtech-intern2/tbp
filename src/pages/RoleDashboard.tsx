import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Bell,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ClipboardList,
    CircleHelp,
    Compass,
    Contact2,
    ExternalLink,
    FileText,
    Heart,
    Home,
    LayoutDashboard,
    Loader2,
    LogOut,
    Mail,
    Megaphone,
    MessageSquare,
    Menu,
    MapPin,
    Package,
    RadioTower,
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
    type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { LiquidMobileNav, type LiquidNavItem } from '../components/ui/liquid-mobile-nav';
import { MOBILE_NAV_ICON_SRC } from '../components/ui/mobile-nav-icon-map';
import { useAuth } from '../hooks/useAuth';
import { useAppTutorial } from '../context/app-tutorial-context-value';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { getProfileAvatarUrl } from '../lib/avatar';
import { uploadCloudinaryImage } from '../lib/cloudinaryUpload';
import {
    getAdminAccountLocations,
    getBookings,
    getContentModerationQueue,
    getConversations,
    getActivePaidAds,
    getAdminBookings,
    getFavoriteListings,
    getListingReviewSummaryMap,
    getListingReviewsForListingIds,
    getModerationAuditLogs,
    getMyAds,
    getMyPosts,
    getPosts,
    getProviderBookings,
    respondToBookingRequest,
    submitRefundRequest,
    updateRefundRequest,
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
import { isProviderRole, normalizeRoleValue, resolveEffectiveAccountRole } from '../lib/platform';
import { deriveBookingAmounts } from '../lib/pricing';
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
import { DEFAULT_SALES_SETTINGS, getPublicAppContent, type SalesSettingsContent } from '../lib/appContent';
import { ContactSubmissionsPanel } from '../components/contact/ContactSubmissionsPanel';
import { CrmPanel } from '../components/admin/CrmPanel';
import { MarketingContentEditor, SalesSettingsEditor } from '../components/marketing/MarketingContentEditor';
import { FeeBreakdownView } from '../components/FeeBreakdownView';
import {
    formatRouteDistance,
    formatRouteDuration,
    getTouristRouteHistory,
    type RouteHistoryRecord,
} from '../lib/routePlanner';
import { isVirtualTourRecord } from '../lib/virtualTours';
import './role-dashboard.css';

type DashboardRole = 'tourist' | 'provider' | 'admin' | 'marketing';

type SidebarKey =
    | 'overview'
    | 'revenue'
    | 'explore'
    | 'virtualTours'
    | 'bookings'
    | 'routes'
    | 'favorites'
    | 'listings'
    | 'advertisements'
    | 'studio'
    | 'messages'
    | 'content'
    | 'greetings'
    | 'contact'
    | 'inquiries'
    | 'crm'
    | 'about'
    | 'moderation'
    | 'accepted'
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
    bookings: UnifiedBooking[];
    revenue: number;
    revenueRows: AdminRevenueBookingRow[];
    activeAds: PaidAdRecord[];
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
    provider_payout_amount: number;
    platform_fee_amount: number;
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
    provider_payout_amount: number;
    platform_fee_amount: number;
};

type NavItem = {
    key: SidebarKey;
    label: string;
    icon: LucideIcon;
    iconSrc?: string;
};

type MobileNavItem = {
    id: string;
    label: string;
    icon: LucideIcon;
    iconSrc?: string;
    section?: SidebarKey;
    countKey?: SidebarKey;
    to?: string;
};

const ADMIN_PRIMARY_NAV_KEYS: SidebarKey[] = [
    'overview',
    'moderation',
    'bookings',
    'revenue',
    'messages',
];

const ADMIN_MOBILE_PRIMARY_NAV_KEYS: SidebarKey[] = [
    'overview',
    'moderation',
    'bookings',
    'revenue',
    'messages',
];

const ADMIN_TOPBAR_NAV_KEYS: SidebarKey[] = [
    'moderation',
    'inquiries',
];

const ADMIN_DEFAULT_SECTION_OPTIONS: SidebarKey[] = [
    'overview',
    'bookings',
    'revenue',
    'moderation',
    'messages',
    'content',
    'inquiries',
    'crm',
];

const ADMIN_REFRESH_INTERVAL_OPTIONS = [
    { label: '15 seconds', value: 15000 },
    { label: '30 seconds', value: 30000 },
    { label: '1 minute', value: 60000 },
    { label: '2 minutes', value: 120000 },
] as const;

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
const MAX_PROMO_IMAGE_MB = 8;

const normalizeRoleParam = (value?: string): DashboardRole | null => {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    if (v === 'tourist') return 'tourist';
    if (v === 'provider' || v === 'vendor') return 'provider';
    if (v === 'admin') return 'admin';
    if (v === 'marketing') return 'marketing';
    return null;
};

const effectiveRoleFromProfile = (role?: string | null): DashboardRole => {
    const normalizedRole = normalizeRoleValue(role);
    if (normalizedRole === 'admin') return 'admin';
    if (normalizedRole === 'marketing') return 'marketing';
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

type RevenuePerspective = 'tourist' | 'provider' | 'admin_platform';

const sumBookedRevenue = (rows: Array<Record<string, unknown>>, perspective: RevenuePerspective): number => rows.reduce((sum, row) => {
    const status = String(row.status || '').toLowerCase();
    const paymentStatus = String(row.payment_status || '').toLowerCase();
    const hasPaidAt = typeof row.paid_at === 'string' && row.paid_at.trim().length > 0;
    if (status === 'cancelled' || status === 'rejected' || paymentStatus === 'refunded') return sum;
    if (paymentStatus !== 'paid' && !hasPaidAt) return sum;
    const amounts = deriveBookingAmounts({
        unitPrice: toFiniteNumber(row.unit_price),
        totalPrice: toFiniteNumber(row.total_price),
        numberOfPeople: toFiniteNumber(row.number_of_people),
        platformFeeRate: toFiniteNumber(row.platform_fee_rate) || null,
        platformFeeAmount: toFiniteNumber(row.platform_fee_amount) || null,
        providerPayoutAmount: toFiniteNumber(row.provider_payout_amount) || null,
    });
    if (perspective === 'provider') return sum + amounts.provider_payout_amount;
    if (perspective === 'admin_platform') return sum + amounts.platform_fee_amount;
    return sum + amounts.total_price;
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

const buildAccountRevenueRow = (item: UnifiedBooking, perspective: RevenuePerspective): AccountRevenueRow => {
    const status = String(item.status || '').trim().toLowerCase();
    const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
    const amounts = deriveBookingAmounts({
        unitPrice: toFiniteNumber(item.unit_price),
        totalPrice: toFiniteNumber(item.total_price),
        numberOfPeople: toFiniteNumber(item.number_of_people),
        platformFeeRate: toFiniteNumber(item.platform_fee_rate) || null,
        platformFeeAmount: toFiniteNumber(item.platform_fee_amount) || null,
        providerPayoutAmount: toFiniteNumber(item.provider_payout_amount) || null,
    });
    const revenueAmount = perspective === 'provider'
        ? amounts.provider_payout_amount
        : perspective === 'admin_platform'
            ? amounts.platform_fee_amount
            : amounts.total_price;
    const revenueAmountSource = toFiniteNumber(item.total_price) > 0 ? 'total_price' : 'unit_price_x_people';
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
        total_price: amounts.total_price,
        unit_price: amounts.provider_unit_price,
        number_of_people: amounts.number_of_people,
        revenue_amount: revenueAmount,
        revenue_amount_source: revenueAmountSource,
        included_in_revenue: includedInRevenue,
        exclusion_reason: exclusionReason,
        traveler_id: String(item.user_id || ''),
        provider_id: String(item.provider_user_id || ''),
        traveler_name: item.traveler_name || null,
        traveler_email: item.traveler_email || null,
        traveler_phone: item.traveler_phone || null,
        provider_payout_amount: amounts.provider_payout_amount,
        platform_fee_amount: amounts.platform_fee_amount,
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
const normalizePostType = (type: string | null | undefined): 'tour' | 'activity' | 'guide' => {
    if (type === 'tour') return 'tour';
    if (type === 'guide' || type === 'event') return 'guide';
    return 'activity';
};
const listingTypeLabel = (type: string | null | undefined) => {
    const normalized = normalizePostType(type);
    if (normalized === 'tour') return 'Tours';
    if (normalized === 'guide') return 'Events';
    return 'Activities';
};
const VIRTUAL_TOUR_TAGS = ['virtual tour', 'live 360', '360', 'vr tour', 'ar tour', 'virtual', 'remote tour'];
const LIVE_ROOM_STATUSES = new Set(['confirmed', 'completed', 'accepted']);
const textValue = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const hasVirtualTourSignal = (value: string) => {
    const normalized = value.toLowerCase();
    return VIRTUAL_TOUR_TAGS.some((tag) => normalized.includes(tag));
};
const isVirtualTourListing = (item: PostRecord) => {
    if (isVirtualTourRecord(item)) return true;
    return hasVirtualTourSignal([
        item.sub_category,
        item.category,
        titleForPost(item),
        item.description,
        item.location,
    ].map(textValue).filter(Boolean).join(' '));
};
const isVirtualTourBooking = (item: UnifiedBooking, listing?: PostRecord) => (
    item.is_virtual_tour === true
    || Boolean(listing && isVirtualTourListing(listing))
    || hasVirtualTourSignal([
        item.listing_title,
        item.listing_type,
    ].map(textValue).filter(Boolean).join(' '))
);
const isLiveRoomUnlocked = (item: UnifiedBooking) => {
    const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
    const paid = paymentStatus === 'paid' || Boolean(item.paid_at) || Boolean(item.payment_id);
    return paid && LIVE_ROOM_STATUSES.has(String(item.status || '').trim().toLowerCase());
};
const getVirtualTourRoomPath = (item: UnifiedBooking) => `/virtual-tours/live/${encodeURIComponent(item.id)}`;
const postStatus = (item: PostRecord) => (item.status || '').toLowerCase();
const isModerationPost = (item: PostRecord) => {
    const status = postStatus(item);
    return status === 'pending' || status === 'resubmitted';
};
const isAcceptedPost = (item: PostRecord) => {
    const status = postStatus(item);
    return status === 'approved' || status === 'live' || status === 'published';
};
const dedupePostRows = (rows: PostRecord[]) => {
    const seen = new Set<string>();
    return rows.filter((item) => {
        const id = String(item.id || '').trim();
        if (!id) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

const normalizeRefundStatus = (value: string | null | undefined) => {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'completed' || normalized === 'refunded') return 'completed';
    if (normalized === 'processing' || normalized === 'in_progress' || normalized === 'in-progress') return 'processing';
    if (normalized === 'pending' || normalized === 'requested') return 'pending';
    return '';
};

const hasPaidSignalForBooking = (item: UnifiedBooking) => {
    const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
    return paymentStatus === 'paid' || Boolean(item.paid_at) || Boolean(item.payment_id);
};

const canBookingRequestRefund = (item: UnifiedBooking) => {
    const bookingStatus = String(item.status || '').trim().toLowerCase();
    const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
    const refundStatus = normalizeRefundStatus(item.refund_status);
    const cancelledOrRejected = bookingStatus === 'rejected' || bookingStatus === 'cancelled';
    return cancelledOrRejected
        && hasPaidSignalForBooking(item)
        && paymentStatus !== 'refunded'
        && refundStatus !== 'pending'
        && refundStatus !== 'processing'
        && refundStatus !== 'completed'
        && !item.refund_requested_at;
};

const parseTouristSection = (value: string | null): SidebarKey | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'overview') return 'overview';
    if (normalized === 'explore') return 'explore';
    if (normalized === 'virtual' || normalized === 'virtualtours' || normalized === 'virtual-tours' || normalized === 'virtual_tours' || normalized === 'live' || normalized === 'live-tours' || normalized === 'live_tours') return 'virtualTours';
    if (normalized === 'bookings') return 'bookings';
    if (normalized === 'routes' || normalized === 'history' || normalized === 'route-history') return 'routes';
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
    if (normalized === 'virtual' || normalized === 'virtualtours' || normalized === 'virtual-tours' || normalized === 'virtual_tours' || normalized === 'live' || normalized === 'live-tours' || normalized === 'live_tours') return 'virtualTours';
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
    if (normalized === 'bookings' || normalized === 'refunds' || normalized === 'refund') return 'bookings';
    if (normalized === 'content' || normalized === 'marketing' || normalized === 'copy') return 'content';
    if (normalized === 'inquiries' || normalized === 'leads' || normalized === 'contact-leads' || normalized === 'contact-submissions') return 'inquiries';
    if (normalized === 'crm' || normalized === 'pipeline') return 'crm';
    if (normalized === 'messages') return 'messages';
    if (normalized === 'notifications') return 'messages';
    if (normalized === 'revenue') return 'revenue';
    if (normalized === 'moderation') return 'moderation';
    if (normalized === 'accepted' || normalized === 'approved') return 'accepted';
    if (normalized === 'rejected') return 'rejected';
    if (normalized === 'users') return 'users';
    if (normalized === 'map') return 'map';
    if (normalized === 'audits' || normalized === 'audit') return 'audits';
    return null;
};

const parseMarketingSection = (value: string | null): SidebarKey | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (normalized === 'overview' || normalized === 'dashboard') return 'overview';
    if (normalized === 'greetings' || normalized === 'edit-greetings' || normalized === 'edit_greetings') return 'greetings';
    if (normalized === 'contact' || normalized === 'contact-info' || normalized === 'edit-contact-info' || normalized === 'informatics') return 'contact';
    if (normalized === 'inquiries' || normalized === 'leads' || normalized === 'contact-leads' || normalized === 'contact-submissions') return 'inquiries';
    if (normalized === 'crm' || normalized === 'pipeline') return 'crm';
    if (normalized === 'about' || normalized === 'about-us' || normalized === 'about_us' || normalized === 'edit-about') return 'about';
    if (normalized === 'content' || normalized === 'marketing' || normalized === 'copy') return 'greetings';
    if (normalized === 'messages' || normalized === 'notifications') return 'messages';
    return null;
};

const getSectionParser = (role: DashboardRole) => {
    if (role === 'admin') return parseAdminSection;
    if (role === 'provider') return parseProviderSection;
    if (role === 'marketing') return parseMarketingSection;
    return parseTouristSection;
};

const normalizeSectionForRole = (role: DashboardRole, value: string | null): SidebarKey => {
    const parser = getSectionParser(role);
    return parser(value) || 'overview';
};

const getNotificationDashboardSection = (
    item: AppNotificationRecord,
    role: DashboardRole,
): SidebarKey | null => {
    const route = getNotificationRoute(item, role);
    if (route?.startsWith('/messages')) return 'messages';

    if (route?.startsWith('/dashboard')) {
        const routeRole: DashboardRole = route.includes('/dashboard/admin')
            ? 'admin'
            : route.includes('/dashboard/provider')
                ? 'provider'
                : route.includes('/dashboard/marketing')
                    ? 'marketing'
                    : route.includes('/dashboard/tourist')
                        ? 'tourist'
                        : role;
        const sectionMatch = route.match(/[?&]section=([^&]+)/);
        if (!sectionMatch) return null;
        const section = decodeURIComponent(sectionMatch[1].replace(/\+/g, ' '));
        return normalizeSectionForRole(routeRole, section);
    }

    if (item.type === 'message_new') return 'messages';
    if (item.type.startsWith('refund_')) return 'bookings';
    if (item.type.startsWith('booking_')) return 'bookings';
    if (item.type.startsWith('payment_')) return role === 'admin' ? 'revenue' : 'bookings';
    if (item.type === 'listing_submitted' || item.type === 'listing_resubmitted') {
        return role === 'admin' ? 'moderation' : 'studio';
    }
    if (item.type === 'listing_approved' || item.type === 'listing_rejected') {
        return role === 'provider' ? 'studio' : null;
    }
    if (item.type === 'verification_submitted' || item.type === 'verification_resubmitted') {
        return role === 'admin' ? 'moderation' : null;
    }

    return null;
};

const getDashboardSectionStorageKey = (role: DashboardRole) => `tbp.dashboard.active-section.${role}`;
const ADMIN_DEFAULT_SECTION_STORAGE_KEY = 'tbp.dashboard.admin.default-section';
const ADMIN_REFRESH_INTERVAL_STORAGE_KEY = 'tbp.dashboard.admin.refresh-interval-ms';
const ADMIN_COMPACT_NAV_STORAGE_KEY = 'tbp.dashboard.admin.compact-nav';

const LazyAdminAccountMap = lazy(async () => {
    const module = await import('../components/admin/AdminAccountMap');
    return { default: module.AdminAccountMap };
});

const LazyProviderStudio = lazy(async () => {
    const module = await import('./ProviderStudio');
    return { default: module.ProviderStudio };
});

type ChartPalette = {
    accent: string;
    text: string;
    textStrong: string;
    grid: string;
    neutral: string;
    neutralDark: string;
};

const getChartPalette = (_themeKey?: string): ChartPalette => {
    void _themeKey;

    if (typeof window === 'undefined') {
        return {
            accent: '#ff6700',
            text: '#4d4f55',
            textStrong: '#111114',
            grid: 'rgba(20, 20, 22, 0.12)',
            neutral: '#b7b7bd',
            neutralDark: '#2f2f33',
        };
    }

    const styles = getComputedStyle(document.documentElement);
    const pick = (name: string, fallback: string) => {
        const value = styles.getPropertyValue(name).trim();
        return value || fallback;
    };

    return {
        accent: pick('--accent', '#ff6700'),
        text: pick('--rdb-admin-text', '#4d4f55'),
        textStrong: pick('--rdb-admin-text-strong', '#111114'),
        grid: pick('--rdb-admin-chip', 'rgba(20, 20, 22, 0.12)'),
        neutral: '#b7b7bd',
        neutralDark: '#2f2f33',
    };
};

const AdminBarChart: React.FC<{
    data: Array<{ month: string; count: number; isCurrentMonth: boolean }>;
    themeKey: string;
}> = ({ data, themeKey }) => {
    const palette = useMemo(() => getChartPalette(themeKey), [themeKey]);
    const chart = useMemo(() => {
        const maxValue = Math.max(1, ...data.map((item) => item.count));
        const width = 420;
        const height = 180;
        const padding = { top: 12, right: 10, bottom: 34, left: 10 };
        const plotWidth = width - padding.left - padding.right;
        const plotHeight = height - padding.top - padding.bottom;
        const slotWidth = plotWidth / Math.max(1, data.length);
        const barWidth = Math.min(44, slotWidth * 0.58);

        return { width, height, padding, plotHeight, slotWidth, barWidth, maxValue };
    }, [data]);

    return (
        <div className="rdb-admin-echart-wrap rdb-admin-echart-wrap--bar" role="img" aria-label={`Monthly activity: ${data.map((item) => `${item.month} ${item.count}`).join(', ')}`}>
            <svg className="rdb-admin-svg-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" aria-hidden="true">
                {[0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = chart.padding.top + (chart.plotHeight * ratio);
                    return (
                        <line
                            key={ratio}
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={y}
                            y2={y}
                            stroke={palette.grid}
                            strokeWidth="1"
                        />
                    );
                })}
                {data.map((item, index) => {
                    const normalizedValue = Math.max(0, item.count) / chart.maxValue;
                    const barHeight = Math.max(item.count > 0 ? 8 : 2, normalizedValue * chart.plotHeight);
                    const x = chart.padding.left + (index * chart.slotWidth) + ((chart.slotWidth - chart.barWidth) / 2);
                    const y = chart.padding.top + chart.plotHeight - barHeight;

                    return (
                        <g key={`${item.month}-${index}`}>
                            <rect
                                x={x}
                                y={y}
                                width={chart.barWidth}
                                height={barHeight}
                                rx="10"
                                fill={item.isCurrentMonth ? palette.accent : palette.neutral}
                            />
                            <text
                                x={chart.padding.left + (index * chart.slotWidth) + (chart.slotWidth / 2)}
                                y={chart.height - 12}
                                textAnchor="middle"
                                fill={palette.text}
                                fontSize="12"
                                fontWeight="600"
                            >
                                {item.month}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

const AdminLineChart: React.FC<{ data: number[]; themeKey: string }> = ({ data, themeKey }) => {
    const palette = useMemo(() => getChartPalette(themeKey), [themeKey]);
    const chart = useMemo(() => {
        const width = 420;
        const height = 154;
        const padding = 12;
        const maxValue = Math.max(1, ...data);
        const points = data.map((value, index) => {
            const x = data.length <= 1
                ? width / 2
                : padding + ((width - (padding * 2)) * index) / (data.length - 1);
            const y = height - padding - ((Math.max(0, value) / maxValue) * (height - (padding * 2)));
            return { x, y, value };
        });
        const linePoints = points.map((point) => `${point.x},${point.y}`).join(' ');
        const areaPoints = points.length > 0
            ? `${padding},${height - padding} ${linePoints} ${width - padding},${height - padding}`
            : '';

        return { width, height, padding, points, linePoints, areaPoints };
    }, [data]);

    return (
        <div className="rdb-admin-echart-wrap rdb-admin-echart-wrap--line" role="img" aria-label={`Daily activity: ${data.map((value, index) => `Day ${index + 1} ${value}`).join(', ')}`}>
            <svg className="rdb-admin-svg-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="none" aria-hidden="true">
                {chart.areaPoints ? (
                    <polygon points={chart.areaPoints} fill="rgba(255, 103, 0, 0.12)" />
                ) : null}
                {chart.linePoints ? (
                    <polyline
                        points={chart.linePoints}
                        fill="none"
                        stroke={palette.accent}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : null}
                {chart.points.map((point, index) => (
                    <circle
                        key={`${point.x}-${index}`}
                        cx={point.x}
                        cy={point.y}
                        r="4.4"
                        fill={palette.textStrong}
                        stroke={palette.accent}
                        strokeWidth="2"
                    />
                ))}
            </svg>
        </div>
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

const RoleDonutChart: React.FC<{ segments: RoleChartSegment[]; centerValue: number; label: string; themeKey: string }> = ({
    segments,
    centerValue,
    label,
    themeKey,
}) => {
    const palette = useMemo(() => getChartPalette(themeKey), [themeKey]);
    const normalizedSegments = segments
        .map((segment) => ({ ...segment, value: Math.max(0, Math.round(segment.value)) }))
        .filter((segment) => segment.value > 0);
    const donutBackground = useMemo(() => {
        if (normalizedSegments.length === 0) return palette.neutral;
        const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
        let cursor = 0;

        return `conic-gradient(${normalizedSegments.map((segment) => {
            const start = (cursor / total) * 360;
            cursor += segment.value;
            const end = (cursor / total) * 360;
            return `${segment.color} ${start}deg ${end}deg`;
        }).join(', ')})`;
    }, [normalizedSegments, palette.neutral]);
    const ariaText = `${label}: ${segments.map((segment) => `${segment.label} ${Math.max(0, Math.round(segment.value))}`).join(', ')}`;

    return (
        <div className="rdb-role-donut" role="img" aria-label={ariaText}>
            <span className="rdb-role-donut-chart" style={{ background: donutBackground }} aria-hidden="true" />
            <strong>{Math.max(0, Math.round(centerValue))}</strong>
        </div>
    );
};

export const RoleDashboard: React.FC = () => {
    const { user, profile, profileLoading, signOut } = useAuth();
    const { openTutorial } = useAppTutorial();
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
    const handleSignOut = async () => {
        await signOut();
        navigate('/login', { replace: true });
    };
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
    const requestedMarketingSection = useMemo(
        () => parseMarketingSection(searchParams.get('section')),
        [searchParams],
    );
    const requestedLocalGuideCreate = searchParams.get('create') === 'live-tour';
    const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const resolvedAccountRole = useMemo(
        () => resolveEffectiveAccountRole(profile?.role, metadataRole),
        [metadataRole, profile?.role],
    );
    const effectiveRole = useMemo(
        () => effectiveRoleFromProfile(resolvedAccountRole),
        [resolvedAccountRole],
    );
    const requestedSection = useMemo(() => {
        if (effectiveRole === 'admin') return requestedAdminSection;
        if (effectiveRole === 'provider') {
            if (resolvedAccountRole === 'local_guide' && requestedProviderSection === 'studio') {
                return 'virtualTours';
            }
            return requestedProviderSection;
        }
        if (effectiveRole === 'marketing') return requestedMarketingSection;
        return requestedTouristSection;
    }, [effectiveRole, requestedAdminSection, requestedMarketingSection, requestedProviderSection, requestedTouristSection, resolvedAccountRole]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [touristBookings, setTouristBookings] = useState<UnifiedBooking[]>([]);
    const [touristFavorites, setTouristFavorites] = useState<FavoriteListingRecord[]>([]);
    const [touristConversations, setTouristConversations] = useState<ConversationRecord[]>([]);
    const [touristRoutes, setTouristRoutes] = useState<RouteHistoryRecord[]>([]);

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
    const [adminBookings, setAdminBookings] = useState<UnifiedBooking[]>([]);
    const [adminAccountLocations, setAdminAccountLocations] = useState<AdminAccountLocationRecord[]>([]);
    const [adminRevenueRows, setAdminRevenueRows] = useState<AdminRevenueBookingRow[]>([]);
    const [adminActiveAds, setAdminActiveAds] = useState<PaidAdRecord[]>([]);
    const [salesSettings, setSalesSettings] = useState<SalesSettingsContent>(DEFAULT_SALES_SETTINGS);
    const [selectedModerationId, setSelectedModerationId] = useState<string | null>(null);
    const [selectedAcceptedId, setSelectedAcceptedId] = useState<string | null>(null);
    const [selectedRejectedId, setSelectedRejectedId] = useState<string | null>(null);
    const [adminRevenueDb, setAdminRevenueDb] = useState(0);
    const [adminMobileMenuOpen, setAdminMobileMenuOpen] = useState(false);
    const [adminModerationSearch, setAdminModerationSearch] = useState('');
    const [mapFetching, setMapFetching] = useState(false);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [providerBookingStatusFilter, setProviderBookingStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'rejected'>('all');
    const [providerPaymentStatusFilter, setProviderPaymentStatusFilter] = useState<'all' | 'pending' | 'paid' | 'refunded'>('all');
    const [providerPackageTypeFilter, setProviderPackageTypeFilter] = useState<'all' | 'tour' | 'activity' | 'guide'>('all');
    const [providerBookingDateFrom, setProviderBookingDateFrom] = useState('');
    const [providerBookingDateTo, setProviderBookingDateTo] = useState('');
    const [providerBookingSearch, setProviderBookingSearch] = useState('');
    const [providerBookingActionId, setProviderBookingActionId] = useState<string | null>(null);
    const [touristRefundActionId, setTouristRefundActionId] = useState<string | null>(null);
    const [touristRefundReasonByBookingId, setTouristRefundReasonByBookingId] = useState<Record<string, string>>({});
    const [adminRefundActionId, setAdminRefundActionId] = useState<string | null>(null);
    const [adminRefundNoteByBookingId, setAdminRefundNoteByBookingId] = useState<Record<string, string>>({});
    const [adminRefundReferenceByBookingId, setAdminRefundReferenceByBookingId] = useState<Record<string, string>>({});
    const [adminDefaultSection, setAdminDefaultSection] = useState<SidebarKey>(() => {
        if (typeof window === 'undefined') return 'overview';
        try {
            return parseAdminSection(window.localStorage.getItem(ADMIN_DEFAULT_SECTION_STORAGE_KEY)) || 'overview';
        } catch {
            return 'overview';
        }
    });
    const [adminRefreshIntervalMs, setAdminRefreshIntervalMs] = useState<number>(() => {
        if (typeof window === 'undefined') return 30000;
        try {
            const raw = Number(window.localStorage.getItem(ADMIN_REFRESH_INTERVAL_STORAGE_KEY));
            return ADMIN_REFRESH_INTERVAL_OPTIONS.some((item) => item.value === raw) ? raw : 30000;
        } catch {
            return 30000;
        }
    });
    const [adminCompactNav, setAdminCompactNav] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        try {
            const raw = window.localStorage.getItem(ADMIN_COMPACT_NAV_STORAGE_KEY);
            return raw === null ? true : raw === 'true';
        } catch {
            return true;
        }
    });
    const [showAdminRecentActivity, setShowAdminRecentActivity] = useState(false);
    const [localGuideBuilderOpen, setLocalGuideBuilderOpen] = useState(false);
    const defaultDashboardSection: SidebarKey = effectiveRole === 'admin'
        ? adminDefaultSection
        : effectiveRole === 'provider' && resolvedAccountRole === 'local_guide'
            ? 'virtualTours'
            : 'overview';

    const fetchAdminDashboardSnapshot = useCallback(async (): Promise<AdminDashboardSnapshot> => {
        const [posts, queuePosts, verifications, audits, usersResult, bookingsResult, revenueResult, activeAds, adminBookings] = await Promise.all([
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
                .select('*')
                .order('created_at', { ascending: false }),
            supabase.rpc('get_admin_revenue'),
            getActivePaidAds(),
            getAdminBookings(),
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
            const amounts = deriveBookingAmounts({
                unitPrice: toFiniteNumber(row.unit_price),
                totalPrice: toFiniteNumber(row.total_price),
                numberOfPeople: toFiniteNumber(row.number_of_people),
                platformFeeRate: toFiniteNumber(row.platform_fee_rate) || null,
                platformFeeAmount: toFiniteNumber(row.platform_fee_amount) || null,
                providerPayoutAmount: toFiniteNumber(row.provider_payout_amount) || null,
            });
            const revenueAmount = amounts.platform_fee_amount;
            const revenueAmountSource = toFiniteNumber(row.total_price) > 0 ? 'total_price' : 'unit_price_x_people';
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
                total_price: amounts.total_price,
                unit_price: amounts.provider_unit_price,
                number_of_people: amounts.number_of_people,
                revenue_amount: revenueAmount,
                revenue_amount_source: revenueAmountSource,
                provider_payout_amount: amounts.provider_payout_amount,
                platform_fee_amount: amounts.platform_fee_amount,
                included_in_revenue: includedInRevenue,
                exclusion_reason: exclusionReason,
            };
        });
        return {
            posts,
            queuePosts,
            verifications,
            audits,
            users: usersResult.error ? [] : (usersResult.data as AdminProfileRow[] || []),
            bookings: adminBookings,
            revenue: sumBookedRevenue(bookingRows, 'admin_platform'),
            revenueRows: detailedRevenueRows,
            activeAds,
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
        if (isDesktopDashboard) {
            setAdminMobileMenuOpen(false);
        }
    }, [isDesktopDashboard]);

    useEffect(() => {
        setAdminMobileMenuOpen(false);
    }, [activeSection]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(ADMIN_DEFAULT_SECTION_STORAGE_KEY, adminDefaultSection);
        } catch {
            // Ignore storage failures.
        }
    }, [adminDefaultSection]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(ADMIN_REFRESH_INTERVAL_STORAGE_KEY, String(adminRefreshIntervalMs));
        } catch {
            // Ignore storage failures.
        }
    }, [adminRefreshIntervalMs]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(ADMIN_COMPACT_NAV_STORAGE_KEY, String(adminCompactNav));
        } catch {
            // Ignore storage failures.
        }
    }, [adminCompactNav]);

    useEffect(() => {
        if (!routeRole || routeRole !== effectiveRole) return;

        const parsedSection = requestedSection
            || (typeof window === 'undefined'
                ? null
                : (() => {
                    try {
                        const savedSection = getSectionParser(effectiveRole)(
                            window.localStorage.getItem(getDashboardSectionStorageKey(effectiveRole)),
                        );
                        if (
                            effectiveRole === 'provider'
                            && resolvedAccountRole === 'local_guide'
                            && savedSection === 'overview'
                        ) {
                            return null;
                        }
                        return savedSection;
                    } catch {
                        return null;
                    }
                })())
            || defaultDashboardSection;
        const nextSection = !requestedSection && parsedSection === 'messages'
            ? defaultDashboardSection
            : parsedSection;

        setActiveSection(nextSection);

        if (!requestedSection) {
            const nextSearchParams = new URLSearchParams(searchParams);
            nextSearchParams.set('section', nextSection);
            navigate(
                { pathname: `/dashboard/${effectiveRole}`, search: `?${nextSearchParams.toString()}` },
                { replace: true },
            );
        }
    }, [defaultDashboardSection, effectiveRole, navigate, requestedSection, resolvedAccountRole, routeRole, searchParams]);

    useEffect(() => {
        if (
            !routeRole
            || routeRole !== effectiveRole
            || effectiveRole !== 'provider'
            || resolvedAccountRole !== 'local_guide'
            || requestedProviderSection !== 'studio'
        ) {
            return;
        }

        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set('section', 'virtual-tours');
        navigate(
            { pathname: '/dashboard/provider', search: `?${nextSearchParams.toString()}` },
            { replace: true },
        );
    }, [effectiveRole, navigate, requestedProviderSection, resolvedAccountRole, routeRole, searchParams]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            window.localStorage.setItem(getDashboardSectionStorageKey(effectiveRole), activeSection);
        } catch {
            // Ignore storage failures and keep URL-driven navigation working.
        }
    }, [activeSection, effectiveRole]);

    useEffect(() => {
        if (
            resolvedAccountRole === 'local_guide'
            && activeSection === 'virtualTours'
            && requestedLocalGuideCreate
        ) {
            setLocalGuideBuilderOpen(true);
        }
    }, [activeSection, requestedLocalGuideCreate, resolvedAccountRole]);

    const goToSection = useCallback((section: SidebarKey, replace = true) => {
        const normalizedSection = effectiveRole === 'provider' && resolvedAccountRole === 'local_guide' && section === 'studio'
            ? 'virtualTours'
            : normalizeSectionForRole(effectiveRole, section);
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set('section', normalizedSection);
        setActiveSection(normalizedSection);
        navigate(
            { pathname: `/dashboard/${effectiveRole}`, search: `?${nextSearchParams.toString()}` },
            { replace },
        );
    }, [effectiveRole, navigate, resolvedAccountRole, searchParams]);

    const openDashboardSection = useCallback((section: SidebarKey) => {
        if (section === 'messages') {
            setAdminMobileMenuOpen(false);
            navigate('/messages');
            return;
        }
        goToSection(section);
        setAdminMobileMenuOpen(false);
    }, [goToSection, navigate]);

    const openNotifications = useCallback(() => {
        setAdminMobileMenuOpen(false);
        navigate('/notifications');
    }, [navigate]);

    const unreadActiveSectionNotificationKey = useMemo(() => (
        centerNotifications
            .filter((item) => !item.is_read && getNotificationDashboardSection(item, effectiveRole) === activeSection)
            .map((item) => item.id)
            .join('|')
    ), [activeSection, centerNotifications, effectiveRole]);

    useEffect(() => {
        if (!unreadActiveSectionNotificationKey) return;
        void Promise.all(
            unreadActiveSectionNotificationKey
                .split('|')
                .filter(Boolean)
                .map((notificationId) => markAsRead(notificationId)),
        );
    }, [markAsRead, unreadActiveSectionNotificationKey]);

    useEffect(() => {
        if (activeSection !== 'messages') return;
        navigate('/messages', { replace: true });
    }, [activeSection, navigate]);

    const loadAdminAccountLocations = useCallback(async (force = false) => {
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
    }, [effectiveRole, mapFetching, mapLoaded]);

    useEffect(() => {
        if (!user || profileLoading) return;
        let cancelled = false;

        const run = async () => {
            setLoading(true);
            setError(null);
            try {
                if (effectiveRole === 'tourist') {
                    const [bookings, favorites, conversations, routes] = await Promise.all([
                        getBookings(user.id),
                        getFavoriteListings(user.id),
                        getConversations(user.id),
                        getTouristRouteHistory(user.id),
                    ]);
                    if (cancelled) return;
                    setTouristBookings(bookings);
                    setTouristFavorites(favorites);
                    setTouristConversations(conversations);
                    setTouristRoutes(routes);
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

                if (effectiveRole === 'admin' || effectiveRole === 'marketing') {
                    const [adminSnapshot, appContent] = await Promise.all([
                        fetchAdminDashboardSnapshot(),
                        getPublicAppContent(),
                    ]);
                    if (cancelled) return;
                    setAdminPublishedPosts(adminSnapshot.posts);
                    setAdminQueuePosts(adminSnapshot.queuePosts);
                    setAdminVerifications(adminSnapshot.verifications);
                    setAdminAuditLogs(adminSnapshot.audits);
                    setAdminUsers(adminSnapshot.users);
                    setAdminBookings(adminSnapshot.bookings);
                    setAdminRevenueDb(adminSnapshot.revenue);
                    setAdminRevenueRows(adminSnapshot.revenueRows);
                    setAdminActiveAds(adminSnapshot.activeAds);
                    setSalesSettings(appContent.salesSettings);
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
                setAdminBookings(snapshot.bookings);
                setAdminRevenueDb(snapshot.revenue);
                setAdminRevenueRows(snapshot.revenueRows);
                setAdminActiveAds(snapshot.activeAds);
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
        }, adminRefreshIntervalMs);

        return () => {
            disposed = true;
            window.clearInterval(refreshInterval);
            void supabase.removeChannel(channel);
        };
    }, [adminRefreshIntervalMs, effectiveRole, fetchAdminDashboardSnapshot, profileLoading, user]);

    useEffect(() => {
        if (effectiveRole !== 'admin' || activeSection !== 'map') return;
        setMapLoaded(false);
        setAdminAccountLocations([]);
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
                { key: 'content', label: 'Content', icon: Megaphone },
                { key: 'inquiries', label: 'Contact Leads', icon: Mail },
                { key: 'crm', label: 'CRM', icon: Contact2 },
                { key: 'bookings', label: 'Refunds', icon: ClipboardList },
                { key: 'revenue', label: 'Revenue', icon: CalendarDays, iconSrc: MOBILE_NAV_ICON_SRC.revenue },
                { key: 'moderation', label: 'Moderation', icon: SquarePen },
                { key: 'accepted', label: 'Accepted', icon: CheckCircle2 },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
                { key: 'users', label: 'Users', icon: Users },
                { key: 'map', label: 'Map', icon: MapPin },
                { key: 'audits', label: 'Settings', icon: Settings2 },
                { key: 'rejected', label: 'Rejected', icon: Shield },
            ];
        }
        if (effectiveRole === 'provider') {
            const providerNavItems: NavItem[] = [
                { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                { key: 'bookings', label: 'Bookings', icon: ClipboardList },
                { key: 'virtualTours', label: 'Live Tours', icon: RadioTower, iconSrc: MOBILE_NAV_ICON_SRC.virtualTours },
                { key: 'revenue', label: 'Revenue', icon: CalendarDays, iconSrc: MOBILE_NAV_ICON_SRC.revenue },
                { key: 'studio', label: 'Studio', icon: SquarePen },
                { key: 'listings', label: 'Listings', icon: Package },
                { key: 'advertisements', label: 'Advertisements', icon: Megaphone },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
            ];

            if (resolvedAccountRole === 'local_guide') {
                return [
                    providerNavItems[2],
                    providerNavItems[1],
                    providerNavItems[3],
                    { ...providerNavItems[5], label: 'Live Listings' },
                    providerNavItems[7],
                    providerNavItems[0],
                ];
            }

            return providerNavItems;
        }
        if (effectiveRole === 'marketing') {
            return [
                { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
                { key: 'greetings', label: 'Edit Greetings', icon: SquarePen },
                { key: 'about', label: 'Edit About', icon: FileText },
                { key: 'contact', label: 'Edit Contact Info', icon: Megaphone },
                { key: 'inquiries', label: 'Contact Leads', icon: Mail },
                { key: 'crm', label: 'CRM', icon: Contact2 },
                { key: 'messages', label: 'Messages', icon: MessageSquare },
            ];
        }
        return [
            { key: 'overview', label: 'Dashboard', icon: LayoutDashboard },
            { key: 'explore', label: 'Explore', icon: Compass },
            { key: 'virtualTours', label: 'Live Tours', icon: RadioTower, iconSrc: MOBILE_NAV_ICON_SRC.virtualTours },
            { key: 'bookings', label: 'Bookings', icon: ClipboardList },
            { key: 'revenue', label: 'Spend', icon: CalendarDays, iconSrc: MOBILE_NAV_ICON_SRC.spending },
            { key: 'messages', label: 'Messages', icon: MessageSquare },
            { key: 'favorites', label: 'Favorites', icon: Heart },
        ];
    }, [effectiveRole, resolvedAccountRole]);

    const mobileNavItems = useMemo<MobileNavItem[]>(() => {
        if (effectiveRole === 'admin') {
            const coreItems = ADMIN_MOBILE_PRIMARY_NAV_KEYS
                .map((key) => navItems.find((item) => item.key === key))
                .filter((item): item is NavItem => Boolean(item));
            const activeItem = activeSection !== 'map' && activeSection !== 'content'
                ? navItems.find((item) => item.key === activeSection)
                : undefined;
            const compactItems = activeItem && !coreItems.some((item) => item.key === activeItem.key)
                ? [activeItem, ...coreItems.filter((item) => item.key !== activeItem.key)].slice(0, 5)
                : coreItems.slice(0, 5);

            return compactItems
                .map((item) => ({ id: item.key, label: item.label, icon: item.icon, iconSrc: item.iconSrc, section: item.key, countKey: item.key }));
        }
        if (effectiveRole === 'provider') {
            return navItems
                .map((item) => ({ id: item.key, label: item.label, icon: item.icon, iconSrc: item.iconSrc, section: item.key, countKey: item.key }));
        }
        if (effectiveRole === 'marketing') {
            return navItems
                .map((item) => ({ id: item.key, label: item.label, icon: item.icon, iconSrc: item.iconSrc, section: item.key, countKey: item.key }));
        }
        return [
            { id: 'home', label: 'Home', icon: Home, to: '/' },
            { id: 'explore', label: 'Explore', icon: Search, to: '/explore' },
            { id: 'virtualTours', label: 'Live', icon: RadioTower, iconSrc: MOBILE_NAV_ICON_SRC.virtualTours, section: 'virtualTours' },
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'overview' },
            { id: 'bookings', label: 'Bookings', icon: ClipboardList, section: 'bookings' },
            { id: 'spending', label: 'Spend', icon: CalendarDays, iconSrc: MOBILE_NAV_ICON_SRC.spending, section: 'revenue' },
            { id: 'profile', label: 'Profile', icon: UserCircle2, to: '/profile' },
        ];
    }, [activeSection, effectiveRole, navItems]);

    const adminSidebarNavItems = useMemo(() => {
        if (effectiveRole !== 'admin') return navItems;
        if (!adminCompactNav) return navItems;
        return navItems.filter((item) => ADMIN_PRIMARY_NAV_KEYS.includes(item.key));
    }, [adminCompactNav, effectiveRole, navItems]);

    const adminTopbarNavItems = useMemo(() => {
        if (effectiveRole !== 'admin' || !adminCompactNav) return [];
        return navItems.filter((item) => ADMIN_TOPBAR_NAV_KEYS.includes(item.key));
    }, [adminCompactNav, effectiveRole, navItems]);

    const query = search.trim().toLowerCase();

    const touristMetrics = useMemo(() => {
        const completed = touristBookings.filter((item) => item.status === 'completed').length;
        const upcoming = touristBookings.filter((item) => {
            if (item.status !== 'pending' && item.status !== 'confirmed') return false;
            if (!item.booking_date) return true;
            return new Date(item.booking_date).getTime() >= Date.now() - 86400000;
        }).length;
        const spend = touristBookings
            .map((item) => buildAccountRevenueRow(item, 'tourist'))
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
            .map((item) => buildAccountRevenueRow(item, 'provider'))
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
        let marketingCount = 0;
        let companyCount = 0;
        let instructorCount = 0;
        let guideCount = 0;
        let localGuideCount = 0;
        for (const row of adminUsers) {
            const role = normalizeRoleValue(row.role || null);
            if (role === 'admin') {
                adminCount += 1;
            } else if (role === 'marketing') {
                marketingCount += 1;
            } else if (role === 'tour_company') {
                providerCount += 1;
                companyCount += 1;
            } else if (role === 'tour_instructor') {
                providerCount += 1;
                instructorCount += 1;
            } else if (role === 'tour_guide') {
                providerCount += 1;
                guideCount += 1;
            } else if (role === 'local_guide') {
                providerCount += 1;
                localGuideCount += 1;
            } else if (isProviderRole(role)) {
                providerCount += 1;
            } else {
                touristCount += 1;
            }
        }

        const allAdminPackageRows = dedupePostRows([...adminPublishedPosts, ...adminQueuePosts]);
        const pendingPosts = allAdminPackageRows.filter(isModerationPost).length;
        const rejectedPosts = adminQueuePosts.filter((item) => item.status === 'rejected').length;
        const approvedPosts = allAdminPackageRows.filter(isAcceptedPost).length;

        return {
            totalPackages: packageIds.size,
            totalUsers: adminUsers.length,
            adminCount,
            marketingCount,
            providerCount,
            touristCount,
            companyCount,
            instructorCount,
            guideCount,
            localGuideCount,
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

    const salesMetrics = useMemo(() => {
        const includedRows = adminRevenueRows.filter((item) => item.included_in_revenue);
        const totalRevenue = includedRows.reduce((sum, item) => sum + item.total_price, 0);
        const platformFeeRevenue = includedRows.reduce((sum, item) => sum + item.platform_fee_amount, 0);

        const packageMap = new Map<string, { title: string; count: number; revenue: number }>();
        adminRevenueRows.forEach((item) => {
            const title = item.listing_title || 'Untitled package';
            const existing = packageMap.get(title) || { title, count: 0, revenue: 0 };
            existing.count += 1;
            if (item.included_in_revenue) existing.revenue += item.total_price;
            packageMap.set(title, existing);
        });

        const packageRows = Array.from(packageMap.values());
        const topPackages = [...packageRows]
            .sort((a, b) => b.count - a.count || b.revenue - a.revenue || a.title.localeCompare(b.title))
            .slice(0, 6);
        const lowestPackages = [...packageRows]
            .sort((a, b) => a.count - b.count || a.revenue - b.revenue || a.title.localeCompare(b.title))
            .slice(0, 6);

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthly = new Array(12).fill(0);
        includedRows.forEach((item) => {
            const sourceDate = item.paid_at || item.booking_date || item.created_at;
            if (!sourceDate) return;
            const date = new Date(sourceDate);
            if (date.getFullYear() === currentYear) {
                monthly[date.getMonth()] += item.total_price;
            }
        });
        const start = Math.max(0, currentMonth - 4);
        const monthlySales = months.slice(start, currentMonth + 1).map((month, index) => ({
            month,
            count: Math.round(monthly[start + index]),
            isCurrentMonth: start + index === currentMonth,
        }));

        return {
            totalBookings: adminRevenueRows.length,
            totalRevenue,
            platformFeeRevenue,
            activeAds: adminActiveAds.length,
            topPackages,
            lowestPackages,
            monthlySales,
            recentBookings: [...adminRevenueRows]
                .sort((a, b) => new Date(b.created_at || b.booking_date || 0).getTime() - new Date(a.created_at || a.booking_date || 0).getTime())
                .slice(0, 10),
        };
    }, [adminActiveAds.length, adminRevenueRows]);

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
        .filter((item) => !query || `${item.listing_title || ''} ${item.status || ''} ${item.payment_status || ''} ${item.refund_status || ''} ${item.refund_request_reason || ''}`.toLowerCase().includes(query));

    const touristRevenueRows = touristBookings.map((item) => buildAccountRevenueRow(item, 'tourist'));
    const touristRevenueFilteredRows = touristRevenueRows
        .filter((item) => !query || `${item.id} ${item.listing_title} ${item.listing_type} ${item.payment_id} ${item.payment_order_id} ${item.status} ${item.payment_status}`.toLowerCase().includes(query));

    const favoriteRows = touristFavorites
        .filter((item) => !query || `${item.title || ''} ${item.location || ''} ${item.listing_type || ''}`.toLowerCase().includes(query));

    const touristRouteRows = touristRoutes
        .filter((item) => !query || [
            item.title,
            item.city,
            item.start_name,
            item.destination_name,
            item.stop_names.join(' '),
            item.travel_mode,
        ].join(' ').toLowerCase().includes(query));

    const touristRouteMetrics = useMemo(() => {
        const totalDistanceMeters = touristRoutes.reduce((sum, item) => sum + (item.distance_meters || 0), 0);
        const citySet = new Set(touristRoutes.map((item) => item.city).filter(Boolean));
        return {
            totalRoutes: touristRoutes.length,
            totalDistanceMeters,
            cityCount: citySet.size,
            latestRoute: touristRoutes[0] || null,
        };
    }, [touristRoutes]);

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

    const touristVirtualBookingRows = touristRows
        .filter((item) => isVirtualTourBooking(item));

    const providerVirtualListingRows = providerRows
        .filter((item) => isVirtualTourListing(item));

    const providerVirtualListingIds = useMemo(
        () => new Set(providerVirtualListingRows.map((item) => String(item.id || '').trim()).filter(Boolean)),
        [providerVirtualListingRows],
    );

    const providerVirtualBookingRows = providerBookingRows
        .filter((item) => (
            providerVirtualListingIds.has(String(item.listing_id || '').trim())
            || isVirtualTourBooking(item, providerListingMap.get(String(item.listing_id || '').trim()))
        ));

    const touristVirtualMetrics = {
        total: touristVirtualBookingRows.length,
        paid: touristVirtualBookingRows.filter(hasPaidSignalForBooking).length,
        ready: touristVirtualBookingRows.filter(isLiveRoomUnlocked).length,
    };

    const providerVirtualMetrics = {
        listings: providerVirtualListingRows.length,
        paidRequests: providerVirtualBookingRows.filter(hasPaidSignalForBooking).length,
        ready: providerVirtualBookingRows.filter(isLiveRoomUnlocked).length,
    };

    const providerRevenueRows = providerBookings.map((item) => buildAccountRevenueRow(item, 'provider'));
    const providerRevenueFilteredRows = providerRevenueRows
        .filter((item) => !query || `${item.id} ${item.listing_title} ${item.listing_type} ${item.payment_id} ${item.payment_order_id} ${item.status} ${item.payment_status} ${item.traveler_name || ''} ${item.traveler_email || ''}`.toLowerCase().includes(query));

    const providerBookingFilteredRows = useMemo(() => {
        const fromTime = providerBookingDateFrom ? new Date(`${providerBookingDateFrom}T00:00:00`).getTime() : null;
        const toTime = providerBookingDateTo ? new Date(`${providerBookingDateTo}T23:59:59`).getTime() : null;
        const bookingSearchQuery = providerBookingSearch.trim().toLowerCase();

        return providerBookingRows.filter((item) => {
            if (providerBookingStatusFilter !== 'all' && (item.status || '').toLowerCase() !== providerBookingStatusFilter) return false;
            if (providerPaymentStatusFilter !== 'all' && (item.payment_status || 'pending').toLowerCase() !== providerPaymentStatusFilter) return false;
            if (providerPackageTypeFilter !== 'all' && (item.listing_type || '').toLowerCase() !== providerPackageTypeFilter) return false;
            if (bookingSearchQuery) {
                const searchable = [
                    item.listing_title,
                    item.listing_type,
                    item.id,
                    item.user_id,
                    item.traveler_name,
                    item.traveler_email,
                    item.traveler_phone,
                    item.payment_order_id,
                    item.payment_id,
                    item.payment_currency,
                    item.status,
                    item.payment_status,
                    item.booking_date,
                    item.created_at,
                ].filter(Boolean).join(' ').toLowerCase();
                if (!searchable.includes(bookingSearchQuery)) return false;
            }

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
        providerBookingSearch,
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

    const handleTouristRefundRequest = async (booking: UnifiedBooking) => {
        if (!user?.id) return;

        const bookingId = String(booking.id || '').trim();
        if (!bookingId) {
            alert('Booking id is missing.');
            return;
        }

        const reason = (touristRefundReasonByBookingId[bookingId] || '').trim();
        if (!reason) {
            alert('Please add a refund reason before submitting.');
            return;
        }

        setTouristRefundActionId(bookingId);
        try {
            const updated = await submitRefundRequest({
                bookingId,
                travelerUserId: user.id,
                reason,
            });

            setTouristBookings((current) => current.map((item) => (
                item.id === bookingId ? updated : item
            )));
            setTouristRefundReasonByBookingId((current) => ({ ...current, [bookingId]: '' }));
            await refreshNotifications();
        } catch (error) {
            console.error('Refund request submission failed:', error);
            alert(error instanceof Error ? error.message : 'Could not submit refund request.');
        } finally {
            setTouristRefundActionId(null);
        }
    };

    const handleAdminRefundUpdate = async (
        booking: UnifiedBooking,
        status: 'processing' | 'completed'
    ) => {
        if (!user?.id) return;

        const bookingId = String(booking.id || '').trim();
        if (!bookingId) {
            alert('Booking id is missing.');
            return;
        }

        setAdminRefundActionId(bookingId);
        try {
            const updated = await updateRefundRequest({
                bookingId,
                adminUserId: user.id,
                status,
                adminNote: adminRefundNoteByBookingId[bookingId] ?? booking.refund_admin_note ?? '',
                refundReference: adminRefundReferenceByBookingId[bookingId] ?? booking.refund_reference ?? '',
            });

            setAdminBookings((current) => current.map((item) => (
                item.id === bookingId ? updated : item
            )));
            await refreshNotifications();
        } catch (error) {
            console.error('Refund update failed:', error);
            alert(error instanceof Error ? error.message : 'Could not update refund status.');
        } finally {
            setAdminRefundActionId(null);
        }
    };

    const allAdminPackageRows = dedupePostRows([...adminPublishedPosts, ...adminQueuePosts]);

    const adminModerationQuery = adminModerationSearch.trim().toLowerCase();

    const adminQueueRows = allAdminPackageRows
        .filter(isModerationPost)
        .filter((item) => {
            if (query && !`${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query)) return false;
            if (!adminModerationQuery) return true;
            return [
                item.id,
                item.provider_user_id,
                item.user_id,
                titleForPost(item),
                item.status,
                item.type,
                item.location,
                item.description,
                item.created_at,
            ].filter(Boolean).join(' ').toLowerCase().includes(adminModerationQuery);
        });

    const adminAcceptedRows = allAdminPackageRows
        .filter(isAcceptedPost)
        .filter((item) => !query || `${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const adminRejectedRows = allAdminPackageRows
        .filter((item) => (item.status || '').toLowerCase() === 'rejected')
        .filter((item) => !query || `${titleForPost(item)} ${item.status || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const selectedModerationItem = useMemo(
        () => adminQueueRows.find((item) => item.id === selectedModerationId) || null,
        [adminQueueRows, selectedModerationId],
    );

    const selectedAcceptedItem = useMemo(
        () => adminAcceptedRows.find((item) => item.id === selectedAcceptedId) || null,
        [adminAcceptedRows, selectedAcceptedId],
    );

    const adminAuditRows = adminAuditLogs
        .filter((item) => !query || `${item.entity_type} ${item.action} ${item.entity_id}`.toLowerCase().includes(query));

    const adminRevenueFilteredRows = adminRevenueRows
        .filter((item) => !query || `${item.id} ${item.listing_title} ${item.listing_type} ${item.payment_id} ${item.payment_order_id} ${item.traveler_id} ${item.provider_id} ${item.status} ${item.payment_status}`.toLowerCase().includes(query));

    const adminNotificationRows = centerNotifications
        .filter((item) => !query || `${item.title || ''} ${item.body || ''} ${item.type || ''}`.toLowerCase().includes(query));

    const adminUserRows = adminUsers
        .filter((item) => !query || `${item.full_name || ''} ${item.email || ''} ${item.role || ''}`.toLowerCase().includes(query));

    const adminBookingRows = adminBookings
        .filter((item) => !query || `${item.id || ''} ${item.listing_title || ''} ${item.status || ''} ${item.payment_status || ''} ${item.refund_status || ''} ${item.traveler_name || ''} ${item.traveler_email || ''} ${item.refund_request_reason || ''}`.toLowerCase().includes(query));

    const adminRefundRows = adminBookingRows
        .filter((item) => {
            const refundStatus = normalizeRefundStatus(item.refund_status);
            const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
            return Boolean(refundStatus || item.refund_requested_at || paymentStatus === 'refunded');
        });

    const adminRefundPendingCount = adminRefundRows.filter((item) => normalizeRefundStatus(item.refund_status) === 'pending').length;
    const adminRefundProcessingCount = adminRefundRows.filter((item) => normalizeRefundStatus(item.refund_status) === 'processing').length;
    const adminRefundCompletedCount = adminRefundRows.filter((item) => {
        const refundStatus = normalizeRefundStatus(item.refund_status);
        const paymentStatus = String(item.payment_status || '').trim().toLowerCase();
        return refundStatus === 'completed' || paymentStatus === 'refunded';
    }).length;

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

    useEffect(() => {
        if (effectiveRole !== 'admin') return;
        if (!adminAcceptedRows.length) {
            setSelectedAcceptedId(null);
            return;
        }
        const selectedStillVisible = selectedAcceptedId
            ? adminAcceptedRows.some((item) => item.id === selectedAcceptedId)
            : false;
        if (!selectedStillVisible) {
            setSelectedAcceptedId(adminAcceptedRows[0].id);
        }
    }, [adminAcceptedRows, effectiveRole, selectedAcceptedId]);

    const getBookingDetailPath = (item: UnifiedBooking): string | null => {
        const listingId = typeof item.listing_id === 'string' ? item.listing_id.trim() : '';
        if (!listingId) return null;
        return `/listings/${toListingPathType(item.listing_type)}/${listingId}`;
    };
    const userName = profile?.full_name || user?.email?.split('@')[0] || 'User';
    const userEmail = user?.email || '';
    const userAvatarSrc = getProfileAvatarUrl(profile?.profile_image_url, user?.id, profile?.full_name, user?.email);

    const sectionCounts: Partial<Record<SidebarKey, number>> = useMemo(() => {
        return centerNotifications.reduce<Partial<Record<SidebarKey, number>>>((counts, item) => {
            if (item.is_read) return counts;
            const section = getNotificationDashboardSection(item, effectiveRole);
            if (!section) return counts;
            counts[section] = (counts[section] || 0) + 1;
            return counts;
        }, {});
    }, [centerNotifications, effectiveRole]);

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
        return uploadCloudinaryImage(file, {
            folder: `${user.id}/promotions`,
            fileNamePrefix: 'promo-ad',
            tags: ['tbp', 'promotion', 'ad'],
        });
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
        if (activeSection === 'virtualTours') {
            return (
                <section className="rdb-content-grid rdb-virtual-tour-section">
                    <article className="rdb-panel">
                        <h2>Live 360 Tours</h2>
                        <div className="rdb-stat-list">
                            <div><span>Virtual Slots</span><strong>{touristVirtualMetrics.total}</strong></div>
                            <div><span>Paid Slots</span><strong>{touristVirtualMetrics.paid}</strong></div>
                            <div><span>Ready Rooms</span><strong>{touristVirtualMetrics.ready}</strong></div>
                            <div><span>Status</span><strong>{touristVirtualMetrics.ready > 0 ? 'Join' : 'Book'}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <Link to="/virtual-tours" className="rdb-inline-link">Open Live Tours</Link>
                            <Link to="/explore?tab=guides" className="rdb-inline-link">Book Slot</Link>
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>My Virtual Slots</h2>
                            <small>{query ? `Filtered by "${search}"` : `${touristVirtualBookingRows.length} records`}</small>
                        </div>
                        <div className="rdb-provider-bookings-grid rdb-virtual-tour-list">
                            {touristVirtualBookingRows.slice(0, 10).map((item) => {
                                const bookingPath = getBookingDetailPath(item);
                                const bookingStatus = String(item.status || 'pending').toLowerCase();
                                const paymentStatus = String(item.payment_status || 'pending').toLowerCase();
                                const liveUnlocked = isLiveRoomUnlocked(item);
                                return (
                                    <article key={item.id} className="rdb-provider-booking-card rdb-virtual-tour-card">
                                        <div className="rdb-provider-booking-head">
                                            <div>
                                                <p>{item.listing_title || 'Live virtual tour'}</p>
                                                <small>{formatDateTime(item.booking_date || item.created_at)}</small>
                                            </div>
                                            <div className="rdb-provider-booking-pills">
                                                <span className={`rdb-pill rdb-pill-${bookingStatus}`}>{bookingStatus}</span>
                                                <span className={`rdb-pill rdb-pill-${paymentStatus}`}>{paymentStatus}</span>
                                            </div>
                                        </div>
                                        <div className="rdb-provider-booking-meta">
                                            <div><span>Travelers</span><strong>{item.number_of_people || 1}</strong></div>
                                            <div><span>Total Paid</span><strong>{formatCurrency(item.total_price || 0)}</strong></div>
                                            <div><span>Booking ID</span><strong>{item.id || 'N/A'}</strong></div>
                                            <div><span>Room</span><strong>{liveUnlocked ? 'Unlocked' : 'Locked'}</strong></div>
                                        </div>
                                        <div className="rdb-provider-booking-actions">
                                            {liveUnlocked ? (
                                                <Link to={getVirtualTourRoomPath(item)} className="rdb-row-edit-link rdb-row-edit-link--approve">
                                                    Join Live Room
                                                </Link>
                                            ) : bookingPath ? (
                                                <Link to={bookingPath} className="rdb-row-edit-link">
                                                    View Booking
                                                </Link>
                                            ) : null}
                                            <Link to="/messages" className="rdb-row-edit-link">Open Messages</Link>
                                        </div>
                                    </article>
                                );
                            })}
                            {touristVirtualBookingRows.length === 0 && (
                                <p className="rdb-empty">No virtual tour slots yet. Book a Live 360 event to unlock this area.</p>
                            )}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'bookings') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Bookings</h2>
                        <small>{query ? `Filtered by "${search}"` : `${touristRows.length} records`}</small>
                    </div>
                    <div className="rdb-provider-bookings-grid">
                        {touristRows.slice(0, 16).map((item) => {
                            const bookingPath = getBookingDetailPath(item);
                            const bookingStatus = String(item.status || 'pending').toLowerCase();
                            const paymentStatus = String(item.payment_status || 'pending').toLowerCase();
                            const refundStatus = normalizeRefundStatus(item.refund_status) || (paymentStatus === 'refunded' ? 'completed' : '');
                            const refundPillTone = refundStatus === 'completed' ? 'refunded' : refundStatus === 'processing' ? 'pending' : refundStatus;
                            const canRequestRefund = canBookingRequestRefund(item);
                            const refundActionLoading = touristRefundActionId === item.id;

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
                                            {refundStatus && (
                                                <span className={`rdb-pill rdb-pill-${refundPillTone}`}>
                                                    refund {refundStatus}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="rdb-provider-booking-meta">
                                        <div><span>Date</span><strong>{formatDate(item.booking_date || item.created_at)}</strong></div>
                                        <div><span>Travelers</span><strong>{item.number_of_people || 0}</strong></div>
                                        <div><span>Total Paid</span><strong>{formatCurrency(item.total_price || 0)}</strong></div>
                                        <div><span>Booking ID</span><strong>{item.id || 'N/A'}</strong></div>
                                        <div><span>Order ID</span><strong>{item.payment_order_id || 'N/A'}</strong></div>
                                        <div><span>Payment ID</span><strong>{item.payment_id || 'N/A'}</strong></div>
                                        {item.rejection_reason && <div><span>Rejection Reason</span><strong>{item.rejection_reason}</strong></div>}
                                        {item.refund_request_reason && <div><span>Refund Reason</span><strong>{item.refund_request_reason}</strong></div>}
                                        {item.refund_admin_note && <div><span>Admin Note</span><strong>{item.refund_admin_note}</strong></div>}
                                        {item.refund_reference && <div><span>Refund Ref</span><strong>{item.refund_reference}</strong></div>}
                                    </div>

                                    <div className="rdb-provider-booking-actions">
                                        {bookingPath && (
                                            <Link to={bookingPath} className="rdb-row-edit-link">
                                                View Package
                                            </Link>
                                        )}
                                        <button
                                            type="button"
                                            className="rdb-row-edit-link"
                                            onClick={() => navigate('/messages')}
                                        >
                                            Open Messages
                                        </button>
                                    </div>

                                    {(canRequestRefund || refundStatus) && (
                                        <div className="rdb-refund-panel">
                                            <div className="rdb-refund-panel-head">
                                                <strong>Refund</strong>
                                                {refundStatus && <span className={`rdb-pill rdb-pill-${refundPillTone}`}>{refundStatus}</span>}
                                            </div>
                                            {canRequestRefund ? (
                                                <>
                                                    <textarea
                                                        className="rdb-refund-textarea"
                                                        rows={3}
                                                        placeholder="Reason for requesting the refund"
                                                        value={touristRefundReasonByBookingId[item.id] || ''}
                                                        onChange={(event) => setTouristRefundReasonByBookingId((current) => ({
                                                            ...current,
                                                            [item.id]: event.target.value,
                                                        }))}
                                                    />
                                                    <div className="rdb-provider-booking-actions">
                                                        <button
                                                            type="button"
                                                            className="rdb-row-edit-link rdb-row-edit-link--approve"
                                                            onClick={() => void handleTouristRefundRequest(item)}
                                                            disabled={refundActionLoading}
                                                        >
                                                            {refundActionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Submit Refund Request'}
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="rdb-refund-note">
                                                    {refundStatus === 'completed'
                                                        ? 'The refund has already been completed.'
                                                        : refundStatus === 'processing'
                                                            ? 'Admin is processing this refund manually.'
                                                            : refundStatus === 'pending'
                                                                ? 'Your refund request is pending admin review.'
                                                                : 'Refund requests become available after a rejected or cancelled paid booking.'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                        {touristRows.length === 0 && <p className="rdb-empty">No matching bookings.</p>}
                    </div>
                </section>
            );
        }

        if (activeSection === 'routes') {
            return (
                <section className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Route History</h2>
                        <small>{query ? `Filtered by "${search}"` : `${touristRouteRows.length} records`}</small>
                    </div>

                    {touristRoutes.length > 0 ? (
                        <div className="rdb-stat-list">
                            <div><span>Total Routes</span><strong>{touristRouteMetrics.totalRoutes}</strong></div>
                            <div><span>Cities Covered</span><strong>{touristRouteMetrics.cityCount}</strong></div>
                            <div><span>Total Distance</span><strong>{formatRouteDistance(touristRouteMetrics.totalDistanceMeters)}</strong></div>
                            <div><span>Latest</span><strong>{touristRouteMetrics.latestRoute?.title || 'N/A'}</strong></div>
                        </div>
                    ) : null}

                    <div className="rdb-action-list">
                        <Link to="/map" className="rdb-inline-link">Create another route</Link>
                        <button type="button" className="rdb-inline-link" onClick={() => goToSection('overview')}>Back to dashboard</button>
                    </div>

                    <div className="rdb-list">
                        {touristRouteRows.slice(0, 24).map((item) => (
                            <div key={item.client_route_id} className="rdb-list-row">
                                <div>
                                    <p>{item.title}</p>
                                    <small>
                                        {item.city || 'Custom trip'} - {item.travel_mode} - {formatRouteDistance(item.distance_meters)} - {formatRouteDuration(item.duration_seconds)}
                                    </small>
                                    <small>
                                {item.start_name} to {item.destination_name}
                                {item.recommended_places.length
                                    ? ` - ${item.recommended_places.filter((place) => place.visited).length}/${item.recommended_places.length} visited`
                                    : item.stop_names.length
                                      ? ` - ${item.stop_names.length} stop${item.stop_names.length === 1 ? '' : 's'}`
                                      : ''}
                            </small>
                        </div>
                                <small>{formatDate(item.visited_at)}</small>
                            </div>
                        ))}
                        {touristRouteRows.length === 0 && (
                            <p className="rdb-empty">
                                No route history yet. Build one from the <Link to="/map">map route creator</Link>.
                            </p>
                        )}
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
                                        <small>Total paid: {formatCurrency(item.total_price)} | Provider payout: {formatCurrency(item.provider_payout_amount)} | Platform fee: {formatCurrency(item.platform_fee_amount)}</small>
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
                <section className="rdb-content-grid rdb-tourist-explore-grid">
                    <article className="rdb-panel rdb-tourist-snapshot-panel">
                        <h2>Travel Snapshot</h2>
                        <div className="rdb-stat-list rdb-tourist-snapshot-list">
                            <div><span>Upcoming Trips</span><strong>{touristMetrics.upcoming}</strong></div>
                            <div><span>Completed Trips</span><strong>{touristMetrics.completed}</strong></div>
                            <div><span>Saved Places</span><strong>{touristFavorites.length}</strong></div>
                            <div><span>Total Spend</span><strong>{formatCurrency(touristMetrics.spend)}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-tourist-actions-panel">
                        <h2>Quick Actions</h2>
                        <div className="rdb-action-list rdb-tourist-action-list">
                            <Link to="/?tab=tours" className="rdb-inline-link">Open tours</Link>
                            <Link to="/?tab=activities" className="rdb-inline-link">Open activities</Link>
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
                                themeKey={theme}
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
                                onClick={() => goToSection('revenue')}
                                title="Open spend breakdown"
                            >
                                <ExternalLink size={15} />
                            </button>
                        </div>
                        <strong className="rdb-admin-light-card-number rdb-admin-light-card-number--revenue">{formatRupeeShort(touristMetrics.spend)}</strong>
                    </article>
                </div>

                <div className="rdb-admin-charts-row">
                    <button
                        type="button"
                        className="rdb-admin-chart-card rdb-route-history-card"
                        onClick={() => goToSection('routes')}
                    >
                        <div className="rdb-route-history-card-head">
                            <div>
                                <p className="rdb-admin-light-card-title">Routes</p>
                                <h3>Route History</h3>
                            </div>
                            <span className="rdb-route-history-card-arrow">
                                <ExternalLink size={16} />
                            </span>
                        </div>
                        <p>
                            {touristRouteMetrics.totalRoutes > 0
                                ? `${touristRouteMetrics.totalRoutes} saved route${touristRouteMetrics.totalRoutes === 1 ? '' : 's'} across ${touristRouteMetrics.cityCount || 1} cit${touristRouteMetrics.cityCount === 1 ? 'y' : 'ies'}`
                                : 'Create city routes on the map and review them later here.'}
                        </p>
                        <div className="rdb-route-history-card-stats">
                            <div>
                                <span>Total Distance</span>
                                <strong>{formatRouteDistance(touristRouteMetrics.totalDistanceMeters)}</strong>
                            </div>
                            <div>
                                <span>Latest</span>
                                <strong>{touristRouteMetrics.latestRoute?.city || 'No routes yet'}</strong>
                            </div>
                        </div>
                        <div className="rdb-admin-mod-list rdb-admin-mod-list--compact">
                            {touristRoutes.slice(0, 2).map((item) => (
                                <span key={item.client_route_id} className="rdb-admin-mod-item">
                                    {item.title} • {formatRouteDuration(item.duration_seconds)}
                                </span>
                            ))}
                            {touristRoutes.length === 0 && (
                                <span className="rdb-admin-mod-item rdb-admin-mod-item--empty">No route history yet</span>
                            )}
                        </div>
                    </button>

                    <article className="rdb-admin-chart-card rdb-bookings-chart-card">
                        <h3>Bookings</h3>
                        <p>Total count per month</p>
                        <AdminBarChart data={touristMonthlyBookings} themeKey={theme} />
                    </article>

                    <article className="rdb-admin-chart-card rdb-trip-activity-card">
                        <h3>Trip Activity</h3>
                        <div className="rdb-admin-mod-list">
                            {touristRows.slice(0, 3).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-admin-mod-item"
                                    onClick={() => goToSection('bookings')}
                                >
                                    {item.listing_title || 'Package'} • {item.status}
                                </button>
                            ))}
                            {touristRows.length === 0 && (
                                <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No bookings yet</p>
                            )}
                        </div>
                        <AdminLineChart data={touristActivityTrend} themeKey={theme} />
                    </article>
                </div>
            </>
        );
    };

    const renderProviderSection = () => {
        if (activeSection === 'virtualTours') {
            return (
                <section className="rdb-content-grid rdb-virtual-tour-section">
                    <article className="rdb-panel">
                        <h2>Live 360 Console</h2>
                        <div className="rdb-stat-list">
                            <div><span>Virtual Listings</span><strong>{providerVirtualMetrics.listings}</strong></div>
                            <div><span>Paid Requests</span><strong>{providerVirtualMetrics.paidRequests}</strong></div>
                            <div><span>Ready Rooms</span><strong>{providerVirtualMetrics.ready}</strong></div>
                            <div><span>Role</span><strong>{resolvedAccountRole === 'local_guide' ? 'Local Guide' : 'Provider'}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <Link to="/virtual-tours" className="rdb-inline-link">Open Live Console</Link>
                            {resolvedAccountRole === 'local_guide' ? (
                                <button
                                    type="button"
                                    className="rdb-inline-link"
                                    onClick={() => setLocalGuideBuilderOpen((open) => !open)}
                                >
                                    {localGuideBuilderOpen ? 'Hide Live Tour Form' : 'Create Live AR/VR Tour'}
                                </button>
                            ) : (
                                <button type="button" className="rdb-inline-link" onClick={() => goToSection('studio')}>Create Virtual Listing</button>
                            )}
                        </div>
                    </article>

                    {resolvedAccountRole === 'local_guide' && localGuideBuilderOpen && (
                        <div id="create-live-tour" className="rdb-panel-wide rdb-live-tour-builder">
                            <Suspense fallback={<div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading live tour form...</p></div>}>
                                <LazyProviderStudio embedded />
                            </Suspense>
                        </div>
                    )}

                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Virtual Tour Requests</h2>
                            <small>{query ? `Filtered by "${search}"` : `${providerVirtualBookingRows.length} records`}</small>
                        </div>
                        <div className="rdb-provider-bookings-grid rdb-virtual-tour-list">
                            {providerVirtualBookingRows.slice(0, 12).map((item) => {
                                const bookingPath = getBookingDetailPath(item);
                                const bookingStatus = String(item.status || 'pending').toLowerCase();
                                const paymentStatus = String(item.payment_status || 'pending').toLowerCase();
                                const travelerId = typeof item.user_id === 'string' ? item.user_id.trim() : '';
                                const hasPaidSignal = hasPaidSignalForBooking(item);
                                const canDecideBooking = bookingStatus === 'pending' && hasPaidSignal;
                                const liveUnlocked = isLiveRoomUnlocked(item);
                                const actionLoading = providerBookingActionId === item.id;
                                return (
                                    <article key={item.id} className="rdb-provider-booking-card rdb-virtual-tour-card">
                                        <div className="rdb-provider-booking-head">
                                            <div>
                                                <p>{item.listing_title || 'Live virtual tour'}</p>
                                                <small>{formatDateTime(item.booking_date || item.created_at)}</small>
                                            </div>
                                            <div className="rdb-provider-booking-pills">
                                                <span className={`rdb-pill rdb-pill-${bookingStatus}`}>{bookingStatus}</span>
                                                <span className={`rdb-pill rdb-pill-${paymentStatus}`}>{paymentStatus}</span>
                                            </div>
                                        </div>
                                        <div className="rdb-provider-booking-meta">
                                            <div><span>Traveler</span><strong>{item.traveler_name || 'N/A'}</strong></div>
                                            <div><span>Email</span><strong>{item.traveler_email || 'N/A'}</strong></div>
                                            <div><span>Guests</span><strong>{item.number_of_people || 1}</strong></div>
                                            <div><span>Total Paid</span><strong>{formatCurrency(item.total_price || 0)}</strong></div>
                                            <div><span>Booking ID</span><strong>{item.id || 'N/A'}</strong></div>
                                            <div><span>Room</span><strong>{liveUnlocked ? 'Unlocked' : hasPaidSignal ? 'Accept' : 'Payment'}</strong></div>
                                        </div>
                                        <div className="rdb-provider-booking-actions">
                                            {bookingPath && (
                                                <Link to={bookingPath} className="rdb-row-edit-link">
                                                    View Package
                                                </Link>
                                            )}
                                            {travelerId && travelerId !== user?.id && (
                                                <Link
                                                    to={`/messages?user=${encodeURIComponent(travelerId)}`}
                                                    className="rdb-row-edit-link"
                                                >
                                                    Contact Traveler
                                                </Link>
                                            )}
                                            {canDecideBooking && (
                                                <button
                                                    type="button"
                                                    className="rdb-row-edit-link rdb-row-edit-link--approve"
                                                    onClick={() => void handleProviderBookingDecision(item, 'accept')}
                                                    disabled={actionLoading}
                                                >
                                                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Accept Request'}
                                                </button>
                                            )}
                                            {liveUnlocked && (
                                                <Link to={getVirtualTourRoomPath(item)} className="rdb-row-edit-link rdb-row-edit-link--approve">
                                                    Go Live
                                                </Link>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                            {providerVirtualBookingRows.length === 0 && (
                                <p className="rdb-empty">
                                    {resolvedAccountRole === 'local_guide'
                                        ? 'No virtual tour requests yet. Create a Live AR/VR tour and tourists can book paid slots.'
                                        : 'No virtual tour requests yet. Create an event listing tagged as Live 360 Virtual Tour.'}
                                </p>
                            )}
                        </div>
                    </article>
                </section>
            );
        }

        if (activeSection === 'bookings') {
            return (
                <section className="rdb-panel rdb-panel-wide rdb-provider-bookings-panel">
                    <div className="rdb-panel-head">
                        <h2>Provider Bookings</h2>
                        <small>{providerBookingSearch.trim() ? `Filtered by "${providerBookingSearch.trim()}"` : `${providerBookingFilteredRows.length} records`}</small>
                    </div>

                    <div className="rdb-provider-booking-filters">
                        <label className="rdb-provider-booking-search">
                            <Search size={15} aria-hidden="true" />
                            <input
                                type="search"
                                value={providerBookingSearch}
                                onChange={(event) => setProviderBookingSearch(event.target.value)}
                                placeholder="Search traveler, order ID, email, phone"
                                aria-label="Search provider bookings"
                            />
                        </label>

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
                        <h2>Payout Breakdown</h2>
                        <div className="rdb-stat-list">
                            <div><span>Total Payout</span><strong>{formatRupeeShort(providerMetrics.revenue)}</strong></div>
                            <div><span>Contributing Rows</span><strong>{includedRows.length}</strong></div>
                            <div><span>Excluded Rows</span><strong>{excludedRows.length}</strong></div>
                            <div><span>Derived Payout</span><strong>{formatRupeeShort(derivedRevenue)}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Payout Source Rows</h2>
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
                                        <small>Total paid: {formatCurrency(item.total_price)} | Provider payout: {formatCurrency(item.provider_payout_amount)} | Platform fee: {formatCurrency(item.platform_fee_amount)}</small>
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
                <section className="rdb-content-grid rdb-studio-section">
                    <article className="rdb-panel rdb-panel-wide rdb-studio-actions-panel">
                        <h2>Quick actions</h2>
                        <div className="rdb-action-list rdb-studio-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => goToSection('studio')}>Open Studio</button>
                            <button type="button" className="rdb-inline-link" onClick={() => goToSection('studio')}>Create Listing</button>
                            <button type="button" className="rdb-inline-link" onClick={() => goToSection('advertisements')}>Open ads panel</button>
                            <button type="button" className="rdb-inline-link" onClick={() => goToSection('listings')}>View listing statuses</button>
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
                                themeKey={theme}
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
                                onClick={() => goToSection('revenue')}
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
                        <AdminBarChart data={providerMonthlyListings} themeKey={theme} />
                    </article>

                    <article className="rdb-admin-chart-card">
                        <h3>Bookings</h3>
                        <div className="rdb-admin-mod-list">
                            {providerBookingRows.slice(0, 3).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-admin-mod-item"
                                    onClick={() => goToSection('bookings')}
                                >
                                    {item.listing_title || 'Package'} • {item.status}
                                </button>
                            ))}
                            {providerBookingRows.length === 0 && (
                                <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No bookings yet</p>
                            )}
                        </div>
                        <AdminLineChart data={providerBookingTrend} themeKey={theme} />
                    </article>
                </div>
            </>
        );
    };

    const renderMarketingSection = () => {
        if (activeSection === 'greetings') {
            return <MarketingContentEditor userId={user?.id} mode="greetings" />;
        }

        if (activeSection === 'contact') {
            return <MarketingContentEditor userId={user?.id} mode="contact" />;
        }

        if (activeSection === 'inquiries') {
            return <ContactSubmissionsPanel />;
        }

        if (activeSection === 'crm') {
            return <CrmPanel />;
        }

        if (activeSection === 'about') {
            return <MarketingContentEditor userId={user?.id} mode="about" />;
        }

        if (activeSection === 'messages') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Notifications</h2>
                            <small>{centerNotifications.length} records</small>
                        </div>
                        {centerNotifications.length > 0 && (
                            <button type="button" className="rdb-inline-link" onClick={() => void markAllAsRead()}>
                                Mark all as read
                            </button>
                        )}
                        <div className="rdb-list">
                            {centerNotifications.slice(0, 16).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className="rdb-list-row"
                                    onClick={() => void markAsRead(item.id)}
                                >
                                    <div>
                                        <strong>{item.title}</strong>
                                        <small>{item.body || item.type}</small>
                                    </div>
                                    <small>{formatDate(item.created_at)}</small>
                                </button>
                            ))}
                            {centerNotifications.length === 0 && <p className="rdb-empty">No notifications available yet.</p>}
                        </div>
                    </article>
                </section>
            );
        }

        return (
            <section className="rdb-content-grid">
                <div className="rdb-admin-kpi-row">
                    <article className="rdb-admin-dark-card">
                        <div className="rdb-admin-dark-card-layout">
                            <div className="rdb-admin-dark-main">
                                <p className="rdb-admin-dark-card-title">Total</p>
                                <h2 className="rdb-admin-dark-card-heading">Bookings</h2>
                                <strong className="rdb-admin-dark-card-number">{salesMetrics.totalBookings}</strong>
                            </div>
                            <div className="rdb-admin-dark-breakdown">
                                <span>Active ads <strong>{salesMetrics.activeAds}</strong></span>
                                <span>Platform fee <strong>{Math.round(salesSettings.platformFeeRate * 100)}%</strong></span>
                            </div>
                        </div>
                    </article>
                    <article className="rdb-admin-light-card rdb-admin-light-card--revenue">
                        <p className="rdb-admin-light-card-title">Total</p>
                        <h2 className="rdb-admin-light-card-heading">Revenue</h2>
                        <strong className="rdb-admin-light-card-number rdb-admin-light-card-number--revenue">{formatRupeeShort(salesMetrics.totalRevenue)}</strong>
                    </article>
                    <article className="rdb-admin-light-card rdb-admin-light-card--users">
                        <p className="rdb-admin-light-card-title">Platform</p>
                        <h2 className="rdb-admin-light-card-heading">Fee Earned</h2>
                        <strong className="rdb-admin-light-card-number rdb-admin-light-card-number--revenue">{formatRupeeShort(salesMetrics.platformFeeRevenue)}</strong>
                    </article>
                </div>

                <div className="rdb-admin-charts-row">
                    <article className="rdb-admin-chart-card">
                        <h3>Monthly Sales</h3>
                        <p>Paid booking revenue by month</p>
                        <AdminBarChart data={salesMetrics.monthlySales} themeKey={theme} />
                    </article>
                    <article className="rdb-admin-chart-card">
                        <h3>Insights</h3>
                        <div className="rdb-admin-mod-list">
                            {salesMetrics.topPackages.slice(0, 3).map((item) => (
                                <button key={`top-${item.title}`} type="button" className="rdb-admin-mod-item">
                                    {item.title} - {item.count} bookings
                                </button>
                            ))}
                            {salesMetrics.topPackages.length === 0 && <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No booking data yet</p>}
                        </div>
                    </article>
                </div>

                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <div className="rdb-panel-head">
                            <h2>Top Packages</h2>
                            <small>By booking count</small>
                        </div>
                        <div className="rdb-list">
                            {salesMetrics.topPackages.map((item) => (
                                <div className="rdb-list-row" key={`sales-top-${item.title}`}>
                                    <div>
                                        <strong>{item.title}</strong>
                                        <small>{formatCurrency(item.revenue)} revenue</small>
                                    </div>
                                    <span className="rdb-pill rdb-pill-live">{item.count}</span>
                                </div>
                            ))}
                            {salesMetrics.topPackages.length === 0 && <p className="rdb-empty">No packages booked yet.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel">
                        <div className="rdb-panel-head">
                            <h2>Lowest Packages</h2>
                            <small>By booking count</small>
                        </div>
                        <div className="rdb-list">
                            {salesMetrics.lowestPackages.map((item) => (
                                <div className="rdb-list-row" key={`sales-low-${item.title}`}>
                                    <div>
                                        <strong>{item.title}</strong>
                                        <small>{formatCurrency(item.revenue)} revenue</small>
                                    </div>
                                    <span className="rdb-pill">{item.count}</span>
                                </div>
                            ))}
                            {salesMetrics.lowestPackages.length === 0 && <p className="rdb-empty">No packages booked yet.</p>}
                        </div>
                    </article>
                </section>

                <article className="rdb-panel rdb-panel-wide">
                    <div className="rdb-panel-head">
                        <h2>Recent Bookings</h2>
                        <small>{salesMetrics.recentBookings.length} latest</small>
                    </div>
                    <div className="rdb-list">
                        {salesMetrics.recentBookings.map((item) => (
                            <div className="rdb-list-row" key={`sales-booking-${item.id}`}>
                                <div>
                                    <strong>{item.listing_title}</strong>
                                    <small>{item.status} | {item.payment_status} | Platform fee: {formatCurrency(item.platform_fee_amount)}</small>
                                </div>
                                <span className="rdb-pill rdb-pill-live">{formatCurrency(item.total_price)}</span>
                            </div>
                        ))}
                        {salesMetrics.recentBookings.length === 0 && <p className="rdb-empty">No bookings yet.</p>}
                    </div>
                </article>
            </section>
        );
    };

    const renderAdminPackageDetail = (item: PostRecord) => {
        const image = item.image_url || item.cover_image_url || item.thumbnail_url;
        return (
            <div className="rdb-package-expanded">
                <div className="rdb-moderation-detail">
                    <div className="rdb-moderation-media-wrap">
                        <div
                            className="rdb-moderation-media"
                            style={image ? { backgroundImage: `url(${image})` } : undefined}
                        />
                    </div>
                    <div className="rdb-moderation-info">
                        <h3>{titleForPost(item)}</h3>
                        <p className="rdb-moderation-desc">{item.description || 'No description provided.'}</p>
                        <div className="rdb-stat-list">
                            <div><span>Status</span><strong>{item.status || 'pending'}</strong></div>
                            <div><span>Type</span><strong>{item.type || 'listing'}</strong></div>
                            <div><span>Location</span><strong>{item.location || 'N/A'}</strong></div>
                            <div><span>Price</span><strong>{formatCurrency(item.price || 0)}</strong></div>
                            <div><span>Created</span><strong>{formatDate(item.created_at)}</strong></div>
                            <div><span>Reviewed</span><strong>{formatDate(item.reviewed_at || null)}</strong></div>
                            {item.rejection_reason && <div><span>Reason</span><strong>{item.rejection_reason}</strong></div>}
                        </div>
                        <FeeBreakdownView
                            feeBreakdown={item.fee_breakdown}
                            title="Fee breakdown"
                            compact
                            className="rdb-fee-breakdown"
                        />
                        <div className="rdb-moderation-actions">
                            <button
                                type="button"
                                className="rdb-btn"
                                onClick={() => navigate(`/admin/review/${encodeURIComponent(item.id)}`)}
                            >
                                View More Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderAdminPackageGroups = (
        rows: PostRecord[],
        selectedId: string | null,
        setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
        emptyText: string,
    ) => {
        const grouped = (['tour', 'activity', 'guide'] as const).map((type) => ({
            type,
            label: listingTypeLabel(type),
            rows: rows.filter((item) => normalizePostType(item.type || null) === type),
        }));

        if (rows.length === 0) return <p className="rdb-empty">{emptyText}</p>;

        return (
            <div className="rdb-package-groups">
                {grouped.map((group) => (
                    <div key={group.type} className="rdb-package-group">
                        <div className="rdb-package-group-head">
                            <h3>{group.label}</h3>
                            <span>{group.rows.length}</span>
                        </div>
                        {group.rows.length === 0 ? (
                            <p className="rdb-empty rdb-empty-compact">No {group.label.toLowerCase()} in this tab.</p>
                        ) : (
                            <div className="rdb-list">
                                {group.rows.map((item) => {
                                    const isSelected = selectedId === item.id;
                                    return (
                                        <div key={item.id} className="rdb-package-list-item">
                                            <button
                                                type="button"
                                                className={`rdb-list-row rdb-list-row-button${isSelected ? ' is-active' : ''}`}
                                                onClick={() => setSelectedId(item.id)}
                                            >
                                                <div>
                                                    <p>{titleForPost(item)}</p>
                                                    <small>{item.type || 'listing'} - {formatDate(item.created_at)}</small>
                                                </div>
                                                <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>
                                                    {item.status || 'pending'}
                                                </span>
                                            </button>
                                            {isSelected && renderAdminPackageDetail(item)}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderAdminSection = () => {
        if (activeSection === 'content') {
            return <MarketingContentEditor userId={user?.id} mode="contact" />;
        }

        if (activeSection === 'inquiries') {
            return <ContactSubmissionsPanel />;
        }

        if (activeSection === 'crm') {
            return <CrmPanel />;
        }

        if (activeSection === 'bookings') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Refund Queue</h2>
                        <div className="rdb-stat-list">
                            <div><span>Requests</span><strong>{adminRefundRows.length}</strong></div>
                            <div><span>Pending</span><strong>{adminRefundPendingCount}</strong></div>
                            <div><span>Processing</span><strong>{adminRefundProcessingCount}</strong></div>
                            <div><span>Completed</span><strong>{adminRefundCompletedCount}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Refund Requests</h2>
                            <small>{query ? `Filtered by "${search}"` : `${adminRefundRows.length} records`}</small>
                        </div>
                        <div className="rdb-provider-bookings-grid">
                            {adminRefundRows.slice(0, 24).map((item) => {
                                const bookingStatus = String(item.status || 'pending').toLowerCase();
                                const paymentStatus = String(item.payment_status || 'pending').toLowerCase();
                                const refundStatus = normalizeRefundStatus(item.refund_status) || (paymentStatus === 'refunded' ? 'completed' : '');
                                const refundPillTone = refundStatus === 'completed' ? 'refunded' : refundStatus === 'processing' ? 'pending' : refundStatus || 'pending';
                                const travelerId = typeof item.user_id === 'string' ? item.user_id.trim() : '';
                                const refundActionLoading = adminRefundActionId === item.id;

                                return (
                                    <article key={item.id} className="rdb-provider-booking-card">
                                        <div className="rdb-provider-booking-head">
                                            <div>
                                                <p>{item.listing_title || 'Package'}</p>
                                                <small>Refund requested on {formatDateTime(item.refund_requested_at || item.created_at)}</small>
                                            </div>
                                            <div className="rdb-provider-booking-pills">
                                                <span className={`rdb-pill rdb-pill-${bookingStatus}`}>{bookingStatus}</span>
                                                <span className={`rdb-pill rdb-pill-${paymentStatus}`}>{paymentStatus}</span>
                                                <span className={`rdb-pill rdb-pill-${refundPillTone}`}>refund {refundStatus || 'pending'}</span>
                                            </div>
                                        </div>

                                        <div className="rdb-provider-booking-meta">
                                            <div><span>Traveler</span><strong>{item.traveler_name || 'N/A'}</strong></div>
                                            <div><span>Email</span><strong>{item.traveler_email || 'N/A'}</strong></div>
                                            <div><span>Phone</span><strong>{item.traveler_phone || 'N/A'}</strong></div>
                                            <div><span>Total Paid</span><strong>{formatCurrency(item.total_price || 0)}</strong></div>
                                            <div><span>Booking ID</span><strong>{item.id || 'N/A'}</strong></div>
                                            <div><span>Payment ID</span><strong>{item.payment_id || 'N/A'}</strong></div>
                                            <div><span>Request Reason</span><strong>{item.refund_request_reason || 'N/A'}</strong></div>
                                            <div><span>Rejected Reason</span><strong>{item.rejection_reason || 'N/A'}</strong></div>
                                            <div><span>Processed At</span><strong>{formatDateTime(item.refund_processed_at || null)}</strong></div>
                                            <div><span>Refund Ref</span><strong>{item.refund_reference || 'N/A'}</strong></div>
                                        </div>

                                        <div className="rdb-refund-panel">
                                            <div className="rdb-refund-form-grid">
                                                <label className="rdb-refund-field">
                                                    <span>Manual Refund Reference</span>
                                                    <input
                                                        type="text"
                                                        className="rdb-refund-input"
                                                        placeholder="Bank UTR / transaction id"
                                                        value={adminRefundReferenceByBookingId[item.id] ?? item.refund_reference ?? ''}
                                                        onChange={(event) => setAdminRefundReferenceByBookingId((current) => ({
                                                            ...current,
                                                            [item.id]: event.target.value,
                                                        }))}
                                                    />
                                                </label>
                                                <label className="rdb-refund-field rdb-refund-field-wide">
                                                    <span>Admin Note</span>
                                                    <textarea
                                                        className="rdb-refund-textarea"
                                                        rows={3}
                                                        placeholder="Internal note or traveler-facing summary"
                                                        value={adminRefundNoteByBookingId[item.id] ?? item.refund_admin_note ?? ''}
                                                        onChange={(event) => setAdminRefundNoteByBookingId((current) => ({
                                                            ...current,
                                                            [item.id]: event.target.value,
                                                        }))}
                                                    />
                                                </label>
                                            </div>

                                            <div className="rdb-provider-booking-actions">
                                                {travelerId ? (
                                                    <Link
                                                        to={`/messages?user=${encodeURIComponent(travelerId)}`}
                                                        className="rdb-row-edit-link"
                                                    >
                                                        Message Traveler
                                                    </Link>
                                                ) : (
                                                    <button type="button" className="rdb-row-edit-link" disabled>
                                                        Message Traveler
                                                    </button>
                                                )}
                                                {refundStatus !== 'completed' && (
                                                    <button
                                                        type="button"
                                                        className="rdb-row-edit-link"
                                                        onClick={() => void handleAdminRefundUpdate(item, 'processing')}
                                                        disabled={refundActionLoading}
                                                    >
                                                        {refundActionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Mark In Progress'}
                                                    </button>
                                                )}
                                                {refundStatus !== 'completed' && (
                                                    <button
                                                        type="button"
                                                        className="rdb-row-edit-link rdb-row-edit-link--approve"
                                                        onClick={() => void handleAdminRefundUpdate(item, 'completed')}
                                                        disabled={refundActionLoading}
                                                    >
                                                        {refundActionLoading ? <Loader2 size={14} className="animate-spin" /> : 'Mark Refunded'}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </article>
                                );
                            })}
                            {adminRefundRows.length === 0 && <p className="rdb-empty">No refund requests yet.</p>}
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
                        <h2>Platform Revenue Breakdown</h2>
                        <div className="rdb-stat-list">
                            <div><span>Platform Revenue</span><strong>{formatRupeeShort(adminRevenueDb)}</strong></div>
                            <div><span>Contributing Rows</span><strong>{includedRows.length}</strong></div>
                            <div><span>Excluded Rows</span><strong>{excludedRows.length}</strong></div>
                            <div><span>Derived Total</span><strong>{formatRupeeShort(derivedRevenue)}</strong></div>
                        </div>
                        <div className="rdb-action-list">
                            <button type="button" className="rdb-inline-link" onClick={() => goToSection('overview')}>
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
                                        <small>Total paid: {formatCurrency(item.total_price)} | Provider payout: {formatCurrency(item.provider_payout_amount)} | Platform fee: {formatCurrency(item.platform_fee_amount)}</small>
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
                            <div><p>Marketing</p><strong>{adminMetrics.marketingCount}</strong></div>
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
            return (
                <section className="rdb-panel rdb-panel-wide rdb-map-coming-soon-panel">
                    <div className="rdb-map-coming-soon-content" aria-hidden="true">
                        <div className="rdb-panel-head">
                            <h2>Account Geography</h2>
                            <small>{isDesktopDashboard ? `${adminAccountLocations.length} accounts` : 'Desktop only'}</small>
                            {isDesktopDashboard ? (
                                <button
                                    type="button"
                                    className="rdb-row-edit-link"
                                    onClick={() => void loadAdminAccountLocations(true)}
                                >
                                    Refresh Map
                                </button>
                            ) : null}
                        </div>

                    {!isDesktopDashboard ? (
                        <p className="rdb-empty">The admin map is available on desktop only.</p>
                    ) : mapFetching && !mapLoaded ? (
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
                    </div>

                    <div className="rdb-map-coming-soon-overlay" role="status" aria-live="polite">
                        <h2>Coming Soon</h2>
                        <p>In version 2</p>
                    </div>
                </section>
            );
        }

        if (activeSection === 'moderation') {
            return (
                <section className="rdb-content-grid rdb-moderation-grid">
                    <article className="rdb-panel rdb-panel-wide rdb-moderation-queue-panel">
                        <div className="rdb-panel-head">
                            <h2>Moderation Queue</h2>
                            <small>{adminModerationQuery ? `Filtered by "${adminModerationSearch.trim()}"` : `${adminQueueRows.length} records`}</small>
                        </div>
                        <label className="rdb-moderation-search">
                            <Search size={15} aria-hidden="true" />
                            <input
                                type="search"
                                value={adminModerationSearch}
                                onChange={(event) => setAdminModerationSearch(event.target.value)}
                                placeholder="Search package, provider, ID, location"
                                aria-label="Search pending approval packages"
                            />
                        </label>
                        <div className="rdb-moderation-summary-grid">
                            <div><span>Pending</span><strong>{adminMetrics.pendingPosts}</strong></div>
                            <div><span>Approved</span><strong>{adminMetrics.approvedPosts}</strong></div>
                            <div><span>Rejected</span><strong>{adminMetrics.rejectedPosts}</strong></div>
                            <div><span>Verifications</span><strong>{adminMetrics.pendingVerifications}</strong></div>
                        </div>
                        <div className="rdb-list rdb-moderation-queue-list">
                            {adminQueueRows.slice(0, 16).map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    className={`rdb-list-row rdb-list-row-button${selectedModerationId === item.id ? ' is-active' : ''}`}
                                    onClick={() => setSelectedModerationId(item.id)}
                                >
                                    <div>
                                        <p>{titleForPost(item)}</p>
                                        <small>{item.type || 'listing'} - {item.location || 'No location'} - {formatDate(item.created_at)}</small>
                                    </div>
                                    <span className={`rdb-pill rdb-pill-${(item.status || 'pending').toLowerCase()}`}>{item.status || 'pending'}</span>
                                </button>
                            ))}
                            {adminQueueRows.length === 0 && <p className="rdb-empty">No matching moderation items.</p>}
                        </div>
                    </article>

                    <article className="rdb-panel rdb-panel-wide rdb-moderation-detail-panel">
                        <div className="rdb-panel-head">
                            <h2>Listing Details</h2>
                            <small>{selectedModerationItem ? `${selectedModerationItem.type || 'listing'} - ${formatDate(selectedModerationItem.created_at)}` : 'Select a listing'}</small>
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
                                    <FeeBreakdownView
                                        feeBreakdown={selectedModerationItem.fee_breakdown}
                                        title="Fee breakdown"
                                        compact
                                        className="rdb-fee-breakdown"
                                    />
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

        if (activeSection === 'accepted') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <h2>Accepted Summary</h2>
                        <div className="rdb-stat-list">
                            <div><span>Accepted Posts</span><strong>{adminAcceptedRows.length}</strong></div>
                            <div><span>Active Queue</span><strong>{adminQueueRows.length}</strong></div>
                            <div><span>Total Packages</span><strong>{adminMetrics.totalPackages}</strong></div>
                            <div><span>Selected</span><strong>{selectedAcceptedItem ? titleForPost(selectedAcceptedItem) : 'N/A'}</strong></div>
                        </div>
                    </article>
                    <article className="rdb-panel rdb-panel-wide">
                        <div className="rdb-panel-head">
                            <h2>Accepted Packages</h2>
                            <small>{query ? `Filtered by "${search}"` : `${adminAcceptedRows.length} records`}</small>
                        </div>
                        {renderAdminPackageGroups(
                            adminAcceptedRows,
                            selectedAcceptedId,
                            setSelectedAcceptedId,
                            'No accepted listings found.',
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
                        {renderAdminPackageGroups(
                            adminRejectedRows,
                            selectedRejectedId,
                            setSelectedRejectedId,
                            'No rejected listings found.',
                        )}
                    </article>
                </section>
            );
        }

        if (activeSection === 'audits') {
            return (
                <section className="rdb-content-grid">
                    <article className="rdb-panel">
                        <div className="rdb-panel-head">
                            <div>
                                <h2>Workspace Settings</h2>
                                <small>Controls that affect real admin dashboard behavior</small>
                            </div>
                        </div>

                        <div className="rdb-settings-group">
                            <label className="rdb-settings-field">
                                <span>Default admin landing section</span>
                                <select
                                    value={adminDefaultSection}
                                    onChange={(event) => setAdminDefaultSection(normalizeSectionForRole('admin', event.target.value))}
                                >
                                    {ADMIN_DEFAULT_SECTION_OPTIONS.map((item) => (
                                        <option key={item} value={item}>
                                            {navItems.find((navItem) => navItem.key === item)?.label || item}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="rdb-settings-field">
                                <span>Live data refresh interval</span>
                                <select
                                    value={String(adminRefreshIntervalMs)}
                                    onChange={(event) => setAdminRefreshIntervalMs(Number(event.target.value))}
                                >
                                    {ADMIN_REFRESH_INTERVAL_OPTIONS.map((item) => (
                                        <option key={item.value} value={item.value}>{item.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label className="rdb-settings-toggle">
                                <input
                                    type="checkbox"
                                    checked={adminCompactNav}
                                    onChange={(event) => setAdminCompactNav(event.target.checked)}
                                />
                                <div>
                                    <strong>Compact navigation</strong>
                                    <small>Keep only primary sections in the sidebar and move secondary admin views into the topbar.</small>
                                </div>
                            </label>

                            <button
                                type="button"
                                className={`rdb-settings-action${showAdminRecentActivity ? ' is-active' : ''}`}
                                onClick={() => setShowAdminRecentActivity((current) => !current)}
                            >
                                <div>
                                    <strong>Recent Activity</strong>
                                    <small>Open the full platform activity log inside settings.</small>
                                </div>
                                <span>{showAdminRecentActivity ? 'Hide' : `${adminAuditRows.length} events`}</span>
                            </button>
                        </div>
                    </article>

                    <SalesSettingsEditor userId={user?.id} value={salesSettings} onSaved={setSalesSettings} />

                    {showAdminRecentActivity && (
                        <article className="rdb-panel rdb-panel-wide">
                            <div className="rdb-panel-head">
                                <h2>Recent Activity</h2>
                                <small>{query ? `Filtered by "${search}"` : `${adminAuditRows.length} records`}</small>
                            </div>
                            <div className="rdb-list">
                                {adminAuditRows.map((item) => (
                                    <div key={item.id} className="rdb-list-row">
                                        <div>
                                            <p>{item.entity_type} - {item.action}</p>
                                            <small>{item.entity_id}</small>
                                        </div>
                                        <small>{formatDate(item.created_at)}</small>
                                    </div>
                                ))}
                                {adminAuditRows.length === 0 && <p className="rdb-empty">No matching activity yet.</p>}
                            </div>
                        </article>
                    )}
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
                                onClick={() => goToSection('revenue')}
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
                                <div>Marketing <span>{adminMetrics.marketingCount}</span></div>
                                <div>Tourists <span>{adminMetrics.touristCount}</span></div>
                                <div>Tour Companies <span>{adminMetrics.companyCount}</span></div>
                                <div>Instructors <span>{adminMetrics.instructorCount}</span></div>
                                <div>Tour guides <span>{adminMetrics.guideCount}</span></div>
                                <div>Local guides <span>{adminMetrics.localGuideCount}</span></div>
                            </div>
                        </div>
                    </article>
                </div>

                {/* Charts row */}
                <div className="rdb-admin-charts-row">
                    <article className="rdb-admin-chart-card">
                        <h3>Packages</h3>
                        <p>Total view per month</p>
                        <AdminBarChart data={adminMonthlyPackages} themeKey={theme} />
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
                                        goToSection('moderation');
                                    }}
                                >
                                    {titleForPost(item)} needs review
                                </button>
                            ))}
                            {adminQueueRows.length === 0 && (
                                <p className="rdb-admin-mod-item rdb-admin-mod-item--empty">No pending items</p>
                            )}
                        </div>
                        <AdminLineChart data={adminAuditTrend} themeKey={theme} />
                    </article>
                </div>
            </>
        );
    };

    if (!user || profileLoading) return null;

    const adminDateStr = new Date().toLocaleDateString('en-GB').split('/').join('.');
    const dashboardRoleLabel = effectiveRole === 'admin'
        ? 'Admin'
        : effectiveRole === 'provider'
            ? resolvedAccountRole === 'local_guide' ? 'Local Guide' : 'Provider'
            : effectiveRole === 'marketing'
                ? 'Sales'
                : 'Tourist';
    const dashboardTitle = activeSection === 'virtualTours'
        ? 'Live Tours'
        : effectiveRole === 'marketing'
            ? 'Sales Dashboard'
            : 'Dashboard';
    const isDarkTheme = theme === 'dark';

    return (
        <main className="rdb-page rdb-page--admin" data-tutorial-id="dashboard-page">
            <div className="container rdb-shell rdb-shell--admin">
                <aside className="rdb-sidebar">
                    <nav className="rdb-nav" aria-label="Dashboard menu">
                        {(effectiveRole === 'admin' ? adminSidebarNavItems : navItems).map((item) => {
                            const Icon = item.icon;
                            const count = sectionCounts[item.key];
                            const hasCount = typeof count === 'number' && count > 0;
                            return (
                                <button
                                    type="button"
                                    key={item.key}
                                    className={`rdb-nav-item${item.key === activeSection ? ' is-active' : ''}`}
                                    onClick={() => {
                                        openDashboardSection(item.key);
                                    }}
                                    data-tutorial-id={`dashboard-nav-${item.key}`}
                                    data-tooltip={item.label}
                                    aria-label={hasCount ? `${item.label}, ${count} pending` : item.label}
                                    title={hasCount ? `${item.label}: ${count} pending` : item.label}
                                >
                                    <span className="rdb-nav-item-content">
                                        {item.iconSrc ? (
                                            <img src={item.iconSrc} alt="" className="rdb-nav-icon-img" aria-hidden="true" />
                                        ) : (
                                            <Icon size={18} />
                                        )}
                                        <span>{item.label}</span>
                                    </span>
                                    {hasCount && (
                                        <span className="rdb-nav-count" aria-hidden="true" />
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

                    <button
                        type="button"
                        className="rdb-admin-sidebar-logout"
                        onClick={() => { void handleSignOut(); }}
                        title="Log out"
                        aria-label="Log out"
                    >
                        <LogOut size={20} />
                    </button>

                    <div className="rdb-profile">
                        <img className="rdb-profile-avatar" src={userAvatarSrc} alt={userName} />
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
                                <h1>{dashboardTitle}</h1>
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
                                {!isDesktopDashboard && (
                                    <button
                                        type="button"
                                        className="rdb-admin-ctrl-btn"
                                        title={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
                                        aria-label={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
                                        onClick={toggleTheme}
                                    >
                                        {isDarkTheme ? <Sun size={18} /> : <Moon size={18} />}
                                    </button>
                                )}
                                {isDesktopDashboard && (
                                    <button
                                        type="button"
                                        className="rdb-admin-ctrl-btn"
                                        title="Help"
                                        aria-label="Open tutorial"
                                        data-tutorial-id="dashboard-help"
                                        onClick={openTutorial}
                                    >
                                        <CircleHelp size={18} />
                                    </button>
                                )}
                                {isDesktopDashboard && (
                                    <button
                                        type="button"
                                        className="rdb-admin-ctrl-btn"
                                        title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'Notifications'}
                                        aria-label={unreadCount > 0 ? `Open notifications, ${unreadCount} unread` : 'Open notifications'}
                                        onClick={openNotifications}
                                    >
                                        <Bell size={18} />
                                        {unreadCount > 0 && (
                                            <span className="rdb-admin-ctrl-badge" aria-hidden="true" />
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

                        {effectiveRole === 'admin' && isDesktopDashboard && adminTopbarNavItems.length > 0 && (
                            <div className="rdb-admin-topbar-shortcuts" aria-label="Admin shortcuts">
                                {adminTopbarNavItems.map((item) => {
                                    const Icon = item.icon;
                                    const isActive = item.key === activeSection;
                                    const count = sectionCounts[item.key];
                                    const hasCount = typeof count === 'number' && count > 0;
                                    return (
                                        <button
                                            type="button"
                                            key={`topbar-${item.key}`}
                                            className={`rdb-admin-shortcut${isActive ? ' is-active' : ''}`}
                                            onClick={() => openDashboardSection(item.key)}
                                            aria-label={hasCount ? `${item.label}, ${count} pending` : item.label}
                                            title={hasCount ? `${item.label}: ${count} pending` : item.label}
                                        >
                                            <Icon size={15} />
                                            <span>{item.label}</span>
                                            {hasCount && (
                                                <strong aria-hidden="true" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {!isDesktopDashboard && adminMobileMenuOpen && (
                            <nav id="rdb-admin-mobile-menu" className="rdb-admin-mobile-menu" aria-label="Dashboard sections">
                                {navItems.map((item) => {
                                    const isActive = item.key === activeSection;
                                    const count = sectionCounts[item.key];
                                    const hasCount = typeof count === 'number' && count > 0;
                                    return (
                                        <button
                                            type="button"
                                            key={`mobile-${item.key}`}
                                            className={`rdb-admin-mobile-menu-item rdb-admin-mobile-menu-item--section${isActive ? ' is-active' : ''}`}
                                            data-tutorial-id={`dashboard-mobile-${item.key}`}
                                            aria-label={hasCount ? `${item.label}, ${count} pending` : item.label}
                                            title={hasCount ? `${item.label}: ${count} pending` : item.label}
                                            onClick={() => {
                                                openDashboardSection(item.key);
                                            }}
                                        >
                                            <span>{item.label}</span>
                                            <span className="rdb-admin-mobile-menu-meta">
                                                {hasCount && (
                                                    <strong aria-hidden="true" />
                                                )}
                                                <img src="/icons/arrow.webp" alt="" className="rdb-admin-mobile-menu-arrow" aria-hidden="true" />
                                            </span>
                                        </button>
                                    );
                                })}
                                <button
                                    type="button"
                                    className="rdb-admin-mobile-menu-item rdb-admin-mobile-menu-item--section"
                                    onClick={() => {
                                        setAdminMobileMenuOpen(false);
                                        navigate('/profile');
                                    }}
                                >
                                    <span>Profile</span>
                                    <span className="rdb-admin-mobile-menu-meta">
                                        <img src="/icons/arrow.webp" alt="" className="rdb-admin-mobile-menu-arrow" aria-hidden="true" />
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className="rdb-admin-mobile-menu-item rdb-admin-mobile-menu-item--utility"
                                    onClick={() => {
                                        setAdminMobileMenuOpen(false);
                                        toggleTheme();
                                    }}
                                >
                                    <span>{isDarkTheme ? 'Light theme' : 'Dark theme'}</span>
                                    {isDarkTheme ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                                <button
                                    type="button"
                                    className="rdb-admin-mobile-menu-item rdb-admin-mobile-menu-item--utility"
                                    onClick={() => {
                                        setAdminMobileMenuOpen(false);
                                        openTutorial();
                                    }}
                                >
                                    <span>Help</span>
                                    <CircleHelp size={16} />
                                </button>
                                <button
                                    type="button"
                                    className="rdb-admin-mobile-menu-item rdb-admin-mobile-menu-item--utility rdb-admin-mobile-menu-item--logout"
                                    onClick={() => {
                                        setAdminMobileMenuOpen(false);
                                        void handleSignOut();
                                    }}
                                >
                                    <span>Log out</span>
                                    <LogOut size={16} />
                                </button>
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
                            {effectiveRole === 'marketing' && renderMarketingSection()}
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
                <LiquidMobileNav
                    ariaLabel="Mobile dashboard navigation"
                    items={mobileNavItems.map((item): LiquidNavItem => {
                        const count = item.countKey ? sectionCounts[item.countKey] : undefined;
                        const badge = typeof count === 'number' && count > 0 ? count : undefined;
                        return {
                            id: item.id,
                            label: item.label,
                            isActive: item.section === activeSection,
                            iconSrc: item.iconSrc ?? MOBILE_NAV_ICON_SRC[item.id],
                            icon: item.icon,
                            badge,
                            dataTutorialId: `dashboard-mobile-${item.section || item.id}`,
                            onClick: () => {
                                if (item.section) {
                                    openDashboardSection(item.section);
                                    return;
                                }
                                if (item.to) {
                                    setAdminMobileMenuOpen(false);
                                    navigate(item.to);
                                }
                            },
                        };
                    })}
                />
            )}
        </main>
    );
};
