import type { Landmark, LandmarkCategoryKey, LandmarkZone } from './kolkataLandmarks';

export interface Restaurant {
    /** Number shown on the downloaded map and in its legend. */
    number: number;
    name: string;
    zone: LandmarkZone;
    lat: number;
    lng: number;
    cuisine: string;
    category: LandmarkCategoryKey;
}

/**
 * Restaurants supplied by the team. Coordinates and zones are used exactly as supplied: the "West" ones are in
 * Kidderpore and Behala (south-west Kolkata), not on the Howrah side.
 */
export const RESTAURANTS: Restaurant[] = [
    { number: 1, name: 'Mitra Cafe, Sovabazar', zone: 'North', lat: 22.6048, lng: 88.3715, cuisine: 'Bengali / Heritage', category: 'rest-bengali' },
    { number: 2, name: 'Golbari, Shyambazar', zone: 'North', lat: 22.6035, lng: 88.373, cuisine: 'Bengali', category: 'rest-bengali' },
    { number: 3, name: 'Putiram Sweets', zone: 'North', lat: 22.5748, lng: 88.3625, cuisine: 'Bengali / Sweets', category: 'rest-sweets' },
    { number: 4, name: 'Dhiren Cabin', zone: 'North', lat: 22.601, lng: 88.3695, cuisine: 'Cabin', category: 'rest-cabin' },
    { number: 5, name: 'Basanta Cabin', zone: 'North', lat: 22.5765, lng: 88.3645, cuisine: 'Cabin', category: 'rest-cabin' },
    { number: 6, name: '6 Ballygunge Place', zone: 'South', lat: 22.52764, lng: 88.36855, cuisine: 'Bengali', category: 'rest-bengali' },
    { number: 7, name: 'Spice Kraft', zone: 'South', lat: 22.5205, lng: 88.3505, cuisine: 'Indian', category: 'rest-indian' },
    { number: 8, name: 'Tandoor Park', zone: 'South', lat: 22.5105, lng: 88.365, cuisine: 'North Indian', category: 'rest-indian' },
    { number: 9, name: 'Oudh 1590', zone: 'South', lat: 22.5305, lng: 88.351, cuisine: 'Awadhi', category: 'rest-indian' },
    { number: 10, name: 'The Saffron Tree', zone: 'South', lat: 22.52, lng: 88.348, cuisine: 'Mughlai', category: 'rest-indian' },
    { number: 11, name: 'Avartana, ITC Royal Bengal', zone: 'East', lat: 22.54436, lng: 88.39809, cuisine: 'South Indian / Fine Dining', category: 'food' },
    { number: 12, name: 'Golden Joy', zone: 'East', lat: 22.5375, lng: 88.388, cuisine: 'Chinese', category: 'rest-chinese' },
    { number: 13, name: 'Big Boss, Tangra', zone: 'East', lat: 22.543, lng: 88.386, cuisine: 'Chinese', category: 'rest-chinese' },
    { number: 14, name: 'Sonar Tori, Salt Lake', zone: 'East', lat: 22.5865, lng: 88.4125, cuisine: 'Bengali', category: 'rest-bengali' },
    { number: 15, name: 'Oudh 1590, Salt Lake', zone: 'East', lat: 22.587, lng: 88.407, cuisine: 'Awadhi', category: 'rest-indian' },
    { number: 16, name: 'India Restaurant, Kidderpore', zone: 'West', lat: 22.5354, lng: 88.3206, cuisine: 'Mughlai', category: 'rest-indian' },
    { number: 17, name: 'Quince', zone: 'West', lat: 22.505, lng: 88.322, cuisine: 'Multi-cuisine', category: 'food' },
    { number: 18, name: 'Chowman, Behala', zone: 'West', lat: 22.495, lng: 88.31, cuisine: 'Chinese', category: 'rest-chinese' },
    { number: 19, name: 'Rang De Basanti Dhaba', zone: 'West', lat: 22.493, lng: 88.306, cuisine: 'North Indian', category: 'rest-indian' },
    { number: 20, name: 'Oh! Calcutta', zone: 'West', lat: 22.5085, lng: 88.3515, cuisine: 'Bengali', category: 'rest-bengali' },
];

/** The same restaurants in the shape of the other famous places, so they filter, search and open like them. */
export const RESTAURANT_LANDMARKS: Landmark[] = RESTAURANTS.map((item) => ({
    id: `restaurant-${item.number}`,
    name: item.name,
    zone: item.zone,
    category: item.category,
    lat: item.lat,
    lng: item.lng,
    summary: `Cuisine: ${item.cuisine}.`,
}));
