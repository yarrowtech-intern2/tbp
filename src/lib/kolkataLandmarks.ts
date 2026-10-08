import { RESTAURANT_LANDMARKS } from './kolkataRestaurants';

/**
 * Famous places across Kolkata, shown on /map as emoji markers grouped by category.
 *
 * The restaurants (the 'rest-*' categories and a few 'food' ones) are listed in kolkataRestaurants.ts and were
 * supplied by the team; everything else below was looked up as described next.
 *
 * Coordinates were looked up in OpenStreetMap (Nominatim) and cross-checked against the expected position of
 * each place; places without a reliable match were left out rather than guessed. OpenStreetMap data is
 * © OpenStreetMap contributors (ODbL). Zones are loose city quarters: Central covers the Maidan, Esplanade,
 * BBD Bagh, Park Street and New Market; West is the Howrah side of the Hooghly.
 */

export type LandmarkZone = 'North' | 'Central' | 'South' | 'East' | 'West';

export type LandmarkCategoryKey =
    | 'temples' | 'mosques' | 'churches' | 'heritage' | 'museums' | 'art' | 'theatres' | 'parks' | 'waterfront'
    | 'bridges' | 'markets' | 'books' | 'food' | 'stadiums' | 'education' | 'transport' | 'fun' | 'hotels'
    | 'rest-bengali' | 'rest-indian' | 'rest-chinese' | 'rest-sweets' | 'rest-cabin';

export interface LandmarkCategory {
    key: LandmarkCategoryKey;
    label: string;
    emoji: string;
    color: string;
}

export interface Landmark {
    id: string;
    name: string;
    zone: LandmarkZone;
    category: LandmarkCategoryKey;
    lat: number;
    lng: number;
    summary: string;
}

export const LANDMARK_ZONES: LandmarkZone[] = ['North', 'Central', 'South', 'East', 'West'];

export const LANDMARK_CATEGORIES: LandmarkCategory[] = [
    { key: 'temples', label: 'Temples', emoji: '🛕', color: '#fb923c' },
    { key: 'mosques', label: 'Mosques', emoji: '🕌', color: '#34d399' },
    { key: 'churches', label: 'Churches', emoji: '⛪', color: '#93c5fd' },
    { key: 'heritage', label: 'Heritage', emoji: '🏰', color: '#fbbf24' },
    { key: 'museums', label: 'Museums', emoji: '🏛️', color: '#5eead4' },
    { key: 'art', label: 'Art & culture', emoji: '🎨', color: '#e879f9' },
    { key: 'theatres', label: 'Theatres', emoji: '🎭', color: '#c4b5fd' },
    { key: 'parks', label: 'Parks', emoji: '🌳', color: '#a3e635' },
    { key: 'waterfront', label: 'Waterfront', emoji: '🌊', color: '#38bdf8' },
    { key: 'bridges', label: 'Bridges', emoji: '🌉', color: '#818cf8' },
    { key: 'markets', label: 'Markets & malls', emoji: '🛍️', color: '#f472b6' },
    { key: 'books', label: 'Books', emoji: '📚', color: '#fde047' },
    { key: 'food', label: 'Famous food', emoji: '🍽️', color: '#f87171' },
    { key: 'rest-bengali', label: 'Bengali restaurants', emoji: '🐟', color: '#fb923c' },
    { key: 'rest-indian', label: 'Indian & Mughlai', emoji: '🍛', color: '#f59e0b' },
    { key: 'rest-chinese', label: 'Chinese', emoji: '🥟', color: '#facc15' },
    { key: 'rest-sweets', label: 'Sweets', emoji: '🍬', color: '#f472b6' },
    { key: 'rest-cabin', label: 'Cabins', emoji: '☕', color: '#a78bfa' },
    { key: 'stadiums', label: 'Stadiums & clubs', emoji: '🏟️', color: '#4ade80' },
    { key: 'education', label: 'Education', emoji: '🎓', color: '#fdba74' },
    { key: 'transport', label: 'Stations & airport', emoji: '🚆', color: '#94a3b8' },
    { key: 'fun', label: 'Fun & science', emoji: '🎡', color: '#fb7185' },
    { key: 'hotels', label: 'Hotels', emoji: '🏨', color: '#d6d3d1' },
];

