import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import './liquid-mobile-nav.css';

export type LiquidNavItem = {
  id: string;
  label: string;
  isActive: boolean;
  onClick: () => void;
  iconSrc?: string;
  icon?: React.ElementType;
  badge?: number;
  dataTutorialId?: string;
};

type LiquidMobileNavProps = {
  items: LiquidNavItem[];
  ariaLabel: string;
  className?: string;
};

/** How long the filtered goo layer stays visible after the active item changes. */
const MORPH_MS = 560;

function NavIcon({ item, size }: { item: LiquidNavItem; size: number }) {
  const Icon = item.icon as React.ComponentType<{ size?: number }> | undefined;
  return (
    <span className="lmn-icon" style={{ width: size, height: size }}>
      {item.iconSrc ? (
        <img src={item.iconSrc} alt="" width={size} height={size} loading="eager" decoding="async" />
      ) : Icon ? (
        <Icon size={Math.round(size * 0.9)} />
      ) : null}
    </span>
  );
}

function NavBadge({ badge }: { badge?: number }) {
  if (typeof badge !== 'number' || badge <= 0) return null;
  return <span className="lmn-badge">{badge > 99 ? '99+' : badge}</span>;
}

export function LiquidMobileNav({ items, ariaLabel, className }: LiquidMobileNavProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const filterId = `lmn-goo-${rawId}`;
  const prefersReducedMotion = useReducedMotion();

  const activeItem = items.find((item) => item.isActive) ?? items[0];
  const activeId = activeItem?.id;

  const [isMorphing, setIsMorphing] = useState(false);
  const [morphCycle, setMorphCycle] = useState(0);
  const prevActiveId = useRef(activeId);

  // React-endorsed "adjust state when a prop changes" pattern: compare during
  // render (not in an effect) so the morph starts on the same commit as the
  // active-tab change, with no extra round-trip.
  if (prevActiveId.current !== activeId) {
    prevActiveId.current = activeId;
    if (!prefersReducedMotion) {
      setIsMorphing(true);
      setMorphCycle((cycle) => cycle + 1);
    }
  }

  useEffect(() => {
    if (!isMorphing) return;
    const timeoutId = window.setTimeout(() => setIsMorphing(false), MORPH_MS);
    return () => window.clearTimeout(timeoutId);
  }, [isMorphing, morphCycle]);

  const inactiveItems = useMemo(() => {
    if (!activeId) return items;
    return items.filter((item) => item.id !== activeId);
  }, [activeId, items]);

  return (
    <nav className={className ? `lmn ${className}` : 'lmn'} aria-label={ariaLabel}>
      <svg className="lmn-defs" aria-hidden="true" focusable="false">
        <filter id={filterId} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      {/* Rest layer: crisp, no filter — the "one wide pill" default look. */}
      <div className={`lmn-rest-layer${isMorphing ? ' is-hidden' : ''}`}>
        {activeItem && (
          <button
            type="button"
            key={`rest-active-${activeItem.id}`}
            className="lmn-rest-active"
            onClick={activeItem.onClick}
            aria-label={activeItem.label}
            aria-current="page"
            data-tutorial-id={activeItem.dataTutorialId}
          >
            <NavIcon item={activeItem} size={28} />
            <NavBadge badge={activeItem.badge} />
          </button>
        )}
        <div className="lmn-rest-pill" key={`rest-pill-${activeId}`}>
          {inactiveItems.map((item) => (
            <button
              type="button"
              key={item.id}
              className="lmn-rest-btn"
              onClick={item.onClick}
              aria-label={item.label}
              data-tutorial-id={item.dataTutorialId}
            >
              <NavIcon item={item} size={26} />
              <NavBadge badge={item.badge} />
            </button>
          ))}
        </div>
      </div>

      {/* Goo layer: only the detached active circle and one inactive pill are filtered. */}
      <div className={`lmn-goo-wrap${isMorphing ? '' : ' is-hidden'}`}>
        <div className="lmn-blob-layer" style={{ filter: `url(#${filterId})` }}>
          {activeItem && <span key={`goo-active-shape-${morphCycle}-${activeId}`} className="lmn-blob-active" />}
          <span key={`goo-pill-shape-${morphCycle}-${activeId}`} className="lmn-blob-pill">
            {inactiveItems.map((item) => (
              <span key={`goo-slot-${item.id}`} className="lmn-blob-slot" />
            ))}
          </span>
        </div>
        <div className="lmn-icon-layer">
          {activeItem && (
            <button
              type="button"
              key={`goo-active-btn-${morphCycle}-${activeId}`}
              className="lmn-btn is-active"
              onClick={activeItem.onClick}
              aria-label={activeItem.label}
              aria-current="page"
              data-tutorial-id={activeItem.dataTutorialId}
            >
              <NavIcon item={activeItem} size={28} />
              <NavBadge badge={activeItem.badge} />
            </button>
          )}
          <div className="lmn-pill-icons">
            {inactiveItems.map((item) => (
              <button
                type="button"
                key={`goo-btn-${item.id}`}
                className="lmn-btn"
                onClick={item.onClick}
                aria-label={item.label}
                data-tutorial-id={item.dataTutorialId}
              >
                <NavIcon item={item} size={26} />
                <NavBadge badge={item.badge} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
