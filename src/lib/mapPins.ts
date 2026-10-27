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
import { __iconNode as flameNode } from 'lucide-react/dist/esm/icons/flame.js';
import { __iconNode as tentNode } from 'lucide-react/dist/esm/icons/tent.js';
import { __iconNode as paletteNode } from 'lucide-react/dist/esm/icons/palette.js';
import { __iconNode as landmarkNode } from 'lucide-react/dist/esm/icons/landmark.js';
import { __iconNode as castleNode } from 'lucide-react/dist/esm/icons/castle.js';
import { __iconNode as schoolNode } from 'lucide-react/dist/esm/icons/school.js';
import { __iconNode as libraryNode } from 'lucide-react/dist/esm/icons/library.js';
import { __iconNode as churchNode } from 'lucide-react/dist/esm/icons/church.js';
import { __iconNode as moonNode } from 'lucide-react/dist/esm/icons/moon.js';
import { __iconNode as treesNode } from 'lucide-react/dist/esm/icons/trees.js';
import { __iconNode as shoppingBagNode } from 'lucide-react/dist/esm/icons/shopping-bag.js';
import { __iconNode as mountainNode } from 'lucide-react/dist/esm/icons/mountain.js';
import { __iconNode as mapPinNode } from 'lucide-react/dist/esm/icons/map-pin.js';
import { __iconNode as utensilsCrossedNode } from 'lucide-react/dist/esm/icons/utensils-crossed.js';
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

type IconNode = ReadonlyArray<readonly [string, Record<string, string | number>]>;

/**
 * Pin glyphs are written straight from lucide's icon data. Rendering them with `react-dom/server` instead pulled the
 * whole server renderer (~190 KB) into the shared React chunk that every page downloads.
 */
const GLYPH_NODES: Record<string, IconNode> = {
    Flame: flameNode, Tent: tentNode, Landmark: landmarkNode, Castle: castleNode, School: schoolNode,
    Library: libraryNode, Church: churchNode, Moon: moonNode, Trees: treesNode, ShoppingBag: shoppingBagNode,
    Mountain: mountainNode, MapPin: mapPinNode, UtensilsCrossed: utensilsCrossedNode, Palette: paletteNode,
};

const glyphCache = new Map<string, string>();

