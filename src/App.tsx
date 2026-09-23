import { Suspense, lazy, useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { SupportChatbot } from './components/SupportChatbot';
import { AppSEO } from './components/SEO';
import { AppSplashScreen } from './components/AppSplashScreen';
import { AppTutorialProvider } from './context/AppTutorialContext';
import { OFFICIAL_SOCIAL_LINKS } from './lib/appContent';
import { buildLoginPath } from './lib/authRedirect';
import { captureCouponFromUrl, FIRST_BOOKING_COUPON_CODE, FIRST_BOOKING_COUPON_PERCENT, getCouponCodeFromUrl } from './lib/coupons';
import { getNativeAppLinkPath, isNativeAuthCallbackUrl, sanitizeNativeNavigationPath } from './lib/nativeApp';
import { resolveEffectiveAccountRole } from './lib/platform';
import { supabase } from './lib/supabase';
import { VIRTUAL_TOURS_ENABLED } from './lib/virtualTours';

const Home5 = lazy(async () => ({ default: (await import('./pages/Home5')).Home5 }));
const AboutFinal = lazy(async () => ({ default: (await import('./pages/AboutFinal')).AboutFinal }));
const WhoMadeIt = lazy(async () => ({ default: (await import('./pages/WhoMadeIt')).WhoMadeIt }));
const DashboardHome = lazy(async () => ({ default: (await import('./pages/DashboardHome')).DashboardHome }));
const TouristExplorePage = lazy(async () => ({ default: (await import('./pages/TouristExplorePage')).TouristExplorePage }));
const RoleDashboard = lazy(async () => ({ default: (await import('./pages/RoleDashboard')).RoleDashboard }));
const Auth = lazy(async () => ({ default: (await import('./pages/Auth')).Auth }));
const DestinationDetail = lazy(async () => ({ default: (await import('./pages/DestinationDetail')).DestinationDetail }));
const Profile = lazy(async () => ({ default: (await import('./pages/Profile')).Profile }));
const AdminConsole = lazy(async () => ({ default: (await import('./pages/AdminConsole')).AdminConsole }));
const AdminListingReview = lazy(async () => ({ default: (await import('./pages/AdminListingReview')).AdminListingReview }));
const ProviderTerms = lazy(async () => ({ default: (await import('./pages/ProviderTerms')).ProviderTerms }));
const TermsAndConditions = lazy(async () => ({ default: (await import('./pages/TermsAndConditions')).TermsAndConditions }));
const Blogs = lazy(async () => ({ default: (await import('./pages/Blogs')).Blogs }));
const BlogCreate = lazy(async () => ({ default: (await import('./pages/BlogCreate')).BlogCreate }));
const BlogDetail = lazy(async () => ({ default: (await import('./pages/BlogDetail')).BlogDetail }));
const ListingDetail = lazy(async () => ({ default: (await import('./pages/ListingDetail')).ListingDetail }));
const UserProfile = lazy(async () => ({ default: (await import('./pages/UserProfile')).UserProfile }));
const Messages = lazy(async () => ({ default: (await import('./pages/Messages')).Messages }));
const Notifications = lazy(async () => ({ default: (await import('./pages/Notifications')).Notifications }));
const Map2Page = lazy(async () => ({ default: (await import('./pages/Map2Page')).Map2Page }));
const VirtualTours = lazy(async () => ({ default: (await import('./pages/VirtualTours')).VirtualTours }));

const APP_HOME_PATH = '/';
const DASHBOARD_TOURS_PATH = '/explore?tab=tours';
const DASHBOARD_ACTIVITIES_PATH = '/explore?tab=activities';
const DASHBOARD_EVENTS_PATH = '/explore?tab=guides';
const SHOW_SUPPORT_CHATBOT = false;
let lastHandledNativeAuthUrl = '';

const resolveUserRole = (user: { user_metadata?: Record<string, unknown> } | null, profileRole?: string | null) => {
  const metadataRole = user?.user_metadata?.role;
  return resolveEffectiveAccountRole(
    profileRole,
    typeof metadataRole === 'string' ? metadataRole : null,
  );
};

const isProviderAccount = (role?: string | null) => (
  role === 'tour_company' || role === 'tour_instructor' || role === 'tour_guide' || role === 'local_guide' || role === 'provider' || role === 'vendor'
);

const isProviderLabel = (label?: string | null) => {
  const normalized = (label || '').trim().toLowerCase();
  return normalized === 'tour company' || normalized === 'tour instructor' || normalized === 'tour guide' || normalized === 'local guide' || normalized === 'provider' || normalized === 'vendor';
};

const isMarketingAccount = (role?: string | null) => role === 'marketing';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profileLoading } = useAuth();

  if (loading || profileLoading) {
    return <NativeLoadingFallback />;
  }

  if (!user) {
    return <Navigate to={buildLoginPath()} replace />;
  }

  return <>{children}</>;
};

