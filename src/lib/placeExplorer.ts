/**
 * "Explore nearby" on /map: browse real places by category around the current map view.
 * Data comes from OpenStreetMap through the public Overpass API (same source the route planner uses).
 */

export interface ExploreCategory {
    key: string;
    label: string;
    emoji: string;
    /** Overpass tag selectors; a place matches if it matches any one of them. */
    selectors: string[];
}

export interface ExploreGroup {
    key: string;
    label: string;
    color: string;
    categories: ExploreCategory[];
}

export const EXPLORE_GROUPS: ExploreGroup[] = [
    {
        key: 'food',
        label: 'Food & Drink',
        color: '#fb923c',
        categories: [
            { key: 'restaurants', label: 'Restaurants', emoji: '🍽️', selectors: ['["amenity"="restaurant"]'] },
            { key: 'cafes', label: 'Cafes', emoji: '☕', selectors: ['["amenity"="cafe"]'] },
            { key: 'fast-food', label: 'Fast food', emoji: '🍔', selectors: ['["amenity"="fast_food"]'] },
            { key: 'bars', label: 'Bars', emoji: '🍸', selectors: ['["amenity"="bar"]'] },
            { key: 'pubs', label: 'Pubs', emoji: '🍺', selectors: ['["amenity"="pub"]'] },
            { key: 'bakeries', label: 'Bakeries', emoji: '🍰', selectors: ['["shop"~"^(bakery|pastry|confectionery)$"]'] },
            { key: 'street-food', label: 'Street food', emoji: '🍜', selectors: ['["amenity"="food_court"]', '["street_vendor"="yes"]', '["amenity"="fast_food"]["cuisine"~"street|chaat|kathi|momo|phuchka",i]'] },
            { key: 'healthy', label: 'Healthy food', emoji: '🥗', selectors: ['["amenity"~"^(restaurant|cafe|fast_food)$"]["cuisine"~"salad|healthy|juice|vegan",i]', '["amenity"~"^(restaurant|cafe)$"]["diet:vegan"~"^(yes|only)$"]'] },
            { key: 'indian', label: 'Indian restaurants', emoji: '🍛', selectors: ['["amenity"="restaurant"]["cuisine"~"indian|bengali|punjabi|mughlai|biryani",i]'] },
            { key: 'japanese', label: 'Japanese restaurants', emoji: '🍣', selectors: ['["amenity"="restaurant"]["cuisine"~"japanese|sushi|ramen",i]'] },
        ],
    },
    {
        key: 'shopping',
        label: 'Shopping',
        color: '#e879f9',
        categories: [
            { key: 'malls', label: 'Shopping malls', emoji: '🛍️', selectors: ['["shop"~"^(mall|department_store)$"]'] },
            { key: 'fashion', label: 'Fashion', emoji: '👗', selectors: ['["shop"~"^(clothes|boutique|fashion)$"]'] },
            { key: 'shoes', label: 'Shoes', emoji: '👟', selectors: ['["shop"="shoes"]'] },
            { key: 'jewelry', label: 'Jewelry', emoji: '💎', selectors: ['["shop"="jewelry"]'] },
            { key: 'supermarkets', label: 'Supermarkets', emoji: '🛒', selectors: ['["shop"="supermarket"]'] },
            { key: 'convenience', label: 'Convenience stores', emoji: '🏪', selectors: ['["shop"="convenience"]'] },
            { key: 'bookstores', label: 'Bookstores', emoji: '📚', selectors: ['["shop"="books"]'] },
            { key: 'gifts', label: 'Gift shops', emoji: '🎁', selectors: ['["shop"~"^(gift|souvenir)$"]'] },
        ],
    },
    {
        key: 'entertainment',
        label: 'Entertainment',
        color: '#c4b5fd',
        categories: [
            { key: 'cinemas', label: 'Cinemas', emoji: '🎬', selectors: ['["amenity"="cinema"]'] },
            { key: 'theatres', label: 'Theatres', emoji: '🎭', selectors: ['["amenity"="theatre"]'] },
            { key: 'live-music', label: 'Live music', emoji: '🎵', selectors: ['["amenity"="music_venue"]', '["live_music"="yes"]'] },
            { key: 'concerts', label: 'Concert venues', emoji: '🎤', selectors: ['["amenity"~"^(concert_hall|events_venue)$"]'] },
            { key: 'gaming', label: 'Gaming', emoji: '🎮', selectors: ['["leisure"="amusement_arcade"]', '["shop"="video_games"]'] },
            { key: 'bowling', label: 'Bowling', emoji: '🎳', selectors: ['["leisure"="bowling_alley"]'] },
            { key: 'galleries', label: 'Art galleries', emoji: '🎨', selectors: ['["tourism"="gallery"]', '["shop"="art"]'] },
            { key: 'museums', label: 'Museums', emoji: '🏛️', selectors: ['["tourism"="museum"]'] },
        ],
    },
    {
        key: 'outdoors',
        label: 'Outdoors',
        color: '#a3e635',
        categories: [
            { key: 'parks', label: 'Parks', emoji: '🌳', selectors: ['["leisure"~"^(park|garden)$"]["name"]'] },
            { key: 'waterfront', label: 'Waterfront', emoji: '🌊', selectors: ['["leisure"~"^(promenade|marina)$"]', '["man_made"="pier"]', '["name"~"ghat",i]["tourism"]', '["name"~" ghat$",i][!"highway"]'] },
            { key: 'beaches', label: 'Beaches', emoji: '🏖️', selectors: ['["natural"="beach"]'] },
            { key: 'viewpoints', label: 'Viewpoints', emoji: '🏞️', selectors: ['["tourism"="viewpoint"]'] },
            { key: 'hiking', label: 'Hiking', emoji: '🥾', selectors: ['["highway"="trailhead"]', '["leisure"="nature_reserve"]["name"]'] },
            { key: 'cycling', label: 'Cycling', emoji: '🚲', selectors: ['["shop"="bicycle"]', '["amenity"="bicycle_repair_station"]'] },
            { key: 'camping', label: 'Camping', emoji: '🏕️', selectors: ['["tourism"~"^(camp_site|caravan_site)$"]'] },
        ],
    },
    {
        key: 'transport',
        label: 'Travel & Transport',
        color: '#38bdf8',
        categories: [
            { key: 'airports', label: 'Airports', emoji: '✈️', selectors: ['["aeroway"~"^(aerodrome|terminal)$"]["name"]'] },
            { key: 'train-stations', label: 'Train stations', emoji: '🚆', selectors: ['["railway"="station"]["station"!="subway"]["subway"!="yes"]'] },
            { key: 'metro-stations', label: 'Metro stations', emoji: '🚇', selectors: ['["railway"="station"]["station"="subway"]', '["railway"="station"]["subway"="yes"]'] },
            { key: 'bus-stops', label: 'Bus stops', emoji: '🚌', selectors: ['["highway"="bus_stop"]'] },
            { key: 'taxi', label: 'Taxi stands', emoji: '🚕', selectors: ['["amenity"="taxi"]'] },
            { key: 'bike-stations', label: 'Bike stations', emoji: '🚲', selectors: ['["amenity"="bicycle_rental"]'] },
            { key: 'fuel', label: 'Fuel stations', emoji: '⛽', selectors: ['["amenity"="fuel"]'] },
            { key: 'parking', label: 'Parking', emoji: '🅿️', selectors: ['["amenity"="parking"]'] },
        ],
    },
    {
        key: 'services',
        label: 'Services',
        color: '#5eead4',
        categories: [
            { key: 'hospitals', label: 'Hospitals', emoji: '🏥', selectors: ['["amenity"~"^(hospital|clinic)$"]'] },
            { key: 'pharmacies', label: 'Pharmacies', emoji: '💊', selectors: ['["amenity"="pharmacy"]', '["shop"="chemist"]'] },
            { key: 'banks', label: 'Banks', emoji: '🏦', selectors: ['["amenity"="bank"]'] },
            { key: 'atms', label: 'ATMs', emoji: '🏧', selectors: ['["amenity"="atm"]', '["amenity"="bank"]["atm"="yes"]'] },
            { key: 'hotels', label: 'Hotels', emoji: '🏨', selectors: ['["tourism"~"^(hotel|guest_house|hostel|motel)$"]'] },
            { key: 'schools', label: 'Schools', emoji: '🏫', selectors: ['["amenity"~"^(school|college)$"]'] },
            { key: 'offices', label: 'Offices', emoji: '🏢', selectors: ['["office"]["office"!="government"]["name"]'] },
            { key: 'government', label: 'Government buildings', emoji: '🏛️', selectors: ['["office"="government"]', '["amenity"~"^(townhall|courthouse|police|post_office)$"]'] },
            { key: 'repair', label: 'Repair shops', emoji: '🛠️', selectors: ['["shop"~"^(car_repair|motorcycle_repair|repair|mobile_phone_repair|computer_repair)$"]', '["craft"~"^(electronics_repair|shoemaker|watchmaker|tailor)$"]'] },
        ],
    },
];

