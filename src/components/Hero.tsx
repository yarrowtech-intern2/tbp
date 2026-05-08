import React from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Hero: React.FC = () => {
    return (
        <section className="animate-fade hero-viewport-fix" style={{
            minHeight: '80vh',
            padding: '160px 0 80px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        }}>
            <div className="container">
                <div className="flex flex-col items-center text-center" style={{ maxWidth: '800px', margin: '0 auto 32px' }}>
                    <div className="flex items-center gap-2" style={{ marginBottom: '1rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--accent)' }}>Collection 2024</span>
                        <div style={{ width: '1px', height: '12px', background: 'var(--border-light)' }}></div>
                        <span style={{ fontWeight: 600, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Curated by Vagabond</span>
                    </div>

                    <h1 className="h1" style={{ marginBottom: '1.25rem', fontSize: 'clamp(2.5rem, 7vw, 4rem)' }}>
                        Curated experiences for the <span style={{ color: 'var(--accent)' }}>curious</span>.
                    </h1>

                    <p style={{ marginBottom: '2.5rem', color: 'var(--text-muted)', maxWidth: '540px', fontSize: '1.05rem', lineHeight: '1.6' }}>
                        Escape the ordinary with our collection of hand-picked destinations designed for those who seek the unconventional.
                    </p>

                    <div className="flex items-center gap-4 hero-actions">
                        <Link to="/tours" className="btn btn-primary" style={{ padding: '14px 32px' }}>
                            Explore Journeys <Search size={16} />
                        </Link>
                        <Link to="/auth" className="btn btn-soft" style={{ padding: '14px 32px' }}>
                            Join Membership <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>

                {/* Hero Image Box - Optimized Viewport */}
                <div className="hero-img-box" style={{
                    width: '100%',
                    height: '42vh',
                    maxHeight: '480px',
                    borderRadius: 'var(--radius-xl)',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-card)'
                }}>
                    <img
                        src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=2000"
                        alt="Serene Lake"
                        className="img-cover"
                        style={{ filter: 'grayscale(0.1) contrast(1.1)' }}
                    />
                </div>
            </div>

            <style>{`
                @media (max-width: 768px) {
                    .hero-viewport-fix {
                        padding-top: 140px !important;
                        min-height: auto !important;
                    }
                    .h1 {
                        font-size: 2.15rem !important;
                    }
                    .hero-img-box {
                        height: 220px !important;
                        margin-top: 32px !important;
                    }
                    .hero-actions {
                        flex-direction: column;
                        width: 100%;
                        gap: 12px;
                    }
                    .btn {
                        width: 100%;
                        justify-content: center;
                    }
                }
            `}</style>
        </section>
    );
};
