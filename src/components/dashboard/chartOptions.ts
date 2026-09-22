import type { EChartsCoreOption } from 'echarts/core';
import {
    formatChartAxisValue,
    formatChartValue,
    type ChartBucket,
    type ChartUnit,
} from './chartData';

export type ChartTheme = 'light' | 'dark';

export type ChartPalette = {
    accent: string;
    text: string;
    textStrong: string;
    grid: string;
    neutral: string;
    tooltipBg: string;
    tooltipText: string;
    surface: string;
};

// The dashboard CSS variables are scoped to the dashboard shell, so the palette is resolved from the
// theme key instead of reading computed styles off <html>.
export const getChartPalette = (theme: ChartTheme): ChartPalette => (
    theme === 'dark'
        ? {
            accent: '#ff6700',
            text: '#a9aeb8',
            textStrong: '#f7f8fb',
            grid: 'rgba(255, 255, 255, 0.09)',
            neutral: '#4a4d59',
            tooltipBg: '#f3f4f6',
            tooltipText: '#111216',
            surface: '#121216',
        }
        : {
            accent: '#ff6700',
            text: '#4d4f55',
            textStrong: '#111114',
            grid: 'rgba(20, 20, 22, 0.1)',
            neutral: '#b7b7bd',
            tooltipBg: '#111114',
            tooltipText: '#f5f5f5',
            surface: '#f2f2f3',
        }
);

const CHART_FONT_FAMILY = "'Onest', 'Outfit', system-ui, sans-serif";

type SeriesOptionInput = {
    buckets: ChartBucket[];
    unit: ChartUnit;
    valueLabel: string;
    theme: ChartTheme;
    /** Compact = the small card version (fewer labels, tighter padding). */
    compact: boolean;
};

const baseTooltip = (palette: ChartPalette) => ({
    confine: true,
    backgroundColor: palette.tooltipBg,
    borderWidth: 0,
    padding: [8, 12],
    textStyle: { color: palette.tooltipText, fontSize: 12 },
    extraCssText: 'border-radius: 12px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);',
});

const seriesTooltipFormatter = (buckets: ChartBucket[], unit: ChartUnit, valueLabel: string) => (params: unknown) => {
    const first = Array.isArray(params) ? params[0] : params;
    const index = (first as { dataIndex?: number } | undefined)?.dataIndex ?? 0;
    const bucket = buckets[index];
    if (!bucket) return '';
    return `<div style="font-weight:600;margin-bottom:2px">${bucket.tooltipLabel}</div>`
        + `<div>${valueLabel}: <b>${formatChartValue(unit, bucket.value)}</b></div>`;
};

const cartesianAxes = (input: SeriesOptionInput, palette: ChartPalette) => {
    const { buckets, unit, compact } = input;
    const manyLabels = buckets.length > 14;
    return {
        grid: {
            top: compact ? 30 : 28,
            right: compact ? 6 : 12,
            bottom: 2,
            left: 4,
            containLabel: true,
        },
        xAxis: {
            type: 'category' as const,
            data: buckets.map((bucket) => bucket.label),
            axisTick: { show: false },
            axisLine: { show: false },
            axisLabel: {
                color: palette.text,
                fontWeight: 600,
                fontSize: compact ? 11 : 12,
                margin: 12,
                hideOverlap: true,
                interval: manyLabels ? 'auto' as const : 0,
            },
        },
        yAxis: {
            type: 'value' as const,
            minInterval: unit === 'count' ? 1 : undefined,
            splitNumber: compact ? 3 : 4,
            axisLine: { show: false },
            axisTick: { show: false },
            splitLine: { lineStyle: { color: palette.grid } },
            axisLabel: {
                color: palette.text,
                fontSize: 11,
                formatter: (value: number) => formatChartAxisValue(unit, value),
            },
        },
    };
};

