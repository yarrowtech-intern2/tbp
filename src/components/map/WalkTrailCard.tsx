import React, { useEffect, useState } from 'react';
import { Footprints, Pause, Play, Trash2 } from 'lucide-react';
import { averageSpeedKmh, formatTrailDistance, formatTrailDuration } from '../../lib/walkTrail';

interface WalkTrailCardProps {
    tracking: boolean;
    distance: number;
    duration: number;
    pointCount: number;
    accuracy: number | null;
    keepAwake: boolean;
    error: string;
    onStart: () => void;
    onStop: () => void;
    onClear: () => void;
}

/** Live stats for the walk trail: distance, time and speed, with pause/resume and clear. */
export const WalkTrailCard: React.FC<WalkTrailCardProps> = ({
    tracking,
    distance,
    duration,
    pointCount,
    accuracy,
    keepAwake,
    error,
    onStart,
    onStop,
    onClear,
}) => {
    // Clearing a walk cannot be undone, so the first tap only asks for confirmation.
    const [confirmClear, setConfirmClear] = useState(false);
    useEffect(() => {
        if (!confirmClear) return undefined;
        const timer = window.setTimeout(() => setConfirmClear(false), 3500);
        return () => window.clearTimeout(timer);
    }, [confirmClear]);

    const status = tracking
        ? (accuracy !== null ? `Tracking · GPS ±${Math.round(accuracy)} m` : 'Tracking · finding GPS...')
        : pointCount ? 'Paused' : 'Not tracking';

    return (
        <section className={`map2-trail-card${tracking ? ' is-live' : ''}`} aria-label="Walk trail" aria-live="polite">
            <header>
                <span className="map2-trail-icon" aria-hidden="true"><Footprints size={16} /></span>
                <div>
                    <strong>My walk</strong>
                    <small>{status}</small>
                </div>
            </header>

            <dl className="map2-trail-stats">
                <div><dt>Distance</dt><dd>{formatTrailDistance(distance)}</dd></div>
                <div><dt>Time</dt><dd>{formatTrailDuration(duration)}</dd></div>
                <div><dt>Avg speed</dt><dd>{duration > 5000 ? `${averageSpeedKmh(distance, duration).toFixed(1)} km/h` : '--'}</dd></div>
            </dl>

            {error ? <p className="map2-trail-note is-error">{error}</p> : null}
            {tracking && !error ? (
                <p className="map2-trail-note">
                    {keepAwake ? 'Screen stays on while tracking.' : 'Keep this page open and the screen on to keep tracking.'}
                </p>
            ) : null}

            <div className="map2-trail-actions">
                {tracking ? (
                    <button type="button" className="is-primary" onClick={onStop}>
                        <Pause size={15} aria-hidden="true" />
                        <span>Pause</span>
                    </button>
                ) : (
                    <button type="button" className="is-primary" onClick={onStart}>
                        <Play size={15} aria-hidden="true" />
                        <span>{pointCount ? 'Resume' : 'Start'}</span>
                    </button>
                )}
                {pointCount || confirmClear ? (
                    <button
                        type="button"
                        className={confirmClear ? 'is-danger' : ''}
                        onClick={() => {
                            if (confirmClear) {
                                setConfirmClear(false);
                                onClear();
                            } else {
                                setConfirmClear(true);
                            }
                        }}
                    >
                        <Trash2 size={15} aria-hidden="true" />
                        <span>{confirmClear ? 'Tap again to clear' : 'Clear'}</span>
                    </button>
                ) : null}
            </div>
        </section>
    );
};
