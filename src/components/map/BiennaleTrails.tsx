import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Check, ChevronDown, ChevronRight, Clock, Download, Loader2, MapPinned, Palette, Pause, Play, Plus, Route, Ticket, Car } from 'lucide-react';
import { buildLoginPath } from '../../lib/authRedirect';
import { saveBlob, type TrailMapExport } from '../../lib/mapExport';
import { deleteOfflineTrail, listOfflineTrails, saveOfflineTrail, type OfflineTrail } from '../../lib/offlineTrails';
import { getBiennaleEvent, type BiennaleSite } from '../../lib/biennaleGuide';
import { BIENNALE_TRAILS, formatTrailDuration, resolveBiennaleTrail, type ResolvedBiennaleTrail } from '../../lib/biennaleTrails';
import { OfflineTrailViewer } from './OfflineTrailViewer';
import './puja-trails.css';

interface BiennaleTrailsProps {
    userId: string | null;
    /** Fits the open trail on the map and captures it as a PDF plus a compact image. */
    onExportMap: (title: string) => Promise<TrailMapExport>;
    plan: string[];
    onPlanChange: (ids: string[]) => void;
    /** Builds the route through these sites and shows it on the map, with the stops numbered. */
    onShowRoute: (sites: BiennaleSite[], title: string) => Promise<void>;
    /** Removes the trail's route and stops from the map. */
    onClearRoute: () => void;
    playing: boolean;
    onPlayToggle: () => void;
    onSelectSite: (id: string | null) => void;
}

