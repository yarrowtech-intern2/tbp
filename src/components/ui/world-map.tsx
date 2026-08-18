import React, { useId } from 'react';
import './world-map.css';

type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
};

export type WorldMapDot = {
  start: MapPoint;
  end: MapPoint;
};

type WorldMapProps = React.HTMLAttributes<HTMLDivElement> & {
  dots?: WorldMapDot[];
  lineColor?: string;
};

const WORLD_MAP_MASK_SRC = '/images/home4/tbp-map.webp';

const projectPoint = (lat: number, lng: number) => {
  const x = (lng + 180) * (800 / 360);
  const y = (90 - lat) * (400 / 180);
  return { x, y };
};

const createCurvedPath = (start: { x: number; y: number }, end: { x: number; y: number }) => {
  const midX = (start.x + end.x) / 2;
  const midY = Math.min(start.y, end.y) - 50;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
};

export default function WorldMap({
  dots = [],
  lineColor = '#ff6a00',
  className,
  ...props
}: WorldMapProps) {
  const gradientId = useId().replace(/:/g, '');
  const mapMaskId = `${gradientId}-map-mask`;
  const mapFillId = `${gradientId}-map-fill`;

  return (
    <div className={className ? `ui-world-map ${className}` : 'ui-world-map'} {...props}>
      <svg
        className="ui-world-map-image"
        viewBox="0 0 800 400"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <mask id={mapMaskId} maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse">
            <rect width="800" height="400" fill="black" />
            <image href={WORLD_MAP_MASK_SRC} x="0" y="0" width="800" height="400" preserveAspectRatio="none" />
          </mask>
          <linearGradient id={mapFillId} x1="0" x2="1" y1="0.15" y2="0.88">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
            <stop offset="50%" stopColor={lineColor} stopOpacity="0.46" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.18" />
          </linearGradient>
        </defs>
        <rect width="800" height="400" fill={`url(#${mapFillId})`} mask={`url(#${mapMaskId})`} />
      </svg>
      <svg className="ui-world-map-lines" viewBox="0 0 800 400" aria-hidden="true">
        <defs>
          {dots.map((_, index) => (
            <linearGradient key={`path-gradient-${index}`} id={`${gradientId}-path-${index}`}>
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="8%" stopColor={lineColor} stopOpacity="0.18" />
              <stop offset="92%" stopColor={lineColor} stopOpacity="0.88" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {dots.map((dot, index) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);
          const path = createCurvedPath(startPoint, endPoint);

          return (
            <path
              key={`map-path-${index}`}
              d={path}
              fill="none"
              stroke={`url(#${gradientId}-path-${index})`}
              strokeWidth="1"
              strokeDasharray="6 6"
              strokeLinecap="round"
              className="ui-world-map-path"
              style={{ animationDelay: `${index * 140}ms` }}
            />
          );
        })}

        {dots.map((dot, index) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);

          return (
            <g key={`map-points-${index}`}>
              {[startPoint, endPoint].map((point, pointIndex) => (
                <g key={`map-point-${index}-${pointIndex}`}>
                  <circle cx={point.x} cy={point.y} r="2.4" fill={lineColor} />
                  <circle cx={point.x} cy={point.y} r="2.4" fill={lineColor} className="ui-world-map-pulse" />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