const LegacyAuthRedirect: React.FC = () => {
  const location = useLocation();
  return <Navigate to={`/login${location.search}`} replace />;
};

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const completeAuthCallback = async () => {
      const params = new URLSearchParams(location.search);
      const nextPath = sanitizeNativeNavigationPath(params.get('next'));
      const oauthError = params.get('error_description') || params.get('error');

      if (oauthError) {
        console.error('OAuth callback failed:', oauthError);
        if (mounted) navigate('/login', { replace: true });
        return;
      }

      try {
        const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const authCode = params.get('code');

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (authCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) throw new Error('OAuth callback did not include a session.');
        }

        if (mounted) navigate(nextPath, { replace: true });
      } catch (error) {
        console.error('OAuth session exchange failed:', error);
        if (mounted) navigate('/login', { replace: true });
      }
    };

    void completeAuthCallback();

    return () => {
      mounted = false;
    };
  }, [location.hash, location.search, navigate]);

  return <NativeLoadingFallback />;
};

const GuestOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isRecoveryMode = new URLSearchParams(location.search).get('mode') === 'recovery';

  if (loading) {
    return <NativeLoadingFallback />;
  }

  if (user && !isRecoveryMode) {
    return <Navigate to={APP_HOME_PATH} replace />;
  }

  return <>{children}</>;
};

