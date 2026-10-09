import {
    Amphora,
    BedDouble,
    CalendarDays,
    Compass,
    Landmark,
    MapPin,
    Scissors,
    UtensilsCrossed,
    Zap,
    type LucideIcon,
} from 'lucide-react';
import type { DivIcon } from 'leaflet';
import { resolveActivityCategoryKey } from './activityCategories';
import { buildTackIcon, type TackOptions } from './mapPins';
import { supabase } from './supabase';

export type PlaceCategory =
    | 'restaurant' | 'hotel' | 'crafting' | 'pottery' | 'museum' | 'tour' | 'activity' | 'event' | 'other';

/** Every category has its own pin colour so tourists can tell a hotel from a pottery workshop at a glance. */
export const PLACE_CATEGORIES: Array<{ key: PlaceCategory; label: string; color: string; Icon: LucideIcon; hint: string }> = [
    { key: 'restaurant', label: 'Restaurant / Cafe', color: '#f43f5e', Icon: UtensilsCrossed, hint: 'Food and special menus' },
    { key: 'hotel', label: 'Hotel / Stay', color: '#0ea5e9', Icon: BedDouble, hint: 'Hotels, homestays, resorts' },
    { key: 'crafting', label: 'Crafting', color: '#eab308', Icon: Scissors, hint: 'Handcraft workshops' },
    { key: 'pottery', label: 'Pottery', color: '#c2410c', Icon: Amphora, hint: 'Pottery studios' },
    { key: 'museum', label: 'Museum', color: '#6366f1', Icon: Landmark, hint: 'Museums and special tours' },
    { key: 'tour', label: 'Tour', color: '#10b981', Icon: Compass, hint: 'Tour operators and start points' },
    { key: 'activity', label: 'Activity', color: '#14b8a6', Icon: Zap, hint: 'Activity venues' },
    { key: 'event', label: 'Event', color: '#a855f7', Icon: CalendarDays, hint: 'Event spots and guides' },
    { key: 'other', label: 'Other', color: '#64748b', Icon: MapPin, hint: 'Anything else, name it yourself' },
];

export const getPlaceCategory = (key: string | null | undefined) => (
    PLACE_CATEGORIES.find((item) => item.key === key) || PLACE_CATEGORIES[PLACE_CATEGORIES.length - 1]
);

/** The label shown for a pin: custom text for "Other", the category name otherwise. */
export const getPlaceDisplayLabel = (place: Pick<ProviderPlace, 'category' | 'custom_label'>) => (
    place.category === 'other' && place.custom_label.trim() ? place.custom_label.trim() : getPlaceCategory(place.category).label
);

/** Default pin category for a listing: tours and events map directly, activities follow their activity category. */
export const placeCategoryForListing = (listingType: string, subCategory?: string | null): PlaceCategory => {
    if (listingType === 'tour') return 'tour';
    if (listingType === 'guide' || listingType === 'event') return 'event';
    const activityKey = resolveActivityCategoryKey(subCategory);
    if (activityKey === 'restaurant' || activityKey === 'crafting' || activityKey === 'pottery') return activityKey;
    if (activityKey === 'museums') return 'museum';
    return 'activity';
};

export interface ProviderPlace {
    id: string;
    user_id: string;
    name: string;
    category: PlaceCategory;
    custom_label: string;
    description: string;
    address: string;
    lat: number;
    lng: number;
    listing_id: string | null;
    listing_type: string | null;
    is_hidden: boolean;
    created_at: string;
    updated_at: string;
}

export type ProviderPlaceInput = Pick<ProviderPlace, 'name' | 'category' | 'custom_label' | 'description' | 'address' | 'lat' | 'lng'> & {
    listing_id?: string | null;
    listing_type?: string | null;
};

const COLUMNS = 'id, user_id, name, category, custom_label, description, address, lat, lng, listing_id, listing_type, is_hidden, created_at, updated_at';
const PLACES_NOT_READY = 'Map places are not set up yet. Run the provider_places migration in Supabase.';

