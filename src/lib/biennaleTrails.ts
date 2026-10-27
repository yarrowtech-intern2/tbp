import { formatTrailDuration } from './pujaTrails';
import { getBiennaleSite, type BiennaleEventKey, type BiennaleSite } from './biennaleGuide';

export interface BiennaleTrailStop {
    siteId: string;
    /** One practical line shown under the site's own highlight. */
    tip: string;
}

export interface BiennaleTrail {
    id: string;
    title: string;
    eventKey: BiennaleEventKey;
    /** Short line under the title on the card. */
    tagline: string;
    overview: string;
    bestTime: string;
    gettingThere: string;
    stops: BiennaleTrailStop[];
}

/** One ready-made route per Biennale, covering every listed venue in a sensible visiting order. */
export const BIENNALE_TRAILS: BiennaleTrail[] = [
    {
        id: 'iaadb-delhi',
        title: 'IAADB Delhi circuit',
        eventKey: 'iaadb',
        tagline: 'Old Delhi forts to India Gate and Mehrauli',
        overview: 'A city-wide drive through the India Art, Architecture & Design Biennale: the Mughal forts of Old Delhi, the museums around India Gate, and the Qutub complex in the south.',
        bestTime: 'Visit in the morning or late afternoon; midday sun is harsh at the open-air fort sites.',
        gettingThere: 'Spread across Delhi, so this is a half-day drive or cab circuit rather than a walk.',
        stops: [
            { siteId: 'iaadb-red-fort', tip: 'Start in Old Delhi; combine with a walk through Chandni Chowk.' },
            { siteId: 'iaadb-purana-qila', tip: 'A short drive south; pair with the nearby Delhi Zoo if time allows.' },
            { siteId: 'iaadb-national-museum', tip: 'Near India Gate; allow at least an hour inside.' },
            { siteId: 'iaadb-ngma', tip: 'A few minutes\' walk from the National Museum.' },
            { siteId: 'iaadb-qutub-minar', tip: 'Finish here; it is the furthest stop, in Mehrauli to the south.' },
        ],
    },
    {
        id: 'bengal-kolkata',
        title: 'Bengal Biennale: Kolkata venues',
        eventKey: 'bengal',
        tagline: 'Central Kolkata to the EM Bypass and New Town',
        overview: 'The Kolkata leg of the Bengal Biennale: museums and galleries in the centre of the city, plus the newer arts spaces toward the eastern edge of town.',
        bestTime: 'Weekday mornings are quietest at the Indian Museum and Alipore Museum.',
        gettingThere: 'Best done by cab or app taxi between stops; Park Street and the Indian Museum are an easy walk apart.',
        stops: [
            { siteId: 'bengal-alipore-museum', tip: 'Start at the restored Alipore Jail.' },
            { siteId: 'bengal-indian-museum', tip: 'Allow a couple of hours for South Asia\'s oldest museum.' },
            { siteId: 'bengal-siddhi-muni', tip: 'A short ride away on Park Street.' },
            { siteId: 'bengal-lalit-kala-akademi', tip: 'Close to Park Street, on AJC Bose Road.' },
            { siteId: 'bengal-kcc', tip: 'Further out on the EM Bypass; a good late-afternoon stop.' },
            { siteId: 'bengal-tri-art-culture', tip: 'Finish in New Town, on the eastern edge of the city.' },
        ],
    },
    {
        id: 'bengal-santiniketan',
        title: 'Bengal Biennale: Santiniketan venues',
        eventKey: 'bengal',
        tagline: "Tagore's art school, about three hours from Kolkata",
        overview: 'The Santiniketan leg of the Bengal Biennale, centred on Visva-Bharati\'s Kala Bhavana and the arts spaces nearby. Best treated as its own day trip or overnight stay.',
        bestTime: 'A full day; many travel from Kolkata by an early morning train or car.',
        gettingThere: 'About three hours by road from Kolkata, or take a train to Bolpur and a short rickshaw ride into Santiniketan.',
        stops: [
            { siteId: 'bengal-nandan-museum', tip: 'Start at Kala Bhavana, Tagore\'s art school within Visva-Bharati.' },
            { siteId: 'bengal-arthshila', tip: 'A short walk away on Shyamali Lane.' },
            { siteId: 'bengal-krittika-ssvad', tip: 'Finish at this arts space and design school nearby.' },
        ],
    },
    {
        id: 'ladakh-sa-biennale',
        title: 'sā Ladakh Biennale route',
        eventKey: 'ladakh',
        tagline: 'Leh to Lamayuru along the Leh-Kargil road',
        overview: 'Open-air, site-specific installations along the high-altitude Leh-Kargil route: old Leh town, the Basgo and Likir monastery villages, and the Lamayuru "moonland", with smaller stops at Nurla, Henasku, Mulbekh and Hunderman.',
        bestTime: 'A full day by road; allow time to acclimatise to the altitude in Leh first.',
        gettingThere: 'By car or shared taxi along the Leh-Kargil highway; distances between stops are large.',
        stops: [
            { siteId: 'ladakh-old-leh', tip: 'Start in Leh; explore the old town on foot before setting out.' },
            { siteId: 'ladakh-basgo', tip: 'West of Leh, above the Indus valley.' },
            { siteId: 'ladakh-likir', tip: 'A short drive further along the same road.' },
            { siteId: 'ladakh-lamayuru', tip: 'The famous "moonland" terrain, around one of Ladakh\'s oldest monasteries.' },
            { siteId: 'ladakh-transit-sites', tip: 'Smaller installations are scattered at Nurla, Henasku, Mulbekh and Hunderman along the way.' },
        ],
    },
    {
        id: 'bihar-patna',
        title: 'Bihar Museum Biennale: Patna',
        eventKey: 'bihar',
        tagline: 'Bihar Museum to the older Patna Museum',
        overview: 'Both Patna venues of the Bihar Museum Biennale: the modern Bihar Museum on Bailey Road, and the older Patna Museum on Budh Marg.',
        bestTime: 'Either museum is comfortable any time during opening hours; avoid Mondays, when many museums close.',
        gettingThere: 'A short cab ride apart, both within central Patna.',
        stops: [
            { siteId: 'bihar-museum', tip: 'Start at the newer Bihar Museum on Bailey Road.' },
            { siteId: 'bihar-patna-museum', tip: 'Finish at the older Patna Museum on Budh Marg.' },
        ],
    },
];

