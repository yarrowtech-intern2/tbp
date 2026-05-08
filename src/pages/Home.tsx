import React, { useState, useEffect } from 'react';
import { Hero } from '../components/Hero';
import { Link } from 'react-router-dom';
import { getActivities } from '../lib/destinations';
import { DestinationCard } from '../components/DestinationCard';
import type { Destination } from '../lib/destinations';
import { ChevronRight, ArrowRight, Loader2 } from 'lucide-react';

export const Home: React.FC = () => {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getActivities().then((data: Destination[]) => {
            setDestinations(data.slice(0, 4));
            setLoading(false);
        });
    }, []);

    return (
        <main style={{ backgroundColor: 'var(--bg-main)', paddingBottom: '120px' }} className="animate-fade">
            <Hero />

            {/* Featured Section */}
            <section style={{ padding: '120px 0' }} className="responsive-section">
                <div className="container">
                    <div className="flex flex-col items-start gap-4" style={{ marginBottom: '5rem' }}>
                        <div className="flex items-center gap-3">
                            <span style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)' }}>Selected Journeys</span>
                            <div style={{ width: '1px', height: '12px', background: 'var(--border-light)' }}></div>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top Rated</span>
                        </div>
                        <div className="flex justify-between items-end" style={{ width: '100%' }}>
                            <h2 className="h2" style={{ maxWidth: '600px' }}>
                                Hand-picked escapes for the <span style={{ color: 'var(--accent)' }}>modern explorer</span>.
                            </h2>
                            <Link to="/activities" className="btn btn-soft nav-desktop">
                                Explore All <ArrowRight size={18} />
                            </Link>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center" style={{ padding: '80px 0' }}>
                            <Loader2 className="animate-spin" size={40} color="var(--primary)" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-6">
                            {destinations.map(destination => (
                                <DestinationCard
                                    key={destination.id}
                                    id={destination.id}
                                    title={destination.title}
                                    location={destination.location}
                                    price={destination.price}
                                    image_url={destination.image_url}
                                    description={destination.description}
                                    category={destination.category}
                                    listingType="activity"
                                />
                            ))}
                        </div>
                    )}

                    <div className="nav-mobile flex justify-center" style={{ marginTop: '4rem' }}>
                        <Link to="/activities" className="btn btn-primary" style={{ width: '100%' }}>
                            Explore All Journeys <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Editorial Story Section */}
            <section style={{ padding: '80px 0' }} className="responsive-section">
                <div className="container">
                    <div style={{
                        background: 'var(--surface-main)',
                        padding: '6rem',
                        borderRadius: 'var(--radius-xl)',
                        border: '1px solid var(--border-light)',
                        boxShadow: 'var(--shadow-card)',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                        gap: '6rem',
                        alignItems: 'center'
                    }} className="editorial-card">
                        <div>
                            <span style={{ fontWeight: 800, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)', marginBottom: '1.5rem', display: 'block' }}>Our Philosophy</span>
                            <h3 className="h3" style={{ marginBottom: '2rem', fontSize: '2.5rem' }}>Traveling is the art of <span style={{ color: 'var(--accent)' }}>unlearning</span>.</h3>
                            <p className="text-lead" style={{ color: 'var(--text-muted)', marginBottom: '3rem', lineHeight: '1.8' }}>
                                We believe that true discovery lies not in seeing new landscapes, but in having new eyes. Our curated journeys are designed to challenge your perspectives and connect you with the soul of a destination.
                            </p>
                            <button className="btn btn-primary">
                                Read Our Story <ChevronRight size={18} />
                            </button>
                        </div>
                        <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', height: '100%', minHeight: '400px', boxShadow: 'var(--shadow-subtle)' }}>
                            <img
                                src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=2000"
                                alt="Coastal View"
                                className="img-cover"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <style>{`
                @media (max-width: 768px) {
                    .responsive-section {
                        padding: 60px 0 !important;
                    }
                    div[style*="marginBottom: '5rem'"] {
                        margin-bottom: 2.5rem !important;
                    }
                    .h2 {
                        font-size: 2rem !important;
                        margin-bottom: 0 !important;
                    }
                    .editorial-card {
                        grid-template-columns: 1fr !important;
                        padding: 3rem 2rem !important;
                        gap: 3rem !important;
                    }
                    .editorial-card h3 {
                        font-size: 1.75rem !important;
                    }
                    .editorial-card div:last-child {
                        min-height: 250px !important;
                    }
                }
            `}</style>
        </main>
    );
};