/** Ready-made Biennale routes: a short read plus buttons to draw the route or add every stop to the plan. */
export const BiennaleTrails: React.FC<BiennaleTrailsProps> = ({ userId, onExportMap, plan, onPlanChange, onShowRoute, onClearRoute, playing, onPlayToggle, onSelectSite }) => {
    const trails = useMemo(() => BIENNALE_TRAILS.map(resolveBiennaleTrail), []);
    const [openId, setOpenId] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [message, setMessage] = useState('');
    const [downloadingId, setDownloadingId] = useState<string | null>(null);
    const [saved, setSaved] = useState<OfflineTrail[]>([]);
    const [viewing, setViewing] = useState<OfflineTrail | null>(null);

    const refreshSaved = useCallback(async () => {
        setSaved(userId ? await listOfflineTrails(userId) : []);
    }, [userId]);

    useEffect(() => {
        void refreshSaved();
    }, [refreshSaved]);

    // Saves the trail's PDF to the phone or browser downloads, and keeps a copy in the app for offline viewing.
    const downloadTrail = async (trail: ResolvedBiennaleTrail) => {
        if (!userId) return;
        setDownloadingId(trail.id);
        setMessage('');
        try {
            const exported = await onExportMap(trail.title);
            let keptOffline = true;
            try {
                await saveOfflineTrail(userId, trail.id, trail.title, exported.image);
            } catch {
                keptOffline = false;
            }
            await saveBlob(exported.pdf, exported.pdfName);
            await refreshSaved();
            setMessage(keptOffline
                ? 'Saved. You can open it any time under Downloaded trails, even offline.'
                : 'PDF saved, but this device could not keep an offline copy.');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Could not download the map. Please try again.');
        } finally {
            setDownloadingId(null);
        }
    };

    const removeSaved = async (item: OfflineTrail) => {
        try {
            await deleteOfflineTrail(item.userId, item.trailId);
        } finally {
            setViewing(null);
            await refreshSaved();
        }
    };

    const addAll = (trail: ResolvedBiennaleTrail) => {
        const missing = trail.sites.map((item) => item.site.id).filter((id) => !plan.includes(id));
        if (!missing.length) {
            setMessage('Every stop of this trail is already in your plan.');
            return;
        }
        onPlanChange([...plan, ...missing]);
        setMessage(`Added ${missing.length} stop${missing.length === 1 ? '' : 's'} to your plan.`);
    };

    // Opening a trail draws its route straight away; closing it takes it off the map again.
    const toggleTrail = async (trail: ResolvedBiennaleTrail) => {
        if (openId === trail.id) {
            setOpenId(null);
            onClearRoute();
            return;
        }
        setOpenId(trail.id);
        setBusyId(trail.id);
        setMessage('');
        try {
            await onShowRoute(trail.sites.map((item) => item.site), trail.title);
        } catch {
            setMessage('Route service is unavailable right now. Please try again in a moment.');
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="puja-trails" aria-label="Biennale venue trails">
            <header className="puja-trails__head">
                <strong>Trail guides</strong>
                <span className="puja-trails__free">Free</span>
            </header>
            <p className="puja-trails__intro">Ready-made routes through each Biennale's venues. Open one to see its route and stops on the map, then press Play to watch it from start to end.</p>

            <ul className="puja-trails__list">
                {trails.map((trail) => {
                    const open = openId === trail.id;
                    const inPlan = trail.sites.every((item) => plan.includes(item.site.id));
                    const event = getBiennaleEvent(trail.eventKey);
                    return (
                        <li key={trail.id} className={`puja-trail${open ? ' is-open' : ''}`} style={{ '--zone': '#a855f7' } as React.CSSProperties}>
                            <button
                                type="button"
                                className="puja-trail__head"
                                onClick={() => void toggleTrail(trail)}
                                aria-expanded={open}
                            >
                                <span className="puja-trail__badge" aria-hidden="true"><Palette size={20} color="currentColor" /></span>
                                <span className="puja-trail__titles">
                                    <strong>{trail.title}</strong>
                                    <small>{trail.tagline}</small>
                                    <span className="puja-trail__meta">
                                        <span><MapPinned size={12} aria-hidden="true" />{trail.sites.length} stops</span>
                                        <span><Route size={12} aria-hidden="true" />{trail.distanceKm.toFixed(1)} km</span>
                                        <span><Clock size={12} aria-hidden="true" />{formatTrailDuration(trail.minutes)}</span>
                                    </span>
                                </span>
                                <ChevronDown size={18} className="puja-trail__chevron" aria-hidden="true" />
                            </button>

                            {open ? (
                                <div className="puja-trail__body">
                                    <div className="puja-trail__actions">
                                        <button type="button" className="puja-trail__btn is-primary" onClick={onPlayToggle} disabled={busyId !== null}>
                                            {busyId === trail.id
                                                ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                                : playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                                            <span>{busyId === trail.id ? 'Drawing route' : playing ? 'Stop' : 'Play route'}</span>
                                        </button>
                                        <button type="button" className="puja-trail__btn" onClick={() => addAll(trail)}>
                                            {inPlan ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                                            <span>{inPlan ? 'In my plan' : 'Add all to my plan'}</span>
                                        </button>
                                        {userId ? (
                                            <button
                                                type="button"
                                                className="puja-trail__btn is-wide"
                                                onClick={() => void downloadTrail(trail)}
                                                disabled={busyId !== null || playing || downloadingId !== null}
                                            >
                                                {downloadingId === trail.id
                                                    ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                                                    : <Download size={16} aria-hidden="true" />}
                                                <span>{downloadingId === trail.id ? 'Preparing map' : 'Download map for offline'}</span>
                                            </button>
                                        ) : (
                                            <Link to={buildLoginPath()} className="puja-trail__btn is-wide">
                                                <Download size={16} aria-hidden="true" />
                                                <span>Sign in to download this map</span>
                                            </Link>
                                        )}
                                    </div>

                                    <p>{trail.overview}</p>

                                    <dl className="puja-trail__facts">
                                        <div>
                                            <dt><CalendarCheck size={13} aria-hidden="true" />Best time</dt>
                                            <dd>{trail.bestTime}</dd>
                                        </div>
                                        <div>
                                            <dt><Car size={13} aria-hidden="true" />Getting there</dt>
                                            <dd>{trail.gettingThere}</dd>
                                        </div>
                                    </dl>

                                    <h3><Ticket size={14} aria-hidden="true" />Stop by stop</h3>
                                    <ol className="puja-trail__stops">
                                        {trail.sites.map(({ site, tip }, index) => (
                                            <li key={site.id}>
                                                <b>{index + 1}</b>
                                                <button type="button" onClick={() => onSelectSite(site.id)}>
                                                    <strong>{site.name}</strong>
                                                    <small>{event.shortName}</small>
                                                    <span>{site.highlight}</span>
                                                    <em>{tip}</em>
                                                </button>
                                            </li>
                                        ))}
                                    </ol>

                                    <p className="puja-trail__note">Distance and time are estimates for driving between stops, with time to look around each venue. Some stops are many hours apart by road.</p>
                                </div>
                            ) : null}
                        </li>
                    );
                })}
            </ul>

            {message ? <p className="puja-trails__message" role="status">{message}</p> : null}

            {saved.length ? (
                <div className="puja-trails__saved">
                    <h3><Download size={14} aria-hidden="true" />Downloaded trails</h3>
                    <ul>
                        {saved.map((item) => (
                            <li key={item.key}>
                                <button type="button" onClick={() => setViewing(item)}>
                                    <span>
                                        <strong>{item.title}</strong>
                                        <small>Saved {new Date(item.savedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · works offline</small>
                                    </span>
                                    <ChevronRight size={16} aria-hidden="true" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}

            {viewing ? <OfflineTrailViewer item={viewing} onDelete={(item) => void removeSaved(item)} onClose={() => setViewing(null)} /> : null}
        </section>
    );
};

export default BiennaleTrails;
