import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getCouponCodeFromUrl } from '../lib/coupons';
import { isTrackablePath, setAnalyticsUser, trackEvent } from '../lib/analytics';

const LISTING_PATH = /^\/listings\/([^/]+)\/([^/]+)/;

const getClickLabel = (element: Element): string | null => {
    const explicit = element.getAttribute('data-track');
    if (explicit) return explicit;

    const aria = element.getAttribute('aria-label');
    if (aria) return aria;

    const text = (element.textContent || '').replace(/\s+/g, ' ').trim();
    if (text) return text.slice(0, 60);

    const href = element.getAttribute('href');
    return href ? href.slice(0, 60) : null;
};

/** Mounts once inside the router: page views, listing views, campaign-link visits and clicks. */
export const AnalyticsTracker: React.FC = () => {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const userId = user?.id || null;

  useEffect(() => {
    setAnalyticsUser(userId);
  }, [userId]);

  useEffect(() => {
    if (!isTrackablePath(pathname) || pathname === '/auth/callback') return;

    trackEvent('page_view');

    const listingMatch = pathname.match(LISTING_PATH);
    if (listingMatch) {
      trackEvent('listing_view', { target: `${listingMatch[1]}:${listingMatch[2]}` });
    }

    const params = new URLSearchParams(search);
    const couponCode = getCouponCodeFromUrl(search);
    const campaign = params.get('utm_campaign') || params.get('utm_source') || params.get('ref');
    if (couponCode || campaign) {
      const linkKey = `tbp:analytics:link:${couponCode || campaign}`;
      try {
        if (window.sessionStorage.getItem(linkKey)) return;
        window.sessionStorage.setItem(linkKey, '1');
      } catch {
        // If storage is unavailable we may double count a link visit; acceptable.
      }
      trackEvent('link_visit', { couponCode, target: couponCode ? 'coupon_link' : 'campaign_link' });
    }
  }, [pathname, search]);

  useEffect(() => {
    let lastClickAt = 0;

    const onClick = (event: MouseEvent) => {
      const source = event.target;
      if (!(source instanceof Element)) return;

      const element = source.closest('[data-track], a, button');
      if (!element) return;

      const now = Date.now();
      if (now - lastClickAt < 300) return;
      lastClickAt = now;

      const label = getClickLabel(element);
      if (label) trackEvent('click', { target: label });
    };

    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  return null;
};
