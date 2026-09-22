import React, { Suspense, lazy, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';
import {
    CHART_RANGE_OPTIONS,
    buildCategoryTotals,
    buildChartSeries,
    formatChartAverage,
    formatChartDelta,
    formatChartValue,
    getRangeSpec,
    type ChartBucketSpec,
    type ChartEvent,
    type ChartRangeKey,
    type ChartUnit,
} from './chartData';
import {
    buildBarOption,
    buildDonutOption,
    buildLineOption,
    type ChartTheme,
    type DonutSlice,
} from './chartOptions';
import './dashboard-charts.css';

const LazyEChart = lazy(() => import('./EChartCore'));

export type TimeSeriesSource = {
    id: string;
    title: string;
    subtitle: string;
    kind: 'bar' | 'line';
    unit: ChartUnit;
    /** Noun used in tooltips and stat tiles, e.g. "Bookings". */
    valueLabel: string;
    events: ChartEvent[];
    /** Window shown on the dashboard card. Defaults to 5 months (bar) / 10 days (line). */
    inlineSpec?: ChartBucketSpec;
    /** Range the detail view opens on. Defaults to 6 months (bar) / 30 days (line). */
    defaultRange?: Exclude<ChartRangeKey, 'ALL'>;
};

export type DonutCategory = { key: string; label: string; color: string; darkColor?: string };

export type DonutSource = {
    id: string;
    title: string;
    subtitle: string;
    categories: DonutCategory[];
    events: ChartEvent[];
};

const DEFAULT_INLINE_SPEC: Record<TimeSeriesSource['kind'], ChartBucketSpec> = {
    bar: { unit: 'month', count: 5 },
    line: { unit: 'day', count: 10 },
};

const DEFAULT_RANGE: Record<TimeSeriesSource['kind'], Exclude<ChartRangeKey, 'ALL'>> = {
    bar: '6M',
    line: '30D',
};

const toChartTheme = (theme: string): ChartTheme => (theme === 'dark' ? 'dark' : 'light');

const ChartSkeleton: React.FC = () => <div className="rdb-chart-skeleton" aria-hidden="true" />;

// ---------------------------------------------------------------------------
// Modal shell
// ---------------------------------------------------------------------------

type RangeOption = { key: ChartRangeKey; label: string; short: string };

const TIME_SERIES_RANGES: RangeOption[] = CHART_RANGE_OPTIONS.map((option) => ({
    key: option.key,
    label: option.label,
    short: option.key,
}));

const DONUT_RANGES: RangeOption[] = [
    ...TIME_SERIES_RANGES,
    { key: 'ALL', label: 'All time', short: 'All' },
];

type ChartModalShellProps = {
    title: string;
    subtitle: string;
    ranges: RangeOption[];
    range: ChartRangeKey;
    onRangeChange: (range: ChartRangeKey) => void;
    onClose: () => void;
    footnote: string;
    children: React.ReactNode;
};

const ChartModalShell: React.FC<ChartModalShellProps> = ({
    title,
    subtitle,
    ranges,
    range,
    onRangeChange,
    onClose,
    footnote,
    children,
}) => {
    const closeRef = useRef<HTMLButtonElement | null>(null);
    const onCloseRef = useRef(onClose);
    const titleId = useId();

    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    // Mount-only: parents pass a fresh onClose every render, which must not re-lock scroll or steal focus.
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onCloseRef.current();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.clearTimeout(focusTimer);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    return createPortal(
        <div className="rdb-chart-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button type="button" className="rdb-chart-modal-backdrop" aria-label="Close chart" onClick={onClose} />
            <section className="rdb-chart-modal-card">
                <header className="rdb-chart-modal-head">
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        <p>{subtitle}</p>
                    </div>
                    <button ref={closeRef} type="button" className="rdb-chart-modal-close" aria-label="Close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </header>

                <div className="rdb-chart-range" role="group" aria-label="Time range">
                    {ranges.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            title={option.label}
                            className={`rdb-chart-range-btn${option.key === range ? ' is-active' : ''}`}
                            aria-pressed={option.key === range}
                            onClick={() => onRangeChange(option.key)}
                        >
                            {option.short}
                        </button>
                    ))}
                </div>

                {children}

                <footer className="rdb-chart-modal-foot">{footnote}</footer>
            </section>
        </div>,
        document.body,
    );
};

