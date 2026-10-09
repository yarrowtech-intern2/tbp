import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MapPinned, Pencil, Plus, Trash2 } from 'lucide-react';
import {
    PLACE_CATEGORIES,
    createPlace,
    deletePlace,
    fetchMyPlaces,
    getPlaceCategory,
    getPlaceDisplayLabel,
    updatePlace,
    type PlaceCategory,
    type ProviderPlace,
    type ProviderPlaceInput,
} from '../../lib/providerPlaces';
import './provider-map.css';

const LazyPlacePicker = lazy(async () => ({ default: (await import('../map/PlacePicker')).PlacePicker }));

type PlaceDraft = {
    name: string;
    category: PlaceCategory;
    custom_label: string;
    description: string;
    address: string;
    position: { lat: number; lng: number } | null;
};

const EMPTY_DRAFT: PlaceDraft = { name: '', category: 'restaurant', custom_label: '', description: '', address: '', position: null };

const draftFromPlace = (place: ProviderPlace): PlaceDraft => ({
    name: place.name,
    category: place.category,
    custom_label: place.custom_label,
    description: place.description,
    address: place.address,
    position: { lat: place.lat, lng: place.lng },
});

/**
 * Dashboard and studio section: providers pin their business locations (restaurant, hotel, workshop...).
 * Pins are public on /map straight away; a pin tied to a listing becomes public once that listing is live.
 */
