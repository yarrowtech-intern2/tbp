import React from 'react';
import { Link } from 'react-router-dom';
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

export function FloatingDock({ items, className, ariaLabel = 'Floating navigation' }: FloatingDockProps) {
  return (
    <nav className={className ? `floating-dock ${className}` : 'floating-dock'} aria-label={ariaLabel}>
      {items.map((item) => {
        const content = (
          <>
            <span className="floating-dock-tooltip">{item.title}</span>
            <span className="floating-dock-icon" aria-hidden="true">
              {item.icon}
            </span>
          </>
        );
        const itemClassName = `floating-dock-item${item.isPrimary ? ' is-primary' : ''}`;

        if (item.to) {
          return (
            <Link key={item.title} to={item.to} className={itemClassName} aria-label={item.title}>
              {content}
            </Link>
          );
        }

        if (item.href) {
          return (
            <a key={item.title} href={item.href} className={itemClassName} aria-label={item.title}>
              {content}
            </a>
          );
        }

        return (
          <button key={item.title} type="button" className={itemClassName} aria-label={item.title} onClick={item.onClick}>
            {content}
          </button>
        );
      })}
    </nav>
  );
}