const HomeRoute: React.FC = () => {
  const { user, profile, loading, profileLoading, isProvider, isAdmin, roleLabel } = useAuth();
  const role = resolveUserRole(user, profile?.role);
  const providerAccount = isProvider || isProviderAccount(role) || isProviderLabel(roleLabel);
  const isAdminAccount = role === 'admin' || isAdmin;
  const marketingAccount = isMarketingAccount(role);

  if (loading || profileLoading) {
    return <NativeLoadingFallback />;
  }

  if (user && (providerAccount || isAdminAccount || marketingAccount)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <DashboardHome />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, isAdmin } = useAuth();
  const role = resolveUserRole(user, profile?.role);
  const isAdminAccount = role === 'admin' || isAdmin;

  if (loading) {
    return <NativeLoadingFallback />;
  }

  if (!user) {
    return <Navigate to={buildLoginPath()} replace />;
  }

  if (!isAdminAccount) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const ProviderRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading } = useAuth();
  const role = resolveUserRole(user, profile?.role);
  const isProvider = isProviderAccount(role);

  if (loading) {
    return <NativeLoadingFallback />;
  }

  if (!user) {
    return <Navigate to={buildLoginPath()} replace />;
  }

  if (!isProvider) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const TouristOnlyRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading, profileLoading, isProvider, isAdmin, roleLabel } = useAuth();
  const role = resolveUserRole(user, profile?.role);
  const providerAccount = isProvider || isProviderAccount(role) || isProviderLabel(roleLabel);
  const isAdminAccount = role === 'admin' || isAdmin;
  const marketingAccount = isMarketingAccount(role);

  if (loading || profileLoading) {
    return <NativeLoadingFallback />;
  }

  if (!user) {
    return <Navigate to={buildLoginPath()} replace />;
  }

  if (providerAccount || isAdminAccount || marketingAccount) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const isNativePlatform = Capacitor.isNativePlatform();
  const homePath = user ? APP_HOME_PATH : '/';
  const footerLogoSrc = theme === 'dark' ? '/logo/final-logo-white.png' : '/logo/final-logo.png';

  return (
    <Router>
      <AppTutorialProvider>
        <div className={`app${user ? ' app-authenticated' : ''}`}>
          <AppSEO />
          <CouponLinkCapture />
          <NativeDeepLinkHandler />
          <AppNavbar />
          <Suspense fallback={isNativePlatform ? <AppSplashScreen /> : null}>
            <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/home2" element={<Navigate to="/" replace />} />
              <Route path="/home3" element={<Navigate to="/" replace />} />
              <Route path="/home4" element={<Navigate to="/" replace />} />
              <Route path="/home5" element={<Navigate to="/" replace />} />
              <Route path="/about" element={<Home5 />} />
              <Route path="/about2" element={<Navigate to="/about" replace />} />
              <Route path="/about-final" element={<AboutFinal />} />
              <Route path="/whomadeit" element={<WhoMadeIt />} />
              <Route path="/login" element={<GuestOnlyRoute><Auth /></GuestOnlyRoute>} />
              <Route path="/signup" element={<GuestOnlyRoute><Auth /></GuestOnlyRoute>} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/auth" element={<LegacyAuthRedirect />} />
              <Route path="/terms" element={<TermsAndConditions />} />
              <Route path="/blogs" element={<Blogs />} />
              <Route path="/blogs/new" element={<ProtectedRoute><BlogCreate /></ProtectedRoute>} />
              <Route path="/blogs/:slug" element={<BlogDetail />} />
              <Route path="/dashboard" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
              <Route path="/dashboard/:role" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
              <Route path="/explore" element={<TouristOnlyRoute><TouristExplorePage /></TouristOnlyRoute>} />
              <Route path="/activities" element={<TouristOnlyRoute><Navigate to={DASHBOARD_ACTIVITIES_PATH} replace /></TouristOnlyRoute>} />
              <Route path="/tours" element={<TouristOnlyRoute><Navigate to={DASHBOARD_TOURS_PATH} replace /></TouristOnlyRoute>} />
              <Route path="/guides" element={<TouristOnlyRoute><Navigate to={DASHBOARD_EVENTS_PATH} replace /></TouristOnlyRoute>} />
              <Route path="/events" element={<TouristOnlyRoute><Navigate to={DASHBOARD_EVENTS_PATH} replace /></TouristOnlyRoute>} />
              <Route path="/listings/:type/:id" element={<ListingDetail />} />
              <Route path="/destination/:id" element={<TouristOnlyRoute><DestinationDetail /></TouristOnlyRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/users/:id" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/virtual-tours" element={VIRTUAL_TOURS_ENABLED ? <ProtectedRoute><VirtualTours /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/virtual-tours/live/:bookingId" element={VIRTUAL_TOURS_ENABLED ? <ProtectedRoute><VirtualTours /></ProtectedRoute> : <Navigate to="/" replace />} />
              <Route path="/map" element={<Map2Page />} />
              <Route path="/map2" element={<Navigate to="/map" replace />} />
              <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminConsole /></AdminRoute>} />
              <Route path="/admin/review/:id" element={<AdminRoute><AdminListingReview /></AdminRoute>} />
              <Route path="/provider/studio" element={<ProviderRoute><Navigate to="/dashboard/provider?section=studio" replace /></ProviderRoute>} />
              <Route path="/provider/terms" element={<ProviderRoute><ProviderTerms /></ProviderRoute>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>

          <AppFooter homePath={homePath} footerLogoSrc={footerLogoSrc} user={user} />
          {SHOW_SUPPORT_CHATBOT ? <SupportChatbot /> : null}
        </div>
      </AppTutorialProvider>
    </Router>
  );
}

const NativeLoadingFallback: React.FC = () => (
  Capacitor.isNativePlatform() ? <AppSplashScreen lightweight /> : null
);

const CouponLinkCapture: React.FC = () => {
  const location = useLocation();
  const locationKey = `${location.pathname}${location.search}`;
  const codeInUrl = getCouponCodeFromUrl(location.search);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const visible = Boolean(codeInUrl) && dismissedKey !== locationKey;

  useEffect(() => {
    if (!codeInUrl) return;
    captureCouponFromUrl(location.search, locationKey);
  }, [codeInUrl, location.search, locationKey]);

  useEffect(() => {
    if (!visible) return;

    document.body.classList.add('coupon-modal-open');
    const hideTimer = window.setTimeout(() => setDismissedKey(locationKey), 10000);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDismissedKey(locationKey);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.classList.remove('coupon-modal-open');
      window.clearTimeout(hideTimer);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [visible, locationKey]);

  if (!visible) return null;

  const dismiss = () => setDismissedKey(locationKey);

  return (
    <div className="coupon-modal-backdrop" onClick={dismiss}>
      <div
        className="coupon-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="coupon-modal-close"
          onClick={dismiss}
          aria-label="Dismiss coupon message"
        >
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>

        <div className="coupon-modal-badge-wrap" aria-hidden="true">
          <span className="coupon-modal-ring" />
          <span className="coupon-confetti coupon-confetti-1" />
          <span className="coupon-confetti coupon-confetti-2" />
          <span className="coupon-confetti coupon-confetti-3" />
          <span className="coupon-confetti coupon-confetti-4" />
          <span className="coupon-confetti coupon-confetti-5" />
          <span className="coupon-confetti coupon-confetti-6" />
          <svg className="coupon-modal-badge" viewBox="0 0 64 64" width="72" height="72">
            <defs>
              <linearGradient id="couponBadgeGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#16a34a" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="32" r="30" fill="url(#couponBadgeGradient)" />
            <path
              className="coupon-modal-check"
              d="M19 33 L27.5 41.5 L46 21"
              fill="none"
              stroke="#ffffff"
              strokeWidth="4.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength="1"
            />
          </svg>
        </div>

        <h2 id="coupon-modal-title" className="coupon-modal-title">Congratulations!</h2>
        <p className="coupon-modal-subtitle">
          You have earned a {FIRST_BOOKING_COUPON_PERCENT}% discount on your first booking.
        </p>

        <div className="coupon-modal-code">
          <span>Coupon code</span>
          <strong>{FIRST_BOOKING_COUPON_CODE}</strong>
        </div>

        <p className="coupon-modal-note">Applies automatically when your first booking is confirmed.</p>

        <button type="button" className="coupon-modal-cta" onClick={dismiss}>
          Start exploring
        </button>
      </div>
    </div>
  );
};

const NativeDeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let mounted = true;
    let listenerHandle: { remove: () => Promise<void> } | undefined;

    const handleNativeUrl = async (rawUrl: string) => {
      const appLinkPath = getNativeAppLinkPath(rawUrl);
      if (appLinkPath) {
        if (rawUrl === lastHandledNativeAuthUrl) return;
        lastHandledNativeAuthUrl = rawUrl;
        if (mounted) navigate(appLinkPath, { replace: false });
        return;
      }

      if (!isNativeAuthCallbackUrl(rawUrl) || rawUrl === lastHandledNativeAuthUrl) return;
      lastHandledNativeAuthUrl = rawUrl;

      await Browser.close().catch(() => undefined);

      const callbackUrl = new URL(rawUrl);
      const nextPath = sanitizeNativeNavigationPath(callbackUrl.searchParams.get('next'));
      const oauthError = callbackUrl.searchParams.get('error_description') || callbackUrl.searchParams.get('error');

      if (oauthError) {
        console.error('Native OAuth callback failed:', oauthError);
        if (mounted) navigate('/login', { replace: true });
        return;
      }

      const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const authCode = callbackUrl.searchParams.get('code');

      try {
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else if (authCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(authCode);
          if (error) throw error;
        } else {
          throw new Error('Native OAuth callback did not include a session token or auth code.');
        }

        if (mounted) navigate(nextPath, { replace: true });
      } catch (error) {
        console.error('Native OAuth session exchange failed:', error);
        if (mounted) navigate('/login', { replace: true });
      }
    };

    void CapacitorApp.getLaunchUrl().then((launchUrl) => {
      if (launchUrl?.url) void handleNativeUrl(launchUrl.url);
    });

    void CapacitorApp.addListener('appUrlOpen', (event) => {
      void handleNativeUrl(event.url);
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      mounted = false;
      void listenerHandle?.remove();
    };
  }, [navigate]);

  return null;
};