export const buildBarOption = (input: SeriesOptionInput): EChartsCoreOption => {
    const palette = getChartPalette(input.theme);
    const { buckets, unit, valueLabel, compact } = input;
    const lastIndex = buckets.length - 1;
    const showValueLabels = buckets.length <= 12;

    return {
        animationDuration: 450,
        textStyle: { fontFamily: CHART_FONT_FAMILY },
        ...cartesianAxes(input, palette),
        tooltip: {
            ...baseTooltip(palette),
            trigger: 'axis',
            axisPointer: { type: 'shadow', shadowStyle: { color: palette.grid } },
            formatter: seriesTooltipFormatter(buckets, unit, valueLabel),
        },
        series: [{
            type: 'bar',
            barMaxWidth: compact ? 34 : 48,
            data: buckets.map((bucket, index) => ({
                value: bucket.value,
                itemStyle: {
                    color: index === lastIndex ? palette.accent : palette.neutral,
                    borderRadius: [8, 8, 0, 0],
                },
            })),
            label: {
                show: showValueLabels,
                position: 'top',
                color: palette.textStrong,
                fontSize: 11,
                fontWeight: 600,
                formatter: (params: { value: number }) => (params.value > 0 ? formatChartAxisValue(unit, params.value) : ''),
            },
            emphasis: { itemStyle: { color: palette.accent } },
        }],
    };
};

export const buildLineOption = (input: SeriesOptionInput): EChartsCoreOption => {
    const palette = getChartPalette(input.theme);
    const { buckets, unit, valueLabel } = input;
    const showSymbols = buckets.length <= 14;

    return {
        animationDuration: 450,
        textStyle: { fontFamily: CHART_FONT_FAMILY },
        ...cartesianAxes(input, palette),
        tooltip: {
            ...baseTooltip(palette),
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: palette.grid, width: 2 } },
            formatter: seriesTooltipFormatter(buckets, unit, valueLabel),
        },
        series: [{
            type: 'line',
            smooth: 0.25,
            showSymbol: showSymbols,
            symbol: 'circle',
            symbolSize: 8,
            data: buckets.map((bucket) => bucket.value),
            lineStyle: { color: palette.accent, width: 3, cap: 'round', join: 'round' },
            itemStyle: { color: palette.textStrong, borderColor: palette.accent, borderWidth: 2 },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [
                        { offset: 0, color: 'rgba(255, 103, 0, 0.28)' },
                        { offset: 1, color: 'rgba(255, 103, 0, 0)' },
                    ],
                },
            },
            emphasis: { scale: 1.4 },
        }],
    };
};

export type DonutSlice = { key: string; label: string; value: number; color: string };

type DonutOptionInput = {
    slices: DonutSlice[];
    total: number;
    theme: ChartTheme;
    compact: boolean;
};

export const buildDonutOption = ({ slices, total, theme, compact }: DonutOptionInput): EChartsCoreOption => {
    const palette = getChartPalette(theme);
    const visible = slices.filter((slice) => slice.value > 0);
    const data = visible.length > 0
        ? visible.map((slice) => ({ name: slice.label, value: slice.value, itemStyle: { color: slice.color } }))
        : [{ name: 'No data', value: 1, itemStyle: { color: palette.neutral }, tooltip: { show: false } }];

    return {
        animationDuration: 450,
        textStyle: { fontFamily: CHART_FONT_FAMILY },
        tooltip: {
            ...baseTooltip(palette),
            trigger: 'item',
            formatter: (params: { name: string; value: number; percent: number }) => (
                `<div style="font-weight:600">${params.name}</div><div><b>${params.value}</b> (${Math.round(params.percent)}%)</div>`
            ),
        },
        title: {
            text: String(total),
            left: 'center',
            top: 'center',
            textStyle: {
                color: palette.textStrong,
                fontSize: compact ? 16 : 34,
                fontWeight: 800,
            },
        },
        series: [{
            type: 'pie',
            radius: compact ? ['66%', '100%'] : ['62%', '92%'],
            center: ['50%', '50%'],
            avoidLabelOverlap: true,
            padAngle: visible.length > 1 ? 2 : 0,
            itemStyle: { borderRadius: compact ? 4 : 8, borderColor: palette.surface, borderWidth: compact ? 0 : 2 },
            label: { show: false },
            labelLine: { show: false },
            emphasis: { scaleSize: compact ? 3 : 6 },
            data,
        }],
    };
};