export interface ResolvedBiennaleTrail extends BiennaleTrail {
    sites: Array<{ site: BiennaleSite; tip: string }>;
    /** Straight-line length between stops, scaled up a little for real roads. */
    distanceKm: number;
    /** Driving time at a relaxed pace plus time spent at each site, in minutes. */
    minutes: number;
}

const toRad = (value: number) => (value * Math.PI) / 180;

const haversineKm = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
};

const ROAD_FACTOR = 1.3;
const DRIVE_KMH = 40;
const MINUTES_PER_SITE = 45;

export const resolveBiennaleTrail = (trail: BiennaleTrail): ResolvedBiennaleTrail => {
    const sites = trail.stops
        .map((stop) => ({ site: getBiennaleSite(stop.siteId), tip: stop.tip }))
        .filter((item): item is { site: BiennaleSite; tip: string } => Boolean(item.site));

    let distanceKm = 0;
    for (let i = 1; i < sites.length; i += 1) {
        distanceKm += haversineKm(sites[i - 1].site, sites[i].site) * ROAD_FACTOR;
    }
    const minutes = Math.round((distanceKm / DRIVE_KMH) * 60 + sites.length * MINUTES_PER_SITE);
    return { ...trail, sites, distanceKm, minutes };
};

export { formatTrailDuration };

export const trailsForEvent = (eventKey: BiennaleEventKey) => BIENNALE_TRAILS.filter((item) => item.eventKey === eventKey);
