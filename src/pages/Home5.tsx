import React from 'react';
import { Globe } from '../components/ui/globe';
import './home5.css';

export const Home5: React.FC = () => {
  return (
    <main className="home5-page">
      <section className="home5-hero">
        <div className="home5-hero-shell">
          <div className="home5-copy">
            <h1 className="home5-title">The Betterpass</h1>
            <h2 className="home5-subtitle">
              <span>travel made</span>
              <span>simple</span>
            </h2>
          </div>

          <div className="home5-globe-stage" aria-hidden="true">
            <div className="home5-globe-ground" />
            <Globe className="home5-globe" />
            <div className="home5-globe-fade" />
          </div>
        </div>
      </section>
    </main>
  );
};
