import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isDiwaliPosterActive } from '../lib/diwaliFeature';
import { setDiwaliPosterOpen } from '../lib/pujaPosterGate';
import './diwali-poster-popup.css';

const SHOW_DELAY_MS = 1400;
const SEEN_KEY = 'tbp-diwali-poster-seen';
/** Where "Book Diwali trip" goes: the Explore page, which guests can open. */
const DIWALI_TRIP_PATH = '/explore';

const readSeen = (): boolean => {
    try {
        return window.sessionStorage.getItem(SEEN_KEY) === '1';
    } catch {
        return false;
    }
};

const markSeen = () => {
    try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
        // best effort
    }
};

const RAYS = Array.from({ length: 24 }, (_, i) => i * 15);
const PETALS = Array.from({ length: 8 }, (_, i) => i * 45);
const SMALL_PETALS = Array.from({ length: 16 }, (_, i) => i * 22.5);
const DOTS = Array.from({ length: 24 }, (_, i) => i * 15);
const SPARK_COUNT = 14;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => (360 / SPARK_COUNT) * i);

/** Each burst: position on the poster, reach in px, colour and start delay. */
const BURSTS = [
    { left: '16%', top: '22%', r: 74, c: '#ffd56b', d: '0.5s' },
    { left: '84%', top: '30%', r: 88, c: '#ff8a4c', d: '1.6s' },
    { left: '70%', top: '12%', r: 64, c: '#ffe9a8', d: '2.7s' },
    { left: '28%', top: '70%', r: 70, c: '#ffb21f', d: '2.1s' },
];

/** Layered, slowly turning rangoli behind the headline. */
const RangoliArt: React.FC = () => (
    <svg className="diwali-poster__rangoli" viewBox="-200 -200 400 400" aria-hidden="true">
        <defs>
            <radialGradient id="dw-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffb44a" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ffb44a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="dw-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffe9a8" />
                <stop offset="100%" stopColor="#e0a526" />
            </linearGradient>
        </defs>
        <circle r="190" fill="url(#dw-glow)" className="diwali-poster__halo" />
        <g className="diwali-poster__spin-slow">
            <circle r="186" fill="none" stroke="url(#dw-gold)" strokeWidth="1.2" strokeDasharray="2 7" />
            {RAYS.map((angle) => (
                <path
                    key={angle}
                    d="M0 -186 L5 -160 L0 -150 L-5 -160 Z"
                    fill="url(#dw-gold)"
                    opacity="0.85"
                    transform={`rotate(${angle})`}
                />
            ))}
            {DOTS.map((angle) => (
                <circle key={angle} cx="0" cy="-138" r="2.4" fill="url(#dw-gold)" transform={`rotate(${angle})`} />
            ))}
        </g>
        <g className="diwali-poster__spin-fast">
            {PETALS.map((angle) => (
                <path
                    key={angle}
                    d="M0 -128 C 30 -104 30 -70 0 -44 C -30 -70 -30 -104 0 -128 Z"
                    fill="none"
                    stroke="url(#dw-gold)"
                    strokeWidth="1.6"
                    transform={`rotate(${angle})`}
                />
            ))}
            {SMALL_PETALS.map((angle) => (
                <path
                    key={angle}
                    d="M0 -92 C 8 -82 8 -72 0 -64 C -8 -72 -8 -82 0 -92 Z"
                    fill="url(#dw-gold)"
                    opacity="0.55"
                    transform={`rotate(${angle})`}
                />
            ))}
            <circle r="36" fill="none" stroke="url(#dw-gold)" strokeWidth="1.4" />
            <circle r="24" fill="none" stroke="url(#dw-gold)" strokeWidth="0.8" strokeDasharray="1 5" />
        </g>
    </svg>
);

