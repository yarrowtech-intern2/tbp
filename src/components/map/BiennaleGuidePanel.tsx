import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    ChevronUp,
    ChevronsRight,
    Navigation,
    Search,
    Trash2,
    X,
} from 'lucide-react';
import {
    buildSmartRoute,
    formatRouteDistance,
    formatRouteDuration,
    type PlannedRoute,
    type RoutePlace,
    type TravelMode,
} from '../../lib/routePlanner';
import {
    BIENNALE_EVENTS,
    getBiennaleEvent,
    getBiennaleSite,
    BIENNALE_SITES,
    type BiennaleEventKey,
    type BiennaleSite,
} from '../../lib/biennaleGuide';
import { googleMapsDirectionsUrl } from '../../lib/walkTrail';
import type { TrailMapExport } from '../../lib/mapExport';
import { BiennalePinPopup } from './BiennalePinPopup';
import { BiennaleTrails } from './BiennaleTrails';
import './puja-pin-popup.css';

type BiennaleTab = 'sites' | 'plan' | 'trails';

/** One colour per Biennale; the same dots appear on the filter chips and on each site row. */
const EVENT_COLORS: Record<BiennaleEventKey, string> = {
    iaadb: '#38bdf8',
    bengal: '#fbbf24',
    ladakh: '#34d399',
    bihar: '#fb7185',
};

const toRoutePlace = (site: BiennaleSite): RoutePlace => ({
    id: site.id,
    name: site.name,
    lat: site.lat,
    lng: site.lng,
    category: 'Biennale venue',
    kind: 'suggested',
    visited: false,
    display_name: `${site.name}, ${site.address}`,
    source: 'system',
});

type SheetState = 'peek' | 'half' | 'full';

/** Phone bottom sheet: swipe up for more list, down to give the map back. */
const nextSheet = (current: SheetState, direction: 'up' | 'down'): SheetState => {
    if (direction === 'up') return current === 'peek' ? 'half' : 'full';
    return current === 'full' ? 'half' : 'peek';
};

interface BiennaleGuidePanelProps {
    userId: string | null;
    plan: string[];
    onPlanChange: (ids: string[]) => void;
    selectedSiteId: string | null;
    onSelectSite: (id: string | null) => void;
    route: PlannedRoute | null;
    onRouteChange: (route: PlannedRoute | null) => void;
    trailIds: string[] | null;
    onTrailChange: (ids: string[] | null) => void;
    trailPlaying: boolean;
    onTrailPlayingChange: (playing: boolean) => void;
    /** Fits the open trail on the map and captures it as a PDF plus a compact image. */
    onExportTrailMap: (title: string) => Promise<TrailMapExport>;
    userLocation: { lat: number; lng: number } | null;
    showPlanOnly: boolean;
    onShowPlanOnlyChange: (value: boolean) => void;
    onClose: () => void;
}

