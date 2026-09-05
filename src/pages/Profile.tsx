import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Building2, Calendar, Camera, Check, ChevronLeft, ClipboardList, Globe, Home, Languages,
    KeyRound, LayoutDashboard, Loader2, LogOut, MapPin, MessageSquare, Moon, Package, Phone, RefreshCcw, Shield, ShieldAlert, Sparkles,
    Search, Sun, Trash2, UserCircle2, Users, X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { LogoutConfirmModal } from '../components/LogoutConfirmModal';
import { LiquidMobileNav, type LiquidNavItem } from '../components/ui/liquid-mobile-nav';
import { MOBILE_NAV_ICON_SRC } from '../components/ui/mobile-nav-icon-map';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { supabase } from '../lib/supabase';
import { getProfileAvatarUrl } from '../lib/avatar';
import { uploadCloudinaryImage } from '../lib/cloudinaryUpload';
import {
    getBookings, getConversations, getFavoriteListings,
    getLatestVerification, getProfileFollowStats, getProviderBookings,
    resubmitVerificationApplication, updateProfile,
    type FavoriteListingRecord, type UnifiedBooking, type VerificationRecord,
} from '../lib/destinations';
import { isProviderRole } from '../lib/platform';
import { getPasswordFormatStatus, PASSWORD_METER_CIRCUMFERENCE, PASSWORD_REQUIREMENTS_ERROR } from '../lib/password';

/* ── helpers ───────────────────────────────────────────────── */
const getProfileErrorMessage = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error || '');
    const lower = message.toLowerCase();

    if (lower.includes('cloudinary is not configured')) {
        return message;
    }

    if (lower.includes('upload preset')) {
        return `${message} Make sure the Cloudinary preset is unsigned and allows WebP image uploads.`;
    }

    if (lower.includes('row-level security') || lower.includes('policy')) {
        return 'Request was blocked by Supabase RLS policy. Run docs/supabase-role-system.sql to apply required policies.';
    }

    if (lower.includes('missing required columns')) {
        return 'Profile table is missing columns required by this app. Run docs/supabase-role-system.sql and retry.';
    }

    return message ? `Request failed: ${message}` : 'Request failed. Check Supabase schema and policies.';
};
const uploadImage = async (file: File, userId: string, type: 'avatar' | 'cover'): Promise<string> => {
    return uploadCloudinaryImage(file, {
        folder: `${userId}/profiles`,
        fileNamePrefix: type,
        tags: ['tbp', 'profile', type],
    });
};

/* ── BookingCard ───────────────────────────────────────────── */
const BookingCard: React.FC<{ booking: UnifiedBooking }> = ({ booking }) => (
    <div className="prf-booking-card">
        <div className="prf-booking-thumb">
            <img src={booking.listing_image} alt={booking.listing_title} />
        </div>
        <div className="prf-booking-info">
            <h4>{booking.listing_title}</h4>
            <div className="prf-booking-meta">
                <span><Calendar size={13} /> {new Date(booking.created_at).toLocaleDateString()}</span>
                <span><Users size={13} /> {booking.number_of_people} travelers</span>
            </div>
        </div>
        <div className="prf-booking-right">
            <strong>Rs {booking.total_price.toLocaleString()}</strong>
            <span className={`prf-status prf-status--${booking.status}`}>{booking.status}</span>
        </div>
    </div>
);

const FavoriteCard: React.FC<{ item: FavoriteListingRecord }> = ({ item }) => {
    const listingTypePath = item.listing_type === 'guide' ? 'event' : item.listing_type;
    const image = item.image_url || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=800';

    return (
        <Link to={`/listings/${listingTypePath}/${item.listing_id}`} className="prf-favorite-card">
            <div className="prf-favorite-thumb">
                <img src={image} alt={item.title} />
            </div>
            <div className="prf-favorite-info">
                <h4>{item.title}</h4>
                <p>{item.location}</p>
            </div>
            <div className="prf-favorite-right">
                <span className="prf-favorite-type">{item.listing_type === 'guide' ? 'event' : item.listing_type}</span>
                <strong>{typeof item.price === 'number' ? `Rs ${item.price.toLocaleString()}` : 'View details'}</strong>
            </div>
        </Link>
    );
};

/* ── ToggleSwitch ──────────────────────────────────────────── */
const ToggleSwitch: React.FC<{ on: boolean; onToggle: () => void; label: string }> = ({ on, onToggle, label }) => (
    <button
        type="button"
        onClick={onToggle}
        aria-label={label}
        className={`prf-toggle${on ? ' prf-toggle--on' : ''}`}
    >
        <span className="prf-toggle-knob" />
    </button>
);

type EditFormState = {
    full_name: string;
    bio: string;
    phone: string;
    city: string;
    country: string;
    website: string;
    facebook: string;
    instagram: string;
    youtube: string;
    company_name: string;
    provider_specialties: string;
    guide_license_number: string;
    certificate_id: string;
    government_id_ref: string;
    years_experience: string;
    languages: string;
    works_under_company: boolean;
};

type ProfileChecklistItem = {
    key: string;
    label: string;
    complete: boolean;
    required: boolean;
};

type DashboardRole = 'tourist' | 'provider' | 'admin';

type ProfileMobileNavItem = {
    id: string;
    to: string;
    icon: React.ElementType;
};

const createEmptyEditForm = (): EditFormState => ({
    full_name: '',
    bio: '',
    phone: '',
    city: '',
    country: '',
    website: '',
    facebook: '',
    instagram: '',
    youtube: '',
    company_name: '',
    provider_specialties: '',
    guide_license_number: '',
    certificate_id: '',
    government_id_ref: '',
    years_experience: '',
    languages: '',
    works_under_company: false,
});

const asText = (value: string | null | undefined) => value?.trim() || '';
const hasText = (value: string | null | undefined) => asText(value).length > 0;
const withHttps = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
};

const formatLanguagesInput = (value: string[] | string | null | undefined) => {
    if (Array.isArray(value)) return value.join(', ');
    return value || '';
};

const buildProfileChecklist = (
    role: string | undefined,
    form: EditFormState,
    assets: { hasAvatar: boolean; hasCover: boolean }
): ProfileChecklistItem[] => {
    const checks: ProfileChecklistItem[] = [
        { key: 'full_name', label: 'Full name', complete: hasText(form.full_name), required: true },
        { key: 'phone', label: 'Phone number', complete: hasText(form.phone), required: true },
        { key: 'city', label: 'City', complete: hasText(form.city), required: true },
        { key: 'country', label: 'Country', complete: hasText(form.country), required: true },
        { key: 'avatar', label: 'Profile photo', complete: assets.hasAvatar, required: false },
        { key: 'bio', label: 'Bio / summary', complete: hasText(form.bio), required: role !== 'tourist' },
    ];

    if (isProviderRole(role)) {
        checks.push(
            { key: 'cover', label: 'Cover image', complete: assets.hasCover, required: false },
            { key: 'website', label: 'Website', complete: hasText(form.website), required: false },
            { key: 'government_id_ref', label: 'Government ID reference', complete: hasText(form.government_id_ref), required: true },
        );
    }

    if (role === 'tour_company') {
        checks.push(
            { key: 'company_name', label: 'Company name', complete: hasText(form.company_name), required: true },
        );
    }

    if (role === 'tour_instructor') {
        checks.push(
            { key: 'provider_specialties', label: 'Specialties', complete: hasText(form.provider_specialties), required: true },
            { key: 'years_experience', label: 'Years of experience', complete: hasText(form.years_experience), required: true },
            { key: 'certificate_id', label: 'Certification reference', complete: hasText(form.certificate_id), required: true },
        );
    }

    if (role === 'tour_guide') {
        checks.push(
            { key: 'guide_license_number', label: 'Guide license number', complete: hasText(form.guide_license_number), required: true },
            { key: 'years_experience', label: 'Years of experience', complete: hasText(form.years_experience), required: true },
            { key: 'languages', label: 'Languages', complete: hasText(form.languages), required: true },
        );
    }

    if (role === 'local_guide') {
        checks.push(
            { key: 'provider_specialties', label: 'Live tour setup', complete: hasText(form.provider_specialties), required: true },
            { key: 'years_experience', label: 'Local experience', complete: hasText(form.years_experience), required: true },
            { key: 'languages', label: 'Languages', complete: hasText(form.languages), required: true },
        );
    }

    return checks;
};

const resolveDashboardRole = (role?: string | null): DashboardRole => {
    const normalized = (role || '').trim().toLowerCase();
    if (normalized === 'admin') return 'admin';
    if (isProviderRole(normalized) || normalized === 'provider' || normalized === 'vendor') return 'provider';
    return 'tourist';
};

