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
    Plus,
    ReceiptText,
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
import {
    createOrUpdateListing,
    getMyPosts,
    type ListingInput,
    type PostRecord,
} from '../lib/destinations';
import {
    PLATFORM_FEE_RATE,
    buildListingFeeBreakdownForStorage,
    calculatePricingFromFeeBreakdown,
    calculatePricingFromProviderUnit,
    type ListingFeeBreakdown,
    type ListingFeeBreakdownBasis,
    type ListingFeeBreakdownItem,
    type ListingFeeBreakdownStatus,
} from '../lib/pricing';
import { getPublicAppContent } from '../lib/appContent';
import { getProfileAvatarUrl } from '../lib/avatar';
import { uploadCloudinaryImage } from '../lib/cloudinaryUpload';
import { LISTING_LABELS, getRoleLabel, type ListingType, canRolePublish } from '../lib/platform';
import './provider-studio.css';

const MAX_LISTING_IMAGE_MB = 8;
const MIN_LISTING_IMAGES = 3;
const MAX_LISTING_IMAGES = 10;

const PRESET_FEE_ITEMS = [
    'Base package fee',
    'Transport',
    'Meals',
    'Accommodation',
    'Guide fee',
    'Entry tickets',
] as const;

const FEE_BASIS_OPTIONS: Array<{ value: ListingFeeBreakdownBasis; label: string }> = [
    { value: 'per_person', label: 'Per person' },
    { value: 'per_package', label: 'Per package' },
];

const FEE_STATUS_OPTIONS: Array<{ value: ListingFeeBreakdownStatus; label: string }> = [
    { value: 'included', label: 'Included' },
    { value: 'optional', label: 'Optional' },
    { value: 'pay_at_location', label: 'Pay at location' },
];

const createFeeItemId = () => (
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `fee-${Date.now()}-${Math.random().toString(36).slice(2)}`
);

const createFeeItem = (
    label: string,
    isCustom = false,
    amount = 0,
): ListingFeeBreakdownItem => ({
    id: createFeeItemId(),
    label,
    amount,
    basis: 'per_person',
    status: 'included',
    note: '',
    is_custom: isCustom,
});

const createDefaultFeeItems = () => PRESET_FEE_ITEMS.map((label) => createFeeItem(label));

const isFeeBasis = (value: unknown): value is ListingFeeBreakdownBasis => (
    value === 'per_person' || value === 'per_package'
);

const isFeeStatus = (value: unknown): value is ListingFeeBreakdownStatus => (
    value === 'included' || value === 'optional' || value === 'pay_at_location'
);

const normalizeDraftAmount = (value: unknown) => {
    const amount = typeof value === 'number' ? value : Number(value || 0);
    return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : 0;
};

const normalizeFeeDraftItems = (
    value: unknown,
    fallbackPrice?: number | null,
): ListingFeeBreakdownItem[] => {
    const row = value && typeof value === 'object' ? value as Record<string, unknown> : null;
    const rawItems = row && Array.isArray(row.items) ? row.items : [];
    const items = rawItems
        .map((item): ListingFeeBreakdownItem | null => {
            if (!item || typeof item !== 'object') return null;
            const raw = item as Record<string, unknown>;
            const label = typeof raw.label === 'string' ? raw.label.trim() : '';
            const amount = normalizeDraftAmount(raw.amount);
            if (!label && amount <= 0) return null;
            return {
                id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createFeeItemId(),
                label,
                amount,
                basis: isFeeBasis(raw.basis) ? raw.basis : 'per_person',
                status: isFeeStatus(raw.status) ? raw.status : 'included',
                note: typeof raw.note === 'string' ? raw.note : '',
                is_custom: raw.is_custom === true,
            };
        })
        .filter((item): item is ListingFeeBreakdownItem => Boolean(item));

    if (items.length) return items;

    const fallbackAmount = normalizeDraftAmount(fallbackPrice);
    if (fallbackAmount > 0) {
        const [base, ...rest] = createDefaultFeeItems();
        return [{ ...base, amount: fallbackAmount }, ...rest];
    }

    return createDefaultFeeItems();
};

const buildDraftFeeBreakdown = (
    items: ListingFeeBreakdownItem[],
    platformFeeRate: number,
): ListingFeeBreakdown => {
    const draft: ListingFeeBreakdown = {
        version: 1,
        currency: 'INR',
        items,
    };
    const pricing = calculatePricingFromFeeBreakdown(draft, 1, platformFeeRate);

    return {
        ...draft,
        provider_total: pricing.provider_subtotal,
        platform_fee_rate: pricing.platform_fee_rate,
        platform_fee_amount: pricing.platform_fee_amount,
        tourist_total: pricing.total_price,
    };
};

