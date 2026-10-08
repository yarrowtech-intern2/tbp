import React from 'react';
import { ExternalLink, MapPinPlus, Navigation, X } from 'lucide-react';
import { getLandmarkCategory, type Landmark } from '../../lib/kolkataLandmarks';
import { formatRouteDistance, formatRouteDuration, type PlannedRoute } from '../../lib/routePlanner';

interface LandmarkSheetProps {
    landmark: Landmark;
    route: PlannedRoute | null;
    routeLoading: boolean;
    status: string;
    onRoute: (landmark: Landmark) => void;
    onPin: (landmark: Landmark) => void;
    onClose: () => void;
}

export const LandmarkSheet: React.FC<LandmarkSheetProps> = ({ landmark, route, routeLoading, status, onRoute, onPin, onClose }) => {
    const category = getLandmarkCategory(landmark.category);
    return (
        <aside className="map2-detail-sheet" aria-label={`${landmark.name} details`}>
            <div className="map2-panel-head">
                <div>
                    <span className="map2-landmark-kicker">
                        <i style={{ ['--cat-color' as string]: category.color }} aria-hidden="true">{category.emoji}</i>
                        {category.label} · {landmark.zone} Kolkata
                    </span>
                    <h1>{landmark.name}</h1>
                </div>
                <button type="button" className="map2-icon-btn" onClick={onClose} aria-label="Close place details">
                    <X size={18} />
                </button>
            </div>

            <p>{landmark.summary}</p>

            {route ? (
                <div className="map2-route-metrics">
                    <div><span>Distance</span><strong>{formatRouteDistance(route.distance_meters)}</strong></div>
                    <div><span>Drive</span><strong>{formatRouteDuration(route.duration_seconds)}</strong></div>
                    <div><span>From</span><strong>You</strong></div>
                </div>
            ) : null}

            <div className="map2-explore-actions">
                <button type="button" className="map2-route-primary" onClick={() => onRoute(landmark)} disabled={routeLoading}>
                    <Navigation size={17} />
                    <span>{routeLoading ? 'Finding route' : 'Route here'}</span>
                </button>
                <button type="button" className="map2-puja-secondary" onClick={() => onPin(landmark)}>
                    <MapPinPlus size={16} />
                    <span>Pin it</span>
                </button>
            </div>

            <a
                className="map2-explore-source"
                href={`https://www.google.com/maps/dir/?api=1&destination=${landmark.lat},${landmark.lng}`}
                target="_blank"
                rel="noreferrer"
            >
                <ExternalLink size={13} /> Open directions in Google Maps
            </a>
            {status ? <p className="map2-status">{status}</p> : null}
        </aside>
    );
};
