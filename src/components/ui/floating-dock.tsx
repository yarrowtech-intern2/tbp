import React, { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import './floating-dock.css';

export type FloatingDockItem = {
  title: string;
  icon?: React.ReactNode;
  iconSrc?: string;
  href?: string;
  to?: string;
  onClick?: () => void;
  isPrimary?: boolean;
  isActive?: boolean;
};

type FloatingDockProps = {
  items: FloatingDockItem[];
  className?: string;
  ariaLabel?: string;
};

const BASE_SIZE = 46;
const MAX_SIZE = 62;
const BASE_ICON = 29;
const MAX_ICON = 36;
const MAGNIFY_RANGE = 90;
const SPRING = { mass: 0.1, stiffness: 160, damping: 14 };

export function FloatingDock({ items, className, ariaLabel = 'Floating navigation' }: FloatingDockProps) {
  const mouseX = useMotionValue(Infinity);
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const filterId = `floating-dock-goo-${rawId}`;
  const activeItem = items.find((item) => item.isActive) ?? items[0];
  const activeTitle = activeItem?.title;
  const inactiveItems = activeItem
    ? items.filter((item) => item.title !== activeItem.title)
    : items;

  return (
    <motion.nav
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={className ? `floating-dock is-liquid ${className}` : 'floating-dock is-liquid'}
      aria-label={ariaLabel}
    >
      <svg className="floating-dock-defs" aria-hidden="true" focusable="false">
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

      <div key={`dock-liquid-${activeTitle ?? 'empty'}`} className="floating-dock-goo">
        <div className="floating-dock-blob-layer" style={{ filter: `url(#${filterId})` }}>
          {activeItem && <span className="floating-dock-blob-active" />}
          <span className="floating-dock-blob-pill">
            {inactiveItems.map((item) => (
              <span key={`shape-slot-${item.title}`} className="floating-dock-blob-slot" />
            ))}
          </span>
        </div>
        <div className="floating-dock-icon-layer">
          {activeItem && <DockItem item={activeItem} mouseX={mouseX} variant="active" />}
          <span className="floating-dock-pill-shell floating-dock-pill-shell--icons">
            {inactiveItems.map((item) => (
              <DockItem key={`icon-${item.title}`} item={item} mouseX={mouseX} variant="pill" />
            ))}
          </span>
        </div>
      </div>
    </motion.nav>
  );
}

function DockItem({ item, mouseX, variant }: { item: FloatingDockItem; mouseX: MotionValue<number>; variant: 'active' | 'pill' }) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const size = useSpring(
    useTransform(distance, [-MAGNIFY_RANGE, 0, MAGNIFY_RANGE], [BASE_SIZE, MAX_SIZE, BASE_SIZE]),
    SPRING
  );
  const iconSize = useSpring(
    useTransform(distance, [-MAGNIFY_RANGE, 0, MAGNIFY_RANGE], [BASE_ICON, MAX_ICON, BASE_ICON]),
    SPRING
  );

  const itemClassName = `floating-dock-item floating-dock-item--${variant}${item.isPrimary ? ' is-primary' : ''}`;
  const linkClassName = `floating-dock-link floating-dock-link--${variant}`;

  const content = (
    <motion.div ref={ref} style={{ width: size, height: size }} className={itemClassName}>
      <span className="floating-dock-tooltip">{item.title}</span>
      <motion.span style={{ width: iconSize, height: iconSize }} className="floating-dock-icon" aria-hidden="true">
        {item.iconSrc ? <img src={item.iconSrc} alt="" draggable={false} /> : item.icon}
      </motion.span>
    </motion.div>
  );

  if (item.to) {
    return (
      <Link to={item.to} aria-label={item.title} className={linkClassName}>
        {content}
      </Link>
    );
  }

  if (item.href) {
    return (
      <a href={item.href} aria-label={item.title} className={linkClassName}>
        {content}
      </a>
    );
  }

  return (
    <button type="button" aria-label={item.title} className={linkClassName} onClick={item.onClick}>
      {content}
    </button>
  );
}