export const ProviderMapPanel: React.FC<{ userId: string }> = ({ userId }) => {
    const [places, setPlaces] = useState<ProviderPlace[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | 'new' | null>(null);
    const [draft, setDraft] = useState<PlaceDraft>(EMPTY_DRAFT);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState('');

    const load = useCallback(async () => {
        try {
            setPlaces(await fetchMyPlaces(userId));
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Could not load your pins.');
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        void load();
    }, [load]);

    const startNew = () => {
        setDraft(EMPTY_DRAFT);
        setEditingId('new');
        setStatus('');
    };

    const startEdit = (place: ProviderPlace) => {
        setDraft(draftFromPlace(place));
        setEditingId(place.id);
        setStatus('');
    };

    const cancel = () => {
        setEditingId(null);
        setStatus('');
    };

    const update = <K extends keyof PlaceDraft>(key: K, value: PlaceDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));

    const handleSave = async (event: React.FormEvent) => {
        event.preventDefault();
        if (draft.name.trim().length < 2) {
            setStatus('Add the name tourists should see.');
            return;
        }
        if (!draft.position) {
            setStatus('Drop the pin on the map first.');
            return;
        }
        const input: ProviderPlaceInput = {
            name: draft.name,
            category: draft.category,
            custom_label: draft.custom_label,
            description: draft.description,
            address: draft.address,
            lat: draft.position.lat,
            lng: draft.position.lng,
        };
        setSaving(true);
        setStatus('Saving...');
        try {
            if (editingId && editingId !== 'new') {
                const saved = await updatePlace(editingId, input);
                setPlaces((current) => current.map((item) => (item.id === saved.id ? saved : item)));
                setStatus('Pin updated.');
            } else {
                const saved = await createPlace(userId, input);
                setPlaces((current) => [saved, ...current]);
                setStatus('Pin is live on the public map.');
            }
            setEditingId(null);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Could not save the pin.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (place: ProviderPlace) => {
        if (!window.confirm(`Remove "${place.name}" from the map?`)) return;
        try {
            await deletePlace(place.id);
            setPlaces((current) => current.filter((item) => item.id !== place.id));
            if (editingId === place.id) setEditingId(null);
        } catch (error) {
            setStatus(error instanceof Error ? error.message : 'Could not remove the pin.');
        }
    };

    if (loading) {
        return <div className="rdb-loading"><Loader2 size={28} className="animate-spin" /><p>Loading your map pins…</p></div>;
    }

    return (
        <div className="pmp">
            <section className="pmp-card">
                <header className="pmp-head">
                    <div>
                        <h3>My map pins</h3>
                        <p>Pin your restaurant, hotel or workshop. Pins show on the public map with a colour for each category.</p>
                    </div>
                    {editingId === null ? (
                        <button type="button" className="pmp-primary" onClick={startNew}>
                            <Plus size={16} /> Add pin
                        </button>
                    ) : null}
                </header>

                {editingId !== null ? (
                    <form className="pmp-form" onSubmit={(event) => void handleSave(event)}>
                        <label>
                            <span>Place name</span>
                            <input
                                value={draft.name}
                                maxLength={80}
                                placeholder="e.g. Kumartuli Clay Studio"
                                onChange={(event) => update('name', event.target.value)}
                                required
                            />
                        </label>

                        <div className="pmp-field" role="group" aria-label="Pin category">
                            <span>Category (sets the pin colour)</span>
                            <div className="pmp-cats">
                                {PLACE_CATEGORIES.map((category) => (
                                    <button
                                        key={category.key}
                                        type="button"
                                        className={draft.category === category.key ? 'is-active' : ''}
                                        style={{ ['--pin-color' as string]: category.color }}
                                        aria-pressed={draft.category === category.key}
                                        onClick={() => update('category', category.key)}
                                    >
                                        <i aria-hidden="true"><category.Icon size={14} /></i>
                                        <span>{category.label}</span>
                                    </button>
                                ))}
                            </div>
                            {draft.category === 'other' ? (
                                <input
                                    value={draft.custom_label}
                                    maxLength={40}
                                    placeholder="Name your category, e.g. Yoga studio"
                                    onChange={(event) => update('custom_label', event.target.value)}
                                    aria-label="Custom category name"
                                />
                            ) : null}
                        </div>

                        <label>
                            <span>About this place (optional)</span>
                            <textarea
                                rows={3}
                                value={draft.description}
                                maxLength={500}
                                placeholder="Special menu, opening hours, what guests can do here"
                                onChange={(event) => update('description', event.target.value)}
                            />
                        </label>

                        <label>
                            <span>Address (optional)</span>
                            <input
                                value={draft.address}
                                maxLength={200}
                                onChange={(event) => update('address', event.target.value)}
                            />
                        </label>

                        <div className="pmp-field">
                            <span>Location</span>
                            <Suspense fallback={<div className="pmp-map-loading"><Loader2 size={22} className="animate-spin" /></div>}>
                                <LazyPlacePicker
                                    value={draft.position}
                                    category={draft.category}
                                    onChange={(position, address) => setDraft((current) => ({
                                        ...current,
                                        position,
                                        address: address && !current.address.trim() ? address.slice(0, 200) : current.address,
                                    }))}
                                />
                            </Suspense>
                        </div>

                        <div className="pmp-actions">
                            <button type="submit" className="pmp-primary" disabled={saving}>
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
                                {editingId === 'new' ? 'Publish pin' : 'Save changes'}
                            </button>
                            <button type="button" className="pmp-ghost" onClick={cancel}>Cancel</button>
                        </div>
                    </form>
                ) : null}

                {status ? <p className="pmp-status" role="status">{status}</p> : null}
            </section>

            <section className="pmp-card">
                <header className="pmp-head">
                    <div>
                        <h3>Your pins</h3>
                        <p>{places.length ? `${places.length} pinned. Tourists see them on the public map.` : 'No pins yet. Add your first location.'}</p>
                    </div>
                    <Link to="/map" className="pmp-ghost">View public map</Link>
                </header>

                <ul className="pmp-list">
                    {places.map((place) => {
                        const category = getPlaceCategory(place.category);
                        return (
                            <li key={place.id} style={{ ['--pin-color' as string]: category.color }}>
                                <i className="pmp-dot" aria-hidden="true"><category.Icon size={15} /></i>
                                <div className="pmp-list-main">
                                    <strong>{place.name}</strong>
                                    <span>
                                        {getPlaceDisplayLabel(place)}
                                        {place.listing_id ? ' · Listing pin' : ''}
                                        {place.is_hidden ? ' · Hidden by admin' : ''}
                                    </span>
                                    {place.address ? <small>{place.address}</small> : null}
                                </div>
                                <div className="pmp-list-actions">
                                    <button type="button" onClick={() => startEdit(place)} aria-label={`Edit ${place.name}`}>
                                        <Pencil size={15} />
                                    </button>
                                    <button type="button" onClick={() => void handleDelete(place)} aria-label={`Remove ${place.name}`}>
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
};
