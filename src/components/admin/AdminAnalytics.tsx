import React, { useEffect, useState } from 'react';
import { Database, Download, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import {
    ANALYTICS_RANGES,
    AnalyticsNotReadyError,
    buildAnalyticsCsv,
    fetchAdminAnalyticsSummary,
    formatCompact,
    formatFull,
    percentChange,
    type AnalyticsRangeKey,
    type AnalyticsSummary,
    type AnalyticsTotals,
} from '../../lib/adminAnalytics';
import { BarList, Donut, Funnel, Heatmap, TrendChart, type DailyMetricKey } from './analytics/charts';
import './admin-analytics.css';

type KpiKey = Exclude<DailyMetricKey, never> & keyof AnalyticsTotals;

const KPIS: Array<{ key: KpiKey; label: string; desc: string; color: string }> = [
    { key: 'visitors', label: 'Unique visitors', desc: 'People who opened the site', color: '#6366f1' },
    { key: 'page_views', label: 'Page views', desc: 'Every page opened by visitors', color: '#0ea5e9' },
    { key: 'link_visits', label: 'Link visits', desc: 'Arrived through a coupon or campaign link', color: '#f59e0b' },
    { key: 'clicks', label: 'Clicks', desc: 'Buttons and links tapped', color: '#ec4899' },
    { key: 'logins', label: 'Logins', desc: 'Successful sign-ins', color: '#10b981' },
    { key: 'signups', label: 'Sign-ups', desc: 'New accounts created', color: '#8b5cf6' },
    { key: 'listing_views', label: 'Listing views', desc: 'Tour, activity and guide pages opened', color: '#14b8a6' },
    { key: 'booking_starts', label: 'Booking attempts', desc: 'Visitors who pressed Book on a listing', color: '#f97316' },
];

const TOOLTIP_METRICS = [
    { key: 'visitors' as const, label: 'Visitors', color: '#6366f1' },
    { key: 'page_views' as const, label: 'Page views', color: '#0ea5e9' },
    { key: 'clicks' as const, label: 'Clicks', color: '#ec4899' },
    { key: 'logins' as const, label: 'Logins', color: '#10b981' },
];

const DEVICE_COLORS: Record<string, string> = { mobile: '#6366f1', desktop: '#0ea5e9', tablet: '#f59e0b' };

interface AnalyticsState {
    data: AnalyticsSummary | null;
    loading: boolean;
    error: string | null;
    notReady: boolean;
    updatedAt: Date | null;
}

const Delta: React.FC<{ current: number; previous: number; label: string }> = ({ current, previous, label }) => {
    const change = percentChange(current, previous);
    if (change === null) return <span className="an-delta is-new" title={`New compared with ${label}`}>New</span>;
    if (Math.abs(change) < 0.5) return <span className="an-delta is-flat" title={`Unchanged vs ${label}`}>0%</span>;
    const up = change > 0;
    return (
        <span className={`an-delta ${up ? 'is-up' : 'is-down'}`} title={`${up ? 'Up' : 'Down'} vs ${label}`}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(Math.round(change))}%
        </span>
    );
};

const pageLabel = (path: string) => (path === '/' ? 'Home' : path);

interface AdminAnalyticsProps {
    fetchSummary?: (range: AnalyticsRangeKey) => Promise<AnalyticsSummary>;
}

