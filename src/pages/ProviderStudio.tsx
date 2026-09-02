import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Calendar,
    Camera,
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
    RadioTower,
    ShieldAlert,
    Sparkles,
    Star,
    Tag,
    Trash2,
    Type,
    Upload,
    Users,
    Video,
    Wifi,
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
import { uploadCloudinaryImage, uploadCloudinaryVideo } from '../lib/cloudinaryUpload';
import {
    LISTING_LABELS,
    ROLE_SIGNUP_CONFIG,
    canRolePublish,
    getRoleLabel,
    resolveEffectiveAccountRole,
    type ListingType,
    type UserRole,
} from '../lib/platform';
import {
    CAMERA_TYPE_LABELS,
    DEFAULT_VIRTUAL_TOUR_DETAILS,
    LOCAL_GUIDE_VIRTUAL_SUBCATEGORY,
    VIRTUAL_TOURS_ENABLED,
    buildVirtualTourDescription,
    joinLines,
    normalizeVirtualTourDetails,
    splitLines,
    type VirtualTourCameraType,
    type VirtualTourDetails,
} from '../lib/virtualTours';
import './provider-studio.css';

const MAX_LISTING_IMAGE_MB = 8;
const MIN_LISTING_IMAGES = 3;
const MAX_LISTING_IMAGES = 10;

const PRESET_FEE_ITEMS = [
    'Base fee',
    'Transport',
    'Meals',
    'Accommodation',
    'Guide fee',
    'Entry tickets',
] as const;