const getDraftFeeItems = (breakdown?: ListingFeeBreakdown | null) => (
    breakdown?.items?.length ? breakdown.items : createDefaultFeeItems()
);

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
    fee_breakdown: buildDraftFeeBreakdown(createDefaultFeeItems(), PLATFORM_FEE_RATE),
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
                fee_breakdown: buildDraftFeeBreakdown(
                    normalizeFeeDraftItems(rawForm.fee_breakdown, typeof rawForm.price === 'number' ? rawForm.price : Number(rawForm.price || 0) || null),
                    PLATFORM_FEE_RATE,
                ),
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
    const [platformFeeRate, setPlatformFeeRate] = useState(PLATFORM_FEE_RATE);
    const [imgError, setImgError] = useState(false);
    const [galleryInput, setGalleryInput] = useState('');
    const [galleryError, setGalleryError] = useState<string | null>(null);
    const [feeBreakdownError, setFeeBreakdownError] = useState<string | null>(null);
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
        setFeeBreakdownError(null);
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
        setFeeBreakdownError(null);
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
        setFeeBreakdownError(null);
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
            fee_breakdown: buildDraftFeeBreakdown(
                normalizeFeeDraftItems(listing.fee_breakdown, typeof listing.price === 'number' ? listing.price : null),
                platformFeeRate,
            ),
            starts_at: listing.starts_at || '',
            status: (listing.status as ListingInput['status']) || 'pending',
        });
    }, [allowedTypes, currentUserId, platformFeeRate]);

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

    useEffect(() => {
        let cancelled = false;
        void getPublicAppContent()
            .then((content) => {
                if (!cancelled) setPlatformFeeRate(content.salesSettings.platformFeeRate);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const galleryImages = useMemo(
        () => normalizeImageList(form.gallery_images || []),
        [form.gallery_images]
    );
    const feeItems = useMemo(
        () => getDraftFeeItems(form.fee_breakdown),
        [form.fee_breakdown]
    );
    const feeBreakdownDraft = useMemo(
        () => buildDraftFeeBreakdown(feeItems, platformFeeRate),
        [feeItems, platformFeeRate]
    );
    const pricingPreview = useMemo(
        () => calculatePricingFromFeeBreakdown(feeBreakdownDraft, 1, platformFeeRate),
        [feeBreakdownDraft, platformFeeRate]
    );

    const updateFeeItems = useCallback((updater: (items: ListingFeeBreakdownItem[]) => ListingFeeBreakdownItem[]) => {
        setForm((current) => {
            const currentItems = getDraftFeeItems(current.fee_breakdown);
            const nextItems = updater(currentItems);
            const nextBreakdown = buildDraftFeeBreakdown(nextItems, platformFeeRate);
            const nextPricing = calculatePricingFromFeeBreakdown(nextBreakdown, 1, platformFeeRate);
            return {
                ...current,
                fee_breakdown: nextBreakdown,
                price: nextPricing.provider_subtotal > 0 ? nextPricing.provider_subtotal : null,
            };
        });
        setFeeBreakdownError(null);
    }, [platformFeeRate]);

    const updateFeeItem = useCallback((
        itemId: string,
        patch: Partial<ListingFeeBreakdownItem>,
    ) => {
        updateFeeItems((items) => items.map((item) => (
            item.id === itemId ? { ...item, ...patch } : item
        )));
    }, [updateFeeItems]);

    const addCustomFeeItem = useCallback(() => {
        updateFeeItems((items) => [...items, createFeeItem('', true)]);
    }, [updateFeeItems]);

    const removeCustomFeeItem = useCallback((itemId: string) => {
        updateFeeItems((items) => {
            const nextItems = items.filter((item) => item.id !== itemId || !item.is_custom);
            return nextItems.length ? nextItems : createDefaultFeeItems();
        });
    }, [updateFeeItems]);

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
        const currentImages = normalizeImageList(form.gallery_images || []);
        if (!currentImages.includes(normalized) && currentImages.length >= MAX_LISTING_IMAGES) {
            setGalleryError(`Add up to ${MAX_LISTING_IMAGES} images only.`);
            return;
        }
        applyGallery([...currentImages, normalized]);
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
        if (normalizedGallery.length > MAX_LISTING_IMAGES) {
            setGalleryError(`Add up to ${MAX_LISTING_IMAGES} images only.`);
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
        const feeLineMissingLabel = feeItems.find((item) => item.amount > 0 && !item.label.trim());
        if (feeLineMissingLabel) {
            setFeeBreakdownError('Add a label for every fee item with an amount.');
            return;
        }
        const submissionFeeBreakdown = buildListingFeeBreakdownForStorage(feeBreakdownDraft, platformFeeRate);
        if (!submissionFeeBreakdown) {
            setFeeBreakdownError('Add at least one included fee item before posting.');
            return;
        }
        const submissionPricing = calculatePricingFromFeeBreakdown(submissionFeeBreakdown, 1, platformFeeRate);
        setConsentError(null);
        setGalleryError(null);
        setFeeBreakdownError(null);
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
                fee_breakdown: submissionFeeBreakdown,
                status: 'pending',
                rejection_reason: null,
                price: submissionPricing.provider_subtotal,
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

        const safeType = form.type || 'tour';
        return uploadCloudinaryImage(file, {
            folder: `${user.id}/listings`,
            fileNamePrefix: `listing-${safeType}`,
            tags: ['tbp', 'listing', safeType],
        });
    };

    const handleListingImageUpload = async (files: File[]) => {
        if (!canAccessStudio || !user) return;
        const currentImages = normalizeImageList(form.gallery_images || []);
        const remainingSlots = MAX_LISTING_IMAGES - currentImages.length;
        if (remainingSlots <= 0) {
            setGalleryError(`Add up to ${MAX_LISTING_IMAGES} images only.`);
            return;
        }
        const selectedFiles = files.filter(Boolean);
        if (selectedFiles.length === 0) return;
        if (selectedFiles.length > remainingSlots) {
            setGalleryError(`You can add ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} only.`);
            return;
        }

        const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/'));
        if (invalidFile) {
            alert('Please select image files only.');
            return;
        }

        const oversizedFile = selectedFiles.find((file) => file.size > MAX_LISTING_IMAGE_MB * 1024 * 1024);
        if (oversizedFile) {
            alert(`${oversizedFile.name} is too large. Max allowed size is ${MAX_LISTING_IMAGE_MB}MB.`);
            return;
        }

        setUploadingImage(true);
        try {
            const uploadedUrls: string[] = [];
            for (const file of selectedFiles) {
                const uploadedUrl = await uploadListingImage(file);
                uploadedUrls.push(uploadedUrl);
            }
            setImgError(false);
            applyGallery([...currentImages, ...uploadedUrls]);
            setGalleryError(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error || '');
            console.error('Failed to upload listing image:', error);
            if (message.toLowerCase().includes('cloudinary is not configured')) {
                alert(message);
            } else if (message.toLowerCase().includes('upload preset')) {
                alert(`${message} Make sure the Cloudinary preset is unsigned and allows image uploads.`);
            } else {
                alert(message || 'Failed to upload image. Please try again.');
            }
        } finally {
            setUploadingImage(false);
        }
    };

    const avatarSrc = getProfileAvatarUrl(profile?.profile_image_url, user.id, profile?.full_name, user.email);

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
                    <img className="ps-status-bar-avatar" src={avatarSrc} alt={profile?.full_name || user.email || 'Provider'} />
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
                                <span className="ps-field-label"><Image size={13} /> Listing Images ({galleryImages.length}/{MAX_LISTING_IMAGES})</span>
                                <div className="ps-image-upload-row">
                                    <button
                                        type="button"
                                        className="ps-upload-btn"
                                        disabled={!canAccessStudio || uploadingImage || galleryImages.length >= MAX_LISTING_IMAGES}
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
                                    <span className="ps-upload-hint">Add {MIN_LISTING_IMAGES} to {MAX_LISTING_IMAGES} images. Set one as primary and one as cover.</span>
                                </div>
                                <input
                                    ref={imageInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="ps-file-input"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        if (files.length > 0) void handleListingImageUpload(files);
                                        e.target.value = '';
                                    }}
                                    disabled={!canAccessStudio || uploadingImage || galleryImages.length >= MAX_LISTING_IMAGES}
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
                                        disabled={!canAccessStudio || galleryImages.length >= MAX_LISTING_IMAGES}
                                    />
                                    <button
                                        type="button"
                                        className="ps-upload-btn"
                                        disabled={!canAccessStudio || !galleryInput.trim() || galleryImages.length >= MAX_LISTING_IMAGES}
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

                            <div className="ps-fee-section">
                                <div className="ps-fee-section-head">
                                    <div>
                                        <span className="ps-field-label"><ReceiptText size={13} /> Fee breakdown</span>
                                    </div>
                                    <button
                                        type="button"
                                        className="ps-upload-btn"
                                        onClick={addCustomFeeItem}
                                        disabled={!canAccessStudio}
                                    >
                                        <Plus size={14} />
                                        Add custom
                                    </button>
                                </div>

                                <div className="ps-fee-grid">
                                    {feeItems.map((item) => (
                                        <div key={item.id} className="ps-fee-row">
                                            <input
                                                className="ps-input ps-fee-name"
                                                value={item.label}
                                                onChange={(event) => updateFeeItem(item.id, { label: event.target.value })}
                                                readOnly={!item.is_custom}
                                                placeholder="Custom fee"
                                                disabled={!canAccessStudio}
                                            />
                                            <input
                                                className="ps-input"
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={item.amount > 0 ? item.amount : ''}
                                                onChange={(event) => updateFeeItem(item.id, { amount: normalizeDraftAmount(event.target.value) })}
                                                placeholder="Rs"
                                                disabled={!canAccessStudio}
                                            />
                                            <select
                                                className="ps-select"
                                                value={item.basis}
                                                onChange={(event) => updateFeeItem(item.id, { basis: event.target.value as ListingFeeBreakdownBasis })}
                                                disabled={!canAccessStudio}
                                            >
                                                {FEE_BASIS_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                className="ps-select"
                                                value={item.status}
                                                onChange={(event) => updateFeeItem(item.id, { status: event.target.value as ListingFeeBreakdownStatus })}
                                                disabled={!canAccessStudio}
                                            >
                                                {FEE_STATUS_OPTIONS.map((option) => (
                                                    <option key={option.value} value={option.value}>{option.label}</option>
                                                ))}
                                            </select>
                                            <input
                                                className="ps-input ps-fee-note"
                                                value={item.note || ''}
                                                onChange={(event) => updateFeeItem(item.id, { note: event.target.value })}
                                                placeholder="Note"
                                                disabled={!canAccessStudio}
                                            />
                                            <button
                                                type="button"
                                                className="ps-fee-remove-btn"
                                                onClick={() => removeCustomFeeItem(item.id)}
                                                disabled={!canAccessStudio || !item.is_custom}
                                                aria-label="Remove custom fee item"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {feeBreakdownError && <p className="ps-gallery-error">{feeBreakdownError}</p>}

                                <div className="ps-fee-preview">
                                    <div>
                                        <span>Vendor package fee</span>
                                        <strong>Rs {pricingPreview.provider_subtotal.toLocaleString()}</strong>
                                    </div>
                                    <div>
                                        <span>Platform fee ({Math.round(platformFeeRate * 100)}%)</span>
                                        <strong>Rs {pricingPreview.platform_fee_amount.toLocaleString()}</strong>
                                    </div>
                                    <div>
                                        <span>Tourist total shown</span>
                                        <strong>Rs {pricingPreview.total_price.toLocaleString()}</strong>
                                    </div>
                                    {pricingPreview.optional_total > 0 && (
                                        <div>
                                            <span>Optional items</span>
                                            <strong>Rs {pricingPreview.optional_total.toLocaleString()}</strong>
                                        </div>
                                    )}
                                    {pricingPreview.pay_at_location_total > 0 && (
                                        <div>
                                            <span>Pay at location</span>
                                            <strong>Rs {pricingPreview.pay_at_location_total.toLocaleString()}</strong>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="ps-two-up">
                                <label className="ps-field">
                                    <span className="ps-field-label"><DollarSign size={13} /> Vendor package fee (Rs)</span>
                                    <input
                                        className="ps-input"
                                        type="number"
                                        min="1"
                                        value={pricingPreview.provider_subtotal > 0 ? pricingPreview.provider_subtotal : ''}
                                        placeholder="0"
                                        readOnly
                                    />
                                    <p className="ps-price-note">
                                        Package cards show <strong>Rs {pricingPreview.total_price.toLocaleString()}</strong> including platform fee.
                                        You receive <strong>Rs {pricingPreview.provider_subtotal.toLocaleString()}</strong> for one traveler/package selection.
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
                                                            You receive Rs {listing.price.toLocaleString()} · Tourist sees Rs {calculatePricingFromProviderUnit(listing.price, 1, platformFeeRate).tourist_unit_price.toLocaleString()}
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