export const AdminAnalytics: React.FC<AdminAnalyticsProps> = ({ fetchSummary = fetchAdminAnalyticsSummary }) => {
    const [range, setRange] = useState<AnalyticsRangeKey>('7d');
    const [metric, setMetric] = useState<KpiKey>('visitors');
    const [reloadKey, setReloadKey] = useState(0);
    const [state, setState] = useState<AnalyticsState>({ data: null, loading: true, error: null, notReady: false, updatedAt: null });

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setState((current) => ({ ...current, loading: true, error: null }));
            try {
                const data = await fetchSummary(range);
                if (!cancelled) setState({ data, loading: false, error: null, notReady: false, updatedAt: new Date() });
            } catch (error) {
                if (cancelled) return;
                setState((current) => ({
                    ...current,
                    loading: false,
                    notReady: error instanceof AnalyticsNotReadyError,
                    error: error instanceof Error ? error.message : 'Could not load analytics.',
                }));
            }
        };

        void load();
        return () => { cancelled = true; };
    }, [range, reloadKey, fetchSummary]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') setReloadKey((key) => key + 1);
        }, 30000);
        return () => window.clearInterval(interval);
    }, []);

    const { data, loading, error, notReady, updatedAt } = state;
    const rangeDays = ANALYTICS_RANGES.find((item) => item.key === range)?.days ?? 7;
    const previousLabel = `the previous ${rangeDays} days`;
    const activeKpi = KPIS.find((item) => item.key === metric) || KPIS[0];


    const exportCsv = () => {
        if (!data) return;
        const blob = new Blob([buildAnalyticsCsv(data.daily)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const totals = data?.totals;
    const returning = totals?.returning_visitors ?? 0;
    const newVisitors = Math.max((totals?.visitors ?? 0) - returning, 0);
    const hasNoTraffic = Boolean(data) && (totals?.visitors ?? 0) === 0;

    return (
        <div className="an" aria-busy={loading}>
            <header className="an-header">
                <div className="an-title">
                    <h2>Analytics</h2>
                    <p>Traffic, link visits, clicks and logins. Admin, provider and dashboard pages are excluded.</p>
                </div>

                <div className="an-controls">
                    <span className={`an-live${data && data.active_now > 0 ? ' is-on' : ''}`} role="status">
                        <i aria-hidden="true" />
                        {data ? `${formatFull(data.active_now)} online now` : 'Connecting'}
                    </span>

                    <div className="an-segmented" role="group" aria-label="Date range">
                        {ANALYTICS_RANGES.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                className={item.key === range ? 'is-active' : ''}
                                aria-pressed={item.key === range}
                                onClick={() => setRange(item.key)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <button type="button" className="an-icon-btn" onClick={() => setReloadKey((key) => key + 1)} aria-label="Refresh analytics" title="Refresh">
                        <RefreshCw size={16} className={loading ? 'an-spin' : ''} />
                    </button>
                    <button type="button" className="an-icon-btn" onClick={exportCsv} disabled={!data} aria-label="Export daily data as CSV" title="Export CSV">
                        <Download size={16} />
                    </button>
                </div>
            </header>

            {notReady && (
                <section className="an-card an-state" role="alert">
                    <Database size={28} />
                    <h3>Analytics isn't set up in your database yet</h3>
                    <p>Run the migration below in the Supabase SQL editor, then refresh. Tracking starts as soon as it is applied.</p>
                    <code>supabase/migrations/202609260002_create_analytics_events.sql</code>
                </section>
            )}

            {error && !notReady && (
                <section className="an-card an-state an-state--error" role="alert">
                    <h3>Couldn't load analytics</h3>
                    <p>{error}</p>
                    <button type="button" className="an-primary-btn" onClick={() => setReloadKey((key) => key + 1)}>Try again</button>
                </section>
            )}

            {!notReady && (
                <div className={`an-content${loading && data ? ' is-refreshing' : ''}`}>
                    {!data && loading && (
                        <div className="an-skeletons" aria-hidden="true">
                            <div className="an-kpis">
                                {Array.from({ length: 8 }, (_, index) => <div className="an-skel an-skel--kpi" key={index} />)}
                            </div>
                            <div className="an-skel an-skel--chart" />
                        </div>
                    )}

                    {data && totals && (
                        <>
                            {hasNoTraffic && (
                                <section className="an-card an-state an-state--soft">
                                    <h3>No visits recorded in this period</h3>
                                    <p>Data appears here as people browse the site. Visits to admin, provider and dashboard pages are never counted.</p>
                                </section>
                            )}

                            <section className="an-kpis" aria-label="Key metrics">
                                {KPIS.map((kpi, index) => {
                                    const selected = kpi.key === metric;
                                    return (
                                        <button
                                            type="button"
                                            key={kpi.key}
                                            className={`an-kpi${selected ? ' is-selected' : ''}`}
                                            style={{ ['--kpi' as string]: kpi.color, ['--i' as string]: index }}
                                            aria-pressed={selected}
                                            onClick={() => setMetric(kpi.key)}
                                        >
                                            <span className="an-kpi-label">{kpi.label}</span>
                                            <span className="an-kpi-main">
                                                <strong title={formatFull(totals[kpi.key] ?? 0)}>{formatCompact(totals[kpi.key] ?? 0)}</strong>
                                                <Delta current={totals[kpi.key] ?? 0} previous={data.previous[kpi.key] ?? 0} label={previousLabel} />
                                            </span>
                                            <span className="an-kpi-desc">{kpi.desc}</span>
                                        </button>
                                    );
                                })}
                            </section>

                            <section className="an-card an-trend">
                                <div className="an-card-head">
                                    <div>
                                        <h3>{activeKpi.label} over time</h3>
                                        <p>{formatFull(totals[activeKpi.key] ?? 0)} in the last {rangeDays} days</p>
                                    </div>
                                    <div className="an-chips" role="group" aria-label="Chart metric">
                                        {KPIS.map((kpi) => (
                                            <button
                                                key={kpi.key}
                                                type="button"
                                                className={kpi.key === metric ? 'is-active' : ''}
                                                style={{ ['--kpi' as string]: kpi.color }}
                                                aria-pressed={kpi.key === metric}
                                                onClick={() => setMetric(kpi.key)}
                                            >
                                                {kpi.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <TrendChart
                                    days={data.daily}
                                    metric={metric}
                                    color={activeKpi.color}
                                    label={activeKpi.label}
                                    tooltipMetrics={TOOLTIP_METRICS}
                                />
                            </section>

                            <div className="an-grid an-grid--2">
                                <section className="an-card">
                                    <div className="an-card-head">
                                        <div>
                                            <h3>Conversion funnel</h3>
                                            <p>How visitors move from landing to booking</p>
                                        </div>
                                    </div>
                                    <Funnel
                                        steps={[
                                            { label: 'Visited the site', value: data.funnel.visited, color: '#6366f1' },
                                            { label: 'Viewed a listing', value: data.funnel.viewed_listing, color: '#0ea5e9' },
                                            { label: 'Logged in or signed up', value: data.funnel.authenticated, color: '#10b981' },
                                            { label: 'Started a booking', value: data.funnel.started_booking, color: '#f97316' },
                                        ]}
                                    />
                                </section>

                                <section className="an-card">
                                    <div className="an-card-head">
                                        <div>
                                            <h3>Audience</h3>
                                            <p>Devices and returning visitors</p>
                                        </div>
                                    </div>
                                    <Donut
                                        centerLabel="visitors"
                                        items={data.devices.map((item) => ({
                                            label: item.device.charAt(0).toUpperCase() + item.device.slice(1),
                                            value: item.visitors,
                                            color: DEVICE_COLORS[item.device] || '#94a3b8',
                                        }))}
                                    />
                                    <div className="an-split">
                                        <div><span>New</span><b>{formatFull(newVisitors)}</b></div>
                                        <div><span>Returning</span><b>{formatFull(returning)}</b></div>
                                        <div><span>Signed in</span><b>{formatFull(totals.signed_in_visitors ?? 0)}</b></div>
                                        <div><span>Sessions</span><b>{formatFull(totals.sessions)}</b></div>
                                    </div>
                                </section>
                            </div>

                            <div className="an-grid an-grid--auto">
                                <section className="an-card">
                                    <div className="an-card-head"><div><h3>Top pages</h3><p>By page views</p></div></div>
                                    <BarList
                                        color="#6366f1"
                                        empty="No page views yet."
                                        items={data.top_pages.map((item) => ({ label: pageLabel(item.path), value: item.views, hint: `${formatFull(item.visitors)} visitors` }))}
                                    />
                                </section>
                                <section className="an-card">
                                    <div className="an-card-head"><div><h3>Traffic sources</h3><p>Where visitors come from</p></div></div>
                                    <BarList
                                        color="#0ea5e9"
                                        empty="No traffic sources yet."
                                        items={data.top_sources.map((item) => ({ label: item.source, value: item.visitors }))}
                                    />
                                </section>
                                <section className="an-card">
                                    <div className="an-card-head"><div><h3>Coupon and campaign links</h3><p>Visits through shared links</p></div></div>
                                    <BarList
                                        color="#f59e0b"
                                        empty="No link visits yet. Share a coupon or ?utm_campaign= link to see it here."
                                        items={data.top_links.map((item) => ({ label: item.link, value: item.visits, hint: `${formatFull(item.visitors)} unique visitors` }))}
                                    />
                                </section>
                                <section className="an-card">
                                    <div className="an-card-head"><div><h3>Most clicked</h3><p>Buttons and links</p></div></div>
                                    <BarList
                                        color="#ec4899"
                                        empty="No clicks recorded yet."
                                        items={data.top_clicks.map((item) => ({ label: item.target, value: item.clicks }))}
                                    />
                                </section>
                            </div>

                            <section className="an-card">
                                <div className="an-card-head">
                                    <div>
                                        <h3>Peak hours</h3>
                                        <p>Page views by day and hour (your local time)</p>
                                    </div>
                                </div>
                                <Heatmap cells={data.heatmap} />
                            </section>

                            <p className="an-footnote">
                                Visitors are counted from a random anonymous browser ID. No IP address or personal data is stored, and browsers with Do Not Track enabled are skipped.
                                {updatedAt ? ` Updated ${updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}, refreshes every 30 seconds.` : ''}
                            </p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
