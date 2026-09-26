import React, { useEffect, useId, useRef, useState } from 'react';
import { formatCompact, formatFull, type AnalyticsDay } from '../../../lib/adminAnalytics';

export type DailyMetricKey = Exclude<keyof AnalyticsDay, 'day'>;

const useContainerWidth = () => {
    const ref = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    return [ref, width] as const;
};

const formatDay = (day: string, long = false): string => (
    new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', long
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : { day: 'numeric', month: 'short' })
);

/** Smooth line through points using horizontal-tangent beziers (never overshoots the data). */
const smoothPath = (points: Array<[number, number]>): string => {
    if (points.length === 0) return '';
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i += 1) {
        const [x0, y0] = points[i - 1];
        const [x1, y1] = points[i];
        const mx = (x0 + x1) / 2;
        d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
    }
    return d;
};

const niceStep = (rawStep: number): number => {
    if (rawStep <= 1) return 1;
    const pow = 10 ** Math.floor(Math.log10(rawStep));
    const normalized = rawStep / pow;
    const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return nice * pow;
};

interface TrendChartProps {
    days: AnalyticsDay[];
    metric: DailyMetricKey;
    color: string;
    label: string;
    tooltipMetrics: Array<{ key: DailyMetricKey; label: string; color: string }>;
}

