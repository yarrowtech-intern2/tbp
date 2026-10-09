import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { divIcon, latLngBounds, point, type Map as LeafletMap, type Marker as LeafletMarker } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  Footprints,
  LayoutGrid,
  LocateFixed,
  MapPinned,
  MapPinPlus,
  Menu,
  Navigation,
  Pause,
  Play,
  Route,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PujaGuidePanel } from '../components/map/PujaGuidePanel';
import { getPandal, getRestaurant, loadPandalPlan, PUJA_PANDALS, PUJA_RESTAURANTS, savePandalPlan } from '../lib/pujaGuide';
import { ExplorePanel } from '../components/map/ExplorePanel';
import { LandmarkLayerControl } from '../components/map/LandmarkLayerControl';
import { LandmarkMarkers } from '../components/map/LandmarkMarkers';
import { MapMarker } from '../components/map/MapMarker';
import { useStableCallback } from '../components/map/useStableCallback';
import { useWalkTrail } from '../components/map/useWalkTrail';
import { WalkTrailCard } from '../components/map/WalkTrailCard';
import {
  buildPlacePinIcon,
  fetchPublicPlaces,
  getPlaceCategory,
  getPlaceDisplayLabel,
  type ProviderPlace,
} from '../lib/providerPlaces';
import { LandmarkSheet } from '../components/map/LandmarkSheet';
import { MapDownloadButton } from '../components/map/MapDownloadButton';
import {
  getLandmarkCategory,
  KOLKATA_LANDMARKS,
  LANDMARK_CATEGORIES,
  LANDMARK_ZONES,
  type Landmark,
  type LandmarkCategoryKey,
  type LandmarkZone,
} from '../lib/kolkataLandmarks';
import { clampBounds, EXPLORE_GROUPS, fetchExplorePlaces, findExploreCategory, type ExplorePlace } from '../lib/placeExplorer';
import {
  buildEmojiMarkerIcon,
  buildPinIcon,
  buildRestaurantIcon,
  categoryFromLabel,
  createMapPin,
  deleteMapPin,
  fetchMapPins,
  getPinCategory,
  PIN_CATEGORIES,
  PLAN_COLOR,
  type MapPinRecord,
  type PinCategory,
} from '../lib/mapPins';
import {
  buildSmartRoute,
  fetchRouteTouristPlaces,
  formatRouteDistance,
  formatRouteDuration,
  getCurrentDevicePosition,
  type PlannedRoute,
  type RoutePlace,
  type TravelMode,
} from '../lib/routePlanner';
import './map2-page.css';

type Map2Attraction = RoutePlace & {
  summary: string;
  guide: {
    name: string;
    specialty: string;
    languages: string;
  };
  bestTime: string;
};

const MAP2_CENTER: [number, number] = [22.5726, 88.3639];

const MAP2_ATTRACTIONS: Map2Attraction[] = [
  {
    id: 'map2-victoria-memorial',
    name: 'Victoria Memorial',
    lat: 22.5448,
    lng: 88.3426,
    category: 'Heritage',
    kind: 'suggested',
    visited: false,
    summary: 'A marble landmark built during the British era, now known for its museum galleries, gardens, and open views across central Kolkata.',
    guide: { name: 'Aritra Sen', specialty: 'Colonial history walk', languages: 'English, Bengali, Hindi' },
    bestTime: 'Late afternoon',
  },
  {
    id: 'map2-indian-museum',
    name: 'Indian Museum',
    lat: 22.5579,
    lng: 88.3511,
    category: 'Museum',
    kind: 'suggested',
    visited: false,
    summary: 'One of India\'s oldest museums, with archaeology, art, fossils, coins, textiles, and natural history collections under one roof.',
    guide: { name: 'Maya Dutta', specialty: 'Museum highlights', languages: 'English, Bengali' },
    bestTime: 'Morning',
  },
  {
    id: 'map2-howrah-bridge',
    name: 'Howrah Bridge',
    lat: 22.5851,
    lng: 88.3468,
    category: 'Landmark',
    kind: 'suggested',
    visited: false,
    summary: 'A steel cantilever bridge across the Hooghly River and one of Kolkata\'s strongest everyday city symbols.',
    guide: { name: 'Rohit Paul', specialty: 'Riverfront photo route', languages: 'English, Hindi' },
    bestTime: 'Sunrise',
  },
  {
    id: 'map2-dakshineswar',
    name: 'Dakshineswar Kali Temple',
    lat: 22.655,
    lng: 88.3577,
    category: 'Temple',
    kind: 'suggested',
    visited: false,
    summary: 'A riverside temple complex dedicated to Kali, closely associated with Ramakrishna and Bengal\'s devotional history.',
    guide: { name: 'Subhajit Roy', specialty: 'Temple heritage', languages: 'Bengali, Hindi' },
    bestTime: 'Early morning',
  },
  {
    id: 'map2-belur-math',
    name: 'Belur Math',
    lat: 22.6329,
    lng: 88.3559,
    category: 'Spiritual',
    kind: 'suggested',
    visited: false,
    summary: 'The headquarters of the Ramakrishna Math and Mission, known for peaceful grounds and architecture that blends several traditions.',
    guide: { name: 'Ishita Ghosh', specialty: 'Spiritual architecture', languages: 'English, Bengali' },
    bestTime: 'Evening',
  },
  {
    id: 'map2-prinsep-ghat',
    name: 'Prinsep Ghat',
    lat: 22.555,
    lng: 88.3314,
    category: 'Riverfront',
    kind: 'suggested',
    visited: false,
    summary: 'A riverside promenade with a neoclassical monument, boat rides, and strong views of the Vidyasagar Setu.',
    guide: { name: 'Nadia Karim', specialty: 'Sunset walk', languages: 'English, Hindi, Bengali' },
    bestTime: 'Sunset',
  },
  {
    id: 'map2-st-pauls',
    name: 'St. Paul\'s Cathedral',
    lat: 22.5443,
    lng: 88.3474,
    category: 'Heritage',
    kind: 'suggested',
    visited: false,
    summary: 'A Gothic-style cathedral beside the Maidan, known for stained glass, quiet interiors, and its connection to Kolkata\'s colonial-era civic core.',
    guide: { name: 'Aritra Sen', specialty: 'Cathedral and Maidan walk', languages: 'English, Bengali, Hindi' },
    bestTime: 'Late afternoon',
  },
  {
    id: 'map2-birla-planetarium',
    name: 'Birla Planetarium',
    lat: 22.5455,
    lng: 88.3479,
    category: 'Science',
    kind: 'suggested',
    visited: false,
    summary: 'A landmark planetarium near the Maidan with astronomy shows and a location that pairs well with Victoria Memorial and St. Paul\'s Cathedral.',
    guide: { name: 'Neel Chatterjee', specialty: 'Family science stop', languages: 'English, Hindi' },
    bestTime: 'Afternoon',
  },
  {
    id: 'map2-kalighat',
    name: 'Kalighat Temple',
    lat: 22.5205,
    lng: 88.3426,
    category: 'Temple',
    kind: 'suggested',
    visited: false,
    summary: 'A major Shakti shrine and one of the city\'s busiest pilgrimage points, surrounded by dense lanes and local ritual life.',
    guide: { name: 'Ananya Basu', specialty: 'Pilgrimage context', languages: 'Bengali, English' },
    bestTime: 'Morning',
  },
  {
    id: 'map2-kumartuli',
    name: 'Kumartuli',
    lat: 22.6049,
    lng: 88.3603,
    category: 'Art district',
    kind: 'suggested',
    visited: false,
    summary: 'A traditional potters\' quarter where artisans shape clay idols, especially before Durga Puja.',
    guide: { name: 'Dev Mallick', specialty: 'Artisan studio trail', languages: 'English, Bengali' },
    bestTime: 'Before noon',
  },
  {
    id: 'map2-science-city',
    name: 'Science City',
    lat: 22.5418,
    lng: 88.396,
    category: 'Family',
    kind: 'suggested',
    visited: false,
    summary: 'A large science and education complex with interactive galleries, space exhibits, and family-friendly learning zones.',
    guide: { name: 'Neel Chatterjee', specialty: 'Family route planning', languages: 'English, Hindi' },
    bestTime: 'Afternoon',
  },
  {
    id: 'map2-eco-park',
    name: 'Eco Park',
    lat: 22.5988,
    lng: 88.4696,
    category: 'Park',
    kind: 'suggested',
    visited: false,
    summary: 'A large urban park in New Town with lakeside walks, gardens, cycling areas, and open-air leisure zones.',
    guide: { name: 'Tania Saha', specialty: 'Slow family day', languages: 'English, Bengali, Hindi' },
    bestTime: 'Evening',
  },
];