const HIDE_GLOBAL_CHROME_PATHS = ['/login', '/signup', '/home4', '/home5', '/terms', '/about', '/about2', '/about-final', '/whomadeit'];

const AppNavbar: React.FC = () => {
  const { pathname } = useLocation();
  const isDashboardRoute = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  if (isDashboardRoute || HIDE_GLOBAL_CHROME_PATHS.includes(pathname)) return null;
  return <Navbar />;
};

const AppFooter: React.FC<{ homePath: string; footerLogoSrc: string; user: unknown }> = ({ homePath, footerLogoSrc, user }) => {
  const { pathname } = useLocation();
  const isGuestLanding = !user && pathname === '/';
  const shouldRenderAppFooter = false;
  if (!shouldRenderAppFooter || HIDE_GLOBAL_CHROME_PATHS.includes(pathname)) return null;
  if (isGuestLanding) return null;

  return (
        <footer style={{ padding: '88px 0 40px', borderTop: '1px solid var(--border-light)', marginTop: '120px', background: 'var(--surface-main)' }}>
          <div className="container">
            <div
              className="app-footer-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) repeat(3, minmax(0, 1fr))',
                gap: '40px',
                alignItems: 'start',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <Link to={homePath} aria-label="Vagabond home" style={{ display: 'inline-flex', width: 'fit-content' }}>
                  <img
                    src={footerLogoSrc}
                    alt="Vagabond"
                    style={{ height: '44px', width: 'auto', maxWidth: '220px', objectFit: 'contain' }}
                  />
                </Link>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.8, maxWidth: '360px' }}>
                  Premium tours, activity bookings, and seamless travel planning for modern explorers who want clear systems and memorable journeys.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 18px', color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span>15K+ Travelers</span>
                  <span>200+ Destinations</span>
                  <span>4.9 / 5 Rated</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-main)' }}>Explore</h4>
                <Link to={homePath} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Home</Link>
                <Link to={user ? DASHBOARD_TOURS_PATH : '/login'} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Tours</Link>
                <Link to={user ? DASHBOARD_ACTIVITIES_PATH : '/login'} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Activities</Link>
                <Link to={user ? DASHBOARD_EVENTS_PATH : '/login'} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Events</Link>
                <Link to={user ? '/profile' : '/login'} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Membership</Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-main)' }}>Company</h4>
                {user ? (
                  <>
                    <Link to="/dashboard" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Dashboard</Link>
                    <Link to={DASHBOARD_TOURS_PATH} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Tour Collections</Link>
                    <Link to={DASHBOARD_ACTIVITIES_PATH} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Activity Catalog</Link>
                    <Link to={DASHBOARD_EVENTS_PATH} style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Events</Link>
                    <Link to="/profile" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Profile Center</Link>
                  </>
                ) : (
                  <>
                    <a href="#discover" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>About Us</a>
                    <a href="#services" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Services</a>
                    <a href="#testimonials" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Traveler Stories</a>
                    <a href="#cta" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Start Planning</a>
                  </>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <h4 style={{ fontSize: '0.82rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-main)' }}>Support</h4>
                <a href="mailto:support@vagabond.travel" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>support@vagabond.travel</a>
                <a href="tel:+911800000000" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>+91 1800 000 000</a>
                <a href="#" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Privacy Policy</a>
                <a href="#" style={{ fontSize: '0.92rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>Terms of Service</a>
              </div>
            </div>

            <div style={{ marginTop: '48px', paddingTop: '22px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', opacity: 0.72 }}>© 2026 Vagabond. Crafted for seamless journeys.</p>
              <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
                {OFFICIAL_SOCIAL_LINKS.map((link) => (
                  <a key={link.label} href={link.href || '#'} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textDecoration: 'none', fontWeight: 500 }}>{link.label}</a>
                ))}
              </div>
            </div>
          </div>

          <style>{`
            @media (max-width: 980px) {
              .app-footer-grid {
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: 32px !important;
              }
            }

            @media (max-width: 640px) {
              .app-footer-grid {
                grid-template-columns: 1fr !important;
                gap: 28px !important;
              }
            }
          `}</style>
        </footer>
  );
};

export default App;