export const BiennaleGuidePanel: React.FC<BiennaleGuidePanelProps> = ({
    userId,
    plan,
    onPlanChange,
    selectedSiteId,
    onSelectSite,
    route,
    onRouteChange,
    trailIds,
    onTrailChange,
    trailPlaying,
    onTrailPlayingChange,
    onExportTrailMap,
    userLocation,
    showPlanOnly,
    onShowPlanOnlyChange,
    onClose,
}) => {
    const [tab, setTab] = useState<BiennaleTab>('sites');
    const [sheet, setSheet] = useState<SheetState>('half');
    // Collapsing tucks the whole guide into a small pill so it stops covering the map.
    const [collapsed, setCollapsed] = useState(false);
    const dragStartY = useRef<number | null>(null);
    const [eventKey, setEventKey] = useState<BiennaleEventKey | 'All'>('All');
    const [search, setSearch] = useState('');
    const [travelMode, setTravelMode] = useState<TravelMode>('driving');
    const [startFromMe, setStartFromMe] = useState(false);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeStatus, setRouteStatus] = useState('');

    const planOnly = showPlanOnly && plan.length > 0;
    const searchTerms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const visibleSites = useMemo(
        () => BIENNALE_SITES.filter((item) => {
            if (eventKey !== 'All' && item.eventKey !== eventKey) return false;
            if (planOnly && !plan.includes(item.id)) return false;
            if (!searchTerms.length) return true;
            const haystack = `${item.name} ${item.address} ${getBiennaleEvent(item.eventKey).name}`.toLowerCase();
            return searchTerms.every((term) => haystack.includes(term));
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [plan, planOnly, eventKey, search],
    );
    const planSites = useMemo(() => plan.map(getBiennaleSite).filter((item): item is BiennaleSite => Boolean(item)), [plan]);
    const selectedSite = selectedSiteId ? getBiennaleSite(selectedSiteId) : null;

    const togglePlan = (id: string) => {
        onPlanChange(plan.includes(id) ? plan.filter((item) => item !== id) : [...plan, id]);
        onRouteChange(null);
    };

    const movePlan = (index: number, offset: -1 | 1) => {
        const next = [...plan];
        const target = index + offset;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onPlanChange(next);
        onRouteChange(null);
    };

    const handleBuildRoute = async () => {
        const places = planSites.map(toRoutePlace);
        if (startFromMe && userLocation) {
            places.unshift({
                id: 'me', name: 'Your location', lat: userLocation.lat, lng: userLocation.lng,
                category: 'Start', kind: 'suggested', visited: false, display_name: 'Your location', source: 'system',
            });
        }
        if (places.length < 2) {
            setRouteStatus('Add at least two venues to your plan to make a route.');
            return;
        }

        setRouteLoading(true);
        setRouteStatus('Building your Biennale route...');
        try {
            const built = await buildSmartRoute({
                city: 'India',
                start: places[0],
                destination: places[places.length - 1],
                stops: places.slice(1, -1),
                travelMode,
            });
            onRouteChange({ ...built, title: `Biennale route: ${planSites.length} venues` });
            setRouteStatus('');
        } catch {
            setRouteStatus('Route service is unavailable right now. Please try again in a moment.');
        } finally {
            setRouteLoading(false);
        }
    };

    // Draws one of the ready-made trail routes (driving) and drops the sheet so the route is visible.
    const showTrailRoute = async (sites: BiennaleSite[], title: string) => {
        const places = sites.map(toRoutePlace);
        const built = await buildSmartRoute({
            city: 'India',
            start: places[0],
            destination: places[places.length - 1],
            stops: places.slice(1, -1),
            travelMode: 'driving',
        });
        onRouteChange({ ...built, title });
        onTrailChange(sites.map((site) => site.id));
        setSheet('half');
    };

    const clearTrailRoute = () => {
        onRouteChange(null);
        onTrailChange(null);
    };

    const trailActive = Boolean(trailIds);
    useEffect(() => {
        if (trailActive && tab !== 'trails') {
            onRouteChange(null);
            onTrailChange(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab, trailActive]);

    // Tapping any venue pin opens a circular popup in the middle of the map; the list sheet stays as it is.
    const popupEl = selectedSite ? (
        <BiennalePinPopup
            title={selectedSite.name}
            subtitle={selectedSite.address}
            tag={{ label: getBiennaleEvent(selectedSite.eventKey).shortName, color: EVENT_COLORS[selectedSite.eventKey] }}
            directionsHref={googleMapsDirectionsUrl(selectedSite, travelMode)}
            plan={{ inPlan: plan.includes(selectedSite.id), onToggle: () => togglePlan(selectedSite.id) }}
            onClose={() => onSelectSite(null)}
        />
    ) : null;

    return (
        <>
        {popupEl}
        {collapsed ? (
            <button
                type="button"
                className="map2-puja-reopen"
                onClick={() => setCollapsed(false)}
                aria-label="Show the Biennale guide"
            >
                <span>Biennale guide{plan.length ? ` · ${plan.length} in plan` : ''}</span>
                <ChevronUp size={16} className="map2-puja-reopen-chevron" aria-hidden="true" />
            </button>
        ) : null}
        <aside
            className={`map2-route-panel map2-puja-panel map2-biennale-panel is-${sheet}`}
            aria-label="Biennale guide"
            style={collapsed ? { display: 'none' } : undefined}
        >
            <button
                type="button"
                className="map2-sheet-handle"
                aria-label={sheet === 'peek' ? 'Show the guide' : 'Show more of the map'}
                aria-expanded={sheet !== 'peek'}
                onPointerDown={(event) => {
                    dragStartY.current = event.clientY;
                    event.currentTarget.setPointerCapture(event.pointerId);
                }}
                onPointerUp={(event) => {
                    const start = dragStartY.current;
                    dragStartY.current = null;
                    if (start === null) return;
                    const delta = start - event.clientY;
                    if (Math.abs(delta) < 12) setSheet((current) => (current === 'peek' ? 'half' : current === 'half' ? 'peek' : 'half'));
                    else setSheet((current) => nextSheet(current, delta > 0 ? 'up' : 'down'));
                }}
            >
                <span aria-hidden="true" />
            </button>

            <div className="map2-panel-head">
                <div>
                    <span>Biennale guide</span>
                    <h1>Art &amp; design biennales of India</h1>
                </div>
                <div className="map2-puja-head-actions">
                    <button type="button" className="map2-icon-btn" onClick={() => setCollapsed(true)} aria-label="Collapse the Biennale guide" title="Collapse">
                        <ChevronsRight size={18} className="map2-collapse-side" />
                        <ChevronDown size={18} className="map2-collapse-down" />
                    </button>
                    <button type="button" className="map2-icon-btn" onClick={onClose} aria-label="Close Biennale guide">
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="map2-puja-body">
                <div className="map2-puja-switches">
                <label className={`map2-puja-switch${plan.length ? '' : ' is-disabled'}`}>
                    <input
                        type="checkbox"
                        role="switch"
                        checked={showPlanOnly && plan.length > 0}
                        disabled={!plan.length}
                        onChange={(event) => onShowPlanOnlyChange(event.target.checked)}
                    />
                    <span className="map2-puja-switch-track" aria-hidden="true"><span /></span>
                    <span>
                        My venues only
                        <small>{plan.length ? `${plan.length} in your plan` : 'Plan is empty'}</small>
                    </span>
                </label>
                </div>

                <div className="map2-mode-row map2-puja-tabs" role="tablist" aria-label="Biennale guide sections" data-active={tab}>
                    {([
                        ['sites', 'Venues'],
                        ['plan', `My plan${plan.length ? ` (${plan.length})` : ''}`],
                        ['trails', 'Trails'],
                    ] as Array<[BiennaleTab, string]>).map(([key, label]) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={tab === key}
                            className={tab === key ? 'is-active' : ''}
                            onClick={() => setTab(key)}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {tab === 'sites' && (
                    <>
                        <form
                            className="map2-puja-search"
                            role="search"
                            onSubmit={(event) => {
                                event.preventDefault();
                                // Enter jumps to the first match on the map.
                                if (visibleSites[0]) onSelectSite(visibleSites[0].id);
                            }}
                        >
                            <Search size={16} aria-hidden="true" />
                            <input
                                type="search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search venues or Biennales"
                                aria-label="Search venues"
                                enterKeyHint="search"
                                autoComplete="off"
                            />
                            {search ? (
                                <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>
                            ) : null}
                        </form>

                        <div className="map2-puja-chips" role="group" aria-label="Filter by Biennale">
                            {(['All', ...BIENNALE_EVENTS.map((item) => item.key)] as Array<BiennaleEventKey | 'All'>).map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    className={eventKey === item ? 'is-active' : ''}
                                    aria-pressed={eventKey === item}
                                    onClick={() => setEventKey(item)}
                                >
                                    {item !== 'All' ? <i className="map2-zone-dot" style={{ background: EVENT_COLORS[item] }} aria-hidden="true" /> : null}
                                    {item === 'All' ? 'All' : getBiennaleEvent(item).shortName}
                                </button>
                            ))}
                        </div>

                        {!visibleSites.length ? (
                            <p className="map2-status">
                                {search ? `No venues match "${search.trim()}".` : 'No venues for this Biennale.'}
                            </p>
                        ) : null}

                        <ul className="map2-puja-list">
                            {visibleSites.map((site) => {
                                const inPlan = plan.includes(site.id);
                                const selected = selectedSiteId === site.id;
                                return (
                                    <li key={site.id} id={`biennale-site-${site.id}`} className={selected ? 'is-selected' : ''}>
                                        <button type="button" className="map2-puja-row" onClick={() => onSelectSite(selected ? null : site.id)}>
                                            <span className="map2-puja-row-text">
                                                <strong>{site.name}</strong>
                                                <small>{getBiennaleEvent(site.eventKey).shortName}</small>
                                            </span>
                                            {inPlan ? <em className="map2-puja-badge">#{plan.indexOf(site.id) + 1}</em> : null}
                                            <i
                                                className="map2-zone-dot is-row"
                                                style={{ background: EVENT_COLORS[site.eventKey] }}
                                                title={getBiennaleEvent(site.eventKey).shortName}
                                                role="img"
                                                aria-label={getBiennaleEvent(site.eventKey).shortName}
                                            />
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                        <small className="map2-pin-coords">Venue locations are approximate. Check official Biennale listings for current opening hours.</small>
                    </>
                )}

                {tab === 'plan' && (
                    <>
                        {planSites.length ? (
                            <ol className="map2-puja-plan">
                                {planSites.map((site, index) => (
                                    <li key={site.id}>
                                        <b>{index + 1}</b>
                                        <button type="button" className="map2-puja-plan-name" onClick={() => onSelectSite(site.id)}>
                                            <strong>{site.name}</strong>
                                            <small>{getBiennaleEvent(site.eventKey).shortName}</small>
                                        </button>
                                        <span className="map2-puja-plan-actions">
                                            <button type="button" onClick={() => movePlan(index, -1)} disabled={index === 0} aria-label={`Move ${site.name} earlier`}><ArrowUp size={15} /></button>
                                            <button type="button" onClick={() => movePlan(index, 1)} disabled={index === planSites.length - 1} aria-label={`Move ${site.name} later`}><ArrowDown size={15} /></button>
                                            <button type="button" onClick={() => togglePlan(site.id)} aria-label={`Remove ${site.name}`}><Trash2 size={15} /></button>
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="map2-status">Your plan is empty. Open a venue on the map or in the list and tap "Add to plan".</p>
                        )}

                        {!userId && planSites.length ? (
                            <small className="map2-pin-coords">Saved in this browser. <Link to="/login">Log in</Link> to keep using it on this device.</small>
                        ) : null}

                        <div className="map2-mode-row" aria-label="Travel mode">
                            {(['driving', 'walking', 'cycling'] as TravelMode[]).map((mode) => (
                                <button
                                    type="button"
                                    key={mode}
                                    className={travelMode === mode ? 'is-active' : ''}
                                    onClick={() => { setTravelMode(mode); onRouteChange(null); }}
                                >
                                    {mode}
                                </button>
                            ))}
                        </div>

                        <label className="map2-puja-check">
                            <input
                                type="checkbox"
                                checked={startFromMe}
                                disabled={!userLocation}
                                onChange={(event) => { setStartFromMe(event.target.checked); onRouteChange(null); }}
                            />
                            <span>{userLocation ? 'Start from my location' : 'Start from my location (tap locate first)'}</span>
                        </label>

                        <button
                            type="button"
                            className="map2-route-primary"
                            onClick={() => void handleBuildRoute()}
                            disabled={routeLoading || planSites.length + (startFromMe && userLocation ? 1 : 0) < 2}
                        >
                            <Navigation size={18} />
                            <span>{routeLoading ? 'Building route' : 'Make Biennale route'}</span>
                        </button>

                        {routeStatus ? <p className="map2-status">{routeStatus}</p> : null}

                        {route ? (
                            <div className="map2-route-metrics">
                                <div><span>Distance</span><strong>{formatRouteDistance(route.distance_meters)}</strong></div>
                                <div><span>Duration</span><strong>{formatRouteDuration(route.duration_seconds)}</strong></div>
                                <div><span>Venues</span><strong>{planSites.length}</strong></div>
                            </div>
                        ) : null}
                    </>
                )}

                {tab === 'trails' && (
                    <BiennaleTrails
                        plan={plan}
                        onPlanChange={onPlanChange}
                        onShowRoute={showTrailRoute}
                        onClearRoute={clearTrailRoute}
                        playing={trailPlaying}
                        onPlayToggle={() => onTrailPlayingChange(!trailPlaying)}
                        userId={userId}
                        onExportMap={onExportTrailMap}
                        onSelectSite={onSelectSite}
                    />
                )}
            </div>
        </aside>
        </>
    );
};

export default BiennaleGuidePanel;
