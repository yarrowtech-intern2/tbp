import { forwardRef } from 'react';
import { CheckCircle2, MapPin, Search } from 'lucide-react';
import type { BookingStep } from './timelineConfig';
import { BOOKING_STEPS } from './timelineConfig';

interface BetterPassUIProps {
  step: number;
}

const stepName = (step: number): BookingStep => BOOKING_STEPS[Math.min(Math.max(step, 0), BOOKING_STEPS.length - 1)];

export const BetterPassUI = forwardRef<HTMLDivElement, BetterPassUIProps>(({ step }, ref) => {
  const current = stepName(step);

  return (
    <div ref={ref} className="cinematic-phone-ui" aria-hidden="true">
      <div className="cinematic-phone-frame">
        <div className="cinematic-phone-notch" />
        <div className="cinematic-phone-screen">
          {current === 'logo' && (
            <div className="cinematic-bp-logo">
              <span className="cinematic-bp-logo-mark">BP</span>
              <span className="cinematic-bp-logo-name">Better Pass</span>
            </div>
          )}

          {current === 'search' && (
            <div className="cinematic-bp-panel cinematic-bp-search">
              <div className="cinematic-bp-search-bar">
                <Search size={14} />
                <span>Goa Beaches</span>
              </div>
            </div>
          )}

          {current === 'destination' && (
            <div className="cinematic-bp-panel cinematic-bp-destination">
              <div className="cinematic-bp-destination-media" />
              <div className="cinematic-bp-destination-meta">
                <MapPin size={13} />
                <span>Goa, India</span>
              </div>
            </div>
          )}

          {(current === 'tripCard' || current === 'select') && (
            <div className="cinematic-bp-panel cinematic-bp-trip">
              <div className={`cinematic-bp-trip-card${current === 'select' ? ' is-selected' : ''}`}>
                <div className="cinematic-bp-trip-card-media" />
                <div className="cinematic-bp-trip-card-body">
                  <strong>Coastal Getaway</strong>
                  <span>3 nights · Beachfront</span>
                  <span className="cinematic-bp-trip-price">₹6,499</span>
                </div>
              </div>
            </div>
          )}

          {current === 'booking' && (
            <div className="cinematic-bp-panel cinematic-bp-booking">
              <button type="button" className="cinematic-bp-book-btn" tabIndex={-1}>
                Book Trip
              </button>
            </div>
          )}

          {current === 'confirmed' && (
            <div className="cinematic-bp-panel cinematic-bp-confirmed">
              <CheckCircle2 size={26} />
              <span>Trip Booked</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

BetterPassUI.displayName = 'BetterPassUI';
