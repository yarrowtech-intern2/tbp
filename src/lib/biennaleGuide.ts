export type BiennaleEventKey = 'iaadb' | 'bengal' | 'ladakh' | 'bihar';

export interface BiennaleEvent {
    key: BiennaleEventKey;
    name: string;
    shortName: string;
    city: string;
}

export const BIENNALE_EVENTS: BiennaleEvent[] = [
    { key: 'iaadb', name: 'India Art, Architecture & Design Biennale (IAADB)', shortName: 'IAADB, Delhi', city: 'New Delhi' },
    { key: 'bengal', name: 'Bengal Biennale', shortName: 'Bengal Biennale', city: 'Kolkata and Santiniketan' },
    { key: 'ladakh', name: 'sā Ladakh Biennale', shortName: 'sā Ladakh Biennale', city: 'Leh, Ladakh' },
    { key: 'bihar', name: 'Bihar Museum Biennale', shortName: 'Bihar Museum Biennale', city: 'Patna' },
];

export const getBiennaleEvent = (key: BiennaleEventKey) => BIENNALE_EVENTS.find((item) => item.key === key) || BIENNALE_EVENTS[0];

export interface BiennaleSite {
    id: string;
    name: string;
    address: string;
    eventKey: BiennaleEventKey;
    lat: number;
    lng: number;
    highlight: string;
}

/**
 * Venues for each biennale. Coordinates are approximate (landmark level, from general map knowledge) and should
 * be checked on the ground before a visit; several of these sites are spread across very large distances, so a
 * "route" through them is a drive between cities rather than a single walk.
 */
