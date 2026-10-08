import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { divIcon, point, type DivIcon } from 'leaflet';
import {
    Castle,
    Church,
    Flame,
    Landmark,
    Library,
    MapPin,
    Moon,
    Mountain,
    School,
    ShoppingBag,
    Tent,
    Trees,
    UtensilsCrossed,
    type LucideIcon,
} from 'lucide-react';
import { supabase } from './supabase';

export type PinCategory =
    | 'temple' | 'mosque' | 'church' | 'school' | 'historical' | 'heritage'
    | 'durga_puja' | 'museum' | 'park' | 'market' | 'food' | 'viewpoint' | 'other';

/** Each category is a head colour plus a glyph; the second pin colour (outline, needle, glyph) is always ink. */
export const PIN_CATEGORIES: Array<{ key: PinCategory; label: string; color: string; Icon: LucideIcon }> = [
    { key: 'temple', label: 'Temple', color: '#fb923c', Icon: Flame },
    { key: 'durga_puja', label: 'Durga Puja Pandal', color: '#f87171', Icon: Tent },
    { key: 'heritage', label: 'Heritage', color: '#fbbf24', Icon: Landmark },
    { key: 'historical', label: 'Historical', color: '#c4b5fd', Icon: Castle },
    { key: 'school', label: 'School', color: '#fde047', Icon: School },
    { key: 'museum', label: 'Museum', color: '#5eead4', Icon: Library },
    { key: 'church', label: 'Church', color: '#93c5fd', Icon: Church },
    { key: 'mosque', label: 'Mosque', color: '#34d399', Icon: Moon },
    { key: 'park', label: 'Park', color: '#a3e635', Icon: Trees },
    { key: 'market', label: 'Market', color: '#e879f9', Icon: ShoppingBag },
    { key: 'food', label: 'Food', color: '#fb7185', Icon: UtensilsCrossed },
    { key: 'viewpoint', label: 'Viewpoint', color: '#38bdf8', Icon: Mountain },
    { key: 'other', label: 'Other', color: '#d4d4d8', Icon: MapPin },
];

export const PIN_INK = '#171717';

export const getPinCategory = (key: string | null | undefined) => (
    PIN_CATEGORIES.find((item) => item.key === key) || PIN_CATEGORIES[PIN_CATEGORIES.length - 1]
);

/** Maps the curated attraction labels on /map onto pin categories. */
export const categoryFromLabel = (label: string): PinCategory => {
    const normalized = label.trim().toLowerCase();
    const direct = PIN_CATEGORIES.find((item) => item.key === normalized || item.label.toLowerCase() === normalized);
    if (direct) return direct.key;
    if (normalized === 'spiritual') return 'temple';
    if (normalized === 'landmark') return 'historical';
    if (normalized === 'science' || normalized === 'family') return 'museum';
    if (normalized === 'riverfront') return 'viewpoint';
    if (normalized === 'art district') return 'durga_puja';
    return 'other';
};

const glyphCache = new Map<PinCategory, string>();

const getGlyphMarkup = (category: PinCategory): string => {
    const cached = glyphCache.get(category);
    if (cached) return cached;
    const { Icon } = getPinCategory(category);
    const markup = renderToStaticMarkup(createElement(Icon, { size: 12, color: PIN_INK, strokeWidth: 2.6, 'aria-hidden': true }));
    glyphCache.set(category, markup);
    return markup;
};

// Marker shape is the Reicon "Pin" (outline weight, 24-unit box): BODY is its outer contour, filled with the
// category colour; RING is its outline, drawn in ink. The pin's centre circle holds the category glyph.
// The tip of the pin sits at (12, 22.75); that is the marker anchor.
const PIN_BODY_PATH = 'M3.25 10.1433C3.25 5.24427 7.15501 1.25 12 1.25C16.845 1.25 20.75 5.24427 20.75 10.1433C20.75 12.5084 20.076 15.0479 18.8844 17.2419C17.6944 19.4331 15.9556 21.3372 13.7805 22.3539C12.6506 22.882 11.3494 22.882 10.2195 22.3539C8.04437 21.3372 6.30562 19.4331 5.11556 17.2419C3.92403 15.0479 3.25 12.5084 3.25 10.1433Z';
const PIN_RING_PATH = 'M3.25 10.1433C3.25 5.24427 7.15501 1.25 12 1.25C16.845 1.25 20.75 5.24427 20.75 10.1433C20.75 12.5084 20.076 15.0479 18.8844 17.2419C17.6944 19.4331 15.9556 21.3372 13.7805 22.3539C12.6506 22.882 11.3494 22.882 10.2195 22.3539C8.04437 21.3372 6.30562 19.4331 5.11556 17.2419C3.92403 15.0479 3.25 12.5084 3.25 10.1433ZM12 2.75C8.00843 2.75 4.75 6.04748 4.75 10.1433C4.75 12.2404 5.35263 14.5354 6.4337 16.526C7.51624 18.5192 9.04602 20.1496 10.8546 20.995C11.5821 21.335 12.4179 21.335 13.1454 20.995C14.954 20.1496 16.4838 18.5192 17.5663 16.526C18.6474 14.5354 19.25 12.2404 19.25 10.1433C19.25 6.04748 15.9916 2.75 12 2.75Z';
const TIP = { x: 12, y: 22.75 };

