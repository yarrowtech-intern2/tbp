import React, { useEffect, useMemo } from 'react';
import { divIcon, latLng, latLngBounds, marker, point, polyline } from 'leaflet';
import { Marker, useMap } from 'react-leaflet';
import './puja-trail-playback.css';

interface BiennaleTrailPlaybackProps {
    /** The drawn route, start to end. */
    points: Array<[number, number]>;
    playing: boolean;
    onFinish: () => void;
}

const buildEndpointIcon = (kind: 'start' | 'end') => divIcon({
    className: '',
    iconSize: point(46, 46),
    iconAnchor: point(23, 23),
    html: `<span class="trail-pin is-${kind}"><i class="trail-pin__ring"></i><i class="trail-pin__ring is-late"></i><b>${kind === 'start' ? 'S' : 'E'}</b><em>${kind === 'start' ? 'Start' : 'End'}</em></span>`,
});

const runnerIcon = divIcon({
    className: '',
    iconSize: point(30, 30),
    iconAnchor: point(15, 15),
    html: '<span class="trail-runner is-biennale"></span>',
});

/** Start and end markers with a pulse, plus a runner that travels the route from start to end while `playing`. */
export const BiennaleTrailPlayback: React.FC<BiennaleTrailPlaybackProps> = ({ points, playing, onFinish }) => {
    const map = useMap();
    const startIcon = useMemo(() => buildEndpointIcon('start'), []);
    const endIcon = useMemo(() => buildEndpointIcon('end'), []);

    useEffect(() => {
        if (!playing || points.length < 2) return undefined;

        const latlngs = points.map(([lat, lng]) => latLng(lat, lng));
        const cumulative: number[] = [0];
        for (let i = 1; i < latlngs.length; i += 1) {
            cumulative.push(cumulative[i - 1] + latlngs[i - 1].distanceTo(latlngs[i]));
        }
        const total = cumulative[cumulative.length - 1] || 1;
        // Long routes take longer, but never fewer than 8 or more than 28 seconds.
        const duration = Math.min(28000, Math.max(8000, (total / 1000) * 2600));

        const runner = marker(latlngs[0], { icon: runnerIcon, interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(map);
        const progress = polyline([latlngs[0]], { color: '#4c1d95', weight: 5, opacity: 0.85, lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(map);

        let frame = 0;
        let cancelled = false;
        let startTime = 0;
        let cursor = 0;

        map.setView(latlngs[0], Math.max(map.getZoom(), 15), { animate: true, duration: 0.6 });

        const step = (now: number) => {
            if (cancelled) return;
            if (!startTime) startTime = now;
            const fraction = Math.min(1, (now - startTime) / duration);
            const target = fraction * total;

            while (cursor < cumulative.length - 2 && cumulative[cursor + 1] < target) cursor += 1;
            const segmentLength = cumulative[cursor + 1] - cumulative[cursor] || 1;
            const local = Math.min(1, Math.max(0, (target - cumulative[cursor]) / segmentLength));
            const a = latlngs[cursor];
            const b = latlngs[cursor + 1];
            const position = latLng(a.lat + (b.lat - a.lat) * local, a.lng + (b.lng - a.lng) * local);

            runner.setLatLng(position);
            progress.setLatLngs([...latlngs.slice(0, cursor + 1), position]);
            map.panTo(position, { animate: false });

            if (fraction < 1) {
                frame = window.requestAnimationFrame(step);
            } else {
                window.setTimeout(() => {
                    if (!cancelled) map.fitBounds(latLngBounds(latlngs), { paddingTopLeft: [40, 120], paddingBottomRight: [40, 220] });
                }, 700);
                onFinish();
            }
        };

        // Let the map settle on the start point first.
        const startTimer = window.setTimeout(() => {
            frame = window.requestAnimationFrame(step);
        }, 700);

        return () => {
            cancelled = true;
            window.clearTimeout(startTimer);
            window.cancelAnimationFrame(frame);
            runner.remove();
            progress.remove();
        };
    }, [map, onFinish, playing, points]);

    if (points.length < 2) return null;
    const first = points[0];
    const last = points[points.length - 1];

    return (
        <>
            <Marker position={first} icon={startIcon} interactive={false} zIndexOffset={1500} />
            <Marker position={last} icon={endIcon} interactive={false} zIndexOffset={1500} />
        </>
    );
};

export default BiennaleTrailPlayback;
