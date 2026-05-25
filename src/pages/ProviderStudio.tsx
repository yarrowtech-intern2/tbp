import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Calendar,
    CheckCircle2,
    Clock,
    Compass,
    DollarSign,
    Edit3,
    FileText,
    Image,
    Loader2,
    MapPin,
    ShieldAlert,
    Sparkles,
    Star,
    Tag,
    Trash2,
    Type,
    Upload,
    Zap,
} from 'lucide-react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
    createOrUpdateListing,
    getMyPosts,
    type ListingInput,
    type PostRecord,
} from '../lib/destinations';
import { PLATFORM_FEE_RATE, calculatePricingFromProviderUnit } from '../lib/pricing';
import { LISTING_LABELS, getRoleLabel, type ListingType, canRolePublish } from '../lib/platform';
import './provider-studio.css';

const LISTING_IMAGE_BUCKET = 'avatars';
const MAX_LISTING_IMAGE_MB = 8;
const MIN_LISTING_IMAGES = 5;

const TYPE_META: Record<ListingType, { icon: React.ReactNode; description: string }> = {
    tour: { icon: <Compass size={22} />, description: 'Itinerary-led guided tour' },
    activity: { icon: <Zap size={22} />, description: 'Hands-on guided activity' },
    guide: { icon: <Calendar size={22} />, description: 'Date-based event listing' },
};

const EMPTY_FORM = (type: ListingType): ListingInput => ({
    title: '',
    description: '',
    location: '',
    image_url: '',
    cover_image_url: '',
    gallery_images: [],
    type,
    sub_category: '',
    price: null,
    starts_at: '',
    status: 'pending',
});

const PROVIDER_STUDIO_DRAFT_STORAGE_PREFIX = 'tbp:provider-studio-draft:v1:';

type ProviderStudioDraft = {
    form: ListingInput;
    galleryInput: string;
    acceptTerms: boolean;
    acceptAgreement: boolean;
};

const getProviderStudioDraftKey = (userId: string) => `${PROVIDER_STUDIO_DRAFT_STORAGE_PREFIX}${userId}`;

const readProviderStudioDraft = (userId: string, allowedTypes: ListingType[]): ProviderStudioDraft | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.sessionStorage.getItem(getProviderStudioDraftKey(userId));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Partial<ProviderStudioDraft>;
        const rawForm = parsed.form as Partial<ListingInput> | undefined;
        if (!rawForm || typeof rawForm !== 'object') return null;
        const fallbackType = allowedTypes[0] || 'tour';
        const rawType = rawForm.type;
        const type = rawType && allowedTypes.includes(rawType) ? rawType : fallbackType;
        return {
            form: {
                ...EMPTY_FORM(type),
                ...rawForm,
                type,
                gallery_images: normalizeImageList(rawForm.gallery_images || []),
                price: typeof rawForm.price === 'number' ? rawForm.price : Number(rawForm.price || 0) || null,
            },
            galleryInput: typeof parsed.galleryInput === 'string' ? parsed.galleryInput : '',
            acceptTerms: parsed.acceptTerms === true,
            acceptAgreement: parsed.acceptAgreement === true,
        };
    } catch {
        return null;
    }
};

const writeProviderStudioDraft = (userId: string, draft: ProviderStudioDraft) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(getProviderStudioDraftKey(userId), JSON.stringify(draft));
};

const clearProviderStudioDraft = (userId: string) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(getProviderStudioDraftKey(userId));
};

const getStatusDotClass = (status?: string | null) => {
    switch (status) {
        case 'live':
        case 'published':
            return 'ps-status-dot ps-status-dot--live';
        case 'approved':
            return 'ps-status-dot ps-status-dot--approved';
        case 'rejected': return 'ps-status-dot ps-status-dot--rejected';
        default: return 'ps-status-dot ps-status-dot--pending';
    }
};

const getListingStatusLabel = (status?: string | null) => {
    if (status === 'published') return 'live';
    return status || 'pending';
};

