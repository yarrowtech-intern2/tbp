import React, { useState, useEffect } from 'react';
import { getActivities } from '../lib/destinations';
import { DestinationCard } from '../components/DestinationCard';
import { Search, Loader2 } from 'lucide-react';
import type { Destination } from '../lib/destinations';
import { clsx } from 'clsx';

const CATEGORIES = ['All', 'Beach', 'Adventure', 'Mountain', 'Arctic', 'Culture'];

export const Activities: React.FC = () => {
    const [activities, setActivities] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    useEffect(() => {
        getActivities().then((data: Destination[]) => {
            setActivities(data);
            setLoading(false);
        });
    }, []);

    const filteredActivities = activities.filter(dest => {
        const matchesSearch = dest.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            dest.location.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || dest.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <main style={{ backgroundColor: 'var(--bg-main)', paddingTop: '160px', paddingBottom: '120px' }} className="animate-fade">
            <div className="container">
                <div style={{ marginBottom: '6rem' }} className="responsive-header">
                    <div className="flex flex-col items-center text-center" style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', marginBottom: '1.5rem', display: 'block' }}>Collections</span>
                        <h1 className="h1" style={{ marginBottom: '2.5rem' }}>Explore our <span style={{ color: 'var(--accent)' }}>Activities</span>.</h1>
                    </div>

                    <div style={{
                        maxWidth: '800px',
                        margin: '3rem auto 0',
                        background: 'var(--surface-main)',
                        padding: '12px 12px 12px 32px',
                        borderRadius: 'var(--radius-full)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-card)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                    }} className="search-pill">
                        <Search size={20} color="var(--text-muted)" />
                        <input
                            type="text"
                            placeholder="Find your next activity..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontWeight: 500, fontSize: '1rem', color: 'var(--text-main)' }}
                        />
                        <button className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.85rem' }}>Search</button>
                    </div>
                </div>

                <div style={{ marginBottom: '3rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }} className="no-scrollbar">
                    <div className="flex gap-4 justify-center" style={{ minWidth: 'max-content', padding: '12px 0' }}>
                        {CATEGORIES.map(category => (
                            <button
                                key={category}
                                onClick={() => setSelectedCategory(category)}
                                className={clsx("btn", selectedCategory === category ? "btn-primary" : "btn-soft")}
                                style={{
                                    padding: '10px 24px',
                                    fontSize: '0.85rem',
                                    borderRadius: 'var(--radius-full)',
                                    whiteSpace: 'nowrap'
                                }}
                            >
                                {category}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center" style={{ padding: '100px 0' }}>
                        <Loader2 className="animate-spin" size={48} color="var(--primary)" />
                        <p style={{ marginTop: '1.5rem', fontWeight: 600, color: 'var(--text-muted)' }}>Curating journeys for you...</p>
                    </div>
                ) : filteredActivities.length > 0 ? (
                    <div className="grid grid-cols-4 gap-6">
                        {filteredActivities.map(activity => (
                            <DestinationCard
                                key={activity.id}
                                id={activity.id}
                                title={activity.title}
                                location={activity.location}
                                price={activity.price}
                                image_url={activity.image_url}
                                description={activity.description}
                                category={activity.category}
                                listingType="activity"
                            />
                        ))}
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '100px 0', background: 'var(--surface-main)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-light)' }}>
                        <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontWeight: 500 }}>No activities found matching your search.</p>
                        <button onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }} className="btn btn-soft" style={{ marginTop: '2rem' }}>Clear Filters</button>
                    </div>
                )}
            </div>

            <style>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                @media (max-width: 768px) {
                    main {
                        padding-top: 140px !important;
                    }
                    .responsive-header {
                        margin-bottom: 3rem !important;
                    }
                    .h1 {
                        font-size: 2rem !important;
                    }
                    .search-pill {
                        padding: 8px 8px 8px 20px !important;
                        margin-top: 2rem !important;
                        gap: 12px !important;
                    }
                    .search-pill input {
                        font-size: 0.9rem !important;
                    }
                    .search-pill .btn {
                        padding: 8px 16px !important;
                        font-size: 0.75rem !important;
                    }
                    .grid-cols-4 {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>
        </main>
    );
};
