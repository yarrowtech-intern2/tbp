import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import { Crosshair, Loader2, Search } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import { buildPlacePinIcon, type PlaceCategory } from '../../lib/providerPlaces';
import { getCurrentDevicePosition, searchDestinationPlaces, type RoutePlace } from '../../lib/routePlanner';
import './place-picker.css';

export interface PickedPosition {
    lat: number;
    lng: number;
}

interface PlacePickerProps {
    value: PickedPosition | null;
    category: PlaceCategory;
    /** `address` is only set when the position came from an address search. */
    onChange: (position: PickedPosition, address?: string) => void;
    disabled?: boolean;
}

const DEFAULT_CENTER: [number, number] = [22.5726, 88.3639];
const PICKED_ZOOM = 16;

/** Keeps Leaflet's size in sync: the picker often mounts inside a collapsed step or a modal that is still animating. */
const SizeWatcher: React.FC = () => {
    const map = useMap();
    useEffect(() => {
        const container = map.getContainer();
        const observer = new ResizeObserver(() => map.invalidateSize());
        observer.observe(container);
        return () => observer.disconnect();
    }, [map]);
    return null;
};

const ClickToPlace: React.FC<{ disabled?: boolean; onPick: (position: PickedPosition) => void }> = ({ disabled, onPick }) => {
    useMapEvents({
        click: (event) => {
            if (!disabled) onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
        },
    });
    return null;
};

const FlyTo: React.FC<{ target: PickedPosition | null; token: number }> = ({ target, token }) => {
    const map = useMap();
    useEffect(() => {
        if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), PICKED_ZOOM), { duration: 0.5 });
        // Only fly when the picker asks to (search, GPS), never while the pin is being dragged.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);
    return null;
};

/** A small map where a provider drops and drags a pin, searches an address, or uses their current location. */
export const PlacePicker: React.FC<PlacePickerProps> = ({ value, category, onChange, disabled }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<RoutePlace[]>([]);
    const [searching, setSearching] = useState(false);
    const [locating, setLocating] = useState(false);
    const [message, setMessage] = useState('');
    const [flyToken, setFlyToken] = useState(0);
    const markerRef = useRef<LeafletMarker | null>(null);
    const icon = useMemo(() => buildPlacePinIcon(category, { active: true }), [category]);
    const markerPosition = useMemo<[number, number] | null>(() => (value ? [value.lat, value.lng] : null), [value]);
    const initialCenter = useRef<[number, number]>(value ? [value.lat, value.lng] : DEFAULT_CENTER);

    const pick = (position: PickedPosition, address?: string, fly = false) => {
        onChange(position, address);
        if (fly) setFlyToken((token) => token + 1);
    };

    const handleSearch = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!query.trim()) return;
        setSearching(true);
        setMessage('');
        try {
            const places = await searchDestinationPlaces(query);
            setResults(places);
            if (places.length === 0) setMessage('No match found. Try a nearby landmark, or tap the map.');
        } catch {
            setMessage('Search is unavailable right now. Tap the map to place the pin.');
        } finally {
            setSearching(false);
        }
    };

    const handleLocate = async () => {
        setLocating(true);
        setMessage('');
        try {
            const me = await getCurrentDevicePosition();
            pick({ lat: me.lat, lng: me.lng }, undefined, true);
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not read your location.');
        } finally {
            setLocating(false);
        }
    };

    return (
        <div className="pp">
            <form className="pp-search" onSubmit={handleSearch}>
                <Search size={15} aria-hidden="true" />
                <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search an address or place"
                    aria-label="Search an address or place"
                    disabled={disabled}
                />
                <button type="submit" disabled={disabled || searching || !query.trim()}>
                    {searching ? <Loader2 size={15} className="pp-spin" /> : 'Find'}
                </button>
                <button type="button" className="pp-locate" onClick={() => void handleLocate()} disabled={disabled || locating} title="Use my current location" aria-label="Use my current location">
                    {locating ? <Loader2 size={16} className="pp-spin" /> : <Crosshair size={16} />}
                </button>
            </form>

            {results.length > 0 ? (
                <ul className="pp-results">
                    {results.map((place) => (
                        <li key={place.id}>
                            <button
                                type="button"
                                onClick={() => {
                                    pick({ lat: place.lat, lng: place.lng }, place.display_name || place.name, true);
                                    setResults([]);
                                }}
                            >
                                <strong>{place.name}</strong>
                                <small>{place.display_name}</small>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {message ? <p className="pp-message">{message}</p> : null}

            <div className="pp-map">
                <MapContainer center={initialCenter.current} zoom={value ? PICKED_ZOOM : 12} minZoom={4} maxZoom={19} scrollWheelZoom className="pp-leaflet">
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                        updateWhenZooming={false}
                    />
                    <SizeWatcher />
                    <ClickToPlace disabled={disabled} onPick={(position) => pick(position)} />
                    <FlyTo target={value} token={flyToken} />
                    {markerPosition ? (
                        <Marker
                            ref={markerRef}
                            position={markerPosition}
                            icon={icon}
                            draggable={!disabled}
                            eventHandlers={{
                                dragend: () => {
                                    const next = markerRef.current?.getLatLng();
                                    if (next) pick({ lat: next.lat, lng: next.lng });
                                },
                            }}
                        />
                    ) : null}
                </MapContainer>
                {!value ? <p className="pp-hint">Tap the map to drop your pin</p> : null}
            </div>
            {value ? <small className="pp-coords">{value.lat.toFixed(5)}, {value.lng.toFixed(5)}. Drag the pin to fine-tune.</small> : null}
        </div>
    );
};
