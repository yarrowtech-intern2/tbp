import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowDown,
    ArrowUp,
    CalendarDays,
    Check,
    Languages,
    MapPin,
    MessageSquare,
    Navigation,
    Plus,
    Trash2,
    Users,
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
    createPujaGuideRequest,
    fetchApprovedPujaGuides,
    fetchPujaRequests,
    formatRupees,
    getPandal,
    PANDAL_ZONES,
    PUJA_PANDALS,
    PUJA_REQUEST_LABELS,
    updatePujaRequestStatus,
    type PandalZone,
    type PujaGuide,
    type PujaGuideRequest,
    type PujaPandal,
} from '../../lib/pujaGuide';

type PujaTab = 'pandals' | 'plan' | 'guides';

const toRoutePlace = (pandal: PujaPandal): RoutePlace => ({
    id: pandal.id,
    name: pandal.name,
    lat: pandal.lat,
    lng: pandal.lng,
    category: 'Durga Puja pandal',
    kind: 'suggested',
    visited: false,
    display_name: `${pandal.name}, ${pandal.area}, Kolkata`,
    source: 'system',
});

const todayIso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const formatVisitDate = (value: string) => (
    new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
);

interface PujaGuidePanelProps {
    userId: string | null;
    plan: string[];
    onPlanChange: (ids: string[]) => void;
    selectedPandalId: string | null;
    onSelectPandal: (id: string | null) => void;
    route: PlannedRoute | null;
    onRouteChange: (route: PlannedRoute | null) => void;
    userLocation: { lat: number; lng: number } | null;
    showPlanOnly: boolean;
    onShowPlanOnlyChange: (value: boolean) => void;
    onClose: () => void;
}

