export type ChartRangeKey = '7D' | '30D' | '90D' | '6M' | '12M' | 'ALL';

export type ChartEvent = {
    date?: string | null;
    /** Amount contributed by this event. Defaults to 1 (a plain count). */
    value?: number;
    /** Used by category (donut) charts only. */
    category?: string;
};

export type ChartUnit = 'count' | 'currency';

type BucketUnit = 'day' | 'week' | 'month';

export type ChartBucketSpec = { unit: BucketUnit; count: number };

export type ChartBucket = {
    label: string;
    tooltipLabel: string;
    value: number;
};

export type ChartSeries = {
    buckets: ChartBucket[];
    total: number;
    average: number;
    peak: ChartBucket | null;
    /** Total of the immediately preceding window of the same length; null when it cannot be computed. */
    previousTotal: number | null;
    /** Human readable description of the window, e.g. "12 Sep – 21 Sep 2026". */
    windowLabel: string;
    groupedBy: 'day' | 'week' | 'month';
};

export const CHART_RANGE_OPTIONS: Array<{ key: Exclude<ChartRangeKey, 'ALL'>; label: string; spec: ChartBucketSpec }> = [
    { key: '7D', label: '7 days', spec: { unit: 'day', count: 7 } },
    { key: '30D', label: '30 days', spec: { unit: 'day', count: 30 } },
    { key: '90D', label: '90 days', spec: { unit: 'week', count: 13 } },
    { key: '6M', label: '6 months', spec: { unit: 'month', count: 6 } },
    { key: '12M', label: '12 months', spec: { unit: 'month', count: 12 } },
];

export const getRangeSpec = (key: Exclude<ChartRangeKey, 'ALL'>): ChartBucketSpec => (
    CHART_RANGE_OPTIONS.find((option) => option.key === key)?.spec ?? CHART_RANGE_OPTIONS[1].spec
);

const DAY_MS = 86400000;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Calendar-day / calendar-month numbers make bucket math immune to DST shifts.
const dayNumber = (date: Date) => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
const monthNumber = (date: Date) => (date.getFullYear() * 12) + date.getMonth();
const dateFromDayNumber = (day: number) => {
    const utc = new Date(day * DAY_MS);
    return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
};