export const getLandmarkCategory = (key: LandmarkCategoryKey) => (
    LANDMARK_CATEGORIES.find((item) => item.key === key) || LANDMARK_CATEGORIES[0]
);

const CORE_LANDMARKS: Landmark[] = [
    { id: 'armenian-church-nazareth', name: 'Armenian Church of Nazareth', zone: 'North', category: 'churches', lat: 22.57957, lng: 88.35137, summary: 'Built in 1707, among the oldest churches in Kolkata, tucked into the lanes of Burrabazar.' },
    { id: 'bose-institute', name: 'Bose Institute', zone: 'North', category: 'education', lat: 22.57961, lng: 88.37383, summary: 'India\'s oldest multidisciplinary research institute, founded by J.C. Bose in 1917.' },
    { id: 'burrabazar', name: 'Burrabazar', zone: 'North', category: 'markets', lat: 22.58199, lng: 88.35417, summary: 'The city\'s giant wholesale market for textiles, spices and almost everything else, in narrow, busy lanes.' },
    { id: 'boi-para', name: 'College Street Boi Para', zone: 'North', category: 'books', lat: 22.57714, lng: 88.36391, summary: 'Often called the world\'s largest second-hand book market: a mile of stalls and shops along College Street.' },
    { id: 'cossipore-udyanbati', name: 'Cossipore Udyanbati', zone: 'North', category: 'temples', lat: 22.62592, lng: 88.37232, summary: 'The garden house where Sri Ramakrishna spent his final months, now a pilgrimage site.' },
    { id: 'hatibagan-market', name: 'Hatibagan Market', zone: 'North', category: 'markets', lat: 22.59496, lng: 88.37093, summary: 'A busy North Kolkata market area for clothes, jewellery and street food.' },
    { id: 'indian-coffee-house', name: 'Indian Coffee House', zone: 'North', category: 'food', lat: 22.5761, lng: 88.36389, summary: 'The legendary adda spot above College Street, where generations of students and writers have argued over cheap coffee.' },
    { id: 'jorasanko-thakur-bari', name: 'Jorasanko Thakur Bari', zone: 'North', category: 'heritage', lat: 22.585, lng: 88.35905, summary: 'The ancestral home and birthplace of Rabindranath Tagore, now a museum and part of Rabindra Bharati University.' },
    { id: 'kolkata-chitpur-terminal', name: 'Kolkata Railway Station (Chitpur)', zone: 'North', category: 'transport', lat: 22.60128, lng: 88.38415, summary: 'A major railway terminal in North Kolkata that serves long-distance trains.' },
    { id: 'maghen-david-synagogue', name: 'Maghen David Synagogue', zone: 'North', category: 'churches', lat: 22.57769, lng: 88.35187, summary: 'A grand red-brick synagogue from 1884 in the old Jewish quarter near Brabourne Road.' },
    { id: 'marble-palace', name: 'Marble Palace', zone: 'North', category: 'heritage', lat: 22.58212, lng: 88.36017, summary: 'A 19th-century Mullick family mansion packed with marble statues, European paintings, chandeliers and curios. Free entry, limited hours.' },
    { id: 'mullick-ghat-flower-market', name: 'Mullick Ghat Flower Market', zone: 'North', category: 'markets', lat: 22.58152, lng: 88.35021, summary: 'One of Asia\'s biggest flower markets, right under the Howrah Bridge and busiest at dawn.' },
    { id: 'nakhoda-masjid', name: 'Nakhoda Masjid', zone: 'North', category: 'mosques', lat: 22.57762, lng: 88.35611, summary: 'Kolkata\'s largest mosque, built in red sandstone in the 1920s, with room for thousands of worshippers.' },
    { id: 'kolkata-airport', name: 'Netaji Subhas Chandra Bose Airport', zone: 'North', category: 'transport', lat: 22.65646, lng: 88.44672, summary: 'Kolkata\'s international airport at Dum Dum.' },
    { id: 'nimtala-ghat', name: 'Nimtala Ghat', zone: 'North', category: 'waterfront', lat: 22.59355, lng: 88.35171, summary: 'A historic riverside cremation ghat on the Hooghly, where Rabindranath Tagore was cremated.' },
    { id: 'pareshnath-jain-temple', name: 'Pareshnath Jain Temple', zone: 'North', category: 'temples', lat: 22.6057, lng: 88.38298, summary: 'A richly decorated Jain temple of mirrors, glass and gold, set in a quiet garden.' },
    { id: 'portuguese-church', name: 'Portuguese Church', zone: 'North', category: 'churches', lat: 22.57864, lng: 88.35276, summary: 'An old Catholic church near Burrabazar, dating back to the 1700s.' },
    { id: 'presidency-university', name: 'Presidency University', zone: 'North', category: 'education', lat: 22.57655, lng: 88.36352, summary: 'A historic college that began as Hindu College in 1817, with a long list of famous alumni.' },
    { id: 'scottish-church-college', name: 'Scottish Church College', zone: 'North', category: 'education', lat: 22.58811, lng: 88.37, summary: 'One of India\'s oldest Christian colleges, founded in 1830 by Alexander Duff.' },
    { id: 'star-theatre', name: 'Star Theatre', zone: 'North', category: 'theatres', lat: 22.59406, lng: 88.37098, summary: 'One of Bengal\'s oldest public theatres, still staging Bengali plays in North Kolkata\'s theatre quarter.' },
    { id: 'calcutta-university', name: 'University of Calcutta', zone: 'North', category: 'education', lat: 22.57494, lng: 88.36263, summary: 'Founded in 1857, one of India\'s oldest modern universities, with its Senate House on College Street.' },
    { id: 'academy-of-fine-arts', name: 'Academy of Fine Arts', zone: 'Central', category: 'art', lat: 22.54293, lng: 88.3455, summary: 'A long-running gallery and museum on Cathedral Road with a regular calendar of exhibitions.' },
    { id: 'aminia', name: 'Aminia', zone: 'Central', category: 'food', lat: 22.56227, lng: 88.35374, summary: 'A long-standing Mughlai restaurant, known for its biryani and kebabs.' },
    { id: 'armenian-ghat', name: 'Armenian Ghat', zone: 'Central', category: 'waterfront', lat: 22.58252, lng: 88.34818, summary: 'A historic riverside ghat near Burrabazar, with a view of the Howrah Bridge.' },
    { id: 'arsalan-park-circus', name: 'Arsalan (Park Circus)', zone: 'Central', category: 'food', lat: 22.54387, lng: 88.36595, summary: 'A busy biryani restaurant famous across the city.' },
    { id: 'babu-ghat', name: 'Babu Ghat', zone: 'Central', category: 'waterfront', lat: 22.56508, lng: 88.33976, summary: 'A colonial-era ghat where people gather for morning rituals and boat rides.' },
    { id: 'bbd-bagh', name: 'BBD Bagh (Dalhousie Square)', zone: 'Central', category: 'heritage', lat: 22.57684, lng: 88.34663, summary: 'Formerly Dalhousie Square, the colonial administrative heart of the city around the Lal Dighi tank.' },
    { id: 'bitm', name: 'Birla Industrial & Technological Museum', zone: 'Central', category: 'museums', lat: 22.53471, lng: 88.36376, summary: 'A hands-on science museum on Gurusaday Road, founded in 1959.' },
    { id: 'calcutta-high-court', name: 'Calcutta High Court', zone: 'Central', category: 'heritage', lat: 22.56837, lng: 88.34347, summary: 'A Gothic-style court building modelled on the Cloth Hall in Ypres, completed in 1872.' },
    { id: 'eden-gardens', name: 'Eden Gardens', zone: 'Central', category: 'stadiums', lat: 22.56461, lng: 88.34234, summary: 'Kolkata\'s cricket cathedral, with a capacity of well over 60,000 and home to the Kolkata Knight Riders.' },
    { id: 'flurys', name: 'Flurys', zone: 'Central', category: 'food', lat: 22.55273, lng: 88.35259, summary: 'A historic tearoom and bakery on Park Street, loved for its breakfast and cakes.' },
    { id: 'fort-william', name: 'Fort William', zone: 'Central', category: 'heritage', lat: 22.5545, lng: 88.33801, summary: 'An 18th-century star-shaped fort on the Hooghly, still used by the Indian Army, so visits need permission.' },
    { id: 'general-post-office', name: 'General Post Office', zone: 'Central', category: 'heritage', lat: 22.57296, lng: 88.34775, summary: 'A domed colonial building from 1868 on the site of the old Fort William.' },
    { id: 'kc-das', name: 'K.C. Das', zone: 'Central', category: 'food', lat: 22.56547, lng: 88.35151, summary: 'The famous sweet shop that helped popularise the rosogolla.' },
    { id: 'kusum-rolls', name: 'Kusum Rolls', zone: 'Central', category: 'food', lat: 22.55354, lng: 88.35227, summary: 'A Kolkata roll shop near Park Street, loved for its kathi rolls.' },
    { id: 'mocambo', name: 'Mocambo', zone: 'Central', category: 'food', lat: 22.55325, lng: 88.35318, summary: 'A retro Park Street restaurant and bar.' },
    { id: 'mother-house', name: 'Mother House', zone: 'Central', category: 'churches', lat: 22.5531, lng: 88.36366, summary: 'Headquarters of the Missionaries of Charity, with the tomb of Saint Teresa of Calcutta.' },
    { id: 'nandan', name: 'Nandan', zone: 'Central', category: 'theatres', lat: 22.54227, lng: 88.34567, summary: 'The film centre that hosts the Kolkata International Film Festival.' },
    { id: 'netaji-indoor-stadium', name: 'Netaji Indoor Stadium', zone: 'Central', category: 'stadiums', lat: 22.56611, lng: 88.34165, summary: 'A big indoor arena beside the Maidan that hosts concerts, sports and fairs.' },
    { id: 'new-market', name: 'New Market (Hogg Market)', zone: 'Central', category: 'markets', lat: 22.56015, lng: 88.35296, summary: 'The city\'s best-known covered market in red-brick Gothic, open since 1874.' },
    { id: 'nizams', name: 'Nizam\'s', zone: 'Central', category: 'food', lat: 22.56214, lng: 88.35354, summary: 'The famed kathi roll shop beside New Market.' },
    { id: 'old-mission-church', name: 'Old Mission Church', zone: 'Central', category: 'churches', lat: 22.57172, lng: 88.35147, summary: 'Built in 1770 by the missionary Johann Zacharias Kiernander.' },
    { id: 'park-street', name: 'Park Street', zone: 'Central', category: 'food', lat: 22.55488, lng: 88.35058, summary: 'The city\'s restaurant and nightlife street, lit up for Christmas every year.' },
    { id: 'peter-cat', name: 'Peter Cat', zone: 'Central', category: 'food', lat: 22.55245, lng: 88.35262, summary: 'A Park Street classic known for its chelo kebab and sizzling dishes.' },
    { id: 'rabindra-sadan', name: 'Rabindra Sadan', zone: 'Central', category: 'theatres', lat: 22.54179, lng: 88.34723, summary: 'Kolkata\'s best-known auditorium for plays, music and dance.' },
    { id: 'raj-bhavan', name: 'Raj Bhavan', zone: 'Central', category: 'heritage', lat: 22.56725, lng: 88.34736, summary: 'Residence of the Governor of West Bengal, built in 1803 and modelled on Kedleston Hall.' },
    { id: 'royal-calcutta-turf-club', name: 'Royal Calcutta Turf Club', zone: 'Central', category: 'stadiums', lat: 22.54425, lng: 88.33633, summary: 'A colonial horse-racing course beside the Victoria Memorial, with a winter racing season.' },
    { id: 'sealdah-station', name: 'Sealdah Station', zone: 'Central', category: 'transport', lat: 22.56797, lng: 88.3711, summary: 'One of India\'s busiest railway stations, serving trains from the eastern suburbs and beyond.' },
    { id: 'shaheed-minar', name: 'Shaheed Minar', zone: 'Central', category: 'heritage', lat: 22.56288, lng: 88.34926, summary: 'A tall column at the north end of the Maidan, built in 1828 as the Ochterlony Monument and later renamed.' },
    { id: 'park-street-cemetery', name: 'South Park Street Cemetery', zone: 'Central', category: 'heritage', lat: 22.5462, lng: 88.36022, summary: 'One of the earliest non-church burial grounds in the world, opened in 1767, with grand colonial tombs.' },
    { id: 'st-andrews-church', name: 'St. Andrew\'s Church', zone: 'Central', category: 'churches', lat: 22.57311, lng: 88.35091, summary: 'A Scottish church near Writers\' Building, built in 1818.' },
    { id: 'st-johns-church', name: 'St. John\'s Church', zone: 'Central', category: 'churches', lat: 22.56994, lng: 88.34592, summary: 'An 18th-century church near Raj Bhavan, once the city\'s cathedral, with the mausoleum of Job Charnock in its grounds.' },
    { id: 'st-thomas-church', name: 'St. Thomas\' Church', zone: 'Central', category: 'churches', lat: 22.55017, lng: 88.35222, summary: 'A heritage church on Middleton Row, close to Park Street.' },
    { id: 'st-xaviers-college', name: 'St. Xavier\'s College', zone: 'Central', category: 'education', lat: 22.54823, lng: 88.35585, summary: 'A Jesuit college on Park Street, founded in 1860.' },
    { id: 'asiatic-society', name: 'The Asiatic Society', zone: 'Central', category: 'museums', lat: 22.55494, lng: 88.35109, summary: 'Founded in 1784 by William Jones, a historic library and museum on Park Street.' },
    { id: 'great-eastern', name: 'The Lalit Great Eastern', zone: 'Central', category: 'hotels', lat: 22.56842, lng: 88.34951, summary: 'One of the oldest hotels in the East, dating from 1840.' },
    { id: 'maidan', name: 'The Maidan (Brigade Parade Ground)', zone: 'Central', category: 'parks', lat: 22.55035, lng: 88.34571, summary: 'Kolkata\'s "lungs": a vast open field for football, cricket and morning walks, and the venue for big rallies and fairs.' },
    { id: 'oberoi-grand', name: 'The Oberoi Grand', zone: 'Central', category: 'hotels', lat: 22.56144, lng: 88.35128, summary: 'A grand heritage hotel on Chowringhee overlooking the Maidan.' },
    { id: 'the-park-kolkata', name: 'The Park Kolkata', zone: 'Central', category: 'hotels', lat: 22.55405, lng: 88.35187, summary: 'A well-known design hotel on Park Street.' },
    { id: 'town-hall', name: 'Town Hall', zone: 'Central', category: 'heritage', lat: 22.56802, lng: 88.34496, summary: 'A Doric-columned colonial hall from 1813, used for exhibitions and civic events.' },
    { id: 'writers-building', name: 'Writers\' Building', zone: 'Central', category: 'heritage', lat: 22.57362, lng: 88.34911, summary: 'A red-brick colonial secretariat on BBD Bagh, begun in the 18th century and extended over time.' },
    { id: 'acropolis-mall', name: 'Acropolis Mall', zone: 'South', category: 'markets', lat: 22.51532, lng: 88.39324, summary: 'A big shopping mall on Rajdanga Main Road, Kasba.' },
    { id: 'agri-horticultural-society', name: 'Agri-Horticultural Society of India', zone: 'South', category: 'parks', lat: 22.528, lng: 88.33276, summary: 'A garden society in Alipore, founded in 1820, with a green campus and flower shows.' },
    { id: 'alipore-jail-museum', name: 'Alipore Jail Museum', zone: 'South', category: 'museums', lat: 22.53097, lng: 88.33681, summary: 'The museum in the old Presidency Jail, where Sri Aurobindo was held in 1908 during the Alipore Bomb Case.' },
    { id: 'alipore-zoo', name: 'Alipore Zoological Gardens', zone: 'South', category: 'fun', lat: 22.53659, lng: 88.33211, summary: 'India\'s oldest zoo, opened in 1876, home to big cats, reptiles and migratory birds.' },
    { id: 'balaram-mullick-sweets', name: 'Balaram Mullick & Radharaman Mullick (Park Street)', zone: 'South', category: 'food', lat: 22.55224, lng: 88.353, summary: 'A well-loved Kolkata sweet shop for sandesh and mishti doi, with an outlet on Park Street.' },
    { id: 'birla-academy', name: 'Birla Academy of Art and Culture', zone: 'South', category: 'art', lat: 22.51357, lng: 88.35542, summary: 'An art gallery and cultural centre on Southern Avenue.' },
    { id: 'birla-mandir', name: 'Birla Mandir', zone: 'South', category: 'temples', lat: 22.53049, lng: 88.36496, summary: 'A white marble Hindu temple in Ballygunge, built by the Birla family.' },
    { id: 'dakshinapan', name: 'Dakshinapan Shopping Centre', zone: 'South', category: 'markets', lat: 22.50879, lng: 88.3667, summary: 'A shopping complex for handicrafts and handloom, near Dhakuria Lake.' },
    { id: 'deshapriya-park', name: 'Deshapriya Park', zone: 'South', category: 'parks', lat: 22.51733, lng: 88.35273, summary: 'A neighbourhood park by Rashbehari, and a big name in Durga Puja season.' },
    { id: 'gariahat-market', name: 'Gariahat Market', zone: 'South', category: 'markets', lat: 22.51952, lng: 88.36593, summary: 'South Kolkata\'s busiest shopping crossing, with street stalls, saris and jewellery around Gariahat Road.' },
    { id: 'iim-calcutta', name: 'IIM Calcutta', zone: 'South', category: 'education', lat: 22.44527, lng: 88.30258, summary: 'India\'s first IIM, founded in 1961, on its Joka campus.' },
    { id: 'jadavpur-university', name: 'Jadavpur University', zone: 'South', category: 'education', lat: 22.49953, lng: 88.3716, summary: 'A well-known engineering and arts university in Jadavpur.' },
    { id: 'lake-kali-bari', name: 'Lake Kali Bari', zone: 'South', category: 'temples', lat: 22.51357, lng: 88.35501, summary: 'A popular Kali temple beside the lake in South Kolkata.' },
    { id: 'lake-market', name: 'Lake Market', zone: 'South', category: 'markets', lat: 22.5168, lng: 88.34908, summary: 'A popular neighbourhood market near Rashbehari.' },
    { id: 'national-library', name: 'National Library of India', zone: 'South', category: 'education', lat: 22.53256, lng: 88.33348, summary: 'India\'s largest library by collection, housed in the old Belvedere Estate.' },
    { id: 'netaji-bhawan', name: 'Netaji Bhawan', zone: 'South', category: 'museums', lat: 22.53748, lng: 88.35098, summary: 'Netaji Subhas Chandra Bose\'s ancestral home, now a museum on Elgin Road.' },
    { id: 'quest-mall', name: 'Quest Mall', zone: 'South', category: 'markets', lat: 22.53903, lng: 88.3657, summary: 'A large mall on Syed Amir Ali Avenue in Ballygunge.' },
    { id: 'rabindra-sarobar', name: 'Rabindra Sarobar', zone: 'South', category: 'parks', lat: 22.51226, lng: 88.36357, summary: 'A large lake and park where rowers, walkers and bird-watchers gather.' },
    { id: 'rabindra-sarobar-stadium', name: 'Rabindra Sarobar Stadium', zone: 'South', category: 'stadiums', lat: 22.51164, lng: 88.35225, summary: 'A stadium beside Rabindra Sarobar, used for sport and events.' },
    { id: 'rk-institute-of-culture', name: 'Ramakrishna Mission Institute of Culture', zone: 'South', category: 'art', lat: 22.51632, lng: 88.36596, summary: 'A cultural centre with a library, auditorium and temple, beside Gol Park.' },
    { id: 'royal-calcutta-golf-club', name: 'Royal Calcutta Golf Club', zone: 'South', category: 'stadiums', lat: 22.49285, lng: 88.35532, summary: 'Founded in 1829, among the oldest golf clubs outside Britain.' },
    { id: 'south-city-mall', name: 'South City Mall', zone: 'South', category: 'markets', lat: 22.50098, lng: 88.36205, summary: 'A large shopping mall and entertainment complex in Jadavpur.' },
    { id: 'taj-bengal', name: 'Taj Bengal', zone: 'South', category: 'hotels', lat: 22.53811, lng: 88.33424, summary: 'A luxury hotel in Alipore.' },
    { id: 'technicians-studio', name: 'Technicians Studio', zone: 'South', category: 'theatres', lat: 22.48947, lng: 88.3444, summary: 'The heart of Tollywood, where many Bengali films are shot.' },
    { id: 'tollygunge-club', name: 'Tollygunge Club', zone: 'South', category: 'stadiums', lat: 22.49517, lng: 88.34381, summary: 'A historic sports and social club with a golf course in Tollygunge.' },
    { id: 'axis-mall', name: 'Axis Mall', zone: 'East', category: 'markets', lat: 22.5795, lng: 88.45992, summary: 'A mall in New Town.' },
    { id: 'biswa-bangla-convention-centre', name: 'Biswa Bangla Convention Centre', zone: 'East', category: 'theatres', lat: 22.58247, lng: 88.47312, summary: 'A large convention and events venue in New Town.' },
    { id: 'biswa-bangla-gate', name: 'Biswa Bangla Gate', zone: 'East', category: 'heritage', lat: 22.57863, lng: 88.4717, summary: 'A landmark gateway at the entrance to New Town.' },
    { id: 'central-park-salt-lake', name: 'Central Park, Salt Lake', zone: 'East', category: 'parks', lat: 22.58669, lng: 88.41721, summary: 'A large Salt Lake park with a lake and walking paths.' },
    { id: 'city-centre-salt-lake', name: 'City Centre Salt Lake', zone: 'East', category: 'markets', lat: 22.58695, lng: 88.40794, summary: 'A busy mall in Salt Lake Sector I.' },
    { id: 'itc-royal-bengal', name: 'ITC Royal Bengal', zone: 'East', category: 'hotels', lat: 22.54436, lng: 88.39809, summary: 'A large luxury hotel on the eastern side of the city.' },
    { id: 'mani-square', name: 'Mani Square', zone: 'East', category: 'markets', lat: 22.57777, lng: 88.40055, summary: 'A large mall on the E.M. Bypass.' },
    { id: 'nalban', name: 'Nalban Boating Complex', zone: 'East', category: 'waterfront', lat: 22.56901, lng: 88.43, summary: 'A lakeside boating spot and food court near Salt Lake.' },
    { id: 'nazrul-tirtha', name: 'Nazrul Tirtha', zone: 'East', category: 'art', lat: 22.58167, lng: 88.45324, summary: 'A cultural complex in New Town dedicated to the poet Kazi Nazrul Islam.' },
    { id: 'nicco-park', name: 'Nicco Park', zone: 'East', category: 'fun', lat: 22.57093, lng: 88.42218, summary: 'A big amusement park in Salt Lake, with water rides and roller coasters.' },
    { id: 'rabindra-tirtha', name: 'Rabindra Tirtha', zone: 'East', category: 'art', lat: 22.57942, lng: 88.47288, summary: 'A cultural centre in New Town dedicated to Rabindranath Tagore.' },
    { id: 'salt-lake-stadium', name: 'Salt Lake Stadium', zone: 'East', category: 'stadiums', lat: 22.56906, lng: 88.40902, summary: 'Vivekananda Yuba Bharati Krirangan, among the largest football stadiums in the world.' },
    { id: 'subhas-sarobar', name: 'Subhas Sarobar', zone: 'East', category: 'parks', lat: 22.5684, lng: 88.40092, summary: 'A big lake and park near Beliaghata, with a rowing course.' },
    { id: 'swabhumi', name: 'Swabhumi Heritage Plaza', zone: 'East', category: 'markets', lat: 22.57086, lng: 88.40115, summary: 'A handicraft and food complex themed on Bengal\'s heritage.' },
    { id: 'tangra-chinatown', name: 'Tangra Chinatown', zone: 'East', category: 'food', lat: 22.54399, lng: 88.3893, summary: 'Kolkata\'s present-day Chinatown, famed for Indo-Chinese food.' },
    { id: 'indian-botanic-garden', name: 'Acharya Jagadish Chandra Bose Indian Botanic Garden', zone: 'West', category: 'parks', lat: 22.5582, lng: 88.28923, summary: 'Famous for the Great Banyan Tree, thought to be among the widest in the world.' },
    { id: 'howrah-junction', name: 'Howrah Junction', zone: 'West', category: 'transport', lat: 22.58279, lng: 88.34239, summary: 'One of India\'s oldest and busiest railway stations, opened in 1854, on the west bank of the Hooghly.' },
    { id: 'iiest-shibpur', name: 'IIEST Shibpur', zone: 'West', category: 'education', lat: 22.55506, lng: 88.30585, summary: 'One of India\'s oldest engineering colleges, founded in 1856.' },
    { id: 'nivedita-setu', name: 'Nivedita Setu', zone: 'West', category: 'bridges', lat: 22.65253, lng: 88.35416, summary: 'A cable-stayed bridge over the Hooghly near Dakshineswar, beside the older Vivekananda Setu (Bally Bridge).' },
    { id: 'santragachi-jheel', name: 'Santragachi Jheel', zone: 'West', category: 'parks', lat: 22.58147, lng: 88.28336, summary: 'A lake that attracts migratory birds in winter.' },
];

export const KOLKATA_LANDMARKS: Landmark[] = [...CORE_LANDMARKS, ...RESTAURANT_LANDMARKS];
