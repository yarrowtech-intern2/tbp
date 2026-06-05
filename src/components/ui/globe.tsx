import React, { useEffect, useRef, useState } from 'react';
import createGlobe, { type COBEOptions, type Globe as CobeGlobe } from 'cobe';

type GlobeProps = {
  className?: string;
  config?: Partial<COBEOptions>;
};

const DEFAULT_CONFIG: Omit<COBEOptions, 'width' | 'height' | 'devicePixelRatio' | 'phi'> = {
  theta: 0.18,
  dark: 0,
  diffuse: 1.15,
  mapSamples: 18000,
  mapBrightness: 7,
  baseColor: [0.89, 0.45, 0.12],
  markerColor: [0.06, 0.06, 0.06],
  glowColor: [1, 0.8, 0.62],
  scale: 1.08,
  offset: [-0.02, 0.04],
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

export const Globe: React.FC<GlobeProps> = ({ className, config }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(0);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size === 0) return undefined;

    const devicePixelRatio = getDevicePixelRatio();
    const renderSize = Math.round(size * devicePixelRatio);
    let phi = 0;

    const globe = createGlobe(canvas, {
      ...DEFAULT_CONFIG,
      ...config,
      width: renderSize,
      height: renderSize,
      devicePixelRatio,
      phi,
    } as COBEOptions) as CobeGlobe;

    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const rotate = () => {
      phi += 0.0032;
      globe.update({ phi });
      frameRef.current = window.requestAnimationFrame(rotate);
    };

    if (!prefersReducedMotion) {
      frameRef.current = window.requestAnimationFrame(rotate);
    }

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      globe.destroy();
    };
  }, [config, size]);

  return (
    <div ref={containerRef} className={className}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};