const formatDayMonth = (date: Date) => `${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
const formatFullDate = (date: Date) => `${formatDayMonth(date)} ${date.getFullYear()}`;

const parseEventDate = (value?: string | null): Date | null => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const safeValue = (event: ChartEvent) => {
    const value = event.value ?? 1;
    return Number.isFinite(value) ? value : 0;
};

/**
 * Buckets events into `spec.count` consecutive units ending at the current one, and also totals the
 * window of the same length immediately before it so callers can show a period-over-period change.
 */
export const buildChartSeries = (
    events: ChartEvent[],
    spec: ChartBucketSpec,
    now: Date = new Date(),
): ChartSeries => {
    const { unit, count } = spec;

    const firstIndexOffset = unit === 'day'
        ? dayNumber(now) - count + 1
        : unit === 'week'
            ? dayNumber(now) - (count * 7) + 1
            : monthNumber(now) - count + 1;

    const indexOf = (date: Date) => {
        if (unit === 'day') return dayNumber(date) - firstIndexOffset;
        if (unit === 'week') return Math.floor((dayNumber(date) - firstIndexOffset) / 7);
        return monthNumber(date) - firstIndexOffset;
    };

    const values = new Array<number>(count).fill(0);
    let previousTotal = 0;
    events.forEach((event) => {
        const date = parseEventDate(event.date);
        if (!date) return;
        const index = indexOf(date);
        if (index >= 0 && index < count) values[index] += safeValue(event);
        else if (index >= -count && index < 0) previousTotal += safeValue(event);
    });

    const today = dayNumber(now);
    const buckets: ChartBucket[] = values.map((value, index) => {
        if (unit === 'day') {
            const date = dateFromDayNumber(firstIndexOffset + index);
            return {
                value,
                label: count <= 7 ? WEEKDAY_LABELS[date.getDay()] : formatDayMonth(date),
                tooltipLabel: `${WEEKDAY_LABELS[date.getDay()]}, ${formatFullDate(date)}`,
            };
        }
        if (unit === 'week') {
            const startDay = firstIndexOffset + (index * 7);
            const endDay = Math.min(startDay + 6, today);
            const start = dateFromDayNumber(startDay);
            const end = dateFromDayNumber(endDay);
            return {
                value,
                label: formatDayMonth(start),
                tooltipLabel: `${formatDayMonth(start)} – ${formatFullDate(end)}`,
            };
        }
        const monthIndex = firstIndexOffset + index;
        const year = Math.floor(monthIndex / 12);
        const month = monthIndex - (year * 12);
        return {
            value,
            label: MONTH_LABELS[month],
            tooltipLabel: `${MONTH_LABELS[month]} ${year}`,
        };
    });

    const total = values.reduce((sum, value) => sum + value, 0);
    const peak = buckets.reduce<ChartBucket | null>(
        (best, bucket) => (bucket.value > 0 && (!best || bucket.value > best.value) ? bucket : best),
        null,
    );

    let windowLabel: string;
    if (unit === 'month') {
        windowLabel = `${buckets[0].tooltipLabel} – ${buckets[buckets.length - 1].tooltipLabel}`;
    } else {
        const startDay = firstIndexOffset;
        windowLabel = `${formatDayMonth(dateFromDayNumber(startDay))} – ${formatFullDate(dateFromDayNumber(today))}`;
    }

    return {
        buckets,
        total,
        average: count > 0 ? total / count : 0,
        peak,
        previousTotal,
        windowLabel,
        groupedBy: unit,
    };
};

export type CategoryTotals = {
    total: number;
    byCategory: Map<string, number>;
    windowLabel: string;
};

/** Sums events per category inside the selected range. `ALL` also keeps undated events. */
export const buildCategoryTotals = (
    events: ChartEvent[],
    range: ChartRangeKey,
    now: Date = new Date(),
): CategoryTotals => {
    const byCategory = new Map<string, number>();
    let total = 0;

    let fromDay = Number.NEGATIVE_INFINITY;
    let windowLabel = 'All time';
    if (range !== 'ALL') {
        const spec = getRangeSpec(range);
        if (spec.unit === 'month') {
            const firstMonth = monthNumber(now) - spec.count + 1;
            fromDay = dayNumber(new Date(Math.floor(firstMonth / 12), firstMonth - (Math.floor(firstMonth / 12) * 12), 1));
        } else {
            fromDay = dayNumber(now) - (spec.unit === 'week' ? spec.count * 7 : spec.count) + 1;
        }
        windowLabel = `${formatDayMonth(dateFromDayNumber(fromDay))} – ${formatFullDate(now)}`;
    }

    const toDay = dayNumber(now);
    events.forEach((event) => {
        if (range !== 'ALL') {
            const date = parseEventDate(event.date);
            if (!date) return;
            const day = dayNumber(date);
            if (day < fromDay || day > toDay) return;
        }
        const category = event.category || 'other';
        const value = safeValue(event);
        byCategory.set(category, (byCategory.get(category) || 0) + value);
        total += value;
    });

    return { total, byCategory, windowLabel };
};

const countFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const compactFormatter = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const formatChartValue = (unit: ChartUnit, value: number) => {
    const rounded = Math.round(value);
    return unit === 'currency' ? `Rs ${countFormatter.format(rounded)}` : countFormatter.format(rounded);
};

export const formatChartAxisValue = (unit: ChartUnit, value: number) => {
    const text = compactFormatter.format(value);
    return unit === 'currency' ? `Rs ${text}` : text;
};

export const formatChartAverage = (unit: ChartUnit, value: number) => {
    if (unit === 'currency') return formatChartValue(unit, value);
    return value >= 10 ? countFormatter.format(Math.round(value)) : (Math.round(value * 10) / 10).toString();
};

/** "+24%", "-8%", "New" (previous was 0, now > 0) or "—" (no activity in either window). */
export const formatChartDelta = (current: number, previous: number | null): { text: string; tone: 'up' | 'down' | 'flat' } => {
    if (previous === null) return { text: '—', tone: 'flat' };
    if (previous === 0) return current > 0 ? { text: 'New', tone: 'up' } : { text: '—', tone: 'flat' };
    const change = Math.round(((current - previous) / previous) * 100);
    if (change === 0) return { text: '0%', tone: 'flat' };
    return { text: `${change > 0 ? '+' : ''}${change}%`, tone: change > 0 ? 'up' : 'down' };
};
