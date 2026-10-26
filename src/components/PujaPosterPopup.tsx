import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { buildLoginPath } from '../lib/authRedirect';
import { PUJA_ENABLED } from '../lib/pujaFeature';
import { isVisitorInKolkata, setPujaPosterOpen } from '../lib/pujaPosterGate';
import { PUJA_GUIDE_MAP_PATH } from './map/PujaGuideLauncher';
import './puja-poster-popup.css';

const SHOW_DELAY_MS = 1400;
const SEEN_KEY = 'tbp-puja-poster-seen';

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

const PETAL_COUNT = 14;
const RAYS = Array.from({ length: 24 }, (_, i) => i * 15);
const PETALS = Array.from({ length: 12 }, (_, i) => i * 30);

/** Layered, slowly turning mandala behind the headline. */
const MandalaArt: React.FC = () => (
    <svg className="puja-poster__mandala" viewBox="-200 -200 400 400" aria-hidden="true">
        <defs>
            <radialGradient id="pp-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffd56b" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#ffd56b" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="pp-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffe9a8" />
                <stop offset="100%" stopColor="#e0a526" />
            </linearGradient>
        </defs>
        <circle r="190" fill="url(#pp-glow)" className="puja-poster__halo" />
        <g className="puja-poster__spin-slow">
            <circle r="186" fill="none" stroke="url(#pp-gold)" strokeWidth="1.2" strokeDasharray="2 7" />
            {RAYS.map((angle) => (
                <path
                    key={angle}
                    d="M0 -186 L5 -160 L0 -150 L-5 -160 Z"
                    fill="url(#pp-gold)"
                    opacity="0.85"
                    transform={`rotate(${angle})`}
                />
            ))}
        </g>
        <g className="puja-poster__spin-fast">
            {PETALS.map((angle) => (
                <path
                    key={angle}
                    d="M0 -142 C 22 -118 22 -86 0 -64 C -22 -86 -22 -118 0 -142 Z"
                    fill="none"
                    stroke="url(#pp-gold)"
                    strokeWidth="1.6"
                    transform={`rotate(${angle})`}
                />
            ))}
            <circle r="52" fill="none" stroke="url(#pp-gold)" strokeWidth="1.4" />
            <circle r="38" fill="none" stroke="url(#pp-gold)" strokeWidth="0.8" strokeDasharray="1 5" />
        </g>
    </svg>
);

/** A diya (oil lamp) with a flickering flame. */
const Diya: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={`puja-poster__diya ${className ?? ''}`} viewBox="0 0 64 56" aria-hidden="true">
        <defs>
            <linearGradient id="pp-clay" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f2a33a" />
                <stop offset="100%" stopColor="#a8541a" />
            </linearGradient>
        </defs>
        <path className="puja-poster__flame-outer" d="M32 2 C 42 14 42 24 32 32 C 22 24 22 14 32 2 Z" fill="#ffb21f" />
        <path className="puja-poster__flame-inner" d="M32 12 C 37 19 37 25 32 30 C 27 25 27 19 32 12 Z" fill="#fff3b0" />
        <path d="M4 34 C 4 48 18 54 32 54 C 46 54 60 48 60 34 Z" fill="url(#pp-clay)" />
        <path d="M4 34 Q 32 28 60 34" fill="none" stroke="#ffd68a" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

export const PujaPosterPopup: React.FC = () => {
    const { user, loading } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [visible, setVisible] = useState(false);
    const [closing, setClosing] = useState(false);

    const onHome = location.pathname === '/';
    const eligible = useMemo(() => PUJA_ENABLED && onHome && !loading, [loading, onHome]);

    // Check the visitor's city once per session, then show the poster shortly after.
    useEffect(() => {
        if (!eligible || readSeen()) return undefined;

        let cancelled = false;
        let showTimer: number | undefined;

        void isVisitorInKolkata().then((inKolkata) => {
            if (cancelled || !inKolkata) return;
            showTimer = window.setTimeout(() => {
                if (cancelled) return;
                markSeen();
                setClosing(false);
                setVisible(true);
            }, SHOW_DELAY_MS);
        });

        return () => {
            cancelled = true;
            if (showTimer) window.clearTimeout(showTimer);
        };
    }, [eligible]);

    // Leaving the home page drops the poster.
    useEffect(() => {
        if (!onHome) setVisible(false);
    }, [onHome]);

    useEffect(() => {
        setPujaPosterOpen(visible);
        return () => setPujaPosterOpen(false);
    }, [visible]);

    const close = useCallback(() => {
        setClosing(true);
        window.setTimeout(() => {
            setVisible(false);
            setClosing(false);
        }, 260);
    }, []);

    const openGuide = useCallback(() => {
        setVisible(false);
        navigate(user ? PUJA_GUIDE_MAP_PATH : buildLoginPath(PUJA_GUIDE_MAP_PATH));
    }, [navigate, user]);

    useEffect(() => {
        if (!visible) return undefined;
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
    }, [close, visible]);

    if (!visible) return null;

    return (
        <div
            className={`puja-poster-backdrop${closing ? ' is-closing' : ''}`}
            onClick={(event) => {
                if (event.target === event.currentTarget) close();
            }}
        >
            <section
                className="puja-poster"
                role="dialog"
                aria-modal="true"
                aria-labelledby="puja-poster-title"
            >
                <button type="button" className="puja-poster__close" onClick={close} aria-label="Close Puja guide poster">
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                    </svg>
                </button>

                <div className="puja-poster__art" aria-hidden="true">
                    <MandalaArt />
                    {Array.from({ length: PETAL_COUNT }, (_, i) => (
                        <span key={i} className="puja-poster__petal" style={{ '--i': i } as React.CSSProperties} />
                    ))}
                </div>

                <div className="puja-poster__content">
                    <span className="puja-poster__eyebrow">Kolkata exclusive</span>
                    <h2 id="puja-poster-title">
                        <span className="puja-poster__title-line">Durga Puja</span>
                        <span className="puja-poster__title-line puja-poster__title-line--accent">Pandal Guide</span>
                    </h2>
                    <p>
                        Plan your pandal hopping with crowd-smart routes, the best pandals, food stops, transit
                        and hospitals, all on one map.
                    </p>
                    <button type="button" className="puja-poster__cta" onClick={openGuide}>
                        <span>Open the Puja guide</span>
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </button>
                </div>

                <Diya className="puja-poster__diya--left" />
                <Diya className="puja-poster__diya--right" />
            </section>
        </div>
    );
};

export default PujaPosterPopup;
