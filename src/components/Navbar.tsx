import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun, X } from 'lucide-react';
import { useAppTutorial } from '../context/app-tutorial-context-value';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { getProfileAvatarUrl } from '../lib/avatar';
import { normalizeRoleValue } from '../lib/platform';

type NavTab = 'home' | 'explore' | 'virtualTours' | 'dashboard' | 'bookings' | 'profile';

type DesktopLiquidNavItem = {
    key: string;
    label: string;
    to: string;
    iconSrc: string;
    active: boolean;
};

const DESKTOP_NAV_ICON_SRC: Record<string, string> = {
    home: '/icons/mobile-nav-icons/home.webp',
    explore: '/icons/mobile-nav-icons/search.webp',
    virtualTours: '/icons/mobile-nav-icons/gps.svg',
    dashboard: '/icons/mobile-nav-icons/dashboard.webp',
    bookings: '/icons/mobile-nav-icons/bookings.webp',
    messages: '/icons/mobile-nav-icons/chat.webp',
    favorites: '/icons/mobile-nav-icons/fav.webp',
    moderation: '/icons/mobile-nav-icons/listings.webp',
    leads: '/icons/mobile-nav-icons/notification.webp',
    studio: '/icons/mobile-nav-icons/studio.webp',
};

const DESKTOP_NAV_MORPH_MS = 560;