/** Zone and emoji category of the 12 curated places, so they filter and look like the rest of the famous places. */
const ATTRACTION_META: Record<string, { zone: LandmarkZone; category: LandmarkCategoryKey }> = {
  'map2-victoria-memorial': { zone: 'Central', category: 'heritage' },
  'map2-indian-museum': { zone: 'Central', category: 'museums' },
  'map2-howrah-bridge': { zone: 'West', category: 'bridges' },
  'map2-dakshineswar': { zone: 'North', category: 'temples' },
  'map2-belur-math': { zone: 'West', category: 'temples' },
  'map2-prinsep-ghat': { zone: 'Central', category: 'waterfront' },
  'map2-st-pauls': { zone: 'Central', category: 'churches' },
  'map2-birla-planetarium': { zone: 'Central', category: 'fun' },
  'map2-kalighat': { zone: 'South', category: 'temples' },
  'map2-kumartuli': { zone: 'North', category: 'art' },
  'map2-science-city': { zone: 'East', category: 'fun' },
  'map2-eco-park': { zone: 'East', category: 'parks' },
};

/** When two places collide at a low zoom, the category listed first keeps the pin. */
const LANDMARK_PRIORITY: LandmarkCategoryKey[] = [
  'heritage', 'temples', 'museums', 'parks', 'churches', 'mosques', 'waterfront', 'bridges', 'art', 'theatres',
  'stadiums', 'fun', 'education', 'markets', 'books', 'transport', 'hotels', 'food',
  'rest-bengali', 'rest-indian', 'rest-chinese', 'rest-sweets', 'rest-cabin',
];

const SORTED_LANDMARKS = [...KOLKATA_LANDMARKS].sort(
  (left, right) => LANDMARK_PRIORITY.indexOf(left.category) - LANDMARK_PRIORITY.indexOf(right.category),
);

const toRoutePlace = (pointItem: Map2Attraction): RoutePlace => ({
  id: pointItem.id,
  name: pointItem.name,
  lat: pointItem.lat,
  lng: pointItem.lng,
  category: pointItem.category,
  kind: pointItem.kind,
  visited: false,
  display_name: pointItem.display_name || `${pointItem.name}, Kolkata`,
  source: 'system',
});

const metersBetween = (
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) => {
  const radius = 6371000;
  const latA = (first.lat * Math.PI) / 180;
  const latB = (second.lat * Math.PI) / 180;
  const latDelta = ((second.lat - first.lat) * Math.PI) / 180;
  const lngDelta = ((second.lng - first.lng) * Math.PI) / 180;
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const pointSegmentDistanceMeters = (
  target: { lat: number; lng: number },
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
) => {
  const referenceLat = ((target.lat + start.lat + end.lat) / 3) * (Math.PI / 180);
  const project = (item: { lat: number; lng: number }) => ({
    x: item.lng * 111320 * Math.cos(referenceLat),
    y: item.lat * 110540,
  });
  const p = project(target);
  const a = project(start);
  const b = project(end);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx ** 2 + dy ** 2;
  if (!length) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

const distanceToRouteMeters = (target: { lat: number; lng: number }, routePoints: Array<[number, number]>) => {
  if (routePoints.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    const distance = pointSegmentDistanceMeters(
      target,
      { lat: routePoints[index][0], lng: routePoints[index][1] },
      { lat: routePoints[index + 1][0], lng: routePoints[index + 1][1] },
    );
    if (distance < best) best = distance;
  }
  return best;
};

const createFallbackRoute = (start: Map2Attraction, end: Map2Attraction, travelMode: TravelMode): PlannedRoute => {
  const distance = metersBetween(start, end);
  const speedMetersPerSecond = travelMode === 'walking' ? 1.25 : travelMode === 'cycling' ? 4.2 : 8.5;
  return {
    client_route_id: `map2-local-${Date.now()}`,
    title: `${start.name} to ${end.name}`,
    city: 'Kolkata',
    travel_mode: travelMode,
    start_name: start.name,
    destination_name: end.name,
    stop_names: [],
    route_points: [[start.lat, start.lng], [end.lat, end.lng]],
    waypoints: [
      { ...toRoutePlace(start), kind: 'route_waypoint' },
      { ...toRoutePlace(end), kind: 'route_waypoint' },
    ],
    recommended_places: [],
    distance_meters: distance,
    duration_seconds: distance / speedMetersPerSecond,
  };
};

const StarRating: React.FC<{ value: number; size?: number }> = ({ value, size = 15 }) => (
  <span className="map2-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star key={star} size={size} className={star <= value ? 'is-on' : ''} aria-hidden="true" />
    ))}
  </span>
);

/** Gives the page the Leaflet map instance and routes map taps to pin placement. */
const Map2Bridge: React.FC<{
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onMapClick?: (position: { lat: number; lng: number }) => void;
  onMoveEnd?: () => void;
}> = ({ mapRef, onMapClick, onMoveEnd }) => {
  const map = useMapEvents({
    click: (event) => onMapClick?.({ lat: event.latlng.lat, lng: event.latlng.lng }),
    moveend: () => onMoveEnd?.(),
  });
  useEffect(() => {
    mapRef.current = map;
  }, [map, mapRef]);
  return null;
};

/** Shared empty route: a fresh `[]` each render would re-run the viewport effect and re-fly the map. */
const NO_ROUTE_POINTS: Array<[number, number]> = [];

const userLocationIcon = divIcon({
  className: '',
  iconSize: point(22, 22),
  iconAnchor: point(11, 11),
  html: '<span class="map2-user-dot"></span>',
});

/** Height of a bottom sheet that covers the map (phones), or 0 when panels sit beside it. */
const getBottomSheetInset = (): number => {
  const sheet = document.querySelector<HTMLElement>('.map2-puja-panel, .map2-route-panel, .map2-detail-sheet');
  if (!sheet) return 0;
  const rect = sheet.getBoundingClientRect();
  const isDocked = rect.width > window.innerWidth * 0.8 && rect.top > window.innerHeight * 0.25;
  return isDocked ? Math.max(0, window.innerHeight - rect.top) : 0;
};

const Map2Viewport: React.FC<{
  routePoints: Array<[number, number]>;
  selectedPoint?: { lat: number; lng: number } | null;
  userLocation?: { lat: number; lng: number } | null;
}> = ({ routePoints, selectedPoint, userLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (routePoints.length >= 2) {
      map.fitBounds(latLngBounds(routePoints), { paddingTopLeft: [40, 120], paddingBottomRight: [40, 220] });
      return;
    }

    if (selectedPoint) {
      // Wait a beat so a sheet that resizes on selection has settled, then aim at the middle of the visible map.
      const timer = window.setTimeout(() => {
        const zoom = Math.max(map.getZoom(), 14);
        const inset = getBottomSheetInset();
        const target = map.unproject(map.project([selectedPoint.lat, selectedPoint.lng], zoom).add([0, inset / 2]), zoom);
        map.flyTo(target, zoom, { duration: 0.45 });
      }, 80);
      return () => window.clearTimeout(timer);
    }

    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.45 });
    }
  }, [map, routePoints, selectedPoint, userLocation]);

  return null;
};

