const BASE = '/icons/mobile-nav-icons';

/**
 * Maps semantic nav-item keys to the provided webp glyphs. Only keys with an
 * unambiguous matching asset are listed; anything else falls back to its
 * existing lucide-react icon in the caller.
 */
export const MOBILE_NAV_ICON_SRC: Record<string, string> = {
  home: `${BASE}/home.webp`,
  explore: `${BASE}/search.webp`,
  search: `${BASE}/search.webp`,
  dashboard: `${BASE}/dashboard.webp`,
  overview: `${BASE}/dashboard.webp`,
  bookings: `${BASE}/bookings.webp`,
  revenue: `${BASE}/money.webp`,
  studio: `${BASE}/studio.webp`,
  listings: `${BASE}/listings.webp`,
  advertisements: `${BASE}/advertisement.webp`,
  messages: `${BASE}/notification.webp`,
  profile: `${BASE}/profile.webp`,
};
