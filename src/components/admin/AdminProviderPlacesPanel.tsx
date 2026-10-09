import React, { useCallback, useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Trash2 } from 'lucide-react';
import {
    deletePlace,
    fetchAllPlacesForAdmin,
    getPlaceCategory,
    getPlaceDisplayLabel,
    setPlaceHidden,
    type ProviderPlace,
} from '../../lib/providerPlaces';
import { supabase } from '../../lib/supabase';
import '../provider/provider-map.css';

/** Admin view of every provider pin: hide a pin from the public map or delete it. */
export const AdminProviderPlacesPanel: React.FC = () => {
    const [places, setPlaces] = useState<ProviderPlace[]>([]);
    const [owners, setOwners] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');

    const load = useCallback(async () => {
        try {
            const rows = await fetchAllPlacesForAdmin();
            setPlaces(rows);
            const ids = Array.from(new Set(rows.map((row) => row.user_id)));
            if (ids.length) {
                const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
                setOwners(Object.fromEntries((data || []).map((row) => [String(row.id), String(row.full_name || '')])));
            }
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Could not load provider pins.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const toggleHidden = async (place: ProviderPlace) => {
        try {
            await setPlaceHidden(place.id, !place.is_hidden);
            setPlaces((current) => current.map((item) => (item.id === place.id ? { ...item, is_hidden: !place.is_hidden } : item)));
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Could not update the pin.');
        }
    };

    const remove = async (place: ProviderPlace) => {
        if (!window.confirm(`Delete "${place.name}" permanently?`)) return;
        try {
            await deletePlace(place.id);
            setPlaces((current) => current.filter((item) => item.id !== place.id));
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Could not delete the pin.');
        }
    };

    return (
        <section className="rdb-panel rdb-panel-wide pmp-card">
            <header className="pmp-head">
                <div>
                    <h3>Provider pins</h3>
                    <p>Pins go public as soon as providers add them. Hide one to take it off the public map, or delete it.</p>
                </div>
                <small>{places.length} pins</small>
            </header>
            {status ? <p className="pmp-status" role="status">{status}</p> : null}
            {loading ? (
                <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading provider pins…</p></div>
            ) : places.length === 0 ? (
                <p className="rdb-empty">No provider pins yet.</p>
            ) : (
                <ul className="pmp-list">
                    {places.map((place) => {
                        const category = getPlaceCategory(place.category);
                        return (
                            <li key={place.id} style={{ ['--pin-color' as string]: category.color, opacity: place.is_hidden ? 0.6 : 1 }}>
                                <i className="pmp-dot" aria-hidden="true"><category.Icon size={15} /></i>
                                <div className="pmp-list-main">
                                    <strong>{place.name}</strong>
                                    <span>
                                        {getPlaceDisplayLabel(place)} · {owners[place.user_id] || place.user_id.slice(0, 8)}
                                        {place.listing_id ? ' · Listing pin' : ''}
                                        {place.is_hidden ? ' · Hidden' : ''}
                                    </span>
                                    {place.address ? <small>{place.address}</small> : null}
                                </div>
                                <div className="pmp-list-actions">
                                    <button type="button" onClick={() => void toggleHidden(place)} aria-label={place.is_hidden ? `Show ${place.name}` : `Hide ${place.name}`} title={place.is_hidden ? 'Show on map' : 'Hide from map'}>
                                        {place.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />}
                                    </button>
                                    <button type="button" onClick={() => void remove(place)} aria-label={`Delete ${place.name}`}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};
