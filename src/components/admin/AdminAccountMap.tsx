import React, { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
    divIcon,
    latLngBounds,
    point,
} from 'leaflet';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import {
    ChevronDown,
    ChevronUp,
    Globe2,
    Info,
    MapPin,
    RotateCcw,
    UserRound,
    X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import {
    getAccountRoleGroup,
    resolveAdminAccountLocations,
    type AccountRoleGroup,
} from '../../lib/accountGeo';
import type { AdminAccountLocationRecord } from '../../lib/destinations';
import { getRoleLabel } from '../../lib/platform';
import './admin-account-map.css';

type AdminAccountMapProps = {
    accounts: AdminAccountLocationRecord[];
};

type AccountPin = {
    id: string;
    account: AdminAccountLocationRecord;
    roleGroup: AccountRoleGroup;
    color: string;
    lat: number;
    lng: number;
    locationKey: string;
    locationLabel: string;
    locationCount: number;
};

type MapViewportControllerProps = {
    pins: AccountPin[];
    selectedPin: AccountPin | null;
    resetToken: number;
    onZoomChange: (zoom: number) => void;
};

const ROLE_COLORS: Record<AccountRoleGroup, { light: string; dark: string }> = {
    tourist: { light: '#0f766e', dark: '#5eead4' },
    provider: { light: '#b45309', dark: '#fbbf24' },
    admin: { light: '#4338ca', dark: '#a5b4fc' },
    other: { light: '#475569', dark: '#cbd5e1' },
};

const getPointColor = (role: AccountRoleGroup, theme: 'light' | 'dark') => ROLE_COLORS[role][theme];

const distributePinCoordinates = (lat: number, lng: number, index: number, total: number) => {
    if (total <= 1) return { lat, lng };

    const ringIndex = Math.floor(index / 6);
    const positionInRing = index % 6;
    const ringSize = Math.min(6 + (ringIndex * 4), Math.max(total, 6));
    const angle = ((positionInRing / ringSize) * Math.PI * 2) + (ringIndex * 0.55);
    const distance = 0.0012 + (ringIndex * 0.0007);
    const latOffset = Math.cos(angle) * distance;
    const lngOffset = (Math.sin(angle) * distance) / Math.max(0.35, Math.cos((lat * Math.PI) / 180));

    return {
        lat: Math.max(-85, Math.min(85, lat + latOffset)),
        lng: ((((lng + lngOffset) + 540) % 360) - 180),
    };
};

const buildPinIcon = (pin: AccountPin, selected: boolean) => divIcon({
    className: '',
    iconSize: point(34, 46),
    iconAnchor: point(17, 42),
    html: `
        <div class="acm-pin${selected ? ' is-selected' : ''}" style="--pin-color: ${pin.color}">
            <span class="acm-pin-pulse"></span>
            <span class="acm-pin-core"></span>
            <span class="acm-pin-stem"></span>
        </div>
    `,
});

const formatSince = (value?: string | null) => {
    if (!value) return 'Unknown';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Unknown';
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

const MapViewportController: React.FC<MapViewportControllerProps> = ({
    pins,
    selectedPin,
    resetToken,
    onZoomChange,
}) => {
    const map = useMap();

    useMapEvents({
        click: () => onZoomChange(map.getZoom()),
        zoomend: () => onZoomChange(map.getZoom()),
    });

    useEffect(() => {
        if (!pins.length) return;

        if (selectedPin) {
            map.flyTo([selectedPin.lat, selectedPin.lng], Math.max(map.getZoom(), 16), {
                animate: true,
                duration: 0.75,
            });
            return;
        }

        const bounds = latLngBounds(pins.map((pin) => [pin.lat, pin.lng] as [number, number]));
        map.fitBounds(bounds, {
            animate: true,
            duration: 0.9,
            paddingTopLeft: [340, 120],
            paddingBottomRight: [80, 120],
            maxZoom: 12,
        });
    }, [map, pins, resetToken, selectedPin]);

    return null;
};

export const AdminAccountMap: React.FC<AdminAccountMapProps> = ({ accounts }) => {
    const { theme } = useTheme();
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [activeRoleFilter, setActiveRoleFilter] = useState<'all' | AccountRoleGroup>('all');
    const [currentZoom, setCurrentZoom] = useState(4);
    const [resetToken, setResetToken] = useState(0);
    const [filtersCollapsed, setFiltersCollapsed] = useState(false);
    const [insightsCollapsed, setInsightsCollapsed] = useState(false);

    const resolution = useMemo(() => resolveAdminAccountLocations(accounts), [accounts]);

    const pins = useMemo<AccountPin[]>(() => (
        resolution.locations.flatMap((location) => (
            location.accounts.map((account, index) => {
                const roleGroup = getAccountRoleGroup(account.role);
                const coords = distributePinCoordinates(location.lat, location.lng, index, location.accounts.length);
                return {
                    id: account.id,
                    account,
                    roleGroup,
                    color: getPointColor(roleGroup, theme),
                    lat: coords.lat,
                    lng: coords.lng,
                    locationKey: location.key,
                    locationLabel: location.label,
                    locationCount: location.count,
                };
            })
        ))
    ), [resolution.locations, theme]);

    const filteredPins = useMemo(
        () => pins.filter((pin) => activeRoleFilter === 'all' || pin.roleGroup === activeRoleFilter),
        [activeRoleFilter, pins],
    );

    const filteredLocationCount = useMemo(
        () => new Set(filteredPins.map((pin) => pin.locationKey)).size,
        [filteredPins],
    );

    const selectedPin = useMemo(
        () => filteredPins.find((pin) => pin.id === selectedAccountId) || null,
        [filteredPins, selectedAccountId],
    );

    useEffect(() => {
        if (selectedAccountId && !filteredPins.some((pin) => pin.id === selectedAccountId)) {
            setSelectedAccountId(null);
        }
    }, [filteredPins, selectedAccountId]);

    const themeClass = theme === 'dark' ? 'is-dark' : 'is-light';

    const imageryUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const roadsUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}';
    const placesUrl = 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';

    if (!accounts.length) {
        return (
            <div className="acm-empty">
                <Globe2 size={28} />
                <strong>No accounts available for mapping.</strong>
                <p>Profiles need at least a country to appear on the map.</p>
            </div>
        );
    }

    return (
        <div className="acm-shell">
            <div className={`acm-stage ${themeClass}`}>
                <div className="acm-map-surface">
                    <MapContainer
                        center={[20.5937, 78.9629]}
                        zoom={4}
                        minZoom={3}
                        maxZoom={19}
                        zoomControl={false}
                        className="acm-map"
                    >
                        <ZoomControl position="bottomright" />
                        <TileLayer
                            url={imageryUrl}
                            attribution='Imagery &copy; Esri, Maxar, Earthstar Geographics'
                        />
                        <TileLayer
                            url={roadsUrl}
                            attribution='Roads &copy; Esri'
                            opacity={theme === 'dark' ? 0.95 : 0.92}
                        />
                        <TileLayer
                            url={placesUrl}
                            attribution='Places &copy; Esri'
                            opacity={theme === 'dark' ? 0.94 : 0.9}
                        />

                        <MapViewportController
                            pins={filteredPins}
                            selectedPin={selectedPin}
                            resetToken={resetToken}
                            onZoomChange={setCurrentZoom}
                        />

                        {filteredPins.map((pin) => (
                            <Marker
                                key={pin.id}
                                position={[pin.lat, pin.lng]}
                                icon={buildPinIcon(pin, selectedAccountId === pin.id)}
                                eventHandlers={{
                                    click: () => setSelectedAccountId(pin.id),
                                }}
                            />
                        ))}
                    </MapContainer>
                </div>

                <div className="acm-layout">
                    <div className="acm-sidebar-stack">
                        <section className={`acm-panel-card${filtersCollapsed ? ' is-collapsed' : ''}`}>
                            <button
                                type="button"
                                className="acm-panel-toggle"
                                onClick={() => setFiltersCollapsed((value) => !value)}
                                aria-expanded={!filtersCollapsed}
                            >
                                <span>Filters</span>
                                {filtersCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>

                            {!filtersCollapsed && (
                                <div className="acm-filter-bar">
                                    <button
                                        type="button"
                                        className={`acm-filter-chip${activeRoleFilter === 'all' ? ' is-active' : ''}`}
                                        onClick={() => setActiveRoleFilter('all')}
                                    >
                                        All
                                    </button>
                                    {(['tourist', 'provider', 'admin', 'other'] as AccountRoleGroup[]).map((role) => (
                                        <button
                                            key={role}
                                            type="button"
                                            className={`acm-filter-chip${activeRoleFilter === role ? ' is-active' : ''}`}
                                            onClick={() => setActiveRoleFilter(role)}
                                            style={{
                                                '--chip-color': getPointColor(role, theme),
                                            } as CSSProperties}
                                        >
                                            <span className="acm-legend-dot" style={{ background: getPointColor(role, theme) }} />
                                            <span>{role}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section className={`acm-panel-card${insightsCollapsed ? ' is-collapsed' : ''}`}>
                            <button
                                type="button"
                                className="acm-panel-toggle"
                                onClick={() => setInsightsCollapsed((value) => !value)}
                                aria-expanded={!insightsCollapsed}
                            >
                                <span>Location Info</span>
                                {insightsCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                            </button>

                            {!insightsCollapsed && (
                                <>
                                    <div className="acm-summary">
                                        <div><span>Pinned</span><strong>{filteredPins.length}</strong></div>
                                        <div><span>Locations</span><strong>{filteredLocationCount}</strong></div>
                                        <div><span>Zoom</span><strong>{currentZoom}</strong></div>
                                        <div><span>Unmapped</span><strong>{resolution.unmapped.length}</strong></div>
                                    </div>

                                    <div className="acm-info-copy">
                                        {selectedPin ? (
                                            <>
                                                <div className="acm-info-row">
                                                    <span>Selected</span>
                                                    <strong>{selectedPin.account.full_name || selectedPin.account.email || 'Unnamed account'}</strong>
                                                </div>
                                                <div className="acm-info-row">
                                                    <span>Location</span>
                                                    <strong>{selectedPin.locationLabel}</strong>
                                                </div>
                                                <div className="acm-info-row">
                                                    <span>Coordinates</span>
                                                    <strong>{selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}</strong>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="acm-info-row">
                                                    <span>Status</span>
                                                    <strong>No account selected</strong>
                                                </div>
                                                <p className="acm-info-note">
                                                    Click any pin to inspect location-aware profile details in a modal.
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </section>
                    </div>

                    <div className="acm-toolbar">
                        <button
                            type="button"
                            className="acm-control-btn"
                            onClick={() => {
                                setSelectedAccountId(null);
                                setResetToken((value) => value + 1);
                            }}
                        >
                            <RotateCcw size={16} />
                            <span>Reset View</span>
                        </button>
                    </div>
                </div>

                <div className="acm-stage-foot">
                    <div className="acm-stage-hint">
                        <Info size={15} />
                        <span>Desktop map: pan, zoom, inspect pins, and open summary modals without leaving the dashboard.</span>
                    </div>
                </div>
            </div>

            {selectedPin ? (
                <div className="acm-modal-backdrop" onClick={() => setSelectedAccountId(null)} role="presentation">
                    <div className="acm-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="acm-modal-head">
                            <div>
                                <h3>{selectedPin.account.full_name || selectedPin.account.email || 'Unnamed account'}</h3>
                                <p>{selectedPin.locationLabel} • {getRoleLabel(selectedPin.account.role)}</p>
                            </div>
                            <button
                                type="button"
                                className="acm-close-btn"
                                onClick={() => setSelectedAccountId(null)}
                                aria-label="Close account summary"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="acm-account-card acm-account-card-featured">
                            <div className="acm-account-top">
                                <div className="acm-account-avatar">
                                    {selectedPin.account.profile_image_url ? (
                                        <img
                                            src={selectedPin.account.profile_image_url}
                                            alt={selectedPin.account.full_name || selectedPin.account.email || 'User'}
                                        />
                                    ) : (
                                        <UserRound size={18} />
                                    )}
                                </div>
                                <div className="acm-account-copy">
                                    <strong>{selectedPin.account.full_name || selectedPin.account.email || 'Unnamed user'}</strong>
                                    <span>{selectedPin.account.email || 'No email on record'}</span>
                                </div>
                                <span
                                    className="acm-role-pill"
                                    style={{ color: getPointColor(selectedPin.roleGroup, theme) }}
                                >
                                    {getRoleLabel(selectedPin.account.role)}
                                </span>
                            </div>

                            <div className="acm-detail-grid">
                                <div>
                                    <span>Location</span>
                                    <strong>{[selectedPin.account.city, selectedPin.account.country].filter(Boolean).join(', ') || 'Unknown location'}</strong>
                                </div>
                                <div>
                                    <span>Phone</span>
                                    <strong>{selectedPin.account.phone || 'Not provided'}</strong>
                                </div>
                                <div>
                                    <span>Company</span>
                                    <strong>{selectedPin.account.company_name || 'Independent account'}</strong>
                                </div>
                                <div>
                                    <span>Website</span>
                                    <strong>{selectedPin.account.website || 'Not provided'}</strong>
                                </div>
                                <div>
                                    <span>Specialties</span>
                                    <strong>{selectedPin.account.provider_specialties || 'Not provided'}</strong>
                                </div>
                                <div>
                                    <span>Joined</span>
                                    <strong>{formatSince(selectedPin.account.created_at)}</strong>
                                </div>
                            </div>

                            <div className="acm-account-meta acm-account-meta-block">
                                <span><MapPin size={13} /> {selectedPin.lat.toFixed(5)}, {selectedPin.lng.toFixed(5)}</span>
                                <span>{selectedPin.account.is_verified ? 'Verified account' : 'Verification pending or not required'}</span>
                            </div>

                            {selectedPin.account.bio ? (
                                <div className="acm-bio-card">
                                    <span>Bio</span>
                                    <p>{selectedPin.account.bio}</p>
                                </div>
                            ) : null}

                            <div className="acm-account-actions">
                                <Link to={`/users/${selectedPin.account.id}`} className="acm-profile-link">
                                    Open full profile
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};
