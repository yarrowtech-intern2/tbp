import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { buildLoginPath } from '../../lib/authRedirect';
import { PUJA_ENABLED } from '../../lib/pujaFeature';
import './puja-guide-launcher.css';

/** /map query flag that opens the Durga Puja guide on arrival. */
export const PUJA_GUIDE_MAP_PATH = '/map?puja=1';

/**
 * Puja guide button for the home page header (beside Join on desktop, under the search button in the home hero on mobile). Mirrors the pulsing button and "Puja guide" arrow hint on /map.
 * The guide needs an account, so signed-out visitors go to login first and come back to /map with the guide open.
 */
export const PujaGuideLauncher: React.FC<{ variant?: 'desktop' | 'hero' }> = ({ variant = 'desktop' }) => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [hintOn, setHintOn] = useState(false);

    // The hint appears a second after the page opens, then fades away (same timing as /map).
    useEffect(() => {
        const showTimer = window.setTimeout(() => setHintOn(true), 1000);
        const hideTimer = window.setTimeout(() => setHintOn(false), 6500);
        return () => {
            window.clearTimeout(showTimer);
            window.clearTimeout(hideTimer);
        };
    }, []);

    const open = () => {
        navigate(user ? PUJA_GUIDE_MAP_PATH : buildLoginPath(PUJA_GUIDE_MAP_PATH));
    };

    if (!PUJA_ENABLED) return null;

    return (
        <div className={`puja-launcher puja-launcher--${variant}`}>
            <button
                type="button"
                className="puja-launcher-btn"
                onClick={open}
                aria-label="Open Durga Puja guide"
                title="Durga Puja guide"
            >
                <img src="/icons/puja.png" alt="" draggable={false} />
            </button>
            <span className={`puja-launcher-hint${hintOn ? ' is-visible' : ''}`} aria-hidden="true">
                <span className="puja-launcher-hint-text">Puja guide</span>
                <svg className="puja-launcher-hint-arrow" viewBox="0 0 56 36" width="56" height="36" fill="none">
                    <path d="M2 22 C 12 4, 30 4, 50 18" pathLength="1" />
                    <path d="M45.9 10 L50 18 L41.1 16.9" pathLength="1" className="puja-launcher-hint-head" />
                </svg>
            </span>
        </div>
    );
};

export default PujaGuideLauncher;
