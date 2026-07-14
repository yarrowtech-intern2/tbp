import React, { useEffect, useMemo, useRef, useState } from 'react';
import { divIcon, latLngBounds } from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useAuth } from '../hooks/useAuth';
import {
  buildSmartRoute,
  clearRouteDraft,
  describeRouteProgress,
  fetchNearbyAnchors,
  fetchRouteTouristPlaces,
  formatLocationAccuracy,
  formatRouteDistance,
  formatRouteDuration,
  getCurrentDevicePosition,
  loadRouteDraft,
  resolveCurrentCity,
  saveRouteDraft,
  saveRouteHistory,
  searchDestinationPlaces,
  stopWatchingDevicePosition,
  updateVisitedPlaces,
  watchDevicePosition,
  type DeviceLocation,
  type PlannedRoute,
  type RouteFormDraft,
  type RoutePlace,
} from '../lib/routePlanner';

import './map-page.css';

const DEFAULT_MAP_CENTER: [number, number] = [20.5937, 78.9629];

const currentLocationIcon = divIcon({
  className: 'map-page-current-location-icon',
  html: '<span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const RouteViewport: React.FC<{ points: Array<[number, number]>; focus?: DeviceLocation | null }> = ({ points, focus }) => {
  const map = useMap();

  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(latLngBounds(points), { padding: [56, 56] });
      return;
    }

    if (focus) {
      map.setView([focus.lat, focus.lng], 14);
    }
  }, [focus, map, points]);

  return null;
};

