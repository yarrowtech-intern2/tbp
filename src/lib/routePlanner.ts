import { supabase } from './supabase';

export type TravelMode = 'driving' | 'walking' | 'cycling';

export type RoutePlaceKind = 'anchor' | 'suggested' | 'route_waypoint';

export type RoutePlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  kind: RoutePlaceKind;
  visited: boolean;
  display_name?: string;
  source?: 'overpass' | 'nominatim' | 'system';
};

export type RouteFormDraft = {
  travelMode: TravelMode;
};

export type RouteHistoryRecord = {
  id: string;
  client_route_id: string;
  user_id: string | null;
  title: string;
  city: string;
  travel_mode: TravelMode;
  start_name: string;
  destination_name: string;
  stop_names: string[];
  route_points: Array<[number, number]>;
  waypoints: RoutePlace[];
  recommended_places: RoutePlace[];
  distance_meters: number;
  duration_seconds: number;
  visited_at: string;
  created_at: string;
  source: 'local' | 'supabase';
};

export type PlannedRoute = Omit<RouteHistoryRecord, 'id' | 'user_id' | 'visited_at' | 'created_at' | 'source'>;

export type DeviceLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
};

const getGeolocationErrorMessage = (error: GeolocationPositionError) => {
  if (error.code === error.PERMISSION_DENIED) {
    return 'Location access was denied. Enable it in your browser to build routes from your position.';
  }
  if (error.code === error.TIMEOUT) {
    return 'Location lookup timed out. Try again where GPS or network coverage is stronger.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Your device could not determine a location right now. Try again in a moment.';
  }
  return error.message || 'Could not access your location.';
};

type NominatimSearchResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: Record<string, string>;
};

type OverpassElement = {
  id?: number;
  lat?: number;
  lon?: number;
  center?: {
    lat?: number;
    lon?: number;
  };
  tags?: Record<string, string>;
  type?: string;
};

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OsrmRouteResponse = {
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      coordinates?: number[][];
    };
  }>;
};

const ROUTE_TABLE = 'tourist_routes';
const DEFAULT_DRAFT: RouteFormDraft = {
  travelMode: 'driving',
};
const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const OSRM_URL = 'https://router.project-osrm.org/route/v1';

const storageAvailable = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
const getDraftStorageKey = (userId?: string | null) => `tbp.route.draft.${userId || 'guest'}`;
const getHistoryStorageKey = (userId: string) => `tbp.route.history.${userId}`;

