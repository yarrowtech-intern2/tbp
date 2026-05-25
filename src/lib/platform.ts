export const USER_ROLES = ['tourist', 'tour_company', 'tour_instructor', 'tour_guide', 'admin', 'marketing'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PROVIDER_ROLES = ['tour_company', 'tour_instructor', 'tour_guide'] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export const LISTING_TYPES = ['tour', 'activity', 'guide'] as const;
export type ListingType = (typeof LISTING_TYPES)[number];

export const VERIFICATION_STATUSES = ['not_required', 'pending', 'approved', 'rejected', 'resubmitted'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const LISTING_STATUSES = ['draft', 'pending', 'approved', 'live', 'rejected', 'published'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
    tourist: 'Tourist',
    tour_company: 'Tour Company',
    tour_instructor: 'Tour Instructor',
    tour_guide: 'Tour Guide',
    admin: 'Admin',
    marketing: 'Marketing',
};

export const normalizeRoleValue = (role?: string | null): string | null => {
    if (typeof role !== 'string') return null;
    const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
    return normalized || null;
};

export const LISTING_LABELS: Record<ListingType, string> = {
    tour: 'Tours',
    activity: 'Activities',
    guide: 'Events',
};

export interface RoleSignupConfig {
    summary: string;
    requiresVerification: boolean;
    allowedListingTypes: ListingType[];
    fields: Array<{
        key: RoleFormField;
        label: string;
        placeholder: string;
        required: boolean;
    }>;
}

export type RoleFormField =
    | 'phone'
    | 'country'
    | 'city'
    | 'bio'
    | 'companyName'
    | 'registrationNumber'
    | 'website'
    | 'specialties'
    | 'licenseNumber'
    | 'languages'
    | 'yearsExperience'
    | 'governmentId'
    | 'certificateId';

export interface SignupFormValues {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    phone: string;
    country: string;
    city: string;
    bio: string;
    companyName: string;
    registrationNumber: string;
    website: string;
    specialties: string;
    licenseNumber: string;
    languages: string;
    yearsExperience: string;
    governmentId: string;
    certificateId: string;
    worksUnderCompany: boolean;
}

export const DEFAULT_SIGNUP_VALUES: SignupFormValues = {
    fullName: '',
    email: '',
    password: '',
    role: 'tourist',
    phone: '',
    country: '',
    city: '',
    bio: '',
    companyName: '',
    registrationNumber: '',
    website: '',
    specialties: '',
    licenseNumber: '',
    languages: '',
    yearsExperience: '',
    governmentId: '',
    certificateId: '',
    worksUnderCompany: false,
};

export const ROLE_SIGNUP_CONFIG: Record<UserRole, RoleSignupConfig> = {
    tourist: {
        summary: 'Book listings, save favorites, review completed trips, and chat with providers.',
        requiresVerification: false,
        allowedListingTypes: [],
        fields: [
            { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210', required: true },
            { key: 'country', label: 'Country', placeholder: 'India', required: true },
            { key: 'city', label: 'City', placeholder: 'Srinagar', required: true },
            { key: 'bio', label: 'Travel Style', placeholder: 'Slow travel, food trails, mountain stays', required: false },
        ],
    },
    tour_company: {
        summary: 'Manage a company profile and submit tours, activities, and events for admin post approval.',
        requiresVerification: false,
        allowedListingTypes: ['tour', 'activity', 'guide'],
        fields: [
            { key: 'phone', label: 'Business Phone', placeholder: '+91 98765 43210', required: true },
            { key: 'country', label: 'Country', placeholder: 'India', required: true },
            { key: 'city', label: 'City', placeholder: 'Leh', required: true },
            { key: 'companyName', label: 'Company Name', placeholder: 'North Ridge Expeditions', required: true },
            { key: 'registrationNumber', label: 'Registration Number', placeholder: 'GST / business registration', required: true },
            { key: 'website', label: 'Website', placeholder: 'https://northridge.travel', required: false },
            { key: 'bio', label: 'Company Overview', placeholder: 'Small-group expeditions focused on remote trails and local hosts', required: true },
            { key: 'governmentId', label: 'Primary Verification ID', placeholder: 'PAN / Tax ID / Registration proof ref', required: true },
        ],
    },
    tour_instructor: {
        summary: 'Offer tours, activities, and events independently or under a company profile with post-level approval.',
        requiresVerification: false,
        allowedListingTypes: ['tour', 'activity', 'guide'],
        fields: [
            { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210', required: true },
            { key: 'country', label: 'Country', placeholder: 'India', required: true },
            { key: 'city', label: 'City', placeholder: 'Manali', required: true },
            { key: 'specialties', label: 'Specialties', placeholder: 'Rock climbing, ski training, avalanche safety', required: true },
            { key: 'yearsExperience', label: 'Years of Experience', placeholder: '6', required: true },
            { key: 'certificateId', label: 'Certification Reference', placeholder: 'Instructor certificate ID', required: true },
            { key: 'governmentId', label: 'Government ID', placeholder: 'Passport / national ID / driving license ref', required: true },
            { key: 'bio', label: 'Professional Summary', placeholder: 'Certified outdoor instructor with rescue and safety experience', required: true },
        ],
    },
    tour_guide: {
        summary: 'Lead tours, activities, and events, optionally under a company profile with post-level approval.',
        requiresVerification: false,
        allowedListingTypes: ['tour', 'activity', 'guide'],
        fields: [
            { key: 'phone', label: 'Phone', placeholder: '+91 98765 43210', required: true },
            { key: 'country', label: 'Country', placeholder: 'India', required: true },
            { key: 'city', label: 'City', placeholder: 'Gangtok', required: true },
            { key: 'languages', label: 'Languages', placeholder: 'English, Hindi, Nepali', required: true },
            { key: 'licenseNumber', label: 'Guide License Number', placeholder: 'Guide permit / tourism board ID', required: true },
            { key: 'yearsExperience', label: 'Years of Experience', placeholder: '8', required: true },
            { key: 'governmentId', label: 'Government ID', placeholder: 'Passport / national ID / driving license ref', required: true },
            { key: 'bio', label: 'Guide Summary', placeholder: 'Local route guide focused on heritage, trekking, and small-group touring', required: true },
        ],
    },
    admin: {
        summary: 'Internal role for post moderation and operations.',
        requiresVerification: false,
        allowedListingTypes: [],
        fields: [],
    },
    marketing: {
        summary: 'Internal role for managing public marketing copy and dynamic greetings.',
        requiresVerification: false,
        allowedListingTypes: [],
        fields: [],
    },
};

export const isProviderRole = (role?: string | null): role is ProviderRole => (
    (() => {
        const normalized = normalizeRoleValue(role);
        return Boolean(normalized && (PROVIDER_ROLES as readonly string[]).includes(normalized));
    })()
);

export const isTouristRole = (role?: string | null): role is 'tourist' => normalizeRoleValue(role) === 'tourist';

export const canRolePublish = (role: UserRole | null | undefined, type: ListingType) => {
    if (!role) return false;
    return ROLE_SIGNUP_CONFIG[role].allowedListingTypes.includes(type);
};

export const getRoleLabel = (role?: string | null) => {
    if (!role) return 'Member';

    const normalized = normalizeRoleValue(role);
    if (!normalized) return 'Member';

    if (normalized in ROLE_LABELS) {
        return ROLE_LABELS[normalized as UserRole];
    }

    if (normalized === 'guide' || normalized === 'tour guide') return 'Guide';
    if (normalized === 'instructor' || normalized === 'tour instructor') return 'Instructor';
    if (normalized === 'company' || normalized === 'tour company') return 'Tour Company';
    if (normalized === 'provider') return 'Provider';

    return normalized
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
};

export const getVerificationLabel = (status?: string | null) => {
    switch (status) {
        case 'approved':
            return 'Verified';
        case 'pending':
            return 'Verification Pending';
        case 'rejected':
            return 'Reapply Required';
        case 'resubmitted':
            return 'Resubmitted';
        default:
            return 'Active';
    }
};