export const findExploreCategory = (key: string | null) => {
    if (!key) return null;
    for (const group of EXPLORE_GROUPS) {
        const category = group.categories.find((item) => item.key === key);
        if (category) return { group, category };
    }
    return null;
};

export interface ExplorePlace {
    id: string;
    name: string;
    lat: number;
    lng: number;
    categoryKey: string;
    address: string;
    openingHours: string | null;
    phone: string | null;
    website: string | null;
    cuisine: string | null;
    osmUrl: string;
}

export interface ExploreBounds {
    south: number;
    west: number;
    north: number;
    east: number;
}

const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
];

/** Largest box we query (about 9 km across). Bigger views are trimmed around their centre. */
const MAX_SPAN_DEGREES = 0.08;
export const MAX_RESULTS = 80;

export const clampBounds = (bounds: ExploreBounds): { bounds: ExploreBounds; trimmed: boolean } => {
    const latSpan = bounds.north - bounds.south;
    const lngSpan = bounds.east - bounds.west;
    if (latSpan <= MAX_SPAN_DEGREES && lngSpan <= MAX_SPAN_DEGREES) return { bounds, trimmed: false };
    const lat = (bounds.north + bounds.south) / 2;
    const lng = (bounds.east + bounds.west) / 2;
    const half = MAX_SPAN_DEGREES / 2;
    return {
        bounds: { south: lat - half, north: lat + half, west: lng - half, east: lng + half },
        trimmed: true,
    };
};