const createClientRouteId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `route-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createPlaceId = (prefix: string, name: string, lat: number, lng: number) => (
  `${prefix}:${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}:${lat.toFixed(5)}:${lng.toFixed(5)}`
);

const readLocalJson = <T,>(key: string, fallback: T): T => {
  if (!storageAvailable()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const writeLocalJson = (key: string, value: unknown) => {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota failures.
  }
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const haversineDistanceMeters = (
  first: { lat: number; lng: number },
  second: { lat: number; lng: number },
) => {
  const earthRadius = 6371000;
  const latDelta = toRadians(second.lat - first.lat);
  const lngDelta = toRadians(second.lng - first.lng);
  const startLat = toRadians(first.lat);
  const endLat = toRadians(second.lat);
  const a = Math.sin(latDelta / 2) ** 2
    + Math.cos(startLat) * Math.cos(endLat) * Math.sin(lngDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const projectToMeters = (lat: number, lng: number, referenceLat: number) => ({
  x: lng * 111320 * Math.cos(toRadians(referenceLat)),
  y: lat * 110540,
});

const pointToSegmentDistanceMeters = (
  point: { lat: number; lng: number },
  segmentStart: { lat: number; lng: number },
  segmentEnd: { lat: number; lng: number },
) => {
  const referenceLat = (point.lat + segmentStart.lat + segmentEnd.lat) / 3;
  const projectedPoint = projectToMeters(point.lat, point.lng, referenceLat);
  const projectedStart = projectToMeters(segmentStart.lat, segmentStart.lng, referenceLat);
  const projectedEnd = projectToMeters(segmentEnd.lat, segmentEnd.lng, referenceLat);
  const segmentX = projectedEnd.x - projectedStart.x;
  const segmentY = projectedEnd.y - projectedStart.y;
  const lengthSquared = segmentX ** 2 + segmentY ** 2;

  if (lengthSquared === 0) {
    return Math.hypot(projectedPoint.x - projectedStart.x, projectedPoint.y - projectedStart.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((projectedPoint.x - projectedStart.x) * segmentX + (projectedPoint.y - projectedStart.y) * segmentY) / lengthSquared,
    ),
  );
  const closestX = projectedStart.x + t * segmentX;
  const closestY = projectedStart.y + t * segmentY;
  return Math.hypot(projectedPoint.x - closestX, projectedPoint.y - closestY);
};

const minDistanceToPolylineMeters = (
  point: { lat: number; lng: number },
  polyline: Array<[number, number]>,
) => {
  if (polyline.length < 2) return Infinity;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const distance = pointToSegmentDistanceMeters(
      point,
      { lat: polyline[index][0], lng: polyline[index][1] },
      { lat: polyline[index + 1][0], lng: polyline[index + 1][1] },
    );
    if (distance < best) best = distance;
  }
  return best;
};

const parseRoutePoints = (value: unknown): Array<[number, number]> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!Array.isArray(item) || item.length < 2) return null;
      const lat = Number(item[0]);
      const lng = Number(item[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return [lat, lng] as [number, number];
    })
    .filter((item): item is [number, number] => Boolean(item));
};

const parseRoutePlaces = (value: unknown, fallbackKind: RoutePlaceKind): RoutePlace[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const name = typeof row.name === 'string' ? row.name.trim() : '';
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const category = typeof row.category === 'string' && row.category.trim()
        ? row.category.trim()
        : 'Place';
      const kind = row.kind === 'anchor' || row.kind === 'suggested' || row.kind === 'route_waypoint'
        ? row.kind
        : fallbackKind;

      const place: RoutePlace = {
        id: typeof row.id === 'string' && row.id.trim() ? row.id.trim() : createPlaceId(kind, name, lat, lng),
        name,
        lat,
        lng,
        category,
        kind,
        visited: Boolean(row.visited),
        display_name: typeof row.display_name === 'string' ? row.display_name : undefined,
        source: row.source === 'overpass' || row.source === 'nominatim' || row.source === 'system'
          ? row.source
          : 'system',
      };
      return place;
    })
    .filter((item): item is RoutePlace => Boolean(item));
};

const parseStopNames = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const mapRouteRow = (row: Record<string, unknown>, source: 'local' | 'supabase'): RouteHistoryRecord | null => {
  const id = typeof row.id === 'string' && row.id.trim() ? row.id.trim() : createClientRouteId();
  const clientRouteId = typeof row.client_route_id === 'string' && row.client_route_id.trim()
    ? row.client_route_id.trim()
    : id;
  const title = typeof row.title === 'string' ? row.title.trim() : '';
  const startName = typeof row.start_name === 'string' ? row.start_name.trim() : '';
  const destinationName = typeof row.destination_name === 'string' ? row.destination_name.trim() : '';
  if (!title || !startName || !destinationName) return null;

  const recommendedPlaces = parseRoutePlaces(row.recommended_places, 'suggested');
  const waypoints = parseRoutePlaces(row.waypoints, 'route_waypoint');
  const stopNames = parseStopNames(row.stop_names).length
    ? parseStopNames(row.stop_names)
    : recommendedPlaces.map((item) => item.name);

  return {
    id,
    client_route_id: clientRouteId,
    user_id: typeof row.user_id === 'string' ? row.user_id : null,
    title,
    city: typeof row.city === 'string' ? row.city.trim() : '',
    travel_mode: row.travel_mode === 'walking' || row.travel_mode === 'cycling' ? row.travel_mode : 'driving',
    start_name: startName,
    destination_name: destinationName,
    stop_names: stopNames,
    route_points: parseRoutePoints(row.route_points),
    waypoints,
    recommended_places: recommendedPlaces,
    distance_meters: Number(row.distance_meters) || 0,
    duration_seconds: Number(row.duration_seconds) || 0,
    visited_at: typeof row.visited_at === 'string' ? row.visited_at : new Date().toISOString(),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
    source,
  };
};

const mergeHistory = (primary: RouteHistoryRecord[], secondary: RouteHistoryRecord[]) => {
  const merged = new Map<string, RouteHistoryRecord>();
  [...secondary, ...primary].forEach((item) => {
    merged.set(item.client_route_id, item);
  });
  return [...merged.values()].sort(
    (a, b) => new Date(b.visited_at).getTime() - new Date(a.visited_at).getTime(),
  );
};

const getLocalRouteHistory = (userId: string): RouteHistoryRecord[] => readLocalJson<Record<string, unknown>[]>(
  getHistoryStorageKey(userId),
  [],
).map((item) => mapRouteRow(item, 'local')).filter((item): item is RouteHistoryRecord => Boolean(item));

const saveLocalRouteHistory = (userId: string, route: RouteHistoryRecord) => {
  const nextRows = mergeHistory([route], getLocalRouteHistory(userId)).map((item) => ({
    ...item,
    source: 'local',
  }));
  writeLocalJson(getHistoryStorageKey(userId), nextRows);
};

const updateLocalVisitedState = (userId: string, clientRouteId: string, places: RoutePlace[]) => {
  const history = getLocalRouteHistory(userId);
  const next = history.map((item) => (
    item.client_route_id === clientRouteId
      ? {
        ...item,
        recommended_places: places,
        stop_names: places.map((place) => place.name),
      }
      : item
  ));
  writeLocalJson(getHistoryStorageKey(userId), next.map((item) => ({ ...item, source: 'local' })));
};

const mapModeToOsrmProfile = (mode: TravelMode): string => {
  if (mode === 'walking') return 'walking';
  if (mode === 'cycling') return 'cycling';
  return 'driving';
};

const toFriendlyRequestError = (status?: number) => {
  if (status === 504) {
    return new Error('The route service took too long to respond. Try again in a moment.');
  }
  if (status === 429) {
    return new Error('The map service is busy right now. Please wait a moment and try again.');
  }
  if (status === 502 || status === 503) {
    return new Error('The map service is temporarily unavailable. Please try again shortly.');
  }
  return new Error(status ? `Request failed with status ${status}.` : 'The map service request failed.');
};

const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error('Could not reach the map service. Check your connection and try again.');
  }

  if (!response.ok) {
    throw toFriendlyRequestError(response.status);
  }
  return response.json() as Promise<T>;
};

const fetchJsonFromFallbackUrls = async <T,>(urls: string[], initFactory: (url: string) => RequestInit): Promise<T> => {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      return await fetchJson<T>(url, initFactory(url));
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('The map service request failed.');
    }
  }

  throw lastError || new Error('The map service request failed.');
};

const fetchJsonWithTimeout = async <T,>(url: string, init: RequestInit, timeoutMs: number): Promise<T> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchJson<T>(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

const fetchJsonFromFallbackUrlsWithTimeout = async <T,>(
  urls: string[],
  initFactory: (url: string) => RequestInit,
  timeoutMs: number,
): Promise<T> => {
  let lastError: Error | null = null;

  for (const url of urls) {
    try {
      return await fetchJsonWithTimeout<T>(url, initFactory(url), timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('The map service request failed.');
    }
  }

  throw lastError || new Error('The map service request failed.');
};

const reverseGeocodeCity = async (lat: number, lng: number): Promise<string> => {
  const url = new URL(NOMINATIM_REVERSE_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('zoom', '10');
  url.searchParams.set('addressdetails', '1');

  const result = await fetchJson<NominatimSearchResult>(url.toString(), {
    headers: { Accept: 'application/json' },
  });
  const address = result.address || {};
  return address.city || address.town || address.state_district || address.county || '';
};

const toRoutePoint = (element: OverpassElement) => {
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const tagCategory = (tags: Record<string, string> = {}) => {
  if (tags.railway === 'station' || tags.public_transport === 'station') return 'Transit hub';
  if (tags.tourism === 'museum') return 'Museum';
  if (tags.tourism === 'gallery') return 'Gallery';
  if (tags.tourism === 'viewpoint') return 'Viewpoint';
  if (tags.tourism === 'attraction') return 'Attraction';
  if (tags.historic) return 'Historic';
  if (tags.leisure === 'park') return 'Park';
  if (tags.amenity === 'marketplace') return 'Market';
  if (tags.amenity === 'place_of_worship') return 'Landmark';
  return 'Place';
};

const scoreAnchor = (tags: Record<string, string>, distanceMeters: number) => {
  let score = Math.max(0, 4000 - distanceMeters) / 120;
  if (tags.railway === 'station') score += 32;
  if (tags.public_transport === 'station') score += 24;
  if (tags.tourism === 'attraction') score += 18;
  if (tags.tourism === 'museum') score += 18;
  if (tags.historic) score += 16;
  if (tags.leisure === 'park') score += 10;
  if (tags.wikidata) score += 8;
  if (tags.wikipedia) score += 8;
  return score;
};

const scoreSuggestedPlace = (tags: Record<string, string>, distanceToRouteMeters: number) => {
  let score = Math.max(0, 900 - distanceToRouteMeters) / 10;
  if (tags.tourism === 'museum' || tags.tourism === 'attraction') score += 24;
  if (tags.tourism === 'gallery' || tags.tourism === 'viewpoint') score += 18;
  if (tags.historic) score += 18;
  if (tags.amenity === 'place_of_worship') score += 12;
  if (tags.leisure === 'park') score += 10;
  if (tags.wikidata) score += 8;
  if (tags.wikipedia) score += 8;
  return score;
};

const dedupePlaces = (places: RoutePlace[]) => {
  const seen = new Set<string>();
  return places.filter((item) => {
    const key = `${item.name.toLowerCase()}|${item.category}|${item.lat.toFixed(4)}|${item.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildNearbyAnchorQuery = (location: DeviceLocation, radiusMeters: number) => `
[out:json][timeout:20];
(
  node(around:${radiusMeters},${location.lat},${location.lng})[railway=station];
  node(around:${radiusMeters},${location.lat},${location.lng})[public_transport=station];
  node(around:${radiusMeters},${location.lat},${location.lng})[tourism~"^(attraction|museum|gallery|viewpoint)$"];
  node(around:${radiusMeters},${location.lat},${location.lng})[historic];
  node(around:${radiusMeters},${location.lat},${location.lng})[leisure=park];
  node(around:${radiusMeters},${location.lat},${location.lng})[amenity=marketplace];
  way(around:${radiusMeters},${location.lat},${location.lng})[railway=station];
  way(around:${radiusMeters},${location.lat},${location.lng})[tourism~"^(attraction|museum|gallery|viewpoint)$"];
  way(around:${radiusMeters},${location.lat},${location.lng})[historic];
  way(around:${radiusMeters},${location.lat},${location.lng})[leisure=park];
);
out center tags;
`;

const sampleRoutePoints = (routePoints: Array<[number, number]>, maxSamples = 7) => {
  if (routePoints.length <= maxSamples) return routePoints;
  const indices = new Set<number>();
  for (let index = 0; index < maxSamples; index += 1) {
    indices.add(Math.round((index / (maxSamples - 1)) * (routePoints.length - 1)));
  }
  return [...indices].map((index) => routePoints[index]);
};

const buildRouteSuggestionQuery = (routePoints: Array<[number, number]>, radiusMeters: number) => {
  const samples = sampleRoutePoints(routePoints);
  const aroundClauses = samples.map(([lat, lng]) => `
  node(around:${radiusMeters},${lat},${lng})[tourism~"^(attraction|museum|gallery|viewpoint)$"][name];
  node(around:${radiusMeters},${lat},${lng})[historic][name];
  node(around:${radiusMeters},${lat},${lng})[leisure=park][name];
  node(around:${radiusMeters},${lat},${lng})[amenity=place_of_worship][name];
  way(around:${radiusMeters},${lat},${lng})[tourism~"^(attraction|museum|gallery|viewpoint)$"][name];
  way(around:${radiusMeters},${lat},${lng})[historic][name];
  way(around:${radiusMeters},${lat},${lng})[leisure=park][name];`).join('');

  return `
[out:json][timeout:8];
(
${aroundClauses}
);
out center tags 60;
`;
};

export const fetchNearbyAnchors = async (
  location: DeviceLocation,
  city?: string,
): Promise<RoutePlace[]> => {
  const query = buildNearbyAnchorQuery(location, 3200);
  const response = await fetchJsonFromFallbackUrls<OverpassResponse>(OVERPASS_URLS, () => {
    const payload = new URLSearchParams({ data: query });
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: payload.toString(),
    };
  });

  const anchors = (response.elements || []).reduce<Array<{ place: RoutePlace; score: number }>>((acc, element) => {
      const coords = toRoutePoint(element);
      const tags = element.tags || {};
      const name = (tags.name || '').trim();
      if (!coords || !name) return acc;
      const distanceMeters = haversineDistanceMeters(location, coords);
      const place: RoutePlace = {
        id: createPlaceId(`anchor-${element.type || 'osm'}`, name, coords.lat, coords.lng),
        name,
        lat: coords.lat,
        lng: coords.lng,
        category: tagCategory(tags),
        kind: 'anchor',
        visited: false,
        display_name: city ? `${name}, ${city}` : name,
        source: 'overpass',
      };
      acc.push({
        place: {
          ...place,
        },
        score: scoreAnchor(tags, distanceMeters),
      });
      return acc;
    }, [])
    .sort((left, right) => right.score - left.score)
    .map((item) => item.place);

  return dedupePlaces(anchors).slice(0, 12);
};

