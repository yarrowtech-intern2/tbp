import React, { useMemo } from 'react';
import { Marker } from 'react-leaflet';
import type { DivIcon } from 'leaflet';

interface MapMarkerProps<T> {
    item: T;
    lat: number;
    lng: number;
    icon: DivIcon;
    title?: string;
    zIndexOffset?: number;
    onSelect: (item: T) => void;
}

/**
 * A react-leaflet Marker that only re-renders when its own data changes.
 *
 * react-leaflet calls `setLatLng` whenever the `position` array identity changes and re-binds every event
 * listener when `eventHandlers` changes. Building those inline in a parent that re-renders on any state change
 * rewrote the DOM of every marker each time, which is what made the map stutter with ~140 markers.
 * `onSelect` must be a stable callback (see `useStableCallback` (./useStableCallback)) and `item` a stable reference.
 */
const MapMarkerBase = <T,>({ item, lat, lng, icon, title, zIndexOffset, onSelect }: MapMarkerProps<T>) => {
    const position = useMemo<[number, number]>(() => [lat, lng], [lat, lng]);
    const eventHandlers = useMemo(() => ({ click: () => onSelect(item) }), [item, onSelect]);
    return (
        <Marker
            icon={icon}
            position={position}
            zIndexOffset={zIndexOffset}
            eventHandlers={eventHandlers}
            title={title}
        />
    );
};

export const MapMarker = React.memo(MapMarkerBase) as typeof MapMarkerBase;