export const TrendChart: React.FC<TrendChartProps> = ({ days, metric, color, label, tooltipMetrics }) => {
    const [containerRef, width] = useContainerWidth();
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const gradientId = useId().replace(/:/g, '');

    const height = width < 520 ? 210 : 290;
    const pad = { left: 40, right: 14, top: 16, bottom: 28 };
    const innerW = Math.max(width - pad.left - pad.right, 10);
    const innerH = height - pad.top - pad.bottom;

    const values = days.map((day) => day[metric]);
    const max = Math.max(...values, 1);
    const step = niceStep(max / 4);
    const yMax = step * 4;
    const total = values.reduce((sum, value) => sum + value, 0);

    const count = Math.max(days.length - 1, 1);
    const points: Array<[number, number]> = values.map((value, index) => [
        pad.left + (index / count) * innerW,
        pad.top + innerH - (value / yMax) * innerH,
    ]);
    const line = smoothPath(points);
    const baseY = pad.top + innerH;
    const area = points.length
        ? `${line} L${points[points.length - 1][0]},${baseY} L${points[0][0]},${baseY} Z`
        : '';
    const geometry = { points, line, area };

    const labelCount = width < 520 ? 4 : 7;
    const labelIndexes = Array.from(new Set(
        Array.from({ length: labelCount }, (_, i) => Math.round((i / (labelCount - 1)) * (days.length - 1))),
    ));

    const handlePointer = (event: React.PointerEvent<SVGRectElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        setHoverIndex(Math.min(days.length - 1, Math.max(0, Math.round(ratio * (days.length - 1)))));
    };

    const hovered = hoverIndex !== null ? days[hoverIndex] : null;
    const hoverPoint = hoverIndex !== null ? geometry.points[hoverIndex] : null;

    return (
        <div ref={containerRef} className="an-chart" style={{ height }}>
            {width > 0 && (
                <svg
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    role="img"
                    aria-label={`${label} per day. Total ${formatFull(total)} over ${days.length} days.`}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.32" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map((tick) => {
                        const y = pad.top + innerH - (tick / 4) * innerH;
                        return (
                            <g key={tick}>
                                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="an-grid-line" />
                                <text x={pad.left - 8} y={y + 4} textAnchor="end" className="an-axis-text">
                                    {formatCompact(step * tick)}
                                </text>
                            </g>
                        );
                    })}

                    {labelIndexes.map((index) => (
                        <text
                            key={index}
                            x={geometry.points[index]?.[0] ?? 0}
                            y={height - 8}
                            textAnchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'}
                            className="an-axis-text"
                        >
                            {formatDay(days[index].day)}
                        </text>
                    ))}

                    <path d={geometry.area} fill={`url(#${gradientId})`} className="an-area" key={`area-${metric}`} />
                    <path
                        d={geometry.line}
                        fill="none"
                        stroke={color}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={1}
                        className="an-line"
                        key={`line-${metric}-${days.length}`}
                    />

                    {hoverPoint && (
                        <g pointerEvents="none">
                            <line x1={hoverPoint[0]} x2={hoverPoint[0]} y1={pad.top} y2={pad.top + innerH} className="an-cross" />
                            <circle cx={hoverPoint[0]} cy={hoverPoint[1]} r="5" fill="var(--surface-main)" stroke={color} strokeWidth="2.5" />
                        </g>
                    )}

                    <rect
                        x={pad.left}
                        y={pad.top}
                        width={innerW}
                        height={innerH}
                        fill="transparent"
                        onPointerMove={handlePointer}
                        onPointerDown={handlePointer}
                        onPointerLeave={() => setHoverIndex(null)}
                        style={{ touchAction: 'pan-y' }}
                    />
                </svg>
            )}

            {hovered && hoverPoint && (
                <div
                    className="an-tooltip"
                    style={{ left: Math.min(Math.max(hoverPoint[0], 84), Math.max(width - 84, 84)), top: 4 }}
                >
                    <strong>{formatDay(hovered.day, true)}</strong>
                    {tooltipMetrics.map((item) => (
                        <span key={item.key}>
                            <i style={{ background: item.color }} />
                            {item.label}
                            <b>{formatFull(hovered[item.key])}</b>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export const Sparkline: React.FC<{ values: number[]; color: string }> = ({ values, color }) => {
    const gradientId = useId().replace(/:/g, '');
    const w = 96;
    const h = 30;
    const max = Math.max(...values, 1);
    const count = Math.max(values.length - 1, 1);
    const points: Array<[number, number]> = values.map((value, index) => [
        (index / count) * w,
        h - 3 - (value / max) * (h - 6),
    ]);
    const line = smoothPath(points);
    const area = points.length ? `${line} L${w},${h} L0,${h} Z` : '';

    return (
        <svg className="an-spark" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" preserveAspectRatio="none">
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export const Donut: React.FC<{ items: Array<{ label: string; value: number; color: string }>; centerLabel: string }> = ({ items, centerLabel }) => {
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className="an-donut">
            <svg viewBox="0 0 132 132" width="132" height="132" role="img" aria-label={`${centerLabel}: ${items.map((item) => `${item.label} ${formatFull(item.value)}`).join(', ')}`}>
                <circle cx="66" cy="66" r={radius} fill="none" stroke="var(--border-light)" strokeWidth="16" />
                {total > 0 && items.map((item) => {
                    const length = (item.value / total) * circumference;
                    const segment = (
                        <circle
                            key={item.label}
                            cx="66"
                            cy="66"
                            r={radius}
                            fill="none"
                            stroke={item.color}
                            strokeWidth="16"
                            strokeDasharray={`${Math.max(length - 2, 0)} ${circumference - Math.max(length - 2, 0)}`}
                            strokeDashoffset={-offset}
                            transform="rotate(-90 66 66)"
                            className="an-donut-seg"
                        />
                    );
                    offset += length;
                    return segment;
                })}
                <text x="66" y="64" textAnchor="middle" className="an-donut-total">{formatCompact(total)}</text>
                <text x="66" y="80" textAnchor="middle" className="an-donut-caption">{centerLabel}</text>
            </svg>
            <ul className="an-legend">
                {items.map((item) => (
                    <li key={item.label}>
                        <i style={{ background: item.color }} />
                        <span>{item.label}</span>
                        <b>{total > 0 ? Math.round((item.value / total) * 100) : 0}%</b>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export const BarList: React.FC<{
    items: Array<{ label: string; value: number; hint?: string }>;
    color: string;
    empty: string;
}> = ({ items, color, empty }) => {
    if (items.length === 0) return <p className="an-empty">{empty}</p>;
    const max = Math.max(...items.map((item) => item.value), 1);

    return (
        <ul className="an-bars">
            {items.map((item, index) => (
                <li key={`${item.label}-${index}`}>
                    <div className="an-bar-head">
                        <span title={item.label}>{item.label}</span>
                        <b title={item.hint}>{formatCompact(item.value)}</b>
                    </div>
                    <div className="an-bar-track">
                        <span
                            style={{ width: `${Math.max((item.value / max) * 100, 2)}%`, background: color, animationDelay: `${index * 50}ms` }}
                        />
                    </div>
                </li>
            ))}
        </ul>
    );
};

export const Funnel: React.FC<{ steps: Array<{ label: string; value: number; color: string }> }> = ({ steps }) => {
    const top = Math.max(steps[0]?.value || 0, 1);

    return (
        <ol className="an-funnel">
            {steps.map((step, index) => {
                const previous = index === 0 ? null : steps[index - 1].value;
                const conversion = previous === null ? null : previous > 0 ? Math.round((step.value / previous) * 100) : 0;
                return (
                    <li key={step.label}>
                        <div className="an-funnel-head">
                            <span>{step.label}</span>
                            <b>{formatFull(step.value)}</b>
                            {conversion !== null && <em title="Share of the previous step">{conversion}%</em>}
                        </div>
                        <div className="an-bar-track an-bar-track--tall">
                            <span style={{ width: `${Math.max((step.value / top) * 100, step.value > 0 ? 2 : 0)}%`, background: step.color, animationDelay: `${index * 80}ms` }} />
                        </div>
                    </li>
                );
            })}
        </ol>
    );
};

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DOW_LABELS: Record<number, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' };

export const Heatmap: React.FC<{ cells: Array<{ dow: number; hour: number; events: number }> }> = ({ cells }) => {
    const lookup = new Map(cells.map((cell) => [`${cell.dow}-${cell.hour}`, cell.events]));
    const max = Math.max(...cells.map((cell) => cell.events), 0);
    const peak = cells.reduce<{ dow: number; hour: number; events: number } | null>(
        (best, cell) => (!best || cell.events > best.events ? cell : best),
        null,
    );

    if (max === 0) return <p className="an-empty">Peak-hours will appear once page views are recorded.</p>;

    return (
        <div className="an-heat-wrap">
            <div className="an-heat-scroll">
                <div className="an-heat">
                    <div className="an-heat-hours" aria-hidden="true">
                        <span />
                        {Array.from({ length: 24 }, (_, hour) => (
                            <span key={hour}>{hour % 3 === 0 ? String(hour).padStart(2, '0') : ''}</span>
                        ))}
                    </div>
                    {DOW_ORDER.map((dow) => (
                        <div className="an-heat-row" key={dow}>
                            <span className="an-heat-day">{DOW_LABELS[dow]}</span>
                            {Array.from({ length: 24 }, (_, hour) => {
                                const events = lookup.get(`${dow}-${hour}`) || 0;
                                const level = events / max;
                                return (
                                    <span
                                        key={hour}
                                        className={`an-heat-cell${events === 0 ? ' is-empty' : ''}`}
                                        style={events > 0 ? { ['--level' as string]: `${Math.round(18 + level * 82)}%` } : undefined}
                                        title={`${DOW_LABELS[dow]} ${String(hour).padStart(2, '0')}:00 - ${formatFull(events)} page views`}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            {peak && (
                <p className="an-heat-peak">
                    Busiest: <b>{DOW_LABELS[peak.dow]} {String(peak.hour).padStart(2, '0')}:00</b> ({formatFull(peak.events)} page views)
                </p>
            )}
        </div>
    );
};