export const fetchRouteTouristPlaces = async (
  routePoints: Array<[number, number]>,
): Promise<RoutePlace[]> => {
  if (routePoints.length < 2) return [];

  const query = buildRouteSuggestionQuery(routePoints, 850);
  const response = await fetchJsonFromFallbackUrlsWithTimeout<OverpassResponse>(OVERPASS_URLS, () => {
    const payload = new URLSearchParams({ data: query });
    return {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: payload.toString(),
    };
  }, 9000);

  const places = (response.elements || []).reduce<Array<{ place: RoutePlace; score: number; routeIndex: number }>>(
    (acc, element) => {
      const coords = toRoutePoint(element);
      const tags = element.tags || {};
      const name = (tags.name || '').trim();
      if (!coords || !name) return acc;

      const distanceToRouteMeters = minDistanceToPolylineMeters(coords, routePoints);
      if (distanceToRouteMeters > 950) return acc;

      let routeIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      routePoints.forEach((point, index) => {
        const distance = haversineDistanceMeters(coords, { lat: point[0], lng: point[1] });
        if (distance < bestDistance) {
          bestDistance = distance;
          routeIndex = index;
        }
      });

      acc.push({
        place: {
          id: createPlaceId(`suggested-${element.type || 'osm'}`, name, coords.lat, coords.lng),
          name,
          lat: coords.lat,
          lng: coords.lng,
          category: tagCategory(tags),
          kind: 'suggested',
          visited: false,
          display_name: name,
          source: 'overpass',
        },
        score: scoreSuggestedPlace(tags, distanceToRouteMeters),
        routeIndex,
      });
      return acc;
    },
    [],
  );

  return dedupePlaces(
    places
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .sort((left, right) => left.routeIndex - right.routeIndex)
      .map((item) => item.place),
  );
};