export const Map2Page: React.FC = () => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechKeepAliveRef = useRef<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<Map2Attraction | null>(null);
  const [routeOpen, setRouteOpen] = useState(false);
  const [startId, setStartId] = useState(MAP2_ATTRACTIONS[0].id);
  const [endId, setEndId] = useState(MAP2_ATTRACTIONS[5].id);
  const [travelMode, setTravelMode] = useState<TravelMode>('driving');
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [routeStops, setRouteStops] = useState<RoutePlace[]>([]);
  const [routeStatus, setRouteStatus] = useState('Choose two points to build a route.');
  const [routeLoading, setRouteLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioStatus, setAudioStatus] = useState('');
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, profile } = useAuth();
  const mapRef = useRef<LeafletMap | null>(null);
  const [pins, setPins] = useState<MapPinRecord[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPinRecord | null>(null);
  const [places, setPlaces] = useState<ProviderPlace[]>([]);
  const [placesOn, setPlacesOn] = useState(true);
  const [selectedPlace, setSelectedPlace] = useState<ProviderPlace | null>(null);
  const [pinFormOpen, setPinFormOpen] = useState(false);
  const [draftPin, setDraftPin] = useState<{ lat: number; lng: number } | null>(null);
  const [pinCategory, setPinCategory] = useState<PinCategory>('temple');
  const [pinTitle, setPinTitle] = useState('');
  const [pinReview, setPinReview] = useState('');
  const [pinRating, setPinRating] = useState(5);
  const [pinStatus, setPinStatus] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pujaOpen, setPujaOpen] = useState(false);
  const [pandalPlan, setPandalPlan] = useState<string[]>([]);
  const [selectedPandalId, setSelectedPandalId] = useState<string | null>(null);
  const [pujaRoute, setPujaRoute] = useState<PlannedRoute | null>(null);
  const [showPlanOnly, setShowPlanOnly] = useState(false);
  const [showRestaurants, setShowRestaurants] = useState(true);
  const [pujaHintOn, setPujaHintOn] = useState(false);
  const trail = useWalkTrail();
  const [trailCardOpen, setTrailCardOpen] = useState(false);
  const trailFlownRef = useRef(false);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreGroupKey, setExploreGroupKey] = useState(EXPLORE_GROUPS[0].key);
  const [exploreCategoryKey, setExploreCategoryKey] = useState<string | null>(null);
  const [explorePlaces, setExplorePlaces] = useState<ExplorePlace[]>([]);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreStatus, setExploreStatus] = useState('');
  const [selectedExplorePlace, setSelectedExplorePlace] = useState<ExplorePlace | null>(null);
  const [exploreAreaStale, setExploreAreaStale] = useState(false);
  const [exploreRoute, setExploreRoute] = useState<PlannedRoute | null>(null);
  const [exploreRouteLoading, setExploreRouteLoading] = useState(false);
  const exploreRequestRef = useRef(0);
  const [landmarksOn, setLandmarksOn] = useState(true);
  const [landmarkPanelOpen, setLandmarkPanelOpen] = useState(false);
  const [landmarkZone, setLandmarkZone] = useState<LandmarkZone | 'All'>('All');
  const [hiddenCategories, setHiddenCategories] = useState<Set<LandmarkCategoryKey>>(() => new Set());
  const [selectedLandmark, setSelectedLandmark] = useState<Landmark | null>(null);
  const [landmarkRoute, setLandmarkRoute] = useState<PlannedRoute | null>(null);
  const [landmarkRouteLoading, setLandmarkRouteLoading] = useState(false);
  const [landmarkStatus, setLandmarkStatus] = useState('');
  const exploreCategory = findExploreCategory(exploreCategoryKey);
  const selectedPandal = selectedPandalId ? getPandal(selectedPandalId) : null;
  const selectedRestaurant = selectedRestaurantId ? getRestaurant(selectedRestaurantId) : null;
  const userId = user?.id || null;

  const startPoint = useMemo(
    () => MAP2_ATTRACTIONS.find((item) => item.id === startId) || MAP2_ATTRACTIONS[0],
    [startId],
  );
  const endPoint = useMemo(
    () => MAP2_ATTRACTIONS.find((item) => item.id === endId) || MAP2_ATTRACTIONS[1],
    [endId],
  );
  const routePointIds = useMemo(
    () => new Set([startId, endId, ...routeStops.map((item) => item.id)]),
    [endId, routeStops, startId],
  );
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    const fromAttractions = MAP2_ATTRACTIONS
      .filter((item) => `${item.name} ${item.category} ${item.summary}`.toLowerCase().includes(normalized))
      .map((item) => ({ kind: 'attraction' as const, id: item.id, name: item.name, label: item.category, attraction: item }));
    const fromLandmarks = KOLKATA_LANDMARKS
      .filter((item) => `${item.name} ${getLandmarkCategory(item.category).label} ${item.zone} ${item.summary}`.toLowerCase().includes(normalized))
      .map((item) => ({ kind: 'landmark' as const, id: item.id, name: item.name, label: `${getLandmarkCategory(item.category).label} · ${item.zone}`, landmark: item }));
    return [...fromAttractions, ...fromLandmarks].slice(0, 6);
  }, [query]);

  const isLayerVisible = (zone: LandmarkZone, category: LandmarkCategoryKey) => (
    landmarksOn && (landmarkZone === 'All' || landmarkZone === zone) && !hiddenCategories.has(category)
  );
  const visibleAttractions = useMemo(
    () => MAP2_ATTRACTIONS.filter((item) => {
      const meta = ATTRACTION_META[item.id];
      return !meta || isLayerVisible(meta.zone, meta.category);
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [landmarksOn, landmarkZone, hiddenCategories],
  );
  const visibleLandmarks = useMemo(
    () => SORTED_LANDMARKS.filter((item) => isLayerVisible(item.zone, item.category)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [landmarksOn, landmarkZone, hiddenCategories],
  );
  const reservedSpots = useMemo(() => visibleAttractions.map((item) => ({ lat: item.lat, lng: item.lng })), [visibleAttractions]);
  const layerZoneCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const zone of LANDMARK_ZONES) counts[zone] = KOLKATA_LANDMARKS.filter((item) => item.zone === zone).length;
    for (const meta of Object.values(ATTRACTION_META)) counts[meta.zone] += 1;
    return counts;
  }, []);
  const layerCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const category of LANDMARK_CATEGORIES) counts[category.key] = 0;
    for (const item of KOLKATA_LANDMARKS) {
      if (landmarkZone === 'All' || item.zone === landmarkZone) counts[item.category] += 1;
    }
    for (const meta of Object.values(ATTRACTION_META)) {
      if (landmarkZone === 'All' || meta.zone === landmarkZone) counts[meta.category] += 1;
    }
    return counts;
  }, [landmarkZone]);
  const layerTotal = visibleAttractions.length + visibleLandmarks.length;

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (speechKeepAliveRef.current !== null) {
      window.clearInterval(speechKeepAliveRef.current);
      speechKeepAliveRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timeoutId = window.setTimeout(() => searchInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timeoutId);
  }, [searchOpen]);

  useEffect(() => {
    let cancelled = false;
    fetchMapPins()
      .then((rows) => { if (!cancelled) setPins(rows); })
      .catch(() => { /* Pins are optional; the curated map still works without them. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPublicPlaces()
      .then((rows) => { if (!cancelled) setPlaces(rows); })
      .catch(() => { /* Provider pins are optional; the rest of the map still works without them. */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadPandalPlan(userId).then((ids) => { if (!cancelled) setPandalPlan(ids); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [userId]);

  const handlePlanChange = (ids: string[]) => {
    setPandalPlan(ids);
    void savePandalPlan(userId, ids).catch(() => undefined);
  };

  const closeExplore = () => {
    setExploreOpen(false);
    setExploreCategoryKey(null);
    setExplorePlaces([]);
    setSelectedExplorePlace(null);
    setExploreStatus('');
    setExploreAreaStale(false);
    setExploreRoute(null);
  };

  /** Loads places of a category inside the current map view (trimmed to ~9 km around its centre). */
  const loadExplorePlaces = async (categoryKey: string) => {
    const map = mapRef.current;
    if (!map) return;
    const viewBounds = map.getBounds();
    const { trimmed } = clampBounds({
      south: viewBounds.getSouth(), west: viewBounds.getWest(), north: viewBounds.getNorth(), east: viewBounds.getEast(),
    });
    const requestId = exploreRequestRef.current + 1;
    exploreRequestRef.current = requestId;
    setExploreLoading(true);
    setExploreAreaStale(false);
    setSelectedExplorePlace(null);
    setExploreRoute(null);
    setExploreStatus('Searching this area...');
    try {
      const rows = await fetchExplorePlaces(categoryKey, {
        south: viewBounds.getSouth(), west: viewBounds.getWest(), north: viewBounds.getNorth(), east: viewBounds.getEast(),
      });
      if (exploreRequestRef.current !== requestId) return;
      setExplorePlaces(rows);
      const label = findExploreCategory(categoryKey)?.category.label.toLowerCase() || 'places';
      setExploreStatus(rows.length
        ? `${rows.length} ${label} found${trimmed ? ' near the centre of the map. Zoom in to search a smaller area.' : ' in this area.'}`
        : `No ${label} found here. Move the map and tap "Search this area".`);
    } catch (error) {
      if (exploreRequestRef.current !== requestId) return;
      setExplorePlaces([]);
      setExploreStatus(error instanceof Error ? error.message : 'Could not load places.');
    } finally {
      if (exploreRequestRef.current === requestId) setExploreLoading(false);
    }
  };

  const handleExploreCategory = (categoryKey: string | null) => {
    setExploreCategoryKey(categoryKey);
    setExplorePlaces([]);
    setSelectedExplorePlace(null);
    setExploreRoute(null);
    setExploreStatus('');
    if (categoryKey) void loadExplorePlaces(categoryKey);
  };

  const toggleExplore = () => {
    clearLandmark();
    if (exploreOpen) {
      closeExplore();
      return;
    }
    setExploreOpen(true);
    setPujaOpen(false);
    setSelectedPoint(null);
    setSelectedPin(null);
    setRouteOpen(false);
    closePinForm();
  };

  const handleRouteToPlace = async (place: ExplorePlace) => {
    setExploreRouteLoading(true);
    setExploreStatus('Finding your location...');
    try {
      const me = userLocation || await getCurrentDevicePosition();
      setUserLocation({ lat: me.lat, lng: me.lng });
      setExploreStatus('Building route...');
      const start: RoutePlace = {
        id: 'me', name: 'Your location', lat: me.lat, lng: me.lng, category: 'Start',
        kind: 'suggested', visited: false, display_name: 'Your location', source: 'system',
      };
      const destination: RoutePlace = {
        id: place.id, name: place.name, lat: place.lat, lng: place.lng, category: exploreCategory?.category.label || 'Place',
        kind: 'suggested', visited: false, display_name: place.address || place.name, source: 'overpass',
      };
      setExploreRoute(await buildSmartRoute({ start, destination, travelMode: 'driving' }));
      setExploreStatus('');
    } catch (error) {
      setExploreStatus(error instanceof Error ? error.message : 'Could not build a route.');
    } finally {
      setExploreRouteLoading(false);
    }
  };

  const handlePinExplorePlace = (place: ExplorePlace) => {
    closeExplore();
    void handleStartPin({ lat: place.lat, lng: place.lng, title: place.name });
  };

  // Nudge people toward the Puja guide: the hint appears a second after the map opens, then fades away.
  useEffect(() => {
    const showTimer = window.setTimeout(() => setPujaHintOn(true), 1000);
    const hideTimer = window.setTimeout(() => setPujaHintOn(false), 6500);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, []);

  // Bring the map to the walker once, on the first GPS fix after tracking starts (not on every fix, so panning still works).
  const trailLat = trail.position?.lat;
  const trailLng = trail.position?.lng;
  useEffect(() => {
    if (!trail.tracking) {
      trailFlownRef.current = false;
      return;
    }
    if (trailFlownRef.current || trailLat === undefined || trailLng === undefined) return;
    trailFlownRef.current = true;
    mapRef.current?.flyTo([trailLat, trailLng], Math.max(mapRef.current.getZoom(), 16), { duration: 0.6 });
  }, [trail.tracking, trailLat, trailLng]);

  const toggleTrail = () => {
    if (trailCardOpen) {
      // Closing the card never stops a walk that is being recorded.
      setTrailCardOpen(false);
      return;
    }
    setTrailCardOpen(true);
    if (!trail.tracking) trail.start();
  };

  const togglePuja = () => {
    closeExplore();
    clearLandmark();
    setPujaOpen((current) => !current);
    setSelectedPandalId(null);
    setSelectedRestaurantId(null);
    setSelectedPoint(null);
    setSelectedPin(null);
    setRouteOpen(false);
    closePinForm();
  };

  const clearLandmark = () => {
    setSelectedLandmark(null);
    setLandmarkRoute(null);
    setLandmarkStatus('');
  };

  const handleLandmarkClick = (landmark: Landmark) => {
    setSelectedPlace(null);
    setSelectedLandmark(landmark);
    setLandmarkRoute(null);
    setLandmarkStatus('');
    setSelectedPoint(null);
    setSelectedPin(null);
    setPinFormOpen(false);
    setRouteOpen(false);
  };

  const handleRouteToLandmark = async (landmark: Landmark) => {
    setLandmarkRouteLoading(true);
    setLandmarkStatus('Finding your location...');
    try {
      const me = userLocation || await getCurrentDevicePosition();
      setUserLocation({ lat: me.lat, lng: me.lng });
      setLandmarkStatus('Building route...');
      const start: RoutePlace = {
        id: 'me', name: 'Your location', lat: me.lat, lng: me.lng, category: 'Start',
        kind: 'suggested', visited: false, display_name: 'Your location', source: 'system',
      };
      const destination: RoutePlace = {
        id: landmark.id, name: landmark.name, lat: landmark.lat, lng: landmark.lng, category: getLandmarkCategory(landmark.category).label,
        kind: 'suggested', visited: false, display_name: landmark.name, source: 'system',
      };
      setLandmarkRoute(await buildSmartRoute({ start, destination, travelMode: 'driving' }));
      setLandmarkStatus('');
    } catch (error) {
      setLandmarkStatus(error instanceof Error ? error.message : 'Could not build a route.');
    } finally {
      setLandmarkRouteLoading(false);
    }
  };

  const handlePinLandmark = (landmark: Landmark) => {
    clearLandmark();
    void handleStartPin({ lat: landmark.lat, lng: landmark.lng, title: landmark.name });
  };

  const toggleLandmarkCategory = (key: LandmarkCategoryKey) => {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handlePointClick = (pointItem: Map2Attraction) => {
    clearLandmark();
    setSelectedPlace(null);
    setSelectedPoint(pointItem);
    setSelectedPin(null);
    setPinFormOpen(false);
    setRouteOpen(false);
  };

  const handlePinClick = (pin: MapPinRecord) => {
    clearLandmark();
    setSelectedPlace(null);
    setSelectedPin(pin);
    setSelectedPoint(null);
    setPinFormOpen(false);
    setRouteOpen(false);
  };

  const handlePlaceClick = (place: ProviderPlace) => {
    clearLandmark();
    setSelectedPlace(place);
    setSelectedPoint(null);
    setSelectedPin(null);
    setPinFormOpen(false);
    setRouteOpen(false);
  };

  const onPlaceSelect = useStableCallback(handlePlaceClick);
  const onPointSelect = useStableCallback(handlePointClick);
  const onPinSelect = useStableCallback(handlePinClick);
  const onLandmarkSelect = useStableCallback(handleLandmarkClick);
  const onExplorePlaceSelect = useStableCallback((place: ExplorePlace) => {
    setSelectedExplorePlace(place);
    setExploreRoute(null);
  });
  const onPandalSelect = useStableCallback((pandal: (typeof PUJA_PANDALS)[number]) => {
    setSelectedPandalId(pandal.id);
    setSelectedRestaurantId(null);
  });
  const onRestaurantSelect = useStableCallback((restaurant: (typeof PUJA_RESTAURANTS)[number]) => {
    setSelectedRestaurantId(restaurant.id);
    setSelectedPandalId(null);
  });

  const closePinForm = () => {
    setPinFormOpen(false);
    setDraftPin(null);
    setPinStatus('');
  };

  /** Opens the pin form with the draft pin on the user's location, or the map centre if that is unavailable. */
  const handleStartPin = async (prefill?: { lat: number; lng: number; title: string }) => {
    clearLandmark();
    setSelectedPoint(null);
    setSelectedPin(null);
    setRouteOpen(false);
    setPinTitle(prefill?.title || '');
    setPinReview('');
    setPinRating(5);
    setPinStatus(user ? 'Finding your location...' : '');
    setPinFormOpen(true);
    if (!user) return;

    if (prefill) {
      setDraftPin({ lat: prefill.lat, lng: prefill.lng });
      setPinStatus('Pinned at this place. Choose a category and add your review.');
      return;
    }

    const center = mapRef.current?.getCenter();
    setDraftPin(center ? { lat: center.lat, lng: center.lng } : { lat: MAP2_CENTER[0], lng: MAP2_CENTER[1] });
    try {
      const location = await getCurrentDevicePosition();
      setUserLocation({ lat: location.lat, lng: location.lng });
      setDraftPin({ lat: location.lat, lng: location.lng });
      setPinStatus('Pinned at your location. Drag the pin or tap the map to move it.');
    } catch {
      setPinStatus('Could not get your location. Drag the pin or tap the map to place it.');
    }
  };

  const handleSavePin = async () => {
    if (!user || !draftPin) return;
    if (pinTitle.trim().length < 2) {
      setPinStatus('Give the place a name.');
      return;
    }
    setPinSaving(true);
    setPinStatus('Saving pin...');
    try {
      const saved = await createMapPin(
        { ...draftPin, category: pinCategory, title: pinTitle, review: pinReview, rating: pinRating },
        user.id,
        profile?.full_name || user.email?.split('@')[0] || 'Traveller',
      );
      setPins((current) => [saved, ...current]);
      closePinForm();
      setSelectedPin(saved);
    } catch (error) {
      setPinStatus(error instanceof Error ? error.message : 'Could not save the pin.');
    } finally {
      setPinSaving(false);
    }
  };

  const handleDeletePin = async (pin: MapPinRecord) => {
    try {
      await deleteMapPin(pin.id);
      setPins((current) => current.filter((item) => item.id !== pin.id));
      setSelectedPin(null);
    } catch {
      // Keep the sheet open; the pin is still there.
    }
  };

  const stopSpeechKeepAlive = () => {
    if (speechKeepAliveRef.current === null) return;
    window.clearInterval(speechKeepAliveRef.current);
    speechKeepAliveRef.current = null;
  };

  const getPreferredVoice = () => {
    const voices = window.speechSynthesis.getVoices();
    return voices.find((voice) => voice.lang.toLowerCase() === 'en-in')
      || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-') && voice.localService)
      || voices.find((voice) => voice.lang.toLowerCase().startsWith('en-'))
      || voices[0]
      || null;
  };

  const speakSelectedPoint = () => {
    if (!selectedPoint) return;
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance === 'undefined') {
      setAudioStatus('Audio is not supported in this browser.');
      return;
    }

    const synth = window.speechSynthesis;
    const voice = getPreferredVoice();

    stopSpeechKeepAlive();
    synth.cancel();

    const utterance = new window.SpeechSynthesisUtterance(
      `${selectedPoint.name}. ${selectedPoint.summary} Guide suggestion: ${selectedPoint.guide.name}, ${selectedPoint.guide.specialty}. Languages: ${selectedPoint.guide.languages}. Best time: ${selectedPoint.bestTime}.`,
    );

    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || 'en-IN';
    utterance.rate = 0.88;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => {
      setAudioStatus('Playing guide audio.');
      setAudioPlaying(true);
    };
    utterance.onend = () => {
      stopSpeechKeepAlive();
      activeUtteranceRef.current = null;
      setAudioPlaying(false);
      setAudioStatus('');
    };
    utterance.onerror = (event) => {
      stopSpeechKeepAlive();
      activeUtteranceRef.current = null;
      setAudioPlaying(false);
      setAudioStatus(event.error === 'interrupted' ? '' : 'Could not play the guide audio.');
    };

    activeUtteranceRef.current = utterance;
    setAudioStatus('Starting guide audio...');
    setAudioPlaying(true);
    synth.speak(utterance);
    synth.resume();

    speechKeepAliveRef.current = window.setInterval(() => {
      if (!synth.speaking) return;
      synth.pause();
      synth.resume();
    }, 9000);
  };

  const handlePlayAudio = () => {
    speakSelectedPoint();
  };

  const handleStopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    stopSpeechKeepAlive();
    activeUtteranceRef.current = null;
    setAudioStatus('');
    setAudioPlaying(false);
  };

  const handleLocate = async () => {
    setLocating(true);
    setRouteStatus('Finding your position...');
    try {
      const location = await getCurrentDevicePosition();
      setUserLocation({ lat: location.lat, lng: location.lng });
      setRouteStatus('Location found.');
    } catch (error) {
      setRouteStatus(error instanceof Error ? error.message : 'Could not find your location.');
    } finally {
      setLocating(false);
    }
  };

  const handleBuildRoute = async () => {
    if (startPoint.id === endPoint.id) {
      setRouteStatus('Choose two different points.');
      return;
    }

    setRouteLoading(true);
    setRouteStatus('Building route...');
    setRouteStops([]);

    try {
      let nextRoute: PlannedRoute;
      try {
        nextRoute = await buildSmartRoute({
          city: 'Kolkata',
          start: toRoutePlace(startPoint),
          destination: toRoutePlace(endPoint),
          travelMode,
        });
      } catch {
        nextRoute = createFallbackRoute(startPoint, endPoint, travelMode);
        setRouteStatus('Route service unavailable. Showing an estimated direct route.');
      }

      const curatedStops = MAP2_ATTRACTIONS
        .filter((item) => item.id !== startPoint.id && item.id !== endPoint.id)
        .map((item) => ({
          point: item,
          distance: distanceToRouteMeters(item, nextRoute.route_points),
        }))
        .filter((item) => item.distance <= 2200)
        .sort((left, right) => left.distance - right.distance)
        .slice(0, 5)
        .map((item) => toRoutePlace(item.point));

      let openSourceStops: RoutePlace[] = [];
      try {
        openSourceStops = await fetchRouteTouristPlaces(nextRoute.route_points);
      } catch {
        openSourceStops = [];
      }

      const dedupedStops = [...curatedStops, ...openSourceStops].filter((item, index, rows) => (
        rows.findIndex((candidate) => candidate.name.toLowerCase() === item.name.toLowerCase()) === index
      )).slice(0, 8);

      setPlannedRoute({
        ...nextRoute,
        recommended_places: dedupedStops,
        stop_names: dedupedStops.map((item) => item.name),
      });
      setRouteStops(dedupedStops);
      if (dedupedStops.length) {
        setRouteStatus(`${dedupedStops.length} tourist points added along this route.`);
      } else if (!nextRoute.recommended_places.length) {
        setRouteStatus('Route ready. No extra tourist points were found close to it.');
      }
      setRouteOpen(true);
    } finally {
      setRouteLoading(false);
    }
  };

  const locationDot = trail.position ?? userLocation;

  return (
    <main className="map2-page" aria-label="Tourist attraction map">
      <MapContainer
        center={MAP2_CENTER}
        zoom={12}
        minZoom={4}
        maxZoom={18}
        scrollWheelZoom
        zoomControl={false}
        className="map2-leaflet"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          crossOrigin="anonymous"
          updateWhenZooming={false}
        />
        <ZoomControl position="bottomright" />
        <Map2Viewport
          routePoints={(exploreOpen ? exploreRoute : pujaOpen ? pujaRoute : landmarkRoute || plannedRoute)?.route_points || NO_ROUTE_POINTS}
          selectedPoint={exploreOpen ? selectedExplorePlace : pujaOpen ? selectedPandal || selectedRestaurant : selectedPoint || selectedPin || selectedPlace || selectedLandmark}
          userLocation={userLocation}
        />
        <Map2Bridge
          mapRef={mapRef}
          onMapClick={pinFormOpen && user ? (position) => setDraftPin(position) : undefined}
          onMoveEnd={exploreOpen && exploreCategoryKey && !exploreLoading ? () => setExploreAreaStale(true) : undefined}
        />

        {exploreOpen && exploreRoute?.route_points.length ? (
          <Polyline
            pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.88, lineCap: 'round', lineJoin: 'round' }}
            positions={exploreRoute.route_points}
          />
        ) : null}

        {exploreOpen && exploreCategory ? explorePlaces.map((place) => (
          <MapMarker
            key={place.id}
            item={place}
            lat={place.lat}
            lng={place.lng}
            icon={buildEmojiMarkerIcon(exploreCategory.category.emoji, {
              active: selectedExplorePlace?.id === place.id,
            })}
            zIndexOffset={selectedExplorePlace?.id === place.id ? 800 : 400}
            onSelect={onExplorePlaceSelect}
            title={place.name}
          />
        )) : null}

        {!exploreOpen && !pujaOpen && landmarkRoute?.route_points.length ? (
          <Polyline
            pathOptions={{ color: '#2563eb', weight: 6, opacity: 0.88, lineCap: 'round', lineJoin: 'round' }}
            positions={landmarkRoute.route_points}
          />
        ) : null}

        {!exploreOpen && !pujaOpen && plannedRoute?.route_points.length ? (
          <Polyline
            pathOptions={{ color: '#ff741d', weight: 6, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }}
            positions={plannedRoute.route_points}
          />
        ) : null}

        {pujaOpen && pujaRoute?.route_points.length ? (
          <>
            {/* Soft yellow bloom, a thin gold edge for contrast on light tiles, then the yellow route itself. */}
            <Polyline
              pathOptions={{ color: PLAN_COLOR, weight: 18, opacity: 0.4, lineCap: 'round', lineJoin: 'round', className: 'map2-puja-route-glow' }}
              positions={pujaRoute.route_points}
              interactive={false}
            />
            <Polyline
              pathOptions={{ color: '#ca8a04', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
              positions={pujaRoute.route_points}
              interactive={false}
            />
            <Polyline
              pathOptions={{ color: PLAN_COLOR, weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round' }}
              positions={pujaRoute.route_points}
              interactive={false}
            />
          </>
        ) : null}

        {pujaOpen ? PUJA_PANDALS
          .filter((pandal) => !(showPlanOnly && pandalPlan.length) || pandalPlan.includes(pandal.id))
          .map((pandal) => {
            const planIndex = pandalPlan.indexOf(pandal.id);
            return (
              <MapMarker
                key={pandal.id}
                item={pandal}
                lat={pandal.lat}
                lng={pandal.lng}
                icon={buildPinIcon('durga_puja', {
                  active: selectedPandalId === pandal.id,
                  planNumber: planIndex >= 0 ? planIndex + 1 : undefined,
                })}
                zIndexOffset={planIndex >= 0 ? 500 : 0}
                onSelect={onPandalSelect}
                title={planIndex >= 0 ? `${planIndex + 1}. ${pandal.name}` : pandal.name}
              />
            );
          }) : null}

        {pujaOpen && showRestaurants ? PUJA_RESTAURANTS.map((restaurant) => (
          <MapMarker
            key={restaurant.id}
            item={restaurant}
            lat={restaurant.lat}
            lng={restaurant.lng}
            icon={buildRestaurantIcon({ active: selectedRestaurantId === restaurant.id })}
            zIndexOffset={selectedRestaurantId === restaurant.id ? 450 : -100}
            onSelect={onRestaurantSelect}
            title={`${restaurant.name} · ${restaurant.cuisine}`}
          />
        )) : null}

        {trail.segments.map((segment, index) => (segment.length > 1 ? (
          <React.Fragment key={`trail-${index}-${segment[0].t}`}>
            <Polyline
              pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
              positions={segment.map((point): [number, number] => [point.lat, point.lng])}
              interactive={false}
            />
            <Polyline
              pathOptions={{ color: '#0ea5e9', weight: 5, opacity: 1, lineCap: 'round', lineJoin: 'round', className: 'map2-trail-line' }}
              positions={segment.map((point): [number, number] => [point.lat, point.lng])}
              interactive={false}
            />
          </React.Fragment>
        ) : null))}

        {locationDot ? (
          <Marker icon={userLocationIcon} position={[locationDot.lat, locationDot.lng]} zIndexOffset={1000} />
        ) : null}

        {!pujaOpen && visibleAttractions.map((pointItem) => {
          const meta = ATTRACTION_META[pointItem.id];
          const category = meta ? getLandmarkCategory(meta.category) : null;
          return (
            <MapMarker
              key={pointItem.id}
              item={pointItem}
              lat={pointItem.lat}
              lng={pointItem.lng}
              icon={category
                ? buildEmojiMarkerIcon(category.emoji, {
                  active: selectedPoint?.id === pointItem.id,
                  route: routePointIds.has(pointItem.id),
                })
                : buildPinIcon(categoryFromLabel(pointItem.category), {
                  active: selectedPoint?.id === pointItem.id,
                  route: routePointIds.has(pointItem.id),
                })}
              zIndexOffset={200}
              onSelect={onPointSelect}
              title={pointItem.name}
            />
          );
        })}

        {!pujaOpen && !exploreOpen && landmarksOn ? (
          <LandmarkMarkers
            landmarks={visibleLandmarks}
            reserved={reservedSpots}
            selectedId={selectedLandmark?.id || null}
            onSelect={onLandmarkSelect}
          />
        ) : null}

        {!pujaOpen && !exploreOpen && placesOn ? places.map((place) => (
          <MapMarker
            key={place.id}
            item={place}
            lat={place.lat}
            lng={place.lng}
            icon={buildPlacePinIcon(place.category, { active: selectedPlace?.id === place.id })}
            zIndexOffset={selectedPlace?.id === place.id ? 900 : 300}
            onSelect={onPlaceSelect}
            title={place.name}
          />
        )) : null}

        {!pujaOpen && pins.map((pin) => (
          <MapMarker
            key={pin.id}
            item={pin}
            lat={pin.lat}
            lng={pin.lng}
            icon={buildPinIcon(pin.category, { active: selectedPin?.id === pin.id })}
            onSelect={onPinSelect}
            title={pin.title}
          />
        ))}

        {pinFormOpen && draftPin ? (
          <Marker
            icon={buildPinIcon(pinCategory, { draft: true })}
            position={[draftPin.lat, draftPin.lng]}
            draggable
            zIndexOffset={1000}
            eventHandlers={{
              dragend: (event) => {
                const { lat, lng } = (event.target as LeafletMarker).getLatLng();
                setDraftPin({ lat, lng });
              },
            }}
            title="New pin - drag to move"
          />
        ) : null}
      </MapContainer>

      <div className="map2-top-controls">
        <section className={`map2-search${searchOpen ? ' is-open' : ''}`} aria-label="Attraction search">
          <button
            type="button"
            className="map2-search-toggle"
            onClick={() => {
              setSearchOpen((current) => !current);
              if (searchOpen) setQuery('');
            }}
            aria-label={searchOpen ? 'Close search' : 'Open search'}
            title="Search"
          >
            {searchOpen ? <X size={17} /> : <Search size={18} />}
          </button>
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search places"
            aria-label="Search tourist places"
          />
        </section>

        <div className="map2-toolbar" aria-label="Map controls">
          <button
            type="button"
            className={`map2-tool${exploreOpen ? ' is-active' : ''}`}
            onClick={toggleExplore}
            aria-label="Explore nearby"
            title="Explore nearby"
            aria-pressed={exploreOpen}
          >
            <LayoutGrid size={19} />
          </button>
          <button
            type="button"
            className={`map2-tool${pinFormOpen ? ' is-active' : ''}`}
            onClick={() => {
              closeExplore();
              setPujaOpen(false);
              if (pinFormOpen) closePinForm();
              else void handleStartPin();
            }}
            aria-label="Pin a place"
            title="Pin a place"
          >
            <MapPinPlus size={19} />
          </button>
          <button
            type="button"
            className={`map2-tool${routeOpen ? ' is-active' : ''}`}
            onClick={() => {
              setRouteOpen((current) => !current);
              setSelectedPoint(null);
              setSelectedPin(null);
              setPujaOpen(false);
              closeExplore();
              clearLandmark();
              closePinForm();
            }}
            aria-label="Route creator"
            title="Route creator"
          >
            <Route size={19} />
          </button>
          <button
            type="button"
            className={`map2-tool map2-trail-toggle${trailCardOpen ? ' is-active' : ''}${trail.tracking ? ' is-live' : ''}`}
            onClick={toggleTrail}
            aria-pressed={trail.tracking}
            aria-label={trail.tracking ? 'Walk trail is recording' : 'Track my walk'}
            title={trail.tracking ? 'Walk trail is recording' : 'Track my walk'}
          >
            <Footprints size={19} />
          </button>
          <button
            type="button"
            className="map2-tool"
            onClick={() => void handleLocate()}
            disabled={locating}
            aria-label="Find my location"
            title="Find my location"
          >
            <LocateFixed size={19} />
          </button>
          <button
            type="button"
            className="map2-tool"
            onClick={() => window.dispatchEvent(new CustomEvent('tbp:toggle-mobile-menu'))}
            aria-label="Menu"
            title="Menu"
          >
            <Menu size={19} />
          </button>
        </div>
        <button
          type="button"
          className={`map2-puja-toggle${pujaOpen ? ' is-active' : ''}`}
          onClick={togglePuja}
          aria-pressed={pujaOpen}
          aria-label={pujaOpen ? 'Exit Puja guide' : 'Open Durga Puja guide'}
          title={pujaOpen ? 'Exit Puja guide' : 'Durga Puja guide'}
        >
          <img src="/icons/puja.png" alt="" draggable={false} />
        </button>
        {!pujaOpen ? (
          <span className={`map2-puja-hint${pujaHintOn ? ' is-visible' : ''}`} aria-hidden="true">
            <span className="map2-puja-hint-text">Puja guide</span>
            <svg className="map2-puja-hint-arrow" viewBox="0 0 56 36" width="56" height="36" fill="none">
              <path d="M2 22 C 12 4, 30 4, 50 18" pathLength="1" />
              <path d="M45.9 10 L50 18 L41.1 16.9" pathLength="1" className="map2-puja-hint-head" />
            </svg>
          </span>
        ) : null}
      </div>

      {trailCardOpen ? (
        <WalkTrailCard
          tracking={trail.tracking}
          distance={trail.distance}
          duration={trail.duration}
          pointCount={trail.pointCount}
          accuracy={trail.position ? trail.position.accuracy : null}
          keepAwake={trail.keepAwake}
          error={trail.error}
          onStart={trail.start}
          onStop={trail.stop}
          onClear={trail.clear}
        />
      ) : null}

      {exploreOpen ? (
        <ExplorePanel
          groupKey={exploreGroupKey}
          onGroupChange={setExploreGroupKey}
          categoryKey={exploreCategoryKey}
          onCategoryChange={handleExploreCategory}
          places={explorePlaces}
          loading={exploreLoading}
          status={exploreStatus}
          selectedPlace={selectedExplorePlace}
          onSelectPlace={(place) => { setSelectedExplorePlace(place); setExploreRoute(null); }}
          route={exploreRoute}
          routeLoading={exploreRouteLoading}
          onRouteToPlace={(place) => void handleRouteToPlace(place)}
          onPinPlace={handlePinExplorePlace}
          onClose={closeExplore}
        />
      ) : null}

      {exploreOpen && exploreCategoryKey && (exploreAreaStale || exploreLoading) ? (
        <button
          type="button"
          className="map2-search-area"
          onClick={() => void loadExplorePlaces(exploreCategoryKey)}
          disabled={exploreLoading}
        >
          {exploreLoading ? 'Searching…' : 'Search this area'}
        </button>
      ) : null}

      {pujaOpen ? (
        <PujaGuidePanel
          userId={userId}
          plan={pandalPlan}
          onPlanChange={handlePlanChange}
          selectedPandalId={selectedPandalId}
          onSelectPandal={setSelectedPandalId}
          route={pujaRoute}
          onRouteChange={setPujaRoute}
          userLocation={userLocation}
          showPlanOnly={showPlanOnly}
          onShowPlanOnlyChange={setShowPlanOnly}
          showRestaurants={showRestaurants}
          onShowRestaurantsChange={setShowRestaurants}
          selectedRestaurantId={selectedRestaurantId}
          onSelectRestaurant={setSelectedRestaurantId}
          onClose={togglePuja}
        />
      ) : null}

      {searchOpen && query.trim() && (
        <section className="map2-search-results" aria-label="Matching tourist places">
          {searchResults.length ? searchResults.map((item) => (
            <button
              type="button"
              key={`${item.kind}-${item.id}`}
              onClick={() => {
                if (item.kind === 'attraction') handlePointClick(item.attraction);
                else handleLandmarkClick(item.landmark);
                setQuery('');
                setSearchOpen(false);
              }}
            >
              <span>{item.name}</span>
              <small>{item.label}</small>
            </button>
          )) : (
            <p>No places found.</p>
          )}
        </section>
      )}

      {routeOpen ? (
        <aside className="map2-route-panel" aria-label="Route creator">
          <div className="map2-panel-head">
            <div>
              <span>Route creator</span>
              <h1>{startPoint.name} to {endPoint.name}</h1>
            </div>
            <button type="button" className="map2-icon-btn" onClick={() => setRouteOpen(false)} aria-label="Close route creator">
              <X size={18} />
            </button>
          </div>

          <div className="map2-route-fields">
            <label>
              <span>Start</span>
              <select value={startId} onChange={(event) => setStartId(event.target.value)}>
                {MAP2_ATTRACTIONS.map((item) => (
                  <option key={`start-${item.id}`} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Destination</span>
              <select value={endId} onChange={(event) => setEndId(event.target.value)}>
                {MAP2_ATTRACTIONS.map((item) => (
                  <option key={`end-${item.id}`} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="map2-mode-row" aria-label="Travel mode">
            {(['driving', 'walking', 'cycling'] as TravelMode[]).map((mode) => (
              <button
                type="button"
                key={mode}
                className={travelMode === mode ? 'is-active' : ''}
                onClick={() => setTravelMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="map2-route-primary"
            onClick={() => void handleBuildRoute()}
            disabled={routeLoading}
          >
            <Navigation size={18} />
            <span>{routeLoading ? 'Building route' : 'Make route'}</span>
          </button>

          <p className="map2-status">{routeStatus}</p>

          {plannedRoute ? (
            <>
              <div className="map2-route-metrics">
                <div><span>Distance</span><strong>{formatRouteDistance(plannedRoute.distance_meters)}</strong></div>
                <div><span>Duration</span><strong>{formatRouteDuration(plannedRoute.duration_seconds)}</strong></div>
                <div><span>Stops</span><strong>{routeStops.length}</strong></div>
              </div>

              {routeStops.length ? (
                <div className="map2-stop-list">
                  <div className="map2-stop-title">
                    <MapPinned size={16} />
                    <strong>On this route</strong>
                  </div>
                  {routeStops.map((stop) => (
                    <button
                      type="button"
                      key={stop.id}
                      onClick={() => {
                        const matching = MAP2_ATTRACTIONS.find((item) => item.name.toLowerCase() === stop.name.toLowerCase());
                        if (matching) handlePointClick(matching);
                      }}
                    >
                      <span>{stop.name}</span>
                      <small>{stop.category}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </aside>
      ) : null}

      {pinFormOpen ? (
        <aside className="map2-detail-sheet map2-pin-form" aria-label="Pin a place">
          <div className="map2-panel-head">
            <div>
              <span>New pin</span>
              <h1>Share a place</h1>
            </div>
            <button type="button" className="map2-icon-btn" onClick={closePinForm} aria-label="Close pin form">
              <X size={18} />
            </button>
          </div>

          {!user ? (
            <>
              <p>Log in to pin places on the map and share a review with other travellers.</p>
              <Link to="/login" className="map2-route-primary">Log in to pin</Link>
            </>
          ) : (
            <form
              className="map2-pin-fields"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSavePin();
              }}
            >
              <fieldset>
                <legend>Category</legend>
                <div className="map2-category-grid">
                  {PIN_CATEGORIES.map(({ key, label, color, Icon }) => (
                    <button
                      type="button"
                      key={key}
                      className={pinCategory === key ? 'is-active' : ''}
                      style={{ ['--pin-color' as string]: color }}
                      aria-pressed={pinCategory === key}
                      onClick={() => setPinCategory(key)}
                    >
                      <i aria-hidden="true"><Icon size={14} /></i>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label>
                <span>Place name</span>
                <input
                  value={pinTitle}
                  onChange={(event) => setPinTitle(event.target.value)}
                  placeholder="e.g. Bagbazar Sarbojanin pandal"
                  maxLength={80}
                  required
                />
              </label>

              <fieldset>
                <legend>Rating</legend>
                <div className="map2-rating-input">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      className={star <= pinRating ? 'is-on' : ''}
                      onClick={() => setPinRating(star)}
                      aria-label={`${star} star${star > 1 ? 's' : ''}`}
                      aria-pressed={star === pinRating}
                    >
                      <Star size={22} />
                    </button>
                  ))}
                </div>
              </fieldset>

              <label>
                <span>Review</span>
                <textarea
                  value={pinReview}
                  onChange={(event) => setPinReview(event.target.value)}
                  placeholder="What should others know about this place?"
                  maxLength={1000}
                  rows={3}
                />
              </label>

              {draftPin ? (
                <small className="map2-pin-coords">
                  {draftPin.lat.toFixed(5)}, {draftPin.lng.toFixed(5)}
                </small>
              ) : null}

              <button type="submit" className="map2-route-primary" disabled={pinSaving || !draftPin}>
                <MapPinPlus size={18} />
                <span>{pinSaving ? 'Saving pin' : 'Save pin'}</span>
              </button>
            </form>
          )}

          {pinStatus ? <p className="map2-status">{pinStatus}</p> : null}
        </aside>
      ) : null}

      {selectedPin && !routeOpen && !pinFormOpen ? (() => {
        const category = getPinCategory(selectedPin.category);
        const CategoryIcon = category.Icon;
        return (
          <aside className="map2-detail-sheet" aria-label={`${selectedPin.title} details`}>
            <div className="map2-panel-head">
              <div>
                <span className="map2-pin-category">
                  <i style={{ ['--pin-color' as string]: category.color }} aria-hidden="true"><CategoryIcon size={12} /></i>
                  {category.label}
                </span>
                <h1>{selectedPin.title}</h1>
              </div>
              <button type="button" className="map2-icon-btn" onClick={() => setSelectedPin(null)} aria-label="Close pin details">
                <X size={18} />
              </button>
            </div>

            <StarRating value={selectedPin.rating} />
            {selectedPin.review ? <p>{selectedPin.review}</p> : null}

            <small className="map2-best-time">
              Pinned by {selectedPin.user_id === user?.id ? 'you' : selectedPin.author_name}
              {' · '}
              {new Date(selectedPin.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </small>
            <small className="map2-pin-coords">{selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}</small>

            <div className="map2-detail-actions">
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPin.lat},${selectedPin.lng}`}
                target="_blank"
                rel="noreferrer"
                className="map2-audio-btn"
              >
                <Navigation size={17} />
                <span>Directions</span>
              </a>
              {selectedPin.user_id === user?.id ? (
                <button type="button" onClick={() => void handleDeletePin(selectedPin)}>
                  <Trash2 size={16} />
                  <span>Remove</span>
                </button>
              ) : null}
            </div>
          </aside>
        );
      })() : null}

      {selectedPlace && !selectedPoint && !selectedPin && !routeOpen && !pinFormOpen && !pujaOpen && !exploreOpen ? (() => {
        const category = getPlaceCategory(selectedPlace.category);
        const CategoryIcon = category.Icon;
        const listingPath = selectedPlace.listing_id
          ? `/listings/${selectedPlace.listing_type === 'guide' ? 'event' : selectedPlace.listing_type || 'activity'}/${selectedPlace.listing_id}`
          : null;
        return (
          <aside className="map2-detail-sheet" aria-label={`${selectedPlace.name} details`}>
            <div className="map2-panel-head">
              <div>
                <span className="map2-pin-category">
                  <i style={{ ['--pin-color' as string]: category.color }} aria-hidden="true"><CategoryIcon size={12} /></i>
                  {getPlaceDisplayLabel(selectedPlace)}
                </span>
                <h1>{selectedPlace.name}</h1>
              </div>
              <button type="button" className="map2-icon-btn" onClick={() => setSelectedPlace(null)} aria-label="Close place details">
                <X size={18} />
              </button>
            </div>
            {selectedPlace.description ? <p>{selectedPlace.description}</p> : null}
            {selectedPlace.address ? <small className="map2-best-time">{selectedPlace.address}</small> : null}
            <div className="map2-detail-actions map2-detail-actions--two">
              {listingPath ? (
                <Link to={listingPath} className="map2-audio-btn">
                  <span>View and book</span>
                </Link>
              ) : null}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${selectedPlace.lat},${selectedPlace.lng}`}
                target="_blank"
                rel="noreferrer"
                className="map2-audio-btn"
              >
                <Navigation size={17} />
                <span>Directions</span>
              </a>
            </div>
          </aside>
        );
      })() : null}

      {selectedLandmark && !selectedPoint && !selectedPin && !selectedPlace && !routeOpen && !pinFormOpen && !pujaOpen && !exploreOpen ? (
        <LandmarkSheet
          landmark={selectedLandmark}
          route={landmarkRoute}
          routeLoading={landmarkRouteLoading}
          status={landmarkStatus}
          onRoute={(landmark) => void handleRouteToLandmark(landmark)}
          onPin={handlePinLandmark}
          onClose={clearLandmark}
        />
      ) : null}

      {pujaOpen || exploreOpen ? (
        <section className="map2-landmarks is-covered" aria-label="Map download">
          <div className="map2-landmarks-row">
            <MapDownloadButton getMap={() => mapRef.current} />
          </div>
        </section>
      ) : (
        <LandmarkLayerControl
          open={landmarkPanelOpen}
          onOpenChange={setLandmarkPanelOpen}
          enabled={landmarksOn}
          onEnabledChange={setLandmarksOn}
          zone={landmarkZone}
          onZoneChange={setLandmarkZone}
          hiddenCategories={hiddenCategories}
          onToggleCategory={toggleLandmarkCategory}
          onReset={() => { setLandmarksOn(true); setLandmarkZone('All'); setHiddenCategories(new Set()); }}
          zoneCounts={layerZoneCounts}
          categoryCounts={layerCategoryCounts}
          total={layerTotal}
          covered={Boolean(selectedPoint || selectedPin || selectedPlace || selectedLandmark || routeOpen || pinFormOpen)}
          placesEnabled={placesOn}
          onPlacesEnabledChange={setPlacesOn}
          placesCount={places.length}
          actions={<MapDownloadButton getMap={() => mapRef.current} />}
        />
      )}

      {selectedPoint && !routeOpen && !pinFormOpen ? (
        <aside className="map2-detail-sheet" aria-label={`${selectedPoint.name} details`}>
          <div className="map2-panel-head">
            <div>
              <span>{selectedPoint.category}</span>
              <h1>{selectedPoint.name}</h1>
            </div>
            <button type="button" className="map2-icon-btn" onClick={() => setSelectedPoint(null)} aria-label="Close place details">
              <X size={18} />
            </button>
          </div>

          <p>{selectedPoint.summary}</p>

          <div className="map2-guide-strip">
            <Compass size={17} />
            <div>
              <strong>{selectedPoint.guide.name}</strong>
              <span>{selectedPoint.guide.specialty} - {selectedPoint.guide.languages}</span>
            </div>
          </div>

          <div className="map2-detail-actions">
            <button
              type="button"
              className="map2-audio-btn"
              onClick={audioPlaying ? handleStopAudio : handlePlayAudio}
            >
              {audioPlaying ? <Pause size={17} /> : <Play size={17} />}
              <span>{audioPlaying ? 'Stop audio' : 'Hear guide'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setStartId(selectedPoint.id);
                setRouteOpen(true);
              }}
            >
              Start
            </button>
            <button
              type="button"
              onClick={() => {
                setEndId(selectedPoint.id);
                setRouteOpen(true);
              }}
            >
              End
            </button>
          </div>

          {audioStatus ? <small className="map2-audio-status">{audioStatus}</small> : null}
          <small className="map2-best-time">Best time: {selectedPoint.bestTime}</small>
        </aside>
      ) : null}
    </main>
  );
};