// ---------------------------------------------------------------------------
// Bar / line charts
// ---------------------------------------------------------------------------

const groupedByNoun = { day: 'day', week: 'week', month: 'month' } as const;

const TimeSeriesDetailModal: React.FC<{ source: TimeSeriesSource; theme: ChartTheme; onClose: () => void }> = ({
    source,
    theme,
    onClose,
}) => {
    const [range, setRange] = useState<ChartRangeKey>(source.defaultRange ?? DEFAULT_RANGE[source.kind]);
    const activeRange = range === 'ALL' ? DEFAULT_RANGE[source.kind] : range;
    const series = useMemo(
        () => buildChartSeries(source.events, getRangeSpec(activeRange)),
        [source.events, activeRange],
    );
    const option = useMemo(() => {
        const input = { buckets: series.buckets, unit: source.unit, valueLabel: source.valueLabel, theme, compact: false };
        return source.kind === 'bar' ? buildBarOption(input) : buildLineOption(input);
    }, [series.buckets, source.kind, source.unit, source.valueLabel, theme]);

    const delta = formatChartDelta(series.total, series.previousTotal);
    const rangeLabel = TIME_SERIES_RANGES.find((item) => item.key === activeRange)?.label ?? '';

    return (
        <ChartModalShell
            title={source.title}
            subtitle={source.subtitle}
            ranges={TIME_SERIES_RANGES}
            range={activeRange}
            onRangeChange={setRange}
            onClose={onClose}
            footnote={`${series.windowLabel} · grouped by ${groupedByNoun[series.groupedBy]}`}
        >
            <div className="rdb-chart-stats">
                <div>
                    <span>Total</span>
                    <strong>{formatChartValue(source.unit, series.total)}</strong>
                </div>
                <div>
                    <span>Avg / {groupedByNoun[series.groupedBy]}</span>
                    <strong>{formatChartAverage(source.unit, series.average)}</strong>
                </div>
                <div>
                    <span>Peak</span>
                    <strong>{series.peak ? formatChartValue(source.unit, series.peak.value) : '—'}</strong>
                    {series.peak ? <small>{series.peak.tooltipLabel}</small> : null}
                </div>
                <div>
                    <span>vs previous {rangeLabel}</span>
                    <strong className={`rdb-chart-delta rdb-chart-delta--${delta.tone}`}>{delta.text}</strong>
                </div>
            </div>

            <div
                className="rdb-chart-modal-plot"
                role="img"
                aria-label={`${source.title}, ${rangeLabel}: ${series.buckets.map((bucket) => `${bucket.tooltipLabel} ${bucket.value}`).join(', ')}`}
            >
                <Suspense fallback={<ChartSkeleton />}>
                    <LazyEChart option={option} />
                </Suspense>
                {series.total === 0 ? <span className="rdb-chart-empty">No {source.valueLabel.toLowerCase()} in this period</span> : null}
            </div>
        </ChartModalShell>
    );
};

export const TimeSeriesChart: React.FC<{ source: TimeSeriesSource; theme: string }> = ({ source, theme }) => {
    const chartTheme = toChartTheme(theme);
    const [open, setOpen] = useState(false);
    const series = useMemo(
        () => buildChartSeries(source.events, source.inlineSpec ?? DEFAULT_INLINE_SPEC[source.kind]),
        [source.events, source.inlineSpec, source.kind],
    );
    const option = useMemo(() => {
        const input = { buckets: series.buckets, unit: source.unit, valueLabel: source.valueLabel, theme: chartTheme, compact: true };
        return source.kind === 'bar' ? buildBarOption(input) : buildLineOption(input);
    }, [series.buckets, source.kind, source.unit, source.valueLabel, chartTheme]);

    const openDetail = () => setOpen(true);

    return (
        <>
            <div
                className={`rdb-chart-frame rdb-chart-frame--${source.kind}`}
                role="img"
                aria-label={`${source.title}: ${series.buckets.map((bucket) => `${bucket.tooltipLabel} ${bucket.value}`).join(', ')}`}
                onClick={openDetail}
            >
                <Suspense fallback={<ChartSkeleton />}>
                    <LazyEChart option={option} />
                </Suspense>
                {series.total === 0 ? <span className="rdb-chart-empty">No {source.valueLabel.toLowerCase()} yet</span> : null}
                <button
                    type="button"
                    className="rdb-chart-expand"
                    aria-label={`Expand ${source.title} chart`}
                    title="Expand"
                    onClick={(event) => {
                        event.stopPropagation();
                        openDetail();
                    }}
                >
                    <Maximize2 size={13} />
                </button>
            </div>
            {open ? <TimeSeriesDetailModal source={source} theme={chartTheme} onClose={() => setOpen(false)} /> : null}
        </>
    );
};

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------

