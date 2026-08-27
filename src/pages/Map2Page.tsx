import React, { useEffect, useMemo, useRef, useState } from 'react';
import { divIcon, latLngBounds, point } from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Compass,
  LocateFixed,
  MapPinned,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Route,
  Search,
  X,
} from 'lucide-react';
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

const buildAttractionIcon = (active: boolean, inRoute: boolean) => divIcon({
  className: '',
  iconSize: point(active ? 42 : 34, active ? 52 : 44),
  iconAnchor: point(active ? 21 : 17, active ? 48 : 40),
  html: `<span class="map2-pin${active ? ' is-active' : ''}${inRoute ? ' is-route' : ''}"><span></span></span>`,
});

const userLocationIcon = divIcon({
  className: '',
  iconSize: point(22, 22),
  iconAnchor: point(11, 11),
  html: '<span class="map2-user-dot"></span>',
});

const Map2Viewport: React.FC<{
  routePoints: Array<[number, number]>;
  selectedPoint?: Map2Attraction | null;
  userLocation?: { lat: number; lng: number } | null;
}> = ({ routePoints, selectedPoint, userLocation }) => {
  const map = useMap();

  useEffect(() => {
    if (routePoints.length >= 2) {
      map.fitBounds(latLngBounds(routePoints), { paddingTopLeft: [40, 120], paddingBottomRight: [40, 220] });
      return;
    }

    if (selectedPoint) {
      map.flyTo([selectedPoint.lat, selectedPoint.lng], Math.max(map.getZoom(), 14), { duration: 0.45 });
      return;
    }

    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 0.45 });
    }
  }, [map, routePoints, selectedPoint, userLocation]);

  return null;
};

export const Map2Page: React.FC = () => {
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<Map2Attraction | null>(MAP2_ATTRACTIONS[0]);
  const [routeOpen, setRouteOpen] = useState(true);
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
  const filteredAttractions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return MAP2_ATTRACTIONS;
    return MAP2_ATTRACTIONS.filter((item) => (
      `${item.name} ${item.category} ${item.summary}`.toLowerCase().includes(normalized)
    ));
  }, [query]);

  useEffect(() => () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timeoutId = window.setTimeout(() => searchInputRef.current?.focus(), 180);
    return () => window.clearTimeout(timeoutId);
  }, [searchOpen]);

  const handlePointClick = (pointItem: Map2Attraction) => {
    setSelectedPoint(pointItem);
    setRouteOpen(false);
  };

  const handlePlayAudio = () => {
    if (!selectedPoint) return;
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
      setAudioStatus('Audio is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${selectedPoint.name}. ${selectedPoint.summary} Guide suggestion: ${selectedPoint.guide.name}, ${selectedPoint.guide.specialty}. Languages: ${selectedPoint.guide.languages}. Best time: ${selectedPoint.bestTime}.`,
    );
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => setAudioPlaying(false);
    utterance.onerror = () => {
      setAudioPlaying(false);
      setAudioStatus('Could not play the guide audio.');
    };
    setAudioStatus('');
    setAudioPlaying(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleStopAudio = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
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

  const resetRoute = () => {
    setPlannedRoute(null);
    setRouteStops([]);
    setRouteStatus('Choose two points to build a route.');
  };

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
        />
        <ZoomControl position="bottomright" />
        <Map2Viewport
          routePoints={plannedRoute?.route_points || []}
          selectedPoint={selectedPoint}
          userLocation={userLocation}
        />

        {plannedRoute?.route_points.length ? (
          <Polyline
            pathOptions={{ color: '#ff741d', weight: 6, opacity: 0.92, lineCap: 'round', lineJoin: 'round' }}
            positions={plannedRoute.route_points}
          />
        ) : null}

        {userLocation ? (
          <Marker icon={userLocationIcon} position={[userLocation.lat, userLocation.lng]} />
        ) : null}

        {MAP2_ATTRACTIONS.map((pointItem) => (
          <Marker
            key={pointItem.id}
            icon={buildAttractionIcon(selectedPoint?.id === pointItem.id, routePointIds.has(pointItem.id))}
            position={[pointItem.lat, pointItem.lng]}
            eventHandlers={{ click: () => handlePointClick(pointItem) }}
            title={pointItem.name}
          />
        ))}
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
            className={`map2-tool${routeOpen ? ' is-active' : ''}`}
            onClick={() => {
              setRouteOpen((current) => !current);
              setSelectedPoint(null);
            }}
            aria-label="Route creator"
            title="Route creator"
          >
            <Route size={19} />
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
            onClick={resetRoute}
            aria-label="Reset route"
            title="Reset route"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>

      {searchOpen && query.trim() && (
        <section className="map2-search-results" aria-label="Matching tourist places">
          {filteredAttractions.length ? filteredAttractions.slice(0, 5).map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => {
                handlePointClick(item);
                setQuery('');
                setSearchOpen(false);
              }}
            >
              <span>{item.name}</span>
              <small>{item.category}</small>
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

      {selectedPoint && !routeOpen ? (
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