const getGlyphMarkup = (glyphKey: string, Icon: LucideIcon): string => {
    const cached = glyphCache.get(glyphKey);
    if (cached) return cached;
    const node = GLYPH_NODES[Icon.displayName ?? ''] ?? mapPinNode;
    const children = node.map(([tag, attrs]) => (
        `<${tag} ${Object.entries(attrs).filter(([name]) => name !== 'key').map(([name, value]) => `${name}="${value}"`).join(' ')} />`
    )).join('');
    const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${PIN_INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
    glyphCache.set(glyphKey, markup);
    return markup;
};

// Marker shape is the Reicon "Pin" (outline weight, 24-unit box): BODY is its outer contour, filled with the
// category colour; RING is its outline, drawn in ink. The pin's centre circle holds the category glyph.
// The tip of the pin sits at (12, 22.75); that is the marker anchor.
const PIN_BODY_PATH = 'M3.25 10.1433C3.25 5.24427 7.15501 1.25 12 1.25C16.845 1.25 20.75 5.24427 20.75 10.1433C20.75 12.5084 20.076 15.0479 18.8844 17.2419C17.6944 19.4331 15.9556 21.3372 13.7805 22.3539C12.6506 22.882 11.3494 22.882 10.2195 22.3539C8.04437 21.3372 6.30562 19.4331 5.11556 17.2419C3.92403 15.0479 3.25 12.5084 3.25 10.1433Z';
const PIN_RING_PATH = 'M3.25 10.1433C3.25 5.24427 7.15501 1.25 12 1.25C16.845 1.25 20.75 5.24427 20.75 10.1433C20.75 12.5084 20.076 15.0479 18.8844 17.2419C17.6944 19.4331 15.9556 21.3372 13.7805 22.3539C12.6506 22.882 11.3494 22.882 10.2195 22.3539C8.04437 21.3372 6.30562 19.4331 5.11556 17.2419C3.92403 15.0479 3.25 12.5084 3.25 10.1433ZM12 2.75C8.00843 2.75 4.75 6.04748 4.75 10.1433C4.75 12.2404 5.35263 14.5354 6.4337 16.526C7.51624 18.5192 9.04602 20.1496 10.8546 20.995C11.5821 21.335 12.4179 21.335 13.1454 20.995C14.954 20.1496 16.4838 18.5192 17.5663 16.526C18.6474 14.5354 19.25 12.2404 19.25 10.1433C19.25 6.04748 15.9916 2.75 12 2.75Z';
const TIP = { x: 12, y: 22.75 };

const iconCache = new Map<string, DivIcon>();

export type TackOptions = { active?: boolean; draft?: boolean; route?: boolean; planNumber?: number; small?: boolean; label?: string; showLabel?: boolean };

/** Planned stops (and their route) are drawn in a soft, glowing yellow so they stand out from the other pins. */
export const PLAN_COLOR = '#fde047';

export const HOSPITAL_COLOR = '#ef4444';

/** The tack-shaped map pin: a head colour plus a glyph. `key` identifies the colour/glyph pair for caching. */
export const buildTackIcon = (key: string, color: string, Icon: LucideIcon, options: TackOptions = {}): DivIcon => {
    const cacheKey = `${key}:${options.active ? 1 : 0}:${options.draft ? 1 : 0}:${options.route ? 1 : 0}:${options.planNumber || 0}:${options.small ? 1 : 0}:${options.label || ''}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    const size = options.small
        ? (options.active ? 34 : 26)
        : options.active || options.draft ? 54 : options.planNumber ? 48 : 42;
    const scale = size / 24;
    // Planned stops invert the colours (ink body, category-colour ring) and show their visiting order.
    const planned = Boolean(options.planNumber);
    const bodyFill = planned ? PIN_INK : color;
    const ringFill = planned ? PLAN_COLOR : PIN_INK;
    const centre = planned
        ? `<circle cx="12" cy="10" r="4.8" fill="${PLAN_COLOR}" />
    <text x="12" y="10" text-anchor="middle" dominant-baseline="central" font-family="Inter, system-ui, sans-serif" font-size="${options.planNumber! > 9 ? 5 : 6.2}" font-weight="800" fill="${PIN_INK}">${options.planNumber}</text>`
        : `<circle cx="12" cy="10" r="4.6" fill="#ffffff" stroke="${PIN_INK}" stroke-width="1.5" />
    <g transform="translate(9 7) scale(0.5)">${getGlyphMarkup(key, Icon)}</g>`;
    // Glow and outline are vector shapes inside the SVG. CSS drop-shadow filters on every pin force the browser to
    // re-rasterise each marker on every pan/zoom frame, which is what made the map stutter with ~120 pins.
    const halo = planned
        ? `<circle cx="12" cy="10" r="15" fill="${PLAN_COLOR}" fill-opacity="0.16" />
    <circle cx="12" cy="10" r="12" fill="${PLAN_COLOR}" fill-opacity="0.26" />
    <circle cx="12" cy="10" r="9.5" fill="${PLAN_COLOR}" fill-opacity="0.38" />`
        : '';
    const outline = options.small
        ? `<path d="${PIN_BODY_PATH}" fill="#ffffff" stroke="#ffffff" stroke-width="2.6" stroke-linejoin="round" />`
        : '';
    const html = `
<span class="map2-tack${options.active ? ' is-active' : ''}${options.draft ? ' is-draft' : ''}${options.route ? ' is-route' : ''}${planned ? ' is-planned' : ''}${options.small ? ' is-small' : ''}">
  <svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="overflow:visible">
    ${halo}
    ${outline}
    <path d="${PIN_BODY_PATH}" fill="${bodyFill}" />
    <path d="${PIN_RING_PATH}" fill="${ringFill}" fill-rule="evenodd" clip-rule="evenodd" />
    ${centre}
  </svg>${options.label ? `<span class="map2-tack-label">${escapeHtml(options.label)}</span>` : ''}
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

export const buildPinIcon = (category: PinCategory, options: TackOptions = {}): DivIcon => {
    const { color, Icon } = getPinCategory(category);
    return buildTackIcon(`pin:${category}`, color, Icon, options);
};

/** Restaurants, metro and railway stations and hospitals are flat road-style signs (fork and knife, "M", train, "+"), not tack pins. */
const buildSignIcon = (sign: 'restaurant' | 'metro' | 'train' | 'hospital', options: { active?: boolean; label?: string }): DivIcon => {
    const cacheKey = `sign:${sign}:${options.active ? 1 : 0}:${options.label || ''}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    const size = options.active ? 40 : 30;
    const html = `
<span class="map2-sign${options.active ? ' is-active' : ''}" style="width:${size}px;height:${size}px">
  <img src="/icons/${sign}-sign.svg" alt="" width="${size}" height="${size}" draggable="false" />${options.label ? `<span class="map2-tack-label">${escapeHtml(options.label)}</span>` : ''}
</span>`;

    const icon = divIcon({
        className: '',
        html,
        iconSize: point(size, size),
        iconAnchor: point(size / 2, size / 2),
    });
    iconCache.set(cacheKey, icon);
    return icon;
};

export const buildRestaurantIcon = (options: { active?: boolean; label?: string } = {}): DivIcon => (
    buildSignIcon('restaurant', options)
);

export const buildTransitIcon = (options: { mode: 'metro' | 'train'; active?: boolean; label?: string }): DivIcon => (
    buildSignIcon(options.mode, options)
);

/** Red "+" road sign for hospitals. */
export const buildHospitalIcon = (options: { active?: boolean; label?: string } = {}): DivIcon => (
    buildSignIcon('hospital', options)
);

/** Circular Durga-face badge used for Durga Puja pandal stops, in place of the generic tack pin. */
export const buildDurgaPandalIcon = (options: TackOptions = {}): DivIcon => {
    const labelText = options.showLabel ? options.label || '' : '';
    const cacheKey = `durga:${options.active ? 1 : 0}:${options.planNumber || 0}:${labelText}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    const size = options.active ? 40 : options.planNumber ? 36 : 30;
    const badge = options.planNumber
        ? `<span class="map2-durga-badge">${options.planNumber}</span>`
        : '';
    const html = `
<span class="map2-durga-pin${options.active ? ' is-active' : ''}${options.planNumber ? ' is-planned' : ''}" style="width:${size}px;height:${size}px">
  <img src="/icons/puja.png" alt="" width="${size}" height="${size}" />
  ${badge}${labelText ? `<span class="map2-durga-label">${escapeHtml(labelText)}</span>` : ''}
</span>`;

    const icon = divIcon({
        className: '',
        html,
        iconSize: point(size, size),
        iconAnchor: point(size / 2, size - 4),
    });
    iconCache.set(cacheKey, icon);
    return icon;
};

export const BIENNALE_COLOR = '#7c3aed';

const BIENNALE_GLYPH_MARKUP = (() => {
    const children = (paletteNode as IconNode).map(([tag, attrs]) => (
        `<${tag} ${Object.entries(attrs).filter(([name]) => name !== 'key').map(([name, value]) => `${name}="${value}"`).join(' ')} />`
    )).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${children}</svg>`;
})();

/** Circular violet badge used for Biennale venue stops, built from an inline SVG glyph rather than a raster image. */
export const buildBiennaleIcon = (options: TackOptions = {}): DivIcon => {
    const labelText = options.showLabel ? options.label || '' : '';
    const cacheKey = `biennale:${options.active ? 1 : 0}:${options.planNumber || 0}:${labelText}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    const size = options.active ? 40 : options.planNumber ? 36 : 30;
    const badge = options.planNumber
        ? `<span class="map2-biennale-badge">${options.planNumber}</span>`
        : '';
    const html = `
<span class="map2-biennale-pin${options.active ? ' is-active' : ''}${options.planNumber ? ' is-planned' : ''}" style="width:${size}px;height:${size}px">
  <svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" style="display:block">
    <circle cx="12" cy="12" r="11" fill="${BIENNALE_COLOR}" />
    <g transform="translate(5 5) scale(0.58)">${BIENNALE_GLYPH_MARKUP}</g>
  </svg>
  ${badge}${labelText ? `<span class="map2-durga-label">${escapeHtml(labelText)}</span>` : ''}
</span>`;

    const icon = divIcon({
        className: '',
        html,
        iconSize: point(size, size),
        iconAnchor: point(size / 2, size - 4),
    });
    iconCache.set(cacheKey, icon);
    return icon;
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/**
 * A plain emoji used directly as the map marker (no pin shape). Used for the famous places, the curated
 * places and "Explore nearby" results. A white halo and soft shadow keep it readable on any map tile.
 */
export const buildEmojiMarkerIcon = (emoji: string, options: { active?: boolean; route?: boolean } = {}): DivIcon => {
    const cacheKey = `emoji:${emoji}:${options.active ? 1 : 0}:${options.route ? 1 : 0}`;
    const cached = iconCache.get(cacheKey);
    if (cached) return cached;

    const size = options.active ? 54 : 40;
    const html = `<span class="map2-emoji-marker${options.active ? ' is-active' : ''}${options.route ? ' is-route' : ''}" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.72)}px" aria-hidden="true">${escapeHtml(emoji)}</span>`;

    const icon = divIcon({
        className: '',
        html,
        iconSize: point(size, size),
        iconAnchor: point(size / 2, size / 2),
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
