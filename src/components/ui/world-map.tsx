import React, { useId, useMemo } from 'react';
import DottedMap from 'dotted-map';
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

const encodeSvg = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export default function WorldMap({
  dots = [],
  lineColor = '#ff6a00',
  className,
  ...props
}: WorldMapProps) {
  const gradientId = useId().replace(/:/g, '');

  const svgMap = useMemo(() => {
    const map = new DottedMap({ height: 100, grid: 'diagonal' });

    return map.getSVG({
      radius: 0.22,
      color: 'rgba(255, 106, 0, 1)',
      shape: 'circle',
      backgroundColor: 'transparent',
    });
  }, []);

  return (
    <div className={className ? `ui-world-map ${className}` : 'ui-world-map'} {...props}>
      <img
        src={encodeSvg(svgMap)}
        className="ui-world-map-image"
        alt=""
        width="1056"
        height="495"
        draggable={false}
      />
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
