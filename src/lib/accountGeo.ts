import type { AdminAccountLocationRecord } from './destinations';
import { isProviderRole, normalizeRoleValue } from './platform';

export type AccountRoleGroup = 'tourist' | 'provider' | 'admin' | 'other';

export interface AccountLocationGroup {
    key: string;
    label: string;
    city: string | null;
    country: string;
    lat: number;
    lng: number;
    count: number;
    dominantRole: AccountRoleGroup;
    roleCounts: Record<AccountRoleGroup, number>;
    accounts: AdminAccountLocationRecord[];
}

export interface AccountLocationResolution {
    locations: AccountLocationGroup[];
    unmapped: AdminAccountLocationRecord[];
}

type Coordinates = { lat: number; lng: number };

const isFiniteCoordinate = (value: unknown): value is number => (
    typeof value === 'number'
    && Number.isFinite(value)
);

const normalizeGeoKey = (value: string | null | undefined) => (
    (value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
);

const COUNTRY_ALIASES: Record<string, string> = {
    bharat: 'india',
    england: 'united_kingdom',
    republic_of_india: 'india',
    scotland: 'united_kingdom',
    u_k: 'united_kingdom',
    usa: 'united_states',
    us: 'united_states',
    u_s_a: 'united_states',
    uk: 'united_kingdom',
    uae: 'united_arab_emirates',
    united_states_of_america: 'united_states',
    wales: 'united_kingdom',
};

const COUNTRY_CENTROIDS: Record<string, Coordinates> = {
    argentina: { lat: -38.4161, lng: -63.6167 },
    australia: { lat: -25.2744, lng: 133.7751 },
    austria: { lat: 47.5162, lng: 14.5501 },
    bahrain: { lat: 26.0667, lng: 50.5577 },
    bangladesh: { lat: 23.685, lng: 90.3563 },
    belgium: { lat: 50.5039, lng: 4.4699 },
    bhutan: { lat: 27.5142, lng: 90.4336 },
    brazil: { lat: -14.235, lng: -51.9253 },
    canada: { lat: 56.1304, lng: -106.3468 },
    chile: { lat: -35.6751, lng: -71.543 },
    china: { lat: 35.8617, lng: 104.1954 },
    colombia: { lat: 4.5709, lng: -74.2973 },
    czech_republic: { lat: 49.8175, lng: 15.473 },
    denmark: { lat: 56.2639, lng: 9.5018 },
    egypt: { lat: 26.8206, lng: 30.8025 },
    finland: { lat: 61.9241, lng: 25.7482 },
    france: { lat: 46.2276, lng: 2.2137 },
    germany: { lat: 51.1657, lng: 10.4515 },
    greece: { lat: 39.0742, lng: 21.8243 },
    hungary: { lat: 47.1625, lng: 19.5033 },
    india: { lat: 20.5937, lng: 78.9629 },
    indonesia: { lat: -0.7893, lng: 113.9213 },
    ireland: { lat: 53.1424, lng: -7.6921 },
    italy: { lat: 41.8719, lng: 12.5674 },
    japan: { lat: 36.2048, lng: 138.2529 },
    kenya: { lat: -0.0236, lng: 37.9062 },
    kuwait: { lat: 29.3117, lng: 47.4818 },
    malaysia: { lat: 4.2105, lng: 101.9758 },
    mexico: { lat: 23.6345, lng: -102.5528 },
    morocco: { lat: 31.7917, lng: -7.0926 },
    nepal: { lat: 28.3949, lng: 84.124 },
    netherlands: { lat: 52.1326, lng: 5.2913 },
    new_zealand: { lat: -40.9006, lng: 174.886 },
    nigeria: { lat: 9.082, lng: 8.6753 },
    norway: { lat: 60.472, lng: 8.4689 },
    oman: { lat: 21.4735, lng: 55.9754 },
    pakistan: { lat: 30.3753, lng: 69.3451 },
    peru: { lat: -9.19, lng: -75.0152 },
    philippines: { lat: 12.8797, lng: 121.774 },
    poland: { lat: 51.9194, lng: 19.1451 },
    portugal: { lat: 39.3999, lng: -8.2245 },
    qatar: { lat: 25.3548, lng: 51.1839 },
    romania: { lat: 45.9432, lng: 24.9668 },
    saudi_arabia: { lat: 23.8859, lng: 45.0792 },
    singapore: { lat: 1.3521, lng: 103.8198 },
    south_africa: { lat: -30.5595, lng: 22.9375 },
    south_korea: { lat: 35.9078, lng: 127.7669 },
    spain: { lat: 40.4637, lng: -3.7492 },
    sri_lanka: { lat: 7.8731, lng: 80.7718 },
    sweden: { lat: 60.1282, lng: 18.6435 },
    switzerland: { lat: 46.8182, lng: 8.2275 },
    thailand: { lat: 15.87, lng: 100.9925 },
    turkey: { lat: 38.9637, lng: 35.2433 },
    united_arab_emirates: { lat: 23.4241, lng: 53.8478 },
    united_kingdom: { lat: 55.3781, lng: -3.436 },
    united_states: { lat: 37.0902, lng: -95.7129 },
    vietnam: { lat: 14.0583, lng: 108.2772 },
};

const CITY_CENTROIDS: Record<string, Coordinates> = {
    abu_dhabi_united_arab_emirates: { lat: 24.4539, lng: 54.3773 },
    ahmedabad_india: { lat: 23.0225, lng: 72.5714 },
    amritsar_india: { lat: 31.634, lng: 74.8723 },
    amsterdam_netherlands: { lat: 52.3676, lng: 4.9041 },
    athens_greece: { lat: 37.9838, lng: 23.7275 },
    auckland_new_zealand: { lat: -36.8509, lng: 174.7645 },
    austin_united_states: { lat: 30.2672, lng: -97.7431 },
    bangalore_india: { lat: 12.9716, lng: 77.5946 },
    bangkok_thailand: { lat: 13.7563, lng: 100.5018 },
    barcelona_spain: { lat: 41.3874, lng: 2.1686 },
    berlin_germany: { lat: 52.52, lng: 13.405 },
    bengaluru_india: { lat: 12.9716, lng: 77.5946 },
    boston_united_states: { lat: 42.3601, lng: -71.0589 },
    buenos_aires_argentina: { lat: -34.6037, lng: -58.3816 },
    cape_town_south_africa: { lat: -33.9249, lng: 18.4241 },
    chicago_united_states: { lat: 41.8781, lng: -87.6298 },
    chennai_india: { lat: 13.0827, lng: 80.2707 },
    coimbatore_india: { lat: 11.0168, lng: 76.9558 },
    dallas_united_states: { lat: 32.7767, lng: -96.797 },
    darjeeling_india: { lat: 27.036, lng: 88.2627 },
    dehradun_india: { lat: 30.3165, lng: 78.0322 },
    delhi_india: { lat: 28.6139, lng: 77.209 },
    doha_qatar: { lat: 25.2854, lng: 51.531 },
    dubai_united_arab_emirates: { lat: 25.2048, lng: 55.2708 },
    edinburgh_united_kingdom: { lat: 55.9533, lng: -3.1883 },
    florence_italy: { lat: 43.7696, lng: 11.2558 },
    gangtok_india: { lat: 27.3389, lng: 88.6065 },
    goa_india: { lat: 15.2993, lng: 74.124 },
    hong_kong_china: { lat: 22.3193, lng: 114.1694 },
    gurugram_india: { lat: 28.4595, lng: 77.0266 },
    gurgaon_india: { lat: 28.4595, lng: 77.0266 },
    hyderabad_india: { lat: 17.385, lng: 78.4867 },
    istanbul_turkey: { lat: 41.0082, lng: 28.9784 },
    jaipur_india: { lat: 26.9124, lng: 75.7873 },
    jeddah_saudi_arabia: { lat: 21.5433, lng: 39.1728 },
    johannesburg_south_africa: { lat: -26.2041, lng: 28.0473 },
    jodhpur_india: { lat: 26.2389, lng: 73.0243 },
    kochi_india: { lat: 9.9312, lng: 76.2673 },
    kolkata_india: { lat: 22.5726, lng: 88.3639 },
    kuala_lumpur_malaysia: { lat: 3.139, lng: 101.6869 },
    las_vegas_united_states: { lat: 36.1699, lng: -115.1398 },
    leh_india: { lat: 34.1526, lng: 77.5771 },
    lima_peru: { lat: -12.0464, lng: -77.0428 },
    london_united_kingdom: { lat: 51.5072, lng: -0.1276 },
    los_angeles_united_states: { lat: 34.0549, lng: -118.2426 },
    lucknow_india: { lat: 26.8467, lng: 80.9462 },
    madrid_spain: { lat: 40.4168, lng: -3.7038 },
    manali_india: { lat: 32.2432, lng: 77.1892 },
    marrakesh_morocco: { lat: 31.6295, lng: -7.9811 },
    mexico_city_mexico: { lat: 19.4326, lng: -99.1332 },
    miami_united_states: { lat: 25.7617, lng: -80.1918 },
    milan_italy: { lat: 45.4642, lng: 9.19 },
    mumbai_india: { lat: 19.076, lng: 72.8777 },
    mysuru_india: { lat: 12.2958, lng: 76.6394 },
    nairobi_kenya: { lat: -1.2921, lng: 36.8219 },
    new_delhi_india: { lat: 28.6139, lng: 77.209 },
    new_york_united_states: { lat: 40.7128, lng: -74.006 },
    ooty_india: { lat: 11.4064, lng: 76.6932 },
    paris_france: { lat: 48.8566, lng: 2.3522 },
    prague_czech_republic: { lat: 50.0755, lng: 14.4378 },
    pune_india: { lat: 18.5204, lng: 73.8567 },
    rishikesh_india: { lat: 30.0869, lng: 78.2676 },
    rio_de_janeiro_brazil: { lat: -22.9068, lng: -43.1729 },
    rome_italy: { lat: 41.9028, lng: 12.4964 },
    san_francisco_united_states: { lat: 37.7749, lng: -122.4194 },
    sao_paulo_brazil: { lat: -23.5558, lng: -46.6396 },
    seattle_united_states: { lat: 47.6062, lng: -122.3321 },
    seoul_south_korea: { lat: 37.5665, lng: 126.978 },
    shimla_india: { lat: 31.1048, lng: 77.1734 },
    singapore_singapore: { lat: 1.3521, lng: 103.8198 },
    santiago_chile: { lat: -33.4489, lng: -70.6693 },
    srinagar_india: { lat: 34.0837, lng: 74.7973 },
    sydney_australia: { lat: -33.8688, lng: 151.2093 },
    taipei_taiwan: { lat: 25.033, lng: 121.5654 },
    tokyo_japan: { lat: 35.6762, lng: 139.6503 },
    toronto_canada: { lat: 43.6532, lng: -79.3832 },
    trivandrum_india: { lat: 8.5241, lng: 76.9366 },
    udaipur_india: { lat: 24.5854, lng: 73.7125 },
    vancouver_canada: { lat: 49.2827, lng: -123.1207 },
    varanasi_india: { lat: 25.3176, lng: 82.9739 },
    vienna_austria: { lat: 48.2082, lng: 16.3738 },
    washington_dc_united_states: { lat: 38.9072, lng: -77.0369 },
    zurich_switzerland: { lat: 47.3769, lng: 8.5417 },
};

const emptyRoleCounts = (): Record<AccountRoleGroup, number> => ({
    tourist: 0,
    provider: 0,
    admin: 0,
    other: 0,
});

export const getAccountRoleGroup = (role?: string | null): AccountRoleGroup => {
    const normalizedRole = normalizeRoleValue(role);
    if (normalizedRole === 'tourist') return 'tourist';
    if (normalizedRole === 'admin') return 'admin';
    if (isProviderRole(normalizedRole)) return 'provider';
    return 'other';
};

const resolveCountryKey = (country: string) => {
    const normalized = normalizeGeoKey(country);
    return COUNTRY_ALIASES[normalized] || normalized;
};

export const resolveProfileCoordinates = (input: {
    city?: string | null;
    country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
}): Coordinates | null => {
    if (isFiniteCoordinate(input.latitude) && isFiniteCoordinate(input.longitude)) {
        return { lat: input.latitude, lng: input.longitude };
    }

    const city = input.city;
    const country = input.country;
    const normalizedCountry = resolveCountryKey(country || '');
    if (!normalizedCountry) return null;

    const normalizedCity = normalizeGeoKey(city || '');
    if (normalizedCity) {
        const cityKey = `${normalizedCity}_${normalizedCountry}`;
        const cityCoordinates = CITY_CENTROIDS[cityKey];
        if (cityCoordinates) return cityCoordinates;
    }

    return COUNTRY_CENTROIDS[normalizedCountry] || null;
};

export const resolveAdminAccountLocations = (
    accounts: AdminAccountLocationRecord[]
): AccountLocationResolution => {
    const grouped = new Map<string, AccountLocationGroup>();
    const unmapped: AdminAccountLocationRecord[] = [];

    for (const account of accounts) {
        const country = (account.country || '').trim();
        const city = (account.city || '').trim() || null;
        const coords = resolveProfileCoordinates({
            city,
            country,
            latitude: account.latitude,
            longitude: account.longitude,
        });

        if (!coords || !country) {
            unmapped.push(account);
            continue;
        }

        const label = city ? `${city}, ${country}` : country;
        const key = city
            ? `${normalizeGeoKey(city)}_${resolveCountryKey(country)}`
            : resolveCountryKey(country);

        const roleGroup = getAccountRoleGroup(account.role);
        const existing = grouped.get(key);

        if (existing) {
            existing.accounts.push(account);
            existing.count += 1;
            existing.roleCounts[roleGroup] += 1;
            continue;
        }

        const roleCounts = emptyRoleCounts();
        roleCounts[roleGroup] = 1;

        grouped.set(key, {
            key,
            label,
            city,
            country,
            lat: coords.lat,
            lng: coords.lng,
            count: 1,
            dominantRole: roleGroup,
            roleCounts,
            accounts: [account],
        });
    }

    const locations = Array.from(grouped.values())
        .map((group) => {
            const dominantRole = (Object.entries(group.roleCounts)
                .sort((left, right) => right[1] - left[1])[0]?.[0] || 'other') as AccountRoleGroup;

            return {
                ...group,
                dominantRole,
                accounts: [...group.accounts].sort((left, right) => {
                    const leftLabel = `${left.full_name || ''} ${left.email || ''}`.trim().toLowerCase();
                    const rightLabel = `${right.full_name || ''} ${right.email || ''}`.trim().toLowerCase();
                    return leftLabel.localeCompare(rightLabel);
                }),
            };
        })
        .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));

    return { locations, unmapped };
};
