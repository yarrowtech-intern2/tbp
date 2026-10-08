import React from 'react';
import { ChevronLeft, Clock, ExternalLink, Globe, MapPinPlus, Navigation, Phone, X } from 'lucide-react';
import { EXPLORE_GROUPS, findExploreCategory, type ExplorePlace } from '../../lib/placeExplorer';
import { formatRouteDistance, formatRouteDuration, type PlannedRoute } from '../../lib/routePlanner';

interface ExplorePanelProps {
    groupKey: string;
    onGroupChange: (key: string) => void;
    categoryKey: string | null;
    onCategoryChange: (key: string | null) => void;
    places: ExplorePlace[];
    loading: boolean;
    status: string;
    selectedPlace: ExplorePlace | null;
    onSelectPlace: (place: ExplorePlace | null) => void;
    route: PlannedRoute | null;
    routeLoading: boolean;
    onRouteToPlace: (place: ExplorePlace) => void;
    onPinPlace: (place: ExplorePlace) => void;
    onClose: () => void;
}

export const ExplorePanel: React.FC<ExplorePanelProps> = ({
    groupKey,
    onGroupChange,
    categoryKey,
    onCategoryChange,
    places,
    loading,
    status,
    selectedPlace,
    onSelectPlace,
    route,
    routeLoading,
    onRouteToPlace,
    onPinPlace,
    onClose,
}) => {
    const group = EXPLORE_GROUPS.find((item) => item.key === groupKey) || EXPLORE_GROUPS[0];
    const active = findExploreCategory(categoryKey);

    if (selectedPlace && active) {
        return (
            <aside className="map2-route-panel map2-explore-panel" aria-label={`${selectedPlace.name} details`}>
                <div className="map2-panel-head">
                    <div>
                        <span>{active.category.emoji} {active.category.label}</span>
                        <h1>{selectedPlace.name}</h1>
                    </div>
                    <button type="button" className="map2-icon-btn" onClick={() => onSelectPlace(null)} aria-label="Back to results">
                        <ChevronLeft size={18} />
                    </button>
                </div>

                <ul className="map2-explore-facts">
                    {selectedPlace.cuisine ? <li><span aria-hidden="true">🍴</span>{selectedPlace.cuisine}</li> : null}
                    {selectedPlace.address ? <li><span aria-hidden="true">📍</span>{selectedPlace.address}</li> : null}
                    {selectedPlace.openingHours ? <li><Clock size={15} />{selectedPlace.openingHours}</li> : null}
                    {selectedPlace.phone ? (
                        <li><Phone size={15} /><a href={`tel:${selectedPlace.phone.replace(/\s+/g, '')}`}>{selectedPlace.phone}</a></li>
                    ) : null}
                    {selectedPlace.website ? (
                        <li>
                            <Globe size={15} />
                            <a href={/^https?:\/\//.test(selectedPlace.website) ? selectedPlace.website : `https://${selectedPlace.website}`} target="_blank" rel="noreferrer">
                                {selectedPlace.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                            </a>
                        </li>
                    ) : null}
                    {!selectedPlace.address && !selectedPlace.openingHours && !selectedPlace.phone && !selectedPlace.website ? (
                        <li className="is-muted">No extra details on OpenStreetMap yet.</li>
                    ) : null}
                </ul>

                {route ? (
                    <div className="map2-route-metrics">
                        <div><span>Distance</span><strong>{formatRouteDistance(route.distance_meters)}</strong></div>
                        <div><span>Drive</span><strong>{formatRouteDuration(route.duration_seconds)}</strong></div>
                        <div><span>From</span><strong>You</strong></div>
                    </div>
                ) : null}

                <div className="map2-explore-actions">
                    <button type="button" className="map2-route-primary" onClick={() => onRouteToPlace(selectedPlace)} disabled={routeLoading}>
                        <Navigation size={17} />
                        <span>{routeLoading ? 'Finding route' : 'Route here'}</span>
                    </button>
                    <button type="button" className="map2-puja-secondary" onClick={() => onPinPlace(selectedPlace)}>
                        <MapPinPlus size={16} />
                        <span>Pin it</span>
                    </button>
                </div>

                <a className="map2-explore-source" href={selectedPlace.osmUrl} target="_blank" rel="noreferrer">
                    <ExternalLink size={13} /> View or improve on OpenStreetMap
                </a>
                {status ? <p className="map2-status">{status}</p> : null}
            </aside>
        );
    }

    return (
        <aside className="map2-route-panel map2-explore-panel" aria-label="Explore nearby">
            <div className="map2-panel-head">
                <div>
                    <span>Explore nearby</span>
                    <h1>{active ? `${active.category.emoji} ${active.category.label}` : 'What are you looking for?'}</h1>
                </div>
                <button type="button" className="map2-icon-btn" onClick={onClose} aria-label="Close explore">
                    <X size={18} />
                </button>
            </div>

            <div className="map2-explore-groups" role="tablist" aria-label="Place groups">
                {EXPLORE_GROUPS.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="tab"
                        aria-selected={item.key === group.key}
                        className={item.key === group.key ? 'is-active' : ''}
                        style={{ ['--group-color' as string]: item.color }}
                        onClick={() => onGroupChange(item.key)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            <div className="map2-explore-chips" role="group" aria-label={`${group.label} categories`}>
                {group.categories.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        className={item.key === categoryKey ? 'is-active' : ''}
                        aria-pressed={item.key === categoryKey}
                        style={{ ['--group-color' as string]: group.color }}
                        onClick={() => onCategoryChange(item.key === categoryKey ? null : item.key)}
                    >
                        <span aria-hidden="true">{item.emoji}</span>
                        {item.label}
                    </button>
                ))}
            </div>

            {status ? <p className="map2-status">{status}</p> : null}

            {active && !loading && places.length ? (
                <ul className="map2-puja-list">
                    {places.map((place) => (
                        <li key={place.id}>
                            <button type="button" className="map2-puja-row" onClick={() => onSelectPlace(place)}>
                                <span className="map2-explore-emoji" style={{ ['--group-color' as string]: active.group.color }} aria-hidden="true">
                                    {active.category.emoji}
                                </span>
                                <span>
                                    <strong>{place.name}</strong>
                                    <small>{place.address || place.cuisine || place.openingHours || 'Tap for details'}</small>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}

            <small className="map2-pin-coords">Place data © OpenStreetMap contributors.</small>
        </aside>
    );
};
