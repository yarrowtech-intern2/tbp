import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import createGlobe, { type COBEOptions, type Globe as CobeGlobe } from 'cobe';

export type GlobeOverlayMarker = {
  id: string;
  ariaLabel: string;
  className?: string;
  content: React.ReactNode;
  location: [number, number];
  size?: number;
  onBlur?: React.FocusEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onFocus?: React.FocusEventHandler<HTMLButtonElement>;
  onPointerEnter?: React.PointerEventHandler<HTMLButtonElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLButtonElement>;
};

type GlobeProps = React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  config?: Partial<COBEOptions>;
  overlayMarkers?: GlobeOverlayMarker[];
};

const DEFAULT_THETA = 0.18;
const DEFAULT_SCALE = 1.08;
const DEFAULT_OFFSET: [number, number] = [-0.02, 0.04];

const DEFAULT_CONFIG: Omit<COBEOptions, 'width' | 'height' | 'devicePixelRatio' | 'phi'> = {
  theta: DEFAULT_THETA,
  dark: 0,
  diffuse: 1.15,
  mapSamples: 18000,
  mapBrightness: 7,
  baseColor: [0.89, 0.45, 0.12],
  markerColor: [0.06, 0.06, 0.06],
  glowColor: [1, 0.8, 0.62],
  scale: DEFAULT_SCALE,
  offset: DEFAULT_OFFSET,
  markers: [
    { location: [22.5726, 88.3639], size: 0.06 },
    { location: [51.5072, -0.1276], size: 0.05 },
    { location: [40.7128, -74.006], size: 0.04 },
    { location: [35.6762, 139.6503], size: 0.035 },
  ],
};

const getDevicePixelRatio = () => {
  if (typeof window === 'undefined') return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const projectMarker = (
  location: [number, number],
  phi: number,
  theta: number,
  scale: number,
  offset: [number, number],
  size: number,
) => {
  const lat = toRadians(location[0]);
  const lon = toRadians(location[1]);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  const deltaLon = lon - phi;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosLon = Math.cos(deltaLon);
  const sinLon = Math.sin(deltaLon);

  const x = cosLat * sinLon;
  const y = (cosTheta * sinLat) - (sinTheta * cosLat * cosLon);
  const z = (sinTheta * sinLat) + (cosTheta * cosLat * cosLon);
  const radius = (size * 0.5) * scale;
  const centerX = (size * 0.5) + (size * offset[0]);
  const centerY = (size * 0.5) + (size * offset[1]);

  return {
    x: centerX + (x * radius),
    y: centerY - (y * radius),
    z,
  };
};

export const Globe: React.FC<GlobeProps> = ({ className, config, overlayMarkers = [], ...rest }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayMarkerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const overlayMarkersRef = useRef(overlayMarkers);
  const phiRef = useRef(0);
  const [size, setSize] = useState(0);
  const resolvedConfig = useMemo(() => ({
    ...DEFAULT_CONFIG,
    ...config,
    theta: config?.theta ?? DEFAULT_THETA,
    scale: config?.scale ?? DEFAULT_SCALE,
    offset: config?.offset ?? DEFAULT_OFFSET,
  }), [config]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const updateSize = () => {
      const nextSize = Math.round(node.getBoundingClientRect().width);
      if (nextSize > 0) setSize(nextSize);
    };

    updateSize();

    const observer = new ResizeObserver(() => {
      updateSize();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  const syncOverlayPositions = useCallback((phi = phiRef.current) => {
    const theta: number = resolvedConfig.theta ?? DEFAULT_THETA;
    const scale: number = resolvedConfig.scale ?? DEFAULT_SCALE;
    const offset = (resolvedConfig.offset ?? DEFAULT_OFFSET) as [number, number];

    overlayMarkersRef.current.forEach((marker) => {
      const node = overlayMarkerRefs.current[marker.id];
      if (!node) return;

      const projected = projectMarker(marker.location, phi, theta, scale, offset, size);
      const isVisible = projected.z > 0.08;
      const depth = Math.max(0, projected.z);
      const markerScale = 0.76 + (depth * 0.44);

      node.style.opacity = isVisible ? String(0.42 + (depth * 0.58)) : '0';
      node.style.pointerEvents = isVisible ? 'auto' : 'none';
      node.style.transform = `translate(${projected.x}px, ${projected.y}px) translate(-50%, -50%) scale(${markerScale})`;
      node.style.zIndex = String(10 + Math.round(depth * 20));
    });
  }, [resolvedConfig.offset, resolvedConfig.scale, resolvedConfig.theta, size]);

  useEffect(() => {
    overlayMarkersRef.current = overlayMarkers;
    syncOverlayPositions();
  }, [overlayMarkers, syncOverlayPositions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return undefined;

    const devicePixelRatio = getDevicePixelRatio();
    const renderSize = Math.round(size * devicePixelRatio);
    let phi = 0;
    phiRef.current = phi;

    const globe = createGlobe(canvas, {
      ...resolvedConfig,
      width: renderSize,
      height: renderSize,
      devicePixelRatio,
      phi,
    } as COBEOptions) as CobeGlobe;

    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rotate = () => {
      phi += 0.0032;
      phiRef.current = phi;
      globe.update({ phi });
      syncOverlayPositions(phi);
      frameRef.current = window.requestAnimationFrame(rotate);
    };

    if (!prefersReducedMotion) {
      frameRef.current = window.requestAnimationFrame(rotate);
    } else {
      syncOverlayPositions(phi);
    }

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      globe.destroy();
    };
  }, [resolvedConfig, size, syncOverlayPositions]);

  return (
    <div ref={containerRef} className={className} {...rest}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
      />
      {overlayMarkers.length > 0 ? (
        <div className="globe-overlay-layer">
          {overlayMarkers.map((marker) => (
            <button
              key={marker.id}
              ref={(node) => {
                overlayMarkerRefs.current[marker.id] = node;
              }}
              type="button"
              className={`globe-overlay-marker${marker.className ? ` ${marker.className}` : ''}`}
              aria-label={marker.ariaLabel}
              onBlur={marker.onBlur}
              onClick={marker.onClick}
              onFocus={marker.onFocus}
              onPointerEnter={marker.onPointerEnter}
              onPointerLeave={marker.onPointerLeave}
            >
              {marker.content}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