export const Navbar: React.FC = () => {
    const { user, profile, profileLoading, signOut, isAdmin, isProvider, roleLabel } = useAuth();
    const { openTutorial } = useAppTutorial();
    const { theme, toggleTheme } = useTheme();
    const [showMenu, setShowMenu] = useState(false);
    const [desktopMorphing, setDesktopMorphing] = useState(false);
    const [desktopMorphCycle, setDesktopMorphCycle] = useState(0);
    const mobileNavRef = useRef<HTMLDivElement | null>(null);
    const previousDesktopActiveId = useRef<string | null | undefined>(undefined);
    const rawDesktopGooId = useId().replace(/[^a-zA-Z0-9]/g, '');
    const desktopGooFilterId = `nbr-goo-${rawDesktopGooId}`;
    const location = useLocation();

    const isDark = theme === 'dark';
    const homePath = '/';
    const logoSrc = isDark ? '/logo/final-logo-white.png' : '/logo/final-logo.png';
    const navSurface = isDark ? 'rgba(0,0,0,0.74)' : 'rgba(242,138,36,0.46)';
    const navBorder = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(138,73,8,0.28)';
    const navInset = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,242,224,0.30)';
    const navText = isDark ? 'rgba(248,250,252,0.82)' : 'rgba(31,18,7,0.86)';
    const navTextStrong = isDark ? '#f8fafc' : '#1f1308';
    const navHover = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)';
    const navDivider = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(63,34,8,0.28)';
    const navActiveBg = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.86)';
    const navActiveText = '#ffffff';
    const mobileMenuBg = isDark ? '#151515' : '#d2d2d2';
    const mobileMenuText = isDark ? '#f5f5f5' : '#333333';
    const mobileMenuUtilityText = isDark ? 'rgba(245,245,245,0.82)' : '#333333';
    const mobileMenuHover = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.54)';
    const resolvedRole = typeof profile?.role === 'string' && profile.role.trim()
        ? normalizeRoleValue(profile.role)
        : typeof user?.user_metadata?.role === 'string' && user.user_metadata.role.trim()
            ? normalizeRoleValue(user.user_metadata.role)
            : null;
    const normalizedRoleLabel = roleLabel.trim().toLowerCase();
    const providerByLabel = normalizedRoleLabel === 'tour company'
        || normalizedRoleLabel === 'tour instructor'
        || normalizedRoleLabel === 'tour guide'
        || normalizedRoleLabel === 'local guide'
        || normalizedRoleLabel === 'provider'
        || normalizedRoleLabel === 'vendor';
    const adminByLabel = normalizedRoleLabel === 'admin';
    const roleReady = !user || !profileLoading;
    const providerAccount = isProvider
        || providerByLabel
        || resolvedRole === 'tour_company'
        || resolvedRole === 'tour_instructor'
        || resolvedRole === 'tour_guide'
        || resolvedRole === 'local_guide'
        || resolvedRole === 'provider'
        || resolvedRole === 'vendor'
        || location.pathname.startsWith('/dashboard/provider')
        || location.pathname.startsWith('/provider/studio');
    const adminAccount = isAdmin || adminByLabel || resolvedRole === 'admin' || location.pathname.startsWith('/dashboard/admin') || location.pathname.startsWith('/admin');
    const isTourist = roleReady && !providerAccount && !adminAccount && (resolvedRole === 'tourist' || normalizedRoleLabel === 'tourist');
    const dashboardPath = providerAccount ? '/dashboard/provider' : adminAccount ? '/dashboard/admin' : '/dashboard';
    const providerStudioPath = '/dashboard/provider?section=studio';
    const touristDashboardPath = '/dashboard/tourist';
    const touristExplorePath = '/explore';
    const touristBookingsPath = '/dashboard/tourist?section=bookings';

    const activeTab: NavTab | null = (() => {
        const tab = new URLSearchParams(location.search).get('tab');
        if (location.pathname === '/profile') return 'profile';
        if (location.pathname === '/virtual-tours' || location.pathname.startsWith('/virtual-tours/')) return 'virtualTours';
        if (!isTourist) return null;
        if (location.pathname === '/') return 'home';
        if (location.pathname === '/explore') return 'explore';
        if (location.pathname.startsWith('/dashboard')) {
            const section = new URLSearchParams(location.search).get('section');
            if (section === 'bookings') return 'bookings';
            if (section === 'favorites') return null;
            return 'dashboard';
        }
        if (
            location.pathname === '/events'
            || location.pathname === '/guides'
            || location.pathname === '/tours'
            || location.pathname === '/activities'
            || tab === 'tours'
            || tab === 'activities'
            || tab === 'events'
            || tab === 'guides'
        ) {
            return 'explore';
        }
        return null;
    })();

    const navLinks: Array<{ key: NavTab; label: string; to: string }> = [
        ...(!roleReady
            ? []
            : isTourist
            ? [
                { key: 'home' as NavTab, label: 'Home', to: '/' },
                { key: 'explore' as NavTab, label: 'Explore', to: touristExplorePath },
                { key: 'virtualTours' as NavTab, label: 'Live Tours', to: '/virtual-tours' },
                { key: 'dashboard' as NavTab, label: 'Dashboard', to: touristDashboardPath },
                { key: 'bookings' as NavTab, label: 'Bookings', to: touristBookingsPath },
                { key: 'profile' as NavTab, label: 'Profile', to: '/profile' },
              ]
            : [
                { key: 'dashboard' as NavTab, label: 'Dashboard', to: dashboardPath },
                { key: 'virtualTours' as NavTab, label: 'Live Tours', to: '/virtual-tours' },
                { key: 'profile' as NavTab, label: 'Profile', to: '/profile' },
              ]),
    ];

    const locationSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const dashboardSection = locationSearchParams.get('section');
    const desktopNavItems: DesktopLiquidNavItem[] = [
        ...navLinks
            .filter((item) => item.key !== 'profile')
            .map((item) => ({
                key: item.key,
                label: item.label,
                to: item.to,
                iconSrc: DESKTOP_NAV_ICON_SRC[item.key],
                active: activeTab === item.key || (
                    item.key === 'dashboard'
                    && !isTourist
                    && location.pathname === dashboardPath
                    && !(adminAccount && (dashboardSection === 'moderation' || dashboardSection === 'inquiries'))
                    && !(providerAccount && dashboardSection === 'studio')
                ),
            })),
        ...(adminAccount
            ? [
                {
                    key: 'moderation',
                    label: 'Moderation',
                    to: '/dashboard/admin?section=moderation',
                    iconSrc: DESKTOP_NAV_ICON_SRC.moderation,
                    active: location.pathname.startsWith('/dashboard/admin') && dashboardSection === 'moderation',
                },
                {
                    key: 'leads',
                    label: 'Contact Leads',
                    to: '/dashboard/admin?section=inquiries',
                    iconSrc: DESKTOP_NAV_ICON_SRC.leads,
                    active: location.pathname.startsWith('/dashboard/admin') && dashboardSection === 'inquiries',
                },
            ]
            : []),
        {
            key: 'messages',
            label: 'Messages',
            to: '/messages',
            iconSrc: DESKTOP_NAV_ICON_SRC.messages,
            active: location.pathname === '/messages',
        },
        ...(isTourist
            ? [{
                key: 'favorites',
                label: 'Favorites',
                to: '/dashboard/tourist?section=favorites',
                iconSrc: DESKTOP_NAV_ICON_SRC.favorites,
                active: location.pathname.startsWith('/dashboard/tourist') && dashboardSection === 'favorites',
            }]
            : []),
        ...(providerAccount
            ? [{
                key: 'studio',
                label: 'Studio',
                to: providerStudioPath,
                iconSrc: DESKTOP_NAV_ICON_SRC.studio,
                active: location.pathname.startsWith('/dashboard/provider') && dashboardSection === 'studio',
            }]
            : []),
    ];
    const activeDesktopItem = desktopNavItems.find((item) => item.active) || null;
    const inactiveDesktopItems = activeDesktopItem
        ? desktopNavItems.filter((item) => item.key !== activeDesktopItem.key)
        : desktopNavItems;
    const activeDesktopId = activeDesktopItem?.key || null;

    if (previousDesktopActiveId.current === undefined) {
        previousDesktopActiveId.current = activeDesktopId;
    } else if (previousDesktopActiveId.current !== activeDesktopId) {
        previousDesktopActiveId.current = activeDesktopId;
        setDesktopMorphing(true);
        setDesktopMorphCycle((cycle) => cycle + 1);
    }

    const shortName = (() => {
        const name = profile?.full_name?.trim();
        if (!name || name.includes('@')) {
            const local = user?.email?.split('@')[0] || 'User';
            return local.charAt(0).toUpperCase() + local.slice(1);
        }
        const parts = name.split(' ').filter(Boolean);
        if (parts.length <= 1) return parts[0];
        return `${parts[0]} ${parts[parts.length - 1][0]}`;
    })();

    const avatarSrc = getProfileAvatarUrl(profile?.profile_image_url, user?.id, profile?.full_name, user?.email);

    useEffect(() => {
        if (!desktopMorphing) return;
        const timeoutId = window.setTimeout(() => setDesktopMorphing(false), DESKTOP_NAV_MORPH_MS);
        return () => window.clearTimeout(timeoutId);
    }, [desktopMorphCycle, desktopMorphing]);

    useEffect(() => {
        const onMapMenuToggle = () => setShowMenu((current) => !current);
        window.addEventListener('tbp:toggle-mobile-menu', onMapMenuToggle);
        return () => window.removeEventListener('tbp:toggle-mobile-menu', onMapMenuToggle);
    }, []);

    useEffect(() => {
        if (!showMenu) return;

        const onPointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (mobileNavRef.current?.contains(target)) return;
            setShowMenu(false);
        };

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setShowMenu(false);
        };

        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown, { passive: true });
        document.addEventListener('keydown', onKeyDown);

        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [showMenu]);

    return (
        <>
            {/* ── Desktop nav bar ─────────────────────────────── */}
            <div className={`nbr-bar nbr-desktop${location.pathname === '/map2' ? ' nbr-desktop--map2' : ''}`}>
                <Link to={homePath} aria-label="Home" className="nbr-desktop-logo">
                    <img src={logoSrc} alt="The Better Pass" className="nbr-logo" />
                </Link>

                {user && desktopNavItems.length > 0 ? (
                    <nav className="nbr-liquid-nav" aria-label="Primary navigation">
                        <svg className="nbr-liquid-defs" aria-hidden="true" focusable="false">
                            <filter id={desktopGooFilterId} x="-30%" y="-60%" width="160%" height="220%">
                                <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur" />
                                <feColorMatrix
                                    in="blur"
                                    mode="matrix"
                                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10"
                                    result="goo"
                                />
                                <feComposite in="SourceGraphic" in2="goo" operator="atop" />
                            </filter>
                        </svg>

                        <div className={`nbr-liquid-rest${desktopMorphing ? ' is-hidden' : ''}`}>
                            {activeDesktopItem && (
                                <Link to={activeDesktopItem.to} className="nbr-liquid-active" aria-label={activeDesktopItem.label} aria-current="page" title={activeDesktopItem.label}>
                                    <img src={activeDesktopItem.iconSrc} alt="" className="nbr-liquid-icon" aria-hidden="true" />
                                </Link>
                            )}
                            <div className="nbr-liquid-pill">
                                {inactiveDesktopItems.map((item) => (
                                    <Link key={`rest-${item.key}`} to={item.to} className="nbr-liquid-btn" aria-label={item.label} title={item.label}>
                                        <img src={item.iconSrc} alt="" className="nbr-liquid-icon" aria-hidden="true" />
                                    </Link>
                                ))}
                            </div>
                        </div>

                        <div className={`nbr-liquid-goo${desktopMorphing ? '' : ' is-hidden'}`}>
                            <div className="nbr-liquid-blob-layer" style={{ filter: `url(#${desktopGooFilterId})` }}>
                                {activeDesktopItem && <span key={`goo-active-${desktopMorphCycle}-${activeDesktopId}`} className="nbr-liquid-blob-active" />}
                                <span key={`goo-pill-${desktopMorphCycle}-${activeDesktopId}`} className="nbr-liquid-blob-pill">
                                    {inactiveDesktopItems.map((item) => (
                                        <span key={`slot-${item.key}`} className="nbr-liquid-blob-slot" />
                                    ))}
                                </span>
                            </div>
                            <div className="nbr-liquid-icon-layer">
                                {activeDesktopItem && (
                                    <Link to={activeDesktopItem.to} className="nbr-liquid-active" aria-label={activeDesktopItem.label} aria-current="page" title={activeDesktopItem.label}>
                                        <img src={activeDesktopItem.iconSrc} alt="" className="nbr-liquid-icon" aria-hidden="true" />
                                    </Link>
                                )}
                                <div className="nbr-liquid-pill nbr-liquid-pill--icons">
                                    {inactiveDesktopItems.map((item) => (
                                        <Link key={`goo-btn-${item.key}`} to={item.to} className="nbr-liquid-btn" aria-label={item.label} title={item.label}>
                                            <img src={item.iconSrc} alt="" className="nbr-liquid-icon" aria-hidden="true" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </nav>
                ) : (
                    <Link to="/signup" className="nbr-join nbr-join--desktop">Join</Link>
                )}
                {/* Centered glass pill */}
                <div className="nbr-pill nbr-pill--legacy">
                    <Link to={homePath} aria-label="Home" className="nbr-logo-wrap">
                        <img src={logoSrc} alt="The Better Pass" className="nbr-logo" />
                    </Link>

                    {user && (
                        <>
                            <div className="nbr-sep" />
                            {navLinks.map((item) => (
                                <Link
                                    key={item.key}
                                    to={item.to}
                                    className={`nbr-link${activeTab === item.key ? ' nbr-link--active' : ''}`}
                                >
                                    <span className="nbr-link-inner">{item.label}</span>
                                </Link>
                            ))}
                            {adminAccount && (
                                <>
                                    <Link
                                        to="/dashboard/admin?section=moderation"
                                        className={`nbr-link${location.pathname.startsWith('/dashboard/admin') && dashboardSection === 'moderation' ? ' nbr-link--active' : ''}`}
                                    >
                                        Moderation
                                    </Link>
                                    <Link
                                        to="/dashboard/admin?section=inquiries"
                                        className={`nbr-link${location.pathname.startsWith('/dashboard/admin') && dashboardSection === 'inquiries' ? ' nbr-link--active' : ''}`}
                                    >
                                        Leads
                                    </Link>
                                </>
                            )}
                            {providerAccount && (
                                <Link
                                    to={providerStudioPath}
                                    className={`nbr-link${location.pathname.startsWith('/dashboard/provider') && dashboardSection === 'studio' ? ' nbr-link--active' : ''}`}
                                >
                                    Studio
                                </Link>
                            )}
                        </>
                    )}

                    {!user && (
                        <Link to="/signup" className="nbr-join">Join</Link>
                    )}
                </div>

                {/* Right: map shortcut and user chip (outside the pill) */}
                {user && (
                    <div className="nbr-right-actions">
                        <button
                            type="button"
                            className="nbr-theme-button"
                            onClick={toggleTheme}
                            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
                            title={isDark ? 'Light theme' : 'Dark theme'}
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        <Link
                            to="/map"
                            className={`nbr-map-button${location.pathname === '/map' ? ' nbr-map-button--active' : ''}`}
                            aria-label="Open map"
                            title="Map"
                        >
                            <img src="/icons/mobile-nav-icons/gps.svg" alt="" className="nbr-map-icon" aria-hidden="true" />
                        </Link>
                        <Link to="/profile" className={`nbr-user-chip${location.pathname === '/profile' ? ' nbr-user-chip--active' : ''}`}>
                            <div className="nbr-user-text">
                                <span className="nbr-user-name">{shortName}</span>
                                <span className="nbr-user-role">{roleLabel}</span>
                            </div>
                            <img src={avatarSrc} alt={shortName} className="nbr-avatar" />
                        </Link>
                    </div>
                )}
            </div>

            {/* ── Mobile nav bar ──────────────────────────────── */}
            <div className={`nbr-bar nbr-mobile${location.pathname === '/map2' ? ' nbr-mobile--map2' : ''}`} ref={mobileNavRef}>
                <div className="nbr-pill nbr-mobile-pill">
                    <Link to={homePath} aria-label="Home" className="nbr-logo-wrap">
                        <img src={logoSrc} alt="The Better Pass" className="nbr-logo nbr-logo--sm" />
                    </Link>
                    <div className="nbr-mobile-actions">
                        {user && (
                            <Link to={dashboardPath} className="nbr-avatar-sm-wrap">
                                <img src={avatarSrc} alt={shortName} className="nbr-avatar-sm" />
                            </Link>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowMenu(!showMenu)}
                            className="nbr-hamburger"
                            aria-label={showMenu ? 'Close' : 'Menu'}
                        >
                            {showMenu ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {/* Mobile dropdown */}
                {showMenu && (
                    <div className="nbr-dropdown">
                        {!navLinks.some((item) => item.key === 'home') && (
                            <Link to={homePath} className="nbr-drop-item nbr-drop-item--main" onClick={() => setShowMenu(false)}>
                                <span>Home</span>
                                <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                            </Link>
                        )}
                        {user && navLinks.map((item) => (
                            <Link key={item.key} to={item.to} className="nbr-drop-item nbr-drop-item--main" onClick={() => setShowMenu(false)}>
                                <span>{item.label}</span>
                                <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                            </Link>
                        ))}
                        {user && adminAccount && (
                            <>
                                <Link to="/dashboard/admin?section=moderation" className="nbr-drop-item nbr-drop-item--main" onClick={() => setShowMenu(false)}>
                                    <span>Moderation</span>
                                    <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                                </Link>
                                <Link to="/dashboard/admin?section=inquiries" className="nbr-drop-item nbr-drop-item--main" onClick={() => setShowMenu(false)}>
                                    <span>Contact Leads</span>
                                    <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                                </Link>
                            </>
                        )}
                        {user && providerAccount && (
                            <Link to={providerStudioPath} className="nbr-drop-item nbr-drop-item--main" onClick={() => setShowMenu(false)}>
                                <span>Studio</span>
                                <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                            </Link>
                        )}
                        {user && (
                            <Link to="/map" className="nbr-drop-item nbr-drop-item--main" onClick={() => setShowMenu(false)}>
                                <span>Map</span>
                                <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                            </Link>
                        )}
                        {!user && (
                            <Link to="/signup" className="nbr-drop-item nbr-drop-item--main nbr-drop-item--accent" onClick={() => setShowMenu(false)}>
                                <span>Join Membership</span>
                                <img src="/icons/arrow.webp" alt="" className="nbr-drop-arrow" aria-hidden="true" />
                            </Link>
                        )}
                        <button type="button" className="nbr-drop-item nbr-drop-item--btn" onClick={toggleTheme}>
                            {isDark ? <Sun size={14} /> : <Moon size={14} />}
                            {isDark ? 'Light Mode' : 'Dark Mode'}
                        </button>
                        {user && (
                            <button type="button" className="nbr-drop-item nbr-drop-item--btn" onClick={() => { openTutorial(); setShowMenu(false); }}>
                                Help
                            </button>
                        )}
                        {user && (
                            <button
                                type="button"
                                className="nbr-drop-item nbr-drop-item--btn nbr-drop-item--danger"
                                onClick={() => { void signOut(); setShowMenu(false); }}
                            >
                                Sign Out
                            </button>
                        )}
                    </div>
                )}
            </div>
            <style>{`
                /* Fixed bar */
                .nbr-bar {
                    align-items: center;
                    display: flex;
                    justify-content: center;
                    left: 0;
                    padding: 0 32px;
                    pointer-events: none;
                    position: fixed;
                    right: 0;
                    top: 28px;
                    z-index: 1000;
                }

                .nbr-bar > * { pointer-events: all; }

                .nbr-desktop {
                    display: grid !important;
                    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
                    align-items: center;
                    box-sizing: border-box;
                    left: 50%;
                    padding: 0 32px;
                    right: auto;
                    top: 24px;
                    transform: translateX(-50%);
                    width: min(100%, 1440px);
                }

                .nbr-pill--legacy {
                    display: none !important;
                }

                .nbr-desktop-logo {
                    align-items: center;
                    display: inline-flex;
                    grid-column: 1;
                    justify-self: start;
                    text-decoration: none;
                }

                .nbr-desktop-logo .nbr-logo {
                    height: 38px;
                }

                .nbr-liquid-nav {
                    --nbr-liquid-size: 50px;
                    --nbr-liquid-item: 42px;
                    --nbr-liquid-gap: 10px;
                    --nbr-liquid-fill: #FF741D;
                    --nbr-liquid-ink: #101010;
                    contain: layout style;
                    display: grid;
                    grid-column: 2;
                    isolation: isolate;
                    justify-self: center;
                    overflow: visible;
                    pointer-events: all;
                    position: relative;
                }

                .nbr-liquid-defs {
                    height: 0;
                    position: absolute;
                    width: 0;
                }

                .nbr-liquid-rest,
                .nbr-liquid-goo,
                .nbr-liquid-blob-layer,
                .nbr-liquid-icon-layer {
                    align-items: center;
                    display: flex;
                    gap: var(--nbr-liquid-gap);
                    grid-area: 1 / 1;
                    padding: 6px;
                }

                .nbr-liquid-rest,
                .nbr-liquid-goo {
                    transition: opacity 0.12s ease;
                }

                .nbr-liquid-rest {
                    display: flex;
                }

                .nbr-liquid-goo {
                    display: grid;
                }

                .nbr-liquid-rest.is-hidden,
                .nbr-liquid-goo.is-hidden {
                    opacity: 0;
                    pointer-events: none;
                    visibility: hidden;
                }

                .nbr-liquid-blob-layer {
                    pointer-events: none;
                    position: relative;
                    z-index: 1;
                }

                .nbr-liquid-icon-layer {
                    pointer-events: none;
                    position: relative;
                    z-index: 2;
                }

                .nbr-liquid-active,
                .nbr-liquid-btn {
                    align-items: center;
                    border-radius: 999px;
                    color: var(--nbr-liquid-ink);
                    display: inline-flex;
                    justify-content: center;
                    position: relative;
                    text-decoration: none;
                    -webkit-tap-highlight-color: transparent;
                }

                .nbr-liquid-active {
                    animation: nbr-liquid-active-separate 0.42s cubic-bezier(0.2, 0.9, 0.2, 1) both;
                    background: var(--nbr-liquid-fill);
                    flex: 0 0 auto;
                    height: var(--nbr-liquid-size);
                    pointer-events: auto;
                    width: var(--nbr-liquid-size);
                }

                .nbr-liquid-pill {
                    align-items: center;
                    animation: nbr-liquid-pill-settle 0.42s cubic-bezier(0.2, 0.9, 0.2, 1) both;
                    background: var(--nbr-liquid-fill);
                    border-radius: 999px;
                    display: inline-flex;
                    flex: 0 0 auto;
                    gap: 1px;
                    height: var(--nbr-liquid-size);
                    padding: 0 11px;
                }

                .nbr-liquid-pill--icons {
                    pointer-events: auto;
                }

                .nbr-liquid-btn {
                    background: transparent;
                    flex: 0 0 auto;
                    height: var(--nbr-liquid-size);
                    pointer-events: auto;
                    transition: transform 0.18s ease;
                    width: var(--nbr-liquid-item);
                }

                .nbr-liquid-btn:hover {
                    transform: translateY(-1px);
                }

                .nbr-liquid-icon {
                    display: block;
                    filter: brightness(0) saturate(100%);
                    height: 26px;
                    object-fit: contain;
                    width: 26px;
                }

                .nbr-liquid-active .nbr-liquid-icon {
                    height: 27px;
                    width: 27px;
                }

                .nbr-liquid-blob-active {
                    animation: nbr-liquid-goo-active 0.56s cubic-bezier(0.2, 0.92, 0.22, 1) both;
                    background: var(--nbr-liquid-fill);
                    border-radius: 999px;
                    flex: 0 0 auto;
                    height: var(--nbr-liquid-size);
                    position: relative;
                    width: var(--nbr-liquid-size);
                }

                .nbr-liquid-blob-active::after {
                    animation: nbr-liquid-goo-neck 0.56s cubic-bezier(0.2, 0.92, 0.22, 1) both;
                    background: var(--nbr-liquid-fill);
                    border-radius: 999px;
                    content: '';
                    height: 34px;
                    position: absolute;
                    right: calc((var(--nbr-liquid-gap) + 8px) * -1);
                    top: 50%;
                    transform: translateY(-50%) scaleX(0);
                    transform-origin: left center;
                    width: calc(var(--nbr-liquid-gap) + 15px);
                }

                .nbr-liquid-blob-pill {
                    align-items: center;
                    animation: nbr-liquid-goo-pill 0.56s cubic-bezier(0.2, 0.92, 0.22, 1) both;
                    background: var(--nbr-liquid-fill);
                    border-radius: 999px;
                    display: inline-flex;
                    flex: 0 0 auto;
                    gap: 1px;
                    height: var(--nbr-liquid-size);
                    padding: 0 11px;
                }

                .nbr-liquid-active::after,
                .nbr-liquid-btn::after {
                    background: ${isDark ? '#f7f7f7' : '#111111'};
                    border-radius: 999px;
                    color: ${isDark ? '#111111' : '#ffffff'};
                    content: attr(aria-label);
                    font-family: 'Onest', 'Outfit', sans-serif;
                    font-size: 0.68rem;
                    font-weight: 700;
                    left: 50%;
                    line-height: 1;
                    opacity: 0;
                    padding: 6px 8px;
                    pointer-events: none;
                    position: absolute;
                    top: calc(100% + 8px);
                    transform: translate(-50%, -4px) scale(0.96);
                    transition: opacity 0.16s ease, transform 0.16s ease;
                    white-space: nowrap;
                    z-index: 20;
                }

                .nbr-liquid-active:hover::after,
                .nbr-liquid-btn:hover::after,
                .nbr-liquid-active:focus-visible::after,
                .nbr-liquid-btn:focus-visible::after {
                    opacity: 1;
                    transform: translate(-50%, 0) scale(1);
                }

                .nbr-liquid-blob-slot {
                    flex: 0 0 auto;
                    height: 1px;
                    width: var(--nbr-liquid-item);
                }

                @keyframes nbr-liquid-active-separate {
                    0% { transform: translateX(10px) scale(0.96); }
                    100% { transform: translateX(0) scale(1); }
                }

                @keyframes nbr-liquid-pill-settle {
                    0% { transform: translateX(-8px) scaleX(1.02); }
                    100% { transform: translateX(0) scaleX(1); }
                }

                @keyframes nbr-liquid-goo-active {
                    0% { transform: translateX(14px) scale(0.9); }
                    58% { transform: translateX(3px) scale(1.04); }
                    100% { transform: translateX(0) scale(1); }
                }

                @keyframes nbr-liquid-goo-pill {
                    0% { transform: translateX(-12px) scaleX(1.07); }
                    100% { transform: translateX(0) scaleX(1); }
                }

                @keyframes nbr-liquid-goo-neck {
                    0% { opacity: 1; transform: translateY(-50%) scaleX(1); }
                    58% { opacity: 0.88; transform: translateY(-50%) scaleX(0.62); }
                    100% { opacity: 0; transform: translateY(-50%) scaleX(0); }
                }

                /* Glass pill */
                .nbr-pill {
                    align-items: center;
                    animation: fadeInDown 0.5s cubic-bezier(0.23,1,0.32,1) both;
                    backdrop-filter: blur(20px) saturate(200%);
                    -webkit-backdrop-filter: blur(20px) saturate(200%);
                    background: ${navSurface};
                    border: 1px solid ${navBorder};
                    border-radius: 999px;
                    box-shadow:
                        0 4px 24px rgba(15,23,42,0.10),
                        inset 0 1px 0 ${navInset};
                    display: inline-flex;
                    gap: 4px;
                    grid-column: 2;
                    justify-self: center;
                    min-height: 52px;
                    padding: 8px 12px;
                }

                @keyframes fadeInDown {
                    from { opacity: 0; transform: translateY(-12px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .nbr-logo-wrap {
                    align-items: center;
                    display: inline-flex;
                    flex-shrink: 0;
                    margin-right: 4px;
                    text-decoration: none;
                }

                .nbr-logo {
                    display: block;
                    height: 34px;
                    max-width: 150px;
                    object-fit: contain;
                    width: auto;
                }

                .nbr-logo--sm {
                    height: 28px;
                    max-width: 130px;
                }

                .nbr-sep {
                    background: ${navDivider};
                    border-radius: 1px;
                    flex-shrink: 0;
                    height: 20px;
                    margin: 0 6px;
                    width: 1px;
                }

                .nbr-link {
                    align-items: center;
                    border-radius: 999px;
                    color: ${navText};
                    display: inline-flex;
                    font-family: 'Okine', 'Outfit', sans-serif;
                    font-size: 0.875rem;
                    font-weight: 600;
                    justify-content: center;
                    line-height: 1;
                    min-height: 36px;
                    padding: 8px 14px;
                    text-decoration: none;
                    transition: color 0.18s, background 0.18s, transform 0.18s;
                    white-space: nowrap;
                }

                .nbr-link-inner {
                    align-items: center;
                    display: inline-flex;
                    gap: 6px;
                }

                .nbr-link:hover {
                    background: ${navHover};
                    color: ${navTextStrong};
                }

                .nbr-link--active {
                    background: ${navActiveBg};
                    color: ${navActiveText};
                }

                .nbr-join {
                    align-items: center;
                    border-radius: 999px;
                    color: var(--accent);
                    display: inline-flex;
                    font-family: 'Okine', 'Outfit', sans-serif;
                    font-size: 0.875rem;
                    font-weight: 700;
                    justify-content: center;
                    margin-left: 4px;
                    min-height: 36px;
                    padding: 8px 16px;
                    text-decoration: none;
                }

                .nbr-join--desktop {
                    background: #FF741D;
                    color: #101010;
                    grid-column: 2;
                    justify-self: center;
                }

                .nbr-right-actions {
                    align-items: center;
                    display: inline-flex;
                    gap: 10px;
                    grid-column: 3;
                    justify-self: end;
                }

                .nbr-theme-button,
                .nbr-map-button,
                .nbr-user-chip {
                    align-items: center;
                    animation: fadeInDown 0.5s cubic-bezier(0.23,1,0.32,1) both;
                    animation-delay: 0.06s;
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                    background: ${isDark ? '#2a2a2a' : '#d8d8d8'};
                    border: none;
                    border-radius: 999px;
                    box-shadow: none;
                    display: inline-flex;
                    color: ${navTextStrong};
                    text-decoration: none;
                    transition: box-shadow 0.2s, transform 0.2s, background 0.2s;
                }

                .nbr-theme-button,
                .nbr-map-button {
                    height: 42px;
                    justify-content: center;
                    padding: 0;
                    width: 42px;
                }

                .nbr-theme-button {
                    cursor: pointer;
                }

                .nbr-map-icon {
                    display: block;
                    height: 24px;
                    width: 24px;
                    object-fit: contain;
                }

                .nbr-theme-button:hover,
                .nbr-map-button:hover,
                .nbr-map-button--active {
                    background: ${isDark ? '#343434' : '#cfcfcf'};
                    transform: translateY(-1px);
                }

                .nbr-user-chip {
                    gap: 8px;
                    background: ${isDark ? '#2a2a2a' : '#efefef'};
                    padding: 4px 4px 4px 11px;
                    position: static;
                }

                .nbr-user-chip:hover {
                    box-shadow: none;
                    transform: translateY(-1px);
                }

                .nbr-user-chip--active {
                    background: color-mix(in srgb, #FF741D 24%, ${isDark ? '#2a2a2a' : '#efefef'});
                }

                .nbr-user-text {
                    display: flex;
                    flex-direction: column;
                    line-height: 1.25;
                }

                .nbr-user-name {
                    color: ${isDark ? '#f8fafc' : '#1d1207'};
                    font-family: 'Azonix', 'Outfit', sans-serif;
                    font-size: 0.82rem;
                    font-weight: 700;
                }

                .nbr-user-role {
                    color: ${navText};
                    font-family: 'Okine', 'Outfit', sans-serif;
                    font-size: 0.68rem;
                    font-weight: 500;
                }

                .nbr-avatar {
                    border-radius: 50%;
                    flex-shrink: 0;
                    height: 30px;
                    object-fit: cover;
                    width: 30px;
                }

                .nbr-mobile  { display: none !important; }

                .nbr-mobile-pill {
                    flex: 1;
                    max-width: 100%;
                    width: 100%;
                }

                .nbr-mobile-actions {
                    align-items: center;
                    display: flex;
                    gap: 8px;
                    margin-left: auto;
                }

                .nbr-avatar-sm-wrap {
                    border: 1.5px solid var(--border-light);
                    border-radius: 50%;
                    display: block;
                    flex-shrink: 0;
                    height: 28px;
                    overflow: hidden;
                    width: 28px;
                }

                .nbr-avatar-sm {
                    height: 100%;
                    object-fit: cover;
                    width: 100%;
                }

                .nbr-hamburger {
                    align-items: center;
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    background: ${navHover};
                    border: 1px solid var(--border-light);
                    border-radius: 999px;
                    color: var(--text-main);
                    cursor: pointer;
                    display: inline-flex;
                    height: 32px;
                    justify-content: center;
                    padding: 0;
                    transition: background 0.18s;
                    width: 32px;
                }

                .nbr-hamburger:hover { background: ${isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)'}; }

                .nbr-dropdown {
                    animation: nbrMenuIn 0.24s cubic-bezier(0.18, 0.92, 0.22, 1) both;
                    background: ${mobileMenuBg};
                    border: none;
                    border-radius: 22px;
                    box-shadow: none;
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    margin-top: 10px;
                    min-height: 330px;
                    padding: 24px 18px 20px;
                    pointer-events: all;
                    width: 100%;
                }

                .nbr-desktop--map2 {
                    display: none !important;
                }

                .nbr-mobile--map2 {
                    display: flex !important;
                    flex-direction: column;
                    align-items: stretch;
                    padding: 0 16px;
                    top: 16px;
                }

                .nbr-mobile--map2 .nbr-mobile-pill {
                    backdrop-filter: none !important;
                    -webkit-backdrop-filter: none !important;
                    background: transparent !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    padding: 7px 10px !important;
                    pointer-events: none;
                }

                .nbr-mobile--map2 .nbr-mobile-actions {
                    display: none !important;
                }

                .nbr-mobile--map2 .nbr-logo-wrap {
                    pointer-events: auto;
                }

                @keyframes nbrMenuIn {
                    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .nbr-drop-item {
                    align-items: center;
                    border-radius: 12px;
                    color: ${mobileMenuUtilityText};
                    display: flex;
                    font-family: 'Okine', 'Outfit', sans-serif;
                    font-size: 1rem;
                    font-weight: 500;
                    justify-content: space-between;
                    min-height: 32px;
                    padding: 3px 12px;
                    text-decoration: none;
                    transition: background 0.14s ease, color 0.14s ease, transform 0.14s ease;
                }

                .nbr-drop-item:hover {
                    background: ${mobileMenuHover};
                    transform: translateX(2px);
                }

                .nbr-drop-item--main {
                    color: ${mobileMenuText};
                    font-family: 'Onest', 'Outfit', sans-serif;
                    font-size: clamp(1.55rem, 7vw, 1.95rem);
                    font-weight: 500;
                    letter-spacing: 0;
                    line-height: 1;
                    min-height: 41px;
                    padding: 4px 0 4px 12px;
                }

                .nbr-drop-arrow {
                    flex: 0 0 auto;
                    height: 15px;
                    margin-right: 8px;
                    object-fit: contain;
                    transform: translateY(-1px);
                    width: 15px;
                }

                .nbr-drop-item--accent { color: var(--accent); font-weight: 800; }
                .nbr-drop-item--danger { color: #ff2b1f; }

                .nbr-drop-item--btn {
                    align-items: center;
                    background: none;
                    border: none;
                    cursor: pointer;
                    display: flex;
                    font-family: inherit;
                    gap: 10px;
                    justify-content: flex-start;
                    text-align: left;
                    width: 100%;
                }

                @media (max-width: 768px) {
                    .nbr-desktop { display: none !important; }
                    .nbr-mobile  { display: flex !important; flex-direction: column; align-items: stretch; padding: 0 16px; top: 16px; }

                    .nbr-mobile-pill {
                        backdrop-filter: none !important;
                        -webkit-backdrop-filter: none !important;
                        background: transparent !important;
                        border: none !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                        padding: 7px 10px !important;
                    }

                    .nbr-hamburger {
                        backdrop-filter: blur(16px) saturate(180%);
                        -webkit-backdrop-filter: blur(16px) saturate(180%);
                        background: ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.42)'};
                        border: 1px solid ${isDark ? 'rgba(255,255,255,0.22)' : 'rgba(122,72,20,0.22)'};
                        box-shadow:
                            0 6px 18px rgba(15,23,42,0.14),
                            inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.72)'};
                    }

                    .nbr-avatar-sm-wrap { display: none !important; }

                    .nbr-mobile--map2 .nbr-mobile-actions {
                        display: none !important;
                    }

                    .nbr-mobile--map2 .nbr-mobile-pill {
                        pointer-events: none;
                    }

                    .nbr-mobile--map2 .nbr-logo-wrap {
                        pointer-events: auto;
                    }
                }
            `}</style>
        </>
    );
};
