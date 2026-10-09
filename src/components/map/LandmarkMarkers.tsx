import React, { useMemo, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import { buildEmojiMarkerIcon } from '../../lib/mapPins';
import { getLandmarkCategory, type Landmark } from '../../lib/kolkataLandmarks';
import { MapMarker } from './MapMarker';

/** From this zoom level every place is drawn; below it only one pin per screen cell, so Central Kolkata stays readable. */
const FULL_DETAIL_ZOOM = 15;
const CELL_PX = 46;

interface LandmarkMarkersProps {
    /** Landmarks to draw, most important first: when two collide at a low zoom, the earlier one wins. */
    landmarks: Landmark[];
    /** Positions that are already drawn by something else (the curated places) and keep their space. */
    reserved: Array<{ lat: number; lng: number }>;
    selectedId: string | null;
    /** Must be a stable callback so the markers do not re-render on every parent render. */
    onSelect: (landmark: Landmark) => void;
}

/** Must be rendered inside a react-leaflet MapContainer. */
export const LandmarkMarkers: React.FC<LandmarkMarkersProps> = ({ landmarks, reserved, selectedId, onSelect }) => {
    const map = useMap();
    const [zoom, setZoom] = useState(() => map.getZoom());
    useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

    const visible = useMemo(() => {
        if (zoom >= FULL_DETAIL_ZOOM) return landmarks;
        const cellOf = (lat: number, lng: number) => {
            const projected = map.project([lat, lng], zoom);
            return `${Math.floor(projected.x / CELL_PX)}:${Math.floor(projected.y / CELL_PX)}`;
        };
        const taken = new Set(reserved.map((item) => cellOf(item.lat, item.lng)));
        const shown: Landmark[] = [];
        for (const landmark of landmarks) {
            const key = cellOf(landmark.lat, landmark.lng);
            if (landmark.id === selectedId || !taken.has(key)) {
                taken.add(key);
                shown.push(landmark);
            }
        }
        return shown;
    }, [landmarks, map, reserved, selectedId, zoom]);

    return (
        <>
            {visible.map((landmark) => {
                const selected = landmark.id === selectedId;
                return (
                    <MapMarker
                        key={landmark.id}
                        item={landmark}
                        lat={landmark.lat}
                        lng={landmark.lng}
                        icon={buildEmojiMarkerIcon(getLandmarkCategory(landmark.category).emoji, { active: selected })}
                        zIndexOffset={selected ? 800 : 0}
                        onSelect={onSelect}
                        title={landmark.name}
                    />
                );
            })}
        </>
    );
};