export const searchDestinationPlaces = async (
  query: string,
  city?: string,
): Promise<RoutePlace[]> => {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const queries = city && city.trim()
    ? [`${normalizedQuery}, ${city.trim()}`, normalizedQuery]
    : [normalizedQuery];

  const responses = await Promise.all(queries.map(async (searchQuery) => {
    const url = new URL(NOMINATIM_SEARCH_URL);
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '6');
    url.searchParams.set('addressdetails', '1');
    return fetchJson<NominatimSearchResult[]>(url.toString(), {
      headers: { Accept: 'application/json' },
    }).catch(() => []);
  }));

  return dedupePlaces(
    responses
      .flatMap((rows) => (Array.isArray(rows) ? rows : []))
      .map((row, index) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      const displayName = typeof row.display_name === 'string' ? row.display_name.trim() : '';
      if (!displayName || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const primaryName = displayName.split(',')[0]?.trim() || normalizedQuery;
      const place: RoutePlace = {
        id: createPlaceId(`search-${index}`, primaryName, lat, lng),
        name: primaryName,
        lat,
        lng,
        category: 'Destination',
        kind: 'anchor',
        visited: false,
        display_name: displayName,
        source: 'nominatim',
      };
      return place;
      })
      .filter((item): item is RoutePlace => Boolean(item)),
  ).slice(0, 8);
};