const iconCache = new Map<string, DivIcon>();

export const buildPinIcon = (category: PinCategory, options: { active?: boolean; draft?: boolean; route?: boolean; planNumber?: number } = {}): DivIcon => {
    const cacheKey = `${category}:${options.active ? 1 : 0}:${options.draft ? 1 : 0}:${options.route ? 1 : 0}:${options.planNumber || 0}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    const size = options.active || options.draft ? 54 : options.planNumber ? 48 : 42;
    const scale = size / 24;
    const { color } = getPinCategory(category);
    // Planned stops invert the colours (ink body, category-colour ring) and show their visiting order.
    const planned = Boolean(options.planNumber);
    const bodyFill = planned ? PIN_INK : color;
    const ringFill = planned ? color : PIN_INK;
    const centre = planned
        ? `<circle cx="12" cy="10" r="4.8" fill="${color}" />
    <text x="12" y="10" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-size="${options.planNumber! > 9 ? 5 : 6.2}" font-weight="800" fill="${PIN_INK}">${options.planNumber}</text>`
        : `<circle cx="12" cy="10" r="4.6" fill="#ffffff" stroke="${PIN_INK}" stroke-width="1.5" />
    <g transform="translate(9 7) scale(0.5)">${getGlyphMarkup(category)}</g>`;
    const html = `
<span class="map2-tack${options.active ? ' is-active' : ''}${options.draft ? ' is-draft' : ''}${options.route ? ' is-route' : ''}${planned ? ' is-planned' : ''}">
  <svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <path d="${PIN_BODY_PATH}" fill="${bodyFill}" />
    <path d="${PIN_RING_PATH}" fill="${ringFill}" fill-rule="evenodd" clip-rule="evenodd" />
    ${centre}
  </svg>
</span>`;

    const icon = divIcon({
        className: '',
        html,
        iconSize: point(size, size),
        iconAnchor: point(Math.round(TIP.x * scale), Math.round(TIP.y * scale)),
    });
    iconCache.set(cacheKey, icon);
    return icon;
};

export interface MapPinRecord {
    id: string;
    user_id: string;
    author_name: string;
    lat: number;
    lng: number;
    category: PinCategory;
    title: string;
    review: string;
    rating: number;
    created_at: string;
}

export type NewMapPin = Pick<MapPinRecord, 'lat' | 'lng' | 'category' | 'title' | 'review' | 'rating'>;

const isMissingTable = (error: { code?: string; message?: string }) => (
    error.code === '42P01' || error.code === 'PGRST205' || /map_pins/i.test(error.message || '')
);

const PINS_NOT_READY = 'Pins are not set up yet. Run the map_pins migration in Supabase.';

export const fetchMapPins = async (): Promise<MapPinRecord[]> => {
    const { data, error } = await supabase
        .from('map_pins')
        .select('id, user_id, author_name, lat, lng, category, title, review, rating, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
    if (error) throw new Error(isMissingTable(error) ? PINS_NOT_READY : error.message);
    return (data || []) as MapPinRecord[];
};

export const createMapPin = async (pin: NewMapPin, userId: string, authorName: string): Promise<MapPinRecord> => {
    const { data, error } = await supabase
        .from('map_pins')
        .insert({
            ...pin,
            user_id: userId,
            author_name: authorName.trim().slice(0, 80) || 'Traveller',
            title: pin.title.trim(),
            review: pin.review.trim(),
        })
        .select('id, user_id, author_name, lat, lng, category, title, review, rating, created_at')
        .single();
    if (error) throw new Error(isMissingTable(error) ? PINS_NOT_READY : error.message);
    return data as MapPinRecord;
};

export const deleteMapPin = async (id: string): Promise<void> => {
    const { error } = await supabase.from('map_pins').delete().eq('id', id);
    if (error) throw new Error(error.message);
};