const FEE_BASIS_OPTIONS: Array<{ value: ListingFeeBreakdownBasis; label: string }> = [
    { value: 'per_person', label: 'Per person' },
    { value: 'per_package', label: 'Per booking' },
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

const resolveStudioRole = (
    profileRole?: string | null,
    authMetadataRole?: string | null,
): UserRole | null => {
    const resolvedRole = resolveEffectiveAccountRole(profileRole, authMetadataRole);
    return resolvedRole && resolvedRole in ROLE_SIGNUP_CONFIG ? resolvedRole as UserRole : null;
};

const getDefaultListingForm = (type: ListingType, role?: string | null): ListingInput => ({
    ...EMPTY_FORM(type),
    sub_category: role === 'local_guide' && type === 'guide'
        ? LOCAL_GUIDE_VIRTUAL_SUBCATEGORY
        : '',
});

const PROVIDER_STUDIO_DRAFT_STORAGE_PREFIX = 'tbp:provider-studio-draft:v1:';

type ProviderStudioDraft = {
    form: ListingInput;
    virtualDetails?: VirtualTourDetails;
    proofPhotoInput?: string;
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
            virtualDetails: normalizeVirtualTourDetails(parsed.virtualDetails),
            proofPhotoInput: typeof parsed.proofPhotoInput === 'string' ? parsed.proofPhotoInput : '',
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

const getListingCopy = (type: ListingType, role?: string | null) => (
    role === 'local_guide' && type === 'guide' ? 'Live AR/VR Tours' : LISTING_LABELS[type]
);

const getListingSingularCopy = (type: ListingType, role?: string | null) => (
    role === 'local_guide' && type === 'guide'
        ? 'Live AR/VR Tour'
        : type === 'tour'
            ? 'Tour'
            : type === 'activity'
                ? 'Activity'
                : 'Event'
);

const getSubmitCopy = (type: ListingType, role?: string | null) => (
    role === 'local_guide' && type === 'guide' ? 'Submit Live AR/VR Tour' : getPrimaryActionCopy(type)
);

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
    const [uploadingProofPhoto, setUploadingProofPhoto] = useState(false);
    const [uploadingProofVideo, setUploadingProofVideo] = useState(false);
    const [editingListingId, setEditingListingId] = useState<string | null>(null);
    const [form, setForm] = useState<ListingInput>(EMPTY_FORM('tour'));
    const [virtualDetails, setVirtualDetails] = useState<VirtualTourDetails>(DEFAULT_VIRTUAL_TOUR_DETAILS);
    const [platformFeeRate, setPlatformFeeRate] = useState(PLATFORM_FEE_RATE);
    const [imgError, setImgError] = useState(false);
    const [galleryInput, setGalleryInput] = useState('');
    const [proofPhotoInput, setProofPhotoInput] = useState('');
    const [galleryError, setGalleryError] = useState<string | null>(null);
    const [virtualDetailsError, setVirtualDetailsError] = useState<string | null>(null);
    const [feeBreakdownError, setFeeBreakdownError] = useState<string | null>(null);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptAgreement, setAcceptAgreement] = useState(false);
    const [consentError, setConsentError] = useState<string | null>(null);
    const [submissionModal, setSubmissionModal] = useState<SubmissionModalState | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const proofPhotoInputRef = useRef<HTMLInputElement>(null);
    const proofVideoInputRef = useRef<HTMLInputElement>(null);
    const draftRestoredRef = useRef(false);

    const currentUserId = user?.id || null;
    const metadataRole = typeof user?.user_metadata?.role === 'string' ? user.user_metadata.role : null;
    const studioRole = useMemo(
        () => resolveStudioRole(profile?.role, metadataRole),
        [metadataRole, profile?.role],
    );
    const allowedTypes = useMemo(
        () => (['tour', 'activity', 'guide'] as ListingType[]).filter((type) => canRolePublish(studioRole, type)),
        [studioRole]
    );
    const localGuideStudio = studioRole === 'local_guide';
    const canAccessStudio = isProvider && allowedTypes.length > 0 && (VIRTUAL_TOURS_ENABLED || !localGuideStudio);

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
                    sub_category: studioRole === 'local_guide'
                        && (allowedTypes.includes(current.type) ? current.type : allowedTypes[0]) === 'guide'
                        && !current.sub_category
                            ? LOCAL_GUIDE_VIRTUAL_SUBCATEGORY
                            : current.sub_category,
                }));
            }
        } finally {
            setLoading(false);
        }
    }, [allowedTypes, currentUserId, studioRole]);

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
        setVirtualDetails(draft.virtualDetails || DEFAULT_VIRTUAL_TOUR_DETAILS);
        setGalleryInput(draft.galleryInput);
        setProofPhotoInput(draft.proofPhotoInput || '');
        setAcceptTerms(draft.acceptTerms);
        setAcceptAgreement(draft.acceptAgreement);
    }, [allowedTypes, currentUserId]);

    useEffect(() => {
        if (!currentUserId || !draftRestoredRef.current || editingListingId) return;
        writeProviderStudioDraft(currentUserId, {
            form,
            virtualDetails,
            proofPhotoInput,
            galleryInput,
            acceptTerms,
            acceptAgreement,
        });
    }, [acceptAgreement, acceptTerms, currentUserId, editingListingId, form, galleryInput, proofPhotoInput, virtualDetails]);

    const resetForm = () => {
        setEditingListingId(null);
        setImgError(false);
        setGalleryInput('');
        setProofPhotoInput('');
        setGalleryError(null);
        setVirtualDetailsError(null);
        setFeeBreakdownError(null);
        setAcceptTerms(false);
        setAcceptAgreement(false);
        setConsentError(null);
        setVirtualDetails(DEFAULT_VIRTUAL_TOUR_DETAILS);
        setForm(getDefaultListingForm(allowedTypes[0] || 'tour', studioRole));
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
        setProofPhotoInput('');
        setGalleryError(null);
        setVirtualDetailsError(null);
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
            sub_category: localGuideStudio && listingType === 'guide' && !listing.sub_category
                ? LOCAL_GUIDE_VIRTUAL_SUBCATEGORY
                : listing.sub_category || '',
            price: typeof listing.price === 'number' ? listing.price : null,
            fee_breakdown: buildDraftFeeBreakdown(
                normalizeFeeDraftItems(listing.fee_breakdown, typeof listing.price === 'number' ? listing.price : null),
                platformFeeRate,
            ),
            starts_at: listing.starts_at || '',
            status: (listing.status as ListingInput['status']) || 'pending',
        });
        setVirtualDetails(normalizeVirtualTourDetails(listing.virtual_tour_details));
    }, [allowedTypes, currentUserId, localGuideStudio, platformFeeRate]);

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

    const updateVirtualDetails = useCallback((patch: Partial<VirtualTourDetails>) => {
        setVirtualDetails((current) => normalizeVirtualTourDetails({ ...current, ...patch }));
        setVirtualDetailsError(null);
    }, []);

    const addProofPhotoUrl = useCallback((url: string) => {
        const normalized = url.trim();
        if (!normalized) return;
        updateVirtualDetails({
            verification_photo_urls: normalizeImageList([
                ...virtualDetails.verification_photo_urls,
                normalized,
            ]),
        });
        setProofPhotoInput('');
    }, [updateVirtualDetails, virtualDetails.verification_photo_urls]);

    const removeProofPhotoUrl = useCallback((url: string) => {
        updateVirtualDetails({
            verification_photo_urls: virtualDetails.verification_photo_urls.filter((item) => item !== url),
        });
    }, [updateVirtualDetails, virtualDetails.verification_photo_urls]);

    if (!user || !isProvider) {
        if (embedded) return null;
        return <Navigate to="/dashboard" replace />;
    }

    if (localGuideStudio && !VIRTUAL_TOURS_ENABLED) {
        if (embedded) return null;
        return <Navigate to="/dashboard/provider" replace />;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canAccessStudio || uploadingImage || uploadingProofPhoto || uploadingProofVideo) return;
        const wasEditing = Boolean(editingListingId);
        const submittedType = form.type;
        const submittedTitle = form.title.trim() || `Untitled ${getListingSingularCopy(form.type, studioRole)}`;
        const submittedSubcategory = studioRole === 'local_guide'
            && form.type === 'guide'
            && !String(form.sub_category || '').trim()
                ? LOCAL_GUIDE_VIRTUAL_SUBCATEGORY
                : form.sub_category;
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
        const submittedVirtualDetails = normalizeVirtualTourDetails(virtualDetails);
        if (localGuideStudio) {
            if (!form.location.trim() || !submittedVirtualDetails.spot_location.trim()) {
                setVirtualDetailsError('Add the live-tour spot and listing location.');
                return;
            }
            if (submittedVirtualDetails.places_shown.length === 0) {
                setVirtualDetailsError('Add at least one place the guide will show live.');
                return;
            }
            if (submittedVirtualDetails.available_windows.length === 0) {
                setVirtualDetailsError('Add at least one available timing window.');
                return;
            }
            if (submittedVirtualDetails.included_items.length === 0) {
                setVirtualDetailsError('Add what is included in the live virtual slot.');
                return;
            }
            if (!submittedVirtualDetails.camera_notes.trim() || !submittedVirtualDetails.network_plan.trim()) {
                setVirtualDetailsError('Add camera setup and network backup details.');
                return;
            }
            if (submittedVirtualDetails.verification_photo_urls.length === 0 || !submittedVirtualDetails.verification_video_url.trim()) {
                setVirtualDetailsError('Upload camera/location proof photos and one short live proof video for admin review.');
                return;
            }
        }
        const submissionPricing = calculatePricingFromFeeBreakdown(submissionFeeBreakdown, 1, platformFeeRate);
        setConsentError(null);
        setGalleryError(null);
        setFeeBreakdownError(null);
        setVirtualDetailsError(null);
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
                sub_category: submittedSubcategory,
                fee_breakdown: submissionFeeBreakdown,
                is_virtual_tour: localGuideStudio,
                virtual_tour_details: localGuideStudio ? submittedVirtualDetails : null,
                delivery_mode: localGuideStudio ? 'virtual_live' : null,
                experience_mode: localGuideStudio ? 'virtual' : null,
                status: 'pending',
                rejection_reason: null,
                price: submissionPricing.provider_subtotal,
                starts_at: form.starts_at || null,
                description: localGuideStudio
                    ? buildVirtualTourDescription(form.description, submittedVirtualDetails)
                    : form.description,
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

    const uploadProofPhoto = async (file: File): Promise<string> => {
        if (!user) throw new Error('You must be logged in to upload proof photos.');
        return uploadCloudinaryImage(file, {
            folder: `${user.id}/virtual-tour-proof`,
            fileNamePrefix: 'proof-photo',
            tags: ['tbp', 'virtual-tour', 'proof-photo'],
        });
    };

    const uploadProofVideo = async (file: File): Promise<string> => {
        if (!user) throw new Error('You must be logged in to upload a proof video.');
        return uploadCloudinaryVideo(file, {
            folder: `${user.id}/virtual-tour-proof`,
            fileNamePrefix: 'proof-video',
            tags: ['tbp', 'virtual-tour', 'proof-video'],
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

    const handleProofPhotoUpload = async (files: File[]) => {
        if (!canAccessStudio || !user || files.length === 0) return;
        const selectedFiles = files.filter(Boolean).slice(0, 6);
        const invalidFile = selectedFiles.find((file) => !file.type.startsWith('image/'));
        if (invalidFile) {
            setVirtualDetailsError('Proof photos must be image files.');
            return;
        }
        setUploadingProofPhoto(true);
        setVirtualDetailsError(null);
        try {
            const uploadedUrls: string[] = [];
            for (const file of selectedFiles) {
                uploadedUrls.push(await uploadProofPhoto(file));
            }
            updateVirtualDetails({
                verification_photo_urls: normalizeImageList([
                    ...virtualDetails.verification_photo_urls,
                    ...uploadedUrls,
                ]),
            });
        } catch (error) {
            setVirtualDetailsError(error instanceof Error ? error.message : 'Proof photo upload failed.');
        } finally {
            setUploadingProofPhoto(false);
        }
    };

    const handleProofVideoUpload = async (file: File) => {
        if (!canAccessStudio || !user) return;
        if (!file.type.startsWith('video/')) {
            setVirtualDetailsError('Proof video must be a video file.');
            return;
        }
        setUploadingProofVideo(true);
        setVirtualDetailsError(null);
        try {
            const uploadedUrl = await uploadProofVideo(file);
            updateVirtualDetails({ verification_video_url: uploadedUrl });
        } catch (error) {
            setVirtualDetailsError(error instanceof Error ? error.message : 'Proof video upload failed.');
        } finally {
            setUploadingProofVideo(false);
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
                        {localGuideStudio ? 'Live AR/VR Tours' : 'Provider Studio'}
                    </span>
                    <h1 className="ps-title">{localGuideStudio ? 'Create Live AR/VR Tour' : 'Your Posting Studio'}</h1>
                    <p className="ps-subtitle">
                        {localGuideStudio
                            ? 'List paid live virtual sessions from real locations, then accept bookings and go live from the guide console.'
                            : 'Submit tours, activities, and events for admin review, then track each post until it goes live.'}
                    </p>
                </div>

                {/* Account Status Bar */}
                <div className="ps-status-bar">
                    <img className="ps-status-bar-avatar" src={avatarSrc} alt={profile?.full_name || user.email || 'Provider'} />
                    <div>
                        <p className="ps-status-bar-name">{profile?.full_name || user.email}</p>
                        <p className="ps-status-bar-role">{getRoleLabel(studioRole || profile?.role)} account</p>
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
                            <strong>{localGuideStudio ? 'Live tour publishing is paused' : 'Provider publishing is not available for this role'}</strong>
                            <p>{localGuideStudio ? 'Virtual tours are reserved for version 2.' : 'Your current role cannot create tours, activities, or events.'}</p>
                        </div>
                    </div>
                )}

                {/* Quick-start capability chips */}
                {allowedTypes.length > 0 && !localGuideStudio && (
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
                                    setForm(getDefaultListingForm(type, studioRole));
                                }}
                            >
                                {TYPE_META[type].icon}
                                New {getListingCopy(type, studioRole)}
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
                                    {editingListingId ? 'Editing' : localGuideStudio ? 'Create Live Tour' : 'Create Listing'}
                                </span>
                                <h2 className="ps-card-title">
                                    {editingListingId ? 'Update listing for review' : getSubmitCopy(form.type, studioRole)}
                                </h2>
                                <p className="ps-card-desc">
                                    {localGuideStudio
                                        ? 'Live AR/VR tour listings are sent to admin moderation before tourists can book slots.'
                                        : 'New and edited listings are sent to admin moderation before they go live.'}
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
                                        onClick={() => setForm((f) => ({
                                            ...f,
                                            type,
                                            sub_category: studioRole === 'local_guide' && type === 'guide' && !f.sub_category
                                                ? LOCAL_GUIDE_VIRTUAL_SUBCATEGORY
                                                : f.sub_category,
                                        }))}
                                    >
                                        {TYPE_META[type].icon}
                                        <span>{getListingCopy(type, studioRole)}</span>
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
                                    <span className="ps-field-label"><Tag size={13} /> {localGuideStudio ? 'Tour Format' : 'Subcategory'}</span>
                                    <input
                                        className="ps-input"
                                        value={form.sub_category || ''}
                                        onChange={(e) => setForm((f) => ({ ...f, sub_category: e.target.value }))}
                                        placeholder={studioRole === 'local_guide' ? LOCAL_GUIDE_VIRTUAL_SUBCATEGORY : 'e.g. Hiking, Cooking class'}
                                        disabled={!canAccessStudio}
                                    />
                                </label>
                            </div>

                            {localGuideStudio && (
                                <section className="ps-live-details" aria-label="Live virtual tour details">
                                    <div className="ps-live-details-head">
                                        <span className="ps-field-label"><RadioTower size={13} /> Live tour details</span>
                                        <span>{virtualDetails.duration_minutes} min</span>
                                    </div>

                                    <div className="ps-two-up">
                                        <label className="ps-field">
                                            <span className="ps-field-label"><MapPin size={13} /> Live spot</span>
                                            <input
                                                className="ps-input"
                                                value={virtualDetails.spot_location}
                                                onChange={(event) => updateVirtualDetails({ spot_location: event.target.value })}
                                                placeholder="Exact area where the live tour happens"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Clock size={13} /> Duration minutes</span>
                                            <input
                                                className="ps-input"
                                                type="number"
                                                min="15"
                                                step="5"
                                                value={virtualDetails.duration_minutes}
                                                onChange={(event) => updateVirtualDetails({ duration_minutes: Number(event.target.value) })}
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                    </div>

                                    <div className="ps-two-up">
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Calendar size={13} /> Timing windows</span>
                                            <textarea
                                                className="ps-textarea ps-textarea--compact"
                                                value={joinLines(virtualDetails.available_windows)}
                                                onChange={(event) => updateVirtualDetails({ available_windows: splitLines(event.target.value) })}
                                                placeholder="Mon-Fri 8 AM-10 AM&#10;Saturday golden hour"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Compass size={13} /> Places shown</span>
                                            <textarea
                                                className="ps-textarea ps-textarea--compact"
                                                value={joinLines(virtualDetails.places_shown)}
                                                onChange={(event) => updateVirtualDetails({ places_shown: splitLines(event.target.value) })}
                                                placeholder="Main gate&#10;Viewpoint&#10;Local market lane"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                    </div>

                                    <div className="ps-two-up">
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Type size={13} /> Included</span>
                                            <textarea
                                                className="ps-textarea ps-textarea--compact"
                                                value={joinLines(virtualDetails.included_items)}
                                                onChange={(event) => updateVirtualDetails({ included_items: splitLines(event.target.value) })}
                                                placeholder="Live narration&#10;Q&A&#10;Photo stops"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Type size={13} /> Not included</span>
                                            <textarea
                                                className="ps-textarea ps-textarea--compact"
                                                value={joinLines(virtualDetails.excluded_items)}
                                                onChange={(event) => updateVirtualDetails({ excluded_items: splitLines(event.target.value) })}
                                                placeholder="Physical entry ticket&#10;Recorded copy"
                                                disabled={!canAccessStudio}
                                            />
                                        </label>
                                    </div>

                                    <div className="ps-two-up">
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Type size={13} /> Languages</span>
                                            <input
                                                className="ps-input"
                                                value={virtualDetails.languages.join(', ')}
                                                onChange={(event) => updateVirtualDetails({ languages: splitLines(event.target.value) })}
                                                placeholder="English, Hindi, Bengali"
                                                disabled={!canAccessStudio}
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Camera size={13} /> Camera type</span>
                                            <select
                                                className="ps-select"
                                                value={virtualDetails.camera_type}
                                                onChange={(event) => updateVirtualDetails({ camera_type: event.target.value as VirtualTourCameraType })}
                                                disabled={!canAccessStudio}
                                            >
                                                {(Object.entries(CAMERA_TYPE_LABELS) as Array<[VirtualTourCameraType, string]>).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </label>
                                    </div>

                                    <div className="ps-two-up">
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Camera size={13} /> Camera setup</span>
                                            <textarea
                                                className="ps-textarea ps-textarea--compact"
                                                value={virtualDetails.camera_notes}
                                                onChange={(event) => updateVirtualDetails({ camera_notes: event.target.value })}
                                                placeholder="Phone/360 camera, stabilizer, audio mic, backup device"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Wifi size={13} /> Network backup</span>
                                            <textarea
                                                className="ps-textarea ps-textarea--compact"
                                                value={virtualDetails.network_plan}
                                                onChange={(event) => updateVirtualDetails({ network_plan: event.target.value })}
                                                placeholder="Primary 5G SIM, backup hotspot, route signal notes"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                    </div>

                                    <div className="ps-two-up">
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Users size={13} /> Max guests</span>
                                            <input
                                                className="ps-input"
                                                type="number"
                                                min="1"
                                                max="25"
                                                value={virtualDetails.max_guests}
                                                onChange={(event) => updateVirtualDetails({ max_guests: Number(event.target.value) })}
                                                disabled={!canAccessStudio}
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Type size={13} /> Tourist requirements</span>
                                            <input
                                                className="ps-input"
                                                value={virtualDetails.tourist_requirements}
                                                onChange={(event) => updateVirtualDetails({ tourist_requirements: event.target.value })}
                                                placeholder="Stable internet, headphones, browser camera optional"
                                                disabled={!canAccessStudio}
                                            />
                                        </label>
                                    </div>

                                    <div className="ps-proof-block">
                                        <div className="ps-live-details-head">
                                            <span className="ps-field-label"><ShieldAlert size={13} /> Admin proof</span>
                                            <span>{virtualDetails.verification_photo_urls.length} photos</span>
                                        </div>
                                        <div className="ps-image-upload-row">
                                            <button
                                                type="button"
                                                className="ps-upload-btn"
                                                onClick={() => proofPhotoInputRef.current?.click()}
                                                disabled={!canAccessStudio || uploadingProofPhoto}
                                            >
                                                {uploadingProofPhoto ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                                                Proof photos
                                            </button>
                                            <button
                                                type="button"
                                                className="ps-upload-btn"
                                                onClick={() => proofVideoInputRef.current?.click()}
                                                disabled={!canAccessStudio || uploadingProofVideo}
                                            >
                                                {uploadingProofVideo ? <Loader2 className="animate-spin" size={14} /> : <Video size={14} />}
                                                Proof video
                                            </button>
                                            <span className="ps-upload-hint">Upload camera/location photos and one short live video for admin approval.</span>
                                        </div>
                                        <input
                                            ref={proofPhotoInputRef}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="ps-file-input"
                                            onChange={(event) => {
                                                const files = Array.from(event.target.files || []);
                                                if (files.length > 0) void handleProofPhotoUpload(files);
                                                event.target.value = '';
                                            }}
                                            disabled={!canAccessStudio || uploadingProofPhoto}
                                        />
                                        <input
                                            ref={proofVideoInputRef}
                                            type="file"
                                            accept="video/*"
                                            className="ps-file-input"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0];
                                                if (file) void handleProofVideoUpload(file);
                                                event.target.value = '';
                                            }}
                                            disabled={!canAccessStudio || uploadingProofVideo}
                                        />
                                        <div className="ps-gallery-add-row">
                                            <input
                                                className="ps-input"
                                                value={proofPhotoInput}
                                                onChange={(event) => setProofPhotoInput(event.target.value)}
                                                placeholder="Paste proof photo URL"
                                                disabled={!canAccessStudio}
                                            />
                                            <button
                                                type="button"
                                                className="ps-upload-btn"
                                                onClick={() => addProofPhotoUrl(proofPhotoInput)}
                                                disabled={!canAccessStudio || !proofPhotoInput.trim()}
                                            >
                                                Add proof URL
                                            </button>
                                        </div>
                                        {virtualDetails.verification_photo_urls.length > 0 && (
                                            <div className="ps-proof-grid">
                                                {virtualDetails.verification_photo_urls.map((url) => (
                                                    <div key={url} className="ps-proof-card">
                                                        <img src={url} alt="Virtual tour proof" />
                                                        <button type="button" onClick={() => removeProofPhotoUrl(url)} disabled={!canAccessStudio}>
                                                            Remove
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <label className="ps-field">
                                            <span className="ps-field-label"><Video size={13} /> Proof video URL</span>
                                            <input
                                                className="ps-input"
                                                value={virtualDetails.verification_video_url}
                                                onChange={(event) => updateVirtualDetails({ verification_video_url: event.target.value })}
                                                placeholder="Upload or paste a short live proof video URL"
                                                disabled={!canAccessStudio}
                                                required
                                            />
                                        </label>
                                        <label className="ps-field">
                                            <span className="ps-field-label">Proof notes</span>
                                            <input
                                                className="ps-input"
                                                value={virtualDetails.proof_notes}
                                                onChange={(event) => updateVirtualDetails({ proof_notes: event.target.value })}
                                                placeholder="Anything admin should check before approving"
                                                disabled={!canAccessStudio}
                                            />
                                        </label>
                                        {virtualDetailsError && <p className="ps-gallery-error">{virtualDetailsError}</p>}
                                    </div>
                                </section>
                            )}

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
                                        <span>{localGuideStudio ? 'Guide live-session fee' : 'Vendor package fee'}</span>
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
                                    <span className="ps-field-label"><DollarSign size={13} /> {localGuideStudio ? 'Guide live-session fee (Rs)' : 'Vendor package fee (Rs)'}</span>
                                    <input
                                        className="ps-input"
                                        type="number"
                                        min="1"
                                        value={pricingPreview.provider_subtotal > 0 ? pricingPreview.provider_subtotal : ''}
                                        placeholder="0"
                                        readOnly
                                    />
                                    <p className="ps-price-note">
                                        {localGuideStudio ? 'Tourists see ' : 'Package cards show '}
                                        <strong>Rs {pricingPreview.total_price.toLocaleString()}</strong> including platform fee.
                                        You receive <strong>Rs {pricingPreview.provider_subtotal.toLocaleString()}</strong> for one {localGuideStudio ? 'live virtual slot' : 'traveler/package selection'}.
                                    </p>
                                </label>
                                <label className="ps-field">
                                    <span className="ps-field-label"><Clock size={13} /> {localGuideStudio ? 'Live Date' : 'Start Date'}</span>
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
                                    placeholder={localGuideStudio ? 'Describe the live route, AR/VR setup, language, duration, and what tourists can request.' : "Describe the experience, what's included, meeting point..."}
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
                                {editingListingId ? 'Update & Re-submit' : getSubmitCopy(form.type, studioRole)}
                            </button>
                        </form>
                    </article>

                    {/* ── Inventory Card ── */}
                    <article className="ps-card">
                        <div className="ps-card-head">
                            <div>
                                <span className="ps-card-label">
                                    <Sparkles size={11} />
                                    {localGuideStudio ? 'Live Tour History' : 'Posting History'}
                                </span>
                                <h2 className="ps-card-title">{localGuideStudio ? 'Your live tours' : 'Your listings'}</h2>
                                <p className="ps-card-desc">
                                    {listings.length > 0
                                        ? `${listings.length} ${localGuideStudio ? 'live tour' : 'listing'}${listings.length === 1 ? '' : 's'} submitted`
                                        : 'No posts yet'}
                                </p>
                            </div>
                            <Link
                                to={localGuideStudio ? '/dashboard/provider?section=virtual-tours' : embedded ? '/dashboard/provider?section=overview' : '/dashboard'}
                                className="ps-inventory-link"
                            >
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
                                                    <span className="ps-type-pill">{getListingSingularCopy(listingType, studioRole)}</span>
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
                                <strong>{localGuideStudio ? 'No live tours yet' : 'No listings yet'}</strong>
                                <p>
                                    Create your first {allowedTypes[0] ? getListingSingularCopy(allowedTypes[0], studioRole).toLowerCase() : 'listing'} and track pending, approved, live, or rejected states here.
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
                                {localGuideStudio
                                    ? submissionModal.mode === 'updated' ? 'Live tour re-submitted' : 'Live tour submitted'
                                    : submissionModal.mode === 'updated' ? 'Listing re-submitted' : 'Listing submitted'}
                            </h3>
                            <p className="ps-modal-copy">
                                <strong>{submissionModal.listingTitle}</strong> was sent for admin review.
                                You can track status changes in your listing history and notifications.
                            </p>
                            <div className="ps-modal-meta">
                                <span>{getListingSingularCopy(submissionModal.listingType, studioRole)}</span>
                                <span>{submissionModal.mode === 'updated' ? 'Awaiting re-approval' : 'Awaiting approval'}</span>
                            </div>
                            <div className="ps-modal-actions">
                                <button type="button" className="ps-modal-btn ps-modal-btn--ghost" onClick={() => setSubmissionModal(null)}>
                                    Continue editing
                                </button>
                                <Link
                                    to={localGuideStudio ? '/dashboard/provider?section=virtual-tours' : '/dashboard/provider?section=listings'}
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