/** A diya (oil lamp) with a flickering flame. */
const Diya: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={`diwali-poster__diya ${className ?? ''}`} viewBox="0 0 64 56" aria-hidden="true">
        <defs>
            <linearGradient id="dw-clay" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f2a33a" />
                <stop offset="100%" stopColor="#a8541a" />
            </linearGradient>
        </defs>
        <path className="diwali-poster__flame-outer" d="M32 2 C 42 14 42 24 32 32 C 22 24 22 14 32 2 Z" fill="#ffb21f" />
        <path className="diwali-poster__flame-inner" d="M32 12 C 37 19 37 25 32 30 C 27 25 27 19 32 12 Z" fill="#fff3b0" />
        <path d="M4 34 C 4 48 18 54 32 54 C 46 54 60 48 60 34 Z" fill="url(#dw-clay)" />
        <path d="M4 34 Q 32 28 60 34" fill="none" stroke="#ffd68a" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

/**
 * "Happy Diwali" poster on the home page, once per browser session, for every visitor.
 * It stops appearing on its own after DIWALI_POSTER_ENDS_AT (see diwaliFeature.ts).
 */
export const DiwaliPosterPopup: React.FC = () => {
    const { loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    const onHome = location.pathname === '/';
    const eligible = useMemo(() => isDiwaliPosterActive() && onHome && !loading, [loading, onHome]);

    useEffect(() => {
        if (!eligible || readSeen()) return undefined;
        const showTimer = window.setTimeout(() => {
            markSeen();
            setClosing(false);
            setVisible(true);
        }, SHOW_DELAY_MS);
        return () => window.clearTimeout(showTimer);
    }, [eligible]);

    // Leaving the home page drops the poster.
    const shown = visible && onHome;

    useEffect(() => {
        setDiwaliPosterOpen(shown);
        return () => setDiwaliPosterOpen(false);
    }, [shown]);

    const close = useCallback(() => {
        setClosing(true);
        window.setTimeout(() => {
            setVisible(false);
            setClosing(false);
        }, 260);
    }, []);

    const bookTrip = useCallback(() => {
        setVisible(false);
        navigate(DIWALI_TRIP_PATH);
    }, [navigate]);

    useEffect(() => {
        if (!shown) return undefined;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKeyDown);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            document.body.style.overflow = previousOverflow;
        };
    }, [close, shown]);

    if (!shown) return null;

    return (
        <div
            className={`diwali-poster-backdrop${closing ? ' is-closing' : ''}`}
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <section
                className="diwali-poster"
                role="dialog"
                aria-modal="true"
                aria-labelledby="diwali-poster-title"
            >
                <button type="button" className="diwali-poster__close" onClick={close} aria-label="Close Diwali poster">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                </button>

                <div className="diwali-poster__art" aria-hidden="true">
                    <RangoliArt />
                    {BURSTS.map((burst) => (
                        <span
                            key={burst.left + burst.top}
                            className="diwali-poster__burst"
                            style={{ left: burst.left, top: burst.top, '--r': `${burst.r}px`, '--c': burst.c, '--d': burst.d } as React.CSSProperties}
                        >
                            {SPARKS.map((angle) => (
                                <span key={angle} className="diwali-poster__spark" style={{ '--a': `${angle}deg` } as React.CSSProperties} />
                            ))}
                        </span>
                    ))}
                </div>

                <div className="diwali-poster__content">
                    <span className="diwali-poster__eyebrow">Festival of lights</span>
                    <h2 id="diwali-poster-title">
                        <span className="diwali-poster__title-line">Happy</span>
                        <span className="diwali-poster__title-line diwali-poster__title-line--accent">Diwali</span>
                    </h2>
                    <p>
                        Wishing you and your family a bright, joyful Diwali. Light up the festival with a getaway
                        you'll remember.
                    </p>
                    <button type="button" className="diwali-poster__cta" onClick={bookTrip}>
                        <span>Book Diwali trip</span>
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <Diya className="diwali-poster__diya--left" />
                <Diya className="diwali-poster__diya--right" />
            </section>
        </div>
    );
};

export default DiwaliPosterPopup;