const toError = (error: { code?: string; message?: string }) => new Error(
    error.code === '42P01' || error.code === 'PGRST205' || /provider_places/i.test(error.message || '')
        ? PLACES_NOT_READY
        : error.message || 'Something went wrong.',
);

export const buildPlacePinIcon = (category: PlaceCategory, options: TackOptions = {}): DivIcon => {
    const { color, Icon } = getPlaceCategory(category);
    return buildTackIcon(`place:${category}`, color, Icon, options);
};

/** Public map layer. Hidden pins are filtered out even for the owner and admins, who can otherwise read them. */
export const fetchPublicPlaces = async (): Promise<ProviderPlace[]> => {
    const { data, error } = await supabase
        .from('provider_places')
        .select(COLUMNS)
        .eq('is_hidden', false)
        .order('created_at', { ascending: false })
        .limit(1000);
    if (error) throw toError(error);
    return (data || []) as ProviderPlace[];
};

export const fetchMyPlaces = async (userId: string): Promise<ProviderPlace[]> => {
    const { data, error } = await supabase
        .from('provider_places')
        .select(COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw toError(error);
    return (data || []) as ProviderPlace[];
};

export const fetchAllPlacesForAdmin = async (): Promise<ProviderPlace[]> => {
    const { data, error } = await supabase
        .from('provider_places')
        .select(COLUMNS)
        .order('created_at', { ascending: false })
        .limit(500);
    if (error) throw toError(error);
    return (data || []) as ProviderPlace[];
};

const cleanInput = (input: ProviderPlaceInput) => ({
    ...input,
    name: input.name.trim(),
    custom_label: input.category === 'other' ? input.custom_label.trim() : '',
    description: input.description.trim(),
    address: input.address.trim(),
});

export const createPlace = async (userId: string, input: ProviderPlaceInput): Promise<ProviderPlace> => {
    const { data, error } = await supabase
        .from('provider_places')
        .insert({ ...cleanInput(input), user_id: userId })
        .select(COLUMNS)
        .single();
    if (error) throw toError(error);
    return data as ProviderPlace;
};

export const updatePlace = async (id: string, input: ProviderPlaceInput): Promise<ProviderPlace> => {
    const { data, error } = await supabase
        .from('provider_places')
        .update(cleanInput(input))
        .eq('id', id)
        .select(COLUMNS)
        .single();
    if (error) throw toError(error);
    return data as ProviderPlace;
};

export const deletePlace = async (id: string): Promise<void> => {
    const { error } = await supabase.from('provider_places').delete().eq('id', id);
    if (error) throw toError(error);
};

export const setPlaceHidden = async (id: string, hidden: boolean): Promise<void> => {
    const { error } = await supabase.from('provider_places').update({ is_hidden: hidden }).eq('id', id);
    if (error) throw toError(error);
};

/** Creates or moves the pin that belongs to one listing (one pin per listing). */
export const saveListingPlace = async (
    userId: string,
    listingId: string,
    listingType: string,
    input: Omit<ProviderPlaceInput, 'listing_id' | 'listing_type'>,
): Promise<ProviderPlace> => {
    const { data: existing, error: lookupError } = await supabase
        .from('provider_places')
        .select('id')
        .eq('listing_id', listingId)
        .maybeSingle();
    if (lookupError) throw toError(lookupError);
    const payload = { ...input, listing_id: listingId, listing_type: listingType };
    return existing?.id ? updatePlace(existing.id as string, payload) : createPlace(userId, payload);
};

export const fetchListingPlace = async (listingId: string): Promise<ProviderPlace | null> => {
    const { data, error } = await supabase
        .from('provider_places')
        .select(COLUMNS)
        .eq('listing_id', listingId)
        .maybeSingle();
    if (error) throw toError(error);
    return (data as ProviderPlace | null) || null;
};

export const removeListingPlace = async (listingId: string): Promise<void> => {
    const { error } = await supabase.from('provider_places').delete().eq('listing_id', listingId);
    if (error) throw toError(error);
};
