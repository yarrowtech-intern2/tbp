import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, Navigation, Palette, Plus, X } from 'lucide-react';

export interface BiennalePinPopupProps {
    title: string;
    /** Event name or short descriptor under the title. */
    subtitle: string;
    /** Small coloured tag, e.g. the Biennale's short name. */
    tag?: { label: string; color: string };
    directionsHref: string;
    plan: { inPlan: boolean; onToggle: () => void };
    onClose: () => void;
}

const PETALS = Array.from({ length: 12 }, (_, i) => i * 30);
const RAYS = Array.from({ length: 36 }, (_, i) => i * 10);

const MAIN_COLOR = '#c084fc';
const SOFT_COLOR = '#4c1d95';

/**
 * Circular popup that opens in the middle of the map when a Biennale venue pin is tapped. Reuses the same ring,
 * petal and glow animation as the Puja guide's pin popup (see puja-pin-popup.css), just with a violet palette
 * and a Palette glyph instead of the Puja image.
 */
export const BiennalePinPopup: React.FC<BiennalePinPopupProps> = ({ title, subtitle, tag, directionsHref, plan, onClose }) => {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose]);

    return createPortal(
        <div
            className="puja-pin-backdrop"
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <div
                className="puja-pin is-biennale"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                style={{ '--pp-main': MAIN_COLOR, '--pp-soft': SOFT_COLOR } as React.CSSProperties}
            >
                <div className="puja-pin__disc">
                    <svg className="puja-pin__art" viewBox="-110 -110 220 220" aria-hidden="true">
                        <defs>
                            <radialGradient id="bpin-glow" cx="50%" cy="50%" r="50%">
                                <stop offset="0%" stopColor={MAIN_COLOR} stopOpacity="0.5" />
                                <stop offset="100%" stopColor={MAIN_COLOR} stopOpacity="0" />
                            </radialGradient>
                        </defs>
                        <circle r="108" fill="url(#bpin-glow)" className="puja-pin__halo" />
                        <g className="puja-pin__spin-slow">
                            <circle r="104" fill="none" stroke={MAIN_COLOR} strokeWidth="1.4" strokeDasharray="2 6" />
                            {RAYS.map((angle) => (
                                <rect
                                    key={angle}
                                    x="-0.8"
                                    y="-104"
                                    width="1.6"
                                    height={angle % 30 === 0 ? 9 : 5}
                                    fill={MAIN_COLOR}
                                    opacity="0.8"
                                    transform={`rotate(${angle})`}
                                />
                            ))}
                        </g>
                        <g className="puja-pin__spin-fast">
                            {PETALS.map((angle) => (
                                <path
                                    key={angle}
                                    d="M0 -92 C 13 -78 13 -58 0 -46 C -13 -58 -13 -78 0 -92 Z"
                                    fill="none"
                                    stroke={MAIN_COLOR}
                                    strokeWidth="1.2"
                                    opacity="0.75"
                                    transform={`rotate(${angle})`}
                                />
                            ))}
                        </g>
                    </svg>

                    <button type="button" className="puja-pin__close" onClick={onClose} aria-label="Close details">
                        <X size={16} aria-hidden="true" />
                    </button>

                    <div className="puja-pin__body">
                        <span className="puja-pin__icon"><Palette size={26} aria-hidden="true" /></span>
                        <h2>{title}</h2>
                        <p>{subtitle}</p>
                        {tag ? (
                            <span className="puja-pin__tag">
                                <i style={{ background: tag.color }} aria-hidden="true" />
                                {tag.label}
                            </span>
                        ) : null}
                    </div>
                </div>

                <div className="puja-pin__actions">
                    <a
                        className="puja-pin__btn puja-pin__btn--dark"
                        href={directionsHref}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <Navigation size={16} aria-hidden="true" />
                        <span>Directions</span>
                    </a>
                    <button
                        type="button"
                        className={`puja-pin__btn puja-pin__btn--accent${plan.inPlan ? ' is-in' : ''}`}
                        onClick={plan.onToggle}
                    >
                        {plan.inPlan ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                        <span>{plan.inPlan ? 'In plan' : 'Add to plan'}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default BiennalePinPopup;