type OverpassElement = {
    type: 'node' | 'way' | 'relation';
    id: number;
    lat?: number;
    lon?: number;
    center?: { lat: number; lon: number };
    tags?: Record<string, string>;
};

const formatAddress = (tags: Record<string, string>) => {
    const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
    return [street, tags['addr:suburb'] || tags['addr:neighbourhood'], tags['addr:city']]
        .filter(Boolean)
        .join(', ');
};

const fetchWithTimeout = async (url: string, body: string, timeoutMs: number) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body,
            signal: controller.signal,
        });
        if (response.status === 429) throw new Error('The map data service is busy. Try again in a few seconds.');
        if (!response.ok) throw new Error('Could not load places right now.');
        return (await response.json()) as { elements?: OverpassElement[] };
    } finally {
        window.clearTimeout(timer);
    }
};

const cache = new Map<string, ExplorePlace[]>();

export const fetchExplorePlaces = async (categoryKey: string, rawBounds: ExploreBounds): Promise<ExplorePlace[]> => {
    const found = findExploreCategory(categoryKey);
    if (!found) return [];
    const { bounds } = clampBounds(rawBounds);
    const bbox = [bounds.south, bounds.west, bounds.north, bounds.east].map((value) => value.toFixed(4)).join(',');
    const cacheKey = `${categoryKey}:${bbox}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const clauses = found.category.selectors
        .flatMap((selector) => [`node${selector}(${bbox});`, `way${selector}(${bbox});`])
        .join('');
    const query = `[out:json][timeout:20];(${clauses});out center tags ${MAX_RESULTS * 2};`;
    const body = new URLSearchParams({ data: query }).toString();

    let lastError: Error | null = null;
    for (const url of OVERPASS_URLS) {
        try {
            const payload = await fetchWithTimeout(url, body, 20000);
            const centerLat = (bounds.north + bounds.south) / 2;
            const centerLng = (bounds.east + bounds.west) / 2;
            const places = (payload.elements || [])
                .map((element): ExplorePlace | null => {
                    const lat = element.lat ?? element.center?.lat;
                    const lng = element.lon ?? element.center?.lon;
                    if (lat == null || lng == null) return null;
                    const tags = element.tags || {};
                    return {
                        id: `${element.type}/${element.id}`,
                        name: (tags.name || tags['name:en'] || tags.brand || '').trim() || found.category.label.replace(/s$/, ''),
                        lat,
                        lng,
                        categoryKey,
                        address: formatAddress(tags),
                        openingHours: tags.opening_hours || null,
                        phone: tags.phone || tags['contact:phone'] || null,
                        website: tags.website || tags['contact:website'] || null,
                        cuisine: tags.cuisine ? tags.cuisine.replace(/;/g, ', ').replace(/_/g, ' ') : null,
                        osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
                    };
                })
                .filter((place): place is ExplorePlace => Boolean(place))
                // Named places first, then nearest to the centre of the view.
                .sort((left, right) => {
                    const leftNamed = left.name !== found.category.label.replace(/s$/, '') ? 0 : 1;
                    const rightNamed = right.name !== found.category.label.replace(/s$/, '') ? 0 : 1;
                    if (leftNamed !== rightNamed) return leftNamed - rightNamed;
                    const leftDistance = (left.lat - centerLat) ** 2 + (left.lng - centerLng) ** 2;
                    const rightDistance = (right.lat - centerLat) ** 2 + (right.lng - centerLng) ** 2;
                    return leftDistance - rightDistance;
                })
                .slice(0, MAX_RESULTS);
            cache.set(cacheKey, places);
            return places;
        } catch (error) {
            lastError = error instanceof Error && error.name !== 'AbortError'
                ? error
                : new Error('Loading places took too long. Zoom in a little and try again.');
        }
    }
    throw lastError || new Error('Could not load places right now.');
};