/* ── Main component ────────────────────────────────────────── */
export const Profile: React.FC = () => {
    const { user, profile, profileLoading, signOut, verificationLabel, roleLabel, isProvider, refreshProfile } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const navigate = useNavigate();

    /* data */
    const [travelerBookings, setTravelerBookings] = useState<UnifiedBooking[]>([]);
    const [providerBookings, setProviderBookings] = useState<UnifiedBooking[]>([]);
    const [favoriteListings, setFavoriteListings] = useState<FavoriteListingRecord[]>([]);
    const [favoritesCount, setFavoritesCount] = useState(0);
    const [conversationsCount, setConversationsCount] = useState(0);
    const [followerCount, setFollowerCount] = useState(0);
    const [followingCount, setFollowingCount] = useState(0);
    const [latestVerification, setLatestVerification] = useState<VerificationRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [resubmitting, setResubmitting] = useState(false);

    /* edit */
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState<EditFormState>(createEmptyEditForm());
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');

    /* image upload */
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingCover, setUploadingCover] = useState(false);
    const [localAvatarUrl, setLocalAvatarUrl] = useState<string | undefined>();
    const [localCoverUrl, setLocalCoverUrl] = useState<string | undefined>();
    const avatarInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const [securityPanel, setSecurityPanel] = useState<'password' | 'delete' | null>(null);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordSaving, setPasswordSaving] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [securityError, setSecurityError] = useState('');
    const [securityInfo, setSecurityInfo] = useState('');
    const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
    const [logoutBusy, setLogoutBusy] = useState(false);

    const newPasswordFormat = useMemo(() => getPasswordFormatStatus(newPassword), [newPassword]);
    const newPasswordProgressStyle = {
        '--password-progress': `${newPasswordFormat.percentage}%`,
        '--password-progress-offset': PASSWORD_METER_CIRCUMFERENCE - (PASSWORD_METER_CIRCUMFERENCE * newPasswordFormat.percentage) / 100,
    } as React.CSSProperties;

    const handleSignOut = async () => {
        if (logoutBusy) return;
        setLogoutBusy(true);
        try {
            await signOut();
            setLogoutConfirmOpen(false);
            navigate('/login', { replace: true });
        } finally {
            setLogoutBusy(false);
        }
    };

    const resetSecurityMessages = () => {
        setSecurityError('');
        setSecurityInfo('');
    };

    const handlePasswordChange = async (event: React.FormEvent) => {
        event.preventDefault();
        resetSecurityMessages();

        const email = user?.email?.trim();
        if (!email) {
            setSecurityError('This account does not have an email password login.');
            return;
        }

        if (!currentPassword.trim()) {
            setSecurityError('Enter your current password.');
            return;
        }

        if (!newPasswordFormat.isComplete) {
            setSecurityError(PASSWORD_REQUIREMENTS_ERROR);
            return;
        }

        if (newPassword !== confirmPassword) {
            setSecurityError('New password and confirmation do not match.');
            return;
        }

        setPasswordSaving(true);
        try {
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email,
                password: currentPassword,
            });
            if (verifyError) throw verifyError;

            const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
            if (updateError) throw updateError;

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setSecurityInfo('Password changed successfully.');
        } catch (error) {
            setSecurityError(error instanceof Error ? error.message : 'Password change failed. Please try again.');
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleDeleteAccount = async (event: React.FormEvent) => {
        event.preventDefault();
        resetSecurityMessages();

        const email = user?.email?.trim();
        if (!email) {
            setSecurityError('This account cannot be deleted because the email is unavailable.');
            return;
        }

        if (deleteConfirm.trim().toLowerCase() !== email.toLowerCase()) {
            setSecurityError('Type your account email exactly to confirm deletion.');
            return;
        }

        setDeleteBusy(true);
        try {
            const { error: deleteError } = await supabase.functions.invoke('delete-account', {
                body: { confirmation: deleteConfirm.trim() },
            });
            if (deleteError) throw deleteError;
            await signOut();
            navigate('/login?deleted=1', { replace: true });
        } catch (error) {
            setSecurityError(error instanceof Error ? error.message : 'Account deletion failed. Please try again.');
        } finally {
            setDeleteBusy(false);
        }
    };

    /* sync form + local images with profile */
    useEffect(() => {
        if (!profile) return;
        setEditForm({
            full_name: profile.full_name || '',
            bio: profile.bio || '',
            phone: profile.phone || '',
            city: profile.city || '',
            country: profile.country || '',
            website: profile.website || '',
            facebook: profile.facebook || '',
            instagram: profile.instagram || '',
            youtube: profile.youtube || '',
            company_name: profile.company_name || '',
            provider_specialties: profile.provider_specialties || '',
            guide_license_number: profile.guide_license_number || '',
            certificate_id: profile.certificate_id || '',
            government_id_ref: profile.government_id_ref || '',
            years_experience: profile.years_experience ? String(profile.years_experience) : '',
            languages: formatLanguagesInput(profile.languages),
            works_under_company: Boolean(profile.works_under_company),
        });
        setLocalAvatarUrl(profile.profile_image_url);
        setLocalCoverUrl(profile.cover_image_url);
    }, [profile]);

    /* fetch bookings, favorites, conversations */
    useEffect(() => {
        if (!user) return;
        const load = async () => {
            setLoading(true);
            try {
                const [bookings, inbound, favorites, conversations, followStats] = await Promise.all([
                    getBookings(user.id),
                    isProviderRole(profile?.role) ? getProviderBookings(user.id) : Promise.resolve([]),
                    getFavoriteListings(user.id),
                    getConversations(user.id),
                    getProfileFollowStats(user.id),
                ]);
                setTravelerBookings(bookings);
                setProviderBookings(inbound);
                setFavoriteListings(favorites);
                setFavoritesCount(favorites.length);
                setConversationsCount(conversations.length);
                setFollowerCount(followStats.followers);
                setFollowingCount(followStats.following);
                if (isProviderRole(profile?.role)) {
                    setLatestVerification(await getLatestVerification(user.id));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        void load();
    }, [profile?.role, user]);

    /* save profile edits */
    const handleSave = async () => {
        if (!user) return;
        const checklist = buildProfileChecklist(profile?.role, editForm, {
            hasAvatar: Boolean(localAvatarUrl),
            hasCover: Boolean(localCoverUrl),
        });
        const firstMissingRequired = checklist.find((item) => item.required && !item.complete);
        if (firstMissingRequired) {
            setSaveError(`${firstMissingRequired.label} is required.`);
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            await updateProfile({
                id: user.id,
                full_name: editForm.full_name.trim(),
                bio: editForm.bio.trim(),
                phone: editForm.phone.trim(),
                city: editForm.city.trim(),
                country: editForm.country.trim(),
                website: withHttps(editForm.website),
                facebook: withHttps(editForm.facebook),
                instagram: withHttps(editForm.instagram),
                youtube: withHttps(editForm.youtube),
                company_name: editForm.company_name.trim(),
                provider_specialties: editForm.provider_specialties.trim(),
                guide_license_number: editForm.guide_license_number.trim(),
                certificate_id: editForm.certificate_id.trim(),
                government_id_ref: editForm.government_id_ref.trim(),
                years_experience: editForm.years_experience.trim()
                    ? Number(editForm.years_experience.trim())
                    : null,
                languages: editForm.languages.trim()
                    ? editForm.languages.split(',').map((item) => item.trim()).filter(Boolean)
                    : null,
                works_under_company: editForm.works_under_company,
            });
            await refreshProfile();
            setIsEditing(false);
        } catch (err) {
            setSaveError(getProfileErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    /* image uploads */
    const handleImageUpload = async (file: File, type: 'avatar' | 'cover') => {
        if (!user) return;
        const setUploading = type === 'avatar' ? setUploadingAvatar : setUploadingCover;
        setUploading(true);
        try {
            const url = await uploadImage(file, user.id, type);
            if (type === 'avatar') {
                setLocalAvatarUrl(url);
                await updateProfile({ id: user.id, profile_image_url: url });
            } else {
                setLocalCoverUrl(url);
                await updateProfile({ id: user.id, cover_image_url: url });
            }
            await refreshProfile();
        } catch (err) {
            console.error(err);
            alert(getProfileErrorMessage(err));
        } finally {
            setUploading(false);
        }
    };

    /* resubmit verification */
    const handleResubmit = async () => {
        if (!user || profile?.verification_status !== 'rejected') return;
        setResubmitting(true);
        try {
            await resubmitVerificationApplication(user.id);
            await refreshProfile();
        } catch {
            alert('Failed to resubmit. Please try again.');
        } finally {
            setResubmitting(false);
        }
    };

    /* derived */
    const avatarSrc = getProfileAvatarUrl(localAvatarUrl, user?.id, profile?.full_name, user?.email);
    const effectiveRole = useMemo<DashboardRole>(() => resolveDashboardRole(profile?.role), [profile?.role]);
    const displayBookings = isProvider ? providerBookings : travelerBookings;
    const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Member';
    const locationStr = [profile?.city, profile?.country].filter(Boolean).join(', ');
    const profileChecklist = useMemo(() => buildProfileChecklist(profile?.role, editForm, {
        hasAvatar: Boolean(localAvatarUrl),
        hasCover: Boolean(localCoverUrl),
    }), [editForm, localAvatarUrl, localCoverUrl, profile?.role]);
    const profileCompletion = useMemo(() => {
        if (!profileChecklist.length) return 100;
        const completed = profileChecklist.filter((item) => item.complete).length;
        return Math.round((completed / profileChecklist.length) * 100);
    }, [profileChecklist]);
    const missingChecklistItems = useMemo(
        () => profileChecklist.filter((item) => !item.complete),
        [profileChecklist],
    );
    const socialLinks = useMemo(() => ([
        { label: 'Website', href: profile?.website || '' },
        { label: 'Facebook', href: profile?.facebook || '' },
        { label: 'Instagram', href: profile?.instagram || '' },
        { label: 'YouTube', href: profile?.youtube || '' },
    ]).filter((item) => hasText(item.href)), [profile?.facebook, profile?.instagram, profile?.website, profile?.youtube]);
    const professionalDetails = useMemo(() => {
        const rows = [
            { label: 'Location', value: locationStr, icon: MapPin },
            { label: 'Phone', value: profile?.phone || '', icon: Phone },
            { label: 'Website', value: profile?.website || '', icon: Globe },
        ];

        if (profile?.role === 'tour_company') {
            rows.push({ label: 'Company', value: profile.company_name || '', icon: Building2 });
        }
        if (profile?.role === 'tour_instructor') {
            rows.push(
                { label: 'Specialties', value: profile.provider_specialties || '', icon: Sparkles },
                { label: 'Experience', value: profile.years_experience ? `${profile.years_experience} years` : '', icon: Users },
            );
        }
        if (profile?.role === 'tour_guide') {
            rows.push(
                { label: 'Languages', value: formatLanguagesInput(profile.languages), icon: Languages },
                { label: 'Experience', value: profile.years_experience ? `${profile.years_experience} years` : '', icon: Users },
            );
        }
        if (profile?.role === 'local_guide') {
            rows.push(
                { label: 'Languages', value: formatLanguagesInput(profile.languages), icon: Languages },
                { label: 'Live Setup', value: profile.provider_specialties || '', icon: Sparkles },
                { label: 'Experience', value: profile.years_experience ? `${profile.years_experience} years` : '', icon: Users },
            );
        }

        return rows.filter((item) => hasText(item.value));
    }, [locationStr, profile]);

    const stats = useMemo(() => [
        { label: isProvider ? 'Inbound' : 'Trips', value: (isProvider ? providerBookings : travelerBookings).length.toString().padStart(2, '0') },
        { label: 'Favorites', value: favoritesCount.toString().padStart(2, '0') },
        { label: 'Chats', value: conversationsCount.toString().padStart(2, '0') },
        { label: isProvider ? 'Status' : 'Reviews', value: isProvider ? (verificationLabel === 'Verified' ? '✓' : '…') : '00' },
    ], [conversationsCount, favoritesCount, isProvider, providerBookings, travelerBookings, verificationLabel]);

    const profileMobileNavItems = useMemo<ProfileMobileNavItem[]>(() => {
        if (effectiveRole === 'admin') {
            return [
                { id: 'dashboard', to: '/dashboard/admin', icon: LayoutDashboard },
                { id: 'messages', to: '/messages', icon: MessageSquare },
                { id: 'moderation', to: '/dashboard/admin?section=moderation', icon: Shield },
                { id: 'users', to: '/dashboard/admin?section=users', icon: Users },
                { id: 'profile', to: '/profile', icon: UserCircle2 },
            ];
        }
        if (effectiveRole === 'provider') {
            return [
                { id: 'dashboard', to: '/dashboard/provider', icon: LayoutDashboard },
                { id: 'bookings', to: '/dashboard/provider?section=bookings', icon: ClipboardList },
                { id: 'listings', to: '/dashboard/provider?section=listings', icon: Package },
                { id: 'messages', to: '/messages', icon: MessageSquare },
                { id: 'profile', to: '/profile', icon: UserCircle2 },
            ];
        }
        return [
            { id: 'home', to: '/', icon: Home },
            { id: 'explore', to: '/explore', icon: Search },
            { id: 'dashboard', to: '/dashboard/tourist', icon: LayoutDashboard },
            { id: 'bookings', to: '/dashboard/tourist?section=bookings', icon: ClipboardList },
            { id: 'profile', to: '/profile', icon: UserCircle2 },
        ];
    }, [effectiveRole]);

    if (!user) return null;

    return (
        <main className="prf-page">
            <div className="container prf-shell">

                {/* Back */}
                <button onClick={() => navigate(-1)} className="prf-back">
                    <ChevronLeft size={17} /> Back
                </button>

                {/* ── Verification banner ──────────────────────── */}
                {isProvider && profile?.verification_status === 'rejected' && (
                    <div className="prf-banner prf-banner--danger">
                        <ShieldAlert size={18} />
                        <div style={{ flex: 1 }}>
                            <strong>Verification rejected</strong>
                            {latestVerification?.rejection_reason && (
                                <p style={{ margin: '4px 0 0', fontSize: '0.85rem', opacity: 0.85 }}>
                                    Reason: {latestVerification.rejection_reason}
                                </p>
                            )}
                        </div>
                        <button
                            type="button"
                            className="prf-banner-btn"
                            onClick={handleResubmit}
                            disabled={resubmitting}
                        >
                            {resubmitting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                            Resubmit
                        </button>
                    </div>
                )}

                {/* ── Hero card ────────────────────────────────── */}
                <div className="prf-hero-card" data-tutorial-id="profile-hero">

                    {/* Cover image */}
                    <div
                        className="prf-cover"
                        style={localCoverUrl ? { backgroundImage: `url(${localCoverUrl})` } : undefined}
                    >
                        {uploadingCover && (
                            <div className="prf-cover-loader">
                                <Loader2 size={24} className="animate-spin" />
                            </div>
                        )}
                        <button
                            type="button"
                            className="prf-cover-btn"
                            onClick={() => coverInputRef.current?.click()}
                        >
                            <Camera size={14} />
                            {localCoverUrl ? 'Change Cover' : 'Add Cover'}
                        </button>
                        <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleImageUpload(f, 'cover');
                                e.target.value = '';
                            }}
                        />
                    </div>

                    {/* Avatar + edit profile button row */}
                    <div className="prf-avatar-row">
                        <div
                            className="prf-avatar-wrap"
                            onClick={() => !uploadingAvatar && avatarInputRef.current?.click()}
                            title="Change profile photo"
                        >
                            {uploadingAvatar ? (
                                <div className="prf-avatar-img prf-avatar-loading">
                                    <Loader2 size={24} className="animate-spin" />
                                </div>
                            ) : (
                                <img src={avatarSrc} alt={displayName} className="prf-avatar-img" />
                            )}
                            <div className="prf-avatar-overlay">
                                <Camera size={16} />
                            </div>
                            <input
                                ref={avatarInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) void handleImageUpload(f, 'avatar');
                                    e.target.value = '';
                                }}
                            />
                        </div>

                        {!isEditing && (
                            <button className="prf-edit-btn" onClick={() => setIsEditing(true)}>
                                Edit Profile
                            </button>
                        )}
                    </div>

                    {/* Info section */}
                    <div className="prf-info-body">
                        {isEditing ? (
                            /* ── Edit form ─── */
                            <div className="prf-edit-form">
                                <div className="prf-form-grid">
                                    <div className="prf-field">
                                        <label className="prf-label">Full Name</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.full_name}
                                            onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                                            placeholder="Your full name"
                                        />
                                    </div>
                                    <div className="prf-field">
                                        <label className="prf-label">Phone</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.phone}
                                            onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                                            placeholder="+91 00000 00000"
                                        />
                                    </div>
                                    <div className="prf-field prf-field--full">
                                        <label className="prf-label">Bio</label>
                                        <textarea
                                            className="prf-input prf-textarea"
                                            value={editForm.bio}
                                            onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                                            placeholder="Write something about yourself..."
                                            rows={3}
                                        />
                                    </div>
                                    <div className="prf-field">
                                        <label className="prf-label">City</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.city}
                                            onChange={e => setEditForm(f => ({ ...f, city: e.target.value }))}
                                            placeholder="City"
                                        />
                                    </div>
                                    <div className="prf-field">
                                        <label className="prf-label">Country</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.country}
                                            onChange={e => setEditForm(f => ({ ...f, country: e.target.value }))}
                                            placeholder="Country"
                                        />
                                    </div>
                                    <div className="prf-field prf-field--full">
                                        <label className="prf-label">Website</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.website}
                                            onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                                            placeholder="https://yourwebsite.com"
                                        />
                                    </div>
                                    <div className="prf-field">
                                        <label className="prf-label">Facebook</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.facebook}
                                            onChange={e => setEditForm(f => ({ ...f, facebook: e.target.value }))}
                                            placeholder="https://facebook.com/yourpage"
                                        />
                                    </div>
                                    <div className="prf-field">
                                        <label className="prf-label">Instagram</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.instagram}
                                            onChange={e => setEditForm(f => ({ ...f, instagram: e.target.value }))}
                                            placeholder="https://instagram.com/yourhandle"
                                        />
                                    </div>
                                    <div className="prf-field prf-field--full">
                                        <label className="prf-label">YouTube</label>
                                        <input
                                            className="prf-input"
                                            value={editForm.youtube}
                                            onChange={e => setEditForm(f => ({ ...f, youtube: e.target.value }))}
                                            placeholder="https://youtube.com/@yourchannel"
                                        />
                                    </div>
                                    {profile?.role === 'tour_company' && (
                                        <div className="prf-field prf-field--full">
                                            <label className="prf-label">Company Name</label>
                                            <input
                                                className="prf-input"
                                                value={editForm.company_name}
                                                onChange={e => setEditForm(f => ({ ...f, company_name: e.target.value }))}
                                                placeholder="Registered company name"
                                            />
                                        </div>
                                    )}
                                    {profile?.role === 'tour_instructor' && (
                                        <>
                                            <div className="prf-field prf-field--full">
                                                <label className="prf-label">Specialties</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.provider_specialties}
                                                    onChange={e => setEditForm(f => ({ ...f, provider_specialties: e.target.value }))}
                                                    placeholder="Climbing, ski training, safety workshops"
                                                />
                                            </div>
                                            <div className="prf-field">
                                                <label className="prf-label">Years of Experience</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.years_experience}
                                                    onChange={e => setEditForm(f => ({ ...f, years_experience: e.target.value }))}
                                                    placeholder="6"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                            <div className="prf-field">
                                                <label className="prf-label">Certification Reference</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.certificate_id}
                                                    onChange={e => setEditForm(f => ({ ...f, certificate_id: e.target.value }))}
                                                    placeholder="Certificate or training ID"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {profile?.role === 'tour_guide' && (
                                        <>
                                            <div className="prf-field">
                                                <label className="prf-label">Years of Experience</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.years_experience}
                                                    onChange={e => setEditForm(f => ({ ...f, years_experience: e.target.value }))}
                                                    placeholder="8"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                            <div className="prf-field">
                                                <label className="prf-label">Guide License Number</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.guide_license_number}
                                                    onChange={e => setEditForm(f => ({ ...f, guide_license_number: e.target.value }))}
                                                    placeholder="Tourism board or permit ID"
                                                />
                                            </div>
                                            <div className="prf-field prf-field--full">
                                                <label className="prf-label">Languages</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.languages}
                                                    onChange={e => setEditForm(f => ({ ...f, languages: e.target.value }))}
                                                    placeholder="English, Hindi, Nepali"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {profile?.role === 'local_guide' && (
                                        <>
                                            <div className="prf-field prf-field--full">
                                                <label className="prf-label">Live Tour Setup</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.provider_specialties}
                                                    onChange={e => setEditForm(f => ({ ...f, provider_specialties: e.target.value }))}
                                                    placeholder="360 camera, mobile gimbal, old city walks"
                                                />
                                            </div>
                                            <div className="prf-field">
                                                <label className="prf-label">Local Experience</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.years_experience}
                                                    onChange={e => setEditForm(f => ({ ...f, years_experience: e.target.value }))}
                                                    placeholder="4"
                                                    inputMode="numeric"
                                                />
                                            </div>
                                            <div className="prf-field prf-field--full">
                                                <label className="prf-label">Languages</label>
                                                <input
                                                    className="prf-input"
                                                    value={editForm.languages}
                                                    onChange={e => setEditForm(f => ({ ...f, languages: e.target.value }))}
                                                    placeholder="English, Hindi, Spanish"
                                                />
                                            </div>
                                        </>
                                    )}
                                    {isProviderRole(profile?.role) && (
                                        <div className="prf-field prf-field--full">
                                            <label className="prf-label">Government ID Reference</label>
                                            <input
                                                className="prf-input"
                                                value={editForm.government_id_ref}
                                                onChange={e => setEditForm(f => ({ ...f, government_id_ref: e.target.value }))}
                                                placeholder="Passport, GST, PAN, or permit reference"
                                            />
                                        </div>
                                    )}
                                </div>
                                {saveError && <p className="prf-save-error">{saveError}</p>}
                                <div className="prf-form-actions">
                                    <button
                                        type="button"
                                        className="prf-btn prf-btn--ghost"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setSaveError('');
                                            if (profile) {
                                                setEditForm({
                                                    full_name: profile.full_name || '',
                                                    bio: profile.bio || '',
                                                    phone: profile.phone || '',
                                                    city: profile.city || '',
                                                    country: profile.country || '',
                                                    website: profile.website || '',
                                                    facebook: profile.facebook || '',
                                                    instagram: profile.instagram || '',
                                                    youtube: profile.youtube || '',
                                                    company_name: profile.company_name || '',
                                                    provider_specialties: profile.provider_specialties || '',
                                                    guide_license_number: profile.guide_license_number || '',
                                                    certificate_id: profile.certificate_id || '',
                                                    government_id_ref: profile.government_id_ref || '',
                                                    years_experience: profile.years_experience ? String(profile.years_experience) : '',
                                                    languages: formatLanguagesInput(profile.languages),
                                                    works_under_company: Boolean(profile.works_under_company),
                                                });
                                            }
                                        }}
                                    >
                                        <X size={15} /> Cancel
                                    </button>
                                    <button
                                        type="button"
                                        className="prf-btn prf-btn--primary"
                                        onClick={handleSave}
                                        disabled={saving}
                                    >
                                        {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                                        {saving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* ── Display view ─── */
                            <>
                                <div className="prf-badges">
                                    <span className="prf-badge prf-badge--role">{roleLabel}</span>
                                    <span className="prf-badge prf-badge--verify">{verificationLabel}</span>
                                </div>
                                <h1 className="prf-name">{displayName}</h1>
                                <p className="prf-email">{user.email}</p>
                                {profile?.bio && <p className="prf-bio">{profile.bio}</p>}
                                <div className="prf-meta-row">
                                    {locationStr && <span className="prf-meta-chip"><MapPin size={14} /> {locationStr}</span>}
                                    {profile?.phone && <span className="prf-meta-chip"><Phone size={14} /> {profile.phone}</span>}
                                    {profile?.website && (
                                        <a className="prf-meta-chip prf-meta-chip--link" href={profile.website} target="_blank" rel="noopener noreferrer">
                                            <Globe size={14} /> {profile.website.replace(/^https?:\/\//, '')}
                                        </a>
                                    )}
                                </div>
                                {socialLinks.length > 0 && (
                                    <div className="prf-link-row">
                                        {socialLinks.map((item) => (
                                            <a
                                                key={item.label}
                                                href={item.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="prf-link-pill"
                                            >
                                                {item.label}
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ── Stats ───────────────────────────────────── */}
                <div className="prf-stats-row">
                    {stats.map(s => (
                        <div key={s.label} className="prf-stat">
                            <strong className="prf-stat-val">{s.value}</strong>
                            <span className="prf-stat-label">{s.label}</span>
                        </div>
                    ))}
                </div>

                {/* ── Bookings ─────────────────────────────────── */}
                <section className="prf-card" data-tutorial-id="profile-readiness">
                    <div className="prf-card-head">
                        <div>
                            <h2 className="prf-card-title">{isProvider ? 'Inbound Bookings' : 'Your Journeys'}</h2>
                            <p className="prf-card-sub">{isProvider ? 'Bookings on your listings' : 'Your travel history'}</p>
                        </div>
                        <span className="prf-count-badge">{displayBookings.length} records</span>
                    </div>

                    {(loading || profileLoading) ? (
                        <div className="prf-center-loader"><Loader2 className="animate-spin" size={28} /></div>
                    ) : displayBookings.length > 0 ? (
                        <div className="prf-booking-list">
                            {displayBookings.map(b => <BookingCard key={b.id} booking={b} />)}
                        </div>
                    ) : (
                        <div className="prf-empty">
                            <p>{isProvider ? 'No inbound bookings yet.' : 'No journeys recorded yet.'}</p>
                            <Link to={isProvider ? '/dashboard/provider?section=studio' : '/dashboard'} className="btn btn-primary" style={{ borderRadius: '999px', marginTop: '16px' }}>
                                {isProvider ? 'Post a Listing' : 'Find Adventures'}
                            </Link>
                        </div>
                    )}
                </section>

                {/* ── Settings ─────────────────────────────────── */}
                <section className="prf-card">
                    <div className="prf-card-head">
                        <div>
                            <h2 className="prf-card-title">Profile Readiness</h2>
                            <p className="prf-card-sub">
                                Keep your account complete so bookings, discovery, and communication feel trustworthy.
                            </p>
                        </div>
                        <span className="prf-count-badge">{profileCompletion}% complete</span>
                    </div>

                    <div className="prf-readiness">
                        <div className="prf-progress-track">
                            <span className="prf-progress-fill" style={{ width: `${profileCompletion}%` }} />
                        </div>
                        <div className="prf-checklist">
                            {profileChecklist.map((item) => (
                                <div key={item.key} className={`prf-check-item${item.complete ? ' is-complete' : ''}`}>
                                    <span>{item.label}</span>
                                    <strong>{item.complete ? 'Done' : item.required ? 'Required' : 'Recommended'}</strong>
                                </div>
                            ))}
                        </div>
                        {!isEditing && missingChecklistItems.length > 0 && (
                            <div className="prf-inline-note">
                                <span>Missing: {missingChecklistItems.map((item) => item.label).join(', ')}</span>
                                <button type="button" className="prf-inline-action" onClick={() => setIsEditing(true)}>
                                    Complete profile
                                </button>
                            </div>
                        )}
                    </div>
                </section>

                <section className="prf-card">
                    <div className="prf-card-head">
                        <div>
                            <h2 className="prf-card-title">{isProvider ? 'Professional Details' : 'Account Details'}</h2>
                            <p className="prf-card-sub">
                                {isProvider ? 'Public-facing information shown to travelers on your profile.' : 'Core identity details attached to your account.'}
                            </p>
                        </div>
                        <span className="prf-count-badge">{isProvider ? `${followerCount} followers` : `${followingCount} following`}</span>
                    </div>

                    <div className="prf-detail-grid">
                        {professionalDetails.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div key={item.label} className="prf-detail-card">
                                    <div className="prf-detail-icon"><Icon size={16} /></div>
                                    <div>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {!isProvider && (
                    <section className="prf-card">
                        <div className="prf-card-head">
                            <div>
                                <h2 className="prf-card-title">Saved Favorites</h2>
                                <p className="prf-card-sub">Tours, activities, and events you saved.</p>
                            </div>
                            <span className="prf-count-badge">{favoriteListings.length} records</span>
                        </div>

                        {(loading || profileLoading) ? (
                            <div className="prf-center-loader"><Loader2 className="animate-spin" size={28} /></div>
                        ) : favoriteListings.length > 0 ? (
                            <div className="prf-favorite-list">
                                {favoriteListings.map(item => <FavoriteCard key={item.favorite_id} item={item} />)}
                            </div>
                        ) : (
                            <div className="prf-empty">
                                <p>No favorites saved yet.</p>
                                <Link to="/dashboard" className="btn btn-primary" style={{ borderRadius: '999px', marginTop: '16px' }}>
                                    Explore Listings
                                </Link>
                            </div>
                        )}
                    </section>
                )}

                <section className="prf-card">
                    <h2 className="prf-card-title" style={{ marginBottom: '8px' }}>Settings</h2>

                    {/* Appearance */}
                    <div className="prf-setting-row">
                        <div className="prf-setting-left">
                            <div className="prf-setting-icon">
                                {isDark ? <Moon size={16} /> : <Sun size={16} />}
                            </div>
                            <div>
                                <p className="prf-setting-label">Appearance</p>
                                <p className="prf-setting-sub">{isDark ? 'Dark mode is on' : 'Light mode is on'}</p>
                            </div>
                        </div>
                        <ToggleSwitch on={isDark} onToggle={toggleTheme} label="Toggle dark mode" />
                    </div>

                    <div className="prf-setting-sep" />

                    <div className="prf-setting-row">
                        <div className="prf-setting-left">
                            <div className="prf-setting-icon">
                                <KeyRound size={16} />
                            </div>
                            <div>
                                <p className="prf-setting-label">Password</p>
                                <p className="prf-setting-sub">Change your account password</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="prf-action-btn"
                            onClick={() => {
                                resetSecurityMessages();
                                setSecurityPanel((panel) => panel === 'password' ? null : 'password');
                            }}
                        >
                            Change
                        </button>
                    </div>

                    {securityPanel === 'password' && (
                        <form className="prf-security-panel" onSubmit={handlePasswordChange}>
                            {securityError && <div className="prf-security-alert prf-security-alert--error">{securityError}</div>}
                            {securityInfo && <div className="prf-security-alert prf-security-alert--info">{securityInfo}</div>}
                            <div className="prf-security-grid">
                                <label className="prf-security-field">
                                    <span>Current Password</span>
                                    <input
                                        type="password"
                                        autoComplete="current-password"
                                        value={currentPassword}
                                        onChange={(event) => setCurrentPassword(event.target.value)}
                                    />
                                </label>
                                <label className="prf-security-field">
                                    <span>New Password</span>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        minLength={8}
                                        value={newPassword}
                                        onChange={(event) => setNewPassword(event.target.value)}
                                    />
                                </label>
                                <label className="prf-security-field">
                                    <span>Confirm Password</span>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        minLength={8}
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                    />
                                </label>
                            </div>

                            <div className={`prf-password-format${newPasswordFormat.isComplete ? ' is-complete' : ''}`}>
                                <div className="prf-password-meter" style={newPasswordProgressStyle} aria-hidden="true">
                                    <svg viewBox="0 0 64 64">
                                        <circle className="prf-password-meter-track" cx="32" cy="32" r="25" />
                                        <circle className="prf-password-meter-progress" cx="32" cy="32" r="25" />
                                    </svg>
                                    <span>{newPasswordFormat.percentage}%</span>
                                </div>
                                <ul className="prf-password-rules">
                                    {newPasswordFormat.requirements.map((requirement) => (
                                        <li key={requirement.key} className={requirement.met ? 'is-met' : ''}>
                                            <span aria-hidden="true" />
                                            {requirement.label}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="prf-security-actions">
                                <button
                                    type="button"
                                    className="prf-action-btn"
                                    onClick={() => {
                                        setSecurityPanel(null);
                                        resetSecurityMessages();
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="prf-primary-action-btn"
                                    disabled={passwordSaving || !newPasswordFormat.isComplete}
                                >
                                    {passwordSaving ? <Loader2 className="animate-spin" size={16} /> : 'Save Password'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="prf-setting-sep" />

                    <div className="prf-setting-row">
                        <div className="prf-setting-left">
                            <div className="prf-setting-icon prf-setting-icon--danger">
                                <Trash2 size={16} />
                            </div>
                            <div>
                                <p className="prf-setting-label">Delete Account</p>
                                <p className="prf-setting-sub">Permanently remove your account</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="prf-signout-btn"
                            onClick={() => {
                                resetSecurityMessages();
                                setSecurityPanel((panel) => panel === 'delete' ? null : 'delete');
                            }}
                        >
                            Delete
                        </button>
                    </div>

                    {securityPanel === 'delete' && (
                        <form className="prf-security-panel prf-security-panel--danger" onSubmit={handleDeleteAccount}>
                            {securityError && <div className="prf-security-alert prf-security-alert--error">{securityError}</div>}
                            <div className="prf-delete-warning">
                                <ShieldAlert size={17} />
                                <span>This permanently removes your login and profile data. This cannot be undone.</span>
                            </div>
                            <label className="prf-security-field">
                                <span>Type {user?.email || 'your email'} to confirm</span>
                                <input
                                    type="email"
                                    value={deleteConfirm}
                                    onChange={(event) => setDeleteConfirm(event.target.value)}
                                    placeholder={user?.email || 'you@example.com'}
                                />
                            </label>
                            <div className="prf-security-actions">
                                <button
                                    type="button"
                                    className="prf-action-btn"
                                    onClick={() => {
                                        setSecurityPanel(null);
                                        setDeleteConfirm('');
                                        resetSecurityMessages();
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="prf-danger-action-btn" disabled={deleteBusy}>
                                    {deleteBusy ? <Loader2 className="animate-spin" size={16} /> : 'Delete Account'}
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="prf-setting-sep" />

                    {/* Sign out */}
                    <div className="prf-setting-row">
                        <div className="prf-setting-left">
                            <div className="prf-setting-icon prf-setting-icon--danger">
                                <LogOut size={16} />
                            </div>
                            <div>
                                <p className="prf-setting-label">Sign Out</p>
                                <p className="prf-setting-sub">Sign out of your account on this device</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className="prf-signout-btn"
                            onClick={() => setLogoutConfirmOpen(true)}
                        >
                            Sign Out
                        </button>
                    </div>
                </section>
            </div>

            <LiquidMobileNav
                ariaLabel="Mobile role navigation"
                items={profileMobileNavItems.map((item): LiquidNavItem => ({
                    id: item.id,
                    label: item.id,
                    isActive: item.id === 'profile',
                    iconSrc: MOBILE_NAV_ICON_SRC[item.id],
                    icon: item.icon,
                    onClick: () => navigate(item.to),
                }))}
            />

            <LogoutConfirmModal
                open={logoutConfirmOpen}
                busy={logoutBusy}
                onConfirm={() => { void handleSignOut(); }}
                onCancel={() => setLogoutConfirmOpen(false)}
            />

            <style>{`
                /* ── Page ──────────────────────────────────────── */
                .prf-page {
                    background: var(--bg-main);
                    min-height: 100vh;
                    padding-top: 112px;
                    padding-bottom: 100px;
                }
                .prf-shell {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    max-width: 800px;
                }

                /* Back button */
                .prf-back {
                    align-items: center;
                    background: none;
                    border: none;
                    color: var(--text-muted);
                    cursor: pointer;
                    display: inline-flex;
                    font-size: 0.9rem;
                    font-weight: 600;
                    gap: 6px;
                    padding: 0;
                    transition: color 0.18s;
                }
                .prf-back:hover { color: var(--text-main); }

                /* Verification banner */
                .prf-banner {
                    align-items: flex-start;
                    border-radius: 16px;
                    display: flex;
                    gap: 12px;
                    padding: 14px 16px;
                }
                .prf-banner--danger {
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.2);
                    color: var(--danger-text);
                }
                .prf-banner-btn {
                    align-items: center;
                    background: rgba(239,68,68,0.12);
                    border: 1px solid rgba(239,68,68,0.25);
                    border-radius: 999px;
                    color: var(--danger-text);
                    cursor: pointer;
                    display: inline-flex;
                    flex-shrink: 0;
                    font-size: 0.82rem;
                    font-weight: 700;
                    gap: 6px;
                    padding: 7px 14px;
                }

                /* ── Hero card ──────────────────────────────────── */
                .prf-hero-card {
                    background: var(--surface-main);
                    border: 1px solid var(--border-light);
                    border-radius: 28px;
                    box-shadow: var(--shadow-card);
                    overflow: hidden;
                }

                /* Cover */
                .prf-cover {
                    background: linear-gradient(135deg,
                        color-mix(in srgb, var(--accent) 30%, transparent),
                        color-mix(in srgb, var(--primary) 20%, transparent));
                    background-position: center;
                    background-size: cover;
                    height: 200px;
                    position: relative;
                }
                .prf-cover-loader {
                    align-items: center;
                    background: rgba(0,0,0,0.4);
                    bottom: 0; left: 0; right: 0; top: 0;
                    color: #fff;
                    display: flex;
                    justify-content: center;
                    position: absolute;
                }
                .prf-cover-btn {
                    align-items: center;
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    background: rgba(0,0,0,0.38);
                    border: 1px solid rgba(255,255,255,0.25);
                    border-radius: 999px;
                    bottom: 14px;
                    color: #fff;
                    cursor: pointer;
                    display: inline-flex;
                    font-size: 0.78rem;
                    font-weight: 700;
                    gap: 6px;
                    padding: 7px 14px;
                    position: absolute;
                    right: 16px;
                    transition: background 0.18s;
                }
                .prf-cover-btn:hover { background: rgba(0,0,0,0.55); }

                /* Avatar row */
                .prf-avatar-row {
                    align-items: flex-end;
                    display: flex;
                    gap: 16px;
                    justify-content: space-between;
                    padding: 0 24px 0 24px;
                }
                .prf-avatar-wrap {
                    border: 4px solid var(--surface-main);
                    border-radius: 50%;
                    cursor: pointer;
                    flex-shrink: 0;
                    height: 104px;
                    margin-top: -52px;
                    overflow: hidden;
                    position: relative;
                    transition: transform 0.18s;
                    width: 104px;
                }
                .prf-avatar-wrap:hover { transform: scale(1.04); }
                .prf-avatar-img {
                    height: 100%;
                    object-fit: cover;
                    width: 100%;
                }
                .prf-avatar-loading {
                    align-items: center;
                    background: var(--surface-muted);
                    display: flex;
                    justify-content: center;
                }
                .prf-avatar-overlay {
                    align-items: center;
                    background: rgba(0,0,0,0.46);
                    bottom: 0; left: 0; right: 0; top: 0;
                    color: #fff;
                    display: flex;
                    justify-content: center;
                    opacity: 0;
                    position: absolute;
                    transition: opacity 0.18s;
                }
                .prf-avatar-wrap:hover .prf-avatar-overlay { opacity: 1; }

                .prf-edit-btn {
                    align-self: flex-end;
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    border-radius: 999px;
                    color: var(--text-main);
                    cursor: pointer;
                    font-size: 0.82rem;
                    font-weight: 700;
                    margin-bottom: 4px;
                    padding: 8px 18px;
                    transition: background 0.18s, transform 0.18s;
                }
                .prf-edit-btn:hover {
                    background: var(--border-light);
                    transform: translateY(-1px);
                }

                /* Info body */
                .prf-info-body { padding: 16px 24px 28px; }

                /* Badges */
                .prf-badges { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
                .prf-badge {
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.06em;
                    padding: 5px 12px;
                    text-transform: uppercase;
                }
                .prf-badge--role {
                    background: color-mix(in srgb, var(--accent) 14%, transparent);
                    color: var(--accent);
                }
                .prf-badge--verify {
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    color: var(--text-muted);
                }

                .prf-name {
                    font-family: 'Outfit', sans-serif;
                    font-size: clamp(1.6rem, 4vw, 2.4rem);
                    font-weight: 800;
                    letter-spacing: -0.03em;
                    margin-bottom: 4px;
                }
                .prf-email {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    margin-bottom: 10px;
                }
                .prf-bio {
                    color: var(--text-muted);
                    font-size: 0.92rem;
                    line-height: 1.7;
                    margin-bottom: 12px;
                    max-width: 60ch;
                }
                .prf-meta-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 8px;
                }
                .prf-meta-chip {
                    align-items: center;
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    border-radius: 999px;
                    color: var(--text-muted);
                    display: inline-flex;
                    font-size: 0.8rem;
                    font-weight: 500;
                    gap: 6px;
                    padding: 5px 12px;
                }
                .prf-meta-chip--link {
                    color: var(--accent);
                    text-decoration: none;
                }
                .prf-meta-chip--link:hover { text-decoration: underline; }
                .prf-link-row {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 12px;
                }
                .prf-link-pill {
                    background: color-mix(in srgb, var(--accent) 10%, var(--surface-main));
                    border: 1px solid color-mix(in srgb, var(--accent) 20%, var(--border-light));
                    border-radius: 999px;
                    color: var(--text-main);
                    font-size: 0.74rem;
                    font-weight: 700;
                    padding: 6px 12px;
                    text-decoration: none;
                }
                .prf-link-pill:hover {
                    border-color: color-mix(in srgb, var(--accent) 38%, var(--border-light));
                    color: var(--accent);
                }

                /* ── Edit form ──────────────────────────────────── */
                .prf-edit-form { display: flex; flex-direction: column; gap: 20px; }
                .prf-form-grid {
                    display: grid;
                    gap: 14px;
                    grid-template-columns: 1fr 1fr;
                }
                .prf-field { display: flex; flex-direction: column; gap: 6px; }
                .prf-field--full { grid-column: 1 / -1; }
                .prf-label {
                    color: var(--text-muted);
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }
                .prf-input {
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                    border-radius: 12px;
                    color: var(--text-main);
                    font-family: inherit;
                    font-size: 0.9rem;
                    outline: none;
                    padding: 10px 14px;
                    transition: border-color 0.18s, box-shadow 0.18s;
                    width: 100%;
                }
                .prf-input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent);
                }
                .prf-textarea { resize: vertical; }
                .prf-save-error {
                    color: var(--danger-text);
                    font-size: 0.85rem;
                    margin: 0;
                }
                .prf-form-actions {
                    align-items: center;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                .prf-btn {
                    align-items: center;
                    border-radius: 999px;
                    cursor: pointer;
                    display: inline-flex;
                    font-family: inherit;
                    font-size: 0.85rem;
                    font-weight: 700;
                    gap: 7px;
                    padding: 9px 20px;
                    transition: transform 0.18s, box-shadow 0.18s;
                }
                .prf-btn:hover { transform: translateY(-1px); }
                .prf-btn--ghost {
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    color: var(--text-main);
                }
                .prf-btn--primary {
                    background: var(--primary);
                    border: none;
                    color: var(--text-inverse);
                }
                .prf-btn--primary:disabled { opacity: 0.6; }

                /* ── Stats ──────────────────────────────────────── */
                .prf-stats-row {
                    background: var(--surface-main);
                    border: 1px solid var(--border-light);
                    border-radius: 22px;
                    box-shadow: var(--shadow-subtle);
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                }
                .prf-stat {
                    border-right: 1px solid var(--border-light);
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding: 22px 20px;
                    text-align: center;
                }
                .prf-stat:last-child { border-right: none; }
                .prf-stat-val {
                    font-family: 'Outfit', sans-serif;
                    font-size: 1.9rem;
                    font-weight: 800;
                    letter-spacing: -0.04em;
                    line-height: 1;
                }
                .prf-stat-label {
                    color: var(--text-muted);
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0.06em;
                    text-transform: uppercase;
                }

                /* ── Cards (bookings, settings) ─────────────────── */
                .prf-card {
                    background: var(--surface-main);
                    border: 1px solid var(--border-light);
                    border-radius: 24px;
                    box-shadow: var(--shadow-subtle);
                    padding: 24px;
                }
                .prf-card-head {
                    align-items: flex-start;
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .prf-card-title {
                    font-family: 'Outfit', sans-serif;
                    font-size: 1.2rem;
                    font-weight: 800;
                    letter-spacing: -0.02em;
                }
                .prf-card-sub { color: var(--text-muted); font-size: 0.85rem; margin-top: 3px; }
                .prf-count-badge {
                    background: var(--surface-muted);
                    border-radius: 999px;
                    color: var(--text-muted);
                    flex-shrink: 0;
                    font-size: 0.75rem;
                    font-weight: 700;
                    padding: 4px 12px;
                    text-transform: uppercase;
                }
                .prf-readiness {
                    display: grid;
                    gap: 16px;
                }
                .prf-progress-track {
                    background: color-mix(in srgb, var(--surface-muted) 65%, var(--surface-main));
                    border-radius: 999px;
                    height: 10px;
                    overflow: hidden;
                }
                .prf-progress-fill {
                    background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 45%, #fff));
                    border-radius: inherit;
                    display: block;
                    height: 100%;
                }
                .prf-checklist {
                    display: grid;
                    gap: 10px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .prf-check-item {
                    align-items: center;
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                    border-radius: 14px;
                    display: flex;
                    gap: 10px;
                    justify-content: space-between;
                    padding: 12px 14px;
                }
                .prf-check-item span {
                    font-size: 0.86rem;
                    font-weight: 600;
                }
                .prf-check-item strong {
                    color: var(--text-muted);
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                    text-transform: uppercase;
                }
                .prf-check-item.is-complete {
                    border-color: color-mix(in srgb, #22c55e 28%, var(--border-light));
                    background: color-mix(in srgb, #22c55e 7%, var(--surface-main));
                }
                .prf-check-item.is-complete strong {
                    color: #15803d;
                }
                .prf-inline-note {
                    align-items: center;
                    background: color-mix(in srgb, var(--accent) 8%, var(--surface-main));
                    border: 1px solid color-mix(in srgb, var(--accent) 18%, var(--border-light));
                    border-radius: 16px;
                    display: flex;
                    gap: 12px;
                    justify-content: space-between;
                    padding: 12px 14px;
                }
                .prf-inline-note span {
                    color: var(--text-muted);
                    font-size: 0.84rem;
                }
                .prf-inline-action {
                    background: transparent;
                    border: none;
                    color: var(--accent);
                    cursor: pointer;
                    font-size: 0.82rem;
                    font-weight: 800;
                    padding: 0;
                }
                .prf-detail-grid {
                    display: grid;
                    gap: 12px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                }
                .prf-detail-card {
                    align-items: flex-start;
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                    border-radius: 16px;
                    display: flex;
                    gap: 12px;
                    padding: 14px;
                }
                .prf-detail-icon {
                    align-items: center;
                    background: color-mix(in srgb, var(--accent) 14%, var(--surface-main));
                    border-radius: 12px;
                    color: var(--accent);
                    display: inline-flex;
                    flex-shrink: 0;
                    height: 34px;
                    justify-content: center;
                    width: 34px;
                }
                .prf-detail-card span {
                    color: var(--text-muted);
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 0.05em;
                    margin-bottom: 3px;
                    text-transform: uppercase;
                }
                .prf-detail-card strong {
                    color: var(--text-main);
                    font-size: 0.9rem;
                    line-height: 1.45;
                }

                /* Booking list */
                .prf-booking-list { display: flex; flex-direction: column; gap: 12px; }
                .prf-booking-card {
                    align-items: center;
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                    border-radius: 16px;
                    display: flex;
                    gap: 14px;
                    padding: 14px;
                    transition: box-shadow 0.18s;
                }
                .prf-booking-card:hover { box-shadow: var(--shadow-subtle); }
                .prf-booking-thumb {
                    border-radius: 12px;
                    flex-shrink: 0;
                    height: 68px;
                    overflow: hidden;
                    width: 68px;
                }
                .prf-booking-thumb img { height: 100%; object-fit: cover; width: 100%; }
                .prf-booking-info { flex: 1; min-width: 0; }
                .prf-booking-info h4 { font-size: 0.95rem; font-weight: 700; margin-bottom: 6px; }
                .prf-booking-meta {
                    align-items: center;
                    color: var(--text-muted);
                    display: flex;
                    flex-wrap: wrap;
                    font-size: 0.78rem;
                    font-weight: 600;
                    gap: 10px;
                }
                .prf-booking-meta span {
                    align-items: center;
                    display: inline-flex;
                    gap: 5px;
                }
                .prf-booking-right { flex-shrink: 0; text-align: right; }
                .prf-booking-right strong { display: block; font-size: 1rem; font-weight: 800; margin-bottom: 6px; }
                .prf-status {
                    border-radius: 999px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    letter-spacing: 0.06em;
                    padding: 4px 10px;
                    text-transform: uppercase;
                }
                .prf-status--confirmed, .prf-status--completed {
                    background: var(--success-bg);
                    color: var(--success-text);
                }
                .prf-status--pending {
                    background: rgba(245,158,11,0.12);
                    color: #d97706;
                }
                .prf-status--cancelled {
                    background: rgba(239,68,68,0.1);
                    color: var(--danger-text);
                }

                .prf-favorite-list { display: flex; flex-direction: column; gap: 12px; }
                .prf-favorite-card {
                    align-items: center;
                    background: var(--bg-main);
                    border: 1px solid var(--border-light);
                    border-radius: 16px;
                    color: inherit;
                    display: flex;
                    gap: 14px;
                    padding: 14px;
                    text-decoration: none;
                    transition: box-shadow 0.18s, border-color 0.18s;
                }
                .prf-favorite-card:hover {
                    border-color: color-mix(in srgb, var(--accent) 35%, var(--border-light));
                    box-shadow: var(--shadow-subtle);
                }
                .prf-favorite-thumb {
                    border-radius: 12px;
                    flex-shrink: 0;
                    height: 68px;
                    overflow: hidden;
                    width: 68px;
                }
                .prf-favorite-thumb img { height: 100%; object-fit: cover; width: 100%; }
                .prf-favorite-info { flex: 1; min-width: 0; }
                .prf-favorite-info h4 {
                    font-size: 0.95rem;
                    font-weight: 700;
                    margin: 0 0 4px;
                }
                .prf-favorite-info p {
                    color: var(--text-muted);
                    font-size: 0.82rem;
                    margin: 0;
                }
                .prf-favorite-right { flex-shrink: 0; text-align: right; }
                .prf-favorite-type {
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    border-radius: 999px;
                    color: var(--text-muted);
                    display: inline-block;
                    font-size: 0.62rem;
                    font-weight: 800;
                    letter-spacing: 0.06em;
                    margin-bottom: 7px;
                    padding: 4px 9px;
                    text-transform: uppercase;
                }
                .prf-favorite-right strong {
                    display: block;
                    font-size: 0.9rem;
                    font-weight: 800;
                }

                /* Empty state */
                .prf-empty {
                    align-items: center;
                    display: flex;
                    flex-direction: column;
                    padding: 48px 24px;
                    text-align: center;
                }
                .prf-empty p { color: var(--text-muted); font-size: 0.95rem; }

                .prf-center-loader {
                    align-items: center;
                    color: var(--text-muted);
                    display: flex;
                    justify-content: center;
                    padding: 48px;
                }

                /* ── Settings ───────────────────────────────────── */
                .prf-setting-row {
                    align-items: center;
                    display: flex;
                    gap: 14px;
                    justify-content: space-between;
                    padding: 14px 0;
                }
                .prf-setting-left {
                    align-items: center;
                    display: flex;
                    gap: 14px;
                    min-width: 0;
                }
                .prf-setting-icon {
                    align-items: center;
                    background: var(--surface-muted);
                    border-radius: 10px;
                    color: var(--text-muted);
                    display: flex;
                    flex-shrink: 0;
                    height: 36px;
                    justify-content: center;
                    width: 36px;
                }
                .prf-setting-icon--danger {
                    background: rgba(239,68,68,0.1);
                    color: var(--danger-text);
                }
                .prf-setting-label { font-size: 0.9rem; font-weight: 700; margin: 0; }
                .prf-setting-sub { color: var(--text-muted); font-size: 0.78rem; margin: 2px 0 0; }
                .prf-setting-sep {
                    background: var(--border-light);
                    height: 1px;
                    margin: 0 -2px;
                }

                .prf-action-btn,
                .prf-primary-action-btn,
                .prf-danger-action-btn {
                    align-items: center;
                    border-radius: 999px;
                    cursor: pointer;
                    display: inline-flex;
                    flex-shrink: 0;
                    font-size: 0.82rem;
                    font-weight: 700;
                    gap: 8px;
                    justify-content: center;
                    min-height: 36px;
                    padding: 8px 16px;
                    transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
                }
                .prf-action-btn {
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    color: var(--text-primary);
                }
                .prf-primary-action-btn {
                    background: var(--accent);
                    border: 1px solid var(--accent);
                    color: #fff;
                }
                .prf-danger-action-btn {
                    background: rgba(239,68,68,0.92);
                    border: 1px solid rgba(239,68,68,0.92);
                    color: #fff;
                }
                .prf-action-btn:hover:not(:disabled),
                .prf-primary-action-btn:hover:not(:disabled),
                .prf-danger-action-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                }
                .prf-action-btn:disabled,
                .prf-primary-action-btn:disabled,
                .prf-danger-action-btn:disabled {
                    cursor: not-allowed;
                    opacity: 0.55;
                }

                .prf-security-panel {
                    background: var(--surface-muted);
                    border: 1px solid var(--border-light);
                    border-radius: 18px;
                    display: grid;
                    gap: 14px;
                    margin: 2px 0 14px;
                    padding: 14px;
                }
                .prf-security-panel--danger {
                    background: rgba(239,68,68,0.05);
                    border-color: rgba(239,68,68,0.2);
                }
                .prf-security-grid {
                    display: grid;
                    gap: 12px;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .prf-security-field {
                    display: grid;
                    gap: 7px;
                    min-width: 0;
                }
                .prf-security-field span {
                    color: var(--text-muted);
                    font-size: 0.76rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .prf-security-field input {
                    background: var(--surface-card);
                    border: 1px solid var(--border-light);
                    border-radius: 999px;
                    color: var(--text-primary);
                    font: inherit;
                    font-size: 0.88rem;
                    min-height: 42px;
                    outline: none;
                    padding: 0 14px;
                    transition: border-color 0.18s ease, box-shadow 0.18s ease;
                    width: 100%;
                }
                .prf-security-field input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px rgba(255,122,47,0.14);
                }
                .prf-security-actions {
                    align-items: center;
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
                .prf-security-alert {
                    border-radius: 12px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    padding: 10px 12px;
                }
                .prf-security-alert--error {
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.22);
                    color: var(--danger-text);
                }
                .prf-security-alert--info {
                    background: rgba(34,197,94,0.1);
                    border: 1px solid rgba(34,197,94,0.24);
                    color: #15803d;
                }
                .prf-delete-warning {
                    align-items: center;
                    color: var(--danger-text);
                    display: flex;
                    font-size: 0.82rem;
                    font-weight: 700;
                    gap: 9px;
                    line-height: 1.35;
                }

                .prf-password-format {
                    align-items: center;
                    display: grid;
                    gap: 14px;
                    grid-template-columns: auto minmax(0, 1fr);
                }
                .prf-password-meter {
                    --password-progress: 0%;
                    --password-progress-offset: 157.08;
                    background: var(--surface-card);
                    border-radius: 50%;
                    display: grid;
                    height: 60px;
                    place-items: center;
                    position: relative;
                    transition: transform 0.18s ease;
                    width: 60px;
                }
                .prf-password-format.is-complete .prf-password-meter {
                    transform: scale(1.02);
                }
                .prf-password-meter svg {
                    height: 100%;
                    inset: 0;
                    position: absolute;
                    transform: rotate(-90deg);
                    width: 100%;
                }
                .prf-password-meter-track,
                .prf-password-meter-progress {
                    fill: none;
                    stroke-width: 8;
                }
                .prf-password-meter-track { stroke: var(--border-light); }
                .prf-password-meter-progress {
                    stroke: var(--accent);
                    stroke-dasharray: 157.08;
                    stroke-dashoffset: var(--password-progress-offset);
                    stroke-linecap: round;
                    transition: stroke-dashoffset 0.24s ease, stroke 0.18s ease;
                }
                .prf-password-format.is-complete .prf-password-meter-progress { stroke: #168248; }
                .prf-password-meter span {
                    color: var(--text-primary);
                    font-size: 0.8rem;
                    font-weight: 900;
                    position: relative;
                    z-index: 1;
                }
                .prf-password-rules {
                    display: grid;
                    gap: 7px 10px;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .prf-password-rules li {
                    align-items: center;
                    color: var(--text-muted);
                    display: inline-flex;
                    font-size: 0.78rem;
                    font-weight: 700;
                    gap: 7px;
                    line-height: 1.25;
                    min-width: 0;
                    transition: color 0.18s ease, transform 0.18s ease;
                }
                .prf-password-rules li span {
                    background: var(--surface-card);
                    border: 1px solid var(--border-strong);
                    border-radius: 50%;
                    flex: 0 0 9px;
                    height: 9px;
                    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
                    width: 9px;
                }
                .prf-password-rules li.is-met {
                    color: #168248;
                    transform: translateX(1px);
                }
                .prf-password-rules li.is-met span {
                    background: #168248;
                    border-color: #168248;
                    box-shadow: 0 0 0 3px rgba(22,130,72,0.12);
                }

                /* Toggle switch */
                .prf-toggle {
                    background: var(--border-light);
                    border: none;
                    border-radius: 999px;
                    cursor: pointer;
                    flex-shrink: 0;
                    height: 26px;
                    padding: 3px;
                    position: relative;
                    transition: background 0.25s ease;
                    width: 48px;
                }
                .prf-toggle--on { background: var(--accent); }
                .prf-toggle-knob {
                    background: #fff;
                    border-radius: 50%;
                    display: block;
                    height: 20px;
                    left: 3px;
                    position: absolute;
                    top: 3px;
                    transition: left 0.25s ease;
                    width: 20px;
                }
                .prf-toggle--on .prf-toggle-knob { left: calc(100% - 23px); }

                /* Sign out button */
                .prf-signout-btn {
                    background: rgba(239,68,68,0.08);
                    border: 1px solid rgba(239,68,68,0.2);
                    border-radius: 999px;
                    color: var(--danger-text);
                    cursor: pointer;
                    flex-shrink: 0;
                    font-size: 0.82rem;
                    font-weight: 700;
                    padding: 8px 18px;
                    transition: background 0.18s;
                }
                .prf-signout-btn:hover { background: rgba(239,68,68,0.14); }

                /* ── Responsive ─────────────────────────────────── */
                @media (max-width: 640px) {
                    .prf-page { padding-top: calc(72px + env(safe-area-inset-top, 0px)); }
                    .prf-cover { height: 150px; }
                    .prf-avatar-wrap { height: 84px; margin-top: -42px; width: 84px; }
                    .prf-avatar-row { padding: 0 16px; }
                    .prf-info-body { padding: 12px 16px 22px; }
                    .prf-form-grid { grid-template-columns: 1fr; }
                    .prf-setting-row {
                        align-items: flex-start;
                        gap: 12px;
                    }
                    .prf-setting-left {
                        align-items: flex-start;
                    }
                    .prf-action-btn,
                    .prf-primary-action-btn,
                    .prf-danger-action-btn,
                    .prf-signout-btn {
                        min-height: 34px;
                        padding: 7px 12px;
                    }
                    .prf-security-grid {
                        grid-template-columns: 1fr;
                    }
                    .prf-security-actions {
                        display: grid;
                        grid-template-columns: 1fr;
                    }
                    .prf-security-actions .prf-action-btn,
                    .prf-security-actions .prf-primary-action-btn,
                    .prf-security-actions .prf-danger-action-btn {
                        width: 100%;
                    }
                    .prf-password-format {
                        grid-template-columns: 1fr;
                        justify-items: center;
                    }
                    .prf-password-rules {
                        grid-template-columns: 1fr;
                        width: 100%;
                    }
                    .prf-field--full { grid-column: auto; }
                    .prf-stats-row { grid-template-columns: repeat(2, 1fr); }
                    .prf-checklist { grid-template-columns: 1fr; }
                    .prf-detail-grid { grid-template-columns: 1fr; }
                    .prf-inline-note { align-items: flex-start; flex-direction: column; }
                    .prf-stat:nth-child(2) { border-right: none; }
                    .prf-stat:nth-child(3) { border-top: 1px solid var(--border-light); }
                    .prf-stat:nth-child(4) { border-top: 1px solid var(--border-light); }
                    .prf-booking-card { flex-wrap: wrap; }
                    .prf-booking-right { width: 100%; display: flex; justify-content: space-between; align-items: center; }
                    .prf-favorite-card { flex-wrap: wrap; }
                    .prf-favorite-right { width: 100%; display: flex; justify-content: space-between; align-items: center; text-align: left; }
                    .prf-favorite-type { margin-bottom: 0; }
                }

                @media (max-width: 900px) {
                    .prf-page { padding-bottom: 136px; }
                }
            `}</style>
        </main>
    );
};
