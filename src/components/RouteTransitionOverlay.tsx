import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FC } from 'react';
import { useLocation } from 'react-router-dom';
import './RouteTransitionOverlay.css';

type OriginPoint = {
  timestamp: number;
  x: number;
  y: number;
};

type OverlayState = {
  expanded: boolean;
  fading: boolean;
  visible: boolean;
  x: number;
  y: number;
  size: number;
};

const EXPAND_MS = 760;
const FADE_MS = 320;
const ORIGIN_TTL_MS = 900;

const getViewportCenter = () => ({
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
});

const getOriginFromElement = (element: Element | null) => {
  if (!(element instanceof HTMLElement)) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
};

const isExternalAnchor = (anchor: HTMLAnchorElement) => {
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return true;
  if (anchor.target === '_blank' || anchor.hasAttribute('download')) return true;

  try {
    const url = new URL(anchor.href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return true;
  }
};

const isTransitionCandidate = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return null;

  const anchor = target.closest('a');
  if (anchor instanceof HTMLAnchorElement) {
    if (isExternalAnchor(anchor)) return null;
    return anchor;
  }

  const button = target.closest('button,[role="button"]');
  if (button instanceof HTMLElement) return button;

  return null;
};

const getCoverDiameter = (x: number, y: number) => {
  const distances = [
    Math.hypot(x, y),
    Math.hypot(window.innerWidth - x, y),
    Math.hypot(x, window.innerHeight - y),
    Math.hypot(window.innerWidth - x, window.innerHeight - y),
  ];

  return Math.ceil(Math.max(...distances) * 2);
};

export const RouteTransitionOverlay: FC = () => {
  const location = useLocation();
  const hasMountedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const originRef = useRef<OriginPoint | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>({
    expanded: false,
    fading: false,
    visible: false,
    x: 0,
    y: 0,
    size: 0,
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const candidate = isTransitionCandidate(event.target);
      if (!candidate) return;
      originRef.current = {
        timestamp: performance.now(),
        x: event.clientX,
        y: event.clientY,
      };
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const candidate = isTransitionCandidate(document.activeElement);
      if (!candidate) return;
      const origin = getOriginFromElement(candidate);
      if (!origin) return;
      originRef.current = {
        timestamp: performance.now(),
        x: origin.x,
        y: origin.y,
      };
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, []);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useLayoutEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];

    const fallback = getViewportCenter();
    const recentOrigin = originRef.current && performance.now() - originRef.current.timestamp <= ORIGIN_TTL_MS
      ? originRef.current
      : null;
    const point = recentOrigin || { ...fallback, timestamp: performance.now() };
    const size = getCoverDiameter(point.x, point.y);

    setOverlay({
      expanded: false,
      fading: false,
      visible: true,
      x: point.x,
      y: point.y,
      size,
    });

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        setOverlay((current) => ({ ...current, expanded: true }));
      });
    });

    timersRef.current.push(
      window.setTimeout(() => {
        setOverlay((current) => ({ ...current, fading: true }));
      }, EXPAND_MS),
    );

    timersRef.current.push(
      window.setTimeout(() => {
        setOverlay({
          expanded: false,
          fading: false,
          visible: false,
          x: point.x,
          y: point.y,
          size,
        });
      }, EXPAND_MS + FADE_MS),
    );

    originRef.current = null;
  }, [location.key]);

  if (!overlay.visible) return null;

  return (
    <div
      className={`rto-layer${overlay.visible ? ' is-visible' : ''}${overlay.expanded ? ' is-expanded' : ''}${overlay.fading ? ' is-fading' : ''}`}
      aria-hidden="true"
      style={
        {
          '--rto-size': `${overlay.size}px`,
          '--rto-x': `${overlay.x}px`,
          '--rto-y': `${overlay.y}px`,
        } as CSSProperties
      }
    >
      <div className="rto-circle" />
    </div>
  );
};
