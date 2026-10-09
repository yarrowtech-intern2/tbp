import React from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { PLACE_CATEGORIES } from '../../lib/providerPlaces';
import {
    LANDMARK_CATEGORIES,
    LANDMARK_ZONES,
    type LandmarkCategoryKey,
    type LandmarkZone,
} from '../../lib/kolkataLandmarks';

interface LandmarkLayerControlProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
    zone: LandmarkZone | 'All';
    onZoneChange: (zone: LandmarkZone | 'All') => void;
    hiddenCategories: Set<LandmarkCategoryKey>;
    onToggleCategory: (key: LandmarkCategoryKey) => void;
    onReset: () => void;
    zoneCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
    total: number;
    /** True while a detail sheet or panel is open; on phones the control steps aside so it never covers the sheet. */
    covered: boolean;
    /** Extra buttons shown next to the toggle (the map download). */
    actions?: React.ReactNode;
    /** Provider business pins (restaurants, hotels, workshops). */
    placesEnabled: boolean;
    onPlacesEnabledChange: (enabled: boolean) => void;
    placesCount: number;
}

export const LandmarkLayerControl: React.FC<LandmarkLayerControlProps> = ({
    open,
    onOpenChange,
    enabled,
    onEnabledChange,
    zone,
    onZoneChange,
    hiddenCategories,
    onToggleCategory,
    onReset,
    zoneCounts,
    categoryCounts,
    total,
    covered,
    actions,
    placesEnabled,
    onPlacesEnabledChange,
    placesCount,
}) => (
    <section className={`map2-landmarks${covered ? ' is-covered' : ''}`} aria-label="Famous places filter">
        {open ? (
            <div className="map2-landmarks-panel">
                <div className="map2-landmarks-head">
                    <label className="map2-puja-switch map2-landmarks-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            checked={enabled}
                            onChange={(event) => onEnabledChange(event.target.checked)}
                        />
                        <span className="map2-puja-switch-track" aria-hidden="true"><span /></span>
                        <span>Show famous places</span>
                    </label>
                    <button type="button" className="map2-landmarks-reset" onClick={onReset} aria-label="Reset filters" title="Reset filters">
                        <RotateCcw size={15} />
                    </button>
                </div>

                <div className="map2-landmarks-zones" role="group" aria-label="Area of the city">
                    {(['All', ...LANDMARK_ZONES] as Array<LandmarkZone | 'All'>).map((item) => (
                        <button
                            key={item}
                            type="button"
                            className={zone === item ? 'is-active' : ''}
                            aria-pressed={zone === item}
                            onClick={() => onZoneChange(item)}
                        >
                            {item}
                            <small>{item === 'All' ? Object.values(zoneCounts).reduce((sum, value) => sum + value, 0) : zoneCounts[item] || 0}</small>
                        </button>
                    ))}
                </div>

                <div className="map2-landmarks-cats" role="group" aria-label="Place categories">
                    {LANDMARK_CATEGORIES.map((category) => {
                        const count = categoryCounts[category.key] || 0;
                        const hidden = hiddenCategories.has(category.key);
                        return (
                            <button
                                key={category.key}
                                type="button"
                                className={hidden ? 'is-off' : ''}
                                style={{ ['--cat-color' as string]: category.color }}
                                aria-pressed={!hidden}
                                disabled={count === 0}
                                onClick={() => onToggleCategory(category.key)}
                            >
                                <i aria-hidden="true">{category.emoji}</i>
                                <span>{category.label}</span>
                                <small>{count}</small>
                            </button>
                        );
                    })}
                </div>

                <div className="map2-landmarks-places">
                    <label className="map2-puja-switch map2-landmarks-switch">
                        <input
                            type="checkbox"
                            role="switch"
                            checked={placesEnabled}
                            onChange={(event) => onPlacesEnabledChange(event.target.checked)}
                        />
                        <span className="map2-puja-switch-track" aria-hidden="true"><span /></span>
                        <span>Local businesses <small>{placesCount}</small></span>
                    </label>
                    {placesEnabled ? (
                        <ul className="map2-landmarks-legend" aria-label="Pin colours">
                            {PLACE_CATEGORIES.map((category) => (
                                <li key={category.key} style={{ ['--cat-color' as string]: category.color }}>
                                    <i aria-hidden="true" />
                                    {category.label}
                                </li>
                            ))}
                        </ul>
                    ) : null}
                </div>

                <p className="map2-landmarks-hint">Zoom in to see more places. Locations come from OpenStreetMap.</p>
            </div>
        ) : null}

        <div className="map2-landmarks-row">
            <button
                type="button"
                className="map2-landmarks-toggle"
                onClick={() => onOpenChange(!open)}
                aria-expanded={open}
            >
                <span aria-hidden="true">📍</span>
                <span>Famous places</span>
                <small>{enabled ? total : 'off'}</small>
                <ChevronDown size={15} className={open ? 'is-open' : ''} aria-hidden="true" />
            </button>
            {actions}
        </div>
    </section>
);
