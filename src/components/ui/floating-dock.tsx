import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from 'framer-motion';
import './floating-dock.css';

export type FloatingDockItem = {
  title: string;
  icon: React.ReactNode;
  href?: string;
  to?: string;
  onClick?: () => void;
  isPrimary?: boolean;
};

type FloatingDockProps = {
  items: FloatingDockItem[];
  className?: string;
  ariaLabel?: string;
};

const BASE_SIZE = 38;
const MAX_SIZE = 58;
const BASE_ICON = 19;
const MAX_ICON = 27;
const MAGNIFY_RANGE = 90;
const SPRING = { mass: 0.1, stiffness: 160, damping: 14 };

export function FloatingDock({ items, className, ariaLabel = 'Floating navigation' }: FloatingDockProps) {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.nav
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={className ? `floating-dock ${className}` : 'floating-dock'}
      aria-label={ariaLabel}
    >
      <span className="floating-dock-rim" aria-hidden="true" />
      {items.map((item) => (
        <DockItem key={item.title} item={item} mouseX={mouseX} />
      ))}
    </motion.nav>
  );
}

function DockItem({ item, mouseX }: { item: FloatingDockItem; mouseX: MotionValue<number> }) {
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

  const itemClassName = `floating-dock-item${item.isPrimary ? ' is-primary' : ''}`;

  const content = (
    <motion.div ref={ref} style={{ width: size, height: size }} className={itemClassName}>
      <span className="floating-dock-tooltip">{item.title}</span>
      <motion.span style={{ width: iconSize, height: iconSize }} className="floating-dock-icon" aria-hidden="true">
        {item.icon}
      </motion.span>
    </motion.div>
  );

  if (item.to) {
    return (
      <Link to={item.to} aria-label={item.title} className="floating-dock-link">
        {content}
      </Link>
    );
  }

  if (item.href) {
    return (
      <a href={item.href} aria-label={item.title} className="floating-dock-link">
        {content}
      </a>
    );
  }

  return (
    <button type="button" aria-label={item.title} className="floating-dock-link" onClick={item.onClick}>
      {content}
    </button>
  );
}