const buildSlices = (source: DonutSource, totals: Map<string, number>, theme: ChartTheme): DonutSlice[] => (
    source.categories.map((category) => ({
        key: category.key,
        label: category.label,
        value: totals.get(category.key) || 0,
        color: theme === 'dark' && category.darkColor ? category.darkColor : category.color,
    }))
);

const DonutDetailModal: React.FC<{ source: DonutSource; theme: ChartTheme; onClose: () => void }> = ({ source, theme, onClose }) => {
    const [range, setRange] = useState<ChartRangeKey>('ALL');
    const totals = useMemo(() => buildCategoryTotals(source.events, range), [source.events, range]);
    const slices = useMemo(() => buildSlices(source, totals.byCategory, theme), [source, totals.byCategory, theme]);
    const option = useMemo(
        () => buildDonutOption({ slices, total: totals.total, theme, compact: false }),
        [slices, totals.total, theme],
    );
    const rangeLabel = DONUT_RANGES.find((item) => item.key === range)?.label ?? '';

    return (
        <ChartModalShell
            title={source.title}
            subtitle={source.subtitle}
            ranges={DONUT_RANGES}
            range={range}
            onRangeChange={setRange}
            onClose={onClose}
            footnote={totals.windowLabel}
        >
            <div className="rdb-chart-donut-layout">
                <div
                    className="rdb-chart-donut-plot"
                    role="img"
                    aria-label={`${source.title}, ${rangeLabel}: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(', ')}`}
                >
                    <Suspense fallback={<ChartSkeleton />}>
                        <LazyEChart option={option} />
                    </Suspense>
                </div>
                <ul className="rdb-chart-legend">
                    {slices.map((slice) => {
                        const percent = totals.total > 0 ? Math.round((slice.value / totals.total) * 100) : 0;
                        return (
                            <li key={slice.key}>
                                <span className="rdb-chart-legend-dot" style={{ background: slice.color }} aria-hidden="true" />
                                <span className="rdb-chart-legend-label">{slice.label}</span>
                                <strong>{formatChartValue('count', slice.value)}</strong>
                                <small>{percent}%</small>
                                <span className="rdb-chart-legend-bar" aria-hidden="true">
                                    <span style={{ width: `${percent}%`, background: slice.color }} />
                                </span>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </ChartModalShell>
    );
};

export const StatusDonut: React.FC<{ source: DonutSource; theme: string }> = ({ source, theme }) => {
    const chartTheme = toChartTheme(theme);
    const [open, setOpen] = useState(false);
    const totals = useMemo(() => buildCategoryTotals(source.events, 'ALL'), [source.events]);
    const slices = useMemo(() => buildSlices(source, totals.byCategory, chartTheme), [source, totals.byCategory, chartTheme]);
    const option = useMemo(
        () => buildDonutOption({ slices, total: totals.total, theme: chartTheme, compact: true }),
        [slices, totals.total, chartTheme],
    );

    return (
        <>
            <div
                className="rdb-donut-frame"
                role="button"
                tabIndex={0}
                aria-label={`${source.title}: ${slices.map((slice) => `${slice.label} ${slice.value}`).join(', ')}. Open details`}
                title="View details"
                onClick={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                <Suspense fallback={<ChartSkeleton />}>
                    <LazyEChart option={option} />
                </Suspense>
            </div>
            {open ? <DonutDetailModal source={source} theme={chartTheme} onClose={() => setOpen(false)} /> : null}
        </>
    );
};