const getStatusPillClass = (verificationStatus?: string | null) => {
    switch (verificationStatus) {
        case 'approved': return 'ps-status-pill ps-status-pill--approved';
        case 'rejected': return 'ps-status-pill ps-status-pill--rejected';
        default: return 'ps-status-pill ps-status-pill--pending';
    }
};

const getListingTitle = (listing: PostRecord) => listing.title || listing.name || 'Untitled listing';

const getPrimaryActionCopy = (type: ListingType) => {
    switch (type) {
        case 'tour': return 'Submit Tour';
        case 'activity': return 'Submit Activity';
        case 'guide': return 'Submit Event';
    }
};

const normalizeImageList = (values: Array<unknown>): string[] => Array.from(new Set(
    values
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
));

const extractGalleryImages = (listing: PostRecord): string[] => {
    const rawGallery = listing.gallery_images;
    const base = Array.isArray(rawGallery) ? rawGallery : [];
    return normalizeImageList([
        ...base,
        listing.image_url,
        listing.cover_image_url,
        listing.thumbnail_url,
    ]);
};

type ProviderStudioProps = {
    embedded?: boolean;
};

type SubmissionModalState = {
    mode: 'created' | 'updated';
    listingTitle: string;
    listingType: ListingType;
};

export const ProviderStudio: React.FC<ProviderStudioProps> = ({ embedded = false }) => {
    const { user, profile, isProvider, verificationLabel } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [listings, setListings] = useState<PostRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [editingListingId, setEditingListingId] = useState<string | null>(null);
    const [form, setForm] = useState<ListingInput>(EMPTY_FORM('tour'));
    const [imgError, setImgError] = useState(false);
    const [galleryInput, setGalleryInput] = useState('');
    const [galleryError, setGalleryError] = useState<string | null>(null);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptAgreement, setAcceptAgreement] = useState(false);
    const [consentError, setConsentError] = useState<string | null>(null);
    const [submissionModal, setSubmissionModal] = useState<SubmissionModalState | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const draftRestoredRef = useRef(false);

    const allowedTypes = useMemo(
        () => (['tour', 'activity', 'guide'] as ListingType[]).filter((type) => canRolePublish(profile?.role, type)),
        [profile?.role]
    );
    const canAccessStudio = isProvider && allowedTypes.length > 0;
    const currentUserId = user?.id || null;

    const loadListings = useCallback(async () => {
        if (!currentUserId) return;
        setLoading(true);
        try {
            const rows = await getMyPosts(currentUserId);
            setListings(rows);
            if (allowedTypes.length > 0) {
                setForm((current) => ({
                    ...current,
                    type: allowedTypes.includes(current.type) ? current.type : allowedTypes[0],
                }));
            }
        } finally {
            setLoading(false);
        }
    }, [allowedTypes, currentUserId]);

    useEffect(() => {
        if (!currentUserId || !isProvider) return;
        void loadListings();
    }, [currentUserId, isProvider, loadListings]);

    useEffect(() => {
        if (!currentUserId || allowedTypes.length === 0 || draftRestoredRef.current) return;
        draftRestoredRef.current = true;
        const draft = readProviderStudioDraft(currentUserId, allowedTypes);
        if (!draft) return;

        setEditingListingId(null);
        setImgError(false);
        setGalleryError(null);
        setConsentError(null);
        setForm(draft.form);
        setGalleryInput(draft.galleryInput);
        setAcceptTerms(draft.acceptTerms);
        setAcceptAgreement(draft.acceptAgreement);
    }, [allowedTypes, currentUserId]);

    useEffect(() => {
        if (!currentUserId || !draftRestoredRef.current || editingListingId) return;
        writeProviderStudioDraft(currentUserId, {
            form,
            galleryInput,
            acceptTerms,
            acceptAgreement,
        });
    }, [acceptAgreement, acceptTerms, currentUserId, editingListingId, form, galleryInput]);

    const resetForm = () => {
        setEditingListingId(null);
        setImgError(false);
        setGalleryInput('');
        setGalleryError(null);
        setAcceptTerms(false);
        setAcceptAgreement(false);
        setConsentError(null);
        setForm(EMPTY_FORM(allowedTypes[0] || 'tour'));
        if (currentUserId) clearProviderStudioDraft(currentUserId);
    };

    const beginEdit = useCallback((listing: PostRecord) => {
        const listingType = (listing.type === 'event' ? 'guide' : listing.type || allowedTypes[0] || 'tour') as ListingType;
        const galleryImages = extractGalleryImages(listing);
        const primaryImage = (typeof listing.image_url === 'string' && listing.image_url.trim())
            ? listing.image_url.trim()
            : (galleryImages[0] || '');
        const coverImage = (typeof listing.cover_image_url === 'string' && listing.cover_image_url.trim())
            ? listing.cover_image_url.trim()
            : (galleryImages.find((item) => item !== primaryImage) || galleryImages[1] || '');
        setEditingListingId(listing.id);
        setImgError(false);
        setGalleryInput('');
        setGalleryError(null);
        setAcceptTerms(false);
        setAcceptAgreement(false);
        setConsentError(null);
        if (currentUserId) clearProviderStudioDraft(currentUserId);
        setForm({
            id: listing.id,
            user_id: listing.user_id,
            provider_user_id: listing.provider_user_id,
            company_profile_id: listing.company_profile_id,
            title: getListingTitle(listing),
            description: listing.description || '',
            location: listing.location || '',
            image_url: primaryImage,
            cover_image_url: coverImage,
            gallery_images: galleryImages,
            type: listingType,
            sub_category: listing.sub_category || '',
            price: typeof listing.price === 'number' ? listing.price : null,
            starts_at: listing.starts_at || '',
            status: (listing.status as ListingInput['status']) || 'pending',
        });
    }, [allowedTypes, currentUserId]);

    useEffect(() => {
        const editId = searchParams.get('edit');
        if (!editId || loading) return;

        const target = listings.find((listing) => listing.id === editId);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete('edit');

        if (!target) {
            setSearchParams(nextParams, { replace: true });
            return;
        }

        beginEdit(target);
        setSearchParams(nextParams, { replace: true });
    }, [beginEdit, listings, loading, searchParams, setSearchParams]);

    useEffect(() => {
        if (!submissionModal) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setSubmissionModal(null);
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [submissionModal]);

    const galleryImages = useMemo(
        () => normalizeImageList(form.gallery_images || []),
        [form.gallery_images]
    );
    const pricingPreview = useMemo(
        () => calculatePricingFromProviderUnit(typeof form.price === 'number' ? form.price : 0, 1, PLATFORM_FEE_RATE),
        [form.price]
    );

    const applyGallery = useCallback((nextImages: string[]) => {
        const cleaned = normalizeImageList(nextImages);
        setForm((current) => {
            const currentPrimary = current.image_url?.trim() || '';
            const currentCover = current.cover_image_url?.trim() || '';
            const primary = cleaned.includes(currentPrimary) ? currentPrimary : (cleaned[0] || '');
            const coverFromCurrent = cleaned.includes(currentCover) ? currentCover : '';
            const cover = coverFromCurrent || cleaned.find((item) => item !== primary) || '';
            return {
                ...current,
                gallery_images: cleaned,
                image_url: primary,
                cover_image_url: cover,
            };
        });
    }, []);

    const addGalleryImage = useCallback((url: string) => {
        const normalized = url.trim();
        if (!normalized) return;
        applyGallery([...(form.gallery_images || []), normalized]);
        setGalleryInput('');
        setGalleryError(null);
    }, [applyGallery, form.gallery_images]);

    const removeGalleryImage = useCallback((url: string) => {
        applyGallery((form.gallery_images || []).filter((item) => item !== url));
        setGalleryError(null);
    }, [applyGallery, form.gallery_images]);

    const setPrimaryImage = useCallback((url: string) => {
        setForm((current) => {
            const images = normalizeImageList(current.gallery_images || []);
            if (!images.includes(url)) return current;
            const cover = current.cover_image_url === url
                ? images.find((item) => item !== url) || ''
                : (current.cover_image_url || images.find((item) => item !== url) || '');
            return {
                ...current,
                image_url: url,
                cover_image_url: cover,
                gallery_images: images,
            };
        });
        setGalleryError(null);
    }, []);

    const setCoverImage = useCallback((url: string) => {
        setForm((current) => {
            const images = normalizeImageList(current.gallery_images || []);
            if (!images.includes(url)) return current;
            const primary = current.image_url?.trim() || images[0] || '';
            const nextPrimary = primary === url ? (images.find((item) => item !== url) || '') : primary;
            return {
                ...current,
                image_url: nextPrimary,
                cover_image_url: url,
                gallery_images: images,
            };
        });
        setGalleryError(null);
    }, []);

    if (!user || !isProvider) {
        if (embedded) return null;
        return <Navigate to="/dashboard" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canAccessStudio || uploadingImage) return;
        const wasEditing = Boolean(editingListingId);
        const submittedType = form.type;
        const submittedTitle = form.title.trim() || `Untitled ${LISTING_LABELS[form.type]}`;
        const normalizedGallery = normalizeImageList(form.gallery_images || []);
        const primaryImage = (form.image_url || '').trim();
        const coverImage = (form.cover_image_url || '').trim();
        if (!editingListingId && (!acceptTerms || !acceptAgreement)) {
            setConsentError('Accept Terms and Conditions and Provider Agreement before posting.');
            return;
        }
        if (normalizedGallery.length < MIN_LISTING_IMAGES) {
            setGalleryError(`Add at least ${MIN_LISTING_IMAGES} images before submitting.`);
            return;
        }
        if (!primaryImage || !normalizedGallery.includes(primaryImage)) {
            setGalleryError('Select a valid primary image from the gallery.');
            return;
        }
        if (!coverImage || !normalizedGallery.includes(coverImage)) {
            setGalleryError('Select a valid cover image from the gallery.');
            return;
        }
        if (coverImage === primaryImage) {
            setGalleryError('Primary and cover images must be different.');
            return;
        }
        setConsentError(null);
        setGalleryError(null);
        setSaving(true);
        try {
            await createOrUpdateListing({
                ...form,
                id: editingListingId || form.id,
                provider_user_id: user.id,
                user_id: user.id,
                company_profile_id: profile?.company_profile_id || null,
                image_url: primaryImage,
                cover_image_url: coverImage,
                gallery_images: normalizedGallery,
                status: 'pending',
                rejection_reason: null,
                price: typeof form.price === 'number' ? form.price : Number(form.price || 0) || null,
                starts_at: form.starts_at || null,
            });
            await loadListings();
            resetForm();
            setSubmissionModal({
                mode: wasEditing ? 'updated' : 'created',
                listingTitle: submittedTitle,
                listingType: submittedType,
            });
        } catch (error) {
            const err = error as {
                error?: { code?: string; message?: string; details?: string | null; hint?: string | null };
                code?: string;
                message?: string;
                details?: string | null;
                hint?: string | null;
            };
            const normalized = err?.error && typeof err.error === 'object' ? err.error : err;
            const message = normalized?.message || 'Failed to submit listing. Please try again.';
            console.error('Failed to submit listing:', normalized);
            alert(message);
        } finally {
            setSaving(false);
        }
    };

    const uploadListingImage = async (file: File): Promise<string> => {
        if (!user) throw new Error('You must be logged in to upload an image.');
        const ext = file.name.split('.').pop() || 'jpg';
        const safeType = form.type || 'tour';
        const path = `${user.id}/listing-${safeType}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage
            .from(LISTING_IMAGE_BUCKET)
            .upload(path, file, { upsert: true, contentType: file.type });
        if (error) throw error;
        const { data } = supabase.storage.from(LISTING_IMAGE_BUCKET).getPublicUrl(path);
        return `${data.publicUrl}?t=${Date.now()}`;
    };

    const handleListingImageUpload = async (file: File) => {
        if (!canAccessStudio || !user) return;
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file.');
            return;
        }
        if (file.size > MAX_LISTING_IMAGE_MB * 1024 * 1024) {
            alert(`Image is too large. Max allowed size is ${MAX_LISTING_IMAGE_MB}MB.`);
            return;
        }
        setUploadingImage(true);
        try {
            const uploadedUrl = await uploadListingImage(file);
            setImgError(false);
            addGalleryImage(uploadedUrl);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || '');
            console.error('Failed to upload listing image:', error);
            if (message.toLowerCase().includes('bucket')) {
                alert('Image upload failed: storage bucket is missing. Please run docs/supabase-role-system.sql.');
            } else if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('policy')) {
                alert('Image upload blocked by Supabase policy. Please run docs/supabase-role-system.sql.');
            } else {
                alert(message || 'Failed to upload image. Please try again.');
            }
        } finally {
            setUploadingImage(false);
        }
    };

    const avatarInitial = (profile?.full_name || user.email || 'P')[0].toUpperCase();

    return (
        <main className={`ps-page animate-fade${embedded ? ' ps-page--embedded' : ''}`}>
            <div className={embedded ? 'ps-embedded-shell' : 'container'} style={embedded ? undefined : { maxWidth: '1160px' }}>

                {/* Header */}
                <div className="ps-header">
                    <span className="ps-badge">
                        <Sparkles size={12} />
                        Provider Studio
                    </span>
                    <h1 className="ps-title">Your Posting Studio</h1>
                    <p className="ps-subtitle">
                        Submit tours, activities, and events for admin review, then track each post until it goes live.
                    </p>
                </div>

                {/* Account Status Bar */}
                <div className="ps-status-bar">
                    <div className="ps-status-bar-avatar">{avatarInitial}</div>
                    <div>
                        <p className="ps-status-bar-name">{profile?.full_name || user.email}</p>
                        <p className="ps-status-bar-role">{getRoleLabel(profile?.role)} account</p>
                    </div>
                    <div className="ps-status-bar-divider" />
                    <span className={getStatusPillClass(profile?.verification_status)}>
                        {verificationLabel}
                    </span>
                    {profile?.company_name && (
                        <>
                            <div className="ps-status-bar-divider" />
                            <span className="ps-status-bar-company">{profile.company_name}</span>
                        </>
                    )}
                </div>

                {/* Lock Banner */}
                {!canAccessStudio && (
                    <div className="ps-lock-banner">
                        <ShieldAlert size={20} />
                        <div>
                            <strong>Provider publishing is not available for this role</strong>
                            <p>Your current role cannot create tours, activities, or events.</p>
                        </div>
                    </div>
                )}

                {/* Quick-start capability chips */}
                {allowedTypes.length > 0 && (
                    <div className="ps-capability-strip">
                        {allowedTypes.map((type) => (
                            <button
                                key={type}
                                type="button"
                                className="ps-capability-chip"
                                disabled={!canAccessStudio}
                                onClick={() => {
                                    setEditingListingId(null);
                                    setImgError(false);
                                    setGalleryInput('');
                                    setGalleryError(null);
                                    setAcceptTerms(false);
                                    setAcceptAgreement(false);
                                    setConsentError(null);
                                    setForm({ ...EMPTY_FORM(type), type });
                                }}
                            >
                                {TYPE_META[type].icon}
                                New {LISTING_LABELS[type]}
                            </button>
                        ))}
                    </div>
                )}

                {/* Main Grid */}
                <div className="ps-grid">

                    {/* ── Form Card ── */}
                    <article className="ps-card">
                        <div className="ps-card-head">
                            <div>
                                <span className="ps-card-label">
                                    <FileText size={11} />
                                    {editingListingId ? 'Editing' : 'Create Listing'}
                                </span>
                                <h2 className="ps-card-title">
                                    {editingListingId ? 'Update listing for review' : getPrimaryActionCopy(form.type)}
                                </h2>
                                <p className="ps-card-desc">
                                    New and edited listings are sent to admin moderation before they go live.
                                </p>
                            </div>
                            {editingListingId && (
                                <button type="button" className="ps-cancel-btn" onClick={resetForm}>
                                    Cancel edit
                                </button>
                            )}
                        </div>

                        {/* Type Picker */}
                        {allowedTypes.length > 1 && (
                            <div className="ps-type-picker">
                                {allowedTypes.map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        className={`ps-type-card${form.type === type ? ' ps-type-card--active' : ''}`}
                                        disabled={!canAccessStudio}
                                        onClick={() => setForm((f) => ({ ...f, type }))}
                                    >
                                        {TYPE_META[type].icon}
                                        <span>{LISTING_LABELS[type]}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="ps-form">
                            <label className="ps-field">
                                <span className="ps-field-label"><Type size={13} /> Title</span>
                                <input
                                    className="ps-input"
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    placeholder="e.g. Sunrise Hike through Margalla Hills"
                                    disabled={!canAccessStudio}
                                    required
                                />
                            </label>

                            <div className="ps-two-up">
                                <label className="ps-field">
                                    <span className="ps-field-label"><MapPin size={13} /> Location</span>
                                    <input
                                        className="ps-input"
                                        value={form.location}
                                        onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                                        placeholder="City, Country"
                                        disabled={!canAccessStudio}
                                        required
                                    />
                                </label>
                                <label className="ps-field">
                                    <span className="ps-field-label"><Tag size={13} /> Subcategory</span>
                                    <input
                                        className="ps-input"
                                        value={form.sub_category || ''}
                                        onChange={(e) => setForm((f) => ({ ...f, sub_category: e.target.value }))}
                                        placeholder="e.g. Hiking, Cooking class"
                                        disabled={!canAccessStudio}
                                    />
                                </label>
                            </div>

                            <div className="ps-field">
                                <span className="ps-field-label"><Image size={13} /> Listing Images ({galleryImages.length}/{MIN_LISTING_IMAGES}+)</span>
                                <div className="ps-image-upload-row">
                                    <button
                                        type="button"
                                        className="ps-upload-btn"
                                        disabled={!canAccessStudio || uploadingImage}
                                        onClick={() => imageInputRef.current?.click()}
                                    >
                                        {uploadingImage ? (
                                            <>
                                                <Loader2 className="animate-spin" size={14} />
                                                Uploading...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={14} />
                                                Upload from device
                                            </>
                                        )}
                                    </button>
                                    <span className="ps-upload-hint">Need at least {MIN_LISTING_IMAGES}. Set one as primary and one as cover.</span>
                                </div>
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="ps-file-input"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) void handleListingImageUpload(file);
                                        e.target.value = '';
                                    }}
                                    disabled={!canAccessStudio || uploadingImage}
                                />
                                <div className="ps-gallery-add-row">
                                    <input
                                        className="ps-input"
                                        value={galleryInput}
                                        onChange={(e) => {
                                            setImgError(false);
                                            setGalleryInput(e.target.value);
                                        }}
                                        placeholder="Paste image URL and click Add"
                                        disabled={!canAccessStudio}
                                    />
                                    <button
                                        type="button"
                                        className="ps-upload-btn"
                                        disabled={!canAccessStudio || !galleryInput.trim()}
                                        onClick={() => addGalleryImage(galleryInput)}
                                    >
                                        Add URL
                                    </button>
                                </div>
                                {galleryError && <p className="ps-gallery-error">{galleryError}</p>}
                                <div className="ps-image-preview">
                                    {form.cover_image_url && !imgError ? (
                                        <img
                                            src={form.cover_image_url}
                                            alt="Cover preview"
                                            onError={() => setImgError(true)}
                                        />
                                    ) : (
                                        <div className="ps-image-placeholder">
                                            <Image size={26} />
                                            <span>{imgError ? 'Could not load image' : 'Cover preview will appear here'}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="ps-gallery-grid">
                                    {galleryImages.map((url) => (
                                        <div key={url} className="ps-gallery-card">
                                            <img src={url} alt="Listing gallery" />
                                            <div className="ps-gallery-meta">
                                                <span className={`ps-gallery-tag${form.image_url === url ? ' is-active' : ''}`}>
                                                    <Star size={11} /> Primary
                                                </span>
                                                <span className={`ps-gallery-tag${form.cover_image_url === url ? ' is-active' : ''}`}>
                                                    Cover
                                                </span>
                                            </div>
                                            <div className="ps-gallery-actions">
                                                <button type="button" onClick={() => setPrimaryImage(url)} disabled={!canAccessStudio}>
                                                    Set Primary
                                                </button>
                                                <button type="button" onClick={() => setCoverImage(url)} disabled={!canAccessStudio}>
                                                    Set Cover
                                                </button>
                                                <button type="button" onClick={() => removeGalleryImage(url)} disabled={!canAccessStudio}>
                                                    <Trash2 size={11} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="ps-two-up">
                                <label className="ps-field">
                                    <span className="ps-field-label"><DollarSign size={13} /> Price (Rs)</span>
                                    <input
                                        className="ps-input"
                                        type="number"
                                        min="1"
                                        value={typeof form.price === 'number' ? form.price : ''}
                                        onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) || null }))}
                                        placeholder="0"
                                        disabled={!canAccessStudio}
                                        required
                                    />
                                    <p className="ps-price-note">
                                        Tourist price shown in package cards: <strong>Rs {pricingPreview.tourist_unit_price.toLocaleString()}</strong> (includes {Math.round(PLATFORM_FEE_RATE * 100)}% platform fee).
                                        You will receive <strong>Rs {pricingPreview.provider_unit_price.toLocaleString()}</strong> per booking.
                                    </p>
                                </label>
                                <label className="ps-field">
                                    <span className="ps-field-label"><Clock size={13} /> Start Date</span>
                                    <input
                                        className="ps-input"
                                        type="date"
                                        value={form.starts_at || ''}
                                        onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                                        disabled={!canAccessStudio}
                                    />
                                </label>
                            </div>

                            <label className="ps-field">
                                <span className="ps-field-label">Description</span>
                                <textarea
                                    className="ps-textarea"
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                    placeholder="Describe the experience, what's included, meeting point..."
                                    disabled={!canAccessStudio}
                                    required
                                />
                            </label>

                            {!editingListingId && (
                                <div className="ps-consent-block">
                                    <div className="ps-consent-checks">
                                        <label className="ps-consent-check-row">
                                            <input
                                                type="checkbox"
                                                checked={acceptTerms}
                                                onChange={(event) => {
                                                    setAcceptTerms(event.target.checked);
                                                    setConsentError(null);
                                                }}
                                            />
                                            <span>I accept <Link to="/provider/terms#terms">terms and conditions</Link></span>
                                        </label>
                                        <label className="ps-consent-check-row">
                                            <input
                                                type="checkbox"
                                                checked={acceptAgreement}
                                                onChange={(event) => {
                                                    setAcceptAgreement(event.target.checked);
                                                    setConsentError(null);
                                                }}
                                            />
                                            <span>I accept <Link to="/provider/terms#agreement">the user agreement</Link></span>
                                        </label>
                                    </div>

                                    <div className="ps-consent-actions">
                                        <Link to="/provider/terms" className="ps-consent-link-btn">
                                            View agreement
                                        </Link>
                                    </div>

                                    {consentError && <p className="ps-gallery-error">{consentError}</p>}
                                </div>
                            )}

                            <button type="submit" className="ps-submit" disabled={!canAccessStudio || saving}>
                                {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                {editingListingId ? 'Update & Re-submit' : getPrimaryActionCopy(form.type)}
                            </button>
                        </form>
                    </article>

                    {/* ── Inventory Card ── */}
                    <article className="ps-card">
                        <div className="ps-card-head">
                            <div>
                                <span className="ps-card-label">
                                    <Sparkles size={11} />
                                    Posting History
                                </span>
                                <h2 className="ps-card-title">Your listings</h2>
                                <p className="ps-card-desc">
                                    {listings.length > 0
                                        ? `${listings.length} listing${listings.length === 1 ? '' : 's'} submitted`
                                        : 'No posts yet'}
                                </p>
                            </div>
                            <Link to={embedded ? '/dashboard/provider?section=overview' : '/dashboard'} className="ps-inventory-link">
                                View dashboard →
                            </Link>
                        </div>

                        {loading ? (
                            <div className="ps-loading">
                                <Loader2 className="animate-spin" size={28} />
                            </div>
                        ) : listings.length > 0 ? (
                            <div className="ps-listing-grid">
                                {listings.slice(0, 15).map((listing) => {
                                    const listingType = ((listing.type === 'event' ? 'guide' : listing.type) as ListingType) || form.type;
                                    const thumb = listing.image_url || listing.cover_image_url || listing.thumbnail_url;
                                    return (
                                        <div key={listing.id} className="ps-listing-card">
                                            <div className="ps-listing-thumb">
                                                {thumb ? (
                                                    <img src={thumb} alt={getListingTitle(listing)} />
                                                ) : (
                                                    TYPE_META[listingType]?.icon ?? <Sparkles size={20} />
                                                )}
                                            </div>
                                            <div className="ps-listing-body">
                                                <div className="ps-listing-top">
                                                    <span className="ps-listing-name">{getListingTitle(listing)}</span>
                                                    <button
                                                        type="button"
                                                        className="ps-edit-btn"
                                                        onClick={() => beginEdit(listing)}
                                                        disabled={!canAccessStudio}
                                                    >
                                                        <Edit3 size={12} /> Edit
                                                    </button>
                                                </div>
                                                <p className="ps-listing-loc">
                                                    <MapPin size={11} />
                                                    {listing.location || 'No location'}
                                                </p>
                                                <div className="ps-listing-footer">
                                                    <span className="ps-type-pill">{LISTING_LABELS[listingType] || 'Listing'}</span>
                                                    <span className={getStatusDotClass(listing.status)}>
                                                        {getListingStatusLabel(listing.status)}
                                                    </span>
                                                    {typeof listing.price === 'number' && (
                                                        <span className="ps-price">
                                                            You receive Rs {listing.price.toLocaleString()} · Tourist sees Rs {calculatePricingFromProviderUnit(listing.price, 1, PLATFORM_FEE_RATE).tourist_unit_price.toLocaleString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="ps-empty">
                                <Sparkles size={26} />
                                <strong>No listings yet</strong>
                                <p>
                                    Create your first {allowedTypes[0] ? LISTING_LABELS[allowedTypes[0]].toLowerCase() : 'listing'} and track pending, approved, live, or rejected states here.
                                </p>
                            </div>
                        )}
                    </article>
                </div>

                {submissionModal && (
                    <div className="ps-modal-backdrop" onClick={() => setSubmissionModal(null)}>
                        <section
                            className="ps-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="ps-submit-modal-title"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <div className="ps-modal-icon">
                                <CheckCircle2 size={24} />
                            </div>
                            <h3 id="ps-submit-modal-title" className="ps-modal-title">
                                {submissionModal.mode === 'updated' ? 'Listing re-submitted' : 'Listing submitted'}
                            </h3>
                            <p className="ps-modal-copy">
                                <strong>{submissionModal.listingTitle}</strong> was sent for admin review.
                                You can track status changes in your listing history and notifications.
                            </p>
                            <div className="ps-modal-meta">
                                <span>{LISTING_LABELS[submissionModal.listingType]} listing</span>
                                <span>{submissionModal.mode === 'updated' ? 'Awaiting re-approval' : 'Awaiting approval'}</span>
                            </div>
                            <div className="ps-modal-actions">
                                <button type="button" className="ps-modal-btn ps-modal-btn--ghost" onClick={() => setSubmissionModal(null)}>
                                    Continue editing
                                </button>
                                <Link
                                    to="/dashboard/provider?section=listings"
                                    className="ps-modal-btn ps-modal-btn--primary"
                                    onClick={() => setSubmissionModal(null)}
                                >
                                    View statuses
                                </Link>
                            </div>
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
};