const buildOsrmRoute = async (places: RoutePlace[], travelMode: TravelMode) => {
  const coordinates = places.map((point) => `${point.lng},${point.lat}`).join(';');
  const profile = mapModeToOsrmProfile(travelMode);
  const routeUrl = new URL(`${OSRM_URL}/${profile}/${coordinates}`);
  routeUrl.searchParams.set('overview', 'full');
  routeUrl.searchParams.set('geometries', 'geojson');
  routeUrl.searchParams.set('steps', 'false');

  const payload = await fetchJson<OsrmRouteResponse>(routeUrl.toString(), {
    headers: { Accept: 'application/json' },
  });
  const route = Array.isArray(payload.routes) ? payload.routes[0] : null;
  const routePoints = Array.isArray(route?.geometry?.coordinates)
    ? route.geometry.coordinates
      .map((item) => {
        if (!Array.isArray(item) || item.length < 2) return null;
        const lng = Number(item[0]);
        const lat = Number(item[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return [lat, lng] as [number, number];
      })
      .filter((item): item is [number, number] => Boolean(item))
    : [];

  if (!route || routePoints.length < 2) {
    throw new Error('No route path was returned for those places.');
  }

  return {
    route_points: routePoints,
    distance_meters: Number(route.distance) || 0,
    duration_seconds: Number(route.duration) || 0,
  };
};

export const buildSmartRoute = async (input: {
  city?: string;
  start: RoutePlace;
  destination: RoutePlace;
  travelerLocation?: DeviceLocation | null;
  travelMode: TravelMode;
}): Promise<PlannedRoute> => {
  const city = (input.city || '').trim();
  const baseRoute = await buildOsrmRoute([input.start, input.destination], input.travelMode);
  const suggestedPlaces: RoutePlace[] = [];

  const routeWaypoints: RoutePlace[] = [
    { ...input.start, kind: 'route_waypoint' },
    { ...input.destination, kind: 'route_waypoint' },
  ];

  return {
    client_route_id: createClientRouteId(),
    title: `${input.start.name} to ${input.destination.name}`,
    city,
    travel_mode: input.travelMode,
    start_name: input.start.name,
    destination_name: input.destination.name,
    stop_names: suggestedPlaces.map((item) => item.name),
    route_points: baseRoute.route_points,
    waypoints: routeWaypoints,
    recommended_places: suggestedPlaces,
    distance_meters: baseRoute.distance_meters,
    duration_seconds: baseRoute.duration_seconds,
  };
};

export const saveRouteHistory = async (userId: string, route: PlannedRoute): Promise<RouteHistoryRecord> => {
  const timestamp = new Date().toISOString();
  const localRecord: RouteHistoryRecord = {
    ...route,
    id: route.client_route_id,
    user_id: userId,
    visited_at: timestamp,
    created_at: timestamp,
    source: 'local',
  };

  saveLocalRouteHistory(userId, localRecord);

  const payload = {
    user_id: userId,
    client_route_id: route.client_route_id,
    title: route.title,
    city: route.city,
    travel_mode: route.travel_mode,
    start_name: route.start_name,
    destination_name: route.destination_name,
    stop_names: route.stop_names,
    route_points: route.route_points,
    waypoints: route.waypoints,
    recommended_places: route.recommended_places,
    distance_meters: route.distance_meters,
    duration_seconds: route.duration_seconds,
    visited_at: timestamp,
  };

  const { data, error } = await supabase
    .from(ROUTE_TABLE)
    .insert([payload])
    .select('*')
    .limit(1);

  if (error) {
    console.warn('Route history save fell back to local storage:', error.message);
    return localRecord;
  }

  const saved = Array.isArray(data) ? mapRouteRow(data[0] as Record<string, unknown>, 'supabase') : null;
  if (!saved) return localRecord;
  saveLocalRouteHistory(userId, saved);
  return saved;
};

export const updateVisitedPlaces = async (
  userId: string,
  clientRouteId: string,
  places: RoutePlace[],
) => {
  updateLocalVisitedState(userId, clientRouteId, places);
  const { error } = await supabase
    .from(ROUTE_TABLE)
    .update({
      recommended_places: places,
      stop_names: places.map((item) => item.name),
    })
    .eq('user_id', userId)
    .eq('client_route_id', clientRouteId);

  if (error) {
    console.warn('Visited place sync stayed local:', error.message);
  }
};

export const getTouristRouteHistory = async (userId: string): Promise<RouteHistoryRecord[]> => {
  const localRows = getLocalRouteHistory(userId);
  const { data, error } = await supabase
    .from(ROUTE_TABLE)
    .select('*')
    .eq('user_id', userId)
    .order('visited_at', { ascending: false });

  if (error) {
    console.warn('Route history is using local storage only:', error.message);
    return localRows;
  }

  const remoteRows = Array.isArray(data)
    ? data
      .map((item) => mapRouteRow(item as Record<string, unknown>, 'supabase'))
      .filter((item): item is RouteHistoryRecord => Boolean(item))
    : [];

  return mergeHistory(remoteRows, localRows);
};

export const loadRouteDraft = (userId?: string | null): RouteFormDraft => {
  const draft = readLocalJson<Partial<RouteFormDraft>>(getDraftStorageKey(userId), DEFAULT_DRAFT);
  return {
    travelMode: draft.travelMode === 'walking' || draft.travelMode === 'cycling'
      ? draft.travelMode
      : DEFAULT_DRAFT.travelMode,
  };
};

export const saveRouteDraft = (userId: string | null | undefined, draft: RouteFormDraft) => {
  writeLocalJson(getDraftStorageKey(userId), draft);
};

export const clearRouteDraft = (userId?: string | null) => {
  if (!storageAvailable()) return;
  try {
    window.localStorage.removeItem(getDraftStorageKey(userId));
  } catch {
    // Ignore storage failures.
  }
};

export const getCurrentDevicePosition = () => new Promise<DeviceLocation>((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new Error('Geolocation is not supported on this device.'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => reject(new Error(getGeolocationErrorMessage(error))),
    {
      enableHighAccuracy: false,
      maximumAge: 30000,
      timeout: 20000,
    },
  );
});

export const watchDevicePosition = (
  onChange: (location: DeviceLocation) => void,
  onError: (message: string) => void,
) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError('Geolocation is not supported on this device.');
    return null;
  }

  const id = navigator.geolocation.watchPosition(
    (position) => {
      onChange({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
    },
    (error) => onError(getGeolocationErrorMessage(error)),
    {
      enableHighAccuracy: false,
      maximumAge: 15000,
      timeout: 20000,
    },
  );
  return id;
};

export const stopWatchingDevicePosition = (watchId: number | null) => {
  if (watchId === null) return;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  navigator.geolocation.clearWatch(watchId);
};

export const resolveCurrentCity = async (location: DeviceLocation) => reverseGeocodeCity(location.lat, location.lng);

export const formatRouteDistance = (distanceMeters: number): string => {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return '0 km';
  const kilometers = distanceMeters / 1000;
  if (kilometers >= 10) return `${kilometers.toFixed(0)} km`;
  return `${kilometers.toFixed(1)} km`;
};

export const formatRouteDuration = (durationSeconds: number): string => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return '0 min';
  const minutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours <= 0) return `${minutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
};

export const formatLocationAccuracy = (accuracy?: number) => {
  if (!Number.isFinite(accuracy) || !accuracy) return 'Live location active';
  return `Accuracy ±${Math.round(accuracy)} m`;
};

export const describeRouteProgress = (
  currentLocation: DeviceLocation | null,
  places: RoutePlace[],
) => {
  if (!currentLocation) return 'Waiting for live location.';
  const remaining = places.filter((item) => !item.visited);
  if (remaining.length === 0) return 'All suggested places marked visited.';

  const next = remaining
    .map((item) => ({
      item,
      distance: haversineDistanceMeters(currentLocation, item),
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  return `Next suggested stop: ${next.item.name} (${formatRouteDistance(next.distance)})`;
};