export const PujaGuidePanel: React.FC<PujaGuidePanelProps> = ({
    userId,
    plan,
    onPlanChange,
    selectedPandalId,
    onSelectPandal,
    route,
    onRouteChange,
    userLocation,
    showPlanOnly,
    onShowPlanOnlyChange,
    onClose,
}) => {
    const [tab, setTab] = useState<PujaTab>('pandals');
    const [zone, setZone] = useState<PandalZone | 'All'>('All');
    const [travelMode, setTravelMode] = useState<TravelMode>('walking');
    const [startFromMe, setStartFromMe] = useState(false);
    const [routeLoading, setRouteLoading] = useState(false);
    const [routeStatus, setRouteStatus] = useState('');

    const [guides, setGuides] = useState<PujaGuide[]>([]);
    const [guidesLoading, setGuidesLoading] = useState(false);
    const [guidesError, setGuidesError] = useState('');
    const [selectedGuideId, setSelectedGuideId] = useState<string | null>(null);
    const [requestOpen, setRequestOpen] = useState(false);
    const [visitDate, setVisitDate] = useState(todayIso());
    const [groupSize, setGroupSize] = useState(2);
    const [note, setNote] = useState('');
    const [requestStatus, setRequestStatus] = useState('');
    const [requestSaving, setRequestSaving] = useState(false);
    const [myRequests, setMyRequests] = useState<PujaGuideRequest[]>([]);

    const planOnly = showPlanOnly && plan.length > 0;
    const visiblePandals = useMemo(
        () => PUJA_PANDALS.filter((item) => (
            (zone === 'All' || item.zone === zone) && (!planOnly || plan.includes(item.id))
        )),
        [plan, planOnly, zone],
    );
    const planPandals = useMemo(() => plan.map(getPandal).filter((item): item is PujaPandal => Boolean(item)), [plan]);
    const selectedGuide = guides.find((item) => item.user_id === selectedGuideId) || null;

    // Selecting a pandal on the map jumps back to the pandal list so its card is visible.
    useEffect(() => {
        if (selectedPandalId) setTab('pandals');
    }, [selectedPandalId]);

    useEffect(() => {
        if (tab !== 'guides' || guides.length || guidesLoading) return;
        setGuidesLoading(true);
        fetchApprovedPujaGuides()
            .then((rows) => { setGuides(rows); setGuidesError(''); })
            .catch((error: Error) => setGuidesError(error.message))
            .finally(() => setGuidesLoading(false));
    }, [guides.length, guidesLoading, tab]);

    useEffect(() => {
        if (tab !== 'guides' || !userId) return;
        fetchPujaRequests(userId, 'tourist').then(setMyRequests).catch(() => setMyRequests([]));
    }, [tab, userId]);

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
        const places = planPandals.map(toRoutePlace);
        if (startFromMe && userLocation) {
            places.unshift({
                id: 'me', name: 'Your location', lat: userLocation.lat, lng: userLocation.lng,
                category: 'Start', kind: 'suggested', visited: false, display_name: 'Your location', source: 'system',
            });
        }
        if (places.length < 2) {
            setRouteStatus('Add at least two pandals to your plan to make a route.');
            return;
        }

        setRouteLoading(true);
        setRouteStatus('Building your pandal route...');
        try {
            const built = await buildSmartRoute({
                city: 'Kolkata',
                start: places[0],
                destination: places[places.length - 1],
                stops: places.slice(1, -1),
                travelMode,
            });
            onRouteChange({ ...built, title: `Puja route: ${planPandals.length} pandals` });
            setRouteStatus('');
        } catch {
            setRouteStatus('Route service is unavailable right now. Please try again in a moment.');
        } finally {
            setRouteLoading(false);
        }
    };

    const handleSendRequest = async () => {
        if (!userId || !selectedGuide) return;
        if (!visitDate || visitDate < todayIso()) {
            setRequestStatus('Pick today or a future date.');
            return;
        }
        setRequestSaving(true);
        setRequestStatus('Sending request...');
        try {
            const created = await createPujaGuideRequest({
                touristId: userId,
                guideId: selectedGuide.user_id,
                visitDate,
                groupSize,
                pandalIds: plan,
                note,
            });
            setMyRequests((current) => [{ ...created, guide_name: selectedGuide.display_name }, ...current]);
            setRequestOpen(false);
            setNote('');
            setRequestStatus(`Request sent to ${selectedGuide.display_name}. You can chat with them while they review it.`);
        } catch (error) {
            setRequestStatus(error instanceof Error ? error.message : 'Could not send the request.');
        } finally {
            setRequestSaving(false);
        }
    };

    const handleCancelRequest = async (request: PujaGuideRequest) => {
        if (!userId) return;
        try {
            await updatePujaRequestStatus(request, 'cancelled', userId);
            setMyRequests((current) => current.map((item) => (item.id === request.id ? { ...item, status: 'cancelled' } : item)));
        } catch (error) {
            setRequestStatus(error instanceof Error ? error.message : 'Could not cancel the request.');
        }
    };

    return (
        <aside className="map2-route-panel map2-puja-panel" aria-label="Durga Puja guide">
            <div className="map2-panel-head">
                <div>
                    <span>Durga Puja guide</span>
                    <h1>Pandal hopping in Kolkata</h1>
                </div>
                <button type="button" className="map2-icon-btn" onClick={onClose} aria-label="Close Puja guide">
                    <X size={18} />
                </button>
            </div>

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
                    Show only my pandals on the map
                    <small>{plan.length ? `${plan.length} in your plan` : 'Add pandals to your plan first'}</small>
                </span>
            </label>

            <div className="map2-mode-row map2-puja-tabs" role="tablist" aria-label="Puja guide sections">
                {([
                    ['pandals', 'Pandals'],
                    ['plan', `My plan${plan.length ? ` (${plan.length})` : ''}`],
                    ['guides', 'Guides'],
                ] as Array<[PujaTab, string]>).map(([key, label]) => (
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

            {tab === 'pandals' && (
                <>
                    <div className="map2-puja-chips" role="group" aria-label="Filter by area">
                        {(['All', ...PANDAL_ZONES] as Array<PandalZone | 'All'>).map((item) => (
                            <button
                                key={item}
                                type="button"
                                className={zone === item ? 'is-active' : ''}
                                aria-pressed={zone === item}
                                onClick={() => setZone(item)}
                            >
                                {item}
                            </button>
                        ))}
                    </div>

                    <ul className="map2-puja-list">
                        {visiblePandals.map((pandal) => {
                            const inPlan = plan.includes(pandal.id);
                            const selected = selectedPandalId === pandal.id;
                            return (
                                <li key={pandal.id} className={selected ? 'is-selected' : ''}>
                                    <button type="button" className="map2-puja-row" onClick={() => onSelectPandal(selected ? null : pandal.id)}>
                                        <span>
                                            <strong>{pandal.name}</strong>
                                            <small>{pandal.area} · {pandal.zone}</small>
                                        </span>
                                        {inPlan ? <em className="map2-puja-badge">#{plan.indexOf(pandal.id) + 1}</em> : null}
                                    </button>
                                    {selected && (
                                        <div className="map2-puja-detail">
                                            <p>{pandal.highlight}</p>
                                            <button
                                                type="button"
                                                className={`map2-puja-plan-btn${inPlan ? ' is-in' : ''}`}
                                                onClick={() => togglePlan(pandal.id)}
                                            >
                                                {inPlan ? <Check size={16} /> : <Plus size={16} />}
                                                <span>{inPlan ? 'In my plan · remove' : 'Add to my plan'}</span>
                                            </button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    <small className="map2-pin-coords">Pandal locations are approximate. Themes and timings change every year.</small>
                </>
            )}

            {tab === 'plan' && (
                <>
                    {planPandals.length ? (
                        <ol className="map2-puja-plan">
                            {planPandals.map((pandal, index) => (
                                <li key={pandal.id}>
                                    <b>{index + 1}</b>
                                    <button type="button" className="map2-puja-plan-name" onClick={() => onSelectPandal(pandal.id)}>
                                        <strong>{pandal.name}</strong>
                                        <small>{pandal.area}</small>
                                    </button>
                                    <span className="map2-puja-plan-actions">
                                        <button type="button" onClick={() => movePlan(index, -1)} disabled={index === 0} aria-label={`Move ${pandal.name} earlier`}><ArrowUp size={15} /></button>
                                        <button type="button" onClick={() => movePlan(index, 1)} disabled={index === planPandals.length - 1} aria-label={`Move ${pandal.name} later`}><ArrowDown size={15} /></button>
                                        <button type="button" onClick={() => togglePlan(pandal.id)} aria-label={`Remove ${pandal.name}`}><Trash2 size={15} /></button>
                                    </span>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="map2-status">Your plan is empty. Open a pandal on the map or in the list and tap "Add to my plan".</p>
                    )}

                    {!userId && planPandals.length ? (
                        <small className="map2-pin-coords">Saved in this browser. <Link to="/login">Log in</Link> to keep it on your account.</small>
                    ) : null}

                    <div className="map2-mode-row" aria-label="Travel mode">
                        {(['walking', 'driving', 'cycling'] as TravelMode[]).map((mode) => (
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
                        disabled={routeLoading || planPandals.length + (startFromMe && userLocation ? 1 : 0) < 2}
                    >
                        <Navigation size={18} />
                        <span>{routeLoading ? 'Building route' : 'Make pandal route'}</span>
                    </button>

                    {routeStatus ? <p className="map2-status">{routeStatus}</p> : null}

                    {route ? (
                        <div className="map2-route-metrics">
                            <div><span>Distance</span><strong>{formatRouteDistance(route.distance_meters)}</strong></div>
                            <div><span>Duration</span><strong>{formatRouteDuration(route.duration_seconds)}</strong></div>
                            <div><span>Pandals</span><strong>{planPandals.length}</strong></div>
                        </div>
                    ) : null}

                    {planPandals.length ? (
                        <button type="button" className="map2-puja-link" onClick={() => setTab('guides')}>
                            <Users size={16} />
                            <span>Find a guide for this plan</span>
                        </button>
                    ) : null}
                </>
            )}

            {tab === 'guides' && (
                <>
                    {guidesLoading ? <p className="map2-status">Loading guides...</p> : null}
                    {guidesError ? <p className="map2-status">{guidesError}</p> : null}
                    {!guidesLoading && !guidesError && !guides.length ? (
                        <p className="map2-status">No Puja guides are available yet. Check back closer to Puja.</p>
                    ) : null}

                    <ul className="map2-puja-list">
                        {guides.map((guide) => {
                            const selected = guide.user_id === selectedGuideId;
                            return (
                                <li key={guide.user_id} className={selected ? 'is-selected' : ''}>
                                    <button
                                        type="button"
                                        className="map2-puja-row"
                                        onClick={() => {
                                            setSelectedGuideId(selected ? null : guide.user_id);
                                            setRequestOpen(false);
                                            setRequestStatus('');
                                            setGroupSize((current) => Math.min(current, guide.max_group_size));
                                        }}
                                    >
                                        {guide.avatar_url
                                            ? <img src={guide.avatar_url} alt="" className="map2-puja-avatar" />
                                            : <span className="map2-puja-avatar" aria-hidden="true">{guide.display_name.charAt(0)}</span>}
                                        <span>
                                            <strong>{guide.display_name}</strong>
                                            <small>{guide.languages || 'Languages not listed'}</small>
                                        </span>
                                        <em className="map2-puja-price">{guide.price_per_day > 0 ? `${formatRupees(guide.price_per_day)}/day` : 'Ask price'}</em>
                                    </button>

                                    {selected && (
                                        <div className="map2-puja-detail">
                                            {guide.bio ? <p>{guide.bio}</p> : null}
                                            <ul className="map2-puja-facts">
                                                {guide.areas ? <li><MapPin size={14} /> {guide.areas}</li> : null}
                                                {guide.languages ? <li><Languages size={14} /> {guide.languages}</li> : null}
                                                <li><Users size={14} /> Up to {guide.max_group_size} people</li>
                                            </ul>

                                            {!userId ? (
                                                <Link to="/login" className="map2-route-primary">Log in to contact or book</Link>
                                            ) : userId === guide.user_id ? (
                                                <small className="map2-pin-coords">This is your guide profile.</small>
                                            ) : (
                                                <div className="map2-puja-actions">
                                                    <Link to={`/messages?user=${guide.user_id}`} className="map2-puja-secondary">
                                                        <MessageSquare size={16} />
                                                        <span>Chat</span>
                                                    </Link>
                                                    <button type="button" className="map2-route-primary" onClick={() => setRequestOpen((current) => !current)}>
                                                        <CalendarDays size={16} />
                                                        <span>{requestOpen ? 'Close request' : 'Request booking'}</span>
                                                    </button>
                                                </div>
                                            )}

                                            {requestOpen && userId && userId !== guide.user_id && (
                                                <form
                                                    className="map2-pin-fields"
                                                    onSubmit={(event) => { event.preventDefault(); void handleSendRequest(); }}
                                                >
                                                    <label>
                                                        <span>Date</span>
                                                        <input type="date" value={visitDate} min={todayIso()} onChange={(event) => setVisitDate(event.target.value)} required />
                                                    </label>
                                                    <label>
                                                        <span>Group size</span>
                                                        <input
                                                            type="number"
                                                            min={1}
                                                            max={guide.max_group_size}
                                                            value={groupSize}
                                                            onChange={(event) => setGroupSize(Math.max(1, Math.min(guide.max_group_size, Number(event.target.value) || 1)))}
                                                            required
                                                        />
                                                    </label>
                                                    <label>
                                                        <span>Message for the guide</span>
                                                        <textarea
                                                            rows={3}
                                                            maxLength={1000}
                                                            value={note}
                                                            onChange={(event) => setNote(event.target.value)}
                                                            placeholder="Preferred start time, pickup point, anything they should know"
                                                        />
                                                    </label>
                                                    <small className="map2-pin-coords">
                                                        {planPandals.length
                                                            ? `Your plan (${planPandals.map((item) => item.name).join(', ')}) is shared with the guide.`
                                                            : 'Tip: add pandals to your plan first so the guide can see where you want to go.'}
                                                    </small>
                                                    <button type="submit" className="map2-route-primary" disabled={requestSaving}>
                                                        <span>{requestSaving ? 'Sending' : 'Send booking request'}</span>
                                                    </button>
                                                </form>
                                            )}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>

                    {requestStatus ? <p className="map2-status">{requestStatus}</p> : null}

                    {userId && myRequests.length ? (
                        <section className="map2-puja-requests" aria-label="My guide requests">
                            <strong>My requests</strong>
                            {myRequests.map((request) => (
                                <div key={request.id} className="map2-puja-request">
                                    <span>
                                        <b>{request.guide_name}</b>
                                        <small>{formatVisitDate(request.visit_date)} · {request.group_size} people</small>
                                    </span>
                                    <em className={`map2-puja-status is-${request.status}`}>{PUJA_REQUEST_LABELS[request.status]}</em>
                                    <span className="map2-puja-plan-actions">
                                        <Link to={`/messages?user=${request.guide_id}`} aria-label={`Chat with ${request.guide_name}`}><MessageSquare size={15} /></Link>
                                        {request.status === 'pending' || request.status === 'accepted' ? (
                                            <button type="button" onClick={() => void handleCancelRequest(request)} aria-label="Cancel request"><X size={15} /></button>
                                        ) : null}
                                    </span>
                                </div>
                            ))}
                        </section>
                    ) : null}
                </>
            )}
        </aside>
    );
};
