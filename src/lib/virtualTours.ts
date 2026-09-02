export const LOCAL_GUIDE_VIRTUAL_SUBCATEGORY = 'Live 360 Virtual Tour';
export const VIRTUAL_TOURS_ENABLED = false;

export const VIRTUAL_TOUR_TAGS = [
    'virtual tour',
    'live 360',
    '360',
    'vr tour',
    'ar tour',
    'virtual',
    'remote tour',
] as const;

export type VirtualTourCameraType = 'phone' | '360_camera' | 'action_camera' | 'mirrorless' | 'other';

export interface VirtualTourDetails {
    version: 1;
    is_virtual_tour: true;
    spot_location: string;
    meeting_point: string;
    duration_minutes: number;
    places_shown: string[];
    languages: string[];
    available_windows: string[];
    max_guests: number;
    camera_type: VirtualTourCameraType;
    camera_notes: string;
    network_plan: string;
    included_items: string[];
    excluded_items: string[];
    schedule_notes: string;
    accessibility_notes: string;
    tourist_requirements: string;
    verification_photo_urls: string[];
    verification_video_url: string;
    proof_notes: string;
}

export const DEFAULT_VIRTUAL_TOUR_DETAILS: VirtualTourDetails = {
    version: 1,
    is_virtual_tour: true,
    spot_location: '',
    meeting_point: '',
    duration_minutes: 45,
    places_shown: [],
    languages: [],
    available_windows: [],
    max_guests: 6,
    camera_type: 'phone',
    camera_notes: '',
    network_plan: '',
    included_items: [],
    excluded_items: [],
    schedule_notes: '',
    accessibility_notes: '',
    tourist_requirements: '',
    verification_photo_urls: [],
    verification_video_url: '',
    proof_notes: '',
};

export const CAMERA_TYPE_LABELS: Record<VirtualTourCameraType, string> = {
    phone: 'Phone camera',
    '360_camera': '360 camera',
    action_camera: 'Action camera',
    mirrorless: 'Mirrorless / DSLR',
    other: 'Other setup',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

export const splitLines = (value: string): string[] => Array.from(new Set(
    value
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
));

export const joinLines = (value: string[] | undefined | null): string => (
    Array.isArray(value) ? value.filter(Boolean).join('\n') : ''
);

export const toPositiveInt = (value: unknown, fallback: number): number => {
    const next = Math.round(Number(value));
    return Number.isFinite(next) && next > 0 ? next : fallback;
};

const toStringValue = (value: unknown): string => (
    typeof value === 'string' ? value.trim() : ''
);

const hasVirtualTourDetailSignal = (value: Record<string, unknown>): boolean => (
    value.is_virtual_tour === true
    || value.virtual_tour === true
    || toStringValue(value.spot_location).length > 0
    || toStringValue(value.meeting_point).length > 0
    || toStringValue(value.camera_notes).length > 0
    || toStringValue(value.network_plan).length > 0
    || toStringArray(value.places_shown).length > 0
    || toStringArray(value.available_windows).length > 0
    || toStringArray(value.verification_photo_urls).length > 0
    || toStringValue(value.verification_video_url).length > 0
);

const toStringArray = (value: unknown): string[] => {
    if (Array.isArray(value)) {
        return Array.from(new Set(value.map(toStringValue).filter(Boolean)));
    }
    if (typeof value === 'string') return splitLines(value);
    return [];
};

const toCameraType = (value: unknown): VirtualTourCameraType => {
    if (
        value === 'phone'
        || value === '360_camera'
        || value === 'action_camera'
        || value === 'mirrorless'
        || value === 'other'
    ) {
        return value;
    }
    return 'phone';
};

export const normalizeVirtualTourDetails = (value: unknown): VirtualTourDetails => {
    const raw = isRecord(value) ? value : {};
    return {
        ...DEFAULT_VIRTUAL_TOUR_DETAILS,
        spot_location: toStringValue(raw.spot_location),
        meeting_point: toStringValue(raw.meeting_point),
        duration_minutes: toPositiveInt(raw.duration_minutes, DEFAULT_VIRTUAL_TOUR_DETAILS.duration_minutes),
        places_shown: toStringArray(raw.places_shown),
        languages: toStringArray(raw.languages),
        available_windows: toStringArray(raw.available_windows),
        max_guests: toPositiveInt(raw.max_guests, DEFAULT_VIRTUAL_TOUR_DETAILS.max_guests),
        camera_type: toCameraType(raw.camera_type),
        camera_notes: toStringValue(raw.camera_notes),
        network_plan: toStringValue(raw.network_plan),
        included_items: toStringArray(raw.included_items),
        excluded_items: toStringArray(raw.excluded_items),
        schedule_notes: toStringValue(raw.schedule_notes),
        accessibility_notes: toStringValue(raw.accessibility_notes),
        tourist_requirements: toStringValue(raw.tourist_requirements),
        verification_photo_urls: toStringArray(raw.verification_photo_urls),
        verification_video_url: toStringValue(raw.verification_video_url),
        proof_notes: toStringValue(raw.proof_notes),
    };
};

export const getVirtualTourDetailsFromRecord = (record: Record<string, unknown> | null | undefined): VirtualTourDetails | null => {
    if (!record) return null;
    const detailSource = isRecord(record.virtual_tour_details)
        ? record.virtual_tour_details
        : isRecord(record.virtualTourDetails)
            ? record.virtualTourDetails
            : null;
    if (
        record.is_virtual_tour !== true
        && record.virtual_tour !== true
        && (!detailSource || !hasVirtualTourDetailSignal(detailSource))
    ) {
        return null;
    }
    return normalizeVirtualTourDetails(detailSource || record);
};

export const isVirtualTourRecord = (record: Record<string, unknown> | null | undefined): boolean => {
    if (!record) return false;
    if (record.is_virtual_tour === true || record.virtual_tour === true) return true;
    const details = getVirtualTourDetailsFromRecord(record);
    if (details?.is_virtual_tour) return true;
    const haystack = [
        record.sub_category,
        record.category,
        record.title,
        record.name,
        record.description,
        record.delivery_mode,
        record.experience_mode,
    ]
        .map(toStringValue)
        .join(' ')
        .toLowerCase();
    return VIRTUAL_TOUR_TAGS.some((tag) => haystack.includes(tag));
};

export const buildVirtualTourDescription = (baseDescription: string, details: VirtualTourDetails): string => {
    const sections = [
        baseDescription.trim(),
        details.places_shown.length ? `Places shown: ${details.places_shown.join(', ')}` : '',
        details.duration_minutes ? `Duration: ${details.duration_minutes} minutes` : '',
        details.available_windows.length ? `Available windows: ${details.available_windows.join(', ')}` : '',
        details.languages.length ? `Languages: ${details.languages.join(', ')}` : '',
        details.included_items.length ? `Included: ${details.included_items.join(', ')}` : '',
        details.tourist_requirements ? `Tourist requirements: ${details.tourist_requirements}` : '',
        details.camera_notes ? `Camera setup: ${details.camera_notes}` : '',
    ].filter(Boolean);
    return sections.join('\n\n');
};