export const MapPage: React.FC = () => {
  const { user } = useAuth();
  const destinationSearchRequestRef = useRef(0);
  const startSearchRequestRef = useRef(0);
  const recommendationRequestRef = useRef(0);
  const destinationInputRef = useRef<HTMLInputElement | null>(null);
  const [isRouteCreatorOpen, setIsRouteCreatorOpen] = useState(false);
  const [isStartOptionsOpen, setIsStartOptionsOpen] = useState(false);
  const [formState, setFormState] = useState<RouteFormDraft>(() => loadRouteDraft(user?.id));
  const [currentLocation, setCurrentLocation] = useState<DeviceLocation | null>(null);
  const [currentCity, setCurrentCity] = useState('Kolkata');
  const [locationStatus, setLocationStatus] = useState('Allow location access to discover nearby route anchors.');
  const [locationError, setLocationError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isLoadingAnchors, setIsLoadingAnchors] = useState(false);
  const [nearbyAnchors, setNearbyAnchors] = useState<RoutePlace[]>([]);
  const [startAnchor, setStartAnchor] = useState<RoutePlace | null>(null);
  const [startQuery, setStartQuery] = useState('');
  const [startResults, setStartResults] = useState<RoutePlace[]>([]);
  const [isSearchingStarts, setIsSearchingStarts] = useState(false);
  const [endAnchor, setEndAnchor] = useState<RoutePlace | null>(null);
  const [destinationQuery, setDestinationQuery] = useState('');
  const [destinationResults, setDestinationResults] = useState<RoutePlace[]>([]);
  const [isSearchingDestinations, setIsSearchingDestinations] = useState(false);
  const [planningLocation, setPlanningLocation] = useState<DeviceLocation | null>(null);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRoute | null>(null);
  const [savedRouteId, setSavedRouteId] = useState<string | null>(null);
  const [isBuildingRoute, setIsBuildingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [routeMessage, setRouteMessage] = useState<string | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isSavingVisited, setIsSavingVisited] = useState(false);

  useEffect(() => {
    setFormState(loadRouteDraft(user?.id));
  }, [user?.id]);

  useEffect(() => () => {
    stopWatchingDevicePosition(watchId);
  }, [watchId]);

  const progressText = useMemo(
    () => describeRouteProgress(currentLocation, plannedRoute?.recommended_places || []),
    [currentLocation, plannedRoute?.recommended_places],
  );
  const liveLocationStart = useMemo<RoutePlace | null>(() => {
    if (!currentLocation) return null;
    return {
      id: `live-start:${currentLocation.lat.toFixed(5)}:${currentLocation.lng.toFixed(5)}`,
      name: 'My live location',
      lat: currentLocation.lat,
      lng: currentLocation.lng,
      category: currentCity ? `Current position in ${currentCity}` : 'Current position',
      kind: 'anchor',
      visited: false,
      display_name: currentCity ? `My live location, ${currentCity}` : 'My live location',
      source: 'system',
    };
  }, [currentCity, currentLocation]);

  const requestLocationAccess = async () => {
    setIsLocating(true);
    setLocationError(null);

    try {
      const initialLocation = await getCurrentDevicePosition();
      setCurrentLocation(initialLocation);
      setLocationStatus(formatLocationAccuracy(initialLocation.accuracy));

      const [city, anchors] = await Promise.all([
        resolveCurrentCity(initialLocation).catch(() => ''),
        fetchNearbyAnchors(initialLocation).catch(() => []),
      ]);

      setCurrentCity(city);
      setNearbyAnchors(anchors);

      if (!watchId) {
        const nextWatchId = watchDevicePosition(
          (nextLocation) => {
            setCurrentLocation(nextLocation);
            setLocationStatus(formatLocationAccuracy(nextLocation.accuracy));
          },
          (message) => setLocationError(message),
        );
        if (typeof nextWatchId === 'number') {
          setWatchId(nextWatchId);
        }
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not access your location.');
    } finally {
      setIsLocating(false);
    }
  };

  const refreshNearbyAnchors = async () => {
    if (!currentLocation) return;
    setIsLoadingAnchors(true);
    setLocationError(null);
    try {
      const anchors = await fetchNearbyAnchors(currentLocation, currentCity);
      setNearbyAnchors(anchors);
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : 'Could not refresh nearby anchors.');
    } finally {
      setIsLoadingAnchors(false);
    }
  };

  const handleTravelModeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextDraft = { travelMode: event.target.value as RouteFormDraft['travelMode'] };
    setFormState(nextDraft);
    saveRouteDraft(user?.id, nextDraft);
    if (currentLocation) {
      setPlanningLocation(currentLocation);
    }
  };

  const handleSelectStart = (anchor: RoutePlace) => {
    setStartAnchor(anchor);
    setStartQuery(anchor.name);
    setStartResults([]);
    setIsStartOptionsOpen(false);
    setEndAnchor(null);
    setDestinationResults([]);
    setPlannedRoute(null);
    setSavedRouteId(null);
    setRouteError(null);
    setRouteMessage('Search and choose a destination.');
    setPlanningLocation(currentLocation);
    window.setTimeout(() => {
      destinationInputRef.current?.focus();
      destinationInputRef.current?.select();
    }, 0);
  };

  const handleSelectEnd = (anchor: RoutePlace) => {
    setEndAnchor(anchor);
    setDestinationQuery(anchor.name);
    setRouteError(null);
    setRouteMessage('Generating direct route...');
    setPlanningLocation(currentLocation);
  };

  const handleStartSearch = async (query = startQuery, options?: { silent?: boolean }) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setStartResults([]);
      if (startAnchor) {
        setStartAnchor(null);
      }
      if (!options?.silent) {
        setRouteError('Enter a starting point to search.');
      }
      return;
    }

    const requestId = startSearchRequestRef.current + 1;
    startSearchRequestRef.current = requestId;
    setIsSearchingStarts(true);
    setRouteError(null);
    try {
      const results = await searchDestinationPlaces(normalizedQuery, currentCity);
      if (startSearchRequestRef.current !== requestId) return;
      setStartResults(results);
      setRouteMessage(results.length
        ? 'Choose a start result, then choose a destination.'
        : 'No start matches found. Try a landmark, station, or neighborhood.');
    } catch (error) {
      if (startSearchRequestRef.current !== requestId) return;
      setRouteError(error instanceof Error ? error.message : 'Could not search starting points.');
    } finally {
      if (startSearchRequestRef.current === requestId) {
        setIsSearchingStarts(false);
      }
    }
  };

  const handleDestinationSearch = async (query = destinationQuery, options?: { silent?: boolean }) => {
    if (!startAnchor) {
      setRouteError('Choose a starting point first.');
      return;
    }

    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      setDestinationResults([]);
      if (endAnchor) {
        setEndAnchor(null);
      }
      if (!options?.silent) {
        setRouteError('Enter a destination to search.');
      }
      return;
    }

    const requestId = destinationSearchRequestRef.current + 1;
    destinationSearchRequestRef.current = requestId;
    setIsSearchingDestinations(true);
    setRouteError(null);
    try {
      const results = await searchDestinationPlaces(normalizedQuery, currentCity);
      if (destinationSearchRequestRef.current !== requestId) return;
      setDestinationResults(results);
      if (!results.length) {
        setRouteMessage('No destination matches found. Try a landmark or neighborhood name.');
      } else {
        setRouteMessage('Choose a destination result to build the route.');
      }
    } catch (error) {
      if (destinationSearchRequestRef.current !== requestId) return;
      setRouteError(error instanceof Error ? error.message : 'Could not search destinations.');
    } finally {
      if (destinationSearchRequestRef.current === requestId) {
        setIsSearchingDestinations(false);
      }
    }
  };

  useEffect(() => {
    if (!startAnchor) return;

    const normalizedQuery = destinationQuery.trim();
    if (!normalizedQuery) {
      destinationSearchRequestRef.current += 1;
      setDestinationResults([]);
      if (endAnchor) {
        setEndAnchor(null);
      }
      return;
    }

    if (normalizedQuery.length < 3) {
      setDestinationResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleDestinationSearch(normalizedQuery, { silent: true });
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [destinationQuery, endAnchor, startAnchor]);

  useEffect(() => {
    const normalizedQuery = startQuery.trim();
    if (!normalizedQuery) {
      startSearchRequestRef.current += 1;
      setStartResults([]);
      return;
    }

    if (normalizedQuery.length < 3 || startAnchor?.name === normalizedQuery) {
      setStartResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void handleStartSearch(normalizedQuery, { silent: true });
    }, 320);

    return () => window.clearTimeout(timeoutId);
  }, [startAnchor?.name, startQuery]);

  useEffect(() => {
    if (!startAnchor || !endAnchor) return;

    let cancelled = false;

    const run = async () => {
      setIsBuildingRoute(true);
      setRouteError(null);
      try {
        const nextRoute = await buildSmartRoute({
          city: currentCity,
          start: startAnchor,
          destination: endAnchor,
          travelerLocation: planningLocation || currentLocation,
          travelMode: formState.travelMode,
        });
        if (cancelled) return;
        setPlannedRoute(nextRoute);
        setRouteMessage(user?.id
          ? 'Route built and saving to your dashboard history.'
          : 'Route built. Sign in to save it to dashboard history.');

        if (user?.id) {
          const saved = await saveRouteHistory(user.id, nextRoute);
          if (cancelled) return;
          setSavedRouteId(saved.client_route_id);
          setPlannedRoute({
            ...nextRoute,
            recommended_places: saved.recommended_places,
            stop_names: saved.stop_names,
            waypoints: saved.waypoints,
          });
          setRouteMessage('Route built and saved to your dashboard history.');
        }
        clearRouteDraft(user?.id);
      } catch (error) {
        if (cancelled) return;
        setRouteError(error instanceof Error ? error.message : 'Could not build the route.');
        setRouteMessage(null);
      } finally {
        if (!cancelled) setIsBuildingRoute(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [currentCity, currentLocation, endAnchor, formState.travelMode, planningLocation, startAnchor, user?.id]);

  useEffect(() => {
    if (!plannedRoute || plannedRoute.recommended_places.length > 0 || plannedRoute.route_points.length < 2) return;
    if (user?.id && !savedRouteId) return;

    let cancelled = false;
    const requestId = recommendationRequestRef.current + 1;
    recommendationRequestRef.current = requestId;

    const run = async () => {
      setIsLoadingRecommendations(true);
      setRouteMessage('Route ready. Finding tourist places along the route...');
      try {
        const places = await fetchRouteTouristPlaces(plannedRoute.route_points);
        if (cancelled || recommendationRequestRef.current !== requestId) return;

        if (!places.length) {
          setRouteMessage('Route ready. No tourist places were found close to this route.');
          return;
        }

        setPlannedRoute({
          ...plannedRoute,
          recommended_places: places,
          stop_names: places.map((place) => place.name),
        });
        setRouteMessage(user?.id
          ? 'Route ready. Tourist places added and synced to dashboard history.'
          : 'Route ready. Tourist places added.');

        if (user?.id && savedRouteId) {
          await updateVisitedPlaces(user.id, savedRouteId, places);
        }
      } catch {
        if (!cancelled && recommendationRequestRef.current === requestId) {
          setRouteMessage('Route ready. Tourist places could not be loaded right now.');
        }
      } finally {
        if (!cancelled && recommendationRequestRef.current === requestId) {
          setIsLoadingRecommendations(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [plannedRoute, savedRouteId, user?.id]);

  const handleVisitedToggle = async (placeId: string) => {
    if (!plannedRoute) return;

    const nextPlaces = plannedRoute.recommended_places.map((place) => (
      place.id === placeId ? { ...place, visited: !place.visited } : place
    ));

    setPlannedRoute({
      ...plannedRoute,
      recommended_places: nextPlaces,
      stop_names: nextPlaces.map((place) => place.name),
    });

    if (!user?.id || !savedRouteId) return;

    setIsSavingVisited(true);
    try {
      await updateVisitedPlaces(user.id, savedRouteId, nextPlaces);
    } finally {
      setIsSavingVisited(false);
    }
  };

  const visibleMapPoints = plannedRoute?.route_points || [];

  return (
    <main className="map-page" aria-label="Map page">
      <section className="map-page-shell" aria-label="Tourist map">
        <div className="map-page-canvas" aria-label="Map canvas">
          <MapContainer
            center={DEFAULT_MAP_CENTER}
            zoom={4}
            minZoom={2}
            maxZoom={18}
            scrollWheelZoom
            worldCopyJump
            className="map-page-leaflet"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <RouteViewport points={visibleMapPoints} focus={currentLocation} />

            {currentLocation ? (
              <Marker icon={currentLocationIcon} position={[currentLocation.lat, currentLocation.lng]}>
                <Popup>You are here</Popup>
              </Marker>
            ) : null}

            {nearbyAnchors.map((anchor) => {
              const isStart = startAnchor?.id === anchor.id;
              const isEnd = endAnchor?.id === anchor.id;
              const color = isStart ? '#111111' : isEnd ? '#ff6b00' : '#7a4a29';
              return (
                <CircleMarker
                  key={anchor.id}
                  center={[anchor.lat, anchor.lng]}
                  pathOptions={{ color, fillColor: '#fff7ef', fillOpacity: 1, weight: 3 }}
                  radius={isStart || isEnd ? 9 : 7}
                >
                  <Popup>
                    <strong>{anchor.name}</strong>
                    <div>{anchor.category}</div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {plannedRoute?.route_points.length ? (
              <Polyline
                pathOptions={{ color: '#ff6b00', weight: 5, opacity: 0.92 }}
                positions={plannedRoute.route_points}
              />
            ) : null}

            {plannedRoute?.recommended_places.map((point) => (
              <CircleMarker
                key={point.id}
                center={[point.lat, point.lng]}
                pathOptions={{
                  color: point.visited ? '#1f8f53' : '#b14b12',
                  fillColor: point.visited ? '#ccf0de' : '#fff7ef',
                  fillOpacity: 1,
                  weight: 3,
                }}
                radius={8}
              >
                <Popup>
                  <strong>{point.name}</strong>
                  <div>{point.category}</div>
                  <div>{point.visited ? 'Visited' : 'Not visited yet'}</div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          <div className={`map-page-route-creator${isRouteCreatorOpen ? ' is-open' : ''}`}>
            <button
              aria-controls="map-route-creator-panel"
              aria-expanded={isRouteCreatorOpen}
              className="map-page-create-route"
              onClick={() => setIsRouteCreatorOpen((current) => !current)}
              type="button"
            >
              {isRouteCreatorOpen ? 'Close' : 'Create Route'}
            </button>

            <aside
              aria-hidden={!isRouteCreatorOpen}
              className="map-page-route-panel"
              id="map-route-creator-panel"
            >
              <div className="map-page-route-panel-inner">
                <div className="map-page-route-panel-header">
                  <div>
                    <p className="map-page-route-panel-kicker">Trip planner</p>
                    <h2>Route creator</h2>
                  </div>
                  <span className="map-page-route-panel-status">
                    {plannedRoute ? 'Live' : startAnchor ? 'Choose destination' : 'Choose start'}
                  </span>
                </div>

                <div className="map-page-route-prompt">
                  <strong>
                    {!startAnchor
                        ? 'Choose a starting point'
                        : !endAnchor
                          ? 'Search a destination'
                          : 'Route ready'}
                  </strong>
                  <p>{locationStatus}</p>
                </div>

                <div className="map-page-route-form">
                  <label className="map-page-route-field">
                    <span>City</span>
                    <input
                      onChange={(event) => setCurrentCity(event.target.value)}
                      placeholder="City"
                      type="text"
                      value={currentCity}
                    />
                  </label>

                  <label className="map-page-route-field">
                    <span>Travel mode</span>
                    <select name="travelMode" onChange={handleTravelModeChange} value={formState.travelMode}>
                      <option value="driving">Driving</option>
                      <option value="walking">Walking</option>
                      <option value="cycling">Cycling</option>
                    </select>
                  </label>
                </div>

                <div className="map-page-route-panel-footer map-page-route-panel-footer--stacked">
                  <button
                    className="map-page-route-primary"
                    disabled={isLocating || isBuildingRoute}
                    onClick={() => void requestLocationAccess()}
                    type="button"
                  >
                    <span className="map-page-route-btn-copy">
                      <strong>
                        {isLocating
                          ? 'Finding your location...'
                          : isBuildingRoute
                            ? 'Updating route...'
                            : currentLocation
                              ? 'Refresh my location'
                              : 'Use my location'}
                      </strong>
                      <small>
                        {currentLocation
                          ? 'Update live position and nearby route context'
                          : 'Optional: use GPS as your starting point'}
                      </small>
                    </span>
                  </button>
                  <button
                    className="map-page-route-secondary"
                    disabled={!currentLocation || isLoadingAnchors}
                    onClick={() => void refreshNearbyAnchors()}
                    type="button"
                  >
                    <span className="map-page-route-btn-copy">
                      <strong>{isLoadingAnchors ? 'Refreshing nearby points...' : 'Refresh nearby points'}</strong>
                      <small>Reload stations and attractions around you</small>
                    </span>
                  </button>
                </div>

                {locationError ? <p className="map-page-route-feedback is-error">{locationError}</p> : null}
                {routeError ? <p className="map-page-route-feedback is-error">{routeError}</p> : null}
                {routeMessage ? <p className="map-page-route-feedback">{routeMessage}</p> : null}

                <div className="map-page-route-anchor-block">
                  <div className="map-page-route-anchor-head">
                    <strong>Start point</strong>
                    <span>{startAnchor?.name || 'Not selected'}</span>
                  </div>
                  <div className="map-page-route-destination-search">
                    <div className="map-page-route-destination-input">
                      <input
                        onChange={(event) => {
                          setStartQuery(event.target.value);
                          if (startAnchor && event.target.value.trim() !== startAnchor.name) {
                            setStartAnchor(null);
                            setEndAnchor(null);
                            setPlannedRoute(null);
                            setSavedRouteId(null);
                          }
                          if (routeError) {
                            setRouteError(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleStartSearch();
                          }
                        }}
                        placeholder="Search start, station, hotel, or neighborhood"
                        type="text"
                        value={startQuery}
                      />
                      <button
                        className="map-page-route-secondary"
                        disabled={isSearchingStarts || isBuildingRoute}
                        onClick={() => void handleStartSearch()}
                        type="button"
                      >
                        {isSearchingStarts ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    {startResults.length > 0 ? (
                      <div className="map-page-route-anchor-list">
                        {startResults.map((anchor) => (
                          <button
                            key={`start-search-${anchor.id}`}
                            type="button"
                            className={`map-page-route-anchor-btn${startAnchor?.id === anchor.id ? ' is-selected' : ''}`}
                            disabled={isBuildingRoute}
                            onClick={() => handleSelectStart(anchor)}
                          >
                            <span>{anchor.name}</span>
                            <small>{anchor.display_name || anchor.category}</small>
                          </button>
                        ))}
                      </div>
                    ) : startQuery.trim().length >= 3 && !isSearchingStarts && startAnchor?.name !== startQuery.trim() ? (
                      <p className="map-page-route-feedback">No matching start points yet. Try a more specific place name.</p>
                    ) : startQuery.trim().length > 0 && startQuery.trim().length < 3 ? (
                      <p className="map-page-route-feedback">Type at least 3 characters to search starting points.</p>
                    ) : null}
                  </div>

                  {liveLocationStart ? (
                    <button
                      key={liveLocationStart.id}
                      type="button"
                      className={`map-page-route-anchor-btn map-page-route-anchor-btn--live${startAnchor?.id === liveLocationStart.id ? ' is-selected' : ''}`}
                      disabled={isBuildingRoute}
                      onClick={() => handleSelectStart(liveLocationStart)}
                    >
                      <span>Use my live location</span>
                      <small>{liveLocationStart.category}</small>
                    </button>
                  ) : null}

                  {nearbyAnchors.length > 0 ? (
                    <>
                      <button
                        type="button"
                        className={`map-page-route-disclosure${isStartOptionsOpen ? ' is-open' : ''}`}
                        disabled={isBuildingRoute}
                        onClick={() => setIsStartOptionsOpen((current) => !current)}
                      >
                        {isStartOptionsOpen ? 'Hide nearby starting points' : 'Show nearby starting points'}
                      </button>
                      {isStartOptionsOpen ? (
                        <div className="map-page-route-anchor-list">
                          {nearbyAnchors.map((anchor) => (
                            <button
                              key={`start-${anchor.id}`}
                              type="button"
                              className={`map-page-route-anchor-btn${startAnchor?.id === anchor.id ? ' is-selected' : ''}`}
                              disabled={isBuildingRoute}
                              onClick={() => handleSelectStart(anchor)}
                            >
                              <span>{anchor.name}</span>
                              <small>{anchor.category}</small>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>

                <div className="map-page-route-anchor-block">
                  <div className="map-page-route-anchor-head">
                    <strong>Destination</strong>
                    <span>{endAnchor?.name || 'Not selected'}</span>
                  </div>
                  <div className="map-page-route-destination-search">
                    {endAnchor ? (
                      <div className="map-page-route-selected-destination">
                        <div>
                          <strong>Selected destination</strong>
                          <span>{endAnchor.name}</span>
                          <small>{endAnchor.display_name || endAnchor.category}</small>
                        </div>
                        <button
                          className="map-page-route-secondary"
                          disabled={isBuildingRoute}
                          onClick={() => {
                            setEndAnchor(null);
                            setPlannedRoute(null);
                            setSavedRouteId(null);
                            setRouteMessage('Search and choose a destination.');
                          }}
                          type="button"
                        >
                          Change
                        </button>
                      </div>
                    ) : null}
                    <div className="map-page-route-destination-input">
                      <input
                        ref={destinationInputRef}
                        onChange={(event) => {
                          setDestinationQuery(event.target.value);
                          if (routeError) {
                            setRouteError(null);
                          }
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            void handleDestinationSearch();
                          }
                        }}
                        placeholder="Search destination, landmark, or neighborhood"
                        type="text"
                        value={destinationQuery}
                      />
                      <button
                        className="map-page-route-secondary"
                        disabled={isSearchingDestinations || isBuildingRoute || !startAnchor}
                        onClick={() => void handleDestinationSearch()}
                        type="button"
                      >
                        {isSearchingDestinations ? 'Searching...' : 'Search'}
                      </button>
                    </div>

                    {destinationResults.length > 0 ? (
                      <div className="map-page-route-anchor-list">
                        {destinationResults.map((anchor) => (
                          <button
                            key={`end-${anchor.id}`}
                            type="button"
                            className={`map-page-route-anchor-btn${endAnchor?.id === anchor.id ? ' is-selected' : ''}`}
                            disabled={isBuildingRoute}
                            onClick={() => handleSelectEnd(anchor)}
                          >
                            <span>{anchor.name}</span>
                            <small>{anchor.display_name || anchor.category}</small>
                          </button>
                        ))}
                      </div>
                    ) : startAnchor && destinationQuery.trim().length >= 3 && !isSearchingDestinations ? (
                      <p className="map-page-route-feedback">No matching destinations yet. Try a more specific place name.</p>
                    ) : startAnchor && destinationQuery.trim().length > 0 && destinationQuery.trim().length < 3 ? (
                      <p className="map-page-route-feedback">Type at least 3 characters to search destinations.</p>
                    ) : null}
                  </div>
                </div>

                {plannedRoute ? (
                  <>
                    <div className="map-page-route-summary">
                      <div>
                        <span>Distance</span>
                        <strong>{formatRouteDistance(plannedRoute.distance_meters)}</strong>
                      </div>
                      <div>
                        <span>Duration</span>
                        <strong>{formatRouteDuration(plannedRoute.duration_seconds)}</strong>
                      </div>
                      <div>
                        <span>Places</span>
                        <strong>{isLoadingRecommendations ? '...' : plannedRoute.recommended_places.length}</strong>
                      </div>
                    </div>

                    <div className="map-page-route-progress">
                      <strong>Live progress</strong>
                      <p>
                        {isLoadingRecommendations
                          ? 'Finding tourist places close to this route...'
                          : plannedRoute.recommended_places.length
                          ? progressText
                          : 'Direct route ready. Suggested stops are not required for this route.'}
                      </p>
                      {isSavingVisited ? <small>Saving visited places…</small> : null}
                    </div>

                    {plannedRoute.recommended_places.length ? (
                      <div className="map-page-route-places">
                        <div className="map-page-route-anchor-head">
                          <strong>Recommended stops and visiting places</strong>
                          <span>{plannedRoute.recommended_places.filter((item) => item.visited).length}/{plannedRoute.recommended_places.length} visited</span>
                        </div>
                        <div className="map-page-route-place-list">
                          {plannedRoute.recommended_places.map((place) => (
                            <label key={place.id} className="map-page-route-place-row">
                              <input
                                checked={place.visited}
                                onChange={() => void handleVisitedToggle(place.id)}
                                type="checkbox"
                              />
                              <div>
                                <strong>{place.name}</strong>
                                <small>{place.category}</small>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </aside>
          </div>
        </div>
      </section>
    </main>
  );
};