export const BIENNALE_SITES: BiennaleSite[] = [
    // India Art, Architecture & Design Biennale (IAADB) -- New Delhi
    { id: 'iaadb-red-fort', name: 'Red Fort (Lal Qila)', address: 'Netaji Subhash Marg, Chandni Chowk, New Delhi, Delhi 110006', eventKey: 'iaadb', lat: 28.6562, lng: 77.2410, highlight: 'The Mughal-era fort and UNESCO World Heritage site anchoring the IAADB in Old Delhi.' },
    { id: 'iaadb-purana-qila', name: 'Purana Qila (Sher Shah Darwaza)', address: 'Mathura Rd, Near Delhi Zoo, New Delhi, Delhi 110003', eventKey: 'iaadb', lat: 28.6093, lng: 77.2436, highlight: 'One of the oldest forts in Delhi, with installations set among its ancient walls and gateways.' },
    { id: 'iaadb-national-museum', name: 'National Museum', address: 'Janpath, near India Gate, New Delhi, Delhi 110011', eventKey: 'iaadb', lat: 28.6118, lng: 77.2217, highlight: 'India\'s largest museum of art and antiquities, hosting a major strand of the Biennale\'s design showcase.' },
    { id: 'iaadb-ngma', name: 'National Gallery of Modern Art (NGMA)', address: 'Jaipur House, Shershah Rd, near India Gate, New Delhi, Delhi 110003', eventKey: 'iaadb', lat: 28.6118, lng: 77.2358, highlight: 'A former royal residence turned modern art gallery, close to the National Museum stop.' },
    { id: 'iaadb-qutub-minar', name: 'Qutub Minar Complex', address: 'Seth Sarai, Mehrauli, New Delhi, Delhi 110030', eventKey: 'iaadb', lat: 28.5245, lng: 77.1855, highlight: 'The soaring 12th-century minaret and surrounding ruins, the southernmost IAADB venue.' },

    // Bengal Biennale -- Kolkata and Santiniketan
    { id: 'bengal-alipore-museum', name: 'Alipore Museum (Alipore Independence Museum)', address: '17, Judges Court Rd, Alipore, Kolkata, West Bengal 700027', eventKey: 'bengal', lat: 22.5280, lng: 88.3333, highlight: 'The restored Alipore Jail, now a museum on the independence movement, hosting Biennale installations.' },
    { id: 'bengal-indian-museum', name: 'Indian Museum', address: '27, Jawaharlal Nehru Rd, Fire Brigade Head Quarter, New Market Area, Dharmatala, Kolkata, West Bengal 700016', eventKey: 'bengal', lat: 22.5579, lng: 88.3511, highlight: 'South Asia\'s oldest and largest museum, a central Kolkata venue for the Biennale.' },
    { id: 'bengal-kcc', name: 'Kolkata Centre for Creativity (KCC)', address: '777, Anandapur Rd, EM Bypass, Kolkata, West Bengal 700107', eventKey: 'bengal', lat: 22.5103, lng: 88.4028, highlight: 'A purpose-built arts centre with galleries, a theatre and an amphitheatre on the EM Bypass.' },
    { id: 'bengal-lalit-kala-akademi', name: 'Lalit Kala Akademi (Regional Centre)', address: '85, AJC Bose Rd, Maula Ali, Taltala, Kolkata, West Bengal 700014', eventKey: 'bengal', lat: 22.5469, lng: 88.3600, highlight: 'The regional centre of India\'s national art academy, close to Park Street.' },
    { id: 'bengal-tri-art-culture', name: 'TRI Art & Culture / Arts Acre', address: 'Plot No III F/30, Action Area III, New Town, Kolkata, West Bengal 700135', eventKey: 'bengal', lat: 22.6245, lng: 88.4798, highlight: 'An art foundation and residency space in New Town, on the city\'s eastern edge.' },
    { id: 'bengal-siddhi-muni', name: 'Siddhi & Muni Art Studios', address: 'Stephen Court, Park Street, Kolkata, West Bengal 700016', eventKey: 'bengal', lat: 22.5524, lng: 88.3519, highlight: 'Artist studios on Park Street, in the heart of central Kolkata.' },
    { id: 'bengal-nandan-museum', name: 'Nandan Museum & Somnath Hore Studio', address: 'Kala Bhavana, Visva-Bharati University, Santiniketan, West Bengal 731235', eventKey: 'bengal', lat: 23.6775, lng: 87.6835, highlight: 'Tagore\'s art school at Visva-Bharati, roughly three hours from Kolkata, with the sculptor Somnath Hore\'s studio.' },
    { id: 'bengal-arthshila', name: 'Arthshila Santiniketan', address: 'Shyamali Lane, Santiniketan, West Bengal 731235', eventKey: 'bengal', lat: 23.6760, lng: 87.6850, highlight: 'A Santiniketan arts space a short walk from Kala Bhavana.' },
    { id: 'bengal-krittika-ssvad', name: 'Krittika Arts Space & SSVAD', address: 'Santiniketan, West Bengal 731235', eventKey: 'bengal', lat: 23.6750, lng: 87.6870, highlight: 'An arts space and design school rounding out the Santiniketan cluster.' },

    // sā Ladakh Biennale -- open-air sites along the high-altitude transit route
    { id: 'ladakh-old-leh', name: 'Old Leh Town Sites', address: 'Leh, Ladakh 194101', eventKey: 'ladakh', lat: 34.1642, lng: 77.5848, highlight: 'Site-specific installations through the lanes and heritage structures of old Leh.' },
    { id: 'ladakh-basgo', name: 'Basgo Monastery & Fortress Ruins', address: 'Basgo, Ladakh 194101', eventKey: 'ladakh', lat: 34.2214, lng: 77.3144, highlight: 'Ruined fortress and monastery above the Indus valley, west of Leh.' },
    { id: 'ladakh-likir', name: 'Likir Village', address: 'Likir, Ladakh 194101', eventKey: 'ladakh', lat: 34.2965, lng: 77.2435, highlight: 'A monastery village on the way toward Lamayuru.' },
    { id: 'ladakh-lamayuru', name: 'Lamayuru (Moonland area)', address: 'Leh-Kargil Road, Lamayuru, Ladakh 194106', eventKey: 'ladakh', lat: 34.2878, lng: 76.7805, highlight: 'Dramatic eroded "moonland" terrain around one of Ladakh\'s oldest monasteries.' },
    { id: 'ladakh-transit-sites', name: 'Transit Sites: Nurla, Henasku, Mulbekh & Hunderman', address: 'Leh-Kargil Road, Ladakh', eventKey: 'ladakh', lat: 34.3167, lng: 76.5300, highlight: 'Smaller, scattered installations across Nurla, Henasku, Mulbekh and Hunderman along the Leh-Kargil route.' },

    // Bihar Museum Biennale -- Patna
    { id: 'bihar-museum', name: 'Bihar Museum', address: 'Jawaharlal Nehru Marg, Bailey Rd, Patna, Bihar 800001', eventKey: 'bihar', lat: 25.6127, lng: 85.1325, highlight: 'A major modern museum building on Bailey Road, the main Biennale venue in Patna.' },
    { id: 'bihar-patna-museum', name: 'Patna Museum (Temporary Exhibition Gallery)', address: 'Budh Marg, Patna, Bihar 800001', eventKey: 'bihar', lat: 25.6090, lng: 85.1450, highlight: 'The older Patna Museum on Budh Marg, hosting the Biennale\'s temporary exhibitions.' },
];

export const getBiennaleSite = (id: string) => BIENNALE_SITES.find((item) => item.id === id) || null;

export const sitesForEvent = (eventKey: BiennaleEventKey) => BIENNALE_SITES.filter((item) => item.eventKey === eventKey);

// ---------------------------------------------------------------- site plan

const PLAN_STORAGE_KEY = 'tbp:biennale-plan:v1';

const cleanPlan = (ids: unknown): string[] => (
    Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && Boolean(getBiennaleSite(id))) : []
);

/** The Biennale plan is kept in this browser only; there is no account sync. */
export const loadBiennalePlan = (): string[] => {
    try {
        return cleanPlan(JSON.parse(window.localStorage.getItem(PLAN_STORAGE_KEY) || '[]'));
    } catch {
        return [];
    }
};

export const saveBiennalePlan = (ids: string[]): void => {
    try {
        window.localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(ids));
    } catch {
        // Storage unavailable; the plan just won't survive a reload.
    }
};
